// Cas de non-régression des invariants de `SPEC.md` § 8 — NC-0001.
//
// Un cas par invariant qui se vérifie sur de la logique pure. Les garanties
// liées à l'affichage, à Grist ou aux échanges réseau relèvent du test de
// fumée par écran (voir `README.md`, dans ce dossier) ; celles qui touchent
// aux dates, aux délais, aux références, à l'échappement et aux exports sont
// ici.
//
// Ce fichier s'importe pour **déclarer** les cas ; c'est `lancer()` (harness.js)
// qui les exécute. Voir `index.html` pour l'exécution dans un navigateur.

import {
  test, assert, assertEgal, assertContient, assertNonContient,
} from "./harness.js";
import { Context, FORMULAS as CALCULS, formatDateFr, isoDate, formatDateSaisie, parseDateSaisie } from "../formulas.js";
import { champCsv, neutraliserFormule } from "../export-table.js";
import { enteteHtml, formatDateValue, renderTemplate, renderVariables, decouperFeuille, renderDocumentBody } from "../render.js";
import { COLONNES_RICHES, assainirHtmlSecurite } from "../sanitize.js";
import { ENV_PRODUCTION, ENV_RECETTE, declarerDocumentGrist, environnement, enRecette, oublierDocumentGrist } from "../environnement.js";
import { dossierDeclare, hoteDossier, urlDossier } from "../dossier.js";
import {
  definirOriginesGristDeclarees, gristOriginsAutorisees, origineGristAutorisee, classerReprises,
} from "../grist-backend.js";
import { declareRecette, forcerProduction } from "../export.js";
import {
  QUOTA_LOCAL_SUPPOSE, Store, effacerErreurStockage, ensureParametres, erreurStockage,
  messageErreurStockage, niveauOccupation, setStockageReporter,
} from "../store.js";
import { numeroerActes, prefixeActes, prochainNumeroActe, registreActes } from "../actes.js";
import { collegeAttendu, collegeDuCorps, juridictionRecours, procedure, qualiteIntervenant } from "../procedure.js";
import { MOTIFS_PAR_DEFAUT, PARAMS, SANCTIONS_PAR_DEFAUT } from "../regimes.js";
import { TRAMES_PAR_DEFAUT } from "../trames-defaut.js";
import {
  appliquerPlanContenus, contenusLivres, detailAlignement, planAlignementContenus, planEstVide, signatureContenus,
} from "../contenus.js";
import { referencesDuRepertoire, sourceIdentifiable } from "../considerants.js";
import { SCHEMA, migrerVoieDeRecours } from "../schema.js";
import { FORMULES, estIntituleArticle, intituleArticle } from "../formules-decision.js";
import { icon } from "../ui.js";
import { basculerEffet, chipHtml, delaverPastilles, editorToHtml } from "../editor.js";
import { VERSION } from "../version.js";
import { SEUIL_RECHERCHE, filtrerOptions, plier } from "../select-recherche.js";

/* ------------------------------------------------------------------ */
/* § 8.10 — Une date se saisit librement et ne se perd jamais          */
/* ------------------------------------------------------------------ */

test("date : toutes les écritures courantes sont acceptées", () => {
  assertEgal("2026-09-20", parseDateSaisie("20/09/2026"), "française à séparateur");
  assertEgal("2026-09-20", parseDateSaisie("20-9-2026"), "française à tirets");
  assertEgal("2026-09-20", parseDateSaisie("20.09.26"), "année sur deux chiffres");
  assertEgal("2026-09-20", parseDateSaisie("20092026"), "à la suite JJMMAAAA");
  assertEgal("2026-09-20", parseDateSaisie("2026-09-20"), "internationale");
  assertEgal("2026-09-20", parseDateSaisie("2026/9/20"), "internationale à barres");
  assertEgal("2026-09-20", parseDateSaisie("2026-09-20T00:00:00Z"), "horodatage");
});

test("date : une date irréelle ou vide est refusée, sans lever", () => {
  assertEgal(null, parseDateSaisie(""), "vide");
  assertEgal(null, parseDateSaisie("bonjour"), "texte");
  assertEgal(null, parseDateSaisie("31/02/2026"), "31 février");
  assertEgal(null, parseDateSaisie("2026-13-01"), "mois 13");
});

test("date : l'aller-retour de saisie est stable", () => {
  assertEgal("20/09/2026", formatDateSaisie("2026-09-20"));
  assertEgal("2026-09-20", isoDate(parseDateSaisie("20/09/2026")), "une date française relue reste juste");
});

test("date : une date en toutes lettres s'écrit sans zéro, et le 1er", () => {
  // La forme de l'état civil et de la rédaction administrative : « 1er janvier
  // 2026 », « 5 mars 2026 » — jamais « 01 » ni « 1 ».
  assertEgal("1er janvier 2026", formatDateFr("2026-01-01"), "le premier du mois");
  assertEgal("5 mars 2026", formatDateFr("2026-03-05"), "un autre jour");
  // La balise du moteur suit la même règle…
  assertEgal("5 mars 2026", formatDateValue("2026-03-05", "@long"), "le motif long");
  assertEgal("1er janvier 2026", formatDateValue("2026-01-01", "@long"), "le motif long, le 1er");
  assertEgal("jeudi 1er janvier 2026", formatDateValue("2026-01-01", "@full"), "le motif complet");
  assertEgal("janv.", formatDateValue("2026-01-01", "MMM"), "l'abréviation française du mois");
  // … mais une date chiffrée garde ses zéros.
  assertEgal("05/03/26", formatDateValue("2026-03-05", "@short"), "le motif court");
  assertEgal("2026-03-05", formatDateValue("2026-03-05", "@iso"), "le motif machine");
});

/* ------------------------------------------------------------------ */
/* § 8.38 — La date de séance, et § 8.39 — les colonnes calculées      */
/* ------------------------------------------------------------------ */

test("rendu : la date de la séance se lit sur l'affaire", () => {
  // `Seance_d_examen` est une colonne **calculée** du document : elle remonte
  // celle de l'affaire, et `c.ref` ne lit que les colonnes brutes. La formule
  // la résolvait donc toujours à vide — un justificatif, une convocation ou une
  // décision s'écrivait sans date. Elle passe désormais par l'index des séances.
  const db = {
    Affaires: [{ id: 1, Seance_d_examen: 7 }],
    Seances_d_examen: [{ id: 7, Date: "2026-03-05" }],
  };
  const c = new Context(db);
  assertEgal("2026-03-05", CALCULS.Generateur.Seance_d_examen_Date(c, "Generateur", { id: 1, Affaire: 1 }),
    "la date de la séance de l'affaire");
  assertEgal(null, CALCULS.Generateur.Seance_d_examen_Date(c, "Generateur", { id: 2, Affaire: null }),
    "sans affaire, pas de date");
});

