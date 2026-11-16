// Architecture d'origine du document Grist « Gestion des sections
// disciplinaires ».
//
// Ce fichier ne décrit **pas** le modèle de l'outil (c'est `schema.js`) : il
// décrit le tableur tel qu'il a été construit, colonne par colonne, et ce que
// chacune devient dans le modèle v2. Il sert à deux choses :
//
//  - l'outil d'import (`import.js`) s'en sert comme table de correspondance ;
//  - l'écran « Réglages › Import » l'affiche tel quel, pour que la reprise des
//    données soit lisible avant d'être appliquée.
//
// Une colonne absente de ces tables n'est pas reprise : c'est le cas des
// colonnes calculées du document d'origine (formules Python), recalculées ici
// par `formulas.js`.

/** Destin d'une colonne : la table v2 qui la reçoit, et sous quel nom. */
const keep = (target) => ({ target, statut: "reprise" });
const move = (target, note) => ({ target, statut: "deplacee", note });
const computed = (note) => ({ target: null, statut: "calculee", note });

export const LEGACY_COLUMNS = {
  Sections_disciplinaires: {
    label: "Sections disciplinaires",
    columns: {
      Structure: keep("Sections_disciplinaires.Structure"),
      Public: move("Sections_disciplinaires.Public", "devient le régime de la section (Usagers ou Enseignants-chercheurs)"),
      Siege: keep("Sections_disciplinaires.Siege"),
      Structure_Nom_Complet: keep("Sections_disciplinaires.Structure_Nom_Complet"),
      Logo: keep("Sections_disciplinaires.Logo"),
      Marianne: keep("Sections_disciplinaires.Marianne"),
      Acronyme: keep("Sections_disciplinaires.Acronyme"),
      Email_de_contact: keep("Sections_disciplinaires.Email_de_contact"),
      Secretariat_Rue: keep("Sections_disciplinaires.Secretariat_Rue"),
      Secretariat_CP_Ville: keep("Sections_disciplinaires.Secretariat_CP_Ville"),
      Secretaires: keep("Sections_disciplinaires.Secretaires"),
      VP: keep("Sections_disciplinaires.VP"),
      Intitule_de_la_section: computed("recalculée (Structure - Public)"),
      President: computed("recalculée depuis les membres"),
      Formule: computed("recalculée depuis les membres"),
      Formule_complete: computed("recalculée depuis les membres"),
      Lien_cliquable: computed("recalculée"),
      Voie_de_recours: computed("recalculée (juge administratif ou CNESER, selon le public et la tutelle)"),
      Secretaires_Email: computed("recalculée"),
    },
  },

  Membres: {
    label: "Membres",
    columns: {
      Prenom: keep("Membres.Prenom"),
      NOM: keep("Membres.NOM"),
      Genre: keep("Membres.Genre"),
      College: keep("Membres.College"),
      Email: keep("Membres.Email"),
      Role: keep("Membres.Role"),
      Section: keep("Membres.Section"),
      Fin_de_mandat: move("Membres.Fin_de_mandat", "l'année de terme reste lue tant que la date de fin de mandat n'est pas saisie"),
      En_fonction: computed("recalculée depuis le mandat"),
      Nom_complet: computed("recalculée"),
      Mme_Mr: computed("recalculée"),
      Formule: computed("recalculée"),
      Formule_complete: computed("recalculée"),
      Qualite: computed("recalculée"),
    },
  },

  Secretaires: {
    label: "Secrétaires",
    columns: {
      Prenom: keep("Secretaires.Prenom"),
      Nom: keep("Secretaires.Nom"),
      Genre: keep("Secretaires.Genre"),
      Email: keep("Secretaires.Email"),
      Section: keep("Secretaires.Section"),
      Actif_: keep("Secretaires.Actif_"),
      Nom_complet: computed("recalculée"),
      Section_UUID: computed("recalculée"),
      Formule: computed("recalculée"),
    },
  },

  Destinataires_institutionnels: {
    label: "Destinataires institutionnels",
    columns: {
      Section: keep("Destinataires_institutionnels.Section"),
      Qualite: keep("Destinataires_institutionnels.Qualite"),
      Nom_complet: keep("Destinataires_institutionnels.Nom_complet"),
      Adresse: keep("Destinataires_institutionnels.Adresse"),
      Formule_de_politesse: keep("Destinataires_institutionnels.Formule_de_politesse"),
      Signature: keep("Destinataires_institutionnels.Signature"),
    },
  },

  Affaires: {
    label: "Affaires",
    columns: {
      Numero: keep("Affaires.Numero"),
      Date_de_saisine: keep("Affaires.Date_de_saisine"),
      Etat: keep("Affaires.Etat"),
      Section: keep("Affaires.Section"),
      Motif: keep("Affaires.Motif"),
      Composante: keep("Affaires.Composante"),
      Lien_vers_le_dossier: keep("Affaires.Lien_vers_le_dossier"),
      Secretaire: keep("Affaires.Secretaire"),
      Seance_d_examen: keep("Affaires.Seance_d_examen"),
      SE_Heure_de_passage: keep("Affaires.SE_Heure_de_passage"),
      // L'identité du mis en cause quitte la table des affaires : elle devient
      // une ligne du répertoire, une seule fois pour toutes ses affaires.
      Prenom_du_mis_en_cause: move("Personnes.Prenom", "crée ou complète la personne mise en cause"),
      Nom_du_mis_en_cause: move("Personnes.Nom", "crée ou complète la personne mise en cause"),
      Genre: move("Personnes.Genre", "crée ou complète la personne mise en cause"),
      Date_de_naissance: move("Personnes.Date_de_naissance", "crée ou complète la personne mise en cause"),
      Adresse: move("Personnes.Adresse", "crée ou complète la personne mise en cause"),
      INE: move("Personnes.INE", "crée ou complète la personne mise en cause"),
      Formation_suivie: move("Personnes.Formation_suivie", "crée ou complète la personne mise en cause"),
      Nom_complet: computed("recalculée depuis la personne mise en cause"),
      Formule: computed("recalculée depuis la personne mise en cause"),
      Commission: computed("recalculée depuis les intervenants"),
      C_President: computed("recalculée depuis les intervenants"),
      C_Formule: computed("recalculée depuis les intervenants"),
      C_Qualite: computed("recalculée depuis les intervenants"),
      Rapporteur: computed("recalculée depuis les intervenants"),
      Rapporteur_adjoint: computed("recalculée depuis les intervenants"),
      Composition_de_l_instruction: computed("recalculée depuis les intervenants"),
      SE_Date: computed("recalculée depuis la séance"),
      SE_Salle: computed("recalculée depuis la séance"),
      SE_Adresse: computed("recalculée depuis la séance"),
      SE_Visio: computed("recalculée depuis la séance"),
      SE_Date_et_heure: computed("recalculée depuis la séance"),
      Section_Secretaires_Email: computed("recalculée"),
      Recherche: computed("recalculée"),
    },
  },

  Commissions: {
    label: "Commissions",
    columns: {
      Affaire: keep("Intervenants.Affaire"),
      Membre: keep("Intervenants.Membre"),
      Role: move("Intervenants.Role", "Président devient « Président de la formation », Membre devient « Membre de la formation »"),
      Section: computed("recalculée depuis l'affaire"),
      Email: computed("recalculée depuis le membre"),
      College: computed("recalculée depuis le membre"),
      Total_Email: computed("recalculée"),
      Membre_Genre: computed("recalculée"),
      Membre_Nom_complet: computed("recalculée"),
      Membre_Qualite: computed("recalculée"),
    },
  },

  Seances_d_examen: {
    label: "Séances d'examen",
    columns: {
      Section: keep("Seances_d_examen.Section"),
      Affaires: move("Affaires.Seance_d_examen", "l'affaire porte désormais sa séance : la liste posée sur la séance faisait doublon"),
      Date: keep("Seances_d_examen.Date"),
      Salle: keep("Seances_d_examen.Salle"),
      Adresse: keep("Seances_d_examen.Adresse"),
      Lien_visio: keep("Seances_d_examen.Lien_visio"),
      Identifiant: computed("recalculé"),
    },
  },

  Decisions: {
    label: "Décisions",
    columns: {
      Affaire: keep("Decisions.Affaire"),
      Decision: move("Decisions.Decision", "l'ancien libellé est conservé ; la sanction du catalogue est recherchée par son nom"),
      Date_de_notification: keep("Decisions.Date_de_notification"),
      Duree_totale_d_exclusion_mois_: keep("Decisions.Duree_totale_d_exclusion_mois_"),
      Duree_d_exclusion_sursis_: keep("Decisions.Duree_d_exclusion_sursis_"),
      Sursis_: keep("Decisions.Sursis_"),
      Terme_de_la_sanction: computed("recalculée"),
      Affaire_INE: computed("recalculée"),
      Affaire_Composante: computed("recalculée"),
      Date_de_saisine: computed("recalculée"),
      En_cours_: computed("recalculée"),
      Delai_de_traitement: computed("recalculée"),
    },
  },

  Trames: {
    label: "Trames",
    columns: {
      Nom: keep("Trames.Nom"),
      Type: keep("Trames.Type"),
      Objet: keep("Trames.Objet"),
      Public: move("Trames.Public", "devient le régime auquel la trame s'applique"),
      Template_contenu: keep("Trames.Template_contenu"),
      Template_brut: keep("Trames.Template_brut"),
      Type_court_: computed("recalculé"),
      Nom_complet: computed("recalculé"),
    },
  },

  Types_Trames: {
    label: "Types de trames",
    columns: {
      Nom: keep("Types_Trames.Nom"),
      En_tete: keep("Types_Trames.En_tete"),
      Signature: keep("Types_Trames.Signature"),
      Pied_de_page: keep("Types_Trames.Pied_de_page"),
    },
  },

  Generateur: {
    label: "Documents (Generateur)",
    columns: {
      Affaire: keep("Generateur.Affaire"),
      Template: keep("Generateur.Template"),
      Date: keep("Generateur.Date"),
      Destinataire_institutionnel: keep("Generateur.Destinataire_institutionnel"),
      Emetteur: keep("Generateur.Emetteur"),
      Champ_libre: keep("Generateur.Champ_libre"),
      Date_libre: keep("Generateur.Date_libre"),
      L_Destinataire: keep("Generateur.L_Destinataire"),
      L_Adresse: keep("Generateur.L_Adresse"),
      L_Formule: keep("Generateur.L_Formule"),
      VP: keep("Generateur.VP"),
      Qualite_du_destinataire: keep("Generateur.Qualite_du_destinataire"),
      Qualite_de_l_emetteur: keep("Generateur.Qualite_de_l_emetteur"),
      En_tete: computed("recalculé depuis le type de trame"),
      En_tete_corps: computed("recalculé depuis le type de trame"),
      Signature: computed("recalculé depuis le type de trame"),
      Pied_de_page: computed("recalculé depuis le type de trame"),
      Template_rendu: computed("recalculé"),
    },
  },

  Presentation: {
    label: "Présentation",
    columns: {
      Presentation: keep("Presentation.Presentation"),
    },
  },
};

