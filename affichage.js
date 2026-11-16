// Affichage de la coquille : thème clair/sombre et passage en plein écran.
//
// Le thème reprend le mécanisme du DSFR plutôt qu'un système parallèle :
// attributs `data-fr-scheme` et `data-fr-theme` sur <html>, choix mémorisé
// dans la clé « scheme » du stockage local. Le DSFR n'installe son
// gestionnaire de thème que si ces attributs sont déjà posés, et il ne lit la
// clé qu'à ce moment-là : ils sont donc écrits par le script en ligne des deux
// pages d'entrée (`index.html` pour le générateur, `src/index.html` pour le
// site autonome) et, par précaution, par `applyStoredTheme()` au démarrage.
//
// Dans un document Grist, le thème n'appartient plus à l'outil : Grist annonce
// aux widgets celui du document (voir « Thème du document Grist » plus bas),
// et le sélecteur de l'en-tête disparaît — un réglage local qui irait contre
// celui du document ne serait qu'un doublon trompeur.

import { iconButton } from "./ui.js";

const SCHEME_KEY = "scheme";
export const DARK = "dark";
export const LIGHT = "light";
export const SYSTEM = "system";

/**
 * Délai de sécurité, sans aucune nouvelle de Grist, après lequel le sélecteur
 * de thème reprend ses droits. Court délai, après une liaison aboutie, le
 * temps que l'annonce du thème — qui suit la réponse de Grist — arrive.
 */
const GRIST_THEME_DEADLINE_MS = 10000;
const GRIST_THEME_GRACE_MS = 1500;

/** Apparence annoncée par le document Grist (« light » / « dark »), sinon « ». */
let gristAppearance = "";
/** Le thème de Grist est-il encore attendu (l'annonce n'est pas arrivée) ? */
let gristWaiting = false;
let gristTimer = null;
/** Re-rendu à demander si Grist ne se manifeste pas, fourni par l'application. */
let gristGiveUp = null;

const ICONS = {
  toDark: "moon-line",
  toLight: "sun-line",
  fullscreenOn: "fullscreen-line",
  fullscreenOff: "contract-up-down-line",
};

const TITLES = {
  toDark: "Passer au thème sombre",
  toLight: "Revenir au thème clair",
  fullscreenOn: "Passer en plein écran",
  fullscreenOff: "Quitter le plein écran",
};

/* ------------------------------------------------------------------ */
/* Thème                                                               */
/* ------------------------------------------------------------------ */

function readStored() {
  try { return localStorage.getItem(SCHEME_KEY) || ""; } catch { return ""; }
}

function store(value) {
  try { localStorage.setItem(SCHEME_KEY, value); } catch { /* stockage indisponible */ }
}

function explicitTheme() {
  const stored = readStored();
  return stored === DARK || stored === LIGHT ? stored : "";
}

