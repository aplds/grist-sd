// Documents publipostés.
//
// Un document est un texte : il se rédige, se relit, se rend. Trois écrans le
// concernent, et chacun a son rôle :
//
//  - la page « Documents » range les courriers produits en **dossiers** : une
//    affaire, un dossier. Les affaires y sont celles de la liste des affaires
//    (périmètre et saisine la plus récente d'abord), et chacune porte ses
//    documents. Une affaire sans document n'est pas une ligne vide : c'est le
//    dossier où l'on en crée un ;
//  - l'onglet « Documents » d'une affaire énumère les courriers de ce dossier,
//    sous la même forme ; chaque ligne — ici comme dans la page — porte
//    l'action qui la supprime, après confirmation ;
//  - la **sous-vue** d'un document (`#documents/12`) est son espace de
//    rédaction, et ne concerne que lui. C'est là que le texte, les paramètres
//    et le résultat se règlent, avec toute la largeur de la page.
//
// Chaque document a donc son adresse propre, et c'est ce qui permet de
// l'ouvrir — et de le corriger — depuis n'importe quelle vue où il est cité,
// plutôt que d'avoir à le retrouver dans une liste, ou à le rédiger dans une
// colonne étroite à côté d'elle.
//
// Dans cette sous-vue, l'espace de rédaction tient la première place : ses
// trois vues — rédaction, balisage, résultat — sont trois regards sur le même
// texte. Le rendu généré n'est pas une section de la page : c'est la vue
// « Résultat », celle où l'on imprime et où l'on exporte. À droite du texte se
// tiennent les deux outils, les paramètres du document et les variables ;
// tous deux se replient pour rendre leur largeur au texte.

import { chipHtml, htmlCanonique, htmlToEditor, paletteHtml, toolbarHtml } from "../editor.js";
import { computeDocumentParts, decouperFeuille, documentBody, documentScope, feuilleEffective, feuilleEffectiveDocument, styleRegex } from "../render.js";
import { GROUPE_DECISION, LIBELLE_CORPS, labelOfToken, trameCatalog, variablesCatalog } from "../trame-variables.js";
import { decisionDefinitiveDe, decisionsPour, regimeOf, sanctionsPour, tramesPour } from "../regimes.js";
import { formatDateFr } from "../formulas.js";
import { institutionnelsDeLaSection } from "../redaction.js";
import {
  AUTEUR_PRESIDENT_SECTION,
  BALISE_CORPS,
  DEST_CHEF_ETABLISSEMENT,
  DEST_LIBRE,
  DEST_TEMOIN,
  DEST_TUTELLE,
  DEST_VICTIME,
  NATURE_INTERLOCUTOIRE,
  QUALITES_CHEF_ETABLISSEMENT,
  QUALITE_MINISTRE,
  QUALITE_RECTEUR,
  FORMAT_DECISION,
  FORMAT_ORDONNANCE,
  TUTELLE_AGRI,
} from "../schema.js";
import { affairesVisibles, mentionPerimetre, parAffaire, perimetreRestreint } from "../visibilite.js";
import * as ui from "../ui.js";
import { canSettings } from "../roles.js";
import { repertoire } from "../considerants.js";
import { affaireRef, affaireName, echeanceInstruction, matches, sortRecords, exportBar, exportMenu, exportTableItems, exportTableButtons, outils } from "./common.js";
import { outilConsiderants } from "./decision-redaction.js";

const { esc, str, icon, badge, dateCell, panel, emptyState, button, field, formGrid, dl, fieldset } = ui;

/** Pastille d'état du texte (suit la trame / personnalisé). */
function etiquette(label, kind, id = "") {
  return `<p class="fr-badge fr-badge--sm fr-badge--${kind} app-badge"${id ? ` id="${id}"` : ""}>${esc(label)}</p>`;
}



/* ------------------------------------------------------------------ */
/* Sélection des trames                                                */
/* ------------------------------------------------------------------ */

/**
 * Trames compatibles avec la section : régime, tutelle et type de section.
 * Une trame générique (régime « Les deux », tutelle « Toutes ») est proposée
 * partout ; une trame propre à une procédure ne l'est que là.
 */
export function trameOptions(store, section) {
  return tramesPour(store.db, section);
}

/* ------------------------------------------------------------------ */
/* Listes de documents (affaire et registre)                           */
/* ------------------------------------------------------------------ */

/**
 * Une ligne de la liste des documents. Elle mène à la sous-vue du document,
 * par son adresse propre : d'où qu'on l'ouvre — de la page « Documents » ou de
 * l'onglet d'une affaire — c'est le même espace de rédaction qui s'ouvre, et
 * c'est le seul endroit où le texte s'écrit.
 *
 * Un lien plutôt qu'un bouton : l'adresse `#documents/12` se copie, s'ouvre
 * dans un nouvel onglet, et survit au rechargement. À côté du lien, l'action
 * qui supprime le document : un document se supprime d'où on le voit, et la
 * confirmation nomme ce qui disparaît (voir `doDelete` dans `app.js`).
 */
function documentItem(store, ctx, d, { ref, name = "", avecAffaire = true }) {
  const affaire = store.byId("Affaires", d.Affaire);
  const tpl = d.Template ? store.byId("Trames", d.Template) : null;
  // La date butoir d'instruction que porte le document — c'est elle qui fixe le
  // terme de l'instruction, prioritaire sur l'échéance de la procédure : elle se
  // met en avant dans la liste, avec le ton de ce qu'il reste à courir.
  const joursButoir = d.Date_butoir_instruction && affaire
    ? ctx.v("Affaires", affaire, "Jours_restants_instruction")
    : null;
  const tonButoir = joursButoir === null || joursButoir === undefined ? "blue"
    : joursButoir < 0 ? "error" : joursButoir <= 15 ? "warning" : "success";
  const butoir = d.Date_butoir_instruction
    ? `<span class="app-tag app-tag--${tonButoir}" title="Instruction à clore le"><span class="app-tag__icone">${icon("timer-line")}</span>${dateCell(d.Date_butoir_instruction)}</span>`
    : "";
  const meta = [
    avecAffaire && affaire ? `<span>${esc(affaireRef(ctx, affaire))}</span>` : "",
    d.Date ? `<span>${dateCell(d.Date)}</span>` : "",
    butoir,
    // À qui le document est adressé : programmé sur la trame, il se lit d'un
    // coup d'œil dans la liste — une décision, elle, n'est pas adressée.
    tpl && tpl.Destinataire ? `<span aria-hidden="true">→</span><span>${esc(str(tpl.Destinataire))}</span>` : "",
  ].filter(Boolean).join("");
  return `<div class="app-list__row">
    <a class="app-list__item" href="#documents/${d.id}" data-nav="documents/${d.id}">
      <span class="app-list__top">
        <span class="app-list__ref">${ref}</span>
        ${icon("arrow-right-line", 'class="app-list__go" aria-hidden="true"')}
      </span>
      ${name ? `<span class="app-list__name">${name}</span>` : ""}
      ${meta ? `<span class="app-list__meta">${meta}</span>` : ""}
    </a>
    ${ui.iconButton("delete-bin-line", { title: "Supprimer ce document", attrs: `data-delete="Generateur:${d.id}"` })}
  </div>`;
}

/**
 * Les documents d'une affaire, à leur place dans l'onglet « Documents ».
 * Chaque ligne ouvre la sous-vue du document : la liste n'embarque pas
 * l'éditeur, elle y mène.
 */
