// Amorçage de l'application, coquille DSFR et gestion des interactions.
//
// Architecture : un état unique (`state`) décrit la page courante, la
// sélection et les filtres ; `render()` reconstruit la coquille complète dans
// `#app` à partir de cet état, puis restaure le focus, le défilement de la page
// et celui des zones défilantes (`captureView` / `restoreView`) : terminer la
// saisie d'un champ ne doit jamais renvoyer l'utilisateur en haut de la page.
// Tous les événements sont délégués depuis `#app`.

import { alignerChamps, suivreAlignement } from "./alignement.js";
import { suivreMenus } from "./menus.js";
import { majEnteteDefilant, suivreEnteteDefilant } from "./entete-defilant.js";
import { monterSelectsRecherche } from "./select-recherche.js";
import { appliquerCharte, marqueEtat, policeDocumentEmbarquee, policeDocumentNom } from "./charte.js";
import { BALISE_CORPS, NAV, NATURE_INTERLOCUTOIRE, SCHEMA, FICHES_SUBS, deplacementsTramesPresident, FORMAT_ORDONNANCE_PRESIDENT_SECTION, FORMAT_ORDONNANCE_PRESIDENT_FORMATION, estSusceptibleDeRecours } from "./schema.js";
import { Context, affairesDeJonction, aujourdHui, formatDateSaisie, jonctionDe, nextNumero, parseDateSaisie } from "./formulas.js";
import { Store, journaliser, loadPrefs, occupationStockage, savePrefs, setStockageReporter } from "./store.js";
import { LEGACY_ROLES_INTERVENANT } from "./legacy.js";
import { affairePorteuseDeLaDecision, decisionDefinitiveDe, decisionsDefinitivesDe, parametresParDefaut, planAlignementCatalogue, seuil } from "./regimes.js";
import { compteAlignement, contenusLivres, detailAlignement, planAlignementContenus, planEstVide, signatureContenus } from "./contenus.js";
import { juridictionRecours, qualiteIntervenant } from "./procedure.js";
import { FEUILLE_VIERGE, TRAMES_PAR_DEFAUT, TYPES_TRAMES_PAR_DEFAUT, tramesParDefautManquantes, typesTramesParDefautManquants } from "./trames-defaut.js";
import { ROLE_IDS, can, canSettings, canWrite, currentRole, localUser, roleBadgeClass, roleLabel, splitName, unknownGristUser, userName } from "./roles.js";
import { VOIR_TOUT, affaireVisible, affairesVisibles, mesFiches, peutVoirTout, perimetreRestreint } from "./visibilite.js";
import * as ui from "./ui.js";
import { renderPage } from "./views/index.js";
import { debugAllowed } from "./views/debug.js";
import { bandeauEnvironnement, declarerDocumentGrist, enRecette } from "./environnement.js";
import { CHAMP_DOSSIER, hoteDossier, lienDossier, urlDossier } from "./dossier.js";
import { computeDocumentParts, documentBody, documentScope, freezeDocumentBody, setAssetBase } from "./render.js";
import {
  checkStructure, connectGrist, definirOriginesGristDeclarees, demanderEnvoiImmediat, disableGristWrites, documentReadOnly, documentTables, enableGristWrites, gristApiUrl, installStructure,
  likelyGrist, loadGristApi, logDiagnostic, nestedFrame, oublierEcritures, pendingWriteCount, pendingWriteTables,
  refresh as gristRefresh, reprendreOutbox, resetGristApi, resolveGristUser, retryPendingWrites, setWriteReporter,
  widgetAccessLevel,
} from "./grist-backend.js";
import { diagnosticReport } from "./diagnostic.js";
import { analyserSource, appliquerImport, resumeImport } from "./import.js";
import { construireSource, lireFichier, lireTexte } from "./import-fichiers.js";
import { filteredAffaires } from "./views/affaires.js";
import { attribuables } from "./views/attribution.js";
import { trameOptions } from "./views/documents.js";
import { previewTrame, previewType } from "./views/reglages.js";
import { basculerEffet, commandeRetrait, currentEditor, delaverPastilles, editorToHtml, htmlCanonique, imageHtml, insertHtml, mountWysiwyg, pageBreakHtml, refreshToolbar, tableHtml } from "./editor.js";
import { CONSIDERANTS_LIVRES, intertitreDe, listeTags, repertoire } from "./considerants.js";
import { documentDeDecision, echafaudageDecision, formuleDe, tramePourDecision } from "./formules-decision.js";
import {
  considerantDepuisFormulaire, considerantModal, insererConsiderant, insererFragment,
  monterAtelierDecision, numeroterArticles, numeroterConsiderants, retraitConsiderants,
} from "./views/decision-redaction.js";
import { buildExport, downloadBlob, exportSite, zipStore } from "./export.js";
import { COLONNES_ACTES, numeroerActes, registreActes } from "./actes.js";
import { evenementsCalendrier, icalCalendrier, nomFichierIcal, nomPerimetre } from "./calendrier.js";
import { exportDocument, fileSlug } from "./export-doc.js";
import { anonymiserDocument } from "./anonymat.js";
import { analyserCsvMembres, csvMembresDeLaSection, importerMembres, modeleCsvMembres } from "./membres-csv.js";
import { classeurXlsx, csvDeTableau, exportBaseFichier, exportTableauFichier, nomFichier, tableauExport } from "./export-table.js";
import { openPrintWindow, roleSeanceHtml, listeAffairesHtml, rapportActiviteHtml } from "./print.js";
import { rapportActivite } from "./rapport.js";
import { graphiquePng } from "./graphiques.js";
import { abandonGristTheme, applyStoredTheme, fullscreenButtonHtml, gristLiaisonEstablished, themeButtonHtml, toggleFullscreen, toggleTheme, watchDisplay, watchGristTheme } from "./affichage.js";

const { esc, str, icon } = ui;

const store = new Store();
const prefs = loadPrefs();

/* Titre et sous-titre du service, affichés dans l'en-tête par `ui.brandBlock`. */
const SERVICE_TITLE = "Gestion des sections disciplinaires";
const SERVICE_TAGLINE = "Suivi des affaires, composition des commissions et génération des documents";

/* Délai au-delà duquel l'identification de l'utilisateur ne retient plus
   l'affichage (voir `identifyUser`) : Grist répond en quelques centaines de
   millisecondes, et un document muet ne doit pas laisser l'outil sur son écran
   d'attente. */
const IDENTITY_DEADLINE_MS = 8000;

/* Taille maximale d'un logo déposé depuis un poste (l'image est alors
   enregistrée dans la base, sur le même chemin que les autres données). */
const LOGO_MAX_BYTES = 512 * 1024;

/* ------------------------------------------------------------------ */
/* État et routage                                                     */
/* ------------------------------------------------------------------ */

function validPage(p) { return NAV.some((n) => n.id === p); }
function pageDef(p) { return NAV.find((n) => n.id === p) || null; }
function subsOf(p) { return pageDef(p)?.subs || null; }

/**
 * L'onglet « Documents » a une seule sous-vue : celle d'un document. Son
 * sous-chemin d'adresse porte donc l'identifiant du document — `#documents/12`
 * — et non le nom d'une vue : c'est cette adresse qui donne à chaque document
 * son espace de rédaction propre, ouvrable depuis n'importe quelle vue qui le
 * cite. Renvoie `null` si le document n'existe pas (le lien est alors mort :
 * mieux vaut la liste que rien).
 */
function documentSubId(value) {
  return ficheId("Generateur", value);
}

/**
 * L'onglet « Décisions » a lui aussi une sous-vue : l'atelier de rédaction d'une
 * décision (`#decisions/12`). L'adresse d'une décision se copie donc, s'ouvre
 * dans un nouvel onglet et survit au rechargement, exactement comme celle d'un
 * document — et la décision citée ailleurs s'ouvre là où elle s'écrit. `null`
 * si la décision n'existe pas : le lien est alors mort, mieux vaut le registre.
 */
function decisionSubId(value) {
  return ficheId("Decisions", value);
}

/**
 * Identifiant d'une fiche cité dans une adresse. Les identifiants locaux d'une
 * base reliée à Grist sont négatifs tant que le document n'a pas répondu (voir
 * `Store.nextId`) : ils sont donc admis comme les autres. Le seul critère est
 * que la fiche existe — une adresse morte ramène à la liste.
 */
function ficheId(table, value) {
  const id = Number(value);
  return Number.isInteger(id) && id !== 0 && store.byId(table, id) ? String(id) : null;
}

/**
 * Sous-vues « fiche » de l'onglet Réglages : leur adresse mène à une ligne
 * précise — la trame 7, le type 3 — plutôt qu'à la vue qui les range. Comme
 * pour les documents, c'est cette adresse qui donne à la rédaction son espace
 * propre, et qui permet de citer une trame depuis une autre vue. Le sous-chemin
 * de la page restant pris par le nom de la vue (`reglages/trames`), la fiche
 * est le troisième segment : `reglages/trames/7`. Le tableau des sous-pages
 * concernées est dans `schema.js` (`FICHES_SUBS`).
 */
function reglagesFicheId(sub, value) {
  const table = FICHES_SUBS[sub];
  return table ? ficheId(table, value) : null;
}

/**
 * Adresse de l'état courant, sans le « # ». Le troisième segment n'existe que
 * lorsqu'une fiche est ouverte : c'est lui qui fait la différence entre le
 * rangement (`reglages/trames`) et l'espace de rédaction (`reglages/trames/7`).
 */
function hashOf(s) {
  return [s.page, s.sub, s.fiche].filter((p) => p !== null && p !== undefined && p !== "").join("/");
}

/**
 * Redressement d'une adresse antérieure à un déménagement de page. « Séances » a
 * été un onglet du menu, avant que le calendrier ne devienne la page du temps —
 * où les séances sont l'une des deux vues (voir `NAV`, schema.js). Les adresses
 * antérieures restent valables : un signet posé la veille ne doit pas mourir, et
 * un lien partagé avec un collègue non plus.
 *
 *   · `#seances` (l'onglet) et `#seances/liste` (sa sous-page) → les séances ;
 *   · `#seances/calendrier` (l'ancienne sous-page du calendrier) → les échéances.
 */
function corrigerRoute(page, sub, fiche) {
  if (page === "seances") {
    return { page: "calendrier", sub: sub === "calendrier" ? "echeances" : "seances", fiche: null };
  }
  return { page, sub, fiche };
}

