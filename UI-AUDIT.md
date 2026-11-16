# Audit d'interface — constats et propositions

> Audit demandé le 20 septembre 2026 : « certaines pages sont très longues, avec
> des interfaces alambiquées, désordonnées ». Ce document **mesure** chaque vue,
> dit ce qui va et ce qui ne va pas, et propose, **vue par vue**, des
> réaménagements concrets.
>
> **État : toutes les propositions sont implémentées** (lots A à H, voir le
> tableau d'avancement en fin de document). Les mesures de la section 1 sont
> celles **d'avant** ; la section 0 donne celles d'après.
>
> **Suite du 20 septembre 2026** — « l'UI est un peu contrainte, peut tu élargir
> un peu plus l'espace disponible sur la page ? » : dernier lot (**I. Largeur**),
> qui relève le plafond de largeur de la coquille et empêche l'élargissement de
> se payer en lisibilité (contrôles de filtre plafonnés, mesure de lecture des
> textes d'aide). Mesures en section 0.
>
> Les hauteurs sont celles de la page rendue, à la largeur de l'éditeur, sur la
> base de démonstration (10 affaires, 14 documents, 6 décisions, 44 trames,
> 22 sanctions, 19 motifs, 5 sections, 57 membres).

## 0. Avancement — mesures avant → après

| Vue | Avant | Après |
|---|---:|---:|
| Tableau de bord — Synthèse | 2 528 px | 1 622 px |
| Tableau de bord — Rapport d'activité | 8 963 px | 2 275 px |
| Affaires — Synthèse | 4 351 px | 3 607 px |
| Affaires — Commission / Instruction / Section | 1 948 px | 1 590 px |
| Affaires — Personnes | 2 877 px | 1 833 px |
| Affaires — Séance d'examen | 3 155 px | 1 643 px |
| Affaires — Décision | 3 588 px | 1 872 px |
| Affaires — Documents | 2 743 px | 1 468 px |
| Attribution | 2 094 px | 1 308 px |
| Séances — Séances et rôles | 1 093 px | 653 px |
| Séances — Calendrier | 3 120 px | 2 520 px |
| Documents | 3 855 px | 1 758 px |
| Décisions | 2 722 px | 1 153 px |
| Réglages — Sections et membres | 5 079 px | 1 711 px |
| Réglages — Personnes | 2 419 px | 2 033 px |
| Réglages — Secrétaires | 1 681 px | 1 295 px |
| Réglages — Destinataires | 1 556 px | 1 171 px |
| Réglages — Catalogues et délais | 3 992 px | 1 744 px |
| Réglages — Trames | 4 370 px | 4 468 px |
| Réglages — Formats | 1 432 px | 1 046 px |
| Réglages — Import | 1 402 px | 684 px |
| Réglages — Identité | 1 400 px | 1 015 px |
| Réglages — Charte graphique | 2 159 px | 2 130 px |
| Réglages — Données | 2 364 px | 2 113 px |
| Aide | 3 544 px | 3 470 px |
| Debug | 2 364 px | 1 465 px |

Deux principes, appliqués partout, expliquent l'essentiel des écarts : **un
seul bouton « Exporter »** par page (les sorties de fichier se replient dans un
menu), et **la vue de détail se lit d'abord** (les blocs secondaires sont
repliés, la saisie s'ouvre sur demande). Le troisième — une barre d'ancres sur
les pages longues — n'a pas d'effet sur la hauteur, mais sur la façon de s'y
repérer.

**Largeur (lot I).** Les hauteurs ci-dessus ont été mesurées dans la largeur de
l'éditeur. Sur un écran large, la coquille plafonnait à 78 rem : à 1920 px de
fenêtre, `#appContent` s'arrêtait à 1 248 px, laissant **336 px vides de chaque
côté** — un poste de travail fait de tableaux et de volets côte à côte n'en
profitait pas. Le plafond est désormais partagé par toute la coquille (en-tête,
navigation, contenu, pied de page) et porte à **110 rem** : à 1920 px, le
contenu passe à **1 760 px**, 80 px de marge de chaque côté. Trois garde-fous
empêchent l'élargissement de nuire :

| Ce qui s'élargit | Ce qui ne s'élargit pas |
|---|---|
| tableaux, listes, grilles de cartes, colonnes maître / détail | lignes de texte : mesure de lecture (`.app-prose` 78 ch, sous-titre d'en-tête 62 ch, textes d'aide 70 ch) |
| barres de filtres : la ligne occupe toute la bande | contrôles : champ de recherche plafonné à 28 rem, menus à 24 rem — l'espace restant se répartit **entre** eux |
| champs posés dans une colonne | champ posé à même un panneau (onglet Debug) : 32 rem |

Le registre des décisions, lui, garde son défilement horizontal : à 1760 px il
ne lui manque que 111 px (1 789 px de tableau), et ses colonnes ne se
compriment pas.

Trois pages font exception, et il faut le dire :
- **Trames** (4 468 px) ne baisse pas : quarante-quatre trames rangées par
  format occupent la place qu'elles occupent. Ce qui a changé est ailleurs —
  les quatre-vingt-treize boutons de ligne sont devenus des icônes qui ne se
  montrent qu'au survol, le dictionnaire des variables est replié, et un
  sommaire collant permet d'aller d'un bond au registre, à la corbeille ou au
  dictionnaire.
- **Charte graphique** (2 130 px) et **Données** (2 113 px) ne baissent presque
  pas : les deux aperçus de la charte sont devenus un seul, et les deux boutons
  d'export de chaque table sont passés dans un menu — mais l'essentiel de la
  page est un aperçu de document et un tableau de décomptes, qui ne se
  compriment pas.
- **Aide** (3 470 px) résiste parce que le guide est du texte : les vingt-deux
  sections sont désormais en accordéon, repliées, avec une recherche qui les
  ouvre — la hauteur ne dit plus rien du temps de lecture, qui est ce qui
  comptait. La recherche elle-même ajoute deux cents pixels, et en fait gagner
  beaucoup plus.

## 1. Mesures

| Vue | Hauteur | Panneaux | Champs | Boutons | Tableaux |
|---|---:|---:|---:|---:|---:|
| Tableau de bord — Synthèse | 2 528 px | 3 | 0 | 2 | 1 |
| Tableau de bord — **Rapport d'activité** | **8 963 px** | 18 | 1 | 53 | 15 |
| Affaires — Synthèse | 4 351 px | 5 | 31 | 12 | 1 |
| Affaires — Commission / Instruction / Section | 1 948 px | 1 | 24 | 17 | 0 |
| Affaires — Personnes | 2 877 px | 2 | 19 | 16 | 1 |
| Affaires — Séance d'examen | 3 155 px | 2 | 2 | 7 | 1 |
| Affaires — Décision | 3 588 px | 4 | 14 | 14 | 0 |
| Affaires — Documents | 2 743 px | 1 | 0 | 10 | 0 |
| Attribution | 2 094 px | 2 | 25 | 27 | 2 |
| Séances — Séances et rôles | 1 093 px | 1 | 0 | 1 | 0 |
| Séances — Calendrier | 3 120 px | 4 | 0 | 15 | 2 |
| Documents | 3 855 px | 11 | 2 | 13 | 0 |
| Décisions | 2 722 px | 6 | 14 | 9 | 1 |
| Réglages — Sections et membres | 5 079 px | 5 | 18 | 8 | 1 |
| Réglages — Catalogues et délais | 3 992 px | 3 | **281** | 9 | 3 |
| Réglages — Trames | 4 370 px | 3 | 47 | **93** | 0 |
| Réglages — Personnes | 2 419 px | 2 | 13 | 3 | 1 |
| Réglages — Secrétaires | 1 681 px | 1 | 10 | 1 | 0 |
| Réglages — Destinataires | 1 556 px | 1 | 10 | 1 | 0 |
| Réglages — Formats | 1 432 px | 1 | 1 | 3 | 0 |
| Réglages — Import | 1 402 px | 15 | 1 | 1 | 13 |
| Réglages — Identité | 1 400 px | 2 | 3 | 2 | 0 |
| Réglages — Charte graphique | 2 159 px | 3 | 2 | 0 | 0 |
| Réglages — Données | 2 364 px | 3 | 2 | **49** | 1 |
| Aide | 3 544 px | 4 | 0 | 0 | 0 |
| Debug | 2 364 px | 6 | 2 | 13 | 2 |

Détail du rapport d'activité : **16 graphiques**, **15 tableaux** répartis en
**6 domaines**, **52 boutons d'export**.

## 2. Problèmes transversaux

### P1 — Six boutons d'export ouvrent chaque liste
`Nouvelle affaire | Imprimer la liste | PDF | Word | OpenDocument | CSV | Excel` :
sept boutons de large en tête de la page « Affaires », et la même famille sur
Documents, Décisions, Attribution, Séances.

**Proposition.** Un seul bouton **« Exporter »** (`<details class="app-menu">`
ou le menu DSFR) qui déroule : *Imprimer · PDF · Word · OpenDocument · CSV ·
Excel*. L'action principale (« Nouvelle affaire ») reste seule à droite.
Gain : 5 boutons par page, et un en-tête qui se lit.

### P2 — Aucune navigation interne sur les pages longues
Au-delà de ~2 500 px (rapport, section, catalogues, trames, données, aide),
l'utilisateur ne peut ni voir où il va, ni sauter à une partie.

**Proposition.** Une **barre d'ancres collante** sous l'en-tête, réutilisant
`subnav()` : `Chiffres clés · Graphiques · Tableaux · Imprimer`, etc. Les
identifiants de panneaux existent déjà (`panel({ id })`).

### P3 — Tout est ouvert, tout le temps
Les formulaires de détail affichent leurs champs d'emblée (31 champs sur la
Synthèse d'une affaire, 281 sur les catalogues, 47 sur les trames). Rien ne
distingue ce qui se **lit** de ce qui se **modifie**.

**Proposition.** Une vue de détail se lit d'abord ; l'édition s'ouvre sur
demande — un bouton « Modifier » par bloc, ou `panel({ collapsible: true })`
déjà disponible et **fermé par défaut** pour tout ce qui est secondaire :
contrôles conformes, procédure applicable, effets calculés, explication de
procédure, dictionnaire des variables, domaines de tableaux du rapport.

### P4 — La carte partout : des murs de cartes
Le rapport empile **18 panneaux dans un panneau**, chaque graphique et chaque
tableau étant lui-même une carte bordée. Onze dossiers-cartes sur « Documents »,
dont plusieurs vides.

**Proposition.** Une seule couche de carte. À l'intérieur d'un panneau, les
graphiques et les tableaux se posent **sans bordure**, séparés par un titre de
section (`app-section-title`, déjà utilisé).

### P5 — Les mêmes chiffres, deux ou trois fois
Synthèse : le KPI, le graphique « Répartition par état » et le bloc
« Affaires clôturées — 3 sur 10 » disent la même chose. Documents : le registre
répète le numéro, le nom et l'état de l'affaire en tête de chaque dossier.
Décisions : registre + graphiques par type + par origine.

**Proposition.** Un chiffre a **un** lieu : soit la tuile, soit le graphique,
soit le tableau — pas les trois. Sur le rapport, un **sélecteur
« Graphiques | Tableaux »** (comme les vues Rédaction / Balisage / Résultat d'un
document) évite de tout afficher en double.

### P6 — Les actions en double
« Nouvelle affaire » existe trois fois sur le tableau de bord (carte d'action
rapide, bouton du panneau, en-tête de page). « Nouveau document » et « Ouvrir
l'affaire » sont répétés dans **chaque** dossier de la page Documents.

**Proposition.** Une action, un endroit. Sur Documents, un seul « Nouveau
document » en tête (l'affaire se choisit dans le formulaire) ; les actions de
dossier n'apparaissent qu'au survol ou dans un menu de ligne.

### P7 — Les tuiles et panneaux vides occupent la place
« À attribuer : 0 » tient une tuile de KPI. L'import affiche **15 panneaux**
avant même qu'un fichier soit chargé. Les dossiers sans document affichent une
grande boîte « Aucun document dans ce dossier ».

**Proposition.** Un bloc vide ne s'affiche pas : la tuile disparaît quand la
valeur est nulle (sauf si elle est le sujet de la page), l'import ne montre son
analyse qu'après le choix d'un fichier, et les dossiers vides se résument en une
ligne « *N affaires sans document* », repliable.

### P8 — Réglages : onze entrées à plat
`Sections et membres · Personnes · Secrétaires · Destinataires · Catalogues et
délais · Trames · Formats · Import · Identité · Charte graphique · Données`.

**Proposition.** Trois groupes : **Section** (sections, membres, personnes,
secrétaires, destinataires) · **Bibliothèque** (catalogues, trames, formats) ·
**Outil** (identité, charte, données, import).

## 3. Vue par vue

### 3.1 Tableau de bord — Synthèse (2 528 px) — *correct, à resserrer*
**Ce qui va.** Les tuiles cliquables, les séances à droite, la double colonne.
Le nouveau panneau « Clôtures d'instruction » trouve sa place.

**Ce qui ne va pas.**
- 6 tuiles + 6 cartes d'action se disputent le haut de page ; « À attribuer : 0 »
  occupe une tuile sans rien dire.
- « Affaires à traiter » (tableau) et « Synthèse de l'activité » (graphique +
  liste) se répètent : états, compteurs, clôturées.
- La colonne de droite est presque vide en bas, la gauche très longue.

**Propositions.**
1. N'afficher « À attribuer » que si la valeur est > 0 ; ramener le ruban à 4-5
   tuiles sur une seule ligne.
2. Réduire « Actions rapides » aux 3 gestes fréquents (nouvelle affaire,
   nouvelles décisions, planifier une séance) et les poser **à droite des
   tuiles** plutôt qu'en pleine largeur.
3. Fusionner « Affaires à traiter » et « Synthèse de l'activité » en un seul
   bloc : le tableau à gauche, le graphique de répartition à droite.
4. Retirer « Nouvelle affaire » de la carte d'action (elle est déjà dans
   l'en-tête) — voir P6.

### 3.2 Tableau de bord — Rapport d'activité (8 963 px) — *la page la plus lourde*
**Ce qui va.** Le fond est bon : une période, des chiffres, des graphiques, des
tableaux, un rapport imprimable. Les domaines (« Activité », « Affaires
reçues », « Décisions », « Séances », « Recours ») sont une bonne idée de
rangement.

**Ce qui ne va pas.**
- Tout est déroulé : 16 graphiques **puis** 15 tableaux — les mêmes données deux
  fois.
- 52 boutons d'export (2 par tableau + 1 par graphique + 2 globaux).
- Aucune navigation : 9 000 px de défilement sans repère.
- « Rapport imprimé » en bas est redondant avec le bouton d'impression attendu
  en tête.

**Propositions.**
1. **Barre d'ancres** collante : `Période · Chiffres clés · Graphiques ·
   Tableaux · Imprimer` (P2).
2. **Sélecteur de vue** « Graphiques | Tableaux » : un seul jeu affiché à la
   fois, le choix mémorisé. La page tombe à ~3 000 px.
3. Tableaux : **un panneau repliable par domaine** (6 au lieu de 15 cartes),
   avec le nombre de tableaux dans l'en-tête ; repliés par défaut.
4. Exports : garder « Tous les graphiques (PNG) » et « Tous les tableaux
   (Excel / CSV) » en tête de leur panneau ; **supprimer les 30 boutons de
   ligne** (ou ne les montrer qu'au survol d'un tableau).
5. « Rapport imprimé » : le réduire à un bouton dans l'en-tête de page.

### 3.3 Affaires — liste maîtresse + onglets

**Liste maîtresse (colonne de gauche).** Bonne : filtres, compteur, périmètre,
étiquette de clôture. À ajouter : un **compteur par état** dans le filtre, et un
tri explicite (saisine / échéance). À surveiller : la ligne porte 4 repères
(date, régime, ancienneté, clôture) — au-delà, il faudra les replier.

#### 3.3.1 Synthèse (4 351 px, 5 panneaux, 31 champs) — *le plus « alambiqué »*
**Ce qui ne va pas.** Cinq cartes empilées dont **trois disent la même chose** :
« Synthèse » (fiche en lecture), « Dossier de l'affaire » (les mêmes données en
édition : numéro, date, état, section, séance…), et « Contrôles de régularité ».
« Contacts » et « Procédure applicable » s'intercalent entre la fiche et son
édition, ce qui hache la lecture. Les 31 champs sont ouverts d'emblée.

**Propositions.**
1. **Une seule fiche** : fusionner « Synthèse » et « Dossier de l'affaire » en
   un panneau unique où chaque ligne s'édite à la volée (clic sur la ligne →
   champ), au lieu d'une lecture *puis* d'un formulaire.
2. **Deux colonnes** : à gauche la fiche et les contacts ; à droite les
   contrôles (repliables, cf. 3), l'échéance d'instruction, la procédure.
3. **Contrôles de régularité** : résumé en tête (« 6 contrôles — 1 à corriger »),
   seuls les points **non conformes** ouverts ; les conformes se replient en une
   ligne.
4. **Procédure applicable** : panneau repliable en bas de l'onglet.
5. Le bandeau de cheminement d'état, la ligne de badges, l'onglet actif et
   l'échéance occupent quatre bandes horizontales : les resserrer en **deux**
   (état + échéance ; onglets).

#### 3.3.2 Commission / Instruction / Section (1 948 px, 24 champs)
Bonne structure (une table d'intervenants). À améliorer : l'ajout d'un
intervenant ouvre une ligne de formulaire ; les 57 membres de l'établissement
sont dans une liste déroulante par ligne.

**Propositions.** Édition **en ligne** dans la table (comme « Membres de la
section » aux Réglages) ; un tiroir « Ajouter un intervenant » qui ne prend
qu'une ligne fermée ; rappel de la composition attendue à côté de la table
(la règle existe déjà dans `procedure.js`).

#### 3.3.3 Personnes (2 877 px, 19 champs)
La fiche est **ressaisie** ici alors qu'elle vit au répertoire (elle est
partagée par toutes les affaires de la personne — c'est déjà dit dans l'aide).

**Proposition.** En lecture + bouton « Ouvrir la fiche du répertoire » ;
n'éditer sur place que ce qui est propre au dossier (rôle, coordonnées du
dossier). Divise la hauteur par deux et supprime une source d'erreur.

#### 3.3.4 Séance d'examen (3 155 px pour 2 champs)
**Proposition.** La page porte l'affectation **et** le rôle complet de la séance,
qui vit déjà dans « Séances ». Garder l'affectation, les autres affaires du rôle
en 3 lignes maximum, et un lien « Voir le rôle complet ».

#### 3.3.5 Décision (3 588 px, 4 panneaux)
**Propositions.** « Affaires jointes » ne s'affiche que s'il y a une jonction ;
« Effets de la décision » (calculé) et « Recours » passent en panneaux
repliables ; le formulaire de la décision définitive se réduit à l'essentiel
(nature, texte, motif) avec « Plus de champs » pour le reste.

#### 3.3.6 Documents (2 743 px)
**Propositions.** Trier par date décroissante et par type ; un filtre par trame
(le registre en a déjà un) ; un seul bouton « Nouveau document ».

### 3.4 Attribution (2 094 px, 27 boutons, 2 tableaux)
**Ce qui ne va pas.** Deux tableaux se répondent (« Affaires à répartir » et
« Répartition de la charge »), 27 boutons, une colonne de filtres très haute
devant un tableau.

**Propositions.**
1. **Un seul tableau** : les affaires, avec le secrétaire en colonne éditable ;
   la charge se lit dans l'en-tête du tableau (« 10 affaires — 6 attribuées,
   4 à répartir ») plutôt que dans un second tableau.
2. Les actions de lot (« Attribuer à… ») **n'apparaissent qu'après** une
   sélection — aujourd'hui elles occupent la page même sans case cochée.
3. Filtres en une ligne (recherche + état + section), comme la liste des
   affaires.

### 3.5 Séances — Séances et rôles (1 093 px) — *bonne page*
Rien à redire. À garder telle quelle.

### 3.6 Séances — Calendrier (3 120 px, 4 panneaux)
**Ce qui ne va pas.** La grille du mois, « Agenda du mois », « À venir » : trois
listes du même contenu. « Ce que contient l'export » explique un bouton.

**Propositions.** Grille + **un seul** panneau « À venir » à droite (la liste du
mois est le détail de la grille) ; « Ce que contient l'export » passe en
infobulle du bouton ; les exports (impression, `.ics`, CSV, Excel) sous un menu
« Exporter » (P1).

### 3.7 Documents (3 855 px, 11 panneaux)
**Ce qui ne va pas.** Un panneau par affaire — 11 cartes, dont plusieurs vides —
et les mêmes boutons répétés à chaque carte.

**Propositions.**
1. N'afficher par défaut que les dossiers **qui contiennent** des documents ;
   les autres se résument en une ligne « *N affaires sans document* », dépliable.
2. Au-delà de ~6 dossiers, passer en **accordéon** (repliés, avec le compte et
   l'état dans l'en-tête).
3. Un **seul** « Nouveau document » en tête ; « Ouvrir l'affaire » au survol de
   la ligne.
4. Ajouter un filtre par **type de document** (il n'y a aujourd'hui qu'un filtre
   par trame).

### 3.8 Décisions (2 722 px, 6 panneaux)
**Ce qui ne va pas.** Le détail d'une décision s'ouvre **sous** le registre, ce
qui allonge la page d'autant ; les deux graphiques d'analyse s'ajoutent encore.
Le registre a neuf colonnes.

**Propositions.**
1. Ouvrir le détail dans une **sous-vue** (`#decisions/<id>`, comme
   `#documents/<id>`) : la liste reste courte, la décision a la page entière.
2. Déplacer « Analyse des sanctions » (graphiques) dans **une sous-page
   « Analyse »** à côté du registre — ou dans le rapport d'activité, qui les
   produit déjà.
3. Registre : rendre la colonne « Délai » optionnelle (réglage d'affichage).

### 3.9 Réglages (11 sous-pages)

| Sous-page | Constat | Propositions |
|---|---|---|
| **Sections et membres** (5 079 px) | Un formulaire-fleuve : identité (5 champs) + en-tête (2) + secrétaires + membres + procédure + explication + calculs. | Découper en **onglets internes** `Identité · En-tête · Secrétaires · Membres · Procédure` ; replier « Explication de la procédure » et « Données calculées ». |
| **Personnes** (2 419 px) | Correct. | Édition à la demande (P3). |
| **Secrétaires / Destinataires** | Corrects, courts. | — |
| **Catalogues et délais** (3 992 px, **281 champs**) | Deux tableaux éditables en ligne (22 sanctions × 8 colonnes, 19 motifs) : tout est champ. | Passer Sanctions / Motifs / Seuils en **sous-onglets** ; les colonnes qui ne servent pas à la lecture (texte de référence) en infobulle ; un bouton « **Rétablir le catalogue livré** ». |
| **Trames** (4 370 px, **93 boutons**) | 44 trames + corbeille + un long « Dictionnaire des variables » en prose. | Sortir le dictionnaire (panneau repliable, ou sous-page, ou seulement la palette de l'éditeur) ; grouper les trames **par format** ; les actions de ligne dans un **menu** ; le lot (corbeille) n'apparaît qu'après sélection. |
| **Formats** (1 432 px) | Correct. | — |
| **Import** (1 402 px, **15 panneaux vides**) | L'écran affiche ses 15 blocs avant tout fichier. | Un **état vide unique** au départ ; les blocs d'analyse ne se montent qu'après le chargement. |
| **Identité** (1 400 px) | Correct (logo + aperçu). | — |
| **Charte** (2 159 px) | Correct, mais deux aperçus se suivent. | Un seul aperçu partagé. |
| **Données** (2 364 px, **49 boutons**) | Une ligne par table + 2 boutons d'export par table. | Deux boutons globaux (Excel / CSV de tout) + un lien par table ; « Journal de diagnostic » repliable. |
| **Debug** (2 364 px) | Six cartes techniques. | Replier chaque carte ; n'afficher la page qu'en mode debug (elle l'est déjà). |

### 3.10 Aide (3 544 px, 18 sections)
**Ce qui va.** Les « Accès directs » en tête, puis un guide organisé.

**Propositions.** **Sommaire latéral collant** (les sections existent déjà dans
le code) ; sections en **accordéon** (fermées), avec une recherche ; les longs
blocs de prose (~300 mots sur les Décisions) coupés en listes à puces.

### 3.11 Debug (2 364 px)
**Propositions.** Replier les cartes ; séparer « Export du générateur » (rare) du
reste ; n'afficher « Tables » qu'à la demande.

## 4. Plan proposé par lots

| Lot | Contenu | Effet mesurable | Effort | État |
|---|---|---|---|---|
| **A. Menus** | P1 : un menu « Exporter » par page d'action | −5 boutons par page | court | **fait** |
| **B. Rapport** | P2 + sélecteur Graphiques/Tableaux + domaines repliables | 8 963 px → 2 275 px | moyen | **fait** |
| **C. Fiche d'affaire** | Fusion Synthèse ↔ Dossier, édition à la demande, contrôles repliés | 4 351 px → 3 607 px, une seule source par donnée | long | **fait** |
| **D. Réglages** | Sections en onglets, catalogues en sous-onglets, dictionnaire sorti, Données en 2 boutons, import à état vide | quatre pages divisées par 2 | moyen | **fait** |
| **E. Dossiers** | Documents : dossiers non vides, accordéon, filtres | 3 855 px → 1 758 px | moyen | **fait** |
| **F. Décisions** | Détail en sous-vue, analyse déplacée | 2 722 px → 1 153 px | moyen | **fait** |
| **G. Navigation interne** | P2 généralisé (ancres) + P8 (Réglages en 3 groupes) + Aide sommaire | repères sur toutes les pages longues | court | **fait** |
| **H. Nettoyage** | P5 doublons (graphiques/tableaux/KPI), P6 actions en double, P7 blocs vides | pages plus courtes, hiérarchie claire | moyen | **fait** |
| **I. Largeur** | Coquille de 78 rem à 110 rem (toute la coquille), contrôles de filtre plafonnés et répartis, mesure de lecture des textes d'aide, champs de l'onglet Debug | 1 248 px → 1 760 px de contenu à 1920 px (336 px perdus de chaque côté → 80 px) | court | **fait** |

### Ce que l'exécution a appris en chemin

Cinq défauts que l'audit n'avait pas vus, découverts en implémentant :

- **`.app-dl` (liste de définitions) s'effondrait dans une colonne étroite.** La
  grille donnait au libellé jusqu'à 11 rem sans regarder la place restante : le
  détail d'une séance, posé dans une colonne d'un cinquième de page, laissait
  quarante-quatre pixels à la valeur, qui se coupait caractère par caractère et
  faisait dix fois la hauteur attendue — deux mille deux cent soixante-dix
  pixels pour un panneau de six lignes. La liste se compose maintenant en
  **flex** (libellé borné, valeur extensible). L'onglet « Séance d'examen »
  passe de 2 939 px à 1 643 px, sans qu'aucune de ses informations ait changé.
- **Une carte de trame répartissait ses repères sur toute sa largeur**
  (`justify-content: space-between`) : à quatre repères, chacun passait à la
  ligne suivante. Serrés à gauche, les cartes perdent une ligne.
- **Un sommaire fait de liens changeait l'adresse.** Les entrées de la barre
  d'ancres étaient des `<a href="#section">` ; l'application *lit* l'adresse
  pour savoir où elle se trouve, si bien que le fragment de section la
  renvoyait vers une page inexistante, et qu'un rechargement perdait la vue. Ce
  sont désormais des **boutons** `data-ancre` : un sommaire n'est pas une
  adresse. Le défilement est un saut franc, l'animé étant ignoré par certains
  navigateurs — un sommaire qui ne mène nulle part étant pire qu'un sommaire
  sans transition.
- **Une recherche mémorisée rouvrait tout le guide.** La requête de la page
  Aide était conservée comme un filtre ; au chargement suivant, la page
  affichait vingt-deux sections **ouvertes** et faisait vingt mille pixels de
  haut. La recherche ne se mémorise plus, et une requête sans résultat laisse
  les sections fermées.
- **Élargir la coquille a étiré les contrôles de filtre.** Les enfants d'une
  barre de filtres grandissent pour partager la ligne : à 1 712 px de bande, le
  champ de recherche passait à 618 px pour une amorce de trente caractères, et
  chaque menu à 341 px pour l'énoncé « Toutes les sections ». Les plafonner
  laissait alors une bande à moitié vide à droite — plus gênant encore, la
  bande étant encadrée. C'est la répartition qui règle les deux : contrôles
  plafonnés (28 rem / 24 rem) et espace restant distribué **entre** eux sur un
  écran large (à partir de 62em, l'espacement est laissé à gauche en dessous,
  où la barre se replie sur plusieurs lignes).
- **Trois cents caractères sur une seule ligne ne se lisent pas.** Les textes
  d'aide du DSFR (`.fr-hint-text`, 12 px) n'ont aucune largeur maximale : la
  phrase de trois cents cinq caractères de l'onglet Debug s'étendait sur une
  seule ligne de 1 678 px. Ils gardent désormais une mesure de lecture
  (`--app-mesure`, 70 ch — la même idée que `.app-prose` et le sous-titre
  d'en-tête, déjà en `ch`). Même remarque pour les deux champs de cet onglet,
  posés à même le panneau : un champ de formulaire garde une largeur de champ.
