// Les régimes (usagers / enseignants-chercheurs), les catalogues et les
// contrôles de régularité.
//
// La connaissance juridique elle-même — organes, composition, instruction,
// autorités, délais, prescription — vit dans `procedure.js`. Ce fichier en
// tire ce qui se vérifie affaire par affaire (`controlesRegularite`) et ce que
// l'établissement peut régler (seuils, catalogues de sanctions et de motifs).
//
// Tous les contrôles sont **indicatifs** : ils signalent, ils ne bloquent
// jamais. Un contrôle a l'un de ces statuts :
//
//  - `ok` : la condition est remplie ;
//  - `alerte` : une règle paraît méconnue (à corriger) ;
//  - `manquant` : la donnée nécessaire n'est pas renseignée ;
//  - `info` : remarque de contexte, sans incidence sur la régularité.

import { Context, affairesDeJonction, butoirInstruction, decisionDefinitive, formatDateFr, intervenantsDe, jonctionDe, parametre, parametreNumerique, affaireDeTeteDe } from "./formulas.js";
import { TUTELLE_COURTE_AGRI, TUTELLE_COURTE_MESR, TOUTES, NATURE_INTERLOCUTOIRE, MESURES_AVANT_DIRE_DROIT, TYPE_ACADEMIQUE, FORMATS_RENDUS, estCloseEtat, estSusceptibleDeRecours } from "./schema.js";
import { hoteDossier, lienDossier } from "./dossier.js";
import {
  procedure,
  collegeDe,
  collegeDuCorps,
  compositionAttendue,
  effectifFormation,
  libelleFormation,
  libelleOngletFormation,
  ongletsAffaire,
  suitProcedureR811_40,
  tutelleCourte,
  REGIME_USAGERS,
  REGIME_EC,
} from "./procedure.js";

// Réexportés : les écrans les lisaient autrefois ici, et continuent de le
// faire — la définition, elle, est dans `procedure.js`.
export { libelleFormation, libelleOngletFormation, ongletsAffaire, suitProcedureR811_40, REGIME_USAGERS, REGIME_EC };

/** Régime d'une section (`Public`), ou `Usagers` par défaut. */
export function regimeOf(section) {
  return section?.Public === REGIME_EC ? REGIME_EC : REGIME_USAGERS;
}

export function estEC(section) {
  return regimeOf(section) === REGIME_EC;
}

/** Régime porté par une affaire (via sa section). */
export function regimeDeL_affaire(db, affaire) {
  const section = affaire?.Section ? (db.Sections_disciplinaires || []).find((s) => s.id === Number(affaire.Section)) : null;
  return regimeOf(section);
}

/* ------------------------------------------------------------------ */
/* Catalogues applicables                                              */
/* ------------------------------------------------------------------ */

const auRegime = (regime) => (row) => row.Public === regime || row.Public === "Les deux" || !row.Public;
const aLaTutelle = (courte) => (row) => !row.Tutelle || row.Tutelle === "Les deux" || row.Tutelle === courte;

/**
 * Sanctions proposables pour une section : filtrées par régime et, lorsqu'il
 * est fourni, par tutelle. La procédure étant celle du code de l'éducation
 * dans les deux cas, le filtre par tutelle ne sert qu'aux rares sanctions
 * propres à un texte.
 */
export function sanctionsPour(db, regime, section = null) {
  const courte = section ? tutelleCourte(section.Tutelle) : null;
  return (db.Sanctions || []).filter(auRegime(regime)).filter(courte ? aLaTutelle(courte) : () => true);
}

export function motifsPour(db, regime, section = null) {
  const courte = section ? tutelleCourte(section.Tutelle) : null;
  return (db.Motifs || []).filter(auRegime(regime)).filter(courte ? aLaTutelle(courte) : () => true);
}

/**
 * Issues de procédure qui ne sont pas des sanctions du catalogue : elles
 * s'ajoutent aux libellés de sanctions pour former les choix du champ
 * « Texte retenu » d'une décision définitive.
 */
export const ISSUES_PROCEDURE = ["Abandon des poursuites"];

/**
 * Textes de décision proposables pour une section : les sanctions de son
 * catalogue, puis les issues de procédure. La liste suit donc le régime et la
 * tutelle — un enseignant-chercheur ne se voit pas proposer « exclusion de
 * tout établissement public d'enseignement supérieur », réservée aux usagers.
 *
 * Pour une décision avant dire droit (`nature === NATURE_INTERLOCUTOIRE`), la
 * liste est tout autre : ce sont les mesures qui règlent la marche de
 * l'instance, jamais une sanction.
 */
export function decisionsPour(db, regime, section = null, { nature = "" } = {}) {
  if (nature === NATURE_INTERLOCUTOIRE) return [...MESURES_AVANT_DIRE_DROIT];
  const sanctions = sanctionsPour(db, regime, section).map((s) => s.Libelle);
  return [...sanctions, ...ISSUES_PROCEDURE];
}

/**
 * Décisions d'une affaire : celles qui tranchent le fond (sanctions et issues
 * de procédure — les **décisions définitives**) et celles qui ne font que
 * régler la marche de l'instance (les décisions avant dire droit).
 *
 * Ce sont les décisions **propres** à l'affaire : une affaire jointe à une
 * autre n'en a pas, et lit celle de son affaire de tête (voir
 * `decisionDefinitiveDe`).
 */
export function decisionsDefinitivesDe(c, affaire) {
  return c.children("Decisions", affaire).filter((x) => x.Nature !== NATURE_INTERLOCUTOIRE);
}

/**
 * Décision définitive de l'affaire, s'il y en a une. Une décision avant dire
 * droit n'en tient jamais lieu : tant que le fond n'est pas tranché, une
 * affaire n'a pas de décision définitive, et tout ce qui s'y rattache
 * (recours, champs d'une trame « Décision définitive ») attend qu'elle le
 * soit.
 *
 * **Jonction** : une affaire jointe lit la décision de son affaire de tête.
 * Une affaire n'a donc, à tout moment, qu'une seule décision définitive — la
 * sienne, ou celle qui vaut pour le groupe.
 */
export function decisionDefinitiveDe(c, affaire) {
  return decisionDefinitive(c, affaire);
}

/**
 * L'affaire qui **porte** la décision : l'affaire elle-même, ou son affaire de
 * tête lorsqu'elle est jointe. C'est là que se saisit la décision, et là que
 * se créent les recours : la décision d'une jonction est une décision
 * ordinaire, rattachée à une affaire, ce qui la laisse intacte si la jonction
 * est défaite.
 */
export function affairePorteuseDeLaDecision(c, affaire) {
  return affaireDeTeteDe(c.db, affaire) || affaire;
}

/** Les affaires d'une jonction, affaire de tête en premier. */
export function affairesDeLaJonction(c, jonction) {
  return affairesDeJonction(c.db, jonction);
}

/** L'affaire est-elle l'affaire de tête de sa jonction ? */
export function estAffaireDeTete(c, affaire) {
  const jonction = jonctionDe(c.db, affaire);
  return !!jonction && Number(jonction.Affaire_de_tete) === Number(affaire?.id);
}

/** Numéros des affaires d'une jonction, dans l'ordre. */
export function numerosDeLaJonction(c, jonction) {
  return affairesDeJonction(c.db, jonction)
    .map((a) => String(c.v("Affaires", a, "Numero") ?? "").trim())
    .filter(Boolean);
}

