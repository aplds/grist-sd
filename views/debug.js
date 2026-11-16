// Onglet « Debug » — poste de mise au point, réservé au mode autonome.
//
// L'outil ouvert hors de Grist est nécessairement un poste de développement :
// c'est là qu'on règle la présentation et qu'on éprouve les écrans. Cet onglet
// permet de simuler un rôle, de forcer l'identité affichée, d'inspecter l'état
// interne et d'agir sur le stockage local.
//
// Quand l'outil est embarqué dans un document Grist, l'onglet n'est ni affiché
// ni accessible : les droits y sont réels et ne doivent pas être simulables.

import { NAV, SCHEMA } from "../schema.js";
import { ROLES, ROLE_IDS, canSettings, canWrite, currentRole, roleBadgeClass, roleLabel } from "../roles.js";
import { mesFiches, perimetreRestreint, voirTout } from "../visibilite.js";
import { loadPrefs, stats } from "../store.js";
import { enRecette } from "../environnement.js";
import * as ui from "../ui.js";

const { esc, panel, alert, button, dl, dataTable } = ui;

/* ------------------------------------------------------------------ */
/* Autorisation d'affichage                                            */
/* ------------------------------------------------------------------ */

/**
 * L'onglet Debug n'existe que dans un environnement de **recette** déclaré
 * (NC-0008) — et jamais dans un cadre Grist, où les droits sont réels. La
 * production ne porte donc ni simulation de rôle, ni purge du stockage, ni
 * export du générateur.
 */
export function debugAllowed(state) {
  return enRecette() && !state.embedded;
}

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

function bytes(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}

function storageRows() {
  const rows = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!/^sections-disciplinaires\./.test(key)) continue;
    const size = (localStorage.getItem(key) || "").length;
    rows.push({ id: key, key, size });
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

const storageTable = () => {
  const rows = storageRows();
  return dataTable({
    caption: `${rows.length} entrée(s) — stockage propre à ce navigateur`,
    columns: ["Clé", "Taille"],
    rows: rows.map((r) => ({ id: r.key, cells: [`<code>${esc(r.key)}</code>`, `${bytes(r.size)}`] })),
    rowAttr: "",
    emptyText: "Aucune donnée enregistrée : la base d'exemple est recréée à chaque chargement.",
  });
};

/**
 * Bouton de simulation d'un rôle ; le bouton du rôle actif est marqué.
 */
