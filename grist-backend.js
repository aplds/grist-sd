// Intégration Grist.
//
// Lorsque la page est ouverte comme widget personnalisé à l'intérieur d'un
// document Grist, les tables du document deviennent la base de données de
// l'application : lecture au chargement, écriture à chaque modification.
// Hors de Grist, ce module est inerte et l'application fonctionne en mode
// autonome (localStorage).

import { SCHEMA, isLegacyTable, migrerDb } from "./schema.js";
import { roleFromGristAccess } from "./roles.js";

export function gristAvailable() {
  return typeof window !== "undefined" && !!window.grist && typeof window.grist.ready === "function";
}

/* ------------------------------------------------------------------ */
/* Noms des tables dans le document                                    */
/* ------------------------------------------------------------------ */
/*
 * Grist retire de son interface toute table dont l'identifiant commence par
 * `GristHidden_` : elle disparaît du sélecteur de widgets, de la page
 * « Données brutes » et de la barre d'onglets. C'est précisément ce que
 * l'outil veut — le document sert de base de données, l'outil en est
 * l'interface. Une table laissée visible inviterait à la saisie directe, qui
 * contournerait les contrôles de régularité, les colonnes calculées, la
 * journalisation et l'attribution des affaires.
 *
 * Le préfixe ne change que le nom de **stockage** : l'outil continue de
 * raisonner sur les noms courts (`Affaires`, `Decisions`, …), et la traduction
 * se fait aux portes d'entrée et de sortie de Grist (voir `physique`). Les
 * tables du modèle de l'outil sont créées masquées ; les tables d'héritage
 * (`Commissions`), qui appartiennent au document, ne sont jamais touchées.
 */

/** Préfixe qui retire une table de l'interface de Grist. */
export const HIDDEN_PREFIX = "GristHidden_";

/** Nom de stockage d'une table du modèle dans le document. */
function tableStockage(nom) {
  if (isLegacyTable(nom)) return nom;
  return nom.startsWith(HIDDEN_PREFIX) ? nom : HIDDEN_PREFIX + nom;
}

/** Table du modèle portée par un nom de table du document, sinon `null`. */
function tableDuModele(nomPhysique) {
  const nom = String(nomPhysique || "");
  if (!nom) return null;
  const court = nom.startsWith(HIDDEN_PREFIX) ? nom.slice(HIDDEN_PREFIX.length) : nom;
  return SCHEMA[court] ? court : null;
}

/**
 * Tables annoncées par le document, dans les noms du modèle.
 * Un nom masqué (`GristHidden_Affaires`) comme un nom resté court
 * (`Affaires`) donnent le même résultat : « Affaires ». Les tables étrangères
 * au modèle — `Commissions` d'un document d'origine, `GristHidden_Utilisateurs`
 * — sont rendues telles quelles.
 */
function tablesDuModele(liste) {
  return (liste || []).map((nom) => tableDuModele(nom) || nom);
}

/* Nom de stockage effectif de chaque table, tel qu'il existe — ou existera —
   dans le document. Renseigné à chaque liaison par `resoudreNomsDeTables` :
   une table encore présente sous son nom court (document créé avant l'adoption
   du préfixe, ou renommage refusé) est lue et écrite sous ce nom-là. */
const nomsPhysiques = new Map();

/** Nom sous lequel une table du modèle vit dans le document. */
function physique(nom) {
  return nomsPhysiques.get(nom) || tableStockage(nom);
}

/**
 * Résout le nom de stockage de chaque table du modèle, et masque celles qui ne
 * le sont pas encore.
 *
 * Un document constitué avant l'adoption du préfixe porte ses tables sous leur
 * nom court : elles sont renommées une fois pour toutes (`RenameTable`), Grist
 * mettant à jour au passage les colonnes de référence et les formules qui les
 * nomment. Le renommage touche le **schéma** : une personne qui n'a le droit de
 * modifier que les données le verra refusé — l'outil continue alors de lire et
 * d'écrire ces tables sous leur nom court, seules leurs tables restant
 * visibles dans Grist. Jamais une donnée n'est perdue pour autant.
 */
async function resoudreNomsDeTables(grist, liste) {
  const renommages = [];
  for (const nom of Object.keys(SCHEMA)) {
    if (isLegacyTable(nom)) { nomsPhysiques.set(nom, nom); continue; }
    const stockage = tableStockage(nom);
    if (liste.includes(stockage)) { nomsPhysiques.set(nom, stockage); continue; }
    if (liste.includes(nom)) { nomsPhysiques.set(nom, nom); renommages.push([nom, stockage]); continue; }
    nomsPhysiques.set(nom, stockage); // table à créer : elle naîtra masquée
  }
  if (!renommages.length) return { renommees: [] };

  try {
    await withTimeout(
      grist.docApi.applyUserActions(renommages.map(([avant, apres]) => ["RenameTable", avant, apres])),
      WRITE_TIMEOUT_MS, "le document n'a pas répondu au renommage des tables",
    );
    for (const [avant, apres] of renommages) nomsPhysiques.set(avant, apres);
    note("connexion", "tables masquées dans Grist", renommages.map(([a, b]) => `${a} → ${b}`).join(", "));
    return { renommees: renommages.map(([avant]) => avant) };
  } catch (err) {
    console.warn("Renommage des tables refusé en bloc, reprise table par table :", err);
    note("connexion", "renommage refusé en bloc", (err && err.message) || err);
  }

  const faites = [];
  const refusees = [];
  for (const [avant, apres] of renommages) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await withTimeout(grist.docApi.applyUserActions([["RenameTable", avant, apres]]),
        WRITE_TIMEOUT_MS, "le document n'a pas répondu au renommage");
      nomsPhysiques.set(avant, apres);
      faites.push(avant);
    } catch (err) {
      nomsPhysiques.set(avant, avant);
      refusees.push(`${avant} : ${(err && err.message) || err}`);
    }
  }
  if (faites.length) note("connexion", "tables masquées dans Grist", faites.join(", "));
  if (refusees.length) {
    // Le renommage appartient au schéma : sans ce droit, les tables restent
    // visibles dans Grist. C'est un désagrément, jamais une panne.
    console.warn("Tables laissées visibles dans Grist :", refusees.join(" ; "));
    note("connexion", "renommage refusé", refusees.join(" ; "));
  }
  return { renommees: faites, refusees };
}

/**
 * Tables dont le document doit disposer pour que l'outil fonctionne.
 *
 * Les tables marquées `optional` dans le schéma — l'identité de l'en-tête, par
 * exemple, apparue après coup — n'en font pas partie : un document plus ancien
 * reste utilisable en l'état, et l'outil propose de créer la table au moment
 * où l'on veut s'en servir (voir `documentTables`).
 */
function requiredTables() {
  // Les tables d'héritage (`Commissions`) sont lues si elles existent, mais
  // jamais exigées : un document neuf ne les crée pas, et un document
  // d'origine reste utilisable sans qu'on ait à les lui ajouter.
  return Object.keys(SCHEMA).filter((name) => !SCHEMA[name].optional && !isLegacyTable(name));
}

/**
 * Tables du document Grist, telles que Grist les a annoncées. `null` tant que
 * la liaison n'a pas abouti. Sert à distinguer une table absente du document
 * (à créer) d'une table simplement vide.
 */
let documentTableList = null;

export function documentTables() {
  return documentTableList;
}

/**
 * La page est-elle affichée dans un cadre qui n'est pas le premier niveau ?
 *
 * L'API du widget Grist ne dialogue qu'avec son **parent immédiat** : le
 * cadre de l'outil doit donc être posé directement dans le document Grist.
 * Si l'adresse collée dans le widget est celle d'une page qui contient
 * elle-même l'outil (l'adresse `perchance.org/nom-du-generateur`, par
 * exemple, encadre le générateur), aucune réponse ne peut revenir de Grist.
 * Ce test alimente le message d'erreur, pour ne pas laisser croire à un
 * document en panne alors que c'est l'adresse du widget qui est en cause.
 */
export function nestedFrame() {
  try {
    return typeof window !== "undefined" && window.parent !== window.top;
  } catch {
    return false;
  }
}

/** Les écritures vers le document sont-elles autorisées (rôle, liaison) ? */
export function writesEnabled() {
  return writesAllowed;
}

const GRIST_API_DEFAULT = "https://docs.getgrist.com/grist-plugin-api.js";
const GRIST_API_PATH = "/grist-plugin-api.js";

/**
 * Origines **autorisées** à servir l'API du widget (NC-0011, NC-0023).
 *
 * L'API du widget est un script exécuté dans la page de l'outil. La lire à
 * l'origine du `Referer` reviendrait à exécuter le script d'une page tierce,
 * quelle qu'elle soit — or l'adresse d'un widget est publique, et rien
 * n'empêche une page hostile d'encadrer l'outil. Seules sont donc acceptées :
 *
 *   · les origines reconnues de Grist — le service public `docs.getgrist.com`
 *     et `getgrist.com`, plus l'instance souveraine de l'État français
 *     `grist.numerique.gouv.fr` (hébergée par la DINUM), qu'un établissement
 *     public utilise sans réglage ;
 *   · celles qu'un déploiement déclare explicitement, pour une instance
 *     auto-hébergée — par `window.GRIST_ALLOWED_ORIGINS` (tableau), par une
 *     balise `<meta name="grist-origins" content="grist.exemple.fr">` posée
 *     dans `index.html`, ou depuis Réglages › Données › Serveur Grist déclaré
 *     (voir `definirOriginesGristDeclarees`).
 *
 * Tout autre référent est refusé : on se rabat alors sur l'adresse par défaut.
 */
const GRIST_ORIGINS_DEFAUT = ["docs.getgrist.com", "getgrist.com", "grist.numerique.gouv.fr"];

/* Origines déclarées depuis l'interface (Réglages › Données), conservées sur
   le poste. Elles rendent praticable l'auto-hébergement sans modifier les
   fichiers : l'établissement saisit l'adresse de son serveur Grist, et cette
   déclaration vaut pour les visites suivantes. */
export const GRIST_ORIGINES_DECLAREES_KEY = "sections-disciplinaires.grist-origines.v1";

