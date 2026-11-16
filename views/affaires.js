// Espace de travail d'une affaire.
//
// Une affaire se traite de bout en bout dans une seule page. Les onglets, les
// libellés et les contrôles épousent la procédure de la section (voir
// `procedure.js`) : la composition s'appelle « Commission » pour les usagers,
// « Instruction » pour les enseignants-chercheurs et « Section » pour la
// section disciplinaire académique, mais c'est la même table `Intervenants` —
// elle ne diffère que par le rôle tenu, et par le collège d'où vient chaque
// intervenant.
//
// La personne mise en cause n'est plus une suite de champs de l'affaire : c'est
// une fiche du répertoire `Personnes`, reliée à l'affaire. L'onglet « Personnes »
// la présente, avec les autres personnes du dossier (victimes, témoins,
// représentants).

import { ETATS, ETATS_CLOTURE, etapesAffaire, estCloseEtat, NATURE_INTERLOCUTOIRE, ROLES_INTERVENANT, STATUTS_INTERVENANT, estSusceptibleDeRecours } from "../schema.js";
import { LEGACY_ROLES_INTERVENANT } from "../legacy.js";
import { butoirInstruction, formatDateFr } from "../formulas.js";
import { LIBELLE_STATUT_CONTROLE, affairePorteuseDeLaDecision, affairesDeLaJonction, controlesRegularite, decisionDefinitiveDe, decisionsDefinitivesDe, decisionsPour, estAffaireDeTete, estEC, libelleFormation, motifsPour, numerosDeLaJonction, ongletsAffaire, recoursDe, regimeOf, sanctionsPour, suitProcedureR811_40 } from "../regimes.js";
import { procedure, voiesPour, compositionAttendue, collegeDe, collegeDuCorps, COLLEGES, effectifFormation, noticeProcedure } from "../procedure.js";
import { LIBELLE_VOIR_TOUT, VOIR_TOUT, affairesVisibles, mentionPerimetre, mesFiches, peutVoirTout, perimetreRestreint, voirTout } from "../visibilite.js";
import { dossierDeclare, rappelDossier } from "../dossier.js";
import * as ui from "../ui.js";
import { selectedOrFirst, affaireRef, affaireName, echeanceInstruction, clotureTag, tonEcheance, matches, sortRecords, listItem, daysSince, exportMenu, docExportItems, exportStatus, exportTableItems, exportTableButtons } from "./common.js";
import { documentsList } from "./documents.js";

const { esc, str, icon, badge, dateCell, panel, emptyState, button, formGrid, dataTable, tabs, tabPanel, workflow, dl, tag, fieldset, alert } = ui;

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

export function filteredAffaires(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  let rows = affairesVisibles(store, state, store.table("Affaires"));
  if (f.affaireEtat) rows = rows.filter((a) => a.Etat === f.affaireEtat);
  if (f.affaireSection) rows = rows.filter((a) => Number(a.Section) === Number(f.affaireSection));
  if (f.affaireQ) {
    rows = rows.filter((a) => matches(f.affaireQ, affaireRef(ctx, a), affaireName(ctx, a), ctx.v("Affaires", a, "INE"), a.Motif));
  }
  return sortRecords(rows, (a) => String(a.Date_de_saisine || ""), "desc");
}

function listItemFor(store, state, a, selected) {
  const ctx = state.ctx;
  const age = daysSince(a.Date_de_saisine);
  const closed = estCloseEtat(a.Etat);
  const regime = ctx.v("Affaires", a, "Section_Public");
  // Une affaire jointe est jugée avec une autre : le dire dans la liste évite
  // de la croire isolée, et de chercher une décision qui n'est pas la sienne.
  // L'affaire de tête porte la décision commune, les autres la lisent : deux
  // marques distinctes, car dans la liste la tête n'est pas « jointe » à elle-
  // même.
  const jonction = !!ctx.v("Affaires", a, "Jonction");
  const teteDeJonction = jonction && !ctx.v("Affaires", a, "Affaire_de_tete");
  // La clôture d'instruction : quand un terme est fixé, l'affaire le porte en
  // étiquette — et d'un filet coloré à même la ligne —, pour que la liste dise
  // quelles instructions sont bornées dans le temps, et à quel point.
  const b = butoirInstruction(ctx, a);
  const cloture = clotureTag(b);
  const meta = [
    a.Date_de_saisine ? `<span>${dateCell(a.Date_de_saisine)}</span>` : "",
    regime ? `<span>${esc(regime === "Enseignants-chercheurs" ? "Enseignants-chercheurs" : "Usagers")}</span>` : "",
    age !== null && !closed ? `<span class="${age > 180 ? "fr-text-default--error" : ""}">${age} j</span>` : "",
    cloture,
  ].filter(Boolean).join("");
  return listItem({
    table: "Affaires",
    id: a.id,
    selected,
    ref: esc(affaireRef(ctx, a)),
    name: esc(affaireName(ctx, a)),
    badgeHtml: `${badge(a.Etat)}${jonction ? ` ${tag(teteDeJonction ? "tête" : "jointe", "blue")}` : ""}`,
    meta,
    echeance: cloture ? tonEcheance(b.jours) : "",
  });
}

/**
 * Réglage du périmètre, en tête des filtres de la liste.
 *
 * Un propriétaire choisit entre ses affaires et toutes celles du document ;
 * son choix est mémorisé dans ce navigateur. Un secrétaire n'a pas ce choix —
 * l'outil le lui dit, plutôt que de le laisser chercher une affaire absente.
 */
function perimetreBloc(store, state) {
  // Le choix n'a de sens que s'il existe un périmètre à restreindre : sans
  // fiche secrétaire, la personne voit déjà tout le document.
  if (peutVoirTout(state) && mesFiches(store, state).length) {
    return `
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="affairePerimetre">Périmètre</label>
        <select class="fr-select" id="affairePerimetre" data-filter="${esc(VOIR_TOUT)}">
          <option value="" ${voirTout(state) ? "" : "selected"}>Mes affaires</option>
          <option value="1" ${voirTout(state) ? "selected" : ""}>Toutes les affaires</option>
        </select>
      </div>`;
  }
  const mention = mentionPerimetre(store, state);
  return mention ? `<p class="fr-hint-text fr-mb-0">${esc(mention)}</p>` : "";
}

/** Invitation à répartir les affaires, réservée aux propriétaires. */
function attributionLien(store, state) {
  if (!peutVoirTout(state)) return "";
  const orphelines = store.table("Affaires").filter((a) => !Number(a.Secretaire) && !estCloseEtat(a.Etat)).length;
  return button("Répartir les affaires", {
    variant: "secondary",
    size: "sm",
    iconName: "arrow-left-right-line",
    attrs: `data-nav="attribution"${orphelines ? ` title="${esc(`${orphelines} affaire(s) sans secrétaire`)}"` : ""}`,
  });
}

