// L'auteur et le destinataire d'un document.
//
// Un courrier a un **auteur** — qui le rédige et le signe — et un
// **destinataire** ; une attestation a un auteur et peut être adressée ; une
// décision a un auteur, mais pas de destinataire. Les deux se **programment sur
// la trame** (`Trames.Auteur`, `Trames.Destinataire`) : la rédaction d'un
// document n'a donc plus à les choisir, et les blocs `{emetteur…}` et
// `{destinataire…}` de l'en-tête et de la signature en découlent d'eux-mêmes.
//
// Ce module est la **seule** règle de cette résolution. Il prend la base, le
// document et sa trame, et rend l'auteur et le destinataire sous une forme
// commune — nom, qualité, adresse et formule — que `render.js` pose dans le
// périmètre des variables.
//
// Trois principes :
//
//  - **Rien n'est inventé.** Un auteur ou un destinataire introuvable rend une
//    chaîne vide et signale son absence (`resolu: false`) : la rédaction peut
//    alors le compléter, et l'aperçu ne montre pas un nom qui n'existe pas.
//  - **Le mis en cause est celui de l'affaire**, la victime et le témoin sont
//    pris dans « Personnes du dossier » ; lorsqu'une affaire en compte
//    plusieurs, le document peut en désigner un (`Generateur.Personne_destinataire`),
//    sinon le premier est retenu.
//  - **Les destinataires institutionnels se résolvent par leur qualité** : un
//    chef d'établissement est un président d'université ou un directeur ;
//    l'autorité de tutelle est le recteur pour l'enseignement supérieur, le
//    ministre chargé de l'agriculture pour l'agriculture. Les fiches de la
//    section sont consultées d'abord, le reste des destinataires ensuite.

import {
  AUTEUR_AUTORITE,
  AUTEUR_COMMISSION_INSTRUCTION,
  AUTEUR_FORMATION,
  AUTEUR_PRESIDENT_COMMISSION,
  AUTEUR_PRESIDENT_SECTION,
  AUTEUR_RAPPORTEUR,
  AUTEUR_SECRETAIRE,
  DEST_AUTORITE,
  DEST_CHEF_ETABLISSEMENT,
  DEST_LIBRE,
  DEST_MIS_EN_CAUSE,
  DEST_PRESIDENT_SECTION,
  DEST_TEMOIN,
  DEST_TUTELLE,
  DEST_VICTIME,
  QUALITES_CHEF_ETABLISSEMENT,
  QUALITE_MINISTRE,
  QUALITE_RECTEUR,
  TUTELLE_AGRI,
} from "./schema.js";
import { signataireDeLaSection, vicePresidentEffectif } from "./signataire.js";
import { intervenantsDe } from "./formulas.js";

const texte = (v) => (v === null || v === undefined ? "" : String(v));

