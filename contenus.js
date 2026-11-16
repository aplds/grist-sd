// Contenus livrés : inventaire, empreinte et alignement (NC-0005, NC-0015).
//
// L'outil livre, avec son code, des **contenus** : les trames et leurs formats
// (`trames-defaut.js`), les catalogues de sanctions et de motifs, et les seuils
// par défaut (`regimes.js`). Une base neuve les reçoit à l'installation ; une
// base **déjà installée** les a reçus un jour, puis suit sa vie — et une
// correction juridique apportée plus tard à un modèle ne l'atteint jamais.
//
// Ce module donne le moyen de s'en apercevoir et d'y remédier :
//
//  - `contenusLivres()` — ce que la livraison courante apporte en propre, en
//    **nombre** : les comptages que la documentation annonce sont ainsi
//    **produits par le code**, et non recopiés à la main (NC-0015) ;
//  - `signatureContenus()` — une empreinte stable des contenus livrés. Une base
//    mémorise la signature qu'elle a vue ; si elle ne correspond plus, c'est
//    qu'un contenu a changé, et l'administrateur en est averti (NC-0005) ;
//  - `planAlignementContenus(db)` — ce qu'il faudrait ajouter ou corriger pour
//    que la base rejoigne la livraison, sans jamais écraser le travail de
//    l'établissement (texte des trames, lignes propres des catalogues).
//
// Rien ici n'écrit : c'est la vue (Réglages) qui applique le plan, après accord.

import {
  TYPES_TRAMES_PAR_DEFAUT,
  TRAMES_PAR_DEFAUT,
  planAlignementTrames,
  typesTramesParDefautManquants,
} from "./trames-defaut.js";
import {
  MOTIFS_PAR_DEFAUT,
  SANCTIONS_PAR_DEFAUT,
  parametresParDefaut,
  planAlignementCatalogue,
} from "./regimes.js";

/** Nombre d'éléments de chaque jeu livré avec l'outil. */
export function contenusLivres() {
  return {
    sanctions: SANCTIONS_PAR_DEFAUT.length,
    motifs: MOTIFS_PAR_DEFAUT.length,
    trames: TRAMES_PAR_DEFAUT.length,
    formats: TYPES_TRAMES_PAR_DEFAUT.length,
    seuils: parametresParDefaut().length,
  };
}

