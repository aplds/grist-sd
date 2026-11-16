// Les procédures disciplinaires : ce que la loi prévoit, et ce que l'outil en
// vérifie.
//
// Ce module est la **source de vérité** de tout ce qui dépend de la procédure :
// nom des organes, composition attendue (collèges et effectifs), instruction,
// autorités compétentes, délais, sanctions applicables, prescription et
// effacement. Les contrôles de régularité (`regimes.js`), les libellés des
// écrans (`views/affaires.js`), les explications (`views/aide.js`) et la
// configuration (`views/reglages.js`) le lisent tous ici, de sorte qu'une
// correction juridique n'a qu'un seul endroit à toucher.
//
// Deux étages à ne pas confondre :
//
//  1. la **procédure** dépend du public (usagers / enseignants-chercheurs) et
//     vient du code de l'éducation pour les deux tutelles :
//       - usagers : articles R.811-11 à R.811-50 ;
//       - enseignants-chercheurs : articles R.712-9 à R.712-46 ;
//     le code rural et de la pêche maritime s'y réfère expressément
//     (R.812-24-1 et R.812-24-8) ;
//  2. la **composition** dépend de la tutelle :
//       - ministère chargé de l'enseignement supérieur : R.811-14 (usagers) et
//         R.712-13 (enseignants-chercheurs) ;
//       - ministère chargé de l'agriculture : R.812-24-3 (usagers) et
//         R.812-24-9 (enseignants-chercheurs).
//
// Les voies de recours ne sont décrites ici que par leur nom — le corps devant
// lequel se forme le recours d'une décision : le juge administratif pour les
// usagers, le CNESER et le CNESERAAV pour les enseignants-chercheurs. Ce que
// l'outil produit, ce sont des actes de premier ressort.

import {
  REGIMES,
  TUTELLE_MESR,
  TUTELLE_AGRI,
  TUTELLES,
  TUTELLE_COURTE_MESR,
  TUTELLE_COURTE_AGRI,
  TYPE_ETABLISSEMENT,
  TYPE_ECOLE_INTERNE,
  TYPE_ACADEMIQUE,
  TYPE_COMMUNE,
  TYPES_SECTION,
  VOIE_SECTION,
  VOIE_R811_40,
  VOIES,
  ETATS,
} from "./schema.js";

export const REGIME_USAGERS = REGIMES[0];
export const REGIME_EC = REGIMES[1];

/* ------------------------------------------------------------------ */
/* Voies de recours                                                    */
/* ------------------------------------------------------------------ */

/**
 * La juridiction devant laquelle se forme le recours contre une **décision** de
 * la section. Elle suit le **public** :
 *
 *  - à l'égard d'un **usager**, la décision se défère au **tribunal
 *    administratif** compétent dans le ressort duquel se trouve le siège de
 *    l'établissement : le juge administratif de droit commun, et non le CNESER ;
 *  - à l'égard d'un **enseignant-chercheur**, elle se défère au Conseil national
 *    de l'enseignement supérieur et de la recherche (**CNESER**), ou, dans un
 *    établissement d'enseignement supérieur agricole, au Conseil national de
 *    l'enseignement supérieur et de la recherche agricole, alimentaire et
 *    vétérinaire (**CNESERAAV**), qui y prend sa place.
 *
 * Le recours ne se forme que contre la décision qui y ouvre droit : une
 * **sanction** ou l'**abandon des poursuites** (voir `estSusceptibleDeRecours`
 * dans `schema.js`). Aucune autre décision — un classement, une relaxe, une
 * mesure avant dire droit —, ni aucune ordonnance du président, n'est
 * susceptible de recours.
 */
export const RECOURS_CNESER = "CNESER";
export const RECOURS_CNESERAAV = "CNESERAAV";
/**
 * Le juge administratif de droit commun. La compétence suit le **ressort du
 * siège** : c'est le tribunal administratif dans le ressort duquel se trouve le
 * siège de l'établissement qui connaît du recours, et non un tribunal désigné
 * par avance.
 */
export const RECOURS_TRIBUNAL_ADMINISTRATIF = "Tribunal administratif";

export const JURIDICTIONS_RECOURS = {
  [RECOURS_CNESER]: {
    court: "CNESER",
    nom: "Conseil national de l'enseignement supérieur et de la recherche",
    devant: "le Conseil national de l'enseignement supérieur et de la recherche (CNESER)",
    ressortDuSiege: false,
  },
  [RECOURS_CNESERAAV]: {
    court: "CNESERAAV",
    nom: "Conseil national de l'enseignement supérieur et de la recherche agricole, alimentaire et vétérinaire",
    devant: "le Conseil national de l'enseignement supérieur et de la recherche agricole, alimentaire et vétérinaire (CNESERAAV)",
    ressortDuSiege: false,
  },
  [RECOURS_TRIBUNAL_ADMINISTRATIF]: {
    court: "Tribunal administratif",
    nom: "tribunal administratif compétent dans le ressort duquel se trouve le siège de l'établissement",
    devant: "le tribunal administratif compétent dans le ressort duquel se trouve le siège de l'établissement",
    ressortDuSiege: true,
  },
};

/**
 * La voie de recours d'une section : sa clé de catalogue (`cle`), le sigle de la
 * juridiction (`court`, la valeur portée par `Recours.Juridiction`), son nom, et
 * la phrase qui la désigne après « devant » (`devant`) — le siège de la section
 * y est joint lorsqu'il commande la compétence du juge.
 */
