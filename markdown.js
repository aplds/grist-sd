// Rendu Markdown minimal (titres, listes, gras, italique, liens, paragraphes).
// Suffisant pour les notes de présentation du document d'origine.

import { esc } from "./ui.js";

export function inlineMd(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

export function mdToHtml(md) {
  const lines = String(md ?? "").split(/\r?\n/);
  const out = [];
  let list = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inlineMd(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<ul class="fr-list">${list.join("")}</ul>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level} class="fr-h${6 - Math.min(heading[1].length, 3)}">${inlineMd(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[*-]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list = list || [];
      list.push(`<li>${inlineMd(bullet[1])}</li>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}
