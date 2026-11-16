// Moteur de colonnes calculées.
//
// Les colonnes marquées `formula: true` dans `schema.js` ne sont jamais
// écrites : elles sont recalculées ici, paresseusement et avec mémoïsation.
//
// Deux principes gouvernent ce fichier :
//
//  - **Les balises restent, le rangement change.** L'identité du mis en cause
//    vit désormais dans `Personnes`, mais `Affaires.Nom_complet`, `.INE`,
//    `.Adresse`… continuent d'exister en tant que colonnes calculées : les
//    `{{Affaire}}.INE` posées dans les trames n'ont pas à être réécrites.
//  - **Les seuils ne sont pas dans le code.** Prescription, délais, durées du
//    blâme et du mois se lisent dans `Parametres` (voir `parametre` ci-dessous).
//
// La composition d'une affaire se lit dans `Intervenants` ; tant qu'une
// affaire n'a pas été convertie, la lecture retombe sur la table d'origine
// `Commissions`, ce qui permet de rouvrir un document non migré sans rien
// perdre (voir `src/legacy.js`).

import { SCHEMA, NATURE_INTERLOCUTOIRE, TYPE_ACADEMIQUE, estCloseEtat, estSusceptibleDeRecours, idsDeRefList } from "./schema.js";
import { LEGACY_ROLES_INTERVENANT } from "./legacy.js";
import { procedure, suitProcedureR811_40, juridictionRecours } from "./procedure.js";

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10) + "T00:00:00");
  const n = Number(v);
  if (!Number.isNaN(n) && n > 0) return new Date(n * 1000);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isoDate(v) {
  const d = toDate(v);
  if (!d) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Date du jour, au fuseau de l'utilisateur, au format ISO `AAAA-MM-JJ`.
 *
 * `toISOString()` lit l'heure UTC : passé minuit en France, il annonce encore
 * la veille. Une date de calendrier se lit donc avec les getters locaux — sans
 * quoi la date proposée par défaut serait celle d'hier pendant la première
 * heure de la journée.
 */
export function aujourdHui() {
  return isoDate(new Date());
}

/**
 * Le quantième d'une date française : « 1er » le premier du mois, puis « 2 »,
 * « 3 »… — jamais « 01 », « 02 ». C'est la forme de l'état civil et de la
 * rédaction administrative ; les champs de saisie (`JJ/MM/AAAA`) et les dates
 * chiffrées gardent, eux, leurs zéros.
 */
export function jourDuMoisFr(n) {
  return Number(n) === 1 ? "1er" : String(n);
}

export function formatDateFr(v) {
  const d = toDate(v);
  if (!d) return "";
  return `${jourDuMoisFr(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTimeFr(v) {
  const d = toDate(v);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${jourDuMoisFr(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} à ${p(d.getHours())}h${p(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* Dates saisies à la main                                             */
/* ------------------------------------------------------------------ */

/**
 * Date telle qu'elle s'écrit dans un champ : `JJ/MM/AAAA`.
 *
 * Les champs de date de l'outil sont des champs de texte, et non des champs
 * natifs `type="date"` : le champ natif n'accepte le collage que d'une date au
 * format international, refuse une date française tapée d'un trait, et vide ce
 * qu'on vient de saisir dès que la valeur lui paraît incomplète — au moment
 * précis où l'on tape l'année. La saisie est donc reçue en clair et ramenée
 * ici à la forme la plus lisible.
 */
export function formatDateSaisie(v) {
  const d = toDate(v);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Compose une date ISO `AAAA-MM-JJ` à partir de ses trois nombres, ou `null`
 * si cette date n'existe pas (le 31 février, par exemple : le calendrier
 * JavaScript la reporterait au 2 mars, on préfère la refuser).
 *
 * Une année sur deux chiffres est complétée avec un basculement placé à 40,
 * comme dans un tableur : « 26 » vaut 2026, « 98 » vaut 1998 — les dates de
 * naissance des usagers récents comme les dates anciennes d'un dossier
 * tombent du bon côté.
 */
function dateIso(jour, mois, annee) {
  const a = annee < 100 ? annee + (annee < 40 ? 2000 : 1900) : annee;
  if (!(a >= 1000 && a <= 9999) || mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(a, mois - 1, jour));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${a}-${p(mois)}-${p(jour)}`;
}

/**
 * Analyse une date saisie à la main et la ramène au format ISO `AAAA-MM-JJ`
 * — celui qu'attendent le magasin et Grist. Renvoie `null` si le texte est
 * vide ou ne décrit pas une date réelle.
 *
 * Sont acceptées toutes les écritures courantes, pour qu'un collage
 * fonctionne toujours et qu'une date puisse être tapée d'un trait :
 *
 *   - française, avec un séparateur quelconque : 20/09/2026, 20-9-2026, 20.09.26 ;
 *   - à la suite, sans séparateur : 20092026, 200926 (année sur deux chiffres) ;
 *   - internationale : 2026-09-20, 2026/9/20 ;
 *   - l'horodatage d'une date récupérée ailleurs : 2026-09-20T00:00:00Z.
 */
export function parseDateSaisie(texte) {
  const s = String(texte ?? "").trim();
  if (!s) return null;
  const horodatage = s.match(/^(\d{4})-(\d{2})-(\d{2})([T ].*)?$/);
  if (horodatage) return dateIso(Number(horodatage[3]), Number(horodatage[2]), Number(horodatage[1]));
  const parties = s.split(/[^\d]+/).filter(Boolean);
  if (parties.length === 3) {
    const [x, y, z] = parties;
    // Quatre chiffres en tête : c'est l'année, la date est internationale.
    if (x.length === 4) return dateIso(Number(z), Number(y), Number(x));
    // Quatre chiffres (ou deux) à la fin : la date est française.
    if (z.length === 4 || z.length === 2) return dateIso(Number(x), Number(y), Number(z));
    return null;
  }
  if (parties.length === 1) {
    const n = parties[0];
    if (n.length === 8) {
      // `JJMMAAAA` d'abord ; à défaut `AAAAMMJJ`, la seconde lecture n'étant
      // retenue que si la première ne donne pas une date du calendrier.
      return dateIso(Number(n.slice(0, 2)), Number(n.slice(2, 4)), Number(n.slice(4)))
        || dateIso(Number(n.slice(6, 8)), Number(n.slice(4, 6)), Number(n.slice(0, 4)));
    }
    if (n.length === 6) return dateIso(Number(n.slice(0, 2)), Number(n.slice(2, 4)), Number(n.slice(4)));
  }
  return null;
}

function joinList(values, sep = ", ") {
  return (values || []).filter((v) => v !== null && v !== undefined && v !== "").join(sep);
}

function addYears(d, years) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + Math.round(years));
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + Math.round(days));
  return x;
}

function addMonths(d, months) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + Math.round(months));
  return x;
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const today = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

function monsieurMadame(genre) {
  if (genre === "M") return "Monsieur";
  if (genre === "F") return "Madame";
  return "";
}

/* ------------------------------------------------------------------ */
/* Paramètres                                                          */
/* ------------------------------------------------------------------ */

/** Valeur d'un paramètre par sa clé technique (`Cle`). */
export function parametre(db, cle, defaut = null) {
  const row = (db?.Parametres || []).find((p) => p.Cle === cle);
  if (!row || row.Valeur === undefined || row.Valeur === null || row.Valeur === "") return defaut;
  return row.Valeur;
}

/** Valeur numérique d'un paramètre (la virgule décimale est acceptée). */
export function parametreNumerique(db, cle, defaut = 0) {
  const v = parametre(db, cle, defaut);
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : defaut;
}

/* ------------------------------------------------------------------ */
/* Contexte d'évaluation                                               */
/* ------------------------------------------------------------------ */

