// Attribution des affaires aux secrétaires.
//
// Vue réservée aux propriétaires du document — le poste de commande de la
// répartition. Un secrétaire ne voyant que les affaires qui lui sont
// attribuées (voir `visibilite.js`), c'est ici que l'on décide qui suit quoi :
// affaire par affaire, au fil de la liste, ou par lots (« ces douze affaires
// sont à Isabelle »). Le récapitulatif du bas montre la charge de chacun et met
// en évidence ce qui n'a pas encore de titulaire.

import { ETATS } from "../schema.js";
import { currentRole } from "../roles.js";
import * as ui from "../ui.js";
import { affaireRef, affaireName, matches, sortRecords, exportTableButtons } from "./common.js";

const { esc, str, icon, badge, dateCell, panel, emptyState, button, kpi, tag, alert, chip } = ui;

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

/** Identifiants d'une colonne de références multiples. */
const refIds = (value) => {
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value ?? "").replace(/[[\]]/g, "").split(",").map((x) => Number(x.trim())).filter(Boolean);
};

/** Secrétaires proposés à l'attribution (fiches actives), triés par nom. */
export function secretairesActifs(store, state) {
  const ctx = state.ctx;
  return sortRecords(
    store.table("Secretaires").filter((s) => ctx.v("Secretaires", s, "Actif_")),
    (s) => String(ctx.v("Secretaires", s, "Nom_complet") || "").trim().toLocaleLowerCase("fr"),
    "asc"
  );
}

/** « Isabelle LECOMTE (UV) » — le nom, suivi des sigles de ses sections. */
export function libelleSecretaire(store, state, s) {
  const nom = String(state.ctx?.v("Secretaires", s, "Nom_complet") || "").trim() || `#${s.id}`;
  const sigles = refIds(s.Section)
    .map((id) => store.byId("Sections_disciplinaires", id))
    .map((x) => (x ? str(x.Acronyme) || str(x.Structure) : ""))
    .filter(Boolean);
  return sigles.length ? `${nom} (${sigles.join(", ")})` : nom;
}

/** Affaires proposées à la répartition, après filtres. */
export function attribuables(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  let rows = store.table("Affaires");
  if (f.attributionQ) {
    rows = rows.filter((a) => matches(f.attributionQ, affaireRef(ctx, a), affaireName(ctx, a), a.Numero,
      ctx.v("Affaires", a, "INE"), ctx.v("Affaires", a, "Corps")));
  }
  if (f.attributionSection) rows = rows.filter((a) => Number(a.Section) === Number(f.attributionSection));
  if (f.attributionEtat) rows = rows.filter((a) => a.Etat === f.attributionEtat);
  if (f.attributionSecretaire !== undefined && f.attributionSecretaire !== "") {
    const id = Number(f.attributionSecretaire) || 0;
    rows = id
      ? rows.filter((a) => Number(a.Secretaire) === id)
      : rows.filter((a) => !Number(a.Secretaire));
  }
  return sortRecords(rows, (a) => String(a.Date_de_saisine || ""), "desc");
}

/** Charge de chaque secrétaire, plus la ligne « sans secrétaire ». */
function charge(store, state) {
  const affaires = store.table("Affaires");
  const parSecretaire = new Map();
  for (const a of affaires) {
    const id = Number(a.Secretaire) || 0;
    if (!parSecretaire.has(id)) parSecretaire.set(id, []);
    parSecretaire.get(id).push(a);
  }
  const lignes = secretairesActifs(store, state).map((s) => ({
    id: s.id,
    libelle: libelleSecretaire(store, state, s),
    affaires: parSecretaire.get(s.id) || [],
  })).filter((l) => l.affaires.length);
  // Fiches auxquelles des affaires restent attribuées alors qu'elles sont
  // désactivées ou supprimées : sans cette ligne, leur charge disparaîtrait du
  // récapitulatif sans que personne ne s'en aperçoive.
  for (const [id, rows] of parSecretaire) {
    if (!id || lignes.some((l) => l.id === id)) continue;
    const fiche = store.byId("Secretaires", id);
    lignes.push({
      id,
      libelle: fiche ? `${libelleSecretaire(store, state, fiche)} — inactif` : `Fiche supprimée (#${id})`,
      affaires: rows,
      inactif: true,
    });
  }
  return {
    lignes: sortRecords(lignes, (l) => l.affaires.length, "desc"),
    sans: parSecretaire.get(0) || [],
  };
}

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

