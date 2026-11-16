// Schéma des tables — modèle « v2 », reconstruit d'après les besoins de
// l'interface.
//
// Le document Grist d'origine a servi de point de départ, mais ce schéma n'est
// plus sa transposition : chaque table et chaque colonne existe parce qu'un
// écran, un contrôle de régularité ou un document s'en sert. Les deux régimes
// (usagers et enseignants-chercheurs) sont couverts par le même modèle :
//
//  - la personne mise en cause n'est plus une suite de colonnes de l'affaire,
//    mais une ligne de `Personnes` (dont le `Type` porte le régime) ;
//  - la composition de la formation est portée par `Intervenants`, qui sait
//    aussi bien désigner un membre de la section qu'un rapporteur pris
//    ailleurs — ce qu'exigent les sections d'enseignants-chercheurs ;
//  - les seuils (prescription, délais) vivent dans `Parametres`, pas dans le
//    code, et sont contrôlés affaire par affaire (voir `regimes.js`).
//
// Voir `src/SPEC.md` pour la justification du modèle et `src/legacy.js` pour
// l'architecture d'origine, qui alimente l'outil d'import.
//
// Les identifiants de colonnes du document d'origine sont conservés quand ils
// signifient la même chose : le dictionnaire des balises des trames
// (`{{Affaire}}.INE`, `{{Secretaire}}.Nom_complet`, …) reste donc valable.

import { TRAMES_PAR_DEFAUT, TYPES_TRAMES_PAR_DEFAUT, ANCIENS_TYPES_TRAMES, ANCIEN_FORMAT, ANCIEN_DEFAUT, TRAMES_PAR_ID, TITRES_LIVRES } from "./trames-defaut.js";
import { CHARTES } from "./charte.js";
import { RUBRIQUES, NATURES, DOMAINES } from "./considerants.js";

export const ETATS = [
  "Pré-enregistrée",
  "Enregistrée",
  "Instruction",
  "Examen",
  "Terminée",
  "Classé sans suite",
];

// Couleur d'état reprise du document Grist d'origine (badge DSFR équivalent).
export const ETAT_BADGE = {
  "Pré-enregistrée": "fr-badge--green-bourgeon",
  "Enregistrée": "fr-badge--success",
  "Instruction": "fr-badge--purple-glycine",
  "Examen": "fr-badge--warning",
  "Terminée": "fr-badge--green-emeraude",
  "Classé sans suite": "fr-badge--error",
};

// Sanctions et issues de procédure — liste historique, conservée pour les
// données déjà saisies et les trames qui nomment `{{Decisions}}.Decision`.
// Le catalogue de référence est désormais la table `Sanctions`.
//
// Les mesures avant dire droit ferment la liste : elles ne jugent pas le fond
// — un report, un supplément d'instruction, une expertise, une audition de
// témoins — et ne se confondent donc pas avec la décision définitive de
// l'affaire (voir `NATURE_INTERLOCUTOIRE`).
export const MESURES_AVANT_DIRE_DROIT = [
  "Report de l'examen",
  "Supplément d'instruction",
  "Expertise",
  "Audition de témoins",
];

export const DECISIONS = [
  "Abandon des poursuites",
  "Avertissement",
  "Blâme",
  "Mesure de responsabilisation",
  "Exclusion temporaire de l'établissement",
  "Exclusion définitive de l'établissement",
  "Exclusion temporaire de tout établissement public d'enseignement supérieur",
  "Exclusion définitive de tout établissement public d'enseignement supérieur",
  ...MESURES_AVANT_DIRE_DROIT,
];

export const GENRES = ["F", "M", "N/A"];

/**
 * Emplacement du texte de la trame dans une **feuille de style**.
 *
 * Une feuille de style est le document entier d'un format — l'en-tête, le
 * chapeau, la signature et le pied de page répété — écrit d'un seul tenant. Il
 * y manque le seul texte qui change d'une pièce à l'autre : `{{Corps}}` marque
 * l'endroit où le corps de la trame vient s'insérer (voir `computeDocumentParts`
 * dans `render.js`). C'est la seule balise de mise en page qui subsiste : les
 * quatre autres (`{{En_tete}}`, `{{En_tete_corps}}`, `{{Signature}}`,
 * `{{Pied_de_page}}`) sont sans objet depuis que la trame hérite de la feuille
 * de style de son format.
 */
export const BALISE_CORPS = "{{Corps}}";

/* ------------------------------------------------------------------ */
/* Vocabulaires du modèle v2                                           */
/* ------------------------------------------------------------------ */

/** Régimes d'une section — la colonne `Public` porte exactement ces valeurs. */
export const REGIMES = ["Usagers", "Enseignants-chercheurs"];

/**
 * Tutelle de l'établissement — la colonne `Sections_disciplinaires.Tutelle`
 * porte exactement ces valeurs.
 *
 * Elle commande la **composition** des organes disciplinaires : le code de
 * l'éducation fixe celle des sections d'établissement relevant du ministère
 * chargé de l'enseignement supérieur (R.811-14 et R.712-13), le code rural et
 * de la pêche maritime celle des établissements d'enseignement supérieur
 * agricole public (R.812-24-3 et R.812-24-9). La **procédure**, elle, est
 * celle du code de l'éducation pour les deux tutelles : le code rural s'y
 * réfère expressément (R.812-24-1 et R.812-24-8).
 */
export const TUTELLE_MESR = "Ministère chargé de l'enseignement supérieur";
export const TUTELLE_AGRI = "Ministère chargé de l'agriculture";
export const TUTELLES = [TUTELLE_MESR, TUTELLE_AGRI];

/** Formes abrégées, pour les catalogues (sanctions, motifs). */
export const TUTELLE_COURTE_MESR = "Enseignement supérieur";
export const TUTELLE_COURTE_AGRI = "Agriculture";
export const TUTELLE_COURTES = ["Les deux", TUTELLE_COURTE_MESR, TUTELLE_COURTE_AGRI];

/**
 * « Toutes » : valeur des filtres de procédure d'une trame. Une trame qui ne
 * vise aucune tutelle ni aucun type de section particuliers vaut pour toutes
 * les procédures — c'est le cas par défaut.
 */
export const TOUTES = "Toutes";
export const TUTELLE_TRAME = [TOUTES, TUTELLE_COURTE_MESR, TUTELLE_COURTE_AGRI];

/**
 * Type de section disciplinaire — la colonne
 * `Sections_disciplinaires.Type_de_section` porte exactement ces valeurs.
 *
 * « Section disciplinaire académique » désigne la section disciplinaire
 * commune mise en place par le recteur de région académique (code de
 * l'éducation, R.811-43 à R.811-50) : compétente à l'égard des usagers, en
 * lieu et place de la section d'établissement, pour les faits graves ou
 * sensibles, et présidée par un magistrat de l'ordre administratif.
 */
export const TYPE_ETABLISSEMENT = "Section d'établissement";
export const TYPE_ECOLE_INTERNE = "Section d'école interne";
export const TYPE_ACADEMIQUE = "Section disciplinaire académique";
export const TYPE_COMMUNE = "Section commune à plusieurs établissements";
export const TYPES_SECTION = [TYPE_ETABLISSEMENT, TYPE_ECOLE_INTERNE, TYPE_ACADEMIQUE, TYPE_COMMUNE];

/**
 * Voies de traitement d'une affaire.
 *
 * « Section disciplinaire » est la procédure ordinaire, avec instruction.
 * « Entretien disciplinaire (R.811-40) » est la procédure de l'article R.811-40 :
 * une **alternative à l'instruction**, qui ne comporte aucune phase
 * d'instruction — l'affaire n'en suit pas moins son cheminement, jusqu'à la
 * décision de la formation.
 */
export const VOIE_SECTION = "Section disciplinaire";
export const VOIE_R811_40 = "Entretien disciplinaire (R.811-40)";
export const VOIES = [VOIE_SECTION, VOIE_R811_40];

export const TYPES_PERSONNE = ["Usager", "Personnel", "Tiers"];

export const CORPS = [
  // Corps de l'enseignement supérieur relevant du ministère chargé de
  // l'enseignement supérieur (code de l'éducation, R.712-13 et L.952-8).
  "Professeur des universités",
  "Maître de conférences",
  "Professeur agrégé (PRAG)",
  "Professeur certifié (PLP)",
  // Corps de l'enseignement supérieur agricole (code rural, R.812-24-9).
  "Professeur de l'enseignement supérieur agricole",
  "Directeur de recherche",
  "Maître de conférences de l'enseignement supérieur agricole",
  "Chargé de recherche",
  "Enseignant associé",
  // Autres personnels et cas particuliers.
  "Personnel administratif",
  "Personnel de bibliothèque",
  "Ingénieur",
  "Autre",
];

/**
 * Collèges d'un membre de section — la colonne `Membres.College` porte
 * exactement ces valeurs.
 *
 * Les libellés sont communs aux deux tutelles : la correspondance avec les
 * collèges nommés par les textes (professeurs, maîtres de conférences,
 * personnels exerçant des fonctions d'enseignement, personnels administratifs,
 * usagers…) est établie par `collegeDe()` dans `procedure.js`. Les corps
 * propres à l'enseignement supérieur agricole y trouvent leur place
 * (« Directeur de recherche », « Chargé de recherche »), comme le magistrat
 * qui préside une section disciplinaire académique.
 */
export const COLLEGES_MEMBRE = [
  "Professeur",
  "Maître de conférence",
  "Directeur de recherche",
  "Chargé de recherche",
  "Personnel enseignant",
  "Personnel administratif",
  "Personnel de bibliothèque",
  "Personnel technique ou de recherche",
  "Usager",
  "Représentant de l'administration",
  "Magistrat",
  "Personnalité extérieure",
];

export const ROLES_INTERVENANT = [
  "Président de la formation",
  "Assesseur",
  "Membre de la formation",
  "Rapporteur",
  // Le rôle « Rapporteur adjoint » est celui de la procédure applicable aux
  // usagers (R.811-28 : un rapporteur et un rapporteur adjoint). Devant les
  // sections d'enseignants-chercheurs, l'instruction est confiée à une
  // commission d'instruction de deux membres (R.712-32) : le second membre
  // porte le rôle « Membre de la commission d'instruction ».
  "Rapporteur adjoint",
  "Membre de la commission d'instruction",
  "Représentant des usagers",
  "Secrétaire de séance",
];

export const QUALITES_INTERVENANT = [
  "Membre de la section",
  "Hors section",
  "Agent de l'établissement",
  "Personnalité extérieure",
  "Usager",
];

export const STATUTS_INTERVENANT = [
  "Désigné",
  "Convoqué",
  "Présent",
  "Absent",
  "Excusé",
  "Récusé",
  "Déporté",
  "Remplacé",
];

export const ROLES_IMPLICATION = [
  "Co-mis en cause",
  "Victime",
  "Témoin",
  "Défenseur",
  "Représentant",
  "Représentant légal",
  "Interprète",
  "Autre",
];

export const TYPES_SEANCE = [
  "Séance d'examen",
  "Réunion d'instruction",
  "Audition",
  "Entretien disciplinaire (R.811-40)",
];

export const MODES_CONVOCATION = [
  "Lettre recommandée avec accusé de réception",
  "Remise en main propre contre décharge",
  "Courriel avec accusé de réception",
  "Notification par la plateforme dématérialisée",
];

/** La sanction prononcée : elle tranche le fond et, à ce titre, se conteste. */
export const NATURE_SANCTION = "Sanction";

/**
 * L'issue de procédure : l'affaire s'achève sans sanction — abandon des
 * poursuites, classement, relaxe. Seul l'**abandon des poursuites** rouvre la
 * voie du recours (voir `estSusceptibleDeRecours`) ; le classement et la relaxe,
 * qui sont des jugements défavorables à la personne poursuivie, ne se
 * contestent pas par elle.
 */
export const NATURE_ISSUE_PROCEDURE = "Issue de procédure";

/**
 * Nature d'une décision avant dire droit. Les décisions qui tranchent le fond
 * — sanctions et issues de procédure — sont les **décisions définitives** :
 * une affaire n'en comporte qu'une, et c'est elle que reprend une trame
 * « Décision définitive » (voir `Decisions` dans `formulas.js`).
 */
export const NATURE_INTERLOCUTOIRE = "Décision interlocutoire";

export const NATURES_DECISION = [NATURE_SANCTION, NATURE_ISSUE_PROCEDURE, NATURE_INTERLOCUTOIRE];

/**
 * L'issue de procédure qui ouvre une voie de recours : l'abandon des
 * poursuites, par lequel l'affaire s'achève sans sanction mais peut être
 * reprise par l'autorité qui a engagé les poursuites.
 */
export const ISSUE_PROCEDURE_RECOURS = "Abandon des poursuites";

/**
 * Une décision est-elle susceptible de recours ?
 *
 * Seule la décision qui **prononce une sanction** ou **l'abandon des
 * poursuites** peut être déférée au CNESER, au CNESERAAV ou au juge
 * administratif. Aucune autre décision ne le peut : ni un classement, ni une
 * relaxe, ni une mesure avant dire droit. Une **ordonnance** du président, acte
 * préparatoire, ne l'est pas davantage — elle n'est d'ailleurs pas une décision
 * (`Decisions`), mais un document.
 *
 * C'est le prédicat unique dont dépendent le calcul du délai de recours
 * (`Recours_limite_le`, `formulas.js`), les articles de recours proposés au
 * dispositif (`formules-decision.js`), le bouton « Ajouter un recours »
 * (`app.js`) et les contrôles de régularité (`regimes.js`). Le corriger ici les
 * corrige tous.
 */
export function estSusceptibleDeRecours(decision) {
  if (!decision) return false;
  const nature = String(decision.Nature || "");
  if (nature === NATURE_SANCTION) return true;
  if (nature === NATURE_INTERLOCUTOIRE) return false;
  const libelle = String(decision.Libelle_decision ?? decision.Decision ?? "").trim().toLowerCase();
  if (nature === NATURE_ISSUE_PROCEDURE) return libelle === ISSUE_PROCEDURE_RECOURS.toLowerCase();
  // Nature absente (données anciennes) : la mesure avant dire droit se
  // reconnaît à son texte, faute de quoi la décision est une sanction —
  // l'abandon des poursuites compris.
  return !MESURES_AVANT_DIRE_DROIT.some((m) => m.toLowerCase() === libelle);
}

export const JURIDICTIONS = [
  "CNESER",
  "CNESERAAV",
  "Tribunal administratif",
  "Cour administrative d'appel",
  "Conseil d'État",
  "Autre",
];

export const TYPES_RECOURS = [
  "Recours gracieux",
  "Recours hiérarchique",
  "Recours contentieux",
  "Appel",
  "Pourvoi en cassation",
];

export const ISSUES_RECOURS = ["En cours", "Rejeté", "Annulé", "Réformé", "Désistement", "Irrecevable"];

/**
 * Groupes de sanction. Le groupe n'est pas décoratif : il commande le calcul du
 * terme (voir `Terme_de_la_sanction`, dans `formulas.js`). « Avertissement et
 * blâme » et « Mesure de responsabilisation » s'effacent au bout du délai réglé
 * dans les paramètres ; « Exclusion définitive » et « Révocation » ne s'effacent
 * jamais ; les autres courent pendant la durée prononcée.
 */
export const GROUPES_SANCTION = [
  "Avertissement et blâme",
  "Mesure de responsabilisation",
  "Retard, abaissement et avancement",
  "Interdiction",
  "Exclusion temporaire",
  "Exclusion définitive",
  "Révocation",
];

/** Familles de motifs, découpées sur les items des textes plutôt que par gravité. */
export const GROUPES_MOTIF = [
  "Vie universitaire et règlement intérieur",
  "Fraude et plagiat",
  "Violences et harcèlement",
  "Discrimination et haine",
  "Ordre et fonctionnement de l'établissement",
  "Manquement aux obligations de service",
  "Devoirs et probité des agents publics",
  "Comportement",
  "Autre",
];

export const CATEGORIES_PARAMETRE = ["Prescription", "Délais", "Sanctions", "Rédaction", "Conservation", "Juridique"];

export const STATUTS_DOCUMENT = ["Brouillon", "À signer", "Signé", "Envoyé"];

/* ------------------------------------------------------------------ */
/* Formats, auteurs et destinataires des documents                     */
/* ------------------------------------------------------------------ */
//
// Un document est produit par un **auteur** et, s'il est adressé, à un
// **destinataire**. L'auteur et le destinataire ne se choisissent plus sur le
// document : ils sont **programmés sur la trame**, ce qui allège d'autant
// l'espace de rédaction. Le **type de trame** ne porte plus que le **format**
// — la feuille de style : un courrier, une attestation, une ordonnance ou une
// décision — et, pour un acte rendu, l'**organe** qui décide.

/** Formats (feuilles de style) d'un type de trame. */
export const FORMAT_COURRIER = "Courrier";
export const FORMAT_ATTESTATION = "Attestation";
export const FORMAT_RAPPORT = "Rapport";
// Deux formats **rendus** — par un organe, non adressés à un destinataire — et
// deux seulement : l'**ordonnance**, que le président de la section ou celui de
// la formation de jugement rend seul, et la **décision** de la formation de
// jugement, rendue par la chambre réunie. La distinction est celle des textes :
// le président règle la marche de l'instance, la formation tranche le fond.
export const FORMAT_ORDONNANCE = "Ordonnance";
export const FORMAT_DECISION = "Décision";
export const FORMATS_RENDUS = [FORMAT_ORDONNANCE, FORMAT_DECISION];
export const FORMATS_DOCUMENT = [FORMAT_COURRIER, FORMAT_ATTESTATION, FORMAT_RAPPORT, FORMAT_ORDONNANCE, FORMAT_DECISION];

/**
 * Position d'un logo dans l'en-tête d'un document : les trois zones que la
 * charte de l'État prévoit — la gauche, le centre, la droite. Le réglage vaut
 * par **feuille de style** (voir `Types_Trames`), et se mesure en largeur : la
 * hauteur, elle, suit la ligne de l'en-tête.
 */
export const POSITIONS_LOGO = ["Gauche", "Centre", "Droite"];

