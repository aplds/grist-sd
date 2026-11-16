// Lecture des fichiers d'import.
//
// L'outil d'import (`import.js`) raisonne sur une source déjà tabulaire :
// `{ Table: lignes[] }`. Ce module fait le travail d'avant — ouvrir un fichier
// et en tirer cette source. Quatre formats sont lus :
//
//  - **`.grist`** — un document Grist est une base SQLite (voir l'aide Grist,
//    « What files does Grist store? »). On la lit avec `sql.js` (SQLite compilé
//    en WebAssembly, chargé à la demande depuis jsDelivr). Les tables du modèle
//    sont reconnues par leur nom, celles créées par l'outil sont reconnues sous
//    leur nom masqué (`GristHidden_Affaires`, voir `grist-backend.js`).
//  - **`.xlsx` / `.xls` / `.ods`** — un classeur, lu avec SheetJS : une feuille
//    par table, comme le fait l'export Excel de Grist.
//  - **`.csv` / `.tsv`** — un fichier délimité ne porte qu'une table : sa table
//    cible est déduite de son nom puis de ses colonnes, et peut toujours être
//    corrigée à l'écran.
//  - **`.json`** — export de l'outil (`{ tables: {...} }`) ou objet dont les clés
//    sont les noms des tables.
//
// Ce que l'export de Grist contient (vérifié dans le code de Grist,
// `app/server/lib/Export.ts` et `ExportDSV.ts`) commande la conversion :
//
//  - l'en-tête est le **libellé** de la colonne (« Nom du mis en cause »), sauf
//    option contraire ; on accepte aussi bien le libellé que l'identifiant ;
//  - les valeurs sont **mises en forme** : une référence est écrite par le
//    libellé de la ligne visée, pas par son identifiant ; une liste de choix
//    est écrite en toutes lettres. D'où `resoudreRefsTexte`, qui rapproche ces
//    libellés des lignes du même fichier quand la table visée s'y trouve ;
//  - le choix du séparateur décimal et le format de date suivent la langue du
//    document : les dates sont donc relues au format AAAA-MM-JJ comme au format
//    JJ/MM/AAAA, et les nombres avec virgule comme avec point.

import { SCHEMA } from "./schema.js";
import { LEGACY_COLUMNS } from "./legacy.js";
import { HIDDEN_PREFIX } from "./grist-backend.js";
import { isoDate, toDate } from "./formulas.js";
import { DEPENDANCES } from "./dependances.js";

/* ------------------------------------------------------------------ */
/* Bibliothèques externes (chargées à la demande)                      */
/* ------------------------------------------------------------------ */

const SQLJS_MODULE = DEPENDANCES.sqljs;
const SQLJS_WASM = DEPENDANCES.sqljsWasm;
/* SheetJS lit les classeurs (.xlsx, .xls, .ods) ici, et les écrit dans
   `export-table.js` : les deux modules partagent donc la même version. */
export const SHEETJS_MODULE = DEPENDANCES.xlsx;

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

/** Extensions reconnues, et le lecteur qui s'en charge. */
const LECTEURS = {
  json: "json",
  csv: "csv",
  tsv: "csv",
  txt: "csv",
  xlsx: "classeur",
  xls: "classeur",
  xlsm: "classeur",
  ods: "classeur",
  grist: "grist",
};

/** Attribut `accept` du sélecteur de fichier. */
export const FORMATS_ACCEPTES = ".grist,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.json";

/** Libellés des formats, pour l'écran. */
export const FORMATS_NOMMES = {
  json: "export JSON",
  csv: "fichier délimité",
  classeur: "classeur",
  grist: "document Grist",
};

/** Format d'un fichier d'après son extension, sinon `""`. */
export function formatDeFichier(nom) {
  const s = String(nom || "");
  const point = s.lastIndexOf(".");
  if (point < 0) return "";
  return LECTEURS[s.slice(point + 1).toLowerCase()] || "";
}