export function documentsList(store, state, docs, opts = {}) {
  const ctx = state.ctx;
  // Les pièces se lisent de la plus récente à la plus ancienne : c'est l'ordre
  // dans lequel on rouvre un dossier, et celui du registre de la page
  // « Documents ». À date égale, le type de la trame (courrier, décision…)
  // départage, pour que les pièces d'une même journée se suivent par famille.
  const ordonnes = sortRecords(docs, (d) => {
    const tpl = d.Template ? store.byId("Trames", d.Template) : null;
    return `${String(d.Date || "")}|${tpl ? str(ctx.v("Trames", tpl, "Type_court_")) || "" : ""}`;
  }, "desc");
  const body = ordonnes.length
    ? ordonnes.map((d) => {
        const tpl = d.Template ? store.byId("Trames", d.Template) : null;
        const nom = tpl ? str(ctx.v("Trames", tpl, "Nom_complet")) : "Trame à choisir";
        return documentItem(store, ctx, d, { ref: esc(nom), name: tpl ? esc(str(tpl.Objet)) : "" });
      }).join("")
    : emptyState(opts.vide || "Aucun document.", { iconName: "printer-line" });

  return panel("Documents de l'affaire", `
    ${opts.hint ? `<p class="fr-text--sm fr-text-mention--grey fr-mb-2w">${esc(opts.hint)}</p>` : ""}
    ${opts.filters || ""}
    <div class="app-list" data-scroll="documentList">${body}</div>
    ${opts.actions ? `<div class="fr-mt-2w">${opts.actions}</div>` : ""}
  `, { iconName: "printer-line" });
}

/* ------------------------------------------------------------------ */
/* Éditeur d'un document                                               */
/* ------------------------------------------------------------------ */

/**
 * Les trois vues de l'espace de rédaction. Un document est d'abord un texte :
 * on l'écrit, on relit son balisage, on juge son rendu. Le rendu généré n'est
 * donc pas une section de la page — c'est la troisième vue du même espace.
 */
const VUES = [
  { id: "redaction", label: "Rédaction", iconName: "edit-line" },
  { id: "balisage", label: "Balisage", iconName: "code-s-slash-line" },
  { id: "resultat", label: "Résultat", iconName: "file-text-line" },
];

/**
 * L'espace d'écriture d'un document, **d'une seule feuille** : l'en-tête du
 * service, puis ce que la trame apporte autour du texte — le chapeau et le
 * destinataire, la signature et le pied de page —, et le texte lui-même, au
 * milieu. Rien ne les sépare à l'écran : le document se lit et s'écrit d'un
 * bout à l'autre, comme une page.
 *
 * Un document ne se réduit pas à son texte, et c'est pourtant le seul que
 * l'éditeur montrait d'abord : la feuille de style de la trame l'entourait sans
 * qu'on puisse la voir ni la corriger. Tout s'écrit donc maintenant dans la même
 * feuille — on y corrige une imprécision de la trame, une mention, une
 * signature, **pour cette seule pièce**, sans que la trame ni les autres
 * documents changent.
 *
 * Deux marques invisibles (`data-marque`) disent à l'enregistrement où commence
 * et où finit le texte : ce qui les précède et ce qui les suit forment la
 * feuille propre au document, ce qu'elles encadrent reste son texte. Chacun
 * n'est écrit que s'il a bougé : tant qu'il est fidèle à la trame, le document
 * continue d'en hériter (voir `saveEditorContent`, app.js). Une feuille
 * enregistrée d'un bout à l'autre — sans emplacement du texte — s'édite telle
 * quelle, ses marques n'ayant plus lieu d'être.
 *
 * `corps` est le texte dont la pièce part — le corps de sa trame, ou son texte
 * propre —, et `texte` décrit la zone où il s'écrit (son identifiant, son
 * libellé, et les marques propres à l'écran qui l'accueille) : c'est le même
 * espace d'écriture, avec un autre texte dedans. L'atelier d'une décision y
 * ajoute ainsi `data-considerants` (voir views/decision-redaction.js).
 */
export function assemblageDocument({ store, doc, template, corps, chipFor, nomTrame = "", entete = "", texte }) {
  const type = template?.Type ? store.byId("Types_Trames", template.Type) : null;

  // La feuille héritée — celle de la trame — sert de référence : tant que la
  // feuille du document lui reste identique, aucune n'a rien adapté, et sa
  // colonne `Feuille_de_style` n'est pas écrite. La référence du texte est le
  // corps de la trame : tant qu'il n'a pas bougé, la pièce continue de le
  // suivre. Les deux sont données dans la forme que l'éditeur rendra.
  const feuilleTrame = feuilleEffective(template, type);
  const feuilleAffichee = feuilleEffectiveDocument(doc, template, type);
  const [avantHerite, apresHerite] = decouperFeuille(feuilleTrame);
  const baseCorps = String(template?.Template_contenu ?? "");
  const [avantFeuille, apresFeuille] = decouperFeuille(feuilleAffichee);
  const emplacement = feuilleAffichee.includes(BALISE_CORPS);
  // Une feuille que le document s'est donnée **d'un bout à l'autre** — sans
  // emplacement du texte — s'édite telle quelle : le texte y est déjà.
  const entiere = !emplacement && String(doc.Feuille_de_style ?? "").trim().length > 0;
  // La référence de la feuille : celle de la trame quand le document en hérite
  // — y revenir efface alors l'adaptation —, la sienne quand il l'a prise
  // entière.
  const baseFeuille = entiere
    ? htmlCanonique(feuilleAffichee)
    : `${htmlCanonique(avantHerite)}${BALISE_CORPS}${htmlCanonique(apresHerite)}`;

  // Deux marques invisibles disent à l'enregistrement où commence et où finit le
  // texte (voir `saveEditorContent`, app.js) : tout ce qui les précède
  // appartient à la feuille du document, tout ce qui les suit aussi, et ce
  // qu'elles encadrent est son texte. L'éditeur les laisse en place parce
  // qu'elles ne sont jamais saisies.
  const marque = (part) => `<span class="app-feuille__marque" data-marque="${part}" aria-hidden="true"></span>`;
  const interieur = entiere
    ? htmlToEditor(feuilleAffichee, chipFor, styleRegex())
    : htmlToEditor(avantFeuille, chipFor, styleRegex())
      + marque("corps-debut")
      + htmlToEditor(corps, chipFor)
      + marque("corps-fin")
      + htmlToEditor(apresFeuille, chipFor, styleRegex());

  return `
      <div class="app-wysiwyg__docs">
        <div class="app-wysiwyg__doc app-doc__assemblage${entete ? " app-doc__assemblage--entete" : ""}">
          ${entete ? `<div class="app-feuille__entete" aria-hidden="true">${entete}</div>` : ""}
          <div class="app-wysiwyg__edit app-feuille__corps" id="${esc(texte.id)}" contenteditable="true"
            role="textbox" aria-multiline="true" aria-label="${esc(texte.label)}" spellcheck="true"${texte.extra ? ` ${texte.extra}` : ""}
            data-wysiwyg-editor data-chips="feuille" data-table="Generateur" data-record="${doc.id}" data-field="assemblage"
            data-wysiwyg-base="${esc(baseFeuille)}" data-wysiwyg-base-corps="${esc(baseCorps)}">${interieur}</div>
          <p class="fr-hint-text fr-mt-1w fr-mb-0">
            Le document s'écrit d'un bout à l'autre : l'en-tête et le chapeau que la trame apporte, le texte,
            puis la signature et le pied de page. Le corriger ici ne change <strong>que ce document</strong>,
            jamais la trame ni les autres pièces.
            ${emplacement || entiere ? "" : `<strong>La feuille de la trame n'a pas d'emplacement
            « ${esc(LIBELLE_CORPS)} »</strong> — le texte se place alors avant le pied de page.`}
          </p>
        </div>
      </div>`;
}

