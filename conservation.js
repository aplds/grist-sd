// Conservation et archivage des dossiers disciplinaires (NC-0017).
//
// Un dossier disciplinaire a une durée de vie. Elle n'était nulle part : la
// table `Parametres` ne portait aucune durée de conservation, aucune règle de
// sort final, aucun état d'archivage, et rien ne disait quand un dossier
// pouvait être versé ou éliminé. Ce module rassemble ce qui s'en déduit :
//
//  - `conservationDe` — la durée (réglée dans `Parametres`), la date de départ
//    (la décision définitive, à défaut la saisine), l'échéance, le sort final et
//    l'état d'archivage d'un dossier ;
//  - `piecesDuDossier` — les pièces d'une affaire (décisions et documents),
//    chacune marquée « à conserver » ou non selon le sort final ;
//  - `lignesVersement` — l'état des pièces, ligne à ligne, pour un versement au
//    service d'archives.
//
// Aucune valeur n'est inventée : la durée et le sort final sont des réglages
// (avec leur valeur par défaut, qui n'est qu'une **proposition** à arrêter avec
// le service d'archives et le délégué à la protection des données). Rien ici
// n'écrit : les écrans lisent, l'action « numéroter » et l'export agissent.

import { SCHEMA } from "./schema.js";
import { Context, aujourdHui, isoDate, parametre, toDate } from "./formulas.js";
import { seuil } from "./regimes.js";

/** Ajoute `n` années à une date ISO, en gérant le 29 février. */
export function ajouterAnnees(iso, n) {
  const d = toDate(iso);
  if (!d) return null;
  const out = new Date(d);
  const jour = out.getDate();
  out.setDate(1);
  out.setFullYear(out.getFullYear() + Number(n || 0));
  const dernier = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(jour, dernier));
  return isoDate(out);
}

/**
 * Date à partir de laquelle la conservation court : la date du délibéré de la
 * décision définitive, à défaut sa notification, à défaut la saisine de la
 * section. C'est l'acte qui clôt le dossier qui fait courir le délai.
 */
export function dateDepartConservation(affaire, decision) {
  const candidats = [
    decision && decision.Date_du_delibere,
    decision && decision.Date_de_notification,
    decision && decision.Date_d_effet,
    affaire && affaire.Date_de_saisine,
  ];
  for (const candidat of candidats) {
    const iso = isoDate(candidat);
    if (iso) return iso;
  }
  return null;
}

/**
 * Situation de conservation d'une affaire : durée réglée, sort final, date de
 * départ, échéance et état d'archivage.
 *
 * `echu` est vrai lorsque l'échéance est atteinte : le dossier est alors bon
 * pour le versement (ou l'élimination), et la fiche le signale.
 */
export function conservationDe(db, affaire, decision) {
  const annees = seuil(db, "conservation_annees");
  const sortFinal = String(parametre(db, "sort_final", "Versement") || "Versement");
  const depart = dateDepartConservation(affaire, decision);
  const echeance = depart && annees ? ajouterAnnees(depart, annees) : null;
  const etat = String(affaire?.Etat_archivage || "En cours");
  const jour = aujourdHui();
  return {
    annees,
    sortFinal,
    depart,
    echeance,
    etat,
    echu: !!(echeance && jour && echeance <= jour),
    departConnu: !!depart,
  };
}

/** Une pièce est-elle à conserver, au vu du sort final du dossier ? */
export function pieceAConserver(sortFinal) {
  return String(sortFinal || "Versement") !== "Élimination";
}

