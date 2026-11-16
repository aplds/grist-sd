// Outil d'import : reprise du tableur d'origine vers le modèle de l'outil.
//
// Le document Grist d'origine est décrit dans `legacy.js`. La conversion se fait
// en deux temps, et c'est ce découpage qui rend l'import vérifiable :
//
//  1. **Analyse** (`analyserSource`) : que contient la source, et que deviendra
//     chaque table ? Rien n'est écrit.
//  2. **Conversion puis application** (`convertir`, `appliquerImport`) : les
//     lignes sont transformées en modèle v2 (références résolues, personnes
//     créées, commission reprise en intervenants), puis écrites dans la base.
//
// Deux modes d'application :
//
//  - **Compléter** : la base existante est conservée ; chaque ligne reçue est
//    rapprochée d'une ligne existante par une *clé naturelle* (le numéro d'une
//    affaire, le courriel d'un secrétaire…). Réimporté sur une base déjà
//    convertie, l'import n'ajoute alors rien.
//  - **Remplacer** : les tables de l'outil sont vidées avant l'écriture.
//
// L'import ne supprime jamais une ligne du document, ni dans la table
// d'héritage : il ajoute, complète et relie.

import { COLONNES_RENOMMEES, SCHEMA } from "./schema.js";
import { LEGACY_ROLES_INTERVENANT, QUILL_ALIGN_CLASS, QUILL_BLANC } from "./legacy.js";
import { MOTIFS_PAR_DEFAUT, SANCTIONS_PAR_DEFAUT, parametresParDefaut } from "./regimes.js";
import { COLONNES_RICHES, assainirHtmlSecurite } from "./sanitize.js";

/* ------------------------------------------------------------------ */
/* Analyse                                                             */
/* ------------------------------------------------------------------ */

/**
 * Reconnaît l'architecture d'une source (`{ Table: lignes[] }`) : architecture
 * d'origine, modèle de l'outil, ou les deux — un document à demi migré reprend
 * en effet les deux formes en même temps.
 */
