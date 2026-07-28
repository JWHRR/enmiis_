/* ============================================================
   ENMIIS — API des commandes (fonction serverless Vercel).

   Stocke les commandes dans Vercel KV (Redis, fourni par Upstash)
   pour qu'elles atteignent l'espace atelier depuis n'importe quel
   appareil client — c'est la limite du stockage 100 % navigateur
   utilisé jusqu'ici (localStorage : une commande passée sur le
   téléphone d'un client n'apparaissait que sur CE téléphone, jamais
   dans admin.html ouvert sur l'ordinateur de l'atelier).

   MISE EN ROUTE (une seule fois) — dans le tableau de bord Vercel :
     Projet → Storage → Create Database → KV → Connect to Project.
   Vercel injecte alors automatiquement KV_REST_API_URL et
   KV_REST_API_TOKEN ; aucune autre configuration n'est nécessaire,
   cette fonction les lit directement depuis l'environnement.

   Tant que le KV n'est pas ajouté, l'API répond 503 avec un message
   clair. Le site continue de fonctionner (voir js/cz-store.js et
   js/admin.js) en stockage local uniquement, simplement sans
   synchronisation entre appareils — rien n'est perdu, la commande
   attend juste que le stockage partagé soit activé.
   ============================================================ */

const REST_URL = process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN;

/* Toutes les commandes vivent dans un unique hash Redis (un champ par
   référence de commande) : chaque écriture est atomique et ne touche
   que sa commande, sans risque d'écraser les autres en cas d'envois
   simultanés depuis plusieurs clients. */
const KEY = 'enmiis:orders';

/* Le corps de la requête Upstash porte la commande en entier (clé,
   champ, valeur) : rien ne transite par l'URL, donc aucune limite de
   longueur ne s'applique aux fichiers/logos encodés en base64. */
async function redis(command) {
  const res = await fetch(REST_URL + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REST_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });
  if (!res.ok) throw new Error('upstash_http_' + res.status);
  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first || first.error) throw new Error((first && first.error) || 'upstash_bad_response');
  return first.result;
}

/* Autorise le configurateur à joindre l'API même s'il est un jour servi
   depuis un autre domaine (aperçu Vercel, futur nom de domaine…). */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readRef(req) {
  if (req.query && req.query.ref) return String(req.query.ref);
  try {
    return new URL(req.url, 'http://localhost').searchParams.get('ref');
  } catch (err) {
    return null;
  }
}

function readBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (err) { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!REST_URL || !REST_TOKEN) {
    res.status(503).json({
      error: 'storage_not_configured',
      message: 'Stockage partagé (Vercel KV) non activé sur ce projet — voir le commentaire en tête de api/orders.js.',
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const flat = (await redis(['HGETALL', KEY])) || [];
      const orders = [];
      for (let i = 0; i < flat.length; i += 2) {
        try { orders.push(JSON.parse(flat[i + 1])); } catch (err) { /* entrée corrompue ignorée */ }
      }
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.status(200).json(orders);
      return;
    }

    if (req.method === 'POST') {
      const order = readBody(req);
      if (!order || !order.ref || !order.config) {
        res.status(400).json({ error: 'invalid_order' });
        return;
      }
      order.createdAt = order.createdAt || new Date().toISOString();
      order.status = order.status || 'nouveau';
      order.adminNote = order.adminNote || '';
      delete order.synced; /* indicateur local au navigateur, sans rapport côté serveur */
      await redis(['HSET', KEY, order.ref, JSON.stringify(order)]);
      res.status(201).json(order);
      return;
    }

    if (req.method === 'PATCH') {
      const ref = readRef(req);
      if (!ref) { res.status(400).json({ error: 'missing_ref' }); return; }
      const raw = await redis(['HGET', KEY, ref]);
      if (!raw) { res.status(404).json({ error: 'not_found' }); return; }
      const existing = JSON.parse(raw);
      const patch = readBody(req);
      /* Fusion superficielle : seuls les champs envoyés (statut, note…)
         sont modifiés, référence et date de création restent figées. */
      const updated = Object.assign({}, existing, patch, { ref: existing.ref, createdAt: existing.createdAt });
      await redis(['HSET', KEY, ref, JSON.stringify(updated)]);
      res.status(200).json(updated);
      return;
    }

    if (req.method === 'DELETE') {
      const ref = readRef(req);
      if (!ref) { res.status(400).json({ error: 'missing_ref' }); return; }
      await redis(['HDEL', KEY, ref]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: err.message });
  }
};
