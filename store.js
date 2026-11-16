// Couche données : état, persistance et écritures.
//
// Deux moteurs possibles :
//  - « local » (par défaut) : tout est conservé dans le navigateur
//    (localStorage + export/import JSON) ;
//  - « grist » : lorsqu'on est embarqué dans un document Grist via l'API
//    widget, les tables du document servent de base de données.

import { SCHEMA, migrerDb, idsDeRefList, pairesDeMiroirs } from "./schema.js";
import { SEED } from "./seed.js";
import { TYPES_TRAMES_PAR_DEFAUT, TRAMES_PAR_DEFAUT } from "./trames-defaut.js";
import { MOTIFS_PAR_DEFAUT, SANCTIONS_PAR_DEFAUT, parametresParDefaut } from "./regimes.js";
import { appliquerPlanContenus, planAlignementContenus } from "./contenus.js";
import { enRecette } from "./environnement.js";
import { COLONNES_RICHES, assainirHtmlSecurite } from "./sanitize.js";

const STORAGE_KEY = "sections-disciplinaires.db.v1";
const PREFS_KEY = "sections-disciplinaires.prefs.v1";
const JOURNAL_MAX = 500;

/**
 * Nom sous lequel une ligne se reconnaît dans la corbeille : le libellé
 * d'affichage du schéma, ou, à défaut, la première colonne qui dit quelque
 * chose. Une ligne sans nom s'y présente par son identifiant — mieux vaut cela
 * qu'une entrée muette.
 */
function libelleDeLigne(name, row) {
  const champs = [SCHEMA[name]?.display, "Nom_complet", "Nom", "Libelle", "Objet", "Structure", "Titre"];
  for (const champ of champs) {
    if (!champ) continue;
    const valeur = row?.[champ];
    if (typeof valeur === "string" && valeur.trim()) return valeur.trim().slice(0, 300);
  }
  return `#${row?.id ?? "?"}`;
}