test("lecture : une colonne calculée passe par le moteur, jamais par le champ brut", () => {
  // L'état civil du mis en cause vit dans `Personnes` : `Nom_complet`, `INE` et
  // `Date_de_naissance` sont des colonnes **calculées**, que l'enregistrement
  // brut ne porte pas. Les lire sur la ligne — ou par `c.ref(…).Colonne` —
  // rendait un nom, un INE et une date de naissance vides : le registre des
  // actes n'y montrait que des cases vides, et « Né le : » d'une lettre de
  // saisine s'écrivait sans date.
  const db = {
    Personnes: [{ id: 1, Prenom: "Laura", Nom: "MARTIN", INE: "2011254876K", Date_de_naissance: "2002-11-23" }],
    Affaires: [{ id: 1, Numero: "26UV-3", Mis_en_cause: 1 }],
    Sanctions: [{ id: 9, Libelle: "Exclusion temporaire de l'établissement" }],
    Decisions: [{ id: 4, Affaire: 1, Sanction: 9, Decision: "Exclusion temporaire", Nature: "Sanction", Numero_acte: "UV-2026-001" }],
  };
  const c = new Context(db);
  assertEgal("Laura MARTIN", c.v("Affaires", db.Affaires[0], "Nom_complet"), "le nom calculé de l'affaire");
  assertEgal("2011254876K", CALCULS.Decisions.Affaire_INE(c, "Decisions", db.Decisions[0]),
    "l'INE, lu par la décision");
  assertEgal("2002-11-23", CALCULS.Generateur.Affaire_Date_de_naissance(c, "Generateur", { id: 9, Affaire: 1 }),
    "la date de naissance, lue par le document");
  // Le champ brut reste lu **à défaut** : une ligne antérieure à la reprise
  // n'est pas perdue pour autant.
  assertEgal("nom brut", c.vOuBrut("Affaires", { id: 7, Nom_complet: "nom brut" }, "Nom_complet"),
    "repli sur le champ brut");
  // Le registre des actes — qui lit des lignes brutes — porte le nom et le
  // libellé calculés.
  const registre = registreActes(db, db.Affaires);
  assertEgal(1, registre.lignes.length, "une décision numérotée");
  assertEgal("Laura MARTIN", registre.lignes[0].Mis_en_cause, "le mis en cause du registre");
  assertEgal("Exclusion temporaire de l'établissement", registre.lignes[0].Libelle, "le libellé du registre");
});

/* ------------------------------------------------------------------ */
/* § 8.40 — Les effets en ligne s'appliquent aussi aux pastilles       */
/* ------------------------------------------------------------------ */

test("éditeur : le gras, l'italique, le souligné et le barré s'appliquent aux pastilles", () => {
  // Le navigateur applique ses commandes au texte mais ignore la pastille —
  // un îlot insécable — pour l'italique, le souligné et le barré, sans le
  // dire : la pastille restait en romain quand le texte passait en italique.
  // `basculerEffet` ramène chaque pastille touchée au sens de la bascule.
  const hote = document.createElement("div");
  document.body.appendChild(hote);
  try {
    hote.innerHTML = `<div data-wysiwyg-editor contenteditable="true"><p>Texte ${chipHtml("{{Affaire}}.Numero", "Numéro", "26UV-3")}</p></div>`;
    const editeur = hote.firstChild;
    const sel = document.getSelection();
    const selPastille = () => {
      const pastille = editeur.querySelector("[data-token]");
      const plage = document.createRange();
      plage.selectNode(pastille);
      sel.removeAllRanges();
      sel.addRange(plage);
    };
    for (const [cmd, balise] of [["italic", "EM"], ["underline", "U"], ["strikeThrough", "S"], ["bold", "STRONG"]]) {
      selPastille();
      assert(basculerEffet(editeur, cmd), `${cmd} pris en charge`);
      const pastille = editeur.querySelector("[data-token]");
      assert(pastille.closest(balise), `la pastille porte ${cmd}`);
      selPastille();
      assert(basculerEffet(editeur, cmd), `${cmd} retiré`);
      assert(!editeur.querySelector("[data-token]").closest(balise), `la pastille ne porte plus ${cmd}`);
    }
    // Sans pastille touchée, la commande native suffit : rien n'est pris.
    const texte = editeur.querySelector("p").firstChild;
    const plage = document.createRange();
    plage.setStart(texte, 0);
    plage.setEnd(texte, 3);
    sel.removeAllRanges();
    sel.addRange(plage);
    assert(!basculerEffet(editeur, "italic"), "texte seul : commande native");
    // Le cycle d'enregistrement garde l'effet avec la balise redevenue texte.
    selPastille();
    basculerEffet(editeur, "italic");
    const html = editorToHtml(editeur);
    assertContient(html, "{{Affaire}}.Numero", "la balise est enregistrée");
    assertContient(html, "<em>", "l'italique est enregistré avec elle");
  } finally {
    hote.remove();
  }
});

test("éditeur : « Effacer la mise en forme » dégage aussi les pastilles", () => {
  const hote = document.createElement("div");
  document.body.appendChild(hote);
  try {
    hote.innerHTML = `<div data-wysiwyg-editor contenteditable="true"><p>Texte <em><u>${chipHtml("{{Affaire}}.Numero", "Numéro", "26UV-3")}</u></em></p></div>`;
    const editeur = hote.firstChild;
    const sel = document.getSelection();
    const pastille = editeur.querySelector("[data-token]");
    const plage = document.createRange();
    plage.selectNode(pastille);
    sel.removeAllRanges();
    sel.addRange(plage);
    assert(delaverPastilles(editeur), "pastille dégagée");
    const degagee = editeur.querySelector("[data-token]");
    assert(!degagee.closest("EM,U"), "ni italique ni souligné sur la pastille");
    assert(degagee.isConnected, "la pastille est restée la même");
    assertNonContient(editeur.innerHTML, "<em></em>", "pas de porteur vide");
    assertNonContient(editeur.innerHTML, "<u></u>", "pas de porteur vide");
  } finally {
    hote.remove();
  }
});

/* ------------------------------------------------------------------ */
/* § 8.11 / NC-0007 — Les exports ne laissent pas passer les formules  */
/* ------------------------------------------------------------------ */

test("export : une valeur-formule est neutralisée", () => {
  assertEgal("'=1+1", neutraliserFormule("=1+1"), "signe égal");
  assertEgal("'+42", neutraliserFormule("+42"), "plus");
  assertEgal("'@SUM(A1)", neutraliserFormule("@SUM(A1)"), "arobase");
  assertEgal("'-cmd", neutraliserFormule("-cmd"), "tiret");
  assertEgal("DUPONT", neutraliserFormule("DUPONT"), "texte ordinaire");
});

test("export : un nombre, même négatif, n'est jamais transformé", () => {
  assertEgal(-5, neutraliserFormule(-5), "nombre négatif");
  assertEgal("-5", champCsv(-5), "nombre négatif en CSV");
  assertEgal(12, neutraliserFormule(12));
});

test("export : le champ CSV est entouré seulement s'il en a besoin", () => {
  assertEgal('"DUPONT;Jean"', champCsv("DUPONT;Jean"), "point-virgule");
  assertEgal('"a""b"', champCsv('a"b'), "guillemet doublé");
  assertEgal("simple", champCsv("simple"));
});

/* ------------------------------------------------------------------ */
/* NC-0006 — Le rendu échappe les valeurs, sauf le balisage du moteur  */
/* ------------------------------------------------------------------ */

