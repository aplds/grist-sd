// Export des tables en CSV et en classeur Excel (.xlsx).
//
// L'outil conserve des dossiers ; il doit aussi pouvoir en sortir les données
// pour les confier à un tableur : un inventaire à vérifier, une statistique à
// faire, une pièce à transmettre, une sauvegarde lisible par quelqu'un qui n'a
// pas l'outil. Deux formats suffisent à cela :
//
//   - **CSV** : un fichier par table, séparé par des points-virgules et
//     précédé de la marque d'ordre des octets (BOM) — le format qu'ouvre
//     directement un tableur configuré en français ;
//   - **Excel (.xlsx)** : un classeur, une feuille par table, écrit avec
//     SheetJS chargé à la demande (la même bibliothèque que l'import, voir
//     `import-fichiers.js`). L'en-tête est figé par un filtre automatique et
//     les colonnes sont dimensionnées : le fichier s'ouvre prêt à lire.
//
// Les colonnes exportées sont celles du registre affiché, et non les colonnes
// brutes : une référence donne le nom de la personne ou de la section qu'elle
// désigne, une colonne calculée donne sa valeur — un tableur ne saurait rien
// faire d'un identifiant. Les listes de colonnes sont donc écrites ici, table
// par table (voir `COLONNES_EXPORT`) ; une table sans liste est exportée avec
// toutes ses colonnes, ce qui est le cas des tables de service.
//
// L'export suit ce que la personne voit : les vues passent les lignes
// affichées, dans leur ordre d'affichage, et le fichier part de ces lignes-là.
// Le périmètre de visibilité, les filtres et le tri sont donc respectés sans
// que ce module ait à les connaître — et l'export ne peut rien livrer de plus
// que l'écran.

import { SCHEMA } from "./schema.js";
import { displayValue } from "./ui.js";
import { aujourdHui } from "./formulas.js";
import { fileSlug } from "./export-doc.js";
import { zipStore } from "./export.js";
import { SHEETJS_MODULE } from "./import-fichiers.js";

/* ------------------------------------------------------------------ */
/* Colonnes exportées                                                  */
/* ------------------------------------------------------------------ */

/**
 * Colonnes de chaque table dans un export de registre, dans l'ordre où elles
 * se lisent. Les colonnes d'identité technique (identifiants de liaison) et
 * les champs de texte long — le corps d'une trame, le contenu d'un document —
 * en sont écartés : un tableur s'encombre de ces valeurs, alors que l'export
 * complet de la base (Réglages › Données) les emporte, lui, sans exception.
 */