export function documentEditor(store, state, doc) {
  const ctx = state.ctx;
  const affaire = store.byId("Affaires", doc.Affaire);
  const section = affaire && affaire.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const templates = trameOptions(store, section);
  const template = doc.Template ? store.byId("Trames", doc.Template) : null;
  const type = template?.Type ? store.byId("Types_Trames", template.Type) : null;
  const categorie = str(type?.Categorie);
  const estAdresse = categorie === "Courrier" || categorie === "Attestation";
  // Rendu ou adressé : un **acte rendu** — ordonnance ou décision — n'a pas de
  // destinataire. Mais seule une trame de format **Décision** rédige une
  // décision de la formation de jugement, et alimente à ce titre une ligne de
  // `Decisions` — son registre, ses effets et ses recours. Une **ordonnance**
  // est l'acte d'un président : elle règle la marche de l'instance, s'écrit
  // comme un document, et n'a ni décision à lier, ni terme, ni délai de
  // recours (voir `estOrdonnance`).
  const estDecision = categorie === FORMAT_DECISION;
  const estOrdonnance = categorie === FORMAT_ORDONNANCE;
  // Un **acte rendu** — une décision comme une ordonnance — se rédige comme un
  // raisonnement : il reçoit donc, ici comme dans l'atelier d'une décision, le
  // répertoire des considérants de principe et les gestes de numérotation. Un
  // courrier, une attestation ou un rapport, qui ne se motivent pas de la même
  // façon, ne les portent pas : leurs outils restent les variables et les
  // paramètres.
  const estActeRendu = estDecision || estOrdonnance;
  const personnalise = String(doc.Contenu ?? "").trim().length > 0;
  const propre = personnalise || String(doc.Feuille_de_style ?? "").trim().length > 0;
  const corps = documentBody(doc, template);
  const catalog = trameCatalog(store.db, doc);
  // La palette réunit les deux familles de balises, comme celle d'une trame :
  // les variables `{…}` de la feuille de style — celles du chapeau et de la
  // signature —, puis les balises de données `{{…}}` du texte. Chacune n'a de
  // sens que dans la zone qui lui correspond, et les libellés le disent.
  const catalogueFeuille = variablesCatalog(store.db, doc);
  const catalogue = {
    groups: [
      ...catalogueFeuille.groups.map((g) => ({ ...g, label: `Feuille de style — ${g.label}` })),
      // Une ordonnance ne rédige aucune décision : sa palette ne propose pas
      // les balises `{{Decision}}…`, qui liraient la décision d'une autre —
      // ou celle qui tranche le fond. Un acte préparatoire n'en est pas une.
      ...catalog.groups.filter((g) => !(estOrdonnance && g.id === GROUPE_DECISION)),
    ],
    index: { ...catalogueFeuille.index, ...catalog.index },
  };
  const chipFor = (token) => {
    const info = catalogue.index[token];
    return chipHtml(token, info?.label || labelOfToken(token), info?.sample || "");
  };
  const nomTrame = template ? str(ctx.v("Trames", template, "Nom_complet")) : "";
  // La trame est la source du texte **et** de ce qui l'entoure : d'ici, on peut
  // aller la corriger — pour **tous** ses documents — quand l'imprécision n'est
  // pas propre à cette pièce. La correction propre à la pièce, elle, se fait
  // dans la feuille, en bas (Réglages est réservé aux propriétaires : le
  // lien ne s'affiche que pour qui peut l'ouvrir).
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

  // Vue de l'espace de rédaction et état des deux outils de droite. Les trois
  // valeurs vivent dans `state.tabs` : le redessin de la page ne les remet pas
  // à zéro, et un onglet de vue n'est jamais perdu en cours de rédaction.
  const vue = VUES.some((v) => v.id === state.tabs.docVue) ? state.tabs.docVue : VUES[0].id;
  // Sans trame, le document n'a ni texte ni rendu : les paramètres — qui seuls
  // permettent de la choisir — restent ouverts, quoi qu'en dise leur état.
  const paramsOuverts = !template || state.tabs.docParams !== "replie";
  const variablesOuvertes = state.tabs.docVariables !== "replie";
  // Le répertoire des considérants d'un acte rendu : il partage la clé de pli de
  // l'atelier d'une décision (`decConsiderants`), qui ne s'affiche jamais en
  // même temps que cet espace — le geste de pliage y est donc le même.
  const considerantsOuverts = state.tabs.decConsiderants === undefined ? true : state.tabs.decConsiderants !== "replie";

  const templateSelect = `
    <div class="fr-select-group">
      <label class="fr-label" for="docTemplate">Type de document</label>
      <select class="fr-select" id="docTemplate" aria-describedby="docTemplate-desc" data-bind="Generateur|Template" data-record="${doc.id}">
        <option value="">— Choisir une trame —</option>
        ${templates.map((t) => `<option value="${t.id}" ${Number(doc.Template) === t.id ? "selected" : ""}>${esc(str(ctx.v("Trames", t, "Nom_complet")))}</option>`).join("")}
      </select>
      <p class="fr-hint-text app-desc" id="docTemplate-desc">Les trames proposées correspondent au public de la section${section ? ` « ${esc(str(section.Public))} »` : ""}.</p>
    </div>`;

  /* --- Auteur et destinataire, programmés sur la trame ------------------ */
  //
  // La trame dit qui rédige et à qui le document s'adresse (voir
  // `src/redaction.js`) : la rédaction n'a donc plus à choisir un émetteur ni
  // un destinataire. Elle garde la main sur les seuls cas où un choix reste
  // ouvert, et seulement parmi ceux que la trame a désignés :
  //
  //  - plusieurs victimes ou témoins dans l'affaire : laquelle est visée ;
  //  - plusieurs destinataires institutionnels de la qualité voulue : lequel ;
  //  - un « destinataire libre », dont les coordonnées s'écrivent alors ici.

  let auteur = null;
  let destinataire = null;
  try {
    const resolu = documentScope(store.db, doc, { template });
    auteur = resolu.auteur;
    destinataire = resolu.destinataire;
  } catch { /* document incomplet : l'auteur et le destinataire se taisent */ }

  /** Une ligne de lecture seule : ce que la trame décide, sans détour. */
  const resume = (iconName, texte) =>
    `<p class="app-signataire">${icon(iconName, 'class="fr-mr-1v"')}${texte}</p>`;

  /** Un choix restreint, parmi les seules fiches que la trame a désignées. */
  const selectLie = (table, colId, label, rows) => `
    <div class="fr-select-group">
      <label class="fr-label" for="doc_${colId}">${esc(label)}</label>
      <select class="fr-select" id="doc_${colId}" data-bind="Generateur|${colId}" data-record="${doc.id}">
        <option value="">—</option>
        ${rows.map((r) => `<option value="${r.id}" ${Number(doc[colId]) === Number(r.id) ? "selected" : ""}>${esc(str(ui.displayValue(table, ctx, r)))}</option>`).join("")}
      </select>
    </div>`;

  // L'auteur : le rôle déclaré par la trame, résolu sur l'affaire. La case de
  // remplacement du président ne concerne que l'auteur « président de la
  // section disciplinaire » — jamais un secrétaire ni une autorité.
  const vpSection = Boolean(section?.VP);
  const vpDocument = Boolean(doc.VP);
  const auteurPresident = Boolean(auteur?.role) && auteur.role === AUTEUR_PRESIDENT_SECTION;
  const blocAuteur = !template
    ? ""
    : !auteur?.role
      ? ui.alert("warning", "Aucun auteur", "Réglez l'auteur de cette trame dans Réglages › Trames (colonne « Auteur »).")
      : `${auteur.resolu
          ? resume("quill-pen-line", `Signé par <strong>${esc(auteur.nom)}</strong>${auteur.qualite ? ` — ${esc(auteur.qualite)}` : ""}.`)
          : ui.alert("warning", `Auteur introuvable : ${auteur.role}`, auteurPresident
            ? "Ajoutez un membre au rôle correspondant (Réglages › Sections et membres), ou changez l'auteur de la trame."
            : "Renseignez l'affaire : l'auteur se lit sur elle (autorité de saisine, composante, secrétaire…).")}
        ${auteurPresident ? ui.field("Generateur", "VP", ctx, doc, { store, locked: vpSection }) : ""}
        ${auteurPresident && vpSection
          ? `<p class="fr-hint-text fr-mt-1w fr-mb-0">Réglage de la section : toutes ses pièces sont signées par le vice-président (Réglages › Sections et membres).</p>`
          : ""}`;

  // Le destinataire : la trame en vise un rôle ; le document précise laquelle
  // des personnes, ou lequel des destinataires institutionnels, quand il y en
  // a plusieurs. Un destinataire libre s'écrit entièrement ici.
  const blocDestinataire = (() => {
    if (!estAdresse) return "";
    const role = str(template?.Destinataire);
    if (!role) {
      return ui.alert("warning", "Aucun destinataire",
        "Cette trame ne dit pas à qui le courrier s'adresse. Réglez-le dans Réglages › Trames (colonne « Destinataire »).");
    }
    if (role === DEST_LIBRE) return "";
    const affaireDe = affaire;
    const resumeDest = destinataire?.resolu
      ? resume("mail-line", `Adressé à <strong>${esc(destinataire.nom)}</strong>${destinataire.adresse ? ` — ${esc(destinataire.adresse).replace(/\n/g, ", ")}` : ""}.`)
      : ui.alert("warning", `Destinataire introuvable : ${role}`,
        "Renseignez l'affaire ou la section (personne mise en cause, personnes du dossier, destinataires institutionnels).");

    if (role === DEST_VICTIME || role === DEST_TEMOIN) {
      const lignes = affaireDe
        ? store.table("Implications").filter((i) => Number(i.Affaire) === Number(affaireDe.id) && str(i.Role) === role)
        : [];
      const personnes = lignes.map((i) => store.byId("Personnes", i.Personne)).filter(Boolean);
      return personnes.length > 1
        ? `${resumeDest}${selectLie("Personnes", "Personne_destinataire", `Laquelle des ${personnes.length} personnes de ce rôle ?`, personnes)}`
        : resumeDest;
    }

    if (role === DEST_CHEF_ETABLISSEMENT || role === DEST_TUTELLE) {
      const qualites = role === DEST_CHEF_ETABLISSEMENT
        ? QUALITES_CHEF_ETABLISSEMENT
        : [str(section?.Tutelle) === TUTELLE_AGRI ? QUALITE_MINISTRE : QUALITE_RECTEUR];
      const fiches = institutionnelsDeLaSection(ctx, section).filter((d) => qualites.includes(str(d.Qualite)));
      return fiches.length > 1
        ? `${resumeDest}${selectLie("Destinataires_institutionnels", "Destinataire_institutionnel", "Lequel des destinataires de cette qualité ?", fiches)}`
        : resumeDest;
    }

    return resumeDest;
  })();

  // Le signataire est celui de l'auteur déclaré par la trame (voir
  // `blocAuteur` ci-dessus) : plus rien ne se règle ici, sinon l'absence
  // brève du président, qui reste au plus près de la pièce.

  // Les paramètres du document : l'état civil du courrier — sa trame, ses
  // dates, ses destinataires. Ils se tiennent à droite de l'espace de
  // rédaction et se replient, parce qu'une fois le courrier réglé, c'est le
  // texte qui a besoin de la place.
  // Les seuls champs libres que la trame réclame : un texte qui n'utilise ni
  // `{{Champ_libre}}` ni `{{Date_libre}}` n'encombre pas les paramètres.
  const corpsDoc = String(documentBody(doc, template) || "");
  const utiliseChampLibre = /\{\{Champ_libre\}\}/.test(corpsDoc);
  const utiliseDateLibre = /\{\{Date_libre\}\}/.test(corpsDoc);
  // Le document touche à l'instruction : la trame le déclare
  // (`Concerne_l_instruction`), ou le texte a repris la balise. Dans les deux
  // cas, sa date butoir se règle ici et compte pour l'affaire.
  const utiliseButoir = Boolean(template?.Concerne_l_instruction)
    || /\{\{Date_butoir_instruction\}\}/.test(corpsDoc);
  const destinataireLibre = str(template?.Destinataire) === DEST_LIBRE;

  // La décision que rédige le document, prise dans l'affaire. Une affaire peut
  // porter autant de décisions avant dire droit que nécessaire : c'est donc
  // `Decision_liee` qui dit laquelle ce document rédige, et les balises
  // `{{Decision}}…` la lisent. La nature de la trame commande — celle qui porte
  // le jugement rédige la décision définitive, les autres une décision avant
  // dire droit —, et seules les décisions de même nature sont proposées : lier
  // un renvoi à la décision définitive ferait dire à celle-ci le texte d'un
  // autre acte.
  const decideDefinitive = Boolean(template && ctx.v("Trames", template, "Decision_definitive"));
  // La décision que rédige cette pièce, quand c'en est une : seule une décision
  // **définitive** peut s'exporter sous forme anonyme (voir `anonymat.js`). Un
  // acte préparatoire — ordonnance, décision avant dire droit — ne se publie pas
  // comme un jugement, et n'appelle donc pas de version anonyme.
  const decisionRedigee = estDecision
    ? (doc.Decision_liee
      ? ctx.byId("Decisions", doc.Decision_liee)
      : (decideDefinitive && affaire ? decisionDefinitiveDe(ctx, affaire) : null))
    : null;
  const anonymisable = Boolean(decisionRedigee) && String(decisionRedigee.Nature || "") !== NATURE_INTERLOCUTOIRE;
  const decisionsAffaire = affaire ? ctx.children("Decisions", affaire) : [];
  const decisionTriees = (rows) => sortRecords(rows, (x) => String(x.Date_du_delibere || x.Date_de_notification || ""), "desc");
  const decisionsCompatibles = !estDecision ? [] : decisionTriees(
    decideDefinitive
      ? [affaire ? decisionDefinitiveDe(ctx, affaire) : null].filter(Boolean)
      : decisionsAffaire.filter((x) => str(x.Nature) === NATURE_INTERLOCUTOIRE),
  );
  // Le libellé d'affichage d'une décision est son affaire : dans cette liste,
  // où toutes relèvent de la même affaire, il ne distinguerait rien. La date
  // du délibéré et le texte retenu, eux, disent laquelle est laquelle.
  const libelleDecision = (d) => {
    const quand = formatDateFr(d.Date_du_delibere || d.Date_de_notification);
    const quoi = str(ctx.v("Decisions", d, "Libelle_decision")) || str(d.Decision) || str(d.Nature);
    return [quand, quoi || `#${d.id}`].filter(Boolean).join(" — ");
  };
  const blocDecisionLiee = estDecision
    ? (decisionsCompatibles.length
      ? fieldset("Décision rédigée par ce document", `
          ${field("Generateur", "Decision_liee", ctx, doc, { store, rows: decisionsCompatibles, labelFor: libelleDecision })}
          <p class="fr-hint-text fr-mt-1w fr-mb-0">
            Le texte du document lit cette décision ({{Decision}}.Motivation, {{Decision}}.Libelle_decision…).
            ${decideDefinitive
              ? "Elle tranche le fond : une affaire n'en comporte qu'une."
              : "Une affaire peut porter autant de décisions avant dire droit que nécessaire."}
          </p>`)
      : ui.alert("info", "Aucune décision enregistrée",
        decideDefinitive
          ? "Ce document rédige la décision qui tranche le fond : commencez par l'enregistrer dans l'affaire, dans l'onglet « Décision »."
          : "Ce document rédige une décision avant dire droit : commencez par l'enregistrer dans l'affaire, "
            + "dans l'onglet « Décision ». Une affaire en comporte autant que nécessaire.",
        button(decideDefinitive ? "Enregistrer la décision définitive" : "Enregistrer la décision avant dire droit", {
          variant: "primary", size: "sm", iconName: "add-line",
          action: "doc-decision-creer", attrs: `data-record="${doc.id}"`,
        })))
    : estOrdonnance
      ? ui.alert("info", "Acte préparatoire",
        "Une ordonnance règle la marche de l'instance : elle ne tranche pas le fond, ne se notifie pas "
        + "comme une décision et n'est pas susceptible de recours — aucun délai ne court contre elle.")
      : "";

  // Les paramètres du document : la trame, l'auteur et le destinataire qu'elle
  // programme, et les seuls champs libres qu'elle réclame. L'espace de
  // rédaction est d'autant plus léger.
  const parametres = outils({
    titre: "Paramètres du document",
    iconName: "settings-5-line",
    ouvert: paramsOuverts,
    action: "doc-parametres",
    classe: "app-outils--parametres",
    repliable: !!template,
    body: `
    ${fieldset("Trame", templateSelect)}
    ${template ? fieldset("Auteur", blocAuteur) : ""}
    ${blocDestinataire ? fieldset("Destinataire", blocDestinataire) : ""}
    ${destinataireLibre ? fieldset("Destinataire libre", formGrid("Generateur", [
      "L_Destinataire", "L_Formule", "L_Adresse",
    ], ctx, doc, { store, wide: ["L_Adresse"] }), {
      hint: "Les coordonnées de la personne à qui le courrier est adressé.",
    }) : ""}
    ${fieldset("Date", `
      ${formGrid("Generateur", utiliseDateLibre ? ["Date", "Date_libre"] : ["Date"], ctx, doc, { store })}
      ${utiliseChampLibre ? field("Generateur", "Champ_libre", ctx, doc, { store, rows: 3 }) : ""}
    `)}
    ${utiliseButoir ? fieldset("Échéance d'instruction", `
      ${formGrid("Generateur", ["Date_butoir_instruction"], ctx, doc, { store })}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">
        La <strong>date butoir d'instruction</strong> que ce document fixe. Elle <strong>prime</strong>
        sur le délai de la procédure, qu'elle l'avance ou qu'elle le recule : c'est ce terme qui vaut
        pour l'affaire, dès que le document est enregistré. Entre plusieurs dates butoirs, la plus
        lointaine l'emporte.
      </p>
    `) : ""}
    ${blocDecisionLiee}`,
  });

  // La palette des variables : elle insère dans la zone active, quelle que
  // soit la vue — pastille mise en forme en « Rédaction », balise en texte en
  // « Balisage ».
  const variables = template ? outils({
    titre: "Variables",
    iconName: "braces-line",
    ouvert: variablesOuvertes,
    action: "doc-variables",
    classe: "app-outils--variables",
    body: paletteHtml(catalogue, {
      id: "docPalette",
      label: "Insérer une variable",
      hint: "Glissez une variable dans le texte — celle de la zone où vous écrivez —, ou cliquez pour l'insérer au curseur.",
    }),
  }) : "";

  // L'espace de rédaction : une barre d'outils, le texte, et — dans la vue
  // « Résultat » — la feuille A4. Les trois vues montrent le même texte.
  const ecriture = `
      ${toolbarHtml({ source: false })}
      ${assemblageDocument({
        store, doc, template, corps, chipFor, nomTrame, entete: parts ? parts.enTete : "",
        texte: {
          id: "docEditor",
          label: estOrdonnance ? "Texte de l'ordonnance" : estDecision ? "Texte de la décision" : "Texte du document",
          // La marque qui fait reconnaître un **acte rendu** : c'est elle qui
          // branche le dépôt d'un considérant et les gestes de numérotation
          // (voir `editeurDecision` et `monterAtelierDecision`, app.js).
          extra: estActeRendu ? 'data-considerants="1"' : "",
        },
      })}
      <div class="app-doc__rendu">
        ${erreur ? ui.alert("error", "Le document n'a pas pu être généré", erreur) : ""}
        <div class="app-doc__rendu-tete">
          <p class="fr-text--sm fr-mb-0">
            ${icon("printer-line", 'class="fr-mr-1v"')}Aperçu avant impression<span id="docPages" class="app-doc-pages" hidden></span>
          </p>
          <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-tab="docVue:redaction">
            ${icon("edit-line", 'class="fr-mr-1v"')}Modifier le texte
          </button>
        </div>
        <div class="app-doc-preview">
          <iframe id="docPreview" title="Aperçu du document" srcdoc="${esc(parts ? parts.html : "")}"></iframe>
        </div>
        <p class="fr-hint-text fr-mt-1w fr-mb-0">
          Trame : ${esc(nomTrame)}. La feuille A4 de l'aperçu a la géométrie de l'impression — marges de
          2 cm, pied de page compris — et les fichiers exportés la reprennent à l'identique.
        </p>
        ${exportBar({ printAction: "print-document", scope: "document", anonymisable })}
      </div>`;

  // La ligne d'aide suit la vue : elle dit ce que la vue montre, et comment
  // rendre sa largeur au texte quand les outils l'occupent.
  const replier = " Replier les outils de droite rend toute sa largeur au texte.";
  // Un acte rendu — décision ou ordonnance — se motive : il reçoit les outils
  // du raisonnement, et la ligne d'aide le dit.
  const motActeRendu = estActeRendu
    ? " C'est un acte rendu : les considérants de principe se glissent depuis le répertoire, à droite, et"
      + " « Numéroter les considérants » comme « Numéroter les articles » posent leurs numéros 1., 2., 3.…"
      + " et « Article 1er », « Article 2 »… dans l'ordre du texte."
    : "";
  const hints = {
    redaction: "Le document s'écrit d'une seule feuille : l'en-tête, le chapeau et le pied de page que la trame"
      + " apporte, et son texte, au milieu. Le corriger ici n'écrit que pour ce document — jamais la trame ni les"
      + " autres pièces — et « Revenir à la trame » défait vos corrections. "
      + (propre
        ? "Ce document ne suit plus la trame."
        : "Le document part de la trame ; la première modification le rend propre à cette pièce.")
      + " Les pastilles sont les variables : chacune montre la valeur que le document produira et redevient"
      + " une balise à l'enregistrement. La barre d'outils insère tableaux, images, traits et sauts de page,"
      + " et ses quatre menus règlent la police, la taille, la couleur et le surlignage du passage sélectionné." + replier + motActeRendu,
    balisage: "Le HTML du texte, tel qu'il sera enregistré — la palette y insère la balise au curseur." + replier,
    resultat: "Le document tel qu'il sera imprimé, découpé en pages : c'est ici qu'on le relit, qu'on l'imprime"
      + " et qu'on l'exporte. Le pied de page est répété au bas de chaque page, avec son numéro quand le type"
      + " de trame le demande (Réglages › Formats). Le texte, lui, se rédige dans la vue"
      + " « Rédaction », et les réglages du courrier s'y trouvent aussi.",
  };

  const espace = `
<div class="app-wysiwyg app-doc app-doc--${vue}" data-wysiwyg data-chips="columns" data-wysiwyg-view="${vue}">
  <section class="fr-panel app-doc__atelier">
    <div class="fr-panel__header">
      <div class="fr-panel__heading">
        <h2 class="fr-h6 fr-mb-0">${icon("edit-line", 'class="fr-mr-1v"')}Espace de rédaction</h2>
        <p class="fr-text--sm fr-mb-0 fr-text-mention--grey">${template
          ? `Rédigé à partir de la trame « ${esc(nomTrame)} », modifiable librement${lienTrame}`
          : "Le texte du document — il s'écrit ici"}</p>
      </div>
      <div class="fr-panel__actions">
        ${etiquette(propre ? "Propre à ce document" : "Suit la trame", propre ? "success" : "info", "docEtat")}
        ${estActeRendu ? button("Numéroter les considérants", {
          variant: "tertiary", size: "sm", iconName: "list-ordered", action: "dec-numeroter",
          title: "Poser les numéros 1., 2., 3.… devant les considérants, dans l'ordre du texte",
        }) : ""}
        ${estActeRendu ? button("Numéroter les articles", {
          variant: "tertiary", size: "sm", iconName: "list-ordered", action: "dec-numeroter-articles",
          title: "Poser « Article 1er », « Article 2 »… devant les articles du dispositif, dans l'ordre du texte",
        }) : ""}
        ${button("Figer les valeurs", {
          variant: "tertiary", size: "sm", iconName: "lock-line", action: "doc-contenu-figer",
          title: "Remplacer les balises du texte par les valeurs du moment",
          id: "docContenuFigerBtn", hidden: !personnalise,
        })}
        ${button("Revenir à la trame", {
          variant: "tertiary-no-outline", size: "sm", iconName: "arrow-go-back-line", action: "doc-contenu-reinit",
          id: "docContenuReinitBtn", hidden: !propre,
        })}
      </div>
    </div>
    <div class="fr-panel__body">
      ${template ? ui.tabs({
        id: "docVue",
        items: VUES.map((v) => ({ id: v.id, label: v.label, iconName: v.iconName })),
        active: vue,
        label: "Vue de l'espace de rédaction",
      }) : ""}
      ${template ? ui.tabPanel({
        id: "docVue", tab: vue,
        contenu: `${ecriture}
      <p class="fr-hint-text fr-mt-1w fr-mb-0">${esc(hints[vue])}</p>`,
      }) : emptyState(
        "Choisissez d'abord une trame : c'est elle qui apporte le texte du courrier, que vous pourrez ensuite modifier ici.",
        { iconName: "file-text-line" },
      )}
    </div>
  </section>
  <aside class="app-doc__outils${(estActeRendu && considerantsOuverts) || paramsOuverts || variablesOuvertes ? "" : " app-doc__outils--replie"}">
    ${estActeRendu ? outilConsiderants(store, state, {
      ouvert: considerantsOuverts,
      considerants: repertoire(store.db),
    }) : ""}
    ${parametres}
    ${variables}
  </aside>
</div>`;

  // La décision que ce document rédige — celle qui lui est liée, ou, pour une
  // trame qui porte la décision définitive, celle de l'affaire. Elle se saisit
  // ici une seule fois, comme dans l'onglet « Décision » : les balises
  // `{{Decision}}…` du texte la lisent. Seule une trame de format « Décision »
  // en rédige une : une ordonnance n'en a pas.
  const decisionLiee = estDecision && doc.Decision_liee ? ctx.byId("Decisions", doc.Decision_liee) : null;
  const decisionAffaire = affaire ? decisionDefinitiveDe(ctx, affaire) : null;
  const decisionDocument = decisionLiee || (estDecision && decideDefinitive ? decisionAffaire : null);
  const avantDireDroit = Boolean(decisionDocument) && str(decisionDocument.Nature) === NATURE_INTERLOCUTOIRE;
  const regimeSection = regimeOf(section);
  const decidePanel = estDecision && affaire && decisionDocument
    ? panel(avantDireDroit ? "Décision avant dire droit" : "Décision définitive", `
        <p class="fr-text--sm fr-mb-2w">${esc(avantDireDroit
          ? "Elle ne règle que la marche de l'instance : une affaire peut en comporter autant que nécessaire."
          : "Elle tranche le fond : une affaire n'en comporte qu'une.")}</p>
        ${fieldset("Décision", formGrid("Decisions", [
          "Nature", "Sanction", "Decision", "Motivation",
        ], ctx, decisionDocument, {
          store, single: true,
          rowsFor: { Sanction: sanctionsPour(store.db, regimeSection, section) },
          choicesFor: { Decision: decisionsPour(store.db, regimeSection, section, { nature: avantDireDroit ? NATURE_INTERLOCUTOIRE : "" }) },
        }))}
        ${fieldset("Dates et durées", formGrid("Decisions", [
          "Date_du_delibere", "Date_de_notification",
          ...(avantDireDroit ? ["Date_butoir_instruction"] : []),
          "Duree_totale_d_exclusion_mois_", "Duree_d_exclusion_sursis_", "Sursis_",
        ], ctx, decisionDocument, { store }))}
        ${avantDireDroit ? `<p class="fr-hint-text fr-mt-1w fr-mb-0">
          Cette décision règle la marche de l'instance : la date butoir d'instruction, quand elle
          est renseignée, fixe le terme de l'instruction de l'affaire — elle prime sur l'échéance de
          la procédure.
        </p>` : ""}
      `, {
        iconName: "scales-3-line",
        subtitle: "Renseignée une fois pour toutes : elle alimente le document et l'affaire",
        // Le renvoi vers l'atelier n'a lieu d'être que si **ce** document est
        // celui qui rédige la décision : c'est `Decision_liee` qui le dit. Un
        // document de trame « Décision » encore détaché se lie d'abord, ici
        // même (le champ le propose) — l'atelier ouvrirait sinon un second
        // texte pour la même décision.
        actions: (decisionLiee ? button("Rédiger dans l'atelier", {
          variant: "tertiary", size: "sm", iconName: "quill-pen-line",
          attrs: `data-nav="decisions/${decisionLiee.id}"`,
          title: "Ouvrir l'atelier de la décision : visas et formules, considérants, dispositif, contrôles",
        }) : ""),
      })
    : "";

  const infos = panel("Informations reprises", dl([
    ["Numéro d'affaire", affaire ? esc(affaireRef(ctx, affaire)) : "—", true],
    ["Mis en cause", affaire ? esc(affaireName(ctx, affaire)) : "—", true],
    ["Section", section ? esc(str(ctx.v("Sections_disciplinaires", section, "Structure"))) : "—", true],
    ["Ville", esc(str(ctx.v("Generateur", doc, "Ville"))) || "—", true],
    // L'auteur et le destinataire sont programmés sur la trame (voir
    // `blocAuteur` et `blocDestinataire`) : ce rappel dit ce que les balises
    // du document remplissent.
    ["Auteur", esc(str(auteur?.role) || "—"), true],
    ["Destinataire", esc(str(destinataire?.role) || "—"), true],
  ]), {
    iconName: "information-line",
    subtitle: "Ce que les balises de la trame remplissent pour ce document",
    collapsible: true,
  });

  // La sous-vue d'un document ne porte que ce qui rédige et ce qui informe :
  // son en-tête — le fil d'Ariane, le titre, le lien vers l'affaire — est
  // écrit par `viewDocument`.
  //
  // L'échéance d'instruction ouvre l'écran lorsqu'elle a lieu d'être : sur un
  // document qui touche à l'instruction — c'est là qu'on la fixe —, ou sur un
  // document qui rédige la décision avant dire droit qui la reporte.
  const echeance = utiliseButoir || avantDireDroit
    ? echeanceInstruction(store, state, affaire, { compact: true })
    : "";
  return `
${echeance}
${espace}
${decidePanel ? `<div class="fr-mt-2w">${decidePanel}</div>` : ""}
<div class="fr-mt-2w">${infos}</div>`;
}