function initialRoute() {
  const raw = (location.hash || "").replace(/^#/, "");
  let [page, sub, fiche] = raw.split("/");
  // Une adresse antérieure désigne encore une page : elle est redressée
  // **avant** d'être jugée, sans quoi elle paraîtrait morte.
  ({ page, sub, fiche } = corrigerRoute(page, sub, fiche));
  const adresse = validPage(page);
  if (!adresse) {
    page = validPage(prefs.page) ? prefs.page : "tableau-de-bord";
    sub = prefs.sub;
    fiche = prefs.fiche;
  }
  // Puis la page reprise des préférences, qui peut venir du même découpage.
  ({ page, sub, fiche } = corrigerRoute(page, sub, fiche));
  if (page === "documents") return { page, sub: documentSubId(sub), fiche: null };
  if (page === "decisions") return { page, sub: decisionSubId(sub), fiche: null };
  const subs = subsOf(page);
  if (subs) {
    // Adresse explicite sans sous-page (`#tableau-de-bord`) : elle ramène au
    // premier onglet — c'est le geste « revenir à l'accueil de l'outil ». Un
    // rechargement, lui, reprend la sous-page mémorisée (voir `prefs.sub`).
    const defaut = adresse && page === "tableau-de-bord"
      ? subs[0].id
      : (subs.some((s) => s.id === prefs.sub) ? prefs.sub : subs[0].id);
    if (!subs.some((s) => s.id === sub)) sub = defaut;
  } else {
    sub = null;
  }
  return { page, sub, fiche: page === "reglages" ? reglagesFicheId(sub, fiche) : null };
}

const route = initialRoute();

const state = {
  page: route.page,
  sub: route.sub,
  // Fiche ouverte dans la sous-vue du Réglages courant (`reglages/trames/7`) :
  // `null` tant qu'on regarde le rangement.
  fiche: route.fiche,
  sel: { ...(prefs.sel || {}) },
  filters: { ...(prefs.filters || {}) },
  tabs: {},
  draft: { affaire: {}, personne: {}, document: {}, considerant: {}, dossier: {} },
  // Vue « Attribution » : cases cochées et secrétaire visé, le temps d'un lot.
  attribution: { ids: [], cible: "" },
  // Registre des trames : cases cochées le temps d'un lot (mise à la corbeille).
  trames: { ids: [] },
  // Fiche d'une affaire : blocs ouverts à la modification, le temps de la
  // visite. Une fiche se lit d'abord ; le bouton « Modifier » d'un bloc le
  // bascule en saisie (voir `fieldset` dans ui.js).
  affaires: { edition: {} },
  affaireStep: 1,
  modal: null,
  grist: false,
  gristError: "",
  gristErrorCode: "",
  gristWriteError: "",
  gristMissingColumns: [],
  // NC-0024 : dernier échec d'enregistrement dans le stockage du navigateur.
  stockageErreur: "",
  // NC-0025 : rapport de la dernière vérification de la livraison (onglet Debug).
  verification: "",
  verificationOk: null,
  structure: null,
  user: localUser(),
  // Mode autonome uniquement : rôle et nom simulés depuis l'onglet Debug.
  embedded: false,
  debugRole: null,
  debugName: "",
  debugEmail: "",
  ctx: null,
};

/** L'utilisateur courant peut-il modifier les données ? */
function readOnly() {
  return !canWrite(state);
}

/** Libellé du rôle affiché dans l'en-tête. */
function roleOf() {
  return currentRole(state);
}

function persistPrefs() {
  prefs.page = state.page;
  prefs.sub = state.sub;
  prefs.fiche = state.fiche;
  prefs.sel = state.sel;
  // La recherche de la page Aide ne se mémorise pas : c'est une question qu'on
  // pose une fois, et non un réglage. La garder d'une visite à l'autre rouvrait
  // toutes les sections du guide à la première ouverture suivante — la page
  // faisait alors vingt mille pixels.
  const filtres = { ...state.filters };
  delete filtres.aideQ;
  prefs.filters = filtres;
  savePrefs(prefs);
}

/** Mémorise le rôle simulé et le nom forcé de l'onglet Debug. */
function persistDebugPrefs() {
  prefs.debugRole = state.debugRole || "";
  prefs.debugName = state.debugName || "";
  prefs.debugEmail = state.debugEmail || "";
  savePrefs(prefs);
}

function navTo(hash) {
  const [p, s, f] = String(hash || "").split("/");
  const { page, sub, fiche } = corrigerRoute(p, s, f);
  if (!validPage(page)) return;
  state.page = page;
  // « Documents » est le seul onglet dont le sous-chemin désigne une fiche et
  // non une vue : aller à `#documents` ramène donc toujours à la liste, quand
  // `#documents/12` ouvre l'espace de rédaction du document 12.
  if (page === "documents") {
    state.sub = documentSubId(sub);
    state.fiche = null;
  } else if (page === "decisions") {
    // Même règle pour les décisions : `#decisions` ouvre le registre,
    // `#decisions/12` l'atelier de rédaction de la décision 12.
    state.sub = decisionSubId(sub);
    state.fiche = null;
  } else {
    const subs = subsOf(page);
    if (subs) {
      // « Tableau de bord » sans sous-page ramène à la synthèse : c'est le lien
      // d'accueil (bloc-marque, fil d'Ariane). Les autres onglets gardent la
      // sous-page où l'on était.
      const defaut = page === "tableau-de-bord" && !sub ? subs[0].id : state.sub;
      state.sub = subs.some((s) => s.id === sub) ? sub
        : (subs.some((s) => s.id === defaut) ? defaut : subs[0].id);
    } else {
      state.sub = null;
    }
    // Troisième segment : la fiche ouverte dans la sous-vue (`reglages/trames/7`).
    // Il ne vaut que pour l'onglet Réglages, dont le sous-chemin est déjà pris.
    state.fiche = page === "reglages" ? reglagesFicheId(state.sub, fiche) : null;
  }
  state.modal = null;
  persistPrefs();
  const h = hashOf(state);
  if (location.hash !== `#${h}`) history.replaceState(null, "", `#${h}`);
  render({ keepFocus: false });
}

window.addEventListener("hashchange", () => {
  const raw = (location.hash || "").replace(/^#/, "");
  if (raw && raw !== hashOf(state)) navTo(raw);
});

/* ------------------------------------------------------------------ */
/* Coquille                                                            */
/* ------------------------------------------------------------------ */

/**
 * Bandeau d'alerte de la liaison Grist. Rien n'est plus trompeur qu'une
 * modification qui semble enregistrée : chaque panne (structure illisible,
 * droits d'écriture refusés, écriture rejetée par le document) est donc
 * annoncée ici, avec ce qu'il faut faire pour la lever.
 */
function gristNotice() {
  const notices = [];
  if (state.grist === "error") {
    // Deux causes très différentes produisent la même panne, et n'appellent
    // pas le même geste : soit le document n'a pas les tables de l'outil (il
    // faut les installer), soit le widget n'a pas l'accès complet — ou son
    // adresse est celle d'une page qui contient l'outil (cadre imbriqué),
    // auquel cas l'API Grist, qui ne répond qu'à son parent immédiat, reste
    // muette.
    const sansTables = state.gristErrorCode === "MISSING_TABLES";
    const imbrique = nestedFrame()
      ? " L'outil est de plus affiché dans un cadre imbriqué : l'API du widget Grist ne répond qu'à son "
        + "parent immédiat. Dans l'option « Enter Custom URL » du widget, collez l'adresse du site "
        + "lui-même, et non celle d'une page qui le contient."
      : "";
    const action = sansTables
      ? "Les tables attendues peuvent être créées d'un clic (elles n'existent pas encore dans ce document) : "
        + "les données déjà saisies ici ne sont pas transférées."
      : "Vérifiez que le widget a bien le droit d'écriture (options du widget : « Full document access »), "
        + "puis rechargez la page.";
    notices.push(ui.alert("warning", "Document Grist non relié",
      `Les tables du document n'ont pas pu être lues : les modifications restent dans ce navigateur. ${state.gristError || ""} `
      + `${action}${imbrique}`,
      `<div class="app-row fr-mt-1w">
        ${sansTables ? '<button type="button" class="fr-btn fr-btn--sm" data-action="grist-install">Installer la structure dans le document</button>' : ""}
        <button type="button" class="fr-btn fr-btn--sm${sansTables ? " fr-btn--secondary" : ""}" data-action="grist-retry">Réessayer la liaison</button>
      </div>`));
  } else if (state.grist === "connected" && widgetAccessLevel && widgetAccessLevel !== "full") {
    notices.push(ui.alert("warning", "Le document Grist n'accorde pas le droit d'écriture",
      `Niveau accordé au widget : « ${widgetAccessLevel} ». Dans les options du widget, choisissez `
      + "« Full document access », puis rechargez la page : sans cela, aucune modification ne peut être enregistrée."));
  }
  if (state.grist === "connected" && state.gristMissingColumns.length) {
    const shown = state.gristMissingColumns.slice(0, 6).join(", ");
    const reste = state.gristMissingColumns.length > 6
      ? `, … (${state.gristMissingColumns.length} au total)` : "";
    notices.push(ui.alert("warning", "Le document Grist est incomplet",
      `${state.gristMissingColumns.length} élément(s) attendu(s) par l'outil manquent dans le document : `
      + `${shown}${reste}. Les enregistrements portant sur ces champs sont refusés par Grist, et une formule `
      + "du document qui s'y réfère peut échouer à chaque modification. « Compléter la structure » crée les "
      + "éléments manquants, sans toucher aux données existantes."
      + (documentReadOnly() ? " À faire une fois que le document acceptera de nouveau les modifications." : ""),
      documentReadOnly() ? "" : `<div class="app-row fr-mt-1w">
        <button type="button" class="fr-btn fr-btn--sm" data-action="grist-install">Compléter la structure</button>
      </div>`));
  }
  if (state.grist === "connected" && documentReadOnly()) {
    // Cause très différente des précédentes, et qu'il faut nommer : le serveur
    // Grist lui-même retient le document en lecture seule. Le rôle de la
    // personne n'est pas en cause (Grist le précise : « seules les
    // modifications sont touchées »), et aucun réglage de l'outil n'y changera
    // rien — d'où le renvoi vers Grist, seul endroit où la raison est exposée.
    notices.push(ui.alert("error", "Le document Grist est en lecture seule",
      "Grist refuse toute modification de ce document : « No write access, document is read-only ». "
      + "Ce n'est ni un manque de droits de votre part (votre rôle est inchangé), ni un réglage de "
      + "l'outil : le serveur Grist retient le document en lecture seule — site d'équipe suspendu, "
      + "abonnement ou plan dépassé, ou instance en accès restreint. La lecture fonctionne, mais les "
      + "saisies faites ici restent dans ce navigateur. Ouvrez le document dans Grist : une bannière y "
      + "indique la raison à traiter. Une fois corrigée, revenez ici et rechargez la page.",
      `<div class="app-row fr-mt-1w">
        <button type="button" class="fr-btn fr-btn--sm" data-action="grist-retry">Réessayer la liaison</button>
      </div>`));
  } else if (state.gristWriteError) {
    notices.push(ui.alert("error", "Les modifications ne sont pas enregistrées dans le document",
      `${state.gristWriteError}${writeErrorHint()} Les données saisies restent dans ce navigateur. `
      + "Vérifiez que le widget a bien le droit d'écriture (options du widget : « Full document access »), "
      + "puis renvoyez les modifications : elles sont retenues ici tant que la page reste ouverte."
      + attenteMessage(), attenteActions()));
  }
  if (state.outbox && (state.outbox.rejouables || state.outbox.conflits.length)) {
    const { rejouables, conflits } = state.outbox;
    const tables = [...new Set(conflits.map((a) => a.table))].slice(0, 4).join(", ");
    notices.push(ui.alert("warning", "Des modifications n'avaient pas atteint le document",
      (rejouables
        ? `${rejouables} modification(s) faite(s) avant le rechargement de la page n'avaient pas encore été envoyées au document : elles sont de retour à l'écran, vérifiez-les puis renvoyez-les. `
        : "")
      + (conflits.length
        ? `${conflits.length} autre(s) ne peuvent pas être renvoyée(s) : la ligne a disparu du document ou a changé depuis${tables ? ` (${tables})` : ""}. `
        : "")
      + "Tant que ce bandeau est affiché, quitter la page les effacerait : emportez une copie ou abandonnez-les.",
      `<div class="app-row fr-mt-1w">`
      + (rejouables ? `<button type="button" class="fr-btn fr-btn--sm" data-action="grist-retry-writes">Renvoyer les modifications</button>` : "")
      + `<button type="button" class="fr-btn fr-btn--sm fr-btn--secondary" data-action="export">Télécharger une copie (JSON)</button>`
      + `<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline" data-action="outbox-abandonner">Abandonner</button>`
      + `</div>`));
  }

  // NC-0024 : l'échec d'enregistrement dans le navigateur — le stockage local
  // est plein. La panne est silencieuse par nature ; ce bandeau est le seul
  // endroit qui l'explique. On propose d'emporter une copie et les deux
  // remèdes : le mode session (rien sur le poste) ou la liaison Grist.
  if (state.stockageErreur) {
    notices.push(ui.alert("error", "Les modifications ne sont pas enregistrées sur ce poste",
      `${state.stockageErreur} Les saisies déjà faites restent visibles tant que cette page reste ouverte, `
      + "mais elles seraient perdues à sa fermeture. Téléchargez une copie (JSON) pour les conserver, puis "
      + "libérez de la place : activez le mode session ou reliez l'outil à un document Grist (Réglages › Données).",
      `<div class="app-row fr-mt-1w">
        <button type="button" class="fr-btn fr-btn--sm" data-action="export">Télécharger une copie (JSON)</button>
        <a class="fr-btn fr-btn--sm fr-btn--secondary" href="#reglages/donnees" data-nav="reglages/donnees">Ouvrir Réglages › Données</a>
      </div>`));
  } else {
    // Avertissement d'occupation (NC-0024) : prévenir avant que le plafond ne
    // soit atteint, tant que les gestes sont encore possibles. Masqué en mode
    // session, où rien n'est conservé sur le poste.
    const occ = occupationStockage();
    if (store.mode === "local" && !store.modeSession && occ.niveau !== "normal") {
      const pct = Math.round(occ.ratio * 100);
      notices.push(ui.alert(occ.niveau === "critique" ? "error" : "warning",
        occ.niveau === "critique" ? "Le stockage du navigateur est presque plein" : "Le stockage du navigateur se remplit",
        `La base occupe environ ${pct} % de l'espace de stockage du navigateur (${Math.round(occ.quota / 1024 / 1024)} Mio). `
        + "Au-delà du plafond, les modifications ne seraient plus enregistrées. Exportez une sauvegarde, puis "
        + "activez le mode session ou reliez l'outil à un document Grist (Réglages › Données).",
        `<div class="app-row fr-mt-1w">
          <button type="button" class="fr-btn fr-btn--sm" data-action="export">Télécharger une copie (JSON)</button>
        </div>`));
    }
  }
  return notices.length ? `<div class="fr-mb-2w">${notices.join("")}</div>` : "";
}

/**
 * Traduction en français du refus le plus courant du document Grist :
 * « [Sandbox] KeyError 'X' » est ce que Grist répond lorsqu'un enregistrement
 * — ou une formule du document — nomme une colonne qui n'existe pas dans le
 * document. Sans cette explication, le message technique ne laisse aucune
 * piste.
 */
function writeErrorHint() {
  const m = /KeyError\s*['"]([^'"]+)['"]/.exec(state.gristWriteError || "");
  if (!m) return "";
  const colonne = m[1];
  const manque = state.gristMissingColumns.some((id) => id.endsWith(`.${colonne}`));
  return ` Le document a réclamé la colonne « ${colonne} », qui n'existe pas dans ce document : `
    + "c'est ce manque qui fait échouer l'enregistrement."
    + (manque ? " Le message « Le document Grist est incomplet » ci-dessus permet de la créer." : "");
}

/**
 * Écritures retenues après un refus du document (voir `pendingWrites` dans
 * `grist-backend.js`). Elles sont rejouables tant que la page reste ouverte :
 * il faut donc le dire, et proposer les deux gestes utiles — rejouer, ou
 * emporter une copie avant de fermer.
 */
function attenteMessage() {
  const n = pendingWriteCount();
  if (!n) return "";
  const tables = pendingWriteTables().slice(0, 4).join(", ");
  return ` ${n} modification(s) en attente d'envoi (${tables}) : elles peuvent être renvoyées au document, `
    + "ou emportées par une copie de secours — un rechargement de la page les effacerait.";
}

function attenteActions() {
  if (!pendingWriteCount()) {
    return `<div class="app-row fr-mt-1w">
        <button type="button" class="fr-btn fr-btn--sm fr-btn--secondary" data-action="export">Télécharger une copie (JSON)</button>
      </div>`;
  }
  return `<div class="app-row fr-mt-1w">
      <button type="button" class="fr-btn fr-btn--sm" data-action="grist-retry-writes">Renvoyer les modifications en attente</button>
      <button type="button" class="fr-btn fr-btn--sm fr-btn--secondary" data-action="export">Télécharger une copie (JSON)</button>
    </div>`;
}

/** Nom et rôle de la personne connectée, en haut à droite de chaque page. */
function userBlock() {
  if (!state.user) {
    return `
<div class="app-user app-user--loading">
  ${icon("account-circle-line", 'class="app-user__icon"')}
  <span class="app-user__name">Identification…</span>
</div>`;
  }
  const user = state.user;
  const role = roleOf();
  const title = [user.email, readOnly() ? "Consultation seule" : ""].filter(Boolean).join(" — ");
  return `
<div class="app-user"${title ? ` title="${esc(title)}"` : ""}>
  ${icon("account-circle-line", 'class="app-user__icon"')}
  <span class="app-user__name">${esc(state.debugName || userName(user))}</span>
  <span class="fr-badge fr-badge--sm ${esc(roleBadgeClass(role))}">${esc(roleLabel(role))}</span>
</div>`;
}

/**
 * Logo de l'opérateur, affiché à droite du bloc-marque de l'État (Réglages ›
 * Identité). Renvoie `null` tant qu'aucun logo n'est renseigné : l'en-tête
 * reste alors exactement celui d'avant.
 */
function operatorLogo() {
  const row = store.table("Identite")[0];
  const src = row ? String(row.Logo_operateur || "").trim() : "";
  if (!src) return null;
  return { src, alt: String(row.Logo_operateur_alt || "").trim() };
}

/**
 * Le bouton de création d'une affaire : dans l'en-tête, et sur la barre de
 * navigation quand l'en-tête est défilé (`outilsBarreHtml`). Une seule
 * définition, pour que les deux copies ne puissent pas diverger.
 */
function boutonNouvelleAffaire() {
  if (readOnly()) return "";
  return ui.button("Nouvelle affaire", { variant: "primary", size: "sm", iconName: "add-line", action: "new-affaire" });
}

function headerHtml() {
  return `
<header role="banner" class="fr-header">
  <div class="fr-header__body">
    <div class="fr-container">
      <div class="fr-header__body-row">
        ${ui.brandBlock({ title: SERVICE_TITLE, tagline: SERVICE_TAGLINE, operator: operatorLogo(), marque: marqueEtat(store.db) })}
        <div class="fr-header__tools">
          <div class="app-header__tools">
            ${boutonNouvelleAffaire()}
            <div class="app-header__actions">
              ${fullscreenButtonHtml()}
              ${themeButtonHtml()}
            </div>
            ${userBlock()}
          </div>
        </div>
      </div>
    </div>
  </div>
</header>`;
}

function navHtml() {
  const items = NAV.filter((n) => !n.cache
    && (n.id !== "reglages" || canSettings(state))
    && (n.id !== "attribution" || canSettings(state))
    && (n.id !== "debug" || debugAllowed(state)));
  // Le libellé **court** (`short`) est celui du menu : la barre tient sur une
  // ligne aux largeurs courantes, là où « Tableau de bord » et « Attribution
  // des affaires » la faisaient déborder dès qu'un onglet s'ajoutait. Le
  // libellé long reste celui du titre de la page et de la documentation.
  const liste = (classe) => `
    <ul class="${classe}">
      ${items.map((n) => `<li>
        <a class="app-navbar__link" href="#${esc(n.id)}" data-nav="${esc(n.id)}"${state.page === n.id ? ' aria-current="page"' : ""}>
          ${icon(n.icon, 'class="fr-mr-1v"')}${esc(n.short || n.label)}
        </a>
      </li>`).join("")}
    </ul>`;
  // Deux barres pour deux largeurs (voir `styles.css`) : au-delà de 48em les
  // entrées s'alignent, en deçà elles se replieraient sur quatre rangs et
  // repousseraient le contenu sous la fenêtre — elles se rangent dans un menu
  // repliable, dont le résumé annonce la page courante.
  const courante = items.find((n) => n.id === state.page);
  return `
<nav class="app-navbar" aria-label="Navigation principale">
  <div class="fr-container">
    <details class="app-navbar__mobile">
      <summary>Menu${courante ? `<span class="app-navbar__courant">${esc(courante.short || courante.label)}</span>` : ""}</summary>
      ${liste("app-navbar__list")}
    </details>
    ${liste("app-navbar__list app-navbar__list--desktop")}
    ${outilsBarreHtml()}
  </div>
</nav>`;
}

/**
 * Les commandes du compte reprises par la barre de navigation : créer une
 * affaire, et l'identité sous laquelle on travaille. Ce sont les deux commandes
 * dont on se sert à tout moment ; le reste des outils de l'en-tête (plein
 * écran, thème) reste à sa place et revient avec lui.
 *
 * Le bloc est écrit **en double** — une fois dans l'en-tête, une fois ici —, et
 * c'est la page qui bascule de l'un à l'autre (`entete-defilant.js`). Les deux
 * copies sortent des mêmes fonctions (`boutonNouvelleAffaire`, `userBlock`) :
 * rien à tenir en accord à la main. Il se range **à droite du rang des onglets**
 * (en deçà de 48em, sous le menu replié, sur sa propre ligne). Fermé, il n'est
 * ni visible, ni focusable, ni annoncé, et ne tient aucune place
 * (`visibility: hidden` et largeur nulle, `styles.css`).
 */
function outilsBarreHtml() {
  return `
<div class="app-navbar__outils">
  <div class="app-navbar__outils-rail">
    ${boutonNouvelleAffaire()}
    ${userBlock()}
  </div>
</div>`;
}

function footerHtml() {
  // Avec la charte neutre, le pied de page ne porte pas la marque de l'État :
  // son bloc-marque n'est pas écrit. Le pied de page porte le renvoi vers les
  // données et la sauvegarde, l'aide, et la **déclaration d'accessibilité**
  // (obligation propre au service public — voir accessibilite.js). Il n'annonce
  // pas d'inspiration : la mention de conformité au DSFR, qui n'engageait que
  // la démonstration, est retirée avec le reste.
  const neutre = !marqueEtat(store.db);
  const marque = neutre ? "" : `
      <div class="fr-footer__brand fr-enlarge-link">
        <a href="#tableau-de-bord" title="Retour à l'accueil de l'outil" data-nav="tableau-de-bord">
          <p class="fr-logo">République<br>Française</p>
        </a>
      </div>`;
  return `
<footer class="fr-footer" role="contentinfo">
  <div class="fr-container">
    <div class="fr-footer__body">${marque}
      <div class="fr-footer__content">
        <p class="fr-footer__content-desc">
          Outil de gestion et de suivi des sections disciplinaires.${enRecette()
            ? " Les données saisies dans cette démonstration sont fictives et ne quittent pas votre navigateur."
            : " Les données sont conservées dans le document Grist ou dans le navigateur, et ne quittent pas votre poste."}
        </p>
        <ul class="fr-footer__content-list">
          ${canSettings(state) ? `<li class="fr-footer__content-item"><a class="fr-footer__content-link" href="#reglages/donnees" data-nav="reglages/donnees">Données et sauvegarde</a></li>` : ""}
          <li class="fr-footer__content-item"><a class="fr-footer__content-link" href="#aide" data-nav="aide">Aide</a></li>
          <li class="fr-footer__content-item"><a class="fr-footer__content-link" href="#accessibilite" data-nav="accessibilite">Accessibilité</a></li>
        </ul>
      </div>
    </div>
  </div>
</footer>`;
}

function shellHtml() {
  return `
${headerHtml()}
${navHtml()}
${bandeauEnvironnement()}
<main class="fr-container app-main" id="appContent">
  ${gristNotice()}
  ${renderPage(store, state)}
</main>
${footerHtml()}
<div id="appModal">${modalHtml()}</div>`;
}

/**
 * Écran d'attente du branchement sur un document Grist.
 *
 * Tant que le document n'a pas répondu, le magasin porte encore la base
 * locale — celle de la démonstration. La dessiner ferait apparaître, le temps
 * de la liaison, des sections, des affaires et des logos qui ne sont pas ceux
 * du document, et laisserait croire à un document étranger ou à un document
 * vide. Rien n'est donc montré avant la réponse de Grist : ni données, ni logo
 * d'opérateur, ni navigation. Le nom du service reste en place, pour que la
 * page ne saute pas au moment où les données arrivent.
 *
 * La marque de l'État n'y figure pas : la charte du document n'est pas encore
 * connue, et une structure qui ne porte pas la charte de l'État ne doit pas la
 * voir paraître, fût-ce le temps d'une seconde.
 */
function loadingShellHtml() {
  return `
<header role="banner" class="fr-header">
  <div class="fr-header__body">
    <div class="fr-container">
      <div class="fr-header__body-row">
        ${ui.brandBlock({ title: SERVICE_TITLE, tagline: SERVICE_TAGLINE, operator: null, marque: false })}
        <div class="fr-header__tools">
          <div class="app-header__tools">${userBlock()}</div>
        </div>
      </div>
    </div>
  </div>
</header>
<main class="fr-container app-main" id="appContent">
  <div class="app-loading" role="status" aria-live="polite">
    <span class="app-spinner app-loading__spinner" aria-hidden="true"></span>
    <p class="app-loading__title">Connexion au document Grist…</p>
    <p class="app-loading__hint">Lecture des données du document.</p>
  </div>
</main>`;
}

/* ------------------------------------------------------------------ */
/* Fenêtres modales                                                    */
/* ------------------------------------------------------------------ */

const REQUIRED_FIELDS = ["Motif", "Section"];
const PERS_REQUIRED = ["Nom"];
const labelOf = (table, col) => SCHEMA[table]?.columns.find((c) => c.id === col)?.label || col;

const WIDE_DRAFT = ["Adresse", "Motif", "Lien_vers_le_dossier"];

function draftField(table, key, col, { required = false } = {}) {
  return ui.field(table, col, state.ctx, null, {
    store,
    draft: key,
    value: state.draft[key]?.[col] ?? "",
    required,
  });
}

function draftGrid(table, key, cols, { wide = WIDE_DRAFT, required = [] } = {}) {
  return `<div class="fr-grid-row fr-grid-row--gutters app-form-grid">
    ${cols.map((c) => `<div class="fr-col-12 ${wide.includes(c) ? "" : "fr-col-md-6"}">${draftField(table, key, c, { required: required.includes(c) })}</div>`).join("")}
  </div>`;
}

/* Étape 1 : la personne mise en cause. Elle est reliée au répertoire — soit
   par le choix d'une fiche existante, soit par la création d'une fiche. Les
   champs d'identité suivent le type : un usager a un INE et une formation
   suivie, un personnel un corps et une section CNU. Afficher l'INE d'un
   enseignant-chercheur — ou un corps à un étudiant — n'aurait pas de sens. */
const ETAPE_1_COMMUN = ["Type", "Prenom", "Nom", "Genre", "Date_de_naissance", "Email", "Telephone"];
const ETAPE_1_USAGER = ["INE", "Formation_suivie", "Composante", "Adresse"];
const ETAPE_1_PERSONNEL = ["Corps", "Section_CNU", "Etablissement", "Adresse"];
const ETAPE_1_TIERS = ["Qualite", "Organisme", "Adresse"];

function etape1Colonnes(type) {
  if (type === "Personnel") return [...ETAPE_1_COMMUN, ...ETAPE_1_PERSONNEL];
  if (type === "Tiers") return [...ETAPE_1_COMMUN, ...ETAPE_1_TIERS];
  return [...ETAPE_1_COMMUN, ...ETAPE_1_USAGER];
}
const ETAPE_2 = ["Section", "Date_de_saisine", "Numero", "Voie", "Composante", "Date_des_faits", "Autorite_de_saisine", "Secretaire", "Lien_vers_le_dossier", "Motif"];

function personneDraft() {
  const id = state.draft.affaire.Mis_en_cause;
  return id ? store.byId("Personnes", id) : null;
}

function affaireModal() {
  const step = state.affaireStep;
  // L'attribution ne se règle pas ici pour un secrétaire : l'affaire lui est
  // attribuée d'office (voir `submitAffaire`), et la répartition appartient aux
  // propriétaires du document.
  const parProprietaire = peutVoirTout(state);
  const cols = parProprietaire ? ETAPE_2 : ETAPE_2.filter((c) => c !== "Secretaire");
  const footer = `
    ${step === 2 ? ui.button("Précédent", { variant: "tertiary", iconName: "arrow-left-line", action: "affaire-step-1" }) : ""}
    ${ui.button("Annuler", { variant: "secondary", action: "close-dialog" })}
    ${step === 1
      ? ui.button("Suivant", { variant: "primary", iconName: "arrow-right-line", action: "affaire-step-2" })
      : ui.button("Enregistrer l'affaire", { variant: "primary", iconName: "checkbox-circle-line", action: "affaire-submit" })}`;

  const noteSecretaire = step === 2 && !parProprietaire
    ? `<p class="fr-hint-text fr-mt-2w fr-mb-0">${icon("user-star-line", 'class="fr-mr-1v"')}L'affaire vous sera attribuée : vous la retrouverez dans « Mes affaires ». La répartition entre secrétaires est décidée par les propriétaires du document.</p>`
    : "";

  let body;
  if (step === 1) {
    const fiche = personneDraft();
    const choix = `
      <div class="fr-grid-row fr-grid-row--gutters app-form-grid">
        <div class="fr-col-12 fr-col-md-6">
          <div class="fr-select-group">
            <label class="fr-label" for="affairePersonne">Personne déjà enregistrée</label>
            <select class="fr-select" id="affairePersonne" aria-describedby="affairePersonne-desc" data-action="draft-personne">
              <option value="">— Nouvelle personne —</option>
              ${store.table("Personnes").map((p) => `<option value="${p.id}" ${fiche && p.id === fiche.id ? "selected" : ""}>${esc(str(state.ctx.v("Personnes", p, "Nom_complet")) || `#${p.id}`)}</option>`).join("")}
            </select>
            <p class="fr-hint-text app-desc" id="affairePersonne-desc">Si elle figure déjà au répertoire, sa fiche sera reliée à l'affaire plutôt que d'en créer une seconde.</p>
          </div>
        </div>
      </div>`;
    body = fiche
      ? `${choix}<div class="fr-mt-2w">${ui.alert("info", "Fiche reliée à l'affaire",
        `${str(state.ctx.v("Personnes", fiche, "Nom_complet"))} — les champs ci-dessous ne sont pas utilisés, la fiche existante est reprise telle quelle.`)}</div>`
      : `${choix}<p class="fr-hint-text fr-mt-2w">${icon("user-line", 'class="fr-mr-1v"')}Nouvelle fiche au répertoire. Seuls le nom et le prénom sont nécessaires ; le reste peut être complété plus tard.</p>${draftGrid("Personnes", "personne", etape1Colonnes(state.draft.personne?.Type), { required: PERS_REQUIRED })}`;
  } else {
    body = draftGrid("Affaires", "affaire", cols);
  }

  return ui.dialog({
    id: "affaireDialog",
    title: step === 1 ? "Nouvelle affaire : la personne mise en cause" : "Nouvelle affaire : la saisine",
    subtitle: `Étape ${step} sur 2`,
    body: `${ui.stepper([{ id: 1, label: "Mis en cause" }, { id: 2, label: "Saisine" }], step)}${body}${noteSecretaire}`,
    footer,
    size: "lg",
  });
}

function documentModal() {
  const d = state.draft.document;
  const affaires = [...affairesVisibles(store, state, store.table("Affaires"))].sort((a, b) =>
    String(a.Numero || "").localeCompare(String(b.Numero || ""), "fr", { numeric: true }));
  const affaire = d.Affaire ? store.byId("Affaires", d.Affaire) : null;
  const section = affaire && affaire.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const trames = trameOptions(store, section);

  // L'auteur et le destinataire sont **programmés sur la trame** : les annoncer
  // dès l'entrée, au moment où l'on choisit la trame, dit ce que le document
  // sera — et pourquoi la rédaction n'aura pas à les choisir.
  const redacteurs = (() => {
    const trame = d.Template ? store.byId("Trames", d.Template) : null;
    if (!trame) return "";
    try {
      const { auteur, destinataire } = documentScope(store.db, { Affaire: d.Affaire, Template: d.Template, Date: d.Date });
      // Tant que le rôle n'est pas résolu sur l'affaire (président sans
      // titulaire, victime non renseignée…), on nomme le **rôle** plutôt qu'un
      // nom inventé : c'est ce que la rédaction devra compléter.
      const qui = auteur?.role
        ? `Rédigé par ${auteur.resolu && auteur.nom ? auteur.nom : auteur.role}`
        : "";
      const aQui = destinataire?.role
        ? `adressé à ${destinataire.resolu && destinataire.nom ? destinataire.nom : destinataire.role}`
        : "";
      const phrase = [qui, aQui].filter(Boolean).join(", ");
      return phrase ? `<p class="fr-hint-text fr-mt-1w fr-mb-0">${esc(phrase.charAt(0).toUpperCase() + phrase.slice(1))}.</p>` : "";
    } catch { return ""; }
  })();

  const body = `
    <div class="fr-grid-row fr-grid-row--gutters">
      <div class="fr-col-12">
        <div class="fr-select-group">
          <label class="fr-label" for="docAffaire">Affaire</label>
          <select class="fr-select" id="docAffaire" aria-describedby="docAffaire-desc" data-action="document-affaire">
            <option value="">— Choisir une affaire —</option>
            ${affaires.map((a) => `<option value="${a.id}" ${Number(d.Affaire) === a.id ? "selected" : ""}>${esc(`${a.Numero || `#${a.id}`} — ${String(state.ctx?.v("Affaires", a, "Nom_complet") || "").trim() || "sans nom"}`)}</option>`).join("")}
          </select>
          <p class="fr-hint-text app-desc" id="docAffaire-desc">Le document reprend les données de l'affaire choisie.</p>
        </div>
      </div>
      <div class="fr-col-12">
        <div class="fr-select-group">
          <label class="fr-label" for="docTrame">Trame</label>
          <select class="fr-select" id="docTrame" aria-describedby="docTrame-desc" data-action="document-trame"${affaire ? "" : " disabled"}>
            <option value="">— Choisir une trame —</option>
            ${trames.map((t) => `<option value="${t.id}" ${Number(d.Template) === t.id ? "selected" : ""}>${esc(String(state.ctx?.v("Trames", t, "Nom_complet") || t.Nom || `#${t.id}`))}</option>`).join("")}
          </select>
          <p class="fr-hint-text app-desc" id="docTrame-desc">${affaire ? "Trames correspondant au public de la section." : "Choisissez d'abord une affaire pour filtrer les trames."}</p>
          ${redacteurs}
        </div>
      </div>
      <div class="fr-col-12 fr-col-md-6">
        <div class="fr-input-group app-date-group">
          <label class="fr-label" for="docDate">Date du document</label>
          ${ui.dateInput("docDate", d.Date || todayIso(), 'data-bind="Generateur|Date" data-draft="document"')}
          <p class="fr-error-text" id="docDate-err" hidden>Date incomplète ou impossible. Écrivez par exemple 20/09/2026.</p>
        </div>
      </div>
    </div>`;

  return ui.dialog({
    id: "documentDialog",
    title: "Nouveau document",
    subtitle: "Choisissez l'affaire et la trame du courrier",
    body,
    footer: `${ui.button("Annuler", { variant: "secondary", action: "close-dialog" })}
      ${ui.button("Créer le document", { variant: "primary", iconName: "file-add-line", action: "document-submit" })}`,
  });
}

/**
 * Fenêtre « Joindre des affaires ».
 *
 * On ne choisit pas un « groupe » : on choisit les affaires à juger avec
 * celle-ci. L'affaire de tête — celle qui portera la décision commune — est
 * celle d'où l'on agit ; si l'affaire appartient déjà à une jonction, les
 * affaires choisies la rejoignent et la tête reste celle du groupe.
 *
 * Seules sont proposées les affaires de la **même section** (une même formation
 * les jugera) qui ne sont **encore jointes à personne** : une affaire
 * n'appartient qu'à une jonction.
 */
function jonctionModal() {
  const d = state.draft.jonction || {};
  const affaire = store.byId("Affaires", Number(d.Affaire) || 0);
  if (!affaire) return "";
  const ctx = state.ctx;
  const jonction = ctx.v("Affaires", affaire, "Jonction");
  const membres = jonction ? affairesDeJonction(ctx.db, jonction) : [affaire];
  const tete = membres.find((x) => Number(x.id) === Number(jonction ? jonction.Affaire_de_tete : affaire.id)) || affaire;
  const libelle = (x) => `${str(ctx.v("Affaires", x, "Numero")) || `#${x.id}`} — ${str(ctx.v("Affaires", x, "Nom_complet")).trim() || "sans nom"}`;

  const candidates = affairesVisibles(store, state, store.table("Affaires"))
    .filter((x) => Number(x.id) !== Number(affaire.id))
    .filter((x) => Number(x.Section) === Number(affaire.Section))
    .filter((x) => !ctx.v("Affaires", x, "Jonction"))
    .sort((x, y) => String(x.Numero || "").localeCompare(String(y.Numero || ""), "fr", { numeric: true }));

  const section = affaire.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const sansCandidate = candidates.length
    ? ""
    : ui.alert("info", "Aucune affaire disponible",
      "Les affaires proposées ici sont celles de la même section — une même formation les jugera — "
      + "qui ne sont encore jointes à aucune autre. " + (section ? "" : "Renseignez d'abord la section de l'affaire.") + "");

  const body = `
    ${ui.alert("info", "Une seule décision pour l'ensemble",
      "Les affaires jointes gardent chacune son numéro, sa personne mise en cause et ses documents. "
      + "Elles sont jugées par une même décision : celle qui sera enregistrée sur l'affaire de tête. "
      + "La jonction se défait à tout moment, sans rien perdre.")}
    <p class="fr-text--sm fr-mt-2w fr-mb-0">
      <strong>Affaire de tête</strong> : n° ${esc(str(ctx.v("Affaires", tete, "Numero")) || `#${tete.id}`)}
      ${membres.length > 1 ? ` — la décision commune y est déjà portée (${membres.length} affaires jointes)` : ""}
    </p>
    <div class="fr-mt-2w">
      ${ui.field("Jonctions", "Affaires_jointes", ctx, null, {
        store, draft: "jonction", value: d.Affaires_jointes || [], rows: candidates,
      })}
    </div>
    <div class="fr-grid-row fr-grid-row--gutters fr-mt-1w">
      <div class="fr-col-12 fr-col-md-6">
        ${ui.field("Jonctions", "Date_de_la_jonction", ctx, null, {
          store, draft: "jonction", value: d.Date_de_la_jonction || todayIso(),
        })}
      </div>
      <div class="fr-col-12">
        ${ui.field("Jonctions", "Motif", ctx, null, {
          store, draft: "jonction", value: d.Motif || "",
          placeholder: "Mêmes faits, même épreuve, mis en cause multiples…",
        })}
      </div>
    </div>
    ${sansCandidate}`;

  return ui.dialog({
    id: "jonctionDialog",
    title: "Joindre des affaires",
    subtitle: "Une seule décision tranchera le fond pour toutes les affaires jointes",
    body,
    size: "lg",
    footer: `${ui.button("Annuler", { variant: "secondary", action: "close-dialog" })}
      ${ui.button(membres.length > 1 ? "Ajouter à la jonction" : "Joindre les affaires", {
        variant: "primary", iconName: "links-line", action: "jonction-submit",
      })}`,
  });
}

/**
 * Fenêtre de **déclaration du dossier de pièces**.
 *
 * Les pièces d'un dossier disciplinaire sont tenues hors de l'outil : cette
 * fenêtre en recueille l'adresse, la complète si elle a été saisie sans schéma,
 * la vérifie, et l'enregistre sur l'affaire. Elle se rouvre pour corriger ou
 * retirer l'adresse — un lien mort ne doit pas rester sans recours.
 */
function dossierModal() {
  const d = state.draft.dossier || {};
  const affaire = store.byId("Affaires", Number(d.affaire));
  if (!affaire) return "";
  const valeur = d.lien !== undefined ? d.lien : str(affaire[CHAMP_DOSSIER]);
  const href = urlDossier(valeur);
  const renseigne = String(valeur || "").trim().length > 0;
  const apercu = !renseigne
    ? `<p class="fr-hint-text fr-mb-0">Vide, l'affaire se lira sans adresse de dossier — mais le contrôle de régularité le signalera dès l'instruction.</p>`
    : href
      ? `<p class="fr-hint-text fr-mb-0">${icon("external-link-line", 'class="fr-mr-1v"')}Le dossier s'ouvrira à l'adresse :
          <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(href)}</a></p>`
      : `<p class="fr-error-text fr-mb-0">${icon("error-warning-line", 'class="fr-mr-1v"')}Ce n'est pas une adresse web : elle doit commencer par <code>http://</code> ou <code>https://</code> — le schéma peut être omis.</p>`;
  return ui.dialog({
    id: "dossierDialog",
    title: "Déclarer le dossier de pièces",
    subtitle: `${str(state.ctx.v("Affaires", affaire, "Numero"))} — ${str(state.ctx.v("Affaires", affaire, "Nom_complet")).trim() || "affaire sans nom"}`,
    body: `
      <p>Les pièces du dossier sont tenues <strong>hors de l'outil</strong> — bureau numérique,
      espace de partage, fichiers.gouv.fr… Celui-ci n'en conserve que l'<strong>adresse</strong> :
      elle s'ouvre depuis la fiche de l'affaire, le rôle de la séance et les documents.</p>
      <div class="fr-input-group fr-mt-2w">
        <label class="fr-label" for="dossierLien">Adresse du dossier</label>
        <input class="fr-input" type="url" id="dossierLien" aria-describedby="dossierLien-desc" value="${esc(str(valeur))}" placeholder="https://fichiers.gouv.fr/…" spellcheck="false">
        <p class="fr-hint-text app-desc" id="dossierLien-desc">Collez l'adresse de l'espace où sont rangées les pièces de cette affaire. Le schéma (<code>https://</code>) peut être omis.</p>
      </div>
      ${apercu}`,
    footer: `<span style="margin-right:auto">${lienDossier(affaire)
      ? ui.button("Retirer le lien", { variant: "tertiary", iconName: "delete-bin-line", action: "dossier-retirer" })
      : ""}</span>
      ${ui.button("Annuler", { variant: "secondary", action: "close-dialog" })}
      ${ui.button("Enregistrer l'adresse", { variant: "primary", iconName: "checkbox-circle-line", action: "dossier-submit" })}`,
  });
}

function modalHtml() {
  if (state.modal === "affaire") return affaireModal();
  if (state.modal === "document") return documentModal();
  if (state.modal === "jonction") return jonctionModal();
  if (state.modal === "dossier") return dossierModal();
  if (state.modal === "considerant") return considerantModal(state.draft.considerant || {});
  return "";
}

// `keepFocus: true` pour ouvrir et fermer : la fenêtre est posée par-dessus la
// page, et le défilement de celle-ci — comme la place de la fenêtre dans son
// corps — doit être retrouvé tel quel. Refermer une fenêtre ouverte depuis le
// bas d'une longue fiche ne doit pas renvoyer en haut de la page.
function openModal(name) {
  // Le déclencheur est relevé **avant** le rendu : celui-ci remplace le DOM, et
  // l'élément cliqué n'existerait plus au moment de restituer le focus
  // (NC-0027). On retient de quoi le retrouver (identifiant, ou couple
  // action/fiche), pas une référence morte.
  const actif = document.activeElement;
  if (actif && actif.closest && !actif.closest("#appModal")) declencheurModale = cleDeclencheur(actif);
  state.modal = name;
  render({ keepFocus: true });
}

function closeModal() {
  state.modal = null;
  state.affaireStep = 1;
  render({ keepFocus: true });
}

/* ------------------------------------------------------------------ */
/* Fenêtres modales : confinement du focus et fond neutralisé (NC-0027) */
/* ------------------------------------------------------------------ */
/*
 * Une fenêtre `aria-modal="true"` promet que le reste de la page est inactif :
 * au clavier, la tabulation doit rester dans la fenêtre, et l'arrière-plan ne
 * doit plus être atteignable. Sans cela, le parcours sortait de la fenêtre et
 * traversait un fond que `aria-modal` déclarait pourtant inactif — à la fois
 * trompeur pour un lecteur d'écran et pénible au clavier. On pose donc `inert`
 * sur les frères de la fenêtre, on boucle la tabulation sur ses éléments
 * focusables, et on restitue le focus au déclencheur à la fermeture.
 */

/* Déclencheur de la fenêtre ouverte, décrit de façon stable (voir `cleDeclencheur`). */
let declencheurModale = null;

/** Description stable d'un élément, pour le retrouver après un rendu. */
function cleDeclencheur(el) {
  if (!el) return null;
  if (el.id) return { id: el.id };
  const action = el.dataset && el.dataset.action;
  if (!action) return null;
  return { action, record: (el.dataset && el.dataset.record) || null };
}

/** L'élément est-il effectivement peint — et non caché par `visibility` ? */
function estVisible(el) {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

/**
 * Élément correspondant à une description, dans le DOM courant.
 *
 * La barre de navigation reprend les commandes de l'en-tête quand celui-ci est
 * défilé (`outilsBarreHtml`) : le même bouton existe donc en deux exemplaires,
 * dont un seul est visible. C'est celui-là que le focus doit retrouver — sans
 * quoi il repartait dans l'en-tête, hors de la vue, pour une fenêtre ouverte
 * depuis la barre.
 */
function retrouverDeclencheur(cle) {
  if (!cle) return null;
  if (cle.id) return document.getElementById(cle.id);
  const echapper = (v) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(v) : v);
  const sel = `[data-action="${echapper(cle.action)}"]`
    + (cle.record ? `[data-record="${echapper(cle.record)}"]` : "");
  const candidats = [...document.querySelectorAll(sel)];
  return candidats.find(estVisible) || candidats[0] || null;
}

const SELECTEUR_FOCUSABLE = "a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]),"
  + " select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Éléments visibles et focusables d'une fenêtre. */
function elementsFocusables(racine) {
  return [...racine.querySelectorAll(SELECTEUR_FOCUSABLE)]
    .filter((el) => el.getClientRects().length > 0);
}

/** Boucle la tabulation à l'intérieur de la fenêtre ouverte. */
function surTabModale(e) {
  if (e.key !== "Tab") return;
  const modale = document.querySelector("#appModal .app-dialog");
  if (!modale) return;
  const focusables = elementsFocusables(modale);
  if (!focusables.length) { e.preventDefault(); return; }
  const premier = focusables[0];
  const dernier = focusables[focusables.length - 1];
  const actif = document.activeElement;
  if (e.shiftKey) {
    if (actif === premier || !modale.contains(actif)) { e.preventDefault(); dernier.focus(); }
  } else if (actif === dernier || !modale.contains(actif)) {
    e.preventDefault(); premier.focus();
  }
}

/* Frères de la fenêtre neutralisés pendant son ouverture, pour les rétablir. */
let fondsNeutralises = [];

/** Pose (ou retire) `inert` sur le fond de la page, hors fenêtre modale. */
function neutraliserFond(actif) {
  const app = document.getElementById("app");
  if (!app) return;
  if (actif) {
    // Un rendu a pu remplacer les enfants de `#app` : la liste précédente peut
    // être périmée (elle désigne des nœuds détachés). On repart donc du DOM
    // courant, plutôt que de faire confiance à un état mémorisé.
    fondsNeutralises = [];
    for (const enfant of [...app.children]) {
      if (enfant.id === "appModal") continue;
      enfant.setAttribute("inert", "");
      fondsNeutralises.push(enfant);
    }
    return;
  }
  for (const el of fondsNeutralises) el.removeAttribute("inert");
  fondsNeutralises = [];
}

function focusModal() {
  const modal = document.getElementById("appModal");
  const ouvert = !!(modal && modal.children.length);
  if (ouvert) {
    neutraliserFond(true);
    document.removeEventListener("keydown", surTabModale, true);
    document.addEventListener("keydown", surTabModale, true);
    if (modal.contains(document.activeElement)) return;
    const el = modal.querySelector("input:not([type=hidden]), select, textarea")
      || modal.querySelector("a[href], button:not([disabled]), [tabindex]");
    // `preventScroll` : le corps de la fenêtre vient d'être remis à sa place par
    // `restoreView` ; donner le focus au premier champ ne doit pas le ramener au
    // début du formulaire.
    if (el) el.focus({ preventScroll: true });
    return;
  }
  // Fenêtre fermée : le fond redevient actif, et le focus retourne au
  // déclencheur — sauf si l'application en a décidé autrement entre-temps.
  document.removeEventListener("keydown", surTabModale, true);
  neutraliserFond(false);
  if (!declencheurModale) return;
  const cible = retrouverDeclencheur(declencheurModale);
  declencheurModale = null;
  if (cible && !cible.closest("#appModal")) cible.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

function captureView() {
  const view = { focus: null, scrolls: {}, pageTop: window.scrollY || document.scrollingElement.scrollTop || 0 };
  const app = document.getElementById("app");
  const active = document.activeElement;
  if (active && active.id && app && app.contains(active)) {
    view.focus = { id: active.id, start: null, end: null };
    try {
      view.focus.start = active.selectionStart;
      view.focus.end = active.selectionEnd;
    } catch { /* champs sans sélection */ }
  }
  // Toutes les zones défilantes repérables : les conteneurs marqués
  // `data-scroll` — listes, corps de fenêtre modale — sont nommés, donc
  // retrouvés au rendu suivant, quel que soit l'endroit où ils se trouvent.
  for (const el of document.querySelectorAll("[data-scroll]")) {
    view.scrolls[el.dataset.scroll] = el.scrollTop;
  }
  return view;
}

/**
 * Remet la vue où l'utilisateur l'avait laissée. Terminer la saisie d'un champ
 * reconstruit la page entière : sans cette restauration, le navigateur ramène
 * la page en haut (le contenu est un instant plus court que la position
 * courante), et le corps d'une fenêtre modale repart de son premier champ — au
 * moment précis où l'on vient de choisir une valeur et où l'on veut continuer
 * plus bas.
 */
function restoreView(view) {
  if (view.focus) {
    const el = document.getElementById(view.focus.id);
    if (el) {
      el.focus({ preventScroll: true });
      if (view.focus.start !== null && typeof el.setSelectionRange === "function" && el.tagName !== "SELECT") {
        try { el.setSelectionRange(view.focus.start, view.focus.end); } catch { /* ignore */ }
      }
    }
  }
  for (const [key, top] of Object.entries(view.scrolls)) {
    const el = document.querySelector(`[data-scroll="${key}"]`);
    if (el) el.scrollTop = top;
  }
  window.scrollTo(0, view.pageTop);
}

let dsfrStarted = false;
function startDsfr() {
  if (dsfrStarted || !window.dsfr || typeof window.dsfr.start !== "function") return;
  try {
    window.dsfr.start();
    dsfrStarted = true;
  } catch { /* le DSFR se réinitialisera au prochain rendu */ }
}

/* Un rendu demandé, pas encore fait (voir `planifierRendu`). */
let renduPlanifie = false;

/**
 * Demande un rendu pour la fin de la tâche en cours.
 *
 * Un même geste écrit souvent plusieurs lignes — créer une personne **puis**
 * l'affaire qui la cite, installer les seuils, reporter une décision sur
 * l'affaire et le recours… Chaque écriture prévient le magasin, et un rendu
 * par écriture redessinerait la page entière plusieurs fois de suite, pour un
 * résultat identique. Le rendu est donc repoussé à la fin de la tâche : un
 * geste, un rendu. L'écran est redessiné avant que le navigateur ne repeigne,
 * rien n'est différé d'un cran perceptible.
 *
 * Un `render()` demandé explicitement par une action (navigation, ouverture
 * d'une fenêtre) remplace celui qui était programmé, et a donc toujours le
 * dernier mot.
 */
function planifierRendu() {
  if (renduPlanifie) return;
  renduPlanifie = true;
  Promise.resolve().then(() => {
    if (!renduPlanifie) return;
    renduPlanifie = false;
    render();
  });
}

function render({ keepFocus = true } = {}) {
  renduPlanifie = false;
  const view = keepFocus ? captureView() : null;
  const app = document.getElementById("app");
  if (!app) return;
  // La charte est appliquée avant le rendu : la classe posée sur <html> vaut
  // pour toute la page, et les éléments de la coquille qui portent la marque de
  // l'État sont omis au moment où ils sont écrits (voir `charte.js`).
  appliquerCharte(store.db);
  app.innerHTML = state.grist === "loading" ? loadingShellHtml() : shellHtml();
  applyReadOnly(app);
  syncGristWrites();
  // Les menus déroulants sont enrichis d'une recherche **avant** la restitution
  // de la vue : le champ repris est celui de la recherche, et il n'existe qu'à
  // partir d'ici. Faire après rendrait le focus à un champ absent.
  monterSelectsRecherche(app);
  if (view) restoreView(view);
  else window.scrollTo(0, 0);
  // Appelé à chaque rendu, avec ou sans fenêtre : c'est ce qui pose `inert` et
  // confine le focus quand une fenêtre est ouverte — et, quand elle s'est
  // fermée, ce qui rend le fond, relâche le piège et restitue le focus
  // (NC-0027). Ne l'appeler qu'à l'ouverture laissait ces trois effets en
  // suspens.
  focusModal();
  mountWysiwyg(app, { onDirty: (editor) => saveEditorContent(editor) });
  // L'atelier d'une décision accepte, lui aussi, le dépôt : les considérants du
  // répertoire viennent s'insérer dans le texte à l'endroit où on les lâche.
  monterAtelierDecision(app, {
    store,
    considerants: repertoire(store.db),
    onDirty: (editor) => saveEditorContent(editor),
  });
  startDsfr();
  // Les champs d'une même ligne sont alignés sur la mesure du libellé le plus
  // haut : elle se prend après que le DSFR a fini son propre travail, et avant
  // que le navigateur ne repeigne.
  alignerChamps();
  // La coquille vient d'être refaite : l'état de l'en-tête (effacé ou non, et
  // la hauteur de la barre qui en découle) est reposé sur ce nouveau balisage.
  // La vue a déjà été restituée, donc la position de défilement est la bonne,
  // et la classe est posée avant que la page ne soit peinte : un rendu pendant
  // qu'on défile ne rejoue pas l'animation.
  majEnteteDefilant();
}

/* ------------------------------------------------------------------ */
/* Lecture / écriture des valeurs                                      */
/* ------------------------------------------------------------------ */

function coerce(tableName, colId, el) {
  const def = SCHEMA[tableName]?.columns.find((c) => c.id === colId);
  const type = def?.type || "Text";
  if (type === "Bool") return el.checked;
  if (type.startsWith("RefList:")) {
    // Liste de références : le groupe de cases à cocher (voir `field`, ui.js),
    // ou le menu à choix multiples qu'un écran plus ancien pouvait encore
    // présenter.
    if (el.tagName === "SELECT") return [...el.selectedOptions].map((o) => Number(o.value)).filter((v) => v);
    return [...el.querySelectorAll("input[type=checkbox]")].filter((c) => c.checked).map((c) => Number(c.value)).filter((v) => v);
  }
  if (type.startsWith("Ref:")) return el.value ? Number(el.value) : 0;
  if (type === "Date") return parseDateSaisie(el.value);
  if (type === "Int") return el.value === "" ? null : Math.round(Number(el.value));
  if (type === "Numeric") return el.value === "" ? null : Number(el.value);
  return el.value;
}

/** Signale une date illisible sous le champ, sans toucher à ce qui est enregistré. */
function signalerDateInvalide(el) {
  const groupe = el.closest(".fr-input-group");
  if (groupe) groupe.classList.add("fr-input-group--error");
  const err = document.getElementById(`${el.id}-err`);
  if (err) err.hidden = false;
  el.setAttribute("aria-invalid", "true");
}

/** Retire le signalement d'une date, dès que la saisie redevient exploitable. */
function effacerErreurDate(el) {
  const groupe = el.closest(".fr-input-group");
  if (groupe) groupe.classList.remove("fr-input-group--error");
  const err = document.getElementById(`${el.id}-err`);
  if (err) err.hidden = true;
  el.removeAttribute("aria-invalid");
}

/**
 * Enregistre la valeur d'un champ.
 *
 * `finaliser` est vrai quand la saisie est terminée (perte du focus, ou
 * validation) : une date illisible est alors rendue à sa dernière valeur
 * valable et signalée, plutôt que de laisser croire qu'une valeur a été prise
 * en compte. Pendant la frappe, une date encore incomplète — « 20/09/2 » — est
 * simplement ignorée : c'est l'état normal d'un champ en cours de saisie.
 */
function bindValue(el, { finaliser = false } = {}) {
  const [tableName, colId] = (el.dataset.bind || "").split("|");
  if (!tableName || !colId) return;
  const def = SCHEMA[tableName]?.columns.find((c) => c.id === colId);
  // Une date est reçue en clair (JJ/MM/AAAA, ou toute autre écriture courante)
  // et toujours conservée en ISO.
  const brut = String(el.value ?? "").trim();
  const value = coerce(tableName, colId, el);
  if (def?.type === "Date") {
    if (brut && value === null) {
      if (!finaliser) return;
      el.value = formatDateSaisie(el.dataset.dateValeur || "");
      signalerDateInvalide(el);
      return;
    }
    // La dernière valeur valable suit la saisie : si un texte illisible lui
    // succède, c'est elle que le champ retrouve.
    el.dataset.dateValeur = value || "";
    effacerErreurDate(el);
  }
  if (el.hasAttribute("data-record")) {
    store.updateRow(tableName, Number(el.dataset.record), { [colId]: value });
  } else {
    const key = el.dataset.draft || "affaire";
    const next = { ...(state.draft[key] || {}), [colId]: value };
    // Le numéro d'affaire est proposé dès que la section est connue.
    if (key === "affaire" && colId === "Section" && value) {
      if (!next.Numero) next.Numero = nextNumero(store.db, Number(value));
      const numeroEl = document.getElementById("f_Affaires_Numero_affaire");
      if (numeroEl) numeroEl.value = next.Numero;
    }
    state.draft[key] = next;
    // Le formulaire d'identité suit le type de personne : un usager a un INE
    // et une formation suivie, un personnel un corps et une section CNU.
    if (key === "personne" && colId === "Type") render({ keepFocus: true });
  }
}

/* ------------------------------------------------------------------ */
/* Filtres                                                             */
/* ------------------------------------------------------------------ */

let filterTimer = null;

function setFilter(el, { debounce = false } = {}) {
  const key = el.dataset.filter;
  if (!key) return;
  state.filters[key] = el.type === "checkbox" ? el.checked : el.value;
  clearTimeout(filterTimer);
  if (debounce) filterTimer = setTimeout(() => { persistPrefs(); render(); }, 200);
  else { persistPrefs(); render(); }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const todayIso = () => aujourdHui();

/**
 * Télécharge un tableau en CSV (BOM, point-virgule) : le même format que les
 * exports de listes, avec la neutralisation des formules (NC-0007). Sert aux
 * états produits par le code — état des pièces pour versement (NC-0017),
 * registre des actes (NC-0020) —, qui ne viennent pas d'une table du modèle.
 */
function telechargerCsv(nomBase, entetes, lignes) {
  const csv = csvDeTableau({
    entetes,
    lignes: lignes.map((ligne) => entetes.map((colonne) => ligne[colonne] ?? "")),
  });
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), nomFichier(nomBase, "csv"));
}

/* --- Aides de l'atelier de rédaction d'une décision ---------------- */

/**
 * Replie ou déplie un outil de l'atelier. `state.tabs` porte l'état, comme pour
 * les onglets : il survit au redessin de la page, et l'outil rouvert le reste
 * tant qu'on travaille sur la même décision.
 */
function basculerOutil(cle, defaut = false) {
  const ouvert = state.tabs[cle] === undefined ? defaut : state.tabs[cle] !== "replie";
  state.tabs[cle] = ouvert ? "replie" : "ouvert";
  render();
}

/** L'éditeur du texte de la décision, s'il est affiché. */
function editeurDecision() {
  // L'atelier d'une décision marque son texte de `data-considerants` ; l'espace
  // de rédaction d'un **acte rendu** — une ordonnance, comme une décision
  // ouverte comme document — porte la même marque, et reçoit donc les mêmes
  // gestes : le répertoire des considérants, et la numérotation.
  return document.querySelector("[data-considerants]") || document.getElementById("decEditor");
}

/**
 * Le texte d'une décision : le document qui la rédige, créé s'il n'existe pas
 * encore. C'est le premier geste de la rédaction — depuis l'atelier, ou depuis
 * l'onglet « Décision » de l'affaire (`rediger-decision`).
 *
 * Renvoie la ligne de `Generateur`, ou `null` si elle n'a pas pu être créée —
 * une décision sans affaire n'a pas de dossier où écrire.
 */
function assurerTexteDeDecision(decision) {
  if (!decision) return null;
  const existant = documentDeDecision(store, decision);
  if (existant) return existant;
  const affaire = store.byId("Affaires", decision.Affaire);
  if (!affaire) { ui.toast("Cette décision n'est rattachée à aucune affaire.", "warning"); return null; }
  const trame = tramePourDecision(store, decision);
  const texteDeLaTrame = trame ? String(trame.Template_contenu || "").trim() : "";
  const row = store.addRow("Generateur", {
    Affaire: affaire.id,
    Template: trame ? trame.id : 0,
    Decision_liee: decision.id,
    Date: todayIso(),
    // La trame apporte son texte ; sans trame de décision, le squelette prend
    // sa place : visas, audience, DÉCIDE, articles. La signature, elle, vient
    // de la feuille de style du format — et, faute de trame, de la feuille
    // vierge, qui porte au moins l'en-tête de service et la signature : sans
    // elle, le squelette produirait un acte sans chapeau ni signataire.
    Feuille_de_style: trame ? "" : FEUILLE_VIERGE,
    Contenu: texteDeLaTrame ? "" : echafaudageDecision(store, decision),
  });
  if (row) {
    journaliser(store, { action: "creation", table: "Generateur", id: row.id, resume: "Texte de la décision créé." });
  }
  return row;
}

/**
 * La table des considérants existe-t-elle dans le document ? Elle est
 * facultative : l'outil livre son propre répertoire, et celui de
 * l'établissement ne s'y ajoute que s'il y a lieu. Tant qu'elle n'existe pas
 * dans un document Grist, l'écrire échouerait — on le dit avant, et l'on
 * propose de la créer.
 */
function tableConsiderantsDisponible() {
  const tables = documentTables();
  return !tables || tables.includes("Considerants");
}

/**
 * Affecte (ou retire) le secrétaire d'une ou plusieurs affaires.
 *
 * Les écritures sont groupées : `updateRowQuiet` enregistre et transmet chaque
 * ligne au document sans redessiner l'écran, et un seul rendu suit le lot — un
 * rendu par affaire serait insupportable sur un lot de plusieurs dizaines.
 * Un refus de Grist (document en lecture seule, ligne modifiée entre-temps)
 * remonte par le bandeau d'écriture habituel, pas d'ici.
 */
function attribuer(ids, secretaire) {
  const fiche = secretaire ? store.byId("Secretaires", secretaire) : null;
  const nom = fiche ? String(state.ctx?.v("Secretaires", fiche, "Nom_complet") || "").trim() : "";
  let faits = 0;
  for (const id of ids) {
    const affaire = store.byId("Affaires", id);
    if (!affaire) continue;
    if ((Number(affaire.Secretaire) || 0) === secretaire) continue;
    if (store.updateRowQuiet("Affaires", id, { Secretaire: secretaire })) faits += 1;
  }
  render();
  if (!faits) return false;
  const combien = `${faits} affaire${faits > 1 ? "s" : ""}`;
  const accord = faits > 1 ? "s" : "";
  ui.toast(secretaire
    ? `${combien} attribuée${accord} à ${nom || `#${secretaire}`}.`
    : `${combien} retirée${accord} de toute attribution.`);
  return true;
}

function submitAffaire() {
  const d = state.draft.affaire;
  const missing = REQUIRED_FIELDS.filter((c) => !d[c] && d[c] !== 0);
  if (missing.length) {
    ui.toast(`Champs obligatoires manquants : ${missing.map((c) => labelOf("Affaires", c)).join(", ")}`, "error");
    state.affaireStep = 2;
    render();
    return;
  }
  const sectionId = Number(d.Section);

  // La personne mise en cause : fiche choisie au répertoire, ou créée d'après
  // les champs saisis. Le régime de la section fixe son type par défaut.
  let personneId = Number(d.Mis_en_cause) || 0;
  let personneCreee = null;
  if (!personneId) {
    const p = state.draft.personne;
    const section = store.byId("Sections_disciplinaires", sectionId);
    const type = p.Type || (section?.Public === "Enseignants-chercheurs" ? "Personnel" : "Usager");
    personneCreee = store.addRow("Personnes", { ...p, Type: type });
    if (!personneCreee) return;
    personneId = personneCreee.id;
  }

  const numero = d.Numero && String(d.Numero).trim() ? String(d.Numero).trim() : nextNumero(store.db, sectionId);
  // Une affaire créée par un secrétaire lui revient : sans quoi elle
  // disparaîtrait aussitôt de sa propre liste, faute d'attribution.
  let secretaire = Number(d.Secretaire) || 0;
  let attribuee = false;
  if (!secretaire && !peutVoirTout(state)) {
    const fiche = mesFiches(store, state)[0];
    if (fiche) { secretaire = fiche.id; attribuee = true; }
  }
  state.modal = null;
  state.affaireStep = 1;
  state.draft.affaire = {};
  state.draft.personne = {};
  const affaire = store.addRow("Affaires", {
    ...d, Section: sectionId, Mis_en_cause: personneId, Numero: numero,
    Etat: d.Etat || "Pré-enregistrée", Secretaire: secretaire,
  });
  if (!affaire) return;
  state.sel.Affaires = affaire.id;
  journaliser(store, {
    action: "creation",
    table: "Affaires",
    id: affaire.id,
    resume: `Affaire ${numero} créée${personneCreee ? " avec une nouvelle fiche au répertoire" : ""}.`,
  });
  ui.toast(attribuee ? `Affaire ${numero} enregistrée : elle vous est attribuée.` : `Affaire ${numero} enregistrée.`);
  // Le dossier de pièces se déclare à part, et s'oublie : à la création, on sait
  // encore où sont les pièces — c'est le moment de le rappeler.
  if (!lienDossier(affaire)) {
    ui.toast("Dossier de pièces : déclarez son adresse depuis l'affaire — elle s'ouvrira ensuite d'un clic, ici et depuis le rôle de la séance.", "info");
  }
  navTo("affaires");
}

/**
 * Crée un enregistrement et le sélectionne.
 *
 * `store.addRow` déclenche un rendu **avant** que la sélection n'ait été
 * enregistrée : sans le rendu qui suit, le formulaire continuerait d'afficher
 * la fiche précédente, et les valeurs saisies aussitôt après seraient écrites
 * sur cette mauvaise fiche.
 */
function addAndSelect(table, data = {}) {
  const row = store.addRow(table, data);
  if (!row) return null;
  state.sel[table] = row.id;
  persistPrefs();
  render();
  return row;
}

function submitDocument() {
  const d = state.draft.document;
  if (!d.Affaire || !d.Template) {
    ui.toast("Choisissez une affaire puis une trame.", "error");
    return;
  }
  state.modal = null;
  state.draft.document = {};
  // Une trame de décision rédige une décision de l'affaire : lorsque la trame
  // porte la décision définitive, le document s'y rattache d'emblée. Les
  // décisions avant dire droit, elles, se choisissent (ou se créent) dans
  // l'espace de rédaction — une affaire en comporte autant que nécessaire.
  const ctx = new Context(store.db, store);
  const trame = d.Template ? store.byId("Trames", d.Template) : null;
  const champs = {
    Affaire: Number(d.Affaire),
    Template: Number(d.Template),
    Date: d.Date || todayIso(),
  };
  if (trame && ctx.v("Trames", trame, "Decision_definitive")) {
    const affaire = store.byId("Affaires", Number(d.Affaire));
    const decision = affaire ? decisionDefinitiveDe(ctx, affaire) : null;
    if (decision) champs.Decision_liee = decision.id;
  }
  const doc = store.addRow("Generateur", champs);
  state.sel.Generateur = doc.id;
  state.sel.Affaires = Number(d.Affaire);
  ui.toast("Document créé.");
  navTo(`documents/${doc.id}`);
}

/* ------------------------------------------------------------------ */
/* Export des documents (PDF, Word, OpenDocument)                      */
/* ------------------------------------------------------------------ */

const EXPORT_LABELS = { pdf: "PDF", docx: "Word", odt: "OpenDocument" };

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Titre et nom de fichier d'un document exporté.
 *
 * `anonyme` retire le nom de la personne mise en cause du nom du fichier, et le
 * remplace par la mention qui dit ce que le fichier est : une version anonyme
 * ne peut pas porter dans son nom celui qu'elle a effacé de son texte.
 */
function documentExportMeta(doc, { anonyme = false } = {}) {
  const ctx = state.ctx;
  const trame = doc.Template ? store.byId("Trames", doc.Template) : null;
  const affaire = store.byId("Affaires", doc.Affaire);
  const value = (table, rec, col) => (rec ? str(ctx.v(table, rec, col)) : "");
  const parts = [
    value("Trames", trame, "Type_court_") || (trame ? str(trame.Nom) : ""),
    trame ? str(trame.Objet) : "",
    value("Affaires", affaire, "Numero"),
    anonyme ? "" : value("Affaires", affaire, "Nom_complet"),
  ].filter(Boolean);
  const suffixe = anonyme ? " - anonyme" : "";
  return {
    title: parts.slice(0, 2).join(" — ") || "Document",
    filename: `${parts.join(" - ") || "document"} ${doc.Date || todayIso()}${suffixe}`,
  };
}

/**
 * Barre d'état de l'export, sous les boutons. Une page peut en afficher
 * plusieurs (l'en-tête des affaires et l'onglet Documents, par exemple) :
 * elles reçoivent toutes le même message, et les boutons sont désactivés
 * ensemble pendant la préparation.
 */
function setExportStatus(message, { busy = false } = {}) {
  for (const btn of document.querySelectorAll("[data-export]")) btn.disabled = busy;
  for (const status of document.querySelectorAll("[data-export-status]")) {
    status.hidden = !message;
    status.classList.toggle("app-export__status--busy", busy);
  }
  for (const text of document.querySelectorAll("[data-export-status-text]")) text.textContent = message || "";
}

/**
 * Le document que le bouton actionné demande d'exporter : le document généré
 * sélectionné, le rôle d'une séance, ou la liste d'affaires filtrée. Le bouton
 * porte son périmètre (`data-export-scope`) et, au besoin, la fiche visée.
 */
function exportTarget(el) {
  const scope = el?.dataset.exportScope || "document";
  // Les deux polices d'un export, décidées par la charte (voir charte.js) :
  // celle que Word et l'OpenDocument **nomment**, et celle que le PDF
  // **embarque** — ses polices voyagent dans le fichier, il ne peut pas se
  // contenter d'un nom.
  const polices = { font: policeDocumentNom(store.db), policePdf: policeDocumentEmbarquee(store.db) };
  if (scope === "role") {
    const seance = store.byId("Seances_d_examen", Number(el.dataset.record));
    if (!seance) return null;
    return {
      html: roleSeanceHtml(store.db, seance),
      meta: { title: "Rôle de la séance", filename: `role-seance ${seance.Date || todayIso()}`, ...polices },
    };
  }
  if (scope === "affaires") {
    const rows = filteredAffaires(store, state);
    const section = state.filters.affaireSection
      ? store.byId("Sections_disciplinaires", Number(state.filters.affaireSection))
      : null;
    return {
      html: listeAffairesHtml(store.db, rows, { section, query: state.filters.affaireQ || "" }),
      meta: { title: "Liste des affaires", filename: `liste-des-affaires ${todayIso()}`, ...polices },
    };
  }
  if (scope === "rapport") {
    const rapport = rapportActivite(store, state);
    return {
      html: rapportActiviteHtml(store, state),
      meta: {
        title: "Rapport d'activité",
        filename: `rapport-activite ${rapport.annee || "toutes-annees"}`,
        ...polices,
      },
    };
  }
  const doc = store.byId("Generateur", state.sel.Generateur);
  if (!doc) return null;
  // `preview: false` : ni la mise à l'échelle de l'aperçu ni son script n'ont
  // leur place dans un fichier exporté (voir `computeDocumentParts`).
  const { html } = computeDocumentParts(store.db, doc, { preview: false });
  // La version anonyme d'une décision définitive, quand la case de la barre
  // d'export est cochée : les personnes du dossier y sont désignées par
  // « A. B. », « B. C. »… (voir `anonymat.js`). Ailleurs, ou pour une pièce qui
  // ne s'y prête pas, `anonymiserDocument` ne renvoie rien et le document part
  // tel quel.
  const anonyme = Boolean(document.querySelector("[data-export-anonyme]")?.checked)
    ? anonymiserDocument(store.db, doc, html)
    : null;
  const meta = { ...documentExportMeta(doc, { anonyme: Boolean(anonyme) }), ...polices };
  return { html: anonyme ? anonyme.html : html, meta, anonyme: Boolean(anonyme) };
}

/**
 * Exporte un document imprimable dans l'un des trois formats et le télécharge.
 * La préparation dure quelques secondes (rendu du document, chargement des
 * bibliothèques) : un indicateur animé reste affiché tant qu'elle n'est pas
 * terminée.
 */
async function runExport(kind, el) {
  const label = EXPORT_LABELS[kind] || kind;
  setExportStatus(`Préparation du fichier ${label}…`, { busy: true });
  try {
    const target = exportTarget(el);
    if (!target) throw new Error("aucun document sélectionné");
    const result = await exportDocument(kind, target.html, target.meta);
    const manquantes = (result.missing || []).length;
    const substituees = result.substituees || [];
    if (kind === "pdf" && result.pdfA === false) {
      // NC-0017 : la conversion au format d'archivage a échoué, le PDF ordinaire
      // est conservé. Cela ne doit pas passer inaperçu — un dossier versé avec
      // un PDF non conforme est refusé par le service d'archives, et rien ne le
      // laissait voir.
      journaliser(store, {
        action: "export", table: null, id: null,
        resume: `Export PDF de « ${result.name} » : conversion PDF/A échouée, PDF ordinaire conservé.`,
      });
      ui.toast(`${label} exporté, mais la conversion au format d'archivage PDF/A a échoué : le fichier est un `
        + "PDF ordinaire. Il reste lisible et imprimable, mais il ne porte pas le marquage attendu pour un "
        + "versement. Réessayez, ou signalez-le avec le journal de diagnostic (Réglages › Données).", "warning");
    } else if (manquantes) {
      // Un document sans son bloc-marque de l'État ne peut pas partir sans un
      // mot : la cause est toujours la même, et le geste pour y remédier aussi.
      ui.toast(`${label} exporté, mais ${manquantes} image(s) n'ont pas pu y être intégrées : leur hébergeur `
        + "refuse l'intégration. Enregistrez l'image sur ce poste (Réglages › Sections, « Choisir une image "
        + "sur ce poste… ») : elle figurera alors dans tous les fichiers.", "warning");
    } else if (substituees.length) {
      // Le PDF porte ses polices dans le fichier : celles qui ne s'embarquent
      // pas — les noms choisis dans le texte, qui désignent des polices de
      // poste — y sont remplacées. Mieux vaut le dire que le laisser voir.
      ui.toast(`${label} exporté : ${result.name} (${formatBytes(result.bytes)}). La police choisie pour une `
        + `partie du texte (${substituees.join(", ")}) ne peut pas être jointe à un PDF : il la remplace par `
        + "celle des documents.", "warning");
    } else if (target.anonyme) {
      // Une sortie anonyme se dit : c'est ce qui distingue le fichier de celui
      // qu'on aurait obtenu sans la case, et ce qui prévient qu'il ne vaut pas
      // comme expédition.
      ui.toast(`${label} anonyme exporté : ${result.name} (${formatBytes(result.bytes)}). Les personnes du `
        + "dossier y sont désignées par A. B., B. C.…");
    } else {
      ui.toast(`${label} exporté : ${result.name} (${formatBytes(result.bytes)}).`);
    }
    setExportStatus("");
  } catch (err) {
    console.error(`Export ${label} :`, err);
    ui.toast(`Export ${label} impossible : ${err.message}`, "error");
    setExportStatus(`L'export ${label} a échoué : ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Export tabulaire (CSV, Excel)                                       */
/* ------------------------------------------------------------------ */

/**
 * Les lignes que le bouton emporte : celles qu'il désigne par leur
 * identifiant, dans leur ordre d'affichage — donc telles que la liste les
 * montre, filtres, tri et périmètre compris. Sans identifiant (les boutons
 * posés à côté d'une table dans « Réglages › Données »), c'est la table
 * entière.
 */
function lignesAEporter(table, el) {
  const ids = el?.dataset?.exportIds;
  // Bouton sans liste d'identifiants : c'est la table entière qu'il exporte
  // (les raccourcis de « Réglages › Données »). Une liste vide, elle, ne
  // désigne rien.
  if (ids === undefined) return store.table(table);
  const brut = String(ids).trim();
  if (!brut) return [];
  return brut.split(",").map((id) => store.byId(table, Number(id))).filter(Boolean);
}

/**
 * Met un export en attente : les boutons du groupe désactivés, son indicateur
 * visible. Un bouton isolé — la ligne d'une table — se désactive lui-même.
 */
function tableExportBusy(el, busy) {
  const groupe = el?.closest ? el.closest(".app-export-inline") : null;
  const boutons = groupe ? [...groupe.querySelectorAll("[data-export]")] : (el ? [el] : []);
  for (const bouton of boutons) bouton.disabled = busy;
  const indicateur = groupe?.querySelector("[data-export-spinner]");
  if (indicateur) indicateur.hidden = !busy;
}

/**
 * Listes calculées exportables : elles ne viennent d'aucune table du modèle —
 * on ne saurait donc les reconstruire depuis un nom de table — et sont
 * produites ici, à partir du même état que l'écran.
 */
const LISTES_EXPORT = {
  /* Échéances du calendrier : la grille du mois les tronque, le fichier les
     emporte toutes, dans l'ordre du temps. */
  echeances: () => {
    const evenements = evenementsCalendrier(store, state);
    // Le fichier porte le nom de la personne lorsqu'elle ne voit qu'une partie
    // du document : deux rétroplanings exportés du même poste ne doivent pas
    // porter le même nom (même règle que l'export d'agenda, voir `calendrier.js`).
    const qui = perimetreRestreint(store, state) ? ` — ${nomPerimetre(store, state)}` : "";
    return {
      nom: `Échéances${qui}`,
      entetes: ["Date", "Heure", "Catégorie", "Intitulé", "Lieu", "Détail"],
      lignes: evenements.map((e) => [e.date, e.heure, e.categorie, e.titre, e.lieu, e.resume]),
    };
  },
};

/**
 * Le tableau que le bouton demande d'exporter : une table, une liste calculée,
 * ou un tableau d'indicateurs du rapport d'activité.
 */
function tableauDuBouton(el) {
  const source = el?.dataset?.exportSource;
  // Tableaux du rapport d'activité : ils sont calculés pour la période
  // affichée, et désignés par leur identifiant (`data-export-source-id`).
  if (source === "rapport") {
    const id = String(el.dataset.exportSourceId || "");
    const t = rapportActivite(store, state).tableaux.find((x) => x.id === id);
    if (!t) return null;
    return { nom: el.dataset.exportNom || t.nom, entetes: t.entetes, lignes: t.lignes };
  }
  if (source) {
    const liste = LISTES_EXPORT[source] ? LISTES_EXPORT[source]() : null;
    if (!liste) return null;
    const nom = el.dataset.exportNom || liste.nom;
    return { ...liste, nom };
  }
  const table = el?.dataset?.exportTable;
  if (!table || !SCHEMA[table]) return null;
  const rows = lignesAEporter(table, el);
  const colonnes = String(el.dataset.exportCols || "").split(",").map((s) => s.trim()).filter(Boolean);
  const suffixe = el.dataset.exportSuffix || "";
  return {
    nom: `${SCHEMA[table].label}${suffixe ? ` — ${suffixe}` : ""}`,
    ...tableauExport(state.ctx, { table, rows, colonnes: colonnes.length ? colonnes : null }),
  };
}

/** Export d'une liste : un fichier CSV, ou un classeur Excel. */
async function runTableExport(kind, el) {
  const etiquette = kind === "xlsx" ? "Excel" : "CSV";
  const tableau = tableauDuBouton(el);
  if (!tableau) return;
  if (!tableau.lignes.length) {
    ui.toast("Il n'y a rien à exporter : la liste est vide.", "error");
    return;
  }
  tableExportBusy(el, true);
  try {
    const resultat = await exportTableauFichier(kind, { tableau, nom: tableau.nom });
    downloadBlob(resultat.blob, resultat.name);
    ui.toast(`${etiquette} exporté : ${resultat.lignes} ligne(s), ${resultat.name} (${formatBytes(resultat.blob.size)}).`);
  } catch (err) {
    console.error(`Export ${etiquette} (${tableau.nom}) :`, err);
    ui.toast(`Export ${etiquette} impossible : ${err.message}`, "error");
  } finally {
    tableExportBusy(el, false);
  }
}

/** Export de toute la base : un classeur Excel, ou une archive de CSV. */
async function runBaseExport(kind) {
  const etiquette = kind === "xlsx" ? "Excel" : "CSV";
  try {
    const resultat = await exportBaseFichier(kind, { ctx: state.ctx });
    downloadBlob(resultat.blob, resultat.name);
    ui.toast(`${etiquette} exporté : ${resultat.tables} table(s), ${resultat.lignes} ligne(s), ${resultat.name} (${formatBytes(resultat.blob.size)}).`);
  } catch (err) {
    console.error(`Export ${etiquette} de la base :`, err);
    ui.toast(`Export ${etiquette} impossible : ${err.message}`, "error");
  }
}

/* ------------------------------------------------------------------ */
/* Rapport d'activité : graphiques et tableaux d'indicateurs           */
/* ------------------------------------------------------------------ */

/** Octets d'une image en `data:` URL — un graphique est une image PNG. */
function octetsDeDataUrl(dataUrl) {
  const texte = String(dataUrl || "");
  const binaire = atob(texte.slice(texte.indexOf(",") + 1));
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/** La même image, en Blob — ce qu'attend `downloadBlob`. */
function blobDeDataUrl(dataUrl) {
  const type = (/^data:([^;]+)/.exec(String(dataUrl || "")) || [])[1] || "image/png";
  return new Blob([octetsDeDataUrl(dataUrl)], { type });
}

/** Le graphique que le bouton désigne, dans le rapport de la période affichée. */
function graphiqueDuBouton(el) {
  const id = String(el?.dataset?.graphique || "");
  return rapportActivite(store, state).graphiques.find((g) => g.id === id) || null;
}

/** L'image PNG d'un graphique : fond blanc et titre écrit dans l'image — un
    graphique exporté part dans un document, et un document s'imprime. */
function pngDuGraphique(graphique) {
  return graphiquePng(graphique.spec, { pourImpression: true, titre: true });
}

/**
 * Ajoute une ligne d'intervenant à l'affaire ouverte, de la qualité demandée.
 *
 * La qualité dit ce que l'on vient de **décider** : un membre de la section,
 * ou une personne hors section dont le nom s'écrira librement à côté du menu.
 * `intervenant-source` la tient ensuite à jour — choisir une fiche, c'est
 * choisir sa qualité —, de sorte qu'une ligne ne se lise jamais « Membre de la
 * section » tout en portant un nom saisi à la main.
 */
function ajouterIntervenant(qualite) {
  const affaire = state.sel.Affaires;
  if (!affaire) return null;
  const row = store.addRow("Intervenants", {
    Affaire: Number(affaire),
    Role: "Membre de la formation",
    Qualite: qualite,
    Statut: "Désigné",
    Date_de_designation: todayIso(),
  });
  if (row) {
    ui.toast(qualite === "Hors section"
      ? "Intervenant hors section ajouté : saisissez son nom, et précisez son rôle."
      : "Intervenant ajouté : désignez-le par un membre de la section, ou saisissez son nom.");
  }
  return row;
}

/**
 * Table des actions de l'interface.
 *
 * Règle de rendu : un rendu déclenché par un **champ** (choix d'une valeur qui
 * change ce qui s'affiche ensuite, à l'intérieur d'un formulaire) garde la vue
 * en place — `render({ keepFocus: true })`, position de défilement et focus
 * compris. `keepFocus: false` est réservé aux cas où l'écran change de contenu
 * et se relit depuis le haut : la navigation, le changement d'étape d'un
 * assistant, l'ouverture d'une analyse d'import, ou une opération qui remanie
 * la fiche (jonction des affaires, texte d'un document remis à la trame).
 * Autrement dit, finir de remplir un champ ne renvoie jamais l'utilisateur en
 * haut de la page.
 */
const ACTIONS = {
  "close-dialog": () => closeModal(),

  // Affichage : ces deux commandes n'écrivent aucune donnée et restent donc
  // accessibles quel que soit le rôle.
  "toggle-theme": () => { toggleTheme(); },

  "toggle-fullscreen": async () => {
    try {
      await toggleFullscreen();
    } catch (err) {
      // Cadre sans autorisation plein écran, geste non reconnu : mieux vaut
      // l'annoncer que de laisser croire à une panne de l'outil.
      console.error("Passage en plein écran refusé :", err);
      ui.toast("Le navigateur a refusé le passage en plein écran.", "warning");
    }
  },

  "new-affaire": () => {
    state.draft.affaire = { Date_de_saisine: todayIso(), Etat: "Pré-enregistrée", Voie: "Section disciplinaire" };
    state.draft.personne = {};
    state.affaireStep = 1;
    openModal("affaire");
  },

  /**
   * Bascule un bloc de la fiche d'une affaire entre lecture et saisie.
   * `data-record` porte la clé du bloc (« saisine », « convocation »…), et non
   * un identifiant de ligne : ce qui s'ouvre est une **partie** de la fiche.
   */
  "affaire-edition": (el) => {
    const cle = String(el.dataset.record || "");
    if (!cle) return;
    if (state.affaires.edition[cle]) delete state.affaires.edition[cle];
    else state.affaires.edition[cle] = true;
    render();
  },

  // Choix d'une fiche du répertoire, ou création d'une nouvelle personne.
  "draft-personne": (el) => {
    state.draft.affaire.Mis_en_cause = Number(el.value) || 0;
    render({ keepFocus: true });
  },

  "affaire-step-2": () => {
    const d = state.draft.affaire;
    if (!d.Mis_en_cause) {
      const p = state.draft.personne;
      const manquants = PERS_REQUIRED.filter((c) => !String(p[c] ?? "").trim());
      if (manquants.length) {
        ui.toast(`À compléter : ${manquants.map((c) => labelOf("Personnes", c)).join(", ")}`, "error");
        return;
      }
    }
    if (d.Section && !d.Numero) d.Numero = nextNumero(store.db, Number(d.Section));
    if (!d.Date_de_saisine) d.Date_de_saisine = todayIso();
    state.affaireStep = 2;
    render({ keepFocus: false });
  },

  "affaire-step-1": () => {
    state.affaireStep = 1;
    render({ keepFocus: false });
  },

  "affaire-submit": () => submitAffaire(),

  "new-document": () => {
    state.draft.document = { Affaire: state.sel.Affaires || "", Template: "", Date: todayIso() };
    openModal("document");
  },

  "document-affaire": (el) => {
    state.draft.document.Affaire = Number(el.value) || "";
    state.draft.document.Template = "";
    render({ keepFocus: true });
  },

  "document-trame": (el) => {
    state.draft.document.Template = Number(el.value) || "";
    // Redessiner fait apparaître l'auteur et le destinataire que la trame
    // programme : ils se lisent dès l'entrée, avant même d'ouvrir le document.
    render({ keepFocus: true });
  },

  /**
   * Ouvre le calendrier du navigateur pour le champ de date voisin.
   *
   * Le champ de texte et le champ natif masqué sont côte à côte : le second
   * sert de sélecteur, jamais de champ de saisie. Si le navigateur ne sait pas
   * ouvrir un sélecteur, le champ natif est découvert le temps du choix.
   */
  "date-picker": (el) => {
    const champ = document.getElementById(el.dataset.datePour);
    const natif = el.closest(".app-date")?.querySelector(".app-date__natif");
    if (!champ || !natif) return;
    natif.value = parseDateSaisie(champ.value) || todayIso();
    if (typeof natif.showPicker === "function") {
      try { natif.showPicker(); return; } catch { /* sélecteur refusé : on découvre le champ */ }
    }
    natif.classList.add("app-date__natif--ouvert");
    natif.focus();
  },

  /** Reporte dans le champ de texte la date choisie au calendrier. */
  "date-picked": (el) => {
    const champ = document.getElementById(el.dataset.datePicker);
    el.classList.remove("app-date__natif--ouvert");
    if (!champ || !el.value) return;
    champ.value = formatDateSaisie(el.value);
    champ.dispatchEvent(new Event("change", { bubbles: true }));
  },

  "document-submit": () => submitDocument(),

  /* Composition de la formation ------------------------------------- */

  "add-intervenant": () => ajouterIntervenant("Membre de la section"),

  /* Une personne qui n'appartient pas à la section — le rapporteur pris hors
     de la section, par exemple — se décide ici : la ligne naît « Hors
     section », et son nom s'écrit librement. C'est la seule façon d'ajouter
     une personne que la liste ne propose pas (voir `intervenantSourceSelect`). */
  "add-intervenant-hors-section": () => ajouterIntervenant("Hors section"),

  /**
   * La liste des intervenants ne propose que des membres de la section
   * (`m{id}`) : c'est d'eux que la formation se compose. Une fiche qui porte
   * encore une personne extérieure (`p{id}`, choisie avant que la règle ne
   * change) garde son option, et ce geste reste compris ici : le choix se
   * traduit en deux colonnes, dont l'une est vidée — un intervenant ne peut
   * pas être à la fois membre et personne extérieure.
   */
  "intervenant-source": (el) => {
    const id = Number(el.dataset.record);
    const value = String(el.value || "");
    const membre = value.startsWith("m") ? Number(value.slice(1)) || 0 : 0;
    const personne = value.startsWith("p") ? Number(value.slice(1)) || 0 : 0;
    const row = store.byId("Intervenants", id);
    if (!row) return;
    const patch = { Membre: membre, Personne: personne, Nom_libre: membre || personne ? "" : row.Nom_libre || "" };
    // La qualité suit la source plutôt que d'être à ressaisir (voir
    // `qualiteIntervenant`, procedure.js).
    patch.Qualite = qualiteIntervenant(row.Qualite, { membre });
    store.updateRow("Intervenants", id, patch);
  },

  /* Reprise de la composition d'origine pour une affaire, à l'unité. Même
     conversion que celle de l'outil d'import, mais limitée à cette affaire. */
  "convertir-commissions": () => {
    const affaireId = Number(state.sel.Affaires);
    const affaire = store.byId("Affaires", affaireId);
    if (!affaire) return;
    const heritage = store.table("Commissions").filter((c) => Number(c.Affaire) === affaireId);
    if (!heritage.length) { ui.toast("Aucune composition d'origine pour cette affaire.", "info"); return; }
    if (store.table("Intervenants").some((x) => Number(x.Affaire) === affaireId)) {
      ui.toast("Cette affaire a déjà des intervenants.", "warning");
      return;
    }
    if (!confirm(`Reprendre ${heritage.length} membre(s) de la composition d'origine dans les intervenants ?\nLa table d'origine n'est pas modifiée.`)) return;
    for (const c of heritage) {
      const membre = store.byId("Membres", c.Membre);
      store.addRow("Intervenants", {
        Affaire: affaireId,
        Role: LEGACY_ROLES_INTERVENANT[c.Role] || "Membre de la formation",
        Qualite: "Membre de la section",
        Membre: Number(c.Membre) || 0,
        Nom_libre: membre ? "" : str(c.Membre),
        Statut: "Désigné",
        Date_de_designation: affaire.Date_de_saisine || "",
      });
    }
    journaliser(store, {
      action: "reprise",
      table: "Intervenants",
      id: null,
      resume: `${heritage.length} intervenant(s) repris de la composition d'origine de l'affaire ${str(affaire.Numero)}.`,
    });
    ui.toast(`${heritage.length} intervenant(s) repris depuis la composition d'origine.`);
  },

  /* Reprise de l'ancien champ « Rapport d'instruction ». Le rapport n'est plus
     un champ de l'affaire mais un **document** : c'est la pièce qui porte son
     texte et sa date. La reprise est un geste de l'utilisateur, jamais
     automatique — créer la pièce au chargement d'une base écrirait une ligne
     que le document Grist ne connaîtrait pas, et la rejouerait à chaque fois.
     Une fois le document créé, les deux colonnes d'origine sont vidées : leur
     contenu vit désormais dans la pièce, et l'ancien champ disparaît. */
  "reprendre-rapport": (el) => {
    const affaire = store.byId("Affaires", Number(el?.dataset?.record) || Number(state.sel.Affaires));
    if (!affaire) return;
    const texte = str(affaire.Rapport_d_instruction);
    const date = affaire.Date_du_rapport_d_instruction || "";
    if (!texte.trim() && !date) {
      ui.toast("Cette affaire ne porte pas d'ancien rapport d'instruction.", "info");
      return;
    }
    // Le rapport se produit avec la trame du format « Rapport d'instruction ».
    // Il en existe une par procédure : on retient celle du régime de la
    // section, à défaut la première.
    const rapports = store.table("Trames").filter((t) => String(store.byId("Types_Trames", t.Type)?.Categorie || "") === "Rapport");
    if (!rapports.length) {
      ui.toast("Aucune trame de rapport d'instruction n'est installée. Voyez Réglages › Trames.", "warning");
      return;
    }
    const ctx = state.ctx || new Context(store.db, store);
    const regime = String(ctx.v("Affaires", affaire, "Section_Public") || "").trim();
    const trame = rapports.find((t) => String(t.Public || "").trim() === regime) || rapports[0];
    if (!confirm(`Reprendre l'ancien rapport d'instruction dans un document « ${str(trame.Nom)} » ?\n`
      + "Les champs « Rapport d'instruction » et sa date seront vidés de l'affaire : leur contenu vit désormais dans le document.")) return;
    const doc = store.addRow("Generateur", {
      Affaire: Number(affaire.id),
      Template: trame.id,
      Date: date || affaire.Date_de_saisine || todayIso(),
      Contenu: texte,
    });
    if (!doc) return;
    store.updateRow("Affaires", affaire.id, { Rapport_d_instruction: "", Date_du_rapport_d_instruction: null });
    journaliser(store, {
      action: "reprise",
      table: "Generateur",
      id: doc.id,
      resume: `Ancien rapport d'instruction repris dans un document pour l'affaire ${str(affaire.Numero)}.`,
    });
    state.sel.Generateur = doc.id;
    persistPrefs();
    ui.toast("Le rapport d'instruction est désormais un document.");
    navTo(`documents/${doc.id}`);
  },

  /* Personnes du dossier -------------------------------------------- */

  "add-implication": () => {
    if (!state.sel.Affaires) return;
    store.addRow("Implications", { Affaire: Number(state.sel.Affaires), Role: "Témoin" });
  },

  /**
   * Crée une fiche au répertoire et la relie à l'affaire comme personne mise
   * en cause. Le type suit le régime de la section : un usager pour une section
   * « Usagers », un personnel pour une section d'enseignants-chercheurs.
   */
  "creer-personne": () => {
    const affaire = store.byId("Affaires", state.sel.Affaires);
    if (!affaire) return;
    const section = affaire.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
    const row = store.addRow("Personnes", {
      Type: section?.Public === "Enseignants-chercheurs" ? "Personnel" : "Usager",
    });
    if (!row) return;
    store.updateRow("Affaires", affaire.id, { Mis_en_cause: row.id });
    state.sel.Personnes = row.id;
    journaliser(store, { action: "creation", table: "Personnes", id: row.id, resume: "Fiche créée depuis une affaire." });
    ui.toast("Fiche créée : complétez son identité.");
  },

  /**
   * Ouverture de la fenêtre de jonction. L'affaire d'où l'on agit sera
   * l'affaire de tête, sauf si elle appartient déjà à une jonction : c'est
   * alors la tête de ce groupe qui portera la décision commune.
   */
  "joindre-affaire": () => {
    const affaire = store.byId("Affaires", state.sel.Affaires);
    if (!affaire) { ui.toast("Choisissez d'abord une affaire.", "warning"); return; }
    state.draft.jonction = { Affaire: affaire.id, Affaires_jointes: [], Date_de_la_jonction: todayIso(), Motif: "" };
    openModal("jonction");
  },

  /**
   * Enregistre la jonction : les affaires choisies rejoignent celle d'où l'on
   * agit. Une affaire n'appartient qu'à une jonction — celles qui en ont déjà
   * une sont écartées, et l'utilisateur en est averti plutôt que de voir sa
   * sélection silencieusement réduite.
   */
  "jonction-submit": () => {
    const d = state.draft.jonction || {};
    const affaire = store.byId("Affaires", Number(d.Affaire) || 0);
    if (!affaire) { ui.toast("Aucune affaire sélectionnée.", "error"); return; }
    const choisies = [...new Set((d.Affaires_jointes || []).map(Number).filter(Boolean))];
    if (!choisies.length) { ui.toast("Choisissez au moins une affaire à joindre.", "error"); return; }
    const existante = jonctionDe(store.db, affaire);
    const retenues = [];
    const ecartees = [];
    for (const id of choisies) {
      const x = store.byId("Affaires", id);
      if (!x) continue;
      if (Number(x.Section) !== Number(affaire.Section)) {
        ecartees.push(`${str(x.Numero) || `#${x.id}`} (autre section)`);
        continue;
      }
      const deja = jonctionDe(store.db, x);
      if (deja && Number(deja.id) !== Number(existante?.id)) {
        ecartees.push(`${str(x.Numero) || `#${x.id}`} (déjà jointe)`);
        continue;
      }
      if (!retenues.some((r) => r.id === x.id)) retenues.push(x);
    }
    if (!retenues.length) {
      ui.toast(`Aucune affaire à joindre : ${ecartees.join(", ")}.`, "error");
      return;
    }
    // La fenêtre se ferme **avant** l'écriture : le rendu qui suit l'écriture
    // ne doit plus la dessiner (voir `submitAffaire`, `submitDocument`).
    state.modal = null;
    state.draft.jonction = {};
    const numeros = retenues.map((x) => str(x.Numero) || `#${x.id}`);
    if (existante) {
      const tete = Number(existante.Affaire_de_tete) || affaire.id;
      const liste = [...new Set([...(existante.Affaires_jointes || []).map(Number), ...retenues.map((x) => x.id)])]
        .filter((id) => id && id !== tete);
      store.updateRow("Jonctions", existante.id, {
        Affaires_jointes: liste,
        Date_de_la_jonction: d.Date_de_la_jonction || existante.Date_de_la_jonction || todayIso(),
        Motif: d.Motif ?? existante.Motif,
      });
      journaliser(store, {
        action: "modification", table: "Jonctions", id: existante.id,
        resume: `Affaire(s) n° ${numeros.join(", ")} jointe(s) au groupe de l'affaire n° ${str(affaire.Numero) || affaire.id}.`,
      });
      ui.toast(`${numeros.length} affaire(s) ajoutée(s) à la jonction.`);
    } else {
      const row = store.addRow("Jonctions", {
        Affaire_de_tete: affaire.id,
        Affaires_jointes: retenues.map((x) => x.id),
        Date_de_la_jonction: d.Date_de_la_jonction || todayIso(),
        Motif: d.Motif || "",
      });
      if (!row) return;
      journaliser(store, {
        action: "creation", table: "Jonctions", id: row.id,
        resume: `Affaires n° ${[str(affaire.Numero) || affaire.id, ...numeros].join(", ")} jointes : une seule décision les tranchera.`,
      });
      ui.toast(`Affaires jointes : une seule décision tranchera le fond pour l'ensemble.`);
    }
    if (ecartees.length) ui.toast(`Écartée(s) : ${ecartees.join(", ")}.`, "warning");
    render({ keepFocus: false });
  },

  /**
   * Déjoindre l'affaire courante. C'est le geste inverse exact de la jonction :
   * l'affaire redevient une affaire ordinaire, et la décision commune ne s'y
   * applique plus. Si elle était l'affaire de tête, la tête passe à une autre
   * affaire du groupe ; s'il ne devait en rester qu'une, la jonction est
   * simplement défaite. Aucune donnée n'est supprimée dans aucun cas.
   */
  "dejoindre-affaire": () => {
    const affaire = store.byId("Affaires", state.sel.Affaires);
    const jonction = affaire ? jonctionDe(store.db, affaire) : null;
    if (!jonction) return;
    const ctx = new Context(store.db, store);
    const autres = affairesDeJonction(ctx.db, jonction).filter((x) => Number(x.id) !== Number(affaire.id));
    const numeros = (liste) => liste.map((x) => str(x.Numero) || `#${x.id}`).join(", ");
    const etaitTete = Number(jonction.Affaire_de_tete) === Number(affaire.id);

    if (!autres.length) {
      if (!confirm("Cette affaire est la dernière de la jonction : celle-ci sera défaite.\n"
        + "Elle sera jugée seule. Aucune donnée n'est supprimée.")) return;
      store.deleteRow("Jonctions", jonction.id);
    } else if (etaitTete) {
      if (!confirm(`L'affaire n° ${str(affaire.Numero) || affaire.id} quitte la jonction et n'en est plus `
        + `l'affaire de tête : l'affaire n° ${str(autres[0].Numero) || autres[0].id} prendra la tête.\n`
        + "La décision commune reste attachée à l'affaire qui la porte : vérifiez-la après la "
        + "modification, et déplacez-la sur la nouvelle tête si nécessaire.")) return;
      store.updateRow("Jonctions", jonction.id, {
        Affaire_de_tete: autres[0].id,
        Affaires_jointes: autres.slice(1).map((x) => x.id),
      });
    } else {
      if (!confirm(`Déjoindre l'affaire n° ${str(affaire.Numero) || affaire.id} ?\n`
        + "Elle sera jugée seule : la décision commune ne s'y appliquera plus.\n"
        + "Aucune donnée n'est supprimée — elle pourra être jointe à nouveau.")) return;
      if (autres.length < 2) {
        // Il ne resterait qu'une affaire : une jonction à une seule affaire
        // n'a plus d'objet.
        store.deleteRow("Jonctions", jonction.id);
      } else {
        store.updateRow("Jonctions", jonction.id, {
          Affaires_jointes: autres
            .filter((x) => Number(x.id) !== Number(jonction.Affaire_de_tete))
            .map((x) => x.id),
        });
      }
    }
    journaliser(store, {
      action: "modification", table: "Jonctions", id: jonction.id,
      resume: `Affaire n° ${str(affaire.Numero) || affaire.id} déjointe.`,
    });
    ui.toast(`Affaire n° ${str(affaire.Numero) || affaire.id} déjointe : elle est désormais jugée seule.`);
    render({ keepFocus: false });
  },

  /** Défaire la jonction entière : chaque affaire redevient indépendante. */
  "defaire-jonction": () => {
    const affaire = store.byId("Affaires", state.sel.Affaires);
    const jonction = affaire ? jonctionDe(store.db, affaire) : null;
    if (!jonction) return;
    const ctx = new Context(store.db, store);
    const membres = affairesDeJonction(ctx.db, jonction);
    const numeros = membres.map((x) => str(x.Numero) || `#${x.id}`);
    if (!confirm(`Défaire la jonction des affaires n° ${numeros.join(", ")} ?\n`
      + "Chacune sera jugée séparément : la décision commune ne s'appliquera plus qu'à l'affaire qui la "
      + "porte.\nAucune donnée n'est supprimée, et la jonction pourra être refaite.")) return;
    store.deleteRow("Jonctions", jonction.id);
    journaliser(store, {
      action: "suppression", table: "Jonctions", id: jonction.id,
      resume: `Jonction des affaires n° ${numeros.join(", ")} défaite.`,
    });
    ui.toast("Jonction défaite : les affaires sont de nouveau indépendantes.");
    render({ keepFocus: false });
  },

  /**
   * Fait de l'affaire courante l'affaire de tête. La décision commune se saisit
   * désormais chez elle — la décision déjà enregistrée, elle, ne se déplace
   * pas : elle reste attachée à l'affaire qui la portait.
   */
  "jonction-tete": () => {
    const affaire = store.byId("Affaires", state.sel.Affaires);
    const jonction = affaire ? jonctionDe(store.db, affaire) : null;
    if (!jonction || Number(jonction.Affaire_de_tete) === Number(affaire.id)) return;
    const ctx = new Context(store.db, store);
    const membres = affairesDeJonction(ctx.db, jonction);
    const ancienne = membres.find((x) => Number(x.id) === Number(jonction.Affaire_de_tete));
    const decision = ancienne ? decisionDefinitiveDe(ctx, ancienne) : null;
    if (!confirm(`Faire de l'affaire n° ${str(affaire.Numero) || affaire.id} l'affaire de tête du groupe ?\n`
      + "C'est elle qui portera la décision commune, et dont le numéro identifiera l'ensemble.\n"
      + (decision
        ? "Attention : une décision définitive est déjà enregistrée sur l'affaire de tête actuelle. "
          + "Elle reste attachée à cette affaire — l'outil ne la déplace pas."
        : ""))) return;
    store.updateRow("Jonctions", jonction.id, {
      Affaire_de_tete: affaire.id,
      Affaires_jointes: membres.filter((x) => Number(x.id) !== Number(affaire.id)).map((x) => x.id),
    });
    journaliser(store, {
      action: "modification", table: "Jonctions", id: jonction.id,
      resume: `L'affaire n° ${str(affaire.Numero) || affaire.id} devient l'affaire de tête de la jonction.`,
    });
    ui.toast(`L'affaire n° ${str(affaire.Numero) || affaire.id} porte désormais la décision commune.`);
    render({ keepFocus: false });
  },

  /**
   * Décision définitive de l'affaire : une seule. La seconde décision d'une
   * affaire est, par nature, une décision avant dire droit (report, supplément
   * d'instruction) — l'action le dit plutôt que de créer un doublon.
   *
   * Lorsque l'affaire est jointe, la décision se crée sur son **affaire de
   * tête** : c'est la décision commune, et c'est l'affaire de tête que
   * désignent le registre des décisions, les recours et les documents.
   */
  "add-decision": () => {
    if (!state.sel.Affaires) return;
    const affaire = store.byId("Affaires", state.sel.Affaires);
    if (!affaire) return;
    const ctx = new Context(store.db, store);
    const porteuse = affairePorteuseDeLaDecision(ctx, affaire);
    const jointe = Number(porteuse.id) !== Number(affaire.id);
    const existantes = decisionsDefinitivesDe(ctx, porteuse);
    if (existantes.length) {
      ui.toast(jointe
        ? `Une décision définitive est déjà enregistrée : c'est la décision commune, portée par `
          + `l'affaire n° ${str(porteuse.Numero) || porteuse.id}. Elle vaut pour toutes les affaires jointes.`
        : "Une décision définitive est déjà enregistrée : une affaire n'en comporte qu'une. "
          + "Pour un report ou un supplément d'instruction, utilisez « Ajouter une décision avant dire droit ».",
      "warning");
      return;
    }
    const row = store.addRow("Decisions", {
      Affaire: porteuse.id,
      Nature: "Sanction",
      Date_du_delibere: todayIso(),
      Date_de_notification: todayIso(),
    });
    if (row) {
      journaliser(store, {
        action: "creation", table: "Decisions", id: row.id,
        resume: jointe
          ? `Décision définitive commune enregistrée sur l'affaire de tête n° ${str(porteuse.Numero) || porteuse.id}.`
          : "Décision définitive enregistrée.",
      });
    }
  },

  /**
   * Décision avant dire droit : elle règle la marche de l'instance (report,
   * supplément d'instruction, expertise) sans trancher le fond. Elle ne
   * compte donc pas comme la décision définitive de l'affaire.
   */
  "add-decision-interlocutoire": () => {
    if (!state.sel.Affaires) return;
    const row = store.addRow("Decisions", {
      Affaire: Number(state.sel.Affaires),
      Nature: NATURE_INTERLOCUTOIRE,
      Date_du_delibere: todayIso(),
    });
    if (row) journaliser(store, { action: "creation", table: "Decisions", id: row.id, resume: "Décision avant dire droit enregistrée." });
  },

  /**
   * Enregistre la décision que rédige un document. La **nature suit la trame** :
   * seule la trame qui porte le jugement (`Decision_definitive`) crée la
   * décision définitive — unique dans l'affaire, et, lorsqu'elle est jointe,
   * portée par l'affaire de tête ; les autres trames de format « Décision »
   * rédigent une décision **avant dire droit**, que l'affaire peut porter en
   * nombre, et qui n'est pas susceptible de recours. Le document est lié à la
   * décision créée : son texte lira celle-là.
   */
  "doc-decision-creer": (el) => {
    const doc = store.byId("Generateur", Number(el.dataset.record))
      || store.byId("Generateur", state.sel.Generateur);
    const affaire = doc ? store.byId("Affaires", doc.Affaire) : null;
    if (!affaire) { ui.toast("Ce document n'est rattaché à aucune affaire.", "warning"); return; }
    const ctx = new Context(store.db, store);
    const trame = doc.Template ? store.byId("Trames", doc.Template) : null;
    const definitive = Boolean(trame && ctx.v("Trames", trame, "Decision_definitive"));

    // Décision avant dire droit : elle règle la marche de l'instance (report,
    // supplément d'instruction, expertise) sans trancher le fond. Une affaire en
    // comporte autant que nécessaire, et elle ne porte aucun délai de recours.
    if (!definitive) {
      const row = store.addRow("Decisions", {
        Affaire: Number(affaire.id),
        Nature: NATURE_INTERLOCUTOIRE,
        Date_du_delibere: todayIso(),
      });
      if (!row) return;
      store.updateRow("Generateur", doc.id, { Decision_liee: row.id });
      journaliser(store, {
        action: "creation", table: "Decisions", id: row.id,
        resume: `Décision avant dire droit enregistrée depuis un document (affaire ${str(affaire.Numero)}).`,
      });
      ui.toast("Décision avant dire droit enregistrée : elle se complète ici comme dans l'onglet « Décision ».");
      return;
    }

    const porteuse = affairePorteuseDeLaDecision(ctx, affaire);
    const jointe = Number(porteuse.id) !== Number(affaire.id);
    const existantes = decisionsDefinitivesDe(ctx, porteuse);
    if (existantes.length > 1) {
      ui.toast("Plusieurs décisions définitives sont déjà enregistrées : une seule est admise.", "warning");
      return;
    }
    if (existantes.length === 1) {
      ui.toast(jointe
        ? `Une décision définitive est déjà enregistrée : c'est la décision commune, portée par l'affaire n° ${str(porteuse.Numero) || porteuse.id}.`
        : "Une décision définitive est déjà enregistrée pour cette affaire.", "info");
      return;
    }
    const row = store.addRow("Decisions", {
      Affaire: porteuse.id,
      Nature: "Sanction",
      Date_du_delibere: todayIso(),
      Date_de_notification: todayIso(),
    });
    if (!row) return;
    store.updateRow("Generateur", doc.id, { Decision_liee: row.id });
    journaliser(store, {
      action: "creation", table: "Decisions", id: row.id,
      resume: jointe
        ? `Décision définitive commune enregistrée depuis un document (affaire de tête ${str(porteuse.Numero)}).`
        : `Décision définitive enregistrée depuis un document (affaire ${str(affaire.Numero)}).`,
    });
    ui.toast(jointe
      ? "Décision commune enregistrée sur l'affaire de tête : elle se complète ici comme dans l'onglet « Décision »."
      : "Décision définitive enregistrée : elle se complète ici comme dans l'onglet « Décision ».");
  },

  "add-recours": () => {
    const affaire = store.byId("Affaires", state.sel.Affaires);
    const decision = affaire ? decisionDefinitiveDe(new Context(store.db, store), affaire) : null;
    if (!decision) { ui.toast("Enregistrez d'abord une décision définitive.", "warning"); return; }
    // Seule une décision qui prononce une sanction ou l'abandon des poursuites
    // se conteste : un classement, une relaxe ou une mesure avant dire droit
    // n'ouvrent aucun recours.
    if (!estSusceptibleDeRecours(decision)) {
      ui.toast("Seule une décision prononçant une sanction ou l'abandon des poursuites peut faire l'objet d'un recours.",
        "warning");
      return;
    }
    // La voie de recours suit le public de la section : le tribunal administratif
    // pour un usager, le CNESER — ou le CNESERAAV dans un établissement agricole
    // — pour un enseignant-chercheur.
    const section = affaire.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
    store.addRow("Recours", {
      Affaire: decision.Affaire, Decision: decision.id, Issue: "En cours",
      Juridiction: juridictionRecours(section).court,
    });
  },

  /* Catalogues et délais -------------------------------------------- */

  "installer-parametres": () => {
    if (store.table("Parametres").length) { ui.toast("Les seuils sont déjà installés.", "info"); return; }
    for (const p of parametresParDefaut()) store.addRow("Parametres", p);
    journaliser(store, { action: "installation", table: "Parametres", id: null, resume: "Seuils par défaut installés." });
    ui.toast("Seuils par défaut installés.");
  },

  /**
   * Rattrapage des trames et types de trames livrés par défaut sur un document
   * installé avant leur ajout. Rien n'est dupliqué : le rapprochement se fait
   * sur le nom et la procédure visée.
   */
  "installer-trames-defaut": () => {
    const types = typesTramesParDefautManquants(store.db);
    const trames = tramesParDefautManquantes(store.db);
    if (!types.length && !trames.length) {
      ui.toast("Les trames par défaut sont déjà installées.", "info");
      return;
    }
    if (!confirm(`Installer ${trames.length} trame(s) et ${types.length} type(s) de trame livrés par défaut ?\n`
      + "Les trames et types déjà présents ne sont pas dupliqués.")) return;
    const ajoutees = installerTramesParDefaut();
    journaliser(store, {
      action: "installation", table: "Trames", id: null,
      resume: `${ajoutees} trame(s) et ${types.length} type(s) de trame par défaut installés.`,
    });
    ui.toast(`${ajoutees} trame(s) par défaut installée(s).`);
  },

  /**
   * Aligne les catalogues des sanctions et des motifs sur les textes
   * applicables : les entrées livrées par défaut qui manquent sont ajoutées,
   * celles qui portent un libellé livré sont mises à jour — groupe, régime,
   * tutelle, durée, sursis, texte de référence. Les lignes propres à
   * l'établissement ne sont pas touchées, et rien n'est supprimé. Le détail des
   * textes repris est en tête de `regimes.js`.
   */
  "aligner-catalogues": () => {
    const plans = ["Sanctions", "Motifs"].map((table) => [table, planAlignementCatalogue(table, store.db)]);
    const ajouts = plans.reduce((n, [, p]) => n + p.ajouts.length, 0);
    const maj = plans.reduce((n, [, p]) => n + p.modifications.length, 0);
    if (!ajouts && !maj) {
      ui.toast("Les catalogues suivent déjà les textes applicables.", "info");
      return;
    }
    if (!confirm("Aligner les catalogues sur les textes appliqués par l'outil ?\n"
      + `${ajouts} entrée(s) ajoutée(s), ${maj} entrée(s) mise(s) à jour.\n`
      + "Les lignes propres à votre établissement ne sont pas touchées, et rien n'est supprimé.")) return;
    for (const [table, plan] of plans) {
      for (const ligne of plan.ajouts) store.addRow(table, ligne);
      for (const ligne of plan.modifications) store.updateRow(table, ligne.id, ligne.apres);
    }
    journaliser(store, {
      action: "installation",
      table: null,
      id: null,
      resume: `Catalogues des sanctions et des motifs alignés sur les textes : ${ajouts} entrée(s) ajoutée(s), ${maj} mise(s) à jour.`,
    });
    ui.toast(`${ajouts} entrée(s) ajoutée(s), ${maj} mise(s) à jour.`);
  },

  /**
   * Aligne la base sur les **contenus livrés** que l'outil apporte avec lui
   * (NC-0005) : catalogues (sanctions, motifs), trames et formats. Une base
   * installée depuis des mois ne recevait jamais une correction apportée
   * ensuite à un modèle. Rien n'est écrasé : les lignes propres à
   * l'établissement ne sont pas touchées, et le **texte** d'une trame —
   * `Template_contenu`, `Template_brut`, `Feuille_de_style` — est laissé tel
   * quel ; seuls le format, l'auteur et le destinataire d'une trame livrée
   * sont remis d'aplomb (voir `planAlignementTrames`). La signature des
   * contenus est ensuite mémorisée : l'avis ne revient pas.
   */
  /**
   * Aligne la base sur les contenus livrés (NC-0005, NC-0026).
   *
   * `data-record` choisit la portée : « ajouts » (défaut) n'ajoute que les
   * éléments livrés **manquants** — les corrections de champs sont alors
   * laissées de côté, car elles réécrivent des lignes que l'établissement a pu
   * adapter ; « tout » ajoute **et** corrige. Les deux cas sont montrés ligne à
   * ligne dans le panneau, et le Journal enregistre chaque ligne touchée, non
   * un total.
   */
  "aligner-contenus": (el) => {
    const mode = String(el?.dataset?.record || "ajouts");
    const plan = planAlignementContenus(store.db);
    if (planEstVide(plan)) {
      prefs.contenusSignature = signatureContenus();
      savePrefs(prefs);
      ui.toast("La base suit déjà les contenus livrés.", "info");
      render();
      return;
    }
    const { ajouts, corrections } = compteAlignement(plan);
    const faitCorrections = mode === "tout" && corrections > 0;
    if (!ajouts && !faitCorrections) {
      ui.toast("Aucun élément livré ne manque : seules des corrections de champs sont proposées, "
        + "et elles attendent votre accord explicite.", "info");
      return;
    }
    const question = faitCorrections
      ? "Aligner la base sur les contenus livrés ?\n\n"
        + `${ajouts} élément(s) ajouté(s) et ${corrections} champ(s) corrigé(s).\n`
        + "Les corrections réécrivent des champs de lignes livrées que votre établissement a peut-être "
        + "adaptés — le détail est affiché dans Réglages › Données › Contenus livrés.\n"
        + "Le texte de vos trames et vos propres lignes ne sont jamais touchés."
      : `Ajouter les ${ajouts} élément(s) livré(s) manquant(s) ?\n\n`
        + (corrections ? `Les ${corrections} correction(s) de champs modifiés ne seront pas appliquées.\n` : "")
        + "Le texte de vos trames et vos propres lignes ne sont jamais touchés.";
    if (!confirm(question)) return;
    // Détail calculé **avant** l'application : après, les lignes ont changé.
    const detail = detailAlignement(plan, store.db);
    store.batch(() => {
      for (const groupe of plan.catalogues) {
        for (const ligne of groupe.ajouts) store.addRow(groupe.table, ligne);
        if (faitCorrections) {
          for (const maj of groupe.modifications) store.updateRow(groupe.table, maj.id, maj.apres);
        }
      }
      // Trames et formats manquants : l'installateur existant s'en charge, avec
      // le déplacement des trames du président qu'il sait faire.
      installerTramesParDefaut();
      if (faitCorrections) {
        for (const maj of plan.trames.modifications) store.updateRow("Trames", maj.id, maj.apres);
      }
      // Journal ligne à ligne (NC-0026) : ce qui a été touché, et non un total.
      for (const ajout of detail.ajouts) {
        journaliser(store, {
          action: "creation", table: ajout.table, id: null,
          resume: `Contenu livré ajouté : ${ajout.nom}.`,
        });
      }
      if (faitCorrections) {
        for (const cor of detail.corrections) {
          journaliser(store, {
            action: "modification", table: cor.table, id: null,
            resume: `Contenu livré réaligné : ${cor.nom} — `
              + cor.champs.map((c) => `${c.champ} : « ${c.avant} » → « ${c.apres} »`).join(" ; ") + ".",
          });
        }
      }
    });
    // La signature n'est marquée « à jour » que si **tout** le plan a été
    // appliqué : tant que des corrections restent en attente, l'avis doit
    // continuer de les signaler.
    if (!corrections || faitCorrections) {
      prefs.contenusSignature = signatureContenus();
      savePrefs(prefs);
    }
    const bilan = faitCorrections
      ? `${ajouts} ajout(s) et ${corrections} correction(s)`
      : `${ajouts} ajout(s)`;
    ui.toast(`Contenus livrés alignés : ${bilan}.`
      + (!faitCorrections && corrections ? ` ${corrections} correction(s) laissée(s) de côté.` : ""));
    render();
  },

  /** Écarte l'avis « contenus livrés plus récents » sans rien modifier. */
  "contenus-ecarter": () => {
    prefs.contenusSignature = signatureContenus();
    savePrefs(prefs);
    ui.toast("Avis écarté : les contenus livrés ne seront plus signalés.", "info");
    render();
  },

  /* ------------------------------------------------------------------ */
  /* Dossier de pièces : déclaration de l'adresse                        */
  /* ------------------------------------------------------------------ */

  /** Ouvre la fenêtre de déclaration du dossier, pour l'affaire visée. */
  "dossier-declarer": (el) => {
    if (readOnly()) { blockedByRole(); return; }
    const id = Number(el?.dataset?.record);
    const affaire = store.byId("Affaires", id);
    if (!affaire) return;
    state.draft.dossier = { affaire: id, lien: str(affaire[CHAMP_DOSSIER]) };
    openModal("dossier");
  },

  /**
   * Enregistre l'adresse du dossier après l'avoir complétée et validée. Une
   * adresse qui n'en est pas une est refusée : la fenêtre reste ouverte, avec
   * l'explication, plutôt que d'enregistrer un lien mort.
   */
  "dossier-submit": () => {
    const d = state.draft.dossier || {};
    const affaire = store.byId("Affaires", Number(d.affaire));
    if (!affaire) { closeModal(); return; }
    if (readOnly()) { blockedByRole(); return; }
    const champ = document.getElementById("dossierLien");
    const brut = String(champ ? champ.value : d.lien || "").trim();
    if (brut && !urlDossier(brut)) {
      state.draft.dossier = { ...d, lien: brut };
      render({ keepFocus: true });
      return;
    }
    const href = urlDossier(brut);
    store.updateRow("Affaires", affaire.id, { [CHAMP_DOSSIER]: href });
    journaliser(store, {
      action: href ? "dossier déclaré" : "dossier retiré",
      table: "Affaires", id: affaire.id,
      resume: href ? `Dossier de pièces déclaré : ${hoteDossier(href)}.` : "Adresse du dossier de pièces retirée.",
    });
    ui.toast(href
      ? "Dossier déclaré : il s'ouvre depuis l'affaire, le rôle de la séance et les documents."
      : "Adresse du dossier retirée.");
    state.draft.dossier = {};
    closeModal();
  },

  /** Retire l'adresse du dossier de l'affaire — le dossier lui-même demeure. */
  "dossier-retirer": () => {
    const d = state.draft.dossier || {};
    const affaire = store.byId("Affaires", Number(d.affaire));
    if (!affaire) { closeModal(); return; }
    if (readOnly()) { blockedByRole(); return; }
    store.updateRow("Affaires", affaire.id, { [CHAMP_DOSSIER]: "" });
    journaliser(store, {
      action: "dossier retiré", table: "Affaires", id: affaire.id,
      resume: "Adresse du dossier de pièces retirée.",
    });
    ui.toast("Adresse du dossier retirée.");
    state.draft.dossier = {};
    closeModal();
  },

  /**
   * Numérote les actes (NC-0020) : toutes les décisions sans numéro, ou la
   * seule décision visée par `data-record`. Les numéros sont attribués dans
   * l'ordre chronologique, par section et par année, et chacun est inscrit au
   * Journal — un registre ne se reconstitue qu'ainsi.
   */
  "numeroter-actes": (el) => {
    const seule = el?.dataset?.record ? Number(el.dataset.record) : null;
    const toutes = store.table("Decisions");
    const { attributions, restantes } = numeroerActes(toutes, {
      sectionDe: (d) => {
        const affaire = store.byId("Affaires", d.Affaire);
        return affaire ? store.byId("Sections_disciplinaires", affaire.Section) : null;
      },
    });
    const retenues = seule ? attributions.filter((at) => Number(at.id) === seule) : attributions;
    if (!retenues.length) {
      ui.toast(restantes
        ? "Cette décision porte déjà un numéro d'acte."
        : "Toutes les décisions portent déjà un numéro d'acte.", "info");
      return;
    }
    if (!seule && !confirm(`Numéroter ${retenues.length} acte(s) ?\n\n`
      + "Les numéros sont attribués dans l'ordre chronologique, par section et par année, "
      + "et ne sont jamais réutilisés — même après une suppression.")) return;
    store.batch(() => {
      for (const at of retenues) store.updateRow("Decisions", at.id, { Numero_acte: at.numero });
      for (const at of retenues) {
        journaliser(store, {
          action: "numérotation", table: "Decisions", id: at.id,
          resume: `Acte numéroté ${at.numero}.`,
        });
      }
    });
    ui.toast(retenues.length === 1
      ? `Acte numéroté ${retenues[0].numero}.`
      : `${retenues.length} acte(s) numéroté(s).`);
    render();
  },

  /** Registre chronologique des actes (NC-0020), en CSV. */
  "export-registre-actes": () => {
    const { lignes, sansNumero } = registreActes(store.db, affairesVisibles(store, state));
    if (!lignes.length) {
      ui.toast("Aucun acte numéroté à exporter : numérotez d'abord les actes.", "warning");
      return;
    }
    telechargerCsv("registre-des-actes", COLONNES_ACTES, lignes);
    journaliser(store, {
      action: "export",
      resume: `Registre des actes : ${lignes.length} acte(s) numéroté(s)`
        + (sansNumero.length ? `, ${sansNumero.length} sans numéro.` : "."),
    });
    ui.toast(`Registre des actes généré : ${lignes.length} acte(s).`);
    render();
  },

  /**
   * Enregistre la vérification des références par le service juridique
   * (NC-0019) : la date du jour est portée par le seuil
   * `references_verifiees_le`, que la page Références affiche. C'est le geste
   * qui date la revue — il ne modifie aucune référence.
   */
  "references-verifiees": () => {
    const valeur = aujourdHui();
    const ligne = store.table("Parametres")
      .find((p) => String(p.Cle || "").trim() === "references_verifiees_le");
    if (ligne) {
      store.updateRow("Parametres", ligne.id, { Valeur: valeur });
    } else {
      const defaut = parametresParDefaut().find((p) => p.Cle === "references_verifiees_le");
      if (defaut) store.addRow("Parametres", { ...defaut, Valeur: valeur });
    }
    journaliser(store, {
      action: "vérification", table: "Parametres", id: ligne ? ligne.id : null,
      resume: `Références juridiques vérifiées le ${formatDateSaisie(valeur)}.`,
    });
    ui.toast("Vérification des références enregistrée.");
    render();
  },

  "add-sanction": () => addAndSelect("Sanctions", { Libelle: "Nouvelle sanction", Groupe: "Avertissement et blâme", Public: "Les deux" }),
  "add-motif": () => addAndSelect("Motifs", { Libelle: "Nouveau motif", Groupe: "Comportement", Public: "Les deux" }),
  "add-parametre": () => addAndSelect("Parametres", { Nom: "Nouveau paramètre", Categorie: "Délais" }),
  "add-personne": () => addAndSelect("Personnes", { Type: "Usager" }),

  // Un document créé s'ouvre dans sa propre sous-vue : c'est là qu'il se
  // rédige, et c'est de là qu'on choisit sa trame — le seul endroit où le
  // document se complète vraiment.
  "add-document": (el) => {
    // L'affaire peut venir du bouton (dossier de la page « Documents ») ou de
    // la sélection courante (onglet « Documents » d'une affaire).
    const affaire = Number(el?.dataset?.affaire) || state.sel.Affaires;
    if (!affaire) return;
    const row = store.addRow("Generateur", { Affaire: Number(affaire), Date: todayIso() });
    if (!row) return;
    state.sel.Generateur = row.id;
    persistPrefs();
    navTo(`documents/${row.id}`);
  },

  /* Outils de l'espace de rédaction d'un document : les paramètres et les
     variables se replient pour rendre sa largeur au texte. Ce ne sont que des
     plis d'affichage : leur état vit dans `state.tabs`, avec celui des
     onglets, pour survivre au redessin de la page. */
  "doc-parametres": () => {
    state.tabs.docParams = state.tabs.docParams === "replie" ? "ouvert" : "replie";
    render();
  },

  "doc-variables": () => {
    state.tabs.docVariables = state.tabs.docVariables === "replie" ? "ouvert" : "replie";
    render();
  },

  /* La feuille d'un document (voir views/documents.js). Le document suit sa
     trame tant qu'il n'a ni texte propre ni feuille adaptée : « Revenir à la
     trame » efface l'un et l'autre, après confirmation, plutôt que d'en
     recopier un. */
  "doc-contenu-reinit": () => {
    const doc = store.byId("Generateur", state.sel.Generateur);
    if (!doc) return;
    if (!confirm("Effacer ce que ce document a de propre et revenir à la trame ?\nLes corrections du texte et de la feuille seront perdues.")) return;
    store.updateRow("Generateur", doc.id, { Contenu: "", Feuille_de_style: "" });
  },

  "doc-contenu-figer": () => {
    const doc = store.byId("Generateur", state.sel.Generateur);
    if (!doc) return;
    if (!confirm("Remplacer les balises du texte par les valeurs du moment ?\nLes noms, dates et lieux seront écrits dans le texte, qui ne changera plus avec les données.")) return;
    const trame = doc.Template ? store.byId("Trames", doc.Template) : null;
    const html = freezeDocumentBody(store.db, doc);
    if (html === documentBody(doc, trame)) { ui.toast("Aucune balise à remplacer.", "info"); return; }
    store.updateRow("Generateur", doc.id, { Contenu: html });
    ui.toast("Balises remplacées par les valeurs.");
  },

  /* ---------------------------------------------------------------- */
  /* Atelier de rédaction d'une décision                               */
  /* ---------------------------------------------------------------- */

  // Les outils de droite se replient, comme ceux d'un document : ce ne sont que
  // des plis d'affichage, et leur état vit dans `state.tabs` pour survivre au
  // redessin de la page.
  "dec-considerants": () => basculerOutil("decConsiderants", true),
  "dec-formules": () => basculerOutil("decFormules"),
  "dec-champs": () => basculerOutil("decChamps"),
  "dec-composition": () => basculerOutil("decComposition"),
  "dec-controles": () => basculerOutil("decControles"),
  "dec-variables": () => basculerOutil("decVariables"),
  "dec-parametres": () => basculerOutil("decParametres"),

  /* Le texte de la décision vit dans un document lié : c'est lui qui porte le
     texte, et donc tout ce qui en découle — aperçu, impression, exports. Le
     créer est le premier geste de la rédaction ; la table des considérants, elle,
     est facultative : l'outil en livre déjà un répertoire complet. */
  "dec-document-creer": () => {
    const decision = store.byId("Decisions", state.sel.Decisions);
    if (!decision) return;
    const existant = documentDeDecision(store, decision);
    if (existant) { state.sel.Generateur = existant.id; navTo(`decisions/${decision.id}`); return; }
    const row = assurerTexteDeDecision(decision);
    if (!row) return;
    state.sel.Generateur = row.id;
    render();
    ui.toast("Le texte de la décision est ouvert : les considérants se glissent depuis le répertoire.");
  },

  /* Le geste qui manquait à l'onglet « Décision » d'une affaire : passer de
     l'enregistrement du résultat à la rédaction du texte. Il crée le texte de
     la décision s'il n'existe pas, puis ouvre l'atelier — l'adresse de la
     décision, qui se copie et survit au rechargement. */
  "rediger-decision": (el) => {
    const decision = store.byId("Decisions", Number(el?.dataset?.record) || state.sel.Decisions);
    if (!decision) return;
    const doc = assurerTexteDeDecision(decision);
    if (!doc) return;
    state.sel.Decisions = decision.id;
    state.sel.Generateur = doc.id;
    navTo(`decisions/${decision.id}`);
  },

  "dec-considerants-table": () => {
    installStructureAndReconnect("Table des considérants créée dans le document.");
  },

  /* Insertion, dans le texte de la décision, du morceau que l'on vient de
     désigner. L'insertion ne redessine pas la page (le curseur et le défilement
     doivent rester où ils sont) : c'est le texte de l'éditeur qui est enregistré,
     seul, comme pour une frappe (voir `saveEditorContent`). */
  "dec-considere-inserer": (el) => {
    const editor = editeurDecision();
    const considerant = repertoire(store.db).find((c) => c.id === String(el?.dataset?.id || ""));
    if (!editor || !considerant) return;
    if (!insererConsiderant(store, considerant, editor)) {
      ui.toast("Le considérant n'a pas pu être inséré : placez le curseur dans le texte, à l'endroit voulu.", "warning");
      return;
    }
    saveEditorContent(editor);
    ui.toast(`Considérant inséré : « ${considerant.titre} ».`);
  },

  "dec-intertitre": (el) => {
    const editor = editeurDecision();
    const html = intertitreDe(el?.dataset?.id);
    if (!editor || !html) return;
    insererFragment(editor, html);
    saveEditorContent(editor);
  },

  "dec-formule-inserer": (el) => {
    const editor = editeurDecision();
    const formule = formuleDe(el?.dataset?.id);
    if (!editor || !formule) return;
    insererFragment(editor, formule.html);
    saveEditorContent(editor);
  },

  /** Filtre le répertoire par tag : un clic l'ajoute, un autre le retire. */
  "dec-considere-tag": (el) => {
    const t = String(el?.dataset?.tag || "");
    if (!t) return;
    const actifs = Array.isArray(state.filters.decConsiderantTags) ? [...state.filters.decConsiderantTags] : [];
    const i = actifs.indexOf(t);
    if (i === -1) actifs.push(t);
    else actifs.splice(i, 1);
    state.filters.decConsiderantTags = actifs;
    persistPrefs();
    render({ keepFocus: true });
  },

  /**
   * Numérote les considérants dans l'ordre du texte. C'est un geste, et non un
   * réglage : les décisions rendues citent « le considérant 6 » en séance, mais
   * leurs numéros ne se recalculent pas tout seuls — une renumérotation
   * silencieuse changerait le sens d'une citation déjà faite.
   */
  "dec-numeroter": () => {
    const editor = editeurDecision();
    if (!editor) return;
    const n = numeroterConsiderants(editor);
    saveEditorContent(editor);
    if (n) ui.toast(`${n} considérant${n > 1 ? "s" : ""} numéroté${n > 1 ? "s" : ""} dans l'ordre du texte.`);
    else ui.toast("Aucun considérant à numéroter : glissez-en depuis le répertoire, à droite.", "info");
  },

  /**
   * Numérote les articles du dispositif — « Article 1er », « Article 2 »… — dans
   * l'ordre du texte. C'est le pendant, pour le dispositif, de la numérotation
   * des considérants : même geste, même règle, et le numéro est lui aussi du
   * texte, pour survivre aux exports.
   */
  "dec-numeroter-articles": () => {
    const editor = editeurDecision();
    if (!editor) return;
    const n = numeroterArticles(editor);
    saveEditorContent(editor);
    if (n) ui.toast(`${n} article${n > 1 ? "s" : ""} numéroté${n > 1 ? "s" : ""} dans l'ordre du texte.`);
    else ui.toast("Aucun article à numéroter : insérez les articles du dispositif depuis « Visas et dispositif », à droite.", "info");
  },

  /**
   * Donne aux considérants leur retrait de première ligne — ou le leur ôte.
   * C'est un geste, comme la numérotation : la présentation d'une décision se
   * décide, elle ne se recalcule pas toute seule. Le retrait s'écrit sur chaque
   * paragraphe, un centimètre, et se retrouve tel quel dans l'aperçu, le PDF,
   * le Word et l'OpenDocument.
   */
  "dec-retrait": () => {
    const editor = editeurDecision();
    if (!editor) return;
    const { n, pose } = retraitConsiderants(editor);
    saveEditorContent(editor);
    if (!n) ui.toast("Aucun considérant dans le texte : glissez-en depuis le répertoire, à droite.", "info");
    else ui.toast(`${n} considérant${n > 1 ? "s" : ""} : retrait de première ligne ${pose ? "posé" : "retiré"}.`);
  },

  "dec-squelette": () => {
    const decision = store.byId("Decisions", state.sel.Decisions);
    const doc = decision ? documentDeDecision(store, decision) : null;
    if (!decision || !doc) return;
    if (!confirm("Remplacer le texte par un squelette de décision ?\n"
      + "Le texte en cours sera perdu. Les visas, l'audience, le DÉCIDE et les articles "
      + "seront mis en place, et vous compléterez. La signature vient de la feuille de style.")) return;
    store.updateRow("Generateur", doc.id, { Contenu: echafaudageDecision(store, decision) });
    ui.toast("Squelette composé : visas, audience, DÉCIDE et articles sont en place.");
  },

  /* Le répertoire de l'établissement : la fenêtre d'écriture d'un considérant.
     Un considérant livré s'adapte — sa ligne déclare alors son origine, et le
     considérant livré s'efface au profit de celui de l'établissement. */
  "dec-considere-nouveau": () => {
    state.draft.considerant = {};
    openModal("considerant");
  },

  "dec-considere-adapter": (el) => {
    const livre = CONSIDERANTS_LIVRES.find((c) => c.id === String(el?.dataset?.id || ""));
    if (!livre) return;
    state.draft.considerant = { livre };
    openModal("considerant");
  },

  "dec-considere-editer": (el) => {
    const row = store.byId("Considerants", Number(el?.dataset?.ligne));
    if (!row) return;
    state.draft.considerant = {
      considerant: {
        ligne: row.id,
        rubrique: row.Rubrique,
        nature: row.Nature,
        titre: row.Titre,
        texte: row.Texte,
        tags: listeTags(row.Tags),
        source: row.Source,
        domaine: row.Domaine,
        origine: row.Origine,
      },
    };
    openModal("considerant");
  },

  "dec-considere-enregistrer": () => {
    const { ligne, data } = considerantDepuisFormulaire();
    if (!data.Titre && !data.Texte) {
      ui.toast("Un considérant a besoin d'un titre ou d'un texte.", "error");
      return;
    }
    if (!ligne && !tableConsiderantsDisponible()) {
      ui.toast("La table « Considérants » n'existe pas encore dans ce document : créez-la depuis le "
        + "répertoire, à droite du texte.", "warning");
      return;
    }
    if (ligne) {
      store.updateRow("Considerants", ligne, data);
    } else {
      const row = store.addRow("Considerants", data);
      if (!row) return;
      journaliser(store, {
        action: "creation", table: "Considerants", id: row.id,
        resume: `Considérant « ${data.Titre || "(sans titre)"} » ajouté au répertoire.`,
      });
    }
    state.modal = null;
    render();
    ui.toast(ligne ? "Considérant enregistré." : "Considérant ajouté au répertoire de l'établissement.");
  },

  "add-seance": () => {
    const section = state.sel.Sections_disciplinaires || store.table("Sections_disciplinaires")[0]?.id;
    if (!section) return;
    const row = addAndSelect("Seances_d_examen", { Section: Number(section), Type: "Séance d'examen", Date: todayIso() });
    if (row) journaliser(store, { action: "creation", table: "Seances_d_examen", id: row.id, resume: "Séance créée." });
  },

  "add-destinataire": () => {
    addAndSelect("Destinataires_institutionnels", {});
  },

  "add-section": () => {
    addAndSelect("Sections_disciplinaires", { Public: "Usagers" });
  },

  "add-membre": () => {
    const section = state.sel.Sections_disciplinaires;
    addAndSelect("Membres", { Section: section ? Number(section) : 0, Role: "Membre", Genre: "N/A" });
  },

  /* Composition d'une section par fichier (voir membres-csv.js). Le modèle
     porte une ligne par siège attendu par les textes, collège et rôle remplis :
     le secrétaire n'a plus qu'à écrire des noms, sans avoir à connaître les
     collèges. La même trame de colonnes sert à l'export et à l'import, si bien
     qu'un fichier exporté, corrigé dans un tableur, se réimporte. */
  "membres-modele": () => {
    const section = store.byId("Sections_disciplinaires", state.sel.Sections_disciplinaires);
    if (!section) { ui.toast("Choisissez d'abord une section.", "warning"); return; }
    const { csv, lignes, composition } = modeleCsvMembres(section);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `composition-modele ${fileSlug(str(section.Acronyme) || str(section.Structure) || `section-${section.id}`)}.csv`);
    ui.toast(`Modèle exporté : ${lignes} ligne(s)${composition ? ` — ${composition}` : ""}.`);
  },

  "membres-export": () => {
    const section = store.byId("Sections_disciplinaires", state.sel.Sections_disciplinaires);
    if (!section) { ui.toast("Choisissez d'abord une section.", "warning"); return; }
    const { csv, lignes } = csvMembresDeLaSection(store, section);
    if (!lignes) { ui.toast("Cette section n'a encore aucun membre.", "info"); return; }
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `composition ${fileSlug(str(section.Acronyme) || str(section.Structure) || `section-${section.id}`)}.csv`);
    ui.toast(`${lignes} membre(s) exporté(s).`);
  },

  "membres-import": () => document.getElementById("membresCsvFile")?.click(),

  "add-secretaire": () => {
    addAndSelect("Secretaires", { Genre: "F", Actif_: true });
  },

  "add-trame": () => {
    const type = store.table("Types_Trames")[0]?.id || 0;
    const row = addAndSelect("Trames", {
      Nom: "Nouvelle trame",
      Type: type,
      Public: "Usagers",
      // Le corps seul : l'en-tête, le chapeau, la signature et le pied de page
      // viennent de la feuille de style du format, dont la trame hérite.
      Template_contenu: "",
    });
    // Une trame neuve n'a rien à faire dans une liste : elle s'écrit. Créer la
    // trame, c'est donc ouvrir son espace de rédaction, à son adresse.
    if (row) navTo(`reglages/trames/${row.id}`);
  },

  "add-type-trame": () => {
    // Un format neuf part d'une feuille de style minimale — l'emplacement du
    // texte des trames, une signature, un pied de page —, que l'auteur adapte.
    const row = addAndSelect("Types_Trames", { Nom: "Nouveau format", Feuille_de_style: FEUILLE_VIERGE });
    if (row) navTo(`reglages/types/${row.id}`);
  },

  /* Rendre à une trame la feuille de style de son format : l'adaptation qu'elle
     s'était faite est effacée (colonne `Feuille_de_style` vidée), et la trame
     reprend celle de son format — aussitôt, puisque la page est redessinée. */
  "trame-feuille-retablir": (el) => {
    const id = Number(el.dataset.record);
    const trame = id ? store.byId("Trames", id) : null;
    if (!trame) return;
    store.updateRow("Trames", id, { Feuille_de_style: "" });
    ui.toast("La trame reprend la feuille de style de son format.");
  },

  /* ------------------------------------------------------------------ */
  /* Trames : sélection par lots, et corbeille                           */
  /* ------------------------------------------------------------------ */

  /* Cocher une trame du registre. La sélection vit dans `state.trames`, hors
     du document : c'est un geste d'écran, qui n'a pas à être enregistré. */
  "trames-cocher": (el) => {
    const id = Number(el.dataset.record);
    const ids = new Set(state.trames.ids);
    if (el.checked) ids.add(id); else ids.delete(id);
    state.trames.ids = [...ids];
    render({ keepFocus: true });
  },

  /* Tout cocher, ou tout décocher : `data-records` porte les identifiants
     affichés — donc ceux que les filtres ont laissés —, et non ceux de la
     table entière. Décocher ne vide donc pas une sélection faite ailleurs. */
  "trames-tout": (el) => {
    const ids = String(el.dataset.records || "").split(",").map(Number).filter(Boolean);
    if (el.checked) state.trames.ids = [...new Set([...state.trames.ids, ...ids])];
    else state.trames.ids = state.trames.ids.filter((id) => !ids.includes(id));
    render({ keepFocus: false });
  },

  "trames-effacer": () => {
    state.trames.ids = [];
    render({ keepFocus: false });
  },

  /* Mise à la corbeille — d'une trame, de la sélection, ou de tout ce qui est
     affiché. Dans les trois cas la trame quitte la table `Trames` pour la
     corbeille, d'où elle peut revenir : rien n'est perdu par mégarde. */
  "trame-corbeille": (el) => {
    mettreTramesALaCorbeille([Number(el.dataset.record)].filter(Boolean));
  },

  "trames-corbeille-selection": () => {
    mettreTramesALaCorbeille(state.trames.ids);
  },

  "trames-corbeille-affichees": (el) => {
    const ids = String(el.dataset.records || "").split(",").map(Number).filter(Boolean);
    mettreTramesALaCorbeille(ids);
  },

  "corbeille-restaurer": (el) => {
    const entree = store.byId("Corbeille", Number(el.dataset.record));
    if (!entree) return;
    if (!store.restaurerCorbeille(entree.id)) {
      ui.toast("Cet élément n'a pas pu être restauré : il est illisible.", "warning");
      return;
    }
    ui.toast(`« ${str(entree.Nom)} » a été restauré.`);
  },

  "corbeille-purger": (el) => {
    const entree = store.byId("Corbeille", Number(el.dataset.record));
    if (!entree) return;
    if (!confirm(`Effacer définitivement « ${str(entree.Nom)} » ?\nCette action est irréversible : l'élément ne pourra plus être restauré.`)) return;
    store.retirerDeLaCorbeille(entree.id);
    ui.toast("Élément effacé définitivement.");
  },

  "corbeille-vider": () => {
    const n = store.table("Corbeille").length;
    if (!n) return;
    if (!confirm(`Vider la corbeille ? ${n} élément(s) seront effacés définitivement.\n`
      + "Cette action est irréversible : les trames ne pourront plus être restaurées.")) return;
    store.batch(() => store.viderCorbeille());
    ui.toast(`${n} élément(s) effacé(s) définitivement.`);
  },

  "corbeille-purger-anciennes": () => {
    const mois = seuil(store.db, "corbeille_retention_mois");
    const limite = Date.now() - mois * 30 * 24 * 3600 * 1000;
    const anciennes = store.table("Corbeille")
      .filter((c) => { const d = Date.parse(String(c.Supprime_le || "")); return Number.isFinite(d) && d < limite; });
    if (!anciennes.length) { ui.toast(`Aucune entrée de plus de ${mois} mois à purger.`); return; }
    if (!confirm(`Purger la corbeille ? ${anciennes.length} entrée(s) mise(s) de côté depuis plus de ${mois} mois\n`
      + "seront effacées définitivement. Cette action est irréversible.")) return;
    journaliser(store, {
      action: "purge",
      table: "Corbeille",
      resume: `Purge de la corbeille : ${anciennes.length} entrée(s) de plus de ${mois} mois effacée(s).`,
    });
    store.batch(() => { for (const c of anciennes) store.retirerDeLaCorbeille(c.id); });
    ui.toast(`${anciennes.length} entrée(s) purgée(s).`);
  },

  /* Confidentialité du poste (NC-0009) : mode session et verrouillage. */
  "confidentialite-session": (el) => {
    const actif = !!el.checked;
    prefs.modeSession = actif;
    savePrefs(prefs);
    store.setModeSession(actif);
    ui.toast(actif
      ? "Mode session activé : rien ne sera conservé sur ce poste."
      : "Mode session désactivé : la base est de nouveau enregistrée dans ce navigateur.");
    render();
  },

  "confidentialite-verrouillage": (el) => {
    prefs.verrouillageMin = Number(el.value) || 0;
    savePrefs(prefs);
    reglerVerrouillage();
    ui.toast(prefs.verrouillageMin
      ? `Verrouillage après ${prefs.verrouillageMin} minute(s) d'inactivité.`
      : "Verrouillage automatique désactivé.");
  },

  /* NC-0022 : définir un code de reprise, pour que le verrouillage d'écran
     protège réellement l'accès (et non seulement des regards). Seule
     l'empreinte du code est conservée. */
  "confidentialite-code": async () => {
    const champ = document.querySelector("#confCodeInput");
    const code = String(champ ? champ.value : "").trim();
    const erreur = document.querySelector("#confCodeErr");
    const afficherErreur = (texte) => {
      if (!erreur) return;
      erreur.hidden = !texte;
      erreur.textContent = texte;
    };
    if (!(typeof crypto !== "undefined" && crypto.subtle)) {
      afficherErreur("Le calcul d'empreinte n'est pas disponible dans ce navigateur : le code ne peut pas être enregistré.");
      return;
    }
    if (code.length < 4) {
      afficherErreur("Le code doit comporter au moins 4 caractères.");
      if (champ) champ.focus();
      return;
    }
    prefs.verrouCodeHash = await hacherCode(code);
    savePrefs(prefs);
    if (champ) champ.value = "";
    afficherErreur("");
    ui.toast("Code de reprise enregistré : le verrouillage d'écran demande désormais ce code.");
    render({ keepFocus: true });
  },

  "confidentialite-code-effacer": () => {
    delete prefs.verrouCodeHash;
    savePrefs(prefs);
    ui.toast("Code de reprise effacé : le verrouillage d'écran ne bloque plus l'accès.");
    render({ keepFocus: true });
  },

  /* Outils de l'espace de rédaction d'une trame : les variables se replient
     pour rendre sa largeur au texte. Ce n'est qu'un pli d'affichage : son état
     vit dans `state.tabs`, avec celui des onglets, pour survivre au redessin
     de la page. Les types de trames y ont recours aussi. */
  "trame-variables": () => {
    state.tabs.trameVariables = state.tabs.trameVariables === "replie" ? "ouvert" : "replie";
    render();
  },

  /* Renvois croisés entre une trame, son type et les documents produits :
     chacun ouvre le registre intéressé, filtré sur ce qu'on regarde. */
  "trame-documents": (el) => {
    state.filters.documentsTrame = String(el.dataset.record || "");
    navTo("documents");
  },

  "type-trames": (el) => {
    state.filters.tramesType = String(el.dataset.record || "");
    navTo("reglages/trames");
  },

  "set-etat": (el) => {
    const id = Number(el.dataset.record);
    const etat = el.dataset.etat;
    if (!id || !etat) return;
    store.updateRow("Affaires", id, { Etat: etat });
    ui.toast(`État mis à jour : ${etat}.`);
  },

  "assign-affaire": (el) => {
    const seanceId = Number(el.dataset.record);
    const affaireId = Number(el.value);
    if (!seanceId || !affaireId) return;
    store.updateRow("Affaires", affaireId, { Seance_d_examen: seanceId });
    if (!state.sel.Seances_d_examen) state.sel.Seances_d_examen = seanceId;
    ui.toast("Affaire inscrite au rôle.");
  },

  "unassign-affaire": (el) => {
    const affaireId = Number(el.dataset.record);
    if (!affaireId) return;
    store.updateRow("Affaires", affaireId, { Seance_d_examen: 0 });
    ui.toast("Affaire retirée du rôle.");
  },

  /* Périmètre et attribution ---------------------------------------- */

  // Élargir ou restreindre la vue. Réservé aux propriétaires du document :
  // pour tout autre rôle, le périmètre est une règle, pas un réglage.
  "voir-tout-affaires": () => {
    if (!peutVoirTout(state)) return;
    state.filters[VOIR_TOUT] = "1";
    persistPrefs();
    render();
    ui.toast(`${affairesVisibles(store, state, store.table("Affaires")).length} affaire(s) affichée(s).`);
  },

  "voir-mes-affaires": () => {
    delete state.filters[VOIR_TOUT];
    persistPrefs();
    render();
    ui.toast("Retour à vos affaires.");
  },

  // Attribution d'une affaire depuis la vue « Attribution » : le choix du
  // secrétaire dans la ligne vaut affectation immédiate.
  "attribuer-affaire": (el) => {
    const affaireId = Number(el.dataset.record);
    if (!affaireId) return;
    const secretaire = Number(el.value) || 0;
    attribuer([affaireId], secretaire);
  },

  // Cases cochées du lot en préparation. On lit l'état de la case plutôt que de
  // basculer une valeur mémorisée : le navigateur signale un clic puis un
  // changement, et le second passage ne doit rien défaire.
  "attribution-cocher": (el) => {
    const id = Number(el.dataset.record);
    if (!id) return;
    const ids = new Set(state.attribution.ids);
    if (el.checked) ids.add(id); else ids.delete(id);
    state.attribution.ids = [...ids];
    render();
  },

  "attribution-tout": (el) => {
    state.attribution.ids = el.checked ? attribuables(store, state).map((a) => a.id) : [];
    render();
  },

  "attribution-cible": (el) => {
    state.attribution.cible = el.value || "";
  },

  "attribution-appliquer": () => {
    const ids = state.attribution.ids;
    if (!ids.length) { ui.toast("Aucune affaire sélectionnée.", "warning"); return; }
    if (attribuer(ids, Number(state.attribution.cible) || 0)) state.attribution.ids = [];
  },

  "attribution-retirer": () => {
    const ids = state.attribution.ids;
    if (!ids.length) { ui.toast("Aucune affaire sélectionnée.", "warning"); return; }
    if (attribuer(ids, 0)) state.attribution.ids = [];
  },

  "attribution-non-attribuees": () => {
    state.filters.attributionSecretaire = "0";
    persistPrefs();
    render();
  },

  "attribution-reinit": () => {
    for (const key of ["attributionQ", "attributionSection", "attributionEtat", "attributionSecretaire"]) {
      delete state.filters[key];
    }
    state.attribution = { ids: [], cible: "" };
    persistPrefs();
    render();
  },

  "attribution-effacer": () => {
    state.attribution.ids = [];
    render();
  },

  "attribution-secretaire": (el) => {
    // Clic sur une pastille de charge : la vue se filtre sur ce secrétaire —
    // et se dé-filtre si l'on reclique la pastille déjà active, comme le fait
    // toute pastille de filtre.
    const id = Number(el.dataset.record) || 0;
    if (id && String(state.filters.attributionSecretaire) !== String(id)) {
      state.filters.attributionSecretaire = String(id);
    } else {
      delete state.filters.attributionSecretaire;
    }
    persistPrefs();
    render();
  },

  "reset-decision-filters": () => {
    for (const key of ["decisionQ", "decisionType", "decisionComposante", "decisionEnCours", "decisionDelai"]) delete state.filters[key];
    persistPrefs();
    render();
  },

  export: () => {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    downloadBlob(blob, `sections-disciplinaires-${todayIso()}.json`);
    ui.toast("Export généré.");
  },

  "debug-export": async () => {
    ui.toast("Assemblage de l'archive…");
    try {
      const bundle = await exportSite();
      const ko = Math.max(1, Math.round(bundle.bytes / 1024));
      ui.toast(`Archive prête : ${bundle.name} (${bundle.files.length} fichiers, ${ko} ko).`);
    } catch (err) {
      ui.toast(`Export impossible : ${err.message}`, "error");
    }
  },

  /**
   * Vérification de la livraison (NC-0025) : analyse syntaxique de tous les
   * modules de l'archive et exécution du harnais de non-régression. La liste des
   * fichiers est celle de l'archive — donc exactement ce qui sera livré.
   */
  "debug-verifier": async () => {
    ui.toast("Vérification en cours (analyse de tous les modules)…", "info");
    try {
      const [{ verifier, formaterRapport }, bundle] = await Promise.all([
        import("./verifier.mjs"),
        buildExport(),
      ]);
      const base = new URL("./", import.meta.url);
      const resultat = await verifier({
        fichiers: bundle.files,
        lireFichier: async (chemin) => {
          const reponse = await fetch(new URL(chemin, base), { cache: "no-store" });
          if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
          return reponse.text();
        },
      });
      state.verification = formaterRapport(resultat);
      state.verificationOk = resultat.ok;
      journaliser(store, { action: "vérification", resume: state.verification.split("\n")[0] });
      ui.toast(resultat.ok
        ? `Vérification conforme : ${resultat.modules} modules analysés.`
        : "Vérification en échec : voir le rapport.", resultat.ok ? "success" : "error");
    } catch (err) {
      state.verification = `Vérification impossible : ${(err && err.message) || err}`;
      state.verificationOk = false;
      ui.toast(state.verification, "error");
    }
    render();
  },

  import: () => document.getElementById("importFile")?.click(),

  /* Réglages › Import : analyse et conversion du tableur d'origine. */

  "import-fichier": () => document.getElementById("importSourceFile")?.click(),

  "import-document": () => {
    // Le document connecté est lu tel quel : ses tables d'origine comprises.
    analyserImport(JSON.parse(JSON.stringify(store.db)), "Document Grist connecté", { format: "grist" });
  },

  "import-effacer": () => {
    state.import = null;
    render({ keepFocus: false });
  },

  "import-cible": (el) => {
    // Réaffecte une feuille du fichier à une autre table de l'outil : la source
    // et l'analyse sont recalculées, rien n'est écrit.
    const imp = state.import;
    if (!imp?.feuilles) return;
    const feuille = imp.feuilles.find((f) => f.cle === el.dataset.feuille);
    if (!feuille) return;
    feuille.cible = el.value || "";
    majSourceImport();
    state.import.resultat = null;
    render({ keepFocus: true });
  },

  "import-mode": (el) => {
    if (!state.import) return;
    state.import.mode = el.value === "remplacer" ? "remplacer" : "completer";
    render({ keepFocus: true });
  },

  "import-appliquer": () => importerLaSource(),

  reset: () => {
    if (!confirm("Restaurer le jeu de données d'exemple ? Les modifications en cours seront perdues.")) return;
    store.resetToSeed();
    ui.toast("Jeu de données d'exemple restauré.");
  },

  clear: () => {
    if (!confirm("Effacer toutes les données ? Cette action est irréversible (pensez à exporter avant).")) return;
    store.clearAll();
    ui.toast("Base vidée.", "warning");
  },

  "grist-retry": async () => {
    state.grist = "loading";
    state.gristError = "";
    state.gristErrorCode = "";
    state.gristWriteError = "";
    state.gristMissingColumns = [];
    render({ keepFocus: false });
    await initGrist();
  },

  /**
   * Renvoie au document les modifications qu'il a refusées (voir « Écritures en
   * attente » dans `grist-backend.js`). Échapatoire d'une panne passagère : le
   * droit d'écriture revenu, ou la colonne manquante créée, un clic suffit à
   * rattraper le travail retenu ici.
   */
  "grist-retry-writes": async () => {
    if (!pendingWriteCount()) {
      ui.toast("Aucune modification en attente : tout est enregistré dans le document.", "info");
      return;
    }
    const bilan = await retryPendingWrites();
    if (bilan.restantes) {
      if (state.outbox) state.outbox = { rejouables: bilan.restantes, conflits: state.outbox.conflits };
      ui.toast(`${bilan.reussies} modification(s) transmise(s), ${bilan.restantes} encore refusée(s).`, "warning");
    } else {
      state.outbox = state.outbox?.conflits?.length ? { rejouables: 0, conflits: state.outbox.conflits } : null;
      ui.toast(`${bilan.reussies} modification(s) transmise(s) au document.`);
    }
    render({ keepFocus: true });
  },

  "outbox-abandonner": () => {
    oublierEcritures();
    state.outbox = null;
    ui.toast("Modifications en attente abandonnées.", "info");
    render({ keepFocus: true });
  },

  "grist-refresh": async () => {
    try {
      await gristRefresh(store);
      ui.toast("Données rechargées depuis le document Grist.");
    } catch (err) {
      ui.toast(`Rechargement impossible : ${err.message}`, "error");
    }
  },

  "grist-install": () => {
    // Pas de `confirm()` ici : dans un document Grist, l'outil s'affiche dans
    // un cadre qui peut interdire les boîtes de dialogue du navigateur, et la
    // confirmation passerait alors pour un refus — un clic resterait sans
    // effet, au moment précis où l'utilisateur cherche à rétablir la
    // liaison. Le bandeau et l'intitulé du bouton disent ce qui va être créé.
    installStructureAndReconnect("Structure installée : les tables du document sont prêtes.");
  },

  /* Réglages › Données : serveur Grist déclaré (NC-0023). La déclaration est
     conservée sur le poste et vaut pour les rechargements suivants ; le
     rechargement immédiat recharge l'API depuis la nouvelle origine. */
  "grist-declarer-origine": () => {
    const champ = document.querySelector("#gristOrigineInput");
    const saisie = String(champ ? champ.value : "");
    const liste = saisie.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean);
    const retenues = definirOriginesGristDeclarees(liste);
    // L'essai précédent a mémorisé la liste des origines ; on l'oublie pour
    // que le chargement suivant relise la déclaration.
    resetGristApi();
    if (retenues.length) {
      ui.toast(`Serveur(s) Grist autorisé(s) : ${retenues.join(", ")}. Rechargement pour s'y connecter…`);
      setTimeout(() => window.location.reload(), 700);
    } else {
      ui.toast("Déclaration effacée : seules les instances Grist reconnues sont autorisées.");
      render({ keepFocus: true });
    }
  },

  /* Réglages › Identité : logo de l'opérateur affiché dans l'en-tête. */

  "identite-activer": () => {
    const row = store.addRow("Identite", { Logo_operateur: "", Logo_operateur_alt: "" });
    if (row) ui.toast("Réglages d'identité créés : renseignez le logo.");
  },

  "identite-table": () => {
    installStructureAndReconnect("Table de l'identité créée dans le document.");
  },

  "identite-retirer": () => {
    const row = store.table("Identite")[0];
    if (!row) return;
    store.updateRow("Identite", row.id, { Logo_operateur: "" });
    ui.toast("Logo retiré de l'en-tête.");
  },

  /* Image choisie sur le poste : elle est enregistrée dans la base, comme le
     reste des données — d'où la limite de taille, qui laisse la place aux
     logos légers et décourage les photographies. L'image est ainsi **intégrée
     aux documents** (data URL) : c'est la seule forme qui traverse sans dommage
     l'impression, le PDF, Word et OpenDocument, quel que soit son hébergeur —
     une adresse distante, elle, est écartée des fichiers exportés dès que son
     hébergeur refuse l'intégration (voir `octetsImage` dans `export-doc.js`). */

  /** Ouvre le champ de fichier désigné par le bouton (`data-champ`). */
  "image-fichier": (el) => document.getElementById(el.dataset.champ || "")?.click(),

  "grist-check": async () => {
    try {
      const check = await checkStructure();
      state.structure = check;
      if (!check) ui.toast("Aucun document Grist connecté.", "warning");
      else if (!check.total) ui.toast("Structure du document conforme.");
      else ui.toast(`${check.total} élément(s) manquant(s) dans le document.`, "warning");
      render();
    } catch (err) {
      ui.toast(`Vérification impossible : ${err.message}`, "error");
    }
  },

  /* Réglages › Données : journal de diagnostic (dépannage). */

  "diag-copier": async () => {
    const el = document.getElementById("diagLog");
    if (!el) return;
    const texte = el.value;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("presse-papiers indisponible");
      }
      await navigator.clipboard.writeText(texte);
      ui.toast("Journal copié : collez-le dans votre message.");
      return;
    } catch (err) {
      // Le presse-papiers est refusé dans certains cadres (widget Grist,
      // autorisation non accordée) : on sélectionne alors le texte, à charge
      // pour la personne de faire Ctrl+C.
      el.focus();
      el.select();
      if (document.execCommand && document.execCommand("copy")) {
        ui.toast("Journal copié : collez-le dans votre message.");
        return;
      }
      ui.toast("Sélectionnez le journal puis copiez-le (Ctrl+C, ou Cmd+C).", "warning");
    }
  },

  "diag-telecharger": () => {
    const el = document.getElementById("diagLog");
    if (!el) return;
    const jour = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([el.value], { type: "text/plain;charset=utf-8" }),
      `journal-diagnostic-${jour}.txt`);
    ui.toast("Journal téléchargé.");
  },

  /* Recopié sur place plutôt que re-rendu : un nouveau rendu fermerait le
     panneau repliable, qui vient justement d'être ouvert. */
  "diag-actualiser": () => {
    const el = document.getElementById("diagLog");
    if (!el) return;
    el.value = diagnosticReport(store, state);
    ui.toast("Journal actualisé.");
  },

  /* Outils de mise au point (onglet Debug, mode autonome uniquement). */

  "debug-role": (el) => {
    const role = el.dataset.role || "";
    state.debugRole = ROLE_IDS.includes(role) ? role : null;
    persistDebugPrefs();
    ui.toast(state.debugRole ? `Rôle simulé : ${roleLabel(state.debugRole)}.` : "Rôle réel rétabli.");
    render({ keepFocus: true });
  },

  "debug-name": (el) => {
    state.debugName = String(el.value || "").trim();
    persistDebugPrefs();
    render({ keepFocus: true });
  },

  // Hors Grist, aucune identité réelle n'est transmise : choisir ici la fiche
  // d'un secrétaire permet d'éprouver le périmètre des affaires (un secrétaire
  // ne voit que celles qui lui sont attribuées).
  "debug-email": (el) => {
    state.debugEmail = String(el.value || "").trim();
    persistDebugPrefs();
    render({ keepFocus: true });
    ui.toast(state.debugEmail ? `Identité simulée : ${state.debugEmail}.` : "Identité simulée retirée.");
  },

  "debug-clear-prefs": () => {
    for (const key of Object.keys(prefs)) delete prefs[key];
    savePrefs(prefs);
    state.debugRole = null;
    state.debugName = "";
    state.debugEmail = "";
    ui.toast("Préférences effacées.");
    render({ keepFocus: false });
  },

  "debug-clear-store": () => {
    if (!confirm("Vider la base locale enregistrée dans ce navigateur ? Le jeu de données d'exemple sera rechargé au prochain chargement.")) return;
    store.clearStorage();
    ui.toast("Base locale vidée.", "warning");
    render({ keepFocus: false });
  },

  "debug-reload": () => location.reload(),

  "debug-toast": () => ui.toast("Notification de test."),

  "print-document": () => {
    const doc = store.byId("Generateur", state.sel.Generateur);
    if (!doc) { ui.toast("Aucun document sélectionné.", "error"); return; }
    try {
      // La fenêtre d'impression ne doit pas emporter le script d'ajustement de
      // l'aperçu : il centre la feuille pour l'écran, et cette marge gauche
      // écrasait le document contre le bord droit de la feuille A4 dans
      // l'aperçu d'impression du navigateur (`preview: false`). La pagination,
      // elle, y est indispensable : c'est elle qui découpe le flux en pages, et
      // pose au bas de chacune le pied de page et son numéro — sans elle, le
      // navigateur paginerait à sa façon, et la numérotation ne suivrait pas.
      const { html } = computeDocumentParts(store.db, doc, { preview: false, paginate: true });
      if (!openPrintWindow(html)) ui.toast("Autorisez les fenêtres surgissantes pour imprimer.", "error");
    } catch (err) {
      ui.toast(`Génération impossible : ${err.message}`, "error");
    }
  },

  "print-role": (el) => {
    const seance = store.byId("Seances_d_examen", Number(el.dataset.record));
    if (!seance) return;
    if (!openPrintWindow(roleSeanceHtml(store.db, seance))) ui.toast("Autorisez les fenêtres surgissantes pour imprimer.", "error");
  },

  "print-affaires": () => {
    const rows = filteredAffaires(store, state);
    const section = state.filters.affaireSection
      ? store.byId("Sections_disciplinaires", Number(state.filters.affaireSection))
      : null;
    const html = listeAffairesHtml(store.db, rows, { section, query: state.filters.affaireQ || "" });
    if (!openPrintWindow(html)) ui.toast("Autorisez les fenêtres surgissantes pour imprimer.", "error");
  },

  /* Rapport d'activité : le rapport imprimé, et ses annexes. Un graphique
     s'exporte en PNG, tous les graphiques dans une archive ; les tableaux
     d'indicateurs en classeur Excel (une feuille par tableau) ou en archive
     de CSV. Rien de tout cela n'écrit dans la base : ce sont des lectures. */
  "print-rapport": () => {
    if (!openPrintWindow(rapportActiviteHtml(store, state))) {
      ui.toast("Autorisez les fenêtres surgissantes pour imprimer.", "error");
    }
  },

  "export-graphique": (el) => {
    const graphique = graphiqueDuBouton(el);
    if (!graphique) { ui.toast("Ce graphique n'existe plus : rechargez la page.", "error"); return; }
    try {
      const fichier = nomFichier(graphique.titre, "png");
      downloadBlob(blobDeDataUrl(pngDuGraphique(graphique).dataUrl), fichier);
      ui.toast(`Graphique exporté : ${fichier}.`);
    } catch (err) {
      console.error("Export du graphique :", err);
      ui.toast(`Export du graphique impossible : ${err.message}`, "error");
    }
  },

  "export-graphiques": () => {
    const rapport = rapportActivite(store, state);
    if (!rapport.graphiques.length) { ui.toast("Aucun graphique à exporter sur cette période.", "error"); return; }
    try {
      const entrees = rapport.graphiques.map((g) => ({
        name: `${fileSlug(g.titre)}.png`,
        data: octetsDeDataUrl(pngDuGraphique(g).dataUrl),
      }));
      const fichier = nomFichier(`graphiques — rapport ${rapport.periode}`, "zip");
      downloadBlob(zipStore(entrees), fichier);
      ui.toast(`${entrees.length} graphique(s) exportés en PNG : ${fichier}.`);
    } catch (err) {
      console.error("Export des graphiques :", err);
      ui.toast(`Export des graphiques impossible : ${err.message}`, "error");
    }
  },

  "export-indicateurs-xlsx": async (el) => {
    const rapport = rapportActivite(store, state);
    if (!rapport.tableaux.length) { ui.toast("Aucun tableau à exporter sur cette période.", "error"); return; }
    const fichier = nomFichier(`indicateurs — rapport ${rapport.periode}`, "xlsx");
    tableExportBusy(el, true);
    try {
      const blob = await classeurXlsx(rapport.tableaux);
      downloadBlob(blob, fichier);
      ui.toast(`Excel exporté : ${rapport.tableaux.length} feuille(s), ${fichier}.`);
    } catch (err) {
      console.error("Export Excel des indicateurs :", err);
      ui.toast(`Export Excel impossible : ${err.message}`, "error");
    } finally {
      tableExportBusy(el, false);
    }
  },

  "export-indicateurs-csv": (el) => {
    const rapport = rapportActivite(store, state);
    if (!rapport.tableaux.length) { ui.toast("Aucun tableau à exporter sur cette période.", "error"); return; }
    try {
      const encodeur = new TextEncoder();
      const entrees = rapport.tableaux.map((t) => ({
        name: `${fileSlug(t.nom)}.csv`,
        data: encodeur.encode(csvDeTableau(t)),
      }));
      const fichier = nomFichier(`indicateurs — rapport ${rapport.periode}`, "zip");
      downloadBlob(zipStore(entrees), fichier);
      ui.toast(`CSV exportés : ${entrees.length} fichier(s), ${fichier}.`);
    } catch (err) {
      console.error("Export CSV des indicateurs :", err);
      ui.toast(`Export CSV impossible : ${err.message}`, "error");
    }
  },

  "export-pdf": (el) => runExport("pdf", el),
  "export-docx": (el) => runExport("docx", el),
  "export-odt": (el) => runExport("odt", el),

  /* Export tabulaire : les registres et les catalogues se téléchargent en CSV
     ou en classeur Excel ; « Réglages › Données » exporte la base entière. */
  "export-csv": (el) => runTableExport("csv", el),
  "export-xlsx": (el) => runTableExport("xlsx", el),
  "export-base-csv": () => runBaseExport("csv"),
  "export-base-xlsx": () => runBaseExport("xlsx"),

  /* Calendrier des échéances (voir views/calendrier.js et calendrier.js). Un
     fichier .ics se range dans l'agenda professionnel : c'est la seule forme
     qui survive à un document Grist, où l'outil n'est joignable de nulle part
     ailleurs. Le fichier suit le périmètre de visibilité courant. */
  "export-ics": () => {
    try {
      const contenu = icalCalendrier(store, state, {
        nom: `Sections disciplinaires — ${nomPerimetre(store, state)}`,
      });
      downloadBlob(new Blob([contenu], { type: "text/calendar;charset=utf-8" }), nomFichierIcal(store, state));
      ui.toast("Calendrier exporté : le fichier .ics s'importe dans votre agenda.");
    } catch (err) {
      console.error("Export iCalendar :", err);
      ui.toast(`Export du calendrier impossible : ${err.message}`, "error");
    }
  },

  "cal-mois": (el) => {
    const pas = Number(el.dataset.record) || 0;
    const actuel = /^(\d{4})-(\d{2})$/.exec(String(state.filters.calendrierMois || ""));
    const base = actuel ? new Date(Number(actuel[1]), Number(actuel[2]) - 1, 1) : new Date();
    const cible = new Date(base.getFullYear(), base.getMonth() + pas, 1);
    state.filters.calendrierMois = `${cible.getFullYear()}-${String(cible.getMonth() + 1).padStart(2, "0")}`;
    state.filters.calendrierJour = "";
    persistPrefs();
    render({ keepFocus: false });
  },

  // « Aujourd'hui » **efface** le mois choisi, au lieu de le décaler : revenir
  // au mois courant est un retour à l'état initial, pas un pas de navigation.
  // Confondre les deux laissait le bouton sans effet dès qu'on avait changé de
  // mois — il sautait de zéro mois.
  "cal-aujourd-hui": () => {
    state.filters.calendrierMois = "";
    state.filters.calendrierJour = "";
    persistPrefs();
    render({ keepFocus: false });
  },

  "cal-jour": (el) => {
    state.filters.calendrierJour = String(el.dataset.record || "");
    render({ keepFocus: false });
  },
};

function runAction(name, el) {
  const fn = ACTIONS[name];
  if (!fn) return;
  fn(el);
}

/* ------------------------------------------------------------------ */
/* Suppression                                                         */
/* ------------------------------------------------------------------ */

function childTablesOf(table) {
  return Object.entries(SCHEMA)
    .filter(([, def]) => def.parent?.table === table)
    .map(([name, def]) => ({ name, column: def.parent.column }));
}

function doDelete(spec) {
  const [tableName, idRaw] = String(spec || "").split(":");
  const id = Number(idRaw);
  if (!tableName || !id) return;
  const label = SCHEMA[tableName]?.singular || SCHEMA[tableName]?.label || tableName;
  const enfants = childTablesOf(tableName).reduce(
    (n, { name, column }) => n + store.table(name).filter((r) => Number(r[column]) === id).length, 0);
  const extra = enfants ? ` ${enfants} enregistrement(s) lié(s) seront supprimés en même temps.` : "";
  if (!confirm(`Supprimer ce ${label} ? Cette action est définitive.${extra}`)) return;
  if (Number(state.sel[tableName]) === id) delete state.sel[tableName];
  // Supprimer le document dont on regarde l'espace de rédaction laisserait la
  // page sur une adresse morte : on revient à la liste des documents. Même
  // règle pour la trame ou le type de trame ouvert dans Réglages.
  const surCeDocument = tableName === "Generateur" && state.page === "documents" && Number(state.sub) === id;
  // Supprimer la décision dont on rédige le texte laisserait, là encore, la
  // page sur une adresse morte : on revient au registre.
  const surCetteDecision = tableName === "Decisions" && state.page === "decisions" && Number(state.sub) === id;
  const surCetteFiche = state.page === "reglages" && FICHES_SUBS[state.sub] === tableName
    && Number(state.fiche) === id;
  const registre = state.sub;
  // La suppression est **journalisée avant d'être exécutée** (NC-0010) : la
  // trace existe même si l'écriture échoue ensuite, et elle nomme ce qui a
  // disparu — le journal ne suffirait pas s'il ne portait qu'un identifiant.
  journaliser(store, {
    action: "suppression",
    table: tableName,
    id,
    resume: `Suppression définitive d'un ${label}${enfants ? ` (et de ${enfants} enregistrement(s) lié(s))` : ""}.`,
  });
  store.deleteRow(tableName, id);
  ui.toast("Enregistrement supprimé.");
  if (surCeDocument) navTo("documents");
  else if (surCetteDecision) navTo("decisions");
  else if (surCetteFiche) navTo(`reglages/${registre}`);
}

/* ------------------------------------------------------------------ */
/* Mise à la corbeille par lots (registre des trames)                  */
/* ------------------------------------------------------------------ */

/**
 * Met une ou plusieurs trames à la corbeille. Rien n'est détruit : les
 * documents qui s'appuient sur une trame mise de côté restent en place, sans
 * trame, et la retrouvent dès qu'elle revient. On le dit avant d'agir, pour
 * que l'effet sur les documents ne soit pas une surprise.
 */
function mettreTramesALaCorbeille(ids) {
  const voulus = [...new Set((ids || []).map(Number).filter(Boolean))];
  const trames = voulus.map((id) => store.byId("Trames", id)).filter(Boolean);
  if (!trames.length) return;
  const noms = trames.map((t) => `« ${str(t.Nom)} »`);
  const liste = noms.length > 3
    ? `${noms.slice(0, 3).join(", ")} et ${noms.length - 3} autre(s)`
    : noms.join(", ");
  const orphelins = store.table("Generateur")
    .filter((d) => trames.some((t) => Number(d.Template) === t.id)).length;
  const plusieurs = trames.length > 1;
  const titre = plusieurs
    ? `Mettre ${trames.length} trames à la corbeille ?`
    : `Mettre la trame ${liste} à la corbeille ?`;
  const detail = plusieurs ? `\n${liste}.` : "";
  const suite = plusieurs
    ? "Elles pourront être restaurées depuis la corbeille."
    : "Elle pourra être restaurée depuis la corbeille.";
  const extra = orphelins
    ? `\n${orphelins} document${orphelins > 1 ? "s" : ""} ${orphelins > 1 ? "s'appuient" : "s'appuie"} sur `
      + `${plusieurs ? "ces trames" : "cette trame"} et ${orphelins > 1 ? "resteront" : "restera"} sans trame `
      + `${plusieurs ? "tant qu'elles y seront" : "tant qu'elle y sera"}.`
    : "";
  if (!confirm(`${titre}${detail}\n${suite}${extra}`)) return;
  const par = state.debugName || userName(state.user) || "";
  store.batch(() => {
    for (const t of trames) store.mettreALaCorbeille("Trames", t.id, { par });
  });
  // La mise à la corbeille est une suppression au sens du registre (NC-0010) :
  // elle est journalisée, avec le nom des trames concernées.
  journaliser(store, {
    action: "corbeille",
    table: "Trames",
    resume: `${trames.length} trame(s) mise(s) à la corbeille : ${noms.slice(0, 5).join(", ")}${noms.length > 5 ? "…" : ""}.`,
  });
  state.trames.ids = state.trames.ids.filter((id) => !trames.some((t) => t.id === id));
  ui.toast(trames.length > 1
    ? `${trames.length} trames mises à la corbeille.`
    : "Trame mise à la corbeille.");
  // La trame ouverte à l'écran vient de partir : l'adresse ne désigne plus rien,
  // on revient au registre (même règle que la suppression d'un document).
  if (state.page === "reglages" && state.sub === "trames"
    && trames.some((t) => Number(t.id) === Number(state.fiche))) {
    navTo("reglages/trames");
  }
}

/* ------------------------------------------------------------------ */
/* Consultation seule                                                  */
/* ------------------------------------------------------------------ */

/* Ces actions n'écrivent rien : elles restent accessibles à un visiteur
   (fermer une fenêtre, imprimer, exporter, filtrer, recharger depuis Grist). */
const READ_ONLY_ACTIONS = new Set([
  "close-dialog",
  "toggle-theme",
  "toggle-fullscreen",
  "affaire-step-1",
  "affaire-step-2",
  "reset-decision-filters",
  "export",
  "grist-refresh",
  "grist-retry",
  "grist-install",
  "identite-table",
  "grist-check",
  // Vérification de la livraison : elle lit l'archive et le dépôt ; seule
  // l'entrée au Journal qu'elle laisse est une écriture, et `journaliser`
  // s'abstient de lui-même en lecture seule.
  "debug-verifier",
  "print-document",
  "print-role",
  "print-affaires",
  "print-rapport",
  "export-pdf",
  "export-docx",
  "export-odt",
  "export-ics",
  // Exports tabulaires : ils ne font que lire la base.
  "export-csv",
  "export-xlsx",
  "export-base-csv",
  "export-base-xlsx",
  // Rapport d'activité : graphiques en PNG, tableaux d'indicateurs en CSV ou
  // en Excel — que des lectures, eux aussi.
  "export-graphique",
  "export-graphiques",
  "export-indicateurs-xlsx",
  "export-indicateurs-csv",
  // Navigation du calendrier : ce sont des filtres d'affichage, pas des écritures.
  "cal-mois",
  "cal-aujourd-hui",
  "cal-jour",
  "document-affaire",
  "document-trame",
  // Espace de rédaction d'un document : plier les paramètres ou les variables
  // ne change que l'affichage.
  "doc-parametres",
  "doc-variables",
  // Atelier de rédaction d'une décision : replier un outil ne change que
  // l'affichage. Insérer un considérant, en revanche, écrit dans le texte.
  "dec-considerants",
  "dec-formules",
  "dec-champs",
  "dec-composition",
  "dec-controles",
  "dec-variables",
  "dec-parametres",
  // Espace de rédaction d'une trame : replier les variables, ou suivre un
  // renvoi vers le registre des documents ou celui des trames, n'écrit rien.
  "trame-variables",
  "trame-documents",
  "type-trames",
  // Import : la sélection de la source et le choix du mode n'écrivent rien ;
  // c'est « Appliquer » qui écrit, et lui seul est bloqué.
  "import-fichier",
  "import-effacer",
  "import-mode",
  "import-cible",
  // Composition d'une section : télécharger le modèle ou l'export n'écrit
  // rien. L'import, lui, écrit : il suit le sort des autres écritures.
  "membres-modele",
  "membres-export",
  // Outils de mise au point : toujours utilisables, y compris lorsqu'un rôle
  // restreint est simulé — sans quoi on ne pourrait plus revenir en arrière.
  "debug-role",
  "debug-name",
  "debug-export",
  "debug-clear-prefs",
  "debug-clear-store",
  "debug-reload",
  "debug-toast",
]);

const READ_ONLY_NOTICE = "Consultation seule : votre rôle ne permet pas de modifier les données.";

/**
 * Tient le branchement Grist en accord avec le rôle courant : un visiteur ne
 * doit envoyer aucune écriture au document. Vérifié à chaque rendu, pour que
 * l'état du branchement ne puisse jamais être en retard sur celui de
 * l'utilisateur.
 */
function syncGristWrites() {
  if (state.grist !== "connected") return;
  if (canWrite(state)) enableGristWrites(store);
  else disableGristWrites(store);
}

/**
 * Neutralise les commandes d'écriture d'un utilisateur en lecture seule.
 * Champs et boutons sont désactivés (et non retirés) afin que la page reste
 * lisible et que la mise en page ne bouge pas d'un rôle à l'autre.
 */
function applyReadOnly(root) {
  if (!readOnly()) return;
  const disable = (el) => {
    el.disabled = true;
    if (!el.getAttribute("title")) el.setAttribute("title", READ_ONLY_NOTICE);
  };
  // Un groupe de cases n'est pas un champ : ce sont ses cases qui se
  // désactivent, et le groupe entier qui porte l'explication.
  const disableGroupe = (el) => {
    for (const item of el.querySelectorAll("input, select, textarea")) disable(item);
    if (!el.getAttribute("title")) el.setAttribute("title", READ_ONLY_NOTICE);
    el.classList.add("app-checklist--readonly");
  };
  for (const el of root.querySelectorAll("[data-bind]")) {
    if (el.matches("input, select, textarea")) disable(el);
    else disableGroupe(el);
  }
  for (const el of root.querySelectorAll("[data-delete]")) disable(el);
  for (const el of root.querySelectorAll("[data-action]")) {
    if (READ_ONLY_ACTIONS.has(el.dataset.action)) continue;
    disable(el);
  }
  // Les zones WYSIWYG ne sont pas des champs de formulaire : elles se
  // neutralisent par leur attribut d'édition et par la barre d'outils.
  for (const editor of root.querySelectorAll("[data-wysiwyg-editor]")) {
    editor.setAttribute("contenteditable", "false");
    editor.setAttribute("title", READ_ONLY_NOTICE);
  }
  for (const box of root.querySelectorAll(".app-wysiwyg")) box.classList.add("app-wysiwyg--readonly");
  for (const el of root.querySelectorAll(".app-wysiwyg__toolbar button")) disable(el);
}

/** Message affiché lorsqu'une écriture est tout de même déclenchée. */
function blockedByRole() {
  ui.toast(READ_ONLY_NOTICE, "warning");
}

/* ------------------------------------------------------------------ */
/* Liens de contact                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ouvre un lien de contact (`mailto:`, `tel:`) **hors du cadre de l'outil**.
 *
 * Cliqué dans le cadre, un `mailto:` fait naviguer la page du widget : le
 * document est déchargé, et la liaison au document Grist avec lui. Au retour du
 * client de messagerie, l'outil n'a plus ni identité ni accès — il faut
 * recharger la page. Une fenêtre à part laisse l'outil intact : c'est le client
 * de messagerie qui s'ouvre, pas notre page qui part. Si le navigateur refuse
 * la fenêtre, l'adresse est copiée et annoncée : mieux vaut la donner que la
 * perdre.
 */
function ouvrirLienExterne(href) {
  let fenetre = null;
  try {
    // Sans l'option `noopener` : la spécification veut que `window.open` rende
    // alors `null` même quand la fenêtre s'ouvre, et on ne saurait plus
    // distinguer un refus du navigateur d'une ouverture réussie.
    fenetre = window.open(String(href), "_blank");
  } catch (err) {
    fenetre = null;
  }
  if (fenetre) return;
  // Repli : l'adresse seule — le sujet éventuel du courriel ne se copie pas
  // utilement.
  const adresse = String(href).replace(/^(mailto|tel):/i, "").split("?")[0];
  const copie = navigator.clipboard && navigator.clipboard.writeText
    ? navigator.clipboard.writeText(adresse)
    : Promise.reject(new Error("presse-papiers indisponible"));
  copie.then(
    () => ui.toast(`Fenêtre refusée par le navigateur : « ${adresse} » a été copiée.`),
    () => ui.toast(`Fenêtre refusée par le navigateur. Adresse : ${adresse}`, "warning"),
  );
}

/* ------------------------------------------------------------------ */
/* Écouteurs (délégation)                                              */
/* ------------------------------------------------------------------ */

function onClick(event) {
  const target = event.target;

  if (target.classList && target.classList.contains("app-dialog-backdrop")) { closeModal(); return; }

  const cmd = target.closest("[data-cmd]");
  if (cmd && !cmd.disabled) { event.preventDefault(); runEditorCommand(cmd); return; }

  const nav = target.closest("[data-nav]");
  if (nav) { event.preventDefault(); navTo(nav.dataset.nav); return; }

  // Un lien de contact ne doit jamais faire naviguer la page : c'est le geste
  // qui, depuis un document, ouvrait la messagerie en emportant la liaison au
  // document Grist (voir `ouvrirLienExterne`). Dans l'éditeur, le clic place le
  // curseur — comme dans un traitement de texte, c'est Ctrl (ou Cmd) + clic qui
  // suit le lien. Le lien n'est donc jamais suivi « en place », où qu'il soit.
  const contact = target.closest("a[href]");
  if (contact && /^(mailto|tel):/i.test(contact.getAttribute("href") || "")) {
    event.preventDefault();
    if (!contact.closest("[data-wysiwyg-editor]") || event.ctrlKey || event.metaKey) {
      ouvrirLienExterne(contact.getAttribute("href"));
    }
    return;
  }

  const close = target.closest("[data-close-dialog]");
  if (close) { event.preventDefault(); closeModal(); return; }

  const del = target.closest("[data-delete]");
  if (del) {
    event.preventDefault();
    if (readOnly()) { blockedByRole(); return; }
    doDelete(del.dataset.delete);
    return;
  }

  // Un lien d'ancre saute à une section de la page sans changer d'adresse :
  // la barre d'ancres est un sommaire, pas un itinéraire — l'adresse partagée
  // reste celle de la page. Le saut est **franc**, et non animé
  // (`behavior: "smooth"`) : certains navigateurs ignorent l'animation, et le
  // sommaire ne menait alors nulle part — un sommaire sans transition vaut
  // mieux qu'un sommaire sans effet.
  const ancre = target.closest("[data-ancre]");
  if (ancre) {
    event.preventDefault();
    const el = document.getElementById(ancre.dataset.ancre);
    if (el) el.scrollIntoView({ block: "start" });
    return;
  }

  const action = target.closest("[data-action]");
  if (action && action.tagName !== "SELECT") {
    event.preventDefault();
    if (readOnly() && !READ_ONLY_ACTIONS.has(action.dataset.action)) { blockedByRole(); return; }
    runAction(action.dataset.action, action);
    return;
  }

  const open = target.closest("[data-open]");
  if (open) {
    const interactive = target.closest("input, select, textarea, button, a");
    if (!(open.tagName === "TR" && interactive)) {
      event.preventDefault();
      if (open.dataset.selectTable && open.dataset.select) {
        state.sel[open.dataset.selectTable] = Number(open.dataset.select);
      }
      if (open.dataset.openTab) state.tabs[open.dataset.open] = open.dataset.openTab;
      persistPrefs();
      navTo(open.dataset.open);
      return;
    }
  }

  const tab = target.closest("[data-tab]");
  if (tab) {
    event.preventDefault();
    const [group, id] = tab.dataset.tab.split(":");
    state.tabs[group] = id;
    render();
    return;
  }

  const sel = target.closest("[data-select]");
  if (sel) {
    const interactive = target.closest("input, select, textarea, button, a");
    if (interactive && interactive !== sel) return;
    const tableName = sel.dataset.selectTable || sel.closest("[data-select-table]")?.dataset.selectTable;
    const id = Number(sel.dataset.select);
    if (!tableName || !id) return;
    event.preventDefault();
    state.sel[tableName] = id;
    persistPrefs();
    render();
  }
}

function onChange(event) {
  const el = event.target;
  if (el.dataset && el.dataset.filter) { setFilter(el); return; }
  if (fichierDuChamp(el)) return;
  const bind = el.closest("[data-bind]");
  if (bind) {
    if (readOnly()) { blockedByRole(); return; }
    // La saisie d'un champ est terminée (perte du focus, ou validation) : une
    // date encore incomplète est alors signalée, pas enregistrée en silence.
    bindValue(bind, { finaliser: true });
    return;
  }
  const action = el.closest("[data-action]");
  if (action) {
    if (readOnly() && !READ_ONLY_ACTIONS.has(action.dataset.action)) { blockedByRole(); return; }
    runAction(action.dataset.action, action);
  }
}

let editorSaveTimer = null;
let editorPreviewTimer = null;

/**
 * Sépare la **feuille d'un document** en ses parties, autour des deux marques
 * invisibles que l'espace de rédaction y a laissées (`data-marque`, voir
 * `assemblageDocument`, views/documents.js) : ce qui précède le texte, le texte
 * lui-même, et ce qui le suit. C'est ce découpage qui distingue, à
 * l'enregistrement, la feuille de style du document (les deux bords) de son
 * texte (`Generateur.Contenu`), pour que chacun continue de suivre sa source
 * tant qu'il n'a pas bougé.
 *
 * Renvoie `null` quand les marques ont disparu — le texte et la feuille ont
 * alors été réunis par une correction : la feuille s'enregistre d'un bout à
 * l'autre (voir `computeDocumentParts`, render.js).
 */
function decouperAssemblage(editorEl) {
  const debut = editorEl.querySelector('[data-marque="corps-debut"]');
  const fin = editorEl.querySelector('[data-marque="corps-fin"]');
  if (!debut || !fin) return null;
  if (!(debut.compareDocumentPosition(fin) & Node.DOCUMENT_POSITION_FOLLOWING)) return null;
  const partie = (range) => {
    const hote = document.createElement("div");
    hote.appendChild(range.cloneContents());
    return editorToHtml(hote);
  };
  const r1 = document.createRange();
  r1.setStart(editorEl, 0);
  r1.setEndBefore(debut);
  const r2 = document.createRange();
  r2.setStartAfter(debut);
  r2.setEndBefore(fin);
  const r3 = document.createRange();
  r3.setStartAfter(fin);
  r3.setEnd(editorEl, editorEl.childNodes.length);
  return { avant: partie(r1), corps: partie(r2), apres: partie(r3) };
}

/**
 * Enregistre la **feuille d'un document** — ou d'une **trame**, qui s'écrit de
 * même —, écrite d'un seul tenant : ses deux bords retournent à la feuille de
 * style (colonne `Feuille_de_style`), et le texte du milieu à son texte propre
 * (`Generateur.Contenu`, ou `Trames.Template_contenu`). Chacun n'est écrit que
 * s'il a bougé — tant qu'il est resté fidèle à sa source, on ne le fige pas : le
 * document continue de suivre sa trame, la trame de suivre la feuille de son
 * format (voir les références posées par `assemblageDocument`,
 * views/documents.js, et l'atelier d'une trame, views/reglages.js).
 */
function enregistrerAssemblage(editorEl, row) {
  const html = editorToHtml(editorEl);
  const reference = (valeur) => (valeur === undefined ? undefined : htmlCanonique(valeur));
  const table = editorEl.dataset.table || "Generateur";
  // Les deux colonnes que l'espace de rédaction sépare : le texte, et la feuille
  // de style qu'il s'est donnée. Une trame les porte sous d'autres noms que le
  // document qui la suit.
  const colonnes = table === "Trames"
    ? { feuille: "Feuille_de_style", corps: "Template_contenu" }
    : { feuille: "Feuille_de_style", corps: "Contenu" };
  const baseFeuille = reference(editorEl.dataset.wysiwygBase);
  const baseCorps = reference(editorEl.dataset.wysiwygBaseCorps);
  const champs = {};
  const parts = decouperAssemblage(editorEl);

  if (!parts) {
    // Feuille enregistrée d'un bout à l'autre : il n'y a plus de texte à en
    // séparer, et sa colonne de texte n'a plus d'objet.
    if (baseFeuille !== undefined && html === baseFeuille) return;
    if (!html) {
      if (String(row[colonnes.feuille] || "").trim()) {
        champs[colonnes.feuille] = "";
        champs[colonnes.corps] = "";
      }
    } else if (row[colonnes.feuille] !== html || String(row[colonnes.corps] || "").trim()) {
      champs[colonnes.feuille] = html;
      champs[colonnes.corps] = "";
    }
  } else {
    const { avant, corps, apres } = parts;
    const feuille = `${avant}${BALISE_CORPS}${apres}`;
    const feuilleCanon = `${htmlCanonique(avant)}${BALISE_CORPS}${htmlCanonique(apres)}`;
    // La feuille : revenue mot pour mot à celle de sa source, elle **efface**
    // l'adaptation, qui se remet à en hériter ; sinon elle s'enregistre — mais
    // seulement si elle a bougé.
    if (baseFeuille !== undefined && feuilleCanon === baseFeuille) {
      if (String(row[colonnes.feuille] || "").trim()) champs[colonnes.feuille] = "";
    } else if (row[colonnes.feuille] !== feuille) {
      champs[colonnes.feuille] = feuille;
    }
    // Le texte : revenu à celui de sa source, il cesse d'être propre à la pièce,
    // qui se remet à le suivre. Une trame n'a pas de source pour son corps : le
    // sien est toujours le sien (sa référence, `data-wysiwyg-base-corps`, n'est
    // pas posée).
    if (baseCorps !== undefined && htmlCanonique(corps) === baseCorps) {
      if (String(row[colonnes.corps] || "").trim()) champs[colonnes.corps] = "";
    } else if (row[colonnes.corps] !== corps) {
      champs[colonnes.corps] = corps;
    }
  }

  if (!Object.keys(champs).length) return true;
  store.updateRowQuiet(table, row.id, champs);
  clearTimeout(editorSaveTimer);
  editorSaveTimer = setTimeout(() => store.persist(), 500);
  clearTimeout(editorPreviewTimer);
  editorPreviewTimer = setTimeout(() => refreshPreview(table, row), 250);
  if (table === "Trames") syncTrameFeuille(row);
  else syncDocEtat(row.id);
  return true;
}

/**
 * Enregistre le texte édité en WYSIWYG (feuille de style d'un format, feuille
 * d'un document ou d'une trame — réunie, `assemblage` —, ou l'un de leurs
 * champs isolés). L'écriture est
 * directe (pas de nouveau rendu : le curseur doit rester où il est) et différée
 * de quelques centaines de millisecondes, l'aperçu suivant peu après.
 */
function saveEditorContent(editorEl) {
  if (!editorEl) return;
  if (readOnly()) { blockedByRole(); return; }
  const table = editorEl.dataset.table || "Trames";
  const field = editorEl.dataset.field || "Template_contenu";
  const row = store.byId(table, Number(editorEl.dataset.record));
  if (!row) return;
  // La feuille d'un document se lit d'un seul tenant : c'est ici qu'on la
  // sépare en ses deux bords et son texte.
  if (field === "assemblage") { enregistrerAssemblage(editorEl, row); return; }
  const html = editorToHtml(editorEl);
  // Le texte d'un document part de la trame, et la feuille de style d'une trame
  // part de celle de son format : tant que rien n'a bougé, on n'enregistre rien
  // — le document continue de suivre la trame, la trame continue d'hériter.
  // La référence se compare dans l'écriture du navigateur, sinon la moindre
  // entité HTML ferait croire à une modification.
  const base = editorEl.dataset.wysiwygBase;
  const reference = base === undefined ? undefined : htmlCanonique(base);
  const vide = !String(row[field] ?? "").trim();
  if (reference !== undefined && html === reference && vide) return;
  if (row[field] === html) return;
  store.updateRowQuiet(table, row.id, { [field]: html });
  clearTimeout(editorSaveTimer);
  editorSaveTimer = setTimeout(() => store.persist(), 500);
  clearTimeout(editorPreviewTimer);
  editorPreviewTimer = setTimeout(() => refreshPreview(table, row), 250);
}

/**
 * État de la feuille de style d'une trame : le texte en cours d'édition est-il
 * encore celui de son format — la trame hérite — ou est-ce devenu le sien ?
 *
 * L'enregistrement ne redessine pas la page, pour ne pas déplacer le curseur ;
 * sans ce relevé, l'auteur ne verrait apparaître qu'à la prochaine visite
 * l'adaptation qu'il vient de créer, et le bouton qui la défait.
 */
function syncTrameFeuille(row) {
  const etat = document.getElementById("trameFeuilleEtat");
  if (!etat) return;
  const adaptee = String(row?.Feuille_de_style ?? "").trim().length > 0;
  etat.textContent = adaptee ? etat.dataset.adaptee : etat.dataset.heritee;
  etat.classList.toggle("app-feuille__etat--adaptee", adaptee);
  const bouton = document.getElementById("trameFeuilleRetablirBtn");
  if (bouton) bouton.hidden = !adaptee;
  for (const el of document.querySelectorAll("[data-feuille-heritee]")) el.hidden = adaptee;
  for (const el of document.querySelectorAll("[data-feuille-adaptee]")) el.hidden = !adaptee;
}

/** Redessine l'aperçu correspondant au document en cours d'édition. */
function refreshPreview(table, row) {
  const id = table === "Types_Trames" ? "typePreview" : table === "Generateur" ? "docPreview" : "tramePreview";
  const render = table === "Types_Trames" ? previewType
    : table === "Generateur" ? (s, doc) => computeDocumentParts(s.db, doc).html
      : previewTrame;
  const frame = document.getElementById(id);
  if (frame) frame.srcdoc = render(store, row);
}

/**
 * État d'un document face à sa trame : l'a-t-il suivie, ou s'en est-il écarté —
 * d'un texte propre, d'une feuille de style adaptée, ou des deux à la fois ?
 * L'espace de rédaction n'a qu'une feuille, donc qu'un état : la pastille le
 * dit, et le bouton qui ramène à la trame ne s'affiche que lorsqu'il a lieu
 * d'être. Comme pour une trame (voir `syncTrameFeuille`), l'enregistrement ne
 * redessine pas la page, pour ne pas déplacer le curseur : sans ce relevé,
 * l'auteur ne verrait le changement qu'à sa prochaine visite, et le bouton avec
 * lui.
 */
function syncDocEtat(record) {
  const doc = store.byId("Generateur", Number(record ?? state.sel.Generateur));
  const badge = document.getElementById("docEtat");
  if (!doc || !badge) return;
  const textePropre = String(doc.Contenu ?? "").trim().length > 0;
  const feuillePropre = String(doc.Feuille_de_style ?? "").trim().length > 0;
  const propre = textePropre || feuillePropre;
  badge.textContent = propre ? "Propre à ce document" : "Suit la trame";
  badge.classList.toggle("fr-badge--success", propre);
  badge.classList.toggle("fr-badge--info", !propre);
  for (const id of ["docContenuReinitBtn"]) {
    const btn = document.getElementById(id);
    if (btn) btn.hidden = !propre;
  }
  const figer = document.getElementById("docContenuFigerBtn");
  if (figer) figer.hidden = !textePropre;
}

/** Exécute une commande de mise en forme demandée par la barre d'outils. */
function runEditorCommand(btn) {
  const editor = currentEditor();
  if (!editor) return;
  if (readOnly()) { blockedByRole(); return; }
  const cmd = btn.dataset.cmd;
  let value = btn.dataset.value || null;
  editor.focus();
  // Retraits : le paragraphe se décale d'un pas, ou la première ligne du
  // considérant se marque. Ce ne sont pas des commandes du navigateur — sa
  // commande d'indentation empilait des citations imbriquées, que les exports
  // ne savaient pas relire (voir `commandeRetrait`, editor.js).
  if (cmd === "indent" || cmd === "outdent" || cmd === "retraitPremiere") {
    if (commandeRetrait(editor, cmd)) { saveEditorContent(editor); refreshToolbar(); }
    return;
  }
  // Fragments insérés par l'outil : ils n'ont pas d'équivalent parmi les
  // commandes du navigateur, et s'insèrent comme du texte au curseur.
  if (cmd === "pageBreak") { insertHtml(editor, pageBreakHtml()); saveEditorContent(editor); return; }
  if (cmd === "insertTable") { insertHtml(editor, tableHtml(3, 3)); saveEditorContent(editor); return; }
  if (cmd === "insertImage") {
    const url = prompt("Adresse de l'image :", "https://");
    if (!url) return;
    const fragment = imageHtml(url);
    if (!fragment) { ui.toast("Cette adresse ne peut pas être affichée dans un document.", "error"); return; }
    insertHtml(editor, fragment);
    saveEditorContent(editor);
    return;
  }
  if (cmd === "createLink") {
    const href = prompt("Adresse du lien :", "https://");
    if (!href) return;
    value = href;
  }
  if (cmd === "formatBlock" && value) value = `<${value}>`;
  // Effets en ligne et « Effacer la mise en forme » sur une sélection qui
  // touche des pastilles : le navigateur ignore la pastille (un îlot
  // insécable) pour l'italique, le souligné et le barré — `basculerEffet` et
  // `delaverPastilles` la rattrapent. Sans pastille touchée, les deux rendent
  // `false` et la commande native suffit.
  if (basculerEffet(editor, cmd) || (cmd === "removeFormat" && delaverPastilles(editor))) {
    saveEditorContent(editor);
    refreshToolbar();
    return;
  }
  try {
    document.execCommand(cmd, false, value);
  } catch (err) {
    console.warn("Commande de mise en forme refusée", err);
    return;
  }
  saveEditorContent(editor);
  refreshToolbar();
}

function onInput(event) {
  const el = event.target;
  if (el.dataset && el.dataset.filter) { setFilter(el, { debounce: true }); return; }
  // Le nom simulé se reflète dans l'en-tête à la frappe, sans reconstruire la
  // page (le champ perdrait le focus).
  if (el.id === "debugName") {
    state.debugName = String(el.value || "").trim();
    persistDebugPrefs();
    const nameEl = document.querySelector(".app-user__name");
    if (nameEl) nameEl.textContent = state.debugName || userName(state.user);
    return;
  }
  if (readOnly()) return;
  if (fichierDuChamp(el)) return;
  const bind = el.closest("[data-bind]");
  if (bind && !bind.hasAttribute("data-record")) bindValue(bind);
}

/* ------------------------------------------------------------------ */
/* Champs de fichier                                                   */
/* ------------------------------------------------------------------ */

/** Lecteur associé à chaque champ de fichier de l'interface. */
const LECTEURS_FICHIER = {
  importSourceFile: (fichier) => lireFichierImport(fichier),
  importFile: (fichier) => importFile(fichier),
  membresCsvFile: (fichier) => importerCompositionCsv(fichier),
  // Images choisies sur ce poste : la cible de l'enregistrement est portée par
  // le champ lui-même (`data-table`, `data-record`, `data-colonne`).
  identiteFile: (fichier, el) => enregistrerImageChoisie(fichier, el),
  sectionMarianneFile: (fichier, el) => enregistrerImageChoisie(fichier, el),
  sectionLogoFile: (fichier, el) => enregistrerImageChoisie(fichier, el),
};

/**
 * Prend en charge un champ de fichier qui vient d'être renseigné.
 *
 * Deux précautions, apprises à la dure :
 *
 *  - un champ de fichier déclenche « change » dans tous les navigateurs, mais
 *    « input » seulement dans certains d'entre eux. Les deux événements passent
 *    donc par ici, et un repère posé sur le champ empêche la seconde passe de
 *    relire le même fichier ;
 *  - **vider le champ avant la fin de la lecture libère le fichier** dans
 *    plusieurs navigateurs : la lecture échoue alors sur un fichier pourtant
 *    bien choisi. Le champ n'est donc vidé qu'une fois la lecture terminée, ce
 *    qui laisse malgré tout resélectionner le même fichier.
 */
function fichierDuChamp(el) {
  const fichier = el && el.files && el.files[0];
  if (!fichier) return false;
  const lecteur = LECTEURS_FICHIER[el.id];
  if (!lecteur) return false;
  if (readOnly()) { blockedByRole(); return true; }
  if (el.dataset.fichierEnCours === "1") return true;
  el.dataset.fichierEnCours = "1";
  const terminer = () => {
    try { el.value = ""; delete el.dataset.fichierEnCours; } catch { /* champ détaché du document */ }
  };
  Promise.resolve()
    .then(() => lecteur(fichier, el))
    .catch((err) => ui.toast((err && err.message) || "Lecture du fichier impossible.", "error"))
    .finally(terminer);
  return true;
}

/**
 * Enregistre dans la base une image choisie sur le poste (data URL).
 *
 * La cible est portée par le champ lui-même : `data-table`, `data-record` et
 * `data-colonne`. La limite de taille est celle des autres images embarquées
 * (voir `LOGO_MAX_BYTES`) : l'image est stockée avec les données, et un
 * document Grist n'a pas vocation à héberger des photographies.
 */
function enregistrerImageChoisie(file, el) {
  const table = el.dataset.table;
  const colonne = el.dataset.colonne;
  if (!table || !colonne) return;
  const terminer = () => { try { el.value = ""; } catch { /* champ détaché du document */ } };
  if (!/^image\//.test(file.type)) {
    terminer();
    ui.toast("Choisissez un fichier image (SVG, PNG, JPEG).", "error");
    return;
  }
  if (file.size > LOGO_MAX_BYTES) {
    terminer();
    ui.toast(`Image trop lourde (${formatBytes(file.size)}) : préférez une adresse d'image, ou allégez le fichier.`, "error");
    return;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const row = store.byId(table, Number(el.dataset.record)) || store.table(table)[0];
      if (!row) {
        ui.toast("Enregistrement introuvable : l'image n'a pas été enregistrée.", "error");
        resolve();
        return;
      }
      store.updateRow(table, row.id, { [colonne]: String(reader.result || "") });
      ui.toast("Image enregistrée : elle est désormais intégrée aux documents générés.");
      resolve();
    };
    reader.onerror = () => { ui.toast("Lecture du fichier impossible.", "error"); resolve(); };
    reader.onloadend = terminer;
    reader.readAsDataURL(file);
  });
}