export const COLONNES_EXPORT = {
  Affaires: [
    "Numero", "Etat", "Section", "Section_Public", "Mis_en_cause", "INE", "Corps",
    "Date_de_saisine", "Date_des_faits", "Date_de_connaissance_des_faits",
    "Prescription_le", "Prescrit", "Voie", "Motifs", "Autorite_de_saisine", "Secretaire",
    "Date_de_convocation", "Mode_de_convocation",
    "Seance_d_examen", "SE_Date", "SE_Heure_de_passage", "Composante", "Duree_instruction",
  ],
  Decisions: [
    "Affaire", "Nature", "Sanction", "Libelle_decision", "Decision", "Motivation",
    "Date_du_delibere", "Date_de_notification", "Mode_de_notification",
    "Date_de_l_accuse_reception", "Duree_totale_d_exclusion_mois_", "Duree_d_exclusion_sursis_",
    "Sursis_", "Terme_de_la_sanction", "Recours_limite_le", "En_cours_", "Delai_de_traitement",
  ],
  Seances_d_examen: ["Identifiant", "Type", "Date", "Section", "Salle", "Adresse", "Lien_visio", "Affaires_du_role"],
  Sections_disciplinaires: [
    "Structure", "Structure_Nom_Complet", "Acronyme", "Public", "Tutelle", "Type_de_section",
    "Siege", "Email_de_contact", "Secretariat_Rue", "Secretariat_CP_Ville",
    "Intitule_de_la_section", "President", "Voie_de_recours",
  ],
  Membres: [
    "Prenom", "NOM", "Genre", "College", "Email", "Role", "Section",
    "Mandat_debut", "Mandat_fin", "En_fonction",
  ],
  Secretaires: ["Prenom", "Nom", "Genre", "Email", "Section", "Actif_", "Nom_complet"],
  Destinataires_institutionnels: ["Nom_complet", "Qualite", "Formule_de_politesse", "Signature", "Adresse", "Section"],
  Personnes: [
    "Type", "Prenom", "Nom", "Genre", "Date_de_naissance", "Email", "Telephone", "Adresse",
    "INE", "Formation_suivie", "Composante", "Corps", "Section_CNU", "Etablissement",
    "Qualite", "Organisme", "Notes",
  ],
  Intervenants: [
    "Affaire", "Role", "Qualite", "Nom_complet", "Email", "College", "Statut",
    "Date_de_designation", "Est_present", "Observations",
  ],
  Implications: ["Affaire", "Personne", "Role", "Informe_le", "Auditionne_le", "Observations"],
  Jonctions: [
    "Libelle", "Affaire_de_tete", "Affaires_jointes", "Nb_affaires",
    "Personnes_mises_en_cause", "Date_de_la_jonction", "Motif", "Observations",
  ],
  Recours: ["Affaire", "Decision", "Juridiction", "Type_de_recours", "Date_d_introduction", "Issue", "En_cours_", "Observations"],
  Generateur: [
    "Template", "Affaire", "Date", "Statut", "Envoye_le", "Mode_d_envoi",
    "Destinataire_institutionnel", "Emetteur", "Type", "Affaire_Date_de_saisine",
  ],
  Trames: [
    "Nom", "Type_court_", "Type", "Objet", "Public", "Tutelle", "Type_de_section",
    "Decision_definitive", "Nom_complet",
  ],
  Types_Trames: [
    "Nom", "Categorie", "Organe", "Numeroter_pages", "Numero_affaire_pied",
    "Marianne_position", "Marianne_largeur", "Marianne_hauteur",
    "Logo_position", "Logo_largeur", "Logo_hauteur",
    "Feuille_de_style",
  ],
  Sanctions: ["Libelle", "Groupe", "Public", "Tutelle", "Duree_max_mois", "Sursis_possible", "Texte_de_reference"],
  Motifs: ["Libelle", "Groupe", "Public", "Tutelle", "Texte_de_reference", "Description"],
  Parametres: ["Nom", "Cle", "Categorie", "Valeur", "Description"],
  Journal: ["Date", "Action", "Table_libelle", "Enregistrement", "Auteur", "Resume"],
};

/** Définition d'une colonne, à défaut une colonne de texte portant son nom. */
function colonneDe(table, id) {
  return (SCHEMA[table]?.columns || []).find((c) => c.id === id) || { id, label: id, type: "Text" };
}

/** Colonnes retenues pour une table : la liste passée, la liste écrite ici, ou toutes. */
export function colonnesDeTable(table, colonnes = null) {
  if (colonnes && colonnes.length) return colonnes;
  if (COLONNES_EXPORT[table]) return COLONNES_EXPORT[table];
  return (SCHEMA[table]?.columns || []).map((c) => c.id);
}

/* ------------------------------------------------------------------ */
/* Valeurs                                                             */
/* ------------------------------------------------------------------ */

/**
 * Valeur lisible d'une cellule.
 *
 * Une référence ne s'exporte pas sous forme d'identifiant : elle donne le
 * libellé de l'enregistrement qu'elle désigne (le nom de la personne mise en
 * cause, l'intitulé de la section, le numéro et le nom de l'affaire), comme le
 * fait la liste déroulante qui la saisit. Une liste de références donne leurs
 * libellés, séparés par des points-virgules.
 */
export function valeurCellule(ctx, table, row, colId) {
  const def = colonneDe(table, colId);
  const type = String(def.type || "Text");
  if (type.startsWith("RefList:")) {
    const cible = type.slice("RefList:".length);
    return ctx.refList(table, row, colId)
      .map((r) => displayValue(cible, ctx, r))
      .filter(Boolean)
      .join(" ; ");
  }
  if (type.startsWith("Ref:")) {
    const cible = type.slice("Ref:".length);
    const rec = ctx.ref(table, row, colId);
    return rec ? displayValue(cible, ctx, rec) : "";
  }
  const v = ctx.v(table, row, colId);
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(" ; ");
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
}

