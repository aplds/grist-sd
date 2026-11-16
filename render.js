// Rendu des documents publipostés.
//
// Portage du script Python porté par la colonne « Template_rendu » du
// document Grist d'origine. Le vocabulaire de substitution est identique :
//
//   {{Colonne}}                        valeur brute
//   {{Colonne}}.Champ                  champ d'un enregistrement référencé
//   {{Colonne}}.date(@long)            date formatée (voir ALIASES)
//   {{Colonne}}.inline                 liste rendue en ligne
//   {{Colonne}}.[Cle|Libellé; ...]     tableau (syntaxe Markdown)
//   {{Colonne}}.img(url?w=200)         image
//
// Une **feuille de style** — le document entier d'un format : en-tête, chapeau,
// signature, pied de page répété — emploie en plus les variables `{variable}`
// (sans accolades doubles), et marque l'emplacement du texte de la trame par
// `{{Corps}}`. C'est là que le corps vient s'insérer : le document assemblé est
// donc *avant* + corps + *après* (voir `computeDocumentParts`).

import { AUTEUR_PRESIDENT_SECTION, BALISE_CORPS, POSITIONS_LOGO, SCHEMA, TUTELLE_AGRI } from "./schema.js";
import { Context, jourDuMoisFr, toDate } from "./formulas.js";
import { BLOC_MARQUE_DATA_URL } from "./assets/bloc-marque.js";
import { charteNeutre, cssCharteDocument, cssPoliceDocument } from "./charte.js";
import { signataireDeLaSection, vicePresidentEffectif } from "./signataire.js";
import { resoudreAuteur, resoudreDestinataire } from "./redaction.js";
import { PAGE_SCRIPT, PAGE_NUMBER_SPAN, PAGE_TOTAL_SPAN, piedNumerote, reperesPagination } from "./pages.js";
import { DSFR_CSS as DSFR_CSS_URL, DSFR_UTILITY_CSS } from "./dependances.js";

/* ------------------------------------------------------------------ */
/* Formatage des dates                                                 */
/* ------------------------------------------------------------------ */

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
// Abréviation **française** d'un mois — « janv. », « févr. » — et non les trois
// premières lettres : « mar », « avr », « jui » n'existent pas. Sert au motif
// `MMM` d'une date (voir `ALIASES`).
const MOIS_COURT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// Le motif d'une date s'écrit à la manière de Moment. `Do` est le quantième en
// français — « 1er », « 5 » —, `DD` le quantième chiffré, zéro compris : une
// date en toutes lettres s'écrit sans zéro (« 5 mars 2026 »), une date chiffrée
// le garde (« 05/03/2026 »). Voir `jourDuMoisFr`.
const ALIASES = {
  "@short": "DD/MM/YY",
  "@medium": "Do MMM YYYY",
  "@long": "Do MMMM YYYY",
  "@full": "dddd Do MMMM YYYY",
  "@iso": "YYYY-MM-DD",
  "@iso_dt": "YYYY-MM-DD HH:mm",
  "@iso_dt_s": "YYYY-MM-DD HH:mm:ss",
};

function splitPayload(payload) {
  const p = String(payload ?? "").trim();
  let pat = p;
  if (p.includes("|")) pat = p.split("|")[0].trim();
  else if (p.includes(",")) pat = p.split(",")[0].trim();
  if (!pat) pat = "@medium";
  return ALIASES[pat] || pat;
}

