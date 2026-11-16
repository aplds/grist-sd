// Polices embarquées dans les PDF exportés.
//
// Un PDF/A doit **embarquer** toutes ses polices : là où un fichier Word se
// contente de les nommer — et laisse le poste qui l'ouvre substituer ce qu'il
// n'a pas —, un PDF/A qui renverrait à une police absente serait invalide, et
// s'ouvrirait avec une autre police que celle voulue. Le texte du PDF est donc
// composé dans une police dont on possède le **fichier**.
//
// Deux familles sont embarquées, celles des deux chartes (voir `charte.js`) :
//
//  - **Public Sans**, la police de la charte neutre. Ses quatre fichiers TTF
//    sont ceux du projet Public Sans (SIL Open Font License 1.1), repris de
//    https://github.com/uswds/public-sans (`fonts/ttf`) et servis depuis
//    l'hébergement de l'outil — comme les woff2 de la charte, et pour la même
//    raison : aucun document ne dépend d'un service tiers pour s'afficher. La
//    licence autorise la redistribution et l'intégration dans un document.
//  - **Marianne**, la police de la charte de l'État. Elle n'est pas
//    redistribuée ici : elle est demandée, à l'export, à la même adresse que
//    celle dont la charte tire déjà son dessin (le paquet du Système de design
//    de l'État, même version), et convertie sur place.
//
// Le DSFR ne publie que du WOFF et du WOFF2, qu'aucune bibliothèque PDF ne lit :
// `woffVersTtf` refait le fichier TrueType, sans rien télécharger d'autre —
// l'archive WOFF **est** l'ensemble des tables TrueType d'une police, chacune
// simplement comprimée (voir le format WOFF, W3C).
//
// Une seule famille est chargée, celle du document : rien n'est téléchargé pour
// un document qu'on n'exporte pas. Ce qui l'a été reste : les fichiers comme le
// rapport entre le blanc naturel de la police et son corps (`ratioDuFichier`),
// dont la composition PDF a besoin pour retrouver l'interligne de la charte
// (voir `INTERLIGNE`, dans `export-doc.js`).

/**
 * Les quatre visages d'une famille : la face pdfmake, le nom du fichier tel
 * qu'il est déclaré à la bibliothèque, son adresse, et sa forme.
 *
 * `woff: true` marque un fichier WOFF, à décompresser avant de le donner à la
 * bibliothèque ; les autres sont des TrueType, pris tels quels.
 */
const FACES = ["normal", "bold", "italics", "bolditalics"];

import { DSFR_FONT } from "./dependances.js";

const POLICES = {
  "Public Sans": {
    normal: { fichier: "PublicSans-Regular.ttf", url: "https://user.uploads.dev/file/338411ef30ab6a458c8a863697fd686e.ttf" },
    bold: { fichier: "PublicSans-Bold.ttf", url: "https://user.uploads.dev/file/c32157be07cb5f0e2bb001cab2450628.ttf" },
    italics: { fichier: "PublicSans-Italic.ttf", url: "https://user.uploads.dev/file/91ba1d19cfa6600770bd0363dfe22997.ttf" },
    bolditalics: { fichier: "PublicSans-BoldItalic.ttf", url: "https://user.uploads.dev/file/8bd592273534001b8886f93d7ce88fe0.ttf" },
  },
  Marianne: {
    normal: { fichier: "Marianne-Regular.ttf", url: DSFR("Marianne-Regular"), woff: true },
    bold: { fichier: "Marianne-Bold.ttf", url: DSFR("Marianne-Bold"), woff: true },
    italics: { fichier: "Marianne-Regular_Italic.ttf", url: DSFR("Marianne-Regular_Italic"), woff: true },
    bolditalics: { fichier: "Marianne-Bold_Italic.ttf", url: DSFR("Marianne-Bold_Italic"), woff: true },
  },
};

/** Adresse d'un fichier de police du DSFR — la version qu'emploie `index.html`. */
function DSFR(nom) {
  return DSFR_FONT(nom);
}

/** La famille embarquée par défaut : celle de la charte neutre. */
export const FAMILLE_DEFAUT = "Public Sans";

/** Nom d'une famille embarquée, à défaut celui de la famille par défaut. */
export function familleEmbarquee(nom) {
  return POLICES[nom] ? nom : FAMILLE_DEFAUT;
}

