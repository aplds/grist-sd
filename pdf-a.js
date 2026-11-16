// Conversion des PDF exportés au format **PDF/A-2b**.
//
// Le PDF produit par la bibliothèque de mise en page est un PDF ordinaire : son
// texte est sélectionnable et ses polices sont embarquées, mais rien ne dit
// qu'il est fait pour durer. Le format PDF/A est celui de l'archivage — la
// copie qui reste lisible dans vingt ans, sur un poste qui n'a plus ni la
// police ni le logiciel qui l'a produite. Trois choses lui suffisent, et c'est
// tout ce que fait ce module :
//
//  - **un profil de sortie** : le PDF/A doit dire dans quel espace de couleur il
//    est écrit. C'est un profil ICC sRGB, déposé dans le catalogue sous
//    `/OutputIntents` (l'intention « GTS_PDFA1 ») ;
//  - **des métadonnées XMP** : le même document dit, dans ses métadonnées, qu'il
//    est un PDF/A — `pdfaid:part` et `pdfaid:conformance` —, en accord avec son
//    dictionnaire d'informations (titre, auteur, date, producteur) ;
//  - **une langue** : `/Lang`, exigée du catalogue par la norme.
//
// Le reste du travail est fait en amont : polices embarquées (voir
// `pdf-fonts.js`), pas de chiffrement, pas de fichier extérieur. Le profil ICC
// est celui de `Compact-ICC-Profiles` (saucecontrol), publié sous CC0 — domaine
// public, et fait pour être embarqué ainsi.
//
// Le profil est en clair ici, sous forme base64 : 456 octets, le plus court
// profil sRGB qui porte tout ce qu'exige la norme (description, copyright,
// point blanc, matrice des primaires, courbes de transfert).

import { DEPENDANCES, chargerModule } from "./dependances.js";

const PROFIL_SRGB_BASE64 =
    "AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwA"
  +   "AAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAA"
  +   "AAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZ"
  +   "WgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABg"
  +   "YlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAA"
  +   "AAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZ"
  +   "WiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U"
  +   "9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//";

/** Octets d'un texte base64. */
function octetsBase64(texte) {
  const binaire = atob(texte);
  const out = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) out[i] = binaire.charCodeAt(i);
  return out;
}

/** Échappement XML des valeurs portées par les métadonnées. */
function escXml(valeur) {
  return String(valeur ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]
  ));
}

/** Date XMP (ISO 8601 avec fuseau), depuis une date JavaScript. */
function dateXmp(date) {
  const p = (n) => String(n).padStart(2, "0");
  const decalage = -date.getTimezoneOffset();
  const signe = decalage >= 0 ? "+" : "-";
  const heures = p(Math.floor(Math.abs(decalage) / 60));
  const minutes = p(Math.abs(decalage) % 60);
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T`
    + `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}${signe}${heures}:${minutes}`;
}

/**
 * Métadonnées XMP du document : l'identité du fichier, et sa conformité au
 * format. Elles sont tenues **identiques** au dictionnaire d'informations du
 * PDF, comme la norme l'impose — un validateur compare les deux.
 */
function metadonneesXmp({ titre, auteur, producteur, date }) {
  const quand = dateXmp(date);
  // L'auteur n'est écrit que s'il y en a un : une liste vide n'apprendrait rien
  // à un validateur, sinon que le fichier a été produit par un outil.
  const createur = auteur
    ? `      <dc:creator><rdf:Seq><rdf:li>${escXml(auteur)}</rdf:li></rdf:Seq></dc:creator>\n`
    : "";
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>2</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escXml(titre)}</rdf:li></rdf:Alt></dc:title>
${createur}      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">Document produit par Gestion des sections disciplinaires.</rdf:li></rdf:Alt></dc:description>
      <dc:format>application/pdf</dc:format>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${escXml(producteur)}</xmp:CreatorTool>
      <xmp:CreateDate>${quand}</xmp:CreateDate>
      <xmp:ModifyDate>${quand}</xmp:ModifyDate>
      <xmp:MetadataDate>${quand}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${escXml(producteur)}</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Rend un PDF ordinaire conforme au format PDF/A-2b, et renvoie ses octets.
 *
 * `meta` porte le titre du document, son auteur éventuel, et le nom du
 * producteur — l'outil. L'échec de cette conversion ne doit pas coûter le
 * document à son auteur : l'appelant reçoit le PDF d'origine si la
 * bibliothèque manque, plutôt qu'une erreur.
 */
export async function versPdfA(octets, meta = {}) {
  const { PDFDocument, PDFName, PDFString, PDFHexString } = await chargerModule(DEPENDANCES.pdflib, "la conversion au format d'archivage PDF/A");
  const pdf = await PDFDocument.load(octets, { updateMetadata: false });
  const date = meta.date instanceof Date ? meta.date : new Date();
  const titre = String(meta.titre || "Document");
  const auteur = String(meta.auteur || "");
  const producteur = String(meta.producteur || "Gestion des sections disciplinaires");

  // La langue du document : le français, langue de la procédure.
  pdf.catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));

  // L'intention de sortie : l'espace de couleur dans lequel le fichier est
  // écrit, et le profil qui le décrit.
  const profil = pdf.context.register(pdf.context.flateStream(octetsBase64(PROFIL_SRGB_BASE64), { N: 3 }));
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([{
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFA1"),
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: profil,
  }]));

  // Les métadonnées XMP, et le dictionnaire d'informations qui les répète.
  const xmp = pdf.context.register(pdf.context.stream(metadonneesXmp({ titre, auteur, producteur, date }), {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  }));
  pdf.catalog.set(PDFName.of("Metadata"), xmp);
  pdf.setTitle(titre);
  if (auteur) pdf.setAuthor(auteur);
  pdf.setSubject("Document produit par Gestion des sections disciplinaires.");
  pdf.setCreator(producteur);
  pdf.setProducer(producteur);
  pdf.setCreationDate(date);
  pdf.setModificationDate(date);

  // L'identifiant du fichier, exigé au trait : les deux moitiés sont ici la
  // même empreinte, tirée du contenu — le document n'a pas de « numéro de
  // version » à distinguer.
  const empreinte = PDFHexString.of(empreinteFichier(octets));
  pdf.context.trailerInfo.ID = pdf.context.obj([empreinte, empreinte]);

  return pdf.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
}

/** Empreinte du fichier, pour l'identifiant du PDF : 32 chiffres hexadécimaux. */
function empreinteFichier(octets) {
  // FNV-1a sur 128 bits, en quatre mots : suffisant pour distinguer deux
  // fichiers, sans dépendre de l'API cryptographique du navigateur — qui n'est
  // pas disponible hors d'un contexte sécurisé.
  const graines = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  const empreintes = graines.map((graine) => {
    let h = graine >>> 0;
    for (let i = 0; i < octets.length; i += 1) {
      h ^= octets[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  });
  return empreintes.join("");
}
