// Atelier de rédaction d'une décision.
//
// Une décision n'est pas un courrier : c'est un raisonnement. Elle se rédige
// donc dans un espace à elle — `#decisions/12` —, et non dans l'onglet d'une
// affaire ou dans une colonne de liste. Cet espace a ses trois vues, comme
// celui d'un document : on écrit, on relit le balisage, on juge le rendu.
//
// Le texte vit dans le **document lié à la décision** (`Generateur`, colonne
// `Decision_liee`) : c'est ce qui permet à tout ce qui existe déjà de servir
// ici sans rien réinventer — la trame et ses balises, la feuille de style, la
// pagination, l'aperçu, la signature, l'impression et les exports PDF, Word et
// OpenDocument. L'atelier n'ajoute que ce qui manquait : le raisonnement.
//
// Car une décision s'écrit par morceaux, et ces morceaux se répètent :
//
//  - les **considérants de principe** — la règle de droit, la citation d'un
//    texte, la phrase qui conclut — se retrouvent d'une décision à l'autre,
//    presque mot pour mot. Ils sont donc rangés dans un répertoire, filtrables
//    par rubrique, par nature et par tags, et se **glissent dans la décision** :
//    on les dépose à l'endroit voulu, le texte s'y insère marqué comme
//    considérant (voir `considerants.js`) ;
//  - les **visas** et le **dispositif** — « Vu la saisine… », « Après avoir
//    entendu… », « DÉCIDE », les articles, la signature — suivent un ordre fixe
//    et se composent de formules prêtes (voir `formules-decision.js`) ;
//  - les **faits** et la **discussion** sont, eux, propres à l'affaire : c'est
//    au rédacteur de les écrire, et l'atelier lui laisse pour cela toute la
//    largeur, en lui laissant aussi sous les yeux ce qu'il doit vérifier — la
//    composition de la formation, les contrôles de régularité, la sanction
//    telle qu'elle sera notifiée.
//
// Les considérants insérés se numérotent d'un geste : les décisions rendues
// citent « le considérant 6 » en séance, et cette numérotation continue d'un
// intertitre à l'autre (« Sur la compétence… », « Sur la sanction… »). Les
// **articles du dispositif** se numérotent de même — « Article 1er », « Article
// 2 »… —, dans l'ordre du texte : les deux numérotations sont du **texte**
// (voir `numeroterConsiderants`, `numeroterArticles`), jamais des compteurs
// automatiques, où une citation déjà faite changerait de sens.

import { PICTO_RETRAIT_PREMIERE_LIGNE, PAS_RETRAIT, chipHtml, insertBlocksAtCursor, insertHtmlAtPoint, paletteHtml, reduireFantome, toolbarHtml } from "../editor.js";
import { computeDocumentParts, documentBody } from "../render.js";
import { labelOfToken, trameCatalog, variablesCatalog } from "../trame-variables.js";
import { documentTables } from "../grist-backend.js";
import { decisionsPour, regimeOf, sanctionsPour } from "../regimes.js";
import { NATURE_INTERLOCUTOIRE, estSusceptibleDeRecours } from "../schema.js";
import {
  DOMAINES, NATURES, RUBRIQUES, chercher, fragmentDe, listeTags,
  natureDe, repertoire, rubriqueDe, tagsDuRepertoire,
} from "../considerants.js";
import {
  documentDeDecision, estIntituleArticle, formulesPour, intituleArticle, MOTIF_INTITULE_ARTICLE,
  natureDeLaDecision, tramePourDecision,
} from "../formules-decision.js";
import { intervenantsDe } from "../formulas.js";
import { canSettings } from "../roles.js";
import * as ui from "../ui.js";
import { affaireName, affaireRef, echeanceInstruction, exportBar, outils } from "./common.js";
import { boutonDossier } from "../dossier.js";
import { controlesPanel } from "./affaires.js";
import { assemblageDocument, trameOptions } from "./documents.js";

const { esc, str, icon, panel, emptyState, button, fieldset, formGrid, alert, dl, tag, dateCell } = ui;

/* ------------------------------------------------------------------ */
/* Vues de l'atelier                                                   */
/* ------------------------------------------------------------------ */

const VUES = [
  { id: "redaction", label: "Rédaction", iconName: "edit-line" },
  { id: "balisage", label: "Balisage", iconName: "code-s-slash-line" },
  { id: "resultat", label: "Résultat", iconName: "file-text-line" },
];

const TONS_NATURE = { principe: "blue", texte: "grey", enchainement: "yellow" };

/** Une pastille d'état, comme celle du texte d'un document. */
function etiquette(label, kind) {
  return `<p class="fr-badge fr-badge--sm fr-badge--${kind} app-badge">${esc(label)}</p>`;
}

/* ------------------------------------------------------------------ */
/* Insertion d'un considérant                                          */
/* ------------------------------------------------------------------ */

/**
 * Insère un considérant dans le texte de la décision : à la position du
 * pointeur quand on l'y dépose, au curseur quand on clique « Insérer ».
 *
 * L'insertion est écrite au document **sans redessiner la page** (le curseur
 * resterait sinon planté au milieu du texte, et la page reviendrait en haut) :
 * c'est l'appelant qui enregistre ensuite le texte de l'éditeur, avec le reste
 * de l'application (`saveEditorContent`, dans app.js).
 *
 * Un considérant enregistré par l'établissement compte son usage — le
 * répertoire place les plus utilisés en tête —, et ce compteur s'écrit en
 * silence lui aussi.
 */
export function insererConsiderant(store, considerant, editor, point = null) {
  if (!editor || !considerant) return false;
  const html = fragmentDe(considerant);
  if (!html.trim()) return false;
  const insere = point
    ? insertHtmlAtPoint(editor, html, point.x, point.y)
    : insertBlocksAtCursor(editor, html);
  if (!insere) return false;
  if (considerant.ligne) {
    store.updateRowQuiet("Considerants", considerant.ligne, { Usage: (Number(considerant.usage) || 0) + 1 });
  }
  return true;
}

/** Insère un fragment (formule, intertitre) dans l'éditeur de la décision. */
export function insererFragment(editor, html) {
  if (!editor || !html) return false;
  return insertBlocksAtCursor(editor, html);
}

