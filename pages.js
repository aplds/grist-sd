// Pagination des documents : l'aperçu et l'impression montrent des **pages**.
//
// Un document rendu est un flux continu. Sans pagination, la feuille de
// l'aperçu s'allonge indéfiniment jusqu'à devenir un rouleau de plusieurs
// mètres, et le pied de page — qui doit être répété au bas de **chaque** page —
// n'apparaît qu'une fois, tout en bas : l'écran ne montre donc pas ce que
// l'imprimante produira, et le lecteur ne sait pas combien de pages il rédige.
//
// Ce script découpe le flux en feuilles A4, au plus près des blocs : une page
// s'arrête au bas d'un paragraphe, entre deux lignes d'un tableau, entre deux
// items d'une liste, jamais au milieu d'une ligne. Un saut de page posé par
// l'auteur (`app-page-break`) impose la coupure. Le pied de page est recopié au
// bas de chaque feuille, et il y porte son numéro (`page-number`) et le nombre
// total de pages (`page-total`) lorsqu'ils s'y trouvent.
//
// Le script vit **dans le document rendu**, comme celui qui ajuste l'aperçu à
// la largeur du cadre : il ne dépend d'aucun fichier de l'outil, et peut donc
// s'exécuter aussi bien dans l'aperçu que dans la fenêtre d'impression, où rien
// d'autre n'est chargé. Les exports (PDF, Word, OpenDocument) ne l'embarquent
// pas : ils ont leur propre pagination, qui produit de vraies pages dans le
// fichier (voir export-doc.js).
//
// Le nombre de pages est renvoyé à la page qui accueille l'aperçu, par
// `postMessage` : c'est ce qui permet d'annoncer « 2 pages » à côté du bouton
// d'impression, sans que le cadre ait à interroger l'aperçu.
//
// Ce fichier porte aussi les repères que la pagination remplit — `page-number`
// et `page-total` — et la ligne de numérotation ajoutée au pied de page quand
// le type de trame la demande (voir `piedNumerote`).

/** Repère du numéro de page, rempli sur chaque feuille par la pagination. */
export const PAGE_NUMBER_SPAN = '<span class="page-number"></span>';
/** Repère du nombre total de pages, rempli sur chaque feuille. */
export const PAGE_TOTAL_SPAN = '<span class="page-total"></span>';
/** Numérotation : « Page 3 sur 3 ». La ligne du pied de page la place à droite. */
export const LIGNE_NUMEROTATION = `<span class="app-page-count__pages">Page ${PAGE_NUMBER_SPAN} sur ${PAGE_TOTAL_SPAN}</span>`;
/**
 * Numéro de l'affaire, à gauche de la ligne du pied de page. La balise
 * `{numero}` y est laissée : c'est le rendu des variables qui la remplace, sur
 * la même feuille que les autres variables du document.
 */
export const NUMERO_AFFAIRE = `<span class="app-page-count__numero">Dossier n° {numero}</span>`;

/**
 * Pied de page prêt à être répété au bas de chaque page : les variables
 * `{page}` et `{pages}` du bloc du type de trame y deviennent les repères que
 * la pagination remplit, et la ligne demandée par le type y est ajoutée si
 * l'auteur ne l'a pas déjà placée lui-même — la numérotation à droite
 * (`numeroter`), le numéro de l'affaire à gauche (`numero`).
 *
 * L'ajout se fait sur le HTML rendu — et non dans l'éditeur — afin que le
 * repère soit présent dans les trois exports comme dans l'aperçu : le PDF
 * numérote ses pages d'après `.page-number` (voir export-doc.js), Word et
 * OpenDocument y substituent un vrai champ de numérotation.
 *
 * Le numéro de l'affaire, lui, n'est pas un champ de pagination mais une
 * variable comme une autre : sa balise `{numero}` est remplacée par le rendu du
 * document (voir `computeDocumentParts`, render.js), sur la ligne que la
 * feuille reçoit ici.
 *
 * `html` est la **feuille entière**, corps compris : la ligne de numérotation
 * rejoint le pied de page que la feuille porte déjà. Une feuille qui n'en a
 * pas — la plupart des trames de l'outil n'en mettent pas, la pagination s'en
 * passe — reçoit le sien, réduit à cette ligne. L'envelopper dans le pied de
 * page aurait fait du document entier un pied de page : à la pagination, il
 * n'aurait plus tenu sur une page, et Word comme OpenDocument l'auraient
 * recopié au bas de chacune.
 */