/** Origines déclarées sur ce poste (tableau de noms d'hôtes). */
export function originesGristDeclarees() {
  try {
    const brut = localStorage.getItem(GRIST_ORIGINES_DECLAREES_KEY);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.map(normaliserHote).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Enregistre les origines déclarées (noms d'hôtes). Renvoie le tableau retenu. */
export function definirOriginesGristDeclarees(origines) {
  const liste = [...new Set((Array.isArray(origines) ? origines : [origines])
    .map(normaliserHote).filter(Boolean))];
  try {
    if (liste.length) localStorage.setItem(GRIST_ORIGINES_DECLAREES_KEY, JSON.stringify(liste));
    else localStorage.removeItem(GRIST_ORIGINES_DECLAREES_KEY);
  } catch (err) {
    console.warn("Déclaration des origines Grist non conservée :", err);
  }
  return liste;
}

function normaliserHote(valeur) {
  return String(valeur ?? "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/[/#?].*$/, "").replace(/:\d+$/, "");
}

/** Ensemble des hôtes autorisés à servir l'API du widget. */
export function gristOriginsAutorisees() {
  const hotes = new Set(GRIST_ORIGINS_DEFAUT);
  for (const o of originesGristDeclarees()) hotes.add(o);
  if (typeof window !== "undefined" && Array.isArray(window.GRIST_ALLOWED_ORIGINS)) {
    for (const o of window.GRIST_ALLOWED_ORIGINS) hotes.add(normaliserHote(o));
  }
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="grist-origins"]');
    for (const o of String(meta?.content || "").split(/[\s,;]+/)) {
      const h = normaliserHote(o);
      if (h) hotes.add(h);
    }
  }
  return hotes;
}

/**
 * État des origines, pour la ligne de diagnostic (NC-0023) : origine de la
 * page appelante, ensemble des hôtes autorisés, et si le parent est accepté.
 */
export function gristOriginesDiagnostic() {
  let parent = "inconnue";
  try {
    if (document.referrer) parent = new URL(document.referrer).hostname || "inconnue";
  } catch {
    /* référent illisible */
  }
  return {
    parent,
    autorisees: [...gristOriginsAutorisees()].sort().join(", "),
    parentAutorise: parent !== "inconnue" && origineGristAutorisee(parent),
  };
}

/** L'hôte d'une origine est-il autorisé à servir l'API du widget ? */
export function origineGristAutorisee(origine) {
  const hote = normaliserHote(typeof origine === "string" ? origine : origine?.hostname);
  if (!hote) return false;
  return gristOriginsAutorisees().has(hote);
}

/**
 * La page est-elle affichée comme widget à l'intérieur d'un document Grist ?
 *
 * L'API du widget, injectée par Grist lui-même, est la preuve la plus sûre.
 * Sinon on cherche un signe explicite (`?grist` / `#grist`, utile pour une
 * instance auto-hébergée), puis on examine le **nom d'hôte** de la page
 * appelante — et non son adresse entière : un générateur Perchance nommé
 * « grist-… » produit une adresse qui contient « grist » sans être Grist, et
 * l'outil se croirait alors dans un document qui n'existe pas.
 */
export function likelyGrist() {
  if (typeof window === "undefined" || window.self === window.top) return false;
  if (gristAvailable()) return true;
  if (new URLSearchParams(window.location.search).has("grist")) return true;
  if (/([?&]|^)grist(=|&|$)/.test(window.location.hash)) return true;
  try {
    return origineGristAutorisee(new URL(document.referrer));
  } catch {
    return false;
  }
}

let apiPromise = null;

/* Adresse de l'API du widget effectivement retenue (diagnostic). */
export let gristApiUrl = "";

/**
 * Adresses où chercher l'API du widget, dans l'ordre.
 *
 * Le serveur Grist qui héberge le document sert lui-même son API ; c'est donc
 * son adresse qu'il faut essayer d'abord — une instance auto-hébergée n'est
 * pas joignable sur le domaine du service public. L'adresse du serveur Grist
 * se lit dans `Referer` lorsque le navigateur le transmet (un widget affiché
 * dans un cadre reçoit l'adresse de la page appelante). Le service public
 * reste en dernier recours.
 */
function gristApiCandidates() {
  const urls = [];
  try {
    const referent = new URL(document.referrer);
    // L'origine du référent n'est retenue que si elle est **déclarée** comme
    // serveur Grist (NC-0011). Sans cela, une page tierce qui encadrerait
    // l'outil ferait exécuter son propre script dans la page.
    if (/^https?:$/.test(referent.protocol) && origineGristAutorisee(referent)) {
      urls.push(`${referent.origin}${GRIST_API_PATH}`);
    }
  } catch {
    /* Referer absent ou masqué : on se rabat sur le service public. */
  }
  urls.push(GRIST_API_DEFAULT);
  return [...new Set(urls)];
}

/** Charge un script et dit s'il a fourni l'API. */
function loadScript(url, timeoutMs) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (!value) script.remove();
      resolve(value);
    };
    script.src = url;
    script.onload = () => finish(gristAvailable());
    script.onerror = () => finish(false);
    document.head.appendChild(script);
    setTimeout(() => finish(gristAvailable()), timeoutMs);
  });
}

/**
 * Charge l'API du widget Grist (une seule fois). `gristApiUrl` retient celle
 * qui a répondu, ou la liste de celles qui ont été essayées — c'est ce que
 * montre le diagnostic lorsque le chargement échoue.
 */
export async function loadGristApi(timeoutMs = 5000) {
  if (gristAvailable()) {
    gristApiUrl = "fournie par la page";
    return true;
  }
  if (apiPromise) return apiPromise;
  apiPromise = (async () => {
    const candidates = gristApiCandidates();
    for (const url of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await loadScript(url, timeoutMs)) {
        gristApiUrl = url;
        return true;
      }
    }
    gristApiUrl = candidates.join(", ");
    return false;
  })();
  return apiPromise;
}

/**
 * Oublie l'essai précédent (NC-0023) : après la déclaration d'un serveur Grist
 * auto-hébergé, le chargement suivant doit relire les origines autorisées au
 * lieu de rendre le résultat — négatif — de la tentative passée.
 */
export function resetGristApi() {
  apiPromise = null;
  gristApiUrl = "";
}