/**
 * Liste déroulante d'attribution : l'affaire est attribuée dès le choix, sans
 * bouton à chercher. La personne à qui l'affaire est déjà confiée garde sa
 * place en tête de liste même si sa fiche a été désactivée depuis.
 */
function selectSecretaire(store, state, options, { action, record = null, value = "", label = "" }) {
  const courante = Number(value) || 0;
  const connus = options.some((o) => o.id === courante);
  // Une affaire confiée à une fiche absente des propositions — désactivée
  // depuis, ou supprimée — garde son attribution visible : sans cette ligne,
  // la liste déroulante afficherait « Non attribuée » alors que l'affaire l'est.
  let orpheline = "";
  if (courante && !connus) {
    const fiche = store.byId("Secretaires", courante);
    orpheline = fiche
      ? `${libelleSecretaire(store, state, fiche)}${state.ctx.v("Secretaires", fiche, "Actif_") ? "" : " — inactif"}`
      : `Fiche supprimée (#${courante})`;
  }
  return `
<select class="fr-select" aria-label="${esc(label || "Secrétaire de l'affaire")}"
  data-action="${esc(action)}"${record === null ? "" : ` data-record="${record}"`}>
  <option value="" ${courante ? "" : "selected"}>— Non attribuée —</option>
  ${options.map((o) => `<option value="${o.id}" ${courante === o.id ? "selected" : ""}>${esc(o.libelle)}</option>`).join("")}
  ${orpheline ? `<option value="${courante}" selected>${esc(orpheline)}</option>` : ""}
</select>`;
}

function barreLot(store, state, options) {
  const ids = state.attribution.ids;
  if (!ids.length) return "";
  const combien = `${ids.length} affaire${ids.length > 1 ? "s" : ""} sélectionnée${ids.length > 1 ? "s" : ""}`;
  return `
<div class="app-lot" role="group" aria-label="Attribution par lots">
  <p class="fr-text--sm fr-mb-0 app-lot__compte">
    ${icon("checkbox-line", 'class="fr-mr-1v"')}${combien}
  </p>
  <div class="app-lot__cible">
    ${selectSecretaire(store, state, options, {
      action: "attribution-cible",
      value: state.attribution.cible,
      label: "Secrétaire à qui attribuer la sélection",
    })}
  </div>
  ${button("Attribuer", { variant: "primary", size: "sm", iconName: "arrow-left-right-line", action: "attribution-appliquer" })}
  ${button("Retirer l'attribution", { variant: "secondary", size: "sm", iconName: "subtract-line", action: "attribution-retirer" })}
  ${button("Désélectionner", { variant: "tertiary", size: "sm", iconName: "close-line", action: "attribution-effacer" })}
</div>`;
}

