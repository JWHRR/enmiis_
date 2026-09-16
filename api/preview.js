/* ============================================================
   ENMIIS — Aperçu IA : « Voyez-vous porter cette tenue ».

   La cliente compose sa tenue, la met au panier, paie une fois l'accès
   premium, dépose un portrait, et le site lui rend une photographie
   d'elle vêtue de ce qu'elle a configuré.

   Cette fonction porte tout le service : le droit d'accès, les
   demandes de paiement, la génération, l'historique, et les actions
   de l'atelier. Même forme que api/auth.js — une seule route, une
   action par requête — pour qu'il n'y ait qu'un endroit à lire.

   ------------------------------------------------------------
   À FAIRE UNE FOIS

   1. Supabase → SQL Editor : exécuter sql/premium.sql
      (trois tables verrouillées + le bucket privé « apercus-ia »).

   2. Vercel → Settings → Environment Variables :

        SUPABASE_SERVICE_ROLE_KEY   obligatoire
        ADMIN_PASSWORD              recommandé (sinon « enmiis987 »)
        AI_PROVIDER                 gemini | fal | mock
        GEMINI_API_KEY              si AI_PROVIDER=gemini
        FAL_KEY                     si AI_PROVIDER=fal
        AI_MODEL                    facultatif : impose un nom de modele
                                    (sinon celui par defaut du fournisseur)
        SITE_URL                    https://votre-domaine (photos de référence)
        PREMIUM_TIERS               2,5,10 (paliers d'essais proposés)
        PREMIUM_UNIT_PRICE          1   (dinars par essai)
        PREMIUM_DAYS                365 (0 = sans expiration)

   Sans clé d'IA, le service tourne en mode « mock » : tout le parcours
   fonctionne, l'image rendue est une planche de contrôle. C'est fait
   exprès — on peut recetter le flux entier sans dépenser un centime.
   ------------------------------------------------------------ */

const crypto = require('crypto');

/* ==========================================================
   Réglages
   ========================================================== */

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kzqpvtrgchtiffcyxzfy.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.AUTH_SECRET || SERVICE_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'enmiis987';

const BUCKET = 'apercus-ia';
const PROVIDER = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'mock')).toLowerCase();

/* Un essai vaut un dinar, et l'on n'en vend pas moins de deux. Trois
   paliers seulement : choisir entre trois chiffres ronds est plus
   simple que de taper un nombre, et l'atelier sait d'avance ce qu'il
   doit voir arriver. */
const PRIX_UNITAIRE = Number(process.env.PREMIUM_UNIT_PRICE || 1);
const PALIERS = String(process.env.PREMIUM_TIERS || '2,5,10')
  .split(',')
  .map((n) => Math.round(Number(String(n).trim())))
  .filter((n) => Number.isFinite(n) && n > 0)
  .sort((a, b) => a - b);
const MIN_ESSAIS = PALIERS.length ? PALIERS[0] : 2;
const JOURS_VALIDITE = Number(process.env.PREMIUM_DAYS || 365);

const prixDe = (essais) => Math.round(essais * PRIX_UNITAIRE * 100) / 100;

const offre = () => ({
  currency: 'TND',
  unit: PRIX_UNITAIRE,
  min: MIN_ESSAIS,
  days: JOURS_VALIDITE,
  tiers: PALIERS.map((n) => ({ credits: n, price: prixDe(n) })),
});

/* Le nombre demande vient du navigateur : on ne retient que s'il
   correspond a un palier reellement propose. Sinon, le plus petit. */
function palierDemande(brut) {
  const n = Math.round(Number(brut));
  return PALIERS.indexOf(n) > -1 ? n : MIN_ESSAIS;
}

/* Un portrait arrive déjà réduit par le navigateur. Cette borne est la
   dernière défense : Vercel refuse les corps au-delà de 4,5 Mo, et une
   image plus lourde ne rendrait pas un meilleur visage. */
const PORTRAIT_MAX_OCTETS = 3 * 1024 * 1024;
const REFS_MAX = 4;

/* Au-delà, une génération restée « en cours » est tenue pour perdue :
   la fonction a probablement été coupée en plein vol. Le crédit est
   rendu. */
const GENERATION_PERDUE_MS = 8 * 60 * 1000;

/* ==========================================================
   Le catalogue, côté serveur

   Volontairement recopié ici plutôt que lu depuis le navigateur. Le
   texte envoyé au modèle est ainsi entièrement écrit par le serveur :
   une cliente ne peut pas glisser ses propres instructions dans la
   description de sa robe.
   ========================================================== */

