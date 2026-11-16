# Journal des livraisons

Ce fichier tient l'**historique des livraisons** de l'outil (NC-0002). Il
répond à un manque relevé par l'audit : sans numéro de version ni journal, il
était impossible de savoir ce qui tournait, de revenir en arrière, ou de
rapporter un incident à un changement.

## Convention

- La **version** de l'outil vit dans `version.js` (`VERSION`, `VERSION_DATE`).
  Elle suit `majeur.mineur.correctif` :
  - **majeur** — évolution du modèle de données ou de la structure du document,
    qui demande une reprise ;
  - **mineur** — fonction nouvelle, sans rupture ;
  - **correctif** — correction.
- La **version des contenus livrés** (`VERSION_CONTENUS`, `version.js`) est
  indépendante : elle change dès qu'une trame, un format, un seuil, une sanction
  ou un motif livré évolue. Une base mémorise l'empreinte qu'elle a vue et signale
  à son administrateur qu'un contenu plus récent existe (NC-0005).
- Chaque livraison est **vérifiée avant d'être publiée** : vérification de la
  syntaxe de tous les modules, puis tests — voir `tests/README.md`.

## [2.2.17] — 2026-10-01

En widget Grist, une modification de feuille de style faite juste avant un
rechargement de la page semblait enregistrée alors qu'elle n'avait jamais
atteint le document — **sans bandeau**.

- **« L'édition des feuilles de style ne s'enregistre pas »** — les écritures
  partent vers Grist par lots, après un court silence : recharger la page avant
  l'envoi vidait la file d'attente, et le rechargement relisait le document —
  la frappe n'avait jamais été envoyée, et rien ne le disait. La file est
  désormais mémorisée dans le navigateur à chaque mouvement
  (`sauvegarderOutbox`, grist-backend.js), avec l'image d'avant modification
  de chaque mise à jour (posée par `updateRow` et `updateRowQuiet`, store.js).
  Au branchement suivant, chaque écriture retrouvée est triée
  (`classerReprises`) : ligne intacte depuis — réappliquée à l'écran et
  renvoyée aussitôt ; ligne disparue ou modifiée entre-temps — écartée et
  nommée dans le bandeau, jamais réécrite par-dessus le document. Le bandeau
  propose le renvoi, une copie de secours, ou l'abandon explicite
  (`outbox-abandonner`) ; quitter la page tant qu'il est affiché reste annoncé
  comme une perte. Une chasse à la fermeture (`pagehide`, visibilité masquée)
  demande l'envoi immédiat de ce qui attend, pour ne plus dépendre du
  rechargement. Au passage, une écriture sans contenu envoyable (que des
  colonnes calculées) est inscrite au journal au lieu de partir en lot vide.
- **Contrôle** — deux cas nouveaux au harnais (§ 8.41) : le tri des reprises
  (intacte rejouée, modifiée depuis / disparue / inconnue écartées, ajout et
  suppression rejoués, mise à jour sans image rejouée) et les cas vides. La
  variante livrée est reconstruite (EX-076).

## [2.2.16] — 2026-09-29

Dans l'espace de rédaction (trame, document), les effets de police — gras,
italique, souligné, barré — s'appliquent enfin aux **pastilles**
sélectionnées, comme au texte.

- **« Les effets de police (gras, italique) ne s'appliquent pas aux balises
  sélectionnées »** — une balise est une pastille, un îlot insécable
  (`contenteditable="false"`). Le navigateur applique ses commandes au texte
  mais ignore la pastille pour l'italique, le souligné et le barré, **sans le
  dire** — la commande rend `true` et ne fait rien : la pastille restait en
  romain quand le texte passait en italique (le gras, lui, passait). La
  commande passe désormais par `basculerEffet` (editor.js) : le navigateur
  fait son travail sur le texte, puis chaque pastille touchée est ramenée au
  sens de la bascule — enveloppée (`<em>`, `<u>`…) quand l'effet s'applique,
  dégagée par découpe de son porteur quand il se retire, sans toucher au texte
  voisin. « Effacer la mise en forme » (`delaverPastilles`) dégage de même la
  pastille de tout ce qui ne fait que la mettre en forme. L'état des boutons
  suit (`refreshToolbar` lit aussi les pastilles), et l'effet s'enregistre
  avec la balise redevenue texte (`<em>{{Affaire}}.Numero</em>), jusqu'au
  document rendu. Au passage, la découpe (`detacher`) **déplace** le passage
  au lieu de le cloner : la pastille dégagée restait une copie — la référence
  d'origine, orpheline, arrêtait le retrait des effets empilés au premier
  niveau.
- **Contrôle** — deux cas nouveaux au harnais (§ 8.40) : les quatre effets
  appliqués puis retirés d'une pastille, « Effacer » sur une pastille en
  italique souligné (sans porteur vide ni pastille perdue), l'effet enregistré
  avec la balise — et la commande native laissée au texte seul. Harnais
  **58/58**, fumée **25/25**. La variante livrée est reconstruite (EX-076).

## [2.2.15] — 2026-09-29

Les états imprimés « maison » (rôle de séance, liste d'affaires, rapport
d'activité) collent le logo de l'établissement au **bord droit** : il restait
au milieu de la page.

- **« Les boutons d'impression n'alignent pas le logo de droite tout à
  droite »** — l'en-tête de ces états pose deux cases en flex, poussées aux
  deux bords (`.doc-head`, print.js). Mais la feuille des documents leur
  impose à chacune `width: 100%` (DOCUMENT_CSS, render.js — une règle pour les
  blocs de mise en page, qui vaut pour tout `div`) : ramenées à moitié par le
  rétrécissement, les deux cases se partageaient la page, et le logo, aligné à
  gauche de sa moitié, s'arrêtait au milieu. Les cases n'ont plus que la
  largeur de leur logo (`.doc-head > div { width: auto }`, la dernière alignée
  à droite) : l'écart mesuré entre le logo et le bord droit passe de 328 à
  0 px, sur le rôle comme sur la liste à deux logos.
- **Contrôle** — harnais **56/56**, fumée **25/25**. La variante livrée est
  reconstruite (EX-076).

## [2.2.14] — 2026-09-29

Le bloc « Convocation » d'une séance range chaque couple sur sa **propre
ligne**, comme une fiche : il les entrelaçait en une grille fluide.

- **« Bug d'alignement sur la vue Convocation »** — le bloc compose cinq
  couples (section, siège, secrétariat, courriel, date) dans la grille fluide
  des listes de définitions (`.app-dl`) : chaque libellé y est suivi de sa
  valeur au fil de la ligne, sans colonnes. Dès qu'une valeur s'allonge —
  l'adresse du secrétariat —, elle tombe au début de la ligne suivante, sous
  le libellé d'un autre couple : le libellé « Secrétariat » finissait une
  ligne dont son adresse ouvrait la suivante, et la lecture décrochait. C'est
  le cas que la variante « lignes » de `dl()` (ui.js) prévoit : un couple par
  ligne, libellé à gauche, valeur à droite, séparés par un filet — la
  présentation d'une fiche, qui tient l'alignement quand une valeur court sur
  plusieurs lignes. Le bloc l'emploie (views/seances.js) ; éprouvé avec les
  valeurs de la capture — adresse et courriel longs —, les cinq libellés comme
  les cinq valeurs restent chacun dans leur colonne.
- **Contrôle** — harnais **56/56**, fumée **25/25**. La variante livrée est
  reconstruite (EX-076).

## [2.2.13] — 2026-09-29

La variante livrée en production est reconstruite : elle datait d'avant la
2.2.5 et ignorait tous les correctifs livrés depuis — dont celui des **balises
brutes à l'export** (2.2.11).

- **« J'ai toujours des balises brutes à l'export en prod, alors que la valeur
  est bien interprétée dans la vue Rédaction »** — la production ne fait pas
  tourner le dépôt `src/` relu ici, mais la **variante minifiée et regroupée**
  (`livraison/build.mjs` : `app.min.js`, `styles.min.css`, chargés par
  `livraison/index.min.html`). Or les adresses stables de cette variante
  servaient un code **antérieur à la 2.2.5** : le faisceau reconstruit depuis
  les sources courantes y est plus lourd de 115 ko et y ajoute, entre autres,
  « Ce mois-ci » (2.2.5), le repère du point de dépôt (2.2.10), le rendu
  croisé des variables et des balises (2.2.11) et le quantième français
  (2.2.12). Avant la 2.2.11, une variable de feuille tombée dans le texte — ou
  une balise de donnée tombée dans la feuille — traversait le rendu telle
  quelle jusqu'à l'aperçu, à l'impression et aux exports, **pendant que la
  pastille montrait déjà sa valeur dans l'espace de rédaction** : c'est
  exactement le contraste décrit. Le dépôt, lui, ne porte plus aucune balise
  brute (harnais 56/56, quatorze documents de recette relus) : il n'y avait
  rien d'autre à corriger que la variante servie.
- **Pour ne plus servir un code périmé** — la reconstruction devient une
  exigence (EX-076) : chaque livraison de code s'accompagne de la variante
  reconstruite, et le journal le consigne.
- **Contrôle** — le faisceau reconstruit porte « 2.2.13 » et rend les mêmes
  chaînes que les sources (repère de dépôt, « Ce mois-ci », quantième). Harnais
  **56/56**, fumée **25/25**. En production, recharger la page suffit : les
  adresses des deux fichiers changent, le cache n'a rien à oublier — sauf si
  l'intégration Grist pointe directement l'ancienne adresse du faisceau, à
  remplacer par la nouvelle (`livraison/index.min.html` la porte).

## [2.2.12] — 2026-09-29

Un passage d'audit (bugs, affichage, cohérence) : la **date de la séance**
s'écrit enfin sur les pièces qui la nomment, les dates s'écrivent en français,
les colonnes **calculées** se lisent par le moteur partout où elles
s'affichent, et le rapport d'activité ne déborde plus d'un écran étroit.

- **La date de la séance était vide sur toutes les pièces qui la nomment** —
  `Seance_d_examen_Date` est une colonne **calculée** du document : elle remonte
  la séance que l'affaire désigne. Or la formule la lisait par `c.ref`, qui ne
  voit que les colonnes **brutes** de l'enregistrement (formulas.js) : le
  document ne portant pas de colonne « Séance », la lecture rendait toujours
  `null`. Une balise non résolue se **vide** sans bruit (invariant 37) : le
  justificatif d'absence, la convocation, l'ordonnance de date d'audience et la
  décision définitive s'écrivaient « S'étant réunie le , sous la présidence
  de… ». La date se résout maintenant par la valeur calculée, puis par l'index
  de la table des séances (`c.byId` sur `c.v(T, r, "Seance_d_examen")`) — la même
  voie que les formules de l'affaire (`SE_Date`). Le document 13 de la recette
  porte « réunie le 5 mars 2026 » au lieu d'une date vide. Un balayage des
  formules a été fait pour chercher d'autres lectures de ce genre : c'était la
  seule.
- **Les dates s'écrivent en français** — une date en toutes lettres s'écrit
  sans zéro et « 1er » au premier du mois : « 1er juin 2026 », « 5 mars 2026 ».
  L'interface le faisait presque (`formatDateFr`) et les documents non : leur
  balise `.date(@long)` rendait « 05 mars 2026 » — un zéro de tableur dans une
  lettre —, et le premier du mois s'écrivait « 1 juin ». Le quantième français
  est désormais un seul primitif (`jourDuMoisFr`, formulas.js) : il sert à
  l'interface (`formatDateFr`, `formatDateTimeFr`), aux dates de l'en-tête
  (`date_formatee`, `date_de_saisine`) et au moteur de rendu — un motif `Do`
  remplace `DD` dans `@long` et `@full`, les motifs **chiffrés** (`@short`,
  `@iso`) gardant leurs zéros. `@medium` et `MMM` rendent l'abréviation
  **française** du mois (« janv. », « févr. ») au lieu des trois premières
  lettres (« jan », « fév »). Le dictionnaire des trames est corrigé : il
  annonçait `@long` sous la forme d'une date **complète** (« lundi 1er janvier
  2026 »), qui est celle de `@full`.
- **Le rapport d'activité débordait d'un écran étroit** — la grille de ses
  graphiques imposait des colonnes de `22rem` (352 px) : sur un téléphone de
  320 px, le graphique sortait de la page et faisait défiler la vue de 48 px
  horizontalement — alors que « pas de débordement à 320 px » est une exigence
  (EX-051, NC-0013). La piste ne dépasse plus la largeur disponible
  (`minmax(min(22rem, 100%), 1fr)`), comme la grille des espaces de travail. Les
  vingt-cinq écrans et huit fiches ont été remesurés : plus aucun débordement.
- **Les contrôles d'affichage ne dépendent plus d'une attente fixe** — un écran
  se rend de façon **asynchrone** : `verifierModales` échouait par intermittence
  après un rechargement, la fenêtre n'étant pas encore montée quand le contrôle
  la cherchait. Les contrôles qui déplacent la page **attendent** désormais ce
  qu'ils cherchent (`attendreQue`) et laissent l'**adresse se poser**
  (`attendreAdresse`) : l'application normalise la sienne
  (`#tableau-de-bord` → `#tableau-de-bord/synthese`), et ce rendu-là, tombant
  après le clic, refermait la fenêtre qu'on venait d'ouvrir.
- **Une colonne calculée ne se lit jamais sur le champ brut** — lire une colonne
  **calculée** sur l'enregistrement brut rend vide sans bruit, et pas seulement
  pour la date de séance : le même défaut laissait vides la date de naissance
  sur quatre trames livrées (« Né le : » sans date), la colonne « INE/corps »
  du registre des décisions, les colonnes « Mis en cause » et « Décision » du
  registre des actes, les mêmes colonnes du versement aux archives, et les
  pièces du dossier qui s'étiquetaient « #25 » au lieu du nom de leur trame. Un
  balayage instrumenté des lectures brutes des vingt-cinq écrans, doublé d'une
  recherche dans le code, a relevé ces six endroits : ils passent désormais par
  le moteur (`Context.vOuBrut`, formulas.js) — la valeur calculée quand elle
  existe, le champ brut sinon, pour les lignes écrites avant le répertoire des
  personnes.
- **Contrôle** — le harnais passe de 53 à **56/56** : un cas sur la forme
  française du quantième et des motifs de date (une date en toutes lettres, le
  premier du mois, le motif chiffré inchangé, l'abréviation du mois), un cas
  sur la **date de séance** d'un document (`Seance_d_examen_Date` sur une
  affaire, et sans affaire), et un cas sur la **lecture des colonnes
  calculées** (jamais par le champ brut, `registreActes` compris). Les quatorze documents de recette ont été rendus et
  relus : aucun `{{` ni `{` brut, aucune date à zéro, la date de séance présente
  partout où elle est nommée (5 mars, 25 juin, 1er juin, 19 mars 2026), la date
  de naissance présente (« 23 novembre 2002 ») ; registres des décisions, des
  actes et versement relus dans l'aperçu (INE, mis en cause, décision et nom de
  trame non vides). Tous les
  jetons des trames et formats livrés ont été recensés — aucune base ni variable
  inconnue. Tests d'écran à 320, 390, 800, 1045, 1200 et 1440 px : fumée 25/25,
  modales 1/1, alignement 45/45, recherche 24/24, menus 26/26, en-tête 3/3
  (+3/3 en cadre Grist), rédaction 18/18, contacts 4/4. Les 73 modules passent
  l'analyse syntaxique.

