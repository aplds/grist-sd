// Accessibilité — NC-0014.
//
// Trois pièces sont obligatoires pour un service public numérique :
//   · la **déclaration d'accessibilité** (art. 47 de la loi n° 2005-102) ;
//   · le **schéma pluriannuel** de mise en accessibilité ;
//   · le **plan d'action** de l'année.
//
// Les trois sont rédigées dans `src/accessibilite/` (versions longues, à
// publier sur le site de l'établissement) ; cette page les présente dans
// l'outil, avec le point de contact et la voie de recours. Elle est atteignable
// par `#accessibilite` (lien du pied de page et de la page Aide).
//
// Le principe de rédaction est celui d'une déclaration honnête : l'état de
// conformité est **partiel**, et les non-conformités relevées par l'audit y
// sont déclarées sans être minimisées.

import { NAV } from "./schema.js";
import * as ui from "./ui.js";

const { esc, panel } = ui;

const DATE_DECLARATION = "21 septembre 2026";

/** Coordonnées du point de contact, prises dans la fiche de la section. */
function contactSection(store) {
  const sections = store.table("Sections_disciplinaires") || [];
  const avecCourriel = sections.find((s) => String(s.Email_de_contact || "").trim());
  const section = avecCourriel || sections[0] || null;
  const structure = section
    ? String(section.Structure_Nom_Complet || section.Structure || "").trim()
    : "";
  const courriel = section ? String(section.Email_de_contact || "").trim() : "";
  return { structure, courriel };
}

function tableauConstats(rows) {
  return ui.dataTable({
    caption: "Non-conformités déclarées et état de leur correction",
    columns: ["Référence", "Non-conformité", "État"],
    rows: rows.map((r, i) => ({
      id: i,
      cells: [`<code>${esc(r.ref)}</code>`, esc(r.texte), esc(r.etat)],
    })),
    rowAttr: "",
  });
}

/**
 * Page « Déclaration d'accessibilité ». `state` n'est pas utilisé pour le
 * contenu, mais la signature reste celle des autres vues.
 */
