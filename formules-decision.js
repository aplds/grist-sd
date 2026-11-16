// Formules de décision — les pièces qui encadrent le raisonnement.
//
// Une décision de formation de jugement suit un ordre qui ne varie pas : les
// **visas** (les textes et les pièces sur lesquels elle s'appuie), ce qui a été
// **entendu** à l'audience, puis le raisonnement — les considérants, qui vivent
// dans leur propre répertoire (voir `considerants.js`) — et enfin le
// **dispositif** : le mot DÉCIDE, les articles, la signature.
//
// Ces formules se répètent d'une décision à l'autre, mot pour mot, et c'est
// précisément ce qui les rend coûteuses à réécrire : elles sont donc livrées
// ici, prêtes à être insérées au curseur dans le texte de la décision, avec les
// balises du publipostage (`{{Affaire}}.Formule`, `{{Decision}}.Libelle_decision`
// …) là où la donnée de l'affaire doit venir d'elle-même. Les crochets `[…]`
// marquent ce que le rédacteur complète : une date, un nom, une pièce.
//
// Deux nuances, et une seule source : le **domaine** d'une formule dit le code
// dont elle est tirée — un visa du code rural ne s'énonce pas dans une section
// régie par le code de l'éducation —, et sa **nature** dit si elle sert à une
// décision qui tranche le fond ou à une décision avant dire droit. L'atelier de
// rédaction ne propose donc à chaque fois que les formules applicables, tout en
// laissant les autres à portée de main (voir `formulesPour`).

import { FORMAT_DECISION, NATURE_INTERLOCUTOIRE, TUTELLE_AGRI, estSusceptibleDeRecours } from "./schema.js";
import { regimeOf, tramesPour } from "./regimes.js";
import { juridictionRecours, RECOURS_CNESER, RECOURS_CNESERAAV, RECOURS_TRIBUNAL_ADMINISTRATIF } from "./procedure.js";

/* ------------------------------------------------------------------ */
/* Les formules livrées                                                */
/* ------------------------------------------------------------------ */

/** Les trois moments de la décision, dans l'ordre où ils s'écrivent. */
export const GROUPES_FORMULES = [
  { id: "visas", label: "Visas", iconName: "list-check", hint: "Les textes et les pièces sur lesquels la décision s'appuie." },
  { id: "audience", label: "Audience", iconName: "mic-line", hint: "Ce qui a été entendu, et le délibéré." },
  { id: "dispositif", label: "Dispositif", iconName: "scales-3-line", hint: "DÉCIDE, les articles, la signature." },
];

/**
 * `nature` vide vaut pour toute décision ; `domaine` vide vaut pour tout
 * établissement. `html` est inséré au curseur tel quel — les paragraphes y sont
 * explicites, comme dans le texte d'une décision.
 */
