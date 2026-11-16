// Rôles et permissions.
//
// L'outil s'appuie sur les droits du document Grist qui l'héberge :
//   - « administrateur » : propriétaire du document — accès complet, y compris
//     aux réglages ;
//   - « secretaire »     : éditeur du document — saisie et suivi des dossiers,
//     réglages en lecture seule ;
//   - « visiteur »       : lecture seule, aucune écriture.
//
// Hors Grist (site autonome), l'utilisateur est administrateur de sa propre
// base locale : il n'y a personne d'autre à qui confier les réglages.

export const ROLES = {
  administrateur: {
    id: "administrateur",
    label: "Administrateur",
    badge: "fr-badge--success",
    desc: "Propriétaire du document Grist : accès complet, y compris aux réglages.",
    write: true,
    settings: true,
  },
  secretaire: {
    id: "secretaire",
    label: "Secrétaire",
    badge: "fr-badge--blue-ecume",
    desc: "Éditeur du document Grist : saisie et suivi des dossiers, réglages réservés aux propriétaires.",
    write: true,
    settings: false,
  },
  visiteur: {
    id: "visiteur",
    label: "Visiteur",
    badge: "fr-badge--brown-cafe-creme",
    desc: "Lecture seule : consultation et impression, sans aucune modification.",
    write: false,
    settings: false,
  },
};

export const ROLE_IDS = Object.keys(ROLES);

/**
 * Rôle correspondant à la valeur renvoyée par `user.Access` dans le document
 * Grist. Cette valeur est le rôle du document vu par le serveur : « owners »,
 * « editors », « viewers » (les formules d'accès y accèdent aussi sous les
 * formes OWNER, EDITOR, VIEWER). Toute valeur inconnue — ou vide — donne le
 * rôle le plus restreint.
 */
export function roleFromGristAccess(access) {
  const value = String(access || "").trim().toLowerCase().replace(/s$/, "");
  if (value === "owner") return "administrateur";
  if (value === "editor") return "secretaire";
  return "visiteur";
}

export function roleDef(role) {
  return ROLES[role] || ROLES.visiteur;
}

export function roleLabel(role) {
  return roleDef(role).label;
}

export function roleBadgeClass(role) {
  return roleDef(role).badge;
}

export function roleDescription(role) {
  return roleDef(role).desc;
}

/** L'utilisateur courant possède-t-il la capacité demandée ? */
export function can(role, capability) {
  return !!roleDef(role)[capability];
}

/**
 * Rôle effectif de l'utilisateur.
 *
 * Hors Grist, l'onglet « Debug » peut simuler un rôle (`state.debugRole`)
 * afin d'éprouver l'interface et les garde-fous sans second document : ce
 * rôle simulé prime alors sur le rôle réel. En mode embarqué, `debugRole`
 * n'est jamais renseigné et le rôle vient des droits du document.
 */
export function currentRole(state) {
  return state?.debugRole || state?.user?.role || "visiteur";
}

/** L'utilisateur courant peut-il modifier les données ? */
export function canWrite(state) {
  return can(currentRole(state), "write");
}

/** L'utilisateur courant peut-il ouvrir les réglages ? */
export function canSettings(state) {
  return can(currentRole(state), "settings");
}

/**
 * Utilisateur du site autonome : propriétaire de la base enregistrée dans son
 * propre navigateur.
 */
export function localUser() {
  return { role: "administrateur", name: "", email: "", access: "LOCAL", source: "local" };
}

/**
 * Utilisateur détecté comme connecté à Grist mais dont le niveau de droit n'a
 * pas pu être établi : on le traite en lecture seule.
 */
export function unknownGristUser() {
  return { role: "visiteur", name: "", email: "", access: "", source: "grist" };
}

/**
 * Nom de personne mis en forme pour l'affichage.
 *
 * Grist transmet l'identifiant du compte, et non un état civil : la colonne
 * `Nom` de la table des utilisateurs porte `user.Name`, soit « prenom.nom » —
 * `arno.pillods`. Affiché tel quel, c'est illisible. On restitue donc la
 * forme française « Prénom NOM » : le point (ou l'espace) sépare les mots, les
 * prénoms sont capitalisés, le dernier mot — le nom de famille — est mis en
 * capitales, comme dans le reste de l'outil (`Secretaires` : « Isabelle »,
 * « LECOMTE »).
 *
 * Les adresses électroniques ne sont pas touchées : elles tiennent souvent
 * lieu de nom faute de mieux, et les remettre en forme n'aurait aucun sens.
 * Un nom d'un seul mot est simplement capitalisé — rien ne dit s'il s'agit
 * d'un prénom ou d'un nom.
 */
export function formatPersonName(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.includes("@")) return raw;
  const parts = nameParts(raw);
  if (!parts.length) return raw;
  if (parts.length === 1) return capitalizeWord(parts[0]);
  return `${capitalizeWords(parts.slice(0, -1).join(" "))} ${upper(parts[parts.length - 1])}`;
}

/**
 * Découpage d'un nom : les points et les espaces séparent les mots, les traits
 * d'union et les apostrophes restent dans le mot (« jean-pierre.dupont » →
 * « Jean-Pierre DUPONT »). Le même découpage sert à l'affichage et à la fiche
 * secrétaire, pour que les deux ne puissent pas diverger.
 */
function nameParts(value) {
  return String(value || "").trim().split(/[.\s]+/).filter(Boolean);
}

function lower(value) {
  return String(value || "").toLocaleLowerCase("fr");
}

function upper(value) {
  return String(value || "").toLocaleUpperCase("fr");
}

/** « arno » → « Arno » ; une graphie déjà composée (« DUPONT », « McDonald ») est respectée. */
function capitalizeWord(word) {
  const value = String(word || "");
  if (value !== lower(value)) return value;
  return upper(value.charAt(0)) + value.slice(1);
}

/** Chaque mot capitalisé, y compris après trait d'union ou apostrophe. */
function capitalizeWords(value) {
  return lower(value).replace(/(^|[\s'’-])(\p{L})/gu, (tout, avant, lettre) => avant + upper(lettre));
}

/** Nom à afficher dans l'en-tête ; jamais vide. */
export function userName(user) {
  const name = formatPersonName(user?.name);
  if (name) return name;
  const email = String(user?.email || "").trim();
  if (email) return email;
  if (user?.source === "local") return "Poste local";
  if (user?.source === "anonyme") return "Non connecté";
  return "Utilisateur Grist";
}

/**
 * Nom découpé pour la fiche secrétaire : le dernier mot est le nom de famille,
 * placé en capitales comme les autres fiches ; le reste est le prénom. Grist
 * fournissant « prenom.nom », le point sépare comme l'espace.
 */
export function splitName(fullName) {
  const raw = String(fullName ?? "").trim();
  const parts = nameParts(raw);
  if (!parts.length) return { prenom: "", nom: "" };
  if (raw.includes("@")) return { prenom: "", nom: raw };
  if (parts.length === 1) return { prenom: "", nom: capitalizeWord(parts[0]) };
  return {
    prenom: capitalizeWords(parts.slice(0, -1).join(" ")),
    nom: upper(parts[parts.length - 1]),
  };
}