function asidePanel(store, state, rows, selected) {
  const f = state.filters;
  const sections = store.table("Sections_disciplinaires");
  const restreint = perimetreRestreint(store, state);
  return `
<div class="fr-panel app-master">
  <div class="fr-panel__header">
    <div class="fr-panel__heading">
      <h2 class="fr-h6 fr-mb-0">${icon("folder-2-line", 'class="fr-mr-1v"')}Affaires</h2>
      <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">${rows.length} affaire(s) affichée(s)</p>
    </div>
  </div>
  <div class="fr-panel__body">
    <div class="app-filters">
      <div class="app-search">
        <label class="fr-label" for="affaireQ">Rechercher</label>
        <input class="fr-input" type="search" id="affaireQ" data-filter="affaireQ"
          value="${esc(f.affaireQ || "")}" placeholder="Numéro, nom, INE, motif…">
      </div>
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="affaireEtat">État</label>
        <select class="fr-select" id="affaireEtat" data-filter="affaireEtat">
          <option value="">Tous les états</option>
          ${ETATS.map((e) => `<option value="${esc(e)}" ${f.affaireEtat === e ? "selected" : ""}>${esc(e)}</option>`).join("")}
        </select>
      </div>
      ${sections.length > 1 ? `
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="affaireSection">Section</label>
        <select class="fr-select" id="affaireSection" data-filter="affaireSection">
          <option value="">Toutes les sections</option>
          ${sections.map((s) => `<option value="${s.id}" ${String(f.affaireSection) === String(s.id) ? "selected" : ""}>${esc(str(s.Structure))} — ${esc(str(s.Public))}</option>`).join("")}
        </select>
      </div>` : ""}
      ${perimetreBloc(store, state)}
      ${attributionLien(store, state) ? `<div class="fr-mt-1w">${attributionLien(store, state)}</div>` : ""}
    </div>
    <div class="app-list" data-scroll="affaireList">
      ${rows.length
        ? rows.map((a) => listItemFor(store, state, a, selected && a.id === selected.id)).join("")
        : emptyState(restreint
          ? "Aucune affaire ne vous est attribuée pour le moment. Elles se répartissent depuis la vue « Attribution »."
          : "Aucune affaire ne correspond à cette recherche.",
          {
            iconName: "search-line",
            action: restreint && peutVoirTout(state)
              ? button(LIBELLE_VOIR_TOUT, { variant: "secondary", size: "sm", iconName: "eye-line", action: "voir-tout-affaires" })
              : "",
          })}
    </div>
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Cheminement d'état                                                  */
/* ------------------------------------------------------------------ */

function flowPanel(store, a) {
  const cloture = estCloseEtat(a.Etat);
  // La voie de l'article R.811-40 est une alternative à l'instruction : le
  // cheminement de l'affaire saute l'étape « Instruction » et un mot le dit,
  // pour que le bandeau ne laisse pas croire à une étape manquante.
  const r811 = suitProcedureR811_40(a);
  const section = a.Section ? store.byId("Sections_disciplinaires", a.Section) : null;
  const d = procedure(section);
  const etapes = etapesAffaire(a);
  return `
<div class="app-flow-wrap">
  ${workflow(etapes, a.Etat, { recordId: a.id })}
  ${r811 ? `<p class="app-flow__note fr-text--sm app-muted fr-mb-0">
    ${icon("information-line", 'class="fr-mr-1v"')}Voie de l'article R.811-40 : alternative à l'instruction, l'affaire se traite sans phase d'instruction.
  </p>` : ""}
  <p class="app-flow__note fr-text--sm app-muted fr-mb-0">
    ${icon("scales-3-line", 'class="fr-mr-1v"')}${esc(d.organe)} — ${esc(d.formation)}.
  </p>
  <div class="app-flow__extra">
    <p class="fr-text--sm fr-mb-0 app-muted">${cloture ? "Affaire close :" : "Clôturer l'affaire :"}</p>
    ${ETATS_CLOTURE.map((e) => `
      <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm${a.Etat === e ? " is-active" : ""}"
        data-action="set-etat" data-record="${a.id}" data-etat="${esc(e)}"
        ${a.Etat === e ? 'aria-pressed="true"' : ""}>${icon("flag-line", 'class="fr-mr-1v"')}${esc(e)}</button>`).join("")}
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Contrôles de régularité                                             */
/* ------------------------------------------------------------------ */

const TONS_CONTROLE = { ok: "success", alerte: "error", manquant: "warning", info: "grey" };

/**
 * Les contrôles de régularité d'une affaire, en tableau.
 *
 * Ils servent deux écrans : l'onglet « Synthèse » de l'affaire, et l'atelier de
 * rédaction de la décision — où le rédacteur doit pouvoir vérifier, sans
 * quitter son texte, que la composition de la formation est régulière et que la
 * prescription est acquise. D'où l'export.
 */
export function controlesPanel(store, state, affaire) {
  const controles = controlesRegularite(store.db, affaire, state.ctx);
  if (!controles.length) return "";
  const enDefaut = controles.filter((c) => c.statut === "alerte" || c.statut === "manquant");
  const satisfaits = controles.filter((c) => c.statut !== "alerte" && c.statut !== "manquant");
  const tableau = (liste, caption) => dataTable({
    caption,
    columns: ["Statut", "Point", "Détail"],
    rows: liste.map((c) => ({
      id: c.code,
      cells: [
        `<span class="app-tag app-tag--${TONS_CONTROLE[c.statut] || "grey"}">${esc(LIBELLE_STATUT_CONTROLE[c.statut] || c.statut)}</span>`,
        `<strong>${esc(c.libelle)}</strong>`,
        esc(c.detail),
      ],
    })),
    rowAttr: "",
    class: "app-table--fixed app-table--wrap",
    cols: ["9rem", "11rem", "auto"],
  });
  return panel("Contrôles de régularité", `
    ${enDefaut.length
      ? ui.alert("warning", `${enDefaut.length} point(s) à vérifier`,
        "Ces contrôles signalent une donnée manquante ou une règle non respectée. Les seuils appliqués sont réglés dans « Réglages › Catalogues et délais ».")
      : ui.alert("success", "Tous les contrôles sont satisfaits",
        "Aucune irrégularité détectée au vu des données saisies.")}
    <div class="fr-mt-2w">
      ${tableau(enDefaut.length ? enDefaut : satisfaits, enDefaut.length ? "Points à corriger" : "Contrôles de régularité de l'affaire")}
    </div>
    ${enDefaut.length && satisfaits.length
      ? `<details class="app-controles__reste fr-mt-2w">
          <summary>${satisfaits.length} contrôle${satisfaits.length > 1 ? "s" : ""} satisfait${satisfaits.length > 1 ? "s" : ""} — afficher</summary>
          <div class="fr-mt-2w">${tableau(satisfaits, "Contrôles satisfaits")}</div>
        </details>`
      : ""}
  `, {
    iconName: "shield-line",
    subtitle: enDefaut.length
      ? `${enDefaut.length} point(s) à corriger ou à compléter sur ${controles.length} contrôle(s)`
      : "Vérifié à partir des dates et du paramétrage de l'établissement",
    collapsible: enDefaut.length === 0,
    open: enDefaut.length > 0,
  });
}

/* ------------------------------------------------------------------ */
/* Onglet « Commission » / « Instruction »                             */
/* ------------------------------------------------------------------ */

const SOURCE_MEMBRE = (id) => `m${id}`;
const SOURCE_PERSONNE = (id) => `p${id}`;

/**
 * Membres regroupés par collège.
 *
 * Une composition réglementaire se lit **par collège** — tant de professeurs,
 * tant de maîtres de conférences, tant d'usagers — et le secrétaire ne peut
 * pas deviner le collège d'une personne d'après son seul nom. La liste
 * déroulante les présente donc groupés, dans l'ordre des textes, et par ordre
 * alphabétique à l'intérieur de chaque collège. Les membres dont le collège
 * n'est pas renseigné ferment la marche, sous une étiquette qui le dit.
 */
function membresParCollege(store, state, membres) {
  const nom = (m) => str(state.ctx.v("Membres", m, "Nom_complet")).trim() || `#${m.id}`;
  const groupes = new Map();
  for (const m of membres) {
    const cle = collegeDe(m) || "inconnu";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(m);
  }
  const cles = [...Object.keys(COLLEGES).filter((c) => groupes.has(c)), ...(groupes.has("inconnu") ? ["inconnu"] : [])];
  return cles.map((cle) => ({
    label: cle === "inconnu" ? "Collège non précisé" : (COLLEGES[cle]?.label || cle),
    membres: [...groupes.get(cle)].sort((a, b) => nom(a).localeCompare(nom(b), "fr")),
  }));
}

/**
 * La liste des intervenants d'une affaire.
 *
 * Elle ne propose que des **membres de la section disciplinaire** : c'est d'eux
 * que la formation se compose, et le répertoire des personnes — qui mêle
 * usagers, personnels et tiers — n'a pas à figurer dans un menu où l'on désigne
 * qui instruit et qui juge. L'intervenant qui n'est pas membre de la section —
 * un rapporteur pris hors de la section, par exemple — se saisit **librement**,
 * et se marque alors « Hors section ».
 *
 * Une fiche qui porte déjà une personne du répertoire garde ce choix sous les
 * yeux du secrétaire : la règle dit ce que la liste **propose**, et une
 * sélection qui disparaîtrait de l'écran ferait croire à une saisie perdue.
 * C'est la même raison qui garde le membre dont le mandat a expiré.
 */
function intervenantSourceSelect(store, state, row, options) {
  const value = row.Membre ? SOURCE_MEMBRE(row.Membre) : row.Personne ? SOURCE_PERSONNE(row.Personne) : "";
  // Le membre déjà choisi peut avoir quitté la section, ou son mandat avoir
  // expiré : il reste proposé, sinon la sélection disparaîtrait de la fiche.
  const membres = [...options.membres];
  if (row.Membre && !membres.some((m) => Number(m.id) === Number(row.Membre))) {
    const courant = store.byId("Membres", row.Membre);
    if (courant) membres.push(courant);
  }
  // Idem pour une personne du répertoire : ce choix n'est plus proposé, mais une
  // fiche qui le porte encore ne doit pas se relire comme un champ vide. Elle
  // forme seule son groupe — « Hors section » —, qui dit pourquoi aucun collège
  // ne l'accompagne.
  const personneCourante = row.Personne ? store.byId("Personnes", row.Personne) : null;
  const groupes = membresParCollege(store, state, membres);
  return `
  <select class="fr-select" aria-label="Intervenant" data-action="intervenant-source" data-record="${row.id}">
    <option value="" ${value ? "" : "selected"}>— Saisie libre —</option>
    ${personneCourante ? `<optgroup label="Hors section">
      <option value="${SOURCE_PERSONNE(personneCourante.id)}" ${value === SOURCE_PERSONNE(personneCourante.id) ? "selected" : ""}>${esc(str(state.ctx.v("Personnes", personneCourante, "Nom_complet")).trim())}</option>
    </optgroup>` : ""}
    ${groupes.map((g) => `<optgroup label="${esc(g.label)}">
      ${g.membres.map((m) => `<option value="${SOURCE_MEMBRE(m.id)}" ${value === SOURCE_MEMBRE(m.id) ? "selected" : ""}>${esc(str(state.ctx.v("Membres", m, "Nom_complet")).trim())}</option>`).join("")}
    </optgroup>`).join("")}
  </select>`;
}

function intervenantRow(store, state, affaire, row, options) {
  const ctx = state.ctx;
  const sujet = sujetDuDossier(ctx, affaire);
  const nom = str(ctx.v("Intervenants", row, "Nom_complet")).trim() || "cet intervenant";
  const courriel = ctx.v("Intervenants", row, "Email");
  const libre = !row.Membre && !row.Personne;
  const hors = ctx.v("Intervenants", row, "Hors_section");
  const genus = ctx.v("Intervenants", row, "Membre_Genre");
  const roles = options.roles || ROLES_INTERVENANT;
  // Le collège n'est pas saisi ici : il est **repris de la fiche du membre**
  // (Réglages › Membres), où il est décrit une fois pour toutes. Un intervenant
  // hors section n'a pas de fiche de membre : c'est la mention « Hors section »
  // qui tient sa place, et qui dit pourquoi il n'y a pas de collège.
  const membre = row.Membre ? store.byId("Membres", row.Membre) : null;
  const college = membre ? str(ctx.v("Membres", membre, "College")).trim() : "";
  return `
  <tr>
    <td>${intervenantSourceSelect(store, state, row, options)}
      ${libre ? `<input class="fr-input fr-mt-1v" type="text" placeholder="Nom saisi librement" aria-label="Nom"
        data-bind="Intervenants|Nom_libre" data-record="${row.id}" value="${esc(str(row.Nom_libre))}">` : ""}
    </td>
    <td>
      <select class="fr-select" aria-label="Rôle" data-bind="Intervenants|Role" data-record="${row.id}">
        ${roles.map((r) => `<option value="${esc(r)}" ${row.Role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}
      </select>
    </td>
    <td>${college ? esc(college) : hors ? "" : "—"}
      ${hors ? `<p class="${college ? "fr-mt-1v " : ""}fr-mb-0"><span class="app-tag app-tag--blue">Hors section</span></p>` : ""}
    </td>
    <td>
      <select class="fr-select" aria-label="Statut" data-bind="Intervenants|Statut" data-record="${row.id}">
        <option value="">—</option>
        ${STATUTS_INTERVENANT.map((s) => `<option value="${esc(s)}" ${row.Statut === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
      </select>
    </td>
    <td>${courrielCell(courriel, sujet, nom)}</td>
    <td>${genus === "F" ? "Mme" : genus === "M" ? "M." : "—"}</td>
    <td class="app-cell-action">${ecrireLigne(courriel, sujet, nom)}${ui.iconButton("delete-bin-line", { title: "Retirer cet intervenant", attrs: `data-delete="Intervenants:${row.id}"` })}</td>
  </tr>`;
}

function formationEditor(store, state, affaire) {
  const ctx = state.ctx;
  const section = affaire.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const ec = estEC(section);
  const rows = ctx.children("Intervenants", affaire);
  const heritage = ctx.children("Commissions", affaire);
  const eligibles = store.table("Membres").filter(
    (m) => ctx.v("Membres", m, "En_fonction") && Number(m.Section) === Number(affaire.Section)
  );
  const d = procedure(section);
  const r811 = suitProcedureR811_40(affaire);
  // Les rôles proposés suivent la procédure : un rapporteur adjoint pour les
  // usagers, une commission d'instruction de deux membres pour les
  // enseignants-chercheurs.
  const roles = d.instruction.mode === "commission"
    ? ROLES_INTERVENANT.filter((r) => r !== "Rapporteur adjoint")
    : ROLES_INTERVENANT.filter((r) => r !== "Membre de la commission d'instruction");
  const options = {
    roles,
    membres: eligibles.length ? eligibles : store.table("Membres").filter((m) => Number(m.Section) === Number(affaire.Section) || !m.Section),
  };

  const body = rows.length
    ? rows.map((r) => intervenantRow(store, state, affaire, r, options)).join("")
    : `<tr><td colspan="7">${emptyState(
      heritage.length
        ? "Cette affaire porte encore la composition du document d'origine."
        : ec ? "Aucun intervenant désigné pour cette affaire." : "Aucun membre dans la commission.",
      { iconName: "group-line" }
    )}</td></tr>`;

  // Une affaire héritée du document d'origine : on la lit, et l'outil propose
  // de la reprendre dans `Intervenants` — sans jamais écrire dans la table
  // d'héritage elle-même.
  const heritageBloc = heritage.length
    ? heritage.length && rows.length
      ? ""
      : `
    <div class="fr-mt-2w">
      ${ui.alert("info", "Composition héritée du document d'origine",
        `${heritage.length} ligne(s) de la table d'origine « Commissions » concernent cette affaire. Elles sont `
        + "lisibles ci-dessous, et reprises à l'identique par les comptes rendus, mais elles ne se modifient plus : "
        + "la composition se saisit désormais dans les intervenants.")}
      <div class="fr-table fr-table--sm app-table--dense fr-mt-2w">
        <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
          <table>
            <caption class="fr-sr-only">Composition héritée</caption>
            <thead><tr><th scope="col">Membre</th><th scope="col">Rôle</th><th scope="col">Courriel</th></tr></thead>
            <tbody>${heritage.map((c) => `<tr>
              <td>${esc(str(ctx.v("Commissions", c, "Membre_Nom_complet")).trim()) || "—"}</td>
              <td>${esc(str(c.Role))}</td>
              <td>${esc(str(ctx.v("Commissions", c, "Email")))}</td>
            </tr>`).join("")}</tbody>
          </table>
        </div></div></div>
      </div>
      <div class="fr-mt-2w">
        ${button("Reprendre la composition", { variant: "primary", size: "sm", iconName: "arrow-right-line", action: "convertir-commissions" })}
      </div>
    </div>`
    : "";

  const comp = compositionAttendue(section);
  const misEnCause = ctx.ref("Affaires", affaire, "Mis_en_cause");
  const collegeMEC = collegeDuCorps(misEnCause?.Corps);
  const effectifAttendu = effectifFormation(section, collegeMEC);
  const formationAttendue = comp.formation
    || (comp.formationParGrade && effectifAttendu
      ? `${effectifAttendu} membres, répartis selon le grade de la personne poursuivie`
      : "");
  const hint = d.instruction.mode === "commission"
    ? `L'instruction est confiée à une ${d.instruction.libelle.toLowerCase()} de deux membres : déclarez le rapporteur (rôle « Rapporteur ») et le second membre (rôle « Membre de la commission d'instruction »). Un enseignant-chercheur de l'établissement qui n'est pas élu à la section — c'est le cas d'un rapporteur pris hors de la section — se saisit en « Saisie libre » : il est alors marqué « Hors section ». Le président de la formation conduit les débats et signe les documents.`
    : r811
      ? "Cette affaire suit la procédure de l'article R.811-40 : elle ne comporte pas d'instruction, donc ni rapporteur ni rapport. Désignez seulement les membres de la formation appelés à se prononcer, et leur président."
      : `L'affaire est instruite par un rapporteur (rôle « Rapporteur »), assisté d'un rapporteur adjoint pris parmi les usagers (rôle « Rapporteur adjoint »). ${d.instruction.rapporteur}. Le président de la formation signe les documents, le rapporteur et son adjoint alimentent le publipostage. Les membres sont filtrés selon la section de l'affaire et leur présence en fonction.`;

  const groupement = "Les propositions ne comptent que des membres de la section disciplinaire de l'affaire, groupés par collège. "
    + "Une personne qui n'en est pas membre — un rapporteur pris hors de la section, par exemple — s'ajoute par « Ajouter une personne hors section », "
    + "ou se déclare en « Saisie libre » dans la liste : son nom s'écrit alors librement, et elle porte la mention « Hors section ».";

  return panel(libelleFormation(section), `
    <div class="fr-table fr-table--bordered fr-table--sm app-table--dense">
      <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
        <table>
          <caption class="fr-sr-only">${esc(libelleFormation(section))}</caption>
          <thead><tr>
            <th scope="col">Intervenant</th><th scope="col">Rôle</th>
            <th scope="col" title="Collège du membre, repris de sa fiche : il se renseigne dans « Réglages › Membres », et non ici.">Collège</th>
            <th scope="col">Statut</th><th scope="col">Courriel</th><th scope="col">Genre</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div></div></div>
    </div>
    ${heritageBloc}
    <p class="fr-hint-text fr-mt-2w fr-mb-0">${esc(hint)}</p>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      Le <strong>collège</strong> est repris de la fiche du membre — il se renseigne dans « Réglages › Membres »,
      et ne se modifie donc pas ici. Un intervenant hors section n'a pas de fiche de membre :
      la mention « Hors section » tient sa place, et dit pourquoi il n'y a pas de collège.
    </p>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">${esc(groupement)}</p>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      <strong>Composition attendue</strong> — ${esc(formationAttendue || comp.section)}.
      ${comp.formationParGrade ? `Section : ${esc(comp.section)}.` : ""}
      ${esc(comp.quorum?.regle || "")}
    </p>
  `, {
    iconName: "group-line",
    subtitle: section ? str(ctx.v("Sections_disciplinaires", section, "Intitule_de_la_section")) : "",
    actions: `${button("Ajouter un intervenant", { variant: "secondary", size: "sm", iconName: "user-add-line", action: "add-intervenant" })}
      ${button("Ajouter une personne hors section", { variant: "tertiary", size: "sm", iconName: "user-add-line", action: "add-intervenant-hors-section" })}
      ${exportTableButtons({ table: "Intervenants", rows, size: "sm", suffixe: affaireRef(ctx, affaire), titre: "Télécharger la formation et les intervenants de cette affaire" })}`,
  });
}