function isoDate(ts) {
  if (ts === null || ts === undefined || ts === 0) return null;
  const d = new Date(Number(ts) * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toGrist(def, value) {
  const type = def?.type || "Text";
  if (value === null || value === undefined || value === "") {
    if (type === "Bool") return false;
    if (type.startsWith("RefList:")) return [];
    return null;
  }
  if (type === "Bool") return Boolean(value);
  if (type === "Date") return Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000);
  if (type === "Int") return Math.round(Number(value));
  if (type === "Numeric") return Number(value);
  if (type.startsWith("Ref:")) {
    const id = Number(value);
    return id ? mapId(refTable(def), id) : null;
  }
  if (type.startsWith("RefList:")) {
    const target = refTable(def);
    const ids = Array.isArray(value) ? value : String(value).replace(/[[\]]/g, "").split(",");
    return ids.map((v) => Number(v)).filter((v) => v).map((v) => mapId(target, v));
  }
  return String(value);
}

function fromGrist(def, value) {
  const type = def?.type || "Text";
  if (value === null || value === undefined) return null;
  if (type === "Date") {
    const s = typeof value === "number" ? isoDate(value) : String(value).slice(0, 10);
    return s;
  }
  return value;
}

function columnsToRecords(tableDef, cols) {
  const rows = Array.isArray(cols.id) ? cols.id.length : 0;
  const out = [];
  for (let i = 0; i < rows; i += 1) {
    const rec = {};
    for (const def of tableDef.columns) {
      if (!(def.id in cols)) continue;
      rec[def.id] = fromGrist(def, cols[def.id][i]);
    }
    rec.id = cols.id[i];
    out.push(rec);
  }
  return out;
}

/**
 * Tables et colonnes réellement présentes dans le document, lues dans les
 * tables internes de Grist (« _grist_Tables », « _grist_Tables_column »).
 * `ok` vaut `false` si ces tables n'ont pas pu être lues : les appelants
 * doivent alors s'abstenir de créer quoi que ce soit, faute de pouvoir savoir
 * ce qui existe déjà.
 */
async function fetchColumnMeta(grist) {
  const meta = { tables: {}, columns: {}, ok: false };
  try {
    const tables = await grist.docApi.fetchTable("_grist_Tables");
    (tables.id || []).forEach((id, i) => {
      meta.tables[tables.tableId[i]] = id;
    });
    const cols = await grist.docApi.fetchTable("_grist_Tables_column");
    (cols.id || []).forEach((id, i) => {
      const parent = cols.parentId[i];
      const tableId = Object.keys(meta.tables).find((t) => meta.tables[t] === parent);
      if (!tableId) return;
      // Table nommée comme le modèle la connaît : les noms de stockage
      // (`GristHidden_Affaires`) ne doivent pas déborder dans les comparaisons
      // ni dans le journal de diagnostic.
      meta.columns[`${tableDuModele(tableId) || tableId}.${cols.colId[i]}`] = {
        isFormula: !!cols.isFormula[i],
        type: cols.type[i],
        formula: cols.formula ? String(cols.formula[i] ?? "") : "",
      };
    });
    meta.ok = true;
  } catch (err) {
    console.warn("Métadonnées de colonnes indisponibles :", err);
  }
  return meta;
}

/**
 * Colonnes attendues par l'outil, sous la forme « Table.Colonne ».
 * Les colonnes d'une table absente du document sont ignorées : elles seront
 * créées en même temps que la table (voir `installStructure`).
 */
function expectedColumns(existing) {
  const out = [];
  for (const [name, def] of Object.entries(SCHEMA)) {
    if (isLegacyTable(name)) continue;
    if (existing && !existing.includes(name)) continue;
    // Une colonne marquée `ancien` est lue si le document la porte — c'est
    // d'elle que la reprise tire la feuille de style d'un format — mais elle
    // n'est jamais réclamée ni créée : sa disparition ne fait rien échouer.
    for (const c of def.columns) {
      if (c.ancien) continue;
      out.push(`${name}.${c.id}`);
    }
  }
  return out;
}

/**
 * Colonnes du modèle absentes d'un document qui a pourtant toutes les tables.
 *
 * Un document peut avoir les bonnes tables sans toutes leurs colonnes — une
 * colonne supprimée à la main, ou créée par une version antérieure de
 * l'outil. Ces manques ne sont pas visibles à la lecture (les champs absents
 * restent vides), mais ils font **échouer les écritures** : Grist refuse un
 * enregistrement qui nomme une colonne inexistante, et surtout une formule du
 * document qui s'y réfère échoue (« [Sandbox] KeyError ») dès qu'une ligne est
 * recalculée. Mieux vaut donc les détecter au branchement que de laisser
 * croire que les saisies n'arrivent pas.
 *
 * Renvoie `[]` si les tables internes de Grist n'ont pas pu être lues : faute
 * de certitude, on ne signale rien.
 */
async function detectMissingColumns(grist, tableList) {
  try {
    const { columns, ok } = await fetchColumnMeta(grist);
    if (!ok) {
      note("structure", "métadonnées de colonnes", "illisibles (accès insuffisant ?)");
      return [];
    }
    documentColumnMeta = columns;
    return expectedColumns(tableList).filter((id) => !columns[id]);
  } catch (err) {
    console.warn("Vérification des colonnes du document impossible :", err);
    note("structure", "métadonnées de colonnes", `échec : ${(err && err.message) || err}`);
    return [];
  }
}

let gristRef = null;
let readySent = false;

/* Niveau d'accès accordé au widget par Grist : « none », « read table » ou
   « full ». Un widget en « read table » ne peut lire que la table sélectionnée,
   ce qui empêche l'outil de fonctionner : l'information sert au diagnostic. */
export let widgetAccessLevel = "";

/* Grist attribue lui-même les identifiants de lignes. Comme l'application
   travaille avec ses propres identifiants locaux (stables, y compris avant
   que Grist n'ait répondu), on conserve une table de correspondance
   local → Grist pour chaque table. Les écritures sont enchaînées afin
   qu'une référence créée juste avant soit toujours traduite correctement. */
const idMap = {};
let writeChain = Promise.resolve();

/* Les droits de l'utilisateur ne sont connus qu'après son identification :
   tant qu'elle n'a pas établi qu'il peut écrire, on n'expédie rien. */
let writesAllowed = true;

/* Dernière erreur renvoyée par le document. Elle n'est jamais silencieuse :
   l'application l'affiche (bandeau + notification), sinon l'utilisateur
   croirait ses modifications enregistrées alors qu'elles restent locales. */
export let lastWriteError = "";
let writeReporter = null;

/** Branche le signalement des pannes d'écriture sur l'interface. */
export function setWriteReporter(fn) {
  writeReporter = fn;
}

/* ------------------------------------------------------------------ */
/* Écritures en attente                                                */
/* ------------------------------------------------------------------ */
/*
 * Une écriture refusée par le document — panne de réseau, droit retiré,
 * colonne manquante — ne doit pas disparaître en silence : elle resterait dans
 * la base de travail du navigateur, et le document, lui, ne l'aurait jamais
 * reçue. Le rechargement suivant relit le document et l'efface. La
 * modification est donc **retenue** ici, rejouable d'un clic tant que la page
 * reste ouverte ; les identifiants locaux (négatifs) qu'elle porte sont encore
 * valides à ce moment-là, ce qui n'est plus vrai après un rechargement — d'où
 * l'avertissement affiché avant de quitter la page (voir `app.js`).
 *
 * Les écritures d'une même ligne se fusionnent : dix modifications successives
 * d'une fiche pendant une panne ne font qu'une écriture à rejouer, avec la
 * dernière valeur de chaque champ.
 */

/** Écritures en attente, dans l'ordre où elles ont été tentées. */
let enAttente = [];

/* Écritures d'un lot déjà parti vers le document. Une modification qui arrive
   pendant ce vol ne peut plus se fondre dans la création qu'elle complète — le
   lot est déjà construit et parti — et prend donc sa propre place dans la file,
   pour le lot suivant. */
const enVol = new Set();

function cleEcriture(action) {
  if (action.type === "update") return `update:${action.table}:${action.id}`;
  if (action.type === "delete") return `delete:${action.table}:${action.id}`;
  return `add:${action.table}:${action.id}`;
}

/** Retient une écriture, en fusionnant avec celle déjà en attente (même ligne). */
function retenirEcriture(action) {
  const precedent = enAttente.find((a) => cleEcriture(a) === cleEcriture(action));
  const image = precedent?.type === "update" && precedent.old !== undefined ? precedent.old : action.old;
  enAttente = enAttente.filter((a) => a !== precedent);
  if (action.type === "update") {
    // Une fiche créée puis modifiée pendant la panne : la modification rejoint
    // la création, pour que le rejeu ne dépende pas de l'identifiant du
    // document, encore inconnu.
    const creation = enAttente.find((a) => a.type === "add" && a.table === action.table && Number(a.id) === Number(action.id));
    if (creation && !enVol.has(creation)) {
      creation.data = { ...creation.data, ...action.patch };
      sauvegarderOutbox();
      return;
    }
    enAttente.push(image === undefined ? { ...action } : { ...action, old: image });
    sauvegarderOutbox();
    return;
  }
  if (action.type === "delete") {
    // Une ligne créée puis supprimée pendant la panne n'a jamais existé pour le
    // document : les deux écritures s'annulent. Si la création est déjà partie,
    // en revanche, elle existe bel et bien : la suppression reste à envoyer.
    const creation = enAttente.find((a) => a.type === "add" && a.table === action.table && Number(a.id) === Number(action.id));
    if (creation && !enVol.has(creation)) {
      enAttente = enAttente.filter((a) => a !== creation);
      sauvegarderOutbox();
      return;
    }
  }
  enAttente.push({ ...action });
  sauvegarderOutbox();
}

/** Oublie l'écriture correspondante : le document l'a acceptée. */
function oublierEcriture(action) {
  const cle = cleEcriture(action);
  enAttente = enAttente.filter((a) => cleEcriture(a) !== cle && !(action.type === "add" && a.table === action.table && Number(a.id) === Number(action.id)));
  sauvegarderOutbox();
}

/**
 * Oublie les écritures d'un lot accepté, **à l'identité près**. `oublierEcriture`
 * raisonne par clé (table + ligne) ; un lot, lui, peut avoir été doublé
 * pendant son vol par une modification de la même ligne, qui doit rester en
 * attente — la clé l'effacerait aussi.
 */
function oublierLot(lot) {
  const partis = new Set(lot);
  enAttente = enAttente.filter((a) => !partis.has(a));
  sauvegarderOutbox();
}

const OUTBOX_KEY = "sections-disciplinaires.outbox.v1";

let ecartees = [];

function sauvegarderOutbox() {
  try {
    if (typeof localStorage === "undefined") return;
    const actions = [...enAttente, ...ecartees];
    if (!actions.length) {
      localStorage.removeItem(OUTBOX_KEY);
      return;
    }
    const brut = JSON.stringify({ v: 1, savedAt: new Date().toISOString(), actions });
    if (brut.length > 1024 * 1024) {
      note("écriture", "file d'attente non mémorisée", `${actions.length} écriture(s), ${brut.length} octets : au-delà du plafond de sûreté`);
      return;
    }
    localStorage.setItem(OUTBOX_KEY, brut);
  } catch (err) {
    note("écriture", "file d'attente non mémorisée", (err && err.message) || err);
  }
}

export function lireOutboxBrut() {
  try {
    if (typeof localStorage === "undefined") return [];
    const brut = localStorage.getItem(OUTBOX_KEY);
    if (!brut) return [];
    const actions = JSON.parse(brut)?.actions;
    return Array.isArray(actions) ? actions : [];
  } catch {
    return [];
  }
}

export function effacerOutbox() {
  ecartees = [];
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(OUTBOX_KEY);
  } catch { /* stockage indisponible */
  }
}

export function oublierEcritures() {
  enAttente = [];
  ecartees = [];
  arreterEnvoi();
  sauvegarderOutbox();
}

function valeurReprise(v) {
  return v === undefined || v === "" ? null : v;
}

function valeursEgales(a, b) {
  return JSON.stringify(valeurReprise(a)) === JSON.stringify(valeurReprise(b));
}

export function classerReprises(actions, db) {
  const rejouables = [];
  const conflits = [];
  for (const a of actions || []) {
    if (!a || typeof a !== "object") continue;
    if (a.type === "add") {
      rejouables.push(a);
      continue;
    }
    const rows = (db && db[a.table]) || [];
    const row = rows.find((r) => Number(r.id) === Number(a.id));
    if (!row) {
      conflits.push(a);
      continue;
    }
    if (a.type === "delete") {
      rejouables.push(a);
      continue;
    }
    if (a.type === "update") {
      const patch = a.patch && typeof a.patch === "object" ? a.patch : {};
      const old = a.old && typeof a.old === "object" ? a.old : null;
      const intacte = !old || Object.keys(patch).every((k) => valeursEgales(row[k], old[k]));
      (intacte ? rejouables : conflits).push(a);
      continue;
    }
    conflits.push(a);
  }
  return { rejouables, conflits };
}

export function reprendreOutbox(store) {
  const actions = lireOutboxBrut().filter((a) => !enAttente.some((b) => cleEcriture(b) === cleEcriture(a)));
  if (!actions.length && !ecartees.length) return { rejouables: 0, conflits: [] };
  const { rejouables, conflits } = classerReprises(actions, store.db);
  for (const a of rejouables) {
    if (a.type === "update") {
      const row = store.byId(a.table, Number(a.id));
      if (!row) continue;
      Object.assign(row, a.patch);
      store.toucherTable(a.table);
      store.propagerMiroirs(a.table, row.id, a.patch);
    } else if (a.type === "add" && a.data && typeof a.data === "object") {
      if (store.byId(a.table, Number(a.data.id))) continue;
      store.table(a.table).push({ ...a.data });
      store.toucherTable(a.table);
      store.invaliderIndex(a.table);
      store.propagerMiroirs(a.table, Number(a.data.id), a.data);
      if (Number(a.data.id) < 0) store.uid = Math.max(store.uid || 0, -Number(a.data.id));
    } else if (a.type === "delete") {
      for (const cible of [{ table: a.table, id: a.id }, ...((a.cascade) || [])]) {
        const rows = store.table(cible.table);
        const i = rows.findIndex((r) => Number(r.id) === Number(cible.id));
        if (i === -1) continue;
        rows.splice(i, 1);
        store.toucherTable(cible.table);
        store.invaliderIndex(cible.table);
      }
    }
  }
  store.dirty = true;
  enAttente.push(...rejouables);
  ecartees = conflits;
  sauvegarderOutbox();
  note("écriture", "reprise après rechargement", `${rejouables.length} écriture(s) rejouable(s), ${conflits.length} en conflit`);
  return { rejouables: rejouables.length, conflits };
}

