// En-tête défilé : les commandes du compte prennent place sur la barre de
// navigation — EX-070 (voir SPEC § 8, invariant 34).
//
// La barre de navigation est collée en haut de la fenêtre (`position: sticky`,
// `styles.css`), l'en-tête ne l'est pas. En défilant, le titre du service — et
// avec lui le bouton « Nouvelle affaire » et le bloc de compte — quittent la
// vue, alors que la barre, elle, reste. Or ces deux commandes sont celles dont
// on se sert à tout moment : créer une affaire, vérifier sous quelle identité on
// travaille. Elles **paraissent donc sur la barre** dès que l'en-tête a
// disparu, et s'effacent avec lui.
//
// Elles se rangent **à droite du rang des onglets** (au-delà de 48em) : la
// barre ne grandit pas, la place est prise aux onglets, et tout tient sur une
// seule ligne tant qu'il y en a. En deçà de 48em, la barre se replie dans un
// menu et le bloc reprend sa propre ligne, sous lui. C'est la feuille de style
// qui décide (`styles.css`), et ce module qui suit : la largeur est le sens du
// mouvement dans un cas, la hauteur dans l'autre.
//
// La bascule est un état du document (`<html class="entete-reduite">`) : le
// balisage des deux barres est écrit une fois pour toutes (`app.js`). Les deux
// états — strapontin fermé, strapontin ouvert — sont décrits par la feuille de
// style ; l'animation entre les deux est menée ici, image par image.
//
// **Pourquoi une animation au script, et non une transition CSS ?** Parce que
// les transitions ne s'avancent pas dans tous les cadres où l'outil s'affiche :
// l'aperçu de l'éditeur se déclare masqué (`document.hidden`), et son horloge
// d'animation reste à zéro — une transition y reste donc figée à son départ, ce
// qui laisserait le strapontin invisible alors que la page a bel et bien
// basculé. Une animation menée par `requestAnimationFrame` s'exécute là où le
// navigateur demande des images. Et si aucune image n'arrive (onglet passé en
// arrière-plan, pendant l'animation), un délai de secours efface les styles
// posés : l'état décrit par la feuille de style s'applique alors sans
// animation, au lieu de laisser un demi-état.
//
// Le module publie aussi la **hauteur de la barre** en `--app-navbar-h`. Les
// autres barres collées de la page s'y adossent : le sommaire d'ancres d'une
// page longue (`ui.anchors`, `top: 0` jusqu'ici) et les colonnes d'outils des
// ateliers. Faute de cette mesure, le sommaire se collait **par-dessus** la
// barre de navigation, qui disparaissait sous lui dès qu'on défilait — et les
// colonnes, à hauteur fixe, passaient sous la barre quand celle-ci tenait sur
// deux rangs.
//
// La position est surveillée par l'écoute du défilement et du
// redimensionnement — le chemin direct —, **doublée d'un contrôle périodique**.
// Ce n'est pas un excès de prudence : les événements de défilement ne sont pas
// délivrés dans tous les cadres où l'outil s'affiche (l'aperçu de l'éditeur,
// entre autres), et une hauteur qui change **sans** défilement — le logo de
// l'opérateur qui arrive, une ligne d'outils qui se replie — ne réveille aucune
// écoute. Le contrôle est court (150 ms) et sans effet quand rien n'a bougé.
//
// `majEnteteDefilant` est appelé au défilement, au redimensionnement, par le
// contrôle périodique, et après chaque rendu (la coquille est refaite à chaque
// rendu, et l'état doit être reposé sur le nouveau balisage — sans animation,
// puisque la classe est posée avant que la page ne soit peinte).

const CLASSE = "entete-reduite";
const VARIABLE = "--app-navbar-h";

/* Bande morte entre la descente et la remontée : l'en-tête est déclaré masqué
   dès que son bas a franchi le haut de la fenêtre, et ne revient qu'une fois
   redescendu de cette marge. Sans elle, un défilement qui s'arrête pile sur le
   seuil ferait battre l'animation. */
const MARGE_REMONTEE = 28;

/* Période du contrôle de secours de la position, en millisecondes. C'est aussi
   la latence de la bascule là où les événements de défilement ne sont pas
   délivrés : courte, mais pas au point de tenir un processeur éveillé. */
const PERIODE = 100;

/* Durée de la descente des commandes, en millisecondes, et délai au bout
   duquel on rend la main à la feuille de style si aucune image n'est venue. */
const DUREE = 240;
const SECOURS = DUREE + 200;

/* Course du glissement, en rem : les commandes arrivent d'un peu plus haut que
   leur place, comme si elles descendaient de l'en-tête. Sur sa propre ligne
   seulement — quand le bloc partage le rang des onglets, c'est sa **largeur**
   qui s'ouvre, et il n'y a pas de course à faire. */