/** Message d'aide, identique à l'écran et dans les erreurs. */
export const FORMATS_AIDE = "Choisissez un document Grist (.grist), un classeur (.xlsx, .xls, .ods), "
  + "un fichier délimité (.csv, .tsv) ou un export JSON de l'outil.";

/* ------------------------------------------------------------------ */
/* Noms de colonnes et de tables                                       */
/* ------------------------------------------------------------------ */

/** Forme comparable d'un nom : sans accent, sans casse, sans ponctuation. */
const norm = (s) => String(s ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

/**
 * Colonnes connues d'une table : ses identifiants, ses libellés, et les
 * colonnes de l'architecture d'origine (`legacy.js`). Un fichier exporté par
 * Grist porte des libellés, un document `.grist` porte des identifiants : les
 * deux passent par la même table de correspondance.
 */
function colonnesConnues(table) {
  const def = SCHEMA[table];
  const alentours = new Map();
  const ajoute = (valeur, id) => {
    const n = norm(valeur);
    if (!n || alentours.has(n)) return;
    alentours.set(n, id);
  };
  for (const c of def.columns) ajoute(c.id, c.id);
  for (const c of def.columns) ajoute(c.label, c.id);
  for (const col of Object.keys(LEGACY_COLUMNS[table]?.columns || {})) ajoute(col, col);
  return alentours;
}

const COLONNES = Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, colonnesConnues(t)]));

/**
 * Nombre de tables qui connaissent chaque nom de colonne : « Prenom » ne
 * désigne pas grand-chose, « Composition_attendue » désigne une seule table.
 * Sert à peser les colonnes lors de la reconnaissance d'une table, plutôt que
 * de compter les colonnes une à une.
 */
const RARETE = (() => {
  const compte = new Map();
  for (const table of Object.keys(SCHEMA)) {
    for (const n of COLONNES[table].keys()) compte.set(n, (compte.get(n) || 0) + 1);
  }
  return compte;
})();

/** Colonne de l'outil que porte un en-tête de fichier, sinon `""`. */
export function correspondance(table, entete) {
  return COLONNES[table]?.get(norm(entete)) || "";
}

/** Nombre de colonnes d'un fichier reconnues par une table de l'outil. */
export function colonnesReconnues(table, colonnes) {
  if (!table || !SCHEMA[table]) return 0;
  return (colonnes || []).filter((c) => correspondance(table, c)).length;
}

/** Tables proposées au choix de l'utilisateur, dans l'ordre du schéma. */
export function tablesConnues() {
  return Object.entries(SCHEMA).map(([cle, def]) => ({ cle, label: def.label }));
}

/**
 * Table de l'outil que porte un jeu d'en-têtes.
 *
 * Le nom de la feuille ou du fichier pèse lourd : un export Grist nomme le
 * fichier et la feuille d'après la table (« Affaires.csv », feuille
 * « Affaires »). À défaut, ce sont les colonnes qui décident, chacune pesant
 * l'inverse du nombre de tables qui la connaissent — une colonne rare et
 * présente vaut mieux que dix colonnes banales.
 */
export function detecterTable(nom, colonnes) {
  const direct = SCHEMA[nom] ? nom : null;
  if (direct) return { table: direct, score: 1000, nom: true };

  const cible = norm(nom);
  let meilleur = null;
  for (const [table, def] of Object.entries(SCHEMA)) {
    let score = 0;
    if (cible && (norm(table) === cible || norm(def.label) === cible)) score += 100;
    for (const c of colonnes) {
      const n = norm(c);
      if (n && COLONNES[table].has(n)) score += 1 / (RARETE.get(n) || 1);
    }
    if (!meilleur || score > meilleur.score) meilleur = { table, score };
  }
  // En dessous de deux colonnes reconnues, la reconnaissance n'est pas
  // sérieuse : mieux vaut laisser choisir que d'importer dans la mauvaise table.
  return meilleur && meilleur.score >= 2 ? meilleur : { table: "", score: meilleur?.score || 0 };
}

