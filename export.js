// Export du générateur en archive ZIP.
//
// Le bouton « Télécharger le générateur » de l'onglet Debug assemble une archive
// du site autonome entier — le dossier `src/` tel qu'il est déployé — en
// remplaçant le jeu de données d'exemple par une base vide. L'archive peut donc
// être publiée sur n'importe quel hébergement de fichiers statiques sans
// emporter les données des sections disciplinaires.
//
// La liste des fichiers n'est pas tenue à la main : elle est découverte à partir
// de `index.html` en suivant les feuilles de style puis les `import` relatifs
// des modules. Un fichier ajouté au projet plus tard est donc exporté sans rien
// changer ici, et un fichier référencé mais introuvable provoque une erreur
// explicite plutôt qu'une archive silencieusement incomplète.
//
// Les fichiers du site sont les voisins de ce module (`import.meta.url`), ce qui
// rend l'export identique en site autonome et dans l'aperçu du générateur.

const SITE_BASE = new URL("./", import.meta.url);

/** Fichiers joints à l'archive sans être importés (documentation, sources). */
const EXTRA_FILES = [
  "README.md",
  "CHANGELOG.md",
  "SECURITE.md",
  "EXIGENCES.md",
  "assets/bloc-marque.svg",
  "assets/bloc-marque.png",
  "accessibilite/DECLARATION-ACCESSIBILITE.md",
  "accessibilite/SCHEMA-PLURIANNUEL.md",
  "accessibilite/PLAN-D-ACTION.md",
  "rgpd/REGISTRE-DES-TRAITEMENTS.md",
  "rgpd/DECISION-ANALYSE-D-IMPACT.md",
  "rgpd/DUREES-DE-CONSERVATION.md",
  "rgpd/MENTIONS-D-INFORMATION.md",
  "tests/README.md",
  "tests/index.html",
  "tests/harness.js",
  "tests/invariants.test.js",
  "tests/ecrans.test.js",
  "livraison/README.md",
  "livraison/build.mjs",
  "livraison/index.min.html",
  "verifier.mjs",
];

const IMPORT_RE =
  /\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*["']([^"']+)["']/g;

const ASSET_RE = /(?:href|src)\s*=\s*["'](\.\/[^"']+)["']/g;

/* Un module peut aussi désigner une image par un chemin relatif (par exemple
   le bloc-marque livré avec l'outil) : ces fichiers font partie du site. */