function importFile(file) {
  return lireTexte(file)
    .then((texte) => {
      store.importJson(texte);
      ui.toast("Données importées.");
    })
    .catch((err) => ui.toast(`Import impossible : ${(err && err.message) || err}`, "error"));
}

/* ------------------------------------------------------------------ */
/* Import du tableur d'origine (Réglages › Import)                     */
/* ------------------------------------------------------------------ */

/**
 * Retient une source analysée. Le rapport s'affiche **avant** toute écriture.
 * `feuilles` n'est renseigné que pour un fichier : c'est ce qui permet de
 * réaffecter une feuille à une autre table sans relire le fichier.
 */
function analyserImport(source, label, { feuilles = null, format = "" } = {}) {
  try {
    const analyse = analyserSource(source);
    state.import = {
      label, format, feuilles, source, analyse,
      mode: state.import?.mode || "completer", resultat: null,
    };
    ui.toast(`${analyse.total} ligne(s) analysée(s) : vérifiez le rapport avant d'appliquer.`);
    render({ keepFocus: false });
  } catch (err) {
    const message = `Analyse impossible : ${err.message}`;
    state.import = { label, format, feuilles, erreur: message };
    render({ keepFocus: false });
    ui.toast(message, "error");
  }
}

/** Recalcule la source et son analyse après un changement d'affectation. */
function majSourceImport() {
  const imp = state.import;
  if (!imp?.feuilles) return;
  imp.source = construireSource(imp.feuilles);
  imp.analyse = analyserSource(imp.source);
}

