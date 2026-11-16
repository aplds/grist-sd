// Calendrier des échéances.
//
// L'outil n'héberge pas d'agenda, et n'en hébergera pas : affiché dans un
// document Grist, il n'est joignable que depuis ce document, et un abonnement
// à un flux censé rester en ligne n'y fonctionnerait pas. Ce module produit
// donc des **événements** — séances d'examen, envoi des convocations, termes
// de la sanction, expiration du délai de recours, prescription — et un fichier
// iCalendar (`.ics`) que chacun importe dans son agenda professionnel
// (Outlook, Google Agenda, Thunderbird, Agenda d'Apple…). Chacun y retrouve
// son rétroplanning complet, et les séances à venir.
//
// Le fichier suit le **périmètre de visibilité** : un secrétaire exporte les
// affaires qui lui sont attribuées, un propriétaire l'ensemble de la section
// (voir `visibilite.js`). Rien n'est écrit : l'export est un instantané des
// données du moment, recalculé à chaque clic.

import { Context, isoDate } from "./formulas.js";
import { decisionDefinitiveDe } from "./regimes.js";
import { userName } from "./roles.js";
import { affairesVisibles, mesFiches, perimetreRestreint } from "./visibilite.js";

/* ------------------------------------------------------------------ */
/* Périmètre                                                           */
/* ------------------------------------------------------------------ */

/**
 * Séances relevant du périmètre : celles des sections dont la personne suit
 * des affaires, et celles où figure une de ses affaires. Hors périmètre
 * restreint, toutes les séances.
 */
export function seancesVisibles(store, state) {
  const toutes = store.table("Seances_d_examen");
  if (!perimetreRestreint(store, state)) return [...toutes];
  const affaires = affairesVisibles(store, state, store.table("Affaires"));
  const sections = new Set(affaires.map((a) => Number(a.Section) || 0));
  const ids = new Set(affaires.map((a) => a.id));
  return toutes.filter((s) => sections.has(Number(s.Section) || 0)
    || store.table("Affaires").some((a) => ids.has(a.id) && Number(a.Seance_d_examen) === Number(s.id)));
}

/* ------------------------------------------------------------------ */
/* Événements                                                          */
/* ------------------------------------------------------------------ */

/**
 * Événements du calendrier, en clair : `{ date, heure, titre, lieu, resume,
 * categorie }`. `date` est une date locale `AAAA-MM-JJ` ; `heure` est vide pour
 * un événement de journée entière.
 */
