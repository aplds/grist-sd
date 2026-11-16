// Réglages de l'outil.
//
// Onze sous-pages : les sections et leurs membres, le répertoire des personnes,
// les secrétaires, les destinataires institutionnels, les catalogues (sanctions,
// motifs, paramètres), les trames de documents, les types de trames, la reprise
// d'un tableur existant, l'identité de l'outil (logo de l'en-tête), la charte
// graphique (charte de l'État ou charte neutre, et police des documents) et
// enfin les données (export, import, réinitialisation, connexion Grist).

import {
  BALISE_CORPS, SCHEMA, TOUTES, FICHES_SUBS,
  FORMAT_DECISION, FORMAT_ORDONNANCE, FORMATS_RENDUS, FORMAT_ATTESTATION, FORMAT_RAPPORT,
  ORGANE_PRESIDENT_SECTION, ORGANE_PRESIDENT_FORMATION, ORGANE_FORMATION,
  AUTEUR_PRESIDENT_SECTION, AUTEUR_PRESIDENT_COMMISSION, AUTEUR_FORMATION, DEST_MIS_EN_CAUSE,
} from "../schema.js";
import { computeDocumentParts, decouperFeuille, documentScope, enteteHtml, styleRegex } from "../render.js";
import { CHARTE_ETAT, CHARTE_NEUTRE, POLICE_NEUTRE, charte, charteNeutre, policeDocumentCss, policeDocuments } from "../charte.js";
import { DICTIONNAIRE_HTML } from "../dictionary.js";
import { aujourdHui, formatDateFr } from "../formulas.js";
import { signataireDeLaSection } from "../signataire.js";
import { planAlignementCatalogue, seuil, seuilTexte } from "../regimes.js";
import { compteAlignement, contenusLivres, detailAlignement, planAlignementContenus, planEstVide, signatureContenus } from "../contenus.js";
import { referencesDuRepertoire, rubriqueDe } from "../considerants.js";
import { versionLivraison } from "../version.js";
import { documentReadOnly, documentTables, gristApiUrl, gristAvailable, gristOriginesDiagnostic, lastWriteError, nestedFrame, originesGristDeclarees, sessionUsers, widgetAccessLevel, writesEnabled, SESSION_TABLE } from "../grist-backend.js";
import { currentRole, roleBadgeClass, roleFromGristAccess, roleLabel } from "../roles.js";
import { procedure, noticeProcedure, compositionAttendue, collegeDe, tutelleCourte, COLLEGES, objetDuTexte } from "../procedure.js";
import { tramesParDefautManquantes, typesTramesParDefautManquants } from "../trames-defaut.js";
import { chipHtml, htmlCanonique, htmlToEditor, paletteHtml, toolbarHtml } from "../editor.js";
import { diagnosticReport } from "../diagnostic.js";
import { GROUPE_DECISION, LIBELLE_CORPS, feuilleCatalog, labelOfToken, trameCatalog } from "../trame-variables.js";
import * as ui from "../ui.js";
import { REGLAGES_SUBS, masterPanel, matches, outils, reglagesHead, selectedOrFirst, listItem, sortRecords, split, subnav, exportMenu, exportTableButtons } from "./common.js";
import { COLONNES_MEMBRES } from "../membres-csv.js";
import { loadPrefs, occupationStockage } from "../store.js";
import { viewImport } from "./import.js";

const { esc, str, icon, badge, panel, alert, emptyState, button, field, formGrid, dataTable, dateTimeCell, dl, tag, fieldset, brandBlock } = ui;

/* ------------------------------------------------------------------ */
/* Rappel de procédure et contrôle indicatif de la composition         */
/* ------------------------------------------------------------------ */

/**
 * Rappel de la procédure applicable à la section, et rapprochement — purement
 * indicatif — entre la composition attendue par les textes et les membres
 * saisis. Rien n'est bloqué : l'outil signale, à la composition, ce qui
 * manque ou ce qui excède, comme le font les contrôles de régularité d'une
 * affaire.
 */
function procedurePanel(store, section) {
  const d = procedure(section);
  const comp = compositionAttendue(section);
  const membres = store.table("Membres").filter((m) => Number(m.Section) === Number(section.id));

  const parCollege = {};
  for (const m of membres) {
    const cle = collegeDe(m);
    if (cle) parCollege[cle] = (parCollege[cle] || 0) + 1;
  }
  const clesAttendues = new Set(comp.sectionListe.map((p) => p.cle).filter(Boolean));

  const lignes = comp.sectionListe.map((poste) => {
    const saisis = poste.cle ? (parCollege[poste.cle] || 0) : null;
    const ecart = saisis === null ? 0 : saisis - poste.n;
    const etat = saisis === null
      ? ""
      : ecart === 0
        ? tag("Complet", "green")
        : ecart < 0
          ? tag(`${-ecart} manquant(s)`, "warning")
          : tag(`${ecart} en trop`, "orange");
    return {
      id: `${poste.label}-${poste.n}`,
      cells: [
        esc(COLLEGES[poste.cle]?.label || poste.label),
        String(poste.n),
        saisis === null ? "—" : String(saisis),
        etat,
      ],
    };
  });

  const sansCollege = membres.filter((m) => {
    const cle = collegeDe(m);
    return !cle || !clesAttendues.has(cle);
  });
  // Les avertissements de composition restent collés au tableau qu'ils
  // commentent ; ceux de prescription et d'effacement, qui portent sur la
  // procédure, ont rejoint le bloc « Prescription et effacement » ci-dessous.
  const avertissements = [
    sansCollege.length
      ? `${sansCollege.length} membre(s) rattaché(s) à un collège que cette section n'appelle pas, ou sans collège renseigné : ${sansCollege.map((m) => esc(`${m.Prenom || ""} ${m.NOM || ""}`.trim() || `#${m.id}`)).join(", ")}.`
      : "",
    !membres.length ? "Aucun membre n'est encore rattaché à cette section." : "",
  ].filter(Boolean);

  // La procédure se lit comme une fiche : trois blocs courts — qui juge, comment
  // l'affaire se déroule, ce qui se prescrit ou s'efface — puis les textes. Le
  // libellé de chaque renvoi dit ce que le texte fonde, sans quoi la liste des
  // articles n'est qu'une énumération indifférenciée.
  const blocOrganes = fieldset("Organes et quorum", dl([
    ["Organe compétent", esc(d.organe), true],
    ["Formation appelée à juger", esc(d.formation), true],
    ["Quorum", `${esc(d.quorum.regle)} ${esc(d.quorum.detail)}`, true],
  ], { variante: "lignes" }));

  const blocDeroulement = fieldset("Déroulement", dl([
    ["Voies de traitement", d.voieR81140
      ? "Section disciplinaire (avec instruction), ou entretien disciplinaire (R.811-40)"
      : "Section disciplinaire (avec instruction)", true],
    ["Convocation à la séance", `${d.delais.convocationJours} jours au moins avant la date`, true],
    d.delais.consultationDossierJours
      ? ["Consultation du dossier", `${d.delais.consultationDossierJours} jours au moins avant la séance`, true]
      : null,
    d.delais.entretienJours
      ? ["Entretien (R.811-40)", `convocation ${d.delais.entretienJours} jours avant, réponse dans les ${d.delais.reponseJours} jours`, true]
      : null,
  ], { variante: "lignes" }));

  const blocPrescription = fieldset("Prescription et effacement", dl([
    ["Prescription", d.prescription.applicable
      ? `${d.prescription.annees} ans ${esc(d.prescription.base)}. ${esc(d.prescription.detail)}`
      : `Sans objet : aucune action disciplinaire n'est prescrite pour les usagers, qui peut être engagée à tout moment.`,
      true],
    ["Effacement", `${esc(d.effacement.sanctions)} — ${esc(d.effacement.detail)}`, true],
  ], { variante: "lignes" }));

  const blocTextes = fieldset("Textes de référence", dl(
    d.textes.map((ref) => [objetDuTexte(ref) || "Texte de référence", esc(ref), true]),
    { variante: "lignes" }
  ), { hint: "Les textes dont cette procédure et cette composition découlent." });

  return panel("Procédure et composition", `
    <p class="fr-text--sm">
      La <strong>procédure</strong> découle du public (${esc(d.public)}) ; la <strong>composition</strong>, de la
      tutelle et du type de section. Le tableau ci-dessous rapproche ce que les textes attendent des membres
      saisis : il est <strong>indicatif</strong> et ne bloque aucune saisie.
    </p>
    <div class="fr-mt-2w">
      ${dataTable({
        caption: `Composition attendue de la section — ${comp.section}`,
        columns: ["Collège", "Attendu", "Saisis", "État"],
        rows: lignes,
        rowAttr: "",
        emptyText: "Cette section n'appelle pas de composition élective.",
      })}
    </div>
    ${avertissements.length
      ? `<ul class="fr-mt-2w fr-mb-0">${avertissements.map((a) => `<li class="fr-text--sm">${a}</li>`).join("")}</ul>`
      : ""}
    ${comp.note ? `<p class="fr-hint-text fr-mt-2w fr-mb-0">${esc(comp.note)}</p>` : ""}
    <div class="fr-mt-3w app-procedure">${blocOrganes}${blocDeroulement}${blocPrescription}${blocTextes}</div>
  `, {
    iconName: "scales-3-line",
    subtitle: "Ce que la procédure prévoit, et où en est la composition",
  });
}

/** Rappel repliable de la procédure, sous sa forme rédigée (page Aide). */
function noticePanel(section) {
  const n = noticeProcedure(section);
  const body = n.blocs.map((b) => `
    <p class="fr-mb-1v"><strong>${esc(b.titre)}</strong></p>
    <ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`).join("");
  return panel("Explication de la procédure", `<div class="app-prose">${body}</div>`, {
    iconName: "book-2-line",
    subtitle: n.sousTitre,
    collapsible: true,
  });
}

/* ------------------------------------------------------------------ */
/* Sections et membres                                                 */
/* ------------------------------------------------------------------ */

function membresTable(store, state, section) {
  const ctx = state.ctx;
  const rows = store.table("Membres").filter((m) => Number(m.Section) === Number(section.id));
  if (!rows.length) {
    return emptyState("Aucun membre rattaché à cette section. Ajoutez les enseignants et usagers qui composent la section.", {
      iconName: "team-line",
      action: button("Ajouter un membre", { variant: "secondary", iconName: "user-add-line", action: "add-membre" }),
    });
  }
  const cell = (m, colId) => field("Membres", colId, ctx, m, { store, compact: true });
  return `
<div class="fr-table fr-table--bordered fr-table--sm app-table--dense">
  <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
    <table>
      <caption class="fr-sr-only">Composition de la section ${esc(str(section.Structure))}</caption>
      <thead><tr>
        <th scope="col">Prénom</th><th scope="col">NOM</th><th scope="col">Genre</th><th scope="col">Collège</th>
        <th scope="col">Courriel</th><th scope="col">Terme</th><th scope="col">Rôle</th><th scope="col">Statut</th>
        <th scope="col"><span class="fr-sr-only">Actions</span></th>
      </tr></thead>
      <tbody>
        ${rows.map((m) => `
        <tr>
          <td>${cell(m, "Prenom")}</td>
          <td>${cell(m, "NOM")}</td>
          <td>${cell(m, "Genre")}</td>
          <td>${cell(m, "College")}</td>
          <td>${cell(m, "Email")}</td>
          <td>${cell(m, "Fin_de_mandat")}</td>
          <td>${cell(m, "Role")}</td>
          <td>${ctx.v("Membres", m, "En_fonction") ? badge("En fonction") : `<span class="fr-text-mention--grey">Mandat échu</span>`}</td>
          <td class="app-cell-action">${ui.iconButton("delete-bin-line", { title: "Supprimer ce membre", attrs: `data-delete="Membres:${m.id}"` })}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div></div></div>
</div>`;
}

function viewSections(store, state) {
  const ctx = state.ctx;
  const rows = store.table("Sections_disciplinaires");
  const selected = selectedOrFirst(store, state, "Sections_disciplinaires", rows);

  const aside = masterPanel({
    title: "Sections",
    iconName: "school-line",
    count: `${rows.length} section(s)`,
    scrollKey: "sectionList",
    body: rows.length
      ? rows.map((s) => listItem({
          table: "Sections_disciplinaires",
          id: s.id,
          selected: selected && s.id === selected.id,
          ref: esc(str(s.Acronyme) || `#${s.id}`),
          name: esc(str(s.Structure) || "Structure sans nom"),
          meta: [s.Siege ? `<span>${esc(str(s.Siege))}</span>` : "", s.Public ? `<span>${esc(str(s.Public))}</span>` : "", s.Tutelle ? `<span>${esc(str(s.Tutelle))}</span>` : ""].filter(Boolean).join(""),
        })).join("")
      : emptyState("Aucune section disciplinaire.", { iconName: "school-line" }),
  });

  const exportSections = exportTableButtons({
    table: "Sections_disciplinaires", rows, titre: "Télécharger la liste des sections disciplinaires",
  });

  if (!selected) {
    return `
${reglagesHead(store, state, "Sections et membres", "Définissez les sections disciplinaires, leur siège, leur public et leur composition.", exportSections)}
${split(aside, panel("Première section", emptyState(
      "Créez une section disciplinaire pour commencer : son acronyme sert à générer les numéros d'affaires et de séances.",
      { iconName: "school-line", action: button("Ajouter une section", { variant: "primary", iconName: "add-line", action: "add-section" }) }
    ), { iconName: "school-line" }))}`;
  }

  // Qui signe les courriers de cette section : son président, ou son
  // vice-président quand le président est empêché (voir `src/signataire.js`).
  // Ce réglage vaut pour toutes les pièces ; celui d'un document, plus fin,
  // s'ajoute au moment de le rédiger (voir views/documents.js).
  const vpSection = Boolean(selected.VP);
  const signataire = signataireDeLaSection(store.db, selected, vpSection);
  const signatureSection = fieldset("Signature des courriers", `
    ${formGrid("Sections_disciplinaires", ["VP"], ctx, selected, { store })}
    ${signataire.membres.length
      ? `<p class="app-signataire">${icon("user-line", 'class="fr-mr-1v"')}Signé par `
        + `<strong>${esc(str(signataire.nom).trim())}</strong> — ${esc(signataire.qualite)}.</p>`
      : ui.alert("warning", `Aucun membre au rôle « ${signataire.role} »`,
        `Les courriers de cette section partiront sans nom de signataire. Ajoutez ce rôle dans la composition `
        + `de la section, ci-dessous.`)}`, {
    hint: "Coché, le vice-président signe toutes les pièces de la section : c'est le remplacement durable. "
      + "Pour l'absence brève du président — le temps d'un courrier — cochez plutôt la case du document "
      + "concerné, dans les paramètres de son espace de rédaction (vue Documents).",
  });

  // La fiche d'une section tient en cinq lectures, qui étaient cinq blocs
  // empilés sur une page de cinq mille pixels : sa désignation, son en-tête de
  // courrier, ses secrétaires, ses membres, et sa procédure. Les onglets les
  // séparent — on n'a jamais besoin des cinq à la fois — et chacun garde la
  // totalité de la largeur.
  const fsDesignation = fieldset("Désignation", formGrid("Sections_disciplinaires", [
    "Structure", "Structure_Nom_Complet", "Acronyme", "Public", "Tutelle", "Type_de_section",
  ], ctx, selected, { store }), {
    hint: "L'acronyme préfixe les numéros d'affaires et de séances. Le régime (usagers ou enseignants-chercheurs) détermine la procédure suivie et les catalogues proposés ; la tutelle et le type de section déterminent la composition des organes disciplinaires. Un même établissement peut avoir plusieurs sections.",
  });
  const fsSiege = fieldset("Siège et secrétariat", formGrid("Sections_disciplinaires", [
    "Siege", "Email_de_contact", "Secretariat_Rue", "Secretariat_CP_Ville",
  ], ctx, selected, { store }));
  const fsSecretaires = fieldset("Secrétaires rattachés", `${field("Sections_disciplinaires", "Secretaires", ctx, selected, {
    store,
    metaFor: (s) => [str(s.Email), s.Actif_ ? "" : "inactif"].filter(Boolean).join(" — "),
    vide: "Aucune secrétaire dans ce document. Créez-en une dans Réglages › Secrétaires.",
  })}
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      Cocher une secrétaire la rattache à cette section, décocher la détache. Le rattachement se
      règle ici <strong>ou</strong> sur la fiche de la secrétaire (Réglages › Secrétaires) : les deux
      faces d'une même relation se répondent, où qu'on l'écrive. Une secrétaire ne voit que les
      affaires des sections auxquelles elle est rattachée.
    </p>`, {
    hint: "Qui suit les affaires de cette section.",
  });
  const fsEntete = fieldset("En-tête des courriers", `${formGrid("Sections_disciplinaires", [
    "Logo", "Marianne",
  ], ctx, selected, { store })}
    <div class="app-row fr-mt-1w">
      ${button("Choisir le bloc-marque sur ce poste…", {
        variant: "secondary", size: "sm", iconName: "upload-line",
        attrs: 'data-action="image-fichier" data-champ="sectionMarianneFile"',
        title: "Enregistre l'image dans le document : elle figure alors dans tous les exports",
      })}
      ${button("Choisir le logo sur ce poste…", {
        variant: "secondary", size: "sm", iconName: "upload-line",
        attrs: 'data-action="image-fichier" data-champ="sectionLogoFile"',
        title: "Enregistre l'image dans le document : elle figure alors dans tous les exports",
      })}
    </div>
    <input type="file" id="sectionMarianneFile" accept="image/*" hidden aria-label="Image du bloc-marque de l'État"
      data-table="Sections_disciplinaires" data-record="${selected.id}" data-colonne="Marianne">
    <input type="file" id="sectionLogoFile" accept="image/*" hidden aria-label="Logo de la section"
      data-table="Sections_disciplinaires" data-record="${selected.id}" data-colonne="Logo">`, {
    hint: "Ces éléments sont repris par les trames de documents. Une adresse d'image (https://…) est chargée "
      + "depuis son hébergeur : pratique, mais elle n'est intégrée aux fichiers exportés que si cet hébergeur "
      + "y autorise l'accès — la plupart des sites publics le refusent, et le document part alors sans l'image. "
      + "« Choisir une image sur ce poste » l'enregistre dans la base : elle est intégrée à coup sûr "
      + "(limite 512 Ko). Laisser « Marianne » vide emploie le bloc-marque officiel fourni avec l'outil — "
      + "sauf avec la charte neutre, qui n'affiche jamais la marque de l'État (Réglages › Charte graphique). "
      + "La place et la taille des deux images dans la page ne se règlent pas ici, mais par feuille de style "
      + "— Réglages › Formats et feuilles de style, sur la fiche du format, panneau « En-tête : les deux logos ».",
  });

  const identite = panel("Identité de la section", `${fsDesignation}${fsSiege}`, {
    iconName: "school-line",
    subtitle: "Ce que la section fait apparaître dans les documents et les numéros d'affaire",
    actions: `${button("Ajouter une section", { variant: "tertiary", size: "sm", iconName: "add-line", action: "add-section" })}
      <button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-delete="Sections_disciplinaires:${selected.id}">${icon("delete-bin-line", 'class="fr-mr-1v"')}Supprimer</button>`,
  });

  const entetePanel = panel("En-tête des courriers", `${fsEntete}${signatureSection}`, {
    iconName: "mail-line",
    subtitle: "Le bloc-marque, le logo et la signature repris par les trames de la section",
    collapsible: true,
  });

  const secretairesPanel = panel("Secrétaires rattachés", fsSecretaires, {
    iconName: "user-star-line",
    subtitle: "Qui suit les affaires de cette section",
    collapsible: true,
  });

  const membresDeLaSection = store.table("Membres").filter((m) => Number(m.Section) === Number(selected.id));
  const nbrMembres = membresDeLaSection.length;

  const membres = panel("Membres de la section", `
    ${membresTable(store, state, selected)}
    <input type="file" id="membresCsvFile" accept=".csv,text/csv,text/plain" hidden>
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      La composition d'une section se remplit plus vite par fichier : exportez le modèle, il contient une
      ligne par siège prévu par les textes, avec le collège et le rôle déjà remplis. Écrivez les noms,
      puis réimportez-le — les membres déjà saisis sont reconnus par leur courriel, à défaut par leur nom,
      et mis à jour au lieu d'être dupliqués.
    </p>
  `, {
    iconName: "team-line",
    subtitle: `${nbrMembres} membre(s) rattaché(s) — la composition s'édite directement dans le tableau`,
    actions: `${button("Ajouter un membre", { variant: "secondary", size: "sm", iconName: "user-add-line", action: "add-membre" })}
      ${button("Modèle CSV", { variant: "tertiary", size: "sm", iconName: "download-line", action: "membres-modele",
        title: "Télécharger un modèle vierge, une ligne par siège attendu" })}
      ${button("Exporter les membres", { variant: "tertiary", size: "sm", iconName: "download-line", action: "membres-export",
        title: "Télécharger la composition actuelle au format CSV" })}
      ${exportTableButtons({
        table: "Membres",
        rows: membresDeLaSection,
        // Mêmes colonnes que le modèle et l'export CSV : un classeur rempli
        // comme le fichier se réimporte tel quel.
        colonnes: COLONNES_MEMBRES.map((c) => c.id),
        suffixe: str(selected.Acronyme) || str(selected.Structure),
        size: "sm",
        formats: ["xlsx"],
        titre: "Télécharger la composition actuelle au format Excel, avec les colonnes du modèle CSV",
      })}
      ${button("Importer un CSV", { variant: "tertiary", size: "sm", iconName: "upload-line", action: "membres-import",
        title: "Compléter la composition à partir d'un fichier CSV" })}`,
  });

  const calculs = panel("Données calculées", dl([
    ["Intitulé de la section", esc(str(ctx.v("Sections_disciplinaires", selected, "Intitule_de_la_section"))), true],
    ["Président", esc(str(ctx.v("Sections_disciplinaires", selected, "President"))) || "—", true],
    ["Formule", esc(str(ctx.v("Sections_disciplinaires", selected, "Formule"))) || "—", true],
    ["Formule complète", esc(str(ctx.v("Sections_disciplinaires", selected, "Formule_complete"))) || "—", true],
    ["Courriels des secrétaires", esc(str(ctx.v("Sections_disciplinaires", selected, "Secretaires_Email"))) || "—", true],
  ]), {
    iconName: "information-line",
    subtitle: "Valeurs déduites : elles alimentent les trames et ne se saisissent pas",
    collapsible: true,
  });

  // Cinq lectures d'une même section, en onglets : c'est ce qui ramène la page
  // de cinq mille pixels à la hauteur d'un écran, sans rien retirer.
  const ongletsSection = [
    { id: "identite", label: "Identité", iconName: "school-line" },
    { id: "entete", label: "En-tête", iconName: "mail-line" },
    { id: "secretaires", label: "Secrétaires", iconName: "user-star-line" },
    { id: "membres", label: "Membres", iconName: "team-line", count: nbrMembres },
    { id: "procedure", label: "Procédure", iconName: "scales-3-line" },
  ];
  const ongletSection = ongletsSection.some((o) => o.id === state.tabs.sectionOnglets)
    ? state.tabs.sectionOnglets : "identite";
  const corpsSection = {
    identite,
    entete: entetePanel,
    secretaires: secretairesPanel,
    membres,
    procedure: `${procedurePanel(store, selected)}${noticePanel(selected)}${calculs}`,
  }[ongletSection];

  return `
${reglagesHead(store, state, "Sections et membres", "Définissez les sections disciplinaires, leur siège, leur public et leur composition.", exportSections)}
${split(aside, `
  ${ui.tabs({ id: "sectionOnglets", items: ongletsSection, active: ongletSection, label: "Fiche de la section" })}
  ${ui.tabPanel({ id: "sectionOnglets", tab: ongletSection, classe: "app-stack fr-mt-2w", contenu: corpsSection })}`)}`;
}