export function emptyDb() {
  const db = {};
  for (const name of Object.keys(SCHEMA)) db[name] = [];
  return db;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function renumber(db) {
  for (const name of Object.keys(SCHEMA)) {
    const rows = db[name] || [];
    rows.forEach((r, i) => {
      if (typeof r.id !== "number") r.id = i + 1;
    });
    db[name] = rows;
  }
  return db;
}

/**
 * Installe les seuils par défaut dans `Parametres` si la table est vide.
 * Un document d'origine n'a pas cette table : l'outil la crée donc à la
 * première ouverture, sans écraser une valeur déjà réglée par l'établissement.
 */
export function ensureParametres(db) {
  db.Parametres = db.Parametres || [];
  if (!db.Parametres.length) {
    db.Parametres = parametresParDefaut().map((p, i) => ({ id: i + 1, ...p }));
    return db;
  }
  // Un seuil **retiré de l'outil** — sa clé n'est plus déclarée — n'a plus de
  // lecteur : sa ligne est écartée du document. Sans cela elle resterait
  // affichée et réglable dans « Seuils et délais » alors que plus rien ne s'y
  // rapporte.
  const declarees = new Set(parametresParDefaut().map((p) => p.Cle));
  db.Parametres = db.Parametres.filter((p) => declarees.has(p.Cle));
  // Un seuil introduit après la création de la base est ajouté, sans toucher
  // aux valeurs déjà réglées par l'établissement.
  let max = db.Parametres.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
  const connues = new Set(db.Parametres.map((p) => p.Cle));
  for (const p of parametresParDefaut()) {
    if (connues.has(p.Cle)) continue;
    db.Parametres.push({ id: ++max, ...p });
  }
  return db;
}

/**
 * Installe les trames et les types de trames livrés par défaut dans une base
 * qui n'en a aucun.
 *
 * C'est le point d'application de la règle « les trames par défaut sont
 * proposées à la première installation » : une base neuve — le jeu d'exemple
 * comme un document Grist fraîchement doté de la structure — reçoit les
 * modèles livrés avec l'outil. Une base qui a déjà des trames n'est jamais
 * touchée : les modèles de l'établissement priment.
 */
export function ensureTramesParDefaut(db) {
  db.Types_Trames = db.Types_Trames || [];
  db.Trames = db.Trames || [];
  if (db.Types_Trames.length || db.Trames.length) return db;
  db.Types_Trames = TYPES_TRAMES_PAR_DEFAUT.map((t) => ({ ...t }));
  db.Trames = TRAMES_PAR_DEFAUT.map((t) => ({ ...t }));
  return db;
}

/**
 * Passe de nettoyage des colonnes de HTML rendu tel quel (NC-0006).
 *
 * Les textes de trames, de documents et les feuilles de style déjà enregistrés
 * — y compris ceux venus d'un import ou d'une édition directe de la table
 * Grist — sont réassainis au chargement : tout balisage actif en est retiré.
 * La passe est idempotente, et ne touche qu'à ces colonnes : les valeurs de
 * données, elles, sont échappées au rendu.
 */
export function assainirRiche(db) {
  for (const [name, rows] of Object.entries(db)) {
    const cols = (SCHEMA[name]?.columns || []).filter((c) => COLONNES_RICHES.has(c.id) && !c.formula);
    if (!cols.length) continue;
    for (const row of rows || []) {
      for (const col of cols) {
        const v = row[col.id];
        if (typeof v !== "string" || !v) continue;
        const s = assainirHtmlSecurite(v);
        if (s !== v) row[col.id] = s;
      }
    }
  }
  return db;
}

/**
 * Installe les catalogues livrés (sanctions, motifs) dans une base qui n'en a
 * aucun — même logique que `ensureParametres` et `ensureTramesParDefaut` : les
 * contenus **livrés** sont posés dans toute base neuve, y compris en
 * production. Une base qui a déjà un catalogue n'est jamais touchée (voir
 * `planAlignementCatalogue` pour l'aligner sur les textes).
 */
export function ensureCatalogues(db) {
  db.Sanctions = db.Sanctions || [];
  if (!db.Sanctions.length) db.Sanctions = SANCTIONS_PAR_DEFAUT.map((s, i) => ({ id: i + 1, ...s }));
  db.Motifs = db.Motifs || [];
  if (!db.Motifs.length) db.Motifs = MOTIFS_PAR_DEFAUT.map((m, i) => ({ id: i + 1, ...m }));
  return db;
}

export function seedDb() {
  const db = emptyDb();
  for (const [name, rows] of Object.entries(SEED)) {
    if (!SCHEMA[name]) continue;
    db[name] = clone(rows).map((r, i) => ({ id: r.id ?? i + 1, ...r }));
  }
  const base = ensureParametres(ensureCatalogues(ensureTramesParDefaut(assainirRiche(migrerDb(renumber(db))))));
  // Le jeu d'exemple est **le** reflet de la livraison : il reçoit les contenus
  // livrés qui manqueraient à sa génération (trames, formats, catalogues) et
  // voit sa programmation de trames remise d'aplomb. C'est ce qui garantit
  // qu'une base de démonstration neuve n'affiche jamais « contenus plus
  // récents » (NC-0005) — et que les comptages de la documentation valent pour
  // elle (NC-0015).
  return appliquerPlanContenus(base, planAlignementContenus(base));
}

/**
 * Base neuve **sans jeu d'exemple** : toutes les tables vides, mais les
 * contenus livrés (trames, types de trames, seuils) en place. C'est la base
 * d'un environnement de production (NC-0008) — elle se remplit par la saisie
 * ou par un import, jamais par des données fictives.
 */
export function baseVide() {
  return ensureParametres(ensureCatalogues(ensureTramesParDefaut(renumber(emptyDb()))));
}

/**
 * Écrit une ligne dans le registre `Journal`.
 *
 * Appelée explicitement par les actions de l'interface, jamais depuis les
 * formules ni depuis un écouteur du magasin : la journalisation est une
 * conséquence de l'action, pas de l'écriture, ce qui évite toute récursion.
 */
export function journaliser(store, { action, table = null, id = null, resume = "" } = {}) {
  if (!store || store.isReadOnly() || store._journaling) return null;
  store._journaling = true;
  try {
    const def = table ? SCHEMA[table] : null;
    const row = store.addRow("Journal", {
      Date: new Date().toISOString(),
      Action: action || "",
      Table: table || "",
      Table_libelle: def?.label || "",
      Enregistrement: id === null || id === undefined ? "" : String(id),
      Auteur: store.auteur || "",
      Resume: resume,
    });
    if (store.mode !== "grist") {
      const rows = store.table("Journal");
      if (rows.length > JOURNAL_MAX) {
        rows.splice(0, rows.length - JOURNAL_MAX);
        store.toucherTable("Journal");
        store.invaliderIndex("Journal");
      }
    }
    return row;
  } finally {
    store._journaling = false;
  }
}

/* ------------------------------------------------------------------ */
/* Préférences d'interface                                             */
/* ------------------------------------------------------------------ */

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn("Préférences non conservées :", err);
  }
}

