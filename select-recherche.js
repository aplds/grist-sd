// Recherche dans les listes déroulantes — EX-061 (voir SPEC § 8.28).
//
// Les listes de l'outil — personnes, affaires, sections, membres, trames —
// comptent des dizaines, parfois des centaines de valeurs. Un `<select>` natif
// les présente en vrac : pour trouver « Durand », il faut dérouler cent lignes
// à l'œil. Ce module ajoute donc une **recherche** au menu déroulant : on tape
// quelques lettres, la liste se réduit, on choisit.
//
// Le `<select>` d'origine n'est ni remplacé ni retiré : il est **masqué** et
// reste la source de la valeur. C'est lui qui garde l'`id`, les `data-*` et ses
// `<option>`s ; choisir une entrée lui donne sa valeur puis lui envoie un
// événement `change`, exactement comme un choix natif. Rien de ce qui lit un
// menu déroulant de l'outil — `data-bind`, `data-filter`, `data-action`, les
// lectures par `id` — n'a donc à connaître ce module.
//
// La liste des propositions est déposée dans le `<body>`, en position fixe :
// beaucoup de ces menus vivent dans une fenêtre modale dont le corps défile
// (`.app-dialog__body`), et une liste posée dans le corps serait rognée par lui
// dès la troisième ligne.
//
// Le module est **silencieux** : un menu qui ne porte pas assez de valeurs
// garde son aspect natif (`SEUIL_RECHERCHE`), et `data-recherche="non"`
// l'exempte explicitement — la recherche est un ajout, jamais une contrainte.

import { esc } from "./ui.js";

/** Nombre de valeurs au-delà duquel la recherche s'ajoute d'elle-même. */
export const SEUIL_RECHERCHE = 12;

/**
 * Nombre de propositions peintes au plus. Au-delà, la liste dirait seulement
 * « trop de valeurs » : on en montre une longueur utile, et l'invitation à
 * préciser la recherche (voir `peindre`).
 */
export const MAX_PROPOSITIONS = 200;

/* Place de la liste déroulée : largeur minimale — sous laquelle un libellé
   d'affaire ne se lit plus —, hauteur maximale, et marge gardée avec les bords
   de la fenêtre. */
const LARGEUR_MIN = 260;
const HAUTEUR_MAX = 400;
const MARGE = 8;

/** Une découpe que l'on accepte comme début de mot, pour classer les réponses. */
const SEPARATEURS = " -'’(.";

/**
 * Plie un texte pour la comparaison : minuscules, sans accent, espaces
 * réduits. « Élève  DUPONT » et « eleve dupont » se rejoignent donc, ce que
 * n'aurait pas fait une simple recherche sur la casse.
 */
