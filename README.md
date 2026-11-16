# Gestion des sections disciplinaires

Application web autonome (HTML + CSS + JavaScript, **sans étape de compilation**)
qui remplace l'outil Grist « Gestion des sections disciplinaires » : suivi des
affaires, composition des formations, séances, décisions, recours et génération
des courriers (trames).

L'interface est bâtie sur le **Système de design de l'État (DSFR)**. Elle peut
être portée sous deux **chartes** (Réglages › Charte graphique) : la *charte
neutre* (le défaut), qui garde les composants et la mise en page du DSFR mais
**sans la marque de l'État**, en **Public Sans**, et avec un **bleu d'action
décalé d'un cran**, et la *charte de l'État*, avec le bloc-marque « République
Française » et la police Marianne — elle se demande explicitement, car afficher
la marque de l'État est un acte. La même page règle la police des documents.
Voir « Charte graphique et polices » au chapitre 5.

Le modèle de données a été **reconstruit d'après les besoins de l'interface**
(modèle « v2 »), et non transposé du tableur d'origine : voir `SPEC.md` pour la
justification de chaque table, et `legacy.js` pour l'architecture d'origine, qui
alimente l'**outil d'import** (Réglages › Import des données) par lequel les
données déjà saisies rejoignent le modèle. Voir aussi **`UI-AUDIT.md`** :
mesures de chaque vue avant/après réaménagement — les propositions de cet audit
sont **implémentées** (voir « Quatre principes de mise en page » au chapitre 3).

Les procédures disciplinaires — sections d'usagers et sections
d'enseignants-chercheurs, sections d'établissement, d'école interne, sections
communes et section disciplinaire académique — sont décrites dans
`procedure.js`, qui en est la source de vérité, et présentées à l'utilisateur
dans la page Aide, dans Réglages › Sections et dans l'onglet « Synthèse » d'une
affaire. Chaque section déclare son **public**, sa **tutelle** (ministère chargé
de l'enseignement supérieur ou de l'agriculture) et son **type** : le public
commande la procédure, la tutelle et le type la composition des organes. Le
**type** dit aussi auprès de quel conseil la section est instituée, et donc le
nom de l'**organe compétent** : le conseil académique de l'établissement, le
conseil d'administration dans les établissements agricoles, et le **conseil de
l'école interne** pour une section d'école interne (`procedure.js`,
`libelleOrgane`). La voie
de l'article R.811-40 — une alternative à l'instruction, qui n'en comporte
aucune — n'est proposée que là où les textes la prévoient (sections compétentes
à l'égard des usagers). Voir `SPEC.md` § 1 et la page Aide.

Deux modes de fonctionnement, choisis automatiquement au chargement :

| Contexte d'ouverture | Mode | Stockage |
| --- | --- | --- |
| Onglet de navigateur / GitHub Pages | Autonome | `localStorage` du navigateur + export/import JSON |
| Widget personnalisé dans un document Grist | Grist | Tables du document Grist (lecture **et** écriture, selon le rôle) |

> Les données livrées avec l'application sont **fictives**. Elles servent
> uniquement à montrer le fonctionnement de l'outil.
>
> **Environnement** : la page se déclare « recette » ou « production »
> (`window.ENVIRONNEMENT`, `environnement.js`). Un **document Grist** est, lui,
> un déploiement réel : dès que la liaison aboutit, l'outil passe en production,
> quelle que soit la déclaration de la page — le bandeau de recette disparaît et
> les outils de mise au point restent fermés.
>
> **Vie privée** : l'outil ne dispose d'aucun serveur et n'émet aucune donnée
> vers l'extérieur. Dans un document Grist, tout passe par le document. Voir
> « Vie privée : tout s'exécute en local » au chapitre 6.

---

## 1. Déployer sur GitHub Pages

Le dossier de ce fichier (`src/`) est **la racine du site** : `index.html` doit
se trouver à la racine du dépôt.

1. Créez un dépôt (public) et déposez-y **le contenu** de ce dossier
   (`index.html`, `app.js`, `schema.js`, … à la racine — pas dans un
   sous-dossier).
2. Dans **Settings → Pages** : *Source* = `Deploy from a branch`,
   *Branch* = `main`, *Folder* = `/ (root)`. Enregistrez.
3. Au bout d'une minute, le site est disponible à l'adresse
   `https://<votre-compte>.github.io/<nom-du-depot>/`.

Aucune action de build n'est nécessaire : il n'y a ni bundler, ni `npm install`,
ni dépendance à compiler. Le DSFR est chargé depuis un CDN (jsDelivr), avec son
**empreinte d'intégrité** (NC-0003 : un fichier modifié chez le tiers est
refusé). Une **politique de sécurité du contenu** est posée par balise dans
`index.html` ; pour la variante servie depuis Perchance, qui n'a pas de `<head>`,
elle se déploie en en-tête HTTP — voir `SECURITE.md`, qui rassemble aussi
l'inventaire des briques tierces et le mode dégradé.

Une **variante minifiée et regroupée** du site est disponible pour les postes
modestes et les réseaux contraints : elle se construit sans installation avec
`livraison/build.mjs` (voir `livraison/README.md`). Le dépôt reste la référence.
Pour l'exploiter, **avant chaque livraison**, vérifiez la syntaxe des modules et
lancez les tests (`tests/README.md`), puis reportez la version dans
`CHANGELOG.md`. Le geste se fait d'un seul appel — « Vérifier la livraison »
dans l'onglet **Debug**, ou `src/verifier.mjs` en ligne de commande (NC-0025) :
la syntaxe de tous les modules est analysée, le harnais peut être exécuté dans
la foulée, et le rapport se recopie dans le journal des livraisons.

### Exporter l'archive depuis l'outil

L'onglet **Debug** (visible uniquement hors document Grist) contient un bouton
**« Télécharger le générateur (.zip) »** qui produit directement l'archive à
déposer sur l'hébergeur : la racine de l'archive est celle de ce dossier, et le
fichier `seed.js` y est **régénéré avec un jeu de données vide** — l'archive ne
contient donc aucune donnée de section disciplinaire et peut être publiée telle
quelle. Elle contient en plus un `LISEZ-MOI.txt` (contenu, mise en ligne,
usage Grist) et un dossier `perchance/` (`main.pjs` déduit du titre et de la
description de la page, `index.html` réécrit pour charger `src/`) permettant de
recréer un générateur Perchance avec le même code.

`export.js` découvre la liste des fichiers en partant de `index.html`, puis en
suivant les feuilles de style et les `import` relatifs des modules : un fichier
ajouté au projet est exporté sans rien mettre à jour, et un fichier référencé
mais introuvable fait échouer l'export avec un message explicite.

Pour un test local, servez le dossier avec un petit serveur HTTP
(`python3 -m http.server`). L'ouverture directe en `file://` ne fonctionne pas :
le navigateur refuse de charger les modules ES depuis le disque.

## 2. Utiliser comme widget dans un document Grist

1. Dans Grist : **Add New → Add Widget to Page**.
2. *Select Widget* = **Custom**, puis *Widget options* → **Enter Custom URL** :
   collez l'adresse GitHub Pages ci-dessus.
3. Accordez l'accès **Full document access** : l'application doit pouvoir lire
   *et* modifier les tables. Grist recharge le widget après l'autorisation.
4. Si le document est vide, l'application affiche un bandeau « Document Grist
   non relié », avec un bouton **« Installer la structure dans le document »** :
   un clic crée les tables du modèle et leurs colonnes — y compris la table
   facultative `Identite` (voir « En-tête de l'outil ») — et la table technique
   des utilisateurs, créée automatiquement. Les données d'exemple ne sont
   **pas** transférées — le document reste vierge, à vous de le remplir.
5. Le bouton **« Vérifier la structure »** (même page) compare à tout moment le
   document au modèle attendu et liste les tables et colonnes manquantes ;
   « Installer la structure » les ajoute **sans toucher aux données** et peut
   donc être relancé sans risque.

### Reprendre un tableur existant

Un établissement déjà équipé n'a pas à ressaisir ses dossiers : la reprise est
outillée (voir `SPEC.md` § 4 et § 5).

1. **Installer la structure** — « Installer la structure » crée les tables du
   modèle qui manquent au document (`Personnes`, `Intervenants`, `Implications`,
   `Recours`, `Sanctions`, `Motifs`, `Parametres`, `Journal`) et ajoute aux
   tables existantes les colonnes du modèle (`Affaires.Mis_en_cause`,
   `Decisions.Nature`, `Seances_d_examen.Type`…). La table d'origine
   `Commissions` n'est jamais recréée : elle n'appartient pas au modèle, l'outil
   la lit seulement.
2. **Reprendre les données** — **Réglages › Import des données** lit une source :
   le document Grist lui-même (`.grist`), un classeur (`.xlsx`, `.xls`, `.ods`), un
   fichier délimité (`.csv`, `.tsv`), un export JSON de l'outil — ou directement
   les tables du document connecté. Chaque feuille ou table de la source est
   rapprochée d'une table du modèle, par son nom puis par ses colonnes ; l'écran
   montre ce rapprochement (colonnes reconnues, colonnes écartées, table visée),
   laisse corriger l'affectation, puis applique la conversion — en mode
   *Compléter* (idempotent) ou *Remplacer*. L'écran explique aussi, colonne par
   colonne, ce que devient l'architecture d'origine, et ce qui n'est plus utilisé.
3. **Nettoyer** — l'outil ne supprime jamais rien dans le document : une fois la
   reprise vérifiée, la table `Commissions` et les colonnes d'origine se
   suppriment à la main dans Grist, en suivant le rapport d'import.

#### Formats de fichier acceptés

La lecture des fichiers vit dans `import-fichiers.js`, qui produit la source
tabulaire (`{ Table: lignes[] }`) attendue par `import.js`. Rien n'est écrit à
ce stade.

| Format | Ce qui est lu | Comment |
| --- | --- | --- |
| `.grist` | Toutes les tables du document | Un document Grist est une base **SQLite** : elle est ouverte avec `sql.js` (SQLite compilé en WebAssembly), téléchargé **à la demande** depuis jsDelivr. Le nom et le type des colonnes viennent de `_grist_Tables` / `_grist_Tables_column` ; les tables `_grist_*` et `_gristsys_*` sont écartées, et une table portant le préfixe `GristHidden_` est reconnue sous son nom de modèle. Un `.grist` compressé (gzip) est décompressé au passage. |
| `.xlsx`, `.xls`, `.ods` | Une feuille par table | Lu avec **SheetJS**, téléchargé à la demande depuis esm.sh. Un classeur exporté depuis Grist contient tout le document : les références s'y résolvent donc entre feuilles. |
| `.csv`, `.tsv` | Une table | Analyseur maison (guillemets, retours à la ligne encadrés, séparateur déduit : `;`, `,`, tabulation ou barre verticale), avec repli sur Windows-1252 si le fichier n'est pas de l'UTF-8 — les exports d'Excel français restent lisibles. La table cible est déduite du nom du fichier, puis de ses colonnes. |
| `.json` | Toutes les tables | Export de l'outil (`{ tables: … }`) ou objet dont les clés sont les noms des tables. |

Trois points commandent la conversion des valeurs, et méritent d'être connus :

- **L'en-tête d'un export Grist est le libellé de la colonne** (« Nom du mis en
  cause »), sauf option contraire. Les deux formes sont acceptées : chaque
  en-tête est ramené à l'identifiant de colonne du modèle, en comparant sans
  accent ni casse les identifiants, les libellés et les noms de l'architecture
  d'origine.
- **Un export Grist écrit les références en toutes lettres** : la colonne d'une
  référence contient le libellé de la ligne visée, pas son identifiant. Quand la
  table visée se trouve dans le même fichier — un classeur ou un document Grist —
  le lien est rétabli (`resoudreRefsTexte`) ; une valeur qui désigne deux lignes
  n'est pas devinée, et l'application de l'import la signale. Un `.csv` isolé ne
  contient qu'une table : ses références ne peuvent pas être résolues, et
  l'écran d'import le dit.
- **Dates, nombres et booléens sont relus dans les deux langues** : date au
  format AAAA-MM-JJ comme JJ/MM/AAAA (jour d'abord), séparateur décimal virgule
  comme point, `oui`/`vrai`/`x` comme `true`. Une ligne sans identifiant reçoit
  un identifiant à la suite de ceux du fichier, pour que les liens internes à la
  source se résolvent.

#### Champs de fichier : les deux pièges traités dans `app.js`

Les champs `<input type="file">` sont pris en charge par `fichierDuChamp`
(`src/app.js`), que les événements `input` **et** `change` appellent :

- `change` est déclenché par tous les navigateurs, `input` seulement par
  certains **pour un champ de fichier**. S'en remettre au seul `input` revient
  donc à ne rien importer sur les navigateurs qui ne l'émettent pas. Un repère
  posé sur le champ empêche la seconde passe de relire le même fichier.
- **Vider le champ (`el.value = ""`) avant la fin de la lecture libère le
  fichier** dans plusieurs navigateurs : la lecture échoue alors — « The
  requested file could not be read » — sur un fichier pourtant bien choisi. Le
  champ n'est donc vidé qu'**une fois la lecture terminée**, ce qui laisse
  malgré tout resélectionner le même fichier.

Un fichier illisible (format non reconnu, lecture interrompue, classeur ou base
corrompus) n'échoue jamais en silence : l'écran « Import des données » affiche
l'erreur exacte **sous le bouton** (`state.import.erreur`), avec la liste des
formats acceptés, et laisse retirer la source.


Après la migration, Grist ne sert plus que de **stockage et de gestion des
droits** : les colonnes calculées et les tableaux de résumé de l'ancien
document sont remplacés par les écrans « Tableau de bord » et « Décisions », qui
les calculent en direct.

L'API Grist (~900 ko) n'est téléchargée **que** lorsque la page est réellement
affichée dans un cadre (widget) : une visite normale du site ne la charge
jamais. Elle est cherchée d'abord **sur le serveur du document** — l'adresse
lue dans `Referer` — puis, à défaut, sur `docs.getgrist.com`.

Pour des raisons de sécurité, le serveur du document n'est utilisé que si son
origine est **autorisée** : une page tierce qui encadrerait l'outil ne peut donc
pas lui faire exécuter son propre script. Sont reconnues sans réglage les
instances publiques (`docs.getgrist.com`, `getgrist.com`) et l'instance
souveraine de l'État (`grist.numerique.gouv.fr`). Une instance
**auto-hébergée doit être déclarée** — voir « Déclarer un serveur Grist
auto-hébergé » ci-dessous.

### Déclarer un serveur Grist auto-hébergé

Trois voies, de la plus locale à la plus générale :

- **Réglages › Données › Serveur Grist déclaré** : saisissez l'adresse du
  serveur (par exemple `https://grist.mon-etablissement.fr`). La déclaration
  est conservée sur le poste et vaut pour les visites suivantes. C'est la voie
  à privilégier pour un essai ou un poste isolé.
- **Une balise dans `index.html`**, qui vaut pour tous les postes :

  ```html
  <meta name="grist-origins" content="grist.mon-etablissement.fr">
  ```

- **Une variable avant le chargement de `app.js`**, qui accepte plusieurs
  serveurs :

  ```html
  <script>window.GRIST_ALLOWED_ORIGINS = ["grist.mon-etablissement.fr", "grist.interne.test"];</script>
  ```

Dans les deux dernières formes, seul le **nom d'hôte** compte (le port et le
chemin sont ignorés). Une origine déclarée apparaît dans
Réglages › Données › Diagnostic, avec l'origine de la page appelante et la
liste complète des origines autorisées.

### Écran d'attente : rien n'est montré avant la réponse du document

Détectée dans un cadre Grist, la page affiche un **écran d'attente** (titre du
service, indicateur d'activité, « Connexion au document Grist… ») tant que le
document n'a pas répondu — voir `loadingShellHtml` dans `app.js`.

Sans lui, l'outil dessinerait d'abord la base **locale** — celle du jeu de
démonstration — et laisserait voir, le temps de la liaison, des sections, des
affaires et des logos qui ne sont pas ceux du document. Rien n'est donc montré
avant la réponse de Grist : ni données, ni logo d'opérateur, ni navigation. Seul
le bandeau de l'État et le nom du service restent en place, pour que la page ne
sauve pas au moment où les données arrivent.

Deux garde-fous complètent l'attente :

- **La liaison est bornée** (10 s, `HANDSHAKE_TIMEOUT_MS`) : sans réponse,
  l'outil retombe sur son fonctionnement local et l'**explique** par le bandeau
  « Document Grist non relié » — il ne reste pas sur l'écran d'attente.
- **L'identification est bornée** elle aussi (8 s, `IDENTITY_DEADLINE_MS`) :
  les appels qui établissent le rôle interrogent Grist à leur tour, et un
  document devenu muet entre-temps ne doit pas retenir l'affichage. Passé le
  délai, la page s'affiche avec le rôle le plus restrictif ; si l'identité
  arrive plus tard, le rôle réel est appliqué et l'écran redessiné.

Sans réponse du document, le lien avec le document n'existe pas : les données
modifiées restent dans le navigateur, et la personne est traitée comme
propriétaire de cette base locale (comme hors de Grist). Un document qui répond
mais auquel il manque les tables garde, lui, son identité Grist.

### Les tables du document sont masquées dans Grist

Toutes les tables de l'outil sont créées dans le document sous le préfixe
**`GristHidden_`** : `GristHidden_Affaires`, `GristHidden_Decisions`,
`GristHidden_Sections_disciplinaires`… Grist retire de son interface toute table
dont l'identifiant commence par ce préfixe — elle disparaît du **sélecteur de
widgets**, de la page **« Données brutes »** et de la **barre d'onglets**.

C'est voulu : le document sert de **base de données**, l'outil en est
l'**interface**. Une table laissée visible inviterait à la saisie directe, qui
contournerait les contrôles de régularité, les colonnes calculées, la
journalisation et l'attribution des affaires. Les données restent évidemment
accessibles par l'API Grist, à qui sait s'en servir.

Trois points à connaître :

- **Les documents antérieurs sont renommés automatiquement**, une fois, à la
  première liaison : `RenameTable` renomme chaque table sous son nom préfixé, et
  Grist met à jour au passage les colonnes de référence et les formules du
  document qui les nomment. Un message le signale (`N table(s) du document
  masquée(s) dans Grist`). Aucune donnée n'est déplacée.
- **Un renommage refusé ne casse rien** : renommer appartient au *schéma*, une
  personne qui n'a le droit de modifier que les données le verra refusé. L'outil
  continue alors de lire et d'écrire ces tables sous leur nom court — seules
  leurs tables restent visibles dans Grist. Le journal de diagnostic le note.
- **Le préfixe est un détail de stockage** : l'outil raisonne partout sur les
  noms courts (`Affaires`, `Decisions`…), la traduction se faisant aux portes
  d'entrée et de sortie de Grist (voir `HIDDEN_PREFIX` et `physique()` dans
  `grist-backend.js`). Les tables qui appartiennent au document — la table
  d'héritage `Commissions` — ne sont jamais renommées.

### En cas de problème : « mes saisies n'arrivent pas dans le document »

Toute panne de la liaison est annoncée par un **bandeau rouge ou orange** en
tête de page, car rien n'est plus trompeur qu'une fiche qui semble enregistrée.
Le bandeau indique la cause et le geste à faire :

| Bandeau | Cause | Geste |
| --- | --- | --- |
| « Document Grist non relié » (tables absentes) | Le document ne contient pas encore les tables de l'outil. | Bouton **« Installer la structure dans le document »**, dans le bandeau même (aucun réglage à ouvrir : un propriétaire dont la table technique n'existe pas encore serait pris pour un simple secrétaire). |
| « Document Grist non relié » (API introuvable) | L'API du widget n'a pas pu être chargée : adresse du widget erronée, accès au script bloqué, ou page non affichée dans un document Grist. | Corriger l'adresse du widget, puis **« Réessayer la liaison »**. Si le bandeau ajoute que l'affichage est **imbriqué**, c'est que l'adresse collée dans le widget est celle d'une page qui *contient* l'outil : l'API du widget ne répond qu'à son **parent immédiat**, il faut coller l'adresse du site lui-même. |
| « Le document Grist n'accorde pas le droit d'écriture » | Le widget est en « Read table » au lieu de « Full document access ». | Dans les options du widget Grist, choisir **Full document access**, puis recharger. |
| « Les modifications ne sont pas enregistrées dans le document » | Grist a refusé une écriture (droits, ou rôle en consultation seule). | Le message de Grist est repris tel quel. Le bandeau disparaît dès qu'une écriture aboutit. |
| « Le document Grist est incomplet » (message de Grist : `[Sandbox] KeyError 'X'`) | Le document a bien toutes les tables, mais il lui manque une **colonne** attendue par l'outil. Grist l'a réclamée par son nom — souvent `Affaires.Composante`, qui a été supprimée du document d'origine : les formules du document qui s'y réfèrent échouent, et **toute écriture est alors refusée**. | Le bandeau nomme la colonne manquante et propose **« Compléter la structure »**, qui la crée sans toucher aux données existantes. Le même contrôle est disponible à tout moment par **« Vérifier la structure »** (Réglages › Données). |
| « Le document Grist est en lecture seule » (message de Grist : `No write access, document is read-only`) | Le **serveur** Grist retient le document en lecture seule : il refuse toute modification, quel que soit le rôle de la personne (Grist précise que seule l'écriture est touchée, pas les droits). Raisons possibles, toutes du ressort du serveur : site d'équipe **suspendu**, abonnement en défaut, plan dépassé (trop de membres), ou instance en accès restreint. L'outil le sait par le paramètre `readonly` de l'adresse que Grist lui donne, et par le code d'erreur `AUTH_NO_EDIT`. | Rien à corriger dans l'outil : ouvrir le document **dans Grist**, où une bannière indique la raison, et la traiter (administrateur de l'instance). La lecture continue de fonctionner ; les saisies faites entre-temps restent dans le navigateur, et l'outil disparaît de lui-même dès que le document redevient modifiable (recharger la page). |

Le bloc **Diagnostic** (Réglages › Données, réservé aux propriétaires) donne
l'état exact : mode d'exécution, connexion, accès accordé au widget, **adresse
de l'API retenue**, **écritures actives ou non**, **profondeur du cadre**, rôle
appliqué, dernière erreur et dernière erreur d'écriture. C'est le premier
endroit à consulter — et le seul où le statut de connexion est affiché.

Juste en dessous, le **Journal de diagnostic** (même page, réservé aux
propriétaires) produit un compte rendu complet et **copiable** de la liaison :
tables et colonnes réellement présentes dans le document, comparaison avec le
modèle de l'outil, formules du document, personnes autorisées, et **journal des
écritures, y compris celles que Grist a refusées, avec l'action exacte qui a
échoué**. Grist n'indique jamais lui-même quel enregistrement est en cause ; ce
journal comble ce manque, et c'est lui qu'il faut transmettre pour faire
diagnostiquer une panne (« Copier le journal », ou « Télécharger (.txt) »). Il
s'ouvre automatiquement dès qu'une erreur d'écriture ou une structure
incomplète est détectée.

À savoir également :

- **Au retour sur la page, ce qui a échoué est retenté.** Une liaison retombée
  en erreur, ou une identification restée sans réponse pendant que l'onglet
  était en arrière-plan — c'est le cas après l'ouverture de la messagerie
  depuis un lien de contact —, se répare d'elle-même au retour (`focus` /
  `visibilitychange`, dans `app.js`) : la liaison est refaite, ou l'identité
  redemandée si le rôle affiché n'était pas prouvé par le document. Sans cela,
  l'outil restait en lecture seule, sans accès au document, et il fallait
  recharger la page. Un document réellement fermé à l'écriture, ou un rôle déjà
  établi, ne donne pas lieu à une nouvelle demande.
- **Les liens de contact ne font jamais naviguer la page.** Un `mailto:` (ou un
  `tel:`) cliqué dans le cadre du widget ouvrait le client de messagerie **en
  emportant la page** : le document était déchargé, la liaison au document Grist
  avec lui, et le retour de la messagerie laissait l'outil sans identité — d'où
  la page à recharger. Ces liens s'ouvrent désormais **hors du cadre**
  (`ouvrirLienExterne`), et si le navigateur refuse la fenêtre, l'adresse est
  copiée et annoncée. Dans l'éditeur, le clic place le curseur : c'est
  **Ctrl (ou Cmd) + clic** qui suit le lien, comme dans un traitement de texte.
- L'outil envoie ses modifications **au fil de la frappe** (les champs d'une
  fiche sont écrits à la validation du champ). Les identifiants de lignes sont
  attribués par Grist : l'outil conserve une correspondance entre ses
  identifiants locaux (négatifs) et ceux du document, si bien qu'une fiche
  créée puis modifiée aussitôt vise le bon enregistrement.
- **Les écritures en bloc atteignent le document, elles aussi.** La base locale
  n'est qu'une copie de travail du document : la remplacer localement ne change
  rien au document, et l'état d'avant reviendrait au rechargement — c'est
  exactement ce qui se produisait avant que ce point soit traité. En mode
  Grist :
  - un **import** écrit au document les **seules lignes créées ou complétées**,
    jamais une réécriture générale : un réimport n'écrit donc rien, et les
    lignes déjà présentes gardent leur identité (leurs liens, leur historique)
    dans le document (`appliquerDansLeDocument`, `import.js`) ;
  - un **remplacement en bloc** — restauration d'un export JSON, remise à zéro,
    mode « Remplacer » d'un import — vide puis réécrit les tables du modèle,
    dans l'ordre des dépendances (`remplacerDocument`, `grist-backend.js`) ;
    les tables d'héritage et la table technique des utilisateurs ne sont jamais
    touchées.

  Toute fonction qui remplace `store.db` **doit passer par
  `store.replaceAll`**, seul point d'entrée qui prévient le document (via
  `store.onGristReplace`) ; écrire `store.db` directement perdrait le travail
  au rechargement suivant.
- Les colonnes marquées `formula: true` dans `schema.js` ne sont **jamais**
  écrites (Grist les refuse) : elles sont recalculées côté client.
- **Les colonnes sont vérifiées à chaque branchement**, pas seulement les
  tables : un document qui a toutes les tables mais pas toutes les colonnes
  (cas du document d'origine, d'où `Affaires.Composante` avait été supprimée)
  refuse toutes les écritures — Grist répond `[Sandbox] KeyError 'Composante'`,
  car les formules du document s'y réfèrent. L'outil l'annonce alors par le
  bandeau **« Le document Grist est incomplet »**, qui nomme la colonne et
  propose de la créer.
- « Installer la structure » traduit les types du schéma en types Grist : les
  colonnes décrites `LongText` (texte long) ou `Link` (adresse web), qui
  n'existent pas dans Grist, sont créées en `Text` — un texte Grist n'a pas de
  longueur maximale. Si le document refuse une création de colonne, l'outil
  rejoue le lot action par action pour nommer précisément la colonne fautive
  (Grist n'explique jamais *quelle* action d'un lot a échoué).
- Les colonnes **obsolètes** du schéma — marquées `ancien: true`, comme les
  quatre blocs de mise en page d'un format (`En_tete`, `Signature`,
  `Pied_de_page`, `En_tete_corps`) — sont **ignorées** : ni créées, ni
  réclamées. Une base qui les porte encore ne s'en trouve pas incomplète, et
  une base neuve ne les reçoit pas.
- La table `Identite` (logo de l'opérateur affiché dans l'en-tête) est la seule
  table **facultative** : un document créé avant son apparition reste relié
  normalement, sans bandeau. « Réglages › Identité » propose alors
  **« Créer la table dans le document »**, qui n'ajoute que cette table ;
  « Vérifier la structure » ne la signale pas tant que vous ne vous en servez
  pas. Voir « En-tête de l'outil » au chapitre 3.

- **Le serveur Grist peut retenir un document en lecture seule** : Grist refuse
  alors toute écriture (« No write access, document is read-only », code
  `AUTH_NO_EDIT`) alors que le rôle de la personne reste inchangé — site
  d'équipe suspendu, abonnement en défaut, plan dépassé ou instance en accès
  restreint. L'outil détecte cet état (paramètre `readonly` de l'adresse donnée
  au widget, et code d'erreur) et l'annonce clairement, au lieu de laisser
  croire à un défaut de droits ou à une panne de l'outil.

### Écritures refusées : rien n'est perdu en silence

Une modification refusée par le document resterait dans la base de travail du
navigateur, et le rechargement suivant — qui relit le document — l'effacerait.
Trois garde-fous, dans `grist-backend.js` (section « Écritures en attente ») :

- **Les écritures sont retenues.** Chaque écriture est mise en file *avant*
  d'être tentée ; le document l'accepte, elle est oubliée ; il la refuse, elle
  demeure. Les modifications d'une même ligne fusionnent, et une ligne créée
  puis supprimée pendant la panne s'annule — la file ne contient donc jamais
  plus d'écritures qu'il n'y a de changements réels.
- **Le bandeau propose de les renvoyer.** Il annonce combien de modifications
  attendent, lesquelles (leurs tables), et porte deux boutons : **« Renvoyer les
  modifications en attente »** (`retryPendingWrites`) et **« Télécharger une
  copie (JSON) »**. Un rôle sans droit d'écriture n'a rien à rejouer : la file
  est vidée pour lui.
- **Le navigateur avertit avant de quitter la page** tant que la file n'est pas
  vide (`beforeunload`, posé dans `boot()`), et une chasse à la fermeture
  (`pagehide`, visibilité masquée) demande l'envoi immédiat de ce qui attend.

La file d'attente **survit au rechargement** : elle est mémorisée dans le
navigateur à chaque mouvement, avec l'image d'avant modification de chaque mise
à jour. Au branchement suivant, chaque écriture retrouvée est triée
(`classerReprises`) : la ligne est intacte depuis — elle est réappliquée à
l'écran et renvoyée ; elle a disparu ou changé entre-temps — elle est écartée
et nommée dans le bandeau, jamais réécrite par-dessus le document. Le bandeau
propose alors le renvoi, une copie de secours, ou l'abandon explicite — quitter
la page tant qu'il est affiché est annoncé comme une perte. Seule limite : une
ligne **créée** hors-ligne porte un identifiant local, inconnu du document —
son renvoi après rechargement la recrée, sans reprendre les lignes qui la
citaient déjà sous cet identifiant.

Un rejeu n'est possible que **tant que la page reste ouverte** : les écritures
retiennent les identifiants locaux (négatifs) que le magasin emploie en
attendant la réponse du document, et un rechargement les remplace par les
identifiants du document. D'où l'avertissement : quitter la page sans avoir
renvoyé les modifications les perd. La copie JSON, elle, reste. Seule limite
de la file mémorisée : la mise à jour d'une ligne créée hors-ligne mais jamais
envoyée ne peut pas être renvoyée après rechargement — la ligne n'existe pas
dans le document, et la reprise l'écarte en le disant (la création elle-même,
elle, est renvoyée).

### Écritures groupées, rendus regroupés : ce qui évite l'attente

Chaque écriture envoyée au document est un aller-retour : passer par l'API du
widget, laisser Grist appliquer l'action et recalculer ses formules, puis rendre
la réponse. Une écriture par frappe au clavier — l'éditeur WYSIWYG écrit à
chaque frappe — ou par ligne d'import en enchaînait des centaines, à la queue leu
leu, et l'outil paraissait figé alors qu'il attendait seulement le document.
Trois mécanismes, tous dans `grist-backend.js`, y remédient :

- **Les écritures retenues partent par lots** (section « Regroupement des
  écritures »). Un court silence suffit à déclencher l'envoi, et le lot part en
  **un seul** appel à `applyUserActions` : trente frappes dans l'éditeur ne font
  plus qu'un aller-retour, un remplacement de cinq cents lignes une poignée
  d'appels. Deux bornes empêchent l'attente perpétuelle — un lot part au plus
  tard après `GROUPE_MAX_ATTENTE_MS`, même si les écritures se succèdent sans
  interruption —, et un ajout ne part jamais dans le même appel que la ligne
  qu'il cite : Grist ne sait pas référencer une ligne créée dans l'appel en
  cours. Le lot est coupé juste avant, ce qui garantit au passage que les
  références reçoivent bien les identifiants attribués par le document.
- **Un lot refusé est rejoué écriture par écriture.** Grist applique un lot en
  bloc et ne dit pas quelle action a échoué. Le rejeu rend chaque refus à sa
  ligne, laisse en attente les seules écritures réellement refusées, et n'insiste
  pas : une écriture refusée attend le renvoi décidé par l'utilisateur (ou
  repart avec la prochaine écriture), au lieu d'être représentée sans fin.
- **Un geste, un rendu.** Une action écrit souvent plusieurs lignes — créer la
  fiche de la personne *puis* l'affaire qui la cite, installer les seuils par
  défaut, reporter une décision sur l'affaire et le recours… Les notifications du
  magasin sont donc rassemblées : le rendu est repoussé à la fin de la tâche en
  cours (`planifierRendu`, dans `app.js`), ce qui ne diffère rien d'un cran
  perceptible. Un `render()` demandé explicitement par une action (navigation,
  ouverture d'une fenêtre) garde le dernier mot.

Le **remplacement en bloc** — restauration d'un export, remise du jeu de
l'exemple — écrit lui aussi par lots (`envoyerLignes`, 200 lignes par appel au
plus, reprise ligne par ligne en cas de refus), et le chargement lit les tables
du document **en parallèle** (`refresh`).

