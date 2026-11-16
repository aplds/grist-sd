// Tableau de bord : synthèse de l'activité et accès rapides.

import { ETATS, estCloseEtat } from "../schema.js";
import { butoirInstruction, toDate, delaiMoyen, formatDateFr, isoDate } from "../formulas.js";
import { evenementsCalendrier } from "../calendrier.js";
import { decisionDefinitiveDe } from "../regimes.js";
import { dossierDeclare } from "../dossier.js";
import { LIBELLE_VOIR_TOUT, affairesVisibles, mentionPerimetre, parAffaire, perimetreRestreint, peutVoirTout } from "../visibilite.js";
import * as ui from "../ui.js";
import { barChart, clotureTag, listItem, resteEcheance, sortRecords, panel, subnavTableau, tonEcheance } from "./common.js";

const { esc, str, icon, badge, dateCell, dataTable, kpi, button, tag } = ui;

export function viewDashboard(store, state) {
  const ctx = state.ctx;
  // Le tableau de bord suit le périmètre des affaires : un secrétaire y suit
  // son propre portefeuille, pas celui de ses collègues.
  const restreint = perimetreRestreint(store, state);
  const affaires = affairesVisibles(store, state, store.table("Affaires"));
  const decisions = parAffaire(store, state, store.table("Decisions"), (d) => d.Affaire);
  const seances = store.table("Seances_d_examen");
  const mention = mentionPerimetre(store, state, { nombre: affaires.length });
  const nonAttribuees = store.table("Affaires").filter((a) => !Number(a.Secretaire));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Les échéances du calendrier, toutes catégories : séances, envoi des
  // convocations, terme de l'instruction, prescription, terme de la sanction,
  // expiration du délai de recours. Elles se déduisent des dates de l'affaire
  // et de la décision (voir `calendrier.js`) ; le tableau de bord les compte
  // parce qu'il est le seul écran qu'on ouvre sans savoir quoi y chercher, et
  // que le calendrier, lui, porte le détail.
  const echeancesAVenir = evenementsCalendrier(store, state).filter((e) => e.date >= isoDate(today));

  const actives = affaires.filter((a) => !estCloseEtat(a.Etat));
  // « À instruire » : les affaires **en cours** dont le fond n'est pas encore
  // tranché. Deux conditions, et non une :
  //
  //  - une décision avant dire droit (report, supplément d'instruction) ne
  //    clôture pas l'affaire — elle la maintient à l'instruction ;
  //  - une affaire close n'est plus à instruire, **même sans décision** :
  //    « Classé sans suite » est précisément l'issue qui clôt l'affaire sans
  //    trancher le fond. Ne compter que l'absence de décision la faisait
  //    figurer à instruire indéfiniment, ce qu'elle n'est plus.
  const sansDecision = actives.filter((a) => !decisionDefinitiveDe(ctx, a));
  const aVenir = sortRecords(
    seances.filter((s) => { const d = toDate(s.Date); return d && d >= today; }),
    (s) => String(s.Date || ""), "asc"
  );
  const enCours = decisions.filter((d) => ctx.v("Decisions", d, "En_cours_"));
  const delai = delaiMoyen({ ...store.db, Decisions: decisions });
  const prochaine = aVenir[0];
  // Les affaires en cours dont le dossier de pièces n'a pas encore d'adresse :
  // les pièces sont pourtant tenues quelque part, et c'est le seul lien vers
  // elles. Le compte se rappelle ici tant qu'il n'est pas nul.
  const sansDossier = actives.filter((a) => !dossierDeclare(a));
  // Les instructions dont le terme est fixé, de la plus proche échéance à la
  // plus lointaine : c'est la clôture d'instruction mise en avant, celle que
  // l'affaire porte en étiquette dans sa liste.
  const clotures = actives
    .map((a) => ({ a, b: butoirInstruction(ctx, a) }))
    .filter((x) => x.b && x.b.butoir)
    .sort((x, y) => String(x.b.butoir).localeCompare(String(y.b.butoir)));

  /* En-tête de page -------------------------------------------------- */

  const head = `
<div class="app-page-head">
  <div>
    <p class="app-kicker">${restreint ? "Mon activité" : "Activité de la section"}</p>
    <h1 class="fr-h3">Tableau de bord</h1>
    <p class="app-page-head__sub">Où en est-on : les affaires suivies, celles restant à instruire, les séances
      à venir et les délais. Le rapport d'activité, lui, présente une période et ses graphiques.</p>
  </div>
</div>
${subnavTableau("synthese")}`;

  /* Indicateurs --------------------------------------------------- */

  const kpis = `
  <div class="app-kpis">
    ${kpi({ label: restreint ? "Mes affaires suivies" : "Affaires suivies", value: affaires.length, hint: `${actives.length} en cours de traitement`, iconName: "folder-2-line", href: "#affaires" })}
    ${kpi({ label: "À instruire", value: sansDecision.length, hint: `${restreint ? "de vos affaires" : "affaire(s)"} en cours sans décision définitive`, iconName: "file-add-line", tone: sansDecision.length ? "warning" : "", href: "#affaires" })}
    ${kpi({ label: "Séances à venir", value: aVenir.length, hint: prochaine ? `prochaine le ${formatDateFr(prochaine.Date)}` : "aucune séance programmée", iconName: "calendar-line", href: "#calendrier/seances" })}
    ${kpi({ label: "Échéances à venir", value: echeancesAVenir.length, hint: echeancesAVenir.length ? `prochaine le ${formatDateFr(echeancesAVenir[0].date)}` : "aucune échéance au calendrier", iconName: "calendar-check-line", href: "#calendrier" })}
    ${kpi({ label: "Décisions rendues", value: decisions.length, hint: `${enCours.length} en cours d'effet`, iconName: "scales-3-line", href: "#decisions" })}
    ${kpi({ label: "Délai moyen", value: delai.moyenne === null ? "—" : `${delai.mois} mois`, hint: delai.moyenne === null ? "aucune décision notifiée" : `soit ${Math.round(delai.moyenne)} jours après la saisine`, iconName: "time-line", href: "#decisions" })}
    ${peutVoirTout(state) && nonAttribuees.length ? kpi({
      label: "À attribuer",
      value: nonAttribuees.length,
      hint: "affaire(s) sans secrétaire",
      iconName: "user-search-line",
      tone: "warning",
      href: "#attribution",
    }) : ""}
    ${sansDossier.length ? kpi({
      label: "Dossiers à déclarer",
      value: sansDossier.length,
      hint: "affaire(s) en cours dont le dossier de pièces n'a pas d'adresse",
      iconName: "folder-2-line",
      tone: "warning",
      href: "#affaires",
    }) : ""}
  </div>`;

  /* Actions rapides ----------------------------------------------- */

  // Trois gestes, et rien de plus : ce sont ceux qui se font tous les jours.
  // Les six cartes d'action qui tenaient ici répétaient ce que portent déjà
  // l'en-tête de page, le menu latéral et les panneaux — et occupaient la
  // moitié de l'écran.
  const actions = `
  <div class="app-row fr-mb-3w app-actes-rapides">
    ${button("Nouvelle affaire", { variant: "secondary", size: "sm", iconName: "file-add-line", action: "new-affaire" })}
    ${peutVoirTout(state) && nonAttribuees.length
      ? button("Répartir les affaires", { variant: "secondary", size: "sm", iconName: "arrow-left-right-line", attrs: 'data-nav="attribution"', title: `${nonAttribuees.length} affaire(s) sans secrétaire` })
      : ""}
    ${button("Rechercher une décision", { variant: "secondary", size: "sm", iconName: "search-line", attrs: 'data-nav="decisions"', title: "Retrouver les décisions concernant un usager, par son INE, ou un enseignant-chercheur, par son corps" })}
    ${button("Planifier une séance", { variant: "secondary", size: "sm", iconName: "calendar-line", attrs: 'data-nav="calendrier/seances"' })}
    ${perimetreRestreint(store, state) && peutVoirTout(state)
      ? button(LIBELLE_VOIR_TOUT, { variant: "tertiary", size: "sm", iconName: "eye-line", action: "voir-tout-affaires" })
      : ""}
  </div>`;

  /* Clôtures d'instruction ---------------------------------------- */

  // La clôture d'instruction d'une affaire ne se découvre pas en ouvrant
  // l'affaire : dès qu'une date est notée — par la procédure, ou par la pièce
  // qui la reporte —, l'affaire se met en avant ici, de la plus proche
  // échéance à la plus lointaine. Le bandeau dit le reste dans l'affaire.
  const cloturesPanel = clotures.length ? panel("Clôtures d'instruction", `
    <p class="fr-text--sm fr-text-mention--grey fr-mb-2w">
      Les affaires dont l'instruction est bornée dans le temps. Le terme est celui que fixe une
      pièce de l'affaire — la date butoir d'instruction prime sur l'échéance de la procédure —,
      à défaut le délai de la procédure décompté depuis la décision de désignation.
    </p>
    <div class="app-list">
      ${clotures.map(({ a, b }) => listItem({
        table: "Affaires",
        id: a.id,
        ref: esc(str(ctx.v("Affaires", a, "Numero"))),
        name: esc(str(ctx.v("Affaires", a, "Nom_complet")).trim()),
        badgeHtml: clotureTag(b),
        meta: [
          `<span class="${b.jours < 0 ? "app-echeance-reste--error" : ""}">${esc(resteEcheance(b.jours))}</span>`,
          a.Date_de_saisine ? `<span>Saisie le ${dateCell(a.Date_de_saisine)}</span>` : "",
        ].filter(Boolean).join(""),
        echeance: tonEcheance(b.jours),
        attrs: 'data-open="affaires"',
      })).join("")}
    </div>
  `, {
    iconName: "timer-line",
    subtitle: `${clotures.length} instruction(s) à clore`,
  }) : "";

  /* Affaires à traiter -------------------------------------------- */

  const aTraiter = sortRecords(actives, (a) => String(a.Date_de_saisine || ""), "asc").slice(0, 8);
  const rows = aTraiter.map((a) => {
    const anciennete = a.Date_de_saisine ? Math.max(0, Math.round((today - toDate(a.Date_de_saisine)) / 86400000)) : null;
    const regime = str(ctx.v("Affaires", a, "Section_Public"));
    return {
      id: a.id,
      cells: [
        `<strong>${esc(str(ctx.v("Affaires", a, "Numero")))}</strong>`,
        regime ? tag(regime === "Enseignants-chercheurs" ? "Enseignants-chercheurs" : "Usagers", regime === "Enseignants-chercheurs" ? "warning" : "blue") : "—",
        esc(str(ctx.v("Affaires", a, "Nom_complet")).trim()),
        badge(a.Etat),
        dateCell(a.Date_de_saisine),
        anciennete === null ? "" : (anciennete > 180 ? `<span class="fr-text-default--error">${anciennete} j</span>` : `${anciennete} j`),
      ],
    };
  });

  const traiterPanel = panel(restreint ? "Mes affaires à traiter" : "Affaires à traiter", `
    ${aTraiter.length
      ? dataTable({
          caption: "Affaires en cours, de la plus ancienne à la plus récente",
          columns: ["N°", "Régime", "Mis en cause", "État", "Saisine", "Ancienneté"],
          rows,
          class: "app-table--traiter",
          rowMeta: 'data-open="affaires" data-select-table="Affaires"',
        })
      : ui.emptyState("Aucune affaire en cours. Enregistrez une première affaire pour commencer.", {
          iconName: "folder-2-line",
          action: button("Nouvelle affaire", { variant: "primary", iconName: "file-add-line", action: "new-affaire" }),
        })}
    ${actives.length > aTraiter.length ? `<div class="fr-mt-2w">${button(`Voir les ${actives.length} affaires en cours`, { variant: "tertiary", attrs: 'data-nav="affaires"', href: "#affaires" })}</div>` : ""}
  `, { iconName: "folder-2-line", subtitle: `${actives.length} affaire(s) non clôturée(s)` });

  /* Prochaines séances -------------------------------------------- */

  const seancePanel = panel("Prochaines séances", `
    ${aVenir.length
      ? `<ul class="app-list">
          ${aVenir.slice(0, 4).map((s) => {
            // Le rôle annoncé suit le périmètre : le compte ne doit pas
            // trahir le nombre d'affaires d'autrui inscrites à la séance.
            // Une affaire est inscrite à une séance par sa colonne
            // `Seance_d_examen` (voir `Affaires_du_role`, formulas.js).
            const vues = new Set(affaires.map((a) => a.id));
            const n = ctx.table("Affaires")
              .filter((a) => Number(a.Seance_d_examen) === Number(s.id) && vues.has(a.id)).length;
            return `<li>${listSeance(ctx, s, n)}</li>`;
          }).join("")}
        </ul>`
      : ui.emptyState("Aucune séance d'examen programmée.", {
          iconName: "calendar-line",
          action: button("Planifier une séance", { variant: "secondary", iconName: "calendar-line", attrs: 'data-nav="calendrier/seances"' }),
        })}
  `, { iconName: "calendar-line", actions: `${button("Voir le calendrier", { variant: "tertiary", size: "sm", iconName: "calendar-check-line", attrs: 'data-nav="calendrier"' })}` });

  /* Répartition et délais ----------------------------------------- */

  // Le graphique de répartition se pose **à côté** du tableau des affaires à
  // traiter, dans le même bloc : les deux disent la même activité, l'un en
  // détail, l'autre d'un coup d'œil. Le bloc « Affaires clôturées — 3 sur 10 »
  // qui l'accompagnait redisait la tuile et le graphique : il est retiré.
  const parEtat = ETATS
    .map((e) => ({ label: e, value: affaires.filter((a) => a.Etat === e).length }))
    .filter((d) => d.value > 0);

  const repartition = panel("Répartition par état", barChart("", parEtat, affaires.length), {
    iconName: "bar-chart-line",
    subtitle: "Les affaires suivies, par état",
  });

  return `
${head}
${mention ? ui.alert("info", "Périmètre restreint", mention,
    peutVoirTout(state)
      ? button(LIBELLE_VOIR_TOUT, { variant: "secondary", size: "sm", iconName: "eye-line", action: "voir-tout-affaires" })
      : "") : ""}
${kpis}
${actions}
${cloturesPanel}
<div class="fr-grid-row fr-grid-row--gutters">
  <div class="fr-col-12 fr-col-lg-7">${traiterPanel}</div>
  <div class="fr-col-12 fr-col-lg-5">${repartition}${seancePanel}</div>
</div>`;
}

function listSeance(ctx, s, count) {
  const id = str(ctx.v("Seances_d_examen", s, "Identifiant"));
  return `<button type="button" class="app-list__item" data-select="${s.id}" data-select-table="Seances_d_examen" data-open="calendrier/seances">
    <span class="app-list__top">
      <span class="app-list__ref">${esc(id)}</span>
      <span class="app-tag app-tag--blue">${count} affaire(s)</span>
    </span>
    <span class="app-list__name">${esc(str(s.Salle)) || "Salle non précisée"}${s.Adresse ? ` — ${esc(str(s.Adresse))}` : ""}</span>
    <span class="app-list__meta">${dateCell(s.Date)}</span>
  </button>`;
}
