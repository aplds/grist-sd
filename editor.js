// Éditeur WYSIWYG des trames et des types de trames.
//
// Un texte de document est un fragment HTML où des balises sont remplacées au
// moment du rendu. L'éditeur le présente comme un texte mis en forme, dans
// lequel les balises deviennent des pastilles. Deux familles de balises :
//
//   `{{Colonne}}`  le corps des trames (voir trame-variables.js) ;
//   `{variable}`   les en-têtes, signatures et pieds de page des types.
//
//   - la palette latérale liste les balises disponibles, groupées et
//     filtrables ; on les glisse dans le texte, ou on clique pour les insérer
//     à la position du curseur ; le point de dépôt est marqué d'une barre, et
//     le fantôme du geste se réduit à la balise pour ne pas le masquer ;
//   - chaque pastille montre, au choix, la valeur d'exemple (rendu « tel que
//     le document l'affichera ») ou la balise elle-même ;
//   - à l'enregistrement, les pastilles redeviennent du texte : le moteur de
//     rendu du document reste donc strictement inchangé.
//
// Un même écran peut présenter plusieurs zones d'édition (la feuille de style
// d'une trame, puis son texte) : elles partagent leur barre d'outils et leur
// palette, qui agissent sur la zone active. Chaque zone peut déclarer sa propre
// famille de balises — `data-chips` sur la zone l'emporte sur celui du
// conteneur —, de sorte qu'une feuille de style (`{variable}`, `{{Corps}}`) et
// un corps de trame (`{{Colonne}}`) cohabitent sans se confondre.
//
// L'édition n'est pas limitée au texte simple : la barre d'outils insère des
// tableaux, des images, des traits et des sauts de page, règle la police, la
// taille, la couleur et le surlignage d'un passage (les quatre menus, voir
// `TYPOGRAPHIE`), décale un paragraphe ou marque sa seule **première ligne**
// (voir « Retraits » plus bas), et le bouton « code » bascule la zone active en
// HTML brut — de quoi traiter une trame ou un document sans passer par une
// bibliothèque d'édition tierce. La touche **Tabulation** pose ces retraits
// d'un geste, comme dans un traitement de texte.
//
// Cette écriture HTML peut aussi être choisie de l'extérieur : un conteneur
// qui porte `data-wysiwyg-view="balisage"` s'ouvre directement dans cette vue
// (voir l'espace de rédaction d'un document, `views/documents.js`).
//
// Aucune dépendance externe : l'édition s'appuie sur `contenteditable` et sur
// les commandes natives du navigateur.

import { labelOfToken } from "./trame-variables.js";
import { esc, icon, toast } from "./ui.js";
import { styleRegex, tokenRegex, variableRegex } from "./render.js";
import { assainirHtmlSecurite } from "./sanitize.js";

const CHIP_SELECTOR = "[data-token]";

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

/** Balise transformée en pastille : deux affichages, permutables en CSS. */
export function chipHtml(token, label, sample) {
  const value = String(sample ?? "").trim();
  const shown = value || label || token;
  return `<span class="app-token" contenteditable="false" draggable="true" data-token="${esc(token)}" title="${esc(token)}">`
    + `<span class="app-token__value${value ? "" : " app-token__value--empty"}">${esc(shown)}</span>`
    + `<span class="app-token__code">${esc(token)}</span>`
    + "</span>";
}

/**
 * Remplace, dans un HTML de trame, chaque balise par sa pastille.
 *
 * Seuls les nœuds de texte sont traités : une balise écrite dans un attribut
 * (un courriel `mailto:{mail_sd}`, par exemple) reste intacte, sinon la
 * réécriture abîmerait l'attribut et le document perdrait son lien.
 *
 * `pattern` choisit la famille de balises (`tokenRegex` par défaut,
 * `variableRegex` pour les en-têtes et pieds de page).
 */
