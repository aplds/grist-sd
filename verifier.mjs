// Vérification de la livraison — NC-0025.
//
// Un geste, un seul, qui dit si l'on peut livrer : analyse syntaxique de
// **tous** les modules du dépôt, puis, quand une page est disponible, exécution
// du harnais de non-régression (NC-0001). Le résultat se consigne dans
// `CHANGELOG.md`, à l'entrée de la livraison.
//
// Le script ne présume pas de son environnement : on lui **donne** de quoi lire
// les fichiers et la liste des fichiers à vérifier, comme `livraison/build.mjs`
// le fait pour la fabrication de la variante minifiée. Il tourne donc aussi bien
// dans un navigateur (dossier `src/` servi) que dans un atelier ou un script
// Node :
//
//   // Dans le navigateur (onglet Debug › « Vérifier la livraison ») :
//   const { verifier } = await import("./src/verifier.mjs");
//   const { files } = await buildExport();
//   const r = await verifier({
//     fichiers: files,
//     lireFichier: async (p) => (await fetch(new URL(`src/${p}`, location.href))).text(),
//   });
//
//   // Dans un atelier Node (esbuild-wasm pris sur esm.sh) :
//   import { readdir } from "node:fs/promises";
//   ...
//
// `analyse` ne remplace pas le harnais : un module peut être syntaxiquement
// juste et fonctionnellement faux. Les deux sont donc exécutés, et le rapport
// dit lequel a parlé.

/*
 * `esbuild-wasm` ne s'initialise qu'une fois par page. Le module retient donc
 * sa promesse d'initialisation : une seconde vérification dans la même session
 * réutilise l'instance au lieu d'échouer (« Cannot call "initialize" more than
 * once »), ce qui est exactement le cas d'un poste de mise au point où l'on
 * relance la vérification après une correction.
 */
let esbuildPromise = null;

/** Charge et initialise esbuild-wasm une seule fois par page. */
async function chargerEsbuild(esbuildUrl, wasmURL) {
  if (!esbuildPromise) {
    esbuildPromise = (async () => {
      const { default: esbuild } = await import(`${esbuildUrl}?bundle`);
      try {
        await esbuild.initialize({ wasmURL });
      } catch (err) {
        // Une autre partie de la page l'a déjà initialisé : c'est un succès.
        if (!/already been called|more than once/i.test(String((err && err.message) || err))) throw err;
      }
      return esbuild;
    })();
  }
  return esbuildPromise;
}

/** Rapport lisible, à recopier dans `CHANGELOG.md`. */
export function formaterRapport(resultat) {
  const lignes = [];
  lignes.push(`Vérification de la livraison : ${resultat.ok ? "conforme" : "EN ÉCHEC"}`);
  lignes.push(`  • modules analysés : ${resultat.modules}/${resultat.fichiers}`);
  if (resultat.harnais) {
    if (resultat.harnais.erreur) {
      lignes.push(`  • harnais : non exécuté (${resultat.harnais.erreur})`);
    } else {
      lignes.push(`  • harnais : ${resultat.harnais.reussis}/${resultat.harnais.total} cas réussis`);
    }
  } else {
    lignes.push("  • harnais : non exécuté (aucune page disponible)");
  }
  for (const erreur of resultat.erreurs) {
    lignes.push(`  ✗ ${erreur.chemin} — ${erreur.message}`);
  }
  return lignes.join("\n");
}

/**
 * Vérifie le dépôt : analyse syntaxique des modules listés, puis harnais.
 *
 * @param {object} options
 * @param {(chemin: string) => Promise<string>} options.lireFichier
 *   Rend le **texte** d'un fichier, par son chemin relatif (par exemple
 *   `app.js` ou `views/reglages.js`).
 * @param {string[]} options.fichiers
 *   Chemins à vérifier. Les fichiers autres que `.js` / `.mjs` sont ignorés.
 * @param {boolean} [options.avecHarnais=true]
 *   Exécuter le harnais de non-régression quand une page est disponible.
 * @returns {Promise<{ok: boolean, fichiers: number, modules: number,
 *   erreurs: {chemin: string, message: string}[], harnais: object|null}>}
 */
export async function verifier({
  lireFichier,
  fichiers,
  avecHarnais = true,
  esbuildUrl = "https://esm.sh/esbuild-wasm@0.21.5",
  wasmURL = "https://esm.sh/esbuild-wasm@0.21.5/esbuild.wasm",
} = {}) {
  if (typeof lireFichier !== "function") throw new Error("verifier : `lireFichier` est requis");
  if (!Array.isArray(fichiers) || !fichiers.length) throw new Error("verifier : `fichiers` est requis");

  const esbuild = await chargerEsbuild(esbuildUrl, wasmURL);

  const erreurs = [];
  let modules = 0;
  for (const chemin of fichiers) {
    if (!/\.m?js$/.test(chemin)) continue;
    let code;
    try {
      // eslint-disable-next-line no-await-in-loop
      code = await lireFichier(chemin);
    } catch (err) {
      erreurs.push({ chemin, message: `lecture impossible : ${(err && err.message) || err}` });
      continue;
    }
    try {
      // `transform` analyse sans résoudre les imports : c'est bien la syntaxe
      // que l'on veut éprouver, module par module.
      // eslint-disable-next-line no-await-in-loop
      await esbuild.transform(code, { loader: "js", format: "esm", target: "es2020" });
      modules += 1;
    } catch (err) {
      erreurs.push({ chemin, message: String((err && err.message) || err).replace(/\s+/g, " ").trim() });
    }
  }

  const resultat = { ok: erreurs.length === 0, fichiers: fichiers.length, modules, erreurs, harnais: null };

  const pageDisponible = typeof window !== "undefined" && typeof document !== "undefined";
  if (avecHarnais && pageDisponible) {
    try {
      const harnais = await import("./tests/harness.js");
      await import("./tests/invariants.test.js");
      const rapport = await harnais.lancer();
      resultat.harnais = { total: rapport.total, reussis: rapport.reussis, echecs: rapport.echecs };
      if (rapport.echecs) resultat.ok = false;
    } catch (err) {
      resultat.harnais = { erreur: String((err && err.message) || err) };
      resultat.ok = false;
    }
  }

  return resultat;
}