/**
 * Les repères `{page}` et `{pages}` d'un texte, remplacés par ceux que la
 * pagination remplit. Ce sont des **variables de pied de page** : le document
 * les emploie dans sa feuille de style, et le texte peut aussi les nommer —
 * la palette de l'espace de rédaction les propose dans les deux zones. Sans ce
 * remplacement, la balise resterait **brute** jusqu'à l'export ; ici, elle
 * laisse un repère vide à l'écran et un vrai champ de pagination dans Word et
 * l'OpenDocument (voir `champDePage`, export-doc.js).
 */
export function reperesPagination(html) {
  return String(html ?? "")
    .replace(/\{page\}/g, PAGE_NUMBER_SPAN)
    .replace(/\{pages\}/g, PAGE_TOTAL_SPAN);
}

export function piedNumerote(html, { numeroter = false, numero = false } = {}) {
  const pied = reperesPagination(html);
  // L'auteur qui a placé `{page}` lui-même a réglé sa numérotation à la main :
  // l'outil n'en ajoute pas une seconde, mais le numéro de l'affaire qu'il
  // demande reste le sien, et se pose au bas de la même ligne.
  const numerotationAuto = numeroter && !pied.includes('class="page-number"');
  if (!numerotationAuto && !numero) return pied;
  const ligne = `<div class="app-page-count">${numero ? NUMERO_AFFAIRE : ""}${numerotationAuto ? LIGNE_NUMEROTATION : ""}</div>`;
  const boite = document.createElement("div");
  boite.innerHTML = pied.trim();
  const bloc = boite.querySelector(".print-footer");
  if (bloc) {
    bloc.insertAdjacentHTML("beforeend", ligne);
  } else {
    boite.insertAdjacentHTML("beforeend", `<div class="print-footer">${ligne}</div>`);
  }
  return boite.innerHTML;
}