/**
 * Colonnes que le modèle v2 ne reprend pas, avec la raison.
 * Elles ne sont jamais écrites : à supprimer à la main dans le document Grist
 * une fois l'import vérifié (l'outil ne supprime rien dans vos tables).
 */
export const LEGACY_DROPPED = [
  { source: "Affaires.Prenom_du_mis_en_cause", raison: "déplacée dans Personnes ; une colonne calculée du même nom reste disponible pour les trames" },
  { source: "Affaires.Nom_du_mis_en_cause", raison: "déplacée dans Personnes ; recalculée" },
  { source: "Affaires.Genre", raison: "déplacée dans Personnes ; recalculée" },
  { source: "Affaires.Date_de_naissance", raison: "déplacée dans Personnes ; recalculée" },
  { source: "Affaires.Adresse", raison: "déplacée dans Personnes ; recalculée" },
  { source: "Affaires.INE", raison: "déplacée dans Personnes ; recalculée" },
  { source: "Affaires.Formation_suivie", raison: "déplacée dans Personnes ; recalculée" },
  { source: "Seances_d_examen.Affaires", raison: "l'affaire porte désormais sa séance (Affaires.Seance_d_examen)" },
];

/**
 * Correspondance des rôles de la commission d'origine vers les rôles des
 * intervenants. Un rôle inconnu devient « Membre de la formation ».
 */
export const LEGACY_ROLES_INTERVENANT = {
  "Président": "Président de la formation",
  "Rapporteur": "Rapporteur",
  "Rapporteur adjoint": "Rapporteur adjoint",
  "Membre": "Membre de la formation",
};

/**
 * Les trames du document d'origine contiennent du HTML hérité de Quill : des
 * paragraphes `ql-align-*`, des sauts de ligne figurés par un « S » colorié en
 * blanc, et parfois des `<span style="color: rgb(255,255,255)">` isolés.
 * `render.js` sait déjà interpréter les alignements et supprimer les
 * paragraphes vides ; l'import laisse le texte tel quel, et le rapport signale
 * les trames concernées.
 */
export const QUILL_ALIGN_CLASS = /ql-align-(center|justify|right|left)/;

/** Le signe « S » blanc utilisé par le document d'origine comme saut de ligne. */
export const QUILL_BLANC = /color:\s*rgb\(255,\s*255,\s*255\)/;
