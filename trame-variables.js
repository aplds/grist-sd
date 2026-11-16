// Catalogue des variables utilisables dans une trame.
//
// Chaque entrée est une balise prête à glisser dans le corps du document :
// `{{Colonne}}`, `{{Colonne}}.Champ`, etc. Les valeurs d'exemple sont
// calculées sur la même affaire que l'aperçu, afin que l'éditeur puisse
// afficher ce que la balise produira réellement (mode « valeurs »).
//
// La liste reproduit le dictionnaire de la vue « Mes trames » du document
// Grist d'origine, complétée par les colonnes calculées de chaque table.

import { BALISE_CORPS, SCHEMA } from "./schema.js";
import { documentScope, renderTemplate } from "./render.js";

/* ------------------------------------------------------------------ */
/* Groupes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Libellé de l'emplacement du texte de la trame dans une feuille de style.
 * La pastille n'a pas de valeur d'exemple : c'est l'emplacement lui-même que
 * l'auteur doit reconnaître dans le document.
 */
export const LIBELLE_CORPS = "Texte de la trame";

/** Champs saisis dans le document (table Generateur) hors références. */
const DOCUMENT = [
  { token: "{{Champ_libre}}", label: "Champ libre" },
  { token: "{{Date}}", label: "Date du document" },
  { token: "{{Date}}.date(@long)", label: "Date du document — date longue" },
  { token: "{{Date_libre}}", label: "Date libre" },
  { token: "{{Date_libre}}.date(@long)", label: "Date libre — date longue" },
  { token: "{{L_Destinataire}}", label: "Destinataire libre — nom" },
  { token: "{{L_Adresse}}", label: "Destinataire libre — adresse" },
  { token: "{{L_Formule}}", label: "Destinataire libre — formule de politesse" },
];

/**
 * Champ calculé isolé du document (colonne de la table Generateur mise à
 * part dans la trame d'origine), rattaché au groupe « Séance ».
 */
const SEANCE_SCALARS = [
  { token: "{{Seance_d_examen_Date}}", label: "Séance — date" },
  { token: "{{Seance_d_examen_Date}}.date(@long)", label: "Séance — date longue" },
  { token: "{{Affaire_Heure_de_passage}}", label: "Séance — heure de passage" },
];

/** Tables atteignables depuis une trame, et préfixe de leurs balises. */
const TABLES = [
  { token: "Affaire", table: "Affaires", label: "Affaire", icon: "folder-2-line" },
  { token: "Decision", table: "Decisions", label: "Décision de l'affaire", icon: "scales-3-line" },
  { token: "Affaire_Section", table: "Sections_disciplinaires", label: "Section disciplinaire", icon: "school-line" },
  { token: "Seance_d_examen", table: "Seances_d_examen", label: "Séance d'examen", icon: "calendar-line" },
  { token: "Secretaire", table: "Secretaires", label: "Secrétaire", icon: "user-star-line" },
  { token: "Destinataire_institutionnel", table: "Destinataires_institutionnels", label: "Destinataire institutionnel", icon: "mail-line" },
  { token: "Emetteur", table: "Destinataires_institutionnels", label: "Émetteur", icon: "send-plane-line" },
  { token: "Template", table: "Trames", label: "Trame", icon: "file-text-line" },
];

/** Colonnes de la table Generateur déjà proposées ailleurs. */
const DOCUMENT_COLUMNS = new Set(["Date", "Date_libre", "Champ_libre", "L_Destinataire", "L_Adresse", "L_Formule", "Affaire", "Template"]);

/**
 * L'identifiant du groupe de la palette qui réunit les balises de la
 * **décision** (`{{Decision}}…`). Un document qui n'en rédige aucune — une
 * **ordonnance**, l'acte d'un président, qui règle la marche de l'instance sans
 * trancher le fond — ne les propose pas : elles liraient la décision d'une
 * autre, ou celle qui tranche le fond, et feraient d'un acte préparatoire une
 * décision (voir `views/documents.js`).
 */
export const GROUPE_DECISION = "Decision";

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

/**
 * Catalogue complet pour une trame donnée.
 *
 * `db`  : base complète (calcul des valeurs d'exemple) ;
 * `doc` : document d'exemple, produit par la vue Réglages › Trames.
 *
 * Renvoie `{ groups, index }` : `groups` alimente la palette, `index` associe
 * à chaque balise son libellé et sa valeur d'exemple (pour les pastilles).
 */
