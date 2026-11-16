# Tests de non-régression

Ce dossier porte le **harnais de tests** de l'outil (NC-0001). Il répond à un
reproche précis de l'audit : `SPEC.md` § 8 tient des garanties pour acquises,
mais **aucun contrôle automatique** ne les défendait. Une régression sur les
dates, les délais, l'échappement ou les exports serait partie en production sans
être vue.

## Ce qu'il y a ici

| Fichier | Rôle |
| --- | --- |
| `harness.js` | Le harnais, **sans dépendance** : `test`, `assert`, `assertEgal`, `assertContient`, `assertNonContient`, `lancer`. |
| `invariants.test.js` | Un cas par invariant de `SPEC.md` § 8 qui se vérifie sur de la **logique pure** : dates et délais — dont la **forme française d'une date** et ses motifs de balise (§ 8.38 : « 1er janvier 2026 », « 5 mars 2026 », le motif chiffré inchangé) et la **date de séance** d'un document, `Seance_d_examen_Date` —, **lecture d'une colonne calculée** (§ 8.39 : le nom, l'INE et la date de naissance calculés depuis `Personnes` se lisent par le moteur, `vOuBrut` retombant sur le champ brut d'une ligne antérieure, et les colonnes du registre des actes s'en trouvent remplies), neutralisation des formules, échappement et assainissement, environnements, origines Grist, procédure, contenus livrés, modèle de données, numérotation des articles du dispositif (§ 8.30 — l'intitulé d'un article reconnu à son deux-points, la citation du code non, et **chacune** des formules livrées du dispositif), primitives d'interface (§ 8.31 — la classe passée à une icône s'ajoute à celle du jeu, une seule fois), rédaction d'un document (§ 8.37 — le texte rend les variables de la feuille, les balises de données et les repères de pagination sans laisser d'accolade, et l'emplacement du texte tombé dans le pied de page est ramené **avant** lui). |
| `ecrans.test.js` | Le **test de fumée par écran** : fait le tour des écrans de `NAV` dans l'application vivante et vérifie que chacun rend sans erreur. Porte aussi `verifierModales` (confinement du focus), `verifierAlignement` (les champs d'une même ligne **et** le bord droit des actions d'un bloc sont alignés, EX-060 et EX-067 — écrans, sous-pages de Réglages et fiches), `verifierRecherche` (la recherche des listes déroulantes, EX-061 — ouverture, listes longues **défilables**, **groupes** du menu natif redits dans la liste, recherche sans réponse, `Échap`, choix et retour à vide), `verifierMenus` (le panneau d'un menu reste **dans la fenêtre**, EX-068 — replacement éprouvé sur des panneaux montés hors de la fenêtre, puis chaque menu réel des écrans) et `verifierEntete` (la barre de navigation reste en haut de la fenêtre, les commandes du compte y descendent, les barres collées s'adossent **sous** elle — et le tout tient aussi en **cadre Grist**, option `embarque`, EX-070) et `verifierRedaction` (la largeur laissée au **texte** dans un espace de rédaction — partage au prorata, plancher des outils, mesure A4, repli, empilement — et le **repère du point de dépôt** d'une balise glissée, EX-071), `verifierContacts` (le bouton « Écrire aux membres de la commission » porte les adresses de **toute** la commission — président et rapporteurs compris —, EX-072). |
| `index.html` | Exécute `invariants.test.js` dans un navigateur et affiche le résultat, cas par cas. |

## Lancer les tests

**Dans un navigateur** : ouvrez `tests/index.html` (servi par le même
hébergement que l'outil, ou en local). La page liste chaque cas, puis le compte
rendu.

**Depuis l'outil, en atelier** — c'est la voie la plus simple, et celle qui
utilise le code réellement chargé :

```js
const h = await import("./tests/harness.js");
const m = await import("./tests/invariants.test.js");
await h.lancer(); // { total, reussis, echecs, duree, resultats }
```

Le test de fumée par écran demande l'application vivante :

```js
const { fumerEcrans } = await import("./tests/ecrans.test.js");
await fumerEcrans(); // parcourt NAV, puis revient à l'écran de départ
```

L'**alignement des champs d'une ligne** (EX-060) se vérifie de même, sur les
écrans de `NAV`, les sous-pages de Réglages **et les fiches** — un document par
trame, les décisions, les trames et les formats ouverts, puisque ce sont elles
qui portent les grandes grilles ; les outils repliés sont dépliés avant la
mesure. À lancer aussi après un changement de largeur (`set_viewport_size`) :

```js
const { verifierAlignement } = await import("./tests/ecrans.test.js");
await verifierAlignement(); // => { total, reussis, echecs, bandes, resultats }
```

La **recherche dans les listes déroulantes** (EX-061) se vérifie de même : chaque
menu enrichi est ouvert — y compris celui des intervenants d'une affaire, dans
l'onglet de composition, ouvert en chemin puis refermé —, éprouvé (une longue
liste **se laisse défiler** — la position tenue après un événement `scroll` ne
revient pas à la première ligne —, les **groupes** du menu natif sont redits dans
la liste ouverte et chaque proposition annonce le sien, le menu des intervenants
ne proposant que des membres de la section — aucun groupe du répertoire,
invariant 29 —, une recherche sans réponse, `Échap`), et — pour un menu de
**filtre** seulement, dont la valeur ne quitte pas les préférences — une valeur
est choisie puis ramenée à vide. Le menu groupé des intervenants n'étant enrichi
que sur une section assez fournie, l'onglet s'ouvre sur l'affaire dont la section
compte le plus de membres en fonction ; la sélection trouvée est rendue à la fin :

