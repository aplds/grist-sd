// Décisions rendues.
//
// La page sert deux usages : le registre des décisions (recherche par INE,
// par nom ou par numéro d'affaire, filtre par type) et l'analyse des sanctions
// (répartition par type, délais).
//
// La composante est facultative : quand l'établissement n'en suit pas, c'est la
// **section** de l'affaire qui sert d'origine à ses décisions (voir
// `origineAffaire` dans `common.js`) — ses indicateurs comptent donc ses
// sections, et la page n'est jamais muette. La colonne du registre, le filtre
// et le graphique, eux, n'apparaissent que s'il y a plusieurs origines à
// comparer.

import { MESURES_AVANT_DIRE_DROIT, NATURE_INTERLOCUTOIRE, estSusceptibleDeRecours } from "../schema.js";
import { delaiMoyen } from "../formulas.js";
import { registreActes } from "../actes.js";
import { decisionsPour, regimeOf, sanctionsPour, affairesDeLaJonction } from "../regimes.js";
import { mentionPerimetre, parAffaire, perimetreRestreint } from "../visibilite.js";
import * as ui from "../ui.js";
import {
  affaireRef, affaireName, matches, sortRecords, barChart,
  libellesSections, origineDecision, origineDesDecisions, exportTableButtons,
} from "./common.js";

const { esc, str, icon, badge, dateCell, panel, emptyState, button, formGrid, dataTable, kpi, dl, tag, alert } = ui;

/* ------------------------------------------------------------------ */
/* Identité de la personne, selon le régime                            */
/* ------------------------------------------------------------------ */

/**
 * L'INE identifie un usager ; il n'existe pas pour un enseignant-chercheur,
 * dont l'identité administrative est portée par le corps. Le registre étant
 * commun aux deux régimes, la colonne montre l'un ou l'autre selon la section
 * de l'affaire — et jamais un INE vide pour un enseignant-chercheur.
 */
function identifiantDe(store, ctx, affaire) {
  if (!affaire) return { valeur: "", ec: false };
  const ec = str(ctx.v("Affaires", affaire, "Section_Public")) === "Enseignants-chercheurs";
  return { valeur: ec ? str(ctx.v("Affaires", affaire, "Corps")) : str(ctx.v("Affaires", affaire, "INE")), ec };
}

/**
 * Textes de décision proposés au filtre et au graphique : le catalogue de
 * chaque régime, sanction par sanction, complété des valeurs réellement
 * enregistrées. La liste historique `DECISIONS` ne suffit pas — elle ne
 * contient que les sanctions des usagers.
 */
function textesDecision(store, all) {
  const catalogue = [...new Set([
    ...decisionsPour(store.db, "Usagers"),
    ...decisionsPour(store.db, "Enseignants-chercheurs"),
    ...MESURES_AVANT_DIRE_DROIT,
  ])];
  const presentes = [...new Set(all.map((d) => str(d.Decision)).filter(Boolean))];
  return [...catalogue, ...presentes.filter((v) => !catalogue.includes(v))];
}

/* ------------------------------------------------------------------ */
/* Sélection                                                           */
/* ------------------------------------------------------------------ */

export function filteredDecisions(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  // Le registre suit le périmètre des affaires : un secrétaire n'y voit que
  // les décisions des affaires qui lui sont attribuées.
  let rows = parAffaire(store, state, store.table("Decisions"), (d) => d.Affaire);
  if (f.decisionType) rows = rows.filter((d) => str(d.Decision) === f.decisionType);
  // Le filtre porte sur l'origine **telle qu'elle est affichée** — la
  // composante, ou la section de l'affaire quand elle n'en a pas. Il ne
  // s'applique que s'il désigne une origine encore présente : une valeur
  // mémorisée dans ce navigateur et devenue caduque (composante corrigée,
  // origine unique désormais) viderait le registre sans qu'on voie pourquoi.
  if (f.decisionComposante) {
    const libelles = libellesSections(ctx);
    const presente = rows.some((d) => origineDecision(store, ctx, libelles, d) === f.decisionComposante);
    if (presente) rows = rows.filter((d) => origineDecision(store, ctx, libelles, d) === f.decisionComposante);
  }
  if (f.decisionEnCours) rows = rows.filter((d) => ctx.v("Decisions", d, "En_cours_"));
  if (f.decisionQ) {
    rows = rows.filter((d) => {
      const affaire = store.byId("Affaires", d.Affaire);
      const identifiant = identifiantDe(store, ctx, affaire);
      return matches(f.decisionQ,
        affaire ? affaireRef(ctx, affaire) : "",
        affaire ? affaireName(ctx, affaire) : "",
        identifiant.valeur,
        ctx.v("Decisions", d, "Affaire_INE"),
        d.Decision);
    });
  }
  return sortRecords(rows, (d) => String(d.Date_de_notification || ""), "desc");
}