/* ------------------------------------------------------------------ */
/* Secrétaires                                                         */
/* ------------------------------------------------------------------ */

function viewSecretaires(store, state) {
  const ctx = state.ctx;
  const rows = sortRecords(store.table("Secretaires"), (s) => str(ctx.v("Secretaires", s, "Nom_complet")), "asc");
  const selected = selectedOrFirst(store, state, "Secretaires", rows);

  const aside = masterPanel({
    title: "Secrétaires",
    iconName: "user-star-line",
    count: `${rows.length} secrétaire(s)`,
    scrollKey: "secretaireList",
    body: rows.length
      ? rows.map((s) => listItem({
          table: "Secretaires",
          id: s.id,
          selected: selected && s.id === selected.id,
          ref: esc(str(ctx.v("Secretaires", s, "Nom_complet")) || `#${s.id}`),
          name: esc(str(s.Email)),
          meta: `<span class="app-list__meta-long">${esc(ctx.refList("Secretaires", s, "Section").map((x) => str(x.Structure)).join(", "))}</span>`,
          badgeHtml: s.Actif_ ? tag("Actif", "green") : tag("Inactif"),
        })).join("")
      : emptyState("Aucun secrétaire.", { iconName: "user-star-line" }),
  });

  const main = selected
    ? panel("Fiche du secrétaire", `
        ${formGrid("Secretaires", ["Prenom", "Nom", "Genre", "Email", "Actif_"], ctx, selected, { store })}
        ${fieldset("Sections suivies", `${field("Secretaires", "Section", ctx, selected, {
          store,
          metaFor: (s) => str(s.Acronyme) || str(s.Structure),
          vide: "Aucune section dans ce document. Créez-en une dans Réglages › Sections et membres.",
        })}
          <p class="fr-hint-text fr-mt-1w fr-mb-0">
            Cocher une section la confie à cette secrétaire ; décocher l'en détache. Le rattachement se
            règle ici <strong>ou</strong> sur la fiche de la section : les deux faces d'une même relation
            se répondent, où qu'on l'écrive. Une secrétaire ne voit que les affaires des sections
            auxquelles elle est rattachée.
          </p>`, { hint: "Les sections dont cette secrétaire suit les affaires." })}`, {
        iconName: "user-star-line",
        actions: `${button("Ajouter un secrétaire", { variant: "tertiary", size: "sm", iconName: "add-line", action: "add-secretaire" })}
          <button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-delete="Secretaires:${selected.id}">${icon("delete-bin-line", 'class="fr-mr-1v"')}Supprimer</button>`,
      })
    : panel("Secrétaire", emptyState("Sélectionnez ou créez un secrétaire.", {
        iconName: "user-star-line",
        action: button("Ajouter un secrétaire", { variant: "primary", iconName: "add-line", action: "add-secretaire" }),
      }), { iconName: "user-star-line" });

  return `
${reglagesHead(store, state, "Secrétaires", "Les secrétaires suivent les affaires et signent les courriers courants. Une secrétaire peut être rattachée à plusieurs sections.",
    exportTableButtons({ table: "Secretaires", rows, titre: "Télécharger la liste des secrétaires" }))}
${split(aside, main)}`;
}

/* ------------------------------------------------------------------ */
/* Destinataires institutionnels                                       */
/* ------------------------------------------------------------------ */

function viewDestinataires(store, state) {
  const ctx = state.ctx;
  const rows = sortRecords(store.table("Destinataires_institutionnels"), (d) => str(d.Nom_complet), "asc");
  const selected = selectedOrFirst(store, state, "Destinataires_institutionnels", rows);

  const aside = masterPanel({
    title: "Destinataires",
    iconName: "mail-line",
    count: `${rows.length} destinataire(s)`,
    scrollKey: "destinataireList",
    body: rows.length
      ? rows.map((d) => listItem({
          table: "Destinataires_institutionnels",
          id: d.id,
          selected: selected && d.id === selected.id,
          ref: esc(str(d.Nom_complet) || `#${d.id}`),
          name: esc(str(d.Qualite)),
          meta: `<span class="app-list__meta-long">${esc(ctx.refList("Destinataires_institutionnels", d, "Section").map((x) => str(x.Structure)).join(", "))}</span>`,
        })).join("")
      : emptyState("Aucun destinataire institutionnel.", { iconName: "mail-line" }),
  });

  const main = selected
    ? panel("Fiche du destinataire", `
        ${formGrid("Destinataires_institutionnels", [
          "Nom_complet", "Qualite", "Formule_de_politesse", "Signature", "Adresse", "Section",
        ], ctx, selected, { store, wide: ["Adresse"] })}
        <p class="fr-hint-text fr-mt-2w fr-mb-0">Ces fiches évitent de ressaisir les noms, qualités et adresses lors de la génération des documents ; elles sont proposées comme destinataire ou émetteur.</p>
      `, {
        iconName: "mail-line",
        actions: `${button("Ajouter un destinataire", { variant: "tertiary", size: "sm", iconName: "add-line", action: "add-destinataire" })}
          <button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-delete="Destinataires_institutionnels:${selected.id}">${icon("delete-bin-line", 'class="fr-mr-1v"')}Supprimer</button>`,
      })
    : panel("Destinataire", emptyState("Sélectionnez ou créez un destinataire.", {
        iconName: "mail-line",
        action: button("Ajouter un destinataire", { variant: "primary", iconName: "add-line", action: "add-destinataire" }),
      }), { iconName: "mail-line" });

  return `
${reglagesHead(store, state, "Destinataires institutionnels", "Présidents d'université, recteurs, ministres… Les fiches réutilisables pour l'émetteur et le destinataire des courriers.",
    exportTableButtons({ table: "Destinataires_institutionnels", rows, titre: "Télécharger la liste des destinataires institutionnels" }))}
${split(aside, main)}`;
}

/* ------------------------------------------------------------------ */
/* Trames                                                              */
/* ------------------------------------------------------------------ */

function exempleDocument(store, trame) {
  const db = store.db;
  const sections = db.Sections_disciplinaires || [];
  const sectionDe = (a) => sections.find((s) => s.id === Number(a.Section)) || null;
  // L'affaire d'exemple doit suivre la procédure visée par la trame : régime,
  // tutelle et type de section. Une trame générique (« Les deux », « Toutes »)
  // se contente du régime, comme les filtres de `tramesPour`.
  const convient = (a) => {
    const section = sectionDe(a);
    if (!section) return false;
    if (trame.Public && trame.Public !== "Les deux" && section.Public !== trame.Public) return false;
    if (trame.Tutelle && trame.Tutelle !== TOUTES && tutelleCourte(section.Tutelle) !== trame.Tutelle) return false;
    if (trame.Type_de_section && trame.Type_de_section !== TOUTES
      && section.Type_de_section !== trame.Type_de_section) return false;
    return true;
  };
  const strict = (db.Affaires || []).find(convient);
  const affaire = strict || (db.Affaires || []).find((a) => {
    const section = sectionDe(a);
    return !trame.Public || trame.Public === "Les deux" || section?.Public === trame.Public;
  }) || (db.Affaires || [])[0];
  if (!affaire) return null;
  // L'auteur et le destinataire viennent de la trame (voir `redaction.js`) :
  // l'exemple ne les impose donc pas. `Destinataire_institutionnel` et
  // `Personne_destinataire` restent libres — ils ne servent qu'à **désigner**
  // un destinataire parmi plusieurs, et le document d'exemple n'en a pas.
  return {
    id: -1,
    Affaire: affaire.id,
    Template: trame.id,
    Date: aujourdHui(),
    L_Destinataire: "Madame Julie Pasquier",
    L_Formule: "Madame",
    L_Adresse: "5 place du Marché, 69280 Valmont-sur-Loire",
    Champ_libre: "Champ libre à compléter",
  };
}

export function previewTrame(store, trame) {
  try {
    const doc = exempleDocument(store, trame);
    if (!doc) return "<p>Aperçu indisponible : aucune affaire d'exemple.</p>";
    return computeDocumentParts(store.db, doc).html;
  } catch (err) {
    return `<p>Aperçu indisponible : ${esc(err.message)}</p>`;
  }
}

/**
 * Une ligne du registre des trames : une case pour la prendre dans un lot, un
 * lien vers son espace de rédaction (`#reglages/trames/7`), et le geste qui la
 * met de côté. Le registre n'embarque pas l'éditeur — il y mène, comme celui
 * des documents. La suppression n'est jamais brutale : la trame part à la
 * corbeille, d'où elle revient d'un clic.
 */
function trameItem(store, ctx, t, { selection } = {}) {
  const tous = [
    t.Auteur ? `<span>${esc(str(t.Auteur))}</span>` : "",
    t.Destinataire ? `<span>${icon("arrow-right-line", 'class="fr-mr-1v"')}${esc(str(t.Destinataire))}</span>` : "",
    `<span>${esc(str(t.Public))}</span>`,
    t.Tutelle && t.Tutelle !== TOUTES ? `<span>${esc(str(t.Tutelle))}</span>` : "",
    t.Type_de_section && t.Type_de_section !== TOUTES ? `<span>${esc(str(t.Type_de_section))}</span>` : "",
    t.Decision_definitive ? "<span>Décision définitive</span>" : "",
    // Une trame dont la feuille de style diffère de celle de son format : c'est
    // une information à voir de la liste, sans ouvrir la trame.
    str(t.Feuille_de_style).trim() ? "<span>Feuille adaptée</span>" : "",
  ].filter(Boolean);
  // Quatre repères suffisent à la ligne : au-delà, elle s'allonge de deux ou
  // trois lignes et le registre double de hauteur. Le reste est dans l'infobulle
  // et se lit sur la fiche de la trame.
  const meta = tous.slice(0, 4);
  const reste = tous.length - meta.length;
  const nom = str(ctx.v("Trames", t, "Type_court_")) || str(t.Nom) || `#${t.id}`;
  const cochee = selection ? selection.has(t.id) : false;
  return `<div class="app-list__row">
    <div class="fr-checkbox-group app-check app-check--inline app-check--lot">
      <input type="checkbox" id="trame-sel-${t.id}" data-action="trames-cocher" data-record="${t.id}" ${cochee ? "checked" : ""}>
      <label class="fr-label" for="trame-sel-${t.id}"><span class="fr-sr-only">Sélectionner la trame ${esc(nom)}</span></label>
    </div>
    <a class="app-list__item" href="#reglages/trames/${t.id}" data-nav="reglages/trames/${t.id}"
      title="${esc([str(t.Objet), ...tous.map((m) => m.replace(/<[^>]+>/g, ""))].filter(Boolean).join(" — "))}">
      <span class="app-list__top">
        <span class="app-list__ref">${esc(nom)}</span>
        ${icon("arrow-right-line", 'class="app-list__go" aria-hidden="true"')}
      </span>
      <span class="app-list__name">${esc(str(t.Objet) || "Sans objet")}</span>
      ${meta.length ? `<span class="app-list__meta">${meta.join("")}${reste > 0 ? `<span title="${esc(tous.slice(4).map((m) => m.replace(/<[^>]+>/g, "")).join(" — "))}">+${reste}</span>` : ""}</span>` : ""}
    </a>
    ${ui.iconButton("delete-bin-line", {
      title: `Mettre la trame ${nom} à la corbeille`,
      attrs: `data-action="trame-corbeille" data-record="${t.id}"`,
    })}
  </div>`;
}

/**
 * Barre de lot du registre des trames : le compte des lignes affichées, de quoi
 * les cocher toutes d'un geste, et — **une fois la sélection faite** — le geste
 * qui les met de côté. Ce qu'une trame a de particulier, c'est qu'on en essaie
 * beaucoup : pouvoir en écarter une série d'un coup évite de les ouvrir l'une
 * après l'autre. Le bouton destructeur n'apparaît qu'avec une sélection : sans
 * rien de coché, il n'y a pas de lot à écarter, et un bouton qui met « les 44
 * trames » à la corbeille n'a pas à attendre le clic pour être vu.
 */
function barreLotTrames(store, state, rows) {
  if (!rows.length) return "";
  const selection = state.trames.ids.filter((id) => rows.some((t) => Number(t.id) === Number(id)));
  const tout = selection.length === rows.length;
  const ids = rows.map((t) => t.id).join(",");
  const compte = selection.length
    ? `${selection.length} trame${selection.length > 1 ? "s" : ""} sélectionnée${selection.length > 1 ? "s" : ""} sur ${rows.length}`
    : `${rows.length} trame${rows.length > 1 ? "s" : ""} affichée${rows.length > 1 ? "s" : ""}`;
  return `
<div class="app-lot" role="group" aria-label="Gestion des trames par lots">
  <p class="fr-text--sm fr-mb-0 app-lot__compte">${icon("checkbox-line", 'class="fr-mr-1v"')}${compte}</p>
  <div class="fr-checkbox-group app-check app-check--inline">
    <input type="checkbox" id="tramesTout" data-action="trames-tout" data-records="${ids}" ${tout ? "checked" : ""}>
    <label class="fr-label" for="tramesTout">Tout sélectionner</label>
  </div>
  ${selection.length ? button("Mettre la sélection à la corbeille", {
    variant: "secondary", size: "sm", iconName: "delete-bin-line", action: "trames-corbeille-selection",
  }) : ""}
  ${selection.length ? button("Désélectionner", {
    variant: "tertiary", size: "sm", iconName: "close-line", action: "trames-effacer",
  }) : ""}
</div>`;
}