/** Des noms assemblés à la française : « A », « A et B », « A, B et C ». */
function joinNoms(personnes) {
  const noms = personnes.map((p) => texte(p.nom)).filter(Boolean);
  if (noms.length <= 1) return noms[0] || "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Une personne : son nom, son adresse et sa formule de politesse. */
function personneSuivante(ctx, personne) {
  if (!personne) return null;
  return {
    nom: texte(ctx.v("Personnes", personne, "Nom_complet")),
    adresse: texte(ctx.v("Personnes", personne, "Adresse")),
    formule: texte(ctx.v("Personnes", personne, "Formule")),
  };
}

/** Un destinataire institutionnel : nom, adresse, formule et signature. */
function institutionnelSuivant(d) {
  if (!d) return null;
  return {
    nom: texte(d.Nom_complet),
    adresse: texte(d.Adresse),
    formule: texte(d.Formule_de_politesse),
    signature: texte(d.Signature),
    qualite: texte(d.Qualite),
  };
}

/**
 * Les destinataires institutionnels d'une section : ceux qui la désignent,
 * à défaut tous ceux de la base. La fiche d'un destinataire peut viser
 * plusieurs sections (`RefList`). Exporté pour les écrans de rédaction, qui
 * proposent le choix parmi eux lorsque la trame en vise la qualité.
 */
export function institutionnelsDeLaSection(ctx, section) {
  const tous = ctx.table("Destinataires_institutionnels");
  if (!section) return tous;
  const lies = tous.filter((d) =>
    ctx.refList("Destinataires_institutionnels", d, "Section").some((s) => Number(s.id) === Number(section.id)));
  return lies.length ? lies : tous;
}

/** Le premier destinataire d'une qualité donnée. */
function institutionnelParQualite(ctx, section, qualites) {
  const liste = institutionnelsDeLaSection(ctx, section);
  return liste.find((d) => qualites.includes(texte(d.Qualite))) || null;
}

/**
 * L'auteur effectif d'un document : le rôle déclaré par la trame, résolu sur
 * l'affaire. `signataire` est le signataire de la section (voir
 * `signataire.js`), qui porte le remplacement du président par le
 * vice-président ; il est recalculé ici si l'appelant ne le fournit pas.
 */
export function resoudreAuteur(db, doc, trame, { ctx, scope, signataire = null } = {}) {
  const role = texte(trame?.Auteur);
  const affaire = scope?.Affaire || null;
  const section = scope?.Affaire_Section || null;
  const vide = { role, resolu: false, nom: "", formule: "", formule_complete: "", qualite: "", adresse: "", signature: "", collegial: false };
  if (!role) return vide;

  if (role === AUTEUR_PRESIDENT_SECTION) {
    const s = signataire || (section ? signataireDeLaSection(db, section, vicePresidentEffectif(section, doc)) : null);
    if (!s) return vide;
    return {
      role,
      resolu: !!s.membres?.length,
      nom: texte(s.nom),
      formule: texte(s.formule),
      formule_complete: texte(s.formule_complete),
      qualite: texte(s.qualite),
      adresse: "",
      signature: texte(s.formule),
      collegial: false,
    };
  }

  if (role === AUTEUR_PRESIDENT_COMMISSION || role === AUTEUR_FORMATION) {
    const feminin = /^La /.test(texte(affaire?.C_Formule));
    const deLaFormation = role === AUTEUR_FORMATION;
    // La **fonction** de l'auteur, et non son collège : `C_Qualite` dit à quel
    // corps appartient le président de la commission (« Membre de la
    // section »), et c'est le corps du texte — non la signature — qui l'écrit.
    const qualite = deLaFormation
      ? "président de la formation de jugement"
      : "président de la commission de discipline";
    return {
      role,
      resolu: !!texte(affaire?.C_President),
      nom: texte(affaire?.C_President),
      formule: `${feminin ? "La présidente" : "Le président"} ${deLaFormation
        ? "de la formation de jugement" : "de la commission de discipline"}`,
      formule_complete: feminin ? "Madame la présidente" : "Monsieur le président",
      qualite,
      adresse: "",
      signature: "",
      collegial: deLaFormation,
    };
  }

  if (role === AUTEUR_AUTORITE) {
    // L'autorité ayant engagé les poursuites est celle qui a saisi la section.
    const d = ctx?.byId("Destinataires_institutionnels", affaire?.Autorite_de_saisine?.id || affaire?.Autorite_de_saisine);
    const info = institutionnelSuivant(d);
    if (!info) return vide;
    return {
      role,
      resolu: true,
      nom: info.nom,
      formule: info.signature || info.formule,
      formule_complete: info.formule,
      qualite: info.qualite,
      adresse: info.adresse,
      signature: info.signature,
      collegial: false,
    };
  }

  if (role === AUTEUR_SECRETAIRE) {
    const s = ctx?.ref("Generateur", doc, "Secretaire") || scope?.Secretaire || null;
    if (!s) return vide;
    return {
      role,
      resolu: true,
      nom: texte(s.Nom_complet),
      formule: texte(s.Formule),
      formule_complete: texte(s.Formule),
      qualite: "secrétaire de la section disciplinaire",
      adresse: "",
      signature: texte(s.Formule),
      collegial: false,
    };
  }

  if (role === AUTEUR_RAPPORTEUR) {
    // Le rapport d'instruction est signé par le rapporteur. Un rapporteur
    // désigné pour l'affaire — à défaut, aucun nom : un rapport sans
    // rapporteur désigné ne s'invente pas.
    const personnes = ctx ? intervenantsDe(ctx, affaire).filter((x) => x.role === "Rapporteur") : [];
    if (!personnes.length) return vide;
    const feminin = personnes.length === 1 && personnes[0].genre === "F";
    const formule = feminin ? "La rapporteure" : "Le rapporteur";
    return {
      role,
      resolu: true,
      nom: joinNoms(personnes),
      formule,
      formule_complete: feminin ? "Madame la rapporteure" : "Monsieur le rapporteur",
      qualite: "rapporteur",
      adresse: "",
      signature: formule,
      collegial: personnes.length > 1,
    };
  }

  if (role === AUTEUR_COMMISSION_INSTRUCTION) {
    // Devant les sections d'enseignants-chercheurs, l'instruction est confiée
    // à une commission d'instruction (R.712-32) : le rapport est l'œuvre de la
    // commission, qui regroupe le rapporteur et ses assesseurs.
    const personnes = ctx ? intervenantsDe(ctx, affaire).filter((x) =>
      ["Rapporteur", "Rapporteur adjoint", "Membre de la commission d'instruction"].includes(x.role)) : [];
    if (!personnes.length) return vide;
    return {
      role,
      resolu: true,
      nom: joinNoms(personnes),
      formule: "La commission d'instruction",
      formule_complete: "La commission d'instruction",
      qualite: "commission d'instruction",
      adresse: "",
      signature: "La commission d'instruction",
      collegial: true,
    };
  }

  return vide;
}

/**
 * Le destinataire effectif d'un courrier ou d'une attestation, résolu sur
 * l'affaire, la section et le document. Ne s'applique pas aux décisions : leur
 * en-tête ne porte pas de destinataire.
 */
export function resoudreDestinataire(db, doc, trame, { ctx, scope } = {}) {
  const role = texte(trame?.Destinataire);
  const affaire = scope?.Affaire || null;
  const section = scope?.Affaire_Section || null;
  const vide = { role, resolu: false, nom: "", adresse: "", formule: "", personne: null, institutionnel: null };
  if (!role || !ctx) return vide;

  if (role === DEST_MIS_EN_CAUSE) {
    const p = personneSuivante(ctx, ctx.byId("Personnes", affaire?.Mis_en_cause?.id || affaire?.Mis_en_cause));
    if (!p) return vide;
    return { role, resolu: true, ...p, personne: affaire?.Mis_en_cause?.id ?? null, institutionnel: null };
  }

  if (role === DEST_VICTIME || role === DEST_TEMOIN) {
    const attendu = role === DEST_VICTIME ? "Victime" : "Témoin";
    const implications = ctx.children("Implications", affaire).filter((i) => texte(i.Role) === attendu);
    const choisie = doc?.Personne_destinataire
      ? implications.find((i) => Number(i.Personne) === Number(doc.Personne_destinataire))
      : null;
    const ligne = choisie || implications[0] || null;
    const p = ligne ? personneSuivante(ctx, ctx.byId("Personnes", ligne.Personne)) : null;
    if (!p) return vide;
    return { role, resolu: true, ...p, personne: ligne.Personne ?? null, institutionnel: null };
  }

  if (role === DEST_AUTORITE) {
    const d = ctx.byId("Destinataires_institutionnels", doc?.Destinataire_institutionnel)
      || ctx.byId("Destinataires_institutionnels", affaire?.Autorite_de_saisine?.id || affaire?.Autorite_de_saisine);
    const info = institutionnelSuivant(d);
    if (!info) return vide;
    return { role, resolu: true, nom: info.nom, adresse: info.adresse, formule: info.formule, personne: null, institutionnel: d.id };
  }

  if (role === DEST_CHEF_ETABLISSEMENT) {
    const explicite = ctx.byId("Destinataires_institutionnels", doc?.Destinataire_institutionnel);
    const d = (explicite && QUALITES_CHEF_ETABLISSEMENT.includes(texte(explicite.Qualite)) ? explicite : null)
      || institutionnelParQualite(ctx, section, QUALITES_CHEF_ETABLISSEMENT);
    const info = institutionnelSuivant(d);
    if (!info) return vide;
    return { role, resolu: true, nom: info.nom, adresse: info.adresse, formule: info.formule, personne: null, institutionnel: d.id };
  }

  if (role === DEST_TUTELLE) {
    const qualite = texte(section?.Tutelle) === TUTELLE_AGRI ? QUALITE_MINISTRE : QUALITE_RECTEUR;
    const explicite = ctx.byId("Destinataires_institutionnels", doc?.Destinataire_institutionnel);
    const d = (explicite && texte(explicite.Qualite) === qualite ? explicite : null)
      || institutionnelParQualite(ctx, section, [qualite]);
    const info = institutionnelSuivant(d);
    if (!info) return vide;
    return { role, resolu: true, nom: info.nom, adresse: info.adresse, formule: info.formule, personne: null, institutionnel: d.id };
  }

  if (role === DEST_PRESIDENT_SECTION) {
    if (!section) return vide;
    const nom = texte(ctx.v("Sections_disciplinaires", section, "President"));
    const adresse = [section.Secretariat_Rue, section.Secretariat_CP_Ville].map(texte).filter(Boolean).join("\n");
    return {
      role,
      resolu: !!nom,
      nom,
      adresse,
      formule: texte(ctx.v("Sections_disciplinaires", section, "Formule")),
      personne: null,
      institutionnel: null,
    };
  }

  if (role === DEST_LIBRE) {
    const nom = texte(doc?.L_Destinataire);
    return {
      role,
      resolu: !!nom.trim(),
      nom,
      adresse: texte(doc?.L_Adresse),
      formule: texte(doc?.L_Formule),
      personne: null,
      institutionnel: null,
    };
  }

  return vide;
}

/**
 * L'ensemble des qualités déclarées par la trame : sert aux écrans qui
 * annoncent, avant la rédaction, à qui le document s'adresse et qui le signe.
 */
export function redacteursDuDocument(db, doc, trame, options = {}) {
  return {
    auteur: resoudreAuteur(db, doc, trame, options),
    destinataire: resoudreDestinataire(db, doc, trame, options),
  };
}
