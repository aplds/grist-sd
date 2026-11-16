// Composition d'une section par fichier CSV.
//
// Saisir une section disciplinaire, c'est remplir huit, dix ou quinze fiches :
// un travail fastidieux, et une source d'erreurs de collège. Deux fonctions
// l'évitent :
//
//  - **Exporter un modèle** : un fichier CSV, une ligne par siège attendu par
//    les textes, avec le collège et le rôle déjà remplis. Il ne reste qu'à
//    écrire les noms.
//  - **Importer** : le même fichier rempli — ou un export de la section
//    existante, corrigé sous Excel puis réimporté. Les membres déjà présents
//    sont reconnus par courriel, à défaut par prénom et nom, et mis à jour ;
//    les autres sont créés.
//
// Le séparateur est détecté à la lecture (« ; » comme le fait Excel en
// français, « , » sinon), et les champs entre guillemets sont acceptés : un
// fichier exporté puis retouché dans un tableur revient intact.

import { COLLEGE_MEMBRE, compositionAttendue } from "./procedure.js";
import { COLLEGES_MEMBRE, GENRES } from "./schema.js";
import { champCsv } from "./export-table.js";

/** Colonnes du fichier, dans l'ordre. La première ligne porte les libellés. */
export const COLONNES_MEMBRES = [
  { id: "Prenom", label: "Prénom" },
  { id: "NOM", label: "NOM" },
  { id: "Genre", label: "Genre" },
  { id: "College", label: "Collège" },
  { id: "Email", label: "Courriel" },
  { id: "Role", label: "Rôle" },
  { id: "Mandat_debut", label: "Début du mandat" },
  { id: "Mandat_fin", label: "Fin du mandat" },
];

const ROLES_MEMBRE = ["Président", "Vice-Président", "Membre"];

/* ------------------------------------------------------------------ */
/* Écriture                                                            */
/* ------------------------------------------------------------------ */

function lignesCsv(lignes) {
  const entete = COLONNES_MEMBRES.map((c) => c.label);
  const corps = lignes.map((l) => COLONNES_MEMBRES.map((c) => champCsv(l[c.id] ?? "")));
  // Le point-virgule est le séparateur qu'attend un tableur configuré en
  // français ; l'export porte aussi une marque d'ordre des octets (BOM) pour
  // qu'Excel affiche correctement les accents.
  return `\uFEFF${[entete, ...corps].map((l) => l.join(";")).join("\r\n")}\r\n`;
}

/**
 * Modèle vierge pour une section : une ligne par siège attendu par les textes,
 * collège et rôle déjà remplis. La première ligne reçoit le rôle de président,
 * qui est unique — le secrétaire n'a plus qu'à écrire des noms. C'est bien le
 * premier siège de la composition qui préside : un professeur dans une section
 * d'établissement, le magistrat dans la section disciplinaire académique.
 */
export function modeleCsvMembres(section) {
  const comp = compositionAttendue(section);
  const lignes = [];
  let premier = true;
  for (const poste of comp.sectionListe) {
    const college = COLLEGE_MEMBRE[poste.cle] || "";
    for (let i = 0; i < poste.n; i++) {
      lignes.push({
        Genre: "",
        College: college,
        Role: premier ? "Président" : "Membre",
      });
      premier = false;
    }
  }
  // Une section sans composition connue reçoit au moins une ligne vide : le
  // fichier reste utilisable comme gabarit.
  if (!lignes.length) lignes.push({ Role: "Président" });
  return { csv: lignesCsv(lignes), lignes: lignes.length, composition: comp.section };
}

