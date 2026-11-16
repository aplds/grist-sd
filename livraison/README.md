# Variante minifiée et regroupée (livraison)

`src/` est le **dépôt source** : lisible, commenté, fait pour être relu et
corrigé. C'est ce dépôt qui ship, et c'est lui qui compte. Mais servir à chaque
visite cinquante-cinq modules et trois mégaoctets coûte cher aux postes
modestes et aux réseaux contraints (NC-0004). Cette livraison produit, **sans
changer le dépôt source**, une variante minifiée et regroupée.

## Ce qui est produit

| Fichier | Rôle | Taille |
| --- | --- | --- |
| `app.min.js` | tout le JavaScript de `src/` regroupé en **un** module et minifié | ≈ 1,21 Mo (contre ≈ 2,0 Mo) |
| `styles.min.css` | `styles.css` minifié | ≈ 68 ko (contre ≈ 146 ko) |
| `index.min.html` | page d'entrée de la variante (dans ce dossier) | — |

Les deux fichiers ne vivent **pas** dans le dépôt : ce sont des artefacts, à
régénérer à chaque livraison. Ils sont déposés à des adresses stables et cités
dans `index.min.html` :

- `app.min.js` → https://user.uploads.dev/file/9b1e22022925e44fd382fb787aa93107.js
- `styles.min.css` → https://user.uploads.dev/file/774a24935245b5af8df2285b89f08f15.css

## Reconstruire

Le seul outil nécessaire est `esbuild-wasm` — aucune installation : il se charge
depuis esm.sh. Le script `build.mjs` fait tout :

```js
import { build } from "./build.mjs";
const { js, css } = await build(); // { js: Uint8Array, css: string }
```

Il regroupe `app.js` (suivant ses `import` relatifs), minifie le tout,
laisse **externes** les modules chargés à la demande depuis esm.sh
(`pdfmake`, `docx`, `pdf-lib`, `xlsx`), minifie `styles.css`, et rend les
octets. Reste à les déposer (`upload_file`) et à reporter les deux adresses dans
`index.min.html`.

## Limites, et ce qui n'est pas minifié

- Le **Système de design de l'État** (DSFR) reste chargé depuis son CDN, avec
  son empreinte d'intégrité : il n'est pas recopié dans le bundle (voir
  `SECURITE.md`).
- Les fonctions qui s'appuient sur `import.meta.url` — l'**export du site**
  depuis l'onglet Debug, la résolution d'une image de logo par un chemin
  relatif — pointent vers l'emplacement du bundle, et non vers `src/`. Dans la
  variante livrée, l'onglet Debug est fermé (production) ; l'export du site
  reste la tâche du dépôt source.
- Les données et les documents ne changent pas : seule la **livraison du code**
  diffère.
