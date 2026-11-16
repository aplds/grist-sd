# Sécurité et chaîne d'approvisionnement

Ce document rassemble ce qui protège la page des **dépendances tierces** et ce
qu'il faut faire pour déployer l'outil dans de bonnes conditions (NC-0003). Il
est le complément technique de la déclaration d'accessibilité
(`accessibilite/`) et du dossier de conformité (`rgpd/`) : l'audit a relevé que
l'outil s'appuyait sur des bibliothèques chargées chez des tiers **sans
contrôle d'intégrité ni politique de sécurité du contenu**.

## Ce que la page charge hors de son hébergement

Tout est énuméré dans `dependances.js` — source unique, à revoir d'un seul
regard.

| Brique | Version | Adresse | Emploi | Intégrité |
| --- | --- | --- | --- | --- |
| DSFR (feuille) | 1.15.3 | `cdn.jsdelivr.net` | mise en page de l'interface | `integrity` (SHA-384) |
| DSFR (icônes) | 1.15.3 | `cdn.jsdelivr.net` | icônes | `integrity` (SHA-384) |
| DSFR (module) | 1.15.3 | `cdn.jsdelivr.net` | thème et composants | `integrity` (SHA-384) |
| DSFR (utilitaires) | 1.15.3 | `cdn.jsdelivr.net` | documents imprimés | — (référencée par le rendu) |
| DSFR (polices) | 1.15.3 | `cdn.jsdelivr.net` | police Marianne du PDF | — (chargée par le PDF) |
| public-sans | 2020 | `user.uploads.dev` | police des documents (charte neutre) | — |
| xlsx (SheetJS) | 0.18.5 | `esm.sh` | lecture et écriture des classeurs | — |
| sql.js | 1.11.0 | `cdn.jsdelivr.net` | lecture des bases `.grist` | — |
| pdfmake | 0.2.20 | `esm.sh` | composition des PDF | — |
| docx | 9.5.1 | `esm.sh` | assemblage des fichiers Word | — |
| pdf-lib | 1.17.1 | `esm.sh` | conversion PDF/A-2b | — |

Les bibliothèques chargées **à la demande** (xlsx, sql.js, pdfmake, docx,
pdf-lib) ne peuvent pas porter d'attribut d'intégrité : la plateforme ne le
permet pas sur un `import()`. Leur version est donc **figée** dans
`dependances.js`, et leur origine restreinte par la politique de sécurité du
contenu ci-dessous. Elles ne se chargent qu'au moment de l'action qui les
emploie — jamais au chargement de la page.

### Vérifier ou mettre à jour les empreintes

Les empreintes SHA-384 des trois fichiers statiques vivent dans `SRI`
(`dependances.js`) et sont posées en attribut `integrity` dans `index.html`. Une
montée de version du DSFR demande de les recalculer :

```js
const url = "https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@1.15.3/dist/dsfr/dsfr.min.css";
const buf = await (await fetch(url)).arrayBuffer();
const d = await crypto.subtle.digest("SHA-384", buf);
"sha384-" + btoa(String.fromCharCode(...new Uint8Array(d)));
```

Le navigateur **refuse** un fichier dont l'empreinte ne correspond pas : c'est
le contrôle qui manquait, et c'est aussi ce qui fait échouer la page entière si
le tiers change un fichier sans prévenir. Il faut donc monter de version **et**
recalculer l'empreinte en même temps.

## Politique de sécurité du contenu