export function trameCatalog(db, doc) {
  const scope = doc ? documentScope(db, doc).scope : {};
  const value = (token) => {
    try {
      return String(renderTemplate(token, scope));
    } catch {
      return "";
    }
  };

  const index = {};
  const add = (token, label, withSample = true) => {
    index[token] = { token, label, sample: withSample ? value(token) : "" };
    return index[token];
  };

  const groups = [];

  groups.push({
    id: "document",
    label: "Document",
    icon: "printer-line",
    hint: "Champs complétés au moment de générer le courrier.",
    entries: DOCUMENT.map((e) => add(e.token, e.label)),
  });

  groups.push({
    id: "seance-scalars",
    label: "Séance d'examen",
    icon: "calendar-line",
    entries: SEANCE_SCALARS.map((e) => add(e.token, e.label)),
  });

  for (const { token, table, label, icon } of TABLES) {
    const def = SCHEMA[table];
    if (!def) continue;
    const entries = [];
    for (const column of def.columns) {
      // Une colonne **obsolète** (`ancien: true`) n'est plus proposée à
      // l'insertion : le rapport d'instruction, par exemple, est désormais une
      // pièce à part entière, produite comme un document — sa balise
      // n'alimenterait qu'un champ d'autrefois. La colonne reste lue pour les
      // pièces antérieures (voir `views/affaires.js`), mais on n'y renvoie pas.
      if (column.ancien) continue;
      if (table === "Generateur" && DOCUMENT_COLUMNS.has(column.id)) continue;
      const base = `{{${token}}}.${column.id}`;
      entries.push(add(base, column.label));
      if (column.type === "Date") {
        entries.push(add(`${base}.date(@long)`, `${column.label} — date longue`));
        entries.push(add(`${base}.date(@short)`, `${column.label} — date courte`));
      }
      if (column.type.startsWith("RefList:")) {
        entries.push(add(`${base}.inline`, `${column.label} — liste en ligne`));
      }
    }
    groups.push({ id: token, label, icon, entries });
  }

  return { groups, index };
}

/**
 * Libellé d'une balise inconnue du catalogue (saisie à la main) : le nom de
 * la colonne quand il est reconnaissable, sinon la balise elle-même.
 */
export function labelOfToken(token) {
  if (String(token) === BALISE_CORPS) return LIBELLE_CORPS;
  if (SINGLE.test(String(token))) return labelOfVariable(token);
  const m = /^\{\{([A-Za-z0-9_]+)\}\}\.([A-Za-z0-9_]+)/.exec(token);
  if (!m) return token;
  const [, base, field] = m;
  const group = TABLES.find((t) => t.token === base);
  const column = group && SCHEMA[group.table]?.columns.find((c) => c.id === field);
  if (column) return column.label;
  return field;
}

/* ------------------------------------------------------------------ */
/* Variables {…} des en-têtes, signatures et pieds de page             */
/* ------------------------------------------------------------------ */

const SINGLE = /^\{([A-Za-z0-9_]+)\}$/;

/**
 * Libellés français des variables `{…}`. Les noms sont ceux du périmètre
 * produit par `documentScope()` (voir render.js) : c'est la seule liste qui
 * compte, puisque le rendu remplace ces variables telles quelles.
 */
const LIBELLES_VARIABLES = {
  ville: "Ville (siège de la section)",
  date_formatee: "Date du jour (format long)",
  nature_section: "Nature de la section (public, en majuscules)",
  nature_section_upper: "Nature de la section (variante majuscules)",
  structure_nom_complet: "Nom complet de la structure",
  section_president: "Président de la section",
  section_president_formule: "Président de la section — formule",
  mail_sd: "Courriel du secrétariat",
  sec_rue: "Secrétariat — rue",
  sec_ville: "Secrétariat — code postal et ville",
  numero: "Numéro de l'affaire",
  acte_type: "Type d'acte (type court de la trame)",
  f_ouverture: "Formule d'ouverture de l'acte (l'auteur)",
  date_de_saisine: "Date de saisine de l'affaire (format long)",
  visa_code_rural: "Visa du code rural (selon la tutelle)",
  mec_nom: "Mis en cause — nom complet",
  mec_adresse: "Mis en cause — adresse",
  mec_formule: "Mis en cause — formule",
  commission_president: "Président de la commission",
  c_president: "Président de la commission",
  c_president_formule: "Président de la commission — formule",
  rapporteur: "Rapporteur",
  secretaire: "Secrétaire",
  secretaire_formule: "Secrétaire — formule",
  destinataire: "Destinataire — nom (programmé sur la trame)",
  adresse: "Destinataire — adresse",
  formule_destinataire: "Destinataire — formule de politesse",
  destinataire_qualite: "Destinataire — qualité (rôle visé par la trame)",
  destinataire_libre: "Destinataire libre — nom",
  adresse_libre: "Destinataire libre — adresse",
  formule_destinataire_libre: "Destinataire libre — formule",
  emetteur: "Émetteur — nom (auteur de la trame)",
  nom_emetteur: "Émetteur — nom",
  f_emetteur: "Émetteur — formule de signature",
  emetteur_formule: "Émetteur — formule de signature",
  emetteur_formule_complete: "Émetteur — formule complète",
  emetteur_qualite: "Émetteur — qualité",
  emetteur_adresse: "Émetteur — adresse",
  page: "Numéro de page",
  pages: "Nombre de pages",
};