export function analyserSource(source) {
  const tables = [];
  let total = 0;
  const avertissements = [];

  const aCommission = (source.Commissions || []).length > 0;
  const affaireOrigine = (source.Affaires || []).some((a) => "Prenom_du_mis_en_cause" in a);
  const seanceOrigine = (source.Seances_d_examen || []).some((s) => "Affaires" in s);
  const modeleV2 = (source.Personnes || []).length > 0
    || (source.Intervenants || []).length > 0
    || (source.Sanctions || []).length > 0;

  for (const [name, def] of Object.entries(SCHEMA)) {
    const rows = source[name];
    if (!rows) continue;
    tables.push({
      name,
      label: def.label,
      heritage: !!def.legacy,
      lignes: rows.length,
      present: true,
    });
    total += rows.length;
  }

  if (affaireOrigine) {
    avertissements.push({
      niveau: "info",
      texte: "L'identité du mis en cause est encore portée par les colonnes de l'affaire : elle deviendra une fiche du répertoire « Personnes », reliée à chaque affaire.",
    });
  }
  if (aCommission) {
    avertissements.push({
      niveau: "info",
      texte: `La table d'origine « Commissions » (${(source.Commissions || []).length} ligne(s)) sera reprise dans « Intervenants ». La table d'origine n'est pas modifiée.`,
    });
  }
  if (seanceOrigine) {
    avertissements.push({
      niveau: "info",
      texte: "La liste d'affaires portée par les séances d'origine est reprise sur les affaires elles-mêmes : un dossier porte désormais sa séance.",
    });
  }
  const tramesQuill = (source.Trames || []).filter((t) => QUILL_ALIGN_CLASS.test(t.Template_contenu || "") || QUILL_BLANC.test(t.Template_contenu || ""));
  if (tramesQuill.length) {
    avertissements.push({
      niveau: "avertissement",
      texte: `${tramesQuill.length} trame(s) contiennent des traces de l'éditeur d'origine (alignements « ql-align », sauts de ligne blancs). Le texte est repris tel quel ; la mise en page est interprétée par l'éditeur de l'outil.`,
    });
  }
  const orphelines = (source.Affaires || []).filter(
    (a) => !a.Prenom_du_mis_en_cause && !a.Nom_du_mis_en_cause && !a.Mis_en_cause
  ).length;
  if (orphelines) {
    avertissements.push({
      niveau: "avertissement",
      texte: `${orphelines} affaire(s) sans nom de personne mise en cause : une fiche vide sera créée, à compléter.`,
    });
  }

  return {
    tables,
    total,
    estOrigine: aCommission || affaireOrigine || seanceOrigine,
    estV2: modeleV2,
    vide: total === 0,
    avertissements,
  };
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

// `src` conserve l'identifiant d'origine tel quel : les catalogues installés
// par défaut n'ont pas d'identifiant numérique (« defaut-3 »), et une
// référence ne doit pas être perdue à cause de cela.
const ref = (table, src) => ({ __ref: table, src: src ?? 0 });

const MODELE_DATE = /^\d{4}-\d{2}-\d{2}/;

function texte(v) {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Convertit une source en lignes du modèle v2.
 *
 * Les identifiants d'origine ne sont pas conservés tels quels : chaque ligne
 * reçoit une référence interne (`__src`) et les liens entre tables deviennent
 * des marqueurs `{ __ref, src }`, que l'application résout après insertion.
 * Les identifiants définitifs dépendent donc du mode (Compléter/Remplacer),
 * et non de la source.
 */
export function convertir(source) {
  const out = {};
  const avertissements = [];
  const ajoute = (table, row) => {
    (out[table] = out[table] || []).push(row);
    return row;
  };

  /* Catalogues : ceux de la source, ou les catalogues par défaut. */
  if ((source.Sanctions || []).length) {
    for (const s of source.Sanctions) ajoute("Sanctions", { __src: s.id, ...copie(s, SCHEMA.Sanctions) });
  } else {
    SANCTIONS_PAR_DEFAUT.forEach((s, i) => ajoute("Sanctions", { __src: `defaut-${i + 1}`, ...s }));
    if (source.Affaires || source.Decisions) {
      avertissements.push({ niveau: "info", texte: `Aucun catalogue de sanctions dans la source : les ${SANCTIONS_PAR_DEFAUT.length} sanctions courantes sont installées.` });
    }
  }
  if ((source.Motifs || []).length) {
    for (const m of source.Motifs) ajoute("Motifs", { __src: m.id, ...copie(m, SCHEMA.Motifs) });
  } else {
    MOTIFS_PAR_DEFAUT.forEach((m, i) => ajoute("Motifs", { __src: `defaut-${i + 1}`, ...m }));
  }
  if ((source.Parametres || []).length) {
    for (const p of source.Parametres) ajoute("Parametres", { __src: p.id, ...copie(p, SCHEMA.Parametres) });
  } else {
    parametresParDefaut().forEach((p, i) => ajoute("Parametres", { __src: `defaut-${i + 1}`, ...p }));
  }

  /* Tables de référence. */
  for (const s of source.Sections_disciplinaires || []) {
    ajoute("Sections_disciplinaires", { __src: s.id, ...copie(s, SCHEMA.Sections_disciplinaires) });
  }
  for (const m of source.Membres || []) {
    const row = { __src: m.id, ...copie(m, SCHEMA.Membres) };
    if (m.Section) row.Section = ref("Sections_disciplinaires", m.Section);
    ajoute("Membres", row);
  }
  for (const s of source.Secretaires || []) {
    ajoute("Secretaires", { __src: s.id, ...copie(s, SCHEMA.Secretaires) });
  }
  for (const d of source.Destinataires_institutionnels || []) {
    ajoute("Destinataires_institutionnels", { __src: d.id, ...copie(d, SCHEMA.Destinataires_institutionnels) });
  }
  for (const p of source.Presentation || []) ajoute("Presentation", { __src: p.id, ...copie(p, SCHEMA.Presentation) });
  for (const p of source.Identite || []) ajoute("Identite", { __src: p.id, ...copie(p, SCHEMA.Identite) });

  /* Personnes : les fiches existantes, puis une fiche par mis en cause. */
  const personneParCle = new Map();
  const clePersonne = (p) => `${texte(p.Prenom).trim().toLowerCase()}|${texte(p.Nom).trim().toLowerCase()}|${texte(p.Date_de_naissance).slice(0, 10)}`;
  const ajoutePersonne = (objet, src) => {
    const cle = clePersonne(objet);
    if (personneParCle.has(cle)) return personneParCle.get(cle);
    const row = { __src: src ?? `p${personneParCle.size + 1}`, ...objet };
    ajoute("Personnes", row);
    personneParCle.set(cle, row);
    return row;
  };
  for (const p of source.Personnes || []) {
    ajoutePersonne(copie(p, SCHEMA.Personnes), p.id);
  }
  const personneDeAffaire = new Map();
  for (const a of source.Affaires || []) {
    if (a.Mis_en_cause) { personneDeAffaire.set(a.id, { __lien: a.Mis_en_cause }); continue; }
    const section = (source.Sections_disciplinaires || []).find((s) => s.id === Number(a.Section));
    const personnel = section?.Public === "Enseignants-chercheurs";
    personneDeAffaire.set(a.id, ajoutePersonne({
      Type: personnel ? "Personnel" : "Usager",
      Prenom: a.Prenom_du_mis_en_cause || "",
      Nom: a.Nom_du_mis_en_cause || "",
      Genre: a.Genre || "",
      Date_de_naissance: a.Date_de_naissance || "",
      Adresse: a.Adresse || "",
      INE: a.INE || "",
      Formation_suivie: a.Formation_suivie || "",
      Composante: a.Composante || "",
      Corps: a.Corps || "",
    }, `affaire-${a.id}`));
  }

  /* Trames et types de trames. */
  for (const t of source.Types_Trames || []) ajoute("Types_Trames", { __src: t.id, ...copie(t, SCHEMA.Types_Trames) });
  const typeTrameParSrc = new Map((out.Types_Trames || []).map((t) => [t.__src, t]));
  for (const t of source.Trames || []) {
    const row = { __src: t.id, ...copie(t, SCHEMA.Trames) };
    if (t.Type) row.Type = ref("Types_Trames", t.Type);
    ajoute("Trames", row);
  }
  void typeTrameParSrc;

  /* Séances : la liste d'affaires de l'origine est reportée sur les affaires. */
  const seanceDeAffaire = new Map();
  for (const s of source.Seances_d_examen || []) {
    const row = { __src: s.id, ...copie(s, SCHEMA.Seances_d_examen) };
    if (s.Section) row.Section = ref("Sections_disciplinaires", s.Section);
    ajoute("Seances_d_examen", row);
    for (const affaireId of idsDeListe(s.Affaires)) seanceDeAffaire.set(Number(affaireId), s.id);
  }

  /* Affaires. */
  for (const a of source.Affaires || []) {
    const row = { __src: a.id, ...copie(a, SCHEMA.Affaires) };
    if (a.Section) row.Section = ref("Sections_disciplinaires", a.Section);
    if (a.Secretaire) row.Secretaire = ref("Secretaires", a.Secretaire);
    if (a.Autorite_de_saisine) row.Autorite_de_saisine = ref("Destinataires_institutionnels", a.Autorite_de_saisine);
    const personne = personneDeAffaire.get(a.id);
    if (personne?.__lien !== undefined) row.Mis_en_cause = ref("Personnes", personne.__lien);
    else if (personne) row.Mis_en_cause = ref("Personnes", personne.__src);
    const seance = a.Seance_d_examen || seanceDeAffaire.get(Number(a.id));
    if (seance) row.Seance_d_examen = ref("Seances_d_examen", seance);
    const motifs = idsDeListe(a.Motifs);
    if (motifs.length) row.Motifs = motifs.map((m) => ref("Motifs", m));
    else {
      // Rapprochement du texte des motifs avec le catalogue, à titre indicatif.
      const trouves = (out.Motifs || []).filter((m) => m.Libelle && texte(a.Motif).toLowerCase().includes(m.Libelle.toLowerCase()));
      if (trouves.length) row.Motifs = trouves.map((m) => ref("Motifs", m.__src));
    }
    ajoute("Affaires", row);
  }
  const affaireParSrc = new Map((out.Affaires || []).map((a) => [a.__src, a]));

  /* Intervenants : ceux déjà au modèle, sinon la commission d'origine. */
  if ((source.Intervenants || []).length) {
    for (const x of source.Intervenants) {
      const row = { __src: x.id, ...copie(x, SCHEMA.Intervenants) };
      if (x.Affaire) row.Affaire = ref("Affaires", x.Affaire);
      if (x.Membre) row.Membre = ref("Membres", x.Membre);
      if (x.Personne) row.Personne = ref("Personnes", x.Personne);
      ajoute("Intervenants", row);
    }
  } else {
    for (const c of source.Commissions || []) {
      const role = LEGACY_ROLES_INTERVENANT[c.Role];
      if (c.Role && !role) {
        avertissements.push({ niveau: "avertissement", texte: `Rôle de commission inconnu « ${c.Role} » : repris comme « Membre de la formation ».` });
      }
      const row = {
        __src: `commission-${c.id}`,
        Affaire: ref("Affaires", c.Affaire),
        Role: role || "Membre de la formation",
        Qualite: "Membre de la section",
        Membre: ref("Membres", c.Membre),
        Personne: 0,
        Nom_libre: "",
        Statut: "Désigné",
        Date_de_designation: affaireParSrc.get(c.Affaire)?.Date_de_saisine || "",
      };
      ajoute("Intervenants", row);
    }
  }

  /* Implications, décisions, recours, documents, journal. */
  for (const x of source.Implications || []) {
    const row = { __src: x.id, ...copie(x, SCHEMA.Implications) };
    if (x.Affaire) row.Affaire = ref("Affaires", x.Affaire);
    if (x.Personne) row.Personne = ref("Personnes", x.Personne);
    ajoute("Implications", row);
  }
  const sanctionParLibelle = new Map((out.Sanctions || []).map((s) => [texte(s.Libelle).trim().toLowerCase(), s]));
  for (const d of source.Decisions || []) {
    const row = { __src: d.id, ...copie(d, SCHEMA.Decisions) };
    if (d.Affaire) row.Affaire = ref("Affaires", d.Affaire);
    if (d.Sanction) row.Sanction = ref("Sanctions", d.Sanction);
    else {
      const sanction = sanctionParLibelle.get(texte(d.Decision).trim().toLowerCase());
      if (sanction) row.Sanction = ref("Sanctions", sanction.__src);
    }
    if (!row.Nature) row.Nature = /abandon|classement|relaxe/i.test(texte(d.Decision)) ? "Issue de procédure" : "Sanction";
    ajoute("Decisions", row);
  }
  for (const r of source.Recours || []) {
    const row = { __src: r.id, ...copie(r, SCHEMA.Recours) };
    if (r.Affaire) row.Affaire = ref("Affaires", r.Affaire);
    if (r.Decision) row.Decision = ref("Decisions", r.Decision);
    ajoute("Recours", row);
  }
  for (const g of source.Generateur || []) {
    const row = { __src: g.id, ...copie(g, SCHEMA.Generateur) };
    if (g.Affaire) row.Affaire = ref("Affaires", g.Affaire);
    if (g.Template) row.Template = ref("Trames", g.Template);
    if (g.Destinataire_institutionnel) row.Destinataire_institutionnel = ref("Destinataires_institutionnels", g.Destinataire_institutionnel);
    if (g.Emetteur) row.Emetteur = ref("Destinataires_institutionnels", g.Emetteur);
    ajoute("Generateur", row);
  }
  for (const j of source.Journal || []) {
    ajoute("Journal", { __src: j.id, ...copie(j, SCHEMA.Journal) });
  }

  return { tables: out, avertissements };
}

/** Copie les seules colonnes connues du schéma, hors calculées. */
function copie(row, def) {
  const out = {};
  for (const c of def.columns) {
    if (c.formula) continue;
    if (c.type?.startsWith("Ref") && typeof row[c.id] === "object") continue;
    if (row[c.id] !== undefined) out[c.id] = valeurAssainie(c.id, row[c.id]);
  }
  // Une colonne renommée depuis (voir `COLONNES_RENOMMEES`) est lue sous son
  // ancien nom quand la source le porte encore — tableur d'origine, ou base
  // enregistrée avant le renommage.
  for (const [avant, apres] of Object.entries(COLONNES_RENOMMEES)) {
    if (out[apres] === undefined && row[avant] !== undefined) out[apres] = valeurAssainie(apres, row[avant]);
  }
  return out;
}

/**
 * Les colonnes de HTML rendu tel quel sont assainies à l'import (NC-0006) :
 * une trame reçue d'un autre établissement ne peut pas porter de script. Les
 * autres colonnes sont des valeurs de données, échappées au rendu.
 */
function valeurAssainie(colonne, valeur) {
  if (COLONNES_RICHES.has(colonne) && typeof valeur === "string") return assainirHtmlSecurite(valeur);
  return valeur;
}

/** Identifiants d'une liste Grist (« [1,2] », tableau JSON, ou nombre). */
export function idsDeListe(v) {
  if (v === null || v === undefined || v === "") return [];
  if (Array.isArray(v)) return v.map(Number).filter((x) => Number.isFinite(x) && x !== 0);
  if (typeof v === "number") return [v];
  const s = String(v).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(Number).filter((x) => Number.isFinite(x) && x !== 0);
  } catch { /* liste écrite « 1,2 » */ }
  return s.replace(/[[\]]/g, "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x !== 0);
}

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

/** Ordre d'insertion : une table n'est écrite qu'une fois ses références. */
export const ORDRE_IMPORT = [
  "Types_Trames", "Sections_disciplinaires", "Membres", "Secretaires", "Destinataires_institutionnels",
  "Sanctions", "Motifs", "Parametres", "Personnes", "Trames", "Seances_d_examen", "Affaires",
  "Jonctions", "Intervenants", "Implications", "Decisions", "Recours", "Generateur", "Journal",
  "Presentation", "Identite",
];

/**
 * Clé naturelle : ce qui permet de reconnaître une ligne déjà importée.
 *
 * Toute table écrite doit figurer ici, sinon un second import en mode
 * « Compléter » dupliquerait ses lignes. Les tables filles s'appuient sur
 * l'affaire (ou la date) en plus de leur contenu, pour qu'une même décision de
 * deux affaires différentes reste deux lignes.
 */
const CLES = {
  Sections_disciplinaires: (r) => `${r.Structure}|${r.Public}`,
  Membres: (r) => `${texte(r.Prenom).trim()}|${texte(r.NOM).trim()}|${r.Section || ""}`,
  Secretaires: (r) => texte(r.Email).trim().toLowerCase(),
  Destinataires_institutionnels: (r) => `${texte(r.Nom_complet).trim()}|${texte(r.Qualite).trim()}`,
  Personnes: (r) => `${texte(r.Prenom).trim().toLowerCase()}|${texte(r.Nom).trim().toLowerCase()}|${texte(r.Date_de_naissance).slice(0, 10)}`,
  Affaires: (r) => texte(r.Numero).trim(),
  // Une jonction est reconnue à son affaire de tête : la rejoindre depuis deux
  // documents différents ne crée donc pas deux groupes concurrents.
  Jonctions: (r) => `${r.Affaire_de_tete || 0}`,
  Seances_d_examen: (r) => `${r.Section || ""}|${texte(r.Date).slice(0, 10)}|${texte(r.Type)}`,
  Intervenants: (r) => `${r.Affaire || 0}|${texte(r.Role)}|${r.Membre || 0}|${r.Personne || 0}|${texte(r.Nom_libre).trim().toLowerCase()}`,
  Implications: (r) => `${r.Affaire || 0}|${r.Personne || 0}|${texte(r.Role)}`,
  Decisions: (r) => `${r.Affaire || 0}|${r.Sanction || 0}|${texte(r.Decision)}|${texte(r.Date_de_notification).slice(0, 10)}`,
  Recours: (r) => `${r.Affaire || 0}|${texte(r.Juridiction)}|${texte(r.Type_de_recours)}|${texte(r.Date_d_introduction).slice(0, 10)}`,
  Generateur: (r) => `${r.Affaire || 0}|${r.Template || 0}|${texte(r.Date).slice(0, 10)}`,
  Journal: (r) => `${texte(r.Date)}|${texte(r.Action)}|${texte(r.Table)}|${r.Enregistrement || 0}`,
  Trames: (r) => `${texte(r.Nom).trim()}|${texte(r.Public)}`,
  Types_Trames: (r) => texte(r.Nom).trim(),
  Sanctions: (r) => texte(r.Libelle).trim().toLowerCase(),
  Motifs: (r) => texte(r.Libelle).trim().toLowerCase(),
  Parametres: (r) => texte(r.Cle).trim(),
  // Tables à ligne unique : une présentation, une identité d'outil.
  Presentation: () => "presentation",
  Identite: () => "identite",
};

function nouvelId(rows) {
  return rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
}

/**
 * Écrit une source convertie dans la base du magasin.
 *
 * `mode` vaut `completer` (par défaut) ou `remplacer`. Les références sont
 * résolues après insertion ; une référence introuvable laisse la colonne vide
 * et produit un avertissement, plutôt que d'empêcher tout l'import.
 */
export function appliquerImport(store, source, { mode = "completer" } = {}) {
  const { tables, avertissements } = convertir(source);
  const resultat = {
    mode,
    creees: {},
    rapprochees: {},
    avertissements: [...avertissements],
    referencesNonResolues: 0,
    referencesManquantes: [],
    journal: null,
  };

  const db = mode === "remplacer"
    ? Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, []]))
    : Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, (store.db[t] || []).map((r) => ({ ...r }))]));

  // Table de correspondance : « Table:identifiant source » → identifiant écrit.
  const idOf = new Map();
  let tableCourante = "";
  let colonneCourante = "";

  /* Lignes réellement écrites, dans l'ordre où elles l'ont été. En mode Grist,
     ce sont elles — et elles seules — qui partent vers le document : un
     réimport ne réécrit donc rien, et les lignes déjà présentes gardent leur
     identité dans le document (voir `appliquerDansLeDocument`). */
  const ecrites = [];

  const resoudre = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "object" && value.__ref !== undefined) {
      if (value.src === 0 || value.src === "" || value.src === null || value.src === undefined) return 0;
      const key = `${value.__ref}:${value.src}`;
      if (idOf.has(key)) return idOf.get(key);
      resultat.referencesNonResolues += 1;
      resultat.referencesManquantes.push(`${tableCourante}.${colonneCourante} → ${value.__ref} n°${value.src}`);
      return 0;
    }
    // Un objet sans marqueur de référence n'a rien à faire dans une colonne :
    // mieux vaut la laisser vide que d'y écrire une ligne entière.
    if (typeof value === "object") return 0;
    return value;
  };

  for (const table of ORDRE_IMPORT) {
    const lignes = tables[table];
    if (!lignes || !lignes.length) continue;
    const def = SCHEMA[table];
    const cible = db[table];
    for (const ligne of lignes) {
      const row = {};
      tableCourante = table;
      for (const c of def.columns) {
        if (c.formula || !(c.id in ligne)) continue;
        colonneCourante = c.id;
        const v = ligne[c.id];
        if (Array.isArray(v)) row[c.id] = v.map(resoudre);
        else if (c.type?.startsWith("Ref:")) row[c.id] = resoudre(v);
        else if (c.type?.startsWith("RefList:")) row[c.id] = idsDeListe(resoudre(v));
        else row[c.id] = v;
      }
      const cle = CLES[table] ? CLES[table](row) : null;
      const existante = cle ? cible.find((r) => CLES[table](r) === cle) : null;
      if (existante) {
        Object.assign(existante, row);
        idOf.set(`${table}:${ligne.__src}`, existante.id);
        ecrites.push({ table, kind: "maj", id: existante.id, patch: row });
        resultat.rapprochees[table] = (resultat.rapprochees[table] || 0) + 1;
      } else {
        const next = { id: nouvelId(cible), ...row };
        cible.push(next);
        idOf.set(`${table}:${ligne.__src}`, next.id);
        ecrites.push({ table, kind: "creee", id: next.id, data: next });
        resultat.creees[table] = (resultat.creees[table] || 0) + 1;
      }
    }
  }

  if (store.mode === "grist") appliquerDansLeDocument(store, ecrites, mode);
  else store.replaceAll(db);
  return resultat;
}

