// Réglages › Import des données.
//
// L'écran ne fait rien par lui-même : il montre ce que l'outil comprend d'une
// source, puis laisse appliquer la conversion (voir `src/import.js`). Le
// rapport d'analyse s'affiche **avant** toute écriture, et le rapport
// d'application reste affiché ensuite.
//
// Un fichier n'arrive pas toujours étiqueté : une feuille de classeur, un
// fichier délimité, une table d'un document Grist — il faut dire à l'outil
// quelle table du modèle reçoit quoi. C'est le rôle du panneau « Tables du
// fichier », qui montre pour chaque feuille les colonnes reconnues et laisse
// corriger l'affectation.

import { SCHEMA } from "../schema.js";
import { LEGACY_COLUMNS, LEGACY_DROPPED } from "../legacy.js";
import { analyserSource } from "../import.js";
import {
  FORMATS_ACCEPTES, FORMATS_AIDE, FORMATS_NOMMES, colonnesReconnues, correspondance, tablesConnues,
} from "../import-fichiers.js";
import * as ui from "../ui.js";
import { reglagesHead } from "./common.js";

const { esc, icon, panel, alert, emptyState, button, dataTable, dl, tag, fieldset, selectControl } = ui;

function sourcePanel(store, state) {
  const imp = state.import || {};
  const analyse = imp.analyse;
  const connecte = state.grist === "connected";
  const format = imp.format ? FORMATS_NOMMES[imp.format] || imp.format : "";
  return panel("Source des données", `
    <p class="fr-text--sm fr-mb-2w">
      L'import reprend une source — document Grist, classeur ou fichier délimité exporté depuis Grist,
      export JSON de l'outil — la convertit dans le modèle de l'outil, puis l'applique.
      Rien n'est écrit avant votre validation.
    </p>
    <div class="app-row">
      ${button("Choisir un fichier", { variant: "primary", iconName: "upload-line", action: "import-fichier" })}
      ${connecte ? button("Lire le document Grist connecté", { variant: "secondary", iconName: "database-line", action: "import-document" }) : ""}
      ${analyse || imp.erreur ? button("Retirer la source", { variant: "tertiary", iconName: "close-line", action: "import-effacer" }) : ""}
    </div>
    <input type="file" id="importSourceFile" accept="${FORMATS_ACCEPTES}" hidden aria-label="Fichier à analyser">
    ${imp.erreur ? `<div class="fr-mt-2w">${alert("error", "Fichier non lu", imp.erreur,
      `<p class="fr-hint-text fr-mb-0">${esc(FORMATS_AIDE)}</p>`)}</div>` : ""}
    ${imp.enCours ? `
    <p class="app-row fr-mt-2w fr-mb-0" role="status">
      <span class="app-spinner" aria-hidden="true"></span>
      <span class="fr-text--sm fr-mb-0">${esc(imp.enCours)}</span>
    </p>` : ""}
    ${imp.label ? `<p class="fr-hint-text fr-mt-2w fr-mb-0">Source retenue : <strong>${esc(imp.label)}</strong>`
      + `${format ? ` (${esc(format)})` : ""}${analyse ? ` — ${analyse.total} ligne(s) lue(s).` : ""}</p>` : ""}
    ${!analyse && !imp.enCours
      ? `<p class="fr-hint-text fr-mt-2w fr-mb-0">Formats acceptés : document Grist (.grist), classeur Excel ou LibreOffice (.xlsx, .xls, .ods), fichier délimité (.csv, .tsv) et export JSON de l'outil.</p>`
      : ""}
    ${connecte
      ? `<p class="fr-hint-text fr-mt-1w fr-mb-0">${icon("database-line", 'class="fr-mr-1v"')}Le document connecté est lu tel quel : ses tables d'origine sont reconnues et converties, sans y écrire.</p>`
      : ""}
  `, { iconName: "upload-line", subtitle: "Document Grist, classeur, fichier délimité, ou export JSON de l'outil" });
}

/* ------------------------------------------------------------------ */
/* Tables du fichier                                                   */
/* ------------------------------------------------------------------ */

/**
 * Une feuille par bloc : la table qui la reçoit, et le détail des colonnes.
 * L'affectation proposée vient du nom de la feuille et de ses colonnes ; elle
 * reste modifiable, car un classeur retouché à la main ne dit plus rien de
 * fiable.
 */
function feuillesPanel(state) {
  const imp = state.import || {};
  const feuilles = imp.feuilles || [];
  if (!feuilles.length) return "";

  const options = [
    { value: "", label: "— Ne pas importer cette feuille —" },
    ...tablesConnues().map((t) => ({ value: t.cle, label: t.label })),
  ];

  const blocs = feuilles.map((feuille, i) => {
    const total = feuille.colonnes.length;
    const reconnues = colonnesReconnues(feuille.cible, feuille.colonnes);
    const correspondances = dataTable({
      caption: `Colonnes de « ${feuille.nom} »`,
      columns: ["Colonne du fichier", "Colonne de l'outil"],
      rows: feuille.colonnes.map((colonne) => {
        const cible = correspondance(feuille.cible, colonne);
        return {
          id: colonne,
          cells: [
            `<code>${esc(colonne)}</code>`,
            cible ? `<code>${esc(cible)}</code>` : `<span class="fr-text-mention--grey">non reconnue — ignorée</span>`,
          ],
        };
      }),
      rowAttr: "",
      class: "app-table--fixed app-table--wrap",
      cols: ["16rem", "auto"],
    });
    const etat = !feuille.cible
      ? alert("warning", "Table non reconnue",
        "Aucune colonne de cette feuille ne désigne une table de l'outil. Choisissez la table qui doit la recevoir, ou laissez la feuille de côté.")
      : reconnues < total
        ? alert("info", "Colonnes écartées",
          `${total - reconnues} colonne(s) de cette feuille n'existent pas dans la table « ${SCHEMA[feuille.cible]?.label || feuille.cible} » : elles ne seront pas reprises.`)
        : "";
    const resume = feuille.cible
      ? `${feuille.lignes.length} ligne(s) — ${reconnues} colonne(s) reconnue(s) sur ${total}`
      : `${feuille.lignes.length} ligne(s) — aucune table reconnue`;
    return panel(feuille.nom, `
      ${selectControl({
        id: `importCible${i}`,
        label: "Table de l'outil qui reçoit cette feuille",
        options,
        value: feuille.cible,
        action: "import-cible",
        attrs: `data-feuille="${esc(feuille.cle)}"`,
      })}
      ${etat ? `<div class="fr-mt-2w">${etat}</div>` : ""}
      <div class="fr-mt-2w">${panel("Colonnes", correspondances, { iconName: "list-check", level: "h4", collapsible: true })}</div>
    `, { iconName: "table-line", level: "h3", subtitle: resume });
  });

  const intro = imp.format === "csv"
    ? `<p class="fr-text--sm fr-mb-2w">Un fichier délimité ne porte qu'une table : l'outil l'a reconnue d'après le nom du fichier et ses colonnes. Corrigez le choix ci-dessous si elle a changé de nom.</p>`
    : imp.format === "classeur"
      ? `<p class="fr-text--sm fr-mb-2w">Le classeur est repris feuille par feuille : chaque feuille est rapprochée d'une table par son nom, puis par ses colonnes. Une feuille laissée de côté n'est pas importée.</p>`
      : imp.format === "grist"
        ? `<p class="fr-text--sm fr-mb-2w">Les tables du document sont reconnues par leur nom. Celles que l'outil ne connaît pas — les tables Grist internes, ou une table sans rapport avec le modèle — sont laissées de côté.</p>`
        : `<p class="fr-text--sm fr-mb-2w">Les tables de l'export JSON sont reconnues par leur nom.</p>`;

  return panel("Tables du fichier", `${intro}${blocs.join("")}`,
    { iconName: "table-line", subtitle: "Ce que contient la source, et la table de l'outil qui le reçoit" });
}