const COULEURS = {
  noir:     { label: 'Noir',        code: 'ENM-01', hex: '#141414', en: 'deep black' },
  marine:   { label: 'Bleu marine', code: 'ENM-02', hex: '#1B2A4A', en: 'navy blue' },
  roi:      { label: 'Bleu roi',    code: 'ENM-03', hex: '#1D3FA8', en: 'royal blue' },
  bordeaux: { label: 'Bordeaux',    code: 'ENM-04', hex: '#6E1420', en: 'burgundy' },
  rouge:    { label: 'Rouge',       code: 'ENM-05', hex: '#B4231F', en: 'true red' },
  camel:    { label: 'Camel',       code: 'ENM-06', hex: '#B08256', en: 'camel tan' },
  beige:    { label: 'Beige',       code: 'ENM-07', hex: '#D9C6AC', en: 'beige' },
  creme:    { label: 'Crème',       code: 'ENM-08', hex: '#F0E7D8', en: 'cream' },
  blanc:    { label: 'Blanc',       code: 'ENM-09', hex: '#F7F7F5', en: 'off-white' },
  vert:     { label: 'Vert sapin',  code: 'ENM-10', hex: '#1F4436', en: 'pine green' },
  violet:   { label: 'Violet',      code: 'ENM-11', hex: '#4B2A6B', en: 'violet' },
  gris:     { label: 'Gris perle',  code: 'ENM-12', hex: '#8D8D8A', en: 'pearl grey' },
};

const ASPECTS = {
  brillant: 'a satin-like sheen that catches the light',
  mat: 'a completely matte finish with no sheen',
};

const ORNEMENTS = {
  strass: 'rhinestone ornament on the mortarboard',
  fleur: 'floral ornament on the mortarboard',
  aucun: 'no ornament',
};

const CONTOURS = {
  double: 'a double facing band along the edge',
  simple: 'a single central facing band',
  'liseré': 'a fine contrasting piping along the whole edge',
  aucun: 'no border',
};

const PIECES = {
  robe: 'a full-length academic graduation gown',
  casquette: 'an academic mortarboard cap',
  echarpe: 'an academic neck stole worn open over the chest',
  cape: 'an academic cape',
  'cape-americaine': 'an American-style academic hood cape covering the shoulders',
  'bond-miss': 'a ceremonial sash worn diagonally across the chest',
};

/* Les photographies d'atelier qui servent de référence. Les chemins
   sont reconstruits ici, jamais recopiés depuis le navigateur. */
const modeleValide = (id, max) => {
  const m = /^modele-(\d{1,2})$/.exec(String(id || ''));
  return m && Number(m[1]) >= 1 && Number(m[1]) <= max ? String(id) : null;
};

/* ==========================================================
   Petites fondations
   ========================================================== */

const entetes = (extra) => Object.assign({
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
}, extra || {});

const rest = (table) => SUPABASE_URL + '/rest/v1/' + table;

async function lire(table, query) {
  const res = await fetch(rest(table) + '?' + query, { headers: entetes() });
  if (!res.ok) throw new Error('lecture ' + table + ' ' + res.status + ' ' + (await res.text()));
  return res.json();
}

async function ecrire(table, ligne, query) {
  const url = rest(table) + (query ? '?' + query : '');
  const res = await fetch(url, {
    method: query ? 'PATCH' : 'POST',
    headers: entetes({ Prefer: 'return=representation' }),
    body: JSON.stringify(ligne),
  });
  if (!res.ok) throw new Error('ecriture ' + table + ' ' + res.status + ' ' + (await res.text()));
  const rows = await res.json();
  return rows[0] || null;
}

/* ---------- Jeton de session ----------
   Exactement la vérification de api/auth.js : même secret, même
   format. Une session vaut pour tout le site. */

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function verifierJeton(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const attendu = b64url(crypto.createHmac('sha256', SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

/* Le jeton porte l'identifiant, mais on relit la fiche : un compte
   supprimé ne doit pas continuer à consommer des générations. */
async function clienteDuJeton(token) {
  const claims = verifierJeton(token);
  if (!claims) return null;
  const rows = await lire('clients', 'id=eq.' + Number(claims.id) + '&select=id,name,phone&limit=1');
  return rows[0] || null;
}

/* ---------- Dépôt d'images ---------- */

async function deposer(chemin, octets, mime) {
  const res = await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + chemin, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: octets,
  });
  if (!res.ok) throw new Error('depot ' + res.status + ' ' + (await res.text()));
  return chemin;
}

/* Un lien signé, valable une heure. Le bucket étant privé, c'est le
   seul moyen d'afficher l'image — et il périme tout seul. */
async function lienSigne(chemin, secondes) {
  if (!chemin) return '';
  const res = await fetch(SUPABASE_URL + '/storage/v1/object/sign/' + BUCKET + '/' + chemin, {
    method: 'POST',
    headers: entetes(),
    body: JSON.stringify({ expiresIn: secondes || 3600 }),
  });
  if (!res.ok) return '';
  const data = await res.json().catch(() => null);
  return data && data.signedURL ? SUPABASE_URL + '/storage/v1' + data.signedURL : '';
}

async function effacerFichier(chemin) {
  if (!chemin) return;
  await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + chemin, {
    method: 'DELETE',
    headers: entetes(),
  }).catch(() => null);
}

