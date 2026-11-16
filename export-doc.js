// Export des documents produits : PDF, Word (.docx) et OpenDocument (.odt).
//
// Les trois exports partent du même HTML que l'aperçu (`computeDocumentParts`),
// et donc de la même feuille A4 : un document exporté ressemble à ce que montre
// l'écran, et s'imprime sur le même papier.
//
// Avant d'écrire quoi que ce soit, le HTML est rendu une fois dans un cadre
// hors écran (`prepareDocument`), où le navigateur lui applique sa mise en
// page : c'est de ce document-là — corps de police calculés, largeurs mesurées,
// images chargées — que les trois formats sont tirés. Le modèle commun est une
// suite de blocs (paragraphes et leurs segments de texte, listes, tableaux,
// images, filets, sauts de page), décrite par `flowBlocks`.
//
//   - PDF : les blocs sont composés en **texte** par la bibliothèque `pdfmake`
//     — le texte du fichier se sélectionne, se cherche et se copie, et les
//     polices y sont embarquées. Le fichier est ensuite converti au format
//     d'archivage **PDF/A-2b** (`pdf-a.js`). `pdfmake` et `pdf-lib` sont
//     chargés à la première demande depuis esm.sh.
//   - DOCX / ODT : les mêmes blocs deviennent des paragraphes, listes, tableaux
//     et images, avec une mise en page A4 (marges de 2 cm) et le pied de page
//     répété. Le DOCX est assemblé par la bibliothèque `docx` ; l'ODT est écrit
//     directement (un fichier OpenDocument est une archive de XML).
//
// Les trois fonctions publiques reçoivent le HTML complet d'un document — celui
// de l'aperçu, mais aussi celui des impressions de `print.js` — et renvoient
// `{ blob, name, bytes }`, le téléchargement étant déclenché par `exportDocument`.

import { downloadBlob, zipStore } from "./export.js";
import { chargerFamille, configurationPolices, estEmbarquee, familleEmbarquee } from "./pdf-fonts.js";
import { versPdfA } from "./pdf-a.js";
import { DEPENDANCES, chargerModule } from "./dependances.js";

/* ------------------------------------------------------------------ */
/* Constantes et unités                                                */
/* ------------------------------------------------------------------ */

/** 1 mm à 96 dpi. La feuille A4 mesure 210 × 297 mm, marges de 2 cm. */
const MM_PER_PX = 25.4 / 96;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
/**
 * Marge de la feuille : 2 cm, la marge d'un courrier administratif — du papier
 * à en-tête au traitement de texte. C'est **la** valeur de référence de la
 * chaîne d'impression : la feuille de l'aperçu, la fenêtre d'impression, la
 * mise en page Word et celle de l'OpenDocument en découlent, et le PDF y place
 * le contenu et le pied de page. La modifier ici suffit à tout déplacer.
 */
const MARGIN_MM = 20;
/** Largeur utile de la feuille : 210 mm moins les deux marges. */
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM;
/**
 * Un millimètre en points : 72 points par pouce, l'unité de la composition
 * PDF. La bibliothèque de mise en page reçoit toutes les dimensions en points,
 * comme les corps de police que le modèle porte déjà (`pxToPt`).
 */
const MM_PT = 72 / 25.4;
const MARGIN_PT = MARGIN_MM * MM_PT;
const CONTENT_W_PT = CONTENT_W_MM * MM_PT;
/**
 * Blanc laissé entre la dernière ligne et le filet du pied de page (mm). Le
 * pied de page se répète au bas de chaque page, dans la marge basse : sa
 * hauteur — mesurée sur la feuille — vient s'ajouter à cette marge, sans quoi
 * le texte viendrait s'écrire par-dessus.
 */
const FOOTER_GAP_MM = 2;
/** A4 en vingtièmes de point (twips) : 1 mm = 56,6929 twips. */
const TWIPS_PER_MM = 56.6929;
const PAGE_W_TW = Math.round(PAGE_W_MM * TWIPS_PER_MM);
const PAGE_H_TW = Math.round(PAGE_H_MM * TWIPS_PER_MM);
const MARGIN_TW = Math.round(MARGIN_MM * TWIPS_PER_MM);
const CONTENT_W_TW = Math.round(CONTENT_W_MM * TWIPS_PER_MM);
/**
 * Police des fichiers Word et OpenDocument : celle de la charte graphique, ou
 * la police réglée pour tous les documents (Réglages › Charte graphique)
 * lorsqu'il y en a une — voir `policeDocumentNom`, dans `charte.js`, qui la
 * décide. Arial pour la charte de l'État, Public Sans pour la charte neutre.
 *
 * Word et OpenDocument ne savent que **nommer** une police — et ni OOXML ni ODF
 * ne savent exprimer une **liste** de polices de repli. D'où la charte de
 * l'État qui demande Arial, présente partout, plutôt que Marianne : demander
 * « Marianne » à un fichier Word ferait substituer la police par le traitement
 * de texte sur tout poste où elle n'est pas installée, sans que l'auteur du
 * courrier puisse le voir. Le PDF, lui, embarque la police du document avec le
 * texte (voir `pdf-fonts.js`) : ce nom-là ne le concerne pas.
 *
 * `FONT_DEFAUT` n'est qu'un dernier recours, pour un appel qui n'aurait pas
 * reçu de nom de police.
 *
 * Le nom est posé par `exportDocument` à chaque export (`meta.font`, calculé
 * par `charte.js`) : ces deux fonctions-là ne sont jamais appelées autrement, et
 * l'écriture d'un document est une opération isolée — un état de module suffit,
 * là où faire descendre le nom jusqu'aux segments de texte traverserait toute
 * la récursion des blocs.
 */
const FONT_DEFAUT = "Arial";
let FONT = FONT_DEFAUT;

/**
 * Mise en page imposée dans le cadre d'export : on neutralise la mise à
 * l'échelle de l'aperçu et son fond gris, sans toucher à la feuille A4
 * elle-même (largeur, marges et fond blanc restent ceux de l'impression).
 *
 * Le pied de page, lui, reçoit ici son habillage **d'impression** — filet,
 * rembourrage, taille et encre de ses mentions. Dans la feuille, cet habillage
 * vit dans un bloc `@media print` que le cadre ne connaît pas, et le pied de
 * page y resterait sinon sans hauteur et sans style : les exports le
 * recopieraient au bas de chaque page à la taille du texte courant.
 */
const FRAME_CSS = `
  @media screen {
    html, body { background: #fff !important; }
    body { margin: 0 !important; padding: 0 !important; width: 210mm !important; }
    #docFit { width: auto !important; height: auto !important; overflow: visible !important; }
    #docSheet { transform: none !important; margin-left: 0 !important; box-shadow: none !important; }
    .page { min-height: 0 !important; }
    .page__content { min-height: 0 !important; padding-bottom: 0 !important; }
    #exportContent { width: 170mm; }
    .print-footer {
      display: block; position: absolute; left: 0; right: 0; bottom: 0; height: auto;
      text-align: left; font-size: 0.75rem; color: #666;
      border-top: 1px solid #ddd; padding-top: 10px; background-color: white;
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Bibliothèques chargées à la demande                                 */
/* ------------------------------------------------------------------ */

const lazy = (url, usage) => {
  let promise = null;
  return () => {
    if (!promise) promise = chargerModule(url, usage);
    return promise;
  };
};

const loadPdfMake = lazy(DEPENDANCES.pdfmake, "la fabrication des PDF");
const loadDocxLib = lazy(DEPENDANCES.docx, "la fabrication des fichiers Word");

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const round1 = (n) => Math.round(n * 10) / 10;
const pxToCm = (px) => px * MM_PER_PX / 10;
const pxToPt = (px) => round1(px * 0.75);

/**
 * Un retrait, du style calculé du navigateur jusqu'à l'unité de chaque format.
 *
 * Un retrait vient toujours du **navigateur** : le style calculé d'un bloc, en
 * pixels. Il se relit en centimètres — la mesure du papier, la seule que le
 * PDF, Word et l'OpenDocument partagent, et celle dans laquelle il a été posé
 * (voir `appliquerRetrait`, editor.js). Le centième suffit : un pas de retrait
 * fait un centimètre.
 */
const cmDe = (px) => {
  const valeur = parseFloat(px);
  return Number.isFinite(valeur) ? Math.round(pxToCm(valeur) * 100) / 100 : 0;
};
const cmPt = (cm) => round1(cm * 10 * MM_PT);
const cmTw = (cm) => Math.round(cm * 10 * TWIPS_PER_MM);

function escXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Les caractères de contrôle ne sont pas admis en XML 1.0.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** Nom de fichier : accents et ponctuation réduits à des tirets. */
export function fileSlug(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "document";
}

/** `rgb(51, 51, 51)` → `#333333` ; `null` si la couleur est le noir implicite. */
function normalizeColor(value) {
  const m = /^rgba?\(([^)]+)\)$/.exec(String(value || ""));
  if (!m) return null;
  const parts = m[1].split(",").map((v) => v.trim());
  if (parts.length > 3 && Number(parts[3]) === 0) return null;
  const hex = parts.slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("");
  return hex === "000000" ? null : `#${hex.toUpperCase()}`;
}

function dataUrlBytes(url) {
  const binary = atob(url.slice(url.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const encoder = new TextEncoder();
const xmlBytes = (text) => encoder.encode(text);

/* ------------------------------------------------------------------ */
/* Cadre de rendu hors écran                                           */
/* ------------------------------------------------------------------ */

/**
 * Rend un HTML complet dans un cadre invisible mais bien mis en page : il faut
 * que le navigateur applique les styles pour que les corps de police, les
 * alignements et les dimensions des logos soient mesurables.
 */
async function openFrame(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-12000px;top:0;width:900px;height:1200px;border:0;background:#fff;";
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  const doc = frame.contentDocument;
  const style = doc.createElement("style");
  style.textContent = FRAME_CSS;
  doc.head.appendChild(style);
  await whenReady(doc);
  return frame;
}


/** Attend les images et les polices, sans rester bloqué sur une image morte. */
async function whenReady(doc) {
  await Promise.all([...doc.images].map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, 4000);
    });
  }));
  try {
    if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
  } catch { /* polices non suivies : on continue */ }
  await new Promise((resolve) => setTimeout(resolve, 40));
}

/**
 * Zone de contenu à convertir : la zone utile de la feuille A4 (dans les
 * marges), ou le corps entier pour les états imprimés de `print.js` (rôle de
 * séance, liste d'affaires), qui n'ont pas de feuille.
 */