/* ------------------------------------------------------------------ */
/* Page « Documents » et sous-vue d'un document                        */
/* ------------------------------------------------------------------ */

export function filteredDocuments(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  // Un document appartient à une affaire : le périmètre suit celui de l'affaire.
  let rows = parAffaire(store, state, store.table("Generateur"), (d) => d.Affaire);
  if (f.documentsTrame) rows = rows.filter((d) => Number(d.Template) === Number(f.documentsTrame));
  // Le type de document est le format de sa trame (courrier, attestation,
  // rapport d'instruction, décision…). Filtrer par type répond au geste « où
  // sont mes décisions ? », que la seule trame ne permet pas de faire d'un
  // geste quand elle est déclinée en dix variantes.
  if (f.documentsType) {
    rows = rows.filter((d) => {
      const tpl = d.Template ? store.byId("Trames", d.Template) : null;
      return tpl && String(tpl.Type) === String(f.documentsType);
    });
  }
  if (f.documentsQ) {
    rows = rows.filter((d) => {
      const affaire = store.byId("Affaires", d.Affaire);
      const tpl = d.Template ? store.byId("Trames", d.Template) : null;
      return matches(f.documentsQ,
        affaire ? affaireRef(ctx, affaire) : "",
        affaire ? affaireName(ctx, affaire) : "",
        tpl ? str(ctx.v("Trames", tpl, "Nom_complet")) : "",
        d.L_Destinataire,
        ctx.v("Generateur", d, "Destinataire"));
    });
  }
  return sortRecords(rows, (d) => String(d.Date || ""), "desc");
}