/* ------------------------------------------------------------------ */
/* Valeurs                                                             */
/* ------------------------------------------------------------------ */

/**
 * Un nombre écrit à la française comme à l'anglaise : « 1 234,50 »,
 * « 1.234,50 », « 1234.5 », « 12 ». `null` si ce n'est pas un nombre.
 */
function nombre(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s\u00a0\u202f]/g, "");
  if (!s) return null;
  let t = s;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) t = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+(,\d+)$/.test(s)) t = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const VRAI = /^(true|vrai|oui|o|x|1|1\.0)$/i;

/** Date en AAAA-MM-JJ. Le jour d'abord pour les formats à barres obliques. */
function dateIso(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return isoDate(v) || "";
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? isoDate(v) || "" : "";
  const s = String(v).trim();
  const fr = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/.exec(s);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = toDate(s);
  return d ? isoDate(d) || "" : "";
}

/** Horodatage ISO, ou date seule si l'heure est minuit. */
function dateHeureIso(v) {
  if (v === null || v === undefined || v === "") return "";
  const d = v instanceof Date ? v : typeof v === "number" ? new Date(v * 1000) : toDate(v);
  if (!d || Number.isNaN(d.getTime())) return "";
  const t = d.getTime();
  if (t % 86400000 === 0) return isoDate(d) || "";
  return d.toISOString();
}

/** Une liste (Grist la stocke en JSON) ramenée à un tableau. */
function liste(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === "") return [];
  if (typeof v === "number") return [v];
  const s = String(v).trim();
  if (s.startsWith("[")) {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p;
    } catch { /* liste écrite à la main : on découpe plus bas */ }
  }
  return s.split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
}

/** Met une valeur de fichier au type de la colonne du modèle. */
function auType(v, type) {
  if (v === null || v === undefined || v === "") return "";
  const base = String(type || "Text").split(":")[0];
  if (base === "Date") return dateIso(v);
  if (base === "DateTime") return dateHeureIso(v);
  if (base === "Bool") return VRAI.test(String(v).trim());
  if (base === "Int") {
    const n = nombre(v);
    return n === null ? v : Math.trunc(n);
  }
  if (base === "Numeric") {
    const n = nombre(v);
    return n === null ? v : n;
  }
  if (base === "RefList" || base === "ChoiceList" || base === "Attachments") return liste(v);
  if (base === "Ref") {
    const n = nombre(v);
    return n === null ? v : Math.trunc(n);
  }
  if (v instanceof Date) return isoDate(v) || "";
  return v;
}

/* ------------------------------------------------------------------ */
/* Construction de la source                                           */
/* ------------------------------------------------------------------ */

/** Une feuille : les lignes brutes d'un tableau, et sa table cible. */
function nouvelleFeuille(cle, nom, tableau, { nomForce = false } = {}) {
  const entetes = (tableau[0] || []).map((c) => (c === null || c === undefined ? "" : String(c).trim()));
  const colonnes = entetes.filter((c) => c !== "");
  const cible = nomForce && SCHEMA[nom] ? { table: nom, score: 1000 } : detecterTable(nom, colonnes);
  const lignes = [];
  for (let i = 1; i < tableau.length; i++) {
    const brute = tableau[i] || [];
    const ligne = {};
    let vide = true;
    entetes.forEach((entete, j) => {
      if (!entete) return;
      const v = brute[j];
      if (v === null || v === undefined || v === "") return;
      ligne[entete] = v;
      vide = false;
    });
    if (!vide) lignes.push(ligne);
  }
  return {
    cle, nom, colonnes, lignes,
    cible: cible.table,
  };
}

/**
 * Source de l'import, construite à partir des feuilles et de leur
 * affectation. Les en-têtes sont ramenés aux identifiants de colonnes du
 * modèle, les valeurs au type attendu, et les références écrites en toutes
 * lettres (export Grist) sont rapprochées des lignes du même fichier.
 */
