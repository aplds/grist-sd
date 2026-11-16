// Graphiques des rapports d'activité : camemberts, anneaux, barres, colonnes.
//
// Un graphique est **dessiné une fois**, sur un canevas, et rendu sous forme
// d'image : le même dessin se voit à l'écran, s'imprime, entre dans le rapport
// PDF, Word ou OpenDocument, et se télécharge en PNG. Une seule mise en forme,
// donc, et aucun décalage entre ce qu'on regarde et ce qui part.
//
// Pourquoi un canevas, et non du SVG comme les barres du tableau de bord
// (`barChart`, views/common.js) ? Parce qu'un rapport d'activité quitte
// l'outil : ses graphiques doivent pouvoir être **exportés en image** et
// **rassemblés dans un fichier** (PDF, Word, OpenDocument). Le canevas donne
// cela sans bibliothèque, et fait des camemberts aussi bien que des barres.
//
// Deux rendus, une même donnée :
//
//   - à l'écran, le fond est **transparent** et les textes prennent les
//     couleurs du thème (clair ou sombre) : le graphique se pose dans sa carte
//     comme s'il était du texte ;
//   - à l'impression et à l'export PNG, le fond est **blanc** et les textes
//     noirs — un graphique part dans un rapport, et un rapport s'imprime sur du
//     papier blanc. Un graphique exporté depuis le thème sombre serait sinon
//     illisible une fois collé dans un document.
//
// Les couleurs des séries sont fixes (voir `PALETTE`) : elles doivent tenir sur
// le blanc comme sur le fond sombre, puisque le même graphique est exporté sans
// savoir où il ira.

/* ------------------------------------------------------------------ */
/* Palette et couleurs du moment                                       */
/* ------------------------------------------------------------------ */

/**
 * Couleurs des séries, dans l'ordre où elles se présentent. Des tons moyens,
 * saturés mais pas sombres : lisibles sur un fond blanc comme sur un fond
 * sombre, et distinguables en niveaux de gris comme en couleur.
 */
export const PALETTE = [
  "#0b6bcb", // bleu
  "#d97706", // ambre
  "#15803d", // vert
  "#b91c1c", // rouge
  "#7c3aed", // violet
  "#0e7490", // turquoise
  "#a16207", // ocre
  "#4b5563", // gris ardoise
];

/** Couleur d'une série par son rang, en boucle si la série est plus longue. */
export function couleurSerie(index) {
  return PALETTE[index % PALETTE.length];
}

/** Couleur du poste « Autres », quand les petites séries sont regroupées. */
const COULEUR_AUTRES = PALETTE[PALETTE.length - 1];

/** Habillage d'impression : fond blanc, encre noire — ce qui s'imprime. */
const THEME_IMPRESSION = {
  texte: "#161616",
  texteDoux: "#666666",
  filet: "#dddddd",
  vide: "#e6e6e6",
  fond: "#ffffff",
};

/**
 * Habillage de l'écran : textes et filets pris aux jetons du DSFR, fond
 * transparent (le graphique se pose dans sa carte, comme du texte). Repli sur
 * l'habillage d'impression lorsque la page n'est pas là.
 */
function themeCourant() {
  if (typeof document === "undefined" || !document.documentElement) return THEME_IMPRESSION;
  const s = getComputedStyle(document.documentElement);
  const lire = (nom, defaut) => String(s.getPropertyValue(nom) || "").trim() || defaut;
  return {
    texte: lire("--text-default-grey", THEME_IMPRESSION.texte),
    texteDoux: lire("--text-mention-grey", THEME_IMPRESSION.texteDoux),
    filet: lire("--border-default-grey", THEME_IMPRESSION.filet),
    vide: lire("--background-contrast-grey", THEME_IMPRESSION.vide),
    fond: null,
  };
}

/** Police des graphiques : celle de la page, à défaut une police sans sérif. */
function policeCourante() {
  if (typeof document === "undefined" || !document.body) return "Arial, sans-serif";
  const famille = getComputedStyle(document.body).fontFamily;
  return famille && famille.trim() ? famille : "Arial, sans-serif";
}

/* ------------------------------------------------------------------ */
/* Séries                                                              */
/* ------------------------------------------------------------------ */

const nombreFr = new Intl.NumberFormat("fr-FR");

/** Nombre écrit à la française (séparateur de milliers). */
export function nombre(valeur) {
  return nombreFr.format(Number(valeur) || 0);
}

