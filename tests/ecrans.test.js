// Test de fumée par écran — NC-0001.
//
// Les invariants de `SPEC.md` § 8 qui tiennent à l'affichage ne se vérifient
// pas sur de la logique pure : ils demandent l'application vivante. Ce module
// fait donc le tour des écrans déclarés par `NAV` et, pour chacun, vérifie
// qu'il rend quelque chose et que rien n'a levé pendant le rendu.
//
// Il s'exécute **dans la page de l'outil** (l'application doit être chargée) :
//
//   const { fumerEcrans } = await import("./tests/ecrans.test.js");
//   await fumerEcrans();
//
// L'appel déplace la page d'un écran à l'autre, puis la ramène à son point de
// départ : c'est un test d'atelier, pas une action de production.

import { NAV } from "../schema.js";
import { poserPanneau } from "../menus.js";
import { mountWysiwyg, paletteHtml } from "../editor.js";

const SELECTEUR_FOCUSABLE = "a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]),"
  + " select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Attend qu'un prédicat soit vrai, en **sondant** plutôt qu'en dormant une durée
 * fixe. Le rendu d'un écran est asynchrone : une attente fixe fait échouer le
 * contrôle selon la charge de l'instant — le formulaire de création n'est pas
 * encore monté, la fenêtre modale pas encore posée. Rend ce que le prédicat a
 * rendu, ou `null` au bout du délai.
 */
async function attendreQue(predicat, { pas = 60, max = 2500 } = {}) {
  for (let ecoule = 0; ecoule < max; ecoule += pas) {
    const vu = predicat();
    if (vu) return vu;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pas));
  }
  return null;
}

/**
 * Attend que l'adresse se **pose** — qu'elle ne bouge plus pendant un instant.
 *
 * L'application normalise la sienne : `#tableau-de-bord` devient
 * `#tableau-de-bord/synthese`. Ce second passage **referme la fenêtre** ouverte
 * par un clic (voir `navTo`, app.js), et il est mis en file par le navigateur :
 * changer l'adresse puis cliquer dans le **même** tour laissait donc le clic
 * sans effet, la fenêtre s'ouvrant puis se refermant aussitôt. Les contrôles qui
 * déplacent la page puis agissent doivent laisser l'adresse se poser d'abord —
 * un utilisateur, lui, ne peut pas cliquer dans le tour même du changement.
 */
async function attendreAdresse({ pas = 100, calme = 300, max = 2500 } = {}) {
  let derniere = location.hash;
  let posee = 0;
  for (let ecoule = 0; ecoule < max; ecoule += pas) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pas));
    if (location.hash === derniere) {
      posee += pas;
      if (posee >= calme) return;
    } else {
      derniere = location.hash;
      posee = 0;
    }
  }
}

/**
 * Les écrans à parcourir : chaque entrée de `NAV`, puis les sous-pages qu'elle
 * déclare. Une sous-page est un écran à part entière — la seconde vue du
 * calendrier, par exemple : ne parcourir que les entrées du menu la laisserait
 * hors de la vérification.
 */
function ecransDeNAV() {
  return NAV.flatMap((n) => [
    { id: n.id, label: n.label },
    ...((n.subs || []).map((s) => ({ id: `${n.id}/${s.id}`, label: `${n.label} › ${s.label}` }))),
  ]);
}

/**
 * Parcourt chaque écran de `NAV` et rend le compte rendu. Un écran qui ne rend
 * rien, ou pendant lequel une erreur est levée, est en échec.
 */
export async function fumerEcrans({ attente = 300 } = {}) {
  const depart = location.hash;
  const erreurs = [];
  const surErreur = (event) => erreurs.push(String(event.message || event.reason || event));
  window.addEventListener("error", surErreur);
  window.addEventListener("unhandledrejection", surErreur);
  const resultats = [];
  try {
    for (const ecran of ecransDeNAV()) {
      const avant = erreurs.length;
      location.hash = `#${ecran.id}`;
      await new Promise((r) => setTimeout(r, attente));
      const app = document.querySelector("#app");
      const texte = app ? app.textContent.trim() : "";
      const banniere = document.querySelectorAll(".fr-alert--error").length;
      const levees = erreurs.slice(avant);
      const ok = texte.length > 20 && !banniere && !levees.length;
      resultats.push({
        ecran: ecran.id,
        label: ecran.label,
        ok,
        caracteres: texte.length,
        bannieresDErreur: banniere,
        erreurs: levees,
      });
    }
  } finally {
    window.removeEventListener("error", surErreur);
    window.removeEventListener("unhandledrejection", surErreur);
    location.hash = depart || "#accueil";
    await new Promise((r) => setTimeout(r, attente));
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    resultats,
  };
}

/**
 * Vérifie le confinement du focus des fenêtres modales (NC-0027) : le fond est
 * neutralisé (`inert`), le focus entre dans la fenêtre, la tabulation y reste
 * (aller-retour), et le focus est rendu au déclencheur à la fermeture.
 *
 *   const { verifierModales } = await import("./tests/ecrans.test.js");
 *   await verifierModales();
 */
export async function verifierModales({ attente = 150 } = {}) {
  const depart = location.hash;
  const resultats = [];
  try {
    // Le déclencheur du formulaire de création vit sur le tableau de bord.
    location.hash = "#tableau-de-bord";
    await attendreAdresse();
    await attendreQue(() => document.querySelector('[data-action="new-affaire"]'));
    for (const action of ["new-affaire"]) {
      const declencheur = document.querySelector(`[data-action="${action}"]`);
      if (!declencheur) {
        resultats.push({ fenetre: action, ok: false, detail: "déclencheur introuvable" });
        continue;
      }
      declencheur.focus();
      declencheur.click();
      await attendreQue(() => document.querySelector("#appModal .app-dialog"));
      await new Promise((r) => setTimeout(r, attente));
      const app = document.getElementById("app");
      const modale = document.querySelector("#appModal .app-dialog");
      const fonds = app ? [...app.children].filter((e) => e.id !== "appModal") : [];
      const fondNeutralise = fonds.length > 0 && fonds.every((e) => e.hasAttribute("inert"));
      const focusDedans = !!modale && modale.contains(document.activeElement);
      const horsFenetre = modale
        ? [...app.querySelectorAll(SELECTEUR_FOCUSABLE)]
          .filter((e) => !modale.contains(e) && !e.closest("[inert]")).length
        : -1;
      // Tabulation : depuis le dernier élément, elle doit revenir au premier.
      let boucle = false;
      if (modale) {
        const f = [...modale.querySelectorAll(SELECTEUR_FOCUSABLE)].filter((e) => e.getClientRects().length > 0);
        if (f.length) {
          f[f.length - 1].focus();
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
          boucle = document.activeElement === f[0];
        }
      }
      const fermer = document.querySelector('#appModal [data-action="close-dialog"]');
      if (fermer) fermer.click();
      await new Promise((r) => setTimeout(r, attente));
      const retour = document.activeElement
        && document.activeElement.getAttribute("data-action") === action;
      resultats.push({
        fenetre: action,
        ok: !!modale && fondNeutralise && focusDedans && horsFenetre === 0 && boucle && !!retour,
        modale: !!modale,
        fondNeutralise,
        focusDedans,
        horsFenetre,
        boucle,
        retour: !!retour,
      });
    }
  } finally {
    location.hash = depart || "#accueil";
    await new Promise((r) => setTimeout(r, attente));
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    resultats,
  };
}

/* ------------------------------------------------------------------ */
/* Alignement des champs d'une ligne (EX-060, SPEC § 8.27)             */
/* ------------------------------------------------------------------ */

/* Tolérance, en pixels, entre deux hauteurs tenues pour égales. */
const TOLERANCE_ALIGNEMENT = 2;

const GROUPE_DE_CHAMPS = ".fr-input-group, .fr-select-group, .fr-checkbox-group";

/* Le contrôle d'un groupe : son champ, ou son cadre en lecture seule. */
function controleDuGroupe(groupe) {
  return groupe.querySelector(".fr-input:not(.app-date__champ), .fr-select, .app-readonly, .app-checklist, textarea")
    || groupe.querySelector(".app-date");
}

/**
 * La « cellule » d'un champ dans une rangée, quand ce n'est pas une colonne de
 * grille : le groupe lui-même, ou l'élément qui le porte **seul** — une barre de
 * filtres enveloppe volontiers la recherche dans son propre bloc (`.app-search`)
 * et laisse les menus dans leur groupe.
 */
function celluleDeChamp(element) {
  if (!element.matches) return null;
  if (element.matches(GROUPE_DE_CHAMPS)) return element;
  const groupes = [...element.querySelectorAll(GROUPE_DE_CHAMPS)];
  return groupes.length === 1 && groupes[0].parentElement === element ? groupes[0] : null;
}