/* ------------------------------------------------------------------ */
/* Écriture dans le document Grist                                     */
/* ------------------------------------------------------------------ */

/**
 * Applique la source au **document Grist**, ligne par ligne, en passant par le
 * magasin — donc par l'API widget du document (voir `grist-backend.js`).
 *
 * L'écriture en bloc (`store.replaceAll`) ne convient pas ici : en mode Grist,
 * la base locale n'est qu'une copie de travail du document, et la remplacer
 * localement ne change rien au document — au rechargement, tout reviendrait à
 * l'état d'avant. Seules sont donc envoyées les lignes **créées** et les lignes
 * **complétées** : un réimport ne réécrit rien, et les lignes déjà présentes
 * gardent leur identité (leurs liens, leur historique) dans le document.
 *
 * Les références sont réécrites au passage : la conversion numérote les lignes
 * pour elle-même, le magasin en attribue d'autres (négatives tant que Grist n'a
 * pas répondu), et une référence doit désigner la ligne du magasin.
 *
 * En mode « remplacer », les lignes de l'outil sont d'abord retirées du
 * document. Les tables d'héritage (`Commissions`) n'y sont jamais touchées.
 */
function appliquerDansLeDocument(store, ecrites, mode) {
  const refs = new Map();
  const chercher = (table, id) => {
    const v = refs.get(`${table}:${id}`);
    return v === undefined ? 0 : v;
  };
  // Les lignes déjà présentes gardent leur identifiant : c'est celui du magasin.
  // (En mode « remplacer » elles sont retirées, et rien ne doit plus y renvoyer.)
  if (mode !== "remplacer") {
    for (const table of Object.keys(SCHEMA)) {
      for (const r of store.table(table)) refs.set(`${table}:${r.id}`, r.id);
    }
  }

  store.batch(() => {
    if (mode === "remplacer") {
      for (const table of ORDRE_IMPORT) {
        if (SCHEMA[table]?.legacy) continue;
        for (const r of [...store.table(table)]) store.deleteRow(table, r.id);
      }
    }
    for (const item of ecrites) {
      if (item.kind === "creee") {
        const row = store.addRow(item.table, traduireRefs(item.table, item.data, chercher));
        if (row) refs.set(`${item.table}:${item.id}`, row.id);
      } else {
        store.updateRow(item.table, item.id, traduireRefs(item.table, item.patch, chercher));
      }
    }
  });
}

