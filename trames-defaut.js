// Trames et types de trames livrés par défaut.
//
// Ce fichier est la **source des modèles de documents** installés dans une base
// neuve : le jeu d'exemple (mode autonome) et le premier branchement d'un
// document Grist y puisent tous deux (voir `ensureTramesParDefaut` de
// `store.js`). Il n'est jamais réécrit par l'utilisateur : dès qu'une trame est
// modifiée dans « Réglages › Trames », c'est la base qui fait foi.
//
// **Le format, l'auteur et le destinataire sont trois choses distinctes.**
//
//  - Le **format** (`Types_Trames`) *est* la feuille de style : un `Courrier`,
//    une `Attestation`, un `Rapport` d'instruction, une `Ordonnance` de
//    président, ou une `Décision` de la formation de jugement. Il porte
//    un seul document — son
//    en-tête (identité de la section et destinataire), son chapeau, sa
//    signature et son pied de page répété — écrit d'un bout à l'autre dans
//    `Feuille_de_style`, et **un emplacement unique**, `{{Corps}}`, où vient
//    s'insérer le texte de la trame. Ses variables `{…}` sont génériques :
//    `{destinataire}`, `{adresse}`, `{f_emetteur}`, `{nom_emetteur}`… que la
//    trame et l'affaire remplissent. Un format suffit donc à toutes les trames
//    d'un même genre. Les actes **rendus** se distinguent par l'**organe qui
//    décide** (`Organe`) — la section disciplinaire est l'organe lui-même
//    (organe administratif pour les usagers, juridiction pour les
//    enseignants-chercheurs), et la commission de discipline en est la chambre,
//    sa formation de jugement :
//      · « Président de la section disciplinaire » — il compose la formation,
//        remplace un membre empêché, désigne les rapporteurs ou la commission
//        d'instruction : son acte est une **ordonnance**, nécessairement
//        avant dire droit ;
//      · « Président de la formation de jugement » — le président de la
//        commission de discipline, qui ne porte ce nom que devant les usagers
//        (date de la séance, complément d'instruction…) : son acte est lui
//        aussi une **ordonnance**, nécessairement avant dire droit ;
//      · « Formation de jugement » — la chambre réunie : sa **décision** peut
//        être avant dire droit comme définitive, et une affaire peut en
//        comporter autant qu'il est nécessaire. Le président de la formation
//        et le secrétaire la signent l'un et l'autre.
//  - La **trame** **hérite** de la feuille de style de son format : son
//    `Template_contenu` n'est que le **corps** du document, sans aucune balise
//    de mise en page. Une trame peut **adapter** la feuille de style de son
//    format — colonne `Feuille_de_style`, vide tant qu'elle l'hérite — quand un
//    document a besoin d'une entête ou d'une signature à lui :
//    `feuilleEffective` (`render.js`) donne alors la sienne à la place.
//  - La **trame** déclare son **auteur** (`Auteur`) — qui la rédige et la
//    signe — et, pour un courrier ou une attestation, son **destinataire**
//    (`Destinataire`). Programmer ces deux qualités sur la trame **allège
//    l'espace de rédaction** : le rédacteur n'a plus à choisir un émetteur ni
//    un destinataire, ils découlent de la trame (voir `src/redaction.js`).
//
// Chaque trame déclare en outre la **procédure** à laquelle elle s'applique :
//
//  - `Public` : « Usagers », « Enseignants-chercheurs », ou « Les deux » ;
//  - `Tutelle` : « Toutes », « Enseignement supérieur » ou « Agriculture » ;
//  - `Type_de_section` : « Toutes », ou le type de section visé.
//
// Une valeur vide, « Toutes » ou « Les deux » vaut pour toutes les procédures.
//
// **Reprise des bases antérieures.** `migrerFeuilles` (`schema.js`) ramène une
// base antérieure aux formats ci-dessus : les onze anciens types
// (`ANCIENS_TYPES_TRAMES`) sont réunis, les blocs d'un format (`En_tete`,
// `Signature`, `Pied_de_page`) sont cousus en une **feuille de style unique**
// autour de `{{Corps}}`, les balises de mise en page — devenues sans objet —
// sont retirées du corps des trames, et une trame **propre à l'établissement**
// (identifiant inconnu) reçoit, à partir de son ancien type, l'auteur et le
// destinataire qui lui correspondent (`ANCIEN_DEFAUT`), sans que son texte soit
// touché. Le format livré des actes du président, qui réunissait les deux
// organes, devient celui du **président de la section** — et les deux formats
// du président prennent le nom d'**ordonnance**, que les textes leur donnent :
// le président règle la marche de l'instance, il ne « décide » pas. Les trames
// livrées que leur modèle destine au **président de la formation de jugement**
// rejoignent le format livré qui leur revient (`deplacementsTramesPresident`,
// `schema.js`), dès que « Installer les trames par défaut » l'a ajouté à la base.
//
// **Les visas des ordonnances** — la formule d'ouverture, les textes visés et la
// saisine — sont portés par la **feuille de style de leur format**, et non par le
// corps de chaque trame : c'est le format qui est commun aux ordonnances d'un
// même organe, et c'est donc lui qui doit en porter les mentions, une fois pour
// toutes. La feuille dit ainsi, avant `{{Corps}}` : `{f_ouverture}` — « Le
// président de la section disciplinaire » —, le code de l'éducation,
// `{visa_code_rural}` (le code rural et de la pêche maritime, que seule la
// tutelle agricole appelle : la variable se remplit selon la section), et la
// saisine de la section, datée et dirigée contre le mis en cause. Le corps des
// trames commence donc par le raisonnement — « Considérant ce qui suit : » — et
// se termine par le dispositif ; les décisions de la formation de jugement, elles,
// gardent leurs visas dans leur corps, où ils suivent les circonstances de
// l'audience. `migrerOrdonnances` (`schema.js`) entre ces visas dans la feuille
// d'une base antérieure et en retire l'ouverture restée dans le corps ; c'est
// aussi lui qui range la trame livrée « Composition de la formation de jugement »
// (n° 35) avec les **ordonnances** : la constitution de la formation n'est pas une
// compétence de la formation elle-même, mais du président de la section.
//
// **Titres et typographie.** Aucun modèle ne porte de balise `<h1>`–`<h6>` : la
// taille d'un titre viendrait alors de la charte graphique, la barre d'outils ne
// permettrait pas de la régler, et l'auteur ne pourrait ni la connaître ni la
// corriger. Un titre est donc un paragraphe à `font-size` explicite, prise dans
// l'échelle de la barre d'outils (8 à 28 pt) : 14 pt pour un titre de document —
// l'en-tête de service, le « ORDONNE » d'une ordonnance, le « DÉCIDE » d'une
// décision, le titre d'un rapport — et
// 12 pt, la taille du corps, pour un titre de plan. La couleur vient de la
// palette (le noir `#161616`), le gras de `<strong>`, et l'alignement est un
// style **en ligne** — jamais une classe `ql-align-*`, que la barre d'outils ne
// voit pas non plus. Les titres écrits avant la refonte sont repris par
// `migrerTitres` (`schema.js`), à partir des formes décrites par `TITRES_LIVRES`
// ci-dessous.
//
// Le corps des trames a été nettoyé des marqueurs d'espacement (« S », « TAB »,
// « SPACER ») qui servaient à l'ancienne limitation technique du tableur
// d'origine : des portions de texte invisibles, sans effet à l'impression mais
// encombrant l'édition.