export class Context {
  constructor(db, store = null) {
    this.db = db;
    // Magasin d'où vient la base, quand il est connu : sa version de chaque
    // table dit à l'index de lecture s'il est encore valable (voir `indexDe`).
    this.store = store;
    this.cache = new Map();
    this.stack = new Set();
    // Index de lecture, construits à la demande : par identifiant, et par
    // parent pour les tables enfants. Une colonne calculée remonte des
    // références pour chaque ligne affichée ; sans index, chaque remontée
    // balayait la table entière (voir `byId` et `children`).
    this.index = new Map();
    this.enfants = new Map();
  }

  table(name) {
    return this.db[name] || [];
  }

  /** Version d'une table : `null` quand le magasin n'est pas connu. */
  version(name) {
    return this.store ? this.store.revision(name) : null;
  }

  /**
   * Index { identifiant → ligne } d'une table.
   *
   * Reconstruit dès que la table a changé — la version du magasin le dit,
   * quand il est connu, la taille de la table sinon : une ligne garde son
   * objet, seuls l'ajout et la suppression changent la table.
   */
  indexDe(name) {
    const rows = this.table(name);
    const version = this.version(name);
    const entree = this.index.get(name);
    if (entree && (version === null ? entree.taille === rows.length : entree.version === version)) return entree.map;
    const map = new Map(rows.map((r) => [Number(r.id), r]));
    this.index.set(name, { version, taille: rows.length, map });
    return map;
  }

  byId(name, id) {
    // L'identifiant peut être donné sous forme d'enregistrement : les colonnes
    // calculées qui renvoient une référence — `Generateur.Decision`, par
    // exemple — rendent l'enregistrement lui-même, et non son identifiant.
    const cle = id && typeof id === "object" ? id.id : id;
    if (!cle) return null;
    return this.indexDe(name).get(Number(cle)) || null;
  }