export function viewAccessibilite(store) {
  const { structure, courriel } = contactSection(store);
  const nom = structure || "l'établissement";

  const sommaire = ui.anchors({
    label: "Sommaire de la déclaration",
    items: [
      { label: "État de conformité", hash: "accessibiliteEtat" },
      { label: "Résultats des tests", hash: "accessibiliteTests" },
      { label: "Contenus non accessibles", hash: "accessibiliteNc" },
      { label: "Amélioration et schéma pluriannuel", hash: "accessibiliteSchema" },
      { label: "Retour d'information et contact", hash: "accessibiliteContact" },
      { label: "Voie de recours", hash: "accessibiliteRecours" },
    ],
  });

  const etat = panel("État de conformité", `
    <p>
      <strong>${esc(nom)}</strong> s'engage à rendre son service numérique accessible,
      conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005.
    </p>
    <p class="fr-badge fr-badge--warning">Accessibilité partiellement conforme</p>
    <p>
      Cette déclaration a été établie le ${esc(DATE_DECLARATION)}. L'outil
      <strong>n'a pas encore fait l'objet d'un audit de conformité RGAA 4.1 complet et
      opposable</strong> : l'état de conformité repose sur un audit interne, dont les
      non-conformités sont déclarées ci-dessous. Le taux de conformité ne peut donc pas
      être calculé en toute rigueur.
    </p>
  `, { iconName: "information-line", id: "accessibiliteEtat" });

  const tests = panel("Résultats des tests", `
    <p>
      L'audit interne du ${esc(DATE_DECLARATION)} a mesuré, écran par écran, une partie
      des critères du référentiel RGAA 4.1 — structure du document, adaptation à la
      largeur, contraste, étiquettes de champs, alternatives textuelles des graphiques,
      recours au clavier. Ses constats sont consignés dans le rapport
      <code>src/audit/rapports/audit-2026-09-21.md</code>, versionné avec l'outil.
    </p>
    <p>
      Les points mesurés conformes à la date de cette déclaration : étiquettes de champs
      associées, contrastes suffisants, absence de <code>tabindex</code> positif,
      alternatives textuelles des graphiques, modales titrées et marquées comme telles,
      navigation par titres sans saut de niveau, absence de débordement horizontal.
    </p>
  `, { iconName: "search-eye-line", id: "accessibiliteTests" });

  const nonConformites = panel("Contenus non accessibles", `
    <p>Les contenus et fonctionnalités suivants ne sont pas encore pleinement accessibles :</p>
    <ul>
      <li><strong>Les documents exportés au format PDF</strong> ne sont pas balisés
        (bibliothèques <code>pdfmake</code> et <code>pdf-lib</code>) : les titres, listes et
        tableaux n'y sont pas structurés pour un lecteur d'écran, et l'ordre de lecture
        n'est pas garanti. Les formats Word et OpenDocument conservent, eux, les balises
        du document.</li>
      <li><strong>L'interface est pensée pour un écran large.</strong> Elle se replie
        jusqu'à 320 px, mais l'usage suppose une souris ou un écran tactile large ;
        certaines actions groupées demandent une précision de pointage.</li>
      <li><strong>L'éditeur de rédaction</strong> (mise en forme, palette de balises,
        insertion de tableaux et d'images) repose sur <code>contenteditable</code> et ne
        présente pas encore d'alternative entièrement au clavier ni de retour vocal.</li>
      <li><strong>Les graphiques du rapport d'activité</strong> sont des images doublées
        d'une alternative textuelle, mais cette alternative est un résumé, non une
        description exhaustive des données sous-jacentes.</li>
    </ul>
    <p>Ces contenus relèvent du <strong>plan d'action</strong> décrit ci-dessous.</p>
    <div class="fr-mt-2w">${tableauConstats([
      { ref: "NC-0012", texte: "Saut de niveau de titre sur tous les écrans", etat: "Corrigé — titres de section en H2, sous-blocs en H3" },
      { ref: "NC-0013", texte: "Débordement horizontal à 320 px (liste des affaires, Réglages › Sections)", etat: "Corrigé — repli des grilles sous 22 rem" },
      { ref: "NC-0014", texte: "Absence des trois pièces légales d'accessibilité", etat: "Corrigé — présente déclaration, schéma et plan" },
      { ref: "—", texte: "PDF exporté non balisé", etat: "Ouvert — inscrit au plan d'action" },
      { ref: "—", texte: "Éditeur de rédaction non entièrement utilisable au clavier", etat: "Ouvert — inscrit au plan d'action" },
    ])}</div>
  `, { iconName: "error-warning-line", id: "accessibiliteNc" });

  const schema = panel("Amélioration et schéma pluriannuel", `
    <p>
      L'accessibilité de l'outil fait l'objet d'un <strong>schéma pluriannuel</strong> et
      d'un <strong>plan d'action</strong>, tenus à jour avec l'outil :
    </p>
    <ul>
      <li><code>src/accessibilite/SCHEMA-PLURIANNUEL.md</code> — engagements et
        organisation sur trois ans ;</li>
      <li><code>src/accessibilite/PLAN-D-ACTION.md</code> — actions de l'année en cours,
        état d'avancement et responsables.</li>
    </ul>
    <p>
      L'établissement publie ces documents sur son site institutionnel et les tient à
      disposition sur demande.
    </p>
  `, { iconName: "route-map-line", id: "accessibiliteSchema" });

  const contact = panel("Retour d'information et contact", `
    <p>
      Si vous n'arrivez pas à accéder à un contenu ou à un service, ou si vous repérez un
      défaut d'accessibilité, un signalement peut être adressé au secrétariat de la
      section disciplinaire :
    </p>
    <ul>
      ${courriel
        ? `<li>Par courriel : <a href="mailto:${esc(courriel)}">${esc(courriel)}</a></li>`
        : `<li>Par courriel : adresse à renseigner dans <em>Réglages › Sections et membres › Courriel du secrétariat</em>.</li>`}
    </ul>
    <p class="fr-text--sm fr-text-mention--grey">
      Ce retour peut être accompagné de la description du problème, de l'écran concerné et
      de l'aide technique utilisée (lecteur d'écran, loupe, commandes vocales), pour
      faciliter le diagnostic.
    </p>
  `, { iconName: "mail-line", id: "accessibiliteContact" });

  const recours = panel("Voie de recours", `
    <p>
      Si le signalement n'a pas permis d'obtenir une réponse satisfaisante, ou si le
      service est resté inaccessible :
    </p>
    <ul>
      <li>Écrire au <strong>Défenseur des droits</strong> — 29, rue Servan, 75011 Paris —
        ou remplir le formulaire en ligne disponible sur le site du Défenseur des droits ;</li>
      <li>contacter par téléphone le <strong>09 69 39 00 00</strong> (appel non surtaxé) ;</li>
      <li>contacter le <strong>délégué du Défenseur des droits</strong> de votre
        département.</li>
    </ul>
    <p>
      <a href="https://formulaire.defenseurdesdroits.fr/" target="_blank" rel="noopener noreferrer">Défenseur des droits — formulaire de saisine en ligne</a>
    </p>
  `, { iconName: "scales-3-line", id: "accessibiliteRecours" });

  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Accessibilité</p>
    <h1 class="fr-h3">Déclaration d'accessibilité</h1>
    <p class="app-page-head__sub">Conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005.</p>
  </div>
</div>
${sommaire}
${etat}
${tests}
${nonConformites}
${schema}
${contact}
${recours}`;
}

/** Le libellé de la page, pour un éventuel rappel (fil d'Ariane, titre). */
export const LIBELLE_ACCESSIBILITE = NAV.find((n) => n.id === "accessibilite")?.label || "Accessibilité";