export function construireSource(feuilles) {
  const parTable = new Map();
  (feuilles || []).forEach((feuille, i) => {
    const table = feuille.cible;
    if (!table || !SCHEMA[table]) return;
    const def = SCHEMA[table];
    const parColonne = new Map(def.columns.map((c) => [c.id, c]));
    if (!parTable.has(table)) parTable.set(table, []);
    const lot = parTable.get(table);
    feuille.lignes.forEach((brute, j) => {
      const ligne = {};
      for (const [entete, valeur] of Object.entries(brute)) {
        const colonne = correspondance(table, entete) || entete;
        const c = parColonne.get(colonne);
        ligne[colonne] = c ? auType(valeur, c.type) : valeur;
      }
      if (!Object.keys(ligne).length) return;
      lot.push({ ligne, cle: `#${i}-${j + 1}` });
    });
  });

  // Un fichier exporté ne porte pas l'identifiant des lignes : l'outil en
  // attribue un, à la suite des identifiants présents, pour que les liens
  // internes à la source se résolvent comme dans un document Grist.
  const source = {};
  for (const [table, lot] of parTable) {
    let suivant = 1;
    for (const item of lot) {
      const n = Number(item.ligne.id);
      if (Number.isFinite(n) && n >= suivant) suivant = Math.floor(n) + 1;
    }
    source[table] = lot.map((item) => {
      if (item.ligne.id === undefined || item.ligne.id === "") item.ligne.id = suivant++;
      return item.ligne;
    });
  }
  resoudreRefsTexte(source);
  return source;
}

/**
 * Rapproche les références écrites en toutes lettres.
 *
 * Un export de Grist n'écrit pas l'identifiant d'une référence, mais le
 * libellé de la ligne visée. Quand la table visée se trouve dans le même
 * fichier — c'est le cas d'un classeur exporté depuis le document — le lien
 * est rétabli ici. Une valeur qui désigne deux lignes n'est pas devinée : la
 * colonne reste en texte, et l'application de l'import la signalera.
 */