/* ==========================================================
   Le droit d'accès
   ========================================================== */

async function accesDe(clientId) {
  const rows = await lire('premium_access', 'client_id=eq.' + clientId + '&select=*&limit=1');
  return rows[0] || null;
}

/* Un accès peut être actif mais périmé, ou actif mais épuisé. Cette
   fonction dit s'il autorise réellement une génération de plus. */
function accesUtilisable(acces) {
  if (!acces || !acces.active) return { ok: false, raison: 'aucun_acces' };
  if (acces.expiration_date && new Date(acces.expiration_date) < new Date()) {
    return { ok: false, raison: 'expire' };
  }
  if (Number(acces.credits) <= 0) return { ok: false, raison: 'credits_epuises' };
  return { ok: true };
}

const accesPublic = (acces) => ({
  active: !!(acces && acces.active),
  credits: acces ? Number(acces.credits) : 0,
  purchaseDate: acces ? acces.purchase_date : null,
  expiresAt: acces ? acces.expiration_date : null,
  paymentStatus: acces ? acces.payment_status : 'aucun',
});

/* ==========================================================
   La description de la tenue

   Tout ce qui part vers le modèle est écrit ici, à partir des seuls
   identifiants reconnus. Une valeur inconnue est ignorée, jamais
   recopiée telle quelle.
   ========================================================== */

function couleur(id) {
  const c = COULEURS[id];
  return c ? c.en + ' (' + c.hex + ', reference ' + c.code + ')' : null;
}

function decrirePiece(item) {
  const nom = PIECES[item && item.product];
  if (!nom) return null;

  const traits = [];
  const ajouter = (t) => { if (t) traits.push(t); };

  if (item.robe) {
    ajouter(couleur(item.robe.fabricColor) && 'colour: ' + couleur(item.robe.fabricColor));
    ajouter(ASPECTS[item.robe.finish] && 'fabric: ' + ASPECTS[item.robe.finish]);
    ajouter('sleeve cut exactly as shown in the attached sleeve reference photo');
  }
  if (item.cap) {
    ajouter(couleur(item.cap.fabricColor) && 'colour: ' + couleur(item.cap.fabricColor));
    ajouter(ASPECTS[item.cap.finish] && 'fabric: ' + ASPECTS[item.cap.finish]);
    ajouter(ORNEMENTS[item.cap.ornement]);
  }
  if (item.hood) {
    ajouter(couleur(item.hood.fabricColor) && 'colour: ' + couleur(item.hood.fabricColor));
    ajouter(ASPECTS[item.hood.finish] && 'fabric: ' + ASPECTS[item.hood.finish]);
    ajouter(CONTOURS[item.hood.contour]);
  }
  if (item.capeam) {
    ajouter(couleur(item.capeam.color1) && 'body colour: ' + couleur(item.capeam.color1));
    ajouter(couleur(item.capeam.color2) && 'chevron and facing colour: ' + couleur(item.capeam.color2));
  }
  if (item.bande) {
    ajouter(couleur(item.bande.fabricColor) && 'colour: ' + couleur(item.bande.fabricColor));
  }

  return nom + (traits.length ? ' — ' + traits.join('; ') : '');
}

/* Les photographies d'atelier à joindre. Elles pèsent bien plus lourd
   qu'une phrase : un modèle rend une manche juste parce qu'il l'a vue,
   pas parce qu'on la lui a décrite. */
function referencesDe(item) {
  const chemins = [];
  if (item.robe) {
    const m = modeleValide(item.robe.sleeve, 7);
    if (m) chemins.push('configurateur/robe/manches/' + m + '.jpeg');
  }
  if (item.cap && item.cap.ornement === 'strass') {
    const m = modeleValide(item.cap.strass, 15);
    if (m) chemins.push('configurateur/chapeaux/supplements/' + m + '.jpeg');
  }
  return chemins;
}