test("rendu : une valeur de donnée est échappée", () => {
  const rendu = renderTemplate("<p>{{Nom}}</p>", { Nom: 'X<img src=x onerror="window.__xss=7">' });
  assertContient(rendu, "<p>X", "le texte de la valeur est là");
  assertContient(rendu, "&lt;img", "la balise doit être échappée");
  assertNonContient(rendu, "<img", "aucune balise vive ne doit subsister");
  assertContient(rendu, "</p>", "le balisage de la trame reste intact");
});

test("rendu : le balisage produit par le moteur passe tel quel", () => {
  const rendu = renderTemplate("<p>{{Logo}}.img()</p>", { Logo: "https://exemple.test/logo.png" });
  assertContient(rendu, "<img", "une image du moteur doit être rendue");
  assertContient(rendu, "logo.png");
});

test("rendu : les variables sont échappées, sauf la liste blanche", () => {
  assertContient(renderVariables("<p>{nom}</p>", { nom: "<b>x</b>" }), "&lt;b&gt;", "variable ordinaire");
  assertContient(renderVariables("{visa_code_rural}", { visa_code_rural: "<b>Vu</b>" }), "<b>Vu</b>", "visa du moteur");
});

/* ------------------------------------------------------------------ */
/* Rédaction : aucune balise brute n'atteint le document rendu         */
/* ------------------------------------------------------------------ */

test("rendu : le texte résout les variables de la feuille et les données", () => {
  // La palette de l'espace de rédaction propose les deux familles : une variable
  // `{…}` tombée dans le texte, ou une balise `{{…}}` tombée dans le chapeau,
  // doit produire sa valeur — la pastille en montrait déjà une à la rédaction.
  const rendu = renderDocumentBody(
    "<p>Bonjour {commission_president}, dossier {{Affaire}}.Numero, page {page} sur {pages}.</p>",
    { Affaire: { Numero: "26UV-3" } },
    { commission_president: "Pierre DUBOIS" },
  );
  assertContient(rendu, "Pierre DUBOIS", "la variable de la feuille est rendue");
  assertContient(rendu, "26UV-3", "la balise de donnée est rendue");
  assertContient(rendu, 'class="page-number"', "les repères de pagination survivent au texte");
  assertNonContient(rendu, "{", "aucune balise brute ne subsiste");
});

test("rendu : un chapeau peut nommer une donnée", () => {
  const rendu = renderTemplate("<p>Dossier {{Affaire}}.Numero — {ville}</p>", { Affaire: { Numero: "26UV-3" } });
  assertContient(rendu, "26UV-3", "la balise de donnée du chapeau est rendue");
});

test("feuille : le texte ne tombe jamais dans le pied de page", () => {
  // L'emplacement du texte glissé **dans** le pied de page : le partage se fait
  // au début de ce pied, qui garde ses mentions après le texte. Sans cela, le
  // document entier devenait un pied de page, recopié page après page par Word
  // et l'OpenDocument, et le PDF lui réservait sa hauteur — une ligne par page.
  const [avant, apres] = decouperFeuille('<p>Chapeau</p><div class="print-footer">Dossier n° {numero} {{Corps}}</div>');
  assertEgal("<p>Chapeau</p>", avant, "le texte se place avant le pied de page");
  assertContient(apres, 'class="print-footer"', "le pied de page est conservé");
  assertContient(apres, "Dossier n° {numero}", "ses mentions aussi");
  assertNonContient(apres, "{{Corps}}", "l'emplacement n'est pas recopié dans le pied");
});

test("feuille : le partage suit l'emplacement quand il est hors du pied", () => {
  // Hors du pied de page, le partage reste celui de la balise.
  const [avant, apres] = decouperFeuille('<p>Avant</p>{{Corps}}<div class="print-footer">Pied</div>');
  assertEgal("<p>Avant</p>", avant);
  assertEgal('<div class="print-footer">Pied</div>', apres);
  // Sans emplacement, le texte se place avant le pied de page répété.
  const [sansAvant, sansApres] = decouperFeuille('<p>Texte</p><div class="print-footer">Pied</div>');
  assertEgal("<p>Texte</p>", sansAvant);
  assertEgal('<div class="print-footer">Pied</div>', sansApres);
  // Un emplacement dans un pied **imbriqué** : le partage se fait au pied, pas
  // au conteneur qui le porte.
  const [imbriquant, imbrique] = decouperFeuille('<div class="cadre"><div class="print-footer"><span>{{Corps}}</span></div></div>');
  assertEgal('<div class="cadre">', imbriquant, "le conteneur reste dans l'avant");
  assertNonContient(imbrique, "{{Corps}}");
});

/* ------------------------------------------------------------------ */
/* NC-0006 — L'assainissement des colonnes riches                      */
/* ------------------------------------------------------------------ */

test("assainissement : les balises actives et les gestionnaires sont retirés", () => {
  const propre = assainirHtmlSecurite('<p onclick="x()">a</p><script>alert(1)</script>');
  assertNonContient(propre, "<script", "script");
  assertNonContient(propre, "onclick", "gestionnaire en ligne");
  assertContient(propre, "a", "le contenu légitime reste");
});

test("assainissement : la mise en page d'un document est conservée", () => {
  const feuille = '<p style="text-align: center; font-size: 14pt"><strong>Titre</strong></p>';
  assertEgal(feuille, assainirHtmlSecurite(feuille), "le balisage anodin ne bouge pas");
});

test("assainissement : la liste des colonnes riches est celle du modèle", () => {
  for (const col of ["Template_contenu", "Feuille_de_style", "Contenu"]) {
    assert(COLONNES_RICHES.has(col), `${col} doit être assainie`);
  }
});

/* ------------------------------------------------------------------ */
/* NC-0008 — L'environnement est déclaré, jamais déduit — sauf que     */
/*          le widget d'un document Grist est un déploiement réel      */
/* ------------------------------------------------------------------ */

test("environnement : le défaut est la production", () => {
  const sauvegarde = typeof window !== "undefined" ? window.ENVIRONNEMENT : undefined;
  try {
    if (typeof window !== "undefined") delete window.ENVIRONNEMENT;
    assertEgal(ENV_PRODUCTION, environnement(), "sans déclaration");
    if (typeof window !== "undefined") window.ENVIRONNEMENT = "demo";
    assertEgal(ENV_RECETTE, environnement(), "un alias de recette");
    assert(enRecette(), "demo doit être en recette");
  } finally {
    if (typeof window !== "undefined") {
      if (sauvegarde === undefined) delete window.ENVIRONNEMENT;
      else window.ENVIRONNEMENT = sauvegarde;
    }
  }
});

test("environnement : un document Grist est toujours en production", () => {
  const sauvegarde = typeof window !== "undefined" ? window.ENVIRONNEMENT : undefined;
  try {
    if (typeof window !== "undefined") window.ENVIRONNEMENT = "recette";
    assert(enRecette(), "la déclaration de la vitrine est en recette");
    declarerDocumentGrist();
    assertEgal(ENV_PRODUCTION, environnement(), "un document Grist force la production");
    assert(!enRecette(), "la recette ne s'applique pas dans un document Grist");
  } finally {
    oublierDocumentGrist();
    if (typeof window !== "undefined") {
      if (sauvegarde === undefined) delete window.ENVIRONNEMENT;
      else window.ENVIRONNEMENT = sauvegarde;
    }
  }
});