export const PAGE_SCRIPT = `<script>
(function () {
  var MM = 96 / 25.4;          /* 1 mm en pixels CSS */
  var UTILE_MM = 297 - 40;     /* hauteur utile d'une feuille A4, marges de 2 cm */
  var PIED_MM = 10;            /* place réservée au pied de page dans le flux */
  var AISANCE_MM = 2;          /* garde-fou : le texte ne touche pas le pied */

  function pixels(mm) { return mm * MM; }

  function estBlanc(node) {
    return node.nodeType === 3 && node.nodeValue.trim() === "";
  }

  function estVide(node) {
    if (node.nodeType === 3) return node.nodeValue.trim() === "";
    if (node.nodeType !== 1) return true;
    /* Un saut de ligne ou une image comptent pour du contenu ; le reste est
       jugé sur le texte qu'il porte — un élément détaché du document, lui,
       n'a plus de géométrie mesurable (voir la fin de la pagination). */
    if (/^(IMG|HR)$/.test(node.tagName)) return false;
    if (node.querySelector("img, hr")) return false;
    return !(node.textContent || "").trim();
  }

  function estSautDePage(node) {
    if (node.nodeType !== 1) return false;
    return node.classList.contains("app-page-break") || node.getAttribute("data-page-break") === "1";
  }

  function estTitre(node) {
    return node.nodeType === 1 && /^H[1-6]$/.test(node.tagName);
  }

  function paginer() {
    var cadre = document.getElementById("docFit");
    var feuille = document.getElementById("docSheet");
    if (!cadre || !feuille || cadre.getAttribute("data-pagine")) return 0;
    var gabarit = feuille.cloneNode(true);
    var zone = feuille.querySelector(".page__content");
    var flux = zone && zone.querySelector(".content");
    if (!flux) return 0;
    /* Une page sans hauteur (aperçu replié, cadre caché) ne peut pas être
       mesurée : on ne pagine pas, et on repaginera quand elle s'affichera. */
    if (!flux.getBoundingClientRect().height) return 0;
    cadre.setAttribute("data-pagine", "1");

    /* Le pied de page sort du flux : il est recopié au bas de chaque page. Il
       vient de la feuille de style du format, où il a sa place à la fin du
       document — une trame peut en avoir mis un dans son texte, ou le format
       n'en avoir aucun : tous ceux qui sont trouvés sont retirés, et le premier
       sert de modèle. La hauteur est mesurée avant qu'ils ne partent, car elle
       décide de la place du texte — un pied plus haut que les dix millimètres
       réservés ronge le bas de la page. */
    var pieds = [].slice.call(flux.querySelectorAll(".print-footer"));
    var hauteurPied = 0;
    pieds.forEach(function (node) {
      if (!hauteurPied) hauteurPied = node.getBoundingClientRect().height;
      node.parentNode.removeChild(node);
    });
    var modele = pieds.length ? pieds[0].cloneNode(true) : null;
    if (modele) modele.removeAttribute("id");

    var limite = pixels(UTILE_MM - PIED_MM - AISANCE_MM) - Math.max(0, hauteurPied - pixels(PIED_MM));

    /* Les nœuds du flux, dans l'ordre. Les blancs disparaissent — ils
       n'apportent rien à la mise en page — et un texte nu est enveloppé dans un
       paragraphe, pour pouvoir être mesuré comme un bloc. */
    var file = [];
    var noeud = flux.firstChild;
    while (noeud) {
      var suivant = noeud.nextSibling;
      if (estBlanc(noeud)) {
        flux.removeChild(noeud);
      } else if (noeud.nodeType === 3) {
        var paragraphe = document.createElement("p");
        flux.replaceChild(paragraphe, noeud);
        paragraphe.appendChild(noeud);
        file.push(paragraphe);
      } else {
        file.push(noeud);
      }
      noeud = suivant;
    }

    /* La première feuille est la feuille d'origine ; elle est rangée dans sa
       boîte comme les suivantes, afin que l'ajustement de l'aperçu les traite
       toutes de la même façon. */
    var boite = document.createElement("div");
    boite.className = "page-box";
    cadre.insertBefore(boite, feuille);
    boite.appendChild(feuille);

    function nouvellePage() {
      var boitePage = document.createElement("div");
      boitePage.className = "page-box";
      var page = gabarit.cloneNode(true);
      page.removeAttribute("id");
      var zonePage = page.querySelector(".content");
      while (zonePage.firstChild) zonePage.removeChild(zonePage.firstChild);
      boitePage.appendChild(page);
      cadre.appendChild(boitePage);
      return { boite: boitePage, feuille: page, flux: zonePage };
    }

    function tient(entree, node) {
      var haut = entree.flux.getBoundingClientRect().top;
      return node.getBoundingClientRect().bottom - haut <= limite;
    }

    /* Découpe un tableau ou une liste entre deux lignes : ce qui dépasse part
       sur la page suivante, l'en-tête du tableau étant répété. Renvoie le
       morceau à placer, ou rien quand l'élément ne peut pas être coupé. */
    function decouper(entree, node) {
      if (node.tagName === "TABLE") return decouperTable(entree, node);
      if (node.tagName === "UL" || node.tagName === "OL") return decouperListe(entree, node);
      return null;
    }

    function decouperTable(entree, table) {
      var corps = table.tBodies && table.tBodies[0];
      if (!corps) return null;
      var suite = table.cloneNode(false);
      var corpsSuite = document.createElement("tbody");
      if (table.tHead) suite.appendChild(table.tHead.cloneNode(true));
      suite.appendChild(corpsSuite);
      while (!tient(entree, table) && corps.rows.length > 1) {
        corpsSuite.insertBefore(corps.rows[corps.rows.length - 1], corpsSuite.firstChild);
      }
      if (!corpsSuite.rows.length) return null;
      if (!corps.rows.length) return null;
      return suite;
    }

    function decouperListe(entree, liste) {
      var items = function () {
        return [].slice.call(liste.children).filter(function (li) { return li.tagName === "LI"; });
      };
      if (items().length < 2) return null;
      var suite = liste.cloneNode(false);
      while (!tient(entree, liste) && items().length > 1) {
        suite.insertBefore(items()[items().length - 1], suite.firstChild);
      }
      if (!suite.children.length || !items().length) return null;
      return suite;
    }

    var pages = [];
    var rang = 0;
    while (file.length) {
      var entree = rang === 0
        ? { boite: boite, feuille: feuille, flux: flux }
        : nouvellePage();
      pages.push(entree);
      var poses = 0;
      while (file.length) {
        var node = file[0];
        /* La première page **est** le flux : ses nœuds y sont déjà à leur
           place, il suffit de les mesurer. Les pages suivantes, elles,
           reçoivent les nœuds du début à la fin. */
        if (rang > 0) entree.flux.appendChild(node);
        file.shift();
        poses += 1;
        /* Un saut de page posé par l'auteur ferme la page, quoi qu'il arrive. */
        if (estSautDePage(node)) break;
        if (!tient(entree, node)) {
          if (poses === 1) break;   /* un bloc plus haut qu'une page : il déborde */
          var reste = decouper(entree, node);
          if (reste) {
            file.unshift(reste);
          } else {
            entree.flux.removeChild(node);
            file.unshift(node);
          }
          /* Un titre ne reste pas orphelin en bas de page : il suit son texte.
             Une page garde toujours au moins un bloc, sans quoi elle serait
             blanche. */
          var dernier = entree.flux.lastElementChild;
          while (dernier && estTitre(dernier) && entree.flux.children.length > 1) {
            entree.flux.removeChild(dernier);
            file.unshift(dernier);
            dernier = entree.flux.lastElementChild;
          }
          break;
        }
      }
      /* Un saut de page en tête de page ne produirait qu'une feuille blanche. */
      while (file.length && estSautDePage(file[0])) {
        var saut = file.shift();
        if (saut.parentNode) saut.parentNode.removeChild(saut);
      }
      /* Un blanc de fin n'ouvre pas de page. Un nœud reporté de la page
         précédente est détaché : il n'a plus de place à mesurer, et c'est sa
         place qui l'attend, pas un abandon — il part donc sur la page suivante. */
      while (file.length && file[0].parentNode && estVide(file[0])) {
        var vide = file.shift();
        vide.parentNode.removeChild(vide);
      }
      rang += 1;
      if (!poses) break;
    }

    /* Pied de page et numérotation, sur chaque feuille. */
    pages.forEach(function (entree, index) {
      if (!modele) return;
      var piedPage = modele.cloneNode(true);
      var numero = piedPage.querySelector(".page-number");
      if (numero) numero.textContent = String(index + 1);
      var total = piedPage.querySelector(".page-total");
      if (total) total.textContent = String(pages.length);
      entree.flux.appendChild(piedPage);
    });

    /* Le nombre de pages est annoncé à la page qui accueille l'aperçu. */
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "perchance-doc-pages", pages: pages.length }, "*");
      }
    } catch (erreur) { /* un aperçu n'a pas toujours de page parente */ }

    return pages.length;
  }

  /* La pagination est exposée : l'aperçu d'un document replié (vue
     « Rédaction ») n'a pas de hauteur, et se pagine quand la vue « Résultat »
     l'affiche. */
  window.__paginer = function () {
    var total = paginer();
    if (total) window.__docPages = total;
    return total;
  };

  function lancer() {
    var total = 0;
    try { total = paginer(); } catch (erreur) { total = 0; }
    window.__docReady = true;
    /* Un second appel ne pagine plus (le découpage est déjà fait) : il renvoie
       zéro, et ne doit pas effacer le nombre de pages déjà annoncé. */
    if (total) window.__docPages = total;
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(lancer, lancer);
  }
  if (document.readyState === "complete") lancer();
  else window.addEventListener("load", lancer);
})();
<\/script>`;
