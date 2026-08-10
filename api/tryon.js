/* ============================================================
   ENMIIS — Essayage virtuel.

   Compose une image du client portant exactement les pièces qu'il a
   configurées. Le panier reste la source de vérité : l'image produite
   ici n'est qu'une visualisation, elle ne devient jamais un article.

   Aucun modèle d'Anthropic ne génère d'images — il faut donc un
   fournisseur d'images externe. Posez UNE de ces variables dans
   Vercel (Settings → Environment Variables) :

     GEMINI_API_KEY   — Google AI Studio, aistudio.google.com/apikey
     OPENAI_API_KEY   — OpenAI, platform.openai.com/api-keys

   Sans clé, l'API répond 503 et la page d'essayage affiche un message
   clair au lieu de casser : le reste du site continue de fonctionner.
   ============================================================ */

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const OPENAI_MODEL = 'gpt-image-1';

/* Une photo de téléphone réduite côté navigateur pèse ~300 Ko ;
   au-delà de 6 Mo la requête n'a pas été redimensionnée. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/* Photo de référence de chaque pièce, servie par le site lui-même. */
const REFERENCE = {
  robe: 'img/soutenance/1.png',
  casquette: 'img/cap.webp',
  echarpe: 'img/hood.webp',
};

/* ---------- Utilitaires ---------- */

/* Découpe une data URL en { mime, base64 }, ou null si elle est
   malformée / d'un type que nous n'acceptons pas. */
function parseDataUrl(value) {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(value || ''));
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (ALLOWED_MIME.indexOf(mime) === -1) return null;
  return { mime, base64: match[2] };
}

function originOf(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + host;
}

/* Récupère les photos produit correspondant aux pièces commandées.
   Une référence indisponible est simplement ignorée : le modèle
   travaille alors à partir de la description écrite. */
async function loadReferences(req, pieces) {
  const base = originOf(req);
  const wanted = pieces
    .map((piece) => REFERENCE[piece.id])
    .filter(Boolean)
    .slice(0, 3);

  const loaded = [];
  for (const path of wanted) {
    try {
      const res = await fetch(base + '/' + path);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') || 'image/png';
      loaded.push({ mime: mime.split(';')[0].trim(), base64: buffer.toString('base64') });
    } catch (err) {
      /* Référence injoignable : on continue sans elle. */
    }
  }
  return loaded;
}

/* ---------- Consigne envoyée au modèle ---------- */

function buildPrompt(outfit) {
  const lines = (outfit.pieces || []).map((piece) => '- ' + piece.label + ' : ' + piece.detail);
  return [
    'Photorealistic virtual try-on for a graduation ceremony portrait.',
    '',
    'The FIRST image is the customer. Keep this person exactly as they are:',
    'same face, same skin tone, same hair, same body proportions, same pose,',
    'same background. Do not beautify, slim, age, or otherwise alter them.',
    '',
    'The remaining images are the actual ENMIIS garments to put on them.',
    'Reproduce those garments faithfully — their real cut, fabric, colour,',
    'trim and proportions. Do not invent a generic graduation gown, and do',
    'not substitute a different style, colour, or shape.',
    '',
    'Pieces the customer ordered:',
    lines.length ? lines.join('\n') : '- Tenue de soutenance ENMIIS',
    '',
    'Dress the person in these pieces only. Any piece not listed above must',
    'not appear. Match the garment lighting and shadows to the original',
    'photo so the result reads as a single photograph.',
    '',
    'Output: one image, the customer wearing the outfit, framed as a',
    'natural graduation portrait.',
  ].join('\n');
}

/* ---------- Fournisseurs ---------- */

async function generateWithGemini(key, prompt, images) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL + ':generateContent';

  const parts = [{ text: prompt }].concat(
    images.map((img) => ({ inline_data: { mime_type: img.mime, data: img.base64 } })),
  );

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload && payload.error ? payload.error.message : 'HTTP ' + res.status;
    throw new Error('gemini: ' + detail);
  }

  const candidates = (payload && payload.candidates) || [];
  for (const candidate of candidates) {
    const blocks = (candidate.content && candidate.content.parts) || [];
    for (const block of blocks) {
      const inline = block.inline_data || block.inlineData;
      if (inline && inline.data) {
        const mime = inline.mime_type || inline.mimeType || 'image/png';
        return 'data:' + mime + ';base64,' + inline.data;
      }
    }
  }
  throw new Error('gemini: aucune image renvoyée');
}

async function generateWithOpenAI(key, prompt, images) {
  /* L'édition multi-images attend un multipart : la photo du client
     d'abord, les références ensuite, dans le même champ image[]. */
  const form = new FormData();
  form.append('model', OPENAI_MODEL);
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', '1024x1536');
  images.forEach((img, index) => {
    const ext = img.mime === 'image/jpeg' ? 'jpg' : img.mime.split('/')[1];
    const bytes = Buffer.from(img.base64, 'base64');
    form.append('image[]', new Blob([bytes], { type: img.mime }), 'piece-' + index + '.' + ext);
  });

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key },
    body: form,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload && payload.error ? payload.error.message : 'HTTP ' + res.status;
    throw new Error('openai: ' + detail);
  }

  const b64 = payload && payload.data && payload.data[0] && payload.data[0].b64_json;
  if (!b64) throw new Error('openai: aucune image renvoyée');
  return 'data:image/png;base64,' + b64;
}

/* ---------- Point d'entrée ---------- */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !openaiKey) {
    /* `message` s'affiche à la cliente, `hint` s'adresse à l'atelier :
       une visiteuse n'a pas à lire une consigne de configuration. */
    res.status(503).json({
      error: 'tryon_not_configured',
      message: 'L’essayage virtuel n’est pas encore disponible. Notre équipe ' +
        'l’active très prochainement — votre panier, lui, est bien enregistré.',
      hint: 'Posez GEMINI_API_KEY (aistudio.google.com/apikey) ou OPENAI_API_KEY ' +
        'dans les variables d’environnement Vercel, puis redéployez.',
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (err) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'bad_request', message: 'Requête illisible.' });
    return;
  }

  const photo = parseDataUrl(body.photo);
  if (!photo) {
    res.status(400).json({
      error: 'bad_photo',
      message: 'Photo manquante ou format non pris en charge (JPG, PNG ou WebP).',
    });
    return;
  }
  /* base64 pèse ~4/3 des octets d'origine. */
  if ((photo.base64.length * 3) / 4 > MAX_PHOTO_BYTES) {
    res.status(413).json({ error: 'photo_too_large', message: 'Photo trop lourde.' });
    return;
  }

  const outfit = body.outfit && typeof body.outfit === 'object' ? body.outfit : {};
  const pieces = Array.isArray(outfit.pieces) ? outfit.pieces.slice(0, 3) : [];
  if (!pieces.length) {
    res.status(400).json({
      error: 'empty_cart',
      message: 'Votre panier est vide : configurez au moins une pièce.',
    });
    return;
  }

  try {
    const references = await loadReferences(req, pieces);
    const images = [photo].concat(references);
    const prompt = buildPrompt({ pieces });

    const image = geminiKey
      ? await generateWithGemini(geminiKey, prompt, images)
      : await generateWithOpenAI(openaiKey, prompt, images);

    res.status(200).json({ image, provider: geminiKey ? 'gemini' : 'openai' });
  } catch (err) {
    console.error('[ENMIIS Essayage]', err && err.message ? err.message : err);
    res.status(502).json({
      error: 'generation_failed',
      message: 'La génération a échoué. Réessayez dans un instant.',
    });
  }
};