function tableau(store, state, rows, options, caption) {
  if (!rows.length) {
    return emptyState("Aucune affaire ne correspond à ces filtres.", { iconName: "search-line" });
  }
  const ctx = state.ctx;
  const sections = store.table("Sections_disciplinaires");
  const selection = new Set(state.attribution.ids);
  const tout = rows.every((a) => selection.has(a.id));
  return `
<div class="fr-table fr-table--bordered fr-table--sm app-table--fixed app-table--attribution">
  <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
    <table>
      <caption>${caption}</caption>
      <colgroup>
        <col style="width:5%"><col style="width:11%"><col style="width:15%"><col style="width:10%">
        <col style="width:15%"><col style="width:16%"><col style="width:28%">
      </colgroup>
      <thead><tr>
        <th scope="col">
          <div class="fr-checkbox-group app-check app-check--inline">
            <input type="checkbox" id="attrTout" data-action="attribution-tout" ${tout ? "checked" : ""}>
            <label class="fr-label" for="attrTout"><span class="fr-sr-only">Tout sélectionner</span></label>
          </div>
        </th>
        <th scope="col">N°</th><th scope="col">Mis en cause</th><th scope="col">Section</th>
        <th scope="col">État</th><th scope="col">Saisine</th><th scope="col">Secrétaire</th>
      </tr></thead>
      <tbody>
        ${rows.map((a) => {
          const nom = affaireName(ctx, a);
          const section = a.Section ? store.byId("Sections_disciplinaires", a.Section) : null;
          return `
        <tr${selection.has(a.id) ? ' class="fr-row--selected"' : ""}>
          <td>
            <div class="fr-checkbox-group app-check app-check--inline">
              <input type="checkbox" id="attr-${a.id}" data-action="attribution-cocher" data-record="${a.id}" ${selection.has(a.id) ? "checked" : ""}>
              <label class="fr-label" for="attr-${a.id}"><span class="fr-sr-only">Sélectionner l'affaire ${esc(affaireRef(ctx, a))}</span></label>
            </div>
          </td>
          <td class="app-nowrap"><strong>${esc(affaireRef(ctx, a))}</strong></td>
          <td><div class="app-clip" title="${esc(nom)}">${esc(nom)}</div></td>
          <td class="app-nowrap">${esc(section ? str(section.Acronyme) || str(section.Structure) : "—")}</td>
          <td>${badge(a.Etat)}</td>
          <td class="app-nowrap">${dateCell(a.Date_de_saisine)}</td>
          <td>${selectSecretaire(store, state, options, {
            action: "attribuer-affaire",
            record: a.id,
            value: a.Secretaire,
            label: `Secrétaire de l'affaire ${affaireRef(ctx, a)}`,
          })}</td>
        </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div></div></div>
</div>`;
}

/**
 * La charge de chacun, en une ligne de pastilles.
 *
 * Elle occupait autrefois un **second tableau**, qui répondait au premier en
 * répétant chaque nom, chaque compteur et chaque état : deux tableaux pour une
 * seule question — « qui suit quoi ? ». Les pastilles disent la même chose sur
 * une ligne, et **servent de filtre** : cliquer un nom n'affiche que ses
 * affaires, cliquer « Sans secrétaire » celles qui n'ont pas encore de
 * titulaire. La ligne de la grille est l'endroit où l'on attribue ; celle-ci est
 * l'endroit où l'on regarde la répartition.
 */
function chargeBar(store, state, resume) {
  const actif = String(state.filters.attributionSecretaire || "");
  const pastille = (l) => chip(l.libelle, {
    active: actif === String(l.id),
    action: "attribution-secretaire",
    attrs: `data-record="${l.id}"`,
    count: l.affaires.length,
  });
  return `
<div class="app-chips app-chips--charge">
  ${chip("Sans secrétaire", {
    active: actif === "0",
    action: "attribution-non-attribuees",
    count: resume.sans.length,
  })}
  ${resume.lignes.map(pastille).join("")}
</div>`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function viewAttribution(store, state) {
  const ctx = state.ctx;
  const f = state.filters;
  const options = secretairesActifs(store, state).map((s) => ({
    id: s.id,
    libelle: libelleSecretaire(store, state, s),
  }));
  const affaires = store.table("Affaires");
  const resume = charge(store, state);
  const rows = attribuables(store, state);
  const sansSecretaire = affaires.filter((a) => !Number(a.Secretaire));
  const sections = store.table("Sections_disciplinaires");

  // La charge se lit dans l'en-tête du tableau qui la porte : combien
  // d'affaires, combien de titulaires, combien à répartir. C'est le même
  // chiffre que les tuiles du haut, mais dit du point de vue de la liste
  // affichée — c'est elle qu'on regarde quand on se demande ce qu'il reste à
  // faire.
  const attribuees = affaires.length - sansSecretaire.length;
  const legende = `${rows.length} affaire(s) affichée(s) sur ${affaires.length}`
    + ` — ${attribuees} attribuée(s), ${sansSecretaire.length} à répartir`
    + " · le choix d'un secrétaire attribue aussitôt";

  const filtresActifs = ["attributionQ", "attributionSection", "attributionEtat", "attributionSecretaire"]
    .some((k) => f[k] !== undefined && f[k] !== "");

  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Attribution</p>
    <h1 class="fr-h3">Répartir les affaires entre les secrétaires</h1>
    <p class="app-page-head__sub">Un secrétaire ne voit que les affaires qui lui sont attribuées : c'est ici que la répartition se décide, ligne par ligne ou par lots.</p>
  </div>
</div>
${options.length ? "" : alert("warning", "Aucun secrétaire actif", "Les fiches secrétaires se créent et s'activent dans Réglages › Secrétaires. Sans fiche active, aucune affaire ne peut être attribuée.")}
<div class="app-kpis">
  ${kpi({ label: "Affaires", value: affaires.length, hint: `${rows.length} après filtres`, iconName: "folder-2-line", href: "#affaires" })}
  ${kpi({
    label: "Sans secrétaire",
    value: sansSecretaire.length,
    hint: sansSecretaire.length ? "à répartir" : "toutes les affaires ont un titulaire",
    iconName: "user-search-line",
    tone: sansSecretaire.length ? "warning" : "",
    action: "attribution-non-attribuees",
  })}
  ${kpi({
    label: "Attribuées",
    value: affaires.length - sansSecretaire.length,
    hint: "affaire(s) avec un titulaire",
    iconName: "user-star-line",
  })}
  ${kpi({
    label: "Secrétaires actifs",
    value: options.length,
    hint: options.length ? "peuvent recevoir des affaires" : "aucune fiche active",
    iconName: "group-line",
    href: "#reglages/secretaires",
  })}
</div>
<div class="app-filters app-filters--page">
  <div class="app-search">
    <label class="fr-label" for="attributionQ">Rechercher</label>
    <input class="fr-input" type="search" id="attributionQ" data-filter="attributionQ"
      value="${esc(f.attributionQ || "")}" placeholder="Numéro, nom, INE ou corps…">
  </div>
  ${sections.length > 1 ? `
  <div class="fr-select-group app-select-inline">
    <label class="fr-label" for="attributionSection">Section</label>
    <select class="fr-select" id="attributionSection" data-filter="attributionSection">
      <option value="">Toutes les sections</option>
      ${sections.map((s) => `<option value="${s.id}" ${String(f.attributionSection) === String(s.id) ? "selected" : ""}>${esc(str(s.Acronyme) || str(s.Structure))}</option>`).join("")}
    </select>
  </div>` : ""}
  <div class="fr-select-group app-select-inline">
    <label class="fr-label" for="attributionEtat">État</label>
    <select class="fr-select" id="attributionEtat" data-filter="attributionEtat">
      <option value="">Tous les états</option>
      ${ETATS.map((e) => `<option value="${esc(e)}" ${f.attributionEtat === e ? "selected" : ""}>${esc(e)}</option>`).join("")}
    </select>
  </div>
  <div class="fr-select-group app-select-inline">
    <label class="fr-label" for="attributionSecretaire">Secrétaire</label>
    <select class="fr-select" id="attributionSecretaire" data-filter="attributionSecretaire">
      <option value="">Tous</option>
      <option value="0" ${String(f.attributionSecretaire) === "0" ? "selected" : ""}>Sans secrétaire</option>
      ${options.map((o) => `<option value="${o.id}" ${String(f.attributionSecretaire) === String(o.id) ? "selected" : ""}>${esc(o.libelle)}</option>`).join("")}
    </select>
  </div>
  ${filtresActifs
    ? button("Réinitialiser les filtres", { variant: "tertiary", size: "sm", iconName: "refresh-line", action: "attribution-reinit" })
    : ""}
</div>
${barreLot(store, state, options)}
${panel("Affaires à répartir", `${chargeBar(store, state, resume)}${tableau(store, state, rows, options, legende)}`, {
    iconName: "list-check",
    subtitle: resume.sans.length
      ? `${resume.sans.length} affaire(s) sans titulaire`
      : "Toutes les affaires ont un titulaire",
    actions: exportTableButtons({
      table: "Affaires", rows, size: "sm",
      titre: "Télécharger la répartition affichée, avec le secrétaire de chaque affaire",
    }),
  })}`;
}

