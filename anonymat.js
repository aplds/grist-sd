// Export anonyme d'une décision définitive.
//
// Une décision disciplinaire se publie : la loi impose parfois la publicité de
// la sanction, et une décision est communiquée, citée, annexée à un rapport.
// Mais elle nomme des personnes — le mis en cause, les victimes, les témoins —,
// et leur nom n'a pas à suivre la décision partout. L'usage est donc d'en
// établir une **version anonymisée**: les personnes du dossier y deviennent
// « A. B. », « B. C. », dans l'ordre où elles apparaissent.
//
// Ce que l'anonymisation ne touche pas compte autant que ce qu'elle touche :
// les membres de la formation et le secrétaire **gardent leur nom**. Ce sont
// eux qui rendent la décision — ils la signent, ils y sont nommés par leur
// qualité —, et une décision anonymisée ne se lit pas sans eux.
//
// Le travail se fait sur le **document rendu**, à l'export, et non dans le
// texte : c'est le seul endroit où l'on voit tout ce qui sera écrit — le
// chapeau, le corps, la signature, le pied de page, les visas —, et donc le
// seul où l'on peut garantir qu'aucun nom du dossier ne subsiste. Les formes
// de chaque nom sont cherchées telles qu'elles peuvent être écrites : prénom et
// nom, nom seul, prénom seul, quelle que soit la casse employée.
//
// La suite des pseudonymes suit l'ordre **du document**, celui de la lecture :
// la première personne nommée devient « A. B. », la suivante « B. C. », etc.
// Un nom qui reparaît plus loin retrouve la sienne — c'est la même personne.

import { Context, affairesDeJonction, decisionDefinitive, jonctionDe } from "./formulas.js";
import { FORMAT_DECISION, NATURE_INTERLOCUTOIRE } from "./schema.js";

/* ------------------------------------------------------------------ */
/* Décision anonymisable                                               */
/* ------------------------------------------------------------------ */

/**
 * La décision **définitive** que rédige un document, ou `null`.
 *
 * Seules les décisions définitives s'anonymisent : ce sont elles qui tranchent
 * le fond, se publient et se citent. Un acte préparatoire — ordonnance,
 * décision avant dire droit — ne règle que la marche de l'instance et n'appelle
 * pas de version anonyme. Un document d'un autre format qu'une décision
 * (`Courrier`, `Rapport`…) n'en appelle pas davantage.
 */
export function decisionAnonymisable(db, doc) {
  const ctx = new Context(db);
  const trame = doc?.Template ? ctx.byId("Trames", doc.Template) : null;
  const type = trame?.Type ? ctx.byId("Types_Trames", trame.Type) : null;
  if (String(type?.Categorie || "") !== FORMAT_DECISION) return null;
  const affaire = doc?.Affaire ? ctx.byId("Affaires", doc.Affaire) : null;
  if (!affaire) return null;
  // La décision que le document rédige : celle qu'il a désignée, ou — pour une
  // trame qui porte le jugement — la décision définitive de l'affaire.
  let decision = doc.Decision_liee ? ctx.byId("Decisions", doc.Decision_liee) : null;
  if (!decision && ctx.v("Trames", trame, "Decision_definitive")) decision = decisionDefinitive(ctx, affaire);
  if (!decision) return null;
  return String(decision.Nature || "") === NATURE_INTERLOCUTOIRE ? null : decision;
}

/* ------------------------------------------------------------------ */
/* Les personnes à effacer                                             */
/* ------------------------------------------------------------------ */

/**
 * Les personnes dont le nom s'efface : celles du **dossier**, c'est-à-dire la
 * personne mise en cause — de l'affaire et, s'il y a lieu, des affaires jointes,
 * qu'une décision commune nomme toutes — et les personnes qui y sont
 * impliquées : victimes, témoins, défenseurs, représentants.
 *
 * Les membres de la formation et le secrétaire n'en sont pas : ils figurent
 * dans `Intervenants` et `Secretaires`, que cette fonction ne lit pas. Un
 * intervenant extérieur au dossier — rapporteur hors section, représentant des
 * usagers — n'y est pas non plus : il instruit ou juge, il n'est pas partie.
 */