function analysePanel(state) {
  const analyse = state.import?.analyse;
  // Rien à analyser tant qu'aucune source n'est choisie : la page se réduit
  // alors à sa « Source des données », au lieu d'afficher le squelette d'un
  // rapport vide.
  if (!analyse) return "";
  if (analyse.vide) {
    return panel("Analyse", alert("warning", "Source vide",
      "Le fichier ne contient aucune table reconnue. Vérifiez qu'il s'agit bien d'un export de l'outil ou d'un export Grist."), { iconName: "search-line" });
  }
  const nature = analyse.estOrigine && analyse.estV2
    ? "Tableur d'origine, à demi converti : les deux formes cohabitent, l'outil prend la plus récente pour chaque table."
    : analyse.estOrigine
      ? "Tableur d'origine : la conversion créera les personnes, les intervenants et les catalogues manquants."
      : "Modèle de l'outil : la source est reprise telle quelle, et seule la reprise dans une base existante s'applique.";

  const rows = analyse.tables.map((t) => ({
    id: t.name,
    cells: [
      esc(t.label),
      `<strong>${t.lignes}</strong>`,
      t.heritage ? tag("héritage", "warning") : tag("reprise", "blue"),
      esc(natureDeTable(t.name)),
    ],
  }));

  return panel("Analyse", `
    ${alert("info", "Nature de la source", nature)}
    <div class="fr-mt-2w">
      ${dataTable({
        caption: `${analyse.tables.length} table(s) reconnue(s) — ${analyse.total} ligne(s) au total`,
        columns: ["Table", "Lignes", "Statut", "Ce que l'outil en fait"],
        rows,
        rowAttr: "",
        emptyText: "Aucune table reconnue.",
        class: "app-table--fixed app-table--wrap",
        cols: ["16rem", "5rem", "6rem", "auto"],
      })}
    </div>
    ${analyse.avertissements.length
      ? `<div class="fr-mt-2w app-stack">${analyse.avertissements.map((a) => alert(a.niveau === "avertissement" ? "warning" : "info", "À savoir", a.texte)).join("")}</div>`
      : ""}
  `, { iconName: "search-line", subtitle: "Ce qui sera repris, créé ou ignoré" });
}