/* ------------------------------------------------------------------ */
/* Échec d'écriture locale et occupation du stockage (NC-0024)         */
/* ------------------------------------------------------------------ */
/*
 * localStorage a un plafond (souvent 5 Mio). Passé ce plafond, `setItem` lève
 * une exception que rien ne montrait : la séance de saisie partait en fumée à
 * la fermeture de l'onglet, et le secrétariat croyait avoir enregistré. L'échec
 * est désormais porté à l'interface (bandeau persistant avec sa cause),
 * inscrit au Journal, et repris au journal de diagnostic. L'occupation est
 * mesurée pour avertir avant que le plafond ne soit atteint.
 */

/** Plafond usuel du stockage local d'une origine (environ 5 Mio). */
export const QUOTA_LOCAL_SUPPOSE = 5 * 1024 * 1024;

/** Seuils d'occupation, en proportion du plafond estimé. */
export const SEUILS_STOCKAGE = { avertissement: 0.6, critique: 0.85 };

let derniereErreurStockage = "";
let reporterStockage = null;

/** Branche le signalement des échecs d'écriture locale sur l'interface. */
export function setStockageReporter(fn) {
  reporterStockage = fn;
}

/** Dernier échec d'enregistrement local, vide s'il n'y en a pas. */
export function erreurStockage() {
  return derniereErreurStockage;
}

/** Efface l'échec d'enregistrement local (après une écriture réussie). */
export function effacerErreurStockage() {
  if (!derniereErreurStockage) return;
  derniereErreurStockage = "";
  if (reporterStockage) reporterStockage("");
}

/** Message lisible décrivant un échec de `localStorage.setItem`. */
export function messageErreurStockage(err) {
  const quota = !!err && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || err.code === 22 || err.code === 1014);
  return quota
    ? "Le stockage du navigateur est plein : les modifications n'ont pas pu être enregistrées sur ce poste."
    : `Le stockage du navigateur a refusé l'enregistrement (${(err && err.message) || err}).`;
}

/**
 * Niveau d'occupation pour un nombre d'octets donnés, rapporté au plafond
 * estimé. Fonction pure, pour être éprouvée sans écrire dans le navigateur.
 */
export function niveauOccupation(octets, quota = QUOTA_LOCAL_SUPPOSE) {
  const ratio = quota > 0 ? octets / quota : 0;
  const niveau = ratio >= SEUILS_STOCKAGE.critique ? "critique"
    : ratio >= SEUILS_STOCKAGE.avertissement ? "avertissement" : "normal";
  return { octets, quota, ratio, niveau };
}

/**
 * Occupation du stockage local par la base : les octets de la base sérialisée,
 * rapportés au plafond usuel des navigateurs (5 Mio), faute de pouvoir lire le
 * plafond réel. En mode session, rien n'est conservé : l'occupation est nulle.
 */
export function occupationStockage() {
  let octets = 0;
  try {
    octets = (localStorage.getItem(STORAGE_KEY) || "").length;
  } catch {
    octets = 0;
  }
  return niveauOccupation(octets);
}

/* ------------------------------------------------------------------ */
/* Magasin                                                             */
/* ------------------------------------------------------------------ */

export class Store {
  constructor() {
    this.listeners = new Set();
    this.mode = "local";
    // Positionné quand le rôle de l'utilisateur interdit toute modification
    // (« visiteur ») : plus rien ne part vers le document, même si un
    // événement d'interface était déclenché par inadvertance.
    this.readOnly = false;
    // Contrôle direct du droit d'écriture, évalué à chaque tentative : le
    // magasin ne peut ainsi jamais diverger de l'état réel des permissions,
    // quel que soit le chemin de code qui les a modifiées.
    this.readOnlyCheck = null;
    this.dirty = false;
    // Index par identifiant, table par table (voir `index`).
    this._index = new Map();
    // Version de chaque table, pour les index de lecture des vues.
    this._revisions = new Map();
    // Mode **session** (NC-0009) : la base n'est pas écrite dans le navigateur.
    // Elle vit en mémoire pour la durée de l'onglet, et rien n'en subsiste à la
    // fermeture. Le réglage est mémorisé avec les préférences d'interface.
    this.modeSession = !!loadPrefs().modeSession;
    if (this.modeSession && this.mode === "local") {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
    }
    this.db = this.modeSession
      ? (enRecette() ? seedDb() : baseVide())
      : this.loadLocal();
  }

