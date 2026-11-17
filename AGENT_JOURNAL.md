
## 2026-11-17 — Doublon des noms dans la colonne « Intervenants » (onglet Commission)

- Symptôme (Arno, production) : dans Affaires puis Commission, colonne Intervenants, deux champs superposés avec la même valeur.
- Cause : DSFR pose "display: block" sur la classe fr-select (spécificité 0,1,0) ; l'attribut hidden posé par select-recherche.js perd contre toute règle d'auteur : le select natif restait peint sous la combobox. Doublon générique, pas propre à la colonne Intervenants : tout select comptant au moins 12 options.
- Correction : styles.css — règle select.fr-select[hidden] avec display:none (0,1,1), commit 3a42fef.
- Vérifications : page dédiée headless mesurant le display calculé avec DSFR et styles.css réels (none) ; 60/60 invariants (tests/index.html) ; 25/25 écrans (runner reconstruit depuis index.html, fumerEcrans attente 500 ms, virtual-time-budget 250000).
- Le blocage précédent du rendu headless venait du mode virtual-time-budget : les imports CDN ne se terminent pas en temps virtuel ; en temps réel l'app rend.
- Le runner écrans a été supprimé après usage ; recette : copier index.html, injecter avant la fermeture du body un script classique (écouteur window load, poll du div app, fumerEcrans attente 500, rapport dans un div), lancer avec virtual-time-budget=250000.