export function demanderEnvoiImmediat() {
  if (!writesAllowed || !enAttente.length || !gristRef) return;
  clearTimeout(minuteurEnvoi);
  minuteurEnvoi = null;
  premierEnAttente = 0;
  writeChain = writeChain.then(viderEnAttente).catch(signalerEchec);
}

/** Nombre d'écritures qui n'ont pas encore atteint le document. */
export function pendingWriteCount() {
  return enAttente.length;
}

/** Tables concernées par les écritures en attente, pour le message affiché. */
export function pendingWriteTables() {
  return [...new Set(enAttente.map((a) => a.table))];
}

/** Écritures en attente, pour le journal de diagnostic. */
export function pendingWrites() {
  return enAttente.map((a) => describeActions([a]));
}

/**
 * Rejoue les écritures en attente, dans l'ordre. Celles que le document
 * accepte sont oubliées ; les autres restent en attente. Renvoie le bilan.
 *
 * L'envoi groupé est mis en attente le temps du rejeu : sans cela, le lot
 * programmé repartirait en même temps, et la même écriture partirait deux fois.
 */
export async function retryPendingWrites() {
  if (!enAttente.length) return { tentees: 0, reussies: 0, restantes: 0 };
  arreterEnvoi();
  // Le rejeu attend le lot déjà en vol, sinon son écriture se perdrait dans le
  // remplacement du contenu par le document.
  try { await writeChain; } catch { /* le vol précédent a déjà signalé son échec */ }
  const aRejouer = enAttente.slice();
  let reussies = 0;
  for (const action of aRejouer) {
    // eslint-disable-next-line no-await-in-loop
    try {
      await applyAction(action);
      oublierEcriture(action);
      reussies += 1;
    } catch (err) {
      note("écriture", `rejeu refusé — ${action.table}`, (err && err.message) || err);
    }
  }
  note("écriture", "rejeu des écritures en attente",
    `${reussies}/${aRejouer.length} écriture(s) transmise(s), ${enAttente.length} restante(s)`);
  if (reussies && !enAttente.length && lastWriteError) {
    lastWriteError = "";
    if (writeReporter) writeReporter("");
  }
  return { tentees: aRejouer.length, reussies, restantes: enAttente.length };
}

/* ------------------------------------------------------------------ */
/* Journal de dépannage                                                */
/* ------------------------------------------------------------------ */
/*
 * Grist n'explique jamais *quelle* action d'un lot a échoué, et l'API widget
 * ne décrit pas le document. Sans trace, un refus d'écriture reste
 * indéchiffrable. Ce journal conserve donc les derniers échanges (connexion,
 * structure, lectures, écritures, refus), que « Réglages › Données › Journal
 * de diagnostic » met en forme pour être transmis tel quel à qui doit
 * comprendre la panne.
 */
const journal = [];
const JOURNAL_MAX = 120;
let journalN = 0;

/** Ajoute une ligne au journal de dépannage (voir `journalEntries`). */
function note(kind, label, details) {
  journalN += 1;
  journal.push({
    n: journalN,
    t: new Date().toISOString(),
    kind,
    label,
    details: details === null || details === undefined ? "" : String(details),
  });
  if (journal.length > JOURNAL_MAX) journal.shift();
}

/** Journal de dépannage, du plus ancien au plus récent. */
export function journalEntries() {
  return journal.slice();
}

/** Ajoute une ligne au journal de dépannage (l'interface s'en sert aussi). */
export function logDiagnostic(kind, label, details) {
  note(kind, label, details);
}

/* Métadonnées des colonnes du document, lues dans ses tables internes
   (« _grist_Tables_column ») : type, caractère calculé et formule. Elles
   servent au journal de diagnostic — c'est là qu'apparaît la formule du
   document qui réclame une colonne absente. */
let documentColumnMeta = null;

/** Colonnes du document : `{ "Table.Colonne": { type, isFormula, formula } }`. */
export function documentColumns() {
  return documentColumnMeta;
}

/* ------------------------------------------------------------------ */
/* Document retenu en lecture seule                                    */
/* ------------------------------------------------------------------ */
/*
 * Le serveur Grist peut retenir un document en **lecture seule** : toutes les
 * modifications sont alors refusées — « No write access, document is
 * read-only » (code `AUTH_NO_EDIT`) — quels que soient les droits de la
 * personne. Grist précise que « seules les modifications sont touchées : le
 * rôle de la personne n'est pas changé », ce qui explique qu'un propriétaire
 * puisse lire le document, y être reconnu administrateur, et pourtant ne rien
 * pouvoir enregistrer.
 *
 * Les raisons possibles sont du ressort du serveur, pas de l'outil : site
 * d'équipe suspendu (abonnement résilié), abonnement en défaut de paiement,
 * plan dépassé (trop de membres), ou instance entière en accès restreint.
 *
 * Grist annonce cet état au widget par le paramètre `readonly` de l'adresse
 * qu'il lui donne ; le refus d'écriture le confirme. Les deux signaux sont
 * donc captés : sans cela, une saisie refusée passerait pour une panne de
 * l'outil, alors que le document est simplement fermé à l'écriture.
 */
let readOnly = false;

/** Le document est-il retenu en lecture seule par le serveur Grist ? */
export function documentReadOnly() {
  return readOnly;
}

/** Ce message d'erreur vient-il d'un document retenu en lecture seule ? */
export function isReadOnlyError(message) {
  return /read-?only|AUTH_NO_EDIT|No write access/i.test(String(message || ""));
}

/** Marque le document comme retenu en lecture seule et l'inscrit au journal. */
function markReadOnly(reason) {
  if (readOnly) return false;
  readOnly = true;
  note("connexion", "document retenu en lecture seule", reason);
  return true;
}

/** Le paramètre `readonly` de l'adresse du widget annonce-t-il cet état ? */
function readOnlyFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("readonly") === "true" || params.get("readOnly") === "true";
  } catch {
    return false;
  }
}



/* Grist répond normalement en quelques centaines de millisecondes. Un délai
   borne l'attente pour que l'application retombe sur son fonctionnement
   local, avec un message clair, plutôt que de rester bloquée sur « chargement »
   lorsque la page n'est pas réellement branchée à un document. */
const HANDSHAKE_TIMEOUT_MS = 10000;
const WRITE_TIMEOUT_MS = 30000;

/* Nombre d'actions envoyées dans un même lot au document. Grist applique un lot
   en bloc : une action par ligne multiplierait les allers-retours, un lot trop
   gros serait refusé. Sert au vidage d'une table (voir `remplacerDocument`). */
const LOT_ECRITURE = 200;

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function mapId(table, localId) {
  const value = idMap[table]?.get(Number(localId));
  return value === undefined ? Number(localId) : value;
}

function registerIds(table, rows) {
  idMap[table] = new Map(rows.map((r) => [Number(r.id), Number(r.id)]));
}

/**
 * Charge toutes les tables du document Grist dans le magasin.
 *
 * Les tables sont lues **en parallèle** : elles sont indépendantes les unes des
 * autres, et les lire à la queue leu leu faisait payer à l'ouverture autant
 * d'allers-retours que le modèle compte de tables — une vingtaine — sur un
 * document qui, lui, sait répondre à plusieurs lectures à la fois. C'est le
 * premier écran de l'outil : il vaut la peine de ne pas l'attendre.
 */
export async function refresh(store) {
  if (!gristRef) return;
  const noms = Object.keys(SCHEMA);
  const lectures = noms.map(async (name) => {
    // Une table d'héritage absente du document est la situation normale : le
    // modèle de l'outil ne la crée pas. La lire quand même remplissait le
    // journal et la console d'une alerte à chaque chargement.
    if (isLegacyTable(name) && documentTableList && !documentTableList.includes(name)) {
      return { name, rows: [] };
    }
    try {
      const cols = await withTimeout(gristRef.docApi.fetchTable(physique(name)), HANDSHAKE_TIMEOUT_MS,
        `le document n'a pas répondu pour la table « ${name} »`);
      return { name, rows: columnsToRecords(SCHEMA[name], cols) };
    } catch (err) {
      console.warn(`Table « ${name} » illisible :`, err);
      note("lecture", `table « ${name} » illisible`, (err && err.message) || err);
      return { name, rows: [], missing: true };
    }
  });

  const db = {};
  const missing = [];
  for (const { name, rows, missing: absente } of await Promise.all(lectures)) {
    db[name] = rows;
    registerIds(name, rows);
    if (absente) missing.push(name);
  }
  store.loadFromDocument(db);
  note("lecture", "tables lues", noms
    .map((t) => `${t}:${db[t].length}`).join(" "));
  return { missing };
}

function refTable(def) {
  const [, target] = String(def?.type || "").split(":");
  return target || null;
}

function addPayload(table, data) {
  const payload = {};
  // Aucune écriture ne part vers une table d'héritage : ses lignes sont lues
  // pour la reprise, jamais modifiées.
  if (isLegacyTable(table)) return payload;
  for (const [key, value] of Object.entries(data)) {
    if (key === "id") continue;
    const def = SCHEMA[table]?.columns.find((c) => c.id === key);
    if (!def || def.formula) continue;
    payload[key] = toGrist(def, value);
  }
  return payload;
}