/**
 * Organe qui décide, pour une ordonnance ou une décision.
 *
 * La **section disciplinaire** est l'organe lui-même : un organe administratif
 * lorsqu'elle statue à l'égard des usagers, une juridiction lorsqu'elle statue à
 * l'égard des enseignants-chercheurs. Pour juger une affaire, elle se réunit en
 * **formation de jugement** — et, devant les usagers, cette formation porte le
 * nom de **commission de discipline**. La commission est à la section ce que la
 * chambre est au tribunal.
 *
 * Le président de la section et celui de la formation ne se confondent donc
 * pas, et les textes donnent à chacun ses compétences : le président de la
 * section compose la formation, remplace les membres qui ne peuvent siéger
 * (R.811-21), désigne les rapporteurs et la commission d'instruction (R.712-32),
 * tandis que le président de la commission fixe la date de la séance (R.811-30).
 * Le plus souvent la même personne préside les deux, mais pas toujours — le
 * président de la section disciplinaire académique est un magistrat ; d'où deux
 * organes, et non un.
 *
 *  - « Président de la section disciplinaire » — sa décision est
 *    **nécessairement avant dire droit** : elle règle la constitution de la
 *    formation et la marche de l'instance (composition, remplacement d'un
 *    membre, désignation des rapporteurs ou de la commission d'instruction).
 *  - « Président de la formation de jugement » — le président de la commission
 *    de discipline, qui ne porte ce nom que devant les usagers : sa décision
 *    est elle aussi **nécessairement avant dire droit** (date de la séance,
 *    complément d'instruction, requalification des motifs…).
 *  - « Formation de jugement » — la chambre réunie : sa décision peut être
 *    avant dire droit comme définitive, c'est elle qui tranche le fond.
 */
export const ORGANE_PRESIDENT_SECTION = "Président de la section disciplinaire";
export const ORGANE_PRESIDENT_FORMATION = "Président de la formation de jugement";
export const ORGANE_FORMATION = "Formation de jugement";
export const ORGANES_DECISION = [ORGANE_PRESIDENT_SECTION, ORGANE_PRESIDENT_FORMATION, ORGANE_FORMATION];

/**
 * Auteurs d'un document : qui le rédige et le signe. Programmé sur la trame,
 * il alimente la signature (`{f_emetteur}`, `{nom_emetteur}`) et le bloc
 * « émetteur » de l'en-tête.
 *
 * Le président de la section est remplacé par son vice-président lorsqu'il est
 * empêché (voir `signataire.js`) : le remplacement vaut pour l'auteur comme
 * pour toute autre écriture du nom du signataire.
 */
export const AUTEUR_PRESIDENT_SECTION = "Président de la section disciplinaire";
export const AUTEUR_PRESIDENT_COMMISSION = "Président de la commission de discipline";
export const AUTEUR_FORMATION = "Formation de jugement";
export const AUTEUR_AUTORITE = "Autorité ayant engagé les poursuites";
export const AUTEUR_SECRETAIRE = "Secrétaire";
// Le rapport d'instruction est une **pièce** : son auteur est celui qui
// l'établit et le signe — le rapporteur pour la procédure des usagers
// (R.811-28), la commission d'instruction pour celle des
// enseignants-chercheurs (R.712-32). Ces deux qualités ne se confondent pas
// avec celle du président : un rapport ne porte pas la signature de la
// formation qui jugera.
export const AUTEUR_RAPPORTEUR = "Rapporteur";
export const AUTEUR_COMMISSION_INSTRUCTION = "Commission d'instruction";
export const AUTEURS_TRAME = [
  AUTEUR_PRESIDENT_SECTION,
  AUTEUR_PRESIDENT_COMMISSION,
  AUTEUR_FORMATION,
  AUTEUR_AUTORITE,
  AUTEUR_SECRETAIRE,
  AUTEUR_RAPPORTEUR,
  AUTEUR_COMMISSION_INSTRUCTION,
];

/**
 * Destinataires d'un courrier ou d'une attestation. Programmé sur la trame, il
 * alimente le bloc « destinataire » de l'en-tête (`{destinataire}`,
 * `{adresse}`, `{formule_destinataire}`).
 *
 * Les personnes — mis en cause, victime, témoin — se désignent par leur rôle
 * dans l'affaire ; les destinataires institutionnels par leur qualité. Le
 * « destinataire libre », lui, s'écrit à la main sur le document.
 *
 * « Président de la section disciplinaire » est la contrepartie de la lettre
 * de saisine : celle-ci est écrite par l'autorité qui a engagé les poursuites
 * et adressée au président de la section.
 */
export const DEST_MIS_EN_CAUSE = "Mis en cause";
export const DEST_VICTIME = "Victime";
export const DEST_TEMOIN = "Témoin";
export const DEST_AUTORITE = "Autorité ayant engagé les poursuites";
export const DEST_CHEF_ETABLISSEMENT = "Chef d'établissement";
export const DEST_TUTELLE = "Autorité de tutelle";
export const DEST_PRESIDENT_SECTION = "Président de la section disciplinaire";
export const DEST_LIBRE = "Destinataire libre";
export const DESTINATAIRES_TRAME = [
  DEST_MIS_EN_CAUSE,
  DEST_VICTIME,
  DEST_TEMOIN,
  DEST_AUTORITE,
  DEST_CHEF_ETABLISSEMENT,
  DEST_TUTELLE,
  DEST_PRESIDENT_SECTION,
  DEST_LIBRE,
];

/**
 * Qualités d'un destinataire institutionnel qui désignent un **chef
 * d'établissement** — président d'université, directeur général, directeur.
 * Sert à résoudre, pour une section, le destinataire « chef d'établissement ».
 */
export const QUALITES_CHEF_ETABLISSEMENT = [
  "Président d'université",
  "Directeur général",
  "Directrice générale",
  "Directeur",
  "Directrice",
];

/**
 * Qualités d'un destinataire institutionnel qui désignent l'**autorité de
 * tutelle** : le recteur de région académique lorsque l'établissement relève
 * du ministère chargé de l'enseignement supérieur, le ministre chargé de
 * l'agriculture lorsqu'il relève du ministère chargé de l'agriculture.
 */
export const QUALITE_RECTEUR = "Recteur";
export const QUALITE_MINISTRE = "Ministre";

const t = (id, label, extra = {}) => ({ id, label, type: "Text", ...extra });
const ro = { formula: true };

