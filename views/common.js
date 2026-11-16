// Helpers partagés par les vues.

import { NAV } from "../schema.js";
import { butoirInstruction, formatDateFr, toDate } from "../formulas.js";
import * as ui from "../ui.js";

const { esc, str, icon, badge, dateCell, panel, emptyState, button } = ui;

/* ------------------------------------------------------------------ */
/* Échéance d'instruction                                              */
/* ------------------------------------------------------------------ */

/**
 * L'échéance d'instruction d'une affaire, en bandeau.
 *
 * Une instruction disciplinaire dure un temps compté — deux mois devant une
 * section compétente à l'égard des usagers, quatre mois devant une section
 * d'enseignants-chercheurs —, **à compter de la décision de désignation** qui
 * l'ouvre : celle des rapporteurs, ou celle de la commission d'instruction.
 * Ce délai se **prolonge** : les documents relatifs à l'instruction (la
 * désignation des rapporteurs, un complément ou un supplément d'instruction)
 * et les décisions ultérieures en fixent une nouvelle date butoir
 * (`butoirInstruction`, formulas.js).
 *
 * Le bandeau est donc mis partout où l'instruction se conduit : en tête de la
 * synthèse de l'affaire, dans son onglet « Documents », et à la rédaction de
 * chaque document qui touche à l'instruction. Il dit la date, les jours
 * restants, et **ce qui a fixé l'échéance** — sans quoi une prolongation
 * passerait pour une échéance de la procédure. Il ne s'affiche pas lorsque
 * l'affaire n'a pas d'instruction à conduire ; il annonce en revanche que
 * l'instruction **n'est pas ouverte** tant que la désignation manque, puisque
 * c'est elle, et non la saisine, qui fait courir le délai.
 */
export function echeanceInstruction(store, state, affaire, { compact = false } = {}) {
  const ctx = state?.ctx;
  const b = ctx ? butoirInstruction(ctx, affaire) : null;
  if (!b) return "";
  const classe = `app-echeance${compact ? " app-echeance--compact" : ""}`;

  // Le délai n'a pas commencé : la désignation qui l'ouvre n'a pas été
  // produite. On le dit, et l'on mène à l'onglet « Documents » de l'affaire,
  // d'où la pièce se crée avec la trame de désignation.
  if (!b.butoir) {
    const produire = affaire
      ? `<p class="app-echeance__detail fr-mt-1w fr-mb-0">${button("Produire la décision de désignation", {
        variant: "tertiary", size: "sm", iconName: "add-line",
        attrs: `data-open="affaires" data-select-table="Affaires" data-select="${affaire.id}" data-open-tab="documents"`,
      })}</p>`
      : "";
    return `
<div class="${classe} app-echeance--blue">
  <span class="app-echeance__icone">${icon("timer-line")}</span>
  <div class="app-echeance__corps">
    <p class="app-echeance__titre">Instruction non ouverte</p>
    <p class="app-echeance__detail">
      Le délai d'instruction court à compter de la <strong>décision de désignation ${esc(b.delai.designation)}</strong> :
      tant qu'elle n'est pas produite, il n'y a pas de terme à annoncer.
    </p>
    ${produire}
  </div>
</div>`;
  }

  const jours = b.jours;
  const ton = tonEcheance(jours);
  const reste = resteEcheance(jours);
  const origine = b.origine || null;
  const trame = origine?.document ? ctx.v("Trames", origine.trame, "Nom_complet") : "";
  const parQuoi = origine?.document
    ? `par le document « ${esc(str(trame))} »`
    : origine?.decision
      ? `par la décision du ${esc(formatDateFr(origine.decision.Date_de_notification || origine.decision.Date_du_delibere))}`
      : "par une décision ultérieure";
  // D'où le délai se décompte : la décision de désignation qui a ouvert
  // l'instruction, dont la date est le point de départ.
  const ouverture = b.ouverture;
  const depuis = ouverture
    ? ` Décompté depuis la décision de désignation du ${esc(formatDateFr(ouverture.document.Date))}`
      + ` — <a href="#documents/${ouverture.document.id}" data-nav="documents/${ouverture.document.id}">voir la décision</a>.`
    : "";
  // Ce qui fixe l'échéance : la procédure, ou la **date butoir d'instruction**
  // que porte une pièce — c'est elle qui prime, et le bandeau dit laquelle.
  const detail = b.prolongee
    ? `Prolongée ${parQuoi} : l'échéance de la procédure était le ${esc(formatDateFr(b.initiale))}.`
    : origine
      ? `Date butoir d'instruction fixée ${parQuoi}${b.initiale
        ? ` — l'échéance de la procédure était le ${esc(formatDateFr(b.initiale))}`
        : ""}.`
      : `${esc(b.delai.texte || "Délai d'instruction prévu par la procédure.")}${depuis}`;
  const lien = origine?.document
    ? ` <a href="#documents/${origine.document.id}" data-nav="documents/${origine.document.id}">Voir le document</a>`
    : "";
  return `
