// Dépendances tierces et empreintes — NC-0003.
//
// Source unique de tout ce que l'outil charge **hors de son propre
// hébergement** : la version du Système de design de l'État (DSFR), les deux
// bibliothèques de lecture de fichiers et de fabrication de documents, et
// l'adresse des polices. Un correctif de sécurité sur l'une de ces briques se
// fait donc à un seul endroit, et la revue peut embrasser d'un regard tout ce
// que la page va chercher ailleurs.
//
// Deux protections :
//
//   · **l'intégrité** des fichiers chargés par des balises statiques
//     (`index.html`) : leurs empreintes SHA-384 figurent dans `SRI` et sont
//     posées en attribut `integrity` — un fichier modifié chez le tiers est
//     refusé par le navigateur. Les modules chargés à la demande par
//     `import()`, eux, ne peuvent pas porter d'attribut d'intégrité (la
//     plateforme ne le permet pas) : leur version est **figée** ici, et leur
//     adresse de repli, documentée dans `SECURITE.md` ;
//   · **l'énumération** : `DEPENDANCES` liste les seules adresses tierces
//     employées à l'exécution. C'est ce que vérifie la revue de sécurité, et ce
//     qui alimente le tableau de `SECURITE.md`.

/** Version du Système de design de l'État, partagée par l'interface et les polices. */
export const DSFR_VERSION = "1.15.3";

const DSFR_DIST = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist`;

/** Feuille de style principale du DSFR. */
export const DSFR_CSS = `${DSFR_DIST}/dsfr/dsfr.min.css`;
/** Police d'icônes du DSFR. */
export const DSFR_ICONS_CSS = `${DSFR_DIST}/utility/icons/icons.min.css`;
/** Feuilles d'utilitaires du DSFR (documents imprimés). */
export const DSFR_UTILITY_CSS = `${DSFR_DIST}/utility/utility.min.css`;
/** Module JavaScript du DSFR (gestion du thème, composants). */
export const DSFR_MODULE_JS = `${DSFR_DIST}/dsfr/dsfr.module.min.js`;

/** Adresse d'un fichier de police du DSFR (WOFF, employé pour le PDF). */
export function DSFR_FONT(nom) {
  return `${DSFR_DIST}/fonts/${nom}.woff`;
}

/**
 * Empreintes d'intégrité des fichiers chargés par des balises statiques.
 * Elles correspondent à la version `DSFR_VERSION` ci-dessus et sont posées en
 * attribut `integrity` dans `index.html`. Toute montée de version du DSFR
 * demande de recalculer ces empreintes (voir `SECURITE.md`).
 */
export const SRI = {
  dsfrCss: "sha384-huiykpwaFtSi/zS9cFI5LptsYFZVVBqJagK9pImVfMAh1VF7qc15SNsDFgy72ydf",
  iconsCss: "sha384-eZttJ6GiCRGDB0vSXDFErzpOrPQjG4MIkulDX4nwR7drxWPMBsiZ5aqaF3WB3WHf",
  moduleJs: "sha384-Cw5CS2Fvr/DGphoVDgLsI2KeLYMzyATr8PRwDeI+zalFEZ0G8Ig7ZLg8CsMUQW5W",
};

/** Adresses tierces employées à l'exécution, par fonction. */
export const DEPENDANCES = {
  /** Lecture des classeurs Excel (import et export de listes). */
  xlsx: "https://esm.sh/xlsx@0.18.5",
  /** Lecture des bases SQLite `.grist`. */
  sqljs: "https://cdn.jsdelivr.net/npm/sql.js@1.11.0/+esm",
  /** Répertoire du fichier WASM de `sql.js`, chargé à côté du module. */
  sqljsWasm: "https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/",
  /** Composition des PDF. */
  pdfmake: "https://esm.sh/pdfmake@0.2.20",
  /** Assemblage des fichiers Word. */
  docx: "https://esm.sh/docx@9.5.1",
  /** Conversion au format d'archivage PDF/A-2b. */
  pdflib: "https://esm.sh/pdf-lib@1.17.1",
};

/**
 * Importe un module tiers, avec un message français en cas d'échec réseau.
 * Le repli est celui du navigateur : une panne d'esm.sh fait échouer l'action
 * concernée (import, export PDF ou Word), sans jamais empêcher l'outil de
 * fonctionner sur les données déjà chargées.
 */
export function chargerModule(url, usage) {
  return import(url).catch((err) => {
    throw new Error(`La bibliothèque nécessaire pour ${usage} n'a pas pu être chargée : `
      + "vérifiez la connexion au réseau, ou employez un autre format "
      + "(les CSV et l'impression du navigateur ne demandent aucune bibliothèque). "
      + `Détail : ${(err && err.message) || err}`);
  });
}
