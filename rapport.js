// Rapport d'activité : les indicateurs, les graphiques et les tableaux.
//
// Le tableau de bord répond à « où en est-on ? » : il compte ce qui est ouvert,
// ce qui vient, ce qu'il reste à faire. Le rapport d'activité répond à une
// autre question — « qu'a fait la section cette année ? » — et se lit **par
// période** : affaires reçues, décisions rendues, sanctions prononcées, délais,
// recours, séances. C'est une pièce qu'on présente, qu'on imprime et qu'on
// annexe ; d'où les trois formes que ce module produit à partir des mêmes
// chiffres :
//
//   - `kpis` : les chiffres clés, en cartes, pour la lecture rapide ;
//   - `graphiques` : les graphiques (camemberts, anneaux, barres, colonnes)
//     — voir `graphiques.js` —, chacun exportable en PNG ;
//   - `tableaux` : les mêmes chiffres en tableaux, exportables en CSV et en
//     Excel, et repris dans le rapport imprimé.
//
// Règle de comptage : une affaire compte à sa **date de saisine**, une décision
// à sa **date de délibéré**. Les deux dates sont celles qui font l'activité
// d'une année — une affaire reçue en 2025 et jugée en 2026 est une affaire de
// 2025 et une décision de 2026. Le délai de traitement, lui, se lit sur chaque
// décision : c'est le temps écoulé entre la saisine de son affaire et sa
// notification (voir `Decisions.Delai_de_traitement`, formulas.js).
//
// Le périmètre de visibilité s'applique comme partout ailleurs : le rapport
// d'un secrétaire est celui de ses affaires. Rien n'est inventé — un indicateur
// sans donnée disparaît, plutôt que d'afficher un zéro qui ferait croire à une
// absence d'activité.

import { ETATS, NATURES_DECISION, REGIMES, TYPES_SECTION, VOIES, estCloseEtat } from "./schema.js";
import { Context, toDate, formatDateFr, aujourdHui } from "./formulas.js";
import { affairesVisibles, parAffaire, perimetreRestreint } from "./visibilite.js";
import { libellesSections } from "./views/common.js";

/* ------------------------------------------------------------------ */
/* Période                                                             */
/* ------------------------------------------------------------------ */

/** Mois courts des libellés d'axe — « janv. », « févr. »… */
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Clé du filtre de période, dans `state.filters` (voir app.js). */
export const FILTRE_ANNEE = "rapportAnnee";

/** Années présentes dans les données : saisines, délibérés et séances. */
export function anneesDisponibles(store) {
  const annees = new Set();
  const ajouter = (valeur) => {
    const d = toDate(valeur);
    if (d) annees.add(d.getFullYear());
  };
  for (const a of store.table("Affaires")) ajouter(a.Date_de_saisine);
  for (const d of store.table("Decisions")) ajouter(d.Date_du_delibere);
  for (const s of store.table("Seances_d_examen")) ajouter(s.Date);
  return [...annees].sort((a, b) => b - a);
}

/** Année retenue par le filtre : `null` pour « toutes les années ». */
export function anneeRetenue(store, state) {
  const choix = String(state?.filters?.[FILTRE_ANNEE] ?? "");
  if (choix === "toutes") return null;
  const annees = anneesDisponibles(store);
  const annee = Number(choix);
  if (Number.isInteger(annee) && annees.includes(annee)) return annee;
  // Sans choix mémorisé — ou choix devenu caduc —, la dernière année connue :
  // un rapport d'activité parle d'une année, et c'est celle qu'on vient de
  // vivre qui se présente d'abord.
  return annees[0] ?? null;
}

/** La date tombe-t-elle dans la période ? (`annee` nulle : toutes les années.) */
function dansPeriode(valeur, annee) {
  if (annee === null) return true;
  const d = toDate(valeur);
  return !!d && d.getFullYear() === annee;
}

/** Libellé de la période : « Année 2026 », ou les bornes des années connues. */
export function libellePeriode(store, annee) {
  if (annee !== null) return `Année ${annee}`;
  // Le choix « toutes les années » se dit tel quel, même quand les données ne
  // couvrent qu'une année : c'est ce que la personne a demandé à voir.
  const annees = anneesDisponibles(store);
  if (annees.length > 1) return `Toutes les années (${annees[annees.length - 1]} – ${annees[0]})`;
  return "Toutes les années";
}