export const SCHEMA = {
  Sections_disciplinaires: {
    label: "Sections disciplinaires",
    singular: "section disciplinaire",
    icon: "school-line",
    display: "Intitule_de_la_section",
    columns: [
      t("Structure", "Nom de la structure", { desc: "Nom de l'établissement public. Par ex. Université d'Angers ou École nationale d'architecture." }),
      t("Public", "Régime (public concerné)", { type: "Choice", choices: REGIMES, desc: "Usagers ou enseignants-chercheurs. Le régime détermine la procédure applicable à l'affaire, les onglets et les catalogues proposés." }),
      t("Tutelle", "Tutelle", { type: "Choice", choices: TUTELLES, desc: "Ministère de rattachement de l'établissement. La tutelle détermine la composition des organes disciplinaires : code de l'éducation pour l'enseignement supérieur, code rural et de la pêche maritime pour l'agriculture. La procédure suivie, elle, est celle du code de l'éducation dans les deux cas." }),
      t("Type_de_section", "Type de section", { type: "Choice", choices: TYPES_SECTION, desc: "Section d'établissement, section d'école interne, section commune à plusieurs établissements, ou section disciplinaire académique (la section commune du recteur de région académique, compétente à l'égard des usagers et présidée par un magistrat). Il commande le nom de l'organe compétent, donc le conseil auprès duquel la section est instituée : conseil académique de l'établissement, conseil d'administration dans un établissement agricole, ou conseil de l'école interne pour une section d'école interne." }),
      t("Siege", "Siège", { desc: "Ville siège de la section disciplinaire." }),
      t("Structure_Nom_Complet", "Nom complet de la structure", { desc: "Certains établissements ont un nom légal qui diffère de leur nom usuel. Vous pouvez renseigner ce dernier ici." }),
      t("Logo", "Logo", { desc: "URL vers le logo de votre établissement. Peut être remplacé par un autre logo, ou laissé vide." }),
      t("Marianne", "Marianne", { desc: "URL vers une image du bloc-marque de l'État. Peut être remplacé par un autre logo, ou laissé vide." }),
      t("Acronyme", "Acronyme", { desc: "Un acronyme libre pour désigner cette section. Cet acronyme sera utilisé pour définir les numéros des affaires et des séances." }),
      t("Email_de_contact", "Courriel du secrétariat", { desc: "Renseigner une adresse générique à laquelle les usagers peuvent écrire." }),
      t("Secretariat_Rue", "Adresse du secrétariat (n° et rue)", { desc: "Réutilisé pour les courriers." }),
      t("Secretariat_CP_Ville", "Code postal et ville du secrétariat", { desc: "Réutilisé pour les courriers." }),
      t("Secretaires", "Secrétaires", { type: "RefList:Secretaires", miroir: "Secretaires.Section", desc: "Les secrétaires rattachés à cette section disciplinaire. Le rattachement se pose ici ou sur la fiche du secrétaire : les deux faces d'une même relation restent ainsi d'accord (voir « Secrétaires »)." }),
      t("VP", "Vice-Président ?", { type: "Bool", desc: "Le président est absent : le vice-président signe toutes les pièces de la section. Pour une absence ponctuelle, cochez plutôt la case du document concerné, dans les paramètres de ce document." }),
      t("Intitule_de_la_section", "Intitulé de la section", ro),
      t("President", "Président", { ...ro, desc: "Donnée complétée automatiquement selon les membres." }),
      t("Formule", "Formule", ro),
      t("Formule_complete", "Formule complète", ro),
      t("Lien_cliquable", "Lien cliquable", ro),
      t("Voie_de_recours", "Voie de recours", { ...ro, desc: "Le corps devant lequel se forme le recours contre une décision de la section : le tribunal administratif compétent dans le ressort duquel se trouve le siège de l'établissement pour les usagers, le CNESER — ou le CNESERAAV dans un établissement agricole — pour les enseignants-chercheurs. Les trames de notification la reprennent pour énoncer la voie de recours sans distinguer les procédures." }),
      t("Secretaires_Email", "Secrétaires_Email", ro),
    ],
  },

  Membres: {
    label: "Membres",
    singular: "membre",
    icon: "user-line",
    display: "Nom_complet",
    columns: [
      t("Prenom", "Prénom"),
      t("NOM", "NOM"),
      t("Genre", "Genre", { type: "Choice", choices: GENRES }),
      t("College", "Collège", { type: "Choice", choices: COLLEGES_MEMBRE, desc: "Collège d'appartenance, tel que les textes le nomment pour la composition de la section : professeurs, maîtres de conférences, autres personnels exerçant des fonctions d'enseignement, personnels administratifs et techniques, usagers… Il sert à vérifier la composition de la section et des formations." }),
      t("Email", "Email"),
      t("Role", "Rôle", { type: "Choice", choices: ["Président", "Vice-Président", "Membre"], desc: "Le président de la section signe les documents ; le vice-président le remplace lorsqu'il est empêché." }),
      t("Section", "Section", { type: "Ref:Sections_disciplinaires", desc: "La section disciplinaire à laquelle le membre est rattaché." }),
      t("Mandat_debut", "Début du mandat", { type: "Date", desc: "Date de la nomination. Sert à vérifier que la formation était régulièrement composée à la date de la séance." }),
      t("Mandat_fin", "Fin du mandat", { type: "Date", desc: "Date de fin de mandat. Un membre dont le mandat est échu n'est plus « en fonction »." }),
      t("Fin_de_mandat", "Terme (année)", { type: "Int", desc: "Ancienne colonne du document d'origine : terme du mandat, en années (ex. 2026). Utilisée tant que la date de fin de mandat n'est pas renseignée." }),
      t("En_fonction", "En fonction", { type: "Bool", ...ro }),
      t("Nom_complet", "Nom complet", ro),
      t("Mme_Mr", "Mme_Mr", ro),
      t("Formule", "Formule", ro),
      t("Formule_complete", "Formule_complète", ro),
      t("Qualite", "Qualité", ro),
    ],
  },

  Secretaires: {
    label: "Secrétaires",
    singular: "secrétaire",
    icon: "user-star-line",
    display: "Nom_complet",
    columns: [
      t("Prenom", "Prénom"),
      t("Nom", "Nom"),
      t("Genre", "Genre", { type: "Choice", choices: ["M", "F"] }),
      t("Email", "Email"),
      t("Section", "Sections", { type: "RefList:Sections_disciplinaires", miroir: "Sections_disciplinaires.Secretaires", desc: "Les sections que ce secrétaire suit. Le rattachement se pose ici ou sur la fiche de la section : les deux faces d'une même relation restent ainsi d'accord." }),
      t("Actif_", "Actif ?", { type: "Bool", desc: "Un secrétaire inactif n'est plus proposé à l'attribution des affaires ; sa fiche et ses rattachements sont conservés." }),
      t("Nom_complet", "Nom complet", ro),
      t("Section_UUID", "Section_UUID", ro),
      t("Formule", "Formule", ro),
    ],
  },

  Destinataires_institutionnels: {
    label: "Destinataires institutionnels",
    singular: "destinataire institutionnel",
    icon: "mail-line",
    display: "Nom_complet",
    columns: [
      t("Section", "Section", { type: "RefList:Sections_disciplinaires" }),
      t("Qualite", "Qualité", { type: "Choice", choices: ["Président d'université", "Ministre", "Recteur", "Directeur général", "Président de section disciplinaire", "Directrice générale", "Directeur", "Directrice"] }),
      t("Nom_complet", "Nom complet"),
      t("Adresse", "Adresse"),
      t("Formule_de_politesse", "Formule de politesse", { type: "Choice", choices: ["Monsieur le président", "Madame la présidente", "Monsieur le ministre", "Madame la ministre", "Monsieur le recteur", "Madame la rectrice", "Monsieur le directeur général", "Madame la directrice générale", "Monsieur le directeur", "Madame la directrice"] }),
      t("Signature", "Signature", { type: "Choice", choices: ["Le président", "La présidente", "Le directeur général", "La directrice générale", "Le directeur", "La directrice"] }),
    ],
  },

  // Le répertoire des personnes. Une même personne peut être mise en cause dans
  // une affaire, témoin dans une autre, et réapparaître sous les deux régimes :
  // elle est décrite une seule fois, ici.
  Personnes: {
    label: "Personnes",
    singular: "personne",
    icon: "user-line",
    display: "Nom_complet",
    columns: [
      t("Type", "Type", { type: "Choice", choices: TYPES_PERSONNE, desc: "Usager (étudiant, candidat), personnel de l'établissement (enseignant, agent) ou tiers (avocat, accompagnant, interprète)." }),
      t("Prenom", "Prénom"),
      t("Nom", "Nom"),
      t("Genre", "Genre", { type: "Choice", choices: GENRES }),
      t("Date_de_naissance", "Date de naissance", { type: "Date" }),
      t("Email", "Courriel"),
      t("Telephone", "Téléphone"),
      t("Adresse", "Adresse", { type: "LongText" }),
      t("INE", "INE", { desc: "Numéro d'identification de l'étudiant. Propre aux usagers." }),
      t("Formation_suivie", "Formation suivie", { desc: "Diplôme ou formation préparés, au moment des faits." }),
      t("Composante", "Composante", { desc: "Facultatif. Composante, faculté ou école de rattachement — à renseigner seulement si l'établissement souhaite suivre l'origine des personnes. Laisser vide sinon." }),
      t("Corps", "Corps", { type: "Choice", choices: CORPS, desc: "Corps d'appartenance, pour un personnel." }),
      t("Section_CNU", "Section CNU", { desc: "Section du Conseil national des universités, par exemple 27e (informatique)." }),
      t("Etablissement", "Établissement d'affectation", { desc: "Établissement employeur, lorsqu'il diffère de celui qui instruit." }),
      t("Qualite", "Qualité", { desc: "Qualité du tiers : avocat d'un étudiant, accompagnant, interprète, etc." }),
      t("Organisme", "Organisme", { desc: "Organisme du tiers, s'il y a lieu." }),
      t("Notes", "Notes", { type: "LongText", desc: "Observations libres, utiles pour éviter une seconde saisie." }),
      t("Nom_complet", "Nom complet", ro),
      t("Formule", "Formule", ro),
      t("Mme_Mr", "Mme_Mr", ro),
      t("Est_usager", "Usager", { type: "Bool", ...ro }),
      t("Est_personnel", "Personnel", { type: "Bool", ...ro }),
    ],
  },

  Affaires: {
    label: "Affaires",
    singular: "affaire",
    icon: "folder-2-line",
    display: "Recherche",
    columns: [
      t("Numero", "Numéro", { desc: "Le numéro de l'affaire. Ce dernier est généré automatiquement à la création, puis reste modifiable." }),
      t("Date_de_saisine", "Date de saisine", { type: "Date", desc: "La date à laquelle la section a été saisie." }),
      t("Date_des_faits", "Date des faits", { type: "Date", desc: "Date, ou date de fin, des faits reprochés." }),
      t("Date_de_connaissance_des_faits", "Date de connaissance des faits", { type: "Date", desc: "Date à laquelle l'administration a eu une connaissance effective des faits. C'est le point de départ de la prescription de l'action disciplinaire pour un personnel (code général de la fonction publique, art. L. 532-2). Les poursuites à l'égard d'un usager ne sont pas soumises à prescription." }),
      t("Etat", "État", { type: "Choice", choices: ETATS, desc: "L'état actuel de l'affaire." }),
      t("Section", "Section", { type: "Ref:Sections_disciplinaires", desc: "La section disciplinaire chargée de traiter cette affaire." }),
      t("Voie", "Voie de traitement", { type: "Choice", choices: VOIES, desc: "Procédure devant la section (avec instruction), ou procédure de l'article R.811-40 : une alternative à l'instruction, sans phase d'instruction." }),
      t("Mis_en_cause", "Personne mise en cause", { type: "Ref:Personnes", desc: "La personne à qui les faits sont reprochés. Les autres personnes du dossier se déclarent dans l'onglet « Personnes »." }),
      t("Motifs", "Motifs retenus", { type: "RefList:Motifs", desc: "Motifs retenus, choisis dans le catalogue « Motifs »." }),
      t("Motif", "Exposé des faits", { type: "LongText", desc: "Description libre des faits, reprise dans les courriers." }),
      t("Autorite_de_saisine", "Autorité de saisine", { type: "Ref:Destinataires_institutionnels", desc: "L'autorité qui a saisi la section : présidence, recteur, direction." }),
      // Le rapport d'instruction **n'est pas un champ de l'affaire** : c'est une
      // pièce, produite comme un document (format « Rapport d'instruction »,
      // trame livrée de ce format) — voir `trames-defaut.js` et
      // `reprendreRapport` dans app.js. Les deux colonnes d'origine sont
      // conservées pour ne rien perdre d'un document qui les porte encore, mais
      // elles ne sont ni proposées, ni créées (`ancien: true`) : `Rapport_d_instruction`
      // reste lu le temps de la reprise de son texte.
      t("Date_du_rapport_d_instruction", "Date du rapport d'instruction (ancien)", {
        type: "Date", ancien: true,
        desc: "Ancien champ. La date du rapport est désormais celle du **document** qui le porte ; cette colonne n'est plus proposée à la saisie.",
      }),
      t("Rapport_d_instruction", "Rapport d'instruction (ancien)", {
        type: "LongText", ancien: true,
        desc: "Ancien champ. Le rapport d'instruction est désormais une **pièce** : il se produit comme un document, à partir de la trame « Rapport d'instruction ». Le texte saisi ici autrefois reste dans le document ; la fiche de l'affaire propose de le reprendre dans un document.",
      }),
      t("Date_de_convocation", "Date de convocation", { type: "Date", desc: "Date d'envoi ou de remise de la convocation. Sert au contrôle du délai minimal avant la séance." }),
      t("Mode_de_convocation", "Mode de convocation", { type: "Choice", choices: MODES_CONVOCATION }),
      t("Secretaire", "Secrétaire", { type: "Ref:Secretaires", desc: "Le secrétaire chargé de suivre cette affaire." }),
      t("Seance_d_examen", "Séance", { type: "Ref:Seances_d_examen", desc: "Séance à laquelle l'affaire est inscrite. Les séances sont à paramétrer dans la vue dédiée." }),
      t("Ordre_de_passage", "Ordre de passage", { type: "Int", desc: "Ordre de passage dans le rôle de la séance. Trie le rôle avant l'heure de passage." }),
      t("SE_Heure_de_passage", "Heure de passage", { desc: "Horaire de passage, à renseigner au format HH:MM." }),
      t("Composante", "Composante", { desc: "Facultatif. Composante, faculté ou école de rattachement de l'affaire — utile seulement si l'établissement souhaite suivre l'origine des mis en cause. Laisser vide sinon." }),
      t("Lien_vers_le_dossier", "Lien vers le dossier", { type: "Link", desc: "L'adresse du dossier de pièces, tenu **hors de l'outil** (bureau numérique, espace de partage, fichiers.gouv.fr…). L'outil n'en conserve que ce lien : « Ouvrir le dossier » figure dans le bandeau de l'affaire, sur tous ses onglets, et dans le rôle de la séance." }),
      // Colonnes calculées de la **jonction d'affaires** : plusieurs affaires,
      // chacune avec son numéro, jugées par une même décision. Elles ne se
      // saisissent pas : la jonction se règle depuis `Jonctions`, dans l'onglet
      // « Décision » de l'affaire (voir `jonctionDe` dans `formulas.js`).
      t("Jonction", "Jonction", {
        type: "Ref:Jonctions",
        ...ro,
        desc: "La jonction à laquelle cette affaire appartient, qu'elle en soit l'affaire de tête ou une affaire jointe. Vide lorsqu'elle est jugée seule.",
      }),
      t("Affaire_de_tete", "Affaire de tête", {
        type: "Ref:Affaires",
        ...ro,
        desc: "L'affaire qui porte la décision commune, lorsqu'une autre affaire est jointe à la présente. Vide pour l'affaire de tête elle-même.",
      }),
      t("Affaires_jointes", "Numéros des affaires jointes", {
        ...ro,
        desc: "Les numéros de toutes les affaires du groupe, affaire de tête comprise — ce que cite une décision rendue pour plusieurs affaires.",
      }),
      t("Mises_en_cause_jointes", "Autres mis en cause (affaires jointes)", {
        ...ro,
        desc: "Les personnes mises en cause par les autres affaires du groupe, avec leur numéro d'affaire. Une décision commune les nomme toutes.",
      }),
      // Colonnes calculées reprenant l'identité de la personne mise en cause.
      // Leurs identifiants sont ceux du document d'origine : les balises
      // `{{Affaire}}.INE`, `{{Affaire}}.Adresse`… posées dans les trames
      // continuent donc de fonctionner, alors que la donnée vit désormais dans
      // `Personnes` (voir `formulas.js`).
      t("Prenom_du_mis_en_cause", "Prénom du mis en cause", ro),
      t("Nom_du_mis_en_cause", "Nom du mis en cause", ro),
      t("Nom_complet", "Nom complet", ro),
      t("Formule", "Formule", ro),
      t("Genre", "Genre", ro),
      t("Date_de_naissance", "Date de naissance", ro),
      t("Adresse", "Adresse", ro),
      t("INE", "INE", ro),
      t("Formation_suivie", "Formation suivie", ro),
      t("Corps", "Corps", ro),
      t("Section_Public", "Régime de la section", ro),
      t("Prescription_le", "Prescription", ro),
      t("Prescrit", "Prescrit ?", { type: "Bool", ...ro }),
      t("Commission", "Commission", ro),
      t("C_President", "C_Président", ro),
      t("C_Formule", "C_Formule", ro),
      t("C_Qualite", "C_Qualité", ro),
      t("Rapporteur", "Rapporteur", ro),
      t("Rapporteur_adjoint", "Rapporteur adjoint", ro),
      t("Rapporteur_hors_section", "Rapporteur hors section", { type: "Bool", ...ro }),
      // La composition de l'instruction : le rapporteur et, selon la
      // procédure, son adjoint (usagers) ou le second membre de la commission
      // d'instruction (enseignants-chercheurs). C'est elle que nomme le
      // rapport d'instruction, dans son en-tête comme dans sa signature.
      t("Composition_de_l_instruction", "Composition de l'instruction", ro),
      t("Formation", "Formation", ro),
      t("President_de_la_formation", "Président de la formation", ro),
      t("SE_Date", "Date de la séance", ro),
      t("SE_Salle", "Salle", ro),
      t("SE_Adresse", "Adresse de la séance", ro),
      t("SE_Visio", "SE_Visio", ro),
      t("SE_Date_et_heure", "SE_Date et heure", ro),
      t("Heure_de_passage_minutes", "Heure de passage (minutes)", { type: "Int", ...ro }),
      t("Delai_de_convocation", "Délai de convocation", { type: "Int", ...ro, desc: "Nombre de jours entre la convocation et la séance." }),
      t("Duree_instruction", "Durée d'instruction", { type: "Int", ...ro, desc: "Nombre de jours écoulés depuis la saisine, ou entre la saisine et la clôture." }),
      // Échéance d'instruction. Elle se déduit : de la **date butoir
      // d'instruction** que porte une pièce de l'affaire — un document relatif
      // à l'instruction, ou une décision avant dire droit qui reporte le terme
      // —, qui **prime** sur le délai de la procédure ; à défaut, de ce délai
      // même — deux mois devant les sections d'usagers, quatre mois devant
      // celles d'enseignants-chercheurs —, **décompté depuis la décision de
      // désignation** des rapporteurs ou de la commission d'instruction (voir
      // `butoirInstruction`, formulas.js). Rien ne se saisit ici.
      t("Date_butoir_instruction", "Instruction à clore le", {
        type: "Date", ...ro,
        desc: "Date butoir de l'instruction, en vigueur : celle que porte un document relatif à l'instruction ou une décision avant dire droit — elle prime, qu'elle avance ou recule le terme —, et à défaut l'échéance de la procédure décomptée depuis la décision de désignation. Vide devant une section qui n'instruit pas (voie de l'article R.811-40), une fois l'affaire jugée, et tant que ni la désignation ni aucune pièce n'a fixé de terme.",
      }),
      t("Date_butoir_instruction_initiale", "Échéance initiale de l'instruction", {
        type: "Date", ...ro,
        desc: "Le délai de la procédure seul, avant toute date butoir portée par un acte. La comparaison avec « Instruction à clore le » dit si le terme a été fixé — ou reporté — par une pièce.",
      }),
      t("Instruction_prolongee", "Instruction prolongée ?", {
        type: "Bool", ...ro,
        desc: "Vrai lorsque l'instruction a été prolongée au-delà du délai de la procédure, par un document relatif à l'instruction ou par une décision ultérieure.",
      }),
      t("Jours_restants_instruction", "Jours avant le terme de l'instruction", {
        type: "Int", ...ro,
        desc: "Nombre de jours restants avant la date butoir de l'instruction. Négatif lorsque l'échéance est passée.",
      }),
      t("Section_Secretaires_Email", "Section_Secrétaires_Email", ro),
      t("Recherche", "Recherche", ro),
    ],
  },

  // Jonction d'affaires — plusieurs affaires, chacune gardant son numéro, jugées
  // par une **même décision**. La jonction ne fusionne rien et ne supprime rien :
  // elle fait juger ensemble, et se défait à tout moment.
  //
  // Une affaire n'appartient qu'à une seule jonction. L'**affaire de tête** est
  // celle qui porte la décision commune : c'est elle que désignent les décisions
  // et les recours, et dont le numéro identifie l'affaire dans le registre. Les
  // autres affaires lisent la décision par leurs colonnes calculées.
  //
  // Les deux colonnes qui portent la relation (`Affaire_de_tete`,
  // `Affaires_jointes`) sont les seules à saisir : tout le reste s'en déduit
  // (voir `jonctionDe`, `affairesDeJonction` dans `formulas.js`).
  Jonctions: {
    label: "Jonctions",
    singular: "jonction",
    icon: "links-line",
    display: "Libelle",
    parent: { table: "Affaires", column: "Affaire_de_tete" },
    columns: [
      t("Affaire_de_tete", "Affaire de tête", {
        type: "Ref:Affaires",
        desc: "L'affaire qui porte la décision commune aux affaires jointes. C'est son numéro qui identifie l'ensemble dans le registre des décisions.",
      }),
      t("Affaires_jointes", "Affaires jointes", {
        type: "RefList:Affaires",
        desc: "Les affaires jugées avec l'affaire de tête. Chacune conserve son numéro, sa personne mise en cause et ses propres documents : la jonction les fait juger ensemble, elle ne les confond pas.",
      }),
      t("Date_de_la_jonction", "Date de la jonction", {
        type: "Date",
        desc: "Date à laquelle la jonction a été décidée.",
      }),
      t("Motif", "Motif de la jonction", {
        type: "LongText",
        desc: "Pourquoi ces affaires sont jointes : mêmes faits, même fraude, mis en cause multiples d'une même épreuve…",
      }),
      t("Observations", "Observations", { type: "LongText" }),
      t("Libelle", "Libellé", ro),
      t("Nb_affaires", "Nombre d'affaires", { type: "Int", ...ro }),
      t("Personnes_mises_en_cause", "Personnes mises en cause", ro),
      t("Decision", "Décision commune", {
        type: "Ref:Decisions",
        ...ro,
        desc: "Décision définitive de l'affaire de tête — celle que rendent, ensemble, les affaires jointes.",
      }),
    ],
  },

  // Qui instruit et qui juge. Une seule table pour les deux régimes : un
  // président de commission pour les usagers, un rapporteur pris hors de la
  // section pour les enseignants-chercheurs.
  Intervenants: {
    label: "Formation et intervenants",
    singular: "intervenant",
    icon: "group-line",
    display: "Nom_complet",
    parent: { table: "Affaires", column: "Affaire" },
    columns: [
      t("Affaire", "Affaire", { type: "Ref:Affaires" }),
      t("Role", "Rôle", { type: "Choice", choices: ROLES_INTERVENANT, desc: "Le président conduit la formation, le rapporteur instruit le dossier et présente les faits." }),
      t("Qualite", "Qualité", { type: "Choice", choices: QUALITES_INTERVENANT, desc: "« Hors section » désigne un personnel de l'établissement qui n'est pas membre élu de la section — un enseignant-chercheur chargé du rapport, par exemple. Elle suit la source choisie dans la composition de l'affaire (invariant 29) : une fiche de membre fait un intervenant de la section, l'absence de fiche un intervenant hors section, dont le nom s'écrit librement." }),
      t("Membre", "Membre de la section", { type: "Ref:Membres", desc: "À renseigner lorsqu'il s'agit d'un membre de la section. Laissez vide pour un intervenant extérieur." }),
      t("Personne", "Personne extérieure", { type: "Ref:Personnes", desc: "Une personne du répertoire rattachée à l'intervenant. La composition d'une affaire ne propose que des membres de la section (invariant 29) : renseignée avant cette règle, la colonne reste lue et affichée, mais l'intervenant extérieur se saisit désormais librement." }),
      t("Nom_libre", "Nom (saisie libre)", { desc: "Utilisé à défaut de membre ou de personne enregistrée." }),
      t("Statut", "Statut", { type: "Choice", choices: STATUTS_INTERVENANT, desc: "Présence et empêchements. Un membre récusé ou déporté est compté comme absent dans les contrôles." }),
      t("Date_de_designation", "Date de désignation", { type: "Date", desc: "Date à laquelle l'intervenant a été désigné. Pour le rapporteur — et, devant une section d'enseignants-chercheurs, le second membre de la commission d'instruction —, c'est elle qui tient lieu de point de départ du délai d'instruction tant que la décision de désignation n'a pas été produite comme document." }),
      t("Remplace", "Remplace", { type: "Ref:Intervenants", desc: "Renseigné lorsqu'un membre supplée un autre, empêché." }),
      t("Observations", "Observations", { type: "LongText" }),
      t("Nom_complet", "Nom complet", ro),
      t("Email", "Courriel", ro),
      t("Formule", "Formule", ro),
      t("College", "Collège", ro),
      t("Membre_Genre", "Membre_Genre", ro),
      t("Membre_Qualite", "Membre_Qualité", ro),
      t("Est_present", "Présent", { type: "Bool", ...ro }),
      t("Hors_section", "Hors section", { type: "Bool", ...ro }),
    ],
  },

  // Les autres personnes du dossier. Le mis en cause principal est porté par
  // `Affaires.Mis_en_cause` : il ne se saisit donc pas ici.
  Implications: {
    label: "Personnes du dossier",
    singular: "personne du dossier",
    icon: "team-line",
    display: "Nom_complet",
    parent: { table: "Affaires", column: "Affaire" },
    columns: [
      t("Affaire", "Affaire", { type: "Ref:Affaires" }),
      t("Personne", "Personne", { type: "Ref:Personnes", desc: "La personne concernée. Créez-la au préalable dans « Réglages › Personnes » ou depuis l'onglet « Personnes » de l'affaire." }),
      t("Role", "Rôle dans le dossier", { type: "Choice", choices: ROLES_IMPLICATION }),
      t("Informe_le", "Informée le", { type: "Date", desc: "Date à laquelle la personne a été informée de la procédure." }),
      t("Auditionne_le", "Auditionnée le", { type: "Date" }),
      t("Observations", "Observations", { type: "LongText" }),
      t("Nom_complet", "Nom complet", ro),
      t("Formule", "Formule", ro),
      t("Est_mis_en_cause", "Mis en cause", { type: "Bool", ...ro }),
    ],
  },

  Seances_d_examen: {
    label: "Séances",
    singular: "séance",
    icon: "calendar-line",
    display: "Identifiant",
    columns: [
      t("Section", "Section", { type: "Ref:Sections_disciplinaires" }),
      t("Type", "Type de réunion", { type: "Choice", choices: TYPES_SEANCE, desc: "Séance d'examen, réunion d'instruction, audition ou entretien disciplinaire (R.811-40)." }),
      t("Date", "Date", { type: "Date" }),
      t("Salle", "Salle"),
      t("Adresse", "Adresse", { type: "LongText" }),
      t("Lien_visio", "Lien visio", { type: "Link" }),
      t("Identifiant", "Identifiant", ro),
      t("Libelle", "Libellé", ro),
      t("Affaires_du_role", "Affaires inscrites", ro),
    ],
  },

  Decisions: {
    label: "Décisions",
    singular: "décision",
    icon: "scales-3-line",
    display: "Affaire",
    parent: { table: "Affaires", column: "Affaire" },
    columns: [
      t("Affaire", "Affaire", { type: "Ref:Affaires" }),
      t("Nature", "Nature", { type: "Choice", choices: NATURES_DECISION, desc: "Une sanction, une issue de procédure (abandon des poursuites, classement) ou une décision interlocutoire. Seule une sanction ou l'abandon des poursuites ouvre une voie de recours ; les indicateurs s'y appuient pour ne pas les confondre." }),
      t("Sanction", "Sanction prononcée", { type: "Ref:Sanctions", desc: "Choisie dans le catalogue, qui porte le groupe de sanction et la durée maximale." }),
      t("Decision", "Texte retenu", { type: "Choice", choices: DECISIONS, desc: "Libellé de la décision. Utilisé seul pour les issues de procédure ; complété par la sanction du catalogue sinon." }),
      t("Motivation", "Motivation", { type: "LongText", desc: "Motifs retenus par la formation, repris dans la décision notifiée." }),
      t("Date_du_delibere", "Date du délibéré", { type: "Date" }),
      t("Date_de_notification", "Date de notification", { type: "Date", desc: "Date d'effet de la décision." }),
      t("Mode_de_notification", "Mode de notification", { type: "Choice", choices: MODES_CONVOCATION }),
      t("Date_de_l_accuse_reception", "Accusé de réception", { type: "Date", desc: "Date de l'accusé de réception. Son absence, lorsqu'une notification recommandée est choisie, est signalée par les contrôles de régularité." }),
      // Registre des actes (NC-0020) : chaque décision reçoit un numéro
      // chronologique, séquence par section et par année (par exemple
      // « UDA-2026-001 »). Il s'attribue par le bouton « Numéroter les actes »,
      // et la numérotation n'est jamais réutilisée.
      t("Numero_acte", "Numéro d'acte", {
        desc: "Numéro de l'acte dans le registre des délibérations de la section, séquence par section et par année (par exemple « UDA-2026-001 »). Il s'attribue par le bouton « Numéroter les actes », à la décision comme au registre de la page Décisions : ne le modifiez pas à la main, la séquence en dépendrait.",
      }),
      // La décision qui règle la marche de l'instance — un report, un
      // supplément d'instruction — peut fixer le terme de l'instruction :
      // c'est cette date qui vaut alors pour l'affaire, de préférence à
      // l'échéance calculée de la procédure (voir `butoirInstruction`,
      // formulas.js).
      t("Date_butoir_instruction", "Date butoir d'instruction", {
        type: "Date",
        desc: "Le terme que cette décision fixe à l'instruction : il prime sur l'échéance de la procédure, et l'emporte sur toute date butoir antérieure. Sans objet pour une décision qui tranche le fond, qui achève l'instruction.",
      }),
      t("Duree_totale_d_exclusion_mois_", "Durée totale d'exclusion (mois)", { type: "Numeric", desc: "Durée en mois, soit 1 = un mois. Il est possible d'utiliser des fractions. Un jour = 0,05." }),
      t("Duree_d_exclusion_sursis_", "Durée d'exclusion (sursis)", { type: "Numeric", desc: "Durée en mois, soit 1 = un mois. Il est possible d'utiliser des fractions. Un jour = 0,05." }),
      t("Sursis_", "Sursis ?", { type: "Bool" }),
      t("Terme_de_la_sanction", "Terme de la sanction", { ...ro, desc: "Terme à trois ans pour le blâme et l'avertissement. Pour les exclusions temporaires, le sursis est déduit du total. Pour les exclusions définitives, le terme est en 9999." }),
      t("Libelle_decision", "Décision notifiée", ro),
      t("Sursis_partiel", "Sursis partiel", { type: "Bool", ...ro }),
      t("Date_d_effet", "Date d'effet", ro),
      t("Recours_limite_le", "Recours possible jusqu'au", { ...ro, desc: "Délai de deux mois à compter de la notification. Vide lorsqu'aucun recours n'est ouvert : une décision interlocutoire, un classement ou une relaxe ne se contestent pas." }),
      t("Nb_recours", "Recours formés", { type: "Int", ...ro }),
      t("Affaire_INE", "Affaire_INE", ro),
      t("Affaire_Composante", "Composante", ro),
      t("Date_de_saisine", "Date de saisine", ro),
      t("En_cours_", "En cours ?", { type: "Bool", ...ro }),
      t("Delai_de_traitement", "Délai de traitement", ro),
    ],
  },

  Recours: {
    label: "Recours",
    singular: "recours",
    icon: "scales-3-line",
    display: "Libelle",
    parent: { table: "Affaires", column: "Affaire" },
    columns: [
      t("Affaire", "Affaire", { type: "Ref:Affaires" }),
      t("Decision", "Décision contestée", { type: "Ref:Decisions", desc: "La décision déférée. Seule une décision prononçant une sanction ou l'abandon des poursuites peut l'être." }),
      t("Juridiction", "Juridiction", { type: "Choice", choices: JURIDICTIONS }),
      t("Type_de_recours", "Type de recours", { type: "Choice", choices: TYPES_RECOURS }),
      t("Date_d_introduction", "Date d'introduction", { type: "Date" }),
      t("Issue", "Issue", { type: "Choice", choices: ISSUES_RECOURS }),
      t("Observations", "Observations", { type: "LongText" }),
      t("Libelle", "Libellé", ro),
      t("Affaire_Numero", "Numéro d'affaire", ro),
      t("En_cours_", "En cours ?", { type: "Bool", ...ro }),
    ],
  },

  Trames: {
    label: "Trames",
    singular: "trame",
    icon: "file-text-line",
    display: "Nom_complet",
    columns: [
      t("Nom", "Nom"),
      t("Type", "Format", {
        type: "Ref:Types_Trames",
        desc: "Le format du document et sa feuille de style : un courrier, une attestation, un rapport "
          + "d'instruction, une ordonnance (du président de la section disciplinaire, ou de celui de la "
          + "formation de jugement) ou une décision de la formation de jugement. C'est le type qui porte "
          + "l'en-tête, la signature et le pied de page communs à ses trames.",
      }),
      t("Auteur", "Auteur", {
        type: "Choice",
        choices: AUTEURS_TRAME,
        desc: "Qui rédige et signe le document. Programmé ici, il n'est plus demandé à la rédaction : la "
          + "signature et le bloc « émetteur » en découlent. Le président de la section y est remplacé par "
          + "son vice-président lorsqu'il est empêché.",
      }),
      t("Destinataire", "Destinataire", {
        type: "Choice",
        choices: DESTINATAIRES_TRAME,
        desc: "À qui le courrier ou l'attestation est adressé (sans objet pour une décision). Programmé ici, "
          + "il n'est plus demandé à la rédaction : le bloc « destinataire » de l'en-tête en découle. Les "
          + "personnes — mis en cause, victime, témoin — sont prises dans l'affaire ; les destinataires "
          + "institutionnels dans les fiches de la section.",
      }),
      t("Objet", "Objet"),
      t("Public", "Régime", {
        type: "Choice",
        choices: ["Les deux", ...REGIMES],
        desc: "Régime auquel la trame s'applique. « Les deux » lorsqu'elle vaut pour les usagers comme pour "
          + "les enseignants-chercheurs — leurs procédures ne diffèrent que par les articles cités.",
      }),
      t("Tutelle", "Tutelle", {
        type: "Choice",
        choices: TUTELLE_TRAME,
        desc: "Tutelle à laquelle la trame s'applique. « Toutes » par défaut ; « Agriculture » pour une trame "
          + "qui cite le code rural et de la pêche maritime, « Enseignement supérieur » pour son équivalent "
          + "fondé sur le seul code de l'éducation.",
      }),
      t("Type_de_section", "Type de section", {
        type: "Choice",
        choices: [TOUTES, ...TYPES_SECTION],
        desc: "Type de section auquel la trame est réservée — par exemple la section disciplinaire "
          + "académique, qui siège elle-même. « Toutes » par défaut.",
      }),
      t("Decision_definitive", "Décision définitive", {
        type: "Bool",
        desc: "La trame porte la décision définitive de l'affaire : les champs de décision y sont ceux de "
          + "l'affaire elle-même, et une affaire ne peut en comporter qu'une.",
      }),
      t("Concerne_l_instruction", "Concerne l'instruction", {
        type: "Bool",
        desc: "Le document touche à l'instruction de l'affaire : le rapport, la désignation des "
          + "rapporteurs, un complément ou un supplément d'instruction. La date butoir d'instruction du "
          + "document est alors mise en avant à sa rédaction, et **prime sur l'échéance de la "
          + "procédure** : c'est elle qui fixe le terme de l'instruction, avec les décisions avant dire "
          + "droit qui le reportent.",
      }),
      t("Ouvre_l_instruction", "Ouvre l'instruction", {
        type: "Bool",
        desc: "La trame porte l'**acte de désignation** qui ouvre l'instruction — la désignation des "
          + "rapporteurs, ou celle de la commission d'instruction. C'est la date du document produit avec "
          + "cette trame qui fait courir le délai d'instruction : l'instruction commence à la désignation, "
          + "et non à la saisine (voir `butoirInstruction`, formulas.js).",
      }),
      t("Template_contenu", "Template_contenu", { type: "LongText" }),
      t("Template_brut", "Template_brut", { type: "LongText", desc: "Contenu Quill (Delta JSON) de la trame." }),
      t("Feuille_de_style", "Feuille de style", {
        type: "LongText",
        desc: "Feuille de style **adaptée à cette trame**. Vide, la trame hérite de celle de son format — "
          + "c'est le cas ordinaire. Dès que l'auteur modifie l'en-tête, le chapeau, la signature ou le pied "
          + "de page dans l'espace de rédaction de la trame, l'adaptation est enregistrée ici, et seule cette "
          + "trame en dépend (le bouton « Rétablir la feuille du format » la remet à vide). L'emplacement du "
          + "texte de la trame y est marqué par la balise {{Corps}}.",
      }),
      t("Type_court_", "Type (court)", ro),
      t("Nom_complet", "Nom complet", ro),
    ],
  },

  Types_Trames: {
    label: "Types de trames",
    singular: "type de trame",
    icon: "stack-line",
    display: "Nom",
    columns: [
      t("Nom", "Nom"),
      t("Categorie", "Format", {
        type: "Choice",
        choices: FORMATS_DOCUMENT,
        desc: "Le format du document, c'est-à-dire sa feuille de style : un **courrier**, une **attestation**, un "
          + "**rapport d'instruction**, une **ordonnance** de président, ou une **décision** de la formation de "
          + "jugement. Chaque format a sa propre feuille de style — mentions, en-tête et signatures différentes : "
          + "un rapport ne s'adresse pas comme un courrier, et ne se signe pas comme un acte rendu.",
      }),
      t("Organe", "Organe qui décide", {
        type: "Choice",
        choices: ORGANES_DECISION,
        desc: "Pour une ordonnance ou une décision seulement. « Président de la section disciplinaire » — la section "
          + "est l'organe qui juge (organe administratif pour les usagers, juridiction pour les "
          + "enseignants-chercheurs) : **son ordonnance** règle la constitution de la formation et la marche de "
          + "l'instance, et elle est nécessairement **avant dire droit**. « Président de la formation de "
          + "jugement » — le président de la commission de discipline, qui ne porte ce nom que devant les "
          + "usagers : **son ordonnance** est elle aussi nécessairement avant dire droit. « Formation de "
          + "jugement » — la chambre réunie : **sa décision** peut être avant dire droit comme définitive, c'est "
          + "elle qui tranche le fond. L'auteur de l'acte se règle sur chaque trame.",
      }),
      t("Feuille_de_style", "Feuille de style", {
        type: "LongText",
        desc: "**Le document entier du format**, d'un seul tenant : l'en-tête (l'identité de la section et "
          + "le destinataire), le chapeau, puis — à l'endroit marqué par {{Corps}} — le texte propre à chaque "
          + "trame, et enfin la signature et le pied de page répété. Les variables y sont écrites entre "
          + "accolades : {ville}, {date_formatee}, {destinataire}, {f_emetteur}, {nom_emetteur}… Une trame "
          + "hérite de cette feuille de style ; elle peut l'adapter (voir `Trames.Feuille_de_style`).",
      }),
      // Ancien découpage d'un format en trois blocs, cousus en une feuille de
      // style unique par la reprise (`migrerFeuilles`). Colonnes **lues** d'un
      // document antérieur — c'est d'elles que vient la feuille de style de
      // l'établissement — mais jamais créées ni écrites (voir `ancien` dans
      // `grist-backend.js`).
      t("En_tete", "En-tête (ancien)", { type: "LongText", ancien: true }),
      t("Signature", "Signature (ancien)", { type: "LongText", ancien: true }),
      t("Pied_de_page", "Pied de page (ancien)", { type: "LongText", ancien: true }),
      t("Numeroter_pages", "Numéroter les pages", {
        type: "Bool",
        desc: "Ajoute « Page 3 sur 3 » au bas de **chaque** page des documents de ce type — mesure prise "
          + "avant l'impression, et reprise dans le PDF, le fichier Word et l'OpenDocument. Le pied de page "
          + "du type est répété au bas de chaque page ; le numéro se place avec la variable {page} et le "
          + "nombre de pages avec {pages} (voir la palette des variables).",
      }),
      t("Numero_affaire_pied", "Numéro de l'affaire au pied de page", {
        type: "Bool",
        desc: "Ajoute « Dossier n° … » au bas de **chaque** page des documents de ce type, à gauche de la "
          + "numérotation — c'est le numéro de l'affaire du document. Le pied de page reste celui de la "
          + "feuille de style : la ligne du numéro de l'affaire et celle de la pagination se placent sur la "
          + "même ligne, l'une à gauche, l'autre à droite. Utile quand un document se détache de son dossier "
          + "— un rapport, une décision notifiée, une pièce adressée à un tiers.",
      }),
      // L'en-tête du document — le bloc-marque de l'État et le logo de
      // l'établissement — est posé par l'outil au-dessus de la feuille de style
      // (voir `enteteHtml`, render.js) : les images viennent de la section, leur
      // **mise en page** se règle ici, par format. Le réglage vaut pour le
      // format et toutes ses trames ; une valeur vide reproduit exactement la
      // charte (bloc-marque à gauche, logo à droite, aux cotes officielles).
      t("Marianne_position", "Position du bloc-marque", {
        type: "Choice", choices: POSITIONS_LOGO,
        desc: "Zone de l'en-tête où se tient le bloc-marque — à gauche par défaut. « Centre » et « Droite » le "
          + "déplacent dans la largeur ; la hauteur suit la ligne de l'en-tête.",
      }),
      t("Marianne_largeur", "Largeur du bloc-marque (mm)", {
        type: "Numeric",
        desc: "Largeur en millimètres. Vide, le bloc-marque garde sa cote de la charte (27,4 mm de large). "
          + "Une hauteur seule le met à l'échelle en conservant ses proportions ; les deux renseignées fixent "
          + "exactement le cadre.",
      }),
      t("Marianne_hauteur", "Hauteur du bloc-marque (mm)", {
        type: "Numeric",
        desc: "Hauteur en millimètres. Vide, elle suit la largeur (proportions conservées).",
      }),
      t("Logo_position", "Position du logo", {
        type: "Choice", choices: POSITIONS_LOGO,
        desc: "Zone de l'en-tête où se tient le logo de l'établissement — à droite par défaut, en regard du "
          + "bloc-marque. Deux logos dans la même zone s'y placent côte à côte.",
      }),
      t("Logo_largeur", "Largeur du logo (mm)", {
        type: "Numeric",
        desc: "Largeur en millimètres. Vide, le logo est borné à la zone de logotype de la charte (53 mm de "
          + "large, 26 mm de haut) sans jamais déformer l'image. Une hauteur seule le met à l'échelle en "
          + "conservant ses proportions ; les deux renseignées fixent exactement le cadre.",
      }),
      t("Logo_hauteur", "Hauteur du logo (mm)", {
        type: "Numeric",
        desc: "Hauteur en millimètres. Vide, elle suit la largeur (proportions conservées).",
      }),
    ],
  },

  Generateur: {
    label: "Documents",
    singular: "document",
    icon: "printer-line",
    display: "Template",
    parent: { table: "Affaires", column: "Affaire" },
    columns: [
      t("Affaire", "Affaire", { type: "Ref:Affaires" }),
      t("Template", "Document", { type: "Ref:Trames", desc: "Choix du type de document. Les documents spécifiques au type de section (usager ou enseignant-chercheur) sont filtrés automatiquement." }),
      t("Contenu", "Contenu", {
        type: "LongText",
        desc: "Le texte du document, rédigé pour cette affaire. Vide, le document suit la trame ; "
          + "dès qu'il est rempli, il remplace le corps de la trame, sans perdre le lien avec elle.",
      }),
      // L'adaptation de la feuille de style **propre à cette pièce** : l'espace
      // de rédaction montre le document d'une seule feuille — en-tête, chapeau,
      // texte, signature — et s'y corriger n'écrit que pour ce document, sans
      // toucher à la trame ni aux autres pièces. Vide, le document suit la
      // trame (voir `feuilleEffectiveDocument`, render.js).
      t("Feuille_de_style", "Feuille de style", {
        type: "LongText",
        desc: "Facultative : l'adaptation de la feuille de style propre à ce document. Vide, la pièce "
          + "suit la feuille de sa trame — elle-même adaptée de son format, ou héritée de lui. L'espace "
          + "de rédaction écrit le document d'un seul tenant : le corriger là n'écrit que pour cette "
          + "pièce (« Revenir à la trame » défait vos corrections). Une feuille enregistrée d'un bout à "
          + "l'autre, sans l'emplacement du texte, est rendue telle quelle.",
      }),
      t("Date", "Date", { type: "Date", desc: "Date de la décision ou du courrier." }),
      t("Statut", "Statut", { type: "Choice", choices: STATUTS_DOCUMENT, desc: "Suivi d'envoi du document." }),
      t("Envoye_le", "Envoyé le", { type: "Date" }),
      t("Mode_d_envoi", "Mode d'envoi", { type: "Choice", choices: MODES_CONVOCATION }),
      t("Destinataire_institutionnel", "Destinataire institutionnel", {
        type: "Ref:Destinataires_institutionnels",
        desc: "Le destinataire du courrier, lorsque la trame en vise un de nature institutionnelle "
          + "(chef d'établissement, autorité de tutelle…). Laissé vide, il est résolu d'après la qualité "
          + "attendue et la section. Les destinataires sont configurés dans Réglages › Destinataires.",
      }),
      t("Personne_destinataire", "Destinataire (personne)", {
        type: "Ref:Personnes",
        desc: "La personne à qui le courrier est adressé, lorsque la trame vise un mis en cause, une victime "
          + "ou un témoin. Laissé vide, c'est la personne de ce rôle dans l'affaire — le mis en cause, ou la "
          + "première victime ou le premier témoin. À préciser lorsqu'une affaire en compte plusieurs.",
      }),
      t("Decision_liee", "Décision concernée", {
        type: "Ref:Decisions",
        desc: "Pour un document de format « Décision » : la décision que le document rédige, prise dans "
          + "l'affaire, et de la même nature que sa trame — celle qui tranche le fond, ou une décision "
          + "avant dire droit. Une affaire peut porter autant de décisions avant dire droit que "
          + "nécessaire ; la décision définitive est celle qui tranche le fond, et une affaire n'en "
          + "comporte qu'une. Les balises {{Decision}} du texte lisent cette décision. Une ordonnance "
          + "n'en rédige aucune : ce champ reste vide.",
      }),
      t("Emetteur", "Emetteur", { type: "Ref:Destinataires_institutionnels", desc: "Ancien réglage de l'émetteur du courrier. L'auteur est désormais programmé sur la trame (colonne « Auteur ») : ce champ n'est plus proposé à la rédaction." }),
      t("Champ_libre", "Champ libre", { type: "LongText", desc: "Certains documents permettent d'intégrer un champ libre." }),
      t("Date_libre", "Date libre", { type: "Date", desc: "Certains documents permettent de compléter une date libre, par exemple une date d'entretien ou de demande." }),
      // L'échéance d'instruction **du document**. C'est par elle qu'un rapport
      // d'instruction, une désignation des rapporteurs ou un complément
      // d'instruction fixe le terme de l'instruction de l'affaire, et c'est par
      // elle qu'une décision ultérieure la **prolonge** (voir
      // `butoirInstruction`, formulas.js). La trame dit si le document concerne
      // l'instruction (`Trames.Concerne_l_instruction`).
      t("Date_butoir_instruction", "Date butoir d'instruction", {
        type: "Date",
        desc: "Le terme que ce document fixe à l'instruction de l'affaire. La plus lointaine des dates portées par les documents d'une affaire est son échéance d'instruction en vigueur — une décision ultérieure peut donc prolonger le délai. Sans objet pour un document étranger à l'instruction.",
      }),
      t("L_Destinataire", "Prénom & nom"),
      t("L_Adresse", "Adresse", { type: "LongText" }),
      t("L_Formule", "Formule de politesse", { desc: "Formule précédant le nom, généralement Monsieur ou Madame." }),
      t("VP", "Vice-Président ?", {
        type: "Bool",
        // Réglage à la pièce : c'est l'absence brève du président, déclarée
        // sur le document qu'on rédige (voir `src/signataire.js`).
        desc: "Le président de la section est absent : le vice-président signe ce document. Décoché, le signataire est celui de la section (Réglages › Sections et membres).",
      }),
      t("Qualite_du_destinataire", "Qualité du destinataire", { type: "Ref:Destinataires_institutionnels" }),
      t("Qualite_de_l_emetteur", "Qualité de l'emetteur", { type: "Ref:Destinataires_institutionnels" }),
      // L'en-tête, le chapeau, la signature et le pied de page ne sont plus des
      // colonnes calculées du document : ils appartiennent à la feuille de
      // style du format (voir `Types_Trames.Feuille_de_style`), ou à
      // l'adaptation que la trame en fait.
      t("Template_rendu", "Template_rendu", { type: "LongText", ...ro }),
      t("Affaire_Section", "Affaire_Section", { type: "Ref:Sections_disciplinaires", ...ro }),
      t("Affaire_Date_de_saisine", "Affaire_Date de saisine", { type: "Date", ...ro }),
      t("Affaire_Date_de_naissance", "Affaire_Date de naissance", { type: "Date", ...ro }),
      t("Affaire_Heure_de_passage", "Affaire_Heure de passage", { ...ro }),
      t("Seance_d_examen", "Séance", { type: "Ref:Seances_d_examen", ...ro }),
      t("Seance_d_examen_Date", "Séance_Date", { type: "Date", ...ro }),
      t("Secretaire", "Secrétaire", { type: "Ref:Secretaires", ...ro }),
      t("Decision", "Décision de l'affaire", {
        type: "Ref:Decisions",
        ...ro,
        desc: "Décision définitive de l'affaire — celle qui tranche le fond, à l'exclusion des décisions "
          + "avant dire droit. Le document d'un format « Décision » lui préfère la décision qui lui est "
          + "rattachée (colonne « Décision concernée ») : {{Decision}}.Motivation lit alors la décision "
          + "rédigée, avant dire droit comprise.",
      }),
      t("Type", "Type", ro),
      t("Public", "Régime", { type: "Choice", choices: REGIMES, ...ro }),
      t("Ville", "Ville", ro),
      t("Formule", "Formule", ro),
      t("Destinataire", "Destinataire", ro),
      t("Destinataire_Adresse", "Destinataire_Adresse", ro),
      t("Emetteur_Signature", "Emetteur_Signature", ro),
    ],
  },

  Sanctions: {
    label: "Sanctions",
    singular: "sanction",
    icon: "scales-3-line",
    display: "Libelle",
    columns: [
      t("Libelle", "Libellé"),
      t("Groupe", "Groupe", { type: "Choice", choices: GROUPES_SANCTION, desc: "Famille de sanction, qui commande le calcul du terme de la sanction (voir Réglages)." }),
      t("Public", "Régime", { type: "Choice", choices: ["Usagers", "Enseignants-chercheurs", "Les deux"], desc: "Régime auquel la sanction s'applique. Les sanctions des usagers sont celles de l'article R.811-13-1 du code de l'éducation (R.811-13-2 pour la fraude à l'inscription dans un établissement privé), celles des enseignants-chercheurs et des personnels enseignants des articles L.952-8 et L.952-9. L'échelle des enseignants commence au blâme : il n'existe pas d'avertissement dans leur procédure." }),
      t("Tutelle", "Tutelle", { type: "Choice", choices: TUTELLE_COURTES, desc: "Tutelle à laquelle la sanction se rattache. « Les deux » lorsqu'elle vaut pour les deux : la procédure des usagers comme celle des enseignants-chercheurs est celle du code de l'éducation, quelle que soit la tutelle de l'établissement." }),
      t("Duree_max_mois", "Durée maximale (mois)", { type: "Numeric", desc: "Durée maximale encourue, en mois. Vide pour une sanction sans durée." }),
      t("Sursis_possible", "Sursis possible", { type: "Bool" }),
      t("Texte_de_reference", "Texte de référence", { desc: "Article ou texte fondant la sanction." }),
    ],
  },

  Motifs: {
    label: "Motifs",
    singular: "motif",
    icon: "bookmark-line",
    display: "Libelle",
    columns: [
      t("Libelle", "Libellé"),
      t("Groupe", "Groupe", { type: "Choice", choices: GROUPES_MOTIF, desc: "Famille de motif, calée sur les items des textes : les cinq manquements de l'article R.811-11 du code de l'éducation, les devoirs des agents publics, et le manquement aux obligations de service." }),
      t("Public", "Régime", { type: "Choice", choices: ["Usagers", "Enseignants-chercheurs", "Les deux"], desc: "Régime auquel le motif s'applique. Les manquements des usagers sont énumérés par les textes ; ceux des enseignants ne le sont pas, et se lisent comme des manquements aux devoirs des agents publics." }),
      t("Tutelle", "Tutelle", { type: "Choice", choices: TUTELLE_COURTES, desc: "Tutelle à laquelle le motif se rattache. Les manquements sont énumérés par le code de l'éducation (R.811-11) et, pour les établissements agricoles, par le code rural et de la pêche maritime (R.812-24-2), dont le 5° ajoute l'atteinte à la réputation de l'établissement." }),
      t("Texte_de_reference", "Texte de référence", { desc: "Article, numéro d'item et texte qui fondent le motif." }),
      t("Description", "Description", { type: "LongText" }),
    ],
  },

  // Les seuils et les durées : dans les données, pas dans le code. Les
  // contrôles de régularité et le calcul du terme des sanctions les lisent par
  // leur clé (`Cle`), jamais par leur libellé.
  Parametres: {
    label: "Paramètres",
    singular: "paramètre",
    icon: "equalizer-line",
    display: "Nom",
    columns: [
      t("Nom", "Nom"),
      t("Cle", "Clé", { desc: "Identifiant technique lu par l'outil : ne le modifiez pas." }),
      t("Categorie", "Catégorie", { type: "Choice", choices: CATEGORIES_PARAMETRE }),
      t("Valeur", "Valeur"),
      t("Description", "Description", { type: "LongText" }),
    ],
  },

  // Registre des opérations : qui a fait quoi. Écrit par l'outil, lu dans
  // « Réglages › Données ». Jamais modifié à la main.
  Journal: {
    label: "Journal",
    singular: "ligne de journal",
    icon: "time-line",
    display: "Resume",
    columns: [
      t("Date", "Date", { desc: "Horodatage de l'opération (ISO)." }),
      t("Action", "Action"),
      t("Table", "Table"),
      t("Table_libelle", "Table (libellé)"),
      t("Enregistrement", "Enregistrement"),
      t("Auteur", "Auteur"),
      t("Resume", "Résumé", { type: "LongText" }),
    ],
  },

  // Ce qui a été supprimé, en attente d'être effacé pour de bon. Une entrée
  // garde **toute** la ligne d'origine — y compris son identifiant —, de sorte
  // que la restauration la remet exacte, et que les documents qui la citent la
  // retrouvent. La corbeille est propre à chaque élément : rien n'y est partagé
  // entre deux utilisateurs, puisque tout vit dans le document (ou dans le
  // navigateur, en mode autonome).
  Corbeille: {
    label: "Corbeille",
    singular: "élément de la corbeille",
    icon: "delete-bin-line",
    display: "Nom",
    columns: [
      t("Nom", "Nom", { desc: "Ce que l'élément s'appelait, pour le reconnaître sans avoir à l'ouvrir." }),
      t("Table", "Table d'origine", { desc: "La table dont l'élément a été retiré (aujourd'hui : « Trames »)." }),
      t("Table_libelle", "Table (libellé)"),
      t("Supprime_le", "Supprimé le", { type: "Date", desc: "Date de la mise à la corbeille. L'élément y reste tant que personne ne le restaure ou ne l'efface." }),
      t("Supprime_par", "Supprimé par", { desc: "La personne qui a mis l'élément à la corbeille, telle que le document la connaît." }),
      t("Contenu", "Contenu", { type: "LongText", desc: "L'élément tel qu'il était : c'est lui qui permet de le rendre intact. Ne le modifiez pas à la main." }),
    ],
  },

  // Table du document d'origine, conservée uniquement pour la reprise : elle
  // est lue (pour ne rien perdre d'un dossier non encore importé) mais jamais
  // écrite, et un document neuf n'a pas besoin de la créer. L'onglet de
  // composition propose de convertir ses lignes en `Intervenants`.
  Commissions: {
    label: "Commissions (origine)",
    singular: "ligne de commission d'origine",
    icon: "archive-line",
    display: "Membre",
    legacy: true,
    parent: { table: "Affaires", column: "Affaire" },
    columns: [
      t("Affaire", "Affaire", { type: "Ref:Affaires" }),
      t("Membre", "Membre", { type: "Ref:Membres" }),
      t("Role", "Rôle", { type: "Choice", choices: ["Président", "Rapporteur", "Rapporteur adjoint", "Membre"] }),
      t("Section", "Section", { type: "Ref:Sections_disciplinaires" }),
      t("Email", "Email"),
      t("College", "Collège"),
      t("Total_Email", ".", ro),
      t("Membre_Genre", "Membre_Genre"),
      t("Membre_Nom_complet", "Membre_Nom complet"),
      t("Membre_Qualite", "Membre_Qualité"),
    ],
  },

  Presentation: {
    label: "Présentation",
    singular: "note",
    icon: "book-2-line",
    display: "Presentation",
    columns: [
      t("Presentation", "Présentation", { type: "LongText" }),
    ],
  },

  // Réglages de l'en-tête de l'outil et de sa charte : une seule fiche, créée à
  // la demande depuis « Réglages › Identité ». Le logo de l'opérateur s'affiche
  // à droite du bloc-marque de l'État, comme le prévoit le DSFR pour un site de
  // opérateur. La table est `optional` : les documents Grist créés avant son
  // apparition continuent de fonctionner sans elle — l'outil propose de la
  // créer au moment où l'on veut se servir du logo ou choisir une charte.
  Identite: {
    label: "Identité de l'outil",
    singular: "réglage d'identité",
    icon: "image-line",
    display: "Logo_operateur",
    optional: true,
    columns: [
      t("Logo_operateur", "Logo de l'opérateur", {
        desc: "Adresse d'une image (ou image déposée depuis ce poste). Elle s'affiche dans l'en-tête, "
          + "à droite du bloc-marque « République Française ». Laisser vide pour n'afficher aucun logo.",
      }),
      t("Logo_operateur_alt", "Description du logo", {
        desc: "Texte lu par les lecteurs d'écran à la place de l'image, par exemple « Université de Valmont ». "
          + "Une image décorative peut se passer de description.",
      }),
      t("Charte", "Charte graphique", {
        type: "Choice",
        choices: CHARTES,
        desc: "« Charte neutre » (défaut, valeur vide comprise) : la même interface, sans la marque "
          + "de l'État et en Public Sans — pour les structures qui ne portent pas la charte de l'État. "
          + "« Charte de l'État » : bloc-marque « République Française » et police Marianne.",
      }),
      t("Police_documents", "Police des documents", {
        desc: "Police des courriers, rôles de séance et listes imprimées, pour tout l'outil. "
          + "Laisser vide pour la police de la charte (Marianne, ou Public Sans avec la charte neutre). "
          + "Un nom installé sur les postes : « Times New Roman », « Garamond »…",
      }),
    ],
  },

  // Répertoire des considérants de principe de l'établissement : les motifs de
  // droit qui reviennent d'une décision à l'autre, rangés par rubrique et par
  // tags pour que le rédacteur les retrouve et les glisse dans sa décision
  // (voir `considerants.js` et « Décisions › Rédaction »). La table est
  // `optional` : l'outil livre déjà un répertoire complet, et celui de
  // l'établissement ne s'y ajoute que s'il y a lieu — il prime alors sur le
  // considérant livré qu'il déclare adapter (`Origine`).
  Considerants: {
    label: "Considérants de principe",
    singular: "considérant",
    icon: "article-line",
    display: "Titre",
    optional: true,
    columns: [
      t("Titre", "Titre", {
        desc: "L'intitulé qui fait retrouver le considérant dans le répertoire, par exemple "
          + "« Fraude à un examen : la matérialité ». Il ne paraît pas dans la décision.",
      }),
      t("Rubrique", "Rubrique", {
        type: "Choice",
        choices: RUBRIQUES.map((r) => r.label),
        desc: "L'intertitre de la décision sous lequel ce motif se range — « Compétence », "
          + "« Qualification des faits », « Sanction »… La rubrique donne aussi l'ordre du plan : "
          + "les considérants se numérotent et se regroupent dans cet ordre.",
      }),
      t("Nature", "Nature", {
        type: "Choice",
        choices: NATURES.map((n) => n.label),
        desc: "« Principe » énonce la règle ; « Texte cité » recopie un article ; "
          + "« Enchaînement » est la phrase de liaison qui applique la règle à l'espèce et conclut.",
      }),
      t("Texte", "Texte", {
        type: "LongText",
        desc: "Le texte du considérant, qui sera inséré dans la décision (quelques paragraphes). "
          + "Les crochets […] marquent ce que le rédacteur doit compléter : la date, la personne, le fait.",
      }),
      t("Tags", "Tags", {
        desc: "Les thèmes qui le font retrouver, séparés par des virgules : fraude, examen, "
          + "téléphone, sursis, faits commis hors de l'établissement… Le filtre du répertoire s'en sert.",
      }),
      t("Source", "Source", {
        desc: "Le texte ou la jurisprudence cités, par exemple « Code rural et de la pêche maritime, "
          + "art. R.812-24-2 ». Laisser vide si elle n'est pas connue : elle n'est jamais inventée.",
      }),
      t("Domaine", "Domaine", {
        type: "Choice",
        choices: DOMAINES.map((d) => d.label),
        desc: "Le code dont le considérant est tiré : code rural et de la pêche maritime (sections "
          + "d'établissements agricoles) ou code de l'éducation. Permet de vérifier que la rédaction "
          + "citée est bien celle qui s'applique à la section.",
      }),
      t("Origine", "Origine", {
        desc: "Identifiant du considérant livré avec l'outil que celui-ci adapte. Renseigné, il fait "
          + "disparaître de la liste le considérant livré, que ce texte remplace. Laisser vide pour un "
          + "considérant propre à l'établissement, qui s'ajoute au répertoire.",
      }),
      t("Usage", "Usage", { type: "Int", ...ro, desc: "Nombre de fois que ce considérant a été inséré dans une décision. Le répertoire place les plus utilisés en tête." }),
    ],
  },
};