/**
 * Le panneau « Corbeille » : ce qui a été mis de côté, avec de quoi le
 * remettre en place. Une trame restaurée retrouve son identifiant, donc les
 * documents qui s'en servaient la retrouvent du même coup.
 */
function corbeillePanel(store) {
  const entrees = sortRecords(store.table("Corbeille"), (c) => str(c.Nom), "asc");
  const corps = entrees.length
    ? dataTable({
        caption: `${entrees.length} élément(s) dans la corbeille — « Restaurer » rend la trame à sa place, « Supprimer » l'efface pour de bon`,
        columns: ["Nom", "Origine", "Supprimé le", "Supprimé par", "Actions"],
        cols: ["30%", "14%", "16%", "18%", "22%"],
        rowAttr: "",
        rows: entrees.map((c) => ({
          id: c.id,
          cells: [
            `<strong class="app-break">${esc(str(c.Nom) || `#${c.id}`)}</strong>`,
            esc(str(c.Table_libelle) || str(c.Table)),
            dateTimeCell(c.Supprime_le),
            `<span class="app-break">${esc(str(c.Supprime_par) || "—")}</span>`,
            `${button("Restaurer", { variant: "secondary", size: "sm", iconName: "arrow-go-back-line", action: "corbeille-restaurer", attrs: `data-record="${c.id}"` })}
             ${button("Supprimer", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", action: "corbeille-purger", attrs: `data-record="${c.id}"` })}`,
          ],
        })),
      })
    : emptyState("La corbeille est vide.", { iconName: "delete-bin-line" });
  const vider = entrees.length
    ? button(`Vider la corbeille`, { variant: "tertiary", size: "sm", iconName: "delete-bin-line", action: "corbeille-vider" })
    : "";
  const mois = seuil(store.db, "corbeille_retention_mois");
  const anciennes = entrees.filter((c) => {
    const d = Date.parse(String(c.Supprime_le || ""));
    return Number.isFinite(d) && d < Date.now() - mois * 30 * 24 * 3600 * 1000;
  }).length;
  const purger = entrees.length
    ? button(`Purger les entrées de plus de ${mois} mois${anciennes ? ` (${anciennes})` : ""}`, {
        variant: "tertiary", size: "sm", iconName: "delete-bin-7-line", action: "corbeille-purger-anciennes",
      })
    : "";
  return panel("Corbeille", `
    <p class="fr-text--sm fr-text-mention--grey fr-mb-2w">
      Une trame mise à la corbeille quitte le registre sans être détruite : les documents qui
      l'utilisaient restent en place, et la retrouvent dès qu'elle est restaurée.
      La conservation est réglée à <strong>${mois} mois</strong> (Réglages › Catalogues et délais) :
      au-delà, la purge efface définitivement les entrées les plus anciennes.
    </p>
    ${corps}
    ${entrees.length ? `<div class="fr-mt-2w">${purger}</div>` : ""}
  `, {
    iconName: "delete-bin-line",
    subtitle: entrees.length ? `${entrees.length} élément(s) mis de côté` : "Aucun élément mis de côté",
    actions: vider,
    id: "tramesCorbeille",
  });
}


/**
 * Trames du registre. La recherche porte sur ce qui identifie une trame — son
 * nom, son objet, la procédure visée — comme sur le texte qu'elle produit : on
 * retrouve souvent un courrier par une phrase, faute de se souvenir de son nom.
 */
function filteredTrames(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  let rows = sortRecords(store.table("Trames"), (t) => str(ctx.v("Trames", t, "Nom_complet")), "asc");
  if (f.tramesType) rows = rows.filter((t) => String(t.Type) === String(f.tramesType));
  if (f.tramesQ) {
    rows = rows.filter((t) => matches(f.tramesQ,
      ctx.v("Trames", t, "Nom_complet"), t.Nom, t.Objet, t.Public, t.Tutelle, t.Type_de_section,
      apercuTexte(t.Template_contenu), apercuTexte(t.Feuille_de_style)));
  }
  return rows;
}

/**
 * Le registre des trames : le rangement, et rien d'autre.
 *
 * Une liste filtrable, une ligne par trame, chacune menant à son espace de
 * rédaction. Le texte se rédige là-bas : la liste et l'éditeur ne se disputent
 * donc plus la largeur de la page.
 */
function viewTrames(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  const rows = filteredTrames(store, state);
  const types = sortRecords(store.table("Types_Trames"), (t) => str(t.Nom), "asc");
  const filtre = Object.keys(f).some((k) => k.startsWith("trames") && f[k]);
  const ajouter = button("Ajouter une trame", { variant: "primary", iconName: "add-line", action: "add-trame" });

  // La sélection vit hors du document (elle n'est qu'un geste d'écran) : on la
  // débarrasse des identifiants qui ne correspondent plus à rien, pour qu'une
  // trame mise à la corbeille entre-temps ne reste pas cochée dans le vide.
  const vivantes = new Set(store.table("Trames").map((t) => Number(t.id)));
  state.trames.ids = state.trames.ids.filter((id) => vivantes.has(Number(id)));
  const selection = new Set(state.trames.ids);

  const filtres = `
    <div class="app-filters">
      <div class="app-search">
        <label class="fr-label" for="tramesQ">Rechercher</label>
        <input class="fr-input" type="search" id="tramesQ" data-filter="tramesQ"
          value="${esc(f.tramesQ || "")}" placeholder="Nom, objet, texte de la trame…">
      </div>
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="tramesType">Format</label>
        <select class="fr-select" id="tramesType" data-filter="tramesType">
          <option value="">Tous les formats</option>
          ${types.map((t) => `<option value="${t.id}" ${String(f.tramesType) === String(t.id) ? "selected" : ""}>${esc(str(t.Nom))}</option>`).join("")}
        </select>
      </div>
    </div>`;

  // Trames et formats livrés par défaut : proposés à l'installation, et
  // rattrapables sur un document installé avant leur ajout. Le rapprochement
  // se fait sur le nom et la procédure visée (voir `trames-defaut.js`).
  const typesManquants = typesTramesParDefautManquants(store.db);
  const tramesManquantes = tramesParDefautManquantes(store.db);
  const total = typesManquants.length + tramesManquantes.length;
  const defaut = total
    ? alert("info", "Trames par défaut disponibles",
      `${tramesManquantes.length} trame(s) et ${typesManquants.length} format(s) livrés par défaut ne `
      + "figurent pas encore dans ce document — les trames adaptées à chaque procédure (tutelle, type de "
      + "section, décision définitive) en font partie.",
      button(`Installer ${total} élément(s) par défaut`, {
        variant: "secondary", size: "sm", iconName: "add-line", action: "installer-trames-defaut",
      }))
    : "";

  // Les trames se rangent **par format** : un courrier, une attestation, un
  // rapport d'instruction, une ordonnance, une décision. C'est la lecture
  // naturelle du registre — on cherche « la décision », pas « la trame n° 7 » —
  // et le filtre par format, quand il est actif, ne laisse qu'un seul groupe.
  const liste = rows.length
    ? (() => {
        const groupes = types
          .map((t) => ({ type: t, trames: rows.filter((x) => String(x.Type) === String(t.id)) }))
          .filter((g) => g.trames.length);
        const orphelines = rows.filter((x) => !types.some((t) => String(t.id) === String(x.Type)));
        if (orphelines.length) groupes.push({ type: { Nom: "Sans format" }, trames: orphelines });
        return groupes.map((g) => `
    <div class="app-trames__groupe">
      <div class="app-section-title app-trames__groupe-tete">
        <h2 class="fr-h6 fr-mb-0">${icon("stack-line", 'class="fr-mr-1v"')}${esc(str(g.type.Nom))}</h2>
        <span class="app-trames__groupe-compte">${g.trames.length} trame${g.trames.length > 1 ? "s" : ""}</span>
      </div>
      <div class="app-list app-list--grille">${g.trames.map((t) => trameItem(store, ctx, t, { selection })).join("")}</div>
    </div>`).join("");
      })()
    : emptyState(filtre ? "Aucune trame ne correspond à ce filtre." : "Aucune trame n'a encore été créée.", {
        iconName: "file-text-line",
        action: ajouter,
      });

  const dictionnaire = panel("Dictionnaire des variables", `<div class="app-prose app-dictionary">${DICTIONNAIRE_HTML}</div>`, {
    iconName: "book-2-line",
    subtitle: "Toutes les valeurs disponibles dans le corps d'une trame (balises entre doubles accolades) — replié : la palette de l'éditeur les rappelle au moment où l'on écrit",
    collapsible: true,
    id: "tramesDico",
  });

  // La page est longue — quarante-quatre trames groupées par format, une
  // corbeille et un dictionnaire de balises — : la barre d'ancres donne le
  // sommaire qui manquait, et laisse sauter au dictionnaire sans dérouler
  // tout le registre.
  const ancres = ui.anchors({
    label: "Sommaire des trames",
    items: [
      { label: "Registre", hash: "tramesListe" },
      { label: "Corbeille", hash: "tramesCorbeille" },
      { label: "Dictionnaire", hash: "tramesDico" },
    ],
  });

  return `
${reglagesHead(store, state, "Trames", "Modèles de courriers, d'attestations et de décisions. Une trame est le corps d'un document — un texte, un auteur et un destinataire — et elle hérite de la feuille de style de son format, qu'elle peut adapter.",
    `${ajouter} ${exportTableButtons({ table: "Trames", rows, titre: "Télécharger la liste des trames affichées" })}`)}
${defaut}
${ancres}
${panel("Trames", `
    ${filtres}
    ${barreLotTrames(store, state, rows)}
    <div class="app-trames__liste" data-scroll="trameList">${liste}</div>
  `, {
    iconName: "file-text-line",
    subtitle: `${rows.length} trame(s) — chaque ligne ouvre l'espace de rédaction de la trame`,
    id: "tramesListe",
  })}
${corbeillePanel(store)}
${dictionnaire}`;
}

/**
 * La sous-vue d'une trame : son texte, et la feuille de style dont il hérite.
 *
 * Une trame n'est pas un document complet : elle en est le **corps**. Le reste —
 * l'en-tête, le chapeau, la signature, le pied de page — vient de la **feuille
 * de style** de son format, que la trame hérite sans rien insérer. La page
 * montre les deux à la suite, dans l'ordre du document : la feuille de style,
 * avec l'emplacement où le texte se place, puis le texte lui-même.
 *
 * Une pièce a parfois besoin d'une autre entête ou d'une autre signature : la
 * feuille se modifie alors ici même, et **l'adaptation est propre à cette
 * trame** (colonne `Feuille_de_style`, voir `feuilleEffective` dans render.js).
 * Le bouton « Rétablir la feuille du format » la lui rend. Les variables se
 * tiennent à droite du texte, dans un panneau qui se replie pour le lui rendre.
 */
export function viewTrame(store, state, trame) {
  const ctx = state.ctx;
  // La trame ouverte est la sélection courante, comme la sous-vue d'un
  // document fait du document la sienne.
  state.sel.Trames = trame.id;

  const exemple = exempleDocument(store, trame);
  const catalog = trameCatalog(store.db, exemple);
  const nom = str(ctx.v("Trames", trame, "Nom_complet"));
  const nbDocuments = store.table("Generateur").filter((d) => Number(d.Template) === Number(trame.id)).length;
  const variablesOuvertes = state.tabs.trameVariables !== "replie";

  const fil = `
<div class="app-breadcrumb">
  <a href="#reglages/trames" data-nav="reglages/trames">${icon("arrow-left-line", 'class="fr-mr-1v"')}Toutes les trames</a>
</div>`;

  const head = `
${fil}
<div class="app-page-head">
  <div>
    <p class="app-kicker">Trame</p>
    <h1 class="fr-h3">${esc(nom)}</h1>
    <p class="app-page-head__sub">${esc(str(trame.Objet) || "Sans objet : précisez, ci-dessous, ce que la trame produit.")}</p>
  </div>
  <div class="app-page-head__actions">
    ${nbDocuments ? button(nbDocuments > 1 ? `Voir les ${nbDocuments} documents produits` : "Voir le document produit", {
      variant: "tertiary", size: "sm", iconName: "printer-line",
      action: "trame-documents", attrs: `data-record="${trame.id}"`,
      title: "Ouvrir le registre des documents, filtré sur cette trame",
    }) : ""}
  </div>