/* ------------------------------------------------------------------ */
/* Dossier de pièces — adresse déclarée (voir dossier.js)              */
/* ------------------------------------------------------------------ */

test("dossier : l'adresse se complète et se valide", () => {
  // Un domaine saisi sans schéma reçoit `https://` ; l'adresse est normalisée.
  assertEgal("https://fichiers.gouv.fr/dossier/12", urlDossier("fichiers.gouv.fr/dossier/12"), "schéma complété");
  assertEgal("https://exemple.fr/", urlDossier("https://exemple.fr"), "schéma présent");
  // Ce qui n'est pas une adresse web est refusé : la fenêtre le dit, et rien
  // n'est enregistré — un lien mort ne doit pas entrer dans le dossier.
  assertEgal("", urlDossier("pas une adresse"), "phrase refusée");
  assertEgal("", urlDossier("dossier 12"), "espaces refusés");
  assertEgal("", urlDossier("javascript:alert(1)"), "schéma dangereux refusé");
  assertEgal("", urlDossier(""), "valeur vide");
  // L'affaire déclare son dossier dès que le lien est exploitable.
  assert(dossierDeclare({ Lien_vers_le_dossier: "fichiers.gouv.fr/x" }), "dossier déclaré");
  assert(!dossierDeclare({ Lien_vers_le_dossier: "n'importe quoi" }), "lien inexploitable");
  assert(!dossierDeclare({}), "dossier absent");
  assertEgal("fichiers.gouv.fr", hoteDossier("https://www.fichiers.gouv.fr/dossier/12"), "hôte du dossier");
});

/* ------------------------------------------------------------------ */
/* NC-0011 — Seules les origines Grist déclarées servent l'API         */
/* ------------------------------------------------------------------ */

test("grist : les origines reconnues sont acceptées, les autres refusées", () => {
  assert(gristOriginsAutorisees().has("docs.getgrist.com"), "docs.getgrist.com");
  assert(gristOriginsAutorisees().has("getgrist.com"), "getgrist.com");
  assert(origineGristAutorisee("https://docs.getgrist.com/o/1"), "l'URL de Grist");
  assert(!origineGristAutorisee("https://exemple.test/grist"), "une origine quelconque");
  assert(!origineGristAutorisee(""), "une origine vide");
});

test("grist : l'instance souveraine de l'État est reconnue sans réglage", () => {
  assert(gristOriginsAutorisees().has("grist.numerique.gouv.fr"), "grist.numerique.gouv.fr");
  assert(origineGristAutorisee("https://grist.numerique.gouv.fr/o/1"), "l'URL de l'instance de l'État");
});

test("grist : une instance auto-hébergée se déclare et se retire (NC-0023)", () => {
  const hote = "grist.etablissement-test.fr";
  // Une origine non déclarée est refusée…
  assert(!origineGristAutorisee(`https://${hote}`), "avant déclaration");
  let retenues = [];
  try {
    retenues = definirOriginesGristDeclarees([`https://${hote}/`, hote, ""]);
    assert(retenues.includes(hote), "la déclaration normalise et retient l'hôte");
    assert(origineGristAutorisee(`https://${hote}`), "après déclaration");
    assert(origineGristAutorisee(`https://${hote}:8443/grist`), "le port et le chemin sont ignorés");
    // Une origine voisine reste refusée : pas d'effet de bord.
    assert(!origineGristAutorisee("https://autre.test"), "une autre origine reste refusée");
  } finally {
    definirOriginesGristDeclarees(retenues.length ? [] : retenues);
  }
  assert(!origineGristAutorisee(`https://${hote}`), "la déclaration retirée ne vaut plus");
});

/* ------------------------------------------------------------------ */
/* NC-0024 — Un échec d'écriture locale ne passe plus en silence       */
/* ------------------------------------------------------------------ */

test("stockage : les seuils d'occupation sont classés", () => {
  assertEgal("normal", niveauOccupation(0).niveau);
  assertEgal("normal", niveauOccupation(Math.floor(QUOTA_LOCAL_SUPPOSE * 0.5)).niveau);
  assertEgal("avertissement", niveauOccupation(Math.floor(QUOTA_LOCAL_SUPPOSE * 0.7)).niveau);
  assertEgal("critique", niveauOccupation(Math.floor(QUOTA_LOCAL_SUPPOSE * 0.9)).niveau);
});

test("stockage : un dépassement de quota est reconnu et expliqué", () => {
  const quota = Object.assign(new Error("depasse"), { name: "QuotaExceededError" });
  assertContient(messageErreurStockage(quota), "plein");
  assertContient(messageErreurStockage(new Error("panne disque")), "panne disque");
});

test("stockage : un échec d'enregistrement remonte à l'interface", () => {
  const vraiSet = localStorage.setItem;
  let vu = "";
  setStockageReporter((m) => { vu = m; });
  try {
    localStorage.setItem = () => {
      throw Object.assign(new Error("échec simulé"), { name: "QuotaExceededError" });
    };
    const magasin = new Store();
    magasin.mode = "local";
    magasin.modeSession = false;
    magasin.persist();
    assert(vu, "le reporter a été appelé");
    assertEgal(vu, erreurStockage(), "l'échec est retenu");
    assertContient(vu, "plein");
  } finally {
    localStorage.setItem = vraiSet;
    setStockageReporter(null);
    effacerErreurStockage();
  }
  assertEgal("", erreurStockage(), "l'erreur est effaçable");
});

/* ------------------------------------------------------------------ */
/* NC-0021 — Aucun artefact exporté ne déclare la recette             */
/* ------------------------------------------------------------------ */

test("archive : forcerProduction ramène toute page en production", () => {
  const recette = `<!doctype html><html><head><script>window.ENVIRONNEMENT = "recette";</script></head><body>x</body></html>`;
  const forcee = forcerProduction(recette);
  assert(!declareRecette(forcee), "la recette a disparu");
  assert(/window\.ENVIRONNEMENT\s*=\s*"production"/.test(forcee), "la production est déclarée");
  // Une page sans déclaration reçoit la production ; une page déjà en
  // production n'est pas modifiée.
  const sansDeclaration = forcerProduction("<html><head></head><body>x</body></html>");
  assert(!declareRecette(sansDeclaration) && /production/.test(sansDeclaration), "déclaration posée");
  const dejaProduction = `<html><head><script>window.ENVIRONNEMENT = "production";</script></head></html>`;
  assertEgal(dejaProduction, forcerProduction(dejaProduction), "inchangée");
  assert(declareRecette(`<script>window.ENVIRONNEMENT='recette'</script>`), "recette détectée");
});

/* ------------------------------------------------------------------ */
/* § 8.16 — Juridiction de recours et collèges                         */
/* ------------------------------------------------------------------ */

