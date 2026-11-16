// Environnement d'exécution — NC-0008.
//
// Le même code sert la vitrine, la recette et la production : sans
// environnement déclaré, on ne sait pas de quel système on parle, et les outils
// de fabrication (simulation d'identité et de rôle, purge du stockage, export du
// générateur) restent à la portée d'une base réelle.
//
// L'environnement est donc **déclaré au chargement**, jamais déduit du cadre
// dans lequel la page est affichée :
//
//   · `window.ENVIRONNEMENT = "recette"` (ou `"production"`) posé dans
//     `index.html` — c'est la variable de déploiement ;
//   · à défaut, la page est en **production** : le défaut sûr.
//
// **Un document Grist fait exception, et dans le seul sens qui protège.** La
// même copie du générateur sert la vitrine — qui se déclare « recette » — et le
// widget d'un document réel. Un document Grist n'est pas un cadre d'affichage :
// c'est le système de l'établissement, avec ses données réelles. Dès que la
// liaison aboutit, `app.js` appelle `declarerDocumentGrist()` : l'outil passe
// alors en **production**, quelle que soit la déclaration de la page — la
// recette de la vitrine ne s'applique qu'hors document Grist, et la bascule ne
// va jamais dans l'autre sens.
//
// Un déploiement réel pour un établissement pose `"production"` (ou retire la
// déclaration) ; la vitrine et l'atelier se déclarent `"recette"`, et l'outil
// l'affiche alors visiblement.

export const ENV_PRODUCTION = "production";
export const ENV_RECETTE = "recette";

const ALIAS_RECETTE = new Set(["recette", "demonstration", "demo", "test", "atelier", "dev", "developpement"]);

/** La page est-elle branchée à un document Grist ? (posé par `app.js`.) */
let documentGrist = false;

/**
 * Déclare que la page est le widget d'un document Grist.
 *
 * Un document Grist est un déploiement réel : la déclaration de recette de la
 * vitrine ne s'y applique pas, et l'outil passe en production — bandeau de
 * recette retiré, onglet Debug, simulation de rôle, purge du stockage et jeu
 * d'exemple refermés. La bascule est **définitive** pour la durée de la page :
 * rien ne ramène un document réel en recette.
 */
export function declarerDocumentGrist() {
  documentGrist = true;
}

/** Rétablit l'état initial — réservé au harnais de tests. */
export function oublierDocumentGrist() {
  documentGrist = false;
}

/** L'environnement déclaré, ou « production » à défaut. */
export function environnement() {
  if (typeof window === "undefined") return ENV_PRODUCTION;
  // Un document Grist est toujours en production (voir l'en-tête du module).
  if (documentGrist) return ENV_PRODUCTION;
  const declare = String(window.ENVIRONNEMENT || window.APP_ENV || "").trim().toLowerCase();
  if (declare) return ALIAS_RECETTE.has(declare) ? ENV_RECETTE : (declare === ENV_PRODUCTION ? ENV_PRODUCTION : declare);
  return ENV_PRODUCTION;
}

/** La page tourne-t-elle dans l'environnement de recette (vitrine, atelier) ? */
export function enRecette() {
  return environnement() !== ENV_PRODUCTION;
}

/** Libellé affiché de l'environnement. */
export function libelleEnvironnement() {
  return enRecette() ? "Recette" : "Production";
}

/**
 * Bandeau d'avertissement de la recette, s'il y a lieu : la recette est
 * **visible**, pour qu'on ne saisisse pas une donnée réelle dans un
 * environnement de démonstration — ni l'inverse. Un document Grist étant en
 * production, le bandeau ne s'y affiche jamais.
 */
export function bandeauEnvironnement() {
  if (!enRecette()) return "";
  return `<div class="fr-notice fr-notice--info app-env-banner" role="status">
  <div class="fr-container">
    <div class="fr-notice__body">
      <p>
        <span class="fr-notice__title">Environnement de recette</span>
        <span class="fr-notice__desc">Données de démonstration. Ne saisissez pas ici de données réelles : cet environnement n'est pas la production.</span>
      </p>
    </div>
  </div>
</div>`;
}