  /** Valeur d'une colonne (calculée si formule). */
  v(name, rec, col) {
    if (!rec) return null;
    const def = (SCHEMA[name]?.columns || []).find((c) => c.id === col);
    if (!def) return rec[col];
    if (!def.formula) return rec[col] ?? null;
    const key = `${name}:${rec.id}:${col}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.stack.has(key)) return null;
    this.stack.add(key);
    let value = null;
    try {
      value = FORMULAS[name]?.[col]?.(this, name, rec) ?? null;
    } catch (err) {
      console.warn(`Formule ${name}.${col} (ligne ${rec.id}) :`, err);
      value = null;
    }
    this.stack.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Valeur d'une colonne, lue sur un enregistrement **brut** : la valeur
   * calculée quand elle porte quelque chose, sinon le champ de l'enregistrement
   * lui-même.
   *
   * Une colonne calculée n'est jamais écrite dans la base. Une ligne antérieure
   * à une reprise peut donc garder un texte utile dans son champ brut alors que
   * la formule, elle, ne trouve plus ce qu'elle lisait — l'état civil d'une
   * affaire, tenu avant que `Personnes` ne le porte, par exemple. Les écrans qui
   * lisent un enregistrement brut — le registre des actes (`actes.js`), l'état
   * pour versement (`conservation.js`) — passent par ici : `c.ref(…).Nom_complet`
   * ou `ligne.Nom_complet`, sur une colonne calculée, rendaient un nom vide.
   */
  vOuBrut(name, rec, col) {
    if (!rec) return null;
    const calcule = this.v(name, rec, col);
    if (calcule !== null && calcule !== undefined && calcule !== "") return calcule;
    return rec[col] ?? null;
  }

  /** Enregistrement référencé par une colonne Ref. */
  ref(name, rec, col) {
    const raw = rec?.[col];
    if (!raw) return null;
    const target = SCHEMA[name]?.columns.find((c) => c.id === col)?.type?.split(":")[1];
    return target ? this.byId(target, raw) : null;
  }

  /** Enregistrements référencés par une colonne RefList. */
  refList(name, rec, col) {
    const raw = rec?.[col];
    if (!raw) return [];
    const ids = Array.isArray(raw) ? raw : String(raw).replace(/[[\]]/g, "").split(",");
    const target = SCHEMA[name]?.columns.find((c) => c.id === col)?.type?.split(":")[1];
    if (!target) return [];
    return ids.map((id) => this.byId(target, id)).filter(Boolean);
  }

  /** Enregistrements d'une table enfant rattachés à `rec`. */
  children(childTable, rec) {
    if (!rec) return [];
    const parent = SCHEMA[childTable]?.parent;
    if (!parent) return [];
    const rows = this.table(childTable);
    const version = this.version(childTable);
    const entree = this.enfants.get(childTable);
    // Sans magasin, la version de la table est inconnue : rien ne permet de
    // dire si l'index est encore valable, il est donc reconstruit à chaque
    // appel — le résultat reste juste, c'est le balayage d'avant.
    if (!entree || version === null || entree.version !== version || entree.colonne !== parent.column) {
      const map = new Map();
      for (const r of rows) {
        const cle = Number(r[parent.column]);
        if (!cle) continue;
        const liste = map.get(cle);
        if (liste) liste.push(r); else map.set(cle, [r]);
      }
      this.enfants.set(childTable, { version, colonne: parent.column, map });
    }
    return this.enfants.get(childTable).map.get(Number(rec.id)) || [];
  }

  /** Recherche sur valeur brute (non calculée). */
  lookup(name, crit) {
    return this.table(name).filter((r) => Object.entries(crit).every(([k, v]) => r[k] === v));
  }

  /** Résolution d'un chemin « A.B.C ». */
  path(segments) {
    if (!segments.length) return null;
    let tableName = this.currentTable;
    let value = null;
    let rec = null;
    const [first, ...rest] = segments;
    // Une colonne de la table courante, ou une table de premier niveau.
    if (SCHEMA[tableName]?.columns.some((c) => c.id === first)) {
      rec = this.current;
      value = this.v(tableName, rec, first);
    } else if (SCHEMA[first]) {
      tableName = first;
      value = this.table(first);
    }
    if (!rest.length) return value;
    const def = (SCHEMA[tableName]?.columns || []).find((c) => c.id === first);
    const target = def?.type?.split(":")[1];
    if (Array.isArray(value)) {
      return value.map((row) => {
        const [next, ...more] = rest;
        return more.length ? this.pathOf(target, row, rest) : this.v(target, row, next);
      });
    }
    if (target && value) return this.pathOf(target, value, rest);
    return null;
  }

  pathOf(tableName, rec, segments) {
    if (!segments.length) return rec;
    const [first, ...rest] = segments;
    if (rest.length === 0) return this.v(tableName, rec, first);
    const def = SCHEMA[tableName]?.columns.find((c) => c.id === first);
    const target = def?.type?.split(":")[1];
    const next = target ? this.byId(target, rec[first]) : null;
    if (!next) {
      const list = target ? this.refList(tableName, rec, first) : [];
      if (list.length) return list.map((row) => this.pathOf(target, row, rest));
      return null;
    }
    return this.pathOf(target, next, rest);
  }
}

export class Chain extends Context {
  constructor(db, store = null) {
    super(db, store);
  }
}

// Contexte « lié » : mémorise la table et l'enregistrement courants.
class Bound extends Context {
  constructor(base, table, rec) {
    super(base.db, base.store);
    this.cache = base.cache;
    this.stack = base.stack;
    // Les index sont ceux du contexte d'origine : ils décrivent la même base,
    // et les reconstruire à chaque liaison reviendrait à ne pas les avoir.
    this.index = base.index;
    this.enfants = base.enfants;
    this.currentTable = table;
    this.current = rec;
  }
}

export function valueOf(ctx, table, rec, col) {
  return ctx.v(table, rec, col);
}

/* ------------------------------------------------------------------ */
/* Composition d'une affaire (intervenants, ou legacy)                 */
/* ------------------------------------------------------------------ */

/**
 * La composition d'une affaire, quelle que soit son origine.
 *
 * `Intervenants` fait foi dès qu'il existe au moins une ligne ; sinon la
 * lecture retombe sur `Commissions`, la table du document d'origine, afin
 * qu'une affaire non encore convertie s'affiche encore correctement.
 * Chaque entrée est normalisée : `{ nom, role, genre, qualite }`.
 */
export function intervenantsDe(ctx, affaire) {
  const modernes = ctx.children("Intervenants", affaire);
  if (modernes.length) {
    return modernes.map((x) => ({
      row: x,
      id: x.id,
      nom: str(ctx.v("Intervenants", x, "Nom_complet")).trim(),
      role: x.Role || "",
      statut: x.Statut || "",
      qualite: x.Qualite || "",
      genre: ctx.v("Intervenants", x, "Membre_Genre") || "",
      horsSection: !!ctx.v("Intervenants", x, "Hors_section"),
      legacy: false,
    }));
  }
  return ctx.children("Commissions", affaire).map((x) => ({
    row: x,
    id: x.id,
    nom: str(ctx.v("Commissions", x, "Membre_Nom_complet")).trim(),
    role: LEGACY_ROLES_INTERVENANT[x.Role] || x.Role || "Membre de la formation",
    statut: "",
    qualite: "",
    genre: ctx.v("Commissions", x, "Membre_Genre") || "",
    horsSection: false,
    legacy: true,
  }));
}

const ROLE_PRESIDENT = ["Président de la formation", "Président"];
const ROLE_MEMBRE = ["Membre de la formation", "Membre"];

function nomsDeRole(intervenants, roles) {
  return intervenants.filter((x) => roles.includes(x.role)).map((x) => x.nom);
}

/* ------------------------------------------------------------------ */
/* Jonction d'affaires                                                 */
/* ------------------------------------------------------------------ */
//
// Plusieurs affaires — chacune avec son numéro, son mis en cause et ses
// documents — jugées par **une même décision**. La jonction est portée par la
// table `Jonctions` : une affaire de tête, et les affaires qui la rejoignent.
//
// Rien n'est fusionné : ce qui change, c'est **quelle décision se lit**. Une
// affaire jointe n'a pas de décision propre ; elle lit celle de son affaire de
// tête. Défaire la jonction suffit donc à rendre à chaque affaire son
// indépendance — c'est ce qui rend l'opération réversible.

/**
 * Identifiants d'une colonne `RefList` : la même lecture que celle du modèle,
 * définie dans `schema.js` — c'est là que vivent les colonnes, et c'est elle
 * que lisent la reprise des données comme le magasin. Réexportée ici parce que
 * les écrans et les exports la prennent depuis ce fichier depuis l'origine.
 */
export { idsDeRefList } from "./schema.js";

/** Enregistrement d'une affaire par son identifiant. */
function affaireParId(db, id) {
  return (db?.Affaires || []).find((a) => Number(a.id) === Number(id)) || null;
}

/**
 * La jonction à laquelle appartient une affaire — comme affaire de tête ou
 * comme affaire jointe. Une affaire n'appartient qu'à une seule jonction.
 */
export function jonctionDe(db, affaire) {
  if (!affaire) return null;
  const id = Number(affaire.id);
  return (db?.Jonctions || []).find((j) =>
    Number(j.Affaire_de_tete) === id || idsDeRefList(j.Affaires_jointes).includes(id)) || null;
}

/**
 * Les affaires d'une jonction : l'affaire de tête d'abord, puis les affaires
 * jointes, dans l'ordre où elles ont été jointes.
 */
export function affairesDeJonction(db, jonction) {
  if (!jonction) return [];
  const tete = affaireParId(db, jonction.Affaire_de_tete);
  const jointes = idsDeRefList(jonction.Affaires_jointes)
    .filter((id) => Number(id) !== Number(jonction.Affaire_de_tete))
    .map((id) => affaireParId(db, id))
    .filter(Boolean);
  return [...(tete ? [tete] : []), ...jointes];
}

/** L'affaire de tête d'une affaire **jointe**, ou `null` si elle est la tête. */
export function affaireDeTeteDe(db, affaire) {
  const jonction = jonctionDe(db, affaire);
  if (!jonction || Number(jonction.Affaire_de_tete) === Number(affaire?.id)) return null;
  return affaireParId(db, jonction.Affaire_de_tete);
}

/**
 * Décision définitive d'une affaire, **jonction comprise** : la sienne si elle
 * en a une, celle de son affaire de tête sinon. C'est la décision unique rendue
 * pour l'ensemble des affaires jointes — celle que reprend une trame « Décision
 * définitive », quelle que soit l'affaire d'où le document part.
 */
export function decisionDefinitive(c, affaire) {
  if (!affaire) return null;
  const propre = c.children("Decisions", affaire).find((x) => String(x.Nature) !== NATURE_INTERLOCUTOIRE);
  if (propre) return propre;
  const tete = affaireDeTeteDe(c.db, affaire);
  if (!tete) return null;
  return c.children("Decisions", tete).find((x) => String(x.Nature) !== NATURE_INTERLOCUTOIRE) || null;
}

/* ------------------------------------------------------------------ */
/* Échéance d'instruction                                              */
/* ------------------------------------------------------------------ */

/**
 * Le délai d'instruction applicable à une section.
 *
 * Il vient de la **procédure** — deux mois devant les sections d'usagers,
 * quatre mois devant celles d'enseignants-chercheurs (`procedure.js`) —, sauf
 * si l'établissement l'a réglé autrement : `Parametres › delai_instruction_mois`
 * l'emporte dès qu'il porte une valeur supérieure à zéro.
 *
 * `depuis` dit de quel acte le décompte part. C'est la **décision de
 * désignation** — des rapporteurs, ou de la commission d'instruction : c'est
 * elle qui ouvre l'instruction, et non la saisine de la section.
 */
export function delaiInstruction(db, section) {
  const d = procedure(section);
  const regle = d.instruction || {};
  const choisi = parametreNumerique(db, "delai_instruction_mois", 0);
  return {
    mois: choisi > 0 ? choisi : (Number(regle.delaiMois) || 0),
    depuis: regle.delaiDepuis || "designation",
    designation: regle.delaiDesignation || "des rapporteurs",
    libelle: regle.libelle || "Instruction",
    texte: regle.delaiTexte || "",
    texteReference: regle.texte || "",
    regle: choisi > 0 ? "etablissement" : "procedure",
  };
}

/**
 * La **décision de désignation** qui ouvre l'instruction d'une affaire : le
 * premier document qu'elle porte produit avec une trame d'ouverture
 * (`Trames.Ouvre_l_instruction`) — la désignation des rapporteurs, ou celle de
 * la commission d'instruction.
 *
 * C'est la **date de ce document** qui fait courir le délai d'instruction.
 * Pour une affaire jointe, l'acte de l'affaire de tête ouvre aussi la sienne :
 * les affaires jointes sont instruites ensemble.
 *
 * Renvoie `null` tant que la désignation n'a pas été produite.
 */
export function ouvertureInstruction(c, affaire) {
  if (!c || !affaire) return null;
  const jetons = [...c.children("Generateur", affaire)];
  const tete = affaireDeTeteDe(c.db, affaire);
  if (tete && Number(tete.id) !== Number(affaire.id)) jetons.push(...c.children("Generateur", tete));
  const ouvertures = jetons
    .map((row) => ({ document: row, trame: c.ref("Generateur", row, "Template"), date: toDate(row.Date) }))
    .filter((x) => x.date && x.trame?.Ouvre_l_instruction);
  ouvertures.sort((a, b) => a.date.getTime() - b.date.getTime());
  return ouvertures[0] || null;
}

/**
 * Date de désignation du rapporteur, lorsque l'affaire ne porte pas encore sa
 * décision de désignation : c'est alors la fiche de l'intervenant qui la
 * garde, et elle en tient lieu. Devant une section d'enseignants-chercheurs,
 * le second membre de la commission d'instruction est désigné par le même
 * acte ; les autres intervenants — la formation qui jugera — n'ouvrent pas
 * l'instruction.
 */
function dateDesignationRapporteur(c, affaire) {
  const designes = intervenantsDe(c, affaire)
    .filter((x) => x.role === "Rapporteur" || x.role === "Membre de la commission d'instruction")
    .map((x) => ({ role: x.role, date: toDate(x.row?.Date_de_designation) }))
    .filter((x) => x.date);
  const celui = designes.find((x) => x.role === "Rapporteur") || designes[0];
  return celui ? celui.date : null;
}

/**
 * L'échéance d'instruction d'une affaire, et ce qui la fixe.
 *
 * L'instruction dure le délai de la procédure, **décompté depuis la décision
 * de désignation** qui l'ouvre — mais la **date butoir d'instruction** que
 * porte une pièce de l'affaire (la désignation des rapporteurs, un complément
 * ou un supplément d'instruction, le rapport lui-même, ou une décision avant
 * dire droit qui reporte le terme) **l'emporte sur cette échéance** : c'est le
 * terme que l'acte fixe, et il s'applique qu'il avance le terme ou qu'il le
 * recule. Entre plusieurs dates butoirs — jonction comprise : l'affaire de tête
 * compte aussi —, la plus lointaine est celle en vigueur, car un acte
 * postérieur reporte le terme. L'échéance de la procédure ne vaut qu'à défaut
 * d'acte, et l'échéance dit toujours d'où elle vient.
 *
 * Renvoie `null` lorsque l'affaire ne comporte pas d'instruction : la voie de
 * l'article R.811-40 en est une **alternative**, et l'instruction s'achève avec
 * la décision qui tranche le fond — ou avec la clôture de l'affaire.
 *
 * Renvoie en revanche une échéance **sans date** — `nonOuverte` — tant que la
 * désignation n'a pas eu lieu et qu'aucune pièce ne fixe de date butoir : le
 * délai n'a pas commencé, et l'outil le dit plutôt que de le compter depuis la
 * saisine.
 */
export function butoirInstruction(c, affaire) {
  if (!c || !affaire) return null;
  if (suitProcedureR811_40(affaire)) return null;
  if (estCloseEtat(affaire.Etat)) return null;
  if (decisionDefinitive(c, affaire)) return null;

  const section = c.ref("Affaires", affaire, "Section");
  const delai = delaiInstruction(c.db, section);
  // Le point de départ du délai : la décision de désignation — la pièce
  // produite avec la trame d'ouverture, ou, à défaut de pièce, la fiche du
  // rapporteur qui en porte la date.
  const ouverture = delai.depuis === "designation" ? ouvertureInstruction(c, affaire) : null;
  const base = delai.depuis === "designation"
    ? (ouverture?.date || dateDesignationRapporteur(c, affaire))
    : toDate(affaire.Date_de_saisine);
  const initiale = base && delai.mois ? isoDate(addMonths(base, delai.mois)) : null;

  // Les dates butoirs portées par les documents et les décisions de l'affaire
  // — et, pour une affaire jointe, par ceux de son affaire de tête : la
  // décision qui prolonge l'instruction est rendue une fois pour le groupe.
  const tete = affaireDeTeteDe(c.db, affaire);
  const documents = [...c.children("Generateur", affaire)];
  const decisions = [...c.children("Decisions", affaire)];
  if (tete) {
    documents.push(...c.children("Generateur", tete));
    decisions.push(...c.children("Decisions", tete));
  }
  const porteuses = [
    ...documents.map((row) => ({ row, document: row, date: isoDate(row.Date_butoir_instruction) })),
    ...decisions.map((row) => ({ row, decision: row, date: isoDate(row.Date_butoir_instruction) })),
  ].filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date));
  const derniere = porteuses[porteuses.length - 1] || null;

  // La **date butoir d'instruction** — celle qu'une pièce de l'affaire porte —
  // l'emporte sur l'échéance de la procédure : c'est le terme que l'acte fixe,
  // et il s'applique **qu'il avance le terme ou qu'il le recule**. L'échéance
  // décomptée depuis la décision de désignation ne vaut qu'à défaut d'acte —
  // une désignation qui annonce « l'instruction sera close le… » ferme donc
  // l'instruction à cette date, même si le délai réglementaire courrait plus
  // loin. Entre plusieurs dates butoirs, la plus lointaine est celle en
  // vigueur : un acte postérieur reporte le terme.
  const butoir = derniere ? derniere.date : initiale;
  // Ni délai calculable, ni terme fixé par une pièce : l'instruction n'est pas
  // ouverte, et c'est la désignation qui manque.
  if (!butoir) {
    return {
      initiale: null,
      butoir: null,
      prolongee: false,
      jours: null,
      delai,
      ouverture: ouverture || null,
      nonOuverte: true,
      origine: null,
    };
  }
  const prolongee = Boolean(initiale && derniere && derniere.date > initiale);
  const limite = toDate(butoir);
  return {
    initiale,
    butoir,
    prolongee,
    jours: limite ? daysBetween(today(), limite) : null,
    delai,
    ouverture: ouverture || null,
    nonOuverte: false,
    // Ce qui fixe l'échéance : la pièce qui porte la date butoir en vigueur —
    // un document, ou une décision qui reporte le terme —, dès lors qu'il y en
    // a une. À défaut seulement, l'échéance vient de la procédure et `origine`
    // reste vide.
    origine: derniere
      ? {
        document: derniere.document || null,
        decision: derniere.decision || null,
        trame: derniere.document ? c.ref("Generateur", derniere.document, "Template") : null,
      }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Formules                                                            */
/* ------------------------------------------------------------------ */

const currentYear = () => new Date().getFullYear();

export const FORMULAS = {
  Sections_disciplinaires: {
    // L'intitulé nomme le public, et non le seul mot « Usagers » : c'est le
    // libellé qui s'affiche dans les listes et que les trames reprennent pour
    // désigner la section.
    Intitule_de_la_section: (c, T, r) => {
      const d = procedure(r);
      const publi = d.public === "Enseignants-chercheurs" ? "enseignants-chercheurs" : "usagers";
      const type = d.type === TYPE_ACADEMIQUE ? " (section disciplinaire académique)" : "";
      return `${c.v(T, r, "Structure") ?? ""} - section disciplinaire compétente à l'égard des ${publi}${type}`;
    },