function contentRoot(doc) {
  const sheet = doc.querySelector(".page__content");
  if (sheet) return sheet;
  const box = doc.createElement("div");
  box.id = "exportContent";
  while (doc.body.firstChild) box.appendChild(doc.body.firstChild);
  doc.body.appendChild(box);
  return box;
}

/**
 * Retire du flux tous les pieds de page — celui de la feuille de style du
 * format, à sa place en fin de document, et ceux qu'un texte aurait pu porter —
 * et renvoie le premier, qui sert de modèle à répéter.
 *
 * Les sauts de ligne qui plaquaient le pied de page au bas de la feuille n'ont
 * plus d'objet une fois celui-ci retiré : les laisser en place ajoutait deux
 * lignes blanches en fin de document, et faisait déborder d'une page les
 * courriers qui tenaient sur une seule.
 */
function detachFooters(doc) {
  const found = [...doc.querySelectorAll(".print-footer")];
  for (const node of found) {
    removeBlanksBefore(node);
    const parent = node.parentElement;
    node.remove();
    if (parent && parent !== doc.body && !hasVisibleContent(parent)) {
      removeBlanksAfter(parent);
      parent.remove();
    }
  }
  return found[0] || null;
}

/** Un nœud qui ne produit rien : un saut de ligne ou des blancs. */
function isBlankNode(node) {
  if (node.nodeType === 3) return node.nodeValue.trim() === "";
  return node.nodeType === 1 && node.tagName === "BR";
}

function removeBlanksBefore(node) {
  let previous = node.previousSibling;
  while (previous && isBlankNode(previous)) {
    const before = previous.previousSibling;
    previous.remove();
    previous = before;
  }
}

function removeBlanksAfter(node) {
  let next = node.nextSibling;
  while (next && isBlankNode(next)) {
    const after = next.nextSibling;
    next.remove();
    next = after;
  }
}

/**
 * Détache le pied de page et le décrit comme des blocs de document, avec la
 * hauteur qu'il occupait sur la feuille : le PDF la réserve dans sa marge basse
 * pour y répéter le même pied de page, page après page.
 */
function takeFooter(doc, width) {
  // La hauteur se mesure **avant** de détacher le pied de page : hors du
  // document, il n'a plus de mise en page, donc plus de hauteur.
  const modele = doc.querySelector(".print-footer");
  const footerHeight = modele ? modele.getBoundingClientRect().height : 0;
  const footer = detachFooters(doc);
  if (!footer) return { footer: null, footerBlocks: [], footerHeight: 0 };
  const holder = doc.createElement("div");
  holder.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;background:#fff;`;
  const clone = footer.cloneNode(true);
  clone.style.position = "static";
  clone.style.display = "block";
  holder.appendChild(clone);
  doc.body.appendChild(holder);
  const footerBlocks = flowBlocks(holder, styleOf(doc.body), "");
  holder.remove();
  return { footer, footerBlocks, footerHeight };
}

/* ------------------------------------------------------------------ */
/* Modèle de document                                                  */
/* ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "CAPTION", "DD", "DIV", "DL", "DT", "FIGURE",
  "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "LI", "MAIN", "NAV", "P", "PRE",
  "SECTION", "TD", "TH", "TR", "UL", "OL",
]);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "HEAD", "BASE"]);
const HEADINGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

const view = (el) => el.ownerDocument.defaultView;

/**
 * Valeur d'une propriété **écrite par l'auteur du texte** : remonte la chaîne
 * des éléments et rend la première valeur posée en style en ligne, ou `""`.
 *
 * La mise en forme d'un passage — la police choisie pour une citation, un
 * surlignage — vient d'un style en ligne ; celle de la charte vient d'une
 * feuille de style. Seul le style en ligne est repris ici : sans cela, le fond
 * blanc que `DOCUMENT_CSS` pose sur chaque bloc se retrouverait derrière chaque
 * mot du fichier Word, et chaque segment réclamerait la police de la charte —
 * que Word n'a pas, et remplacerait sans le dire (voir `FONT_DEFAUT`).
 */
function inlineValue(el, prop) {
  let node = el;
  while (node && node.nodeType === 1) {
    const value = node.style ? node.style.getPropertyValue(prop) : "";
    if (value) return value;
    node = node.parentElement;
  }
  return "";
}

/** Premier nom d'une pile de polices CSS, sans guillemets ni repli. */
function premierNom(pile) {
  const first = String(pile || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  return /^(inherit|initial|unset|revert)$/i.test(first) ? "" : first;
}

/** Style d'un nœud, tel que le navigateur le calcule (corps, graisse, couleur). */
function styleOf(el) {
  const cs = view(el).getComputedStyle(el);
  const decoration = `${cs.textDecorationLine || ""} ${cs.textDecoration || ""}`;
  const weight = Number.parseInt(cs.fontWeight, 10) || (/bold/i.test(cs.fontWeight) ? 700 : 400);
  const points = parseFloat(cs.fontSize);
  return {
    bold: weight >= 600,
    italic: /italic|oblique/i.test(cs.fontStyle),
    underline: /underline/i.test(decoration),
    strike: /line-through/i.test(decoration),
    color: normalizeColor(cs.color),
    size: Number.isFinite(points) ? pxToPt(points) : 0,
    // Police et fond propres au passage (police choisie dans la barre d'outils,
    // surlignage) : « » quand le passage suit la charte, et c'est alors la
    // police du document qui s'applique dans le fichier exporté.
    font: premierNom(inlineValue(el, "font-family")),
    shading: normalizeColor(inlineValue(el, "background-color")),
    // Exposant et indice : le navigateur les exprime par un alignement
    // vertical, que Word et OpenDocument savent rendre.
    position: cs.verticalAlign === "super" ? "super" : cs.verticalAlign === "sub" ? "sub" : "",
    link: "",
  };
}

/** Le style calculé hérite déjà ; seules les décorations se transmettent. */
function mergeStyle(parent, own) {
  return {
    bold: own.bold,
    italic: own.italic,
    underline: own.underline || parent.underline,
    strike: own.strike || parent.strike,
    color: own.color,
    size: own.size,
    font: own.font || parent.font,
    shading: own.shading || parent.shading,
    position: own.position || parent.position,
    link: own.link || parent.link,
  };
}

/** Alignement du bloc qui porte l'élément (l'alignement se transmet aux blocs). */
function alignOf(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    const value = view(node).getComputedStyle(node).textAlign;
    if (value === "center" || value === "right" || value === "justify") return value;
    if (BLOCK_TAGS.has(node.tagName)) break;
    node = node.parentElement;
  }
  return "";
}

/** Espaces réduits comme le navigateur le fait, sans toucher à l'insécable. */
const collapse = (text) => String(text).replace(/[ \t\r\n\f]+/g, " ");

/**
 * Retrait d'un paragraphe, en centimètres : `indentFirst` décale sa **première
 * ligne** — la marque d'un considérant —, `indentLeft` tout son texte. Zéro est
 * l'absence de retrait, et le modèle le porte explicitement plutôt que de le
 * laisser deviner : les trois écritures s'en servent (voir `pdfParagraphe`,
 * `docxParagraphs` et `odfParagraph`).
 */
const SANS_RETRAIT = { indentFirst: 0, indentLeft: 0 };

const emptyPara = (align, retrait = SANS_RETRAIT) => ({ kind: "para", align, runs: [], outline: 0, ...retrait });

function inlineNode(node, block, style) {
  if (node.nodeType === 3) {
    const text = collapse(node.nodeValue);
    if (text) block.runs.push({ ...style, text });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node;
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return;
  const champ = champDePage(el);
  if (champ) { block.runs.push({ ...style, field: champ }); return; }
  const own = styleOf(el);
  if (tag === "BR") { block.runs.push({ break: true }); return; }
  if (tag === "A") own.link = el.getAttribute("href") || "";
  inlineChildren(el, block, mergeStyle(style, own));
}

function inlineChildren(el, block, style) {
  for (const child of el.childNodes) inlineNode(child, block, style);
}

/**
 * Champ de pagination porté par un élément : le numéro de page ou le nombre de
 * pages, quand le pied de page les contient (voir `piedNumerote`, dans
 * pages.js). Renvoie le nom du champ, ou `null`.
 */
function champDePage(el) {
  if (el.tagName !== "SPAN") return null;
  if (el.classList.contains("page-number")) return "PAGE";
  if (el.classList.contains("page-total")) return "NUMPAGES";
  return null;
}

/**
 * Convertit une zone de contenu en blocs : paragraphes (avec leurs segments de
 * texte), listes, tableaux et images. Les conteneurs de mise en page (`div`,
 * cellules) sont traversés ; les conteneurs souples — l'en-tête, avec ses logos
 * à gauche et à droite — deviennent des tableaux sans bordures, seule façon de
 * conserver une disposition côte à côte dans un traitement de texte.
 */
function flowBlocks(container, style, align, retrait = SANS_RETRAIT) {
  const blocks = [];
  let para = emptyPara(align, retrait);
  const flush = () => {
    trimRuns(para);
    if (para.runs.length) blocks.push(para);
    para = emptyPara(align, retrait);
  };

  const visit = (node, st) => {
    if (node.nodeType === 3) {
      const text = collapse(node.nodeValue);
      if (text) para.runs.push({ ...st, text });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    const tag = el.tagName;
    if (SKIP_TAGS.has(tag)) return;
    const champ = champDePage(el);
    if (champ) { para.runs.push({ ...st, field: champ }); return; }
    const own = styleOf(el);
    if (tag === "A") own.link = el.getAttribute("href") || "";
    const st2 = mergeStyle(st, own);

    if (tag === "BR") { para.runs.push({ break: true }); return; }
    if (tag === "IMG") {
      const image = imageBlock(el);
      flush();
      if (image) blocks.push(image);
      return;
    }
    if (tag === "UL" || tag === "OL") {
      const list = listBlock(el, st2, tag === "OL");
      flush();
      if (list) blocks.push(list);
      return;
    }
    if (tag === "TABLE") {
      const table = tableBlocks(el, st2);
      flush();
      blocks.push(...table);
      return;
    }
    if (tag === "HR") { flush(); blocks.push({ kind: "rule" }); return; }

    const cs = view(el).getComputedStyle(el);
    // Saut de page inséré dans le texte : une coupure franche, et rien
    // d'autre. Le repère est un élément du modèle, pas une mise en forme.
    if (tag === "DIV" && el.classList.contains("app-page-break")) {
      flush();
      blocks.push({ kind: "break" });
      return;
    }
    if (/flex/.test(cs.display)) {
      const row = flexRow(el, st2);
      flush();
      blocks.push(...row);
      return;
    }
    if (/grid/.test(cs.display)) {
      const rows = gridRows(el, st2, cs);
      flush();
      blocks.push(...rows);
      return;
    }
    if (BLOCK_TAGS.has(tag) || cs.display === "block" || cs.display === "list-item") {
      flush();
      // Le retrait de ce bloc s'ajoute à celui du parent pour `margin-left`,
      // qui ne s'hérite pas, et le remplace pour `text-indent`, qui s'hérite —
      // le style calculé dit déjà lequel des deux on lit.
      const dedans = {
        indentFirst: cmDe(cs.textIndent),
        indentLeft: retrait.indentLeft + cmDe(cs.marginLeft),
      };
      const inner = flowBlocks(el, st2, alignOf(el), dedans);
      // Un titre reste un titre dans le fichier exporté : il apparaît dans le
      // plan du document, sans changer sa mise en forme.
      if (HEADINGS.has(tag)) {
        const level = Number(tag.charAt(1));
        for (const part of inner) if (part.kind === "para") part.outline = level;
      }
      if (inner.length) blocks.push(...inner);
      else if (!hasVisibleContent(el)) blocks.push(emptyPara(alignOf(el), dedans));
      return;
    }
    inlineChildren(el, para, st2);
  };

  for (const node of container.childNodes) visit(node, style);
  flush();
  return blocks;
}

/** Un bloc vide n'est conservé que s'il produisait une ligne à l'écran. */
function hasVisibleContent(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === 3 && collapse(node.nodeValue).trim() !== "") return true;
    if (node.nodeType !== 1) continue;
    if (node.tagName === "BR" || node.tagName === "IMG" || node.tagName === "HR") return true;
    if (hasVisibleContent(node)) return true;
  }
  return false;
}