export function juridictionRecours(section) {
  const d = procedure(section);
  const cle = JURIDICTIONS_RECOURS[d.recours]
    ? d.recours
    : (d.public === REGIME_EC ? RECOURS_CNESER : RECOURS_TRIBUNAL_ADMINISTRATIF);
  const j = JURIDICTIONS_RECOURS[cle];
  const siege = j.ressortDuSiege ? String(section?.Siege ?? "").trim() : "";
  return { cle, ...j, siege, devant: siege ? `${j.devant} (${siege})` : j.devant };
}

/* ------------------------------------------------------------------ */
/* Collèges                                                            */
/* ------------------------------------------------------------------ */

/**
 * Les collèges nommés par les textes. Les clés sont celles qu'emploient les
 * compositions attendues ; les libellés servent à l'affichage.
 */
export const COLLEGES = {
  professeurs: { label: "Professeurs", mesr: "professeurs des universités ou assimilés", agri: "professeurs de l'enseignement supérieur agricole ou directeurs de recherche" },
  maitres: { label: "Maîtres de conférences", mesr: "maîtres de conférences ou assimilés", agri: "maîtres de conférences de l'enseignement supérieur agricole ou chargés de recherche" },
  enseignants: { label: "Autres personnels exerçant des fonctions d'enseignement", mesr: "personnels titulaires exerçant des fonctions d'enseignement appartenant à un autre corps", agri: "personnels exerçant des fonctions d'enseignement" },
  personnels: { label: "Personnels administratifs et techniques", mesr: "personnels administratifs, ingénieurs, techniques, ouvriers et de service, et personnels de recherche", agri: "personnels administratifs, ingénieurs, techniques, ouvriers et de service, et personnels de recherche" },
  usagers: { label: "Usagers", mesr: "usagers", agri: "usagers" },
  administration: { label: "Représentants de l'administration", mesr: "représentants de l'administration des établissements", agri: "représentants de l'administration des établissements" },
  magistrat: { label: "Magistrat", mesr: "magistrat de l'ordre administratif", agri: "magistrat de l'ordre administratif" },
  exterieur: { label: "Personnalité extérieure", mesr: "personnalité extérieure", agri: "personnalité extérieure" },
};

const COLLEGE_PAR_LIBELLE = {
  "Professeur": "professeurs",
  "Maître de conférence": "maitres",
  "Directeur de recherche": "professeurs",
  "Chargé de recherche": "maitres",
  "Personnel enseignant": "enseignants",
  "Personnel administratif": "personnels",
  "Personnel de bibliothèque": "personnels",
  "Personnel technique ou de recherche": "personnels",
  "Usager": "usagers",
  "Représentant de l'administration": "administration",
  "Magistrat": "magistrat",
  "Personnalité extérieure": "exterieur",
};

/** Collège d'un membre de section, d'après son libellé de collège. */
export function collegeDe(membre) {
  const label = String(membre?.College || "").trim();
  return COLLEGE_PAR_LIBELLE[label] || null;
}

/**
 * Qualité d'un intervenant, déduite de sa **source** (invariant 29).
 *
 * Elle n'est pas à ressaisir : choisir une fiche de membre fait un intervenant
 * **de la section**, n'en choisir aucune — saisie libre, ou personne du
 * répertoire rattachée avant la règle — en fait un intervenant **hors section**,
 * dont le nom s'écrit librement. La source n'est suivie que tant que la qualité
 * est celle que l'outil a lui-même posée : une qualité délibérée — « Agent de
 * l'établissement », « Personnalité extérieure », « Usager » — est conservée,
 * sans quoi un simple changement de source l'effacerait en silence.
 */
export function qualiteIntervenant(qualiteActuelle, { membre = 0 } = {}) {
  const suivie = !qualiteActuelle
    || qualiteActuelle === "Membre de la section"
    || qualiteActuelle === "Hors section";
  if (!suivie) return qualiteActuelle;
  return Number(membre) ? "Membre de la section" : "Hors section";
}

/**
 * Réciproque : libellé à écrire dans `Membres.College` pour une clé de
 * collège. C'est ce que reprend le modèle CSV de composition d'une section,
 * pour que les lignes attendues se remplissent d'elles-mêmes.
 */
export const COLLEGE_MEMBRE = {
  professeurs: "Professeur",
  maitres: "Maître de conférence",
  enseignants: "Personnel enseignant",
  personnels: "Personnel administratif",
  usagers: "Usager",
  administration: "Représentant de l'administration",
  magistrat: "Magistrat",
  exterieur: "Personnalité extérieure",
};

/**
 * Collège attendu, d'après le libellé d'un poste de composition (« professeurs
 * ou directeurs de recherche », « personnels exerçant des fonctions
 * d'enseignement »…). Le rapprochement se fait par mot-clé, dans l'ordre :
 * « maîtres de conférences ou chargés de recherche » ne doit pas être pris pour
 * un poste de professeurs.
 */