function consigne(items) {
  const pieces = items.map(decrirePiece).filter(Boolean);
  return [
    'Photorealistic fashion photograph of the exact person shown in the first attached photograph,',
    'standing full-length and facing the camera, wearing the graduation outfit described below.',
    '',
    'ABSOLUTE REQUIREMENT — the face must remain the same person.',
    'Preserve the identity, facial proportions, skin tone, hairstyle and hairline exactly as in the',
    'portrait. Keep eyeglasses if the person wears them. Keep facial hair if present. Do not beautify,',
    'slim, lighten or otherwise alter the face. If the portrait shows only the head and shoulders,',
    'extend the body naturally and plausibly, but the head must stay untouched.',
    '',
    'The outfit, to be reproduced exactly:',
    pieces.map((p, i) => '  ' + (i + 1) + '. ' + p).join('\n'),
    '',
    'The additional attached photographs are the real garments from the workshop. Match their cut,',
    'their proportions, their trims, their embroidery and their ornaments precisely. The colours given',
    'above are authoritative: follow the hex values, not the lighting of the reference photographs.',
    '',
    'Rendering: a professional studio fashion photograph. Neutral light-grey seamless background, soft',
    'even studio lighting, natural fabric drape with real folds and weight, sharp focus, full body in',
    'frame from head to feet, vertical 3:4 framing. Photographic realism only — no illustration, no',
    'painting, no cartoon, no 3D render look, no text, no watermark, no added logo.',
  ].join('\n');
}

/* ==========================================================
   Les modèles

   Un adaptateur par fournisseur, une seule signature. Changer de
   modèle, c'est poser une variable d'environnement — pas réécrire la
   fonction.
   ========================================================== */

/* Le portrait et les photographies d'atelier, en clair pour le modèle. */
async function imagesDeReference(items, portrait) {
  const parts = [portrait];
  const base = process.env.SITE_URL
    || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '');

  const chemins = [];
  items.forEach((item) => { referencesDe(item).forEach((c) => chemins.push(c)); });

  for (const chemin of chemins.slice(0, REFS_MAX)) {
    if (!base) break;
    try {
      const res = await fetch(base + '/' + chemin);
      if (!res.ok) continue;
      const octets = Buffer.from(await res.arrayBuffer());
      if (octets.length > 2 * 1024 * 1024) continue;
      parts.push({ mime: res.headers.get('content-type') || 'image/jpeg', octets });
    } catch (err) {
      /* Une référence manquante n'empêche pas la génération : la
         description textuelle reste. */
    }
  }
  return parts;
}

const MODELES = {
  gemini: {
    defaut: 'gemini-2.5-flash-image',
    async generer(texte, images, modele) {
      const cle = process.env.GEMINI_API_KEY;
      if (!cle) throw new Error('GEMINI_API_KEY absente');
      const nom = modele || MODELES.gemini.defaut;

      const parts = [{ text: texte }].concat(images.map((i) => ({
        inline_data: { mime_type: i.mime, data: i.octets.toString('base64') },
      })));

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + nom + ':generateContent',
        {
          method: 'POST',
          headers: { 'x-goog-api-key': cle, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
        },
      );
      if (!res.ok) throw new Error('gemini ' + res.status + ' ' + (await res.text()).slice(0, 700));

      const data = await res.json();
      const sorties = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      const image = sorties.find((p) => p.inline_data || p.inlineData);
      if (!image) {
        const refus = sorties.map((p) => p.text).filter(Boolean).join(' ').slice(0, 200);
        throw new Error('aucune image rendue' + (refus ? ' : ' + refus : ''));
      }
      const brut = image.inline_data || image.inlineData;
      return { octets: Buffer.from(brut.data, 'base64'), mime: brut.mime_type || brut.mimeType || 'image/png', modele: nom };
    },
  },

  fal: {
    defaut: 'fal-ai/flux-pro/kontext/max/multi',
    async generer(texte, images, modele) {
      const cle = process.env.FAL_KEY;
      if (!cle) throw new Error('FAL_KEY absente');
      const nom = modele || MODELES.fal.defaut;

      const res = await fetch('https://fal.run/' + nom, {
        method: 'POST',
        headers: { Authorization: 'Key ' + cle, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: texte,
          image_urls: images.map((i) => 'data:' + i.mime + ';base64,' + i.octets.toString('base64')),
          aspect_ratio: '3:4',
          output_format: 'png',
          safety_tolerance: '2',
        }),
      });
      if (!res.ok) throw new Error('fal ' + res.status + ' ' + (await res.text()).slice(0, 300));

      const data = await res.json();
      const url = ((data.images || [])[0] || {}).url;
      if (!url) throw new Error('aucune image rendue');
      const image = await fetch(url);
      return { octets: Buffer.from(await image.arrayBuffer()), mime: 'image/png', modele: nom };
    },
  },

  /* Sans clé, on rend une planche de contrôle : le parcours entier —
     paiement, validation, dépôt, historique, effacement — se recette
     sans appeler de service payant. */
  mock: {
    defaut: 'mock',
    async generer(texte, images) {
      const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">',
        '<rect width="768" height="1024" fill="#EDE6DC"/>',
        '<text x="384" y="470" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#141414">',
        'Aperçu de démonstration</text>',
        '<text x="384" y="520" text-anchor="middle" font-family="Helvetica,sans-serif" font-size="19" fill="#6B6B68">',
        'Aucune clé de modèle n’est configurée.</text>',
        '<text x="384" y="556" text-anchor="middle" font-family="Helvetica,sans-serif" font-size="17" fill="#6B6B68">',
        images.length + ' image(s) de référence · ' + texte.length + ' caractères de consigne</text>',
        '</svg>',
      ].join('');
      return { octets: Buffer.from(svg, 'utf8'), mime: 'image/svg+xml', modele: 'mock' };
    },
  },
};