/**
 * La sous-vue d'un document : son espace de rédaction, et lui seul.
 *
 * Elle ne partage la page avec aucune liste : c'est ce qui donne au texte
 * toute la largeur, et ce qui permet d'ouvrir un document depuis l'affaire qui
 * le porte — ou depuis n'importe quelle vue qui le cite — sans quitter la page
 * où on le consulte, ni se voir imposer une colonne étroite.
 */
export function viewDocument(store, state, doc) {
  const ctx = state.ctx;
  const affaire = store.byId("Affaires", doc.Affaire);
  const template = doc.Template ? store.byId("Trames", doc.Template) : null;
  const titre = template ? str(ctx.v("Trames", template, "Nom_complet")) : "Document à composer";
  const objet = template ? str(template.Objet) : "";

  const fil = `
<div class="app-breadcrumb">
  <a href="#documents" data-nav="documents">${icon("arrow-left-line", 'class="fr-mr-1v"')}Documents par affaire</a>
  ${affaire ? `<span aria-hidden="true">›</span><span>${esc(affaireRef(ctx, affaire))} — ${esc(affaireName(ctx, affaire))}</span>` : ""}
</div>`;

  const head = `
${fil}
<div class="app-page-head">
  <div>
    <h1 class="fr-h3">${esc(titre)}</h1>
    <p class="app-page-head__sub">${objet
      ? esc(objet)
      : "Choisissez la trame du courrier dans les paramètres, à droite du texte."}</p>
  </div>
  <div class="app-page-head__actions">
    ${affaire ? button("Ouvrir l'affaire", {
      variant: "tertiary",
      size: "sm",
      iconName: "folder-2-line",
      attrs: `data-open="affaires" data-select-table="Affaires" data-select="${affaire.id}" data-open-tab="documents"`,
    }) : ""}
    ${button("Supprimer le document", {
      variant: "tertiary",
      size: "sm",
      iconName: "delete-bin-line",
      attrs: `data-delete="Generateur:${doc.id}"`,
    })}
  </div>
</div>`;

  return `${head}
${documentEditor(store, state, doc)}`;
}