test("procédure : la voie de recours suit le public — et la tutelle des enseignants", () => {
  const usagers = { Public: "Usagers", Tutelle: "Ministère chargé de l'enseignement supérieur", Type_de_section: "Section d'établissement", Siege: "Valmont-sur-Loire" };
  const usagersAgri = { Public: "Usagers", Tutelle: "Ministère chargé de l'agriculture", Type_de_section: "Section d'établissement", Siege: "Valmont-sur-Loire" };
  const mesr = { Public: "Enseignants-chercheurs", Tutelle: "Ministère chargé de l'enseignement supérieur", Type_de_section: "Section d'établissement" };
  const agri = { Public: "Enseignants-chercheurs", Tutelle: "Ministère chargé de l'agriculture", Type_de_section: "Section d'établissement" };
  // L'usager relève du juge administratif — et jamais du CNESER.
  assertEgal("Tribunal administratif", juridictionRecours(usagers).court);
  assertEgal("Tribunal administratif", juridictionRecours(usagersAgri).court, "l'usager d'un établissement agricole relève du même juge");
  assertEgal("Tribunal administratif", procedure(usagers).recours);
  // L'enseignant-chercheur relève du CNESER, ou du CNESERAAV dans un établissement agricole.
  assertEgal("CNESER", juridictionRecours(mesr).court);
  assertEgal("CNESERAAV", juridictionRecours(agri).court);
  assertEgal("CNESERAAV", procedure(agri).recours);
  // La compétence du juge administratif suit le ressort du siège, que la notice nomme.
  assert(juridictionRecours(usagers).devant.includes("Valmont-sur-Loire"), "le siège de la section est nommé");
  assert(!juridictionRecours(mesr).devant.includes("Valmont-sur-Loire"), "le CNESER ne dépend pas du siège");
});

test("modèle : la reprise réécrit la voie de recours des notifications livrées", () => {
  const recoursLivre = "Conformément à l'article R.421-1 du code de justice administrative, je vous informe que la présente décision peut faire l'objet d'un recours contentieux formé dans un délai de deux mois à compter de la notification de la présente auprès du tribunal administratif de {{Affaire_Section}}.Siege.";
  const r811 = "Conformément aux dispositions de l'article R.811-39 du code de l'éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire dans l'affaire vous concernant.";
  const db = {
    Trames: [
      { id: 5, Public: "Usagers", Template_contenu: `<p>x</p><p>${recoursLivre}</p>` },
      { id: 28, Public: "Enseignants-chercheurs", Template_contenu: `<p>${r811}</p><p>${recoursLivre}</p>` },
      { id: 99, Public: "Usagers", Template_contenu: "<p>Trame propre, sans la formule livrée.</p>" },
    ],
  };
  migrerVoieDeRecours(db);
  assertContient(db.Trames[0].Template_contenu, "devant {{Affaire_Section}}.Voie_de_recours", "notification des usagers réécrite");
  assertContient(db.Trames[0].Template_contenu, "recours contentieux", "l'usager garde le recours contentieux");
  assertContient(db.Trames[1].Template_contenu, "devant {{Affaire_Section}}.Voie_de_recours", "voie énoncée par la colonne");
  assertContient(db.Trames[1].Template_contenu, "R.712-42", "la lettre des enseignants-chercheurs retrouve son article");
  assertNonContient(db.Trames[1].Template_contenu, "R.811-39", "l'article des usagers disparaît");
  assertEgal("<p>Trame propre, sans la formule livrée.</p>", db.Trames[2].Template_contenu, "trame propre intacte");
});

test("procédure : un poste de composition se rapproche de son collège", () => {
  assertEgal("professeurs", collegeAttendu("professeurs des universités ou assimilés"));
  assertEgal("maitres", collegeAttendu("maîtres de conférences ou chargés de recherche"));
  assertEgal("magistrat", collegeAttendu("magistrat de l'ordre administratif"));
});

/* § 8.16 — Le collège d'une personne mise en cause se déduit de son corps : il
   décide de la formation appelée à juger (voir `effectifFormation`), et il n'est
   jamais deviné — un corps que les textes ne nomment pas ne donne pas de
   collège, plutôt qu'un collège faux. */
test("collège d'un corps : déduit des textes, jamais deviné", () => {
  assertEgal("professeurs", collegeDuCorps("Professeur des universités"), "un professeur des universités");
  assertEgal("professeurs", collegeDuCorps("Directeur de recherche"), "un directeur de recherche");
  assertEgal("professeurs", collegeDuCorps("Professeur de l'enseignement supérieur agricole"), "un corps agricole");
  assertEgal("maitres", collegeDuCorps("Maître de conférences"), "un maître de conférences");
  assertEgal("enseignants", collegeDuCorps("Professeur agrégé (PRAG)"), "un professeur agrégé");
  assertEgal("personnels", collegeDuCorps("Personnel administratif"), "un personnel administratif");
  assertEgal(null, collegeDuCorps("Autre"), "un corps « Autre » ne dit rien");
  assertEgal(null, collegeDuCorps(""), "un corps vide non plus");
  assertEgal(null, collegeDuCorps(null), "un corps absent ne lève pas");
});

/* § 8.29 — La qualité d'un intervenant suit sa source : une fiche de membre en
   fait un intervenant de la section, l'absence de fiche — saisie libre — un
   intervenant hors section. Une qualité délibérée, elle, se conserve : c'est
   elle que lisent les contrôles, et un changement de source ne doit pas
   l'effacer en silence. */
test("intervenant : la qualité suit la source, jamais ressaisie", () => {
  assertEgal("Membre de la section", qualiteIntervenant("", { membre: 12 }), "une fiche de membre fait un intervenant de la section");
  assertEgal("Hors section", qualiteIntervenant("Membre de la section", { membre: 0 }), "sans fiche, il est hors section");
  assertEgal("Hors section", qualiteIntervenant("Hors section", { membre: 0 }), "une qualité déjà déduite se redéduit");
  assertEgal("Hors section", qualiteIntervenant(undefined), "une qualité absente se déduit");
  assertEgal("Membre de la section", qualiteIntervenant("Hors section", { membre: 7 }), "revenir à un membre suit la source");
  assertEgal("Agent de l'établissement", qualiteIntervenant("Agent de l'établissement", { membre: 0 }), "une qualité délibérée se conserve");
  assertEgal("Personnalité extérieure", qualiteIntervenant("Personnalité extérieure", { membre: 3 }), "même en changeant de source");
});

/* ------------------------------------------------------------------ */
/* NC-0015 — Les contenus livrés, et les comptages de la documentation */
/* ------------------------------------------------------------------ */

test("contenus : la livraison livre ce que la documentation annonce", () => {
  assertEgal(22, SANCTIONS_PAR_DEFAUT.length, "sanctions livrées");
  assertEgal(19, MOTIFS_PAR_DEFAUT.length, "motifs livrés");
  assertEgal(44, TRAMES_PAR_DEFAUT.length, "trames livrées");
  assertEgal(
    { sanctions: 22, motifs: 19, trames: 44, formats: 6, seuils: 10 },
    contenusLivres(),
    "inventaire livré",
  );
  assert(
    MOTIFS_PAR_DEFAUT.some((m) => m.Libelle === "Usage frauduleux d'un logiciel de triche"),
    "le motif de triche rétabli",
  );
});

test("version : la livraison porte un numéro", () => {
  assert(/^\d+\.\d+\.\d+$/.test(VERSION), "version sémantique");
});

/* ------------------------------------------------------------------ */
/* NC-0020 — Numérotation et registre des actes                        */
/* ------------------------------------------------------------------ */

