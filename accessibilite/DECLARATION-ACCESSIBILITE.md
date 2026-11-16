# Déclaration d'accessibilité

*Obligation de l'article 47 de la loi n° 2005-102 du 11 février 2005. Cette
déclaration est également présentée dans l'outil, à l'adresse
`#accessibilite`, et atteignable depuis la page Aide et le pied de page.*

## État de conformité

`<Nom de l'établissement>` s'engage à rendre son service numérique accessible.

**Accessibilité partiellement conforme.**

Cette déclaration a été établie le **21 septembre 2026**. L'outil n'a pas encore
fait l'objet d'un **audit de conformité RGAA 4.1 complet et opposable** : l'état
de conformité repose sur un **audit interne**, dont les non-conformités sont
déclarées ci-dessous sans être minimisées. Le taux de conformité ne peut donc
pas être calculé en toute rigueur.

## Résultats des tests

L'audit interne du 21 septembre 2026 a mesuré, écran par écran, une partie des
critères du RGAA 4.1 : structure du document, adaptation à la largeur,
contraste, étiquettes de champs, alternatives textuelles des graphiques, recours
au clavier. Le rapport complet est versionné avec l'outil :

- `src/audit/rapports/audit-2026-09-21.md` ;
- registre des constats : `src/audit/registre.json`.

Mesurés conformes à la date de cette déclaration :

- étiquettes de champs associées à chaque champ de saisie ;
- contrastes suffisants pour les textes d'aide et les titres ;
- aucune valeur positive de `tabindex` (l'ordre de tabulation suit le document) ;
- alternatives textuelles présentes pour tous les graphiques du rapport ;
- fenêtres modales titrées, marquées `role="dialog"` et `aria-modal` ;
- navigation par titres sans saut de niveau ;
- absence de débordement horizontal jusqu'à 320 px de large.

## Contenus non accessibles

- **Documents exportés au format PDF non balisés.** Les bibliothèques employées
  (`pdfmake`, `pdf-lib`) ne produisent pas de PDF balisé : titres, listes et
  tableaux n'y sont pas structurés pour un lecteur d'écran. Les formats Word et
  OpenDocument conservent, eux, les balises du document.
- **Interface pensée pour un écran large.** Elle se replie jusqu'à 320 px, mais
  certaines actions groupées supposent une souris ou un écran tactile large.
- **Éditeur de rédaction** (mise en forme, palette de balises, insertion de
  tableaux et d'images) reposant sur `contenteditable` : pas encore
  d'utilisation entièrement au clavier ni de retour vocal.
- **Graphiques du rapport d'activité** : alternatifs textuels mais résumés, et
  non descriptions exhaustives des données sous-jacentes.

## Non-conformités déclarées

| Référence | Non-conformité | État |
| --- | --- | --- |
| NC-0012 | Saut de niveau de titre sur tous les écrans | Corrigé |
| NC-0013 | Débordement horizontal à 320 px (affaires, Réglages › Sections) | Corrigé |
| NC-0014 | Absence des trois pièces légales d'accessibilité | Corrigé |
| — | PDF exporté non balisé | Ouvert |
| — | Éditeur de rédaction non entièrement utilisable au clavier | Ouvert |

## Amélioration et schéma pluriannuel

L'accessibilité fait l'objet d'un **schéma pluriannuel**
(`src/accessibilite/SCHEMA-PLURIANNUEL.md`) et d'un **plan d'action** annuel
(`src/accessibilite/PLAN-D-ACTION.md`), tenus à jour avec l'outil et publiés par
l'établissement sur son site institutionnel.

## Retour d'information et contact

Si vous n'arrivez pas à accéder à un contenu ou à un service, ou si vous
repérez un défaut d'accessibilité, adressez un signalement au secrétariat de la
section disciplinaire :

- par courriel : `<courriel du secrétariat — Réglages › Sections et membres>` ;
- par courrier : `<adresse postale du secrétariat>`.

Précisez si possible l'écran concerné, la description du problème et l'aide
technique utilisée (lecteur d'écran, loupe, commandes vocales).

## Voie de recours

Si le signalement n'a pas permis d'obtenir une réponse satisfaisante, ou si le
service est resté inaccessible :

- écrire au **Défenseur des droits** — 29, rue Servan, 75011 Paris — ou utiliser
  le formulaire en ligne (`https://formulaire.defenseurdesdroits.fr/`) ;
- téléphoner au **09 69 39 00 00** (appel non surtaxé) ;
- contacter le **délégué du Défenseur des droits** de votre département.

---

*Date de cette déclaration : 21 septembre 2026. Elle est à réviser à chaque
audit, et au plus tard trois ans après son établissement.*