/** La famille `nom` fait-elle partie de celles qu'on sait embarquer ? */
export function estEmbarquee(nom) {
  return Boolean(POLICES[nom]);
}

/**
 * Configuration des polices de la bibliothèque : les deux familles y sont
 * déclarées avec leurs quatre visages, et référencent les fichiers déposés dans
 * son système de fichiers virtuel par `chargerFamille`.
 */
export function configurationPolices() {
  const conf = {};
  for (const [famille, faces] of Object.entries(POLICES)) {
    conf[famille] = {};
    for (const face of FACES) conf[famille][face] = faces[face].fichier;
  }
  return conf;
}

/** Fichiers déjà téléchargés (et convertis), gardés pour les exports suivants. */
const cache = new Map();

/**
 * Le système de fichiers de la bibliothèque, tenu à jour ici : une famille
 * déposée ne doit jamais en disparaître, puisque le réglage de police peut
 * changer d'un document à l'autre et qu'un texte peut en employer deux.
 */
const depot = {};

/**
 * Dépose les fichiers d'une famille dans le système de fichiers de la
 * bibliothèque, et rend `{ manquants, ratio }`.
 *
 * `manquants` porte les adresses qui n'ont pas pu être téléchargées : une
 * police inaccessible se **signale** — l'export, lui, décide (le PDF ne peut
 * pas s'en passer, voir `exportPdf`). `ratio` est le rapport entre le blanc
 * naturel de la police et son corps, qui traduit l'interligne de la charte
 * (voir `INTERLIGNE`, dans `export-doc.js`).
 */
export async function chargerFamille(famille, pdfMake) {
  const faces = POLICES[familleEmbarquee(famille)];
  const manquants = [];
  let ratio = cache.get(faces.normal.fichier)?.ratio || 1;
  for (const face of FACES) {
    const { fichier, url, woff } = faces[face];
    try {
      if (!cache.has(fichier)) {
        const reponse = await fetch(url, { mode: "cors" });
        if (!reponse.ok) throw new Error(`${reponse.status} ${reponse.statusText}`);
        let octets = new Uint8Array(await reponse.arrayBuffer());
        if (woff) octets = await woffVersTtf(octets);
        cache.set(fichier, { base64: base64(octets), ratio: ratioDuFichier(octets) });
      }
      const police = cache.get(fichier);
      depot[fichier] = police.base64;
      if (face === "normal") ratio = police.ratio;
    } catch (err) {
      manquants.push(url);
      console.warn(`Police ${fichier} indisponible :`, err);
    }
  }
  pdfMake.addVirtualFileSystem({ ...depot });
  return { manquants, ratio };
}

/** Octets → base64, sans passer par une chaîne intermédiaire géante. */
function base64(octets) {
  let texte = "";
  const bloc = 0x8000;
  for (let i = 0; i < octets.length; i += bloc) {
    texte += String.fromCharCode.apply(null, octets.subarray(i, i + bloc));
  }
  return btoa(texte);
}

/**
 * Rapport entre le blanc naturel d'une police et son corps : sa hauteur
 * d'ascendante plus sa hauteur de descendante, rapportées au carré de la
 * police. C'est le facteur que la bibliothèque de mise en page applique à son
 * `lineHeight` — là où CSS l'applique au corps (voir `INTERLIGNE`, dans
 * `export-doc.js`).
 *
 * Un sfnt range ces valeurs dans deux tables, `head` (le carré de la police)
 * et `hhea` (l'ascendante et la descendante), chacune à décalage fixe depuis
 * le début de sa table. Une police qu'on ne saurait pas lire rend `1` : la
 * ligne sera celle de la bibliothèque, ce qui vaut mieux qu'un échec.
 */
function ratioDuFichier(octets) {
  const table = (nom) => {
    const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    const nombre = vue.getUint16(4);
    for (let i = 0; i < nombre; i += 1) {
      const entree = 12 + i * 16;
      if (etiquette(octets, entree) === nom) return { vue, offset: vue.getUint32(entree + 8) };
    }
    return null;
  };
  const head = table("head");
  const hhea = table("hhea");
  if (!head || !hhea) return 1;
  const carre = head.vue.getUint16(head.offset + 18);
  const ascendante = hhea.vue.getInt16(hhea.offset + 4);
  const descendante = hhea.vue.getInt16(hhea.offset + 6);
  const ratio = carre ? (ascendante - descendante) / carre : 0;
  return ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
}

