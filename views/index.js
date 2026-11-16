// Aiguillage des pages.

import { Context } from "../formulas.js";
import { canSettings } from "../roles.js";
import { viewDashboard } from "./dashboard.js";
import { viewRapport } from "./rapport.js";
import { viewAffaires } from "./affaires.js";
import { viewAttribution, viewAttributionInterdit } from "./attribution.js";
import { viewSeances } from "./seances.js";
import { viewCalendrier } from "./calendrier.js";
import { viewDecisions } from "./decisions.js";
import { viewDecisionRedaction } from "./decision-redaction.js";
import { viewDocument, viewDocuments } from "./documents.js";
import { viewReglages, viewReglagesInterdit } from "./reglages.js";
import { viewAide } from "./aide.js";
import { viewAccessibilite } from "../accessibilite.js";
import { debugAllowed, viewDebug } from "./debug.js";

export function renderPage(store, state) {
  state.ctx = new Context(store.db, store);
  switch (state.page) {
    case "affaires": return viewAffaires(store, state);
    // Le tableau de bord a deux lectures : la synthèse de l'activité, et le
    // rapport d'activité, qui se lit par période (voir rapport.js).
    case "tableau-de-bord": return state.sub === "rapport" ? viewRapport(store, state) : viewDashboard(store, state);
    // Vue de répartition, réservée aux propriétaires : un signet d'un autre
    // rôle est refusé en le disant, plutôt que d'ouvrir une page sans objet.
    case "attribution": return canSettings(state) ? viewAttribution(store, state) : viewAttributionInterdit(store, state);
    // Le calendrier a deux vues : les échéances (la grille du mois) et les
    // séances, qui en sont une (voir `NAV`, schema.js). L'ancien onglet
    // « Séances » mène à la seconde (voir `corrigerRoute`, app.js).
    case "calendrier": return state.sub === "seances" ? viewSeances(store, state) : viewCalendrier(store, state);
    case "decisions": {
      // Comme pour les documents, le sous-chemin de l'adresse désigne une fiche :
      // la décision ouverte fait donc de lui la sélection courante, et l'atelier
      // de rédaction s'ouvre à sa place dans la page.
      const decision = state.sub ? store.byId("Decisions", Number(state.sub)) : null;
      if (decision) state.sel.Decisions = decision.id;
      return decision ? viewDecisionRedaction(store, state, decision) : viewDecisions(store, state);
    }
    // L'onglet « Documents » a une sous-vue : celle d'un document. Son
    // sous-chemin d'adresse porte l'identifiant du document (`#documents/12`)
    // plutôt que le nom d'une vue — voir `documentSubId` dans app.js. C'est
    // ainsi qu'un document cité dans une autre vue s'ouvre directement là où
    // il se rédige.
    case "documents": {
      const doc = state.sub ? store.byId("Generateur", Number(state.sub)) : null;
      // La sous-vue d'un document fait de lui la sélection courante : les
      // commandes de l'espace de rédaction (exporter, figer les valeurs,
      // revenir à la trame) s'adressent au document sélectionné.
      if (doc) state.sel.Generateur = doc.id;
      return doc ? viewDocument(store, state, doc) : viewDocuments(store, state);
    }
    case "reglages": return canSettings(state) ? viewReglages(store, state) : viewReglagesInterdit(store, state);
    case "aide": return viewAide(store, state);
    case "accessibilite": return viewAccessibilite(store, state);
    // L'onglet Debug n'existe qu'en mode autonome ; en mode embarqué, l'adresse
    // mémorisée retombe sur le tableau de bord.
    case "debug": return debugAllowed(state) ? viewDebug(store, state) : viewDashboard(store, state);
    default: return viewDashboard(store, state);
  }
}