## [2.2.11] — 2026-09-28

Les documents rendus ne portent plus aucune **balise brute**, et leur texte ne
peut plus tomber **dans le pied de page** ; « Écrire aux membres de la
commission » écrit à la commission entière.

- **« L'option “Écrire aux membres de la commission” doit aussi inclure le
  président et les rapporteurs »** — le bouton du panneau Contacts d'une affaire
  ne prenait que les rôles de *membre* (`Membre de la formation`, `Membre de la
  commission d'instruction`, `Assesseur`, `Représentant des usagers`) : le
  président de la commission et les rapporteurs, qui en sont membres au même
  titre (R.811-27 et s.), restaient dehors — il fallait deux boutons de plus
  pour informer toute la formation. Le bouton écrit désormais à la commission
  **entière** : son président, ses rapporteurs et ceux qui y siègent, une même
  adresse n'étant inscrite qu'une fois (`contactsDe`, views/affaires.js). Les
  deux boutons particuliers — « Écrire au président de la commission », « Écrire
  aux rapporteurs » — restent, pour n'écrire qu'à eux.
- **« La rédaction des documents fait parfois apparaître la balise brute à
  l'export »** — l'espace de rédaction propose, dans une même palette, les
  variables `{…}` de la feuille de style (destinataire, ville, signataire,
  date…) et les balises de données `{{…}}` du texte, et leur pastille montre
  déjà la valeur qu'elles produiront. Mais le rendu ne résolvait les variables
  que dans la **feuille**, et les données que dans le **texte** : une variable
  tombée dans le texte — ou une balise de donnée tombée dans le chapeau —
  traversait le document **telle quelle**, jusqu'à l'aperçu, au PDF, au Word et
  à l'OpenDocument. Le texte est maintenant rendu par `renderDocumentBody`
  (render.js) : repères de pagination, puis variables de la feuille, puis
  balises de données ; les deux bords de la feuille reçoivent, eux aussi, le
  rendu des données. La même correction s'applique au **texte figé**
  (`freezeDocumentBody`) : une pièce figée ne garde aucune balise.
- **« L'export en docx ou odt exporte une page par ligne »** — l'emplacement du
  texte (« Texte de la trame ») peut être glissé **dans le pied de page** :
  `decouperFeuille` partageait alors la feuille à l'endroit exact de la balise,
  et le corps du document se retrouvait **enveloppé dans le `<div
  class="print-footer">`**. Word et l'OpenDocument recopient le pied de page au
  bas de chaque page : le document entier y était donc recopié page après page,
  et le PDF, qui lui réserve sa hauteur mesurée dans la marge basse, n'avait
  plus de place pour une ligne par page. Le partage se fait maintenant au
  **début** du pied de page englobant : le texte reste un texte, et le pied
  garde ses mentions après lui (`debutPiedDePage`, render.js). L'aperçu,
  l'impression et les trois exports en découlent — et l'espace de rédaction, qui
  emploie le même découpage, enregistre la feuille corrigée dès la première
  modification.