<div class="${classe} app-echeance--${ton}">
  <span class="app-echeance__icone">${icon("timer-line")}</span>
  <div class="app-echeance__corps">
    <p class="app-echeance__titre">
      Instruction à clore le <strong>${esc(formatDateFr(b.butoir))}</strong>
      ${reste ? `<span class="app-tag app-tag--${ton}">${esc(reste)}</span>` : ""}
      ${b.prolongee ? `<span class="app-tag app-tag--grey">Prolongée</span>` : ""}
      ${origine && !b.prolongee ? `<span class="app-tag app-tag--grey">Date butoir fixée par un acte</span>` : ""}
    </p>
    <p class="app-echeance__detail">
      ${detail}${lien}
    </p>
  </div>
</div>`;
}

/**
 * Le ton d'une échéance, selon ce qu'il reste à courir.
 *
 * Vert tant que le délai court, jaune quand il s'approche (quinze derniers
 * jours), rouge quand il est dépassé, bleu lorsqu'aucun décompte n'est
 * possible. La règle est la même pour le bandeau et pour les étiquettes : une
 * échéance se lit partout du même coup d'œil.
 */
export function tonEcheance(jours) {
  if (jours === null || jours === undefined) return "blue";
  if (jours < 0) return "error";
  if (jours <= 15) return "warning";
  return "success";
}

/**
 * Ce qu'il reste à courir avant une échéance, en mots : « dans 12 jour(s) »,
 * « aujourd'hui », « dépassée de 3 jour(s) ». Le bandeau et les étiquettes le
 * disent de la même façon.
 */
export function resteEcheance(jours) {
  if (jours === null || jours === undefined) return "";
  if (jours < 0) return `dépassée de ${-jours} jour(s)`;
  if (jours === 0) return "aujourd'hui";
  return `dans ${jours} jour(s)`;
}

/**
 * La **clôture d'instruction** d'une affaire, en étiquette.
 *
 * Là où l'affaire se lit en liste — la liste maîtresse des affaires, le
 * tableau de bord —, le bandeau n'a pas la place de se déployer : une
 * étiquette en dit l'essentiel, au ton de ce qu'il reste à courir, et signale
 * d'un coup d'œil les affaires dont l'instruction est bornée dans le temps.
 * Elle ne s'affiche que lorsqu'un terme est fixé : sans délai à décompter ni
 * date portée par une pièce, il n'y a rien à annoncer.
 *
 * La date qu'elle affiche est la **date butoir d'instruction** — celle que
 * porte une pièce, prioritaire sur l'échéance calculée de la procédure (voir
 * `butoirInstruction`, formulas.js) —, et l'infobulle le dit.
 *
 * `b` est le résultat de `butoirInstruction` (formulas.js) — calculé une fois
 * par la vue, pour que la liste n'ait pas à le refaire ligne à ligne.
 */
export function clotureTag(b, { libelle = "Clôture" } = {}) {
  if (!b || !b.butoir) return "";
  const ton = tonEcheance(b.jours);
  const reste = resteEcheance(b.jours);
  const titre = `Date butoir d'instruction : ${formatDateFr(b.butoir)}`
    + (reste ? ` — ${reste}` : "")
    + (b.prolongee ? " (prolongée par un acte)" : b.origine ? " (fixée par un acte)" : "");
  return `<span class="app-tag app-tag--${ton}" title="${esc(titre)}">`
    + `<span class="app-tag__icone">${icon("timer-line")}</span>`
    + `${esc(libelle)} le ${dateCell(b.butoir)}</span>`;
}