// Cheminement d'une affaire. La procédure de l'article R.811-40 est une
// **alternative à l'instruction** : elle ne comporte pas de phase d'instruction,
// le cheminement s'en trouve donc privé de l'étape « Instruction ».
export const ETAT_WORKFLOW = ["Pré-enregistrée", "Enregistrée", "Instruction", "Examen", "Terminée"];

export const ETAT_WORKFLOW_R811_40 = ["Pré-enregistrée", "Enregistrée", "Examen", "Terminée"];

/** Les étapes du cheminement d'une affaire, selon sa voie de traitement. */
export function etapesAffaire(affaire) {
  return affaire && affaire.Voie === VOIE_R811_40 ? ETAT_WORKFLOW_R811_40 : ETAT_WORKFLOW;
}

// « Classé sans suite » est la seule issue qui clôt l'affaire sans décision. La
// procédure de l'article R.811-40 n'en est pas une : c'est une voie de traitement
// (voir `VOIES`), qui suit son propre cheminement.
export const ETATS_CLOTURE = ["Classé sans suite"];

/** Une affaire close : « Terminée », ou l'une des issues de clôture. */
export function estCloseEtat(etat) {
  return etat === "Terminée" || ETATS_CLOTURE.includes(etat);
}

/**
 * Reprise des données écrites avant la refonte de la voie R.811-40.
 *
 * Le modèle précédent portait l'article R.811-40 comme un **état**, au même
 * titre qu'une clôture : « Procédure R.811-40 ». Ce n'est pas un état mais une
 * **voie de traitement**, alternative à l'instruction : une affaire qui portait
 * cet état est relue comme une affaire close — elle l'était dans l'ancien
 * modèle — et menée dans cette voie.
 */