function resoudreRefsTexte(source) {
  const index = new Map();
  const indexDe = (table) => {
    if (index.has(table)) return index.get(table);
    const def = SCHEMA[table];
    const lignes = source[table] || [];
    const prioritaires = [def.display, "Nom_complet", "Numero", "Intitule_de_la_section", "Libelle",
      "Structure", "Nom", "NOM", "Prenom", "Email", "Identifiant", "Nom_libre"];
    const rang = (id) => {
      const i = prioritaires.indexOf(id);
      return i < 0 ? prioritaires.length : i;
    };
    // Colonnes calculées comprises : un export de Grist les contient, et leurs
    // valeurs sont précisément celles que citent les références.
    const colonnes = def.columns
      .filter((c) => ["Text", "Choice", "LongText", "Any"].includes(c.type || "Text"))
      .map((c) => c.id)
      .sort((a, b) => rang(a) - rang(b));
    const parCle = new Map();
    const vues = new Map();
    for (const ligne of lignes) {
      for (const col of colonnes) {
        const v = ligne[col];
        if (typeof v !== "string" || v.length < 3) continue;
        const n = norm(v);
        if (!n) continue;
        if (parCle.has(n)) { vues.set(n, true); continue; }
        parCle.set(n, ligne.id);
      }
    }
    for (const n of vues.keys()) parCle.delete(n);
    index.set(table, parCle);
    return parCle;
  };

  for (const [table, lignes] of Object.entries(source)) {
    const def = SCHEMA[table];
    if (!def) continue;
    for (const c of def.columns) {
      const m = /^Ref(List)?:([A-Za-z_]+)$/.exec(c.type || "");
      if (!m) continue;
      const cible = m[2];
      if (!SCHEMA[cible] || !(source[cible] || []).length) continue;
      const parCle = indexDe(cible);
      for (const ligne of lignes) {
        const v = ligne[c.id];
        if (v === undefined || v === null || v === "") continue;
        if (m[1]) {
          const trouve = [];
          for (const item of liste(v)) {
            const n = typeof item === "number" ? item : nombre(item);
            if (n !== null && n !== undefined) { trouve.push(n); continue; }
            const id = parCle.get(norm(item));
            if (id !== undefined) trouve.push(id);
          }
          if (trouve.length) ligne[c.id] = trouve;
        } else if (typeof v === "string") {
          const n = nombre(v);
          if (n !== null) { ligne[c.id] = n; continue; }
          const id = parCle.get(norm(v));
          if (id !== undefined) ligne[c.id] = id;
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Lecture d'un fichier                                                */
/* ------------------------------------------------------------------ */

/**
 * Lit un fichier et renvoie ses feuilles, prêtes à être affectées aux tables
 * de l'outil : `{ label, format, feuilles }`. `onProgres(message)` est appelé
 * pendant les étapes longues (ouverture d'un classeur ou d'un document Grist).
 */
export async function lireFichier(file, { onProgres } = {}) {
  const annonce = onProgres || (() => {});
  const nom = String(file?.name || "");
  const format = formatDeFichier(nom);
  if (!format) throw new Error(`Fichier non reconnu. ${FORMATS_AIDE}`);

  if (format === "json") {
    const texte = await lireTexte(file);
    return { label: nom, format, feuilles: feuillesJson(texte) };
  }
  if (format === "csv") {
    const texte = await lireTexte(file);
    return { label: nom, format, feuilles: feuillesCsv(texte, nom) };
  }
  if (format === "classeur") {
    annonce("Ouverture du classeur…");
    const buffer = await file.arrayBuffer();
    return { label: nom, format, feuilles: await feuillesClasseur(buffer, nom, annonce) };
  }
  annonce("Ouverture du document Grist…");
  const buffer = await file.arrayBuffer();
  return { label: nom, format, feuilles: await feuillesGrist(buffer, annonce) };
}

/** Décode un texte, en rattrapant l'encodage des tableurs (Windows-1252). */
export async function lireTexte(file) {
  const octets = new Uint8Array(await file.arrayBuffer());
  if (octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(octets.subarray(3));
  }
  const utf8 = new TextDecoder("utf-8").decode(octets);
  if (utf8.includes("\uFFFD")) return new TextDecoder("windows-1252").decode(octets);
  return utf8;
}

function feuillesJson(texte) {
  let parsed;
  try {
    parsed = JSON.parse(texte);
  } catch (err) {
    throw new Error(`Fichier JSON illisible : ${err.message}`);
  }
  const tables = parsed?.tables || parsed;
  if (!tables || typeof tables !== "object") throw new Error("Ce fichier JSON ne contient aucune table.");
  const feuilles = [];
  Object.entries(tables).forEach(([table, lignes], i) => {
    if (!Array.isArray(lignes) || !lignes.length) return;
    const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l || {})))];
    const tableau = [colonnes, ...lignes.map((l) => colonnes.map((c) => l?.[c]))];
    feuilles.push(nouvelleFeuille(`json:${i}`, table, tableau, { nomForce: true }));
  });
  if (!feuilles.length) throw new Error("Ce fichier JSON ne contient aucune table.");
  return feuilles;
}

/** Découpe un texte délimité, guillemets compris. */
function decouper(texte, separateur) {
  const lignes = [];
  let ligne = [];
  let champ = "";
  let cite = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (cite) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; } else { cite = false; }
      } else champ += c;
      continue;
    }
    if (c === '"' && champ === "") { cite = true; continue; }
    if (c === separateur) { ligne.push(champ); champ = ""; continue; }
    if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; continue; }
    if (c === "\r") continue;
    champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

/** Séparateur le plus probable : celui qui découpe le plus la première ligne. */
function separateurDe(texte) {
  const premiere = texte.split(/\r?\n/).find((l) => l.trim()) || "";
  const compte = [["\t", (premiere.match(/\t/g) || []).length], [";", (premiere.match(/;/g) || []).length],
    [",", (premiere.match(/,/g) || []).length], ["|", (premiere.match(/\|/g) || []).length]];
  compte.sort((a, b) => b[1] - a[1]);
  return compte[0][1] ? compte[0][0] : ";";
}