export const FORMULES = [
  /* --- Visas ------------------------------------------------------- */

  {
    id: "vu-code-rural",
    groupe: "visas",
    domaine: "agriculture",
    label: "Vu le code rural et de la pêche maritime",
    html: "<p><strong>Vu</strong> le code rural et de la pêche maritime ;</p>",
  },
  {
    id: "vu-code-education",
    groupe: "visas",
    domaine: "education",
    label: "Vu le code de l'éducation",
    html: "<p><strong>Vu</strong> le code de l'éducation ;</p>",
  },
  {
    id: "vu-saisine",
    groupe: "visas",
    label: "Vu la saisine de la section disciplinaire",
    html: "<p><strong>Vu</strong> la saisine de la section disciplinaire le {{Affaire_Date_de_saisine}}.date(@long) "
      + "contre {{Affaire}}.Formule {{Affaire}}.Nom_complet ;</p>",
  },
  {
    id: "vu-rapport",
    groupe: "visas",
    nature: "definitive",
    label: "Vu le rapport d'instruction",
    html: "<p><strong>Vu</strong> le rapport d'instruction ;</p>",
  },
  {
    id: "vu-pieces",
    groupe: "visas",
    label: "Vu les pièces du dossier",
    html: "<p><strong>Vu</strong> les pièces du dossier ;</p>",
  },
  {
    id: "vu-convocation",
    groupe: "visas",
    label: "Vu la convocation adressée aux parties",
    html: "<p><strong>Vu</strong> la convocation adressée aux parties le […], dans le délai prévu par les textes ;</p>",
  },
  {
    id: "vu-observations",
    groupe: "visas",
    label: "Vu les observations écrites du mis en cause",
    html: "<p><strong>Vu</strong> les observations écrites présentées par {{Affaire}}.Formule {{Affaire}}.Nom_complet, "
      + "enregistrées au secrétariat de la section disciplinaire le […], et celles présentées oralement en séance ;</p>",
  },
  {
    id: "vu-requalification",
    groupe: "visas",
    label: "Vu la requalification du motif de saisine",
    html: "<p><strong>Vu</strong> la proposition de requalification du motif de saisine adressée au mis en cause "
      + "le […], et ses observations en réponse ;</p>",
  },
  {
    id: "vu-reglement",
    groupe: "visas",
    label: "Vu le règlement des études ou de la scolarité",
    html: "<p><strong>Vu</strong> le règlement […], applicable à l'année universitaire […], et notamment "
      + "son article […] ;</p>",
  },
  {
    id: "vu-delegation",
    groupe: "visas",
    label: "Vu la saisine de l'autorité ayant engagé les poursuites",
    html: "<p><strong>Vu</strong> le courrier du […] par lequel {{Affaire}}.Autorite_de_saisine a saisi la section "
      + "disciplinaire aux fins d'examiner les faits reprochés à {{Affaire}}.Formule {{Affaire}}.Nom_complet ;</p>",
  },

  /* --- Audience ---------------------------------------------------- */

  {
    id: "apres-avoir-entendu",
    groupe: "audience",
    label: "Après avoir entendu :",
    html: "<p>Après avoir entendu :</p>",
  },
  {
    id: "entendu-rapport",
    groupe: "audience",
    label: "— la lecture du rapport d'instruction",
    html: "<p>— la lecture du rapport d'instruction ;</p>",
  },
  {
    id: "entendu-observations",
    groupe: "audience",
    label: "— les observations du mis en cause",
    html: "<p>— les observations formulées par {{Affaire}}.Formule {{Affaire}}.Nom_complet, ayant eu la parole "
      + "en dernier ;</p>",
  },
  {
    id: "entendu-victime",
    groupe: "audience",
    label: "— les observations de la victime",
    html: "<p>— les observations de […], entendue en qualité de victime ;</p>",
  },
  {
    id: "entendu-temoin",
    groupe: "audience",
    label: "— l'audition d'un témoin",
    html: "<p>— l'audition de […], en qualité de témoin, qui a été entendu dans les conditions prévues par les textes ;</p>",
  },
  {
    id: "delibere",
    groupe: "audience",
    label: "Le délibéré",
    html: "<p>La formation de jugement s'étant retirée pour délibérer, hors la présence des parties et de leurs "
      + "conseils, dans les conditions prévues par les textes ;</p>",
  },
  {
    id: "considerant-intro",
    groupe: "audience",
    label: "Considérant ce qui suit :",
    html: "<p>Considérant ce qui suit :</p>",
  },
  {
    id: "considerant-slot",
    groupe: "audience",
    label: "Emplacement d'un considérant (à compléter)",
    html: "<p class=\"considere\">[…]</p>",
  },

  /* --- Dispositif -------------------------------------------------- */

  {
    id: "decide",
    groupe: "dispositif",
    label: "DÉCIDE",
    html: "<p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p>",
  },
  {
    id: "article-1",
    groupe: "dispositif",
    nature: "definitive",
    label: "Article 1er : la sanction prononcée",
    html: "<p class=\"article\"><u>Article 1er :</u> Il est prononcé à l'encontre de {{Affaire}}.Formule {{Affaire}}.Nom_complet "
      + "la décision suivante : <strong>{{Decision}}.Libelle_decision</strong>.</p>",
  },
  {
    id: "article-notification",
    groupe: "dispositif",
    label: "Article : la notification",
    html: "<p class=\"article\"><u>Article 2 :</u> La présente décision sera notifiée à {{Affaire}}.Formule {{Affaire}}.Nom_complet "
      + "ainsi qu'à l'autorité ayant engagé les poursuites, dans les conditions prévues par le code de l'éducation.</p>",
  },
  {
    id: "article-publication",
    groupe: "dispositif",
    label: "Article : la publication anonyme",
    html: "<p class=\"article\"><u>Article 3 :</u> La présente décision fera l'objet d'une publication anonyme au sein de "
      + "[…], afin que la sanction demeure dissuasive.</p>",
  },
  {
    id: "article-effet",
    groupe: "dispositif",
    label: "Article : l'absence d'effet sur les épreuves",
    html: "<p class=\"article\"><u>Article :</u> La présente décision n'entraîne pas la nullité des épreuves subies par l'intéressé.</p>",
  },
  {
    id: "article-recours-tribunal",
    groupe: "dispositif",
    nature: "definitive",
    recours: true,
    juridiction: RECOURS_TRIBUNAL_ADMINISTRATIF,
    label: "Article : les voies de recours (tribunal administratif)",
    html: "<p class=\"article\"><u>Article :</u> La présente décision peut faire l'objet d'un recours contentieux devant le tribunal "
      + "administratif compétent dans le ressort duquel se trouve le siège de l'établissement, dans un délai de deux "
      + "mois à compter de sa notification.</p>",
  },
  {
    id: "article-recours",
    groupe: "dispositif",
    nature: "definitive",
    recours: true,
    juridiction: RECOURS_CNESER,
    label: "Article : les voies de recours (CNESER)",
    html: "<p class=\"article\"><u>Article :</u> La présente décision peut faire l'objet d'un recours devant le Conseil national de "
      + "l'enseignement supérieur et de la recherche dans un délai de deux mois à compter de sa notification.</p>",
  },
  {
    id: "article-recours-cneseraav",
    groupe: "dispositif",
    nature: "definitive",
    recours: true,
    juridiction: RECOURS_CNESERAAV,
    label: "Article : les voies de recours (CNESERAAV)",
    html: "<p class=\"article\"><u>Article :</u> La présente décision peut faire l'objet d'un recours devant le Conseil national de "
      + "l'enseignement supérieur et de la recherche agricole, alimentaire et vétérinaire (CNESERAAV) dans un délai "
      + "de deux mois à compter de sa notification.</p>",
  },
  {
    id: "article-renvoi",
    groupe: "dispositif",
    nature: NATURE_INTERLOCUTOIRE,
    label: "Article : le renvoi de l'examen de l'affaire",
    html: "<p class=\"article\"><u>Article 1er :</u> L'examen de l'affaire est renvoyé à une séance ultérieure, dont la date sera "
      + "fixée par le président de la formation de jugement.</p>",
  },
  {
    id: "article-supplement",
    groupe: "dispositif",
    nature: NATURE_INTERLOCUTOIRE,
    label: "Article : le supplément d'instruction",
    html: "<p class=\"article\"><u>Article 1er :</u> Il est procédé à un supplément d'instruction portant sur […], confié au "
      + "rapporteur, afin que soient versées au dossier les pièces suivantes : […].</p>",
  },
  {
    id: "article-expertise",
    groupe: "dispositif",
    nature: NATURE_INTERLOCUTOIRE,
    label: "Article : l'expertise",
    html: "<p class=\"article\"><u>Article 1er :</u> Il est ordonné une expertise aux fins de […], confiée à […], qui établira son "
      + "rapport dans le délai de […] et le transmettra au secrétariat de la section disciplinaire.</p>",
  },
  {
    id: "fait-a",
    groupe: "dispositif",
    label: "Fait à…, le…",
    html: "<p>Fait à […], le {{Decision}}.Date_du_delibere.date(@long).</p>",
  },
  {
    id: "signature-formation",
    groupe: "dispositif",
    label: "Signature du président de la formation de jugement (déjà portée par la feuille de style)",
    html: "<p>{{Affaire_Section}}.Formule de la section disciplinaire,</p><p>{{Affaire}}.C_President</p>",
  },
  {
    id: "signature-president",
    groupe: "dispositif",
    label: "Signature du président de la section (déjà portée par la feuille de style)",
    html: "<p>Le président de la section disciplinaire,</p><p>{{Affaire}}.C_President</p>",
  },
];

