/* ============================================================
   ENMIIS — Configurateur : catalogue de fabrication
   Données produit issues des planches de référence
   (mortier · gland · étole/capuche · robe · mesures).
   Expose window.CZ.catalog
   ============================================================ */
(function (global) {
  'use strict';

  const CZ = global.CZ || (global.CZ = {});

  /* ---------- Fichiers de production acceptés ---------- */
  const FILE_TYPES = [
    { ext: 'pdf', mime: 'application/pdf',        label: 'PDF' },
    { ext: 'png', mime: 'image/png',              label: 'PNG' },
    { ext: 'jpg', mime: 'image/jpeg',             label: 'JPG' },
    { ext: 'jpeg', mime: 'image/jpeg',            label: 'JPG' },
    { ext: 'svg', mime: 'image/svg+xml',          label: 'SVG' },
    { ext: 'ai',  mime: 'application/postscript', label: 'AI'  },
    { ext: 'eps', mime: 'application/postscript', label: 'EPS' },
    { ext: 'cdr', mime: 'application/cdr',        label: 'CDR' },
  ];
  const MAX_FILE_MB = 12;

  /* Les couleurs ne sont plus proposées au client : leur choix est
     arrêté par l'atelier avec le client à la confirmation. */

  /* ---------- Robe : cols & bordures ---------- */
  const COLLARS = [
    { id: 'v',      label: 'Col en V',       note: 'Encolure classique européenne' },
    { id: 'chale',  label: 'Col châle',      note: 'Revers arrondi enveloppant' },
    { id: 'droit',  label: 'Col officier',   note: 'Bord droit montant' },
    { id: 'sans',   label: 'Sans col',       note: 'Encolure nette, sans parement' },
  ];

  const TRIM_STYLES = [
    { id: 'double', label: 'Double parement', note: 'Deux bandes verticales' },
    { id: 'simple', label: 'Parement simple', note: 'Une bande centrale' },
    { id: 'liseré', label: 'Liseré fin',      note: 'Bordure discrète' },
    { id: 'aucun',  label: 'Sans bordure',    note: 'Contour : Non' },
  ];

  const SLEEVES = [
    { id: 'cloche',  label: 'Manche cloche',   note: 'Évasée, modèle américain' },
    { id: 'pointe',  label: 'Manche pointue',  note: 'Modèle européen classique' },
    { id: 'droite',  label: 'Manche droite',   note: 'Coupe nette et sobre' },
  ];

  /* ---------- Capuche / Étole (planche « CAPE ») ---------- */
  const HOOD_STYLES = [
    {
      id: 'etole-droite',
      label: 'Étole droite',
      note: 'Pans droits à extrémités carrées, gland à chaque pointe',
      ref: 'Planche cape — modèle 1',
    },
    {
      id: 'etole-v',
      label: 'Étole en V',
      note: 'Pans taillés en pointe, tombé graphique',
      ref: 'Planche cape — modèle 2',
    },
    {
      id: 'etole-arrondie',
      label: 'Étole arrondie',
      note: 'Extrémités adoucies, silhouette souple',
      ref: 'Planche cape — modèle 3',
    },
    {
      id: 'capuche-am',
      label: 'Capuche américaine',
      note: 'Capuchon en V doublé satin, porté dans le dos',
      ref: 'Planche cape — modèle américain',
    },
    {
      id: 'capuche-eu',
      label: 'Capuche européenne',
      note: 'Capuchon large bordé, doublure facultaire apparente',
      ref: 'Planche cape — modèle européen',
    },
  ];

  /* ---------- Mortier (planche coiffe) ---------- */
  const CAP_STYLES = [
    { id: 'classique', label: 'Mortier classique', note: 'Plateau carré, gland à droite',   tassel: 'right' },
    { id: 'incline',   label: 'Mortier incliné',   note: 'Plateau porté vers l’avant',      tassel: 'front' },
    { id: 'plat',      label: 'Mortier plat',      note: 'Plateau bas, gland tombant droit', tassel: 'left'  },
  ];

  const CAP_MATERIALS = [
    { id: 'gabardine', label: 'Gabardine rigide', note: 'Plateau parfaitement plan' },
    { id: 'velours',   label: 'Velours',          note: 'Finition doctorale' },
    { id: 'satin',     label: 'Satin',            note: 'Reflet soutenu' },
  ];

  /* ---------- Gland (planche tassel) ---------- */
  const TASSEL_STYLES = [
    { id: 'noeud',    label: 'Gland à nœud',     note: 'Tête ornée d’un nœud décoratif',  ref: 'Planche gland — modèle 1' },
    { id: 'cannele',  label: 'Gland cannelé',    note: 'Tête à torsade bouillonnée',      ref: 'Planche gland — modèle 2' },
    { id: 'lisse',    label: 'Gland lisse',      note: 'Tête nette, franges longues',     ref: 'Planche gland — modèle 3' },
    { id: 'fin',      label: 'Gland fin',        note: 'Version fine et légère',          ref: 'Planche gland — modèle 4' },
  ];

  /* ---------- Mesures (repères 1 à 6 de la planche « ROBE ») ---------- */
  const MEASUREMENTS = [
    {
      id: 'height', label: 'Stature', unit: 'cm', min: 130, max: 215, placeholder: '172',
      hint: 'Debout, sans chaussures',
      guide: {
        figure: 'height',
        steps: [
          'Tenez-vous droit, dos contre un mur, talons joints et sans chaussures.',
          'Posez une règle à plat sur le sommet du crâne, perpendiculaire au mur.',
          'Marquez le mur au crayon puis mesurez du sol jusqu’à la marque.',
        ],
        tip: 'La stature détermine la longueur totale de la robe (repère 1 de la planche).',
      },
    },
    {
      id: 'weight', label: 'Poids', unit: 'kg', min: 35, max: 180, placeholder: '68',
      hint: 'Pour l’aisance de coupe',
      guide: {
        figure: 'weight',
        steps: [
          'Pesez-vous le matin, à jeun, sur une surface dure et plane.',
          'Notez le poids en kilogrammes, arrondi au demi-kilo.',
        ],
        tip: 'Le poids affine l’aisance ajoutée au tour de poitrine et de hanches.',
      },
    },
    {
      id: 'head', label: 'Tour de tête', unit: 'cm', min: 46, max: 68, placeholder: '56',
      hint: 'Circonférence du mortier',
      guide: {
        figure: 'head',
        /* Les trois passages du ruban de la planche coiffe, présentés côte à
           côte comme sur la planche plutôt qu’en liste verticale. */
        row: [
          { n: 1, figure: 'head1', title: 'Sur le front', text: 'Ruban à plat, juste au-dessus des sourcils.' },
          { n: 2, figure: 'head2', title: 'Au-dessus des oreilles', text: 'Sans les écraser, ruban bien horizontal.' },
          { n: 3, figure: 'head3', title: 'Sur la nuque', text: 'Au point le plus large de l’arrière du crâne.' },
        ],
        steps: [
          'Faites les trois passages ci-dessus et retenez la valeur la plus grande.',
          'Le ruban doit poser sans serrer : glissez un doigt dessous pour vérifier.',
        ],
        tip: 'Cheveux détachés et sans accessoire : c’est cette mesure qui donne la taille du mortier.',
      },
    },
    {
      id: 'chest', label: 'Tour de poitrine', unit: 'cm', min: 60, max: 160, placeholder: '96',
      hint: 'Repère 6 de la planche',
      guide: {
        figure: 'chest',
        steps: [
          'Passez le mètre autour du buste, au niveau le plus fort de la poitrine.',
          'Gardez le ruban horizontal, y compris dans le dos.',
          'Respirez normalement, sans gonfler la poitrine, puis relevez la valeur.',
        ],
        tip: 'Portez un vêtement fin : mesurez par-dessus une chemise, jamais par-dessus un pull.',
      },
    },
    {
      id: 'waist', label: 'Tour de taille', unit: 'cm', min: 50, max: 150, placeholder: '78',
      hint: 'Partie la plus étroite',
      guide: {
        figure: 'waist',
        steps: [
          'Repérez la partie la plus étroite du buste, au-dessus du nombril.',
          'Entourez-la du mètre, sans serrer ni relâcher.',
          'Relâchez le ventre et relevez la mesure.',
        ],
        tip: 'Glissez un doigt sous le ruban : il doit passer sans forcer.',
      },
    },
    {
      id: 'hip', label: 'Tour de hanches', unit: 'cm', min: 60, max: 170, placeholder: '100',
      hint: 'Point le plus fort',
      guide: {
        figure: 'hip',
        steps: [
          'Debout, pieds joints, mesurez à l’endroit le plus fort des hanches.',
          'Vérifiez dans un miroir que le ruban reste parallèle au sol.',
        ],
        tip: 'Cette mesure conditionne la largeur du bas de robe (repère 3).',
      },
    },
    {
      id: 'shoulder', label: 'Largeur d’épaules', unit: 'cm', min: 30, max: 65, placeholder: '42',
      hint: 'Repère 2 de la planche',
      guide: {
        figure: 'shoulder',
        steps: [
          'Faites-vous aider : la mesure se prend de dos.',
          'Repérez l’os saillant à l’extrémité de chaque épaule.',
          'Mesurez d’un point à l’autre en suivant la ligne du dos.',
        ],
        tip: 'Ne mesurez pas en ligne droite dans l’air : le mètre doit épouser le dos.',
      },
    },
    {
      id: 'sleeve', label: 'Longueur de manche', unit: 'cm', min: 40, max: 80, placeholder: '60',
      hint: 'Repère 5 de la planche',
      guide: {
        figure: 'sleeve',
        steps: [
          'Bras légèrement fléchi, main sur la hanche.',
          'Partez du sommet de l’épaule, descendez par le coude jusqu’au poignet.',
          'Relevez la valeur totale en suivant la courbe du bras.',
        ],
        tip: 'Le poignet correspond à l’os saillant, pas à la base de la main.',
      },
    },
    {
      id: 'gown', label: 'Longueur de robe', unit: 'cm', min: 100, max: 165, placeholder: '135',
      hint: 'Repère 1 de la planche',
      guide: {
        figure: 'gown',
        steps: [
          'Portez les chaussures prévues pour la cérémonie.',
          'Mesurez depuis la base de la nuque jusqu’à la hauteur d’ourlet souhaitée.',
          'L’ourlet traditionnel s’arrête à mi-mollet.',
        ],
        tip: 'En cas de doute, indiquez la hauteur d’ourlet souhaitée dans les remarques.',
      },
    },
  ];

  /* Ordre de référence des étapes. Chaque produit n’en retient que
     celles qui le concernent — voir PRODUCTS et stepsFor() plus bas. */
  const STEPS = [
    { id: 'upload',  title: 'Vos fichiers',   phase: 'Production', sub: 'Téléversez les designs à broder ou imprimer.' },
    { id: 'robe',    title: 'La Robe',        phase: 'Modèle',     sub: 'Coupe des manches, col, bordure et broderie personnalisée.' },
    { id: 'hood',    title: 'L’Écharpe',      phase: 'Modèle',     sub: 'Choisissez le modèle : chaque forme est illustrée.' },
    { id: 'cap',     title: 'La Casquette',   phase: 'Modèle',     sub: 'Forme du plateau, matière, broderie et logo.' },
    { id: 'tassel',  title: 'Le Gland',       phase: 'Modèle',     sub: 'Style du gland et année de promotion.' },
    { id: 'measure', title: 'Vos Mesures',    phase: 'Atelier',    sub: 'Chaque mesure est accompagnée de son guide.' },
    /* Dernière étape : la pièce rejoint le panier. Les coordonnées et
       l'envoi de la commande se font au panier, une seule fois pour
       toutes les pièces. */
    { id: 'review',  title: 'Récapitulatif',  phase: 'Validation', sub: 'Vérifiez, puis ajoutez cette pièce au panier.' },
  ];

  /* ---------- Les trois pièces de soutenance ----------
     Chacune est un produit indépendant : son propre configurateur,
     sa propre ligne au panier, son propre prix. Les mesures demandées
     se limitent à celles que l'atelier utilise réellement pour la
     pièce — inutile de relever neuf mesures pour une casquette. */
  const PRODUCTS = [
    {
      id: 'robe',
      label: 'Robe',
      the: 'la robe',
      cta: 'Configurer la robe',
      price: 120,
      photo: 'img/soutenance/1.png',
      tagline: 'Toge de soutenance',
      desc: 'Gabardine de laine noble, coupe sur mesure et broderie personnalisée au fil d’or.',
      steps: ['upload', 'robe', 'measure', 'review'],
      measures: ['height', 'weight', 'chest', 'waist', 'hip', 'shoulder', 'sleeve', 'gown'],
      /* La broderie de la robe est obligatoire : son design doit être fourni. */
      fileRequired: true,
    },
    {
      id: 'casquette',
      label: 'Casquette',
      the: 'la casquette',
      cta: 'Configurer la casquette',
      price: 35,
      photo: 'img/cap.webp',
      tagline: 'Mortier de diplômé',
      desc: 'Plateau carré parfaitement plan, gland assorti et broderie du plateau.',
      steps: ['upload', 'cap', 'tassel', 'measure', 'review'],
      measures: ['head'],
      fileRequired: false,
    },
    {
      id: 'echarpe',
      label: 'Écharpe',
      the: 'l’écharpe',
      cta: 'Configurer l’écharpe',
      price: 25,
      photo: 'img/hood.webp',
      tagline: 'Étole de félicitations',
      desc: 'Satin doublé, pans brodés à votre nom, à votre faculté ou à votre mention.',
      steps: ['upload', 'hood', 'measure', 'review'],
      measures: ['height'],
      fileRequired: false,
    },
  ];

  function product(id) {
    return PRODUCTS.find((p) => p.id === id) || PRODUCTS[0];
  }

  /* Étapes résolues d'un produit, dans l'ordre, prêtes à afficher. */
  function stepsFor(productId) {
    const def = product(productId);
    return def.steps.map((stepId) => STEPS.find((s) => s.id === stepId));
  }

  /* Mesures demandées pour un produit, dans l'ordre de la planche. */
  function measuresFor(productId) {
    const wanted = product(productId).measures;
    return MEASUREMENTS.filter((m) => wanted.indexOf(m.id) > -1);
  }

  const price = (value) => value + ' DT';

  const REGIONS = ['Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
    'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine',
    'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine',
    'Tozeur', 'Tunis', 'Zaghouan'];

  /* ---------- Codes promo ----------
     Ils ne servent pas à afficher une remise : ils indiquent à
     l'atelier par quel canal la cliente est arrivée. Le montant
     éventuel se règle de vive voix à la confirmation. */
  const PROMO_CODES = ['IHEC_CARTHAGE'];

  const normalizePromo = (raw) => String(raw || '').trim().toUpperCase().replace(/\s+/g, '_');

  function isPromo(raw) {
    return PROMO_CODES.indexOf(normalizePromo(raw)) > -1;
  }

  /* Recherche d’un élément par identifiant, avec repli sur le premier. */
  function find(list, id) {
    return list.find((item) => item.id === id) || list[0];
  }

  CZ.catalog = {
    FILE_TYPES, MAX_FILE_MB,
    COLLARS, TRIM_STYLES, SLEEVES,
    HOOD_STYLES, CAP_STYLES, CAP_MATERIALS, TASSEL_STYLES,
    MEASUREMENTS, STEPS, REGIONS,
    PRODUCTS, product, stepsFor, measuresFor, price,
    PROMO_CODES, isPromo, normalizePromo,
    find,
  };
})(window);