const COLLEGE_PAR_MOTIF = [
  [/magistrat/i, "magistrat"],
  [/personnalité extérieure/i, "exterieur"],
  [/représentants? de l'administration/i, "administration"],
  [/exerçant des fonctions d'enseignement/i, "enseignants"],
  [/personnels? administratifs?/i, "personnels"],
  [/usagers?/i, "usagers"],
  [/maîtres? de conférences?|chargés? de recherche/i, "maitres"],
  [/professeurs?/i, "professeurs"],
];

export function collegeAttendu(label) {
  for (const [re, cle] of COLLEGE_PAR_MOTIF) if (re.test(String(label))) return cle;
  return null;
}

/** Collège d'une personne mise en cause, déduit de son corps. */
export function collegeDuCorps(corps) {
  const c = String(corps || "").toLowerCase();
  if (!c) return null;
  if (c.includes("professeur des universités") || c.includes("professeur de l'enseignement supérieur agricole") || c.includes("directeur de recherche")) return "professeurs";
  if (c.includes("maître de conférences") || c.includes("chargé de recherche")) return "maitres";
  if (c.startsWith("professeur agrégé") || c.startsWith("professeur certifié") || c.includes("enseignant associé") || c.includes("ingénieur")) return "enseignants";
  if (c.includes("administratif") || c.includes("bibliothèque")) return "personnels";
  return null;
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

const membres = (n, label) => ({ n, label });

/**
 * Composition de la **section disciplinaire** (le corps électoral, décrit par
 * la table `Membres`) et de la **formation appelée à juger** (décrite, pour
 * chaque affaire, par la table `Intervenants`).
 */
function composition({ section, formation, formationParGrade = null, note = "" }) {
  return { section, formation, formationParGrade, note };
}

/* ------------------------------------------------------------------ */
/* Textes                                                              */
/* ------------------------------------------------------------------ */

const T = {
  usagersA: "Article R.811-11 et suivants du code de l'éducation",
  usagersSanctions: "Article R.811-13-1 du code de l'éducation",
  usagersCommission: "Articles R.811-20 à R.811-32 du code de l'éducation",
  usagersRapport: "Article R.811-28 du code de l'éducation",
  usagersR811_40: "Article R.811-40 du code de l'éducation",
  ecProcedure: "Articles R.712-9 à R.712-46 du code de l'éducation",
  ecSanctions: "Articles L.952-8 et L.952-9 du code de l'éducation",
  ecInstruction: "Article R.712-32 du code de l'éducation",
  ecJugement: "Articles R.712-23 à R.712-25 du code de l'éducation",
  agriUsagers: "Article R.812-24-1 du code rural et de la pêche maritime",
  agriUsagersManquements: "Article R.812-24-2 du code rural et de la pêche maritime",
  agriUsagersComposition: "Articles R.812-24-3 à R.812-24-7 du code rural et de la pêche maritime",
  agriEc: "Article R.812-24-8 du code rural et de la pêche maritime",
  agriEcComposition: "Articles R.812-24-9 à R.812-24-16 du code rural et de la pêche maritime",
  academique: "Articles R.811-43 à R.811-50 du code de l'éducation",
  cgfp: "Article L.532-2 du code général de la fonction publique",
};

/**
 * Ce que chaque texte fonde, en quelques mots. Les textes se citent en clair
 * dans les actes, mais une liste de renvois ne dit rien à qui ne les connaît
 * pas : ce libellé court sert à présenter chaque référence sous un intitulé,
 * plutôt que comme une énumération indifférenciée.
 */
const OBJET_DES_TEXTES = {
  [T.usagersA]: "Champ de la procédure et manquements des usagers",
  [T.usagersSanctions]: "Sanctions applicables aux usagers, et effacement",
  [T.usagersCommission]: "Composition, quorum et fonctionnement de la commission de discipline",
  [T.usagersRapport]: "Instruction et rapport",
  [T.usagersR811_40]: "Entretien disciplinaire (procédure de l'article R.811-40)",
  [T.ecProcedure]: "Champ de la procédure applicable aux enseignants-chercheurs",
  [T.ecSanctions]: "Sanctions applicables aux enseignants-chercheurs",
  [T.ecInstruction]: "Commission d'instruction et rapport",
  [T.ecJugement]: "Formation de jugement",
  [T.agriUsagers]: "Champ de la procédure dans les établissements agricoles",
  [T.agriUsagersManquements]: "Manquements des usagers — établissements agricoles",
  [T.agriUsagersComposition]: "Composition de la commission de discipline — établissements agricoles",
  [T.agriEc]: "Champ de la procédure applicable aux enseignants-chercheurs — établissements agricoles",
  [T.agriEcComposition]: "Composition de la section — établissements agricoles",
  [T.academique]: "Section disciplinaire académique",
  [T.cgfp]: "Prescription de l'action disciplinaire",
};

/** L'objet d'un texte de référence, ou `""` s'il n'est pas catalogué. */
export function objetDuTexte(ref) {
  return OBJET_DES_TEXTES[ref] || "";
}

/* ------------------------------------------------------------------ */
/* Descripteurs                                                        */
/* ------------------------------------------------------------------ */

function baseUsagers(tutelle) {
  const agri = tutelle === TUTELLE_AGRI;
  return {
    code: agri ? "agri-usagers" : "mesr-usagers",
    public: REGIME_USAGERS,
    tutelle,
    type: TYPE_ETABLISSEMENT,
    organe: agri ? "Section disciplinaire du conseil d'administration" : "Section disciplinaire du conseil académique",
    formation: "Commission de discipline",
    ongletFormation: "Commission",
    ongletFormationR811_40: agri ? "Commission" : "Commission",
    instruction: {
      mode: "rapporteur",
      libelle: "Rapport d'instruction",
      rapporteur: agri ? "Désigné par le président de la section parmi les trois premiers collèges" : "Désigné parmi les collèges des professeurs ou des maîtres de conférences",
      rapporteurAdjoint: "Membre du collège des usagers",
      membres: null,
      // Le délai d'instruction : sa durée, et le point de départ de son
      // décompte. Devant les sections d'usagers, l'instruction ne peut excéder
      // **deux mois**, à compter de la **décision de désignation** des
      // rapporteurs — c'est la désignation qui ouvre l'instruction.
      delaiMois: 2,
      delaiDepuis: "designation",
      delaiDesignation: "des rapporteurs",
      delaiTexte: "L'instruction ne peut excéder deux mois ; ce délai court à compter de la date de la décision de désignation des rapporteurs.",
      texte: agri ? T.agriUsagersComposition : T.usagersRapport,
    },
    composition: agri
      ? composition({
          section: [membres(4, "professeurs"), membres(4, "personnels exerçant des fonctions d'enseignement"), membres(2, "personnels administratifs et techniques"), membres(10, "usagers")],
          formation: [membres(2, "professeurs"), membres(2, "personnels exerçant des fonctions d'enseignement"), membres(1, "personnels administratifs et techniques"), membres(5, "usagers")],
          note: "La commission de discipline comprend dix membres : le président de la section, qui la préside, un membre du collège des professeurs, deux du collège des enseignants, un du collège des personnels et cinq usagers.",
        })
      : composition({
          section: [membres(4, "professeurs"), membres(4, "maîtres de conférences"), membres(8, "usagers")],
          formation: [membres(2, "professeurs"), membres(2, "maîtres de conférences"), membres(4, "usagers")],
          note: "Le nombre de membres de la section peut être porté à 6 professeurs, 6 maîtres de conférences et 12 usagers, ou à 8, 8 et 16, selon l'effectif de l'établissement.",
        }),
    quorum: {
      regle: "La commission délibère si la moitié au moins de ses membres est présente.",
      detail: "Le nombre de représentants des usagers ne peut être supérieur à celui des représentants des enseignants.",
    },
    // Le plafond des représentants des usagers est celui de l'article R.811-32.
    // Il ne vaut pas pour la commission de discipline des établissements
    // agricoles, dont la composition (R.812-24-6) comprend cinq usagers pour
    // quatre enseignants — le code rural tient cette composition de son propre
    // texte, sans renvoyer sur ce point au code de l'éducation.
    quotaUsagers: !agri,
    autorites: agri
      ? {
          poursuites: "Le directeur général ou le directeur de l'établissement",
          notification: "Le président de la section disciplinaire",
          copie: "Le ministre chargé de l'agriculture (en lieu et place du recteur de région académique)",
        }
      : {
          poursuites: "Le président de l'université, ou le recteur de région académique",
          notification: "Le président de la section disciplinaire",
          copie: "Le recteur de région académique et le médiateur académique",
        },
    delais: { convocationJours: 15, consultationDossierJours: 10, entretienJours: 8, reponseJours: 15 },
    // La procédure de l'article R.811-40 fait partie des articles que le code
    // rural rend applicables aux établissements d'enseignement supérieur
    // agricole (R.812-24-1, qui vise les articles R.811-12 à R.811-40) : le
    // directeur général ou le directeur y exerce les compétences du président
    // de l'université (R.812-24-1, 2°).
    voieR81140: true,
    // Le recours contre une décision prise à l'égard d'un usager se forme
    // devant le tribunal administratif compétent dans le ressort duquel se
    // trouve le siège de l'établissement — et non devant le CNESER, qui connaît
    // des seuls recours des enseignants-chercheurs.
    recours: RECOURS_TRIBUNAL_ADMINISTRATIF,
    prescription: { applicable: false, annees: 0, texte: "", base: "" },
    effacement: {
      annees: 3,
      sanctions: "L'avertissement, le blâme et la mesure de responsabilisation",
      texte: T.usagersSanctions,
      detail: "Sans nouvelle sanction pendant trois ans, ces sanctions sont effacées du dossier.",
    },
    sanctionsTexte: T.usagersSanctions,
    manquementsTexte: agri ? T.agriUsagersManquements : T.usagersA,
    textes: agri
      ? [T.agriUsagers, T.agriUsagersComposition, T.usagersA, T.usagersSanctions]
      : [T.usagersA, T.usagersRapport, T.usagersCommission, T.usagersSanctions],
  };
}

function baseEC(tutelle) {
  const agri = tutelle === TUTELLE_AGRI;
  return {
    code: agri ? "agri-ec" : "mesr-ec",
    public: REGIME_EC,
    tutelle,
    type: TYPE_ETABLISSEMENT,
    organe: agri ? "Section disciplinaire du conseil d'administration" : "Section disciplinaire du conseil académique",
    formation: "Formation de jugement",
    ongletFormation: "Instruction",
    ongletFormationR811_40: "Instruction",
    instruction: {
      mode: "commission",
      libelle: "Commission d'instruction",
      membres: 2,
      rapporteur: agri ? "L'un des deux membres de la commission d'instruction" : "L'un des deux membres de la commission d'instruction",
      rapporteurAdjoint: "",
      // Le délai d'instruction : le rapport est remis dans un délai de
      // **quatre mois** à compter de la **décision de désignation** de la
      // commission d'instruction — c'est elle qui ouvre l'instruction, et non
      // la saisine.
      delaiMois: 4,
      delaiDepuis: "designation",
      delaiDesignation: "de la commission d'instruction",
      delaiTexte: "Le rapport d'instruction est remis dans un délai de quatre mois à compter de la date de la décision de désignation de la commission d'instruction.",
      texte: agri ? T.agriEcComposition : T.ecInstruction,
    },
    composition: agri
      ? composition({
          section: [membres(6, "professeurs ou directeurs de recherche"), membres(4, "maîtres de conférences ou chargés de recherche"), membres(2, "personnels exerçant des fonctions d'enseignement")],
          formation: null,
          formationParGrade: {
            professeurs: [membres(6, "professeurs ou directeurs de recherche")],
            maitres: [membres(4, "professeurs ou directeurs de recherche"), membres(4, "maîtres de conférences ou chargés de recherche")],
            enseignants: [membres(1, "professeur (présidence)"), membres(1, "maître de conférences ou chargé de recherche"), membres(2, "personnels exerçant des fonctions d'enseignement")],
          },
          note: "La formation de jugement dépend du corps de la personne poursuivie : six membres pour un professeur ou un directeur de recherche, huit pour un maître de conférences ou un chargé de recherche, quatre pour un autre enseignant.",
        })
      : composition({
          section: [membres(4, "professeurs des universités"), membres(4, "maîtres de conférences"), membres(2, "personnels exerçant des fonctions d'enseignement")],
          formation: null,
          formationParGrade: {
            professeurs: [membres(4, "professeurs des universités (dont le président)")],
            maitres: [membres(2, "professeurs des universités (dont le président)"), membres(2, "maîtres de conférences")],
            enseignants: [membres(1, "professeur (présidence)"), membres(1, "maître de conférences"), membres(2, "personnels exerçant des fonctions d'enseignement")],
          },
          note: "La formation de jugement dépend du corps de la personne poursuivie : quatre membres, dont le président, répartis selon son grade (professeur, maître de conférences ou autre enseignant).",
        }),
    quorum: {
      regle: "La formation délibère si trois au moins de ses membres, dont le président, sont présents.",
      detail: "Le quorum se mesure sur les membres appelés à siéger.",
    },
    autorites: agri
      ? {
          poursuites: "Le directeur général ou le directeur de l'établissement",
          notification: "Le président de la section disciplinaire",
          copie: "Le ministre chargé de l'agriculture (en lieu et place du recteur de région académique)",
        }
      : {
          poursuites: "Le président de l'université, ou le recteur de région académique en cas de défaillance",
          notification: "Le président de la section disciplinaire",
          copie: "Le président de l'université et le recteur de région académique",
        },
    delais: { convocationJours: 15, consultationDossierJours: 0, entretienJours: 0, reponseJours: 0, rapportMois: 4 },
    voieR81140: false,
    // Le recours de l'enseignant-chercheur se forme devant le CNESER — et non
    // devant le tribunal administratif, qui connaît des seuls recours des
    // usagers. Dans un établissement agricole, le CNESERAAV prend la place du
    // CNESER (voir `JURIDICTIONS_RECOURS`).
    recours: agri ? RECOURS_CNESERAAV : RECOURS_CNESER,
    prescription: {
      applicable: true,
      annees: 3,
      texte: T.cgfp,
      base: "à compter du jour où l'administration a eu une connaissance effective des faits",
      detail: "Les poursuites pénales interrompent ce délai jusqu'à la décision définitive de classement, de non-lieu ou d'acquittement.",
    },
    effacement: {
      annees: 3,
      sanctions: "Le blâme et le rappel à l'ordre",
      texte: T.ecProcedure,
      detail: "L'effacement est automatique au bout de trois ans, si aucune autre sanction n'est intervenue.",
    },
    sanctionsTexte: T.ecSanctions,
    manquementsTexte: "",
    textes: agri ? [T.agriEc, T.agriEcComposition, T.ecProcedure, T.ecSanctions] : [T.ecProcedure, T.ecInstruction, T.ecJugement, T.ecSanctions],
  };
}

/** Descripteur de la section disciplinaire académique (usagers, MESR). */
function baseAcademique() {
  const d = baseUsagers(TUTELLE_MESR);
  return {
    ...d,
    code: "mesr-usagers-academique",
    type: TYPE_ACADEMIQUE,
    organe: "Section disciplinaire académique (section disciplinaire commune du recteur de région académique)",
    formation: "Section disciplinaire académique",
    ongletFormation: "Section",
    ongletFormationR811_40: "Section",
    composition: composition({
      section: [membres(1, "magistrat de l'ordre administratif (présidence)"), membres(2, "professeurs des universités"), membres(2, "maîtres de conférences"), membres(4, "usagers"), membres(2, "représentants de l'administration")],
      formation: [membres(1, "magistrat (présidence)"), membres(2, "professeurs des universités"), membres(2, "maîtres de conférences"), membres(4, "usagers"), membres(2, "représentants de l'administration")],
      note: "La section siège elle-même : elle ne constitue pas de commission de discipline. Deux représentants de l'administration et quatre usagers y siègent aux côtés du magistrat, de deux professeurs et de deux maîtres de conférences.",
    }),
    quorum: {
      regle: d.quorum.regle,
      detail: "La section est saisie au lieu et place de la section de l'établissement lorsque les faits présentent une gravité ou une sensibilité particulière, ou en cas de doute sérieux sur l'impartialité de la section d'établissement.",
    },
    autorites: {
      saisine: "La section est saisie par le président ou le directeur de l'établissement, qui lui adresse le nom, l'adresse et la qualité de l'usager concerné, les faits reprochés et les pièces justificatives ; il en informe le recteur de région académique. La section ne peut être saisie si des poursuites sont déjà engagées devant la section de l'établissement. Son président se prononce sur la recevabilité de la saisine dans un délai de deux mois.",
      poursuites: "Le président ou le directeur de l'établissement saisit le président de la section disciplinaire commune",
      notification: "Le président de la section disciplinaire commune",
      copie: "Le recteur de région académique",
    },
    voieR81140: false,
    sanctionsTexte: "Les textes dont relève l'établissement de l'usager poursuivi (article R.811-49 du code de l'éducation)",
    textes: [T.academique, T.usagersA, T.usagersSanctions],
  };
}

const DESCRIPTEURS = {
  "mesr|Usagers|Section d'établissement": () => baseUsagers(TUTELLE_MESR),
  "mesr|Usagers|Section d'école interne": () => baseUsagers(TUTELLE_MESR),
  "mesr|Usagers|Section commune à plusieurs établissements": () => baseUsagers(TUTELLE_MESR),
  "mesr|Usagers|Section disciplinaire académique": () => baseAcademique(),
  "mesr|Enseignants-chercheurs|Section d'établissement": () => baseEC(TUTELLE_MESR),
  "mesr|Enseignants-chercheurs|Section d'école interne": () => baseEC(TUTELLE_MESR),
  "mesr|Enseignants-chercheurs|Section commune à plusieurs établissements": () => baseEC(TUTELLE_MESR),
  "agri|Usagers|Section d'établissement": () => baseUsagers(TUTELLE_AGRI),
  "agri|Usagers|Section d'école interne": () => baseUsagers(TUTELLE_AGRI),
  "agri|Usagers|Section commune à plusieurs établissements": () => baseUsagers(TUTELLE_AGRI),
  "agri|Enseignants-chercheurs|Section d'établissement": () => baseEC(TUTELLE_AGRI),
  "agri|Enseignants-chercheurs|Section d'école interne": () => baseEC(TUTELLE_AGRI),
  "agri|Enseignants-chercheurs|Section commune à plusieurs établissements": () => baseEC(TUTELLE_AGRI),
};

/** Clé de tutelle technique ("mesr" / "agri"). */
export function cleTutelle(tutelle) {
  return tutelle === TUTELLE_AGRI ? "agri" : "mesr";
}

/** Forme abrégée d'une tutelle, telle que la portent les catalogues. */
export function tutelleCourte(tutelle) {
  return tutelle === TUTELLE_AGRI ? TUTELLE_COURTE_AGRI : TUTELLE_COURTE_MESR;
}

/**
 * Descripteur de procédure applicable à une section.
 *
 * Une section incomplète (tutelle ou type non renseignés) est traitée comme
 * une section d'établissement relevant de l'enseignement supérieur : c'est le
 * cas le plus courant, et la migration renseigne ces colonnes au chargement.
 */
export function procedure(section) {
  const public_ = section?.Public === REGIME_EC ? REGIME_EC : REGIME_USAGERS;
  const tutelle = TUTELLES.includes(section?.Tutelle) ? section.Tutelle : TUTELLE_MESR;
  let type = TYPES_SECTION.includes(section?.Type_de_section) ? section.Type_de_section : TYPE_ETABLISSEMENT;
  // La section disciplinaire académique statue à l'égard des usagers et relève
  // du ministère chargé de l'enseignement supérieur.
  if (type === TYPE_ACADEMIQUE && (public_ !== REGIME_USAGERS || tutelle !== TUTELLE_MESR)) type = TYPE_ETABLISSEMENT;
  const factory = DESCRIPTEURS[`${cleTutelle(tutelle)}|${public_}|${type}`] || DESCRIPTEURS[`mesr|Usagers|${TYPE_ETABLISSEMENT}`];
  const d = factory();
  d.type = type;
  // La section disciplinaire est instituée **auprès du conseil** de
  // l'établissement — le conseil académique, ou le conseil d'administration
  // dans les établissements agricoles. Dans une **école interne**, elle l'est
  // auprès du **conseil de l'école interne** : c'est lui que nomme l'organe
  // compétent, et non le conseil de l'établissement.
  if (type === TYPE_ECOLE_INTERNE) {
    d.organe = "Section disciplinaire du conseil d'école interne";
  }
  // Les textes prévoient qu'une section disciplinaire soit instituée au sein
  // d'une école interne, ou commune à plusieurs établissements : la composition
  // affichée reste alors celle de la section d'établissement, que le texte
  // instituant la section peut adapter.
  if (type === TYPE_ECOLE_INTERNE || type === TYPE_COMMUNE) {
    d.composition.note = `${d.composition.note ? d.composition.note + " " : ""}La section relève d'un texte propre (école interne ou section commune) : la composition retenue ici est celle de la section d'établissement, à adapter s'il en dispose autrement.`;
  }
  return d;
}

/** Libellé de l'organe disciplinaire d'une section. */
export function libelleOrgane(section) {
  return procedure(section).organe;
}

/** Nom de la formation appelée à juger, dans le vocabulaire de la procédure. */
export function libelleFormation(section) {
  return procedure(section).formation;
}

/** L'affaire suit-elle la procédure de l'article R.811-40 ? */
export function suitProcedureR811_40(affaire) {
  return affaire?.Voie === VOIE_R811_40;
}

/**
 * Voies de traitement proposées pour une affaire d'une section donnée.
 *
 * La procédure de l'article R.811-40 est réservée aux sections compétentes à
 * l'égard des **usagers** (code de l'éducation, R.811-40) ; le code rural la
 * reprend pour les usagers des établissements agricoles (R.812-24-1, 3°).
 * Elle n'est pas prévue pour les sections d'enseignants-chercheurs, ni devant
 * la section disciplinaire académique, dont les articles applicables ne la
 * mentionnent pas.
 */
export function voiesPour(section) {
  return procedure(section).voieR81140 ? [VOIE_SECTION, VOIE_R811_40] : [VOIE_SECTION];
}

/**
 * Nom de l'onglet de composition.
 *
 * L'onglet porte le nom de l'organe qui se prononce : « Commission » pour la
 * commission de discipline des usagers, « Instruction » pour la formation des
 * enseignants-chercheurs, « Section » pour la section disciplinaire
 * académique, qui siège elle-même.
 */
export function libelleOngletFormation(section, affaire) {
  const d = procedure(section);
  if (suitProcedureR811_40(affaire)) return d.type === TYPE_ACADEMIQUE ? d.ongletFormation : d.ongletFormation;
  return d.ongletFormation;
}

// L'ordre des onglets suit celui du déroulé d'un dossier — et celui du menu
// principal, où les documents viennent avant les décisions : la décision
// intervient au **terme** de l'affaire, quand ses pièces sont écrites. Le
// rédacteur passe donc de la séance aux documents, puis à la décision.
const ONGLETS = [
  { id: "synthese", label: "Synthèse", iconName: "article-line" },
  { id: "formation", label: "Commission", short: "Commission", iconName: "group-line" },
  { id: "personnes", label: "Personnes", iconName: "user-line" },
  { id: "seance", label: "Séance", short: "Séance", iconName: "calendar-line" },
  { id: "documents", label: "Documents", iconName: "printer-line" },
  { id: "decision", label: "Décision", iconName: "scales-3-line" },
];

/** Les onglets d'une affaire, adaptés au régime de sa section et à sa voie. */
export function ongletsAffaire(section, affaire) {
  const label = libelleOngletFormation(section, affaire);
  return ONGLETS.map((t) => (t.id === "formation" ? { ...t, label, short: label } : t));
}

/* ------------------------------------------------------------------ */
/* Aide à la lecture de la composition                                 */
/* ------------------------------------------------------------------ */

function libelleCollege(cle, tutelle) {
  const c = COLLEGES[cle];
  if (!c) return cle;
  return tutelle === TUTELLE_AGRI ? (c.agri || c.label) : (c.mesr || c.label);
}

function phraseComposition(liste, tutelle) {
  const parties = (liste || []).map((m) => {
    const cle = collegeAttendu(m.label);
    const nom = cle ? libelleCollege(cle, tutelle) : m.label;
    return `${m.n} ${nom}`;
  });
  if (parties.length <= 1) return parties.join("");
  return `${parties.slice(0, -1).join(", ")} et ${parties.slice(-1)[0]}`;
}

/**
 * Composition attendue, en clair, pour une section donnée. C'est ce que
 * l'interface affiche (Réglages › Sections) et ce que les contrôles comparent
 * aux membres réellement saisis.
 */
export function compositionAttendue(section) {
  const d = procedure(section);
  const c = d.composition;
  const avecCle = (liste) => (liste || []).map((m) => ({ n: m.n, label: m.label, cle: collegeAttendu(m.label) }));
  return {
    section: c.section ? phraseComposition(c.section, d.tutelle) : "",
    sectionListe: avecCle(c.section),
    formation: c.formation ? phraseComposition(c.formation, d.tutelle) : "",
    formationListe: avecCle(c.formation),
    formationParGrade: c.formationParGrade || null,
    note: c.note || "",
    quorum: d.quorum,
  };
}

/** Effectif total attendu pour la formation appelée à juger une affaire. */
export function effectifFormation(section, collegeMisEnCause) {
  const d = procedure(section);
  const c = d.composition;
  if (c.formation) return c.formation.reduce((s, m) => s + m.n, 0);
  if (c.formationParGrade) {
    const liste = c.formationParGrade[collegeMisEnCause] || c.formationParGrade.enseignants;
    return (liste || []).reduce((s, m) => s + m.n, 0);
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Notice de procédure                                                 */
/* ------------------------------------------------------------------ */

/**
 * Explication de la procédure applicable, prête à afficher : les mêmes blocs
 * servent à la page Aide et au rappel affiché dans une affaire. Les textes
 * cités sont ceux qui fondent chaque point.
 */
export function noticeProcedure(section) {
  const d = procedure(section);
  const c = d.composition;
  const comp = compositionAttendue(section);
  const blocs = [];

  blocs.push({
    titre: "Organes",
    items: [
      `Section compétente : ${d.organe}.`,
      `Formation appelée à juger : ${d.formation}.`,
      `Composition de la section : ${comp.section}.`,
      comp.formation ? `Composition de la formation : ${comp.formation}.` : comp.note,
    ],
  });

  blocs.push({
    titre: "Instruction",
    items: d.instruction.mode === "commission"
      ? [
          `L'affaire est instruite par une ${d.instruction.libelle.toLowerCase()} de ${d.instruction.membres} membres, dont l'un est le rapporteur.`,
          d.instruction.rapporteur + ".",
          "Le rapport est remis dans un délai de quatre mois à compter de la décision de désignation de la commission d'instruction ; il est transmis aux parties quinze jours francs au moins avant l'audience.",
        ]
      : [
          "L'affaire est instruite par un rapporteur, assisté d'un rapporteur adjoint.",
          `Rapporteur : ${d.instruction.rapporteur}.`,
          `Rapporteur adjoint : ${d.instruction.rapporteurAdjoint}.`,
          "L'instruction ne peut excéder deux mois à compter de la décision de désignation des rapporteurs ; le rapport et les pièces sont tenus à disposition pendant au moins dix jours avant la séance.",
        ],
  });

  blocs.push({
    titre: "Saisine et poursuites",
    items: [
      d.autorites.saisine || "",
      `Engage les poursuites : ${d.autorites.poursuites}.`,
      `Notifie la décision : ${d.autorites.notification}.`,
      `Copie : ${d.autorites.copie}.`,
    ].filter(Boolean),
  });

  blocs.push({
    titre: "Délais",
    items: [
      `Convocation à la séance : ${d.delais.convocationJours} jours au moins avant la date.`,
      d.delais.consultationDossierJours ? `Consultation du dossier et du rapport : ${d.delais.consultationDossierJours} jours au moins avant la séance.` : "",
      d.delais.entretienJours ? `Procédure de l'article R.811-40 : convocation à l'entretien ${d.delais.entretienJours} jours au moins avant, puis ${d.delais.reponseJours} jours pour accepter ou refuser la proposition.` : "",
      d.prescription.applicable
        ? `Prescription : ${d.prescription.annees} ans ${d.prescription.base} (${d.prescription.texte}). ${d.prescription.detail}`
        : "Aucune prescription : l'action disciplinaire peut être engagée à tout moment, même plusieurs années après les faits. Ce qui s'efface au bout de trois ans, c'est la sanction elle-même lorsqu'elle figure parmi celles que la loi vise.",
      `Effacement : ${d.effacement.sanctions} — ${d.effacement.detail}`,
    ].filter(Boolean),
  });

  blocs.push({
    titre: "Voies de traitement",
    items: [
      d.voieR81140
        ? "Deux voies : la procédure devant la section (avec instruction), ou la procédure de l'article R.811-40 — une alternative à l'instruction, sans rapporteur ni rapport."
        : "Une seule voie : la procédure devant la section, avec instruction. L'article R.811-40 n'est pas applicable aux sections d'enseignants-chercheurs, ni devant la section disciplinaire académique.",
    ],
  });

  const recours = juridictionRecours(section);
  blocs.push({
    titre: "Voies de recours",
    items: [
      `Recours contre la décision : devant ${recours.devant}, dans un délai de deux mois à compter de la notification.`,
      "Seule une décision prononçant une sanction ou l'abandon des poursuites peut faire l'objet d'un recours. Aucune autre décision — un classement, une relaxe, une mesure avant dire droit (report, supplément d'instruction, expertise) — et aucune ordonnance du président, acte préparatoire, ne peut être contestée.",
    ],
  });

  blocs.push({
    titre: "Textes de référence",
    // Chaque renvoi est précédé de ce qu'il fonde : la liste se lit alors comme
    // un sommaire des sources, et non comme une suite d'articles alignés.
    items: d.textes.map((ref) => {
      const objet = objetDuTexte(ref);
      return objet ? `${objet} — ${ref}` : ref;
    }),
  });

  return {
    code: d.code,
    titre: `${d.public} — ${d.organe}`,
    sousTitre: titreProcédure(d),
    blocs,
  };
}

function titreProcédure(d) {
  const tutelle = d.tutelle === TUTELLE_AGRI ? "établissement agricole" : "établissement relevant de l'enseignement supérieur";
  const type = d.type === TYPE_ACADEMIQUE ? " — section disciplinaire académique"
    : d.type === TYPE_ECOLE_INTERNE ? " — section d'école interne"
    : d.type === TYPE_COMMUNE ? " — section commune à plusieurs établissements"
    : "";
  return `${d.public === REGIME_EC ? "Enseignants-chercheurs" : "Usagers"}, ${tutelle}${type}`;
}

/** Les cinq procédures, pour la page Aide. */
export function noticesProcedures() {
  const sections = [
    { Public: REGIME_USAGERS, Tutelle: TUTELLE_MESR, Type_de_section: TYPE_ETABLISSEMENT },
    { Public: REGIME_EC, Tutelle: TUTELLE_MESR, Type_de_section: TYPE_ETABLISSEMENT },
    { Public: REGIME_USAGERS, Tutelle: TUTELLE_AGRI, Type_de_section: TYPE_ETABLISSEMENT },
    { Public: REGIME_EC, Tutelle: TUTELLE_AGRI, Type_de_section: TYPE_ETABLISSEMENT },
    { Public: REGIME_USAGERS, Tutelle: TUTELLE_MESR, Type_de_section: TYPE_ACADEMIQUE },
  ];
  return sections.map((s) => {
    const n = noticeProcedure(s);
    n.groupe = s.Public === REGIME_EC ? "Enseignants-chercheurs" : "Usagers";
    n.tutelle = s.Tutelle;
    n.type = s.Type_de_section;
    n.texte = procedure(s).textes[0];
    return n;
  });
}

export { ETATS, VOIE_SECTION, VOIE_R811_40, VOIES, TUTELLES, TYPES_SECTION, TUTELLE_MESR, TUTELLE_AGRI, TYPE_ETABLISSEMENT, TYPE_ECOLE_INTERNE, TYPE_ACADEMIQUE, TYPE_COMMUNE };