/** Description lisible d'un lot d'actions d'écriture (journal de dépannage). */
function describeActions(actions) {
  // Les actions nomment les tables telles que le document les connaît ; le
  // journal, lui, parle la langue du modèle.
  const nom = (table) => (typeof table === "string" ? tableDuModele(table) || table : table);
  return actions.map((a) => {
    const champs = a[3] && typeof a[3] === "object" && !Array.isArray(a[3])
      ? ` {${Object.keys(a[3]).join(", ")}}` : "";
    const id = a[2] === null || a[2] === undefined || typeof a[2] === "object" ? "" : ` #${a[2]}`;
    return `${a[0]} ${nom(a[1])}${id}${champs}`;
  }).join(" ; ");
}

async function applyAction(action) {
  if (!writesAllowed) return;
  const { docApi } = gristRef;
  const send = async (actions, what) => {
    note("écriture", what, describeActions(actions));
    try {
      return await withTimeout(
        docApi.applyUserActions(actions), WRITE_TIMEOUT_MS,
        `le document n'a pas répondu à l'enregistrement (${what})`,
      );
    } catch (err) {
      note("écriture", `REFUS — ${what}`, (err && err.message) || err);
      throw err;
    }
  };
  if (isLegacyTable(action.table)) return;
  // Le document connaît les tables sous leur nom de stockage (`GristHidden_…`) ;
  // le nom du modèle reste celui des messages et du journal.
  const table = physique(action.table);
  if (action.type === "add") {
    const result = await send([
      ["AddRecord", table, null, addPayload(action.table, action.data)],
    ], `ajout dans ${action.table}`);
    const newId = result?.retValues?.[0];
    if (newId !== undefined && newId !== null) {
      idMap[action.table]?.set(Number(action.data.id), Number(newId));
    }
    return;
  }
  if (action.type === "update") {
    const payload = addPayload(action.table, action.patch);
    if (!Object.keys(payload).length) return;
    await send([
      ["UpdateRecord", table, mapId(action.table, action.id), payload],
    ], `modification de ${action.table}`);
    return;
  }
  if (action.type === "delete") {
    const actions = [["RemoveRecord", table, mapId(action.table, action.id)]];
    for (const child of action.cascade || []) {
      actions.push(["RemoveRecord", physique(child.table), mapId(child.table, child.id)]);
    }
    await send(actions, `suppression dans ${action.table}`);
    idMap[action.table]?.delete(Number(action.id));
  }
}

/**
 * Branche le magasin sur le document Grist courant.
 * Lève une erreur explicite si la structure attendue est absente.
 */
export async function connectGrist(store) {
  const grist = window.grist;
  gristRef = grist;
  if (!readySent) {
    readySent = true;
    grist.ready({ requiredAccess: "full" });
    if (typeof grist.onOptions === "function") {
      grist.onOptions((options, interaction) => {
        const level = interaction ? interaction.access_level : "";
        if (!level) return;
        widgetAccessLevel = level;
        console.info(`Grist : niveau d'accès accordé au widget « ${level} ».`);
        note("connexion", "niveau d'accès accordé au widget", level);
      });
    }
  }

  const brut = await withTimeout(grist.docApi.listTables(), HANDSHAKE_TIMEOUT_MS,
    "Grist n'a pas répondu : la page n'est pas ouverte comme widget d'un document Grist "
    + "(ou l'autorisation du widget n'a pas été accordée).");
  // Les tables du modèle sont créées masquées dans Grist ; celles d'un document
  // antérieur sont renommées ici, une fois pour toutes (voir
  // `resoudreNomsDeTables`). La liste est ensuite exprimée dans les noms du
  // modèle : c'est sous ces noms que tout le reste de l'outil raisonne.
  const { renommees } = await resoudreNomsDeTables(grist, brut);
  const list = tablesDuModele(brut);
  documentTableList = list;
  note("connexion", "tables annoncées par le document", list.length ? list.join(", ") : "aucune");
  if (readOnlyFromUrl()) {
    markReadOnly("paramètre « readonly=true » de l'adresse donnée au widget par Grist");
  }

  const missing = requiredTables().filter((t) => !list.includes(t));
  if (missing.length) {
    note("connexion", "tables attendues absentes", missing.join(", "));
    const err = new Error(
      `Tables absentes du document : ${missing.join(", ")}.`
    );
    // Marqueur exploité par l'interface : devant un document sans les tables
    // de l'outil, le geste à faire est « Installer la structure », et non
    // « Réessayer la liaison ».
    err.code = "MISSING_TABLES";
    throw err;
  }

  store.mode = "grist";
  await refresh(store);

  store.onGristWrite = installWriteHook(store);
  store.onGristReplace = installReplaceHook(store);

  const missingColumns = await detectMissingColumns(grist, list);
  if (missingColumns.length) {
    console.warn(`Document Grist incomplet : ${missingColumns.length} colonne(s) attendue(s) absente(s) —`,
      missingColumns.join(", "));
    note("structure", "colonnes attendues absentes", missingColumns.join(", "));
  } else {
    note("structure", "colonnes attendues", "toutes présentes");
  }

  return { tables: list.length, missingColumns, renommees };
}

/**
 * Tables et colonnes attendues par l'outil qui manquent au document.
 * Renvoie `null` si la page n'est pas branchée sur un document Grist.
 * Aucune donnée n'est modifiée — au plus une table encore visible est-elle
 * masquée (voir `resoudreNomsDeTables`), ce qui ne touche aucune ligne.
 */
export async function checkStructure() {
  const grist = gristRef || (typeof window !== "undefined" ? window.grist : null);
  if (!grist) return null;
  const brut = await grist.docApi.listTables();
  await resoudreNomsDeTables(grist, brut);
  const existing = tablesDuModele(brut);
  documentTableList = existing;
  const { columns, ok } = await fetchColumnMeta(grist);
  if (!ok) {
    note("structure", "vérification", "tables internes de Grist illisibles");
    throw new Error("les tables internes de Grist n'ont pas pu être lues (colonnes existantes inconnues).")
  }
  documentColumnMeta = columns;
  const missingTables = requiredTables().filter((t) => !existing.includes(t));
  const missingColumns = expectedColumns(existing).filter((id) => !columns[id]);
  note("structure", "vérification",
    `${missingTables.length} table(s) et ${missingColumns.length} colonne(s) manquante(s)`
    + (missingColumns.length ? ` — ${missingColumns.join(", ")}` : ""));
  return { missingTables, missingColumns, total: missingTables.length + missingColumns.length };
}

/** Désignation lisible d'une action de structure, pour les messages d'erreur. */
function actionLabel(action) {
  const table = tableDuModele(action[1]) || action[1];
  if (action[0] === "AddTable") return `table « ${table} »`;
  if (action[0] === "AddColumn") return `colonne « ${table}.${action[2]} »`;
  return `${action[0]} « ${table} »`;
}

/**
 * Envoie un lot de modifications de structure et renvoie la liste des
 * refus, vide si tout est passé.
 *
 * Grist applique un lot d'actions **en bloc** : une seule action refusée et
 * rien n'est écrit, sans dire laquelle. En cas d'échec, le lot est donc
 * rejoué action par action pour obtenir un diagnostic exploitable — les
 * actions déjà appliquées étant sans effet (une table ou une colonne
 * existante est ignorée), ce second passage est sûr.
 */
async function applyStructure(grist, actions) {
  note("structure", "envoi du lot", describeActions(actions));
  try {
    await grist.docApi.applyUserActions(actions);
    note("structure", "lot accepté", `${actions.length} action(s)`);
    return [];
  } catch (err) {
    console.warn("Installation refusée en bloc, reprise action par action :", err);
    note("structure", "lot refusé en bloc", (err && err.message) || err);
  }
  const failures = [];
  for (const action of actions) {
    try {
      await grist.docApi.applyUserActions([action]);
    } catch (err) {
      failures.push(`${actionLabel(action)} : ${(err && err.message) || err}`);
    }
  }
  if (failures.length) note("structure", "actions refusées", failures.join(" ; "));
  return failures;
}

/**
 * Installe la structure attendue (tables et colonnes) dans le document
 * Grist courant. Utilisable une seule fois, sur un document vierge.
 */
export async function installStructure() {
  const grist = gristRef || window.grist;
  if (!grist) throw new Error("Aucun document Grist détecté.");
  const brut = await grist.docApi.listTables();
  await resoudreNomsDeTables(grist, brut);
  const existing = tablesDuModele(brut);
  const { columns, ok } = await fetchColumnMeta(grist);
  if (!ok) {
    // Sans les métadonnées, impossible de savoir quelles colonnes existent
    // déjà : les ajouter à l'aveugle ferait refuser le lot entier.
    throw new Error("les tables internes de Grist (« _grist_Tables_column ») n'ont pas pu être lues : "
      + "l'outil ne peut pas vérifier les colonnes déjà présentes. Vérifiez que le widget a bien "
      + "l'accès complet au document.");
  }
  const actions = [];
  for (const [name, def] of Object.entries(SCHEMA)) {
    // Les tables d'héritage ne sont jamais créées : elles n'appartiennent pas
    // au modèle de l'outil, seulement à la reprise des données.
    if (isLegacyTable(name)) continue;
    if (!existing.includes(name)) {
      actions.push(["AddTable", physique(name), [{ id: "manualSort", type: "ManualSortPos" }]]);
    }
    for (const c of def.columns) {
      if (columns[`${name}.${c.id}`]) continue;
      if (c.ancien) continue;
      actions.push(["AddColumn", physique(name), c.id, columnSpec(c)]);
    }
  }
  if (!existing.includes(SESSION_TABLE)) {
    actions.push(sessionTableAction());
  } else {
    for (const c of SESSION_COLUMNS) {
      if (columns[`${SESSION_TABLE}.${c.id}`]) continue;
      actions.push(["AddColumn", SESSION_TABLE, c.id, sessionColumnSpec(c)]);
    }
  }
  if (!actions.length) {
    note("structure", "installation", "rien à créer : le document est complet");
    return { created: 0 };
  }
  const failures = await applyStructure(grist, actions);
  if (failures.length) {
    throw new Error(`Le document a refusé ${failures.length} modification(s) de structure : ${failures.join(" ; ")}`
      + (failures.length < actions.length ? ` (${actions.length - failures.length} modification(s) ont abouti.)` : ""));
  }
  return { created: actions.length };
}