test("actes : la séquence suit la section et l'année, sans rejouer un numéro", () => {
  assertEgal("UDA-2026-001", prochainNumeroActe([], "UDA", 2026));
  assertEgal("UDA-2026-003", prochainNumeroActe(["UDA-2026-001", "UDA-2026-002"], "UDA", 2026));
  // Une suppression ne fait pas rejouer le numéro : le rang est le plus grand
  // utilisé, plus un — jamais le premier trou.
  assertEgal("UDA-2026-006", prochainNumeroActe(["UDA-2026-005", "UDA-2026-001"], "UDA", 2026));
  // Une autre année, ou une autre section, a sa propre séquence.
  assertEgal("UDA-2025-001", prochainNumeroActe(["UDA-2026-009"], "UDA", 2025));
  assertEgal("SD-2026-001", prochainNumeroActe(["UDA-2026-009"], "SD", 2026));
  assertEgal("SD", prefixeActes(null));
  assertEgal("UDA", prefixeActes({ Acronyme: "uda" }));
});

test("actes : la numérotation prend les actes dans l'ordre chronologique", () => {
  const section = { Acronyme: "UDA" };
  const decisions = [
    { id: 2, Numero_acte: "", Date_du_delibere: "2026-04-02" },
    { id: 1, Numero_acte: "", Date_du_delibere: "2026-02-01" },
    { id: 3, Numero_acte: "UDA-2026-001", Date_du_delibere: "2026-01-05" },
  ];
  const { attributions, restantes } = numeroerActes(decisions, { sectionDe: () => section });
  assertEgal(2, restantes, "deux actes à numéroter");
  assertEgal("2026-02-01", (decisions.find((d) => d.id === 1)).Date_du_delibere);
  // Le plus ancien reçoit le plus petit rang, après le numéro déjà attribué.
  assertEgal("UDA-2026-002", attributions.find((a) => a.id === 1).numero);
  assertEgal("UDA-2026-003", attributions.find((a) => a.id === 2).numero);
});

test("actes : le registre trie les actes numérotés et signale les autres", () => {
  const db = {
    Decisions: [
      { id: 1, Affaire: 1, Numero_acte: "UDA-2026-002", Nature: "Sanction", Libelle_decision: "Blâme", Date_du_delibere: "2026-03-01" },
      { id: 2, Affaire: 1, Numero_acte: "", Nature: "Sanction", Libelle_decision: "Avertissement", Date_du_delibere: "2026-01-01" },
    ],
  };
  const affaires = [{ id: 1, Numero: "2026/001", Nom_complet: "Jean DUPONT" }];
  const { lignes, sansNumero } = registreActes(db, affaires);
  assertEgal(1, lignes.length);
  assertEgal("UDA-2026-002", lignes[0].Numero_acte);
  assertEgal("2026/001", lignes[0].Affaire);
  assertEgal(1, sansNumero.length, "l'acte non numéroté est signalé");
});

/* ------------------------------------------------------------------ */
/* NC-0019 — Les références du répertoire sont vérifiables             */
/* ------------------------------------------------------------------ */

test("références : aucune source du répertoire n'est non retrouvable", () => {
  const { total, nonRetrouvables, references } = referencesDuRepertoire({});
  assert(total > 0, "le répertoire cite des sources");
  assertEgal(0, nonRetrouvables, "aucune source anonymisée dans les références citées");
  assert(references.every((r) => r.considerants.length === r.n && r.n >= 1), "chaque source réunit ses considérants");
  assert(!sourceIdentifiable("CNESERAAV, 11 juill. 2025, M. XXX c. VetAgroSup"), "« M. XXX » n'est pas retrouvable");
  assert(sourceIdentifiable("CE, 17 février 1995, Hardouin et Marie"), "une décision nommée est retrouvable");
  assert(sourceIdentifiable(""), "une absence de source n'est pas un défaut");
});

test("références : les affirmations à vérifier sont listées, et la vérification se date", () => {
  const r = referencesDuRepertoire({}, { verifieLe: "2026-09-21" });
  assert(
    r.aVerifier.some((c) => c.id === "requalification-transposition"),
    "l'affirmation sur la qualité juridique des sections est signalée à vérifier",
  );
  assertEgal("2026-09-21", r.verifieLe, "la date de vérification est conservée");
  assert(
    Object.entries(PARAMS).some(([cle, p]) => cle === "references_verifiees_le" && p.categorie === "Juridique"),
    "la date de vérification est un seuil réglable",
  );
});

/* ------------------------------------------------------------------ */
/* NC-0026 — L'alignement montre ce qu'il va changer                   */
/* ------------------------------------------------------------------ */

test("contenus : le détail d'alignement nomme les lignes et les champs", () => {
  const db = { Sanctions: [{ id: 1, Libelle: "Avertissement", Duree_max_mois: 12 }] };
  const plan = {
    catalogues: [{
      table: "Sanctions",
      ajouts: [{ Libelle: "Blâme", Groupe: "Avertissement et blâme" }],
      modifications: [{ id: 1, avant: { Duree_max_mois: 12 }, apres: { Duree_max_mois: 24 } }],
    }],
    trames: { ajouts: [], modifications: [] },
    formats: [],
  };
  const detail = detailAlignement(plan, db);
  assertEgal(1, detail.ajouts.length, "un ajout");
  assertContient(JSON.stringify(detail.ajouts[0]), "Blâme");
  assertEgal(1, detail.corrections.length, "une correction");
  assertEgal("Avertissement", detail.corrections[0].nom, "la ligne est nommée");
  assertEgal("Durée maximale (mois)", detail.corrections[0].champs[0].champ, "le champ est nommé en français");
  assertEgal("12", detail.corrections[0].champs[0].avant, "valeur actuelle");
  assertEgal("24", detail.corrections[0].champs[0].apres, "valeur livrée");
});

/* ------------------------------------------------------------------ */
/* NC-0005 — L'alignement des contenus livrés                          */
/* ------------------------------------------------------------------ */

test("contenus : une base vide reçoit tout, et devient alignée", () => {
  const db = { Sanctions: [], Motifs: [], Trames: [], Types_Trames: [] };
  const plan = planAlignementContenus(db);
  assert(!planEstVide(plan), "le plan n'est pas vide sur une base vide");
  appliquerPlanContenus(db, plan);
  assert(planEstVide(planAlignementContenus(db)), "après application, plus rien à faire");
  assertEgal(22, db.Sanctions.length, "sanctions installées");
  assertEgal(44, db.Trames.length, "trames installées");
  assertEgal(6, db.Types_Trames.length, "formats installés");
});

test("contenus : réappliquer un plan déjà appliqué ne duplique rien", () => {
  const db = { Sanctions: [], Motifs: [], Trames: [], Types_Trames: [] };
  appliquerPlanContenus(db, planAlignementContenus(db));
  appliquerPlanContenus(db, planAlignementContenus(db));
  assertEgal(22, db.Sanctions.length, "pas de doublon de sanction");
  assertEgal(44, db.Trames.length, "pas de doublon de trame");
});

test("contenus : la signature ne dépend pas de l'ordre des appels", () => {
  assertEgal(signatureContenus(), signatureContenus());
  assert(/^[0-9a-f]{8}$/.test(signatureContenus()), "empreinte hexadécimale");
});

/* ------------------------------------------------------------------ */
/* § 9 — L'en-tête d'un document suit sa feuille de style              */
/* ------------------------------------------------------------------ */