/* ==========================================================
   Actions de la cliente
   ========================================================== */

/* L'état complet du service pour cette cliente : ce que le panier doit
   afficher tient dans cette seule réponse. */
async function etat(body) {
  const cliente = await clienteDuJeton(body.token);
  if (!cliente) return { code: 401, payload: { error: 'no_session' } };

  const [acces, demandes, apercus] = await Promise.all([
    accesDe(cliente.id),
    lire('premium_payments', 'client_id=eq.' + cliente.id + '&status=eq.en_attente&select=id,created_at&limit=1'),
    lire('ai_previews', 'client_id=eq.' + cliente.id + '&select=*&order=created_at.desc&limit=12'),
  ]);

  await reconcilier(apercus);

  return {
    code: 200,
    payload: {
      access: accesPublic(acces),
      pending: demandes.length > 0,
      offer: offre(),
      previews: await Promise.all(apercus.map(apercuPublic)),
    },
  };
}

/* Une génération que la fonction n'a pas eu le temps de finir reste
   « en cours » pour toujours. On la déclare perdue et on rend le
   crédit : la cliente a payé, elle ne doit rien perdre à une coupure. */
async function reconcilier(apercus) {
  const perdus = apercus.filter((a) => a.status === 'en_cours'
    && Date.now() - new Date(a.created_at).getTime() > GENERATION_PERDUE_MS);
  for (const a of perdus) {
    a.status = 'echec';
    a.error = 'Génération interrompue. Le crédit vous a été rendu.';
    await ecrire('ai_previews', { status: a.status, error: a.error, completed_at: new Date().toISOString() },
      'id=eq.' + a.id).catch(() => null);
    await rendreCredit(a.client_id).catch(() => null);
  }
}

async function apercuPublic(ligne) {
  return {
    id: ligne.id,
    status: ligne.status,
    createdAt: ligne.created_at,
    error: ligne.error || '',
    pieces: ((ligne.cart_snapshot || {}).pieces) || [],
    url: ligne.status === 'pret' ? await lienSigne(ligne.result_path, 3600) : '',
  };
}

/* La cliente déclare avoir payé. L'atelier tranche ensuite. */
async function demanderAcces(body) {
  const cliente = await clienteDuJeton(body.token);
  if (!cliente) return { code: 401, payload: { error: 'no_session' } };

  const essais = palierDemande(body.credits);

  const ouvertes = await lire('premium_payments',
    'client_id=eq.' + cliente.id + '&status=eq.en_attente&select=id&limit=1');
  if (ouvertes.length) {
    return { code: 200, payload: { ok: true, already: true, message: 'Votre demande est déjà en cours de vérification.' } };
  }

  /* Le statut est posé ici plutôt que laissé au défaut du schéma : la
     requête juste au-dessus interroge cette colonne, et une valeur
     implicite est une dépendance qu'on ne voit pas en lisant. */
  await ecrire('premium_payments', {
    client_id: cliente.id,
    reference: String(body.reference || '').slice(0, 120),
    note: String(body.note || '').slice(0, 400),
    credits: essais,
    amount: prixDe(essais),
    currency: 'TND',
    method: 'qr',
    status: 'en_attente',
  });

  /* Une ligne d'accès en attente rend l'état lisible d'un coup d'œil,
     côté cliente comme côté atelier. */
  const acces = await accesDe(cliente.id);
  if (!acces) {
    await ecrire('premium_access', { client_id: cliente.id, active: false, payment_status: 'en_attente' });
  } else if (!acces.active) {
    await ecrire('premium_access', { payment_status: 'en_attente', updated_at: new Date().toISOString() },
      'client_id=eq.' + cliente.id);
  }

  return { code: 200, payload: { ok: true, message: 'Demande reçue. L’atelier la vérifie sous peu.' } };
}

/* ---------- La génération ---------- */

