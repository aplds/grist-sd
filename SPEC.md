# Spécification du modèle v2

Ce document décrit **ce que l'outil attend du tableur** — et non l'inverse. Le
document Grist d'origine (« Gestion des sections disciplinaires ») a servi de
point de départ ; le modèle décrit ici est **reconstruit d'après les besoins de
l'interface** : chaque table et chaque colonne existe parce qu'un écran, un
contrôle ou un document s'en sert. L'architecture d'origine reste décrite dans
`src/legacy.js`, qui sert de table de correspondance à l'**outil d'import**
(`src/import.js`) : c'est par lui que les données déjà saisies rejoignent le
nouveau modèle.

> **Règle de lecture :** `src/schema.js` est la source de vérité (tables,
> colonnes, libellés, types, formules, écrans). Ce document explique *pourquoi*
> chaque élément existe. En cas de divergence, c'est `schema.js` qui a raison, et
> ce document qu'il faut corriger.

> **Noms de stockage :** dans un document Grist, les tables du modèle sont
> créées sous le préfixe `GristHidden_` (`GristHidden_Affaires`,
> `GristHidden_Decisions`, …), qui les retire de l'interface de Grist : le
> document sert de base de données, l'outil en est l'interface. Ce document ne
> connaît que les noms courts ; la traduction est faite par
> `src/grist-backend.js` (voir le README, « Les tables du document sont
> masquées dans Grist »).

---

## 1. Procédure et composition : deux étages

Tout ce qui est juridique vit dans **`src/procedure.js`** : source unique des
organes, des compositions, de l'instruction, des autorités, des délais, des
sanctions applicables, de la prescription et de l'effacement. Deux étages y sont
distingués, et aucun des deux ne se choisit affaire par affaire :

| Étage | Ce qui le détermine | Ce qu'il commande |
| --- | --- | --- |
| **Procédure** | `Sections_disciplinaires.Public` — `Usagers` ou `Enseignants-chercheurs` | Les articles applicables, le nom des organes, l'instruction, les autorités, les délais, la prescription, la voie de traitement, le cheminement de l'affaire. |
| **Composition** | `Sections_disciplinaires.Tutelle` (enseignement supérieur ou agriculture) et `Type_de_section` | Le nombre de membres par collège, la formation appelée à juger, le quorum, les contrôles de composition. |

*La procédure est celle du code de l'éducation dans les deux tutelles* : le code
rural et de la pêche maritime y renvoie expressément (R.812-24-1 pour les
usagers, R.812-24-8 pour les enseignants-chercheurs). Seule la **composition**
diffère — et ce sont les textes de chaque tutelle qui la fixent.

### 1.1 Les cinq procédures

| Public | Tutelle | Type | Section | Formation appelée à juger | Instruction | Textes |
| --- | --- | --- | --- | --- | --- | --- |
| Usagers | Enseignement supérieur | Section d'établissement | 4 professeurs, 4 maîtres de conférences, 8 usagers (jusqu'à 6/6/12 ou 8/8/16) | Commission de discipline : 2 + 2 + 4 | Rapporteur (collèges des professeurs ou des maîtres) et rapporteur adjoint (usagers) ; deux mois au plus | R.811-11 et suivants |
| Enseignants-chercheurs | Enseignement supérieur | Section d'établissement | 4 professeurs, 4 maîtres de conférences, 2 autres enseignants | Selon le grade de la personne poursuivie : 4 membres (professeurs / maîtres de conférences / autres enseignants) | **Commission d'instruction de deux membres**, dont le rapporteur | R.712-9 et suivants |
| Usagers | Agriculture | Section d'établissement | 4 professeurs, 4 personnels exerçant des fonctions d'enseignement, 2 personnels administratifs et techniques, 10 usagers | Commission de discipline : 2 + 2 + 1 + 5 | Rapporteur (collèges 1° à 3°) et rapporteur adjoint (usagers) | R.812-24-1 et suivants (renvoi au code de l'éducation) |
| Enseignants-chercheurs | Agriculture | Section d'établissement | 6 professeurs ou directeurs de recherche, 4 maîtres de conférences ou chargés de recherche, 2 autres enseignants | Selon le grade : 6, 8 ou 4 membres | Commission d'instruction de deux membres | R.812-24-8 et suivants |
| Usagers | Enseignement supérieur | **Section disciplinaire académique** | 1 magistrat de l'ordre administratif (présidence), 2 professeurs, 2 maîtres de conférences, 4 usagers, 2 représentants de l'administration | **La section elle-même** — pas de commission de discipline | Rapporteur et rapporteur adjoint | R.811-43 à R.811-50 |

Le **type de section** ne modifie pas la composition retenue : une section
d'école interne ou commune à plusieurs établissements relève d'un texte propre,
dont la composition est présumée identique tant que l'outil n'en sait pas plus ;
`procedure()` le dit alors dans la note de composition.

Il commande en revanche le **nom de l'organe compétent**, donc le conseil auprès
duquel la section est instituée (`libelleOrgane`, `procedure.js`) :

| Type de section | Organe compétent |
| --- | --- |
| Section d'établissement, enseignement supérieur | Section disciplinaire du conseil académique |
| Section d'établissement, agriculture | Section disciplinaire du conseil d'administration |
| **Section d'école interne** | **Section disciplinaire du conseil d'école interne** |
| Section commune à plusieurs établissements | Section disciplinaire du conseil académique — du conseil d'administration pour un établissement agricole |
| Section disciplinaire académique | Section disciplinaire académique (section commune du recteur de région académique) |

Ce libellé se lit partout où la procédure est rappelée : onglet « Synthèse »
d'une affaire, Réglages › Sections, explication de la procédure
(`noticeProcedure`), page Aide.

> Le **plafond des représentants des usagers** (R.811-32) est contrôlé pour les
> sections d'usagers de l'enseignement supérieur et pour la section académique ;
> il ne l'est pas pour la commission de discipline des établissements agricoles,
> dont la composition (R.812-24-6) comprend cinq usagers pour quatre enseignants.

### 1.2 La voie de traitement (`Affaires.Voie`)

« Section disciplinaire » est la procédure ordinaire, qui comporte une phase
d'instruction. « Entretien disciplinaire (R.811-40) » est une **alternative à
l'instruction** : aucun rapport n'est établi, et l'affaire suit le cheminement
ordinaire **privé de l'étape « Instruction »** (`etapesAffaire()`), jusqu'à la
décision de la formation. Ce n'est pas une clôture : la seule issue de clôture
reste « Classé sans suite ».

La voie n'est proposée que là où les textes la prévoient — les **sections
compétentes à l'égard des usagers** (code de l'éducation, R.811-40 ; code rural,
R.812-24-1, 3°). Elle n'est pas offerte aux sections d'enseignants-chercheurs ni
devant la section disciplinaire académique, dont les articles applicables ne la
mentionnent pas (`voiesPour()`).

### 1.3 Prescription et effacement — deux choses distinctes

- **Prescription** — délai au-delà duquel l'action disciplinaire ne peut plus
  être engagée, à compter de la **connaissance effective** des faits. Elle ne
  concerne que les **personnels** (code général de la fonction publique,
  art. L. 532-2 ; trois ans). **Les poursuites engagées à l'égard d'un usager ne
  sont pas soumises à prescription** : l'outil ne demande donc pas de date de
  connaissance des faits pour une affaire d'usagers, et son contrôle de
  prescription n'y est qu'un rappel.
- **Effacement** — au bout de trois ans sans nouvelle sanction, certaines
  sanctions s'effacent du dossier : avertissement, blâme et mesure de
  responsabilisation pour les usagers (R.811-13-1) ; blâme et rappel à l'ordre
  pour les personnels (R.712-42).

### 1.4 Ce que la procédure change dans l'interface

- **Les onglets d'une affaire.** L'onglet de composition porte le nom de l'organe
  qui se prononce : « Commission », « Instruction » ou « Section ».
- **Les rôles proposés.** Rapporteur et rapporteur adjoint pour les usagers ;
  commission d'instruction de deux membres pour les enseignants-chercheurs
  (`ROLES_INTERVENANT`, filtré par `procedure()`).
- **Les catalogues.** Chaque sanction et chaque motif porte un **régime** et une
  **tutelle** : seuls les éléments applicables sont proposés. L'outil livre par
  défaut **22 sanctions** et **19 motifs** repris des textes applicables :
  R.811-13-1 et R.811-13-2 du code de l'éducation pour les usagers ; L.952-8 et
  L.952-9 pour les enseignants-chercheurs et les autres enseignants ; R.811-11
  du code de l'éducation et R.812-24-2 du code rural pour les manquements ;
  L.121-1 à L.121-11 du code général de la fonction publique pour les devoirs
  des agents ; R.712-42 pour l'effacement au bout de trois ans. Chaque entrée
  porte son **texte de référence** et, pour les sanctions, sa durée maximale et
  la possibilité d'un sursis. Les sanctions de la fraude commise dans un
  établissement privé (R.811-13-2) ne sont proposées qu'à la tutelle
  « enseignement supérieur » : le code rural les écarte pour les établissements
  agricoles (R.812-24-1), et y ajoute à l'inverse une atteinte « à la
  réputation » de l'établissement (R.812-24-2, 5°). Réglages › Catalogues et
  délais propose d'**aligner** un catalogue existant sur ces valeurs : l'outil
  n'ajoute que les entrées absentes et met à jour celles qu'il reconnaît — par
  leur libellé, ou par un ancien libellé connu (`RENOMMAGES_CATALOGUE`) — sans
  jamais supprimer une ligne ni toucher aux entrées propres à l'établissement.
- **Les personnes.** La personne mise en cause est une ligne de `Personnes`,
  dont le `Type` porte le régime (`Usager`, `Personnel`, `Tiers`).
- **Les délais d'instruction.** L'instruction dure un temps compté, qui dépend
  de la procédure : **deux mois** à compter de la **décision de désignation des
  rapporteurs** devant une section compétente à l'égard des **usagers**,
  **quatre mois** à compter de celle de la **commission d'instruction** devant
  une section d'**enseignants-chercheurs**. C'est la **désignation** qui ouvre
  l'instruction, et non la saisine : c'est la date de l'acte — le document
  produit avec une trame `Ouvre_l_instruction` — qui fait courir le délai, et
  tant qu'elle manque, l'outil dit l'instruction **non ouverte**.
  Le terme se **fixe** par la **date butoir d'instruction** portée par un
  document relatif à l'instruction ou par une décision avant dire droit : cette
  date **prime** sur le délai de la procédure, qu'elle l'avance ou qu'elle le
  recule, et l'outil la met en avant (bandeau d'échéance, contrôle de
  régularité, calendrier) — voir § 3.5.
- **L'explication de la procédure.** `noticeProcedure()` produit, pour une
  section, les blocs affichés dans l'onglet « Synthèse » d'une affaire et dans
  Réglages › Sections ; `noticesProcedures()` produit les cinq procédures
  présentées dans la page Aide.
- **Écrire aux gens d'une affaire.** L'onglet « Synthèse » porte un panneau
  **Contacts** : des liens `mailto:` vers la présidence de la section, celle de
  la commission, les membres, les rapporteurs et le secrétariat, l'affaire
  rappelée en objet. « Écrire aux membres de la commission » écrit à la
  commission **entière** — son président et ses rapporteurs y compris, une même
  adresse n'étant inscrite qu'une fois ; les deux boutons voisins permettent de
  n'écrire qu'au président de la commission, ou qu'aux rapporteurs. Un bouton
  par personne figure aussi dans la composition de la formation, dans les autres
  personnes du dossier et dans le panneau de la personne mise en cause. Les
  adresses viennent des fiches (membres, personnes) et ne se saisissent pas dans
  l'affaire : une personne sans courriel n'a pas de bouton, et le panneau dit
  lesquelles compléter. Aucune adresse n'est inventée.

## 2. Contrôles de régularité

`regimes.js` calcule, pour chaque affaire, une liste de contrôles affichés dans
l'onglet « Synthèse ». **Tous sont indicatifs** : ils signalent, ils ne bloquent
jamais. Quatre statuts : `ok` (condition remplie), `alerte` (règle paraissant
méconnue), `manquant` (donnée absente), `info` (remarque de contexte).

Ils portent sur : le **dossier de pièces** (l'adresse du dossier tenu hors de
l'outil est déclarée, ou elle manque) ; la **prescription** (personnels
seulement ; pour un usager,
simple rappel que l'action n'est pas prescriptible) ; la **composition de la
formation** (président désigné, instruction désignée, effectif attendu selon le
grade, plafond des représentants des usagers là où il s'applique, mandats
échus) ; la **voie de traitement** ; l'**échéance d'instruction** (la date
butoir d'instruction portée par un acte de l'affaire, prioritaire sur le terme
de la procédure — alerte quand elle est dépassée, information dans les quinze
derniers jours) ; le
**délai de convocation** (quinze jours, ou huit pour l'entretien de l'article
R.811-40) ; l'**accusé de réception** d'une notification recommandée ; le
**délai de recours**.

Les seuils ne sont **pas dans le code** : ils vivent dans `Parametres`, que
l'établissement règle. La composition attendue, elle, vient de `procedure.js` —
donc de la section de l'affaire.

## 3. Les tables

### 3.1 Tables de référence (ce que l'établissement paramètre)

