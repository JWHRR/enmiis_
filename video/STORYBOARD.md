# Storyboard — Tutoriel client ENMIIS

**Durée totale : 86 s** · Format recommandé : 1920×1080, 30 fps · Sous-titres : `captions.srt`

Toutes les pages, tous les libellés de boutons et tous les textes d'écran cités ici ont été relevés
dans le code du site. Rien n'est inventé. Les libellés entre « guillemets » sont à l'identique.

---

## Vue d'ensemble

| # | Temps | Durée | Page | Geste principal |
|---|-------|-------|------|-----------------|
| 1 | 0:00–0:08 | 8 s | `index.html` | Clic « Découvrir nos créations » |
| 2 | 0:08–0:20 | 12 s | `soutenance.html` | Filtre « Toges », cœur, « Choisir cette tenue » |
| 3 | 0:20–0:30 | 10 s | `customizer.html` — Vos fichiers | Dépôt d'un fichier, « Continuer » |
| 4 | 0:30–0:44 | 14 s | `customizer.html` — La Robe | Choix manches / col / bordure |
| 5 | 0:44–0:56 | 12 s | `customizer.html` — Vos Mesures | Ouverture du guide, saisie |
| 6 | 0:56–1:06 | 10 s | `customizer.html` — Récapitulatif | « Ajouter la robe au panier » |
| 7 | 1:06–1:18 | 12 s | `panier.html` | Ligne d'article, coordonnées |
| 8 | 1:18–1:26 | 8 s | `panier.html` — confirmation | Référence `ENM-…` |

---

## Scène 1 — L'accueil · 0:00 → 0:08

**Page :** `index.html`, haut de page, première diapositive du carrousel.

**Action à filmer**

1. Ouverture sur le hero, diapositive 1 déjà active : label « La Collection Soutenance », titre
   **« Votre Jour de Gloire »**.
2. Le curseur monte vers le bouton **« Découvrir nos créations »**, marque un temps, clique.

**Voix off**

> Bienvenue chez ENMIIS. Voici comment composer votre tenue de soutenance.
> Depuis l'accueil, touchez « Découvrir nos créations ».

**Sous-titres :** cues 1–3

**Points visuels à souligner**

- Laisser 2 s de hero intact avant tout mouvement : c'est la carte de visite de la marque.
- Ne **pas** survoler la navigation : « Collections », « Broderies » et « Nouveautés » ouvrent une
  fenêtre « Page en construction ».
- Les trois icônes en haut à droite — compte, favoris, panier — doivent afficher zéro (pastilles
  masquées). Voir la préparation dans `VIDEO_RECORDING_GUIDE.md`.

---

## Scène 2 — Nos créations · 0:08 → 0:20

**Page :** `soutenance.html`

**Action à filmer**

1. Arrivée sur la galerie, les 14 cartes visibles.
2. Clic sur la puce de filtre **« Toges »** — les cartes non concernées disparaissent, il reste les
   trois toges.
3. Sous la liste apparaît le bouton **« Téléverser mon propre modèle de robe »** : le laisser entrer
   dans le cadre 1 s, sans cliquer.
4. Clic sur le **cœur** d'une carte — il se remplit, la pastille favoris de l'en-tête passe à **1**.
5. Clic sur **« Choisir cette tenue »** de la carte *Toge d'Excellence — Broderie Or & Logos*
   (mène à `customizer.html?produit=robe&preset=1`).

**Voix off**

> Nos créations sont classées par pièce : touchez « Toges » pour n'afficher que les robes.
> Le cœur met un modèle de côté. « Choisir cette tenue » ouvre le configurateur.

**Sous-titres :** cues 4–7

**Points visuels à souligner**

- Le passage de 14 à 3 cartes est le moment fort de la scène : le laisser respirer, ne pas couper
  pendant l'animation.
- Encadré ou halo léger sur la puce « Toges » au moment du clic.
- La pastille favoris qui passe de rien à **1** mérite un léger zoom : c'est la preuve que le geste
  a servi à quelque chose.
- L'autre bouton de la carte, **« Aperçu & Détails »**, ouvre une fenêtre de zoom. On ne l'utilise
  pas ici : il allongerait la scène sans rien apprendre de neuf.

---

## Scène 3 — Vos fichiers · 0:20 → 0:30

**Page :** `customizer.html`, étape 1 sur 4 — panneau **« Vos fichiers »**, phase « Production ».

**Action à filmer**

1. Le configurateur s'ouvre. **La photo du modèle choisi est déjà attachée** : elle apparaît dans la
   liste des fichiers et dans l'aperçu. C'est automatique, parce qu'on est arrivé par
   « Choisir cette tenue ».
2. Glisser-déposer un second fichier sur la zone **« Déposez vos fichiers ici »** — un PNG de logo
   suffit. La vignette s'ajoute.
3. Clic sur **« Continuer »** en bas du panneau.

**Voix off**

> Le modèle choisi est déjà joint comme référence. Vous pouvez ajouter votre propre design à
> broder : PDF, image ou fichier vectoriel. Puis « Continuer ».

