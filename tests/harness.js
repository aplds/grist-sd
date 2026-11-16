// Harnais de tests — NC-0001.
//
// Un harnais **sans dépendance** : quelques assertions et un exécuteur, rien
// de plus. Il n'y a ni fichier de paquets, ni outil de construction à
// installer : les cas s'écrivent en JavaScript ordinaire, à côté du code
// qu'ils vérifient, et se lancent dans un navigateur (voir `index.html`) ou,
// depuis l'outil, par `import("./src/tests/invariants.test.js")` suivi de
// `lancer()`.
//
// Chaque garantie de `SPEC.md` § 8 qui se vérifie sur de la **logique pure**
// — dates, délais, échappement, neutralisation, procédure, environnements — a
// ici son cas. Les garanties qui tiennent à l'affichage ou à Grist se
// vérifient, elles, par un **test de fumée par écran** (voir le README du
// dossier) : ouvrir chaque page et vérifier qu'aucune erreur n'est levée.

const cas = [];

/** Déclare un cas de test. Le nom dit l'invariant, pas la fonction. */
export function test(nom, fn) {
  cas.push({ nom, fn });
}

/** Assertion générale. */
export function assert(condition, message = "condition fausse") {
  if (!condition) throw new Error(message);
}

/** Égalité structurelle (comparaison par `JSON.stringify`). */
export function assertEgal(attendu, obtenu, message = "") {
  const a = JSON.stringify(attendu);
  const b = JSON.stringify(obtenu);
  if (a !== b) throw new Error(`${message ? `${message} : ` : ""}attendu ${a}, obtenu ${b}`);
}

/** Le texte contient-il l'extrait ? */
export function assertContient(texte, extrait, message = "") {
  if (!String(texte).includes(extrait)) {
    throw new Error(`${message ? `${message} : ` : ""}« ${extrait} » attendu dans « ${String(texte).slice(0, 160)} »`);
  }
}

/** Le texte ne contient-il pas l'extrait ? Utile pour les chaînes dangereuses. */
export function assertNonContient(texte, extrait, message = "") {
  if (String(texte).includes(extrait)) {
    throw new Error(`${message ? `${message} : ` : ""}« ${extrait} » ne devrait pas figurer dans « ${String(texte).slice(0, 160)} »`);
  }
}

/** Nombre de cas déclarés. */
export function nombreDeCas() {
  return cas.length;
}

/**
 * Exécute tous les cas déclarés, dans l'ordre, et rend le compte rendu. Un cas
 * qui lève est un échec ; le suivant s'exécute quand même — le harnais ne
 * s'arrête pas au premier, pour donner la mesure complète d'une régression.
 */
export async function lancer() {
  const resultats = [];
  const debut = Date.now();
  for (const c of cas) {
    try {
      await c.fn();
      resultats.push({ nom: c.nom, ok: true });
    } catch (err) {
      resultats.push({ nom: c.nom, ok: false, erreur: (err && err.message) || String(err) });
    }
  }
  const echecs = resultats.filter((r) => !r.ok);
  return {
    total: resultats.length,
    reussis: resultats.length - echecs.length,
    echecs: echecs.length,
    duree: Date.now() - debut,
    resultats,
  };
}