/**
 * Adresse directe vers la répartition pour qui n'y a pas droit (le menu ne la
 * propose qu'aux propriétaires, mais un signet ou un lien partagé peut
 * survivre à un changement de rôle). Mieux vaut le dire que d'ouvrir une page
 * vide.
 */
export function viewAttributionInterdit(store, state) {
  const texte = currentRole(state) === "visiteur"
    ? "Vous êtes identifié comme « Visiteur » : l'outil est en lecture seule, et la répartition des affaires entre secrétaires est décidée par les propriétaires du document."
    : "Seuls les propriétaires du document répartissent les affaires entre les secrétaires. Les affaires qui vous sont attribuées apparaissent dans la page « Affaires ».";
  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Attribution</p>
    <h1 class="fr-h3">Répartition réservée aux propriétaires</h1>
    <p class="app-page-head__sub">La vue « Attribution des affaires » répartit les dossiers entre les secrétaires ; elle suit les droits du document Grist.</p>
  </div>
</div>
${alert("info", "Votre rôle ne donne pas accès à la répartition", texte)}
<p class="fr-mb-0">
  <a class="fr-btn fr-btn--secondary" href="#affaires" data-nav="affaires">${icon("arrow-left-line", 'class="fr-mr-1v"')}Voir mes affaires</a>
</p>`;
}