export function migrerEtats(db) {
  for (const a of db?.Affaires || []) {
    if (a.Etat === "Procédure R.811-40") {
      a.Etat = "Terminée";
      if (!a.Voie) a.Voie = VOIE_R811_40;
    }
  }
  return db;
}

/**
 * Complète les sections écrites avant l'introduction de la tutelle et du type
 * de section : une section sans tutelle est réputée relever du ministère
 * chargé de l'enseignement supérieur, et sans type, être une section
 * d'établissement. Aucune valeur déjà saisie n'est modifiée.
 */
export function migrerSections(db) {
  for (const s of db?.Sections_disciplinaires || []) {
    if (!s.Tutelle) s.Tutelle = TUTELLE_MESR;
    if (!s.Type_de_section) s.Type_de_section = TYPE_ETABLISSEMENT;
  }
  return db;
}

/**
 * Marqueurs d'espacement de l'ancienne limitation technique du tableur
 * d'origine : des portions de texte blanches (donc invisibles), « S », « TAB »
 * ou « SPACER », qui encombraient l'édition des trames.
 */
const MARQUEUR_ESPACEMENT = /color:\s*rgb\(\s*255,\s*255,\s*255\s*\)|>\s*(?:S\{?|TAB|SPACER)\s*</;

/**
 * Nettoie les trames livrées par défaut dans les bases créées avant leur
 * nettoyage.
 *
 * La reprise ne touche **que** les trames qui portent encore un marqueur
 * d'espacement : une trame réécrite ou nettoyée à la main est laissée telle
 * quelle. Les modèles livrés étant reconnaissables à leur identifiant, c'est
 * cet identifiant qui sert de clé — un document qui aurait ses propres modèles
 * sous d'autres identifiants n'est donc jamais modifié.
 */
export function migrerTrames(db) {
  if (!db?.Trames?.length) return db;
  const parId = new Map(TRAMES_PAR_DEFAUT.map((t) => [Number(t.id), t]));
  for (const t of db.Trames) {
    const def = parId.get(Number(t.id));
    if (!def) continue;
    if (!MARQUEUR_ESPACEMENT.test(String(t.Template_contenu || ""))) continue;
    t.Template_contenu = def.Template_contenu;
    t.Objet = def.Objet;
    t.Nom = def.Nom;
  }
  return db;
}

/**
 * Reprise de la **date butoir d'instruction**.
 *
 * Les trames livrées relatives à l'instruction portaient leur terme dans la
 * « date libre » du document — une date générique, que d'autres trames emploient
 * pour un entretien ou une demande. Elles lisent désormais la date butoir
 * d'instruction du document, qui vaut pour l'affaire : c'est elle qui met le
 * terme de l'instruction en évidence, et par laquelle une décision ultérieure
 * la prolonge.
 *
 * La reprise ne touche que les **trames livrées** (reconnues à leur
 * identifiant) et que les documents qui les emploient : une trame propre à
 * l'établissement garde son texte, et une date libre déjà saisie n'est pas
 * perdue — elle devient la date butoir du document.
 */
export function migrerInstruction(db) {
  if (!db?.Trames?.length) return db;
  const parId = new Map(TRAMES_PAR_DEFAUT.map((t) => [Number(t.id), t]));
  for (const t of db.Trames) {
    const def = parId.get(Number(t.id));
    if (!def) continue;
    if (!t.Concerne_l_instruction && def.Concerne_l_instruction) t.Concerne_l_instruction = 1;
    const corps = String(t.Template_contenu || "");
    if (!corps.includes("{{Date_libre}}") || !String(def.Template_contenu || "").includes("Date_butoir_instruction")) continue;
    t.Template_contenu = corps.replace(/\{\{Date_libre\}\}(\.date\(@long\))?/g, "{{Date_butoir_instruction}}.date(@long)");
  }
  for (const g of db.Generateur || []) {
    if (g.Date_butoir_instruction || !g.Date_libre) continue;
    const trame = db.Trames.find((t) => Number(t.id) === Number(g.Template));
    if (!trame?.Concerne_l_instruction) continue;
    g.Date_butoir_instruction = g.Date_libre;
    g.Date_libre = null;
  }
  return db;
}

/**
 * Reprise de l'**ouverture de l'instruction**.
 *
 * Le délai d'instruction court à compter de la **décision de désignation** —
 * celle des rapporteurs, ou celle de la commission d'instruction —, et non de
 * la saisine : c'est la désignation qui ouvre l'instruction. Les trames
 * livrées qui portent cet acte sont donc marquées ici comme ouvrant
 * l'instruction, afin que la date du document produite fasse courir le délai.
 *
 * Seules les **trames livrées** sont reconnues — à leur identifiant : une
 * trame propre à l'établissement garde son texte, et c'est à l'établissement de
 * la marquer (Réglages › Trames) s'il produit l'acte autrement.
 */
export function migrerOuverture(db) {
  if (!db?.Trames?.length) return db;
  const parId = new Map(TRAMES_PAR_DEFAUT.map((t) => [Number(t.id), t]));
  for (const t of db.Trames) {
    const def = parId.get(Number(t.id));
    if (!def?.Ouvre_l_instruction) continue;
    if (!t.Ouvre_l_instruction) t.Ouvre_l_instruction = 1;
  }
  return db;
}

/**
 * Reprise de la **voie de recours** énoncée par les trames de notification.
 *
 * Les notifications livrées énonçaient la juridiction **en dur**, et à tort :
 * « auprès du tribunal administratif de <siège> » pour _toutes_ les trames, y
 * compris devant un enseignant-chercheur, que seule la voie du CNESER — ou du
 * CNESERAAV dans un établissement agricole — ouvre. La voie dépend en réalité du
 * **public** : le tribunal administratif du ressort du siège de l'établissement
 * pour un usager, le CNESER ou le CNESERAAV pour un enseignant-chercheur. Les
 * trames qui portent encore la formule livrée sont donc réécrites pour l'énoncer
 * par la colonne calculée de la section (`{{Affaire_Section}}.Voie_de_recours`,
 * `formulas.js`), qui suit le public et la tutelle ; la lettre destinée aux
 * enseignants-chercheurs retrouve, elle, l'article R.712-42 dont elle relève.
 * Le texte d'une trame **propre à l'établissement** — qui ne porte pas la
 * formule livrée — est laissé intact.
 */
export function migrerVoieDeRecours(db) {
  if (!db?.Trames?.length) return db;
  const recoursLivre = "Conformément à l'article R.421-1 du code de justice administrative, je vous informe que la présente décision peut faire l'objet d'un recours contentieux formé dans un délai de deux mois à compter de la notification de la présente auprès du tribunal administratif de {{Affaire_Section}}.Siege.";
  const recoursUsagers = "Conformément à l'article R.421-1 du code de justice administrative, je vous informe que la présente décision peut faire l'objet d'un recours contentieux formé dans un délai de deux mois à compter de la notification de la présente, devant {{Affaire_Section}}.Voie_de_recours.";
  const recoursEC = "Je vous informe que la présente décision peut faire l'objet d'un recours devant {{Affaire_Section}}.Voie_de_recours dans un délai de deux mois à compter de la notification de la présente.";
  const notification811 = "Conformément aux dispositions de l'article R.811-39 du code de l'éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire dans l'affaire vous concernant.";
  const notification712 = "Conformément aux dispositions de l'article R.712-42 du code de l'éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire dans l'affaire vous concernant.";
  for (const t of db.Trames) {
    let texte = String(t.Template_contenu ?? "");
    if (!texte.includes(recoursLivre)) continue;
    const ec = String(t.Public || "") === REGIMES[1];
    texte = texte.split(recoursLivre).join(ec ? recoursEC : recoursUsagers);
    if (ec) texte = texte.split(notification811).join(notification712);
    t.Template_contenu = texte;
  }
  return db;
}

/* ------------------------------------------------------------------ */
/* Feuilles de style : format, auteur et destinataire                  */
/* ------------------------------------------------------------------ */

/**
 * Ramène une base antérieure au modèle des **feuilles de style par format**.
 *
 * La refonte précédente mêlait, dans un même *type de trame*, le format du
 * document, son auteur et son destinataire : onze types pour quatre formats
 * réels — six depuis le rapport d'instruction et le partage de la décision du
 * président. Chaque trame porte
 * désormais ces trois qualités séparément — le
 * **type** donne le format (courrier, attestation, rapport d'instruction,
 * décision du président de la section, décision du président de la formation de
 * jugement, décision de la formation de jugement), la **trame** son
 * auteur et son destinataire — et les blocs d'un type sont génériques (ils
 * nomment `{destinataire}`, `{f_emetteur}`…, que la trame et l'affaire
 * remplissent).
 *
 * Cette reprise-ci va plus loin : le format ne porte plus trois blocs séparés
 * que chaque trame devait insérer à la main, mais **une feuille de style
 * unique** — son document entier, avec l'emplacement `{{Corps}}` —, dont toute
 * trame hérite sans rien insérer. Les trois blocs de l'établissement sont cousus
 * en une seule pièce (jamais perdus), et les quatre balises de mise en page,
 * devenues sans objet, sont retirées des corps de trames comme des textes de
 * documents déjà rédigés.
 *
 * La reprise procède en trois temps, et **ne touche jamais au texte d'une
 * trame propre à l'établissement** :
 *
 *  1. **Les formats livrés.** Les lignes de types livrées sont réunies :
 *     l'une d'elles est renommée sous le nom du format (son identifiant, donc
 *     ses liens, sont conservés) et reçoit la feuille de style livrée ; les
 *     autres, devenues inutiles, sont retirées. Un type **propre à
 *     l'établissement** est laissé tel quel — s'il tenait encore ses trois
 *     blocs, ceux-ci sont cousus en une feuille de style qui **le suit**. Un
 *     format livré **absent** de la base n'est pas fabriqué ici : il le sera par
 *     « Installer les trames par défaut », seul chemin qui l'écrit aussi dans le
 *     document Grist.
 *  2. **Les trames livrées** (`TRAMES_PAR_ID`, reconnues à leur identifiant),
 *     lorsqu'elles portent encore un ancien type : leur format, leur auteur et
 *     leur destinataire sont posés, et leur corps est remis à neuf — c'est le
 *     prix de la refonte, et il ne concerne que les modèles livrés.
 *  3. **Les trames propres à l'établissement** (identifiant inconnu) reçoivent,
 *     d'après leur ancien type, le format et les qualités correspondantes
 *     (`ANCIEN_FORMAT`, `ANCIEN_DEFAUT`) ; leur texte reste intact.
 *
 * La reprise est **idempotente** : une base déjà reprise ne trouve plus
 * d'ancien type, et rien n'y est modifié.
 *
 * Elle porte en outre, depuis le partage de la décision du président, le
 * renommage du format livré « Décision du président » et le déplacement des
 * trames livrées que leur modèle destine au président de la formation de
 * jugement (voir `deplacementsTramesPresident`) : c'est la seule reprise qui
 * touche une base **déjà** passée par la refonte.
 */
/* ------------------------------------------------------------------ */
/* Le partage de la décision du président                              */
/* ------------------------------------------------------------------ */

/** Nom du format livré des décisions du président, avant qu'elles ne
 *  deviennent des **ordonnances**. */
export const FORMAT_DECISION_PRESIDENT = "Décision du président";
/** Ancien nom du format livré du **président de la section**. */
export const FORMAT_DECISION_PRESIDENT_SECTION = "Décision du président de la section disciplinaire";
/** Ancien nom du format livré du **président de la formation de jugement**. */
export const FORMAT_DECISION_PRESIDENT_FORMATION = "Décision du président de la formation de jugement";
/** Nom actuel du format livré des ordonnances du **président de la section**. */
export const FORMAT_ORDONNANCE_PRESIDENT_SECTION = "Ordonnance du président de la section disciplinaire";
/** Nom actuel du format livré des ordonnances du **président de la formation**. */
export const FORMAT_ORDONNANCE_PRESIDENT_FORMATION = "Ordonnance du président de la formation de jugement";

/**
 * Les noms qu'a portés le format du président de la section : la reprise les
 * reconnaît tous, pour renommer l'ancien en ordonnance (voir `migrerFeuilles`).
 */
export const NOMS_FORMAT_PRESIDENT_SECTION = [
  FORMAT_DECISION_PRESIDENT,
  FORMAT_DECISION_PRESIDENT_SECTION,
  FORMAT_ORDONNANCE_PRESIDENT_SECTION,
];
/** Les mêmes, pour le format du président de la formation de jugement. */
export const NOMS_FORMAT_PRESIDENT_FORMATION = [
  FORMAT_DECISION_PRESIDENT_FORMATION,
  FORMAT_ORDONNANCE_PRESIDENT_FORMATION,
];

/**
 * Les trames **livrées** que le partage de la décision du président laisse sur
 * le format qui réunissait les deux présidents, alors que leur modèle
 * (`TRAMES_PAR_ID`) les destine à l'autre.
 *
 * Le format livré « Décision du président » mêlait en effet deux organes que
 * les textes distinguent : le président de la **section** disciplinaire —
 * organe administratif pour les usagers, juridiction pour les
 * enseignants-chercheurs —, qui compose la formation, remplace un membre
 * empêché (R.811-21) et désigne les rapporteurs ou la commission d'instruction
 * (R.712-32) ; et celui de la **formation de jugement**, c'est-à-dire le
 * président de la commission de discipline devant les usagers, qui fixe la date
 * de la séance (R.811-30), ordonne un complément d'instruction, requalifie les
 * motifs… Le format garde son identifiant et devient celui du président de la
 * section ; les trames du second rejoignent le format livré « Décision du
 * président de la formation de jugement ».
 *
 * Seules les trames **restées au texte du modèle** sont déplacées : une trame
 * que l'établissement a retouchée lui appartient, et la reprise la laisse où il
 * l'a mise. La fonction ne déplace rien elle-même — elle dit ce qu'il y a à
 * déplacer, parce que deux appelants en font deux usages : `migrerFeuilles` les
 * déplace en mémoire au chargement d'une base, et `installerTramesParDefaut`
 * (app.js) les déplace **à travers le magasin**, pour que le changement soit
 * écrit dans le document Grist — le format livré manquant venant d'y être
 * ajouté.
 */
export function deplacementsTramesPresident(db) {
  const noms = new Set(NOMS_FORMAT_PRESIDENT_SECTION);
  const nom = (t) => String(t?.Nom || "");
  const out = [];
  for (const t of db?.Trames || []) {
    const def = TRAMES_PAR_ID[t.id];
    if (!def) continue;
    const courant = (db.Types_Trames || []).find((x) => Number(x.id) === Number(t.Type));
    if (!courant || !noms.has(nom(courant))) continue;
    if (String(t.Auteur || "") !== String(def.Auteur || "")) continue;
    const cible = (db.Types_Trames || []).find((x) => nom(x) === def.Type);
    if (cible && Number(cible.id) !== Number(t.Type)) out.push({ trame: t, type: cible.id });
  }
  return out;
}

export function migrerFeuilles(db) {
  if (!db) return db;
  db.Types_Trames = db.Types_Trames || [];
  db.Trames = db.Trames || [];
  // Base neuve : il n'y a rien à reprendre, et c'est `ensureTramesParDefaut`
  // (voir `store.js`) qui l'équipe des modèles livrés — dans l'ordre, avec
  // leurs identifiants. Créer des formats ici remplirait la table avant lui, et
  // l'installation n'aurait plus lieu.
  if (!db.Types_Trames.length && !db.Trames.length) return db;

  const anciens = new Set(ANCIENS_TYPES_TRAMES);
  const nomDe = (t) => String(t?.Nom || "");
  // Les noms d'origine des types, **relevés avant tout renommage** : c'est eux
  // qui disent si une trame portait encore un ancien format. Les relire après
  // la réunion des feuilles de style les aurait tous crus déjà repris.
  const nomOrigine = new Map(db.Types_Trames.map((t) => [Number(t.id), nomDe(t)]));
  // Les anciens noms qui mènent à chaque format, dans l'ordre du catalogue.
  const anciensDuFormat = new Map();
  for (const [avant, format] of Object.entries(ANCIEN_FORMAT)) {
    if (!anciensDuFormat.has(format)) anciensDuFormat.set(format, []);
    anciensDuFormat.get(format).push(avant);
  }

  // 1. Les feuilles de style des formats livrés.
  //
  // Un format portait trois blocs — `En_tete`, `Signature`, `Pied_de_page` — que
  // chaque trame insérait dans son texte par trois balises. Le format porte
  // désormais **un seul document**, `Feuille_de_style`, où le chapeau et la
  // signature se suivent de part et d'autre de l'emplacement `{{Corps}}`, et où
  // le pied de page répété a sa place, à la fin. La reprise **coud** donc les
  // trois blocs d'un format écrit avant la refonte, sans en perdre un mot, et
  // efface les colonnes devenues inutiles.
  const poserFeuille = (row, feuille) => {
    row.Feuille_de_style = String(feuille ?? "");
    delete row.En_tete;
    delete row.Signature;
    delete row.Pied_de_page;
  };
  const coudreFeuille = (row) => {
    if (row.Feuille_de_style) {
      poserFeuille(row, row.Feuille_de_style);
      return;
    }
    if (row.En_tete === undefined && row.Signature === undefined && row.Pied_de_page === undefined) {
      // Rien à coudre : la colonne est tout de même posée, vide, pour que le
      // modèle soit le même partout — et qu'un format sans feuille se
      // reconnaisse à une chaîne vide plutôt qu'à une colonne absente.
      if (row.Feuille_de_style === undefined) row.Feuille_de_style = "";
      return;
    }
    const bouts = [String(row.En_tete ?? ""), "", BALISE_CORPS, "", String(row.Signature ?? "")];
    if (row.Pied_de_page) bouts.push(String(row.Pied_de_page));
    poserFeuille(row, bouts.join("\n"));
  };

  const idDuFormat = new Map();
  // Les lignes déjà attribuées à un format : une même ligne ne peut pas servir
  // deux formats. Sans ce garde-fou, un type créé pour un format serait repris
  // par le format suivant si son nom se trouvait être un ancien nom.
  const pris = new Set();
  // Le format livré des ordonnances du président — « Décision du président »
  // avant la refonte, puis « Décision du président de la section disciplinaire »
  // — réunissait d'abord deux organes. Il devient celui du **président de la
  // section disciplinaire** (son identifiant, donc ses liens et sa feuille
  // adaptée, sont conservés) ; l'ancienne valeur d'organe, « Président »,
  // désignait les deux, et vaut désormais pour le président de la section. Le
  // format du président de la **formation de jugement** est un format livré à
  // part, que « Installer les trames par défaut » ajoute à une base antérieure
  // (voir `deplacementsTramesPresident`). Les deux sont des **ordonnances** :
  // leur nom comme leur catégorie le disent désormais.
  for (const row of db.Types_Trames) {
    const nom = nomDe(row);
    if (NOMS_FORMAT_PRESIDENT_SECTION.includes(nom)) {
      // L'ancien format « Décision du président » — puis « Décision du président
      // de la section disciplinaire » — est celui des **ordonnances** : le mot
      // « ordonnance » dit ce que l'acte est, et la catégorie le range avec les
      // actes rendus.
      row.Nom = FORMAT_ORDONNANCE_PRESIDENT_SECTION;
      row.Categorie = FORMAT_ORDONNANCE;
    }
    if (NOMS_FORMAT_PRESIDENT_FORMATION.includes(nom)) {
      row.Nom = FORMAT_ORDONNANCE_PRESIDENT_FORMATION;
      row.Categorie = FORMAT_ORDONNANCE;
    }
    if (String(row.Organe || "") === "Président") row.Organe = ORGANE_PRESIDENT_SECTION;
  }
  for (const def of TYPES_TRAMES_PAR_DEFAUT) {
    let row = db.Types_Trames.find((t) => nomDe(t) === def.Nom && !pris.has(Number(t.id)));
    if (row) {
      pris.add(Number(row.id));
      // Un type trouvé **sous le nom du format** peut être de deux sortes. S'il
      // porte déjà un format (`Categorie`), c'est un format repris : sa feuille
      // de style est celle de l'établissement — cousue à partir de ses trois
      // blocs si l'établissement les écrivait encore ainsi. Sinon, c'est un
      // *ancien* type dont le nom se trouve être aussi celui du format —
      // « Attestation » est des deux — et sa feuille de style est celle
      // d'avant : elle est remplacée, comme celle des autres anciens types.
      if (row.Categorie) {
        coudreFeuille(row);
        // Un format livré qui n'écrivait plus rien — ni blocs, ni feuille —
        // reprend la feuille livrée sous ce nom : mieux vaut la mise en page
        // des modèles que pas de document du tout.
        if (!row.Feuille_de_style) poserFeuille(row, def.Feuille_de_style);
      } else poserFeuille(row, def.Feuille_de_style);
      if (!row.Categorie) row.Categorie = def.Categorie;
      if (row.Organe === undefined || row.Organe === null) row.Organe = def.Organe;
      idDuFormat.set(def.Nom, row.id);
      continue;
    }
    // Un ancien type peut être **renommé** : son identifiant — donc les liens
    // des trames et des documents — est conservé. Le rapprochement se fait
    // **par son nom d'origine**, et seulement parmi les anciens noms qui
    // mènent à ce format : une reprise qui prendrait le premier ancien type
    // venu raflerait le format d'à côté — elle a existé, et laissait un format
    // livré manquant à l'appel.
    const ancien = (anciensDuFormat.get(def.Nom) || [])
      .map((nom) => db.Types_Trames.find((t) => nomDe(t) === nom && !pris.has(Number(t.id))))
      .find(Boolean);
    if (ancien) {
      pris.add(Number(ancien.id));
      Object.assign(ancien, { Nom: def.Nom, Categorie: def.Categorie, Organe: def.Organe });
      poserFeuille(ancien, def.Feuille_de_style);
      idDuFormat.set(def.Nom, ancien.id);
    }
    // Sinon, aucun format de ce nom : la reprise **n'en crée pas**. Un format
    // livré ajouté par une version postérieure doit passer par
    // `installerTramesParDefaut` (app.js), seul chemin qui écrit aussi dans le
    // document Grist — une ligne fabriquée ici ne vivrait que dans la copie de
    // travail du navigateur, et le format resterait absent du document (voir
    // `typesTramesParDefautManquants`, qui le proposera à l'installation). Les
    // trames qui citaient un ancien type gardent ce type : rien ne se perd.
  }

  // Un type **propre à l'établissement** — un format qu'il s'est créé, ni livré
  // ni ancien type — garde son nom, et la boucle ci-dessus ne l'a donc pas
  // visité. S'il écrivait encore ses trois blocs, ses trames se retrouveraient
  // sans en-tête ni signature : ses blocs sont cousus ici, en une feuille qui le
  // suit. Le tri est sans effet sur un type déjà repris (sa feuille existe) ou
  // sur un type qui n'a jamais eu de blocs.
  for (const row of db.Types_Trames) coudreFeuille(row);

  // Les balises de mise en page — `{{En_tete}}`, `{{En_tete_corps}}`,
  // `{{Signature}}`, `{{Pied_de_page}}` — n'ont plus d'objet : l'en-tête, le
  // chapeau et la signature appartiennent à la feuille de style du format, et le
  // pied de page y est répété. Les retirer d'un texte, de trame ou de document,
  // ne change rien à la pièce produite ; la correction est idempotente.
  const BALISES_MISE_EN_PAGE = "<p[^>]*>\\s*\\{\\{(?:En_tete|En_tete_corps|Signature|Pied_de_page)\\}\\}\\s*<\\/p>";
  const TOUTES_BALISES = "\\{\\{(?:En_tete|En_tete_corps|Signature|Pied_de_page)\\}\\}";
  const nettoyerCorps = (texte) => {
    if (typeof texte !== "string") return texte;
    const reste = texte.replace(new RegExp(BALISES_MISE_EN_PAGE, "g"), "").replace(new RegExp(TOUTES_BALISES, "g"), "");
    return reste;
  };
  for (const t of db.Trames) t.Template_contenu = nettoyerCorps(t.Template_contenu);
  for (const g of db.Generateur || []) g.Contenu = nettoyerCorps(g.Contenu);

  // 2 & 3. Les trames.
  const modeleParId = new Map(TRAMES_PAR_DEFAUT.map((t) => [Number(t.id), t]));
  // Le corps d'une trame nomme le destinataire par une balise `{{…}}` (le
  // **bloc** d'un type, lui, emploie la variable `{…}`). L'ancien modèle y
  // nommait la colonne du document ; les modèles livrés sont réécrits, et la
  // correction est idempotente — le texte propre à l'établissement n'est
  // jamais touché.
  const NOMS_CORPS = ["formule_destinataire", "destinataire", "adresse", "f_emetteur", "nom_emetteur", "emetteur"];
  const corrigerCorps = (texte) => {
    let out = String(texte).replace(/\{\{Destinataire_institutionnel\}\}\.Formule_de_politesse/g, "{{formule_destinataire}}");
    for (const nom of NOMS_CORPS) {
      out = out.replace(new RegExp(`(?<!\\{)\\{${nom}\\}(?!\\})`, "g"), `{{${nom}}}`);
    }
    return out;
  };
  for (const t of db.Trames) {
    const ancienNom = nomOrigine.get(Number(t.Type)) || "";
    const def = TRAMES_PAR_ID[t.id];
    // Une trame livrée porte toujours le corps corrigé, **même déjà reprise** :
    // une version antérieure de la reprise a pu laisser l'ancienne balise dans
    // le corps d'une trame dont l'auteur était pourtant déjà posé.
    if (def && typeof t.Template_contenu === "string") {
      t.Template_contenu = corrigerCorps(t.Template_contenu);
    }
    if (def && !t.Auteur) {
      // Trame livrée à demi reprise (son identifiant est connu, mais elle n'a
      // pas encore d'auteur) : on pose les qualités manquantes.
      t.Type = idDuFormat.get(def.Type) ?? t.Type;
      t.Auteur = def.Auteur;
      t.Destinataire = def.Destinataire;
      continue;
    }
    if (!anciens.has(ancienNom)) continue; // déjà reprise, ou type propre à l'établissement
    if (def) {
      const modele = modeleParId.get(Number(t.id));
      t.Type = idDuFormat.get(def.Type) ?? t.Type;
      t.Auteur = def.Auteur;
      t.Destinataire = def.Destinataire;
      // Modèles livrés seulement : le corps est remis à neuf.
      if (modele) {
        t.Nom = modele.Nom;
        t.Objet = modele.Objet;
        t.Template_contenu = modele.Template_contenu;
      }
    } else {
      const format = ANCIEN_FORMAT[ancienNom];
      if (format && idDuFormat.has(format)) t.Type = idDuFormat.get(format);
      const [auteur, destinataire] = ANCIEN_DEFAUT[ancienNom] || [];
      if (auteur && !t.Auteur) t.Auteur = auteur;
      if (destinataire !== undefined && !t.Destinataire) t.Destinataire = destinataire;
      if (typeof t.Template_contenu === "string") t.Template_contenu = corrigerCorps(t.Template_contenu);
    }
  }

  // Le partage de la décision du président : les trames livrées que leur modèle
  // destine au président de la formation de jugement rejoignent leur format.
  // Tant que ce format manque à la base, elles restent sur celui du président de
  // la section — la reprise les déplacera à la prochaine ouverture, une fois le
  // format ajouté par « Installer les trames par défaut ».
  for (const d of deplacementsTramesPresident(db)) d.trame.Type = d.type;

  // Les anciens types devenus sans trame disparaissent : il ne reste que les
  // formats. Un ancien type encore cité (par une trame d'un autre modèle) est
  // conservé, pour ne rien casser — et un type qui porte le nom d'un **format**
  // l'est aussi, même s'il n'a pas encore de trame : c'est le format livré, et
  // « Attestation » est à la fois un ancien nom et un nom de format.
  const nomsFormats = new Set(TYPES_TRAMES_PAR_DEFAUT.map((d) => d.Nom));
  const utilises = new Set(db.Trames.map((t) => Number(t.Type)));
  db.Types_Trames = db.Types_Trames.filter((t) =>
    !anciens.has(nomDe(t)) || nomsFormats.has(nomDe(t)) || utilises.has(Number(t.id)));
  return db;
}

/**
 * Reprise des **titres** des modèles livrés, à mesure de la refonte
 * typographique.
 *
 * Les modèles portaient leurs titres en `<h3>`, dont la taille venait de la
 * charte graphique — 24 px, une fois et demie le corps du document — et non d'un
 * style en ligne. Or la barre d'outils ne montre et ne règle que les styles **en
 * ligne** : l'auteur de l'en-tête de service ne pouvait donc ni connaître ni
 * régler cette taille, et le titre écrasait le reste du document. L'alignement,
 * lui, venait d'une classe `ql-align-*` posée par l'éditeur d'origine, que la
 * barre d'outils ne voyait pas davantage.
 *
 * La reprise met chaque titre dans la forme que l'outil sait éditer : un `<p>`
 * à `font-size` explicite, prise dans l'échelle de la barre d'outils (8 à
 * 28 pt), à la couleur « Noir » de la palette, l'alignement en style en ligne,
 * et le gras en `<strong>`. Voir `TITRES_LIVRES` (`trames-defaut.js`) pour les
 * formes reprises, une par une.
 *
 * Elle est **idempotente** : une fois un document repris, plus aucune forme
 * ancienne n'y subsiste — un garde-fou rapide en atteste, et rien n'est donc
 * marqué modifié au chargement suivant. La substitution est **surgicale** : elle
 * ne touche que ces balises-là — jamais le texte que l'établissement a saisi,
 * qu'il habite une feuille de style, le corps d'une trame ou un document déjà
 * rédigé.
 */
export function migrerTitres(db) {
  if (!db) return db;
  const reprendre = (texte) => {
    if (typeof texte !== "string") return texte;
    if (!texte.includes("<h3") && !texte.includes("ql-align")) return texte;
    let out = texte;
    for (const [motif, remplacement] of TITRES_LIVRES) out = out.replace(motif, remplacement);
    return out;
  };
  for (const t of db.Types_Trames || []) t.Feuille_de_style = reprendre(t.Feuille_de_style);
  for (const t of db.Trames || []) {
    t.Feuille_de_style = reprendre(t.Feuille_de_style);
    t.Template_contenu = reprendre(t.Template_contenu);
  }
  for (const g of db.Generateur || []) g.Contenu = reprendre(g.Contenu);
  return db;
}

/**
 * Reprise des **actes rendus** — ordonnances et décisions — à mesure que la
 * procédure se dit.
 *
 * 1. **Le mot du dispositif.** Le président de la section — comme celui de la
 *    formation de jugement — ne « décide » pas : il **ordonne**. Ses actes
 *    s'appellent donc des ordonnances, et leur dispositif se lit « ORDONNE ».
 *    La reprise corrige le mot là où le modèle livré l'écrivait, et **seulement**
 *    là : sur les trames rattachées à un format d'ordonnance — par son nom ou sa
 *    catégorie —, et à condition qu'elles portent encore la balise livrée
 *    `<strong>DÉCIDE</strong>` ou la phrase « La présente décision sera
 *    notifiée ». Un texte propre à l'établissement, qui n'emploie pas ces
 *    tournures, n'est pas touché ; les décisions de la formation de jugement,
 *    qui s'appellent toujours des décisions, non plus.
 *
 * 2. **La signature rentrée dans le rang.** La feuille de style d'un acte rendu
 *    porte sa signature — et, pour une décision de la formation de jugement,
 *    celles du président de la formation et du secrétaire. La trame livrée
 *    « Décision définitive » la répétait dans son propre texte : la reprise
 *    retire ce doublon, à la seule condition qu'il soit **exactement** la
 *    tournure livrée, en fin de corps. Un texte qui aurait sa signature à lui,
 *    autrement écrite, n'est pas touché.
 *
 * 3. **Le document qui rédigeait une décision.** Seule une trame de format
 *    **Décision** rédige une décision, et un document ne s'y rattache que par
 *    là. Une **ordonnance** — l'acte d'un président, qui règle la marche de
 *    l'instance — n'a pas de décision : le lien `Decision_liee` qu'une version
 *    antérieure avait pu poser sur un tel document est donc retiré. Sans cela,
 *    l'ordonnance passerait pour le texte d'une décision (recours, terme,
 *    notification compris).
 *
 * Elle est **idempotente** : ni « ORDONNE », ni un corps sans doublon, ni un
 * document sans lien n'appellent de reprise.
 */
export function migrerActesRendus(db) {
  if (!db) return db;
  const nomsOrdonnance = new Set([
    ...NOMS_FORMAT_PRESIDENT_SECTION,
    ...NOMS_FORMAT_PRESIDENT_FORMATION,
  ]);
  const idsOrdonnance = new Set((db.Types_Trames || [])
    .filter((t) => String(t?.Categorie || "") === FORMAT_ORDONNANCE || nomsOrdonnance.has(String(t?.Nom || "")))
    .map((t) => Number(t.id)));
  const ORDONNE = (texte) => String(texte)
    .replace(/<strong>DÉCIDE<\/strong>/g, "<strong>ORDONNE</strong>")
    .replace(/La présente décision/g, "La présente ordonnance")
    .replace(/la présente décision/g, "la présente ordonnance");

  // La signature livrée en trop, telle qu'elle terminait le corps de la trame.
  const SIGNATURE_DOUBLON = "<p>{{Affaire_Section}}.Formule de la section disciplinaire,</p>"
    + "<p>{{Affaire}}.C_President</p>";
  const idsDecision = new Set((db.Types_Trames || [])
    .filter((t) => String(t?.Categorie || "") === FORMAT_DECISION)
    .map((t) => Number(t.id)));

  for (const t of db.Trames || []) {
    if (typeof t.Template_contenu !== "string") continue;
    const avant = t.Template_contenu;
    let apres = avant;
    if (idsOrdonnance.has(Number(t.Type))) apres = ORDONNE(apres);
    if (idsDecision.has(Number(t.Type)) && apres.trimEnd().endsWith(SIGNATURE_DOUBLON)) {
      apres = apres.slice(0, apres.lastIndexOf(SIGNATURE_DOUBLON));
    }
    if (apres === avant) continue;
    t.Template_contenu = apres;
    if (typeof t.Template_brut === "string") {
      t.Template_brut = idsOrdonnance.has(Number(t.Type)) ? ORDONNE(t.Template_brut) : t.Template_brut;
    }
  }

  // 3. Le lien d'une ordonnance vers une décision. Une ordonnance n'en rédige
  //    aucune : le document est l'acte lui-même, et la décision — quand elle
  //    existe — appartient à la formation de jugement. Le lien est retiré,
  //    comme la liste des décisions d'une trame de format « Décision » reste
  //    seule à en porter.
  const typeDeTrame = new Map((db.Trames || []).map((t) => [Number(t.id), Number(t.Type)]));
  for (const g of db.Generateur || []) {
    if (!g.Decision_liee) continue;
    if (!idsOrdonnance.has(typeDeTrame.get(Number(g.Template)))) continue;
    g.Decision_liee = "";
  }

  return db;
}

/**
 * Reprise des **ordonnances** — la composition de la formation, et les visas.
 *
 * 1. **La composition de la formation de jugement** (trame livrée n° 35). La
 *    constitution de la formation n'est pas une compétence de la formation
 *    elle-même : c'est le **président de la section** qui la compose. La trame
 *    livrée qui la portait était rangée parmi les décisions ; elle devient une
 *    **ordonnance** du président de la section, et son dispositif se lit
 *    « ORDONNE ».
 *
 * 2. **Les visas.** Un acte rendu — ordonnance comme décision — vise les textes
 *    sur lesquels il s'appuie et la saisine qui l'a saisi. Les visas des
 *    ordonnances sont portés par la **feuille de style de leur format**, et non
 *    par le corps de chaque trame : c'est le format qui est commun aux
 *    ordonnances d'un même organe, et c'est donc lui qui en porte les mentions.
 *    La formule d'ouverture de l'acte — « Le président de la section
 *    disciplinaire, » — y prend place juste avant les visas, puisque le corps
 *    commence désormais par le raisonnement.
 *
 *    La reprise **déplace** donc l'ouverture : elle l'entre dans la feuille de
 *    style — celle du format, ou celle que la trame s'est adaptée —, en même
 *    temps que les visas, puis la retire du corps de la trame. Elle n'entreprend
 *    rien lorsque la feuille porte déjà les visas (`{visa_code_rural}`), ni
 *    lorsqu'elle n'a pas d'emplacement `{{Corps}}` : une base déjà reprise, ou
 *    dont la feuille a été vidée, est laissée telle quelle.
 *
 * Le format lui-même, l'auteur et le corps des trames livrées sont posés par
 * `migrerFeuilles` ; cette reprise-ci ne les touche que pour ce qui précède, et
 * **jamais** un corps qui ne commence pas par l'ouverture livrée — un texte
 * propre à l'établissement est laissé tel quel.
 */
export function migrerOrdonnances(db) {
  if (!db) return db;
  const types = db.Types_Trames || [];
  db.Trames = db.Trames || [];

  // 1. La trame livrée « Composition de la formation de jugement ».
  const OUVERTURE_EC = "<p style=\"text-align: justify;\"><strong>La section disciplinaire compétente "
    + "à l'égard des enseignants-chercheurs,</strong></p>";
  for (const t of db.Trames) {
    if (Number(t.id) !== 35 || typeof t.Template_contenu !== "string") continue;
    if (!t.Template_contenu.includes(OUVERTURE_EC)) continue;
    const def = TRAMES_PAR_ID[35];
    const cible = types.find((x) => String(x.Nom || "") === String(def.Type || ""));
    if (cible) t.Type = cible.id;
    t.Auteur = def.Auteur;
    t.Template_contenu = t.Template_contenu
      .split(OUVERTURE_EC).join("")
      .replace(/La présente décision/g, "La présente ordonnance")
      .replace(/<strong>DÉCIDE<\/strong>/g, "<strong>ORDONNE</strong>");
  }

  // 2. Les visas, dans la feuille de style des ordonnances.
  const MARQUE = "{visa_code_rural}";
  const OUVERTURE = "<p style=\"text-align: justify;\"><strong>{f_ouverture},</strong></p>";
  const VISAS = OUVERTURE
    + "\n<p style=\"text-align: justify;\"><strong>Vu</strong> le code de l'éducation ;</p>"
    + "\n{visa_code_rural}"
    + "\n<p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le "
    + "{date_de_saisine} contre {mec_formule} {mec_nom} ;</p>\n";
  const RX_OUVERTURE = /^<p(?:\s[^>]*)?>\s*<strong>(?:\{\{Affaire_Section\}\}\.Formule de la section disciplinaire|\{\{Affaire\}\}\.C_Formule de la commission de discipline),<\/strong>\s*<\/p>/;
  const poserVisas = (feuille) => {
    const texte = String(feuille || "");
    if (!texte.trim() || texte.includes(MARQUE)) return null;
    const i = texte.indexOf(BALISE_CORPS);
    if (i === -1) return null;
    return texte.slice(0, i) + VISAS + "\n" + texte.slice(i);
  };
  const retirerOuverture = (t) => {
    if (typeof t.Template_contenu !== "string") return;
    const m = RX_OUVERTURE.exec(t.Template_contenu);
    if (m) t.Template_contenu = t.Template_contenu.slice(m[0].length);
  };
  const estOrdonnance = (t) => {
    const type = types.find((x) => Number(x.id) === Number(t.Type));
    return String(type?.Categorie || "") === FORMAT_ORDONNANCE;
  };

  // 2a. La feuille du **format**, héritée par toutes ses trames.
  for (const type of types) {
    if (String(type.Categorie || "") !== FORMAT_ORDONNANCE) continue;
    const trames = db.Trames.filter((t) =>
      estOrdonnance(t) && Number(t.Type) === Number(type.id) && !String(t.Feuille_de_style || "").trim());
    if (!trames.length) continue;
    const feuille = poserVisas(type.Feuille_de_style);
    if (!feuille) continue;
    type.Feuille_de_style = feuille;
    for (const t of trames) retirerOuverture(t);
  }

  // 2b. La feuille qu'une **trame** s'est adaptée : elle porte ses visas à elle.
  for (const t of db.Trames) {
    if (!estOrdonnance(t)) continue;
    if (!String(t.Feuille_de_style || "").trim()) continue;
    const feuille = poserVisas(t.Feuille_de_style);
    if (!feuille) continue;
    t.Feuille_de_style = feuille;
    retirerOuverture(t);
  }

  return db;
}

/**
 * Reprise des jonctions d'affaires.
 *
 * Une jonction ne vaut que si elle réunit **au moins deux affaires** : une
 * jonction dont l'affaire de tête a été supprimée, ou dont il ne reste qu'une
 * affaire, n'a plus d'objet — elle est retirée. Les références à des affaires
 * disparues sont écartées de la liste, sans toucher au reste.
 *
 * Aucune donnée d'affaire n'est modifiée : la jonction est une relation, et
 * c'est la relation seule qui est nettoyée.
 */
export function migrerJonctions(db) {
  if (!Array.isArray(db?.Jonctions)) return db;
  const affaires = db.Affaires || [];
  const existe = (id) => affaires.some((a) => Number(a.id) === Number(id));
  db.Jonctions = db.Jonctions.filter((j) => {
    const tete = Number(j.Affaire_de_tete) || 0;
    const jointes = (Array.isArray(j.Affaires_jointes)
      ? j.Affaires_jointes
      : String(j.Affaires_jointes ?? "").replace(/[[\]]/g, "").split(",")
    )
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isFinite(x) && x !== 0 && x !== tete && existe(x));
    j.Affaires_jointes = [...new Set(jointes)];
    return existe(tete) && j.Affaires_jointes.length > 0;
  });
  return db;
}