/**
 * Valeur telle qu'elle doit entrer dans un classeur : un nombre reste un
 * nombre, pour que le tableur puisse le sommer. Les colonnes de date donnent
 * leur écriture ISO (`AAAA-MM-JJ`) — c'est la seule qui se trie et se convertit
 * sans ambiguïté d'un tableur à l'autre.
 */
function valeurTypee(ctx, table, row, colId) {
  const texte = valeurCellule(ctx, table, row, colId);
  const type = String(colonneDe(table, colId).type || "Text");
  if ((type === "Int" || type === "Numeric") && texte !== "") {
    const n = Number(texte.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return texte;
}

/**
 * Table des lignes à exporter : les en-têtes, puis les valeurs.
 * @returns {{entetes: string[], lignes: Array<Array<string|number>>}}
 */
export function tableauExport(ctx, { table, rows, colonnes = null }) {
  const cols = colonnesDeTable(table, colonnes);
  const entetes = cols.map((id) => colonneDe(table, id).label);
  const lignes = rows.map((row) => cols.map((id) => valeurTypee(ctx, table, row, id)));
  return { entetes, lignes };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Neutralise une valeur qui serait lue comme une **formule** par un tableur
 * (NC-0007) : une valeur commençant par `=`, `+`, `-`, `@`, une tabulation ou
 * un retour chariot est préfixée d'une apostrophe, qui la fait lire comme du
 * texte. Les nombres, eux, ne sont jamais touchés — un nombre négatif reste un
 * nombre.
 */
export function neutraliserFormule(value) {
  if (typeof value === "number") return value;
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Un champ n'est mis entre guillemets que s'il en a besoin. */
export function champCsv(value) {
  const s = typeof value === "number" ? String(value) : neutraliserFormule(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Contenu CSV d'une feuille : BOM, séparateur point-virgule, fins de ligne CRLF. */
export function csvDeTableau({ entetes, lignes }) {
  const corps = [entetes, ...lignes].map((l) => l.map(champCsv).join(";"));
  return `\uFEFF${corps.join("\r\n")}\r\n`;
}

/* ------------------------------------------------------------------ */
/* Classeur Excel                                                      */
/* ------------------------------------------------------------------ */

let sheetjs = null;

/** SheetJS, téléchargé à la première demande (comme pour l'import). */
async function chargerSheetJS() {
  if (!sheetjs) {
    try {
      sheetjs = await import(SHEETJS_MODULE);
    } catch (err) {
      throw new Error("La bibliothèque Excel n'a pas pu être chargée : vérifiez la connexion, "
        + "ou exportez au format CSV.");
    }
  }
  return sheetjs;
}

/** Lettre de colonne d'un tableur : 1 → A, 27 → AA. */
function lettreColonne(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Feuille de calcul : valeurs, largeur des colonnes et filtre sur l'en-tête. */
function feuilleDe(XLSX, { entetes, lignes }) {
  // Les valeurs qui commencent par `=`, `+`, `-` ou `@` sont neutralisées
  // (NC-0007) : sans cela, le tableur les lirait comme des formules.
  const corps = lignes.map((l) => l.map(neutraliserFormule));
  const ws = XLSX.utils.aoa_to_sheet([entetes, ...corps]);
  const largeurs = entetes.map((entete, i) => {
    let max = String(entete).length;
    for (const ligne of corps) max = Math.max(max, String(ligne[i] ?? "").length);
    return { wch: Math.min(60, Math.max(9, max + 2)) };
  });
  ws["!cols"] = largeurs;
  // Filtre automatique sur la ligne d'en-tête : chaque colonne se trie et se
  // filtre sans réglage préalable.
  ws["!autofilter"] = { ref: `A1:${lettreColonne(entetes.length)}${lignes.length + 1}` };
  return ws;
}

/**
 * Nom d'une feuille : au plus 31 caractères, sans les caractères que le format
 * interdit, et jamais deux fois le même dans un classeur.
 */
function nomFeuille(label, utilises) {
  let base = String(label).replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Feuille";
  let nom = base;
  let n = 2;
  while (utilises.has(nom.toLowerCase())) {
    const suffixe = ` (${n})`;
    nom = base.slice(0, 31 - suffixe.length) + suffixe;
    n += 1;
  }
  utilises.add(nom.toLowerCase());
  return nom;
}

/**
 * Assemble un classeur Excel, une feuille par entrée.
 * @param {Array<{nom: string, entetes: string[], lignes: Array<Array<string|number>>}>} feuilles
 */
export async function classeurXlsx(feuilles) {
  const XLSX = await chargerSheetJS();
  const classeur = XLSX.utils.book_new();
  const utilises = new Set();
  for (const f of feuilles) {
    XLSX.utils.book_append_sheet(classeur, feuilleDe(XLSX, f), nomFeuille(f.nom, utilises));
  }
  const data = XLSX.write(classeur, { bookType: "xlsx", type: "array" });
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ------------------------------------------------------------------ */
/* Noms de fichiers                                                    */
/* ------------------------------------------------------------------ */

/** `Membres — Université d'Angers` → `membres-universite-d-angers 2026-09-20` */
export function nomFichier(base, extension, date = aujourdHui()) {
  return `${fileSlug(base)} ${date}.${extension}`;
}

/* ------------------------------------------------------------------ */
/* Export d'un tableau                                                 */
/* ------------------------------------------------------------------ */

/**
 * Prépare le fichier d'un tableau : en-têtes et lignes déjà résolues. C'est le
 * point commun de tous les exports de liste — une table du modèle, ou une
 * liste calculée qui n'en vient pas (les échéances du calendrier).
 * @returns {Promise<{blob: Blob, name: string, lignes: number}>}
 */
export async function exportTableauFichier(kind, { tableau, nom }) {
  if (kind === "xlsx") {
    const blob = await classeurXlsx([{ nom, ...tableau }]);
    return { blob, name: nomFichier(nom, "xlsx"), lignes: tableau.lignes.length };
  }
  const csv = csvDeTableau(tableau);
  return {
    blob: new Blob([csv], { type: "text/csv;charset=utf-8" }),
    name: nomFichier(nom, "csv"),
    lignes: tableau.lignes.length,
  };
}

/* ------------------------------------------------------------------ */
/* Export de toute la base                                             */
/* ------------------------------------------------------------------ */

/**
 * Toutes les tables du modèle, dans l'ordre de `SCHEMA`, chacune avec
 * l'intégralité de ses colonnes — c'est un relevé complet, destiné à
 * l'archivage ou à l'exploitation dans un tableur, et non un registre.
 */
function feuillesDeLaBase(ctx, tables = null) {
  const noms = tables || Object.keys(SCHEMA);
  return noms.map((table) => {
    const toutes = (SCHEMA[table]?.columns || []).map((c) => c.id);
    return { table, nom: SCHEMA[table]?.label || table, ...tableauExport(ctx, { table, rows: ctx.table(table), colonnes: toutes }) };
  });
}

/**
 * Export complet de la base.
 * @returns {Promise<{blob: Blob, name: string, tables: number, lignes: number}>}
 */
export async function exportBaseFichier(kind, { ctx, nom = "Sections disciplinaires — données", tables = null }) {
  const feuilles = feuillesDeLaBase(ctx, tables);
  const lignes = feuilles.reduce((n, f) => n + f.lignes.length, 0);
  if (kind === "xlsx") {
    const blob = await classeurXlsx(feuilles);
    return { blob, name: nomFichier(nom, "xlsx"), tables: feuilles.length, lignes };
  }
  // Un fichier délimité ne porte qu'une table : le CSV complet est donc une
  // archive, un fichier par table, que l'outil assemble lui-même.
  const encoder = new TextEncoder();
  const entrees = feuilles.map((f) => ({
    name: `${fileSlug(f.nom)}.csv`,
    data: encoder.encode(csvDeTableau(f)),
  }));
  return { blob: zipStore(entrees), name: nomFichier(nom, "zip"), tables: feuilles.length, lignes };
}
