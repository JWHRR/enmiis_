# Guide de tournage — Tutoriel client ENMIIS

Ce guide décrit exactement comment capturer les huit scènes du `STORYBOARD.md`. Suivez-le dans
l'ordre : la préparation compte autant que la prise.

---

## 1. Où tourner : sur le site en ligne

Enregistrez sur **https://enmiis.vercel.app**, pas sur les fichiers en local.

**Pourquoi.** Les pages appellent l'atelier par `fetch()`. Ouvertes en `file://` — double-clic sur
`index.html` — ces appels sont bloqués par le navigateur et rien ne fonctionne. Servies en local sans
Vercel, l'API `/api/orders` n'existe pas : la commande passe quand même, mais l'écran final affiche
l'avertissement *« La connexion à l'atelier n'a pas pu être confirmée immédiatement… »*, qui gâche la
scène 8.

Si vous devez absolument tourner hors ligne, servez le dossier en HTTP :

```bash
cd chemin/vers/enmiis_-main
python -m http.server 8000
# puis http://localhost:8000/index.html
```

…et coupez la scène 8 juste après l'apparition de la référence, avant l'avertissement.

---

## 2. La commande de démonstration part vraiment à l'atelier

**À lire avant de tourner la scène 8.** Le clic sur « Envoyer ma commande » écrit une vraie commande
dans la base de l'atelier. Elle apparaîtra dans `admin.html` au milieu des vraies.

Deux précautions :

1. **Nom reconnaissable.** Saisissez `DEMO VIDEO` dans « Nom & prénom ». Pas un nom plausible : la
   personne qui traitera les commandes doit voir au premier coup d'œil que ce n'est pas une cliente.
2. **Suppression après tournage.** Ouvrez `admin.html`, connectez-vous, trouvez la commande
   `DEMO VIDEO` et supprimez-la. Le message « Commande supprimée. » confirme. **Ne sautez pas cette
   étape** — la base a été vidée récemment pour repartir propre.

Refaites une prise ? Chaque prise crée une commande de plus. Supprimez-les toutes à la fin.

---

## 3. Préparer le navigateur