function decoderPortrait(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!m) return { erreur: 'Envoyez une photo JPEG, PNG ou WebP.' };
  const octets = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  if (!octets.length) return { erreur: 'Photo illisible.' };
  if (octets.length > PORTRAIT_MAX_OCTETS) return { erreur: 'Photo trop lourde (3 Mo maximum).' };

  /* L'en-tête doit confirmer ce que le type annonce : un fichier
     quelconque renommé en .jpg n'ira pas plus loin. */
  const estJPEG = octets[0] === 0xFF && octets[1] === 0xD8;
  const estPNG = octets.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  const estWEBP = octets.slice(0, 4).toString('ascii') === 'RIFF' && octets.slice(8, 12).toString('ascii') === 'WEBP';
  if (!estJPEG && !estPNG && !estWEBP) return { erreur: 'Ce fichier n’est pas une image.' };

  return { octets, mime: m[1] };
}

/* Le panier arrive du navigateur, mais on n'en garde que les
   identifiants reconnus : c'est ce qui empêche une consigne étrangère
   de se glisser dans le texte envoyé au modèle. */
function nettoyerPanier(brut) {
  const items = Array.isArray(brut && brut.items) ? brut.items : [];
  return items.filter((i) => i && PIECES[i.product]).slice(0, 6).map((i) => ({
    product: i.product,
    robe: i.robe && { sleeve: i.robe.sleeve, finish: i.robe.finish, fabricColor: i.robe.fabricColor },
    cap: i.cap && { finish: i.cap.finish, fabricColor: i.cap.fabricColor, ornement: i.cap.ornement, strass: i.cap.strass },
    hood: i.hood && { finish: i.hood.finish, fabricColor: i.hood.fabricColor, contour: i.hood.contour },
    capeam: i.capeam && { color1: i.capeam.color1, color2: i.capeam.color2 },
    bande: i.bande && { fabricColor: i.bande.fabricColor },
  }));
}

async function retirerCredit(clientId) {
  const acces = await accesDe(clientId);
  const reste = Math.max(0, Number(acces.credits) - 1);
  await ecrire('premium_access',
    { credits: reste, updated_at: new Date().toISOString() },
    'client_id=eq.' + clientId);
  return reste;
}

async function rendreCredit(clientId) {
  const acces = await accesDe(clientId);
  if (!acces) return;
  await ecrire('premium_access',
    { credits: Number(acces.credits) + 1, updated_at: new Date().toISOString() },
    'client_id=eq.' + clientId);
}

async function generer(body) {
  const cliente = await clienteDuJeton(body.token);
  if (!cliente) return { code: 401, payload: { error: 'no_session' } };

  const acces = await accesDe(cliente.id);
  const droit = accesUtilisable(acces);
  if (!droit.ok) {
    return { code: 402, payload: { error: droit.raison, access: accesPublic(acces) } };
  }

  const portrait = decoderPortrait(body.portrait);
  if (portrait.erreur) return { code: 400, payload: { error: 'bad_portrait', message: portrait.erreur } };

  const items = nettoyerPanier(body.cart);
  if (!items.length) {
    return { code: 400, payload: { error: 'empty_cart', message: 'Ajoutez d’abord une pièce à votre panier.' } };
  }

  /* Le crédit part avant l'appel, pas après : deux onglets ouverts en
     même temps ne doivent pas générer deux fois pour un seul crédit.
     Il est rendu si la génération échoue. */
  const reste = await retirerCredit(cliente.id);

  const ligne = await ecrire('ai_previews', {
    client_id: cliente.id,
    status: 'en_cours',
    provider: PROVIDER,
    cart_snapshot: { pieces: items.map(decrirePiece).filter(Boolean), items },
  });

  const depart = Date.now();
  try {
    const moteur = MODELES[PROVIDER] || MODELES.mock;
    const images = await imagesDeReference(items, portrait);
    const texte = consigne(items);
    /* Le nom du modele vient de l'environnement, jamais du navigateur :
       sinon une cliente pourrait reclamer un modele plus cher que celui
       que l'atelier a choisi de payer. */
    const rendu = await moteur.generer(texte, images, process.env.AI_MODEL || '');

    const dossier = String(cliente.id);
    const extension = rendu.mime.indexOf('svg') > -1 ? 'svg' : (rendu.mime.indexOf('jpeg') > -1 ? 'jpg' : 'png');
    const cheminPortrait = 'portraits/' + dossier + '/' + ligne.id + '.' + (portrait.mime.split('/')[1] || 'jpg');
    const cheminResultat = 'resultats/' + dossier + '/' + ligne.id + '.' + extension;

    await deposer(cheminPortrait, portrait.octets, portrait.mime);
    await deposer(cheminResultat, rendu.octets, rendu.mime);

    const finie = await ecrire('ai_previews', {
      status: 'pret',
      model: rendu.modele,
      portrait_path: cheminPortrait,
      result_path: cheminResultat,
      ms: Date.now() - depart,
      completed_at: new Date().toISOString(),
    }, 'id=eq.' + ligne.id);

    return {
      code: 200,
      payload: {
        preview: await apercuPublic(finie),
        access: accesPublic(Object.assign({}, acces, { credits: reste })),
      },
    };
  } catch (err) {
    const message = (err && err.message) || 'échec';
    console.error('[ENMIIS Aperçu IA]', message);
    await ecrire('ai_previews', {
      status: 'echec',
      /* Assez long pour porter le diagnostic complet du fournisseur :
         un quota refuse nomme la limite atteinte, et c'est la seule
         chose qui dise quoi faire. */
      error: message.slice(0, 900),
      ms: Date.now() - depart,
      completed_at: new Date().toISOString(),
    }, 'id=eq.' + ligne.id).catch(() => null);
    await rendreCredit(cliente.id).catch(() => null);

    return {
      code: 502,
      payload: {
        error: 'generation_failed',
        message: 'La génération n’a pas abouti. Votre crédit vous a été rendu.',
        access: accesPublic(acces),
      },
    };
  }
}