</div>
${subnav("trames")}`;

  // La feuille de style de la trame vient de son format (`Types_Trames`) : c'est
  // elle qui décide si le document est adressé (courrier, attestation) ou non
  // (décision), et si les mentions de décision ont un sens.
  const typeTrame = ctx.ref("Trames", trame, "Type");
  const format = str(typeTrame?.Categorie) || str(ctx.v("Trames", trame, "Type_court_"));
  const estRendu = FORMATS_RENDUS.includes(format);
  const estOrdonnance = format === FORMAT_ORDONNANCE;
  const estAdresse = !estRendu;
  // Une ordonnance d'un président — celui de la section ou celui de la formation
  // de jugement, c'est-à-dire de la commission de discipline devant les usagers
  // — est nécessairement avant dire droit ; seule une décision de la **formation
  // de jugement** peut trancher le fond.
  const estFormation = str(typeTrame?.Organe) === ORGANE_FORMATION;

  // Les réglages de la trame — son identification, la procédure à laquelle
  // elle s'adresse, son auteur et son destinataire, son rôle dans la décision
  // — précèdent son texte parce qu'ils le déterminent : une trame générique ou
  // réservée, adressée ou non, définitive ou avant dire droit, ne produisent
  // pas le même document.
  const reglages = panel("Réglages de la trame", `
    <div class="fr-grid-row fr-grid-row--gutters">
      <div class="fr-col-12 fr-col-md-6">${field("Trames", "Nom", ctx, trame, { store })}</div>
      <div class="fr-col-12 fr-col-md-6">${field("Trames", "Type", ctx, trame, { store })}</div>
      <div class="fr-col-12">${field("Trames", "Objet", ctx, trame, { store })}</div>
      <div class="fr-col-12 fr-col-md-6">${field("Trames", "Type_court_", ctx, trame, { store })}</div>
    </div>
    ${fieldset("Auteur et destinataire", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 ${estAdresse ? "fr-col-md-6" : ""}">${field("Trames", "Auteur", ctx, trame, { store })}</div>
        ${estAdresse ? `<div class="fr-col-12 fr-col-md-6">${field("Trames", "Destinataire", ctx, trame, { store })}</div>` : ""}
      </div>
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        ${estOrdonnance
          ? "Une ordonnance est rendue, non adressée : elle n'a pas de destinataire, et son auteur est l'organe qui ordonne."
          : (estRendu
            ? "Une décision est rendue, non adressée : elle n'a pas de destinataire, et son auteur est l'organe qui décide."
            : "L'auteur rédige et signe le document ; le destinataire est la personne ou l'institution à qui il est adressé.")}
        Programmés ici, ils ne sont plus demandés à la rédaction : la feuille de style du format les nomme.${estRendu ? "" : " Le président de la section est remplacé par son vice-président lorsqu'il est empêché."}
      </p>
    `, { hint: "Qui rédige, et à qui le document s'adresse." })}
    ${fieldset("Procédure visée", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-4">${field("Trames", "Public", ctx, trame, { store })}</div>
        <div class="fr-col-12 fr-col-md-4">${field("Trames", "Tutelle", ctx, trame, { store })}</div>
        <div class="fr-col-12 fr-col-md-4">${field("Trames", "Type_de_section", ctx, trame, { store })}</div>
      </div>
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        La trame n'est proposée qu'aux affaires de cette procédure. « Les deux » et « ${esc(TOUTES)} »
        valent pour toutes : c'est le cas d'une trame générique. Une trame d'établissement agricole
        (code rural et de la pêche maritime) se réserve à la tutelle « Agriculture » ; une trame de
        section disciplinaire académique se réserve à ce type de section.
      </p>
    `, { hint: "Détermine les affaires auxquelles la trame est proposée." })}
    ${estRendu && estFormation ? fieldset("Portée de la décision", `
      ${field("Trames", "Decision_definitive", ctx, trame, { store })}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        À cocher pour la trame qui porte le jugement : celle qui tranche le fond, à l'exclusion des
        décisions avant dire droit (report, supplément d'instruction), dont le nombre n'est pas limité.
        Les champs de décision y sont ceux de l'affaire — ils se saisissent une fois, et alimentent à
        la fois le document et l'onglet « Décision ». Une affaire ne peut comporter qu'une décision
        définitive ; chaque décision avant dire droit rédigée se désigne sur le document.
      </p>
    `, { hint: "Le jugement tranche le fond : il est unique dans une affaire." }) : ""}
    ${estRendu && !estFormation ? `<p class="fr-hint-text fr-mt-1w fr-mb-0">
      ${estOrdonnance ? "L'ordonnance du président" : "La décision du président"} — celui de la <strong>section disciplinaire</strong>, ou celui de la
      <strong>formation de jugement</strong> (la commission de discipline, devant les usagers) — règle
      la marche de l'instance : elle est <strong>nécessairement avant dire droit</strong>, et n'est donc
      jamais la décision définitive de l'affaire. Une affaire en comporte autant que nécessaire.
    </p>` : ""}
    ${fieldset("Instruction", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-6">${field("Trames", "Concerne_l_instruction", ctx, trame, { store })}</div>
        <div class="fr-col-12 fr-col-md-6">${field("Trames", "Ouvre_l_instruction", ctx, trame, { store })}</div>
      </div>
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        « Concerne l'instruction » met la date butoir du document en avant à sa rédaction : c'est par
        elle qu'un rapport, un complément ou un supplément d'instruction fixe, ou prolonge, le terme de
        l'instruction de l'affaire. « Ouvre l'instruction » désigne en plus l'<strong>acte de
        désignation</strong> lui-même — des rapporteurs, ou de la commission d'instruction : la date de
        ce document est le point de départ du délai d'instruction, qui ne court pas depuis la saisine.
      </p>
    `, { hint: "Ce que le document fait au délai d'instruction de l'affaire." })}
  `, {
    iconName: "file-text-line",
    subtitle: "Identification, procédure et portée du document",
    actions: `<button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-action="trame-corbeille" data-record="${trame.id}">${icon("delete-bin-line", 'class="fr-mr-1v"')}Mettre à la corbeille</button>`,
  });

  // La feuille de style : celle de son format, dont la trame hérite, ou celle
  // qu'elle s'est adaptée. La trame s'écrit **d'un seul tenant** — la feuille
  // puis son texte —, comme un document (voir `assemblageDocument`,
  // views/documents.js) : à l'écran, rien ne sépare les deux, et c'est la
  // seconde que l'éditeur écrit, et seulement si l'auteur y touche (voir
  // `data-wysiwyg-base`, et `enregistrerAssemblage`, app.js).
  const feuillePropre = String(trame.Feuille_de_style ?? "").trim();
  const adaptee = !!feuillePropre;
  const feuilleFormat = String(typeTrame?.Feuille_de_style ?? "");
  const feuille = adaptee ? feuillePropre : feuilleFormat;
  const emplacement = feuille.includes(BALISE_CORPS);
  const [avantFeuille, apresFeuille] = decouperFeuille(feuille);
  // La référence de la feuille : celle du **format** — revenir mot pour mot à
  // elle efface l'adaptation de la trame, qui se remet à en hériter.
  const [avantHerite, apresHerite] = decouperFeuille(feuilleFormat);
  const baseFeuille = `${htmlCanonique(avantHerite)}${BALISE_CORPS}${htmlCanonique(apresHerite)}`;
  const catalogueFeuille = feuilleCatalog(store.db, exemple);

  // La palette réunit les deux familles de balises : les variables `{…}` de la
  // feuille de style — celles du chapeau et de la signature —, puis les balises
  // de données `{{…}}` du texte. Chacune n'a de sens que dans la zone qui lui
  // correspond, et les libellés le disent.
  const catalogue = {
    groups: [
      ...catalogueFeuille.groups.map((g) => (g.id === "corps" ? g : { ...g, label: `Feuille de style — ${g.label}` })),
      // Une ordonnance ne rédige aucune décision : sa palette ne propose pas
      // les balises `{{Decision}}…` (voir `GROUPE_DECISION`).
      ...catalog.groups.filter((g) => !(estOrdonnance && g.id === GROUPE_DECISION)),
    ],
    index: { ...catalogueFeuille.index, ...catalog.index },
  };
  const chipFor = (token) => {
    const info = catalogue.index[token];
    return chipHtml(token, info?.label || labelOfToken(token), info?.sample || "");
  };
  // Les deux marques invisibles disent à l'enregistrement où commence et où
  // finit le texte de la trame (voir `decouperAssemblage`, app.js).
  const marque = (part) => `<span class="app-feuille__marque" data-marque="${part}" aria-hidden="true"></span>`;
  const interieur = htmlToEditor(avantFeuille, chipFor, styleRegex())
    + marque("corps-debut")
    + htmlToEditor(String(trame.Template_contenu ?? ""), chipFor)
    + marque("corps-fin")
    + htmlToEditor(apresFeuille, chipFor, styleRegex());

  const variables = outils({
    titre: "Variables",
    iconName: "braces-line",
    ouvert: variablesOuvertes,
    action: "trame-variables",
    classe: "app-outils--variables",
    body: paletteHtml(catalogue, {
      id: "tramePalette",
      label: "Insérer une variable",
      hint: "Glissez une variable dans le texte — celle de la zone où vous écrivez —, ou cliquez pour l'insérer au curseur.",
    }),
  });

  // L'espace d'écriture : une barre d'outils, la feuille **d'un seul tenant**
  // — ce que le format apporte autour du texte, et le texte lui-même, au
  // milieu —, et, dans la vue « Résultat », le document produit sur une affaire
  // d'exemple. Les trois vues montrent la même pièce.
  const vues = [
    { id: "redaction", label: "Rédaction", iconName: "edit-line" },
    { id: "balisage", label: "Balisage", iconName: "code-s-slash-line" },
    { id: "resultat", label: "Résultat", iconName: "file-text-line" },
  ];
  const vue = vues.some((v) => v.id === state.tabs.trameVue) ? state.tabs.trameVue : vues[0].id;
  const formatNom = esc(str(typeTrame?.Nom) || "sans format");
  const hints = {
    redaction: "La trame s'écrit d'un seul tenant : la feuille de style de son format — en-tête, chapeau, signature,"
      + " pied de page —, et le texte de la trame, à l'emplacement que la pastille « " + LIBELLE_CORPS + " » marque."
      + " Corriger la feuille ici n'écrit que pour cette trame, jamais pour son format ni ses autres trames"
      + " (« Rétablir la feuille du format » défait l'adaptation). Les pastilles sont les balises, remplacées à la"
      + " génération par les valeurs de l'affaire. La barre d'outils met en forme le passage sélectionné et insère"
      + " tableaux, images, traits de séparation et sauts de page. Replier les variables rend toute sa largeur au texte.",
    balisage: "Le HTML de la pièce, tel qu'il sera enregistré — la palette y insère la balise au curseur."
      + " Replier les variables rend toute sa largeur au texte.",
    resultat: "Le document produit sur une affaire d'exemple : la feuille de style et le texte réunis, leurs balises"
      + " remplacées par les données du dossier. C'est ici qu'on relit la trame ; elle se rédige dans la vue"
      + " « Rédaction ».",
  };

  const atelier = `
<div class="app-wysiwyg app-doc app-doc--${vue}" data-wysiwyg data-chips="feuille" data-wysiwyg-view="${vue}">
  <section class="fr-panel app-doc__atelier">
    <div class="fr-panel__header">
      <div class="fr-panel__heading">
        <h2 class="fr-h6 fr-mb-0">${icon("edit-line", 'class="fr-mr-1v"')}Espace de rédaction</h2>
        <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">Écrite à partir du format « ${formatNom} », d'un seul tenant — feuille de style et texte</p>
      </div>
      <div class="fr-panel__actions">
        <span class="app-feuille__etat${adaptee ? " app-feuille__etat--adaptee" : ""}" id="trameFeuilleEtat"
          data-heritee="héritée du format « ${formatNom} »"
          data-adaptee="adaptée à cette trame">${adaptee ? "adaptée à cette trame" : `héritée du format « ${formatNom} »`}</span>
        ${button("Rétablir la feuille du format", {
          variant: "tertiary-no-outline", size: "sm", iconName: "arrow-go-back-line", id: "trameFeuilleRetablirBtn",
          action: "trame-feuille-retablir", attrs: `data-record="${trame.id}"`, hidden: !adaptee,
          title: "Effacer l'adaptation : la trame reprendra la feuille de style de son format",
        })}
      </div>
    </div>
    <div class="fr-panel__body">
      ${ui.tabs({ id: "trameVue", items: vues, active: vue, label: "Vue de l'espace de rédaction" })}
      ${ui.tabPanel({ id: "trameVue", tab: vue, contenu: `
      ${toolbarHtml({ source: false })}
      <div class="app-wysiwyg__docs">
        <div class="app-wysiwyg__doc app-doc__assemblage app-doc__assemblage--entete">
          <div class="app-feuille__entete" aria-hidden="true">${enteteExemple(store, exemple, typeTrame)}</div>
          <div class="app-wysiwyg__edit app-feuille__corps" id="trameEditor" contenteditable="true" role="textbox"
            aria-multiline="true" aria-label="Feuille et texte de la trame ${esc(nom)}" spellcheck="true"
            data-wysiwyg-editor data-chips="feuille" data-table="Trames" data-record="${trame.id}"
            data-field="assemblage" data-wysiwyg-base="${esc(baseFeuille)}">${interieur}</div>
          <p class="fr-hint-text fr-mt-1w fr-mb-0">
            La pastille « ${esc(LIBELLE_CORPS)} » marque l'endroit où le texte de la trame se place : ce qui la
            précède est l'en-tête et le chapeau du format, ce qui la suit sa signature et son pied de page répété.
            <span data-feuille-heritee${adaptee ? " hidden" : ""}>La feuille de style est celle du format ; la modifier en crée une <strong>adaptation propre à cette trame</strong>, sans toucher aux autres.</span>
            <span data-feuille-adaptee${adaptee ? "" : " hidden"}>La feuille de style de cette trame est la sienne : la modifier ne touche pas les autres trames de son format.</span>
            L'en-tête — bloc-marque et logo — est celui de la section, et sa mise en page est réglée sur la
            <strong>fiche du format</strong> (position et taille des deux logos), pour toutes ses trames.
            ${emplacement ? "" : `<strong>Attention : l'emplacement « ${esc(LIBELLE_CORPS)} » a disparu</strong> — le texte se placerait à la fin du document.`}
          </p>
        </div>
      </div>
      <div class="app-doc__rendu">
        <div class="app-doc__rendu-tete">
          <p class="fr-text--sm fr-mb-0">${icon("printer-line", 'class="fr-mr-1v"')}Aperçu avant impression</p>
          <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-tab="trameVue:redaction">
            ${icon("edit-line", 'class="fr-mr-1v"')}Modifier le texte
          </button>
        </div>
        <div class="app-doc-preview">
          <iframe id="tramePreview" title="Aperçu de la trame" srcdoc="${esc(previewTrame(store, trame))}"></iframe>
        </div>
        <p class="fr-hint-text fr-mt-1w fr-mb-0">
          L'aperçu est le document produit sur une affaire d'exemple : la feuille de style et le texte réunis,
          leurs balises remplacées par les données du dossier.
        </p>
      </div>
      <p class="fr-hint-text fr-mt-1w fr-mb-0">${esc(hints[vue])}</p>` })}
    </div>
  </section>
  <aside class="app-doc__outils${variablesOuvertes ? "" : " app-doc__outils--replie"}">
    ${variables}
  </aside>
</div>`;

  return `${head}
<div class="fr-mt-2w">${reglages}</div>
<div class="fr-mt-2w">${atelier}</div>`;
}

/* ------------------------------------------------------------------ */
/* Formats : la feuille de style                                       */
/* ------------------------------------------------------------------ */

/** Corps d'exemple du document, quand un format n'a encore aucune trame. */
const CORPS_EXEMPLE = "<p>Corps du document : rédigez ici le texte de la trame.</p>";

/**
 * Trame servant à illustrer un format : la première trame qui l'utilise, sinon
 * une trame fictive, dont le corps dit seulement où le texte se place.
 *
 * La trame fictive porte, comme une trame réelle, son **auteur** et son
 * **destinataire** — déduits de l'organe qui décide, pour une décision : sans
 * eux, l'aperçu d'un format encore inemployé montrerait une pièce sans
 * destinataire ni signature.
 */
/**
 * L'auteur qui signe un acte rendu, d'après son **organe** : le président de la
 * section disciplinaire, celui de la formation de jugement — devant les usagers,
 * le président de la commission de discipline —, ou la formation de jugement
 * elle-même, dont la décision porte la signature de son président. C'est
 * l'organe du format qui décide, mais l'auteur reste réglable sur chaque trame.
 */
function auteurDeLOrgane(organe) {
  if (organe === ORGANE_PRESIDENT_SECTION) return AUTEUR_PRESIDENT_SECTION;
  if (organe === ORGANE_PRESIDENT_FORMATION) return AUTEUR_PRESIDENT_COMMISSION;
  return AUTEUR_FORMATION;
}

function tramePourType(store, type) {
  const existante = store.table("Trames").find((t) => Number(t.Type) === Number(type.id));
  if (existante) return existante;
  const rendu = FORMATS_RENDUS.includes(str(type.Categorie));
  return {
    id: -1, Type: type.id, Public: "", Nom_complet: `Aperçu — ${str(type.Nom)}`,
    Template_contenu: CORPS_EXEMPLE,
    Auteur: rendu ? auteurDeLOrgane(str(type.Organe)) : AUTEUR_PRESIDENT_SECTION,
    Destinataire: rendu ? "" : DEST_MIS_EN_CAUSE,
  };
}

/**
 * La trame d'exemple d'un format : une trame de ce format, **mais sa feuille de
 * style à lui**. Une trame peut avoir adapté la sienne — c'est même la raison
 * d'être de cette adaptation —, et c'est bien le format que l'on regarde ici.
 */
function trameExempleDuFormat(store, type) {
  return { ...tramePourType(store, type), Feuille_de_style: "" };
}

/**
 * L'en-tête du document, tel que l'outil le pose sur toute pièce : le
 * bloc-marque de l'État et le logo de l'établissement. Il est montré — sans être
 * éditable — au-dessus de la feuille de style, pour que l'auteur voie la pièce
 * entière et non le seul texte qu'il rédige.
 *
 * `format` est la feuille de style dont l'en-tête suit les réglages de mise en
 * page (position et taille des logos) : c'est celle de la fiche ouverte, pour
 * que l'aperçu montre ce que le réglage produit.
 */
function enteteExemple(store, exemple, format = null) {
  if (!exemple) return "";
  const { scope } = documentScope(store.db, exemple);
  return enteteHtml(store.db, scope.Affaire_Section, format);
}

/**
 * Une zone de rédaction de feuille de style, précédée de l'en-tête du document.
 *
 * `base` est la feuille de style à laquelle se comparer : celle du format, quand
 * l'éditeur est celui d'une trame. Tant que le texte de l'éditeur lui est
 * identique, la trame n'a rien écrit — la comparaison vit dans `saveEditorContent`
 * (voir app.js), qui n'enregistre alors rien : la trame **hérite**.
 */
function feuilleEditor({ id, entete, feuille, chipFor, table, record, base, label }) {
  const heritage = base === undefined ? "" : ` data-wysiwyg-base="${esc(base)}"`;
  return `
<div class="app-feuille${entete ? " app-feuille--entete" : ""}">
  ${entete ? `<div class="app-feuille__entete" aria-hidden="true">${entete}</div>` : ""}
  <div class="app-wysiwyg__edit app-feuille__corps" id="${esc(id)}" contenteditable="true" role="textbox"
    aria-multiline="true" aria-label="${esc(label)}" spellcheck="true" data-wysiwyg-editor data-chips="feuille"
    data-table="${esc(table)}" data-record="${esc(String(record))}" data-field="Feuille_de_style"${heritage}>${htmlToEditor(feuille, chipFor, styleRegex())}</div>
</div>`;
}

/**
 * Aperçu du document produit par un format, calculé sur l'affaire d'exemple.
 * La feuille de style introduite est celle du format : les modifications en
 * cours s'y reflètent immédiatement.
 */
export function previewType(store, type) {
  try {
    const trame = trameExempleDuFormat(store, type);
    const doc = exempleDocument(store, trame);
    if (!doc) return "<p>Aperçu indisponible : aucune affaire d'exemple.</p>";
    return computeDocumentParts(store.db, doc, { template: trame }).html;
  } catch (err) {
    return `<p>Aperçu indisponible : ${esc(err.message)}</p>`;
  }
}

/**
 * Texte brut d'un bloc HTML, pour l'aperçu des listes : les balises sont
 * retirées, les accolades des variables aussi, et les entités (`&Eacute;`…)
 * sont décodées — un aperçu qui afficherait « COMP&Eacute;TENTE » au lieu de
 * « COMPÉTENTE » ne serait pas un aperçu.
 */