export function htmlToEditor(html, chipFor, pattern = tokenRegex()) {
  const source = String(html ?? "");
  if (!source) return "";
  const holder = document.createElement("template");
  holder.innerHTML = source;
  const walker = document.createTreeWalker(holder.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue || "";
    const re = new RegExp(pattern.source, "g");
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match;
    while ((match = re.exec(text))) {
      if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      frag.appendChild(nodeFromHtml(chipFor(match[0])) || document.createTextNode(match[0]));
      last = match.index + match[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  return holder.innerHTML;
}

/**
 * Écriture canonique d'un HTML : le navigateur réécrit ce qu'on lui donne —
 * `&Eacute;` devient « É », `<br />` devient `<br>`, une balise restée ouverte
 * se referme —, et un texte qui n'a pas bougé ne se reconnaît qu'à cette
 * écriture-là. Sert à comparer le texte rendu par un éditeur à la référence
 * dont il est parti (voir `data-wysiwyg-base`).
 */
export function htmlCanonique(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html ?? "");
  return tpl.innerHTML.trim();
}

/** Contenu enregistrable d'un éditeur : les pastilles redeviennent du texte. */
export function editorToHtml(el) {
  const clone = el.cloneNode(true);
  for (const chip of clone.querySelectorAll(CHIP_SELECTOR)) {
    chip.replaceWith(document.createTextNode(chip.dataset.token));
  }
  for (const junk of clone.querySelectorAll("[data-editor-cleanup]")) junk.remove();
  let html = clone.innerHTML.trim();
  if (!html || /^(<br\s*\/?>|<p><br\s*\/?><\/p>|<div><br\s*\/?><\/div>)+$/i.test(html)) return "";
  return assainirHtmlSecurite(html);
}

/* ------------------------------------------------------------------ */
/* Palette des variables                                               */
/* ------------------------------------------------------------------ */

/**
 * Catalogues des palettes montées, retrouvés par l'identifiant de la palette :
 * ils fournissent le libellé et la valeur d'exemple des pastilles créées à la
 * volée (glisser-déposer, saisie directe).
 */
const catalogs = new Map();

export function paletteHtml(catalog, options = {}) {
  const {
    id = "tramePalette",
    label = "Variables",
    hint = "Glissez une variable dans le texte, ou cliquez pour l'insérer au curseur.",
    placeholder = "Rechercher…",
  } = options;
  catalogs.set(id, catalog?.index || {});
  const groups = (catalog?.groups || []).map((group) => `
<section class="app-palette__group" data-group="${esc(group.id)}">
  <h3 class="app-palette__title">${group.icon ? icon(group.icon, 'class="fr-mr-1v"') : ""}${esc(group.label)}</h3>
  ${group.hint ? `<p class="app-palette__hint">${esc(group.hint)}</p>` : ""}
  <div class="app-palette__items">${group.entries.map(variableButton).join("")}</div>
</section>`).join("");

  return `
<div class="app-palette" id="${esc(id)}" data-wysiwyg-palette>
  <div class="app-palette__head">
    <label class="fr-label" for="${esc(id)}Q">${esc(label)}
      <span class="fr-hint-text">${esc(hint)}</span>
    </label>
    <input type="search" class="fr-input" id="${esc(id)}Q" data-wysiwyg-query placeholder="${esc(placeholder)}" autocomplete="off">
  </div>
  <div class="app-palette__body" data-scroll="${esc(id)}">
    ${groups}
    <p class="app-palette__empty app-hidden" data-palette-empty>Aucune variable ne correspond à cette recherche.</p>
  </div>
</div>`;
}

function shortSample(sample) {
  const s = String(sample ?? "").replace(/\s+/g, " ").trim();
  return s.length > 48 ? `${s.slice(0, 47)}…` : s;
}

function variableButton(entry) {
  const search = `${entry.label} ${entry.token} ${entry.sample}`.toLowerCase();
  return `
<span class="app-var" role="button" tabindex="0" draggable="true"
  data-token="${esc(entry.token)}" data-search="${esc(search)}"
  title="Glisser dans le texte, ou cliquer pour insérer à la position du curseur\n${esc(entry.token)}">
  <span class="app-var__name">${esc(entry.label)}</span>
  ${entry.sample ? `<span class="app-var__value">${esc(shortSample(entry.sample))}</span>` : ""}
</span>`;
}

/* ------------------------------------------------------------------ */
/* Barre d'outils                                                      */
/* ------------------------------------------------------------------ */

/**
 * Barre d'outils, groupée : chaque groupe est une suite de commandes de même
 * nature, séparée des autres par un trait. Une commande vaut
 * `[commande, valeur, icône, infobulle]` — les commandes natives du navigateur
 * (`bold`, `formatBlock`…) comme les commandes propres à l'outil (`pageBreak`,
 * `insertTable`, `insertImage`, `retraitPremiere`), traitées par
 * `runEditorCommand` (app.js). L'icône est un nom d'icône du DSFR, ou un
 * dessin écrit ici quand le jeu d'icônes n'en a pas (voir `PICTO_…`).
 */

/**
 * Pictogramme du **retrait de première ligne** : trois lignes de texte dont la
 * première commence plus loin — le dessin même de ce que le bouton fait au
 * paragraphe, et la seule icône que le DSFR ne fournit pas. Il sert aussi bien
 * dans la barre d'outils de l'éditeur que dans les gestes de l'atelier de
 * rédaction (voir `retraitConsiderants`, decision-redaction.js).
 */
export const PICTO_RETRAIT_PREMIERE_LIGNE = '<svg class="app-picto" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M9 4h13M2 12h20M2 20h20"/></svg>';

const TOOLBAR = [
  [
    ["undo", "", "arrow-go-back-line", "Annuler"],
    ["redo", "", "arrow-go-forward-line", "Rétablir"],
  ],
  [
    ["bold", "", "bold", "Gras"],
    ["italic", "", "italic", "Italique"],
    ["underline", "", "underline", "Souligné"],
    ["strikeThrough", "", "strikethrough", "Barré"],
    ["superscript", "", "superscript", "Exposant"],
    ["subscript", "", "subscript", "Indice"],
  ],
  [
    ["formatBlock", "h1", "h-1", "Titre de niveau 1"],
    ["formatBlock", "h2", "h-2", "Titre de niveau 2"],
    ["formatBlock", "h3", "h-3", "Titre de niveau 3"],
    ["formatBlock", "h4", "h-4", "Titre de niveau 4"],
    ["formatBlock", "blockquote", "quote-line", "Citation"],
    ["formatBlock", "pre", "code-block", "Bloc de code"],
    ["formatBlock", "p", "¶", "Paragraphe courant"],
  ],
  [
    ["insertUnorderedList", "", "list-unordered", "Liste à puces"],
    ["insertOrderedList", "", "list-ordered", "Liste numérotée"],
    ["outdent", "", "indent-decrease", "Diminuer le retrait du paragraphe"],
    ["indent", "", "indent-increase", "Augmenter le retrait du paragraphe"],
    ["retraitPremiere", "", PICTO_RETRAIT_PREMIERE_LIGNE,
      "Retrait de première ligne (considérants) — ou touche Tabulation en début de paragraphe"],
  ],
  [
    ["justifyLeft", "", "align-left", "Aligner à gauche"],
    ["justifyCenter", "", "align-center", "Centrer"],
    ["justifyRight", "", "align-right", "Aligner à droite"],
    ["justifyFull", "", "align-justify", "Justifier"],
  ],
  [
    ["createLink", "", "link", "Insérer un lien"],
    ["insertHorizontalRule", "", "separator", "Trait de séparation"],
    ["pageBreak", "", "scissors-cut-line", "Saut de page"],
    ["insertTable", "", "table-2", "Insérer un tableau"],
    ["insertImage", "", "image-add-line", "Insérer une image"],
    ["removeFormat", "", "format-clear", "Effacer la mise en forme"],
  ],
];

/** Le DSFR n'a pas d'icône « paragraphe » : le pied-de-mouche la remplace. */
const isIconName = (s) => /^[a-z0-9-]+$/.test(s);

/**
 * Réglages typographiques : police, taille, couleur du texte, surlignage.
 *
 * Ce ne sont pas des commandes — on y choisit une valeur dans une liste — mais
 * l'effet est le même : une mise en forme appliquée à la sélection, qui
 * s'enregistre comme les autres (un `span` portant son style). Le texte exporté
 * en Word ou en OpenDocument reçoit la police, la taille et le surlignage
 * (voir `styleOf` dans export-doc.js) ; l'aperçu et le PDF les montrent tels
 * quels.
 *
 * Les tailles sont en **points**, la mesure du papier, et forment l'échelle du
 * document (`DOCUMENT_CSS`) : 12 pt est la taille du corps, 14 pt celle d'un
 * **titre** — celle des modèles livrés, et celle que les titres insérés par la
 * barre d'outils emploient. Les couleurs sont celles du DSFR — encre, et fonds
 * clairs pour le surlignage — écrites en clair : un document ne dispose pas des
 * jetons de l'interface, il peut être converti ou imprimé hors connexion.
 */
const TYPOGRAPHIE = [
  {
    prop: "font-family",
    label: "Police",
    defaut: "Comme le document",
    options: [
      ["Arial, Helvetica, sans-serif", "Arial"],
      ['"Times New Roman", Times, serif', "Times New Roman"],
      ["Georgia, serif", "Georgia"],
      ["Verdana, Geneva, sans-serif", "Verdana"],
      ['"Courier New", Courier, monospace', "Courier (chasse fixe)"],
    ],
  },
  {
    prop: "font-size",
    label: "Taille",
    defaut: "Comme le document",
    options: [
      ["8pt", "8 pt — mentions"],
      ["9pt", "9 pt"],
      ["10pt", "10 pt — petit"],
      ["11pt", "11 pt"],
      ["12pt", "12 pt — corps du texte"],
      ["14pt", "14 pt — titre"],
      ["16pt", "16 pt — grand"],
      ["18pt", "18 pt — très grand"],
      ["20pt", "20 pt"],
      ["24pt", "24 pt"],
      ["28pt", "28 pt — grand titre"],
    ],
  },
  {
    prop: "color",
    label: "Couleur",
    defaut: "Comme le document",
    options: [
      ["#161616", "Noir"],
      ["#666666", "Gris"],
      ["#000091", "Bleu"],
      ["#ce0500", "Rouge"],
      ["#18753c", "Vert"],
    ],
  },
  {
    prop: "background-color",
    label: "Surlignage",
    defaut: "Aucun",
    options: [
      ["#fde39c", "Jaune"],
      ["#c3fad5", "Vert"],
      ["#dee5fd", "Bleu"],
      ["#fddfda", "Rose"],
    ],
  },
];

/** Les quatre menus typographiques de la barre d'outils. */
function typographieHtml() {
  return TYPOGRAPHIE.map((reglage) => `
    <label class="app-wysiwyg__field">
      <span class="app-wysiwyg__field-label">${esc(reglage.label)}</span>
      <select class="app-wysiwyg__select" data-wysiwyg-style="${esc(reglage.prop)}"
        title="${esc(`${reglage.label} — appliquer à la sélection`)}">
        <option value="">${esc(reglage.defaut)}</option>
        ${reglage.options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("")}
      </select>
    </label>`).join("");
}

/**
 * `source: false` retire le bouton « code » de la barre : la zone est alors
 * pilotée par un choix de vue extérieur (l'espace de rédaction d'un document,
 * voir `documentEditor`), et deux commandes pour la même bascule se
 * contrediraient.
 */
export function toolbarHtml({ source = true } = {}) {
  // Un nom d'icône donne une icône du DSFR ; un dessin (balise) est posé tel
  // quel ; tout le reste — « ¶ », par exemple — est un caractère.
  const dessin = (ico) => (isIconName(ico) ? icon(ico)
    : ico.startsWith("<") ? ico
      : `<span class="app-wysiwyg__glyph" aria-hidden="true">${esc(ico)}</span>`);
  const groups = TOOLBAR.map((group) => `
  <span class="app-wysiwyg__group">
    ${group.map(([cmd, value, ico, title]) => `
    <button type="button" class="app-wysiwyg__btn" data-cmd="${cmd}"${value ? ` data-value="${value}"` : ""}
      title="${esc(title)}" aria-label="${esc(title)}">${dessin(ico)}</button>`).join("")}
  </span>`).join(`<span class="app-wysiwyg__sep" aria-hidden="true"></span>`);

  return `
<div class="app-wysiwyg__toolbar" data-wysiwyg-toolbar role="toolbar" aria-label="Mise en forme du texte">
  <div class="app-wysiwyg__commands">
    ${groups}
    <label class="app-wysiwyg__toggle" title="Afficher les balises au lieu des valeurs d'exemple">
      <input type="checkbox" data-wysiwyg-tokens><span>Balises</span>
    </label>
    ${source ? `<button type="button" class="app-wysiwyg__btn" data-wysiwyg-source
      title="Modifier le code HTML" aria-label="Modifier le code HTML">${icon("code-s-slash-line")}</button>` : ""}
  </div>
  <div class="app-wysiwyg__typo">${typographieHtml()}</div>
</div>`;
}

/** État des boutons (actif/inactif) selon la sélection courante. */
export function refreshToolbar() {
  const stateful = ["bold", "italic", "underline", "strikeThrough", "superscript", "subscript",
    "insertUnorderedList", "insertOrderedList"];
  for (const bar of document.querySelectorAll("[data-wysiwyg-toolbar]")) {
    for (const btn of bar.querySelectorAll("[data-cmd]")) {
      const cmd = btn.dataset.cmd;
      if (!stateful.includes(cmd)) continue;
      let on = false;
      try { on = document.queryCommandState(cmd); } catch { on = false; }
      // La commande ignore les pastilles : son état ne les voit pas. Une
      // pastille en italique dans une sélection en romain allume quand même.
      if (!on && EFFETS_LIGNE[cmd]) on = effetPorteParSelection(EFFETS_LIGNE[cmd]);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    // Le retrait de première ligne n'est pas une commande du navigateur : son
    // repère se lit sur le bloc où se trouve le curseur, comme l'état de la
    // sélection se lit sur ses balises.
    const boutonRetrait = bar.querySelector('[data-cmd="retraitPremiere"]');
    if (boutonRetrait) {
      const bloc = blocCourant();
      boutonRetrait.setAttribute("aria-pressed", bloc && retraitDe(bloc).premiere > 0 ? "true" : "false");
    }
    refreshTypographie(bar);
  }
}

/* ------------------------------------------------------------------ */
/* Police, taille, couleur et surlignage                               */
/* ------------------------------------------------------------------ */

/** Élément de la sélection courante, s'il est dans une zone d'édition. */
function selectionElement() {
  const sel = document.getSelection();
  const node = sel && sel.anchorNode ? sel.anchorNode : null;
  if (!node) return null;
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el || !el.closest) return null;
  return el.closest("[data-wysiwyg-editor]") ? el : null;
}

/**
 * Mise en forme qu'un passage porte **en propre** : remonte la chaîne des
 * éléments jusqu'à la zone d'édition et retient la première valeur écrite en
 * style en ligne. C'est ce que les menus montrent — la mise en forme posée sur
 * le passage, et non celle, héritée, de la charte ou du document.
 */
function inlineValue(el, prop) {
  let node = el;
  while (node && node.nodeType === 1) {
    const value = node.style ? node.style.getPropertyValue(prop) : "";
    if (value) return value;
    if (node.hasAttribute("data-wysiwyg-editor")) break;
    node = node.parentElement;
  }
  return "";
}

/** `rgb(206, 5, 0)` → `#ce0500` ; la forme rendue par la CSSOM du navigateur. */
function toHex(value) {
  const m = /^rgba?\(([^)]+)\)$/.exec(String(value || "").trim());
  if (!m) return String(value || "").toLowerCase();
  const parts = m[1].split(",").map((v) => Number(v.trim()));
  if (parts.length > 3 && parts[3] === 0) return "";
  return `#${parts.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Piles de polices égales : la comparaison ignore espaces et guillemets. */
const memePile = (a, b) => String(a).replace(/["'\s]/g, "").toLowerCase() === String(b).replace(/["'\s]/g, "").toLowerCase();

/**
 * Met chaque menu sur la valeur du passage où se trouve le curseur : un menu
 * qui montrerait toujours la même chose ferait croire à une mise en forme
 * qu'il n'a pas posée.
 */
function refreshTypographie(bar) {
  const el = selectionElement();
  for (const select of bar.querySelectorAll("[data-wysiwyg-style]")) {
    if (!el) continue;
    const prop = select.dataset.wysiwygStyle;
    const propre = inlineValue(el, prop);
    const trouve = [...select.options].find((opt) => {
      if (!opt.value) return false;
      if (prop === "font-family") return memePile(opt.value, propre);
      if (prop === "font-size") return opt.value === propre;
      return opt.value.toLowerCase() === toHex(propre);
    });
    select.value = trouve ? trouve.value : "";
  }
}

/** Éléments qui portent la propriété au-dessus de la plage, du plus proche au plus haut. */
function proprietaires(range, prop, editor) {
  const out = [];
  let node = range.startContainer;
  if (node.nodeType !== 1) node = node.parentElement;
  while (node && node !== editor && node.nodeType === 1) {
    if (node.style && node.style.getPropertyValue(prop)) out.push(node);
    node = node.parentElement;
  }
  return out;
}

/** Un élément qui ne dit plus rien : pas d'image, pas de jeton, pas de texte. */
const sansContenu = (el) => !el.querySelector("img, hr, table, .app-token") && !el.textContent.replace(/[\s\u00a0]/g, "");

/**
 * Coupe un élément porteur autour de la plage : il ne garde que ce qui précède,
 * un clone reçoit ce qui suit, et le passage sélectionné est rendu entre les
 * deux — hors de l'élément, donc sans la propriété qu'il portait. Le clone est
 * ce qui permet au texte voisin, qui n'était pas sélectionné, de garder la
 * sienne. Renvoie la plage du passage détaché, ou `null` si la plage déborde de
 * l'élément (auquel cas l'extraction ordinaire suffit).
 *
 * Le passage est **déplacé**, non cloné (`extractContents`) : les nœuds gardent
 * leur identité — une pastille dégagée reste la même pastille, et la référence
 * que l'appelant tient sur elle demeure valable pour le porteur suivant (voir
 * `delaverPastilles`, qui dégagent les effets empilés un par un).
 */
function detacher(range, el) {
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const contenu = range.extractContents();
  const point = range.cloneRange();
  const queue = document.createRange();
  queue.setStart(point.startContainer, point.startOffset);
  queue.setEnd(el, el.childNodes.length);
  const suite = queue.extractContents();
  const clone = el.cloneNode(false);
  clone.appendChild(suite);
  el.after(clone);
  const premier = contenu.firstChild;
  const dernier = contenu.lastChild;
  el.after(contenu);
  if (el.tagName === "SPAN" && sansContenu(el)) el.remove();
  if (clone.tagName === "SPAN" && sansContenu(clone) && clone.parentNode) clone.remove();
  const out = document.createRange();
  if (!premier || !dernier) {
    const repere = clone.parentNode || el.parentNode || point.startContainer;
    out.setStartAfter(repere);
    out.collapse(true);
    return out;
  }
  out.setStartBefore(premier);
  out.setEndAfter(dernier);
  return out;
}

/**
 * Applique — ou retire, si `value` est vide — une propriété de style à une
 * plage de texte, et renvoie la plage du passage mis en forme.
 *
 * La plage est **extraite puis réinsérée**, comme le fait la commande native
 * `fontSize` du navigateur : quand la sélection ne couvre qu'une partie d'un
 * passage déjà mis en forme, le clône qui la porte reprend la mise en forme
 * d'origine — on la lui retire, sinon l'ancienne valeur, plus profonde,
 * l'emporterait sur la nouvelle. Le reste du passage garde la sienne.
 *
 * Le retrait a une difficulté de plus : la mise en forme peut venir d'un
 * élément qui **englobe** la sélection sans être dedans — un passage réglé plus
 * tôt, dont on ne veut changer qu'une partie. L'extraction ne le voit pas, il
 * faut le couper autour de la sélection (voir `detacher`) avant d'y toucher.
 */
export function applyTextStyle(editor, range, prop, value) {
  if (!editor || !range || range.collapsed) return null;
  let plage = range;
  if (!value) {
    let porteurs = proprietaires(plage, prop, editor);
    while (porteurs.length) {
      const detachee = detacher(plage, porteurs[0]);
      if (!detachee) break;
      plage = detachee;
      porteurs = proprietaires(plage, prop, editor);
    }
    if (plage.collapsed) return null;
  }
  const frag = plage.extractContents();
  for (const el of frag.querySelectorAll("*")) {
    if (!el.style || !el.style.length) continue;
    el.style.removeProperty(prop);
    if (!el.getAttribute("style")) el.removeAttribute("style");
    // Un `span` sans plus rien à dire disparaît : le texte remonte d'un cran,
    // et l'enregistrement ne garde pas la trace des mises en forme annulées.
    if (el.tagName === "SPAN" && !el.attributes.length) el.replaceWith(...el.childNodes);
  }
  let node;
  if (value) {
    node = document.createElement("span");
    node.style.setProperty(prop, value);
    node.appendChild(frag);
  } else {
    node = frag;
  }
  const premier = node.firstChild;
  const dernier = node.lastChild;
  plage.insertNode(node);
  // La sélection reste sur le passage mis en forme : régler une deuxième
  // propriété — la couleur après la taille — s'applique au même passage.
  const out = document.createRange();
  if (!premier || !dernier) {
    out.setStartAfter(plage.startContainer);
    out.collapse(true);
    return out;
  }
  out.setStartBefore(premier);
  out.setEndAfter(dernier);
  return out;
}

/* ------------------------------------------------------------------ */
/* Effets en ligne sur les pastilles                                   */
/* ------------------------------------------------------------------ */

/**
 * Effets en ligne de la barre d'outils, et leur balise : ce sont les commandes
 * natives du navigateur (`bold`, `italic`…) routées par `runEditorCommand`
 * (app.js) — `styleWithCSS` étant désactivé à la montée de l'éditeur, le
 * navigateur les exprime par ces mêmes balises simples.
 */
const EFFETS_LIGNE = {
  bold: "STRONG", italic: "EM", underline: "U",
  strikeThrough: "S", superscript: "SUP", subscript: "SUB",
};
/** Mêmes effets sous un autre nom : le navigateur et les collages varient. */
const EFFETS_EQ = { B: "STRONG", I: "EM", STRIKE: "S", DEL: "S" };
/** Tout ce qui ne fait que mettre en forme un passage, sans rien structurer. */
const MISE_EN_FORME = new Set([
  "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "DEL", "SUP", "SUB", "FONT", "MARK", "SPAN",
]);

const effetTag = (el) => EFFETS_EQ[el.tagName] || el.tagName;

/** Pastilles que la plage touche, même partiellement. */
function pastillesTouchees(editor, range) {
  const out = [];
  if (!editor || !range) return out;
  for (const chip of editor.querySelectorAll(CHIP_SELECTOR)) {
    try {
      if (range.intersectsNode(chip)) out.push(chip);
    } catch { /* plage périmée */
    }
  }
  return out;
}

/** Le porteur de l'effet au-dessus de la pastille, s'il y en a un. */
function porteurEffet(editor, chip, tag) {
  let node = chip.parentElement;
  while (node && node !== editor && node.nodeType === 1) {
    if (effetTag(node) === tag) return node;
    node = node.parentElement;
  }
  return null;
}

/** Enveloppe la pastille de l'effet : elle le montre et l'enregistre. */
function envelopperPastille(chip, tag) {
  const el = document.createElement(tag);
  chip.replaceWith(el);
  el.appendChild(chip);
}

/**
 * Dégage la pastille de l'effet sans toucher au reste : le porteur est coupé
 * autour d'elle (voir `detacher`), et ses deux moignons retirés s'ils sont
 * vides — un `<strong></strong>` fantôme encombrerait l'enregistrement.
 */
function degagerPastille(chip, porteur) {
  const tag = porteur.tagName;
  const plage = document.createRange();
  plage.selectNode(chip);
  const detachee = detacher(plage, porteur);
  if (!detachee) return;
  for (const el of [porteur, chip.nextSibling]) {
    if (el && el.nodeType === 1 && el.tagName === tag && sansContenu(el)) el.remove();
  }
  placeCaret(detachee);
}

/**
 * Bascule un effet en ligne (gras, italique…) sur une sélection qui touche des
 * pastilles, et rend `true`. Le navigateur applique ses commandes au texte
 * mais ignore la pastille — un îlot insécable (`contenteditable="false"`) —
 * pour l'italique, le souligné et le barré, **sans le dire** (la commande rend
 * `true`) : la pastille restait en romain quand le texte passait en italique.
 *
 * Le navigateur fait donc d'abord son travail sur le texte, puis chaque
 * pastille touchée est ramenée au sens de la bascule — enveloppée quand
 * l'effet s'applique, dégagée quand il se retire. Sans pastille touchée, sans
 * sélection, ou pour une autre commande, rend `false` : la commande native
 * suffit alors (curseur seul, texte seul).
 */
export function basculerEffet(editor, cmd) {
  const tag = EFFETS_LIGNE[cmd];
  if (!editor || !tag) return false;
  const plage = currentRange(editor) || plageMemorisee(editor);
  if (!plage || plage.collapsed) return false;
  const pastilles = pastillesTouchees(editor, plage);
  if (!pastilles.length) return false;
  // Le sens de la bascule : celui de la commande, sauf quand la sélection ne
  // couvre que des pastilles — la commande, qui les ignore, n'a alors rien à
  // en dire, et ce sont elles qui décident.
  let eteindre = false;
  try { eteindre = document.queryCommandState(cmd); } catch { /* ignore */
  }
  if (!eteindre) {
    const clone = plage.cloneContents();
    for (const chip of clone.querySelectorAll(CHIP_SELECTOR)) chip.remove();
    if (!clone.textContent.replace(/[\s\u00a0]/g, "") && !clone.querySelector("img, hr, table")) {
      eteindre = pastilles.every((chip) => porteurEffet(editor, chip, tag));
    }
  }
  try { placeCaret(plage); } catch { /* plage mémorisée périmée */
  }
  try { document.execCommand(cmd, false, null); } catch { /* le rattrapage suit */
  }
  for (const chip of pastilles) {
    if (!chip.isConnected || !editor.contains(chip)) continue;
    const porteur = porteurEffet(editor, chip, tag);
    if (!eteindre && !porteur) envelopperPastille(chip, tag);
    else if (eteindre && porteur) degagerPastille(chip, porteur);
  }
  return true;
}

/**
 * « Effacer la mise en forme » sur une sélection qui touche des pastilles, et
 * rend `true`. La commande native ignore là aussi la pastille, qui gardait son
 * gras ou sa couleur : chaque pastille touchée est dégagée de tout ce qui ne
 * fait que la mettre en forme (voir `MISE_EN_FORME`), par découpe autour
 * d'elle — le texte voisin garde la sienne. Sans pastille touchée, rend
 * `false` et la commande native suffit.
 */
export function delaverPastilles(editor) {
  if (!editor) return false;
  const plage = currentRange(editor) || plageMemorisee(editor);
  if (!plage || plage.collapsed) return false;
  const pastilles = pastillesTouchees(editor, plage);
  if (!pastilles.length) return false;
  try { placeCaret(plage); } catch { /* plage mémorisée périmée */
  }
  try { document.execCommand("removeFormat", false, null); } catch { /* voir ci-dessous */
  }
  for (const chip of pastilles) {
    if (!chip.isConnected || !editor.contains(chip)) continue;
    let parent = chip.parentElement;
    while (parent && parent !== editor && parent.nodeType === 1
      && MISE_EN_FORME.has(parent.tagName)
      && !parent.matches(CHIP_SELECTOR) && !parent.hasAttribute("data-marque")) {
      const porteur = parent;
      parent = parent.parentElement;
      degagerPastille(chip, porteur);
      if (!chip.isConnected) break;
      parent = chip.parentElement;
    }
  }
  return true;
}

/** Un effet porté par une pastille de la sélection courante. */
function effetPorteParSelection(tag) {
  const sel = typeof document !== "undefined" ? document.getSelection() : null;
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const el = node && node.nodeType === 1 ? node : node && node.parentElement;
  const editor = el && el.closest ? el.closest("[data-wysiwyg-editor]") : null;
  if (!editor) return false;
  return pastillesTouchees(editor, range).some((chip) => porteurEffet(editor, chip, tag));
}

/**
 * Dernière zone d'édition utilisée : la barre d'outils et la palette agissent
 * sur elle. Le focus réel est prioritaire, pour que les commandes de mise en
 * forme s'appliquent toujours à la zone où l'on écrit.
 */
let tracked = null;

export function currentEditor() {
  const focused = document.activeElement;
  if (focused && focused.matches && focused.matches("[data-wysiwyg-editor]")) return focused;
  if (tracked && document.contains(tracked)) return tracked;
  return document.querySelector("[data-wysiwyg-editor]");
}

/**
 * Dernière plage connue dans chaque zone d'édition.
 *
 * Cliquer un bouton de l'outil (« Insérer », un visa, un intertitre) déplace le
 * focus hors de l'éditeur : la sélection du navigateur est alors perdue, et
 * l'insertion retombait à la fin du texte. La position du curseur est donc
 * retenue pendant qu'elle existe, et reprise quand le focus est ailleurs. La
 * table est indexée par l'élément d'édition lui-même : un rendu qui refait la
 * zone repart donc sans plage périmée.
 */
const dernieresPlages = new WeakMap();

function memoriserPlage() {
  const sel = document.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const el = node && node.nodeType === 1 ? node : node && node.parentElement;
  const editor = el && el.closest ? el.closest("[data-wysiwyg-editor]") : null;
  if (editor) dernieresPlages.set(editor, range.cloneRange());
}

/** La plage retenue pour une zone, si elle y tombe encore. */
function plageMemorisee(editor) {
  const range = dernieresPlages.get(editor);
  return range && editor.contains(range.startContainer) ? range : null;
}

if (typeof document !== "undefined") {
  document.addEventListener("selectionchange", () => {
    if (!document.querySelector("[data-wysiwyg-editor]")) return;
    memoriserPlage();
    refreshToolbar();
  });
}

/* ------------------------------------------------------------------ */
/* Insertion et glisser-déposer                                        */
/* ------------------------------------------------------------------ */

function nodeFromHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return tpl.content.firstElementChild;
}

/** Position de dépôt sous le pointeur, si elle tombe dans l'éditeur. */
function rangeFromPoint(editor, x, y) {
  let range = null;
  if (typeof document.caretRangeFromPoint === "function") {
    range = document.caretRangeFromPoint(x, y);
  } else if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !editor.contains(range.startContainer)) return null;
  return range;
}

function currentRange(editor) {
  const sel = document.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  return editor.contains(range.startContainer) ? range : null;
}

function placeCaret(range) {
  const sel = document.getSelection();
  if (!sel || !range) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ------------------------------------------------------------------ */
/* Repère de dépôt                                                     */
/* ------------------------------------------------------------------ */

/*
 * Où tombera la balise qu'on fait glisser ? Le curseur natif du navigateur est
 * un trait d'un pixel, et le fantôme du geste — l'image de la barre de la
 * palette, tant qu'on ne la réduit pas (voir `reduireFantome`) — le recouvre :
 * rien ne montre le point de dépôt. Cette barre le double, haute de la ligne
 * visée, posée entre les deux caractères qui encadreront la pastille.
 *
 * Elle est fixée **au document**, et jamais posée dans la zone rédactionnelle :
 * le texte d'un document est enregistré tel quel, une balise de repère y serait
 * prise pour du contenu. Elle ne reçoit pas la souris non plus, pour ne pas
 * troubler le survol et le dépôt qu'elle accompagne.
 */
let pointDepot = null;

function elementPointDepot() {
  if (pointDepot) return pointDepot;
  pointDepot = document.createElement("span");
  pointDepot.className = "app-drop-caret";
  pointDepot.setAttribute("aria-hidden", "true");
  pointDepot.hidden = true;
  document.body.appendChild(pointDepot);
  // Un défilement pendant le geste déplacerait le texte sous une barre restée
  // fixe : on la cache plutôt que de la laisser mentir sur le point de dépôt.
  // Elle réapparaît au survol suivant. Enregistré une seule fois, avec la barre.
  window.addEventListener("scroll", cacherPointDepot, true);
  window.addEventListener("dragend", cacherPointDepot);
  return pointDepot;
}

/** Rectangle de la ligne visée par une plage repliée. */
function rectDuCurseur(range) {
  const rects = range.getClientRects();
  let rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
  if (rect && (rect.height || rect.width)) return rect;
  // Un curseur au bord d'un bloc — paragraphe vide, fin de cellule — n'a pas de
  // rectangle propre : on emprunte celui du bloc qui l'accueille.
  const node = range.startContainer;
  const el = node.nodeType === 1 ? node : node.parentElement;
  const r = el?.getBoundingClientRect?.();
  return r && r.height ? { left: r.left, top: r.top, height: Math.min(r.height, 32) } : null;
}

/** Montre le point de dépôt, ou le cache si le pointeur n'est sur aucun texte. */
function montrerPointDepot(range) {
  const barre = elementPointDepot();
  const rect = range ? rectDuCurseur(range) : null;
  if (!rect || (!rect.height && !rect.width)) { barre.hidden = true; return; }
  barre.hidden = false;
  barre.style.left = `${rect.left}px`;
  barre.style.top = `${rect.top}px`;
  barre.style.height = `${rect.height}px`;
}

function cacherPointDepot() {
  if (pointDepot) pointDepot.hidden = true;
}

/**
 * Réduit le fantôme du glisser à la balise elle-même. Sans image personnalisée,
 * le navigateur traîne celle de la barre de la palette — large et haute — qui
 * masque le point de dépôt pendant tout le geste. La marge gauche du fantôme
 * reste transparente : le curseur s'y tient, et la balise se dessine à sa
 * droite, dégagée.
 *
 * Exporté pour les autres répertoires de l'atelier — les considérants d'une
 * décision, dont la carte est plus haute encore que la barre d'une variable.
 */
export function reduireFantome(event, token) {
  const dt = event.dataTransfer;
  if (!dt || typeof dt.setDragImage !== "function") return;
  const fantome = document.createElement("span");
  fantome.className = "app-drag-ghost";
  const pastille = document.createElement("span");
  pastille.textContent = token;
  fantome.appendChild(pastille);
  document.body.appendChild(fantome);
  const rect = fantome.getBoundingClientRect();
  try {
    dt.setDragImage(fantome, 1, Math.round(rect.height / 2));
  } catch { /* certains navigateurs refusent une image personnalisée */ }
  // L'image est prise au lancement du geste : l'élément n'a plus d'utilité.
  setTimeout(() => fantome.remove(), 0);
}

/** Plage repliée à la fin du contenu de l'éditeur. */
function rangeAtEnd(editor) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}

/**
 * Insère un contenu HTML à la position donnée (ou au curseur). On s'appuie
 * d'abord sur la commande native du navigateur — elle crée les blocs
 * manquants — et on retombe sur une insertion directe dans la plage si elle
 * n'est pas disponible.
 */
export function insertHtml(editor, html, range) {
  const node = nodeFromHtml(html);
  if (!node) return null;
  // La plage est relevée AVANT le focus : si le curseur était ailleurs dans la
  // page (clic sur la palette), le focus ramènerait la sélection au début.
  const wanted = range || currentRange(editor);
  editor.focus();
  placeCaret(wanted || rangeAtEnd(editor));
  let ok = false;
  try { ok = document.execCommand("insertHTML", false, html); } catch { ok = false; }
  if (ok) return node;

  const sel = document.getSelection();
  const fallback = sel && sel.rangeCount && editor.contains(sel.getRangeAt(0).startContainer)
    ? sel.getRangeAt(0) : rangeAtEnd(editor);
  fallback.deleteContents();
  fallback.insertNode(node);
  fallback.setStartAfter(node);
  fallback.collapse(true);
  placeCaret(fallback);
  return node;
}

/* ------------------------------------------------------------------ */
/* Fragments insérables                                                */
/* ------------------------------------------------------------------ */

/** Balises qui forment un bloc dans le texte d'un document. */
const RE_BLOC = /^(P|LI|DIV|BLOCKQUOTE|H1|H2|H3|H4|H5|H6|TD|TH|FIGURE|SECTION)$/;

/** Le bloc — paragraphe, élément de liste — qui contient une plage. */
function blocDe(editor, range) {
  const depart = range?.startContainer;
  if (!depart) return null;
  let el = depart.nodeType === Node.ELEMENT_NODE ? depart : depart.parentElement;
  while (el && el !== editor && !RE_BLOC.test(el.tagName)) el = el.parentElement;
  return el && el !== editor ? el : null;
}

/**
 * Insère un fragment **en bloc** : le contenu prend place après le paragraphe où
 * se trouve le curseur — ou à sa place, s'il est vide —, au lieu d'être fondu
 * dedans.
 *
 * C'est ce qu'attendent les fragments de l'outil : un considérant, un visa, un
 * intertitre sont des paragraphes entiers. `insertHTML` du navigateur, lui, les
 * verse *dans* le paragraphe courant dès que le point d'insertion y tombe : deux
 * considérants insérés de suite se retrouvaient collés l'un au bout de l'autre,
 * dans un seul paragraphe. Les blocs sont donc posés par l'API des plages, qui
 * fait exactement ce qu'on lui demande.
 *
 * Le curseur est laissé après le dernier bloc inséré, pour qu'on puisse
 * continuer d'écrire là où l'on vient d'insérer.
 */
export function insertBlocks(editor, html, range) {
  if (!editor) return false;
  const gabarit = document.createElement("template");
  gabarit.innerHTML = String(html ?? "");
  const noeuds = [...gabarit.content.childNodes]
    .filter((n) => n.nodeType !== Node.TEXT_NODE || String(n.textContent || "").trim());
  if (!noeuds.length) return false;
  const ancre = blocDe(editor, range);
  if (ancre && !ancre.textContent.trim()) ancre.replaceWith(...noeuds);
  else if (ancre) ancre.after(...noeuds);
  else editor.append(...noeuds);
  const dernier = noeuds[noeuds.length - 1];
  editor.focus();
  const apres = document.createRange();
  apres.setStartAfter(dernier);
  apres.collapse(true);
  const sel = document.getSelection();
  if (sel) { sel.removeAllRanges(); sel.addRange(apres); }
  return true;
}

/**
 * Insertion en bloc au curseur — ou là où le curseur se trouvait avant que le
 * bouton cliqué ne prenne le focus —, et à la fin du texte à défaut.
 */
export function insertBlocksAtCursor(editor, html) {
  if (!editor) return false;
  return insertBlocks(editor, html, currentRange(editor) || plageMemorisee(editor) || rangeAtEnd(editor));
}

/**
 * Insère un fragment HTML au point du pointeur (coordonnées de l'événement de
 * dépôt) : c'est ce qui permet à un répertoire — considérants, formules — de
 * déposer son texte à l'endroit exact où le rédacteur a lâché la carte, et non
 * au curseur, qui peut être resté ailleurs. Renvoie `true` si le point tombait
 * dans l'éditeur et que le fragment y a été posé.
 */
export function insertHtmlAtPoint(editor, html, x, y) {
  if (!editor || !editor.isContentEditable) return false;
  const range = rangeFromPoint(editor, x, y);
  if (!range) return false;
  return insertBlocks(editor, html, range);
}

/* ------------------------------------------------------------------ */
/* Retraits                                                            */
/* ------------------------------------------------------------------ */

/**
 * Un retrait se compte en **centimètres**. C'est une mesure du papier, et non
 * celle d'un écran : le même retrait se retrouve dans la zone d'écriture, dans
 * l'aperçu A4, dans le PDF, dans le Word et dans l'OpenDocument (voir
 * `flowBlocks`, export-doc.js). Le pas est celui d'une tabulation de traitement
 * de texte ; il s'écrit ici une fois pour toutes, et la touche Tabulation, les
 * deux boutons de retrait et le repère de première ligne s'y accordent.
 */
const PAS_RETRAIT_CM = 1;

/** Le pas, écrit tel qu'il se pose dans le document. */
export const PAS_RETRAIT = `${PAS_RETRAIT_CM}cm`;

/** Au-delà, le retrait mangerait la largeur utile de la feuille. */
const RETRAIT_MAX_CM = 4;

/** Un centimètre à 96 dpi : la mesure du navigateur ramenée au papier. */
const CM_PAR_PX = 2.54 / 96;

/**
 * Blocs que le retrait déplace : des blocs de texte. Les conteneurs de mise en
 * page (`div` d'en-tête, cellules, sections) sont traversés, jamais déplacés —
 * décaler un conteneur décalerait tout ce qu'il porte, y compris ce que
 * l'auteur n'a pas sélectionné.
 */
const RE_BLOC_TEXTE = /^(P|H1|H2|H3|H4|H5|H6|DIV|LI|BLOCKQUOTE|ADDRESS)$/;

/** Valeur d'un style calculé, ramenée en centimètres. */
function enCm(valeur) {
  const px = parseFloat(valeur);
  return Number.isFinite(px) ? Math.round(px * CM_PAR_PX * 100) / 100 : 0;
}

/**
 * Retrait d'un bloc : `premiere` décale la **première ligne** — la marque d'un
 * considérant —, `gauche` déplace tout le texte. Le style calculé est lu, et
 * non le style écrit : un retrait hérité d'un bloc parent compte, et une valeur
 * posée par un collage — en pixels — se relit en centimètres.
 */
function retraitDe(bloc) {
  const cs = getComputedStyle(bloc);
  return { premiere: enCm(cs.textIndent), gauche: enCm(cs.marginLeft) };
}

/** Pose le retrait d'un bloc ; un retrait nul s'efface au lieu de s'écrire. */
function poserRetrait(bloc, { premiere, gauche }) {
  for (const [prop, valeur] of [["text-indent", premiere], ["margin-left", gauche]]) {
    if (valeur > 0) bloc.style.setProperty(prop, `${valeur}cm`);
    else bloc.style.removeProperty(prop);
  }
  if (!bloc.getAttribute("style")) bloc.removeAttribute("style");
}

/**
 * Les blocs de texte que touche une plage : celui où se trouve le curseur quand
 * elle est repliée, tous ceux qu'elle traverse sinon. Un bloc qui en contient
 * un autre n'est pas retenu — c'est le bloc intérieur, celui qui porte le
 * texte, que le retrait déplace.
 */
function blocsDeTexte(editor, range) {
  const bloc = blocDe(editor, range);
  const seul = bloc && RE_BLOC_TEXTE.test(bloc.tagName) ? bloc : null;
  if (!seul || range.collapsed) return seul ? [seul] : [];
  const out = [];
  for (const el of editor.querySelectorAll("p,h1,h2,h3,h4,h5,h6,div,li,blockquote,address")) {
    if (!RE_BLOC_TEXTE.test(el.tagName)) continue;
    if (el.querySelector("p,h1,h2,h3,h4,h5,h6,div,li,blockquote,address")) continue;
    let touche = false;
    try { touche = range.intersectsNode(el); } catch { touche = false; }
    if (touche) out.push(el);
  }
  return out.length ? out : [seul];
}

/** Vrai si la plage tombe dans un point de liste — le retrait y range le point. */
function dansUneListe(range) {
  const noeud = range?.startContainer;
  if (!noeud) return false;
  const el = noeud.nodeType === 1 ? noeud : noeud.parentElement;
  return Boolean(el && el.closest && el.closest("li"));
}

/**
 * Vrai si le curseur est **au début** de son bloc, sans rien avant lui que des
 * blancs. C'est là que la tabulation vaut un retrait de première ligne : le
 * geste du traitement de texte, et celui qu'attend le rédacteur d'un
 * considérant. Ailleurs, elle décale le bloc entier.
 */
function enTeteDeBloc(editor, range) {
  if (!range || !range.collapsed) return false;
  const bloc = blocDe(editor, range);
  if (!bloc || !RE_BLOC_TEXTE.test(bloc.tagName)) return false;
  const avant = document.createRange();
  avant.selectNodeContents(bloc);
  try { avant.setEnd(range.startContainer, range.startOffset); } catch { return false; }
  return !avant.toString().replace(/[\s\u00a0]/g, "");
}

/** Plage de travail : le curseur, celui d'avant le clic sur un bouton, ou la fin. */
function plageDeRetrait(editor) {
  return currentRange(editor) || plageMemorisee(editor) || rangeAtEnd(editor);
}

/**
 * Déplace le retrait des blocs touchés par la sélection, d'un pas dans le sens
 * demandé.
 *
 * Le retrait est une **valeur**, et la commande ne fait que la faire monter ou
 * descendre d'un cran : on revient donc toujours en arrière. La commande native
 * du navigateur, elle, empilait des citations imbriquées
 * (`<blockquote style="margin-left:40px">`), que ni l'aperçu, ni le PDF, ni le
 * Word ne savaient relire, et dont on ne sortait qu'en dépilant.
 */
export function appliquerRetrait(editor, cible, sens) {
  if (!editor) return false;
  const blocs = blocsDeTexte(editor, plageDeRetrait(editor));
  if (!blocs.length) return false;
  for (const bloc of blocs) {
    const actuel = retraitDe(bloc);
    const courant = cible === "premiere" ? actuel.premiere : actuel.gauche;
    // Un retrait venu d'un collage n'est pas au pas : on le ramène au pas
    // avant de le déplacer, plutôt que d'ajouter un centimètre à 1,06.
    const depart = sens > 0 ? Math.floor(courant) : Math.ceil(courant);
    const valeur = Math.max(0, Math.min(RETRAIT_MAX_CM, depart + sens));
    const suite = cible === "premiere" ? { ...actuel, premiere: valeur } : { ...actuel, gauche: valeur };
    poserRetrait(bloc, suite);
  }
  editor.focus();
  return true;
}

/**
 * Le bouton « Retrait de première ligne » : il le pose sur les blocs qui n'en
 * ont pas, et le retire quand ils en ont tous un. Le repère du bouton (voir
 * `refreshToolbar`) montre l'état du bloc où l'on écrit.
 */
export function basculerRetraitPremiere(editor) {
  if (!editor) return false;
  const blocs = blocsDeTexte(editor, plageDeRetrait(editor));
  if (!blocs.length) return false;
  const poser = blocs.some((bloc) => !retraitDe(bloc).premiere);
  for (const bloc of blocs) {
    const actuel = retraitDe(bloc);
    poserRetrait(bloc, { ...actuel, premiere: poser ? PAS_RETRAIT_CM : 0 });  }
  editor.focus();
  return true;
}

/**
 * Une commande de retrait de la barre d'outils.
 *
 * Dans une liste, le retrait a un autre sens : il range le point d'un niveau de
 * plus, ou l'en sort — et c'est le navigateur qui sait le faire, en déplaçant
 * vraiment le point dans l'arbre de la liste. Partout ailleurs, le retrait est
 * celui du paragraphe.
 */
export function commandeRetrait(editor, cmd) {
  if (!editor) return false;
  if (cmd === "retraitPremiere") return basculerRetraitPremiere(editor);
  const sens = cmd === "outdent" ? -1 : 1;
  if (dansUneListe(plageDeRetrait(editor))) {
    try { document.execCommand(sens > 0 ? "indent" : "outdent", false, null); } catch { return false; }
    return true;
  }
  return appliquerRetrait(editor, "gauche", sens);
}

/**
 * La touche Tabulation, dans la zone d'écriture.
 *
 * Au début d'un paragraphe : le retrait de première ligne, d'un pas. Ailleurs :
 * le retrait du paragraphe — et dans une liste, le niveau du point. Maj+Tab
 * défait pas à pas, et un retrait de première ligne nul laisse alors la main au
 * retrait du paragraphe, pour qu'on ne reste jamais sur une touche sans effet.
 *
 * Renvoie `true` quand la touche a servi : l'appelant empêche alors le
 * déplacement du focus, sans quoi l'on sortirait de la zone d'écriture à la
 * première tabulation. C'est Échap qui en fait sortir (voir `wireContainer`).
 */
export function retraitTabulation(editor, { shiftKey = false } = {}) {
  const sens = shiftKey ? -1 : 1;
  const range = plageDeRetrait(editor);
  if (dansUneListe(range)) {
    try { document.execCommand(sens > 0 ? "indent" : "outdent", false, null); } catch { return false; }
    return true;
  }
  const blocs = blocsDeTexte(editor, range);
  let cible = "gauche";
  // Maj+Tab sur un paragraphe sans retrait de première ligne décale le bloc :
  // une touche qui ne ferait rien laisserait croire la zone figée.
  if (enTeteDeBloc(editor, range) && !(sens < 0 && blocs.every((bloc) => !retraitDe(bloc).premiere))) cible = "premiere";
  return appliquerRetrait(editor, cible, sens);
}

/** Bloc de texte où se trouve la sélection courante, s'il y en a un. */
function blocCourant() {
  const el = selectionElement();
  const editor = el && el.closest ? el.closest("[data-wysiwyg-editor]") : null;
  if (!editor) return null;
  const bloc = blocDe(editor, currentRange(editor));
  return bloc && RE_BLOC_TEXTE.test(bloc.tagName) ? bloc : null;
}

/**
 * Fait sortir le focus de la zone d'écriture, vers le contrôle suivant (ou le
 * précédent sur Maj+Tab). Sans cela, la tabulation capturée pour le retrait
 * enfermerait celui qui écrit au clavier : il ne pourrait plus quitter la zone.
 */
function focusVoisin(el, sens = 1) {
  const selecteur = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),"
    + ' textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  const focusables = [...document.querySelectorAll(selecteur)].filter((c) => c.getClientRects().length);
  const index = focusables.indexOf(el);
  const cible = index < 0 ? null : focusables[index + sens];
  if (cible) cible.focus();
  else el.blur();
}

/**
 * Saut de page. Le repère n'existe qu'à l'écran de l'éditeur (style CSS) : le
 * document, lui, ne reçoit qu'un élément vide, que la feuille A4 ignore et que
 * les exports traduisent par une vraie coupure de page.
 */
export function pageBreakHtml() {
  return '<div class="app-page-break" contenteditable="false"></div>';
}

/** Tableau à bordures : ligne d'en-tête, puis `rows - 1` lignes de corps. */
export function tableHtml(rows = 3, cols = 3) {
  const cells = (tag, n) => Array.from({ length: n }, () => `<${tag}><br></${tag}>`).join("");
  const head = `<tr>${cells("th", cols)}</tr>`;
  const body = Array.from({ length: Math.max(1, rows - 1) }, () => `<tr>${cells("td", cols)}</tr>`).join("");
  return `<table class="app-table-bordered"><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`;
}

/**
 * Image insérée par son adresse. Seules les adresses affichables sont
 * acceptées : une valeur qui n'en est pas une est ignorée plutôt que de
 * laisser une image cassée dans le document.
 */
export function imageHtml(src, alt = "") {
  const url = String(src ?? "").trim();
  if (!/^(https?:|data:image\/|\.{0,2}\/)/.test(url)) return "";
  return `<img src="${esc(url)}" alt="${esc(alt)}" />`;
}

/* ------------------------------------------------------------------ */
/* Montage des zones d'édition                                         */
/* ------------------------------------------------------------------ */

/**
 * Active les zones d'édition présentes sous `root` : barre d'outils commune,
 * palette, glisser-déposer, collage et normalisation des balises saisies à la
 * main. Chaque zone signale ses modifications par `onDirty(zone)`, ce qui
 * permet à l'application de savoir quelle colonne enregistrer.
 */
export function mountWysiwyg(root, { onDirty } = {}) {
  for (const container of root.querySelectorAll("[data-wysiwyg]")) wireContainer(container, onDirty);
}

function wireContainer(container, onDirty) {
  const editors = [...container.querySelectorAll("[data-wysiwyg-editor]")];
  if (!editors.length) return;
  const palette = container.querySelector("[data-wysiwyg-palette]");
  const toolbar = container.querySelector("[data-wysiwyg-toolbar]");
  const search = palette?.querySelector("[data-wysiwyg-query]");
  const tokens = container.querySelector("[data-wysiwyg-tokens]");

  // Famille de balises d'une zone : `{{Colonne}}` dans le corps d'une trame,
  // `{variable}` dans les blocs d'un type de trame, les deux à la fois — plus
  // l'emplacement `{{Corps}}` — dans une feuille de style. Une zone peut
  // déclarer la sienne (`data-chips`) et l'emporte alors sur celle du
  // conteneur : sur la page d'une trame, la feuille de style et le corps
  // cohabitent sous la même palette sans se confondre.
  const mode = (editor) => editor?.dataset.chips || container.dataset.chips || "columns";
  const index = catalogs.get(palette?.id) || {};
  const pattern = (editor) => (mode(editor) === "variables" ? variableRegex() : mode(editor) === "feuille" ? styleRegex() : tokenRegex());
  // Balises qu'une zone accepte. Les deux écritures cohabitent dans une feuille
  // de style — ses variables `{variable}` et les balises de données
  // `{{Colonne}}`, comme `styleRegex` les reconnaît (voir render.js) ; le corps
  // du texte n'accueille, lui, que les `{{Colonne}}`, et un type de trame ses
  // variables. Le dépôt d'une balise y est jugé sur la même règle que sa
  // normalisation : une balise **entière**, modificateurs compris
  // (`{{Affaire}}.Numero`, `{{Date}}.date(@long)`, `{{…}}.inline`), car c'est
  // elle que la palette propose et que le rendu remplace.
  const TOKEN_QUELCONQUE = /^(?:\{\{[A-Za-z0-9_]+\}\}(?:\.[\s\S]+)?|\{[A-Za-z0-9_]+\})$/;
  /** Famille d'une balise : `{{…}}` est une donnée, `{…}` une variable. */
  const familleDe = (token) => (/^\{\{/.test(token) ? "columns" : /^\{/.test(token) ? "variables" : "");
  const accepte = (editor, token) => {
    if (!token || !TOKEN_QUELCONQUE.test(token)) return false;
    const famille = familleDe(token);
    const zone = mode(editor);
    if (zone === "columns") return famille === "columns";
    if (zone === "variables") return famille === "variables";
    return true; // une feuille de style accueille les deux familles
  };
  const chipFor = (token) => {
    const info = index[token];
    return chipHtml(token, info?.label || labelOfToken(token), info?.sample || "");
  };
  const normalize = (editor) => normalizeChips(editor, { pattern: pattern(editor), chipFor });

  /**
   * Pourquoi une balise reste sans effet dans la zone visée.
   *
   * L'écran montre plusieurs zones — la feuille de style et le corps d'une
   * trame, le chapeau, le texte et la signature d'un document —, et la palette
   * réunit leurs deux familles de balises. Une balise déposée ou cliquée dans
   * une zone qui ne la reconnaît pas y resterait écrite en clair dans le
   * document : mieux vaut le dire que de laisser un geste sans réponse.
   */
  const refusDeZone = (editor, token) => {
    if (!accepte(editor, token)) {
      if (!token || !TOKEN_QUELCONQUE.test(token)) return "";
      return mode(editor) === "columns"
        ? `« ${token} » est une variable de la feuille de style : elle s'insère dans la feuille de style — le chapeau ou la signature d'un document —, pas dans le corps du texte.`
        : `« ${token} » est une balise de données : elle s'insère dans le corps du texte.`;
    }
    return "";
  };

  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* non supporté */ }
  // Sans cela, le navigateur exprime la mise en forme par des styles en ligne
  // (un span coloré autour de chaque mot) : le document en serait encombré, et
  // la feuille A4 devrait lutter contre ces styles. On lui demande donc les
  // balises simples — gras, italique, listes.
  try { document.execCommand("styleWithCSS", false, false); } catch { /* non supporté */ }

  // Zone active : c'est elle que la palette alimente et que l'on enregistre.
  let active = editors[0];
  const notify = () => { if (onDirty) onDirty(active); };

  // Dernière position connue du curseur dans le texte : cliquer dans la
  // palette fait perdre la sélection, on la retrouve donc ici.
  let savedRange = null;
  const rememberRange = () => {
    const range = currentRange(active);
    if (range) savedRange = range.cloneRange();
  };
  const insertRange = () => currentRange(active) || savedRange || null;

  /* --- barre d'outils -------------------------------------------- */

  // Le clic sur un bouton ne doit pas voler la sélection au texte. Les menus
  // typographiques, eux, ont besoin de leur clic : c'est la dernière position
  // mémorisée qui sert alors (comme pour la palette).
  toolbar?.addEventListener("mousedown", (event) => {
    if (event.target.closest("select")) return;
    event.preventDefault();
  });

  /* --- police, taille, couleur, surlignage ------------------------ */

  // Ces menus appliquent leur valeur à la sélection. En écriture HTML, il n'y a
  // pas de sélection à mettre en forme : le HTML s'écrit à la main, et le menu
  // revient à sa position.
  for (const select of toolbar?.querySelectorAll("[data-wysiwyg-style]") || []) {
    select.addEventListener("change", () => {
      if (sourceMode) { select.value = ""; return; }
      const target = editors.includes(active) ? active : editors[0];
      const prop = select.dataset.wysiwygStyle;
      // Le menu ouvert a pris le focus : `insertRange` rend la dernière
      // sélection connue de la zone active.
      const styled = applyTextStyle(target, insertRange(), prop, select.value);
      if (!styled) {
        toast("Sélectionnez d'abord le passage à mettre en forme.", "info");
        refreshTypographie(select.closest("[data-wysiwyg-toolbar]"));
        return;
      }
      savedRange = styled.cloneRange();
      active = target;
      tracked = target;
      target.focus();
      placeCaret(styled);
      refreshTypographie(select.closest("[data-wysiwyg-toolbar]"));
      notify();
    });
  }

  /* --- affichage des valeurs ou des balises ---------------------- */

  tokens?.addEventListener("change", () => {
    container.classList.toggle("app-wysiwyg--tokens", tokens.checked);
  });

  /* --- édition du code HTML --------------------------------------- */

  // Chaque zone d'édition reçoit, à la demande, un champ de texte qui montre
  // son HTML véritable. La bascule vaut pour toute la zone : on ne peut pas
  // mêler les deux écritures dans un même écran sans se tromper de contenu.
  const sourceBtn = container.querySelector("[data-wysiwyg-source]");
  const sourceBoxes = new Map();
  const sourceTimers = new Map();
  let sourceMode = false;

  const sourceBox = (editor) => {
    let box = sourceBoxes.get(editor);
    if (!box) {
      box = document.createElement("textarea");
      box.className = "fr-input app-wysiwyg__source";
      box.spellcheck = false;
      box.hidden = true;
      box.setAttribute("aria-label", `${editor.getAttribute("aria-label") || "Texte"} — code HTML`);
      editor.after(box);
      box.addEventListener("focus", () => { active = editor; });
      box.addEventListener("input", () => {
        clearTimeout(sourceTimers.get(box));
        sourceTimers.set(box, setTimeout(() => {
          editor.innerHTML = htmlToEditor(box.value, chipFor, pattern(editor));
          if (onDirty) onDirty(editor);
        }, 400));
      });
      sourceBoxes.set(editor, box);
    }
    return box;
  };

  const setSourceMode = (on) => {
    sourceMode = on;
    container.classList.toggle("app-wysiwyg--source", on);
    sourceBtn?.setAttribute("aria-pressed", on ? "true" : "false");
    for (const editor of editors) {
      const box = sourceBox(editor);
      if (on) {
        box.value = editorToHtml(editor);
        box.hidden = false;
        editor.hidden = true;
        continue;
      }
      clearTimeout(sourceTimers.get(box));
      const before = editor.innerHTML;
      editor.innerHTML = htmlToEditor(box.value, chipFor, pattern(editor));
      editor.hidden = false;
      box.hidden = true;
      if (before !== editor.innerHTML && onDirty) onDirty(editor);
    }
  };

  sourceBtn?.addEventListener("click", () => setSourceMode(!sourceMode));

  // Vue demandée à l'ouverture : l'espace de rédaction d'un document est un
  // seul espace, dont l'écriture HTML est une vue à part entière — c'est la
  // page qui la choisit, en la déclarant sur le conteneur.
  if (container.dataset.wysiwygView === "balisage") setSourceMode(true);

  /* --- palette ---------------------------------------------------- */

  const dragPayload = (event, token) => {
    event.dataTransfer.setData("text/plain", token);
    event.dataTransfer.setData("application/x-doc-token", token);
    event.dataTransfer.effectAllowed = "copy";
  };

  if (palette) {
    // Relevé AVANT que le clic ne fasse perdre la sélection du texte.
    palette.addEventListener("mousedown", rememberRange);

    palette.addEventListener("dragstart", (event) => {
      const varEl = event.target.closest(".app-var");
      if (!varEl) return;
      dragPayload(event, varEl.dataset.token);
      varEl.classList.add("app-var--dragging");
      reduireFantome(event, varEl.dataset.token || varEl.textContent.trim());
    });
    palette.addEventListener("dragend", (event) => {
      event.target.closest(".app-var")?.classList.remove("app-var--dragging");
    });

    // Le clic insère au curseur : c'est l'équivalent tactile du glisser-déposer.
    const insertFrom = (varEl) => {
      const token = varEl.dataset.token;
      // La zone qui reçoit : celle où le curseur se trouve — le champ de texte
      // de la vue « Balisage », ou la zone rédactionnelle active.
      const cible = sourceMode ? (editors.includes(active) ? active : editors[0]) : active;
      if (!cible) return;
      const refus = refusDeZone(cible, token);
      if (refus) { toast(refus, "info"); return; }
      // En écriture HTML, la balise s'insère au curseur du champ de texte :
      // le clic sur la palette reste ainsi utile dans les deux écritures.
      if (sourceMode) {
        const box = sourceBox(cible);
        const start = box.selectionStart ?? box.value.length;
        const end = box.selectionEnd ?? start;
        box.value = box.value.slice(0, start) + token + box.value.slice(end);
        box.focus();
        box.setSelectionRange(start + token.length, start + token.length);
        cible.innerHTML = htmlToEditor(box.value, chipFor, pattern(cible));
        active = cible;
        notify();
        return;
      }
      if (!cible.isContentEditable) return;
      insertHtml(cible, chipFor(token), insertRange());
      normalize(cible);
      notify();
    };
    palette.addEventListener("click", (event) => {
      const varEl = event.target.closest(".app-var");
      if (varEl) insertFrom(varEl);
    });
    palette.addEventListener("keydown", (event) => {
      const varEl = event.target.closest(".app-var");
      if (!varEl) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        insertFrom(varEl);
      }
    });

    search?.addEventListener("input", () => filterPalette(palette, search.value));
    search?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const first = palette.querySelector(".app-var:not(.app-hidden)");
      if (!first || !active) return;
      insertFrom(first);
    });
  }

  /* --- glisser-déposer, saisie et collage, zone par zone --------- */

  let dropFrame = 0;
  let movingChip = null;
  const endDrag = (editor) => {
    editor.classList.remove("app-wysiwyg__edit--drop");
    cancelAnimationFrame(dropFrame);
    cacherPointDepot();
  };
  const stopMoving = () => {
    movingChip?.classList.remove("app-token--dragging");
    movingChip = null;
  };

  for (const editor of editors) {
    const focusHere = () => { active = editor; tracked = editor; };

    editor.addEventListener("focusin", focusHere);

    editor.addEventListener("dragover", (event) => {
      if (!event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = movingChip ? "move" : "copy";
      editor.classList.add("app-wysiwyg__edit--drop");
      const { clientX, clientY } = event;
      cancelAnimationFrame(dropFrame);
      dropFrame = requestAnimationFrame(() => {
        const range = rangeFromPoint(editor, clientX, clientY);
        if (range) placeCaret(range);
        montrerPointDepot(range);
      });
    });

    editor.addEventListener("dragleave", (event) => {
      if (!editor.contains(event.relatedTarget)) endDrag(editor);
    });

    // Une pastille se déplace dans le texte : on la retire pour la réinsérer au
    // point de dépôt (le glisser natif d'un élément non éditable à l'intérieur
    // d'un `contenteditable` n'est pas fiable d'un navigateur à l'autre).
    editor.addEventListener("dragstart", (event) => {
      const chip = event.target.closest?.(CHIP_SELECTOR);
      if (!chip || !editor.contains(chip) || !event.dataTransfer) return;
      movingChip = chip;
      event.dataTransfer.setData("application/x-doc-chip", chip.dataset.token);
      event.dataTransfer.setData("text/plain", chip.dataset.token);
      event.dataTransfer.effectAllowed = "move";
      chip.classList.add("app-token--dragging");
    });
    editor.addEventListener("dragend", stopMoving);

    editor.addEventListener("drop", (event) => {
      const chipToken = event.dataTransfer?.getData("application/x-doc-chip");
      const token = event.dataTransfer?.getData("application/x-doc-token")
        || event.dataTransfer?.getData("text/plain")?.trim();
      const moving = movingChip;
      endDrag(editor);
      stopMoving();
      if (!editor.isContentEditable) return;
      focusHere();
      if (!chipToken || !moving) {
        if (!token || !accepte(editor, token)) {
          // Un dépôt sans effet serait inexplicable : si la balise relève de
          // l'autre famille de l'écran, on dit dans quelle zone elle s'insère.
          const refus = refusDeZone(editor, token);
          if (refus) toast(refus, "info");
          return;
        }
        event.preventDefault();
        insertHtml(editor, chipFor(token), rangeFromPoint(editor, event.clientX, event.clientY));
        normalize(editor);
        notify();
        return;
      }
      // Déplacement d'une pastille existante.
      event.preventDefault();
      // Une pastille déplacée d'une zone à l'autre obéit à la même règle qu'un
      // dépôt : elle ne peut pas entrer dans une zone qui ne la reconnaît pas.
      if (!accepte(editor, chipToken)) {
        const refus = refusDeZone(editor, chipToken);
        if (refus) toast(refus, "info");
        return;
      }
      const range = rangeFromPoint(editor, event.clientX, event.clientY);
      if (!range || moving.contains(range.startContainer)) return;
      insertHtml(editor, chipFor(chipToken), range);
      moving.remove();
      normalize(editor);
      notify();
    });

    /* --- clavier -------------------------------------------------- */

    // La tabulation écrit un retrait au lieu de déplacer le focus — c'est le
    // geste du traitement de texte, et ce que demande un considérant. Échap
    // fait alors sortir de la zone (voir `focusVoisin`) : la capture du clavier
    // ne doit pas y enfermer celui qui écrit sans souris.
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (document.querySelector(".app-dialog-backdrop")) return;
        event.preventDefault();
        focusVoisin(editor);
        return;
      }
      if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!editor.isContentEditable) return;
      if (!retraitTabulation(editor, { shiftKey: event.shiftKey })) return;
      event.preventDefault();
      focusHere();
      rememberRange();
      notify();
    });

    /* --- saisie et collage --------------------------------------- */

    editor.addEventListener("input", () => { focusHere(); notify(); });

    editor.addEventListener("paste", (event) => {
      const html = event.clipboardData?.getData("text/html");
      const text = event.clipboardData?.getData("text/plain") || "";
      event.preventDefault();
      if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
      else document.execCommand("insertText", false, text);
      normalize(editor);
      notify();
    });

    // Les balises tapées à la main (ou collées en texte) deviennent des
    // pastilles en quittant le champ : l'édition reste ainsi homogène.
    editor.addEventListener("blur", () => {
      if (normalize(editor)) notify();
    });

    // Une zone vide doit rester cliquable ; au passage on mémorise le curseur.
    editor.addEventListener("keyup", () => {
      focusHere();
      if (!editor.textContent.trim() && !editor.querySelector(CHIP_SELECTOR)) {
        editor.innerHTML = "<p><br></p>";
        notify();
      }
      rememberRange();
    });
    editor.addEventListener("mouseup", () => { focusHere(); rememberRange(); });
  }

  return { container, editors, current: () => active, normalize };
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