export const TYPES_TRAMES_PAR_DEFAUT = [
 {
  "id": 1,
  "Nom": "Courrier",
  "Categorie": "Courrier",
  "Organe": "",
  "Feuille_de_style": "<div style=\"display: flex; width: 100%; margin: 0 0 20px 0; padding: 0; background-color: white;\">\n    <!-- Colonne de gauche (60% de la largeur) : l'identite de la section -->\n    <div style=\"width: 60%; padding: 0; margin: 0; text-align: left;\">\n        <p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE<br />COMP&Eacute;TENTE &Agrave; L&rsquo;&Eacute;GARD<br />DES {nature_section}</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;tariat<br />{sec_rue}<br />{sec_ville}<br /><a href=\"mailto:{mail_sd}\">{mail_sd}</a>&nbsp;</p>\n    </div>\n    <!-- Colonne de droite (40% de la largeur) : le destinataire, programme sur la trame -->\n    <div style=\"width: 40%; padding: 0; margin: 0; text-align: right;\">\n        <div><em>{ville}, le {date_formatee}</em></div>\n        <div style=\"margin-bottom: 20px;\"></div>\n        <div>{formule_destinataire}<br /><strong>{destinataire}</strong></div>\n        <div>{adresse}</div>\n    </div>\n</div>\n\n{{Corps}}\n\n<div class=\"signature\">\n    <p style=\"text-align: right; margin: 0;\"><strong>{f_emetteur},</strong></p>\n    <br /><br /><br />\n    <p style=\"text-align: right; margin: 0;\"><strong>{nom_emetteur}</strong></p>\n</div>\n<div class=\"print-footer\">\n<div style=\"display: flex; text-align: left;\"><strong><span class=\"footer-text\"> {structure_nom_complet}<br /> </span></strong></div>\n</div>",
  "Numeroter_pages": 0
 },
 {
  "id": 2,
  "Nom": "Attestation",
  "Categorie": "Attestation",
  "Organe": "",
  "Feuille_de_style": "<div style=\"display: flex; width: 100%; margin: 0 0 20px 0; padding: 0; background-color: white;\">\n    <!-- Une attestation s'adresse comme un courrier : meme feuille de style, le propos du document seul differe -->\n    <div style=\"width: 60%; padding: 0; margin: 0; text-align: left;\">\n        <p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE<br />COMP&Eacute;TENTE &Agrave; L&rsquo;&Eacute;GARD<br />DES {nature_section}</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;tariat<br />{sec_rue}<br />{sec_ville}<br /><a href=\"mailto:{mail_sd}\">{mail_sd}</a>&nbsp;</p>\n    </div>\n    <div style=\"width: 40%; padding: 0; margin: 0; text-align: right;\">\n        <div><em>{ville}, le {date_formatee}</em></div>\n        <div style=\"margin-bottom: 20px;\"></div>\n        <div>{formule_destinataire}<br /><strong>{destinataire}</strong></div>\n        <div>{adresse}</div>\n    </div>\n</div>\n\n{{Corps}}\n\n<div class=\"signature\">\n    <p style=\"text-align: right; margin: 0;\"><strong>{f_emetteur},</strong></p>\n    <br /><br /><br />\n    <p style=\"text-align: right; margin: 0;\"><strong>{nom_emetteur}</strong></p>\n</div>\n<div class=\"print-footer\">\n<div style=\"display: flex; text-align: left;\"><strong><span class=\"footer-text\"> {structure_nom_complet}<br /> </span></strong></div>\n</div>",
  "Numeroter_pages": 0
 },
 {
  "id": 3,
  "Nom": "Ordonnance du président de la section disciplinaire",
  "Categorie": "Ordonnance",
  "Organe": "Président de la section disciplinaire",
  "Feuille_de_style": "<div style=\"display: flex; width: 100%; margin: 0 0 20px 0; background-color: white;\">\n    <div style=\"width: 60%; padding: 0; margin: 0; text-align: left;\">\n        <p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE<br />COMP&Eacute;TENTE &Agrave; L&rsquo;&Eacute;GARD<br />DES {nature_section}</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;tariat<br />{sec_rue}<br />{sec_ville}<br /><a href=\"mailto:{mail_sd}\">{mail_sd}</a>&nbsp;</p>\n    </div>\n    <div style=\"width: 40%; padding: 0; margin: 0; text-align: right;\">\n        <div><em>{acte_type} du {date_formatee}</em></div>\n        <div style=\"margin-bottom: 10px;\"></div>\n        <div>Dossier n&deg; : {numero} - {mec_nom}<br /><em>(&agrave; rappeler dans toutes correspondances)</em></div>\n    </div>\n</div>\n\n<p style=\"text-align: justify;\"><strong>{f_ouverture},</strong></p>\n<p style=\"text-align: justify;\"><strong>Vu</strong> le code de l'éducation ;</p>\n{visa_code_rural}\n<p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {date_de_saisine} contre {mec_formule} {mec_nom} ;</p>\n\n{{Corps}}\n\n<div class=\"signature\">\n    <p style=\"text-align: center; margin: 0;\"><strong>{f_emetteur},</strong></p>\n    <br /><br /><br />\n    <p style=\"text-align: center; margin: 0;\"><strong>{nom_emetteur}</strong></p>\n</div>",
  "Numeroter_pages": 0
 },
 {
  "id": 6,
  "Nom": "Ordonnance du président de la formation de jugement",
  "Categorie": "Ordonnance",
  "Organe": "Président de la formation de jugement",
  "Feuille_de_style": "<div style=\"display: flex; width: 100%; margin: 0 0 20px 0; background-color: white;\">\n    <div style=\"width: 60%; padding: 0; margin: 0; text-align: left;\">\n        <p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE<br />COMP&Eacute;TENTE &Agrave; L&rsquo;&Eacute;GARD<br />DES {nature_section}</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;tariat<br />{sec_rue}<br />{sec_ville}<br /><a href=\"mailto:{mail_sd}\">{mail_sd}</a>&nbsp;</p>\n    </div>\n    <div style=\"width: 40%; padding: 0; margin: 0; text-align: right;\">\n        <div><em>{acte_type} du {date_formatee}</em></div>\n        <div style=\"margin-bottom: 10px;\"></div>\n        <div>Dossier n&deg; : {numero} - {mec_nom}<br /><em>(&agrave; rappeler dans toutes correspondances)</em></div>\n    </div>\n</div>\n\n<p style=\"text-align: justify;\"><strong>{f_ouverture},</strong></p>\n<p style=\"text-align: justify;\"><strong>Vu</strong> le code de l'éducation ;</p>\n{visa_code_rural}\n<p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {date_de_saisine} contre {mec_formule} {mec_nom} ;</p>\n\n{{Corps}}\n\n<div class=\"signature\">\n    <p style=\"text-align: center; margin: 0;\"><strong>{f_emetteur},</strong></p>\n    <br /><br /><br />\n    <p style=\"text-align: center; margin: 0;\"><strong>{nom_emetteur}</strong></p>\n</div>",
  "Numeroter_pages": 0
 },
 {
  "id": 4,
  "Nom": "Décision de la formation de jugement",
  "Categorie": "Décision",
  "Organe": "Formation de jugement",
  "Feuille_de_style": "<div style=\"display: flex; width: 100%; margin: 0 0 20px 0; background-color: white;\">\n    <div style=\"width: 60%; padding: 0; margin: 0; text-align: left;\">\n        <p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE<br />COMP&Eacute;TENTE &Agrave; L&rsquo;&Eacute;GARD<br />DES {nature_section}</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;tariat<br />{sec_rue}<br />{sec_ville}<br /><a href=\"mailto:{mail_sd}\">{mail_sd}</a>&nbsp;</p>\n        <p style=\"margin: 0;\">&nbsp;</p>\n        <p style=\"margin: 0;\"><strong>{commission_president},</strong></p>\n        <p style=\"margin: 0;\">Pr&eacute;sident</p>\n        <p style=\"margin: 0;\">&nbsp;</p>\n        <p style=\"margin: 0;\"><strong>{rapporteur},</strong></p>\n        <p style=\"margin: 0;\">Rapporteur</p>\n        <p style=\"margin: 0;\">&nbsp;</p>\n        <p style=\"margin: 0;\"><strong>{secretaire},</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;taire<br /><br /></p>\n    </div>\n    <div style=\"width: 40%; padding: 0; margin: 0; text-align: right;\">\n        <div><strong>D&eacute;cision du {date_formatee}</strong></div>\n        <div style=\"margin-bottom: 10px;\">&nbsp;Affaire n&deg;{numero}<br /><br /></div>\n    </div>\n</div>\n\n{{Corps}}\n\n<div class=\"signature-container\" style=\"display: flex; justify-content: space-between; width: 100%; margin-top: 50px;\">\n    <div class=\"signature-block\" style=\"width: 48%; text-align: center;\">\n        <div class=\"signature-line\" style=\"width: 200px; margin: 0 auto; padding-top: 5px;\">\n            <div><strong>{f_emetteur},</strong></div>\n            <div><strong>{nom_emetteur}</strong></div>\n        </div>\n    </div>\n    <div class=\"signature-block\" style=\"width: 48%; text-align: center;\">\n        <div class=\"signature-line\" style=\"width: 200px; margin: 0 auto; padding-top: 5px;\">\n            <div><strong>Le secr&eacute;taire,</strong></div>\n            <div><strong>{secretaire}</strong></div>\n        </div>\n    </div>\n</div>",
  "Numeroter_pages": 0
 },
 {
  "id": 5,
  "Nom": "Rapport d'instruction",
  "Categorie": "Rapport",
  "Organe": "",
  "Feuille_de_style": "<div style=\"display: flex; width: 100%; margin: 0 0 20px 0; background-color: white;\">\n    <div style=\"width: 60%; padding: 0; margin: 0; text-align: left;\">\n        <p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE<br />COMP&Eacute;TENTE &Agrave; L&rsquo;&Eacute;GARD<br />DES {nature_section}</strong></p>\n        <p style=\"margin: 0;\">Secr&eacute;tariat<br />{sec_rue}<br />{sec_ville}<br /><a href=\"mailto:{mail_sd}\">{mail_sd}</a>&nbsp;</p>\n    </div>\n    <div style=\"width: 40%; padding: 0; margin: 0; text-align: right;\">\n        <div><em>Rapport du {date_formatee}</em></div>\n        <div style=\"margin-bottom: 10px;\"></div>\n        <div>Dossier n&deg; : {numero} - {mec_nom}<br /><em>(&agrave; rappeler dans toutes correspondances)</em></div>\n    </div>\n</div>\n\n{{Corps}}\n\n<div class=\"signature\">\n    <p style=\"text-align: right; margin: 0;\"><strong>{f_emetteur},</strong></p>\n    <br /><br /><br />\n    <p style=\"text-align: right; margin: 0;\"><strong>{nom_emetteur}</strong></p>\n</div>\n<div class=\"print-footer\">\n<div style=\"display: flex; text-align: left;\"><strong><span class=\"footer-text\"> {structure_nom_complet}<br /> </span></strong></div>\n</div>",
  "Numeroter_pages": 0
 },
];


/**
 * Feuille de style d'un format qui vient d'être créé : le strict nécessaire.
 *
 * Un format neuf n'a pas encore d'identité visuelle ; il lui faut pourtant de
 * quoi produire une pièce lisible — l'emplacement du texte de ses trames, une
 * signature et un pied de page portant le nom de la structure. L'auteur écrit
 * autour. Les formats livrés, eux, portent leur document complet (voir
 * `TYPES_TRAMES_PAR_DEFAUT`).
 */
export const FEUILLE_VIERGE = [
  "<p style=\"text-align: center; margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE</strong></p>",
  "<p style=\"margin: 0;\">&nbsp;</p>",
  "<p>{ville}, le {date_formatee}</p>",
  "{{Corps}}",
  "<div class=\"signature\">",
  "  <p style=\"text-align: right; margin: 0;\"><strong>{f_emetteur},</strong></p>",
  "  <br /><br /><br />",
  "  <p style=\"text-align: right; margin: 0;\"><strong>{nom_emetteur}</strong></p>",
  "</div>",
  "<div class=\"print-footer\">",
  "  <div style=\"display: flex; text-align: left;\"><strong><span class=\"footer-text\"> {structure_nom_complet}<br /> </span></strong></div>",
  "</div>",
].join("\n");


/**
 * Les **titres livrés**, dans leur forme d'avant la refonte typographique : un
 * `<h3>`, dont la taille venait de la charte graphique — 24 px, une fois et
 * demie le corps du document — et que la barre d'outils ne voyait pas : ses
 * menus ne montrent que les styles **en ligne**, si bien que l'auteur de
 * l'en-tête de service ne pouvait ni connaître ni régler la taille de son titre.
 *
 * Chaque titre devient un paragraphe à taille explicite, prise dans l'échelle de
 * la barre d'outils (8 à 28 pt) : 14 pt pour un titre de document — l'en-tête de
 * service, le « DÉCIDE » d'une décision, le « ORDONNE » d'une ordonnance, le
 * titre d'un rapport —, et 12 pt, la
 * taille du corps, pour un titre de plan de rapport. L'alignement, hérité de
 * l'éditeur d'origine sous forme de classe `ql-align-*`, devient le style en
 * ligne que la barre d'outils sait lire.
 *
 * Ces formes anciennes sont reprises par `migrerTitres` (schema.js) sur une base
 * antérieure : la substitution ne touche **que** ces balises-là, et rien d'autre
 * du texte — celui de l'établissement compris. Les modèles ci-dessus portent,
 * eux, directement la forme actuelle.
 */
export const TITRES_LIVRES = [
  // L'en-tête de service, en tête des feuilles de style
  [/<h3 style="margin: 0;"><strong>SECTION DISCIPLINAIRE([\s\S]*?)<\/h3>/g,
    "<p style=\"margin: 0; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>SECTION DISCIPLINAIRE$1</p>"],
  // Le titre d'un rapport d'instruction
  [/<p class="ql-align-center"><strong>RAPPORT D&#39;INSTRUCTION<\/strong><\/p>/g,
    "<p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>RAPPORT D&#39;INSTRUCTION</strong></p>"],
  // Le « DÉCIDE » d'une décision, centre de l'acte
  [/<h3[^>]*><strong>DÉCIDE<\/strong><\/h3>/g,
    "<p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p>"],
  // Le « ORDONNE » d'une ordonnance, qui a remplacé « DÉCIDE » au dispositif
  // des actes du président
  [/<h3[^>]*><strong>ORDONNE<\/strong><\/h3>/g,
    "<p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p>"],
  // Les titres de plan d'un rapport : ceux qui restent
  [/<h3[^>]*>([^<]*)<\/h3>/g,
    "<p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>$1</strong></p>"],
  // L'alignement de l'éditeur d'origine : une classe, que la barre d'outils ne
  // voit pas, devient le style en ligne qu'elle lit — la conversion que le rendu
  // fait déjà à l'affichage (voir `render.js`). Une classe change à **chaque**
  // occurrence : le motif est donc global.
  [/ class="ql-align-center"/g, " style=\"text-align: center;\""],
  [/ class="ql-align-justify"/g, " style=\"text-align: justify;\""],
  [/ class="ql-align-right"/g, " style=\"text-align: right;\""],
  [/ class="ql-align-left"/g, " style=\"text-align: left;\""],
];