- **Contrôle** — `verifierContacts` (nouveau, ecrans.test.js) ouvre chaque
  affaire de la base, lit les liens `mailto:` du panneau Contacts et vérifie que
  le bouton des membres porte **toutes** les adresses du président de la
  commission et des rapporteurs, que le nombre annoncé par l'intitulé est celui
  des adresses distinctes, et que l'infobulle les nomme : 4 affaires (8, 8, 4 et
  3 destinataires), 4/4. Le harnais gagne quatre cas — deux sur `decouperFeuille`
  (l'emplacement dans le pied de page, pied imbriqué compris) et deux sur le
  rendu du texte (`{commission_president}`, `{page}`, `{{Affaire}}.Numero`) — et
  passe de 49 à **53/53**. Les exports Word et OpenDocument des quatorze
  documents de recette sont inchangés (mêmes paragraphes et sauts de page, pied
  de page à 29 px), et le cas fautif éprouvé à part : le corps ne paraît plus
  dans le pied, qui n'y garde que ses propres mentions. Tests d'écran à 390,
  800, 1045, 1200 et 1440 px : fumée 25/25, rédaction 18/18.

## [2.2.10] — 2026-09-24

L'espace de rédaction donne la place au **texte** : les outils se partagent la
largeur au prorata au lieu de garder une colonne fixe, et le point de dépôt
d'une balise se voit pendant le glisser.

- **« L'espace de rédaction est trop étroit »** — la colonne d'outils gardait une
  largeur **fixe** de 22rem (`25rem` pour l'atelier d'une décision) : sur un
  écran de 1045 px — la largeur d'un outil embarqué dans un document Grist —, le
  texte tombait à 487 px, les trois quarts seulement de la mesure A4 que
  l'aperçu, le PDF et le Word lui donnent. Le partage est maintenant
  **proportionnel** (`.app-doc__atelier { flex: 3 1 0 }`,
  `.app-doc__outils { flex: 1 1 0 }`, `styles.css`) : le texte prend les trois
  quarts de la place, la colonne d'outils le quart restant, jamais moins de
  14rem ni plus de 22rem. Sur 1045 px, la feuille passe de 566 à 693 px et le
  texte de 487 à 596 px ; la feuille atteint sa mesure A4 dès 1176 px de fenêtre
  au lieu de 1297. Replier les outils la lui rend entière.
- **L'atelier d'une décision suit** — il gardait, lui, une colonne de 25rem quoi
  qu'il arrive, et son texte était le plus étranglé de tous (539 px sur 1045 px).
  Il garde son plancher plus haut (18rem au lieu de 14rem) et son plafond plus
  haut (25rem), mais **proportionnels** comme les autres : 651 px de feuille sur
  1045 px.
- **Replié, l'outil rend vraiment sa largeur** — le plancher de la colonne
  ouverte (14rem, 18rem pour une décision) l'empêchait de se replier : la barre
  de 2,6rem restait large. Elle se réduit maintenant à ses deux onglets — et,
  dans l'atelier d'une décision, le plafond fixe la réduisait à 400 px.
- **« La variable cache l'endroit où elle va atterrir »** — le fantôme du
  glisser était l'image de la barre **entière** de la palette : haute et large,
  elle suivait le curseur et recouvrait le seul repère du point de dépôt, le
  trait d'un pixel du curseur natif. Il y a maintenant deux choses : un
  **repère** — une barre bleue, haute de la ligne visée, posée entre les deux
  caractères qui encadreront la pastille (`.app-drop-caret`, `editor.js`) — et un
  **fantôme réduit à la balise** (`reduireFantome`, `setDragImage`), décalé pour
  ne pas recouvrir le repère. Le repère est posé sur le **document**, jamais dans
  la zone rédactionnelle — qui est enregistrée telle quelle, une balise de repère
  y serait prise pour du contenu —, et il suit aussi le dépôt d'un considérant,
  dont la carte se réduit à son titre pendant le geste.
- **Une colonne d'outils étroite replie ses champs** — les panneaux d'outils
  sont pleins des grilles de champs du DSFR, et ces grilles se coupent sur la
  largeur de la **fenêtre**, non sur celle dont elles disposent : dans la
  colonne de 15rem qu'appelle à présent le partage, un champ en `fr-col-md-6`
  n'en gardait que sept, et le champ de date n'y montrait plus que deux
  caractères de sa valeur. La colonne est donc un **conteneur de requête** à son
  tour (`container: outils / inline-size`, `styles.css`) : sous 20rem, ses
  champs reprennent la largeur entière — la mise en page du mobile, appliquée à
  la colonne et non à l'écran.
- **Contrôle** — `verifierRedaction` (nouveau) mesure chaque espace de
  rédaction : la colonne d'outils ne prend pas plus du tiers de la largeur et pas
  moins que son plancher, la feuille garde sa mesure A4, replier les outils rend
  la largeur au texte, une colonne étroite replie ses champs, et les outils
  passent dessous sous 59rem de largeur d'espace (62em de fenêtre). Il **échoue
  sur la version précédente** — la colonne y prend 352 px, plus du tiers de
  997 px. Le dépôt y est éprouvé hors
  des écrans, sur un espace monté pour lui : le repère suit le point visé, la
  balise s'y insère au lieu du curseur, le fantôme ne reste pas dans la page.
  Vérification de la livraison : harnais **49/49** ; tests d'écran à 390, 800,
  1045, 1200 et 1440 px : fumée 25/25, modales 1/1, alignement 45/45,
  recherche 24/24, menus 26/26, en-tête 3/3 (plus 3/3 en mode embarqué),
  rédaction 18/18.

## [2.2.9] — 2026-09-24

Les commandes du compte prennent place **sur le rang des onglets**, à leur
droite : la barre de navigation ne grandit plus quand elles arrivent, et tout
tient sur une seule ligne tant que la place le permet.

- **« Je voudrais que tout soit sur la même ligne »** — les commandes
  (« Nouvelle affaire », le bloc de compte) occupaient **leur propre rang**,
  sous les onglets, et faisaient grandir la barre d'autant. Le rang de la barre
  est maintenant une **ligne souple** (`.app-navbar > .fr-container`, `styles.css`)
  : les onglets gardent la gauche, les commandes se rangent au bord droit, et la
  place qu'elles demandent est prise aux onglets — qui se replient sur un rang de
  plus s'il en manque. Rien ne bouge sous elles : la barre garde exactement la
  hauteur qu'elle avait refermée, et les barres collées qui s'y adossent
  (`--app-navbar-h`) ne bougent pas non plus.
- **Le repli reste possible** — quand les onglets remplissent déjà le rang, les
  commandes passent sur un second rang, à droite, plutôt que de comprimer les
  onglets. C'est la **place** qui décide, et rien d'autre : au-delà de 48em, la
  barre les met sur une ligne dès qu'elles y tiennent.
- **En deçà de 48em, rien ne change** — la barre se replie dans un menu : il n'y
  a plus de rang à partager, les commandes reprennent leur propre ligne sous lui,
  révélée par le haut, comme depuis la 2.2.7. Le bloc y occupe toute la largeur,
  filet compris.
- **L'animation suit le sens du mouvement** — `entete-defilant.js` ne fait plus
  glisser une hauteur : au-delà de 48em, c'est la **largeur** du bloc qui va de
  zéro à celle de son contenu (la barre s'ouvre vers la gauche, les onglets
  cèdent la place au lieu de sauter), et le bloc reprend sa hauteur propre le
  temps du mouvement — il est effacé dans les deux dimensions tant qu'il est
  fermé, sans quoi il laisserait une ligne vide. En deçà de 48em, la hauteur et
  le glissement d'origine sont conservés. Le délai de secours et la bascule
  immédiate en mouvement réduit valent dans les deux cas.
- **Contrôle** — `verifierEntete` éprouve en outre l'état que la **largeur**
  appelle : il relève la place que les onglets et les commandes demandent
  ensemble, et vérifie que la barre a pris l'état correspondant — même rang
  quand tout tient (sans chevauchement, sans que la barre grandisse), second
  rang sinon. Il **échoue sur la version précédente** aux largeurs où tout
  tient. Vérification de la livraison : harnais **49/49** ; tests d'écran à
  390 px, à 1600 px (repli) **et** à 1800 px (rang partagé) : fumée 25/25,
  modales 1/1, alignement 45/45, recherche 24/24, menus 26/26, en-tête 3/3
  (plus 3/3 en mode embarqué).

## [2.2.8] — 2026-09-22

L'en-tête défilé s'applique aussi **dans un widget Grist**, où il était resté
éteint : la barre y est le seul repère fixe, et les commandes du compte y
descendent comme dans un onglet.

- **« Ça ne marche pas dans le widget Grist »** — la barre de navigation y était
  laissée **dans le flux** (`.app-embedded .app-navbar { position: static }`,
  une règle posée du temps où le cadre du widget était réputé « de faible
  hauteur »), et la copie des commandes y était masquée : rien à rejoindre, donc
  rien à faire descendre. Or **le cadre d'un widget Grist défile pour lui-même** :
  `position: sticky` s'y accroche exactement comme dans un onglet, et un cadre
  court est justement celui où une barre qui reste est le plus utile. La barre
  reste donc collée dans un widget, et les commandes y descendent. Elle y est
  seulement **plus mince** — ses entrées se resserrent d'un cran, sans changer
  la taille du texte : un widget n'a pas la hauteur d'un onglet, et chaque pixel
  de la barre est pris sur le contenu. Seule la **colonne collée** des ateliers
  reste dans le flux dans un widget (une colonne entière y coûterait trop).
- **La veille ne suppose plus le cadre** — `entete-defilant.js` décidait de
  s'arrêter sur « nous sommes dans un widget » ; il lit maintenant la position
  **calculée** de la barre (`sticky` ou non). Une intégration ou un mode
  d'impression qui la laisse dans le flux éteint la bascule tout seul, et le
  widget Grist, lui, la garde.
- **Contrôle** — `verifierEntete` prend une option `embarque` : la classe
  `.app-embedded` est posée sur `<html>` le temps du contrôle, et le même
  parcours est refait (barre collée, commandes descendues, sommaire adossé).
  Le contrôle **échoue sur la version précédente** — la barre n'y est pas
  collée, et les commandes n'y descendent pas. Vérification de la livraison :
  harnais **49/49** ; tests d'écran à 390 px **et** à la largeur du bureau :
  fumée 25/25, modales 1/1, alignement 45/45, recherche 24/24, menus 26/26,
  en-tête 3/3 (plus 3/3 en mode embarqué).

## [2.2.7] — 2026-09-22

L'en-tête et la barre de navigation, au défilement : garder sous la main ce dont
on se sert à tout moment, et cesser de se recouvrir entre barres collées.

- **La barre de navigation disparaissait sous le sommaire** — sur les pages
  longues (Aide, Rapport d'activité, Réglages › Données), le sommaire d'ancres
  (`ui.anchors`) se collait à `top: 0`, comme la barre de navigation, et, plus
  bas dans le document, il la recouvrait : dès qu'on défilait, la barre — ses
  onglets, la page courante — devenait invisible, alors qu'elle est justement
  faite pour rester. Les barres collées de la page s'adossent maintenant à la
  barre de navigation : `entete-defilant.js` publie sa hauteur en
  `--app-navbar-h`, et le sommaire comme les colonnes d'outils (`4,5 rem` fixes,
  qui passaient **sous** la barre dès qu'elle tenait sur deux rangs) s'y
  accrochent (invariant 34).
- **Les commandes du compte descendent sur la barre** — la barre est collée,
  l'en-tête ne l'est pas : en défilant, « Nouvelle affaire » et le bloc de
  compte (nom, rôle) quittaient la vue. Ils **descendent maintenant sur la barre
  de navigation** quand l'en-tête a disparu, et remontent avec lui, d'une petite
  animation (EX-070). Les deux commandes sont écrites **en double** dans la page
  (`outilsBarreHtml`, `app.js`) — une copie dans l'en-tête, une sur la barre — et
  la copie masquée n'est ni visible, ni focusable, ni annoncée ; le focus revient
  à la copie **visible** du bouton quand une fenêtre ouverte depuis la barre se
  referme.
- **L'animation est menée par le script** — une transition CSS ne s'avance pas
  dans tous les cadres où l'outil s'affiche : l'aperçu de l'éditeur se déclare
  masqué (`document.hidden`) et son horloge d'animation reste à zéro, si bien
  qu'une transition y reste figée à son départ — les commandes descendaient
  **invisibles**. La descente est donc animée par `requestAnimationFrame`, et un
  délai de secours efface les styles posés si aucune image n'arrive : l'état
  décrit par la feuille de style s'applique alors sans animation, jamais à
  moitié. De même, la position est surveillée par l'écoute du défilement **et**
  par un contrôle périodique court (100 ms) — même raison, et parce qu'une
  hauteur qui change sans défilement (le logo de l'opérateur qui arrive) ne
  réveille aucune écoute.
- **Contrôle** — `verifierEntete` (`tests/ecrans.test.js`) défile trois écrans
  témoins et vérifie, sur chacun, ce qui est **peint** au point des onglets (la
  barre, et non ce qui la recouvre), la descente puis la remontée des commandes,
  et l'écart de collage des barres collées ; il échoue sur la version
  précédente. Vérification de la livraison : **72 modules**, harnais **49/49** ;
  tests d'écran à 390 px **et** à la largeur du bureau : fumée 25/25, modales
  1/1, alignement 45/45, recherche 24/24, menus 26/26, en-tête 3/3.

## [2.2.6] — 2026-09-22

Suite de la passe de finition, menée cette fois **sur un écran étroit** (390 px) :
c'est là que les lignes se replient, et que trois défauts apparaissaient, tous
invisibles à la largeur d'un bureau.

- **Un menu déroulant sortait de la fenêtre** — le panneau d'un menu s'ancre au
  bord **droit** de son bouton. Sur un écran étroit, la ligne d'actions de la
  tête de page se replie et ses boutons repartent du bord gauche : ancré là, le
  panneau — large de 16,5 rem — s'ouvrait à 103 px **hors de la fenêtre**, et la
  moitié de ses entrées devenait invisible et incliquable. Le module `menus.js`
  mesure le panneau à l'ouverture et le ramène dans la fenêtre d'un décalage
  horizontal ; la mesure se prend au **clic** sur le résumé, qui précède
  l'ouverture du bloc, de sorte que le panneau ne saute pas d'un bord à l'autre
  sous les yeux (invariant 32).
- **La barre de navigation tenait quatre rangs** — la feuille de style prévoit
  deux barres, l'une alignée au-delà de 48em, l'autre repliée dans un `<details>`
  en deçà (`.app-navbar__list--desktop`, `.app-navbar__mobile`) ; le balisage
  n'en émettait qu'une. Sur un téléphone, les neuf entrées se repliaient donc sur
  quatre rangs et 235 px : l'en-tête, la barre, le bandeau, le fil d'Ariane et la
  tête de page repoussaient le **premier panneau à 918 px** — sous la fenêtre.
  La barre mobile est émise, et son résumé rappelle la page courante
  (invariant 33).
- **Un bouton de bloc repartait au bord gauche** — la tête d'un bloc range le
  titre à gauche et « Modifier » à droite par `space-between`. Quand le titre est
  long — « Saisine, instruction et suivi » sur un écran étroit —, la ligne se
  replie, le bouton part seul sur la suivante, et `space-between`, n'ayant plus
  rien à répartir, le laissait au bord **gauche** : 214 px d'écart avec les
  « Modifier » des blocs voisins. Il reçoit `margin-left: auto`, comme le font
  déjà les actions d'un panneau (invariant 31, complété).
- **Contrôle** — `verifierMenus` (`tests/ecrans.test.js`) éprouve le replacement
  sur des panneaux montés hors de la fenêtre — un cas qui ne dépend pas de la
  largeur courante — puis, sur chaque écran de `NAV`, que le panneau d'un menu
  ouvert reste dans la fenêtre. Vérification de la livraison : **71 modules**,
  harnais **49/49** ; tests d'écran à 390 px **et** à la largeur du bureau :
  fumée 25/25, modales 1/1, alignement 45/45, recherche 24/24, menus 26/26.

## [2.2.5] — 2026-09-22

Passe de finition sur l'**interface** : un défaut d'alignement signalé — le
bouton « Modifier » du bloc « Dossier de pièces », seul à ne pas se ranger au
bord des autres blocs d'une fiche —, et les défauts de la même famille, relevés
en regardant les écrans un à un.

- **Ce qui n'allait pas, et pourquoi** — l'en-tête d'un bloc **repliable** est un
  `<summary>`, et son repère de repli (`+` / `–`) était posé **à droite**, après
  le bouton du bloc. Répartis par `space-between`, le titre, le bouton et le
  repère tenaient trois places : le « Modifier » du dossier de pièces se
  retrouvait au **milieu** de la ligne, à 231 px du bord où se rangent les
  « Modifier » des blocs voisins — et les boutons d'une même fiche cessaient de
  se répondre verticalement. Le repère passe **à gauche du titre**
  (`.app-fieldset--collapsible`, `styles.css`) : le bouton reprend le bord droit.
- **Deux autres décalages de la même famille** — le `<summary>` d'un bloc
  repliable échappe à la remise en `border-box` que la page applique à
  `::details-content` : il hérite le `content-box` de l'ombre interne du
  `<details>`, et les boutons qu'il porte prenaient la hauteur de leur
  rembourrage **en plus** de la leur — 40 px contre 33 px pour les mêmes boutons
  ailleurs. `details > summary` est remis en `border-box`. Et la classe passée à
  une icône (`icon("alert-line", 'class="fr-mr-1v"')`, `ui.js`) était émise en
  **second** attribut `class`, que le navigateur ignore : les quelque soixante
  appels qui demandaient une marge ne l'obtenaient pas — l'icône se collait à son
  libellé dans tous les boutons et tous les titres de panneau, et le repère
  « ouvrir » d'une ligne de liste gardait le ton du texte au lieu du gris des
  mentions. La primitive **fusionne** désormais les deux classes (invariant 31).
- **Le rôle d'une séance** — la colonne d'actions du rôle n'était pas
  dimensionnée pour les deux boutons qu'elle porte depuis qu'« Ouvrir le dossier
  de pièces » y figure : le second — « Retirer du rôle » — sortait de la cellule,
  à moitié invisible et à moitié cliquable. La colonne passe à `7rem` (au lieu de
  `3.5rem`), « Commission de discipline » cède 3 %, et le repère « lien externe »
  que le DSFR ajoute après tout `[target=_blank]` est éteint sur un bouton qui
  n'est **qu'une icône** (`.app-btn--icone`) : l'icône dit déjà ce qu'il fait.
- **Une page à six boutons d'export** — « Séances et rôles » portait à elle seule
  l'impression du rôle et les cinq sorties (PDF, Word, OpenDocument, CSV, Excel)
  en clair dans sa tête de page, quand le calendrier, les affaires et les
  documents les replient sous un bouton **« Exporter »**. Elle s'aligne : la tête
  de page passe de sept boutons à deux, et gagne 56 px de hauteur.
- **Le vide de la page Calendrier** — sans jour ouvert, la ligne du bas
  n'accueillait que « À venir », en huit colonnes sur douze : un tiers de la page
  restait blanc. Le panneau **« Ce mois-ci »** l'occupe — le ton d'une pastille
  et ce qu'il annonce, la même pastille que la grille, avec le nombre
  d'échéances du mois (`.app-reperes`) —, et se glisse sous « À venir » quand un
  jour est ouvert.
- **La corbeille d'un document** — dans la grille des dossiers, chaque carte
  portait sa suppression **hors** de la carte, dans l'interstice entre deux
  cartes : le bouton semblait appartenir à la voisine. Il se range dans le coin
  de sa carte, effacé tant qu'on ne le cherche pas — comme au registre des
  trames —, et le repère « ouvrir » lui cède le coin, la carte entière étant
  cliquable.
- **Deux débordements de tableau** — au tableau de bord, « Affaires à traiter »
  dépassait de seize pixels le cadre de son panneau (dernière colonne à moitié
  dehors, barre de défilement sous sept lignes) : son rembourrage latéral est
  serré (`app-table--traiter`). Et le périmètre d'une secrétaire — la suite de
  ses sections, dans la liste des Réglages — ne se repliait pas : à lui seul plus
  large que la liste, il la faisait défiler latéralement au lieu de se replier
  (`.app-list__meta-long`).
- **Un champ vide, en lecture** — dans une fiche, un champ dont la valeur manque
  (« Lien vers le dossier », « Composante ») se présentait comme une plage
  blanche, là où le tableau et la fiche de synthèse portent un tiret : il **dit**
  désormais l'absence, d'un tiret en gris (`.app-vide`, `ui.js`).
- **Vérification** — harnais **49/49** (un cas nouveau, § 8.31 : la classe d'une
  icône s'ajoute, une seule fois), alignement **45/45 écrans** — le contrôle des
  **actions de bloc** s'y ajoute, et il a été éprouvé en le faisant échouer sur
  une fiche dont un bouton était décalé de 180 px —, fumée **25/25 écrans**,
  recherche **24/24 menus**, modales **1/1**, `verifier.mjs` **conforme**
  (70 modules / 92 fichiers). Les écrans ont été parcourus à 1440 px et à
  390 px, sans débordement, en clair et en sombre ; base d'exemple intacte
  (Affaires 10, Décisions 6, Generateur 14, Intervenants 59, Trames 44).

## [2.2.4] — 2026-09-22

L'**interface de rédaction** des actes rendus se retrouve, et se complète. Une
décision se rédige là où on l'enregistre — l'onglet « Décision » de l'affaire
porte désormais le geste qui ouvre l'atelier —, une **ordonnance** reçoit les
mêmes outils que la décision, et les **articles du dispositif** se numérotent,
comme les considérants.

- **Ce qui n'allait pas** — l'atelier de rédaction d'une décision existait
  (`#decisions/<id>`) mais rien, dans l'onglet **« Décision »** d'une affaire, ne
  menait à lui : on pouvait y **enregistrer** la décision — nature, sanction,
  dates —, jamais la **rédiger**. Et de ses deux numérotations, une seule
  existait : les considérants. Une ordonnance, enfin, se rédigeait dans l'espace
  d'un document, sans le répertoire des considérants ni les gestes de
  numérotation, qui appartenaient à l'atelier d'une décision.
- **Le geste qui manquait** — « **Rédiger la décision** » (`rediger-decision`,
  `app.js`) est à l'onglet « Décision », sur la décision définitive comme sur
  chaque décision avant dire droit. Il **crée le texte** de la décision s'il
  n'existe pas encore (`assurerTexteDeDecision`, la mécanique de
  « Créer le texte de la décision », désormais partagée) puis ouvre l'atelier —
  l'adresse de la décision, qui se copie et survit au rechargement. Le registre
  des décisions gardait déjà ce chemin, par la ligne ; le voici depuis l'affaire,
  là où l'on travaille.
- **Les articles du dispositif se numérotent** — « **Numéroter les articles** »
  (`dec-numeroter-articles`) pose « Article 1er », « Article 2 », « Article 3 »…
  dans l'ordre du texte (`numeroterArticles`, `views/decision-redaction.js`).
  L'intitulé est **du texte**, comme le numéro des considérants — il survit à
  l'impression, au PDF, au Word et à l'OpenDocument, où un compteur ne serait pas
  rendu. L'intitulé se reconnaît à son **deux-points** (`estIntituleArticle`,
  `formules-decision.js`) : une citation du code qui commence par « Article
  R.811-13 du code de l'éducation… » reste un considérant, et les formules du
  dispositif sont marquées `article` pour que le geste les prenne toutes. Le
  contrôle s'éprouve sans navigateur : les deux cas du harnais (§ 8.30)
  vérifient l'intitulé et **chacune des formules livrées**.
- **Une ordonnance reçoit les outils du raisonnement** — dans l'espace de
  rédaction d'un **acte rendu** (format Décision ou Ordonnance), on retrouve le
  panneau **« Considérants de principe »** — le même répertoire, la même
  recherche, les mêmes cartes à glisser — et les deux boutons de numérotation
  (`views/documents.js`). Un document de décision déjà lié à sa décision porte en
  outre « Rédiger dans l'atelier », vers l'atelier complet (formules, champs,
  contrôles) — et ce renvoi ne s'affiche que si le document est bien celui qui
  rédige la décision (`Decision_liee`), pour ne pas ouvrir un second texte. Un
  courrier, une attestation ou un rapport ne portent pas ces outils : ils ne se
  motivent pas de la même façon.
- **Vérification** — harnais **48/48** (deux cas nouveaux, § 8.30 : l'intitulé
  d'article reconnu — et la citation du code non —, les formules livrées du
  dispositif), fumée **25/25 écrans**, alignement **45/45 écrans**, recherche
  **24/24 menus**, modales **1/1**, `verifier.mjs` **conforme** (70 modules /
  92 fichiers). Les gestes ont été exercés à la main dans l'aperçu : depuis
  l'onglet « Décision » d'une affaire, « Rédiger la décision » crée le texte et
  ouvre l'atelier (les deux numérotations y sont vérifiées — les articles
  deviennent « Article 1er », « Article 2 »…, la citation du code de l'éducation
  reste intacte) ; une ordonnance s'ouvre avec le répertoire (46 considérants) et
  les deux boutons, un courrier sans eux ; les largeurs ont été éprouvées à
  390 px et 1440 px, sans débordement. Ligne d'essai et document créés pour
  l'épreuve retirés : base d'exemple intacte (Affaires 10, Décisions 6,
  Generateur 14, Intervenants 59, Trames 44).

## [2.2.3] — 2026-09-22

Le menu **« Intervenant »** d'une affaire ne propose plus que des **membres de la
section disciplinaire** : le répertoire des personnes n'a pas sa place là où l'on
désigne qui instruit et qui juge.

- **Ce qui n'allait pas** — la liste proposait, sous « Répertoire — … », **toutes
  les personnes enregistrées** dans la table des personnes, mêlées aux membres de
  la section. C'est le point que l'utilisateur a signalé : on ne compose pas une
  commission avec n'importe quelle fiche du répertoire.
- **La règle** — `intervenantSourceSelect` (`views/affaires.js`) ne construit plus
  ses propositions que sur les membres de la section, déjà filtrés par l'onglet
  (`eligibles` : présence en fonction et section de l'affaire).
- **La personne hors section se décide** — elle reste possible, mais par un geste
  explicite : « Ajouter une personne hors section », à côté d'« Ajouter un
  intervenant », fait naître une ligne **déjà marquée « Hors section »**, où le
  nom s'écrit librement ; choisir « Saisie libre » dans la liste fait la même
  chose. La **qualité suit la source** — une fiche de membre fait un intervenant
  de la section, l'absence de fiche un intervenant hors section
  (`qualiteIntervenant`, `procedure.js`) — sans jamais écraser une qualité
  délibérée (« Agent de l'établissement », « Personnalité extérieure ») : une
  ligne ne se lit donc plus « Membre de la section » tout en portant un nom
  saisi à la main.
- **Ce qui ne disparaît pas** — une fiche qui porte **déjà** une personne du
  répertoire (deux intervenants d'exemple, choisis avant cette règle) garde ce
  choix : il est présenté seul, sous « Hors section ». La règle dit ce que la
  liste **propose**, non ce que la fiche porte — une sélection qui s'évanouirait
  ferait croire à une saisie perdue. L'action `intervenant-source` (`app.js`)
  comprend toujours ce choix.
- **Ce qui est retiré** — `personnesParCollege` (`views/affaires.js`), qui groupait
  le répertoire par collège, et `collegeDePersonne` (`procedure.js`), qui déduisait
  ce collège : plus rien ne les employait. Le cas de harnais qui éprouvait cette
  déduction est remplacé par un cas sur `collegeDuCorps`, qui, lui, décide
  toujours de la formation appelée à juger.
- **Vérification** — harnais **46/46** (un cas remplacé, un cas nouveau pour la
  qualité dérivée de la source), fumée **25/25 écrans**,
  alignement **45/45 écrans**, recherche **24/24 menus**, `verifier.mjs`
  **conforme** (70 modules / 92 fichiers). `verifierRecherche` éprouve désormais,
  sur le menu groupé des intervenants, qu'**aucun groupe du répertoire** n'est
  proposé — contrôle vérifié en le faisant échouer sur **10/10** menus
  d'intervenants, l'ancienne liste rétablie — ; il ouvre en chemin l'affaire dont
  la section compte le plus de membres
  en fonction — seule dont ce menu est assez fourni pour être enrichi et laisser
  éprouver ses groupes —, et rend la sélection qu'il a trouvée. Le menu a été
  ouvert et regardé : les collèges des membres, et rien d'autre. Le geste
  « Ajouter une personne hors section » a été exercé à la main : la ligne naît
  marquée, le nom s'y écrit librement, et choisir un membre la ramène à
  « Membre de la section » — ligne d'essai retirée, données d'exemple intactes.

## [2.2.2] — 2026-09-22

La liste des **intervenants** d'une affaire se lit enfin **par collège**, et non
en vrac : on ne devine pas, à son nom, si une personne est usagère ou
enseignante-chercheuse.

- **Ce qui n'allait pas** — le menu « Intervenant » distribuait pourtant ses
  valeurs en groupes (`<optgroup>` : professeurs, maîtres de conférences,
  usagers…), mais deux défauts les effaçaient. La recherche de la 2.2.0 peignait
  la liste **à plat**, sans reprendre les groupes du menu natif ; et le
  répertoire des personnes — celles qui ne sont pas membres de la section —
  formait un seul bloc, tous collèges mêlés. C'est le point que l'utilisateur a
  signalé.
- **Les groupes redits** — `select-recherche.js` retient le groupe de chaque
  option (l'`<optgroup>` d'origine) et peint un **intertitre** avant les
  propositions de chaque groupe, séparé par un filet. La recherche classant les
  réponses par proximité, l'intertitre se réécrit à chaque changement de groupe :
  une réponse isolée dit donc toujours son collège. Chaque proposition l'annonce
  aussi aux lecteurs d'écran (`aria-label`), qui ne voient pas l'intertitre.
- **Le répertoire, par collège** — `personnesParCollege` (`views/affaires.js`)
  groupe les personnes du répertoire comme les membres de la section, sous
  « Répertoire — Professeurs », « Répertoire — Usagers »… Le collège d'une
  personne se **déduit** de son type et de son corps (`collegeDePersonne`,
  `procedure.js`) — usager, professeur des universités, maître de conférences,
  personnel administratif —, et il n'est **pas deviné** quand il ne l'est pas :
  un tiers, un corps « Autre » ferment la marche sous « Répertoire — Collège non
  précisé ». Ce collège sert à **présenter**, non à compter : les contrôles
  d'effectif ne retiennent que les membres de la section.
- **Vérification** — un cas de harnais pour la déduction du collège
  (`collegeDePersonne`), et `verifierRecherche` éprouve désormais, sur chaque
  menu natif groupé, que ses groupes sont redits dans la liste ouverte et que
  chaque proposition annonce le sien. L'onglet de composition d'une affaire est
  ouvert en chemin pour atteindre ce menu — **22** menus éprouvés au lieu de 14 —,
  puis refermé : l'application est rendue dans l'état où elle a été trouvée. Le
  contrôle a été vérifié en le faisant échouer sur **8/8** menus d'intervenants.
  Harnais **45/45**, fumée **25/25 écrans**, alignement **45/45 écrans**,
  recherche **22/22 menus**, `verifier.mjs` **conforme** (70 modules / 92
  fichiers). Le rendu de la liste a été regardé, groupé et en recherche.

## [2.2.1] — 2026-09-22

Une liste déroulante **se laisse enfin faire défiler** : le défaut laissé par la
2.2.0 rendait inutilisable toute liste plus longue que la fenêtre où elle
s'affiche.

- **Ce qui n'allait pas** — la liste s'ouvrait, on y cherchait, mais elle
  **revenait à sa première ligne à chaque geste** : molette, doigt, barre de
  défilement et `Page ↑`/`Page ↓` restaient sans effet au-delà des premières
  propositions. C'est le point que l'utilisateur a signalé.
- **La cause** — la liste, déposée dans le `<body>` en position fixe, est
  replacée sous son champ à chaque défilement de la page (écouteur `scroll` en
  phase de capture, `select-recherche.js`). Or ce replacement mesurait la hauteur
  naturelle de la liste en **relâchant son plafond** (`max-height: none`) : la
  boîte grandissait alors d'un coup jusqu'à son contenu entier, assez pour que le
  navigateur ramène `scrollTop` à zéro. Comme **tout** défilement de la liste
  produit un événement `scroll` — donc un replacement —, la position ne tenait
  pas un cran.
- **Le correctif** — la hauteur naturelle se lit désormais **sur le contenu**
  (`listeEl.scrollHeight`, la note et les bordures), sans jamais toucher au
  plafond, et le replacement **ignore les défilements qui viennent de la liste
  elle-même** (`placer(origine)`) : ils ne déplacent pas le champ. La liste
  s'ouvre en haut (`ouvrir`), et c'est la proposition désignée qui amène la vue à
  elle (`majActif`).
- **Le doigt et la molette** — `.app-combobox-liste` déclare `touch-action:
  pan-y` (le défilement vertical au doigt, explicitement autorisé — la
  spécification Pointer Events veut qu'on le déclare ainsi plutôt que par un
  `preventDefault`) et `overscroll-behavior: contain` (le geste ne se prolonge
  pas à la page posée dessous).
- **Vérification** — `verifierRecherche` (`tests/ecrans.test.js`) éprouve
  désormais, sur chaque menu dont la liste dépasse sa fenêtre, qu'une position de
  défilement **tient** après un événement `scroll`. Le contrôle a été vérifié en
  le faisant échouer sur **14/14** menus avec l'ancien comportement rétabli.
  Harnais **44/44**, fumée **25/25 écrans**, alignement **45/45 écrans**,
  recherche **14/14 menus**, `verifier.mjs` **conforme** (70 modules / 92
  fichiers). Le rendu a été regardé au bureau et au téléphone (390 px), liste
  ouverte et parcourue dans les deux cas.
- **Documentation** — deux défauts du `README.md` réparés au passage : l'entrée
  `## [2.1.0]` de ce journal, qui avait perdu son titre, et deux paragraphes de
  la section « Rapport d'activité et graphiques » écrits avec des `\n` **littéraux**
  au lieu de vrais retours à la ligne (titre, liste et tableau aplatis sur une
  seule ligne).

## [2.2.0] — 2026-09-22

Une **recherche** s'ajoute aux listes déroulantes de l'outil : dans un menu qui
compte des dizaines — parfois des centaines — de valeurs, quelques lettres
suffisent désormais à trouver la bonne.

- **Ce qui n'allait pas** — les menus déroulants de l'outil (personnes, affaires,
  sections, membres, trames, décisions) présentent leurs valeurs en vrac dans un
  `<select>` natif : rien n'y cherche, et trouver « Durand » parmi cent lignes se
  fait à l'œil, en déroulant. C'est le point que l'utilisateur a signalé.
- **La recherche** — `select-recherche.js` (nouveau) enrichit un menu déroulant
  d'un **champ de recherche** : on tape quelques lettres, la liste se réduit, on
  choisit au clavier (flèches, `Entrée`, `Échap`, `Origine`/`Fin`, `Page↑`/`Page↓`)
  ou à la souris. La comparaison ignore **accents et casse** (« eleve dupre »
  trouve « Élève DUPRÉ ») et classe les réponses : ce qui **commence** par la
  requête d'abord, ce qui commence un **mot** ensuite, le reste après — à rang
  égal, l'ordre du menu est conservé. La partie trouvée est mise en évidence dans
  le libellé, et le nombre de réponses est annoncé aux lecteurs d'écran.
- **Le menu natif reste la valeur** — le `<select>` d'origine n'est ni remplacé ni
  retiré : il est **masqué** et garde son `id`, ses `data-*` et ses `<option>`s.
  Choisir une proposition lui donne sa valeur puis lui envoie un événement
  `change`, **exactement comme un choix natif** : rien de ce qui lit un menu de
  l'outil — `data-bind`, `data-filter`, `data-action`, les lectures par `id` — n'a
  eu à connaître le module. Le libellé du champ désigne le contrôle visible, et un
  menu neutralisé (rôle en lecture seule) reste neutralisé.
- **Un ajout, jamais une contrainte** — la recherche ne s'ajoute d'elle-même
  qu'au-delà de douze valeurs (`SEUIL_RECHERCHE`) : un menu de trois états garde
  son aspect natif. `data-recherche="non"` l'exempte, `data-recherche="oui"` la
  demande pour un menu plus court.
- **La liste des propositions est déposée dans le `<body>`**, en position fixe :
  beaucoup de ces menus vivent dans une fenêtre modale dont le corps défile
  (`.app-dialog__body`), et une liste posée dans le champ y serait rognée dès la
  troisième ligne. Elle se place sous le champ, ou au-dessus quand la place
  manque, et **reste dans la fenêtre** — y compris quand le champ est près d'un
  bord (éprouvé à 390 px).
- **L'écart du DSFR retrouvé** — un contrôle composé ne reçoit pas les 0,5 rem que
  le DSFR pose entre un libellé et un champ natif : le champ de recherche
  descendait donc de 8 px par rapport à ses voisins (`styles.css`, la règle des
  contrôles composés, qui accueille `.app-combobox` comme la date, la lecture
  seule et la liste de cases).
- **Aide** — le guide signale la recherche des listes déroulantes (« Listes
  déroulantes », parmi les principes communs à toutes les pages), et la liste des
  huit entrées du menu y nomme désormais **Calendrier** : elle disait encore
  « Séances », d'avant la 2.1.0.
- **Vérification** — deux contrôles nouveaux : cinq cas de harnais sur la logique
  de recherche (pliage des accents, classement, entrée sans valeur, rang de
  l'option) et `verifierRecherche` (`tests/ecrans.test.js`), qui parcourt les
  écrans et les fiches, ouvre **chaque** menu enrichi, éprouve une recherche sans
  réponse, `Échap`, et — sur un filtre seulement — le choix d'une valeur puis le
  retour à vide. Harnais **44/44**, fumée **25/25 écrans**, alignement **45/45
  écrans**, recherche **14/14 menus**, `verifier.mjs` **conforme** (70 modules /
  92 fichiers). Le rendu a été regardé au bureau (1440 px) et au téléphone
  (390 px), liste ouverte dans les deux cas.

## [2.1.0] — 2026-09-22

Le **calendrier** devient la page du temps : il rassemble les échéances **et** les
séances, qui n'étaient jusqu'ici que deux onglets voisins.

- **Ce qui n'allait pas** — le calendrier rassemblait les échéances de **toutes**
  les affaires — saisine, envoi des convocations, terme de l'instruction,
  prescription, terme de la sanction, expiration du délai de recours — autant que
  les séances et leurs heures de passage, et il vivait pourtant **sous** l'onglet
  « Séances » : caché là où on ne le cherche que si l'on pense « séance », il
  restait introuvable pour qui se demande « qu'est-ce qui arrive ce mois-ci ? ».
  Et l'onglet « Séances », à côté de lui, faisait doublon : deux onglets pour une
  seule matière, le temps.
- **La page** — `NAV` (schema.js) ne porte plus que l'entrée **Calendrier**, avec
  ses **deux vues** déclarées : **Échéances** (la grille du mois, la liste
  « À venir » et l'export d'agenda) et **Séances et rôles** (la liste des séances,
  leur organisation, leur rôle). « Séances » était un onglet, il devient la
  seconde vue — la séance n'est qu'un rendez-vous parmi les échéances.
  `views/index.js` aiguille les deux ; `subnavCalendrier` (views/common.js, par un
  `sousNavDe` générique) les propose sous le titre, comme pour le tableau de bord.
  **Les adresses antérieures restent valables** : `corrigerRoute` (app.js) est
  appliqué à l'adresse comme aux préférences reprises, et redresse `#seances` (et
  `#seances/liste`) vers `#calendrier/seances`, `#seances/calendrier` vers
  `#calendrier/echeances` — un signet posé la veille ou un lien partagé ne meurt
  pas.
- **Deux icônes distinctes** — `calendar-check-line` (le calendrier à coche) pour
  les échéances, `calendar-line` (le calendrier nu) pour les séances : voisines
  dans la barre comme dans la sous-navigation, elles se seraient ressemblées à
  s'y méprendre. La tuile « Échéances à venir » du tableau de bord prend l'icône
  de la première, la tuile « Séances à venir » celle de la seconde.
- **Le tableau de bord** — une tuile **« Échéances à venir »** compte les
  échéances du périmètre, toutes catégories, la plus proche en sous-titre, et
  mène d'un clic à la vue des échéances ; « Séances à venir », « Planifier une
  séance » et chaque ligne du panneau « Prochaines séances » mènent, eux, à la vue
  des séances.
- **La barre de navigation** — elle porte désormais le **libellé court** déclaré
  par `NAV` quand il en existe un (« Tableau », « Attribution ») plutôt que le
  libellé long : la barre reste ainsi sur une ligne aux largeurs courantes, y
  compris dans l'environnement de recette, où l'onglet Debug s'ajoute aux huit
  entrées. Le libellé long reste celui du titre des pages, de l'aide et du
  README.
- **Un défaut du calendrier, relevé en le parcourant** — le bouton
  « Aujourd'hui » ne revenait pas au mois courant : il était traité comme un pas
  de navigation de zéro mois, et restait donc sans effet dès qu'on avait changé
  de mois. Il **efface** maintenant le mois choisi (`cal-aujourd-hui`, app.js),
  ce qui ramène à l'état initial.
- **Aide** — la section **Calendrier** passe avant celle des séances et décrit les
  deux vues de la page (la grille, le périmètre, l'export, et où se programme une
  séance) ; celle des séances rappelle qu'elle en est la seconde vue. Les cartes
  d'accès direct suivent, et les anciens renvois `#seances` /
  « Séances › Calendrier » sont corrigés.
- **Onglets d'une affaire : Documents avant Décision.** Dans la sous-vue d'une
  affaire, « Décision » précédait « Documents ». C'est l'ordre inverse qui est
  logique : la décision intervient au **terme** de l'affaire, quand ses pièces
  sont écrites — et c'est déjà l'ordre du menu principal, où les documents
  viennent avant les décisions. `procedure.js` (`ONGLETS`) range donc les deux
  onglets dans cet ordre, et le README comme la page Aide suivent.
- **Les sous-pages entrent dans les vérifications automatiques.** Le test de fumée
  et le contrôle d'alignement ne parcouraient que les **entrées** de `NAV` : la
  seconde vue du calendrier serait restée hors de leur portée, comme l'étaient le
  rapport d'activité et les onze sous-pages de Réglages pour la fumée. Tous deux
  parcourent maintenant chaque entrée **et** les sous-pages qu'elle déclare
  (`ecransDeNAV`, `tests/ecrans.test.js`).
- Vérification : harnais **39/39**, test de fumée **25/25 écrans** (les huit
  entrées, leurs quinze sous-pages, l'Accessibilité et le Debug), contrôle
  d'alignement **45/45 écrans**, `verifier.mjs` **conforme** (69 modules /
  91 fichiers). La sous-navigation, les deux vues, le mois, le détail d'un jour,
  le menu d'export et les renvois du tableau de bord ont été éprouvés à la
  souris, et le rendu regardé au bureau (1440 px) et au téléphone (390 px).

## [2.0.1] — 2026-09-22

Les **champs d'une barre de filtres** s'alignent enfin : leurs libellés et leurs
contrôles se lisaient en escalier, et le défaut durait parce qu'il échappait au
contrôle automatique.

- **Ce qui se voyait** — dans une barre de filtres (Documents, Attribution,
  Décisions, Affaires), un champ sur deux était décalé **de vingt-quatre pixels
  vers le haut** : son libellé flottait au-dessus de celui de ses voisins, et
  son contrôle ne s'alignait sur aucun autre.
- **La cause** — deux règles en conflit. Le DSFR espace deux champs **empilés**
  par `margin-bottom: 1.5rem` sur tout champ `:not(:last-child)` — spécificité
  (0,2,0). La barre, elle, aligne ses champs **par le bas**
  (`align-items: flex-end`) et les espace par un `gap` ; la marge s'y ajoutait
  donc à la boîte de chaque champ, et comme l'alignement se fait sur les bords
  extérieurs, elle **décollait** tous les champs sauf le dernier. La règle qui
  l'annulait (`.app-select-inline { margin: 0 }`, spécificité 0,1,0) ne
  s'appliquait, elle, qu'au dernier champ — le seul auquel le DSFR ne touchait
  pas : elle donnait l'illusion d'être correcte.
- **Le correctif** — `styles.css` annule cette marge avec la spécificité du DSFR
  (0,2,0), et franchement au-delà (0,3,0) dans une barre de filtres. Les barres
  concernées ne portent plus aucune marge fantôme : vérifié sur les 41 écrans,
  et sur les quatre barres atteintes.
- **Pourquoi le défaut a duré** — `verifierAlignement` (EX-060) ne parcourait
  que les **grilles** du DSFR (colonnes `fr-col-*` d'un `fr-grid-row`). Les
  barres de filtres, qui ne sont pas des grilles, n'étaient pas mesurées : le
  défaut était donc invisible pour la vérification automatique, et il revenait à
  chaque relecture à l'œil. Le contrôleur mesure désormais aussi les barres —
  les champs d'une même ligne visuelle y sont reconnus à leurs contrôles, dont
  les plages verticales se recouvrent —, et la parade a été éprouvée : en
  rétablissant la marge fautive, le contrôle échoue en nommant les écrans et
  l'écart (24 px) ; sans elle, il passe (41/41 écrans).
- Vérification : harnais **39/39**, test de fumée **10/10 écrans**, contrôle
  d'alignement **41/41 écrans**, `verifier.mjs` conforme. Les barres de filtres
  ont en outre été regardées à l'écran (Documents, Attribution).

## [2.0.0] — 2026-09-22

Le **suivi de la durée de vie d'un dossier** et la **revue de régularité
attestée** sont retirés : ils supposaient une conservation longue dans la base,
qui n'a pas lieu.

- Les dossiers et leurs pièces vivent **hors de l'outil** — l'affaire n'en porte
  que l'adresse (`Lien_vers_le_dossier`) —, et le document Grist ne conserve
  rien au long cours. Tenir dans l'outil une durée de conservation, un sort
  final, une échéance et un état d'archivage laissait donc croire à un suivi
  d'archives que la base ne peut pas assurer : ces notions reviennent au service
  d'archives et à l'organisation qui l'alimente.
- **Retirés du modèle** (table `Affaires`) : `Etat_archivage`, et les trois
  colonnes de la revue — `Regularite_revue_le`, `Regularite_revue_par` et la
  colonne calculée `Regularite_mention`. **Retirés des seuils** :
  `conservation_annees` et `sort_final` (dix seuils livrés au lieu de douze).
  **Retirés de l'interface** : le panneau « Conservation, archivage et
  régularité » de l'onglet Synthèse, le bouton « Attester la revue de
  régularité » et le bouton « État des pièces (CSV) ». Le module
  `conservation.js` est supprimé, avec son action d'export. Les colonnes
  devenues inutiles dans un document Grist existant sont simplement ignorées —
  elles ne portent plus rien —, mais les **deux seuils retirés sont écartés de
  `Parametres` au chargement** (`ensureParametres`, store.js) : sans cela ils
  resteraient affichés et réglables dans « Seuils et délais » alors que plus
  rien ne les lit.
- **Ce qui reste** : les **contrôles de régularité** — ils signalent, ils ne
  bloquent rien —, le **registre des actes** (numérotation par section et par
  année, jamais rejouée, registre exportable), la **vérification des
  références** juridiques, l'adresse du **dossier de pièces**, et la conversion
  des PDF au **format d'archivage PDF/A-2b** — celle-ci tient au fichier
  produit, non à sa conservation dans la base.
- La **durée de conservation** et le **sort final** restent des exigences : ils
  sont désormais tenus par l'organisation, comme le rappelle `rgpd/` — durées
  de référence, à arrêter avec le service d'archives et le délégué à la
  protection des données.
- `SPEC.md` : les invariants 23 et 24 sont retirés, les suivants renumérotés
  (23 à 27) ; les renvois d'`EXIGENCES.md`, du README et du code suivent. Le
  retrait de deux seuils change l'inventaire des contenus livrés
  (`VERSION_CONTENUS`).
- **Deux défauts d'interface, relevés en éprouvant l'outil à la main**, sont
  corrigés au passage. Les onglets annonçaient par `aria-controls` des panneaux
  qui n'existaient pas dans la page : `ui.tabPanel` monte désormais le panneau
  de l'onglet actif — un seul, les autres vues n'ayant pas à exister avant
  qu'on les regarde — et seul l'onglet actif porte la référence. Et la barre
  d'onglets ne se parcourait pas aux flèches : `onKeydown` (`app.js`) gère
  `ArrowLeft` / `ArrowRight`, `Origine` et `Fin`, la sélection suivant le focus,
  qui se repose sur l'onglet élu après le rendu.
- Vérification : harnais **39/39** (les cas de conservation retirés, plus
  l'écartement d'un seuil retiré), test de fumée **10/10 écrans**, contrôle
  d'alignement **41/41**. Le retrait a en outre été éprouvé à la main, par
  l'**interface seule** (clavier et souris), sur plusieurs affaires : création
  d'une affaire au formulaire, modification d'un bloc de la fiche, production
  d'un document, inscription d'une affaire au rôle d'une séance puis retrait,
  enregistrement et numérotation d'une décision, atelier de rédaction, réglages.
  Aucun écran ne casse, aucune des actions retirées ne subsiste, et les
  comptages d'onglets s'accordent avec ce que montre chaque panneau.

## [1.4.0] — 2026-09-22

Les **champs côte à côte** s'alignent, et l'explication d'un champ se lit sous
lui.

- Deux champs voisins n'ont jamais des textes d'aide de même longueur : l'un en
  porte cinq lignes, l'autre aucune. Comme l'aide du DSFR se place **dans le
  libellé**, le libellé — donc le contrôle — se décalait : la ligne se lisait en
  escalier. En alignant les contrôles au contraire (en donnant à chaque libellé
  la hauteur du plus haut), c'était le champ le plus sobre qui se retrouvait à
  cent pixels sous son intitulé, détaché de lui. Aucune des deux présentations
  ne tenait : c'est l'aide, trop longue pour un libellé, qui était mal placée.
- Le **texte d'aide d'un champ passe donc sous son contrôle** (`field`, ui.js) :
  les libellés restent courts, les libellés s'alignent d'une colonne à l'autre,
  les contrôles aussi, et l'explication se lit sous le champ qu'elle explique.
  Le lien n'est pas perdu pour qui ne voit pas le champ : il est désigné au
  contrôle par `aria-describedby`, comme le fait le DSFR pour ses aides posées
  après un champ. Les **cases à cocher** et les **boutons radio** suivent la
  même règle, à leur mesure : leur contrôle est la case, posée à côté du
  libellé, et leur aide se place sous le **couple case + libellé**, alignée sur
  le texte du libellé. Sont concernés les champs des grilles (`field`), les
  formulaires écrits à la main des fenêtres modales (affaire, document,
  considérant, dossier de pièces), la fiche de la trame, le Debug, la trame de
  la décision, le filtre du rapport, l'option « Export anonyme » de la barre
  d'export, le mode d'écriture de l'import et le « Mode session » des réglages
  de confidentialité.
- L'**alignement est mesuré**, et non supposé : `alignement.js` relève après
  chaque rendu la hauteur du libellé le plus haut de chaque **ligne visuelle**
  (une grille qui se replie est mesurée bande par bande) et la publie en
  variable CSS `--champ-label-h` sur les cellules ; les libellés la reprennent
  en `min-height`, les cases à cocher et un bouton posé à côté d'un champ en
  descendent d'autant, pour se lire sur la ligne des contrôles. La mesure est
  refaite quand la largeur change (barre de défilement comprise) et quand un
  bloc repliable s'ouvre — un contenu replié ne se mesure pas.
- Un contrôle **composé** — date, valeur en lecture seule, liste de cases à
  cocher — reprend l'écart de 0,5 rem que le DSFR ne pose qu'entre un libellé et
  un champ natif (`.fr-label + .fr-input`) : sans lui, un champ de date voisin
  d'un champ de saisie s'affichait 8 px plus haut. La cellule « Format (court) »
  de la fiche d'une trame, écrite à la main, passe par `field` comme les autres.
- Vérification : harnais **43/43**, test de fumée **10/10 écrans**, et le
  contrôle d'alignement `verifierAlignement` — **41/41 écrans** et **40 lignes**
  de champs mesurées : les dix écrans de `NAV`, les onze sous-pages de Réglages
  et, parce que ce sont elles qui portent les grandes grilles, vingt fiches
  (un document par trame, les décisions, les trames et les formats ouverts) —
  en largeur de bureau, à **820 px** (deux colonnes, libellés repliés : la
  configuration où la mesure sert) et à 390 px, où rien ne déborde. Vérifié
  aussi qu'un décalage introduit à dessein fait bien échouer le contrôle.
  `EXIGENCES.md` (EX-060), `SPEC.md` § 8 (invariant 29) et le README suivent.

## [1.3.0] — 2026-09-22

La **mise en page de l'en-tête** se règle par feuille de style.

- L'en-tête d'une pièce — le bloc-marque de l'État et le logo de
  l'établissement — était posé par l'outil, à cotes fixes : le bloc-marque à
  gauche à sa cote de la charte, le logo à droite borné à la zone de logotype
  (53 × 26 mm). Aucun réglage ne permettait de les ajuster, alors que les
  établissements ont des logos de formats très divers, et que certaines pièces
  appellent une en-tête plus discrète — ou plus affirmée.
- Le **format** — la feuille de style — règle désormais, pour chacun des deux
  logos, sa **position** dans l'en-tête (à gauche, au centre, à droite) et sa
  **taille** en millimètres (largeur, hauteur). Un nouveau panneau « En-tête :
  les deux logos » les porte sur la fiche d'un format (Réglages › Formats et
  feuilles de style), au-dessus de l'éditeur : l'en-tête figure en tête de la
  feuille de style et dans l'aperçu A4, qui se mettent tous deux à jour à la
  saisie.
- Une **seule cote renseignée** met l'image à l'échelle en conservant ses
  proportions ; les deux fixent exactement le cadre. Des champs **vides**
  reproduisent la charte — rien ne change pour une base qui ne règle rien —, et
  une valeur illisible ou une position inconnue y retombent. Les **images**
  elles-mêmes restent celles de la section (Réglages › Sections et membres ›
  En-tête des courriers), où un renvoi l'indique.
- L'en-tête se construit maintenant en **trois zones d'égale largeur**
  (gauche, centre, droite), chaque image dans celle que sa position désigne ;
  deux logos dans la même zone s'y placent côte à côte. L'export PDF, Word et
  OpenDocument conserve la mise en page — la rangée des logos s'y écrit en
  tableau sans filets, et l'image y garde la taille où la feuille l'affichait.
- Six colonnes nouvelles sur `Types_Trames` (`Marianne_position`,
  `Marianne_largeur`, `Marianne_hauteur`, `Logo_position`, `Logo_largeur`,
  `Logo_hauteur`) : « Installer la structure » les ajoute à un document Grist
  existant, et l'export du registre des formats les emporte. Harnais, Aide,
  `SPEC.md` § 3 et § 8 (invariant 28), `EXIGENCES.md` (EX-059) et `README.md`
  suivent.

Vérification avant livraison : `verifier.mjs` — harnais **43/43**, test de fumée
**10/10 écrans**, aucun échec ; export PDF, Word et OpenDocument d'un document
d'essai sans erreur, en-tête relu à l'écran et dans le PDF.

## [1.2.1] — 2026-09-22

Le **récap des textes** du bloc « Procédure et composition » se lit.

- Le bloc empilait un tableau, une liste d'avertissements sans titre et une
  grille de définitions où les couples se chevauchaient dès qu'une valeur
  s'allongeait ; la ligne « Textes » y alignait quatre renvois dans une seule
  phrase à points-virgules — un mur de références que rien n'introduisait.
- La procédure se présente désormais en quatre fiches titrées — « Organes et
  quorum », « Déroulement », « Prescription et effacement », « Textes de
  référence » —, chacune dans une liste de définitions **en lignes** : libellé à
  gauche, valeur à droite, un filet entre les couples, l'alignement tenu même
  quand la valeur court sur plusieurs lignes.
- Chaque texte de référence est précédé de ce qu'il **fonde** — « Champ de la
  procédure et manquements des usagers — Article R.811-11 et suivants du code de
  l'éducation » —, au lieu d'être aligné sans intitulé. Les avertissements de
  prescription et d'effacement, qui flottaient entre le tableau et le détail, ont
  rejoint la fiche « Prescription et effacement » ; ceux de composition restent
  collés au tableau des membres.
- Nouvelle variante `dl(entries, { variante: "lignes" })` dans `ui.js` et son
  style dans `styles.css` ; `objetDuTexte()` dans `procedure.js` nomme chaque
  texte cité, et le bloc « Textes de référence » de l'Aide et du rappel
  « Procédure applicable » d'une affaire porte la même présentation.

- Le rappel du **dossier de pièces** — « Déclarer le dossier » ou « Ouvrir le
  dossier » —, dans le bandeau d'une affaire, touchait la ligne du cheminement
  d'état qui le suit : il gagne sous lui la respiration qui manquait, sans perdre
  le filet qui le détache du haut du bandeau.

Vérification avant livraison : `verifier.mjs` — harnais **42/42**, test de fumée
**10/10 écrans**, aucun échec.

## [1.2.0] — 2026-09-22

Le **dossier de pièces** d'une affaire se déclare, se rappelle et s'ouvre.

- Les pièces d'un dossier disciplinaire sont tenues **hors de l'outil** — bureau
  numérique, espace de partage, fichiers.gouv.fr… —, qui n'en garde que
  l'adresse (`Affaires.Lien_vers_le_dossier`). Cette adresse se renseignait une
  fois, dans un formulaire qu'on ne rouvrait pas : elle disparaissait de l'usage,
  et l'affaire s'instruisait sans que personne ne sache plus où étaient ses
  pièces.
- Un **bandeau de dossier** figure désormais en tête de l'affaire, sur tous ses
  onglets : « Ouvrir le dossier » y ouvre l'adresse déclarée dans un nouvel
  onglet, « Déclarer le dossier » ouvre une **fenêtre de déclaration** tant
  qu'elle manque. La fenêtre **complète** un domaine saisi sans schéma
  (`https://` ajouté) et **refuse** ce qui n'est pas une adresse web, plutôt que
  d'enregistrer un lien mort ; elle permet aussi de **retirer** le lien. La
  déclaration et le retrait sont inscrits au Journal.
- L'adresse se rappelle là où l'on ouvre les pièces : le rôle de la séance
  (bouton d'ouverture par ligne, avertissement sur les affaires sans adresse) et
  la fiche de l'affaire, où les champs de type « Lien » s'ouvrent maintenant d'un
  clic en lecture.
- Pour qu'on **pense à la renseigner** : un contrôle de régularité « Dossier
  dématérialisé » (information avant l'instruction, manque ensuite), un
  indicateur « Dossiers à déclarer » au tableau de bord, et un rappel à la
  création d'une affaire. Tous indicatifs : ils signalent, ils ne bloquent pas.
- Nouveau module `dossier.js` ; la documentation (Aide, `SPEC.md` § 2 et
  invariant 27, `EXIGENCES.md` EX-019, `README.md`) et le harnais suivent.

Vérification avant livraison : `verifier.mjs` — harnais **42/42**, test de fumée
**10/10 écrans** et **1/1 fenêtre modale**, aucun échec.

## [1.1.2] — 2026-09-22

L'**environnement de recette** ne s'applique plus à un document Grist.

- La même copie du générateur sert la **vitrine** — qui se déclare « recette » —
  et le **widget d'un document réel**. Jusqu'ici, la déclaration de la vitrine
  suivait la page jusque dans le document : le bandeau « Environnement de
  recette » s'affichait sur une base réelle, et les outils de fabrication
  restaient ouverts. Désormais, dès que la liaison au document aboutit, `app.js`
  appelle `declarerDocumentGrist()` (`environnement.js`) : l'outil passe en
  **production**, quelle que soit la déclaration de la page — bandeau retiré,
  onglet Debug, simulation de rôle, purge du stockage et jeu d'exemple refermés
  (NC-0008). L'installation de la structure d'un document relié pose la même
  bascule.
- La bascule ne va jamais dans l'autre sens : rien ne ramène un document réel en
  recette. La règle est portée par `SPEC.md` § 10 et `EXIGENCES.md` (EX-044), et
  un cas du harnais l'éprouve.

Vérification avant livraison : `verifier.mjs` — harnais **41/41**, test de fumée
**10/10 écrans** et **1/1 fenêtre modale**, aucun échec.

## [1.1.1] — 2026-09-21

Correction de la **voie de recours** : elle suit le **public** de la section, et
non la seule procédure d'ensemble.

- La décision prise à l'égard d'un **usager** se défère au **tribunal
  administratif** compétent dans le ressort duquel se trouve le siège de
  l'établissement — et non au CNESER, qui ne connaît que des recours des
  enseignants-chercheurs (`procedure.js` : `juridictionRecours`, désormais le
  même pour les usagers des deux tutelles).
- L'**enseignant-chercheur** reste devant le **CNESER**, ou devant le
  **CNESERAAV** dans un établissement d'enseignement supérieur agricole.
- L'**article de recours** proposé à l'atelier (`formules-decision.js`) suit la
  même règle : un article pour le juge administratif s'ajoute à ceux du CNESER et
  du CNESERAAV, et seul celui qui convient est mis en avant.
- La **voie de recours** devient une **colonne calculée** de la section
  (`Sections_disciplinaires.Voie_de_recours`) que les trames de notification
  reprennent (`{{Affaire_Section}}.Voie_de_recours`) au lieu d'écrire en dur le
  CNESER ou le juge : la lettre destinée aux enseignants-chercheurs citait à tort
  le tribunal administratif, et celle des usagers désignait le tribunal « de
  <siège> » là où la compétence se lit dans le ressort du siège.
- Les **données livrées** (`seed.js`) portaient la voie de recours **inversée** :
  chaque recours d'exemple retrouve sa juridiction et son type — recours
  contentieux pour un usager, appel pour un enseignant-chercheur.
- Une **reprise** (`migrerVoieDeRecours`, schema.js) réécrit la voie de recours
  des notifications déjà installées qui portent encore la formule livrée : la
  colonne calculée lui succède, la lettre des enseignants-chercheurs retrouve son
  article R.712-42, et le texte d'une trame propre à l'établissement n'est pas
  touché.

Vérification avant livraison : `verifier.mjs` — harnais **40/40**, test de fumée
**10/10 écrans** et **1/1 fenêtre modale**, aucun échec.

## [1.1.0] — 2026-09-21

Remédiation de la seconde campagne d'audit du 21 septembre 2026
(`audit/rapports/audit-2026-09-21-2.md`) : les onze constats restés ouverts
(NC-0017 à NC-0027) sont corrigés, et le registre les porte à « corrigée ».

Vérification avant livraison (NC-0025) : `verifier.mjs` — analyse syntaxique de
tous les modules livrés (68 modules sur les 90 fichiers de l'archive),
**39/39 cas du harnais réussis** ; test de fumée **10/10 écrans** et
**1/1 fenêtre modale**, aucun échec.

### Conservation, régularité et actes (P1)

- **NC-0017** — Durée de conservation des dossiers et sort final réglables
  (`Parametres` : `conservation_annees`, `sort_final`), échéance calculée depuis
  la décision définitive — à défaut sa notification, puis la saisine — et
  affichée sur la fiche ; état d'archivage de chaque affaire ; **état des pièces
  pour versement** exportable en CSV, avec le décompte des pièces à conserver ;
  l'échec de la conversion PDF/A est désormais remonté (`exportPdf` → `pdfA`).
- **NC-0018** — **Revue de régularité attestée** : date, lecteur et entrée au
  Journal, et une mention (`Regularite_mention`) insérable dans un acte. Les
  contrôles restent indicatifs — la revue laisse une trace, elle ne bloque rien.
- **NC-0020** — **Numérotation des actes** : numéro par décision (séquence par
  section et par année, jamais rejoué après suppression), registre consultable
  sur la page Décisions et exportable en CSV, numéro porté au Journal.

### Autres correctifs

- **NC-0019** — Les références juridiques deviennent vérifiables : la citation
  « M. XXX c. VetAgroSup » est remplacée par une décision identifiable, la page
  Réglages › Catalogues › **Références** réunit les sources citées, signale
  celles qui ne sont pas retrouvables et les affirmations à faire viser, et un
  seuil (`references_verifiees_le`) **date la vérification** du service
  juridique.
- **NC-0021** — L'enveloppe Perchance de l'archive est passée à la production
  avant écriture, et re-forcée sur tous les `.html` de l'archive.
- **NC-0022** — Le verrouillage d'écran est un vrai contrôle d'accès : code
  défini par l'utilisateur, conservé en empreinte, déverrouillage journalisé ; à
  défaut de code, le libellé dit ce que l'écran fait réellement.
- **NC-0023** — Widget rétabli pour une instance auto-hébergée :
  `grist.numerique.gouv.fr` est reconnue sans réglage, une origine se déclare
  dans Réglages, `README.md` et `SECURITE.md` disent la règle au lieu
  d'annoncer « sans réglage ».
- **NC-0024** — L'échec d'écriture dans le navigateur n'est plus silencieux :
  bandeau avec la cause, entrée au Journal, ligne au diagnostic ; l'occupation
  du stockage est mesurée et signalée à 60 % puis 85 %.
- **NC-0025** — `verifier.mjs` exécute la vérification de la livraison
  (syntaxe de tous les modules, harnais optionnel) en un appel, depuis l'onglet
  Debug ou en ligne de commande ; le résultat est consigné ici.
- **NC-0026** — L'alignement des contenus montre ce qu'il va changer (lignes et
  champs), distingue l'ajout de la correction, journalise ligne à ligne et ne se
  dit à jour que si tout a été appliqué.
- **NC-0027** — Les fenêtres modales confinent le focus (boucle au clavier, fond
  neutralisé, retour au déclencheur à la fermeture).

### Contenus livrés

- Seuils livrés portés à douze : durée de conservation des dossiers, sort final
  (`Conservation`) et date de la dernière vérification des références
  (`Juridique`). Empreinte `VERSION_CONTENUS` → `2026-09-21.2`.

## [1.0.0] — 2026-09-21

Première livraison numérotée. Elle applique les recommandations de l'audit du
21 septembre 2026 (`audit/rapports/audit-2026-09-21.md`), à l'exception du
chapitre 4 — conservation, régularité attestée, vérification des références,
registre des actes —, qui reste à trancher avec le commanditaire.

### Sécurité (P0)

- **NC-0006** — Le rendu échappe désormais toute valeur de donnée substituée
  dans un document, et l'enregistrement comme l'import assainissent les colonnes
  rendues comme du HTML (`sanitize.js`). Une balise saisie dans un champ ne peut
  plus s'exécuter dans la session du lecteur.
- **NC-0007** — Les exports CSV et Excel neutralisent les valeurs qui
  commenceraient par `=`, `+`, `-` ou `@` (`export-table.js`).
- **NC-0011** — L'API du widget Grist n'est plus chargée depuis l'origine lue
  dans `Referer` : seules des origines déclarées sont acceptées
  (`grist-backend.js`, `window.GRIST_ALLOWED_ORIGINS` ou la balise
  `<meta name="grist-origins">`).
- **NC-0008** — L'environnement est **déclaré** (`window.ENVIRONNEMENT`), jamais
  déduit ; le défaut est la production. La recette s'affiche visiblement, et
  l'onglet Debug comme les outils de purge y sont réservés.

### Conformité des données (P1)

- **NC-0009** — Mode session (rien n'est conservé sur le poste), verrouillage
  après inactivité, avertissement sur le poste partagé.
- **NC-0010** — Dossier de conformité (`rgpd/` : registre des traitements,
  décision sur l'analyse d'impact, durées de conservation, mentions
  d'information) ; suppressions journalisées **avant** exécution ; corbeille
  datée et purgeable selon une durée réglable.
- **NC-0014** — Déclaration d'accessibilité, schéma pluriannuel et plan
  d'action (`accessibilite/`), publiés dans l'outil et liés depuis l'Aide.

### Qualité et accessibilité (P1)

- **NC-0012** — Hiérarchie des titres corrigée (sections en H2, sous-blocs en
  H3) sur tous les écrans.
- **NC-0013** — Plus de débordement à 320 px (affaires, réglages › sections).
- **NC-0001** — **Harnais de tests** sans dépendance (`tests/`) : un cas par
  invariant de `SPEC.md` § 8 qui se vérifie sur de la logique pure, plus un test
  de fumée par écran.
- **NC-0002** — Numéro de version (`version.js`), affiché dans Réglages ›
  Données › Diagnostic, et ce journal.
- **NC-0005** — Les contenus livrés sont **versionnés** (empreinte) ; une base
  qui ne les a pas reçus en est avertie, et s'aligne d'un geste sans que le
  texte de ses trames ni ses propres lignes soient touchés (`contenus.js`).
- **NC-0003** — Voir `SECURITE.md` : dépendances figées (intégrité), politique
  de sécurité du contenu à déployer, hébergement des polices, mode dégradé.
- **NC-0015** — Les comptages des contenus livrés sont **produits par le code**
  (`contenus.js`) ; le motif « Usage frauduleux d'un logiciel de triche »,
  annoncé mais absent, est rétabli ; la documentation est corrigée.
- **NC-0004** — Variante minifiée et regroupée à la livraison (`livraison/`).
- **NC-0016** — Référentiel d'exigences et matrice de couverture
  (`EXIGENCES.md`), à faire accepter par le commanditaire.