/**
 * Colonnes renommées au fil des versions : l'ancien identifiant est toujours
 * **lu** — dans une base déjà enregistrée (voir `migrerRapport`) comme dans une
 * source importée (voir `copie` dans `import.js`) — puis rangé sous son nom
 * actuel.
 */
export const COLONNES_RENOMMEES = {
  Date_du_rapport_de_saisine: "Date_du_rapport_d_instruction",
  Rapport_de_saisine: "Rapport_d_instruction",
};

/**
 * Reprise du vocabulaire du rapport.
 *
 * Le modèle portait « rapport de saisine » et « date du rapport de saisine » :
 * ce terme ne correspond à aucune pièce de la procédure. La saisine est un
 * acte, daté (`Date_de_saisine`) et documenté par la lettre de saisine ; le
 * rapport établi pendant l'instruction s'appelle le **rapport d'instruction**
 * (art. R.811-29 du code de l'éducation) — pour les enseignants-chercheurs, le
 * rapport de la commission d'instruction (art. R.712-33).
 *
 * Les deux colonnes sont renommées, **valeurs conservées** ; les trames qui
 * citaient l'ancienne balise `{{Affaire}}.Rapport_de_saisine` sont réécrites
 * pour continuer de produire le même document. Seules les phrases d'exemple
 * livrées avec la base sont reprises telles quelles (`EXEMPLES_RAPPORT`) :
 * toute autre valeur est laissée intacte, mot pour mot.
 */
