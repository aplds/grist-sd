// Répertoire des considérants de principe — données et recherche.
//
// Un considérant de principe est le motif de droit qui revient d'une décision à
// l'autre : la citation d'un texte, la règle qui s'en déduit, l'enchaînement qui
// conclut. Le raisonnement, lui, est propre à chaque affaire. Le répertoire
// range donc ce qui se répète — jamais les faits — pour que le rédacteur n'ait
// plus à le réécrire : il le glisse dans la décision et complète ce qui manque.
//
// Les considérants livrés ici sont tirés de **décisions réelles** de sections
// disciplinaires d'établissements d'enseignement supérieur agricole (Institut
// Agro Rennes-Angers, Dijon, Montpellier), qui ont servi de modèle à l'espace de
// rédaction (voir `SPEC.md`). Leur formulation est celle des décisions ; les
// crochets `[…]` marquent ce que le rédacteur doit compléter.
//
// Chaque considérant porte :
//
//  - une **rubrique** : l'intertitre sous lequel il se range dans la décision
//    (« Sur la compétence de la section disciplinaire », « Sur la sanction
//    disciplinaire »…), qui donne aussi l'ordre du plan ;
//  - une **nature** : un `principe` (la règle), un `texte` (la citation d'un
//    article ou d'un règlement) ou un `enchainement` (la phrase de liaison qui
//    conduit à la décision) ;
//  - des **tags** : les thèmes qui le font retrouver (fraude, téléphone en
//    examen, faits commis hors de l'établissement, sursis…) ;
//  - une **source** : le texte ou la jurisprudence cités, quand ils sont
//    connus — jamais inventés ;
//  - un **domaine** : le code dont le texte est tiré (`agriculture` pour le code
//    rural et de la pêche maritime, `education` pour le code de l'éducation),
//    afin que le rédacteur prenne la rédaction applicable à sa section.
//
// Le répertoire de l'établissement vit dans la table `Considerants` : les
// considérants qui y sont enregistrés **priment** sur ceux livrés ici dès lors
// qu'ils déclarent leur `Origine` — c'est l'adaptation locale, et le bouton
// « Adapter » la crée. Les autres s'y ajoutent.

/* ------------------------------------------------------------------ */
/* Vocabulaires                                                        */
/* ------------------------------------------------------------------ */

/**
 * Rubriques d'une décision : les intertitres du raisonnement, dans l'ordre où
 * ils s'y succèdent. C'est le plan que suit l'espace de rédaction, et le rang
 * qui trie le répertoire.
 */
export const RUBRIQUES = [
  { id: "competence", label: "Compétence", intertitre: "Sur la compétence de la section disciplinaire" },
  { id: "procedure", label: "Procédure", intertitre: "Sur la régularité de la procédure" },
  { id: "prescription", label: "Prescription", intertitre: "Sur la prescription" },
  { id: "requalification", label: "Requalification", intertitre: "Sur la requalification du motif de saisine" },
  { id: "materialite", label: "Matérialité des faits", intertitre: "Sur la matérialité des faits" },
  { id: "qualification", label: "Qualification des faits", intertitre: "Sur la qualification des faits" },
  { id: "consequences", label: "Conséquences des faits", intertitre: "Sur les conséquences des faits" },
  { id: "appreciation", label: "Appréciation des faits", intertitre: "Sur l'appréciation des faits par le mis en cause" },
  { id: "sanction", label: "Sanction", intertitre: "Sur la sanction disciplinaire" },
  { id: "abandon", label: "Abandon des poursuites", intertitre: "Sur l'abandon des poursuites" },
  { id: "motifs", label: "Conclusion", intertitre: "" },
];

/** Natures d'un considérant, et la couleur de la pastille qui l'annonce. */
export const NATURES = [
  { id: "principe", label: "Principe", tone: "blue" },
  { id: "texte", label: "Texte cité", tone: "grey" },
  { id: "enchainement", label: "Enchaînement", tone: "yellow" },
];

/** Domaines : le code dont le considérant est tiré. */
export const DOMAINES = [
  { id: "agriculture", label: "Code rural et de la pêche maritime", court: "Code rural" },
  { id: "education", label: "Code de l'éducation", court: "Code de l'éducation" },
];

/*
 * Les vocabulaires se lisent dans les deux écritures : l'identifiant interne
 * (`competence`) et le libellé affiché (« Compétence »). Le choix d'une colonne
 * Grist offre les libellés — c'est ce que voit le rédacteur —, et une valeur
 * écrite à la main (« compétence », sans accent) est reconnue de même : aucune
 * saisie un peu différente ne fait perdre un considérant.
 */

function memeMot(a, b) {
  return comparable(a) === comparable(b);
}

function dans(vocabulaire, valeur) {
  const v = String(valeur ?? "").trim();
  if (!v) return null;
  return vocabulaire.find((x) => x.id === v || memeMot(x.label, v)) || null;
}

export function rubriqueDe(valeur) {
  return dans(RUBRIQUES, valeur);
}

export function natureDe(valeur) {
  return dans(NATURES, valeur);
}

export function domaineDe(valeur) {
  return dans(DOMAINES, valeur);
}

/** Rang d'une rubrique dans le plan — les rubriques inconnues vont à la fin. */
export function rangRubrique(valeur) {
  const r = rubriqueDe(valeur);
  return r ? RUBRIQUES.indexOf(r) : RUBRIQUES.length;
}