/**
 * Lit un fichier d'import, quel que soit son format : document Grist, classeur,
 * fichier délimité ou export JSON (voir `import-fichiers.js`). La lecture d'un
 * gros document prend quelques secondes : la page annonce où elle en est.
 */
async function lireFichierImport(file) {
  const mode = state.import?.mode || "completer";
  state.import = { label: file.name, mode, enCours: "Lecture du fichier…" };
  render({ keepFocus: false });
  let dernierRendu = 0;
  try {
    const lecture = await lireFichier(file, {
      onProgres: (message) => {
        if (!state.import) return;
        state.import.enCours = message;
        const maintenant = Date.now();
        if (!message || maintenant - dernierRendu < 150) return;
        dernierRendu = maintenant;
        render({ keepFocus: false });
      },
    });
    analyserImport(construireSource(lecture.feuilles), lecture.label,
      { feuilles: lecture.feuilles, format: lecture.format });
  } catch (err) {
    const message = (err && err.message) || "Lecture du fichier impossible.";
    state.import = { label: file.name, mode, erreur: message };
    render({ keepFocus: false });
    ui.toast(message, "error");
  }
}

/**
 * Applique un fichier de composition à la section sélectionnée. Les erreurs de
 * forme sont annoncées AVANT d'écrire quoi que ce soit : corriger un fichier
 * vaut mieux que réparer une composition à moitié posée.
 */
