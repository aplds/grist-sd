// Alignement vertical des champs d'une même ligne — EX-060 (voir SPEC § 8.27).
//
// Le DSFR empile, dans chaque cellule d'une grille, le libellé — avec son texte
// d'aide — puis le contrôle de saisie. Deux champs voisins n'ont presque jamais
// le même nombre de lignes de libellé : l'un porte une aide de cinq lignes,
// l'autre une seule. Les contrôles se retrouvent alors à des hauteurs
// différentes, et la ligne se lit en escalier.
//
// Ce module mesure, après chaque rendu, la hauteur du libellé le plus haut de
// chaque **ligne visuelle** (une grille qui se replie sur plusieurs lignes est
// mesurée bande par bande) et la publie en variable CSS `--champ-label-h` sur
// les cellules : les libellés gardent leur première ligne alignée en tête, et
// les contrôles, qui suivent leur libellé, commencent tous à la même hauteur.
// La mise en forme elle-même reste dans `styles.css`.
//
// La mesure dépend de la largeur disponible : elle est donc refaite quand la
// largeur change (la barre de défilement qui apparaît ou disparaît en fait
// partie) et quand un bloc repliable s'ouvre ou se ferme — un contenu replié
// n'a pas de dimensions, et sa mesure ne vaut rien.

const GROUPE = ".fr-input-group, .fr-select-group, .fr-checkbox-group";
const CELLULE = '.fr-grid-row > [class*="fr-col-"]';

/* Tolérance, en pixels, entre deux cellules considérées comme sur la même
   ligne : les colonnes d'une ligne partagent leur bord haut, à l'arrondi près. */
const ECART_LIGNE = 4;

/** Le groupe de champs d'une cellule, quand elle n'en porte qu'un. */
function groupeDeLaCellule(cellule) {
  const enfant = cellule.children.length === 1 ? cellule.firstElementChild : null;
  return enfant && enfant.matches(GROUPE) ? enfant : null;
}

/**
 * Aligne les champs de chaque ligne de la racine donnée.
 * À appeler après un rendu : c'est la largeur mesurée qui décide.
 */
export function alignerChamps(racine = document) {
  const cellules = [...racine.querySelectorAll(CELLULE)];
  if (!cellules.length) return;

  // Toutes les valeurs sont effacées d'abord, puis reposées : une valeur
  // mesurée au tour précédent ne doit pas fausser la mesure du tour suivant
  // (un libellé étiré reste étiré si on le mesure tel quel), et une cellule
  // absente de toute bande ne doit pas hériter de la bande qui la contient.
  for (const cellule of cellules) cellule.style.setProperty("--champ-label-h", "0px");

  // Mesure : une seule lecture par cellule, avant toute écriture.
  const mesures = cellules.map((cellule) => {
    const groupe = groupeDeLaCellule(cellule);
    // Une case à cocher n'a pas de contrôle **sous** son libellé : elle ne
    // donne pas la hauteur de la bande, elle la suit (voir `styles.css`).
    const libelle = groupe && !groupe.classList.contains("fr-checkbox-group")
      ? groupe.querySelector(":scope > .fr-label")
      : null;
    return {
      cellule,
      ligne: cellule.parentElement,
      haut: Math.round(cellule.getBoundingClientRect().top),
      hauteur: libelle ? Math.ceil(libelle.getBoundingClientRect().height) : 0,
    };
  });

  const parLigne = new Map();
  for (const mesure of mesures) {
    if (!parLigne.has(mesure.ligne)) parLigne.set(mesure.ligne, []);
    parLigne.get(mesure.ligne).push(mesure);
  }

  for (const colonnes of parLigne.values()) {
    if (colonnes.length < 2) continue;
    const bandes = [];
    for (const mesure of colonnes) {
      const bande = bandes.find((b) => Math.abs(b.haut - mesure.haut) <= ECART_LIGNE);
      if (bande) bande.colonnes.push(mesure);
      else bandes.push({ haut: mesure.haut, colonnes: [mesure] });
    }
    for (const bande of bandes) {
      // Un champ seul sur sa ligne n'a rien à quoi s'aligner.
      if (bande.colonnes.length < 2) continue;
      const hauteur = Math.max(...bande.colonnes.map((m) => m.hauteur));
      if (!hauteur) continue;
      for (const mesure of bande.colonnes) {
        mesure.cellule.style.setProperty("--champ-label-h", `${hauteur}px`);
      }
    }
  }
}

/**
 * Refait l'alignement quand la largeur de la cible change, ou qu'un bloc
 * repliable s'ouvre (un contenu replié ne se mesure pas).
 */
export function suivreAlignement(cible) {
  if (!cible) return;
  let largeur = cible.getBoundingClientRect().width;
  let prevu = false;
  const relancer = () => {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(() => {
      prevu = false;
      alignerChamps(document);
      largeur = cible.getBoundingClientRect().width;
    });
  };
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      const largeurSuivante = cible.getBoundingClientRect().width;
      // Seule la largeur décide des retours à la ligne : une hauteur qui
      // change (l'alignement lui-même en change) ne relance pas la mesure,
      // sans quoi chaque passage en déclencherait un autre.
      if (Math.abs(largeurSuivante - largeur) < 0.5) return;
      relancer();
    }).observe(cible);
  }
  window.addEventListener("resize", relancer);
  // `toggle` ne remonte pas : il est écouté en phase de capture.
  document.addEventListener("toggle", (event) => {
    if (event.target && event.target.tagName === "DETAILS") relancer();
  }, true);
}