/* ------------------------------------------------------------------ */
/* Personnes                                                          */
/* ------------------------------------------------------------------ */

function personnePanel(store, state, affaire, section) {
  const ctx = state.ctx;
  const personne = ctx.ref("Affaires", affaire, "Mis_en_cause");
  const ec = estEC(section);

  const selection = `
    <div class="fr-grid-row fr-grid-row--gutters app-form-grid">
      <div class="fr-col-12 fr-col-md-7">${ui.field("Affaires", "Mis_en_cause", ctx, affaire, { store })}</div>
      <div class="fr-col-12 fr-col-md-5 app-field-action">
        ${button("Créer une personne", { variant: "secondary", size: "sm", iconName: "user-add-line", action: "creer-personne" })}
      </div>
    </div>`;

  if (!personne) {
    return panel("Personne mise en cause", `
      ${selection}
      <div class="fr-mt-2w">${emptyState(
        "Aucune personne n'est reliée à cette affaire. Choisissez une fiche du répertoire, ou créez-la : "
        + "elle sera réutilisée si la même personne revient dans une autre affaire.",
        { iconName: "user-line" }
      )}</div>
    `, { iconName: "user-line", subtitle: "Le répertoire évite de ressaisir la même identité d'une affaire à l'autre" });
  }

  const colonnes = ec
    ? ["Prenom", "Nom", "Genre", "Date_de_naissance", "Email", "Telephone", "Corps", "Section_CNU", "Etablissement", "Adresse", "Notes"]
    : ["Prenom", "Nom", "Genre", "Date_de_naissance", "Email", "Telephone", "INE", "Formation_suivie", "Composante", "Adresse", "Notes"];

  // L'identité se **lit** ici, elle ne s'y réécrit pas : la fiche appartient au
  // répertoire et sert à toutes les affaires de la personne. La ressaisir dans
  // le dossier donnait deux endroits où corriger la même adresse — et le risque
  // qu'ils divergent. Le dossier n'édite que ce qui lui est propre : le choix de
  // la personne mise en cause.
  const valeur = (c) => {
    const v = ctx.v("Personnes", personne, c);
    if (v === null || v === undefined || v === "") return "—";
    return ui.col("Personnes", c)?.type === "Date" ? dateCell(v) : esc(str(v));
  };
  const identite = dl(colonnes.map((c) => [ui.colLabel("Personnes", c), valeur(c), true]));

  return panel("Personne mise en cause", `
    ${selection}
    <div class="fr-mt-2w">
      ${fieldset("Identité", identite, {
        hint: "Cette fiche est commune à toutes les affaires de la personne ; elle se modifie au répertoire.",
      })}
    </div>
  `, {
    iconName: "user-line",
    subtitle: "Fiche du répertoire reliée à l'affaire — elle se lit ici, et se modifie au répertoire",
    actions: [
      boutonEcrire("Écrire à la personne", [{
        nom: str(ctx.v("Personnes", personne, "Nom_complet")).trim() || "cette personne",
        email: ctx.v("Personnes", personne, "Email"),
      }], sujetDuDossier(ctx, affaire), { variant: "tertiary" }),
      button("Ouvrir la fiche du répertoire", {
        variant: "tertiary", size: "sm", iconName: "external-link-line",
        attrs: `data-nav="reglages" data-select-table="Personnes" data-select="${personne.id}"`,
      }),
    ].join(" "),
  });
}