**Sous-titres :** cues 8–10

**Points visuels à souligner**

- Les pastilles de formats acceptés — PDF, PNG, JPG, SVG, AI, EPS, CDR — sont sous la zone de
  dépôt : les cadrer nettement, c'est une question fréquente.
- Incrustation optionnelle : *« 12 Mo maximum par fichier »* (valeur réelle du site).
- **À savoir pour le tournage :** la robe est la seule pièce qui *exige* un fichier. Si vous ouvrez
  le configurateur sans passer par une carte, « Continuer » refuse d'avancer avec le message
  « Ajoutez le design à broder sur votre robe. » En venant de la galerie, le problème ne se pose
  jamais — d'où l'ordre des scènes.

---

## Scène 4 — La Robe · 0:30 → 0:44

**Page :** `customizer.html`, étape 2 sur 4 — **« La Robe »**, phase « Modèle ».

> **L'aperçu n'est pas un rendu 3D pilotable.** `customizer.html` contient bien un bloc SVG rotatif,
> mais il porte la mention « APERÇU 3D / SVG — DÉSACTIVÉ » et son moteur est commenté en fin de
> `js/cz-preview.js`. Ce qui est actif, c'est un **visualiseur photo** : la photo du modèle choisi,
> vos fichiers téléversés, et des pastilles qui se mettent à jour. Ne promettez pas de rotation.

**Action à filmer**

1. Clic sur une carte de **Coupe des manches** — options réelles : *Manche cloche*, *Manche
   pointue*, *Manche droite*.
2. Clic sur un **Col** — *Col en V*, *Col châle*, *Col officier*, *Sans col*.
3. Clic sur une **Bordure** — *Double parement*, *Parement simple*, *Liseré fin*, *Sans bordure*.
4. À chaque clic : une **vignette du modèle retenu** apparaît brièvement sur l'aperçu, et les
   **pastilles** sous l'image se mettent à jour — *Manches · Col · Bordure*.