    President: (c, T, r) => {
      const role = r.VP ? "Vice-Président" : "Président";
      const membres = c.table("Membres").filter(
        (m) => Number(m.Section) === Number(r.id) && m.Role === role
      );
      const noms = membres.map((m) => c.v("Membres", m, "Nom_complet")).filter(Boolean);
      if (noms.length) return noms.join(", ");
      return r.VP ? "Aucun vice-président trouvé" : "Aucun président trouvé";
    },

    Formule: (c, T, r) => {
      const role = r.VP ? "Vice-Président" : "Président";
      const m = c.table("Membres").find((x) => Number(x.Section) === Number(r.id) && x.Role === role);
      return m ? c.v("Membres", m, "Formule") : "";
    },

    Formule_complete: (c, T, r) => {
      const role = r.VP ? "Vice-Président" : "Président";
      const m = c.table("Membres").find((x) => Number(x.Section) === Number(r.id) && x.Role === role);
      return m ? c.v("Membres", m, "Formule_complete") : "";
    },

    Lien_cliquable: (c, T, r) =>
      r.Email_de_contact ? `<a href="mailto:${r.Email_de_contact}">${r.Email_de_contact}</a>` : null,

    // La voie de recours ouverte contre une décision de la section : le juge
    // administratif pour les usagers, le CNESER — ou le CNESERAAV dans un
    // établissement agricole — pour les enseignants-chercheurs. Les trames de
    // notification s'en servent pour énoncer la voie de recours sans avoir à
    // distinguer les procédures (voir `juridictionRecours`, procedure.js).
    Voie_de_recours: (c, T, r) => juridictionRecours(r).devant,