function feuillesCsv(texte, nom) {
  const brut = String(texte ?? "").replace(/^\uFEFF/, "");
  if (!brut.trim()) throw new Error("Le fichier est vide.");
  const lignes = decouper(brut, separateurDe(brut)).filter((l) => l.some((c) => String(c).trim()));
  if (!lignes.length) throw new Error("Le fichier ne contient aucune ligne.");
  // Le nom du fichier est celui de la table, dans un export Grist.
  const court = norm(nom.replace(/\.[^.]+$/, ""));
  const table = Object.keys(SCHEMA).find((t) => norm(t) === court || norm(SCHEMA[t].label) === court) || nom.replace(/\.[^.]+$/, "");
  return [nouvelleFeuille("csv:0", table, lignes)];
}

/* ------------------------------------------------------------------ */
/* Classeur (.xlsx, .xls, .ods)                                        */
/* ------------------------------------------------------------------ */

async function feuillesClasseur(buffer, nom, annonce) {
  let XLSX;
  try {
    XLSX = await import(SHEETJS_MODULE);
  } catch (err) {
    throw new Error(`Le lecteur de classeur n'a pas pu être chargé (${err.message}). `
      + "Vérifiez la connexion, ou exportez la table au format CSV.");
  }
  let classeur;
  try {
    classeur = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  } catch (err) {
    throw new Error(`Classeur illisible : ${err.message}`);
  }
  const feuilles = [];
  classeur.SheetNames.forEach((nomFeuille, i) => {
    const source = classeur.Sheets[nomFeuille];
    if (!source || !source["!ref"]) return;
    const tableau = XLSX.utils.sheet_to_json(source, { header: 1, raw: true, defval: null, blankrows: false });
    if (!tableau.length) return;
    feuilles.push(nouvelleFeuille(`classeur:${i}`, nomFeuille, tableau));
  });
  if (!feuilles.length) throw new Error(`Aucune feuille exploitable dans « ${nom} ».`);
  annonce("");
  return feuilles;
}

/* ------------------------------------------------------------------ */
/* Document Grist (.grist)                                             */
/* ------------------------------------------------------------------ */