function natureDeTable(name) {
  if (SCHEMA[name]?.legacy) return "Lue pour la reprise ; jamais écrite.";
  const colonnes = LEGACY_COLUMNS[name]?.columns || {};
  const reprises = Object.values(colonnes).filter((c) => c.statut === "reprise").length;
  const deplacees = Object.values(colonnes).filter((c) => c.statut === "deplacee").length;
  if (!reprises && !deplacees) return "Reprise telle quelle.";
  const parties = [];
  if (reprises) parties.push(`${reprises} colonne(s) reprise(s)`);
  if (deplacees) parties.push(`${deplacees} déplacée(s)`);
  const calculees = Object.values(colonnes).filter((c) => c.statut === "calculee").length;
  if (calculees) parties.push(`${calculees} recalculée(s)`);
  return `${parties.join(", ")}.`;
}

function correspondancePanel() {
  const blocs = Object.entries(LEGACY_COLUMNS).map(([table, def]) => {
    const rows = Object.entries(def.columns).map(([col, dest]) => ({
      id: `${table}.${col}`,
      cells: [
        `<code>${esc(col)}</code>`,
        dest.statut === "reprise"
          ? `<code>${esc(dest.target)}</code>`
          : dest.statut === "deplacee"
            ? `<code>${esc(dest.target)}</code> <span class="fr-hint-text">${esc(dest.note || "")}</span>`
            : `<span class="fr-text-mention--grey">${esc(dest.note || "recalculée")}</span>`,
        tag(dest.statut === "reprise" ? "reprise" : dest.statut === "deplacee" ? "déplacée" : "calculée",
          dest.statut === "reprise" ? "blue" : dest.statut === "deplacee" ? "warning" : "grey"),
      ],
    }));
    return panel(`Table « ${def.label} »`, dataTable({
      caption: `Correspondance des colonnes de ${def.label}`,
      columns: ["Colonne d'origine", "Devient", "Statut"],
      rows,
      rowAttr: "",
      class: "app-table--fixed app-table--wrap",
      cols: ["16rem", "auto", "6rem"],
    }), { iconName: "arrow-right-line", level: "h3", collapsible: true });
  });

  const abandonnees = dataTable({
    caption: `${LEGACY_DROPPED.length} colonne(s) non reprises`,
    columns: ["Colonne", "Pourquoi"],
    rows: LEGACY_DROPPED.map((d) => ({ id: d.source, cells: [`<code>${esc(d.source)}</code>`, esc(d.raison)] })),
    rowAttr: "",
    class: "app-table--fixed app-table--wrap",
    cols: ["16rem", "auto"],
  });

  return panel("Correspondance des colonnes", `
    <p class="fr-text--sm">
      Ce tableau décrit, colonne par colonne, ce que devient le tableur d'origine. Les colonnes calculées
      du document d'origine ne sont pas reprises : elles sont recalculées par l'outil, à partir des données
      saisies. Aucune colonne de la source n'est supprimée — c'est à vous de nettoyer le document, une fois
      l'import vérifié.
    </p>
    <div class="app-stack fr-mt-2w">${blocs.join("")}</div>
    <div class="fr-mt-2w">${abandonnees}</div>
  `, { iconName: "list-check", subtitle: "Le détail de la conversion, table par table", collapsible: true });
}

