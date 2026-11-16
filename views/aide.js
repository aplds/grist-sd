// Aide : prise en main, guide de l'interface et documentation technique.
//
// Le guide décrit l'interface RÉELLE de l'outil (ses huit entrées de menu et
// les onglets d'une affaire). La présentation d'origine du document Grist est
// conservée plus bas, à titre de documentation historique.

import { mdToHtml } from "../markdown.js";
import { DICTIONNAIRE_HTML } from "../dictionary.js";
import { noticesProcedures } from "../procedure.js";
import { canSettings } from "../roles.js";
import { debugAllowed } from "./debug.js";
import * as ui from "../ui.js";
import { matches, quickCard } from "./common.js";

const { esc, panel, emptyState } = ui;

/** Section repliable (balise `details`, sans dépendance au JS du DSFR). */
function accordion(title, body, { open = false, iconName } = {}) {
  return `
<details class="app-accordion"${open ? " open" : ""}>
  <summary>${iconName ? ui.icon(iconName, 'class="fr-mr-1v"') : ""}${esc(title)}</summary>
  <div class="app-accordion__body">${body}</div>
</details>`;
}

/* ------------------------------------------------------------------ */
/* Petits fabricants de contenu                                        */
/* ------------------------------------------------------------------ */

const p = (t) => `<p>${t}</p>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const k = (t) => `<code>${esc(t)}</code>`;
const b = (t) => `<strong>${esc(t)}</strong>`;

/* ------------------------------------------------------------------ */
/* Étapes du circuit d'une affaire                                     */
/* ------------------------------------------------------------------ */

const ETAPES = [
  {
    label: "1. Paramétrer la section",
    text: "Structure, acronyme, public, tutelle, type de section et membres. Le public (usagers ou enseignants-chercheurs) commande la procédure suivie ; la tutelle et le type de section, la composition des organes disciplinaires. L'outil en déduit les onglets, les catalogues et les contrôles.",
    href: "#reglages/sections",
    iconName: "school-line",
  },
  {
    label: "2. Enregistrer les affaires",
    text: "Saisissez la saisine : personne mise en cause, motif, section. Le numéro d'affaire est proposé automatiquement, et la fiche de la personne est créée dans le répertoire.",
    href: "#affaires",
    iconName: "folder-2-line",
  },
  {
    label: "3. Constituer la formation",
    text: "Désignez la formation dans l'onglet de l'affaire — « Commission » pour les usagers, « Instruction » pour les enseignants-chercheurs (commission d'instruction de deux membres), « Section » devant la section disciplinaire académique. Les intervenants se choisissent parmi les membres de la section — la liste ne propose qu'eux, groupés par collège — ; une personne qui n'en est pas membre s'ajoute par « Ajouter une personne hors section », son nom saisi librement : elle apparaît alors « Hors section ».",
    href: "#affaires",
    iconName: "group-line",
  },
  {
    label: "4. Planifier la séance",
    text: "Créez une séance (examen, réunion d'instruction ou entretien R.811-40), inscrivez-y les affaires avec leur heure de passage, puis imprimez le rôle.",
    href: "#calendrier/seances",
    iconName: "calendar-line",
  },
  {
    label: "5. Rendre la décision",
    text: "Enregistrez la décision, sa nature et sa sanction, puis ses recours. Le terme et les délais en découlent, et les contrôles de régularité signalent les manques.",
    href: "#affaires",
    iconName: "scales-3-line",
  },
  {
    label: "6. Produire les courriers",
    text: "Choisissez une trame dans l'onglet « Documents » de l'affaire, corrigez au besoin le texte du document, puis imprimez-le ou exportez-le.",
    href: "#documents",
    iconName: "printer-line",
  },
];

/* ------------------------------------------------------------------ */
/* Guide de l'interface                                                */
/* ------------------------------------------------------------------ */

/**
 * Une procédure, telle que la page Aide la présente : le texte qui la fonde,
 * puis chaque bloc d'explication calculé par `procedure.js` — organes,
 * instruction, autorités, délais, voies de traitement, textes.
 */
function noticeProcedureHtml(n) {
  const blocs = n.blocs.map((bloc) => `
    ${p(`<strong>${esc(bloc.titre)}</strong>`)}
    ${ul(bloc.items.map((i) => esc(i)))}`).join("");
  return `${p(`<em>${esc(n.texte)}</em>`)}${blocs}`;
}

/** Les cinq procédures disciplinaires que l'outil sait conduire. */
function proceduresAccordions() {
  return noticesProcedures().map((n) => {
    const titre = n.sousTitre.charAt(0).toUpperCase() + n.sousTitre.slice(1);
    return accordion(titre, `<div class="app-prose">${noticeProcedureHtml(n)}</div>`, {
      iconName: n.groupe === "Enseignants-chercheurs" ? "user-star-line" : "group-line",
    });
  }).join("");
}

const GUIDE = [
  {
    title: "Principes communs à toutes les pages",
    iconName: "information-line",
    open: true,
    body: `
      ${p("L'outil se parcourt par un menu de huit entrées : " + b("Tableau de bord") + ", " + b("Affaires") + ", " + b("Attribution des affaires") + ", " + b("Calendrier") + ", " + b("Documents") + ", " + b("Décisions") + ", " + b("Réglages") + " et " + b("Aide") + " — auxquelles s'ajoute « Debug », qui n'existe qu'en mode autonome. Deux d'entre elles — Attribution des affaires et Réglages — ne s'affichent que pour les propriétaires du document. L'ordre du menu suit le déroulé habituel d'un dossier disciplinaire.")}
      ${ul([
        b("Enregistrement immédiat :") + " il n'y a pas de bouton « Enregistrer ». Chaque champ modifié est écrit aussitôt dans la base.",
        b("Aides de saisie :") + " le texte en petits caractères gris sous un libellé explique la valeur attendue.",
        b("Listes maîtresses :") + " les pages Affaires, Séances et Réglages présentent à gauche une liste de sélection, à droite le détail de l'élément choisi. La liste de gauche garde sa propre barre de défilement.",
        b("Une action, un endroit :") + " le geste courant de la page — « Nouvelle affaire », « Créer une séance » — est seul visible en haut à droite. Les sorties de fichier de la page (imprimer, PDF, Word, OpenDocument, CSV, Excel) sont réunies sous un unique bouton « " + b("Exporter") + " », qui les déroule à la demande.",
        b("Lecture d'abord :") + " une fiche se lit — libellés et valeurs, sans champ de saisie. Le bouton « " + b("Modifier") + " » d'un bloc l'ouvre à la saisie ; les blocs secondaires (procédure applicable, valeurs déduites, contrôles conformes) restent repliés jusqu'à ce qu'on les ouvre.",
        b("Pages longues :") + " au-delà de deux écrans, un sommaire collant reste sous le haut de la fenêtre et mène d'un clic à chaque partie de la page.",
        b("Commandes à portée :") + " la barre de navigation, elle, ne quitte pas le haut de la fenêtre. Quand l'en-tête a défilé hors de vue, « " + b("Nouvelle affaire") + " » et votre identité (nom, rôle) prennent place sur la barre, sur la même ligne que les onglets et à leur droite — les deux commandes dont on se sert à tout moment. Sur un écran étroit, ou quand les onglets remplissent déjà la ligne, elles passent sur la ligne suivante plutôt que de comprimer les onglets. Le sommaire d'une page longue se cale sous elle, jamais devant. Il en va de même dans un widget de document Grist.",
        b("Recherche :") + " chaque liste maîtresse dispose de sa propre zone de recherche, qui filtre à la frappe.",
        b("Listes déroulantes :") + " un menu qui porte beaucoup de valeurs — personnes, affaires, sections, trames — s'ouvre avec une " + b("recherche") + " : tapez quelques lettres, la liste se réduit, et les accents comme la casse sont ignorés (« eleve dupre » trouve « Élève DUPRÉ »). Les flèches désignent une valeur, " + k("Entrée") + " la retient, " + k("Échap") + " referme sans rien changer. Sous une douzaine de valeurs, le menu reste un menu ordinaire.",
      ])}
      ${p("Vos données sont conservées dans le navigateur tant que l'outil n'est pas connecté à un document Grist. Pensez à " + b("Réglages › Données › Exporter") + " pour garder une sauvegarde.")}
      ${p("Ouvert comme widget dans un document Grist, l'outil affiche d'abord un court écran d'attente — « " + b("Connexion au document Grist…") + " » — le temps de lire le document. Aucune donnée n'est montrée avant que le document ait répondu : ni sections, ni affaires, ni logos, afin de ne pas laisser croire un instant que le document contient autre chose que ce qu'il contient.")}
      ${p("Toujours dans le document Grist, les tables de l'outil sont créées sous le préfixe " + b("GristHidden_") + " : Grist les retire de son interface — elles n'apparaissent ni dans le sélecteur de widgets, ni dans « Données brutes », ni dans la barre d'onglets. Le document sert de base de données, l'outil en est l'interface : c'est ici que les dossiers se saisissent et se consultent, avec les contrôles de régularité et les documents qui vont avec. Les tables d'un document constitué avant cette règle sont renommées automatiquement à la première liaison, sans qu'aucune donnée ne soit déplacée.")}
    `,
  },
  {
    title: "Vos données ne quittent pas le document",
    iconName: "lock-line",
    body: `
      ${p("L'outil travaille en local : les dossiers sont lus, contrôlés, calculés et générés dans le navigateur. Il n'existe aucun serveur de l'outil, aucun compte à créer, aucun envoi vers l'extérieur.")}
      ${ul([
        b("Dans un document Grist :") + " la lecture et l'écriture passent par l'API de widget du document, donc <strong>à l'intérieur du document</strong>. L'outil ne s'adresse jamais directement au serveur Grist, et rien n'en sort.",
        b("En mode autonome :") + " les données restent dans le stockage du navigateur (sur ce poste) et n'en sortent que par un export de fichier que vous déclenchez.",
        b("Ce qui vient d'Internet :") + " seulement du code — la feuille de style du Système de design de l'État, et, à la demande, quelques bibliothèques de lecture ou d'export (document Grist, classeur, PDF, Word, OpenDocument). Ce sont des téléchargements, jamais des envois : aucune requête ne transporte de donnée.",
        b("Le journal de diagnostic") + " (Réglages › Données) est mis en forme pour être copié ; il ne part que si vous le copiez vous-même.",
      ])}
      ${p("Un point de vigilance : si une donnée cite une <strong>adresse d'image</strong> (" + k("https://…") + ") — le logo d'une section, par exemple — c'est le navigateur qui va la chercher chez son hébergeur. Déposez plutôt le fichier : il est alors conservé dans le document, et plus aucun appel extérieur n'a lieu. Les images du bloc-marque de l'État, elles, sont embarquées dans l'outil.")}
      ${p("Enfin, l'outil n'installe ni cookie ni traceur et ne mesure aucune audience.")}
    `,
  },
  {
    title: "Exporter les listes et les données (CSV, Excel)",
    iconName: "download-line",
    body: `
      ${p("Chaque liste de l'outil — affaires, décisions, séances, documents, personnes, secrétaires, sections, trames, catalogues — se télécharge dans un tableur : les boutons « " + b("CSV") + " » et « " + b("Excel (.xlsx)") + " » sont réunis sous le bouton " + b("Exporter") + " de l'en-tête de la page, ou dans le menu du panneau qui porte la liste.")}
      ${ul([
        b("Ce qui s'affiche est ce qui part :") + " l'export emporte les lignes montrées, dans leur ordre — filtres, recherche, périmètre de visibilité compris. Une liste filtrée donne un fichier filtré ; une liste vide n'a pas de bouton.",
        b("Des libellés, pas des identifiants :") + " une référence s'exporte par ce qu'elle désigne (la personne mise en cause, l'intitulé de la section, le numéro et le nom de l'affaire), et une colonne calculée par sa valeur. Un tableur n'aurait rien à faire d'un numéro interne.",
        b("CSV :") + " un fichier par liste, champs séparés par des points-virgules, encodé en UTF-8 avec marque d'ordre des octets — il s'ouvre directement dans un tableur configuré en français.",
        b("Excel (.xlsx) :") + " un classeur, avec un filtre automatique sur la ligne d'en-tête et des colonnes dimensionnées. La bibliothèque qui écrit les classeurs (SheetJS) est téléchargée à la demande, comme celle qui les lit.",
        b("Échéances :") + " la page " + b("Calendrier") + " exporte la liste complète des échéances du périmètre courant — la grille du mois, elle, les tronque.",
        b("Rapport d'activité :") + " la page " + b("Tableau de bord › Rapport d'activité") + " exporte ses tableaux d'indicateurs en CSV ou en Excel, tous ensemble (« Tous les tableaux ») ou l'un après l'autre, et ses graphiques en images PNG.",
        b("Toute la base :") + " " + b("Réglages › Données") + " exporte un classeur d'une feuille par table, ou une archive d'un fichier CSV par table, et chaque table séparément par la colonne « Export » du tableau des décomptes. L'export " + b("JSON") + ", lui, reste la sauvegarde complète, réimportable à l'identique.",
      ])}
      ${p("Un export de liste ne modifie rien : il lit la base et produit un fichier sur votre poste.")}
    `,
  },
  {
    title: "Les procédures disciplinaires",
    iconName: "scales-3-line",
    body: `
      ${p("L'outil ne fait pas choisir la procédure affaire par affaire : elle se déduit de trois colonnes de la section, réglées dans " + b("Réglages › Sections et membres") + ".")}
      ${ul([
        b("Le public") + " commande la procédure : les usagers relèvent des articles R.811-11 et suivants du code de l'éducation, les enseignants-chercheurs des articles R.712-9 et suivants.",
        b("La tutelle") + " commande la composition des organes : le code de l'éducation fixe celle des établissements relevant du ministère chargé de l'enseignement supérieur (R.811-14 pour les usagers, R.712-13 pour les enseignants-chercheurs), le code rural et de la pêche maritime celle des établissements d'enseignement supérieur agricole (R.812-24-3 et R.812-24-9). La procédure suivie reste celle du code de l'éducation dans les deux cas : le code rural y renvoie expressément.",
        b("Le type de section") + " distingue la section d'établissement, la section d'école interne, la section commune à plusieurs établissements, et la " + b("section disciplinaire académique") + " — la section commune que le recteur de région académique réunit pour les faits graves ou sensibles, présidée par un magistrat de l'ordre administratif (R.811-43 à R.811-50). Il dit aussi auprès de quel conseil la section est instituée, et donc le nom de l'" + b("organe compétent") + " : le conseil académique de l'établissement, le conseil d'administration dans un établissement agricole, et le " + b("conseil de l'école interne") + " pour une section d'école interne.",
      ])}
      ${p("De ces trois colonnes découlent, sans autre réglage : le nom de l'onglet de composition (« Commission », « Instruction » ou « Section »), les rôles proposés (rapporteur adjoint d'un côté, commission d'instruction de deux membres de l'autre), les sanctions et motifs offerts, les délais contrôlés et la voie de traitement.")}
      ${p("Les cinq procédures que l'outil sait conduire sont détaillées ci-dessous. Les mêmes explications, calculées pour la section concernée, s'affichent dans " + b("Réglages › Sections et membres") + " et dans l'onglet " + b("Synthèse") + " de chaque affaire ; les contrôles de régularité s'en servent pour vérifier la composition, les délais et la prescription.")}
      ${proceduresAccordions()}
    `,
  },
  {
    title: "Rôles et permissions",
    iconName: "lock-line",
    body: `
      ${p("L'outil suit les droits du document Grist qui l'héberge : chacun ne peut faire que ce que son rôle autorise. Le rôle et le nom apparaissent en haut à droite de chaque page.")}
      ${p("À côté de ce bloc, une commande d'affichage reste accessible à tous, y compris en lecture seule : le " + b("passage en plein écran") + ".")}
      ${p("Le " + b("thème clair ou sombre") + " suit celui du document Grist : le sélecteur de l'en-tête disparaît alors, pour ne pas régler deux fois la même chose. Hors Grist, il reste proposé et suit le réglage de votre système tant que vous n'avez rien choisi ; votre choix est ensuite mémorisé dans ce navigateur.")}
      ${ul([
        b("Administrateur") + " — propriétaire du document. Accès complet, y compris aux Réglages (sections, secrétaires, destinataires, trames, données) et à l'écriture dans toutes les tables.",
        b("Secrétaire") + " — éditeur du document. Saisie et suivi des affaires, séances, décisions et documents ; la page Réglages est réservée aux propriétaires.",
        b("Visiteur") + " — lecture seule. Les affaires, séances, documents et décisions restent consultables, imprimables et exportables, mais aucune donnée ne peut être modifiée.",
      ])}
      ${p("Propriétaires et éditeurs sont inscrits automatiquement dans la liste des " + b("Secrétaires") + " dès leur première visite, afin de pouvoir suivre les affaires et signer les courriers.")}
      ${p(b("Périmètre des affaires"))}
      ${p("Un espace partagé n'oblige pas à parcourir les dossiers de ses collègues : " + b("par défaut, chacun ne voit que les affaires qui lui sont attribuées") + " — celles dont la colonne « Secrétaire » désigne sa fiche. Le périmètre s'applique partout où des affaires apparaissent : liste des affaires, registre des décisions, rôles de séance, documents, listes déroulantes, tableau de bord et listes imprimées.")}
      ${ul([
        b("Un secrétaire") + " n'a pas à choisir : l'outil le lui dit en tête de liste plutôt que de le laisser chercher une affaire absente.",
        b("Un propriétaire") + " décide de sa propre vue : un sélecteur « Périmètre » en tête de la liste des affaires bascule entre « Mes affaires » et « Toutes les affaires », et son choix est mémorisé dans ce navigateur. Une affaire sans secrétaire n'apparaît donc pas chez les secrétaires : c'est la vue « Attribution des affaires » qui la leur confie.",
        b("Une personne sans fiche secrétaire") + " (visiteur non identifié, table des secrétaires vide) voit tout le document : mieux vaut montrer trop que laisser quelqu'un devant un outil vide.",
      ])}
      ${p("C'est un " + b("confort de travail, pas une protection") + " : les données restent dans le document Grist, et seules les règles de partage de Grist en limitent réellement l'accès. Le filtre porte sur l'affichage ; les formules, les trames et les documents continuent de voir l'ensemble de la base, sans quoi les lettres et les totaux seraient faux.")}
      ${p("Hors Grist — site autonome ouvert directement dans un navigateur — vous êtes administrateur de votre propre base.")}
      ${p("Si l'outil n'arrive pas à lire le document, un " + b("bandeau") + " le signale en tête de page, avec le geste à faire (installer la structure, accorder l'accès complet au widget, réessayer la liaison). Tant que ce bandeau est affiché, les modifications restent dans le navigateur et n'atteignent pas le document. Les détails techniques (adresse de l'API du widget, écritures actives ou non, dernière erreur) figurent dans " + b("Réglages › Données › Diagnostic") + ".")}
      ${p("L'outil ne charge le script du widget que depuis une origine autorisée : les instances publiques (" + k("docs.getgrist.com") + ") et l'instance souveraine de l'État (" + k("grist.numerique.gouv.fr") + ") sont reconnues sans réglage. Pour une instance " + b("auto-hébergée") + ", déclarez son adresse dans " + b("Réglages › Données › Serveur Grist déclaré") + " : sans elle, le widget reste sur son écran d'attente. Le diagnostic affiche l'origine de la page appelante et les origines autorisées, ce qui permet de comprendre pourquoi un widget ne se connecte pas.")}
    `,
  },
  {
    title: "Tableau de bord",
    iconName: "dashboard-3-line",
    body: `
      ${p("Page d'accueil, en deux volets : la " + b("Synthèse") + " répond à « où en est-on ? », le " + b("Rapport d'activité") + " à « qu'a fait la section cette année ? ». Une barre de sous-navigation, sous le titre, passe de l'un à l'autre — et le lien d'accueil de l'en-tête ramène à la synthèse.")}
      ${p(b("Synthèse"))}
      ${ul([
        b("Indicateurs") + " — affaires suivies, affaires à instruire (en cours et sans décision), séances à venir, décisions rendues, délai moyen de traitement, et, tant qu'il en reste, « Dossiers à déclarer » (affaires en cours dont le dossier de pièces n'a pas encore d'adresse). Chaque indicateur est cliquable et mène à la page correspondante.",
        b("Clôtures d'instruction") + " — les affaires dont l'instruction est bornée dans le temps, de la plus proche échéance à la plus lointaine : la date butoir d'instruction que porte une pièce de l'affaire (elle prime sur l'échéance de la procédure), les jours restants, et un filet coloré à gauche, qui vire à l'ambre quand le terme approche et au rouge quand il est dépassé. Chaque ligne ouvre l'affaire. Le panneau ne se montre que lorsqu'une date est fixée.",
        b("Actions rapides") + " — quatre raccourcis, et rien de plus : nouvelle affaire, répartir les affaires (lorsqu'il en reste sans secrétaire), rechercher une décision, planifier une séance. Les cartes d'action de la page d'accueil du tableau de bord redisait ce que portent déjà l'en-tête, le menu latéral et les panneaux.",
        b("Affaires à traiter") + " — les huit affaires non clôturées les plus anciennes, avec leur ancienneté en jours ; au-delà de 180 jours l'ancienneté s'affiche en rouge. Cliquez une ligne pour ouvrir l'affaire, ou sur « Voir les affaires en cours » pour les consulter toutes.",
        b("Prochaines séances") + " — les séances à venir, avec le nombre d'affaires inscrites à chacune.",
        b("Répartition par état") + " — les affaires suivies, par état, dans un graphique en barres ; il se tient à côté du tableau des affaires à traiter, dans le même bloc.",
      ])}
    `,
  },
  {
    title: "Rapport d'activité",
    iconName: "bar-chart-line",
    body: `
      ${p("Le rapport se lit " + b("par période") + " : un sélecteur en tête de page choisit l'année — la dernière connue par défaut — ou « toutes les années ». Une affaire compte à sa " + b("date de saisine") + ", une décision à sa " + b("date de délibéré") + " : une affaire reçue en 2025 et jugée en 2026 est une affaire de 2025 et une décision de 2026. C'est une pièce qu'on présente, qu'on imprime et qu'on annexe.")}
      ${p("Une " + b("barre de sommaire") + " reste collée sous le haut de la fenêtre : elle mène d'un clic aux chiffres clés, aux graphiques, aux tableaux ou à l'impression, et " + b("bascule la vue") + " entre « Graphiques » et « Tableaux » — les mêmes données ne sont plus montrées deux fois de suite.")}
      ${ul([
        b("Chiffres clés") + " — affaires reçues, décisions rendues, délai moyen et délai médian de traitement, taux de clôture, affaires en cours, séances et affaires inscrites au rôle, recours introduits.",
        b("Graphiques") + " — camemberts (répartitions), anneaux (sanctions par groupe), barres (classements) et colonnes (l'activité mois par mois) : régime, voie de traitement, état, section, composante, type de section, motifs, sursis, nature des décisions, textes notifiés, délais de traitement, recours. Chacun propose son image " + b("PNG") + " au survol de sa carte, sur fond blanc, titre compris, prête à coller dans un rapport ; « Exporter les graphiques (PNG) » les rassemble toutes dans une archive ZIP.",
        b("Tableaux d'indicateurs") + " — les mêmes chiffres en tableaux, rangés par domaine (activité, affaires reçues, décisions, séances, recours). Chaque domaine se replie et s'ouvre d'un clic ; chaque tableau s'exporte en " + b("CSV") + " ou en " + b("Excel (.xlsx)") + ", ou tous ensemble (« Tous les tableaux » : un classeur d'une feuille par tableau, ou une archive d'un CSV par tableau).",
        b("Imprimer") + " — le bouton " + b("Exporter") + " de l'en-tête propose « Imprimer le rapport », ou l'export PDF, Word ou OpenDocument : le même contenu mis en page, en-tête de la section compris, graphiques et tableaux compris.",
      ])}
      ${p("Un indicateur sans donnée n'est pas affiché, plutôt que d'afficher un zéro qui ferait croire à une absence d'activité. Le périmètre des affaires s'applique comme partout : le rapport d'un secrétaire est celui de ses affaires, et le rapport suit la période choisie comme les filtres de l'écran.")}
    `,
  },
  {
    title: "Affaires",
    iconName: "folder-2-line",
    body: `
      ${p("C'est la page principale : un dossier se traite entièrement ici, de la saisine aux courriers.")}
      ${ul([
        b("Colonne de gauche") + " — la liste des affaires, filtrable par recherche (numéro, nom, INE, motif), par état et par section. Le nombre en rouge, après la date, est l'ancienneté de la saisine en jours. Une affaire dont l'instruction est bornée dans le temps y porte sa date de clôture en étiquette — " + esc("Clôture le 12 septembre 2026") + " — et un filet coloré à sa gauche, au ton de ce qu'il reste à courir.",
        b("Périmètre") + " — la liste ne montre que les affaires attribuées à la personne connectée (voir « Rôles et permissions » et « Attribution des affaires »). Un propriétaire dispose en plus d'un sélecteur « Mes affaires / Toutes les affaires » et d'un bouton « Voir toutes les affaires » ; la liste rappelle le périmètre en vigueur.",
        b("Bandeau d'avancement") + " — les étapes de la procédure (" + esc("Pré-enregistrée, Enregistrée, Instruction, Examen, Terminée") + "). Cliquez une étape pour y placer l'affaire ; les étapes franchies apparaissent cochées. Une affaire menée par la voie de l'article R.811-40 suit le même cheminement, " + b("privé de l'étape « Instruction »") + " : le bandeau s'adapte à la voie. L'issue de clôture (" + esc("Classé sans suite") + ") s'applique avec le bouton situé à droite du bandeau.",
        b("Nouvelle affaire") + " — un formulaire en deux étapes : identité du mis en cause, puis saisine (numéro, date, section, motif). Le numéro est prérempli à partir de l'acronyme de la section. Pour un secrétaire, l'affaire lui est " + b("attribuée d'office") + " : le champ « Secrétaire » ne lui est pas proposé à la saisie.",
        b("Imprimer la liste") + " — le menu " + b("Exporter") + " de l'en-tête de page propose d'imprimer la liste filtrée des affaires, ou de la télécharger en PDF, en Word (.docx) ou en OpenDocument (.odt) ; les entrées « CSV » et « Excel (.xlsx) » du même menu téléchargent la même liste pour un tableur, avec une colonne par information (voir « Exporter les listes et les données »).",
      ])}
      ${p(b("Les six onglets d'une affaire"))}
      ${ul([
        b("Synthèse") + " — la vue d'ensemble du dossier. Le " + b("dossier de pièces") + " — l'adresse de l'espace où les pièces sont tenues, " + b("hors de l'outil") + " — se déclare depuis le " + b("bandeau de l'affaire") + ", visible sur tous ses onglets : « " + b("Ouvrir le dossier") + " » y ouvre l'adresse déclarée dans un nouvel onglet, « " + b("Déclarer le dossier") + " » recueille l'adresse tant qu'elle manque (le schéma " + k("https://") + " peut être omis). Tant que l'adresse n'est pas renseignée, les contrôles de régularité le rappellent et le tableau de bord compte les « Dossiers à déclarer ». La " + b("fiche de l'affaire") + " regroupe, en quatre blocs, tout ce qui se saisit — dossier de pièces ; saisine, instruction et suivi ; faits et motifs ; convocation et séance —, et chaque bloc se " + b("lit d'abord") + " : libellés et valeurs, sans champ de saisie, jusqu'à ce que le bouton " + b("Modifier") + " l'ouvre à la correction. À droite, les " + b("valeurs déduites") + " — ce que l'outil calcule à partir de la saisine, de la composition et des actes (organe compétent, formation, présidence, rapporteur, décision, durée d'instruction) —, les " + b("contrôles de régularité") + " (seuls les points à corriger sont dépliés, les points conformes se replient en une ligne) et les " + b("contacts") + " de la formation. Le " + b("rappel de la procédure applicable") + ", calculé pour la section, est replié en bas de l'onglet. Le bouton « Écrire aux membres » ouvre un brouillon de courrier à toute la commission — son président, ses rapporteurs et ceux qui y siègent —, et les boutons voisins permettent de n'écrire qu'au président de la commission ou qu'aux rapporteurs.",
        b("Commission") + ", " + b("Instruction") + " ou " + b("Section") + " — l'onglet porte le nom de l'organe qui se prononce : commission de discipline pour les usagers, commission d'instruction pour les enseignants-chercheurs, la section elle-même devant la section disciplinaire académique. Choisissez les intervenants parmi les membres de la section — la liste ne propose qu'eux, filtrés selon la section de l'affaire et leur présence en fonction — et précisez leur rôle. La colonne " + b("Collège") + " rappelle, pour chaque intervenant, le collège de sa fiche de membre — c'est par collège que la composition se lit, et c'est dans « Réglages › Membres » qu'elle se renseigne, non ici —, et la liste les groupe de même, pour que l'on sache qui est usager et qui est enseignant-chercheur sans avoir à le demander. Un enseignant-chercheur de l'établissement qui n'est pas élu à la section — le rapporteur pris hors de la section, par exemple — se décide explicitement : le bouton " + b("Ajouter une personne hors section") + " ouvre une ligne déjà marquée, où le nom s'écrit librement. La qualité d'un intervenant suit ainsi sa source — un membre de la section, ou une personne hors section —, sans être à ressaisir.",
        b("Personnes") + " — la personne mise en cause, reliée à sa fiche du répertoire commun (identité, coordonnées, INE, corps ou formation suivie, et composante — facultative : elle ne sert qu'à suivre, si on le souhaite, l'origine des mis en cause), puis les autres personnes du dossier : victimes, témoins, co-mis en cause, défenseur, représentant légal. Chaque fiche est partagée par toutes les affaires de la personne : la corriger ici la met à jour partout.",
        b("Séance d'examen") + " — l'affectation de l'affaire à une séance et son heure de passage, avec le type de réunion et les coordonnées de la séance. Le rôle complet vit dans la page « Séances » : l'onglet n'en montre que les trois premières affaires, avec un lien « Voir le rôle complet » — sans quoi la même liste se lisait deux fois, à deux endroits.",
        b("Documents") + " — les courriers de l'affaire : choisissez une trame, rédigez le texte, puis imprimez ou exportez l'aperçu (PDF, Word, OpenDocument). L'auteur et le destinataire y sont déjà — ils sont programmés sur la trame. C'est aussi là que se produit le " + b("rapport d'instruction") + ", une pièce comme une autre (trame « Rapport d'instruction ») : s'il a été saisi autrefois dans l'ancien champ de l'affaire, un panneau propose de " + b("reprendre ce texte dans un document") + ", puis l'ancien champ disparaît. Un document de format " + b("ordonnance") + " est un " + b("acte préparatoire") + " : il règle la marche de l'instance, ne rédige aucune décision et ne se lie donc à aucune. Un document de format " + b("décision") + ", lui, rédige une décision de la formation de jugement — la " + b("décision définitive") + ", qui tranche le fond et n'existe qu'une fois, ou une " + b("décision avant dire droit") + ", que l'affaire peut porter en nombre : elle se saisit une seule fois, ici ou dans l'onglet « Décision », et alimente l'un comme l'autre.",
        b("Décision") + " — la décision rendue : sa " + b("nature") + " (sanction, issue de procédure ou décision interlocutoire), sa sanction prise dans le catalogue, sa motivation, ses dates, sa durée et son sursis, ses effets calculés (terme, statut, délai de traitement) et les " + b("recours") + " formés contre elle. Une affaire ne comporte qu'" + b("une seule décision définitive") + " — celle qui tranche le fond. Les mesures qui ne règlent que la marche de l'instance (report de l'examen, supplément d'instruction, expertise, audition de témoins) se saisissent à part, par « Ajouter une décision avant dire droit » : elles peuvent être plusieurs, et ne prononcent aucune sanction. La trame « Décision définitive » en reprend les champs : ce qui est saisi ici se retrouve dans le document, sans double saisie. C'est aussi de cet onglet que la décision se " + b("rédige") + " — le bouton " + b("Rédiger la décision") + " ouvre l'atelier, en créant le texte s'il n'existe pas encore, sur la décision définitive comme sur chacune de ses décisions avant dire droit ; c'est le même atelier que celui du registre des décisions. Seule une décision prononçant une " + b("sanction") + " ou l'" + b("abandon des poursuites") + " peut faire l'objet d'un recours : un classement, une relaxe, une décision avant dire droit ou une ordonnance n'en ouvrent aucun, et aucun délai ne court contre elles.",
      ])}
      ${p(b("L'échéance d'instruction") + " — l'instruction dure un temps compté : deux mois devant une section compétente à l'égard des usagers, quatre mois devant une section d'enseignants-chercheurs, à compter de la " + b("décision de désignation") + " qui l'ouvre. La " + b("date butoir d'instruction") + " que porte une pièce de l'affaire — la désignation, un complément ou un supplément d'instruction, le rapport, ou une décision avant dire droit qui reporte le terme — " + b("prime") + " sur ce délai, qu'elle l'avance ou qu'elle le recule : c'est le terme que l'acte fixe. Le bandeau, en tête de l'affaire, dit la date, ce qu'il reste à courir et ce qui l'a fixée ; l'affaire porte la même date en étiquette dans la liste des affaires (avec un filet coloré) et dans le panneau « Clôtures d'instruction » du tableau de bord.")}
      ${p(b("Joindre des affaires") + " — plusieurs affaires, chacune avec son numéro, peuvent être jugées par une " + b("même décision") + ". Dans l'onglet « Décision », le bouton « Joindre une affaire… » propose les affaires de la même section — une même formation les jugera — qui ne sont encore jointes à aucune. L'affaire d'où l'on part devient l'" + b("affaire de tête") + " : c'est elle qui porte la décision commune, et c'est la sienne que les autres lisent. Chaque affaire garde son numéro, sa personne mise en cause et ses propres courriers, de sorte qu'une notification parte pour chacune. La jonction se défait à tout moment — en déjoignant une affaire, en changeant l'affaire de tête, ou en défaisant le groupe : rien n'est fusionné, rien n'est supprimé, la décision reste attachée à l'affaire qui la porte, et les affaires peuvent être jointes à nouveau.")}
      ${p("Les contrôles de régularité, en tête de la synthèse, vérifient l'affaire à partir de ses dates, de sa section et du paramétrage : " + b("composition réglementaire") + " de la formation (effectif attendu selon le grade de la personne poursuivie, quota des usagers, présence d'un magistrat devant la section académique), présidence et instruction désignées, mandats des membres, voie de traitement, délai minimal de convocation, " + b("prescription") + " — qui ne concerne que les personnels —, accusé de réception d'une notification recommandée et délai de recours. Ils vérifient aussi les " + b("actes rendus") + " : que l'ordonnance ou la décision porte ses visas, que la lettre de notification — qui ne porte que sur une décision de la formation de jugement — ne soit pas préparée sans elle, et qu'aucun recours ne soit formé contre une décision qui n'en ouvre pas — seules une sanction et l'abandon des poursuites peuvent être contestés, ni une décision avant dire droit ni un classement ni une relaxe, pas plus qu'une ordonnance. Chaque point est conforme, à corriger — une donnée manque ou une règle paraît méconnue — ou signalé pour information. Ces contrôles sont " + b("indicatifs") + " : ils signalent, ils ne bloquent rien. Les seuils appliqués se règlent dans " + b("Réglages › Catalogues et délais") + ". Là où des affaires sont jointes, ils vérifient en outre qu'elles relèvent de la même section et qu'une seule décision tranche le fond pour l'ensemble.")}
      ${p("Le bouton " + b("Supprimer l'affaire") + " se trouve en haut de l'espace de travail, à droite des badges d'état et de public de l'affaire.")}
    `,
  },
  {
    title: "Attribution des affaires",
    iconName: "arrow-left-right-line",
    body: `
      ${p("Le poste de commande de la répartition, réservé aux propriétaires du document. Puisque, par défaut, un secrétaire ne voit que les affaires qui lui sont attribuées, c'est ici que l'on décide qui suit quoi.")}
      ${ul([
        b("Indicateurs") + " — nombre d'affaires, affaires sans secrétaire, affaires attribuées et secrétaires actifs. La tuile « Sans secrétaire » filtre la liste sur les affaires à répartir.",
        b("Filtres") + " — recherche (numéro, nom, INE), section, état et secrétaire — dont une entrée « Sans secrétaire ».",
        b("Ligne par ligne") + " — la colonne « Secrétaire » de chaque ligne est une liste déroulante : le choix attribue aussitôt l'affaire, sans autre validation.",
        b("Par lots") + " — cochez plusieurs affaires (la case de l'en-tête coche toute la liste filtrée) : une barre apparaît alors seulement, avec le secrétaire à leur donner, « Attribuer » et « Retirer l'attribution ». Sans affaire cochée, il n'y a pas de lot, et la barre ne s'affiche pas.",
        b("Exporter la répartition") + " — le bouton " + b("Exporter") + " du panneau « Affaires à répartir » télécharge la liste affichée, avec le secrétaire de chaque affaire.",
        b("Charge de chacun") + " — une ligne de pastilles coiffe le tableau : chaque secrétaire y porte le nombre d'affaires qui lui sont confiées, et « Sans secrétaire » celles qui n'ont pas de titulaire. Cliquez une pastille pour n'afficher que ces affaires ; recliquez-la pour revenir à tout. Les fiches désactivées ou supprimées y figurent, signalées comme telles, afin que leurs affaires ne se perdent pas de vue.",
      ])}
      ${p("Une affaire créée par un secrétaire lui est attribuée d'office ; le champ « Secrétaire » ne lui est pas proposé à la saisie, et la fiche d'une affaire le montre en lecture seule.")}
    `,
  },
  {
    title: "Calendrier",
    iconName: "calendar-check-line",
    body: `
      ${p("Toutes les échéances de la section, dans une grille du mois — et un fichier d'agenda à emporter dans le sien.")}
      ${ul([
        b("Ce qu'on y trouve") + " — la page ne se limite pas aux séances : elle rassemble les échéances des séances et celles des affaires. Séances et heures de passage, envoi des convocations, saisine, terme de l'instruction (la date butoir portée par un document ou une décision avant dire droit prime sur le délai de la procédure), prescription, terme de la sanction, expiration du délai de recours.",
        b("Grille du mois") + " — six semaines, du lundi au dimanche ; les flèches changent de mois et « Aujourd'hui » y ramène. Chaque jour porte ses événements en pastilles, et cliquer un jour ouvre son détail dans un panneau à côté de la grille — la grille tronque, le détail dit tout. Le panneau " + b("À venir") + " rappelle les huit prochaines échéances, et le panneau " + b("Ce mois-ci") + " reprend le ton d'une pastille pour dire sa catégorie — séance, convocation, délai, sanction —, avec le nombre d'échéances du mois.",
        b("Périmètre") + " — vous ne voyez que ce qui vous regarde : un secrétaire suit les affaires qui lui sont confiées, un propriétaire la section entière (voir " + b("Rôles et permissions") + "). L'export suit le même périmètre.",
        b("Exporter") + " — le bouton " + b("Exporter") + " rassemble l'agenda " + k(".ics") + " — à importer dans Outlook, Google Agenda, Thunderbird ou l'Agenda d'Apple — et la liste " + b("CSV") + " / " + b("Excel (.xlsx)") + " des échéances. C'est un instantané des données du moment, recalculé à chaque clic, et le nom du fichier porte celui de la personne, pour que deux exports ne se confondent pas.",
        b("Deux vues") + " — la page a deux vues, que la sous-navigation propose sous son titre : celle-ci, " + b("Échéances") + " (la grille du mois, la liste « À venir » et l'export), et " + b("Séances et rôles") + ", où l'on programme une séance et où l'on compose son rôle (voir « Séances »). Elle a sa place dans le menu principal, sous " + b("Calendrier") + " ; la tuile " + b("Échéances à venir") + " du tableau de bord y mène d'un clic. Les anciennes adresses " + k("#seances") + " et " + k("#seances/calendrier") + " continuent d'ouvrir la vue qui leur correspond.",
      ])}
      ${p("L'outil n'héberge pourtant pas d'agenda : affiché dans un document Grist, il n'est joignable que depuis ce document, et un abonnement à un flux censé rester en ligne n'y fonctionnerait pas. Il produit donc des fichiers que chacun importe, plutôt qu'un calendrier partagé.")}
    `,
  },
  {
    title: "Séances",
    iconName: "calendar-line",
    body: `
      ${p("Préparer une séance et son rôle, puis convoquer les parties.")}
      ${p("C'est la seconde vue de la page " + b("Calendrier") + " : la séance est un rendez-vous parmi les échéances, et c'est ici qu'on la programme. La première vue, " + b("Échéances") + ", montre toutes les échéances dans la grille du mois.")}
      ${ul([
        b("Colonne de gauche") + " — les séances de la section choisie, de la plus récente à la plus ancienne. Un sélecteur de section apparaît lorsqu'il existe plusieurs sections. Le menu « Exporter » de l'en-tête télécharge cette liste, en CSV ou en classeur Excel.",
        b("Créer une séance") + " — ouvre une nouvelle séance, à compléter ensuite.",
        b("Organisation") + " — type de réunion (séance d'examen, réunion d'instruction, audition, entretien disciplinaire R.811-40), date, salle, adresse et lien de visioconférence.",
        b("Convocation") + " — rappel des coordonnées de la section (siège, secrétariat, courriel), prêtes à recopier dans la convocation.",
        b("Rôle de la séance") + " — les affaires inscrites avec leur heure de passage, dans l'ordre de passage. Vous pouvez modifier l'heure directement dans le tableau, retirer une affaire du rôle, ou en inscrire une nouvelle parmi les affaires de la section qui ne sont affectées à aucune séance. Chaque ligne rappelle le " + b("dossier de pièces") + " : un bouton ouvre l'adresse déclarée, et un avertissement signale les affaires dont l'adresse manque encore.",
      ])}
      ${p("Le bouton " + b("Imprimer le rôle") + " produit la liste ordonnée des passages de la journée, à distribuer aux membres de la formation ; il figure en tête du panneau du rôle, et dans le menu " + b("Exporter") + " de la page, avec " + b("PDF") + ", " + b("Word (.docx)") + " et " + b("OpenDocument (.odt)") + ", qui téléchargent le même document dans le format choisi — et, pour la liste des séances, " + b("CSV") + " et " + b("Excel (.xlsx)") + ". Toutes les sorties d'une page se replient ainsi sous un seul bouton, comme sur le calendrier, les affaires et les documents.")}
    `,
  },
  {
    title: "Documents",
    iconName: "printer-line",
    body: `
      ${p("Les courriers et décisions, rangés par affaire : une affaire, un dossier.")}
      ${ul([
        b("Les dossiers") + " — un dossier par affaire, dans l'ordre de la liste des affaires. Seuls les dossiers " + b("qui contiennent des documents") + " s'affichent ; au-delà de six, ils se replient en accordéon, leur en-tête portant le numéro de l'affaire, son nom, son état et le compte de ses pièces. Les affaires sans document ne tiennent plus de dossier vide : elles se résument en une ligne « " + b("N affaires sans document") + " », dépliable, d'où l'on ouvre l'affaire pour en créer un. L'en-tête de la page porte un seul bouton " + b("Nouveau document") + " — l'affaire se choisit dans le formulaire — et le menu " + b("Exporter") + " télécharge la liste des documents affichés, dossiers et filtres compris. La recherche (affaire, destinataire, trame) et les filtres par " + b("trame") + " et par " + b("type de document") + " resserrent les dossiers et ce qu'ils contiennent.",
        b("Une carte de document") + " — les courriers, chacun avec l'action qui le " + b("supprime") + " (l'icône corbeille, au coin de la carte, effacée tant qu'on ne la cherche pas ; la confirmation rappelle que la suppression est définitive). Chaque carte est aussi une adresse : elle ouvre " + b("l'espace de rédaction de ce document") + ", qui ne concerne que lui. La liste et l'éditeur ne se partagent donc plus la page : on rédige avec toute la largeur, et l'adresse d'un document (" + k("#documents/12") + ") se copie, s'ouvre dans un nouvel onglet et se retrouve après un rechargement.",
        b("Espace de rédaction") + " — le cœur de la sous-vue d'un document. Trois onglets regardent le même texte : "
          + b("Rédaction") + " (le texte mis en forme, où chaque variable est une pastille), "
          + b("Balisage") + " (son HTML, celui qui sera enregistré) et "
          + b("Résultat") + " (la feuille A4 telle qu'elle sera imprimée). L'aperçu n'est donc pas un panneau à part : c'est une vue du texte, au même titre que les deux autres. En haut de cette sous-vue, " + b("Supprimer le document") + " supprime le document ouvert.",
        b("À droite, deux outils repliables") + " — les " + b("Paramètres du document") + " (la trame utilisée — les trames proposées correspondent au public de la section —, l'" + b("auteur") + " et le " + b("destinataire") + " que la trame programme, la date du document, une éventuelle date libre ou un champ libre, le choix d'une personne ou d'une institution quand l'affaire en compte plusieurs, et, pour une trame de décision, la décision que ce document rédige) et la palette des " + b("Variables") + ", qui insère la balise choisie à la position du curseur. Chacun se replie d'un clic sur son titre pour rendre sa largeur au texte ; replié, il ne reste qu'un onglet vertical portant son nom. La largeur se partage " + b("au prorata") + " : le texte prend les trois quarts, la colonne d'outils le quart restant, et sur un écran étroit celle-ci passe sous le texte plutôt que de le comprimer. Quand on " + b("fait glisser") + " une variable dans le texte, une barre marque l'endroit exact où elle tombera — le fantôme du geste ne le cache plus. Les paramètres, eux, restent ouverts tant qu'aucune trame n'est choisie : ils sont le seul moyen de la choisir.",
        b("La feuille du document") + " — le courrier s'écrit d'un seul tenant, comme une page : l'en-tête du service, le chapeau et le destinataire que la trame apporte, le texte de la pièce, puis la signature et le pied de page. Rien ne les sépare à l'écran, et tout s'y corrige sur place — une mention, une adresse, une formule. Le document part de la trame ; la première modification le rend propre à ce document, sans toucher à la trame ni aux autres pièces. La barre d'outils ajoute tableaux, images, traits et sauts de page ; quatre menus y règlent, sur le passage sélectionné, la police, la taille, la couleur et le surlignage (le premier choix de chaque menu rend le passage à la mise en forme du document); deux boutons règlent les retraits — décaler tout le paragraphe, ou marquer sa seule première ligne. La touche "
          + b("Tabulation") + " fait les deux à la fois : au début d'un paragraphe elle pose le retrait de première ligne — la marque d'un considérant —, ailleurs elle décale le bloc ; "
          + b("Maj+Tabulation") + " revient en arrière pas à pas, et " + b("Échap") + " fait sortir de la zone d'écriture. Un retrait se compte en centimètres : il se retrouve à l'identique dans l'aperçu, à l'impression, dans le PDF, le Word et l'OpenDocument. Deux commandes apparaissent alors : "
          + b("Figer les valeurs") + " remplace les balises de données par les noms et dates du moment (pour un texte qui ne bougera plus), et "
          + b("Revenir à la trame") + " efface ce que le document a de propre — son texte et sa feuille adaptée — et le document suit de nouveau sa trame, comme avant toute modification.",
        b("Résultat") + " — la feuille A4 du courrier mis en page : les outils s'effacent le temps de la regarder, et reviennent dans les deux autres vues. Quatre boutons la suivent : " + b("Imprimer") + " (ouvre le document prêt à imprimer), " + b("PDF") + ", " + b("Word (.docx)") + " et " + b("OpenDocument (.odt)") + ", qui téléchargent le document dans le format choisi. Les trois fichiers font une page A4, marges de 2 cm, pied de page compris. Quelle que soit la zone où une balise a été déposée — le texte, comme la feuille qui l'entoure — elle est rendue par sa valeur : rien ne s'imprime en « {…} » ni en « {{…}} ». Une " + b("décision définitive") + " propose en plus la case " + b("Export anonyme") + " : cochée, les trois fichiers désignent les personnes du dossier — mis en cause, victimes, témoins — par « A. B. », « B. C. »… dans l'ordre où elles paraissent dans le document, et le nom du fichier perd celui du mis en cause ; les membres de la formation et le secrétaire gardent leur nom, car ce sont eux qui rendent la décision. Une ordonnance et une décision avant dire droit, qui règlent la marche de l'instance sans trancher le fond, n'ont pas cette option.",
        b("Informations reprises") + " — le rappel des valeurs injectées par les balises de la trame.",
      ])}
      ${p("Le " + b("signataire") + " du courrier dépend de l'" + b("auteur") + " que la trame lui donne (Réglages › Trames) : l'autorité ayant engagé les poursuites, le secrétaire, le président de la commission ou de la formation de jugement, ou le président de la section. Lorsque c'est le président de la section, et qu'il est empêché, le vice-président le remplace : cochez « le président est absent » pour une absence brève, et cette pièce seule sera signée par le vice-président. Ce réglage s'ajoute à celui de la section (Réglages › Sections et membres), qui vaut pour toutes ses pièces et qui sert au remplacement durable : dès que l'un des deux l'affirme, le courrier porte le nom du vice-président. Le document dit toujours qui signera, sous la case ; et si le rôle ainsi désigné n'a aucun titulaire dans la section, un avertissement le signale avant l'impression.")}
      ${p("Le même espace de rédaction s'ouvre depuis l'onglet " + b("Documents") + " d'une affaire : un courrier s'y corrige donc d'un clic, sans quitter le dossier où on le lit — et le bouton " + b("Ouvrir l'affaire") + ", en haut de la sous-vue, fait le chemin inverse.")}
      ${p("C'est cet espace de rédaction qui permet de " + b("rédiger la décision définitive dans l'outil") + " : on écrit la motivation, on ajoute un tableau de faits ou un saut de page avant les annexes, et le document s'exporte tel qu'il se lit dans la vue « Résultat ».")}
      ${p("Un " + b("acte rendu") + " — une " + b("décision") + " ou une " + b("ordonnance") + " — reçoit ici les outils du raisonnement : le panneau " + b("Considérants de principe") + ", à droite du texte, où les considérants de principe se cherchent et se glissent, et deux gestes de numérotation — " + b("Numéroter les considérants") + " pose 1., 2., 3.… dans l'ordre du texte, et " + b("Numéroter les articles") + " pose « Article 1er », « Article 2 »… devant les articles du dispositif. Les numéros sont écrits dans le texte : ils restent dans l'impression, le PDF, le Word et l'OpenDocument. L'atelier d'une décision, ouvert depuis le registre des décisions ou depuis l'onglet " + b("Décision") + " de l'affaire par « " + b("Rédiger la décision") + " », porte les mêmes outils, et davantage encore : les formules de visas et de dispositif, les champs de la décision et les contrôles de régularité. Un courrier, une attestation ou un rapport ne portent pas ces outils : ils ne se motivent pas.")}
      ${p("Le " + b("rapport d'instruction") + " se produit ici, comme n'importe quelle pièce : la trame livrée du format « Rapport d'instruction » en donne le plan (exposé des faits et de la procédure, diligences accomplies, observations des parties, analyse et conclusion), et son auteur est le " + b("rapporteur") + " — ou la " + b("commission d'instruction") + " devant les sections d'enseignants-chercheurs. Le rapport n'est donc pas un champ de l'affaire : sa date est celle du document, et son texte vit dans le document. Il n'y a rien à ressaisir : les balises de la trame reprennent l'affaire, la saisine, le motif et la composition de l'instruction. Si l'ancien champ « Rapport d'instruction » d'une affaire porte encore un texte, l'onglet " + b("Documents") + " de cette affaire propose de " + b("le reprendre dans un document") + " ; l'ancien champ est alors vidé.")}
      ${p("Le contenu même des trames se paramètre dans " + b("Réglages › Trames") + ". L'export est également disponible pour le rôle d'une séance (page " + b("Séances") + ") et pour la liste des affaires (page " + b("Affaires") + ").")}
    `,
  },
  {
    title: "Décisions",
    iconName: "scales-3-line",
    body: `
      ${p("Le registre des sanctions prononcées, et leur analyse.")}
      ${ul([
        b("Indicateurs") + " — décisions rendues, décisions encore en cours d'effet, délai moyen de traitement, et le nombre d'origines concernées : les composantes lorsque l'établissement en suit, ses sections disciplinaires sinon. Une section sans composante est comptée pour elle-même — ses affaires ne disparaissent jamais des indicateurs.",
        b("Filtres") + " — recherche libre (INE, nom, numéro d'affaire), décision, et affichage des seules décisions en cours d'effet. Un filtre par origine (composante, ou section à défaut) s'ajoute dès qu'il y a plusieurs origines à distinguer.",
        b("Registre") + " — une ligne par décision : affaire, régime, identifiant (l'INE d'un usager, ou le corps d'un enseignant-chercheur — la colonne est commune aux deux régimes), personne mise en cause, décision notifiée, nature, date de notification, terme, statut et délai — et l'origine (la composante, ou la section de l'affaire) lorsque plusieurs sont à distinguer. Les décisions avant dire droit y figurent sans terme ni délai : elles ne prononcent aucune sanction. La colonne « Délai » ne s'affiche que si on la demande. Cliquez une ligne pour ouvrir " + b("la fiche de la décision") + " dans une sous-vue à son adresse (" + k("#decisions/12") + ") : la liste reste courte, et la décision a la page entière. Le menu " + b("Exporter") + " de l'en-tête du registre en télécharge les lignes affichées.",
        b("Analyse") + " — la répartition des décisions par type, par sanction et par origine n'a pas sa place ici : le " + b("rapport d'activité") + " (Tableau de bord) la produit déjà, et la page y renvoie d'un bouton.",
        b("Registre des actes") + " — la numérotation des décisions et son registre. Le bouton « Numéroter les actes » attribue à chaque décision un numéro d'acte — une séquence par section et par année, par exemple " + k("UDA-2026-001") + ", dans l'ordre chronologique des délibérés. Un numéro n'est jamais réutilisé, même après la suppression de l'acte : la série reste vérifiable, et chaque attribution est inscrite au Journal. Le numéro s'affiche à la colonne « N° d'acte » du registre, et le bouton « Exporter le registre (CSV) » produit la liste des actes numérotés ; un acte sans numéro est signalé, car il ne peut pas être cité par son registre.",
      ])}
      ${p("Le registre distingue la " + b("nature") + " de la décision : une sanction prononcée, une issue de procédure (abandon des poursuites, classement) ou une décision interlocutoire. Les indicateurs d'effet et de terme ne portent que sur les sanctions, et les sursis sont déduits du terme.")}
      ${p("Les décisions se saisissent depuis l'onglet " + b("Décision") + " de l'affaire concernée ; cette page sert à les consulter et à les recenser. Une ligne du registre ouvre " + b("l'atelier de rédaction de la décision") + " : le raisonnement s'y écrit dans son document — visas, considérants glissés depuis le répertoire, dispositif — , avec un aperçu A4 et les mêmes exports que tout document (impression, PDF, Word, OpenDocument). Deux gestes y numérotent le texte d'un coup : " + b("Numéroter les considérants") + " pose 1., 2., 3.… dans l'ordre du texte, sans repartir à chaque intertitre, et " + b("Numéroter les articles") + " pose « Article 1er », « Article 2 »… devant les articles du dispositif. L'onglet " + b("Décision") + " d'une affaire ouvre le même atelier, par « " + b("Rédiger la décision") + " » — sans quitter l'affaire où l'on travaille. Une " + b("décision définitive") + " — une sanction, ou une issue de procédure — peut en outre s'exporter en " + b("version anonyme") + " : les personnes du dossier y sont désignées par « A. B. », « B. C. »… dans l'ordre où elles paraissent, quand les membres de la formation et le secrétaire gardent leur nom — et le nom du fichier le dit. Le détail de l'espace de rédaction est décrit au chapitre « Documents ».")}
    `,
  },
  {
    title: "Réglages",
    iconName: "settings-5-line",
    body: `
      ${p("Onze sous-pages, rangées en trois groupes sous le titre — " + b("Section") + " (sections et membres, personnes, secrétaires, destinataires), " + b("Bibliothèque") + " (catalogues et délais, trames, formats) et " + b("Outil") + " (identité, charte graphique, données, import). Elles sont réservées aux propriétaires du document (rôle Administrateur) : la configuration de l'outil ne se délègue pas aux secrétaires.")}
      ${ul([
        b("Sections et membres") + " — l'identité de chaque section : désignation, " + b("public") + " (usagers ou enseignants-chercheurs), " + b("tutelle") + " (enseignement supérieur ou agriculture) et " + b("type de section") + " (établissement, école interne, section commune, section disciplinaire académique). Ces trois colonnes déterminent la procédure suivie et la composition des organes. Suivent le siège, le secrétariat, le bloc « " + b("Secrétaires rattachés") + " » (les cases à cocher qui attachent les secrétaires à la section — la fiche du secrétaire montre les mêmes sections, sous « Sections suivies », et les deux restent d'accord), l'en-tête des courriers — puis le bloc « " + b("Signature des courriers") + " : le président signe les pièces de la section, et cocher « Vice-Président ? » fait signer le vice-président à sa place, pour un remplacement durable ; l'absence ponctuelle, elle, se déclare sur le document concerné (voir « Documents »). Vient enfin la composition de la section, qui s'édite directement dans le tableau des membres. Le bloc « " + b("Procédure et composition") + " confronte ce que les textes attendent aux membres saisis, puis présente la procédure en trois fiches — organes et quorum, déroulement, prescription et effacement — et recense les " + b("textes de référence") + ", chacun sous l'intitulé de ce qu'il fonde ; le bloc « Explication de la procédure » en donne la version rédigée, pour cette section : organes, instruction, autorités, délais et voies de traitement. Les « Données calculées » regroupent enfin les valeurs déduites, comme l'intitulé complet ou la formule de politesse du président. La composition elle-même peut se saisir en série : « Modèle CSV » produit un fichier d'une ligne par siège attendu, collège et rôle déjà remplis, « Exporter les membres » télécharge la composition actuelle au même format, « Excel (.xlsx) » la télécharge en classeur avec ces mêmes colonnes (le fichier rempli se réimporte donc au même format), et « Importer un CSV » la complète — les membres déjà présents sont reconnus par courriel, les autres créés, et rien n'est supprimé. Les autres réglages (personnes, secrétaires, destinataires, trames, formats, catalogues) se téléchargent aussi en CSV ou en Excel, depuis l'en-tête de leur page ou du panneau qui les porte.",
        b("Personnes") + " — le répertoire commun : une fiche par personne, mise en cause ou non. Les coordonnées y sont saisies une fois pour toutes ; les affaires, les formations et les courriers s'y réfèrent. La fiche rappelle les affaires de la personne et sert à éviter les doublons — une même personne dans deux affaires n'est qu'une seule ligne.",
        b("Secrétaires") + " — les secrétaires qui suivent les affaires et signent les courriers courants ; une secrétaire peut être rattachée à plusieurs sections, et une section à plusieurs secrétaires. Le rattachement se fait par cases à cocher — « " + b("Sections suivies") + " » sur la fiche du secrétaire, « " + b("Secrétaires rattachés") + " » sur celle de la section —, et les deux faces restent toujours d'accord : cocher d'un côté coche de l'autre.",
        b("Destinataires institutionnels") + " — les fiches réutilisables (président d'université, recteur, ministre, autorité de poursuites…) que les trames désignent : le chef d'établissement, l'autorité de tutelle et l'autorité ayant engagé les poursuites s'y résolvent par leur qualité, et la fiche ainsi trouvée fournit le nom, l'adresse, la formule de politesse et la signature du courrier.",
        b("Catalogues et délais") + " — les " + b("sanctions") + " (groupe, régime, tutelle, durée maximale, sursis possible, texte de référence), les " + b("motifs") + " (groupe, régime, tutelle, texte de référence) et les " + b("paramètres") + " : les seuils et durées qu'utilisent les contrôles de régularité et le calcul du terme des sanctions. Ils sont dans les données, pas dans le code : le délai de convocation, celui de l'entretien de l'article R.811-40 et de la réponse à la proposition, le délai de recours ou le délai d'effacement s'y règlent sans toucher à l'outil. La " + b("prescription") + " ne concerne que les personnels, à compter de la connaissance effective des faits. Un quatrième onglet, " + b("Références") + ", réunit les sources citées par le répertoire des considérants — il signale celles qui ne sont pas retrouvables (une identité réduite à « M. X » ne se vérifie pas) et les affirmations à faire viser, et il enregistre la date de la vérification par le service juridique.",
        b("Trames") + " — les modèles de courriers et de décisions. La page est le rangement : une trame par ligne, avec la recherche et le filtre par format, et chaque ligne ouvre " + b("l'espace de rédaction de cette trame") + ", qui ne concerne qu'elle. La liste et l'éditeur ne se partagent donc plus la page : on rédige avec toute la largeur, et l'adresse d'une trame (" + k("#reglages/trames/7") + ") se copie, s'ouvre dans un nouvel onglet et se retrouve après un rechargement. L'espace de rédaction rassemble, dans l'ordre, les " + b("réglages de la trame") + " — nom, format, objet, procédure visée, " + b("auteur") + " et " + b("destinataire") + " (les deux qualités que la rédaction ne choisit plus), décision définitive — puis, comme pour un document, une " + b("seule feuille") + " : la " + b("feuille de style") + " dont elle hérite — en-tête, chapeau, signature, pied de page — et son " + b("corps") + " s'y écrivent d'un seul tenant, séparés seulement par la pastille « Texte de la trame », et tout s'y corrige sur place. Corriger la feuille n'écrit que pour cette trame : la moindre modification en fait une adaptation propre à cette trame, et le bouton « Rétablir la feuille du format » la lui rend. Le corps se rédige en WYSIWYG, comme dans un traitement de texte, et les variables s'y insèrent par glisser-déposer depuis la palette de droite (ou d'un clic, à la position du curseur). Trois vues se partagent l'espace, comme pour un document : « Rédaction », « Balisage » (le HTML) et « Résultat » (le document produit sur une affaire d'exemple). Chaque variable apparaît sous forme de pastille, avec la valeur de l'exemple ; une case à cocher fait basculer l'affichage vers les balises {{…}} elles-mêmes. La barre d'outils ne se limite pas au texte : elle insère des tableaux, des images, des traits de séparation et des sauts de page ; quatre menus y règlent la police, la taille, la couleur et le surlignage du passage sélectionné ; la vue « Balisage » donne accès au HTML de la trame — la palette y insère la balise à la position du curseur. La palette se replie d'un clic sur son titre pour rendre sa largeur au texte. L'aperçu du document, sous l'éditeur, est au format A4 (210 × 297 mm) — comme le document imprimé — et se met à jour à la saisie. Un bouton mène aux documents déjà produits avec cette trame. Le dictionnaire complet des variables reste consultable, repliable, au bas du registre. Les trames livrées avec l'outil sont adaptées à chaque procédure : chaque trame déclare le régime, la tutelle et le type de section qu'elle vise, et n'est donc proposée qu'aux sections concernées. Une trame de décision de la formation de jugement peut en outre être marquée « décision définitive » : ses champs de décision sont alors ceux de l'affaire, si bien que compléter le document ou l'onglet « Décision » revient au même. Les décisions du président — de la section ou de la commission — ne portent pas cette case : elles sont nécessairement avant dire droit, et une affaire en comporte autant que nécessaire. Sur un document installé avant leur arrivée, le bouton « Installer les trames par défaut », au haut de la page, ajoute celles qui manquent, sans dupliquer celles qui existent. Chaque ligne du registre porte une " + b("case à cocher") + " : la barre placée sous les filtres met la sélection à la corbeille, ou toutes les trames affichées ; « Tout sélectionner » ne coche que ce que les filtres laissent à l'écran. Le panneau « " + b("Corbeille") + " », au bas de la page, garde ce qui a été mis de côté : « Restaurer » rend la trame à sa place — elle retrouve les documents qui l'utilisaient —, « Supprimer » l'efface pour de bon, et « Vider la corbeille » efface tout ce qu'elle contient.",
        b("Formats (feuilles de style)") + " — la feuille de style d'un document : un " + b("courrier") + ", une " + b("attestation") + ", un " + b("rapport d'instruction") + ", une " + b("ordonnance") + " (du président de la section disciplinaire ou de celui de la formation de jugement — la commission de discipline, devant les usagers) ou une " + b("décision") + " (de la formation de jugement elle-même). Le format porte " + b("le document entier") + " — l'en-tête du service, le chapeau, la signature et le pied de page répété —, écrit d'un seul tenant, avec l'emplacement où le texte de chaque trame vient s'insérer. C'est lui qui porte aussi les " + b("visas") + " des ordonnances — la formule d'ouverture (« Le président de la section disciplinaire, »), le code de l'éducation, le code rural et de la pêche maritime dans un établissement agricole, et la saisine de la section : une fois pour toutes ses trames, et sous une forme que l'on corrige ici même. Les variables " + k("{ville}") + ", " + k("{destinataire}") + ", " + k("{f_emetteur}") + "… y sont remplacées par les données de l'affaire, et une pastille « Texte de la trame » marque l'emplacement du corps : ce qui la précède est le chapeau du format, ce qui la suit sa signature et son pied de page. Comme pour les trames, la page est le rangement : un format par ligne, avec son organe pour un acte rendu et le nombre de trames qui en héritent, et chaque ligne ouvre l'espace de rédaction de sa feuille de style, qui se rédige en WYSIWYG — l'aperçu A4, sous l'éditeur, se met à jour à la saisie. Un panneau « " + b("En-tête : les deux logos") + " » règle, pour tout le format, la " + b("position") + " du bloc-marque de l'État et du logo de l'établissement — à gauche, au centre, à droite — et leur " + b("taille") + " en millimètres : une seule cote renseignée met l'image à l'échelle en conservant ses proportions, les deux fixent exactement le cadre, et des champs vides gardent les cotes de la charte. Les images elles-mêmes se déposent sur la fiche de la section (Réglages › Sections et membres). Un bouton mène aux trames de ce format. Le format règle aussi le " + b("pied de page") + " de ses documents (Réglages › Formats › « Pagination et pied de page ») : la " + b("numérotation des pages") + " (« Page 3 sur 3 », à droite) et le " + b("numéro de l'affaire") + " (« Dossier n° 26UV-1 », à gauche, sur la même ligne) — utile à une pièce qui se détache de son dossier. Les deux se placent aussi à la main, dans le pied de page de la feuille de style, avec les variables " + k("{page}") + ", " + k("{pages}") + " et " + k("{numero}") + ". Les " + b("titres") + " s'y règlent au menu « Taille » de la barre d'outils, comme partout : un titre est un paragraphe à taille " + b("écrite") + ", et non une balise de titre dont la taille viendrait de la charte sans que personne ne la voie — 14 pt pour le titre d'un document (l'en-tête de service, le mot « DÉCIDE » ou « ORDONNE »), 12 pt, la taille du corps, pour un titre de plan.",
        b("Import des données") + " — la reprise d'un document Grist, d'un classeur, d'un fichier délimité ou d'un export JSON dans le modèle de l'outil : lecture du fichier, affectation des tables, analyse de la source, correspondance des colonnes, puis application. Voir plus bas « Reprendre un tableur existant ».",
        b("Identité") + " — le logo de l'opérateur affiché dans l'en-tête de l'outil, à droite du bloc-marque « République Française » : collez l'adresse d'une image (ou déposez un fichier léger depuis votre poste), donnez-lui une description pour les lecteurs d'écran, et jugez le résultat dans l'aperçu — qui reproduit l'en-tête réel. Champ vide : aucun logo. Ce réglage ne concerne que l'interface de l'outil ; les logos des courriers se règlent section par section, dans « Sections et membres ».",
        b("Charte graphique") + " — la charte portée par l'outil et par ses documents. La « " + b("charte neutre") + " » (le défaut, valeur vide comprise) donne l'interface du Système de design de l'État — mêmes composants, même mise en page — mais " + b("sans la marque de l'État") + ", en " + b("Public Sans") + " à la place de Marianne — une sans-serif contemporaine et très lisible, servie par l'outil, donc la même sur tous les postes —, et avec un " + b("bleu d'action décalé d'un cran") + " : un bleu encre légèrement acier au lieu de l'ultramarine de l'État, écrit aussi dans les courriers. Elle convient aux structures qui ne relèvent pas de la charte de l'État, ou qui n'ont pas le droit d'en afficher la marque. La « " + b("charte de l'État") + " » affiche, elle, le bloc-marque « République Française » et emploie la police Marianne ; elle se demande explicitement, car afficher la marque de l'État est un acte. Le réglage vaut pour l'interface, pour les courriers et les décisions, pour les rôles de séance et les listes imprimées, et pour les fichiers PDF, Word et OpenDocument. La même page règle la " + b("police des documents") + " — un nom installé sur les postes, comme « Times New Roman » — qui remplace la police de la charte dans tous les documents produits ; laissez le champ vide pour la police de la charte. Le PDF fait exception : il joint sa police au fichier, et seules les deux familles des chartes — Public Sans et Marianne — peuvent voyager ainsi ; un autre nom réglé ici vaut pour Word, OpenDocument et l'impression, et le PDF compose alors dans la police de la charte. Ces réglages ne touchent à aucune donnée.",
        b("Données") + " — l'export de la base au format JSON (la sauvegarde complète, réimportable sur un autre poste), en classeur Excel (une feuille par table) ou en archive CSV (un fichier par table), table par table au besoin, puis l'import, la restauration des exemples, la remise à zéro, le journal des opérations et l'état de la connexion à un document Grist. Voir « Exporter les listes et les données ».",
      ])}
    `,
  },
  {
    title: "Reprendre un tableur existant",
    iconName: "upload-line",
    body: `
      ${p("L'outil succède à un tableur Grist tenu à la main ; " + b("Réglages › Import des données") + " en reprend le contenu dans le modèle actuel. L'import se fait en deux temps — une analyse, que vous validez, puis l'écriture — et rien n'est modifié avant cette validation.")}
      ${ul([
        b("1. La source") + " — « Choisir un fichier » accepte le document Grist lui-même (.grist), un classeur (.xlsx, .xls, .ods), un fichier délimité (.csv, .tsv) et un export JSON de l'outil. Un classeur et un document Grist portent plusieurs tables ; un fichier délimité n'en porte qu'une. Lorsque l'outil est ouvert comme widget dans le document, « Lire le document Grist connecté » se passe de fichier.",
        b("2. Les tables du fichier") + " — chaque feuille ou table de la source est rapprochée d'une table du modèle, par son nom puis par ses colonnes. L'écran montre ce rapprochement — colonnes reconnues, colonnes écartées, table visée — et la table visée peut être corrigée ; une feuille laissée de côté n'est pas importée.",
        b("3. L'analyse") + " — l'outil reconnaît l'architecture de la source (celle d'origine, celle de l'outil, ou un mélange des deux) et affiche, table par table, ce qu'il en fera et combien de lignes il a lues.",
        b("4. Les avertissements") + " — les points à savoir avant d'appliquer : colonnes d'identité encore portées par l'affaire, composition de commission reprise en intervenants, texte des trames conservé tel quel, affaires sans nom de personne mise en cause.",
        b("5. Le mode") + " — « Compléter » rapproche chaque ligne reçue d'une ligne existante (numéro d'affaire, courriel, nom…) et n'ajoute que ce qui est nouveau : relancé deux fois, l'import n'ajoute rien la seconde fois. « Remplacer » vide les tables de l'outil avant d'écrire, à réserver à un brouillon ou après une sauvegarde.",
        b("6. Le rapport") + " — ce qui a été créé, ce qui a été rapproché, et les liens que la source ne permettait pas de résoudre (une référence vers une ligne absente, par exemple). L'opération est inscrite au journal (Réglages › Données).",
      ])}
      ${p(b("Ce que la reprise fait de l'ancien document"))}
      ${ul([
        b("L'identité") + " — les colonnes d'état civil de l'affaire (prénom, nom, INE, date de naissance, adresse, formation suivie…) deviennent une fiche du " + b("répertoire des personnes") + ", reliée à l'affaire. La fiche est réutilisée d'une affaire à l'autre.",
        b("La commission") + " — les lignes de la table d'origine deviennent des " + b("intervenants") + " de l'affaire, rattachés aux membres de la section, avec leur rôle.",
        b("La séance") + " — la liste d'affaires portée par les séances est reportée sur les affaires elles-mêmes : un dossier porte désormais sa séance.",
        b("Les colonnes calculées") + " — elles ne sont pas reprises : l'outil les recalcule à partir des données saisies. Le détail figure dans « Correspondance des colonnes », en bas de l'écran d'import.",
      ])}
      ${p("L'import " + b("n'efface rien") + " dans le document d'origine : il ajoute, complète et relie. Une fois la reprise vérifiée, c'est à vous de nettoyer l'ancien document — supprimer la table de commission d'origine et les colonnes devenues inutiles — puis de créer la structure de l'outil si elle manque (« Réglages › Données › Installer la structure »).")}
    `,
  },
];

/**
 * Onglet « Debug » : il n'existe qu'en mode autonome — c'est le mode de
 * développement et de démonstration de l'outil — et disparaît dès que
 * l'application est reliée à un document Grist.
 */
const DEBUG_GUIDE = {
  title: "Debug (mode autonome)",
  iconName: "bug-line",
  body: `
    ${p("Cet onglet n'apparaît " + b("que") + " lorsque l'outil tourne seul, hors Grist : c'est le mode de développement, où il n'y a ni droits de document ni comptes à interroger.")}
    ${ul([
      b("Identité et rôle simulés") + " — forcez le rôle (Administrateur, Secrétaire, Visiteur) et le nom affiché dans l'en-tête, pour vérifier ce que chacun voit : un visiteur obtient une interface entièrement en lecture seule, un secrétaire perd l'accès aux réglages et à la vue « Attribution ». Le champ « Identité simulée » fait en outre endosser la fiche d'un secrétaire : c'est le moyen d'éprouver le périmètre des affaires attribuées.",
      b("État interne") + " — la page, la sous-page et les sélections courantes, telles que l'application les a enregistrées.",
      b("Tables et stockage local") + " — le nombre de lignes par table et le contenu des préférences conservées dans le navigateur, avec de quoi les effacer ou vider entièrement la base locale.",
      b("Actions") + " — recharger la page, restaurer ou vider les données, afficher une notification de test.",
    ])}
    ${p("Le rôle simulé est mémorisé dans le navigateur : rechargez la page pour le vérifier, et repassez par « Administrateur » pour retrouver l'interface complète.")}
  `,
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function viewAide(store, state) {
  const notes = store.table("Presentation");
  const md = notes.map((n) => n.Presentation).filter(Boolean).join("\n\n");
  // La recherche de l'aide porte sur le guide : on cherche « comment faire
  // telle chose », et l'on ne sait pas d'avance quelle page en parle. Les
  // sections qui correspondent s'ouvrent d'elles-mêmes, pour que la réponse
  // soit là sans un clic de plus.
  const q = String(state.filters.aideQ || "").trim();

  const ancres = ui.anchors({
    label: "Sommaire de l'aide",
    items: [
      { label: "Accès directs", hash: "aideRaccourcis" },
      { label: "Prise en main", hash: "aideEtapes" },
      { label: "Guide de l'interface", hash: "aideGuide" },
      { label: "Pour aller plus loin", hash: "aidePlus" },
      { label: "Accessibilité", hash: "aideAccessibilite" },
    ],
  });

  const recherche = `