export function formatDateValue(value, payload) {
  const d = toDate(value);
  if (!d) return value == null ? "" : String(value);
  const pat = splitPayload(payload);

  const hasTime = d.getHours() || d.getMinutes() || d.getSeconds();
  const pad = (n) => String(n).padStart(2, "0");

  const YYYY = String(d.getFullYear());
  const YY = YYYY.slice(2, 4);
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const Do = jourDuMoisFr(d.getDate());
  const MMMM = MOIS[d.getMonth()];
  const MMM = MOIS_COURT[d.getMonth()];
  const dddd = JOURS[(d.getDay() + 6) % 7];
  const ddd = dddd.slice(0, 3);
  const HH = pad(d.getHours());
  const H = String(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  let out = pat;
  out = out.replace(/dddd/g, "\u0000FULLDAY\u0000").replace(/ddd/g, ddd);
  out = out.replace(/\u0000FULLDAY\u0000/g, dddd);
  out = out.replace(/MMMM/g, "\u0000MONTH\u0000").replace(/MMM/g, MMM);
  out = out.replace(/\u0000MONTH\u0000/g, MMMM);
  out = out.replace(/YYYY/g, YYYY).replace(/YY/g, YY).replace(/MM/g, MM).replace(/DD/g, DD);
  // `Do` — le quantième français — est posé **après** `DD` : le motif ne
  // contient alors plus de `DD` chiffré à protéger.
  out = out.replace(/Do/g, Do);
  out = out.replace(/HH/g, "\u0000HOUR\u0000").replace(/H/g, H).replace(/\u0000HOUR\u0000/g, HH);
  out = out.replace(/mm/g, mm).replace(/ss/g, ss);

  if (!hasTime) {
    out = out.replace(/\s{2,}/g, " ").trim();
    out = out.replace(/[:\-/]\s*$/, "").trim();
    out = out.replace(/(\s*:\s*)$/, "").trim();
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Listes                                                              */
/* ------------------------------------------------------------------ */

const isList = (v) => Array.isArray(v);
const toStr = (v) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDateValue(v, "@long");
  // Un enregistrement relié (référence ou liste de références) se rend par son
  // libellé d'affichage, jamais par « [object Object] ».
  if (typeof v === "object") return v.__display === undefined ? "" : String(v.__display);
  return String(v);
};

/* ------------------------------------------------------------------ */
/* Échappement des valeurs substituées (NC-0006)                       */
/* ------------------------------------------------------------------ */
//
// Une balise `{{Colonne}}` recopie une valeur de donnée dans le document, qui
// est ensuite inséré par `innerHTML`. La valeur est donc échappée **par
// défaut** : une balise écrite dans un champ — saisie, import, table Grist
// éditée hors de l'outil — ne peut plus s'exécuter dans la session de celle ou
// celui qui ouvre la pièce. Seuls traversent la substitution tels quels :
//   · le balisage produit par le moteur lui-même (une image, `.img()`) ;
//   · les colonnes inscrites dans `COLONNES_HTML`, réservées au balisage
//     volontaire (aucune n'existe aujourd'hui : la liste est le point
//     d'extension, et elle doit rester courte et motivée).

/** Chaîne produite par le moteur, à insérer telle quelle (jamais échappée). */
class Html {
  constructor(value) { this.value = String(value ?? ""); }
  toString() { return this.value; }
}

/** Colonnes autorisées à porter volontairement du balisage HTML. */
export const COLONNES_HTML = new Set();

/** Une valeur substituée, rendue sûre pour un contexte HTML. */
function asHtml(value) {
  if (value instanceof Html) return value.value;
  return escapeHtml(isList(value) ? renderList(value, "bullets") : toStr(value));
}

function renderList(values, mode = "bullets") {
  const vals = (values || []).map(toStr).filter((v) => v !== "");
  if (!vals.length) return "";
  return mode === "inline" ? vals.join(", ") : vals.map((v) => `- ${v}`).join("\n");
}

/* ------------------------------------------------------------------ */
/* Images et tableaux                                                  */
/* ------------------------------------------------------------------ */

function parseImgArgs(arg) {
  const opts = {};
  const s = String(arg ?? "").trim();
  if (!s) return opts;
  if (/^\d+$/.test(s)) {
    opts.w = s;
    return opts;
  }
  for (const part of s.split(";").map((p) => p.trim()).filter(Boolean)) {
    if (part.includes("=")) {
      const [k, v] = part.split("=");
      opts[k.trim()] = v.trim();
    } else if (/^\d+$/.test(part)) {
      opts.w = part;
    }
  }
  return opts;
}

function imgHtml(url, arg) {
  const u = String(url ?? "").trim();
  if (!u || !/^https?:\/\//.test(u)) return "";
  const o = parseImgArgs(arg);
  const styles = ["height:auto", "display:block", "max-width:100%"];
  if (o.w && /^\d+$/.test(o.w)) styles.push(`width:${o.w}px`);
  if (o.h && /^\d+$/.test(o.h)) styles.push(`height:${o.h}px`);
  if (o.fit === "cover" || o.fit === "contain") styles.push(`object-fit:${o.fit}`);
  if (o.radius && /^\d+$/.test(o.radius)) styles.push(`border-radius:${o.radius}px`);
  if (o.padding) styles.push(`padding:${/^\d+$/.test(o.padding) ? o.padding + "px" : o.padding}`);
  if (o.border) styles.push(`border:${o.border}`);
  if (o.shadow) styles.push(`box-shadow:${o.shadow}`);
  return new Html(`<img src="${escapeHtml(u)}" style="${styles.join("; ")}" />`);
}

function escCell(s) {
  return String(s ?? "").replace(/\|/g, "\\|");
}

function renderTable(records, spec) {
  const tokens = String(spec ?? "").split(";").map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return renderList(records, "bullets");

  const splitLabel = (token) => {
    if (token.includes("|")) {
      const [key, label] = token.split("|");
      return [key.trim(), label.trim() === "" ? null : label.trim()];
    }
    return [token.trim(), null];
  };
  const defaultLabel = (key) => {
    const m = /^([A-Za-z0-9_]+)(?:\(([^)]+)\))?$/.exec(key);
    return m ? m[1] : key.startsWith("{{") ? "" : key;
  };

  const evalCell = (keyRaw, row) => {
    let key = String(keyRaw ?? "").trim();
    let inline = false;
    if (key.endsWith(".inline")) {
      inline = true;
      key = key.slice(0, -7).trim();
    }
    let dateFmt = null;
    const mdt = /\.(date|dt)\((.*?)\)$/.exec(key);
    if (mdt) {
      dateFmt = mdt[2];
      key = key.slice(0, mdt.index).trim();
    }
    const m = /^([A-Za-z0-9_]+)(?:\(([^)]+)\))?$/.exec(key);
    if (!m) return toStr(key);
    const colId = m[1];
    const subId = m[2];
    let v = row?.[colId] ?? null;
    if (subId) {
      if (isList(v)) {
        const vals = v.map((it) => {
          let x = it ? it[subId] ?? null : null;
          if (dateFmt) x = formatDateValue(x, dateFmt);
          return x;
        });
        return renderList(vals, inline ? "inline" : "bullets");
      }
      v = v ? v[subId] ?? null : null;
    }
    if (dateFmt && !isList(v)) return formatDateValue(v, dateFmt);
    if (isList(v)) return renderList(v, inline ? "inline" : "bullets");
    return toStr(v);
  };

  const headers = [];
  const keys = [];
  for (const raw of tokens) {
    const [key, label] = splitLabel(raw);
    headers.push(label !== null ? label : defaultLabel(key));
    keys.push(key);
  }
  const header =
    "| " + headers.map((h) => (h === "" ? "&nbsp;" : escapeHtml(h))).join(" | ") + " |\n|" +
    headers.map(() => "---").join("|") + "|";
  const body = (records || []).map((row) =>
    "| " + keys.map((k) => {
      const cell = escapeHtml(toStr(evalCell(k, row)));
      return cell === "" ? "&nbsp;" : escCell(cell);
    }).join(" | ") + " |"
  );
  return new Html([header, ...body].join("\n"));
}

/* ------------------------------------------------------------------ */
/* Développement des enregistrements                                   */
/* ------------------------------------------------------------------ */

/**
 * Transforme un enregistrement en objet simple dont chaque colonne est
 * calculée, les références étant développées sur `depth` niveaux.
 */
export function expandRecord(ctx, tableName, rec, depth = 3, seen = new Set()) {
  if (!rec) return null;
  const key = `${tableName}:${rec.id}`;
  if (seen.has(key) || depth <= 0) return { id: rec.id };
  const next = new Set(seen);
  next.add(key);
  const out = { id: rec.id };
  for (const col of SCHEMA[tableName]?.columns || []) {
    const value = ctx.v(tableName, rec, col.id);
    const target = col.type.startsWith("Ref:") ? col.type.slice(4) : null;
    const listTarget = col.type.startsWith("RefList:") ? col.type.slice(8) : null;
    if (target) {
      out[col.id] = value ? expandRecord(ctx, target, ctx.byId(target, value), depth - 1, next) : null;
    } else if (listTarget) {
      out[col.id] = ctx
        .refList(tableName, rec, col.id)
        .map((r) => expandRecord(ctx, listTarget, r, depth - 1, next));
    } else {
      out[col.id] = value;
    }
  }
  // Libellé d'affichage de l'enregistrement : c'est lui que produit une balise
  // qui désigne l'enregistrement entier (une liste de motifs, par exemple).
  out.__display = displayLabel(tableName, out);
  return out;
}

/**
 * Valeur d'affichage d'un enregistrement développé : la colonne `display` du
 * schéma, ou la première colonne de texte renseignée à défaut.
 */
function displayLabel(tableName, obj) {
  const def = SCHEMA[tableName];
  const col = def?.display;
  const value = col ? obj[col] : null;
  if (typeof value === "object" && value !== null) return value.__display || "";
  if (value !== null && value !== undefined && value !== "") return String(value);
  for (const c of def?.columns || []) {
    if (c.type.startsWith("Ref")) continue;
    const v = obj[c.id];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Moteur de substitution                                              */
/* ------------------------------------------------------------------ */

const TOKEN_RE = /\{\{([A-Za-z0-9_]+)\}\}((?:\.(?:\[[^\]]*\]|img\((?:[^()]|\([^()]*\))*\)|inline|date\([^)]*\)|dt\([^)]*\)|[A-Za-z0-9_]+(?:\([^)]*\))?))*)/g;

/**
 * Nouvelle expression des balises `{{...}}` (avec le drapeau global).
 * L'éditeur de trames l'utilise pour repérer les balises du texte brut.
 */
export function tokenRegex() {
  return new RegExp(TOKEN_RE.source, "g");
}

/**
 * Expression des variables `{...}` des en-têtes, signatures et pieds de page
 * (voir `variablesCatalog`). Même usage que `tokenRegex`.
 */
const VARIABLE_RE = /(?<!\{)\{([A-Za-z0-9_]+)\}(?!\})/g;

export function variableRegex() {
  return new RegExp(VARIABLE_RE.source, "g");
}

/**
 * Balises d'une **feuille de style** : les variables `{variable}` *et* les
 * balises de données `{{Colonne}}` — modificateurs compris, comme
 * `{{Affaire}}.Numero` ou `{{Date}}.date(@long)` —, qui cohabitent dans le même
 * document. C'est la même famille qu'un corps de trame, à laquelle s'ajoutent
 * les variables : c'est pourquoi l'expression de `tokenRegex` ouvre
 * l'alternance — une balise à doubles accolades est reconnue avant que ses
 * accolades ne soient prises pour une variable.
 */
const STYLE_RE = new RegExp(`(?:${TOKEN_RE.source})|\\{[A-Za-z0-9_]+\\}`, "g");

export function styleRegex() {
  return new RegExp(STYLE_RE.source, "g");
}

function resolveColumn(scope, colId) {
  if (!(colId in scope)) return null;
  return scope[colId];
}

/** Rend un texte : une liste devient une énumération, un enregistrement son libellé. */
function asText(value) {
  return isList(value) ? renderList(value, "bullets") : toStr(value);
}

function applyModifier(value, modifier, scope) {
  // modifier commence par "."
  const body = modifier.slice(1);
  if (body === "inline") {
    return isList(value) ? renderList(value, "inline") : toStr(value);
  }
  if (body.startsWith("img(")) {
    const args = body.slice(4, -1);
    if (isList(value)) return "";
    return imgHtml(toStr(value), args);
  }
  if (body.startsWith("[")) {
    const spec = body.slice(1, -1);
    if (!isList(value)) return toStr(value);
    return renderTable(value, spec);
  }
  if (body.startsWith("date(") || body.startsWith("dt(")) {
    const fmt = body.slice(body.indexOf("(") + 1, -1);
    if (isList(value)) return renderList(value.map((v) => formatDateValue(v, fmt)), "inline");
    return formatDateValue(value, fmt);
  }
  // Accès à un champ / sous-champ
  const m = /^([A-Za-z0-9_]+)(?:\(([^)]*)\))?$/.exec(body);
  if (!m) return asText(value);
  const [, field, sub] = m;
  if (isList(value)) {
    // Une liste de références : on projette le champ sur chacun des
    // enregistrements, et on laisse le soin de l'écrire à la fin de la chaîne
    // (`.inline`, ou une énumération à défaut). La valeur reste une liste pour
    // qu'un modificateur suivant, `.inline` notamment, puisse s'appliquer.
    return value.map((r) => {
      let v = r ? r[field] ?? null : null;
      if (sub) v = v ? v[sub] ?? null : null;
      return v;
    });
  }
  if (value && typeof value === "object") {
    let v = value[field] ?? null;
    if (sub) v = v ? v[sub] ?? null : null;
    return v;
  }
  return asText(value);
}