/** Libellé lisible d'une date ISO, ou chaîne vide. */
function dateFr(iso) {
  const d = toDate(iso);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Pièces d'une affaire : ses décisions et ses documents, dans l'ordre
 * chronologique, chacune avec sa nature, sa date et sa mention « à conserver ».
 */
export function piecesDuDossier(store, affaire, sortFinal = "Versement") {
  const id = Number(affaire?.id);
  const conserver = pieceAConserver(sortFinal);
  const pieces = [];
  // Le libellé d'une décision est une colonne **calculée** : il se lit par le
  // moteur de formules (`vOuBrut`), un accès direct au champ d'une ligne brute
  // le rendant vide (le texte retenu reste lu en second).
  const ctx = new Context(store.db, store);
  const enfants = (table, filtre) => (store.table(table) || [])
    .filter(filtre)
    .sort((a, b) => String(a.Date_du_delibere || a.Date || "").localeCompare(String(b.Date_du_delibere || b.Date || "")));
  for (const d of enfants("Decisions", (r) => Number(r.Affaire) === id)) {
    pieces.push({
      table: "Decisions",
      id: d.id,
      nature: d.Nature || "Décision",
      libelle: ctx.vOuBrut("Decisions", d, "Libelle_decision") || d.Decision || "",
      date: d.Date_du_delibere || d.Date_de_notification || null,
      numero: d.Numero_acte || "",
      aConserver: conserver,
    });
  }
  for (const doc of (store.table("Generateur") || []).filter((r) => Number(r.Affaire) === id)) {
    // Une pièce produite s'annonce par le **nom de sa trame** : la table
    // `Generateur` ne porte ni `Nom` ni `Titre`, la liste des pièces d'un
    // dossier versement n'y montrait donc que « #25 ».
    const trame = ctx.byId("Trames", doc.Template);
    pieces.push({
      table: "Generateur",
      id: doc.id,
      nature: SCHEMA.Generateur?.label || "Document",
      libelle: String(ctx.vOuBrut("Trames", trame, "Nom") || doc.Nom || doc.Titre || `#${doc.id}`),
      date: doc.Date || null,
      numero: "",
      aConserver: conserver,
    });
  }
  return pieces;
}

/**
 * État des pièces pour versement : une ligne par affaire, avec sa décision, son
 * échéance de conservation, son sort final, son état d'archivage et le nombre
 * de pièces à conserver. C'est le document que demande un service d'archives.
 */
export function lignesVersement(store, affaires) {
  const ctxSections = new Map((store.table("Sections_disciplinaires") || []).map((s) => [Number(s.id), s]));
  const ctx = new Context(store.db, store);
  return affaires.map((a) => {
    const decision = (store.table("Decisions") || [])
      .find((d) => Number(d.Affaire) === Number(a.id) && String(d.Nature) !== "interlocutoire"
        && !(String(d.Nature) || "").startsWith("Avant dire droit"));
    const conservation = conservationDe(store.db, a, decision);
    const pieces = piecesDuDossier(store, a, conservation.sortFinal);
    const section = ctxSections.get(Number(a.Section));
    return {
      Numero: a.Numero || "",
      Section: section ? (section.Intitule_de_la_section || section.Structure || "") : "",
      "Mis en cause": String(ctx.vOuBrut("Affaires", a, "Nom_complet")
        || ctx.vOuBrut("Affaires", a, "Nom_du_mis_en_cause") || ""),
      "Décision": decision ? String(ctx.vOuBrut("Decisions", decision, "Libelle_decision") || decision.Decision || "") : "",
      "N° d'acte": decision ? (decision.Numero_acte || "") : "",
      "Date de départ": dateFr(conservation.depart),
      "Échéance de conservation": dateFr(conservation.echeance),
      "Sort final": conservation.sortFinal,
      "État d'archivage": conservation.etat,
      "Dossier échu": conservation.echu ? "oui" : "non",
      "Pièces du dossier": pieces.length,
      "Pièces à conserver": pieces.filter((p) => p.aConserver).length,
      "Pièces à conserver (détail)": pieces
        .map((p) => `${p.nature}${p.numero ? ` n° ${p.numero}` : ""}${p.date ? ` du ${dateFr(p.date)}` : ""}`)
        .join(" ; "),
    };
  });
}

/** En-têtes de l'état des pièces pour versement, dans l'ordre des colonnes. */
export const COLONNES_VERSEMENT = [
  "Numero", "Section", "Mis en cause", "Décision", "N° d'acte", "Date de départ",
  "Échéance de conservation", "Sort final", "État d'archivage", "Dossier échu",
  "Pièces du dossier", "Pièces à conserver", "Pièces à conserver (détail)",
];