/** Part écrite à la française : entier au-dessus de 10 %, sinon un dixième. */
export function pourcentage(part) {
  const texte = part >= 10 ? String(Math.round(part)) : part.toFixed(1);
  return texte.replace(".", ",");
}

/**
 * Série prête à dessiner : les entrées vides écartées, les parts calculées, les
 * couleurs attribuées.
 *
 * `tri` classe les séries (`"desc"` par défaut, `"none"` pour garder l'ordre
 * donné — l'ordre des mois d'une année, par exemple, qui n'est pas un
 * classement). `limite` regroupe au-delà de ce nombre d'entrées, sous un poste
 * « Autres » : un camembert à quinze parts ne se lit pas, et une légende de
 * quinze lignes déborde du dessin.
 *
 * `vides` garde les entrées à zéro. Une série ordonnée est un axe — les douze
 * mois d'une année — et un mois sans affaire est une donnée : il doit tenir sa
 * place dans l'axe, sans quoi le temps se comprime et le graphique trompe. Pour
 * une répartition, au contraire, une part nulle n'existe pas : elle est écartée.
 *
 * `couleur` donne une couleur unique à toute la série, au lieu d'une couleur
 * par entrée (voir `miseEnPage`).
 *
 * @param {Array<{label: string, value: number}>} donnees
 * @returns {{items: Array<{label: string, value: number, part: number, couleur: string}>, total: number}}
 */
export function serieNormalisee(donnees, { tri = "desc", limite = 0, vides = false, couleur = "" } = {}) {
  let items = (donnees || [])
    .map((d) => ({ label: String(d.label ?? ""), value: Number(d.value) || 0 }))
    .filter((d) => d.value > 0 || vides);
  if (tri === "desc") items = items.slice().sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr"));
  let total = items.reduce((n, d) => n + d.value, 0);
  let autres = false;
  if (limite > 0 && items.length > limite) {
    const gardees = items.slice(0, limite - 1);
    const reste = items.slice(limite - 1).reduce((n, d) => n + d.value, 0);
    items = [...gardees, { label: "Autres", value: reste }];
    total = items.reduce((n, d) => n + d.value, 0);
    autres = true;
  }
  return {
    items: items.map((d, i) => ({
      ...d,
      // Une couleur unique fait une série d'un seul tenant — un temps, un
      // classement d'une même famille. À défaut, chaque entrée prend son tour
      // dans la palette ; le poste « Autres » reçoit une teinte neutre, puisque
      // ce n'est pas une série mais ce qu'on n'a pas voulu détailler.
      couleur: couleur || (autres && i === limite - 1 ? COULEUR_AUTRES : couleurSerie(i)),
      part: total ? (d.value / total) * 100 : 0,
    })),
    total,
  };
}

/* ------------------------------------------------------------------ */
/* Outils de dessin                                                    */
/* ------------------------------------------------------------------ */

/** Canevas de mesure : la largeur d'un texte doit être connue avant de le poser. */
function mesureur(police) {
  const ctx = document.createElement("canvas").getContext("2d");
  const font = (taille, graisse = 400) => `${graisse} ${taille}px ${police}`;
  return {
    font,
    largeur(texte, taille, graisse = 400) {
      ctx.font = font(taille, graisse);
      return ctx.measureText(String(texte ?? "")).width;
    },
  };
}

/** Texte raccourci avec des points de suspension, pour tenir dans une largeur. */
function tronquer(m, texte, largeur, taille, graisse = 400) {
  let t = String(texte ?? "");
  if (m.largeur(t, taille, graisse) <= largeur) return t;
  while (t.length > 1 && m.largeur(`${t}…`, taille, graisse) > largeur) t = t.slice(0, -1);
  return `${t}…`;
}