function applicationPanel(store, state) {
  const imp = state.import || {};
  const analyse = imp.analyse;
  // Une source reconnue mais vide ne s'applique pas : le rapport d'analyse le
  // dit, et il n'y a rien à écrire.
  if (!analyse || analyse.vide) return "";
  const mode = imp.mode || "completer";
  return panel("Application", `
    <fieldset class="fr-fieldset">
      <legend class="fr-fieldset__legend fr-text--regular">Que faire des données déjà présentes ?</legend>
      <div class="fr-fieldset__content">
        <div class="fr-radio-group">
          <input type="radio" id="importModeCompleter" name="importMode" value="completer"
            data-action="import-mode" aria-describedby="importModeCompleter-desc" ${mode === "completer" ? "checked" : ""}>
          <label class="fr-label" for="importModeCompleter">Compléter</label>
          <p class="fr-hint-text app-desc" id="importModeCompleter-desc">Rapproche chaque ligne reçue d'une ligne existante (numéro d'affaire, courriel,
            nom…) et l'ajoute seulement si elle est nouvelle. Réimporté sur une base déjà convertie, l'import n'ajoute rien.</p>
        </div>
        <div class="fr-radio-group">
          <input type="radio" id="importModeRemplacer" name="importMode" value="remplacer"
            data-action="import-mode" aria-describedby="importModeRemplacer-desc" ${mode === "remplacer" ? "checked" : ""}>
          <label class="fr-label" for="importModeRemplacer">Remplacer</label>
          <p class="fr-hint-text app-desc" id="importModeRemplacer-desc">Vide les tables de l'outil avant d'écrire la source. Le répertoire des pratiques
            et les catalogues sont reconstruits à partir de la source. À n'utiliser que si votre base actuelle est un
            brouillon, ou après un export de sauvegarde.</p>
        </div>
      </div>
    </fieldset>
    <div class="app-row fr-mt-3w">
      ${button(mode === "remplacer" ? "Remplacer par cette source" : "Compléter avec cette source", {
        variant: "primary", iconName: "download-line", action: "import-appliquer",
      })}
    </div>
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      L'import ajoute une ligne au registre (Réglages › Données) : on sait ce qui a été repris, et quand.
    </p>
  `, { iconName: "download-line", subtitle: "Le mode d'écriture, et le lancement" });
}

function resultatPanel(state) {
  const res = state.import?.resultat;
  if (!res) return "";
  const creees = Object.entries(res.creees);
  const rapprochees = Object.entries(res.rapprochees);
  return panel("Import terminé", `
    <div class="fr-grid-row fr-grid-row--gutters">
      <div class="fr-col-12 fr-col-lg-6">
        ${fieldset("Lignes créées", creees.length
          ? ui.dl(creees.map(([t, n]) => [SCHEMA[t]?.label || t, String(n)]))
          : `<p class="fr-text--sm fr-mb-0">Aucune ligne créée : tout était déjà présent.</p>`)}
      </div>
      <div class="fr-col-12 fr-col-lg-6">
        ${fieldset("Lignes rapprochées", rapprochees.length
          ? ui.dl(rapprochees.map(([t, n]) => [SCHEMA[t]?.label || t, String(n)]))
          : `<p class="fr-text--sm fr-mb-0">Aucune ligne existante mise à jour.</p>`)}
      </div>
    </div>
    ${res.referencesNonResolues
      ? `<div class="fr-mt-2w">${alert("warning", "Références non résolues",
        `${res.referencesNonResolues} lien(s) pointaient vers une ligne absente de la source : la colonne correspondante a été laissée vide.`
        + (res.referencesManquantes?.length
          ? `<ul class="fr-mt-1v fr-mb-0">${res.referencesManquantes.slice(0, 12).map((m) => `<li><code>${esc(m)}</code></li>`).join("")}</ul>`
          : ""))}</div>`
      : ""}
    ${res.avertissements?.length
      ? `<div class="fr-mt-2w app-stack">${res.avertissements.map((a) => alert(a.niveau === "avertissement" ? "warning" : "info", "À savoir", a.texte)).join("")}</div>`
      : ""}
  `, { iconName: "checkbox-circle-line", subtitle: "Ce qui a été écrit dans la base" });
}

export function viewImport(store, state) {
  // La correspondance des colonnes du tableur d'origine est une référence :
  // elle ne sert qu'une fois une source en main, et encombrait la page tant
  // qu'il n'y avait rien à convertir.
  const correspondance = state.import?.analyse ? correspondancePanel() : "";
  return `
${reglagesHead(store, state, "Import des données",
    "Reprendre un document Grist, un classeur ou un fichier délimité dans le modèle de l'outil, et vérifier la conversion avant de l'appliquer.")}
<div class="app-stack">
  ${sourcePanel(store, state)}
  ${feuillesPanel(state)}
  ${analysePanel(state)}
  ${applicationPanel(store, state)}
  ${resultatPanel(state)}
  ${correspondance}
</div>`;
}