| Table | Rôle | Ce que l'interface en fait |
| --- | --- | --- |
| `Sections_disciplinaires` | Une section par **public**, **tutelle** et **type** : structure, acronyme, siège, logos, adresse du secrétariat, liste des secrétaires. Ces trois colonnes déterminent la procédure et la composition des organes (`procedure.js`). | Réglages › Sections et membres ; filtre de toutes les listes ; en-tête des documents. |
| `Membres` | Les membres d'une section : identité, **collège**, rôle (président, vice-président, membre), **mandat** (`Mandat_debut`, `Mandat_fin`). | Composition des formations, désignation des rapporteurs, signatures. |
| `Secretaires` | Les secrétaires, rattachés à une ou plusieurs sections — et réciproquement : `Secretaires.Section` et `Sections_disciplinaires.Secretaires` sont **miroirs** l'une de l'autre (`miroir` dans `schema.js`), toute écriture sur une face met l'autre à jour. | Attribution des affaires, courriels de contact. |
| `Destinataires_institutionnels` | Président, recteur, ministre… : nom, adresse, formule de politesse, signature. | Publipostage des documents. |
| `Personnes` | **Le répertoire** : usagers, personnels, tiers (avocats, accompagnants, interprètes). Identité, coordonnées, et les champs propres à chaque type. | Onglet « Personnes » d'une affaire, création d'un mis en cause, fichier des victimes et témoins. |
| `Sanctions` | Le catalogue des sanctions, par **public** et par **tutelle**, avec leur groupe, leur durée maximale, la possibilité d'un sursis et leur texte de référence. 22 sanctions sont livrées par défaut (`regimes.js`). | Onglet « Décision », contrôles, indicateurs. |
| `Motifs` | Le catalogue des motifs, par groupe (régime intérieur, fraude, violences, devoirs des agents publics…) et par **public** et **tutelle**. 19 motifs sont livrés par défaut. | Saisine d'une affaire, statistiques. |
| `Parametres` | Les seuils et durées : prescription, délai de convocation, délai et réponse de l'entretien R.811-40, délai de recours, délai d'instruction, effacement des sanctions, jours comptés pour un mois d'exclusion, conservation de la corbeille, et **date de la dernière vérification des références** juridiques. Dix seuils sont livrés par défaut (`regimes.js`). | Contrôles de régularité, calcul du terme des sanctions, purge de la corbeille, page Réglages › Catalogues › Références. |
| `Trames`, `Types_Trames` | Documents types. Le **format** (`Types_Trames`) est la feuille de style — courrier, attestation, rapport d'instruction, **ordonnance** ou **décision** (`Categorie`) —, écrite d'un bout à l'autre dans `Feuille_de_style`, avec l'emplacement `{{Corps}}` ; un acte rendu porte l'**organe** qui le rend (`Organe` : président de la section disciplinaire, président de la formation de jugement, ou formation de jugement) et le format peut demander la **numérotation des pages** (`Numeroter_pages`). Il règle aussi la **mise en page de l'en-tête** — la zone et la taille du bloc-marque de l'État et du logo de l'établissement (`Marianne_position`, `Marianne_largeur`, `Marianne_hauteur`, `Logo_position`, `Logo_largeur`, `Logo_hauteur` : voir § 8, invariant 26). Une **ordonnance** — l'acte d'un président, qui règle la marche de l'instance et se lit « ORDONNE » — se distingue d'une **décision** de la formation de jugement, qui peut trancher le fond et se lit « DÉCIDE ». La **trame** porte le corps, la **procédure qu'elle vise** (`Public`, `Tutelle`, `Type_de_section` — `Toutes` ou `Les deux` pour les génériques), son **auteur** (`Auteur`) et son **destinataire** (`Destinataire`), et, pour la trame de jugement, `Decision_definitive` : ses champs de décision sont ceux de l'affaire. Sa colonne `Concerne_l_instruction` la désigne comme une **trame d'instruction** (rapport, désignation des rapporteurs, complément ou supplément) : la **date butoir d'instruction** est alors proposée à la rédaction du document, et compte pour l'affaire. Sa colonne `Ouvre_l_instruction` la désigne comme l'**acte de désignation** qui ouvre l'instruction (les rapporteurs, ou la commission d'instruction) : la date du document produit est alors le point de départ du délai d'instruction de l'affaire. Les deux se cochent dans les réglages de la trame. Sa colonne `Feuille_de_style`, **vide tant qu'elle hérite**, porte l'adaptation qu'elle s'est faite de celle de son format. L'héritage a trois étages : le **format** donne la feuille de style (en-tête, chapeau, signature, pied de page, à l'emplacement `{{Corps}}` du texte), la **trame** peut l'adapter, et le **document** (`Generateur.Feuille_de_style`) peut à son tour corriger l'une ou l'autre pour la seule pièce — sans que sa trame ni les autres documents changent. 44 trames et 6 formats sont livrés par défaut (`trames-defaut.js`) — dont le **rapport d'instruction**, une pièce comme une autre, signée par le rapporteur (usagers) ou par la commission d'instruction (enseignants-chercheurs). | Réglages › Trames et Formats (mise à la corbeille d'une trame, ou par lots) ; production des courriers, des rapports et des décisions. |
| `Identite` | *(facultative)* logo de l'opérateur affiché dans l'en-tête de l'outil, **charte graphique** (`Charte` : charte neutre par défaut, ou charte de l'État) et **police des documents** (`Police_documents`, facultative). La charte neutre écarte la marque de l'État et remplace Marianne par Public Sans ; la police réglée remplace celle de la charte dans tous les documents (voir § 9). | Réglages › Identité et Réglages › Charte graphique ; en-tête et pied de page de l'outil, documents rendus et exports. |
| `Considerants` | *(facultative)* le **répertoire des considérants de principe de l'établissement** : `Titre` (l'intitulé qui le fait retrouver, absent de la décision), `Rubrique` (l'intertitre du plan — compétence, procédure, prescription, requalification, matérialité, qualification, conséquences, appréciation, sanction, abandon, conclusions), `Nature` (principe, texte cité, enchaînement), `Texte` (ce qui s'insère dans la décision), `Tags` (thèmes, séparés par des virgules), `Source` (le texte ou la jurisprudence cités, jamais inventés), `Domaine` (code rural et de la pêche maritime / code de l'éducation), `Origine` (l'identifiant du considérant livré que cette ligne **adapte** et remplace) et `Usage` (nombre d'insertions dans une décision, qui classe le répertoire). L'outil livre son propre répertoire (`considerants.js`) : la table ne s'y ajoute que si l'établissement écrit le sien, et c'est alors **lui qui prime** sur le considérant livré qu'il déclare adapter. Les sources citées — par le répertoire, les catalogues et les trames — se réunissent et se datent dans Réglages › Catalogues › **Références** (voir § 8, invariant 24). | Atelier de rédaction d'une décision (`#decisions/<id>`), panneau « Considérants de principe » : recherche, filtres, glisser-déposer dans le texte. |

### 3.2 Tables d'affaire (une affaire = un dossier)

Toutes sont rattachées à une affaire, et supprimées avec elle (`parent` dans
`schema.js`) :

| Table | Rôle |
| --- | --- |
| `Affaires` | Le dossier : numéro, saisine (date, autorité, lettre), état, section, **voie de traitement**, faits, **date de connaissance des faits** (personnels), personne mise en cause, secrétaire, séance, heure de passage, motif, **composante** (facultative), et l'**adresse de son dossier de pièces** (`Lien_vers_le_dossier`) — le dossier, lui, est tenu hors de l'outil : c'est le seul lien qui y mène (voir § 8, invariant 25). Le **rapport d'instruction** — établi par le rapporteur (art. R.811-29 du code de l'éducation) ou par la commission d'instruction pour les enseignants-chercheurs (art. R.712-33) — n'y est plus un champ : c'est une **pièce**, produite comme un document à partir de la trame livrée du format « Rapport d'instruction ». Ses deux colonnes d'origine (`Rapport_d_instruction`, `Date_du_rapport_d_instruction`) restent lues pour les documents antérieurs, mais ne sont plus proposées à la saisie (`ancien: true`), et l'onglet « Documents » d'une affaire propose de reprendre leur texte dans un document. |
| `Jonctions` | Un **groupe d'affaires jugées par une même décision**. Chaque ligne porte l'**affaire de tête** (`Affaire_de_tete`, qui porte la décision commune), la liste des **affaires jointes** (`Affaires_jointes`, tête comprise), la date, le motif et les observations. La jonction est rattachée à son affaire de tête : elle disparaît avec elle. Aucune donnée n'est recopiée sur les affaires — leur appartenance est déduite (voir § 3.5), ce qui rend la jonction **réversible** : déjoindre une affaire, changer l'affaire de tête ou dissoudre le groupe se fait à tout moment, sans jamais toucher à la décision. |
| `Intervenants` | Qui instruit et qui juge : président de la formation, assesseurs, membres, **rapporteur** (membre de la section ou non), rapporteur adjoint, représentant des usagers, secrétaire de séance. Porte la qualité (membre / hors section / agent / extérieur), le statut (désigné, présent, absent, excusé, récusé, déporté, remplacé) et la date de désignation. |
| `Implications` | Les autres personnes du dossier : co-mis en cause, victime, témoin, défenseur, représentant légal, interprète. Porte la date d'information et d'audition. |
| `Seances_d_examen` | Les réunions : type (séance d'examen, réunion d'instruction, audition, entretien R.811-40), date, salle, adresse, lien de visioconférence. |
| `Decisions` | La décision : sa nature (**sanction**, **issue de procédure**, **décision interlocutoire**), le texte retenu, la motivation, les dates (délibéré, notification, accusé de réception), les durées d'exclusion et le sursis — et, pour une décision avant dire droit qui **reporte le terme de l'instruction**, la `Date_butoir_instruction` (voir § 3.5). Chaque décision peut recevoir son **numéro d'acte** (`Numero_acte`), séquence par section et par année, jamais réutilisée (voir § 8, invariant 23). Une affaire ne comporte qu'**une seule décision définitive** (sanction ou issue de procédure) ; les mesures qui ne règlent que la marche de l'instance (report, supplément d'instruction, expertise, audition) portent la nature « Décision interlocutoire » et peuvent être plusieurs. Seule une décision qui **prononce une sanction ou l'abandon des poursuites** est susceptible de recours : une mesure avant dire droit, un classement ou une relaxe n'en ouvrent aucun, et leur délai de recours calculé (`Recours_limite_le`) reste vide. |
| `Recours` | Les recours formés contre la décision : juridiction (**tribunal administratif** du ressort du siège de l'établissement pour un usager, **CNESER** — ou **CNESERAAV** pour un enseignant-chercheur d'un établissement d'enseignement supérieur agricole — voir § 8, invariant 16), type, date d'introduction, issue. |
| `Generateur` | Les documents produits pour l'affaire : trame choisie, texte propre éventuel (`Contenu`), date, statut d'envoi, décision rédigée (`Decision_liee`) et, pour désigner une personne ou une institution parmi celles que la trame vise, `Personne_destinataire` et `Destinataire_institutionnel`. La colonne `Feuille_de_style` — **vide tant que la pièce suit sa trame** — porte l'adaptation de la feuille de style propre à **ce document**. L'espace de rédaction montre le document **d'une seule feuille** : l'en-tête du service, puis ce que la trame apporte autour du texte (chapeau, signature, pied de page) et le texte lui-même, d'un seul tenant ; on y corrige n'importe quelle partie, et une correction n'écrit que pour cette pièce, sans toucher à la trame ni aux autres documents. `Contenu` et `Feuille_de_style` ne s'écrivent **que** lorsque la partie correspondante a bougé : tant qu'elle est fidèle à la trame, la pièce continue d'en hériter (voir § 8, invariant 17). Un document d'instruction y porte sa **date butoir d'instruction** (`Date_butoir_instruction`), qui fixe le terme de l'instruction — elle prime sur l'échéance de la procédure (voir § 3.5). L'**auteur** et le **destinataire** ne se règlent plus ici : ils sont programmés sur la trame. |
| `Journal` | Le registre des opérations : qui a créé, modifié ou supprimé quoi, et quand. En lecture seule dans l'interface. |

### 3.3 La corbeille

`Corbeille` est la table où va ce qu'on **met de côté** au lieu de le supprimer
définitivement : le **nom** de la ligne (`Nom`), sa **table** d'origine (`Table`,
et son libellé `Table_libelle`), l'auteur et la date de l'opération
(`Supprime_par`, `Supprime_le`), et son **contenu entier**, sérialisé en JSON
(`Contenu`).

- **Rien n'est détruit** : `mettreALaCorbeille` retire la ligne de sa table
  **sans cascade** — les documents qui citaient une trame mise de côté restent en
  place, sans trame, et la retrouvent à la restauration ;
- **rien n'est recopié** : `restaurerCorbeille` réinsère la ligne **avec son
  identifiant d'origine**, d'où la reconnexion automatique des références (un
  identifiant déjà repris — cas qui ne devrait pas se produire — en reçoit un
  neuf plutôt que d'écraser une autre ligne) ;
- `retirerDeLaCorbeille` et `viderCorbeille` effacent, eux, **définitivement**.

L'interface s'en sert pour les **trames**, seule table à disposer aujourd'hui de
la mise à la corbeille — une par une, par sélection, ou par lot sur tout ce que
les filtres affichent (Réglages › Trames). La table, elle, n'a rien de propre aux
trames : c'est le point de passage commun de toute mise à l'écart.

### 3.4 Table d'héritage

`Commissions` — la composition de la commission **telle que le document
d'origine la portait** — est conservée dans le schéma avec `legacy: true` :

- l'outil **la lit** encore, pour ne rien perdre d'un document qui n'a pas
  encore été importé ;
- il **ne l'écrit jamais** et ne l'exige jamais : un document neuf n'a pas
  besoin de cette table, et `installStructure` ne la crée pas ;
- l'onglet de composition d'une affaire la signale et propose de reprendre ses
  lignes dans `Intervenants` (action « Reprendre la composition ») — c'est la
  même conversion que celle de l'outil d'import, appliquée à une seule affaire.

### 3.5 Colonnes calculées

Les colonnes `formula: true` ne sont jamais écrites dans le document : elles
sont recalculées par `formulas.js`. Plusieurs **reprennent l'identifiant de
colonnes qui étaient saisies dans le document d'origine** (`Affaires.INE`,
`Affaires.Adresse`, `Affaires.Nom_complet`…) : les balises `{{Affaire}}.INE`
posées dans les trames continuent donc de fonctionner, alors que la donnée vit
désormais dans `Personnes`. C'est le principe de la reprise : **les balises
restent, le rangement change.**

Dans un document Grist reconstruit, ces colonnes sont créées comme des colonnes
ordinaires (`installStructure`), mais l'outil n'y écrit rien : c'est
l'application qui les calcule, affaire par affaire, au moment de l'affichage.
Un document neuf n'a donc pas besoin d'y porter les formules Python de
l'ancien tableur — celles du résumé (`Delai_de_traitement`, `Terme_de_la_sanction`…)
sont remplacées par les écrans « Tableau de bord » et « Décisions », qui les
calculent en direct.

Une colonne calculée peut **rendre une référence**, et non un identifiant :
`Generateur.Decision` vaut la décision définitive de l'affaire — le premier
enregistrement de `Decisions` dont la nature n'est pas « Décision
interlocutoire », et rien tant que le fond n'est pas tranché. Les balises
`{{Decision}}.Motivation` et `{{Decision}}.Libelle_decision` d'une trame
« Décision définitive » lisent donc, en direct, les champs saisis dans l'onglet
« Décision » : **une seule saisie, deux chemins**. Le développement des
références (`expandRecord`) résout aussi les colonnes calculées des
enregistrements référencés, d'où la valeur calculée `Libelle_decision`.

Quand l'affaire appartient à une **jonction** (§ 3.2), c'est la même colonne qui
suit la jonction, via `decisionDefinitive()` : une affaire jointe à une affaire
de tête prend pour décision définitive celle de sa tête, et l'affaire de tête
porte la sienne. Les quatre colonnes calculées que la jonction ajoute à
`Affaires` — `Jonction` (l'enregistrement de `Jonctions`), `Affaire_de_tete`
(nul pour la tête), `Affaires_jointes` (les numéros du groupe) et
`Mises_en_cause_jointes` (les autres personnes du groupe, avec leur numéro) —
sont toutes **déduites** de la table `Jonctions`, jamais stockées sur l'affaire :
c'est ce qui garantit qu'une jonction se défait proprement. Les trames peuvent
écrire `{{Affaire}}.Affaires_jointes` ou `{{Affaire}}.Mises_en_cause_jointes`
sans autre réglage.

**L'échéance d'instruction** obéit à la même règle : elle est **déduite**,
jamais stockée sur l'affaire. `butoirInstruction` (`formulas.js`) retient en
**priorité** la **date butoir d'instruction** que porte une pièce de l'affaire —
un document d'instruction (`Generateur.Date_butoir_instruction`) ou une décision
avant dire droit (`Decisions.Date_butoir_instruction`), l'affaire de tête
comprise pour une affaire jointe : c'est le terme que l'acte fixe, et il
s'applique **qu'il avance ou recule** le terme ; entre plusieurs dates butoirs,
la plus lointaine est celle en vigueur. À **défaut** seulement, l'échéance vient
du délai de la procédure — `procedure.js` : deux mois devant les usagers, quatre
mois devant les enseignants-chercheurs — **décompté depuis la décision de
désignation** qui ouvre l'instruction (`ouvertureInstruction` : le document
produit avec une trame `Ouvre_l_instruction`, à défaut la fiche du rapporteur).
Les quatre colonnes calculées qui en découlent —
`Date_butoir_instruction`, `Date_butoir_instruction_initiale`,
`Instruction_prolongee` et `Jours_restants_instruction` — se lisent dans les
trames, et le bandeau `echeanceInstruction()` (`views/common.js`) dit toujours
**quelle pièce** a fixé le terme : ni un acte ne peut donc passer pour
l'échéance de la procédure, ni l'inverse. Cette clôture se met en avant
**partout où l'affaire
se lit** : le bandeau en tête de l'affaire, l'étiquette `clotureTag()` et son
filet coloré dans la liste des affaires, et le panneau « Clôtures
d'instruction » en tête du tableau de bord — étiquette et panneau ne
s'affichent que lorsqu'une **date est notée**. Rien n'est calculé quand il n'y a pas d'instruction à
conduire : une affaire traitée par la voie de l'article R.811-40, close ou jugée
au fond n'en porte plus — et tant que la **désignation** n'a pas ouvert
l'instruction, il n'y a pas de délai à courir : le bandeau l'annonce, et le
contrôle le signale, plutôt que de compter depuis la saisine.

## 4. L'outil d'import

`src/import.js` porte la conversion ; `src/import-fichiers.js` lit les fichiers ;
`views/import.js` l'écran (Réglages › Import).

1. **Source.** Un **document Grist** (`.grist`), un **classeur** (`.xlsx`, `.xls`,
   `.ods`), un **fichier délimité** (`.csv`, `.tsv`), un export JSON de l'outil,
   ou le document Grist auquel l'outil est connecté (lecture directe des tables,
   y compris anciennes). Chaque feuille ou table de la source est rapprochée
   d'une table du modèle — par son nom, puis par ses colonnes — et cette
   affectation est montrée et corrigible à l'écran.