export const TRAMES_PAR_DEFAUT = [
 {
  "id": 1,
  "Nom": "Lettre de saisine",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire",
  "Objet": "Saisine de la section disciplinaire",
  "Public": "Usagers",
  "Tutelle": "Agriculture",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{Affaire_Section}}.Formule_complete,</p><p style=\"text-align: justify;\">Conformément aux dispositions des articles R.812-24-1 du code rural et de la pêche maritime et R.811-25 du code de l’éducation, j’ai l’honneur de vous informer que je saisis la section disciplinaire que vous présidez, afin d’instruire l’affaire :</p><p style=\"text-align: justify;\"><strong>Nom, prénom de l’usager mis en cause : </strong>{{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><strong>Né le :</strong> {{Affaire_Date_de_naissance}}.date(@long)</p><p style=\"text-align: justify;\"><strong>Domicilié(e) à :</strong> {{Affaire}}.Adresse</p><p style=\"text-align: justify;\"><strong>Numéro INE : </strong>{{Affaire}}.INE</p><p style=\"text-align: justify;\"><strong>Diplôme préparé : </strong>{{Affaire}}.Formation_suivie</p><p style=\"text-align: justify;\"><strong>Motifs :</strong></p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">Vous trouverez joint au présent courrier l&#39;ensemble des éléments justifiant cette saisine.</p>"
 },
 {
  "id": 2,
  "Nom": "Information concernant la saisine (Mis en cause)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause",
  "Objet": "Saisine de la section disciplinaire à votre encontre",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Par courrier du {{Affaire_Date_de_saisine}}.date(@long), <strong>la section disciplinaire de l&#39;{{Affaire_Section}}.Structure compétente à l&#39;égard des usagers</strong> a été saisie afin d&#39;instruire des faits vous concernant.</p><p style=\"text-align: justify;\">Ces faits sont :</p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">Conformément à l&#39;article R.811-27 du code de l&#39;éducation, je vous informe que vous disposez <strong>d&#39;un délai de {{Champ_libre}} jours</strong> afin de présenter des observations écrites. Vous pouvez également <strong>demander à être entendu</strong> par les rapporteurs chargés de l&#39;instruction du dossier, et prendre connaissance de votre dossier durant le déroulement de cette instruction.</p><p style=\"text-align: justify;\">Vous disposez également du <u>droit de vous taire durant toute la durée de la procédure</u>, et pouvez vous faire <u>assister ou représenter par le conseil de votre choix.</u></p><p style=\"text-align: justify;\">Je vous prie d&#39;agréer, {{Affaire}}.Formule, l&#39;expression de mes salutations distinguées.</p>"
 },
 {
  "id": 3,
  "Nom": "Composition de la commission de discipline (établissement agricole)",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Composition de la commission de discipline",
  "Public": "Usagers",
  "Tutelle": "Agriculture",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l&#39;article R.812-24-6 du code rural et de la pêche maritime : «<em> Les affaires sont examinées par une commission de discipline. / Le président de la section disciplinaire désigne les membres de la commission de discipline selon un rôle qu&#39;il établit. La commission comprend dix membres, dont le président de la section disciplinaire qui la préside, un membre appartenant au collège défini au 1° de l&#39;article R. 812-24-3, deux membres appartenant au collège définis au 2°, un membre appartenant au collège défini au 3° et cinq membres appartenant au collège défini au 4° du même article. (...) </em>»</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> Une commission de discipline présidée par {{Affaire}}.C_President est instituée afin d&#39;examiner l&#39;affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> La commission est composée des membres suivants : {{Affaire}}.Commission.</p>"
 },
 {
  "id": 4,
  "Nom": "Information concernant la saisine (Victime)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Victime",
  "Objet": "Saisine de la section disciplinaire",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{formule_destinataire}},</p><p style=\"text-align: justify;\">Conformément à l&#39;article R.811-27 du code de l&#39;éducation, je vous informe qu&#39;une procédure disciplinaire a été engagée contre {{Affaire}}.Formule {{Affaire}}.Nom_complet. </p><p style=\"text-align: justify;\">L&#39;affaire va désormais être instruite par le rapporteur et le rapporteur adjoint. Il est possible que ces derniers prennent contact avec vous afin d&#39;obtenir des éléments complémentaires ; vous pouvez également solliciter un échange avec ces derniers.</p><p style=\"text-align: justify;\">Lorsque l&#39;affaire sera en état d&#39;être jugée, la date et le lieu de la séance d&#39;examen vous sera communiquée. Vous pouvez demander à être entendue par la commission de discipline. Cette audition aura lieu en présence de {{Affaire}}.Formule {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\">Pour tout renseignement ou demande complémentaire, je vous invite à vous rapprocher du secrétariat de la section disciplinaire à l&#39;adresse {{Affaire_Section}}.Lien_cliquable.</p><p style=\"text-align: justify;\">Veuillez agréer, {{formule_destinataire}}, l&#39;expression de mes salutations distinguées.</p>"
 },
 {
  "id": 5,
  "Nom": "Notification de la décision (Mis en cause)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause",
  "Objet": "Notification d'une décision de la section disciplinaire",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Conformément aux dispositions de l&#39;article R.811-39 du code de l&#39;éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire dans l&#39;affaire vous concernant.</p><p style=\"text-align: justify;\">Conformément à l&#39;article R.421-1 du code de justice administrative, je vous informe que la présente décision peut faire l&#39;objet d&#39;un recours contentieux formé dans un délai de deux mois à compter de la notification de la présente, devant {{Affaire_Section}}.Voie_de_recours.</p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l&#39;expression de mes plus sincères salutations.</p>"
 },
 {
  "id": 6,
  "Nom": "Notification de la décision (dest. institutionnel)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Autorité ayant engagé les poursuites",
  "Objet": "Notification d'une décision de la section disciplinaire",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{formule_destinataire}},</p><p style=\"text-align: justify;\">Conformément aux dispositions de l&#39;article R.811-39 du code de l&#39;éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire de l&#39;{{Affaire_Section}}.Structure dans l&#39;affaire concernant {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\">Veuillez agréer, {{formule_destinataire}}, l&#39;expression de mes plus sincères salutations.</p>"
 },
 {
  "id": 7,
  "Nom": "Justificatif d'absence",
  "Type": 2,
  "Auteur": "Secrétaire",
  "Destinataire": "Destinataire libre",
  "Objet": "Justificatif d'absence",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p><u>Objet :</u> Justificatif d&#39;absence {{Champ_libre}}</p><p style=\"text-align: justify;\">Je soussigné, {{Secretaire}}.Nom_complet, secrétaire de la section disciplinaire, atteste que la présence de <strong>{{formule_destinataire}} {{destinataire}}</strong> était indispensable au bon déroulé de la séance d&#39;examen de la section disciplinaire de l&#39;{{Affaire_Section}}.Structure le {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}.</p><p style=\"text-align: right;\"><strong>Le secrétaire </strong></p><p style=\"text-align: right;\"><strong>de la section disciplinaire,</strong></p><p style=\"text-align: right;\"><strong>{{Secretaire}}.Nom_complet</strong></p>"
 },
 {
  "id": 8,
  "Nom": "Convocation du mis en cause (séance d'examen)",
  "Type": 1,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "Mis en cause",
  "Objet": "Convocation à la séance d'examen",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p>Je vous informe que la séance d&#39;examen dans l&#39;affaire {{Affaire}}.Numero aura lieu le :</p><p><strong>Date et heure :</strong> {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}</p><p><strong>Lieu :</strong> {{Seance_d_examen}}.Salle - {{Seance_d_examen}}.Adresse</p><p style=\"text-align: justify;\">Vous êtes prié de vous présenter à cette date. <u>En cas d&#39;absence injustifiée, la commission continuera de siéger.</u></p><p style=\"text-align: justify;\">Conformément aux dispositions du code de l&#39;éducation, <strong>vous avez la possibilité de présenter votre défense oralement, par écrit, et par le conseil de votre choix.</strong></p><p style=\"text-align: justify;\">Vous disposez également <strong>du droit de vous taire</strong> durant l&#39;ensemble de la procédure et de l&#39;audience.</p><p>Si vous êtes accompagné d&#39;un conseil, merci de communiquer son identité <u>dans les plus brefs délais</u> à l&#39;adresse {{Affaire_Section}}.Lien_cliquable.</p><p style=\"text-align: justify;\">Vous pouvez consulter les pièces du dossier de manière électronique <a href=\"{{Affaire}}.Lien_vers_le_dossier\" rel=\"noopener noreferrer\" target=\"_blank\">via ce lien</a>.</p><p style=\"text-align: justify;\">À l&#39;issue de la séance, l&#39;affaire sera mise en délibéré. La décision vous sera notifiée par le secrétaire de la section disciplinaire.</p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l&#39;expression de mes salutations distinguées.</p>"
 },
 {
  "id": 9,
  "Nom": "Désignation des rapporteurs (établissement agricole)",
  "Type": 6,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "",
  "Objet": "Désignation des rapporteurs",
  "Public": "Usagers",
  "Tutelle": "Agriculture",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Ouvre_l_instruction": 1,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p>Aux termes de l&#39;article R.812-24-6 du code rural et de la pêche maritime : « (...) <em>Le président de la commission de discipline désigne pour chaque affaire, au sein de la commission de discipline, un rapporteur, membre d&#39;un des collèges définis aux 1° à 3° de l&#39;article R. 812-24-3, et un rapporteur adjoint membre du collège défini au 4° du même article.</em> (...) »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p><u>Article 1er :</u> {{Affaire}}.Rapporteur est nommé en qualité de rapporteur dans l&#39;affaire en cause. {{Affaire}}.Rapporteur_adjoint est nommé en qualité de rapporteur adjoint.</p><p><u>Article 2 :</u> L&#39;instruction sera close le {{Date_butoir_instruction}}.date(@long). Si le rapport présenté ne permet pas à l&#39;affaire d&#39;être examinée, un complément d&#39;instruction sera ordonné.</p>"
 },
 {
  "id": 10,
  "Nom": "Complément d'instruction",
  "Type": 6,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "",
  "Objet": "Complément d'instruction",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">\t1. Aux termes de l&#39;article R.811-29 du code de l&#39;éducation : « <em>Le rapport d&#39;instruction comporte l&#39;exposé des faits ainsi que les observations présentées, le cas échéant, par le président de l&#39;université et par la personne poursuivie. Il est transmis au président de la commission de discipline, qui peut demander aux rapporteurs de poursuivre l&#39;instruction s&#39;il estime que l&#39;affaire n&#39;est pas en état d&#39;être examinée par la commission de discipline, notamment en raison d&#39;éléments nouveaux portés à la connaissance de la section disciplinaire. </em>»</p><p style=\"text-align: justify;\">\t2. Le rapport d&#39;instruction présenté ne permet pas à la commission de discipline d&#39;examiner l&#39;affaire.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> L&#39;instruction de l&#39;affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet est prolongée jusqu&#39;au {{Date_butoir_instruction}}.date(@long).</p>"
 },
 {
  "id": 11,
  "Nom": "Date de l'audience",
  "Type": 6,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "",
  "Objet": "Date de l'audience",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l&#39;article R.811-30 du code de l&#39;éducation : « <em>Le président de la commission de discipline fixe la date de la séance d&#39;examen de l&#39;affaire et convoque les membres de la commission.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> La séance d&#39;examen de l&#39;affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet aura lieu le {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}, {{Seance_d_examen}}.Salle - {{Seance_d_examen}}.Adresse.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> Sont appelés à siéger : {{Affaire}}.Commission.</p><p style=\"text-align: justify;\"><u>Article 3 :</u> La présente ordonnance sera notifiée aux membres de la commission de discipline, ainsi qu&#39;à {{Affaire}}.Formule {{Affaire}}.Nom_complet.</p>"
 },
 {
  "id": 12,
  "Nom": "Date de l'audience (Visio)",
  "Type": 6,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "",
  "Objet": "Date de l'audience",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">1. Aux termes de l&#39;article R.811-30 du code de l&#39;éducation : « <em>Le président de la commission de discipline fixe la date de la séance d&#39;examen de l&#39;affaire et convoque les membres de la commission.</em> »</p><p style=\"text-align: justify;\">2. Aux termes de l&#39;article R.811-31 du code de l&#39;éducation : « <em>Pour tenir compte de l&#39;éloignement géographique ou de contraintes professionnelles ou médicales, le président de la commission de discipline peut décider, avec l&#39;accord de la personne poursuivie, d&#39;avoir recours à un moyen de conférence audiovisuelle. Le moyen retenu doit respecter un niveau suffisant de sécurité et de confidentialité.</em> »</p><p style=\"text-align: justify;\">3. {{Affaire}}.Nom_complet ayant donné son accord concernant le recours à un moyen de conférence audiovisuelle.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> La séance d&#39;examen de l&#39;affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet aura lieu en vidéoconférence le {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> Sont appelés à siéger : {{Affaire}}.Commission.</p><p style=\"text-align: justify;\"><u>Article 3 :</u> La présente ordonnance sera notifiée aux membres de la commission de discipline, ainsi qu&#39;à {{Affaire}}.Formule {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\"><u>Article 4 :</u> Le secrétaire de la section disciplinaire communiquera par voie électronique, au mis en cause et aux membres de la commission de discipline ainsi qu&#39;à tout tiers concerné, le moyen d&#39;accéder au dispositif de vidéoconférence.</p>"
 },
 {
  "id": 13,
  "Nom": "Supplément d'instruction",
  "Type": 6,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "",
  "Objet": "Supplément d'instruction",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">1. Aux termes de l&#39;article R.811-31 du code de l&#39;éducation : « <em>Le président peut ordonner un supplément d&#39;instruction. Les parties sont invitées à présenter des éléments complémentaires pour les seuls besoins de ce supplément d&#39;instruction, dans un délai qui ne peut excéder un mois à compter de la date de la séance d&#39;examen de l&#39;affaire. A l&#39;issue de ce délai, la commission de discipline délibère.</em> »</p><p style=\"text-align: justify;\">2. Considérant qu&#39;à l&#39;issue de la séance d&#39;examen, il est nécessaire de procéder à un supplément d&#39;instruction.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p><u>Article 1er :</u> Un supplément d&#39;instruction est accordé dans l&#39;affaire {{Affaire}}.Numero.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> L&#39;instruction est prolongée jusqu&#39;au {{Date_butoir_instruction}}.date(@long).</p><p style=\"text-align: justify;\"><u>Article 3 :</u> À compter de la clôture de l&#39;instruction, la commission de discipline délibèrera sur l&#39;affaire. Si une nouvelle séance d&#39;examen est convoquée, une convocation sera transmise aux parties.</p><p style=\"text-align: justify;\"><u>Article 4 :</u> La présente ordonnance sera notifiée aux parties par le secrétaire de la section disciplinaire.</p>"
 },
 {
  "id": 14,
  "Nom": "R.811-40 / Désignation d'un représentant des usagers (établissement agricole)",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Désignation d'un représentant des usagers",
  "Public": "Usagers",
  "Tutelle": "Agriculture",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l&#39;article R.811-40 du code de l&#39;éducation : « <em>Le président de l&#39;université ou son représentant entend l&#39;usager et, le cas échéant, son conseil, en présence d&#39;un membre du collège défini au 3° de l&#39;article R. 811-14 désigné par le président de la section disciplinaire. L&#39;absence de ce membre dûment convoqué n&#39;empêche pas la tenue régulière de l&#39;entretien. Ce membre ne pourra être désigné à la commission de discipline appelée à se prononcer sur la proposition du président de l&#39;université.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> {{Champ_libre}} est désigné en qualité de représentant des usagers pour l&#39;entretien disciplinaire concernant {{Affaire}}.Formule  {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> {{Champ_libre}} ne pourra être nommé au sein de la commission de discipline chargée d&#39;examiner l&#39;affaire {{Affaire}}.Numero.</p><p style=\"text-align: justify;\"><u>Article 3:</u> La présente ordonnance sera notifiée à la directrice générale, et à son représentant, le directeur de l&#39;{{Affaire_Section}}.Structure.</p>"
 },
 {
  "id": 15,
  "Nom": "R.811-21 / Remplacement d'un membre (déport obligatoire)",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Remplacement d'un membre de la commission de discipline",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l&#39;article R.811-21 du code de l&#39;éducation : «<em> Les membres de la section disciplinaire qui font l&#39;objet de poursuites disciplinaires ne peuvent siéger dans une commission de discipline. Ils sont remplacés par un membre du même collège désigné par le président de la section disciplinaire.</em> / <em>Les membres de la section disciplinaire qui sont auteurs des plaintes ou témoins des faits ayant donné lieu aux poursuites ne peuvent siéger dans la commission de discipline appelée à se prononcer sur les faits correspondants. Ils sont remplacés par un membre du même collège désigné par le président de la section disciplinaire. </em>»</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> {{Champ_libre}} est remplacé par {{L_Destinataire}}, membre du même collège, au sein de la commission de discipline chargée d&#39;examiner l&#39;affaire {{Affaire}}.Numero.</p>"
 },
 {
  "id": 16,
  "Nom": "R.811-22 / Remplacement d'un membre (déport volontaire)",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Remplacement d'un membre",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l&#39;article R.811-22 du code de l&#39;éducation : « <em>Nul ne peut siéger dans une commission de discipline s&#39;il existe une raison objective de mettre en doute son impartialité. Le membre d&#39;une commission de discipline qui estime devoir s&#39;abstenir est remplacé par un membre du même collège désigné par le président de la section disciplinaire. </em>»</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> {{Champ_libre}} est remplacé par {{L_Destinataire}}, membre du même collège, au sein de la commission de discipline chargée d&#39;examiner l&#39;affaire {{Affaire}}.Numero.</p>"
 },
 {
  "id": 17,
  "Nom": "R.811-40 / Convocation à l'entretien disciplinaire",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Mis en cause",
  "Objet": "Convocation à un entretien disciplinaire",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Conformément aux dispositions de l&#39;article R.811-40 du code de l&#39;éducation, je vous convoque à un entretien disciplinaire afin de vous proposer une sanction concernant les agissements dont vous êtes responsable et pour lesquels vous avez reconnu les faits.</p><p style=\"text-align: justify;\">Pour votre information, les faits reprochés sont les suivants :</p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">L&#39;entretien disciplinaire se tiendra le  <strong>{{Date_libre}}.date(@long), {{Champ_libre}}.</strong></p><p style=\"text-align: justify;\">Durant toute la durée de la procédure, je vous rappelle que vous disposez du droit de vous taire, ainsi que de vous faire assister du conseil de votre choix (camarade, proche, avocat, etc.).</p><p style=\"text-align: justify;\">L&#39;entretien se tiendra en présence de mon représentant ainsi que d&#39;un représentant des usagers élu à la section disciplinaire.</p><p style=\"text-align: justify;\">Les sanctions susceptibles de vous être proposées sont, conformément aux articles R.811-40 et R.811-13-1 du code de l&#39;éducation :</p><ul><li><strong>Un avertissement ;</strong></li><li><strong>Un blâme ;</strong></li><li><strong>Une mesure de responsabilisation, qui constitue en une participation bénévole, hors heures d&#39;enseignement, à des activités de solidarité, culturelles ou de formation, d&#39;une durée maximale de 40 heures ;</strong></li><li><strong>Une exclusion de l&#39;{{Affaire_Section}}.Structure pour une durée maximale d&#39;un an, le cas échéant assortie d&#39;un sursis.</strong></li></ul><p style=\"text-align: justify;\">À l&#39;issue de cet entretien, vous disposez d&#39;un délai de quinze jours afin de faire connaître votre position sur la sanction proposée.</p><p style=\"text-align: justify;\">Si, à l&#39;issue de cet entretien, vous acceptez la sanction proposée, celle-ci sera soumise pour approbation à la commission de discipline chargée d&#39;examiner votre dossier.</p><p style=\"text-align: justify;\">Si, à l&#39;issue de cet entretien, vous refusez la sanction proposée, ou si vous n&#39;avez pas répondu dans le délai imparti de 15 jours, la section disciplinaire sera saisie afin d&#39;examiner votre dossier.</p><p style=\"text-align: justify;\">Il en va de même en cas de rejet, par la commission de discipline, de la proposition de sanction. Ce rejet n&#39;est susceptible d&#39;aucun recours.</p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l&#39;expression de mes sincères salutations.</p>"
 },
 {
  "id": 18,
  "Nom": "R.811-40 / Demande de désignation de représentant étudiant (établissement agricole)",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire",
  "Objet": "Demande de désignation d'un représentant étudiant",
  "Public": "Usagers",
  "Tutelle": "Agriculture",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire_Section}}.Formule_complete,</p><p style=\"text-align: justify;\">Conformément aux dispositions des articles R.812-24-1 du code rural et de la pêche maritime et R.811-40 du code de l’éducation, j’ai l’honneur de vous informer que je convoque l&#39;usager <strong>{{Affaire}}.Nom_complet</strong>, né.e le {{Affaire_Date_de_naissance}}.date(@long), inscrit en <strong>{{Affaire}}.Formation_suivie</strong> à un entretien afin de lui proposer une sanction concernant les faits qui lui sont reprochés et dont il a reconnu l&#39;existence.</p><p style=\"text-align: justify;\">Je vous prie, {{Affaire_Section}}.Formule_complete, de bien vouloir désigner au sein de la section disciplinaire le représentant des usagers qui sera présent à cet entretien.</p>"
 },
 {
  "id": 19,
  "Nom": "R.811-40 / Saisine de la section disciplinaire",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire",
  "Objet": "Saisine de la section disciplinaire en application de l'article R.811-40 du code de l'éducation",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire_Section}}.Formule_complete,</p><p style=\"text-align: justify;\">À l&#39;issue de l&#39;entretien disciplinaire ayant eu lieu le {{Date_libre}}.date(@long), je vous informe que <strong>{{Affaire}}.Nom_complet</strong> a accepté la sanction suivante :</p><p style=\"text-align: justify;\"><strong>{{Champ_libre}}</strong></p><p style=\"text-align: justify;\">Conformément à l&#39;article R.811-40 du code de l&#39;éducation, je vous prie de bien vouloir réunir la section disciplinaire que vous présidez afin de statuer sur cette proposition de sanction.</p>"
 },
 {
  "id": 20,
  "Nom": "R.811-40 / Proposition de sanction",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Mis en cause",
  "Objet": "Proposition de sanction disciplinaire en application de l'article R.811-40 du code de l'éducation",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">À l&#39;issue de l&#39;entretien disciplinaire ayant eu lieu le {{Date_libre}}.date(@long), il vous est proposé la sanction suivante :</p><p style=\"text-align: justify;\"><strong>{{Champ_libre}}</strong></p><p style=\"text-align: justify;\">Vous disposez désormais d&#39;un délai de 15 jours afin d&#39;accepter, ou de refuser, la proposition qui vous est faite. En cas de refus de votre part, ou à défaut de réponse dans le délai imparti, la section disciplinaire sera saisie afin d&#39;instruire votre dossier.</p><p style=\"text-align: justify;\">Je vous prie de bien vouloir remettre ce document complété en main propre à mon représentant, et/ou en retourner une copie par mail à l&#39;adresse {{Affaire_Section}}.Lien_cliquable dans ce délai.</p><p style=\"text-align: justify;\"><strong><u>À remplir par l&#39;usager :</u></strong></p><p style=\"text-align: justify;\"><strong>Je soussigné, {{Affaire}}.Nom_complet</strong><strong>, usager inscrit en {{Affaire}}.Formation_suivie</strong> <strong>ACCEPTE</strong> / <strong>REFUSE</strong> (barrer la mention inutile) <strong>la proposition de sanction qui m&#39;est faite.</strong></p><p style=\"text-align: justify;\"><strong>Date et signature de l&#39;usager :</strong></p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l&#39;expression de mes salutations distinguées.</p>"
 },
 {
  "id": 21,
  "Nom": "Requalification des motifs de saisine",
  "Type": 1,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "Mis en cause",
  "Objet": "Requalification des faits ayant motivé la saisine",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Je vous informe qu&#39;à la lumière de l&#39;instruction de votre affaire, la commission de discipline est susceptible de requalifier les faits ayant motivé les poursuites à votre encontre.</p><p style=\"text-align: justify;\">Pour mémoire, la qualification initialement retenue par l&#39;autorité ayant engagé les poursuites est la suivante :</p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\"><u>La nouvelle qualification susceptible d&#39;être retenue est la suivante :</u></p><p style=\"text-align: justify;\"><strong>{{Champ_libre}}</strong></p><p style=\"text-align: justify;\">Vous pouvez présenter des observations concernant cette requalification, par courriel à l&#39;adresse {{Affaire_Section}}.Lien_cliquable, ainsi que directement lors de la séance d&#39;examen.</p><p style=\"text-align: justify;\">En fonction des éléments apportés, la commission de discipline est susceptible de fonder sa décision sur la nouvelle qualification des faits.</p>"
 },
 {
  "id": 22,
  "Nom": "Renvoi d'examen de l'affaire",
  "Type": 4,
  "Auteur": "Formation de jugement",
  "Destinataire": "",
  "Objet": "Renvoi d'examen de l'affaire",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><strong>La commission de discipline,</strong></p><p style=\"text-align: justify;\">S&#39;étant réunie le {{Seance_d_examen_Date}}.date(@long), sous la présidence de <strong>{{Affaire}}.C_President</strong>, professeur, {{Affaire}}.C_Qualite,</p><p style=\"text-align: justify;\">Assistée lors des débats par <strong>{{Secretaire}}.Nom_complet</strong>, secrétaire de la section disciplinaire,</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code rural et de la pêche maritime ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code de l&#39;éducation ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {{Affaire_Date_de_saisine}}.date(@long) contre {{Affaire}}.Formule{{Affaire}}.Nom_complet ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> l&#39;absence justifiée de {{Affaire}}.Formule{{Affaire}}.Nom_complet à la séance d&#39;examen de l&#39;affaire ;</p><p style=\"text-align: justify;\"><strong>Considérant ce qui suit :</strong></p><p style=\"text-align: justify;\">1. Aux termes de l&#39;article R.811-31 du code de l&#39;éducation : « <em>En l&#39;absence de la personne poursuivie dûment convoquée, la commission de discipline peut décider soit de siéger si l&#39;intéressé n&#39;a pas fourni de motifs justifiant son absence, soit de renvoyer l&#39;examen de l&#39;affaire à une date ultérieure. </em>»</p><p style=\"text-align: justify;\">2. Les motifs transmis par {{Affaire}}.Formule{{Affaire}}.Nom_complet afin de justifier de son absence sont recevables et justifient un renvoi de l&#39;examen de l&#39;affaire à une date ultérieure.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p><p style=\"text-align: justify;\"><u>Article 1er</u></p><p style=\"text-align: justify;\">La séance d&#39;examen de l&#39;affaire est renvoyée à une date ultérieure, fixée par le président de la commission de discipline.</p><p style=\"text-align: justify;\"><u>Article 2</u></p><p style=\"text-align: justify;\">La présente décision sera notifiée aux parties par le secrétaire de la section disciplinaire.</p>"
 },
 {
  "id": 23,
  "Nom": "Récusation d'un membre (acceptation)",
  "Type": 4,
  "Auteur": "Formation de jugement",
  "Destinataire": "",
  "Objet": "Récusation d'un membre de la commission de discipline",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><strong>La commission de discipline,</strong></p><p style=\"text-align: justify;\">S&#39;étant réunie le {{Seance_d_examen_Date}}.date(@long), sous la présidence de <strong>{{Affaire}}.C_President</strong>, professeur, {{Affaire}}.C_Qualite,</p><p style=\"text-align: justify;\">Assistée lors des débats par <strong>{{Secretaire}}.Nom_complet</strong>, secrétaire de la section disciplinaire,</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code rural et de la pêche maritime ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code de l&#39;éducation ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {{Affaire_Date_de_saisine}}.date(@long) contre {{Affaire}}.Formule{{Affaire}}.Nom_complet ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la demande de récusation à l&#39;encontre de {{Champ_libre}} adressée au président de la section disciplinaire le {{Date_libre}}.date(@long) ;</p><p style=\"text-align: justify;\"><strong>Considérant ce qui suit :</strong></p><p style=\"text-align: justify;\">1. Aux termes de l&#39;article R.811-22 du code de l&#39;éducation : « <em>L&#39;usager poursuivi ou l&#39;auteur des poursuites qui veut récuser un membre de la commission de discipline en fait la demande au président de la section disciplinaire. Si la commission de discipline fait droit à cette demande, le membre concerné est remplacé par un membre du même collège désigné par le président de la section disciplinaire.</em> »</p><p style=\"text-align: justify;\">2. Il ressort des éléments mis à disposition de la commission de discipline que la demande présentée est fondée. Dans ces conditions, il y a lieu de récuser {{Champ_libre}} et d&#39;inviter le président de la section disciplinaire à désigner un remplaçant.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p><p style=\"text-align: justify;\"><u>Article 1er</u></p><p style=\"text-align: justify;\">{{Champ_libre}} est récusé, et sera remplacé par un membre du même collège désigné par le président de la section disciplinaire.</p><p style=\"text-align: justify;\"><u>Article 2</u></p><p style=\"text-align: justify;\">La présente décision sera notifiée aux parties par le secrétaire de la section disciplinaire.</p>"
 },
 {
  "id": 24,
  "Nom": "Récusation d'un membre (refus)",
  "Type": 4,
  "Auteur": "Formation de jugement",
  "Destinataire": "",
  "Objet": "Récusation d'un membre de la commission de discipline",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><strong>La commission de discipline,</strong></p><p style=\"text-align: justify;\">S&#39;étant réunie le {{Seance_d_examen_Date}}.date(@long), sous la présidence de <strong>{{Affaire}}.C_President</strong>, professeur, {{Affaire}}.C_Qualite,</p><p style=\"text-align: justify;\">Assistée lors des débats par <strong>{{Secretaire}}.Nom_complet</strong>, secrétaire de la section disciplinaire,</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code rural et de la pêche maritime ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code de l&#39;éducation ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {{Affaire_Date_de_saisine}}.date(@long) contre {{Affaire}}.Formule{{Affaire}}.Nom_complet ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la demande de récusation à l&#39;encontre de {{Champ_libre}} adressée au président de la section disciplinaire le {{Date_libre}}.date(@long) ;</p><p style=\"text-align: justify;\"><strong>Considérant ce qui suit :</strong></p><p style=\"text-align: justify;\">1. Aux termes de l&#39;article R.811-22 du code de l&#39;éducation : « <em>L&#39;usager poursuivi ou l&#39;auteur des poursuites qui veut récuser un membre de la commission de discipline en fait la demande au président de la section disciplinaire. Si la commission de discipline fait droit à cette demande, le membre concerné est remplacé par un membre du même collège désigné par le président de la section disciplinaire.</em> »</p><p style=\"text-align: justify;\">2. Il ressort des éléments mis à disposition de la commission de discipline que la demande présentée n&#39;est pas fondée. Dans ces conditions, il n&#39;y a pas lieu de faire droit à cette demande.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p><p style=\"text-align: justify;\"><u>Article 1er</u></p><p style=\"text-align: justify;\">La demande présentée le {{Date_libre}}.date(@long) est rejetée.</p><p style=\"text-align: justify;\"><u>Article 2</u></p><p style=\"text-align: justify;\">La présente décision sera notifiée aux parties par le secrétaire de la section disciplinaire.</p>"
 },
 {
  "id": 25,
  "Nom": "Lettre de saisine (enseignants-chercheurs, établissement agricole)",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire",
  "Objet": "Saisine de la section disciplinaire compétente à l'égard des enseignants-chercheurs",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Agriculture",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{Affaire_Section}}.Formule_complete,</p><p style=\"text-align: justify;\">Conformément aux dispositions des articles R.812-24-1 du code rural et de la pêche maritime et R.712-30 du code de l’éducation, j’ai l’honneur de vous informer que je saisis la section disciplinaire que vous présidez, afin d’instruire l’affaire :</p><p style=\"text-align: justify;\"><strong>Nom, prénom de l&#39;enseignant-chercheur mis en cause : </strong>{{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><strong>Né le :</strong> {{Affaire_Date_de_naissance}}.date(@long)</p><p style=\"text-align: justify;\"><strong>Domicilié(e) à :</strong> {{Affaire}}.Adresse</p><p style=\"text-align: justify;\"><strong>Qualité : </strong>{{Champ_libre}}<strong> </strong></p><p style=\"text-align: justify;\"><strong>Motifs :</strong></p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">Vous trouverez joint au présent courrier l&#39;ensemble des éléments justifiant cette saisine.</p>"
 },
 {
  "id": 26,
  "Nom": "Information concernant la saisine (institutionnel)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Chef d'établissement",
  "Objet": "Saisine de la section disciplinaire compétente à l'égard des usagers",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{formule_destinataire}},</p><p style=\"text-align: justify;\">Conformément aux dispositions de l&#39;article R.811-27 du code de l&#39;éducation, je vous informe que par courrier du {{Affaire_Date_de_saisine}}.date(@long), la section disciplinaire de l&#39;{{Affaire}}.Composante compétente à l&#39;égard des usagers a été saisie afin d&#39;instruire des faits concernant {{Affaire}}.Nom_complet, inscrit en {{Affaire}}.Formation_suivie.</p><p style=\"text-align: justify;\">Ces faits sont :</p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">Veuillez agréer, {{formule_destinataire}}, l&#39;expression de mes plus sincères salutations.</p>"
 },
 {
  "id": 27,
  "Nom": "Convocation à la séance (enseignants-chercheurs)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause",
  "Objet": "Convocation à la séance d'examen",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p>Je vous informe que la séance d&#39;examen dans l&#39;affaire {{Affaire}}.Numero aura lieu le :</p><p><strong>Date et heure :</strong> {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}</p><p><strong>Lieu :</strong> {{Seance_d_examen}}.Salle - {{Seance_d_examen}}.Adresse</p><p style=\"text-align: justify;\">Vous êtes prié de vous présenter à cette date. <u>En cas d&#39;absence injustifiée, la formation continuera de siéger.</u></p><p style=\"text-align: justify;\">Conformément aux dispositions du code de l&#39;éducation, <strong>vous avez la possibilité de présenter votre défense oralement, par écrit, et par le conseil de votre choix.</strong></p><p style=\"text-align: justify;\">Vous disposez également <strong>du droit de vous taire</strong> durant l&#39;ensemble de la procédure et de l&#39;audience.</p><p>Si vous êtes accompagné d&#39;un conseil, merci de communiquer son identité <u>dans les plus brefs délais</u> à l&#39;adresse {{Affaire_Section}}.Lien_cliquable.</p><p style=\"text-align: justify;\">Vous pouvez consulter les pièces du dossier de manière électronique <a href=\"{{Affaire}}.Lien_vers_le_dossier\" rel=\"noopener noreferrer\" target=\"_blank\">via ce lien</a>.</p><p style=\"text-align: justify;\">À l&#39;issue de la séance, l&#39;affaire sera mise en délibéré. La décision vous sera notifiée par le secrétaire de la section disciplinaire.</p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l&#39;expression de mes salutations distinguées.</p>"
 },
 {
  "id": 28,
  "Nom": "Notification de la décision (enseignants-chercheurs)",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause",
  "Objet": "Notification de la décision",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p>{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Conformément aux dispositions de l&#39;article R.712-42 du code de l&#39;éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire dans l&#39;affaire vous concernant.</p><p style=\"text-align: justify;\">Je vous informe que la présente décision peut faire l&#39;objet d&#39;un recours devant {{Affaire_Section}}.Voie_de_recours dans un délai de deux mois à compter de la notification de la présente.</p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l&#39;expression de mes plus sincères salutations.</p>"
 },
 {
  "id": 29,
  "Nom": "Lettre de saisine",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire",
  "Objet": "Saisine de la section disciplinaire",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire_Section}}.Formule_complete,</p><p style=\"text-align: justify;\">Conformément aux dispositions de l'article R.811-25 du code de l'éducation, j'ai l'honneur de vous informer que je saisis la section disciplinaire que vous présidez, afin d'instruire l'affaire :</p><p style=\"text-align: justify;\"><strong>Nom, prénom de l'usager mis en cause : </strong>{{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><strong>Né le :</strong> {{Affaire_Date_de_naissance}}.date(@long)</p><p style=\"text-align: justify;\"><strong>Domicilié(e) à :</strong> {{Affaire}}.Adresse</p><p style=\"text-align: justify;\"><strong>Numéro INE : </strong>{{Affaire}}.INE</p><p style=\"text-align: justify;\"><strong>Diplôme préparé : </strong>{{Affaire}}.Formation_suivie</p><p style=\"text-align: justify;\"><strong>Motifs :</strong></p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">Vous trouverez joint au présent courrier l'ensemble des éléments justifiant cette saisine.</p>"
 },
 {
  "id": 30,
  "Nom": "Composition de la commission de discipline",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Composition de la commission de discipline",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes des articles R.811-14 et R.811-20 du code de l'éducation : « <em>La section disciplinaire comprend quatre professeurs des universités ou assimilés, quatre maîtres de conférences ou assimilés et huit usagers. Elle est présidée par le président de l'université. / La commission de discipline comprend, outre le président de la section, deux professeurs des universités ou assimilés, deux maîtres de conférences ou assimilés et quatre usagers. Le nombre des représentants des usagers ne peut être supérieur à celui des représentants des enseignants.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> Une commission de discipline présidée par {{Affaire}}.C_President est instituée afin d'examiner l'affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> La commission est composée des membres suivants : {{Affaire}}.Commission.</p>"
 },
 {
  "id": 31,
  "Nom": "Désignation des rapporteurs",
  "Type": 6,
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "",
  "Objet": "Désignation des rapporteurs",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Ouvre_l_instruction": 1,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l'article R.811-28 du code de l'éducation : « (...) <em>Le rapporteur et, s'il y a lieu, le rapporteur adjoint sont désignés par le président de la commission de discipline, le rapporteur parmi les membres des collèges des professeurs et des maîtres de conférences, le rapporteur adjoint parmi les représentants des usagers.</em> (...) »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> {{Affaire}}.Rapporteur est nommé en qualité de rapporteur dans l'affaire en cause. {{Affaire}}.Rapporteur_adjoint est nommé en qualité de rapporteur adjoint.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> L'instruction sera close le {{Date_butoir_instruction}}.date(@long). Si le rapport présenté ne permet pas à l'affaire d'être examinée, un complément d'instruction sera ordonné.</p>"
 },
 {
  "id": 32,
  "Nom": "R.811-40 / Demande de désignation d'un représentant étudiant",
  "Type": 1,
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire",
  "Objet": "Demande de désignation d'un représentant étudiant",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire_Section}}.Formule_complete,</p><p style=\"text-align: justify;\">Conformément aux dispositions de l'article R.811-40 du code de l'éducation, j'ai l'honneur de vous informer que je convoque l'usager <strong>{{Affaire}}.Nom_complet</strong>, né(e) le {{Affaire_Date_de_naissance}}.date(@long), inscrit en <strong>{{Affaire}}.Formation_suivie</strong> à un entretien afin de lui proposer une sanction concernant les faits qui lui sont reprochés et dont il a reconnu l'existence.</p><p style=\"text-align: justify;\">Je vous prie, {{Affaire_Section}}.Formule_complete, de bien vouloir désigner au sein de la section disciplinaire le représentant des usagers qui sera présent à cet entretien.</p>"
 },
 {
  "id": 33,
  "Nom": "R.811-40 / Désignation d'un représentant des usagers",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Désignation d'un représentant des usagers",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l'article R.811-40 du code de l'éducation : « <em>Le président de l'université ou son représentant entend l'usager et, le cas échéant, son conseil, en présence d'un membre du collège défini au 3° de l'article R.811-14 désigné par le président de la section disciplinaire. L'absence de ce membre dûment convoqué n'empêche pas la tenue régulière de l'entretien. Ce membre ne pourra être désigné à la commission de discipline appelée à se prononcer sur la proposition du président de l'université.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> {{Champ_libre}} est désigné en qualité de représentant des usagers pour l'entretien disciplinaire concernant {{Affaire}}.Formule {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> {{Champ_libre}} ne pourra être nommé au sein de la commission de discipline chargée d'examiner l'affaire {{Affaire}}.Numero.</p><p style=\"text-align: justify;\"><u>Article 3 :</u> La présente ordonnance sera notifiée à l'autorité ayant engagé les poursuites et à son représentant.</p>"
 },
 {
  "id": 34,
  "Nom": "Information concernant la saisine (Mis en cause) — enseignants-chercheurs",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause",
  "Objet": "Saisine de la section disciplinaire à votre encontre",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Par courrier du {{Affaire_Date_de_saisine}}.date(@long), la section disciplinaire compétente à l'égard des enseignants-chercheurs a été saisie afin d'instruire des faits vous concernant.</p><p style=\"text-align: justify;\"><strong>Ces faits sont :</strong></p><p style=\"text-align: justify;\"><strong>{{Affaire}}.Motif</strong></p><p style=\"text-align: justify;\">Conformément à l'article R.712-30 du code de l'éducation, je vous informe que vous disposez d'un délai de {{Champ_libre}} jours afin de présenter vos observations écrites. Vous pouvez également demander à être entendu par la commission d'instruction, et prendre connaissance de votre dossier durant le déroulement de l'instruction.</p><p style=\"text-align: justify;\">Vous disposez également du droit de vous taire durant toute la durée de la procédure, et pouvez vous faire assister ou représenter par le conseil de votre choix.</p><p style=\"text-align: justify;\">Je vous prie d'agréer, {{Affaire}}.Formule, l'expression de mes salutations distinguées.</p>"
 },
 {
  "id": 35,
  "Nom": "Composition de la formation de jugement — enseignants-chercheurs",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Composition de la formation de jugement",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes des articles R.712-13 et R.712-23 du code de l'éducation, la formation de jugement comprend, selon le corps de la personne poursuivie : quatre professeurs des universités ou assimilés, dont le président ; ou bien deux professeurs des universités ou assimilés, dont le président, et deux maîtres de conférences ou assimilés ; ou bien un professeur, un maître de conférences et deux personnels exerçant des fonctions d'enseignement.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> La formation de jugement appelée à examiner l'affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet est constituée.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> Elle est composée des membres suivants : {{Affaire}}.Commission.</p><p style=\"text-align: justify;\"><u>Article 3 :</u> La présente ordonnance sera notifiée aux membres de la formation de jugement ainsi qu'à {{Affaire}}.Formule {{Affaire}}.Nom_complet.</p>"
 },
 {
  "id": 36,
  "Nom": "Désignation de la commission d'instruction — enseignants-chercheurs",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Désignation de la commission d'instruction",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Ouvre_l_instruction": 1,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l'article R.712-32 du code de l'éducation : « <em>Le président de la section disciplinaire désigne, pour chaque affaire, une commission d'instruction composée de deux membres, dont un rapporteur.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> {{Affaire}}.Rapporteur est nommé en qualité de rapporteur dans l'affaire en cause. Le second membre de la commission d'instruction est désigné en qualité de membre de la commission d'instruction.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> L'instruction sera close le {{Date_butoir_instruction}}.date(@long). Si le rapport présenté ne permet pas à l'affaire d'être examinée, un complément d'instruction sera ordonné.</p>"
 },
 {
  "id": 37,
  "Nom": "Date de l'audience — enseignants-chercheurs",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Date de l'audience",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l'article R.712-35 du code de l'éducation : « <em>Le président de la section disciplinaire fixe la date de la séance de jugement de l'affaire et convoque les membres de la formation de jugement.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> La séance de jugement de l'affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet aura lieu le {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}, {{Seance_d_examen}}.Salle - {{Seance_d_examen}}.Adresse.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> Sont appelés à siéger : {{Affaire}}.Commission.</p><p style=\"text-align: justify;\"><u>Article 3 :</u> La présente ordonnance sera notifiée aux membres de la formation de jugement ainsi qu'à {{Affaire}}.Formule {{Affaire}}.Nom_complet.</p>"
 },
 {
  "id": 38,
  "Nom": "Renvoi d'examen de l'affaire — enseignants-chercheurs",
  "Type": 4,
  "Auteur": "Formation de jugement",
  "Destinataire": "",
  "Objet": "Renvoi d'examen de l'affaire",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\"><strong>La formation de jugement,</strong></p><p style=\"text-align: justify;\">S'étant réunie le <strong>{{Seance_d_examen_Date}}.date(@long)</strong>, sous la présidence de <strong>{{Affaire}}.C_President</strong>, professeur, {{Affaire}}.C_Qualite,</p><p style=\"text-align: justify;\">Assistée lors des débats par <strong>{{Secretaire}}.Nom_complet</strong>, secrétaire de la section disciplinaire,</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code de l'éducation ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {{Affaire_Date_de_saisine}}.date(@long) contre {{Affaire}}.Formule {{Affaire}}.Nom_complet ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> l'absence justifiée de {{Affaire}}.Formule {{Affaire}}.Nom_complet à la séance de jugement de l'affaire ;</p><p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">1. Aux termes de l'article R.712-36 du code de l'éducation : « <em>En l'absence de la personne poursuivie dûment convoquée, la formation de jugement peut décider soit de siéger si l'intéressé n'a pas fourni de motifs justifiant son absence, soit de renvoyer l'examen de l'affaire à une date ultérieure.</em> »</p><p style=\"text-align: justify;\">2. Les motifs transmis par {{Affaire}}.Formule {{Affaire}}.Nom_complet afin de justifier de son absence sont recevables et justifient un renvoi de l'examen de l'affaire à une date ultérieure.</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> La séance de jugement de l'affaire est renvoyée à une date ultérieure, fixée par le président de la section disciplinaire.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> La présente décision sera notifiée aux parties par le secrétaire de la section disciplinaire.</p>"
 },
 {
  "id": 39,
  "Nom": "Notification de la décision (dest. institutionnel) — enseignants-chercheurs",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Autorité ayant engagé les poursuites",
  "Objet": "Notification d'une décision de la section disciplinaire",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{formule_destinataire}},</p><p style=\"text-align: justify;\">Conformément aux dispositions de l'article R.712-42 du code de l'éducation, je vous prie de bien vouloir trouver ci-joint la décision prise par la section disciplinaire de l'{{Affaire_Section}}.Structure dans l'affaire concernant {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\">Veuillez agréer, {{formule_destinataire}}, l'expression de mes plus sincères salutations.</p>"
 },
 {
  "id": 41,
  "Nom": "Composition de la section disciplinaire académique",
  "Type": 3,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "",
  "Objet": "Composition de la section disciplinaire académique",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Section disciplinaire académique",
  "Decision_definitive": 0,
  "Template_contenu": "<p>Considérant ce qui suit :</p><p style=\"text-align: justify;\">Aux termes de l'article R.811-46 du code de l'éducation : « <em>La section disciplinaire commune est présidée par un magistrat de l'ordre administratif, désigné par le président du tribunal administratif. Elle comprend, outre son président, deux professeurs des universités ou assimilés, deux maîtres de conférences ou assimilés, deux représentants de l'administration des établissements et quatre usagers.</em> »</p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>ORDONNE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> La section disciplinaire académique est constituée pour examiner l'affaire {{Affaire}}.Numero - {{Affaire}}.Nom_complet.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> Elle est composée des membres suivants : {{Affaire}}.Commission.</p>"
 },
 {
  "id": 42,
  "Nom": "Convocation à la séance — section disciplinaire académique",
  "Type": 1,
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause",
  "Objet": "Convocation à la séance d'examen",
  "Public": "Usagers",
  "Tutelle": "Enseignement supérieur",
  "Type_de_section": "Section disciplinaire académique",
  "Decision_definitive": 0,
  "Template_contenu": "<p style=\"text-align: justify;\">Dossier n° : {{Affaire}}.Numero - {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><em>(à rappeler dans toute correspondance)</em></p><p style=\"text-align: justify;\"><u>Objet :</u> {{Template}}.Objet</p><p style=\"text-align: justify;\">{{Affaire}}.Formule,</p><p style=\"text-align: justify;\">Je vous informe que la section disciplinaire académique examinera l'affaire {{Affaire}}.Numero à la séance suivante :</p><p style=\"text-align: justify;\"><strong>Date et heure :</strong> {{Seance_d_examen_Date}}.date(@long) à {{Affaire_Heure_de_passage}}</p><p style=\"text-align: justify;\"><strong>Lieu :</strong> {{Seance_d_examen}}.Salle - {{Seance_d_examen}}.Adresse</p><p style=\"text-align: justify;\">Vous êtes prié de vous présenter à cette date. <u>En cas d'absence injustifiée, la section continuera de siéger.</u></p><p style=\"text-align: justify;\">Conformément aux dispositions du code de l'éducation, vous avez la possibilité de présenter votre défense oralement, par écrit, et par le conseil de votre choix, et disposez du droit de vous taire durant l'ensemble de la procédure et de l'audience.</p><p style=\"text-align: justify;\">Veuillez agréer, {{Affaire}}.Formule, l'expression de mes salutations distinguées.</p>"
 },
 {
  "id": 40,
  "Nom": "Décision définitive",
  "Type": 4,
  "Auteur": "Formation de jugement",
  "Destinataire": "",
  "Objet": "Décision définitive",
  "Public": "Les deux",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 1,
  "Template_contenu": "<p style=\"text-align: justify;\"><strong>La formation de jugement,</strong></p><p style=\"text-align: justify;\">S'étant réunie le <strong>{{Seance_d_examen_Date}}.date(@long)</strong>, sous la présidence de <strong>{{Affaire}}.C_President</strong>, {{Affaire}}.C_Qualite,</p><p style=\"text-align: justify;\">Assistée lors des débats par <strong>{{Secretaire}}.Nom_complet</strong>, secrétaire de la section disciplinaire,</p><p style=\"text-align: justify;\"><strong>Vu</strong> le code de l'éducation ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> la saisine de la section disciplinaire le {{Affaire_Date_de_saisine}}.date(@long) contre {{Affaire}}.Formule {{Affaire}}.Nom_complet ;</p><p style=\"text-align: justify;\"><strong>Vu</strong> le rapport d'instruction et les observations présentées par les parties ;</p><p>Considérant ce qui suit :</p><p style=\"text-align: justify;\"><strong>{{Decision}}.Motivation</strong></p><p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>DÉCIDE</strong></p><p style=\"text-align: justify;\"><u>Article 1er :</u> Il est prononcé à l'encontre de {{Affaire}}.Formule {{Affaire}}.Nom_complet la décision suivante : <strong>{{Decision}}.Libelle_decision</strong>.</p><p style=\"text-align: justify;\"><u>Article 2 :</u> La présente décision sera notifiée à {{Affaire}}.Formule {{Affaire}}.Nom_complet ainsi qu'à l'autorité ayant engagé les poursuites, dans les conditions prévues par le code de l'éducation.</p>"
 },
 {
  "id": 43,
  "Nom": "Rapport d'instruction",
  "Type": 5,
  "Auteur": "Rapporteur",
  "Destinataire": "",
  "Objet": "Rapport d'instruction",
  "Public": "Usagers",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Template_contenu": "<p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>RAPPORT D&#39;INSTRUCTION</strong></p><p style=\"text-align: justify;\"><u>Affaire :</u> {{Affaire}}.Numero — {{Affaire}}.Formule {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><u>Rapporteur :</u> {{Affaire}}.Rapporteur</p><p style=\"text-align: justify;\">La section disciplinaire a &eacute;t&eacute; saisie le {{Affaire_Date_de_saisine}}.date(@long) par {{Affaire}}.Autorite_de_saisine, &agrave; raison des faits expos&eacute;s ci-apr&egrave;s.</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>I. Expos&eacute; des faits et de la proc&eacute;dure</strong></p><p style=\"text-align: justify;\">Les faits reproch&eacute;s &agrave; {{Affaire}}.Formule {{Affaire}}.Nom_complet sont les suivants :</p><p style=\"text-align: justify;\">{{Affaire}}.Motif</p><p style=\"text-align: justify;\">Par d&eacute;cision de {{Affaire}}.C_President, qui pr&eacute;side la section disciplinaire, le rapporteur a &eacute;t&eacute; d&eacute;sign&eacute; pour instruire l&#39;affaire.</p><p style=\"text-align: justify;\">Le mis en cause a &eacute;t&eacute; mis en mesure de pr&eacute;senter ses observations, oralement ou par &eacute;crit, et de se faire assister ou repr&eacute;senter par le conseil de son choix.</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>II. Diligences accomplies</strong></p><p style=\"text-align: justify;\">Le rapporteur a pris connaissance de l&#39;ensemble du dossier et des pi&egrave;ces transmises &agrave; l&#39;appui de la saisine. Il a proc&eacute;d&eacute; &agrave; l&#39;audition du mis en cause et, le cas &eacute;ch&eacute;ant, de la victime et des t&eacute;moins, et s&#39;est fait communiquer tous documents utiles &agrave; la manifestation de la v&eacute;rit&eacute;.</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>III. Observations pr&eacute;sent&eacute;es par les parties</strong></p><p style=\"text-align: justify;\">Le mis en cause a fait valoir les observations suivantes : [ &agrave; compl&eacute;ter ]</p><p style=\"text-align: justify;\">[ Observations de la victime et, le cas &eacute;ch&eacute;ant, de l&#39;autorit&eacute; ayant engag&eacute; les poursuites. ]</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>IV. Analyse et conclusion</strong></p><p style=\"text-align: justify;\">[ Analyse des faits, de leur mat&eacute;rialit&eacute; et de leur imputabilit&eacute;, au vu des &eacute;l&eacute;ments du dossier. ]</p><p style=\"text-align: justify;\">En cons&eacute;quence, le rapporteur estime que l&#39;affaire est en &eacute;tat d&#39;&ecirc;tre examin&eacute;e par la section disciplinaire.</p>"
 },
 {
  "id": 44,
  "Nom": "Rapport d'instruction — commission d'instruction",
  "Type": 5,
  "Auteur": "Commission d'instruction",
  "Destinataire": "",
  "Objet": "Rapport d'instruction",
  "Public": "Enseignants-chercheurs",
  "Tutelle": "Toutes",
  "Type_de_section": "Toutes",
  "Decision_definitive": 0,
  "Concerne_l_instruction": 1,
  "Template_contenu": "<p style=\"text-align: center; font-size: 14pt; line-height: 1.2; color: #161616;\"><strong>RAPPORT D&#39;INSTRUCTION</strong></p><p style=\"text-align: justify;\"><u>Affaire :</u> {{Affaire}}.Numero — {{Affaire}}.Formule {{Affaire}}.Nom_complet</p><p style=\"text-align: justify;\"><u>Commission d&#39;instruction :</u> {{Affaire}}.Composition_de_l_instruction</p><p style=\"text-align: justify;\"><u>Rapporteur :</u> {{Affaire}}.Rapporteur</p><p style=\"text-align: justify;\">La section disciplinaire a &eacute;t&eacute; saisie le {{Affaire_Date_de_saisine}}.date(@long) par {{Affaire}}.Autorite_de_saisine, &agrave; raison des faits expos&eacute;s ci-apr&egrave;s.</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>I. Expos&eacute; des faits et de la proc&eacute;dure</strong></p><p style=\"text-align: justify;\">Les faits reproch&eacute;s &agrave; {{Affaire}}.Formule {{Affaire}}.Nom_complet sont les suivants :</p><p style=\"text-align: justify;\">{{Affaire}}.Motif</p><p style=\"text-align: justify;\">Le rapporteur a &eacute;t&eacute; d&eacute;sign&eacute; par {{Affaire}}.C_President, qui pr&eacute;side la section disciplinaire. Conform&eacute;ment &agrave; l&#39;article R.712-32 du code de l&#39;&eacute;ducation, l&#39;instruction de l&#39;affaire a &eacute;t&eacute; confi&eacute;e &agrave; une commission d&#39;instruction compos&eacute;e de deux membres, dont un rapporteur.</p><p style=\"text-align: justify;\">Le mis en cause a &eacute;t&eacute; mis en mesure de pr&eacute;senter ses observations, oralement ou par &eacute;crit, et de se faire assister ou repr&eacute;senter par le conseil de son choix.</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>II. Diligences accomplies</strong></p><p style=\"text-align: justify;\">La commission d&#39;instruction a pris connaissance de l&#39;ensemble du dossier et des pi&egrave;ces transmises &agrave; l&#39;appui de la saisine. Elle a proc&eacute;d&eacute; &agrave; l&#39;audition du mis en cause et, le cas &eacute;ch&eacute;ant, de la victime et des t&eacute;moins, et s&#39;est fait communiquer tous documents utiles &agrave; la manifestation de la v&eacute;rit&eacute;.</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>III. Observations pr&eacute;sent&eacute;es par les parties</strong></p><p style=\"text-align: justify;\">Le mis en cause a fait valoir les observations suivantes : [ &agrave; compl&eacute;ter ]</p><p style=\"text-align: justify;\">[ Observations de la victime et, le cas &eacute;ch&eacute;ant, de l&#39;autorit&eacute; ayant engag&eacute; les poursuites. ]</p><p style=\"text-align: justify; font-size: 12pt; line-height: 1.2; color: #161616;\"><strong>IV. Analyse et conclusion</strong></p><p style=\"text-align: justify;\">[ Analyse des faits, de leur mat&eacute;rialit&eacute; et de leur imputabilit&eacute;, au vu des &eacute;l&eacute;ments du dossier. ]</p><p style=\"text-align: justify;\">En cons&eacute;quence, la commission d&#39;instruction estime que l&#39;affaire est en &eacute;tat d&#39;&ecirc;tre examin&eacute;e par la section disciplinaire.</p>"
 },
];