function importerCompositionCsv(file) {
  const section = store.byId("Sections_disciplinaires", state.sel.Sections_disciplinaires);
  if (!section) { ui.toast("Choisissez d'abord une section.", "warning"); return; }
  return lireTexte(file)
    .then((texte) => {
      let analyse;
      try {
        analyse = analyserCsvMembres(texte);
      } catch (err) {
        ui.toast(`Fichier illisible : ${err.message}`, "error");
        return;
      }
      if (!analyse.lignes.length) {
        ui.toast(analyse.erreurs[0] || "Aucune ligne exploitable dans ce fichier.", "error");
        return;
      }
      const apercu = [
        `${analyse.lignes.length} ligne(s) lue(s)`,
        analyse.ignorees ? `${analyse.ignorees} ligne(s) vide(s) ignorée(s)` : "",
        analyse.erreurs.length ? `${analyse.erreurs.length} avertissement(s)` : "",
      ].filter(Boolean).join(", ");
      const details = analyse.erreurs.slice(0, 5).map((e) => `— ${e}`).join("\n");
      if (!confirm(`Compléter la composition de « ${str(section.Structure)} » avec ce fichier ?\n${apercu}.`
        + (details ? `\n\n${details}${analyse.erreurs.length > 5 ? "\n…" : ""}` : "")
        + "\n\nLes membres déjà présents seront mis à jour ; aucun membre ne sera supprimé.")) return;
      const resultat = importerMembres(store, section, analyse.lignes);
      journaliser(store, {
        action: "import", table: "Membres", id: null,
        resume: `Composition de ${str(section.Structure)} : ${resultat.creees} membre(s) créé(s), ${resultat.maj} mis à jour.`,
      });
      const total = resultat.creees + resultat.maj;
      ui.toast(total
        ? `${resultat.creees} membre(s) créé(s), ${resultat.maj} mis à jour.`
        : "Aucun changement : les membres du fichier étaient déjà à jour.", total ? "success" : "info");
      render({ keepFocus: false });
    })
    .catch((err) => ui.toast((err && err.message) || "Lecture du fichier impossible.", "error"));
}

