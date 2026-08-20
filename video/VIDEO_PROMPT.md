# Prompt pour générateur vidéo IA — Tutoriel ENMIIS

Tout ce qui suit décrit **uniquement des éléments réellement présents sur le site**. Aucune
fonctionnalité inventée, aucun prix, aucun délai de livraison, aucun essayage virtuel.

---

## À lire d'abord : ce que l'IA sait faire, et ce qu'elle rate

Les générateurs vidéo (Sora, Veo, Runway, Kling…) **ne savent pas reproduire une interface web
précise**. Le texte des boutons ressort déformé, les libellés français deviennent illisibles, et la
mise en page ne correspond à rien de réel. Une vidéo entièrement générée montrerait un site qui
n'existe pas — exactement ce qu'un tutoriel ne doit pas faire.

**Approche recommandée — mixte :**

- **Les huit scènes d'interface : capture d'écran réelle.** Suivez `VIDEO_RECORDING_GUIDE.md`.
- **L'ouverture, la clôture et les plans d'ambiance : générés par IA.** C'est là que l'IA est bonne,
  et il n'y a aucun texte à reproduire.

La partie 1 ci-dessous donne les prompts pour cette approche. La partie 2 donne un prompt complet
pour une vidéo 100 % générée, si vous y tenez malgré la réserve ci-dessus.

---

## Charte visuelle commune (à joindre à chaque prompt)

```
Palette : noir encre #111111, or brossé #C8A86B, blanc cassé chaud #FBFAF8.
Typographie à l'écran : serif classique (type Cormorant Garamond) pour les titres,
sans-serif nette (type Inter) pour le reste.
Ambiance : atelier de couture tunisien haut de gamme, lumière naturelle douce et latérale,
grain fin, mouvements de caméra lents et assurés. Élégant et sobre, jamais tape-à-l'œil,
jamais publicitaire.
Sujet : une jeune diplômée tunisienne préparant sa soutenance universitaire.
```

---

# Partie 1 — Plans d'ambiance générés par IA

## Plan A — Ouverture (0:00–0:03, sous le premier plan d'écran)

```
Gros plan cinématographique sur des mains qui brodent au fil d'or sur du tissu noir
de haute couture. Lumière naturelle douce venant de la gauche, faible profondeur de
champ, l'aiguille attrape la lumière. Mouvement lent et régulier. Palette noir encre
et or brossé sur fond blanc cassé chaud. Grain fin, 24 fps, esthétique documentaire
artisanale. Aucun texte, aucun logo, aucun écran. 3 secondes.
```

## Plan B — Transition vers l'étape des mesures (à glisser vers 0:44)

```
Plan macro d'un mètre ruban de couturière souple, blanc à graduations noires, qui se
déroule doucement sur un plan de travail en bois clair. Un morceau de tissu noir et
une bobine de fil doré à l'arrière-plan, flous. Lumière latérale douce, faible
profondeur de champ, caméra fixe. Sobre et calme. Aucun texte, aucun chiffre lisible,
aucune personne. 2 secondes.
```

## Plan C — Clôture (1:23–1:26)

```
Une jeune femme tunisienne en toge de soutenance noire à parements dorés, vue de trois
quarts dos, se tient dans une cour universitaire baignée de lumière de fin d'après-midi.
Elle se retourne lentement vers la caméra et sourit avec assurance. Faible profondeur
de champ, arrière-plan doux et lumineux, contre-jour chaud. Élégant, digne, sans pose
publicitaire. Aucun texte à l'écran. 3 secondes.
```

## Plan D — Bonus, illustration des trois pièces

```
Nature morte lente sur un fond blanc cassé : une toge de soutenance noire pliée avec
soin, un mortier carré à gland doré posé dessus, et une étole de satin brodée disposée
en diagonale. Travelling latéral très lent de gauche à droite. Lumière de studio douce,
ombres longues et nettes. Palette noir, or, blanc cassé. Aucun texte, aucune main,
aucune marque visible. 4 secondes.
```

---

# Partie 2 — Prompt intégral, vidéo entièrement générée

À n'utiliser que si vous acceptez que les textes d'interface soient approximatifs. Décrivez alors les
écrans comme des **maquettes stylisées**, pas comme des captures fidèles.

## Prompt maître