/** Somme de contrôle des tables d'un sfnt : ses octets lus par mots de 32 bits. */
function somme(octets) {
  let total = 0;
  for (let i = 0; i < octets.length; i += 4) {
    const mot = (octets[i] << 24) | ((octets[i + 1] || 0) << 16) | ((octets[i + 2] || 0) << 8) | (octets[i + 3] || 0);
    total = (total + (mot >>> 0)) >>> 0;
  }
  return total;
}

/** Les quatre octets d'étiquette d'une table, ou d'une signature. */
function etiquette(octets, offset) {
  return String.fromCharCode(octets[offset], octets[offset + 1], octets[offset + 2], octets[offset + 3]);
}

/**
 * Reconstruit un fichier TrueType depuis un WOFF.
 *
 * Un WOFF est une enveloppe : un en-tête, un répertoire de tables, et les
 * tables elles-mêmes, chacune comprimée par zlib lorsqu'elle y gagne. Refaire
 * le TrueType, c'est donc recopier ces tables après les avoir décompressées —
 * et recalculer les deux sommes de contrôle du format (celle de chaque table,
 * et l'ajustement global porté par `head`), pour que le fichier soit un sfnt
 * valide jusque dans ses vérifications.
 */
export async function woffVersTtf(woff) {
  const vue = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (etiquette(woff, 0) !== "wOFF") throw new Error("ce n'est pas un fichier WOFF");
  const version = vue.getUint32(4);
  const nombre = vue.getUint16(12);
  const entrees = [];
  for (let i = 0; i < nombre; i += 1) {
    const o = 44 + i * 20;
    entrees.push({
      tag: etiquette(woff, o),
      decalage: vue.getUint32(o + 4),
      comprimee: vue.getUint32(o + 8),
      longueur: vue.getUint32(o + 12),
    });
  }
  const tables = [];
  for (const entree of entrees) {
    const brut = woff.slice(entree.decalage, entree.decalage + entree.comprimee);
    let donnees = brut;
    if (entree.comprimee < entree.longueur) {
      const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream("deflate"));
      donnees = new Uint8Array(await new Response(flux).arrayBuffer());
    }
    if (donnees.length !== entree.longueur) {
      throw new Error(`table ${entree.tag} : ${donnees.length} octets au lieu de ${entree.longueur}`);
    }
    tables.push({ tag: entree.tag, donnees, somme: 0, decalage: 0 });
  }
  // Recherche dichotomique de l'en-tête sfnt : les mêmes valeurs que celles
  // qu'écrirait un compilateur de polices.
  let selecteur = 0;
  while (2 ** (selecteur + 1) <= nombre) selecteur += 1;
  const recherche = 2 ** selecteur * 16;
  const remplissage = (n) => (4 - (n % 4)) % 4;
  let position = 12 + nombre * 16;
  for (const table of tables) {
    table.decalage = position;
    position += table.donnees.length + remplissage(table.donnees.length);
  }
  const out = new Uint8Array(position);
  const ovue = new DataView(out.buffer);
  ovue.setUint32(0, version);
  ovue.setUint16(4, nombre);
  ovue.setUint16(6, recherche);
  ovue.setUint16(8, selecteur);
  ovue.setUint16(10, nombre * 16 - recherche);
  tables.forEach((table, i) => {
    table.somme = somme(table.donnees);
    const o = 12 + i * 16;
    out.set(new TextEncoder().encode(table.tag), o);
    ovue.setUint32(o + 4, table.somme);
    ovue.setUint32(o + 8, table.decalage);
    ovue.setUint32(o + 12, table.donnees.length);
    out.set(table.donnees, table.decalage);
  });
  // `head.checkSumAdjustment` se calcule sur le fichier complet, une fois la
  // valeur en place mise à zéro — d'où les deux passes.
  const head = tables.findIndex((table) => table.tag === "head");
  if (head >= 0) {
    const table = tables[head];
    ovue.setUint32(table.decalage + 8, 0);
    table.somme = somme(table.donnees);
    ovue.setUint32(12 + head * 16 + 4, table.somme);
    ovue.setUint32(table.decalage + 8, (0xb1b0afba - somme(out)) >>> 0);
    ovue.setUint32(12 + head * 16 + 4, somme(table.donnees));
  }
  return out;
}