test("en-tête : la position et la taille des deux logos suivent la feuille de style", () => {
  const dbEtat = { Identite: [{ Charte: "Charte de l'État" }] };
  const section = { Marianne: "", Logo: "https://exemple.test/logo.svg" };
  const zone = (html, align) => {
    const m = String(html).match(new RegExp(`<div style="flex: 1; text-align: ${align};">([^]*?)</div>`));
    return m ? m[1] : "";
  };

  // Rien de réglé — ou pas de format : la charte. Le bloc-marque à gauche à sa
  // cote, le logo de l'établissement à droite dans la zone de logotype.
  const charte = enteteHtml(dbEtat, section);
  assertContient(zone(charte, "left"), "République Française", "le bloc-marque à gauche");
  assertContient(zone(charte, "right"), "exemple.test/logo.svg", "le logo à droite");
  assertContient(charte, "27.42mm", "la cote du bloc-marque de la charte");
  assertContient(charte, "max-height: 26mm; max-width: 53mm;", "la zone de logotype du logo");

  // Réglés : chacun change de zone, et de cadre.
  const regle = enteteHtml(dbEtat, section, {
    Marianne_position: "Centre", Marianne_largeur: 40,
    Logo_position: "Gauche", Logo_largeur: 30, Logo_hauteur: 12,
  });
  assertContient(zone(regle, "center"), "République Française", "le bloc-marque au centre");
  assertContient(zone(regle, "left"), "exemple.test/logo.svg", "le logo à gauche");
  assertContient(regle, 'style="width: 40mm; height: auto; max-width: 100%;"', "le bloc-marque à 40 mm");
  assertContient(regle, 'style="width: 30mm; height: 12mm; max-width: 100%;"', "le logo 30 × 12 mm");

  // Une seule cote laisse l'autre suivre, les proportions sont conservées ; une
  // valeur vide, illisible, ou une position inconnue retombent sur la charte.
  const souple = enteteHtml(dbEtat, section, { Logo_hauteur: 14, Marianne_largeur: "" });
  assertContient(souple, 'style="width: auto; height: 14mm; max-width: 100%;"', "le logo haut de 14 mm");
  assertContient(souple, "27.42mm", "le bloc-marque garde sa cote");
  const illisible = enteteHtml(dbEtat, section, { Logo_largeur: "large", Marianne_position: "Partout" });
  assertContient(illisible, "max-height: 26mm; max-width: 53mm;", "le logo garde son cadre");
  assertContient(zone(illisible, "left"), "République Française", "le bloc-marque reste à gauche");
});

/* ------------------------------------------------------------------ */
/* § 4 — Le modèle de données est cohérent                             */
/* ------------------------------------------------------------------ */

test("modèle : chaque table a des colonnes identifiées", () => {
  for (const [nom, def] of Object.entries(SCHEMA)) {
    assert(Array.isArray(def.columns) && def.columns.length, `${nom} doit avoir des colonnes`);
    for (const col of def.columns) assert(col.id, `${nom} : une colonne sans identifiant`);
  }
});

/* ------------------------------------------------------------------ */
/* § 8.28 — La recherche d'un menu déroulant ne change pas sa valeur   */
/* ------------------------------------------------------------------ */
/* Un menu tel que l'outil en porte : une entrée sans valeur en tête, puis des
   libellés réels — accents, casse et espaces compris. */
const MENU = [
  { valeur: "", libelle: "Toutes les sections", vide: true },
  { valeur: "1", libelle: "Section disciplinaire de l'établissement", vide: false },
  { valeur: "2", libelle: "Section disciplinaire académique", vide: false },
  { valeur: "3", libelle: "Élève DUPRÉ, Yanis", vide: false },
  { valeur: "4", libelle: "DUPONT, Marie", vide: false },
  { valeur: "5", libelle: "Bureau des affaires disciplinaires", vide: false },
];

const libelles = (requete) => filtrerOptions(MENU, requete).map((e) => e.option.libelle);

test("recherche : un libellé se retrouve sans accent ni casse", () => {
  assertEgal(plier("Élève DUPRÉ"), "eleve dupre", "accents et casse repliés");
  assertEgal(plier("  Section   disciplinaire  "), "section disciplinaire", "espaces réduits");
  assertEgal(plier(null), "", "une valeur absente ne lève pas");
  assertEgal(plier("Bureau des affaires"), "bureau des affaires", "un libellé sans accent est inchangé");
});

test("recherche : les propositions vont du plus proche au plus lointain", () => {
  // Sans recherche, l'ordre du menu est conservé : la liste ne se réorganise pas
  // sous les yeux au fil des lettres.
  assertEgal(MENU.map((o) => o.libelle), libelles(""), "l'ordre du menu est conservé");
  // « dup » commence un mot chez les deux DUP…, rendus dans l'ordre du menu.
  assertEgal(["DUPONT, Marie", "Élève DUPRÉ, Yanis", "Toutes les sections"], libelles("dup"),
    "les commencements de mot");
  // Un libellé qui **commence** par la requête passe avant celui qui la contient.
  assertEgal(["Section disciplinaire de l'établissement", "Section disciplinaire académique", "Toutes les sections"],
    libelles("section di"), "un début de libellé d'abord");
  // Accents et casse n'y changent rien.
  assertEgal(["Élève DUPRÉ, Yanis", "Toutes les sections"], libelles("eleve dupre"), "sans accent ni casse");
  // Une requête qui ne répond à rien ne rend rien — hors l'entrée sans valeur.
  assertEgal(["Toutes les sections"], libelles("zzz"), "une réponse impossible ne rend rien");
});

test("recherche : l'entrée sans valeur reste proposée, et passe en dernier", () => {
  const estVide = (e) => e.option.vide;
  assert(filtrerOptions(MENU, "").some(estVide), "proposée sans recherche");
  assert(filtrerOptions(MENU, "dup").some(estVide), "proposée pendant une recherche");
  const rangs = libelles("dup");
  assertEgal(rangs[rangs.length - 1], "Toutes les sections", "elle est la dernière proposition");
  // Sans recherche, elle garde la place que le menu lui donne — la première.
  assertEgal(libelles("")[0], "Toutes les sections", "elle reste à sa place sans recherche");
});

test("recherche : chaque proposition désigne son option d'origine", () => {
  for (const entree of filtrerOptions(MENU, "section")) {
    assertEgal(MENU[entree.rangMenu].libelle, entree.option.libelle, "le rang retrouve son option");
  }
});

test("recherche : elle est un ajout, et ne remplace pas les petits menus", () => {
  assert(SEUIL_RECHERCHE >= 5, "le seuil laisse les petits menus natifs");
  assert(SEUIL_RECHERCHE <= 20, "le seuil s'applique aux menus où l'on cherche vraiment");
});

