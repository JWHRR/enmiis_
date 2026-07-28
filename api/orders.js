/* ============================================================
   ENMIIS — API des commandes (fonction serverless Vercel).

   Stocke les commandes dans Supabase (Postgres), via l'API REST
   auto-générée de Supabase (PostgREST) — aucune dépendance à
   installer, uniquement fetch(). Sans ce serveur partagé, chaque
   commande restait coincée dans le localStorage du téléphone qui
   l'avait passée, invisible depuis admin.html sur un autre appareil.

   MISE EN ROUTE (une seule fois) :

   1) Dans Supabase → SQL Editor, exécuter :

        create table if not exists orders (
          ref         text primary key,
          created_at  timestamptz not null default now(),
          status      text not null default 'nouveau',
          admin_note  text not null default '',
          config      jsonb not null
        );

      (RLS peut rester désactivée, ou activée sans policy : cette
      fonction utilise la clé service_role, qui contourne RLS. Cette
      clé ne doit JAMAIS être envoyée au navigateur ni au client —
      uniquement lue ici, côté serveur, depuis les variables
      d'environnement.)

   2) Dans Vercel → Project → Settings → Environment Variables,
      ajouter :

        SUPABASE_URL              = https://<projet>.supabase.co
        SUPABASE_SERVICE_ROLE_KEY = <clé service_role — Supabase →
                                      Project Settings → API>

      puis redéployer (ou laisser le prochain push redéployer).

   Tant que ces variables ne sont pas définies, l'API répond 503 avec
   un message clair ; le site continue de fonctionner (voir
   js/cz-store.js et js/admin.js) en stockage local uniquement — rien
   n'est perdu, la commande attend juste que le stockage partagé soit
   activé, et se synchronisera automatiquement ensuite.
   ============================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzqpvtrgchtiffcyxzfy.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = 'orders';

function authHeaders(extra) {
  return Object.assign({
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
  }, extra || {});
}

/* Traduit une ligne Postgres (colonnes snake_case, à plat) vers la
   forme attendue par le configurateur et l'espace atelier (camelCase,
   la config imbriquée telle qu'envoyée à l'origine). */
function toOrder(row) {
  return {
    ref: row.ref,
    createdAt: row.created_at,
    status: row.status,
    adminNote: row.admin_note,
    config: row.config,
  };
}

function toRow(order) {
  return {
    ref: order.ref,
    created_at: order.createdAt || new Date().toISOString(),
    status: order.status || 'nouveau',
    admin_note: order.adminNote || '',
    config: order.config,
  };
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

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(503).json({
      error: 'storage_not_configured',
      message: 'Supabase non configuré — voir le commentaire en tête de api/orders.js.',
    });
    return;
  }

  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + TABLE;

  try {
    if (req.method === 'GET') {
      const r = await fetch(base + '?select=*&order=created_at.desc', { headers: authHeaders() });
      if (!r.ok) throw new Error('supabase_http_' + r.status);
      const rows = await r.json();
      res.status(200).json(rows.map(toOrder));
      return;
    }

    if (req.method === 'POST') {
      const order = readBody(req);
      if (!order || !order.ref || !order.config) {
        res.status(400).json({ error: 'invalid_order' });
        return;
      }
      /* Upsert sur la référence : un renvoi (nouvel essai après coupure
         réseau) met simplement à jour la même ligne au lieu d'échouer
         sur la contrainte de clé primaire. */
      const r = await fetch(base + '?on_conflict=ref', {
        method: 'POST',
        headers: authHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(toRow(order)),
      });
      if (!r.ok) throw new Error('supabase_http_' + r.status);
      const [saved] = await r.json();
      res.status(200).json(toOrder(saved));
      return;
    }

    if (req.method === 'PATCH') {
      const ref = readRef(req);
      if (!ref) { res.status(400).json({ error: 'missing_ref' }); return; }
      const patch = readBody(req);
      const row = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
      if (!Object.keys(row).length) { res.status(400).json({ error: 'empty_patch' }); return; }

      const r = await fetch(base + '?ref=eq.' + encodeURIComponent(ref), {
        method: 'PATCH',
        headers: authHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error('supabase_http_' + r.status);
      const rows = await r.json();
      if (!rows.length) { res.status(404).json({ error: 'not_found' }); return; }
      res.status(200).json(toOrder(rows[0]));
      return;
    }

    if (req.method === 'DELETE') {
      const ref = readRef(req);
      if (!ref) { res.status(400).json({ error: 'missing_ref' }); return; }
      const r = await fetch(base + '?ref=eq.' + encodeURIComponent(ref), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error('supabase_http_' + r.status);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: err.message });
  }
};