/**
 * Les onze types de la refonte antérieure : chacun mêlait le format, l'auteur
 * et le destinataire dans une même feuille de style. La reprise les ramène aux
 * formats courants (voir `ANCIEN_FORMAT`) — six aujourd'hui : ses deux types de
 * décision du président, « Décision (président SD) » et « Décision (président
 * Commission) », se partagent entre le président de la section et celui de la
 * formation de jugement, que les textes distinguent, et deviennent les deux
 * formats d'**ordonnance**.
 */
export const ANCIENS_TYPES_TRAMES = [
 "Courrier (institutionnel)",
 "Courrier (président SD à mis en cause)",
 "Courrier (destinataire libre)",
 "Courrier (président Commission à mis en cause)",
 "Courrier de saisine",
 "Courrier (directeur, R.811-40)",
 "Attestation",
 "Décision (président SD)",
 "Décision (président Commission)",
 "Décision (commission de discipline)",
 "Décision définitive"
];

/** Ancien nom de type → nom du format qui le remplace. */
export const ANCIEN_FORMAT = {
 "Courrier (institutionnel)": "Courrier",
 "Courrier (président SD à mis en cause)": "Courrier",
 "Courrier (destinataire libre)": "Courrier",
 "Courrier (président Commission à mis en cause)": "Courrier",
 "Courrier de saisine": "Courrier",
 "Courrier (directeur, R.811-40)": "Courrier",
 "Attestation": "Attestation",
 "Décision (président SD)": "Ordonnance du président de la section disciplinaire",
 "Décision (président Commission)": "Ordonnance du président de la formation de jugement",
 "Décision (commission de discipline)": "Décision de la formation de jugement",
 "Décision définitive": "Décision de la formation de jugement"
};