```
Vidéo tutoriel de 85 secondes, format 16:9, pour ENMIIS, une maison tunisienne de
tenues de soutenance sur mesure. Ton chaleureux, élégant, rassurant. Palette noir
encre #111111, or brossé #C8A86B, blanc cassé chaud #FBFAF8. Titres en serif
classique, textes en sans-serif nette. Aucun prix affiché nulle part.

La vidéo suit une étudiante qui compose sa tenue de soutenance en huit étapes,
alternant plans d'interface stylisée et plans d'ambiance d'atelier :

1. (8 s) Page d'accueil élégante d'un site de mode, grande image de bannière d'une
   diplômée, un unique bouton d'appel à l'action doré. Le curseur clique le bouton.

2. (12 s) Une galerie de créations en grille. Une rangée de puces de filtre en haut ;
   l'une est sélectionnée et la grille se réduit en douceur pour ne montrer que les
   toges noires. Une icône cœur sur une carte se remplit de doré. Le curseur clique
   un bouton sur une carte.

3. (10 s) Un écran de configurateur en deux colonnes : grand aperçu d'une toge à
   gauche, panneau d'options à droite. Une zone de dépôt de fichier avec une flèche
   vers le haut. Une vignette d'image apparaît dans la zone.

4. (14 s) Le même écran deux colonnes. La cliente choisit des options : forme de
   manche, forme de col, style de bordure. L'aperçu de la toge se transforme
   fluidement à chaque choix — les manches changent de coupe, une bordure dorée
   apparaît sur les bords. La toge pivote lentement pour montrer le dos.

5. (12 s) Un écran de saisie de mesures : une liste de champs numériques, chacun
   accompagné d'un petit schéma au trait montrant où placer le mètre ruban sur le
   corps. Une fenêtre s'ouvre avec un guide illustré numéroté, puis se referme.

6. (10 s) Un écran de récapitulatif listant les choix par sections, chacune avec un
   petit bouton de modification. Un grand bouton doré en bas. Après le clic, une coche
   animée apparaît en confirmation.

7. (12 s) Un écran de panier : une ligne d'article avec vignette et description, un
   formulaire de coordonnées à droite avec des champs nom, téléphone, région et date.
   Les champs se remplissent l'un après l'autre.

8. (8 s) Un écran de confirmation : grande coche animée, message de remerciement, et
   un code de référence alphanumérique bien lisible au centre. Fondu vers un logo sur
   fond noir.

Mouvements de caméra doux, transitions en fondu enchaîné, curseur visible et net à
chaque clic. Rythme calme et pédagogique, jamais pressé.
```

## Prompt négatif

```
prix, tarifs, symboles monétaires, dinars, pourcentages, remises, codes promo,
compte à rebours, badges d'urgence, essayage virtuel, avatar 3D, mannequin IA,
texte anglais, éléments d'interface administrateur, tableaux de bord, statistiques,
listes de clients, musique agressive, coupes rapides, effets de zoom brusques,
filigranes, logos de marques tierces, texte déformé ou illisible
```

---

## Ce qu'il ne faut faire dire à aucun prompt

Ces éléments **n'existent pas** sur le site. Les générer donnerait une vidéo mensongère :

| À ne jamais montrer | Pourquoi |
|---|---|
| Un prix, un total, une remise | Le site n'affiche aucun prix — le devis est confirmé par l'atelier |
| Un essayage virtuel ou un avatar | La fonction a été retirée du site |
| Un code promo saisi à l'écran | Il ne donne aucune réduction ; le montrer ferait chercher un code inexistant |
| Un délai de fabrication ou de livraison | Le site n'en annonce aucun |
| L'espace atelier `admin.html` | Réservé à l'équipe, contient les coordonnées des clientes |
| Les rubriques Collections, Broderies, Nouveautés | Elles ouvrent « Page en construction » |
| Un paiement en ligne | Le site n'en propose pas : la commande part à l'atelier, qui recontacte |

---

## Sortie attendue

| Réglage | Valeur |
|---|---|
| Durée | 85 s (86 s avec la carte de clôture) |
| Format | 16:9, 1920×1080 |
| Images/s | 30 |
| Langue à l'écran | français uniquement |
| Voix off | `TUTORIAL_SCRIPT.md` |
| Sous-titres | `captions.srt` |