test("réglages : un seuil retiré de l'outil est écarté du document", () => {
  const db = {
    Parametres: [
      { id: 1, Cle: "delai_recours_mois", Nom: "Délai de recours", Categorie: "Délais", Valeur: "2" },
      { id: 2, Cle: "conservation_annees", Nom: "Durée de conservation", Categorie: "Conservation", Valeur: "10" },
      { id: 3, Cle: "sort_final", Nom: "Sort final", Categorie: "Conservation", Valeur: "Versement" },
    ],
  };
  const apres = ensureParametres(db);
  const cles = apres.Parametres.map((p) => p.Cle);
  assert(!cles.includes("conservation_annees"), "un seuil que l'outil ne porte plus est écarté");
  assert(!cles.includes("sort_final"), "un seuil que l'outil ne porte plus est écarté");
  assertEgal(apres.Parametres.find((p) => p.Cle === "delai_recours_mois").Valeur, "2",
    "la valeur réglée par l'établissement n'est pas écrasée");
});

/* ------------------------------------------------------------------ */
/* § 8.30 — La numérotation des articles du dispositif                 */
/* ------------------------------------------------------------------ */

/* L'intitulé d'un article se reconnaît à son **deux-points** : « Article 1er : »,
   « Article 2 : », « Article : » — celui, non numéroté, que les formules
   livrent. Le motif est écrit avec les formules (voir `formules-decision.js`) :
   c'est lui qui fait qu'une citation du code, plus haut dans le raisonnement,
   reste un considérant et ne reçoit pas de numéro. */
test("articles : l'intitulé se reconnaît, la citation du code non", () => {
  assert(estIntituleArticle("Article 1er : Il est prononcé"), "le premier article");
  assert(estIntituleArticle("Article 2 : La présente décision sera notifiée"), "un article numéroté");
  assert(estIntituleArticle("Article : La présente décision n'entraîne pas la nullité"), "un article à numéroter");
  assert(estIntituleArticle("  article 3 : la casse n'y change rien"), "casse et espaces comprises");
  assert(!estIntituleArticle("Article R.811-13 du code de l'éducation prévoit que…"),
    "une citation du code n'est pas un article");
  assert(!estIntituleArticle("Aux termes de l'article R.811-13 du code de l'éducation :"),
    "un considérant qui cite un article non plus");
  assert(!estIntituleArticle("DÉCIDE"), "le dispositif lui-même non plus");
  assert(!estIntituleArticle(""), "un paragraphe vide non plus");
  assert(!estIntituleArticle(null), "une valeur absente ne lève pas");
  assertEgal("Article 1er :", intituleArticle(1), "le premier article est « 1er »");
  assertEgal("Article 2 :", intituleArticle(2), "le deuxième est « 2 »");
  assertEgal("Article 12 :", intituleArticle(12), "et la suite continue");
});

test("articles : chaque formule du dispositif annonce son article", () => {
  const texteNu = (html) => String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const articles = FORMULES.filter((f) => f.groupe === "dispositif" && /class="article"/.test(f.html));
  assert(articles.length >= 10, `les articles livrés sont marqués (${articles.length})`);
  for (const f of articles) {
    assert(/<u>/.test(f.html), `« ${f.label} » souligne son intitulé`);
    assert(estIntituleArticle(texteNu(f.html)), `« ${f.label} » annonce son article`);
  }
  // Ce qui n'est pas un article ne porte pas la marque : le « DÉCIDE », le
  // « Fait à… », les signatures — la numérotation ne les touchera pas.
  for (const f of FORMULES.filter((x) => x.groupe === "dispositif" && !/class="article"/.test(x.html))) {
    assert(!estIntituleArticle(texteNu(f.html)), `« ${f.label} » n'est pas un article`);
  }
});

/* ------------------------------------------------------------------ */
/* § 8.31 — Les primitives d'interface : une icône, une classe         */
/* ------------------------------------------------------------------ */

/* `icon(name, extra)` reçoit le plus souvent une **classe** en `extra` : la
   marge qui sépare l'icône de son libellé (`fr-mr-1v`), ou le repère d'une ligne
   de liste (`app-list__go`). Émise en second attribut `class`, elle était
   ignorée par le navigateur — l'icône se collait donc à son libellé dans tous
   les boutons de l'outil, et le repère « ouvrir » gardait le ton du texte au
   lieu du gris des mentions (voir `SPEC.md`, invariant 31). La primitive la
   fusionne désormais avec la classe du jeu d'icônes. */
test("icônes : la classe passée s'ajoute, une seule fois", () => {
  const marge = icon("alert-line", 'class="fr-mr-1v"');
  assertEgal(1, (marge.match(/class=/g) || []).length, "un seul attribut class");
  assertContient(marge, "fr-icon-alert-line", "l'icône du jeu est nommée");
  assertContient(marge, "fr-mr-1v", "et porte la classe demandée");
  const repere = icon("arrow-right-line", 'class="app-list__go" aria-hidden="true"');
  assertContient(repere, "app-list__go", "le repère d'une ligne de liste est posé");
  assertEgal(1, (repere.match(/aria-hidden/g) || []).length, "l'aria-hidden n'est pas redit");
  assertEgal('<span class="fr-icon-calendar-line" aria-hidden="true"></span>', icon("calendar-line"),
    "sans extra, la primitive rend exactement le span du jeu");
  assertEgal("<svg></svg>", icon("<svg></svg>"), "un dessin écrit sur place est rendu tel quel");
  assertContient(icon(null), "fr-icon-", "un nom absent ne lève pas");
});

/* ------------------------------------------------------------------ */
/* § 8.41 — Une écriture non envoyée survit au rechargement             */
/* ------------------------------------------------------------------ */

test("file d'attente : la reprise rejoue l'intact et écarte le conflit", () => {
  const db = { Types_Trames: [{ id: 2, Feuille_de_style: "A" }, { id: 3, Feuille_de_style: "B" }] };
  const actions = [
    { type: "update", table: "Types_Trames", id: 2, patch: { Feuille_de_style: "A2" }, old: { Feuille_de_style: "A" } },
    { type: "update", table: "Types_Trames", id: 3, patch: { Feuille_de_style: "B2" }, old: { Feuille_de_style: "B" } },
    { type: "update", table: "Types_Trames", id: 9, patch: { Feuille_de_style: "X" }, old: { Feuille_de_style: "" } },
    { type: "update", table: "Types_Trames", id: 3, patch: { Nom: "N" } },
    { type: "add", table: "Types_Trames", id: -1, data: { id: -1, Nom: "Neuf" } },
    { type: "delete", table: "Types_Trames", id: 2 },
    { type: "bidouille" },
  ];
  db.Types_Trames.find((r) => r.id === 3).Feuille_de_style = "B-modifiee";
  const { rejouables, conflits } = classerReprises(actions, db);
  assertEgal([2, 3, -1, 2], rejouables.map((a) => a.id ?? a.data?.id), "intact, sans image, ajout et suppression rejoués");
  assertEgal([3, 9, undefined], conflits.map((a) => a.id), "modifiée depuis, disparue et inconnue écartées");
});

test("file d'attente : vide et image vide ne font rien", () => {
  assertEgal({ rejouables: [], conflits: [] }, classerReprises([], {}), "rien à trier");
  assertEgal({ rejouables: [], conflits: [] }, classerReprises(null, null), "rien à trier non plus");
  const db = { Types_Trames: [{ id: 2, Feuille_de_style: "" }] };
  const { rejouables } = classerReprises(
    [{ type: "update", table: "Types_Trames", id: 2, patch: { Feuille_de_style: "" }, old: { Feuille_de_style: "" } }], db);
  assertEgal(1, rejouables.length, "une chaîne vide restée vide est intacte");
});