```js
const { verifierRecherche } = await import("./tests/ecrans.test.js");
await verifierRecherche(); // => { total, reussis, echecs, resultats }
```

Les **menus déroulants** (EX-068) se vérifient de même : le replacement du
panneau est éprouvé d'abord sur deux panneaux **montés hors** de la fenêtre —
posés contre le bord gauche, puis au-delà du bord droit —, cas qui ne dépendent
pas de la largeur courante ; puis, sur chaque écran de `NAV`, chaque menu réel
est ouvert et son panneau doit rester dans la fenêtre. Ce second volet ne peut
échouer que sur un écran étroit : c'est là qu'il faut le lancer, comme le
contrôle d'alignement :

```js
const { verifierMenus } = await import("./tests/ecrans.test.js");
await verifierMenus(); // => { total, reussis, echecs, menus, resultats }
```

### Attendre plutôt que dormir

Les contrôles d'affichage ne dorment pas une durée fixe : un écran se rend de
façon **asynchrone**, et une attente fixe fait échouer le contrôle selon la
charge de l'instant. Deux aides, dans `ecrans.test.js`, servent à cela :

- `attendreQue(predicat)` — sonde jusqu'à ce que ce que l'on cherche soit là
  (le déclencheur d'une fenêtre, la fenêtre elle-même). `verifierModales`
  échouait par intermittence après un rechargement, la fenêtre n'étant pas
  encore montée ;
- `attendreAdresse()` — attend que l'**adresse se pose**. L'application
  normalise la sienne (`#tableau-de-bord` devient `#tableau-de-bord/synthese`),
  et ce second rendu, mis en file par le navigateur, **referme la fenêtre**
  ouverte par un clic : changer l'adresse puis cliquer dans le même tour
  laissait le clic sans effet. Un utilisateur, lui, ne peut pas cliquer dans le
  tour même d'un changement d'adresse — l'attente est donc l'affaire du
  contrôle, pas de l'outil.

### L'en-tête défilé et les barres collées

`verifierEntete` (EX-070, invariant 34) défile trois écrans témoins — l'un porte
un **sommaire d'ancres**, l'autre des **colonnes collées**, le troisième rien de
particulier — et vérifie, à chaque fois : que la barre de navigation tient le
haut de la fenêtre et que rien ne la recouvre (ce qui est **peint** au point des
onglets est bien elle), que les commandes du compte y ont pris place, visibles
et à leur place, que les barres collées se collent **sous** elle, et que tout
revient en place au retour en haut. Le contrôle est doublé d'un volet de
sensibilité : un forçage de `top: 0` sur le sommaire le fait échouer.

Il éprouve aussi l'**état que la largeur appelle** : il relève la place que les
onglets et les commandes demandent ensemble, et vérifie que la barre a pris
l'état correspondant — les commandes sur le **rang des onglets** quand tout y
tient (sans chevauchement, et sans que la barre grandisse), sur un second rang
sinon. C'est selon la largeur : à la largeur d'un poste de travail, c'est le rang
partagé qui est éprouvé ; plus étroit, le repli. Lançez donc le contrôle **aux
deux largeurs** — le total des écrans est le même, et les deux états de la barre
sont ainsi couverts. Il échoue sur la version précédente, où les commandes
occupaient toujours un second rang.

L'option `embarque` rejoue le même parcours **cadre Grist** : la classe
`.app-embedded` est posée sur `<html>` le temps du contrôle (elle est retirée à
la fin, et laissée en place si la page tourne déjà dans un vrai document). La
barre doit s'y coller et les commandes y descendre comme dans un onglet — c'est
ce que la version précédente ne faisait pas, la barre y étant laissée dans le
flux. Seule la **colonne collée** des ateliers est écartée de ce volet : un cadre
de widget la laisse dans le flux, et il n'y a rien à mesurer sur une colonne qui
ne se colle pas.

```js
const { verifierEntete } = await import("./tests/ecrans.test.js");
await verifierEntete(); // => { total, reussis, echecs, embarque, resultats }
await verifierEntete({ embarque: true }); // le même parcours en cadre Grist
```

### L'espace de rédaction : la largeur du texte et le dépôt d'une balise

`verifierRedaction` (EX-071, invariant 35) parcourt chaque fiche qui porte un
**espace de rédaction** — documents, trames, formats — et mesure ses trois
colonnes. Quand les outils se tiennent à droite du texte, la colonne d'outils ne
prend pas plus du **tiers** de la largeur, ni moins que son **plancher**
(14 rem) ; la feuille garde sa **mesure A4** (21 cm) — elle l'atteint dès que la
place le permet, et ne la dépasse pas ; et, repliés, les outils rendent leur
largeur au texte : la colonne se réduit alors à ses deux onglets (2,6 rem). Sous
59 rem de largeur d'espace, les outils doivent passer **dessous** et prendre la
ligne. Dans une colonne d'outils étroite (moins de 20 rem), ses **champs** —
ceux des grilles du DSFR, qui se coupent sur la largeur de la fenêtre et non sur
celle de la colonne — doivent occuper toute sa largeur : à deux par ligne, un
champ de date n'y montrerait que deux caractères. Il échoue sur la version
précédente, où la colonne d'outils gardait 352 px sur 997 — plus du tiers.

Le **dépôt** s'éprouve à part, sur un espace monté **hors des écrans** : rien
n'est donc écrit dans les données de l'outil. Un survol synthétique y vérifie que
le **repère du point de dépôt** (`.app-drop-caret`) paraît sous le pointeur et se
retire quand on sort de la zone ; un dépôt vérifie que la balise s'insère **au
point visé**, et non au curseur — ou à la fin du texte ; un glisser depuis la
palette vérifie que son **fantôme** ne reste pas dans la page.

Comme les autres contrôles d'affichage, il se lance **aux largeurs à éprouver**
(`set_viewport_size`) : 390 px (téléphone), 800 px (outils dessous), 1045 px (la
largeur d'un outil embarqué dans un document Grist), 1200 px et 1440 px (feuille
A4 entière).

```js
const { verifierRedaction } = await import("./tests/ecrans.test.js");
await verifierRedaction(); // => { total, reussis, echecs, depot, resultats }
```

### Les contacts d'une affaire : écrire à toute la commission

`verifierContacts` (EX-072, invariant 36) ouvre chaque affaire de la base, lit
les liens `mailto:` du panneau **Contacts** et vérifie que le bouton « Écrire
aux membres de la commission » porte **toutes** les adresses du président de la
commission et des rapporteurs — la commission est faite de son président, de ses
rapporteurs et de ceux qui y siègent —, que le nombre annoncé par l'intitulé est
celui des adresses **distinctes** du lien, et que l'infobulle nomme les
destinataires. Une affaire dont nul n'a d'adresse n'a pas de bouton : elle est
ignorée, et le compte rendu dit combien d'affaires ont été éprouvées. Le
contrôle est **croisé** : il ne refait pas le classement des rôles, il compare
les liens entre eux — c'est donc bien le comportement de l'écran qui est
éprouvé, non la liste des rôles.

```js
const { verifierContacts } = await import("./tests/ecrans.test.js");
await verifierContacts(); // => { total, reussis, echecs, resultats }
```

## Avant chaque livraison

Un seul geste désormais (NC-0025) : **« Vérifier la livraison »** dans l'onglet
Debug, ou `verifier.mjs` en ligne de commande, analyse la syntaxe de **tous**
les modules (esbuild-wasm, déjà employé par `livraison/build.mjs`) et, sur
demande, exécute le harnais — puis on recopie le rapport dans `CHANGELOG.md`.
À la main, les deux gestes restent :

1. **Vérifier la syntaxe** de tous les modules — un simple `import` de chaque
   fichier, ou une analyse syntaxique (`acorn`, `node --check`) ;
2. **Lancer les tests** ci-dessus, et le test de fumée par écran.

Aucune évolution ne devrait partir sans ces gestes : c'est ce qui remplace la
relecture manuelle des garanties de `SPEC.md` § 8.

## Ce qui n'est pas couvert ici

Les garanties qui tiennent à Grist (écritures retenues, lots, reprise d'un
remplacement en bloc) ne se vérifient qu'avec un document Grist réel : elles
restent couvertes par le **journal de diagnostic** (Réglages › Données), qui
montre les écritures refusées et l'état de la liaison.