/** Export des membres d'une section, dans le même format que le modèle. */
export function csvMembresDeLaSection(store, section) {
  const lignes = store.table("Membres")
    .filter((m) => Number(m.Section) === Number(section.id))
    .map((m) => ({
      Prenom: m.Prenom, NOM: m.NOM, Genre: m.Genre, College: m.College, Email: m.Email,
      Role: m.Role, Mandat_debut: m.Mandat_debut, Mandat_fin: m.Mandat_fin,
    }));
  return { csv: lignesCsv(lignes), lignes: lignes.length };
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Découpe un contenu CSV en lignes de champs, guillemets compris. */
function decouper(texte, separateur) {
  const lignes = [];
  let ligne = [];
  let champ = "";
  let cite = false;
  const src = texte;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (cite) {
      if (c === '"') {
        if (src[i + 1] === '"') { champ += '"'; i++; } else { cite = false; }
      } else champ += c;
      continue;
    }
    if (c === '"' && champ === "") { cite = true; continue; }
    if (c === separateur) { ligne.push(champ); champ = ""; continue; }
    if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; continue; }
    if (c === "\r") continue;
    champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

const sansAccent = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Lecture d'un fichier de composition. L'en-tête est reconnu par son libellé
 * ou par son identifiant de colonne, sans tenir compte de la casse ni des
 * accents : un fichier retouché à la main reste lisible.
 */
export function analyserCsvMembres(texte) {
  const brut = String(texte ?? "").replace(/^\uFEFF/, "");
  if (!brut.trim()) return { lignes: [], erreurs: ["Le fichier est vide."], ignorees: 0 };
  // Séparateur : celui qui découpe le plus la première ligne significative.
  const premiere = brut.split(/\r?\n/).find((l) => l.trim()) || "";
  const separateur = (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ";" : ",";
  const lignes = decouper(brut, separateur).filter((l) => l.some((c) => String(c).trim()));
  if (!lignes.length) return { lignes: [], erreurs: ["Le fichier ne contient aucune ligne."], ignorees: 0 };

  const entete = lignes[0].map(sansAccent);
  const index = {};
  for (const col of COLONNES_MEMBRES) {
    const cible = sansAccent(col.label);
    const i = entete.findIndex((h) => h === cible || h === sansAccent(col.id));
    if (i !== -1) index[col.id] = i;
  }
  if (index.Prenom === undefined && index.NOM === undefined) {
    return {
      lignes: [],
      erreurs: [`Aucune colonne « Prénom » ni « NOM » reconnue. L'en-tête attendu est : ${COLONNES_MEMBRES.map((c) => c.label).join(" ; ")}.`],
      ignorees: 0,
    };
  }

  const erreurs = [];
  const retenues = [];
  let ignorees = 0;
  for (let i = 1; i < lignes.length; i++) {
    const l = lignes[i];
    const ligne = {};
    for (const [id, j] of Object.entries(index)) ligne[id] = String(l[j] ?? "").trim();
    if (!ligne.Prenom && !ligne.NOM && !ligne.Email) { ignorees++; continue; }
    if (ligne.Genre && !GENRES.includes(ligne.Genre)) {
      erreurs.push(`Ligne ${i + 1} : genre « ${ligne.Genre} » inconnu (attendu : ${GENRES.join(", ")}).`);
    }
    if (ligne.College && !COLLEGES_MEMBRE.includes(ligne.College)) {
      erreurs.push(`Ligne ${i + 1} : collège « ${ligne.College} » inconnu (attendu : ${COLLEGES_MEMBRE.join(", ")}).`);
    }
    if (ligne.Role && !ROLES_MEMBRE.includes(ligne.Role)) {
      erreurs.push(`Ligne ${i + 1} : rôle « ${ligne.Role} » inconnu (attendu : ${ROLES_MEMBRE.join(", ")}).`);
    }
    if (ligne.Mandat_debut && !/^\d{4}-\d{2}-\d{2}$/.test(ligne.Mandat_debut)) {
      erreurs.push(`Ligne ${i + 1} : début de mandat « ${ligne.Mandat_debut} » — format attendu AAAA-MM-JJ.`);
    }
    if (ligne.Mandat_fin && !/^\d{4}-\d{2}-\d{2}$/.test(ligne.Mandat_fin)) {
      erreurs.push(`Ligne ${i + 1} : fin de mandat « ${ligne.Mandat_fin} » — format attendu AAAA-MM-JJ.`);
    }
    ligne.__ligne = i + 1;
    retenues.push(ligne);
  }
  return { lignes: retenues, erreurs, ignorees };
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

const nomDe = (m) => [m.Prenom, m.NOM].filter(Boolean).join(" ") || m.Email || `#${m.id}`;

/**
 * Applique un fichier à la section : les membres déjà présents — reconnus par
 * courriel, à défaut par prénom et nom — sont mis à jour, les autres créés.
 * Rien n'est supprimé : un fichier incomplet n'efface jamais une composition.
 */
export function importerMembres(store, section, lignes) {
  const existants = store.table("Membres").filter((m) => Number(m.Section) === Number(section.id));
  const parEmail = new Map();
  for (const m of existants) {
    const e = String(m.Email || "").trim().toLowerCase();
    if (e) parEmail.set(e, m);
  }
  const parNom = new Map();
  for (const m of existants) parNom.set(`${sansAccent(m.Prenom)}|${sansAccent(m.NOM)}`, m);

  let creees = 0;
  let maj = 0;
  const noms = [];
  for (const ligne of lignes) {
    const email = String(ligne.Email || "").trim().toLowerCase();
    const cle = `${sansAccent(ligne.Prenom)}|${sansAccent(ligne.NOM)}`;
    let cible = (email && parEmail.get(email)) || parNom.get(cle) || null;
    const donnees = {
      Prenom: ligne.Prenom || "", NOM: ligne.NOM || "", Genre: ligne.Genre || "",
      College: ligne.College || "", Email: ligne.Email || "", Role: ligne.Role || "Membre",
      Mandat_debut: ligne.Mandat_debut || "", Mandat_fin: ligne.Mandat_fin || "",
    };
    if (cible) {
      // Une case vide du fichier ne doit pas effacer une donnée déjà saisie.
      const patch = {};
      for (const [k, v] of Object.entries(donnees)) if (v !== "" && v !== cible[k]) patch[k] = v;
      if (Object.keys(patch).length) { store.updateRow("Membres", cible.id, patch); maj++; }
      noms.push(nomDe(cible));
    } else {
      cible = store.addRow("Membres", { ...donnees, Section: section.id });
      if (cible) {
        creees++;
        if (email) parEmail.set(email, cible);
        parNom.set(cle, cible);
        noms.push(nomDe(cible));
      }
    }
  }
  return { creees, maj, noms };
}

