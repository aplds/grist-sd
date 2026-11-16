// Construction de la variante minifiée et regroupée (NC-0004).
//
// Un seul outil, chargé sans installation : `esbuild-wasm`, pris sur esm.sh.
// Le script ne présume pas de son environnement : on lui **donne** de quoi lire
// les fichiers, ce qui le fait tourner aussi bien dans un navigateur (dossier
// `src/` servi) que dans un atelier ou un script Node.
//
//   import { build } from "./build.mjs";
//   const { js, css, stats } = await build({ lireFichier: async (p) => ... });
//
// `js` est un `Uint8Array`, `css` une chaîne. Il reste à les déposer et à
// reporter les adresses dans `index.min.html` (voir `README.md`).

/** Normalise un chemin : supprime `.`, `..` et les segments vides. */
function normaliser(chemin) {
  const parts = [];
  for (const seg of String(chemin).split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/**
 * Construit la variante. `lireFichier(chemin)` doit rendre le **texte** d'un
 * fichier du dépôt (chemin relatif à la racine, par exemple `src/app.js`).
 */
export async function build({
  lireFichier,
  entree = "src/app.js",
  cssSource = "src/styles.css",
  esbuildUrl = "https://esm.sh/esbuild-wasm@0.21.5",
  wasmURL = "https://esm.sh/esbuild-wasm@0.21.5/esbuild.wasm",
} = {}) {
  if (typeof lireFichier !== "function") throw new Error("build : `lireFichier` est requis");

  const { default: esbuild } = await import(`${esbuildUrl}?bundle`);
  try {
    await esbuild.initialize({ wasmURL });
  } catch (err) {
    // esbuild-wasm ne s'initialise qu'une fois par page : si le vérificateur
    // (`verifier.mjs`) tourne dans la même session, l'instance est déjà prête.
    if (!/already been called|more than once/i.test(String((err && err.message) || err))) throw err;
  }

  const racine = {
    name: "depot",
    setup(build_) {
      build_.onResolve({ filter: /.*/ }, (args) => {
        // Les bibliothèques chargées à la demande restent externes : elles ne
        // se chargent qu'au moment de l'action qui les emploie.
        if (/^https?:\/\//.test(args.path)) return { path: args.path, external: true };
        let chemin = args.path;
        if (chemin.startsWith(".")) {
          chemin = `${args.importer.replace(/\/[^/]*$/, "")}/${chemin}`;
        } else if (!chemin.startsWith("src/")) {
          chemin = `src/${chemin}`;
        }
        return { path: normaliser(chemin), namespace: racine.name };
      });
      build_.onLoad({ filter: /.*/, namespace: racine.name }, async (args) => ({
        contents: await lireFichier(args.path),
        loader: "js",
      }));
    },
  };

  const resultat = await esbuild.build({
    entryPoints: [entree],
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
    write: false,
    plugins: [racine],
    external: ["https://*", "http://*"],
    logLevel: "silent",
  });

  const cssBrut = await lireFichier(cssSource);
  const css = await esbuild.transform(cssBrut, { loader: "css", minify: true });

  const js = resultat.outputFiles[0].contents;
  return {
    js,
    css: css.code,
    stats: {
      jsBytes: js.length,
      cssBytes: css.code.length,
      cssOrigBytes: cssBrut.length,
      warnings: resultat.warnings.length,
    },
  };
}