/**
 * Ancien nom de type → auteur et destinataire par défaut, pour une trame
 * propre à l'établissement (identifiant inconnu des modèles livrés) : son
 * ancien type dit à qui elle s'adressait et qui la signait.
 */
export const ANCIEN_DEFAUT = {
 "Courrier (institutionnel)": [
  "Président de la section disciplinaire",
  "Autorité ayant engagé les poursuites"
 ],
 "Courrier (président SD à mis en cause)": [
  "Président de la section disciplinaire",
  "Mis en cause"
 ],
 "Courrier (destinataire libre)": [
  "Président de la section disciplinaire",
  "Destinataire libre"
 ],
 "Courrier (président Commission à mis en cause)": [
  "Président de la commission de discipline",
  "Mis en cause"
 ],
 "Courrier de saisine": [
  "Autorité ayant engagé les poursuites",
  "Président de la section disciplinaire"
 ],
 "Courrier (directeur, R.811-40)": [
  "Autorité ayant engagé les poursuites",
  "Mis en cause"
 ],
 "Attestation": [
  "Secrétaire",
  "Destinataire libre"
 ],
 "Décision (président SD)": [
  "Président de la section disciplinaire",
  ""
 ],
 "Décision (président Commission)": [
  "Président de la commission de discipline",
  ""
 ],
 "Décision (commission de discipline)": [
  "Formation de jugement",
  ""
 ],
 "Décision définitive": [
  "Formation de jugement",
  ""
 ]
};