/** Substitue les balises {{...}} d'un fragment HTML. */
export function renderTemplate(html, scope) {
  return String(html ?? "").replace(TOKEN_RE, (match, colId, modifiers) => {
    let value = resolveColumn(scope, colId);
    if (modifiers) {
      const parts = modifiers.match(/\.(?:\[[^\]]*\]|img\((?:[^()]|\([^()]*\))*\)|inline|date\([^)]*\)|dt\([^)]*\)|[A-Za-z0-9_]+(?:\([^)]*\))?)/g) || [];
      // Tous les modificateurs s'appliquent, dans l'ordre : un champ imbriqué
      // peut ainsi être daté ou mis en ligne ({{Affaire}}.X.date(@long)).
      for (const part of parts) {
        value = applyModifier(value, part, scope);
      }
      return asHtml(value);
    }
    if (COLONNES_HTML.has(colId)) return asText(value);
    return asHtml(value);
  });
}

/**
 * Substitue les variables `{variable}` d'une feuille de style.
 *
 * La substitution **laisse en place** les balises à doubles accolades : c'est
 * ce qui permet à `{{Corps}}` — l'emplacement du texte de la trame — de
 * survivre jusqu'à `computeDocumentParts`, qui découpe la feuille autour de lui.
 *
 * Comme les balises de données, les variables sont échappées par défaut : une
 * valeur de donnée — un nom, une adresse — ne peut pas porter de balise. Les
 * rares variables qui portent volontairement du balisage sont inscrites dans
 * `VARIABLES_HTML` (voir NC-0006).
 */
export function renderVariables(html, values) {
  return String(html ?? "").replace(VARIABLE_RE, (m, name) => {
    const v = values[name];
    if (v === null || v === undefined) return "";
    return VARIABLES_HTML.has(name) ? String(v) : escapeHtml(String(v));
  });
}

/**
 * Variables qui portent volontairement du balisage HTML : elles traversent la
 * substitution sans être échappées. La liste est courte et motivée — un visa
 * rédigé par le moteur, par exemple.
 */
const VARIABLES_HTML = new Set(["visa_code_rural"]);

/* ------------------------------------------------------------------ */
/* Habillage du document                                               */
/* ------------------------------------------------------------------ */