/* ------------------------------------------------------------------ */
/* Les intitulés d'article                                             */
/* ------------------------------------------------------------------ */

/**
 * Reconnaît l'intitulé d'un article : « Article 1er : », « Article 2 : », ou
 * celui, non numéroté, que les formules livrent — « Article : ». La formule est
 * volontairement stricte : elle exige le **deux-points** qui suit le mot, de
 * sorte qu'une citation qui commence par « Article R.811-13 du code de
 * l'éducation… » reste un considérant, et n'attrape pas un numéro d'article.
 *
 * C'est ici que le motif est écrit — avec l'intitulé — parce que c'est ici que
 * sont écrites les formules du dispositif : les articles livrés sont donc
 * reconnus par l'outil qui les numérote (voir `numeroterArticles`,
 * views/decision-redaction.js), et la règle se vérifie sans navigateur.
 */
export const MOTIF_INTITULE_ARTICLE = /^\s*Article\s*(?:\d+\s*(?:er|re|ère)?)?\s*:/i;

export function estIntituleArticle(texte) {
  return MOTIF_INTITULE_ARTICLE.test(String(texte ?? ""));
}

/** L'intitulé d'un article, dans l'ordre du dispositif : le premier est « 1er ». */
export function intituleArticle(n) {
  return n === 1 ? "Article 1er :" : `Article ${n} :`;
}

