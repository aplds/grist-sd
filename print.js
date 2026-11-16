// Impressions « maison » : rôle d'une séance et liste d'affaires.
//
// Ces documents ne passent pas par les trames : leur mise en page est
// construite ici et partagée avec les documents générés (DOCUMENT_CSS).

import { Context, formatDateFr, toDate } from "./formulas.js";
import { libelleFormation } from "./regimes.js";
import { DOCUMENT_CSS, resolveAsset, escapeHtml, imageSource, BLOC_MARQUE, BLOC_MARQUE_SIZE } from "./render.js";
import { charteNeutre, cssPoliceDocument } from "./charte.js";
import { rapportActivite, dateDuRapport } from "./rapport.js";
import { graphiqueHtml } from "./graphiques.js";
import { DSFR_CSS as DSFR_CSS_URL, DSFR_UTILITY_CSS } from "./dependances.js";

const esc = escapeHtml;

const DSFR_CSS = DSFR_CSS_URL;
const FONT_CSS = DSFR_UTILITY_CSS;

/* Habillage des états imprimés « maison ». Mêmes jetons que le document
   rendu (voir DOCUMENT_CSS) : encre #3a3a3a pour le texte, #161616 pour les
   titres, filets #ddd, fonds d'en-tête #f6f6f6. */
const PRINT_CSS = `
  body { font-family: Marianne, Arial, sans-serif; color: #3a3a3a; padding: 24px; }
  h1 { font-size: 1.5rem; color: #161616; margin: 0 0 0.2rem; }
  h2 { font-size: 1.05rem; color: #161616; margin: 1.6rem 0 0.6rem; }
  /* Même en-tête que les documents générés (voir computeDocumentParts, dans
     render.js) : bloc-marque à gauche, logo de l'établissement à droite, les
     deux calés sur la ligne de tête. Le logo est borné aux cotes de la zone de
     logotype de la charte (53 × 26 mm) ; le bloc-marque garde la sienne. */
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.6rem; }
  .doc-head img { max-height: 26mm; max-width: 53mm; }
  /* Les deux cases de l'en-tête n'ont que la largeur de leur logo : la règle
     générale des documents (div { width: 100% }, DOCUMENT_CSS, render.js)
     leur donnait à chacune la pleine largeur — réduite à moitié par le
     rétrécissement —, et le logo de l'établissement restait collé au milieu
     de la page au lieu de tenir le bord droit. */
  .doc-head > div { width: auto; }
  .doc-head > div:last-child { text-align: right; }
  .doc-sub { color: #666; margin: 0; }
  .doc-meta { margin: 1rem 0 1.4rem; }
  .doc-meta dt { font-weight: 700; color: #161616; }
  .doc-meta dd { margin: 0 0 0.3rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
  thead th { background: #f6f6f6; color: #161616; font-weight: 700; border-bottom: 2px solid #3a3a3a; }
  .role-heure { font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* Jonction d'affaires, dans un état imprimé : discrète, mais lisible — la
     formation doit voir quelles affaires relèvent d'une même décision. */
  .jonction { font-size: 0.78em; font-style: italic; color: #3a3a3a; }
  .doc-foot { margin-top: 2rem; font-size: 0.8rem; color: #666; }
  .doc-sign { margin-top: 2.5rem; text-align: right; }
  /* Rapport d'activité : les graphiques sont des images — elles prennent la
     largeur de la colonne, portent leur titre dans le dessin, et ne se
     coupent pas d'une page à l'autre. */
  .app-graphique { margin: 0 0 1.1rem; break-inside: avoid; }
  .app-graphique__image { display: block; width: 100%; max-width: 100%; height: auto; }
  .rapport-graphiques { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem 1.2rem; }
  .rapport-section h2 { margin-top: 1.8rem; }
  .rapport-section h3 { font-size: 0.95rem; color: #161616; margin: 1.2rem 0 0.4rem; }
  @media print { body { padding: 0; } }
`;