/**
 * Les **barres de champs en ligne** dont les champs ne sont pas alignés.
 *
 * Une barre de filtres n'est pas une grille : ses champs se suivent dans un
 * `flex` qui les renvoie à la ligne quand la place manque. Le parcours des
 * grilles ne les voyait donc pas — et c'est par là que l'écart est passé
 * longtemps : le DSFR pose une marge basse sous tout champ `:not(:last-child)`
 * (pour espacer deux champs **empilés**), et une barre qui aligne ses champs par
 * le bas décollait ainsi tous ses champs **sauf le dernier** de vingt-quatre
 * pixels. Le contrôle est le même qu'en grille : les champs d'une même ligne
 * visuelle — ceux dont les contrôles se recouvrent — présentent leur libellé et
 * leur contrôle à la même hauteur.
 */
function ecartsDesBarres(racine) {
  const ecarts = [];
  let bandesMesurees = 0;
  for (const conteneur of racine.querySelectorAll("div, form, section, fieldset, aside")) {
    if (conteneur.closest("#appModal") || conteneur.matches(".fr-grid-row")) continue;
    const champs = [...conteneur.children].map(celluleDeChamp).map((groupe) => {
      if (!groupe) return null;
      const controle = controleDuGroupe(groupe);
      const libelle = groupe.querySelector(".fr-label");
      if (!controle || !libelle) return null;
      const rect = controle.getBoundingClientRect();
      return {
        titre: String(libelle.textContent).trim().split("\n")[0].slice(0, 24),
        hautLibelle: Math.round(libelle.getBoundingClientRect().top),
        hautControle: Math.round(rect.top),
        basControle: Math.round(rect.bottom),
      };
    }).filter(Boolean);
    if (champs.length < 2) continue;
    const bandes = [];
    for (const champ of champs) {
      const bande = bandes.find((b) => Math.min(b.bas, champ.basControle) - Math.max(b.haut, champ.hautControle) > 4);
      if (bande) {
        bande.membres.push(champ);
        bande.haut = Math.min(bande.haut, champ.hautControle);
        bande.bas = Math.max(bande.bas, champ.basControle);
      } else {
        bandes.push({ haut: champ.hautControle, bas: champ.basControle, membres: [champ] });
      }
    }
    for (const bande of bandes) {
      if (bande.membres.length < 2) continue;
      bandesMesurees += 1;
      const controles = bande.membres.map((m) => m.hautControle);
      const libelles = bande.membres.map((m) => m.hautLibelle);
      const ecart = Math.max(...controles) - Math.min(...controles);
      const ecartLibelle = Math.max(...libelles) - Math.min(...libelles);
      if (ecart > TOLERANCE_ALIGNEMENT || ecartLibelle > TOLERANCE_ALIGNEMENT) {
        ecarts.push({ champs: bande.membres.map((m) => m.titre), ecart, ecartLibelle });
      }
    }
  }
  return { ecarts, bandesMesurees };
}

/**
 * Les lignes de champs dont les contrôles ne sont pas alignés.
 *
 * Deux formes de lignes sont mesurées : les **grilles** du DSFR (des colonnes
 * `fr-col-*` dans un `fr-grid-row`) et les **barres** dont les champs se suivent
 * dans un `flex` — une barre de filtres, par exemple. Dans les deux cas, les
 * champs d'une même **ligne visuelle** (une ligne qui se replie en compte
 * plusieurs) doivent présenter leur libellé et leur contrôle à la même hauteur.
 * Deux écarts sont relevés : celui des contrôles et celui des libellés — un
 * libellé décalé décale aussi la case qui le suit.
 *
 * Renvoie les écarts, et le nombre de **bandes mesurées** — les lignes qui
 * portent au moins deux champs. Un écran sans bande n'a rien à vérifier : le
 * compte le dit, sans le confondre avec un écran conforme.
 */
function ecartsDAlignement(racine) {
  const ecarts = [];
  let bandesMesurees = 0;
  for (const ligne of racine.querySelectorAll(".fr-grid-row")) {
    const colonnes = [...ligne.children].filter((c) => c.matches('[class*="fr-col-"]'));
    if (colonnes.length < 2) continue;
    const mesures = colonnes.map((colonne) => {
      const groupe = colonne.querySelector(GROUPE_DE_CHAMPS);
      if (!groupe) return null;
      const controle = controleDuGroupe(groupe);
      if (!controle) return null;
      const libelle = groupe.querySelector(".fr-label");
      return {
        titre: (libelle ? String(libelle.textContent).trim().split("\n")[0] : "").slice(0, 24),
        hautColonne: Math.round(colonne.getBoundingClientRect().top),
        hautLibelle: libelle ? Math.round(libelle.getBoundingClientRect().top) : null,
        hautControle: Math.round(controle.getBoundingClientRect().top),
      };
    }).filter(Boolean);
    if (mesures.length < 2) continue;
    const bandes = new Map();
    for (const mesure of mesures) {
      const cle = [...bandes.keys()].find((k) => Math.abs(k - mesure.hautColonne) <= 4) ?? mesure.hautColonne;
      if (!bandes.has(cle)) bandes.set(cle, []);
      bandes.get(cle).push(mesure);
    }
    for (const bande of bandes.values()) {
      if (bande.length < 2) continue;
      bandesMesurees += 1;
      const hauts = bande.map((m) => m.hautControle);
      const libelles = bande.map((m) => m.hautLibelle).filter((h) => h !== null);
      const ecart = Math.max(...hauts) - Math.min(...hauts);
      const ecartLibelle = libelles.length > 1 ? Math.max(...libelles) - Math.min(...libelles) : 0;
      if (ecart > TOLERANCE_ALIGNEMENT || ecartLibelle > TOLERANCE_ALIGNEMENT) {
        ecarts.push({ champs: bande.map((m) => m.titre), ecart, ecartLibelle });
      }
    }
  }
  const barres = ecartsDesBarres(racine);
  const actions = ecartsDActions(racine);
  return {
    ecarts: [...ecarts, ...barres.ecarts, ...actions.ecarts],
    bandesMesurees: bandesMesurees + barres.bandesMesurees + actions.bandesMesurees,
  };
}

/**
 * Les **actions de bloc** dont le bord droit n'est pas celui de leur conteneur.
 *
 * C'est le défaut signalé sur la fiche d'une affaire : le bouton « Modifier »
 * du bloc « Dossier de pièces » — un bloc **repliable**, dont l'en-tête porte un
 * repère `+`/`–` de plus que les autres — se rangeait au milieu de la ligne
 * quand les blocs voisins le portaient au bord droit, et les boutons d'une même
 * fiche ne se répondaient plus verticalement. Sont mesurées les actions des
 * **blocs** (`.app-fieldset__actions` : les blocs d'une fiche) et celles des
 * **panneaux** (`.fr-panel__actions`), groupées par **conteneur** : des blocs
 * voisins, de même largeur, doivent poser leur bouton sur le même bord droit.
 *
 * Une **bande** est un conteneur qui porte au moins deux actions à comparer —
 * un conteneur qui n'en porte qu'une n'a rien à quoi s'aligner, et le compte
 * des bandes le dit, sans le confondre avec un conteneur conforme.
 */
function ecartsDActions(racine) {
  const groupes = new Map();
  for (const zone of racine.querySelectorAll(".app-fieldset__actions, .fr-panel__actions")) {
    const bloc = zone.closest(".app-fieldset, .fr-panel");
    const bouton = zone.querySelector(".fr-btn");
    if (!bloc || !bouton || !bloc.parentElement) continue;
    const cle = bloc.parentElement;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push({
      titre: String(bouton.textContent).trim().slice(0, 20),
      droite: Math.round(bouton.getBoundingClientRect().right),
    });
  }
  const ecarts = [];
  let bandesMesurees = 0;
  for (const actions of groupes.values()) {
    if (actions.length < 2) continue;
    bandesMesurees += 1;
    const droites = actions.map((a) => a.droite);
    const ecart = Math.max(...droites) - Math.min(...droites);
    if (ecart > TOLERANCE_ALIGNEMENT) {
      ecarts.push({ champs: actions.map((a) => a.titre), ecart, ecartLibelle: 0 });
    }
  }
  return { ecarts, bandesMesurees };
}

/**
 * Les adresses des **fiches** — celles qui portent les grandes grilles de
 * champs : l'espace d'un document, l'atelier d'une décision, la fiche d'une
 * trame, celle d'un format. Les écrans de `NAV` ne montrent que des listes :
 * sans elles, les grilles qui comptent ne seraient pas mesurées.
 *
 * Les documents sont pris **un par trame**, seize au plus : c'est la trame qui
 * décide des champs que l'espace de rédaction réclame — deux documents de même
 * trame montrent la même grille, et couvrir les trames, c'est couvrir les
 * formes sans refaire vingt fois la même mesure.
 *
 * Les identifiants viennent de la base vivante (`window.appStore`, posée par
 * l'application). Sans elle — la page de tests ouverte seule —, la liste est
 * vide, et le parcours se réduit aux écrans de `NAV`.
 */
