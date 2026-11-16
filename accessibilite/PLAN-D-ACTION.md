# Plan d'action accessibilité — année en cours

*Déclinaison annuelle du schéma pluriannuel (`SCHEMA-PLURIANNUEL.md`). Le plan
est tenu à jour à chaque livraison ; l'état d'avancement est visible dans
l'outil, à l'adresse `#accessibilite`.*

## État d'avancement

| Action | Référence | Priorité | État | Responsable |
| --- | --- | --- | --- | --- |
| Corriger la hiérarchie des titres (H1 → H2 → H3) | NC-0012 | Haute | **Fait** | Équipe technique |
| Supprimer le débordement horizontal à 320 px | NC-0013 | Haute | **Fait** | Équipe technique |
| Publier la déclaration, le schéma et le plan | NC-0014 | Haute | **Fait** | Référent accessibilité |
| Passer un audit RGAA complet par un prestataire | — | Haute | À engager | Responsable de la section |
| Rendre l'éditeur de rédaction utilisable au clavier | — | Moyenne | À planifier | Équipe technique |
| Produire des documents PDF balisés, ou documenter l'alternative | — | Moyenne | À planifier | Équipe technique |
| Rejouer les contrôles d'accessibilité avant chaque livraison | — | Moyenne | En place | Équipe technique |
| Former les agents à l'accessibilité des pièces diffusées | — | Basse | À planifier | Référent accessibilité |

## Vérifications rejouables

Les contrôles suivants sont exécutés avant chaque livraison (voir `tests/`) :

- **Structure des titres** : sur chaque écran, aucune rupture de niveau
  (`H1 → H2 → H3`).
- **Adaptation à la largeur** : aucun débordement horizontal à 320 px.
- **Étiquettes de champs** : tout champ de saisie porte une étiquette.
- **Alternatives des images** : toute image de contenu porte un `alt`.
- **Modales** : `role="dialog"`, `aria-modal`, intitulé, focus déplacé.

## Prochaine révision

*Dernière mise à jour : 21 septembre 2026. Prochaine révision : à la prochaine
livraison, et au plus tard à l'engagement de l'audit RGAA complet.*