export function plier(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Rang d'un libellé plié : 0 commence par, 1 commence un mot, 2 contient, -1 ne correspond pas. */
function rangPlie(norm, requete) {
  if (!requete) return 0;
  const i = norm.indexOf(requete);
  if (i < 0) return -1;
  if (i === 0) return 0;
  return SEPARATEURS.includes(norm[i - 1]) ? 1 : 2;
}

/**
 * Rang d'une entrée **sans valeur** : elle se range à la place que le menu lui
 * donne tant qu'aucune recherche n'est en cours, et **en dernier** dès que
 * l'on cherche quelque chose. Sans cela, elle serait la première proposition de
 * toute recherche : taper « ordonnance » puis valider aurait remis le filtre à
 * vide, au lieu de retenir la trame que l'on venait de désigner.
 */
const RANG_VIDE = 3;

/**
 * Les entrées qui répondent à la requête : toutes, **dans l'ordre du menu**,
 * quand la requête est vide ; les plus proches d'abord sinon. À rang égal,
 * l'ordre du menu est conservé (le tri est stable) : deux homonymes restent
 * dans l'ordre où l'établissement les a saisis, et la liste ne se réorganise
 * pas sous les yeux au fil des lettres.
 *
 * Une entrée **sans valeur** — le « — » d'un champ facultatif, le « Toutes les
 * sections » d'un filtre — n'est jamais écartée : elle porte le retour à vide,
 * et doit rester à portée quel que soit ce qui est tapé.
 *
 * `options` : `{ valeur, libelle, vide }[]`.
 */
export function filtrerOptions(options, requete) {
  const q = plier(requete);
  const gardees = [];
  options.forEach((option, rangMenu) => {
    if (option.vide) {
      gardees.push({ option, rangMenu, rang: q ? RANG_VIDE : 0 });
      return;
    }
    const rang = rangPlie(plier(option.libelle), q);
    if (rang < 0) return;
    gardees.push({ option, rangMenu, rang });
  });
  if (q) gardees.sort((a, b) => (a.rang - b.rang) || (a.rangMenu - b.rangMenu));
  return gardees;
}

/**
 * Le libellé d'une option avec la partie trouvée mise en évidence.
 *
 * La comparaison se fait sur le texte **plié** ; le repère n'est donc posé que
 * si les deux textes ont la même longueur — un accent replié disparaît de la
 * même façon des deux côtés, si bien que les positions se correspondent. Dans
 * le cas contraire (une ligature, un caractère rare), le libellé est rendu
 * tel quel plutôt que surligné de travers.
 */
function surligner(libelle, requete) {
  const q = plier(requete);
  if (!q) return esc(libelle);
  const norm = plier(libelle);
  if (norm.length !== String(libelle).length) return esc(libelle);
  const i = norm.indexOf(q);
  if (i < 0) return esc(libelle);
  return esc(libelle.slice(0, i))
    + `<mark class="app-combobox-liste__trouve">${esc(libelle.slice(i, i + q.length))}</mark>`
    + esc(libelle.slice(i + q.length));
}

/** Échappe un identifiant pour un sélecteur d'attribut. */
function sel(valeur) {
  const v = String(valeur);
  return (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(v) : v.replace(/["\\]/g, "\\$&");
}

let compteur = 0;
let globalArme = false;

/** Les menus actuellement déroulés, pour les refermer d'un clic ailleurs. */
const ouverts = new Set();

/**
 * Enrichit tous les menus déroulants de la racine donnée. À appeler après
 * chaque rendu : la page est reconstruite d'un bout à l'autre, et les menus
 * avec elle. Un rendu retire aussi les listes déposées dans le `<body>`, qui
 * désigneraient sans cela des champs qui n'existent plus.
 */
export function monterSelectsRecherche(racine = document) {
  armerGlobal();
  deposerListes();
  for (const select of racine.querySelectorAll("select.fr-select")) {
    try {
      monterUn(select);
    } catch (err) {
      // Un menu qui n'a pas pu être enrichi garde son aspect natif : c'est
      // préférable à un rendu interrompu par un seul champ.
      console.error("Recherche dans un menu :", err);
    }
  }
}

/** Retire les listes déposées dans le `<body>` et oublie les menus ouverts. */
function deposerListes() {
  ouverts.clear();
  for (const liste of document.querySelectorAll(".app-combobox-portail")) liste.remove();
}

/** Un seul écouteur de document, quel que soit le nombre de menus montés. */
function armerGlobal() {
  if (globalArme) return;
  globalArme = true;
  // Un clic hors du menu referme la liste. En phase de capture, et sur
  // `pointerdown` : la liste doit être refermée **avant** que le clic n'atteigne
  // son but, sans quoi elle recouvrirait encore ce que l'on vient de cliquer.
  document.addEventListener("pointerdown", (event) => {
    for (const menu of [...ouverts]) if (!menu.contient(event.target)) menu.fermer();
  }, true);
  // La page défile, la fenêtre change de taille : la liste, posée en
  // `position: fixed`, doit suivre le champ qu'elle complète. Le nœud dont
  // vient le défilement est transmis : la liste ignore ses propres
  // défilements, qui ne déplacent pas le champ (voir `placer`).
  const replacer = (event) => {
    for (const menu of ouverts) menu.placer(event.target);
  };
  window.addEventListener("resize", replacer);
  window.addEventListener("scroll", replacer, true);
}

function monterUn(select) {
  if (!select || select.dataset.recherche === "non") return;
  if (select.multiple) return;
  if (select.dataset.rechercheMontee === "1") return;

  // Le seuil se lit avant de construire quoi que ce soit : une liste de trois
  // valeurs — un état, une voie — n'a pas besoin de recherche, et un tableau
  // qui en compte cinquante lignes n'a pas à payer leur relecture à chaque rendu.
  const vide = (o) => o.value === "";
  let nombre = 0;
  for (const o of select.options) if (!vide(o)) nombre += 1;
  if (!select.dataset.recherche && nombre <= SEUIL_RECHERCHE) return;
  if (nombre < 2) return;

  const options = [...select.options].map((o) => ({
    valeur: o.value,
    libelle: String(o.textContent || "").trim(),
    vide: vide(o),
    // Le groupe du menu natif (`<optgroup>`) est retenu : la liste ouverte ne
    // montre que des libellés, et un nom ne dit pas de quel collège relève
    // celui qui le porte. Elle redit donc les groupes que le `<select>` natif
    // séparait (voir `intervenantSourceSelect`, `views/affaires.js`).
    groupe: o.parentElement && o.parentElement.tagName === "OPTGROUP"
      ? String(o.parentElement.label || "").trim() : "",
  }));

  const id = select.id || `menu-recherche-${++compteur}`;
  if (!select.id) select.id = id;
  const champId = `${id}-recherche`;
  const listeId = `${id}-liste`;

  // Le libellé du champ désigne le contrôle que l'on voit, non le menu masqué :
  // c'est lui que l'on clique et que le lecteur d'écran doit nommer.
  const groupe = select.closest(".fr-select-group") || select.parentElement;
  const label = groupe ? groupe.querySelector(`label[for="${sel(id)}"]`) : null;
  if (label) label.htmlFor = champId;

  const boite = document.createElement("div");
  boite.className = "app-combobox";
  boite.setAttribute("data-combobox", id);

  const champ = document.createElement("input");
  champ.type = "text";
  champ.className = "fr-input app-combobox__champ";
  champ.id = champId;
  champ.setAttribute("role", "combobox");
  champ.setAttribute("aria-expanded", "false");
  champ.setAttribute("aria-controls", listeId);
  champ.setAttribute("aria-autocomplete", "list");
  champ.setAttribute("autocomplete", "off");
  champ.setAttribute("spellcheck", "false");
  const choixVide = options.find((o) => o.vide);
  const marqueVide = /^[—–-]+$/.test(String(choixVide && choixVide.libelle || "").trim());
  champ.setAttribute("placeholder", choixVide && choixVide.libelle && !marqueVide
    ? choixVide.libelle : "Rechercher…");
  if (!label) {
    const nom = select.getAttribute("aria-label") || "";
    if (nom) champ.setAttribute("aria-label", nom);
  }
  const decrit = select.getAttribute("aria-describedby");
  if (decrit) champ.setAttribute("aria-describedby", decrit);

  const chevron = document.createElement("button");
  chevron.type = "button";
  chevron.className = "app-combobox__chevron";
  // Hors du parcours de tabulation : le champ ouvre la liste à lui seul
  // (flèche bas, ou `Entrée`), et un second arrêt par champ encombrerait les
  // formulaires. Le bouton reste nommé, pour qui le rencontre à la souris ou
  // avec un lecteur d'écran.
  chevron.tabIndex = -1;
  chevron.setAttribute("aria-label", "Ouvrir la liste");
  chevron.title = "Ouvrir la liste";
  const fleche = document.createElement("span");
  fleche.className = "app-combobox__fleche";
  chevron.appendChild(fleche);

  // Le compte des propositions est annoncé aux lecteurs d'écran : sans lui, une
  // frappe qui ne laisse aucune réponse ne dirait rien du tout.
  const annonce = document.createElement("p");
  annonce.className = "app-combobox__annonce fr-sr-only";
  annonce.setAttribute("role", "status");

  boite.append(champ, chevron, annonce);
  // Le contrôle visible se pose **devant** le menu masqué : le premier élément
  // de saisie du groupe reste celui que l'on voit, y compris pour le focus
  // d'ouverture d'une fenêtre modale et pour la mesure d'alignement des champs.
  select.parentNode.insertBefore(boite, select);
  select.hidden = true;
  select.dataset.rechercheMontee = "1";

  // Le rôle en lecture seule neutralise le menu natif (`applyReadOnly`) : le
  // champ de recherche qui le remplace doit l'être aussi, sans quoi la
  // consultation seule pourrait écrire par cette porte.
  if (select.disabled) {
    champ.disabled = true;
    chevron.disabled = true;
    boite.classList.add("app-combobox--desactive");
  }
  const titre = select.getAttribute("title");
  if (titre) champ.setAttribute("title", titre);

  let portail = null;
  let listeEl = null;
  let noteEl = null;
  let propositions = [];
  let actif = -1;
  /** Les `<li>` de proposition peints — sans les intertitres de collège. */
  let lignesPeintes = [];

  const libelleChoisi = () => {
    const o = options.find((x) => x.valeur === select.value);
    // Une valeur vide se dit par le texte d'invite du champ, non par un « — »
    // posé dans un champ où l'on s'apprête à taper.
    return o && !o.vide ? o.libelle : "";
  };

  /** Le champ rappelle la valeur retenue — après une recherche abandonnée. */
  function rappeler() {
    champ.value = libelleChoisi();
  }

  // Le champ montre la valeur retenue, exactement comme le menu qu'il remplace :
  // un filtre actif doit rester lisible. Un clic le sélectionne en entier, si
  // bien que la première lettre tapée remplace ce libellé.
  rappeler();

  /** Ce que l'écouteur global connaît d'un menu : s'il contient un nœud, et comment le refermer. */
  const controleur = {
    contient: (noeud) => boite.contains(noeud) || !!(portail && portail.contains(noeud)),
    fermer,
    placer,
  };

  function construirePortail() {
    portail = document.createElement("div");
    portail.className = "app-combobox-portail";
    portail.innerHTML = `<ul class="app-combobox-liste" id="${esc(listeId)}" role="listbox"></ul>`
      + `<p class="app-combobox-liste__note" hidden></p>`;
    listeEl = portail.querySelector(".app-combobox-liste");
    noteEl = portail.querySelector(".app-combobox-liste__note");
    document.body.appendChild(portail);
    // Le focus reste au champ : sans cela, cliquer une proposition le retirerait,
    // et le `blur` refermerait la liste avant même que le clic ne la choisisse.
    portail.addEventListener("pointerdown", (event) => event.preventDefault());
    portail.addEventListener("click", (event) => {
      const ligne = event.target.closest(".app-combobox-liste__entree");
      if (ligne) choisir(ligne.dataset.rang);
    });
  }

  function ligne(entree, requete) {
    const choisi = entree.option.valeur === select.value;
    const classes = "app-combobox-liste__entree"
      + (entree.option.vide ? " app-combobox-liste__entree--vide" : "");
    // Le collège est porté par le libellé **annoncé** : l'intertitre qui le
    // précède à l'écran n'est pas lu avec la proposition que l'on parcourt au
    // clavier, et c'est pourtant l'information qui manque à qui ne connaît pas
    // la personne.
    const annonce = entree.option.groupe
      ? ` aria-label="${esc(`${entree.option.libelle} — ${entree.option.groupe}`)}"`
      : "";
    return `<li class="${classes}" role="option" id="${esc(listeId)}-${entree.rangMenu}"${annonce}`
      + ` data-rang="${entree.rangMenu}" aria-selected="${choisi ? "true" : "false"}">`
      + `${surligner(entree.option.libelle, requete)}</li>`;
  }

  /**
   * Peint la liste : les propositions, précédées de l'intertitre de leur
   * **groupe** (le collège) quand il change de l'une à l'autre.
   *
   * Les propositions se classent par proximité avec la recherche : les groupes
   * se suivent donc dans l'ordre où elles tombent, et l'intertitre s'écrit à
   * chaque fois que le groupe change — un collège qui revient plus bas dans la
   * liste se redit, faute de quoi le lecteur le rapporterait au précédent.
   */
  function peindre() {
    const requete = champ.value;
    const coupees = propositions.length > MAX_PROPOSITIONS;
    const visibles = coupees ? propositions.slice(0, MAX_PROPOSITIONS) : propositions;
    const morceaux = [];
    let groupeCourant = "";
    for (const entree of visibles) {
      const groupe = entree.option.groupe;
      if (groupe && groupe !== groupeCourant) {
        morceaux.push(`<li class="app-combobox-liste__groupe" role="presentation">${esc(groupe)}</li>`);
      }
      groupeCourant = groupe;
      morceaux.push(ligne(entree, requete));
    }
    listeEl.innerHTML = morceaux.join("");
    lignesPeintes = [...listeEl.querySelectorAll(".app-combobox-liste__entree")];
    const demande = requete.trim();
    // L'entrée sans valeur reste proposée quoi qu'il arrive : elle porte le
    // retour à vide. Le compte qui décide de ce que l'on dit, lui, ne retient
    // que les valeurs réelles — annoncer « 1 valeur » pour la seule remise à
    // zéro ferait croire à une réponse qui n'existe pas.
    const reelles = propositions.filter((e) => !e.option.vide).length;
    if (!visibles.length) {
      noteEl.hidden = false;
      noteEl.textContent = "Aucune valeur.";
    } else if (demande && !reelles) {
      noteEl.hidden = false;
      noteEl.textContent = `Aucune valeur ne contient « ${demande} ».`;
    } else if (coupees) {
      noteEl.hidden = false;
      noteEl.textContent = `${reelles} valeurs correspondent : précisez la recherche.`;
    } else {
      noteEl.hidden = true;
      noteEl.textContent = "";
    }
    majActif();
    const compte = `${reelles} valeur${reelles > 1 ? "s" : ""}`;
    annonce.textContent = !demande
      ? (reelles ? compte : "Aucune valeur")
      : (reelles ? `${compte} pour « ${demande} »` : "Aucun résultat");
  }

  /** Désigne l'entrée active : la marque, le défilement, et l'annonce au lecteur d'écran. */
  function majActif() {
    // Seules les propositions comptent : la liste mêle aussi les intertitres
    // de collège, qui ne se désignent ni ne se choisissent.
    lignesPeintes.forEach((l, i) => l.classList.toggle("is-actif", i === actif));
    const cible = lignesPeintes[actif];
    if (cible) {
      champ.setAttribute("aria-activedescendant", cible.id);
      cible.scrollIntoView({ block: "nearest" });
    } else {
      champ.removeAttribute("aria-activedescendant");
    }
  }

  /**
   * Place la liste sous le champ — ou au-dessus, quand la place manque dessous.
   *
   * `origine` : le nœud dont le défilement a demandé ce replacement. Un
   * défilement **dans** la liste ne déplace pas le champ : la replacer serait
   * inutile, et la mesure de hauteur naturelle qu'elle fait remettrait la liste
   * en haut (voir ci-dessous).
   */
  function placer(origine) {
    if (!portail || portail.hidden) return;
    if (origine && origine.nodeType === 1 && portail.contains(origine)) return;
    const r = champ.getBoundingClientRect();
    // Hauteur naturelle du contenu (sans plafond), puis place réellement
    // disponible au-dessus et au-dessous du champ.
    //
    // Elle se lit sur le contenu lui-même, **sans relâcher le plafond** : la
    // mesurer en posant `max-height: none` laissait la boîte grandir d'un coup
    // jusqu'à son contenu entier, et le navigateur ramenait alors `scrollTop` à
    // zéro. Comme chaque cran de molette, chaque pas de défilement tactile et
    // chaque `scrollIntoView` produisent un `scroll` — donc un replacement —
    // la liste était **impossible à faire défiler** : elle revenait au premier
    // élément à chaque geste.
    const bordures = portail.offsetHeight - portail.clientHeight;
    const hauteurNote = noteEl && !noteEl.hidden ? noteEl.offsetHeight : 0;
    const naturelle = listeEl.scrollHeight + hauteurNote + bordures;
    const dessous = window.innerHeight - r.bottom - MARGE;
    const dessus = r.top - MARGE;
    const auDessus = dessous < Math.min(naturelle, 160) && dessus > dessous;
    const place = Math.max(120, Math.min(auDessus ? dessus : dessous, HAUTEUR_MAX));
    const hauteur = Math.min(naturelle, place);
    const largeur = Math.max(r.width, LARGEUR_MIN);
    // La liste reste dans la fenêtre : un champ près d'un bord ne doit pas
    // repousser sa propre liste hors de l'écran.
    const haut = Math.max(MARGE, Math.min(
      auDessus ? r.top - 2 - hauteur : r.bottom + 2,
      Math.max(MARGE, window.innerHeight - hauteur - MARGE),
    ));
    const gauche = Math.min(Math.max(MARGE, r.left), Math.max(MARGE, window.innerWidth - largeur - MARGE));
    portail.style.left = `${gauche}px`;
    portail.style.width = `${largeur}px`;
    portail.style.top = `${haut}px`;
    portail.style.bottom = "auto";
    portail.style.maxHeight = `${place}px`;
  }

  function ouvrir({ clair = false } = {}) {
    if (champ.disabled) return;
    // Le champ montre la valeur retenue : l'ouvrir la retire du champ, pour que
    // la liste s'ouvre **entière** (le libellé retenu y est désigné, et au
    // besoin ramené dans la vue) plutôt que filtrée par elle-même. Le libellé
    // revient si l'on referme sans rien choisir.
    if (clair) champ.value = "";
    if (!portail) construirePortail();
    portail.hidden = false;
    boite.classList.add("is-open");
    champ.setAttribute("aria-expanded", "true");
    ouverts.add(controleur);
    propositions = filtrerOptions(options, champ.value);
    // Sans recherche en cours, c'est la valeur retenue qui est désignée : on
    // ouvre sur elle, et la liste défile jusqu'à elle. Dès qu'une lettre est
    // tapée, la proposition la plus proche prend la main.
    const choisi = propositions.findIndex((e) => e.option.valeur === select.value);
    actif = champ.value.trim()
      ? (propositions.length ? 0 : -1)
      : (choisi >= 0 ? choisi : (propositions.length ? 0 : -1));
    // La liste est réutilisée d'une ouverture à l'autre : elle s'ouvre en haut,
    // et c'est la proposition désignée qui amène la vue à elle (`majActif`).
    listeEl.scrollTop = 0;
    peindre();
    placer();
  }

  function fermer() {
    if (portail && !portail.hidden) portail.hidden = true;
    boite.classList.remove("is-open");
    champ.setAttribute("aria-expanded", "false");
    champ.removeAttribute("aria-activedescendant");
    ouverts.delete(controleur);
    rappeler();
  }

  function deplacer(pas) {
    const total = propositions.length;
    if (!total) return;
    if (actif < 0) actif = pas > 0 ? 0 : total - 1;
    else actif = (actif + pas + total) % total;
    majActif();
  }

  /** Retient une proposition : le menu natif reçoit sa valeur, puis son `change`. */
  function choisir(rang) {
    const entree = propositions.find((e) => e.rangMenu === Number(rang));
    if (!entree) return;
    select.value = entree.option.valeur;
    fermer();
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  champ.addEventListener("click", () => ouvrir({ clair: true }));
  champ.addEventListener("input", () => ouvrir());
  champ.addEventListener("blur", () => fermer());

  champ.addEventListener("keydown", (event) => {
    if (champ.disabled) return;
    const deroule = !!portail && !portail.hidden;
    // Une touche qui modifierait le libellé retenu le remplace : sans cela, la
    // première lettre s'ajouterait à lui — « Durand » deviendrait « xDurand » —
    // alors qu'un menu natif repart, lui, de zéro.
    if (!deroule && champ.value && champ.value === libelleChoisi()
      && (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete")) {
      champ.value = "";
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (deroule) deplacer(1); else ouvrir({ clair: true });
        break;
      case "ArrowUp":
        event.preventDefault();
        if (deroule) deplacer(-1); else ouvrir({ clair: true });
        break;
      case "Home":
      case "End":
        if (!deroule || !propositions.length) return;
        event.preventDefault();
        actif = event.key === "Home" ? 0 : propositions.length - 1;
        majActif();
        break;
      case "PageDown":
      case "PageUp": {
        if (!deroule || !propositions.length) return;
        event.preventDefault();
        const pas = event.key === "PageDown" ? 10 : -10;
        actif = Math.max(0, Math.min(propositions.length - 1, actif + pas));
        majActif();
        break;
      }
      case "Enter":
        // La touche a toujours un sens ici : ouvrir, ou valider la proposition
        // désignée. Sans cela, dans un formulaire, elle enverrait le formulaire.
        event.preventDefault();
        if (!deroule) ouvrir({ clair: true });
        else if (propositions[actif]) choisir(propositions[actif].rangMenu);
        break;
      case "Escape":
        if (!deroule) return;
        // La fenêtre modale qui porte peut-être ce champ ne doit pas se fermer :
        // c'est la liste que l'on referme, et l'événement ne remonte pas jusqu'à
        // elle (voir `onKeydown`, app.js).
        event.preventDefault();
        event.stopPropagation();
        fermer();
        break;
      case "Tab":
        // On quitte le champ : la recherche en cours est abandonnée, la valeur
        // retenue revient. La tabulation, elle, suit son cours.
        fermer();
        break;
      default:
        break;
    }
  });

  chevron.addEventListener("pointerdown", (event) => event.preventDefault());
  chevron.addEventListener("click", () => {
    if (champ.disabled) return;
    if (portail && !portail.hidden) {
      fermer();
      return;
    }
    champ.focus({ preventScroll: true });
    ouvrir({ clair: true });
  });
}
