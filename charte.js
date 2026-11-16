// Charte graphique de l'outil et des documents.
//
// L'outil est bâti sur le **Système de design de l'État** (DSFR) : couleurs,
// composants et mise en page. Le DSFR est la charte obligatoire des services de
// l'État, mais toutes les structures ne sont pas tenues de la porter — une
// section disciplinaire d'établissement privé, une structure qui relève d'une
// autre autorité, ou simplement un service qui n'a pas le droit d'afficher la
// marque de l'État.
//
// Deux chartes, donc, réglées dans `Identite` (Réglages › Charte graphique) :
//
//  - **Charte neutre** (par défaut) : la même interface, sans la marque de
//    l'État, en **Public Sans** à la place de Marianne, et avec un **bleu
//    d'action décalé d'un cran** (un bleu encre légèrement acier, à la place de
//    l'ultramarine de l'État). Les composants et la mise en page du DSFR
//    restent : c'est une charte « à la manière du DSFR », et non une autre
//    interface — mais elle ne se confond plus avec celle de l'État.
//  - **Charte de l'État** : le bloc-marque « République Française » et la
//    police **Marianne**.
//
// La charte de l'État doit être **demandée** : c'est la marque de l'État, et
// seul un service qui a le droit de la porter l'affiche. Un document neuf, ou
// qui n'a jamais rien réglé, porte donc la charte neutre — et une structure qui
// relève de l'État n'a qu'un choix à faire pour afficher sa marque.
//
// Les documents (courriers, rôles de séance, listes) suivent la même règle, et
// acceptent en plus une **police personnalisée**, réglée globalement : c'est
// elle qui remplace la police de la charte dans tous les documents produits.
//
// Ce module est la source unique de ces deux réglages : la coquille de l'outil
// (`app.js`, `ui.js`, `styles.css`), les documents rendus (`render.js`), les
// états imprimés (`print.js`) et les exports Word et OpenDocument
// (`export-doc.js`) le lisent tous ici, afin qu'aucun ne puisse montrer une
// marque ou une police que les autres auraient déjà retirée.

/** Les deux valeurs de la colonne `Identite.Charte`. La première est celle que
    propose un réglage neuf — et la charte d'un document dont la colonne est
    vide, c'est-à-dire qui n'a jamais rien réglé. */
export const CHARTE_ETAT = "Charte de l'État";
export const CHARTE_NEUTRE = "Charte neutre";
export const CHARTES = [CHARTE_NEUTRE, CHARTE_ETAT];

/** Polices de la charte : celle de l'État, et celle qui la remplace. */
const POLICE_ETAT = "Marianne";
export const POLICE_NEUTRE = "Public Sans";

/**
 * Piles de polices, telles qu'elles s'écrivent en CSS.
 *
 * Celle de l'État vient du DSFR, qui charge Marianne et prévoit Arial en repli.
 * Celle de la charte neutre est servie depuis nos propres adresses (voir
 * `FACES_NEUTRE`) : rien à installer sur le poste du rédacteur, et un même
 * document s'affiche pareil sous Windows, macOS et Linux — ce que la police de
 * la charte de l'État ne peut pas promettre, puisqu'elle n'est présente que si
 * le DSFR a pu la charger. Le repli suit les polices d'interface de chaque
 * système, puis Arial, présent partout.
 */