<div class="app-filters">
  <div class="app-search">
    <label class="fr-label" for="aideQ">Rechercher dans l'aide</label>
    <input class="fr-input" type="search" id="aideQ" data-filter="aideQ"
      value="${esc(q)}" placeholder="Attribution, trames, R.811-40, export…">
  </div>
</div>`;

  const raccourcis = panel("Accès directs", `
    <div class="app-card-grid">
      ${quickCard({ label: "Tableau de bord", description: "L'activité du moment et les affaires à traiter.", iconName: "dashboard-3-line", href: "#tableau-de-bord" })}
      ${quickCard({ label: "Affaires", description: "Le dossier complet d'une affaire, en six onglets.", iconName: "folder-2-line", href: "#affaires" })}
      ${canSettings(state) ? quickCard({ label: "Attribution des affaires", description: "Répartir les affaires entre les secrétaires, au cas par cas ou par lots.", iconName: "arrow-left-right-line", href: "#attribution" }) : ""}
      ${quickCard({ label: "Calendrier", description: "Les échéances de la section, la grille du mois et l'export d'agenda (.ics).", iconName: "calendar-check-line", href: "#calendrier" })}
      ${quickCard({ label: "Séances", description: "Programmer une séance et imprimer son rôle — la seconde vue du calendrier.", iconName: "calendar-line", href: "#calendrier/seances" })}
      ${quickCard({ label: "Documents", description: "Les courriers et décisions, dossier par dossier.", iconName: "printer-line", href: "#documents" })}
      ${quickCard({ label: "Décisions", description: "Le registre des sanctions et leur analyse.", iconName: "scales-3-line", href: "#decisions" })}
      ${quickCard({ label: "Réglages", description: "Sections, secrétaires, destinataires, trames et données.", iconName: "settings-5-line", href: "#reglages" })}
      ${debugAllowed(state) ? quickCard({ label: "Debug", description: "Simuler un rôle, inspecter l'état et le stockage local.", iconName: "bug-line", href: "#debug" }) : ""}
      ${quickCard({ label: "Accessibilité", description: "La déclaration d'accessibilité, le schéma pluriannuel, le point de contact et la voie de recours.", iconName: "information-line", href: "#accessibilite" })}
    </div>
  `, { iconName: "link", id: "aideRaccourcis" });

  const etapes = panel("Prise en main", `
    <ol class="app-steps">
      ${ETAPES.map((e) => `
      <li class="app-steps__item">
        <a class="app-steps__link" href="${esc(e.href)}" data-nav="${esc(e.href.replace(/^#/, ""))}">
          <span class="app-steps__title">${ui.icon(e.iconName, 'class="fr-mr-1v"')}${esc(e.label)}</span>
          <span class="app-steps__text">${esc(e.text)}</span>
        </a>
      </li>`).join("")}
    </ol>
  `, { iconName: "road-map-line", subtitle: "Le circuit complet d'une affaire, de la saisine aux courriers", id: "aideEtapes" });

  const tousLesGuides = debugAllowed(state) ? [...GUIDE, DEBUG_GUIDE] : GUIDE;
  const guideItems = q
    ? tousLesGuides.filter((g) => matches(q, g.title, g.body))
    : tousLesGuides;
  const guide = panel("Guide de l'interface", `
    ${recherche}
    ${q
      ? `<p class="fr-text--sm fr-text-mention--grey fr-mt-2w fr-mb-0">
          ${guideItems.length
            ? `${guideItems.length} section(s) sur ${tousLesGuides.length} correspondent à « ${esc(q)} ».`
            : `Aucune section ne correspond à « ${esc(q)} ». Filtrez autrement, ou ouvrez les sections ci-dessous.`}
        </p>`
      : ""}
    ${(q && !guideItems.length ? tousLesGuides : guideItems)
      .map((g) => accordion(g.title, `<div class="app-prose">${g.body}</div>`, {
        // Une recherche ouvre les sections qu'elle a trouvées. Quand elle ne
        // trouve rien, les sections restent **fermées** : la page ne doit pas
        // se déployer de vingt mille pixels parce qu'une requête n'a pas abouti.
        open: q && guideItems.length ? true : !!g.open,
        iconName: g.iconName,
      }))
      .join("")}
  `, {
    iconName: "book-2-line",
    subtitle: "Page par page, ce que fait chaque écran et comment s'en servir — dépliez une section",
    id: "aideGuide",
  });

  // Le dictionnaire des balises et la documentation historique se cherchent
  // comme le guide : une même requête « trames » doit pouvoir tomber sur la
  // section du guide *et* sur la balise qu'on cherchait sans le savoir.
  const techniques = [
    { title: "Dictionnaire des variables de trame", body: `<div class="app-prose app-dictionary">${DICTIONNAIRE_HTML}</div>`, iconName: "code-s-slash-line" },
    md ? { title: "Documentation du document Grist d'origine", body: `<div class="app-prose">${mdToHtml(md)}</div>`, iconName: "time-line" } : null,
  ].filter(Boolean);
  const techniquesAffichees = q ? techniques.filter((t) => matches(q, t.title, t.body)) : techniques;

  const technique = panel("Pour aller plus loin", `
    ${techniquesAffichees.length
      ? techniquesAffichees.map((t) => accordion(t.title, t.body, { iconName: t.iconName, open: !!q })).join("")
      : q
        ? `<p class="fr-text--sm fr-text-mention--grey fr-mb-0">Rien dans le dictionnaire ni dans la documentation d'origine ne correspond à « ${esc(q)} ».</p>`
        : emptyState("Aucune présentation d'origine n'est enregistrée dans cette base.", { iconName: "time-line" })}
  `, {
    iconName: "book-2-line",
    subtitle: "Balises des trames et documentation historique",
    collapsible: true,
    id: "aidePlus",
  });

  // L'accessibilité est une obligation propre au service public : la page Aide
  // y renvoie, sans dupliquer la déclaration (voir accessibilite.js).
  const accessibilite = panel("Accessibilité", `
    <p>
      L'outil relève des obligations d'accessibilité des services publics numériques
      (article 47 de la loi n° 2005-102). Sa <strong>déclaration d'accessibilité</strong>,
      son <strong>schéma pluriannuel</strong> et son <strong>plan d'action</strong> sont
      publiés dans l'outil, avec le point de contact et la voie de recours.
    </p>
    <p><a href="#accessibilite" data-nav="accessibilite">Lire la déclaration d'accessibilité</a></p>
  `, { iconName: "information-line", id: "aideAccessibilite", collapsible: true });

  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Aide</p>
    <h1 class="fr-h3">Prendre en main l'outil</h1>
    <p class="app-page-head__sub">Le circuit d'une affaire disciplinaire et le guide de chaque écran de l'outil.</p>
  </div>
</div>
${ancres}
${raccourcis}
${etapes}
${guide}
${technique}
${accessibilite}`;
}