const EXEMPLES_RAPPORT = new Map([
  ["Rapport de saisine transmis à la section : exposé des faits, pièces jointes et observations de la personne mise en cause.",
    "Rapport d'instruction transmis à la section : exposé des faits, pièces jointes et observations de la personne mise en cause."],
  ["Rapport de saisine du président de l'université, transmis à la section disciplinaire compétente à l'égard des enseignants-chercheurs.",
    "Rapport d'instruction de l'autorité qui a engagé les poursuites, transmis à la section disciplinaire compétente à l'égard des enseignants-chercheurs."],
  ["Rapport de saisine et pièces du déplacement pédagogique.",
    "Rapport d'instruction et pièces du déplacement pédagogique."],
]);

export function migrerRapport(db) {
  const renommages = Object.entries(COLONNES_RENOMMEES);
  const rapport = COLONNES_RENOMMEES.Rapport_de_saisine;
  for (const a of db?.Affaires || []) {
    for (const [avant, apres] of renommages) {
      if (a[avant] === undefined) continue;
      if (a[apres] === undefined) a[apres] = a[avant];
      delete a[avant];
    }
    if (EXEMPLES_RAPPORT.has(a[rapport])) a[rapport] = EXEMPLES_RAPPORT.get(a[rapport]);
  }
  const reecrire = (texte) => {
    if (typeof texte !== "string") return texte;
    let out = texte;
    for (const [avant, apres] of renommages) out = out.split(avant).join(apres);
    return out;
  };
  for (const t of db?.Trames || []) {
    t.Template_contenu = reecrire(t.Template_contenu);
    t.Template_brut = reecrire(t.Template_brut);
  }
  for (const g of db?.Generateur || []) g.Contenu = reecrire(g.Contenu);
  return db;
}

