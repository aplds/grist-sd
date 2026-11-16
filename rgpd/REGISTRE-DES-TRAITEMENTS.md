# Registre des traitements — sections disciplinaires

*Obligation de l'article 30 du règlement (UE) 2016/679 (RGPD). À tenir à jour
par l'établissement. Les valeurs entre `<...>` sont à compléter par le
responsable de traitement ; les durées renvoient à `DUREES-DE-CONSERVATION.md`.*

## 1. Identification

| Élément | Valeur |
| --- | --- |
| Responsable de traitement | `<nom et adresse de l'établissement>` |
| Représentant | `<le cas échéant>` |
| Délégué à la protection des données (DPO) | `<nom et coordonnées du DPO>` |
| Service responsable du traitement | Section(s) disciplinaire(s) — `<nom de la section>` |
| Base juridique du traitement | Mission d'intérêt public — procédure disciplinaire : code de l'éducation (L.712-1 et s., R.811-1 et s.), code rural et de la pêche maritime (R.812-1 et s.), code général de la fonction publique (L.532-1 et s.) |
| Finalité | Instruire et juger les manquements disciplinaires, produire et notifier les actes, suivre les recours et l'archivage |

## 2. Catégories de personnes concernées

- **Usagers** : étudiants, candidats, personnes inscrites ou en cours d'inscription.
- **Personnels** : enseignants-chercheurs, enseignants, personnels BIATSS, autres agents.
- **Tiers** : victimes, témoins, membres des formations, personnes citées dans un dossier.

## 3. Catégories de données

| Catégorie | Exemples | Sensibilité |
| --- | --- | --- |
| Identité | nom, prénom, date et lieu de naissance, adresse, courriel | personnelle |
| Situation administrative | composante, formation, corps ou grade, statut | personnelle |
| Faits reprochés | exposé des faits, qualification, pièces du dossier | **art. 9 et 10 RGPD possibles** (infraction, santé si mentionnée) |
| Procédure | saisines, rapports, séances, délibérés, décisions, votes | personnelle |
| Sanctions | nature, durée, sursis, terme | personnelle |
| Recours | recours gracieux et contentieux, suites | personnelle |
| Journal technique | action, date, auteur | personnelle (traçabilité) |

Le traitement peut révéler des données relatives à des **infractions** et,
incidemment, à la **santé** : la procédure disciplinaire y est confrontée par
nature. La qualification et les précautions correspondantes (accès restreint,
journalisation, conservation) en découlent.

## 4. Destinataires

- Membres de la section disciplinaire (composition en formation).
- Secrétariat de la section, pour l'instruction et la notification.
- Autorités destinataires des actes (recteur, ministère, CNESER, CNESERAAV, tribunal administratif).
- Aucun autre destinataire. **Aucun transfert hors Union européenne. Aucun
  sous-traitant** : l'outil fonctionne en local ou dans le document Grist de
  l'établissement (voir la fiche « Vie privée » du `README.md`).

## 5. Durées de conservation

Voir `DUREES-DE-CONSERVATION.md`. Les durées sont réglées dans l'outil
(`Parametres`) et rappelées sur la fiche de l'affaire.

## 6. Mesures de sécurité

- Accès limité par les droits Grist (propriétaire, éditeur, lecteur) et par la
  table technique des utilisateurs.
- Journalisation des actions (table `Journal`).
- Réduction de la surface d'attaque : l'outil est un **client pur**, sans
  serveur ; les dépendances tierces sont figées et vérifiées ; le balisage
  importé est assaini et les valeurs échappées au rendu.
- Copie de sauvegarde : export JSON, `.grist`, ou sauvegarde du document Grist.

## 7. Analyse d'impact

Voir `DECISION-ANALYSE-D-IMPACT.md`.

## 8. Information des personnes

Voir `MENTIONS-D-INFORMATION.md`.

*Dernière mise à jour : 21 septembre 2026.*