/**
 * Transforme en pastilles les balises écrites à la main. Renvoie `true` si le
 * contenu a changé. `pattern` et `chipFor` viennent de la zone éditée.
 */
export function normalizeChips(editor, {
  pattern = tokenRegex(),
  chipFor = (token) => chipHtml(token, labelOfToken(token), ""),
} = {}) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(CHIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let changed = false;
  for (const node of nodes) {
    const text = node.nodeValue || "";
    const re = new RegExp(pattern.source, "g");
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match;
    while ((match = re.exec(text))) {
      if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      const chip = nodeFromHtml(chipFor(match[0]));
      if (chip) frag.appendChild(chip);
      else frag.appendChild(document.createTextNode(match[0]));
      last = match.index + match[0].length;
      changed = true;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  return changed;
}

/** Filtre la palette selon la recherche saisie. */
export function filterPalette(palette, query) {
  if (!palette) return;
  const needle = String(query || "").trim().toLowerCase();
  let visible = 0;
  for (const group of palette.querySelectorAll(".app-palette__group")) {
    let shown = 0;
    for (const item of group.querySelectorAll(".app-var")) {
      const match = !needle || (item.dataset.search || "").includes(needle);
      item.classList.toggle("app-hidden", !match);
      if (match) shown += 1;
    }
    group.classList.toggle("app-hidden", shown === 0);
    visible += shown;
  }
  palette.querySelector("[data-palette-empty]")?.classList.toggle("app-hidden", visible > 0);
}

/**
 * Nettoyage minimal d'un HTML collé : on conserve la structure de texte utile
 * (titres, listes, tableaux, images, sauts de page), les mises en forme
 * simples, et l'on déplie tout le reste.
 */
const KEEP = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUP", "SUB", "MARK",
  "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE",
  "A", "SPAN", "DIV", "HR", "IMG", "FIGURE", "FIGCAPTION", "ADDRESS", "DL", "DT", "DD",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "CAPTION", "COLGROUP", "COL",
]);
const KEEP_STYLE = /^(text-align|text-indent|font-weight|font-style|text-decoration|color|font-size|font-family|background-color|margin-left)$/;
/** Attributs conservés, élément par élément. Rien d'autre ne passe. */
const KEEP_ATTRS = {
  A: ["href", "title"],
  IMG: ["src", "alt", "title", "width", "height"],
  TD: ["colspan", "rowspan", "scope"],
  TH: ["colspan", "rowspan", "scope"],
  COL: ["span"],
};
/** Classe ajoutée aux tableaux collés : la seule que conserve le nettoyage. */
const KEEP_CLASS = "app-table-bordered";
const SAFE_URL = /^(https?:|data:image\/|mailto:|tel:|#|\.{0,2}\/)/i;

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  doc.body.querySelectorAll("script, style, meta, link, iframe, object, embed, form, input, button, video, audio, svg, canvas, template, base").forEach((n) => n.remove());

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
      walk(child);
      if (!KEEP.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const kept = {};
      for (const name of KEEP_ATTRS[child.tagName] || []) {
        const value = child.getAttribute(name);
        if (value === null) continue;
        if ((name === "href" || name === "src") && !SAFE_URL.test(value.trim())) continue;
        if ((name === "width" || name === "height") && !/^\d{1,4}$/.test(value.trim())) continue;
        kept[name] = value;
      }
      const styles = [];
      const inline = child.getAttribute("style") || "";
      for (const decl of inline.split(";")) {
        const [prop, val] = decl.split(":");
        if (prop && val && KEEP_STYLE.test(prop.trim().toLowerCase())) styles.push(`${prop.trim()}:${val.trim()}`);
      }
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      for (const [name, value] of Object.entries(kept)) child.setAttribute(name, value);
      if (styles.length) child.setAttribute("style", styles.join(";"));
    }
  };
  walk(doc.body);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = doc.body.innerHTML;
  for (const el of wrapper.querySelectorAll("div")) {
    // Le repère de saut de page est un `div` : on le laisse tel quel.
    if (el.classList.contains("app-page-break")) continue;
    const p = document.createElement("p");
    p.innerHTML = el.innerHTML;
    el.replaceWith(p);
  }
  for (const table of wrapper.querySelectorAll("table")) table.classList.add(KEEP_CLASS);
  return wrapper.innerHTML;
}