/**
 * Recours formés contre une décision.
 *
 * Ils se rattachent à la **décision** contestée (`Recours.Decision`), non à
 * l'affaire : c'est la décision qui est déférée au juge — le tribunal
 * administratif du ressort du siège de l'établissement pour un usager, le
 * CNESER ou le CNESERAAV pour un enseignant-chercheur. Compté par l'affaire,
 * le nombre de recours serait faux dès
 * qu'une affaire compte plusieurs décisions, ou qu'une décision est rendue
 * pour plusieurs affaires.
 */
export function recoursDe(c, decision) {
  if (!decision) return [];
  return c.table("Recours").filter((x) => Number(x.Decision) === Number(decision.id));
}

export { affaireDeTeteDe, affairesDeJonction, jonctionDe };

/* ------------------------------------------------------------------ */
/* Trames applicables                                                  */
/* ------------------------------------------------------------------ */

const auFiltre = (valeur, cible) => !valeur || valeur === TOUTES || valeur === "Les deux" || valeur === cible;

/**
 * Trames proposables pour une section : filtrées par régime, par tutelle et
 * par type de section. Une valeur vide, « Toutes » ou « Les deux » vaut pour
 * toutes les procédures — c'est le cas des trames génériques.
 */
export function tramesPour(db, section = null) {
  const rows = db.Trames || [];
  if (!section) return rows;
  const regime = regimeOf(section);
  const tutelle = tutelleCourte(section.Tutelle);
  const type = section.Type_de_section || "";
  return rows.filter((t) =>
    auFiltre(t.Public, regime) && auFiltre(t.Tutelle, tutelle) && auFiltre(t.Type_de_section, type));
}

/* ------------------------------------------------------------------ */
/* Paramètres                                                          */
/* ------------------------------------------------------------------ */

/**
 * Les seuils réglables, avec leur valeur par défaut. La table `Parametres` les
 * porte ; `seedDb()` les y installe, et `installStructure()` les crée dans un
 * document neuf. La **clé** est technique : c'est elle que lisent les
 * contrôles, jamais le libellé.
 */
export const PARAMS = {
  prescription_annees: {
    nom: "Prescription de l'action disciplinaire (personnels)",
    categorie: "Prescription",
    unite: "années",
    defaut: 3,
    description: "Durée au-delà de laquelle l'action disciplinaire est prescrite pour un personnel, à compter de la date de connaissance des faits (code général de la fonction publique, art. L. 532-2). Ne concerne pas les usagers : les poursuites engagées à leur égard ne sont pas soumises à prescription.",
  },
  delai_convocation_jours: {
    nom: "Délai minimal avant la séance",
    categorie: "Délais",
    unite: "jours",
    defaut: 15,
    description: "Nombre de jours devant séparer la convocation de la séance : quinze jours pour la commission de discipline (R.811-31) comme pour la séance de jugement (R.712-35).",
  },
  delai_entretien_r811_40_jours: {
    nom: "Délai de convocation à l'entretien (R.811-40)",
    categorie: "Délais",
    unite: "jours",
    defaut: 8,
    description: "Dans la procédure de l'article R.811-40, nombre de jours devant séparer la convocation de l'entretien (huit jours au moins).",
  },
  delai_reponse_proposition_jours: {
    nom: "Délai de réponse à la proposition (R.811-40)",
    categorie: "Délais",
    unite: "jours",
    defaut: 15,
    description: "Dans la procédure de l'article R.811-40, délai laissé à l'usager pour accepter ou refuser la proposition de sanction (quinze jours).",
  },
  delai_recours_mois: {
    nom: "Délai de recours",
    categorie: "Délais",
    unite: "mois",
    defaut: 2,
    description: "Durée pendant laquelle la décision prononçant une sanction ou l'abandon des poursuites peut être contestée, à compter de la notification.",
  },
  delai_instruction_mois: {
    nom: "Délai d'instruction",
    categorie: "Délais",
    unite: "mois",
    defaut: 0,
    description: "Durée de l'instruction d'une affaire, en mois. Le délai court à compter de la décision de désignation qui ouvre l'instruction — celle des rapporteurs, ou celle de la commission d'instruction. Laisser 0 pour suivre le délai de la procédure : deux mois devant les sections compétentes à l'égard des usagers, quatre mois devant celles d'enseignants-chercheurs. L'instruction peut être prolongée, affaire par affaire, par les documents et les décisions qui fixent une date butoir.",
  },
  duree_avertissement_blame_annees: {
    nom: "Effacement des sanctions du dossier",
    categorie: "Sanctions",
    unite: "années",
    defaut: 3,
    description: "Durée au terme de laquelle certaines sanctions s'effacent du dossier, faute d'une nouvelle sanction : avertissement, blâme et mesure de responsabilisation pour les usagers (R.811-13-1) ; blâme et rappel à l'ordre pour les personnels (R.712-42).",
  },
  jours_par_mois: {
    nom: "Jours comptés pour un mois d'exclusion",
    categorie: "Sanctions",
    unite: "jours",
    defaut: 30,
    description: "Conversion utilisée pour calculer le terme d'une exclusion temporaire exprimée en mois.",
  },
  corbeille_retention_mois: {
    nom: "Conservation de la corbeille",
    categorie: "Conservation",
    unite: "mois",
    defaut: 12,
    description: "Durée pendant laquelle un élément mis à la corbeille est conservé avant de pouvoir être purgé. Au-delà, la purge — proposée dans la page Trames — efface définitivement les entrées les plus anciennes (voir « Corbeille »).",
  },
  references_verifiees_le: {
    nom: "Dernière vérification des références juridiques",
    categorie: "Juridique",
    unite: "",
    defaut: "",
    description: "Date à laquelle le service juridique a vérifié les références citées par le répertoire des considérants, les catalogues et les trames. Elle s'affiche sur la page Références et se reporte dans les pièces : une référence invérifiable ne doit pas sortir dans un acte. À faire viser par le service juridique.",
  },
};

/** Lignes de `Parametres` correspondant aux seuils par défaut. */
export function parametresParDefaut() {
  return Object.entries(PARAMS).map(([Cle, p]) => ({
    Nom: p.nom,
    Cle,
    Categorie: p.categorie,
    Valeur: String(p.defaut),
    // Un réglage sans unité — une date de vérification, par exemple — ne
    // s'annonce pas « Valeur en . ».
    Description: p.unite ? `${p.description} Valeur en ${p.unite}.` : p.description,
  }));
}

/** Valeur d'un seuil, lue dans `Parametres` avec repli sur la valeur par défaut. */
export function seuil(db, cle) {
  const p = PARAMS[cle];
  return parametreNumerique(db, cle, p ? p.defaut : 0);
}

export function seuilTexte(db, cle) {
  const p = PARAMS[cle];
  const unite = p?.unite ? ` ${p.unite}` : "";
  return `${parametre(db, cle, p ? p.defaut : "")}${unite}`;
}

/* ------------------------------------------------------------------ */
/* Catalogues par défaut                                               */
/* ------------------------------------------------------------------ */