/* ------------------------------------------------------------------ */
/* Le répertoire livré                                                 */
/* ------------------------------------------------------------------ */

/**
 * Considérants livrés avec l'outil.
 *
 * `texte` est du HTML simple — des paragraphes, quelques passages en gras ou
 * en italique —, tel qu'il s'insère dans le texte de la décision. Les textes
 * cités entre guillemets sont recopiés des décisions : les crochets `[…]`
 * signalent l'année, la personne ou le fait à compléter.
 */
export const CONSIDERANTS_LIVRES = [
  /* --- Compétence ------------------------------------------------- */

  {
    id: "rural-base-legale",
    rubrique: "competence",
    nature: "texte",
    domaine: "agriculture",
    titre: "Régime disciplinaire des usagers (code rural)",
    source: "Code rural et de la pêche maritime, art. R.812-24-2",
    tags: ["Base légale", "Compétence", "Fraude", "Vie universitaire", "Faits commis hors de l'établissement", "Réputation"],
    texte: "<p>Aux termes de l'article R.812-24-2 du code rural et de la pêche maritime : « I. - Relève du régime disciplinaire prévu au présent paragraphe tout usager lorsqu'il est auteur, notamment :</p>"
      + "<p>1° De fait de méconnaissance des dispositions législatives et réglementaires relatives à la vie universitaire ou du règlement intérieur de l'établissement ;</p>"
      + "<p>2° De fraude ou de tentative de fraude ;</p>"
      + "<p>(…) 5° De tout fait susceptible de porter atteinte à l'ordre, au bon fonctionnement ou à la réputation de l'établissement.</p>"
      + "<p>Les faits commis en dehors de l'établissement sont passibles d'une sanction disciplinaire lorsqu'ils présentent un lien suffisant avec l'établissement ou les activités qu'il organise. »</p>",
  },

  {
    id: "rural-base-legale-ancienne",
    rubrique: "competence",
    nature: "texte",
    domaine: "agriculture",
    titre: "Régime disciplinaire — rédaction antérieure",
    source: "Code rural et de la pêche maritime, art. R.812-24-2, rédaction citée par les décisions antérieures",
    tags: ["Base légale", "Compétence", "Fraude", "Ordre et bon fonctionnement"],
    texte: "<p>Aux termes de l'article R.812-24-2 du code rural et de la pêche maritime : « Relèvent de la présente sous-section : (…) 2° Tout usager d'un établissement mentionné à l'article D.812-1 du présent code lorsqu'il est auteur ou complice : a) D'une fraude ou d'une tentative de fraude commise à l'occasion d'une inscription, d'une épreuve prévue par le règlement des études, d'un examen ou d'un concours dans un établissement mentionné à cet article ; b) D'un fait de nature à porter atteinte à l'ordre ou au bon fonctionnement d'un établissement mentionné au même article. »</p>",
  },

  {
    id: "competence-usager-inscrit",
    rubrique: "competence",
    nature: "principe",
    source: "",
    tags: ["Compétence", "Usager inscrit", "Campus", "Résidences"],
    titre: "Compétence à l'égard d'un usager régulièrement inscrit",
    texte: "<p>Les évènements portés à la connaissance de la section disciplinaire concernent un usager régulièrement inscrit au sein de l'établissement, ces derniers s'étant déroulés sur le campus de l'établissement, au sein de ses résidences ou de ses locaux d'enseignement.</p>",
  },

  {
    id: "competence-hors-etablissement",
    rubrique: "competence",
    nature: "principe",
    source: "Code rural et de la pêche maritime, art. R.812-24-2",
    tags: ["Compétence", "Faits commis hors de l'établissement", "Lien suffisant"],
    titre: "Faits commis hors de l'établissement : le lien suffisant",
    texte: "<p>Il découle de ces dispositions que la section disciplinaire est compétente pour connaître des faits commis par les usagers en dehors de l'établissement, dès lors que ces faits présentent un lien suffisant avec l'établissement ou les activités qu'il organise.</p>",
  },

  {
    id: "competence-lien-suffisant-espece",
    rubrique: "competence",
    nature: "enchainement",
    source: "",
    tags: ["Compétence", "Faits commis hors de l'établissement", "Lien suffisant", "À compléter"],
    titre: "Application : le lien suffisant en l'espèce",
    texte: "<p>En l'espèce, il est établi que les faits reprochés sont intervenus à l'occasion de […], à laquelle le mis en cause participait en qualité d'usager de l'établissement. Dans ces conditions, il y a lieu de considérer que la compétence de la section disciplinaire pour connaître de ces faits est établie.</p>",
  },

  {
    id: "competence-conclusion",
    rubrique: "competence",
    nature: "enchainement",
    source: "",
    tags: ["Compétence", "Conclusion"],
    titre: "Conclusion sur la compétence",
    texte: "<p>Il découle de tout ce qui précède que la présente section disciplinaire est compétente pour juger de l'affaire.</p>",
  },

  {
    id: "competence-penale",
    rubrique: "competence",
    nature: "principe",
    source: "",
    tags: ["Compétence liée", "Autorité judiciaire", "Violences sexuelles et sexistes"],
    titre: "Le juge disciplinaire ne qualifie pas pénalement les faits",
    texte: "<p>Les faits rapportés sont susceptibles d'être qualifiés de […] par l'autorité judiciaire, seule compétente en la matière ; il n'appartient pas à la présente formation de qualifier pénalement les faits, cette compétence relevant de la seule autorité judiciaire.</p>",
  },

  {
    id: "rural-ecole-interne",
    rubrique: "competence",
    nature: "texte",
    domaine: "agriculture",
    source: "Code rural et de la pêche maritime, art. R.812-24-7",
    tags: ["École interne", "Sanctions", "Compétence"],
    titre: "Écoles internes : établissements distincts",
    texte: "<p>Aux termes de l'article R.812-24-7 du code rural et de la pêche maritime : « Les écoles internes sont considérées comme des établissements distincts de celui au sein duquel elles ont été créées pour l'application des sanctions. »</p>",
  },

  /* --- Procédure -------------------------------------------------- */

  {
    id: "procedure-contradictoire",
    rubrique: "procedure",
    nature: "principe",
    source: "",
    tags: ["Procédure", "Contradictoire", "Convocation", "Dossier", "Observations"],
    titre: "Le respect du contradictoire",
    texte: "<p>Le respect du contradictoire suppose que la personne mise en cause ait été régulièrement convoquée, qu'elle ait eu connaissance du rapport d'instruction ainsi que de l'ensemble des pièces du dossier, et qu'elle ait été mise à même de présenter ses observations, par écrit comme à l'audience.</p>",
  },

  {
    id: "procedure-dossier-communique",
    rubrique: "procedure",
    nature: "enchainement",
    source: "",
    tags: ["Procédure", "Dossier", "Communication des pièces"],
    titre: "Communication du rapport et des pièces",
    texte: "<p>Le rapport d'instruction ainsi que l'ensemble des pièces du dossier ont été envoyés à la personne mise en cause ainsi qu'aux membres de la formation de jugement par voie électronique le […].</p>",
  },

  {
    id: "procedure-droit-au-silence",
    rubrique: "procedure",
    nature: "enchainement",
    source: "",
    tags: ["Procédure", "Droit au silence", "Audience"],
    titre: "Présence et droit au silence",
    texte: "<p>La personne mise en cause était présente dans la salle et informée de son droit au silence.</p>",
  },

  {
    id: "procedure-conclusions-saisine",
    rubrique: "procedure",
    nature: "enchainement",
    source: "",
    tags: ["Procédure", "Observations écrites", "Défense"],
    titre: "Observations écrites appelant un abandon des poursuites",
    texte: "<p>Par des observations écrites transmises au secrétariat de la section disciplinaire le […], la personne mise en cause conteste les faits qui lui sont reprochés, et doit être regardée comme demandant à ce que les poursuites engagées à son encontre soient abandonnées.</p>",
  },

  /* --- Prescription ----------------------------------------------- */

  {
    id: "prescription-usagers",
    rubrique: "prescription",
    nature: "principe",
    source: "",
    tags: ["Prescription", "Usagers", "Action disciplinaire"],
    titre: "Pas de prescription de l'action disciplinaire à l'égard des usagers",
    texte: "<p>Les poursuites engagées à l'égard d'un usager ne sont pas soumises à prescription.</p>",
  },

  {
    id: "prescription-personnels",
    rubrique: "prescription",
    nature: "principe",
    source: "Code général de la fonction publique, art. L. 532-2",
    domaine: "education",
    tags: ["Prescription", "Personnels", "Enseignants-chercheurs"],
    titre: "Prescription de l'action disciplinaire à l'égard d'un personnel",
    texte: "<p>Aucune action disciplinaire ne peut être engagée au-delà d'un délai de trois ans à compter de la date à laquelle l'administration a eu une connaissance effective de la réalité, de la nature et de l'ampleur des faits passibles de sanction.</p>",
  },

  /* --- Requalification -------------------------------------------- */

  {
    id: "requalification-principe",
    rubrique: "requalification",
    nature: "principe",
    source: "CE, 17 février 1995, Hardouin et Marie",
    tags: ["Requalification", "Jurisprudence", "Contradictoire", "Conseil d'État"],
    titre: "Le juge n'est pas lié par la qualification initiale des faits",
    texte: "<p>Comme l'a rappelé le Conseil national de l'enseignement supérieur et de la recherche agricole, alimentaire et vétérinaire statuant en matière disciplinaire, il résulte d'une jurisprudence constante du Conseil d'État que le juge n'est pas lié par la qualification juridique initialement donnée aux faits ou aux actes dont il est saisi. Il peut en effet les requalifier, notamment lorsqu'ils présentent un caractère disciplinaire, à condition que le respect du contradictoire soit assuré et que les parties aient eu la possibilité de formuler leurs observations sur cette requalification.</p>",
  },

  {
    id: "requalification-transposition",
    rubrique: "requalification",
    nature: "principe",
    source: "",
    // L'affirmation sur la qualité juridique des sections « depuis le 1er janvier
    // 2026 » n'est adossée à aucune source citée : elle attend le visa du service
    // juridique (NC-0019), et la page Références la signale comme telle.
    aVerifier: true,
    tags: ["Requalification", "Jugement des usagers", "Indépendance"],
    titre: "Un pouvoir d'appréciation autonome sur la qualification des faits",
    texte: "<p>Si ces principes sont applicables en premier lieu aux juridictions administratives, ils sont transposables aux sections disciplinaires compétentes à l'égard des usagers de l'enseignement supérieur agricole. En effet, bien que ces dernières ne disposent plus de la qualité de juridictions administratives spécialisées depuis le 1er janvier 2026, elles conservent une indépendance hiérarchique et fonctionnelle complète vis-à-vis de l'autorité ayant engagé les poursuites, leur conférant dès lors un pouvoir d'appréciation autonome sur la qualification des faits qui leur sont soumis.</p>",
  },

  {
    id: "requalification-information",
    rubrique: "requalification",
    nature: "enchainement",
    source: "",
    tags: ["Requalification", "Contradictoire", "Abandon des poursuites", "À compléter"],
    titre: "Information de la personne mise en cause, et suite de l'examen",
    texte: "<p>Par suite, il est établi que le président de la section disciplinaire a informé, par courrier envoyé le […], la personne mise en cause que les faits ayant motivé les poursuites étaient susceptibles de faire l'objet d'une requalification par la formation de jugement, et qu'elle a été mise à même de présenter des observations sur cette requalification. Dans ces conditions, il y a lieu de poursuivre l'examen de l'affaire, et de rejeter la demande d'abandon des poursuites formulée par la personne mise en cause.</p>",
  },

  /* --- Matérialité et qualification ------------------------------- */

  {
    id: "enchainement-il-ressort-instruction",
    rubrique: "materialite",
    nature: "enchainement",
    source: "",
    tags: ["Matérialité des faits", "Rapport d'instruction", "À compléter"],
    titre: "Ouverture : « Il ressort de l'instruction que… »",
    texte: "<p>Il ressort de l'instruction que […].</p>",
  },

  {
    id: "enchainement-il-ressort-pieces",
    rubrique: "materialite",
    nature: "enchainement",
    source: "",
    tags: ["Matérialité des faits", "Pièces du dossier", "À compléter"],
    titre: "Ouverture : « Il ressort des pièces du dossier que… »",
    texte: "<p>Il ressort des pièces du dossier que […].</p>",
  },

  {
    id: "enchainement-il-est-etabli",
    rubrique: "materialite",
    nature: "enchainement",
    source: "",
    tags: ["Matérialité des faits", "Preuve", "À compléter"],
    titre: "Ouverture : « Il est établi que… »",
    texte: "<p>Il est établi que […].</p>",
  },

  {
    id: "enchainement-toutefois",
    rubrique: "materialite",
    nature: "enchainement",
    source: "",
    tags: ["Matérialité des faits", "Contestation", "À compléter"],
    titre: "Opposition : « Toutefois, il ressort de l'instruction que… »",
    texte: "<p>Toutefois, il ressort de l'instruction que […].</p>",
  },

  {
    id: "materialite-etablie",
    rubrique: "materialite",
    nature: "enchainement",
    source: "",
    tags: ["Matérialité des faits", "Conclusion"],
    titre: "Conclusion sur la matérialité des faits",
    texte: "<p>Il découle de tout ce qui précède que la matérialité des faits est suffisamment établie pour statuer sur la présente affaire.</p>",
  },

  {
    id: "qualification-telephone-examen",
    rubrique: "qualification",
    nature: "principe",
    source: "",
    tags: ["Vie universitaire", "Téléphone en examen", "Fraude", "Examen"],
    titre: "Conserver son téléphone pendant un examen",
    texte: "<p>Il résulte de tout ce qui précède que le fait, pour un usager, de conserver son téléphone portable en fonctionnement, ainsi que sur sa personne durant un examen, est constitutif d'un fait de méconnaissance de dispositions relatives à la vie universitaire.</p>",
  },

  {
    id: "qualification-nullite-epreuve",
    rubrique: "qualification",
    nature: "enchainement",
    source: "",
    tags: ["Fraude", "Examen", "Nullité de l'épreuve"],
    titre: "Absence de fraude : pas de nullité de l'épreuve",
    texte: "<p>Dans ces circonstances, la décision de la commission de discipline n'entraîne pas la nullité de l'épreuve.</p>",
  },

  {
    id: "qualification-reputation",
    rubrique: "qualification",
    nature: "enchainement",
    source: "",
    tags: ["Réputation de l'établissement", "Ordre et bon fonctionnement", "À compléter"],
    titre: "Atteinte à la réputation de l'établissement",
    texte: "<p>Dans ces conditions, il y a lieu de considérer que l'atteinte à la réputation de l'établissement au sens du 5° de l'article R.812-24-2 du code rural et de la pêche maritime est matériellement établie.</p>",
  },

  {
    id: "qualification-ordre-bon-fonctionnement",
    rubrique: "qualification",
    nature: "principe",
    source: "",
    tags: ["Ordre et bon fonctionnement", "Communauté étudiante", "Violences sexuelles et sexistes"],
    titre: "Atteinte à l'ordre et au bon fonctionnement de l'établissement",
    texte: "<p>Les agissements commis portent atteinte à l'ordre et au bon fonctionnement de l'établissement, de par leurs conséquences sur la personne qui les a rapportés ainsi que sur la communauté étudiante et sur la vie de l'établissement.</p>",
  },

  {
    id: "qualification-consentement",
    rubrique: "qualification",
    nature: "principe",
    source: "",
    tags: ["Consentement", "Violences sexuelles et sexistes", "Alcool", "À compléter"],
    titre: "Absence de consentement éclairé",
    texte: "<p>Il ressort des pièces du dossier, du rapport d'instruction ainsi que de l'audience que le consentement de la personne qui a rapporté les faits n'était pas établi, tel qu'il ressort notamment de […]. Les faits rapportés, pris dans leur ensemble, laissent planer un doute sérieux quant au consentement éclairé de cette dernière.</p>",
  },

  /* --- Conséquences ----------------------------------------------- */

  {
    id: "consequences-impact",
    rubrique: "consequences",
    nature: "enchainement",
    source: "",
    tags: ["Conséquences des faits", "Retentissement", "Communauté étudiante", "À compléter"],
    titre: "Retentissement sur la personne et sur la promotion",
    texte: "<p>Il découle de l'instruction que les faits ont eu un impact psychologique important sur […], qui a depuis entamé une thérapie, ainsi qu'un impact sur sa scolarité et sur ses résultats. Ces faits ont également eu des conséquences sur la promotion concernée, les témoignages faisant état de rumeurs largement répandues, susceptibles de troubler l'ambiance et les relations au sein de la vie étudiante de l'établissement.</p>",
  },

  {
    id: "consequences-prevention",
    rubrique: "consequences",
    nature: "enchainement",
    source: "",
    tags: ["Conséquences des faits", "Mesures préventives", "À compléter"],
    titre: "Mesures préventives prises dans l'attente du jugement",
    texte: "<p>La personne mise en cause a fait l'objet de mesures préventives à compter de […], portant notamment sur […].</p>",
  },

  /* --- Appréciation par le mis en cause --------------------------- */

  {
    id: "appreciation-regret",
    rubrique: "appreciation",
    nature: "enchainement",
    source: "",
    tags: ["Appréciation des faits", "Regret", "Reconnaissance des faits"],
    titre: "Regret et prise de conscience",
    texte: "<p>Il ressort de l'audience que la personne mise en cause exprime un regret certain concernant ses actes, qu'elle reconnaît, et laisse paraître une prise de conscience sur ces derniers. Toutefois, il ressort également des échanges à l'occasion de l'audience que cette démarche n'est pas complètement aboutie.</p>",
  },

  {
    id: "appreciation-antecedents",
    rubrique: "appreciation",
    nature: "enchainement",
    source: "",
    tags: ["Appréciation des faits", "Antécédents", "Récidive", "À compléter"],
    titre: "Antécédent disciplinaire ou rappel à l'ordre",
    texte: "<p>Il ressort de l'instruction que la personne mise en cause avait déjà fait l'objet, le […], d'un avertissement écrit de la part de […]. S'il est établi que cet avertissement n'avait pas abouti à une saisine de la section disciplinaire, il est constant que les évènements sur lesquels la formation de jugement a à statuer s'inscrivent dans la continuité de ceux relevés par l'administration.</p>",
  },

  {
    id: "appreciation-risque-recidive",
    rubrique: "appreciation",
    nature: "principe",
    source: "",
    tags: ["Appréciation des faits", "Récidive", "Risque"],
    titre: "Un risque de récidive qui ne peut être exclu",
    texte: "<p>Le comportement de la personne mise en cause, tel qu'adopté de façon répétée, ne permet pas d'exclure tout risque de récidive, d'autant plus qu'elle fait état de difficultés comportementales importantes.</p>",
  },

  {
    id: "appreciation-absence-antecedent",
    rubrique: "appreciation",
    nature: "enchainement",
    source: "",
    tags: ["Appréciation des faits", "Individualisation", "Circonstances atténuantes"],
    titre: "Circonstances atténuantes : absence d'antécédent et reconnaissance",
    texte: "<p>Il convient de tenir compte de l'absence d'antécédent disciplinaire ainsi que de la reconnaissance des faits par l'usager.</p>",
  },

  /* --- Sanction --------------------------------------------------- */

  {
    id: "education-echelle-sanctions-r811-13",
    rubrique: "sanction",
    nature: "texte",
    domaine: "education",
    source: "Code de l'éducation, art. R.811-13 (rédaction citée par les décisions de 2026)",
    tags: ["Sanctions", "Échelle des sanctions", "Code de l'éducation"],
    titre: "Échelle des sanctions des usagers (R.811-13)",
    texte: "<p>Aux termes de l'article R.811-13 du code de l'éducation : « I. - Les sanctions disciplinaires applicables aux usagers des établissements publics d'enseignement supérieur sont : 1° L'avertissement ; 2° Le blâme ; 3° La mesure de responsabilisation définie au II ; 4° L'exclusion de l'établissement pour une durée maximum de cinq ans. Cette sanction peut être prononcée avec sursis si l'exclusion n'excède pas deux ans ; 5° L'exclusion définitive de l'établissement ; 6° L'exclusion de tout établissement public d'enseignement supérieur pour une durée maximum de cinq ans ; 7° L'exclusion définitive de tout établissement public d'enseignement supérieur. »</p>",
  },

  {
    id: "education-echelle-sanctions-r811-13-1",
    rubrique: "sanction",
    nature: "texte",
    domaine: "education",
    source: "Code de l'éducation, art. R.811-13-1 (rédaction citée par les décisions de 2026)",
    tags: ["Sanctions", "Échelle des sanctions", "Code de l'éducation"],
    titre: "Échelle des sanctions des usagers (R.811-13-1)",
    texte: "<p>Aux termes de l'article R.811-13-1 du code de l'éducation : « I. - Les sanctions disciplinaires applicables aux usagers des établissements publics d'enseignement supérieur sont : 1° L'avertissement ; 2° Le blâme ; 3° La mesure de responsabilisation définie au II ; 4° L'exclusion de l'établissement pour une durée maximum de cinq ans. Cette sanction peut être prononcée avec sursis si l'exclusion n'excède pas deux ans ; 5° L'exclusion définitive de l'établissement ; 6° L'exclusion de tout établissement public d'enseignement supérieur pour une durée maximum de cinq ans ; 7° L'exclusion définitive de tout établissement public d'enseignement supérieur. »</p>",
  },

  {
    id: "rural-echelle-sanctions",
    rubrique: "sanction",
    nature: "texte",
    domaine: "agriculture",
    source: "Code rural et de la pêche maritime, art. R.812-24-36",
    tags: ["Sanctions", "Échelle des sanctions", "Code rural", "Enseignement supérieur agricole"],
    titre: "Échelle des sanctions (enseignement supérieur agricole)",
    texte: "<p>Aux termes de l'article R.812-24-36 du code rural et de la pêche maritime : « Les sanctions disciplinaires applicables aux usagers des établissements de l'enseignement supérieur agricole publics sont : 1° L'avertissement ; 2° Le blâme ; 3° L'exclusion de l'établissement pour une durée maximum de cinq ans. Cette sanction peut être prononcée avec sursis si l'exclusion n'excède pas deux ans ; 4° L'exclusion définitive de l'établissement ; 5° L'exclusion de tout établissement public d'enseignement supérieur pour une durée maximum de cinq ans ; 6° L'exclusion définitive de tout établissement public d'enseignement supérieur. »</p>",
  },

  {
    id: "rural-effets-sanction",
    rubrique: "sanction",
    nature: "texte",
    domaine: "agriculture",
    source: "Code rural et de la pêche maritime, art. R.812-24-36",
    tags: ["Sanctions", "Effets de la sanction", "Incapacité d'inscription"],
    titre: "Effets attachés à l'exclusion",
    texte: "<p>Conformément aux dispositions de l'article R.812-24-36 du code rural et de la pêche maritime, la sanction prononcée entraîne en outre l'incapacité de prendre des inscriptions dans le ou les établissements publics dispensant des formations post-baccalauréat et de subir des examens sanctionnant ces formations.</p>",
  },

  {
    id: "education-r811-40-proposition",
    rubrique: "sanction",
    nature: "texte",
    domaine: "education",
    source: "Code de l'éducation, art. R.811-40",
    tags: ["R.811-40", "Proposition de sanction", "Reconnaissance des faits"],
    titre: "Proposition de sanction acceptée par l'usager",
    texte: "<p>Aux termes de l'article R.811-40 du code de l'éducation : « Dans les cas mentionnés au 2° de l'article R.811-11 ainsi que, lorsque les faits sont de faible gravité et n'ont pas lésé un tiers, dans les cas mentionnés aux 1° et 5° du même article, le président de l'université peut proposer une sanction à l'usager qui reconnaît les faits. (…) Si la commission de discipline adopte la proposition, la sanction prévue est notifiée dans les conditions prévues à l'article R.811-39. (…) Le rejet par la commission de discipline de la proposition de sanction n'est pas susceptible de recours. »</p>",
  },

  {
    id: "sanction-proportionnalite",
    rubrique: "sanction",
    nature: "principe",
    source: "",
    tags: ["Individualisation", "Proportionnalité", "Sanctions"],
    titre: "Individualisation de la sanction",
    texte: "<p>Il appartient à la formation de prononcer une sanction proportionnée à la gravité des faits, en tenant compte de leur nature et de leurs conséquences, de la situation de la personne mise en cause, de sa personnalité et de sa démarche de prise de conscience.</p>",
  },

  {
    id: "sanction-il-convient",
    rubrique: "sanction",
    nature: "enchainement",
    source: "",
    tags: ["Sanctions", "Prononcé de la sanction", "À compléter"],
    titre: "Prononcé : « il convient de prononcer… »",
    texte: "<p>Il découle de tout ce qui précède que, compte tenu de […], il convient de prononcer à l'encontre de la personne mise en cause la sanction suivante : […].</p>",
  },

  {
    id: "sanction-sursis",
    rubrique: "sanction",
    nature: "enchainement",
    source: "",
    tags: ["Sanctions", "Sursis", "À compléter"],
    titre: "Prononcé avec sursis",
    texte: "<p>Il convient d'assortir cette sanction d'un sursis à exécution, afin de tenir compte de […] sans méconnaître la gravité des faits.</p>",
  },

  {
    id: "sanction-duree-choisie",
    rubrique: "sanction",
    nature: "enchainement",
    source: "",
    tags: ["Sanctions", "Durée", "À compléter"],
    titre: "Durée de l'exclusion, et son terme",
    texte: "<p>La durée de […] mois retenue permet à la personne mise en cause de poursuivre ses démarches et de reprendre sereinement ses études à l'issue de la sanction.</p>",
  },

  /* --- Textes propres à l'établissement --------------------------- */

  {
    id: "reglement-scolarite-faux-document",
    rubrique: "qualification",
    nature: "texte",
    source: "Règlement de la scolarité, art. 3 (rédaction citée par les décisions)",
    tags: ["Faux document", "Absence", "Certificat médical", "Règlement de la scolarité"],
    titre: "Faux justificatif d'absence",
    texte: "<p>Aux termes de l'article 3 du règlement de la scolarité applicable à l'année universitaire […] : « Afin de justifier son absence, l'apprenant doit remettre en main propre au service de la scolarité un justificatif original (attestation, certificat médical) qui pourra faire l'objet d'une vérification. Toute utilisation d'un faux document entraînera l'ouverture d'une procédure disciplinaire. »</p>",
  },

  {
    id: "reglement-scolarite-telephone",
    rubrique: "qualification",
    nature: "texte",
    source: "Règlement de la scolarité, art. 2.1 et 2.3.1 (rédaction citée par les décisions)",
    tags: ["Téléphone en examen", "Règlement de la scolarité", "Matériel non autorisé"],
    titre: "Interdiction des moyens de communication en examen",
    texte: "<p>Aux termes de l'article 2.1 du règlement de la scolarité applicable aux étudiants inscrits en cursus d'ingénieur pour l'année […] : « Pendant l'examen, l'apprenant doit éteindre tout téléphone portable et tout moyen de communication avec l'extérieur et avec quiconque. » Aux termes de l'article 2.3.1 du même règlement : « Sont portées à la connaissance des apprenants les interdictions suivantes. Il est notamment strictement interdit : de communiquer entre apprenants ou avec l'extérieur ; d'utiliser ou même de conserver sans les utiliser des documents ou matériels non autorisés pendant l'épreuve, d'utiliser tout appareil électronique et/ou de communication à distance non autorisé (par exemple : téléphone mobile, tablette numérique, ordinateur portable, objets connectés, messagerie, agenda numérique, traducteur électronique…). »</p>",
  },

  /* --- Conclusion : la formule d'abandon -------------------------- */

  {
    id: "abandon-des-poursuites",
    rubrique: "abandon",
    nature: "enchainement",
    source: "",
    tags: ["Abandon des poursuites", "Issue de procédure", "À compléter"],
    titre: "Prononcé de l'abandon des poursuites",
    texte: "<p>Dans ces conditions, il n'est pas possible d'établir que le comportement de la personne mise en cause ait constitué […]. Dès lors, il y a lieu de prononcer l'abandon des poursuites.</p>",
  },

  {
    id: "conclusion-tout-ce-qui-precede",
    rubrique: "motifs",
    nature: "enchainement",
    source: "",
    tags: ["Conclusion", "À compléter"],
    titre: "Conclusion générale : « Il résulte de tout ce qui précède que… »",
    texte: "<p>Il résulte de tout ce qui précède que […].</p>",
  },
];