function adressesDeFiches() {
  const s = globalThis.appStore;
  if (!s || typeof s.table !== "function") return [];
  const table = (nom) => { try { return s.table(nom) || []; } catch { return []; } };
  const premiers = (nom, n) => table(nom).slice(0, n).map((r) => r.id);
  const parTrame = new Map();
  for (const doc of table("Generateur")) {
    const trame = String(doc.Template ?? "");
    if (!parTrame.has(trame)) parTrame.set(trame, doc.id);
  }
  return [
    ...[...parTrame.values()].slice(0, 16).map((id) => `documents/${id}`),
    ...premiers("Decisions", 3).map((id) => `decisions/${id}`),
    ...premiers("Trames", 2).map((id) => `reglages/trames/${id}`),
    ...premiers("Types_Trames", 2).map((id) => `reglages/types/${id}`),
  ];
}

/**
 * Vérifie, écran par écran, que les champs d'une même ligne sont alignés.
 *
 * Le parcours reprend celui du test de fumée, en y ajoutant les sous-pages de
 * Réglages et les fiches (`adressesDeFiches`) : ce sont les écrans qui portent
 * le plus de grilles de champs. Les blocs repliables sont ouverts avant la
 * mesure — un contenu replié n'est pas rendu, et sa mesure ne vaudrait rien.
 *
 *   const { verifierAlignement } = await import("./tests/ecrans.test.js");
 *   await verifierAlignement();
 */
export async function verifierAlignement({ attente = 320 } = {}) {
  const depart = location.hash;
  const ecrans = [
    ...ecransDeNAV().map((e) => e.id),
    ...adressesDeFiches(),
  ];
  const resultats = [];
  try {
    for (const ecran of ecrans) {
      location.hash = `#${ecran}`;
      await new Promise((r) => setTimeout(r, attente));
      // Un outil replié (`outils` de `views/common.js`) n'est pas rendu du tout :
      // ses champs ne sont pas dans le document, et le mesureur n'y verrait rien.
      const replies = [...document.querySelectorAll("button.app-outils--replie")];
      if (replies.length) {
        replies.forEach((b) => b.click());
        await new Promise((r) => setTimeout(r, attente));
      }
      document.querySelectorAll("details").forEach((d) => { d.open = true; });
      await new Promise((r) => setTimeout(r, 60));
      const { ecarts, bandesMesurees } = ecartsDAlignement(document);
      resultats.push({ ecran, ok: ecarts.length === 0, ecarts, bandes: bandesMesurees });
    }
  } finally {
    location.hash = depart || "#accueil";
    await new Promise((r) => setTimeout(r, attente));
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    bandes: resultats.reduce((n, r) => n + r.bandes, 0),
    resultats,
  };
}

/* ------------------------------------------------------------------ */
/* Recherche dans les menus déroulants (EX-061, SPEC § 8.28)           */
/* ------------------------------------------------------------------ */

/**
 * Vérifie, écran par écran, les menus déroulants enrichis d'une recherche.
 *
 * Ce qui est éprouvé, pour **chaque** menu enrichi :
 *
 *  - le `<select>` d'origine est conservé, masqué, et garde ses `<option>`s —
 *    c'est la valeur de l'outil, et rien de ce qui la lit ne doit changer ;
 *  - le champ de recherche est **nommé** (un `<label for>` ou un `aria-label`) ;
 *  - l'ouvrir annonce la liste (`aria-expanded`), la dépose dans le `<body>` et
 *    la remplit ;
 *  - une liste plus longue que sa fenêtre se **laisse défiler** — la position
 *    tenue après un événement `scroll` ne revient pas à la première ligne ;
 *  - les **groupes** du menu natif (`<optgroup>` : le collège des intervenants)
 *    sont redits dans la liste ouverte, et chaque proposition annonce le sien ;
 *  - le menu des intervenants ne propose **que des membres de la section** : le
 *    répertoire des personnes n'y figure pas (invariant 29) ;
 *  - une recherche sans réponse **le dit**, et ne laisse aucune proposition ;
 *  - Échap referme sans rien changer à la valeur du menu.
 *
 * Sur un menu de **filtre** seulement — dont la valeur ne quitte pas les
 * préférences — le parcours va jusqu'au bout : choisir une proposition écrit la
 * valeur dans le `<select>`, et l'écran se reconstruit ; la valeur d'origine est
 * ensuite rétablie en choisissant l'entrée sans valeur. Un menu qui écrit dans
 * les données (`data-bind`, `data-action`) n'est pas modifié : le test ne touche
 * pas à la base. Pour atteindre le menu d'intervenants — le seul menu groupé —,
 * l'onglet de composition d'une affaire est ouvert en chemin, sur l'affaire
 * dont la section compte le plus de membres en fonction — c'est la seule dont
 * le menu dépasse `SEUIL_RECHERCHE` et soit réellement enrichi, donc la seule
 * où les groupes aient une liste ouverte où se redire —, puis refermé :
 * l'application est rendue dans l'état où elle a été trouvée.
 *
 *   const { verifierRecherche } = await import("./tests/ecrans.test.js");
 *   await verifierRecherche();
 */