/**
 * Les sanctions et les motifs installés dans un document neuf — et ceux que
 * l'action « Aligner les catalogues sur les textes » ajoute ou met à jour dans
 * un document déjà installé.
 *
 * Chaque ligne suit la lettre du texte applicable, et porte dans
 * `Texte_de_reference` l'article et le numéro d'item : la formation peut
 * vérifier ce qu'elle prononce. Textes dépouillés le 20 septembre 2026 :
 *
 *  - **usagers** — code de l'éducation, articles R.811-11 à R.811-13-4, dans
 *    leur rédaction issue du décret n°2026-36 du 29 janvier 2026. L'échelle des
 *    sanctions est celle de l'article R.811-13-1 : avertissement, blâme,
 *    mesure de responsabilisation (quarante heures au plus), exclusion de
 *    l'établissement pour cinq ans au maximum — avec sursis possible si
 *    l'exclusion n'excède pas deux ans —, exclusion définitive, exclusion de
 *    tout établissement public d'enseignement supérieur pour cinq ans au plus,
 *    exclusion définitive de tous. L'article R.811-13-2 ajoute les sanctions
 *    propres à la fraude commise à l'occasion d'une inscription ou d'un examen
 *    dans un établissement privé ; elles ne valent pas pour les établissements
 *    agricoles, le code rural écartant cet article (R.812-24-1). Les sanctions
 *    des 1° à 3° s'effacent au bout de trois ans, faute d'une nouvelle sanction.
 *  - **établissements d'enseignement supérieur agricole** — code rural et de la
 *    pêche maritime, articles R.812-24-1 et R.812-24-2 (décret n°2026-79 du
 *    12 février 2026) : mêmes sanctions que les usagers, manquements énumérés
 *    par le code rural, dont le 5° ajoute l'atteinte à la **réputation** de
 *    l'établissement.
 *  - **enseignants-chercheurs et personnels enseignants** — code de l'éducation,
 *    article L.952-8 : blâme, retard à l'avancement d'échelon (deux ans au
 *    plus), abaissement d'échelon, interdiction d'accéder à une classe, grade
 *    ou corps supérieurs (deux ans au plus), interdiction d'exercer des
 *    fonctions d'enseignement ou de recherche (cinq ans au plus, avec privation
 *    de la moitié ou de la totalité du traitement), mise à la retraite d'office,
 *    révocation. Il n'existe pas d'avertissement dans cette échelle : la
 *    première sanction est le blâme. Les autres enseignants relèvent de
 *    l'article L.952-9.
 *  - **devoirs des agents publics** — code général de la fonction publique,
 *    articles L.121-1 à L.121-11 (dignité, impartialité, intégrité, probité,
 *    neutralité, laïcité, secret et discrétion professionnels, conflits
 *    d'intérêts). Le code ne dresse pas la liste des fautes des
 *    enseignants-chercheurs : les motifs retenus sont les manquements à ces
 *    devoirs et aux obligations de service.
 *
 * Rien dans le code ne dépend de ces libellés : l'établissement peut les
 * modifier, en ajouter ou en retirer. Seuls les **groupes** ont un effet — le
 * terme d'une sanction s'en déduit (voir `Terme_de_la_sanction` dans
 * `formulas.js`) — et les libellés d'une version antérieure du catalogue
 * restent reconnus par l'alignement (voir `RENOMMAGES_CATALOGUE`).
 */
