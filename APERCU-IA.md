# Aperçu IA — « Voyez-vous porter cette tenue »

Service premium du panier. La cliente compose sa tenue, paie une fois,
dépose un portrait, et reçoit une photographie d'elle vêtue de ce
qu'elle a configuré.

---

## 1. Mise en service

Quatre étapes. Tant qu'elles ne sont pas faites, le panneau reste
invisible et le site fonctionne exactement comme avant.

**1. La base.** Supabase → SQL Editor → coller `sql/premium.sql`.
Trois tables verrouillées et un dépôt d'images privé.

**2. Les variables.** Vercel → Settings → Environment Variables.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | oui | La seule clé qui ouvre les tables |
| `ADMIN_PASSWORD` | recommandé | Mot de passe de l'atelier, revérifié côté serveur |
| `AI_PROVIDER` | non | `gemini`, `fal` ou `mock` |
| `GEMINI_API_KEY` | si `gemini` | |
| `FAL_KEY` | si `fal` | |
| `SITE_URL` | recommandé | `https://votre-domaine` — sert à joindre les photos d'atelier |
| `PREMIUM_PRICE` | non | 29 par défaut |
| `PREMIUM_CREDITS` | non | 5 générations par achat |
| `PREMIUM_DAYS` | non | 365 ; mettre 0 pour ne jamais expirer |

**3. Le QR.** Déposez votre QR de paiement dans
`img/premium/qr-paiement.png`. Tant qu'il manque, le panneau l'écrit en
clair au lieu d'afficher une image cassée.

**4. Le mot de passe de l'atelier.** `ADMIN_PASSWORD` doit être
identique à la constante `PASSWORD` dans `js/admin.js`. Les changer
tous les deux, ou n'en changer aucun.

Sans clé d'IA, le service tourne en mode `mock` : tout le parcours
fonctionne, l'image rendue est une planche de contrôle. Recettez comme
cela avant de dépenser quoi que ce soit.

---

## 2. Architecture

```
Navigateur                      Vercel                    Services
──────────                      ──────                    ────────
panier.html
  js/preview.js  ──────────▶  api/preview.js  ─────────▶  Supabase
   · réduit le portrait          · vérifie le jeton         · 3 tables (RLS, sans policy)
   · n'agit que connectée        · vérifie les crédits      · dépôt privé
   · demande, génère, efface     · écrit la consigne
                                 · appelle le modèle  ────▶  Gemini / fal.ai
admin.html
  js/admin.js    ──────────▶  api/preview.js
                                 · revérifie le mot de passe
```

Une seule route, une action par requête — la forme de `api/auth.js`,
pour qu'il n'y ait qu'un endroit à lire.

### Le chemin d'une génération

1. Le navigateur réduit le portrait à 1024 px et le réencode en JPEG.
   Les métadonnées de l'appareil, position GPS comprise, disparaissent
   au passage.
2. Le serveur vérifie le jeton, relit la fiche cliente, vérifie que
   l'accès est actif, non périmé, et qu'il reste un crédit.
3. Il vérifie que le portrait est bien une image : le type annoncé doit
   correspondre aux octets d'en-tête.
4. **Il décrémente le crédit avant d'appeler le modèle.** Deux onglets
   ouverts ne peuvent pas générer deux fois pour un seul crédit.
5. Il écrit la consigne à partir des seuls identifiants qu'il reconnaît,
   et joint les photographies d'atelier correspondantes.
6. Il appelle le modèle, dépose le portrait et le résultat, et rend un
   lien signé d'une heure.
7. Si quoi que ce soit échoue, le crédit est rendu et l'échec est tracé.

### Ce qui part au modèle

Le texte est écrit par le serveur, jamais par le navigateur. Le panier
reçu est filtré : seuls les identifiants connus survivent, tout le reste
est jeté. Une cliente ne peut pas glisser ses propres instructions dans
la description de sa robe — c'est vérifié par un test.

La consigne exige, dans cet ordre : l'identité du visage inchangée
(proportions, carnation, coiffure, lunettes, barbe), puis chaque pièce
avec sa couleur donnée en hexadécimal et son code atelier, puis le
rendu photographique. Les photographies de manches et de strass sont
jointes en pièces : un modèle rend une manche parce qu'il l'a vue, pas
parce qu'on la lui a décrite.

