// Vue « Échéances » de la page Calendrier.
//
// Le calendrier ne remplace pas l'agenda professionnel de chacun : il montre
// le mois en cours, séance par séance, et laisse exporter un fichier `.ics`
// qui, lui, se range dans Outlook ou Google Agenda (voir `calendrier.js`).
//
// C'est la **première vue** de la page « Calendrier » : elle rassemble toutes
// les échéances, celles des affaires comme celles des séances. La **seconde**
// vue, « Séances et rôles », est la page où l'on programme une séance et où
// l'on compose son rôle (voir `views/seances.js`) — la séance n'est qu'un
// rendez-vous parmi les échéances.

import { toDate } from "../formulas.js";
import { mentionPerimetre, perimetreRestreint } from "../visibilite.js";
import { evenementsCalendrier } from "../calendrier.js";
import * as ui from "../ui.js";
import { exportListeItems, exportMenu, exportStatus, subnavCalendrier } from "./common.js";

const { esc, icon, panel, emptyState, button, tag } = ui;

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Classe CSS d'une catégorie d'événement : sans accent, sans espace. */
function classeCategorie(categorie) {
  return String(categorie || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-") || "autre";
}

const pad = (n) => String(n).padStart(2, "0");
const cleMois = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Mois affiché : le filtre mémorisé, ou le mois courant. */
function moisAffiche(state) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(state.filters.calendrierMois || ""));
  const now = new Date();
  if (!m) return { annee: now.getFullYear(), mois: now.getMonth() };
  return { annee: Number(m[1]), mois: Number(m[2]) - 1 };
}

/** Nom de mois lisible pour `aria-label` et le titre. */
const libelleMois = ({ annee, mois }) => `${MOIS[mois]} ${annee}`;

/**
 * Grille du mois : six semaines de sept jours, commençant le lundi. Les jours
 * hors du mois restent affichés (grisés) pour que la grille reste continue.
 */
function grilleDuMois({ annee, mois }, evenements, aujourdhui, selection = "") {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // lundi = 0
  const debut = new Date(annee, mois, 1 - decalage);
  const parJour = new Map();
  for (const e of evenements) {
    if (!parJour.has(e.date)) parJour.set(e.date, []);
    parJour.get(e.date).push(e);
  }
  const semaines = [];
  for (let s = 0; s < 6; s++) {
    const jours = [];
    for (let j = 0; j < 7; j++) {
      const d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + s * 7 + j);
      const cle = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      jours.push({ date: d, cle, horsMois: d.getMonth() !== mois, evenements: parJour.get(cle) || [] });
    }
    semaines.push(jours);
    if (s >= 4 && jours.every((x) => x.date.getMonth() !== mois || x.date.getDate() < 1)) break;
  }
  const cellules = semaines.map((jours) => `<tr>
    ${jours.map((j) => {
      const classes = ["app-cal__jour"];
      if (j.horsMois) classes.push("app-cal__jour--hors");
      if (j.cle === aujourdhui) classes.push("app-cal__jour--aujourdhui");
      if (selection && j.cle === selection) classes.push("app-cal__jour--choisi");
      const contenu = j.evenements.slice(0, 3).map((e) => `<span class="app-cal__evt app-cal__evt--${classeCategorie(e.categorie)}"
        title="${esc(`${e.heure ? `${e.heure} ` : ""}${e.titre}`)}">${e.heure ? `<span class="app-cal__heure">${esc(e.heure)}</span>` : ""}${esc(e.court)}</span>`).join("");
      const reste = j.evenements.length > 3 ? `<span class="app-cal__plus">+${j.evenements.length - 3}</span>` : "";
      return `<td class="${classes.join(" ")}"${j.evenements.length ? ` data-action="cal-jour" data-record="${j.cle}"` : ""}>
        <span class="app-cal__num">${j.date.getDate()}</span>
        <div class="app-cal__evts">${contenu}${reste}</div>
      </td>`;
    }).join("")}
  </tr>`).join("");
  return `
<div class="fr-table fr-table--bordered app-cal">
  <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
    <table>
      <caption class="fr-sr-only">Calendrier de ${esc(libelleMois({ annee, mois }))}</caption>
      <thead><tr>${JOURS.map((j) => `<th scope="col">${esc(j)}</th>`).join("")}</tr></thead>
      <tbody>${cellules}</tbody>
    </table>
  </div></div></div>
</div>`;
}