2. **Analyse.** L'outil reconnaît l'architecture d'origine (`legacy.js`) :
   tables et colonnes présentes, formulaire d'origine, contenu Quill des
   trames. Il produit un rapport : ce qui sera repris, ce qui sera créé, ce qui
   sera ignoré, et les points à vérifier à la main.
3. **Aperçu.** Le rapport est présenté avant toute écriture, avec le détail par
   table et les avertissements (personne mise en cause sans nom, commission
   vide, sanction inconnue du catalogue…).
4. **Application.** Deux modes : *Compléter* (ajoute au contenu existant) ou
   *Remplacer* (vide les tables de l'outil avant d'importer). L'import écrit
   dans le modèle v2, crée au passage les personnes, les implications, les
   intervenants, rattache les trames et complète les catalogues.
5. **Traçabilité.** Chaque import écrit une ligne de `Journal`, et le rapport
   reste affiché avec le compte des lignes créées.

L'import est **idempotent** : chaque table écrite porte une *clé naturelle*
(numéro d'affaire, courriel d'un secrétaire, libellé d'une sanction, affaire +
rôle + personne d'un intervenant…). Une ligne reçue qui correspond à une ligne
existante est rapprochée et mise à jour, jamais dupliquée — réimporté sur une
base déjà convertie, l'import n'ajoute aucune ligne.

Un fichier qui ne peut pas être lu (format inconnu, fichier vide, classeur ou
base illisibles, `.grist` qui n'est pas une base SQLite) **n'échoue jamais en
silence** : le message exact est conservé dans `state.import.erreur` et affiché
sous le bouton de choix, avec la liste des formats acceptés. La prise en charge
des champs de fichier (`fichierDuChamp`, `app.js`) écoute `change` autant
que `input` — un champ de fichier ne déclenche pas `input` partout — et ne vide
le champ qu'après la lecture, le vider avant libérant le fichier dans plusieurs
navigateurs. Voir `README.md` § 2 pour le détail.

**En mode Grist, l'import écrit dans le document.** La base locale n'étant
qu'une copie de travail du document, appliquer la source au seul magasin ne
changeait rien au document — l'import disparaissait donc au rechargement
suivant. `appliquerImport` envoie désormais au document, ligne par ligne, les
**seules lignes créées et complétées** (`appliquerDansLeDocument`) : un
réimport n'écrit rien, et les lignes existantes gardent leur identité. En mode
« remplacer », les lignes de l'outil sont d'abord retirées du document — jamais
celles des tables d'héritage. La conversion reste la même dans les deux modes ;
seul le chemin d'écriture change (`store.replaceAll` hors Grist, écritures du
magasin vers le document en Grist).

## 5. Reconstruire le document Grist

L'outil ne se contente pas de lire le document d'origine : il sait **créer chez
lui la structure dont il a besoin**, table par table et colonne par colonne
(`installStructure`, `src/grist-backend.js`). C'est le chemin de migration pour
un établissement déjà équipé :

1. **Installer la structure** — « Réglages › Données › Installer la structure »
   crée les tables manquantes (`Personnes`, `Intervenants`, `Implications`,
   `Recours`, `Sanctions`, `Motifs`, `Parametres`, `Journal`) et ajoute aux
   tables existantes les colonnes du modèle (`Affaires.Mis_en_cause`,
   `Decisions.Nature`, `Seances_d_examen.Type`…). Rien n'est supprimé, et une
   table de commission d'origine n'est pas recréée : elle n'appartient pas au
   modèle.
2. **Reprendre les données** — « Réglages › Import des données » convertit les
   lignes déjà saisies (voir §4). Sur un document connecté, l'outil lit les
   tables directement, sans fichier intermédiaire.
3. **Vérifier** — les affaires importées se contrôlent une à une (onglet
   « Synthèse », contrôles de régularité) ; le rapport d'import liste ce qui a
   été créé et ce qui n'a pas pu être relié.
4. **Nettoyer** — une fois la reprise vérifiée, les colonnes d'origine et la
   table de commission d'origine se suppriment **à la main** dans Grist :
   l'outil ne supprime jamais rien. Le rapport d'import donne la liste de ce qui
   n'est plus utilisé, et l'écran d'import en explique la correspondance,
   colonne par colonne.

Ce qui reste à Grist après la migration : le stockage des données, les règles de
partage et l'identité des utilisateurs (le widget n'a pas d'autre moyen de les
connaître). Ce qui n'y reste plus : les formules de confort et les tableaux de
résumé, remplacés par les écrans de l'outil.

## 6. Ce qui n'est pas dans le modèle

- **`Etablissements`** : une section reste rattachée à une structure unique
  (`Structure`, `Siege`, `Logo`), comme dans le document d'origine. Une section
  qui sert plusieurs établissements n'est pas modélisée ; elle se représente par
  une section par établissement, avec le même acronyme.
- **Suppression automatique des colonnes d'origine** dans le document Grist :
  l'outil ne supprime rien. Le rapport d'import liste les tables et colonnes
  devenues inutiles, à supprimer à la main une fois l'import vérifié.
- **Un agenda hébergé** : l'outil ne publie pas de flux calendaire permanent, et
  n'en publiera pas. Affiché dans un document Grist, il n'est joignable que
  depuis ce document, et un abonnement à un flux censé rester en ligne n'y
  fonctionnerait pas. La page **Calendrier** — l'entrée du menu où le temps de la
  section se lit d'un seul tenant, ses **échéances** (grille du mois, export) et
  ses **séances** (programmation, rôles) — produit donc des **événements** et un
  fichier `.ics` que chacun importe dans son agenda professionnel — un instantané
  du périmètre de la personne au moment du clic, sans rien stocker. Les échéances
  elles-mêmes ne sont pas stockées : elles se déduisent des dates de l'affaire et
  de la décision (saisine, convocation, prescription, terme de la sanction,
  expiration du délai de recours).

## 7. Vie privée

L'outil est un **client pur** : il n'a ni serveur, ni compte, ni base distante,
et n'émet aucune donnée vers l'extérieur. Toute la logique — contrôles de
procédure, calcul des délais, génération des documents, des exports et du
calendrier — s'exécute dans le navigateur.

- **Mode Grist** : les tables sont lues et écrites par l'API de widget du
  document, donc **à l'intérieur du document**. Aucun appel direct au serveur
  Grist, aucune donnée qui sorte du document.
- **Mode autonome** : les données restent dans le `localStorage` du poste et
  n'en sortent que par un export de fichier déclenché par l'utilisateur.
- **Réseau** : ne sortent de la machine que des téléchargements de **code** —
  le DSFR (jsDelivr) au chargement, et, à la demande, des bibliothèques de
  lecture ou d'export (sql.js, SheetJS, pdfmake, pdf-lib, docx, et les polices
  embarquées du PDF). Aucune
  requête ne transporte de donnée, et les requêtes sortantes ne portent aucun
  `Referer` (`no-referrer`).
- **Exception** : une colonne d'image contenant une adresse `https://…` fait
  charger cette image par le navigateur (lecture seule). Déposer le fichier
  l'évite.

