# Durées de conservation

*Articles 5.1.e et 17 du règlement (UE) 2016/679 ; code du patrimoine pour le
sort final. Les durées proposées ici sont un point de départ, à ajuster par
l'établissement avec son service d'archives et son DPO.*

## 1. Principes

- Une donnée n'est conservée que le temps nécessaire à la finalité poursuivie.
- Une durée **active** (le dossier est consultable et modifiable) se distingue
  d'une durée **d'archivage** (le dossier est conservé mais n'est plus modifié).
- Le **sort final** (conservation définitive ou élimination) est décidé avec le
  service d'archives et inscrit au tableau ci-dessous.
- Ces durées ne sont **pas tenues par l'outil** : les dossiers et leurs pièces
  vivent hors de lui (seule leur adresse y figure), et la base d'affaires ne
  conserve donc aucun dossier au long cours. La colonne « Réglage » dit, pour
  chaque catégorie, ce qui la gouverne ; toutes ces durées sont des durées de
  **référence**, tenues par l'organisation et par son service d'archives.

## 2. Durées par catégorie

| Catégorie | Durée active | Sort final | Réglage |
| --- | --- | --- | --- |
| Affaire disciplinaire (dossier complet) | durée de la procédure, puis **10 ans** à compter de la décision définitive (à arrêter avec le service d'archives) | versement au service d'archives ou élimination | — (durée de référence) |
| Décision définitive notifiée | **10 ans** (délai de recours contentieux et de retrait) — l'échéance suit celle du dossier | conservation | — (durée de référence) |
| Sanctions effacées du dossier (avertissement, blâme, mesure de responsabilisation) | **3 ans** | élimination | `duree_avertissement_blame_annees` |
| Pièces d'instruction (rapports, procès-verbaux) | suivent le dossier | conservation | suivent le dossier |
| Séances et rôles | **5 ans** | élimination | — (durée de référence) |
| Recours (gracieux, contentieux) et leurs suites | **10 ans** | conservation | — (durée de référence) |
| Journal des actions | **3 ans** | élimination | — (durée de référence) |
| Corbeille (éléments mis de côté) | **12 mois** | élimination | `corbeille_retention_mois` |
| Exports et copies de travail | durée de la remise, puis destruction | élimination | — (hors de l'outil) |

## 3. Mise en œuvre dans l'outil

- **Durée de vie d'un dossier** : l'outil ne la suit pas. Les dossiers et leurs
  pièces sont tenus hors de lui (l'affaire n'en porte que l'**adresse**), et la
  base ne conserve que les données de suivi de la procédure. L'échéance de
  conservation, le sort final et l'état d'archivage relèvent donc du service
  d'archives et de l'organisation, pas de l'outil.
- **Archivage des documents** : les PDF exportés sont convertis au format
  **PDF/A-2b** (`pdf-a.js`) ; l'outil dit quand la conversion a échoué, car un
  PDF ordinaire n'a pas la valeur d'un PDF d'archivage.
- **Suppression** : une ligne supprimée passe par la **corbeille**, datée et
  attribuée (`Supprime_le`, `Supprime_par`), d'où elle peut être restaurée.
- **Purge de la corbeille** : la page *Trames › Corbeille* propose la purge des
  entrées mises de côté depuis plus de `corbeille_retention_mois` mois. La purge
  est **journalisée** avant d'être exécutée.
- **Journal des suppressions** : toute suppression définitive et toute mise à la
  corbeille inscrivent une entrée au `Journal` **avant** d'être exécutées.
- **Exports** : un export JSON, CSV, Excel, PDF ou Word est une **copie hors de
  l'outil** ; il ne bénéficie d'aucune purge automatique. L'établissement en
  décide la conservation et la destruction (voir le registre, § 6).

## 4. Demande d'effacement

Une personne peut demander l'effacement de ses données (art. 17 RGPD). Les
limites : les données nécessaires à la constatation, à l'exercice ou à la
défense de droits en justice, et celles dont la conservation est imposée par la
loi (conservation des actes et pièces de la procédure), en sont exclues. La
réponse à la demande est documentée et versée au dossier.

*Dernière mise à jour : 21 septembre 2026.*