/** Empreinte FNV-1a (32 bits) d'une chaîne, en hexadécimal. */
function empreinte(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Signature des contenus livrés. Elle change dès qu'une trame, un format, une
 * sanction, un motif ou un seuil livré est modifié — c'est ce qui permet de
 * dire à une base « ce que je livre aujourd'hui n'est plus ce que tu as reçu ».
 */
export function signatureContenus() {
  return empreinte(JSON.stringify({
    sanctions: SANCTIONS_PAR_DEFAUT,
    motifs: MOTIFS_PAR_DEFAUT,
    trames: TRAMES_PAR_DEFAUT,
    formats: TYPES_TRAMES_PAR_DEFAUT,
    seuils: parametresParDefaut(),
  }));
}

/**
 * Ce qu'il faudrait faire pour aligner une base sur les contenus livrés :
 * catalogues (sanctions et motifs), trames (ajouts et programmation) et
 * formats manquants. Le détail de chaque alignement est calculé par les
 * fonctions dédiées ; celui-ci ne fait que les réunir pour un seul geste.
 */
export function planAlignementContenus(db) {
  return {
    catalogues: ["Sanctions", "Motifs"].map((table) => ({ table, ...planAlignementCatalogue(table, db) })),
    trames: planAlignementTrames(db),
    formats: typesTramesParDefautManquants(db),
  };
}

/** Compte, en une ligne, ce qu'un plan d'alignement ajouterait et corrigerait. */
export function compteAlignement(plan) {
  const cataloguesAjouts = plan.catalogues.reduce((n, p) => n + p.ajouts.length, 0);
  const cataloguesMaj = plan.catalogues.reduce((n, p) => n + p.modifications.length, 0);
  return {
    ajouts: cataloguesAjouts + plan.trames.ajouts.length + plan.formats.length,
    corrections: cataloguesMaj + plan.trames.modifications.length,
  };
}

/** Le plan est-il vide — la base suit-elle déjà la livraison ? */
export function planEstVide(plan) {
  const { ajouts, corrections } = compteAlignement(plan);
  return !ajouts && !corrections;
}

/* ------------------------------------------------------------------ */
/* Détail lisible du plan (NC-0026)                                    */
/* ------------------------------------------------------------------ */

/** Libellés lisibles des champs que l'alignement peut corriger. */
const LIBELLES_CHAMPS = {
  Libelle: "Libellé",
  Groupe: "Groupe",
  Public: "Public",
  Tutelle: "Tutelle",
  Duree_max_mois: "Durée maximale (mois)",
  Sursis_possible: "Sursis possible",
  Texte_de_reference: "Texte de référence",
  Type: "Format",
  Auteur: "Auteur",
  Destinataire: "Destinataire",
};

/** Nom lisible d'une ligne de contenu (livrée, ou en base). */
export function nomContenu(ligne) {
  for (const champ of ["Libelle", "Nom_complet", "Nom", "Titre", "Objet"]) {
    const valeur = ligne && ligne[champ];
    if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
  }
  return `#${(ligne && ligne.id) ?? "?"}`;
}

/** Valeur affichable d'un champ dans le détail. */
function valeurLisible(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "(vide)";
  if (valeur === true) return "oui";
  if (valeur === false) return "non";
  return String(valeur);
}

/**
 * Détail lisible d'un plan d'alignement (NC-0026) : chaque ajout et chaque
 * correction, ligne à ligne, avec le nom de la ligne, le champ touché, la
 * valeur **actuelle** et la valeur **livrée**. C'est ce détail qui est montré
 * avant d'appliquer — un alignement ne doit pas défaire une adaptation locale
 * sans que son auteur le voie.
 */
export function detailAlignement(plan, db) {
  const nomParId = (table, id) => {
    const ligne = ((db && db[table]) || []).find((r) => Number(r.id) === Number(id));
    return ligne ? nomContenu(ligne) : `#${id}`;
  };
  const champsDe = (maj) => Object.keys(maj.apres).map((champ) => ({
    champ: LIBELLES_CHAMPS[champ] || champ,
    avant: valeurLisible(maj.avant[champ]),
    apres: valeurLisible(maj.apres[champ]),
  }));

  const ajouts = [];
  for (const { table, ajouts: liste } of plan.catalogues) {
    for (const ligne of liste) ajouts.push({ table, nom: nomContenu(ligne) });
  }
  for (const trame of plan.trames.ajouts) ajouts.push({ table: "Trames", nom: nomContenu(trame) });
  for (const format of plan.formats) ajouts.push({ table: "Types_Trames", nom: nomContenu(format) });

  const corrections = [];
  for (const { table, modifications } of plan.catalogues) {
    for (const maj of modifications) {
      corrections.push({ table, nom: nomParId(table, maj.id), champs: champsDe(maj) });
    }
  }
  for (const maj of plan.trames.modifications) {
    corrections.push({ table: "Trames", nom: nomParId("Trames", maj.id), champs: champsDe(maj) });
  }
  return { ajouts, corrections };
}

/** Prochain identifiant libre d'une table. */
function prochainId(rows) {
  return rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
}

/**
 * Applique un plan à une base **en mémoire**, sans passer par le magasin :
 * c'est le chemin des bases fabriquées par le code (le jeu d'exemple, à sa
 * construction), où il n'y a ni écriture à diffuser ni journal à tenir. Pour
 * une base vivante — celle d'un établissement —, l'action « aligner-contenus »
 * passe par le magasin, afin que chaque ligne soit écrite dans le document
 * Grist le cas échéant.
 */
export function appliquerPlanContenus(db, plan) {
  for (const { table, ajouts, modifications } of plan.catalogues) {
    db[table] = db[table] || [];
    for (const ligne of ajouts) db[table].push({ ...ligne, id: prochainId(db[table]) });
    for (const maj of modifications) {
      const row = db[table].find((r) => r.id === maj.id);
      if (row) Object.assign(row, maj.apres);
    }
  }
  db.Types_Trames = db.Types_Trames || [];
  for (const format of plan.formats) {
    const { id, ...reste } = format;
    db.Types_Trames.push({ ...reste, id: prochainId(db.Types_Trames) });
  }
  const nomParId = new Map(TYPES_TRAMES_PAR_DEFAUT.map((t) => [Number(t.id), String(t.Nom)]));
  const idParNom = new Map(db.Types_Trames.map((t) => [String(t.Nom), t.id]));
  db.Trames = db.Trames || [];
  for (const trame of plan.trames.ajouts) {
    const { id, ...reste } = trame;
    reste.Type = idParNom.get(nomParId.get(Number(trame.Type))) ?? 0;
    db.Trames.push({ ...reste, id: prochainId(db.Trames) });
  }
  for (const maj of plan.trames.modifications) {
    const row = db.Trames.find((r) => r.id === maj.id);
    if (row) Object.assign(row, maj.apres);
  }
  return db;
}