    Secretaires_Email: (c, T, r) => c.refList(T, r, "Secretaires").map((s) => s.Email).filter(Boolean),
  },

  Membres: {
    // Un membre est en fonction si sa date de fin de mandat n'est pas dépassée.
    // Tant qu'elle n'est pas renseignée, l'année du document d'origine
    // (`Fin_de_mandat`) fait foi ; sans terme du tout, le membre est réputé en
    // fonction — le mandat est présumé, la vacance doit se déclarer.
    En_fonction: (c, T, r) => {
      const fin = toDate(r.Mandat_fin);
      if (fin) return fin.getTime() >= today().getTime();
      const annee = Number(c.v(T, r, "Fin_de_mandat") || 0);
      if (annee) return annee >= currentYear();
      return true;
    },

    Nom_complet: (c, T, r) => ` ${r.Prenom ?? ""} ${r.NOM ?? ""}`,

    Mme_Mr: (c, T, r) => (r.Genre === "M" ? "Monsieur" : r.Genre === "F" ? "Madame" : ""),

    Formule: (c, T, r) => {
      if (r.Role === "Président") return r.Genre === "M" || r.Genre === "N/A" ? "Le président" : "La présidente";
      if (r.Role === "Vice-Président") return r.Genre === "F" ? "La vice-présidente" : "Le vice-président";
      if (r.Role === "Membre") return "";
      // Rôle vide : le document d'origine renvoie la formule complète.
      return r.Genre === "M" ? "Monsieur" : "Madame";
    },

    Formule_complete: (c, T, r) => {
      const prefix = r.Genre === "M" ? "Monsieur" : "Madame";
      const f = c.v(T, r, "Formule");
      if (!f) return prefix;
      return `${prefix} ${f.charAt(0).toLowerCase()}${f.slice(1)}`;
    },

    Qualite: (c, T, r) => {
      let f = c.v(T, r, "Formule");
      if (!f) return "";
      if (f.startsWith("Le ")) f = f.slice(3);
      else if (f.startsWith("La ")) f = f.slice(3);
      return `${f} de la section disciplinaire`;
    },
  },

  Secretaires: {
    Nom_complet: (c, T, r) => ` ${r.Prenom ?? ""} ${r.Nom ?? ""}`,
    Formule: (c, T, r) => (r.Genre === "M" ? "Le secrétaire" : r.Genre === "F" ? "La secrétaire" : ""),
    Section_UUID: (c, T, r) => c.refList(T, r, "Section").map((s) => s.UUID || s.id),
  },

  // Répertoire des personnes. L'identité d'une personne est décrite une fois,
  // ici, et se projette ensuite sur toutes les affaires où elle paraît.
  Personnes: {
    Nom_complet: (c, T, r) => `${r.Prenom ?? ""} ${r.Nom ?? ""}`.trim(),
    Formule: (c, T, r) => monsieurMadame(r.Genre),
    Mme_Mr: (c, T, r) => monsieurMadame(r.Genre),
    Est_usager: (c, T, r) => r.Type === "Usager",
    Est_personnel: (c, T, r) => r.Type === "Personnel",
  },

  // La table du document d'origine, conservée pour la reprise : ses colonnes
  // calculées restent disponibles tant que la conversion n'a pas été faite.
  Commissions: {
    Section: (c, T, r) => c.ref(T, r, "Affaire")?.Section ?? null,
    Email: (c, T, r) => c.ref(T, r, "Membre")?.Email ?? "",
    College: (c, T, r) => c.ref(T, r, "Membre")?.College ?? "",
    Membre_Genre: (c, T, r) => c.ref(T, r, "Membre")?.Genre ?? "",
    Membre_Nom_complet: (c, T, r) => {
      const m = c.ref(T, r, "Membre");
      return m ? c.v("Membres", m, "Nom_complet") : "";
    },
    Membre_Qualite: (c, T, r) => {
      const m = c.ref(T, r, "Membre");
      return m ? c.v("Membres", m, "Qualite") : null;
    },
    Total_Email: (c, T, r) => {
      const affaire = r.Affaire;
      if (!affaire) return "Aucun email disponible";
      const emails = [];
      for (const row of c.table("Commissions")) {
        if (Number(row.Affaire) !== Number(affaire)) continue;
        const email = c.v(T, row, "Email");
        if (email && !emails.includes(email)) emails.push(email);
      }
      if (!emails.length) return "Aucun email disponible";
      return `[Contacter la commission](mailto:${emails.join(",")})`;
    },
  },

  // Les personnes qui instruisent et qui jugent. Un président de commission et
  // un rapporteur hors section sont la même ligne : seul le rôle change.
  Intervenants: {
    Nom_complet: (c, T, r) => {
      const m = c.ref(T, r, "Membre");
      if (m) return str(c.v("Membres", m, "Nom_complet"));
      const p = c.ref(T, r, "Personne");
      if (p) return str(c.v("Personnes", p, "Nom_complet"));
      return r.Nom_libre ?? "";
    },
    Email: (c, T, r) => c.ref(T, r, "Membre")?.Email || c.ref(T, r, "Personne")?.Email || "",
    Formule: (c, T, r) => {
      if (ROLE_PRESIDENT.includes(r.Role)) {
        return genreDe(c, T, r) === "F" ? "La présidente" : "Le président";
      }
      return monsieurMadame(genreDe(c, T, r));
    },
    College: (c, T, r) => c.ref(T, r, "Membre")?.College || (c.ref(T, r, "Personne")?.Corps ?? ""),
    Membre_Genre: (c, T, r) => genreDe(c, T, r),
    Membre_Qualite: (c, T, r) => {
      const m = c.ref(T, r, "Membre");
      return m ? c.v("Membres", m, "Qualite") : null;
    },
    Est_present: (c, T, r) => r.Statut === "Présent",
    // Est « hors section » ce qui est explicitement déclaré tel, ou un
    // intervenant extérieur désigné nominativement sans être un membre.
    Hors_section: (c, T, r) =>
      r.Qualite === "Hors section" || (!r.Membre && !!(r.Personne || r.Nom_libre)),
  },

  // Les autres personnes du dossier : victimes, témoins, accompagnants.
  Implications: {
    Nom_complet: (c, T, r) => str(c.v("Personnes", c.ref(T, r, "Personne"), "Nom_complet")),
    Formule: (c, T, r) => str(c.v("Personnes", c.ref(T, r, "Personne"), "Formule")),
    Est_mis_en_cause: (c, T, r) => r.Role === "Co-mis en cause",
  },

  Affaires: {
    // L'identité n'est plus saisie sur l'affaire : elle est projetée depuis le
    // répertoire. Les identifiants de colonnes sont ceux du document d'origine.
    Prenom_du_mis_en_cause: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Prenom ?? "",
    Nom_du_mis_en_cause: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Nom ?? "",
    Nom_complet: (c, T, r) =>
      `${c.v(T, r, "Prenom_du_mis_en_cause") ?? ""} ${c.v(T, r, "Nom_du_mis_en_cause") ?? ""}`.trim(),
    Formule: (c, T, r) => {
      const p = c.ref(T, r, "Mis_en_cause");
      const f = monsieurMadame(p?.Genre);
      if (f) return f;
      return c.v(T, r, "Section_Public") === "Enseignants-chercheurs" ? "Madame, Monsieur" : "Cher usager";
    },
    Genre: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Genre ?? "",
    Date_de_naissance: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Date_de_naissance ?? null,
    Adresse: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Adresse ?? "",
    INE: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.INE ?? "",
    Formation_suivie: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Formation_suivie ?? "",
    Corps: (c, T, r) => c.ref(T, r, "Mis_en_cause")?.Corps ?? "",

    Commission: (c, T, r) => joinList(intervenantsDe(c, r).map((x) => x.nom)),
    Formation: (c, T, r) =>
      joinList(intervenantsDe(c, r).map((x) => (x.role ? `${x.nom} (${x.role})` : x.nom))),

    C_President: (c, T, r) => joinList(nomsDeRole(intervenantsDe(c, r), ROLE_PRESIDENT)),

    C_Formule: (c, T, r) => {
      const pres = intervenantsDe(c, r).filter((x) => ROLE_PRESIDENT.includes(x.role));
      if (!pres.length) return "";
      return pres[0].genre === "F" ? "La présidente" : "Le président";
    },

    C_Qualite: (c, T, r) => {
      const pres = intervenantsDe(c, r).filter((x) => ROLE_PRESIDENT.includes(x.role));
      return pres.length && pres[0].qualite ? pres[0].qualite : null;
    },

    President_de_la_formation: (c, T, r) => joinList(nomsDeRole(intervenantsDe(c, r), ROLE_PRESIDENT)),

    Rapporteur: (c, T, r) => joinList(nomsDeRole(intervenantsDe(c, r), ["Rapporteur"])),

    Rapporteur_adjoint: (c, T, r) => joinList(nomsDeRole(intervenantsDe(c, r), ["Rapporteur adjoint"])),

    // La composition de l'instruction, toutes procédures confondues : le
    // rapporteur, son adjoint devant les sections d'usagers (R.811-28), et le
    // second membre de la commission d'instruction devant celles
    // d'enseignants-chercheurs (R.712-32). Le rapport d'instruction s'y réfère.
    Composition_de_l_instruction: (c, T, r) =>
      joinList(nomsDeRole(intervenantsDe(c, r), ["Rapporteur", "Rapporteur adjoint", "Membre de la commission d'instruction"])),

    // Le rapporteur peut être pris hors de la section : utile au contrôle de
    // la composition, et à la mention portée dans les documents.
    Rapporteur_hors_section: (c, T, r) =>
      intervenantsDe(c, r).some((x) => x.role === "Rapporteur" && x.horsSection),

    SE_Date: (c, T, r) => {
      const s = c.ref(T, r, "Seance_d_examen");
      return s ? s.Date : null;
    },
    SE_Salle: (c, T, r) => c.ref(T, r, "Seance_d_examen")?.Salle ?? "",
    SE_Adresse: (c, T, r) => c.ref(T, r, "Seance_d_examen")?.Adresse ?? "",
    SE_Visio: (c, T, r) => c.ref(T, r, "Seance_d_examen")?.Lien_visio ?? "",

    SE_Date_et_heure: (c, T, r) => {
      const d = toDate(c.ref(T, r, "Seance_d_examen")?.Date);
      if (!d) return null;
      let h = 0;
      let m = 0;
      const str = r.SE_Heure_de_passage;
      if (str && /^\d{1,2}:\d{2}$/.test(str)) {
        const [hh, mm] = str.split(":").map(Number);
        if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
          h = hh;
          m = mm;
        }
      }
      const out = new Date(d);
      out.setHours(h, m, 0, 0);
      return out.toISOString();
    },

    Heure_de_passage_minutes: (c, T, r) => {
      const s = r.SE_Heure_de_passage;
      if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
      const [h, m] = s.split(":").map(Number);
      if (h > 23 || m > 59) return null;
      return h * 60 + m;
    },

    // Nombre de jours entre la convocation et la séance : c'est ce délai que
    // les contrôles de régularité comparent au minimum réglementaire.
    Delai_de_convocation: (c, T, r) => {
      const convoc = toDate(r.Date_de_convocation);
      const seance = toDate(c.v(T, r, "SE_Date"));
      if (!convoc || !seance) return null;
      return daysBetween(convoc, seance);
    },

    // Instruction : de la saisine à la notification de la décision qui tranche
    // le fond — ou au jour même tant qu'aucune décision définitive n'est
    // intervenue. Une décision avant dire droit (report, supplément
    // d'instruction) ne clôt pas l'instruction : elle ne l'arrête donc pas.
    // Pour une affaire jointe, l'instruction s'achève avec la décision commune.
    Duree_instruction: (c, T, r) => {
      const saisine = toDate(r.Date_de_saisine);
      if (!saisine) return null;
      const decision = decisionDefinitive(c, r);
      const fin = decision ? toDate(decision.Date_de_notification) : null;
      return daysBetween(saisine, fin || today());
    },

    // L'échéance d'instruction : la date butoir d'instruction que portent les
    // documents relatifs à l'instruction — et les décisions qui la reportent —
    // **prime** sur le délai de la procédure (voir `butoirInstruction`,
    // ci-dessus). Ces colonnes sont données aux trames : un rapport
    // d'instruction, une convocation, une décision peut annoncer « l'instruction
    // sera close le {{Affaire}}.Date_butoir_instruction.date(@long) ».
    Date_butoir_instruction: (c, T, r) => butoirInstruction(c, r)?.butoir ?? null,

    Date_butoir_instruction_initiale: (c, T, r) => butoirInstruction(c, r)?.initiale ?? null,

    Instruction_prolongee: (c, T, r) => Boolean(butoirInstruction(c, r)?.prolongee),

    Jours_restants_instruction: (c, T, r) => butoirInstruction(c, r)?.jours ?? null,

    // Prescription de l'action disciplinaire.
    //
    // Elle ne concerne que les personnels : les poursuites engagées à l'égard
    // d'un usager ne sont pas soumises à prescription. Pour un personnel, le
    // délai court à compter de la date de connaissance des faits (code général
    // de la fonction publique, art. L. 532-2), et non de la date des faits :
    // à défaut de date de connaissance, celle des faits sert de repli.
    Prescription_le: (c, T, r) => {
      const section = c.ref(T, r, "Section");
      if (!procedure(section).prescription.applicable) return null;
      const base = toDate(r.Date_de_connaissance_des_faits) || toDate(r.Date_des_faits);
      if (!base) return null;
      const annees = parametreNumerique(c.db, "prescription_annees", 3);
      return isoDate(addYears(base, annees));
    },

    Prescrit: (c, T, r) => {
      const limite = toDate(c.v(T, r, "Prescription_le"));
      if (!limite) return false;
      return limite.getTime() < today().getTime();
    },

    Section_Secretaires_Email: (c, T, r) => {
      const s = c.ref(T, r, "Section");
      return s ? c.v("Sections_disciplinaires", s, "Secretaires_Email") : [];
    },

    Recherche: (c, T, r) => `${c.v(T, r, "Nom_complet") ?? ""}${c.v(T, r, "Numero") ?? ""}`,
    Section_Public: (c, T, r) => c.ref(T, r, "Section")?.Public ?? null,

    // Jonction d'affaires. Tout se déduit de `Jonctions` : une affaire n'a rien
    // à saisir pour être jointe, et défaire la jonction suffit à la rendre à
    // elle-même. Ces colonnes sont données aux trames : un document qui vaut
    // pour plusieurs affaires les cite par `{{Affaire}}.Affaires_jointes` et
    // nomme les autres mis en cause par `{{Affaire}}.Mises_en_cause_jointes`.
    Jonction: (c, T, r) => jonctionDe(c.db, r),

    Affaire_de_tete: (c, T, r) => affaireDeTeteDe(c.db, r),

    Affaires_jointes: (c, T, r) => {
      const jonction = c.v(T, r, "Jonction");
      if (!jonction) return "";
      return joinList(affairesDeJonction(c.db, jonction).map((a) => c.v("Affaires", a, "Numero")));
    },

    Mises_en_cause_jointes: (c, T, r) => {
      const jonction = c.v(T, r, "Jonction");
      if (!jonction) return "";
      const ici = Number(r.id);
      return joinList(
        affairesDeJonction(c.db, jonction)
          .filter((a) => Number(a.id) !== ici)
          .map((a) => {
            const nom = c.v("Affaires", a, "Nom_complet");
            return nom ? `${nom} (${c.v("Affaires", a, "Numero") ?? ""})` : "";
          })
          .filter(Boolean)
      );
    },
  },

  // Jonction d'affaires : le groupe lui-même. Ses deux colonnes de relation
  // (`Affaire_de_tete`, `Affaires_jointes`) sont les seules à saisir ; ce qui
  // suit n'est là que pour l'affichage et les documents.
  Jonctions: {
    Libelle: (c, T, r) => joinList(affairesDeJonction(c.db, r).map((a) => c.v("Affaires", a, "Numero"))),

    Nb_affaires: (c, T, r) => affairesDeJonction(c.db, r).length,

    Personnes_mises_en_cause: (c, T, r) =>
      joinList(affairesDeJonction(c.db, r).map((a) => {
        const nom = c.v("Affaires", a, "Nom_complet");
        return nom ? `${nom} (${c.v("Affaires", a, "Numero") ?? ""})` : "";
      }).filter(Boolean)),

    // La décision commune : celle que porte l'affaire de tête. Elle reste la
    // décision d'une affaire — l'affaire de tête — et non une décision « de
    // jonction » : c'est ce qui permet de défaire la jonction sans rien perdre.
    Decision: (c, T, r) => decisionDefinitive(c, affaireParId(c.db, r.Affaire_de_tete)),
  },

  Trames: {
    Type_court_: (c, T, r) => {
      // Le format vient du type de trame (voir `Types_Trames.Categorie`) :
      // c'est lui que porte le document — un courrier, une attestation, une
      // décision. À défaut (type d'une base ancienne), on retombe sur le nom.
      const type = c.ref(T, r, "Type");
      if (type?.Categorie) return type.Categorie;
      const nom = type?.Nom || "";
      if (nom.includes("Décision")) return "Décision";
      if (nom.includes("Courrier")) return "Courrier";
      if (nom.includes("Ordonnance")) return "Ordonnance";
      // Le rapport d'instruction passe AVANT le repli « Instruction » : sans
      // cela, « Rapport d'instruction » retomberait sur le format Instruction.
      if (nom.includes("Rapport") || nom.includes("rapport")) return "Rapport";
      if (nom.includes("Instruction") || nom.includes("instruction")) return "Instruction";
      if (nom.includes("Attestation") || nom.includes("attestation")) return "Attestation";
      return null;
    },
    Nom_complet: (c, T, r) => `${c.v(T, r, "Type_court_") ?? ""} / ${r.Nom ?? ""}`,
  },

  Seances_d_examen: {
    Identifiant: (c, T, r) => {
      const d = toDate(r.Date);
      if (!d) return "";
      const section = c.ref(T, r, "Section");
      const yy = String(d.getFullYear() % 100).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${yy}.${mm}${section?.Acronyme || "XX"}/${r.id}`;
    },
    Libelle: (c, T, r) => {
      const d = toDate(r.Date);
      const type = r.Type || "Séance";
      if (!d) return type;
      return `${type} du ${formatDateFr(d)}`;
    },
    Affaires_du_role: (c, T, r) =>
      joinList(
        c
          .table("Affaires")
          .filter((a) => Number(a.Seance_d_examen) === Number(r.id))
          .sort((a, b) => (Number(c.v("Affaires", a, "Heure_de_passage_minutes")) || 0)
            - (Number(c.v("Affaires", b, "Heure_de_passage_minutes")) || 0))
          .map((a) => c.v("Affaires", a, "Numero"))
      ),
  },

  Decisions: {
    // Le libellé notifié : la sanction du catalogue prime, sinon le texte
    // retenu. C'est ce libellé que reprennent les documents et les indicateurs.
    Libelle_decision: (c, T, r) => {
      const s = c.ref(T, r, "Sanction");
      if (s) return s.Libelle ?? "";
      return r.Decision ?? "";
    },

    Terme_de_la_sanction: (c, T, r) => {
      const sanction = c.ref(T, r, "Sanction");
      const libelle = String(c.v(T, r, "Libelle_decision") || "");
      const groupe = sanction?.Groupe || "";
      const notif = toDate(r.Date_de_notification);
      if (!notif) return null;
      const ISO = (d) => isoDate(d);
      const totale = Number(r.Duree_totale_d_exclusion_mois_ || 0);
      const sursis = Number(r.Duree_d_exclusion_sursis_ || 0);
      const mois = parametreNumerique(c.db, "jours_par_mois", 30);
      const anneesBlame = parametreNumerique(c.db, "duree_avertissement_blame_annees", 3);
      const definitif =
        groupe === "Exclusion définitive" ||
        groupe === "Révocation" ||
        libelle.toLowerCase().includes("définitive") ||
        libelle.toLowerCase().includes("révocation");
      if (definitif) return "9999-12-31";
      if (libelle === "Abandon des poursuites") return ISO(notif);
      // Les sanctions des 1° à 3° de l'article R.811-13-1 du code de
      // l'éducation — avertissement, blâme, mesure de responsabilisation —
      // s'effacent au bout de trois ans, faute d'une nouvelle sanction. Pour
      // les personnels enseignants, l'article R.712-42 efface le blâme et le
      // rappel à l'ordre dans le même délai.
      if (groupe === "Avertissement et blâme" || groupe === "Mesure de responsabilisation"
        || libelle === "Avertissement" || libelle === "Blâme") {
        return ISO(addDays(notif, anneesBlame * 365));
      }
      return ISO(addDays(notif, (totale - sursis) * mois));
    },

    Sursis_partiel: (c, T, r) => {
      const totale = Number(r.Duree_totale_d_exclusion_mois_ || 0);
      const sursis = Number(r.Duree_d_exclusion_sursis_ || 0);
      return !!r.Sursis_ && sursis > 0 && sursis < totale;
    },

    Date_d_effet: (c, T, r) => r.Date_de_notification || r.Date_du_delibere || null,

    // Le délai de recours (deux mois en principe) ne court que contre la
    // décision qui ouvre un recours : seule une décision prononçant une
    // **sanction** ou l'**abandon des poursuites** se conteste. Un classement,
    // une relaxe, une décision avant dire droit — report, supplément
    // d'instruction — ou une ordonnance du président, acte préparatoire, n'y
    // ouvrent pas droit : aucun délai ne court contre eux.
    Recours_limite_le: (c, T, r) => {
      if (!estSusceptibleDeRecours({ Nature: r.Nature, Libelle_decision: c.v(T, r, "Libelle_decision") })) return null;
      const effet = toDate(c.v(T, r, "Date_d_effet"));
      if (!effet) return null;
      const mois = parametreNumerique(c.db, "delai_recours_mois", 2);
      return isoDate(addMonths(effet, mois));
    },

    Nb_recours: (c, T, r) => (c.db?.Recours || []).filter((x) => Number(x.Decision) === Number(r.id)).length,

    // L'identité du mis en cause — son INE, ou le corps d'un
    // enseignant-chercheur — est une colonne **calculée** de l'affaire : elle
    // se lit donc par `vOuBrut`, et non sur le champ brut de l'enregistrement,
    // qui n'existe plus depuis la reprise dans `Personnes`. C'est la colonne
    // d'identité du registre des décisions, qui était vide.
    Affaire_INE: (c, T, r) => c.vOuBrut("Affaires", c.ref(T, r, "Affaire"), "INE"),
    Affaire_Composante: (c, T, r) => c.ref(T, r, "Affaire")?.Composante ?? null,
    Date_de_saisine: (c, T, r) => c.ref(T, r, "Affaire")?.Date_de_saisine ?? null,

    En_cours_: (c, T, r) => {
      const terme = toDate(c.v(T, r, "Terme_de_la_sanction"));
      if (!terme) return false;
      return terme.getTime() > today().getTime();
    },

    Delai_de_traitement: (c, T, r) => {
      const a = toDate(c.ref(T, r, "Affaire")?.Date_de_saisine);
      const b = toDate(r.Date_de_notification);
      if (!a || !b) return null;
      return daysBetween(a, b);
    },
  },

  Recours: {
    Libelle: (c, T, r) => joinList([r.Juridiction, r.Type_de_recours], " — "),
    Affaire_Numero: (c, T, r) => c.ref(T, r, "Affaire")?.Numero ?? "",
    En_cours_: (c, T, r) => r.Issue === "En cours",
  },

  Generateur: {
    Affaire_Section: (c, T, r) => c.ref(T, r, "Affaire")?.Section ?? null,
    Affaire_Date_de_saisine: (c, T, r) => c.ref(T, r, "Affaire")?.Date_de_saisine ?? null,
    // L'état civil du mis en cause vit dans `Personnes` : les colonnes
    // `Date_de_naissance` et `INE` de l'**affaire** en sont des colonnes
    // calculées. `c.ref(…).Date_de_naissance` lit le champ **brut** de
    // l'enregistrement, qui n'existe plus depuis la reprise : « Né le : » d'une
    // lettre de saisine s'écrivait sans date. On passe donc par la valeur
    // calculée (`vOuBrut`), comme `Affaire_INE` ci-dessus.
    Affaire_Date_de_naissance: (c, T, r) => c.vOuBrut("Affaires", c.ref(T, r, "Affaire"), "Date_de_naissance"),
    Affaire_Heure_de_passage: (c, T, r) => c.ref(T, r, "Affaire")?.SE_Heure_de_passage ?? "",
    Seance_d_examen: (c, T, r) => c.ref(T, r, "Affaire")?.Seance_d_examen ?? null,
    // La date de la séance : `Seance_d_examen` est une colonne **calculée** du
    // document — elle remonte celle de l'affaire —, et `c.ref` ne lit que les
    // colonnes brutes de l'enregistrement. La résoudre par `c.ref` rendait donc
    // toujours `null` : la balise `{{Seance_d_examen_Date}}` d'un justificatif,
    // d'une convocation ou d'une décision s'écrivait sans date. On la résout par
    // la valeur **calculée**, puis par l'index de la table des séances.
    Seance_d_examen_Date: (c, T, r) => c.byId("Seances_d_examen", c.v(T, r, "Seance_d_examen"))?.Date ?? null,
    Secretaire: (c, T, r) => c.ref(T, r, "Affaire")?.Secretaire ?? null,
    // Décision définitive de l'affaire : la décision qui tranche le fond, à
    // l'exclusion des décisions avant dire droit (report, supplément
    // d'instruction). C'est elle qu'une trame « Décision définitive » reprend.
    // Tant que le fond n'est pas tranché, la balise est vide : une trame
    // « Décision définitive » se remplit alors depuis l'onglet « Décision ».
    //
    // Une affaire jointe à une autre lit la décision de son affaire de tête :
    // le document produit depuis l'une ou l'autre affaire porte donc la même
    // décision, ce qui est exactement ce qu'une jonction produit.
    Decision: (c, T, r) => decisionDefinitive(c, c.ref(T, r, "Affaire")),
    Type: (c, T, r) => c.ref(T, r, "Template")?.Type?.Nom ?? c.ref(T, r, "Template")?.Type ?? null,
    Public: (c, T, r) => {
      const s = c.ref(T, r, "Affaire")?.Section;
      const section = s ? c.byId("Sections_disciplinaires", s) : null;
      return section?.Public ?? null;
    },
    Ville: (c, T, r) => {
      const a = c.ref(T, r, "Affaire");
      const s = a ? c.byId("Sections_disciplinaires", a.Section) : null;
      return s?.Siege ?? "";
    },
    Formule: (c, T, r) => {
      const d = c.ref(T, r, "Destinataire_institutionnel");
      return d?.Formule_de_politesse ?? "";
    },
    Destinataire: (c, T, r) => c.ref(T, r, "Destinataire_institutionnel")?.Nom_complet ?? "",
    Destinataire_Adresse: (c, T, r) => c.ref(T, r, "Destinataire_institutionnel")?.Adresse ?? "",
    Emetteur_Signature: (c, T, r) => c.ref(T, r, "Emetteur")?.Signature ?? "",
  },
};

/* ------------------------------------------------------------------ */
/* Aides internes                                                      */
/* ------------------------------------------------------------------ */

function str(v) {
  return v === null || v === undefined ? "" : String(v);
}

function genreDe(c, T, r) {
  return c.ref(T, r, "Membre")?.Genre || c.ref(T, r, "Personne")?.Genre || "";
}

/* ------------------------------------------------------------------ */
/* Numérotation automatique des affaires (colonne « Numero »)          */
/* ------------------------------------------------------------------ */

/**
 * Reproduit la formule Python d'origine :
 *   {année sur 2 chiffres}{acronyme de la section}-{n}
 * où `n` est le premier entier disponible pour l'année en cours.
 */
export function nextNumero(db, sectionId, excludeId = null) {
  const section = (db.Sections_disciplinaires || []).find((s) => s.id === Number(sectionId));
  const acronyme = section?.Acronyme || "XX";
  const annee = new Date().getFullYear() % 100;
  const prefix = `${annee}${acronyme}-`;
  let max = 0;
  for (const a of db.Affaires || []) {
    if (a.id === excludeId) continue;
    if (a.Section && Number(a.Section) !== Number(sectionId)) continue;
    const num = a.Numero;
    if (num && num.startsWith(prefix)) {
      const n = parseInt(num.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${max + 1}`;
}

/* ------------------------------------------------------------------ */
/* Tables de synthèse (équivalents des « summary tables » Grist)       */
/* ------------------------------------------------------------------ */

export function decisionsSummaryByComposante(db) {
  const ctx = new Context(db);
  const groups = new Map();
  for (const d of db.Decisions || []) {
    const key = [
      ctx.v("Decisions", d, "Affaire_Composante") ?? "",
      ctx.v("Decisions", d, "Affaire_INE") ?? "",
      ctx.v("Decisions", d, "Libelle_decision") ?? "",
      d.Date_de_notification ?? "",
    ].join("¦");
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        Affaire_Composante: ctx.v("Decisions", d, "Affaire_Composante") ?? "",
        Affaire_INE: ctx.v("Decisions", d, "Affaire_INE") ?? "",
        Decision: ctx.v("Decisions", d, "Libelle_decision") ?? "",
        Date_de_notification: d.Date_de_notification ?? null,
        En_cours_: ctx.v("Decisions", d, "En_cours_"),
        Terme_de_la_sanction: ctx.v("Decisions", d, "Terme_de_la_sanction"),
        count: 0,
        Duree_totale_d_exclusion_mois_: 0,
        Duree_d_exclusion_sursis_: 0,
      });
    }
    const g = groups.get(key);
    g.count += 1;
    g.Duree_totale_d_exclusion_mois_ += Number(d.Duree_totale_d_exclusion_mois_ || 0);
    g.Duree_d_exclusion_sursis_ += Number(d.Duree_d_exclusion_sursis_ || 0);
  }
  return [...groups.values()];
}

export function delaiMoyen(db) {
  const rows = (db.Decisions || [])
    .map((d) => new Context(db).v("Decisions", d, "Delai_de_traitement"))
    .filter((v) => v !== null && v !== undefined);
  if (!rows.length) return { moyenne: null, mois: 0, jours: null };
  const somme = rows.reduce((a, b) => a + b, 0);
  const moyenne = somme / rows.length;
  return { moyenne, mois: Math.floor(moyenne / 30), jours: moyenne % 30 };
}