export const SANCTIONS_PAR_DEFAUT = [
  // --- Usagers : échelle de l'article R.811-13-1 du code de l'éducation -----
  { Libelle: "Avertissement", Groupe: "Avertissement et blâme", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, 1° du code de l'éducation" },
  { Libelle: "Blâme", Groupe: "Avertissement et blâme", Public: "Les deux", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, 2° du code de l'éducation (usagers) et article L.952-8, 1° (enseignants)" },
  { Libelle: "Mesure de responsabilisation", Groupe: "Mesure de responsabilisation", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, 3° et II du code de l'éducation (quarante heures au plus)" },
  { Libelle: "Mesure alternative à l'exclusion", Groupe: "Mesure de responsabilisation", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, III du code de l'éducation (proposée à la place d'une exclusion, quarante heures au plus)" },
  { Libelle: "Exclusion temporaire de l'établissement", Groupe: "Exclusion temporaire", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: 60, Sursis_possible: 1, Texte_de_reference: "Article R.811-13-1, 4° du code de l'éducation (sursis possible si l'exclusion n'excède pas deux ans)" },
  { Libelle: "Exclusion définitive de l'établissement", Groupe: "Exclusion définitive", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, 5° du code de l'éducation" },
  { Libelle: "Exclusion temporaire de tout établissement public d'enseignement supérieur", Groupe: "Exclusion temporaire", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: 60, Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, 6° du code de l'éducation" },
  { Libelle: "Exclusion définitive de tout établissement public d'enseignement supérieur", Groupe: "Exclusion définitive", Public: "Usagers", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-1, 7° du code de l'éducation" },
  // --- Usagers : fraude à l'inscription ou à un examen dans un établissement
  // privé (article R.811-13-2), écarté par le code rural pour l'agriculture.
  { Libelle: "Interdiction de subir tout examen conduisant à un titre ou à un diplôme", Groupe: "Interdiction", Public: "Usagers", Tutelle: TUTELLE_COURTE_MESR, Duree_max_mois: 60, Sursis_possible: 1, Texte_de_reference: "Article R.811-13-2, 2° du code de l'éducation (sursis possible si l'interdiction n'excède pas deux ans)" },
  { Libelle: "Interdiction de prendre toute inscription dans un établissement public", Groupe: "Interdiction", Public: "Usagers", Tutelle: TUTELLE_COURTE_MESR, Duree_max_mois: 60, Sursis_possible: 0, Texte_de_reference: "Article R.811-13-2, 3° du code de l'éducation" },
  { Libelle: "Interdiction définitive de prendre toute inscription et de subir tout examen", Groupe: "Exclusion définitive", Public: "Usagers", Tutelle: TUTELLE_COURTE_MESR, Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article R.811-13-2, 4° du code de l'éducation" },
  // --- Enseignants-chercheurs et personnels enseignants : L.952-8 -----------
  { Libelle: "Retard à l'avancement d'échelon", Groupe: "Retard, abaissement et avancement", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: 24, Sursis_possible: 0, Texte_de_reference: "Article L.952-8, 2° du code de l'éducation (deux ans au maximum)" },
  { Libelle: "Abaissement d'échelon", Groupe: "Retard, abaissement et avancement", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-8, 3° du code de l'éducation" },
  { Libelle: "Interdiction d'accéder à une classe, grade ou corps supérieurs", Groupe: "Retard, abaissement et avancement", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: 24, Sursis_possible: 0, Texte_de_reference: "Article L.952-8, 4° du code de l'éducation (deux ans au maximum)" },
  { Libelle: "Interdiction d'exercer des fonctions d'enseignement ou de recherche", Groupe: "Interdiction", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: 60, Sursis_possible: 0, Texte_de_reference: "Article L.952-8, 5° du code de l'éducation (cinq ans au maximum, avec privation de la moitié ou de la totalité du traitement)" },
  { Libelle: "Interdiction accessoire d'exercer toute fonction dans un établissement public ou privé", Groupe: "Interdiction", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-8, dernier alinéa du code de l'éducation (sanction accessoire de la mise à la retraite d'office ou de la révocation)" },
  { Libelle: "Mise à la retraite d'office", Groupe: "Révocation", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-8, 6° du code de l'éducation" },
  { Libelle: "Révocation", Groupe: "Révocation", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-8, 7° du code de l'éducation" },
  // --- Autres enseignants : L.952-9 ----------------------------------------
  { Libelle: "Rappel à l'ordre", Groupe: "Avertissement et blâme", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-9, 1° du code de l'éducation (autres enseignants ; effacé au bout de trois ans, article R.712-42)" },
  { Libelle: "Interruption de fonctions dans l'établissement", Groupe: "Interdiction", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: 24, Sursis_possible: 0, Texte_de_reference: "Article L.952-9, 2° du code de l'éducation (deux ans au maximum)" },
  { Libelle: "Exclusion de l'établissement", Groupe: "Exclusion définitive", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-9, 3° du code de l'éducation" },
  { Libelle: "Interdiction d'exercer des fonctions d'enseignement ou de recherche dans tout établissement public d'enseignement supérieur", Groupe: "Interdiction", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Duree_max_mois: "", Sursis_possible: 0, Texte_de_reference: "Article L.952-9, 4° du code de l'éducation (autres enseignants ; durée déterminée ou définitive)" },
];

export const MOTIFS_PAR_DEFAUT = [
  // --- Manquements des usagers : article R.811-11 du code de l'éducation,
  // article R.812-24-2 du code rural et de la pêche maritime ----------------
  { Libelle: "Manquement au règlement intérieur ou aux règles de la vie universitaire", Groupe: "Vie universitaire et règlement intérieur", Public: "Usagers", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 1° du code de l'éducation et article R.812-24-2, 1° du code rural et de la pêche maritime" },
  { Libelle: "Fraude ou tentative de fraude", Groupe: "Fraude et plagiat", Public: "Usagers", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 2° du code de l'éducation et article R.812-24-2, 2° du code rural et de la pêche maritime" },
  { Libelle: "Plagiat", Groupe: "Fraude et plagiat", Public: "Usagers", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 2° du code de l'éducation et article R.812-24-2, 2° du code rural et de la pêche maritime (le plagiat est une fraude)" },
  { Libelle: "Usage frauduleux d'un logiciel de triche", Groupe: "Fraude et plagiat", Public: "Usagers", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 2° du code de l'éducation et article R.812-24-2, 2° du code rural et de la pêche maritime (la fraude à un examen, y compris par un logiciel de triche)" },
  { Libelle: "Fraude à l'inscription ou à un examen dans un établissement privé", Groupe: "Fraude et plagiat", Public: "Usagers", Tutelle: TUTELLE_COURTE_MESR, Texte_de_reference: "Article R.811-11, dernier alinéa et article R.811-13-2 du code de l'éducation" },
  { Libelle: "Violences physiques", Groupe: "Violences et harcèlement", Public: "Les deux", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 3° du code de l'éducation et article R.812-24-2, 3° du code rural et de la pêche maritime ; article L.121-1 du code général de la fonction publique" },
  { Libelle: "Violences sexuelles et sexistes", Groupe: "Violences et harcèlement", Public: "Les deux", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 3° du code de l'éducation et article R.812-24-2, 3° du code rural et de la pêche maritime ; article L.121-1 du code général de la fonction publique" },
  { Libelle: "Harcèlement", Groupe: "Violences et harcèlement", Public: "Les deux", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 3° du code de l'éducation et article R.812-24-2, 3° du code rural et de la pêche maritime ; article L.121-1 du code général de la fonction publique" },
  { Libelle: "Harcèlement sexuel", Groupe: "Violences et harcèlement", Public: "Les deux", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 3° du code de l'éducation et article R.812-24-2, 3° du code rural et de la pêche maritime ; article L.121-1 du code général de la fonction publique" },
  { Libelle: "Antisémitisme, racisme, discrimination, incitation à la haine ou à la violence", Groupe: "Discrimination et haine", Public: "Les deux", Tutelle: "Les deux", Texte_de_reference: "Article R.811-11, 4° du code de l'éducation et article R.812-24-2, 4° du code rural et de la pêche maritime ; article L.121-1 du code général de la fonction publique" },
  { Libelle: "Atteinte à l'ordre ou au bon fonctionnement de l'établissement", Groupe: "Ordre et fonctionnement de l'établissement", Public: "Usagers", Tutelle: TUTELLE_COURTE_MESR, Texte_de_reference: "Article R.811-11, 5° du code de l'éducation" },
  { Libelle: "Atteinte à l'ordre, au bon fonctionnement ou à la réputation de l'établissement", Groupe: "Ordre et fonctionnement de l'établissement", Public: "Usagers", Tutelle: TUTELLE_COURTE_AGRI, Texte_de_reference: "Article R.812-24-2, 5° du code rural et de la pêche maritime (rédaction propre aux établissements agricoles)" },
  // --- Manquements des enseignants et des agents : les devoirs des agents
  // publics (code général de la fonction publique) -------------------------
  { Libelle: "Manquement aux obligations de service", Groupe: "Manquement aux obligations de service", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Texte_de_reference: "Décret n°84-431 du 6 juin 1984 portant statut des enseignants-chercheurs (obligations de service)" },
  { Libelle: "Manquement à l'obligation de consacrer l'intégralité de son activité professionnelle à ses fonctions", Groupe: "Manquement aux obligations de service", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Texte_de_reference: "Article L.121-3 du code général de la fonction publique" },
  { Libelle: "Manquement au devoir de dignité, d'impartialité, d'intégrité ou de probité", Groupe: "Devoirs et probité des agents publics", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Texte_de_reference: "Article L.121-1 du code général de la fonction publique" },
  { Libelle: "Manquement à l'obligation de neutralité ou au principe de laïcité", Groupe: "Devoirs et probité des agents publics", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Texte_de_reference: "Article L.121-2 du code général de la fonction publique" },
  { Libelle: "Conflit d'intérêts", Groupe: "Devoirs et probité des agents publics", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Texte_de_reference: "Articles L.121-4 et L.121-5 du code général de la fonction publique" },
  { Libelle: "Manquement au secret professionnel ou à l'obligation de discrétion professionnelle", Groupe: "Devoirs et probité des agents publics", Public: "Enseignants-chercheurs", Tutelle: "Les deux", Texte_de_reference: "Articles L.121-6 et L.121-7 du code général de la fonction publique" },
  { Libelle: "Comportement incompatible avec les fonctions", Groupe: "Comportement", Public: "Les deux", Tutelle: "Les deux", Texte_de_reference: "Articles L.121-1 à L.121-11 du code général de la fonction publique (devoirs des agents publics)" },
];

/**
 * Libellés d'une version antérieure du catalogue, reconnus par l'alignement :
 * une ligne qui porte encore l'ancien libellé est mise à jour, et non
 * dupliquée. Les clés sont comparées sans casse, espaces ni ponctuation de
 * bord (voir `cleCatalogue`).
 */
export const RENOMMAGES_CATALOGUE = {
  Sanctions: {},
  Motifs: {
    "fraude ou tentative de fraude à un examen": "Fraude ou tentative de fraude",
    "perturbation du fonctionnement de l'établissement": "Atteinte à l'ordre ou au bon fonctionnement de l'établissement",
  },
};

/** Champs d'un catalogue que l'alignement sur les textes met à jour. */
const CHAMPS_ALIGNES = {
  Sanctions: ["Libelle", "Groupe", "Public", "Tutelle", "Duree_max_mois", "Sursis_possible", "Texte_de_reference"],
  Motifs: ["Libelle", "Groupe", "Public", "Tutelle", "Texte_de_reference"],
};

/** Comparaison des libellés, insensible à la casse et aux espaces. */
export function cleCatalogue(v) {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Ce qu'il faudrait faire pour qu'un catalogue rejoigne les textes : les
 * entrées livrées par défaut qui manquent, et les champs à corriger sur celles
 * qui portent un libellé livré (groupe, régime, tutelle, durée, sursis, texte
 * de référence). Les autres lignes de l'établissement ne sont jamais touchées,
 * et rien n'est supprimé.
 *
 * Le plan est calculé sans rien écrire : l'appelant l'applique après accord.
 */
export function planAlignementCatalogue(table, db) {
  const defauts = table === "Sanctions" ? SANCTIONS_PAR_DEFAUT : MOTIFS_PAR_DEFAUT;
  const renommages = RENOMMAGES_CATALOGUE[table] || {};
  const champs = CHAMPS_ALIGNES[table] || [];
  const lignes = (db && db[table]) || [];
  const parLibelle = new Map(lignes.map((r) => [cleCatalogue(r.Libelle), r]));
  const ajouts = [];
  const modifications = [];
  for (const defaut of defauts) {
    const ancien = Object.keys(renommages).find((k) => renommages[k] === defaut.Libelle);
    const ligne = parLibelle.get(cleCatalogue(defaut.Libelle))
      || (ancien ? parLibelle.get(cleCatalogue(ancien)) : null);
    if (!ligne) { ajouts.push({ ...defaut }); continue; }
    const avant = {};
    const apres = {};
    for (const champ of champs) {
      const actuel = ligne[champ] ?? "";
      const attendu = defaut[champ] ?? "";
      if (String(actuel) !== String(attendu)) { avant[champ] = actuel; apres[champ] = attendu; }
    }
    if (Object.keys(apres).length) modifications.push({ id: ligne.id, avant, apres });
  }
  return { ajouts, modifications };
}

/* ------------------------------------------------------------------ */
/* Contrôles de régularité                                             */
/* ------------------------------------------------------------------ */

const STATUTS = { ok: "ok", alerte: "alerte", manquant: "manquant", info: "info" };

function controle(code, libelle, statut, detail) {
  return { code, libelle, statut, detail };
}

const sansAccent = (s) => String(s || "").toLowerCase();

/**
 * Les points qu'il faut vérifier avant de tenir une séance ou de notifier une
 * décision. Les seuils vivent dans `Parametres` ; la composition attendue et
 * les délais viennent de `procedure.js`, donc de la section de l'affaire.
 */
export function controlesRegularite(db, affaire, ctx = null) {
  const c = ctx || new Context(db);
  if (!affaire) return [];
  const T = "Affaires";
  const section = affaire.Section ? (db.Sections_disciplinaires || []).find((s) => s.id === Number(affaire.Section)) : null;
  const d = procedure(section);
  const comp = compositionAttendue(section);
  const r811 = suitProcedureR811_40(affaire);
  const out = [];

  // 1. Prescription — ou son absence.
  const faits = c.v(T, affaire, "Date_des_faits") || affaire.Date_des_faits;
  if (!d.prescription.applicable) {
    out.push(controle("prescription", "Prescription", STATUTS.info,
      `Les poursuites engagées à l'égard d'un usager ne sont pas soumises à prescription. Le délai de trois ans n'efface que certaines sanctions du dossier : ${d.effacement.sanctions.toLowerCase()}.`));
  } else {
    const base = c.v(T, affaire, "Date_de_connaissance_des_faits") || affaire.Date_de_connaissance_des_faits;
    if (!base) {
      out.push(controle("prescription", "Prescription", STATUTS.manquant,
        "La date de connaissance des faits n'est pas renseignée : la prescription ne peut pas être vérifiée. À défaut, elle court depuis la date des faits."));
    } else if (c.v(T, affaire, "Prescrit")) {
      out.push(controle("prescription", "Prescription", STATUTS.alerte,
        `Le délai de ${seuil(db, "prescription_annees")} ans ${d.prescription.base} est dépassé (${formatDateFr(c.v(T, affaire, "Prescription_le"))}) : l'action disciplinaire paraît prescrite.`));
    } else {
      out.push(controle("prescription", "Prescription", STATUTS.ok,
        `Action non prescrite jusqu'au ${formatDateFr(c.v(T, affaire, "Prescription_le"))} (${seuil(db, "prescription_annees")} ans ${d.prescription.base}).`));
    }
  }

  // 1 bis. Dossier dématérialisé : les pièces vivent hors de l'outil, qui n'en
  // garde que l'adresse. Sans elle, on ne sait plus où elles sont — et c'est
  // justement quand l'affaire s'instruit qu'on les ouvre. Le rappel est un
  // manque dès que l'affaire est instruite, examinée ou close ; avant, c'est une
  // simple invitation à déclarer l'adresse.
  const dossier = lienDossier(affaire);
  if (dossier) {
    out.push(controle("dossier", "Dossier dématérialisé", STATUTS.ok,
      `Dossier déclaré : ${hoteDossier(dossier)}.`));
  } else {
    const avanceDossier = ["Instruction", "Examen"].includes(affaire.Etat) || estCloseEtat(affaire.Etat);
    out.push(controle("dossier", "Dossier dématérialisé", avanceDossier ? STATUTS.manquant : STATUTS.info,
      "Le lien vers le dossier de pièces n'est pas déclaré. Les pièces sont tenues hors de l'outil, "
      + "qui n'en conserve que l'adresse — le lien se déclare depuis le bandeau de l'affaire."));
  }

  // 2. Composition de la formation appelée à juger.
  const intervenants = intervenantsDe(c, affaire);
  const president = intervenants.filter((x) => x.role === "Président de la formation" || x.role === "Président");
  const rapporteurs = intervenants.filter((x) => x.role === "Rapporteur");
  const rapporteurAdjoints = intervenants.filter((x) => x.role === "Rapporteur adjoint");
  const commissionnaires = intervenants.filter((x) => x.role === "Membre de la commission d'instruction");
  if (!intervenants.length) {
    // Tant que l'affaire n'est pas instruite ni examinée, l'absence de
    // composition est un simple état d'avancement, non un manque.
    const avance = ["Instruction", "Examen"].includes(affaire.Etat) || estCloseEtat(affaire.Etat);
    out.push(avance
      ? controle("composition", libelleFormation(section), STATUTS.manquant,
        `Aucun intervenant n'est désigné. Composition attendue : ${comp.formation || comp.section}.`)
      : controle("composition", libelleFormation(section), STATUTS.info,
        `La formation n'est pas encore composée. Composition attendue : ${comp.formation || comp.section}.`));
  } else {
    if (!president.length) {
      out.push(controle("president", "Présidence de la formation", STATUTS.alerte,
        "Aucun président de la formation n'est désigné."));
    } else {
      const magistrat = intervenants.filter((x) => collegeDe(c.byId("Membres", x.row?.Membre)) === "magistrat");
      out.push(controle("president", "Présidence de la formation", STATUTS.ok,
        `Présidence : ${president.map((x) => x.nom).join(", ")}.`
        + (d.type === TYPE_ACADEMIQUE
          ? (magistrat.length ? " Présidence assurée par un magistrat de l'ordre administratif." : " La section disciplinaire académique est présidée par un magistrat de l'ordre administratif : pensez à le déclarer comme membre de la section.")
          : "")));
    }

    // L'instruction : un rapporteur (avec adjoint) pour les usagers, une
    // commission d'instruction de deux membres pour les enseignants-chercheurs.
    if (d.instruction.mode === "commission") {
      const membresCommission = rapporteurs.length + commissionnaires.length;
      if (!rapporteurs.length) {
        out.push(controle("rapporteur", "Rapport", STATUTS.alerte,
          `Aucun rapporteur n'est désigné. L'instruction est confiée à une ${d.instruction.libelle.toLowerCase()} de deux membres, dont l'un est rapporteur.`));
      } else if (membresCommission < 2) {
        out.push(controle("rinstitution", d.instruction.libelle, STATUTS.info,
          `La ${d.instruction.libelle.toLowerCase()} est composée de deux membres : un rapporteur a été désigné, il reste à désigner le second (rôle « Membre de la commission d'instruction »).`));
      } else {
        out.push(controle("rinstitution", d.instruction.libelle, STATUTS.ok,
          `Commission d'instruction complète : ${[...rapporteurs, ...commissionnaires].map((x) => x.nom).join(", ")}.`));
      }
    } else if (!r811) {
      if (!rapporteurs.length) {
        out.push(controle("rapporteur", "Rapport", STATUTS.alerte, "Aucun rapporteur n'est désigné."));
      } else {
        const hors = rapporteurs.filter((x) => x.horsSection);
        out.push(controle("rapporteur", "Rapport", hors.length ? STATUTS.info : STATUTS.ok,
          hors.length
            ? `Rapporteur : ${hors.map((x) => x.nom).join(", ")} — personnel de l'établissement non membre élu de la section.`
            : `Rapporteur : ${rapporteurs.map((x) => x.nom).join(", ")}.`));
      }
      if (!rapporteurAdjoints.length) {
        out.push(controle("rapporteur-adjoint", "Rapporteur adjoint", STATUTS.info,
          "Aucun rapporteur adjoint n'est désigné : la procédure prévoit un rapporteur adjoint, membre du collège des usagers. Son absence ne fait pas obstacle à l'instruction dès lors qu'il a été régulièrement convoqué."));
      }
    }

    // Qui préside n'instruit pas : ni le président de la section ni les membres
    // de la formation de jugement ne peuvent siéger dans la commission
    // d'instruction (R.712-32) ; devant la commission de discipline, le
    // président ne peut être rapporteur de l'affaire (R.811-28). Indicatif.
    const idsPresident = new Set(president.map((x) => x.row?.id));
    if (d.instruction.mode === "commission") {
      const idsPresidentSection = new Set(
        (db.Membres || [])
          .filter((m) => section && Number(m.Section) === Number(section.id) && m.Role === "Président")
          .map((m) => m.id)
      );
      const doubles = [...rapporteurs, ...commissionnaires].filter(
        (x) => (x.row?.Membre && idsPresidentSection.has(Number(x.row.Membre))) || idsPresident.has(x.row?.id)
      );
      if (doubles.length) {
        out.push(controle("president-instruction", "Président et instruction", STATUTS.alerte,
          `${doubles.map((x) => x.nom).join(", ")} : le président de la section, comme les membres de la formation de jugement, ne peuvent être membres de la commission d'instruction.`));
      }
    } else if (!r811 && president.length && rapporteurs.some((x) => idsPresident.has(x.row?.id))) {
      out.push(controle("president-rapporteur", "Président et rapport", STATUTS.alerte,
        "La personne qui préside la commission de discipline ne peut pas être rapporteur de l'affaire."));
    }

    // Effectif et collèges de la formation appelée à juger. Devant une section
    // d'enseignants-chercheurs, la commission d'instruction est distincte de la
    // formation de jugement (R.712-32, R.812-24-16) : ses membres ne comptent
    // donc pas dans l'effectif de celle-ci.
    const formationJugement = d.instruction.mode === "commission"
      ? intervenants.filter((x) => !["Rapporteur", "Membre de la commission d'instruction"].includes(x.role))
      : intervenants;
    const collegeMEC = collegeDuCorps(c.v("Personnes", c.ref(T, affaire, "Mis_en_cause"), "Corps"));
    const attendu = effectifFormation(section, collegeMEC);
    if (attendu) {
      const presents = formationJugement.filter((x) => !["Récusé", "Déporté"].includes(x.statut));
      if (presents.length && presents.length !== attendu) {
        out.push(controle("effectif", "Effectif de la formation", STATUTS.info,
          `${presents.length} membre(s) appelé(s) à juger pour ${attendu} attendu(s) — ${comp.formation || comp.note}`));
      } else if (presents.length) {
        out.push(controle("effectif", "Effectif de la formation", STATUTS.ok,
          `${presents.length} membre(s) appelé(s) à juger : conforme à la composition attendue.`));
      }
    }

    // Quota des usagers, propre à la commission de discipline.
    if (d.quotaUsagers) {
      const nbUsagers = intervenants.filter((x) => collegeDe(c.byId("Membres", x.row?.Membre)) === "usagers").length;
      const nbEnseignants = intervenants.filter((x) => ["professeurs", "maitres", "enseignants"].includes(collegeDe(c.byId("Membres", x.row?.Membre)))).length;
      if (nbUsagers > nbEnseignants) {
        out.push(controle("quota", "Quota des usagers", STATUTS.alerte,
          `${nbUsagers} représentant(s) des usagers pour ${nbEnseignants} enseignant(s) : la formation ne peut comprendre plus de représentants des usagers que d'enseignants.`));
      } else if (nbUsagers || nbEnseignants) {
        out.push(controle("quota", "Quota des usagers", STATUTS.ok,
          "Le nombre de représentants des usagers n'excède pas celui des enseignants."));
      }
    }

    // Mandats échus parmi les membres de la section.
    const echus = intervenants.filter((x) => x.row?.Membre && !c.v("Membres", c.byId("Membres", x.row.Membre), "En_fonction"));
    if (echus.length) {
      out.push(controle("mandat", "Mandat des membres", STATUTS.alerte,
        `Mandat échu : ${echus.map((x) => x.nom).join(", ")}.`));
    }

    out.push(controle("composition-attendue", "Composition réglementaire", STATUTS.info,
      `${libelleFormation(section)} : ${comp.formation || comp.section}. ${comp.quorum?.regle || ""}`.trim()));
  }

  // 3. Voie de traitement.
  if (r811) {
    if (!d.voieR81140) {
      out.push(controle("voie", "Voie de traitement", STATUTS.alerte,
        `La procédure de l'article R.811-40 n'est pas prévue ici : ${d.public === REGIME_EC ? "elle est réservée aux sections compétentes à l'égard des usagers" : "les textes applicables à cette section ne la mentionnent pas"}. Choisissez la procédure devant la section, ou changez de section.`));
    } else if (affaire.Etat === "Instruction") {
      out.push(controle("voie-etat", "État et voie de traitement", STATUTS.alerte,
        "L'état « Instruction » n'existe pas dans la procédure de l'article R.811-40 : choisissez un autre état, ou revenez à la procédure devant la section."));
    } else {
      out.push(controle("voie", "Voie de l'article R.811-40", STATUTS.info,
        "Procédure de reconnaissance des faits : elle tient lieu d'instruction, qui n'existe pas dans cette voie. La formation se prononce sur la proposition de sanction, sans rapport d'instruction ni audition de témoins."));
    }
  }

  // 4. L'instruction et son échéance.
  //
  // Le délai de la procédure court à compter de la **décision de désignation**
  // qui ouvre l'instruction — deux mois devant les sections d'usagers, quatre
  // mois devant celles d'enseignants-chercheurs. Il se prolonge par un
  // document : le contrôle dit donc d'où vient l'échéance, et prévient quand
  // elle approche ou qu'elle est passée. Tant que la désignation n'a pas été
  // produite, il n'y a pas de délai à courir — le contrôle le dit aussi.
  const butoir = butoirInstruction(c, affaire);
  if (butoir?.butoir) {
    const quand = formatDateFr(butoir.butoir);
    // Ce qui fixe la date butoir : la pièce qui la porte, s'il y en a une — elle
    // prime sur l'échéance de la procédure, qu'elle avance ou qu'elle recule le
    // terme. Le contrôle dit donc laquelle des deux, et si elle a été prolongée.
    const piece = butoir.origine?.document
      ? `« ${String(c.v("Trames", butoir.origine.trame, "Nom_complet") || "un document")} »`
      : butoir.origine?.decision
        ? `la décision du ${formatDateFr(butoir.origine.decision.Date_de_notification || butoir.origine.decision.Date_du_delibere)}`
        : "";
    const origine = piece ? `${butoir.prolongee ? ", prolongée" : ", fixée"} par ${piece}` : "";
    const reste = butoir.jours;
    if (reste !== null && reste < 0) {
      out.push(controle("instruction", "Échéance d'instruction", STATUTS.alerte,
        `L'instruction devait être close le ${quand}${origine} : le délai est dépassé de ${-reste} jour(s). Un complément ou un supplément d'instruction, ou la décision qui les ordonne, fixe une nouvelle date butoir.`));
    } else if (reste !== null && reste <= 15) {
      out.push(controle("instruction", "Échéance d'instruction", STATUTS.info,
        `L'instruction doit être close le ${quand}${origine} — dans ${reste} jour(s). Un complément ou un supplément d'instruction en fixe une plus lointaine si le rapport n'est pas en état.`));
    } else {
      out.push(controle("instruction", "Échéance d'instruction", STATUTS.ok,
        `Instruction à clore le ${quand}${reste !== null ? ` — dans ${reste} jour(s)` : ""}${origine}. ${butoir.delai.texte}`.trim()));
    }
  } else if (butoir?.nonOuverte) {
    // Le délai court à compter de la désignation : sans elle, rien ne court.
    // L'affaire est pourtant avancée dans son instruction — c'est un manque.
    const avancee = ["Instruction", "Examen"].includes(affaire.Etat);
    out.push(controle("instruction", "Ouverture de l'instruction", avancee ? STATUTS.manquant : STATUTS.info,
      `L'instruction n'est pas ouverte : le délai court à compter de la décision de désignation ${d.instruction.delaiDesignation}, qui n'a pas été produite. Produisez cette décision — la trame de désignation la rédige — pour que l'échéance se calcule.`));
  }

  // 5. Convocation et délai avant la séance.
  const convoc = affaire.Date_de_convocation;
  const seanceId = c.v(T, affaire, "Seance_d_examen");
  const seance = seanceId ? c.byId("Seances_d_examen", seanceId) : null;
  const typeSeance = sansAccent(seance?.Type);
  const entretien = r811 && typeSeance.includes("r.811-40");
  const minimum = entretien ? seuil(db, "delai_entretien_r811_40_jours") : seuil(db, "delai_convocation_jours");
  if (!convoc) {
    // Une affaire qui n'est pas encore instruite n'a pas de séance : l'absence
    // de convocation est un état d'avancement, non un manque.
    const avanceConv = ["Instruction", "Examen"].includes(affaire.Etat) || estCloseEtat(affaire.Etat);
    if (!seanceId && !avanceConv) {
      out.push(controle("convocation", "Convocation", STATUTS.info,
        "Aucune séance n'est encore planifiée : la convocation se dattera lorsqu'elle le sera."));
    } else {
      out.push(controle("convocation", "Convocation", STATUTS.manquant, "La convocation n'est pas datée."));
    }
  } else if (!c.v(T, affaire, "SE_Date")) {
    out.push(controle("convocation", "Convocation", STATUTS.manquant, "L'affaire n'est inscrite à aucune séance."));
  } else {
    const delai = c.v(T, affaire, "Delai_de_convocation");
    const libelle = entretien ? "Délai de l'entretien" : "Délai de convocation";
    if (delai !== null && delai < minimum) {
      out.push(controle("convocation", libelle, STATUTS.alerte,
        `${delai} jour(s) entre la convocation et la séance : le minimum réglé est de ${minimum} jours.`));
    } else {
      out.push(controle("convocation", libelle, STATUTS.ok,
        `${delai} jour(s) entre la convocation et la séance (minimum : ${minimum}).`));
    }
  }
  if (r811 && d.voieR81140) {
    out.push(controle("r811-40-etapes", "Étapes de l'article R.811-40", STATUTS.info,
      `Entretien avec la personne mise en cause, en présence d'un représentant des usagers, puis proposition de sanction et ${seuil(db, "delai_reponse_proposition_jours")} jours pour l'accepter ou la refuser. La proposition ne peut porter que sur l'avertissement, le blâme, la mesure de responsabilisation ou une exclusion d'un an au plus ; à défaut d'accord, les poursuites sont engagées devant la section.`));
  }

  // 6. Jonction d'affaires — plusieurs affaires, une seule décision.
  //
  // La jonction ne crée pas une décision « de groupe » : elle fait lire à
  // plusieurs affaires la décision de l'une d'elles, l'affaire de tête. Ces
  // contrôles vérifient donc trois choses : que les affaires jointes puissent
  // l'être (même section, c'est-à-dire même formation), qu'une seule décision
  // tranche le fond pour l'ensemble, et que la jonction se plaide en une fois.
  const jonction = c.v("Affaires", affaire, "Jonction");
  if (jonction) {
    const membres = affairesDeJonction(db, jonction);
    const numeros = membres.map((a) => String(c.v("Affaires", a, "Numero") ?? "").trim()).filter(Boolean);
    const liste = numeros.join(", ");
    const tete = membres.find((a) => Number(a.id) === Number(jonction.Affaire_de_tete)) || null;
    const numeroTete = tete ? String(c.v("Affaires", tete, "Numero") ?? "").trim() : "";
    const estTete = Number(jonction.Affaire_de_tete) === Number(affaire.id);

    const sections = [...new Set(membres.map((a) => Number(a.Section) || 0))];
    if (sections.length > 1) {
      out.push(controle("jonction-section", "Jonction", STATUTS.alerte,
        "Les affaires jointes ne relèvent pas de la même section disciplinaire : "
        + "une même formation ne peut les juger ensemble."));
    }

    if (!estTete) {
      const propres = decisionsDefinitivesDe(c, affaire);
      if (propres.length) {
        out.push(controle("jonction-decision", "Jonction", STATUTS.alerte,
          `Cette affaire est jointe à l'affaire n° ${numeroTete || "—"}, mais elle porte sa propre décision `
          + "définitive : la décision doit être unique pour l'ensemble. La décision commune se saisit sur "
          + "l'affaire de tête."));
      } else {
        out.push(controle("jonction", "Jonction", STATUTS.info,
          `Jugée avec l'affaire n° ${numeroTete || "—"}, par une décision unique. `
          + `Affaires jointes : ${liste}.`));
      }
    } else {
      out.push(controle("jonction", "Jonction", STATUTS.info,
        `Cette affaire porte la décision commune aux affaires jointes : ${liste}.`));
    }

    const seances = [...new Set(membres.map((a) => Number(a.Seance_d_examen) || 0))];
    if (seances.length > 1) {
      out.push(controle("jonction-seance", "Jonction", STATUTS.info,
        "Les affaires jointes ne sont pas toutes inscrites à la même séance : elles sont pourtant jugées "
        + "par une même décision."));
    }
  }

  // 7. Décision définitive — une seule par affaire (ou par jonction).
  const definitives = decisionsDefinitivesDe(c, affaire);
  if (definitives.length > 1) {
    out.push(controle("decision-unique", "Décision définitive", STATUTS.alerte,
      `${definitives.length} décisions tranchant le fond sont enregistrées : une affaire ne peut comporter `
      + `qu'une seule décision définitive. Les décisions avant dire droit (report, supplément d'instruction) `
      + `se saisissent avec la nature « ${NATURE_INTERLOCUTOIRE} ».`));
  }

  // 8. Notification et accusé de réception.
  const decision = decisionDefinitiveDe(c, affaire);
  if (decision) {
    const recommandee = /recommand|accusé/i.test(decision.Mode_de_notification || "");
    if (recommandee && !decision.Date_de_l_accuse_reception) {
      out.push(controle("ar", "Accusé de réception", STATUTS.alerte,
        "Notification par lettre recommandée sans accusé de réception enregistré."));
    }
    // 6. Délai de recours — il ne court que contre la décision qui ouvre un
    // recours : une sanction, ou l'abandon des poursuites.
    const limite = c.v("Decisions", decision, "Recours_limite_le");
    const recours = recoursDe(c, decision);
    if (limite) {
      const passe = new Date(limite + "T00:00:00").getTime() < Date.now();
      if (recours.length) {
        const enCours = recours.filter((x) => x.Issue === "En cours").length;
        out.push(controle("recours", "Recours", STATUTS.info,
          `${recours.length} recours formé(s)${enCours ? `, dont ${enCours} en cours` : ""}.`));
      } else if (passe) {
        out.push(controle("recours", "Délai de recours", STATUTS.ok,
          `Délai de recours expiré le ${limite} : aucun recours formé.`));
      } else {
        out.push(controle("recours", "Délai de recours", STATUTS.info,
          `Recours possible jusqu'au ${limite}.`));
      }
    } else if (!estSusceptibleDeRecours(decision)) {
      out.push(controle("recours", "Recours", STATUTS.info,
        "Aucun recours n'est ouvert contre cette décision : seule une décision prononçant une sanction "
        + "ou l'abandon des poursuites peut être contestée."));
    }
  } else if (affaire.Etat === "Terminée") {
    out.push(controle("decision", "Décision", STATUTS.manquant,
      "L'affaire est terminée mais aucune décision n'est enregistrée."));
  }

  // 9. Les actes rendus — leurs visas, et ce qui se notifie.
  //
  // Un acte rendu se reconnaît à son format : une **ordonnance** du président de
  // la section ou de celui de la formation de jugement, ou une **décision** de la
  // formation. Les visas sont portés par la feuille de style du format, et le
  // corps vient s'y insérer : le contrôle les cherche donc dans l'ensemble —
  // feuille, corps de la trame et texte du document.
  const documents = (db.Generateur || []).filter((g) => Number(g.Affaire) === Number(affaire.id));
  const trameDe = (g) => (db.Trames || []).find((t) => Number(t.id) === Number(g.Template)) || null;
  const typeDe = (g) => {
    const trame = trameDe(g);
    return trame ? (db.Types_Trames || []).find((t) => Number(t.id) === Number(trame.Type)) || null : null;
  };
  const nomDe = (g) => String(trameDe(g)?.Nom || "document");
  const sansBalisage = (texte) => String(texte || "").replace(/<[^>]*>/g, " ");
  const actes = documents.filter((g) => FORMATS_RENDUS.includes(String(typeDe(g)?.Categorie || "")));
  const sansVisa = actes.filter((g) => {
    const trame = trameDe(g);
    const texte = sansBalisage(
      `${trame?.Feuille_de_style || typeDe(g)?.Feuille_de_style || ""} ${trame?.Template_contenu || ""} ${g.Contenu || ""}`
    );
    return texte.trim() && !/\bVu\b/.test(texte);
  });
  if (sansVisa.length) {
    out.push(controle("visas", "Visas de l'acte", STATUTS.alerte,
      `${[...new Set(sansVisa.map(nomDe))].join(", ")} : l'acte rendu ne vise aucun texte. Une ordonnance comme `
      + "une décision visent le code de l'éducation, le code rural et de la pêche maritime dans un établissement "
      + "agricole, et la saisine de la section."));
  } else if (actes.length) {
    out.push(controle("visas", "Visas de l'acte", STATUTS.ok,
      actes.length > 1 ? `Les ${actes.length} actes rendus portent leurs visas.` : "L'acte rendu porte ses visas."));
  }

  // Les lettres de notification ne portent que sur les **décisions des
  // formations de jugement** : une ordonnance est un acte préparatoire,
  // insusceptible de recours, qui ne se notifie pas comme une décision.
  const lettres = documents.filter((g) => /^Notification de la décision/.test(nomDe(g)));
  if (lettres.length) {
    if (decisionDefinitiveDe(c, affaire)) {
      out.push(controle("notification-acte", "Notification", STATUTS.ok,
        "La lettre de notification porte sur la décision définitive de la formation de jugement."));
    } else {
      out.push(controle("notification-acte", "Notification", STATUTS.alerte,
        "Une lettre de notification est préparée, mais aucune décision de la formation de jugement n'est "
        + "enregistrée. Les lettres de notification ne portent que sur ces décisions : les ordonnances, actes "
        + "préparatoires, ne sont pas susceptibles de recours."));
    }
  }

  // Un recours ne se forme que contre la décision qui prononce une sanction ou
  // l'abandon des poursuites. Aucune autre décision — ni une mesure avant dire
  // droit, ni un classement, ni une relaxe — n'est susceptible de recours, et
  // une ordonnance, acte préparatoire, pas davantage.
  const recoursSurNonSusceptible = (db.Decisions || [])
    .filter((x) => Number(x.Affaire) === Number(affaire.id) && !estSusceptibleDeRecours(x))
    .filter((x) => recoursDe(c, x).length);
  if (recoursSurNonSusceptible.length) {
    out.push(controle("recours-preparatoire", "Recours", STATUTS.alerte,
      "Un recours est enregistré contre une décision qui n'y ouvre pas droit : seules une décision "
      + "prononçant une sanction ou l'abandon des poursuites peut être contestée. Aucune autre décision, "
      + "et aucune ordonnance, n'est susceptible de recours."));
  }

  return out;
}

/** Compte des contrôles non satisfaits (alertes et données manquantes). */
export function controlesEnDefaut(controles) {
  return controles.filter((x) => x.statut === "alerte" || x.statut === "manquant").length;
}

export const LIBELLE_STATUT_CONTROLE = {
  ok: "Conforme",
  alerte: "À corriger",
  manquant: "À compléter",
  info: "Pour information",
};