function apercuTexte(html) {
  const brut = str(html).replace(/<[^>]*>/g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  if (typeof document === "undefined" || !brut.includes("&")) return brut;
  const champ = document.createElement("textarea");
  champ.innerHTML = brut;
  return champ.value.replace(/\s+/g, " ").trim();
}

/**
 * Une ligne du registre des formats : un lien vers l'espace de rédaction de sa
 * feuille de style (`#reglages/types/3`), avec le nombre de trames qui en
 * héritent.
 */
function typeItem(store, ctx, t, nbTrames) {
  const ordonnance = str(t.Categorie) === FORMAT_ORDONNANCE;
  const decision = str(t.Categorie) === FORMAT_DECISION;
  const rendu = FORMATS_RENDUS.includes(str(t.Categorie));
  const meta = [
    str(t.Categorie) ? `<span>${esc(str(t.Categorie))}</span>` : "",
    rendu && t.Organe ? `<span>${esc(str(t.Organe))}</span>` : "",
    t.Numeroter_pages ? "<span>Pagination</span>" : "",
    t.Numero_affaire_pied ? "<span>N° d'affaire au pied</span>" : "",
    `<span>${nbTrames} trame(s)</span>`,
  ].filter(Boolean).join("");
  // Ce que le format fait du document : un acte rendu est rendu par un organe,
  // un rapport d'instruction est établi pour la section, un courrier ou une
  // attestation sont adressés. C'est ce qui le distingue d'un autre, et non le
  // texte de sa signature — commun à toutes ses trames, et fait de variables.
  const parOrgane = (ou) => str(t.Organe) === ou;
  const quoi = ordonnance
    ? (parOrgane(ORGANE_PRESIDENT_SECTION)
        ? "Ordonnance du président de la section disciplinaire — nécessairement avant dire droit."
        : (parOrgane(ORGANE_PRESIDENT_FORMATION)
            ? "Ordonnance du président de la formation de jugement — nécessairement avant dire droit."
            : "Ordonnance rendue par un président — nécessairement avant dire droit."))
    : (decision
      ? (parOrgane(ORGANE_FORMATION)
          ? "Rendue en formation de jugement — avant dire droit ou définitive ; signée par le président de la formation et le secrétaire."
          : "Décision rendue en formation de jugement.")
      : (str(t.Categorie) === FORMAT_ATTESTATION
        ? "Attestation délivrée et adressée à un destinataire."
        : (str(t.Categorie) === FORMAT_RAPPORT
            ? "Pièce d'instruction établie pour la section — le rapport du rapporteur, ou de la commission d'instruction."
            : "Courrier adressé à un destinataire.")));
  return `<a class="app-list__item" href="#reglages/types/${t.id}" data-nav="reglages/types/${t.id}">
    <span class="app-list__top">
      <span class="app-list__ref">${esc(str(t.Nom) || `#${t.id}`)}</span>
      ${icon("arrow-right-line", 'class="app-list__go" aria-hidden="true"')}
    </span>
    <span class="app-list__name">${esc(quoi)}</span>
    <span class="app-list__meta">${meta}</span>
  </a>`;
}

/**
 * Le registre des formats : le rangement, et rien d'autre.
 *
 * Une ligne par format, chacune menant à l'espace de rédaction de sa feuille de
 * style. Comme pour les trames, la liste n'embarque pas l'éditeur.
 */
function viewTypes(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  const compte = (id) => store.table("Trames").filter((t) => Number(t.Type) === Number(id)).length;
  let rows = sortRecords(store.table("Types_Trames"), (t) => str(t.Nom), "asc");
  if (f.typesQ) {
    rows = rows.filter((t) => matches(f.typesQ, t.Nom, t.Categorie, t.Organe, apercuTexte(t.Feuille_de_style)));
  }
  const ajouter = button("Ajouter un format", { variant: "primary", iconName: "add-line", action: "add-type-trame" });

  const filtres = `
    <div class="app-filters">
      <div class="app-search">
        <label class="fr-label" for="typesQ">Rechercher</label>
        <input class="fr-input" type="search" id="typesQ" data-filter="typesQ"
          value="${esc(f.typesQ || "")}" placeholder="Format, chapeau, signature…">
      </div>
    </div>`;

  const liste = rows.length
    ? rows.map((t) => typeItem(store, ctx, t, compte(t.id))).join("")
    : emptyState(f.typesQ ? "Aucun format ne correspond à cette recherche." : "Aucun format n'a encore été créé.", {
        iconName: "stack-line",
        action: ajouter,
      });

  return `
${reglagesHead(store, state, "Formats et feuilles de style", "Un format est la feuille de style d'un document — courrier, attestation, rapport d'instruction, ordonnance ou décision : son en-tête, son chapeau, sa signature et son pied de page, écrits d'un seul tenant. Chaque trame en hérite, et peut l'adapter.",
    `${ajouter} ${exportTableButtons({ table: "Types_Trames", rows, titre: "Télécharger la liste des formats" })}`)}
${panel("Formats", `
    ${filtres}
    <div class="app-list app-list--grille" data-scroll="typeList">${liste}</div>
  `, {
    iconName: "stack-line",
    subtitle: `${rows.length} format(s) — chaque ligne ouvre la rédaction de sa feuille de style`,
  })}`;
}

/**
 * L'espace de rédaction d'un format : sa feuille de style, et elle seule.
 *
 * Le format portait trois blocs — chapeau, signature, pied de page — que chaque
 * trame devait insérer dans son texte. Il porte désormais **un document**, écrit
 * d'un bout à l'autre, où l'emplacement du texte des trames est marqué par une
 * pastille : l'auteur voit la pièce telle qu'elle se lira, en-tête et signature
 * comprises, et non trois morceaux séparés.
 */
export function viewTypeTrame(store, state, type) {
  const ctx = state.ctx;
  // Le format ouvert est la sélection courante, comme la trame ouverte l'est
  // pour les trames.
  state.sel.Types_Trames = type.id;

  const exemple = exempleDocument(store, trameExempleDuFormat(store, type));
  const catalog = feuilleCatalog(store.db, exemple);
  const chipFor = (token) => {
    const info = catalog.index[token];
    return chipHtml(token, info?.label || labelOfToken(token), info?.sample || "");
  };
  const feuille = String(type.Feuille_de_style ?? "");
  const emplacement = feuille.includes(BALISE_CORPS);
  const nbTrames = store.table("Trames").filter((t) => Number(t.Type) === Number(type.id)).length;
  const variablesOuvertes = state.tabs.trameVariables !== "replie";

  const fil = `
<div class="app-breadcrumb">
  <a href="#reglages/types" data-nav="reglages/types">${icon("arrow-left-line", 'class="fr-mr-1v"')}Tous les formats</a>
</div>`;

  const head = `
${fil}
<div class="app-page-head">
  <div>
    <p class="app-kicker">Format</p>
    <h1 class="fr-h3">${esc(str(type.Nom) || `#${type.id}`)}</h1>
    <p class="app-page-head__sub">La feuille de style du format — en-tête, chapeau, signature et pied de page d'un seul tenant${nbTrames ? ` ; ${nbTrames} trame(s) en héritent` : ""}.</p>
  </div>
  <div class="app-page-head__actions">
    ${nbTrames ? button(nbTrames > 1 ? `Voir les ${nbTrames} trames de ce format` : "Voir la trame de ce format", {
      variant: "tertiary", size: "sm", iconName: "file-text-line",
      action: "type-trames", attrs: `data-record="${type.id}"`,
      title: "Ouvrir le registre des trames, filtré sur ce format",
    }) : ""}
  </div>
</div>
${subnav("types")}`;

  // Le format porte le **format** du document — sa feuille de style — et, pour
  // un acte rendu, l'**organe** qui décide. C'est le format qui distingue un
  // courrier (adressé) d'une ordonnance ou d'une décision (rendue).
  const estRendu = FORMATS_RENDUS.includes(str(type.Categorie));

  const identification = panel("Identification", `
    ${fieldset("Format du document", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-6">${field("Types_Trames", "Nom", ctx, type, { store })}</div>
        <div class="fr-col-12 fr-col-md-6">${field("Types_Trames", "Categorie", ctx, type, { store })}</div>
      </div>
      ${estRendu ? `<div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-6">${field("Types_Trames", "Organe", ctx, type, { store })}</div>
      </div>` : ""}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        Le format est la feuille de style du document : un <strong>courrier</strong>, une
        <strong>attestation</strong>, un <strong>rapport d'instruction</strong>, une <strong>ordonnance</strong> de
        président, ou une <strong>décision</strong> de la formation de jugement. Un courrier
        et une attestation sont adressés à un destinataire, un rapport d'instruction est une pièce du dossier,
        et une ordonnance comme une décision sont rendues.
        ${estRendu ? "L'organe qui décide ne concerne que les actes rendus : « Président de la section disciplinaire » ou « Président de la formation de jugement » pour une ordonnance, nécessairement avant dire droit ; « Formation de jugement » pour une décision, qui peut trancher le fond." : ""}
      </p>
    `, { hint: "Format, feuille de style et organe qui décide." })}
    ${fieldset("Pagination et pied de page", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-6">${field("Types_Trames", "Numeroter_pages", ctx, type, { store })}</div>
        <div class="fr-col-12 fr-col-md-6">${field("Types_Trames", "Numero_affaire_pied", ctx, type, { store })}</div>
      </div>
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        Le pied de page de la feuille de style est répété au bas de <strong>chaque</strong> page.
        La numérotation s'y place à droite, le numéro de l'affaire à gauche — sur la même ligne, pour un
        document qui se détache de son dossier.
      </p>
    `, {
      hint: "Les documents de ce format sont paginés : le pied de page est répété au bas de chaque page. "
        + "« Numéroter les pages » y ajoute « Page 3 sur 3 » ; « Numéro de l'affaire au pied de page » y "
        + "ajoute « Dossier n° … ». Les deux se placent aussi à la main, dans le pied de page de la feuille "
        + "de style, avec les variables {page}, {pages} et {numero} (palette des variables).",
    })}
  `, {
    iconName: "stack-line",
    subtitle: "Le nom sous lequel les trames rattachent leur feuille de style",
    actions: `<button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-delete="Types_Trames:${type.id}">${icon("delete-bin-line", 'class="fr-mr-1v"')}Supprimer</button>`,
  });

  // L'en-tête — le bloc-marque de l'État et le logo de l'établissement — est
  // posé au-dessus de la feuille de style par l'outil : les images viennent de
  // la section, leur **mise en page** se règle ici, par feuille de style. Un
  // réglage vide reproduit la charte, et l'aperçu de la feuille montre le
  // résultat — l'en-tête y figure en tête du document.
  const entetePanel = panel("En-tête : les deux logos", `
    ${fieldset("Bloc-marque de l'État", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-4">${field("Types_Trames", "Marianne_position", ctx, type, { store })}</div>
        <div class="fr-col-12 fr-col-md-4">${field("Types_Trames", "Marianne_largeur", ctx, type, { store, step: "any" })}</div>
        <div class="fr-col-12 fr-col-md-4">${field("Types_Trames", "Marianne_hauteur", ctx, type, { store, step: "any" })}</div>
      </div>
    `, { hint: "L'image elle-même se règle sur la fiche de la section (Réglages › Sections et membres › En-tête des courriers)." })}
    ${fieldset("Logo de l'établissement", `
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-4">${field("Types_Trames", "Logo_position", ctx, type, { store })}</div>
        <div class="fr-col-12 fr-col-md-4">${field("Types_Trames", "Logo_largeur", ctx, type, { store, step: "any" })}</div>
        <div class="fr-col-12 fr-col-md-4">${field("Types_Trames", "Logo_hauteur", ctx, type, { store, step: "any" })}</div>
      </div>
    `, { hint: "Un logo plus haut que la zone de logotype de la charte déborde du haut de l'en-tête : vérifiez l'aperçu." })}
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      La <strong>position</strong> désigne la zone de l'en-tête — à gauche, au centre, à droite ; deux
      logos dans la même zone s'y placent côte à côte. La <strong>taille</strong> s'écrit en millimètres :
      une seule cote renseignée met l'image à l'échelle en conservant ses proportions ; les deux fixent
      exactement le cadre. Laissez les champs vides pour les cotes de la charte. Le réglage vaut pour
      <strong>tout le format</strong> — ses trames et leurs documents.
    </p>
  `, {
    iconName: "image-line",
    subtitle: "La position et la taille du bloc-marque et du logo, sur toutes les pièces de ce format",
  });

  const variables = outils({
    titre: "Variables",
    iconName: "braces-line",
    ouvert: variablesOuvertes,
    action: "trame-variables",
    classe: "app-outils--variables",
    body: paletteHtml(catalog, { id: "typePalette" }),
  });

  const atelier = `
<div class="app-wysiwyg app-doc" data-wysiwyg data-chips="feuille">
  <section class="fr-panel app-doc__atelier">
    <div class="fr-panel__header">
      <div class="fr-panel__heading">
        <h2 class="fr-h6 fr-mb-0">${icon("stack-line", 'class="fr-mr-1v"')}Feuille de style</h2>
        <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">Le document du format, d'un bout à l'autre — en-tête, chapeau, emplacement du texte des trames, signature et pied de page</p>
      </div>
    </div>
    <div class="fr-panel__body">
      ${toolbarHtml()}
      ${feuilleEditor({
        id: "typeStyleEditor",
        entete: enteteExemple(store, exemple, type),
        feuille, chipFor, table: "Types_Trames", record: type.id,
        label: `Feuille de style du format ${str(type.Nom)}`,
      })}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        La feuille de style se rédige comme un document : l'en-tête du service est posé au-dessus par l'outil
        (Réglages › Identité), et tout ce qui suit est à vous. La pastille « ${esc(LIBELLE_CORPS)} » marque
        l'endroit où le texte de chaque trame vient s'insérer : ce qui la précède est le chapeau du format, ce qui
        la suit sa signature et son pied de page répété. Les variables <code>{…}</code> y sont remplacées par les
        données de l'affaire${nbTrames ? `, et les modifications s'appliquent aux ${nbTrames} trame(s) de ce format` : ""}.
        ${emplacement ? "" : `<strong>Attention : l'emplacement « ${esc(LIBELLE_CORPS)} » a disparu</strong> — le texte des trames se placerait à la fin du document. Réinsérez-le depuis la palette.`}
      </p>
      <div class="app-doc-preview fr-mt-3w">
        <iframe id="typePreview" title="Aperçu du format" srcdoc="${esc(previewType(store, type))}"></iframe>
      </div>
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        L'aperçu est le document produit sur une affaire d'exemple, dans la feuille de style de ce format.
        Replier les variables rend toute sa largeur au texte.
      </p>
    </div>
  </section>
  <aside class="app-doc__outils${variablesOuvertes ? "" : " app-doc__outils--replie"}">
    ${variables}
  </aside>
</div>`;

  return `${head}
<div class="fr-mt-2w">${identification}</div>
<div class="fr-mt-2w">${entetePanel}</div>
<div class="fr-mt-2w">${atelier}</div>`;
}

/* ------------------------------------------------------------------ */
/* Identité de l'outil (logo de l'opérateur)                           */
/* ------------------------------------------------------------------ */

/**
 * Réglages › Identité : logo de l'opérateur affiché dans l'en-tête, à droite
 * du bloc-marque de l'État — l'emplacement « opérateur » prévu par le DSFR.
 *
 * L'aperçu réutilise `ui.brandBlock`, c'est-à-dire exactement le balisage de
 * l'en-tête : ce qui se voit ici est ce que les pages afficheront.
 */
function viewIdentite(store, state) {
  const ctx = state.ctx;
  const row = store.table("Identite")[0];
  const tables = documentTables();
  // La table est facultative : un document Grist créé avant son apparition ne
  // l'a pas encore. Mieux vaut alors proposer de la créer que d'écrire dans le
  // vide — Grist refuserait l'écriture, et l'outil afficherait une panne.
  const tableAbsente = !!tables && !tables.includes("Identite");
  // Charte neutre : l'en-tête n'a plus de bloc-marque de l'État, le logo de
  // l'opérateur s'y tient donc seul, à gauche (voir `charte.js`).
  const neutre = charteNeutre(store.db);

  const url = row ? String(row.Logo_operateur || "").trim() : "";
  const logo = url ? { src: url, alt: String(row.Logo_operateur_alt || "").trim() } : null;

  const aide = `
    <p class="fr-text--sm fr-mt-2w">
      ${neutre
        ? `Le logo s'affiche <strong>à gauche de l'en-tête</strong>, à la place que le Système de design de
           l'État réserve à la marque de l'État — que la <a href="#reglages/charte" data-nav="reglages/charte">charte
           neutre</a> n'affiche pas. C'est donc lui, seul, qui identifie le service.`
        : `Le logo s'affiche <strong>à droite du bloc-marque « République Française »</strong>, dans
           l'en-tête de toutes les pages : c'est la place que le Système de design de l'État réserve à
           l'établissement qui opère le service.`}
    </p>
    <p class="fr-text--sm fr-mb-0">
      Préférez une image sur fond transparent (SVG de préférence, ou PNG), de la hauteur du
      bloc-marque — environ 3,5 rem. Une adresse d'image (https://…) allège la base ; un fichier
      choisi sur ce poste y est enregistré, ce qui convient aux logos légers. Laisser le champ vide
      n'affiche aucun logo.
    </p>`;

  let corps;
  if (tableAbsente) {
    corps = `
      ${alert("info", "La table « Identite » n'existe pas encore dans ce document",
        "Elle a été ajoutée à l'outil après la création du document. La créer n'ajoute qu'elle : "
        + "les tables et colonnes déjà présentes sont ignorées, et les données ne sont pas touchées.")}
      <div class="fr-mt-2w">
        ${button("Créer la table dans le document", { variant: "secondary", iconName: "database-line", action: "identite-table" })}
      </div>`;
  } else if (!row) {
    corps = emptyState(
      neutre
        ? "Aucun logo n'est configuré : l'en-tête n'affiche que le nom du service."
        : "Aucun logo n'est configuré : l'en-tête affiche seulement le bloc-marque de l'État.",
      {
        iconName: "image-line",
        action: button("Configurer le logo de l'opérateur", { variant: "secondary", iconName: "add-line", action: "identite-activer" }),
      });
  } else {
    corps = `
      ${formGrid("Identite", ["Logo_operateur", "Logo_operateur_alt"], ctx, row, { store, single: true })}
      <div class="app-row fr-mt-1w">
        ${button("Choisir une image sur ce poste…", { variant: "secondary", size: "sm", iconName: "upload-line", attrs: 'data-action="image-fichier" data-champ="identiteFile"' })}
        ${logo ? button("Retirer le logo", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", action: "identite-retirer" }) : ""}
      </div>
      <input type="file" id="identiteFile" accept="image/*" hidden aria-label="Image du logo de l'opérateur"
        data-table="Identite" data-record="${row.id}" data-colonne="Logo_operateur">
      ${aide}`;
  }

  const apercu = panel("Aperçu de l'en-tête", `
    <div class="app-header-preview">
      ${brandBlock({
        title: "Gestion des sections disciplinaires",
        tagline: "Suivi des affaires, composition des commissions et génération des documents",
        operator: logo,
        marque: !neutre,
      })}
    </div>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      Aperçu à l'identique : il reprend le balisage de l'en-tête réel de l'outil.
    </p>`, { iconName: "eye-line" });

  return `
${reglagesHead(store, state, "Identité", neutre
    ? "Logo de l'opérateur affiché dans l'en-tête — la charte neutre n'affiche pas la marque de l'État."
    : "Logo de l'opérateur affiché dans l'en-tête, à droite du bloc-marque de l'État.")}
<div class="fr-grid-row fr-grid-row--gutters">
  <div class="fr-col-12 fr-col-lg-7">${panel("Logo de l'opérateur", corps, { iconName: "image-line" })}</div>
  <div class="fr-col-12 fr-col-lg-5">${apercu}</div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Charte graphique (marque de l'État et police)                       */
/* ------------------------------------------------------------------ */

/**
 * Réglages › Charte graphique : la marque de l'État (présente ou non) et la
 * police des documents, réglées pour tout l'outil.
 *
 * L'aperçu réutilise `ui.brandBlock`, c'est-à-dire exactement le balisage de
 * l'en-tête : ce qui se voit ici est ce que les pages afficheront. La police,
 * elle, est montrée sur un fragment de courrier, dans la pile de polices
 * réellement appliquée aux documents (`policeDocumentCss`).
 */
function viewCharte(store, state) {
  const ctx = state.ctx;
  const row = store.table("Identite")[0];
  const tables = documentTables();
  const tableAbsente = !!tables && !tables.includes("Identite");
  const neutre = charteNeutre(store.db);
  const police = policeDocuments(store.db);

  const creerTable = `
    ${alert("info", "La table « Identite » n'existe pas encore dans ce document",
      "La charte neutre est appliquée par défaut. Créer la table n'ajoute qu'elle : les tables et "
      + "colonnes déjà présentes sont ignorées, et les données ne sont pas touchées.")}
    <div class="fr-mt-2w">
      ${button("Créer la table dans le document", { variant: "secondary", iconName: "database-line", action: "identite-table" })}
    </div>`;

  const activer = emptyState(
    "Aucun réglage n'est encore enregistré : la charte neutre est appliquée.",
    {
      iconName: "palette-line",
      action: button("Créer les réglages d'identité", { variant: "secondary", iconName: "add-line", action: "identite-activer" }),
    });

  const explicationCharte = `
    <dl class="app-dl">
      <dt>${esc(CHARTE_NEUTRE)} (défaut)</dt>
      <dd>La même interface que celle du Système de design de l'État — mêmes composants, même mise en
        page — mais <strong>sans la marque de l'État</strong>, en <strong>${esc(POLICE_NEUTRE)}</strong> à la
        place de Marianne, et avec un <strong>bleu d'action décalé d'un cran</strong> — un bleu encre
        légèrement acier, à la place de l'ultramarine de l'État. C'est la charte appliquée tant que rien
        n'a été réglé, et celle qui convient lorsque la structure ne porte pas la charte de l'État, ou
        n'a pas le droit d'en afficher la marque.
        <br>La police de la charte neutre est une police libre, <strong>servie par l'outil</strong> : elle
        s'affiche à l'identique sur tous les postes, sans que rien n'y soit installé.</dd>
      <dt>${esc(CHARTE_ETAT)}</dt>
      <dd>Le bloc-marque « République Française » dans l'en-tête et le pied de page, et la police
        <strong>Marianne</strong> — la charte du Système de design de l'État. Elle s'affiche
        <strong>sur demande</strong> : seule cette valeur du menu ci-dessus la donne. À choisir lorsque
        la structure porte la charte de l'État et a le droit d'en afficher la marque.</dd>
    </dl>
    <p class="fr-text--sm fr-mb-0">
      Le réglage vaut pour l'interface <strong>et</strong> pour les documents : courriers, rôles de
      séance, listes imprimées et fichiers exportés. Il ne change aucune donnée.
    </p>`;

  // Un seul aperçu pour toute la page : l'en-tête réel, puis un fragment de
  // courrier dans la police réglée. Deux aperçus séparés obligeaient à faire
  // l'aller-retour entre deux colonnes pour juger un même réglage.
  const policeApercu = `
    <div class="app-police-preview" style="font-family: ${esc(policeDocumentCss(store.db))};">
      <p class="app-police-preview__titre">Section disciplinaire — décision du 20 septembre 2026</p>
      <p>La formation a prononcé un blâme à l'encontre de la personne mise en cause. La présente
        décision lui sera notifiée par lettre recommandée avec demande d'avis de réception.</p>
      <p class="app-police-preview__mention">0123456789 — ABCDEFGHIJKLMNOPQRSTUVWXYZ — àâçéèêëîïôûùüÿœæ</p>
    </div>`;

  const champCharte = panel("Charte", `
    ${formGrid("Identite", ["Charte"], ctx, row, { store, single: true, placeholder: false })}
    <div class="fr-mt-2w">${explicationCharte}</div>`, { iconName: "palette-line" });

  const champPolice = panel("Police des documents", `
    ${formGrid("Identite", ["Police_documents"], ctx, row, { store, single: true })}
    <p class="fr-text--sm fr-mt-2w fr-mb-0">
      Police des courriers, rôles de séance et listes imprimées, pour tout l'outil : impression,
      Word et OpenDocument. Indiquez un nom installé sur les postes — « Times New Roman »,
      « Garamond », « Verdana »… Une pile complète est acceptée (« Georgia, Times, serif »).
      Le PDF fait exception : il <strong>joint la police au fichier</strong>, et seules deux
      familles peuvent voyager ainsi — celles des deux chartes, Public Sans et Marianne. Un nom
      réglé ici qui n'est ni l'une ni l'autre donne un PDF composé dans la police de la charte.
      ${police
        ? `Laisser vide pour revenir à ${neutre ? POLICE_NEUTRE : "Marianne"}.`
        : `Laisser vide emploie la police de la charte — actuellement ${neutre ? POLICE_NEUTRE : "Marianne"}.`}
    </p>
    ${neutre ? `<p class="fr-text--sm fr-mb-0">
      La police de la charte neutre, ${esc(POLICE_NEUTRE)}, est servie par l'outil : l'écran, l'impression
      et le PDF montrent donc toujours la même chose, sur tous les postes — le PDF l'embarque dans
      le fichier. Les fichiers Word et
      OpenDocument se contentent, eux, d'en écrire le nom — un poste qui ne l'a pas installée en
      affichera une autre. Le champ ci-dessus est là pour cela : indiquez-y une police que vos
      destinataires ont, et les fichiers seront fidèles partout.
    </p>` : ""}
  `, { iconName: "font-size" });

  const apercu = panel("Aperçu des réglages", `
    <div class="app-header-preview">
      ${brandBlock({
        title: "Gestion des sections disciplinaires",
        tagline: "Suivi des affaires, composition des commissions et génération des documents",
        operator: null,
        marque: !neutre,
      })}
    </div>
    <p class="fr-hint-text fr-mt-1w fr-mb-2w">
      En-tête réel de l'outil, à l'identique. Le choix d'un logo y figure dès qu'un logo est configuré
      (Réglages ›
      <a href="#reglages/identite" data-nav="reglages/identite">Identité</a>).
    </p>
    <p class="fr-text--sm fr-mb-1w"><strong>Police des documents</strong> — fragment de courrier</p>
    ${policeApercu}`, { iconName: "eye-line" });

  let corps;
  if (tableAbsente) {
    corps = `
      <div class="fr-col-12">${panel("Charte graphique", creerTable, { iconName: "palette-line" })}</div>`;
  } else if (!row) {
    corps = `
      <div class="fr-col-12">${panel("Charte graphique", activer, { iconName: "palette-line" })}</div>`;
  } else {
    corps = `
      <div class="fr-col-12 fr-col-lg-7">${champCharte}${champPolice}</div>
      <div class="fr-col-12 fr-col-lg-5">${apercu}</div>`;
  }

  return `
${reglagesHead(store, state, "Charte graphique",
    `Charte en vigueur : ${esc(charte(store.db))}${police ? ` — documents en ${esc(police)}` : ""}.`)}
<div class="fr-grid-row fr-grid-row--gutters">${corps}</div>`;
}

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

/**
 * L'export d'une table, en un seul geste : un menu qui propose CSV ou Excel.
 *
 * La page portait deux boutons par table — une trentaine au total, dont la
 * moitié désactivée — pour un geste qu'on fait rarement. Les deux formats
 * vivent maintenant sous un même bouton, et les exports de **toute** la base
 * sont en tête de page.
 */
function exportTableCell(store, table) {
  if (!store.table(table).length) return `<span class="fr-text-mention--grey">—</span>`;
  const nom = SCHEMA[table].label;
  const item = (kind, label, iconName) => ui.iconButton(iconName, {
    title: `Exporter « ${nom} » au format ${label}`,
    attrs: `data-action="export-${kind}" data-export="${kind}" data-export-table="${table}"`,
  });
  return exportMenu({
    label: "Exporter",
    size: "sm",
    variant: "tertiary",
    items: `${item("csv", "CSV", "file-text-line")}${item("xlsx", "Excel", "table-line")}`,
  });
}

function viewDonnees(store, state) {
  const counts = Object.keys(SCHEMA).map((t) => ({
    id: t,
    cells: [esc(SCHEMA[t].label), `<strong>${store.table(t).length}</strong>`, exportTableCell(store, t)],
  }));
  const total = Object.keys(SCHEMA).reduce((n, t) => n + store.table(t).length, 0);

  const contenu = panel("Contenu de la base", `
    ${dataTable({
      caption: `Nombre d'enregistrements — ${total} au total`,
      columns: ["Table", "Lignes", "Export"],
      rows: counts,
      rowAttr: "",
      emptyText: "Base vide.",
    })}
    <div class="fr-mt-2w app-row">
      ${button("Exporter (JSON)", { variant: "secondary", iconName: "download-line", action: "export" })}
      ${button("Exporter (Excel)", { variant: "secondary", iconName: "table-line", action: "export-base-xlsx" })}
      ${button("Exporter (CSV)", { variant: "secondary", iconName: "file-text-line", action: "export-base-csv" })}
      ${button("Importer…", { variant: "secondary", iconName: "upload-line", action: "import" })}
      ${button("Restaurer les exemples", { variant: "tertiary", iconName: "refresh-line", action: "reset" })}
      ${button("Tout effacer", { variant: "tertiary", iconName: "delete-bin-line", action: "clear" })}
    </div>
    <input type="file" id="importFile" accept="application/json" aria-label="Fichier JSON à importer" hidden>
    <p class="fr-hint-text fr-mt-2w fr-mb-1w">
      L'export <strong>JSON</strong> est la sauvegarde complète : toutes les tables, réimportables à l'identique
      sur un autre poste. L'export <strong>Excel</strong> produit un classeur d'une feuille par table, et l'export
      <strong>CSV</strong> une archive d'un fichier par table : ce sont les formats qu'ouvre un tableur, pour un
      inventaire, une statistique ou un envoi. Chaque table se télécharge aussi séparément, par les boutons de la
      colonne « Export » ci-dessus. Pensez à exporter avant de vider la base : la suppression est définitive.
    </p>
    <p class="fr-hint-text fr-mb-0">
      Pour reprendre un <strong>document existant</strong> — le document Grist « Gestion des sections disciplinaires »
      (.grist), un classeur ou un fichier délimité exporté depuis ses tables (.xlsx, .csv), ou les tables du
      document auquel l'outil est connecté — utilisez
      <a href="#reglages/import" data-nav="reglages/import">Import des données</a> : l'outil lit le fichier, vous
      montre table par table ce qu'il en fera, et la correspondance des colonnes avant d'écrire.
    </p>
  `, { iconName: "database-line" });

  const mode = panel("Mode de fonctionnement", `
    ${state.grist === "connected"
      ? (documentReadOnly()
        ? alert("error", "Connecté, mais le document est en lecture seule",
          "Grist refuse toute modification du document (« No write access, document is read-only ») : la lecture "
          + "fonctionne, l'enregistrement non. Votre rôle n'est pas en cause — le serveur Grist retient le "
          + "document en lecture seule (site d'équipe suspendu, abonnement ou plan dépassé, instance en accès "
          + "restreint). La raison exacte s'affiche dans Grist. Les saisies faites ici restent dans ce navigateur.")
        : alert("success", "Connecté à un document Grist", "Les données sont lues et écrites directement dans les tables du document."))
      : state.grist === "error"
        ? alert("warning", "Structure Grist incomplète", state.gristError || "Installez la structure puis rechargez.")
        : state.grist
          ? alert("info", "Connexion à Grist en cours…", "Récupération des tables du document.")
          : alert("info", "Mode autonome", "Les données sont enregistrées dans ce navigateur (localStorage). Exportez régulièrement votre base.")}
    ${widgetAccessLevel && widgetAccessLevel !== "full"
      ? alert("warning", "Le widget n'a pas l'accès complet au document",
        `Niveau accordé : « ${widgetAccessLevel} ». Dans les options du widget Grist, choisissez « Full document access » pour que l'outil puisse lire et écrire toutes les tables.`)
      : ""}
    <p class="fr-text--sm">
      Cet outil reproduit la « Gestion des sections disciplinaires ». Ouvert à l'intérieur d'un
      document Grist via l'API widget, il utilise automatiquement les tables du document ; ouvert
      seul, il fonctionne de manière autonome et s'héberge tel quel.
    </p>
    <p class="fr-text--sm">
      Dans le document, les tables de l'outil portent le préfixe <code>GristHidden_</code> : Grist les
      retire de son interface — sélecteur de widgets, « Données brutes », barre d'onglets. Le document
      sert de base de données, l'outil en est l'interface : les dossiers se saisissent et se consultent
      ici, avec les contrôles de régularité, les colonnes calculées et les documents qui vont avec.
    </p>
    <div class="fr-btns-group fr-btns-group--inline fr-mt-2w">
      ${state.grist === "connected"
        ? button("Rafraîchir depuis Grist", { variant: "secondary", iconName: "refresh-line", action: "grist-refresh" })
        : gristAvailable()
          ? button("Installer la structure", { variant: "tertiary", iconName: "database-line", action: "grist-install" })
          : ""}
      ${gristAvailable() ? button("Vérifier la structure", { variant: "tertiary", iconName: "shield-line", action: "grist-check" }) : ""}
    </div>
    ${structureAlert(state)}
  `, { iconName: "information-line" });

  return `
${reglagesHead(store, state, "Données", "Sauvegarde, restauration et mode de fonctionnement de l'outil.")}
<div class="fr-grid-row fr-grid-row--gutters">
  <div class="fr-col-12 fr-col-lg-7">${contenu}</div>
  <div class="fr-col-12 fr-col-lg-5">${mode}</div>
</div>
${utilisateursPanel()}
${confidentialitePanel()}
${contenusPanel(store)}
${gristOriginesPanel(state)}
${diagnosticPanel(state)}
${journalPanel(store, state)}`;
}

/* ------------------------------------------------------------------ */
/* Utilisateurs du document                                            */
/* ------------------------------------------------------------------ */

/**
 * Journal des personnes reconnues par la table technique ajoutée au document
 * Grist : c'est elle qui porte les rôles (propriétaire, éditeur, lecteur).
 */
function utilisateursPanel() {
  if (!sessionUsers.length) return "";
  const rows = sessionUsers.map((u) => {
    const role = roleFromGristAccess(u.Acces);
    return {
      id: u.id,
      cells: [
        esc(str(u.Nom) || "—"),
        esc(str(u.Email) || "—"),
        `<p class="fr-badge fr-badge--sm ${esc(roleBadgeClass(role))}">${esc(roleLabel(role))}</p>`,
        u.Premiere_visite ? dateTimeCell(u.Premiere_visite) : "—",
      ],
    };
  });
  const nb = (r) => sessionUsers.filter((u) => roleFromGristAccess(u.Acces) === r).length;
  return panel("Utilisateurs du document", `
    ${dataTable({
      caption: `${rows.length} utilisateur(s) reconnu(s) — ${nb("administrateur")} propriétaire(s), ${nb("secretaire")} éditeur(s)`,
      columns: ["Nom", "Courriel", "Rôle", "Première visite"],
      rows,
      rowAttr: "",
      emptyText: "Aucun utilisateur enregistré.",
    })}
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      Ces informations ne sont pas saisies : elles sont calculées par Grist à la première visite de
      chaque personne, et conservées dans la table <code>${esc(SESSION_TABLE)}</code> du document.
      C'est elle qui attribue les rôles — propriétaires et éditeurs y sont ajoutés automatiquement,
      ainsi qu'à la liste des secrétaires. Un visiteur n'y figure que si le document lui en laisse
      le droit d'écriture.
    </p>
`, {
    iconName: "group-line",
    subtitle: "Qui a ouvert l'outil, et avec quel rôle",
    collapsible: true,
  });
}

/* ------------------------------------------------------------------ */
/* Confidentialité du poste                                            */
/* ------------------------------------------------------------------ */

/**
 * Réglages de confidentialité au poste de travail (NC-0009) : le **mode
 * session**, qui ne conserve rien dans le navigateur, et le **verrouillage
 * après inactivité**. Le rappel sur le poste partagé est là pour que le choix
 * soit éclairé, et non pour être ignoré.
 */
function confidentialitePanel() {
  const prefs = loadPrefs();
  const session = !!prefs.modeSession;
  const minutes = Number(prefs.verrouillageMin) || 0;
  const codeDefini = !!prefs.verrouCodeHash;
  const occ = occupationStockage();
  const occTexte = session
    ? "sans objet (mode session : rien n'est conservé sur le poste)"
    : `${Math.round(occ.octets / 1024)} Kio sur environ ${Math.round(occ.quota / 1024 / 1024)} Mio (${Math.round(occ.ratio * 100)} %)`;
  const options = [[0, "Jamais"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [30, "30 minutes"], [60, "1 heure"]];
  return panel("Confidentialité du poste", `
    ${alert("info", "Poste partagé ?",
      "Sur un poste partagé — salle des thèses, secrétariat de passage, poste de remplacement —, les dossiers "
      + "restent lisibles tant que la session du navigateur est ouverte. Activez le mode session et le "
      + "verrouillage, ou travaillez sur un profil utilisateur dédié. Voir « Vie privée » dans le README.")}
    <div class="fr-checkbox-group fr-mt-3w">
      <input type="checkbox" id="confSession" data-action="confidentialite-session" aria-describedby="confSession-desc" ${session ? "checked" : ""}>
      <label class="fr-label" for="confSession">Mode session — ne rien conserver sur ce poste</label>
      <p class="fr-hint-text app-desc" id="confSession-desc">La base n'est pas écrite dans le navigateur : elle disparaît à la fermeture de
        l'onglet. Exportez avant de quitter. Les données restent, elles, dans le document Grist si l'outil y est relié.</p>
    </div>
    <div class="fr-select-group fr-mt-3w">
      <label class="fr-label" for="confVerrou">Verrouillage après inactivité</label>
      <select class="fr-select" id="confVerrou" aria-describedby="confVerrou-desc" data-action="confidentialite-verrouillage">
        ${options.map(([v, l]) => `<option value="${v}" ${minutes === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
      <p class="fr-hint-text app-desc" id="confVerrou-desc">L'écran se couvre après ce délai sans interaction.
        ${codeDefini
          ? "Un <strong>code de reprise</strong> est défini : saisissez-le pour revenir aux dossiers."
          : "Aucun code de reprise n'est défini : un clic suffit à rouvrir l'écran (la couche protège des regards, elle ne bloque pas l'accès)."}</p>
    </div>
    <div class="fr-input-group fr-mt-3w">
      <label class="fr-label" for="confCodeInput">Code de reprise${codeDefini ? " — modifié si vous en saisissez un nouveau" : ""}</label>
      <input class="fr-input" type="password" id="confCodeInput" aria-describedby="confCodeInput-desc" autocomplete="new-password">
      <p class="fr-hint-text app-desc" id="confCodeInput-desc">Au moins 4 caractères. Seule l'empreinte du code est conservée sur le poste,
        jamais le code lui-même. Ce code ne remplace pas la protection du système d'exploitation : il complète
        le verrouillage automatique, pour qu'un poste laissé ouvert ne se rouvre pas d'un simple clic.</p>
      <p class="fr-error-text" id="confCodeErr" hidden></p>
    </div>
    <div class="fr-btns-group fr-btns-group--inline">
      ${button("Enregistrer le code", { variant: "secondary", size: "sm", iconName: "lock-line", action: "confidentialite-code" })}
      ${codeDefini
        ? button("Effacer le code", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", action: "confidentialite-code-effacer" })
        : ""}
    </div>
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      Le mode session est <strong>${session ? "activé" : "désactivé"}</strong> sur ce poste ; le code de reprise est
      <strong>${codeDefini ? "défini" : "non défini"}</strong>. Occupation du stockage local : ${esc(occTexte)}.
      ${!session && occ.niveau !== "normal"
        ? `<strong class="fr-text-default--error">Le stockage se remplit : exportez une sauvegarde.</strong>` : ""}
    </p>
  `, { iconName: "lock-line", subtitle: "Ce qui reste — ou non — sur ce poste après votre départ", id: "confidentialite" });
}

/* ------------------------------------------------------------------ */
/* Contenus livrés                                                     */
/* ------------------------------------------------------------------ */

/**
 * Détail replié du plan d'alignement (NC-0026) : les éléments livrés manquants,
 * puis les champs de lignes livrées qui diffèrent de la livraison, ligne à
 * ligne et champ par champ. C'est ce que l'auteur de l'outil doit voir **avant**
 * d'appliquer, pour ne pas perdre de vue une adaptation locale.
 */
function detailAvisHtml(detail) {
  if (!detail) return "";
  const lignesAjouts = detail.ajouts
    .map((a) => `<li>${esc(a.table)} — ${esc(a.nom)}</li>`).join("");
  const lignesCorrections = detail.corrections
    .map((c) => `<li>${esc(c.table)} — ${esc(c.nom)} : ${
      c.champs.map((ch) => `${esc(ch.champ)} « ${esc(ch.avant)} » → « ${esc(ch.apres)} »`).join(" ; ")}</li>`)
    .join("");
  return `
    <details class="fr-mt-2w">
      <summary class="fr-text--sm">Voir le détail (${detail.ajouts.length} ajout(s), ${detail.corrections.length} correction(s))</summary>
      ${detail.ajouts.length ? `
        <p class="fr-text--sm fr-mt-2w fr-mb-0"><strong>Éléments livrés manquants (${detail.ajouts.length})</strong></p>
        <ul class="fr-text--sm">${lignesAjouts}</ul>` : ""}
      ${detail.corrections.length ? `
        <p class="fr-text--sm fr-mt-2w fr-mb-0"><strong>Champs de lignes livrées modifiés chez vous (${detail.corrections.length})</strong></p>
        <p class="fr-hint-text fr-mt-0">Ces corrections ne s'appliquent que par le bouton « Ajouter et corriger ».</p>
        <ul class="fr-text--sm">${lignesCorrections}</ul>` : ""}
    </details>`;
}

/**
 * Contenus livrés avec l'outil (NC-0005, NC-0015, NC-0026) : ce que la
 * livraison apporte, en **nombre** — comptages produits par le code, non
 * recopiés à la main —, la version de l'outil, et, si la base n'a pas encore
 * reçu un contenu livré, l'avis qui le dit, le détail de ce qui changerait, et
 * les gestes qui l'alignent. Une base neuve n'affiche rien : elle porte déjà
 * tout.
 */
function contenusPanel(store) {
  const inventaire = contenusLivres();
  const plan = planAlignementContenus(store.db);
  const compte = compteAlignement(plan);
  const aJour = planEstVide(plan);
  const prefs = loadPrefs();
  const ecarte = prefs.contenusSignature === signatureContenus();
  const afficherAvis = !aJour && !ecarte;
  const detail = afficherAvis ? detailAlignement(plan, store.db) : null;
  const avis = afficherAvis
    ? alert("info", "Contenus livrés plus récents que cette base",
      `${compte.ajouts} élément(s) livré(s) — trames, formats ou entrées de catalogue — manquent à cette base, `
      + `et ${compte.corrections} champ(s) de lignes livrées portent une valeur différente de la livraison. `
      + "Ajoutez les manquants d'un geste ; les corrections de champs, elles, ne s'appliquent que sur demande, "
      + "et le détail est affiché ci-dessous. Ni le texte de vos trames ni vos propres lignes ne sont touchés.",
      `<div class="fr-btns-group fr-btns-group--inline fr-mt-2w">
        ${compte.ajouts
          ? button("Ajouter les éléments manquants", { variant: "primary", size: "sm", iconName: "add-line", action: "aligner-contenus", attrs: 'data-record="ajouts"' })
          : ""}
        ${compte.corrections
          ? button(`Ajouter et corriger (${compte.corrections})`, { variant: "secondary", size: "sm", iconName: "refresh-line", action: "aligner-contenus", attrs: 'data-record="tout"' })
          : ""}
        ${button("Écarter cet avis", { variant: "tertiary", size: "sm", action: "contenus-ecarter" })}
      </div>${detailAvisHtml(detail)}`)
    : "";
  return panel("Contenus livrés", `
    ${avis}
    ${dl([
      ["Version de l'outil", versionLivraison()],
      ["Sanctions livrées", String(inventaire.sanctions)],
      ["Motifs livrés", String(inventaire.motifs)],
      ["Trames livrées", String(inventaire.trames)],
      ["Formats livrés", String(inventaire.formats)],
      ["Seuils livrés", String(inventaire.seuils)],
      ["Alignement sur la livraison", aJour ? "à jour" : `${compte.ajouts} ajout(s), ${compte.corrections} correction(s) en attente`],
    ])}
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      Ces nombres sont produits par le code de l'outil, non recopiés : ils décrivent ce qu'une base neuve
      reçoit. Une base installée depuis longtemps ne les reçoit pas d'elle-même — c'est l'objet de l'avis
      ci-dessus, dont le geste ne touche jamais au texte de vos trames.
    </p>
  `, {
    iconName: "archive-line",
    subtitle: "Ce que la livraison apporte, et l'écart avec cette base",
    collapsible: true,
    open: afficherAvis,
    id: "contenusLivres",
  });
}

/* ------------------------------------------------------------------ */
/* Références juridiques du répertoire (NC-0019)                       */
/* ------------------------------------------------------------------ */

/**
 * Les références citées par le répertoire des considérants, telles qu'elles se
 * présentent à la vérification du service juridique (NC-0019) : chaque source,
 * les considérants qui s'y appuient, celles qui ne sont pas retrouvables — une
 * identité réduite à « M. X » ne se vérifie pas — et les affirmations qui
 * attendent un visa.
 *
 * La date de la dernière vérification est un seuil réglable
 * (`references_verifiees_le`, voir `regimes.js`) : le bouton la porte au jour
 * où la revue se fait. L'outil ne prétend jamais qu'une vérification a eu lieu :
 * sans date enregistrée, il le dit.
 */
function referencesPanel(store) {
  const { verifieLe, total, nonRetrouvables, aVerifier, references } = referencesDuRepertoire(store.db, {
    verifieLe: seuilTexte(store.db, "references_verifiees_le"),
  });

  const avis = nonRetrouvables
    ? alert("warning", "Références non retrouvables",
      `${nonRetrouvables} source(s) citée(s) par le répertoire ne sont pas identifiables en l'état : `
      + "elles ne doivent pas sortir dans un acte avant d'avoir été reprises.")
    : aVerifier.length
      ? alert("info", "Affirmations à faire viser",
        `${aVerifier.length} considérant(s) portent une affirmation que l'outil ne peut pas adosser à une source `
        + "citée. À faire vérifier par le service juridique.")
      : "";

  const boutonVerification = button("Enregistrer la vérification du jour", {
    variant: "secondary", size: "sm", iconName: "shield-check-line", action: "references-verifiees",
  });

  return panel("Références juridiques", `
    <p class="fr-text--sm">
      Le répertoire des considérants cite des textes et des décisions. Une référence n'est utilisable que si elle
      est <strong>retrouvable</strong> : une source réduite à une initiale ne se vérifie pas, et ne doit pas être
      reprise dans un acte. Cette page réunit les sources citées, les considérants qui s'y appuient, et les
      affirmations qui attendent le visa du service juridique.
    </p>
    ${avis}
    <div class="fr-mt-2w">
      ${dl([
        ["Sources citées", String(total)],
        ["Non retrouvables", String(nonRetrouvables)],
        ["Affirmations à vérifier", String(aVerifier.length)],
        ["Dernière vérification", verifieLe ? formatDateFr(verifieLe) : "jamais"],
      ])}
    </div>
    <p class="fr-hint-text fr-mb-0">
      ${verifieLe ? "La vérification est datée" : "Aucune vérification n'a encore été enregistrée"}
      — elle se règle aussi comme un seuil, sous la clé <code>references_verifiees_le</code>.
    </p>
    ${aVerifier.length ? `
    <div class="fr-mt-3w">
      <h3 class="fr-h5">Affirmations à faire viser</h3>
      ${dataTable({
        caption: "Considérants dont une affirmation reste à vérifier",
        columns: ["Considérant", "Rubrique", "Source citée"],
        class: "app-table--fixed app-table--wrap",
        cols: ["auto", "9rem", "10rem"],
        rows: aVerifier.map((c) => ({
          id: c.id,
          cells: [
            esc(c.titre || c.id),
            esc(rubriqueDe(c.rubrique)?.label || c.rubrique || ""),
            esc(c.source || "—"),
          ],
        })),
      })}
    </div>` : ""}
    <div class="fr-mt-3w">
      ${dataTable({
        caption: "Sources citées par le répertoire des considérants",
        columns: ["Source", "Considérants", "Retrouvable"],
        class: "app-table--fixed app-table--wrap",
        cols: ["auto", "7rem", "8rem"],
        rows: references.map((r) => ({
          id: r.source,
          cells: [
            `${esc(r.source)}${r.considerants.some((c) => !c.livre) ? ` ${tag("Adaptée", "blue")}` : ""}`
            + `<p class="fr-text--xs fr-text-mention--grey fr-mb-0">${r.considerants.map((c) => esc(c.titre || c.id)).join(" · ")}</p>`,
            String(r.n),
            r.retrouvable ? tag("Retrouvable", "green") : tag("À reprendre", "warning"),
          ],
        })),
      })}
    </div>
  `, {
    iconName: "shield-check-line",
    subtitle: "Ce que le répertoire cite, et ce qu'il faut vérifier",
    collapsible: true,
    open: nonRetrouvables > 0,
    id: "referencesJuridiques",
    actions: boutonVerification,
  });
}

/* ------------------------------------------------------------------ */
/* Serveur Grist déclaré (NC-0023)                                     */
/* ------------------------------------------------------------------ */

/**
 * Déclaration du serveur Grist de l'établissement.
 *
 * L'API du widget n'est chargée que depuis une origine **autorisée** (NC-0011) :
 * le service public `docs.getgrist.com`, l'instance souveraine de l'État
 * `grist.numerique.gouv.fr`, ou une origine que le déploiement a déclarée. Une
 * instance auto-hébergée doit donc être déclarée, sans quoi le widget reste sur
 * son écran d'attente. Ce panneau rend la déclaration praticable sans toucher
 * aux fichiers : l'établissement saisit l'adresse de son serveur, la
 * déclaration est conservée sur le poste et vaut pour les visites suivantes.
 */
function gristOriginesPanel(state) {
  const diag = gristOriginesDiagnostic();
  const declarees = originesGristDeclarees();
  return panel("Serveur Grist déclaré", `
    <p class="fr-text--sm">
      L'outil ne charge l'API du widget que depuis une origine autorisée. Sont reconnues sans
      réglage les instances publiques (<code>docs.getgrist.com</code>, <code>getgrist.com</code>) et
      l'instance souveraine de l'État (<code>grist.numerique.gouv.fr</code>). Pour une
      <strong>instance auto-hébergée</strong>, déclarez son adresse ci-dessous : sans elle, le widget
      reste sur son écran d'attente.
    </p>
    <div class="fr-input-group">
      <label class="fr-label" for="gristOrigineInput">Adresse du serveur Grist</label>
      <input class="fr-input" type="text" id="gristOrigineInput" name="gristOrigineInput"
        placeholder="https://grist.mon-etablissement.fr"
        value="${esc(declarees.join(", "))}"
        aria-describedby="gristOrigineHint">
      <p class="fr-hint-text" id="gristOrigineHint">
        Un ou plusieurs noms d'hôtes ou adresses, séparés par des virgules. Laissez vide pour ne
        conserver que les instances reconnues.
      </p>
    </div>
    <div class="fr-btns-group fr-btns-group--inline">
      ${button("Enregistrer la déclaration", { variant: "secondary", iconName: "save-line", action: "grist-declarer-origine" })}
    </div>
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      Origines actuellement autorisées : <code>${esc(diag.autorisees || "aucune")}</code>.
      ${diag.parent !== "inconnue"
        ? `Page appelante : <code>${esc(diag.parent)}</code> — ${diag.parentAutorise ? "autorisée" : "non autorisée"}.`
        : "Aucune page appelante détectée : l'outil n'est pas ouvert comme widget."}
    </p>
    <p class="fr-hint-text fr-mb-0">
      Un déploiement peut aussi déclarer ses serveurs dans le fichier <code>index.html</code>, par une
      balise <code>&lt;meta name="grist-origins" content="grist.mon-etablissement.fr"&gt;</code> ou une
      variable <code>window.GRIST_ALLOWED_ORIGINS = ["grist.mon-etablissement.fr"]</code>, ce qui vaut
      pour tous les postes. Voir <code>README.md</code> et <code>SECURITE.md</code>.
    </p>
  `, {
    iconName: "server-line",
    subtitle: "Autoriser l'API d'une instance Grist auto-hébergée",
    collapsible: true,
    open: !state.grist && declarees.length > 0,
    id: "gristOrigines",
  });
}

/* ------------------------------------------------------------------ */
/* Diagnostic                                                          */
/* ------------------------------------------------------------------ */

/**
 * État technique du branchement sur le document Grist, réservé aux
 * propriétaires. Le statut de connexion n'apparaît pas dans l'en-tête : il
 * est regroupé ici, pour le dépannage.
 */
function diagnosticPanel(state) {
  // Affiché dès que la page est ouverte comme widget, même quand l'API n'a pas
  // pu être chargée : c'est justement le cas où ces informations servent.
  if (!gristAvailable() && !state.embedded && state.grist !== "connected") return "";
  const connexion = state.grist === "connected"
    ? "Connecté"
    : state.grist === "error"
      ? "Échec de la liaison"
      : state.grist
        ? "Connexion en cours…"
        : "Aucune (mode autonome)";
  const role = currentRole(state);
  const diagOrigines = gristOriginesDiagnostic();
  const ecritures = state.grist !== "connected"
    ? "sans objet (hors document)"
    : documentReadOnly()
      ? "refusées — le serveur Grist retient le document en lecture seule"
      : writesEnabled() ? "actives" : "suspendues — rôle en consultation seule";
  return panel("Diagnostic", `
    ${dl([
      ["Version de l'outil", versionLivraison()],
      ["Mode d'exécution", gristAvailable() ? "Widget Grist" : "Autonome (localStorage)"],
      ["Connexion au document", connexion],
      ["Accès accordé au widget", widgetAccessLevel || "non signalé"],
      ["API du widget", gristApiUrl || "non chargée"],
      ["Origine de la page appelante", diagOrigines.parent === "inconnue"
        ? "aucune (outil hors cadre)"
        : `${diagOrigines.parent} — ${diagOrigines.parentAutorise ? "autorisée" : "non autorisée"}`],
      ["Origines Grist autorisées", diagOrigines.autorisees || "aucune"],
      ["Serveurs déclarés sur ce poste", originesGristDeclarees().join(", ") || "aucun"],
      ["Écritures vers le document", ecritures],
      ["Cadre d'affichage", nestedFrame()
        ? "imbriqué — l'API du widget ne répond qu'à son parent immédiat"
        : "direct"],
      ["Table technique des utilisateurs", sessionUsers.length ? SESSION_TABLE : "non créée"],
      ["Personnes reconnues", String(sessionUsers.length)],
      ["Rôle appliqué", `${roleLabel(role)} — source : ${state.user ? state.user.source : "indéterminée"}`],
      ["Dernière erreur", state.gristError || "aucune"],
      ["Dernière erreur d'écriture", lastWriteError || "aucune"],
    ])}
    <p class="fr-hint-text fr-mt-2w fr-mb-0">
      Informations techniques destinées au dépannage. Le statut de connexion au document n'est
      affiché nulle part ailleurs dans l'interface : en cas de doute, consultez ce bloc.
    </p>
  `, {
    iconName: "bug-line",
    subtitle: "État technique du branchement Grist",
    collapsible: true,
  });
}

/* ------------------------------------------------------------------ */
/* Journal de diagnostic                                               */
/* ------------------------------------------------------------------ */

/**
 * Compte rendu technique de la liaison, à transmettre tel quel en cas de
 * panne. Il est présenté dans une zone de texte — et non dans la page — pour
 * être copié sans mise en forme parasite.
 */
function journalPanel(store, state) {
  const rapport = diagnosticReport(store, state);
  // Ouvert d'emblée quand quelque chose ne va pas : c'est précisément le
  // moment où ce journal sert, et personne ne pense à déplier un panneau
  // fermé.
  const enPanne = !!(state.gristWriteError || state.gristMissingColumns.length || state.grist === "error");
  return panel("Journal de diagnostic", `
    <p class="fr-text--sm">
      État complet de la liaison au document : mode, tables et colonnes réellement présentes,
      formules du document, utilisateurs reconnus, et journal des écritures — y compris celles que
      Grist a refusées, avec l'action exacte. C'est ce journal qu'il faut transmettre pour faire
      comprendre une panne : Grist n'indique jamais lui-même quel enregistrement a échoué.
    </p>
    <div class="app-row fr-mt-2w fr-mb-2w">
      ${button("Copier le journal", { variant: "secondary", iconName: "clipboard-line", action: "diag-copier" })}
      ${button("Télécharger (.txt)", { variant: "tertiary", iconName: "download-line", action: "diag-telecharger" })}
      ${button("Actualiser", { variant: "tertiary", iconName: "refresh-line", action: "diag-actualiser" })}
    </div>
    <textarea id="diagLog" class="fr-input app-diag-log" rows="20" readonly spellcheck="false"
      aria-label="Journal de diagnostic">${esc(rapport)}</textarea>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      Le journal ne reprend aucun dossier ni aucune personne mise en cause : uniquement la
      structure du document, ses formules et l'état de la liaison, ainsi que les personnes
      autorisées par le document (${rapport.length} caractères).
    </p>
  `, {
    iconName: "clipboard-line",
    subtitle: "Ce qu'il faut transmettre en cas de panne",
    collapsible: true,
    open: enPanne,
  });
}

/* ------------------------------------------------------------------ */
/* Contrôle de la structure du document                                */
/* ------------------------------------------------------------------ */

/**
 * Résultat du dernier « Vérifier la structure » (rôle propriétaire) : tables
 * et colonnes attendues par l'outil, absentes du document.
 */
function structureAlert(state) {
  const check = state.structure;
  if (!check) return "";
  if (!check.total) {
    return `<div class="fr-mt-2w">${alert("success", "Structure du document conforme",
      "Toutes les tables et colonnes attendues sont présentes.")}</div>`;
  }
  const liste = [...check.missingTables, ...check.missingColumns.slice(0, 8)];
  const reste = check.missingColumns.length - Math.min(8, check.missingColumns.length);
  return `
  <div class="fr-mt-2w">
    ${alert("warning", "Structure incomplète",
      `${check.missingTables.length} table(s) et ${check.missingColumns.length} colonne(s) manquante(s). `
      + "Les éléments absents sont ignorés à la lecture ; en revanche, une colonne manquante fait échouer "
      + "les enregistrements (et les formules du document qui s'y réfèrent). « Installer la structure » "
      + "les ajoute, sans toucher aux données existantes.")}
    <p class="fr-text--xs fr-mb-1w"><code>${esc(liste.join(", "))}${reste > 0 ? ` … (+${reste})` : ""}</code></p>
    ${button("Installer la structure", { variant: "tertiary", iconName: "database-line", action: "grist-install" })}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Personnes (répertoire)                                              */
/* ------------------------------------------------------------------ */

const TYPES_PERSONNE = ["Usager", "Personnel", "Tiers"];
const TONS_TYPE = { Usager: "blue", Personnel: "success", Tiers: "warning" };
const VUE_PERSONNE = ["Tous", ...TYPES_PERSONNE];

function identitePersonne(store, state, personne, { titre, hint }) {
  const ctx = state.ctx;
  const type = personne.Type || "Usager";
  const communs = ["Prenom", "Nom", "Genre", "Date_de_naissance", "Email", "Telephone"];
  const propres = type === "Personnel"
    ? ["Corps", "Section_CNU", "Etablissement", "Adresse"]
    : type === "Tiers"
      ? ["Qualite", "Organisme", "Adresse"]
      : ["INE", "Formation_suivie", "Composante", "Adresse"];
  return fieldset(titre, `
    ${formGrid("Personnes", ["Type", ...communs], ctx, personne, { store })}
    ${formGrid("Personnes", [...propres, "Notes"], ctx, personne, { store })}
  `, { hint });
}

function viewPersonnes(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  let rows = sortRecords(store.table("Personnes"), (p) => str(ctx.v("Personnes", p, "Nom_complet")), "asc");
  if (f.personneType && f.personneType !== "Tous") rows = rows.filter((p) => p.Type === f.personneType);
  if (f.personneQ) rows = rows.filter((p) => matches(f.personneQ, ctx.v("Personnes", p, "Nom_complet"), p.Email, p.INE, p.Etablissement, p.Corps, p.Formation_suivie));
  const selected = selectedOrFirst(store, state, "Personnes", rows);

  const filters = `
    <div class="app-filters">
      <div class="app-search">
        <label class="fr-label" for="personneQ">Rechercher</label>
        <input class="fr-input" type="search" id="personneQ" data-filter="personneQ" value="${esc(f.personneQ || "")}"
          placeholder="Nom, courriel, INE, corps…">
      </div>
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="personneType">Type</label>
        <select class="fr-select" id="personneType" data-filter="personneType">
          ${VUE_PERSONNE.map((t) => `<option value="${esc(t)}" ${((f.personneType || "Tous") === t) ? "selected" : ""}>${esc(t === "Tous" ? "Tous les types" : t)}</option>`).join("")}
        </select>
      </div>
    </div>`;

  const aside = masterPanel({
    title: "Personnes",
    iconName: "user-line",
    count: `${rows.length} fiche(s)`,
    filters,
    scrollKey: "personneList",
    body: rows.length
      ? rows.map((p) => listItem({
          table: "Personnes",
          id: p.id,
          selected: selected && p.id === selected.id,
          ref: esc(str(ctx.v("Personnes", p, "Nom_complet")) || `#${p.id}`),
          name: esc(str(p.Email) || "—"),
          meta: [p.Composante ? `<span>${esc(str(p.Composante))}</span>` : "", p.Corps ? `<span>${esc(str(p.Corps))}</span>` : "", p.Formation_suivie ? `<span>${esc(str(p.Formation_suivie))}</span>` : ""].filter(Boolean).join(""),
          badgeHtml: p.Type ? tag(p.Type, TONS_TYPE[p.Type] || "grey") : "",
        })).join("")
      : emptyState("Aucune fiche au répertoire.", { iconName: "user-line" }),
  });

  const head = reglagesHead(store, state, "Personnes",
    "Le répertoire commun : une fiche par personne, réutilisée d'une affaire à l'autre, quel que soit le régime.",
    exportTableButtons({ table: "Personnes", rows, titre: "Télécharger les fiches affichées, recherche et filtre compris" }));

  if (!selected) {
    return `${head}${split(aside, panel("Première fiche", emptyState(
      "Créez une fiche : elle pourra être reliée à toutes les affaires où la personne paraît — mise en cause, victime, témoin ou représentant.",
      { iconName: "user-line", action: button("Ajouter une personne", { variant: "primary", iconName: "user-add-line", action: "add-personne" }) }
    ), { iconName: "user-line" }))}`;
  }

  const affaires = store.table("Affaires").filter((a) => Number(a.Mis_en_cause) === selected.id);
  const implications = store.table("Implications").filter((i) => Number(i.Personne) === selected.id);
  const dossiers = [
    ...affaires.map((a) => ({ affaire: a, role: "Personne mise en cause" })),
    ...implications.map((i) => ({ affaire: store.byId("Affaires", i.Affaire), role: i.Role })),
  ].filter((x) => x.affaire);

  const fiche = panel("Fiche", `
    ${identitePersonne(store, state, selected, {
      titre: "Identité et coordonnées",
      hint: "Les champs proposés s'adaptent au type de personne choisie. Une correction ici se répercute sur toutes ses affaires.",
    })}
  `, {
    iconName: "user-line",
    subtitle: str(ctx.v("Personnes", selected, "Nom_complet")),
    actions: `${button("Ajouter une personne", { variant: "tertiary", size: "sm", iconName: "add-line", action: "add-personne" })}
      <button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" data-delete="Personnes:${selected.id}">${icon("delete-bin-line", 'class="fr-mr-1v"')}Supprimer</button>`,
  });

  const parcours = panel("Affaires de cette personne", dossiers.length
    ? dataTable({
        caption: `${dossiers.length} affaire(s) où la personne paraît`,
        columns: ["Numéro", "Mis en cause", "Rôle", "État"],
        rows: dossiers.map((d) => ({
          id: `${d.affaire.id}-${d.role}`,
          cells: [
            `<strong>${esc(str(ctx.v("Affaires", d.affaire, "Numero")))}</strong>`,
            esc(str(ctx.v("Affaires", d.affaire, "Nom_complet")).trim()),
            esc(d.role),
            badge(d.affaire.Etat),
          ],
        })),
        rowMeta: 'data-open="affaires"',
      })
    : emptyState("Cette personne n'est reliée à aucune affaire pour le moment.", { iconName: "folder-2-line" }),
  { iconName: "folder-2-line" });

  return `${head}${split(aside, `<div class="app-stack">${fiche}${parcours}</div>`)}`;
}