L'ordre d'écriture (`ordreDependances`) ne suit que les colonnes **saisies** :
une colonne calculée peut citer une autre table sans que rien n'ait à être écrit
dans cet ordre — c'est Grist qui la remplit. La suivre faisait entrer l'ordre
dans une boucle : `Affaires` porte une colonne calculée vers `Decisions`, qui
cite `Affaires`. `Decisions` partait donc avant `Affaires`, et ses références,
non traduites, désignaient n'importe quelle ligne du document.

Enfin, les vues ne balayent plus les tables ligne à ligne : `Store.index()`
(index par identifiant, `store.js`) et les index de lecture de `Context`
(`indexDe` et `children`, `formulas.js`) répondent en temps constant. Ils sont
reconstruits dès que la **version** de la table a changé (`Store.revision`) — une
ligne qui change de parent compte comme un changement, ce qu'une comparaison de
tailles ne verrait pas.

### Rôles, identité et permissions

L'outil reprend les droits du document Grist qui l'héberge. Le nom de la personne
connectée et son rôle sont affichés **en haut à droite de chaque page**.

Le nom vient de l'identifiant du compte Grist, du type `prenom.nom` : il est
remis dans la forme française **« Prénom NOM »** (`formatPersonName()` dans
`roles.js`) — prénoms capitalisés, nom de famille en capitales, comme dans la
table `Secretaires`. La fiche secrétaire créée à la première visite reçoit le
même découpage (`Prenom` / `Nom`) ; les adresses électroniques, elles, sont
laissées telles quelles.

| Rôle | Qui | Droits |
| --- | --- | --- |
| **Administrateur** | Propriétaire du document | Tout, y compris les onze sous-pages de « Réglages » et la vue « Attribution des affaires ». Voit toutes les affaires, ou seulement les siennes, au choix. |
| **Secrétaire** | Propriétaire **ou** éditeur du document | Saisie et suivi des dossiers, impression, export. Ne voit que les affaires qui lui sont attribuées. « Réglages » et « Attribution des affaires » lui sont refusés. |
| **Visiteur** | Lecteur, ou personne non connectée | Consultation et impression uniquement : champs, boutons de modification et de suppression sont désactivés, la création d'affaire disparaît de l'en-tête. Sans fiche secrétaire, il voit tout le document. |

Hors Grist (site autonome), l'utilisateur est **administrateur** de sa propre base
locale : il n'y a personne d'autre à qui confier les réglages.

Le statut de connexion au document n'apparaît **pas** dans l'en-tête. Il est
regroupé dans un bloc repliable **« Diagnostic »**, en bas de
*Réglages › Données* (donc réservé aux propriétaires) : mode d'exécution, état de
la connexion, accès accordé au widget, table technique des utilisateurs, nombre
de personnes reconnues, rôle appliqué et sa source, dernière erreur.

**Comment le rôle est-il connu ?** L'API « widget » de Grist ne transmet aucune
identité. L'outil ajoute donc au document une table technique,
`GristHidden_Utilisateurs`, **une ligne par personne** :

| Colonne | Contenu | Origine |
| --- | --- | --- |
| `Cle` | clé de session (usage interne) | saisie par l'outil |
| `Nom`, `Email`, `Identifiant`, `Acces` | nom, courriel, identifiant numérique et niveau d'accès réels | **formules déclenchées** Grist (`user.Name`, `user.Email`, `user.UserID`, `user.Access`) |
| `Premiere_visite` | date et heure de la première visite | `NOW()` |

Les valeurs `user.*` ne sont accessibles qu'à une **formule déclenchée** — c'est
pourquoi ces colonnes sont calculées par Grist à la création de la ligne, et non
saisies. Le préfixe `GristHidden_` empêche la table d'apparaître dans les menus
de Grist ; elle reste une table ordinaire, visible dans les données brutes du
document, et consultable depuis **Réglages › Données › Utilisateurs du document**
(réservé aux propriétaires).

- Le rôle vient de la colonne `Acces` (`owners` → administrateur, `editors` →
  secrétaire, sinon visiteur).
- Un propriétaire ou un éditeur est **aussi inscrit parmi les secrétaires** : sa
  fiche (`Prenom`, `Nom`, `Email`, `Actif_`) est créée à sa première visite si
  elle n'existe pas, pour qu'il puisse figurer sur les courriers. Une fiche
  créée par une version antérieure de l'outil porte encore l'identifiant Grist
  tel quel (`arno.pillods`) : elle est remise en forme au passage
  (`Arno` / `PILLODS`), et le changement est annoncé. Seules les fiches dont le
  nom est **exactement** cet identifiant sont touchées — jamais celles qui
  portent un vrai état civil.
