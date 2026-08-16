/* ============================================================
   ENMIIS — Comptes clients.

   Le client s'inscrit avec son téléphone et un mot de passe, puis
   retrouve son panier sur n'importe quel appareil. Rien de tout cela
   ne transite par le navigateur : la table `clients` est verrouillée
   côté Supabase et seule cette fonction, qui détient la clé
   service_role, peut la lire ou l'écrire.

   ------------------------------------------------------------
   À FAIRE UNE FOIS, dans Supabase → SQL Editor :

     create table if not exists clients (
       id            bigserial primary key,
       phone         text not null unique,
       name          text not null,
       address       text not null default '',
       origin        text not null default '',
       password_hash text not null,
       cart          jsonb,
       created_at    timestamptz not null default now()
     );
     alter table clients enable row level security;
     -- aucune policy : la clé publiable du site ne peut rien y lire.

   Puis dans Vercel → Settings → Environment Variables :
     SUPABASE_SERVICE_ROLE_KEY = <clé service_role, Supabase →
     Project Settings → API → service_role>
   ------------------------------------------------------------ */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kzqpvtrgchtiffcyxzfy.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = 'clients';

/* Le jeton de session est signé avec la clé service_role : elle ne
   quitte jamais le serveur, et il n'y a donc qu'une seule variable
   à poser dans Vercel. */
const SECRET = process.env.AUTH_SECRET || SERVICE_KEY || '';
const SESSION_DAYS = 30;

const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + TABLE;

const authHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
});

/* ---------- Téléphone ---------- */

/* Un même numéro peut s'écrire « 22 123 456 », « +216 22-12-34-56 »…
   On le ramène toujours à ses 8 chiffres pour que la connexion
   fonctionne quelle que soit la façon dont il a été tapé. */
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  const local = digits.replace(/^(?:00216|216)/, '');
  return /^[2-9]\d{7}$/.test(local) ? local : null;
}

/* ---------- Mot de passe ---------- */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + derived;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const derived = crypto.scryptSync(password, parts[1], 64);
  const expected = Buffer.from(parts[2], 'hex');
  /* Comparaison à temps constant : une comparaison ordinaire laisse
     deviner le mot de passe caractère par caractère. */
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

/* ---------- Jeton de session ---------- */

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return body + '.' + mac;
}

function verify(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

/* ---------- Accès à la table ---------- */

async function findByPhone(phone) {
  const res = await fetch(base + '?phone=eq.' + encodeURIComponent(phone) + '&select=*&limit=1', {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('lookup ' + res.status);
  const rows = await res.json();
  return rows[0] || null;
}

/* Ce que le navigateur a le droit de connaître : jamais le hash. */
const publicProfile = (row) => ({
  id: row.id,
  phone: row.phone,
  name: row.name,
  address: row.address || '',
  origin: row.origin || '',
});

/* ---------- Actions ---------- */

async function register(body) {
  const phone = normalizePhone(body.phone);
  const name = String(body.name || '').trim();
  const password = String(body.password || '');

  if (name.length < 3) return { code: 400, payload: { error: 'bad_name', message: 'Indiquez votre nom complet.' } };
  if (!phone) return { code: 400, payload: { error: 'bad_phone', message: 'Numéro tunisien attendu (8 chiffres).' } };
  if (password.length < 6) {
    return { code: 400, payload: { error: 'bad_password', message: 'Le mot de passe doit faire au moins 6 caractères.' } };
  }

  if (await findByPhone(phone)) {
    return {
      code: 409,
      payload: { error: 'phone_taken', message: 'Ce numéro a déjà un compte. Connectez-vous.' },
    };
  }

  const res = await fetch(base, {
    method: 'POST',
    headers: Object.assign(authHeaders(), { Prefer: 'return=representation' }),
    body: JSON.stringify({
      phone,
      name,
      address: String(body.address || '').trim(),
      origin: String(body.origin || '').trim(),
      password_hash: hashPassword(password),
    }),
  });
  if (!res.ok) throw new Error('insert ' + res.status + ' ' + (await res.text()));

  const row = (await res.json())[0];
  return { code: 201, payload: { token: issue(row), client: publicProfile(row) } };
}

async function login(body) {
  const phone = normalizePhone(body.phone);
  const password = String(body.password || '');
  const invalid = {
    code: 401,
    payload: { error: 'bad_credentials', message: 'Numéro ou mot de passe incorrect.' },
  };
  if (!phone || !password) return invalid;

  const row = await findByPhone(phone);
  /* Même réponse dans les deux cas : sinon on révèle quels numéros
     ont un compte. */
  if (!row || !verifyPassword(password, row.password_hash)) return invalid;

  return { code: 200, payload: { token: issue(row), client: publicProfile(row) } };
}

function issue(row) {
  return sign({
    id: row.id,
    phone: row.phone,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

async function session(body) {
  const claims = verify(body.token);
  if (!claims) return { code: 401, payload: { error: 'no_session' } };
  const row = await findByPhone(claims.phone);
  if (!row) return { code: 401, payload: { error: 'no_session' } };
  return { code: 200, payload: { client: publicProfile(row), cart: row.cart || null } };
}

/* Le panier suit le compte : c'est ce qui permet de le retrouver
   depuis un autre téléphone ou un ordinateur. */
async function saveCart(body) {
  const claims = verify(body.token);
  if (!claims) return { code: 401, payload: { error: 'no_session' } };

  const res = await fetch(base + '?phone=eq.' + encodeURIComponent(claims.phone), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ cart: body.cart || null }),
  });
  if (!res.ok) throw new Error('cart ' + res.status);
  return { code: 200, payload: { ok: true } };
}

/* Liste destinée à l'espace atelier — nom et téléphone des clients
   inscrits. Protégée par le même mot de passe que l'admin. */
async function listClients(body) {
  if (String(body.adminPassword || '') !== 'enmiis987') {
    return { code: 401, payload: { error: 'forbidden' } };
  }
  const res = await fetch(base + '?select=id,name,phone,address,origin,created_at&order=created_at.desc', {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('list ' + res.status);
  return { code: 200, payload: { clients: await res.json() } };
}

const ACTIONS = { register, login, session, cart: saveCart, clients: listClients };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!SERVICE_KEY) {
    res.status(503).json({
      error: 'auth_not_configured',
      message: 'Les comptes ne sont pas encore activés. Vous pouvez commander sans compte.',
      hint: 'Posez SUPABASE_SERVICE_ROLE_KEY dans Vercel et créez la table `clients` ' +
        '(voir l’en-tête de api/auth.js), puis redéployez.',
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
    console.error('[ENMIIS Comptes]', err && err.message ? err.message : err);
    res.status(502).json({ error: 'server_error', message: 'Service indisponible, réessayez.' });
  }
};