export const DOCUMENT_CSS = `
  /* Habillage du document rendu — la charte graphique de l'État.
     La police est **Marianne**, celle de l'État ; Arial est le repli officiel
     de la charte, puis la police sans-serif de la machine. C'est le défaut :
     une charte neutre ou une police réglée pour tous les documents s'y
     substituent par une règle posée après celle-ci (voir cssPoliceDocument
     dans charte.js), sans que ce bloc ait à changer. Les couleurs sont
     les jetons du Système de Design de l'État, **écrits en clair** : un
     document converti (PDF, Word, OpenDocument) ou imprimé hors connexion n'a
     plus la feuille du DSFR pour fournir ses variables.
       texte courant     #3a3a3a   (--text-default-grey)
       titres            #161616   (--text-title-grey)
       filets, fonds     #ddd, #f6f6f6
       liens, actions    #000091   (bleu France)
       mentions          #666      (--text-mention-grey) */
  * { box-sizing: border-box; }
  body {
    font-family: Marianne, Arial, sans-serif;
    font-size: 12pt;                /* 16 px : la taille de corps du DSFR */
    line-height: 1.5; margin: 0; padding: 0;
    color: #3a3a3a; background-color: white; width: 100%;
    text-align: left;
    /* Une adresse électronique ou un lien de visioconférence très long ne
       doit pas déborder de la feuille : il se coupe, comme dans un tableur. */
    overflow-wrap: break-word;
  }
  /* Feuille A4. Un document est toujours imprimé au format A4 portrait
     (210 × 297 mm, marges de 2 cm) : la feuille de l'aperçu reprend
     exactement cette géométrie, afin que l'écran montre ce que l'imprimante
     produira. La marge de 2 cm est celle d'un courrier administratif, et elle
     est tenue à l'identique par les exports (MARGIN_MM, export-doc.js) : la
     feuille d'aperçu, la fenêtre d'impression, le PDF, le Word et
     l'OpenDocument ont tous la même mise en page. */
  .page {
    width: 210mm; min-height: 297mm; padding: 2cm; margin: 0 auto;
    position: relative; background-color: white;
  }
  /* Boîte d'une feuille : c'est elle qui porte l'écart entre deux pages, et
     c'est sa hauteur qui est réduite lorsque l'aperçu met les feuilles à
     l'échelle (voir FIT_SCRIPT). */
  .page-box { width: 100%; margin: 0 auto 1.5rem; }
  .page-box:last-child { margin-bottom: 0; }
  /* Hauteur utile d'une page (297 mm − 2 × 2 cm), dont on retire la place
     laissée au pied de page répété en bas de chaque page. */
  .page__content { min-height: 257mm; padding-bottom: 10mm; position: relative; }
  /* Ancien balisage d'en-tête (class="header"), conservé pour les trames qui
     l'emploient encore : même règle que l'en-tête du rendu — les deux images
     sont calées sur la ligne de tête, et non centrées l'une sur l'autre (voir
     computeDocumentParts). */
  .header { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; background-color: white; }
  .left, .right { width: 50%; background-color: white; }
  .left img, .right img { max-width: 100%; height: auto; display: block; }
  .content { width: 100%; background-color: white; }
  /* Titres : Marianne, graisse 700, encre #161616. La taille est écrite ici,
     en **points** — la mesure du papier —, et prise dans l'échelle du menu
     « Taille » de la barre d'outils (voir TYPOGRAPHIE, editor.js). Deux
     raisons, et non une commodité :
       · le DSFR module ses titres selon la largeur de la fenêtre (le même
         titre n'a pas la même taille dans un aperçu étroit et au tirage) :
         une taille écrite est **déterministe**, la même à l'écran, à
         l'impression, dans le PDF, le Word et l'OpenDocument ;
       · une taille prise dans l'échelle est **nommable** : le menu « Taille »
         de l'auteur la montre et peut la changer, là où une taille venue de la
         charte restait invisible — c'est ce qui faisait un en-tête de service
         d'une fois et demie le corps du texte, sans que personne ne l'ait
         voulu ni ne puisse le corriger.
     L'échelle des titres est celle du document, et non celle d'une page web :
     14 pt est la taille d'un **titre de document** — celle des modèles livrés
     —, 12 pt celle du corps, que reprennent les deux derniers niveaux (des
     titres de dernier rang). On n'ajoute ici que l'air qui les entoure : un
     document a besoin d'une respiration plus marquée qu'une page web, où le
     titre est déjà détaché du reste. */
  h1, h2, h3, h4, h5, h6 { color: #161616; margin: 1.25rem 0 0.5rem; line-height: 1.3; }
  h1 { font-size: 18pt; }
  h2 { font-size: 16pt; }
  h3, h4 { font-size: 14pt; }
  h5, h6 { font-size: 12pt; }
  h1:first-child, h2:first-child, h3:first-child, h4:first-child,
  h5:first-child, h6:first-child { margin-top: 0; }
  /* Texte courant : chaque paragraphe se détache du suivant — sans l'ampleur
     d'une page web, car un courrier tient sur une feuille. */
  p { margin: 0 0 0.5rem; }
  /* Un paragraphe vidé par la mise en page (les trames ouvrent souvent leur
     texte par un bloc) ne doit pas ajouter de blanc. */
  p:empty { margin: 0; }
  ul, ol { margin: 0 0 0.5rem; padding-left: 1.5em; }
  blockquote { margin: 0 0 0.5rem; padding-left: 1rem; border-left: 3px solid #ddd; }
  /* Liens : le bleu France de la charte, soulignés — un lien reste
     reconnaissable sur une impression en noir et blanc comme dans un
     fichier Word, et il ne se confond pas avec le texte. */
  /* Liens et passages soulignés : **un seul** trait, franc, posé sous les
     jambages. Trois précisions, chacune contre un défaut constaté :
       · le DSFR habille **tout** élément porteur d'un href de deux dégradés de
         fond qui font son trait souligné animé ; dans un document, ces traits
         se superposaient au vrai soulignement — un trait au-dessus, un trait en
         dessous —, et se lisaient donc comme un **double** trait. On
         les éteint par la variable du DSFR elle-même (--underline-img), comme
         le fait son .fr-raw-link ;
       · la position « auto » du trait (celle de la police) le laissait
         traverser les descendantes — p, q, j —, au point qu'il semblait barrer
         les mots : il est posé franchement plus bas ;
       · l'épaisseur est fixée à 1 px, pour que le trait reste un trait, à
         l'écran comme dans le PDF.
     Un lien reste ainsi reconnaissable sur une impression en noir et blanc
     comme dans un fichier Word, et il ne se confond pas avec le texte. */
  a, u { text-underline-offset: 0.25em; text-decoration-thickness: 1px; }
  a, a:visited { color: #000091; --underline-img: none; text-decoration-line: underline; }
  /* Une adresse extérieure — dossier en ligne, visioconférence — porte, dans
     l'interface, un petit renvoi que le DSFR ajoute en pseudo-élément et
     dessine par un **masque** CSS (une icône SVG prise dans sa feuille). Un
     document n'en a pas besoin : un courrier ne renvoie pas « ailleurs », il
     donne une adresse. Le procédé, lui, ne survit à aucune conversion : ce
     pseudo-élément n'est pas du texte, et aucun export ne le reprend — dans
     l'ancien PDF-image, le masque que la capture ne savait pas lire laissait un
     **carré bleu plein** de la couleur du lien, juste après l'adresse,
     au-dessus du trait de soulignement, ce qui se lit comme un second trait ;
     Word et
     l'OpenDocument, qui ne gardent du HTML que les balises, n'en gardaient
     rien. Le renvoi est donc éteint dans les documents : l'écran, l'impression,
     le PDF, le Word et l'OpenDocument montrent alors tous la même chose. */
  a[href][target="_blank"]::after { content: none; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 1rem 0; }
  .signature { text-align: right; font-weight: bold; margin-top: 0; background-color: white; }
  table { width: 100%; border-collapse: collapse; background-color: white; }
  /* Seules les tables de la feuille A4 sont sans bordures : les états
     imprimés « maison » (rôles de séance, listes d'affaires) gardent les
     leurs, définies dans print.js. */
  .page table, .page table td, .page table th { border: none !important; }
  /* Un tableau inséré dans le texte du document, lui, prend l'habillage des
     tableaux du DSFR : filets #ddd, en-tête en gras sur fond #f6f6f6 souligné
     d'un filet franc, aucune bordure verticale — la charte se passe de
     grille. C'est la mise en forme attendue d'un tableau de faits ou de
     pièces, et elle survit au Word et à l'OpenDocument, qui ne gardent du
     navigateur que les bordures, la graisse et le fond de l'en-tête. */
  .page table.app-table-bordered { font-size: 0.875rem; }
  .page table.app-table-bordered td,
  .page table.app-table-bordered th {
    border: 1px solid #ddd !important; padding: 0.4rem 0.6rem;
    text-align: left; vertical-align: top;
  }
  .page table.app-table-bordered th {
    background-color: #f6f6f6; color: #161616; font-weight: 700;
    border-bottom: 2px solid #3a3a3a !important;
  }
  .content img { max-width: 100%; height: auto; }
  /* Saut de page inséré dans le texte : invisible sur la feuille — le
     document d'aperçu est d'un seul tenant — mais effectif à l'impression,
     et traduit en coupure franche par les exports PDF, Word et OpenDocument. */
  .app-page-break { height: 0; margin: 0; padding: 0; border: 0; }
  /* Les blocs de mise en page (colonnes de l'en-tête, bandeaux des trames)
     n'ont ni marge ni rembourrage : c'est la mise en page, pas le texte. */
  div { margin: 0; padding: 0; width: 100%; }
  /* Dans une cellule d'un tableau du texte, un paragraphe suit la cellule :
     pas de blanc ajouté, sinon un tableau de plusieurs lignes se disloque.
     La règle vise les tableaux du texte, et non la feuille A4 elle-même —
     celle-ci enveloppe tout le document dans une table de mise en page, dont
     les cellules contiennent le texte courant. */
  .page table.app-table-bordered td p,
  .page table.app-table-bordered th p { margin: 0; padding: 0; }
  .page table.app-table-bordered td > :first-child,
  .page table.app-table-bordered th > :first-child { margin-top: 0; }
  .mb-20 { margin-bottom: 0px !important; }
  .content .fr-logo { width: auto; padding: 0; margin: 0; }
  .print-footer { display: none; }
  /* Numérotation portée par le pied de page : les chiffres restent alignés
     d'une page à l'autre (chiffres tabulaires), et la ligne se détache du nom
     de la structure. Le numéro de l'affaire s'y pose à gauche, la pagination
     à droite — chacun à sa place quand l'un des deux manque. */
  .page-number, .page-total { font-variant-numeric: tabular-nums; }
  .app-page-count {
    margin-top: 0.3rem; display: flex; align-items: baseline;
    justify-content: space-between; gap: 1rem;
  }
  .app-page-count__numero { text-align: left; }
  .app-page-count__pages { margin-left: auto; text-align: right; }
  /* Considérants d'une décision : les paragraphes du raisonnement. Ils sont
     justifiés comme le reste du texte, et leur numéro — posé par « Numéroter
     les considérants » — est **écrit dans le texte**, non produit par un
     compteur CSS : il survit ainsi à l'impression, au PDF comme au Word, où un
     compteur ne serait pas rendu. */
  .considere { text-align: justify; margin: 0 0 0.5rem; }
  .considere-src {
    text-align: justify; margin: 0 0 0.8rem;
    font-size: 0.9em; color: #3a3a3a;
  }
  /* Intertitre du plan — « Sur la compétence de la section disciplinaire » — :
     il annonce le groupe de considérants qui suit, et ne doit pas en être
     séparé par un saut de page. */
  .considere-intertitre {
    font-weight: 700; margin: 1rem 0 0.4rem;
    break-after: avoid; page-break-after: avoid;
  }
  @media print {
    .app-page-break { break-after: page; page-break-after: always; }
  }
  @media screen {
    /* Le pied de page est répété en bas de chaque page imprimée : à l'écran
       il est plaqué au bas de la feuille. Un filet #ddd et l'encre des
       mentions (#666) : un pied de page se lit, il ne se remarque pas. */
    .print-footer {
      display: block; position: absolute; left: 0; right: 0; bottom: 0;
      text-align: left; font-size: 0.75rem; color: #666;
      border-top: 1px solid #ddd; padding-top: 10px; background-color: white;
    }
  }
  @media print {
    @page { size: A4 portrait; margin: 0; }
    body { padding: 0; }
    /* Le document d'aperçu est mis à l'échelle de la fenêtre par un script
       (FIT_SCRIPT), qui pose une marge gauche en ligne sur la feuille pour la
       centrer. À l'impression, cette marge décalait la feuille vers la droite
       de la page A4 et écrasait le texte dans une bande étroite : les lignes ne
       se coupaient plus correctement. Une marge remise à zéro sans !important
       ne suffit pas à l'emporter sur un style en ligne — d'où ces deux règles.
       L'impression et les exports n'embarquent pas le script (preview: false,
       voir computeDocumentParts) ; ces règles ne servent que de garde-fou. */
    #docFit { width: auto; height: auto !important; overflow: visible !important; }
    #docSheet { margin: 0 !important; transform: none !important; box-shadow: none !important; }
    /* Une feuille de l'aperçu **est** une page imprimée : la marge de 2 cm est
       portée par la feuille elle-même (la surface imprimable n'en ajoute
       aucune), et chaque feuille se termine par une coupure. La dernière, elle,
       ne coupe pas : une coupure après la dernière page ne produirait qu'une
       feuille blanche. */
    .page-box { height: auto !important; margin: 0 !important; }
    .page {
      width: 210mm; height: 296.9mm; min-height: 0; margin: 0; padding: 2cm;
      transform: none !important; box-shadow: none !important;
      break-after: page; page-break-after: always;
    }
    .page:last-child { break-after: auto; page-break-after: auto; }
    /* La zone utile occupe toute la hauteur de la feuille : c'est elle qui
       porte le pied de page (position absolue, bas à zéro), et une page peu
       remplie verrait sinon son pied remonter juste sous le texte. */
    .page__content { min-height: 0; height: 100%; }
    .print-footer {
      display: block; position: absolute; left: 0; right: 0; bottom: 0; height: auto;
      text-align: left; font-size: 0.75rem; color: #666;
      border-top: 1px solid #ddd; padding-top: 10px; background-color: white;
    }
    .footer-text { margin-left: 0px; }
    .signature-container { display: flex; justify-content: space-between; width: 100%; margin-top: 50px; }
    .signature-block { width: 48%; text-align: center; padding: 10px 0; }
    .signature-line { border-top: 1px solid #3a3a3a; width: 200px; margin: 0 auto; padding-top: 5px; }
  }
`;