---

## 3. Base de données

`sql/premium.sql`. Trois tables, RLS active, **aucune policy** : la clé
publiable qui figure dans le code du navigateur ne peut rien y lire.

| Table | Rôle | Colonnes notables |
|---|---|---|
| `premium_access` | le droit, une ligne par cliente | `active`, `credits`, `expiration_date` |
| `premium_payments` | les demandes à valider | `reference`, `status`, `admin_note` |
| `ai_previews` | les aperçus | `cart_snapshot`, `portrait_path`, `result_path`, `cost_usd`, `ms` |

Le dépôt `apercus-ia` est privé. Les images ne sont servies que par des
liens signés d'une heure, délivrés par la fonction.

`purge_apercus_anciens(90)` efface les lignes de plus de 90 jours.
Branchez-la sur un cron Supabase.

---

## 4. API

`POST /api/preview`, une action par requête.

**Cliente** — le jeton de session accompagne chaque appel.

| Action | Rend |
|---|---|
| `status` | accès, crédits, offre, demande en cours, 12 derniers aperçus |
| `payment` | enregistre une demande ; une seconde ne crée pas de doublon |
| `generate` | l'aperçu, ou 402 si le droit manque |
| `delete` | efface la ligne **et** les deux fichiers |

**Atelier** — `adminPassword`, comparé à temps constant.

| Action | Effet |
|---|---|
| `admin_overview` | paiements, accès, aperçus, avec les noms |
| `admin_validate` | valide et ouvre l'accès |
| `admin_reject` | refuse |
| `admin_grant` | ouvre à la main, sans paiement |
| `admin_revoke` | ferme |

Un rachat **s'ajoute** au reliquat au lieu de l'écraser.

---

## 5. Sécurité

**Ce qui est en place.**

Les portraits sont des données biométriques. Le dépôt est privé, les
liens périment en une heure, la cliente efface quand elle veut, et les
lignes de plus de 90 jours partent au ménage. Le consentement est
demandé par une case à cocher, décochée par défaut, et vérifié avant
tout envoi.

Les tables sont fermées à la clé publiable. Le jeton de session est
revérifié à chaque appel et la fiche cliente relue : un compte supprimé
cesse immédiatement de consommer. Une cliente ne peut lire ni effacer
l'aperçu d'une autre — c'est vérifié par un test. Le mot de passe de
l'atelier est comparé à temps constant.

Le crédit part avant l'appel au modèle : c'est ce qui empêche un même
compte de vider le budget depuis plusieurs onglets.

**Ce qui reste à faire, et qui compte.**

1. **La clé publiable de `orders` ouvre encore les commandes.** Elle est
   dans le code du navigateur et donne lecture et modification sur les
   noms, téléphones et mesures de toutes vos clientes. Le correctif :
   activer RLS sur `orders` sans policy, `api/orders.js` passant déjà
   sur `SUPABASE_SERVICE_ROLE_KEY` quand elle existe. Ce point est
   antérieur à ce travail mais devient plus lourd maintenant que la
   base porte aussi des visages.

2. **Le portail de `admin.html` ne protège rien.** Il se joue dans le
   navigateur ; le fichier le dit lui-même. Les actions premium, elles,
   sont revérifiées côté serveur. Mais tant que le portail est
   cosmétique, n'importe qui peut ouvrir la page. Une vraie
   authentification serveur reste à faire.

3. **`ADMIN_PASSWORD` par défaut vaut `enmiis987`,** valeur écrite en
   clair dans le dépôt public. Posez-en une autre dans Vercel, et
   reportez-la dans `js/admin.js`.

4. **Aucune limite de débit par adresse.** Les crédits bornent la
   dépense par compte, pas la création de comptes. Si le service
   s'ouvre largement, ajoutez une limite sur `register`.

---

## 6. Modèles

Mon conseil, à vérifier contre les offres du jour.

**Gemini 2.5 Flash Image — à retenir en premier.** Il accepte plusieurs
images de référence dans un même appel, tient bien l'identité d'un
visage, répond en cinq à quinze secondes, et coûte peu. C'est le
réglage par défaut (`AI_PROVIDER=gemini`).

**FLUX.1 Kontext [max] multi, via fal.ai — la solution de repli.** Il
suit l'instruction d'édition de façon plus littérale, ce qui aide quand
une broderie doit être reproduite au détail près. Plus cher, un peu plus
lent. `AI_PROVIDER=fal`.

