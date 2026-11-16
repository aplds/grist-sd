// Le dossier dématérialisé d'une affaire.
//
// Les pièces d'un dossier disciplinaire ne vivent pas dans l'outil : elles sont
// tenues **hors de lui** — bureau numérique, espace de partage, fichiers.gouv.fr
// —, et l'outil n'en conserve que l'adresse (`Affaires.Lien_vers_le_dossier`).
// Or cette adresse se renseignait une fois, dans un formulaire qu'on ne rouvrait
// pas : l'affaire s'instruisait alors que personne ne savait plus où étaient ses
// pièces, et le lien restait vide sans que rien ne le rappelle.
//
// Ce module rassemble la **déclaration du dossier** : dire si l'adresse est
// déclarée, la compléter, la valider, et la présenter partout où elle sert — la
// fiche de l'affaire, le rôle de la séance, les documents. Les vues y trouvent
// le contrôle d'accès au dossier (`boutonDossier`, `rappelDossier`) ;
// `controlesRegularite` (regimes.js) y trouve de quoi rappeler son absence, et
// `app.js` la fenêtre de déclaration.

import { esc, icon, lienExterne, urlSure } from "./ui.js";

/** La colonne de l'affaire qui porte l'adresse du dossier de pièces. */
export const CHAMP_DOSSIER = "Lien_vers_le_dossier";

/**
 * L'adresse du dossier, **complétée** si elle a été saisie sans schéma
 * (« fichiers.gouv.fr/dossier/12 »), puis validée. Renvoie "" si la valeur
 * n'est pas une adresse web : un mot seul n'en est pas une.
 */
export function urlDossier(valeur) {
  const brut = String(valeur ?? "").trim();
  if (!brut) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(brut)) return urlSure(brut);
  // Sans schéma : on n'ajoute `https://` qu'à ce qui ressemble à un nom d'hôte —
  // un domaine, puis un chemin, une requête ou une ancre éventuels.
  if (!/^[^\s/]+\.[a-z]{2,}(?:[/?#]|$)/i.test(brut)) return "";
  return urlSure(`https://${brut}`);
}

/** L'adresse déclarée d'une affaire, ou "". */
export function lienDossier(affaire) {
  return urlDossier(affaire?.[CHAMP_DOSSIER]);
}

/** L'affaire a-t-elle un dossier déclaré ? */
export function dossierDeclare(affaire) {
  return !!lienDossier(affaire);
}

/** L'hôte d'une adresse de dossier, pour l'étiquette (« fichiers.gouv.fr »). */
export function hoteDossier(valeur) {
  const href = urlDossier(valeur);
  if (!href) return "";
  try { return new URL(href).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/**
 * Le contrôle d'accès au dossier : un lien « Ouvrir le dossier » quand
 * l'adresse est déclarée — il s'ouvre dans un onglet à part, pour ne pas
 * décharger la page du widget —, un bouton « Déclarer le dossier » sinon.
 *
 * `modifier` ajoute, une fois le dossier déclaré, le bouton qui rouvre la
 * fenêtre de déclaration pour corriger l'adresse.
 */
export function boutonDossier(affaire, {
  size = "sm", variant = "secondary", libelle = "Ouvrir le dossier", modifier = false, attrs = "",
} = {}) {
  const classes = `fr-btn fr-btn--${variant}${size ? ` fr-btn--${size}` : ""}`;
  const suffixe = attrs ? ` ${attrs}` : "";
  const enregistrement = `data-record="${esc(String(affaire?.id ?? ""))}"`;
  const href = lienDossier(affaire);
  if (!href) {
    return `<button type="button" class="${classes} app-dossier__declarer" data-action="dossier-declarer" ${enregistrement}`
      + ` title="Déclarer l'adresse du dossier de pièces"${suffixe}>`
      + `${icon("file-add-line", 'class="fr-mr-1v"')}Déclarer le dossier</button>`;
  }
  const ouvrir = `<a class="${classes} app-dossier__ouvrir" href="${esc(href)}" target="_blank" rel="noopener noreferrer"`
    + ` title="Ouvrir le dossier dans un nouvel onglet — ${esc(href)}"${suffixe}>`
    + `${icon("external-link-line", 'class="fr-mr-1v"')}${esc(libelle)}</a>`;
  if (!modifier) return ouvrir;
  return `${ouvrir}<button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm app-dossier__modifier"`
    + ` data-action="dossier-declarer" ${enregistrement} title="Modifier l'adresse du dossier">`
    + `${icon("pencil-line", 'class="fr-mr-1v"')}<span class="fr-sr-only">Modifier l'adresse du dossier</span></button>`;
}

/**
 * Le rappel du dossier, en tête d'une affaire : l'adresse déclarée — cliquable
 * —, ou l'invitation à la déclarer. Jamais muet : c'est ce rappel qui fait
 * qu'on y pense, sur tous les onglets de l'affaire.
 */
export function rappelDossier(affaire, { modifier = true, libelle = "Dossier de pièces" } = {}) {
  if (!lienDossier(affaire)) {
    return `<div class="app-dossier app-dossier--manquant">
    <span class="app-dossier__etat">${icon("alert-line", 'class="fr-mr-1v"')}Dossier de pièces non déclaré</span>
    <span class="app-dossier__aide">Les pièces sont tenues hors de l'outil : déclarez l'adresse pour les retrouver d'un clic, ici et depuis le rôle de la séance.</span>
    ${boutonDossier(affaire, { variant: "primary" })}
  </div>`;
  }
  return `<div class="app-dossier app-dossier--declare">
    <span class="app-dossier__etat">${icon("folder-2-line", 'class="fr-mr-1v"')}${esc(libelle)} : ${lienExterne(lienDossier(affaire))}</span>
    ${boutonDossier(affaire, { modifier })}
  </div>`;
}