/**
 * Habillage de l'aperçu : la feuille se détache sur un fond gris et se met à
 * l'échelle de la largeur disponible. Réservé au document d'aperçu — la
 * fenêtre d'impression est, elle, nue.
 */
export const PREVIEW_CSS = `
  @media screen {
    html { background: #d9d9d9; }
    body { padding: 1.5rem 1rem; }
    #docFit { width: 100%; overflow: hidden; }
    .page { box-shadow: 0 0 0 1px rgba(22, 22, 22, 0.08), 0 6px 18px rgba(22, 22, 22, 0.22); }
  }
  @media print {
    #docFit { height: auto !important; }
  }
`;

/**
 * Ajuste les feuilles A4 à la largeur du cadre (ou de la fenêtre) qui les
 * accueille : l'aperçu montre toujours des pages entières, sans ascenseur
 * horizontal, et le cadre prend la hauteur de la pile de feuilles réduites.
 */
export const FIT_SCRIPT = `<script>
(function () {
  var box = document.getElementById("docFit");
  if (!box) { return; }
  var host = null;
  try { host = window.frameElement || null; } catch (error) { host = null; }
  function fit() {
    /* La pagination précède la mise à l'échelle : c'est elle qui découpe le
       flux en feuilles (voir pages.js). Elle ne fait rien tant que la feuille
       n'a pas de hauteur — l'aperçu d'une vue qui ne l'affiche pas encore. */
    if (window.__paginer && !box.getAttribute("data-pagine")) {
      try { window.__paginer(); } catch (error) { /* aperçu laissé en un tenant */ }
    }
    var available = (host ? host.clientWidth : window.innerWidth) - 32;
    var boites = box.querySelectorAll(".page-box");
    if (!boites.length) { return; }
    var premiere = boites[0].firstElementChild;
    var width = premiere ? premiere.offsetWidth : 0;
    if (!available || !width) { return; }
    var ratio = Math.min(1, available / width);
    var total = 0;
    for (var i = 0; i < boites.length; i += 1) {
      var page = boites[i].firstElementChild;
      if (!page) { continue; }
      page.style.transformOrigin = "top left";
      page.style.transform = ratio < 1 ? "scale(" + ratio + ")" : "none";
      page.style.marginLeft = Math.max(0, Math.round((available - width * ratio) / 2)) + "px";
      var hauteur = Math.ceil(page.offsetHeight * ratio) + 2;
      boites[i].style.height = hauteur + "px";
      total += hauteur + (i < boites.length - 1 ? 24 : 0);
    }
    if (host) {
      // Une page A4 entière reste visible sans défilement ; au-delà, les
      // feuilles défilent à l'intérieur du cadre, qui ne s'allonge pas
      // indéfiniment avec le document.
      host.style.height = Math.max(520, Math.min(total + 48, 1200)) + "px";
    }
  }
  /* Le cadre demande la mise à l'échelle après avoir montré la vue qui affiche
     l'aperçu : __fit est son point d'entrée (voir views/documents.js). */
  window.__fit = fit;
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(fit, fit); }
  [120, 400, 1200].forEach(function (delay) { setTimeout(fit, delay); });
})();
<\/script>`;

const FONT_CSS = DSFR_UTILITY_CSS;
const DSFR_CSS = DSFR_CSS_URL;

/* Racine du site, fixée par src/app.js à partir de import.meta.url
   (fonctionne aussi bien à la racine du site que dans un sous-dossier).
   Les valeurs relatives du document Grist (ex. « assets/logo.svg ») sont
   résolues par rapport à cette racine. */
let assetBase = "";

export function setAssetBase(base) {
  assetBase = base.endsWith("/") ? base : `${base}/`;
}