/** Regroupement de la palette, dans l'ordre d'affichage. */
const GROUPES_VARIABLES = [
  {
    id: "lieu-date",
    label: "Lieu et date",
    icon: "map-pin-2-line",
    names: ["ville", "date_formatee"],
  },
  {
    id: "section",
    label: "Section",
    icon: "school-line",
    names: [
      "nature_section", "nature_section_upper", "structure_nom_complet",
      "section_president", "section_president_formule", "mail_sd", "sec_rue", "sec_ville",
    ],
  },
  {
    id: "affaire",
    label: "Affaire",
    icon: "folder-2-line",
    names: [
      "numero", "acte_type", "mec_nom", "mec_adresse", "mec_formule",
      "commission_president", "c_president", "c_president_formule", "rapporteur",
      "secretaire", "secretaire_formule",
    ],
  },
  {
    id: "destinataire",
    label: "Auteur et destinataire",
    icon: "mail-line",
    names: [
      "emetteur", "nom_emetteur", "f_emetteur", "emetteur_formule_complete", "emetteur_qualite",
      "destinataire", "adresse", "formule_destinataire",
      "destinataire_libre", "adresse_libre", "formule_destinataire_libre",
    ],
  },
  {
    id: "acte-rendu",
    label: "Acte rendu (visas)",
    icon: "scales-3-line",
    hint: "L'ouverture de l'acte et ses visas. Le visa du code rural ne s'affiche que dans un établissement relevant du ministère chargé de l'agriculture.",
    names: ["f_ouverture", "date_de_saisine", "visa_code_rural"],
  },
  {
    id: "pagination",
    label: "Pied de page et numérotation",
    icon: "list-ordered",
    hint: "Les variables du pied de page répété au bas de chaque page : le numéro de l'affaire, le numéro de page et le nombre de pages. Le numéro de l'affaire se place aussi au bas de chaque page sans rien écrire ici — Réglages › Formats (feuilles de style) › « Pagination et pied de page ».",
    // Le numéro de l'affaire reparâit ici : c'est un pied de page qu'on vient
    // chercher dans ce groupe, et c'est là qu'on l'attend.
    names: ["numero", "page", "pages"],
  },
];

/**
 * Valeur d'exemple des variables que le rendu ne remplit pas lui-même : la
 * pagination les remplace sur chaque feuille (voir pages.js), et le visa du
 * code rural n'est renseigné que pour un établissement agricole — sa pastille
 * montrerait sinon un vide que l'auteur prendrait pour une erreur. Elles
 * servent aussi à montrer ce que sa balise produira.
 */
const EXEMPLES_VARIABLES = {
  page: "1",
  pages: "1",
  visa_code_rural: "Vu le code rural et de la pêche maritime ;",
};

/** Libellé français d'une variable `{…}` (ou la variable elle-même). */
export function labelOfVariable(token) {
  const m = SINGLE.exec(String(token ?? ""));
  if (!m) return String(token ?? "");
  return LIBELLES_VARIABLES[m[1]] || m[1];
}

/**
 * Catalogue des variables `{…}` pour la palette des types de trames.
 * `doc` est un document d'exemple : les valeurs calculées servent d'aperçu
 * dans les pastilles, comme pour `trameCatalog`.
 */
export function variablesCatalog(db, doc) {
  const values = (doc && documentScope(db, doc).variables) || {};
  const index = {};
  const entriesOf = (names) => names.map((name) => {
    const token = `{${name}}`;
    const raw = values[name];
    const entry = {
      token,
      label: LIBELLES_VARIABLES[name] || name,
      // `{page}` et `{pages}` ne sont pas des variables du périmètre : c'est la
      // pagination qui les remplit, sur chaque feuille (voir pages.js). Sans
      // valeur d'exemple, leur pastille ne montrerait rien — on y met donc le
      // numéro qu'elles produiront.
      sample: EXEMPLES_VARIABLES[name] !== undefined
        ? EXEMPLES_VARIABLES[name]
        : (raw === null || raw === undefined ? "" : String(raw)),
    };
    index[token] = entry;
    return entry;
  });
  return {
    groups: GROUPES_VARIABLES.map((group) => ({
      id: group.id,
      label: group.label,
      icon: group.icon,
      ...(group.hint ? { hint: group.hint } : {}),
      entries: entriesOf(group.names),
    })),
    index,
  };
}

/**
 * Catalogue d'une **feuille de style** : ses variables `{…}`, et l'emplacement
 * `{{Corps}}` où vient le texte de la trame.
 *
 * C'est la palette de l'espace de rédaction d'un format — et celle de l'espace
 * de rédaction d'une trame, à l'endroit où celle-ci adapte la feuille de style
 * de son format. Le catalogue du corps d'une trame (`trameCatalog`) est, lui,
 * tout autre : il n'y a pas d'emplacement à y désigner.
 */
export function feuilleCatalog(db, doc) {
  const { groups, index } = variablesCatalog(db, doc);
  const emplacement = { token: BALISE_CORPS, label: LIBELLE_CORPS, sample: "" };
  index[BALISE_CORPS] = emplacement;
  return {
    groups: [
      {
        id: "corps",
        label: "Mise en page",
        icon: "layout-line",
        hint: "L'emplacement du texte de la trame. Ce qui le précède est l'en-tête et le chapeau ; ce qui le suit, la signature et le pied de page.",
        entries: [emplacement],
      },
      ...groups,
    ],
    index,
  };
}
