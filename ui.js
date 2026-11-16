// Primitives d'interface (DSFR) et composants applicatifs.
//
// L'application n'utilise que les composants DSFR « statiques » (boutons,
// formulaires, badges, tableaux, alertes, cartes, tuiles) et construit
// au-dessus ses propres composants composites — onglets, fenêtre modale,
// indicateurs, cheminement d'état — afin de rester indépendante du
// JavaScript du DSFR et des ré-initialisations qu'il impose.

import { SCHEMA, ETAT_BADGE, idsDeRefList } from "./schema.js";
import { formatDateFr, formatDateSaisie, formatDateTimeFr, isoDate, toDate } from "./formulas.js";

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/**
 * Mise en forme **minimale** d'un texte de description.
 *
 * Les descriptions du schéma s'écrivent en markdown — `**ceci**` pour insister
 * sur un mot, `` `cela` `` pour nommer une colonne ou une fonction. Échappées
 * telles quelles, elles affichaient leurs astérisques et leurs accents graves
 * en clair, sous les libellés des formulaires. Deux marques seulement sont
 * reconnues ici — le gras et le code —, parce que ce sont les deux qui servent,
 * et le texte est échappé **avant** d'être mis en forme : rien de ce qu'il
 * contient ne peut devenir du HTML.
 */