/**
 * Les trames livrées, par identifiant : leur format (nom du type), leur auteur
 * et leur destinataire. Sert à retaguer une base antérieure — le corps et le
 * nom de ces trames sont alors remis à neuf.
 *
 * N'y figurent que les trames de la refonte antérieure (celles dont
 * l'identifiant est garanti) : les trames ajoutées depuis — le rapport
 * d'instruction, 43 et 44 — n'y sont **pas**, et c'est voulu. Sur une base qui
 * les a installées, un identifiant voisin peut être celui d'une trame propre à
 * l'établissement, et la reprise la retaguerait de force. Les modèles livrés ne
 * s'ajoutent que par `installerTramesParDefaut` (app.js), qui les reconnaît à
 * leur nom.
 */
export const TRAMES_PAR_ID = {
 "1": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire"
 },
 "2": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause"
 },
 "3": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "4": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Victime"
 },
 "5": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause"
 },
 "6": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Autorité ayant engagé les poursuites"
 },
 "7": {
  "Type": "Attestation",
  "Auteur": "Secrétaire",
  "Destinataire": "Destinataire libre"
 },
 "8": {
  "Type": "Courrier",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "Mis en cause"
 },
 "9": {
  "Type": "Ordonnance du président de la formation de jugement",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": ""
 },
 "10": {
  "Type": "Ordonnance du président de la formation de jugement",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": ""
 },
 "11": {
  "Type": "Ordonnance du président de la formation de jugement",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": ""
 },
 "12": {
  "Type": "Ordonnance du président de la formation de jugement",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": ""
 },
 "13": {
  "Type": "Ordonnance du président de la formation de jugement",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": ""
 },
 "14": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "15": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "16": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "17": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Mis en cause"
 },
 "18": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire"
 },
 "19": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire"
 },
 "20": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Mis en cause"
 },
 "21": {
  "Type": "Courrier",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": "Mis en cause"
 },
 "22": {
  "Type": "Décision de la formation de jugement",
  "Auteur": "Formation de jugement",
  "Destinataire": ""
 },
 "23": {
  "Type": "Décision de la formation de jugement",
  "Auteur": "Formation de jugement",
  "Destinataire": ""
 },
 "24": {
  "Type": "Décision de la formation de jugement",
  "Auteur": "Formation de jugement",
  "Destinataire": ""
 },
 "25": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire"
 },
 "26": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Chef d'établissement"
 },
 "27": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause"
 },
 "28": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause"
 },
 "29": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire"
 },
 "30": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "31": {
  "Type": "Ordonnance du président de la formation de jugement",
  "Auteur": "Président de la commission de discipline",
  "Destinataire": ""
 },
 "32": {
  "Type": "Courrier",
  "Auteur": "Autorité ayant engagé les poursuites",
  "Destinataire": "Président de la section disciplinaire"
 },
 "33": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "34": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause"
 },
 "35": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "36": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "37": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "38": {
  "Type": "Décision de la formation de jugement",
  "Auteur": "Formation de jugement",
  "Destinataire": ""
 },
 "39": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Autorité ayant engagé les poursuites"
 },
 "40": {
  "Type": "Décision de la formation de jugement",
  "Auteur": "Formation de jugement",
  "Destinataire": ""
 },
 "41": {
  "Type": "Ordonnance du président de la section disciplinaire",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": ""
 },
 "42": {
  "Type": "Courrier",
  "Auteur": "Président de la section disciplinaire",
  "Destinataire": "Mis en cause"
 }
};