function pageShell(title, body, { policeCss = "" } = {}) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<link rel="stylesheet" href="${DSFR_CSS}">
<link rel="stylesheet" href="${FONT_CSS}">
<style>${DOCUMENT_CSS}</style>
<style>${PRINT_CSS}</style>
${policeCss ? `<style>${policeCss}</style>` : ""}
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * En-tête d'un état imprimé : le bloc-marque à gauche, le logo de
 * l'établissement à droite. Avec la charte neutre, la marque de l'État n'est
 * pas écrite — ni le bloc officiel livré avec l'outil, ni celui d'une section
 * resté vide ; seule une image délibérément déposée dans la colonne `Marianne`
 * est employée (voir `computeDocumentParts` dans `render.js`).
 */
function entete(section, { neutre = false } = {}) {
  const marianne = imageSource(section?.Marianne || "");
  const logo = imageSource(section?.Logo || "");
  const marque = marianne
    ? `<img src="${esc(marianne)}" alt="Bloc-marque de l'État" style="height: 24.08mm; width: auto; max-width: 100%;">`
    : neutre ? "" : `<img src="${esc(resolveAsset(BLOC_MARQUE))}" alt="République Française"${BLOC_MARQUE_SIZE}>`;
  return `
<div class="doc-head">
  <div>${marque}</div>
  <div>${logo ? `<img src="${esc(logo)}" alt="Logo de l'établissement">` : ""}</div>
</div>`;
}

function seanceLabel(ctx, seance) {
  const id = String(ctx.v("Seances_d_examen", seance, "Identifiant") || "").trim();
  return id || `Séance #${seance.id}`;
}

/* ------------------------------------------------------------------ */
/* Rôle d'une séance                                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Jonction d'affaires, dans les états imprimés                        */
/* ------------------------------------------------------------------ */

/**
 * Marque discrète des affaires jointes, dans les états imprimés : un rôle de
 * séance se lit en séance, et la formation doit savoir quelles affaires elle
 * juge par une même décision. L'affaire de tête le dit, les affaires jointes
 * rappellent la tête dont elles suivent la décision.
 */
function marqueJonction(ctx, a) {
  const jonction = ctx.v("Affaires", a, "Jonction");
  if (!jonction) return "";
  const tete = ctx.v("Affaires", a, "Affaire_de_tete");
  const numero = tete ? String(ctx.v("Affaires", tete, "Numero") || "") : "";
  return tete
    ? `<br><span class="jonction">jointe à ${esc(numero)}</span>`
    : `<br><span class="jonction">affaire de tête</span>`;
}

export function roleSeanceHtml(db, seance) {
  const ctx = new Context(db);
  const section = seance.Section ? ctx.byId("Sections_disciplinaires", seance.Section) : null;
  const formationLabel = libelleFormation(section);
  const affaires = (db.Affaires || [])
    .filter((a) => Number(a.Seance_d_examen) === Number(seance.id))
    .sort((a, b) => String(a.SE_Heure_de_passage || "99:99").localeCompare(String(b.SE_Heure_de_passage || "99:99")));

  const lignes = affaires.map((a, i) => `
    <tr>
      <td class="role-heure">${esc(String(a.SE_Heure_de_passage || "—"))}</td>
      <td>${i + 1}</td>
      <td>${esc(String(ctx.v("Affaires", a, "Numero") || ""))}${marqueJonction(ctx, a)}</td>
      <td>${esc(String(ctx.v("Affaires", a, "Nom_complet") || "").trim())}</td>
      <td>${esc(String(ctx.v("Affaires", a, "Commission") || ""))}</td>
      <td>${esc(String(ctx.v("Affaires", a, "Rapporteur") || ""))}</td>
      <td>${esc(String(a.Etat || ""))}</td>
    </tr>`).join("");

  const lieu = [seance.Salle, seance.Adresse].filter(Boolean).map((x) => String(x)).join(" — ");
  const date = toDate(seance.Date);

  const body = `
${entete(section, { neutre: charteNeutre(db) })}
<h1>Rôle de la séance</h1>
<p class="doc-sub">${esc(section ? String(section.Structure) : "")}</p>
<div class="doc-meta">
  <dl>
    <dt>Référence</dt><dd>${esc(seanceLabel(ctx, seance))}</dd>
    <dt>Type de réunion</dt><dd>${esc(String(seance.Type || "Séance"))}</dd>
    <dt>Date</dt><dd>${date ? esc(formatDateFr(date)) : "—"}</dd>
    <dt>Lieu</dt><dd>${esc(lieu || "Non précisé")}</dd>
    ${seance.Lien_visio ? `<dt>Lien de visioconférence</dt><dd>${esc(String(seance.Lien_visio))}</dd>` : ""}
    <dt>Nombre d'affaires inscrites</dt><dd>${affaires.length}</dd>
  </dl>
</div>
<table>
  <thead>
    <tr>
      <th scope="col">Heure</th><th scope="col">Ordre</th><th scope="col">N° d'affaire</th>
      <th scope="col">Mis en cause</th><th scope="col">${esc(formationLabel)}</th><th scope="col">Rapporteur</th><th scope="col">État</th>
    </tr>
  </thead>
  <tbody>${lignes || `<tr><td colspan="7">Aucune affaire inscrite au rôle de cette séance.</td></tr>`}</tbody>
</table>
<p class="doc-foot">Document produit le ${esc(formatDateFr(new Date()))} — ${esc(section ? String(section.Structure) : "")}</p>
<div class="doc-sign">
  ${esc(section ? String(section.President || "") : "")}
  <p>${esc(section && section.VP ? "Le vice-président de la section disciplinaire" : "Le président de la section disciplinaire")}</p>
</div>`;

  return pageShell(`Rôle — ${seanceLabel(ctx, seance)}`, body, { policeCss: cssPoliceDocument(db) });
}