export async function verifierRecherche({ attente = 90 } = {}) {
  const depart = location.hash;
  const ecrans = [...ecransDeNAV().map((e) => e.id), ...adressesDeFiches()];
  const resultats = [];
  /**
   * L'affaire dont la section offre le plus de membres **en fonction** : c'est
   * celle dont le menu d'intervenants a des chances d'être enrichi d'une
   * recherche (`SEUIL_RECHERCHE`), et donc de laisser éprouver les groupes du
   * menu natif. Rend son `id`, ou `null` si rien de mieux n'est à ouvrir.
   */
  const affaireLaPlusFournie = () => {
    const appStore = window.appStore;
    const appState = window.appState;
    if (!appStore || !appState || !appState.ctx) return null;
    const ctx = appState.ctx;
    const membres = appStore.table("Membres");
    const compte = (a) => membres.filter(
      (m) => ctx.v("Membres", m, "En_fonction") && Number(m.Section) === Number(a.Section)
    ).length;
    const cible = [...appStore.table("Affaires")].sort((a, b) => compte(b) - compte(a))[0];
    return cible && Number(appState.sel.Affaires) !== Number(cible.id) ? cible.id : null;
  };
  // L'onglet ouvert en chemin, pour rendre l'application dans l'état où elle
  // était : l'onglet de composition d'une affaire ne fait pas partie du
  // parcours, il n'est ouvert que pour atteindre son menu d'intervenants.
  let ongletOuvert = "";
  // L'affaire ouverte en chemin, et celle qui était ouverte avant : le parcours
  // ne doit pas laisser la sélection sur une autre affaire que celle trouvée.
  let affaireOuverte = 0;
  let affaireDepart = 0;
  try {
    for (const ecran of ecrans) {
      location.hash = `#${ecran}`;
      await new Promise((r) => setTimeout(r, 320));
      // Un menu replié (`outils` de `views/common.js`, panneaux repliables) n'est
      // pas affiché : on l'ouvre, sinon le champ n'aurait aucune place et la
      // liste se poserait n'importe où.
      document.querySelectorAll("details").forEach((d) => { d.open = true; });
      // L'onglet de composition d'une affaire porte le menu d'intervenants — le
      // seul menu **groupé** de l'outil (un `<optgroup>` par collège) : on
      // l'ouvre, sans quoi ce menu, et ses groupes, ne seraient pas éprouvés.
      if (document.querySelector('[role="tab"][id$="-tab-formation"]')) {
        // D'une petite section, ce menu reste natif (moins de `SEUIL_RECHERCHE`
        // valeurs) : ses groupes sont alors dessinés par le navigateur, et il
        // n'y a rien à éprouver. On ouvre l'affaire la mieux fournie, pour que
        // le contrôle des groupes porte sur un menu réellement enrichi.
        const affaireFournie = affaireLaPlusFournie();
        if (affaireFournie) {
          const item = document.querySelector(`.app-list__item[data-select-table="Affaires"][data-select="${affaireFournie}"]`);
          if (item) {
            const courante = document.querySelector('.app-list__item.is-selected[data-select-table="Affaires"]');
            affaireDepart = courante ? Number(courante.dataset.select) : 0;
            item.click();
            affaireOuverte = affaireFournie;
            await new Promise((r) => setTimeout(r, 320));
            document.querySelectorAll("details").forEach((d) => { d.open = true; });
          }
        }
        const ongletFormation = document.querySelector('[role="tab"][id$="-tab-formation"]');
        const revenir = document.querySelector('[role="tab"][aria-selected="true"]');
        ongletFormation.click();
        await new Promise((r) => setTimeout(r, 320));
        document.querySelectorAll("details").forEach((d) => { d.open = true; });
        ongletOuvert = revenir ? revenir.id : "";
      }
      await new Promise((r) => setTimeout(r, 80));
      const boites = [...document.querySelectorAll("#app .app-combobox")];
      for (const boite of boites) {
        const select = document.getElementById(boite.dataset.combobox);
        const champ = boite.querySelector("input");
        const etat = {
          ecran,
          champ: champ ? champ.id : "(champ absent)",
          valeurs: select ? select.options.length : 0,
          ok: true,
          details: [],
        };
        const faute = (quoi) => { etat.ok = false; etat.details.push(quoi); };
        // Un menu neutralisé (rôle en lecture seule) n'a rien à éprouver : il ne
        // s'ouvre pas, et c'est ce qu'il doit faire.
        if (select && select.disabled) {
          etat.neutralise = true;
          resultats.push(etat);
          continue;
        }
        if (!select || !select.hidden) faute("le menu natif n'est pas conservé, masqué");
        if (!champ) { resultats.push(etat); continue; }
        if (!select.options.length) faute("le menu natif a perdu ses options");
        if (!document.querySelector(`label[for="${champ.id}"]`) && !champ.getAttribute("aria-label")) {
          faute("le champ de recherche n'est pas nommé");
        }
        const valeurInitiale = select.value;
        const filtre = select.dataset.filter || "";
        // Ouvrir : la liste se dépose dans le `<body>` et s'annonce.
        champ.click();
        await new Promise((r) => setTimeout(r, attente));
        const portail = document.querySelector(".app-combobox-portail");
        const liste = document.getElementById(champ.getAttribute("aria-controls"));
        if (champ.getAttribute("aria-expanded") !== "true") faute("la liste ne s'annonce pas ouverte");
        if (!portail || !portail.closest("body")) faute("la liste n'est pas déposée dans la page");
        if (!liste || !liste.children.length) faute("aucune proposition à l'ouverture");
        // Un menu natif **groupé** (`<optgroup>`) doit le rester dans la liste
        // ouverte : elle ne montre que des noms, et le groupe dit de quel
        // collège relève celui qui le porte — l'information manque à qui ne
        // connaît pas la personne. L'intertitre précède les propositions de son
        // groupe, et chacune annonce son collège (le lecteur d'écran, lui, ne
        // voit pas l'intertitre).
        const groupesNatifs = select ? [...select.querySelectorAll("optgroup")].map((g) => g.label) : [];
        const propositionsListe = () => [...(liste ? liste.children : [])]
          .filter((l) => l.classList.contains("app-combobox-liste__entree"));
        if (liste && groupesNatifs.length) {
          const peints = [...liste.children]
            .filter((l) => l.classList.contains("app-combobox-liste__groupe"))
            .map((l) => l.textContent.trim());
          const absents = groupesNatifs.filter((label) => !peints.includes(label));
          if (absents.length) faute(`les groupes du menu ne sont pas redits dans la liste (${absents.join(", ")})`);
          let courant = "";
          for (const enfant of [...liste.children]) {
            if (enfant.classList.contains("app-combobox-liste__groupe")) { courant = enfant.textContent.trim(); continue; }
            if (!enfant.classList.contains("app-combobox-liste__entree")) continue;
            if (enfant.classList.contains("app-combobox-liste__entree--vide")) continue;
            const annonce = enfant.getAttribute("aria-label") || "";
            if (courant && !annonce.endsWith(`— ${courant}`)) {
              faute(`« ${annonce} » n'annonce pas son collège (« ${courant} »)`);
              break;
            }
          }
          // Une composition se fait avec les **membres de la section**, et le
          // répertoire des personnes n'a rien à y faire : l'intervenant hors
          // section se saisit librement (`intervenantSourceSelect`, invariant 29).
          const repertoires = peints.filter((p) => /^Répertoire/.test(p));
          if (repertoires.length) {
            faute(`le menu propose le répertoire des personnes (${repertoires.join(", ")})`);
          }
        }
        // Une liste plus longue que la fenêtre qu'elle occupe doit pouvoir être
        // **parcourue** : le replacement de la liste, déclenché par le moindre
        // défilement (`scroll`), remettait autrefois la position à zéro — la
        // liste revenait au premier élément à chaque geste, donc impossible à
        // faire défiler. Le défilement se produit ici comme au doigt ou à la
        // molette : on pose la position, puis on émet l'événement `scroll` que
        // le navigateur émettrait.
        if (liste && liste.scrollHeight > liste.clientHeight) {
          const pose = Math.min(60, liste.scrollHeight - liste.clientHeight);
          liste.scrollTop = pose;
          const voulu = liste.scrollTop;
          liste.dispatchEvent(new Event("scroll"));
          await new Promise((r) => setTimeout(r, attente));
          if (liste.scrollTop !== voulu) {
            faute(`la liste ne se laisse pas défiler (position ${liste.scrollTop} au lieu de ${voulu})`);
          }
          liste.scrollTop = 0;
        }
        // Une recherche qui ne répond à rien doit le dire, et ne rien proposer —
        // hors l'entrée sans valeur, qui porte le retour à vide.
        champ.value = "zzzzzz";
        champ.dispatchEvent(new InputEvent("input", { bubbles: true }));
        await new Promise((r) => setTimeout(r, attente));
        const note = portail ? portail.querySelector(".app-combobox-liste__note") : null;
        const reelles = propositionsListe().filter((l) => !l.classList.contains("app-combobox-liste__entree--vide"));
        if (reelles.length) faute("une recherche sans réponse laisse des propositions");
        if (!note || note.hidden) faute("une recherche sans réponse n'est pas dite");
        // Échap : rien n'est retenu, et la valeur du menu ne bouge pas.
        champ.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, attente));
        if (select.value !== valeurInitiale) faute("Échap a changé la valeur du menu");
        if (champ.getAttribute("aria-expanded") !== "false") faute("la liste reste annoncée ouverte");
        if (filtre && valeurInitiale === "") {
          // Choisir la première proposition qui porte une valeur, puis revenir à vide.
          const reintroduire = () => {
            const b = document.querySelector(`[data-combobox="${boite.dataset.combobox}"]`);
            return b ? b.querySelector("input") : null;
          };
          champ.click();
          await new Promise((r) => setTimeout(r, attente));
          const pleine = [...document.querySelectorAll(".app-combobox-liste__entree")]
            .find((l) => !l.classList.contains("app-combobox-liste__entree--vide"));
          if (!pleine) {
            faute("aucune proposition à retenir");
          } else {
            const attendu = document.getElementById(boite.dataset.combobox)
              .options[Number(pleine.dataset.rang)].value;
            pleine.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            await new Promise((r) => setTimeout(r, 200));
            const select2 = document.getElementById(boite.dataset.combobox);
            if (!select2 || select2.value !== attendu) faute("le choix n'a pas été écrit dans le menu natif");
            const champ2 = reintroduire();
            if (champ2 && champ2.value !== pleine.textContent) faute("le champ n'annonce pas la valeur retenue");
            // Retour à vide : l'entrée sans valeur reste proposée.
            if (champ2) {
              champ2.click();
              await new Promise((r) => setTimeout(r, attente));
              const vide = [...document.querySelectorAll(".app-combobox-liste__entree")]
                .find((l) => l.classList.contains("app-combobox-liste__entree--vide"));
              if (!vide) {
                faute("l'entrée sans valeur n'est plus proposée");
              } else {
                vide.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                await new Promise((r) => setTimeout(r, 200));
                const select3 = document.getElementById(boite.dataset.combobox);
                if (!select3 || select3.value !== valeurInitiale) faute("le retour à vide n'a pas été écrit");
              }
            }
          }
        }
        resultats.push(etat);
      }
    }
  } finally {
    // L'application est rendue dans l'état où elle a été trouvée. Le parcours a
    // ouvert l'onglet de composition d'une affaire — l'onglet se mémorise pour
    // la session — : on le referme, au besoin en revenant sur l'écran qui le
    // porte.
    location.hash = depart || "#accueil";
    await new Promise((r) => setTimeout(r, 320));
    if (ongletOuvert) {
      // L'affaire ouverte en chemin reprend sa place d'abord : l'onglet rendu
      // appartient à la fiche de composition, qui n'a de sens que sur elle.
      if (affaireOuverte) {
        location.hash = "#affaires";
        await new Promise((r) => setTimeout(r, 320));
        const cible = document.querySelector(`.app-list__item[data-select-table="Affaires"][data-select="${affaireDepart}"]`)
          || document.querySelector('.app-list__item[data-select-table="Affaires"]');
        if (cible) {
          cible.click();
          await new Promise((r) => setTimeout(r, 320));
        }
      }
      let retour = document.getElementById(ongletOuvert);
      if (!retour) {
        location.hash = "#affaires";
        await new Promise((r) => setTimeout(r, 320));
        retour = document.getElementById(ongletOuvert);
      }
      if (retour) {
        retour.click();
        await new Promise((r) => setTimeout(r, 320));
      }
      location.hash = depart || "#accueil";
      await new Promise((r) => setTimeout(r, 320));
    }
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    resultats,
  };
}

/* ------------------------------------------------------------------ */
/* Menus déroulants dans la fenêtre (EX-068, SPEC § 8.32)              */
/* ------------------------------------------------------------------ */

/* Marge tolérée entre le bord du panneau et celui de la fenêtre. */
const TOLERANCE_MENU = 1;

/**
 * Un panneau monté pour la mesure, hors de la fenêtre, et ce que le
 * replacement en fait. Le panneau d'un menu s'ancre au bord **droit** de son
 * bouton : posé contre le bord gauche, ou au-delà du bord droit, il sort de la
 * fenêtre — c'est le cas que la mise en page produit sur un écran étroit, et
 * c'est exactement ce que `poserPanneau` doit rattraper.
 *
 * Le montage est détaché du document aussitôt mesuré, et invisible : il ne sert
 * qu'à obtenir des cotes réelles, que la feuille de style de l'outil donne.
 */