/* ------------------------------------------------------------------ */
/* Ce qui vaut pour cette décision-là                                  */
/* ------------------------------------------------------------------ */

/** Domaine des textes pour une section : son ministère de rattachement. */
export function domaineDeLaSection(section) {
  return String(section?.Tutelle || "") === TUTELLE_AGRI ? "agriculture" : "education";
}

/** La section disciplinaire de la décision, ou `null`. */
export function sectionDeLaDecision(store, decision) {
  const affaire = decision?.Affaire ? store.byId("Affaires", decision.Affaire) : null;
  return affaire?.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
}

/** Identifiant du domaine d'une décision, lu sur la section de son affaire. */
export function domaineDeLaDecision(store, decision) {
  return domaineDeLaSection(sectionDeLaDecision(store, decision));
}

/** Nature de la décision : « definitive », ou l'article R.811-40 restant à part. */
export function natureDeLaDecision(decision) {
  return String(decision?.Nature || "") === NATURE_INTERLOCUTOIRE ? NATURE_INTERLOCUTOIRE : "definitive";
}

/**
 * Les formules proposées à l'atelier, groupées par moment de la décision.
 *
 * Chaque entrée porte `applicable` : la formule convient au domaine, à la
 * nature et à la juridiction de recours de cette décision-là. Les autres
 * restent dans la liste — une décision de section agricole cite parfois le code
 * de l'éducation — mais sont rangées après, sous une mention qui dit pourquoi
 * elles ne sont pas mises en avant.
 */
export function formulesPour(store, decision) {
  const domaine = domaineDeLaDecision(store, decision);
  const nature = natureDeLaDecision(decision);
  const juridiction = juridictionRecours(sectionDeLaDecision(store, decision)).court;
  // Les formules qui énoncent la voie de recours ne valent que pour une décision
  // qui en ouvre une : une sanction, ou l'abandon des poursuites.
  const recours = estSusceptibleDeRecours(decision);
  return GROUPES_FORMULES.map((g) => ({
    ...g,
    formules: FORMULES
      .filter((f) => f.groupe === g.id)
      .map((f) => ({
        ...f,
        applicable: (!f.domaine || f.domaine === domaine)
          && (!f.nature || f.nature === nature)
          && (!f.juridiction || f.juridiction === juridiction)
          && (!f.recours || recours),
      }))
      .sort((a, b) => (a.applicable === b.applicable ? 0 : a.applicable ? -1 : 1)),
  })).filter((g) => g.formules.length);
}

/** Une formule par son identifiant, ou `null`. */
export function formuleDe(id) {
  return FORMULES.find((f) => f.id === id) || null;
}

/* ------------------------------------------------------------------ */
/* Squelette d'une décision                                            */
/* ------------------------------------------------------------------ */

/**
 * Le squelette d'une décision : l'ordre des pièces, les visas courants, le
 * « Considérant ce qui suit : », le dispositif — le DÉCIDE et ses articles. La
 * **signature n'y figure pas** : elle appartient à la feuille de style du
 * format, qui la porte déjà pour toutes ses trames — pour une décision de la
 * formation de jugement, celles du président de la formation et du secrétaire.
 * L'y ajouter la doublerait.
 *
 * Il sert deux fois. À la création d'un document de décision quand la trame
 * choisie n'apporte pas de texte — une décision avant dire droit, par exemple,
 * n'a pas de trame modèle —, et au rédacteur qui préfère repartir d'une page
 * blanche : « Composer le squelette » remplace alors le texte en cours, après
 * confirmation. Les balises du publipostage y sont conservées : le squelette
 * reste vivant, et lit les données de l'affaire jusqu'au dernier moment.
 */