/**
 * Trames livrées par défaut qui manquent à une base : « Réglages › Trames »
 * propose de les ajouter à un document déjà installé, dont les modèles étaient
 * antérieurs. Le rapprochement se fait sur le nom **et** la procédure visée,
 * de sorte qu'une trame de même nom mais d'une autre procédure reste distincte.
 */
export function tramesParDefautManquantes(db) {
  const cle = (t) => [t.Nom, t.Public || "", t.Tutelle || "", t.Type_de_section || ""].join("|");
  const presents = new Set((db.Trames || []).map(cle));
  return TRAMES_PAR_DEFAUT.filter((t) => !presents.has(cle(t)));
}

/** Types de trames livrés par défaut qui manquent à une base. */
export function typesTramesParDefautManquants(db) {
  const presents = new Set((db.Types_Trames || []).map((t) => String(t.Nom)));
  return TYPES_TRAMES_PAR_DEFAUT.filter((t) => !presents.has(String(t.Nom)));
}

/** Clé de rapprochement d'une trame livrée avec une trame de la base. */
export function cleTrame(t) {
  return [t.Nom, t.Public || "", t.Tutelle || "", t.Type_de_section || ""].join("|");
}

/**
 * Ce qu'il faudrait faire pour qu'un registre de trames rejoigne les contenus
 * livrés : les trames et formats livrés qui manquent (ajouts), et, pour les
 * trames déjà présentes qui portent un nom et une procédure livrés, les champs
 * de **programmation** à corriger — le format (`Type`), l'**auteur** et le
 * **destinataire**. C'est l'analogue, pour les trames, de
 * `planAlignementCatalogue` : le **texte** d'une trame (`Template_contenu`),
 * son `Template_brut` et sa `Feuille_de_style` ne sont **jamais** touchés —
 * c'est le travail de l'établissement, qui prime —, seul l'habillage qui
 * découle de la livraison est remis d'aplomb. Le plan est calculé sans rien
 * écrire : l'appelant l'applique après accord, et aucune ligne n'est supprimée.
 */