/* ------------------------------------------------------------------ */
/* Identité et droits de l'utilisateur                                 */
/* ------------------------------------------------------------------ */
/*
 * L'API « widget » de Grist ne transmet pas l'identité de la personne qui
 * regarde la page : impossible de savoir qui est connecté, ni s'il est
 * propriétaire, éditeur ou lecteur. Le seul moyen d'obtenir cette information
 * est de la faire écrire par le moteur lui-même : les formules déclenchées
 * (« trigger formulas ») d'une colonne disposent d'un objet `user` qui porte
 * le nom, le courriel, l'identifiant numérique et le niveau d'accès réel.
 *
 * L'outil ajoute donc au document une table technique d'une ligne par
 * utilisateur. Le préfixe `GristHidden_` la masque des menus de Grist ; elle
 * reste une table ordinaire, visible dans les données brutes du document.
 * Les colonnes sont en lecture seule : elles sont calculées par Grist, et non
 * saisies. Les valeurs renvoyées par `user.*` sont conservées telles quelles
 * dans la ligne — c'est ce que lit l'application pour attribuer les rôles.
 */

export const SESSION_TABLE = "GristHidden_Utilisateurs";

const SESSION_COLUMNS = [
  { id: "Cle", label: "Clé de session", type: "Text" },
  { id: "Nom", label: "Nom", type: "Text", formula: "user.Name" },
  { id: "Email", label: "Courriel", type: "Text", formula: "user.Email" },
  { id: "Identifiant", label: "Identifiant", type: "Int", formula: "user.UserID" },
  { id: "Acces", label: "Accès", type: "Text", formula: "user.Access" },
  { id: "Premiere_visite", label: "Première visite", type: "DateTime", formula: "NOW()" },
];

/* Types de colonnes réellement acceptés par Grist.
   Le schéma de l'outil décrit les colonnes au plus près de l'usage qui en est
   fait à l'écran : « LongText » pour un texte long, « Link » pour une adresse
   web. Ces deux-là **n'existent pas** dans Grist, et une création de colonne
   qui les demanderait serait refusée — en faisant échouer tout le lot
   d'actions, donc l'installation entière de la structure. Cette table ramène
   les descriptions de l'outil aux types de Grist (un texte Grist n'a pas de
   longueur maximale : « LongText » ne perd rien à devenir « Text »). */
const GRIST_TYPES = {
  Text: "Text",
  LongText: "Text",
  Link: "Text",
  Choice: "Choice",
  ChoiceList: "ChoiceList",
  Bool: "Bool",
  Int: "Int",
  Numeric: "Numeric",
  Date: "Date",
  DateTime: "DateTime",
  Attachment: "Attachment",
};

/** Type Grist correspondant à la description d'une colonne du schéma. */
function gristType(type) {
  const value = String(type || "Text");
  // Une référence nomme une table : c'est le nom de **stockage** qu'attend le
  // document, pas le nom court du modèle (voir « Noms des tables »).
  if (value.startsWith("Ref:")) return `Ref:${physique(value.slice(4))}`;
  if (value.startsWith("RefList:")) return `RefList:${physique(value.slice(8))}`;
  return GRIST_TYPES[value] || "Text";
}

function columnSpec(def) {
  const spec = { id: def.id, label: def.label, type: gristType(def.type) };
  if (spec.type === "Choice") spec.widgetOptions = JSON.stringify({ choices: def.choices || [] });
  return spec;
}

function sessionColumnSpec(def) {
  const spec = { id: def.id, label: def.label, type: gristType(def.type) };
  if (def.formula) {
    // « Formule déclenchée » : une colonne de données (et non une colonne
    // calculée) dont la valeur est remplie par une formule au moment de la
    // création de l'enregistrement. C'est la seule forme où `user` est
    // accessible ; recalcWhen 0 (= « DEFAULT ») la limite aux nouveaux
    // enregistrements, recalcDeps vide n'ajoutant aucune dépendance.
    spec.isFormula = false;
    spec.formula = def.formula;
    spec.recalcWhen = 0;
  }
  return spec;
}

/** Description complète de la table technique, colonnes comprises. */
function sessionTableAction() {
  return [
    "AddTable",
    SESSION_TABLE,
    [{ id: "manualSort", type: "ManualSortPos" }, ...SESSION_COLUMNS.map(sessionColumnSpec)],
  ];
}

function nonce() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Crée la table technique si elle manque, et les colonnes manquantes si la
 * table vient d'une version antérieure. Lève une erreur si le document refuse
 * la modification (utilisateur sans droit d'écriture).
 *
 * `canWrite === false` évite une tentative vouée à l'échec : un simple lecteur
 * n'a pas le droit de modifier le schéma, et la requête serait refusée par
 * Grist, avec une erreur dans la console du navigateur.
 */
export async function ensureSessionTable(canWrite = true) {
  const grist = gristRef || (typeof window !== "undefined" ? window.grist : null);
  if (!grist) return { ready: false, actions: 0 };
  if (canWrite === false) return { ready: false, actions: 0, readOnly: true };
  const tables = await grist.docApi.listTables();
  const exists = tables.includes(SESSION_TABLE);
  const actions = [];
  if (!exists) {
    actions.push(sessionTableAction());
  } else {
    const meta = await fetchColumnMeta(grist);
    // Métadonnées illisibles : la table existe (créée par l'outil), ses
    // colonnes sont donc celles du modèle — inutile d'en ajouter.
    if (meta.ok) {
      for (const c of SESSION_COLUMNS) {
        if (meta.columns[`${SESSION_TABLE}.${c.id}`]) continue;
        actions.push(["AddColumn", SESSION_TABLE, c.id, sessionColumnSpec(c)]);
      }
    }
  }
  if (actions.length) {
    await grist.docApi.applyUserActions(actions);
  }
  return { ready: true, actions: actions.length };
}

/** Identifiant numérique de l'utilisateur, déduit du jeton d'accès Grist. */
function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    return JSON.parse(decodeURIComponent(bytes));
  } catch {
    return null;
  }
}

/**
 * Identité et droit d'écriture de la personne qui regarde le widget, déduits
 * du jeton d'accès que Grist veut bien délivrer :
 *
 *   - Grist le REFUSE à un utilisateur anonyme (aucune identité) ;
 *   - pour un simple lecteur, Grist ramène de force le jeton à la lecture
 *     seule (`readOnly: true`), quel que soit le droit demandé ;
 *   - propriétaires et éditeurs obtiennent un jeton non limité.
 *
 * Le jeton porte donc, en plus de `userId`, l'information « cet utilisateur
 * peut-il écrire dans ce document ? ». C'est le seul signal de droit que l'API
 * Grist expose à un widget, et il reste disponible même lorsque la table
 * technique ne peut être ni créée ni lue.
 */
async function gristSession(grist) {
  try {
    const info = await grist.docApi.getAccessToken({ readOnly: false });
    const payload = decodeJwtPayload(info?.token);
    const userId = payload && payload.userId !== undefined && payload.userId !== null
      ? Number(payload.userId)
      : null;
    return { userId, writable: payload ? payload.readOnly === false : null };
  } catch {
    return { userId: null, writable: false };
  }
}

async function fetchSessionRows(grist) {
  const cols = await grist.docApi.fetchTable(SESSION_TABLE);
  const rows = [];
  const count = Array.isArray(cols.id) ? cols.id.length : 0;
  for (let i = 0; i < count; i += 1) {
    rows.push({
      id: cols.id[i],
      Cle: cols.Cle ? cols.Cle[i] : "",
      Nom: cols.Nom ? cols.Nom[i] : "",
      Email: cols.Email ? cols.Email[i] : "",
      Identifiant: cols.Identifiant ? cols.Identifiant[i] : null,
      Acces: cols.Acces ? cols.Acces[i] : "",
      Premiere_visite: cols.Premiere_visite ? cols.Premiere_visite[i] : null,
    });
  }
  return rows;
}

function userFromRow(row, source, fallbackRole = "visiteur") {
  const access = String(row.Acces || "").trim();
  // Le niveau d'accès inscrit par Grist est la référence. À défaut — formule
  // déclenchée indisponible, ou ligne créée par une version antérieure de
  // l'outil — on retombe sur le droit d'écriture déduit du jeton. On ne
  // suppose JAMAIS le rôle « administrateur » : les réglages ne s'ouvrent que
  // sur preuve explicite d'un droit de propriétaire.
  const role = access ? roleFromGristAccess(access) : fallbackRole;
  return {
    role,
    name: String(row.Nom || "").trim(),
    email: String(row.Email || "").trim(),
    access,
    firstVisit: row.Premiere_visite || null,
    source,
  };
}

/** Lignes de la table technique, pour l'écran « Réglages › Données ». */
export let sessionUsers = [];

/**
 * Établit le rôle et l'identité de la personne qui utilise le widget.
 * Renvoie `null` si la page n'est pas branchée sur un document Grist.
 */
export async function resolveGristUser() {
  const grist = gristRef || (typeof window !== "undefined" ? window.grist : null);
  if (!grist) return null;

  const session = await gristSession(grist);
  // Rôle de repli, établi sans le secours de la table technique : « secrétaire »
  // à partir du moment où Grist consent à un jeton d'écriture.
  const fallbackRole = session.writable ? "secretaire" : "visiteur";

  try {
    await ensureSessionTable(session.writable !== false);
  } catch (err) {
    console.debug("Table des utilisateurs non créée :", err);
  }

  let rows = [];
  try {
    rows = await fetchSessionRows(grist);
    sessionUsers = rows;
  } catch (err) {
    console.debug("Table des utilisateurs illisible :", err);
    sessionUsers = [];
  }

  const known = session.userId === null ? null : rows.find((r) => Number(r.Identifiant) === session.userId);
  if (known) {
    note("identité", "utilisateur reconnu",
      `id ${known.id} — ${known.Nom || "?"} <${known.Email || "?"}> — accès « ${known.Acces || "?"} » — rôle ${fallbackRole}`);
    return userFromRow(known, "grist", fallbackRole);
  }

  // Aucune ligne connue : on en ajoute une, que Grist complète lui-même avec
  // l'identité et le niveau d'accès de l'utilisateur courant.
  try {
    const marker = nonce();
    const result = await grist.docApi.applyUserActions([
      ["AddRecord", SESSION_TABLE, null, { Cle: marker }],
    ]);
    const newId = result?.retValues?.[0];
    const fresh = await fetchSessionRows(grist);
    sessionUsers = fresh;
    const mine = (newId !== undefined && newId !== null && fresh.find((r) => Number(r.id) === Number(newId)))
      || fresh.find((r) => String(r.Cle) === marker);
    if (mine) {
      note("identité", "utilisateur ajouté",
        `id ${mine.id} — ${mine.Nom || "?"} <${mine.Email || "?"}> — accès « ${mine.Acces || "?"} »`);
      return userFromRow(mine, "grist", fallbackRole);
    }
  } catch (err) {
    console.debug("Identité Grist non résolue :", err);
    note("identité", "ajout impossible", (err && err.message) || err);
  }

  // Ni ligne connue, ni droit d'en écrire une : le nom reste indisponible.
  note("identité", "utilisateur indéterminé", `rôle de repli : ${fallbackRole}`);
  return {
    role: fallbackRole,
    name: "",
    email: "",
    access: "",
    source: session.userId === null ? "anonyme" : "grist",
  };
}

