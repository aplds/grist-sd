// Journal de diagnostic.
//
// Rassemble en un texte copiable tout ce qu'il faut pour comprendre une panne
// d'écriture dans un document Grist : contexte de la page, état de la liaison,
// comparaison du modèle de l'outil avec le document réel (tables, colonnes et
// formules), utilisateurs reconnus, dernière erreur et journal des échanges.
//
// La raison d'être de ce module : Grist n'indique jamais *quelle* action d'un
// lot a échoué, ni quel élément du document est en cause. Sans ce journal, un
// refus d'écriture (« [Sandbox] KeyError 'X' ») reste indéchiffrable pour qui
// n'a pas le document sous les yeux.
//
// Aucune donnée de dossier n'y figure : ni affaire, ni personne mise en cause.
// Seuls sont repris les noms de tables et de colonnes du document, ses
// formules, et les personnes *autorisées* (table technique des utilisateurs),
// qui servent à expliquer les rôles.

import { SCHEMA } from "./schema.js";
import { ligneVersion } from "./version.js";
import { currentRole, roleFromGristAccess, roleLabel } from "./roles.js";
import { gristTheme } from "./affichage.js";
import {
  documentColumns, documentReadOnly, documentTables, gristApiUrl, gristAvailable, gristOriginesDiagnostic,
  journalEntries, lastWriteError, nestedFrame, originesGristDeclarees, sessionUsers, widgetAccessLevel, writesEnabled,
} from "./grist-backend.js";
import { erreurStockage, occupationStockage } from "./store.js";

const FORMULE_MAX = 200;
const JOURNAL_MAX = 60;
const RAPPORT_MAX = 60000;