export function planAlignementTrames(db) {
  const nomParId = new Map(TYPES_TRAMES_PAR_DEFAUT.map((t) => [Number(t.id), String(t.Nom)]));
  const idParNom = new Map((db.Types_Trames || []).map((t) => [String(t.Nom), t.id]));
  const parCle = new Map((db.Trames || []).map((r) => [cleTrame(r), r]));
  const ajouts = [];
  const modifications = [];
  for (const defaut of TRAMES_PAR_DEFAUT) {
    const ligne = parCle.get(cleTrame(defaut));
    if (!ligne) { ajouts.push({ ...defaut }); continue; }
    const avant = {};
    const apres = {};
    const typeCible = idParNom.get(String(nomParId.get(Number(defaut.Type))));
    if (typeCible !== undefined && String(ligne.Type ?? "") !== String(typeCible)) {
      avant.Type = ligne.Type ?? "";
      apres.Type = typeCible;
    }
    for (const champ of ["Auteur", "Destinataire"]) {
      const actuel = ligne[champ] ?? "";
      const attendu = defaut[champ] ?? "";
      if (String(actuel) !== String(attendu)) { avant[champ] = actuel; apres[champ] = attendu; }
    }
    if (Object.keys(apres).length) modifications.push({ id: ligne.id, avant, apres });
  }
  return { ajouts, modifications };
}