export function mdInline(texte) {
  return esc(texte)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function attr(map) {
  return Object.entries(map)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`))
    .join(" ");
}

/**
 * Une icône : un nom du jeu du DSFR — `fr-icon-<nom>` —, ou un **dessin** écrit
 * sur place (un `<svg>`), pour les rares pictogrammes que le jeu ne fournit pas
 * (voir `PICTO_RETRAIT_PREMIERE_LIGNE`, editor.js).
 */
export function icon(name, extra = "") {
  const nom = String(name ?? "");
  if (nom.startsWith("<")) return nom;
  // `extra` porte le plus souvent une classe — la marge qui sépare l'icône de
  // son libellé (`class="fr-mr-1v"`), ou le repère d'une ligne de liste
  // (`app-list__go`). Elle s'ajoute à la classe du jeu d'icônes : émise en
  // second attribut `class`, le navigateur l'ignorait — l'icône se collait donc
  // à son libellé dans tous les boutons de l'outil, et le repère « ouvrir »
  // gardait le ton du texte au lieu du gris des mentions.
  let classes = `fr-icon-${nom}`;
  let reste = String(extra || "").trim();
  const declaree = /\bclass="([^"]*)"/.exec(reste);
  if (declaree) {
    classes += ` ${declaree[1]}`;
    reste = reste.replace(declaree[0], "").trim();
  }
  reste = reste.replace(/\s*aria-hidden="true"/g, "").trim();
  return `<span class="${classes}" aria-hidden="true"${reste ? ` ${reste}` : ""}></span>`;
}

let uid = 0;
export const nextUid = (p = "uid") => `${p}-${++uid}`;

export function col(tableName, colId) {
  return SCHEMA[tableName]?.columns.find((c) => c.id === colId);
}

export function colLabel(tableName, colId) {
  return col(tableName, colId)?.label || colId;
}

export function str(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/* ------------------------------------------------------------------ */
/* Adresses Web                                                        */
/* ------------------------------------------------------------------ */

/**
 * Une adresse **web** utilisable : schéma `http` ou `https` explicite, sinon
 * la chaîne vide. Une valeur d'un autre schéma — `javascript:`, `data:`,
 * `mailto:` — n'est pas une adresse de page : elle n'est pas rendue ici.
 */
export function urlSure(valeur) {
  const brut = String(valeur ?? "").trim();
  if (!brut) return "";
  try {
    const u = new URL(brut);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
  } catch {
    return "";
  }
}

/**
 * Un lien **externe** cliquable : il s'ouvre dans un onglet à part
 * (`target="_blank"`), pour ne pas décharger la page — dans un document Grist,
 * une navigation en place emporterait la liaison au document. Le libellé est
 * l'hôte (`fichiers.gouv.fr`), plus lisible qu'une adresse entière, et
 * l'adresse complète reste dans l'infobulle. Renvoie "" si la valeur n'est pas
 * une adresse web.
 */
export function lienExterne(valeur, { label = "", title = "" } = {}) {
  const href = urlSure(valeur);
  if (!href) return "";
  let hote = "";
  try { hote = new URL(href).hostname.replace(/^www\./, ""); } catch { /* hôte inconnu */ }
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(title || href)}">${esc(label || hote || href)}</a>`;
}

/** Libellé lisible d'un enregistrement (utilisé dans les listes déroulantes). */
export function displayValue(tableName, ctx, rec) {
  if (!rec) return "";
  if (tableName === "Affaires") {
    const num = rec.Numero || `#${rec.id}`;
    const nom = String(ctx?.v("Affaires", rec, "Nom_complet") ?? "").trim();
    return nom ? `${num} — ${nom}` : String(num);
  }
  const def = SCHEMA[tableName];
  if (!def) return `#${rec.id}`;
  const v = ctx?.v(tableName, rec, def.display);
  const s = Array.isArray(v) ? v.join(", ") : v;
  return String(s ?? "").trim() || `#${rec.id}`;
}

export function badge(etat) {
  if (!etat) return "";
  const cls = ETAT_BADGE[etat] || "fr-badge--info";
  return `<p class="fr-badge ${cls} fr-badge--sm app-badge">${esc(etat)}</p>`;
}

export function tag(label, tone = "grey") {
  return `<span class="app-tag app-tag--${esc(tone)}">${esc(label)}</span>`;
}

export function dateCell(v) {
  const d = toDate(v);
  return d ? `<span title="${isoDate(d)}">${esc(formatDateFr(d))}</span>` : "";
}

export function dateTimeCell(v) {
  const d = toDate(v);
  return d ? `<span title="${d.toISOString()}">${esc(formatDateTimeFr(d))}</span>` : "";
}

/* ------------------------------------------------------------------ */
/* Bloc-marque de l'en-tête                                            */
/* ------------------------------------------------------------------ */

/**
 * Bloc « marque de l'État » de l'en-tête DSFR : bloc-marque de la République,
 * logo de l'opérateur à sa droite (facultatif), puis titre et sous-titre du
 * service.
 *
 * C'est une primitive, et non du balisage écrit dans la coquille, pour que
 * l'aperçu des réglages montre exactement l'en-tête réel — seul moyen de
 * vérifier un logo sans publier la page.
 *
 * `operator` : `{ src, alt }` — le logo n'est affiché que si `src` est fourni.
 * `marque` : `false` avec la charte neutre (voir `charte.js`). La marque de
 * l'État n'est alors **pas écrite** : une marque ne se masque pas, elle
 * s'omet. S'il ne reste ni marque ni logo, la ligne du haut disparaît
 * entièrement, plutôt que de laisser un blanc au-dessus du titre.
 */
export function brandBlock({ title, tagline = "", hash = "tableau-de-bord", linkTitle = "Accueil", operator = null, marque = true }) {
  const logo = operator && operator.src
    ? `<div class="fr-header__operator app-header__operator">
        <img src="${esc(operator.src)}" alt="${esc(operator.alt || "")}">
      </div>`
    : "";
  const marqueHtml = marque ? `<div class="fr-header__logo"><p class="fr-logo">République<br>Française</p></div>` : "";
  const top = marqueHtml || logo
    ? `
  <div class="fr-header__brand-top">
    ${marqueHtml}
    ${logo}
  </div>`
    : "";
  return `
<div class="fr-header__brand fr-enlarge-link">${top}
  <div class="fr-header__service">
    <a href="#${esc(hash)}" title="${esc(linkTitle)}" data-nav="${esc(hash)}">
      <p class="fr-header__service-title">${esc(title)}</p>
    </a>
    ${tagline ? `<p class="fr-header__service-tagline">${esc(tagline)}</p>` : ""}
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Panneaux et cartes                                                  */
/* ------------------------------------------------------------------ */

export function panel(title, body, opts = {}) {
  const { iconName, actions = "", id, class: klass = "", subtitle = "", flush = false, level = "h2", collapsible = false, open = false } = opts;
  const H = level;
  const heading = `
      <${H} class="fr-h6 fr-mb-0">
        ${iconName ? icon(iconName, 'class="fr-mr-1v"') : ""}${esc(title)}
      </${H}>
      ${subtitle ? `<p class="fr-text--sm fr-mb-0 fr-text-mention--grey">${esc(subtitle)}</p>` : ""}`;
  const inner = `<div class="fr-panel__body${flush ? " fr-panel__body--flush" : ""}">${body}</div>`;

  if (collapsible) {
    // Repliable, le panneau ne perd pas ses actions : elles se posent en tête
    // du corps, une fois le panneau ouvert. Les perdre aurait fait disparaître
    // « Ajouter un recours » avec le repli.
    return `
<details class="fr-panel app-panel--collapsible ${klass}"${id ? ` id="${id}"` : ""}${open ? " open" : ""}>
  <summary class="fr-panel__header">
    <span class="fr-panel__heading">${heading}</span>
  </summary>
  <div class="fr-panel__body${flush ? " fr-panel__body--flush" : ""}">
    ${actions ? `<div class="app-row fr-mb-2v">${actions}</div>` : ""}
    ${body}
  </div>
</details>`;
  }

  return `
<section class="fr-panel ${klass}"${id ? ` id="${id}"` : ""}>
  <div class="fr-panel__header">
    <div class="fr-panel__heading">${heading}</div>
    ${actions ? `<div class="fr-panel__actions">${actions}</div>` : ""}
  </div>
  ${inner}
</section>`;
}

/**
 * Groupe de champs titré, à l'intérieur d'un panneau : sert à découper un long
 * formulaire en blocs lisibles plutôt qu'à aligner douze champs d'affilée.
 *
 * `collapsible` replie le groupe dans un `<details>` : les blocs secondaires
 * (une convocation reprise de l'onglet Séance, par exemple) cessent d'occuper
 * la hauteur tant qu'on ne les ouvre pas. `actions` pose un bouton dans
 * l'en-tête — le « Modifier » d'un bloc qu'on lit d'abord.
 */
export function fieldset(title, body, opts = {}) {
  const { hint = "", class: klass = "", collapsible = false, open = false, actions = "" } = opts;
  const tete = `
  <h3 class="app-fieldset__title">${esc(title)}</h3>
  ${hint ? `<p class="app-fieldset__hint">${esc(hint)}</p>` : ""}`;
  if (collapsible) {
    return `
<details class="app-fieldset app-fieldset--collapsible ${klass}"${open ? " open" : ""}>
  <summary class="app-fieldset__sommaire"><span class="app-fieldset__titre">${esc(title)}</span>${actions ? `<span class="app-fieldset__actions">${actions}</span>` : ""}</summary>
  ${hint ? `<p class="app-fieldset__hint">${esc(hint)}</p>` : ""}
  ${body}
</details>`;
  }
  return `
<div class="app-fieldset ${klass}">
  ${actions ? `<div class="app-fieldset__tete"><div>${tete}</div><div class="app-fieldset__actions">${actions}</div></div>` : tete}
  ${body}
</div>`;
}

/** Rangée de deux (ou trois) panneaux côte à côte, empilés sur écran étroit. */
export function columns(items, opts = {}) {
  const { widths = [], class: klass = "fr-grid-row--gutters" } = opts;
  const n = items.length;
  const defaultWidth = n === 2 ? 6 : n === 3 ? 4 : 12;
  return `
<div class="fr-grid-row ${klass}">
  ${items.map((it, i) => `<div class="fr-col-12 fr-col-lg-${widths[i] || defaultWidth}">${it}</div>`).join("")}
</div>`;
}

export function card(body, opts = {}) {
  const { class: klass = "", href = "", action = "", attrs = "", selected = false } = opts;
  const content = `<div class="app-card__inner">${body}</div>`;
  if (href || action) {
    const tagName = href ? "a" : "button";
    const extra = href
      ? `href="${esc(href)}" data-nav="${esc(href.replace(/^#/, ""))}"`
      : `type="button" data-action="${esc(action)}"`;
    return `<${tagName} class="app-card app-card--action ${klass}${selected ? " is-selected" : ""}" ${extra} ${attrs}>${content}</${tagName}>`;
  }
  return `<div class="app-card ${klass}${selected ? " is-selected" : ""}" ${attrs}>${content}</div>`;
}

export function kpi({ label, value, hint = "", iconName, tone = "", href = "", action = "" }) {
  const inner = `
    <span class="app-kpi__label">${iconName ? icon(iconName, 'class="fr-mr-1v"') : ""}${esc(label)}</span>
    <span class="app-kpi__value">${esc(value)}</span>
    ${hint ? `<span class="app-kpi__hint">${esc(hint)}</span>` : ""}`;
  const klass = `app-kpi${tone ? ` app-kpi--${tone}` : ""}`;
  if (href || action) {
    const extra = href ? `href="${esc(href)}" data-nav="${esc(href.replace(/^#/, ""))}"` : `type="button" data-action="${esc(action)}"`;
    return `<a class="${klass} app-kpi--link" ${extra}>${inner}</a>`;
  }
  return `<div class="${klass}">${inner}</div>`;
}

export function alert(type, title, text = "", extra = "") {
  const icons = { info: "information-line", success: "checkbox-circle-line", warning: "alert-line", error: "error-warning-line" };
  return `
<div class="fr-alert fr-alert--${type} fr-mb-2w">
  <p class="fr-alert__title">${icon(icons[type] || "information-line", 'class="fr-mr-1v"')}${esc(title)}</p>
  ${text ? `<p>${esc(text)}</p>` : ""}
  ${extra}
</div>`;
}

export function emptyState(text, opts = {}) {
  const { action = "", iconName = "information-line" } = opts;
  return `<div class="app-empty">
    ${icon(iconName, 'class="app-empty__icon"')}
    <p class="app-empty__text">${esc(text)}</p>
    ${action ? `<div class="app-empty__action">${action}</div>` : ""}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Champs                                                              */
/* ------------------------------------------------------------------ */

function optionsHtml(options) {
  return options
    .slice(0, 400)
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join("");
}

/**
 * Filtre d'options global, posé par l'application au démarrage.
 *
 * Les listes déroulantes de référence sont construites ici, à partir des tables
 * complètes : elles ne peuvent donc pas, à elles seules, respecter le périmètre
 * des affaires (un secrétaire ne voit que les affaires qui lui sont
 * attribuées). L'application installe donc ce filtre, qui s'applique à toutes
 * les listes de références — y compris celles des écrans à venir — au lieu
 * d'être répété à chaque appel.
 */
let rowFilter = null;

export function setRowFilter(filter) {
  rowFilter = typeof filter === "function" ? filter : null;
}

function visibleRows(tableName, rows) {
  return rowFilter ? rows.filter((r) => rowFilter(tableName, r)) : rows;
}

/** Libellé lisible d'une valeur de référence (colonne en lecture seule). */
function refLabel(type, value, ctx, store) {
  const ids = type.startsWith("RefList:") ? idsDeRefList(value) : (value ? [value] : []);
  const target = type.replace(/^Ref(List)?:/, "");
  return ids
    .map((id) => (store?.byId(target, Number(id)) ? displayValue(target, ctx, store.byId(target, Number(id))) : ""))
    .filter(Boolean)
    .join(", ");
}

function bindAttr(tableName, colId, rec, draft) {
  let out = `data-bind="${esc(tableName)}|${esc(colId)}"`;
  if (rec) out += ` data-record="${rec.id}"`;
  if (draft) out += ` data-draft="${esc(typeof draft === "string" ? draft : "affaire")}"`;
  return out;
}

/** Identifiant stable d'un champ — permet de restaurer le focus après rendu. */
export function fieldId(tableName, colId, rec, draft) {
  const suffix = rec ? rec.id : (typeof draft === "string" ? draft : "draft");
  return `f_${tableName}_${colId}_${suffix}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * Champ de saisie d'une date.
 *
 * C'est un champ de texte, et non le champ natif `type="date"` : le champ natif
 * n'accepte le collage que d'une date au format international, refuse une date
 * française tapée d'un trait, et vide ce qu'on vient de saisir dès que la
 * valeur lui paraît incomplète — au moment précis où l'on tape l'année. Le
 * texte reçu est analysé par `parseDateSaisie` (voir `formulas.js`), qui
 * reconnaît les écritures courantes et rend la date en ISO. La date connue est
 * conservée dans `data-date-valeur` : si la saisie reste illisible, le champ
 * peut être rendu à sa dernière valeur valable plutôt que d'être effacé.
 *
 * Le bouton ouvre le calendrier du navigateur ; un champ natif masqué, mais
 * bien rendu (un champ en `display:none` ne peut pas ouvrir son sélecteur),
 * sert uniquement de sélecteur.
 */
export function dateInput(id, value, attrs = "", opts = {}) {
  const iso = isoDate(value) || "";
  const placeholder = opts.placeholder || "JJ/MM/AAAA";
  return `
    <div class="app-date">
      <input class="fr-input app-date__champ" type="text" autocomplete="off"
        spellcheck="false" id="${id}" value="${esc(formatDateSaisie(value))}" data-date="1"
        data-date-valeur="${esc(iso)}" placeholder="${esc(placeholder)}" ${attrs}>
      <button type="button" class="fr-btn fr-btn--tertiary app-date__bouton" data-action="date-picker"
        data-date-pour="${esc(id)}" title="Choisir dans le calendrier"
        aria-label="Choisir dans le calendrier">${icon("calendar-line")}</button>
      <input type="date" class="app-date__natif" tabindex="-1" aria-hidden="true"
        data-action="date-picked" data-date-picker="${esc(id)}">
    </div>`;
}

/**
 * Contrôle de saisie pour une colonne.
 * opts.draft : clé du brouillon (aucun enregistrement) — ex. `{ draft: "affaire" }`.
 * opts.compact : variante sans libellé visible (édition en ligne).
 * opts.locked : colonnes présentées en lecture seule, quel que soit le rôle —
 *   une colonne que l'outil ne confie pas à tout le monde (l'attribution d'une
 *   affaire, par exemple) reste consultable mais non modifiable.
 */
export function field(tableName, colId, ctx, rec, opts = {}) {
  const def = col(tableName, colId);
  if (!def) return "";
  const { store, draft = false, compact = false, required = false, rows, placeholder = "", step } = opts;
  const value = rec ? ctx.v(tableName, rec, colId) : (opts.value ?? "");
  const bind = bindAttr(tableName, colId, rec, draft);
  const id = fieldId(tableName, colId, rec, draft) || nextUid("f");
  const locked = Array.isArray(opts.locked) && opts.locked.includes(colId);
  // `opts.lecture` : le contrôle se présente en **lecture** tant que le bloc
  // n'a pas été ouvert à la modification. Une fiche de détail se lit d'abord ;
  // l'édition s'ouvre sur demande, bloc par bloc.
  const readonly = (def.formula && !opts.editable) || locked || opts.lecture === true;
  const type = def.type || "Text";

  const labelText = `${esc(def.label)}${required ? ' <span class="app-required" title="Champ obligatoire">*</span>' : ""}`;
  const labelHtml = compact
    ? `<label class="fr-sr-only" for="${id}">${labelText}</label>`
    : `<label class="fr-label" for="${id}">${labelText}</label>`;
  // Un groupe de cases n'a pas **un** contrôle à désigner : son libellé est un
  // texte, que le groupe cite (`aria-labelledby`), et non une étiquette.
  const labelGroupHtml = compact
    ? `<span class="fr-sr-only" id="${id}-label">${labelText}</span>`
    : `<span class="fr-label" id="${id}-label">${labelText}</span>`;

  // Le texte d'aide se lit **sous le contrôle**, et non sous le libellé.
  //
  // Le DSFR le place dans le libellé (`.fr-hint-text`), ce qui convient à un
  // champ isolé : on lit l'intitulé, l'explication, puis la zone de saisie.
  // Mais deux champs voisins n'ont jamais des aides de même longueur — l'un en
  // porte cinq lignes, l'autre aucune —, et leurs contrôles se décalent : la
  // ligne se lit en escalier. Si on les aligne au contraire en donnant à chaque
  // libellé la hauteur du plus haut, le champ le plus sobre se retrouve à cent
  // pixels sous son intitulé, détaché de lui. Aucune des deux présentations ne
  // tient : c'est l'aide, trop longue pour un libellé, qui est mal placée.
  //
  // Sous le contrôle, les libellés restent courts — ils s'alignent, et les
  // contrôles aussi —, l'explication se lit sous le champ qu'elle explique, et
  // elle décrit toujours le champ pour qui ne le voit pas : elle est désignée
  // au contrôle par `aria-describedby`, comme le fait le DSFR lui-même pour
  // les aides posées après un champ (`fr-input-wrap + .fr-hint-text`).
  //
  // Une case à cocher n'a pas de contrôle sous son libellé, mais **à côté** :
  // son aide se place sous le couple case + libellé, alignée sur le texte du
  // libellé (la mise en forme s'en charge — voir `styles.css`).
  const desc = def.desc && !compact
    ? `<p class="fr-hint-text app-desc" id="${id}-desc">${mdInline(def.desc)}</p>`
    : "";
  const decrit = desc ? ` aria-describedby="${id}-desc"` : "";

  if (readonly) {
    let shown = value;
    if (type.startsWith("Ref:") || type.startsWith("RefList:")) shown = refLabel(type, value, ctx, store);
    else if (type === "Date") shown = formatDateSaisie(value);
    else if (Array.isArray(shown)) shown = shown.join(", ");
    // Un champ de type « Link » se **suit** en lecture : l'adresse déclarée
    // s'ouvre d'un clic, dans un onglet à part. Sans cela, il fallait rouvrir
    // le bloc en édition pour aller voir la page qu'elle désigne. Une valeur
    // qui n'est pas une adresse web reste écrite telle quelle.
    //
    // Une valeur **absente** se dit : sans cela, un champ vide se présentait en
    // lecture comme une plage blanche, là où le tableau et la fiche de synthèse
    // portent un tiret. Le champ garde sa hauteur (`.app-readonly`), et se lit
    // comme « rien à cette place » plutôt que comme un contrôle inachevé.
    const vide = shown === null || shown === undefined || String(shown).trim() === "";
    const contenu = vide
      ? `<span class="app-vide">—</span>`
      : (colId === "Etat"
        ? badge(value)
        : (type === "Link" ? (lienExterne(value) || esc(str(shown))) : esc(str(shown))));
    return `
  <div class="fr-input-group${compact ? " app-field--compact" : ""}">
    ${labelHtml}
    <div class="app-readonly" id="${id}"${decrit}>${contenu}</div>
    ${desc}
  </div>`;
  }

  if (type === "Choice") {
    // `opts.choices` permet de restreindre la liste selon le contexte (les
    // voies de traitement applicables à la section de l'affaire, par exemple).
    const choices = (opts.choices || def.choices || []).slice();
    if (value && !choices.includes(value)) choices.push(value);
    return `
  <div class="fr-select-group${compact ? " app-field--compact" : ""}">
    ${labelHtml}
    <select class="fr-select" id="${id}"${decrit} ${bind}>${opts.placeholder === false ? "" : '<option value="">—</option>'}
      ${choices.map((c) => `<option value="${esc(c)}" ${String(value ?? "") === String(c) ? "selected" : ""}>${esc(c)}</option>`).join("")}
    </select>
    ${desc}
  </div>`;
  }

  if (type.startsWith("Ref:")) {
    const target = type.slice(4);
    // `opts.rows` restreint la liste (catalogues filtrés par régime et
    // tutelle, par exemple) ; à défaut, toutes les lignes visibles.
    // `opts.labelFor` remplace le libellé d'affichage quand celui de la table
    // ne distingue pas ses lignes — les décisions d'une même affaire, par
    // exemple, dont le libellé d'affichage est l'affaire elle-même.
    const rows_ = opts.rows || visibleRows(target, store ? store.table(target) : []);
    const current = value ? store?.byId(target, value) : null;
    const libelle = opts.labelFor || ((r) => displayValue(target, ctx, r));
    const options = rows_
      .filter((r) => String(r.id) !== String(value || ""))
      .map((r) => [r.id, libelle(r)]);
    return `
  <div class="fr-select-group${compact ? " app-field--compact" : ""}">
    ${labelHtml}
    <select class="fr-select" id="${id}"${decrit} ${bind}>
      <option value="">—</option>
      ${optionsHtml(options)}
      ${current ? `<option value="${current.id}" selected>${esc(libelle(current))}</option>` : ""}
    </select>
    ${desc}
  </div>`;
  }

  if (type.startsWith("RefList:")) {
    const target = type.slice(8);
    const rows_ = opts.rows || visibleRows(target, store ? store.table(target) : []);
    const current = idsDeRefList(value);
    // Une liste de cases à cocher, et non un `<select multiple>` : dans un
    // menu à choix multiples, un clic ordinaire **remplace** la sélection — il
    // faut la touche de commande pour en ajouter une —, si bien qu'affecter
    // deux éléments de la liste paraît impossible, et l'est sur un écran
    // tactile. Chaque ligne se coche ici pour elle-même, et un rattachement se
    // lit d'un coup d'œil.
    const items = rows_.map((r) => {
      const itemId = `${id}_${r.id}`;
      const libelle = displayValue(target, ctx, r);
      const meta = opts.metaFor ? opts.metaFor(r) : "";
      return `
      <label class="app-checklist__item" for="${itemId}">
        <input type="checkbox" id="${itemId}" value="${r.id}" ${current.includes(Number(r.id)) ? "checked" : ""}>
        <span class="app-checklist__nom">${esc(libelle)}</span>
        ${meta ? `<span class="app-checklist__meta">${esc(meta)}</span>` : ""}
      </label>`;
    }).join("");
    const vide = opts.vide || `Aucun élément disponible dans « ${target} » pour le moment.`;
    return `
  <div class="fr-input-group app-checklist-group${compact ? " app-field--compact" : ""}">
    ${labelGroupHtml}
    <div class="app-checklist" role="group" aria-labelledby="${id}-label"${decrit} data-bind="${esc(tableName)}|${esc(colId)}"${rec ? ` data-record="${rec.id}"` : ""}>
      ${items || `<p class="app-checklist__vide">${esc(vide)}</p>`}
    </div>
    ${desc}
    ${rows_.length > 6 ? `<p class="fr-hint-text fr-mt-1v fr-mb-0">${rows_.length} éléments — la liste défile.</p>` : ""}
  </div>`;
  }

  if (type === "Bool") {
    // La case se coche à côté de son libellé : l'aide se place sous le couple
    // case + libellé, et non sous un contrôle qui n'existe pas.
    return `
  <div class="fr-checkbox-group app-check${compact ? " app-field--compact" : ""}">
    <input type="checkbox" id="${id}" ${value ? "checked" : ""} ${bind}${decrit}>
    ${labelHtml}
    ${desc}
  </div>`;
  }

  if (type === "LongText") {
    return `
  <div class="fr-input-group${compact ? " app-field--compact" : ""}">
    ${labelHtml}
    <textarea class="fr-input" id="${id}"${decrit} rows="${rows || 4}" placeholder="${esc(placeholder)}" ${bind}>${esc(str(value))}</textarea>
    ${desc}
  </div>`;
  }

  if (type === "Date") {
    const errId = `${id}-err`;
    return `
  <div class="fr-input-group app-date-group${compact ? " app-field--compact" : ""}">
    ${labelHtml}
    ${dateInput(id, value, bind + decrit, { placeholder: placeholder || "JJ/MM/AAAA" })}
    <p class="fr-error-text" id="${errId}" hidden>Date incomplète ou impossible. Écrivez par exemple 20/09/2026.</p>
    ${desc}
  </div>`;
  }

  const inputType = type === "Link" ? "url" : (type === "Int" || type === "Numeric") ? "number" : "text";
  // `opts.step` remplace le pas par défaut : une mesure en millimètres accepte
  // n'importe quelle décimale (« any »), là où un nombre ordinaire avance par
  // pas de 0,05.
  const stepAttr = step !== undefined ? ` step="${esc(step)}"`
    : type === "Numeric" ? ' step="0.05"' : type === "Int" ? ' step="1"' : "";
  // Un champ de saisie ne peut pas replier son texte : dans un tableau serré,
  // une valeur longue — un texte de référence, par exemple — se lit alors
  // tronquée. L'infobulle native redonne la valeur entière au survol.
  const title = value ? ` title="${esc(str(value))}"` : "";
  return `
  <div class="fr-input-group${compact ? " app-field--compact" : ""}">
    ${labelHtml}
    <input class="fr-input" type="${inputType}"${stepAttr} id="${id}"${decrit} value="${esc(str(value))}" placeholder="${esc(placeholder)}"${title} ${bind}>
    ${desc}
  </div>`;
}

/** Grille de champs (2 colonnes sur écran large, 1 sur mobile ; opts.cols = 3 ou 4). */
export function formGrid(tableName, columns, ctx, rec, opts = {}) {
  const md = opts.cols === 4 ? 3 : opts.cols === 3 ? 4 : 6;
  const cells = columns
    .filter((c) => col(tableName, c))
    .map((c) => {
      const def = col(tableName, c);
      const wide = def.type === "LongText" || def.type === "RefList:Sections_disciplinaires" || opts.wide?.includes(c);
      // `opts.rowsFor` (ou `opts.choicesFor`) adresse une restriction à une
      // seule colonne de la grille : les listes de sanctions, de motifs et de
      // voies de traitement dépendent du contexte de l'affaire.
      const eff = {
        ...opts,
        ...(opts.rowsFor?.[c] ? { rows: opts.rowsFor[c] } : {}),
        ...(opts.choicesFor?.[c] ? { choices: opts.choicesFor[c] } : {}),
        ...(opts.editable?.includes(c) ? { editable: true } : {}),
      };
      return `<div class="fr-col-12 ${wide || opts.single ? "" : `fr-col-md-${md}`}">${field(tableName, c, ctx, rec, eff)}</div>`;
    })
    .join("");
  return `<div class="fr-grid-row fr-grid-row--gutters app-form-grid">${cells}</div>`;
}

/**
 * Liste de définitions (libellé / valeur).
 *
 * `variante: "lignes"` range chaque couple sur sa propre ligne, libellé à
 * gauche et valeur à droite, séparés par un filet. C'est la présentation d'une
 * fiche : elle tient l'alignement même quand une valeur court sur plusieurs
 * lignes — là où la grille fluide par défaut entrelace les couples et perd le
 * lecteur dès qu'une valeur s'allonge.
 */
export function dl(entries, opts = {}) {
  const items = entries.filter(Boolean);
  if (!items.length) return "";
  const paire = ([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(str(v))}</dd>`;
  if (opts.variante === "lignes") {
    return `<dl class="app-dl app-dl--lignes">${items.map((e) => `<div class="app-dl__row">${paire(e)}</div>`).join("")}</dl>`;
  }
  return `<dl class="app-dl">${items.map(paire).join("")}</dl>`;
}

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

/**
 * Tableau DSFR.
 * rows: [{ id, cells: [html], attrs, selected }]
 */
export function dataTable({ caption, columns, rows, selectedId = null, emptyText = "Aucune donnée.", rowAttr = "data-select", rowMeta = "", class: klass = "", sort = null, cols = null }) {
  if (!rows.length) return emptyState(emptyText);
  return `
<div class="fr-table fr-table--bordered fr-table--sm ${klass}">
  <div class="fr-table__wrapper">
    <div class="fr-table__container">
      <div class="fr-table__content">
        <table>
          <caption>${esc(caption)}</caption>
          ${cols ? `<colgroup>${cols.map((w) => `<col${w && w !== "auto" ? ` style="width:${esc(w)}"` : ""}>`).join("")}</colgroup>` : ""}
          <thead>
            <tr>${columns.map((c, i) => `<th scope="col"${sort?.[i] ? " class=\"app-th--sortable\"" : ""}>${esc(c)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
            <tr class="${selectedId !== null && String(selectedId) === String(r.id) ? "fr-row--selected" : ""}" ${rowAttr ? `${rowAttr}="${r.id}"` : ""} ${rowMeta} ${r.attrs || ""}>
              ${r.cells.map((cell) => `<td>${cell}</td>`).join("")}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Boutons, pastilles, filtres                                         */
/* ------------------------------------------------------------------ */

export function button(label, opts = {}) {
  const { variant = "secondary", iconName, id, attrs = "", size, type = "button", title, action, hidden = false } = opts;
  return `<button type="${type}" class="fr-btn fr-btn--${variant}${size ? ` fr-btn--${size}` : ""}"${id ? ` id="${id}"` : ""}${hidden ? " hidden" : ""}${title ? ` title="${esc(title)}"` : ""}${action ? ` data-action="${esc(action)}"` : ""} ${attrs}>
    ${iconName ? icon(iconName, 'class="fr-mr-1v"') : ""}${esc(label)}</button>`;
}

export function iconButton(iconName, opts = {}) {
  const { title, attrs = "", variant = "tertiary-no-outline", size = "sm", action } = opts;
  return `<button type="button" class="fr-btn fr-btn--${variant}${size ? ` fr-btn--${size}` : ""}" title="${esc(title)}"${action ? ` data-action="${esc(action)}"` : ""} ${attrs}>${icon(iconName)}<span class="fr-sr-only">${esc(title)}</span></button>`;
}

/**
 * Onglets. `items` : [{ id, label, count }]
 * Le rendu du panneau est laissé à l'appelant — un seul panneau est monté, ce
 * qui évite de recharger les aperçus de document — mais il doit passer par
 * `tabPanel`, qui tient la promesse `aria-controls` faite ici. Seul l'onglet
 * actif en porte une : les autres n'ont pas de panneau dans la page, et
 * annoncer une cible absente serait pire que de se taire.
 */
export function tabs({ id, items, active, label = "Sections de la page" }) {
  return `
<div class="app-tabs" role="tablist" aria-label="${esc(label)}">
  ${items.map((it) => `
    <button type="button" class="app-tabs__tab" role="tab" id="${id}-tab-${esc(it.id)}"
      data-tab="${esc(id)}:${esc(it.id)}" aria-selected="${it.id === active ? "true" : "false"}"
      ${it.id === active ? `aria-controls="${id}-panel-${esc(it.id)}" ` : ""}tabindex="${it.id === active ? "0" : "-1"}">
      ${it.iconName ? icon(it.iconName, 'class="fr-mr-1v"') : ""}${esc(it.label)}
      ${it.count !== undefined && it.count !== null ? `<span class="app-tabs__count">${esc(it.count)}</span>` : ""}
    </button>`).join("")}
</div>`;
}

/**
 * Panneau de l'onglet `tab` — la cible que `tabs` annonce par `aria-controls`.
 * Un seul panneau est monté (celui de l'onglet actif) : les autres n'existent
 * pas dans la page, et un onglet inactif ne pointe donc vers rien — c'est le
 * principe même de l'onglet. `tabindex="0"` donne le panneau au clavier, même
 * lorsqu'il ne contient aucun élément focalisable (une liste vide, un texte).
 */
export function tabPanel({ id, tab, contenu, classe = "" }) {
  return `
<div class="app-tabs__panneau${classe ? ` ${classe}` : ""}" id="${esc(id)}-panel-${esc(tab)}"
  role="tabpanel" aria-labelledby="${esc(id)}-tab-${esc(tab)}" tabindex="0">
${contenu}
</div>`;
}

export function subnav({ items, active, label = "Sous-navigation" }) {
  // Les entrées peuvent se ranger sous un intitulé (`groupe`) : les réglages en
  // comptent onze, qu'une seule ligne rendait illisible.
  const noms = [...new Set(items.map((it) => it.groupe || ""))];
  const lien = (it) => `<li><a class="app-subnav__link" href="#${esc(it.hash)}" data-nav="${esc(it.hash)}" ${it.id === active ? 'aria-current="page"' : ""}>${it.iconName ? icon(it.iconName, 'class="fr-mr-1v"') : ""}${esc(it.label)}</a></li>`;
  return `
<nav class="app-subnav" aria-label="${esc(label)}">
  ${noms.map((nom) => `
  <div class="app-subnav__groupe">
    ${nom ? `<span class="app-subnav__groupe-nom">${esc(nom)}</span>` : ""}
    <ul class="app-subnav__list">
      ${items.filter((it) => (it.groupe || "") === nom).map(lien).join("")}
    </ul>
  </div>`).join("")}
</nav>`;
}

/**
 * Barre d'ancres d'une page longue — un sommaire qui reste collé sous le haut
 * de la fenêtre pendant qu'on déroule.
 *
 * Chaque entrée est un **bouton** : elle fait défiler la page jusqu'à la
 * section (`data-ancre`), ou bascule une vue (`tab`, comme les onglets), ou
 * imprime (`action`). C'est un choix, et il a une raison : un sommaire n'est pas
 * une adresse. Un lien `#section` aurait changé le fragment de l'URL, or
 * l'application *lit* l'adresse pour savoir où elle se trouve — un fragment de
 * section l'aurait envoyée vers une page qui n'existe pas, et un rechargement
 * aurait perdu la vue. L'entrée courante est marquée `aria-current`, et le
 * style s'y accroche comme pour la sous-navigation.
 */
export function anchors({ items, label = "Sections de la page" }) {
  return `
<nav class="app-anchors" aria-label="${esc(label)}">
  ${items.map((it) => {
    const inner = `${it.iconName ? icon(it.iconName, 'class="fr-mr-1v"') : ""}${esc(it.label)}`;
    const courant = it.active ? ' aria-current="true"' : "";
    const cible = it.tab ? `data-tab="${esc(it.tab)}"` : it.action ? `data-action="${esc(it.action)}"` : `data-ancre="${esc(it.hash)}"`;
    return `<button type="button" class="app-anchors__link"${cible}${courant}>${inner}</button>`;
  }).join("")}
</nav>`;
}

export function chip(label, { active = false, action = "", attrs = "", count } = {}) {
  return `<button type="button" class="app-chip${active ? " is-active" : ""}"${action ? ` data-action="${esc(action)}"` : ""} ${attrs} aria-pressed="${active}">
    ${esc(label)}${count !== undefined && count !== null ? `<span class="app-chip__count">${esc(count)}</span>` : ""}</button>`;
}

export function searchControl({ id, label = "Rechercher", value = "", placeholder = "", action = "" }) {
  return `
<div class="app-search">
  <label class="fr-label" for="${id}">${esc(label)}</label>
  <input class="fr-input" type="search" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}"${action ? ` data-action="${esc(action)}"` : ""}>
</div>`;
}

export function selectControl({ id, label, options, value, action, attrs = "", labelHidden = false }) {
  return `
<div class="fr-select-group app-select-inline">
  <label class="fr-label${labelHidden ? " fr-sr-only" : ""}" for="${id}">${esc(label || "")}</label>
  <select class="fr-select" id="${id}"${action ? ` data-action="${esc(action)}"` : ""} ${attrs}>
    ${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
  </select>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Cheminement d'état (workflow d'une affaire)                         */
/* ------------------------------------------------------------------ */

export function workflow(etats, current, { recordId = null, action = "set-etat" } = {}) {
  const idx = etats.indexOf(current);
  return `
<ol class="app-flow" aria-label="Avancement de l'affaire">
  ${etats.map((e, i) => {
    const state = i === idx ? "is-current" : i < idx ? "is-done" : "";
    return `<li class="app-flow__step ${state}">
      <button type="button" class="app-flow__btn" data-action="${esc(action)}" data-etat="${esc(e)}"${recordId !== null ? ` data-record="${recordId}"` : ""}
        title="Marquer l'affaire comme « ${esc(e)} »">
        <span class="app-flow__marker">${i < idx ? icon("checkbox-circle-fill") : i + 1}</span>
        <span class="app-flow__label">${esc(e)}</span>
      </button>
    </li>`;
  }).join("")}
</ol>`;
}

/* ------------------------------------------------------------------ */
/* Fenêtre modale                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fenêtre modale. Le corps porte la marque `data-scroll` comme les listes : la
 * position de défilement y est relevée puis remise à chaque rendu (voir
 * `captureView` dans `app.js`). Sans elle, choisir une valeur dans un champ du
 * formulaire — ce qui reconstruit la fenêtre — renverrait au premier champ,
 * alors que l'on veut poursuivre sa saisie plus bas.
 */
export function dialog({ id, title, subtitle = "", body, footer = "", size = "md" }) {
  return `
<div class="app-dialog-backdrop" data-dialog="${esc(id)}">
  <div class="app-dialog app-dialog--${esc(size)}" role="dialog" aria-modal="true" aria-labelledby="${esc(id)}-title">
    <div class="app-dialog__header">
      <div>
        <h2 class="fr-h5 fr-mb-0" id="${esc(id)}-title">${esc(title)}</h2>
        ${subtitle ? `<p class="fr-text--sm fr-text-mention--grey fr-mb-0">${esc(subtitle)}</p>` : ""}
      </div>
      ${iconButton("close-line", { title: "Fermer", action: "close-dialog" })}
    </div>
    <div class="app-dialog__body" data-scroll="modale">${body}</div>
    ${footer ? `<div class="app-dialog__footer">${footer}</div>` : ""}
  </div>
</div>`;
}

export function stepper(etapes, current) {
  const idx = etapes.findIndex((e) => e.id === current);
  return `
<ol class="app-stepper" aria-label="Étapes">
  ${etapes.map((e, i) => `<li class="app-stepper__item ${i === idx ? "is-current" : i < idx ? "is-done" : ""}">
    <span class="app-stepper__num">${i + 1}</span>
    <span class="app-stepper__label">${esc(e.label)}</span>
  </li>`).join("")}
</ol>`;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export function toast(message, type = "success") {
  let ctn = document.getElementById("toasts");
  if (!ctn) {
    ctn = document.createElement("div");
    ctn.id = "toasts";
    ctn.className = "app-toasts";
    ctn.setAttribute("aria-live", "polite");
    document.body.appendChild(ctn);
  }
  const el = document.createElement("div");
  el.className = `fr-alert fr-alert--${type} fr-alert--sm app-toast`;
  el.innerHTML = `<p class="fr-alert__title">${esc(message)}</p>`;
  ctn.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
