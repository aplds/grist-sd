
## 2026-11-17 — Doublon des noms dans la colonne « Intervenants » (onglet Commission)

- Symptôme (Arno, production) : dans Affaires puis Commission, colonne Intervenants, deux champs superposés avec la même valeur.
- Cause : DSFR pose "display: block" sur la classe fr-select (spécificité 0,1,0) ; l'attribut hidden posé par select-recherche.js perd contre toute règle d'auteur : le select natif restait peint sous la combobox. Doublon générique, pas propre à la colonne Intervenants : tout select comptant au moins 12 options.
- Correction : styles.css — règle select.fr-select[hidden] avec display:none (0,1,1), commit 3a42fef.
- Vérifications : page dédiée headless mesurant le display calculé avec DSFR et styles.css réels (none) ; 60/60 invariants (tests/index.html) ; 25/25 écrans (runner reconstruit depuis index.html, fumerEcrans attente 500 ms, virtual-time-budget 250000).
- Le blocage précédent du rendu headless venait du mode virtual-time-budget : les imports CDN ne se terminent pas en temps virtuel ; en temps réel l'app rend.
- Le runner écrans a été supprimé après usage ; recette : copier index.html, injecter avant la fermeture du body un script classique (écouteur window load, poll du div app, fumerEcrans attente 500, rapport dans un div), lancer avec virtual-time-budget=250000.

## 2026-11-17 — Ronds moulinants en permanence sur les blocs d'export

- Symptôme (Arno) : plein de petits ronds qui moulinent indéfiniment, sans action en cours.
- Cause : même famille que le doublon des Intervenants — l'attribut hidden perd contre toute règle d'auteur. L'indicateur d'export (app-spinner, display inline-block) et la barre d'état (app-export__status, display flex) sont posés avec hidden dans les gabarits et restaient peints en permanence, tout comme le select masqué par la recherche.
- Correction : règle générale [hidden] { display: none !important } dans styles.css (commit 14f794f), qui remplace et généralise la règle select-only 3a42fef.
- Vérifications : display calculé none sur cinq cas types (select fr-select, span app-spinner, p app-export__status, bouton fr-btn, p fr-error-text) ; 60/60 invariants ; 25/25 écrans.
- Recette écrans robustifiée : le CDN jsdelivr est erratique depuis Argon (les boots headless échouent par intermittence). Rapatrier DSFR (dsfr.min.css, dsfr.module.min.js, icons.min.css) en local le temps du test, runner reconstruit depuis index.html avec liens locaux et sans integrity, puis --virtual-time-budget=120000 avec fumerEcrans attente 500 : parcours complet en une passe fiable. Le dump --timeout=N en temps réel capture la page trop tôt (avant la fin de fumerEcrans).