/**
 * Interdit toute écriture vers le document : le rôle « visiteur » n'a aucun
 * droit de modification, et rien ne doit partir vers Grist.
 */
export function disableGristWrites(store) {
  writesAllowed = false;
  // Un rôle sans droit d'écriture n'a rien à rejouer : la file est vidée, pour
  // ne pas laisser croire à des modifications en souffrance.
  enAttente = [];
  arreterEnvoi();
  sauvegarderOutbox();
  if (store) { store.onGristWrite = null; store.onGristReplace = null; }
}

/** Rétablit les écritures vers le document (rôle autorisant la modification). */
export function enableGristWrites(store) {
  writesAllowed = true;
  if (store && gristRef && !store.onGristWrite) store.onGristWrite = installWriteHook(store);
  if (store && gristRef && !store.onGristReplace) store.onGristReplace = installReplaceHook(store);
}

/** Signale une écriture définitivement refusée par le document. */
function signalerEchec(err) {
  const message = (err && err.message) ? err.message : String(err);
  const etatChange = isReadOnlyError(message) ? markReadOnly(message) : false;
  note("écriture", "échec définitif", message);
  // L'appelant (l'interface) décide de ce qui doit être répété : la console ne
  // reçoit l'erreur qu'une fois, mais le rapport lui parvient à chaque fois —
  // le nombre de modifications en attente, lui, a changé.
  if (message !== lastWriteError || etatChange) console.error("Écriture Grist refusée :", err);
  lastWriteError = message;
  if (writeReporter) writeReporter(message);
}

/* ------------------------------------------------------------------ */
/* Regroupement des écritures                                          */
/* ------------------------------------------------------------------ */
/*
 * Chaque écriture envoyée au document coûte un aller-retour : passer par l'API
 * du widget, laisser Grist appliquer l'action et recalculer ses formules, puis
 * rendre la réponse. Un aller-retour se compte en dizaines — parfois en
 * centaines — de millisecondes, et une écriture par frappe au clavier comme une
 * écriture par ligne d'import en enchaînent des centaines, à la queue leu leu :
 * l'outil paraît alors figé, alors qu'il attend seulement le document.
 *
 * Les écritures retenues (voir « Écritures en attente ») partent donc par
 * **lots**, et chaque lot part en **un seul** appel à `applyUserActions` :
 *
 *  - l'outil attend un court silence avant d'expédier ce qui s'est accumulé,
 *    ce qui fond une rafale de modifications d'une même ligne en une seule
 *    écriture (la fusion de `retenirEcriture` fait le reste) ;
 *  - deux bornes empêchent l'attente perpétuelle : un lot part au plus tard
 *    après `GROUPE_MAX_ATTENTE_MS`, même si les écritures se succèdent sans
 *    interruption ;
 *  - un ajout ne part jamais dans le même appel que la ligne qu'il cite :
 *    Grist ne sait pas référencer, dans un appel, une ligne qui y naît. Le lot
 *    est donc coupé juste avant, et le suivant part une fois le précédent
 *    appliqué — c'est aussi ce qui garantit qu'une référence lue dans le
 *    document est bien l'identifiant attribué par Grist.
 */
const GROUPE_SILENCE_MS = 400;
const GROUPE_MAX_ATTENTE_MS = 1500;

/* Nombre de lots envoyés d'affilée avant de rendre la main : une file qui
   grossit plus vite qu'elle ne se vide laisserait sinon la boucle d'envoi
   tourner sans fin, sans que rien n'ait plus d'effet. */
const LOTS_PAR_PASSE = 40;

let premierEnAttente = 0;
let minuteurEnvoi = null;

/**
 * Identifiants cités par les colonnes de référence d'une ligne.
 * `cible` restreint le relevé aux références vers une table donnée.
 */
function referencesLocales(table, data, cible = null) {
  const out = [];
  for (const col of SCHEMA[table]?.columns || []) {
    const m = /^Ref(List)?:([A-Za-z_]+)$/.exec(col.type || "");
    if (!m) continue;
    if (cible && m[2] !== cible) continue;
    const brut = data?.[col.id];
    if (brut === null || brut === undefined || brut === "") continue;
    const valeurs = Array.isArray(brut) ? brut : String(brut).replace(/[[\]]/g, "").split(",");
    for (const valeur of valeurs) {
      const id = Number(valeur);
      if (Number.isFinite(id) && id !== 0) out.push(id);
    }
  }
  return out;
}

/**
 * Premier lot d'écritures pouvant partir d'un seul appel.
 * Le lot s'arrête avant toute écriture qui porte sur une ligne créée plus loin
 * dans le même lot (Grist refuserait la référence), et avant `LOT_ECRITURE`
 * actions — un appel trop gros étant refusé en bloc.
 */
function premierLot(actions) {
  const lot = [];
  const crees = new Set();
  for (const action of actions) {
    const data = action.type === "add" ? action.data : action.patch;
    const depend = (action.type !== "add" && Number(action.id) < 0 && crees.has(Number(action.id)))
      || (action.type !== "delete" && referencesLocales(action.table, data).some((id) => crees.has(id)));
    if (lot.length && depend) break;
    lot.push(action);
    // Seules les lignes créées localement (identifiants négatifs) peuvent
    // manquer au document : celles qui portent un identifiant attribué par
    // Grist y sont déjà.
    if (action.type === "add" && Number(action.data.id) < 0) crees.add(Number(action.data.id));
    if (lot.length >= LOT_ECRITURE) break;
  }
  return lot.length ? lot : [actions[0]];
}

/** Traduit une écriture retenue en actions de l'API Grist. */
function construireEcriture(action) {
  if (isLegacyTable(action.table)) return null;
  const table = physique(action.table);
  if (action.type === "add") {
    return {
      type: "add", table, modele: action.table, ligne: action.data.id,
      action: ["AddRecord", table, null, addPayload(action.table, action.data)],
    };
  }
  if (action.type === "update") {
    const payload = addPayload(action.table, action.patch);
    if (!Object.keys(payload).length) {
      note("écriture", "écriture sans contenu envoyable", `${action.table} #${action.id} {${Object.keys(action.patch || {}).join(", ")}}`);
      return null;
    }
    return { type: "update", table, action: ["UpdateRecord", table, mapId(action.table, action.id), payload] };
  }
  if (action.type === "delete") {
    return {
      type: "delete", table, modele: action.table, ligne: action.id,
      action: ["RemoveRecord", table, mapId(action.table, action.id)],
      suites: (action.cascade || []).map((child) => ["RemoveRecord", physique(child.table), mapId(child.table, child.id)]),
    };
  }
  return null;
}

/** Retient les identifiants attribués par Grist aux lignes d'un lot accepté. */
function enregistrerIdentifiants(envois, resultat) {
  const retours = resultat?.retValues || [];
  let rang = 0;
  for (const envoi of envois) {
    if (envoi.type === "add") {
      const nouveau = retours[rang];
      if (nouveau !== undefined && nouveau !== null) idMap[envoi.modele]?.set(Number(envoi.ligne), Number(nouveau));
    } else if (envoi.type === "delete") {
      idMap[envoi.modele]?.delete(Number(envoi.ligne));
    }
    rang += envoi.suites ? envoi.suites.length + 1 : 1;
  }
}

/**
 * Rejoue un lot refusé écriture par écriture, ce qui rend chaque refus à sa
 * ligne et laisse en attente les seules écritures réellement refusées.
 */
async function rejouerUnParUn(lot) {
  let dernier = null;
  for (const action of lot) {
    // eslint-disable-next-line no-await-in-loop
    try {
      await applyAction(action);
      oublierEcriture(action);
    } catch (err) {
      dernier = err;
    }
  }
  if (dernier) signalerEchec(dernier);
}

/**
 * Envoie un lot d'écritures en un seul appel au document.
 * Renvoie `true` si le lot a été accepté en bloc, `false` sinon — un lot
 * refusé n'a alors été appliqué qu'en partie, voire pas du tout.
 */
async function envoyerLot(lot) {
  for (const action of lot) enVol.add(action);
  try {
    const envois = lot.map(construireEcriture).filter(Boolean);
    if (!envois.length) { oublierLot(lot); return true; }
    const actions = envois.flatMap((e) => (e.suites ? [e.action, ...e.suites] : [e.action]));
    note("écriture", `lot de ${lot.length} écriture(s)`, describeActions(actions));
    try {
      const resultat = await withTimeout(gristRef.docApi.applyUserActions(actions), WRITE_TIMEOUT_MS,
        `le document n'a pas répondu à l'enregistrement (lot de ${lot.length} écriture(s))`);
      enregistrerIdentifiants(envois, resultat);
      oublierLot(lot);
      // Une écriture réussie efface l'alerte affichée après un échec — mais
      // seulement si plus rien n'attend : tant qu'une modification est retenue,
      // le bandeau (et son bouton de renvoi) doit rester visible.
      if (lastWriteError && !enAttente.length) {
        lastWriteError = "";
        if (writeReporter) writeReporter("");
      }
      return true;
    } catch (err) {
      // Grist applique un lot en bloc : une seule action refusée et rien n'est
      // écrit, sans dire laquelle. Le lot est donc rejoué une par une.
      console.warn("Lot d'écritures refusé, reprise écriture par écriture :", err);
      note("écriture", "lot refusé en bloc", (err && err.message) || err);
      await rejouerUnParUn(lot);
      return false;
    }
  } finally {
    for (const action of lot) enVol.delete(action);
  }
}

