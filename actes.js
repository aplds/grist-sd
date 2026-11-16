// Registre des actes — numérotation des décisions (NC-0020).
//
// Seule l'affaire portait un numéro (`Affaires.Numero`). Les décisions, elles,
// n'en avaient aucun : une décision disciplinaire ne pouvait être citée que par
// sa date et son affaire, et rien ne permettait de vérifier qu'une série était
// complète. Ce module tient la numérotation des actes :
//
//  - `prefixeActes` — le préfixe d'une section (son acronyme) ;
//  - `prochainNumeroActe` — le numéro suivant, séquence **par section et par
//    année** (par exemple « UDA-2026-007 ») ; la séquence ne réutilise jamais un
//    numéro déjà attribué ;
//  - `numeroerActes` — attribue les numéros manquants, dans l'ordre
//    chronologique des actes (délibéré, à défaut notification) ;
//  - `registreActes` — le registre chronologique, pour la consultation et
//    l'export.
//
// Pur : rien ici n'écrit dans la base. L'action de l'interface applique, et
// journalise numéro par numéro.

import { Context, toDate } from "./formulas.js";

/** Préfixe des actes d'une section : son acronyme, ou « SD » à défaut. */
export function prefixeActes(section) {
  const acronyme = String(section?.Acronyme || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return acronyme || "SD";
}

/** Numéro d'acte : `PREFIXE-ANNEE-RANG`, rang sur trois chiffres. */
export function numeroActe(prefixe, annee, rang) {
  return `${prefixe}-${annee}-${String(Math.max(1, Number(rang) || 1)).padStart(3, "0")}`;
}

/** Échappe un littéral dans une expression régulière. */
function echapper(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Numéro suivant dans la séquence d'une section pour une année, d'après les
 * numéros déjà attribués. Le rang est le plus grand rang utilisé, plus un : une
 * suppression ne fait donc jamais rejouer un numéro.
 */
export function prochainNumeroActe(numeros, prefixe, annee) {
  const motif = new RegExp(`^${echapper(prefixe)}-${echapper(annee)}-(\\d+)$`);
  let max = 0;
  for (const numero of numeros) {
    const m = motif.exec(String(numero || "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return numeroActe(prefixe, annee, max + 1);
}

/** Année d'un acte : celle de son délibéré, à défaut de sa notification. */
export function anneeDeLActe(decision) {
  const d = toDate(decision?.Date_du_delibere) || toDate(decision?.Date_de_notification);
  return d ? d.getFullYear() : null;
}

/** Date de l'acte, pour l'ordre chronologique du registre. */
function dateDeLActe(decision) {
  const d = toDate(decision?.Date_du_delibere) || toDate(decision?.Date_de_notification);
  return d ? d.toISOString().slice(0, 10) : "";
}

/**
 * Attribue un numéro aux décisions qui n'en ont pas.
 *
 * `contexte` fournit, pour une décision, la section de son affaire :
 * `{ sectionDe(decision) → section|null, annee: number }`. Les décisions sont
 * numérotées dans l'ordre chronologique de leur section et de leur année, ce
 * qui fait du registre une série continue et vérifiable.
 *
 * Renvoie `{ attributions: [{ id, numero, table }], restantes }` — sans rien
 * écrire.
 */
export function numeroerActes(decisions, contexte) {
  const { sectionDe, annee } = contexte;
  const existants = decisions.map((d) => String(d.Numero_acte || "").trim()).filter(Boolean);
  const aNumeroter = decisions
    .filter((d) => !String(d.Numero_acte || "").trim())
    .sort((a, b) => dateDeLActe(a).localeCompare(dateDeLActe(b)) || Number(a.id) - Number(b.id));
  // Prochain numéro par séquence (section × année), initialisé sur ce qui
  // existe déjà, puis avancé à chaque attribution.
  const suivants = new Map();
  const attributions = [];
  for (const decision of aNumeroter) {
    const prefixe = prefixeActes(sectionDe(decision));
    const an = annee || anneeDeLActe(decision) || new Date().getFullYear();
    const cle = `${prefixe}-${an}`;
    if (!suivants.has(cle)) suivants.set(cle, prochainNumeroActe(existants, prefixe, an));
    const numero = suivants.get(cle);
    const rang = Number(numero.slice(-3));
    suivants.set(cle, numeroActe(prefixe, an, rang + 1));
    attributions.push({ id: decision.id, table: "Decisions", numero, prefixe, annee: an });
  }
  return { attributions, restantes: aNumeroter.length };
}

/**
 * Registre chronologique des actes : une ligne par décision numérotée, triée
 * par numéro puis par date. Les décisions non numérotées sont signalées à part
 * (`sansNumero`), pour que l'écran invite à les numéroter.
 */
export function registreActes(db, affaires) {
  const parId = new Map((affaires || []).map((a) => [Number(a.id), a]));
  const decisions = (db?.Decisions || []);
  // L'affaire et la décision sont lues par le moteur de formules (`vOuBrut`) :
  // le nom du mis en cause et le libellé de la décision sont des colonnes
  // **calculées**, et un accès direct au champ d'une ligne brute les rendait
  // vides. Le champ brut reste lu en second, pour les lignes d'avant la reprise.
  const ctx = new Context(db);
  const lignes = [];
  const sansNumero = [];
  for (const d of decisions) {
    const affaire = parId.get(Number(d.Affaire)) || null;
    const ligne = {
      Numero_acte: String(d.Numero_acte || ""),
      Date: dateDeLActe(d),
      Affaire: String(ctx.vOuBrut("Affaires", affaire, "Numero") || ""),
      Mis_en_cause: String(ctx.vOuBrut("Affaires", affaire, "Nom_complet")
        || ctx.vOuBrut("Affaires", affaire, "Nom_du_mis_en_cause") || ""),
      Nature: String(d.Nature || ""),
      Libelle: String(ctx.vOuBrut("Decisions", d, "Libelle_decision") || d.Decision || ""),
      id: d.id,
    };
    if (ligne.Numero_acte) lignes.push(ligne);
    else sansNumero.push(ligne);
  }
  lignes.sort((a, b) => a.Numero_acte.localeCompare(b.Numero_acte) || a.Date.localeCompare(b.Date));
  sansNumero.sort((a, b) => a.Date.localeCompare(b.Date) || Number(a.id) - Number(b.id));
  return { lignes, sansNumero };
}

/** En-têtes du registre des actes, dans l'ordre des colonnes. */
export const COLONNES_ACTES = ["Numero_acte", "Date", "Affaire", "Mis_en_cause", "Nature", "Libelle"];