const PILE_ETAT = `${POLICE_ETAT}, Arial, sans-serif`;
const PILE_NEUTRE = `"${POLICE_NEUTRE}", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

/** Plages de caractères des deux sous-ensembles servis. */
const PLAGE_LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const PLAGE_LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

/**
 * Les fichiers de la police de la charte neutre : plage de caractères, graisse,
 * style, adresse.
 *
 * Public Sans est une sans-serif humaniste contemporaine, dessinée pour les
 * services publics numériques : neutre, très lisible à l'écran comme sur le
 * papier, et sans aucun rapport avec la police de l'État — ce qui est bien le
 * propos d'une charte neutre. Elle est **libre** (SIL Open Font License) et
 * servie depuis l'hébergement de l'outil, afin qu'aucun document ne dépende
 * d'un service tiers pour s'afficher.
 *
 * Deux sous-ensembles suffisent : « latin » porte le français — accents,
 * ligatures `œ` et `æ` comprises — et « latin-ext » les caractères d'Europe
 * centrale et orientale, que les noms des dossiers amènent souvent. Les
 * fichiers sont ceux de `@fontsource/public-sans` (voir src/README.md).
 */
const FICHIERS_NEUTRE = [
  [PLAGE_LATIN, 400, "normal", "https://user.uploads.dev/file/17a556dcc4bcd50fa6b01a90e9e10cc9.woff2"],
  [PLAGE_LATIN, 500, "normal", "https://user.uploads.dev/file/27976575facc81c020a1ce8de082f01a.woff2"],
  [PLAGE_LATIN, 700, "normal", "https://user.uploads.dev/file/2ee5e696c04c6c2a8d8d514abcc9a327.woff2"],
  [PLAGE_LATIN, 400, "italic", "https://user.uploads.dev/file/e7b0654bfe2399eb8a12ff83cd9b9fb3.woff2"],
  [PLAGE_LATIN, 700, "italic", "https://user.uploads.dev/file/7ec0cd5fbf6ac85535afd7000a0dff9b.woff2"],
  [PLAGE_LATIN_EXT, 400, "normal", "https://user.uploads.dev/file/481cc675a579338af50e475bb4c22b1e.woff2"],
  [PLAGE_LATIN_EXT, 500, "normal", "https://user.uploads.dev/file/c760b7bad07a3cb0659e80cafb22df21.woff2"],
  [PLAGE_LATIN_EXT, 700, "normal", "https://user.uploads.dev/file/c6dfb193b955bf6defe6ac2ce13ab9a6.woff2"],
  [PLAGE_LATIN_EXT, 400, "italic", "https://user.uploads.dev/file/532c02fad14c0c792cfb633f02916dbc.woff2"],
];

/**
 * Les déclarations `@font-face` de la charte neutre, telles qu'elles s'écrivent
 * dans une feuille de style.
 *
 * Elles sont posées par `appliquerCharte` dans la coquille de l'outil, et
 * reprises par `cssPoliceDocument` dans les documents rendus, les états
 * imprimés et les cadres d'export : c'est le même fichier qui sert partout,
 * donc le même dessin. Le navigateur ne télécharge un fichier que si un texte
 * emploie réellement la police (les plages de caractères décident lequel), si
 * bien que la charte de l'État ne charge jamais rien.
 */
const FACES_NEUTRE = FICHIERS_NEUTRE.map(([plage, graisse, style, url]) => `
@font-face {
  font-family: "${POLICE_NEUTRE}";
  font-style: ${style};
  font-weight: ${graisse};
  font-display: swap;
  src: url(${url}) format("woff2");
  unicode-range: ${plage};
}`).join("");

/** `@font-face` de la charte neutre, ou `""` si la pile ne l'emploie pas. */
function facesPour(pile) {
  return pile.includes(POLICE_NEUTRE) ? FACES_NEUTRE : "";
}

/**
 * Bleu d'action de la charte neutre.
 *
 * C'est le bleu encre de la charte de l'État (#000091) décalé d'un cran dans
 * le cercle chromatique — teinte 226 au lieu de 240, et un peu moins saturé :
 * un bleu légèrement acier, qui n'est plus l'ultramarine de l'État sans cesser
 * d'être un bleu institutionnel. Le même décalage est appliqué à toute la
 * gamme, côté interface, par `styles.css` (jetons `--blue-france-*`).
 *
 * Il est répété ici parce que les documents n'ont pas les jetons du DSFR : un
 * courrier converti, imprimé hors connexion, ne peut compter que sur des
 * couleurs écrites en clair (voir `DOCUMENT_CSS` dans render.js).
 */
export const BLEU_NEUTRE = "#0b2886";

/** Réglage de la ligne unique de `Identite` (table facultative : « » sinon). */
function reglage(db, colonne) {
  const row = Array.isArray(db?.Identite) ? db.Identite[0] : null;
  return String(row?.[colonne] ?? "").trim();
}

/**
 * Charte en vigueur. La charte de l'État doit être **demandée** : seule une
 * valeur qui l'annonce la donne, et toute autre — vide comprise, c'est-à-dire
 * un document neuf ou qui n'a jamais rien réglé — vaut la charte neutre. C'est
 * le sens du réglage : afficher la marque de l'État est un acte, pas un
 * héritage, et une structure qui n'y a pas droit n'a rien à faire pour en
 * sortir.
 */
export function charte(db) {
  return /état|etat/i.test(reglage(db, "Charte")) ? CHARTE_ETAT : CHARTE_NEUTRE;
}

/** La charte neutre est-elle en vigueur (ni marque, ni police de l'État) ? */
export function charteNeutre(db) {
  return charte(db) === CHARTE_NEUTRE;
}

/** Le bloc-marque « République Française » doit-il être affiché ? */
export function marqueEtat(db) {
  return !charteNeutre(db);
}

/** Police personnalisée des documents, telle qu'elle a été saisie (« » sinon). */
export function policeDocuments(db) {
  return reglage(db, "Police_documents");
}

/** Un nom de famille qui contient une espace se cite entre guillemets en CSS. */
function citer(valeur) {
  return /\s/.test(valeur) ? `"${valeur}"` : valeur;
}

/**
 * Pile de polices d'un document, telle qu'elle s'écrit en CSS.
 *
 * Une saisie qui contient déjà une virgule est tenue pour une pile complète
 * (« Times New Roman, Georgia, serif ») et employée telle quelle : la personne
 * qui l'a écrite sait ce qu'elle fait. Sinon le nom est cité au besoin, et
 * Arial prend le relais — la police que la charte de l'État elle-même désigne
 * comme remplacement, et celle que tous les postes connaissent. Sans saisie,
 * c'est la pile de la charte en vigueur (`PILE_ETAT`, `PILE_NEUTRE`).
 */
export function policeDocumentCss(db) {
  const custom = policeDocuments(db);
  if (custom) return custom.includes(",") ? custom : `${citer(custom)}, Arial, sans-serif`;
  return charteNeutre(db) ? PILE_NEUTRE : PILE_ETAT;
}

/**
 * Nom de police unique des fichiers **Word** et **OpenDocument**, pour la
 * charte en vigueur.
 *
 * Ni OOXML ni ODF ne savent exprimer une liste de polices de repli : demander
 * « Marianne » à un fichier Word ferait substituer la police par le traitement
 * de texte sur tout poste où elle n'est pas installée, sans que l'auteur du
 * courrier puisse le voir. La charte de l'État demande donc Arial — la police
 * que la charte désigne elle-même comme remplacement, et que tous les postes
 * connaissent —, tandis que la charte neutre demande Public Sans, celle qu'elle
 * affiche : la même partout, à l'écran comme dans le fichier, dès lors que la
 * personne qui l'ouvre l'a installée (elle est libre, et gratuite).
 */
function nomCharte(db) {
  return charteNeutre(db) ? POLICE_NEUTRE : "Arial";
}

export function policeDocumentNom(db) {
  const custom = policeDocuments(db);
  if (!custom) return nomCharte(db);
  return custom.split(",")[0].trim().replace(/^["']|["']$/g, "") || nomCharte(db);
}

/**
 * Famille **embarquée** dans le PDF : celle dont l'outil possède le fichier de
 * police, et qu'il peut donc joindre au document.
 *
 * Le PDF porte ses polices avec lui — c'est ce qu'exige le format d'archivage
 * PDF/A, et ce qui garantit qu'un courrier s'ouvre à l'identique vingt ans plus
 * tard, sur un poste qui n'a rien installé. Il ne peut donc pas se contenter
 * d'un **nom**, comme le font Word et l'OpenDocument (voir `policeDocumentNom`) :
 * il lui faut une famille dont `pdf-fonts.js` sache où prendre les fichiers.
 *
 * Deux familles sont dans ce cas, celles des deux chartes. Une police réglée
 * pour tous les documents (« Times New Roman »…) n'y est pas : le PDF compose
 * alors dans la police de la charte, et l'export le signale à l'auteur plutôt
 * que de le lui cacher (voir `pdfPolice`, dans `export-doc.js`).
 */
export function policeDocumentEmbarquee(db) {
  const nom = policeDocumentNom(db);
  if (nom === POLICE_NEUTRE || nom === POLICE_ETAT) return nom;
  return nomCharte(db) === POLICE_NEUTRE ? POLICE_NEUTRE : POLICE_ETAT;
}

/**
 * Règle CSS qui impose la police du document, ou `""` lorsque celle de la
 * charte convient déjà.
 *
 * Le DSFR ne pose Marianne que sur `body` et sur les champs de saisie : il
 * suffit donc de reposer ces mêmes sélecteurs, dans une feuille placée après la
 * sienne, pour l'écarter — sans toucher au reste de la charte, ni à la police
 * d'icônes du DSFR, qui passe par ses propres classes.
 *
 * Les `@font-face` de la charte neutre voyagent avec la règle : un document est
 * rendu dans son propre cadre, qui n'hérite pas des polices de la coquille —
 * sans elles, un courrier de la charte neutre s'afficherait, à l'écran comme
 * dans le PDF, avec la police de repli du système.
 */
export function cssPoliceDocument(db) {
  const pile = policeDocumentCss(db);
  if (pile === PILE_ETAT) return "";
  return `${facesPour(pile)}body, input, select, textarea, button { font-family: ${pile}; }`;
}

/**
 * Règle CSS qui porte la charte neutre dans un document rendu, ou `""` avec la
 * charte de l'État.
 *
 * Un document ne dispose que de `DOCUMENT_CSS`, dont les couleurs sont écrites
 * en clair (il peut être converti ou imprimé hors connexion) : aucune n'y
 * reprend les jetons `--blue-france-*` de l'interface. Seuls les liens y
 * portent le bleu d'action ; c'est donc la seule règle à reposer pour qu'un
 * courrier de la charte neutre ne soit pas, à l'écran comme sur le papier,
 * celui de la charte de l'État.
 */
export function cssCharteDocument(db) {
  if (!charteNeutre(db)) return "";
  return `a, a:visited { color: ${BLEU_NEUTRE}; }`;
}

/**
 * Applique la charte à la coquille de l'outil : une classe sur `<html>`, que
 * `styles.css` met à profit pour remplacer Marianne par Public Sans, et les
 * `@font-face` de cette police, posés dans l'en-tête du document — la coquille
 * n'est pas un cadre à part, elle n'hérite de rien. La feuille est retirée avec
 * la charte : la charte de l'État ne traîne jamais de fichier de police.
 *
 * Les éléments qui portent la marque de l'État (en-tête, pied de page) sont,
 * eux, simplement omis au rendu (`ui.brandBlock`, `app.js`) : une marque ne se
 * cache pas, elle ne s'écrit pas.
 */
export function appliquerCharte(db) {
  if (typeof document === "undefined") return false;
  const neutre = charteNeutre(db);
  document.documentElement.classList.toggle("app-charte-neutre", neutre);
  let faces = document.getElementById("app-police-neutre");
  if (neutre && !faces) {
    faces = document.createElement("style");
    faces.id = "app-police-neutre";
    faces.textContent = FACES_NEUTRE;
    document.head.appendChild(faces);
  } else if (!neutre && faces) {
    faces.remove();
  }
  return neutre;
}