/**
 * Branche le dépôt d'un considérant sur l'éditeur de la décision.
 *
 * L'éditeur accepte déjà le dépôt des pastilles de variables (voir
 * `mountWysiwyg`, editor.js) : il faut donc que le nôtre se reconnaisse à son
 * type de données, `application/x-considerant`, pour ne pas être pris pour une
 * balise saisie à la main. Le repère de dépôt suit le pointeur pendant le
 * survol, ce qui montre où le texte tombera (voir `dragover`, editor.js), et
 * la carte se réduit à son titre pendant le geste pour ne pas le masquer.
 */
export function monterAtelierDecision(root, { store, onDirty, considerants = [] } = {}) {
  const editor = root?.querySelector("[data-considerants]");
  if (!editor) return;
  const parId = new Map(considerants.map((c) => [c.id, c]));

  // La carte du répertoire annonce ce qu'elle transporte : le type
  // `application/x-considerant`, avec l'identifiant du considérant. Le texte
  // brut est posé aussi, en repli — un dépôt hors de l'éditeur (barre d'adresse,
  // autre fenêtre) ne laisse alors qu'une trace anodine, jamais le texte du
  // considérant.
  root.addEventListener("dragstart", (event) => {
    const carte = event.target?.closest?.(".app-considere");
    if (!carte || !event.dataTransfer) return;
    const id = carte.dataset.considerant || "";
    event.dataTransfer.setData("application/x-considerant", id);
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "copy";
    // La carte est haute : la traîner telle quelle masquerait le point de
    // dépôt. On ne traîne que son titre (voir `reduireFantome`, editor.js).
    reduireFantome(event, carte.querySelector(".app-considere__titre")?.textContent.trim() || "Considérant");
  });

  editor.addEventListener("drop", (event) => {
    const id = event.dataTransfer?.getData("application/x-considerant");
    if (!id) return;
    event.preventDefault();
    const considerant = parId.get(id);
    if (!considerant) return;
    if (insererConsiderant(store, considerant, editor, { x: event.clientX, y: event.clientY })) {
      onDirty?.(editor);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Numérotation des considérants                                       */
/* ------------------------------------------------------------------ */

/**
 * Numérote les considérants, dans l'ordre du texte, d'un bout à l'autre de la
 * décision — la numérotation ne repart pas à chaque intertitre, comme dans les
 * décisions rendues.
 *
 * Le numéro est **du texte**, inséré au début du paragraphe : il survit ainsi à
 * l'impression, au PDF, au Word et à l'OpenDocument, où un compteur CSS ne
 * serait pas rendu. Un paragraphe vide n'est pas numéroté — un emplacement
 * laissé libre ne doit pas porter un numéro orphelin.
 *
 * Renvoie le nombre de considérants numérotés.
 */
export function numeroterConsiderants(editor) {
  if (!editor) return 0;
  const blocs = [...editor.querySelectorAll("p.considere")];
  let n = 0;
  for (const bloc of blocs) {
    retirerNumero(bloc);
    if (!bloc.textContent.trim()) continue;
    n += 1;
    bloc.insertBefore(bloc.ownerDocument.createTextNode(`${n}. `), bloc.firstChild);
  }
  return n;
}

/** Retire un numéro posé en tête d'un paragraphe, s'il y en a un. */
function retirerNumero(paragraphe) {
  const marcheur = paragraphe.ownerDocument.createTreeWalker(paragraphe, NodeFilter.SHOW_TEXT);
  let noeud = marcheur.nextNode();
  while (noeud && !String(noeud.nodeValue || "").trim()) noeud = marcheur.nextNode();
  if (!noeud) return;
  noeud.nodeValue = String(noeud.nodeValue).replace(/^\s*\d+\.\s+/, "");
}

/**
 * Pose — ou retire — le **retrait de première ligne** sur les considérants de la
 * décision : leur première ligne commence un centimètre plus loin, la suite
 * revient à la marge. C'est la présentation d'un considérant, et le geste la
 * donne à toute la décision d'un coup — la touche Tabulation, elle, la pose
 * paragraphe par paragraphe (voir `retraitTabulation`, editor.js).
 *
 * Le retrait est **écrit** sur chaque paragraphe, en centimètres, et non posé
 * par une règle de style : un texte exporté en Word ou en OpenDocument n'emporte
 * pas la feuille du document avec lui, et l'auteur doit pouvoir l'ôter d'un
 * considérant sans toucher aux autres.
 *
 * Renvoie `{ n, pose }` : le nombre de considérants touchés, et si le retrait a
 * été posé ou retiré.
 */
export function retraitConsiderants(editor) {
  const blocs = editor ? [...editor.querySelectorAll("p.considere")] : [];
  const pose = blocs.some((bloc) => !(parseFloat(bloc.style.textIndent) > 0));
  for (const bloc of blocs) {
    if (pose) bloc.style.setProperty("text-indent", PAS_RETRAIT);
    else bloc.style.removeProperty("text-indent");
    if (!bloc.getAttribute("style")) bloc.removeAttribute("style");
  }
  return { n: blocs.length, pose };
}

/* ------------------------------------------------------------------ */
/* Numérotation des articles du dispositif                             */
/* ------------------------------------------------------------------ */

/** Un paragraphe qui porte un intitulé d'article — marqué, ou reconnu au texte. */
function estArticle(paragraphe) {
  if (paragraphe.classList.contains("article")) return true;
  return estIntituleArticle(paragraphe.textContent);
}

/** Écrit l'intitulé d'un article, là où il se trouve : le `<u>` livré, ou le texte. */
function poserIntitule(paragraphe, intitule) {
  const souligne = paragraphe.querySelector("u");
  if (souligne && estIntituleArticle(souligne.textContent)) {
    souligne.textContent = intitule;
    return;
  }
  const marcheur = paragraphe.ownerDocument.createTreeWalker(paragraphe, NodeFilter.SHOW_TEXT);
  let noeud = marcheur.nextNode();
  while (noeud && !String(noeud.nodeValue || "").trim()) noeud = marcheur.nextNode();
  if (!noeud) return;
  noeud.nodeValue = String(noeud.nodeValue).replace(MOTIF_INTITULE_ARTICLE, `${intitule} `);
}

/**
 * Numérote les **articles du dispositif**, dans l'ordre du texte : « Article
 * 1er », « Article 2 », « Article 3 »… L'intitulé est **du texte**, comme le
 * numéro des considérants, et non un compteur de liste : il survit ainsi à
 * l'impression, au PDF, au Word et à l'OpenDocument, où un compteur CSS ne
 * serait pas rendu. Un paragraphe qui n'annonce pas d'article n'est pas touché —
 * une citation du code, plus haut dans le raisonnement, garde son texte.
 *
 * Renvoie le nombre d'articles numérotés.
 */
export function numeroterArticles(editor) {
  if (!editor) return 0;
  const blocs = [...editor.querySelectorAll("p")].filter(estArticle);
  let n = 0;
  for (const bloc of blocs) {
    n += 1;
    poserIntitule(bloc, intituleArticle(n));
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Répertoire des considérants                                         */
/* ------------------------------------------------------------------ */

/** Raccourcit un texte pour l'aperçu d'une carte du répertoire. */
function extrait(html, max = 240) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  const texte = (tpl.content.textContent || "").replace(/\s+/g, " ").trim();
  return texte.length > max ? `${texte.slice(0, max).trimEnd()}…` : texte;
}

/**
 * Une carte de considérant : ce qui le fait reconnaître d'un coup d'œil — sa
 * nature, sa rubrique, son titre et ses premiers mots —, ses tags, le geste
 * qui l'insère, et celui qui l'adapte (ou le corrige, s'il est déjà celui de
 * l'établissement). La carte est **glissable** : c'est le geste principal.
 */
function carteConsiderant(considerant, { avecRubrique = true, peutEcrire = true } = {}) {
  const nature = natureDe(considerant.nature);
  const rubrique = rubriqueDe(considerant.rubrique);
  const tags = considerant.tags.slice(0, 3);
  const reste = considerant.tags.length - tags.length;
  return `
<article class="app-considere" draggable="true" data-considerant="${esc(considerant.id)}"
  title="Glissez ce considérant dans le texte, ou cliquez « Insérer »">
  <header class="app-considere__tete">
    <span class="app-tag app-tag--${TONS_NATURE[considerant.nature] || "grey"}">${esc(nature?.label || considerant.nature)}</span>
    ${avecRubrique && rubrique ? `<button type="button" class="app-considere__rubrique" data-action="dec-intertitre" data-id="${esc(rubrique.id)}"
      title="Insérer l'intertitre « ${esc(rubrique.intertitre)} » à la tête de ce groupe">${esc(rubrique.label)}</button>` : ""}
    ${considerant.livre ? "" : `<span class="app-tag app-tag--green" title="Considérant de l'établissement">Établissement</span>`}
  </header>
  <p class="app-considere__titre">${esc(considerant.titre)}</p>
  <p class="app-considere__texte" title="${esc(extrait(considerant.texte, 900))}">${esc(extrait(considerant.texte, 200))}</p>
  ${considerant.source ? `<p class="app-considere__source" title="${esc(considerant.source)}">${icon("book-open-line", 'class="fr-mr-1v"')}<span class="app-considere__source-texte">${esc(considerant.source)}</span></p>` : ""}
  ${tags.length ? `<p class="app-considere__tags">
    ${tags.map((t) => `<span class="app-tag app-tag--grey">${esc(t)}</span>`).join("")}
    ${reste > 0 ? `<span class="app-tag app-tag--grey">+${reste}</span>` : ""}</p>` : ""}
  <footer class="app-considere__pied">
    <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-action="dec-considere-inserer" data-id="${esc(considerant.id)}">
      ${icon("add-line", 'class="fr-mr-1v"')}Insérer
    </button>
    ${considerant.livre
      ? (peutEcrire ? `<button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-action="dec-considere-adapter" data-id="${esc(considerant.id)}"
          title="Adapter ce considérant au texte de votre établissement — il remplacera alors le considérant livré">${icon("edit-line", 'class="fr-mr-1v"')}Adapter</button>` : "")
      : `<button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-action="dec-considere-editer" data-ligne="${considerant.ligne}">${icon("edit-line", 'class="fr-mr-1v"')}Modifier</button>
        ${ui.iconButton("delete-bin-line", { title: considerant.origine ? "Retirer l'adaptation : le considérant livré revient" : "Supprimer ce considérant", attrs: `data-delete="Considerants:${considerant.ligne}"` })}`}
    ${considerant.usage ? `<span class="app-considere__usage" title="Nombre d'insertions dans une décision">${considerant.usage}×</span>` : ""}
  </footer>
</article>`;
}

/**
 * Le répertoire des considérants : la recherche, les filtres et les cartes.
 *
 * C'est l'outil principal de l'atelier, et il reste ouvert. La recherche porte
 * sur le titre, le texte, la source et les tags ; la rubrique et la nature
 * resserrent encore le tri ; les tags se cliquent. Les filtres vivent dans
 * `state.filters` : ils survivent au redessin de la page, et l'on ne perd donc
 * pas sa recherche en insérant un considérant.
 */
export function outilConsiderants(store, state, { ouvert, considerants }) {
  const f = state.filters;
  const tables = documentTables();
  const tableAbsente = !!tables && !tables.includes("Considerants");
  const peutEcrire = !tableAbsente;
  const tagsActifs = Array.isArray(f.decConsiderantTags) ? f.decConsiderantTags : [];
  const filtres = {
    requete: f.decConsiderantQ || "",
    rubrique: f.decConsiderantRubrique || "",
    nature: f.decConsiderantNature || "",
    tags: tagsActifs,
  };
  const liste = chercher(considerants, filtres);
  const tousLesTags = tagsDuRepertoire(considerants).slice(0, 14);
  const parRubrique = new Map();
  for (const c of liste) {
    const cle = c.rubrique || "";
    if (!parRubrique.has(cle)) parRubrique.set(cle, []);
    parRubrique.get(cle).push(c);
  }
  const rang = (id) => {
    const i = RUBRIQUES.findIndex((r) => r.id === id);
    return i === -1 ? RUBRIQUES.length : i;
  };
  const groupes = [...parRubrique.entries()].sort((a, b) => rang(a[0]) - rang(b[0]));

  const corps = `
    <div class="app-considerants__filtres">
      <div class="app-search">
        <label class="fr-label" for="decConsiderantQ">Rechercher un considérant</label>
        <input class="fr-input" type="search" id="decConsiderantQ" data-filter="decConsiderantQ"
          value="${esc(filtres.requete)}" placeholder="Motif, texte cité, tag…">
      </div>
      <div class="app-considerants__selects">
        <div class="fr-select-group">
          <label class="fr-sr-only" for="decConsiderantRubrique">Rubrique</label>
          <select class="fr-select" id="decConsiderantRubrique" data-filter="decConsiderantRubrique"
            title="Filtrer par rubrique du plan">
            <option value="">Toutes les rubriques</option>
            ${RUBRIQUES.map((r) => `<option value="${esc(r.id)}" ${filtres.rubrique === r.id ? "selected" : ""}>${esc(r.label)}</option>`).join("")}
          </select>
        </div>
        <div class="fr-select-group">
          <label class="fr-sr-only" for="decConsiderantNature">Nature</label>
          <select class="fr-select" id="decConsiderantNature" data-filter="decConsiderantNature"
            title="Filtrer par nature">
            <option value="">Toutes les natures</option>
            ${NATURES.map((n) => `<option value="${esc(n.id)}" ${filtres.nature === n.id ? "selected" : ""}>${esc(n.label)}</option>`).join("")}
          </select>
        </div>
      </div>
      ${tousLesTags.length ? `<div class="app-considerants__tags" role="group" aria-label="Filtrer par tag">
        ${tousLesTags.map(({ tag: t, n }) => `<button type="button" class="app-tag app-tag--${tagsActifs.includes(t) ? "blue" : "grey"} app-considerants__tag"
          data-action="dec-considere-tag" data-tag="${esc(t)}" aria-pressed="${tagsActifs.includes(t)}">${esc(t)} <span class="app-considerants__compte">${n}</span></button>`).join("")}
      </div>` : ""}
    </div>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      ${liste.length} considérant${liste.length > 1 ? "s" : ""} sur ${considerants.length} — glissez une carte
      dans le texte, ou cliquez « Insérer ».
    </p>
    <div class="app-considerants__liste" data-scroll="decConsiderants">
      ${liste.length ? groupes.map(([rubriqueId, items]) => {
        const rubrique = rubriqueDe(rubriqueId);
        return `
        <section class="app-considerants__groupe">
          <h3 class="app-considerants__groupe-titre">
            <span>${esc(rubrique?.label || "Sans rubrique")}</span>
            ${rubrique?.intertitre ? `<button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-action="dec-intertitre" data-id="${esc(rubriqueId)}"
              title="Insérer l'intertitre dans le texte">Insérer l'intertitre</button>` : ""}
          </h3>
          ${items.map((c) => carteConsiderant(c, { avecRubrique: false, peutEcrire })).join("")}
        </section>`;
      }).join("") : emptyState(
        "Aucun considérant ne correspond à cette recherche.",
        { iconName: "search-line" },
      )}
    </div>
    <div class="fr-mt-2w">
      ${tableAbsente
        ? alert("info", "Répertoire de l'établissement",
          "La table « Considérants » n'existe pas encore dans ce document : les considérants livrés ici sont "
          + "utilisables tels quels. Créez la table pour écrire et adapter les vôtres — ils primeront alors "
          + "sur ceux qui sont livrés.",
          button("Créer la table « Considérants »", {
            variant: "secondary", size: "sm", iconName: "add-line", action: "dec-considerants-table",
          }))
        : button("Écrire un considérant", { variant: "secondary", size: "sm", iconName: "add-line", action: "dec-considere-nouveau" })}
    </div>`;

  return outils({
    titre: "Considérants de principe",
    iconName: "article-line",
    ouvert,
    action: "dec-considerants",
    classe: "app-outils--considerants",
    body: corps,
  });
}

/* ------------------------------------------------------------------ */
/* Formules : visas et dispositif                                      */
/* ------------------------------------------------------------------ */

function outilFormules(store, state, decision, { ouvert }) {
  const groupes = formulesPour(store, decision);
  const corps = `
    <p class="fr-hint-text fr-mt-0 fr-mb-2w">
      Les pièces qui encadrent le raisonnement, prêtes à insérer au curseur. Celles qui viennent en tête
      conviennent à cette décision ; celles qui suivent, en gris, visent un autre code ou une autre nature
      de décision.
    </p>
    ${groupes.map((g) => `
      <details class="app-formules" ${g.id === "visas" ? "open" : ""}>
        <summary class="app-formules__titre">${icon(g.iconName, 'class="fr-mr-1v"')}${esc(g.label)}</summary>
        <p class="fr-hint-text fr-mt-1v fr-mb-1w">${esc(g.hint)}</p>
        <div class="app-formules__liste">
          ${g.formules.map((f) => `<button type="button" class="app-formule${f.applicable ? "" : " app-formule--hors"}"
            data-action="dec-formule-inserer" data-id="${esc(f.id)}"
            title="${esc(extrait(f.html, 160))}">${esc(f.label)}</button>`).join("")}
        </div>
      </details>`).join("")}`;

  return outils({
    titre: "Visas et dispositif",
    iconName: "list-check",
    ouvert,
    action: "dec-formules",
    classe: "app-outils--formules",
    body: corps,
  });
}

/* ------------------------------------------------------------------ */
/* Panneaux de la décision                                             */
/* ------------------------------------------------------------------ */

/** Les champs structurés de la décision : sanction, dates, durées. */
function outilChamps(store, state, decision, { ouvert }) {
  const ctx = state.ctx;
  const affaire = store.byId("Affaires", decision.Affaire);
  const section = affaire?.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const regime = regimeOf(section);
  const interlocutoire = natureDeLaDecision(decision) === NATURE_INTERLOCUTOIRE;
  const corps = `
    ${fieldset("Sanction et texte retenus", formGrid("Decisions", interlocutoire
      ? ["Nature", "Decision", "Motivation"]
      : ["Nature", "Sanction", "Decision", "Motivation"], ctx, decision, {
      store, single: true,
      rowsFor: { Sanction: sanctionsPour(store.db, regime, section) },
      choicesFor: { Decision: decisionsPour(store.db, regime, section, { nature: interlocutoire ? NATURE_INTERLOCUTOIRE : "" }) },
    }))}
    ${fieldset("Délibéré et notification", formGrid("Decisions",
      interlocutoire
        ? ["Date_du_delibere", "Date_de_notification", "Mode_de_notification", "Date_butoir_instruction"]
        : ["Date_du_delibere", "Date_de_notification", "Mode_de_notification",
          "Duree_totale_d_exclusion_mois_", "Duree_d_exclusion_sursis_", "Sursis_"],
      ctx, decision, { store }))}
    <p class="fr-hint-text fr-mb-0">
      Ces champs nourrissent les balises du texte (<code>{{Decision}}.Libelle_decision</code>…), le registre
      des décisions et la notification. La <strong>motivation</strong>, elle, est le texte que vous écrivez
      dans l'atelier.
    </p>`;

  return outils({
    titre: "Champs de la décision",
    iconName: "scales-3-line",
    ouvert,
    action: "dec-champs",
    classe: "app-outils--champs",
    body: corps,
  });
}

/**
 * Les **effets** de la décision : terme de la sanction, statut, délai de
 * recours, délai de traitement. Ce sont des valeurs **calculées** à partir du
 * délibéré, de la sanction et des durées saisies dans « Champs de la
 * décision ». Elles se lisaient autrefois dans un panneau déplié sous le
 * registre des décisions ; elles suivent désormais la décision dans son
 * atelier, et le registre reste court.
 */
function outilEffets(store, state, decision, { ouvert }) {
  const ctx = state.ctx;
  const enCours = ctx.v("Decisions", decision, "En_cours_");
  const delai = ctx.v("Decisions", decision, "Delai_de_traitement");
  const terme = ctx.v("Decisions", decision, "Terme_de_la_sanction");
  const recourable = estSusceptibleDeRecours(decision);
  const interlocutoire = natureDeLaDecision(decision) === NATURE_INTERLOCUTOIRE;
  const corps = interlocutoire
    ? dl([
        ["Nature", tag("Décision interlocutoire", "grey"), true],
        ["Texte retenu", esc(str(ctx.v("Decisions", decision, "Libelle_decision"))) || "—", true],
        ["Date du délibéré", dateCell(decision.Date_du_delibere), true],
        ["Recours", "Aucun — une décision avant dire droit n'est pas susceptible de recours", true],
      ])
    : dl([
        ["Terme de la sanction", terme === "9999-12-31"
          ? tag("Définitive", "yellow")
          : (dateCell(terme) || "—"), true],
        ["Statut", enCours ? tag("En cours d'effet", "warning") : tag("Terminée", "success"), true],
        ["Recours", recourable
          ? (dateCell(ctx.v("Decisions", decision, "Recours_limite_le"))
            ? `Possible jusqu'au ${dateCell(ctx.v("Decisions", decision, "Recours_limite_le"))}`
            : "Aucun délai calculé — date d'effet manquante")
          : "Aucun — décision insusceptible de recours", true],
        ["Délai de traitement", delai === null || delai === undefined ? "—" : `${delai} jour(s)`, true],
        ["Date de saisine", dateCell(decision.Date_de_saisine), true],
      ]);
  return outils({
    titre: "Effets de la décision",
    iconName: "time-line",
    ouvert,
    action: "dec-effets",
    classe: "app-outils--effets",
    body: `${corps}
      <p class="fr-hint-text fr-mb-0">
        ${icon("information-line", 'class="fr-mr-1v"')}Valeurs calculées : terme de la sanction, statut,
        délai de recours et délai de traitement découlent du délibéré et des durées.
      </p>`,
  });
}

/** La formation appelée à juger, en lecture : elle se compose sur l'affaire. */
function outilFormation(store, state, affaire, { ouvert }) {
  const ctx = state.ctx;
  const intervenants = affaire ? intervenantsDe(ctx, affaire) : [];
  const corps = intervenants.length
    ? `<ul class="app-liste-simple">
        ${intervenants.map((x) => `<li><strong>${esc(x.nom || "—")}</strong> — ${esc(x.role || "Membre de la formation")}${x.horsSection ? ' <span class="app-tag app-tag--grey">Hors section</span>' : ""}</li>`).join("")}
      </ul>
      <p class="fr-hint-text fr-mb-0">
        ${icon("information-line", 'class="fr-mr-1v"')}La composition se règle sur l'affaire, dans l'onglet
        qui lui est consacré : elle n'est rappelée ici que pour être vérifiée avant d'écrire « la formation
        de jugement ».
      </p>`
    : alert("warning", "Formation non composée",
      "Aucun intervenant n'est désigné pour cette affaire : la composition se règle depuis l'affaire, "
      + "avant la séance.");

  return outils({
    titre: "Composition de la formation",
    iconName: "group-line",
    ouvert,
    action: "dec-composition",
    classe: "app-outils--formation",
    body: corps,
  });
}

/* ------------------------------------------------------------------ */
/* L'atelier                                                           */
/* ------------------------------------------------------------------ */

/** L'espace de rédaction d'une décision, quand elle a déjà son document. */
function atelier(store, state, decision, doc, considerants) {
  const ctx = state.ctx;
  const affaire = store.byId("Affaires", decision.Affaire);
  const section = affaire?.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const template = doc.Template ? store.byId("Trames", doc.Template) : null;
  const corps = documentBody(doc, template);
  // Seule une décision **définitive** peut s'exporter sous forme anonyme : un
  // acte qui règle la marche de l'instance ne se publie pas comme un jugement
  // (voir `anonymat.js`).
  const anonymisable = natureDeLaDecision(decision) !== NATURE_INTERLOCUTOIRE;
  const propre = String(doc.Contenu ?? "").trim().length > 0
    || String(doc.Feuille_de_style ?? "").trim().length > 0;
  const catalog = trameCatalog(store.db, doc);
  // Comme dans l'espace de rédaction d'un document, la palette réunit les
  // variables `{…}` de la feuille de style — celles du chapeau et de la
  // signature — et les balises de données `{{…}}` de la décision.
  const catalogueFeuille = variablesCatalog(store.db, doc);
  const catalogue = {
    groups: [
      ...catalogueFeuille.groups.map((g) => ({ ...g, label: `Feuille de style — ${g.label}` })),
      ...catalog.groups,
    ],
    index: { ...catalogueFeuille.index, ...catalog.index },
  };
  const chipFor = (token) => {
    const info = catalogue.index[token];
    return chipHtml(token, info?.label || labelOfToken(token), info?.sample || "");
  };
  const nomTrame = template ? str(ctx.v("Trames", template, "Nom_complet")) : "";
  // Comme dans l'espace de rédaction d'un document : la trame est la source du
  // texte et de ce qui l'entoure, et l'on peut aller la corriger pour toutes ses
  // pièces quand l'imprécision n'est pas propre à celle-ci.
  const lienTrame = template && canSettings(state)
    ? ` · <a href="#reglages/trames/${template.id}" data-nav="reglages/trames/${template.id}">corriger la trame</a>`
    : "";

  let parts = null;
  let erreur = "";
  try {
    parts = computeDocumentParts(store.db, doc);
  } catch (err) {
    erreur = err.message;
  }

  const vue = VUES.some((v) => v.id === state.tabs.decVue) ? state.tabs.decVue : VUES[0].id;
  const ouvert = (cle, defaut = false) =>
    (state.tabs[cle] === undefined ? defaut : state.tabs[cle] !== "replie");
  const nOutil = (cle, defaut = false) => (ouvert(cle, defaut) ? 1 : 0);
  const nbOuverts = nOutil("decConsiderants", true) + nOutil("decFormules") + nOutil("decChamps")
    + nOutil("decEffets") + nOutil("decComposition") + nOutil("decVariables") + nOutil("decParametres") + nOutil("decControles");

  // Le texte de la décision s'écrit dans le **document assemblé** : ce que la
  // trame apporte autour — le chapeau, la signature, le pied de page — est là
  // aussi, et se corrige ici pour cette seule décision (voir
  // `assemblageDocument`, views/documents.js). La zone du texte garde l'identité
  // de l'atelier — `decEditor`, marquée `data-considerants` —, sur laquelle le
  // répertoire des considérants et les formules s'insèrent.
  const ecriture = `
      ${toolbarHtml({ source: false })}
      ${assemblageDocument({
        store, doc, template, corps, chipFor, nomTrame, entete: parts ? parts.enTete : "",
        texte: { id: "decEditor", label: "Texte de la décision", extra: 'data-considerants="1"' },
      })}
      <div class="app-doc__rendu">
        ${erreur ? alert("error", "La décision n'a pas pu être générée", erreur) : ""}
        <div class="app-doc__rendu-tete">
          <p class="fr-text--sm fr-mb-0">
            ${icon("printer-line", 'class="fr-mr-1v"')}Aperçu avant impression<span id="docPages" class="app-doc-pages" hidden></span>
          </p>
          <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-tab="decVue:redaction">
            ${icon("edit-line", 'class="fr-mr-1v"')}Revenir au texte
          </button>
        </div>
        <div class="app-doc-preview">
          <iframe id="docPreview" title="Aperçu de la décision" srcdoc="${esc(parts ? parts.html : "")}"></iframe>
        </div>
        <p class="fr-hint-text fr-mt-1w fr-mb-0">
          ${nomTrame ? `Trame : ${esc(nomTrame)}. ` : ""}La feuille A4 de l'aperçu a la géométrie de
          l'impression — marges de 2 cm, pied de page compris — et les fichiers exportés la reprennent à l'identique.
        </p>
        ${exportBar({ printAction: "print-document", scope: "document", anonymisable })}
      </div>`;

  const hints = {
    redaction: "La décision s'écrit dans son document, d'une seule feuille : le raisonnement, et, autour de lui,"
      + " ce que la trame apporte — le chapeau, la signature, le pied de page. Le corriger ici n'écrit que pour"
      + " cette décision, jamais la trame ni les autres pièces. "
      + (propre
        ? "Ce document ne suit plus la trame."
        : "Il part de la trame ; la première modification le rend propre à cette décision.")
      + " Les considérants se glissent depuis le répertoire, à droite : le texte s'insère là où vous le"
      + " déposez. « Numéroter les considérants » pose 1., 2., 3.… dans l'ordre du texte, sans repartir à"
      + " chaque intertitre, et « Numéroter les articles » pose « Article 1er », « Article 2 »… devant les"
      + " articles du dispositif, dans le même ordre. « Retrait de première ligne » donne aux considérants"
      + " la présentation qui leur revient : première ligne en retrait d'un centimètre, suite du texte à la"
      + " marge.",
    balisage: "Le texte et ses balises, tels qu'ils seront enregistrés. La palette des variables y insère une balise au curseur.",
    resultat: "La décision telle qu'elle sera imprimée et notifiée, découpée en pages : c'est ici qu'on la relit et qu'on l'exporte.",
  };

  return `
<div class="app-wysiwyg app-doc app-doc--decision app-doc--${vue}" data-wysiwyg data-chips="columns" data-wysiwyg-view="${vue}">
  <section class="fr-panel app-doc__atelier">
    <div class="fr-panel__header">
      <div class="fr-panel__heading">
        <h2 class="fr-h6 fr-mb-0">${icon("quill-pen-line", 'class="fr-mr-1v"')}Texte de la décision</h2>
        <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">${template
          ? `Rédigé à partir de la trame « ${esc(nomTrame)} », modifiable librement${lienTrame}`
          : "Le texte de la décision — il s'écrit ici"}</p>
      </div>
      <div class="fr-panel__actions">
        ${etiquette(propre ? "Propre à ce document" : "Suit la trame", propre ? "success" : "info")}
        ${button("Numéroter les considérants", {
          variant: "tertiary", size: "sm", iconName: "list-ordered", action: "dec-numeroter",
          title: "Poser les numéros 1., 2., 3.… devant les considérants, dans l'ordre du texte",
        })}
        ${button("Numéroter les articles", {
          variant: "tertiary", size: "sm", iconName: "list-ordered", action: "dec-numeroter-articles",
          title: "Poser « Article 1er », « Article 2 »… devant les articles du dispositif, dans l'ordre du texte",
        })}
        ${button("Retrait de première ligne", {
          variant: "tertiary", size: "sm", iconName: PICTO_RETRAIT_PREMIERE_LIGNE, action: "dec-retrait",
          title: "Donner aux considérants leur retrait de première ligne — première ligne à un centimètre, "
            + "suite du texte à la marge. Un second clic le retire de tous.",
        })}
        ${button("Composer le squelette", {
          variant: "tertiary-no-outline", size: "sm", iconName: "magic-line", action: "dec-squelette",
          title: "Remplacer le texte par un squelette de décision : visas, audience, DÉCIDE, articles",
        })}
      </div>
    </div>
    <div class="fr-panel__body">
      ${ui.tabs({
        id: "decVue",
        items: VUES.map((v) => ({ id: v.id, label: v.label, iconName: v.iconName })),
        active: vue,
        label: "Vues de l'atelier de rédaction",
      })}
      ${ui.tabPanel({ id: "decVue", tab: vue, contenu: `${ecriture}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">${esc(hints[vue])}</p>` })}
    </div>
  </section>
  <aside class="app-doc__outils${nbOuverts ? "" : " app-doc__outils--replie"}">
    ${outilConsiderants(store, state, { ouvert: ouvert("decConsiderants", true), considerants })}
    ${outilFormules(store, state, decision, { ouvert: ouvert("decFormules") })}
    ${outilChamps(store, state, decision, { ouvert: ouvert("decChamps") })}
    ${outilEffets(store, state, decision, { ouvert: ouvert("decEffets") })}
    ${outilFormation(store, state, affaire, { ouvert: ouvert("decComposition") })}
    ${affaire ? outils({
      titre: "Contrôles de régularité",
      iconName: "shield-line",
      ouvert: ouvert("decControles"),
      action: "dec-controles",
      classe: "app-outils--controles",
      body: controlesPanel(store, state, affaire) || `<p class="fr-hint-text fr-mb-0">Aucun contrôle disponible.</p>`,
    }) : ""}
    ${template ? outils({
      titre: "Variables",
      iconName: "braces-line",
      ouvert: ouvert("decVariables"),
      action: "dec-variables",
      classe: "app-outils--variables",
      body: paletteHtml(catalogue, {
        id: "decPalette",
        label: "Insérer une variable",
        hint: "Glissez une variable dans le texte — celle de la zone où vous écrivez —, ou cliquez pour l'insérer au curseur.",
      }),
    }) : ""}
    ${outils({
      titre: "Trame et date",
      iconName: "settings-5-line",
      ouvert: ouvert("decParametres"),
      action: "dec-parametres",
      classe: "app-outils--parametres",
      body: `
        <div class="fr-select-group">
          <label class="fr-label" for="decTemplate">Trame de la décision</label>
          <select class="fr-select" id="decTemplate" aria-describedby="decTemplate-desc" data-bind="Generateur|Template" data-record="${doc.id}">
            <option value="">— Choisir une trame —</option>
            ${trameOptions(store, section).map((x) => `<option value="${x.id}" ${Number(doc.Template) === x.id ? "selected" : ""}>${esc(str(ctx.v("Trames", x, "Nom_complet")))}</option>`).join("")}
          </select>
          <p class="fr-hint-text app-desc" id="decTemplate-desc">Les trames proposées correspondent au public de la section${section ? ` « ${esc(str(section.Public))} »` : ""}.</p>
        </div>
        ${formGrid("Generateur", ["Date"], ctx, doc, { store })}
        <p class="fr-hint-text fr-mb-0">
          La trame fournit l'en-tête, la feuille de style et le pied de page ; le texte est celui que vous
          écrivez ici. Changer de trame ne réécrit pas le texte déjà écrit.
        </p>`,
    })}
  </aside>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Vue                                                                 */
/* ------------------------------------------------------------------ */

/**
 * L'atelier de rédaction d'une décision : le fil d'Ariane, la tête de page, et
 * l'espace lui-même. Sans document lié, la décision n'a pas encore de texte :
 * l'atelier propose de le créer — c'est un geste, et le texte s'ouvre aussitôt.
 */
export function viewDecisionRedaction(store, state, decision) {
  const ctx = state.ctx;
  const affaire = store.byId("Affaires", decision.Affaire);
  const interlocutoire = natureDeLaDecision(decision) === NATURE_INTERLOCUTOIRE;
  const doc = documentDeDecision(store, decision);
  const considerants = repertoire(store.db);
  if (doc) state.sel.Generateur = doc.id;

  const fil = `
<div class="app-breadcrumb">
  <a href="#decisions" data-nav="decisions">${icon("arrow-left-line", 'class="fr-mr-1v"')}Registre des décisions</a>
  ${affaire ? `<span aria-hidden="true">›</span><span>${esc(affaireRef(ctx, affaire))} — ${esc(affaireName(ctx, affaire))}</span>` : ""}
</div>`;

  const head = `
${fil}
<div class="app-page-head">
  <div>
    <p class="app-kicker">${interlocutoire ? "Décision avant dire droit" : "Décision de la formation de jugement"}</p>
    <h1 class="fr-h3">Rédaction de la décision</h1>
    <p class="app-page-head__sub">${affaire
      ? `Affaire n° ${esc(affaireRef(ctx, affaire))} — ${esc(affaireName(ctx, affaire))}. Le raisonnement s'écrit ici, pièce par pièce : visas, considérants, dispositif.`
      : "Cette décision n'est rattachée à aucune affaire."}</p>
  </div>
  <div class="app-page-head__actions">
    ${affaire ? boutonDossier(affaire, { variant: "tertiary", size: "sm" }) : ""}
    ${affaire ? button("Ouvrir l'affaire", {
      variant: "tertiary", size: "sm", iconName: "folder-2-line",
      attrs: `data-open="affaires" data-select-table="Affaires" data-select="${affaire.id}" data-open-tab="decision"`,
    }) : ""}
    ${doc ? button("Ouvrir le document", {
      variant: "tertiary-no-outline", size: "sm", iconName: "printer-line",
      attrs: `data-nav="documents/${doc.id}"`,
    }) : ""}
  </div>
</div>
${interlocutoire ? echeanceInstruction(store, state, affaire, { compact: true }) : ""}`;

  if (doc) return `${head}${atelier(store, state, decision, doc, considerants)}`;

  const trame = tramePourDecision(store, decision);
  return `${head}
${panel("Le texte de la décision", `
  <p class="fr-text--sm">
    Une décision se rédige dans un texte : c'est lui qui porte les visas, le raisonnement et le dispositif,
    et c'est de lui que sortent l'impression, le PDF, le Word et l'OpenDocument. Ce texte n'existe pas encore
    pour cette décision.
  </p>
  <p class="fr-text--sm fr-mb-2w">
    ${trame
      ? `Il sera créé à partir de la trame « ${esc(str(ctx.v("Trames", trame, "Nom_complet")))} » : en-tête, feuille de style et pied de page compris.`
      : "Aucune trame de décision n'est installée pour cette section : le texte partira d'un squelette — visas, audience, DÉCIDE, articles — que vous complétez ; la signature est portée par la feuille de style."}
  </p>
  ${button("Créer le texte de la décision", { variant: "primary", iconName: "add-line", action: "dec-document-creer" })}
`, { iconName: "quill-pen-line", subtitle: "Un document sera lié à cette décision" })}`;
}

/* ------------------------------------------------------------------ */
/* Fenêtre d'écriture d'un considérant                                 */
/* ------------------------------------------------------------------ */

/**
 * Le texte d'un considérant, tel qu'il s'écrit dans la fenêtre.
 *
 * Le répertoire garde du HTML simple — des paragraphes, quelques passages en
 * gras ou en italique — parce que c'est ce HTML que la décision insère. Un
 * texte écrit sans balise n'est donc pas refusé : ses paragraphes sont
 * reconnus aux lignes vides, et enveloppés dans `<p>`.
 */
export function texteEnHtml(brut) {
  const texte = String(brut ?? "").trim();
  if (!texte) return "";
  if (/<[a-zA-Z/]/.test(texte)) return texte;
  return texte
    .split(/\n\s*\n/)
    .map((bloc) => bloc.trim())
    .filter(Boolean)
    .map((bloc) => `<p>${esc(bloc).replace(/\n/g, " ")}</p>`)
    .join("");
}

/**
 * La fenêtre qui écrit ou adapte un considérant du répertoire de
 * l'établissement.
 *
 * Un considérant livré s'**adapte** : la fenêtre s'ouvre remplie de son texte,
 * et l'enregistrement crée une ligne qui déclare son `Origine` — le considérant
 * livré s'efface alors du répertoire au profit de celui de l'établissement, et
 * le retirer de la table le fait revenir.
 */
export function considerantModal({ considerant = null, livre = null } = {}) {
  const source = considerant || livre || {};
  const rubrique = rubriqueDe(source.rubrique)?.label || "";
  const nature = natureDe(source.nature)?.label || NATURES[0].label;
  const domaine = DOMAINES.find((d) => d.id === source.domaine)?.label || "";
  const lire = (id) => esc(String(source[id] ?? ""));

  const corps = `
  <div class="fr-grid-row fr-grid-row--gutters">
    <div class="fr-col-12">
      <div class="fr-input-group">
        <label class="fr-label" for="consTitre">Titre</label>
        <input class="fr-input" type="text" id="consTitre" aria-describedby="consTitre-desc" value="${lire("titre")}">
        <p class="fr-hint-text app-desc" id="consTitre-desc">Ce qui fait retrouver le considérant dans le répertoire. Il ne paraît pas dans la décision.</p>
      </div>
    </div>
    <div class="fr-col-12 fr-col-md-6">
      <div class="fr-select-group">
        <label class="fr-label" for="consRubrique">Rubrique</label>
        <select class="fr-select" id="consRubrique">
          ${RUBRIQUES.map((r) => `<option value="${esc(r.label)}" ${rubrique === r.label ? "selected" : ""}>${esc(r.label)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="fr-col-12 fr-col-md-6">
      <div class="fr-select-group">
        <label class="fr-label" for="consNature">Nature</label>
        <select class="fr-select" id="consNature">
          ${NATURES.map((n) => `<option value="${esc(n.label)}" ${nature === n.label ? "selected" : ""}>${esc(n.label)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="fr-col-12">
      <div class="fr-input-group">
        <label class="fr-label" for="consTexte">Texte du considérant</label>
        <textarea class="fr-input" id="consTexte" aria-describedby="consTexte-desc" rows="10">${lire("texte")}</textarea>
        <p class="fr-hint-text app-desc" id="consTexte-desc">Ce que la décision recevra. Les crochets […] marquent ce que le rédacteur complète.
          Le gras s'écrit &lt;strong&gt;…&lt;/strong&gt;, le soulignement &lt;u&gt;…&lt;/u&gt; ; une ligne vide sépare deux paragraphes.</p>
      </div>
    </div>
    <div class="fr-col-12 fr-col-md-6">
      <div class="fr-input-group">
        <label class="fr-label" for="consTags">Tags</label>
        <input class="fr-input" type="text" id="consTags" aria-describedby="consTags-desc" value="${esc((source.tags || []).join(", "))}">
        <p class="fr-hint-text app-desc" id="consTags-desc">Séparés par des virgules : fraude, examen, sursis…</p>
      </div>
    </div>
    <div class="fr-col-12 fr-col-md-6">
      <div class="fr-select-group">
        <label class="fr-label" for="consDomaine">Domaine</label>
        <select class="fr-select" id="consDomaine">
          <option value="">—</option>
          ${DOMAINES.map((d) => `<option value="${esc(d.label)}" ${domaine === d.label ? "selected" : ""}>${esc(d.label)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="fr-col-12">
      <div class="fr-input-group">
        <label class="fr-label" for="consSource">Source</label>
        <input class="fr-input" type="text" id="consSource" aria-describedby="consSource-desc" value="${lire("source")}">
        <p class="fr-hint-text app-desc" id="consSource-desc">Le texte ou la jurisprudence cités. Laissez vide si elle n'est pas connue : elle n'est jamais inventée.</p>
      </div>
    </div>
  </div>
  ${livre ? alert("info", "Considérant livré avec l'outil",
    "Vous enregistrez ici votre propre rédaction : le considérant livré s'effacera du répertoire tant que celle-ci existe. La retirer fait revenir le texte livré.") : ""}
  <input type="hidden" id="consLigne" value="${considerant?.ligne ?? ""}">
  <input type="hidden" id="consOrigine" value="${esc(source.origine || livre?.id || "")}">`;

  return ui.dialog({
    id: "considerantDialog",
    title: livre ? "Adapter un considérant de principe" : (considerant ? "Modifier le considérant" : "Nouveau considérant de principe"),
    subtitle: "Le répertoire de l'établissement prime sur les considérants livrés",
    body: corps,
    footer: `${ui.button("Annuler", { variant: "secondary", action: "close-dialog" })}
      ${ui.button("Enregistrer", { variant: "primary", iconName: "save-line", action: "dec-considere-enregistrer" })}`,
    size: "lg",
  });
}

/** Ce que la fenêtre d'un considérant rend, une fois remplie. */
export function considerantDepuisFormulaire() {
  const val = (id) => document.getElementById(id)?.value ?? "";
  return {
    ligne: Number(val("consLigne")) || null,
    data: {
      Titre: val("consTitre").trim(),
      Rubrique: val("consRubrique").trim(),
      Nature: val("consNature").trim(),
      Texte: texteEnHtml(val("consTexte")),
      Tags: listeTags(val("consTags")).join(", "),
      Domaine: val("consDomaine").trim(),
      Source: val("consSource").trim(),
      Origine: val("consOrigine").trim(),
    },
  };
}