/* ------------------------------------------------------------------ */
/* Liste d'affaires                                                    */
/* ------------------------------------------------------------------ */

export function listeAffairesHtml(db, rows, { section = null, query = "" } = {}) {
  const ctx = new Context(db);

  const lignes = rows.map((a) => {
    const s = a.Section ? ctx.byId("Sections_disciplinaires", a.Section) : null;
    const d = toDate(a.Date_de_saisine);
    // L'INE n'existe pas pour un enseignant-chercheur : sa colonne porte alors
    // le corps. La colonne est commune aux deux régimes, comme le registre des
    // décisions — jamais un INE vide pour un enseignant-chercheur.
    const identifiant = ctx.v("Affaires", a, "Section_Public") === "Enseignants-chercheurs"
      ? ctx.v("Affaires", a, "Corps")
      : ctx.v("Affaires", a, "INE");
    return `
    <tr>
      <td>${esc(String(ctx.v("Affaires", a, "Numero") || ""))}${marqueJonction(ctx, a)}</td>
      <td>${esc(String(ctx.v("Affaires", a, "Nom_complet") || "").trim())}</td>
      <td>${esc(String(identifiant || ""))}</td>
      <td>${esc(s ? String(s.Structure) : "")}</td>
      <td>${d ? esc(formatDateFr(d)) : ""}</td>
      <td>${esc(String(a.Etat || ""))}</td>
    </tr>`;
  }).join("");

  const body = `
${entete(section, { neutre: charteNeutre(db) })}
<h1>Liste des affaires</h1>
<p class="doc-sub">${esc(section ? String(section.Structure) : "Toutes les sections")}${query ? ` — recherche : « ${esc(query)} »` : ""}</p>
<p class="doc-meta">${rows.length} affaire(s) listée(s), au ${esc(formatDateFr(new Date()))}.</p>
<table>
  <thead>
    <tr>
      <th scope="col">N° d'affaire</th><th scope="col">Mis en cause</th><th scope="col">INE / corps</th>
      <th scope="col">Section</th><th scope="col">Saisine</th><th scope="col">État</th>
    </tr>
  </thead>
  <tbody>${lignes || `<tr><td colspan="6">Aucune affaire.</td></tr>`}</tbody>
</table>`;

  return pageShell("Liste des affaires", body, { policeCss: cssPoliceDocument(db) });
}

/* ------------------------------------------------------------------ */
/* Rapport d'activité                                                  */
/* ------------------------------------------------------------------ */

