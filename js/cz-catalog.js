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
    { id: 'modele-1', label: 'Modèle 1', image: 'configurateur/robe/manches/modele-1.jpeg', imageWebp: 'configurateur/robe/manches/modele-1.webp' },
    { id: 'modele-2', label: 'Modèle 2', image: 'configurateur/robe/manches/modele-2.jpeg', imageWebp: 'configurateur/robe/manches/modele-2.webp' },
    { id: 'modele-3', label: 'Modèle 3', image: 'configurateur/robe/manches/modele-3.jpeg', imageWebp: 'configurateur/robe/manches/modele-3.webp' },
    { id: 'modele-4', label: 'Modèle 4', image: 'configurateur/robe/manches/modele-4.jpeg', imageWebp: 'configurateur/robe/manches/modele-4.webp' },
    { id: 'modele-5', label: 'Modèle 5', image: 'configurateur/robe/manches/modele-5.jpeg', imageWebp: 'configurateur/robe/manches/modele-5.webp' },
    { id: 'modele-6', label: 'Modèle 6', image: 'configurateur/robe/manches/modele-6.jpeg', imageWebp: 'configurateur/robe/manches/modele-6.webp' },
    { id: 'modele-7', label: 'Modèle 7', image: 'configurateur/robe/manches/modele-7.jpeg', imageWebp: 'configurateur/robe/manches/modele-7.webp' },
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
  /* Les glands sont des photographies de l'atelier, comme les manches :
     aucune description, la piece se choisit a l'oeil. */
  const TASSEL_STYLES = [
    { id: 'modele-1', label: 'Modèle 1', image: 'configurateur/chapeaux/supplements/modele-1.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-1.webp' },
    { id: 'modele-2', label: 'Modèle 2', image: 'configurateur/chapeaux/supplements/modele-2.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-2.webp' },
    { id: 'modele-3', label: 'Modèle 3', image: 'configurateur/chapeaux/supplements/modele-3.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-3.webp' },
    { id: 'modele-4', label: 'Modèle 4', image: 'configurateur/chapeaux/supplements/modele-4.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-4.webp' },
    { id: 'modele-5', label: 'Modèle 5', image: 'configurateur/chapeaux/supplements/modele-5.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-5.webp' },
    { id: 'modele-6', label: 'Modèle 6', image: 'configurateur/chapeaux/supplements/modele-6.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-6.webp' },
    { id: 'modele-7', label: 'Modèle 7', image: 'configurateur/chapeaux/supplements/modele-7.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-7.webp' },
    { id: 'modele-8', label: 'Modèle 8', image: 'configurateur/chapeaux/supplements/modele-8.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-8.webp' },
    { id: 'modele-9', label: 'Modèle 9', image: 'configurateur/chapeaux/supplements/modele-9.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-9.webp' },
    { id: 'modele-10', label: 'Modèle 10', image: 'configurateur/chapeaux/supplements/modele-10.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-10.webp' },
    { id: 'modele-11', label: 'Modèle 11', image: 'configurateur/chapeaux/supplements/modele-11.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-11.webp' },
    { id: 'modele-12', label: 'Modèle 12', image: 'configurateur/chapeaux/supplements/modele-12.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-12.webp' },
    { id: 'modele-13', label: 'Modèle 13', image: 'configurateur/chapeaux/supplements/modele-13.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-13.webp' },
    { id: 'modele-14', label: 'Modèle 14', image: 'configurateur/chapeaux/supplements/modele-14.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-14.webp' },
    { id: 'modele-15', label: 'Modèle 15', image: 'configurateur/chapeaux/supplements/modele-15.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-15.webp' },
  ];

  /* ---------- Mesures (repères 1 à 6 de la planche « ROBE ») ---------- */
  /* ---------- Aspect du tissu ----------
     On ne demande plus a la cliente de nommer une matiere : devant une
     photographie, la seule chose qu'elle distingue vraiment, c'est le
     reflet. Elle tranche entre brillant et mat, l'atelier choisit
     ensuite le rouleau qui rend cet effet. */
  const FINISHES = [
    { id: 'brillant', label: 'Brillant', note: 'Reflet marqué, la lumière glisse' },
    { id: 'mat',      label: 'Mat',      note: 'Sans reflet, rendu profond' },
  ];

  /* Ancienne liste de matieres. Aucun ecran ne la propose plus : elle
     ne sert qu'a relire les commandes passees avant ce changement, pour
     qu'une fiche ancienne reste lisible a l'atelier. */
  const FABRICS = [
    { id: 'gabardine', label: 'Gabardine', note: 'Tenue nette, tombé structuré' },
    { id: 'crepe',     label: 'Crêpe',     note: 'Souple, légèrement grainé' },
    { id: 'satin',     label: 'Satin',     note: 'Reflet soutenu' },
    { id: 'velours',   label: 'Velours',   note: 'Profondeur mate' },
    { id: 'taffetas',  label: 'Taffetas',  note: 'Léger craquant, belle tenue' },
  ];

  /* ---------- Palette ----------
     Chaque teinte porte un code : c'est lui que l'atelier lit sur la
     fiche de fabrication. Une couleur vue sur un ecran mal calibre ne
     suffit pas a commander un rouleau. */
  const FABRIC_COLORS = [
    { id: 'noir',     label: 'Noir',        code: 'ENM-01', hex: '#141414' },
    { id: 'marine',   label: 'Bleu marine', code: 'ENM-02', hex: '#1B2A4A' },
    { id: 'roi',      label: 'Bleu roi',    code: 'ENM-03', hex: '#1D3FA8' },
    { id: 'bordeaux', label: 'Bordeaux',    code: 'ENM-04', hex: '#6E1420' },
    { id: 'rouge',    label: 'Rouge',       code: 'ENM-05', hex: '#B4231F' },
    { id: 'camel',    label: 'Camel',       code: 'ENM-06', hex: '#B08256' },
    { id: 'beige',    label: 'Beige',       code: 'ENM-07', hex: '#D9C6AC' },
    { id: 'creme',    label: 'Crème',       code: 'ENM-08', hex: '#F0E7D8' },
    { id: 'blanc',    label: 'Blanc',       code: 'ENM-09', hex: '#F7F7F5' },
    { id: 'vert',     label: 'Vert sapin',  code: 'ENM-10', hex: '#1F4436' },
    { id: 'violet',   label: 'Violet',      code: 'ENM-11', hex: '#4B2A6B' },
    { id: 'gris',     label: 'Gris perle',  code: 'ENM-12', hex: '#8D8D8A' },
  ];

  /* ---------- Ornement du chapeau ----------
     Fleur ou strass : la cliente choisit d'abord la famille, la planche
     correspondante s'ouvre ensuite. */
  const ORNEMENTS = [
    { id: 'strass', label: 'Strass', note: 'Éclat et relief' },
    { id: 'fleur',  label: 'Fleur',  note: 'Composition florale' },
    { id: 'aucun',  label: 'Aucun',  note: 'Chapeau nu' },
  ];

  /* Les strass sont photographies dans l'atelier, fond detoure. */
  const STRASS_MODELS = [
    { id: 'modele-1', label: 'Modèle 1', image: 'configurateur/chapeaux/supplements/modele-1.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-1.webp' },
    { id: 'modele-2', label: 'Modèle 2', image: 'configurateur/chapeaux/supplements/modele-2.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-2.webp' },
    { id: 'modele-3', label: 'Modèle 3', image: 'configurateur/chapeaux/supplements/modele-3.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-3.webp' },
    { id: 'modele-4', label: 'Modèle 4', image: 'configurateur/chapeaux/supplements/modele-4.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-4.webp' },
    { id: 'modele-5', label: 'Modèle 5', image: 'configurateur/chapeaux/supplements/modele-5.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-5.webp' },
    { id: 'modele-6', label: 'Modèle 6', image: 'configurateur/chapeaux/supplements/modele-6.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-6.webp' },
    { id: 'modele-7', label: 'Modèle 7', image: 'configurateur/chapeaux/supplements/modele-7.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-7.webp' },
    { id: 'modele-8', label: 'Modèle 8', image: 'configurateur/chapeaux/supplements/modele-8.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-8.webp' },
    { id: 'modele-9', label: 'Modèle 9', image: 'configurateur/chapeaux/supplements/modele-9.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-9.webp' },
    { id: 'modele-10', label: 'Modèle 10', image: 'configurateur/chapeaux/supplements/modele-10.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-10.webp' },
    { id: 'modele-11', label: 'Modèle 11', image: 'configurateur/chapeaux/supplements/modele-11.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-11.webp' },
    { id: 'modele-12', label: 'Modèle 12', image: 'configurateur/chapeaux/supplements/modele-12.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-12.webp' },
    { id: 'modele-13', label: 'Modèle 13', image: 'configurateur/chapeaux/supplements/modele-13.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-13.webp' },
    { id: 'modele-14', label: 'Modèle 14', image: 'configurateur/chapeaux/supplements/modele-14.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-14.webp' },
    { id: 'modele-15', label: 'Modèle 15', image: 'configurateur/chapeaux/supplements/modele-15.jpeg', imageWebp: 'configurateur/chapeaux/supplements/modele-15.webp' },
  ];

  /* Les fleurs n'ont pas encore de planche photographique : la liste
     reste vide, et l'ecran le dit au lieu d'afficher une grille creuse. */
  const FLEUR_MODELS = [];

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
    { id: 'upload',   title: 'Vos fichiers',  phase: 'Production', sub: 'Téléversez les designs à broder ou imprimer.' },
    { id: 'robe',     title: 'La Robe',       phase: 'Modèle',     sub: 'Manches, aspect et couleur.' },
    { id: 'hood',     title: 'Le Cache-col',  phase: 'Modèle',     sub: 'Aspect, couleur et contour.' },
    { id: 'cap',      title: 'Le Chapeau',    phase: 'Modèle',     sub: 'Aspect, couleur et ornement.' },
    { id: 'capeam',   title: 'Les Couleurs',  phase: 'Modèle',     sub: 'La cape américaine se porte en deux teintes.' },
    { id: 'bande',    title: 'La Couleur',    phase: 'Modèle',     sub: 'Couleur du tissu de votre bande.' },
    { id: 'measure',  title: 'Vos Mesures',   phase: 'Atelier',    sub: 'Chaque mesure est accompagnée de son guide.' },
    /* Dernière étape : la pièce rejoint le panier. Les coordonnées et
       l'envoi de la commande se font au panier, une seule fois pour
       toutes les pièces. */
    { id: 'review',   title: 'Récapitulatif', phase: 'Validation', sub: 'Vérifiez, puis ajoutez cette pièce au panier.' },
  ];

  /* ---------- Les trois pièces de soutenance ----------
     Chacune est un produit indépendant : son propre configurateur,
     sa propre ligne au panier, son propre prix. Les mesures demandées
     se limitent à celles que l'atelier utilise réellement pour la
     pièce — inutile de relever neuf mesures pour une casquette. */
  /* Les identifiants ne bougent pas : ils sont inscrits dans les
     commandes deja enregistrees. Seuls les libelles changent quand
     l'atelier renomme une piece — « casquette » s'affiche « Chapeau »,
     « echarpe » s'affiche « Cache-col ». */
  const PRODUCTS = [
    {
      id: 'robe',
      label: 'Robe',
      the: 'la robe',
      cta: 'Configurer la robe',
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
      label: 'Chapeau',
      the: 'le chapeau',
      cta: 'Configurer le chapeau',
      photo: 'img/cap.webp',
      tagline: 'Mortier de diplômé',
      desc: 'Plateau carré parfaitement plan, gland assorti et broderie du plateau.',
      steps: ['upload', 'cap', 'measure', 'review'],
      measures: ['head'],
      fileRequired: false,
    },
    {
      id: 'echarpe',
      label: 'Cache-col',
      the: 'le cache-col',
      cta: 'Configurer le cache-col',
      photo: 'img/hood.webp',
      tagline: 'Étole de félicitations',
      desc: 'Satin doublé, pans brodés à votre nom, à votre faculté ou à votre mention.',
      steps: ['upload', 'hood', 'measure', 'review'],
      measures: ['height'],
      fileRequired: false,
    },
    /* Les trois pieces ci-dessous n'ont pas encore de planche d'options :
       l'atelier les realise sur la reference fournie par la cliente. Leur
       parcours saute donc l'etape « modele » et va du fichier aux
       mesures. Une seule mesure suffit : la stature. */
    {
      id: 'cape',
      label: 'Cape',
      the: 'la cape',
      cta: 'Configurer la cape',
      photo: 'img/soutenance/2.png',
      tagline: 'Cape de cérémonie',
      desc: 'Drapé long, doublure contrastée et finitions brodées selon votre modèle.',
      steps: ['upload', 'measure', 'review'],
      measures: ['height'],
      fileRequired: false,
    },
    {
      id: 'cape-americaine',
      label: 'Cape américaine',
      the: 'la cape américaine',
      cta: 'Configurer la cape américaine',
      photo: 'img/soutenance/3.png',
      tagline: 'Coupe américaine',
      desc: 'Tombé court et épaules marquées, dans l’esprit des remises de diplôme américaines.',
      steps: ['upload', 'capeam', 'measure', 'review'],
      measures: ['height'],
      fileRequired: false,
    },
    {
      id: 'bond-miss',
      label: 'Bond miss',
      the: 'le bond miss',
      cta: 'Configurer le bond miss',
      photo: 'img/soutenance/1.png',
      tagline: 'Bande d’honneur',
      desc: 'Bande portée en écharpe, brodée à votre nom, votre promotion ou votre mention.',
      steps: ['upload', 'bande', 'measure', 'review'],
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
    FINISHES, FABRICS, FABRIC_COLORS, ORNEMENTS, STRASS_MODELS, FLEUR_MODELS,
    MEASUREMENTS, STEPS, REGIONS,
    PRODUCTS, product, stepsFor, measuresFor,
    PROMO_CODES, isPromo, normalizePromo,
    find,
  };
})(window);