/* ------------------------------------------------------------------ */
/* Catalogues et délais                                                */
/* ------------------------------------------------------------------ */

function catalogueTable({ table, columns, entetes, ctx, store, vide, action }) {
  const rows = store.table(table);
  if (!rows.length) return emptyState(vide, { iconName: "bookmark-line", action: button("Ajouter", { variant: "secondary", iconName: "add-line", action }) });
  return `
<div class="fr-table fr-table--bordered fr-table--sm app-table--dense app-table--catalogue">
  <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
    <table>
      <caption class="fr-sr-only">${esc(table)}</caption>
      <thead><tr>${entetes.map((h) => `<th scope="col"${h === "Texte de référence" ? ' class="app-cell-ref"' : ""}>${esc(h)}</th>`).join("")}<th scope="col"><span class="fr-sr-only">Actions</span></th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        ${columns.map((c) => `<td${c === "Texte_de_reference" ? ' class="app-cell-ref"' : ""}>${field(table, c, ctx, r, { store, compact: true })}</td>`).join("")}
        <td class="app-cell-action">${ui.iconButton("delete-bin-line", { title: "Supprimer", attrs: `data-delete="${table}:${r.id}"` })}</td>
      </tr>`).join("")}</tbody>
    </table>
  </div></div></div>
</div>`;
}

function viewCatalogues(store, state) {
  const ctx = state.ctx;

  // Alignement sur les textes : les entrées livrées par défaut qui manquent ou
  // qui ont été corrigées depuis (groupe, régime, tutelle, durée, sursis, texte
  // de référence) sont proposées ici. Le plan est calculé sur les données, sans
  // rien écrire (voir `planAlignementCatalogue`, dans `regimes.js`).
  const planSanctions = planAlignementCatalogue("Sanctions", store.db);
  const planMotifs = planAlignementCatalogue("Motifs", store.db);
  const manquants = planSanctions.ajouts.length + planSanctions.modifications.length
    + planMotifs.ajouts.length + planMotifs.modifications.length;
  const alignement = manquants
    ? alert("info", "Catalogues livrés par défaut",
      "Les textes applicables aux sections disciplinaires ont été repris dans un catalogue livré avec l'outil : "
      + `${planSanctions.ajouts.length} sanction(s) et ${planMotifs.ajouts.length} motif(s) n'y figurent pas encore, `
      + `et ${planSanctions.modifications.length + planMotifs.modifications.length} entrée(s) portent une rédaction `
      + "antérieure (groupe, régime, tutelle, durée, sursis ou texte de référence). Vos propres lignes ne sont pas "
      + "touchées, et rien n'est supprimé.",
      button(`Rétablir le catalogue livré (${manquants})`, {
        variant: "secondary", size: "sm", iconName: "scales-3-line", action: "aligner-catalogues",
      }))
    : "";

  const sanctions = panel("Sanctions", `
    <p class="fr-text--sm">
      Le catalogue est ce qui alimente la liste « Sanction prononcée » d'une décision. Le <em>groupe</em> sert au
      calcul du terme : les sanctions des groupes « Avertissement et blâme » et « Mesure de responsabilisation »
      s'effacent au bout du délai réglé ci-dessous, les exclusions définitives et les révocations ne s'effacent
      jamais. Le <em>régime</em> et la <em>tutelle</em> limitent ce qui est proposé à chaque type de section : un
      usager ne se voit offrir que les sanctions prévues par son code, un enseignant-chercheur que les siennes.
      Le <em>texte de référence</em> porte l'article et le numéro d'item : la formation peut vérifier ce qu'elle
      prononce.
    </p>
    <div class="fr-mt-2w">
      ${catalogueTable({
        table: "Sanctions",
        columns: ["Libelle", "Groupe", "Public", "Tutelle", "Duree_max_mois", "Sursis_possible", "Texte_de_reference"],
        entetes: ["Libellé", "Groupe", "Régime", "Tutelle", "Durée max (mois)", "Sursis", "Texte de référence"],
        ctx, store, action: "add-sanction",
        vide: "Aucune sanction au catalogue.",
      })}
    </div>
  `, {
    iconName: "scales-3-line",
    subtitle: "Ce que la formation peut prononcer",
    actions: `${button("Ajouter une sanction", { variant: "secondary", size: "sm", iconName: "add-line", action: "add-sanction" })}
      ${exportTableButtons({ table: "Sanctions", rows: store.table("Sanctions"), size: "sm", titre: "Télécharger le catalogue des sanctions" })}`,
  });

  const motifs = panel("Motifs", `
    <p class="fr-text--sm">
      Les motifs retenus à la saisine. Comme les sanctions, ils sont filtrés par régime et par tutelle : un motif
      propre aux enseignants-chercheurs, ou propre aux établissements agricoles, n'est pas proposé ailleurs. Les
      cinq manquements des usagers sont ceux de l'article R.811-11 du code de l'éducation — et de l'article
      R.812-24-2 du code rural et de la pêche maritime, dont le 5° ajoute l'atteinte à la réputation de
      l'établissement.
    </p>
    <div class="fr-mt-2w">
      ${catalogueTable({
        table: "Motifs",
        columns: ["Libelle", "Groupe", "Public", "Tutelle", "Texte_de_reference"],
        entetes: ["Libellé", "Groupe", "Régime", "Tutelle", "Texte de référence"],
        ctx, store, action: "add-motif",
        vide: "Aucun motif au catalogue.",
      })}
    </div>
  `, {
    iconName: "bookmark-line",
    subtitle: "Ce qui peut être reproché",
    actions: `${button("Ajouter un motif", { variant: "secondary", size: "sm", iconName: "add-line", action: "add-motif" })}
      ${exportTableButtons({ table: "Motifs", rows: store.table("Motifs"), size: "sm", titre: "Télécharger le catalogue des motifs" })}`,
  });

  const parametres = panel("Seuils et délais", `
    <p class="fr-text--sm">
      Ces valeurs gouvernent les contrôles de régularité et le calcul du terme des sanctions. La <em>clé</em>
      est l'identifiant technique lu par l'outil : ne la modifiez que si vous savez à quoi elle correspond.
    </p>
    <div class="fr-mt-2w">
      ${catalogueTable({
        table: "Parametres",
        columns: ["Nom", "Categorie", "Valeur", "Cle"],
        entetes: ["Nom", "Catégorie", "Valeur", "Clé"],
        ctx, store, action: "add-parametre",
        vide: "Les seuils ne sont pas installés : l'outil applique ses valeurs par défaut.",
      })}
    </div>
    ${store.table("Parametres").length
      ? ""
      : `<div class="fr-mt-2w">${button("Installer les seuils par défaut", { variant: "primary", iconName: "download-line", action: "installer-parametres" })}</div>`}
    <div class="fr-mt-2w">
      ${dl([
        ["Prescription", "Délai au-delà duquel l'action disciplinaire est prescrite. Elle ne concerne que les personnels : à l'égard d'un usager, l'action peut être engagée à tout moment.", true],
        ["Convocation", "Délai minimal entre l'envoi de la convocation et la séance.", true],
        ["Recours", "Durée pendant laquelle la décision prononçant une sanction ou l'abandon des poursuites peut être contestée.", true],
        ["Blâme", "Durée d'effacement de l'avertissement, du blâme et du rappel à l'ordre.", true],
        ["Mois d'exclusion", "Nombre de jours comptés pour un mois d'exclusion temporaire.", true],
      ])}
    </div>
  `, {
    iconName: "equalizer-line",
    subtitle: "Les valeurs que l'outil compare aux dates de chaque dossier",
    actions: `${button("Ajouter un paramètre", { variant: "secondary", size: "sm", iconName: "add-line", action: "add-parametre" })}
      ${exportTableButtons({ table: "Parametres", rows: store.table("Parametres"), size: "sm", titre: "Télécharger les seuils et délais" })}`,
  });

  // Deux tableaux de près de trois cents champs ne tiennent pas sur une page :
  // ils se lisent en sous-onglets, un catalogue à la fois. Les références
  // juridiques du répertoire s'y ajoutent : ce sont elles que le service
  // juridique vise (NC-0019).
  const referencesJuridiques = referencesPanel(store);
  const ongletsCatalogue = [
    { id: "sanctions", label: "Sanctions", iconName: "scales-3-line", count: store.table("Sanctions").length },
    { id: "motifs", label: "Motifs", iconName: "bookmark-line", count: store.table("Motifs").length },
    { id: "seuils", label: "Seuils et délais", iconName: "equalizer-line", count: store.table("Parametres").length },
    { id: "references", label: "Références", iconName: "shield-check-line", count: referencesDuRepertoire(store.db).total },
  ];
  const ongletCatalogue = ongletsCatalogue.some((o) => o.id === state.tabs.catalogueOnglets)
    ? state.tabs.catalogueOnglets : "sanctions";
  const corpsCatalogue = { sanctions, motifs, seuils: parametres, references: referencesJuridiques }[ongletCatalogue];

  return `
${reglagesHead(store, state, "Catalogues et délais",
    "Sanctions, motifs, seuils de contrôle et références juridiques : les données sur lesquelles l'outil s'appuie, réglables sans toucher au code.")}
${alignement}
${ui.tabs({ id: "catalogueOnglets", items: ongletsCatalogue, active: ongletCatalogue, label: "Catalogues" })}
${ui.tabPanel({ id: "catalogueOnglets", tab: ongletCatalogue, classe: "app-stack fr-mt-2w", contenu: corpsCatalogue })}`;
}