const SCRIPT_ASSET_RE = /["'`](\.\.?\/[^"'`\s]+\.(?:png|jpe?g|gif|svg|webp|ico|woff2?))["'`]/g;

const EMPTY_SEED_SOURCE = `// Jeu de données de départ.
//
// Ce fichier a été régénéré par l'export « sans données » de l'onglet Debug :
// aucune donnée de section disciplinaire ne figure dans cette copie du
// générateur. La base est donc vide à la première ouverture ; la structure des
// tables est décrite par \`schema.js\` et recréée automatiquement.
//
// Pour livrer au contraire un jeu de démonstration, remplissez cet objet :
// chaque clé est un nom de table de \`schema.js\`, chaque valeur un tableau de
// lignes (\`id\` optionnel, renuméroté au chargement).

export const SEED = {};

export default SEED;
`;

/* ------------------------------------------------------------------ */
/* Outils de fichiers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Force la déclaration de production dans une page d'une archive (NC-0008,
 * NC-0021) : une copie de travail en recette produit un artefact déployable.
 *
 * Appliquée à **chaque** page HTML de l'archive — l'entrée `index.html` comme
 * l'enveloppe `perchance/index.html` — de sorte qu'aucun artefact exporté ne
 * puisse déclarer la recette. Exportée pour être éprouvée par le harnais.
 */
export function forcerProduction(html) {
  const declaration = `<script>window.ENVIRONNEMENT = "production";</script>`;
  const replaced = html.replace(
    /(window\.(?:ENVIRONNEMENT|APP_ENV)\s*=\s*)(["'])recette\2/,
    '$1"production"'
  );
  if (replaced !== html) return replaced;
  if (/window\.(?:ENVIRONNEMENT|APP_ENV)\s*=/.test(html)) return html;
  return html.replace(/<\/head>/i, `  ${declaration}\n</head>`);
}

/** Une page HTML déclare-t-elle la recette ? (contrôle d'artefact, NC-0021) */
export function declareRecette(html) {
  return /window\.(?:ENVIRONNEMENT|APP_ENV)\s*=\s*["']recette["']/.test(html);
}

const decoder = new TextDecoder();

function safeDecode(bytes) {
  return decoder.decode(bytes);
}

/** Résout un spécifieur relatif depuis le chemin du fichier qui le porte. */
function resolvePath(from, spec) {
  const parts = from.split("/").slice(0, -1);
  for (const piece of spec.split("/")) {
    if (piece === "" || piece === ".") continue;
    if (piece === "..") parts.pop();
    else parts.push(piece);
  }
  return parts.join("/");
}

/** Retire les commentaires pour ne pas confondre un exemple avec un import. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

async function fetchFile(path) {
  const url = new URL(path, SITE_BASE);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`fichier introuvable : ${path} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Parcourt le site à partir de `index.html` et renvoie une table
 * chemin → contenu binaire.
 */
async function collectSiteFiles() {
  const files = new Map();
  const queue = ["index.html"];
  while (queue.length) {
    const path = queue.shift();
    if (files.has(path)) continue;
    const bytes = await fetchFile(path);
    files.set(path, bytes);
    if (path.endsWith(".html")) {
      for (const match of safeDecode(bytes).matchAll(ASSET_RE)) {
        queue.push(resolvePath(path, match[1]));
      }
    } else if (path.endsWith(".js")) {
      const source = stripComments(safeDecode(bytes));
      for (const match of source.matchAll(IMPORT_RE)) {
        const spec = match[1] || match[2] || match[3];
        if (spec && (spec.startsWith("./") || spec.startsWith("../"))) {
          queue.push(resolvePath(path, spec));
        }
      }
      for (const match of source.matchAll(SCRIPT_ASSET_RE)) {
        queue.push(resolvePath(path, match[1]));
      }
    }
  }
  return files;
}

/* ------------------------------------------------------------------ */
/* Archive ZIP (méthode « stored », sans compression)                  */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosStamp(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const encoder = new TextEncoder();

/**
 * Construit un ZIP en méthode « stored » : suffisant, et sans dépendance.
 * `entries` : `[{ name, data }]` où `data` est un `Uint8Array`. L'ordre est
 * conservé — l'ODT exige que `mimetype` soit la première entrée.
 */
export function zipStore(entries, stamp = new Date()) {
  const { time, date } = dosStamp(stamp);
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const head = new Uint8Array(30 + name.length);
    const hv = new DataView(head.buffer);
    hv.setUint32(0, 0x04034b50, true);
    hv.setUint16(4, 20, true);
    hv.setUint16(6, 0x0800, true);
    hv.setUint16(8, 0, true);
    hv.setUint16(10, time, true);
    hv.setUint16(12, date, true);
    hv.setUint32(14, crc, true);
    hv.setUint32(18, entry.data.length, true);
    hv.setUint32(22, entry.data.length, true);
    hv.setUint16(26, name.length, true);
    head.set(name, 30);
    parts.push(head, entry.data);
    directory.push({ name, crc, size: entry.data.length, offset });
    offset += head.length + entry.data.length;
  }
  let dirSize = 0;
  for (const item of directory) {
    const record = new Uint8Array(46 + item.name.length);
    const rv = new DataView(record.buffer);
    rv.setUint32(0, 0x02014b50, true);
    rv.setUint16(4, 20, true);
    rv.setUint16(6, 20, true);
    rv.setUint16(8, 0x0800, true);
    rv.setUint16(12, time, true);
    rv.setUint16(14, date, true);
    rv.setUint32(16, item.crc, true);
    rv.setUint32(20, item.size, true);
    rv.setUint32(24, item.size, true);
    rv.setUint16(28, item.name.length, true);
    rv.setUint32(42, item.offset, true);
    record.set(item.name, 46);
    parts.push(record);
    dirSize += record.length;
  }
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, directory.length, true);
  ev.setUint16(10, directory.length, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, offset, true);
  parts.push(end);
  return new Blob(parts, { type: "application/zip" });
}

/* ------------------------------------------------------------------ */
/* Pièces jointes rédigées                                             */
/* ------------------------------------------------------------------ */

function metaValue(html, pattern) {
  const found = pattern.exec(html);
  return found ? found[1].trim() : "";
}

/**
 * Fichiers de référence pour recréer un générateur Perchance à partir du même
 * code : l'enveloppe du générateur se limite au bloc `$meta`, à l'import du
 * relais de lecture des images, et à une page qui charge `src/`.
 */