function implicationsPanel(store, state, affaire) {
  const ctx = state.ctx;
  const rows = ctx.children("Implications", affaire);
  const sujet = sujetDuDossier(ctx, affaire);
  const body = rows.length
    ? rows.map((x) => {
      const personne = ctx.ref("Implications", x, "Personne");
      const nom = str(ctx.v("Personnes", personne, "Nom_complet")).trim() || "cette personne";
      return `
      <tr>
        <td>
          <select class="fr-select" aria-label="Personne" data-bind="Implications|Personne" data-record="${x.id}">
            <option value="">—</option>
            ${store.table("Personnes").map((p) => `<option value="${p.id}" ${Number(x.Personne) === p.id ? "selected" : ""}>${esc(str(ctx.v("Personnes", p, "Nom_complet")))}</option>`).join("")}
          </select>
        </td>
        <td>
          <select class="fr-select" aria-label="Rôle dans le dossier" data-bind="Implications|Role" data-record="${x.id}">
            <option value="">—</option>
            ${["Co-mis en cause", "Victime", "Témoin", "Défenseur", "Représentant", "Représentant légal", "Interprète", "Autre"].map((r) => `<option value="${esc(r)}" ${x.Role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}
          </select>
        </td>
        <td>${ui.field("Implications", "Informe_le", ctx, x, { store, compact: true })}</td>
        <td>${ui.field("Implications", "Auditionne_le", ctx, x, { store, compact: true })}</td>
        <td>${esc(str(x.Observations))}</td>
        <td class="app-cell-action">${ecrireLigne(ctx.v("Personnes", personne, "Email"), sujet, nom)}${ui.iconButton("delete-bin-line", { title: "Retirer cette personne", attrs: `data-delete="Implications:${x.id}"` })}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="6">${emptyState("Aucune autre personne au dossier.", { iconName: "team-line" })}</td></tr>`;

  return panel("Autres personnes du dossier", `
    <div class="fr-table fr-table--bordered fr-table--sm app-table--dense">
      <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
        <table>
          <caption class="fr-sr-only">Personnes du dossier</caption>
          <thead><tr>
            <th scope="col">Personne</th><th scope="col">Rôle</th><th scope="col">Informée le</th>
            <th scope="col">Auditionnée le</th><th scope="col">Observations</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div></div></div>
    </div>
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      Victimes, témoins, co-mis en cause, représentants : la personne mise en cause principale se déclare au-dessus,
      les autres se déclarent ici. Chacune renvoie à une fiche du répertoire.
    </p>
  `, {
    iconName: "team-line",
    subtitle: "Qui d'autre intervient dans le dossier",
    actions: `${button("Ajouter une personne", { variant: "secondary", size: "sm", iconName: "user-add-line", action: "add-implication" })}
      ${exportTableButtons({ table: "Implications", rows, size: "sm", suffixe: affaireRef(ctx, affaire), titre: "Télécharger les personnes du dossier" })}`,
  });
}

function tabPersonnes(store, state, a, section) {
  return `
<div class="app-stack">
  ${personnePanel(store, state, a, section)}
  ${implicationsPanel(store, state, a)}
</div>`;
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */
//
// Écrire aux gens d'une affaire : la présidence de la section, celle de la
// commission, les membres, les rapporteurs, le secrétariat. Ce sont des liens
// `mailto:` — le geste le plus direct, et le seul qui ne demande ni serveur ni
// compte : le message s'ouvre dans le logiciel de messagerie du poste, déjà
// adressé, l'affaire rappelée en objet.
//
// « Écrire aux membres de la commission » écrit à la commission **entière** :
// son président, ses rapporteurs et ceux qui y siègent. Les rôles restent
// classés à part — un bouton pour la présidence, un pour les rapporteurs —, mais
// informer la commission, c'est l'informer toute : une même adresse n'est
// inscrite qu'une fois.
//
// L'adresse n'est jamais saisie ici : elle vient de la fiche du membre
// (Réglages › Membres) ou de celle de la personne (répertoire des personnes).
// Quand une fiche n'en porte pas, le bouton correspondant n'existe pas — et le
// panneau le dit, au lieu de fabriquer une adresse plausible.

/** Rôles qui conduisent la formation (au sens de `ROLES_INTERVENANT`). */
const ROLES_PRESIDENCE_INTERVENANT = ["Président de la formation", "Président"];
/** Rôles qui instruisent le dossier. */
const ROLES_RAPPORT_INTERVENANT = ["Rapporteur", "Rapporteur adjoint"];
/** Rôles qui siègent — hors présidence et hors rapport, comptés à part. */
const ROLES_MEMBRES_INTERVENANT = [
  "Membre de la formation",
  "Membre de la commission d'instruction",
  "Assesseur",
  "Représentant des usagers",
  "Membre",
];

/** Sujet du courrier : la référence du dossier, pour que rien ne se perde. */
function sujetDuDossier(ctx, affaire) {
  return `Dossier ${affaireRef(ctx, affaire)} — ${affaireName(ctx, affaire)}`;
}

/** Adresse `mailto:` vers une ou plusieurs personnes, sujet compris. */
function mailtoDe(emails, sujet) {
  const mails = [...new Set(emails.map((e) => String(e ?? "").trim()).filter(Boolean))];
  if (!mails.length) return "";
  return `mailto:${mails.join(",")}?subject=${encodeURIComponent(sujet)}`;
}

/** Adresses et noms des gens d'un groupe qui en ont une. */
const avecAdresse = (destinataires) => destinataires.filter((x) => String(x.email || "").trim());
const adressesDe = (destinataires) => avecAdresse(destinataires).map((x) => x.email);
const nomsDe = (destinataires) => avecAdresse(destinataires).map((x) => x.nom).filter(Boolean);

/**
 * Bouton d'écriture d'un groupe : c'est un vrai lien, non une commande — le
 * clic ouvre le logiciel de messagerie. Le nombre de destinataires est porté
 * par l'intitulé, leurs noms par l'infobulle : on voit à qui l'on écrit.
 */
function boutonEcrire(label, destinataires, sujet, opts = {}) {
  const mails = [...new Set(adressesDe(destinataires))];
  if (!mails.length) return "";
  const { iconName = "mail-line", variant = "secondary", size = "sm" } = opts;
  const noms = nomsDe(destinataires).join(", ");
  const intitule = mails.length > 1 ? `${label} (${mails.length})` : label;
  return `<a class="fr-btn fr-btn--${variant}${size ? ` fr-btn--${size}` : ""}" href="${esc(mailtoDe(mails, sujet))}"${noms ? ` title="Écrire à ${esc(noms)}"` : ""}>
    ${icon(iconName, 'class="fr-mr-1v"')}${esc(intitule)}</a>`;
}

/**
 * Lien d'écriture d'une personne, dans un tableau : son adresse, cliquable.
 * Sans adresse, la cellule le montre — un contact ne se devine pas.
 */
function lienEcrire(email, sujet, nom) {
  const mail = String(email ?? "").trim();
  if (!mail) return "";
  return `<a class="app-contact" href="${esc(mailtoDe([mail], sujet))}" title="Écrire à ${esc(nom)}">${icon("mail-line", 'class="app-contact__icone"')}${esc(mail)}</a>`;
}

/** Cellule « Courriel » d'un tableau. */
function courrielCell(email, sujet, nom) {
  return lienEcrire(email, sujet, nom) || `<span class="fr-text-mention--grey">—</span>`;
}

/**
 * Le bouton d'écriture d'une personne, dans la colonne des actions d'un
 * tableau — à côté du bouton qui la retire : la même ligne, les deux gestes.
 */
function ecrireLigne(email, sujet, nom) {
  const mail = String(email ?? "").trim();
  if (!mail) return "";
  return `<a class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" href="${esc(mailtoDe([mail], sujet))}" title="Écrire à ${esc(nom)}">${icon("mail-line")}<span class="fr-sr-only">Écrire à ${esc(nom)}</span></a>`;
}

/**
 * Les intervenants d'une affaire joignables par courriel, quelle que soit
 * l'origine de la composition : les lignes de `Intervenants`, ou — tant que la
 * composition héritée n'a pas été reprise — celles de la table d'origine
 * `Commissions`. C'est le même choix que `intervenantsDe` (formulas.js) : une
 * affaire non encore convertie doit rester joignable.
 */
function intervenantsAvecCourriel(ctx, affaire) {
  const modernes = ctx.children("Intervenants", affaire);
  if (modernes.length) {
    return modernes.map((row) => ({
      row,
      nom: str(ctx.v("Intervenants", row, "Nom_complet")).trim() || "—",
      role: str(row.Role),
      email: str(ctx.v("Intervenants", row, "Email")).trim(),
    }));
  }
  return ctx.children("Commissions", affaire).map((row) => ({
    row,
    nom: str(ctx.v("Commissions", row, "Membre_Nom_complet")).trim() || "—",
    role: LEGACY_ROLES_INTERVENANT[row.Role] || str(row.Role),
    email: str(ctx.v("Commissions", row, "Email")).trim(),
  }));
}

/**
 * Les personnes d'une affaire joignables par courriel, rangées par fonction.
 * Le président de la section n'appartient pas à la composition de l'affaire :
 * il vient de la section, c'est-à-dire de ses membres.
 */
function contactsDe(store, ctx, affaire, section) {
  const intervenants = intervenantsAvecCourriel(ctx, affaire);
  // La présidence de la section est celle de ses membres ; quand la section est
  // présidée par un vice-président (`VP`), c'est lui qu'on joint — la même
  // règle que la colonne `President` (voir formulas.js).
  const rolePresident = ctx.v("Sections_disciplinaires", section, "VP") ? "Vice-Président" : "Président";
  const presidenceSection = section
    ? store.table("Membres")
      .filter((m) => Number(m.Section) === Number(section.id) && m.Role === rolePresident)
      .map((m) => ({
        nom: str(ctx.v("Membres", m, "Nom_complet")).trim() || "—",
        role: rolePresident,
        email: str(ctx.v("Membres", m, "Email")).trim(),
      }))
    : [];
  const parRole = (roles) => intervenants.filter((x) => roles.includes(x.role));
  const presidenceCommission = parRole(ROLES_PRESIDENCE_INTERVENANT);
  const rapporteurs = parRole(ROLES_RAPPORT_INTERVENANT);
  const membres = parRole(ROLES_MEMBRES_INTERVENANT);
  return {
    intervenants,
    presidenceSection,
    presidenceCommission,
    rapporteurs,
    membres,
    // « Les membres de la commission » : la commission de discipline réunit,
    // autour de ceux qui siègent, celui qui la préside et ceux qui instruisent
    // le dossier. Écrire « aux membres » doit les atteindre tous — un
    // rapporteur et le président sont membres de la commission au même titre
    // que les assesseurs et les représentants des usagers (R.811-27 et s.).
    // Le président vient en tête, comme il préside ; les rôles déjà comptés
    // par un autre bouton sont dédoublonnés à l'adresse (`mailtoDe`).
    commission: [...presidenceCommission, ...rapporteurs, ...membres],
    secretariat: str(ctx.v("Sections_disciplinaires", section, "Email_de_contact")).trim(),
  };
}

/**
 * Panneau « Contacts » d'une affaire : qui l'on peut joindre, et d'un clic.
 *
 * Les boutons ne paraissent que si l'adresse existe — un lien vide ne mène
 * nulle part. Mais les personnes sans adresse sont **nommées quand même** :
 * c'est leur fiche qu'il faut compléter, et le panneau dit lesquelles, au lieu
 * de laisser croire que la fonction n'existe pas.
 */
function contactsPanel(store, state, affaire, section) {
  const ctx = state.ctx;
  const c = contactsDe(store, ctx, affaire, section);
  const sujet = sujetDuDossier(ctx, affaire);
  const groupes = [
    { label: "Écrire au président de la section", gens: c.presidenceSection },
    { label: "Écrire au président de la commission", gens: c.presidenceCommission },
    { label: "Écrire aux membres de la commission", gens: c.commission },
    { label: "Écrire aux rapporteurs", gens: c.rapporteurs },
  ];
  const boutons = groupes.map((g) => boutonEcrire(g.label, g.gens, sujet)).filter(Boolean);
  const manquants = [...new Set(
    groupes.flatMap((g) => g.gens)
      .filter((x) => !String(x.email || "").trim())
      .map((x) => x.nom || "—")
  )];
  const secretariat = c.secretariat
    ? `<p class="fr-text--sm fr-mt-2w fr-mb-0"><strong>Secrétariat de la section</strong> —
        ${lienEcrire(c.secretariat, sujet, "le secrétariat de la section")}</p>`
    : "";
  const aQuelquUn = c.intervenants.length || c.presidenceSection.length;
  const corps = boutons.length || secretariat || aQuelquUn
    ? `${boutons.length ? `<div class="app-contacts__actions">${boutons.join("")}</div>` : ""}
      ${secretariat}
      ${manquants.length ? `<p class="fr-hint-text fr-mt-2w fr-mb-0">
        <strong>Adresses manquantes</strong> — ${esc(manquants.join(", "))} : le courriel se renseigne dans la
        fiche du membre (Réglages › Membres) ou dans celle de la personne, et le bouton d'écriture apparaît
        alors ici.${boutons.length || secretariat ? "" : " Aucun contact n'est donc joignable d'un clic pour l'instant."}
      </p>` : ""}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        Ces liens ouvrent votre logiciel de messagerie, l'affaire déjà rappelée en objet. Les adresses
        viennent des fiches : elles ne se saisissent pas ici. Chaque personne s'écrit aussi depuis son nom,
        dans la composition de la formation et dans les autres personnes du dossier.
      </p>`
    : emptyState(
      "Cette affaire n'a ni intervenant ni membre de section à joindre. La composition se déclare dans "
      + "l'onglet de composition de l'affaire, et la section dans Réglages › Sections.",
      { iconName: "mail-line" },
    );
  return panel("Contacts", corps, {
    iconName: "mail-line",
    subtitle: "Écrire aux intervenants et à la section, sans quitter l'affaire",
  });
}

/* ------------------------------------------------------------------ */
/* Onglets                                                             */
/**
 * Rappel de la procédure applicable à l'affaire, repliable : organes,
 * instruction, autorités, délais et textes. C'est exactement l'explication
 * donnée dans la page Aide, calculée ici pour la section de l'affaire.
 */
function noticeProcedurePanel(section) {
  const n = noticeProcedure(section);
  const body = n.blocs.map((b) => `
    <p class="fr-mb-1v"><strong>${esc(b.titre)}</strong></p>
    <ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`).join("");
  return panel("Procédure applicable", `<div class="app-prose">${body}</div>`, {
    iconName: "book-2-line",
    subtitle: n.sousTitre,
    collapsible: true,
  });
}

/* ------------------------------------------------------------------ */

function tabSynthese(store, state, a) {
  const ctx = state.ctx;
  const section = a.Section ? store.byId("Sections_disciplinaires", a.Section) : null;
  const decision = decisionDefinitiveDe(ctx, a);
  const duree = ctx.v("Affaires", a, "Duree_instruction");

  // Jonction : deux affaires ou plus jugées par une seule décision. Le détail
  // se règle dans l'onglet « Décision » ; ici, on le signale.
  const jonction = ctx.v("Affaires", a, "Jonction");
  const numerosJonction = jonction ? numerosDeLaJonction(ctx, jonction) : [];
  const teteDeLaJonction = ctx.v("Affaires", a, "Affaire_de_tete");
  const ligneJonction = jonction
    ? (estAffaireDeTete(ctx, a)
      ? `${esc(numerosJonction.join(", "))} <span class="app-tag app-tag--blue">Affaire de tête</span>`
      : `Jugée avec l'affaire n° ${esc(teteDeLaJonction ? str(ctx.v("Affaires", teteDeLaJonction, "Numero")) : "—")} — ${esc(numerosJonction.join(", "))}`)
    : "";

  const d = procedure(section);
  // Ce bloc ne porte que ce qui **se déduit** : la fiche éditable porte déjà la
  // section, la voie et la séance. Répéter une même donnée en lecture puis en
  // formulaire était précisément ce qui rendait l'onglet illisible.
  const synthese = dl([
    ["Nom complet", esc(str(ctx.v("Affaires", a, "Nom_complet")).trim()) || "—", true],
    ["Régime", section ? esc(regimeOf(section)) : "—", true],
    ["Tutelle", section ? esc(str(section.Tutelle) || "—") : "—", true],
    ["Organe compétent", esc(d.organe), true],
    ["Formation", str(ctx.v("Affaires", a, "Formation")) || "—", true],
    ["Présidence", str(ctx.v("Affaires", a, "President_de_la_formation")) || "—", true],
    [d.instruction.mode === "commission" ? "Rapport (commission d'instruction)" : "Rapporteur",
      ctx.v("Affaires", a, "Rapporteur_hors_section")
        ? `${esc(str(ctx.v("Affaires", a, "Rapporteur")))} <span class="app-tag app-tag--blue">hors section</span>`
        : esc(str(ctx.v("Affaires", a, "Rapporteur"))) || "—", true],
    ligneJonction ? ["Affaires jointes", ligneJonction, true] : null,
    ["Décision", decision ? esc(str(ctx.v("Decisions", decision, "Libelle_decision"))) : "—", true],
    ["Durée d'instruction", duree === null || duree === undefined ? "—" : `${duree} jour(s)`, true],
  ]);

  const colonnesSaisine = [
    "Numero", "Date_de_saisine", "Date_des_faits",
    ...(d.prescription.applicable ? ["Date_de_connaissance_des_faits"] : []),
    "Etat", "Section", "Voie",
    "Autorite_de_saisine", "Secretaire", "Composante",
  ];

  // Une fiche se **lit** d'abord : chaque bloc se présente en lecture, et son
  // bouton « Modifier » l'ouvre à la saisie. Trente et un champs ouverts
  // d'emblée ne distinguaient pas ce qui se consulte de ce qui s'écrit ; ici,
  // la page se lit d'un trait, et l'on n'ouvre que le bloc à corriger.
  const enEdition = (cle) => !!state.affaires.edition[cle];
  const boutonBloc = (cle) => (enEdition(cle)
    ? button("Terminer", { variant: "tertiary", size: "sm", iconName: "check-line", action: "affaire-edition", attrs: `data-record="${cle}"` })
    : button("Modifier", { variant: "secondary", size: "sm", iconName: "pencil-line", action: "affaire-edition", attrs: `data-record="${cle}"` }));

  const fiche = panel("Fiche de l'affaire", `
    ${fieldset("Dossier de pièces", formGrid("Affaires", ["Lien_vers_le_dossier"], ctx, a, {
      store,
      lecture: !enEdition("dossier"),
    }), {
      // Le dossier de pièces n'est pas un champ de plus : c'est le seul lien
      // vers le lieu où les pièces sont tenues, hors de l'outil. Il a donc son
      // bloc, et le contrôle qui l'ouvre est dans le bandeau, au-dessus, sur
      // tous les onglets de l'affaire.
      hint: "Les pièces sont tenues hors de l'outil : cette adresse est le seul lien qui y mène. « Ouvrir le dossier » figure dans le bandeau ci-dessus, et le rôle de la séance la rappelle.",
      actions: boutonBloc("dossier"),
      collapsible: true,
      open: !dossierDeclare(a) || enEdition("dossier"),
    })}
    ${fieldset("Saisine, instruction et suivi", formGrid("Affaires", colonnesSaisine, ctx, a, {
      store,
      // L'attribution se décide entre propriétaires : elle se lit ici, mais ne
      // se modifie pas depuis la fiche (vue « Attribution »).
      locked: peutVoirTout(state) ? [] : ["Secretaire"],
      // Une seule voie est proposée lorsque l'article R.811-40 n'est pas
      // applicable à la section de l'affaire.
      choicesFor: { Voie: voiesPour(section) },
      lecture: !enEdition("saisine"),
    }), {
      actions: boutonBloc("saisine"),
      hint: peutVoirTout(state)
        ? ""
        : "L'attribution d'une affaire à un secrétaire relève des propriétaires du document (vue « Attribution »).",
    })}
    ${fieldset("Faits et motifs", formGrid("Affaires", ["Motifs", "Motif"], ctx, a, {
      store, single: true,
      rowsFor: { Motifs: motifsPour(store.db, regimeOf(section), section) },
      lecture: !enEdition("faits"),
    }), { actions: boutonBloc("faits") })}
    ${fieldset("Convocation et séance", `
      <div class="app-row fr-mb-2v">${boutonBloc("convocation")}</div>
      ${formGrid("Affaires", [
        "Seance_d_examen", "Date_de_convocation", "Mode_de_convocation", "Ordre_de_passage", "SE_Heure_de_passage",
      ], ctx, a, { store, lecture: !enEdition("convocation") })}
    `, {
      collapsible: true,
      open: enEdition("convocation"),
      hint: "Ces informations se retrouvent dans l'onglet « Séance d'examen », où le rôle complet se lit.",
    })}
  `, {
    iconName: "folder-2-line",
    subtitle: "Saisine, faits, convocation et suivi : la fiche de l'affaire, une seule fois — « Modifier » ouvre un bloc à la saisie",
  });

  // Les valeurs **déduites** de la fiche : ce que l'outil calcule à partir de la
  // saisine, de la composition et des actes, et qui ne se saisit pas. Elles
  // étaient jusqu'ici mêlées à la fiche de lecture — au point que la même
  // donnée — la section, la voie, la séance — se lisait deux fois, en lecture
  // puis en formulaire. Elles ont ici leur bloc, qui dit ce qu'il est.
  const deduit = panel("Valeurs déduites", synthese, {
    iconName: "information-line",
    subtitle: "Calculées à partir de la saisine, de la composition et des actes",
    collapsible: true,
  });

  return `
<div class="app-stack">
  ${fiche}
  <div class="app-deux-colonnes">
    <div class="app-stack">
      ${contactsPanel(store, state, a, section)}
    </div>
    <div class="app-stack">
      ${controlesPanel(store, state, a)}
      ${deduit}
    </div>
  </div>
  ${noticeProcedurePanel(section)}
</div>`;
}

function tabSeance(store, state, a) {
  const ctx = state.ctx;
  const seance = a.Seance_d_examen ? store.byId("Seances_d_examen", a.Seance_d_examen) : null;

  const voisines = seance
    ? sortRecords(
        affairesVisibles(store, state, store.table("Affaires"))
          .filter((x) => Number(x.Seance_d_examen) === Number(seance.id) && x.id !== a.id),
        (x) => String(x.SE_Heure_de_passage || ""), "asc")
    : [];

  const autres = voisines.length
    ? `<div class="app-list app-list--grille">${voisines.slice(0, 3).map((x) => `
      <div class="app-list__item app-list__item--statique">
        <span class="app-list__top">
          <span class="app-list__ref">${esc(str(x.SE_Heure_de_passage)) || "—"}</span>
          ${badge(x.Etat)}
        </span>
        <span class="app-list__name">${esc(affaireRef(ctx, x))} — ${esc(affaireName(ctx, x))}</span>
      </div>`).join("")}</div>`
    : emptyState("Cette affaire est la seule inscrite à cette séance.", { iconName: "calendar-line" });

  const roleBody = seance
    ? `${autres}
    <div class="app-row fr-mt-2w">
      ${voisines.length > 3 ? `<p class="fr-text--sm fr-mb-0 app-muted">${voisines.length + 1} affaires inscrites à cette séance.</p>` : ""}
      ${button(voisines.length ? "Voir le rôle complet" : "Ouvrir la séance", {
        variant: "secondary", size: "sm", iconName: "list-unordered",
        attrs: `data-open="calendrier/seances" data-select-table="Seances_d_examen" data-select="${seance.id}"`,
      })}
    </div>`
    : emptyState("Aucune séance affectée à cette affaire : le rôle de la séance se compose depuis la page « Séances ».", { iconName: "calendar-line" });

  const details = seance
    ? dl([
        ["Type", esc(str(seance.Type)) || "—", true],
        ["Libellé", esc(str(ctx.v("Seances_d_examen", seance, "Libelle"))), true],
        ["Date", dateCell(seance.Date), true],
        ["Salle", esc(str(seance.Salle)) || "—", true],
        ["Adresse", esc(str(seance.Adresse)) || "—", true],
        ["Lien visio", seance.Lien_visio
          ? `<a href="${esc(seance.Lien_visio)}" target="_blank" rel="noopener" title="${esc(seance.Lien_visio)}">Ouvrir la visioconférence</a>`
          : "—", true],
      ])
    : "";

  const r811 = suitProcedureR811_40(a);

  return `
<div class="fr-grid-row fr-grid-row--gutters">
  <div class="fr-col-12 fr-col-lg-5">
    ${panel("Affectation", `
      ${r811
        ? ui.alert("info", "Voie de l'article R.811-40", "Cette affaire suit la procédure de l'article R.811-40 : elle ne comporte pas de phase d'instruction. L'affaire est examinée en séance, au cours de laquelle la formation se prononce sur la proposition de sanction.")
        : ""}
      ${formGrid("Affaires", ["Seance_d_examen", "SE_Heure_de_passage"], ctx, a, { store, single: true })}
      ${seance ? `<div class="fr-mt-2w">${details}</div>` : emptyState("Aucune séance affectée à cette affaire.", { iconName: "calendar-line" })}
    `, {
      iconName: "calendar-line",
      actions: seance
        ? button("Imprimer le rôle", { variant: "tertiary", size: "sm", iconName: "printer-line", attrs: `data-action="print-role" data-record="${seance.id}"` })
        : button("Planifier une séance", { variant: "secondary", size: "sm", iconName: "add-line", action: "add-seance" }),
    })}
  </div>
  <div class="fr-col-12 fr-col-lg-7">
    ${panel("Rôle de la séance", roleBody, { iconName: "list-unordered" })}
  </div>
</div>`;
}

function recoursPanel(store, state, decision) {
  const ctx = state.ctx;
  const rows = recoursDe(ctx, decision);
  // Une décision qui n'ouvre pas de recours — un classement, une relaxe, une
  // mesure avant dire droit — ne se conteste pas : le panneau le dit et ne
  // propose pas d'en former un. S'il en existe malgré tout, ils restent
  // visibles et supprimables : les contrôles de régularité les signalent.
  const recourable = estSusceptibleDeRecours(decision);
  const body = rows.length
    ? rows.map((r) => `
      <tr>
        <td>${ui.field("Recours", "Juridiction", ctx, r, { store, compact: true })}</td>
        <td>${ui.field("Recours", "Type_de_recours", ctx, r, { store, compact: true })}</td>
        <td>${ui.field("Recours", "Date_d_introduction", ctx, r, { store, compact: true })}</td>
        <td>${ui.field("Recours", "Issue", ctx, r, { store, compact: true })}</td>
        <td class="app-cell-action">${ui.iconButton("delete-bin-line", { title: "Supprimer ce recours", attrs: `data-delete="Recours:${r.id}"` })}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">${emptyState("Aucun recours formé contre cette décision.", { iconName: "scales-3-line" })}</td></tr>`;
  return panel("Recours", `
    ${recourable ? "" : alert("info", "Aucun recours ouvert",
      "Seule une décision prononçant une sanction ou l'abandon des poursuites peut faire l'objet d'un "
      + "recours. Aucune autre décision, et aucune ordonnance, ne peut être contestée.")}
    <div class="fr-table fr-table--bordered fr-table--sm app-table--dense">
      <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
        <table>
          <caption class="fr-sr-only">Recours formés contre la décision</caption>
          <thead><tr>
            <th scope="col">Juridiction</th><th scope="col">Type</th><th scope="col">Introduit le</th><th scope="col">Issue</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div></div></div>
    </div>
  `, {
    iconName: "scales-3-line",
    subtitle: recourable ? "Appels et recours contentieux" : "Décision insusceptible de recours",
    collapsible: true,
    actions: `${recourable ? button("Ajouter un recours", { variant: "secondary", size: "sm", iconName: "add-line", action: "add-recours" }) : ""}
      ${rows.length ? exportTableButtons({
        table: "Recours",
        rows,
        size: "sm",
        suffixe: affaireRef(ctx, store.byId("Affaires", decision.Affaire)),
        titre: "Télécharger les recours formés contre cette décision",
      }) : ""}`,
  });
}

/**
 * Panneau « Affaires jointes » de l'onglet Décision.
 *
 * La jonction fait juger ensemble plusieurs affaires — chacune avec son numéro,
 * sa personne mise en cause et ses documents — par **une seule décision**.
 * Seule la relation est enregistrée (une affaire de tête, des affaires
 * jointes) : rien n'est fusionné, aucune donnée n'est recopiée. C'est ce qui
 * rend l'opération **réversible** : défaire la jonction suffit à rendre chaque
 * affaire à elle-même.
 *
 * Trois situations, donc : l'affaire est seule, elle est jointe à une autre, ou
 * elle est l'affaire de tête — celle qui porte la décision commune.
 */
function jonctionPanel(store, state, a) {
  const ctx = state.ctx;
  const jonction = ctx.v("Affaires", a, "Jonction");
  const numero = (x) => str(ctx.v("Affaires", x, "Numero")) || `#${x.id}`;
  const lien = (x) => `<button type="button" class="fr-link" data-open="affaires"`
    + ` data-select-table="Affaires" data-select="${x.id}">${esc(numero(x))}</button>`;
  const ligne = (x) => {
    const tete = Number(x.id) === Number(jonction.Affaire_de_tete);
    const ici = Number(x.id) === Number(a.id);
    return `<li>${lien(x)} — ${esc(affaireName(ctx, x))} `
      + (tete ? tag("Affaire de tête", "blue") : "")
      + (ici ? tag("Cette affaire", "grey") : "")
      + "</li>";
  };

  // L'affaire jugée seule n'a pas de panneau : il n'y a rien à montrer. Le
  // geste qui la joint vit dans les actions de l'onglet « Décision », là où la
  // jonction a un effet — une seule décision pour l'ensemble.
  if (!jonction) return "";

  const membres = affairesDeLaJonction(ctx, jonction);
  const tete = membres[0] || null;
  const estTete = Number(jonction.Affaire_de_tete) === Number(a.id);
  const autres = membres.filter((x) => Number(x.id) !== Number(a.id));
  const decision = decisionDefinitiveDe(ctx, a);
  const propres = decisionsDefinitivesDe(ctx, a);
  const conflit = !estTete && propres.length
    ? alert("warning", "Décision en double",
      "Cette affaire est jointe, mais elle porte sa propre décision définitive : la décision doit être "
      + "unique pour l'ensemble. Supprimez-la, ou défaites la jonction.")
    : "";

  const liste = `<ul class="fr-mb-2w">${membres.map(ligne).join("")}</ul>`;
  const entete = estTete
    ? `<p class="fr-text--sm fr-mb-2w">
        Cette affaire est <strong>l'affaire de tête</strong> : c'est elle qui porte la décision commune,
        et c'est son numéro qui identifie l'ensemble dans le registre des décisions. Les affaires
        jointes lisent la même décision, et gardent leurs propres courriers.
      </p>`
    : `<p class="fr-text--sm fr-mb-2w">
        Cette affaire est <strong>jointe à l'affaire n° ${esc(tete ? numero(tete) : "—")}</strong> :
        elle est jugée par la même décision, saisie sur l'affaire de tête. Son numéro, sa personne mise
        en cause et ses documents lui restent propres.
      </p>`;
  const details = !estTete
    ? dl([
      ["Jonction du", dateCell(jonction.Date_de_la_jonction) || "—", true],
      ["Motif", esc(str(jonction.Motif)) || "—", true],
      ["Décision commune", decision
        ? esc(str(ctx.v("Decisions", decision, "Libelle_decision"))) || "—"
        : tag("À intervenir", "warning"), true],
    ])
    : fieldset("Jonction", formGrid("Jonctions", ["Date_de_la_jonction", "Motif", "Observations"], ctx, jonction, {
      store,
      hint: "Ces informations valent pour l'ensemble des affaires jointes.",
    }));

  const actions = estTete
    ? `${button("Joindre une autre affaire…", {
      variant: "secondary", size: "sm", iconName: "add-line", action: "joindre-affaire",
    })} ${button("Défaire la jonction", {
      variant: "tertiary-no-outline", size: "sm", iconName: "link-unlink", action: "defaire-jonction",
    })}`
    : `${button("Déjoindre cette affaire", {
      variant: "secondary", size: "sm", iconName: "link-unlink", action: "dejoindre-affaire",
    })} ${button("En faire l'affaire de tête", {
      variant: "tertiary-no-outline", size: "sm", iconName: "arrow-up-line", action: "jonction-tete",
      title: "La décision commune sera portée par cette affaire au lieu de celle qui la porte aujourd'hui",
    })}`;

  return panel("Affaires jointes", `
    ${conflit}
    ${entete}
    ${liste}
    ${details}
  `, {
    iconName: "links-line",
    subtitle: estTete
      ? `Cette affaire porte la décision commune aux affaires jointes (${esc(numerosDeLaJonction(ctx, jonction).join(", "))})`
      : `Jugée avec l'affaire n° ${esc(tete ? numero(tete) : "—")} par une décision unique — ${autres.length} autre(s) affaire(s) dans le groupe`,
    actions,
  });
}

function tabDecision(store, state, a) {
  const ctx = state.ctx;
  const section = a.Section ? store.byId("Sections_disciplinaires", a.Section) : null;
  const toutes = ctx.children("Decisions", a);
  const definitives = toutes.filter((x) => str(x.Nature) !== NATURE_INTERLOCUTOIRE);
  const avantDireDroit = toutes.filter((x) => str(x.Nature) === NATURE_INTERLOCUTOIRE);
  // Décision définitive de l'affaire : la sienne, ou — lorsque l'affaire est
  // jointe — celle de son affaire de tête, rendue pour l'ensemble du groupe.
  const decision = decisionDefinitiveDe(ctx, a);
  const porteuse = affairePorteuseDeLaDecision(ctx, a);
  const jointe = Number(porteuse?.id) !== Number(a.id);
  // La décision affichée peut venir de l'affaire de tête (c'est la décision
  // commune) ou être propre à l'affaire — notamment lorsque, jointe, elle en
  // porte encore une : les contrôles le signalent, et l'écran ne doit pas
  // l'appeler « commune » à tort.
  const decisionDuGroupe = !!decision && Number(decision.Affaire) !== Number(a.id);
  const numeroPorteuse = porteuse ? (str(ctx.v("Affaires", porteuse, "Numero")) || `#${porteuse.id}`) : "";

  // Une affaire ne comporte qu'une décision définitive : la seconde doit être
  // saisie comme décision avant dire droit (report, supplément d'instruction).
  const alerteUnique = definitives.length > 1
    ? alert("warning", "Plusieurs décisions définitives",
      `${definitives.length} décisions tranchent le fond. Une affaire ne peut comporter qu'une seule `
      + `décision définitive : les autres doivent porter la nature « ${NATURE_INTERLOCUTOIRE} ».`)
    : "";

  const listeAvantDireDroit = avantDireDroit.length
    ? fieldset("Décisions avant dire droit", `
      ${avantDireDroit.map((x, i) => `
        <div class="fr-mb-3w">
          <div class="app-row app-row--between">
            <p class="fr-text--bold fr-mb-0">Décision avant dire droit ${i + 1}</p>
            <span class="app-row">
              ${button("Rédiger", {
                variant: "tertiary", size: "sm", iconName: "quill-pen-line",
                action: "rediger-decision", attrs: `data-record="${x.id}"`,
                title: "Ouvrir l'atelier de rédaction de cette décision avant dire droit",
              })}
              ${ui.iconButton("delete-bin-line", { title: "Supprimer cette décision", attrs: `data-delete="Decisions:${x.id}"` })}
            </span>
          </div>
          ${formGrid("Decisions", ["Decision", "Motivation", "Date_du_delibere", "Date_butoir_instruction"], ctx, x, {
            store, single: true,
            choicesFor: { Decision: decisionsPour(store.db, regimeOf(section), section, { nature: NATURE_INTERLOCUTOIRE }) },
          })}
        </div>`).join("")}
      <p class="fr-hint-text fr-mb-0">
        Report, supplément d'instruction, expertise… : ces décisions règlent la marche de l'instance
        sans trancher le fond. Elles n'alimentent pas la trame « Décision définitive ». La date butoir
        d'instruction, quand elle est renseignée, fixe le terme de l'instruction de l'affaire : elle
        prime sur l'échéance de la procédure.
      </p>
    `, { hint: "Elles ne sont pas la décision définitive de l'affaire." })
    : "";

  const boutonAvantDireDroit = button("Ajouter une décision avant dire droit", {
    variant: "tertiary", size: "sm", iconName: "add-line", action: "add-decision-interlocutoire",
  });
  // La jonction ne se voit que dans cet onglet : c'est ici qu'elle a un effet —
  // une seule décision pour l'ensemble des affaires jointes.
  const boutonJonction = ctx.v("Affaires", a, "Jonction")
    ? ""
    : button("Joindre des affaires", {
      variant: "tertiary", size: "sm", iconName: "links-line", action: "joindre-affaire",
      title: "Faire juger plusieurs affaires par une seule décision — chacune garde son numéro et ses documents",
    });

  if (!decision) {
    return panel("Décision", `
      ${alerteUnique}
      ${emptyState(
        jointe
          ? `Aucune décision définitive n'est enregistrée : celle de l'affaire jointe est portée par l'affaire de tête n° ${numeroPorteuse}.`
          : "Aucune décision définitive n'est enregistrée pour cette affaire. Enregistrez-la — sa nature, sa sanction, ses dates —, puis « Rédiger la décision » ouvrira son atelier.",
        { iconName: "scales-3-line", action: button(
          jointe ? "Enregistrer la décision commune" : "Enregistrer la décision",
          { variant: "primary", iconName: "add-line", action: "add-decision" }
        ) }
      )}
    `, {
      iconName: "scales-3-line",
      subtitle: jointe ? `Décision commune, portée par l'affaire n° ${numeroPorteuse}` : "Une seule décision définitive par affaire",
      actions: `${boutonJonction} ${boutonAvantDireDroit}`,
    }) + listeAvantDireDroit;
  }

  const enCours = ctx.v("Decisions", decision, "En_cours_");
  const delai = ctx.v("Decisions", decision, "Delai_de_traitement");
  const terme = ctx.v("Decisions", decision, "Terme_de_la_sanction");
  // Une décision n'ouvre un recours que si elle prononce une sanction ou
  // l'abandon des poursuites : sinon, ni délai de recours, ni recours formés.
  const recourable = estSusceptibleDeRecours(decision);

  return `
<div class="app-stack">
  ${jonctionPanel(store, state, a)}
  ${alerteUnique}
  ${jointe && decisionDuGroupe ? alert("info", "Décision commune",
    `Cette décision est celle de l'affaire n° ${numeroPorteuse} : elle vaut pour toutes les affaires jointes. `
    + "Les modifications faites ici s'y appliquent également.") : ""}
  <div class="fr-grid-row fr-grid-row--gutters">
    <div class="fr-col-12 fr-col-lg-7">
      ${panel("Décision définitive", `
        ${fieldset("Décision", formGrid("Decisions", [
          "Nature", "Sanction", "Decision", "Motivation",
        ], ctx, decision, {
          store, single: true,
          // Seules les sanctions et les textes applicables au régime et à la
          // tutelle de la section sont proposés.
          rowsFor: { Sanction: sanctionsPour(store.db, regimeOf(section), section) },
          choicesFor: { Decision: decisionsPour(store.db, regimeOf(section), section) },
        }))}
        <details class="app-plus-de-champs">
          <summary>Plus de champs : dates, notification et durées</summary>
          <div class="fr-mt-2w">
            ${fieldset("Dates et notification", formGrid("Decisions", [
              "Date_du_delibere", "Date_de_notification", "Mode_de_notification", "Date_de_l_accuse_reception",
            ], ctx, decision, { store }))}
            ${fieldset("Durées", formGrid("Decisions", [
              "Duree_totale_d_exclusion_mois_", "Duree_d_exclusion_sursis_", "Sursis_",
            ], ctx, decision, { store }), {
              hint: "La sanction du catalogue porte le groupe et la durée maximale ; les durées saisies ici sont celles prononcées.",
            })}
          </div>
        </details>
      `, {
        iconName: "scales-3-line",
        subtitle: decisionDuGroupe
          ? `Décision commune, portée par l'affaire n° ${numeroPorteuse}`
          : "Elle tranche le fond : la trame « Décision définitive » en reprend les champs",
        actions: `${button("Rédiger la décision", {
            variant: "primary", size: "sm", iconName: "quill-pen-line",
            action: "rediger-decision", attrs: `data-record="${decision.id}"`,
            title: "Ouvrir l'atelier de rédaction : visas, considérants de principe, dispositif, aperçu A4 et exports",
          })}
          ${boutonJonction}
          ${ui.iconButton("delete-bin-line", { title: "Supprimer la décision", attrs: `data-delete="Decisions:${decision.id}"` })}`,
      })}
    </div>
    <div class="fr-col-12 fr-col-lg-5">
      ${panel("Effets de la décision", dl([
        ["Décision notifiée", esc(str(ctx.v("Decisions", decision, "Libelle_decision"))) || "—", true],
        ["Terme de la sanction", terme === "9999-12-31" ? "Définitive" : dateCell(terme) || "—", true],
        ["Sursis partiel", ctx.v("Decisions", decision, "Sursis_partiel") ? "Oui" : "Non", true],
        ["Statut", enCours ? tag("En cours d'effet", "warning") : tag("Terminée", "success"), true],
        ["Date d'effet", dateCell(ctx.v("Decisions", decision, "Date_d_effet")) || "—", true],
        ...(recourable
          ? [
            ["Recours possible jusqu'au", dateCell(ctx.v("Decisions", decision, "Recours_limite_le")) || "—", true],
            ["Recours formés", String(ctx.v("Decisions", decision, "Nb_recours") ?? 0), true],
          ]
          : [[ "Recours", "Aucun — seule une sanction ou l'abandon des poursuites peut être contesté", true]]),
        ["Délai de traitement", delai === null || delai === undefined ? "—" : `${delai} jour(s)`, true],
        ["Date de saisine", dateCell(decision.Date_de_saisine), true],
        // Registre des actes (NC-0020) : un acte ne se cite que par son numéro.
        ["Numéro d'acte", decision.Numero_acte
          ? `<code>${esc(decision.Numero_acte)}</code>`
          : `<span class="fr-text-mention--grey">non numéroté</span>`, true],
      ]), {
        iconName: "time-line",
        subtitle: "Valeurs calculées : terme, statut, délai de traitement",
        collapsible: true,
      })}
      ${decision.Numero_acte
        ? ""
        : `<div class="fr-mt-2w">${button("Numéroter cet acte", {
          variant: "secondary", size: "sm", iconName: "list-ordered",
          action: "numeroter-actes", attrs: `data-record="${decision.id}"`,
        })}</div>`}
    </div>
  </div>
  ${listeAvantDireDroit}
  ${recoursPanel(store, state, decision)}