export function resolveAsset(url) {
  const u = String(url ?? "").trim().replace(/^\.\//, "");
  if (!u || /^(https?:|data:|\/)/.test(u)) return u;
  return `${assetBase}${u}`;
}

/* Bloc-marque de l'État livré avec l'outil (voir `assets/`), et sa taille.
   C'est une **image** — et non le composant `.fr-logo` du DSFR : dans le
   DSFR, le drapeau et la Marianne sont un pseudo-élément CSS, et la devise un
   second, qui n'existent ni dans un fichier Word, ni dans un OpenDocument.
   L'image est employée partout : écran, impression, PDF, Word et
   OpenDocument.
   Elle est **vectorielle** (SVG, embarqué en `data:` URL, voir
   `assets/bloc-marque.js`) : l'écran, l'impression et l'aperçu PDF la rendent à
   la résolution du support, sans pixellisation, et elle ne dépend d'aucun
   fichier ni d'aucune police. Word et OpenDocument ne savent pas lire le SVG :
   `export-doc.js` la redessine alors en PNG à la résolution voulue.
   Elle est embarquée dans le code et non désignée par un chemin : elle reste
   ainsi visible même lorsque la page est rendue dans un cadre isolé (aperçu
   d'un générateur, widget Grist), où les fichiers de l'outil ne sont pas
   toujours accessibles. */
export const BLOC_MARQUE = BLOC_MARQUE_DATA_URL;
/**
 * Taille d'affichage du bloc-marque de l'État : celle du tracé de la charte
 * (voir `assets/bloc-marque.svg`). Le bloc entier mesure 27,42 × 24,08 mm — le
 * drapeau fait alors 4,25 mm de haut, la cote de la charte pour un courrier.
 * La hauteur est imposée, la largeur suit : l'image n'est donc jamais
 * déformée, quelle que soit sa résolution.
 */
export const BLOC_MARQUE_SIZE = ' style="width: 27.42mm; height: auto;"';

/**
 * Les cotes par défaut d'un logo d'en-tête, quand la feuille de style n'en
 * règle aucune : celles de la charte de l'État. Le bloc-marque garde sa cote ;
 * le logo de l'établissement est borné à la zone de logotype (53 mm de large,
 * 26 mm de haut), sans jamais déformer l'image.
 */
const COTE_MARIANNE = "height: 24.08mm; width: auto; max-width: 100%;";
const COTE_BLOC_MARQUE = "width: 27.42mm; height: auto;";
const COTE_LOGO = "max-height: 26mm; max-width: 53mm;";

/** Une longueur en millimètres, ou 0 si la valeur est vide ou illisible. */
function enMm(valeur) {
  const brut = String(valeur ?? "").trim().replace(",", ".");
  if (!brut) return 0;
  const n = Number(brut);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Le style d'un logo d'en-tête : la taille réglée pour la feuille de style,
 * sinon la cote de la charte. Une seule cote renseignée laisse l'autre suivre —
 * les proportions de l'image sont alors conservées ; les deux la fixent
 * exactement, comme l'auteur le demande.
 */
function coteLogo({ largeur, hauteur } = {}, defaut) {
  const w = enMm(largeur);
  const h = enMm(hauteur);
  if (!w && !h) return ` style="${defaut}"`;
  return ` style="width: ${w ? `${w}mm` : "auto"}; height: ${h ? `${h}mm` : "auto"}; max-width: 100%;"`;
}

/** La position d'un logo : celle que la feuille de style règle, sinon la charte. */
function positionLogo(valeur, defaut) {
  return POSITIONS_LOGO.includes(String(valeur ?? "")) ? String(valeur) : defaut;
}

/**
 * Adresse d'une image exploitable dans un document. Une valeur qui n'est pas
 * une adresse — l'identifiant numérique d'une pièce jointe Grist, par
 * exemple — est ignorée : mieux vaut ne rien afficher qu'une image cassée.
 * La colonne `Marianne` vide fait, elle, apparaître le bloc-marque officiel.
 */
export function imageSource(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const parts = v.replace(/^\[|\]$/g, "").split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length && parts.every((x) => /^\d+$/.test(x))) return "";
  return resolveAsset(v);
}

export function quillToHtml(html) {
  let out = String(html ?? "");
  const aligns = {
    'class="ql-align-center"': 'style="text-align:center;"',
    'class="ql-align-justify"': 'style="text-align:justify;"',
    'class="ql-align-right"': 'style="text-align:right;"',
    'class="ql-align-left"': 'style="text-align:left;"',
  };
  for (const [from, to] of Object.entries(aligns)) out = out.split(from).join(to);
  out = out.replace(/<p>\s*<\/p>/g, "<br>");
  return out;
}

/* ------------------------------------------------------------------ */
/* Construction du contexte « document »                               */
/* ------------------------------------------------------------------ */

/**
 * Colonne qui ne se trouve que sur une section disciplinaire : elle sert à
 * reconnaître une copie de la section dans le périmètre développé (voir
 * `appliquerSignataire`).
 */
const MARQUE_SECTION = "Intitule_de_la_section";

/**
 * Le signataire effectif, posé sur **toutes** les copies de la section que
 * porte le périmètre développé.
 *
 * Les trames ne nomment pas toujours le signataire par la variable
 * `{section_president}` : elles écrivent aussi `{{Affaire_Section}}.Formule`
 * ou `{{Affaire_Section}}.Formule_complete`, qui sont les colonnes calculées
 * de la section — recalculées, elles, avec le seul réglage de la section. Les
 * copies sont ici corrigées pour que toutes les balises d'un même document
 * désignent le même signataire. Ce sont des objets développés, jamais les
 * lignes de la base : la section elle-même n'est pas touchée.
 */
function appliquerSignataire(valeur, section, signataire, vus = new Set()) {
  if (!valeur || typeof valeur !== "object" || vus.has(valeur)) return;
  vus.add(valeur);
  if (Array.isArray(valeur)) {
    for (const item of valeur) appliquerSignataire(item, section, signataire, vus);
    return;
  }
  if (Number(valeur.id) === Number(section.id) && MARQUE_SECTION in valeur) {
    valeur.VP = signataire.vicePresident ? 1 : 0;
    valeur.President = signataire.nom;
    valeur.Formule = signataire.formule;
    valeur.Formule_complete = signataire.formule_complete;
    return;
  }
  for (const item of Object.values(valeur)) appliquerSignataire(item, section, signataire, vus);
}

/**
 * Valeurs mises à disposition des trames, exactement comme la colonne
 * `Template_rendu` du document d'origine.
 */
export function documentScope(db, doc, { template = null } = {}) {
  const ctx = new Context(db);
  const scope = expandRecord(ctx, "Generateur", doc, 3);
  // Le document d'un format « Décision » rédige **une** décision de l'affaire,
  // désignée par `Decision_liee` : c'est elle que lisent les balises
  // `{{Decision}}…` — avant dire droit comprise, et sans limite de nombre. À
  // défaut, la colonne calculée garde la décision définitive.
  if (doc?.Decision_liee) {
    const liee = ctx.byId("Decisions", doc.Decision_liee);
    if (liee) scope.Decision = expandRecord(ctx, "Decisions", liee, 2);
  }
  const affaire = scope.Affaire;
  const section = scope.Affaire_Section;

  // Le signataire du moment (voir `signataire.js`) : le président de la
  // section, ou le vice-président qui le remplace — pour la section entière,
  // ou pour ce seul document, quand l'absence du président est brève.
  const signataire = section
    ? signataireDeLaSection(db, section, vicePresidentEffectif(section, doc))
    : null;
  if (signataire) appliquerSignataire(scope, section, signataire);

  const dateObj = toDate(scope.Date);
  const dateFormatee = dateObj
    ? `${jourDuMoisFr(dateObj.getDate())} ${MOIS[dateObj.getMonth()]} ${dateObj.getFullYear()}`
    : "";

  const secretaire = scope.Secretaire;
  const trame = template || scope.Template;
  // Le type court est calculé : la trame d'aperçu des types de trames peut
  // être un enregistrement fictif, on le recalcule donc à partir de son type.
  const typeCourt = trame ? (trame.Type_court_ ?? ctx.v("Trames", trame, "Type_court_") ?? "") : "";

  // L'auteur et le destinataire, programmés sur la trame (voir `redaction.js`).
  // Les blocs `{emetteur…}` et `{destinataire…}` de l'en-tête et de la
  // signature en découlent : la rédaction n'a plus à les choisir.
  const auteur = resoudreAuteur(db, doc, trame, { ctx, scope, signataire });
  const destinataire = resoudreDestinataire(db, doc, trame, { ctx, scope });

  // Les **visas** d'un acte rendu : l'ouverture, puis les textes et la saisine.
  // Ils vivent dans la feuille de style du format (voir `trames-defaut.js`), qui
  // est partagée par toutes ses trames : ce qui dépend de l'affaire — la date de
  // saisine, le mis en cause — est donc calculé ici, et le visa du code rural ne
  // s'affiche que dans un établissement qui en relève.
  const dSaisine = toDate(affaire?.Date_de_saisine);
  const date_de_saisine = dSaisine
    ? `${jourDuMoisFr(dSaisine.getDate())} ${MOIS[dSaisine.getMonth()]} ${dSaisine.getFullYear()}`
    : "";
  const agri = String(section?.Tutelle || "") === TUTELLE_AGRI;
  // La formule qui ouvre l'acte : celle de son auteur. Le président de la
  // section se nomme par sa seule qualité dans la colonne de la section — c'est
  // au document d'ajouter ce qu'il préside.
  const f_ouverture = !auteur.formule ? ""
    : String(auteur.role || "") === AUTEUR_PRESIDENT_SECTION
      ? `${auteur.formule} de la section disciplinaire`
      : String(auteur.formule);

  return {
    scope,
    date_formatee: dateFormatee,
    auteur,
    destinataire,
    variables: {
      ville: section?.Siege ?? "",
      date_formatee: dateFormatee,
      nature_section: (section?.Public ?? "").toUpperCase(),
      mail_sd: section?.Email_de_contact ?? "",
      // Le destinataire du courrier : celui que la trame a programmé, résolu
      // sur l'affaire. Le destinataire libre garde ses champs propres.
      formule_destinataire: destinataire.formule ?? "",
      destinataire: destinataire.nom ?? "",
      adresse: destinataire.adresse ?? "",
      destinataire_qualite: destinataire.role ?? "",
      sec_ville: section?.Secretariat_CP_Ville ?? "",
      sec_rue: section?.Secretariat_Rue ?? "",
      mec_nom: affaire?.Nom_complet ?? "",
      mec_adresse: affaire?.Adresse ?? "",
      mec_formule: affaire?.Formule ?? "",
      section_president: signataire?.nom ?? section?.President ?? "",
      section_president_formule: signataire?.formule ?? section?.Formule ?? "",
      commission_president: affaire?.C_President ?? "",
      secretaire: secretaire?.Nom_complet ?? "",
      secretaire_formule: secretaire?.Formule ?? "",
      rapporteur: affaire?.Rapporteur ?? "",
      numero: affaire?.Numero ?? "",
      acte_type: typeCourt,
      // Les visas d'un acte rendu (ordonnance, décision) : l'ouverture, la date
      // de saisine et le visa du code rural, que seule la tutelle agricole
      // appelle. Voir `migrerOrdonnances` (schema.js) et les feuilles de style des
      // ordonnances (`trames-defaut.js`).
      f_ouverture,
      date_de_saisine,
      visa_code_rural: agri
        ? "<p style=\"text-align: justify;\"><strong>Vu</strong> le code rural et de la pêche maritime ;</p>"
        : "",
      // L'émetteur : l'auteur du document, résolu sur la trame.
      emetteur: auteur.nom ?? "",
      nom_emetteur: auteur.nom ?? "",
      f_emetteur: auteur.formule ?? "",
      emetteur_formule: auteur.formule ?? "",
      emetteur_formule_complete: auteur.formule_complete ?? "",
      emetteur_qualite: auteur.qualite ?? "",
      emetteur_adresse: auteur.adresse ?? "",
      c_president: affaire?.C_President ?? "",
      c_president_formule: affaire?.C_Formule ?? "",
      // Destinataire libre : ses champs se saisissent sur le document.
      destinataire_libre: scope.L_Destinataire ?? "",
      adresse_libre: scope.L_Adresse ?? "",
      formule_destinataire_libre: scope.L_Formule ?? "",
      structure_nom_complet: section?.Structure_Nom_Complet ?? "",
      nature_section_upper: (section?.Public ?? "").toUpperCase(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Texte du document                                                   */
/* ------------------------------------------------------------------ */

/**
 * Texte qui fait le corps du document : le texte propre au document dès
 * qu'il existe, sinon le corps de la trame. C'est cette source qui est
 * rendue, et c'est elle que l'éditeur de document personnalise.
 */
export function documentBody(doc, trame) {
  const propre = String(doc?.Contenu ?? "");
  return propre.trim() ? propre : (trame?.Template_contenu || "");
}

/**
 * Le texte d'un document, **rendu** : les repères de pagination d'abord
 * (`{page}`, `{pages}` — la pagination les remplit, comme dans la feuille),
 * puis les variables `{…}` de la feuille de style, puis les balises de données
 * `{{…}}` du périmètre.
 *
 * Le texte peut nommer l'une **ou** l'autre : la palette de l'espace de
 * rédaction les propose ensemble, et la pastille d'une variable y montre déjà
 * sa valeur. Sans cette substitution, la balise restait **brute** dans le
 * document rendu — donc dans l'aperçu, le PDF, le Word et l'OpenDocument —,
 * alors que le rédacteur croyait la valeur écrite.
 */
export function renderDocumentBody(source, scope, variables) {
  return renderTemplate(renderVariables(reperesPagination(source), variables || {}), scope);
}

/**
 * Texte du document où chaque balise de données est remplacée par la valeur du
 * moment : les noms, les dates et les lieux sont écrits dans le texte, qui ne
 * bouge plus quand les données changent — ce qu'attend un document signé.
 *
 * Le corps ne porte plus aucune balise de mise en page : l'en-tête, le chapeau,
 * la signature et le pied de page appartiennent à la feuille de style du format,
 * dont la trame hérite (voir `feuilleEffective`). Rien n'a donc à être laissé en
 * place ici.
 */
export function freezeDocumentBody(db, doc, { template = null } = {}) {
  const ctx = new Context(db);
  const trame = template || (doc.Template ? ctx.byId("Trames", doc.Template) : null);
  const { scope, variables } = documentScope(db, doc, { template });
  const fixed = { ...scope, ...variables };
  // Le texte figé n'a plus aucune balise : les variables `{…}` qu'il nomme
  // (celles de la feuille, et les repères de pagination) y sont résolues comme
  // au rendu — sinon elles resteraient écrites dans la pièce figée, et dans
  // tous ses exports (voir `renderDocumentBody`).
  return renderDocumentBody(documentBody(doc, trame), fixed, variables);
}

/**
 * L'en-tête de tout document : le bloc-marque de l'État à gauche, le logo de
 * l'établissement à droite.
 *
 * Ce n'est ni un texte ni une donnée de l'affaire, mais l'identité même du
 * service — réglée une fois (Réglages › Identité, Réglages › Charte graphique,
 * la fiche de la section) et la même sur toutes les pièces. Il précède donc la
 * feuille de style d'un format, qui n'a pas à le récrire.
 */
export function enteteHtml(db, section, format = null) {
  const marianne = imageSource(section?.Marianne);
  const logo = imageSource(section?.Logo);
  // La charte neutre n'affiche jamais la marque de l'État : ni le bloc-marque
  // officiel livré avec l'outil, ni celui d'une section resté vide. L'image
  // portée par la colonne `Marianne` n'est employée que si l'établissement y a
  // délibérément mis la sienne — une adresse d'image est un choix, son absence
  // en est un aussi.
  const neutre = charteNeutre(db);

  // Le bloc-marque est une image intégrée au document (voir `BLOC_MARQUE`) :
  // c'est la seule forme que savent restituer l'écran, l'imprimante, le PDF,
  // le fichier Word et le fichier OpenDocument.
  // Mise en page du modèle de courrier de la charte graphique de l'État : le
  // bloc-marque à gauche, le logo de l'établissement à droite, **les deux
  // calés sur la même ligne de tête** — le modèle place ainsi les deux zones,
  // et non au centre l'une de l'autre : un logo court ne doit pas flotter au
  // milieu de l'en-tête.
  //
  // Le **format** — la feuille de style — règle la position et la taille de
  // chacun (voir `Types_Trames`) : c'est là que l'auteur les ajuste, en voyant
  // la pièce. Sans réglage, on reproduit la charte : le bloc-marque à gauche à
  // sa cote — c'est lui qui porte l'identité, et sa cote est celle du tracé —,
  // le logo de l'établissement à droite, borné aux cotes de la zone de
  // logotype (53 mm de large, 26 mm de haut) pour ne jamais le déformer.
  const coteMarianne = coteLogo({ largeur: format?.Marianne_largeur, hauteur: format?.Marianne_hauteur }, COTE_MARIANNE);
  const coteBlocMarque = coteLogo({ largeur: format?.Marianne_largeur, hauteur: format?.Marianne_hauteur }, COTE_BLOC_MARQUE);
  const marianneBlock = marianne
    ? `<img src="${marianne}" alt="Bloc-marque de l'État"${coteMarianne} />`
    : neutre ? ""
      : `<img src="${resolveAsset(BLOC_MARQUE)}" alt="République Française"${coteBlocMarque} />`;
  const logoBlock = logo
    ? `<img src="${resolveAsset(logo)}" alt="Logo de l'établissement"${coteLogo({ largeur: format?.Logo_largeur, hauteur: format?.Logo_hauteur }, COTE_LOGO)} />`
    : "";

  // Aucune image : l'en-tête n'existe pas. Le rendre quand même poserait une
  // bande vide en tête de chaque document — et une zone d'édition encadrée,
  // sans rien dedans, au-dessus de la feuille de style.
  if (!marianneBlock && !logoBlock) return "";

  // Trois zones — la gauche, le centre, la droite —, chacune d'un tiers de la
  // largeur : chaque logo se pose dans celle que sa position désigne, et deux
  // logos dans la même zone s'y tiennent côte à côte. Une zone vide reste une
  // colonne : les logos ne glissent pas quand l'un des deux disparaît.
  const zones = { Gauche: [], Centre: [], Droite: [] };
  if (marianneBlock) zones[positionLogo(format?.Marianne_position, "Gauche")].push(marianneBlock);
  if (logoBlock) zones[positionLogo(format?.Logo_position, "Droite")].push(logoBlock);
  const alignements = { Gauche: "left", Centre: "center", Droite: "right" };
  const rangee = POSITIONS_LOGO
    .map((zone) => `<div style="flex: 1; text-align: ${alignements[zone]};">${zones[zone].join(" ")}</div>`)
    .join("\n    ");

  return `\n<div style="width: 100%; text-align: left; margin-bottom: 20px;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    ${rangee}
  </div>
</div>
<br/>\n`;
}

/**
 * La feuille de style qui s'applique à une trame : **celle qu'elle s'est
 * adaptée**, quand elle en a une, sinon **celle de son format**, dont elle
 * hérite. C'est le seul endroit où l'héritage se décide.
 */
export function feuilleEffective(trame, type) {
  const propre = String(trame?.Feuille_de_style ?? "").trim();
  if (propre) return propre;
  return String(type?.Feuille_de_style ?? "");
}

/**
 * La feuille de style qui s'applique à un **document** : celle que le document
 * s'est adaptée — une mention à corriger, une précision à ajouter pour cette
 * seule pièce —, quand il en a une, sinon celle de sa trame.
 *
 * C'est le dernier étage de l'héritage : le format donne la feuille de style,
 * la trame peut l'adapter, le document peut à son tour corriger l'une ou
 * l'autre. Une adaptation de document ne touche ni sa trame, ni les autres
 * pièces : elle vit dans `Generateur.Feuille_de_style` (colonne vide tant que
 * le document suit la trame).
 */
export function feuilleEffectiveDocument(doc, trame, type) {
  const propre = String(doc?.Feuille_de_style ?? "").trim();
  if (propre) return propre;
  return feuilleEffective(trame, type);
}

/**
 * Sépare une feuille de style autour de l'emplacement du texte : ce qui précède
 * le corps, et ce qui le suit — la signature, le pied de page répété.
 *
 * L'emplacement du texte peut tomber **dans** le pied de page : la pastille
 * « Texte de la trame » s'y laisse déposer. Le partage se fait alors au début de
 * ce pied de page — le texte reste un texte, et le pied garde ses mentions
 * après lui. C'est l'invariant qui compte : **un pied de page ne contient pas
 * le corps du document**. Sans ce contrôle, le document entier devenait un pied
 * de page, et Word comme OpenDocument le recopiaient au bas de **chaque** page,
 * tandis que le PDF lui réservait sa hauteur dans la marge basse : le document
 * s'étalait alors sur une page par ligne (voir `debutPiedDePage`).
 *
 * Une feuille sans emplacement — une trame antérieure à la refonte, ou une
 * rédaction qui a effacé la balise — n'est pas perdue pour autant : le texte se
 * place alors **avant le pied de page répété**, ou à la fin du document.
 *
 * Exportée parce que l'espace de rédaction d'un document montre, de part et
 * d'autre du texte, ce que la trame lui apporte : c'est **le même découpage**
 * qui doit s'y appliquer, sans quoi l'écran ne montrerait pas le document tel
 * qu'il sera produit (voir `documentEditor`, views/documents.js).
 */
export function decouperFeuille(feuille) {
  const i = feuille.indexOf(BALISE_CORPS);
  if (i !== -1) {
    const debut = debutPiedDePage(feuille, i);
    if (debut !== -1) return [feuille.slice(0, debut), feuille.slice(debut).replace(BALISE_CORPS, "")];
    return [feuille.slice(0, i), feuille.slice(i + BALISE_CORPS.length)];
  }
  const j = feuille.search(/<div[^>]*class="[^"]*print-footer/);
  if (j !== -1) return [feuille.slice(0, j), feuille.slice(j)];
  return [feuille, ""];
}

/** Balises sans contenu : elles ne s'empilent pas et n'englobent rien. */
const BALISES_VIDES = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

/** La balise ouvrante porte-t-elle la classe du pied de page répété ? */
function estPiedDePage(attributs) {
  const classe = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributs || "");
  const valeur = classe ? (classe[1] ?? classe[2] ?? classe[3] ?? "") : "";
  return /(^|\s)print-footer(\s|$)/.test(valeur);
}

/**
 * Le `<div class="print-footer">` qui **englobe** une position du texte, par
 * l'index de sa balise ouvrante — ou `-1` si la position est en dehors.
 *
 * Le repérage empile les balises ouvrantes rencontrées avant la position, et
 * les dépile à leur fermeture : la dernière qui reste ouverte **au-dessus** de
 * la position est celle qui l'englobe. Une balise non fermée (`<p>` sans
 * `</p>`, ce que le navigateur tolère) est dépilée par la fermeture de son
 * parent, comme le ferait l'analyseur du navigateur.
 */
function debutPiedDePage(html, position) {
  const pile = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const prefixe = String(html).slice(0, position);
  let m;
  while ((m = re.exec(prefixe))) {
    const balise = m[2].toLowerCase();
    if (BALISES_VIDES.has(balise) || m[4]) continue;
    if (m[1]) {
      for (let k = pile.length - 1; k >= 0; k -= 1) {
        if (pile[k].balise === balise) { pile.length = k; break; }
      }
      continue;
    }
    pile.push({ balise, index: m.index, pied: estPiedDePage(m[3]) });
  }
  for (let k = pile.length - 1; k >= 0; k -= 1) if (pile[k].pied) return pile[k].index;
  return -1;
}

/**
 * Le document assemblé : son en-tête, puis sa **feuille de style** — celle que
 * le document s'est adaptée, celle que la trame s'est adaptée, ou celle de son
 * format —, et, à l'emplacement que celle-ci marque, le texte propre à la pièce.
 */
export function computeDocumentParts(db, doc, { template = null, preview = true, paginate = preview } = {}) {
  const ctx = new Context(db);
  const { scope, variables } = documentScope(db, doc, { template });
  const trame = template || (doc.Template ? ctx.byId("Trames", doc.Template) : null);
  const type = trame ? ctx.byId("Types_Trames", trame.Type) : null;

  const enTete = enteteHtml(db, scope.Affaire_Section, type);

  // Les variables de la feuille de style sont remplies ici — `{page}` et
  // `{pages}` avant les autres, sans quoi elles seraient vidées comme des
  // variables inconnues (voir `piedNumerote`, dans pages.js). Le pied de page
  // répété est à sa place dans le document : c'est la pagination qui le recopie
  // au bas de chaque feuille.
  const numeroter = !!(type && (type.Numeroter_pages ?? ctx.v("Types_Trames", type, "Numeroter_pages")));
  // Le numéro de l'affaire au bas de **chaque** page, à gauche de la
  // numérotation (voir `piedNumerote`, pages.js) : comme elle, il se règle sur
  // le format du document, et suit la feuille de style qu'il soit répété ou non.
  const numeroAffaire = !!(type && (type.Numero_affaire_pied ?? ctx.v("Types_Trames", type, "Numero_affaire_pied")));
  const feuilleEffective = feuilleEffectiveDocument(doc, trame, type);
  const feuille = renderVariables(piedNumerote(feuilleEffective, { numeroter, numero: numeroAffaire }), variables);

  // Le corps : les balises de données y sont remplacées par les valeurs du
  // moment. Les variables de la résolution — `{{destinataire}}`,
  // `{{formule_destinataire}}`, `{{emetteur}}`, `{{ville}}`… — y entrent aussi :
  // le texte d'une trame peut nommer le destinataire et l'auteur que la trame a
  // programmés, comme le fait le chapeau de sa feuille de style.
  const bodyScope = { ...scope, ...variables };

  // Un document peut porter sa feuille **d'un bout à l'autre** — l'en-tête, le
  // chapeau, le texte et la signature d'un seul tenant —, quand l'espace de
  // rédaction a enregistré la feuille entière plutôt que le seul texte (voir
  // `saveEditorContent`, app.js). Sa feuille porte alors le texte et n'a plus
  // d'emplacement : c'est elle, tout entière, qui est rendue.
  const propre = String(doc?.Feuille_de_style ?? "").trim();
  const feuilleEntiere = propre.length > 0 && !propre.includes(BALISE_CORPS);

  let avant = feuille;
  let apres = "";
  let corps = "";
  if (feuilleEntiere) {
    corps = quillToHtml(renderTemplate(feuille, bodyScope));
    avant = corps;
    corps = "";
  } else {
    [avant, apres] = decouperFeuille(feuille);
    // Les deux bords de la feuille peuvent nommer une **donnée** : la pastille
    // d'une colonne s'y laisse déposer, et un chapeau cite souvent le numéro de
    // dossier. Leurs balises `{{…}}` se rendent donc là comme dans le corps ;
    // sans cela, elles restaient brutes dans le document rendu — et jusqu'à
    // l'export, alors que la pastille montrait déjà sa valeur à la rédaction.
    avant = renderTemplate(avant, bodyScope);
    apres = renderTemplate(apres, bodyScope);
    // Le texte peut, lui, nommer une **variable de la feuille** — le nom du
    // destinataire, la ville, le signataire, le numéro de page : c'est la même
    // palette, et la même pastille. Voir `renderDocumentBody`, qui pose les
    // repères de pagination, puis les variables, puis les balises de données.
    corps = quillToHtml(renderDocumentBody(documentBody(doc, trame), bodyScope, variables));
  }
  const templateHtml = feuilleEntiere ? `${enTete}${avant}` : `${enTete}${avant}${corps}${apres}`;

  // Police du document : celle de la charte (voir `charte.js`) ou celle qui a
  // été réglée globalement. La règle est posée **après** la feuille du DSFR et
  // DOCUMENT_CSS, dont elle reprend les sélecteurs : à spécificité égale, c'est
  // la dernière qui décide. Rien n'est écrit lorsque la police de la charte
  // convient déjà — le document reste alors exactement celui d'avant.
  const policeCss = cssPoliceDocument(db);
  // Charte neutre : ses documents portent son bleu d'action, y compris sur une
  // impression ou dans un fichier converti (voir `cssCharteDocument`).
  const charteCss = cssCharteDocument(db);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(trame?.Nom_complet || trame?.Nom || "Document")}</title>
<link rel="stylesheet" href="${DSFR_CSS}">
<link rel="stylesheet" href="${FONT_CSS}">
<style>${DOCUMENT_CSS}</style>
${policeCss ? `<style>${policeCss}</style>` : ""}
${charteCss ? `<style>${charteCss}</style>` : ""}
${preview ? `<style>${PREVIEW_CSS}</style>` : ""}
</head>
<body>
<div id="docFit"><div class="page" id="docSheet">
<div class="page__content">
<table><tbody><tr><td>
<div class="content">
${templateHtml}
</div>
</td></tr></tbody></table>
</div>
</div></div>
${paginate ? PAGE_SCRIPT : ""}
${preview ? FIT_SCRIPT : ""}
</body>
</html>`;

  return { enTete, feuille, avant, corps, apres, html };
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const DOCUMENT_FONT_LINK = FONT_CSS;