Le détail de la vérification et la liste des destinations figurent dans
`README.md` (« Vie privée : tout s'exécute en local »).

## 8. Garanties de fonctionnement

Ces comportements sont tenus pour acquis par l'utilisateur : rien ne doit les
lui faire découvrir à ses dépens. Chacun est couvert par un contrôle de
non-régression dans le code.

1. **Les trames de délais par défaut n'existent qu'après identification.**
   Leur installation (`installerTramesParDefautSiVierge`) est un **écrit**, et
   dépend donc du rôle : sur un document déjà structuré, elle a lieu *après*
   `applyUserRole`, et seulement si le back-end est connecté. Sinon elle sort
   en silence — c'était le défaut corrigé : un document neuf et bien relié
   restait sans aucune trame.
2. **Une écriture refusée n'est jamais perdue.** Toute écriture que le
   back-end n'a pas pu appliquer (droit absent, règle de document, réseau) est
   retenue dans une file, signalée par un bandeau, et peut être **renvoyée**
   d'un clic (« Renvoyer les modifications en attente ») ou **téléchargée**
   (copie JSON, bouton « Export »). Quitter la page avec une file non vide
   déclenche un avertissement du navigateur (`beforeunload`). Un rôle sans
   droit d'écriture ne retient rien : la file est vidée, puisque le renvoi ne
   pourrait pas aboutir.
3. **Le document exporté ne connaît pas l'aperçu.** L'aperçu à l'écran et
   l'impression ont besoin de contraintes opposées : l'aperçu met la feuille à
   l'échelle de la fenêtre (`FIT_SCRIPT`, marge en ligne), l'impression exige
   une A4 pleine largeur. Le composant de document est donc appelé avec
   `preview: false` pour l'impression et pour les exports, et les styles
   critiques sont protégés par `!important` — sans quoi la marge en ligne de
   l'aperçu écrasait le texte sur la droite de la feuille.
4. **Une image d'en-tête manquante est dite, pas tue.** Un export PDF, Word ou
   OpenDocument intègre ses images : si l'hébergeur d'une image refuse la
   lecture croisée (CORS absent), les convertisseurs l'omettent en silence.
   L'outil relit donc l'image par un **relais** (`superFetch` sur Perchance) et,
   à défaut, **prévient** que le document part sans son bloc-marque. Les Réglages
   › Identité permettent d'enregistrer l'image **dans la base** (fichier lu sur
   le poste) : elle devient un `data:` URL, insensible au CORS et au réseau.
5. **Un document tient le nombre de pages qu'il doit tenir.** Le document est
   montré **en pages** : l'aperçu, la fenêtre d'impression et le PDF découpent
   le flux aux mêmes endroits — jamais au milieu d'un bloc —, répètent le pied
   de page au bas de chaque feuille et comptent **le même nombre de pages**
   (annoncé à côté de « Aperçu avant impression »). Un type de trame peut
   demander la **numérotation** (Réglages › Formats › « Pagination et pied de
   page ») : le pied de page porte alors « Page 2 sur 3 » ; `{page}` et `{pages}`
   se placent aussi à la main. Le même réglage peut demander le **numéro de
   l'affaire** au bas de chaque page (« Dossier n° … ») : il se pose à gauche de
   la ligne, la pagination à droite, et il se place aussi à la main avec
   `{numero}`. Une dernière feuille qui ne porterait aucun bloc est
   supprimée : un courrier ne part pas avec une page blanche. **Le PDF est du
   texte, non une image** : sa netteté ne dépend d'aucune résolution, et le
   fichier reste cherchable, copiable et lisible sur un poste qui n'a ni les
   polices ni le logiciel qui l'a produit — c'est ce qu'exige le format
   d'archivage **PDF/A-2b** produit par l'export. Les **images** qu'il incorpore
   gardent la taille où la feuille les affichait, et sont recopiées dans le
   fichier : rien ne dépend plus de leur hébergeur une fois le document exporté.
6. **Terminer la saisie d'un champ ne renvoie pas en haut de la page.**
   L'interface se reconstruit entièrement à chaque écriture (`render()`) : la
   position de défilement de la page, celle des zones défilantes — listes et
   corps de fenêtre modale, marqués `data-scroll` — et le champ en cours de
   saisie sont relevés avant le rendu et remis après (`captureView` /
   `restoreView`). Un champ qui change ce qui s'affiche ensuite (l'affaire
   choisie filtre les trames, la section filtre les voies de traitement) garde
   donc la vue en place, et ouvrir puis refermer une fenêtre modale laisse la
   page où elle était. Seules la navigation, le changement d'étape d'un
   assistant et les opérations qui remanient la fiche repartent du haut.
7. **Une section sans composante compte pour elle-même.** La composante est
   facultative ; quand l'établissement n'en suit pas, l'origine d'une affaire
   est sa **section disciplinaire** (`origineAffaire`, `src/views/common.js`).
   L'indicateur d'origines de la page Décisions compte donc les composantes
   lorsqu'il y en a, les sections sinon — jamais rien. Le filtre, la colonne du
   registre et le graphique ne s'affichent que s'il y a plusieurs origines à
   comparer, et leur intitulé suit ce qu'ils montrent : « Composante » dès
   qu'une composante réelle est suivie, « Section » à défaut.
8. **Le document n'est pas noyé sous les écritures.** Une frappe au clavier dans
   l'éditeur WYSIWYG, une ligne importée, un champ modifié : chaque changement
   est une écriture, et chaque écriture un aller-retour avec le document Grist.
   Les écritures retenues partent donc **par lots** (`grist-backend.js`,
   « Regroupement des écritures »), un lot par appel à `applyUserActions` ; un
   ajout ne part jamais dans le même appel que la ligne qu'il cite, faute de
   quoi Grist ne saurait pas la référencer. De même, **un geste ne provoque qu'un
   rendu** : les notifications du magasin sont rassemblées jusqu'à la fin de la
   tâche en cours (`planifierRendu`, `app.js`) — créer une fiche puis l'affaire
   qui la cite ne redessine plus la page deux fois. Ces deux règles sont ce qui
   empêche l'outil de paraître figé sur un document volumineux ; elles ne
   changent rien à ce que l'utilisateur voit, sinon la disparition de l'attente.
9. **Un remplacement en bloc laisse des références justes.** Restaurer un export
   ou remettre le jeu d'exemple réécrit le document table par table
   (`remplacerDocument`). L'ordre suit les colonnes **saisies** seulement : une
   colonne calculée peut citer une autre table sans qu'il y ait à l'écrire, et
   la suivre faisait écrire `Decisions` avant `Affaires` (chacune citant l'autre
   par une colonne calculée) — les décisions arrivaient alors avec des
   références non traduites, c'est-à-dire n'importe quelle affaire. Les lignes
   partent par lots, avec traduction des références vers les identifiants
   attribués par Grist, et un lot refusé est rejoué ligne par ligne pour que le
   refus se rapporte à sa ligne.
10. **Une date se saisit librement et ne se perd jamais.** Les champs de date
   sont des champs de texte (`ui.dateInput`), et non des champs natifs
   `type="date"` : le champ natif refuse le collage d'une date française et
   remet le champ à zéro dès que la valeur lui paraît incomplète — au moment où
   l'on tape l'année. Toutes les écritures courantes sont acceptées
   (`20/09/2026`, `20.9.26`, `20092026`, `2026-09-20`, un horodatage) et
   ramenées à la forme ISO `AAAA-MM-JJ` que connaissent le magasin et Grist.
   Pendant la frappe, une date encore incomplète est ignorée sans rien écrire ;
   à la fin de la saisie, une date illisible est **signalée sous le champ** et
   le champ revient à sa dernière valeur valable, plutôt que d'effacer en
   silence la date enregistrée. Les dates lues et proposées le sont au fuseau
   de l'utilisateur (`aujourdHui()`), et non en UTC.
11. **Un export de liste ne montre que ce que l'écran montre.** Les boutons
   « CSV » et « Excel » des listes et des registres (`export-table.js`) emportent
   les lignes **affichées**, dans leur ordre : périmètre de visibilité (un
   secrétaire n'exporte que ses affaires), recherche, filtres et tri compris.
   Les colonnes exportées sont celles du registre, et une **référence** y donne
   le libellé de ce qu'elle désigne — jamais un identifiant interne ; seuls les
   exports de la base entière (Réglages › Données) emportent toutes les colonnes
   de toutes les tables, et l'export **JSON** reste la sauvegarde réimportable à
   l'identique. Aucun de ces exports n'écrit dans la base : ils sont classés en
   lecture seule, donc ouverts aussi à un visiteur.

12. **L'auteur et le destinataire d'un document sont programmés sur la trame,
   et le signataire se règle au plus près de la pièce.** Une trame déclare qui
   la rédige (`Auteur`) et à qui elle s'adresse (`Destinataire`) ; la rédaction
   d'un document n'a donc plus à choisir ni émetteur ni destinataire, et les
   blocs de l'en-tête et de la signature du format en découlent (`redaction.js`
   est la source unique de cette résolution). Il reste, lorsqu'une affaire
   compte plusieurs victimes, témoins ou destinataires d'une qualité, à
   désigner lequel. Le **président de la section** est remplacé par son
   vice-président : le remplacement se déclare **sur le document** — case « le
   président est absent », à portée de main dans les paramètres de l'espace de
   rédaction, parce que l'absence est le plus souvent brève — ou, pour un
   remplacement durable, **sur la section** (Réglages › Sections et membres),
   où il vaut alors pour toutes ses pièces. Les deux réglages se cumulent : dès
   que l'un des deux l'affirme, le vice-président signe, et le document ne peut
   donc pas contredire un vice-président déjà en charge de la section. Le nom,
   la formule et la formule complète du signataire sont recalculés depuis les
   membres pour le rôle effectif (`signataire.js`), et **toutes** les balises
   du document — `{section_president}` comme `{{Affaire_Section}}.Formule…` —
   désignent le même signataire, à l'écran, à l'impression comme dans les
   fichiers PDF, Word et OpenDocument. Un rôle sans titulaire est signalé avant
   l'impression plutôt que de laisser un courrier sans nom.

13. **Un document est un format, un auteur et un destinataire — trois choses
   distinctes.** Le **format** (la feuille de style : courrier, attestation,
   décision) porte **le document entier** — l'en-tête du service, posé par
   l'outil, le chapeau, l'emplacement `{{Corps}}` où vient s'insérer le texte de
   la trame, la signature et le pied de page répété ; chaque trame **hérite** de
   cette feuille, et peut l'**adapter** quand un document demande une autre mise
   en page. L'**auteur** et le **destinataire** sont propres à chaque trame, et
   les variables `{…}` de la feuille en découlent.
   Les décisions ont leur feuille de style : celles du **président de la
   section disciplinaire** (l'organe — administratif pour les usagers,
   juridiction pour les enseignants-chercheurs) et celles du **président de la
   formation de jugement** (la commission de discipline, devant les usagers)
   sont nécessairement **avant dire droit**, et une affaire en comporte autant
   que nécessaire ; seule une décision de la **formation de jugement** peut
   trancher le fond, et une affaire n'en porte
   qu'une. Chaque décision rédigée se désigne sur le document (`Decision_liee`).
   **Un titre est un paragraphe, non une balise `<h1>`–`<h6>`** : sa taille est
   écrite en clair, dans l'échelle des outils de mise en forme (14 pt pour un
   titre de document, 12 pt pour un titre de plan), afin que l'auteur puisse la
   voir et la corriger ; les titres d'une base antérieure sont repris au
   chargement (`migrerTitres`, schema.js). Les **liens** sont soulignés d'un
   **seul** trait, posé sous les jambages : le trait de fond dont le DSFR
   habille chaque lien doublait le soulignement — un trait au-dessus, un trait
   en dessous — et la conversion en PDF le plaçait au milieu du texte ; il est
   éteint dans les documents comme dans la zone d'écriture. Le **renvoi
   extérieur** que le DSFR pose après un lien ouvert dans un autre onglet
   (`target="_blank"`) est éteint de la même façon, partout où du document
   s'affiche : un courrier donne une adresse, il ne renvoie pas « ailleurs », et
   le carré du renvoi, sous lequel le trait du soulignement passait, se lisait
   comme un second trait.

13. **Un retrait se compte en centimètres, et traverse toute la chaîne.** Le
   retrait d'un paragraphe — tout le bloc, ou sa seule **première ligne**, la
   marque d'un considérant — s'écrit sur le paragraphe, en centimètres, jamais
   en pixels d'écran : c'est une mesure du papier, et la même se retrouve dans
   la zone d'écriture, l'aperçu A4, l'impression, le PDF, le Word et
   l'OpenDocument. La touche **Tabulation** le donne d'un geste (première ligne
   au début d'un paragraphe, bloc entier ailleurs, niveau d'un point dans une
   liste) ; **Maj+Tab** le défait, **Échap** quitte la zone d'écriture, qu'une
   touche capturée n'enferme jamais. La commande native du navigateur n'est pas
   employée pour les paragraphes : elle empilait des citations imbriquées, que
   les exports ne savaient pas relire.