const nombreFr = new Intl.NumberFormat("fr-FR");

/* ------------------------------------------------------------------ */
/* Sous-navigation du tableau de bord                                  */
/* ------------------------------------------------------------------ */

/**
 * Sous-navigation d'une page dont les sous-vues sont déclarées dans `NAV`. Les
 * entrées reprennent l'identifiant, le libellé et l'icône de la sous-page, et
 * leur adresse est `page/sous-page`.
 */
function sousNavDe(pageId, active) {
  const def = NAV.find((n) => n.id === pageId);
  const subs = def?.subs || [];
  return ui.subnav({
    items: subs.map((s) => ({ id: s.id, label: s.label, iconName: s.icon, hash: `${pageId}/${s.id}` })),
    active: active || subs[0]?.id || "",
    label: def?.label || pageId,
  });
}

/**
 * Sous-navigation du tableau de bord : la synthèse et le rapport d'activité.
 * La synthèse répond à « où en est-on ? », le rapport à « qu'a fait la section
 * cette année ? » — deux lectures du même document, à deux moments différents.
 */
export function subnavTableau(active) {
  return sousNavDe("tableau-de-bord", active);
}

/**
 * Sous-navigation de la page « Calendrier » : les **échéances** — la grille du
 * mois et l'export d'agenda — et les **séances**, qui en sont une : on y
 * programme une séance et l'on compose son rôle.
 */
export function subnavCalendrier(active) {
  return sousNavDe("calendrier", active);
}

/* ------------------------------------------------------------------ */
/* Enveloppe commune des pages de réglages                             */
/* ------------------------------------------------------------------ */

export const REGLAGES_SUBS = (NAV.find((n) => n.id === "reglages")?.subs) || [];

export function subnav(active) {
  return ui.subnav({
    items: REGLAGES_SUBS.map((s) => ({ id: s.id, label: s.label, iconName: s.icon, groupe: s.groupe, hash: `reglages/${s.id}` })),
    active,
    label: "Réglages",
  });
}

export function reglagesHead(store, state, title, sub, actions = "") {
  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Réglages</p>
    <h1 class="fr-h3">${title}</h1>
    <p class="app-page-head__sub">${sub}</p>
  </div>
  ${actions ? `<div class="app-page-head__actions">${actions}</div>` : ""}
</div>
${subnav(state.sub || "sections")}`;
}

/** Panneau maître (liste sélectionnable de gauche). */
export function masterPanel({ title, iconName, count, filters = "", scrollKey, body }) {
  return `
<div class="fr-panel app-master">
  <div class="fr-panel__header">
    <div class="fr-panel__heading">
      <h2 class="fr-h6 fr-mb-0">${icon(iconName, 'class="fr-mr-1v"')}${esc(title)}</h2>
      <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">${esc(count)}</p>
    </div>
  </div>
  <div class="fr-panel__body">
    ${filters}
    <div class="app-list" data-scroll="${esc(scrollKey)}">${body}</div>
  </div>
</div>`;
}

export function split(aside, main) {
  return `<div class="app-split">
  <aside class="app-split__aside">${aside}</aside>
  <div class="app-split__main">${main}</div>
</div>`;
}

/**
 * Outil repliable de la colonne de droite d'un espace de rédaction. Ouvert,
 * c'est un panneau ; replié, un onglet vertical qui rend sa largeur au texte.
 * L'état est tenu par l'application (`state.tabs`), comme celui des onglets :
 * il survit donc au redessin de la page. `repliable: false` fige le panneau
 * ouvert — c'est le cas des paramètres d'un document tant qu'aucune trame
 * n'est choisie, puisqu'eux seuls permettent de la choisir.
 */
export function outils({ titre, iconName, ouvert, action, body, classe = "", repliable = true }) {
  if (!ouvert) {
    return `
<button type="button" class="app-outils app-outils--replie${classe ? ` ${classe}` : ""}" data-action="${esc(action)}" aria-expanded="false"
  title="Déplier : ${esc(titre)}">
  ${icon(iconName)}
  <span class="app-outils__libelle">${esc(titre)}</span>
</button>`;
  }
  const heading = `<span class="fr-panel__heading"><span class="fr-h6">${icon(iconName, 'class="fr-mr-1v"')}${esc(titre)}</span></span>`;
  return `
<section class="fr-panel app-outils${classe ? ` ${classe}` : ""}">
  ${repliable
    ? `<button type="button" class="fr-panel__header app-outils__tete" data-action="${esc(action)}" aria-expanded="true"
        title="Replier : ${esc(titre)}">${heading}<span class="app-outils__chevron" aria-hidden="true"></span></button>`
    : `<div class="fr-panel__header">${heading}</div>`}
  <div class="fr-panel__body">${body}</div>
</section>`;
}

/**
 * Sélection courante d'une table, réparée si la ligne a disparu — ou si elle
 * ne figure plus dans la liste affichée (périmètre des affaires, filtre,
 * affaire changée) : continuer d'afficher une fiche absente de la liste
 * donnerait à croire qu'elle en fait partie.
 */
export function selectedOrFirst(store, state, table, rows) {
  const id = state.sel[table];
  let rec = id ? store.byId(table, id) : null;
  if (rec && rows && rows.length && !rows.some((r) => r.id === rec.id)) rec = null;
  if (!rec) rec = (rows || store.table(table))[0] || null;
  if (rec) state.sel[table] = rec.id;
  else delete state.sel[table];
  return rec;
}

export function affaireRef(ctx, a) {
  return str(ctx.v("Affaires", a, "Numero")) || `#${a.id}`;
}

