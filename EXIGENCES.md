# Référentiel d'exigences

Ce document est le **référentiel d'exigences** de l'outil (NC-0016) : ce que le
service doit faire, exigence par exigence, avec, pour chacune, l'écran qui la
porte et son **état**. Il a été reconstitué à partir de la documentation
existante — `SPEC.md`, la page Aide, les trames livrées, `procedure.js` — pour
combler un manque relevé par l'audit : sans référentiel accepté, la complétude
de l'outil ne peut être ni établie ni contestée.

## Comment s'en servir

- Chaque exigence porte un identifiant stable (`EX-…`) et un **état** :
  - **Livré** — la fonction existe et a été vérifiée ;
  - **Partiel** — la fonction existe mais ne couvre pas toute l'exigence ;
  - **À trancher** — relève d'une décision du commanditaire (le plus souvent
    une conséquence juridique, pas un développement).
- La colonne **Vérification** cite, quand elle existe, la preuve : un cas du
  harnais (`tests/invariants.test.js`), le test de fumée par écran, ou la
  garantie de `SPEC.md` § 8 qui la couvre.
- La **recette** se tient en fin de document : c'est un procès-verbal à
  compléter par le commanditaire. **L'acceptation elle-même reste un acte du
  commanditaire** ; tant qu'elle n'a pas eu lieu, l'outil est réputé complet au
  regard de ce référentiel, mais non recetté.

## 1. Affaires et procédure