const COURSE = 0.7;

/* Largeur à partir de laquelle le bloc partage le rang des onglets. C'est la
   même règle de largeur que la feuille de style, et elle doit le rester : c'est
   elle qui décide si le mouvement est une largeur (rang partagé) ou une hauteur
   (bloc sur sa propre ligne, sous le menu replié). */
const RANG_PARTAGE = "(min-width: 48.0625em)";

let reduit = false;
let hauteurVue = -1;
let animation = null;
let requeteRang = null;

const entete = () => document.querySelector(".fr-header");
const barre = () => document.querySelector(".app-navbar");

/**
 * Le bloc partage-t-il le rang des onglets ? Oui au-delà de 48em ; en deçà, la
 * barre se replie dans un menu et le bloc reprend sa propre ligne (`styles.css`).
 * La question commande le sens du mouvement : largeur dans un cas, hauteur dans
 * l'autre.
 */
function enRangPartage() {
  if (!requeteRang && window.matchMedia) requeteRang = window.matchMedia(RANG_PARTAGE);
  return !!requeteRang && requeteRang.matches;
}

/** Le strapontin et son contenu, ou `null` si la coquille n'est pas montée. */
function strapontin() {
  const boite = document.querySelector(".app-navbar__outils");
  if (!boite) return null;
  return { boite, rail: boite.querySelector(".app-navbar__outils-rail") };
}

/**
 * La barre se colle-t-elle réellement ? C'est la position **calculée** qui le
 * dit, jamais une supposition sur le cadre d'affichage : un widget Grist défile
 * pour lui-même, et la barre s'y colle comme dans un onglet. Si une feuille de
 * style — une intégration, un mode d'impression — la laisse dans le flux, il n'y
 * a rien à rejoindre, et les commandes restent dans l'en-tête.
 */
const collee = (el) => !!el && getComputedStyle(el).position === "sticky";

/** L'état que la position de défilement appelle : en-tête masqué, oui ou non. */
function etatVoulu() {
  const haut = entete();
  if (!haut || !collee(barre())) return false;
  const bas = haut.getBoundingClientRect().bottom;
  return reduit ? bas <= MARGE_REMONTEE : bas <= 0;
}

/** Le mouvement est-il refusé par le système ? L'état change alors d'un coup. */
function mouvementReduit() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/**
 * Publie la hauteur de la barre pour les barres collées qui s'y adossent.
 *
 * Elle est prise sur la barre **entière**, strapontin compris : les barres qui
 * s'y adossent se posent sous tout ce qui est collé, sans être recouvertes.
 * Pendant l'animation, la mesure est repassée à chaque image : les barres qui
 * suivent la barre de navigation suivent le mouvement, sans attendre la fin.
 */
function publierHauteur() {
  const el = barre();
  const hauteur = collee(el) ? el.offsetHeight : 0;
  if (hauteur === hauteurVue) return;
  hauteurVue = hauteur;
  document.documentElement.style.setProperty(VARIABLE, `${hauteur}px`);
}

/* ------------------------------------------------------------------ */
/* Les commandes sur la barre                                          */
/* ------------------------------------------------------------------ */

/**
 * La mesure du strapontin **ouvert** : la largeur que son contenu demande quand
 * il partage le rang des onglets, sa hauteur quand il tient sa propre ligne.
 *
 * La mesure se prend sur le contenu lui-même (`rail`), qui garde sa largeur
 * propre : le bloc peut donc être mesuré alors même qu'il est refermé, sans que
 * le contenu ne se comprime.
 */
function mesureOuverte({ boite, rail }) {
  if (enRangPartage()) return rail ? rail.getBoundingClientRect().width : boite.scrollWidth;
  const avant = boite.style.maxHeight;
  boite.style.maxHeight = "none";
  const hauteur = boite.getBoundingClientRect().height;
  boite.style.maxHeight = avant;
  return hauteur;
}

/** La mesure où en est le strapontin, dans le sens du mouvement en cours. */
function mesureCourante({ boite }) {
  const cadre = boite.getBoundingClientRect();
  return enRangPartage() ? cadre.width : cadre.height;
}

/** Efface les styles posés par l'animation : les états de la feuille reprennent. */
function effacerStyles({ boite, rail }) {
  boite.style.width = "";
  boite.style.height = "";
  boite.style.maxHeight = "";
  boite.style.opacity = "";
  boite.style.visibility = "";
  if (rail) rail.style.transform = "";
}

/**
 * Pose une image de l'animation : la mesure du strapontin (largeur en rang
 * partagé, hauteur sinon), et — dans la même proportion — son opacité et, quand
 * il tient sa propre ligne, la course du contenu, qui arrive d'un peu plus haut.
 * La proportion est **déduite de la mesure** (et non d'un compteur séparé) : une
 * animation reprise en cours de route repart ainsi sans à-coup.
 */
