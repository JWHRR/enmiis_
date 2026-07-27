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

  /* ---------- Palettes ---------- */
  const MAIN_COLORS = [
    { id: 'noir',       label: 'Noir Classique',  hex: '#17171A' },
    { id: 'marine',     label: 'Bleu Marine',     hex: '#1F2A44' },
    { id: 'bordeaux',   label: 'Bordeaux',        hex: '#5C1F2B' },
    { id: 'anthracite', label: 'Gris Anthracite', hex: '#3C3F45' },
    { id: 'ivoire',     label: 'Blanc Ivoire',    hex: '#F1EDE4' },
    { id: 'emeraude',   label: 'Vert Émeraude',   hex: '#14544A' },
    { id: 'pourpre',    label: 'Pourpre Royal',   hex: '#46244C' },
    { id: 'nuit',       label: 'Bleu Nuit',       hex: '#141B33' },
  ];

  const TRIM_COLORS = [
    { id: 'or',       label: 'Or',           hex: '#C8A86B' },
    { id: 'argent',   label: 'Argent',       hex: '#C9CCD4' },
    { id: 'blanc',    label: 'Blanc Satin',  hex: '#F5F2EA' },
    { id: 'noir',     label: 'Noir',         hex: '#17171A' },
    { id: 'grenat',   label: 'Rouge Grenat', hex: '#8E2A35' },
    { id: 'roi',      label: 'Bleu Roi',     hex: '#24427C' },
    { id: 'emeraude', label: 'Émeraude',     hex: '#14544A' },
    { id: 'rose',     label: 'Rose Poudré',  hex: '#E3B5BE' },
  ];

  const THREAD_COLORS = [
    { id: 'or',     label: 'Fil Or',     hex: '#C8A86B' },
    { id: 'argent', label: 'Fil Argent', hex: '#C9CCD4' },
    { id: 'blanc',  label: 'Fil Blanc',  hex: '#FFFFFF' },
    { id: 'noir',   label: 'Fil Noir',   hex: '#17171A' },
    { id: 'grenat', label: 'Fil Grenat', hex: '#8E2A35' },
    { id: 'roi',    label: 'Fil Bleu',   hex: '#24427C' },
  ];

  /* Couleurs facultaires normalisées (satin intérieur de la capuche) */
  const FACULTY_COLORS = [
    { id: 'medecine',    label: 'Médecine',            hex: '#14544A' },
    { id: 'droit',       label: 'Droit',               hex: '#46244C' },
    { id: 'sciences',    label: 'Sciences',            hex: '#24427C' },
    { id: 'ingenierie',  label: 'Ingénierie',          hex: '#8E2A35' },
    { id: 'lettres',     label: 'Lettres & Langues',   hex: '#F1EDE4' },
    { id: 'economie',    label: 'Économie & Gestion',  hex: '#C8A86B' },
    { id: 'pharmacie',   label: 'Pharmacie',           hex: '#0E7C6B' },
    { id: 'informatique',label: 'Informatique',        hex: '#1F2A44' },
  ];

  /* ---------- Tissus ---------- */
  const FABRICS = [
    { id: 'gabardine', label: 'Gabardine mate',   note: 'Tenue structurée, aspect mat', sheen: 0.04 },
    { id: 'crepe',     label: 'Crêpe fluide',     note: 'Tombé souple, léger',          sheen: 0.10 },
    { id: 'satin',     label: 'Satin de soie',    note: 'Reflets lumineux',             sheen: 0.34 },
    { id: 'velours',   label: 'Velours profond',  note: 'Texture dense et feutrée',     sheen: 0.02 },
    { id: 'taffetas',  label: 'Taffetas',         note: 'Brillance sèche, tenue ferme', sheen: 0.22 },
  ];

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

  const TASSEL_COLORS = [
    { id: 'or',       label: 'Or',        hex: '#D8A93F' },
    { id: 'argent',   label: 'Argent',    hex: '#C9CCD4' },
    { id: 'noir',     label: 'Noir',      hex: '#17171A' },
    { id: 'blanc',    label: 'Blanc',     hex: '#F5F2EA' },
    { id: 'grenat',   label: 'Grenat',    hex: '#8E2A35' },
    { id: 'roi',      label: 'Bleu Roi',  hex: '#24427C' },
    { id: 'rose',     label: 'Rose',      hex: '#E3B5BE' },
    { id: 'emeraude', label: 'Émeraude',  hex: '#14544A' },
  ];

  const CHARM_FINISHES = [
    { id: 'aucun',  label: 'Sans breloque' },
    { id: 'or',     label: 'Breloque or',    hex: '#C8A86B' },
    { id: 'argent', label: 'Breloque argent',hex: '#C9CCD4' },
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
        steps: [
          'Position 1 — placez le mètre à plat sur le front, juste au-dessus des sourcils.',
          'Position 2 — faites-le passer au-dessus des oreilles, sans les écraser.',
          'Position 3 — refermez sur la nuque, au point le plus large du crâne.',
          'Le ruban doit être bien horizontal et poser sans serrer : relevez la valeur en cm.',
        ],
        tip: 'Les trois repères de la planche coiffe correspondent aux trois passages du ruban.',
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

  /* Ordre des étapes de l’assistant */
  const STEPS = [
    { id: 'upload',  title: 'Vos fichiers',   phase: 'Production', sub: 'Téléversez les designs à broder ou imprimer.' },
    { id: 'robe',    title: 'La Robe',        phase: 'Tenue',      sub: 'Tissus, couleurs, col, bordure et broderies.' },
    { id: 'hood',    title: 'La Capuche',     phase: 'Tenue',      sub: 'Modèle, doublure et couleurs de votre faculté.' },
    { id: 'cap',     title: 'Le Mortier',     phase: 'Tenue',      sub: 'Forme du plateau, matière, bouton et logo.' },
    { id: 'tassel',  title: 'Le Gland',       phase: 'Tenue',      sub: 'Style, couleur et breloques du gland.' },
    { id: 'measure', title: 'Vos Mesures',    phase: 'Atelier',    sub: 'Chaque mesure est accompagnée de son guide.' },
    { id: 'review',  title: 'Récapitulatif',  phase: 'Validation', sub: 'Vérifiez et corrigez avant l’envoi.' },
    { id: 'submit',  title: 'Envoi',          phase: 'Validation', sub: 'Votre dossier de fabrication est prêt.' },
  ];

  const REGIONS = ['Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
    'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine',
    'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine',
    'Tozeur', 'Tunis', 'Zaghouan'];

  const FONTS = {
    serif:  { label: 'Élégante',     stack: "'Cormorant Garamond', serif" },
    script: { label: 'Calligraphie', stack: "'Great Vibes', cursive" },
    modern: { label: 'Moderne',      stack: "'Inter', sans-serif" },
  };

  const EMB_POSITIONS = [
    { id: 'chest-right', label: 'Poitrine droite', x: 243, y: 168 },
    { id: 'chest-left',  label: 'Poitrine gauche', x: 157, y: 168 },
    { id: 'back',        label: 'Dos',             x: 200, y: 210 },
  ];

  /* Recherche d’un élément par identifiant, avec repli sur le premier. */
  function find(list, id) {
    return list.find((item) => item.id === id) || list[0];
  }

  /* Couleur hexadécimale d’un identifiant, quelle que soit la palette. */
  function hexOf(list, id, fallback) {
    const found = list.find((item) => item.id === id);
    return found && found.hex ? found.hex : (fallback || '#17171A');
  }

  CZ.catalog = {
    FILE_TYPES, MAX_FILE_MB,
    MAIN_COLORS, TRIM_COLORS, THREAD_COLORS, FACULTY_COLORS, TASSEL_COLORS, CHARM_FINISHES,
    FABRICS, COLLARS, TRIM_STYLES, SLEEVES,
    HOOD_STYLES, CAP_STYLES, CAP_MATERIALS, TASSEL_STYLES,
    MEASUREMENTS, STEPS, REGIONS, FONTS, EMB_POSITIONS,
    find, hexOf,
  };
})(window);