/**
 * Retire les espaces de début et de fin, et les segments devenus vides.
 *
 * Le blanc retiré est celui du **paragraphe**, et il ne se trouve donc que si
 * le paragraphe commence ou se termine par du texte : un paragraphe qui finit
 * par un champ de pagination — la ligne « Page 3 sur 3 » d'un pied de page —
 * garde l'espace qui précède ce champ. C'est celle qui sépare le mot du nombre,
 * et la retirer collait le nombre au mot (« sur3 »).
 */
function trimRuns(block) {
  const runs = block.runs;
  const premier = runs[0];
  if (premier && typeof premier.text === "string") {
    runs[0] = { ...premier, text: premier.text.replace(/^ +/, "") };
  }
  const dernier = runs[runs.length - 1];
  if (dernier && typeof dernier.text === "string") {
    runs[runs.length - 1] = { ...dernier, text: dernier.text.replace(/ +$/, "") };
  }
  block.runs = runs.filter((run) => run.break || run.field || (run.text !== undefined && run.text !== ""));
}

function imageBlock(el) {
  const src = el.currentSrc || el.getAttribute("src") || "";
  if (!src) return null;
  let absolute = src;
  try { absolute = new URL(src, el.ownerDocument.baseURI).href; } catch { /* adresse déjà absolue */ }
  const box = el.getBoundingClientRect();
  const width = Math.round(box.width) || el.naturalWidth || 0;
  const height = Math.round(box.height) || el.naturalHeight || 0;
  if (!width || !height) return null;
  return { kind: "image", src: absolute, width, height, align: alignOf(el.parentElement || el) };
}

function listBlock(el, style, ordered, level = 0) {
  const items = [];
  for (const enfant of el.children) {
    // Une sous-liste peut se trouver à deux endroits : **dans** le point
    // (`<li>a<ul><li>b</li></ul></li>`), ou juste après lui — c'est ce
    // qu'écrit la commande d'indentation de Chrome, que la touche Tabulation
    // emploie (`<ul><li>a</li><ul><li>b</li></ul></ul>`). Les deux écritures se
    // lisent ici de la même façon : la sous-liste suit le point qui la précède.
    // Sans cela, la seconde forme perdait ses points à l'export.
    if (enfant.tagName === "UL" || enfant.tagName === "OL") {
      const suite = listBlock(enfant, style, enfant.tagName === "OL", level + 1);
      if (suite) items.push(...suite.items);
      continue;
    }
    const li = enfant;
    if (li.tagName !== "LI") continue;
    const block = emptyPara(alignOf(li));
    const st = mergeStyle(style, styleOf(li));
    // Les sous-listes d'un point viennent *après* lui dans le fichier exporté,
    // comme à l'écran : on les met de côté le temps de traiter le point.
    const nested = [];
    for (const node of li.childNodes) {
      if (node.nodeType === 1 && (node.tagName === "UL" || node.tagName === "OL")) {
        nested.push(node);
        continue;
      }
      if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName)) {
        const inner = flowBlocks(node, mergeStyle(st, styleOf(node)), alignOf(node));
        for (const part of inner) if (part.kind === "para") block.runs.push(...part.runs);
        continue;
      }
      inlineNode(node, block, st);
    }
    trimRuns(block);
    if (block.runs.length) items.push({ level, runs: block.runs, align: alignOf(li) });
    for (const sub of nested) {
      const inner = listBlock(sub, style, sub.tagName === "OL", level + 1);
      if (inner) items.push(...inner.items);
    }
  }
  if (!items.length) return null;
  return { kind: "list", ordered, items };
}

/**
 * Conteneur souple : une rangée de cellules dont on reprend les largeurs.
 * Un seul enfant n'a pas besoin d'un tableau : la mise en page est la même.
 */
function flexRow(el, style) {
  const cells = [];
  const widths = [];
  for (const child of el.children) {
    if (SKIP_TAGS.has(child.tagName)) continue;
    const box = child.getBoundingClientRect();
    if (!box.width) continue;
    cells.push({ blocks: flowBlocks(child, mergeStyle(style, styleOf(child)), alignOf(child)), span: 1 });
    widths.push(box.width);
  }
  if (!cells.length) return [];
  if (cells.length === 1) return cells[0].blocks;
  return [{ kind: "table", borderless: true, rows: [cells], widths }];
}

/**
 * Conteneur en grille : ses enfants se lisent par rangées de colonnes, comme
 * sur la feuille. Une grille n'existe pas dans un fichier exporté ; un tableau
 * sans filets en tient lieu — mêmes colonnes, même alignement —, et une rangée
 * incomplète garde ses colonnes vides pour que ses voisines ne s'étirent pas.
 */
function gridRows(el, style, cs) {
  const pistes = (cs.gridTemplateColumns || "").split(/\s+/).filter((v) => v && v !== "none");
  const colonnes = Math.max(1, pistes.length);
  const children = [];
  for (const child of el.children) {
    if (SKIP_TAGS.has(child.tagName)) continue;
    if (!child.getBoundingClientRect().width) continue;
    children.push(child);
  }
  if (!children.length) return [];
  if (colonnes === 1) return flowBlocks(el, style, alignOf(el));
  const widths = children.slice(0, colonnes).map((child) => child.getBoundingClientRect().width);
  const rows = [];
  for (let i = 0; i < children.length; i += colonnes) {
    const tranche = children.slice(i, i + colonnes);
    const cells = tranche.map((child) => ({
      blocks: flowBlocks(child, mergeStyle(style, styleOf(child)), alignOf(child)),
      span: 1,
    }));
    while (cells.length < colonnes) cells.push({ blocks: [], span: 1 });
    rows.push(cells);
  }
  return [{ kind: "table", borderless: true, rows, widths }];
}

function tableBlocks(el, style) {
  const rows = [...(el.tBodies && el.tBodies.length ? el.tBodies[0].rows : el.rows)];
  if (!rows.length) return [];
  // Une table à une seule cellule n'est qu'un cadre de mise en page : on la
  // traverse (c'est ainsi que la feuille A4 enveloppe le document).
  if (rows.length === 1 && rows[0].cells.length === 1) {
    const cell = rows[0].cells[0];
    return flowBlocks(cell, mergeStyle(style, styleOf(cell)), alignOf(cell));
  }
  const head = el.tHead && el.tHead.rows.length ? [...el.tHead.rows] : [];
  const widths = [...rows[0].cells].map((cell) => cell.getBoundingClientRect().width);
  const model = [...head, ...rows].map((row) => [...row.cells].map((cell) => ({
    blocks: flowBlocks(cell, mergeStyle(style, styleOf(cell)), alignOf(cell)),
    span: cell.colSpan > 1 ? cell.colSpan : 1,
  })));
  const plain = model.every((cells) => cells.every((cell) => cell.span === 1));
  // Un tableau inséré dans le texte garde ses bordures ; ceux qui ne servent
  // qu'à la mise en page (l'en-tête, ses logos) n'en ont pas.
  const borderless = !el.classList.contains("app-table-bordered");
  // Le nombre de lignes d'en-tête est conservé : Word et OpenDocument
  // reprennent le fond gris de la charte sur ces lignes, que le navigateur
  // affiche et qu'eux ne devinent pas.
  return [{ kind: "table", borderless, headRows: head.length, rows: model, widths: plain ? widths : null }];
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/** Dimensions déclarées d'un SVG, pour le pixelliser à la bonne taille. */
function svgAtSize(source, width, height) {
  let out = source;
  if (!/xmlns=/.test(out)) out = out.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return out.replace(/<svg([^>]*)>/i, (match, attrs) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/gi, "");
    return `<svg${cleaned} width="${width}" height="${height}">`;
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image illisible"));
    img.src = url;
  });
}

/**
 * Octets d'une image distante.
 *
 * Le chemin direct échoue pour tout hébergeur qui n'envoie pas d'en-tête CORS :
 * le navigateur refuse alors la lecture du corps de la réponse, alors même que
 * l'image s'affiche très bien dans une balise `<img>`. C'est le cas de la
 * plupart des sites publics — ministères, Légifrance, sites d'établissements —
 * d'où vient justement l'image officielle du bloc-marque. Sans relais, le
 * document partait **sans la Marianne**, en silence.
 *
 * Deux tentatives, dans l'ordre : la lecture directe, puis le relais de la
 * plateforme (`superFetch`, disponible lorsque l'outil est hébergé sur
 * Perchance ; il n'existe pas dans une archive déployée ailleurs). Si les deux
 * échouent, l'appelant signale l'image non intégrée à l'utilisateur.
 */