const tronque = (texte, max) => {
  const t = String(texte === null || texte === undefined ? "" : texte).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

const ligne = (label, valeur) => `${label} : ${valeur === "" || valeur === null || valeur === undefined ? "—" : valeur}`;

const titre = (texte) => `\n-- ${texte} ${"-".repeat(Math.max(0, 54 - texte.length))}\n`;

/** Colonnes du document, regroupées par table. */
function colonnesParTable() {
  const meta = documentColumns();
  const parTable = {};
  if (!meta) return parTable;
  for (const [cle, infos] of Object.entries(meta)) {
    const point = cle.indexOf(".");
    if (point < 0) continue;
    const table = cle.slice(0, point);
    const colonne = cle.slice(point + 1);
    (parTable[table] = parTable[table] || []).push({ colonne, ...infos });
  }
  return parTable;
}

/** Tables du modèle absentes du document, et colonnes manquantes par table. */
function manques() {
  const doc = colonnesParTable();
  const tables = documentTables();
  const rapport = { tablesAbsentes: [], tablesFacultatives: [], parTable: {}, colonnes: [] };
  for (const [nom, def] of Object.entries(SCHEMA)) {
    if (tables && !tables.includes(nom)) {
      (def.optional ? rapport.tablesFacultatives : rapport.tablesAbsentes).push(nom);
      continue;
    }
    if (!tables) continue;
    const absentes = def.columns.filter((c) => !(doc[nom] || []).some((d) => d.colonne === c.id)).map((c) => c.id);
    if (absentes.length) {
      rapport.parTable[nom] = absentes;
      for (const c of absentes) rapport.colonnes.push(`${nom}.${c}`);
    }
  }
  return rapport;
}

/** Formules du document qui nomment une colonne absente. */
function formulesEnCause(colonnesManquantes) {
  if (!colonnesManquantes.length) return [];
  const doc = colonnesParTable();
  const trouves = [];
  for (const [table, colonnes] of Object.entries(doc)) {
    for (const c of colonnes) {
      if (!c.isFormula || !c.formula) continue;
      for (const manque of colonnesManquantes) {
        const nom = manque.slice(manque.indexOf(".") + 1);
        if (new RegExp(`(^|[^\\w])${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w]|$)`).test(c.formula)) {
          trouves.push(`${table}.${c.colonne} = ${tronque(c.formula, FORMULE_MAX)}`);
          break;
        }
      }
    }
  }
  return trouves;
}

/** Compte rendu complet, prêt à être copié dans un message. */
export function diagnosticReport(store, state) {
  const now = new Date();
  const espace = [];
  espace.push("=== Journal de diagnostic — Gestion des sections disciplinaires ===");
  espace.push(ligne("Version de l'outil", ligneVersion()));
  espace.push(ligne("Généré le", `${now.toISOString()} (${now.toLocaleString("fr-FR")})`));
  espace.push(ligne("Page", typeof location !== "undefined" ? location.href : "—"));
  espace.push(ligne("Générateur", (typeof window !== "undefined" && window.generatorName) || "—"));
  espace.push(ligne("Navigateur", (typeof navigator !== "undefined" && navigator.userAgent) || "—"));
  espace.push(ligne("Langue", (typeof navigator !== "undefined" && navigator.language) || "—"));
  espace.push(ligne("Fenêtre", typeof window !== "undefined"
    ? `${window.innerWidth} × ${window.innerHeight} (écran ${window.screen?.width || "?"} × ${window.screen?.height || "?"})`
    : "—"));
  espace.push(ligne("Cadre appelant", (typeof document !== "undefined" && document.referrer) || "—"));

  const role = currentRole(state);
  espace.push(titre("Liaison Grist"));
  espace.push(ligne("Mode d'exécution", gristAvailable() ? "widget Grist" : "autonome (localStorage)"));
  espace.push(ligne("Connexion au document", state.grist === "connected"
    ? "connecté"
    : state.grist === "error" ? "échec" : state.grist ? "en cours" : "aucune"));
  espace.push(ligne("Accès accordé au widget", widgetAccessLevel || "non signalé"));
  espace.push(ligne("API du widget", gristApiUrl || "non chargée"));
  const origines = gristOriginesDiagnostic();
  espace.push(ligne("Origine de la page appelante", origines.parent === "inconnue"
    ? "aucune (outil hors cadre)"
    : `${origines.parent} — ${origines.parentAutorise ? "autorisée" : "non autorisée"}`));
  espace.push(ligne("Origines Grist autorisées", origines.autorisees || "aucune"));
  espace.push(ligne("Serveurs Grist déclarés sur ce poste", originesGristDeclarees().join(", ") || "aucun"));
  espace.push(ligne("Cadre d'affichage", nestedFrame()
    ? "imbriqué (l'API du widget ne répond qu'à son parent immédiat)" : "direct"));
  espace.push(ligne("Thème annoncé par Grist", gristTheme()
    ? `${gristTheme()} — le sélecteur de thème de l'en-tête s'efface`
    : "aucun — le sélecteur de thème de l'en-tête reste proposé"));
  espace.push(ligne("Écritures vers le document", state.grist !== "connected"
    ? "sans objet (hors document)" : writesEnabled() ? "actives" : "suspendues"));
  espace.push(ligne("Document retenu en lecture seule", documentReadOnly()
    ? "OUI — le serveur Grist refuse toute modification (site suspendu, abonnement, plan ou instance)"
    : "non"));
  espace.push(ligne("Paramètres du widget", (typeof location !== "undefined" && location.search) || "—"));
  espace.push(ligne("Rôle appliqué", `${roleLabel(role)} (source : ${state.user ? state.user.source : "indéterminée"})`));
  espace.push(ligne("Utilisateur", state.user
    ? `${state.user.name || "(sans nom)"} <${state.user.email || "?"}>` : "indéterminé"));
  espace.push(ligne("Erreur de liaison", state.gristError || "aucune"));
  espace.push(ligne("Dernière erreur d'écriture", lastWriteError || "aucune"));

  const doc = colonnesParTable();
  const tables = documentTables();
  espace.push(titre("Document Grist"));
  espace.push(ligne("Tables annoncées", tables ? `${tables.length} — ${tables.join(", ")}` : "non lues"));
  espace.push(ligne("Métadonnées de colonnes", documentColumns()
    ? `${Object.keys(documentColumns()).length} colonne(s) lue(s)` : "illisibles"));

  const mq = manques();
  espace.push(titre("Comparaison du modèle et du document"));
  espace.push(ligne("Tables attendues absentes", mq.tablesAbsentes.length ? mq.tablesAbsentes.join(", ") : "aucune"));
  espace.push(ligne("Tables facultatives absentes",
    mq.tablesFacultatives.length ? `${mq.tablesFacultatives.join(", ")} (créées à la demande depuis Réglages)` : "aucune"));
  espace.push(ligne("Colonnes attendues absentes", mq.colonnes.length ? mq.colonnes.join(", ") : "aucune"));
  for (const [nom, absentes] of Object.entries(mq.parTable)) {
    const def = SCHEMA[nom];
    const presentes = def.columns.length - absentes.length;
    espace.push(`  • ${nom} : ${presentes}/${def.columns.length} colonne(s) présente(s), manquante(s) : ${absentes.join(", ")}`);
  }
  if (tables) {
    for (const nom of Object.keys(SCHEMA)) {
      if (mq.tablesAbsentes.includes(nom) || mq.parTable[nom]) continue;
      if (!tables.includes(nom)) continue;
      espace.push(`  • ${nom} : conforme (${SCHEMA[nom].columns.length} colonne(s))`);
    }
  }

  const enCause = formulesEnCause(mq.colonnes);
  espace.push(titre("Formules du document en cause"));
  espace.push(enCause.length
    ? enCause.map((f) => `  • ${f}`).join("\n")
    : "  (aucune formule du document ne nomme une colonne absente)");

  const formules = [];
  for (const [table, colonnes] of Object.entries(doc)) {
    for (const c of colonnes) {
      if (c.isFormula && c.formula) formules.push(`  • ${table}.${c.colonne} = ${tronque(c.formula, FORMULE_MAX)}`);
    }
  }
  espace.push(titre("Colonnes calculées du document"));
  espace.push(formules.length ? formules.join("\n") : "  (aucune)");

  espace.push(titre("Colonnes du document, par table"));
  for (const table of Object.keys(doc).sort()) {
    espace.push(`  • ${table} : ${doc[table].map((c) => c.colonne).join(", ")}`);
  }

  espace.push(titre("Contenu de la base locale"));
  espace.push(`  ${Object.keys(SCHEMA).map((t) => `${t}:${store.table(t).length}`).join("  ")}`);

  // NC-0024 : l'échec d'écriture dans le navigateur doit se voir ici aussi.
  espace.push(titre("Stockage local"));
  const occ = occupationStockage();
  espace.push(ligne("Mode", store.modeSession ? "session (rien n'est conservé sur le poste)" : "persistant"));
  espace.push(ligne("Occupation de la base", store.modeSession
    ? "sans objet (mode session)"
    : `${Math.round(occ.octets / 1024)} Kio sur ${Math.round(occ.quota / 1024)} Kio estimés (${Math.round(occ.ratio * 100)} %) — niveau : ${occ.niveau}`));
  espace.push(ligne("Dernière erreur d'enregistrement local", erreurStockage() || "aucune"));

  espace.push(titre("Utilisateurs reconnus"));
  espace.push(sessionUsers.length
    ? sessionUsers.map((u) => `  • #${u.id} ${u.Nom || "?"} <${u.Email || "?"}> accès « ${u.Acces || "?"} » → ${roleLabel(roleFromGristAccess(u.Acces))}`).join("\n")
    : "  (aucun)");

  const journal = journalEntries();
  espace.push(titre("Journal des échanges"));
  espace.push(journal.length
    ? journal.slice(-JOURNAL_MAX).map((e) => `  #${e.n} ${e.t} [${e.kind}] ${e.label}${e.details ? ` — ${e.details}` : ""}`).join("\n")
    : "  (vide)");

  let texte = `${espace.join("\n")}\n`;
  if (texte.length > RAPPORT_MAX) {
    texte = `${texte.slice(0, RAPPORT_MAX)}\n… (rapport tronqué : ${texte.length} caractères)\n`;
  }
  return texte;
}