function arrondi(ctx, x, y, largeur, hauteur, rayon) {
  const r = Math.max(0, Math.min(rayon, hauteur / 2, largeur / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + largeur - r, y);
  ctx.quadraticCurveTo(x + largeur, y, x + largeur, y + r);
  ctx.lineTo(x + largeur, y + hauteur - r);
  ctx.quadraticCurveTo(x + largeur, y + hauteur, x + largeur - r, y + hauteur);
  ctx.lineTo(x + r, y + hauteur);
  ctx.quadraticCurveTo(x, y + hauteur, x, y + hauteur - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

const TAILLE = { titre: 15, libelle: 13, valeur: 13 };
const HAUTEUR_LIGNE = 24;
const HAUTEUR_BARRE = 12;
const HAUTEUR_LEGENDE = 22;
const HAUTEUR_COLONNES = 240;
const HAUTEUR_TITRE = 26;

/**
 * Dimensions du dessin et éléments de mise en page, calculés **avant** de créer
 * le canevas : un graphique se dimensionne à son contenu — nombre de séries,
 * longueur des libellés — et l'image annonce ensuite sa taille au document.
 */
function miseEnPage(spec, opts, m) {
  const type = spec.type || "barres";
  const largeur = Math.max(240, Math.round(opts.largeur || 640));
  // Une colonne est un temps, ou un classement d'une même famille : elle se
  // dessine d'une seule couleur. Un camembert et des barres montrent des
  // catégories : chacune prend la sienne.
  const couleur = spec.couleur || (type === "colonnes" ? PALETTE[0] : "");
  const { items, total } = serieNormalisee(spec.donnees, { tri: spec.tri, limite: spec.limite, vides: spec.vides, couleur });
  const titreH = opts.titre && spec.titre ? HAUTEUR_TITRE : 0;

  if (type === "camembert" || type === "anneau") {
    // Le disque à gauche, la légende à droite ; la hauteur suit le plus grand
    // des deux, et la légende se centre verticalement sur le disque.
    const disque = Math.round(largeur * 0.4);
    const largeurLegende = largeur - disque - 24;
    const lignes = items.map((d) => tronquer(m, d.label, largeurLegende - 66, TAILLE.libelle));
    const hauteurContenu = Math.max(disque, items.length * HAUTEUR_LEGENDE + 8, 60);
    const hauteur = Math.round(titreH + hauteurContenu + 8);
    const zoneH = hauteur - titreH - 8;
    return {
      type, largeur, hauteur, items, total, titreH, titre: String(spec.titre || ""), unite: spec.unite || "",
      disque, rayon: disque / 2 - 2,
      centreX: disque / 2 + 2, centreY: titreH + zoneH / 2,
      legendeX: disque + 22, legendeY: titreH + Math.max(0, Math.round((zoneH - items.length * HAUTEUR_LEGENDE) / 2)),
      lignes,
    };
  }

  if (type === "colonnes") {
    const hauteur = Math.round(titreH + HAUTEUR_COLONNES);
    const pas = items.length ? (largeur - 16) / items.length : largeur;
    return {
      type, largeur, hauteur, items, total, titreH, titre: String(spec.titre || ""),
      pas, largeurBarre: Math.max(6, Math.min(46, pas * 0.6)),
      zoneY: titreH + 26, zoneH: HAUTEUR_COLONNES - 46,
      max: Math.max(...items.map((d) => d.value), 1),
      lignes: items.map((d) => tronquer(m, d.label, Math.max(20, pas - 4), TAILLE.libelle)),
    };
  }

  // Barres horizontales : libellés à gauche, barres au milieu, valeurs à droite.
  const largeurLibelles = Math.round(Math.min(
    largeur * 0.5,
    Math.max(90, Math.max(...items.map((d) => m.largeur(d.label, TAILLE.libelle)), 0) + 10)
  ));
  const zoneX = largeurLibelles + 4;
  const largeurValeurs = 52;
  return {
    type: "barres", largeur, hauteur: Math.round(titreH + items.length * HAUTEUR_LIGNE + 8),
    items, total, titreH, titre: String(spec.titre || ""),
    largeurLibelles, zoneX, largeurValeurs,
    zoneLargeur: Math.max(40, largeur - zoneX - largeurValeurs - 4),
    max: Math.max(...items.map((d) => d.value), 1),
    lignes: items.map((d) => tronquer(m, d.label, largeurLibelles - 6, TAILLE.libelle)),
  };
}

/* ------------------------------------------------------------------ */
/* Dessin                                                              */
/* ------------------------------------------------------------------ */

function dessinerTitre(ctx, p, th, police) {
  if (!p.titreH) return;
  ctx.fillStyle = th.texte;
  ctx.font = `700 ${TAILLE.titre}px ${police}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(p.titre, 0, p.titreH / 2 + 1);
}

/** Barres horizontales : un libellé, une barre, une valeur — le classement se lit d'un coup. */
function dessinerBarres(ctx, p, th, police) {
  ctx.textBaseline = "middle";
  p.items.forEach((d, i) => {
    const haut = p.titreH + i * HAUTEUR_LIGNE + (HAUTEUR_LIGNE - HAUTEUR_BARRE) / 2;
    const milieu = haut + HAUTEUR_BARRE / 2;

    ctx.fillStyle = th.texte;
    ctx.font = `${TAILLE.libelle}px ${police}`;
    ctx.textAlign = "left";
    ctx.fillText(p.lignes[i], 0, milieu);

    // Le fond de la barre donne l'échelle ; la barre pleine, la valeur.
    ctx.fillStyle = th.vide;
    arrondi(ctx, p.zoneX, haut, p.zoneLargeur, HAUTEUR_BARRE, HAUTEUR_BARRE / 2);
    ctx.fill();
    ctx.fillStyle = d.couleur;
    arrondi(ctx, p.zoneX, haut, Math.max(3, Math.round((d.value / p.max) * p.zoneLargeur)), HAUTEUR_BARRE, HAUTEUR_BARRE / 2);
    ctx.fill();

    ctx.fillStyle = th.texte;
    ctx.font = `700 ${TAILLE.valeur}px ${police}`;
    ctx.textAlign = "right";
    ctx.fillText(nombre(d.value), p.largeur, milieu);
  });
}

/** Colonnes verticales : une série dans le temps — les mois d'une année, par exemple. */
function dessinerColonnes(ctx, p, th, police) {
  const base = p.zoneY + p.zoneH;
  ctx.strokeStyle = th.filet;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, base + 0.5);
  ctx.lineTo(p.largeur, base + 0.5);
  ctx.stroke();

  p.items.forEach((d, i) => {
    const centre = 8 + p.pas * (i + 0.5);
    // Une case vide reste vide : seule la place du mois est marquée, sous
    // l'axe. Un moignon de barre ferait croire à une valeur minuscule.
    const hauteur = d.value ? Math.max(2, Math.round((d.value / p.max) * (p.zoneH - 20))) : 0;

    if (hauteur) {
      ctx.fillStyle = d.couleur;
      arrondi(ctx, centre - p.largeurBarre / 2, base - hauteur, p.largeurBarre, hauteur, Math.min(4, p.largeurBarre / 3));
      ctx.fill();
    }

    ctx.fillStyle = th.texte;
    ctx.font = `700 ${TAILLE.valeur}px ${police}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (d.value) ctx.fillText(nombre(d.value), centre, base - hauteur - 5);

    ctx.fillStyle = th.texteDoux;
    ctx.font = `${TAILLE.libelle}px ${police}`;
    ctx.textBaseline = "top";
    ctx.fillText(p.lignes[i], centre, base + 6);
  });
}

/**
 * Camembert (ou anneau) : la part de chaque série dans un total.
 *
 * Les parts s'écrivent dans les secteurs assez larges pour les porter, et
 * toujours dans la légende : un secteur de 2 % ne peut pas porter son
 * pourcentage, et un camembert dont les petites parts resteraient illisibles
 * serait un camembert trompeur.
 */
function dessinerCamembert(ctx, p, th, police) {
  const trou = p.type === "anneau" ? 0.58 : 0;
  let angle = -Math.PI / 2;

  if (p.items.length) {
    p.items.forEach((d) => {
      const fin = angle + (d.part / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(p.centreX, p.centreY);
      ctx.arc(p.centreX, p.centreY, p.rayon, angle, fin);
      ctx.closePath();
      ctx.fillStyle = d.couleur;
      ctx.fill();
      // Un filet de la couleur du fond sépare les secteurs : deux parts
      // voisines de teintes proches restent distinctes.
      ctx.strokeStyle = th.fond || th.filet;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (d.part >= 7) {
        const milieu = angle + (fin - angle) / 2;
        const r = p.rayon * (trou ? (1 + trou) / 2 : 0.63);
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${TAILLE.valeur}px ${police}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pourcentage(d.part)} %`, p.centreX + Math.cos(milieu) * r, p.centreY + Math.sin(milieu) * r);
      }
      angle = fin;
    });

    // Anneau : le disque est évidé, et le total s'écrit au centre.
    if (trou) {
      ctx.beginPath();
      ctx.arc(p.centreX, p.centreY, p.rayon * trou, 0, Math.PI * 2);
      if (th.fond) {
        ctx.fillStyle = th.fond;
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.fillStyle = th.texte;
      ctx.font = `700 28px ${police}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(nombre(p.total), p.centreX, p.centreY + 2);
      ctx.fillStyle = th.texteDoux;
      ctx.font = `${TAILLE.libelle}px ${police}`;
      ctx.textBaseline = "top";
      ctx.fillText(p.unite || "au total", p.centreX, p.centreY + 8);
    }
  } else {
    ctx.beginPath();
    ctx.arc(p.centreX, p.centreY, p.rayon, 0, Math.PI * 2);
    ctx.fillStyle = th.vide;
    ctx.fill();
    ctx.fillStyle = th.texteDoux;
    ctx.font = `${TAILLE.libelle}px ${police}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Aucune donnée", p.centreX, p.centreY);
  }

  // Légende : une ligne par série — pastille, libellé, valeur et part.
  p.items.forEach((d, i) => {
    const y = p.legendeY + i * HAUTEUR_LEGENDE + HAUTEUR_LEGENDE / 2;
    ctx.fillStyle = d.couleur;
    arrondi(ctx, p.legendeX, y - 5, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = th.texte;
    ctx.font = `${TAILLE.libelle}px ${police}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.lignes[i], p.legendeX + 18, y);
    ctx.fillStyle = th.texteDoux;
    ctx.textAlign = "right";
    ctx.fillText(`${nombre(d.value)} · ${pourcentage(d.part)} %`, p.largeur, y);
  });
}

/* ------------------------------------------------------------------ */
/* Entrée publique                                                     */
/* ------------------------------------------------------------------ */

/**
 * Dessine un graphique et rend son image.
 *
 * @param {object} spec `{ type: "barres"|"colonnes"|"camembert"|"anneau",
 *   titre, donnees: [{label, value}], tri, limite, unite }`
 * @param {object} opts `{ largeur, echelle, titre (écrire le titre dans
 *   l'image), pourImpression }`
 * @returns {{dataUrl: string, largeur: number, hauteur: number, items: Array}}
 */
export function graphiquePng(spec, opts = {}) {
  const police = policeCourante();
  const p = miseEnPage(spec, opts, mesureur(police));
  const echelle = Math.max(1, Number(opts.echelle) || 2);
  const th = opts.pourImpression ? THEME_IMPRESSION : themeCourant();

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(p.largeur * echelle);
  canvas.height = Math.round(p.hauteur * echelle);
  const ctx = canvas.getContext("2d");
  ctx.scale(echelle, echelle);
  if (th.fond) {
    ctx.fillStyle = th.fond;
    ctx.fillRect(0, 0, p.largeur, p.hauteur);
  }

  dessinerTitre(ctx, p, th, police);
  if (p.type === "camembert" || p.type === "anneau") dessinerCamembert(ctx, p, th, police);
  else if (p.type === "colonnes") dessinerColonnes(ctx, p, th, police);
  else dessinerBarres(ctx, p, th, police);

  return { dataUrl: canvas.toDataURL("image/png"), largeur: p.largeur, hauteur: p.hauteur, items: p.items };
}

/** Description d'une série : ce que dit le graphique, en une phrase (lecteurs d'écran). */
export function descriptionSerie(spec, items) {
  if (!items.length) return `${spec.titre || "Graphique"} : aucune donnée.`;
  const type = spec.type || "barres";
  const debut = type === "camembert" || type === "anneau"
    ? `Répartition — ${spec.titre || "graphique"} : `
    : `${spec.titre || "Graphique"}, du plus grand au plus petit : `;
  return debut + items
    .map((d) => `${d.label} ${nombre(d.value)}${d.part !== undefined ? ` (${pourcentage(d.part)} %)` : ""}`)
    .join(" ; ") + ".";
}

/** Échappement minimal : ce module peut servir hors de l'interface. */
function escap(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Graphique prêt à poser dans une page : l'image, son titre — écrit dans
 * l'image ou au-dessus d'elle — et, pour les lecteurs d'écran, la phrase qui
 * dit ce que le dessin montre.
 *
 * `opts.legende: false` tait le titre au-dessus de l'image : la carte qui
 * l'accueille porte déjà ce titre dans son en-tête, à côté du bouton
 * d'export. `opts.titre: true` l'écrit dans l'image elle-même (impression).
 */
export function graphiqueHtml(spec, opts = {}) {
  const { dataUrl, largeur, hauteur, items } = graphiquePng(spec, opts);
  return `
  <figure class="app-graphique${opts.classe ? ` ${opts.classe}` : ""}">
    ${spec.titre && !opts.titre && opts.legende !== false ? `<figcaption>${escap(spec.titre)}</figcaption>` : ""}
    <img class="app-graphique__image" src="${dataUrl}" width="${largeur}" height="${hauteur}"
      alt="${escap(descriptionSerie(spec, items))}">
  </figure>`;
}