/** Tableau imprimé : en-têtes et lignes, tout en texte échappé. */
function tableauImprime(entetes, lignes) {
  return `<table>
  <thead><tr>${entetes.map((e) => `<th scope="col">${esc(String(e))}</th>`).join("")}</tr></thead>
  <tbody>${lignes.map((l) => `<tr>${l.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody>
</table>`;
}

/**
 * Le rapport d'activité, mis en page pour l'impression ou l'export (PDF, Word,
 * OpenDocument). C'est la même matière que l'écran — voir `rapportActivite` :
 * les chiffres clés, les graphiques (rendus en images, chacun portant son
 * titre) et les tableaux d'indicateurs, sous l'en-tête de la section.
 */
export function rapportActiviteHtml(store, state, { pourImpression = true } = {}) {
  const rapport = rapportActivite(store, state);
  const sections = store.table("Sections_disciplinaires");
  const section = rapport.section || (sections.length === 1 ? sections[0] : null);
  const neutre = charteNeutre(store.db);

  const chiffres = tableauImprime(
    ["Indicateur", "Valeur", "Précision"],
    rapport.kpis.map((k) => [k.label, String(k.value), k.hint || ""]),
  );

  const graphiques = rapport.graphiques.length
    ? `<div class="rapport-graphiques">${rapport.graphiques
      .map((g) => graphiqueHtml(g.spec, { pourImpression, titre: true })).join("")}</div>`
    : "<p>Aucun graphique : les données de la période ne s'y prêtent pas.</p>";

  // Les tableaux imprimés : ceux de l'écran, moins « Chiffres clés » — les
  // mêmes chiffres figurent déjà, en tableau, sous le titre qui précède.
  const domaines = [...new Set(rapport.tableaux.filter((t) => t.id !== "chiffres").map((t) => t.domaine))];
  const tableaux = domaines.map((domaine) => `
    <h2>${esc(domaine)}</h2>
    ${rapport.tableaux.filter((t) => t.domaine === domaine && t.id !== "chiffres")
      .map((t) => `<h3>${esc(t.nom)}</h3>${tableauImprime(t.entetes, t.lignes)}`).join("")}`).join("");

  const body = `
${entete(section, { neutre })}
<h1>Rapport d'activité</h1>
<p class="doc-sub">${esc(section ? String(section.Structure) : "Toutes les sections")} — ${esc(rapport.periode)}</p>
<div class="doc-meta">
  <dl>
    <dt>Période</dt><dd>${esc(rapport.periode)}</dd>
    <dt>Structure</dt><dd>${esc(section ? String(section.Structure) : "Toutes les sections")}</dd>
    <dt>Affaires reçues</dt><dd>${rapport.contexte.affaires}</dd>
    <dt>Décisions rendues</dt><dd>${rapport.contexte.decisions}</dd>
    <dt>Séances</dt><dd>${rapport.contexte.seances}</dd>
    <dt>Recours introduits</dt><dd>${rapport.contexte.recours}</dd>
  </dl>
</div>
<div>
  <h2>Chiffres clés</h2>
  ${chiffres}
  <h2>Graphiques</h2>
  ${graphiques}
  <div class="rapport-section">${tableaux}</div>
</div>
<p class="doc-foot">Rapport produit le ${esc(dateDuRapport())} — ${esc(section ? String(section.Structure) : "toutes les sections")}.
  Les affaires sont comptées à leur date de saisine, les décisions à leur date de délibéré.</p>`;

  return pageShell(`Rapport d'activité — ${rapport.periode}`, body, { policeCss: cssPoliceDocument(store.db) });
}

/* ------------------------------------------------------------------ */
/* Ouverture d'une fenêtre d'impression                                */
/* ------------------------------------------------------------------ */

/**
 * Ouvre une fenêtre d'impression. Un document paginé (voir pages.js) met un
 * instant à se découper en pages : on attend son signal (`__docReady`) avant de
 * lancer l'impression, sinon le navigateur imprimerait le flux avant sa
 * découpe — une seule page, sans numérotation. Les états « maison » (rôle de
 * séance, liste d'affaires) ne se paginent pas : ils s'impriment dès que la
 * fenêtre est chargée.
 */
export function openPrintWindow(html) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  let essais = 0;
  const imprimer = () => {
    if (w.closed) return;
    const pagine = typeof w.__docReady === "boolean";
    const pret = pagine
      ? w.__docReady
      : w.document.readyState === "complete" || w.document.readyState === "interactive";
    if (pret || essais++ > 40) { w.print(); return; }
    setTimeout(imprimer, 100);
  };
  setTimeout(imprimer, 200);
  return true;
}