async function octetsImage(src) {
  try {
    const response = await fetch(src, { mode: "cors", cache: "force-cache" });
    if (response.ok) return await response.blob();
  } catch { /* hébergeur sans en-tête CORS : on tente le relais */ }
  const relais = relaisSuperFetch();
  if (relais) {
    try {
      const response = await relais(src);
      if (response && response.ok) return await response.blob();
    } catch { /* relais indisponible ou image réellement inaccessible */ }
  }
  throw new Error("image inaccessible : son hébergeur n'autorise pas l'intégration dans un fichier");
}

/** `superFetch` de la plateforme, s'il est disponible (sinon `null`). */
function relaisSuperFetch() {
  try {
    const racine = typeof root !== "undefined" ? root : (typeof window !== "undefined" ? window.root : null);
    return racine && typeof racine.superFetch === "function" ? racine.superFetch : null;
  } catch {
    return null;
  }
}

/**
 * Récupère une image et la convertit en PNG (données `data:`). Les traitements
 * de texte n'acceptent pas le SVG, et passer par un canevas local évite toute
 * image « souillée » par une autre origine. `box` est la taille affichée.
 *
 * La pixellisation vise `3 ×` la taille affichée — à l'écran, les pixels du
 * lecteur sont en général deux ou trois fois plus fins que les pixels CSS —,
 * avec deux bornes. La **borne basse, 600 px**, compte pour les petites
 * images : le bloc-marque de l'État ne mesure que 27,4 mm de large (104 px à
 * l'écran) et sert d'en-tête à un courrier imprimé ; à 600 px il dépasse
 * 550 dpi, donc reste net à l'impression comme sous la loupe, là où un rendu
 * à 300 px montrerait ses pixels. La borne haute (1 600 px) évite qu'une photo
 * en pleine largeur ne fasse exploser le fichier Word ou OpenDocument.
 */
async function pngDataUrl(src, box) {
  const blob = await octetsImage(src);
  const width = Math.max(600, Math.min(1600, Math.round(box.width * 3)));
  const height = Math.max(40, Math.round(width * (box.height / box.width)));
  const isSvg = /svg/i.test(blob.type || "") || /\.svg($|\?)/i.test(src);
  const source = URL.createObjectURL(
    isSvg ? new Blob([svgAtSize(await blob.text(), width, height)], { type: "image/svg+xml" }) : blob
  );
  try {
    const img = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(source);
  }
}

/**
 * Image prête à être intégrée : ses octets PNG, sa taille affichée, et sa
 * copie en données `data:` — le PDF compose son texte dans la police du
 * document mais **incorpore** ses images, et attend d'elles une adresse que la
 * bibliothèque puisse lire sans rien télécharger.
 */
async function rasterImage(src, box) {
  const dataUrl = await pngDataUrl(src, box);
  return {
    dataUrl,
    bytes: dataUrlBytes(dataUrl),
    width: box.width,
    height: box.height,
  };
}

function walkBlocks(blocks, fn) {
  for (const block of blocks) {
    fn(block);
    if (block.kind === "table") {
      for (const row of block.rows) for (const cell of row) walkBlocks(cell.blocks, fn);
    }
  }
}

/** Récupère les images du modèle, les attache aux blocs et signale les échecs. */
async function inlineImages(blocks) {
  const found = [];
  walkBlocks(blocks, (block) => { if (block.kind === "image") found.push(block); });
  const cache = new Map();
  const missing = [];
  for (const block of found) {
    if (!cache.has(block.src)) cache.set(block.src, rasterImage(block.src, block).catch(() => null));
    block.image = await cache.get(block.src);
    if (!block.image) missing.push(block.src);
  }
  return [...new Set(missing)];
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Alignement d'un bloc, tel que la bibliothèque de mise en page le nomme.
 * Le modèle dit `""` pour l'alignement par défaut — à gauche —, qui est aussi
 * celui de la bibliothèque : il n'y a donc rien à écrire dans ce cas.
 */
const ALIGN_PDF = { center: "center", right: "right", justify: "justify" };

/** Taille de corps du texte courant, si un segment n'en portait pas. */
const TAILLE_PT = 12;
/** Couleur du texte courant : celle de `DOCUMENT_CSS` (voir render.js). */
const COULEUR_PT = "#3A3A3A";
/** Nom sous lequel l'outil signe les fichiers qu'il produit. */
const PRODUCTEUR = "Gestion des sections disciplinaires";

/**
 * Interlignes de la charte, tels que `DOCUMENT_CSS` les pose : 1,5 pour le
 * texte courant, 1,3 pour les titres.
 *
 * La bibliothèque de mise en page ne les entend pas de la même oreille : son
 * `lineHeight` est un facteur du **blanc naturel de la police** — hauteur
 * d'ascendante plus hauteur de descendante —, non du corps. Le rapport entre
 * les deux, relevé sur le fichier de police (`ratio`, voir `pdf-fonts.js`),
 * divise donc l'interligne de la charte : la ligne occupe alors exactement la
 * hauteur qu'elle a dans l'aperçu — 18 points pour un corps de 12 points à
 * l'interligne 1,5 —, et la pagination du PDF suit celle de l'écran.
 */
const INTERLIGNE = 1.5;
const INTERLIGNE_TITRE = 1.3;

/**
 * Filets et marges internes des tableaux du texte, repris du DSFR (voir
 * `DOCUMENT_CSS`) : 1 px de filet, 2 px sous la ligne d'en-tête, 0,4 rem
 * au-dessus et au-dessous du texte, 0,6 rem de chaque côté. Le fond de
 * l'en-tête, lui, est celui de la charte — la bibliothèque ne le devine pas
 * plus que Word ou OpenDocument.
 */
const FILET_PT = 0.75;
const FILET_ENTETE_PT = 1.5;
const CELLULE_H_PT = 7.2;
const CELLULE_V_PT = 4.8;
const FILET_COULEUR = "#DDDDDD";
const FILET_ENTETE_COULEUR = "#3A3A3A";
const FOND_ENTETE = "#F6F6F6";

/** Mise en page d'un tableau du texte : les filets et le fond du DSFR. */
const MISE_EN_PAGE_TABLEAU = {
  hLineWidth: (i, node) => (node.table.headerRows && i === node.table.headerRows ? FILET_ENTETE_PT : FILET_PT),
  hLineColor: (i, node) => (node.table.headerRows && i === node.table.headerRows ? FILET_ENTETE_COULEUR : FILET_COULEUR),
  vLineWidth: () => FILET_PT,
  vLineColor: () => FILET_COULEUR,
  paddingLeft: () => CELLULE_H_PT,
  paddingRight: () => CELLULE_H_PT,
  paddingTop: () => CELLULE_V_PT,
  paddingBottom: () => CELLULE_V_PT,
};

/**
 * Mise en page d'un tableau de mise en page — la rangée de logos de l'en-tête,
 * les deux colonnes d'une signature : aucun filet, aucun blanc intérieur. Les
 * cellules y sont des colonnes, pas des cases.
 */
const MISE_EN_PAGE_SANS_FILET = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  hLineColor: () => "#FFFFFF",
  vLineColor: () => "#FFFFFF",
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

/**
 * Le filet du pied de page, que la charte pose au-dessus de sa première ligne,
 * suivi du rembourrage qui la sépare du filet — les 10 px de `padding-top` du
 * pied de page (voir `DOCUMENT_CSS`). Le tout occupe la hauteur mesurée sur la
 * feuille, que `exportPdf` réserve dans la marge basse.
 */
const PADDING_PIED_PT = 7.5;

function pdfFiletPied() {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: round1(CONTENT_W_PT), y2: 0, lineWidth: FILET_PT, lineColor: FILET_COULEUR }],
    margin: [0, 0, 0, PADDING_PIED_PT],
  };
}

/**
 * Police d'un segment de texte dans le PDF.
 *
 * Le texte d'un PDF/A est un texte **embarqué** : la police qui le compose
 * voyage dans le fichier, et la personne qui l'ouvre la voit telle qu'elle a
 * été composée, sur n'importe quel poste. Encore faut-il posséder le fichier de
 * cette police — ce qui n'est vrai que des deux familles de `pdf-fonts.js`.
 *
 * Les noms que la barre d'outils propose — Arial, Times New Roman, Georgia,
 * Verdana — ne sont pas de ceux-là : ils désignent des polices installées sur
 * les postes, qu'aucune licence ne permet de joindre à un document. Le PDF les
 * remplace donc par la police des documents, et l'export **signale** la
 * substitution à l'auteur (`substituees`) plutôt que de la lui cacher.
 */
function pdfPolice(nom, ctx) {
  if (!nom) return ctx.famille;
  if (estEmbarquee(nom)) return nom;
  if (!ctx.substituees.includes(nom)) ctx.substituees.push(nom);
  return ctx.famille;
}

/** Un segment de texte, tel que la bibliothèque de mise en page l'écrit. */
function pdfRun(run, ctx) {
  const noeud = { text: run.text, fontSize: run.size || TAILLE_PT };
  if (run.bold) noeud.bold = true;
  if (run.italic) noeud.italics = true;
  if (run.underline) noeud.decoration = "underline";
  if (run.strike) noeud.decoration = noeud.decoration ? [noeud.decoration, "lineThrough"] : "lineThrough";
  if (run.color) noeud.color = run.color;
  if (run.shading) noeud.background = run.shading;
  // Exposant et indice : la bibliothèque sait les deux — elle en réduit le
  // corps et en décale la ligne de base, comme le navigateur.
  if (run.position === "super") noeud.sup = true;
  if (run.position === "sub") noeud.sub = true;
  if (run.link) noeud.link = run.link;
  const police = pdfPolice(run.font, ctx);
  if (police !== ctx.famille) noeud.font = police;
  return noeud;
}

/**
 * Les segments d'un paragraphe ou d'un point de liste.
 *
 * Deux repères du modèle ne sont pas des textes. Le saut de ligne, d'abord : la
 * bibliothèque le reconnaît dans un segment. Le champ de pagination, ensuite,
 * qui n'a de valeur qu'au bas d'une page — seul le pied de page, composé page à
 * page, le sait (`champs`, voir `pdfPied`).
 */
function pdfRuns(runs, ctx) {
  const out = [];
  for (const run of runs) {
    if (run.break) { out.push({ text: "\n" }); continue; }
    if (run.field) { out.push(pdfRun({ ...run, text: String(ctx.champs[run.field] ?? "") }, ctx)); continue; }
    out.push(pdfRun(run, ctx));
  }
  return out;
}