export function echafaudageDecision(store, decision) {
  const interlocutoire = natureDeLaDecision(decision) === NATURE_INTERLOCUTOIRE;
  // Les textes visés : le code de l'éducation, où se lisent les sanctions, et —
  // dans un établissement qui en relève — le code rural et de la pêche
  // maritime, qui lui rend la procédure applicable.
  const agri = domaineDeLaSection(sectionDeLaDecision(store, decision)) === "agriculture";
  const visas = [
    ...(agri ? ["vu-code-rural"] : []),
    "vu-code-education", "vu-saisine", "vu-rapport", "vu-pieces",
  ];
  // Le recours ne se forme pas contre un acte préparatoire : une décision avant
  // dire droit n'en porte donc pas l'article.
  const articles = interlocutoire
    ? ["article-renvoi", "article-notification", "fait-a"]
    : ["article-1", "article-notification", "article-publication", "fait-a"];
  const morceaux = [
    "<p><strong>La formation de jugement,</strong></p>",
    "<p>S'étant réunie le {{Seance_d_examen_Date}}.date(@long), sous la présidence de {{Affaire}}.C_President, "
      + "{{Affaire}}.C_Qualite,</p>",
    "<p>Assistée lors des débats par {{Secretaire}}.Nom_complet, secrétaire de la section disciplinaire,</p>",
    ...visas.filter((id) => !(interlocutoire && id === "vu-rapport")).map((id) => formuleDe(id)?.html).filter(Boolean),
    formuleDe("apres-avoir-entendu").html,
    formuleDe("entendu-rapport").html,
    formuleDe("entendu-observations").html,
    formuleDe("considerant-intro").html,
    "<p class=\"considere\">[…]</p>",
    formuleDe("decide").html,
    ...articles.map((id) => formuleDe(id)?.html).filter(Boolean),
  ];
  return morceaux.join("");
}

/* ------------------------------------------------------------------ */
/* Le document qui porte la décision                                   */
/* ------------------------------------------------------------------ */

/**
 * Le document qui rédige une décision : la ligne de `Generateur` qui la déclare
 * comme décision liée, et dont la trame relève du format **Décision**. Un seul
 * document rédige une décision donnée — c'est lui qui porte le texte, et donc
 * l'espace de rédaction de la décision. Une **ordonnance** n'entre jamais dans
 * cette recherche : c'est l'acte d'un président, qui règle la marche de
 * l'instance et n'est pas une décision.
 */
export function documentDeDecision(store, decision) {
  if (!decision) return null;
  const categorieDe = (d) => {
    const trame = d.Template ? store.byId("Trames", d.Template) : null;
    const type = trame?.Type ? store.byId("Types_Trames", trame.Type) : null;
    return String(type?.Categorie || "");
  };
  return store.table("Generateur").find((d) =>
    Number(d.Decision_liee) === Number(decision.id) && categorieDe(d) === FORMAT_DECISION) || null;
}

/**
 * La trame de décision applicable : celle de la formation de jugement, choisie
 * parmi les trames compatibles avec la section (régime, tutelle, type de
 * section). La décision définitive prend la trame qui la porte explicitement ;
 * une décision avant dire droit prend la première trame de décision qui ne
 * tranche pas le fond — renvoi, supplément d'instruction —, faute de quoi elle
 * reçoit la trame de décision définitive : le rédacteur la corrige toujours au
 * panneau « Trame », et le squelette peut la remplacer.
 */
export function tramePourDecision(store, decision) {
  const affaire = decision?.Affaire ? store.byId("Affaires", decision.Affaire) : null;
  const section = affaire?.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  const categorie = (t) => {
    const type = t?.Type ? store.byId("Types_Trames", t.Type) : null;
    return String(type?.Categorie || "");
  };
  const decisions = tramesPour(store.db, section).filter((t) => categorie(t) === FORMAT_DECISION);
  if (!decisions.length) return null;
  const definitives = decisions.filter((t) => Number(t.Decision_definitive));
  const autres = decisions.filter((t) => !Number(t.Decision_definitive));
  const interlocutoire = natureDeLaDecision(decision) === NATURE_INTERLOCUTOIRE;
  return (interlocutoire ? (autres[0] || definitives[0]) : (definitives[0] || autres[0])) || null;
}

/** Le régime de la section d'une décision — pour les catalogues de sanctions. */
export function regimeDeLaDecision(store, decision) {
  const affaire = decision?.Affaire ? store.byId("Affaires", decision.Affaire) : null;
  const section = affaire?.Section ? store.byId("Sections_disciplinaires", affaire.Section) : null;
  return { affaire: affaire || null, section: section || null, regime: regimeOf(section) };
}