/* La cliente efface un aperçu : la ligne et les deux fichiers
   disparaissent, portrait compris. C'est un droit, pas une option. */
async function supprimer(body) {
  const cliente = await clienteDuJeton(body.token);
  if (!cliente) return { code: 401, payload: { error: 'no_session' } };

  const rows = await lire('ai_previews',
    'id=eq.' + Number(body.id) + '&client_id=eq.' + cliente.id + '&select=*&limit=1');
  if (!rows.length) return { code: 404, payload: { error: 'not_found' } };

  await effacerFichier(rows[0].portrait_path);
  await effacerFichier(rows[0].result_path);
  await fetch(rest('ai_previews') + '?id=eq.' + rows[0].id, { method: 'DELETE', headers: entetes() });
  return { code: 200, payload: { ok: true } };
}

/* ==========================================================
   Actions de l'atelier
   ========================================================== */

function atelierAutorise(body) {
  const fourni = Buffer.from(String(body.adminPassword || ''));
  const attendu = Buffer.from(ADMIN_PASSWORD);
  return fourni.length === attendu.length && crypto.timingSafeEqual(fourni, attendu);
}

async function atelierVue(body) {
  if (!atelierAutorise(body)) return { code: 401, payload: { error: 'forbidden' } };

  const [paiements, acces, apercus, clients] = await Promise.all([
    lire('premium_payments', 'select=*&order=created_at.desc&limit=200'),
    lire('premium_access', 'select=*&order=updated_at.desc&limit=200'),
    lire('ai_previews', 'select=*&order=created_at.desc&limit=60'),
    lire('clients', 'select=id,name,phone&limit=1000'),
  ]);

  const parId = {};
  clients.forEach((c) => { parId[c.id] = c; });
  const nommer = (id) => parId[id] || { id, name: 'Compte ' + id, phone: '' };

  return {
    code: 200,
    payload: {
      offer: offre(),
      provider: PROVIDER,
      /* Pour ouvrir un acces a une cliente qui n'a rien demande : sans
         cette liste, l'atelier n'aurait personne a designer. */
      clients: clients,
      payments: paiements.map((p) => Object.assign({ client: nommer(p.client_id) }, p)),
      access: acces.map((a) => Object.assign({ client: nommer(a.client_id) }, a)),
      previews: await Promise.all(apercus.map(async (a) => ({
        id: a.id,
        client: nommer(a.client_id),
        status: a.status,
        provider: a.provider,
        model: a.model,
        ms: a.ms,
        error: a.error,
        createdAt: a.created_at,
        pieces: ((a.cart_snapshot || {}).pieces) || [],
        url: a.status === 'pret' ? await lienSigne(a.result_path, 1800) : '',
      }))),
    },
  };
}

/* Ouvrir l'accès : à la suite d'un paiement validé, ou à la main. */
async function ouvrirAcces(clientId, credits, jours) {
  const maintenant = new Date();
  const fin = jours > 0 ? new Date(maintenant.getTime() + jours * 864e5).toISOString() : null;
  const existant = await accesDe(clientId);

  /* Un rachat s'ajoute au reliquat plutôt que de l'écraser : la
     cliente qui reprend un forfait ne perd pas ce qu'elle avait. */
  const total = (existant && existant.active ? Number(existant.credits) : 0) + credits;

  const ligne = {
    active: true,
    payment_status: 'valide',
    credits: total,
    purchase_date: maintenant.toISOString(),
    expiration_date: fin,
    updated_at: maintenant.toISOString(),
  };

  if (existant) await ecrire('premium_access', ligne, 'client_id=eq.' + clientId);
  else await ecrire('premium_access', Object.assign({ client_id: clientId }, ligne));
}