/** Un paragraphe : ses segments, son alignement, ses marges, ses retraits. */
function pdfParagraphe(block, ctx, cellules) {
  // Un paragraphe reste d'un seul tenant : la coupure de page passe entre deux
  // paragraphes, jamais au milieu de l'un d'eux. C'est la règle de l'aperçu et
  // de la fenêtre d'impression du navigateur — où une coupure tombe toujours
  // entre deux blocs —, et c'est elle qui fait coïncider le nombre de pages du
  // PDF avec celui que le document annonce. Un paragraphe plus haut qu'une page
  // se coupe malgré tout : la bibliothèque n'a pas d'autre issue.
  const noeud = { text: pdfRuns(block.runs, ctx), unbreakable: true };
  const align = ALIGN_PDF[block.align];
  if (align) noeud.alignment = align;
  // Le retrait du bloc se pose en marge gauche ; celui de la première ligne,
  // par `leadingIndent`. La bibliothèque ne lit cette propriété-là que sur le
  // **premier segment** du paragraphe : posée sur le paragraphe, elle serait
  // ignorée en silence.
  const gauche = block.indentLeft ? cmPt(block.indentLeft) : 0;
  if (block.indentFirst && noeud.text.length) noeud.text[0].leadingIndent = cmPt(block.indentFirst);
  if (block.outline) {
    // Un titre garde la mise en forme de l'écran — un corps et un interligne à
    // lui, comme les autres formats ; la bibliothèque de mise en page ne sait
    // pas, elle, en faire une entrée de signets (son `tocItem` n'a de sens
    // qu'avec une table des matières, que ces documents n'ont pas).
    noeud.lineHeight = INTERLIGNE_TITRE / ctx.ratio;
    noeud.margin = cellules ? [gauche, 0, 0, 0] : [gauche, 15, 0, 6];
  } else {
    noeud.margin = [gauche, 0, 0, 6];
  }
  return noeud;
}

/** Les puces de la charte, du niveau le plus haut au plus profond. */
const PUCES_PDF = ["disc", "circle", "square"];

/**
 * Une liste, à partir des points du modèle.
 *
 * Le modèle range les points à plat, chacun portant son niveau — les
 * sous-listes suivent leur point parent. La bibliothèque, elle, attend des
 * listes **imbriquées** : on refait l'arbre avant de l'écrire. La puce, elle,
 * est de son côté un dessin — un rond plein, un rond vide, un carré : les
 * mêmes marques que « • », « ◦ » et « ▪ », sans dépendre d'un caractère que
 * toutes les polices n'ont pas.
 */
function pdfListe(block, ctx) {
  const racine = { niveau: -1, noeuds: [] };
  const pile = [racine];
  for (const item of block.items) {
    while (pile.length > 1 && pile[pile.length - 1].niveau >= item.level) pile.pop();
    const noeud = { niveau: item.level, item, enfants: [] };
    pile[pile.length - 1].noeuds.push(noeud);
    pile.push(noeud);
  }
  const rendre = (noeuds) => {
    const items = [];
    for (const noeud of noeuds) {
      const item = { text: pdfRuns(noeud.item.runs, ctx) };
      const align = ALIGN_PDF[noeud.item.align];
      if (align) item.alignment = align;
      if (!block.ordered) item.listType = PUCES_PDF[Math.min(noeud.item.level, PUCES_PDF.length - 1)];
      items.push(item);
      if (noeud.enfants.length) items.push(rendre(noeud.enfants));
    }
    return block.ordered ? { ol: items } : { ul: items };
  };
  const liste = rendre(racine.noeuds);
  liste.margin = [0, 0, 0, 6];
  return liste;
}

/**
 * Une image : la copie locale de ses pixels, à la taille où la feuille
 * l'affiche. La bibliothèque incorpore le PNG au fichier — rien ne dépend plus
 * de l'hébergeur d'origine une fois le document exporté.
 */
function pdfImage(block) {
  if (!block.image || !block.image.dataUrl) return null;
  const noeud = {
    image: block.image.dataUrl,
    width: round1(pxToPt(block.image.width)),
    height: round1(pxToPt(block.image.height)),
    margin: [0, 0, 0, 6],
  };
  const align = ALIGN_PDF[block.align];
  if (align) noeud.alignment = align;
  return noeud;
}

/**
 * Un tableau : ses largeurs — celles que le navigateur a mesurées, ramenées à
 * la largeur utile de la feuille —, ses lignes d'en-tête, et ses cellules, qui
 * peuvent porter plusieurs blocs.
 *
 * Une cellule fusionnée se déclare en `colSpan`, et se paie d'autant de cases
 * vides : c'est ainsi que la bibliothèque compte les colonnes.
 */
function pdfTableau(block, ctx) {
  const colonnes = block.rows.reduce((n, cells) => Math.max(n, cells.length), 0);
  if (!colonnes) return null;
  const mesurees = block.widths && block.widths.length === colonnes ? block.widths : null;
  const total = mesurees ? mesurees.reduce((a, b) => a + b, 0) || 1 : colonnes;
  const widths = mesurees
    ? mesurees.map((w) => round1((w / total) * CONTENT_W_PT))
    : Array.from({ length: colonnes }, () => "*");
  const body = block.rows.map((cells, ligne) => {
    const sortie = [];
    for (const cellule of cells) {
      const blocs = pdfBlocs(cellule.blocks, ctx, true);
      const noeud = blocs.length === 1 ? blocs[0] : { stack: blocs.length ? blocs : [{ text: "" }] };
      const span = cellule.span > 1 ? cellule.span : 0;
      if (span) noeud.colSpan = span;
      if (ligne < (block.headRows || 0)) noeud.fillColor = FOND_ENTETE;
      sortie.push(noeud);
      for (let k = 1; k < span; k += 1) sortie.push({});
    }
    return sortie;
  });
  return {
    table: { headerRows: block.headRows || 0, widths, body },
    layout: block.borderless ? MISE_EN_PAGE_SANS_FILET : MISE_EN_PAGE_TABLEAU,
    margin: [0, 0, 0, 8],
  };
}

/** Un filet horizontal : le `hr` de la charte, avec ses deux blancs d'un rem. */
function pdfFilet() {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: round1(CONTENT_W_PT), y2: 0, lineWidth: FILET_PT, lineColor: FILET_COULEUR }],
    margin: [0, 12, 0, 12],
  };
}

/** Un bloc du modèle, dans la langue de la bibliothèque de mise en page. */
function pdfBloc(block, ctx, cellules) {
  if (block.kind === "para") return pdfParagraphe(block, ctx, cellules);
  if (block.kind === "list") return pdfListe(block, ctx);
  if (block.kind === "image") return pdfImage(block);
  if (block.kind === "table") return pdfTableau(block, ctx);
  if (block.kind === "rule") return pdfFilet();
  return null;
}

/**
 * Les blocs d'un contenu, dans l'ordre, avec leurs marges.
 *
 * Les marges verticales de deux blocs voisins se **recouvrent** en CSS : c'est
 * la plus grande des deux qui s'applique, jamais leur somme. La bibliothèque,
 * elle, les additionne — on lui retire donc, en haut de chaque bloc, ce que la
 * marge basse du précédent a déjà posé. Le premier bloc d'une page n'a pas de
 * marge haute : la feuille a déjà la sienne.
 *
 * `cellules` marque les blocs écrits dans une cellule de tableau : le DSFR y
 * éteint les marges des paragraphes, sans quoi un tableau de plusieurs lignes
 * se disloque.
 */
function pdfBlocs(blocks, ctx, cellules = false) {
  const out = [];
  let bas = 0;
  let premier = true;
  let saut = false;
  for (const block of blocks) {
    // Le saut de page du texte est un repère, pas un bloc : il se pose sur le
    // bloc suivant, sous la forme d'une coupure demandée avant lui.
    if (block.kind === "break") { saut = true; continue; }
    const noeud = pdfBloc(block, ctx, cellules);
    if (!noeud) continue;
    const marges = noeud.margin || [0, 0, 0, 0];
    const haut = cellules || premier ? 0 : Math.max(0, marges[1] - bas);
    noeud.margin = [marges[0], haut, marges[2], cellules ? 0 : marges[3]];
    if (saut) { noeud.pageBreak = "before"; saut = false; }
    bas = cellules ? 0 : marges[3];
    premier = false;
    out.push(noeud);
  }
  return out;
}

/**
 * Le pied de page, répété au bas de chaque page.
 *
 * La bibliothèque le compose à part, dans la marge basse : la hauteur de la
 * marge lui est réservée (voir `exportPdf`), et le pied de page s'y écrit
 * depuis le haut. Elle le recompose page par page — c'est le seul endroit où
 * le numéro de page et le nombre de pages existent, et donc le seul où les
 * repères `{page}` et `{pages}` du format peuvent être remplis.
 *
 * Le pied de page est composé sur toute la largeur de la feuille, sans les
 * marges du document : on les lui repose, pour que son texte s'aligne sur
 * celui du corps.
 */
function pdfPied(footerBlocks, ctx) {
  return (page, total) => ({
    stack: [pdfFiletPied(), ...pdfBlocs(footerBlocks, { ...ctx, champs: { PAGE: page, NUMPAGES: total } })],
    margin: [MARGIN_PT, 0, MARGIN_PT, 0],
  });
}

/**
 * Compose le document avec la bibliothèque de mise en page et rend ses octets.
 *
 * La bibliothèque ne rapporte pas toujours ses échecs : une police absente ou
 * une image illisible peut l'arrêter sans que le rappel soit jamais appelé. Le
 * délai ci-dessous est là pour cela — un message clair vaut mieux qu'un
 * indicateur de préparation qui tourne sans fin.
 */
function composer(definition, pdfMake) {
  return new Promise((resolve, reject) => {
    const delai = setTimeout(() => reject(new Error("la composition du PDF n'a pas abouti")), 60000);
    const finir = (fn) => (valeur) => { clearTimeout(delai); fn(valeur); };
    try {
      pdfMake.createPdf(definition).getBlob(finir(resolve));
    } catch (err) {
      finir(reject)(err);
    }
  });
}

/**
 * Export PDF : le document est **composé** — paragraphes, listes, tableaux et
 * images — par la bibliothèque de mise en page, dans la police du document,
 * puis converti au format d'archivage **PDF/A-2b** (`pdf-a.js`).
 *
 * Le texte du fichier est du texte : on peut le sélectionner, le chercher et le
 * copier, et il reste lisible et imprimable sur un poste qui n'a ni la police
 * ni le logiciel qui l'a produit — c'est ce qu'exige le format PDF/A, et ce
 * qu'une image de page ne peut pas offrir. Les polices sont embarquées (voir
 * `pdf-fonts.js`), les images le sont aussi, et les liens du document restent
 * cliquables : chacun est porté par le texte qui le nomme, non par un rectangle
 * relevé à part.
 */