/** Envoie tout ce qui est retenu et libre, lot après lot. */
async function viderEnAttente() {
  if (!writesAllowed) return;
  for (let passe = 0; passe < LOTS_PAR_PASSE; passe += 1) {
    const libres = enAttente.filter((a) => !enVol.has(a));
    if (!libres.length) return;
    // eslint-disable-next-line no-await-in-loop
    const accepte = await envoyerLot(premierLot(libres));
    // Un lot refusé laisse ses écritures en attente : les représenter aussitôt
    // les refuserait encore, sans fin, et ferait attendre l'outil à chaque
    // essai le temps du délai d'écriture. Elles attendent désormais le renvoi
    // décidé par l'utilisateur (voir `retryPendingWrites`), ou la prochaine
    // écriture, qui repartira avec elles.
    if (!accepte) return;
  }
  // La file grossit plus vite qu'elle ne se vide : on reprend après un silence.
  if (enAttente.some((a) => !enVol.has(a))) planifierEnvoi();
}

/** Programme l'envoi des écritures retenues, après un court silence. */
function planifierEnvoi() {
  if (!writesAllowed) return;
  const maintenant = Date.now();
  if (!premierEnAttente) premierEnAttente = maintenant;
  const attente = Math.min(GROUPE_SILENCE_MS,
    Math.max(0, premierEnAttente + GROUPE_MAX_ATTENTE_MS - maintenant));
  clearTimeout(minuteurEnvoi);
  minuteurEnvoi = setTimeout(() => {
    minuteurEnvoi = null;
    premierEnAttente = 0;
    writeChain = writeChain.then(viderEnAttente).catch(signalerEchec);
  }, attente);
}

/** Arrête le regroupement en cours (rôle sans droit d'écriture, mise au repos). */
function arreterEnvoi() {
  clearTimeout(minuteurEnvoi);
  minuteurEnvoi = null;
  premierEnAttente = 0;
  enVol.clear();
}

function installWriteHook(store) {
  return (action) => {
    // L'écriture est retenue avant d'être tentée : elle ne peut donc pas être
    // perdue entre le moment où le document la refuse et celui où l'utilisateur
    // s'en aperçoit (voir « Écritures en attente »). L'envoi, lui, est groupé.
    retenirEcriture(action);
    planifierEnvoi();
    return writeChain;
  };
}

/**
 * Branche le remplacement du contenu du document (voir `remplacerDocument`).
 * C'est le pendant, pour les écritures en bloc, de `installWriteHook` : les
 * mêmes garanties de sérialisation et de signalement.
 */
function installReplaceHook(store) {
  return () => {
    writeChain = writeChain
      .then(() => remplacerDocument(store))
      .then(() => {
        if (lastWriteError) {
          lastWriteError = "";
          if (writeReporter) writeReporter("");
        }
      })
      .catch(signalerEchec);
    return writeChain;
  };
}

/**
 * Ordre d'écriture : une table n'est remplie qu'après celles qu'elle cite.
 *
 * Seules les colonnes **saisies** comptent. Une colonne calculée peut citer une
 * autre table sans que rien n'ait à être écrit dans cet ordre — c'est Grist qui
 * la remplit —, et la suivre faisait entrer l'ordre dans une boucle : `Affaires`
 * porte une colonne calculée vers `Decisions`, qui cite `Affaires`. Le résultat
 * était que `Decisions` partait avant `Affaires`, et ses références, non
 * traduites, désignaient alors n'importe quelle ligne du document.
 */
function ordreDependances() {
  const tables = Object.keys(SCHEMA).filter((t) => !isLegacyTable(t));
  const vus = new Set();
  const out = [];
  const visiter = (t) => {
    if (vus.has(t)) return;
    vus.add(t);
    for (const c of SCHEMA[t].columns) {
      if (c.formula) continue;
      const m = /^Ref(List)?:([A-Za-z_]+)$/.exec(c.type || "");
      if (m && m[2] !== t && SCHEMA[m[2]] && !isLegacyTable(m[2])) visiter(m[2]);
    }
    out.push(t);
  };
  for (const t of tables) visiter(t);
  return out;
}

/**
 * Remplace le contenu du document par la base locale.
 *
 * Appelé quand la base est remplacée **en bloc** — restauration d'un export
 * JSON, remise à zéro, remise du jeu d'exemple — car ces chemins ne passent pas
 * par les écritures ligne à ligne du magasin : sans cette fonction, le
 * remplacement resterait local et le document reprendrait le dessus au
 * rechargement suivant.
 *
 * Les tables du modèle sont vidées puis réécrites, table par table, dans
 * l'ordre des dépendances (une ligne ne cite qu'une table déjà écrite). Les
 * tables d'héritage (`Commissions`) et la table technique des utilisateurs ne
 * sont jamais touchées. Les identifiants du document changent : c'est le prix
 * d'un remplacement en bloc, que l'import, lui, évite (voir `import.js`).
 */
/**
 * Écrit les lignes d'une table, par lots.
 *
 * Une ligne par appel était le plus sûr et le plus lent : restaurer un export
 * de quelques milliers de lignes enchaînait autant d'allers-retours, et l'outil
 * restait figé le temps que le document les absorbe. Les lignes partent donc
 * par lots — Grist applique un lot en bloc —, avec deux précautions :
 *
 *  - une ligne qui cite une autre ligne **de la même table** n'entre jamais
 *    dans le même lot que celle qu'elle cite, Grist ne sachant pas référencer
 *    une ligne créée dans l'appel en cours ;
 *  - un lot refusé est rejoué ligne par ligne, comme partout ailleurs, pour que
 *    le refus se rapporte à sa ligne — et le rejeu, lui, respecte l'ordre.
 *
 * Les identifiants attribués par Grist reviennent dans l'ordre des actions ;
 * ils sont enregistrés aussitôt, ce qui permet aux tables suivantes de citer
 * ces lignes par le bon identifiant.
 */
async function envoyerLignes(table, lignes, grist) {
  let ecrites = 0;
  let lot = [];
  let crees = new Set();

  const envoyer = async () => {
    if (!lot.length) return;
    const aEnvoyer = lot;
    lot = [];
    crees = new Set();
    const actions = aEnvoyer.map((row) => ["AddRecord", physique(table), null, addPayload(table, row)]);
    try {
      const resultat = await withTimeout(grist.docApi.applyUserActions(actions), WRITE_TIMEOUT_MS,
        `le document n'a pas répondu à l'écriture de la table « ${table} »`);
      const retours = resultat?.retValues || [];
      aEnvoyer.forEach((row, i) => {
        const nouveau = retours[i];
        if (nouveau !== undefined && nouveau !== null) idMap[table]?.set(Number(row.id), Number(nouveau));
      });
      ecrites += aEnvoyer.length;
    } catch (err) {
      console.warn(`Lot d'ajouts refusé dans « ${table} », reprise ligne par ligne :`, err);
      note("écriture", `lot d'ajouts refusé — ${table}`, (err && err.message) || err);
      for (const row of aEnvoyer) {
        // eslint-disable-next-line no-await-in-loop
        try {
          await applyAction({ type: "add", table, id: row.id, data: row });
          ecrites += 1;
        } catch (errLigne) {
          note("écriture", `ajout refusé — ${table}`, (errLigne && errLigne.message) || errLigne);
        }
      }
    }
  };

  for (const row of lignes) {
    // Seules les références **à la table en cours d'écriture** peuvent viser
    // une ligne du même lot : les autres tables sont déjà écrites (voir
    // `ordreDependances`), et leurs identifiants locaux ne veulent rien dire
    // ici.
    // eslint-disable-next-line no-await-in-loop
    if (lot.length && referencesLocales(table, row, table).some((id) => crees.has(id))) await envoyer();
    lot.push(row);
    crees.add(Number(row.id));
  }
  await envoyer();
  return ecrites;
}

export async function remplacerDocument(store) {
  const grist = gristRef || (typeof window !== "undefined" ? window.grist : null);
  if (!grist) return { supprimees: 0, ecrites: 0 };
  if (!writesAllowed) {
    note("écriture", "remplacement refusé", "les écritures sont suspendues pour ce rôle");
    return { supprimees: 0, ecrites: 0 };
  }

  let supprimees = 0;
  for (const table of Object.keys(SCHEMA)) {
    if (isLegacyTable(table)) continue;
    // La table des utilisateurs n'appartient pas au modèle : jamais touchée.
    idMap[table] = new Map();
    let ids = [];
    try {
      const cols = await withTimeout(grist.docApi.fetchTable(physique(table)), HANDSHAKE_TIMEOUT_MS,
        `le document n'a pas répondu pour la table « ${table} »`);
      ids = (cols.id || []).map(Number).filter((n) => Number.isFinite(n));
    } catch {
      // Table absente du document : il n'y a rien à vider.
      continue;
    }
    for (let i = 0; i < ids.length; i += LOT_ECRITURE) {
      const lot = ids.slice(i, i + LOT_ECRITURE);
      try {
        await withTimeout(
          grist.docApi.applyUserActions(lot.map((id) => ["RemoveRecord", physique(table), id])),
          WRITE_TIMEOUT_MS, `le document n'a pas répondu au vidage de « ${table} »`,
        );
        supprimees += lot.length;
      } catch (err) {
        note("écriture", `vidage de « ${table} » refusé`, (err && err.message) || err);
        throw err;
      }
    }
  }

  let ecrites = 0;
  for (const table of ordreDependances()) {
    // `envoyerLignes` traduit les références, enregistre les identifiants
    // attribués par Grist et journalise les refus ; l'ordre des dépendances
    // garantit qu'une table citée est déjà écrite.
    // eslint-disable-next-line no-await-in-loop
    ecrites += await envoyerLignes(table, store.table(table), grist);
  }
  note("écriture", "document remplacé", `${supprimees} ligne(s) retirée(s), ${ecrites} ligne(s) écrite(s)`);
  return { supprimees, ecrites };
}
