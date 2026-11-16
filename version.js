// Version livrée de l'outil (NC-0002).
//
// Le numéro suit les trois nombres habituels — majeur.mineur.correctif :
//   · majeur  — une évolution du modèle de données ou de la structure du
//     document, qui demande une reprise ;
//   · mineur  — une fonction nouvelle, sans rupture ;
//   · correctif — une correction.
//
// `VERSION_CONTENUS` est l'empreinte des **contenus livrés** (trames, formats,
// sanctions, motifs, seuils). Elle est comparée à celle qu'une base a vue pour
// la dernière fois afin de signaler à l'administrateur qu'un contenu livré a
// évolué depuis son installation (NC-0005). Elle est incrémentée à chaque fois
// que l'un de ces jeux change, et non à chaque livraison du code.
//
// Le journal des livraisons est tenu dans `CHANGELOG.md`, à la racine du
// projet : il rappelle, livraison par livraison, ce qui a changé et pourquoi.
// La version est affichée dans « Réglages › Données › Diagnostic » et en tête
// du journal de diagnostic, afin qu'un incident puisse être rapporté à une
// livraison précise.

export const VERSION = "2.2.17";
export const VERSION_DATE = "2026-10-01";

/**
 * Empreinte des contenus livrés. À incrémenter dès qu'une trame, un format,
 * un seuil, une sanction ou un motif livré change — même sans changement de
 * code. La forme est libre : elle sert à comparer deux livraisons, pas à être
 * lue.
 */
export const VERSION_CONTENUS = "2026-09-22.1";

/** Libellé court, pour l'affichage : « 1.0.0 (21/09/2026) ». */
export function versionLivraison() {
  const [annee, mois, jour] = String(VERSION_DATE).split("-");
  return `${VERSION} (${[jour, mois, annee].filter(Boolean).join("/")})`;
}

/** Une ligne d'en-tête pour le journal de diagnostic. */
export function ligneVersion() {
  return `${versionLivraison()} — contenus ${VERSION_CONTENUS}`;
}