  /**
   * Active ou désactive le **mode session** (NC-0009). En l'activant, la base
   * enregistrée dans le navigateur est effacée : rien ne reste sur le poste.
   * En le désactivant, la base en mémoire est écrite à nouveau.
   */
  setModeSession(actif) {
    this.modeSession = !!actif;
    if (this.modeSession) this.clearStorage();
    else this.persist();
    return this.modeSession;
  }

  /** Une écriture est-elle interdite au rôle courant ? */
  isReadOnly() {
    if (this.readOnly) return true;
    return this.readOnlyCheck ? !!this.readOnlyCheck() : false;
  }

  loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const db = emptyDb();
        for (const name of Object.keys(SCHEMA)) db[name] = (parsed[name] || []).map((r) => ({ ...r }));
        return ensureParametres(ensureCatalogues(ensureTramesParDefaut(assainirRiche(migrerDb(db)))));
      }
    } catch (err) {
      console.warn("Base locale illisible.", err);
    }
    // Le **jeu d'exemple** n'est posé qu'en environnement de recette (NC-0008) :
    // une base de production neuve reste vide, et se remplit par la saisie ou
    // par un import. Les contenus **livrés** (trames, seuils) sont installés
    // dans tous les cas : ils ne sont pas des données de démonstration.
    return enRecette() ? seedDb() : baseVide();
  }

  persist() {
    // Mode session : rien n'est écrit dans le navigateur (NC-0009).
    if (this.mode !== "local" || this.modeSession) return;
    // Pendant un lot, on note simplement qu'il y a du travail : les milliers
    // d'écritures d'un import ne doivent pas sérialiser la base autant de fois.
    if (this._batching) {
      this.dirty = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
      this.dirty = false;
      // Un enregistrement réussi efface l'alerte affichée après un échec.
      effacerErreurStockage();
    } catch (err) {
      console.warn("Enregistrement local impossible", err);
      const message = messageErreurStockage(err);
      if (message !== derniereErreurStockage) {
        derniereErreurStockage = message;
        if (reporterStockage) reporterStockage(message);
      }
    }
  }

  /**
   * Supprime la base enregistrée dans le navigateur. Le jeu de données
   * d'exemple sera reconstruit au prochain chargement. Réservé à l'onglet
   * Debug : volontairement hors du garde-fou de lecture seule.
   */
  clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Suppression du stockage local impossible", err);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    if (this._batching) return;
    for (const fn of this.listeners) fn(this);
  }

  /**
   * Regroupe plusieurs écritures : les écouteurs ne sont prévenus qu'une fois,
   * à la sortie du lot. Sans cela, un import de mille lignes reconstruirait la
   * page mille fois (le document, lui, reçoit bien une écriture par ligne).
   */
  batch(fn) {
    this._batching = true;
    try {
      return fn();
    } finally {
      this._batching = false;
      // Une seule écriture différée, pour solder tout ce que le lot a changé.
      if (this.dirty) this.persist();
      this.emit();
    }
  }

  table(name) {
    return this.db[name] || (this.db[name] = []);
  }

  /**
   * Table indexée par identifiant.
   *
   * Une fiche se cherche des milliers de fois par rendu — chaque référence
   * d'une colonne, chaque ligne d'une liste, chaque contrôle de régularité — et
   * un balayage complet à chaque fois coûtait cher dès quelques centaines de
   * lignes. L'index est reconstruit quand la table a changé de taille : les
   * lignes gardent leur objet (une modification en place ne l'invalide pas),
   * seuls l'ajout et la suppression le font.
   */
  index(name) {
    const rows = this.table(name);
    const entree = this._index.get(name);
    if (entree && entree.taille === rows.length) return entree.map;
    const map = new Map(rows.map((r) => [Number(r.id), r]));
    this._index.set(name, { taille: rows.length, map });
    return map;
  }

  /** Oublie l'index d'une table : ses lignes viennent de changer. */
  invaliderIndex(name) {
    this._index.delete(name);
  }

  /** Oublie tous les index : la base entière vient d'être remplacée. */
  invaliderTousLesIndex() {
    this._index.clear();
  }

  /**
   * Version d'une table, incrémentée à chaque écriture.
   *
   * Les index de lecture (voir `formulas.js`) s'y appuient : une table peut
   * changer sans changer de taille — une ligne qui change de parent, par
   * exemple —, et la taille seule ne suffirait donc pas à dire si un index est
   * encore valable. L'index par identifiant du magasin, lui, n'a pas besoin
   * d'être refait à chaque modification : les lignes y gardent leur objet. Seuls
   * l'ajout et la suppression le changent, et ceux-là l'invalident (voir
   * `addRow` et `removeRow`).
   */
  revision(name) {
    return this._revisions.get(name) || 0;
  }

  /** Signale qu'une table vient d'être modifiée. */
  toucherTable(name) {
    this._revisions.set(name, this.revision(name) + 1);
  }

  byId(name, id) {
    const cle = Number(id);
    if (!cle) return null;
    return this.index(name).get(cle) || null;
  }

  nextId(name) {
    // En mode Grist, les identifiants locaux sont négatifs : ils ne peuvent
    // donc pas entrer en collision avec les identifiants attribués par Grist
    // (toujours positifs) en attendant la réponse du serveur.
    if (this.mode === "grist") {
      this.uid = (this.uid || 0) + 1;
      return -this.uid;
    }
    let max = 0;
    for (const id of this.index(name).keys()) if (id > max) max = id;
    return max + 1;
  }

  /** Crée une ligne ; renvoie la ligne créée. */
  addRow(name, data = {}) {
    if (this.isReadOnly()) return null;
    const row = { id: this.nextId(name), ...data };
    this.table(name).push(row);
    this.toucherTable(name);
    this.invaliderIndex(name);
    this.propagerMiroirs(name, row.id, data);
    this.afterWrite({ type: "add", table: name, id: row.id, data: row });
    return row;
  }

  updateRow(name, id, patch, { silent = false } = {}) {
    if (this.isReadOnly()) return null;
    const row = this.byId(name, id);
    if (!row) return null;
    const old = this.mode === "grist" && this.onGristWrite ? Object.fromEntries(Object.keys(patch).map((k) => [k, row[k]])) : null;
    Object.assign(row, patch);
    this.toucherTable(name);
    this.propagerMiroirs(name, row.id, patch);
    this.afterWrite(old
      ? { type: "update", table: name, id: row.id, patch, old }
      : { type: "update", table: name, id: row.id, patch });
    if (silent) this.emit();
    return row;
  }

  /**
   * Écriture silencieuse : la valeur est enregistrée et transmise au document
   * Grist, mais aucun rendu n'est déclenché. C'est ce qu'attend l'éditeur
   * WYSIWYG des trames, qui ne peut pas voir `#app` reconstruit sous son
   * curseur à chaque frappe.
   */
  updateRowQuiet(name, id, patch) {
    if (this.isReadOnly()) return null;
    const row = this.byId(name, id);
    if (!row) return null;
    const old = this.mode === "grist" && this.onGristWrite ? Object.fromEntries(Object.keys(patch).map((k) => [k, row[k]])) : null;
    Object.assign(row, patch);
    this.toucherTable(name);
    this.propagerMiroirs(name, row.id, patch);
    this.dirty = true;
    this.persist();
    if (this.mode === "grist" && this.onGristWrite) {
      this.onGristWrite(old
        ? { type: "update", table: name, id: row.id, patch, old }
        : { type: "update", table: name, id: row.id, patch });
    }
    return row;
  }

  /**
   * Les deux faces d'une même relation.
   *
   * Une secrétaire suit des sections, et une section a ses secrétaires : ce sont
   * deux colonnes `RefList` pour **une** relation. Les laisser diverger
   * donnerait deux vérités — on rattacherait une secrétaire à une section sans
   * qu'elle apparaisse sur la fiche de la section, et l'affectation semblerait
   * n'avoir pas pris. Une colonne qui déclare `miroir` (`schema.js`) tient donc
   * l'autre à jour : ce qui s'écrit d'un côté se lit de l'autre.
   *
   * La propagation ne remplace jamais la liste d'en face : elle y **ajoute** ou
   * en **retire** l'identifiant concerné, et laisse le reste tel quel — une
   * colonne miroir peut porter d'autres rattachements, qu'un écran ne montre
   * pas forcément.
   */
  propagerMiroirs(name, id, patch) {
    const defs = SCHEMA[name]?.columns || [];
    for (const def of defs) {
      if (!def.miroir || !patch || !(def.id in patch)) continue;
      const [tableCible, colCible] = String(def.miroir).split(".");
      if (!tableCible || !colCible) continue;
      const voulus = new Set(idsDeRefList(patch[def.id]));
      let touche = false;
      for (const autre of this.table(tableCible)) {
        const liste = idsDeRefList(autre[colCible]);
        const attendu = voulus.has(Number(autre.id));
        const present = liste.includes(Number(id));
        if (attendu === present) continue;
        autre[colCible] = attendu
          ? [...liste, Number(id)]
          : liste.filter((x) => x !== Number(id));
        touche = true;
        // Écriture directe, sans repasser par `updateRow` : la propagation ne
        // doit ni rejouer les autres miroirs, ni se rappeler elle-même.
        if (this.mode === "grist" && this.onGristWrite) {
          this.onGristWrite({ type: "update", table: tableCible, id: autre.id, patch: { [colCible]: autre[colCible] } });
        }
      }
      if (touche) this.toucherTable(tableCible);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Corbeille                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Met une ligne à la corbeille : elle quitte sa table, **entière** — son
   * identifiant compris —, et passe dans `Corbeille` avec sa date et son
   * auteur. Rien n'est détruit : c'est ce qui permet de la restaurer à
   * l'identique, et de retrouver du même coup les documents qui la citent.
   *
   * Contrairement à `deleteRow`, aucune table enfant n'est entraînée : mettre
   * une trame à la corbeille ne doit pas emporter les documents qui s'en
   * servent — ils se rabattent sur « pas de trame » tant qu'elle y est, et la
   * retrouvent au retour.
   */
  mettreALaCorbeille(name, id, { par = "" } = {}) {
    if (this.isReadOnly()) return null;
    const rows = this.table(name);
    const i = rows.findIndex((r) => Number(r.id) === Number(id));
    if (i === -1) return null;
    const [row] = rows.splice(i, 1);
    this.toucherTable(name);
    this.invaliderIndex(name);
    if (this.mode === "grist" && this.onGristWrite) {
      this.onGristWrite({ type: "delete", table: name, id: row.id, cascade: [] });
    }
    const entree = {
      Nom: libelleDeLigne(name, row),
      Table: name,
      Table_libelle: SCHEMA[name]?.label || name,
      Supprime_le: new Date().toISOString(),
      Supprime_par: par,
      Contenu: JSON.stringify(row),
    };
    const cible = { id: this.nextId("Corbeille"), ...entree };
    this.table("Corbeille").push(cible);
    this.toucherTable("Corbeille");
    this.invaliderIndex("Corbeille");
    this.afterWrite({ type: "add", table: "Corbeille", id: cible.id, data: cible });
    return cible;
  }

  /**
   * Rend une entrée de la corbeille à sa table, telle qu'elle était. Si
   * l'identifiant d'origine est déjà repris — ce qui ne devrait pas arriver,
   * les identifiants n'étant pas réutilisés —, la ligne reçoit un identifiant
   * neuf plutôt que d'écraser une autre.
   */
  restaurerCorbeille(id) {
    if (this.isReadOnly()) return null;
    const entree = this.byId("Corbeille", id);
    if (!entree) return null;
    let row;
    try {
      row = JSON.parse(String(entree.Contenu || "{}"));
    } catch {
      return null;
    }
    const table = String(entree.Table || "");
    if (!SCHEMA[table] || !row || typeof row !== "object") return null;
    if (this.byId(table, row.id)) row.id = this.nextId(table);
    this.table(table).push(row);
    this.toucherTable(table);
    this.invaliderIndex(table);
    if (this.mode === "grist" && this.onGristWrite) {
      this.onGristWrite({ type: "add", table, id: row.id, data: row });
    }
    this.retirerDeLaCorbeille(id);
    return row;
  }

  /** Efface une entrée de la corbeille : cette fois, c'est définitif. */
  retirerDeLaCorbeille(id) {
    if (this.isReadOnly()) return;
    const rows = this.table("Corbeille");
    const i = rows.findIndex((r) => Number(r.id) === Number(id));
    if (i === -1) return;
    const [row] = rows.splice(i, 1);
    this.toucherTable("Corbeille");
    this.invaliderIndex("Corbeille");
    this.afterWrite({ type: "delete", table: "Corbeille", id: row.id, cascade: [] });
  }

  /** Vide la corbeille : tout ce qu'elle contient est perdu. */
  viderCorbeille() {
    if (this.isReadOnly()) return 0;
    const rows = [...this.table("Corbeille")];
    for (const row of rows) this.retirerDeLaCorbeille(row.id);
    return rows.length;
  }

  deleteRow(name, id) {
    if (this.isReadOnly()) return;
    const cascade = [];
    this.removeRow(name, id, cascade);
    this.afterWrite({ type: "delete", table: name, id, cascade });
  }

  /** Supprime une ligne et, récursivement, les lignes des tables enfants. */
  removeRow(name, id, cascade) {
    const rows = this.table(name);
    const i = rows.findIndex((r) => Number(r.id) === Number(id));
    if (i === -1) return;
    rows.splice(i, 1);
    this.toucherTable(name);
    this.invaliderIndex(name);
    for (const [child, def] of Object.entries(SCHEMA)) {
      if (def.parent?.table !== name) continue;
      const doomed = this.table(child).filter((r) => Number(r[def.parent.column]) === Number(id));
      for (const row of doomed) {
        this.removeRow(child, row.id, cascade);
        cascade.push({ table: child, id: row.id });
      }
    }
  }

  afterWrite(action) {
    this.dirty = true;
    this.persist();
    this.emit();
    if (this.mode === "grist" && this.onGristWrite) this.onGristWrite(action);
  }

  replaceAll(db) {
    if (this.isReadOnly()) return;
    this.db = assainirRiche(migrerDb(renumber(db)));
    this.invaliderTousLesIndex();
    // Toutes les versions avancent : un index de lecture construit avant le
    // remplacement ne doit jamais passer pour valable après.
    for (const name of Object.keys(this.db)) this._revisions.set(name, this.revision(name) + 1);
    this.persist();
    this.emit();
    // En mode Grist, la base locale n'est qu'une copie de travail : un
    // remplacement doit atteindre le document, sinon la réécriture suivante
    // (au rechargement) ramènerait l'état d'avant. Voir `remplacerDocument`.
    if (this.mode === "grist" && this.onGristReplace) this.onGristReplace();
  }

  /**
   * Adopte la base lue dans le document Grist.
   *
   * Comme `replaceAll`, mais sans prévenir le document — la lecture vient de
   * lui —, et sans écrire dans le navigateur : en mode Grist, la base locale
   * n'est qu'une copie de travail.
   */
  loadFromDocument(db) {
    this.db = assainirRiche(migrerDb(db));
    this.invaliderTousLesIndex();
    for (const name of Object.keys(this.db)) this._revisions.set(name, this.revision(name) + 1);
    this.emit();
  }

  resetToSeed() {
    this.replaceAll(seedDb());
  }

  clearAll() {
    this.replaceAll(emptyDb());
  }

  exportJson() {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tables: this.db }, null, 2);
  }

  importJson(text) {
    const parsed = JSON.parse(text);
    const tables = parsed.tables || parsed;
    const db = emptyDb();
    for (const name of Object.keys(SCHEMA)) {
      db[name] = (tables[name] || []).map((r) => ({ ...r }));
    }
    this.replaceAll(db);
  }
}

/* ------------------------------------------------------------------ */
/* Compteurs de démonstration                                         */
/* ------------------------------------------------------------------ */

export function stats(db) {
  return {
    sections: (db.Sections_disciplinaires || []).length,
    membres: (db.Membres || []).length,
    affaires: (db.Affaires || []).length,
    decisions: (db.Decisions || []).length,
    documents: (db.Generateur || []).length,
    trames: (db.Trames || []).length,
  };
}