14. **Le rapport d'activité se compte par période, et rien n'y est inventé.** Le
   rapport (`rapport.js`) se lit sur une année — la dernière connue par défaut,
   ou toutes les années : une **affaire** compte à sa date de saisine, une
   **décision** à sa date de délibéré. Le périmètre des affaires s'y applique
   comme partout (le rapport d'un secrétaire est celui de ses affaires), et un
   indicateur **sans donnée n'est pas affiché** — un zéro ferait croire à une
   absence d'activité. Les **graphiques** (`graphiques.js`) sont dessinés une
   fois sur un canevas et rendus en images : le même dessin se voit à l'écran
   (fond transparent, couleurs du thème), s'imprime et s'exporte (fond blanc,
   encre noire, titre dans l'image), et se télécharge en PNG — un par graphique,
   ou tous dans une archive. Une série ordonnée (les douze mois) garde ses mois
   vides, une répartition écarte les parts nulles ; au-delà de neuf séries, les
   plus petites sont regroupées sous « Autres ». Les tableaux d'indicateurs
   s'exportent en CSV ou en classeur Excel, le rapport entier en PDF, Word ou
   OpenDocument. Toutes ces actions **lisent** la base : elles sont classées en
   lecture seule, donc ouverts aussi à un visiteur.

15. **Le président ordonne ; la formation décide — et le dispositif le dit.**
   Les actes **rendus** sont de deux sortes, et la distinction est celle du
   droit : le président de la section (l'organe) et celui de la formation de
   jugement (la commission de discipline, devant les usagers) règlent la marche
   de l'instance — leurs actes sont des **ordonnances**, nécessairement avant
   dire droit, et leur dispositif se lit **ORDONNE** ; la **formation de
   jugement** réunie rend des **décisions**, qui peuvent trancher le fond, et
   son dispositif se lit **DÉCIDE**. La catégorie du format le porte
   (`Ordonnance` / `Décision`, `Categorie`) : elle détermine l'entête
   (`{acte_type}`), les écrans de réglage et la trame qu'un document de décision
   peut prendre (`tramePourDecision`, qui ne retient que les trames de
   `Décision`). **La signature appartient à la feuille de style, jamais au
   corps** : une ordonnance est signée par le président de l'organe qui
   l'ordonne, une décision de la formation par le **président de la formation**
   et le **secrétaire** — les deux, portés par la feuille du format. Le
   squelette d'une décision, comme les trames livrées, s'arrêtent donc au
   dispositif (`echafaudageDecision`), et une base antérieure est reprise au
   chargement (`migrerActesRendus`, schema.js) : les formats du président
   deviennent des ordonnances, `DÉCIDE` y devient `ORDONNE`, et la signature
   répétée dans un corps de trame en est retirée.

16. **Les visas, la notification et le recours.** Un acte rendu vise les textes
   et la saisine sur lesquels il s'appuie. Les **ordonnances** portent leurs
   visas dans la **feuille de style de leur format** : le document s'ouvre par
   la formule de l'organe qui ordonne (`{f_ouverture}` — « Le président de la
   section disciplinaire, »), puis « **Vu** le code de l'éducation ; », le code
   rural et de la pêche maritime dans un établissement agricole
   (`{visa_code_rural}` : la variable est **vide** hors tutelle agricole) et la
   saisine de la section, datée et dirigée contre le mis en cause
   (`{date_de_saisine}`, `{mec_formule}`, `{mec_nom}`). Les visas sont ainsi
   portés **une fois** pour toutes les trames d'un même organe, et se corrigent
   à un seul endroit. Le corps des trames d'ordonnance commence donc au
   raisonnement (« Considérant ce qui suit : ») ; les **décisions** de la
   formation de jugement, elles, gardent leurs visas dans leur corps, où ils
   suivent les circonstances de l'audience. La constitution de la formation de
   jugement, œuvre du président de la section et non de la formation, est une
   **ordonnance** (trame livrée n° 35). Les **lettres de notification** ne
   portent que sur les **décisions des formations de jugement**. **Seule une
   décision qui prononce une sanction ou l'abandon des poursuites peut faire
   l'objet d'un recours** (`estSusceptibleDeRecours`, schema.js) : aucune autre
   décision — un classement, une relaxe, une décision avant dire droit — et
   aucune ordonnance, acte préparatoire, ne peut être contestée. Une décision
   insusceptible de recours a donc un délai de recours vide
   (`Decisions.Recours_limite_le`), l'atelier ne lui propose pas d'article de
   recours, aucun recours ne s'y ajoute, et les contrôles signalent une lettre
   de notification préparée sans décision comme un recours formé contre une
   décision qui n'en ouvre pas. La voie de recours suit le **public** : le
   **tribunal administratif** compétent dans le ressort duquel se trouve le
   siège de l'établissement pour un **usager** ; le **CNESER**, ou le
   **CNESERAAV** — Conseil national de l'enseignement supérieur et de la
   recherche agricole, alimentaire et vétérinaire — pour un
   **enseignant-chercheur** d'un établissement d'enseignement supérieur
   agricole (`juridictionRecours`, procedure.js ; les notifications livrées
   sont reprises par `migrerVoieDeRecours`, schema.js).

   Une **ordonnance** est en outre un pur **document** : elle ne rédige aucune
   décision, ne se lie donc à aucune (`Generateur.Decision_liee` reste vide —
   une base antérieure est reprise par `migrerActesRendus`), et sa palette ne
   propose pas les balises `{{Decision}}…`. Seule une trame de format
   **Décision** alimente une ligne de `Decisions` : celle qui porte le jugement
   (`Decision_definitive`) crée la décision **définitive** — unique dans
   l'affaire, portée par l'affaire de tête si elle est jointe —, les autres
   créent une décision **avant dire droit** (`doc-decision-creer`, app.js), que
   l'affaire peut porter en nombre et qui n'est pas susceptible de recours.

17. **Le document s'écrit d'une seule feuille, mais chaque partie suit sa
   source.** L'espace de rédaction d'un document (`#documents/<id>`) montre le
   document assemblé **d'un seul tenant** : l'en-tête du service, ce que la
   trame apporte autour du texte (chapeau, signature, pied de page) et le texte
   lui-même, sans bandeaux ni zones séparées (`assemblageDocument`,
   views/documents.js). On y corrige n'importe quelle partie pour **cette seule
   pièce**. Sous cette feuille unique, le modèle garde ses deux colonnes :
   `Generateur.Contenu` (le texte) et `Generateur.Feuille_de_style` (la feuille
   adaptée, autour de `{{Corps}}`). Deux **marques invisibles** encadrent le
   texte dans l'éditeur, et c'est elles qui séparent les deux à
   l'enregistrement (`decouperAssemblage`, app.js) ; chacune des deux colonnes
   n'est écrite **que si elle a bougé** — tant que la feuille est celle de la
   trame, la pièce en hérite, et y revenir mot pour mot **efface**
   l'adaptation (comparaison `htmlCanonique`, editor.js). Si les marques ont
   disparu — une correction a réuni le texte et la feuille —, la feuille
   s'enregistre **d'un bout à l'autre** (sans `{{Corps}}`), et
   `computeDocumentParts` (render.js) la rend telle quelle : le document reste
   juste, et suit alors sa propre feuille plutôt que celle de sa trame.

18. **Une décision définitive peut se publier sans ses noms.** Une décision
   disciplinaire se communique, se cite, s'annexe — et les personnes du dossier
   n'ont pas à suivre la décision partout. La barre d'export d'une décision
   **définitive** porte donc une case **« Export anonyme »** : cochée, les trois
   fichiers (PDF, Word, OpenDocument) désignent le mis en cause, les victimes et
   les témoins par « A. B. », « B. C. », « C. D. »… **dans l'ordre où ces
   personnes paraissent dans le document** (`anonymat.js`). Ce qui est effacé,
   ce sont les **personnes du dossier** — la personne mise en cause de
   l'affaire, celles des affaires jointes, et les personnes impliquées
   (victimes, témoins, défenseurs, représentants) ; les **membres de la
   formation** et le **secrétaire** gardent leur nom, sans quoi la décision ne
   se lirait plus. Seules les décisions **définitives** offrent l'option : un
   acte qui règle la marche de l'instance — ordonnance, décision avant dire
   droit — ne se publie pas comme un jugement. L'anonymisation se fait sur le
   **document rendu**, à l'export, et non dans le texte : c'est le seul endroit
   où l'on voit tout ce qui sera écrit, et donc le seul où l'on peut garantir
   qu'aucun nom ne subsiste. Le nom du mis en cause ne figure pas non plus dans
   le nom du fichier, qui porte la mention « anonyme ».

   L'espace de rédaction d'une **trame** (`#reglages/trames/<id>`) suit la même
   règle : la feuille de style de son format et le texte de la trame s'y
   écrivent **d'un seul tenant**, avec les mêmes marques invisibles
   (`enregistrerAssemblage`, app.js) — mais, ici, les deux colonnes sont
   `Trames.Feuille_de_style` et `Trames.Template_contenu`, et la référence de la
   feuille est celle du **format** : y revenir mot pour mot efface l'adaptation
   de la trame, qui se remet à en hériter. Le texte d'une trame, lui, n'a pas de
   source : il est toujours le sien.

19. **Une action, un endroit — et les sorties de fichier se replient.** Une page
   ne porte qu'**un** geste courant en tête (« Nouvelle affaire », « Créer une
   séance ») ; tout ce qui produit un fichier — imprimer, PDF, Word,
   OpenDocument, CSV, Excel — est réuni sous **un seul bouton « Exporter »**
   (`exportMenu`, `views/common.js`), un `<details>` qui se déplie sans
   JavaScript et dont les entrées gardent leurs attributs d'action : la
   délégation d'événements de l'application les reçoit comme si elles étaient à
   plat. Une même action ne se répète pas d'un panneau à l'autre — « Nouveau
   document » n'existe qu'en tête de la page Documents, « Nouvelle affaire »
   qu'en tête de la page Affaires et dans les raccourcis du tableau de bord. Un
   **bloc vide ne s'affiche pas** : une tuile dont la valeur est nulle
   disparaît, un dossier sans document se résume en une ligne au lieu d'une
   carte, l'analyse d'un import n'apparaît qu'après le choix d'un fichier.

20. **Une vue de détail se lit d'abord ; l'édition s'ouvre sur demande.** Dans
   la fiche d'une affaire, chaque bloc (`ui.fieldset`) se présente en **lecture**
   — libellés et valeurs, sans champ de saisie — jusqu'à ce que son bouton
   « Modifier » l'ouvre à la saisie (`state.affaires.edition`, action
   `affaire-edition`). Le rendu de lecture est celui que `ui.field()` produit
   déjà pour une colonne calculée ou verrouillée (`opts.lecture`) : il n'y a
   qu'une façon de montrer une valeur, et elle suit le type de la colonne. Tout
   ce qui est **secondaire** — contrôles conformes, valeurs déduites, procédure
   applicable, effets calculés d'une décision, recours, dictionnaire des
   variables, domaines du rapport d'activité — est replié par défaut
   (`panel({ collapsible: true })`). Au-delà de deux écrans, une **barre
   d'ancres** (`ui.anchors`) reste collée sous le haut de la fenêtre et mène à
   chaque partie de la page, ou bascule la vue du rapport entre graphiques et
   tableaux. Ses entrées sont des **boutons**, jamais des liens `#section` :
   l'application lit l'adresse pour savoir où elle se trouve, et un fragment de
   section l'enverrait vers une page qui n'existe pas (l'entrée porte
   `data-ancre`, l'action `data-ancre` fait défiler — d'un saut franc, un
   défilement animé étant ignoré par certains navigateurs).