async function atelierValider(body) {
  if (!atelierAutorise(body)) return { code: 401, payload: { error: 'forbidden' } };

  const rows = await lire('premium_payments', 'id=eq.' + Number(body.paymentId) + '&select=*&limit=1');
  if (!rows.length) return { code: 404, payload: { error: 'not_found' } };
  const paiement = rows[0];

  await ecrire('premium_payments', {
    status: 'valide',
    admin_note: String(body.note || '').slice(0, 400),
    reviewed_at: new Date().toISOString(),
  }, 'id=eq.' + paiement.id);

  /* Par defaut, exactement ce que la cliente a demande et paye. */
  const credits = Number(body.credits) > 0 ? Math.round(Number(body.credits))
    : (Number(paiement.credits) > 0 ? Number(paiement.credits) : MIN_ESSAIS);
  const jours = body.days === undefined ? JOURS_VALIDITE : Number(body.days);
  await ouvrirAcces(paiement.client_id, credits, jours);

  return { code: 200, payload: { ok: true } };
}

async function atelierRefuser(body) {
  if (!atelierAutorise(body)) return { code: 401, payload: { error: 'forbidden' } };
  await ecrire('premium_payments', {
    status: 'refuse',
    admin_note: String(body.note || '').slice(0, 400),
    reviewed_at: new Date().toISOString(),
  }, 'id=eq.' + Number(body.paymentId));
  await ecrire('premium_access', { payment_status: 'refuse', updated_at: new Date().toISOString() },
    'client_id=eq.' + Number(body.clientId)).catch(() => null);
  return { code: 200, payload: { ok: true } };
}

async function atelierAccorder(body) {
  if (!atelierAutorise(body)) return { code: 401, payload: { error: 'forbidden' } };
  const credits = Number(body.credits) > 0 ? Math.round(Number(body.credits)) : MIN_ESSAIS;
  const jours = body.days === undefined ? JOURS_VALIDITE : Number(body.days);
  await ouvrirAcces(Number(body.clientId), credits, jours);
  return { code: 200, payload: { ok: true } };
}

async function atelierRetirer(body) {
  if (!atelierAutorise(body)) return { code: 401, payload: { error: 'forbidden' } };
  await ecrire('premium_access',
    { active: false, credits: 0, updated_at: new Date().toISOString() },
    'client_id=eq.' + Number(body.clientId));
  return { code: 200, payload: { ok: true } };
}

/* ==========================================================
   Aiguillage
   ========================================================== */

/* PostgREST annonce une table inconnue par le code PGRST205, ou par ce
   message quand le cache de schema n'a pas encore ete rafraichi. */
function tablesAbsentes(message) {
  return /PGRST205/.test(message)
    || /Could not find the table/i.test(message)
    || /relation .* does not exist/i.test(message);
}

const ACTIONS = {
  status: etat,
  payment: demanderAcces,
  generate: generer,
  delete: supprimer,
  admin_overview: atelierVue,
  admin_validate: atelierValider,
  admin_reject: atelierRefuser,
  admin_grant: atelierAccorder,
  admin_revoke: atelierRetirer,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!SERVICE_KEY) {
    res.status(503).json({
      error: 'premium_not_configured',
      message: 'L’aperçu IA n’est pas encore activé.',
      hint: 'Exécutez sql/premium.sql puis posez SUPABASE_SERVICE_ROLE_KEY dans Vercel.',
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (err) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  const action = ACTIONS[body.action];
  if (!action) {
    res.status(400).json({ error: 'unknown_action' });
    return;
  }

  try {
    const out = await action(body);
    res.status(out.code).json(out.payload);
  } catch (err) {
    const message = (err && err.message) || String(err);
    console.error('[ENMIIS Aperçu IA]', message);

    /* Le cas de loin le plus frequent au demarrage : les tables ne sont
       pas encore creees. PostgREST repond 404 et l'on rendait « Service
       indisponible » — exact, et parfaitement inutile. On dit quoi
       faire. */
    if (tablesAbsentes(message)) {
      res.status(503).json({
        error: 'premium_not_configured',
        message: 'L’aperçu IA n’est pas encore activé : les tables n’existent pas.',
        hint: 'Supabase → SQL Editor → exécutez sql/premium.sql, puis rouvrez cette fenêtre.',
      });
      return;
    }

    res.status(502).json({ error: 'server_error', message: 'Service indisponible, réessayez.' });
  }
};
