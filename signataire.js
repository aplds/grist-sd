// Le signataire des courriers.
//
// Une section disciplinaire a un président ; quand il est empêché, c'est son
// vice-président qui signe. L'empêchement se déclare à deux niveaux, et les
// deux se cumulent :
//
//  - celui de la **section** — toutes ses pièces, pour une présidence
//    durablement assurée par le vice-président (colonne `VP` de
//    `Sections_disciplinaires`, réglée dans « Réglages › Sections et
//    membres ») ;
//  - celui du **document** — une seule pièce, pour une absence brève, qui est
//    le cas ordinaire (colonne `VP` de `Generateur`, réglée dans les
//    paramètres du document, sous la main, au moment où on le rédige).
//
// Dès que l'un des deux l'affirme, le vice-président signe : une section tenue
// par son vice-président ne produit pas de courrier signé par un président
// absent. Le réglage du document sert donc à **ajouter** une absence à celle
// de la section — ce qu'attend exactement une absence de courte durée,
// déclarée sur la pièce concernée et oubliée avec elle.
//
// Le nom du signataire, sa formule (« Le président », « La vice-présidente »)
// et sa formule complète ne sont pas recopiés ici : ils sont recalculés depuis
// les membres par les colonnes calculées de la section (voir `formulas.js`),
// appliquées au rôle effectif. Une seule règle, donc, pour les deux niveaux.

import { Context } from "./formulas.js";

/** Rôle du signataire, tel que l'écrivent les membres et les trames. */
function roleDuSignataire(vicePresident) {
  return vicePresident ? "Vice-Président" : "Président";
}

/** Qualité du signataire, telle qu'elle s'écrit au bas d'un courrier. */
function qualiteDuSignataire(vicePresident) {
  return vicePresident ? "vice-président de la section" : "président de la section";
}

/**
 * Le vice-président remplace-t-il le président pour ce document ?
 *
 * `section` et `doc` peuvent être nuls l'un ou l'autre : il suffit que l'un
 * des deux réglages soit coché. `doc` absent, c'est le réglage de la section
 * qui répond — utile à tous les écrans qui parlent d'une section sans
 * document.
 */
export function vicePresidentEffectif(section, doc) {
  return Boolean(doc?.VP) || Boolean(section?.VP);
}

/**
 * Le signataire d'une section, pour un rôle effectif : les membres qui portent
 * ce rôle, leur nom réuni, et les formules qui les désignent.
 *
 * Le calcul passe par un contexte neuf. Les colonnes calculées sont mémorisées
 * par table et par identifiant de ligne (voir `Context.v` dans `formulas.js`),
 * et la section recalculée porte le même identifiant que la vraie : un
 * contexte déjà servi rendrait la valeur du réglage d'origine, et le document
 * garderait le signataire de la section au lieu de celui qu'on vient de
 * déclarer.
 */
export function signataireDeLaSection(db, section, vicePresident) {
  if (!section) return null;
  const ctx = new Context(db);
  const copie = { ...section, VP: vicePresident ? 1 : 0 };
  const role = roleDuSignataire(vicePresident);
  return {
    vicePresident,
    role,
    qualite: qualiteDuSignataire(vicePresident),
    membres: ctx
      .table("Membres")
      .filter((m) => Number(m.Section) === Number(section.id) && m.Role === role),
    // Rôle sans titulaire : la formule de la section annonce l'absence plutôt
    // que de laisser la signature sans nom (voir `formulas.js`).
    nom: ctx.v("Sections_disciplinaires", copie, "President"),
    formule: ctx.v("Sections_disciplinaires", copie, "Formule"),
    formule_complete: ctx.v("Sections_disciplinaires", copie, "Formule_complete"),
  };
}