function eprouverReplacement() {
  const fenetre = document.documentElement.clientWidth;
  const largeur = 300;
  const ecarts = [];
  // Un panneau de 300px ne peut tenir dans rien de plus étroit que ~316px : sur
  // une fenêtre plus petite, il n'y a pas de « dans la fenêtre » à atteindre.
  if (fenetre < largeur + 2 * TOLERANCE_MENU + 16) return { ok: true, bandes: 0, ecarts };
  for (const cote of ["gauche", "droite"]) {
    const hote = document.createElement("div");
    hote.style.cssText = [
      "position: fixed",
      "top: 0",
      "width: 1px",
      "visibility: hidden",
      cote === "gauche" ? "left: 0" : "right: -200px",
    ].join(";");
    hote.innerHTML = '<details class="app-menu" open><summary>Menu</summary>'
      + '<div class="app-menu__panel"><button type="button" class="fr-btn">Entrée</button></div></details>';
    document.body.appendChild(hote);
    try {
      const panneau = hote.querySelector(".app-menu__panel");
      panneau.style.width = `${largeur}px`;
      const avant = panneau.getBoundingClientRect();
      const horsFenetre = avant.left < 0 || avant.right > fenetre;
      poserPanneau(panneau);
      const apres = panneau.getBoundingClientRect();
      if (!horsFenetre) {
        ecarts.push({ menu: `panneau posé à ${cote}`, faute: "le panneau n'est pas sorti de la fenêtre : rien à rattraper" });
      } else if (apres.left < -TOLERANCE_MENU || apres.right > fenetre + TOLERANCE_MENU) {
        ecarts.push({
          menu: `panneau posé à ${cote}`,
          faute: `le panneau reste hors de la fenêtre (${Math.round(apres.left)}–${Math.round(apres.right)} pour ${fenetre})`,
        });
      }
    } finally {
      hote.remove();
    }
  }
  return { ok: ecarts.length === 0, bandes: 2, ecarts };
}

/**
 * Vérifie que le panneau d'un menu déroulant reste **dans la fenêtre**.
 *
 * Le panneau s'ancre au bord droit de son bouton. Sur un écran large, le bouton
 * est près du bord droit de la page et le panneau s'ouvre vers la gauche, dans
 * la place disponible. Sur un écran étroit, la ligne d'actions de l'en-tête se
 * replie et ses boutons repartent du bord **gauche** : le panneau, large de
 * 16,5 rem, sortait alors par la gauche, et la moitié de ses entrées devenait
 * invisible et incliquable. `menus.js` le ramène dans la fenêtre à l'ouverture.
 *
 * Le contrôle porte sur deux choses : le replacement lui-même, éprouvé sur des
 * panneaux montés hors de la fenêtre (et donc indépendant de la largeur
 * courante), et chaque menu **réel** des écrans de `NAV`, ouvert puis refermé.
 * Ce second volet ne peut échouer que sur une fenêtre étroite : c'est là qu'il
 * faut le lancer (`set_viewport_size`), comme le contrôle d'alignement.
 *
 *   const { verifierMenus } = await import("./tests/ecrans.test.js");
 *   await verifierMenus();
 */
export async function verifierMenus({ attente = 120 } = {}) {
  const depart = location.hash;
  const resultats = [];
  const replacement = eprouverReplacement();
  resultats.push({ ecran: "replacement du panneau", ok: replacement.ok, ecarts: replacement.ecarts, menus: replacement.bandes });
  try {
    for (const ecran of ecransDeNAV().map((e) => e.id)) {
      location.hash = `#${ecran}`;
      await new Promise((r) => setTimeout(r, attente));
      const menus = [...document.querySelectorAll("details.app-menu")];
      const ecarts = [];
      const fenetre = document.documentElement.clientWidth;
      for (const menu of menus) {
        const resume = menu.querySelector("summary");
        const panneau = menu.querySelector(".app-menu__panel");
        if (!resume || !panneau) {
          ecarts.push({ menu: "(sans résumé)", faute: "menu sans résumé ou sans panneau" });
          continue;
        }
        const libelle = String(resume.textContent).trim().slice(0, 20);
        resume.click();
        await new Promise((r) => setTimeout(r, 40));
        const cadre = panneau.getBoundingClientRect();
        if (cadre.left < -TOLERANCE_MENU || cadre.right > fenetre + TOLERANCE_MENU) {
          ecarts.push({
            menu: libelle,
            faute: `le panneau sort de la fenêtre (${Math.round(cadre.left)}–${Math.round(cadre.right)} pour ${fenetre})`,
          });
        }
        if (menu.open) resume.click();
        await new Promise((r) => setTimeout(r, 40));
      }
      resultats.push({ ecran, ok: ecarts.length === 0, ecarts, menus: menus.length });
    }
  } finally {
    location.hash = depart || "#accueil";
    await new Promise((r) => setTimeout(r, attente));
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    menus: resultats.reduce((n, r) => n + (r.menus || 0), 0),
    resultats,
  };
}

/* ------------------------------------------------------------------ */
/* En-tête défilé et barres collées (EX-070, SPEC § 8.34)              */
/* ------------------------------------------------------------------ */

/* Marge tolérée entre une barre collée et le bord de la fenêtre, et entre deux
   barres qui se suivent. */
const TOLERANCE_COLLE = 2;

/* Les écrans éprouvés : l'un porte un **sommaire d'ancres** (`ui.anchors`),
   l'autre des **colonnes collées**, le troisième rien de particulier. La barre
   de navigation doit rester en haut, et dégagée, dans les trois cas. */
const ECRANS_ENTETE = ["aide", "affaires", "tableau-de-bord/rapport"];

/**
 * Vérifie ce que devient l'en-tête quand on défile (EX-070).
 *
 * Quatre choses, à chaque écran : la **barre de navigation reste en haut de la
 * fenêtre** et rien ne la recouvre ; les **commandes du compte y prennent
 * place** quand l'en-tête a disparu, et s'effacent quand il revient ; elles se
 * rangent **sur le rang des onglets** — ou sur un second rang quand la place
 * manque, mais jamais l'un pour l'autre ; les **autres barres collées** de la
 * page — le sommaire d'ancres d'une page longue, la colonne d'outils d'un
 * atelier — se posent **sous** elle. Le sommaire, collé à `top: 0`, recouvrait
 * la barre de navigation, qui disparaissait sous lui dès qu'on défilait : c'est
 * un des défauts que ce contrôle tient fermés. L'autre est le rang : les
 * commandes occupaient *toujours* un second rang, alors que la place les laisse
 * le plus souvent tenir sur celui des onglets — c'est selon la largeur, et le
 * contrôle éprouve l'état que la largeur appelle.
 *
 * `embarque` éprouve le **cadre Grist** : la classe `.app-embedded` est posée
 * sur `<html>` le temps du contrôle, et le même parcours est refait. Le widget
 * défile pour lui-même : la barre doit s'y coller, et les commandes y descendre
 * comme dans un onglet. Seule la **colonne collée** des ateliers est écartée —
 * un cadre de widget la laisse dans le flux (`styles.css`), et il n'y a rien à
 * mesurer sur une colonne qui ne se colle pas.
 *
 *   const { verifierEntete } = await import("./tests/ecrans.test.js");
 *   await verifierEntete();
 *   await verifierEntete({ embarque: true });
 */