- Si la table ne peut pas être lue ou écrite (par exemple un lecteur, qui n'a le
  droit d'écrire nulle part), l'outil se rabat sur le jeton d'accès Grist :
  Grist ramène de force le jeton d'un lecteur en lecture seule, ce qui suffit à
  distinguer « peut écrire » de « consultation seule ». Seul un **propriétaire**
  ouvre les réglages : ce droit n'est jamais supposé, il doit être prouvé.
- Un lecteur ne peut pas créer sa ligne : son **nom ne peut donc pas être
  affiché** (l'en-tête indique « Utilisateur Grist »). Pour que les visiteurs
  voient leur nom, il faut leur laisser le droit d'écrire dans la seule table
  `GristHidden_Utilisateurs` (règles d'accès Grist) — sinon, seuls
  propriétaires et éditeurs sont identifiés.
- Deux onglets ouverts par la même personne ne créent qu'une ligne : la table
  est relue au chargement et la ligne est reconnue par l'identifiant Grist.


### Périmètre des affaires et attribution

L'outil est un espace de travail partagé par les secrétaires d'une ou plusieurs
sections : chacun n'a pas à parcourir les dossiers de ses collègues. **Par
défaut, une personne ne voit que les affaires qui lui sont attribuées** — celles
dont la colonne `Affaires.Secretaire` désigne sa fiche de la table
`Secretaires`, rapprochée par **courriel**. Ce périmètre est appliqué par
`visibilite.js` à tout ce qui *montre* des affaires : liste des affaires,
registre des décisions, rôles de séance, documents, listes déroulantes
d'affaires, tableau de bord, et les listes imprimées ou exportées qui en
découlent.

| Qui | Ce qu'il voit |
| --- | --- |
| Propriétaire (administrateur) | Ses affaires par défaut ; un sélecteur **« Périmètre »** en tête de la liste des affaires (et un bouton « Voir toutes les affaires ») lui fait voir l'ensemble du document. Son choix est mémorisé dans le navigateur (`filters.voirToutAffaires`). |
| Secrétaire ou personne identifiée par une fiche | Ses affaires uniquement. La liste l'annonce en clair plutôt que de le laisser chercher une affaire absente. |
| Personne **sans fiche secrétaire** (visiteur, table vide) | Tout le document. |

Trois points à connaître avant de modifier ce comportement :

- **C'est un confort de travail, pas une protection.** Les données restent dans
  le document Grist, et seules les règles de partage de Grist en limitent
  réellement l'accès. Le filtre porte sur l'**affichage** : les formules, les
  trames et les documents continuent de voir toute la base, sans quoi les
  lettres et les totaux seraient faux.
- **Une affaire sans secrétaire n'apparaît chez aucun secrétaire.** C'est voulu :
  c'est la vue « Attribution des affaires » qui la leur confie.
- **Le repli est volontairement permissif** : sans fiche secrétaire
  reconnaissable (aucune correspondance de courriel), rien n'est restreint —
  mieux vaut montrer trop que de laisser quelqu'un devant un outil vide.

La vue **« Attribution des affaires »** (`views/attribution.js`, réservée aux
propriétaires) est le poste de commande de la répartition :

- quatre indicateurs, dont « Sans secrétaire » (cliquable : il filtre la liste
  sur les affaires à répartir) ;
- des filtres (recherche, section, état, secrétaire — avec l'entrée
  « Sans secrétaire ») ;
- une **liste déroulante de secrétaire sur chaque ligne** : le choix attribue
  aussitôt, sans autre validation ;
- une **barre de lot** qui apparaît dès qu'une case est cochée : nombre
  d'affaires sélectionnées, secrétaire cible, puis « Attribuer », « Retirer
  l'attribution » et « Désélectionner ». La case de l'en-tête coche toute la
  liste filtrée ;
- un récapitulatif **« Répartition de la charge »** : affaires et affaires en
  cours par secrétaire, ligne « Sans secrétaire », et les fiches désactivées ou
  supprimées auxquelles des affaires restent rattachées (signalées comme
  telles, pour qu'elles ne se perdent pas de vue). Cliquer un nom filtre la
  liste sur ses affaires.

Les écritures d'un lot sont groupées (`updateRowQuiet` par ligne, un seul
rendu) : un lot de plusieurs dizaines d'affaires ne provoque pas un rendu par
affaire. Enfin, une affaire **créée par un secrétaire lui est attribuée
d'office** : le champ « Secrétaire » ne lui est pas proposé à la saisie, et la
fiche d'une affaire le montre en lecture seule (`locked` dans `ui.field()`).

En mode autonome, l'onglet **Debug** permet d'éprouver tout cela sans compte
Grist : le champ « Identité simulée » fait endosser la fiche d'un secrétaire
(`state.debugEmail`), ce que `mesFiches()` prend en compte à la place du
courriel du compte.



L'API du widget Grist ne dialogue qu'avec son **parent immédiat** : le cadre de
l'outil doit être posé **directement** dans le document Grist. L'adresse collée
dans « Enter Custom URL » doit donc être celle du site lui-même — jamais celle
d'une page qui contient l'outil (l'adresse `perchance.org/nom-du-generateur`,
par exemple, encadre le générateur : l'API ne peut alors joindre personne, et
le bandeau le signale).

La détection repose aussi sur le fait que la page est affichée dans un cadre et
que l'appelant est un serveur Grist. Si le `Referer` est masqué, ajoutez
`?grist=1` à l'URL du widget pour forcer la détection :

```
https://<compte>.github.io/<depot>/?grist=1
```

Attention : `?grist=1` **force la détection**, mais n'autorise aucune origine —
si le widget est sur une instance auto-hébergée, celle-ci doit **en plus** être
déclarée (voir « Déclarer un serveur Grist auto-hébergé » ci-dessus), sans quoi
l'API n'est pas chargée depuis le bon serveur et l'écran reste sur son attente.

## 3. Structure du projet

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page unique : DSFR + `styles.css` + `app.js`. **Point d'entrée GitHub Pages.** |
| `styles.css` | Compléments au DSFR (panneaux, listes de définitions, graphiques, éditeur, mode widget) et **charte neutre** (police Public Sans à la place de Marianne, et gamme de bleus décalée d'un cran — voir « Charte graphique et polices »). Les `@font-face` de cette police sont posés à l'exécution par `appliquerCharte` (`charte.js`). Éteint aussi le **marqueur des listes ordonnées** que le DSFR écrit dans `::marker` — son `content` l'emportant sur `list-style: none`, il parasitait les listes que l'outil habille lui-même (prise en main, fil d'avancement, étapes du formulaire de création) et s'y lisait deux fois. |
| `schema.js` | Description des **tables du modèle v2** (voir § 4) : colonnes, libellés, types, choix, colonnes calculées (`formula: true`), libellé d'affichage, rattachement des tables filles. **Source de vérité du modèle** ; en cas de divergence, c'est lui qui a raison. Porte aussi `BALISE_CORPS` (`{{Corps}}`), **`migrerFeuilles`**, **`migrerTitres`**, **`migrerInstruction`**, **`migrerOuverture`** et **`migrerOrdonnances`** (les visas des ordonnances entrés dans la feuille de leur format, et la composition de la formation rangée avec les ordonnances) et **`migrerVoieDeRecours`** (la voie de recours des notifications livrées, désormais énoncée par la colonne calculée de la section), les reprises d'une base antérieure. |
| `legacy.js` | L'architecture du **document Grist d'origine**, décrite comme donnée (tables, colonnes, colonnes abandonnées, rôles de commission) : c'est la table de correspondance que lit l'outil d'import. |
| `import.js` | L'**outil d'import** : analyse d'une source (`analyserSource`), conversion vers le modèle v2 (`convertir`), application sur la base (`appliquerImport`, modes *Compléter* / *Remplacer*, rapprochement par clé naturelle). |
| `import-fichiers.js` | **Lecture des fichiers d'import** (`.grist`, `.xlsx`/`.xls`/`.ods`, `.csv`/`.tsv`, `.json`) : reconnaissance de la table que porte une feuille (`detecterTable`), rapprochement des en-têtes avec les colonnes du modèle, conversion des valeurs, résolution des références écrites en toutes lettres (`construireSource`). SheetJS et `sql.js` sont téléchargés **à la demande**, seulement lorsqu'un tel fichier est choisi. Voir « Formats de fichier acceptés ». |
| `procedure.js` | **Source de vérité juridique** : les cinq procédures (public × tutelle, et la section disciplinaire académique) — organes, compositions attendues, instruction, autorités, délais, prescription, effacement, voies de traitement, **voie de recours** (`juridictionRecours` : le tribunal administratif du ressort du siège de l'établissement pour les usagers ; le CNESER, ou le CNESERAAV pour les enseignants-chercheurs d'un établissement agricole), textes — chacun nommé par ce qu'il fonde (`objetDuTexte`) —, et les explications (`noticeProcedure`, `noticesProcedures`). |
| `regimes.js` | Ce qui se déduit de `procedure.js` à l'usage : régime d'une section, **catalogues livrés par défaut** (22 sanctions, 19 motifs) et filtrage des sanctions et motifs applicables par régime et par tutelle, plan d'**alignement** d'un catalogue existant sur ces textes, paramètres par défaut et **contrôles de régularité** d'une affaire — tous indicatifs : les visas des actes rendus, la lettre de notification (qui ne porte que sur une décision de la formation de jugement) et l'absence de recours contre un acte préparatoire compris. |
| `roles.js` | Rôles (administrateur, secrétaire, visiteur), capacités associées (« écrire », « régler »), déduction du rôle depuis le niveau d'accès Grist et mise en forme du nom affiché (« prénom.nom » → « Prénom NOM »). |
| `visibilite.js` | Périmètre des affaires : quelles affaires une personne voit (les siennes par défaut), et le réglage « toutes les affaires » ouvert aux propriétaires. Voir « Périmètre des affaires et attribution » au chapitre 2. |
| `seed.js` | Jeu de données d'exemple (fictif) : cinq sections, pour les deux régimes, les deux tutelles et la section disciplinaire académique. |
| `formulas.js` | Moteur de formules : reproduit en JavaScript toutes les colonnes calculées du modèle (identité déléguée à `Personnes`, formation, prescription et délais, **échéance d'instruction** — `delaiInstruction` et `butoirInstruction` —, terme des sanctions, libellés de séance…). `Context.v` lit une colonne (calculée si formule) et `Context.vOuBrut` préfère la valeur **calculée** en retombant sur le champ brut de l'enregistrement — la règle qui empêche de lire une colonne calculée sur une ligne brute, où elle est vide par construction (SPEC § 8, invariant 39). Porte aussi `jourDuMoisFr` — le quantième français, « 1er » le premier du mois puis « 2 », « 3 »… —, dont `formatDateFr` et le moteur de rendu des documents se servent pour écrire les dates sans zéro (voir `SPEC.md` § 8, invariant 38). |
| `store.js` | État, persistance (`localStorage`), export/import, suppression en cascade. **Réconcilie `Parametres` avec le catalogue de l'outil** au chargement (`ensureParametres`) : un seuil nouveau est ajouté sans écraser les valeurs réglées, un seuil **retiré de l'outil** est écarté du document — sans quoi il resterait affiché et réglable alors que plus rien ne le lit. |
| `grist-backend.js` | Intégration Grist : chargement de l'API, **nom de stockage des tables** (`GristHidden_…`) et masquage des tables d'un document antérieur, lecture des tables, miroir des écritures, installation de la structure, identité et rôle de l'utilisateur, diagnostic de la liaison (délais d'attente, erreurs d'écriture). |
| `render.js` | Moteur de rendu des documents (`{{Colonne}}`, `{variable}`, `.date()`, `.img()`, tableaux…) : les dates s'y écrivent en français (`ALIASES`, `MOIS_COURT` — `@long` rend le quantième sans zéro, `Do`, « 5 mars 2026 », `@full` y ajoute le jour de la semaine ; `@short` et `@iso` gardent, eux, leurs zéros — voir `SPEC.md` § 8, invariant 38), **feuille A4** (`DOCUMENT_CSS` : feuille 210 × 297 mm, `@page size A4`, et les **tailles de titre**, écrites dans l'échelle des outils de mise en forme), habillage de l'aperçu (`PREVIEW_CSS`) et script d'ajustement des feuilles au cadre (`FIT_SCRIPT`, qui appelle d'abord la pagination). **Assemble le document** — `computeDocumentParts` : l'en-tête du service (`enteteHtml`, dont la zone et la taille des deux logos se règlent par feuille de style — voir `SPEC.md` § 8, invariant 26), la **feuille de style** du document, de sa trame ou de son format (`feuilleEffectiveDocument` → `feuilleEffective`, découpée autour de `{{Corps}}` par `decouperFeuille`, exportée pour que l'éditeur montre le **même** découpage — le texte **jamais dans le pied de page** : un emplacement déposé dans un `.print-footer` est ramené avant lui, `debutPiedDePage`), puis le texte du document (`renderDocumentBody` : repères de pagination, variables de la feuille, balises de données — aucune balise ne reste brute, et le texte figé de `freezeDocumentBody` passe par le même rendu). Les variables du périmètre (`documentScope`) comprennent celles des **visas d'un acte rendu** : `{f_ouverture}`, `{date_de_saisine}` et `{visa_code_rural}` (vide hors tutelle agricole). |
| `pages.js` | **Pagination des documents** : le script embarqué dans le document rendu (`PAGE_SCRIPT`) découpe le flux en feuilles A4, répète le pied de page au bas de chacune et y porte « Page 3 sur 3 ». Porte aussi les repères (`page-number`, `page-total`) et `piedNumerote`, qui traduit `{page}` / `{pages}` du pied de page d'un format et y ajoute la ligne demandée par son format — la numérotation à droite (`numeroter`), le **numéro de l'affaire** à gauche (`numero`, « Dossier n° … »), sur la même ligne. Voir « Aperçu et impression : toujours du A4 ». |
| `editor.js` | Éditeur WYSIWYG partagé par les trames, les formats **et les documents** (texte et hors-corps) : pastilles de variables, barre de mise en forme (titres, listes, **retraits** — du paragraphe et de la **première ligne** —, exposants, tableaux, images, traits, **sauts de page**), **menus de typographie** (police, taille, couleur, surlignage — `TYPOGRAPHIE` / `applyTextStyle`), **touche Tabulation** qui pose un retrait (`retraitTabulation` : première ligne en début de paragraphe, bloc entier ailleurs, niveau d'un point de liste dans une liste), palette glisser-déposer — avec le **repère du point de dépôt** (`.app-drop-caret` : une barre posée au point où la balise tombera, fixée au document et non à la zone, qui est enregistrée telle quelle) et un **fantôme de geste réduit à la balise** (`reduireFantome`, `setDragImage`), qui ne recouvre plus ce repère —, **écriture HTML** et normalisation du HTML — dont `htmlCanonique`, qui sert à reconnaître un texte qui n'a pas bougé. Une **famille de balises par zone** (`data-chips` — `columns`, `variables` ou `feuille`) : la feuille de style et le corps d'une même trame — ou, dans un document, la feuille entière — cohabitent sous une seule palette, et le dépôt d'une balise est jugé sur cette famille (`accepte`) — une balise **entière**, modificateurs compris (`{{Affaire}}.Numero`, `{{Date}}.date(@long)`), et non son seul préfixe. Porte aussi l'insertion **en bloc** (`insertBlocks`, `insertHtmlAtPoint`) : un fragment inséré — considérant, visa, intertitre — prend place après le paragraphe du curseur, au lieu d'y être fondu ; la dernière position du curseur est **retenue** (`plageMemorisee`), de sorte qu'un bouton de l'outil — qui prend le focus — insère là où le rédacteur écrivait, et non à la fin du texte. Voir « Rédaction libre d'un document » et « Rédaction d'une décision ». |
| `trame-variables.js` | Catalogues qui alimentent la palette et les pastilles : balises `{{Colonne}}` d'une trame (`trameCatalog` — les colonnes **obsolètes**, marquées `ancien: true` dans `schema.js`, en sont écartées), variables `{variable}` des formats (`variablesCatalog`, dont les groupes « Auteur et destinataire » et « Acte rendu (visas) ») et `feuilleCatalog`, qui ajoute l'emplacement `{{Corps}}` sous le libellé « Texte de la trame » (`LIBELLE_CORPS`). |
| `trames-defaut.js` | Les **trames et feuilles de style livrées par défaut** (44 trames, 6 formats), nettoyées et adaptées à chaque procédure : régime, tutelle et type de section. Chaque trame y porte son **auteur** et son **destinataire** ; son `Template_contenu` n'est que le **corps** du document — les feuilles de style des deux ordonnances portent, elles, la **formule d'ouverture** et les **visas** (`{f_ouverture}`, le code de l'éducation, `{visa_code_rural}`, la saisine). Porte aussi `FEUILLE_VIERGE`, la feuille d'un format neuf, et `TITRES_LIVRES`, les formes **anciennes** des titres (un `<h3>`, une classe d'alignement) que `migrerTitres` reprend dans l'échelle des outils de mise en forme. Proposées à la première installation — voir « Trames livrées par défaut ». |
| `redaction.js` | **Qui rédige et à qui s'adresse un document** : l'auteur et le destinataire sont **programmés sur la trame** (`Trames.Auteur`, `Trames.Destinataire`) et résolus ici sur l'affaire, la section et le document. Source unique de la règle — voir « Auteur et destinataire d'un document ». |
| `calendrier.js` | Les **échéances en clair** (séances, convocations, prescriptions, **terme de l'instruction**, termes de sanction, délais de recours) et l'export **iCalendar `.ics`** du périmètre de la personne. Voir « Calendrier et export `.ics` ». |
| `graphiques.js` | **Graphiques des rapports d'activité** : camemberts, anneaux, barres et colonnes dessinés sur un canevas et rendus en **images** (un seul dessin pour l'écran, l'impression et l'export PNG). Palette fixe, regroupement des petites séries sous « Autres », habillage d'impression (fond blanc) ou d'écran (thème clair/sombre). Voir « Rapport d'activité et graphiques ». |
| `rapport.js` | **Indicateurs du rapport d'activité**, calculés pour une période : chiffres clés, séries des graphiques et tableaux d'indicateurs — sur les affaires et décisions que la personne voit. Voir « Rapport d'activité et graphiques ». |
| `membres-csv.js` | Composition d'une section par **fichier CSV** : modèle vierge (une ligne par siège attendu, collège et rôle pré-remplis), export de la composition existante, lecture et import. Voir « Composition d'une section par CSV ». |
| `signataire.js` | **Le signataire du président de la section** : le président, ou le vice-président qui le remplace — deux réglages qui se cumulent (la section, `Sections_disciplinaires.VP`, et le document, `Generateur.VP`, pour une absence brève), avec le nom, la formule et la formule complète recalculés depuis les membres. N'intervient plus que pour l'auteur « président de la section disciplinaire » — voir « Auteur et destinataire d'un document ». |
| `anonymat.js` | **L'export anonyme d'une décision définitive** : la décision que rédige un document (`decisionAnonymisable` — format « Décision », décision non interlocutoire), les personnes dont le nom s'efface (`personnesAnonymisables` : le mis en cause de l'affaire et des affaires jointes, et les personnes impliquées — victimes, témoins, défenseurs, représentants ; **ni la formation, ni le secrétaire**), les écritures cherchées pour chaque nom (`variantesDe`) et le remplacement lui-même (`anonymiserHtml`, sur le **document rendu** : « A. B. », « B. C. »… **dans l'ordre du document**, casse et espaces indifférents, limites de mot respectées). Voir « Exports ». |
| `views/` | Les pages de l'application, une par tâche : `index.js` (aiguillage), `common.js` (helpers partagés, dont `outils()`, la colonne d'outils repliable des espaces de rédaction, et `echeanceInstruction()`, le **bandeau d'échéance d'instruction**), `dashboard.js`, `affaires.js`, `attribution.js`, `seances.js`, `calendrier.js` (grille du mois et export), `decisions.js` (**le registre des décisions**), `decision-redaction.js` (**l'atelier de rédaction d'un acte rendu** — l'atelier d'une décision, et les outils que partage l'espace d'une ordonnance : le répertoire des considérants `outilConsiderants`, la numérotation des considérants et **des articles** `numeroterArticles` — voir « Rédaction d'une décision »), `documents.js` (**les dossiers de documents** — une affaire, un dossier, dont le filtre de trames ne propose que celles des sections en périmètre — et la **sous-vue d'un document** : paramètres, **document assemblé d'une seule feuille** (`assemblageDocument` : en-tête, chapeau, texte, signature — voir « Une seule feuille ») et aperçu A4 ; un document d'**acte rendu** — décision ou ordonnance — y reçoit le répertoire des considérants et les gestes de numérotation), `reglages.js` (dont le répertoire des personnes, les catalogues, et les **registres de trames et de formats** avec la sous-vue de rédaction d'une trame ou d'un format), `import.js` (Réglages › Import des données), `rapport.js` (**la page du rapport d'activité** : période, chiffres clés, grille de graphiques, tableaux d'indicateurs, rapport imprimé), `aide.js`, `debug.js`. |
| `considerants.js` | **Répertoire des considérants de principe** d'une décision : les vocabulaires qui les rangent (rubriques du plan, natures, domaines, tags), les considérants **livrés** — tirés de décisions réelles —, la lecture du répertoire de l'établissement (table `Considerants`, dont les lignes `Origine` priment sur les livrées), la recherche (`chercher`, sans accent ni casse) et le **fragment insérable** d'un considérant (`fragmentDe`, marque `considere`). Réunit aussi les **références citées** (`referencesDuRepertoire`) pour que le service juridique puisse les viser : sources non retrouvables, affirmations à vérifier (`aVerifier`) et date de la dernière vérification — voir « Registre des actes ». |
| `formules-decision.js` | **Les pièces qui encadrent le raisonnement** — visas, audience, dispositif (DÉCIDE, articles) — sous forme de formules insérables, filtrées par domaine (code rural / code de l'éducation), par nature de décision et par **juridiction de recours** (l'article de recours proposé est celui du tribunal administratif pour un usager, du CNESER, ou du CNESERAAV pour les enseignants-chercheurs d'un établissement agricole) ; porte aussi le **squelette** d'une décision (`echafaudageDecision`, sans signature — elle vient de la feuille de style —, et sans article de recours pour un acte préparatoire), la trame applicable (`tramePourDecision`, qui ne retient que les trames de **Décision**, non celles d'**Ordonnance**) et le document qui rédige une décision (`documentDeDecision`). C'est là qu'est écrit le **motif de l'intitulé d'un article** (`MOTIF_INTITULE_ARTICLE`, `estIntituleArticle`, `intituleArticle`) : le premier article est « 1er », les suivants « 2 », « 3 »…, et la reconnaissance exige le **deux-points** — une citation du code qui commence par « Article R.811-13 … » reste un considérant. Voir « Rédaction d'une décision ». |
| `print.js` | Impressions « maison » : rôle d'une séance, liste d'affaires, et **rapport d'activité** (chiffres clés, graphiques en images, tableaux — mis en page pour l'impression et l'export). |
| `export-doc.js` | Export des documents produits : **PDF** (les blocs du document — paragraphes, listes, tableaux, images — sont **composés en texte** par `pdfmake`, dans une police embarquée, puis convertis au format d'archivage **PDF/A-2b** par `pdf-a.js`), **Word `.docx`** (bibliothèque `docx`) et **OpenDocument `.odt`** (XML écrit à la main dans une archive ZIP). Les trois formats partent du **même modèle de blocs**, tiré du même HTML que l'aperçu (`prepareDocument`), et la pagination du PDF est celle de l'aperçu — mêmes coupures, même nombre de pages. Les **retraits** des paragraphes y passent tels quels, en centimètres (`indentFirst` pour la première ligne, `indentLeft` pour le bloc — voir « Rédaction libre d'un document »), et une sous-liste écrite **après** son point (`<ul><li>a</li><ul>…`) y est relue comme une sous-liste, quelle que soit la forme qu'a produite le navigateur. Porte aussi le remplacement de `{page}` / `{pages}` par de vrais champs de numérotation (`PAGE`/`NUMPAGES`, `text:page-number`). Voir « Exports ». |
| `pdf-fonts.js` | Les **polices embarquées du PDF** : les deux familles qu'un fichier peut joindre (Public Sans, et Marianne lue dans les fichiers WOFF du DSFR et convertie, `woffVersTtf`), déposées dans le système de fichiers de `pdfmake`. Relève au passage le **ratio d'interligne** du fichier (en-têtes `head` / `hhea`) pour que le PDF garde l'interligne de la feuille. Voir « Exports ». |
| `pdf-a.js` | La conversion du PDF composé au **format d'archivage PDF/A-2b** (`versPdfA`) : profil de couleur sRGB embarqué, `/OutputIntents`, métadonnées XMP (`pdfaid:part` 2, `conformance` B), `/Lang` et identifiant de fichier. Voir « Exports ». |
| `export.js` | Export du **site** : assemble l'archive ZIP du site autonome (fichiers découverts à partir de `index.html`), avec `seed.js` régénéré vide, plus un dossier `perchance/` d'enveloppe. Fournit aussi `zipStore` (écriture ZIP sans compression) et `downloadBlob`. |
| `export-table.js` | Export **tabulaire** des données : les listes et les registres en **CSV** (point-virgule, BOM) et en **classeur Excel `.xlsx`** (une feuille par table, filtre automatique, colonnes dimensionnées — SheetJS chargé à la demande, la même version que celle de l'import). Les colonnes exportées sont celles du registre, et non les colonnes brutes : une référence donne le libellé de ce qu'elle désigne (voir `COLONNES_EXPORT`). Voir « Export des listes et des données (CSV, Excel) ». |
| `ui.js` | Primitives DSFR (panneaux, tableaux, badges, champs, alertes, notifications) — dont `dl(entries, { variante: "lignes" })`, la liste de définitions en lignes des fiches de procédure — et `brandBlock` (bloc-marque + emplacement du logo de l'opérateur, partagé par l'en-tête réel et l'aperçu des Réglages ; le bloc-marque est omis avec la charte neutre). Le couple **`tabs` / `tabPanel`** porte les onglets : le premier écrit le `role="tablist"`, le second le panneau que l'onglet actif annonce par `aria-controls` — un seul panneau est monté, et seul l'onglet actif porte la référence, les autres n'ayant pas de panneau dans la page (voir « Les onglets »). Les **descriptions** du schéma, écrites en markdown (`**gras**`, `` `code` ``), y sont mises en forme par `mdInline` — elles s'affichaient auparavant avec leurs astérisques, sous les libellés des formulaires —, et se lisent désormais **sous le contrôle** du champ (voir « Les champs d'une ligne »). `icon(name, extra)` **fusionne** la classe qu'on lui passe avec celle du jeu d'icônes : émise en second attribut `class`, le navigateur l'ignorait — l'icône se collait à son libellé dans tous les boutons, et le repère d'une ligne de liste perdait son gris (voir invariant 31). |
| `charte.js` | **Charte graphique et polices** : les deux chartes (État / neutre), la pile de polices des documents, le nom de police des exports Word et OpenDocument, la règle CSS qui remplace Marianne, et l'application de la charte à la coquille. **Source de vérité** de ces réglages, lue par `app.js`, `ui.js`, `render.js`, `print.js` et `export-doc.js`. |
| `affichage.js` | Commandes d'affichage de l'en-tête : passage en plein écran et thème clair/sombre (mécanisme du DSFR) — ce dernier s'efface dans un document Grist, qui fournit le thème du document. |
| `diagnostic.js` | Journal de diagnostic : compte rendu copiable de la liaison Grist (tables et colonnes du document, formules, utilisateurs, journal des écritures refusées). Voir « En cas de problème ». |
| `app.js` | Coquille (en-tête avec nom et rôle, barre de navigation, pied de page, fenêtres modales), routage par ancre, gestion des événements par délégation, application du rôle (lecture seule, accès aux réglages), **écran d'attente** tant que le document Grist n'a pas répondu, branchement et identification (bornés dans le temps). |
| `alignement.js` | **Alignement vertical des champs d'une même ligne** (EX-060, `SPEC.md` § 8, invariant 27) : après chaque rendu, relève la hauteur du libellé le plus haut de chaque **ligne visuelle** (une grille qui se replie se mesure bande par bande) et la publie en variable CSS `--champ-label-h` sur les cellules — les libellés la reprennent en `min-height`, les cases à cocher et un bouton posé à côté d'un champ en descendent d'autant (`styles.css`). La mesure est refaite quand la largeur change et quand un bloc repliable s'ouvre. Voir « Les champs d'une ligne ». |
| `menus.js` | **Menus déroulants dans la fenêtre** (EX-068, `SPEC.md` § 8, invariant 32) : le panneau d'un menu s'ancre au bord droit de son bouton ; quand ce bord tombe trop près du bord gauche de la fenêtre — la ligne d'actions d'une tête de page se replie sur un écran étroit et repart de la gauche —, le panneau, large de 16,5 rem, s'ouvrait hors de la fenêtre. `suivreMenus` (appelé une fois au démarrage) mesure le panneau au **clic** sur le résumé — qui précède l'ouverture, et où le panneau porte déjà ses cotes, donc sans clignotement — et le ramène d'un `translateX` ; le `toggle` (ouverture au clavier ou par le code) et un redimensionnement de la fenêtre repassent la mesure. Voir « Les menus déroulants ». |
| `entete-defilant.js` | **En-tête défilé et barres collées** (EX-070, `SPEC.md` § 8, invariant 34) : la barre de navigation est collée en haut de la fenêtre, l'en-tête ne l'est pas — les commandes du compte (« Nouvelle affaire », le bloc de compte) **paraissent donc sur la barre** dès que l'en-tête a disparu, sur le **rang des onglets** et à leur droite, et s'effacent avec lui. L'animation est **menée par le script** (`requestAnimationFrame`) et non par une transition CSS : celles-ci ne s'avancent pas dans tous les cadres où l'outil s'affiche (l'aperçu de l'éditeur se déclare masqué), et une transition figée à son départ laisserait les commandes invisibles. Son **sens suit la mise en page** : la largeur du bloc quand il partage le rang des onglets (au-delà de 48em), sa hauteur quand il reprend sa propre ligne sous le menu replié. Le module publie aussi la hauteur de la barre en `--app-navbar-h`, dont s'adossent le sommaire d'ancres et les colonnes d'outils — le sommaire se collait **par-dessus** la barre, qui disparaissait sous lui. La bascule vaut aussi **dans un widget Grist** : la veille ne regarde que la position **calculée** de la barre, et le cadre d'un widget défile pour lui-même. Voir « La barre de navigation ». |
| `select-recherche.js` | **Recherche dans les listes déroulantes** (EX-061, `SPEC.md` § 8, invariant 28) : au-delà de douze valeurs (`SEUIL_RECHERCHE`), un menu déroulant reçoit un champ de recherche (`monterSelectsRecherche`, appelé à chaque rendu) — comparaison sans accent ni casse, réponses classées du plus proche au plus lointain, choix aux flèches, à `Entrée` ou à la souris, nombre de réponses annoncé. Le `<select>` d'origine est **masqué mais conservé** : il reste la valeur, et c'est lui qui reçoit le `change` — `data-bind`, `data-filter` et `data-action` ne connaissent pas ce module. La liste des propositions est déposée dans le `<body>` en position fixe (les menus des fenêtres modales ne sont pas rognés), reste dans la fenêtre, se parcourt au défilement — molette, doigt, barre — sans que son replacement la renvoie à sa première ligne, et **redit les groupes du menu natif** (`<optgroup>` : les collèges des intervenants) par un intertitre, chaque proposition annonçant le sien aux lecteurs d'écran. Voir « La recherche dans les listes déroulantes ». |
| `markdown.js` | Conversion Markdown → HTML (documentation historique du document Grist). |
| `dictionary.js` | Dictionnaire des variables utilisables dans les trames. |
| `assets/` | Images livrées avec l'outil (**bloc-marque de l'État**) : sa source vectorielle SVG, le PNG de référence, et sa version embarquée dans le code (`bloc-marque.js`). Voir « Images » plus bas. Plus vos propres logos, si vous en déposez. |
| `sanitize.js` | **Assainissement du balisage** (NC-0006) : `assainirHtmlSecurite` retire les balises actives et les gestionnaires en ligne des colonnes rendues **comme du HTML** (texte d'une trame, d'un document, feuille de style), à l'enregistrement, à l'import et au chargement. Distinct de `sanitizeHtml` (`editor.js`), qui réduit un **collage** à la palette du rédacteur. |
| `environnement.js` | **Environnement déclaré** (NC-0008) : `production` par défaut, `recette` sur déclaration (`window.ENVIRONNEMENT`), bandeau de recette, et c'est lui qui décide de l'ouverture de l'onglet Debug et du jeu d'exemple. |
| `dossier.js` | **Le dossier de pièces d'une affaire** : les pièces sont tenues **hors de l'outil**, qui n'en garde que l'adresse (`Affaires.Lien_vers_le_dossier`). Validation et complétion de l'adresse (`urlDossier` — un domaine sans schéma reçoit `https://`, une valeur qui n'est pas une adresse web est refusée), contrôle d'accès (`boutonDossier` : ouvrir, ou déclarer) et rappel du dossier (`rappelDossier`), posés dans le bandeau de l'affaire, la fiche, le rôle de la séance et le tableau de bord. Voir `SPEC.md` § 8, invariant 25. |
| `version.js` | **Numéro de version** de la livraison (NC-0002), et **empreinte des contenus livrés** (NC-0005), affichés dans Réglages › Données. Journal des livraisons dans `CHANGELOG.md`. |
| `contenus.js` | **Contenus livrés** (NC-0005, NC-0015) : inventaire (**comptages produits par le code**), **signature** qui change à chaque évolution des trames, formats, catalogues ou seuils, et **plan d'alignement** d'une base sur la livraison — sans jamais toucher au texte des trames ni aux lignes propres de l'établissement. |
| `actes.js` | **Numérotation et registre des actes** (NC-0020) : la séquence par section et par année (`numeroActe`, `prochainNumeroActe` — le rang attribué est le plus grand utilisé, plus un, **jamais** le premier trou : une suppression ne rejoue pas un numéro), l'attribution chronologique (`numeroerActes`) et le registre exportable (`registreActes`, `COLONNES_ACTES`). Voir « Registre des actes ». |
| `verifier.mjs` | **Vérification de la livraison** (NC-0025) : analyse syntaxique de **tous** les modules (esbuild-wasm, déjà employé par `livraison/build.mjs`) et, sur demande, le harnais de non-régression — en un seul appel (`verifier`, `formaterRapport`). Se lance depuis l'onglet **Debug** (« Vérifier la livraison ») ou en ligne de commande. Le résultat se consigne dans `CHANGELOG.md`. |
| `dependances.js` | **Source unique des dépendances tierces** (NC-0003) : version du DSFR, adresses des bibliothèques chargées à la demande, **empreintes d'intégrité** (SRI) et chargement avec message d'erreur explicite. Voir `SECURITE.md`. |
| `tests/` | **Harnais de tests** (NC-0001) : `harness.js` (sans dépendance), `invariants.test.js` (un cas par invariant de `SPEC.md` § 8), `ecrans.test.js` (test de fumée par écran), `index.html`. Voir le README du dossier. |
| `livraison/` | **Variante minifiée et regroupée** (NC-0004) : `build.mjs` (esbuild-wasm, sans installation), `index.min.html`, et le README qui documente la construction et ses limites. Le dépôt source reste la référence. |
| `CHANGELOG.md` | **Journal des livraisons** (NC-0002) : une entrée par livraison, et la convention de version. |
| `SECURITE.md` | **Sécurité et chaîne d'approvisionnement** (NC-0003) : inventaire des briques tierces, politique de sécurité du contenu, hébergement des polices, mode dégradé. |
| `EXIGENCES.md` | **Référentiel d'exigences et matrice de couverture** (NC-0016), et le procès-verbal de recette à compléter par le commanditaire. |
| `audit/` | L'audit de l'outil : le **prompt d'audit** (`PROMPT-AUDIT.md`), le **registre des non-conformités** (`registre.json`, identifiants stables, repris à chaque campagne) et les **rapports** (`rapports/audit-AAAA-MM-JJ.md`). Hors de l'archive de déploiement. Voir « Audit » au chapitre 7. |

### Organisation de l'interface

L'interface est organisée **par tâche** — et non table par table. Huit entrées de
menu (plus le Debug, propre au mode autonome) ; trois se déclinent en sous-pages
(Tableau de bord, Calendrier, Réglages), et deux d'entre elles — **Attribution des
affaires** et **Réglages** — ne s'affichent que pour les propriétaires du
document. La barre de navigation porte le **libellé court** déclaré par `NAV`
quand il en existe un — « Tableau », « Attribution » —, pour tenir sur une ligne
aux largeurs courantes ; le libellé long reste celui du titre des pages, de
l'aide et de cette documentation.

| Entrée | Contenu |
| --- | --- |
| Tableau de bord | Deux sous-pages. **Synthèse** : indicateurs, actions rapides, affaires à traiter, prochaines séances, répartition par état. **Rapport d'activité** : chiffres clés, graphiques (camemberts, anneaux, barres, colonnes) et tableaux d'indicateurs, sur une période — exportables en PNG, CSV, Excel, PDF, Word ou OpenDocument. Voir « Rapport d'activité et graphiques ». |
| Affaires | Une affaire traitée de bout en bout, en 6 onglets : Synthèse (fiche de l'affaire, valeurs déduites, contrôles de régularité et **contacts**), Commission — « Instruction » pour les enseignants-chercheurs, « Section » devant la section disciplinaire académique —, Personnes, Séance d'examen, Documents, Décision (et recours). L'onglet **Documents** précède l'onglet **Décision** : la décision intervient au terme de l'affaire, quand ses pièces sont écrites — même ordre que dans le menu principal. |
| Attribution des affaires | **Propriétaires seulement.** Répartition des affaires entre les secrétaires : filtres, **une seule liste** où la colonne « Secrétaire » attribue au choix, et une ligne de pastilles de charge qui filtre d'un clic. L'attribution par lots n'apparaît qu'une fois des affaires cochées. |
| Calendrier | La page du temps, en deux sous-vues. **Échéances** : toutes les échéances du périmètre dans une grille du mois — séances et heures de passage, saisine, envoi des convocations, terme de l'instruction, prescription, terme de la sanction, expiration du délai de recours. Cliquer un jour ouvre son détail dans un panneau à côté de la grille — la grille tronque, le détail dit tout — ; un panneau « À venir » rappelle les huit prochaines échéances, et « **Ce mois-ci** » porte le ton d'une pastille et son compte — le même que la grille (`.app-reperes`) ; le bouton **Exporter** (menu des sorties, comme partout) rassemble l'agenda `.ics` et la liste CSV/Excel des échéances (voir « Calendrier et export `.ics` » et « Export des listes et des données »). **Séances et rôles** : la préparation des séances (examen, réunion d'instruction, audition, entretien R.811-40) — liste par section, organisation, rôle (affaires inscrites avec heure de passage, chaque ligne portant l'ouverture du dossier de pièces et le retrait du rôle) et impression du rôle, sous le même menu **Exporter**. La tuile « Échéances à venir » du tableau de bord mène à la première, la tuile « Séances à venir » à la seconde. |
| Documents | Les dossiers de documents : **une affaire, un dossier**. Seuls les dossiers **qui contiennent** des documents s'affichent ; au-delà de six, ils passent en accordéon, et les affaires sans document se résument en une ligne dépliable. Chaque dossier porte ses courriers et décisions ; chaque carte ouvre **la sous-vue du document** (espace de rédaction, aperçu A4, impression, export), et sa corbeille — au coin de la carte, effacée tant qu'on ne la cherche pas — le supprime après confirmation. Les filtres (recherche, trame, type de document) resserrent les dossiers et leur contenu. Voir « Rédaction libre d'un document ». |
| Décisions | Le **registre** filtrable (INE ou corps, nom, décision, en cours d'effet) : nature, sanction du catalogue, terme, recours. Les décisions avant dire droit y figurent, sans terme ni délai — elles ne prononcent aucune sanction. La colonne, le filtre et le graphique d'**origine** — la composante de l'affaire, ou sa section disciplinaire quand elle n'en porte pas —, ainsi que la colonne « Délai », n'apparaissent que s'ils ont du sens. Chaque ligne ouvre **la sous-vue de la décision** (`#decisions/<id>`), qui **est** l'**atelier de rédaction** : visas et formules, répertoire des considérants à glisser, dispositif, numérotation des considérants et des articles, aperçu A4 et exports. Voir « Rédaction d'une décision ». |
| Réglages | Trois groupes de sous-pages. **Section** : Sections et membres, Personnes, Secrétaires, Destinataires. **Bibliothèque** : Catalogues et délais, Trames, Formats (feuilles de style). **Outil** : Identité, Charte graphique, Données, Import des données. Les deux sous-pages **Trames** et **Formats** sont des registres dont chaque ligne ouvre un espace de rédaction à son adresse (`#reglages/trames/7`) — voir « Registres de Réglages : trames et formats ». |
| Aide | Guide de l'interface (une section par page, **recherchable**), prise en main, les procédures disciplinaires détaillées pour chaque type de section, la reprise d'un tableur, dictionnaire des variables. Un sommaire collant donne accès direct aux quatre parties. |
| Debug | **Mode autonome uniquement** : simuler un rôle, un nom et l'identité d'une fiche secrétaire (pour éprouver le périmètre des affaires), inspecter l'état interne, les tables et le stockage local, recharger ou vider la base, et télécharger l'archive du générateur (données retirées). Jamais affiché lorsque l'outil est relié à un document Grist. |

*L'ordre du menu suit le déroulé d'un dossier : les documents viennent avant les
décisions. Il est défini par la constante `NAV` de `schema.js`.*

#### Quatre principes de mise en page

Ils valent sur toutes les pages, et viennent de l'audit d'interface
(`UI-AUDIT.md`, dont les propositions sont implémentées) :

1. **Une action, un endroit.** Les sorties de fichier d'une page — impression,
   PDF, Word, OpenDocument, CSV, Excel — sont repliées sous **un seul bouton
   « Exporter »** (`ui.exportMenu`, un `<details>` qui se déplie sans
   JavaScript). Seul le geste courant (« Nouvelle affaire », « Créer une
   séance ») reste à découvert, à droite de l'en-tête.
2. **Une vue de détail se lit d'abord.** Dans la fiche d'une affaire, chaque
   bloc se présente en **lecture** — libellés et valeurs, sans champ de saisie —
   et son bouton « Modifier » l'ouvre à la saisie (`state.affaires.edition`,
   `ui.fieldset`). Ce qui est secondaire — contrôles conformes, valeurs
   déduites, procédure applicable, effets d'une décision, dictionnaire des
   variables, domaines du rapport — est **replié** par défaut
   (`panel({ collapsible: true })`).
3. **Une page longue a un sommaire.** Au-delà de deux écrans, une **barre
   d'ancres** collante (`ui.anchors`) reste sous le haut de la fenêtre : elle
   mène aux parties de la page (rapport d'activité, trames, aide), ou bascule
   une vue (graphiques / tableaux). Sur les pages de Réglages, c'est la
   sous-navigation qui joue ce rôle, groupée par section (`groupe` dans la
   constante `NAV`).
4. **La place disponible se répartit, le texte garde sa mesure.** Le conteneur
   du DSFR s'arrête à 78 rem : sur un écran large, la page perdait trois cents
   pixels de chaque côté. Toute la coquille partage donc un plafond plus large
   (`--app-shell-max`, 110 rem) — en-tête, navigation, contenu et pied de page
   restant alignés —, et les tableaux, listes et grilles prennent cette place.
   Ce qui ne doit **pas** s'élargir ne s'élargit pas : les textes gardent une
   mesure de lecture (`.app-prose`, `.app-page-head__sub`, `.fr-hint-text` par
   `--app-mesure`), et les contrôles d'une barre de filtres un plafond de
   largeur — la ligne se répartit alors **entre** eux plutôt que de les étirer.
   Un tableau de données, lui, garde le défilement horizontal de son conteneur
   plutôt que de comprimer ses colonnes.

#### Les champs d'une ligne

Deux principes, nés du même défaut : deux champs voisins n'ont jamais des
**textes d'aide** de même longueur — l'un en porte cinq lignes, l'autre aucune —,
et le DSFR place cette aide **dans le libellé**. Les contrôles se décalaient donc
d'une colonne à l'autre, et la ligne se lisait en escalier. Les aligner en
donnant à chaque libellé la hauteur du plus haut ne valait guère mieux : le
champ le plus sobre se retrouvait à cent pixels sous son intitulé.

1. **L'aide se lit sous le contrôle.** Le texte d'aide d'un champ (la
   `desc` d'une colonne, `field()` dans `ui.js`) se place après la zone de
   saisie : les libellés restent courts, s'alignent d'une colonne à l'autre, et
   l'explication se lit sous le champ qu'elle explique. Le lien est conservé
   pour qui ne voit pas le champ — l'aide est désignée au contrôle par
   `aria-describedby`, comme le fait le DSFR pour ses aides posées après un
   champ (`.fr-input-wrap + .fr-hint-text`). La case à cocher et le bouton
   radio suivent la même règle, à leur mesure : leur contrôle est la case,
   posée à côté du libellé, et l'aide se place sous le **couple case +
   libellé**, alignée sur le texte du libellé. Les pages Aide, la fenêtre d'un
   considérant, la fiche d'une trame, le Debug et le filtre du rapport
   suivent la même règle que les champs du schéma.
2. **L'alignement est mesuré.** Un contrôle composé peut être plus haut qu'un
   autre — une valeur en lecture seule qui court sur trois lignes, une liste de
   cases à cocher — et un libellé plus long peut se replier sur deux lignes dans
   une colonne étroite. `alignement.js` relève donc, après chaque rendu, la
   hauteur du **libellé le plus haut de chaque ligne visuelle** (une grille qui
   se replie se mesure bande par bande) et la publie en `--champ-label-h` sur
   les cellules : les libellés la reprennent en `min-height`, et les contrôles,
   qui les suivent, commencent tous à la même hauteur. La mesure est refaite
   quand la largeur change — barre de défilement comprise — et quand un bloc
   repliable s'ouvre, un contenu replié n'ayant pas de dimensions. Un contrôle
   composé — date, valeur en lecture seule, liste de cases — reprend enfin
   l'écart de 0,5 rem que le DSFR ne pose qu'entre un libellé et un champ natif,
   sans quoi il s'affichait 8 px plus haut que son voisin — la **recherche d'un
   menu déroulant**, qui prend la place du `<select>`, comprise. Le contrôle
   `verifierAlignement` (`tests/ecrans.test.js`) refuse toute ligne dont les
   contrôles ou les libellés ne sont pas alignés — il parcourt les écrans du
   menu, **toutes** leurs sous-pages (le rapport d'activité, les échéances, les
   séances et rôles, les onze de Réglages) et les fiches (un document par trame),
   puisque ce sont elles qui portent les grandes grilles.

Le même contrôle relève une **seconde famille d'écarts**, née d'un défaut
signalé sur la fiche d'une affaire : le **bord droit des actions d'un bloc**.
Dans un même conteneur — les blocs d'une fiche, les panneaux d'une page —, le
bouton d'un bloc (« Modifier », « Exporter ») se range au bord, et les boutons se
répondent ainsi d'un bloc à l'autre. L'en-tête d'un bloc **repliable** porte un
repère de plus (`+` / `–`) : posé à droite, il décalait le bouton de sa largeur —
il se range donc **à gauche du titre**. Cet en-tête étant un `<summary>`, il
reçoit par ailleurs la remise en `border-box` que la page applique au contenu des
`<details>` : sans elle, les boutons qu'il porte prennent la hauteur de leur
rembourrage en plus de la leur. Et le bouton se range au bord droit par
`margin-left: auto`, non par le seul `space-between` de la tête : quand le titre
est long, la ligne se replie, le bouton part seul sur la suivante, et
`space-between`, n'ayant plus rien à répartir, le laissait au bord **gauche** —
214 px d'écart avec les blocs voisins sur un écran étroit. Voir `SPEC.md`,
invariant 31.


L'application est conçue **pour un usage sur ordinateur** (poste de travail) :
les écrans sont pensés pour une largeur confortable (listes maître/détail,
tableaux étendus, deux colonnes de panneaux), et la coquille s'élargit jusqu'à
110 rem sur un grand écran — tableaux, listes et grilles en profitent, tandis
que les lignes de texte, elles, ne s'étirent pas. Sur un écran étroit, l'interface
reste fonctionnelle — la barre de navigation se replie dans un menu plutôt que de
tenir quatre rangs, l'en-tête se replie sur plusieurs lignes au lieu de déborder,
les menus déroulants restent dans la fenêtre, et les tableaux étendus (registre
des décisions, répartition des affaires) défilent horizontalement dans leur
conteneur au lieu de comprimer leurs colonnes — mais elle n'est pas optimisée
pour un téléphone.

### La recherche dans les listes déroulantes

Les menus de l'outil — personnes, affaires, sections, membres, trames, décisions —
comptent des dizaines, parfois des centaines de valeurs. Un `<select>` natif les
présente en vrac : rien n'y cherche, et trouver une personne parmi cent lignes se
fait à l'œil. Au-delà de **douze valeurs** (`SEUIL_RECHERCHE`), la liste reçoit
donc un champ de recherche (`select-recherche.js`, appelé à chaque rendu par
`app.js`) : quelques lettres, et la liste se réduit.

Ce que la recherche comprend : elle ignore **les accents et la casse**
(« eleve dupre » trouve « Élève DUPRÉ »), et elle **classe** les réponses — ce qui
commence par la requête d'abord, ce qui commence un **mot** ensuite, ce qui la
contient après ; à rang égal, l'ordre du menu est conservé, si bien que deux
homonymes restent dans l'ordre où l'établissement les a saisis, et que la liste ne
se réorganise pas sous les yeux au fil des lettres. La partie trouvée est mise en
évidence, le nombre de réponses est annoncé aux lecteurs d'écran, et une recherche
sans réponse le dit.

Au clavier : les flèches désignent une proposition, `Entrée` la retient, `Échap`
referme sans rien changer (dans une fenêtre modale, c'est la **liste** qui se
referme, pas la fenêtre), `Origine`/`Fin` et `Page↑`/`Page↓` parcourent la liste,
et la tabulation quitte simplement le champ. Taper une lettre **remplace** le
libellé retenu — comme le ferait un menu natif —, et fermer sans choisir le
rétablit.

Le `<select>` d'origine n'est ni remplacé ni retiré : il est **masqué** et reste
la source de la valeur. C'est lui qui garde son `id`, ses `data-*` et ses
`<option>`s ; choisir une proposition lui donne sa valeur puis lui envoie un
`change`, exactement comme un choix natif. `data-bind` (écriture en base),
`data-filter` (filtre de liste) et `data-action` fonctionnent donc sans rien
savoir de ce module, et un menu neutralisé par le rôle reste neutralisé. L'entrée
**sans valeur** du menu (« — », « Toutes les trames ») reste proposée en toute
circonstance : c'est elle qui ramène à vide, et elle se range en dernier dès qu'une
recherche est en cours — sans quoi valider une recherche aurait remis le filtre à
zéro au lieu de retenir ce qu'on venait de désigner.

La recherche est un **ajout**, jamais une contrainte : sous le seuil, le menu garde
son aspect natif (`data-recherche="non"` l'exempte, `data-recherche="oui"` la
demande pour un menu plus court). La liste des propositions est déposée dans le
`<body>`, en position fixe : beaucoup de ces menus vivent dans une fenêtre modale
dont le corps défile, et une liste posée dans le champ y serait rognée dès la
troisième ligne. Elle s'ouvre sous le champ, ou au-dessus quand la place manque,
et **reste dans la fenêtre**. Une liste plus longue que la place qu'elle occupe se
**parcourt** — molette, doigt (`touch-action: pan-y`), barre de défilement — et
son replacement sous le champ, déclenché par un défilement de la page, ne la
renvoie pas à sa première ligne : la hauteur naturelle se mesure sur le contenu,
sans relâcher le plafond, et la liste ignore les défilements qui viennent d'elle.

`verifierRecherche` (`tests/ecrans.test.js`) parcourt les écrans et les fiches,
ouvre chaque menu enrichi — y compris celui des **intervenants d'une affaire**,
dans l'onglet de composition, ouvert en chemin puis refermé ; le menu n'étant
enrichi que sur une section assez fournie, l'onglet s'ouvre sur l'affaire dont la
section compte le plus de membres en fonction, et la sélection trouvée est rendue
—, éprouve une recherche sans réponse et `Échap`, vérifie qu'une liste plus longue
que sa fenêtre se laisse défiler, et que les **groupes** du menu natif sont redits
dans la liste ouverte — **aucun** groupe du répertoire des personnes n'y figurant
(invariant 29) —, puis — sur un menu de filtre seulement, dont la valeur ne quitte
pas les préférences — le choix d'une valeur et le retour à vide.

### Les menus déroulants

Un bouton qui ouvre plusieurs sorties — « Exporter », « Rapport » — n'est pas un
bouton qui déroule un panneau : c'est un `<details>` (`.app-menu`), dont le
résumé **est** le bouton et dont le panneau porte les entrées. Le bloc s'ouvre
donc au clavier comme au doigt, sans JavaScript, et le rendu suivant le referme
(la coquille est reconstruite à chaque navigation, si bien qu'un menu ne survit
jamais à la page qu'il quitte).

Le panneau s'ancre au bord **droit** de son bouton : sur un écran large, le
bouton est près du bord droit de la page et le panneau s'ouvre vers la gauche,
dans la place disponible. Sur un écran **étroit**, la ligne d'actions d'une tête
de page se replie et ses boutons repartent du bord gauche — ancré là, le
panneau, large de 16,5 rem, s'ouvrait de 103 px **hors** de la fenêtre, et la
moitié de ses entrées devenait invisible et incliquable. `menus.js` mesure le
panneau à l'ouverture et le ramène d'un simple décalage horizontal
(`translateX`) : l'ancrage et la mise en page ne changent pas, et un panneau qui
tenait déjà dans la fenêtre n'est pas déplacé d'un pixel. La mesure se prend au
**clic** sur le résumé, qui précède l'ouverture du bloc — et où le panneau porte
déjà ses cotes —, de sorte que le panneau est en place avant d'être peint et ne
saute pas d'un bord à l'autre sous les yeux ; `toggle` (ouverture au clavier ou
par le code) et un redimensionnement de la fenêtre repassent la mesure.

`verifierMenus` (`tests/ecrans.test.js`) éprouve le replacement sur des panneaux
**montés hors** de la fenêtre — deux cas qui ne dépendent pas de la largeur
courante —, puis, sur chaque écran de `NAV`, que le panneau d'un menu réellement
ouvert reste dans la fenêtre ; ce second volet se lance à une largeur étroite
(`set_viewport_size`), comme le contrôle d'alignement.

### Les collèges dans la liste des intervenants

Le menu « Intervenant » d'une affaire est le seul de l'outil qui **groupe** ses
valeurs : une composition réglementaire se lit par collège — tant de professeurs,
tant de maîtres de conférences, tant d'usagers —, et rien dans un nom ne dit si
« Karim BENSAID » est un usager ou un enseignant-chercheur. Le menu natif porte
donc un `<optgroup>` par collège (`membresParCollege`, `views/affaires.js`), et
la liste ouverte le redit par un **intertitre** — un collège qui revient dans une
recherche se redit, puisque les réponses y sont classées par proximité et non par
groupe.

Le **répertoire des personnes** n'y a pas sa place : le menu ne propose que des
**membres de la section disciplinaire** de l'affaire — c'est d'eux que la
formation se compose, et une commission ne se bâtit pas avec n'importe quelle
fiche du répertoire. La personne qui n'en est pas membre — le rapporteur pris
hors de la section, par exemple — se **décide** pourtant, explicitement :
« Ajouter une personne hors section », à côté d'« Ajouter un intervenant », fait
naître une ligne déjà marquée, où le nom s'écrit librement ; choisir « Saisie
libre » dans la liste fait de même. La **qualité suit la source**
(`qualiteIntervenant`, `procedure.js`) : une fiche de membre fait un intervenant
de la section, l'absence de fiche un intervenant hors section — sans écraser une
qualité délibérée (« Agent de l'établissement », « Personnalité extérieure »).
Une fiche qui porte **déjà** une personne du répertoire, choisie avant cette
règle, garde ce choix : il est présenté seul, sous « Hors section », pour qu'une
sélection ne s'évanouisse pas sous les yeux du secrétaire.

### Ce qui ne bouge pas quand la page se reconstruit

`render()` remplace **tout** le contenu de `#app` : sans précaution, le
navigateur ramène la page en haut dès qu'un rendu passe par un contenu plus
court, et le corps d'une fenêtre modale repart de son premier champ.
`captureView` / `restoreView` (`app.js`) relèvent donc, avant chaque rendu, la
position **des zones défilantes** — les conteneurs marqués `data-scroll` :
listes, tableaux, et le corps des fenêtres modales (`ui.dialog()`) — et celle
**de la page** elle-même, puis les remettent en place, avec le focus et le
curseur du champ en cours de saisie.

La règle est posée à la table `ACTIONS` : un rendu déclenché par un **champ** —
choisir une affaire filtre les trames, choisir une section filtre les voies —
garde la vue en place (`keepFocus: true`, valeur par défaut). Seuls la
navigation, le changement d'étape d'un assistant, l'ouverture d'une analyse
d'import et les opérations qui remanient la fiche repartent du haut
(`keepFocus: false`). **Finir de remplir un champ ne renvoie donc jamais en haut
de la page**, et ouvrir puis refermer une fenêtre modale laisse la page où elle
était.

### Saisie des dates

Une date se saisit dans un **champ de texte**, jamais dans un champ natif
`type="date"` : le champ natif n'accepte le collage que d'une date au format
international (`2026-09-20`), refuse silencieusement une date française
(`20/09/2026`), et remet le champ à zéro dès que la valeur lui paraît
incomplète — au moment précis où l'on tape l'année. Le rendu d'un champ `Date`
passe donc par `ui.dateInput()` (`ui.js`), qui produit un champ de texte
(`placeholder="JJ/MM/AAAA"`), un **bouton calendrier** et un champ natif masqué
qui sert uniquement de sélecteur (le bouton appelle `showPicker()` dessus ; un
navigateur sans sélecteur découvre le champ le temps du choix). Le clavier reste
le clavier ordinaire : un clavier numérique (`inputmode="numeric"`) interdirait
la barre oblique, et l'on serait de nouveau bloqué.

`parseDateSaisie()` (`formulas.js`) analyse ce qui est écrit et rend la date en
ISO `AAAA-MM-JJ` — la seule forme que connaissent le magasin et Grist. Sont
acceptés, pour qu'un collage fonctionne toujours et qu'une date puisse être
tapée d'un trait : `20/09/2026`, `20-9-2026`, `20.09.26`, `20092026`,
`200926` (année sur deux chiffres, bascule à 40), `2026-09-20`, et
l'horodatage `2026-09-20T00:00:00Z`. Une date impossible (le 31 février) est
refusée.

Deux moments distincts, dans `bindValue()` (`app.js`) :

- **pendant la frappe** une date encore incomplète (`20/09/2`) est simplement
  ignorée — c'est l'état normal d'un champ en cours de saisie, et le brouillon
  n'est pas touché ;
- **à la fin de la saisie** (perte du focus, validation) une date illisible est
  signalée sous le champ (`fr-error-text`) et le champ revient à sa dernière
  valeur valable (`data-date-valeur`), plutôt que d'effacer en silence la date
  enregistrée.

`aujourdHui()` et `formatDateSaisie()` (`formulas.js`) lisent les dates avec
les getters **locaux** : `toISOString()` donne l'heure UTC, et annonce donc
encore la veille pendant la première heure de la journée en France.

### Affichage : plein écran et thème

L'en-tête réunit à droite, juste avant le bloc utilisateur, après le bouton
« Nouvelle affaire », une ou deux commandes d'affichage (`affichage.js`) :

- **Plein écran** : bascule le plein écran du navigateur. Le bouton n'est pas
  affiché lorsque la page est déjà présentée seule (`?style=singlePage`), ni
  sur les navigateurs incapables de passer en plein écran (iPhone, iPad,
  cadres sans autorisation) : un bouton sans effet serait pire que rien.
- **Thème clair / sombre** : reprend le mécanisme du DSFR plutôt qu'un système
  parallèle — attribut `data-fr-scheme` sur `<html>` et clé `scheme` du
  stockage local. Tant que la personne n'a rien choisi, l'outil suit le
  réglage du système ; dès qu'elle clique, son choix est mémorisé. Le script
  en ligne placé en tête d'`index.html` repose le thème retenu avant le
  premier rendu, pour éviter un éclair blanc au chargement.

**Dans un document Grist, ce sélecteur disparaît** : le thème appartient au
document, et un second réglage local ne serait qu'un doublon trompeur. Grist
annonce son thème aux widgets qui se manifestent — `theme.appearance` dans le
message d'accueil du widget — et l'API officielle le recopie sur `<html>`
(`data-grist-appearance`). `watchGristTheme()` écoute les deux signaux (le
message brut fonctionne même avec une API ancienne), pose `data-fr-theme` et
rien de plus : le thème de Grist n'est **pas** mémorisé dans la clé `scheme`,
qui reste le choix propre à la personne — elle le retrouve en revenant au site
autonome. Tant que l'annonce n'est pas arrivée, le sélecteur reste caché (pas
de bouton qui apparaît puis s'efface) ; s'il n'en vient aucune — Grist ancien,
liaison en échec — il reparaît de lui-même (`abandonGristTheme()` sur échec,
délai de sécurité de 10 s, ou 1,5 s après une liaison aboutie sans annonce).
Tant que Grist pilote, l'outil **réaffirme** son apparence si le DSFR tente
d'imposer celle du système.

Le bloc utilisateur est le dernier élément de l'en-tête : il reste donc
toujours aligné à droite, y compris lorsque les outils se replient sur
plusieurs lignes (écran étroit, widget Grist peu large). Ces commandes
n'écrivent aucune donnée : elles restent disponibles en lecture seule
(`READ_ONLY_ACTIONS` dans `app.js`).

### En-tête de l'outil

L'en-tête reprend la structure du DSFR : à gauche le **bloc-marque** (la
Marianne), et juste à sa droite l'**emplacement de l'opérateur**
(`.fr-header__operator`) — la place où le DSFR prévoit le logo de l'organisme
qui porte le service (université, rectorat, collectivité).
`ui.brandBlock()` construit les deux d'un seul bloc, ce qui garantit que
l'aperçu des Réglages et l'en-tête réel sont identiques.

Avec la **charte neutre**, le bloc-marque n'est pas écrit : l'en-tête ne porte
plus que le logo de l'opérateur, à gauche. Le pied de page perd lui aussi la
marque de l'État. Il ne porte **aucune mention** : l'outil est interne, il n'a
ni page d'accessibilité, ni mentions légales, ni déclaration de données
personnelles à renvoyer, et il n'annonce donc ni conformité ni inspiration. Voir
« Charte graphique et polices » au chapitre 5.

Ce logo se configure dans **Réglages › Identité** (`Identite` table,
`Logo_operateur` = adresse `https://…` **ou** image choisie sur le poste,
`Logo_operateur_alt` = texte de remplacement pour les lecteurs d'écran) :

- une adresse vide signifie « aucun logo » : l'emplacement reste alors vide et
  l'en-tête est exactement celui d'avant ;
- « Choisir une image sur ce poste… » lit le fichier local et l'enregistre en
  `data:` URL dans le champ — le logo voyage donc avec le document (utile en
  Grist, où un fichier local n'existe que sur un poste) ; les fichiers sont
  limités par `LOGO_MAX_BYTES` (512 ko) ;
- la page affiche à droite un **aperçu de l'en-tête** en direct.

C'est un logo **distinct** du `Logo` des sections : celui-ci est le logo de
l'opérateur, fixe, affiché partout en haut de l'outil ; l'autre identifie une
section et n'apparaît que dans ses courriers. La hauteur suit le DSFR
(≈ 3,5 rem) ; `styles.css` borne l'image à `max-height: 3.5rem` et
`max-width: 10rem` pour qu'un logo très large ou très haut ne déforme pas la
barre.

### La barre de navigation

Deux barres sont rendues, et une seule est visible à la fois. Au-delà de 48em,
les entrées s'alignent en une ligne (`.app-navbar__list--desktop`). En deçà,
elles ne tiendraient plus : neuf entrées se repliaient sur **quatre rangs** et
235 px, et l'en-tête, la barre, le bandeau et la tête de page repoussaient le
premier panneau **sous la fenêtre** (918 px pour 844 px de haut). Elles se
rangent donc dans un `<details>` (`.app-navbar__mobile`), dont le résumé — un
simple `<summary>`, ouvert au clavier comme au doigt — annonce la page courante
à droite du mot « Menu ». Le rendu suivant le referme : la coquille est
reconstruite à chaque navigation. Les deux barres portent les mêmes entrées
(celles que le rôle autorise), et celle qui est cachée ne l'est pas au sens de
`display` seulement : l'autre est **absente** de la mise en page, donc jamais
annoncée deux fois.

**La barre reste en haut de la fenêtre quand on défile** (`position: sticky`),
et rien ne doit la recouvrir. Sur les pages longues — Aide, Rapport d'activité,
Réglages › Données —, le sommaire d'ancres (`ui.anchors`) se collait lui aussi à
`top: 0` : plus bas dans le document, il passait **devant** la barre, qui
disparaissait sous lui dès qu'on défilait, alors que c'est justement son rôle de
rester. Les barres collées de la page s'adossent maintenant à elle :
`entete-defilant.js` publie sa hauteur en `--app-navbar-h`, et le sommaire comme
les colonnes d'outils — collées à 4,5 rem fixes, elles passaient **sous** la
barre dès qu'elle tenait sur deux rangs — s'y accrochent.

**Les commandes du compte prennent place sur la barre.** L'en-tête n'est pas
collé : en défilant, le titre du service, le bouton « Nouvelle affaire » et le
bloc de compte (nom, rôle) quittaient la vue. Ces deux commandes sont écrites
**en double** — une copie dans l'en-tête, une copie sur la barre
(`outilsBarreHtml`, `app.js`) — et c'est la page qui bascule de l'une à l'autre :
dès que le bas de l'en-tête a franchi le haut de la fenêtre, `<html>` reçoit
`entete-reduite`, et la copie de la barre paraît. Fermée, cette copie n'est ni
visible, ni focusable, ni annoncée (`visibility: hidden`, largeur et hauteur
nulles) ; le focus revient à la copie **visible** du bouton quand une fenêtre
ouverte depuis la barre se referme.

Elles se rangent **sur le rang des onglets**, à leur droite : le rang de la barre
est une ligne souple (`.app-navbar > .fr-container`), les onglets gardent la
gauche, les commandes vont au bord droit, et la barre **ne grandit pas** quand
elles arrivent — rien ne bouge sous elles, ni la page, ni les barres collées qui
s'adossent à sa hauteur. La place qu'elles demandent est prise aux onglets, qui
se replient sur un rang de plus s'il en manque ; quand les onglets remplissent
déjà le rang, les commandes passent sur un second rang, à droite, plutôt que de
les comprimer. C'est la **place** qui décide : au-delà de 48em, la barre les met
sur une ligne dès qu'elles y tiennent.

**Dans un widget Grist comme dans un onglet**, la barre se colle et les
commandes y prennent place : le cadre d'un widget défile pour lui-même,
`position: sticky` s'y accroche de la même façon, et un cadre court est celui où
une barre qui reste sert le plus. La barre y est seulement **plus mince** — ses
entrées se resserrent d'un cran (`styles.css`) —, pour prendre le moins possible
sur le contenu ; seule la colonne collée des ateliers y reste dans le flux.

En deçà de 48em, la barre se replie dans un menu : il n'y a plus de rang à
partager, les commandes reprennent donc **leur propre ligne**, sous lui, révélée
par le haut, et occupent toute la largeur.

L'animation est **menée par le script** (`requestAnimationFrame`), et non par une
transition CSS : les transitions ne s'avancent pas dans tous les cadres où
l'outil s'affiche — l'aperçu de l'éditeur se déclare masqué (`document.hidden`)
et son horloge d'animation reste à zéro —, et une transition figée à son départ
laisserait les commandes invisibles alors que la page a bel et bien basculé. Un
délai de secours efface les styles posés si aucune image n'arrive : l'état décrit
par `styles.css` s'applique alors sans animation. Pour la même raison, la
position — l'en-tête a-t-il disparu ? — est surveillée par l'écoute du défilement
**et** par un contrôle périodique court (100 ms) : les événements de défilement
ne sont pas délivrés partout, et une hauteur qui change sans défilement (le logo
de l'opérateur qui arrive, une ligne d'outils qui se replie) ne réveille aucune
écoute. Son **sens suit la mise en page** : la largeur du bloc quand il partage
le rang des onglets, sa hauteur quand il tient sa propre ligne — et ici encore,
la règle de largeur (48em) est écrite des deux côtés.

`verifierEntete` (`tests/ecrans.test.js`) défile trois écrans témoins et vérifie
ce qui est **peint** au point des onglets, l'arrivée puis l'effacement des
commandes, l'écart de collage des barres collées, et l'**état que la place
appelle** : même rang quand les onglets et les commandes y tiennent ensemble
(sans chevauchement, et sans que la barre grandisse), second rang sinon. Le
contrôle est rejoué en mode **embarqué** (`verifierEntete({ embarque: true })`) —
la classe `.app-embedded` est posée sur `<html>` le temps du parcours — et à
plusieurs largeurs : c'est ainsi que les deux états de la barre sont éprouvés.
Il échoue sur les versions précédentes, où la barre n'était pas collée dans un
widget et où les commandes occupaient **toujours** un second rang.

### Découpage visuel

Pour éviter les écrans surchargés, trois primitives de `ui.js` sont utilisées
systématiquement :

- `panel(title, body, opts)` — un panneau DSFR. Avec `{ collapsible: true }` il
  devient repliable (balise `<details>`, chevron, fermé par défaut) : c'est le
  traitement réservé au contenu de second plan (données calculées, informations
  reprises, dictionnaire, documentation historique).
- `fieldset(title, body)` — un groupe de champs titré à l'intérieur d'un
  panneau. Un long formulaire se découpe en trois ou quatre groupes séparés par
  un filet, plutôt qu'en une file de dix champs.
- `columns(items, { widths })` — une rangée de panneaux côte à côte.

Les onglets d'une affaire et les sous-pages de Réglages suivent la même
logique : un panneau par intention, jamais plus de deux colonnes de panneaux.

## 4. Modèle de données

Le modèle est décrit en détail dans **`SPEC.md`** (rôle de chaque table, et
pourquoi elle existe) ; `schema.js` en est la source de vérité. Vue d'ensemble :

**Tables de référence** (ce que l'établissement paramètre) :
`Sections_disciplinaires` (une section par **public**, **tutelle** et **type**),
`Membres` (avec les
mandats), `Secretaires`, `Destinataires_institutionnels`, `Personnes` (le
répertoire commun), `Sanctions`, `Motifs` (chacun portant son **régime** et sa
**tutelle**), `Parametres` (les seuils et durées,
lus par les contrôles), `Trames`, `Types_Trames`, `Presentation` (la
documentation reprise), et `Identite` — table **facultative** (`optional:
true`) : le logo de l'opérateur, la **charte graphique** et la **police des
documents**, voir « En-tête de l'outil » et « Charte graphique et polices » au
chapitre 5.

`Considerants` — **facultative** elle aussi (`optional: true`) — porte le
**répertoire des considérants de principe de l'établissement** : le titre qui le
fait retrouver, la rubrique du plan, la nature, le texte inséré dans la
décision, les tags, la source, le domaine, `Origine` (l'identifiant du
considérant livré que cette ligne adapte, et qu'elle remplace alors) et `Usage`
(le nombre d'insertions dans une décision, qui classe le répertoire). L'outil
livre déjà son propre répertoire : la table n'existe que si l'établissement
écrit le sien, et le panneau propose de la créer — voir « Rédaction d'une
décision » au chapitre 5.

**Tables d'affaire** (rattachées à une affaire, supprimées avec elle) :
`Affaires`, `Jonctions` (le groupe d'affaires jugées par une **même décision** :
voir « Jonction d'affaires » au chapitre 5 — c'est la jonction qui est rattachée à
son **affaire de tête**, et qui disparaît avec elle), `Intervenants` (la formation : président, assesseurs, rapporteur —
membre de la section **ou hors section** —, secrétaire de séance…),
`Implications` (les autres personnes du dossier : victime, témoin, défenseur…),
`Seances_d_examen` (avec leur **type** de réunion), `Decisions` (nature, texte,
sanction du catalogue, motivation, dates, durées, sursis, et la **date butoir
d'instruction** d'une décision qui reporte le terme), `Recours`,
`Generateur` (les documents produits, dont la **date butoir d'instruction** des
pièces qui touchent à l'instruction) et `Journal` (le registre des
opérations).

**Table d'héritage** : `Commissions` (`legacy: true`) — la composition de la
commission telle que le document d'origine la portait. L'outil la **lit** encore
(l'onglet de formation la signale et propose de « Reprendre la composition »),
ne l'écrit jamais et ne l'exige jamais : un document neuf ne la crée pas, et
`installStructure` l'ignore.

**Table de la corbeille** : `Corbeille` — ce qu'on a **mis de côté** au lieu de
le supprimer : le nom de la ligne, sa table d'origine (`Table`, et son libellé
`Table_libelle`), qui l'a mise de côté et quand (`Supprime_par`, `Supprime_le`),
et son **contenu entier**, sérialisé en JSON (`Contenu`). Une ligne restaurée
retrouve son **identifiant d'origine** : les documents qui la citaient la
retrouvent du même coup. Voir « Registres de Réglages : trames et formats ».

**Rattachement secrétaire ↔ section** : deux colonnes expriment la même
relation — `Sections_disciplinaires.Secretaires` et `Secretaires.Section` — et
sont déclarées **miroirs** l'une de l'autre (`miroir` dans `schema.js`) :
`propagerMiroirs` (store.js) ajoute ou retire l'identifiant sur l'autre face à
chaque écriture, et `migrerMiroirs` (schema.js) **réunit au chargement** les deux
listes d'une base antérieure, où elles avaient pu diverger — c'est ce qui
permettait à une section de montrer un secrétaire que sa fiche ignorait. Dans
l'interface, une colonne `RefList` se **coche ligne à ligne** (`.app-checklist`,
`ui.field()`) plutôt que de se choisir dans un menu à choix multiples : le geste
est le même pour ajouter et pour retirer, et deux rattachements se voient d'un
coup d'œil.

Trois colonnes s'ajoutent aux tables reprises du document d'origine :
`Affaires.Mis_en_cause` (référence à `Personnes` : l'identité n'est plus une
suite de colonnes de l'affaire), `Seances_d_examen.Type` et
`Generateur.Contenu` (le texte propre à un document, voir « Rédaction libre
d'un document » au chapitre 5). Une quatrième, `Generateur.Feuille_de_style`,
porte le même héritage que `Trames.Feuille_de_style`, **un étage plus bas** :
l'adaptation de la feuille de style propre à **une pièce** (voir « Une seule
feuille »). Un document Grist existant ne les a pas :
« Vérifier la structure » les signale et « Installer la structure » les crée
sans toucher aux données.

La **refonte des feuilles de style** en ajoute deux, et en retire quatre :

- `Types_Trames.Feuille_de_style` — la feuille de style du format, le document
  écrit d'un bout à l'autre autour de `{{Corps}}` ;
- `Trames.Feuille_de_style` — **facultative** : l'adaptation propre à une trame,
  vide tant qu'elle hérite de son format (voir `feuilleEffective`, render.js) ;
- `Generateur.Feuille_de_style` — **facultative**, le dernier étage : l'adaptation
  propre à **un document**, vide tant que la pièce suit la feuille de sa trame
  (voir `feuilleEffectiveDocument`, render.js) ;
- les quatre colonnes de mise en page de `Types_Trames` (`En_tete`,
  `En_tete_corps`, `Signature`, `Pied_de_page`) sont **retirées** du modèle :
  elles sont marquées `ancien: true` dans `schema.js`, ce qui dispense
  `grist-backend.js` de les créer et de les attendre — « Installer la
  structure » ne les réclame plus, et « Vérifier la structure » ne les signale
  plus comme manquantes. Elles restent lisibles : une base antérieure ne se
  perd pas.

**La reprise d'une base antérieure** (`migrerFeuilles`, schema.js) se fait au
chargement, et ne touche jamais au texte des trames :

- les trois anciens blocs de chaque format (`En_tete`, `Signature`,
  `Pied_de_page`) sont **cousus** en une feuille de style unique, dans l'ordre
  où le document les lisait, avec `{{Corps}}` entre le chapeau et la signature ;
- les balises de mise en page (`{{En_tete}}`, `{{En_tete_corps}}`,
  `{{Signature}}`, `{{Pied_de_page}}`), devenues sans objet, sont **retirées**
  du corps de **toutes** les trames — et de `Generateur.Contenu` —, avec les
  paragraphes vides qui les portaient ;
- les quatre colonnes devenues obsolètes sont effacées des enregistrements ;
- le format livré « Décision du président » — qui réunissait, sous une seule
  feuille, le président de la **section** et celui de la **formation de
  jugement** — devient celui du **président de la section disciplinaire** (son
  identifiant, donc ses liens et sa feuille adaptée, sont conservés) ; les
  trames livrées que leur modèle destine au président de la formation de
  jugement rejoignent le format livré qui leur revient dès que « Installer les
  trames par défaut » l'a ajouté à la base (`deplacementsTramesPresident`,
  schema.js ; voir « Trames livrées par défaut ») — et si l'établissement avait
  adapté la feuille de style de l'ancien format, cette adaptation lui est rendue
  plutôt que la feuille livrée, car elle valait alors pour les deux présidents.
  Les deux formats du président prennent le nom d'**ordonnance**, et leur
  catégorie passe de `Décision` à `Ordonnance` : la reprise `migrerActesRendus`
  (schema.js) renomme les formats, écrit **ORDONNE** dans le dispositif de leurs
  trames là où le modèle livré disait `DÉCIDE`, retire du corps des trames de
  **décision** la signature que la feuille de style porte déjà, et **délie les
  documents d'ordonnance** de la décision à laquelle une version antérieure
  avait pu les rattacher : une ordonnance ne rédige aucune décision.
- **`migrerOrdonnances`** (schema.js) achève la reprise des actes rendus, et
  s'exécute la dernière : elle range la trame livrée « Composition de la
  formation de jugement » (n° 35) avec les **ordonnances** du président de la
  section, et entre dans la feuille de style de chaque format d'ordonnance — ou
  dans celle qu'une de ses trames s'est adaptée — la **formule d'ouverture** et
  les **visas** (le code de l'éducation, le visa du code rural et la saisine),
  dont elle retire en même temps l'ouverture restée dans le corps des trames.
  Elle n'entreprend rien lorsque la feuille porte déjà les visas ou n'a pas
  d'emplacement `{{Corps}}` : elle est idempotente, et un corps qui ne commence
  pas par l'ouverture livrée est laissé tel quel.
- **`migrerVoieDeRecours`** (schema.js) réécrit la **voie de recours** des
  notifications livrées : la formule livrée, qui désignait en dur « le tribunal
  administratif de <siège> » — à tort devant un enseignant-chercheur —, cède la
  place à la colonne calculée de la section (`{{Affaire_Section}}.Voie_de_recours`,
  voir `formulas.js`), qui suit le public et la tutelle ; la lettre des
  enseignants-chercheurs retrouve au passage l'article R.712-42 dont elle
  relève. Une trame propre à l'établissement, qui ne porte pas la formule
  livrée, est laissée intacte.

**La reprise des titres** (`migrerTitres`, schema.js) vient après celle des
feuilles et, comme elle, ne touche qu'à des balises — jamais au texte saisi par
l'établissement : les titres écrits avant la refonte typographique (un `<h3>`,
dont la taille venait de la charte graphique, et l'alignement en classe
`ql-align-*`) sont replacés dans la forme que la barre d'outils sait lire — un
paragraphe à taille explicite, prise dans son échelle. Les formes reprises, une
par une, sont décrites par `TITRES_LIVRES` (`trames-defaut.js`). La substitution
est **idempotente** : une base déjà reprise n'est pas réécrite, et rien n'est
donc marqué modifié au chargement suivant.

La table `Trames` porte, en plus de son texte, la **procédure qu'elle vise** :
`Public` (régime), `Tutelle` et `Type_de_section` — valeurs `Toutes` ou `Les
deux` pour les trames génériques —, ainsi que `Decision_definitive`, qui
marque la trame dont les champs de décision sont ceux de l'affaire (voir
« Décision définitive et décisions avant dire droit » au chapitre 5).

Les indicateurs (délai moyen de traitement, répartition par état, décisions par
origine — la composante de l'affaire, ou sa section disciplinaire quand elle
n'en porte pas) ne sont pas stockés : ils sont recalculés à la volée, comme les
tables de synthèse du document d'origine.

### Colonnes calculées

Les colonnes marquées `formula: true` dans `schema.js` sont **recalculées côté
client** (`formulas.js`) et ne sont donc jamais envoyées à Grist lors d'une
écriture. Elles comprennent les **colonnes d'identité de l'affaire**
(`Prenom_du_mis_en_cause`, `Nom_complet`, `INE`, `Adresse`, `Formation_suivie`,
`Corps`…), conservées sous leur identifiant d'origine pour que les balises
`{{Affaire}}.INE` des trames continuent de fonctionner alors que la donnée vit
désormais dans `Personnes`. C'est le principe de la reprise : **les balises
restent, le rangement change.** Ces colonnes n'ont donc pas vocation à porter
des formules dans le document Grist : un document neuf les crée vides, et
l'application les calcule à l'affichage.

Une colonne calculée peut aussi **rendre un enregistrement référencé**, et non
un identifiant : `Generateur.Decision` vaut la décision définitive de l'affaire.
C'est ce qui permet à une trame d'écrire `{{Decision}}.Motivation` ou
`{{Decision}}.Libelle_decision` — y compris un champ lui-même calculé, comme
`Libelle_decision` — sans que la décision soit recopiée dans le document.

> **La composante est facultative.** Le champ `Composante` (de `Personnes` et
> d'`Affaires`) est un texte libre : renseignez-y la faculté, l'école ou
> l'institut de rattachement — « Faculté de droit », « Faculté des sciences » —
> si l'établissement souhaite suivre l'origine des mis en cause, et laissez-le
> vide sinon. Tant qu'aucune affaire n'en porte, la page Décisions prend la
> **section disciplinaire** de chaque affaire pour origine : l'indicateur
> compte donc les sections concernées, et le filtre, la colonne et le graphique
> apparaissent dès qu'il y a plusieurs origines à distinguer (voir
> « Origine d'une décision » au chapitre 5). Le catalogue des sanctions, celui
> des motifs et les seuils, eux, se règlent **sans toucher au code** :
> Réglages › Catalogues et délais.

### Images (bloc-marque, logo)

Les colonnes `Marianne` et `Logo` de la table `Sections_disciplinaires`
contiennent une **adresse d'image** (`https://…`) **ou une image enregistrée
dans la base** (données `data:`, voir « Enregistrer l'image dans la base »
ci-dessous). Une adresse relative (par exemple `assets/logo.svg`) est résolue
par rapport à la racine du site : vous pouvez donc déposer vos propres logos
dans un dossier `assets/`.
Si `Marianne` est vide, le bloc-marque officiel « République Française » est
employé automatiquement.

#### Enregistrer l'image dans la base (recommandé)

Réglages › Sections et membres, sous « En-tête et signature des courriers »,
deux boutons enregistrent une image choisie sur le poste : **« Choisir le
bloc-marque sur ce poste… »** et **« Choisir le logo sur ce poste… »** (limite
512 Ko, comme le logo de l'opérateur de Réglages › Identité). L'image est
stockée avec les données, et se retrouve donc **dans tous les fichiers
exportés**, sans dépendre d'aucun hébergeur.

C'est la réponse au piège suivant, qui a fait disparaître plus d'une Marianne :

> **Une adresse d'image n'est pas toujours intégrable.** Pour un document PDF,
> Word ou OpenDocument, l'outil doit **télécharger** l'image et la recopier dans
> le fichier. Un hébergeur qui n'autorise pas la lecture croisée (en-tête CORS)
> — c'est le cas de la plupart des sites publics : ministères, Légifrance, sites
> d'établissements — laisse l'image s'afficher à l'écran mais **refuse** cette
> copie : le document partait alors **sans le bloc-marque de l'État**, en
> silence, alors que le logo de l'établissement (hébergé sur `user.uploads.dev`,
> qui l'autorise) apparaissait normalement.
>
> L'outil tente donc deux lectures : la lecture directe, puis, si elle échoue,
> le **relais de la plateforme** (`superFetch`, importé par `main.pjs` — présent
> lorsque l'outil est servi par Perchance, absent d'une archive déployée
> ailleurs). Si les deux échouent, l'export **le dit** : « N image(s) n'ont pas
> pu y être intégrées », et le geste à faire est d'enregistrer l'image sur le
> poste (boutons ci-dessus). Aucune image n'est plus omise en silence.

Le **logo de l'opérateur** de l'en-tête suit la même règle (adresse ou image
embarquée) : il se règle dans Réglages › Identité — voir « En-tête de
l'outil » au chapitre 3.

> **Adresse distante ou fichier déposé.** Une adresse `https://…` fait charger
> l'image par le navigateur depuis son hébergeur à chaque affichage : c'est une
> **lecture**, jamais un envoi (voir « Vie privée » au chapitre 6), mais elle
> révèle à cet hébergeur qu'une page de l'outil a été ouverte. Déposer le
> fichier — « Choisir une image sur ce poste… » dans Réglages › Identité —
> l'enregistre **dans le document** (limite 512 Ko) et supprime tout appel
> extérieur. Les images du bloc-marque de l'État sont, elles, embarquées dans
> l'outil (`assets/bloc-marque.js`).

Ce bloc-marque est le dossier `assets/` de l'outil :

| Fichier | Rôle |
| --- | --- |
| `assets/bloc-marque.svg` | La **source vectorielle**, en millimètres (vue 27,42 × 24,08 mm) : le drapeau tricolore et la Marianne officiels du DSFR, l'intitulé « RÉPUBLIQUE FRANÇAISE » sur deux lignes (**converti en contours**, Marianne Bold), puis la **devise de l'État** « Liberté Égalité Fraternité » sur trois lignes, **sous l'intitulé**. |
| `assets/bloc-marque.png` | Le rendu matriciel de référence : 658 × 578 px (24 px par millimètre, soit 610 dpi), fond blanc opaque. Ni le code ni les exports ne s'en servent — l'outil emploie le SVG —, il sert à regarder le dessin hors ligne. |
| `assets/bloc-marque.js` | Le bloc-marque **embarqué** dans le code : le SVG ci-dessus en `data:image/svg+xml;base64,…`, exporté sous le nom `BLOC_MARQUE_DATA_URL`. |

#### Composition : celle de la charte graphique de l'État

L'image suit la **composition officielle** — celle du composant `fr-logo` du
Système de Design de l'État, qui applique la charte graphique de l'État
([info.gouv.fr/marque-de-letat](https://www.info.gouv.fr/marque-de-letat)) :

```
        ┌──────────┐
        │ drapeau  │   Marianne : drapeau tricolore, profil blanc
        └──────────┘
   RÉPUBLIQUE          intitulé, deux lignes, Marianne Bold capitales
   FRANÇAISE
   Liberté             devise républicaine, trois lignes
   Égalité
   Fraternité
```

L'ordre est celui de la charte : « Marianne en entrée et devise républicaine en
fin ». La devise est donc **sous l'intitulé**, jamais à sa droite, et le
drapeau au-dessus de l'intitulé — c'est aussi ce que montre l'outil dans son
propre en-tête (le composant DSFR) : l'écran et les documents portent le même
bloc-marque.

Cotes (celles de la charte, reproduites à l'identique par le SVG) :

| Élément | Cote |
| --- | --- |
| Drapeau | 4,25 mm de haut, 11,69 mm de large (2,75 pour 1) ; le dessin de la Marianne, lui, garde son rapport naturel (44 × 18) et se trouve rogné par cette boîte, comme dans le DSFR |
| Intitulé | hauteur de capitale = 3/4 de celle du drapeau, corps 4,46 mm, interlettrage −0,01 em |
| Devise | largeur = 42 % de celle de l'intitulé, sous celui-ci |
| Bloc entier | 27,42 × 24,08 mm |

`BLOC_MARQUE_SIZE` (dans `render.js`) affiche l'image à sa taille de la
charte : le drapeau mesure alors **4,25 mm** sur le courrier, comme sur le
modèle de papier à en-tête de la charte. La hauteur est imposée, la largeur
suit — l'image n'est jamais déformée.

#### Pourquoi une image vectorielle embarquée

`render.js` emploie `BLOC_MARQUE_DATA_URL` et non un chemin de fichier. La
raison est double :

1. Dans le DSFR, la Marianne est un **pseudo-élément CSS** (`.fr-logo::before`),
   et la devise un second (`.fr-logo::after`) : ils n'existent ni dans un
   fichier Word, ni dans un OpenDocument, ni dans un PDF composé — l'aperçu PDF
   sortait sans la Marianne. Un document doit donc contenir une **image**.
2. Une image embarquée ne dépend d'aucun chargement réseau, et s'affiche aussi
   bien dans un aperçu isolé (cadre du widget Grist, aperçu d'un générateur)
   que hors connexion.

Le bloc-marque est de plus **vectoriel**, et c'est l'intitulé qui l'imposait :
dans une image — un `data:`, un `<img>`, un fichier exporté —, les polices de
la page ne sont pas accessibles ; un texte « RÉPUBLIQUE FRANÇAISE » y serait
rendu avec la police de repli du système, c'est-à-dire **pas** avec Marianne, et
l'en-tête d'un courrier officiel ne peut pas se permettre cette approximation.
Les trois parties du dessin sont donc des **tracés** : la Marianne et la devise
sont les dessins officiels du DSFR, l'intitulé les glyphes de **Marianne Bold
convertis en contours**, aux cotes de la charte. Aucune police n'est requise, et
l'image reste nette à toute taille — l'écran, la loupe du lecteur, l'impression
et l'aperçu PDF la rendent à la résolution du support, là où un PNG de 300 px
laissait voir ses pixels dès qu'on l'agrandissait.

#### Régénérer l'image

Le SVG est la source : on le modifie, puis on remplace la chaîne de
`bloc-marque.js` par son contenu en base64, préfixé de
`data:image/svg+xml;base64,` (`btoa`, ou tout outil équivalent). Rien d'autre
n'est à faire : l'écran, l'impression et le PDF emploient le SVG tel quel, et
`export-doc.js` le **pixellise** pour Word et OpenDocument (`pngDataUrl`, qui
vise 600 px au moins pour les petites images — le bloc-marque dépasse alors
550 dpi). `bloc-marque.png` n'est qu'un rendu de référence, à refaire si l'on
veut le regarder hors ligne.

Les dessins officiels viennent du DSFR et se retrouvent tels quels dans
`logo.min.css` (`@gouvfr/dsfr/dist/component/logo/`) : le drapeau et la
Marianne d'une part, la devise d'autre part. Pour changer l'intitulé, il faut
le recomposer : `Marianne Bold` (`@gouvfr/dsfr/dist/fonts/Marianne-Bold.woff2`)
et une bibliothèque de polices (par exemple `fontkit`) donnent les contours de
chaque glyphe, à placer à la taille et à l'interlettrage de la charte (4,4625 mm
de corps, −0,01 em), sur la ligne de base du modèle.

#### L'en-tête des documents

Les documents rendus — courriers, décisions, attestations, états imprimés —
reprennent la disposition du modèle de papier à en-tête de la charte : le
**bloc-marque de l'État à gauche, à sa taille officielle** (27,42 × 24,08 mm,
drapeau de 4,25 mm — voir `BLOC_MARQUE_SIZE`, `render.js`), le **logo de
l'établissement à droite, borné à l'emplacement de l'opérateur** (53 × 26 mm).
Les deux sont calés sur la **ligne de tête** (`align-items: flex-start`) : le
logo de l'établissement ne fait pas descendre le bloc-marque, et ne le fait pas
passer au second plan. La même règle vaut pour les états imprimés par l'outil
(`.doc-head`, `print.js`) et pour l'ancien balisage d'en-tête
(`.header`/`.left`/`.right`, `DOCUMENT_CSS`), conservé pour les trames qui
l'emploient encore. Les trois exports (PDF, Word, OpenDocument) mesurent ces
images dans la feuille rendue : ils portent donc exactement les mêmes
dimensions (voir `imageBlock`, `export-doc.js`).

## 5. Personnalisation

- **Données** : utilisez la vue « Données » (export/import JSON, restauration
  des exemples, remise à zéro). En mode Grist, les données vivent dans le
  document.
- **Catalogues de sanctions et de motifs** : Réglages → « Catalogues et
  délais ». L'outil livre un jeu repris des textes applicables (voir «
  Catalogues livrés par défaut » ci-dessous), chaque entrée portant son texte de
  référence, sa durée maximale et la possibilité d'un sursis ; un catalogue
  hérité d'une version antérieure s'y **aligne** d'un bouton, sans rien
  supprimer.
- **Charte et police** : Réglages → « Charte graphique » — la charte neutre (le
  défaut) ou la charte de l'État, et la police des documents. Voir « Charte
  graphique et polices » ci-dessous.
- **Structure** : `schema.js`. Ajouter une colonne y suffit — formulaires,
  tableaux et export la prennent en compte automatiquement.
- **Nouveaux documents types** : Réglages → « Trames ». La page est le registre
  (recherche, filtre par format) ; chaque ligne ouvre **l'espace de
  rédaction de la trame**, à son adresse (`#reglages/trames/7`). La trame s'y
  rédige en **WYSIWYG** (éditeur `editor.js`), **d'un seul tenant** — la
  **feuille de style** de son format (en-tête, chapeau, signature, pied de page)
  puis **le texte de la trame**, à l'emplacement que marque la pastille « Texte
  de la trame » : rien ne sépare les deux à l'écran, et l'on y corrige aussi bien
  la feuille que le texte, comme dans l'espace de rédaction d'un document (voir
  « Rédaction libre d'un document »). Corriger la feuille ne vaut que pour
  **cette trame** — les autres gardent celle du format, et « Rétablir la feuille
  du format » défait l'adaptation. Trois **vues** (`state.tabs.trameVue`) la
  montrent : « Rédaction », « Balisage » (le HTML) et « Résultat » (le document
  produit sur une affaire d'exemple). Les variables se glissent depuis la
  palette de droite — un outil repliable — ou s'insèrent d'un clic au curseur,
  et s'affichent sous forme de pastilles portant la valeur d'exemple (case
  « Balises » pour voir les `{{…}}` bruts). À l'enregistrement, les pastilles
  redeviennent du texte : le moteur de rendu (`render.js`) reste
  inchangé. La zone accepte les **deux familles de balises** — les variables
  `{variable}` de la feuille de style et les `{{Colonne}}` des données de
  l'affaire —, plus l'emplacement `{{Corps}}` (voir « Feuille de
  style d'un format » ci-dessous). Le
  dictionnaire complet est affiché au bas du registre des trames. Les **balises
  périmées** — les colonnes marquées `ancien` dans `schema.js`, comme
  `{{Affaire}}.Rapport_d_instruction` — ne sont plus proposées : le rapport
  d'instruction est désormais une pièce, produite comme un document.
  La barre d'outils ne s'arrête pas au texte : elle insère des **tableaux**
  bordés, des **images** (par leur adresse), des **traits de séparation** et des
  **sauts de page**, et le bouton « code » (`data-wysiwyg-source`) fait
  apparaître le **HTML** de la zone éditée — la palette y insère la balise au
  curseur. Une trame n'est donc pas limitée par une bibliothèque d'édition
  tierce : tout ce que produit le navigateur est enregistré tel quel. Quatre
  **menus de typographie** (`TYPOGRAPHIE`, dans `editor.js`) règlent le passage
  sélectionné — **police**, **taille** (8 à 28 pt ; « 12 pt — corps du texte »
  et « 14 pt — titre » nomment l'échelle du document), **couleur** et
  **surlignage** — par un `span` de style en ligne, comme le fait la graisse ou
  l'italique. Le premier choix de chaque menu (« Comme le document », « Aucun »
  pour le surlignage) **retire** la propriété : la sélection revient alors à la
  mise en forme du document, y compris quand elle vient d'un élément qui
  l'englobe (l'éditeur le coupe autour de la sélection). Libellé court et
  constant d'un menu à l'autre, pour qu'on lise « Police : comme le document »
  sans se demander de quel document il s'agit. L'aperçu et les trois exports
  reprennent ces valeurs (`font`/`shading` dans `export-doc.js`,
  `fo:font-family`/`fo:background-color` en OpenDocument), mais la police du
  document, elle, reste celle de la charte (`policeDocumentNom`). Les
  **modèles livrés**, eux, n'emploient que ces réglages-là — avec le gras,
  l'italique, le souligné et l'alignement : rien, dans une feuille de style
  livrée, n'a de taille ni de couleur que ces menus ne montrent (voir « Trames
  livrées par défaut »).
  Deux boutons, enfin, règlent les **retraits** (`appliquerRetrait`,
  `retraitTabulation`), et la touche **Tabulation** les donne d'un geste. Un
  retrait se compte en **centimètres** — une mesure du papier — et s'écrit sur le
  paragraphe : `margin-left` décale tout le bloc, `text-indent` sa seule
  **première ligne**. C'est ce qui le fait traverser toute la chaîne : la zone
  d'écriture, l'aperçu A4, l'impression et les trois exports le montrent à
  l'identique (`leadingIndent` et marge gauche du PDF, `indent` de Word,
  `fo:margin-left` / `fo:text-indent` de l'OpenDocument — voir « Exports »).
  **Tab** au **début** d'un paragraphe pose un cran de retrait de **première
  ligne** — la marque d'un considérant —, ailleurs un cran de retrait du bloc ;
  **Maj+Tab** défait un cran, et **Échap** fait sortir de la zone d'écriture
  (sans quoi la touche capturée y enfermerait celui qui écrit au clavier). Dans
  une liste, Tab range le point d'un niveau de plus, comme dans un traitement de
  texte. La commande native du navigateur n'est plus employée pour les
  paragraphes : son `execCommand("indent")` empilait des `<blockquote
  style="margin-left:40px">` que ni l'aperçu ni les exports ne savaient relire.
- **Texte d'un document** : la sous-vue du document (`#documents/<id>`),
  ouverte depuis la page « Documents » ou depuis l'onglet « Documents » d'une
  affaire, panneau « Espace de rédaction ». Voir « Rédaction libre d'un
  document » ci-dessous.
- **Feuille de style d'un format** : Réglages → « Formats et feuilles de
  style ». Un format ne porte plus trois blocs — chapeau, signature, pied de
  page — mais **un seul document**, écrit d'un bout à l'autre (`Feuille_de_style`) :
  l'en-tête du service y est posé par l'outil (Réglages › Identité), puis
  viennent le chapeau, l'emplacement `{{Corps}}` où le texte de chaque trame
  vient s'insérer, la signature et le pied de page répété. Il se rédige en
  WYSIWYG — même éditeur, même palette, alimentée cette fois par les variables
  `{variable}` (voir `feuilleCatalog`). Un format s'applique à toutes ses
  trames : l'aperçu A4 en bas de page reprend la première trame du format et se
  met à jour à la saisie. Une trame qui a besoin d'une autre mise en page
  **adapte** cette feuille depuis sa propre page, et retrouve celle de son
  format d'un bouton (voir « Registres de Réglages : trames et formats »).

### Trames livrées par défaut

L'outil arrive avec **44 trames et 6 feuilles de style** (`trames-defaut.js`),
repris des trames de l'établissement et **adaptés à chaque procédure** : chaque
trame déclare le **régime** qu'elle vise (`Public` : usagers,
enseignants-chercheurs, ou les deux), la **tutelle** (ministère chargé de
l'enseignement supérieur, ministère chargé de l'agriculture), le **type de
section** (établissement, école interne, section disciplinaire académique) —
`Toutes` valant pour tous — **et** son **auteur** et son **destinataire** (voir
« Auteur et destinataire d'un document »). Une trame n'est donc proposée qu'aux
sections auxquelles elle s'applique : une lettre de saisine agricole ne s'affiche
pas dans une section d'établissement, et les trames de l'article R.811-40,
réservées aux sections compétentes à l'égard des usagers, n'apparaissent pas pour
les enseignants-chercheurs. Deux trames portant le même nom mais une procédure
différente sont donc normales : ce sont deux textes distincts.

Les **6 feuilles de style** sont celles des six formats livrés (`Courrier`,
`Attestation`, `Rapport d'instruction`, `Ordonnance du président de la section
disciplinaire`, `Ordonnance du président de la formation de jugement`, `Décision
de la formation de jugement`) : chacune porte son document complet — chapeau,
emplacement `{{Corps}}`, signature et pied de page répété. Le **corps** des 44
trames, lui, ne contient aucune balise de mise en page : c'est la feuille de son
format qui les apporte toutes. La **signature** est de ces éléments qu'apporte la
feuille, et **jamais le corps** : une ordonnance est signée par le président de
l'organe qui l'ordonne, une décision de la formation de jugement par le
**président de la formation** et le **secrétaire** — les deux, côte à côte.

**Installer, rattraper, aligner.** Les trames, formats, catalogues et seuils
livrés sont posés dans une base neuve. Une base déjà installée reçoit les
éléments **manquants** par « Installer les trames par défaut » (Réglages ›
Trames) et « Aligner les catalogues sur les textes » (Réglages › Catalogues et
délais). Une **empreinte des contenus livrés** (NC-0005) permet en outre de
**signaler** à l'administrateur qu'un contenu a évolué depuis son installation :
Réglages › Données affiche alors « Contenus livrés plus récents que cette base »,
et **« Aligner sur les contenus livrés »** ajoute ce qui manque et remet
d'aplomb le format, l'auteur et le destinataire des trames livrées — **sans
jamais toucher au texte de vos trames ni à vos propres lignes**. L'avis, une
fois le geste fait ou écarté, ne revient qu'à la prochaine évolution des
contenus (`contenus.js`).

Un **titre**, dans ces modèles, est un paragraphe — jamais une balise
`<h1>`–`<h6>`. Sa taille est écrite en clair (`font-size`, en points), prise dans
l'échelle du menu « Taille » de la barre d'outils, sa couleur dans la palette,
son alignement en style en ligne, et son gras en `<strong>` : tout ce qui fait un
titre se voit et se change avec les outils de l'auteur. Une balise de titre,
elle, tiendrait sa taille de la charte graphique — que la barre d'outils ne
montre pas —, et l'auteur ne pourrait ni la connaître ni la corriger : c'est ce
qui faisait un en-tête de service d'une fois et demie le corps du texte. Les
feuilles livrées portent donc **14 pt** pour un titre de document (l'en-tête de
service, le « DÉCIDE » d'une décision, le « ORDONNE » d'une ordonnance, le titre d'un rapport) et **12 pt**, la
taille du corps, pour un titre de plan. Une base antérieure reçoit la même
reprise au chargement (`migrerTitres`, schema.js), à partir des formes anciennes
décrites par `TITRES_LIVRES` (`trames-defaut.js`).

Les **trois formats d'acte rendu** répondent à une distinction du droit, et non à
une commodité de rangement : la **section disciplinaire** est l'organe lui-même
— organe administratif lorsqu'elle statue à l'égard des usagers, juridiction
lorsqu'elle statue à l'égard des enseignants-chercheurs —, et la **commission de
discipline** en est la chambre, sa formation de jugement. Le président de l'une
et celui de l'autre ne se confondent pas toujours : le président de la section
compose la formation, remplace un membre empêché (R.811-21), désigne les
rapporteurs ou la commission d'instruction (R.712-32) ; le président de la
commission, lui, fixe la date de la séance (R.811-30), ordonne un complément
d'instruction, requalifie les motifs. Le président ne « décide » pas : il
**ordonne**, et ses actes sont donc des **ordonnances** — d'où les deux formats
« Ordonnance du président de la section disciplinaire » et « Ordonnance du
président de la formation de jugement », dont le dispositif se lit **ORDONNE**.
Seule la **décision de la formation de jugement** est une décision : elle peut
trancher le fond, et son dispositif se lit **DÉCIDE** — et la constitution de la
formation de jugement, parce qu'elle est l'œuvre du président de la section et
non de la formation elle-même, est une **ordonnance** (trame livrée n° 35, que
`migrerOrdonnances` range avec les ordonnances d'une base antérieure).

Les **ordonnances** portent leurs **visas** dans la feuille de leur format : le
document s'ouvre par la formule de l'organe qui ordonne — « Le président de la
section disciplinaire, », « Le président de la commission de discipline, » —,
puis « Vu le code de l'éducation ; », le code rural et de la pêche maritime dans
un établissement qui en relève, et la saisine de la section, datée et dirigée
contre le mis en cause. Le corps de ces trames commence donc au raisonnement —
« Considérant ce qui suit : » — et non à l'ouverture. Une **décision de la
formation de jugement**, elle, garde ses visas dans son corps, où ils suivent
les circonstances de l'audience. Les variables `{f_ouverture}`,
`{date_de_saisine}` et `{visa_code_rural}` sont calculées par le rendu (voir
`render.js`) : le viseur du code rural ne s'écrit que dans un établissement
relevant du ministère chargé de l'agriculture.

Les **lettres de notification** ne portent, elles, que sur les **décisions des
formations de jugement** : une ordonnance est un **acte préparatoire**,
insusceptible de recours — aucun délai ne court contre elle, et les contrôles de
régularité signalent une lettre préparée sans décision, comme un recours formé
contre une décision qui n'en ouvre pas. **Seule la décision qui prononce une
sanction ou l'abandon des poursuites peut être contestée** (voir « Décision
définitive et décisions avant dire droit ») : ni une décision avant dire droit,
ni un classement, ni une relaxe, ni une ordonnance n'est susceptible de recours.
La voie de recours suit le public : le recours se forme devant le **tribunal
administratif** compétent dans le ressort duquel se trouve le siège de
l'établissement pour un **usager**, et devant le **CNESER**, ou devant le
**CNESERAAV** — Conseil national de l'enseignement supérieur et de la recherche
agricole, alimentaire et vétérinaire — lorsque l'**enseignant-chercheur**
relève d'un établissement d'enseignement supérieur agricole (voir
`procedure.js` : `juridictionRecours`).

Un document d'**ordonnance** ne se présente donc **jamais comme une décision**
(voir « Décision définitive et décisions avant dire droit », plus bas) : son
espace de rédaction ne lie aucune décision, n'affiche pas le panneau de décision
et ne propose pas, dans sa palette, les balises `{{Decision}}…` — l'ordonnance
n'en rédige aucune. Les paramètres disent, à leur place, ce qu'elle est : un acte
préparatoire, qui règle la marche de l'instance sans trancher le fond.

Le **rapport d'instruction** est une pièce comme une autre : il se produit avec
la trame livrée du format « Rapport d'instruction » — une par procédure, signée
par le **rapporteur** devant les sections d'usagers, par la **commission
d'instruction** devant celles d'enseignants-chercheurs. Il n'est donc plus un
champ de l'affaire ; les deux colonnes d'origine (`Rapport_d_instruction` et sa
date) ne sont plus proposées, et l'onglet « Documents » d'une affaire propose de
reprendre dans un document le texte qu'elles portent encore (voir « Le rapport
d'instruction est un document »).

Les trames sont **proposées dès la première installation** : sur une base locale
vide comme dans un document Grist neuf, elles sont installées automatiquement.
L'installation a lieu **après l'identification** de la personne : le magasin
refuse toute écriture tant que le rôle n'est pas connu, et l'appel placé plus tôt
retombait sans rien faire — le document restait sans trame, en silence. Sur un
document installé avant leur ajout, Réglages › Trames propose
**« Installer les trames par défaut »** : le rapprochement se fait sur le nom et
la procédure, rien n'est dupliqué, et les trames déjà modifiées ne sont pas
touchées. Le commentaire du fichier `trames-defaut.js` décrit la génération, et
les trames d'origine (nettoyées des caractères invisibles et des paragraphes
d'espacement de l'ancien tableur) sont conservées avec leur identifiant.

Les colonnes qui portent ce filtrage (`Trames.Public`, `Trames.Tutelle`,
`Trames.Type_de_section`) se règlent dans Réglages › Trames, comme le reste de
la trame, de même que son **auteur** et son **destinataire** ; elles sont
indépendantes du **format** (la feuille de style), qui commande l'en-tête, la
signature et le pied de page.

### Le rapport d'instruction est un document

Le rapport d'instruction **n'est pas un champ de l'affaire** : c'est une
**pièce**, au même titre qu'un courrier ou qu'une décision. Il se produit comme
un document, avec sa propre date et son propre texte, à partir de la trame
livrée du format « Rapport d'instruction » — une par procédure :

 - **« Rapport d'instruction »**, signé par le **rapporteur** (procédure des
   usagers, art. R.811-29 du code de l'éducation) ;
 - **« Rapport d'instruction — commission d'instruction »**, signé par la
   **commission d'instruction** (enseignants-chercheurs, art. R.712-33).

L'auteur de la trame est la qualité qui signe (`Rapporteur`, ou `Commission
d'instruction`) : `redaction.js` la résout sur les intervenants de l'affaire —
le rapporteur désigné, et le second membre de la commission d'instruction ou le
rapporteur adjoint selon la procédure (voir « Auteur et destinataire d'un
document »). Un rapport sans rapporteur désigné ne montre pas de nom : rien n'y
est inventé.

Les colonnes `Affaires.Rapport_d_instruction` et
`Affaires.Date_du_rapport_d_instruction` ne sont plus proposées à la saisie
(`ancien: true` dans `schema.js`) : elles ne figurent ni dans la fiche de
l'affaire, ni dans l'export tabulaire. Elles ne sont pour autant **pas
supprimées** — un document antérieur peut les porter — et l'onglet
« Documents » d'une affaire propose de **reprendre** leur texte dans un
document (« Reprendre ce texte dans un document »). La reprise est un geste de
la personne, jamais automatique : créer la pièce au chargement d'une base
écrirait des lignes que le document Grist ne connaîtrait pas. Une fois le
document créé, les deux colonnes sont vidées, et le panneau disparaît. La
colonne calculée `Affaires.Composition_de_l_instruction` (rapporteur, adjoint ou
second membre) évite de nommer l'instruction à la main dans le rapport.

### L'échéance d'instruction

L'instruction d'une affaire dure un temps **compté**, et ce terme se suit. Le
délai court à compter de l'**acte qui ouvre l'instruction**, non de la saisine :

 - devant une section compétente à l'égard des **usagers**, **deux mois** à
   compter de la **décision de désignation des rapporteurs** ;
 - devant une section d'**enseignants-chercheurs**, **quatre mois** à compter de
   la **décision de désignation de la commission d'instruction**.

Une trame déclare porter cet acte — `Trames.Ouvre_l_instruction` : les trames
livrées 9, 31 et 36, soit la désignation des rapporteurs de chaque code et celle
de la commission d'instruction —, et c'est la **date du document** produit avec
elle qui fait courir le délai (`ouvertureInstruction`, `formulas.js`). À défaut
de pièce produite, la fiche du rapporteur en tient lieu
(`Intervenants.Date_de_designation`) ; sans désignation connue, l'instruction
n'est pas ouverte, et le bandeau le dit plutôt que de compter depuis la saisine.
Un document d'instruction peut en outre porter lui-même une **date butoir
d'instruction**, et c'est alors **elle qui vaut** : le terme que l'acte fixe
prime sur le délai de la procédure, qu'il l'avance ou qu'il le recule.

Ces délais viennent de `procedure.js` (`instruction.delaiMois`,
`delaiDepuis` et `delaiDesignation`), sauf si l'établissement les règle
autrement : `Parametres › delai_instruction_mois` l'emporte dès qu'il porte une
valeur supérieure à zéro (`delaiInstruction`, `formulas.js`).

**La date butoir d'instruction prime.** Deux sources peuvent fixer le terme, et
la **date butoir d'instruction** l'emporte sur l'échéance calculée de la
procédure, qu'elle avance ou recule le terme (`butoirInstruction`,
`formulas.js`) :

 - la **date butoir d'instruction** portée par un **document relatif à
   l'instruction** (`Generateur.Date_butoir_instruction`) — un complément ou un
   supplément d'instruction, une désignation des rapporteurs, le rapport
   lui-même. Une trame déclare qu'elle touche à l'instruction
   (`Trames.Concerne_l_instruction` : les trames livrées 9, 10, 13, 31, 36, 43
   et 44), et le champ apparaît alors à la rédaction du document ;
 - la **date butoir d'instruction** d'une **décision ultérieure** qui reporte le
   terme (`Decisions.Date_butoir_instruction`), saisie dans la décision avant
   dire droit — à l'onglet « Décision » d'une affaire, dans l'atelier de
   rédaction, ou dans le panneau de la décision d'un document.

Entre plusieurs dates butoirs, **la plus lointaine** est celle en vigueur : un
acte postérieur reporte le terme. L'échéance de la procédure ne vaut qu'**à
défaut** d'acte, et c'est alors elle qu'« Instruction à clore le » reprend —
`Date_butoir_instruction_initiale` la donne dans tous les cas, ce qui permet de
voir si c'est un acte qui a fixé le terme.

Pour une affaire **jointe**, les documents et les décisions de l'**affaire de
tête** comptent aussi : la décision qui prolonge l'instruction est rendue une
fois pour le groupe. L'échéance n'est calculée que lorsqu'il y a une instruction
à conduire : la voie de l'**article R.811-40** en est une alternative, une
affaire **close** ou **jugée au fond** n'en porte plus, et tant que la
**désignation** n'a pas ouvert l'instruction, l'outil annonce « Instruction non
ouverte » plutôt que de compter depuis la saisine. Les colonnes calculées
de l'affaire en découlent — `Date_butoir_instruction` (« Instruction à clore
le »), `Date_butoir_instruction_initiale`, `Instruction_prolongee` et
`Jours_restants_instruction` — et se lisent dans les trames
(`{{Affaire}}.Date_butoir_instruction.date(@long)`). `migrerInstruction`
(schema.js) marque les trames livrées concernées et reprend, au chargement,
l'ancienne `Date_libre` des documents d'instruction dans cette date butoir, et
`migrerOuverture` y marque les trames livrées qui portent l'acte de désignation.

**Mise en avant.** Le bandeau `echeanceInstruction()` (`views/common.js`) dit la
**date butoir d'instruction** — celle que l'acte fixe, prioritaire sur l'échéance
de la procédure —, les jours restants (« dans 12 jour(s) », « dépassée de 3
jour(s) »), **ce qui l'a fixée** — la règle de la procédure, ou le document / la
décision qui a fixé ou reporté le terme, avec un lien vers la pièce (étiquettes
« Prolongée » et « Date butoir fixée par un acte ») — et **d'où le délai se
décompte** : la date de la décision de désignation, avec un lien vers elle,
lorsque c'est la procédure qui s'applique. Il
se pose en tête de la
**synthèse** d'une affaire, dans son onglet **Documents** (forme compacte), à la
rédaction d'un document qui touche à l'instruction ou qui rédige la décision
avant dire droit, et en tête de l'**atelier** d'une décision interlocutoire. Il
annonce encore que l'instruction n'est **pas ouverte** tant que la désignation
manque, avec le geste qui mène aux documents de l'affaire. Un
quatrième **contrôle de régularité** le reprend (« Instruction à clore »,
`regimes.js`) : en alerte quand le terme est dépassé, en information dans les
quinze derniers jours — et « Ouverture de l'instruction » comme un manque quand
l'affaire est déjà instruite sans acte de désignation.

Là où l'affaire se lit **en liste**, en revanche, le bandeau n'a pas la place de
se déployer : l'étiquette `clotureTag()` (« Clôture le 12 septembre 2026 », au ton
de ce qu'il reste à courir) et un **filet coloré à gauche de la ligne** marquent
la clôture d'instruction dans la **liste maîtresse** des affaires (le ton du
filet suit celui de l'étiquette), et un **panneau « Clôtures d'instruction »**
en tête du tableau de bord range les affaires dont le terme est fixé, de la plus
proche échéance à la plus lointaine, avec les jours restants. Les deux ne
s'affichent que lorsqu'une **date est notée** — la date de la procédure, ou celle
de la pièce qui l'a reportée. Le **calendrier** porte enfin l'échéance
(« Instruction à
clore — n° … ») et l'export `.ics` la reprend. La date butoir d'un document se
lit aussi en pastille sur la ligne de la pièce, dans les listes de documents.

### Catalogues livrés par défaut

L'outil arrive avec **22 sanctions** et **19 motifs** (`regimes.js`,
`SANCTIONS_PAR_DEFAUT` et `MOTIFS_PAR_DEFAUT`), repris des textes applicables et
répartis par **régime** (`Public`) et par **tutelle** — chaque entrée porte son
**texte de référence**, et les sanctions leur durée maximale et la possibilité
d'un sursis. Le catalogue est donc un point de départ juridiquement exact, que
l'établissement adapte ensuite ; rien n'y est inventé : chaque libellé vient
d'un article. Dans le tableau, la colonne « Texte de référence » est la plus
large, et une citation plus longue que son champ se lit en entier dans
l'infobulle du champ — comme dans tout tableau dense, la case « Sursis » n'y
montre que sa case à cocher, l'en-tête de colonne la nommant.

**Sanctions.** Pour les **usagers**, l'échelle de l'article R.811-13-1 du code
de l'éducation : avertissement, blâme, mesure de responsabilisation (l'action
consistant à accomplir un travail d'intérêt collectif, quarante heures au plus),
exclusion de l'établissement (cinq ans au plus, sursis possible si elle n'excède
pas deux ans), exclusion définitive de l'établissement, exclusion de tout
établissement public d'enseignement supérieur (cinq ans au plus), exclusion
définitive de tous — et, à titre d'alternative à une exclusion, la mesure
définie au III du même article. Les sanctions de la **fraude dans un
établissement privé** (R.811-13-2 : interdiction de subir tout examen,
interdiction de prendre toute inscription, interdiction définitive) ne sont
proposées qu'à la tutelle de l'enseignement supérieur : le code rural les écarte
pour les établissements agricoles (article R.812-24-1). Pour les
**enseignants-chercheurs et personnels enseignants**, l'échelle de l'article
L.952-8 (blâme — il n'y a pas d'avertissement —, retard à l'avancement
d'échelon, abaissement d'échelon, interdiction d'accéder à une classe, grade ou
corps supérieurs, interdiction d'exercer avec privation de traitement, mise à la
retraite d'office, révocation) et l'interdiction accessoire du dernier alinéa ;
pour les **autres enseignants**, celle de l'article L.952-9 (rappel à l'ordre,
interruption de fonctions, exclusion de l'établissement, interdiction d'exercer
dans tout établissement public).

**Motifs.** Les manquements des usagers (article R.811-11 du code de
l'éducation, article R.812-24-2 du code rural — ce dernier ajoutant l'atteinte
« à la réputation » de l'établissement), et, pour les personnels, les
manquements aux obligations de service et les **devoirs des agents publics**
(dignité, impartialité, intégrité, probité, neutralité et laïcité, intégralité
de l'activité professionnelle, prévention des conflits d'intérêts, secret et
discrétion professionnels — articles L.121-1 à L.121-7 du code général de la
fonction publique). Un motif partagé par les deux régimes — violences,
harcèlement, discrimination — porte la double référence.

**Effacement.** Le terme d'une sanction tient compte de l'effacement au bout de
trois ans : avertissement, blâme et mesure de responsabilisation pour les
usagers (R.811-13-1, 1° à 3°) ; blâme et rappel à l'ordre pour les personnels
(R.712-42).

**Aligner un catalogue existant.** Un document installé avant ces valeurs — ou
dont l'établissement a repris l'ancien catalogue — n'est **jamais modifié
silencieusement** : Réglages › Catalogues et délais affiche, s'il y a lieu, un
encadré « Catalogues livrés par défaut » et un bouton **« Aligner sur les
textes »** qui annonce d'abord ce qu'il ferait. Le rapprochement se fait sur le
libellé — les anciens libellés connus figurent dans `RENOMMAGES_CATALOGUE`
(« Fraude ou tentative de fraude à un examen » devient « Fraude ou tentative de
fraude », « Perturbation du fonctionnement de l'établissement » devient
« Atteinte à l'ordre ou au bon fonctionnement de l'établissement »). L'alignement
**ajoute** les entrées absentes et met à jour celles qu'il reconnaît — il ne
supprime jamais rien et ne touche ni aux lignes propres à l'établissement, ni
aux descriptions que celui-ci a rédigées.

### Export des listes et des données (CSV, Excel)

Tout ce que l'outil affiche sous forme de liste se télécharge dans un tableur.
Un même bloc de deux boutons — **« CSV »** et **« Excel (.xlsx) »** — se pose
dans l'en-tête de la page, ou dans celui du panneau qui porte la liste :

| Où | Ce qui part |
| --- | --- |
| Affaires | La liste filtrée (recherche, état, section, périmètre de visibilité), dans son ordre. |
| Décisions | Les lignes du registre affiché, filtres compris. |
| Calendrier › Séances | Les séances de la section choisie. |
| Documents | Les documents des dossiers affichés. |
| Affaires › Commission, Personnes, Décision, Documents | Les intervenants, les personnes du dossier, les recours, les documents **de cette affaire**. |
| Attribution des affaires | Les affaires à répartir, avec le secrétaire de chacune. |
| Calendrier › Échéances | Les **échéances** en clair (liste calculée, voir `LISTES_EXPORT` dans `app.js`) — la grille du mois les tronque, le fichier les emporte toutes. |
| Tableau de bord › Rapport d'activité | Les **tableaux d'indicateurs** de la période — l'un après l'autre, ou tous ensemble (« Tous les tableaux » : un classeur d'une feuille par tableau, ou une archive d'un CSV par tableau). Ses **graphiques** se téléchargent en images PNG (voir « Rapport d'activité et graphiques »). |
| Réglages (sections, personnes, secrétaires, destinataires, catalogues, trames, types) | La liste ou le catalogue affiché. |
| Réglages › Données | La base entière : un classeur d'une feuille par table, une archive d'un fichier CSV par table, ou une table seule (colonne « Export » du tableau des décomptes). |

Trois règles gouvernent ces exports :

- **L'export suit l'écran.** Les vues passent au bouton les lignes **déjà
  sélectionnées et ordonnées** (`data-export-ids`, ou la table entière pour les
  raccourcis de Réglages › Données) : périmètre de visibilité, recherche, filtres
  et tri sont donc respectés sans que le module d'export ait à les connaître. Une
  liste vide n'affiche pas de bouton — un export sans ligne désignée emporterait
  la table entière, ce que `lignesAEporter` (`app.js`) évite.
- **Les colonnes sont écrites, pas devinées.** `COLONNES_EXPORT`
  (`export-table.js`) donne, table par table, les colonnes du registre — les
  identifiants de liaison et les textes longs (corps de trame, contenu d'un
  document) en sont écartés ; une table absente de cette table de correspondance
  est exportée avec toutes ses colonnes. Une **référence** donne le libellé de ce
  qu'elle désigne (nom de la personne mise en cause, intitulé de la section,
  numéro et nom de l'affaire) et une **colonne calculée** sa valeur : un tableur
  ne saurait rien faire d'un identifiant interne. Les dates sortent en ISO
  (`AAAA-MM-JJ`), les booléens en « Oui » / « Non », et les nombres restent des
  nombres dans le classeur (pour que le tableur puisse les sommer).
- **Seuls les exports de la base font exception** : Réglages › Données emporte
  **toutes** les colonnes de **toutes** les tables — c'est un relevé complet,
  destiné à l'archivage, non un registre. L'export **JSON** reste par ailleurs la
  sauvegarde réimportable à l'identique.

Le CSV porte un point-virgule séparateur et une marque d'ordre des octets
(Excel français l'ouvre directement) ; les champs ne sont mis entre guillemets
que si nécessaire. Aucun de ces exports n'écrit dans la base : ils sont classés
en lecture seule (`READ_ONLY_ACTIONS`), donc disponibles à un visiteur.

### Rapport d'activité et graphiques

Le **tableau de bord** a deux volets, séparés par une sous-navigation sous le
titre : la **Synthèse** — « où en est-on ? », l'activité du moment — et le
**Rapport d'activité** — « qu'a fait la section cette année ? », une pièce qu'on
présente, qu'on imprime et qu'on annexe. Le lien d'accueil de l'en-tête ramène à
la synthèse (`#tableau-de-bord`), et chaque volet a sa propre adresse
(`#tableau-de-bord/synthese`, `#tableau-de-bord/rapport`).

Le rapport se lit **par période** : un sélecteur en tête de page choisit l'année
— la dernière connue par défaut — ou « toutes les années ». Le choix est
mémorisé dans le navigateur, comme les autres filtres (`filters.rapportAnnee`).
Deux règles de comptage, écrites dans `rapport.js` :

- une **affaire** compte à sa **date de saisine**, une **décision** à sa **date
de délibéré** (à défaut, de notification). Une affaire reçue en 2025 et jugée en
2026 est donc une affaire de 2025 *et* une décision de 2026 ;
- un **délai de traitement** se lit sur chaque décision — le temps écoulé entre
la saisine de son affaire et sa notification (`Decisions.Delai_de_traitement`,
voir `formulas.js`) —, et se résume en moyenne et en médiane.

Trois formes, une même matière (`rapportActivite`, `rapport.js`) :

| Forme | Contenu | Export |
| --- | --- | --- |
| **Chiffres clés** | Huit cartes : affaires reçues, décisions rendues, délai moyen et médian, taux de clôture, affaires en cours, séances et affaires inscrites au rôle, recours. | repris dans le rapport imprimé et dans le tableau « Chiffres clés » |
| **Graphiques** | Camemberts (répartitions), anneaux (sanctions par groupe), barres (classements) et colonnes (l'activité mois par mois, ou année par année pour « toutes les années »). | PNG, un par graphique ou tous dans une archive (`zipStore`) |
| **Tableaux d'indicateurs** | Les mêmes chiffres, vérifiables ligne à ligne, groupés par domaine (Activité, Affaires reçues, Décisions, Séances, Recours). | CSV ou Excel, un par tableau ou tous ensemble |

`graphiques.js` dessine les graphiques sur un **canevas** et les rend sous forme
d'**images** : le même dessin se voit à l'écran, s'imprime, entre dans le rapport
PDF, Word ou OpenDocument, et se télécharge en PNG. Deux rendus, une même donnée :

- à l'écran, le fond est **transparent** et les textes prennent les couleurs du
thème (clair ou sombre) — le graphique se pose dans sa carte comme du texte ;
- à l'impression et à l'export PNG (`pourImpression: true`), le fond est **blanc**
  et les textes noirs : un graphique exporté part dans un document, et un document
  s'imprime sur du papier blanc. Un graphique pris depuis le thème sombre serait
  sinon illisible une fois collé.

Les couleurs des séries sont **fixes** (`PALETTE`), choisies pour tenir sur le
blanc comme sur le fond sombre, et pour se distinguer en niveaux de gris comme en
couleur. Au-delà d'un certain nombre de séries, les plus petites sont regroupées
sous un poste « Autres » — un camembert à quinze parts ne se lit pas. Une série
**ordonnée** (les douze mois d'une année) garde ses cases vides, alors qu'une
répartition écarte les parts nulles : un mois sans affaire est une donnée, une
part nulle n'existe pas.

Le **rapport imprimé** (`rapportActiviteHtml`, `print.js`) met en page les mêmes
chiffres : en-tête de la section, titre, tableau des chiffres clés, graphiques en
images (titre dans le dessin), puis les tableaux d'indicateurs. Il s'imprime par
« Imprimer le rapport » ou s'exporte en PDF, Word ou OpenDocument (`scope:
\"rapport\"` dans `exportTarget`, `app.js`). Rien de tout cela n'écrit dans la
base : ces actions sont classées en lecture seule (`READ_ONLY_ACTIONS`).

Un indicateur **sans donnée n'est pas affiché**, plutôt qu'un zéro qui ferait
croire à une absence d'activité ; et le **périmètre des affaires** s'applique
comme partout : le rapport d'un secrétaire est celui de ses affaires.

### Composition d'une section par CSV

Remplir une section, c'est saisir huit à vingt fiches de membres, et le collège
de chacun doit correspondre à celui que les textes prévoient. Deux boutons de
Réglages › Sections et membres évitent la ressaisie aveugle :

- **« Modèle CSV »** produit un fichier **une ligne par siège attendu** par la
  composition réglementaire de la section, avec le **collège** et le **rôle**
  déjà remplis (la première ligne est le président) : il ne reste qu'à écrire
  les noms. Le fichier porte un point-virgule séparateur et une marque d'ordre
  des octets, pour qu'Excel l'ouvre correctement en français.
- **« Exporter les membres »** produit le même format, rempli avec les membres
  actuellement rattachés à la section : le fichier peut être corrigé dans un
  tableur, puis réimporté. **« Excel (.xlsx) »**, juste à côté, télécharge la
  même composition dans un classeur, avec **exactement les colonnes du modèle
  CSV** : un classeur rempli de la même façon se réimporte donc au même format.
- **« Importer un CSV »** complète la composition : les membres déjà présents
  sont reconnus **par courriel**, à défaut par prénom et nom, et mis à jour ;
  les autres sont créés. Une case vide du fichier **n'efface jamais** une donnée
  déjà saisie, et rien n'est supprimé. Le fichier est analysé avant toute
  écriture : les genres, collèges, rôles et dates invalides sont annoncés ligne
  par ligne, et l'import attend confirmation.

### Origine d'une décision : sa composante, ou sa section

La page Décisions range ses indicateurs par **origine**. L'origine d'une affaire
est sa `Composante` lorsque l'établissement en suit une ; sinon, c'est sa
**section disciplinaire** : une section qui n'a pas de composante est donc
comptée pour elle-même, et aucune affaire ne disparaît des indicateurs (voir
`origineAffaire` dans `src/views/common.js`).

Deux conséquences pratiques :

- l'**indicateur** (« Composantes concernées » ou, à défaut, « Sections
  concernées ») est toujours affiché, même quand aucune composante n'est suivie ;
- le **filtre**, la **colonne du registre** et le **graphique** ne s'affichent
  que s'il y a plusieurs origines à comparer — un axe de comparaison à une seule
  valeur n'apprend rien. Leur intitulé suit ce qu'ils montrent : « Composante »
  dès qu'une composante réelle est suivie, « Section » sinon.

Le libellé d'une section dans cet axe est son **nom de structure**, complété du
public (« Université de Valmont (usagers) ») quand une même structure porte
plusieurs sections ; à défaut, l'intitulé complet de la section.

### Décision définitive et décisions avant dire droit

Une affaire connaît **une seule décision définitive** : celle qui tranche le
fond (une sanction du catalogue, ou une issue de procédure comme l'abandon des
poursuites). Les mesures qui ne règlent que la marche de l'instance — report de
l'examen, supplément d'instruction, expertise, audition de témoins — se saisissent
avec la nature **« Décision interlocutoire »** ; elles ne comptent pas comme
décision définitive, et peuvent être plusieurs.

Cette règle structure l'outil :

- l'onglet « Décision » d'une affaire distingue les deux, et refuse d'enregistrer
  une seconde décision définitive. C'est aussi de là qu'on la **rédige** :
  « Rédiger la décision » ouvre l'atelier, en créant le texte s'il n'existe pas
  encore (`rediger-decision`, `app.js` ; voir « Rédaction d'une décision ») ;
- un contrôle de régularité signale toute affaire qui en compterait plusieurs ;
- une décision avant dire droit est un **acte préparatoire** : elle n'est **pas
  susceptible de recours** — pas plus qu'un classement ou une relaxe. **Seule
  une décision qui prononce une sanction ou l'abandon des poursuites peut être
  contestée** (`estSusceptibleDeRecours`, schema.js, prédicat unique). Le délai
  de recours (`Recours_limite_le`) reste donc vide dès qu'aucun recours n'est
  ouvert, un contrôle signale tout recours formé contre une telle décision, et
  l'article de recours ne lui est pas proposé dans l'atelier ;
- la trame **« Décision définitive »** (`Decision_definitive` sur la trame) ne
  reprend pas la décision dans son propre texte : ses champs `{{Decision}}.…`
  sont ceux de l'affaire. Compléter la décision depuis le document ou depuis
  l'onglet revient au même — **une seule saisie**, deux chemins. Tant qu'aucune
  décision définitive n'existe, le document le dit et propose de l'enregistrer ;
- seule une trame de format **« Décision »** rédige une décision : le document
  s'y rattache (`Decision_liee`), et la liste ne propose que des décisions de
  **même nature** que la trame — la définition du fond pour celle qui porte le
  jugement, une décision avant dire droit pour les autres. Le bouton
  d'enregistrement suit la même règle : il crée une décision définitive depuis
  la trame qui tranche le fond, une décision avant dire droit sinon
  (`doc-decision-creer`, app.js) ;
- une **ordonnance** — l'acte d'un président, de la section ou de la formation
  de jugement — **n'est pas une décision** : le document ne se lie à aucune
  (`Decision_liee` reste vide), sa palette de variables ne propose pas les
  balises `{{Decision}}…`, et le panneau de décision ne s'y affiche pas. Une
  base antérieure est reprise au chargement (`migrerActesRendus`, schema.js),
  qui retire le lien d'une ordonnance.

Le champ qui porte cette référence est la colonne calculée `Generateur.Decision`
(voir § 4) : elle vaut la décision définitive de l'affaire, et rien tant que le
fond n'est pas tranché.

### Registre des actes

Chaque décision peut recevoir un **numéro d'acte**
(`Decisions.Numero_acte`), attribué par le bouton « Numéroter les actes » de la
page Décisions : une séquence **par section et par année** (`UDA-2026-001`,
`UVE-2026-002`…), dans l'ordre chronologique des délibérés. Le rang attribué est
le **plus grand déjà utilisé, plus un** — un numéro **n'est jamais rejoué**,
même après la suppression de l'acte : la série reste vérifiable. Chaque
attribution est inscrite au `Journal`, le numéro figure dans le registre et à la
colonne « N° d'acte » de la page Décisions, et le bouton « Exporter le registre
(CSV) » produit la liste des actes numérotés. Un acte sans numéro est signalé :
il ne peut pas être cité par son registre.

### Références juridiques : ce que le service doit vérifier

Un acte qui part à un usager ne cite pas n'importe quoi. Le répertoire des
considérants porte des **sources** — textes et décisions —, et l'outil les
réunit pour qu'elles puissent être visées : Réglages › Catalogues et délais ›
onglet **Références** (NC-0019).

La page liste chaque source citée avec les considérants qui s'y appuient, et
signale :

- les sources **non retrouvables** — une identité réduite à « M. X », à des
  initiales ou à « anonyme » ne se vérifie pas, et ne doit pas sortir dans un
  acte. Les considérants livrés sont tenus à cette règle : aucun n'en porte ;
- les **affirmations à faire viser** — un considérant marqué `aVerifier`, qu'une
  source ne vient pas étayer.

La **date de la dernière vérification** est un seuil
(`references_verifiees_le`) : le bouton « Enregistrer la vérification du jour »
l'y porte, et l'opération est journalisée. Tant qu'aucune date n'est
enregistrée, la page le dit — l'outil ne prétend jamais qu'une référence a été
vérifiée. La revue elle-même appartient au service juridique : l'outil en
outille la trace, il ne fait pas le droit à sa place.

### Jonction d'affaires

Plusieurs affaires — chacune avec **son numéro** et sa personne mise en cause —
peuvent être jugées par une **décision unique**. La jonction se fait depuis
l'onglet « Décision » d'une affaire, par le bouton **« Joindre une affaire… »**,
qui propose les affaires de la **même section** (une même formation les jugera)
qui ne sont encore jointes à aucune. L'affaire d'où l'on part devient l'**affaire
de tête** : c'est elle qui porte la décision commune, et c'est son numéro qui
identifie l'ensemble dans le registre des décisions.

Rien n'est fusionné, rien n'est recopié : chaque affaire garde son numéro, sa
personne mise en cause et ses propres documents — une notification part donc pour
chacune. La seule donnée nouvelle est une ligne dans la table `Jonctions`
(`Affaire_de_tete`, `Affaires_jointes`, `Date_de_la_jonction`, `Motif`,
`Observations`), à laquelle les colonnes calculées de `Affaires` se rattachent :
`Jonction`, `Affaire_de_tete` (nulle pour la tête elle-même), `Affaires_jointes`
(les numéros du groupe, tête comprise) et `Mises_en_cause_jointes` (les autres
personnes du groupe, avec leur numéro). Cette appartenance est ainsi **déduite**,
jamais stockée sur l'affaire : l'ensemble est cohérent de lui-même.

**C'est cette déduction qui rend l'opération réversible.** La décision reste une
décision ordinaire, portée par l'affaire de tête ; tout l'outil la lit par la
colonne `Generateur.Decision`, via `decisionDefinitive()` (`formulas.js`) : une
affaire jointe à une tête prend pour décision définitive celle de sa tête, sinon
la sienne. Registre des décisions, contrôles de régularité, calendrier et tableau
de bord suivent donc la jonction sans traitement particulier. Pour défaire la
jonction, trois gestes, sans jamais toucher à la décision :

- **Déjoindre cette affaire** (depuis une affaire jointe) — l'affaire quitte le
  groupe ; s'il ne reste qu'une affaire, la jonction se dissout d'elle-même ;
- **En faire l'affaire de tête** — la tête et cette affaire échangent leurs
  rôles : la décision commune suit la nouvelle tête ;
- **Défaire la jonction** — le groupe est dissous d'un coup.

Deux contrôles de régularité signalent l'anomalie : des affaires jointes relevant
de **sections différentes**, ou une affaire jointe portant **sa propre décision
définitive** en plus de la décision commune. Le rôle de séance et la liste
d'affaires imprimés marquent, sous le numéro, l'affaire de tête (« affaire de
tête ») et les affaires jointes (« jointe à … »).

À l'import, la table `Jonctions` est créée après `Affaires` (une jonction
s'appuie sur ses affaires) ; l'outil écarte à la lecture toute jonction dont
l'affaire de tête manque ou qui ne réunit plus qu'une affaire, et purge les
références mortes.

### Charte graphique et polices

L'outil est bâti sur le **Système de design de l'État**, dont le CSS est chargé
d'un CDN. Toutes les structures ne sont pourtant pas tenues de porter la charte
de l'État, et certaines n'ont pas le droit d'en afficher la marque. Deux
**chartes** sont donc proposées, réglées dans `Identite` (Réglages › Charte
graphique) et lues par `charte.js`, qui en est la source de vérité :

| Charte | Marque de l'État | Police | Bleu d'action |
| --- | --- | --- | --- |
| **Charte neutre** (défaut, valeur vide comprise) | aucune — le bloc-marque n'est pas écrit | **Public Sans** | bleu encre décalé (`#0b2886`) |
| **Charte de l'État** | bloc-marque « République Française » (en-tête et pied de page) | **Marianne** | ultramarine du DSFR (`#000091`) |

**La police de la charte neutre** est **Public Sans** (SIL Open Font License) :
une sans-serif humaniste contemporaine, dessinée pour les services publics
numériques — neutre, très lisible à l'écran comme sur le papier, et sans aucun
rapport avec la police de l'État. Elle est **servie depuis l'hébergement de
l'outil** (`FICHIERS_NEUTRE`, dans `charte.js`) et non depuis un service tiers :
la machine du rédacteur n'a rien à installer, et un même document s'affiche
pareil sous Windows, macOS et Linux — ce que Marianne ne peut pas promettre,
puisqu'elle n'est présente que si le DSFR a pu la charger. Neuf fichiers
(`woff2`, deux sous-ensembles *latin* et *latin-ext*, graisses 400/500/700 et
italiques) sont déclarés par `FACES_NEUTRE` : le navigateur ne télécharge que
ceux qu'un texte emploie réellement, si bien que la charte de l'État ne charge
rien du tout. Ils viennent de `@fontsource/public-sans@5.3.0`
(`files/public-sans-<latin|latin-ext>-<graisse>-<normal|italic>.woff2` sur
`cdn.jsdelivr.net`), téléchargés puis déposés sur l'hébergement de l'outil : les
adresses de `FICHIERS_NEUTRE` sont les seules à remplacer pour les refaire. Les `@font-face` sont posés dans la coquille par `appliquerCharte`
(et retirés avec la charte), et voyagent dans les documents rendus et les états
imprimés avec la règle de `cssPoliceDocument` — un document est rendu dans son
propre cadre, qui n'hérite de rien. Pour changer cette police : remplacer les
adresses de `FICHIERS_NEUTRE` et la pile de `PILE_NEUTRE`, à un seul endroit.

La charte neutre ne remplace **que** la marque, la police et le bleu d'action :
les composants et la mise en page restent ceux du DSFR — c'est une charte « à la
manière du DSFR », et non une autre interface. Le décalage du bleu est
volontairement discret (teinte 226 au lieu de 240, un peu moins saturé) : il
suffit à ce qu'une page de la charte neutre ne se confonde plus avec une page de
la charte de l'État. La valeur « Charte neutre » est le défaut : la charte de
l'État doit être **demandée**, et un document qui n'a jamais réglé la colonne
`Charte` (valeur vide) porte la charte neutre. Afficher la marque de l'État est
un acte : un document neuf n'en hérite pas, et une structure qui n'y a pas droit
n'a rien à faire pour en sortir.

**Le jeu d'exemple, lui, demande la charte de l'État** (`seed.js`, ligne
`Identite`) : il porte un logo d'opérateur — dont la place est, par définition,
à droite du bloc-marque —, et ses courriers doivent montrer l'en-tête complet.
Un jeu d'exemple laissé en charte neutre donnerait une démonstration amputée de
son identité : le bloc-marque disparaîtrait de l'en-tête, du pied de page et des
documents, et **une section sans logo n'aurait plus d'en-tête du tout** (voir
`enteteHtml` : sans bloc-marque et sans logo, il n'écrit rien). Le défaut du
*code* (valeur vide → charte neutre) et la demande du *jeu d'exemple* sont deux
choses différentes : la première est une doctrine, la seconde est un acte, et
c'est cet acte que la ligne `Identite` de `seed.js` doit conserver.

Ce que la charte change, et comment :

- **Coquille** — `app.js` (`render()`) appelle `appliquerCharte()`, qui pose la
  classe `app-charte-neutre` sur `<html>` et les `@font-face` de Public Sans
  dans l'en-tête. `styles.css` repose alors les
  sélecteurs que le DSFR emploie pour Marianne (`body`, `input`, `select`,
  `textarea`), avec le préfixe `html.` qui les rend plus spécifiques ; la même
  classe **redéfinit la gamme de jetons `--blue-france-*`** (thème clair et
  thème sombre), ce qui suffit à déplacer tout l'habillage — boutons, liens,
  onglets, cases, pastilles — puisque les jetons de décision du DSFR sont
  définis à partir de ces jetons-là. Les autres gammes (gris, vert, rouge,
  orange) ne changent pas : ce sont les couleurs de sens. Les
  éléments qui portent la marque de l'État sont **omis au rendu** plutôt que
  masqués en CSS : `ui.brandBlock({ marque: false })`, et le pied de page
  n'écrit pas son bloc `fr-logo` (le reste de la mention change aussi).
- **Documents** (courriers, décisions) — `computeDocumentParts` n'écrit plus le
  bloc-marque officiel ; la colonne `Marianne` d'une section n'est employée que
  si l'établissement y a mis **délibérément** une image — une adresse est un
  choix, son absence en est un. Deux règles CSS sont ajoutées **après** la
  feuille du DSFR et après
  `DOCUMENT_CSS`, dont elles reprennent les sélecteurs : à spécificité égale, la
  dernière décide. `cssPoliceDocument` porte la police réglée,
  `cssCharteDocument` le bleu d'action de la charte neutre (`BLEU_NEUTRE` —
  les couleurs de `DOCUMENT_CSS` sont écrites en clair, elles ne suivent pas les
  jetons de l'interface). Aucune des deux n'est écrite quand elle ne sert pas :
  le document de la charte de l'État reste celui d'avant, au caractère près.
- **États imprimés** (rôle de séance, liste d'affaires, `print.js`) — même
  traitement : en-tête sans marque, même règle de police.
- **Exports Word et OpenDocument** — ces formats ne savent pas exprimer une
  liste de polices de repli : `exportDocument()` reçoit donc un **nom unique**
  (`policeDocumentNom()`) — Arial pour la charte de l'État (Marianne n'est pas
  installée partout, et Word la remplacerait sans le dire), Public Sans pour la
  charte neutre —, ou le nom réglé. Le **PDF**, lui, **embarque** sa police : le
  fichier joint la famille que la charte a choisie (voir `pdf-fonts.js`), et son
  texte garde donc exactement la police de l'écran, sur n'importe quel poste.
  C'est la seule réserve de la charte
  neutre : son écran, son impression et son PDF sont exacts partout, mais un
  fichier Word ou OpenDocument ouvert sur un poste où Public Sans n'est pas
  installée en montrera une autre. Le réglage « Police des documents » est là
  pour cela — y indiquer une police que les destinataires ont suffit à ce que
  les fichiers soient fidèles partout.

**Le bloc-marque de l'en-tête.** Le composant `fr-logo` du DSFR existe en
plusieurs tailles ; l'en-tête d'un site public se contente du **petit** format
(`fr-logo--sm`, soit un tricolore de 33 px de large), où le dessin de la
Marianne n'est plus qu'une tache et où le libellé, à 12,6 px, s'empâte ;
le pied de page, lui, la porte en pleine taille (`fr-logo--lg`, 55 px de
tricolore et un libellé de 21 px dès 48em).

L'en-tête de l'outil reçoit le format **intermédiaire** du composant — celui du
bloc-marque du pied de page sur écran étroit (`tricolore de 44 × 18 px, devise
de 84 × 60 px, libellé de 16,8 px`), repris tel quel et **sans l'agrandissement
de 48em** : la marque a donc la même taille à toutes les largeurs. C'est le
format où le drapeau, la Marianne et la devise restent lisibles, tout en restant
dans l'ordre de grandeur du **logo de l'opérateur** posé juste à côté (≈ 3,5 rem) :
à la cote du pied de page sur grand écran (libellé de 21 px, une marque de 138 px
de haut), la marque écrasait ce logo de 56 px et l'en-tête ne se lisait plus que
comme une signature de l'État, le logo de l'organisme dans son ombre. La marque
du haut est un **repère**, celle du bas un **sceau** : elles n'ont pas à être de
même taille, et le pied de page garde donc la sienne, sans y toucher.

Seuls `font-size`, `::before` et `::after` sont repris : la marge négative du
composant, elle, reste celle de l'en-tête, qui annule exactement le rembourrage
de `.fr-header__logo`. La position de la devise en thème sombre est reposée
avec, car la règle du DSFR qui la déplace vise `.fr-header__logo` et garderait
les coordonnées du petit format (voir `styles.css`, « Bloc-marque de
l'État »).

**La police des documents** (colonne `Identite.Police_documents`) est réglée
pour tout l'outil : elle remplace la police de la charte dans les courriers, les
rôles de séance, les listes et les fichiers exportés. Un nom installé sur les
postes est attendu (« Times New Roman », « Garamond »…) ; une pile complète est
acceptée si elle contient une virgule (« Georgia, Times, serif »), et un nom qui
comporte une espace est cité pour la CSS. Laissée vide, elle suit la charte.

Ni l'une ni l'autre ne touche aux données : la charte et la police ne sont que
deux colonnes de la fiche `Identite`, et le rendu s'y conforme à chaque
affichage.

### Contacts d'une affaire : écrire aux intervenants

Une affaire réunit des gens qu'il faut pouvoir joindre sans les chercher : la
présidence de la section, celle de la commission, les membres, les rapporteurs,
le secrétariat. Le panneau **Contacts** de l'onglet « Synthèse » les rassemble
en **liens `mailto:`** — le geste le plus direct, et le seul qui ne demande ni
serveur, ni compte, ni configuration : le message s'ouvre dans le logiciel de
messagerie du poste, déjà adressé, avec l'affaire rappelée en objet
(`Dossier 26UV-1 — Maxime LEROY`).

| Bouton | À qui il écrit | D'où vient l'adresse |
| --- | --- | --- |
| Écrire au président de la section | les membres de la section dont le rôle est « Président » — « Vice-Président » quand la section est présidée par un vice-président (`Sections_disciplinaires.VP` ; le réglage propre à un document, lui, ne concerne que ce document — voir « Le signataire d'un courrier ») | `Membres.Email` |
| Écrire au président de la commission | les intervenants de rôle « Président de la formation » — absent quand la procédure n'a pas de commission (R.811-40) | `Intervenants.Email` |
| Écrire aux membres de la commission | **la commission entière** : son président, ses rapporteurs et ceux qui y siègent (`Membre de la formation`, `Membre de la commission d'instruction`, `Assesseur`…) — chaque adresse une seule fois | `Intervenants.Email` |
| Écrire aux rapporteurs | « Rapporteur » et « Rapporteur adjoint » | `Intervenants.Email` |
| Secrétariat de la section | l'adresse générique de la section | `Sections_disciplinaires.Email_de_contact` |

Chaque bouton porte le **nombre** de destinataires (« Écrire aux membres de la
commission (5) ») et leurs noms en infobulle : on voit à qui l'on écrit avant de
cliquer. Le nombre est celui des **adresses distinctes** : « Écrire aux membres
de la commission » écrit à la commission **entière** — son président, ses
rapporteurs et ceux qui y siègent sont membres de la commission au même titre
(R.811-27 et s.) —, et une personne qui porte deux rôles n'est inscrite qu'une
fois. Les rôles classés sont ceux du modèle (`ROLES_INTERVENANT`,
`schema.js`) : il n'y a qu'une liste à tenir à jour, `ROLES_PRESIDENCE_INTERVENANT`
/ `ROLES_RAPPORT_INTERVENANT` / `ROLES_MEMBRES_INTERVENANT`
(views/affaires.js), et un rôle nouveau s'y range en une ligne ; le bouton des
membres réunit les trois listes (`contactsDe.commission`).

**Un bouton par personne, partout où elle paraît.** Dans la composition de la
formation, la cellule « Courriel » devient un lien d'écriture et la colonne des
actions porte un bouton d'enveloppe (à côté du bouton qui retire la ligne) ; il
en va de même pour les autres personnes du dossier, et la personne mise en cause
a le sien dans l'en-tête de son panneau.

**Les adresses ne se saisissent jamais dans l'affaire** : elles viennent de la
fiche du membre (Réglages › Membres) ou de celle de la personne (répertoire).
Quand une fiche n'en porte pas, le bouton correspondant **n'existe pas**, et le
panneau nomme les personnes concernées — « Adresses manquantes — Nadia FONTAINE,
Nicolas GIRAUD… » — en rappelant où compléter la fiche. C'est délibéré : plutôt
qu'une adresse plausible fabriquée à partir du nom, l'outil dit ce qui manque.
Une affaire non encore convertie (composition héritée de la table d'origine
`Commissions`) reste joignable : la lecture retombe sur ses lignes, comme
`intervenantsDe` (formulas.js).

### Calendrier et export `.ics`

L'outil **n'héberge pas d'agenda**, et n'en hébergera pas : affiché dans un
document Grist, il n'est joignable que depuis ce document, et un flux censé
rester en ligne n'y fonctionnerait pas. La page **Calendrier** — l'entrée du menu
où le temps de la section se lit d'un seul tenant : ses **échéances** dans une
grille du mois, ses **séances** dans la vue qui les programme — présente les
échéances — séances, envoi des convocations, heures de passage, saisine,
prescription, terme de la sanction, expiration du délai de recours —, avec le
détail d'une journée, la liste « À venir » et le panneau « Ce mois-ci », qui
reprend le ton d'une pastille pour dire sa catégorie et compte les échéances du
mois.

**« Exporter mon calendrier (.ics) »** produit un fichier iCalendar que chacun
importe dans son agenda professionnel (Outlook, Google Agenda, Thunderbird,
Agenda d'Apple…). Le fichier suit le **périmètre de visibilité** : un secrétaire
exporte les affaires qui lui sont attribuées, un propriétaire l'ensemble ; le
nom du fichier porte celui de la personne, pour que deux exports ne se
confondent pas dans un dossier de téléchargements. Rien n'est écrit : l'export
est un instantané des données du moment, recalculé à chaque clic. Les lignes
respectent la RFC 5545 (repli à 75 octets sans couper un caractère accentué,
identifiants stables), et les rendez-vous sont exprimés en heure locale
flottante — la forme que les clients interprètent le plus fidèlement.

### Les dossiers de documents

La page **Documents** range les pièces produites **par affaire** : une affaire,
un dossier, et sous lui ses courriers et décisions. Les dossiers suivent la
liste des affaires — périmètre de la personne et ordre de saisine —, et une
affaire sans document garde son dossier : c'est là qu'on en crée un. Chaque
ligne ouvre la sous-vue du document (`#documents/<id>`) ; la suppression se fait
depuis la ligne, après confirmation.

Le **filtre de trames** de cette page ne propose que les trames qui concernent
les dossiers visibles : celles **applicables aux sections des affaires du
périmètre**, et celles qu'un document du périmètre **emploie** déjà (pour qu'un
filtre actif reste sélectionnable). Un secrétaire d'une section compétente à
l'égard des usagers ne voit donc pas, dans ce filtre, les trames réservées aux
enseignants-chercheurs — elles ne concernent aucun de ses dossiers. Une affaire
**sans section** n'élargit pas la liste : ce sont les documents qui l'emploient
qui font apparaître leur trame.

### Rédaction libre d'un document

Un courrier ordinaire **suit sa trame** : rien n'est enregistré dans le
document, et corriger la trame corrige tous les courriers qui s'en servent.
L'**espace de rédaction** — la sous-vue du document, `#documents/<id>` — donne
ce texte à modifier sur place ; la première modification le rend **propre au
document** (colonne `Generateur.Contenu`) :

- le texte affiché est celui du document, non la trame : les pastilles portent
  les valeurs de *cette* affaire (catalogue `trameCatalog` calculé sur le
  document) ;
- les balises restent vivantes — elles redeviennent `{{Colonne}}` à
  l'enregistrement — donc le texte se met à jour avec les données ;
- **Figer les valeurs** remplace les balises de données par les valeurs du
  moment (noms, dates, lieux) : le texte ne bougera plus ;
- **Revenir à la trame** efface le texte propre, après confirmation : le
  document suit de nouveau sa trame.

#### Une seule feuille

Un document ne se réduit pas à son texte : la **feuille de style** de sa trame
l'entoure — l'en-tête de la section et le destinataire avant, la signature et le
pied de page après. L'espace de rédaction montre donc le **document assemblé**, et
non le seul corps : l'en-tête du service, puis ce que la trame apporte autour du
texte **et le texte lui-même, d'un seul tenant** — une page, et non trois zones
séparées (`assemblageDocument`, views/documents.js). On y écrit le document comme
dans un traitement de texte, et l'on y corrige une imprécision de la trame — une
mention, une adresse de service, une formule de signature — **pour cette seule
pièce**, sans que la trame ni les autres documents changent.

Sous cette feuille unique, le modèle reste celui de deux colonnes : le texte
(`Generateur.Contenu`) et la feuille propre au document
(`Generateur.Feuille_de_style` — la feuille de la trame, adaptée, autour de
l'emplacement `{{Corps}}`). Deux **marques invisibles** que l'éditeur pose de part
et d'autre du texte (`<span data-marque="corps-debut">` et `corps-fin`,
`.app-feuille__marque`) les séparent à l'enregistrement : `decouperAssemblage`
(app.js) lit ce qui les précède et ce qui les suit comme la feuille du document —
`avant + {{Corps}} + apres` —, et ce qu'elles encadrent comme son texte.
`saveEditorContent` écrit alors l'une et l'autre colonne :

- la **référence** de la feuille est celle de la trame (`feuilleEffective`,
  render.js) : tant qu'elle lui reste identique, rien n'est écrit, et la pièce
  continue d'en hériter — y revenir mot pour mot **efface** l'adaptation ;
- la **référence** du texte est le corps de la trame : tant qu'il n'a pas bougé,
  la pièce continue de le suivre ;
- faute de marques — une correction a réuni le texte et la feuille —, c'est la
  feuille **entière** qui s'enregistre (sans `{{Corps}}`) et `Contenu` qui se
  vide ; `computeDocumentParts` la rend alors telle quelle (voir plus bas).

Le bouton **« Revenir à la trame »** (`doc-contenu-reinit`) efface d'un coup le
texte propre et l'adaptation de la feuille, après confirmation ; la pastille
d'état (`#docEtat`, `syncDocEtat`) dit si le document suit sa trame ou lui est
propre. **Figer les valeurs** (`doc-contenu-figer`) remplace les balises du texte
par les valeurs du moment (noms, dates, lieux) : le texte ne bougera plus.

La **zone d'écriture** déclare `data-chips="feuille"` — la palette réunit les
deux familles de balises, les variables `{variable}` de la feuille de style (sous
le préfixe « Feuille de style — ») et les balises `{{Colonne}}` du texte, que
`styleRegex` reconnaît les unes comme les autres. Chacune se rend **là où elle a
été déposée** (`renderDocumentBody`) : une variable tombée dans le texte, ou une
donnée tombée dans le chapeau, donne sa valeur — jamais sa balise. La vue
« Balisage » montre le HTML de la feuille entière.

#### L'espace de rédaction et ses trois vues

Chaque document a **sa propre sous-vue**, et c'est là qu'il se rédige — elle ne
partage la page avec aucune liste. Le texte d'un document n'est pas un champ
parmi d'autres : c'est **le** contenu de la page, et `documentEditor`
(views/documents.js) est bâti autour de lui. Trois onglets
(`data-tab="docVue:…"`, état dans `state.tabs.docVue`) regardent le même espace :

| vue | ce qu'elle montre | montage |
| --- | --- | --- |
| `redaction` | la feuille mise en forme, chaque balise étant une pastille | `contenteditable` (`#docEditor`, `data-field="assemblage"`), `htmlToEditor` |
| `balisage` | le HTML de la feuille, celui qui sera enregistré | champ de texte `data-wysiwyg-source`, ouvert par `data-wysiwyg-view="balisage"` sur le conteneur (`editor.js`) |
| `resultat` | les feuilles A4 telles qu'elles seront imprimées — paginées, pied de page répété au bas de chacune et numéroté si le type le demande | `#docPreview`, l'`iframe` de `computeDocumentParts` — c'est là que se trouvent l'impression et les exports |

La vue « Résultat » n'est pas un lieu de rédaction : elle porte un **bandeau**
(`.app-doc__rendu-tete`) qui dit ce qu'on regarde — « Aperçu avant impression —
2 pages », le nombre étant annoncé par l'aperçu lui-même (`postMessage`, voir
`brancherPagination` dans app.js) — et donne le chemin du retour, un bouton
**Modifier le texte** qui ramène à la vue `redaction` (`data-tab`). Un aperçu ne
se modifie pas : on y lit, on y imprime, on y exporte, et l'on repart rédiger.

**La zone d'écriture a la mesure de la feuille.** Dans les espaces de rédaction
(`.app-doc .app-wysiwyg__edit`, `styles.css`), le texte s'écrit au corps du
document (12 pt, interligne 1,5), dans une largeur utile de 17 cm et avec les
marges de 2 cm de la page — mêmes valeurs que l'aperçu A4. Les lignes se coupent
donc là où elles se couperont à l'impression : passer de la rédaction au
résultat ne redistribue plus le texte, et l'aperçu est **lisible** parce qu'on y
retrouve, au mot près, ce qu'on vient d'écrire. La feuille de style d'un format
se rédige dans le même espace (`.app-doc`), donc à la même mesure : ce qu'on y
écrit s'y coupe exactement comme le document le coupera. Hors d'un espace de
rédaction, la zone garde la mise en forme d'écran du DSFR.

Le rendu **n'est donc pas un panneau de la page** : c'est la troisième vue du
même espace (`.app-doc__rendu`, masqué sauf en vue `resultat`). Un seul `iframe`
d'aperçu existe à tout instant, et `refreshPreview` (app.js) le met à jour à la
saisie quelle que soit la vue : passer de « Rédaction » à « Résultat » montre
donc le texte à l'instant où on l'a laissé.

À droite de l'espace de rédaction, **deux outils repliables**
(`.app-doc__outils`, `outils()` dans views/documents.js) : les **paramètres du
document** et la **palette des variables**. Chacun est un panneau ouvert ou un
onglet vertical replié (`app-outils--replie`, `data-action="doc-parametres"` /
`"doc-variables"`), et son état vit dans `state.tabs` (`docParams`,
`docVariables`) — donc il survit au redessin. Le corps de chaque outil a sa
propre hauteur maximale et défile pour lui-même : les deux restent en vue
pendant qu'on écrit, et les replier rend toute la largeur au texte — repliée, la
colonne se réduit à ses deux onglets (2,6 rem). Les paramètres restent ouverts
tant qu'aucune trame n'est choisie (`repliable: false`) : ils sont le seul moyen
de la choisir.

**La largeur se partage au prorata.** Le texte prend les **trois quarts** de
l'espace, la colonne d'outils le quart restant — jamais moins de 14 rem, jamais
plus de 22 rem (`.app-doc__atelier { flex: 3 1 0 }`,
`.app-doc__outils { flex: 1 1 0 }`, `styles.css`). Un partage à largeur fixe
étranglait le texte : sur un écran de 1045 px — la largeur d'un outil embarqué
dans un document Grist —, la colonne gardait ses 22 rem et la feuille tombait à
566 px, pour un texte de 487 px. À proportion, la feuille atteint sa mesure A4
(21 cm) dès 1176 px de fenêtre, et ne la dépasse jamais. Les deux autres espaces
de rédaction suivent la même règle : l'**atelier d'une décision**
(`app-doc--decision`), dont le répertoire des considérants demande plus de
place, garde un plancher plus haut (18 rem au lieu de 14) et un plafond plus
haut (25 rem au lieu de 22) ; les registres de trames et de formats, celui d'un
document.

**Une colonne étroite replie ses champs.** Les panneaux d'outils sont pleins
des grilles de champs du DSFR, et ces grilles se coupent sur la largeur de la
**fenêtre**, non sur celle dont elles disposent : dans une colonne de 15 rem,
deux champs côte à côte n'en gardaient que sept chacun, et le champ de date n'y
montrait plus que deux caractères. La colonne est donc un **conteneur de
requête** à son tour (`container: outils / inline-size`, `styles.css`) : sous
20 rem, ses champs reprennent la largeur entière — la mise en page du mobile,
appliquée à la colonne et non à l'écran.

**Le point de dépôt d'une balise se voit.** Pendant qu'on fait glisser une
balise de la palette, une **barre bleue** marque l'endroit exact où elle tombera
(`.app-drop-caret`, `editor.js`) : haute de la ligne visée, posée entre les deux
caractères qui encadreront la pastille. Elle est fixée **au document**, et jamais
posée dans la zone rédactionnelle — le texte d'un document est enregistré tel
quel, une balise de repère y serait prise pour du contenu. Le **fantôme du
geste** est réduit à la balise elle-même et décalé (`reduireFantome`,
`setDragImage`) : sans cela, le navigateur traîne l'image de la barre entière de
la palette, qui recouvre le repère. Le dépôt d'un considérant, dans l'atelier
d'une décision, se marque de la même façon.

C'est la largeur de l'espace de rédaction — non celle de la fenêtre — qui
décide si les outils tiennent à sa droite : `.app-wysiwyg.app-doc` est un
**conteneur de requête** (`container: atelier / inline-size`), et sous 59 rem
les outils prennent la ligne entière plutôt que de réduire le texte à une
colonne — la requête média (`62em`) les y met aussi dans un cadre plus étroit
que la fenêtre, comme un outil embarqué dans un document Grist. En vue
`resultat`, les outils sont masqués : la feuille prend toute la largeur, comme
un aperçu avant impression.

#### Sous-vue d'un document : une adresse par courrier

La page **Documents** (`viewDocuments`) range les courriers en **dossiers** :
une affaire, un dossier. Les affaires y sont celles de la liste des affaires —
le périmètre de visibilité s'applique — dans le même ordre (saisine la plus
récente d'abord), et chacune forme un panneau qui porte son numéro, son nom,
son état, ses documents et deux boutons : « Nouveau document » (`add-document`,
l'affaire passée par `data-affaire`) et « Ouvrir l'affaire ». Une affaire sans
document garde son dossier : c'est là qu'on en crée un. Un filtre actif
(recherche, trame) resserre les dossiers et leur contenu, et les classe alors
par document le plus récent (`dossiersDeDocuments`). Les documents en sont
retirés un par un par leur porteuse (`parAffaire`).

Chaque ligne est un **lien** vers `#documents/<id>` — l'adresse propre du
document — et non un bouton qui sélectionnerait une fiche sur place : le lien
se copie, s'ouvre dans un nouvel onglet, et survit au rechargement. À côté du
lien, la ligne porte l'action qui **supprime** le document (icône corbeille,
`data-delete="Generateur:<id>"`) : la suppression se fait donc d'où l'on voit le
document — page des dossiers, onglet « Documents » d'une affaire, ou en-tête de
la sous-vue —, toujours après confirmation. Le couple lien + action est
`.app-list__row` (voir `styles.css`) : la maille de la grille, dans laquelle le
lien prend la place et le bouton se tient à sa droite.

L'onglet « Documents » d'une affaire (`documentsList`, mêmes lignes) mène au
même endroit : c'est la même sous-vue qui s'ouvre, et c'est le seul endroit où
le texte s'écrit.

Le sous-chemin de « Documents » désigne donc une **fiche**, non une vue :

- `documentSubId` (app.js) valide l'identifiant (`null` si le document n'existe
  pas — un lien mort ramène à la liste) ;
- `navTo` / `initialRoute` l'acceptent pour cette seule page : `#documents`
  revient toujours à la liste, `#documents/12` ouvre le document 12 ;
- `renderPage` (views/index.js) choisit `viewDocument` ou `viewDocuments`, et
  fait du document ouvert la **sélection courante** (`state.sel.Generateur`) —
  c'est elle que lisent les commandes de l'espace de rédaction (exporter, figer
  les valeurs, revenir à la trame) ;
- supprimer le document ouvert (`doDelete`) ramène à la liste plutôt que de
  laisser la page sur une adresse morte ;
- créer un document (« Nouveau document » de l'en-tête, ou de l'onglet
  « Documents » d'une affaire) ouvre sa sous-vue.

`viewDocument` écrit l'en-tête (fil d'Ariane « Documents par affaire › affaire »,
titre de
la trame, objet, bouton **Ouvrir l'affaire**) et laisse `documentEditor`
produire l'espace de rédaction, la décision définitive et les informations
reprises. C'est ce découpage qui permet au même éditeur de s'ouvrir de
n'importe où sans réintroduire la liste à côté de lui.

`computeDocumentParts` (render.js) rend `documentBody(doc, trame)` — le texte du
document s'il existe, sinon le corps de la trame — par `renderDocumentBody`, qui
résout **toutes** les balises du texte (repères de pagination, variables `{…}`
de la feuille, données `{{…}}`), et `freezeDocumentBody` produit le texte figé par
le même rendu. Aperçu, impression, PDF, Word et OpenDocument passent tous par là :
ce qui s'écrit à l'écran est ce qui sort — sans balise brute. C'est ce qui permet
de **rédiger la décision définitive dans l'outil** — texte motivé, tableau de
faits, saut de page avant les annexes — puis de l'exporter sans retouche
extérieure.

#### Auteur et destinataire d'un document

Un document a un **auteur** — qui le rédige et le signe — et, lorsqu'il est
adressé, un **destinataire**. Ni l'un ni l'autre ne se choisissent au moment de
la rédaction : ils sont **programmés sur la trame** (`Trames.Auteur`,
`Trames.Destinataire`), dans Réglages › Trames, bloc « Auteur et
destinataire ». L'espace de rédaction s'en trouve allégé — il n'y a plus à y
désigner un émetteur ni un destinataire — et les blocs `{emetteur…}` /
`{destinataire…}` de l'en-tête et de la signature du **format** en découlent
d'eux-mêmes.

`redaction.js` est la source unique de cette résolution (`resoudreAuteur`,
`resoudreDestinataire`) : elle rend, pour un document, l'auteur et le
destinataire sous une forme commune — nom, qualité, adresse, formule — que
`render.js` pose dans le périmètre des variables (`{nom_emetteur}`,
`{f_emetteur}`, `{destinataire}`, `{adresse}`, `{formule_destinataire}`…),
y compris dans le **corps** d'une trame, où les balises s'écrivent avec les
doubles accolades.

**Les auteurs** (`AUTEURS_TRAME`) : le **président de la section
disciplinaire** — remplacé par son vice-président lorsqu'il est empêché, voir
plus bas —, le **président de la commission de discipline**, la **formation de
jugement** (dont la décision porte la signature de son président),
l'**autorité ayant engagé les poursuites** (celle qui a saisi la section,
`Affaires.Autorite_de_saisine`), le **secrétaire**, et — pour le **rapport
d'instruction**, qui est une pièce et non un acte de la formation — le
**rapporteur** (usagers, R.811-28) ou la **commission d'instruction**
(enseignants-chercheurs, R.712-32). Les décisions se classent, elles, par
**organe** : le président de la section, celui de la formation de jugement, ou
la formation elle-même.

**Les destinataires** (`DESTINATAIRES_TRAME`) : le **mis en cause** (celui de
l'affaire), la **victime** et le **témoin** (pris dans « Personnes du
dossier »), l'**autorité ayant engagé les poursuites**, le **chef
d'établissement** (président d'université, directeur, directeur général),
l'**autorité de tutelle** (recteur de région académique pour l'enseignement
supérieur, ministre chargé de l'agriculture pour l'agriculture), le **président
de la section disciplinaire** — contrepartie de la lettre de saisine — et le
**destinataire libre**, dont les coordonnées s'écrivent sur le document. Un
destinataire introuvable rend une chaîne vide et se signale à la rédaction
plutôt que d'inventer un nom.

Rien n'est figé pour autant : lorsqu'une affaire compte **plusieurs** victimes
ou témoins, ou **plusieurs** destinataires institutionnels de la qualité
voulue, le document désigne lequel (`Generateur.Personne_destinataire`,
`Generateur.Destinataire_institutionnel`) — la rédaction ne choisit donc que
parmi ceux que la trame a déjà désignés.

**Le remplacement du président** (`signataire.js`) ne concerne que l'auteur
« président de la section disciplinaire ». L'empêchement se déclare à **deux
niveaux**, qui se cumulent :

- **la section** — colonne `Sections_disciplinaires.VP`, réglée dans
  « Réglages › Sections et membres », bloc **Signature des courriers** : toutes
  les pièces de la section sont signées par le vice-président. C'est le
  remplacement durable ;
- **le document** — colonne `Generateur.VP`, réglée par la case *« Le président
  est absent : le vice-président signe »* du bloc **Signataire du courrier**,
  dans les paramètres de l'espace de rédaction : **cette pièce seule** est
  signée par le vice-président.

L'absence du président étant le plus souvent brève — le temps d'un courrier —
c'est le réglage du document qui est sous la main, au moment de la rédaction ;
celui de la section reste le réglage de fond, pour une présidence durablement
assurée par le vice-président. Dès que l'un des deux est coché, le
vice-président signe : une section tenue par son vice-président ne produit pas
de courrier signé par un président absent, si bien que le réglage du document
sert à **ajouter** une absence, jamais à la retirer. Quand la section impose le
vice-président, la case du document est donc cochée et **désactivée**, et son
indice renvoie au réglage de la section.

`documentScope` (render.js) applique le rôle effectif (`vicePresidentEffectif`)
avant tout rendu : le nom du signataire, sa formule (« Le président » / « La
vice-présidente ») et sa formule complète sont **recalculés depuis les membres**
pour ce rôle (`signataireDeLaSection`, qui ouvre un `Context` neuf — les
colonnes calculées sont mémorisées par identifiant de ligne, et un contexte déjà
servi rendrait la valeur du réglage d'origine), puis `appliquerSignataire`
corrige **toutes les copies de la section du périmètre développé**. C'est ce qui
fait que les trames qui nomment le signataire par
`{{Affaire_Section}}.Formule_complete` ou `{{Affaire_Section}}.Formule` — les
plus nombreuses — portent le même signataire que la variable
`{section_president}`. `resoudreAuteur` s'en sert aussi lorsque la trame donne
pour auteur « président de la section disciplinaire », si bien que le
remplacement vaut également pour `{f_emetteur}` et `{nom_emetteur}`. Aperçu,
impression, PDF, Word, OpenDocument et « Figer les valeurs » suivent, puisque
tous passent par `documentScope`.

Le bloc « Auteur » de l'espace de rédaction dit toujours qui signera, sous la
case du remplacement ; et lorsque le rôle effectif n'a **aucun titulaire** dans
la section, la signature serait sans nom : la formule de la section annonce
alors « Aucun vice-président trouvé », et l'écran — celui du document comme
celui de la section — le signale avant l'impression. Un auteur ou un
destinataire que l'affaire ne permet pas de résoudre (autorité de saisine
absente, victime unique non renseignée…) est signalé de la même façon, et le
document s'ouvre sans nom inventé.

#### Registres de Réglages : trames et formats

Les deux sous-pages **Trames** et **Formats (feuilles de style)** suivent le
même parti que la page Documents : la page est un **registre**
(`.app-list--grille` — recherche, et filtre par format pour les trames ; une
ligne par format, avec le nombre de trames qui s'y rattachent), et chaque ligne
ouvre l'**espace de rédaction de la fiche**, avec toute la largeur. La liste et
l'éditeur ne se partagent donc plus la page : `viewTrames` / `viewTypes` ne
rendent que le rangement, `viewTrame` / `viewTypeTrame` que la rédaction. Une
ligne de trame annonce, sous son format, son **auteur** et son
**destinataire** — les deux qualités que la rédaction ne choisit plus.

L'adresse d'une fiche est un **troisième segment** — `#reglages/trames/7`,
`#reglages/types/3` —, le sous-chemin de la page étant déjà pris par le nom de
la sous-page (`reglages/trames`). Le tableau des sous-pages concernées est
`FICHES_SUBS` (`schema.js`), lu par `reglagesFicheId` (app.js, pour l'adresse)
et par `viewReglages` (views/reglages.js, pour l'aiguillage) ; `state.fiche`
porte la fiche ouverte, `null` tant qu'on regarde le registre. Les règles sont
celles des documents : une adresse morte ramène au registre, créer une trame ou
un type ouvre sa sous-vue (`add-trame`, `add-type-trame`), et mettre la trame
ouverte à la corbeille ramène au registre (`mettreTramesALaCorbeille`), quand
supprimer un type passe par `doDelete`.

`viewTrame` et `viewTypeTrame` écrivent l'en-tête (fil d'Ariane « Toutes les
trames », titre, objet, et un bouton qui ouvre le registre correspondant filtré
— les documents produits avec cette trame, les trames rattachées à ce type) ;
le corps de la page réutilise l'**espace de rédaction des documents** : les
réglages de la trame (identification, procédure visée, **auteur et
destinataire**, et — pour une décision de la formation de jugement — la case
« Décision définitive »), ou l'identification du format (son nom, sa
**catégorie** et, pour une décision, son **organe**, puis la case
« Pagination », qui décide si ses documents portent « Page 3 sur 3 ») précèdent
le texte, et la
palette des variables est l'**outil repliable** partagé — `outils()`, remonté
dans views/common.js —, avec `data-action="trame-variables"` et un état
(`state.tabs.trameVariables`) commun aux deux sous-pages : replier les variables
rend toute sa largeur au texte. L'aperçu A4 (`#tramePreview`, `#typePreview`)
reste sous l'éditeur, en 1:1, et se met à jour à la saisie (`refreshPreview`) —
`previewTrame` / `previewType` le rendent sur l'affaire d'exemple. Le
dictionnaire des variables est au bas du **registre** des trames, repliable.

**Le registre des trames se manipule par lots.** Chaque ligne porte une **case à
cocher** — la sélection vit dans `state.trames.ids`, hors du document, car c'est
un geste d'écran — et l'icône qui met la trame à la corbeille. Sous les filtres,
une **barre de lot** (`.app-lot`, `barreLotTrames`) rappelle le compte des lignes
affichées, propose de **tout sélectionner** (`trames-tout`, qui n'agit que sur
les identifiants affichés — donc sur ce que les filtres ont laissé) et de tout
désélectionner, et offre les deux gestes de mise à l'écart : « Mettre la
sélection à la corbeille » et « Mettre les N trames [affichées] à la
corbeille » — la seconde dit « affichées » dès qu'un filtre est actif, pour que
le lot ne surprenne pas. Au bas de la page, le panneau **Corbeille**
(`corbeillePanel`) liste ce qui a été mis de côté, avec « Restaurer »,
« Supprimer » (définitif) et « Vider la corbeille ».

Rien de tout cela ne détruit par mégarde : `mettreALaCorbeille` (store.js)
**retire** la ligne de `Trames` sans cascade — les documents qui s'appuyaient
sur elle restent en place, sans trame (`mettreTramesALaCorbeille`, app.js,
prévient du nombre de documents concernés avant d'agir) —, et
`restaurerCorbeille` la remet avec son identifiant, d'où la reconnexion
automatique. La fiche d'une trame ne propose donc plus « Supprimer » mais
« Mettre à la corbeille ». Les écritures d'un lot passent par `store.batch` :
une seule sérialisation et un seul rendu pour N lignes.

**La page d'une trame porte deux zones d'édition** sous la même barre d'outils et
la même palette :

- **la feuille de style** (`#trameStyleEditor`), celle de son format, affichée
  telle qu'elle s'appliquera — l'en-tête du service (logos) au-dessus, puis le
  texte, l'emplacement `{{Corps}}` (pastille « Texte de la trame », sur sa propre
  ligne, encadrée d'un trait interrompu) et le pied de page répété. Un **état**
  dit d'où elle vient — « héritée du format « Courrier » » ou « adaptée à cette
  trame » —, et le bouton **« Rétablir la feuille du format »** défait
  l'adaptation (`trame-feuille-retablir`, app.js). La zone écrit la colonne
  `Trames.Feuille_de_style`, et seulement si l'auteur y touche : le texte rendu à
  l'ouverture sert de référence (`data-wysiwyg-base`), et tant qu'il ne change
  pas rien n'est enregistré — la trame **hérite**. C'est `htmlCanonique`
  (editor.js) qui compare, car le navigateur réécrit ce qu'on lui donne
  (`&Eacute;` → `É`) ;
- **le texte de la trame** (`#trameEditor`), le corps du document, qui écrit
  `Trames.Template_contenu` — le comportement d'origine, inchangé.

Les deux zones cohabitent grâce au **mode de balises par zone** : `data-chips`
sur une zone l'emporte sur celui de son conteneur (`wireContainer`, editor.js).
La feuille de style déclare `feuille` — variables `{variable}` *et* `{{Corps}}`
(voir `styleRegex`, render.js) —, le corps déclare `columns` — les seules
`{{Colonne}}` des données. La palette, elle, réunit les deux familles : les
variables de la feuille sont préfixées « Feuille — » pour qu'on sache à quelle
zone elles appartiennent. Chaque zone n'accepte que sa famille, au dépôt comme
au clic : une variable de la feuille lâchée dans le corps du texte n'y serait
pas rendue — l'éditeur **le dit** (`refusDeZone`) plutôt que de laisser le geste
sans réponse.

`viewTypeTrame` est la même page **moins l'héritage** : un format n'a pas de
feuille de style parente, il porte la sienne. Une seule zone d'édition
(`#typeStyleEditor`), et l'en-tête du service au-dessus ; un format neuf reçoit
`FEUILLE_VIERGE` (`trames-defaut.js`), le strict nécessaire, et `{{Corps}}` s'y
trouve — lorsque la pastille a disparu, la page le signale (« l'emplacement a
disparu »), car le texte des trames se placerait alors à la fin du document.

**Le panneau « En-tête : les deux logos »** règle, sur cette même page, la
**mise en page** des deux images de l'en-tête — le bloc-marque de l'État et le
logo de l'établissement — pour tout le format. Les **images** viennent de la
section (`Sections_disciplinaires.Marianne` et `Logo`) ; leur **zone** et leur
**taille** se règlent ici, dans six colonnes de `Types_Trames`
(`Marianne_position`, `Marianne_largeur`, `Marianne_hauteur` et leurs jumelles
`Logo_…`), et `enteteHtml` (render.js) en tire le balisage : trois zones d'égale
largeur, chaque image dans celle que sa position désigne. Une seule cote
renseignée laisse l'autre suivre — proportions conservées ; les deux la fixent
exactement. Rien de réglé reproduit la charte (bloc-marque à gauche à 27,42 mm,
logo à droite dans la zone de logotype de 53 × 26 mm), et l'aperçu de la feuille
— l'en-tête y figure en tête — montre le résultat à la saisie. Voir `SPEC.md`
§ 8, invariant 26.

### Rédaction d'une décision : l'atelier, le répertoire de considérants

Une décision de formation de jugement n'est pas un courrier : c'est un
**raisonnement**, qui suit un ordre fixe — les visas, ce qui a été entendu, les
considérants, le dispositif — et dont les morceaux se répètent d'une affaire à
l'autre. Elle dispose donc de son propre espace, l'**atelier de rédaction**
(`#decisions/<id>`, `views/decision-redaction.js`), depuis le registre des
décisions — la ligne du registre **est** l'atelier — et, depuis l'affaire, par
**« Rédiger la décision »** (`rediger-decision`, `app.js`), sur la décision
définitive de l'onglet « Décision » comme sur chacune de ses décisions avant dire
droit. Ce geste **crée le texte** de la décision s'il n'existe pas encore — c'est
la mécanique de « Créer le texte de la décision », partagée
(`assurerTexteDeDecision`) —, puis ouvre l'atelier. Son adresse se copie et
survit au rechargement, comme celle d'un document.

L'atelier ne réinvente pas le texte : il rédige le **document lié à la
décision** — la ligne de `Generateur` dont la colonne `Decision_liee` désigne
cette décision (`documentDeDecision`, `formules-decision.js`). C'est ce qui fait
que tout ce qui existait déjà sert ici sans rien ajouter : la trame et ses
balises, la feuille de style, l'aperçu paginé, la signature, l'impression et les
exports PDF, Word et OpenDocument. Le lien se crée au premier geste (« Créer le
texte de la décision »), à partir de la trame de décision applicable à la
section — celle qui porte `Decision_definitive` pour une décision qui tranche le
fond, une autre pour une décision avant dire droit (`tramePourDecision`) ; faute
de trame, le texte part du **squelette** (`echafaudageDecision`) : visas,
audience, « Considérant ce qui suit : », DÉCIDE, articles, signature.

L'atelier a les **trois mêmes vues** que l'espace de rédaction d'un document
(rédaction, balisage, résultat — `state.tabs.decVue`) et la même mécanique :
mêmes classes (`.app-doc`), même barre d'outils, même palette de variables, même
**document assemblé** — le chapeau, le texte (`#decEditor`, marquée
`data-considerants`) et la signature, montés par le même `assemblageDocument`
(views/documents.js), de sorte qu'une mention du chapeau ou la signature se
corrige là aussi pour cette seule décision — et même enregistrement à la frappe
(`saveEditorContent`). La décision ouverte devient la sélection courante
(`state.sel.Generateur`), si bien que l'impression et les exports s'y adressent
d'eux-mêmes. Le répertoire des considérants est le premier de ses outils, et
quatre boutons lui sont propres :

- **Numéroter les considérants** (`dec-numeroter`) pose `1.`, `2.`, `3.`… au
  début de chaque paragraphe marqué `considere`, dans l'ordre du texte et sans
  repartir à chaque intertitre — c'est la numérotation des décisions rendues,
  celle qui permet de citer « le considérant 6 » en séance. Le numéro est **du
  texte**, non un compteur CSS : il survit à l'impression, au PDF et au Word
  (`numeroterConsiderants`, `retirerNumero`) ;
- **Numéroter les articles** (`dec-numeroter-articles`) pose « Article 1er »,
  « Article 2 », « Article 3 »… devant les articles du dispositif, dans l'ordre
  du texte (`numeroterArticles`, `views/decision-redaction.js`). L'intitulé est
  **du texte** lui aussi, pour la même raison — un compteur ne se rend pas dans
  un fichier Word ni dans un PDF —, et il se **reconnaît** à son deux-points :
  chaque paragraphe dont le texte (ou le `<u>`) commence par « Article … : » est
  un article, qu'il porte déjà son numéro ou non, et les formules livrées du
  dispositif sont marquées `article` pour que le geste les prenne toutes. Une
  citation du code — « Article R.811-13 du code de l'éducation prévoit que… » —
  n'a **pas** de deux-points après le mot : elle reste un considérant, et la
  numérotation ne la touche pas (`estIntituleArticle`, `formules-decision.js`).
  Les deux numérotations sont **des gestes, non des réglages** : les décisions
  citent « le considérant 6 » et « l'article 2 » en séance, et une
  renumérotation silencieuse changerait le sens d'une citation déjà faite ;
- **Retrait de première ligne** (`dec-retrait`) donne aux considérants leur
  présentation — première ligne décalée d'un centimètre, suite du texte à la
  marge — et l'ôte d'un second clic (`retraitConsiderants`). Le retrait est
  **écrit sur chaque paragraphe**, en centimètres, et non posé par une règle de
  style : un fichier Word ou OpenDocument n'emporte pas la feuille du document,
  et l'auteur doit pouvoir l'ôter d'un considérant sans toucher aux autres.
  C'est le pendant, pour toute la décision, de la touche Tabulation dans
  l'éditeur ;
- **Composer le squelette** (`dec-squelette`) remet ce squelette en place, après
  confirmation.

#### Le répertoire des considérants

Les considérants de principe — la règle de droit, la citation d'un texte, la
phrase qui conclut — vivent dans `considerants.js`, avec les vocabulaires qui
les rangent :

| notion | valeurs |
| --- | --- |
| `rubrique` | l'intertitre du plan : compétence, procédure, prescription, requalification, matérialité, qualification, conséquences, appréciation, sanction, abandon, conclusions |
| `nature` | `principe` (la règle), `texte` (la citation), `enchainement` (la phrase qui applique et conclut) |
| `tags` | les thèmes qui le font retrouver : fraude, téléphone en examen, sursis, faits commis hors de l'établissement… |
| `domaine` | le code dont le texte est tiré — `agriculture` (code rural et de la pêche maritime) ou `education` |

`CONSIDERANTS_LIVRES` porte le répertoire livré, **tiré de décisions réelles**
de sections disciplinaires d'établissements agricoles (les crochets `[…]`
marquent ce que le rédacteur complète). Le répertoire de l'établissement, lui,
vit dans la table **facultative** `Considerants` (schéma) : un considérant
enregistré qui déclare son `Origine` **prime** sur le considérant livré qu'il
adapte — le bouton « Adapter » ouvre la fenêtre remplie de son texte, et
l'enregistrement crée cette ligne (`repertoire` fait le rapprochement ; retirer
la ligne fait revenir le texte livré). Une table absente du document Grist n'est
pas une panne : l'outil livre son répertoire, et le panneau propose de créer la
table en un clic (`installStructureAndReconnect`).

Le panneau `Considérants de principe` est le premier outil de l'atelier, et il
reste ouvert. Il cherche sans accent ni casse (`chercher`), filtre par rubrique,
par nature et par tags (les graphies voisines y sont réunies, `tagsDuRepertoire`),
présente les cartes rangées par rubrique — les plus utilisées d'abord, un
compteur `Usage` étant incrémenté à chaque insertion —, et **glisse** :

- `dragstart` sur une carte pose `application/x-considerant` et l'identifiant
  (`monterAtelierDecision`) ;
- le bouton **« Insérer »** d'une carte pose le fragment au curseur — à la
  dernière position connue du rédacteur dans l'éditeur, celle-ci fût-elle
  perdue par le clic sur le bouton (`plageMemorisee`, editor.js) ;
- `drop` sur l'éditeur insère le fragment **au point du pointeur**, non au
  curseur — c'est `rangeFromPoint` qui donne ce point, et `insertBlocks` qui
  pose les blocs (editor.js). Cette insertion par blocs est ce qui distingue un
  considérant d'un collage : `insertHTML` du navigateur verse le fragment *dans*
  le paragraphe courant, et deux considérants insérés de suite se retrouvaient
  collés l'un au bout de l'autre. Les blocs sont donc posés par l'API des
  plages, et le fragment prend la classe `considere` (voir `DOCUMENT_CSS`,
  render.js, et `styles.css` pour la zone d'écriture : justifié, l'intertitre en
  gras, la source en mention).

Les autres outils de l'atelier complètent la rédaction sans quitter le texte :
**Visas et dispositif** (`formules-decision.js` — les formules applicables
d'abord : le domaine, la **nature** de la décision et sa **juridiction de
recours** décident de ce qui convient. L'article de recours proposé est celui du
tribunal administratif pour un usager, du CNESER ou du CNESERAAV pour un
enseignant-chercheur selon la tutelle, et il ne l'est que
pour une décision qui en ouvre un — une sanction ou l'abandon des poursuites :
aucune autre décision, ni aucune ordonnance, n'est susceptible de recours —), **Champs de la décision** (sanction, texte retenu,
dates, durées — les balises du texte et le registre s'en nourrissent),
**Composition de la formation**, **Contrôles de régularité** (le panneau de
l'affaire, `controlesPanel`), **Variables** et **Trame et date**.

#### L'acte rendu : une ordonnance reçoit les mêmes outils

Une **ordonnance** — l'acte d'un président, qui règle la marche de l'instance —
n'est pas une décision : elle ne tranche pas le fond, ne se lie à aucune
`Decisions`, et se rédige donc comme un **document** (`#documents/<id>`). Mais
c'est un **acte rendu**, qui se motive : son espace de rédaction reçoit les
mêmes outils que l'atelier — le panneau **Considérants de principe**
(`outilConsiderants`, le répertoire de l'atelier, partagé) et les deux gestes de
numérotation décrits ci-dessus (`views/documents.js`, dès que le format de la
trame est **Décision** ou **Ordonnance**). Le texte y est marqué
`data-considerants`, ce qui branche le dépôt d'un considérant et fait retrouver
l'éditeur par `editeurDecision` (`app.js`). Un courrier, une attestation ou un
rapport, qui ne se motivent pas de la même façon, ne les portent pas. Un document
de **décision** déjà lié à sa décision (`Decision_liee`) porte en outre
« Rédiger dans l'atelier », qui mène à l'atelier complet — formules, champs,
contrôles —, et ne l'affiche que lié, pour ne pas ouvrir un second texte pour la
même décision.

### Aperçu et impression : toujours du A4
Un document est **toujours imprimé au format A4 portrait** (210 × 297 mm,
marges de 2 cm). L'aperçu reprend cette géométrie à l'écran : `DOCUMENT_CSS`
définit une feuille `.page` de 210 × 297 mm avec 2 cm de marge, affichée sur
fond gris et mise à l'échelle de la largeur disponible par `FIT_SCRIPT` — ce que
montre l'écran correspond donc à ce que sortira l'imprimante. Le même habillage
sert aux trois aperçus de l'application (`#docPreview`, `#tramePreview`,
`#typePreview`) et aux fenêtres d'impression ouvertes par `print.js`.

**Le document est montré en pages, non d'un seul tenant.** Un document rendu est
un flux continu ; sans découpe, la feuille de l'aperçu s'allongeait jusqu'à
devenir un rouleau de plusieurs mètres, et le pied de page — qui doit être
répété au bas de **chaque** page — n'apparaissait qu'une fois, tout en bas.
`pages.js` embarque donc dans le document rendu un script (`PAGE_SCRIPT`) qui le
découpe en feuilles A4 : une page s'arrête au bas d'un paragraphe, entre deux
lignes d'un tableau (en-tête répété) ou entre deux items d'une liste, jamais au
milieu d'une ligne ni sous un titre resté seul. Le pied de page est recopié au
bas de chaque feuille, et il y porte « Page 2 sur 3 » lorsque le format de la
trame demande la numérotation. L'aperçu **annonce son nombre de pages** à la page qui
l'accueille (`postMessage`), qui l'affiche à côté du titre « Aperçu avant
impression » ; un aperçu d'une autre provenance est ignoré.

**Le pied de page peut aussi porter le numéro de l'affaire.** Un document se
détache de son dossier — une décision se notifie, un rapport s'annexe, une pièce
s'envoie : le format peut donc demander, dans le même réglage que la
numérotation (Réglages › Formats (feuilles de style) › « Pagination et pied de
page »), le **numéro de l'affaire** au bas de chaque page. Il s'écrit « Dossier
n° 26UV-1 » et se place **à gauche** de la ligne, la pagination restant à
droite : les deux s'inscrivent dans le pied de page que la feuille de style
porte déjà, sur la même ligne (`piedNumerote`, `pages.js`, et l'alignement
`space-between` de `.app-page-count`, `render.js`). Le numéro est la variable
`{numero}` — il se place donc aussi à la main, dans le pied de page de la
feuille de style, avec les autres variables (`trame-variables.js`). À l'export,
la ligne devient une rangée de tableau sans filets, comme l'en-tête : le PDF,
Word et l'OpenDocument la reproduisent telle quelle (voir « Exports »).

**Le nombre de pages est le même partout.** L'aperçu, la fenêtre d'impression et
le PDF découpent à la même hauteur utile — la hauteur d'une page moins la hauteur
réelle du pied de page et un blanc de 2 mm — sur les mêmes blocs. Une réduction
« pour faire tenir » un document un peu trop long sur une page a existé dans le
PDF ; elle est **supprimée** : l'aperçu annonçait deux pages et le PDF en
produisait une, ce qui rendait le comptage illisible. Le nombre de pages est une
information que l'auteur lit et corrige (Réglages › Formats (feuilles de style) ›
« Pagination »).

À l'impression, `@page { size: A4 portrait; margin: 0 }` impose le format, la
marge de 2 cm étant portée par la feuille elle-même, et chaque feuille se
termine par une coupure (`break-after: page`) — la dernière exceptée.

La marge de 2 cm — celle d'un courrier administratif — est la valeur de
référence de toute la chaîne : la feuille de l'aperçu, la fenêtre d'impression,
la mise en page Word, celle de l'OpenDocument et la découpe du PDF en
découlent. Côté code, elle est tenue par **une** constante, `MARGIN_MM`
(`export-doc.js`, 20 mm), et par le rembourrage de `.page` (`render.js`) : les
deux doivent rester égales, sinon l'aperçu et les fichiers exportés ne
montreraient plus le même document.

#### Typographie et couleurs : la charte graphique de l'État

`DOCUMENT_CSS` (dans `render.js`) est la feuille de style des documents
**rendus** — courriers, décisions, attestations, états imprimés. Elle applique
la charte graphique de l'État telle que le Système de Design de l'État la
définit : la police **Marianne** (police de l'État, dont Arial est le repli
officiel), et les jetons de couleur du DSFR. C'est la **base** : la charte en
vigueur — la charte neutre par défaut — et la police réglée pour tous les
documents s'y substituent par une règle posée après cette feuille, sans que
`DOCUMENT_CSS` ait à changer (voir « Charte graphique et polices » ci-dessus, et
`charte.js`).

Ces jetons sont écrits **en clair** dans `DOCUMENT_CSS`, et non sous forme de
`var(--…)`, pour une raison précise : un document converti (PDF, Word,
OpenDocument) ou imprimé hors connexion n'a plus la feuille du DSFR pour fournir
ses variables. La valeur est donc recopiée, avec son nom de jeton en commentaire
pour la relecture :

| Emploi | Valeur | Jeton du DSFR |
| --- | --- | --- |
| Texte courant | `#3a3a3a` | `--text-default-grey` |
| Titres | `#161616` | `--text-title-grey` |
| Filets, bordures | `#ddd` | `--border-default-grey` |
| Fonds (en-tête de tableau) | `#f6f6f6` | `--background-alt-grey` |
| Liens, actions | `#000091` | bleu France |
| Mentions (pied de page) | `#666` | `--text-mention-grey` |

Ce que la feuille règle, et que le DSFR seul ne donne pas à un document :

- **le rythme** — chaque paragraphe se détache du suivant (0,5 rem), chaque
  titre a son air au-dessus et au-dessous (`1.25rem 0 0.5rem`, sans marge avant
  s'il ouvre le texte). Un courrier n'est pas une page web : c'est un compromis
  entre la respiration du DSFR et la place d'une feuille A4 ;
- **les titres** — encre `#161616`, graisse 700, et une taille **écrite** en
  points, prise dans l'échelle du menu « Taille » de la barre d'outils
  (`TYPOGRAPHIE`, editor.js) : 18, 16, puis 14 pt pour les niveaux 3 et 4 —
  14 pt est la taille d'un **titre de document**, celle des modèles livrés — et
  12 pt, la taille du corps, pour les deux derniers niveaux. Le DSFR, lui,
  module ses titres selon la largeur de la fenêtre : un titre n'avait donc pas
  la même taille dans un aperçu étroit et au tirage, et il ne portait aucune des
  valeurs que l'auteur pouvait choisir au menu. Aucun modèle livré n'emploie
  d'ailleurs de balise `<h1>`–`<h6>` : voir « Trames livrées par défaut » ;
- **les tableaux du texte** (classe `app-table-bordered`) — filets `#ddd`,
  en-tête en gras sur fond `#f6f6f6` souligné d'un filet franc `2px #3a3a3a`,
  aucune bordure verticale : c'est le tableau du DSFR, sans sa grille ;
- **les liens** — bleu France **soulignés** : un lien doit rester
  reconnaissable sur une impression en noir et blanc comme dans un fichier
  Word. Le trait est **un seul**, et posé franchement sous les jambages
  (`text-underline-offset`, épaisseur 1 px) : le DSFR souligne, lui, tout
  élément porteur d'un `href` par **deux dégradés de fond** — dont un au-dessus
  du texte — qui se superposaient au vrai trait et se lisaient donc comme un
  **double** soulignement. Ces dégradés sont éteints par la variable du
  DSFR elle-même (`--underline-img: none`), comme le fait son `.fr-raw-link` ;
  la zone d'écriture (voir « Rédaction libre d'un document ») suit la même
  règle, puisqu'elle montre du document et non de l'interface ; le **renvoi
  extérieur** que le DSFR ajoute en pseudo-élément après tout lien
  `target="_blank"` est éteint lui aussi partout où du document s'affiche —
  aperçu, PDF, Word, OpenDocument, zone d'écriture. Un courrier donne une
  adresse, il ne renvoie pas « ailleurs » ; ce pseudo-élément n'étant pas du
  texte, aucun export ne le reprend — et dans l'ancien PDF-image, le masque que
  la capture ne savait pas lire en laissait un carré bleu plein après le lien,
  dont le filet, tombant sous le trait du soulignement, se lisait comme un
  second soulignement ;
- **le pied de page** — filet `#ddd`, mentions en `#666` ;
- **les mots longs** — `overflow-wrap: break-word` : une adresse électronique ou
  un lien de visioconférence ne déborde pas de la feuille.

Les états imprimés de `print.js` (rôle de séance, liste d'affaires) partagent
`DOCUMENT_CSS` et lui ajoutent `PRINT_CSS`, qui emploie **les mêmes jetons** :
les impressions « maison » et les documents générés ne peuvent pas diverger.

> **Piège à connaître en modifiant cette feuille.** La feuille A4 enveloppe tout
> le document dans une **table de mise en page** (`<table><tr><td>`). Une règle
> visant `table td p` s'applique donc aussi au texte du courrier, et non aux
> seuls tableaux du texte : c'est ainsi qu'une remise à zéro des marges de
> paragraphe tuait, sans le dire, tout le rythme du document. Les règles
> destinées aux tableaux du texte portent la classe :
> `.page table.app-table-bordered td p`.

#### L'aperçu d'impression du navigateur (piège traité)

`FIT_SCRIPT` **n'est pas embarqué** dans l'impression ni dans les exports :
`computeDocumentParts(db, doc, { preview: false })` les construit sans lui. La
raison est un défaut constaté : le script centre la feuille à l'écran en posant
une marge gauche **en ligne** (`#docSheet.style.marginLeft`), et un style en
ligne l'emporte sur la règle d'impression `margin: 0`. Dans l'aperçu
d'impression du navigateur — donc aussi pour un « Enregistrer au format PDF »
demandé au système — la feuille était décalée de plusieurs centimètres vers la
droite et le texte se retrouvait écrasé dans une bande étroite, coupé à chaque
mot. Deux règles `!important` (`#docFit`, `#docSheet`) restent en garde-fou dans
`DOCUMENT_CSS`, pour qu'un cadre d'aperçu survivant ne puisse pas réintroduire
le défaut.

Une conséquence à garder en tête en modifiant `DOCUMENT_CSS` : les bordures de
table y sont neutralisées **pour la seule feuille A4** (`.page table …`), afin
que les états imprimés de `print.js` conservent les leurs. Un tableau **inséré
dans le texte** d'un document fait exception : il porte la classe
`app-table-bordered`, et une règle plus spécifique lui rend ses bordures (c'est
aussi ce que reconnaissent `export-doc.js` et le nettoyage du HTML collé).

Un **saut de page** inséré dans le texte se voit dans l'aperçu — il ferme la
feuille courante — et l'éditeur en affiche un repère en pointillés (un
pseudo-élément CSS, pour que le document ne contienne réellement qu'un élément
vide). Dans le flux du document, `.app-page-break` est réduit à une hauteur
nulle ; la pagination le reconnaît et coupe là, et `@media print` lui donne
`break-after: page` en garde-fou. La fenêtre d'impression et l'aperçu étant
paginés par le même script, un saut de page y produit exactement la même
coupure.

### Export des documents (PDF, Word, OpenDocument)

Les documents produits par l'outil peuvent être **exportés** en plus d'être
imprimés : boutons *Imprimer / PDF / Word (.docx) / OpenDocument (.odt)* sous
l'aperçu d'un document généré (page **Documents** et onglet « Documents » d'une
affaire), dans l'en-tête des **Séances et rôles** (rôle de la séance) et dans
celui des **Affaires** (liste filtrée). Le bouton
porte son périmètre (`data-export-scope`) et l'identifiant de la fiche, si bien
qu'une seule action (`runExport`) sert les trois cas ; l'indicateur d'avancement
(bloc `[data-export-status]`, produit par `exportStatus()` de `views/common.js`)
et le message final (notification) sont partagés.

`export-doc.js` part **du même HTML que l'aperçu** (`computeDocumentParts`) ou
de celui des impressions de `print.js`, et donc de la même feuille A4 : ce qui
est exporté correspond à ce que montre l'écran et à ce que sortira l'imprimante.

La mise en forme du texte est reprise d'un bout à l'autre : gras, italique,
souligné, barré, couleurs, taille, **police et surlignage** d'un passage
(`styleOf` relève le `font-family` et le `background-color` **en ligne** — la
mise en forme posée par la barre d'outils, pas celle, héritée, de la charte),
titres (entrés dans le plan du document),
**exposants et indices** (`styleOf` relève `vertical-align`), listes (numérotées
ou à puces, y compris imbriquées), tableaux, traits, images et sauts de page.
C'est ce qui permet d'écrire une décision dans l'outil — tableaux de faits
compris — et de l'ouvrir telle quelle dans un traitement de texte.

| Format | Comment |
| --- | --- |
| **PDF** | Le document est **composé bloc à bloc** par `pdfmake` : chaque paragraphe, liste, tableau et image devient un objet de mise en page, écrit dans une **police embarquée** (voir `pdf-fonts.js`). Le texte du fichier est donc du **texte** : il se sélectionne, se cherche et se copie, et il reste lisible sur un poste qui n'a ni la police ni le logiciel qui l'a produit. Le PDF ainsi composé est ensuite converti au **format d'archivage PDF/A-2b** (`pdf-a.js`) — profil de couleur sRGB embarqué, métadonnées XMP, `/Lang`, identifiant de fichier : le document se conserve et s'archive en l'état. Les **liens** restent cliquables, portés par le texte qui les nomme (`pdfRun`) et non par un rectangle relevé à part. |
| **Word `.docx`** | Le contenu est converti en paragraphes, listes, tableaux et images (bibliothèque `docx`), avec une section A4 (marges de 2 cm) et un **vrai pied de page Word** répété. Titres : le style `Titre n` est **basé sur** `Heading n` (plan du document) tout en reprenant la mise en forme de l'écran. Chaque liste numérotée reçoit sa propre numérotation concrète (`instance`), donc repart de 1. |
| **OpenDocument `.odt`** | L'ODT est une archive ZIP de XML : `content.xml`, `styles.xml`, `meta.xml` et `META-INF/manifest.xml` sont écrits directement (`zipStore`), `mimetype` en première entrée non compressée. Les images sont déposées dans `Pictures/` et déclarées au manifeste ; le pied de page est un `<style:footer>` du maître `Standard`. |

**Habillage repris par les exports.** Word et OpenDocument ne gardent du
navigateur que ce qu'ils savent écrire : le **gras**, l'italique, le souligné,
la couleur et la taille de chaque segment, les titres (entrés dans le plan), et
pour les tableaux les **bordures** (`#ddd`, le filet des tableaux du DSFR), la
**graisse de l'en-tête** et **son fond** (`#f6f6f6`). Ce dernier est relevé par
`tableBlocks` (`headRows`) et reporté par `docxTable` (fond de cellule) et
`odfTable` (style de cellule) : un fond de ligne ne se devine pas, il se
déclare. La police des fichiers Word et OpenDocument est **nommée**, jamais
décrite : ni OOXML ni ODF ne savent exprimer une liste de polices de repli, et
demander « Marianne » ferait substituer la police par le traitement de texte
sur les postes où elle n'est pas installée. La charte de l'État demande donc
**Arial**, son repli officiel ; la charte neutre demande **Public Sans**, celle
qu'elle affiche. Le PDF, lui, **embarque** sa police : elle n'est ni nommée ni
décrite, mais **jointe au fichier** (`pdf-fonts.js`), et le texte garde donc
exactement la police de la charte, sur n'importe quel poste. Seules deux
familles sont joignables — Public Sans et Marianne ; une **autre police choisie
dans le texte** (barre d'outils : Arial, Times New Roman, Georgia, Verdana)
désigne une police de poste, qu'aucune licence ne permet de joindre à un
document : le PDF la remplace alors par celle des documents, et l'export le
**signale** à l'auteur (`substituees`, voir `runExport`) plutôt que de le lui
cacher.

**Aucune balise brute n'atteint un fichier exporté.** L'espace de rédaction
propose les **deux familles** de balises dans une même palette — les variables
`{…}` de la feuille de style et les balises de données `{{…}}` du texte — et la
pastille de chacune montre déjà la valeur qu'elle produira. Le corps du document
est donc rendu par `renderDocumentBody` (render.js) : repères de pagination
(`{page}`, `{pages}`, que Word et l'OpenDocument traduisent en vrais champs),
puis variables de la feuille, puis balises de données ; les deux **bords** de la
feuille (le chapeau, la signature) reçoivent aussi le rendu des données qu'ils
nomment. Une balise non résolue se **vide**, comme toute balise inconnue : ce
qui restait brut disparaît plutôt que de s'imprimer. Le **texte figé** (« Figer
le texte ») passe par le même rendu.

**Le corps n'est jamais un pied de page.** L'emplacement du texte (« Texte de la
trame ») peut être déposé **dans** un `<div class="print-footer">` : le partage
de la feuille se fait alors au **début** de ce pied (`decouperFeuille` →
`debutPiedDePage`, render.js), jamais à l'endroit de la balise. Le texte reste un
texte, et le pied garde ses propres mentions après lui. Sans cette règle, le
corps entier devenait un pied de page : Word et l'OpenDocument le recopiaient au
bas de **chaque** page, et le PDF lui réservait sa hauteur mesurée dans la marge
basse — le document s'étalait sur une page par ligne. L'espace de rédaction
emploie **le même découpage** : la feuille corrigée est enregistrée dès la
première modification.

**Pagination.** La pagination du PDF est **celle de l'aperçu** — c'est une
exigence, et elle tient à une règle. Les **paragraphes sont insécables**
(`unbreakable`) : la bibliothèque ne coupe pas au milieu d'un paragraphe, mais
entre deux blocs, comme le fait la pagination de l'aperçu — d'où le même nombre
de pages de part et d'autre. Les **sauts de page** du texte, eux, ne se
négocient pas : le repère `.app-page-break` du modèle devient un
`pageBreak: "before"` sur le bloc suivant (Word et OpenDocument traduisent la
même coupure en `PageBreak` et `fo:break-before="page"`).

Le pied de page est répété par la bibliothèque au bas de chaque page, dans la
**marge basse** : la hauteur du pied, mesurée sur la feuille **avant** de le
détacher (`takeFooter`), s'y ajoute à la marge de 2 cm, avec un blanc de 2 mm.
C'est le seul endroit où le numéro de page et le nombre total de pages existent,
et donc le seul où `{page}` et `{pages}` peuvent être remplis : `pdfPied` les
substitue page par page (`champs`).

**Pas de résolution : du texte.** Un PDF composé n'a pas d'échelle — le texte est
du texte, et les **images** sont incorporées en pixels, à la taille où la feuille
les affichait (`inlineImages` les recopie en PNG, quel que soit l'hébergeur
d'origine). Rien ne dépend plus du serveur qui hébergeait une image une fois le
fichier exporté, et une image que son hébergeur refuse de laisser lire est
**signalée** à l'auteur (`missing`, voir `runExport`) au lieu de disparaître en
silence.

**Interligne.** Le PDF n'a pas la notion d'« interligne CSS » : la bibliothèque
exprime le sien en multiples du corps. `pdf-fonts.js` relève donc, dans le
fichier de police, le rapport entre la hauteur de ligne prévue par la fonte et
son corps (`head.unitsPerEm` et `hhea` — 1,175 pour Public Sans), et `exportPdf`
divise l'interligne de la feuille par ce rapport : à 12 pt, une ligne du PDF
mesure exactement les 18 pt de l'écran.

**Ce que l'export dit plutôt que de le cacher.** Deux défaillances d'un export
sont **signalées** à l'auteur, dans la notification qui suit le téléchargement
(`runExport`, `app.js`) : une **image** que son hébergeur refuse de laisser lire
(`missing`) — sans quoi un courrier partait sans son bloc-marque de l'État sans
que rien ne le dise —, et une **police choisie dans le texte** qui ne peut pas
être jointe au PDF (`substituees`). Le PDF composé, lui, ne peut pas échouer en
silence : il est déjà écrit quand la conversion PDF/A est tentée, et si celle-ci
échoue, le PDF ordinaire est conservé et l'incident consigné dans la console.

**Export anonymisé d'une décision définitive.** Une décision se publie, se cite,
s'annexe — et les personnes du dossier n'ont pas à la suivre partout. La barre
d'export d'une **décision définitive** (format « Décision » dont la décision
rédigée n'est pas interlocutoire) porte donc une case **« Export anonyme »**,
au-dessus des trois boutons : cochée, le document part avec des pseudonymes à la
place des noms. `anonymat.js` fait le travail sur le **document rendu** — le
seul endroit où l'on voit tout ce qui sera écrit : chapeau, visas, corps,
signature, pied de page —, et il l'applique avant `prepareDocument`, si bien que
les trois formats et leurs pieds de page en héritent. Les personnes effacées
sont celles du **dossier** : la personne mise en cause de l'affaire, celle des
affaires jointes, et les personnes impliquées (victimes, témoins, défenseurs,
représentants) ; les **membres de la formation** et le **secrétaire** gardent
leur nom — ils rendent la décision, et une décision anonymisée ne se lirait plus
sans eux. Chaque nom est cherché sous toutes ses écritures (« Prénom NOM »,
« NOM Prénom », « NOM, Prénom », le nom seul, le prénom seul), sans égard à la
casse mais dans les limites du mot — « ANDRÉ » ne se cache pas dans « ANDRÉE » —,
et les pseudonymes suivent l'**ordre du document** : la première personne nommée
devient « A. B. », la suivante « B. C. »… Un nom qui reparaît plus loin garde le
sien. Le **nom du fichier** perd celui du mis en cause et porte la mention
« anonyme », et la notification d'export le dit. Voir aussi le § 8, invariant 18
(`SPEC.md`).

**Bibliothèques.** `pdfmake` et `pdf-lib` (PDF), `docx` (Word) ne sont
**jamais** chargées au démarrage : elles sont importées à la demande depuis
esm.sh au premier export de chaque format. Les **polices** du PDF le sont aussi
au premier export, une seule fois par session (`pdf-fonts.js` garde les fichiers
en base64). Le même code fonctionne ainsi sur le site autonome, dans Grist et
dans un générateur Perchance. Le seul ajout fait à `main.pjs` pour l'export est
le relais de la plateforme (`superFetch`, voir « Images (bloc-marque, logo) ») :
il ne sert qu'à relire une image distante dont l'hébergeur refuse l'intégration,
et seulement au moment d'un export.
- **Apparence** : `styles.css`. Les couleurs et polices viennent des jetons
  DSFR (`--background-alt-blue-france`, etc.) : c'est ce qui permet au thème
  sombre de fonctionner sans feuille de style supplémentaire. Éviter les
  couleurs en dur (`#fff`, `white`) — elles ne suivraient pas le thème.

## 6. Accessibilité et bonnes pratiques

- Composants DSFR (en-tête, barre de navigation, panneaux, tableaux, alertes,
  badges), `lang="fr"`, régions ARIA, focus visible.
- Icônes décoratives marquées `aria-hidden` ; boutons avec intitulé ou `title`.
- Interface **de bureau** : la mise en page est pensée pour un écran large
  (colonnes maître/détail, tableaux étendus) ; sur écran étroit, l'en-tête et
  les grilles se replient sans débordement horizontal.
- Fonctionne hors ligne après le premier chargement (hors CDN et hors Grist).

### Vie privée : tout s'exécute en local

Aucune donnée du document Grist — ni des données saisies en mode autonome —
n'est transmise à un serveur. Le code de l'outil ne comporte **aucun envoi de
données** : pas de `POST`, pas de formulaire, pas de `sendBeacon`, pas de
WebSocket. Une vérification à l'exécution (journal des requêtes du navigateur,
toutes les entrées de *resource timing*) ne montre que des **téléchargements de
code**, et la relecture d'une image distante (voir le tableau, dernière ligne) :

| Destination | Nature | Déclenchement |
| --- | --- | --- |
| `cdn.jsdelivr.net` (DSFR 1.15.3) | feuille de style, icônes, polices, script | au chargement |
| `esm.sh` / `cdn.jsdelivr.net` (sql.js, SheetJS, pdfmake, pdf-lib, docx, polices du PDF) | bibliothèques et polices | à la demande, sur action |
| serveur Grist (`…/grist-plugin-api.js`) | API du widget | au chargement d'un widget |
| l'hébergeur d'une image citée par une donnée | **lecture** d'image (`GET`) | au rendu de cette image |
| relais `superFetch` (Perchance) | **lecture** de l'image d'une section, quand son hébergeur refuse l'intégration | à un export PDF/Word/OpenDocument |

Les quatre premiers sont des téléchargements : les adresses ne portent que des
noms de paquets, jamais une donnée. Les échanges d'écriture, eux, sont des
`postMessage` vers le cadre parent — c'est l'API de widget, donc **le document
lui-même** ; l'outil ne s'adresse jamais directement au serveur Grist.

Le dernier mérite une phrase : pour intégrer une image dans un fichier exporté,
l'outil doit la relire. Si son hébergeur s'y refuse (en-tête CORS absent), la
seule reprise possible est de passer par un relais, ce qui **transmet à la
plateforme l'adresse de cette image** — jamais autre chose, et seulement au
moment d'un export. Pendant l'édition et la consultation, aucune requête de ce
type n'a lieu. Une image enregistrée dans la base (boutons « Choisir une image
sur ce poste… ») évite même cette requête.

Les sorties (export JSON, `.ics`, archive ZIP, PDF, Word, OpenDocument, journal
de diagnostic) se produisent localement et ne quittent le poste que par un geste
de l'utilisateur : un téléchargement, ou un copier-coller.

Seule exception, et elle vient des données : une colonne d'image
(`Sections_disciplinaires.Logo`, `Marianne`, `Identite.Logo_operateur`) qui
contient une **adresse `https://…`** fait charger cette image par le navigateur
depuis son hébergeur. C'est une lecture, jamais un envoi, mais elle révèle à cet
hébergeur qu'une page de l'outil a été ouverte : déposer le fichier (Réglages ›
Identité, ou un chemin relatif dans `assets/`) supprime cet appel. Sur la
plateforme Perchance uniquement, la plateforme ajoute son propre script de
mesure d'audience (`static.cloudflareinsights.com`) ; il n'existe pas dans le
déploiement `src/` (GitHub Pages) ni dans un widget Grist.

Les requêtes sortantes ne portent par ailleurs **aucun `Referer`**
(`<meta name="referrer" content="no-referrer">`) : l'adresse du widget, qui
contient l'identifiant de l'organisation Grist, n'est transmise à aucun CDN ni
hébergeur d'image.

### Le poste de travail : session, verrouillage et stockage

En mode autonome — sans document Grist —, la base est écrite **en clair** dans le
stockage du navigateur (`localStorage`), sous la clé
`sections-disciplinaires.db.v1`. C'est commode et sans serveur, mais cela impose
trois précautions, que l'outil porte lui-même :

- **Mode session** (Réglages › Données) : rien n'est conservé sur le poste, la
  base vit le temps de l'onglet. À employer sur un poste partagé ou pour une
  consultation. Un avertissement rappelle le risque du poste partagé quand la
  persistance est active.
- **Verrouillage d'écran** : au bout de l'inactivité réglée, l'écran se couvre et
  se **déverrouille par un code** que l'utilisateur a défini (Réglages ›
  Confidentialité). Seule une empreinte SHA-256 du code est conservée sur le
  poste ; cinq tentatives infructueuses suspendent la saisie, et chaque
  déverrouillage est inscrit au `Journal`. Si **aucun code n'a été défini**, le
  verrou couvre l'écran sans contrôler l'accès : l'écran et le panneau de
  réglages le disent alors en clair, pour ne pas donner une fausse assurance.
- **Échec d'écriture** : passée la capacité du stockage, une écriture peut être
  refusée (quota atteint). L'outil ne la perd plus en silence — un **bandeau
  persistant** en donne la cause, l'incident est inscrit au `Journal`, et le
  journal de diagnostic le reprend. L'occupation du stockage est mesurée et
  signalée à **60 %** puis **85 %**, avec la proposition d'exporter la base pour
  la sauvegarder avant d'aller plus loin.

Rien de tout cela ne remplace la sauvegarde : en mode autonome, **l'export JSON**
(Réglages › Données) est la copie de sécurité, et le document Grist, lui,
conserve les données hors du navigateur.

### Les onglets

Un écran long — la fiche d'une affaire, les réglages d'une section, une
catégorie de catalogues — se découpe en onglets. Deux primitives les portent
(`ui.js`) : **`tabs`** écrit la barre (`role="tablist"`, un bouton `role="tab"`
par entrée, avec `aria-selected` et un `tabindex` mobile) et **`tabPanel`** écrit
le **panneau**.

**Un seul panneau est monté** : celui de l'onglet actif. C'est un choix — les
autres vues coûtent cher (aperçus de document, éditeurs) et n'ont pas à exister
tant qu'on ne les regarde pas. La conséquence est assumée dans le balisage :
seul l'onglet actif porte `aria-controls`, vers le panneau qui existe
réellement ; les onglets inactifs n'en portent pas, car annoncer une cible
absente serait pire que de se taire.

Au clavier, la barre se parcourt aux flèches (`ArrowLeft` / `ArrowRight`, et
`Origine` / `Fin` pour les deux extrémités) : la sélection suit le focus, et le
focus se repose sur l'onglet élu après le rendu (`onKeydown`, `app.js`). Le
panneau reçoit `tabindex="0"` pour rester atteignable au clavier même quand il
ne contient aucun élément focalisable.

### Vocabulaire affiché

Un libellé vu par l'utilisateur n'est jamais abrégé : le régime d'une section
s'affiche **« Enseignants-chercheurs »** en toutes lettres (badge, méta d'une
ligne d'affaire, colonne « Régime »), jamais « EC ». Seuls les sigles portés par
les données (acronymes de section, `INE`, `CNU`) restent tels quels.

Le vocabulaire de la procédure est celui des textes : la **saisine** est l'acte
par lequel l'autorité porte les faits devant la section (sa date, son auteur et
la lettre de saisine) ; le rapport établi ensuite s'appelle le **rapport
d'instruction** (art. R.811-29 du code de l'éducation ; art. R.712-33 pour la
commission d'instruction des enseignants-chercheurs). Il n'existe pas de
« rapport de saisine » : le modèle portait ce nom, il est repris au chargement
(`migrerRapport`, `COLONNES_RENOMMEES` dans `schema.js`) — valeurs conservées,
et balise `{{Affaire}}.Rapport_d_instruction` pour les trames. Le rapport est
**une pièce**, produite comme un document (voir « Le rapport d'instruction est
un document ») : ses deux colonnes d'affaire sont conservées pour les documents
antérieurs, mais ne sont plus proposées à la saisie.

### Correctif de contraste (Perchance)

Le tout début de `styles.css` contient un bloc intitulé **« Rétablissement des
couleurs des composants DSFR »**. Il ne faut pas le supprimer.

Lorsque la page est servie par la plateforme Perchance, celle-ci injecte un
reset qui contient :

```css
button:not([disabled]), input:not([disabled]), select:not([disabled]),
textarea:not([disabled]), optgroup:not([disabled]) { color: inherit; }
```

`:not([disabled])` comptant comme un sélecteur d'attribut, ce reset a une
spécificité de (0,1,1) — supérieure à celle des composants DSFR (0,1,0). Sans
le correctif, le libellé d'un bouton primaire repasse en gris foncé sur le bleu
France (contraste 1,31:1) et les champs perdent leur couleur de libellé. Le bloc
rétablit ces couleurs avec une spécificité au moins égale ; il est sans effet
ailleurs. Toute refonte de `styles.css` doit conserver ce bloc en tête de
fichier.

Même origine, même bloc : le reset impose aussi

```css
input[type="search"] { box-sizing: content-box; }
```

ce qui fait déborder tout champ de recherche de la largeur de son conteneur,
du montant de son rembourrage horizontal (2rem) — le champ de recherche des
affaires comme celui de la palette de variables. Le bloc contient donc
`input[type="search"].fr-input { box-sizing: border-box; }`.

### Mise en page : pièges traités dans `styles.css`

Une passe de contrôle graphique (ordinateur, tablette et téléphone, thème clair
comme sombre) a mis au jour une série de défauts d'alignement et de rognage.
Chacun est corrigé par une règle commentée dans `styles.css` :

- **Marge fantôme d'un champ en ligne** — le DSFR espace deux champs **empilés**
  par `margin-bottom: 1.5rem` posée sur tout champ `:not(:last-child)`
  (spécificité 0,2,0). Une barre de filtres, elle, range ses champs dans un
  `flex` aligné **par le bas** et les espace par un `gap` : la marge s'y ajoutait
  quand même, et décollait tous les champs **sauf le dernier** de vingt-quatre
  pixels — les libellés et les contrôles se lisaient en escalier (barres des
  Documents, de l'Attribution, des Décisions, des Affaires). La règle qui
  annulait cette marge (`margin: 0`, spécificité 0,1,0) ne l'emportait que sur le
  dernier champ, le seul que le DSFR ne touchait pas. Elle est portée à (0,2,0)
  et (0,3,0) ; l'écart est désormais relevé par `verifierAlignement`, qui
  mesure aussi les barres et pas seulement les grilles.
- **Contenu des panneaux repliables** — le navigateur enveloppe le contenu d'un
  `<details>` dans la pseudo-boîte `::details-content`, dont le `box-sizing`
  vaut `content-box`. Comme `styles.css` hérite `box-sizing` (règle
  `*, ::before, ::after`), **tout** contenu de panneau repliable passait en
  `content-box` : les champs d'un formulaire et les colonnes en pourcentage
  débordaient de leur conteneur (champ de 404 px dans une colonne de 340 px,
  rogné par le `overflow: hidden` du panneau). Corrigé par
  `details::details-content { box-sizing: border-box; }`.
- **Bloc-marque de l'en-tête** — le DSFR laisse le bloc « logo de l'État +
  logo de l'opérateur » se comprimer, et le rogne ; sur un écran de largeur
  moyenne le logo de l'établissement était donc coupé sur son bord droit
  (totalement invisible autour de 1 024 px). Le bloc-marque ne se comprime plus
  (`flex: 0 0 auto`) : c'est le titre du service qui se replie.
- **En-tête sur écran étroit** — marque et outils se partageaient la même
  ligne : le titre du service se repliait sur trois lignes dans une colonne de
  190 px, à côté d'outils empilés sur quatre. Les outils prennent leur propre
  ligne, en pleine largeur. Le nom de l'utilisateur, comprimé à zéro par le
  badge de rôle, est préservé (le badge passe à la ligne).
- **Bloc-marque du pied de page** — la largeur naturelle de « RÉPUBLIQUE
  FRANÇAISE » tombe pile sur la largeur disponible : un écart infime de
  métriques de police le faisait se replier au milieu du mot. Le libellé est
  désormais insécable (`white-space: nowrap`) ; le `<br>` du balisage fixe les
  deux lignes.
- **Tableaux** — une cellule tronquée le dit maintenant (`text-overflow:
  ellipsis`), sauf dans les cellules d'action (un « … » se dessinerait sur
  l'icône) ; les en-têtes se replient au lieu d'être coupés au milieu d'un mot.
  Sous `48em`, les tables à colonnes figées repassent en `table-layout: auto`
  et défilent horizontalement dans leur conteneur, au lieu de comprimer leurs
  colonnes jusqu'à quelques pixels (colonne « Détail » réduite à 4 px). La
  colonne d'action du rôle d'une séance est dimensionnée pour son bouton.
- **Fenêtre modale** — les formulaires longs (création d'une affaire, ~1 300 px)
  dépassaient la hauteur de l'écran et le bouton d'enregistrement se trouvait
  hors de vue, jusqu'à 400 px sous le bas de la fenêtre. La fenêtre est
  plafonnée à l'espace offert par le fond (`100vh - 8vh`) : c'est le corps qui
  défile, l'en-tête et le pied restent en place.

## 7. Audit — prompt, registre et rapports

L'outil se fait auditer, à intervalles réguliers, par un comité de quatre
personnes — le **directeur des systèmes d'information**, le **responsable de la
sécurité des systèmes d'information**, le **qualiticien** (accessibilité,
interfaces, complétude) et le **directeur des affaires juridiques et du service
des assemblées**, qui commande l'outil. Chacun ouvre un chapitre du rapport, qui
peut être subdivisé en sections ; l'audit porte autant sur ce qui est conforme
que sur ce qui ne l'est pas, et relève les non-conformités — majeures ou
mineures — pour le prochain audit. Un audit représente au moins une heure de
travail.

Trois fichiers, sous `src/audit/` :

| Fichier | Rôle |
| --- | --- |
| `audit/PROMPT-AUDIT.md` | **Le prompt d'audit**, réutilisable tel quel : il définit les quatre auditeurs, la méthode, le référentiel, la fiche de non-conformité, le squelette du rapport et les lieux de stockage. Se lit et se donne tel quel pour lancer une campagne. |
| `audit/registre.json` | **Le registre des non-conformités** : identifiant stable par constat, gravité, priorité, statut, référentiel, preuve, proposition, historique. Lu au début de chaque audit, mis à jour à la clôture — c'est lui qui rend deux campagnes comparables. |
| `audit/rapports/` | Les **rapports**, un par campagne : `audit-AAAA-MM-JJ.md`. |

Ces fichiers ne font pas partie de l'archive de déploiement : `export.js`
n'exporte que le graphe de modules partant de `index.html`. Ils sont en revanche
publiés avec le générateur — le rapport est un document public, qui décrit les
faiblesses pour celui qui les corrigera, jamais un mode opératoire d'attaque.

**La remédiation est une autre tâche.** L'audit constate et propose ; les
correctifs, eux, se décident et s'exécutent à part. Quand un constat est corrigé,
le registre le porte au statut `corrigee` avec, dans son `historique`, la date et
la description de ce qui a été fait — c'est cette trace qui rend le prochain
audit comparable, et qui évite de rechercher ce qui a déjà été traité. La
livraison qui applique les propositions est décrite dans `CHANGELOG.md`.

## 8. Crédits

- Système de design de l'État — <https://www.systeme-de-design.gouv.fr/>
  (chargé depuis jsDelivr, version épinglée `1.15.3`).
- Modèle métier repris du document Grist « Gestion des sections
  disciplinaires ».
