// Assainissement du balisage — NC-0006.
//
// Deux protections distinctes, et complémentaires, contre l'injection de
// balises dans les documents :
//
//   1. **Le rendu échappe** toute valeur de donnée substituée dans un document
//      (voir `renderTemplate` / `renderVariables`, render.js) : une balise
//      écrite dans un champ ne peut plus s'exécuter dans la session du lecteur.
//   2. **L'enregistrement et l'import assainissent** les colonnes qui, elles,
//      sont rendues *comme du HTML* — le texte d'une trame, d'un document, une
//      feuille de style. C'est ce module.
//
// `assainirHtmlSecurite` ne touche ni aux balises, ni aux classes, ni aux
// styles dont un document a besoin (habillage, pagination, alignements) : il
// retire seulement ce qui peut s'exécuter ou détourner la page. Il diffère en
// cela de `sanitizeHtml` (editor.js), qui réduit un **collage** à la palette du
// rédacteur.

/** Colonnes du modèle dont le contenu est du HTML rendu tel quel. */
export const COLONNES_RICHES = new Set([
  "Template_contenu",
  "Feuille_de_style",
  "En_tete",
  "Signature",
  "Pied_de_page",
  "Contenu",
]);

const BALISES_ACTIVES = "script, iframe, frame, frameset, object, embed, applet, form, input, button, textarea, select, base, meta, link, template";
const ATTRS_ADRESSE = /^(href|src|xlink:href|action|formaction|poster|background)$/;
const SCHEMA_DANGEREUX = /^\s*(?:javascript|vbscript|data:text\/html)/i;

/**
 * Assainissement de **sûreté** d'un fragment HTML. Idempotent.
 *
 * Hors navigateur (harnais de tests sans DOM), retombe sur un nettoyage
 * textuel minimal — suffisant pour les jeux de données réduits.
 */
export function assainirHtmlSecurite(html) {
  const brut = String(html ?? "");
  if (!brut) return "";
  if (typeof DOMParser === "undefined") return nettoyageTextuel(brut);
  const doc = new DOMParser().parseFromString(brut, "text/html");
  doc.body.querySelectorAll(BALISES_ACTIVES).forEach((n) => n.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (ATTRS_ADRESSE.test(name) && SCHEMA_DANGEREUX.test(attr.value)) el.removeAttribute(attr.name);
    }
  }
  return doc.body.innerHTML;
}

/** Repli sans DOM : retire les balises actives les plus évidentes. */
function nettoyageTextuel(html) {
  return html
    .replace(/<\s*(script|iframe|object|embed|applet|form|base|meta|link|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|applet|form|base|meta|link|template)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)[^"']*\2/gi, "");
}