/** Ramène les références d'une ligne convertie aux identifiants du magasin. */
function traduireRefs(table, ligne, chercher) {
  const def = SCHEMA[table];
  const out = {};
  for (const c of def.columns) {
    if (c.formula || c.id === "id" || !(c.id in ligne)) continue;
    const m = /^Ref(List)?:([A-Za-z_]+)$/.exec(c.type || "");
    if (!m) {
      out[c.id] = ligne[c.id];
      continue;
    }
    const v = ligne[c.id];
    if (m[1]) {
      const liste = Array.isArray(v) ? v : idsDeListe(v);
      out[c.id] = liste.map((x) => chercher(m[2], x)).filter(Boolean);
    } else {
      out[c.id] = typeof v === "number" ? chercher(m[2], v) : 0;
    }
  }
  return out;
}

/** Résumé lisible d'une application d'import. */
export function resumeImport(resultat) {
  const lignes = Object.entries(resultat.creees)
    .map(([t, n]) => `${SCHEMA[t]?.label || t} : ${n}`)
    .join(", ");
  const rapp = Object.entries(resultat.rapprochees).reduce((n, [, v]) => n + v, 0);
  const creees = Object.values(resultat.creees).reduce((n, v) => n + v, 0);
  return { creees, rapprochees: rapp, lignes };
}