export function evenementsCalendrier(store, state) {
  const ctx = state.ctx || new Context(store.db, store);
  const affaires = affairesVisibles(store, state, store.table("Affaires"));
  const suivies = new Set(affaires.map((a) => a.id));
  const sections = new Map(store.table("Sections_disciplinaires").map((s) => [Number(s.id), s]));
  const out = [];

  const ajoute = ({ date, heure = "", titre, court = "", lieu = "", resume = "", categorie = "" }) => {
    const jour = isoDate(date);
    if (!jour || !titre) return;
    out.push({
      date: jour, heure: String(heure || "").trim(), titre, court: String(court || titre),
      lieu: String(lieu || "").trim(), resume: String(resume || "").trim(), categorie,
    });
  };

  // 1. Les séances. Une séance n'a pas d'heure propre : celle du plus tôt des
  //    passages inscrits au rôle lui sert de début, faute de mieux.
  for (const s of seancesVisibles(store, state)) {
    const role = store.table("Affaires")
      .filter((a) => Number(a.Seance_d_examen) === Number(s.id) && suivies.has(a.id))
      .sort((a, b) => (Number(a.Heure_de_passage_minutes) || 0) - (Number(b.Heure_de_passage_minutes) || 0));
    const section = sections.get(Number(s.Section));
    const heures = role.map((a) => String(a.SE_Heure_de_passage || "").trim()).filter(Boolean).sort();
    ajoute({
      date: s.Date,
      heure: heures[0] || "",
      titre: `Séance — ${String(s.Type || "Séance d'examen")}${section ? ` (${section.Structure || ""})` : ""}`,
      court: `Séance ${section?.Acronyme || ""}`.trim(),
      lieu: [s.Salle, s.Adresse].filter(Boolean).join(", "),
      resume: [
        s.Lien_visio ? `Visio : ${s.Lien_visio}` : "",
        role.length ? `${role.length} affaire(s) au rôle :` : "Aucune affaire inscrite au rôle.",
        ...role.map((a) => `· ${String(a.Numero || `#${a.id}`)} — ${String(ctx.v("Affaires", a, "Nom_complet") || "").trim()}${a.SE_Heure_de_passage ? ` (${a.SE_Heure_de_passage})` : ""}`),
      ].filter(Boolean).join("\n"),
      categorie: "Séance",
    });
  }

  // 2. Les échéances de chaque affaire suivie.
  for (const a of affaires) {
    const numero = String(a.Numero || `#${a.id}`);
    const nom = String(ctx.v("Affaires", a, "Nom_complet") || "").trim();
    const etiquette = nom ? `${numero} — ${nom}` : numero;
    const section = sections.get(Number(a.Section));
    const lieu = section ? [section.Siege, section.Structure].filter(Boolean).join(", ") : "";

    ajoute({
      date: a.Date_de_saisine,
      titre: `Saisine — ${etiquette}`,
      court: `Saisine ${numero}`,
      lieu,
      categorie: "Affaire",
      resume: `Affaire enregistrée le ${isoDate(a.Date_de_saisine)}.`,
    });
    ajoute({
      date: a.Date_de_convocation,
      titre: `Convocations envoyées — ${etiquette}`,
      court: `Convocations ${numero}`,
      lieu,
      categorie: "Convocation",
      resume: "Date d'envoi des convocations. Le délai minimum entre la convocation et la séance se vérifie depuis l'affaire.",
    });

    // L'échéance d'instruction : la date butoir d'instruction portée par un
    // document ou une décision avant dire droit prime sur le délai de la
    // procédure ; à défaut seulement, ce délai s'applique, décompté depuis la
    // décision de désignation.
    const butoir = ctx.v("Affaires", a, "Date_butoir_instruction");
    if (butoir) {
      const initiale = ctx.v("Affaires", a, "Date_butoir_instruction_initiale");
      const prolongee = Boolean(ctx.v("Affaires", a, "Instruction_prolongee"));
      // La date retenue diffère de l'échéance initiale : c'est un acte de
      // l'affaire qui l'a fixée — ou l'instruction n'a pas d'échéance de
      // procédure, faute de désignation.
      const parUnActe = String(initiale || "") !== String(butoir);
      ajoute({
        date: butoir,
        titre: `Instruction à clore — ${etiquette}`,
        court: `Instruction ${numero}`,
        lieu,
        categorie: "Instruction",
        resume: prolongee
          ? "Instruction prolongée : le terme a été reporté par un document ou une décision avant dire droit de l'affaire."
          : parUnActe
            ? "Date butoir d'instruction fixée par un acte de l'affaire."
            : "Terme du délai d'instruction prévu par la procédure.",
      });
    }

    const seance = a.Seance_d_examen ? store.byId("Seances_d_examen", a.Seance_d_examen) : null;
    if (seance) {
      ajoute({
        date: seance.Date,
        heure: a.SE_Heure_de_passage || "",
        titre: `Passage — ${etiquette}`,
        court: `Passage ${numero}`,
        lieu: [seance.Salle, seance.Adresse].filter(Boolean).join(", "),
        categorie: "Séance",
        resume: "Heure de passage de cette affaire devant la formation.",
      });
    }

    const prescription = ctx.v("Affaires", a, "Prescription_le");
    ajoute({
      date: prescription,
      titre: `Prescription — ${etiquette}`,
      court: `Prescription ${numero}`,
      lieu,
      categorie: "Délai",
      resume: "Terme du délai de prescription de l'action disciplinaire.",
    });

    // Décision définitive de l'affaire — jonction comprise : une affaire jointe
    // voit figurer au calendrier les échéances de la décision commune.
    const decision = decisionDefinitiveDe(ctx, a);
    if (decision) {
      const terme = ctx.v("Decisions", decision, "Terme_de_la_sanction");
      ajoute({
        date: terme === "9999-12-31" ? "" : terme,
        titre: `Terme de la sanction — ${etiquette}`,
        court: `Terme ${numero}`,
        lieu,
        categorie: "Sanction",
        resume: `${String(ctx.v("Decisions", decision, "Libelle_decision") || "").trim()}`,
      });
      ajoute({
        date: ctx.v("Decisions", decision, "Recours_limite_le"),
        titre: `Délai de recours expiré — ${etiquette}`,
        court: `Recours ${numero}`,
        lieu,
        categorie: "Délai",
        resume: "Dernier jour pour former un recours contre la décision notifiée.",
      });
    }
  }

  return out.sort((x, y) => (x.date === y.date ? (x.heure || "").localeCompare(y.heure || "") : x.date.localeCompare(y.date)));
}

/* ------------------------------------------------------------------ */
/* iCalendar                                                           */
/* ------------------------------------------------------------------ */

/** Échappement des valeurs de texte (RFC 5545, §3.3.11). */
function icsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Repli des lignes longues : une ligne de contenu iCalendar ne dépasse pas
 * 75 octets, la continuation commence par une espace (RFC 5545, §3.1). Le
 * découpage se fait sur les octets, jamais au milieu d'un caractère UTF-8.
 */
function plier(ligne) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(ligne);
  if (bytes.length <= 75) return ligne;
  const morceaux = [];
  let courant = [];
  let taille = 0;
  for (const caractere of ligne) {
    const n = encoder.encode(caractere).length;
    const limite = morceaux.length ? 74 : 75;
    if (taille + n > limite) {
      morceaux.push(courant.join(""));
      courant = [];
      taille = 0;
    }
    courant.push(caractere);
    taille += n;
  }
  if (courant.length) morceaux.push(courant.join(""));
  return morceaux.join("\r\n ");
}