/**
 * Les dossiers de la page « Documents » : une affaire, un dossier.
 *
 * Les affaires sont celles de la liste des affaires — le périmètre de
 * visibilité s'applique — et suivent le même ordre (saisine la plus récente
 * d'abord) : la page se lit donc comme la liste des affaires, chacune portant
 * ses courriers et décisions. Une affaire qui n'a pas encore de document garde
 * son dossier : c'est là qu'on en crée un.
 *
 * Dès qu'un filtre est actif (recherche ou trame), les dossiers se resserrent :
 * seuls ceux qui portent un document correspondant sont montrés, et l'ordre
 * suit le document le plus récent de chacun — c'est ce que l'on cherche quand
 * on filtre.
 */
function dossiersDeDocuments(store, state) {
  const parAffaire = new Map();
  for (const d of filteredDocuments(store, state)) {
    const id = Number(d.Affaire) || 0;
    if (!parAffaire.has(id)) parAffaire.set(id, []);
    parAffaire.get(id).push(d);
  }
  if (state.filters.documentsQ || state.filters.documentsTrame || state.filters.documentsType) {
    return [...parAffaire.entries()]
      .map(([id, docs]) => ({ affaire: store.byId("Affaires", id) || null, docs }))
      .sort((a, b) => String(b.docs[0]?.Date || "").localeCompare(String(a.docs[0]?.Date || "")));
  }
  const affaires = sortRecords(
    affairesVisibles(store, state, store.table("Affaires")),
    (a) => String(a.Date_de_saisine || ""), "desc");
  const dossiers = affaires.map((a) => ({ affaire: a, docs: parAffaire.get(a.id) || [] }));
  // Un document rattaché à une affaire disparue ne passe pas à la trappe : il
  // forme son propre dossier, à la fin.
  if (parAffaire.has(0)) dossiers.push({ affaire: null, docs: parAffaire.get(0) });
  return dossiers;
}