/** Le système demande-t-il le thème sombre (quand aucun choix n'a été fait) ? */
export function systemPrefersDark() {
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** Thème réellement affiché : le choix mémorisé, sinon celui du système. */
export function currentTheme() {
  return explicitTheme() || (systemPrefersDark() ? DARK : LIGHT);
}

/** Applique un thème et le mémorise (le DSFR relira la même clé). */
export function applyTheme(theme) {
  const value = theme === DARK ? DARK : LIGHT;
  const root = document.documentElement;
  root.setAttribute("data-fr-scheme", value);
  root.setAttribute("data-fr-theme", value);
  root.style.colorScheme = value;
  store(value);
  return value;
}

export function toggleTheme() {
  const next = applyTheme(currentTheme() === DARK ? LIGHT : DARK);
  syncThemeButton();
  return next;
}

/**
 * Pose le thème au démarrage. Le DSFR n'installe son gestionnaire de thème
 * que si `data-fr-scheme` (ou `data-fr-theme`) est déjà présent sur <html> :
 * sans attribut, le thème sombre n'existe pas, l'outil ignore le réglage du
 * système et le bouton mentirait sur le thème affiché. On pose donc toujours
 * l'attribut — le choix mémorisé, sinon « system », comme le fait le modèle
 * officiel du DSFR. Le script en ligne de `index.html` fait le même travail
 * avant le premier rendu (pour éviter tout clignotement) ; on le refait ici
 * pour que l'application reste juste même s'il n'a pas pu s'exécuter.
 */
export function applyStoredTheme() {
  const stored = explicitTheme();
  if (stored) return applyTheme(stored);
  const root = document.documentElement;
  if (!root.hasAttribute("data-fr-scheme") && !root.hasAttribute("data-fr-theme")) {
    const theme = systemPrefersDark() ? DARK : LIGHT;
    root.setAttribute("data-fr-scheme", SYSTEM);
    root.setAttribute("data-fr-theme", theme);
    root.style.colorScheme = theme;
  }
  return currentTheme();
}

/* ------------------------------------------------------------------ */
/* Thème du document Grist                                             */
/* ------------------------------------------------------------------ */

/**
 * Le thème suit-il le document Grist ?
 *
 * Grist annonce le thème du document aux widgets qui se manifestent : le
 * message d'accueil du widget porte `theme.appearance`, et l'API officielle le
 * recopie sur <html> (`data-grist-appearance`). L'outil s'aligne alors dessus,
 * y compris en mode « suivre le système » du document — et n'a plus besoin de
 * son propre sélecteur.
 *
 * Les deux signaux sont écoutés : le message brut fonctionne même si l'API
 * installée est ancienne, et l'attribut couvre le cas où l'annonce précéderait
 * nos écouteurs. Dès qu'un thème arrive, il devient celui de l'outil et le
 * sélecteur s'efface ; s'il n'en arrive aucun, le sélecteur reste en place.
 *
 * `expected` (page affichée dans un document Grist) fait patienter le
 * sélecteur : l'annonce suit de peu l'établissement de la liaison. Si Grist ne
 * dit rien — version ancienne, API d'un autre cru — le sélecteur revient de
 * lui-même, au plus tard après le délai de sécurité, et `onGiveUp` permet à
 * l'application de redessiner l'en-tête.
 */
export function watchGristTheme({ expected = false, onGiveUp = null } = {}) {
  if (typeof window === "undefined") return;

  window.addEventListener("message", (event) => {
    // Seul le cadre parent — le document Grist qui héberge l'outil — annonce le
    // thème : un message venu d'ailleurs est ignoré (NC-0011).
    if (event.source !== window.parent) return;
    const appearance = announcedInMessage(event);
    if (appearance) applyGristTheme(appearance);
  });

  const root = document.documentElement;
  if (typeof MutationObserver === "function") {
    // L'attribut posé par l'API annonce le thème ; un thème du DSFR qui
    // s'écarterait de celui du document (réglage du système, par exemple) est
    // ramené aussitôt : tant que Grist décide, c'est lui qui a raison.
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName === "data-grist-appearance") {
          const announced = announcedByAttribute();
          if (announced) applyGristTheme(announced);
        } else if (gristAppearance && root.getAttribute("data-fr-theme") !== gristAppearance) {
          applyGristTheme(gristAppearance);
        }
      }
    }).observe(root, { attributes: true, attributeFilter: ["data-grist-appearance", "data-fr-theme"] });
  }

  const already = announcedByAttribute();
  if (already) { applyGristTheme(already); return; }
  if (!expected) return;

  gristWaiting = true;
  gristGiveUp = onGiveUp;
  gristTimer = setTimeout(finishGristWait, GRIST_THEME_DEADLINE_MS);
}

/** L'apparence annoncée par Grist, si elle est connue (« » sinon). */
export function gristTheme() {
  return gristAppearance;
}

/** La liaison est établie : le thème du document, s'il existe, ne va pas tarder. */
export function gristLiaisonEstablished() {
  if (!gristWaiting || gristAppearance) return;
  if (gristTimer) clearTimeout(gristTimer);
  gristTimer = setTimeout(finishGristWait, GRIST_THEME_GRACE_MS);
}

/**
 * Grist ne pilotera pas le thème (API introuvable, liaison refusée) : le
 * sélecteur reprend ses droits. L'appelant est responsable du rendu.
 */
export function abandonGristTheme() {
  clearGristWait();
}

function clearGristWait() {
  if (gristTimer) { clearTimeout(gristTimer); gristTimer = null; }
  gristWaiting = false;
}

function finishGristWait() {
  gristTimer = null;
  if (gristAppearance) return;
  clearGristWait();
  const redraw = gristGiveUp;
  gristGiveUp = null;
  if (redraw) redraw();
}

/** Apparence annoncée dans un message du widget (`{ theme: { appearance } }`). */
function announcedInMessage(event) {
  const value = event?.data?.theme?.appearance;
  return value === DARK || value === LIGHT ? value : "";
}

/** Apparence recopiée sur <html> par l'API officielle du widget. */
function announcedByAttribute() {
  const value = document.documentElement.getAttribute("data-grist-appearance");
  return value === DARK || value === LIGHT ? value : "";
}

/**
 * Le thème du document devient celui de l'outil.
 *
 * Seul `data-fr-theme` est posé — c'est lui que le DSFR met en couleur — et
 * rien n'est mémorisé : ce thème n'est pas un choix de la personne. Le laisser
 * dans la clé « scheme » ferait croire, une fois revenu au site autonome, à un
 * réglage qu'elle n'a jamais fait. `data-fr-scheme` reste donc tel quel ; le
 * sélecteur local retrouve son sens dès qu'on quitte Grist.
 */