</div>`;
}

function tabDocuments(store, state, a) {
  // Les courriers de l'affaire, et rien d'autre : chaque ligne ouvre la
  // sous-vue du document (`#documents/12`), où il se rédige avec toute la
  // largeur de la page. La liste n'a pas à porter un éditeur à l'étroit.
  const docs = state.ctx.children("Generateur", a);
  // Le rapport d'instruction était autrefois un champ de l'affaire. Il se
  // produit désormais comme une pièce : tant que l'ancien texte est là, il est
  // proposé de le reprendre dans un document — l'affaire, elle, ne le porte
  // plus (voir la reprise dans app.js).
  const ancienRapport = str(a.Rapport_d_instruction).trim();
  const ancienRapportDate = a.Date_du_rapport_d_instruction;
  const reprise = (ancienRapport || ancienRapportDate)
    ? alert("info", "Ancien champ « Rapport d'instruction »",
      "Le rapport d'instruction est désormais une pièce à part entière : il se produit comme un document, avec sa propre date et son propre texte. Le texte saisi autrefois sur l'affaire peut être repris tel quel dans un document.",
      button("Reprendre ce texte dans un document", {
        variant: "secondary", size: "sm", iconName: "arrow-right-line", action: "reprendre-rapport",
        attrs: `data-record="${a.id}"`,
      }))
    : "";
  // Un dossier peut porter beaucoup de pièces ; le filtre par trame évite de
  // les parcourir toutes pour retrouver la convocation. Il n'apparaît qu'à
  // partir de quatre pièces, où il commence à servir.
  const tramesDuDossier = [...new Set(docs.map((d) => Number(d.Template) || 0))]
    .map((id) => (id ? store.byId("Trames", id) : null))
    .filter(Boolean);
  const trameChoisie = state.filters.affaireDocsTrame || "";
  const affiches = trameChoisie ? docs.filter((d) => String(d.Template) === String(trameChoisie)) : docs;
  const filtreTrame = docs.length >= 4 && tramesDuDossier.length > 1
    ? `<div class="app-filters">
        <div class="fr-select-group app-select-inline">
          <label class="fr-label" for="affaireDocsTrame">Trame</label>
          <select class="fr-select" id="affaireDocsTrame" data-filter="affaireDocsTrame">
            <option value="">Toutes les trames</option>
            ${tramesDuDossier.map((t) => `<option value="${t.id}" ${String(trameChoisie) === String(t.id) ? "selected" : ""}>${esc(str(state.ctx.v("Trames", t, "Nom_complet")))}</option>`).join("")}
          </select>
        </div>
      </div>`
    : "";

  return `<div class="app-stack">
  ${reprise}
  ${echeanceInstruction(store, state, a, { compact: true })}
  ${documentsList(store, state, affiches, {
    hint: "Chaque document s'ouvre dans son propre espace de rédaction — le texte, ses paramètres et son rendu, sans quitter l'affaire du regard. La corbeille, à droite d'une ligne, supprime le document.",
    filters: filtreTrame,
    vide: trameChoisie ? "Aucun document de cette trame dans ce dossier." : "Aucun document dans ce dossier pour l'instant.",
    actions: `${button("Nouveau document", {
      variant: docs.length ? "secondary" : "primary", size: "sm", iconName: "add-line", action: "add-document",
    })}
      ${exportTableButtons({ table: "Generateur", rows: affiches, size: "sm", suffixe: affaireRef(state.ctx, a), titre: "Télécharger la liste des documents de cette affaire" })}`,
  })}
</div>`;
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function viewAffaires(store, state) {
  const ctx = state.ctx;
  const rows = filteredAffaires(store, state);
  const selected = selectedOrFirst(store, state, "Affaires", rows);
  const restreint = perimetreRestreint(store, state);

  const head = (title, sub) => `
<div class="app-page-head">
  <div>
    <p class="app-kicker">${restreint ? "Mes affaires" : "Affaires"}</p>
    <h1 class="fr-h3">${title}</h1>
    <p class="app-page-head__sub">${sub}</p>
  </div>
  <div class="app-page-head__actions">
    ${button("Nouvelle affaire", { variant: "primary", iconName: "add-line", action: "new-affaire" })}
    ${peutVoirTout(state) && restreint
      ? button(LIBELLE_VOIR_TOUT, { variant: "secondary", iconName: "eye-line", action: "voir-tout-affaires" })
      : ""}
    ${exportMenu({ items: `${docExportItems({ printAction: "print-affaires", printLabel: "Imprimer la liste", scope: "affaires" })}${exportTableItems({ table: "Affaires", rows, titre: "Télécharger la liste affichée, filtres et périmètre compris" })}` })}
  </div>
</div>
${exportStatus()}`;

  if (!selected) {
    return `
${head(restreint ? "Mes affaires" : "Affaires", restreint
      ? "Aucune affaire ne vous est attribuée pour le moment."
      : "Aucune affaire enregistrée pour le moment.")}
<div class="app-split">
  <aside class="app-split__aside">${asidePanel(store, state, rows, null)}</aside>
  <div class="app-split__main">
    ${panel("Bienvenue", emptyState(restreint
      ? "Les affaires qui vous sont attribuées apparaîtront ici. La répartition est décidée par les propriétaires du document."
      : "Commencez par enregistrer une première affaire : le numéro est généré automatiquement à partir de l'acronyme de la section.", {
      iconName: "file-add-line",
      action: button("Nouvelle affaire", { variant: "primary", iconName: "add-line", action: "new-affaire" }),
    }), { iconName: "folder-2-line" })}
  </div>
</div>`;
  }

  const section = selected.Section ? store.byId("Sections_disciplinaires", selected.Section) : null;
  const seance = selected.Seance_d_examen ? store.byId("Seances_d_examen", selected.Seance_d_examen) : null;
  const decisions = ctx.children("Decisions", selected);
  const intervenants = ctx.children("Intervenants", selected);
  const heritage = ctx.children("Commissions", selected);
  const implications = ctx.children("Implications", selected);
  const docs = ctx.children("Generateur", selected);

  const sub = [
    selected.Date_de_saisine ? `Saisie le ${formatDateFr(selected.Date_de_saisine)}` : null,
    section ? str(ctx.v("Sections_disciplinaires", section, "Intitule_de_la_section")) : null,
    selected.Secretaire ? `Secrétaire : ${str(ctx.v("Secretaires", ctx.ref("Affaires", selected, "Secretaire"), "Nom_complet"))}` : null,
    seance ? `Séance du ${formatDateFr(seance.Date)}` : null,
  ].filter(Boolean).map((x) => esc(x)).join(" · ");

  const defs = ongletsAffaire(section, selected);
  const tab = defs.some((t) => t.id === state.tabs.affaires) ? state.tabs.affaires : "synthese";
  const counts = {
    formation: intervenants.length || heritage.length,
    personnes: (selected.Mis_en_cause ? 1 : 0) + implications.length,
    decision: decisions.length,
    documents: docs.length,
  };
  const tabsHtml = tabs({
    id: "affaires",
    active: tab,
    label: "Sections de l'affaire",
    items: defs.map((t) => ({ ...t, count: counts[t.id] })),
  });

  const bodies = {
    synthese: () => tabSynthese(store, state, selected),
    formation: () => formationEditor(store, state, selected),
    personnes: () => tabPersonnes(store, state, selected, section),
    seance: () => tabSeance(store, state, selected),
    decision: () => tabDecision(store, state, selected),
    documents: () => tabDocuments(store, state, selected),
  };

  return `
${head(`<span class="app-ref">${esc(affaireRef(ctx, selected))}</span> ${esc(affaireName(ctx, selected))}`, sub || "&nbsp;")}
<div class="app-split">
  <aside class="app-split__aside">${asidePanel(store, state, rows, selected)}</aside>
  <div class="app-split__main">
    <div class="app-affaire__bande fr-mb-2w">
      <div class="app-row app-row--between app-affaire__bande-haut">
        <div class="app-row">
          ${badge(selected.Etat)}
          ${section ? tag(regimeOf(section), estEC(section) ? "warning" : "blue") : ""}
          ${selected.Voie && selected.Voie !== "Section disciplinaire" ? tag(selected.Voie, "warning") : ""}
          ${selected.Composante ? tag(str(selected.Composante)) : ""}
        </div>
        <div class="app-row">
          ${button("Supprimer l'affaire", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", attrs: `data-delete="Affaires:${selected.id}"` })}
        </div>
      </div>
      ${rappelDossier(selected)}
      ${flowPanel(store, selected)}
      ${echeanceInstruction(store, state, selected, { compact: true })}
    </div>
    ${tabsHtml}
    ${tabPanel({ id: "affaires", tab, contenu: bodies[tab]() })}
  </div>
</div>`;
}