/**
 * Le dossier d'une affaire : son en-tête (numéro, nom, état), ses documents, et
 * le geste qui en crée un — le même que dans l'onglet « Documents » de
 * l'affaire. La ligne d'un document ne répète donc pas le numéro de l'affaire :
 * c'est le titre du dossier.
 *
 * `repliable` en fait une carte **repliée**, avec son compte et son état dans
 * l'en-tête : lorsque la page porte beaucoup de dossiers, l'accordéon donne la
 * liste des affaires d'un coup d'œil, et l'on ouvre celle que l'on cherche. Les
 * deux gestes du dossier (créer un document, ouvrir l'affaire) restent, mais
 * passent dans le corps du dossier : ils ne s'adressent qu'au dossier ouvert.
 */
function dossierPanel(store, state, { affaire, docs }, { repliable = false } = {}) {
  const ctx = state.ctx;
  const titre = affaire
    ? `${affaireRef(ctx, affaire)} — ${affaireName(ctx, affaire)}`
    : "Sans affaire";
  const compte = `${docs.length} document${docs.length > 1 ? "s" : ""}`;
  const sousTitre = affaire
    ? `${compte}${affaire.Etat ? ` — ${affaire.Etat}` : ""}`
    : `${compte} — rattachés à aucune affaire`;
  const liste = docs.length
    ? `<div class="app-list app-list--grille">${docs.map((d) => {
        const tpl = d.Template ? store.byId("Trames", d.Template) : null;
        return documentItem(store, ctx, d, {
          avecAffaire: false,
          ref: esc(tpl ? str(ctx.v("Trames", tpl, "Type_court_")) || str(tpl.Nom) : "Sans trame"),
          name: esc(tpl ? str(tpl.Objet) || str(tpl.Nom) : "Trame à choisir"),
        });
      }).join("")}</div>`
    : emptyState("Aucun document dans ce dossier pour l'instant.", { iconName: "printer-line" });
  // Un dossier ne porte pas de « Nouveau document » : la page en a un, en tête,
  // et l'affaire se choisit dans son formulaire. Sept dossiers faisaient sept
  // fois le même bouton, à côté du même. « Ouvrir l'affaire », lui, reste — il
  // ne fait qu'aller au dossier — et ne se montre qu'au survol du panneau (voir
  // `.app-documents__dossier`).
  const actions = affaire
    ? button("Ouvrir l'affaire", {
        variant: "tertiary", size: "sm", iconName: "folder-2-line",
        attrs: `data-open="affaires" data-select-table="Affaires" data-select="${affaire.id}" data-open-tab="documents"`,
      })
    : "";
  if (repliable) {
    return panel(titre, `${actions ? `<div class="app-row fr-mb-2v">${actions}</div>` : ""}${liste}`, {
      iconName: "folder-2-line",
      subtitle: sousTitre,
      collapsible: true,
      class: "app-documents__dossier",
    });
  }
  return panel(titre, liste, { iconName: "folder-2-line", subtitle: sousTitre, actions, class: "app-documents__dossier" });
}