/* ------------------------------------------------------------------ */
/* Ligne du registre                                                   */
/* ------------------------------------------------------------------ */

function decisionRow(store, state, d, axe, libelles, avecDelai = true, avecNumero = false) {
  const ctx = state.ctx;
  const affaire = store.byId("Affaires", d.Affaire);
  const enCours = ctx.v("Decisions", d, "En_cours_");
  const delai = ctx.v("Decisions", d, "Delai_de_traitement");
  const terme = ctx.v("Decisions", d, "Terme_de_la_sanction");
  // Le régime n'est pas porté par la décision mais par la section de l'affaire :
  // c'est lui qui distingue les deux procédures dans un registre commun.
  const regime = affaire ? str(ctx.v("Affaires", affaire, "Section_Public")) : "";
  const nature = str(d.Nature) || "Sanction";
  const identifiant = identifiantDe(store, ctx, affaire);
  // Le libellé affiché est celui qui est notifié (`Libelle_decision`) : la
  // sanction du catalogue pour une décision qui tranche le fond, le texte
  // retenu sinon (issue de procédure, mesure avant dire droit). Lire
  // `d.Decision` afficherait une case vide dès que la sanction est choisie
  // au catalogue.
  const libelle = str(ctx.v("Decisions", d, "Libelle_decision"));
  // Décision commune : le registre dit, d'un mot, combien d'affaires elle
  // tranche — le détail se lit sur sa fiche.
  const jonction = affaire ? ctx.v("Affaires", affaire, "Jonction") : null;
  const nbAffaires = jonction ? affairesDeLaJonction(ctx, jonction).length : 0;
  const cells = [
    affaire
      ? `<strong>${esc(affaireRef(ctx, affaire))}</strong>`
        + (nbAffaires > 1 ? ` <span class="app-tag app-tag--blue" title="Décision commune à ${nbAffaires} affaires jointes">+${nbAffaires - 1}</span>` : "")
      : "—",
    regime ? tag(regime === "Enseignants-chercheurs" ? "Enseignants-chercheurs" : "Usagers", regime === "Enseignants-chercheurs" ? "warning" : "blue") : "—",
    esc(identifiant.valeur) || "—",
    affaire ? esc(affaireName(ctx, affaire)) : "",
    `${esc(libelle)}`
      + (nature === "Sanction" ? "" : `<br><span class="app-tag app-tag--grey">${esc(nature)}</span>`),
    dateCell(d.Date_de_notification),
    nature === NATURE_INTERLOCUTOIRE ? "" : (terme === "9999-12-31" ? tag("Définitive", "yellow") : dateCell(terme)),
  ];
  if (avecNumero) {
    cells.splice(1, 0, d.Numero_acte
      ? `<code>${esc(d.Numero_acte)}</code>`
      : `<span class="fr-text-mention--grey" title="Cet acte n'a pas encore de numéro : « Numéroter les actes » le lui attribue.">non numéroté</span>`);
  }
  if (axe) cells.push(esc(origineDecision(store, ctx, libelles, d)));
  cells.push(nature === NATURE_INTERLOCUTOIRE ? "" : (enCours ? tag("En cours", "warning") : tag("Terminée", "success")));
  if (avecDelai) cells.push(nature === NATURE_INTERLOCUTOIRE || delai === null || delai === undefined ? "" : `${delai} j`);
  // Le clic sur une ligne ouvre l'espace de rédaction de la décision
  // (`#decisions/12`), comme celui d'un document ouvre le sien : la fiche ne se
  // déplie plus sous le registre, qui reste court.
  return { id: d.id, cells, attrs: `data-nav="decisions/${d.id}"` };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function viewDecisions(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  const restreint = perimetreRestreint(store, state);

  // Le registre, les indicateurs et les graphiques portent sur le même
  // ensemble : celui que la personne a le droit de voir.
  const all = parAffaire(store, state, store.table("Decisions"), (d) => d.Affaire);
  const enCours = all.filter((d) => ctx.v("Decisions", d, "En_cours_"));
  const delai = delaiMoyen({ ...store.db, Decisions: all });
  // L'axe des origines : les composantes lorsque l'établissement en suit, la
  // section de l'affaire sinon — une section sans composante est comptée pour
  // elle-même, elle ne disparaît pas des indicateurs.
  const origine = origineDesDecisions(store, ctx, all);
  const axe = origine.composante
    ? { nom: "Composante", minuscule: "composante", titre: "Par composante", toutes: "Toutes les composantes", icone: "building-line" }
    : { nom: "Section", minuscule: "section", titre: "Par section", toutes: "Toutes les sections", icone: "school-line" };
  // L'indicateur compte les origines dans tous les cas ; le filtre, la colonne
  // et le graphique n'ont de sens que s'il y a de quoi comparer.
  const avecOrigines = origine.origines.length > 1;
  const textes = textesDecision(store, all);

  const rows = filteredDecisions(store, state);
  // La colonne « Délai » se masque : elle ne sert pas à toutes les lectures (un
  // registre de suivi des sanctions s'en passe), et elle allonge la ligne.
  const avecDelai = f.decisionDelai === undefined ? true : !!f.decisionDelai;
  const selected = state.sel.Decisions ? store.byId("Decisions", state.sel.Decisions) : null;
  if (selected && !all.some((d) => d.id === selected.id)) delete state.sel.Decisions;

  const mention = mentionPerimetre(store, state);
  const head = `
<div class="app-page-head">
  <div>
    <p class="app-kicker">${restreint ? "Mes décisions" : "Décisions"}</p>
    <h1 class="fr-h3">Suivre les sanctions prononcées</h1>
    <p class="app-page-head__sub">${restreint
      ? `Les décisions des affaires qui vous sont attribuées, avec leur terme${avecOrigines ? `, leur ${axe.minuscule}` : ""} et leur délai de traitement. Chacune se rédige dans son atelier : visas, considérants, dispositif.`
      : `Toutes les décisions des sections, avec leur terme${avecOrigines ? `, leur ${axe.minuscule}` : ""} et leur délai de traitement. Chacune se rédige dans son atelier — visas, considérants de principe, dispositif — et se saisit aussi depuis l'affaire concernée.`}</p>
  </div>
  <div class="app-page-head__actions">
    ${button("Analyse et graphiques", {
      variant: "secondary", size: "sm", iconName: "bar-chart-line",
      attrs: 'data-nav="tableau-de-bord/rapport"',
      title: "Les répartitions, les délais et les recours se lisent dans le rapport d'activité — ils n'y sont produits qu'une fois",
    })}
  </div>
</div>
${mention ? alert("info", "Périmètre restreint", mention) : ""}`;

  if (!all.length) {
    return `
${head}
${panel("Aucune décision", emptyState(
      "Aucune décision n'a encore été enregistrée. Ouvrez une affaire puis l'onglet « Décision » pour en saisir une.",
      { iconName: "scales-3-line", action: button("Voir les affaires", { variant: "primary", iconName: "folder-2-line", attrs: 'data-nav="affaires"' }) }
    ), { iconName: "scales-3-line" })}`;
  }

  const kpis = `
  <div class="app-kpis">
    ${kpi({ label: "Décisions rendues", value: all.length, hint: `${rows.length} affichée(s) après filtres`, iconName: "scales-3-line" })}
    ${kpi({ label: "En cours d'effet", value: enCours.length, hint: "sanction(s) non expirée(s)", iconName: "time-line", tone: enCours.length ? "warning" : "" })}
    ${kpi({ label: "Délai moyen", value: delai.moyenne === null ? "—" : `${delai.mois} mois`, hint: delai.moyenne === null ? "aucune décision notifiée" : `soit ${Math.round(delai.moyenne)} jours après la saisine`, iconName: "bar-chart-line" })}
    ${kpi({ label: `${axe.nom}s concernées`, value: origine.origines.length, hint: origine.origines.slice(0, 2).join(", ") || "aucune", iconName: axe.icone })}
  </div>`;

  const filtres = `
<div class="app-filters app-filters--page">
  <div class="app-search">
    <label class="fr-label" for="decisionQ">Rechercher</label>
    <input class="fr-input" type="search" id="decisionQ" data-filter="decisionQ"
      value="${esc(f.decisionQ || "")}" placeholder="Nom, numéro d'affaire, INE ou corps…">
  </div>
  <div class="fr-select-group app-select-inline">
    <label class="fr-label" for="decisionType">Décision</label>
    <select class="fr-select" id="decisionType" data-filter="decisionType">
      <option value="">Tous les types</option>
      ${textes.map((d) => `<option value="${esc(d)}" ${f.decisionType === d ? "selected" : ""}>${esc(d)}</option>`).join("")}
    </select>
  </div>
  ${avecOrigines ? `<div class="fr-select-group app-select-inline">
    <label class="fr-label" for="decisionComposante">${axe.nom}</label>
    <select class="fr-select" id="decisionComposante" data-filter="decisionComposante">
      <option value="">${axe.toutes}</option>
      ${origine.origines.map((o) => `<option value="${esc(o)}" ${f.decisionComposante === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
    </select>
  </div>` : ""}
  <div class="fr-checkbox-group app-check app-check--inline">
    <input type="checkbox" id="decisionEnCours" data-filter="decisionEnCours" ${f.decisionEnCours ? "checked" : ""}>
    <label class="fr-label" for="decisionEnCours">En cours d'effet seulement</label>
  </div>
  <div class="fr-checkbox-group app-check app-check--inline">
    <input type="checkbox" id="decisionDelai" data-filter="decisionDelai" ${avecDelai ? "checked" : ""}>
    <label class="fr-label" for="decisionDelai">Colonne « Délai »</label>
  </div>
</div>`;

  // Registre des actes (NC-0020) : la numérotation se lit et se pose ici, sur
  // les décisions que la personne a le droit de voir.
  const actes = registreActes({ ...store.db, Decisions: all }, store.table("Affaires"));
  const avecNumero = all.some((d) => String(d.Numero_acte || "").trim());
  const registreActesHtml = panel("Registre des actes", `
    <p class="fr-text--sm">
      Chaque décision reçoit un numéro d'acte — séquence par section et par année, par exemple
      <code>UDA-2026-001</code>. Le numéro ne dépend pas du registre des affaires, et il n'est
      <strong>jamais réutilisé</strong>, même après une suppression : la série reste vérifiable.
    </p>
    ${dl([
      ["Actes numérotés", String(actes.lignes.length)],
      ["Actes sans numéro", String(actes.sansNumero.length)],
      ["Premier / dernier", actes.lignes.length
        ? `${actes.lignes[0].Numero_acte} → ${actes.lignes[actes.lignes.length - 1].Numero_acte}`
        : "—"],
    ])}
    ${actes.sansNumero.length
      ? alert("warning", `${actes.sansNumero.length} acte(s) sans numéro`,
        "Une décision sans numéro ne peut pas être citée par son registre. La numérotation les prend "
        + "dans l'ordre chronologique, par section et par année.")
      : ""}
    <div class="fr-btns-group fr-btns-group--inline fr-mt-2w">
      ${actes.sansNumero.length
        ? button(`Numéroter les actes (${actes.sansNumero.length})`, { variant: "primary", size: "sm", iconName: "list-ordered", action: "numeroter-actes" })
        : ""}
      ${actes.lignes.length
        ? button("Exporter le registre (CSV)", { variant: "secondary", size: "sm", iconName: "download-line", action: "export-registre-actes" })
        : ""}
    </div>
  `, {
    iconName: "list-ordered",
    subtitle: "Numérotation chronologique des décisions, séquence par section et par année",
    collapsible: true,
    open: actes.sansNumero.length > 0,
  });

  const registre = panel("Registre des décisions", `
    ${rows.length
      ? dataTable({
          caption: `${rows.length} décision(s) — cliquez une ligne pour ouvrir la décision et en rédiger le texte`,
          columns: ["Affaire", ...(avecNumero ? ["N° d'acte"] : []), "Régime", "INE / corps", "Mis en cause", "Décision", "Notifiée le", "Terme",
            ...(avecOrigines ? [axe.nom] : []), "Statut", ...(avecDelai ? ["Délai"] : [])],
          rows: rows.map((d) => decisionRow(store, state, d, avecOrigines ? axe : null, origine.libelles, avecDelai, avecNumero)),
          selectedId: selected ? selected.id : null,
          emptyText: "Aucune décision ne correspond à cette recherche.",
        })
      : emptyState("Aucune décision ne correspond à ces filtres.", { iconName: "search-line" })}
  `, {
    iconName: "list-unordered",
    subtitle: "Cliquez une ligne pour ouvrir l'atelier de rédaction de la décision",
    actions: `${exportTableButtons({
      table: "Decisions",
      rows,
      size: "sm",
      titre: "Télécharger les décisions affichées, filtres compris",
    })}
      <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-action="reset-decision-filters">${icon("refresh-line", 'class="fr-mr-1v"')}Réinitialiser les filtres</button>`,
  });

  return `
${head}
${kpis}
${filtres}
${registreActesHtml}
${registre}`;
}