function roleChoice(roleId, active, label) {
  const on = active === roleId;
  return `
<button type="button" class="fr-btn ${on ? "fr-btn--primary" : "fr-btn--secondary"} fr-btn--sm app-debug-role"
  data-action="debug-role" data-role="${esc(roleId)}" aria-pressed="${on ? "true" : "false"}">
  ${esc(label)}
</button>`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function viewDebug(store, state) {
  const prefs = loadPrefs();
  const role = currentRole(state);
  const secretaires = store.table("Secretaires");
  const fiches = mesFiches(store, state);
  const counts = stats(store.db);
  const tables = Object.keys(SCHEMA).map((name) => ({
    id: name,
    table: name,
    n: store.table(name).length,
    label: SCHEMA[name].label,
  }));
  const total = tables.reduce((sum, t) => sum + t.n, 0);

  const avertissement = alert("info", "Onglet réservé à la mise au point",
    "Il n'existe qu'en mode autonome : dès que l'outil est ouvert dans un document Grist, les droits sont réels et cet onglet disparaît. Les réglages ci-dessous n'affectent que ce navigateur.");

  const identite = panel("Identité et rôle simulés", `
    <p class="fr-text--sm">
      Rôle réel : <span class="fr-badge fr-badge--sm ${esc(roleBadgeClass(role))}">${esc(roleLabel(role))}</span>
      ${state.debugRole ? ` — <strong>simulé</strong>` : ""}
    </p>
    <div class="fr-btns-group fr-btns-group--inline fr-btns-group--sm app-debug-roles">
      ${roleChoice("", state.debugRole || "", "Rôle réel")}
      ${ROLE_IDS.map((id) => roleChoice(id, state.debugRole || "", ROLES[id].label)).join("")}
    </div>
    <p class="fr-hint-text fr-mt-2w">
      Simuler un rôle applique réellement ses restrictions : la barre de navigation perd
      « Réglages », les champs et les boutons se désactivent, et toute écriture est refusée —
      y compris au niveau de la couche de données. C'est le moyen d'éprouver les trois
      profils sans second document Grist.
    </p>
    <div class="app-debug__champs">
      <div class="fr-mt-3w">
        <label class="fr-label" for="debugName">Nom affiché dans l'en-tête</label>
        <input class="fr-input" type="text" id="debugName" aria-describedby="debugName-desc" data-action="debug-name"
          value="${esc(state.debugName || "")}" placeholder="Ex. : Alice Propriétaire">
        <p class="fr-hint-text app-desc" id="debugName-desc">Laisser vide pour le nom réel (« Poste local »). Sert à juger la mise en page avec un nom long.</p>
      </div>
      <div class="fr-mt-3w">
        <label class="fr-label" for="debugEmail">Identité simulée (fiche secrétaire)</label>
        <select class="fr-select" id="debugEmail" aria-describedby="debugEmail-desc" data-action="debug-email">
          <option value="">— Aucune (l'outil voit tout le document) —</option>
          ${secretaires.map((s) => {
            const nom = String(state.ctx?.v("Secretaires", s, "Nom_complet") || "").trim() || `#${s.id}`;
            const email = String(s.Email || "").trim();
            return `<option value="${esc(email)}" ${email && String(state.debugEmail) === email ? "selected" : ""}>${esc(nom)}${email ? ` — ${esc(email)}` : " (sans courriel)"}</option>`;
          }).join("")}
        </select>
        <p class="fr-hint-text app-desc" id="debugEmail-desc">Un secrétaire ne voit que les affaires qui lui sont attribuées. Choisir ici une fiche permet d'éprouver ce périmètre : la liste, le tableau de bord, les séances et le registre des décisions s'y réduisent. Hors Grist, aucune identité réelle n'est transmise, d'où ce réglage.</p>
      </div>
    </div>
  `, { iconName: "user-setting-line", subtitle: "Simuler un profil, forcer un nom" });

  const exportPanel = panel("Export du générateur", `
    <p class="fr-text--sm">
      Assemble une archive ZIP du site autonome complet — tous les fichiers de l'application —
      en remplaçant le jeu de données d'exemple par une base vide. L'archive ne contient donc
      <strong>aucune donnée de section disciplinaire</strong> : elle peut être déposée telle
      quelle sur un hébergement de fichiers statiques, ou servir de base à un nouveau
      générateur Perchance.
    </p>
    ${button("Télécharger le générateur (.zip)", { variant: "primary", size: "sm", iconName: "download-line", action: "debug-export" })}
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      La liste des fichiers est découverte à partir de <code>index.html</code> (feuilles de style
      puis <code>import</code> des modules) : rien à tenir à jour ici. Le fichier
      <code>seed.js</code> de l'archive est régénéré vide, et un fichier
      <code>LISEZ-MOI.txt</code> rappelle le contenu de l'archive et sa mise en ligne.
    </p>
  `, { iconName: "download-line", subtitle: "Site autonome, données retirées", collapsible: true });

  const etat = panel("État interne", `
    ${dl([
      ["Page courante", `${state.page}${state.sub ? ` / ${state.sub}` : ""}${state.fiche ? ` / ${state.fiche}` : ""}`],
      ["Onglets de navigation", NAV.map((n) => n.id).join(", ")],
      ["Mode de stockage", store.mode === "grist" ? "document Grist" : "navigateur (localStorage)"],
      ["Embarqué (widget)", state.embedded ? "oui" : "non"],
      ["Connexion Grist", String(state.grist)],
      ["Écriture autorisée", canWrite(state) ? "oui" : "non"],
      ["Réglages accessibles", canSettings(state) ? "oui" : "non"],
      ["Périmètre des affaires", perimetreRestreint(store, state)
        ? `ses affaires seulement (${fiches.length} fiche(s) secrétaire rapprochée(s) par le courriel)`
        : (voirTout(state) ? "toutes les affaires (réglage « voir tout »)" : "toutes les affaires")],
      ["Préférences mémorisées", `<code>${esc(JSON.stringify(prefs))}</code>`, true],
      ["Enregistrements", `${total}`],
      ["Compteurs", `affaires ${counts.affaires} · décisions ${counts.decisions} · documents ${counts.documents} · trames ${counts.trames}`],
    ])}
  `, { iconName: "information-line", subtitle: "Ce que voit le moteur de rendu", collapsible: true });

  const tablesPanel = panel("Tables", dataTable({
    caption: `${tables.length} table(s), ${total} enregistrement(s)`,
    columns: ["Table", "Identifiant", "Lignes"],
    rows: tables.map((t) => ({ id: t.id, cells: [esc(t.label), `<code>${esc(t.table)}</code>`, String(t.n)] })),
    rowAttr: "",
  }), { iconName: "table-line", subtitle: "Décompte par table du modèle", collapsible: true });

  const stockage = panel("Stockage local", `
    ${storageTable()}
    <div class="fr-btns-group fr-btns-group--inline fr-mt-2w">
      ${button("Vider les préférences", { variant: "tertiary", size: "sm", iconName: "eraser-line", action: "debug-clear-prefs" })}
      ${button("Vider la base locale", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", action: "debug-clear-store" })}
    </div>
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      Vider la base locale fait recharger le jeu de données d'exemple à la prochaine
      ouverture ; les préférences regroupent la page mémorisée, les filtres, le périmètre
      des affaires, le rôle simulé, le nom forcé et l'identité simulée.
    </p>
  `, { iconName: "database-line", subtitle: "Contenu propre à ce navigateur", collapsible: true });

  const verification = panel("Vérification de la livraison", `
    <p class="fr-text--sm">
      Un seul geste, celui de la livraison (NC-0025) : analyse syntaxique de <strong>tous</strong> les
      modules du dépôt, puis exécution du harnais de non-régression. Le rapport se recopie dans
      l'entrée de <code>CHANGELOG.md</code>. L'analyse emploie <code>esbuild-wasm</code> (chargé à la
      demande) : la première exécution prend quelques secondes.
    </p>
    ${button("Vérifier la livraison", { variant: "primary", size: "sm", iconName: "shield-check-line", action: "debug-verifier" })}
    ${state.verification
      ? `<pre class="fr-text--sm app-diag-log fr-mt-2w" tabindex="0">${esc(state.verification)}</pre>`
      : `<p class="fr-hint-text fr-mt-1w fr-mb-0">Aucune vérification exécutée dans cette session.</p>`}
  `, { iconName: "shield-check-line", subtitle: "Syntaxe de tous les modules et harnais de non-régression", collapsible: true, open: !!state.verification });

  const actions = panel("Actions", `
    <div class="fr-btns-group fr-btns-group--inline">
      ${button("Recharger l'application", { variant: "primary", size: "sm", iconName: "refresh-line", action: "debug-reload" })}
      ${button("Restaurer les exemples", { variant: "secondary", size: "sm", iconName: "refresh-line", action: "reset" })}
      ${button("Tout effacer", { variant: "tertiary", size: "sm", iconName: "delete-bin-line", action: "clear" })}
      ${button("Tester une notification", { variant: "tertiary", size: "sm", iconName: "notification-3-line", action: "debug-toast" })}
    </div>
  `, { iconName: "flashlight-line", subtitle: "Repartir d'un état propre" });

  return `
<div class="app-page-head">
  <div>
    <p class="app-kicker">Debug</p>
    <h1 class="fr-h3">Mise au point</h1>
    <p class="app-page-head__sub">Outils de développement, disponibles uniquement hors document Grist.</p>
  </div>
</div>
<div class="app-stack">
  <div>${avertissement}</div>
  ${identite}
  <div class="fr-grid-row fr-grid-row--gutters">
    <div class="fr-col-12 fr-col-lg-6">${actions}</div>
    <div class="fr-col-12 fr-col-lg-6">${stockage}</div>
  </div>
  ${etat}
  ${tablesPanel}
  ${verification}
  ${exportPanel}
</div>`;
}