/** Horodatage UTC du moment de la génération. */
function dtstamp(date = new Date()) {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * Contenu du fichier `.ics` pour le périmètre courant.
 *
 * Les événements de journée entière utilisent `VALUE=DATE` ; ceux qui portent
 * une heure sont exprimés en heure locale flottante (sans `TZID`) : chaque
 * agenda les replace dans son propre fuseau, et aucun VTIMEZONE n'est
 * nécessaire — c'est la forme la plus largement acceptée par les clients.
 */
/** Empreinte courte et stable d'un texte — sert d'identifiant d'événement. */
function empreinte(texte) {
  let h = 5381;
  const s = String(texte ?? "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function icalCalendrier(store, state, { nom = "" } = {}) {
  const evenements = evenementsCalendrier(store, state);
  const stamp = dtstamp();
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gestion des sections disciplinaires//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(nom || "Sections disciplinaires")}`,
  ];

  for (const e of evenements) {
    const jour = e.date.replace(/-/g, "");
    // Une heure saisie (« 9:30 », « 09:30 ») fait un rendez-vous ; sans heure,
    // l'événement occupe la journée. La durée des rendez-vous est laissée au
    // client : rien dans les données ne dit combien de temps dure une séance.
    const aLHeure = /^(\d{1,2}):(\d{2})/.exec(e.heure || "");
    const debut = aLHeure
      ? `DTSTART:${jour}T${aLHeure[1].padStart(2, "0")}${aLHeure[2]}00`
      : `DTSTART;VALUE=DATE:${jour}`;
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${jour}-${empreinte(`${e.categorie}|${e.titre}`)}@sections-disciplinaires`,
      `DTSTAMP:${stamp}`,
      debut,
      "SEQUENCE:0",
      `SUMMARY:${icsText(e.titre)}`,
      e.lieu ? `LOCATION:${icsText(e.lieu)}` : "",
      e.resume ? `DESCRIPTION:${icsText(e.resume)}` : "",
      e.categorie ? `CATEGORIES:${icsText(e.categorie)}` : "",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lignes.push("END:VCALENDAR");
  return lignes.filter((l) => l !== "").map(plier).join("\r\n") + "\r\n";
}

/**
 * Nom de la personne dont on exporte le calendrier : la fiche secrétaire quand
 * il y en a une, sinon l'identité affichée (en mode autonome, l'identité est
 * celle de la fiche, pas celle du poste).
 */
export function nomPerimetre(store, state) {
  const fiche = perimetreRestreint(store, state) ? mesFiches(store, state)[0] : null;
  const nom = fiche ? String(new Context(store.db, store).v("Secretaires", fiche, "Nom_complet") || "").trim() : "";
  return nom || userName(state?.user);
}

/**
 * Nom de fichier proposé pour l'export. Restreint à un secrétaire, le fichier
 * porte son nom : plusieurs personnes exportent souvent depuis le même poste,
 * et deux rétroplanings différents ne doivent pas porter le même nom.
 */
export function nomFichierIcal(store, state, date = new Date()) {
  const jour = date.toISOString().slice(0, 10);
  const qui = perimetreRestreint(store, state) ? nomPerimetre(store, state) : "";
  const slug = String(qui || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `sections-disciplinaires${slug ? `-${slug}` : ""}-${jour}.ics`;
}