/**
 * Les trames que le filtre de la page « Documents » a lieu de proposer.
 *
 * Le filtre ne range que les dossiers visibles : il ne doit donc offrir que
 * les trames qui concernent ces dossiers. Deux ensembles, réunis :
 *
 *  - les trames **applicables aux sections des affaires du périmètre** — un
 *    secrétaire d'une section compétente à l'égard des usagers ne voit pas,
 *    dans le filtre, les trames réservées aux enseignants-chercheurs, qui ne
 *    concernent aucun de ses dossiers ;
 *  - les trames qu'un document du périmètre **emploie** déjà, pour qu'un filtre
 *    actif reste sélectionnable même si sa trame n'est plus proposée par
 *    ailleurs.
 */
function tramesFiltrables(store, state, courant = "") {
  const permises = new Set();
  for (const a of affairesVisibles(store, state, store.table("Affaires"))) {
    const section = a.Section ? store.byId("Sections_disciplinaires", a.Section) : null;
    if (!section) continue;
    for (const t of trameOptions(store, section)) permises.add(Number(t.id));
  }
  for (const d of parAffaire(store, state, store.table("Generateur"), (x) => x.Affaire)) {
    if (d.Template) permises.add(Number(d.Template));
  }
  if (courant) permises.add(Number(courant));
  return store.table("Trames").filter((t) => permises.has(Number(t.id)));
}

/**
 * La page « Documents » : les affaires, et sous chacune ses courriers.
 *
 * Une affaire est un dossier : les documents n'y sont plus donnés en vrac,
 * mais rangés par affaire. La rédaction se fait toujours dans la sous-vue du
 * document, que chaque ligne ouvre ; la suppression, elle, se fait depuis la
 * ligne (page des documents, ou onglet « Documents » d'une affaire), après
 * confirmation.
 */
export function viewDocuments(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  const trames = tramesFiltrables(store, state, f.documentsTrame);
  const restreint = perimetreRestreint(store, state);
  const mention = mentionPerimetre(store, state);
  const dossiers = dossiersDeDocuments(store, state);
  const nombre = dossiers.reduce((n, d) => n + d.docs.length, 0);
  const filtre = !!(f.documentsQ || f.documentsTrame || f.documentsType);
  const types = store.table("Types_Trames");
  // Les dossiers vides ne méritent pas chacun une carte : ils tiennent en une
  // ligne, dans un panneau replié. La page se lit donc d'abord comme la liste
  // des affaires **qui ont des documents**.
  const pleins = dossiers.filter((d) => d.docs.length);
  const vides = dossiers.filter((d) => !d.docs.length);
  // Au-delà de six dossiers, l'accordéon : la page donne d'abord la liste des
  // affaires, et l'on ouvre le dossier que l'on cherche.
  const replie = pleins.length > 6;

  const head = `
<div class="app-page-head">
  <div>
    <p class="app-kicker">${restreint ? "Mes dossiers" : "Documents"}</p>
    <h1 class="fr-h3">Documents par affaire</h1>
    <p class="app-page-head__sub">${restreint
      ? "Les dossiers des affaires qui vous sont attribuées : chaque affaire réunit ses courriers et décisions."
      : "Un dossier par affaire : chaque affaire réunit ses courriers et décisions, et l'on y crée les suivants."}</p>
  </div>
  <div class="app-page-head__actions">
    ${button("Nouveau document", { variant: "primary", iconName: "add-line", action: "new-document" })}
    ${exportMenu({
      items: exportTableItems({
        table: "Generateur",
        rows: dossiers.flatMap((d) => d.docs),
        titre: "Télécharger la liste des documents affichés, dossiers et filtres compris",
      }),
    })}
  </div>
</div>
${mention ? ui.alert("info", "Périmètre restreint", mention) : ""}`;

  // Les filtres resserrent les dossiers et ce qu'ils contiennent : la recherche
  // porte sur l'affaire, le destinataire et la trame du document.
  const filtres = `
    <div class="app-filters">
      <div class="app-search">
        <label class="fr-label" for="documentsQ">Rechercher</label>
        <input class="fr-input" type="search" id="documentsQ" data-filter="documentsQ"
          value="${esc(f.documentsQ || "")}" placeholder="Affaire, destinataire, trame…">
      </div>
      <div class="fr-select-group app-select-inline">
        <label class="fr-label" for="documentsTrame">Trame</label>
        <select class="fr-select" id="documentsTrame" data-filter="documentsTrame">
          <option value="">Toutes les trames</option>
          ${trames.map((t) => `<option value="${t.id}" ${String(f.documentsTrame) === String(t.id) ? "selected" : ""}>${esc(str(ctx.v("Trames", t, "Nom_complet")))}</option>`).join("")}
        </select>
      </div>
      ${types.length ? `<div class="fr-select-group app-select-inline">
        <label class="fr-label" for="documentsType">Type de document</label>
        <select class="fr-select" id="documentsType" data-filter="documentsType">
          <option value="">Tous les types</option>
          ${types.map((t) => `<option value="${t.id}" ${String(f.documentsType) === String(t.id) ? "selected" : ""}>${esc(str(t.Nom))}</option>`).join("")}
        </select>
      </div>` : ""}
    </div>`;

  const listeVide = panel("Dossiers", emptyState(
    filtre
      ? "Aucun dossier ne porte de document correspondant à ce filtre."
      : "Aucun dossier : chaque affaire est un dossier, et aucune affaire n'est encore enregistrée.",
    {
      iconName: "folder-2-line",
      action: filtre ? "" : button("Nouvelle affaire", { variant: "primary", iconName: "add-line", action: "new-affaire" }),
    },
  ), { iconName: "folder-2-line" });

  const videsPanel = vides.length ? panel(
    `${vides.length} affaire${vides.length > 1 ? "s" : ""} sans document`,
    `<p class="fr-text--sm fr-text-mention--grey fr-mt-0 fr-mb-2w">
      Ces affaires n'ont pas encore de courrier. Créez-en un ici, ou ouvrez le dossier de l'affaire.
    </p>
    <div class="app-list app-list--grille">
      ${vides.map(({ affaire }) => affaire ? `
      <div class="app-list__item app-list__item--statique">
        <span class="app-list__top">
          <span class="app-list__ref">${esc(affaireRef(ctx, affaire))}</span>
          ${affaire.Etat ? badge(affaire.Etat) : ""}
        </span>
        <span class="app-list__name">${esc(affaireName(ctx, affaire))}</span>
        <span class="app-list__meta">
          ${button("Nouveau document", {
            variant: "tertiary-no-outline", size: "sm", iconName: "add-line",
            action: "add-document", attrs: `data-affaire="${affaire.id}"`,
          })}
          ${button("Ouvrir l'affaire", {
            variant: "tertiary-no-outline", size: "sm", iconName: "folder-2-line",
            attrs: `data-open="affaires" data-select-table="Affaires" data-select="${affaire.id}" data-open-tab="documents"`,
          })}
        </span>
      </div>` : "").join("")}
    </div>`,
    {
      iconName: "folder-2-line",
      collapsible: true,
      subtitle: "Ces dossiers s'ouvrent comme les autres ; le panneau les tient hors du chemin tant qu'on n'en a pas besoin.",
    },
  ) : "";

  const liste = dossiers.length
    ? `<div class="app-stack" data-scroll="documentList">${pleins.map((d) => dossierPanel(store, state, d, { repliable: replie })).join("")}</div>${videsPanel ? `<div class="fr-mt-2w">${videsPanel}</div>` : ""}`
    : listeVide;

  return `
${head}
${panel("Documents", filtres, {
    iconName: "printer-line",
    subtitle: `${nombre} document(s) dans ${dossiers.length} dossier(s) — chaque dossier est une affaire`,
  })}
<div class="fr-mt-3w">${liste}</div>`;
}