export async function verifierEntete({ attente = 360, embarque = false } = {}) {
  const depart = location.hash;
  const resultats = [];
  const pause = () => new Promise((r) => setTimeout(r, attente));
  const racine = document.documentElement;
  // La classe est posée par le contrôle, et retirée à la fin : dans un aperçu
  // où elle est déjà là (la page tourne dans un vrai document Grist), on la
  // laisse en place.
  const poseClasse = embarque && !racine.classList.contains("app-embedded");
  if (poseClasse) racine.classList.add("app-embedded");
  try {
    for (const ecran of ECRANS_ENTETE) {
      location.hash = `#${ecran}`;
      await pause();
      const ecarts = [];
      const faute = (detail) => ecarts.push({ faute: detail });
      const nav = document.querySelector(".app-navbar");
      const entete = document.querySelector(".fr-header");
      const boite = document.querySelector(".app-navbar__outils");
      const liste = document.querySelector(".app-navbar__list--desktop");
      if (!nav || !entete || !boite) {
        resultats.push({ ecran, ok: false, ecarts: [{ faute: "barre de navigation ou en-tête absent" }] });
        continue;
      }
      const hautEntete = Math.round(entete.getBoundingClientRect().height);
      const reduit = () => document.documentElement.classList.contains("entete-reduite");

      // 1. En haut de page : l'en-tête est là, les commandes n'ont pas à
      //    descendre.
      window.scrollTo(0, 0);
      await pause();
      const hauteurFermee = Math.round(nav.getBoundingClientRect().height);
      if (reduit()) faute("l'en-tête est déclaré masqué alors que la page est en haut");
      if (getComputedStyle(boite).visibility !== "hidden") {
        faute("les commandes sont sur la barre alors que l'en-tête est encore visible");
      }

      // 2. Défilé : la barre tient le haut de la fenêtre, rien ne la recouvre,
      //    et les commandes y sont descendues.
      window.scrollTo(0, hautEntete + 60);
      await pause();
      // La barre se colle vraiment : c'est ce qui donne un haut de fenêtre à
      // tenir. C'est faux dans l'ancien cadre Grist — la barre y était laissée
      // dans le flux —, et rien, alors, ne peut s'y accrocher.
      if (getComputedStyle(nav).position !== "sticky") {
        faute(`la barre de navigation n'est pas collée (position : ${getComputedStyle(nav).position})`);
      }
      const cadreNav = nav.getBoundingClientRect();
      if (cadreNav.top > TOLERANCE_COLLE || cadreNav.bottom <= TOLERANCE_COLLE) {
        faute(`la barre de navigation a quitté le haut de la fenêtre (${Math.round(cadreNav.top)}–${Math.round(cadreNav.bottom)})`);
      }
      if (!reduit()) faute("l'en-tête a disparu sans que les commandes descendent sur la barre");
      if (!ecarts.length) {
        // Ce qui est **peint** à la place des onglets : un élément de la barre,
        // et non la barre d'ancres ou le contenu de la page posés par-dessus.
        const y = Math.max(1, Math.round(cadreNav.top + cadreNav.height / 4));
        for (const part of [0.1, 0.5, 0.9]) {
          const point = document.elementFromPoint(Math.round(window.innerWidth * part), y);
          if (!point || !point.closest(".app-navbar")) {
            faute(`la barre est recouverte à ${Math.round(part * 100)} % de sa largeur (${point ? point.className : "rien"})`);
          }
        }
        // Le bouton de création, ou le bloc de compte : présent, peint, à
        // l'endroit où il se trouve.
        const commande = boite.querySelector('[data-action="new-affaire"]') || boite.querySelector(".app-user");
        if (!commande) faute("les commandes du compte n'ont pas de copie sur la barre");
        else {
          const cadre = commande.getBoundingClientRect();
          if (cadre.height <= 0 || !cadre.width) faute("les commandes descendues sur la barre n'ont pas de dimensions");
          else {
            const point = document.elementFromPoint(
              Math.round(cadre.left + cadre.width / 2),
              Math.round(cadre.top + cadre.height / 2),
            );
            if (!point || !commande.contains(point)) {
              faute(`les commandes descendues sur la barre sont recouvertes (${point ? point.className : "rien"})`);
            }
          }
        }
      }

      // 2bis. Les commandes et les onglets : sur un rang ou deux ? C'est la
      //     **place** qui le décide, et la barre doit avoir pris l'état que
      //     cette place appelle — sur le rang des onglets quand tout y tient,
      //     sur un second rang sinon, jamais l'un pour l'autre. Les commandes
      //     occupaient *toujours* un second rang : c'est le défaut que ce
      //     contrôle tient fermé. Le contrôle ne vaut que pour la barre
      //     alignée : en deçà de 48em, la barre se replie dans un menu
      //     (`display: none`), et les commandes ont leur propre rang par
      //     construction.
      if (liste && getComputedStyle(liste).display !== "none") {
        const rail = boite.querySelector(".app-navbar__outils-rail");
        const conteneur = nav.querySelector(".fr-container");
        const onglets = [...liste.querySelectorAll("li")];
        const dernier = onglets[onglets.length - 1];
        const espacement = parseFloat(getComputedStyle(liste).columnGap) || 0;
        const largeurOnglets = onglets.reduce((somme, li) => somme + li.getBoundingClientRect().width, 0)
          + espacement * Math.max(0, onglets.length - 1);
        // La largeur **propre** du bloc : le rail garde la sienne (`flex: 0 0
        // auto`), qu'il soit ouvert ou fermé.
        const largeurCommandes = rail ? rail.getBoundingClientRect().width : 0;
        const place = conteneur.clientWidth
          - parseFloat(getComputedStyle(conteneur).paddingLeft)
          - parseFloat(getComputedStyle(conteneur).paddingRight);
        const tiennent = largeurOnglets + largeurCommandes <= place;
        const cadreRail = rail && rail.getBoundingClientRect();
        const cadreDernier = dernier && dernier.getBoundingClientRect();
        const memeRang = !!cadreRail && !!cadreDernier && cadreRail.top < cadreDernier.bottom - TOLERANCE_COLLE;
        if (tiennent && !memeRang) {
          faute(`les commandes sont rejetées sur un second rang alors que la place les laisse tenir sur celui des onglets (${Math.round(largeurOnglets + largeurCommandes)} pour ${Math.round(place)} px)`);
        }
        if (!tiennent && memeRang) {
          faute(`les commandes partagent le rang des onglets alors que la place manque (${Math.round(largeurOnglets + largeurCommandes)} pour ${Math.round(place)} px)`);
        }
        if (memeRang) {
          if (cadreRail.left < cadreDernier.right - TOLERANCE_COLLE) {
            faute("les commandes recouvrent les derniers onglets");
          }
          if (Math.abs(cadreNav.height - hauteurFermee) > TOLERANCE_COLLE) {
            faute(`la barre grandit quand les commandes arrivent (${Math.round(cadreNav.height)} pour ${hauteurFermee} px refermée), alors qu'elles partagent le rang des onglets`);
          }
        }
      }

      // 3. Loin dans la page : les barres collées se posent **sous** la barre
      //    de navigation, jamais devant elle.
      const bas = document.scrollingElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.max(0, Math.min(bas, 900)));
      await pause();
      const basNav = nav.getBoundingClientRect().bottom;
      // Dans un cadre Grist, la colonne collée des ateliers reste dans le flux
      // (`.app-embedded`, `styles.css`) : il n'y a rien à mesurer sur elle.
      const barres = embarque
        ? [["le sommaire d'ancres", ".app-anchors"]]
        : [
          ["le sommaire d'ancres", ".app-anchors"],
          ["la colonne collée", ".app-split__aside"],
          ["la colonne d'outils", ".app-doc__outils"],
        ];
      for (const [nom, selecteur] of barres) {
        for (const el of document.querySelectorAll(selecteur)) {
          // L'écart de collage doit dégager la barre : une colonne collée à une
          // hauteur fixe (4,5 rem) passait sous elle dès que la barre tenait sur
          // deux rangs.
          const decalage = parseFloat(getComputedStyle(el).top);
          if (!Number.isFinite(decalage) || decalage < basNav - TOLERANCE_COLLE) {
            faute(`${nom} se colle à ${decalage}px, sous une barre qui descend à ${Math.round(basNav)}px`);
          }
          // Un sommaire, lui, ne quitte jamais la page : il ne doit pas passer
          // devant la barre. Une colonne, en revanche, glisse sous elle quand
          // sa propre colonne s'achève — c'est le propre d'un collage.
          if (selecteur === ".app-anchors" && el.getBoundingClientRect().top < basNav - TOLERANCE_COLLE) {
            faute(`${nom} recouvre la barre de navigation (${Math.round(el.getBoundingClientRect().top)} pour un bas de barre à ${Math.round(basNav)})`);
          }
        }
      }

      // 4. Retour en haut : les commandes remontent avec l'en-tête.
      window.scrollTo(0, 0);
      await pause();
      if (reduit()) faute("les commandes restent sur la barre une fois l'en-tête revenu");
      if (getComputedStyle(boite).visibility !== "hidden") {
        faute("les commandes restent visibles sur la barre une fois l'en-tête revenu");
      }

      resultats.push({ ecran, ok: ecarts.length === 0, ecarts, hauteurEntete: hautEntete });
    }
  } finally {
    location.hash = depart || "#accueil";
    window.scrollTo(0, 0);
    await pause();
    if (poseClasse) racine.classList.remove("app-embedded");
    await pause();
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    embarque,
    resultats,
  };
}

/* ------------------------------------------------------------------ */
/* Espace de rédaction : largeur du texte et repère de dépôt           */
/* ------------------------------------------------------------------ */

/* La mesure d'une feuille A4, en pixels CSS : 21 cm à 96 dpi. C'est la largeur
   que l'aperçu, le PDF et le Word donnent au texte — c'est donc elle que
   l'espace de rédaction doit pouvoir atteindre. */
const MESURE_A4 = (21 * 96) / 2.54;

/* Les deux seuils d'empilement des outils, pour une racine à 16px : la requête
   de **conteneur** les fait passer sous le texte à 59rem de largeur de
   l'espace, la requête **média** à 62em de largeur de fenêtre. Les deux se
   répondent — 59rem de conteneur, c'est 62em de fenêtre moins les marges de la
   page —, et le contrôle laisse entre eux une zone morte, plutôt que de
   dépendre de leur écart exact. */
const SEUIL_EMPILEMENT = 59 * 16;
const SEUIL_FENETRE = 62 * 16;

/* Le plancher de la colonne d'outils, tel que `styles.css` le pose. */
const PLANCHER_OUTILS = 14 * 16;