function importerLaSource() {
  const imp = state.import;
  if (!imp || !imp.source) { ui.toast("Choisissez d'abord une source.", "warning"); return; }
  const mode = imp.mode === "remplacer" ? "remplacer" : "completer";
  if (mode === "remplacer"
    && !confirm("Remplacer toutes les données de l'outil par cette source ?\nLes données actuelles seront perdues : pensez à les exporter avant (Réglages › Données).")) return;
  try {
    const resultat = appliquerImport(store, imp.source, { mode });
    const resume = resumeImport(resultat);
    journaliser(store, {
      action: "import",
      table: null,
      resume: `Import (${mode}) : ${resume.creees} ligne(s) créée(s), ${resume.rapprochees} rapprochée(s).`,
    });
    state.import = { ...imp, resultat };
    ui.toast(mode === "remplacer"
      ? `Import terminé : ${resume.creees} ligne(s) créée(s).`
      : `Complément terminé : ${resume.creees} ligne(s) ajoutée(s), ${resume.rapprochees} déjà présente(s).`);
    render({ keepFocus: false });
  } catch (err) {
    console.error("Import :", err);
    ui.toast(`Import impossible : ${err.message}`, "error");
  }
}

function onKeydown(event) {
  if (event.key === "Escape" && state.modal) {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key === "Enter" && event.target.type === "search") event.preventDefault();

  // Onglets : un `role="tablist"` se parcourt aux flèches. La sélection suit le
  // focus — une flèche change d'onglet, `Origine` et `Fin` mènent au premier et
  // au dernier —, sans quoi le balisage annoncerait des onglets que le clavier
  // ne saurait pas parcourir.
  const onglet = event.target.closest?.('[role="tab"]');
  if (onglet && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    const liste = [...(onglet.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]') || [])];
    if (liste.length) {
      event.preventDefault();
      const rang = liste.indexOf(onglet);
      const vers = event.key === "Home" ? 0
        : event.key === "End" ? liste.length - 1
          : (rang + (event.key === "ArrowRight" ? 1 : -1) + liste.length) % liste.length;
      const cible = liste[vers];
      if (cible && cible !== onglet) {
        const id = cible.id;
        cible.click();
        // Le rendu remplace les onglets : le focus se repose sur l'onglet élu.
        requestAnimationFrame(() => document.getElementById(id)?.focus());
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

async function boot() {
  document.documentElement.lang = "fr";
  // Thème et suivi du plein écran : réglages d'affichage, indépendants des
  // données et du rôle.
  applyStoredTheme();
  watchDisplay();
  // Affichée dans un document Grist, la page reçoit le thème du document :
  // le sélecteur de l'en-tête s'efface alors, au profit de ce réglage unique.
  const embedded = likelyGrist();
  watchGristTheme({ expected: embedded, onGiveUp: () => render({ keepFocus: true }) });
  try {
    setAssetBase(new URL("./", import.meta.url).href);
  } catch { /* base par défaut */ }

  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("input", onInput);
  app.addEventListener("keydown", onKeydown);
  // L'alignement des champs d'une ligne se remesure quand la largeur change :
  // les libellés ne se replient pas de la même façon selon la place.
  suivreAlignement(app);
  // Les menus déroulants se replacent dans la fenêtre à chaque ouverture : leur
  // panneau s'ancre au bord droit de leur bouton, qui peut tomber près du bord
  // gauche quand la ligne d'actions se replie.
  suivreMenus();
  // L'en-tête qui s'efface et les commandes du compte qui descendent sur la
  // barre de navigation suivent le défilement : l'écoute est posée une fois,
  // sur la fenêtre.
  suivreEnteteDefilant();

  store.subscribe(() => planifierRendu());

  // Le magasin interroge directement le rôle courant avant chaque écriture :
  // l'interface et la couche de données ne peuvent pas diverger, et tant que
  // l'identification n'a pas abouti (user === null) le rôle est le plus
  // restrictif.
  store.readOnlyCheck = () => !canWrite(state);

  // Des modifications refusées par le document restent dans la base de travail
  // du navigateur : le rechargement suivant relit le document et les efface.
  // Quitter la page sans prévenir ferait croire que le travail est enregistré.
  // Le navigateur n'affiche son propre texte que pour un `returnValue` non vide.
  window.addEventListener("beforeunload", (event) => {
    if (!pendingWriteCount()) return undefined;
    const message = `${pendingWriteCount()} modification(s) n'ont pas pu être enregistrées dans le document Grist `
      + "et seront perdues si vous quittez cette page.";
    event.preventDefault();
    event.returnValue = message;
    return message;
  });
  window.addEventListener("pagehide", () => { demanderEnvoiImmediat(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") demanderEnvoiImmediat();
  });

  // Une liaison perdue — ou une identification restée sans réponse pendant que
  // l'onglet était en arrière-plan, par exemple après l'ouverture de la
  // messagerie depuis un lien de contact — se répare au retour sur la page.
  // Sans cela, l'outil restait en lecture seule, sans accès au document, et il
  // fallait recharger la page. Seul le mode embarqué est concerné.
  let reprise = false;
  const reprendreLiaison = async () => {
    if (reprise || !state.embedded) return;
    if (document.visibilityState && document.visibilityState !== "visible") return;
    // La liaison n'a pas abouti : le branchement est refait en entier, comme
    // le fait le bouton « Réessayer la liaison » du bandeau.
    if (state.grist === "error") {
      reprise = true;
      logDiagnostic("connexion", "reprise de la liaison", "retour sur la page");
      try { await initGrist(); } finally { reprise = false; }
      return;
    }
    // La liaison tient, mais l'identité n'a pas été prouvée : on la redemande.
    // Un document réellement fermé à l'écriture, ou un rôle déjà établi par le
    // document lui-même, ne donne pas lieu à une nouvelle demande.
    if (state.grist !== "connected" || canWrite(state) || documentReadOnly()) return;
    if (String((state.user && state.user.access) || "").trim()) return;
    reprise = true;
    try {
      const user = await resolveGristUser();
      if (user) { applyUserRole(user); render({ keepFocus: true }); }
    } catch (err) {
      console.debug("Identification non retentée :", err);
    } finally {
      reprise = false;
    }
  };
  window.addEventListener("visibilitychange", reprendreLiaison);
  window.addEventListener("focus", reprendreLiaison);

  // Les listes déroulantes d'affaires (choix d'une affaire pour un document,
  // une décision, une séance…) suivent le même périmètre que les listes : un
  // secrétaire n'y voit que les affaires qui lui sont attribuées. Posé ici,
  // une fois, plutôt que répété à chaque liste de référence.
  ui.setRowFilter((tableName, row) => tableName !== "Affaires" || affaireVisible(store, state, row));

  // Une écriture refusée par Grist ne doit jamais passer inaperçue : le bandeau
  // et une notification l'expliquent, et l'alerte disparaît d'elle-même dès
  // qu'une écriture aboutit.
  setWriteReporter((message) => {
    const nouveau = state.gristWriteError !== message;
    state.gristWriteError = message;
    if (message && nouveau) ui.toast(`Enregistrement dans Grist impossible : ${message}`, "error");
    // Le rendu est refait à chaque refus : le bandeau annonce combien de
    // modifications sont retenues, et ce nombre change à chaque refus.
    render();
    // Un refus d'écriture a presque toujours la même cause : une colonne du
    // modèle absente du document. Grist répond alors « KeyError », sans dire
    // quoi faire ; on relit donc la structure pour pouvoir proposer le geste
    // (« Compléter la structure ») plutôt que de laisser l'utilisateur seul
    // devant un message technique. Lecture seule : rien n'est créé ici.
    if (message && nouveau) relireStructure().then((change) => { if (change) render(); });
  });

  // NC-0024 : un échec d'enregistrement dans le navigateur (stockage plein) ne
  // doit pas passer inaperçu — la saisie serait perdue à la fermeture de
  // l'onglet. Le bandeau l'explique, une notification prévient tout de suite,
  // et l'échec est inscrit au Journal de la base (une fois par cause).
  setStockageReporter((message) => {
    const nouveau = state.stockageErreur !== message;
    state.stockageErreur = message;
    if (message && nouveau) {
      ui.toast("Enregistrement dans le navigateur impossible : il reste en mémoire seulement.", "error");
      journaliser(store, {
        action: "échec d'enregistrement local",
        resume: message,
      });
    }
    render();
  });

  // Tant que l'identification n'a pas abouti, l'interface reste en lecture
  // seule : le rôle par défaut est le plus restrictif.
  state.embedded = embedded;
  state.grist = embedded ? "loading" : false;
  if (!embedded) {
    // Hors Grist : rôle, nom et identité simulés mémorisés par l'onglet Debug.
    state.debugRole = ROLE_IDS.includes(prefs.debugRole) ? prefs.debugRole : null;
    state.debugName = String(prefs.debugName || "");
    state.debugEmail = String(prefs.debugEmail || "");
  }
  state.user = embedded ? null : localUser();

  // Contenus livrés (NC-0005) : une base autonome déjà à jour mémorise la
  // signature de la livraison, pour que seul un vrai changement ultérieur soit
  // signalé. Un document Grist, lui, n'est pas jugé ici : ses tables ne sont
  // pas encore lues, et c'est le chargement qui révélera s'il porte les
  // contenus livrés (voir `contenusPanel`, Réglages › Données).
  if (!embedded && planEstVide(planAlignementContenus(store.db)) && prefs.contenusSignature !== signatureContenus()) {
    prefs.contenusSignature = signatureContenus();
    savePrefs(prefs);
  }

  render({ keepFocus: false });

  if (embedded) await initGrist();

  // En recette seulement : l'état et le magasin sont exposés pour le
  // diagnostic et l'outillage de l'atelier (NC-0008). En production, ils ne
  // sont pas publiés à la page.
  if (enRecette()) {
    window.appState = state;
    window.appStore = store;
  }
  brancherPagination();

  // Confidentialité au poste (NC-0009) : activité suivie, verrouillage réglé,
  // et un rappel au premier lancement du risque propre à un poste partagé.
  for (const ev of ["pointerdown", "keydown", "touchstart", "input"]) {
    window.addEventListener(ev, marquerActivite, { passive: true });
  }
  reglerVerrouillage();
  if (!prefs.avertissementPostePartage) {
    ui.toast("Poste partagé ? Activez le mode session ou le verrouillage dans Réglages › Données, pour que les dossiers ne restent pas ouverts.", "info");
    prefs.avertissementPostePartage = true;
    savePrefs(prefs);
  }
}

/* ------------------------------------------------------------------ */
/* Verrouillage après inactivité (NC-0009, NC-0022)                    */
/* ------------------------------------------------------------------ */
/*
 * L'écran se couvre après un temps d'inactivité. Deux niveaux, selon qu'un
 * **code de reprise** a été défini (NC-0022) :
 *
 *   - avec un code : l'écran ne se rouvre qu'après saisie du code, dont seule
 *     l'empreinte SHA-256 est conservée sur le poste ; les essais sont freinés
 *     après cinq échecs, et le déverrouillage est inscrit au Journal ;
 *   - sans code : l'écran se couvre, mais un clic suffit à le rouvrir — le
 *     libellé le dit alors honnêtement, au lieu de laisser croire à une
 *     protection qui n'existe pas.
 */

let verrouTimer = null;
let derniereActivite = Date.now();
let verrouActif = false;
let verrouEchecs = 0;

/** Un code de reprise est-il défini sur ce poste ? */
function verrouCodeDefini() {
  return !!prefs.verrouCodeHash;
}

/**
 * Empreinte SHA-256 d'un code de reprise. Le code n'est jamais conservé en
 * clair : seule cette empreinte reste sur le poste, pour comparer une saisie
 * sans révéler le code.
 */
async function hacherCode(code) {
  const octets = new TextEncoder().encode(`sections-disciplinaires:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Note une interaction : repousse le verrouillage. */
function marquerActivite() { derniereActivite = Date.now(); }

/**
 * Règle le verrouillage d'écran sur le délai mémorisé. Le délai vient des
 * préférences (`verrouillageMin`, 0 = jamais) ; l'écran se couvre après ce
 * temps sans interaction, pour qu'un poste laissé ouvert ne montre pas les
 * dossiers à qui passe.
 */
function reglerVerrouillage() {
  if (verrouTimer) { clearInterval(verrouTimer); verrouTimer = null; }
  const minutes = Number(prefs.verrouillageMin) || 0;
  if (!minutes) { deverrouiller(); return; }
  derniereActivite = Date.now();
  verrouTimer = setInterval(() => {
    if (!verrouActif && Date.now() - derniereActivite >= minutes * 60000) verrouiller();
  }, 15000);
}

/** Couvre l'écran jusqu'à reprise (code saisi, ou simple clic si aucun code). */
function verrouiller() {
  if (verrouActif) return;
  verrouActif = true;
  verrouEchecs = 0;
  let ov = document.getElementById("appLock");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "appLock";
    ov.className = "app-lock";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "appLockTitle");
    document.body.appendChild(ov);
  }
  if (verrouCodeDefini()) {
    ov.innerHTML = `
      <div class="app-lock__box">
        <p class="app-kicker">Session</p>
        <h2 class="fr-h5" id="appLockTitle">Écran verrouillé</h2>
        <p class="fr-text--sm">
          Après un temps d'inactivité, l'écran se couvre. Saisissez votre code de reprise pour revenir
          aux dossiers.
        </p>
        <form id="appLockForm" novalidate>
          <div class="fr-input-group">
            <label class="fr-label" for="appLockCode">Code de reprise</label>
            <input class="fr-input" type="password" id="appLockCode" autocomplete="off">
          </div>
          <p class="fr-error-text" id="appLockErr" hidden></p>
          <button type="submit" class="fr-btn" id="appLockBtn">Reprendre la session</button>
        </form>
      </div>`;
    const champ = ov.querySelector("#appLockCode");
    const erreur = ov.querySelector("#appLockErr");
    ov.querySelector("#appLockForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (champ.disabled) return;
      const empreinte = await hacherCode(champ.value);
      if (empreinte === prefs.verrouCodeHash) {
        journaliser(store, { action: "deverrouillage", resume: "Code de reprise accepté." });
        deverrouiller();
        return;
      }
      verrouEchecs += 1;
      erreur.hidden = false;
      erreur.textContent = "Code incorrect.";
      champ.value = "";
      champ.focus();
      if (verrouEchecs >= 5) {
        // Frein aux essais répétés : la saisie est suspendue un court moment.
        const bouton = ov.querySelector("#appLockBtn");
        champ.disabled = true;
        bouton.disabled = true;
        let reste = 30;
        const decompte = setInterval(() => {
          reste -= 1;
          if (reste <= 0) {
            clearInterval(decompte);
            champ.disabled = false;
            bouton.disabled = false;
            erreur.textContent = "Code incorrect.";
            champ.focus();
          } else {
            erreur.textContent = `Trop d'essais : réessayez dans ${reste} s.`;
          }
        }, 1000);
      }
    });
    ov.hidden = false;
    champ.focus();
    return;
  }
  // Aucun code : la couche protège des regards, elle ne bloque pas l'accès —
  // et le libellé le dit.
  ov.innerHTML = `
    <div class="app-lock__box">
      <p class="app-kicker">Session</p>
      <h2 class="fr-h5" id="appLockTitle">Écran couvert</h2>
      <p class="fr-text--sm">
        Après un temps d'inactivité, l'écran se couvre pour ne pas laisser les dossiers disciplinaires
        exposés à qui passe. <strong>Aucun code de reprise n'est défini</strong> : cette couche protège
        des regards, mais n'empêche pas l'accès. Définissez un code dans
        Réglages › Données › Confidentialité du poste.
      </p>
      <button type="button" class="fr-btn" id="appLockBtn">Reprendre la session</button>
    </div>`;
  ov.querySelector("#appLockBtn").addEventListener("click", deverrouiller);
  ov.hidden = false;
  ov.querySelector("#appLockBtn").focus();
}

