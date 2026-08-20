# Tutoriel vidéo client — ENMIIS

Une vidéo de **86 secondes** qui montre à une première cliente comment composer sa tenue de
soutenance et passer commande — plus tout ce qu'il faut pour la refaire, la traduire ou la remonter.

**La vidéo n'est pas une reconstitution : c'est le vrai site, filmé.** Le parcours est rejoué par un
navigateur piloté, page après page, bouton après bouton. Rien n'est maquetté, rien n'est généré.

---

## Les fichiers

### À regarder

| Fichier | Contenu |
|---|---|
| `ENMIIS-tutoriel.mp4` | 1920×1080, 25 fps, 86 s, sans son — prêt pour la voix off |
| `ENMIIS-tutoriel-sous-titre.mp4` | La même, sous-titres incrustés |

### Pour produire et retoucher

| Fichier | À quoi il sert |
|---|---|
| `record.mjs` | Rejoue le parcours sur le site et enregistre l'écran |
| `build.mjs` | Découpe l'amorce, encode en H.264, incruste les sous-titres |
| `captions.srt` | 28 sous-titres calés sur la narration |
| `TUTORIAL_SCRIPT.md` | Voix off, 182 mots, minutée scène par scène |
| `STORYBOARD.md` | Les 8 scènes : temps, page, gestes, points visuels |
| `VIDEO_RECORDING_GUIDE.md` | Pour refilmer à la main plutôt qu'en script |
| `VIDEO_PROMPT.md` | Prompts IA, pour d'éventuels plans d'ambiance |
| `raw/` | Capture brute et intermédiaires — régénérables, à ne pas versionner |

---

## Le parcours filmé

```
Accueil  →  Nos créations  →  Configurateur (4 étapes)  →  Panier  →  Commande envoyée
 0:00          0:08              0:20 → 1:06              1:06        1:18 → 1:26
```

Le configurateur est filmé sur la **robe**, la pièce phare. Le site propose aussi la casquette et
l'écharpe, chacune avec son propre configurateur et sa propre ligne au panier.

---

## Refaire la vidéo

```bash
node video/record.mjs     # rejoue le parcours, ~90 s
node video/build.mjs      # produit les deux MP4
```

**Prérequis.** Le projet n'a volontairement ni `package.json` ni `node_modules`. Les deux scripts
acceptent donc une installation externe :

```bash
export PW_MODULE="file:///chemin/vers/node_modules/playwright/index.mjs"
export FFMPEG_BIN="/chemin/vers/ffmpeg.exe"
```

Sans ces variables, ils utilisent `playwright` et `ffmpeg` du système.

**Aucune commande n'est envoyée à l'atelier.** `record.mjs` intercepte `/api/orders` et bloque
Supabase : l'écran de confirmation s'affiche comme en vrai, mais rien n'atteint la base. Le site est
servi en local, jamais en `file://` — les appels réseau y sont bloqués par le navigateur.

---

## Deux bugs du site trouvés en filmant

Aucun n'a été corrigé : la consigne était de ne pas toucher au site. Les deux sont réels et visibles
par une cliente.

### 1. Le formulaire reste affiché après la commande — sérieux

`panier.html` porte un **`</div>` surnuméraire à la ligne 82**. Il referme `#pnLayout` avant la
section « Vos coordonnées », qui se retrouve donc **hors** du conteneur masqué à l'envoi. Comme
`.pn-checkout` est en `position: sticky` au-delà de 1024 px (`css/panier.css`), le formulaire reste
**épinglé par-dessus l'écran de confirmation**.

Ce que voit la cliente après avoir commandé : son formulaire toujours là, le bouton bloqué sur
« Envoi en cours… », et **sa référence de commande à moitié masquée**. La commande est bien partie —
mais rien ne le lui dit clairement.

C'est pour cette raison que les six dernières secondes de la vidéo sont recadrées : c'est le seul
cadrage qui rende la référence lisible. Une fois le `</div>` retiré, relancez les deux scripts et
retirez le recadrage dans `build.mjs`.

### 2. L'aperçu du configurateur n'est pas ce que le HTML laisse croire

`customizer.html` contient un aperçu SVG rotatif, mais il est marqué **« APERÇU 3D / SVG —
DÉSACTIVÉ »** et son moteur est commenté en fin de `js/cz-preview.js`. L'aperçu actif est un
visualiseur photo. Sans importance pour la cliente, mais de quoi écrire un script faux : la première
version de ce storyboard promettait une rotation à la souris qui n'existe pas.

---

## Ce que la vidéo ne montre pas, volontairement

- **Les prix** — il n'y en a aucun sur le site ; le devis est confirmé par l'atelier. Seule la barre
  d'annonce affiche « offerte dès 200 TND » pour la livraison ; la voix off ne la commente pas.
- **Le code promo** — il repère la provenance d'une commande, il ne donne aucune réduction. Le
  montrer pousserait à chercher un code inexistant.
- **L'espace atelier** (`admin.html`) — réservé à l'équipe, il contient les coordonnées des clientes.
- **La création de compte** — elle fonctionne, mais elle est facultative par choix. La vidéo la
  signale d'une phrase au panier, sans l'imposer.
- **Les rubriques en construction** — Collections, Broderies, Nouveautés.

---

## Ajouter la voix off

1. Enregistrer `TUTORIAL_SCRIPT.md` à ~150 mots/minute, en marquant les respirations entre scènes.
2. Mixer à −16 LUFS, sans musique ou avec une nappe à −24 dB.
3. Muxer sur `ENMIIS-tutoriel.mp4` (piste vidéo seule, aucun son à remplacer).

---

## Une seconde vidéo, plus courte

La **casquette** ne demande qu'une mesure (tour de tête) contre huit pour la robe. Le même parcours
tient alors en **65 secondes**. `TUTORIAL_SCRIPT.md` donne les substitutions en fin de document.