/* ------------------------------------------------------------------ */
/* Petits calculs                                                      */
/* ------------------------------------------------------------------ */

const nombreFr = new Intl.NumberFormat("fr-FR");

function nombre(valeur) {
  return nombreFr.format(Number(valeur) || 0);
}

function pourcent(part, total) {
  if (!total) return "—";
  const p = (part / total) * 100;
  return `${(p >= 10 ? Math.round(p) : p.toFixed(1)).toString().replace(".", ",")} %`;
}

function moyenne(valeurs) {
  if (!valeurs.length) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

function mediane(valeurs) {
  if (!valeurs.length) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

/** Délai en mois, écrit à la française : « 3,4 ». */
function mois(valeur) {
  return (valeur / 30.44).toFixed(1).replace(".", ",");
}

/** Compte les occurrences d'une clé, en gardant les libellés dans l'ordre donné. */
function compter(rows, cle, libelles = null) {
  const compte = new Map();
  for (const row of rows) {
    const valeur = String(cle(row) ?? "").trim();
    if (!valeur) continue;
    compte.set(valeur, (compte.get(valeur) || 0) + 1);
  }
  const entrees = [...compte.entries()];
  const ordonnees = libelles
    ? libelles.filter((l) => compte.has(l)).map((l) => [l, compte.get(l)])
    : entrees;
  return ordonnees.map(([label, value]) => ({ label, value }));
}

const TRANCHES_DELAI = [
  { label: "Moins de 3 mois", min: 0, max: 91 },
  { label: "de 3 à 6 mois", min: 91, max: 183 },
  { label: "de 6 à 12 mois", min: 183, max: 365 },
  { label: "12 mois et plus", min: 365, max: Infinity },
];

/* ------------------------------------------------------------------ */
/* Le rapport                                                          */
/* ------------------------------------------------------------------ */

/**
 * Tous les chiffres du rapport, pour la période retenue.
 *
 * @returns {{annee: number|null, periode: string, sections: number, kpis: Array,
 *   graphiques: Array<{id, titre, categorie, spec}>, tableaux: Array<{id, nom, domaine, entetes, lignes}>}}
 */
export function rapportActivite(store, state) {
  const ctx = state.ctx || new Context(store.db, store);
  const annee = anneeRetenue(store, state);
  const periode = libellePeriode(store, annee);

  // Périmètre, comme partout : le rapport suit les affaires que la personne voit.
  const affairesToutes = affairesVisibles(store, state, store.table("Affaires"));
  const affaires = affairesToutes.filter((a) => dansPeriode(a.Date_de_saisine, annee));
  const decisionsToutes = parAffaire(store, state, store.table("Decisions"), (d) => d.Affaire);
  // Une décision appartient à sa date de délibéré ; à défaut, à sa notification.
  const dateDecision = (d) => d.Date_du_delibere || d.Date_de_notification;
  const decisions = decisionsToutePeriode(decisionsToutes, dateDecision, annee);
  const sections = new Set(affairesToutes.map((a) => Number(a.Section) || 0));
  const libelles = libellesSections(ctx);
  // Une affaire sans section ne compte pour aucune : mieux vaut l'absence
  // qu'une ligne « Section n° 0 » qui ne désigne rien.
  const libelleDe = (affaire) => {
    const id = Number(affaire?.Section) || 0;
    if (!id) return "";
    return libelles.get(id) || `Section n° ${id}`;
  };
  const regimeDe = (affaire) => String(ctx.v("Affaires", affaire, "Section_Public") || "").trim();
  const memeRegime = (affaire, regime) => regimeDe(affaire) === regime;
  // Les libellés des voies de traitement : ils font office d'axe (l'ordre du
  // code), et non de simple liste de valeurs rencontrées.
  const voies = VOIES;

  // Les séances de la période : celles des sections suivies par la personne
  // (une séance sans section, ou d'une section inconnue, est comptée — mieux
  // vaut montrer que taire).
  const seances = store.table("Seances_d_examen").filter((s) => {
    const section = Number(s.Section) || 0;
    if (section && sections.size && !sections.has(section)) return false;
    return dansPeriode(s.Date, annee);
  });
  const vues = new Set(affairesToutes.map((a) => a.id));
  const affairesEnSeance = seances.reduce((n, s) => n + affairesInscrites(ctx, s, vues).length, 0);

  const recours = recoursDuPerimetre(store, vues, annee);

  /* --- Décisions : ce qu'elles disent ---------------------------------- */

  const nature = (d) => String(d.Nature || "Sanction");
  const libelleDecision = (d) => String(ctx.v("Decisions", d, "Libelle_decision") || "").trim();
  const sanctions = decisions.filter((d) => nature(d) === "Sanction");
  const delais = decisions
    .map((d) => ctx.v("Decisions", d, "Delai_de_traitement"))
    .filter((v) => v !== null && v !== undefined);
  const delaiMoyen = moyenne(delais);
  const delaiMedian = mediane(delais);
  const sursis = sanctions.filter((d) => ctx.v("Decisions", d, "Sursis_")).length;
  // Durée d'exclusion : la somme des durées prononcées, sur les seules
  // décisions qui en portent une (les autres sanctions n'en ont pas).
  const durees = sanctions
    .map((d) => Number(d.Duree_totale_d_exclusion_mois_ || 0))
    .filter((v) => v > 0);
  const dureeMoyenne = moyenne(durees);

  // Une affaire close est une affaire jugée ou classée (voir `estCloseEtat`) :
  // c'est la définition qu'emploient tous les autres écrans.
  const closes = affaires.filter((a) => estCloseEtat(a.Etat)).length;
  const enCours = affairesToutes.filter((a) => !estCloseEtat(a.Etat)).length;

  /* --- Chiffres clés --------------------------------------------------- */

  const kpis = [
    { label: "Affaires reçues", value: nombre(affaires.length), iconName: "file-add-line",
      hint: annee === null ? `${nombre(affairesToutes.length)} affaire(s) au total` : `reçues en ${annee}` },
    { label: "Décisions rendues", value: nombre(decisions.length), iconName: "scales-3-line",
      hint: decisions.length ? `dont ${nombre(sanctions.length)} sanction(s) prononcée(s)` : "aucune décision sur la période" },
    { label: "Délai moyen", value: delaiMoyen === null ? "—" : `${mois(delaiMoyen)} mois`, iconName: "time-line",
      hint: delaiMoyen === null ? "aucune décision notifiée" : `soit ${nombre(Math.round(delaiMoyen))} jours après la saisine` },
    { label: "Délai médian", value: delaiMedian === null ? "—" : `${mois(delaiMedian)} mois`, iconName: "timer-line",
      hint: "la moitié des affaires est jugée plus vite" },
    { label: "Affaires clôturées", value: `${nombre(closes)} sur ${nombre(affaires.length)}`, iconName: "checkbox-circle-line",
      hint: affaires.length ? `taux de clôture : ${pourcent(closes, affaires.length)}` : "aucune affaire sur la période" },
    { label: "Affaires en cours", value: nombre(enCours), iconName: "folder-2-line",
      hint: "toutes périodes confondues", tone: enCours ? "warning" : "" },
    { label: "Séances", value: nombre(seances.length), iconName: "calendar-line",
      hint: seances.length ? `${nombre(affairesEnSeance)} affaire(s) inscrite(s) au rôle` : "aucune séance sur la période" },
    { label: "Recours", value: nombre(recours.length), iconName: "scales-3-line",
      hint: recours.length ? issuesDeRecours(recours).map((r) => `${r.label} : ${r.value}`).join(", ") : "aucun recours sur la période" },
  ];

  /* --- Graphiques ------------------------------------------------------ */

  const parAnnee = anneesDisponibles(store);
  const graphiques = [];
  const ajouter = (id, categorie, spec) => {
    const total = (spec.donnees || []).reduce((n, d) => n + (Number(d.value) || 0), 0);
    if (!total && !spec.toujours) return;
    graphiques.push({ id, categorie, titre: spec.titre, spec });
  };

  ajouter("regime", "Affaires reçues", {
    type: "camembert", titre: `Affaires reçues par régime — ${periode}`,
    donnees: compter(affaires, (a) => ctx.v("Affaires", a, "Section_Public")),
  });
  ajouter("voie", "Affaires reçues", {
    type: "camembert", titre: `Affaires reçues par voie de traitement — ${periode}`,
    donnees: compter(affaires, (a) => ctx.v("Affaires", a, "Voie")),
  });
  ajouter("etat", "Affaires reçues", {
    type: "camembert", titre: `Affaires reçues par état — ${periode}`,
    donnees: compter(affaires, (a) => a.Etat, ETATS),
  });
  ajouter("section", "Affaires reçues", {
    type: "barres", titre: `Affaires reçues par section — ${periode}`,
    donnees: compter(affaires, libelleDe),
  });
  ajouter("composante", "Affaires reçues", {
    type: "barres", titre: `Affaires reçues par composante — ${periode}`,
    donnees: compter(affaires, (a) => ctx.v("Affaires", a, "Composante")),
  });
  ajouter("type-section", "Affaires reçues", {
    type: "camembert", titre: `Affaires reçues par type de section — ${periode}`,
    donnees: compter(affaires, (a) => ctx.v("Sections_disciplinaires", ctx.ref("Affaires", a, "Section"), "Type_de_section"), TYPES_SECTION),
  });
  ajouter("motifs", "Affaires reçues", {
    type: "barres", titre: `Motifs retenus — ${periode}`, limite: 9,
    donnees: motifsComptes(ctx, affaires),
  });

  // Le sursis : la part des sanctions dont l'exécution est suspendue.
  ajouter("sursis", "Décisions", {
    type: "camembert", titre: `Sanctions avec ou sans sursis — ${periode}`,
    donnees: [
      { label: "Sans sursis", value: sanctions.length - sursis },
      { label: "Avec sursis", value: sursis },
    ],
  });

  // L'activité dans le temps : les mois de l'année choisie, ou les années.
  if (annee !== null) {
    ajouter("mois", "Activité", {
      type: "colonnes", tri: "none", vides: true,
      titre: `Affaires reçues et décisions rendues par mois — ${annee}`,
      unite: "affaire(s)",
      donnees: MOIS_COURTS.map((label, i) => ({
        label,
        value: affaires.filter((a) => toDate(a.Date_de_saisine).getMonth() === i).length
          + decisions.filter((d) => toDate(dateDecision(d))?.getMonth() === i).length,
      })),
      toujours: true,
    });
  } else {
    ajouter("annees", "Activité", {
      type: "colonnes", tri: "none", vides: true,
      titre: "Affaires reçues et décisions rendues par année",
      donnees: parAnnee.slice().sort((a, b) => a - b).map((an) => ({
        label: String(an),
        value: affairesToutes.filter((a) => toDate(a.Date_de_saisine)?.getFullYear() === an).length
          + decisionsToutes.filter((d) => toDate(dateDecision(d))?.getFullYear() === an).length,
      })),
      toujours: true,
    });
  }

  ajouter("nature", "Décisions", {
    type: "camembert", titre: `Décisions par nature — ${periode}`,
    donnees: compter(decisions, nature, NATURES_DECISION),
  });
  ajouter("textes", "Décisions", {
    type: "barres", titre: `Décisions rendues, par texte notifié — ${periode}`, limite: 9,
    donnees: compter(decisions.filter(libelleDecision), libelleDecision),
  });
  ajouter("sanctions", "Décisions", {
    type: "anneau", titre: `Sanctions prononcées par groupe — ${periode}`, unite: "sanction(s)",
    donnees: sanctionsParGroupe(ctx, sanctions),
  });
  ajouter("delais", "Décisions", {
    type: "barres", titre: `Délai de traitement (saisine → décision) — ${periode}`,
    donnees: TRANCHES_DELAI.map((t) => ({
      label: t.label,
      value: delais.filter((d) => d >= t.min && d < t.max).length,
    })),
  });
  ajouter("delais-sections", "Décisions", {
    type: "barres", titre: `Délai moyen de traitement, par section — ${periode}`,
    donnees: delaisParSection(ctx, store, decisionsToutes, dateDecision, annee, libelles),
  });
  ajouter("recours-juridiction", "Recours", {
    type: "camembert", titre: `Recours par juridiction — ${periode}`,
    donnees: compter(recours, (r) => r.Juridiction),
  });
  ajouter("recours-issue", "Recours", {
    type: "camembert", titre: `Issue des recours — ${periode}`,
    donnees: issuesDeRecours(recours),
  });

  /* --- Tableaux -------------------------------------------------------- */

  const tableaux = [];
  const tableau = (id, domaine, nom, entetes, lignes) => {
    if (!lignes.length) return;
    tableaux.push({ id, domaine, nom, entetes, lignes });
  };

  tableau("chiffres", "Chiffres clés", "Chiffres clés",
    ["Indicateur", "Valeur", "Précision"],
    kpis.map((k) => [k.label, String(k.value), k.hint]));

  tableau("annees", "Activité", "Activité par année",
    ["Année", "Affaires reçues", "Décisions rendues", "Sanctions", "Délai moyen (mois)"],
    parAnnee.slice().sort((a, b) => b - a).map((an) => {
      const recues = affairesToutes.filter((a) => toDate(a.Date_de_saisine)?.getFullYear() === an).length;
      const rendues = decisionsToutes.filter((d) => toDate(dateDecision(d))?.getFullYear() === an);
      const dureesAn = rendues.map((d) => ctx.v("Decisions", d, "Delai_de_traitement")).filter((v) => v !== null && v !== undefined);
      const m = moyenne(dureesAn);
      return [String(an), recues, rendues.length, rendues.filter((d) => nature(d) === "Sanction").length,
        m === null ? "—" : mois(m)];
    }));

  if (annee !== null) {
    tableau("mois", "Activité", `Activité mois par mois — ${annee}`,
      ["Mois", "Affaires reçues", "Décisions rendues"],
      MOIS_COURTS.map((label, i) => [
        label,
        affaires.filter((a) => toDate(a.Date_de_saisine).getMonth() === i).length,
        decisions.filter((d) => toDate(dateDecision(d))?.getMonth() === i).length,
      ]));
  }

  tableau("regimes", "Activité", "Activité par régime",
    ["Régime", "Affaires reçues", "Décisions rendues", "Sanctions", "Délai moyen (mois)"],
    REGIMES.map((regime) => {
      const recues = affaires.filter((a) => memeRegime(a, regime));
      const ids = new Set(recues.map((a) => a.id));
      const rendues = decisions.filter((d) => ids.has(Number(d.Affaire)));
      const dureesReg = rendues.map((d) => ctx.v("Decisions", d, "Delai_de_traitement")).filter((v) => v !== null && v !== undefined);
      const m = moyenne(dureesReg);
      return [regime, recues.length, rendues.length, rendues.filter((d) => nature(d) === "Sanction").length, m === null ? "—" : mois(m)];
    }).filter((l) => l[1] || l[2]));

  tableau("etats", "Affaires reçues", "Affaires reçues par état",
    ["État", "Affaires", "Part"],
    compter(affaires, (a) => a.Etat, ETATS).map((d) => [d.label, d.value, pourcent(d.value, affaires.length)]));

  tableau("voies", "Affaires reçues", "Affaires reçues par voie de traitement",
    ["Voie de traitement", "Affaires", "Part"],
    compter(affaires, (a) => ctx.v("Affaires", a, "Voie"), voies).map((d) => [d.label, d.value, pourcent(d.value, affaires.length)]));

  tableau("types-section", "Affaires reçues", "Affaires reçues par type de section",
    ["Type de section", "Affaires", "Part"],
    compter(affaires, (a) => ctx.v("Sections_disciplinaires", ctx.ref("Affaires", a, "Section"), "Type_de_section"), TYPES_SECTION)
      .map((d) => [d.label, d.value, pourcent(d.value, affaires.length)]));

  tableau("sections", "Affaires reçues", "Affaires reçues par section",
    ["Section", "Affaires reçues", "Décisions rendues", "Délai moyen (mois)"],
    [...new Set(affaires.map((a) => Number(a.Section) || 0))].filter(Boolean).map((id) => {
      const recues = affaires.filter((a) => (Number(a.Section) || 0) === id);
      const ids = new Set(recues.map((a) => a.id));
      const rendues = decisions.filter((d) => ids.has(Number(d.Affaire)));
      const dureesSec = rendues.map((d) => ctx.v("Decisions", d, "Delai_de_traitement")).filter((v) => v !== null && v !== undefined);
      const m = moyenne(dureesSec);
      return [libelles.get(id) || `Section n° ${id}`, recues.length, rendues.length, m === null ? "—" : mois(m)];
    }));

  tableau("motifs", "Affaires reçues", "Motifs retenus",
    ["Motif", "Affaires", "Part"],
    motifsComptes(ctx, affaires).map((d) => [d.label, d.value, pourcent(d.value, affaires.length)]));

  tableau("natures", "Décisions", "Décisions par nature",
    ["Nature", "Décisions", "Part"],
    compter(decisions, nature, NATURES_DECISION).map((d) => [d.label, d.value, pourcent(d.value, decisions.length)]));

  tableau("sanctions", "Décisions", "Sanctions prononcées, par groupe",
    ["Groupe de sanction", "Sanctions", "dont avec sursis", "Durée moyenne d'exclusion (mois)"],
    sanctionsParGroupe(ctx, sanctions).map((d) => {
      const groupe = sanctions.filter((s) => (ctx.ref("Decisions", s, "Sanction")?.Groupe || "Sans groupe") === d.label);
      const dureesGroupe = groupe.map((s) => Number(s.Duree_totale_d_exclusion_mois_ || 0)).filter((v) => v > 0);
      const m = moyenne(dureesGroupe);
      return [d.label, d.value, groupe.filter((s) => ctx.v("Decisions", s, "Sursis_")).length, m === null ? "—" : m.toFixed(1).replace(".", ",")];
    }));

  tableau("textes", "Décisions", "Décisions rendues, par texte notifié",
    ["Texte notifié", "Décisions", "Part"],
    compter(decisions.filter(libelleDecision), libelleDecision).map((d) => [d.label, d.value, pourcent(d.value, decisions.length)]));

  tableau("delais", "Décisions", "Délai de traitement, par tranche",
    ["Tranche", "Décisions", "Part"],
    TRANCHES_DELAI.map((t) => ({
      label: t.label, value: delais.filter((d) => d >= t.min && d < t.max).length,
    })).filter((d) => d.value).map((d) => [d.label, d.value, pourcent(d.value, delais.length)]));

  tableau("seances", "Séances", `Séances tenues — ${periode}`,
    ["Séance", "Date", "Affaires inscrites"],
    seances
      .slice()
      .sort((a, b) => String(a.Date || "").localeCompare(String(b.Date || "")))
      .map((s) => [
        String(ctx.v("Seances_d_examen", s, "Identifiant") || `Séance n° ${s.id}`),
        toDate(s.Date) ? formatDateFr(s.Date) : "—",
        affairesInscrites(ctx, s, vues).length,
      ]));

  tableau("recours", "Recours", `Recours introduits — ${periode}`,
    ["Juridiction", "Recours", "Part", "Issue"],
    compter(recours, (r) => r.Juridiction).map((d) => [
      d.label, d.value, pourcent(d.value, recours.length),
      recours.filter((r) => String(r.Juridiction || "") === d.label).map((r) => String(r.Issue || "en cours")).join(", "),
    ]));

  return {
    annee,
    periode,
    section: sectionDuRapport(ctx, store, sections),
    kpis,
    graphiques,
    tableaux,
    // Ce qui suit sert au rapport imprimé : il ne montre ni ne compte rien de
    // plus que l'écran.
    contexte: {
      affaires: affaires.length,
      affairesToutes: affairesToutes.length,
      decisions: decisions.length,
      sanctions: sanctions.length,
      sursis,
      dureeMoyenne,
      delaiMoyen,
      delaiMedian,
      seances: seances.length,
      affairesEnSeance,
      recours: recours.length,
      enCours,
      closes,
      restreint: perimetreRestreint(store, state),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Aides internes                                                      */
/* ------------------------------------------------------------------ */

/** Décisions de la période, d'après la date qui les rattache à une année. */
function decisionsToutePeriode(decisions, dateDecision, annee) {
  if (annee === null) return decisions;
  return decisions.filter((d) => {
    const date = toDate(dateDecision(d));
    return !!date && date.getFullYear() === annee;
  });
}

/** Section du rapport : celle de la période quand il n'y en a qu'une. */
function sectionDuRapport(ctx, store, idsSections) {
  const ids = [...idsSections].filter(Boolean);
  if (ids.length !== 1) return null;
  return store.byId("Sections_disciplinaires", ids[0]) || null;
}

/**
 * Motifs retenus par les affaires de la période, un motif compté une fois par
 * affaire. Le libellé est celui du catalogue (`Motifs.Libelle`) ; un motif
 * supprimé du catalogue garde le sien, tel qu'il a été enregistré.
 */
function motifsComptes(ctx, affaires) {
  const compte = new Map();
  for (const affaire of affaires) {
    const ids = ctx.refList("Affaires", affaire, "Motifs").map((m) => m.id);
    const libelles = ids.map((id) => ctx.byId("Motifs", id)?.Libelle).filter(Boolean);
    const valeurs = libelles.length
      ? libelles
      : String(affaire.Motifs || "").replace(/[[\]]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
    for (const valeur of new Set(valeurs)) compte.set(valeur, (compte.get(valeur) || 0) + 1);
  }
  return [...compte.entries()].map(([label, value]) => ({ label, value }));
}

/** Sanctions prononcées, groupées par famille du catalogue. */
function sanctionsParGroupe(ctx, sanctions) {
  const compte = new Map();
  for (const d of sanctions) {
    const groupe = String(ctx.ref("Decisions", d, "Sanction")?.Groupe || "Sans groupe");
    compte.set(groupe, (compte.get(groupe) || 0) + 1);
  }
  return [...compte.entries()].map(([label, value]) => ({ label, value }));
}

/**
 * Délai moyen de traitement, section par section — pour comparer les sections
 * entre elles. Le délai est celui de chaque décision : saisine → notification.
 */
function delaisParSection(ctx, store, decisionsToutes, dateDecision, annee, libelles) {
  const parSection = new Map();
  for (const d of decisionsToutes) {
    if (annee !== null) {
      const date = toDate(dateDecision(d));
      if (!date || date.getFullYear() !== annee) continue;
    }
    const affaire = store.byId("Affaires", d.Affaire);
    const id = Number(affaire?.Section) || 0;
    const delai = ctx.v("Decisions", d, "Delai_de_traitement");
    if (!id || delai === null || delai === undefined) continue;
    const liste = parSection.get(id) || [];
    liste.push(delai);
    parSection.set(id, liste);
  }
  return [...parSection.entries()].map(([id, valeurs]) => ({
    label: libelles.get(id) || `Section n° ${id}`,
    value: Math.round(moyenne(valeurs)),
  })).sort((a, b) => b.value - a.value);
}

/** Affaires inscrites au rôle d'une séance, restreintes à celles qui sont vues. */
function affairesInscrites(ctx, seance, vues) {
  return ctx.table("Affaires")
    .filter((a) => Number(a.Seance_d_examen) === Number(seance.id) && (!vues || vues.has(a.id)));
}

/**
 * Recours rattachés aux affaires visibles, introduits dans la période.
 *
 * Un recours se rattache à l'affaire (sa colonne `Affaire`) : c'est elle qui
 * porte le périmètre, et non la décision contestée — un recours peut être
 * introduit avant que celle-ci ne soit enregistrée.
 */
function recoursDuPerimetre(store, affaires, annee) {
  return store.table("Recours").filter((r) => {
    if (!affaires.has(Number(r.Affaire) || 0)) return false;
    return dansPeriode(r.Date_d_introduction, annee);
  });
}

/** Issue des recours, dans l'ordre du catalogue. */
function issuesDeRecours(recours) {
  return compter(recours, (r) => r.Issue || "En cours");
}

/** Date du jour écrite à la française — en-tête du rapport imprimé. */
export function dateDuRapport() {
  return formatDateFr(aujourdHui());
}