export async function exportPdf(blocks, footerBlocks, meta = {}, { footerHeight = 0 } = {}) {
  const pdfMake = (await loadPdfMake()).default;
  const famille = familleEmbarquee(meta.policePdf);
  const ctx = { famille, ratio: 1, substituees: [], champs: {} };
  // Les polices doivent être dans le système de fichiers de la bibliothèque
  // **avant** la composition : sans son fichier, elle ne sait pas composer.
  const { manquants, ratio } = await chargerFamille(famille, pdfMake);
  if (manquants.length) {
    throw new Error("la police des documents n'a pas pu être téléchargée — l'export PDF en a besoin pour être lisible partout");
  }
  ctx.ratio = ratio || 1;
  pdfMake.setFonts(configurationPolices());

  // Les images sont récupérées et copiées en PNG : c'est cette copie que le
  // PDF incorpore, et une image que son hébergeur refuse de laisser lire se
  // **signale** — sans quoi un courrier partait sans son bloc-marque de l'État
  // sans que rien ne le dise.
  const [manquantesContenu, manquantesPied] = await Promise.all([inlineImages(blocks), inlineImages(footerBlocks)]);
  const missing = [...new Set([...manquantesContenu, ...manquantesPied])];

  // Le pied de page occupe le bas de la marge basse : sa hauteur, mesurée sur
  // la feuille, s'y ajoute, avec le blanc qui le sépare du texte.
  const margeBasse = MARGIN_PT + FOOTER_GAP_MM * MM_PT + (footerHeight ? pxToPt(footerHeight) : 0);
  const definition = {
    // La feuille A4, telle que la décrit ce module : c'est ici que se règlent
    // le format et les marges de toute la chaîne d'impression.
    pageSize: { width: round1(PAGE_W_MM * MM_PT), height: round1(PAGE_H_MM * MM_PT) },
    pageMargins: [MARGIN_PT, MARGIN_PT, MARGIN_PT, margeBasse],
    defaultStyle: {
      font: famille,
      fontSize: TAILLE_PT,
      lineHeight: INTERLIGNE / ctx.ratio,
      color: COULEUR_PT,
    },
    content: pdfBlocs(blocks, ctx),
    // Le titre voyage déjà dans les métadonnées du PDF ordinaire : si la
    // conversion au format d'archivage échouait, le fichier ne partirait pas
    // pour autant sans nom.
    info: {
      title: String(meta.title || "Document"),
      creator: PRODUCTEUR,
      producer: PRODUCTEUR,
    },
  };
  if (footerBlocks.length) definition.footer = pdfPied(footerBlocks, ctx);

  const brut = new Uint8Array(await (await composer(definition, pdfMake)).arrayBuffer());
  let octets = brut;
  let pdfA = true;
  try {
    octets = await versPdfA(brut, {
      titre: String(meta.title || "Document"),
      producteur: PRODUCTEUR,
      date: new Date(),
    });
  } catch (err) {
    // Un PDF ordinaire vaut mieux qu'aucun document : le texte, les polices et
    // les images y sont déjà. Il manque le marquage d'archivage, et rien
    // d'autre — l'auteur en est **prévenu** (voir `runExport`, dans app.js) :
    // la conversion était « au mieux », et le silence faisait croire à un
    // fichier propre au versement (NC-0017).
    pdfA = false;
    console.warn("PDF/A : conversion impossible, le PDF ordinaire est conservé.", err);
  }
  const blob = new Blob([octets], { type: "application/pdf" });
  return {
    blob,
    name: `${fileSlug(meta.filename || meta.title || "document")}.pdf`,
    bytes: blob.size,
    missing,
    substituees: ctx.substituees,
    pdfA,
  };
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

const ALIGN_DOCX = { center: "center", right: "right", justify: "both" };

/** Mise en forme d'un segment de texte, telle que le navigateur l'a calculée. */
function docxRunOptions(run) {
  return {
    text: run.text,
    bold: run.bold || undefined,
    italics: run.italic || undefined,
    underline: run.underline ? { type: "single" } : undefined,
    strike: run.strike || undefined,
    color: run.color ? run.color.replace("#", "") : undefined,
    size: Math.round(run.size * 2) || undefined,
    superScript: run.position === "super" || undefined,
    subScript: run.position === "sub" || undefined,
    // Police du passage, quand l'auteur en a choisi une (barre d'outils) ;
    // sinon celle du document, décidée par la charte (voir `policeDocumentNom`
    // dans charte.js) : Arial ou Public Sans, jamais Marianne — Word la
    // remplacerait sans le dire sur un poste qui ne l'a pas.
    font: run.font || FONT,
    shading: run.shading ? { fill: run.shading.replace("#", "") } : undefined,
  };
}

/**
 * Segments de texte d'un paragraphe. Les segments qui partagent le même lien
 * sont regroupés dans un vrai lien hypertexte, sinon le lien serait perdu.
 */
function docxRuns(runs, api) {
  const out = [];
  let link = null;
  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    if (link) {
      out.push(new api.ExternalHyperlink({
        link,
        children: buffer.map((run) => new api.TextRun(docxRunOptions(run))),
      }));
    } else {
      for (const run of buffer) out.push(new api.TextRun(docxRunOptions(run)));
    }
    buffer = [];
  };
  for (const run of runs) {
    if (run.break) continue;
    /* Numéro de page : ce n'est pas un texte, mais un champ que Word recalcule
       à l'affichage et à l'impression — la seule façon d'avoir « Page 3 sur 5 »
       juste dans un fichier dont la pagination n'appartient qu'à Word. */
    if (run.field) {
      flush();
      out.push(new api.TextRun({
        children: [run.field === "PAGE" ? api.PageNumber.CURRENT : api.PageNumber.TOTAL_PAGES],
      }));
      continue;
    }
    const href = run.link || "";
    if (href !== (link || "")) { flush(); link = href || null; }
    buffer.push(run);
  }
  flush();
  return out;
}

/** Styles de titre : ils gardent la mise en forme de l'écran, et le plan. */
const HEADING_STYLE = (level) => `Titre${level}`;

function docxParagraphs(block, api) {
  // Un saut de ligne devient un paragraphe : à interligne et marges fixes, le
  // rendu est celui de l'écran, sans dépendre d'une option de saut de ligne.
  const groups = [[]];
  for (const run of block.runs) {
    if (run.break) groups.push([]);
    else groups[groups.length - 1].push(run);
  }
  // Le retrait du bloc s'applique à chaque ligne ; celui de la **première**
  // ligne, au seul premier paragraphe — un saut de ligne en ouvre un autre, et
  // seule la première ligne du bloc se décale.
  const gauche = block.indentLeft ? { left: cmTw(block.indentLeft) } : {};
  const premiere = block.indentFirst ? { firstLine: cmTw(block.indentFirst) } : {};
  return groups.map((runs, rang) => new api.Paragraph({
    children: docxRuns(runs, api),
    alignment: ALIGN_DOCX[block.align] || undefined,
    style: block.outline ? HEADING_STYLE(block.outline) : undefined,
    outlineLevel: block.outline ? block.outline - 1 : undefined,
    indent: { ...gauche, ...(rang ? {} : premiere) },
    spacing: { line: 360, before: 0, after: 0 },
  }));
}

function docxBlocks(blocks, api, ctx) {
  const out = [];
  for (const block of blocks) {
    if (block.kind === "para") {
      out.push(...docxParagraphs(block, api));
    } else if (block.kind === "list") {
      // Chaque liste numérotée repart de 1 : une numérotation concrète propre,
      // désignée par son rang (`instance`), évite que la deuxième liste reprenne
      // le compte là où la première s'est arrêtée.
      const instance = block.ordered ? (ctx.numbers += 1) : undefined;
      for (const item of block.items) {
        out.push(new api.Paragraph({
          children: docxRuns(item.runs, api),
          numbering: {
            reference: block.ordered ? "nombres" : "puces",
            level: Math.min(item.level, 2),
            instance,
          },
          alignment: ALIGN_DOCX[item.align] || undefined,
          spacing: { line: 360, before: 0, after: 0 },
        }));
      }
    } else if (block.kind === "rule") {
      out.push(new api.Paragraph({
        text: "",
        border: { bottom: { style: api.BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } },
      }));
    } else if (block.kind === "break") {
      // Saut de page : un paragraphe réduit à la coupure, pour qu'aucune
      // ligne blanche ne s'ajoute avant la page suivante.
      out.push(new api.Paragraph({
        children: [new api.PageBreak()],
        spacing: { line: 360, before: 0, after: 0 },
      }));
    } else if (block.kind === "image") {
      if (!block.image) continue;
      out.push(new api.Paragraph({
        alignment: ALIGN_DOCX[block.align] || undefined,
        spacing: { line: 360, before: 0, after: 0 },
        children: [new api.ImageRun({
          data: block.image.bytes,
          type: "png",
          transformation: { width: block.image.width, height: block.image.height },
        })],
      }));
    } else if (block.kind === "table") {
      const table = docxTable(block, api, ctx);
      if (table) out.push(table);
    }
  }
  return out;
}

function docxTable(block, api, ctx) {
  const columns = block.rows.reduce((n, cells) => Math.max(n, cells.length), 0);
  if (!columns) return null;
  const widths = block.widths && block.widths.length === columns ? block.widths : null;
  const total = widths ? widths.reduce((a, b) => a + b, 0) || 1 : columns;
  const twips = widths
    ? widths.map((w) => Math.round((w / total) * CONTENT_W_TW))
    : Array.from({ length: columns }, () => Math.round(CONTENT_W_TW / columns));
  const none = { style: api.BorderStyle.NONE, size: 0, color: "FFFFFF" };
  // Un tableau du texte est bordé ; celui d'une mise en page (la rangée de
  // logos de l'en-tête) ne l'est pas. Le filet est celui des tableaux du
  // DSFR, #ddd — léger, la charte se passe de grille.
  const single = { style: api.BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 0 };
  const borders = block.borderless
    ? { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }
    : { top: single, bottom: single, left: single, right: single, insideHorizontal: single, insideVertical: single };
  return new api.Table({
    width: { size: CONTENT_W_TW, type: api.WidthType.DXA },
    columnWidths: twips,
    layout: api.TableLayoutType.FIXED,
    borders,
    rows: block.rows.map((cells, row) => new api.TableRow({
      children: cells.map((cell, index) => new api.TableCell({
        children: docxBlocks(cell.blocks, api, ctx),
        width: { size: twips[Math.min(index, columns - 1)], type: api.WidthType.DXA },
        columnSpan: cell.span > 1 ? cell.span : undefined,
        shading: row < (block.headRows || 0) ? { fill: "F6F6F6" } : undefined,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })),
    })),
  });
}