function poserImage({ boite, rail }, mesure, pleine) {
  const part = pleine > 0 ? Math.max(0, Math.min(1, mesure / pleine)) : 0;
  const valeur = `${Math.max(0, mesure)}px`;
  if (enRangPartage()) {
    boite.style.width = valeur;
    // La hauteur du bloc est nulle tant qu'il est fermé (`styles.css`) : pendant
    // l'animation, c'est sa propre hauteur qu'il reprend — le mouvement ne
    // porte que sur la largeur.
    boite.style.height = "auto";
  } else {
    boite.style.maxHeight = valeur;
    if (rail) rail.style.transform = part >= 1 ? "" : `translateY(${((part - 1) * COURSE).toFixed(3)}rem)`;
  }
  boite.style.opacity = String(part);
}

/** Arrête l'animation en cours, s'il y en a une, sans toucher aux styles. */
function interrompre() {
  if (!animation) return;
  cancelAnimationFrame(animation.image);
  clearTimeout(animation.minuteur);
  animation = null;
}

/**
 * Ouvre (`ouvrir`) ou referme les commandes sur la barre de navigation, depuis
 * la place où elles en sont.
 *
 * La fonction est appelée **avant** que l'état ne soit basculé (la classe sur
 * `<html>`) : elle relève la mesure où en est le strapontin, et pose les styles
 * de cette mesure. L'état d'arrivée ne paraît donc jamais avant l'animation, et
 * une bascule qui survient en cours de route — on referme avant que l'ouverture
 * soit finie — repart de là où l'on est, sans saut.
 */
function animer(ouvrir) {
  interrompre();
  const b = strapontin();
  if (!b) return;
  if (mouvementReduit()) {
    effacerStyles(b);
    return;
  }
  const pleine = mesureOuverte(b);
  const depart = mesureCourante(b);
  const cible = ouvrir ? pleine : 0;
  poserImage(b, depart, pleine);
  // La fermeture remet `visibility: hidden` par la feuille de style : le
  // strapontin doit rester visible le temps de se refermer.
  if (!ouvrir) b.boite.style.visibility = "visible";

  const debut = performance.now();
  const etat = { image: null, minuteur: null };
  const image = () => {
    const avance = Math.max(0, Math.min(1, (performance.now() - debut) / DUREE));
    poserImage(b, depart + (cible - depart) * avance, pleine);
    publierHauteur();
    if (avance >= 1) {
      interrompre();
      effacerStyles(b);
      publierHauteur();
      return;
    }
    etat.image = requestAnimationFrame(image);
  };
  etat.minuteur = setTimeout(() => {
    // Aucune image n'est venue : on rend la main à la feuille de style, qui
    // décrit déjà l'état juste.
    if (animation !== etat) return;
    interrompre();
    effacerStyles(b);
    publierHauteur();
  }, SECOURS);
  animation = etat;
  etat.image = requestAnimationFrame(image);
}

/* ------------------------------------------------------------------ */
/* Suivi de la position                                                */
/* ------------------------------------------------------------------ */

/** Recalcule l'état de l'en-tête et le repose, avec son animation. */
export function majEnteteDefilant() {
  const voulu = etatVoulu();
  if (voulu !== reduit) {
    reduit = voulu;
    // L'animation relève la hauteur courante **avant** la bascule, et pose les
    // styles de départ ; la bascule suit, dans la même tâche — rien n'est peint
    // entre les deux.
    animer(reduit);
    document.documentElement.classList.toggle(CLASSE, reduit);
    publierHauteur();
    return;
  }
  publierHauteur();
}

/**
 * Installe le suivi. À appeler une fois, au démarrage : l'écoute est posée sur
 * la fenêtre, pas sur la coquille, qui est refaite à chaque rendu.
 */
export function suivreEnteteDefilant() {
  // Le défilement s'écoute en phase de **capture** : le défilement d'une zone
  // qui défile pour elle-même (le corps d'une fenêtre, une liste) ne remonte
  // pas jusqu'à la fenêtre, et l'en-tête peut avoir bougé pendant ce temps.
  window.addEventListener("scroll", majEnteteDefilant, { passive: true, capture: true });
  window.addEventListener("resize", majEnteteDefilant);
  // Le contrôle périodique n'est pas suspendu quand la page passe en
  // arrière-plan (`document.hidden`) : le navigateur throttle déjà ses minuteries
  // dans ce cas, et l'aperçu de l'éditeur se déclare masqué alors qu'il est
  // visible et manipulable — s'y fier éteindrait la bascule là où on la regarde.
  setInterval(majEnteteDefilant, PERIODE);
  majEnteteDefilant();
}