| Id | Exigence | Écran | État | Vérification |
| --- | --- | --- | --- | --- |
| EX-001 | Enregistrer une affaire (saisine, mis en cause, section, voie) | `#affaires` | Livré | fumée |
| EX-002 | Calculer la prescription et l'échéance d'instruction selon la section | `#affaires` | Livré | `butoirInstruction` (SPEC § 8.14) |
| EX-003 | Suivre l'état d'une affaire (ouverte, close, etc.) | `#affaires` | Livré | fumée |
| EX-004 | Joindre des affaires et désigner l'affaire de tête | `#affaires` | Livré | SPEC § 8.9 |
| EX-005 | Déduire la composition attendue de la formation et la confronter aux membres saisis | `#affaires` | Livré | `collegeAttendu` |
| EX-006 | Signaler les points de régularité, sans jamais bloquer | `#affaires` | Livré | `controlesRegularite` |
| EX-007 | Attribuer un lot d'affaires à un secrétaire | `#attribution` | Livré | fumée |
| EX-008 | Restreindre la visibilité des affaires au périmètre du rôle | tous | Livré | `visibilite.js` |
| EX-019 | Déclarer l'adresse du dossier de pièces d'une affaire, la valider, l'ouvrir (bandeau de l'affaire, rôle de la séance) et rappeler son absence | `#affaires` | Livré | harnais (dossier), SPEC § 8.25 |
| EX-065 | Composer la formation et les intervenants d'une affaire : le menu « Intervenant » ne propose que des **membres de la section**, groupés par collège, et la **personne hors section** s'ajoute par un geste dédié (« Ajouter une personne hors section »), son nom saisi librement | `#affaires` | Livré | `verifierRecherche`, harnais (qualité d'un intervenant), SPEC § 8.29 |
| EX-066 | Rédiger un **acte rendu** — décision ou ordonnance — avec le répertoire des considérants de principe et les gestes de numérotation, et ouvrir l'atelier de la décision depuis l'onglet « Décision » de l'affaire | `#affaires`, `#decisions`, `#documents` | Livré | harnais (articles), fumée, SPEC § 8.30 |

## 2. Séances et décisions

| Id | Exigence | Écran | État | Vérification |
| --- | --- | --- | --- | --- |
| EX-010 | Créer une séance et composer son rôle | `#calendrier/seances` | Livré | fumée |
| EX-011 | Exporter le rôle et le calendrier (`.ics`) | `#calendrier/echeances` | Livré | fumée |
| EX-012 | Enregistrer les décisions, définitives ou avant dire droit | `#decisions` | Livré | fumée |
| EX-013 | Décider de la susceptibilité de recours (sanction ou abandon seulement) | `#decisions` | Livré | `estSusceptibleDeRecours` |
| EX-014 | Déterminer la voie de recours (tribunal administratif du ressort du siège pour les usagers ; CNESER / CNESERAAV pour les enseignants-chercheurs) | `#decisions` | Livré | harnais (procédure) |
| EX-015 | Rédiger la décision dans un atelier (considérants de principe, visas et dispositif, numérotation des considérants **et des articles**), ouvert depuis le registre comme depuis l'onglet « Décision » de l'affaire (« Rédiger la décision ») | `#decisions`, `#affaires` | Livré | harnais (articles), fumée, SPEC § 8.30 |
| EX-017 | Numéroter les actes (séquence par section et par année, jamais rejouée) et tenir le registre consultable et exportable | `#decisions` | Livré | harnais (actes), SPEC § 8.23 |
| EX-018 | Réunir les références citées, signaler celles qui ne sont pas retrouvables et dater la vérification du service juridique | `#reglages/catalogues` | Livré | harnais (références), SPEC § 8.24 |

## 3. Documents, trames et formats

| Id | Exigence | Écran | État | Vérification |
| --- | --- | --- | --- | --- |
| EX-020 | Rédiger un document à partir d'une trame, en une seule feuille | `#documents` | Livré | SPEC § 8.17 |
| EX-021 | Programmer auteur et destinataire sur la trame, signataire au plus près | `#documents` | Livré | SPEC § 8.12 |
| EX-022 | Distinguer format, auteur et destinataire | `#reglages/types` | Livré | SPEC § 8.13 |
| EX-023 | Rendre un acte : ordonnance (ORDONNE) ou décision (DÉCIDE) | `#documents` | Livré | SPEC § 8.15 |
| EX-024 | Publier une décision définitive **anonymisée** | `#documents` | Livré | SPEC § 8.18 |
| EX-025 | Imprimer et exporter en PDF, Word, OpenDocument | `#documents` | Livré | fumée + tests |
| EX-026 | Exporter les listes visibles en CSV et Excel | listes | Livré | SPEC § 8.11, harnais |
| EX-027 | Rendre un rapport d'activité (chiffres, graphiques, tableaux) | `#tableau-de-bord/rapport` | Livré | fumée |
| EX-028 | Livrer et rattraper les trames, formats, catalogues et seuils par défaut | `#reglages/trames` | Livré | harnais (contenus) |
| EX-029 | Signaler et aligner les contenus livrés plus récents qu'une base | `#reglages/donnees` | Livré | `contenus.js`, harnais |
| EX-059 | Régler, par feuille de style, la position et la taille de chaque logo de l'en-tête | `#reglages/types` | Livré | harnais (en-tête), SPEC § 8.26 |

## 4. Données et exploitation

| Id | Exigence | Écran | État | Vérification |
| --- | --- | --- | --- | --- |
| EX-030 | Fonctionner seul (stockage navigateur) et comme widget Grist | — | Livré | fumée |
| EX-031 | Importer un tableur, une base `.grist`, un CSV, un JSON | `#reglages/import` | Livré | fumée |
| EX-032 | Exporter et réimporter l'intégralité de la base (JSON) | `#reglages/donnees` | Livré | fumée |
| EX-033 | Installer la structure dans un document Grist | `#reglages/donnees` | Livré | fumée |
| EX-034 | Conserver une trace des actions (journal) | `#reglages/donnees` | Livré | `journaliser` |
| EX-035 | Retenir une écriture refusée et permettre son renvoi | bandeau | Livré | SPEC § 8.2 |
| EX-036 | Tenir un journal de diagnostic copiable | `#reglages/donnees` | Livré | fumée |
| EX-037 | Signaler l'échec d'une écriture locale (bandeau, Journal) et l'occupation du stockage (60 %, 85 %) | bandeau | Livré | harnais (stockage) |
| EX-038 | Vérifier la livraison — syntaxe de tous les modules et harnais — en un appel | `#debug` | Livré | `verifier.mjs`, SPEC § 8 |

## 5. Sécurité et confidentialité

| Id | Exigence | Écran | État | Vérification |
| --- | --- | --- | --- | --- |
| EX-040 | Échapper les valeurs substituées (pas d'exécution de balise) | documents | Livré | harnais (rendu) |
| EX-041 | Assainir les colonnes rendues comme du HTML | documents | Livré | harnais (assainissement) |
| EX-042 | Neutraliser les formules dans les exports tabulaires | exports | Livré | harnais (export) |
| EX-043 | Ne charger l'API Grist que depuis des origines déclarées | — | Livré | harnais (grist) |
| EX-044 | Déclarer l'environnement (recette / production) ; un document Grist est toujours en production | — | Livré | harnais (environnement) |
| EX-045 | Mode session, verrouillage après inactivité, avis poste partagé | `#reglages/donnees` | Livré | fumée |
| EX-046 | Journaliser les suppressions avant de les exécuter | corbeille | Livré | `doDelete` |
| EX-047 | Dater et purger la corbeille selon une durée réglable | `#reglages/donnees` | Livré | fumée |
| EX-048 | Figer l'intégrité des dépendances et déclarer une politique de sécurité | — | Livré | `SECURITE.md` |
| EX-049 | Déclarer l'origine d'une instance Grist auto-hébergée, reconnaître celle de l'État sans réglage | `#reglages/donnees` | Livré | harnais (grist) |
| EX-056 | Verrouiller l'écran par un code défini (empreinte), déverrouillage journalisé | `#reglages/donnees` | Livré | fumée |
| EX-057 | Confiner le focus dans les fenêtres modales (fond neutralisé, retour au déclencheur) | tous | Livré | fumée (modale) |
| EX-058 | Montrer ce qu'un alignement de contenus va changer (lignes et champs), distinguer l'ajout de la correction | `#reglages/donnees` | Livré | harnais (contenus) |
| EX-060 | Aligner les champs d'une même ligne, et lire l'aide d'un champ sous son contrôle | tous | Livré | `verifierAlignement`, SPEC § 8.27 |
| EX-067 | Ranger les actions d'un bloc au bord droit — le repère d'un bloc repliable passe à gauche du titre — et faire porter à une icône la classe qu'on lui donne | tous | Livré | `verifierAlignement`, harnais (icônes), SPEC § 8.31 |
| EX-068 | Garder le panneau d'un menu déroulant **dans la fenêtre** à l'ouverture, quel que soit le bord auquel son bouton se trouve | tous | Livré | `verifierMenus`, SPEC § 8.32 |
| EX-069 | Tenir la barre de navigation sur une ligne, ou la replier dans un menu qui annonce la page courante, sur un écran étroit | tous | Livré | fumée, SPEC § 8.33 |
| EX-070 | Garder la barre de navigation en haut de la fenêtre quand on défile, y faire prendre place à « Nouvelle affaire » et au compte — **sur le rang des onglets** dès que la largeur le permet, sans faire grandir la barre — quand l'en-tête a disparu, et adosser à elle les autres barres collées — **y compris dans un widget Grist**, dont le cadre défile pour lui-même | tous | Livré | `verifierEntete` (et son volet `embarque`), SPEC § 8.34 |

| EX-071 | Donner la place au **texte** dans un espace de rédaction — la colonne d'outils se partage **au prorata** (14 rem au moins, 22 rem au plus ; 18 rem et 25 rem dans l'atelier d'une décision), la feuille garde sa mesure A4, et le repli lui rend sa largeur — et **marquer le point de dépôt** d'une balise glissée, hors de la zone enregistrée | tous | Livré | `verifierRedaction`, SPEC § 8.35 |

| EX-072 | « Écrire aux membres de la commission » écrit à la commission **entière** : son président, ses rapporteurs et ceux qui y siègent, chaque adresse une seule fois — les boutons particuliers du président de la commission et des rapporteurs restant | `#affaires` | Livré | `verifierContacts`, SPEC § 8.36 |

| EX-073 | Un document rendu ne porte **aucune balise brute** — variables `{…}` de la feuille et balises de données `{{…}}` sont rendues dans le texte comme dans les bords de la feuille — et son texte ne tombe **jamais dans le pied de page** : l'emplacement du texte déposé dans le pied est ramené avant lui | `#documents`, `#decisions` | Livré | harnais (feuille, rendu), SPEC § 8.37 |

| EX-074 | Une date s'écrit en français — quantième **sans zéro**, « 1er » au premier du mois, et la balise `.date(@long)` comme l'interface suivent la même règle — et la date d'une **séance** se lit sur l'affaire : `{{Seance_d_examen_Date}}` porte la date de la séance nommée, sur un justificatif, une convocation comme une décision | `#documents`, `#decisions` | Livré | harnais (dates, séance), SPEC § 8.38 |

| EX-075 | Une **colonne calculée** se lit par le moteur de formules, jamais sur la ligne brute : le nom du mis en cause, l'INE et la date de naissance — calculés depuis `Personnes` — portent leur valeur au **registre des décisions**, au **registre des actes**, à l'état pour versement, dans les **lettres de saisine** et dans la liste des pièces d'un dossier ; le champ brut reste lu à défaut, pour les lignes d'avant la reprise | `#decisions`, `#documents`, `#reglages/donnees` | Livré | harnais (lecture), SPEC § 8.39 |
| EX-076 | La **variante livrée en production** (`livraison/`, NC-0004) est **reconstruite à chaque livraison de code** : la production ne fait pas tourner le dépôt, et une variante périmée y rejoue des défauts déjà corrigés (balises brutes à l'export, 2.2.13) | — | Livré | `livraison/README.md`, CHANGELOG |
| EX-077 | Dans l'espace de rédaction (trame, document), les **effets en ligne** — gras, italique, souligné, barré, exposant, indice — s'appliquent aux **pastilles** sélectionnées comme au texte, et « Effacer la mise en forme » les en dégage ; l'effet s'enregistre avec la balise et se rend dans le document | `#reglages/trames`, `#reglages/types`, `#documents`, `#decisions` | Livré | harnais (pastilles), SPEC § 8.40 |
| EX-078 | Une **écriture non encore envoyée** au document **survit au rechargement** : mémorisée avec son image d'avant, triée au branchement suivant (rejouée si la ligne est intacte, écartée et nommée sinon), annoncée par **bandeau** avec renvoi, copie de secours ou abandon ; une chasse à la fermeture demande l'envoi immédiat | tous (mode Grist) | Livré | harnais (reprises), SPEC § 8.41 |

## 6. Accessibilité et documentation

| Id | Exigence | Écran | État | Vérification |
| --- | --- | --- | --- | --- |
| EX-050 | Hiérarchie de titres sans saut de niveau | tous | Livré | fumée + audit NC-0012 |
| EX-051 | Pas de débordement à 320 px | tous | Livré | audit NC-0013 |
| EX-052 | Déclaration d'accessibilité, schéma pluriannuel, plan d'action | `#accessibilite` | Livré | `accessibilite/` |
| EX-053 | Dossier de conformité des données (registre, AIPD, durées, mentions) | `rgpd/` | Livré | `rgpd/` |
| EX-054 | Documentation d'exploitation (README, SPEC, aide en ligne) | `#aide` | Livré | `README.md` |
| EX-055 | Harnais de tests et journal des livraisons | — | Livré | `tests/`, `CHANGELOG.md` |
| EX-061 | Rechercher dans une liste déroulante (accents et casse indifférents, classement par proximité, choix au clavier, longue liste défilable, groupes du menu natif redits — collèges des membres de la section —, nombre de réponses annoncé), le menu natif restant la valeur | tous | Livré | harnais (recherche), `verifierRecherche`, SPEC § 8.28 |

## 7. À trancher avec le commanditaire

Ce ne sont plus des développements en attente — les fonctions sont **livrées** —
mais des **décisions** qui appartiennent au commanditaire : qui vérifie les
références, et selon quelle règle les actes se numérotent.

| Id | Sujet livré | Ce qui reste à trancher |
| --- | --- | --- |
| EX-062 | Recueil des références citées, sources non retrouvables, date de vérification | **faire viser les références par le service juridique**, et enregistrer la date de sa vérification |
| EX-063 | Numérotation des actes, registre consultable et exportable | **arrêter la règle de numérotation** (périmètre de la séquence, forme du numéro) avec le service |
| EX-064 | Segmentation fine des droits dans Grist, chiffrement du stockage, information des personnes | décision du commanditaire |

## 8. Procès-verbal de recette

À compléter et signer par le commanditaire. Chaque ligne se coche après
vérification sur l'environnement de recette, puis de production.

| Id | Point de recette | Attendu | Conforme (oui/non) | Observation |
| --- | --- | --- | --- | --- |
| R-01 | Le périmètre d'affaires suit le rôle | un secrétaire ne voit que ses affaires | | |
| R-02 | Les délais calculés sont ceux de la section | échéance d'instruction, prescription | | |
| R-03 | Les exports de listes suivent l'écran | recherche, filtres et tri compris | | |
| R-04 | Un document se rend en une seule feuille | en-tête, corps, signature, pied | | |
| R-05 | L'anonymisation d'une décision définitive | aucun nom du dossier ne subsiste | | |
| R-06 | Les contenus livrés sont à jour | avis « contenus plus récents » traité | | |
| R-07 | Le mode session et le verrouillage fonctionnent | rien ne reste sur le poste | | |
| R-08 | La déclaration d'accessibilité est publiée et joignable | depuis l'Aide et le pied de page | | |
| R-09 | Le dossier de conformité est complet | registre, AIPD, durées, mentions | | |
| R-10 | Le journal de diagnostic est exploitable | copiable, sans donnée de dossier | | |
| R-11 | Les actes se numérotent et le registre s'exporte | séquence par section et année, numéro non rejoué | | |
| R-12 | La page Références signale ce qui n'est pas vérifiable | sources non retrouvables, affirmation à viser, date | | |
| R-13 | Un échec d'écriture locale n'est pas silencieux | bandeau avec la cause, entrée au Journal | | |
| R-14 | Le verrou d'écran contrôle l'accès | code défini, déverrouillage journalisé | | |
| R-15 | Une liste déroulante longue se cherche et se parcourt | accents et casse indifférents, choix au clavier, défilement d'une liste longue, collèges annoncés dans la liste des intervenants, valeur du menu conservée | | |
| R-16 | Le menu « Intervenant » ne propose que des membres de la section | les collèges des membres y figurent, le répertoire des personnes non ; « Ajouter une personne hors section » ajoute une ligne marquée hors section, dont le nom s'écrit librement | | |
| R-17 | Un acte rendu se rédige et se numérote | le répertoire des considérants s'y glisse, « Numéroter les considérants » pose 1., 2., 3.… et « Numéroter les articles » pose « Article 1er », « Article 2 »… ; l'atelier de la décision s'ouvre depuis l'onglet « Décision » de l'affaire comme depuis le registre | | |

**Décision du commanditaire :** ☐ accepté ☐ accepté avec réserves ☐ refusé

Date et fonction :