/* ------------------------------------------------------------------ */
/* Accès refusé                                                        */
/* ------------------------------------------------------------------ */

/**
 * Page affichée à un utilisateur qui n'a pas les droits de propriétaire
 * lorsqu'il demande les réglages (lien mémorisé, adresse saisie à la main).
 */
export function viewReglagesInterdit(store, state) {
  const role = currentRole(state);
  const texte = role === "secretaire"
    ? "Vous êtes identifié comme « Secrétaire » : vous pouvez saisir et suivre les dossiers, mais les paramètres de l'outil sont réservés aux propriétaires du document."
    : "Vous êtes identifié comme « Visiteur » : l'outil est en lecture seule, et les paramètres sont réservés aux propriétaires du document.";
  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Réglages</p>
    <h1 class="fr-h3">Réglages réservés aux propriétaires</h1>
    <p class="app-page-head__sub">La configuration de l'outil — sections, secrétaires, destinataires, trames et données — suit les droits du document Grist.</p>
  </div>
</div>
${alert("info", "Votre rôle ne donne pas accès aux réglages", texte)}
<p class="fr-mb-0">
  <a class="fr-btn fr-btn--secondary" href="#tableau-de-bord" data-nav="tableau-de-bord">${icon("arrow-left-line", 'class="fr-mr-1v"')}Retour au tableau de bord</a>
</p>`;
}

/* ------------------------------------------------------------------ */
/* Aiguillage                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aiguillage des sous-pages de Réglages.
 *
 * Deux d'entre elles — les trames et les types de trames — ont une fiche
 * ouverte par une adresse à trois segments (`reglages/trames/7`) : c'est la
 * sous-vue de rédaction de cette fiche. Sans elle, la page de la sous-section
 * est son registre. Le reste est inchangé.
 */
export function viewReglages(store, state) {
  const sub = REGLAGES_SUBS.some((s) => s.id === state.sub) ? state.sub : "sections";
  const fiche = state.fiche ? store.byId(FICHES_SUBS[sub] || "", Number(state.fiche)) : null;
  if (fiche && sub === "trames") return viewTrame(store, state, fiche);
  if (fiche && sub === "types") return viewTypeTrame(store, state, fiche);
  switch (sub) {
    case "personnes": return viewPersonnes(store, state);
    case "secretaires": return viewSecretaires(store, state);
    case "destinataires": return viewDestinataires(store, state);
    case "catalogues": return viewCatalogues(store, state);
    case "trames": return viewTrames(store, state);
    case "types": return viewTypes(store, state);
    case "import": return viewImport(store, state);
    case "identite": return viewIdentite(store, state);
    case "charte": return viewCharte(store, state);
    case "donnees": return viewDonnees(store, state);
    default: return viewSections(store, state);
  }
}