/** Export Word (.docx) : A4, marges de 2 cm, pied de page répété. */
export async function exportDocx(blocks, footerBlocks, meta = {}) {
  const api = await loadDocxLib();
  const missing = await inlineImages(blocks);
  await inlineImages(footerBlocks);
  // Un seul compteur : les numérotations concrètes sont désignées par leur rang
  // dans le fichier, elles doivent donc être uniques d'un bout à l'autre.
  const ctx = { numbers: 0 };
  const section = {
    properties: {
      page: {
        size: { width: PAGE_W_TW, height: PAGE_H_TW, orientation: api.PageOrientation.PORTRAIT },
        margin: { top: MARGIN_TW, right: MARGIN_TW, bottom: MARGIN_TW, left: MARGIN_TW, footer: MARGIN_TW },
      },
    },
    children: docxBlocks(blocks, api, ctx),
  };
  if (footerBlocks.length) {
    section.footers = { default: new api.Footer({ children: docxBlocks(footerBlocks, api, ctx) }) };
  }
  const document = new api.Document({
    creator: "Gestion des sections disciplinaires",
    title: meta.title || "Document",
    description: meta.subject || "",
    numbering: { config: [numberingConfig(api, "puces", "bullet"), numberingConfig(api, "nombres", "decimal")] },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24 },
          paragraph: { spacing: { line: 360, before: 0, after: 0 } },
        },
      },
      // Un titre reste un titre : il apparaît dans le plan du document (Word,
      // LibreOffice) sans que le style ne change sa mise en forme, qui vient des
      // segments de texte eux-mêmes.
      paragraphStyles: [1, 2, 3, 4, 5, 6].map((level) => ({
        id: HEADING_STYLE(level),
        name: `Titre ${level}`,
        basedOn: `Heading${level}`,
        next: "Normal",
        quickFormat: true,
        run: { font: FONT, bold: false, color: "000000", size: 24 },
        paragraph: { spacing: { line: 360, before: 0, after: 0 } },
      })),
    },
    sections: [section],
  });
  const blob = await api.Packer.toBlob(document);
  return { blob, name: `${fileSlug(meta.filename || meta.title || "document")}.docx`, bytes: blob.size, missing };
}

function numberingConfig(api, reference, kind) {
  return {
    reference,
    levels: [0, 1, 2].map((level) => ({
      level,
      format: kind === "bullet" ? api.LevelFormat.BULLET : api.LevelFormat.DECIMAL,
      text: kind === "bullet" ? ["•", "◦", "▪"][level] : `%${level + 1}.`,
      alignment: api.AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    })),
  };
}

/* ------------------------------------------------------------------ */
/* ODT                                                                 */
/* ------------------------------------------------------------------ */

const ODF_NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
].join("\n    ");

const BULLETS = ["•", "◦", "▪"];

/**
 * Fabrique de styles automatiques : une définition par signature rencontrée,
 * pour ne pas recopier la même mise en forme sur chaque segment de texte.
 */