function perchanceWrapper(entryHtml) {
  const title = metaValue(entryHtml, /<title>([^<]*)<\/title>/i) || "Gestion des sections disciplinaires";
  const description = metaValue(entryHtml, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const main = `$meta
  title = ${title}
${description ? `  description = ${description}\n` : ""}
// Relais de lecture des images distantes dont l'hébergeur refuse l'intégration
// croisée (sites publics, ministères, Légifrance) : sans lui, un courrier
// exporté en PDF part sans son bloc-marque. Voir \`octetsImage\` dans
// \`src/export-doc.js\`. Hors de Perchance, l'outil s'en passe.
superFetch = {import:super-fetch-plugin}
`;
  const html = entryHtml
    .replace(/<title>[^<]*<\/title>\s*/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/i, "")
    .replace(/(href|src)\s*=\s*"\.\//g, '$1="src/');
  return { main, html };
}

function archiveNotice(date, files) {
  const lines = files
    .map((f) => `  ${f.name.padEnd(34, " ")} ${f.data.length} octets`)
    .join("\n");
  return `Gestion des sections disciplinaires — site autonome
===================================================

Archive générée le ${date} par l'outil lui-même (onglet Debug › Export).

Contenu
-------
${lines}
  LISEZ-MOI.txt                       ce fichier

Données
-------
AUCUNE donnée de section disciplinaire ne figure dans cette archive : le
fichier seed.js a été régénéré avec un jeu de données vide. À la première
ouverture, la base est vide, les écrans affichent leurs états « aucune
donnée », et il n'y a donc rien à effacer avant de publier.

Environnement
-------------
Toutes les pages de cette archive — l'entrée index.html comme l'enveloppe
perchance/index.html — déclarent la production : l'onglet Debug, la simulation
d'identité et de rôle et les outils de purge restent fermés, et une base vide
n'est jamais remplie par le jeu de démonstration. Une copie de travail laissée
en recette ne peut donc pas produire un artefact de démonstration.

Mise en ligne
-------------
Déposez le contenu de cette archive à la racine d'un hébergement de fichiers
statiques : aucun serveur applicatif n'est nécessaire. L'ouverture directe
depuis le disque (file://) ne fonctionne pas — les modules ES exigent un accès
HTTP(S). Le Système de Design de l'État est chargé depuis jsDelivr : la
première visite nécessite un accès à Internet, les suivantes peuvent se
contenter du cache du navigateur.

Utilisation dans Grist
----------------------
Le même dossier s'utilise comme page personnalisée d'un document Grist :
l'application détecte l'API du widget, puis Réglages › Données permet
d'installer la structure attendue dans le document.

Générateur Perchance
--------------------
Le dossier perchance/ contient l'enveloppe minimale d'un générateur Perchance
qui charge ce même code : créez un générateur, collez le contenu de
perchance/main.pjs dans ses listes et celui de perchance/index.html dans sa
page, puis déposez les fichiers du site dans son dossier src/. Supprimez ce
dossier si vous hébergez le site tel quel.
`;
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Assemble l'archive du site autonome, données retirées.
 * @returns {Promise<{blob: Blob, name: string, files: string[], bytes: number}>}
 */
export async function buildExport() {
  const collected = await collectSiteFiles();
  if (!collected.has("index.html")) throw new Error("index.html est absent de l'archive");
  const entryHtml = safeDecode(collected.get("index.html"));
  collected.set("seed.js", encoder.encode(EMPTY_SEED_SOURCE));
  // L'archive est un **artefact de déploiement** : elle est vide de données et
  // destinée à être publiée (NC-0008). Elle déclare donc la production, quel
  // que soit l'environnement de la copie de travail dont elle est tirée.
  collected.set("index.html", encoder.encode(forcerProduction(entryHtml)));

  for (const path of EXTRA_FILES) {
    if (collected.has(path)) continue;
    try {
      collected.set(path, await fetchFile(path));
    } catch {
      // Documentation facultative : son absence n'empêche pas l'export.
    }
  }

  const wrapper = perchanceWrapper(entryHtml);
  collected.set("perchance/main.pjs", encoder.encode(wrapper.main));
  collected.set(
    "perchance/index.html",
    encoder.encode(
      `<!-- Enveloppe du générateur Perchance : mêmes fichiers, servis depuis src/. -->
${forcerProduction(wrapper.html)}`
    )
  );

  // Garde-fou (NC-0021) : aucune page HTML de l'archive ne doit déclarer la
  // recette, quelle que soit la copie de travail dont elle est tirée. On
  // repasse donc chaque page par forcerProduction — l'enveloppe Perchance
  // comprise, que la correction de NC-0008 avait laissée de côté.
  for (const [name, data] of [...collected.entries()]) {
    if (!name.endsWith(".html")) continue;
    const html = safeDecode(data);
    if (declareRecette(html)) collected.set(name, encoder.encode(forcerProduction(html)));
  }

  const stamp = new Date();
  const date = stamp.toISOString().slice(0, 10);
  const entries = [...collected.entries()]
    .sort(([a], [b]) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)))
    .map(([name, data]) => ({ name, data }));
  const notice = archiveNotice(date, entries);
  entries.push({ name: "LISEZ-MOI.txt", data: encoder.encode(notice) });

  const bytes = entries.reduce((total, entry) => total + entry.data.length, 0);
  return {
    blob: zipStore(entries, stamp),
    name: `sections-disciplinaires-site-${date}.zip`,
    files: entries.map((entry) => entry.name),
    bytes,
  };
}

/** Assemble l'archive et déclenche le téléchargement. */
export async function exportSite() {
  const bundle = await buildExport();
  downloadBlob(bundle.blob, bundle.name);
  return bundle;
}
