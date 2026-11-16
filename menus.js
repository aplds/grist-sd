// Positionnement des menus déroulants — EX-068 (voir SPEC § 8.32).
//
// Un menu (`.app-menu`) ouvre son panneau ancré au bord **droit** de son bouton
// (`styles.css`). C'est le bon ancrage tant que le bouton est près du bord droit
// de la fenêtre — le cas d'un en-tête de page sur un écran large. Sur un écran
// étroit, le bouton tombe ailleurs : la ligne d'actions se replie, et ses
// boutons repartent du bord **gauche**. Le panneau, large de 16,5 rem, sort
// alors par la gauche, et la moitié de ses entrées devient invisible et
// incliquable.
//
// Ce module mesure le panneau et le ramène dans la fenêtre par un simple
// décalage horizontal (`translateX`), sans toucher à l'ancrage ni à la mise en
// page. La mesure se prend au **clic** sur le résumé, qui précède l'ouverture du
// bloc : le panneau est déjà en place quand il apparaît, et ne saute pas d'un
// bord à l'autre sous les yeux. Le `toggle` reste écouté en filet de sécurité —
// l'ouverture au clavier ou par le code ne passe pas par un clic —, et un
// redimensionnement de la fenêtre pendant qu'un menu est ouvert le replace.

/* Marge conservée entre le panneau et le bord de la fenêtre. */
const MARGE = 8;

/** Le panneau d'un menu, ou `null` s'il n'en a pas. */
function panneauDe(menu) {
  return menu.querySelector(":scope > .app-menu__panel");
}

/**
 * Ramène un panneau dans la fenêtre s'il en sort. Sans effet — et sans
 * décalage laissé derrière — quand il y tient déjà : un panneau étroit, ou
 * mesuré alors que le bloc est fermé et n'a pas encore de dimensions (le
 * navigateur ne donne pas toutes ses cotes au contenu d'un `<details>` fermé).
 */
export function poserPanneau(panneau) {
  if (!panneau) return;
  panneau.style.transform = "";
  const cadre = panneau.getBoundingClientRect();
  if (!cadre.width) return;
  const fenetre = document.documentElement.clientWidth;
  let decalage = 0;
  if (cadre.left < MARGE) decalage = MARGE - cadre.left;
  else if (cadre.right > fenetre - MARGE) decalage = fenetre - MARGE - cadre.right;
  if (Math.round(decalage) !== 0) {
    panneau.style.transform = `translateX(${Math.round(decalage)}px)`;
  }
}

/**
 * Installe le positionnement des menus. À appeler une fois, au démarrage :
 * l'écoute est posée sur le document, pas sur les menus, qui sont refaits à
 * chaque rendu.
 */
export function suivreMenus() {
  // Le clic précède l'ouverture du bloc : le panneau est mis en place avant
  // d'être peint. Un clic sur un menu déjà ouvert le referme : rien à poser.
  document.addEventListener("click", (evenement) => {
    const resume = evenement.target.closest ? evenement.target.closest("summary") : null;
    const menu = resume ? resume.closest("details.app-menu") : null;
    if (menu && !menu.open) poserPanneau(panneauDe(menu));
  }, true);
  // `toggle` ne remonte pas : il est écouté en phase de capture, comme pour
  // l'alignement des champs (`alignement.js`).
  document.addEventListener("toggle", (evenement) => {
    const menu = evenement.target;
    if (!menu || menu.tagName !== "DETAILS" || !menu.classList.contains("app-menu")) return;
    const panneau = panneauDe(menu);
    if (menu.open) poserPanneau(panneau);
    else if (panneau) panneau.style.transform = "";
  }, true);
  // Un menu ouvert pendant un changement de largeur garde son ancrage au
  // bouton : le panneau suit, mais peut se retrouver hors de la fenêtre.
  window.addEventListener("resize", () => {
    for (const menu of document.querySelectorAll("details.app-menu[open]")) {
      poserPanneau(panneauDe(menu));
    }
  });
}