export function viewCalendrier(store, state) {
  const ctx = state.ctx;
  const restreint = perimetreRestreint(store, state);
  const mention = mentionPerimetre(store, state);
  const evenements = evenementsCalendrier(store, state);
  const vue = moisAffiche(state);
  const now = new Date();
  const aujourdhui = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Ce que l'export emporte : plutôt qu'un panneau qui explique un bouton, la
  // composition du fichier tient dans l'infobulle du bouton lui-même — elle ne
  // sert qu'à l'instant où l'on hésite à cliquer.
  const parCategorie = (cat) => evenements.filter((e) => e.categorie === cat).length;
  const contenuExport = [
    `${parCategorie("Séance")} séance(s)`,
    `${parCategorie("Convocation")} convocation(s)`,
    `${parCategorie("Délai")} délai(s)`,
    `${parCategorie("Sanction")} terme(s) de sanction`,
  ].join(" · ");

  const head = `
<div class="app-page-head">
  <div>
    <p class="app-kicker">${restreint ? "Mon calendrier" : "Calendrier"}</p>
    <h1 class="fr-h3">Séances et échéances</h1>
    <p class="app-page-head__sub">Les séances programmées et les échéances des affaires suivies — saisine,
      convocation, prescription, terme de la sanction, expiration du délai de recours. Exportables en un
      fichier d'agenda, à importer dans Outlook ou Google Agenda.</p>
  </div>
  <div class="app-page-head__actions">
    ${button("Créer une séance", { variant: "primary", iconName: "add-line", action: "add-seance" })}
    ${exportMenu({
      label: "Exporter",
      items: button("Agenda (.ics)", {
          variant: "secondary", iconName: "calendar-check-line", action: "export-ics",
          title: `Fichier iCalendar du périmètre courant, à importer dans votre agenda — ${contenuExport}`,
        })
        + exportListeItems({ source: "echeances", titre: "Télécharger la liste des échéances du périmètre courant" }),
    })}
  </div>
</div>
${subnavCalendrier(state.sub)}
${mention ? ui.alert("info", "Périmètre restreint", mention) : ""}
${exportStatus()}`;

  const barreMois = `
<div class="app-cal__bar">
  <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-action="cal-mois" data-record="-1">
    ${icon("arrow-left-line")}<span class="fr-sr-only">Mois précédent</span>
  </button>
  <p class="app-cal__titre" aria-live="polite">${esc(libelleMois(vue))}</p>
  <button type="button" class="fr-btn fr-btn--tertiary fr-btn--sm" data-action="cal-mois" data-record="1">
    ${icon("arrow-right-line")}<span class="fr-sr-only">Mois suivant</span>
  </button>
  ${cleMois(now) !== `${vue.annee}-${pad(vue.mois + 1)}`
    ? button("Aujourd'hui", { variant: "tertiary-no-outline", size: "sm", action: "cal-aujourd-hui" })
    : ""}
</div>`;

  // Agenda du mois : la grille tronque, la liste non. Elle porte donc tout ce
  // que le mois contient, dans l'ordre — ou la seule journée cliquée.
  const prefixeMois = `${vue.annee}-${pad(vue.mois + 1)}`;
  const jour = String(state.filters.calendrierJour || "");
  const duMois = evenements.filter((e) => (jour ? e.date === jour : e.date.startsWith(prefixeMois)));
  const libelleJour = jour
    ? (() => { const d = toDate(jour); return `${JOURS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; })()
    : "";
  const agenda = duMois.length
    ? `<div class="fr-table fr-table--bordered fr-table--sm">
        <div class="fr-table__wrapper"><div class="fr-table__container"><div class="fr-table__content">
          <table>
            <caption class="fr-sr-only">Agenda de ${esc(jour ? libelleJour : libelleMois(vue))}</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Événement</th><th scope="col">Lieu</th><th scope="col">Catégorie</th></tr></thead>
            <tbody>
              ${duMois.map((e) => {
                const d = toDate(e.date);
                const passe = e.date < aujourdhui;
                return `<tr>
                  <td class="app-nowrap">${JOURS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS[d.getMonth()]}${e.heure ? ` <strong>${esc(e.heure)}</strong>` : ""}</td>
                  <td>${esc(e.titre)}${e.resume ? `<br><span class="app-muted">${esc(e.resume.split("\n").slice(0, 2).join(" · ").slice(0, 160))}</span>` : ""}</td>
                  <td>${esc(e.lieu) || "—"}</td>
                  <td>${tag(e.categorie, passe ? "" : "blue")}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div></div></div>
      </div>`
    : emptyState(jour ? "Aucune séance ni échéance ce jour-là." : "Aucune séance ni échéance ce mois-ci.", { iconName: "calendar-check-line" });

  const aVenir = evenements.filter((e) => e.date >= aujourdhui).slice(0, 8);
  const prochaines = panel("À venir", aVenir.length
    ? `<ul class="app-list">${aVenir.map((e) => {
        const d = toDate(e.date);
        return `<li class="app-list__item app-list__item--static">
          <span class="app-list__ref">${esc(`${d.getDate()} ${MOIS[d.getMonth()]}`)}${e.heure ? ` · ${esc(e.heure)}` : ""}</span>
          <span class="app-list__name">${esc(e.titre)}</span>
          ${e.lieu ? `<span class="app-list__meta">${esc(e.lieu)}</span>` : ""}
        </li>`;
      }).join("")}</ul>`
    : emptyState("Aucune échéance à venir.", { iconName: "calendar-check-line" }), {
    iconName: "time-line",
    subtitle: "Les huit prochaines échéances du périmètre",
  });

  // Les pastilles de la grille disent leur catégorie par le ton ; ce panneau
  // l'explicite, et donne la composition du mois affiché. Il occupe la colonne
  // laissée libre tant qu'aucun jour n'est ouvert — sans quoi la ligne
  // s'arrêtait aux deux tiers de la page, sur un vide.
  const duMoisAffiche = evenements.filter((e) => e.date.startsWith(prefixeMois));
  const categories = [...new Set(duMoisAffiche.map((e) => e.categorie))].filter(Boolean);
  const reperes = panel("Ce mois-ci", categories.length
    ? `<ul class="app-reperes">
        ${categories.map((cat) => `<li>
          <span class="app-cal__evt app-cal__evt--${classeCategorie(cat)}">${esc(cat)}</span>
          <span class="app-reperes__n">${duMoisAffiche.filter((e) => e.categorie === cat).length}</span>
        </li>`).join("")}
      </ul>`
    : emptyState("Aucune échéance ce mois-ci.", { iconName: "calendar-check-line" }), {
    iconName: "palette-line",
    subtitle: "Le ton d'une pastille dit sa catégorie",
  });

  return `
${head}
${panel("Calendrier", `${barreMois}${grilleDuMois(vue, evenements, aujourdhui, jour)}`, {
    iconName: "calendar-check-line",
    subtitle: `${evenements.filter((e) => e.date.startsWith(prefixeMois)).length} échéance(s) ce mois-ci — cliquez un jour pour le détail`,
  })}
<div class="fr-grid-row fr-grid-row--gutters">
  ${jour ? `<div class="fr-col-12 fr-col-lg-7">${panel(`Agenda du ${libelleJour}`, agenda, {
    iconName: "list-unordered",
    actions: button("Voir tout le mois", { variant: "tertiary", size: "sm", action: "cal-jour", attrs: 'data-record=""' }),
  })}</div>` : ""}
  <div class="fr-col-12 ${jour ? "fr-col-lg-5" : "fr-col-lg-8"} app-stack">${prochaines}${jour ? reperes : ""}</div>
  ${jour ? "" : `<div class="fr-col-12 fr-col-lg-4">${reperes}</div>`}
</div>`;
}