/* ------------------------------------------------------------------ */
/* Lecture du répertoire de l'établissement                            */
/* ------------------------------------------------------------------ */

/** Tags d'une valeur écrite « fraude, examen, téléphone ». */
export function listeTags(valeur) {
  return String(valeur ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Forme d'un considérant, quelle que soit sa provenance. */
function forme({ id, rubrique, nature = "principe", titre = "", texte = "", tags = [], source = "", domaine = "", origine = "", usage = 0, ligne = null, aVerifier = false }) {
  return {
    id,
    ligne,                      // identifiant de la ligne `Considerants`, ou null
    rubrique,
    nature,
    titre,
    texte,
    tags,
    source,
    domaine,
    origine,                    // identifiant du considérant livré adapté, ou ""
    usage: Number(usage) || 0,
    livre: !ligne,              // livré avec l'outil : ni modifiable ni supprimable en place
    aVerifier: Boolean(aVerifier), // affirmation à faire viser par le service juridique
  };
}

/** Les considérants de la table `Considerants`, sous la forme du répertoire. */
export function considerantsEnregistres(db) {
  return (db?.Considerants || []).map((r) => forme({
    id: `c${r.id}`,
    ligne: r.id,
    rubrique: rubriqueDe(r.Rubrique)?.id || "",
    nature: natureDe(r.Nature)?.id || "principe",
    titre: String(r.Titre || "").trim(),
    texte: String(r.Texte || "").trim(),
    tags: listeTags(r.Tags),
    source: String(r.Source || "").trim(),
    domaine: domaineDe(r.Domaine)?.id || "",
    origine: String(r.Origine || "").trim(),
    usage: r.Usage,
  })).filter((c) => c.titre || c.texte);
}

/**
 * Le répertoire complet : les considérants de l'établissement, puis ceux livrés
 * avec l'outil que l'établissement n'a pas adaptés.
 *
 * L'adaptation prime : un considérant enregistré qui déclare son `Origine` prend
 * la place du considérant livré — c'est le texte de l'établissement qui fait
 * foi, et le répertoire ne montre pas deux fois la même règle.
 */
export function repertoire(db) {
  const enregistres = considerantsEnregistres(db);
  const adaptes = new Set(enregistres.map((c) => c.origine).filter(Boolean));
  const livres = CONSIDERANTS_LIVRES
    .filter((c) => !adaptes.has(c.id))
    .map((c) => forme({ ...c, domaine: c.domaine || "" }));
  return [...enregistres, ...livres];
}

/* ------------------------------------------------------------------ */
/* Références : ce que le service juridique doit viser (NC-0019)        */
/* ------------------------------------------------------------------ */

/**
 * Ce qui rend une source non retrouvable : une identité réduite à une initiale
 * ou à une anonymisation — « M. X », « Mme X », « XX », « anonyme ». Une telle
 * référence ne se vérifie pas ; elle ne doit donc pas sortir dans un acte.
 *
 * Une source absente, elle, n'est pas un défaut : le considérant se lit seul,
 * sans citer de texte.
 */
const MOTIF_NON_IDENTIFIABLE = /(\bM\.\s*X\b|\bMme\s+X\b|\bX{2,}\b|\banonyme\b)/i;

/** Une source est-elle retrouvable telle quelle ? L'absence de source passe. */
export function sourceIdentifiable(source) {
  const s = String(source ?? "").trim();
  return !s || !MOTIF_NON_IDENTIFIABLE.test(s);
}

/**
 * Les références du répertoire, réunies par source, telles qu'elles se
 * présentent à la vérification du service juridique : chaque source citée, les
 * considérants qui s'y appuient, la liste de celles qui ne sont pas
 * retrouvables, et les considérants dont une affirmation reste à vérifier
 * (`aVerifier` — voir NC-0019).
 *
 * `verifieLe` porte la date de la dernière vérification : elle vit dans les
 * seuils (`references_verifiees_le`, voir `regimes.js`) et la page Références
 * l'enregistre.
 */
export function referencesDuRepertoire(db, { verifieLe = "" } = {}) {
  const parSource = new Map();
  const aVerifier = [];
  for (const c of repertoire(db)) {
    if (c.aVerifier) {
      aVerifier.push({ id: c.id, titre: c.titre, rubrique: c.rubrique, source: c.source, livre: c.livre });
    }
    const s = String(c.source ?? "").trim();
    if (!s) continue;
    const cle = comparable(s);
    const entree = parSource.get(cle) || { source: s, retrouvable: sourceIdentifiable(s), considerants: [] };
    entree.considerants.push({
      id: c.id, titre: c.titre, rubrique: c.rubrique, nature: c.nature, domaine: c.domaine, livre: c.livre,
    });
    parSource.set(cle, entree);
  }
  const references = [...parSource.values()]
    .map((r) => ({ ...r, n: r.considerants.length }))
    // Les références non retrouvables viennent en tête : ce sont elles qu'il
    // faut d'abord reprendre.
    .sort((a, b) => (Number(a.retrouvable) - Number(b.retrouvable))
      || a.source.localeCompare(b.source, "fr"));
  return {
    verifieLe: String(verifieLe ?? "").trim(),
    total: references.length,
    nonRetrouvables: references.filter((r) => !r.retrouvable).length,
    aVerifier,
    references,
  };
}

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

/** Texte comparable : sans accent, sans casse, sans ponctuation. */
function comparable(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Les tags proposés au filtre, du plus fréquent au moins fréquent.
 *
 * Les graphies voisines sont réunies : « Fraude » et « fraude » — saisies par
 * deux rédacteurs — ne font qu'un seul tag, puisque la recherche, elle, ne
 * distingue ni la casse ni les accents. C'est la graphie la plus longue qui
 * représente le tag, et son compte est le total des deux.
 */
export function tagsDuRepertoire(liste) {
  const compte = new Map();
  for (const c of liste) {
    for (const t of c.tags) {
      const cle = comparable(t);
      if (!cle) continue;
      const entree = compte.get(cle) || { label: t, n: 0 };
      entree.n += 1;
      if (String(t).length > entree.label.length) entree.label = t;
      compte.set(cle, entree);
    }
  }
  return [...compte.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "fr"))
    .map(({ label, n }) => ({ tag: label, n }));
}

/**
 * Filtre le répertoire : une recherche libre (titre, texte, source, tags), une
 * rubrique, une nature, et des tags — tous ceux demandés doivent être présents.
 * Le tri suit l'usage : ce qui sert le plus souvent vient d'abord.
 */
export function chercher(liste, { requete = "", rubrique = "", nature = "", tags = [] } = {}) {
  const q = comparable(requete).trim();
  const voulus = tags.map(comparable);
  const mots = q ? q.split(/\s+/).filter(Boolean) : [];
  const out = liste.filter((c) => {
    if (rubrique && c.rubrique !== rubrique) return false;
    if (nature && c.nature !== nature) return false;
    if (voulus.length && !voulus.every((t) => c.tags.some((x) => comparable(x) === t))) return false;
    if (!mots.length) return true;
    const bloc = comparable([c.titre, c.texte.replace(/<[^>]*>/g, " "), c.source, c.tags.join(" ")].join(" "));
    return mots.every((m) => bloc.includes(m));
  });
  return out.sort((a, b) => rangRubrique(a.rubrique) - rangRubrique(b.rubrique)
    || b.usage - a.usage
    || a.titre.localeCompare(b.titre, "fr"));
}

/* ------------------------------------------------------------------ */
/* Insertion                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fragment insérable d'un considérant : ses paragraphes, marqués `considere`
 * pour que la décision les reconnaisse (voir « Numéroter les considérants ») —
 * et pour qu'une citation y garde sa mise en forme. Un considérant enregistré
 * arrive tel quel : c'est le texte de l'établissement.
 */
export function fragmentDe(considérant, { avecSource = false } = {}) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(considérant?.texte || "").trim();
  const racines = [...tpl.content.children];
  if (!racines.length) return "";
  for (const el of racines) {
    // Le texte du répertoire est du document : les blocs y prennent la marque
    // des considérants, et les titres éventuels restent des paragraphes.
    if (/^(P|BLOCKQUOTE|DIV)$/.test(el.tagName)) el.classList.add("considere");
  }
  const source = avecSource && considérant.source
    ? `<p class="considere-src"><em>Source : ${considérant.source}.</em></p>`
    : "";
  return tpl.innerHTML + source;
}

/** Intertitre de rubrique, insérable tel quel. */
export function intertitreDe(rubriqueId) {
  const r = rubriqueDe(rubriqueId);
  if (!r || !r.intertitre) return "";
  return `<p class="considere-intertitre">${r.intertitre}</p>`;
}
