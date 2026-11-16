// Séances.
//
// Une séance se prépare et se documente au même endroit : type de réunion,
// salle, horaires, rôle (liste des affaires inscrites avec leur heure de
// passage) et impression du rôle pour la séance.
//
// C'est la seconde vue de la page **Calendrier** (voir `views/calendrier.js`) :
// la séance est un rendez-vous parmi les échéances, et c'est la page du temps
// qui les rassemble toutes.

import { toDate } from "../formulas.js";
import { TYPES_SEANCE, estCloseEtat } from "../schema.js";
import { libelleFormation } from "../regimes.js";
import { affairesVisibles } from "../visibilite.js";
import { dossierDeclare, lienDossier } from "../dossier.js";
import * as ui from "../ui.js";
import { selectedOrFirst, affaireRef, affaireName, sortRecords, listItem, docExportItems, exportMenu, exportStatus, exportTableItems, subnavCalendrier } from "./common.js";

const { esc, str, icon, badge, dateCell, panel, emptyState, button, field, formGrid, dl, tag } = ui;

function seanceLabel(ctx, s) {
  const id = str(ctx.v("Seances_d_examen", s, "Identifiant"));
  return id || `Séance #${s.id}`;
}

function roleOf(store, state, s) {
  return sortRecords(
    affairesVisibles(store, state, store.table("Affaires"))
      .filter((a) => Number(a.Seance_d_examen) === Number(s.id)),
    (a) => `${String(a.SE_Heure_de_passage || "99:99")}`, "asc");
}

