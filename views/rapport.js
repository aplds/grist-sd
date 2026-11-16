// Rapport d'activité : la page.
//
// Deuxième sous-page du tableau de bord, à côté de la synthèse : elle présente
// une **période** — l'année écoulée, le plus souvent — sous la forme d'un
// rapport qu'on peut lire, imprimer et annexer.
//
// Tout vient de `src/rapport.js` (les chiffres, les graphiques, les tableaux),
// et les graphiques sont des images : `graphiques.js` les dessine, la page les
// pose, et chacun se télécharge en PNG. Le rapport entier s'imprime ou
// s'exporte (PDF, Word, OpenDocument) : c'est la même matière, mise en page
// par `print.js`.

import { anneesDisponibles, anneeRetenue, dateDuRapport, FILTRE_ANNEE, rapportActivite } from "../rapport.js";
import { graphiqueHtml } from "../graphiques.js";
import { mentionPerimetre, perimetreRestreint } from "../visibilite.js";
import * as ui from "../ui.js";
import { exportMenu, docExportItems, exportListeButtons, subnavTableau, tableauIndicateurs } from "./common.js";

const { esc, icon, panel, emptyState, button, kpi, alert } = ui;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function viewRapport(store, state) {
  const restreint = perimetreRestreint(store, state);
  const rapport = rapportActivite(store, state);
  const mention = mentionPerimetre(store, state, { nombre: rapport.contexte.affairesToutes });
  const annees = anneesDisponibles(store);

  const head = `
<div class="app-page-head">
  <div>
    <p class="app-kicker">${restreint ? "Mon activité" : "Activité de la section"}</p>
    <h1 class="fr-h3">Rapport d'activité</h1>
    <p class="app-page-head__sub">Les affaires reçues, les décisions rendues et les délais, sur une période —
      la matière d'un rapport d'activité, à lire, imprimer et annexer.${restreint
        ? " Il ne porte que sur les affaires qui vous sont attribuées." : ""}</p>
  </div>
  <div class="app-page-head__actions">
    ${exportMenu({
      label: "Rapport",
      iconName: "printer-line",
      items: docExportItems({ printAction: "print-rapport", printLabel: "Imprimer le rapport", scope: "rapport" }),
    })}
  </div>
</div>
${subnavTableau("rapport")}`;

  if (!store.table("Affaires").length) {
    return `${head}
${panel("Aucune affaire", emptyState(
      "Aucune affaire n'a encore été enregistrée : il n'y a rien à rapporter. Enregistrez une première affaire pour commencer.",
      { iconName: "bar-chart-line", action: button("Voir les affaires", { variant: "primary", iconName: "folder-2-line", attrs: 'data-nav="affaires"' }) },
    ), { iconName: "bar-chart-line" })}`;
  }

  /* Filtre de période ------------------------------------------------- */

  const filtre = `
<div class="app-filters app-filters--page">
  <div class="fr-select-group app-select-inline">
    <label class="fr-label" for="rapportAnnee">Période</label>
    <select class="fr-select" id="rapportAnnee" aria-describedby="rapportAnnee-desc" data-filter="${FILTRE_ANNEE}">
      ${annees.map((a) => `<option value="${a}" ${anneeRetenue(store, state) === a ? "selected" : ""}>Année ${a}</option>`).join("")}
      <option value="toutes" ${anneeRetenue(store, state) === null ? "selected" : ""}>Toutes les années</option>
    </select>
    <p class="fr-hint-text app-desc" id="rapportAnnee-desc">Les affaires sont comptées à leur date de saisine, les décisions à leur date de délibéré.</p>
  </div>
  <p class="fr-text--sm app-muted fr-mb-0">${icon("information-line", 'class="fr-mr-1v"')}${esc(rapport.periode)}
    — ${esc(String(rapport.kpis[0].value))} affaire(s) reçue(s).</p>
</div>`;

  /* Barre d'ancres et de vues ----------------------------------------- */

  // Les graphiques et les tableaux disent les mêmes chiffres : les afficher
  // tous deux d'affilée faisait une page de neuf mille pixels, lue deux fois.
  // La barre collante choisit donc **une** lecture à la fois — graphiques ou
  // tableaux —, et sert aussi de sommaire : elle reste sous l'œil pendant
  // qu'on déroule le rapport.
  const vue = state.tabs.rapportVue === "tableaux" ? "tableaux" : "graphiques";
  const ancres = ui.anchors({
    label: "Sections du rapport",
    items: [
      { label: "Chiffres clés", hash: "rapportChiffres" },
      { label: "Graphiques", tab: "rapportVue:graphiques", active: vue === "graphiques", iconName: "bar-chart-line" },
      { label: "Tableaux", tab: "rapportVue:tableaux", active: vue === "tableaux", iconName: "table-line" },
      { label: "Imprimer", action: "print-rapport", iconName: "printer-line" },
    ],
  });

  /* Chiffres clés ----------------------------------------------------- */

  const chiffres = `
<div class="app-kpis" id="rapportChiffres">
  ${rapport.kpis.map((k) => kpi(k)).join("")}
</div>`;

  /* Graphiques -------------------------------------------------------- */

  const exportGraphiques = rapport.graphiques.length
    ? button("Tous les graphiques (PNG)", {
      variant: "secondary", size: "sm", iconName: "download-line",
      action: "export-graphiques",
      title: "Télécharger tous les graphiques en images PNG, dans une archive ZIP",
    })
    : "";

  // Plus de bouton par graphique : seize boutons alignés sur seize images
  // encombraient la page sans rien apprendre. L'archive PNG les emporte tous,
  // et les images restent lisibles, sans cadre de carte à l'intérieur d'un
  // panneau.
  const cartes = rapport.graphiques.map((g) => `
  <figure class="app-rapport__graphique">
    <figcaption class="app-rapport__graphique-titre">${esc(g.titre)}</figcaption>
    ${graphiqueHtml(g.spec, { legende: false })}
  </figure>`).join("");

  const graphiques = `
<div class="app-stack">
  <div class="app-section-title">
    <h2 class="fr-h5 fr-mb-0">${icon("bar-chart-line", 'class="fr-mr-1v"')}Graphiques</h2>
    ${exportGraphiques}
  </div>
  ${cartes
      ? `<div class="app-rapport__grille">${cartes}</div>`
      : emptyState("Aucune donnée à représenter sur cette période.", { iconName: "bar-chart-line" })}
</div>`;

  /* Tableaux d'indicateurs -------------------------------------------- */

  // Un panneau **repliable par domaine** au lieu de quinze cartes dépliées :
  // le rapport donne d'abord ses six domaines, et l'on ouvre celui que l'on
  // veut lire. Les tableaux se posent à plat dans le panneau — pas de carte
  // dans la carte — et leur export ne se montre qu'au survol du tableau.
  const domaines = [...new Set(rapport.tableaux.map((t) => t.domaine))];
  const tableaux = domaines.map((domaine) => {
    const lot = rapport.tableaux.filter((t) => t.domaine === domaine);
    const corps = lot.map((t) => `
    <div class="app-rapport__tableau">
      <div class="app-rapport__tableau-tete">
        <h3 class="fr-h6 fr-mb-0">${esc(t.nom)}</h3>
        <span class="app-rapport__tableau-export">${exportListeButtons({
          source: "rapport", sourceId: t.id, nom: `${t.nom} — ${rapport.periode}`, size: "sm",
          titre: `Télécharger « ${t.nom} »`,
        })}</span>
      </div>
      ${tableauIndicateurs(t)}
    </div>`).join("");
    return panel(domaine, corps, {
      iconName: "table-line",
      subtitle: `${lot.length} tableau${lot.length > 1 ? "x" : ""}`,
      collapsible: true,
    });
  }).join("");

  const tousLesTableaux = rapport.tableaux.length
    ? button("Tous les tableaux (Excel)", {
      variant: "secondary", size: "sm", iconName: "table-line", action: "export-indicateurs-xlsx",
      title: "Télécharger tous les tableaux d'indicateurs dans un classeur Excel, une feuille par tableau",
    }) + button("Tous les tableaux (CSV)", {
      variant: "tertiary", size: "sm", iconName: "file-text-line", action: "export-indicateurs-csv",
      title: "Télécharger tous les tableaux d'indicateurs en CSV, un fichier par tableau",
    })
    : "";

  const indicateurs = `
<div class="app-stack">
  <div class="app-section-title">
    <h2 class="fr-h5 fr-mb-0">${icon("table-line", 'class="fr-mr-1v"')}Tableaux d'indicateurs</h2>
    ${tousLesTableaux}
  </div>
  ${tableaux || emptyState("Aucun tableau à présenter sur cette période.", { iconName: "table-line" })}
</div>`;

  return `
${head}
${mention ? alert("info", "Périmètre restreint", mention) : ""}
${filtre}
${ancres}
${chiffres}
${vue === "tableaux" ? indicateurs : graphiques}
<p class="fr-hint-text fr-mt-3w">Rapport établi le ${esc(dateDuRapport())}.
  Les indicateurs ne portent que sur les données présentes dans ce document ; un indicateur sans donnée n'est pas affiché.</p>`;
}