export function affaireName(ctx, a) {
  return str(ctx.v("Affaires", a, "Nom_complet")).trim() || "—";
}

export function daysSince(value) {
  const d = toDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

/** Élément de la liste maîtresse (`.app-list`). */
export function listItem({ table, id, selected = false, ref = "", name = "", badgeHtml = "", meta = "", echeance = "", attrs = "" }) {
  const classe = ["app-list__item"];
  if (selected) classe.push("is-selected");
  // Une affaire dont l'instruction est bornée dans le temps se repère dans la
  // liste au filet qui la borde, au même ton que son étiquette de clôture.
  if (echeance) classe.push(`app-list__item--echeance-${esc(echeance)}`);
  return `<button type="button" class="${classe.join(" ")}"
    data-select="${id}" data-select-table="${esc(table)}"${selected ? ' aria-current="true"' : ""}${attrs ? ` ${attrs}` : ""}>
    <span class="app-list__top">
      <span class="app-list__ref">${ref}</span>
      ${badgeHtml}
    </span>
    ${name ? `<span class="app-list__name">${name}</span>` : ""}
    ${meta ? `<span class="app-list__meta">${meta}</span>` : ""}
  </button>`;
}

/** Graphique en barres horizontales (sans librairie externe). */
export function barChart(title, data, total) {
  if (!data.length) return emptyState("Aucune donnée à représenter.", { iconName: "bar-chart-line" });
  const max = Math.max(...data.map((d) => d.value), 1);
  return `
  <figure class="app-chart">
    <figcaption>${esc(title)}</figcaption>
    ${data.map((d) => `
      <div class="app-chart__row">
        <span class="app-chart__label" title="${esc(d.label)}">${esc(d.label)}</span>
        <span class="app-chart__bar"><span style="width:${Math.max(2, Math.round((d.value / max) * 100))}%"></span></span>
        <span class="app-chart__value">${d.value}</span>
      </div>`).join("")}
    ${total !== undefined ? `<p class="fr-text--xs fr-text-mention--grey fr-mt-1v fr-mb-0">${total} enregistrement(s) au total.</p>` : ""}
  </figure>`;
}

/**
 * Tableau d'indicateurs : des colonnes de chiffres, alignées à droite.
 *
 * C'est la forme sous laquelle un rapport d'activité se vérifie — les
 * graphiques donnent la lecture d'un coup d'œil, les tableaux donnent la
 * valeur exacte. La première colonne porte le libellé (aligné à gauche), les
 * suivantes les chiffres ; un nombre est écrit à la française, pour que mille
 * se lise (séparateur de milliers) sans que l'export change de forme (`nombre`
 * de `export-table.js` écrit, lui, les vraies valeurs).
 */
export function tableauIndicateurs({ nom = "", entetes, lignes }) {
  if (!lignes.length) return emptyState("Aucune donnée à présenter.", { iconName: "table-line" });
  const cellule = (valeur, rang) => {
    if (rang === 0) return `<td>${esc(str(valeur))}</td>`;
    const texte = typeof valeur === "number" ? nombreFr.format(valeur) : str(valeur);
    return `<td class="app-table__num">${esc(texte)}</td>`;
  };
  return `
<div class="fr-table fr-table--bordered fr-table--sm app-table--indicateurs">
  <div class="fr-table__wrapper">
    <div class="fr-table__container">
      <div class="fr-table__content">
        <table>
          ${nom ? `<caption class="fr-sr-only">${esc(nom)}</caption>` : ""}
          <thead>
            <tr>${entetes.map((entete, i) => `<th scope="col"${i ? ' class="app-table__num"' : ""}>${esc(entete)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${lignes.map((ligne) => `<tr>${ligne.map(cellule).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
}

/** Filtre générique sur une recherche texte multi-colonnes. */
export function matches(query, ...values) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = values.map((v) => str(v)).join(" ").toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function sortRecords(rows, getter, dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return va > vb ? sign : -sign;
  });
}

/**
 * Menu « Exporter » d'une page.
 *
 * Une page d'action portait jusqu'à sept boutons alignés — « Nouvelle affaire »,
 * « Imprimer la liste », puis l'export PDF, Word, OpenDocument, CSV et Excel —,
 * dont cinq ne servaient qu'occasionnellement : le geste courant se perdait au
 * milieu des sorties de fichier, et l'en-tête débordait sur écran étroit. Les
 * sorties de fichier sont ici **repliées sous un seul bouton**, qui les déroule
 * à la demande : l'action principale de la page reste seule visible.
 *
 * C'est un `<details>` : il se déplie sans JavaScript, s'ouvre au clavier, et
 * les boutons qu'il contient gardent leurs attributs d'action — la délégation
 * d'événements de l'application les reçoit comme s'ils étaient à plat.
 */
export function exportMenu({ label = "Exporter", items = "", size = "", variant = "secondary", iconName = "download-line", class: klass = "" } = {}) {
  if (!items) return "";
  return `
<details class="app-menu${klass ? ` ${klass}` : ""}">
  <summary class="fr-btn fr-btn--${esc(variant)}${size ? ` fr-btn--${esc(size)}` : ""}">
    ${icon(iconName, 'class="fr-mr-1v"')}${esc(label)}
  </summary>
  <div class="app-menu__panel">${items}</div>
</details>`;
}

/**
 * Les sorties d'un document imprimable — impression, PDF, Word, OpenDocument —
 * à l'état de simples boutons, sans conteneur : de quoi composer soit une barre
 * (voir `exportButtons`), soit les entrées d'un menu (voir `exportMenu`).
 */
export function docExportItems({ printAction, printLabel = "Imprimer", printVariant = "primary", scope = "document", record = null, size = "" } = {}) {
  const attrs = `data-export-scope="${esc(scope)}"${record === null ? "" : ` data-record="${esc(record)}"`}`;
  const exportButton = (label, { kind, iconName, hint }) => button(label, {
    variant: "secondary",
    size,
    iconName,
    action: `export-${kind}`,
    attrs: `${attrs} data-export="${kind}" title="${esc(hint)}"`,
  });
  return [
    button(printLabel, { variant: printVariant, iconName: "printer-line", action: printAction, size }),
    exportButton("PDF", { kind: "pdf", iconName: "file-pdf-line", hint: "Exporter en PDF (A4)" }),
    exportButton("Word (.docx)", { kind: "docx", iconName: "file-text-line", hint: "Exporter au format Word" }),
    exportButton("OpenDocument (.odt)", { kind: "odt", iconName: "article-line", hint: "Exporter au format OpenDocument (LibreOffice)" }),
  ].join("");
}

/** Barre de boutons d'export d'un document imprimable (PDF, Word, OpenDocument). */
export function exportButtons(opts = {}) {
  return `
  <div class="app-export__buttons">${docExportItems(opts)}</div>`;
}

/** Indicateur d'avancement partagé par tous les exports d'une page. */
export function exportStatus() {
  return `
  <p class="fr-hint-text fr-mt-1w fr-mb-0 app-export__status" data-export-status hidden>
    <span class="app-spinner" aria-hidden="true"></span>
    <span data-export-status-text aria-live="polite"></span>
  </p>`;
}

/**
 * L'option d'export anonyme d'une décision définitive : la version où les
 * personnes du dossier — mis en cause, victimes, témoins — sont désignées par
 * « A. B. », « B. C. »… dans l'ordre où elles paraissent, quand les membres de
 * la formation et le secrétaire gardent leur nom (voir `anonymat.js`).
 *
 * La case vit dans la barre d'export du document, à côté des boutons : c'est un
 * choix de **cette** sortie-là, et non un réglage de la décision. Elle se décoche
 * d'elle-même à la sortie de la page ; tant qu'elle est cochée, les trois
 * fichiers exportés sont anonymes, et leur nom le dit.
 */
function optionAnonyme() {
  return `
  <div class="fr-checkbox-group app-check app-export__anonyme">
    <input type="checkbox" id="exportAnonyme" data-export-anonyme aria-describedby="exportAnonyme-desc">
    <label class="fr-label" for="exportAnonyme">Export anonyme</label>
    <p class="fr-hint-text app-desc" id="exportAnonyme-desc">Remplace le nom des personnes du dossier — mis en cause, victimes,
      témoins — par A. B., B. C.… dans l'ordre où elles paraissent dans le document. Les membres de la
      formation et le secrétaire gardent leur nom. L'aperçu, lui, montre toujours la version complète :
      seule la sortie est anonyme.</p>
  </div>`;
}

/**
 * Boutons et indicateur d'un document imprimable, dans leur propre bloc.
 *
 * `scope` dit à l'application ce qui est exporté — le document généré
 * sélectionné (`document`), le rôle d'une séance (`role`) ou la liste
 * d'affaires filtrée (`affaires`) — et `record` la fiche concernée.
 * Les trois exports portent `data-export`, ce qui permet de les désactiver
 * ensemble pendant la préparation du fichier.
 *
 * `anonymisable` n'est posé que sur une **décision définitive** : c'est elle
 * seule qui peut s'exporter sous forme anonyme.
 */
export function exportBar(opts = {}) {
  return `
<div class="app-export">${opts.anonymisable ? optionAnonyme() : ""}${exportButtons(opts)}${exportStatus()}
</div>`;
}

/**
 * Boutons d'export tabulaire d'une liste : CSV et classeur Excel.
 *
 * `rows` sont les lignes **telles qu'elles s'affichent**, dans leur ordre : ce
 * sont elles que le fichier emporte — le périmètre de visibilité, les filtres
 * et le tri de l'écran sont donc respectés, et l'export ne peut rien livrer de
 * plus que ce qu'on a sous les yeux. `colonnes` restreint la liste des colonnes
 * (un export au format d'un fichier réimportable, par exemple la composition
 * d'une section) et `suffixe` complète le nom du fichier — l'acronyme de la
 * section, le nom de son établissement.
 */
export function exportTableButtons({ table, rows, colonnes = null, suffixe = "", size = "", variant = "tertiary", titre = "", formats = ["csv", "xlsx"] }) {
  // Rien à exporter : la liste est vide. Les boutons n'ont alors pas d'objet —
  // et surtout, un export sans ligne désignée emporterait la table entière.
  if (!rows.length) return "";
  return exportConsole({ cible: cibleTable({ table, rows, colonnes, suffixe }), size, variant, titre, formats });
}

/**
 * Les boutons d'export d'une liste, **sans conteneur** : de quoi les poser
 * dans une barre (`exportConsole`) ou les replier dans un menu
 * (`exportMenu`, lot « un seul bouton Exporter »).
 */
export function exportTableItems(opts = {}) {
  const { table, rows, colonnes = null, suffixe = "", size = "", variant = "tertiary", titre = "", formats = ["csv", "xlsx"] } = opts;
  if (!rows || !rows.length) return "";
  return exportItems({ cible: cibleTable({ table, rows, colonnes, suffixe }), size, variant, titre, formats });
}

/** Les attributs qui désignent la table et les lignes à exporter. */
function cibleTable({ table, rows, colonnes = null, suffixe = "" }) {
  const ids = rows.map((r) => r.id).join(",");
  return `data-export-table="${esc(table)}" data-export-ids="${esc(ids)}"`
    + (colonnes && colonnes.length ? ` data-export-cols="${esc(colonnes.join(","))}"` : "")
    + (suffixe ? ` data-export-suffix="${esc(suffixe)}"` : "");
}

/**
 * Boutons d'export d'une liste **calculée** — les échéances du calendrier, qui
 * ne viennent d'aucune table. `source` nomme le producteur de la liste, dans
 * `app.js` (`LISTES_EXPORT`) : la liste est construite au clic, à partir des
 * mêmes données que l'écran, plutôt que transportée dans le bouton.
 * `sourceId` désigne une liste précise à l'intérieur de cette source — l'identifiant
 * d'un tableau du rapport d'activité, par exemple.
 */
export function exportListeButtons({ source, sourceId = "", nom = "", size = "", variant = "tertiary", formats = ["csv", "xlsx"], titre = "" }) {
  return exportConsole({ cible: cibleListe({ source, sourceId, nom }), size, variant, titre, formats });
}

/** Les boutons d'export d'une liste calculée, sans conteneur. */
export function exportListeItems(opts = {}) {
  const { source, sourceId = "", nom = "", size = "", variant = "tertiary", formats = ["csv", "xlsx"], titre = "" } = opts;
  return exportItems({ cible: cibleListe({ source, sourceId, nom }), size, variant, titre, formats });
}

function cibleListe({ source, sourceId = "", nom = "" }) {
  return `data-export-source="${esc(source)}"${sourceId ? ` data-export-source-id="${esc(sourceId)}"` : ""}${nom ? ` data-export-nom="${esc(nom)}"` : ""}`;
}

/** Les boutons d'export d'une liste, selon les formats demandés, sans conteneur. */
function exportItems({ cible, size = "", variant = "tertiary", titre = "", formats = ["csv", "xlsx"] }) {
  const LIBELLES = {
    csv: { label: "CSV", iconName: "file-text-line", hint: "Télécharger cette liste au format CSV" },
    xlsx: { label: "Excel (.xlsx)", iconName: "table-line", hint: "Télécharger cette liste au format Excel" },
  };
  return formats
    .map((kind) => LIBELLES[kind] && button(LIBELLES[kind].label, {
      variant, size, iconName: LIBELLES[kind].iconName,
      action: `export-${kind}`,
      attrs: `data-export="${kind}" ${cible} title="${esc(titre ? `${titre} — ${LIBELLES[kind].label}` : LIBELLES[kind].hint)}"`,
    }))
    .filter(Boolean)
    .join(" ");
}

/**
 * Les boutons d'export d'une liste et leur indicateur d'activité, dans leur
 * propre bloc : `cible` porte les attributs qui disent à l'application ce
 * qu'il faut exporter.
 */
function exportConsole({ cible, size = "", variant = "tertiary", titre = "", formats = ["csv", "xlsx"] }) {
  return `
  <span class="app-export-inline"${titre ? ` title="${esc(titre)}"` : ""}>
    ${exportItems({ cible, size, variant, titre, formats })}
    <span class="app-spinner" data-export-spinner hidden aria-hidden="true"></span>
  </span>`;
}

/** Carte « accès rapide » du tableau de bord. */
export function quickCard({ label, description, iconName, href, action }) {
  return `<a class="app-card app-card--action" ${href ? `href="${esc(href)}" data-nav="${esc(href.replace(/^#/, ""))}"` : `type="button" data-action="${esc(action)}"`}>
    <div class="app-card__title">${icon(iconName, 'class="fr-mr-1v"')}${esc(label)}</div>
    <p class="app-card__desc">${esc(description)}</p>
  </a>`;
}

/* ------------------------------------------------------------------ */
/* Origine d'une affaire : sa composante, ou sa section à défaut       */
/* ------------------------------------------------------------------ */

/**
 * Libellé court et unique de chaque section disciplinaire.
 *
 * La composante est facultative : un établissement qui ne suit pas l'origine de
 * ses mis en cause n'en renseigne aucune. Les indicateurs ne restent pas muets
 * pour autant — une section qui n'a pas de composante y est comptée **pour
 * elle-même** (voir `origineAffaire`). Il faut donc un nom court pour la
 * désigner dans une colonne, une liste de filtre ou un graphique : le nom de la
 * structure, complété du public quand une même structure porte plusieurs
 * sections (l'une pour les usagers, l'autre pour les enseignants-chercheurs),
 * et à défaut l'intitulé complet de la section.
 */
export function libellesSections(ctx) {
  const sections = ctx.table("Sections_disciplinaires");
  const nom = new Map();
  const public_ = new Map();
  const intitule = new Map();
  for (const s of sections) {
    nom.set(s.id, str(ctx.v("Sections_disciplinaires", s, "Structure")).trim());
    public_.set(s.id, str(ctx.v("Sections_disciplinaires", s, "Public")).trim());
    intitule.set(s.id, str(ctx.v("Sections_disciplinaires", s, "Intitule_de_la_section")).trim());
  }
  const compte = (valeurs) => valeurs.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map());
  const avecPublic = (s) => `${nom.get(s.id)} (${public_.get(s.id).toLowerCase()})`;
  const parNom = compte(sections.map((s) => nom.get(s.id)));
  const parNomPublic = compte(sections.map(avecPublic));
  const labels = new Map();
  const vus = new Set();
  for (const s of sections) {
    let label = nom.get(s.id) || intitule.get(s.id) || `Section n° ${s.id}`;
    if (nom.get(s.id) && public_.get(s.id) && parNom.get(nom.get(s.id)) > 1) label = avecPublic(s);
    // Deux sections peuvent encore se ressembler (même structure, même public,
    // deux types de section) : l'intitulé complet les distingue, et à défaut le
    // numéro de la ligne.
    if (parNomPublic.get(avecPublic(s)) > 1) label = intitule.get(s.id) || label;
    if (vus.has(label)) label = `${label} (n° ${s.id})`;
    vus.add(label);
    labels.set(s.id, label);
  }
  return labels;
}

/**
 * Origine d'une affaire, telle que la lisent les indicateurs : sa composante si
 * l'établissement en suit une, sinon le libellé de sa section. Une section qui
 * n'a pas de composante n'est donc jamais absente des indicateurs — elle y
 * figure comme l'origine de ses affaires. Une affaire qui n'a ni l'une ni
 * l'autre ne compte pour aucune origine (chaîne vide).
 */
export function origineAffaire(ctx, libelles, affaire) {
  if (!affaire) return "";
  const composante = str(ctx.v("Affaires", affaire, "Composante")).trim();
  if (composante) return composante;
  const section = ctx.ref("Affaires", affaire, "Section");
  return section ? (libelles.get(section.id) || "") : "";
}

/** Origine d'une décision : celle de l'affaire qu'elle tranche. */
export function origineDecision(store, ctx, libelles, decision) {
  return decision ? origineAffaire(ctx, libelles, store.byId("Affaires", decision.Affaire)) : "";
}

/**
 * Axe d'origine d'un ensemble de décisions : les origines distinctes à compter
 * ou à comparer, leur libellé de section, et le nom à leur donner — les
 * composantes lorsque l'établissement en suit, les sections sinon.
 */
export function origineDesDecisions(store, ctx, decisions) {
  const libelles = libellesSections(ctx);
  const origines = [...new Set(decisions
    .map((d) => origineDecision(store, ctx, libelles, d))
    .filter(Boolean))];
  const composante = decisions.some((d) => {
    const affaire = store.byId("Affaires", d.Affaire);
    return !!affaire && !!str(ctx.v("Affaires", affaire, "Composante")).trim();
  });
  return { libelles, origines, composante };
}

export { panel, emptyState, button, badge, dateCell, icon, esc, str };