function applyGristTheme(appearance) {
  gristAppearance = appearance;
  clearGristWait();
  const root = document.documentElement;
  root.setAttribute("data-fr-theme", appearance);
  root.style.colorScheme = appearance;
  syncThemeButton();
}

/* ------------------------------------------------------------------ */
/* Plein écran                                                         */
/* ------------------------------------------------------------------ */

function requestFn() {
  const el = document.documentElement;
  return el.requestFullscreen || el.webkitRequestFullscreen
    || el.mozRequestFullScreen || el.msRequestFullscreen;
}

function exitFn() {
  return document.exitFullscreen || document.webkitExitFullscreen
    || document.mozCancelFullScreen || document.msExitFullscreen;
}

export function fullscreenSupported() {
  if (!requestFn()) return false;
  return document.fullscreenEnabled !== false;
}

export function inFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement
    || document.mozFullScreenElement || document.msFullscreenElement);
}

/** Bascule le plein écran du navigateur. Rejette si le navigateur le refuse. */
export async function toggleFullscreen() {
  if (inFullscreen()) {
    const exit = exitFn();
    if (exit) await exit.call(document);
  } else {
    const request = requestFn();
    if (!request) return false;
    await request.call(document.documentElement);
  }
  syncFullscreenButton();
  return inFullscreen();
}

/**
 * L'outil est-il déjà présenté seul ? La plateforme transmet la chaîne de
 * requête de la page à l'outil : « ?style=singlePage » signifie que la page
 * s'affiche sans l'habillage du site, c'est-à-dire déjà en plein écran — le
 * bouton n'y a donc pas sa place.
 */
export function alreadySinglePage() {
  try {
    return new URLSearchParams(location.search).get("style") === "singlePage";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Boutons de l'en-tête                                                */
/* ------------------------------------------------------------------ */

/**
 * Bouton de thème. Absent tant que Grist décide de l'apparence : soit le thème
 * du document est connu, soit son annonce est encore attendue — afficher un
 * sélecteur qui disparaîtrait une seconde plus tard serait un doublon, et une
 * gêne. Le bouton reparaît de lui-même si Grist ne dit rien (voir
 * `watchGristTheme`).
 */
export function themeButtonHtml() {
  if (gristAppearance || gristWaiting) return "";
  const dark = currentTheme() === DARK;
  return iconButton(dark ? ICONS.toLight : ICONS.toDark, {
    variant: "tertiary-no-outline",
    size: "sm",
    title: dark ? TITLES.toLight : TITLES.toDark,
    action: "toggle-theme",
  });
}

export function fullscreenButtonHtml() {
  if (alreadySinglePage() || !fullscreenSupported()) return "";
  return iconButton(inFullscreen() ? ICONS.fullscreenOff : ICONS.fullscreenOn, {
    variant: "tertiary-no-outline",
    size: "sm",
    title: inFullscreen() ? TITLES.fullscreenOff : TITLES.fullscreenOn,
    action: "toggle-fullscreen",
  });
}

/** Remplace l'icône et le libellé accessible d'un bouton déjà affiché. */
function relabel(button, iconName, title) {
  for (const span of button.querySelectorAll("[class*='fr-icon-']")) {
    for (const cls of [...span.classList]) {
      if (cls.startsWith("fr-icon-")) span.classList.remove(cls);
    }
    span.classList.add(`fr-icon-${iconName}`);
  }
  button.title = title;
  const sr = button.querySelector(".fr-sr-only");
  if (sr) sr.textContent = title;
}

function currentButton(action) {
  return document.querySelector(`[data-action="${action}"]`);
}

function syncThemeButton() {
  const btn = currentButton("toggle-theme");
  if (!btn) return;
  // Le thème vient du document : le sélecteur n'a plus lieu d'être.
  if (gristAppearance) { btn.remove(); return; }
  const dark = currentTheme() === DARK;
  relabel(btn, dark ? ICONS.toLight : ICONS.toDark, dark ? TITLES.toLight : TITLES.toDark);
}

function syncFullscreenButton() {
  const btn = currentButton("toggle-fullscreen");
  if (!btn) return;
  const on = inFullscreen();
  relabel(btn, on ? ICONS.fullscreenOff : ICONS.fullscreenOn, on ? TITLES.fullscreenOff : TITLES.fullscreenOn);
}

/**
 * Le thème peut changer sans passer par l'outil : le système d'exploitation
 * lorsqu'aucun choix n'a été mémorisé, ou le DSFR lui-même. Les boutons
 * doivent alors rester justes.
 */
export function watchDisplay() {
  window.addEventListener("fullscreenchange", syncFullscreenButton);
  window.addEventListener("webkitfullscreenchange", syncFullscreenButton);
  const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (media && media.addEventListener) {
    media.addEventListener("change", () => { if (!explicitTheme()) syncThemeButton(); });
  }
}