/**
 * Remet d'accord les deux faces d'une même relation.
 *
 * `Sections_disciplinaires.Secretaires` et `Secretaires.Section` affirment la
 * même chose — le rattachement d'un secrétaire à une section —, mais ce sont
 * deux colonnes : rien n'obligeait leurs listes à rester d'accord, et elles ne
 * l'étaient pas. On rattachait une secrétaire à une section sans qu'elle
 * apparaisse dans la fiche de la section, et l'affectation semblait n'avoir pas
 * pris.
 *
 * La reprise **réunit** les deux listes : un rattachement affirmé d'un côté
 * vaut des deux. La réunion ne peut rien perdre — elle rend visible ce qui
 * était déjà écrit quelque part. Elle est **idempotente** : une base déjà
 * d'accord n'est pas réécrite, donc rien n'est marqué modifié à chaque
 * chargement.
 */
export function migrerMiroirs(db) {
  if (!db) return db;
  for (const { table, colonne, tableCible, colonneCible } of pairesDeMiroirs()) {
    const lignes = db[table] || [];
    const cibles = db[tableCible] || [];
    const cibleParId = new Map(cibles.map((r) => [Number(r.id), r]));
    // Les rattachements affirmés, dans les deux sens.
    const paires = new Set();
    const cle = (a, b) => `${a}|${b}`;
    for (const ligne of lignes) {
      for (const id of idsDeRefList(ligne[colonne])) {
        if (cibleParId.has(id)) paires.add(cle(Number(ligne.id), id));
      }
    }
    for (const cible of cibles) {
      for (const id of idsDeRefList(cible[colonneCible])) {
        if (lignes.some((r) => Number(r.id) === id)) paires.add(cle(id, Number(cible.id)));
      }
    }
    for (const ligne of lignes) {
      const voulus = cibles
        .filter((c) => paires.has(cle(Number(ligne.id), Number(c.id))))
        .map((c) => Number(c.id));
      const actuels = idsDeRefList(ligne[colonne]);
      if (voulus.length !== actuels.length || voulus.some((id) => !actuels.includes(id))) {
        ligne[colonne] = voulus;
      }
    }
    for (const cible of cibles) {
      const voulus = lignes
        .filter((r) => paires.has(cle(Number(r.id), Number(cible.id))))
        .map((r) => Number(r.id));
      const actuels = idsDeRefList(cible[colonneCible]);
      if (voulus.length !== actuels.length || voulus.some((id) => !actuels.includes(id))) {
        cible[colonneCible] = voulus;
      }
    }
  }
  return db;
}

/** Migration complète d'une base chargée depuis le stockage ou un document. */
export function migrerDb(db) {
  return migrerVoieDeRecours(
    migrerOrdonnances(
      migrerMiroirs(
        migrerJonctions(
          migrerOuverture(migrerInstruction(migrerTrames(migrerActesRendus(migrerTitres(migrerFeuilles(migrerSections(migrerEtats(migrerRapport(db)))))))))
        )
      )
    )
  );
}

// Navigation principale de l'application — un onglet par tâche, et non plus
// un onglet par table. Les sous-pages de « Réglages » reprennent la
// configuration de l'outil.
export const NAV = [
  { id: "tableau-de-bord", label: "Tableau de bord", short: "Tableau", icon: "dashboard-3-line", subs: [
    { id: "synthese", label: "Synthèse", icon: "dashboard-3-line" },
    { id: "rapport", label: "Rapport d'activité", icon: "bar-chart-line" },
  ] },
  { id: "affaires", label: "Affaires", icon: "folder-2-line" },
  // Réservée aux propriétaires du document (voir `navHtml` dans app.js) :
  // c'est d'ici que se décide qui suit quelle affaire.
  { id: "attribution", label: "Attribution des affaires", short: "Attribution", icon: "arrow-left-right-line" },
  // Le **calendrier** est la page du temps : on y voit les échéances — envoi des
  // convocations, terme de l'instruction, prescription, terme de la sanction,
  // expiration du délai de recours — et l'on y programme les séances, qui en
  // sont une. Deux vues, donc : les **échéances** (la grille du mois, la liste
  // « À venir » et l'export d'agenda) et les **séances et rôles** (la liste des
  // séances, leur organisation, leur rôle).
  //
  // « Séances » a d'abord été un onglet voisin, puis le calendrier a vécu sous
  // lui (`seances/calendrier`). C'est l'inverse qui est juste : la séance est un
  // rendez-vous parmi les échéances. Les adresses antérieures `#seances` et
  // `#seances/calendrier` restent valables (voir `corrigerRoute`, app.js).
  //
  // L'icône du menu est celle des **échéances** (`calendar-check-line`), et non
  // le calendrier nu de la vue « Séances et rôles » : deux vues voisines se
  // ressembleraient à s'y méprendre.
  { id: "calendrier", label: "Calendrier", short: "Calendrier", icon: "calendar-check-line", subs: [
    { id: "echeances", label: "Échéances", icon: "calendar-check-line" },
    { id: "seances", label: "Séances et rôles", icon: "calendar-line" },
  ] },
  { id: "documents", label: "Documents", icon: "printer-line" },
  { id: "decisions", label: "Décisions", icon: "scales-3-line" },
  {
    id: "reglages",
    label: "Réglages",
    icon: "settings-5-line",
    subs: [
      // Trois groupes plutôt qu'une liste de onze entrées à plat : ce qui
      // décrit la **section** et ses gens, ce qui constitue la **bibliothèque**
      // des modèles, et l'**outil** lui-même (son identité, ses données, ses
      // imports). Le rendu groupe les pastilles sous un intitulé (voir
      // `ui.subnav`).
      { id: "sections", label: "Sections et membres", icon: "layout-grid-line", groupe: "Section" },
      { id: "personnes", label: "Personnes", icon: "user-line", groupe: "Section" },
      { id: "secretaires", label: "Secrétaires", icon: "user-star-line", groupe: "Section" },
      { id: "destinataires", label: "Destinataires", icon: "mail-line", groupe: "Section" },
      { id: "catalogues", label: "Catalogues et délais", icon: "bookmark-line", groupe: "Bibliothèque" },
      { id: "trames", label: "Trames", icon: "file-text-line", groupe: "Bibliothèque" },
      { id: "types", label: "Formats (feuilles de style)", icon: "stack-line", groupe: "Bibliothèque" },
      { id: "identite", label: "Identité", icon: "image-line", groupe: "Outil" },
      { id: "charte", label: "Charte graphique", icon: "palette-line", groupe: "Outil" },
      { id: "donnees", label: "Données", icon: "database-line", groupe: "Outil" },
      { id: "import", label: "Import des données", icon: "upload-line", groupe: "Outil" },
    ],
  },
  { id: "aide", label: "Aide", icon: "question-line" },
  // Page légale, atteignable par lien (pied de page, page Aide) mais absente
  // de la barre de navigation : `cache` la réserve à ces liens (NC-0014).
  { id: "accessibilite", label: "Accessibilité", icon: "information-line", cache: true },
  // Onglet de mise au point, réservé au mode autonome : il n'apparaît jamais
  // lorsque l'outil est embarqué dans un document Grist (voir views/debug.js).
  { id: "debug", label: "Debug", short: "Debug", icon: "bug-line" },
];

export function navItem(id) {
  return NAV.find((p) => p.id === id) || null;
}

/**
 * Sous-pages de Réglages dont l'adresse peut désigner une fiche — et non
 * seulement la sous-page — par un troisième segment : `reglages/trames/7`
 * ouvre la trame 7 dans son espace de rédaction, quand `reglages/trames`
 * n'ouvre que le registre (voir `FICHES_REGLAGES` dans app.js et
 * `viewReglages` dans views/reglages.js).
 */
export const FICHES_SUBS = { trames: "Trames", types: "Types_Trames" };

export function tableNames() {
  return Object.keys(SCHEMA);
}

/** Tables du modèle v2 (hors héritage), dans l'ordre du schéma. */
export function activeTableNames() {
  return Object.keys(SCHEMA).filter((name) => !SCHEMA[name].legacy);
}

/** Une table d'héritage est lue mais jamais écrite, ni exigée du document. */
export function isLegacyTable(name) {
  return !!SCHEMA[name]?.legacy;
}

/** Définition d'une colonne, ou `null`. */
export function colDef(tableName, colId) {
  return (SCHEMA[tableName]?.columns || []).find((c) => c.id === colId) || null;
}

/**
 * Identifiants d'une colonne `RefList`, quelle que soit la forme sous laquelle
 * ils sont rangés : un tableau — ce que l'outil écrit —, ou la liste écrite
 * « 1,2 », « [1,2] », telle que le document d'origine et les imports la
 * portaient. Une valeur vide, un zéro ou un texte illisible ne donnent aucun
 * identifiant : mieux vaut une liste vide qu'une référence à rien.
 */
export function idsDeRefList(raw) {
  if (Array.isArray(raw)) return raw.map(Number).filter((x) => Number.isFinite(x) && x !== 0);
  const texte = String(raw ?? "").trim();
  if (!texte) return [];
  return texte
    .replace(/[[\]]/g, "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x !== 0);
}

/**
 * Colonnes qui déclarent une **autre face** d'elles-mêmes : un rattachement
 * écrit des deux côtés (`Sections_disciplinaires.Secretaires` et
 * `Secretaires.Section`). Sert à la reprise des données comme au magasin, qui
 * tient les deux listes d'accord dès qu'on écrit l'une (voir
 * `propagerMiroirs`, store.js).
 */
export function pairesDeMiroirs() {
  const paires = [];
  const vus = new Set();
  for (const [table, def] of Object.entries(SCHEMA)) {
    for (const col of def.columns || []) {
      if (!col.miroir) continue;
      const cle = `${table}.${col.id}`;
      if (vus.has(cle)) continue;
      const [tableCible, colCible] = String(col.miroir).split(".");
      const retour = colDef(tableCible, colCible);
      // Une colonne miroir dont le vis-à-vis ne le déclare pas en retour n'est
      // pas une relation à deux faces : il n'y a rien à tenir d'accord.
      if (!retour || retour.miroir !== cle) continue;
      vus.add(cle);
      vus.add(`${tableCible}.${colCible}`);
      paires.push({ table, colonne: col.id, tableCible, colonneCible: colCible });
    }
  }
  return paires;
}