function styleRegistry() {
  const defs = [];
  const seen = new Map();
  let counter = 0;
  const register = (signature, build) => {
    if (seen.has(signature)) return seen.get(signature);
    const name = build(++counter);
    seen.set(signature, name);
    return name;
  };
  return {
    define(markup) { defs.push(markup); },
    text(run) {
      if (!run.bold && !run.italic && !run.underline && !run.strike && !run.color && !run.size
        && !run.position && !run.font && !run.shading) return "";
      return register(
        `T|${[run.bold, run.italic, run.underline, run.strike, run.color, run.size, run.position, run.font, run.shading].join("|")}`,
        (n) => {
          const name = `T${n}`;
          const props = [];
          if (run.bold) props.push('fo:font-weight="bold"');
          if (run.italic) props.push('fo:font-style="italic"');
          // Le soulignement s'écrit en ODF en **deux** attributs : le type
          // (« single » ou « double ») et le style du trait. LibreOffice les
          // écrit tous les deux ; n'écrire que le style laisse le type à
          // deviner, et un interprète qui complète la définition par la sienne
          // peut superposer deux traits sous un même texte — d'autant qu'un
          // lien porte, lui, son propre soulignement. Le type est donc écrit,
          // comme le fait LibreOffice : un seul trait, partout.
          if (run.underline) props.push('style:text-underline-type="single" style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
          if (run.strike) props.push('style:text-line-through-style="solid"');
          if (run.position) props.push(`style:text-position="${run.position} 58%"`);
          if (run.color) props.push(`fo:color="${escXml(run.color)}"`);
          if (run.size) props.push(`fo:font-size="${run.size}pt"`);
          // Police du passage, quand l'auteur en a choisi une ; le fond du
          // surlignage, tel quel (les deux viennent d'un style en ligne).
          if (run.font) props.push(`fo:font-family="${escXml(run.font)}"`);
          if (run.shading) props.push(`fo:background-color="${escXml(run.shading)}"`);
          defs.push(`<style:style style:name="${name}" style:family="text"><style:text-properties ${props.join(" ")}/></style:style>`);
          return name;
        }
      );
    },
    paragraph(align, left = 0, first = 0) {
      return register(`P|${align}|${left}|${first}`, (n) => {
        const name = `P${n}`;
        const align0 = align === "justify" ? "justify" : align;
        const props = [];
        if (align0) props.push(`fo:text-align="${align0}"`);
        // Retraits du paragraphe : `fo:margin-left` décale tout son texte,
        // `fo:text-indent` sa seule première ligne (voir `SANS_RETRAIT`).
        if (left) props.push(`fo:margin-left="${round1(left)}cm"`);
        if (first) props.push(`fo:text-indent="${round1(first)}cm"`);
        defs.push(`<style:style style:name="${name}" style:family="paragraph"><style:paragraph-properties ${props.join(" ")}/></style:style>`);
        return name;
      });
    },
    list(ordered) {
      return register(`L|${ordered}`, (n) => {
        const name = `L${n}`;
        const levels = [0, 1, 2].map((level) => {
          const space = `text:space-before="${round1(0.6 + level * 0.6)}cm" text:min-label-width="0.6cm"`;
          if (ordered) {
            return `<text:list-level-style-number text:level="${level + 1}" style:num-format="1" style:num-suffix="."><style:list-level-properties ${space}/></text:list-level-style-number>`;
          }
          return `<text:list-level-style-bullet text:level="${level + 1}" text:bullet-char="${BULLETS[level]}"><style:list-level-properties ${space}/></text:list-level-style-bullet>`;
        }).join("");
        defs.push(`<text:list-style style:name="${name}">${levels}</text:list-style>`);
        return name;
      });
    },
    graphic(align) {
      return register(`G|${align}`, (n) => {
        const name = `fr${n}`;
        const horizontal = align === "right" ? "right" : align === "center" ? "center" : "left";
        defs.push(
          `<style:style style:name="${name}" style:family="graphic">`
          + `<style:graphic-properties style:vertical-pos="top" style:vertical-rel="baseline" style:horizontal-pos="${horizontal}" style:horizontal-rel="paragraph" fo:border="none"/>`
          + "</style:style>"
        );
        return name;
      });
    },
    /** Paragraphe qui commence une nouvelle page (saut de page du texte). */
    pageBreak() {
      return register("BR|page", (n) => {
        const name = `Saut${n}`;
        defs.push(
          `<style:style style:name="${name}" style:family="paragraph">`
          + '<style:paragraph-properties fo:break-before="page" fo:margin-top="0cm" fo:margin-bottom="0cm"/>'
          + "</style:style>"
        );
        return name;
      });
    },
    /**
     * Style d'un tableau, `base` étant le préfixe des styles de colonnes.
     * Un tableau du texte a des bordures ; un tableau de mise en page (la
     * rangée de logos de l'en-tête) n'en a pas.
     */
    tableStyle(base, bordered) {
      return register(`TB|${base}`, () => {
        const props = bordered ? ' table:border-model="collapsing"' : "";
        defs.push(`<style:style style:name="${base}" style:family="table"><style:table-properties${props}/></style:style>`);
        return base;
      });
    },
    /**
     * Cellule d'un tableau du texte : filet #ddd des tableaux du DSFR, fond
     * #f6f6f6 pour une ligne d'en-tête (le navigateur l'affiche, l'export ne
     * peut pas le deviner).
     */
    cellStyle(bordered, shaded = false) {
      if (!bordered) return "";
      return register(`TC|${shaded ? "entete" : "corps"}`, (n) => {
        const name = `Cellule${n}`;
        defs.push(
          `<style:style style:name="${name}" style:family="table-cell">`
          + '<style:table-cell-properties fo:border="0.75pt solid #dddddd" fo:padding="0.1cm"'
          + (shaded ? ' fo:background-color="#f6f6f6"' : "")
          + "/>"
          + "</style:style>"
        );
        return name;
      });
    },
    render() {
      return defs.join("\n      ");
    },
  };
}

/** Texte ODF : les espaces de bord et les espaces multiples deviennent `text:s`. */
function odfText(value) {
  return String(value).split(/( +)/).map((part) => {
    if (part === "") return "";
    if (!/^ +$/.test(part)) return escXml(part);
    return part.length === 1 ? "<text:s/>" : `<text:s text:c="${part.length}"/>`;
  }).join("");
}

function odfRuns(runs, styles) {
  let out = "";
  for (const run of runs) {
    if (run.break) { out += "<text:line-break/>"; continue; }
    /* Numéro de page : un champ ODF, recalculé par le traitement de texte —
       LibreOffice comme Word refusent de figer une pagination qu'eux seuls
       connaissent. */
    if (run.field) {
      out += run.field === "PAGE"
        ? '<text:page-number text:select-page="current">1</text:page-number>'
        : "<text:page-count>1</text:page-count>";
      continue;
    }
    let body = odfText(run.text);
    const name = styles.text(run);
    if (name) body = `<text:span text:style-name="${name}">${body}</text:span>`;
    if (run.link) body = `<text:a xlink:type="simple" xlink:href="${escXml(run.link)}">${body}</text:a>`;
    out += body;
  }
  return out;
}

function odfParagraph(runs, align, styles, outline = 0, indentLeft = 0, indentFirst = 0) {
  const name = styles.paragraph(align, indentLeft, indentFirst);
  if (outline) {
    // Un titre ODF est un `text:h` : il entre dans le plan du document, sans
    // perdre la mise en forme captée à l'écran.
    return `<text:h text:style-name="${name}" text:outline-level="${outline}">${odfRuns(runs, styles)}</text:h>`;
  }
  if (!runs.length) return `<text:p text:style-name="${name}"/>`;
  return `<text:p text:style-name="${name}">${odfRuns(runs, styles)}</text:p>`;
}

function odfBlocks(blocks, styles, ctx) {
  let out = "";
  for (const block of blocks) {
    if (block.kind === "para") {
      out += odfParagraph(block.runs, block.align, styles, block.outline || 0, block.indentLeft, block.indentFirst);
    } else if (block.kind === "list") {
      out += odfList(block, styles);
    } else if (block.kind === "image" && block.image) {
      out += `<text:p text:style-name="${styles.paragraph(block.align)}">${odfImage(block.image, block.align, styles, ctx)}</text:p>`;
    } else if (block.kind === "rule") {
      out += `<text:p text:style-name="${styles.paragraph("")}"><text:span>—</text:span></text:p>`;
    } else if (block.kind === "break") {
      out += `<text:p text:style-name="${styles.pageBreak()}"/>`;
    } else if (block.kind === "table") {
      out += odfTable(block, styles, ctx);
    }
  }
  return out;
}

/**
 * Liste ODF : les sous-listes sont de vrais `text:list` imbriqués dans le point
 * parent — la profondeur décide du niveau de puce ou de numérotation.
 */
function odfList(block, styles) {
  const name = styles.list(block.ordered);
  const render = (items, level) => {
    let out = "";
    let index = 0;
    while (index < items.length) {
      const item = items[index];
      if (item.level < level) break;
      index += 1;
      const childLevel = item.level + 1;
      const children = [];
      while (index < items.length && items[index].level >= childLevel) {
        children.push(items[index]);
        index += 1;
      }
      out += `<text:list-item>${odfParagraph(item.runs, item.align, styles)}`;
      if (children.length) out += `<text:list text:style-name="${name}">${render(children, childLevel)}</text:list>`;
      out += "</text:list-item>";
    }
    return out;
  };
  const first = block.items.length ? block.items[0].level : 0;
  return `<text:list text:style-name="${name}">${render(block.items, first)}</text:list>`;
}

/**
 * Image : un cadre ancré au caractère, pointant vers le fichier déposé dans
 * `Pictures/` de l'archive. La même image n'est déposée qu'une fois.
 */
function odfImage(image, align, styles, ctx) {
  if (!image.odtName) {
    image.odtName = `image${ctx.images.length + 1}`;
    ctx.images.push({ name: image.odtName, bytes: image.bytes });
  }
  return `<draw:frame draw:style-name="${styles.graphic(align)}" draw:name="${image.odtName}" text:anchor-type="as-char"`
    + ` svg:width="${round1(pxToCm(image.width))}cm" svg:height="${round1(pxToCm(image.height))}cm">`
    + `<draw:image xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad" xlink:href="Pictures/${image.odtName}.png"/>`
    + "</draw:frame>";
}

function odfTable(block, styles, ctx) {
  const columns = block.rows.reduce((n, cells) => Math.max(n, cells.length), 0);
  if (!columns) return "";
  const widths = block.widths && block.widths.length === columns ? block.widths : null;
  const total = widths ? widths.reduce((a, b) => a + b, 0) || 1 : columns;
  const cm = widths
    ? widths.map((w) => round1(pxToCm((w / total) * (CONTENT_W_MM / MM_PER_PX))))
    : Array.from({ length: columns }, () => round1(CONTENT_W_MM / 10 / columns));
  ctx.tables += 1;
  const name = `Tableau${ctx.tables}`;
  const bordered = !block.borderless;
  const tableStyle = styles.tableStyle(name, bordered);
  const cellStyle = styles.cellStyle(bordered);
  const headCellStyle = styles.cellStyle(bordered, true);
  const columns2 = cm.map((value, index) => {
    const columnStyle = `${name}C${index + 1}`;
    styles.define(
      `<style:style style:name="${columnStyle}" style:family="table-column"><style:table-column-properties style:column-width="${value}cm"/></style:style>`
    );
    return `<table:table-column table:style-name="${columnStyle}"/>`;
  }).join("");
  const rows = block.rows.map((cells, row) => `<table:table-row>${cells.map((cell) => {
    const span = cell.span > 1 ? ` table:number-columns-spanned="${cell.span}" table:number-rows-spanned="1"` : "";
    const chosen = row < (block.headRows || 0) && headCellStyle ? headCellStyle : cellStyle;
    const style = chosen ? ` table:style-name="${chosen}"` : "";
    return `<table:table-cell${span}${style} office:value-type="string">${odfBlocks(cell.blocks, styles, ctx)}</table:table-cell>`;
  }).join("")}</table:table-row>`).join("");
  return `<table:table table:name="${name}" table:style-name="${tableStyle}">${columns2}${rows}</table:table>`;
}

/** Export OpenDocument (.odt) : A4, marges de 2 cm, pied de page répété. */
export async function exportOdt(blocks, footerBlocks, meta = {}) {
  const missing = await inlineImages(blocks);
  await inlineImages(footerBlocks);
  const body = styleRegistry();
  const footer = styleRegistry();
  const ctx = { images: [], tables: 0 };
  const footerCtx = { images: [], tables: 0 };

  const bodyXml = odfBlocks(blocks, body, ctx);
  const footerXml = footerBlocks.length ? odfBlocks(footerBlocks, footer, footerCtx) : "";

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
    ${ODF_NS}
    office:version="1.3">
  <office:font-face-decls>
    <style:font-face style:name="${FONT}" svg:font-family="${FONT}" style:font-family-generic="swiss" style:font-pitch="variable"/>
  </office:font-face-decls>
  <office:automatic-styles>
      ${body.render()}
  </office:automatic-styles>
  <office:body>
    <office:text>${bodyXml}</office:text>
  </office:body>
</office:document-content>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
    ${ODF_NS}
    office:version="1.3">
  <office:font-face-decls>
    <style:font-face style:name="${FONT}" svg:font-family="${FONT}" style:font-family-generic="swiss" style:font-pitch="variable"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm" fo:line-height="150%"/>
      <style:text-properties style:font-name="${FONT}" fo:font-size="12pt" fo:language="fr" fo:country="FR"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text" style:master-page-name="Standard">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm" fo:line-height="150%"/>
      <style:text-properties style:font-name="${FONT}" fo:font-size="12pt"/>
    </style:style>
  </office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="pm1">
      <style:page-layout-properties fo:page-width="${PAGE_W_MM}mm" fo:page-height="${PAGE_H_MM}mm" style:print-orientation="portrait"
        fo:margin-top="${MARGIN_MM}mm" fo:margin-bottom="${MARGIN_MM}mm" fo:margin-left="${MARGIN_MM}mm" fo:margin-right="${MARGIN_MM}mm"/>
      <style:footer-style><style:footer-properties fo:margin-top="0cm"/></style:footer-style>
    </style:page-layout>
      ${footer.render()}
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="pm1">
      ${footerXml ? `<style:footer>${footerXml}</style:footer>` : ""}
    </style:master-page>
  </office:master-styles>
</office:document-styles>`;

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
    ${ODF_NS}
    office:version="1.3">
  <office:meta>
    <dc:title>${escXml(meta.title || "Document")}</dc:title>
    <dc:creator>Gestion des sections disciplinaires</dc:creator>
    <meta:generator>Gestion des sections disciplinaires</meta:generator>
  </office:meta>
</office:document-meta>`;

  const pictures = ctx.images.map((image) => ({ name: `Pictures/${image.name}.png`, data: image.bytes }));
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
  ${pictures.map((p) => `<manifest:file-entry manifest:full-path="${p.name}" manifest:media-type="image/png"/>`).join("\n  ")}
</manifest:manifest>`;

  const blob = zipStore([
    // `mimetype` doit être la première entrée de l'archive, et non compressée.
    { name: "mimetype", data: xmlBytes("application/vnd.oasis.opendocument.text") },
    { name: "content.xml", data: xmlBytes(content) },
    { name: "styles.xml", data: xmlBytes(stylesXml) },
    { name: "meta.xml", data: xmlBytes(metaXml) },
    { name: "META-INF/manifest.xml", data: xmlBytes(manifest) },
    ...pictures,
  ]);
  return { blob, name: `${fileSlug(meta.filename || meta.title || "document")}.odt`, bytes: blob.size, missing };
}

/* ------------------------------------------------------------------ */
/* Entrée commune                                                      */
/* ------------------------------------------------------------------ */

/**
 * Prépare le modèle d'un document : le contenu de la feuille et son pied de
 * page, séparés, pour que les traitements de texte répètent le pied de page.
 * La hauteur du pied de page est relevée au passage : le PDF la réserve dans sa
 * marge basse, où il le répète lui-même.
 */
export async function prepareDocument(html) {
  const frame = await openFrame(html);
  try {
    const doc = frame.contentDocument;
    const content = contentRoot(doc);
    const width = content.clientWidth || 718;
    const { footerBlocks, footerHeight } = takeFooter(doc, width);
    return { blocks: flowBlocks(content, styleOf(content), ""), footerBlocks, footerHeight };
  } finally {
    frame.remove();
  }
}

/**
 * Exporte un document dans l'un des trois formats et déclenche le
 * téléchargement. `kind` vaut `pdf`, `docx` ou `odt`.
 *
 * `meta.font` est le nom de police des fichiers Word et OpenDocument, calculé
 * par `charte.js` (`policeDocumentNom`) : celui de la charte en vigueur — Arial
 * ou Public Sans —, ou la police réglée pour tous les documents s'il y en a une.
 * `meta.policePdf` est la famille **embarquée** du PDF, décidée par la même
 * charte (`policeDocumentEmbarquee`) : les polices du PDF voyagent dans le
 * fichier, elles ne peuvent pas être seulement nommées.
 */
export async function exportDocument(kind, html, meta = {}) {
  FONT = String(meta.font || "").trim() || FONT_DEFAUT;
  const { blocks, footerBlocks, footerHeight } = await prepareDocument(html);
  const result = kind === "pdf"
    ? await exportPdf(blocks, footerBlocks, meta, { footerHeight })
    : kind === "odt"
      ? await exportOdt(blocks, footerBlocks, meta)
      : await exportDocx(blocks, footerBlocks, meta);
  downloadBlob(result.blob, result.name);
  return result;
}