/** Les colonnes d'un espace de rédaction, ou `null` si l'écran n'en porte pas. */
function colonnesRedaction() {
  const racine = document.querySelector(".app-wysiwyg.app-doc");
  const atelier = racine?.querySelector(".app-doc__atelier");
  const outils = racine?.querySelector(".app-doc__outils");
  const feuille = atelier?.querySelector("[data-wysiwyg-editor]");
  if (!racine || !atelier || !outils || !feuille) return null;
  const cadre = (el) => el.getBoundingClientRect();
  const cadreAtelier = cadre(atelier);
  const cadreOutils = cadre(outils);
  return {
    largeurRacine: cadre(racine).width,
    largeurAtelier: cadreAtelier.width,
    largeurOutils: cadreOutils.width,
    largeurFeuille: cadre(feuille).width,
    mesureFeuille: parseFloat(getComputedStyle(feuille).maxWidth),
    replie: outils.classList.contains("app-doc__outils--replie"),
    // Les outils sont **sous** le texte quand ils commencent après son bas :
    // une colonne voisine commence, elle, à la même hauteur que lui.
    empile: cadreOutils.top > cadreAtelier.top + 2 && cadreOutils.top >= cadreAtelier.bottom - 2,
  };
}

/**
 * Éprouve le dépôt d'une balise dans un espace de rédaction monté **hors de la
 * page** : la mesure ne dépend donc d'aucun écran, et rien n'est écrit dans les
 * données de l'outil.
 *
 * Trois choses y sont vérifiées : le **repère du point de dépôt** paraît sous le
 * pointeur pendant le survol et se retire quand on sort de la zone ; la balise
 * s'insère **au point visé** — et non au curseur, qui peut être resté ailleurs,
 * ou à la fin du texte ; le **fantôme du geste** ne reste pas derrière lui.
 * C'est ce qui manquait : la barre de la palette suivait le curseur et masquait
 * le point de dépôt, que seul le trait d'un pixel du curseur natif marquait.
 */
async function eprouverDepot() {
  const ecarts = [];
  const faute = (detail) => ecarts.push({ faute: detail });
  if (typeof DataTransfer !== "function" || typeof DragEvent !== "function") {
    return { ok: true, ecarts, ignore: "glisser-déposer synthétique indisponible dans ce navigateur" };
  }
  const hote = document.createElement("div");
  hote.id = "app-epreuve-depot";
  // Hors du flux et en haut de la fenêtre : le point visé se donne en
  // coordonnées de fenêtre, et le calcul du curseur ne répond que pour ce qui
  // est visible à l'écran.
  hote.style.cssText = "position:fixed;top:0;left:0;z-index:99999;width:720px;"
    + "background:var(--background-default-grey);text-align:left";
  hote.innerHTML = `
    <div data-wysiwyg data-chips="columns" style="display:flex;gap:20px;align-items:flex-start">
      <div data-wysiwyg-editor class="app-wysiwyg__edit" contenteditable="true"
        style="flex:1;min-width:380px;padding:8px;font-size:16px;line-height:24px">Un texte de contrôle pour le dépôt d'une balise.</div>
      <div data-wysiwyg-palette>${paletteHtml({
        groups: [{ label: "Essai", entries: [{ token: "{{Ville}}", label: "Ville", sample: "Lyon" }] }],
      })}</div>
    </div>`;
  document.body.appendChild(hote);
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const image = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    mountWysiwyg(hote);
    const editeur = hote.querySelector("[data-wysiwyg-editor]");
    const bouton = hote.querySelector(".app-var");
    const repère = () => document.querySelector(".app-drop-caret");
    const donnees = () => {
      const dt = new DataTransfer();
      dt.setData("application/x-doc-token", "{{Ville}}");
      dt.setData("text/plain", "{{Ville}}");
      return dt;
    };
    const cadre = editeur.getBoundingClientRect();
    const x = Math.round(cadre.left + 120);
    const y = Math.round(cadre.top + 20);
    const survoler = (dt) => editeur.dispatchEvent(new DragEvent("dragover", {
      bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt,
    }));

    // 1. Le repère paraît au point visé.
    survoler(donnees());
    await image();
    const repere = repère();
    if (!repere || repere.hidden) {
      faute("aucun repère ne marque le point de dépôt pendant le survol");
    } else {
      const marque = repere.getBoundingClientRect();
      if (Math.abs(marque.left - x) > 40) {
        faute(`le repère se pose à ${Math.round(marque.left)}px du bord, loin du point visé (${x})`);
      }
      if (marque.top > y + 2 || marque.bottom < y - 2) {
        faute(`le repère (${Math.round(marque.top)}–${Math.round(marque.bottom)}) ne couvre pas le point visé (${y})`);
      }
    }

    // 2. Il se retire quand le pointeur sort de la zone.
    editeur.dispatchEvent(new DragEvent("dragleave", {
      bubbles: true, cancelable: true, relatedTarget: document.body, dataTransfer: donnees(),
    }));
    await pause(40);
    if (repère() && !repère().hidden) faute("le repère reste affiché une fois le pointeur sorti");

    // 3. Le dépôt insère la balise au point visé, et non au curseur.
    const avant = editeur.textContent;
    survoler(donnees());
    await image();
    editeur.dispatchEvent(new DragEvent("drop", {
      bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: donnees(),
    }));
    await pause(60);
    const pose = editeur.querySelector("[data-token]");
    if (!pose) {
      faute("le dépôt n'a posé aucune balise dans le texte");
    } else {
      const boite = pose.getBoundingClientRect();
      if (Math.abs(boite.left - x) > 60) {
        faute(`la balise se pose à ${Math.round(boite.left)}px, loin du point visé (${x})`);
      }
      if (boite.left <= cadre.left + 4) {
        faute("la balise s'est posée au début du texte, et non au point visé");
      }
      if (editeur.textContent === avant) faute("le texte n'a pas changé après le dépôt");
    }
    if (repère() && !repère().hidden) faute("le repère reste affiché après le dépôt");

    // 4. Le fantôme du geste ne reste pas dans la page.
    const dt = donnees();
    bouton.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    if (dt.getData("application/x-doc-token") !== "{{Ville}}") {
      faute("le glisser d'une variable ne porte pas sa balise");
    }
    if (!bouton.className.includes("app-var--dragging")) {
      faute("la variable glissée n'est pas marquée pendant le geste");
    }
    await pause(80);
    if (document.querySelector(".app-drag-ghost")) {
      faute("le fantôme du glisser reste dans la page après le départ du geste");
    }
    bouton.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
    await pause(20);
    if (bouton.className.includes("app-var--dragging")) {
      faute("la marque du glisser reste sur la variable après le geste");
    }
  } finally {
    hote.remove();
  }
  return { ok: ecarts.length === 0, ecarts };
}

/**
 * Vérifie l'espace de rédaction : la place laissée au **texte**, et le
 * **repère de dépôt** d'une balise.
 *
 * La largeur, d'abord, sur chaque fiche qui porte un espace de rédaction
 * (`adressesDeFiches`) :
 *
 *   - quand les outils se tiennent à droite du texte, la colonne d'outils ne
 *     prend pas plus du tiers de la largeur, et pas moins que son plancher de
 *     14rem : le texte, lui, garde les deux tiers ;
 *   - le partage se fait **au prorata** de la place, et non par une largeur
 *     fixe : un plafond fixe à 22rem laissait la feuille à 566 px pour un texte
 *     de 487 px sur un écran de 1045 px — la largeur d'un outil embarqué dans un
 *     document Grist ; ce contrôle-là l'aurait refusé ;
 *   - la feuille garde sa **mesure A4** (21 cm) : elle l'atteint dès que la
 *     place le permet, et ne la dépasse pas ;
 *   - repliés, les outils rendent leur largeur au texte ;
 *   - dans une colonne d'outils étroite, ses champs prennent la largeur
 *     entière — les grilles du DSFR se coupent sur la **fenêtre**, non sur la
 *     colonne ;
 *   - sous 59rem d'espace (62em de fenêtre), ils passent dessous et prennent la
 *     ligne, plutôt que de réduire le texte à une colonne.
 *
 * Le dépôt, ensuite : voir `eprouverDepot`. Il s'éprouve hors des écrans, sur un
 * espace monté pour lui — rien n'est écrit dans les données de l'outil.
 *
 * Comme les autres contrôles d'affichage, celui-ci se lance à la largeur qu'on
 * veut éprouver (`set_viewport_size`) :
 *
 *   const { verifierRedaction } = await import("./tests/ecrans.test.js");
 *   await verifierRedaction();
 *
 * Le parcours déplie puis replie les outils de chaque écran, et l'état des
 * panneaux (`state.tabs`) vit en mémoire : il est remis à son défaut au
 * rechargement. Les contrôles qui comptent les champs d'un panneau
 * (`verifierRecherche`, `verifierAlignement`) gagnent donc à être lancés avant
 * lui, ou après un rechargement — un panneau replié n'est pas rendu, et ses
 * champs échappent à leur mesure.
 */