/** Rend l'écran à l'utilisateur. */
function deverrouiller() {
  verrouActif = false;
  verrouEchecs = 0;
  const ov = document.getElementById("appLock");
  if (ov) ov.hidden = true;
  derniereActivite = Date.now();
}

/**
 * Nombre de pages d'un aperçu de document.
 *
 * L'aperçu est rendu dans un cadre : c'est lui qui sait combien de pages il a,
 * et il l'annonce par `postMessage` (voir `paginer`, dans pages.js). La page qui
 * l'accueille ne peut pas le mesurer elle-même — et un aperçu d'une autre
 * provenance est ignoré : seul le cadre du document qui est à l'écran compte.
 */
function brancherPagination() {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "perchance-doc-pages") return;
    const cadre = document.getElementById("docPreview");
    if (!cadre || event.source !== cadre.contentWindow) return;
    const cible = document.getElementById("docPages");
    if (!cible) return;
    if (data.pages > 0) {
      cible.textContent = data.pages > 1 ? ` — ${data.pages} pages` : " — 1 page";
      cible.hidden = false;
    } else {
      cible.hidden = true;
    }
  });
}

/**
 * Identité de la personne, sans jamais retenir l'affichage.
 *
 * L'identification interroge Grist à son tour (jeton d'accès, table technique
 * des utilisateurs). Sur un document qui ne répond plus, ces appels restent en
 * attente : l'outil ne quitterait alors jamais son écran d'attente, alors même
 * que la liaison a déjà échoué. Passé le délai, l'affichage se poursuit avec
 * le rôle le plus restrictif ; si l'identification aboutit plus tard, le rôle
 * réel est appliqué et l'écran redessiné.
 */