**Navigateur :** Chrome ou Edge, fenêtre en navigation privée (aucune extension, aucune barre de
favoris, aucun mot de passe enregistré qui viendrait s'auto-remplir).

**Résolution :** fenêtre à 1920×1080, zoom à **100 %** (`Ctrl+0`). Un zoom à 110 % casse la mise en
page à deux colonnes du configurateur.

**Repartir de zéro.** Ouvrez la console (`F12`), collez ceci, puis rechargez :

```js
['enmiis-cart-v1','enmiis-configurator-v3','enmiis-favorites-v1','enmiis-account-v1']
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

Les trois pastilles de l'en-tête — compte, favoris, panier — doivent alors être vides. Une pastille
qui affiche déjà « 2 » à la première image trahit une prise antérieure.

**Curseur.** Activez la mise en évidence du curseur dans votre logiciel de capture. La moitié des
scènes repose sur un clic précis : sans halo, on ne voit pas où ça se passe.

---

## 4. Réglages de capture

| Réglage | Valeur |
|---|---|
| Logiciel | OBS Studio (gratuit), ou l'enregistreur intégré de macOS / Windows |
| Source | Capture de fenêtre, **pas** capture d'écran entier |
| Résolution | 1920×1080 |
| Images/s | 30 (60 si vous comptez ralentir la scène 4) |
| Format | MP4, H.264, ~12 Mbit/s |
| Audio système | **Coupé** — la voix off s'ajoute au montage |

---

## 5. Fichiers à préparer avant de tourner

Pour la scène 3, il vous faut un fichier à déposer dans le configurateur :

- **Un PNG de logo**, moins de 12 Mo (limite réelle du site), fond transparent de préférence. Un logo
  d'université convient parfaitement, c'est le cas d'usage réel.
- Placez-le sur le Bureau, visible, pour que le glisser-déposer soit filmable d'un seul geste.

Formats acceptés par le site : PDF, PNG, JPG, SVG, AI, EPS, CDR.

---

## 6. Jeu de données de démonstration

À saisir dans le formulaire du panier, scène 7. Ces valeurs passent la validation du site :

| Champ | Valeur | Contrainte réelle |
|---|---|---|
| Nom & prénom | `DEMO VIDEO` | 3 caractères minimum |
| Numéro WhatsApp | `22 123 456` | 8 chiffres, commençant par 2 à 9 |
| E-mail | *(laisser vide)* | facultatif |
| Région | `Tunis` | à choisir dans la liste |
| Université | `Université de Tunis El Manar` | facultatif |
| Date de soutenance | **une date à venir** | une date passée est refusée |
| Code promo | *(laisser vide)* | voir plus bas |
| Remarques | *(laisser vide)* | facultatif |

**Mesures de la robe**, scène 5 — valeurs cohérentes qui valident toutes :

| Mesure | Valeur |
|---|---|
| Stature | 168 cm |
| Poids | 62 kg |
| Tour de poitrine | 92 cm |
| Tour de taille | 74 cm |
| Tour de hanches | 98 cm |
| Largeur d'épaules | 40 cm |
| Longueur de manche | 58 cm |
| Longueur de robe | 132 cm |

**Le champ « Code promo » reste vide.** Il ne donne aucune réduction — il sert à repérer d'où vient
une commande. Le remplir à l'écran ferait chercher un code à toutes les spectatrices, et un code
inventé déclenche le refus « Ce code promo n'existe pas », qui n'a rien à faire dans un tutoriel.

---

## 7. Ordre de tournage recommandé

Tournez **d'une seule traite**, du début à la fin, en une longue prise. Le parcours est enchaîné : le
panier dépend du configurateur, qui dépend de la carte cliquée. Reprendre une scène isolée oblige à
refaire tout ce qui précède.

Comptez trois passages :

1. **Répétition à blanc**, sans enregistrer. Repérez où sont les boutons, où le défilement s'arrête.
2. **Prise longue**, en prenant votre temps — visez 2 à 3 minutes brutes, vous couperez au montage.
   Marquez un temps d'arrêt d'une seconde avant chaque clic : ça donne au montage de quoi respirer.
3. **Prises de sécurité** des trois moments délicats : le filtre « Toges » (scène 2), le changement de
   manche avec son aperçu (scène 4), l'écran de confirmation (scène 8).

---

## 8. Pièges relevés dans le code

- **La robe exige un fichier.** Sans fichier joint, « Continuer » bloque à l'étape 1 avec « Ajoutez le
  design à broder sur votre robe. » En arrivant par « Choisir cette tenue », la photo du modèle est
  jointe automatiquement et le blocage ne survient pas. **Ne commencez donc jamais la scène 3 en
  ouvrant `customizer.html` directement.**
- **La navigation contient des pages en construction.** « Collections », « Broderies », « Nouveautés »
  ouvrent une fenêtre « Page en construction ». Ne les survolez pas.
- **Le panier expire au bout de 24 h** et affiche un compte à rebours (« Votre panier est conservé
  encore 23 h 58 sur cet appareil. »). Sans importance sur une prise courte, mais évitez de reprendre
  le tournage le lendemain avec un panier vieilli.
- **`admin.html` ne doit apparaître à aucune image.** C'est l'espace de l'atelier, il contient les
  coordonnées des clientes.
- **Le bouton « Continuer mes achats »** de l'écran d'ajout renvoie à la galerie. Ne cliquez pas
  dessus par réflexe en scène 6 : c'est « Voir mon panier » qui enchaîne.

---

## 9. Montage

1. **Coupez à 86 s**, en suivant les repères du `STORYBOARD.md`.
2. **Accélérez les saisies** : ×3 sur les six dernières mesures (scène 5), ×2 sur le formulaire de
   coordonnées (scène 7). Rien d'autre ne doit être accéléré.
3. **Ralentissez à 0,75×** le seul instant où la manche change de forme dans l'aperçu (scène 4).
4. **Importez `captions.srt`** — les repères temporels correspondent déjà au découpage.
5. **Ajoutez la voix off** de `TUTORIAL_SCRIPT.md`, mixée à −16 LUFS.
6. **Musique** discrète, −24 dB sous la voix, ou pas de musique du tout. Le site est sobre ; la vidéo
   doit l'être aussi.
7. **Carte de clôture**, 3 s : logo `img/logo-enmiis.png` sur fond noir, et l'adresse du site. Aucun
   prix, aucun délai — le site n'en annonce aucun.

---

## 10. Vérification avant diffusion

- [ ] Durée sous 90 s
- [ ] Aucun prix visible ni prononcé
- [ ] Le champ « Code promo » n'est jamais rempli à l'écran
- [ ] `admin.html` n'apparaît nulle part
- [ ] Aucune fenêtre « Page en construction »
- [ ] Les pastilles de l'en-tête partent de zéro sur la première image
- [ ] La référence `ENM-…` est lisible en plein écran
- [ ] Aucun avertissement de synchronisation sous la référence
- [ ] Les sous-titres sont calés sur la voix
- [ ] **La commande `DEMO VIDEO` a été supprimée dans `admin.html`**