/** Décompresse un flux gzip, si le fichier a été compressé par Grist. */
async function decompresser(octets) {
  if (octets.length < 2 || octets[0] !== 0x1f || octets[1] !== 0x8b) return octets;
  if (typeof DecompressionStream !== "function") {
    throw new Error("Ce document Grist est compressé, et ce navigateur ne sait pas le décompresser. "
      + "Ouvrez-le dans Grist, puis exportez ses tables au format CSV.");
  }
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

const ENTETE_SQLITE = "SQLite format 3";

async function feuillesGrist(buffer, annonce) {
  const octets = await decompresser(new Uint8Array(buffer));
  const entete = new TextDecoder("latin1").decode(octets.subarray(0, 16));
  if (!entete.startsWith(ENTETE_SQLITE)) {
    // La signature lue est jointe au message : elle dit du premier coup d'œil
    // si le fichier est d'un autre format (ZIP d'un classeur, texte, etc.), ce
    // qu'aucun autre indice ne permet de deviner.
    const signature = entete.replace(/[^\x20-\x7e]/g, "·").slice(0, 16);
    throw new Error("Ce fichier n'est pas un document Grist lisible (base SQLite attendue) — "
      + `signature lue : « ${signature} ». Un fichier « .grist » s'obtient par « Télécharger » `
      + "depuis Grist ; un export tabulaire se reprend au format CSV ou classeur.");
  }
  let initSqlJs;
  try {
    initSqlJs = (await import(SQLJS_MODULE)).default;
  } catch (err) {
    throw new Error(`Le lecteur de base SQLite n'a pas pu être chargé (${err.message}).`);
  }
  annonce("Préparation du moteur SQLite…");
  const SQL = await initSqlJs({ locateFile: (f) => SQLJS_WASM + f });
  let db;
  try {
    db = new SQL.Database(octets);
  } catch (err) {
    throw new Error(`Base illisible : ${err.message}`);
  }
  try {
    return await lireTablesGrist(db, annonce);
  } finally {
    db.close();
  }
}

function interroger(db, sql) {
  const r = db.exec(sql);
  if (!r.length) return { columns: [], values: [] };
  return { columns: r[0].columns, values: r[0].values };
}

async function lireTablesGrist(db, annonce) {
  const physique = interroger(db, "SELECT name FROM sqlite_master WHERE type='table'")
    .values.flat().filter((n) => !n.startsWith("sqlite_"));

  // Métadonnées du document, si c'est bien un document Grist : le nom de chaque
  // table et le type de chacune de ses colonnes.
  const types = new Map();
  let nomsDesTables = new Map();
  try {
    nomsDesTables = new Map(interroger(db, "SELECT id, tableId FROM _grist_Tables").values.map(([id, t]) => [id, t]));
    const colonnes = interroger(db, "SELECT parentId, colId, type, isFormula FROM _grist_Tables_column").values;
    for (const [parentId, colId, type, isFormula] of colonnes) {
      const table = nomsDesTables.get(parentId);
      if (!table) continue;
      if (!types.has(table)) types.set(table, new Map());
      types.get(table).set(colId, { type, isFormula });
    }
  } catch { /* fichier SQLite sans métadonnées Grist : les types seront devinés */ }

  // Les tables internes de Grist sont écartées, ainsi que celles que l'outil
  // gère lui-même sans qu'elles appartiennent au modèle (la table des
  // utilisateurs, `GristHidden_Utilisateurs`) : elles ne sont pas des données
  // à importer.
  const tables = physique.filter((n) => !n.startsWith("_grist") && !n.startsWith("_gristsys")
    && !(n.startsWith(HIDDEN_PREFIX) && !SCHEMA[n.slice(HIDDEN_PREFIX.length)]));
  const feuilles = [];
  let rang = 0;
  for (const table of tables) {
    rang++;
    annonce(`Lecture : ${table} (${rang}/${tables.length})…`);
    await new Promise((r) => setTimeout(r, 0));
    const connues = types.get(table) || new Map();
    let donnees;
    try {
      donnees = interroger(db, `SELECT * FROM "${table.replace(/"/g, '""')}"`);
    } catch { continue; }
    if (!donnees.columns.length) continue;
    const colonnes = donnees.columns.filter((c) => c !== "manualSort");
    const ligneEntete = colonnes.map((c) => c);
    const tableau = [ligneEntete];
    for (const brute of donnees.values) {
      const parColonne = new Map(donnees.columns.map((c, i) => [c, brute[i]]));
      tableau.push(colonnes.map((c) => decoderGrist(parColonne.get(c), connues.get(c)?.type, c)));
    }
    const reel = table.startsWith(HIDDEN_PREFIX) ? table.slice(HIDDEN_PREFIX.length) : table;
    feuilles.push(nouvelleFeuille(`grist:${rang - 1}`, SCHEMA[reel] ? reel : table, tableau));
  }
  annonce("");
  if (!feuilles.length) throw new Error("Ce document ne contient aucune table lisible.");
  return feuilles;
}

/** Une valeur de la base SQLite, ramenée à ce que l'outil attend. */
function decoderGrist(v, type, colonne) {
  if (colonne === "id") return v === null || v === undefined ? "" : v;
  if (v === null || v === undefined) return "";
  if (v instanceof Uint8Array) return "";
  const base = String(type || "").split(":")[0];
  if (base === "Date") return isoDate(v) || "";
  if (base === "DateTime") return dateHeureIso(v);
  if (base === "Bool") return v === 1 || v === true;
  if (base === "RefList" || base === "ChoiceList" || base === "Attachments") return liste(v);
  if (typeof v === "string" && v.startsWith("[")) return liste(v);
  return v;
}