export function personnesAnonymisables(db, decision) {
  const affaire = decision?.Affaire
    ? (db?.Affaires || []).find((a) => Number(a.id) === Number(decision.Affaire))
    : null;
  if (!affaire) return [];
  const personnes = db?.Personnes || [];
  const parId = (id) => personnes.find((p) => Number(p.id) === Number(id)) || null;
  const dossier = [affaire, ...affairesDeJonction(db, jonctionDe(db, affaire))];
  const vues = new Set();
  const out = [];
  const ajouter = (personne) => {
    if (!personne || vues.has(personne.id)) return;
    vues.add(personne.id);
    out.push(personne);
  };
  for (const a of dossier) {
    ajouter(parId(a.Mis_en_cause));
    for (const implication of db?.Implications || []) {
      if (Number(implication.Affaire) !== Number(a.id)) continue;
      ajouter(parId(implication.Personne));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Les écritures d'un nom                                              */
/* ------------------------------------------------------------------ */

/** Seuil en deçà duquel une écriture est trop courte pour être un nom. */
const LONGUEUR_MINIMALE = 3;

/**
 * Les écritures sous lesquelles un nom peut paraître : « Prénom NOM »,
 * « NOM Prénom », le nom seul, le prénom seul. Les deux ordres sont utiles —
 * une décision écrit « Karim BENSAID » dans ses visas et « M. BENSAID » dans
 * son dispositif —, et le prénom seul l'est aussi : une phrase qui dit « Karim
 * a reconnu les faits » nommerait autrement la même personne. L'écriture
 * « NOM, Prénom », celle d'un bordereau ou d'une pièce d'identité, s'y ajoute.
 */
export function variantesDe(personne) {
  const prenom = String(personne?.Prenom ?? "").trim().replace(/\s+/g, " ");
  const nom = String(personne?.Nom ?? "").trim().replace(/\s+/g, " ");
  const out = [];
  const ajouter = (texte) => {
    const t = String(texte || "").trim().replace(/\s+/g, " ");
    if (t.length >= LONGUEUR_MINIMALE && !out.includes(t)) out.push(t);
  };
  if (prenom && nom) {
    ajouter(`${prenom} ${nom}`);
    ajouter(`${nom} ${prenom}`);
    ajouter(`${nom}, ${prenom}`);
  }
  ajouter(nom);
  ajouter(prenom);
  return out;
}

/** Une écriture ramenée à sa forme de comparaison : casse et espaces. */
const normaliser = (texte) => String(texte ?? "").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();

/** Échappe une écriture pour en faire un motif, sans figer ses espaces. */
function motifDe(texte) {
  return String(texte)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s\\u00a0]+");
}

/**
 * Règle de remplacement des personnes : une **seule** expression régulière les
 * réunit toutes, leurs écritures rangées de la plus longue à la plus courte —
 * c'est ce qui fait gagner « Karim BENSAID » sur « BENSAID », et « BENSAID »
 * sur « Karim » —, et une table associe l'écriture reconnue à sa personne.
 *
 * Les limites de mot sont posées à la main, par un groupe qui capture le
 * caractère précédent (`^` ou un non-lettre) et une anticipation du caractère
 * suivant : « ANDRÉ » ne se cache pas dans « ANDRÉE », ni « Hugo » dans
 * « Hugolin ». La comparaison ne tient pas compte de la casse : « BENSAID »,
 * « Bensaid » et « bensaid » désignent la même personne, et c'est la personne
 * qu'il faut effacer, non l'écriture d'un jour.
 */
function regleDe(personnes) {
  const index = new Map();
  const ecritures = [];
  for (const personne of personnes) {
    for (const texte of variantesDe(personne)) {
      const cle = normaliser(texte);
      if (!index.has(cle)) index.set(cle, personne);
      if (!ecritures.includes(cle)) ecritures.push(cle);
    }
  }
  if (!ecritures.length) return null;
  const parLongueur = [...ecritures].sort((a, b) => b.length - a.length);
  const alternance = parLongueur.map(motifDe).join("|");
  return {
    index,
    regex: new RegExp(`(^|[^\\p{L}\\p{N}])(${alternance})(?=[^\\p{L}\\p{N}]|$)`, "giu"),
  };
}

/* ------------------------------------------------------------------ */
/* Pseudonymes                                                         */
/* ------------------------------------------------------------------ */

/** A, B, … Z, puis AA, AB… — au-delà de vingt-six personnes. */
function lettre(rang) {
  let reste = rang + 1;
  let texte = "";
  while (reste > 0) {
    const r = (reste - 1) % 26;
    texte = String.fromCharCode(65 + r) + texte;
    reste = Math.floor((reste - 1) / 26);
  }
  return texte;
}

/** « A. B. », « B. C. », « C. D. »… pour la personne de ce rang. */
const pseudonyme = (rang) => `${lettre(rang)}. ${lettre(rang + 1)}.`;

/* ------------------------------------------------------------------ */
/* Anonymisation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Anonymise un texte : chaque écriture reconnue devient le pseudonyme de sa
 * personne, attribué au premier passage — l'ordre du document fait les
 * pseudonymes, et un nom qui reparaît garde le sien.
 */
function anonymiserTexte(texte, regle, etat) {
  return String(texte).replace(regle.regex, (entier, avant, trouve) => {
    const personne = regle.index.get(normaliser(trouve));
    if (!personne) return entier;
    let etiquette = etat.labels.get(personne.id);
    if (!etiquette) {
      etiquette = pseudonyme(etat.labels.size);
      etat.labels.set(personne.id, etiquette);
    }
    return avant + etiquette;
  });
}

/**
 * Le document rendu, ses personnes effacées. Le HTML est écrit dans le
 * navigateur, puis relu : les noms sont remplacés dans les **nœuds de texte**,
 * dans l'ordre du document — c'est ce que la pagination et les exports lisent,
 * et c'est là que « la première personne nommée » a un sens.
 *
 * Renvoie `{ html, labels }` : `labels` associe l'identifiant de chaque
 * personne à son pseudonyme, pour ce qui doit le rappeler à l'auteur.
 */
export function anonymiserHtml(html, personnes, regleFournie = null) {
  const regle = regleFournie || regleDe(personnes || []);
  if (!regle) return { html, labels: new Map() };
  const parsed = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const etat = { labels: new Map() };
  const racine = parsed.body || parsed.documentElement;
  if (racine) {
    const noeuds = [];
    const parcours = parsed.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent && parent.closest("script, style")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (parcours.nextNode()) noeuds.push(parcours.currentNode);
    for (const node of noeuds) {
      const remplace = anonymiserTexte(node.nodeValue, regle, etat);
      if (remplace !== node.nodeValue) node.nodeValue = remplace;
    }
  }
  return { html: `<!DOCTYPE html>\n${parsed.documentElement.outerHTML}`, labels: etat.labels };
}

/**
 * Le document exporté en version anonyme, ou `null` quand il n'y a rien à
 * anonymiser — document qui n'est pas une décision définitive, ou décision sans
 * personne au dossier.
 */
export function anonymiserDocument(db, doc, html) {
  const decision = decisionAnonymisable(db, doc);
  if (!decision) return null;
  const personnes = personnesAnonymisables(db, decision);
  if (!personnes.length) return null;
  const { html: anonyme, labels } = anonymiserHtml(html, personnes);
  return { html: anonyme, labels, personnes, decision };
}