async function identifyUser() {
  const resolution = resolveGristUser().catch(() => null);
  const LATE = Symbol("identification tardive");
  const arrived = await Promise.race([
    resolution,
    new Promise((resolve) => { setTimeout(() => resolve(LATE), IDENTITY_DEADLINE_MS); }),
  ]);
  if (arrived !== LATE) return arrived;
  resolution.then((user) => {
    applyUserRole(user);
    render();
  });
  return null;
}

/**
 * Branchement sur le document Grist, puis identification de l'utilisateur.
 * Le rôle (administrateur, secrétaire ou visiteur) provient des droits de la
 * personne dans le document ; il commande l'accès aux réglages et à l'écriture.
 */
async function initGrist() {
  logDiagnostic("connexion", "tentative de liaison",
    `référent : ${(typeof document !== "undefined" && document.referrer) || "(aucun)"}`);
  const api = await loadGristApi();
  if (!api) {
    // L'API du widget n'a pas pu être chargée : l'outil continue sur la base
    // locale, mais cela ne doit pas passer inaperçu — l'utilisateur croirait
    // ses saisies enregistrées dans le document alors qu'elles restent dans
    // son navigateur.
    console.error("API du widget Grist introuvable :", gristApiUrl);
    logDiagnostic("connexion", "API du widget introuvable", gristApiUrl);
    // Aucun thème ne sera annoncé : le sélecteur de l'en-tête reprend sa place.
    abandonGristTheme();
    state.grist = "error";
    state.gristErrorCode = "NO_API";
    state.gristError = `L'API du widget Grist n'a pas pu être chargée (adresse essayée : ${gristApiUrl}). `;
    state.user = localUser();
    render({ keepFocus: false });
    return;
  }

  try {
    const connexion = await connectGrist(store);
    state.gristMissingColumns = connexion?.missingColumns || [];
    state.grist = "connected";
    // Un document Grist est un déploiement réel : la déclaration de recette de
    // la vitrine ne s'y applique pas (NC-0008, `environnement.js`). La bascule
    // est posée ici, au seul moment où la liaison est prouvée.
    declarerDocumentGrist();
    document.documentElement.classList.add("app-embedded");
    // Un document constitué avant l'adoption du préfixe a vu ses tables
    // renommées à l'instant : sans un mot, son propriétaire chercherait où
    // elles sont passées.
    if (connexion?.renommees?.length) {
      ui.toast(`${connexion.renommees.length} table(s) du document masquée(s) dans Grist : `
        + "elles ne s'affichent plus que dans l'outil.");
    }
    // La liaison répond : le thème du document, s'il est annoncé, suit de peu.
    gristLiaisonEstablished();
    // Écritures restées en attente d'une session précédente (page rechargée
    // avant l'envoi) : celles que le document n'a pas modifiées entre-temps
    // sont réappliquées à l'écran et renvoyées ; les autres sont écartées et
    // annoncées par le bandeau, jamais écrasées en silence.
    state.outbox = null;
    try {
      const reprise = reprendreOutbox(store);
      if (reprise.rejouables || reprise.conflits.length) {
        state.outbox = { rejouables: reprise.rejouables, conflits: reprise.conflits };
        demanderEnvoiImmediat();
      }
    } catch (err) {
      logDiagnostic("écriture", "reprise après rechargement impossible", (err && err.message) || err);
    }
  } catch (err) {
    console.error("Connexion Grist impossible :", err);
    logDiagnostic("connexion", "échec de la liaison", (err && err.message) || err);
    abandonGristTheme();
    state.grist = "error";
    state.gristError = err.message;
    state.gristErrorCode = err.code || "";
    // L'interface reprend immédiatement, avec le bandeau qui explique la
    // panne : attendre l'identification pour dessiner laisserait l'écran
    // d'attente en place, alors que le document a déjà renoncé à répondre.
    render({ keepFocus: false });
  }

  // L'identification interroge Grist (jeton d'accès, table des utilisateurs) :
  // elle n'a de sens que si le document a répondu. Sans réponse — liaison
  // expirée, API introuvable — l'outil fonctionne sur la base locale, dont la
  // personne qui l'utilise est propriétaire. Un document qui répond mais
  // auquel il manque les tables garde, lui, son identité Grist : c'est elle
  // qui décidera des droits une fois la structure installée.
  const documentMuet = state.grist === "error" && state.gristErrorCode !== "MISSING_TABLES";
  const user = documentMuet ? localUser() : await identifyUser();
  applyUserRole(user);

  // Document vierge de toute trame : les modèles livrés par défaut y sont
  // proposés d'emblée, comme à la première installation. L'appel vient **après**
  // l'identification : le magasin refuse toute écriture tant que le rôle n'est
  // pas connu (`state.user === null` au branchement), et la fonction sortait
  // alors sans rien faire — le document restait sans trame, en silence.
  if (state.grist === "connected" && installerTramesParDefautSiVierge()) {
    ui.toast("Trames par défaut installées : elles sont proposées pour chaque procédure.");
  }

  // Une page « Réglages » mémorisée par un administrateur ne doit pas
  // s'ouvrir pour quelqu'un qui n'y a pas accès — pas plus que la vue de
  // répartition des affaires, réservée au même rôle.
  if (!canSettings(state) && (state.page === "reglages" || state.page === "attribution")) {
    navTo("tableau-de-bord");
    return;
  }
  // L'onglet Debug est propre au mode autonome.
  if (!debugAllowed(state) && state.page === "debug") {
    navTo("tableau-de-bord");
    return;
  }
  render({ keepFocus: false });
}

/**
 * Applique le rôle de l'utilisateur : identité affichée, droit d'écriture
 * vers le document, et inscription parmi les secrétaires le cas échéant.
 */
function applyUserRole(user) {
  state.user = user || unknownGristUser();
  syncGristWrites();
  syncSecretaire(state.user);
}

/**
 * Un propriétaire ou un éditeur du document figure parmi les secrétaires :
 * sa fiche est créée à sa première connexion (reconnue par son courriel),
 * pour qu'il puisse suivre les affaires et signer les courriers.
 *
 * Une fiche créée par une version antérieure de l'outil porte l'identifiant
 * Grist tel quel — « arno.pillods » — puisqu'on ne savait pas encore en tirer
 * un prénom et un nom. Comme ce nom figure sur les courriers, il est remis en
 * forme au passage : la réparation ne touche que la fiche dont le nom est
 * *exactement* cet identifiant, et elle est annoncée.
 */
function syncSecretaire(user) {
  if (!user || !can(user.role, "write") || store.mode !== "grist") return;
  const email = String(user.email || "").trim();
  if (!email) return;
  const existing = store.table("Secretaires")
    .find((s) => String(s.Email || "").trim().toLowerCase() === email.toLowerCase());
  if (existing) {
    const patch = {};
    if (!existing.Actif_) patch.Actif_ = true;
    const brut = String(user.name || "").trim();
    if (brut && String(existing.Nom || "").trim() === brut) {
      const { prenom, nom } = splitName(brut);
      if (nom && (nom !== brut || prenom !== String(existing.Prenom || "").trim())) {
        patch.Prenom = prenom;
        patch.Nom = nom;
      }
    }
    if (!Object.keys(patch).length) return;
    store.updateRow("Secretaires", existing.id, patch);
    if (patch.Nom) ui.toast(`Fiche secrétaire mise en forme pour ${userName(user)}.`);
    return;
  }
  const { prenom, nom } = splitName(user.name);
  store.addRow("Secretaires", { Prenom: prenom, Nom: nom || email, Email: email, Actif_: true });
  ui.toast(`Fiche secrétaire créée pour ${userName(user)}.`);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
/**
 * Relit la structure du document après un refus d'écriture, afin d'expliquer
 * la panne au lieu de laisser un message de Grist sans suite. Lecture seule :
 * rien n'est créé ici. Renvoie `true` si la liste des manques a changé.
 */
async function relireStructure() {
  if (state.grist !== "connected") return false;
  try {
    const check = await checkStructure();
    const manques = (check && check.missingColumns) || [];
    if (manques.join("|") === state.gristMissingColumns.join("|")) return false;
    state.gristMissingColumns = manques;
    return true;
  } catch (err) {
    console.warn("Vérification de la structure impossible :", err);
    return false;
  }
}

/**
 * Installe les trames et types de trames livrés par défaut qui manquent à la
 * base, et renvoie le nombre de trames ajoutées. Le type de chaque trame est
 * re-résolu par son **nom** : les identifiants du catalogue livré ne sont pas
 * ceux du document (Grist attribue les siens).
 */
function installerTramesParDefaut() {
  if (store.isReadOnly()) return 0;
  const types = typesTramesParDefautManquants(store.db);
  const trames = tramesParDefautManquantes(store.db);
  if (!types.length && !trames.length) return 0;
  for (const t of types) {
    const { id, ...reste } = t;
    // Le format livré des ordonnances du président de la formation de jugement
    // est ajouté avec sa feuille livrée. Sur une base antérieure au partage des
    // actes du président, la feuille du format « Décision du président » —
    // devenue celle du président de la **section** — avait été adaptée par
    // l'établissement pour **les deux** présidents : la reprise la lui rend,
    // plutôt que de lui imposer la feuille livrée.
    if (String(t.Nom) === FORMAT_ORDONNANCE_PRESIDENT_FORMATION) {
      const section = store.table("Types_Trames").find((x) => String(x.Nom) === FORMAT_ORDONNANCE_PRESIDENT_SECTION);
      const feuille = String(section?.Feuille_de_style || "");
      if (feuille && feuille !== String(t.Feuille_de_style || "")) reste.Feuille_de_style = feuille;
    }
    store.addRow("Types_Trames", reste);
  }
  const nomParId = new Map(TYPES_TRAMES_PAR_DEFAUT.map((t) => [t.id, t.Nom]));
  const idParNom = new Map(store.table("Types_Trames").map((t) => [String(t.Nom), t.id]));
  for (const t of trames) {
    const { id, ...reste } = t;
    reste.Type = idParNom.get(String(nomParId.get(t.Type))) || 0;
    store.addRow("Trames", reste);
  }
  // Le format livré du président de la formation de jugement, ajouté à
  // l'instant, attend ses trames : celles que le partage de la décision du
  // président lui destine le rejoignent — à travers le magasin, pour que le
  // déplacement soit écrit dans le document Grist (voir `migrerFeuilles`, qui
  // fait le même déplacement en mémoire au chargement d'une base).
  for (const d of deplacementsTramesPresident(store.db)) {
    store.updateRow("Trames", d.trame.id, { Type: d.type });
  }
  return trames.length;
}

/**
 * Première installation d'un document : les trames livrées par défaut sont
 * proposées systématiquement. Elles ne sont posées que si le document n'a
 * encore **aucune** trame, pour ne jamais écraser les modèles de
 * l'établissement.
 */
function installerTramesParDefautSiVierge() {
  if (store.table("Trames").length || store.table("Types_Trames").length) return 0;
  return installerTramesParDefaut();
}

/**
 * Installe les tables et colonnes manquantes dans le document Grist, puis
 * rétablit la liaison. Deux appelants : le bandeau de connexion (document
 * jamais installé) et les réglages — la table de l'identité de l'en-tête est
 * facultative, donc absente des documents créés avant son apparition.
 */
async function installStructureAndReconnect(message) {
  try {
    await installStructure();
    const connexion = await connectGrist(store);
    state.grist = "connected";
    // La structure vient d'être installée : la liaison est établie, donc le
    // document est bien réel — l'outil passe en production (NC-0008).
    declarerDocumentGrist();
    state.gristError = "";
    state.gristErrorCode = "";
    state.gristMissingColumns = connexion?.missingColumns || [];
    state.structure = null;
    document.documentElement.classList.add("app-embedded");
    applyUserRole(await resolveGristUser());
    // Document fraîchement doté de sa structure : les trames livrées par
    // défaut y sont posées, comme sur une base de démonstration neuve.
    const posees = installerTramesParDefautSiVierge();
    ui.toast(posees
      ? `${message} ${posees} trame(s) par défaut installée(s).`
      : message);
    render({ keepFocus: false });
    return true;
  } catch (err) {
    console.error("Installation de la structure impossible :", err);
    state.gristError = err.message;
    state.gristErrorCode = err.code || "";
    ui.toast(`Installation impossible : ${err.message}`, "error");
    render({ keepFocus: false });
    return false;
  }
}
