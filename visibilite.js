// Périmètre de visibilité des affaires.
//
// L'outil est un espace de travail partagé par les secrétaires d'une ou
// plusieurs sections. Chacun n'a pas à parcourir les dossiers de ses collègues :
// **par défaut, un secrétaire ne voit que les affaires qui lui sont
// attribuées** — celles dont la colonne `Secretaire` désigne sa fiche. Un
// propriétaire du document, lui, décide : il peut rester sur ses affaires ou
// demander à voir toute la section d'un seul réglage (mémorisé par navigateur).
//
// Le périmètre s'applique à tout ce qui *montre* des affaires : listes, registre
// des décisions, rôles de séance, documents, listes déroulantes d'affaires,
// tableau de bord et les listes imprimées qui en découlent.
//
// C'est un confort de travail, **pas une protection** : les données restent
// dans le document Grist, et seul Grist peut en restreindre l'accès (règles de
// partage, colonnes masquées). Le filtre porte sur l'affichage ; les formules,
// les trames et les documents continuent de voir l'ensemble de la base, sans
// quoi les lettres et les totaux seraient faux.
//
// Règle de repli : si la personne n'a **aucune fiche secrétaire** (lecteur,
// personne non identifiée, table des secrétaires vide), rien n'est restreint.
// Mieux vaut montrer trop que de laisser quelqu'un devant un outil vide.

import { currentRole } from "./roles.js";

/** Clé du réglage mémorisé : « voir toutes les affaires ». */
export const VOIR_TOUT = "voirToutAffaires";

/** Fiches secrétaires de la personne connectée (rapprochées par courriel). */
export function mesFiches(store, state) {
  // Hors Grist, il n'y a pas d'identité réelle : l'onglet Debug peut en
  // simuler une (choix d'une fiche secrétaire) pour éprouver ce périmètre.
  const email = String(state?.debugEmail || state?.user?.email || "").trim().toLowerCase();
  if (!email) return [];
  return store.table("Secretaires").filter((s) => String(s.Email || "").trim().toLowerCase() === email);
}

/**
 * La personne peut-elle décider de voir toutes les affaires ? Réservé aux
 * propriétaires du document : eux seuls arbitrent la répartition.
 */
export function peutVoirTout(state) {
  return currentRole(state) === "administrateur";
}

/** Le réglage « toutes les affaires » est-il actif ? */
export function voirTout(state) {
  return peutVoirTout(state) && !!state.filters[VOIR_TOUT];
}

/** Le périmètre est-il restreint aux affaires attribuées à la personne ? */
export function perimetreRestreint(store, state) {
  if (voirTout(state)) return false;
  return mesFiches(store, state).length > 0;
}

/** La personne suit-elle cette affaire ? */
export function affaireVisible(store, state, affaire) {
  if (!affaire || !perimetreRestreint(store, state)) return true;
  const id = Number(affaire.Secretaire) || 0;
  return !!id && mesFiches(store, state).some((s) => s.id === id);
}

/** Affaires visibles d'une liste. Le tableau reçu n'est jamais modifié. */
export function affairesVisibles(store, state, rows) {
  if (!perimetreRestreint(store, state)) return rows;
  const ids = new Set(mesFiches(store, state).map((s) => s.id));
  return rows.filter((a) => ids.has(Number(a.Secretaire) || 0));
}

/**
 * Enregistrements rattachés à une affaire — décisions, documents, lignes de
 * commission… : le périmètre suit celui de l'affaire. `getAffaire` lit
 * l'identifiant de l'affaire sur l'enregistrement.
 */
export function parAffaire(store, state, rows, getAffaire) {
  if (!perimetreRestreint(store, state)) return rows;
  const vues = new Set(affairesVisibles(store, state, store.table("Affaires")).map((a) => a.id));
  return rows.filter((r) => vues.has(Number(getAffaire(r)) || 0));
}

/**
 * Phrase d'explication affichée en tête des listes concernées — `null` quand
 * le périmètre n'est pas restreint. `action` ajoute, pour un propriétaire, le
 * geste qui consiste à élargir la vue.
 */
export function mentionPerimetre(store, state, { nombre = null } = {}) {
  if (!perimetreRestreint(store, state)) return null;
  const compte = nombre === null ? affairesVisibles(store, state, store.table("Affaires")).length : nombre;
  const fiche = mesFiches(store, state)[0];
  // Le nom complet est une colonne calculée : on le lit par le moteur de
  // formules, avec le prénom et le nom bruts en secours.
  const nom = fiche
    ? (String(state.ctx?.v("Secretaires", fiche, "Nom_complet") || "").trim()
      || [fiche.Prenom, fiche.Nom].filter(Boolean).join(" "))
    : "";
  return `Vous ne voyez que les affaires qui vous sont attribuées${nom ? ` (${nom})` : ""}`
    + ` — ${compte} affaire${compte > 1 ? "s" : ""}.`;
}

/** Libellé de l'action offerte à un propriétaire pour élargir le périmètre. */
export const LIBELLE_VOIR_TOUT = "Voir toutes les affaires";