5. Clic sur la **première vignette de fichier** (sous l'aperçu) pour revenir à la photo du modèle :
   le logo déposé à la scène 3 occupait l'aperçu, la robe redevient visible.
6. Clic sur le **bouton zoom +** de l'aperçu.

**Voix off**

> Réglez votre robe : coupe des manches, col, bordure. Chaque choix s'affiche aussitôt sous
> l'aperçu, et vos fichiers restent consultables d'un simple clic. Les couleurs sont arrêtées avec
> vous par l'atelier.

**Sous-titres :** cues 11–14

**Points visuels à souligner**

- **Les pastilles sous l'aperçu sont le retour visuel de la scène** : elles passent de « Manche
  cloche » à « Manche pointue » sous les yeux de la cliente. Les cadrer nettement.
- Le passage d'une vignette à l'autre montre que les fichiers déposés ne sont pas perdus : ils
  restent consultables à tout moment.
- La ligne du site « Broderie et couleurs sont arrêtées avec vous par l'atelier à la confirmation de
  la commande » justifie la dernière phrase de la voix off. La cadrer si elle tient.

---

## Scène 5 — Vos Mesures · 0:44 → 0:56

**Page :** `customizer.html`, étape 3 sur 4 — **« Vos Mesures »**, phase « Atelier ».

**Action à filmer**

1. Vue d'ensemble de la liste : la robe demande **huit mesures** — Stature, Poids, Tour de poitrine,
   Tour de taille, Tour de hanches, Largeur d'épaules, Longueur de manche, Longueur de robe. Chacune
   a son illustration à gauche.
2. Clic sur le **bouton guide** (le point d'interrogation) d'une mesure, par exemple *Tour de
   poitrine*. La fenêtre s'ouvre avec le schéma numéroté et son conseil. Fermer.
3. Saisie de **deux champs en temps réel** (Stature, puis Tour de poitrine).
4. **Les six restants : accélération 3×** ou coupe franche sur la liste déjà remplie.

**Voix off**

> Vient l'étape des mesures. Chacune a son guide illustré : touchez le point d'interrogation si vous
> hésitez. Prenez un mètre ruban souple, et laissez-vous guider.

**Sous-titres :** cues 15–18

**Points visuels à souligner**

- **Ne filmez pas les huit saisies en temps réel** : ce serait un tiers de la vidéo passé à taper des
  chiffres. Deux en direct suffisent à montrer le geste, le reste s'accélère.
- La fenêtre de guide est l'argument rassurant de toute la vidéo — c'est là que la cliente cesse
  d'avoir peur de se tromper. Lui donner 2 s pleines, schéma bien lisible.
- Le champ se valide visuellement quand la valeur est correcte : le montrer sur au moins une mesure.

---

## Scène 6 — Récapitulatif · 0:56 → 1:06

**Page :** `customizer.html`, étape 4 sur 4 — **« Récapitulatif »**, phase « Validation ».

**Action à filmer**

1. Défilement lent du récapitulatif : bloc *Vos fichiers*, bloc *La Robe*, bloc *Vos Mesures* —
   chacun avec son bouton **« Modifier »** à droite.
2. Survol appuyé d'un bouton « Modifier », sans cliquer.
3. Clic sur **« Ajouter la robe au panier »**.
4. L'écran de confirmation apparaît : coche animée, **« Ajouté au panier »**, titre **« Robe ajoutée
   au panier »**, ligne **« 1 article dans votre panier »**, et les deux boutons « Voir mon panier »
   et « Continuer mes achats ».
5. Clic sur **« Voir mon panier »**.

**Voix off**

> Le récapitulatif reprend tout, et chaque section reste modifiable. Quand tout est bon :
> « Ajouter la robe au panier ».

**Sous-titres :** cues 19–21

**Points visuels à souligner**

- Les boutons « Modifier » sont le message de la scène : rien n'est verrouillé. Les mettre en valeur
  au défilement.
- La coche animée de confirmation est une récompense : ne pas couper avant la fin de l'animation.

---

## Scène 7 — Le panier · 1:06 → 1:18

**Page :** `panier.html`

**Action à filmer**

1. Arrivée sur le panier. Sous-titre de page : « Vérifiez vos pièces, puis renseignez vos coordonnées
   une seule fois. »
2. Cadrer la **ligne d'article** : vignette, nom, caractéristiques, et en pied les deux liens
   **« Modifier »** et **« Supprimer »**.
3. Cadrer le bandeau **« Gardez votre panier »** — « Sans compte, il s'efface au bout de 24 h. Avec,
   vous le retrouvez sur tous vos appareils. » — avec ses boutons « Créer mon compte » et
   « Me connecter ». **Le montrer, ne pas cliquer** : le compte est facultatif par choix.
4. Remplir le formulaire de coordonnées : *Nom & prénom*, *Numéro WhatsApp*, *Région* (menu
   déroulant), *Date de soutenance* (sélecteur de date). Accélération 2× possible sur la frappe.

**Voix off**

> Dans le panier, chaque pièce a sa ligne — vous pouvez la modifier ou la retirer. Créez un compte
> pour la retrouver plus tard. Puis vos coordonnées, une seule fois.

**Sous-titres :** cues 22–25

**Points visuels à souligner**

- **Ne pas cadrer le champ « Code promo ».** Il sert à repérer la provenance d'une commande, pas à
  donner une remise. Le montrer ferait chercher un code inexistant. Si le cadrage l'attrape, passez
  outre sans y attarder le curseur.
- Le bloc **« Compléter votre tenue »** ne propose que les pièces absentes du panier — ici la
  casquette et l'écharpe. Un plan de 1 s dessus est un bonus utile, pas une obligation.
- Utilisez un nom de démonstration reconnaissable (voir le guide de tournage) : cette commande
  partira réellement à l'atelier et devra être supprimée après le tournage.

---

## Scène 8 — Commande envoyée · 1:18 → 1:26

**Page :** `panier.html`, écran de confirmation.

> **Bug du site à connaître avant de filmer.** `panier.html` porte un `</div>` surnuméraire
> (ligne 82) qui referme `#pnLayout` avant la section « Vos coordonnées ». Celle-ci se retrouve donc
> **hors** du conteneur masqué après l'envoi — et comme `.pn-checkout` est en `position: sticky`
> au-delà de 1024 px (`css/panier.css`), le formulaire reste **épinglé par-dessus la confirmation**.
> Conséquence pour la cliente : après avoir commandé, elle voit toujours son formulaire, le bouton
> reste bloqué sur « Envoi en cours… », et sa **référence est en partie masquée**. Tant que ce n'est
> pas corrigé, aucun cadrage ne donne un écran de confirmation propre : la vidéo se rabat sur la
> bande libre, sous la zone collante.

**Action à filmer**

1. Clic sur **« Envoyer ma commande »**.
2. L'écran de confirmation : coche animée, **« Commande enregistrée »**, titre **« Merci — votre
   commande est entre nos mains »**, puis la **référence** au format `ENM-260819-A1B2`.
3. Cadrer le texte : « Conservez cette référence : elle identifie votre dossier auprès de l'atelier.
   […] Notre équipe confirme les mesures, la broderie et les couleurs avant lancement de la
   fabrication. »
4. Le bouton **« Télécharger le récapitulatif »** entre dans le cadre. Fondu au noir sur le logo.

**Voix off**

> Envoyez votre commande, et gardez la référence : elle identifie votre dossier auprès de l'atelier.

**Sous-titres :** cues 26–28

**Points visuels à souligner**

- **Zoom net sur la référence** — c'est l'information à retenir de toute la vidéo.
- Vérifiez qu'aucun avertissement n'apparaît sous la référence. S'il s'affiche (« La connexion à
  l'atelier n'a pas pu être confirmée immédiatement… »), c'est que la commande n'est pas partie :
  refaites la prise. Le guide de tournage explique comment l'éviter.
- Carte de clôture : logo ENMIIS sur fond noir, et l'adresse du site. Pas de promesse chiffrée, pas
  de délai annoncé — le site n'en donne aucun.