21. **Une liste de définitions se compose selon la place disponible.** `.app-dl`
   (les paires libellé / valeur du détail d'une séance, des valeurs déduites,
   de l'état interne) est une **flexbox**, non une grille : la largeur du
   libellé se déduit de son texte, bornée à 11 rem, et la valeur prend tout le
   reste. En grille, la colonne des libellés s'élargissait jusqu'à son maximum
   sans regarder la place restante : dans une colonne d'un cinquième de page, la
   valeur ne conservait que quarante-quatre pixels, où le texte se coupait
   caractère par caractère — un panneau de six lignes faisait deux mille deux
   cent soixante-dix pixels de haut. Un composant qui doit vivre dans une
   colonne étroite se dimensionne sur son conteneur, jamais sur une largeur
   fixe.

22. **La place disponible se répartit ; le texte garde sa mesure.** Le
   conteneur du DSFR plafonne à 78 rem : sur un écran de 1920 px, la page
   laissait trois cent trente-six pixels vides de chaque côté. Toute la
   coquille — en-tête, navigation, contenu, pied de page — partage donc un
   plafond unique, plus large (`--app-shell-max`, 110 rem). L'élargissement ne
   se paie pas en lisibilité : les textes gardent une **mesure de lecture**
   (`.app-prose`, 78 ch ; `.app-page-head__sub`, 62 ch ; `.fr-hint-text`,
   `--app-mesure`, 70 ch), les contrôles d'une barre de filtres un plafond de
   largeur — la ligne se répartit alors **entre** eux plutôt que de les étirer
   — et les champs posés à même un panneau (onglet Debug) une largeur de champ
   de formulaire. Un tableau de données, lui, garde le défilement horizontal de
   son conteneur : ses colonnes ne se compriment pas.

23. **Un acte rendu porte un numéro, et le registre se reconstitue.** Chaque
   décision peut recevoir un **numéro d'acte** (`Decisions.Numero_acte`) :
   une séquence par section et par année, dans l'ordre chronologique des
   délibérés. Un numéro **n'est jamais réutilisé** — même après la suppression
   de l'acte : le rang attribué est le plus grand utilisé, plus un, jamais le
   premier trou. Chaque attribution est inscrite au `Journal`, l'acte
   s'identifie par son numéro (mention sur la décision, au registre et à
   l'export), et la page Décisions montre le registre — actes numérotés,
   premier et dernier, actes qui restent sans numéro — et l'exporte en CSV.

24. **Une référence citée est retrouvable.** Le répertoire de considérants, les
   catalogues et les trames ne citent pas n'importe quoi. L'outil réunit les
   sources citées par le répertoire et signale celles qui **ne sont pas
   identifiables** — une identité réduite à « M. X », à des initiales ou à
   « anonyme » ne se vérifie pas —, ainsi que les affirmations que l'outil ne
   peut pas adosser à une source (`aVerifier`, page Réglages › Catalogues ›
   Références). La date de la dernière vérification par le service juridique
   est un seuil (`references_verifiees_le`), faute de quoi l'écran dit qu'aucune
   vérification n'a été enregistrée : l'outil ne prétend jamais qu'une référence
   a été vérifiée.

25. **Le dossier de pièces d'une affaire a une adresse, et elle se retrouve.**
   Les pièces d'un dossier disciplinaire ne vivent pas dans l'outil : il n'en
   garde que l'adresse (`Affaires.Lien_vers_le_dossier`), qui ne vaut que si
   elle est **déclarée** et **ouvrable**. La déclaration complète un domaine
   saisi sans schéma et **refuse** ce qui n'est pas une adresse web
   (`urlDossier`, `dossier.js`) plutôt que d'enregistrer un lien mort ;
   l'adresse déclarée s'ouvre dans un onglet à part — jamais en place, où elle
   déchargerait la page du widget. Elle se rappelle là où l'on ouvre les
   pièces : le bandeau de l'affaire, sur tous ses onglets, et le rôle de la
   séance. Tant qu'elle manque, un contrôle de régularité le signale —
   `manquant` dès que l'affaire est instruite, examinée ou close —, et le
   tableau de bord compte les « Dossiers à déclarer ». Tous ces rappels sont
   **indicatifs** : ils n'empêchent aucune décision.

26. **La place et la taille des logos sont réglées par feuille de style.** Les
   deux images de l'en-tête viennent de la **section** — le bloc-marque de
   l'État (`Sections_disciplinaires.Marianne`) et le logo de l'établissement
   (`Logo`) —, mais leur **mise en page** se règle sur le **format**
   (`Types_Trames`) : `Marianne_position` / `Logo_position` désignent la zone de
   l'en-tête (gauche, centre, droite — `POSITIONS_LOGO`), `Marianne_largeur` /
   `Marianne_hauteur` et `Logo_largeur` / `Logo_hauteur` donnent la taille en
   millimètres. `enteteHtml` (`render.js`) en tire le balisage de l'en-tête :
   trois zones d'égale largeur, chaque image dans celle que sa position
   désigne. Une seule cote renseignée laisse l'autre **suivre** — les
   proportions de l'image sont conservées ; les deux la fixent exactement.
   **Rien de réglé reproduit la charte** — le bloc-marque à gauche à sa cote
   (27,42 mm), le logo à droite dans la zone de logotype (53 × 26 mm) —, et une
   valeur vide, illisible ou étrangère aux choix possibles y retombe. Le
   réglage vaut pour **tout le format**, donc pour ses trames et leurs
   documents, et l'export — PDF, Word, OpenDocument — le conserve : la rangée
   des logos s'y écrit en tableau sans filets (`flexRow`, `export-doc.js`), et
   l'image y garde la taille où la feuille l'affichait.

27. **Les champs d'une même ligne sont alignés, et l'aide se lit sous le champ.**
   Dans une **ligne de champs** — les colonnes d'une grille de champs, comme les
   champs d'une barre de filtres qui se suivent dans un `flex` —, les champs
   d'une même ligne visuelle présentent
   leur **libellé** et leur **contrôle** à la même hauteur, quelle que soit la
   longueur de leurs textes d'aide. C'est la conséquence d'une règle de
   présentation : le texte d'aide d'un champ (`def.desc`) se place **sous son
   contrôle**, et non dans son libellé comme le fait le DSFR pour un champ
   isolé — une aide de cinq lignes dans un libellé décalerait autrement tout le
   champ, et l'aligner au prix d'un vide du même ordre ne vaudrait pas mieux.
   Le lien est conservé pour qui ne voit pas le champ : l'aide est désignée au
   contrôle par `aria-describedby` (`field`, `ui.js`). Les cases à cocher et les
   boutons radio suivent la même règle, à leur mesure : leur contrôle est la
   case, posée à côté du libellé, et l'aide se place sous le **couple case +
   libellé**, alignée sur le texte du libellé.

   Dans une barre, la règle se heurte à une marge du DSFR : celui-ci pose
   `margin-bottom: 1.5rem` sous tout champ `:not(:last-child)`, pour espacer deux
   champs **empilés**. La barre alignant ses champs **par le bas**, cette marge
   — fantôme, puisque la barre espace par un `gap` — décollait tous ses champs
   sauf le dernier. La règle qui l'annule (`styles.css`) doit donc égaler la
   spécificité de celle du DSFR (0,2,0) ; `margin: 0` seul ne l'emportait que sur
   le dernier champ, celui auquel le DSFR ne touchait pas.

   L'alignement lui-même est
   **mesuré** après chaque rendu — la hauteur du libellé le plus haut de chaque
   ligne visuelle,
   publiée en `--champ-label-h` sur les cellules (`alignement.js`), que
   `styles.css` applique aux libellés (`min-height`), aux cases à cocher et à un
   bouton posé à côté d'un champ. La mesure est refaite quand la largeur change
   et quand un bloc repliable s'ouvre, et un contrôle composé — date, lecture
   seule, liste de cases — reprend l'écart de 0,5 rem du DSFR entre libellé et
   champ natif. Vérification : `verifierAlignement` (`tests/ecrans.test.js`)
   parcourt les écrans, les sous-pages de Réglages et les fiches — un document
   par trame, puisque ce sont elles qui portent les grandes grilles — et refuse
   toute ligne, grille ou barre, dont les contrôles ou les libellés ne sont pas
   alignés.
28. **Une liste déroulante se cherche, sans cesser d'être un menu.** Les menus de
   l'outil — personnes, affaires, sections, membres, trames — comptent des
   dizaines, parfois des centaines de valeurs, qu'un `<select>` natif présente en
   vrac. Au-delà de douze valeurs (`SEUIL_RECHERCHE`), la liste reçoit donc une
   **recherche** (`select-recherche.js`) : un champ où l'on tape, une liste qui se
   réduit, un choix au clavier (flèches, `Entrée`, `Échap`, `Origine`/`Fin`) ou à
   la souris. Une liste plus longue que la place qu'elle occupe se parcourt au
   défilement — molette, doigt, barre de défilement —, et le replacement de la
   liste sous son champ, déclenché par un défilement de la page, ne la renvoie
   pas à son premier élément. La comparaison ignore accent et casse, et classe
   les réponses du
   plus proche au plus lointain — ce qui **commence** par la requête, puis ce qui
   commence un **mot**, puis ce qui la contient —, l'ordre du menu départageant
   les égalités ; la partie trouvée est mise en évidence, le nombre de réponses
   est annoncé aux lecteurs d'écran, et une recherche sans réponse le dit tout
   haut. Le `<select>` d'origine, **masqué mais conservé**, reste la source de la
   valeur : choisir une proposition lui donne sa valeur, puis lui envoie un
   `change`, comme un choix natif — si bien que `data-bind`, `data-filter` et
   `data-action` continuent de fonctionner sans connaître le module, que l'entrée
   sans valeur reste proposée pour revenir à vide, et qu'un menu neutralisé par
   le rôle reste neutralisé. Les menus plus courts gardent leur forme native : la
   recherche est un **ajout**, jamais une contrainte (`data-recherche="non"`
   l'exempte). Un menu natif **groupé** le reste : les `<optgroup>` du
   `<select>` — les collèges des intervenants d'une affaire — sont redits dans la
   liste ouverte par un intertitre, et chaque proposition annonce son groupe (voir
   aussi l'invariant 29 : ce menu ne propose que des membres de la section).
   Vérification : `verifierRecherche` (`tests/ecrans.test.js`)
   parcourt les écrans et les fiches, ouvre chaque menu enrichi — y compris
   celui des intervenants, dans l'onglet de composition d'une affaire —, éprouve
   une recherche sans réponse et `Échap`, vérifie qu'une liste plus longue que sa
   fenêtre se laisse **défiler** — la position tenue ne revient pas à la première
   ligne — et que les groupes du menu natif sont redits — aucun groupe du
   répertoire des personnes n'y figurant —, et — sur un filtre seulement — le
   choix d'une valeur puis le retour à vide.

29. **La formation se compose de membres de la section disciplinaire, et la
   personne hors section se décide.** Le menu « Intervenant » d'une affaire — la
   colonne où l'on désigne qui instruit et qui juge — ne propose que les membres
   de la section à laquelle l'affaire appartient, groupés par collège ; le
   **répertoire des personnes** n'y figure pas, car on ne compose pas une
   commission avec n'importe quelle fiche du répertoire. L'intervenant qui n'est
   pas membre de la section — le rapporteur pris hors de la section, par exemple
   — se **décide** pourtant, explicitement : « Ajouter une personne hors
   section », à côté d'« Ajouter un intervenant », fait naître une ligne déjà
   marquée, où le nom s'écrit librement, et choisir « Saisie libre » dans la
   liste fait de même. La **qualité suit la source** (`qualiteIntervenant`,
   `procedure.js`) — une fiche de membre fait un intervenant de la section,
   l'absence de fiche un intervenant hors section — sans jamais écraser une
   qualité délibérée (« Agent de l'établissement », « Personnalité extérieure »).
   Une fiche qui porte **déjà** une personne du répertoire, choisie avant cette
   règle, garde ce choix affiché — seul, sous « Hors section » —, sans qu'il soit
   proposé aux autres : la règle dit ce que la liste **propose**, et une sélection
   qui s'évanouirait ferait croire à une saisie perdue. Vérification :
   `verifierRecherche` (`tests/ecrans.test.js`) contrôle, sur le menu groupé des
   intervenants, qu'aucun groupe du répertoire n'est proposé ; un cas de harnais
   éprouve la qualité déduite de la source (`qualiteIntervenant`).

30. **Un acte rendu — décision ou ordonnance — se rédige dans son atelier, et
   ses articles se numérotent comme ses considérants.** L'onglet « Décision »
   d'une affaire ne se borne pas à enregistrer le résultat : « Rédiger la
   décision » (`rediger-decision`, `app.js`) crée le texte de la décision s'il
   n'existe pas encore — la mécanique de « Créer le texte de la décision »,
   partagée (`assurerTexteDeDecision`) — puis ouvre l'atelier (`#decisions/<id>`),
   sur la décision définitive comme sur chaque décision avant dire droit. Le
   registre des décisions garde le même chemin, par la ligne. L'atelier — et
   l'espace de rédaction d'un document de format **Décision** ou **Ordonnance** —
   porte le **répertoire des considérants de principe**, d'où le texte se glisse,
   et deux gestes de numérotation, qui écrivent le numéro **dans le texte** (il
   survit à l'impression, au PDF, au Word et à l'OpenDocument, où un compteur ne
   serait pas rendu) : « Numéroter les considérants » pose `1.`, `2.`, `3.`… dans
   l'ordre du texte, sans repartir à chaque intertitre
   (`numeroterConsiderants`), et « Numéroter les articles » pose « Article 1er »,
   « Article 2 »… devant les articles du dispositif (`numeroterArticles`,
   `views/decision-redaction.js`). L'intitulé d'un article se reconnaît à son
   **deux-points** (`estIntituleArticle`, `formules-decision.js`) : une citation
   qui commence par « Article R.811-13 du code de l'éducation… » reste un
   considérant, et les formules livrées du dispositif sont marquées `article`
   pour que le geste les prenne toutes. Ces deux gestes sont **des gestes, non
   des réglages** : une renumérotation silencieuse changerait le sens d'une
   citation déjà faite en séance. Vérification : deux cas de harnais (§ 8.30)
   — l'intitulé reconnu, la citation du code non, et **chacune** des formules
   livrées du dispositif —, et l'épreuve à la main du geste depuis l'onglet
   « Décision », dans l'atelier et sur une ordonnance.

31. **Les actions d'un bloc se rangent au bord droit, et une icône porte la
   classe qu'on lui donne.** Dans un même conteneur — les blocs d'une fiche, les
   panneaux d'une page —, le bouton d'action d'un bloc s'aligne sur le bord droit
   des autres : c'est ce qui fait que les « Modifier » d'une fiche se répondent
   verticalement. Une en-tête repliable porte un repère de plus (`+` / `–`) :
   posé **à droite**, il décalait le bouton de sa largeur — le repère se range
   donc **à gauche du titre** (`.app-fieldset--collapsible`, `styles.css`), et
   l'en-tête d'un bloc repliable, qui est un `<summary>`, reçoit par ailleurs la
   remise en `border-box` que la page applique au contenu des `<details>`
   (`details > summary`) : sans elle, les boutons qu'il porte prennent la hauteur
   de leur rembourrage en plus de la leur. De même, la classe passée à une icône
   (`icon("alert-line", 'class="fr-mr-1v"')`, `ui.js`) s'**ajoute** à celle du jeu
   d'icônes : émise en second attribut `class`, le navigateur l'ignorait —
   l'icône se collait à son libellé dans tous les boutons de l'outil, et le
   repère « ouvrir » d'une ligne de liste perdait le gris des mentions.
   Vérification : `verifierAlignement` (`tests/ecrans.test.js`) mesure, sur
   chaque écran et chaque fiche, l'écart des bords droits des **actions de bloc**
   d'un même conteneur, en plus des lignes de champs ; un cas de harnais
   (§ 8.31) éprouve `icon`.

32. **Un menu déroulant reste dans la fenêtre.** Le panneau d'un menu
   (`.app-menu`, `styles.css`) s'ancre au bord **droit** de son bouton — le bon
   ancrage tant que le bouton est près du bord droit de la fenêtre, ce qui est le
   cas d'une tête de page sur un écran large. Sur un écran **étroit**, la ligne
   d'actions se replie et ses boutons repartent du bord gauche : le panneau, large
   de 16,5 rem, s'ouvrait alors à 103 px **hors** de la fenêtre, et la moitié de
   ses entrées devenait invisible et incliquable — un défaut que seule la mesure
   montre, le balisage restant correct. `menus.js` mesure le panneau et le ramène
   d'un décalage horizontal (`translateX`, l'ancrage et la mise en page ne
   changent pas). La mesure se prend au **clic** sur le résumé — qui précède
   l'ouverture du bloc, et où le panneau porte déjà ses cotes : le panneau est en
   place avant d'être peint, et ne saute pas d'un bord à l'autre sous les yeux. Le
   `toggle` est écouté en filet de sécurité — l'ouverture au clavier ou par le
   code ne passe pas par un clic —, et un redimensionnement pendant qu'un menu est
   ouvert le replace. Vérification : `verifierMenus` (`tests/ecrans.test.js`)
   éprouve le replacement sur des panneaux **montés hors** de la fenêtre — deux
   cas qui ne dépendent pas de la largeur courante —, puis, sur chaque écran de
   `NAV`, que le panneau d'un menu réellement ouvert reste dans la fenêtre ; le
   second volet se lance à une largeur étroite, comme le contrôle d'alignement.

33. **La barre de navigation tient sur une ligne, ou se replie dans un menu.**
   Neuf entrées ne tiennent pas sur un écran de téléphone : repliées, elles
   occupaient quatre rangs et 235 px, et l'en-tête, la barre, le bandeau et la
   tête de page repoussaient le premier panneau **sous la fenêtre** (918 px pour
   844 px de haut). Deux barres sont donc rendues : la barre alignée
   (`.app-navbar__list--desktop`), cachée en deçà de 48em, et la barre repliée
   (`.app-navbar__mobile`, un `<details>` dont le résumé annonce la page
   courante), cachée au-delà — le repli reste un `<summary>`, il s'ouvre au
   clavier comme au doigt, et le rendu suivant le referme (la coquille est
   reconstruite à chaque navigation). Vérification : le test de fumée parcourt
   tous les écrans de `NAV` ; la barre se contrôle à 390 px **et** au-delà de
   48em (une seule des deux barres est visible, et ses entrées sont celles du
   menu).

34. **L'en-tête défilé laisse ses commandes sur la barre de navigation.** La
   barre de navigation est collée en haut de la fenêtre (`position: sticky`), et
   l'en-tête ne l'est pas : en défilant, le titre du service — et avec lui le
   bouton « Nouvelle affaire » et le bloc de compte — quittent la vue. Or ces
   deux commandes sont celles dont on se sert à tout moment : créer une affaire,
   vérifier sous quelle identité on travaille. Elles **paraissent donc sur la
   barre** dès que le bas de l'en-tête a franchi le haut de la fenêtre, et
   s'effacent avec lui : un état du document (`entete-reduite` sur `<html>`,
   `entete-defilant.js`) et une animation courte. Le balisage des deux barres est
   écrit une fois pour toutes (`outilsBarreHtml`, `app.js`), la copie masquée
   n'étant ni visible, ni focusable, ni annoncée.
   Elles se rangent **sur le rang des onglets**, à leur droite — la barre est une
   ligne souple (`.app-navbar > .fr-container`), les onglets gardent la gauche,
   les commandes vont au bord droit. La barre **ne grandit donc pas** quand elles
   arrivent : rien ne bouge sous elles, ni la page, ni les barres collées qui
   s'adossent à sa hauteur. La place qu'elles demandent est prise aux onglets, qui
   se replient sur un rang de plus s'il en manque ; et quand les onglets
   remplissent déjà le rang, les commandes passent sur un second rang, à droite,
   plutôt que de les comprimer. C'est la **place** qui décide, et rien
   d'autre — en deçà de 48em, la barre étant repliée dans un menu, il n'y a plus
   de rang à partager : les commandes reprennent leur propre ligne sous lui, et
   c'est la hauteur qui s'ouvre, avec le glissement d'origine.
   L'animation est **menée par le script**, et non par une transition CSS : les
   transitions ne s'avancent pas dans tous les cadres où l'outil s'affiche —
   l'aperçu de l'éditeur se déclare masqué, et son horloge d'animation reste à
   zéro —, et une transition arrêtée à son départ laisserait les commandes
   invisibles alors que la page a bel et bien basculé ; un délai de secours efface
   les styles posés si aucune image n'arrive, de sorte que l'état décrit par la
   feuille de style s'applique même sans animation. Son **sens suit la mise en
   page** : la largeur du bloc en rang partagé, sa hauteur quand il tient sa
   propre ligne. Fermé, le bloc est effacé dans les **deux** dimensions : sans la
   hauteur, il laisserait une ligne vide sur les pages où les onglets remplissent
   le premier rang. Le focus, lui, revient à la copie **visible** du déclencheur —
   les deux exemplaires du même bouton coexistent dans la page.
   Le module publie aussi la **hauteur de la barre** en `--app-navbar-h`, dont
   s'adossent les autres barres collées de la page : le sommaire d'ancres d'une
   page longue (`top: 0` jusqu'ici) se collait **par-dessus** la barre, qui
   disparaissait sous lui dès qu'on défilait, et les colonnes d'outils — à hauteur
   fixe, 4,5 rem — passaient sous la barre quand celle-ci tenait sur deux rangs.
   La bascule vaut **dans un widget Grist comme dans un onglet** : le cadre d'un
   widget défile pour lui-même, `position: sticky` s'y accroche de la même façon,
   et un cadre court est celui où une barre qui reste sert le plus. La barre y est
   seulement plus mince (ses entrées se resserrent d'un cran) : chaque pixel de la
   barre est pris sur le contenu. Elle ne se laisse **que** là où la position
   calculée n'est pas `sticky` — une intégration ou un mode d'impression qui la
   laisse dans le flux éteint la bascule sans qu'aucun code n'ait à nommer le
   cadre. Seule la colonne collée des ateliers reste, dans un widget, dans le flux
   (`.app-embedded`, `styles.css`).
   La position est surveillée par l'écoute du défilement et du redimensionnement,
   doublée d'un contrôle périodique (100 ms) : les événements de défilement ne
   sont pas délivrés dans tous les cadres, et une hauteur qui change **sans**
   défilement — le logo de l'opérateur qui arrive — ne réveille aucune écoute.
   Vérification : `verifierEntete` (`tests/ecrans.test.js`) défile chaque écran
   témoin, vérifie que la barre tient le haut de la fenêtre et que rien ne la
   recouvre (ce qui est **peint** au point des onglets est bien la barre), que les
   commandes y sont visibles et à leur place, que les barres collées se collent
   **sous** elle, et que tout revient en place au retour en haut. Il relève aussi
   la **place** que les onglets et les commandes demandent ensemble, et vérifie
   que la barre a pris l'état que cette place appelle : même rang quand tout y
   tient — sans chevauchement, et sans que la barre grandisse —, second rang
   sinon. Le contrôle est rejoué en mode **embarqué** (`embarque: true` : la
   classe `.app-embedded` est posée sur `<html>` le temps du parcours) et à deux
   largeurs (le repli et le rang partagé) : il échoue sur les versions
   précédentes — la barre n'était pas collée dans un widget, et les commandes
   occupaient **toujours** un second rang.

35. **L'espace de rédaction donne la place au texte, et marque le point de
   dépôt.** Le texte d'un document est ce qu'on vient y écrire : la colonne
   d'outils qui le borde ne prend pas plus du **tiers** de la largeur, ni moins
   que son **plancher** (14 rem ; 18 rem dans l'atelier d'une décision, dont le
   répertoire des considérants demande plus de place). Le partage se fait **au
   prorata** — `.app-doc__atelier { flex: 3 1 0 }`,
   `.app-doc__outils { flex: 1 1 0 }`, plafonnée à 22 rem (25 rem pour une
   décision) — et non par une largeur fixe : sur un écran de 1045 px, la
   largeur fixe de 22 rem laissait à la feuille 566 px, pour un texte de
   487 px, les trois quarts seulement de la mesure A4 (21 cm) que l'aperçu, le
   PDF et le Word lui donnent. La feuille garde cette **mesure A4** : elle
   l'atteint dès que la place le permet et ne la dépasse pas, et la replier —
   la colonne se réduit alors à ses deux onglets, 2,6 rem — rend toute la
   largeur au texte. C'est la largeur de l'espace de rédaction, et non celle de
   la fenêtre, qui décide si les outils tiennent à sa droite : sous 59 rem
   (62em de fenêtre), ils passent **dessous** et prennent la ligne, plutôt que
   de réduire le texte à une colonne.
   La colonne d'outils est un **conteneur de requête** à son tour
   (`container: outils / inline-size`) : les grilles de champs du DSFR se
   coupent sur la largeur de la **fenêtre**, non sur celle de la colonne, et
   sous 20 rem ses champs reprennent donc la largeur entière — sans quoi un
   champ de date n'y montrerait plus que deux caractères de sa valeur.
   Le **point de dépôt** d'une balise se voit pendant le glisser : une barre
   (`.app-drop-caret`, `editor.js`) marque l'endroit exact où la pastille
   tombera, et le fantôme du geste est **réduit à la balise** et décalé
   (`reduireFantome`, `setDragImage`), de sorte qu'il ne la recouvre pas. Le
   repère est fixé au **document**, jamais posé dans la zone rédactionnelle —
   dont le contenu est enregistré tel quel, où une balise de repère serait prise
   pour du texte.
   Vérification : `verifierRedaction` (`tests/ecrans.test.js`) mesure chaque
   espace de rédaction — part de la colonne d'outils, plancher, mesure A4,
   champs de la colonne étroite, repli, empilement — et éprouve le dépôt hors
   des écrans, sur un espace monté pour lui (le repère suit le point visé, la
   balise s'y insère et non au curseur, le fantôme ne reste pas). Il **échoue
   sur la version précédente** : la colonne d'outils y prend 352 px, plus du
   tiers de 997 px.

36. **Les membres d'une commission s'écrivent d'un seul bouton.** Le panneau
   Contacts d'une affaire ne compte pas les rôles pour eux-mêmes : la commission
   est faite de son président, de ses rapporteurs et de ceux qui y siègent
   (R.811-27 et s.), et c'est à la commission **entière** que « Écrire aux
   membres de la commission » adresse son courrier. Le lien `mailto:` réunit
   donc les adresses des trois groupes, chacune une seule fois — une personne ne
   s'écrit pas deux fois parce qu'elle porte deux rôles —, et l'intitulé en
   annonce le nombre, l'infobulle en donnant les noms. Les deux boutons
   particuliers — « Écrire au président de la commission », « Écrire aux
   rapporteurs » — subsistent : informer toute la commission n'empêche pas de
   n'écrire qu'à l'un de ses membres.
   Vérification : `verifierContacts` (`tests/ecrans.test.js`) ouvre chaque
   affaire de la base, lit les liens du panneau Contacts et vérifie que le
   bouton des membres reprend **toutes** les adresses du président de la
   commission et des rapporteurs, que le nombre annoncé est celui des adresses
   distinctes et que l'infobulle les nomme.

37. **Un document rendu ne porte aucune balise brute, et son texte n'est pas un
   pied de page.** L'espace de rédaction propose les deux familles de balises
   dans une même palette — les variables `{…}` de la feuille de style et les
   balises de données `{{…}}` du texte —, et la pastille de chacune montre déjà
   la valeur qu'elle produira : aucune ne peut donc survivre à l'écriture. Le
   corps du document est rendu par `renderDocumentBody` (render.js) — repères de
   pagination (`{page}`, `{pages}`), puis variables de la feuille, puis balises
   de données —, et les deux bords de la feuille reçoivent le rendu des données
   qu'ils nomment. Une balise non résolue se **vide** (comme toute balise
   inconnue, `renderTemplate`) : rien de brut n'atteint l'aperçu, l'impression,
   le PDF, le Word ou l'OpenDocument. Le même rendu s'applique au **texte figé**
   (`freezeDocumentBody`).
   L'emplacement du texte (« Texte de la trame ») peut être déposé **dans le
   pied de page** : la feuille est alors partagée au début de ce pied, jamais à
   l'endroit de la balise, car **un pied de page ne contient pas le corps du
   document**. Sans cette règle, le corps entier était enveloppé dans le pied
   répété : Word et l'OpenDocument le recopiaient au bas de chaque page, et le
   PDF lui réservait sa hauteur mesurée dans la marge basse — le document
   s'étalait alors sur une page par ligne.
   Vérification : harnais (`invariants.test.js`) — le texte rend une variable de
   la feuille, une balise de donnée et les repères de pagination sans laisser
   aucune accolade, et `decouperFeuille` place le texte avant le pied de page
   quand l'emplacement y tombe, y compris dans un pied imbriqué.

38. **Une date s'écrit en français, et dit ce qu'elle nomme.** Dans l'interface
   comme dans les documents, une date en toutes lettres suit la forme de la
   rédaction administrative : le quantième **sans zéro**, et « 1er » le premier
   du mois — « 1er janvier 2026 », « 5 mars 2026 » (`jourDuMoisFr`, formulas.js).
   La balise du moteur s'y range : `@long` rend le quantième en toutes lettres
   (`Do MMMM YYYY`), `@full` y ajoute le jour de la semaine, et seuls les motifs
   **chiffrés** (`@short`, `@iso`) gardent le zéro de leur quantième. Les
   variables de l'en-tête (`date_formatee`, `date_de_saisine`) suivent la même
   règle, si bien que la date d'un chapeau et celle d'une donnée du texte
   s'écrivent pareil.
   La date d'une **séance** se lit sur l'affaire : `Seance_d_examen_Date`
   résout la séance que l'affaire désigne, par la valeur **calculée** de
   `Seance_d_examen` (`c.byId`) — la lire par `c.ref`, qui ne voit que les
   colonnes brutes de l'enregistrement, la rendait toujours vide, et un
   justificatif, une convocation ou une décision s'écrivait sans date.
   Vérification : harnais (`invariants.test.js`) — la forme française du
   quantième et des motifs de date, et la date de séance d'un document.

39. **Une colonne calculée se lit par le moteur de formules, jamais sur la
   ligne brute.** Une colonne calculée (`formula: true`) n'est **jamais
   écrite** : l'enregistrement ne la porte pas. La lire directement — `ligne.Nom_complet`,
   ou `c.ref(…).Date_de_naissance`, qui ne voit que les champs bruts d'un
   enregistrement référencé — rend une valeur **vide** sans que rien ne le dise.
   L'état civil d'une affaire vivant dans `Personnes`, cela vidait le nom du mis
   en cause et l'INE du **registre des décisions**, le nom et le libellé du
   **registre des actes**, l'état pour versement, et la date de naissance des
   **lettres de saisine**. Les formules lisent ces colonnes par `c.v` — ou par
   `vOuBrut` (`Context`, formulas.js), qui préfère la valeur calculée et retombe
   sur le champ brut pour les lignes antérieures à la reprise dans `Personnes` ;
   les écrans qui lisent des enregistrements bruts (`registreActes`,
   `lignesVersement`, `piecesDuDossier`) passent par lui aussi. Un contrôle
   instrumenté des vingt-cinq écrans — toute lecture d'une colonne calculée sur
   une ligne brute est signalée — ne relève plus aucune lecture de ce genre.
   Vérification : harnais (`invariants.test.js`) — le nom d'une affaire, l'INE
   lu par une décision, la date de naissance lue par un document, le repli sur
   le champ brut, et les colonnes du registre des actes.

40. **Les effets en ligne s'appliquent aussi aux pastilles.** Dans l'espace de
   rédaction, une balise est une pastille — un îlot insécable
   (`contenteditable="false"`). Le navigateur applique ses commandes de mise en
   forme (gras, italique, souligné, barré…) au texte, mais ignore la pastille
   pour l'italique, le souligné et le barré, **sans le dire** (la commande rend
   `true`) : la pastille restait en romain quand le texte passait en italique,
   alors qu'elle montrait déjà la valeur produite. `basculerEffet` (editor.js)
   laisse le navigateur faire son travail sur le texte, puis ramène chaque
   pastille touchée au sens de la bascule — enveloppée quand l'effet
   s'applique, dégagée (par découpe du porteur autour d'elle, sans toucher au
   texte voisin) quand il se retire ; « Effacer la mise en forme »
   (`delaverPastilles`) dégage de même la pastille de tout ce qui ne fait que
   la mettre en forme. L'effet s'enregistre avec la balise redevenue texte, et
   le document le rend. La découpe (`detacher`) **déplace** le passage, elle ne
   le clone pas : la pastille dégagée reste la même, et les effets empilés se
   retirent un par un.
   Vérification : harnais (`invariants.test.js`) — gras, italique, souligné et
   barré appliqués puis retirés d'une pastille, « Effacer » sur une pastille en
   italique souligné, et l'effet enregistré avec la balise.

41. **Une écriture non encore envoyée au document survit au rechargement, et ne
   s'applique jamais en silence.** Les écritures partent vers Grist par lots,
   après un court silence : recharger la page (ou la voir déchargée par le
   navigateur) avant l'envoi effaçait la file d'attente, et le rechargement
   relisait le document — la modification semblait enregistrée alors qu'elle
   n'avait jamais atteint le document, **sans bandeau**. La file est donc
   mémorisée dans le navigateur à chaque mouvement (`sauvegarderOutbox`,
   grist-backend.js), avec l'image d'avant modification de chaque mise à jour.
   Au branchement suivant, chaque écriture retrouvée est triée
   (`classerReprises`) : ligne intacte depuis — elle est réappliquée à l'écran
   et renvoyée ; ligne disparue ou modifiée entre-temps — elle est écartée et
   nommée dans le bandeau, jamais réécrite par-dessus le document. Le bandeau
   propose le renvoi, une copie de secours, ou l'abandon explicite ; quitter la
   page tant qu'il est affiché est annoncé comme une perte. Une chasse à la
   fermeture (`pagehide`, visibilité masquée) demande l'envoi immédiat de ce
   qui attend, pour ne pas dépendre du rechargement.
   Vérification : harnais (`invariants.test.js`) — le tri des reprises
   (intacte, modifiée depuis, disparue, ajout, suppression).

## 9. Habillage des documents rendus

Les documents produits — courriers, décisions, attestations, états imprimés —
ne portent pas la charte du site, mais la charte en vigueur. La feuille `DOCUMENT_CSS`
(`src/render.js`) et son complément `PRINT_CSS` (`src/print.js`) appliquent :

- la police **Marianne**, avec Arial pour repli (repli officiel de la charte) —
  c'est la base : voir la section « Charte et police » en fin de chapitre ;
- les jetons de couleur du DSFR, **écrits en clair** — `#161616` pour les
  titres, `#3a3a3a` pour le texte courant, `#ddd` pour les filets, `#f6f6f6`
  pour les fonds, `#000091` pour les liens, `#666` pour les mentions. Un
  document converti ou imprimé hors connexion n'a plus la feuille du DSFR pour
  fournir ces variables, et doit rester juste ;
- un **rythme de courrier** : paragraphes détachés les uns des autres, air
  autour des titres, tableau sans grille (filets `#ddd`, en-tête en gras sur
  fond `#f6f6f6`) ;
- des **liens soulignés en bleu France**, lisibles sur une impression en noir et
  blanc comme dans un fichier Word ;
- une **marge de 2 cm** sur la feuille A4 : c'est la marge d'un courrier
  administratif. Elle est tenue par une seule constante (`MARGIN_MM`, 20 mm,
  `export-doc.js`) et par le rembourrage de `.page` : aperçu, impression, PDF,
  Word et OpenDocument ont donc la même mise en page. Y toucher demande de
  changer les deux ;
- un **en-tête calé sur la ligne de tête**, à la composition de la charte : à
  gauche le **bloc-marque de l'État à sa taille officielle** (27,42 × 24,08 mm,
  drapeau de 4,25 mm — la taille du modèle de papier à en-tête de la charte),
  à droite le **logo de l'établissement borné à l'emplacement de l'opérateur**
  (53 × 26 mm). Les deux sont alignés par le **haut** (`align-items: flex-start`)
  et non centrés : l'identité de l'État se lit d'abord, comme sur le modèle de
  courrier ; un logo d'établissement plus haut ne la fait plus descendre ni
  passer au second plan.

Le **PDF** est **composé** à partir de la feuille : paragraphes, listes,
tableaux et images y deviennent du **texte**, écrit dans une **police
embarquée** — le fichier s'ouvre, se cherche et se copie, et reste lisible sur
un poste qui n'a ni la police ni le logiciel qui l'a produit. Il est converti au
format d'archivage **PDF/A-2b** (profil sRGB et métadonnées XMP joints). Les
fichiers **Word** et
**OpenDocument** reprennent ce que leur format sait exprimer — graisse, couleur,
taille, police du passage, surlignage, bordures et fond de l'en-tête des
tableaux — mais ne savent que **nommer** une police, sans liste de repli : ils
reçoivent donc Arial (charte de l'État) ou Public Sans (charte neutre). Le
détail figure dans `README.md` (« Exports » et « Typographie et couleurs : la
charte graphique de l'État »).

### Charte et police

Toutes les structures ne portent pas la charte de l'État. Deux **chartes** sont
donc offertes (`Identite.Charte`, réglées dans Réglages › Charte graphique, lues
par `src/charte.js`) :

| Charte | Marque de l'État | Police |
| --- | --- | --- |
| Charte neutre (défaut, valeur vide comprise) | aucune — le bloc-marque n'est **pas écrit** | Public Sans |
| Charte de l'État | bloc-marque « République Française » | Marianne |

La charte neutre ne change que la marque, la police et le bleu d'action :
couleurs, composants et mise en page restent ceux du DSFR. Elle vaut pour
l'interface comme pour les documents. La charte de l'État doit être **demandée**
explicitement (menu « Charte ») : afficher la marque de l'État est un acte, et un
document neuf ou jamais réglé — colonne `Charte` vide — porte la charte neutre.
Sa police, **Public Sans**, est libre et servie depuis l'hébergement de l'outil :
rien à installer sur les postes, et le même document partout.

Le **jeu de données d'exemple**, lui, porte la charte de l'État : il affiche un
logo d'opérateur, dont la place est à droite du bloc-marque, et ses courriers
montrent l'en-tête complet. Sans cette valeur, l'en-tête de l'outil, son pied de
page et les documents perdent le bloc-marque, et une section sans logo n'a plus
d'en-tête du tout.

La colonne `Identite.Police_documents` règle en outre la **police des documents
pour tout l'outil** : elle remplace la police de la charte dans les documents
rendus, les états imprimés et les exports. Word et OpenDocument ne sachant
exprimer qu'un nom unique, c'est celui-là qui leur est donné
(`policeDocumentNom`) ; le PDF **embarque** la famille correspondante, choisie
par la même règle (`policeDocumentEmbarquee`) — c'est la seule des trois
sorties où la police du document voyage avec le fichier.

Aucun de ces réglages ne touche aux données : ce sont deux colonnes d'une fiche
facultative, relues à chaque affichage.

## 10. Exploitation, version et tests

Ce chapitre rassemble ce qui ne se voit pas dans un écran mais garantit que
l'outil reste exploitable : environnement, version, tests, sécurité, référentiel.

- **L'environnement est déclaré, jamais deviné** (NC-0008). `index.html` pose
  `window.ENVIRONNEMENT` ; à défaut, la page est en **production**. La recette
  s'affiche visiblement, et c'est elle seule qui ouvre l'onglet Debug et pose le
  jeu d'exemple ; une base de production neuve est vide de données fictives.
  Rien n'est déduit du cadre d'affichage — **sinon un document Grist**, et dans
  le seul sens qui protège : la même copie sert la vitrine (recette) et le
  widget d'un document réel, et un document Grist est le système de
  l'établissement, jamais la vitrine. Dès que la liaison aboutit, l'outil passe
  en production, quelle que soit la déclaration de la page.
- **Chaque livraison est numérotée** (NC-0002). `version.js` porte le numéro, et
  `CHANGELOG.md` le journal des livraisons. La version s'affiche dans
  Réglages › Données › Diagnostic et en tête du journal de diagnostic. Avant de
  publier : vérification de la syntaxe des modules, puis tests.
- **Les invariants du chapitre 8 sont couverts par des tests** (NC-0001). Le
  dossier `tests/` porte un harnais sans dépendance — un cas par invariant qui
  se vérifie sur de la logique pure — et un test de fumée par écran. Voir
  `tests/README.md`.
- **Les contenus livrés sont versionnés** (NC-0005). Une empreinte
  (`contenus.js`) permet de dire à une base déjà installée que la livraison
  apporte des trames, formats ou catalogues plus récents ; un geste l'aligne,
  sans jamais écraser le texte de ses trames ni ses propres lignes. Les
  **comptages** de ces contenus sont produits par le code (NC-0015).
- **Les dépendances tierces sont inventoriées et figées** (NC-0003).
  `dependances.js` est la source unique de la version du DSFR, des adresses des
  bibliothèques chargées à la demande et de leurs empreintes d'intégrité ; une
  politique de sécurité du contenu restreint les origines. Voir `SECURITE.md`,
  qui documente aussi le **mode dégradé** (ce qui reste disponible quand un
  tiers manque).
- **Une variante minifiée et regroupée** peut être produite à la livraison
  (NC-0004), sans changer le dépôt source : voir `livraison/`.
- **Le référentiel d'exigences et la recette** vivent dans `EXIGENCES.md`
  (NC-0016) : la matrice exigence → écran → état, et le procès-verbal de recette
  que complète le commanditaire. C'est lui qui établit la complétude de l'outil.