Elle restreint ce que la page peut charger : elle-même, le DSFR, esm.sh, et les
images hébergées. `'unsafe-inline'` et `'unsafe-eval'` restent nécessaires (la
page s'assemble par scripts et styles en ligne, et les documents rendus
s'écrivent dans un cadre) ; la politique garde tout son intérêt, puisqu'elle
**ferme les origines** : un script servi par une page tierce ne s'exécute pas.

### Page autonome (archive exportée)

La politique est posée par une balise `<meta>` dans `index.html` de l'archive.
Rien à faire : elle est déjà là.

### Page hébergée par Perchance

La page du générateur n'a pas de `<head>` où poser cette balise : la politique
doit être servie **en en-tête HTTP** par le déploiement (serveur, proxy, ou
fonction de bord). Voir `index.html`, en tête du corps.

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net https://user.uploads.dev; connect-src 'self' blob: data: https:; worker-src 'self' blob:; frame-src 'self' blob: data: https:
```

## Origines Grist autorisées

Le widget Grist charge, depuis le serveur du document, le script de l'API du
widget. L'exécuter sans contrôle reviendrait à exécuter le script de n'importe
quelle page qui encadrerait l'outil : l'origine n'est donc retenue que si elle
est **autorisée**. Sont autorisées :

- sans réglage, les instances publiques `docs.getgrist.com` et `getgrist.com`,
  ainsi que l'instance souveraine de l'État `grist.numerique.gouv.fr` ;
- une origine **déclarée** par le déploiement :
  - balise `<meta name="grist-origins" content="grist.mon-etablissement.fr">`
    dans `index.html` ;
  - ou variable `window.GRIST_ALLOWED_ORIGINS = ["grist.mon-etablissement.fr"]` ;
  - ou saisie dans Réglages › Données › Serveur Grist déclaré (conservée sur le
    poste, sous la clé `sections-disciplinaires.grist-origines.v1`).

Toute autre origine est refusée et le chargement se rabat sur l'instance
publique. Le paramètre `?grist=1` **force la détection** du widget sans
autoriser aucune origine : un serveur auto-hébergé doit toujours être déclaré.
Réglages › Données › Diagnostic affiche l'origine de la page appelante, les
origines autorisées et les serveurs déclarés sur le poste, ce qui permet de
diagnostiquer un widget qui ne se connecte pas.

## Hébergement des polices

Les polices sont **servies par l'outil**, et non par un tiers : les woff2 de la
charte et les TTF de Public Sans vivent sur l'hébergement de l'outil
(`user.uploads.dev`), et un document exporté embarque de toute façon les siennes
(voir `pdf-fonts.js`). Le dessin de **Marianne** — la police de l'État, dont la
licence ne permet pas la redistribution par un tiers — est repris à la même
version du DSFR que l'interface, et converti en TrueType au moment de l'export.

## Mode dégradé : ce qui se passe quand un tiers manque

- **Le DSFR ne se charge pas** (intégrité en échec, réseau) : la page reste
  utilisable — les données, les formulaires et les documents ne dépendent que de
  l'hébergement de l'outil —, mais sans la mise en page de l'État.
- **esm.sh ou jsdelivr ne répondent pas** : les actions qui emploient une
  bibliothèque (import d'un classeur ou d'une base `.grist`, export PDF, Word,
  Excel) échouent avec un message explicite ; **le CSV et l'impression du
  navigateur**, eux, ne demandent aucune bibliothèque et restent disponibles.
- **La police d'un document est introuvable** : l'export **PDF** s'arrête avec
  un message clair (il ne peut pas composer sans sa police) ; les exports Word
  et OpenDocument nomment la police sans l'embarquer, et aboutissent.
- **La conversion PDF/A échoue** : le PDF ordinaire est conservé, l'auteur en
  est **prévenu à l'écran** (l'onglet Documents le rappelle) — un document sans
  marquage d'archivage vaut mieux qu'aucun document, mais il ne doit pas passer
  pour un PDF d'archivage.

## Poste de travail : stockage local, verrouillage

Le stockage autonome est le point faible d'une donnée sensible : la base est
écrite **en clair** dans le `localStorage` de l'origine. L'outil en limite les
conséquences.

- **Mode session** (Réglages › Données) : rien n'est conservé sur le poste.
- **Verrouillage d'écran** : un code défini par l'utilisateur, dont seule
  l'empreinte SHA-256 est conservée, déverrouille la session ; chaque
  déverrouillage est journalisé, cinq tentatives infructueuses suspendent la
  saisie. **Sans code défini, l'écran se couvre sans contrôler l'accès** — et le
  panneau de confidentialité le dit honnêtement, plutôt que de laisser croire à
  une protection qui n'existe pas.
- **Échec d'écriture** : un quota atteint n'est jamais silencieux — bandeau
  persistant avec la cause, entrée au `Journal`, ligne au journal de diagnostic.
  L'occupation du stockage est mesurée et signalée à 60 % puis 85 %.
- **Ce que le poste conserve malgré tout** : les exports (JSON, CSV, PDF, Word)
  sont des copies en clair, hors du contrôle de l'outil ; leur destruction
  relève de l'organisation (voir `rgpd/DUREES-DE-CONSERVATION.md`, § 3).

## Signaler un problème de sécurité

Voir la voie de contact de la déclaration d'accessibilité
(`accessibilite/DECLARATION-ACCESSIBILITE.md`) : le point de contact de
l'établissement y est publié, et c'est par lui que passe aussi un signalement de
sécurité.