export function viewSeances(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  const sections = store.table("Sections_disciplinaires");

  const sectionId = f.seanceSection ? Number(f.seanceSection)
    : (state.sel.Sections_disciplinaires || sections[0]?.id || null);
  if (sectionId) state.sel.Sections_disciplinaires = sectionId;
  const section = sectionId ? store.byId("Sections_disciplinaires", sectionId) : null;

  const rows = sortRecords(
    store.table("Seances_d_examen").filter((s) => !sectionId || Number(s.Section) === sectionId),
    (s) => String(s.Date || ""), "desc");

  let selected = state.sel.Seances_d_examen
    ? rows.find((s) => s.id === Number(state.sel.Seances_d_examen)) || null
    : null;
  if (!selected) selected = rows[0] || null;
  if (selected) state.sel.Seances_d_examen = selected.id;
  else delete state.sel.Seances_d_examen;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const head = `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Calendrier</p>
    <h1 class="fr-h3">Préparer et convoquer les séances</h1>
    <p class="app-page-head__sub">Une séance rassemble les affaires d'une même section, chacune avec son heure de passage. Le rôle de la séance s'imprime pour le jour J.</p>
  </div>
  <div class="app-page-head__actions">
    ${button("Créer une séance", { variant: "primary", iconName: "add-line", action: "add-seance" })}
    ${exportMenu({ items: `${selected ? docExportItems({ printAction: "print-role", printLabel: "Imprimer le rôle", scope: "role", record: selected.id }) : ""}${exportTableItems({ table: "Seances_d_examen", rows, suffixe: section ? str(section.Structure) : "", titre: "Télécharger la liste des séances" })}` })}
  </div>
</div>
${subnavCalendrier(state.sub)}
${selected ? exportStatus() : ""}`;

  const aside = `
<div class="fr-panel app-master">
  <div class="fr-panel__header">
    <div class="fr-panel__heading">
      <h2 class="fr-h6 fr-mb-0">${icon("calendar-line", 'class="fr-mr-1v"')}Séances</h2>
      <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">${rows.length} séance(s)</p>
    </div>
  </div>
  <div class="fr-panel__body">
    ${sections.length > 1 ? `
    <div class="app-filters">
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="seanceSection">Section</label>
        <select class="fr-select" id="seanceSection" data-filter="seanceSection">
          ${sections.map((s) => `<option value="${s.id}" ${String(sectionId) === String(s.id) ? "selected" : ""}>${esc(str(s.Structure))}</option>`).join("")}
        </select>
      </div>
    </div>` : ""}
    <div class="app-list" data-scroll="seanceList">
      ${rows.length
        ? rows.map((s) => {
            const n = roleOf(store, state, s).length;
            const d = toDate(s.Date);
            const passe = d && d < today;
            return listItem({
              table: "Seances_d_examen",
              id: s.id,
              selected: selected && s.id === selected.id,
              ref: esc(seanceLabel(ctx, s)),
              name: esc([str(s.Salle), str(s.Adresse)].filter(Boolean).join(" — ") || "Lieu non précisé"),
              meta: `<span>${dateCell(s.Date)}</span><span class="app-tag app-tag--${n ? "blue" : ""}">${n} affaire(s)</span>`
                + (s.Type && s.Type !== TYPES_SEANCE[0] ? `<span class="app-tag">${esc(str(s.Type))}</span>` : ""),              badgeHtml: passe ? tag("Passée") : "",
            });
          }).join("")
        : emptyState("Aucune séance pour cette section.", { iconName: "calendar-line" })}
    </div>
  </div>
</div>`;

  if (!selected) {
    return `
${head}
<div class="app-split">
  <aside class="app-split__aside">${aside}</aside>
  <div class="app-split__main">
    ${panel("Séances", emptyState("Créez une séance pour y inscrire des affaires et imprimer un rôle.", {
      iconName: "calendar-line",
      action: button("Créer une séance", { variant: "primary", iconName: "add-line", action: "add-seance" }),
    }), { iconName: "calendar-line" })}
  </div>
</div>`;
}

  const role = roleOf(store, state, selected);
  const sectionDeLaSeance = store.byId("Sections_disciplinaires", selected.Section) || section;
  const formationLabel = libelleFormation(sectionDeLaSeance);
  const candidats = sortRecords(
    affairesVisibles(store, state, store.table("Affaires")).filter((a) =>
      !a.Seance_d_examen && (!sectionId || Number(a.Section) === sectionId) && !estCloseEtat(a.Etat)),
    (a) => String(a.Date_de_saisine || ""), "desc");

  const roleBody = role.length
    ? `<div class="fr-table fr-table--bordered fr-table--sm app-table--fixed">
        <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
          <table>
            <caption>Rôle de la séance</caption>
            <colgroup>
              <col style="width:12%"><col style="width:15%"><col style="width:16%"><col style="width:22%"><col style="width:22%"><col style="width:7rem">
            </colgroup>
            <thead><tr>
              <th scope="col">Heure</th><th scope="col">N°</th><th scope="col">Mis en cause</th>
              <th scope="col">État</th><th scope="col">${esc(formationLabel)}</th>
              <th scope="col"><span class="fr-sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              ${role.map((a) => `
              <tr data-open="affaires" data-select-table="Affaires" data-select="${a.id}">
                <td class="app-nowrap">${field("Affaires", "SE_Heure_de_passage", ctx, a, { store, compact: true })}</td>
                <td class="app-nowrap"><strong>${esc(affaireRef(ctx, a))}</strong></td>
                <td>${(() => { const n = affaireName(ctx, a); return `<div class="app-clip" title="${esc(n)}">${esc(n)}</div>`; })()}</td>
                <td>${badge(a.Etat)}</td>
                <td>${(() => { const c = str(ctx.v("Affaires", a, "Commission")) || "—"; return `<div class="app-clip" title="${esc(c)}">${esc(c)}</div>`; })()}</td>
                <td class="app-cell-action">
                  ${dossierDeclare(a)
                    ? `<a class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm app-btn--icone app-dossier__ouvrir"
                        href="${esc(lienDossier(a))}" target="_blank" rel="noopener noreferrer"
                        title="Ouvrir le dossier de pièces dans un nouvel onglet">${icon("external-link-line")}<span class="fr-sr-only">Ouvrir le dossier de pièces</span></a>`
                    : `<span class="fr-icon-alert-line app-dossier__manquant" role="img" aria-label="Dossier de pièces non déclaré" title="Dossier de pièces non déclaré"></span>`}
                  <button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm"
                    data-action="unassign-affaire" data-record="${a.id}" title="Retirer du rôle">
                    ${icon("subtract-line")}<span class="fr-sr-only">Retirer du rôle</span>
                  </button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div></div></div>
      </div>`
    : emptyState("Aucune affaire n'est inscrite au rôle de cette séance.", { iconName: "list-unordered" });

  const affectation = candidats.length
    ? `<div class="fr-select-group fr-mt-2w">
        <label class="fr-label" for="assignAffaire">Inscrire une affaire au rôle</label>
        <select class="fr-select" id="assignAffaire" aria-describedby="assignAffaire-desc" data-action="assign-affaire" data-record="${selected.id}">
          <option value="">— Choisir une affaire —</option>
          ${candidats.map((a) => `<option value="${a.id}">${esc(`${affaireRef(ctx, a)} — ${affaireName(ctx, a)}`)}</option>`).join("")}
        </select>
        <p class="fr-hint-text app-desc" id="assignAffaire-desc">${candidats.length} affaire(s) de cette section ne sont affectées à aucune séance.</p>
      </div>`
    : `<p class="fr-hint-text fr-mt-2w fr-mb-0">Toutes les affaires en cours de cette section sont déjà affectées à une séance.</p>`;

  return `
${head}
<div class="app-split">
  <aside class="app-split__aside">${aside}</aside>
  <div class="app-split__main">
    <div class="app-row app-row--between fr-mb-2w">
      <div class="app-row">
        <span class="app-ref">${esc(seanceLabel(ctx, selected))}</span>
        <span>${dateCell(selected.Date)}</span>
        ${role.length ? tag(`${role.length} affaire(s) au rôle`, "blue") : ""}
      </div>
      <div class="app-row">
        ${button("Supprimer la séance", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", attrs: `data-delete="Seances_d_examen:${selected.id}"` })}
      </div>
    </div>
    <div class="fr-grid-row fr-grid-row--gutters">
      <div class="fr-col-12 fr-col-lg-6">
        ${panel("Organisation", formGrid("Seances_d_examen", ["Type", "Date", "Salle", "Adresse", "Lien_visio"], ctx, selected, { store, wide: ["Adresse"] }), {
          iconName: "calendar-line",
          subtitle: section ? str(ctx.v("Sections_disciplinaires", section, "Intitule_de_la_section")) : "",
        })}
      </div>
      <div class="fr-col-12 fr-col-lg-6">
        ${panel("Convocation", dl([
          ["Section", section ? esc(str(section.Structure)) : "—", true],
          ["Siège", section ? esc(str(section.Siege)) : "—", true],
          ["Secrétariat", section ? esc([str(section.Secretariat_Rue), str(section.Secretariat_CP_Ville)].filter(Boolean).join(", ")) : "—", true],
          ["Courriel", section && section.Email_de_contact ? `<a href="mailto:${esc(section.Email_de_contact)}">${esc(section.Email_de_contact)}</a>` : "—", true],
          ["Date", dateCell(selected.Date), true],
        ], { variante: "lignes" }), { iconName: "mail-line" })}
      </div>
    </div>
    <div class="fr-mt-2w">
      ${panel("Rôle de la séance", `${roleBody}${affectation}`, {
        iconName: "list-unordered",
        actions: button("Imprimer le rôle", { variant: "secondary", size: "sm", iconName: "printer-line", attrs: `data-action="print-role" data-record="${selected.id}"` }),
      })}
    </div>
  </div>
</div>`;
}