**Seedream 4, Qwen-Image-Edit** — même famille d'usage, disponibles sur
fal et Replicate. Changer de modèle est un changement de variable, pas
de code : `FAL_MODEL` suffit.

**Les modèles d'essayage dédiés — IDM-VTON, CatVTON, Kolors — ne
conviennent pas ici.** Vous les avez évoqués et c'est un réflexe juste,
mais ils sont entraînés sur des vêtements photographiés à plat et sur
des bustes. Une toge pleine longueur, avec sa cape américaine et sa
bande portée en diagonale, est hors de leur domaine. Ils rendront un
haut de corps correct et une robe fausse.

### Ce qu'il faut en attendre

Le visage tient bien. La couleur tient bien, parce qu'elle part en
hexadécimal avec son code atelier. La coupe des manches tient
correctement, parce que la photographie d'atelier est jointe.

Une broderie fine, un logo d'université, un texte brodé : non. Aucun
modèle actuel ne reproduit un texte brodé au caractère près. Annoncez
l'aperçu comme un aperçu, pas comme un bon à tirer. C'est aussi
pourquoi le service se vend par crédits : une cliente relance deux ou
trois fois avant d'obtenir ce qu'elle veut.

---

## 7. Coûts

Ordres de grandeur, à confronter aux tarifs du jour.

| Poste | Par génération |
|---|---|
| Gemini 2.5 Flash Image | ~0,04 $ |
| FLUX Kontext max | ~0,08 $ |
| Dépôt Supabase (2 images) | négligeable |
| Fonction Vercel | négligeable |

À 0,04 $ l'image et cinq crédits par achat, un forfait coûte environ
0,20 $ de modèle. Vendu 29 TND, la marge est large même en tenant
compte des relances.

| Volume mensuel | Coût modèle |
|---|---|
| 500 générations | ~20 $ |
| 2 000 | ~80 $ |
| 10 000 | ~400 $ |

Le dépôt d'images pèse plus longtemps que le calcul : deux images par
aperçu, autour de 1,5 Mo. Dix mille aperçus font une quinzaine de
gigaoctets. Le ménage à 90 jours est là pour cela.

**Ce qui coûtera avant le modèle :** Vercel. La génération tient une
fonction ouverte trente secondes. Au-delà de quelques milliers de
générations par mois, passez à une file d'attente — voir ci-dessous.

---

## 8. Montée en charge

Ce qui est déjà en place tient plusieurs milliers de générations : la
fonction est sans état, les compteurs sont dans Postgres, le dépôt est
externe, et l'adaptateur de modèle se change par une variable.

Deux limites connues, et ce qu'il faut faire quand on les touche.

**La durée d'une fonction.** `vercel.json` accorde 60 secondes. Si un
modèle plus lourd dépasse, il faut passer en file : `generate` enregistre
la demande et rend la main, un travailleur consomme la file, le
navigateur interroge `status`. Le client sait déjà faire — il interroge
l'historique quand la requête se coupe — et la table `ai_previews` porte
déjà l'état `en_cours`. Le travail est donc de remplacer l'appel
synchrone, pas de repenser le modèle de données.

**Les générations simultanées.** Les fournisseurs limitent le débit.
Au-delà, il faut une file et un `429` propre.

---

## 9. Vérification

102 assertions, toutes vertes.

**Le serveur** — Supabase émulé en mémoire, PostgREST et dépôt compris.
On éprouve la logique réelle sans réseau ni clé : droits, crédits,
remboursement après panne, expiration, cumul d'un rachat, cloisonnement
entre comptes, refus d'un fichier déguisé en image, refus d'une consigne
glissée dans le panier, reprise d'une génération abandonnée.

**Le navigateur** — le panneau invisible pour une invitée, l'offre, la
demande de paiement, l'attente, le dépôt, la case de consentement qui
bloque l'envoi, la réduction du portrait, la galerie, l'effacement, et
le service coupé qui n'abîme pas le panier.

La qualité des images rendues, elle, n'est pas vérifiable sans clé.
C'est le seul point que je n'ai pas pu éprouver : mettez une clé, lancez
trois générations, et jugez sur pièces avant d'ouvrir le service.