export async function verifierRedaction({ attente = 320 } = {}) {
  const depart = location.hash;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const resultats = [];
  try {
    for (const ecran of adressesDeFiches()) {
      location.hash = `#${ecran}`;
      await pause(attente);
      // Un outil replié n'est pas rendu : on l'ouvre, comme pour l'alignement.
      const replies = [...document.querySelectorAll("button.app-outils--replie")];
      if (replies.length) {
        replies[0].click();
        await pause(attente);
      }
      const m = colonnesRedaction();
      if (!m) continue; // écran sans espace de rédaction
      const ecarts = [];
      const faute = (detail) => ecarts.push({ faute: detail });
      const arrondi = (n) => Math.round(n);

      // 1. L'empilement : c'est la largeur de l'espace qui décide.
      const attendu = m.largeurRacine < SEUIL_EMPILEMENT - 2 ? true
        : m.largeurRacine > SEUIL_FENETRE + 2 ? false
          : null;
      if (attendu !== null && m.empile !== attendu) {
        faute(attendu
          ? `les outils restent à droite du texte dans un espace de ${arrondi(m.largeurRacine)}px`
          : `les outils passent sous le texte dans un espace de ${arrondi(m.largeurRacine)}px`);
      }

      if (!m.empile) {
        // 2. Le partage : le texte est ce qu'on vient écrire.
        if (m.largeurOutils > m.largeurRacine / 3 + 1) {
          faute(`la colonne d'outils prend ${arrondi(m.largeurOutils)}px, plus du tiers de ${arrondi(m.largeurRacine)}px`);
        }
        if (m.largeurOutils < PLANCHER_OUTILS * (rem / 16) - 1) {
          faute(`la colonne d'outils tombe à ${arrondi(m.largeurOutils)}px, sous son plancher de 14rem`);
        }
      }

      // 3. La feuille : au moins la moitié de la place laissée par les outils,
      //    et entière dès que l'atelier a de quoi la porter.
      const reste = m.empile ? m.largeurRacine : m.largeurRacine - m.largeurOutils;
      const attendue = Math.min(MESURE_A4, reste / 2);
      if (m.largeurFeuille < attendue - 1.5) {
        faute(`la feuille fait ${arrondi(m.largeurFeuille)}px pour ${arrondi(attendue)}px au moins`);
      }
      if (Number.isFinite(m.mesureFeuille) && m.largeurAtelier >= MESURE_A4 + 40
        && m.largeurFeuille < MESURE_A4 - 1.5) {
        faute(`la feuille reste à ${arrondi(m.largeurFeuille)}px alors que l'atelier a la place d'une page A4`);
      }

      // 4. Dans une colonne d'outils étroite, ses champs prennent la largeur
      //    entière : les grilles de champs du DSFR se coupent sur la largeur de
      //    la fenêtre, non sur celle de la colonne, et deux champs côte à côte
      //    n'en gardent que sept rem chacun — une date n'y tient plus.
      const colonne = document.querySelector(".app-doc__outils");
      const champs = colonne ? [...colonne.querySelectorAll('[class*="fr-col-md-"]')] : [];
      if (colonne && champs.length && m.largeurOutils < 20 * rem) {
        const etroits = champs.filter((el) => el.getBoundingClientRect().width < 0.7 * m.largeurOutils);
        if (etroits.length) {
          faute(`${etroits.length} champ(s) de la colonne d'outils n'occupent pas toute sa largeur `
            + `(${arrondi(etroits[0].getBoundingClientRect().width)}px pour ${arrondi(m.largeurOutils)}px)`);
        }
      }

      // 5. Replié, l'outil rend sa largeur au texte. On replie tout ce qui peut
      //    l'être — un panneau figé (les paramètres d'un document sans trame)
      //    n'a pas de chevron, et la colonne ne se replie alors pas : il n'y a
      //    rien à mesurer.
      const avantRepli = m.largeurFeuille;
      for (let i = 0; i < 10; i += 1) {
        const teteOuverte = document.querySelector(".app-doc__outils button[aria-expanded='true']");
        if (!teteOuverte) break;
        teteOuverte.click();
        await pause(attente);
      }
      const r = colonnesRedaction();
      if (r?.replie) {
        if (r.largeurOutils > 3 * rem + 1) {
          faute(`repliée, la colonne d'outils garde ${arrondi(r.largeurOutils)}px de large`);
        }
        // Sous la largeur d'empilement, la barre repliée se tient à côté du
        // texte — le texte ne s'élargit donc pas : c'est la place de la barre,
        // et le plancher ci-dessus dit qu'elle reste étroite.
        if (!m.empile && r.largeurFeuille < avantRepli - 1) {
          faute("replier les outils ne rend pas de largeur au texte");
        }
      }

      resultats.push({ ecran, ok: ecarts.length === 0, ecarts, mesures: m });
    }
  } finally {
    location.hash = depart || "#accueil";
    await pause(attente);
  }
  const depot = await eprouverDepot();
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length + 1,
    reussis: resultats.length - echecs.length + (depot.ok ? 1 : 0),
    echecs: echecs.length + (depot.ok ? 0 : 1),
    depot,
    resultats,
  };
}

/* ------------------------------------------------------------------ */
/* Contacts d'une affaire : écrire à la commission entière (EX-072)    */
/* ------------------------------------------------------------------ */

/**
 * Adresses `mailto:` d'un lien, dédoublonnées et normalisées (casse, espaces,
 * encodage) : c'est sous cette forme que les ensembles se comparent.
 */
function adressesDuLien(href) {
  const brut = String(href || "");
  if (!brut.startsWith("mailto:")) return [];
  return [...new Set(
    brut.slice("mailto:".length).split("?")[0]
      .split(",").map((e) => decodeURIComponent(e).trim().toLowerCase()).filter(Boolean)
  )];
}

/**
 * Vérifie que « Écrire aux membres de la commission » écrit à la commission
 * **entière** : son président, ses rapporteurs et ceux qui y siègent.
 *
 * Le contrôle est **croisé** : il lit les liens des autres boutons du panneau
 * Contacts et s'assure que le bouton des membres porte **toutes** leurs
 * adresses — la présidence de la commission et les rapporteurs en étaient
 * auparavant exclus, alors qu'ils sont membres de la commission au même titre
 * que les assesseurs (R.811-27 et s.). Le nombre annoncé par l'intitulé est
 * comparé au nombre d'adresses distinctes du lien, et l'infobulle aux noms des
 * destinataires.
 *
 * Le parcours ouvre chaque affaire de la base (`window.appStore`) ; une affaire
 * dont nul n'a d'adresse n'a pas de bouton, et est ignorée. Comme partout dans
 * ce module, l'application est rendue dans l'état où elle a été trouvée.
 *
 *   const { verifierContacts } = await import("./tests/ecrans.test.js");
 *   await verifierContacts();
 */
export async function verifierContacts({ attente = 260 } = {}) {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const depart = location.hash;
  const store = window.appStore;
  const resultats = [];
  if (!store || typeof store.table !== "function") {
    return { total: 0, reussis: 0, echecs: 0, resultats, ignore: "base absente" };
  }
  const LABEL_MEMBRES = "Écrire aux membres de la commission";
  const AUTRES = ["Écrire au président de la commission", "Écrire aux rapporteurs"];
  try {
    location.hash = "#affaires";
    await pause(attente);
    for (const affaire of store.table("Affaires")) {
      const item = document.querySelector(`.app-list__item[data-select-table="Affaires"][data-select="${affaire.id}"]`);
      if (!item) continue;
      item.click();
      await pause(attente);
      const panneau = [...document.querySelectorAll("#app .fr-panel, #app .app-panel")]
        .find((p) => p.textContent.includes("Écrire aux interve"));
      if (!panneau) continue;
      const boutons = [...panneau.querySelectorAll(".app-contacts__actions a")];
      const trouver = (debut) => boutons.find((a) => a.textContent.trim().startsWith(debut));
      const membres = trouver(LABEL_MEMBRES);
      if (!membres) continue;
      const ecarts = [];
      const adresses = adressesDuLien(membres.getAttribute("href"));
      for (const label of AUTRES) {
        const autre = trouver(label);
        if (!autre) continue;
        for (const adresse of adressesDuLien(autre.getAttribute("href"))) {
          if (!adresses.includes(adresse)) ecarts.push(`${label} : ${adresse} n'est pas repris par le bouton des membres`);
        }
      }
      const intitule = membres.textContent.trim();
      const compte = intitule.match(/\s\((\d+)\)$/);
      if (adresses.length > 1 && (!compte || Number(compte[1]) !== adresses.length)) {
        ecarts.push(`l'intitulé « ${intitule} » n'annonce pas ${adresses.length} destinataires`);
      }
      if (adresses.length === 1 && compte) ecarts.push(`l'intitulé « ${intitule} » annonce un nombre pour un seul destinataire`);
      resultats.push({ affaire: affaire.id, destinataires: adresses.length, ok: ecarts.length === 0, ecarts });
    }
  } finally {
    location.hash = depart || "#accueil";
    await pause(attente);
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    resultats,
    ...(resultats.length ? {} : { ignore: "aucune affaire ne porte d'adresse à éprouver" }),
  };
}
