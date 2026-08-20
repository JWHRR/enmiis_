/* ============================================================
   ENMIIS — Enregistrement du tutoriel client.

   Rejoue le parcours décrit dans STORYBOARD.md sur le vrai site et
   en sort une vidéo. Rien n'est simulé : ce sont les vraies pages,
   les vrais boutons, les vraies animations.

   Le site est servi en local (les appels réseau sont bloqués sur
   file://), et l'envoi de commande est intercepté : la vidéo montre
   l'écran de confirmation réel sans écrire dans la base de l'atelier.

   Usage :  node video/record.mjs
   Sortie :  video/raw/*.webm  →  converti ensuite en MP4
   ============================================================ */

/* Playwright peut vivre ailleurs que dans le projet — celui-ci n'a
   volontairement ni package.json ni node_modules. PW_MODULE permet de
   pointer une installation externe ; sinon, résolution normale. */
const { chromium } = await import(process.env.PW_MODULE || 'playwright');

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(HERE, 'raw');
const PORT = 8787;

const W = 1920;
const H = 1080;

/* ---------- Serveur statique ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* ---------- Curseur visible ----------
   Playwright ne dessine pas le pointeur dans la vidéo. On en injecte
   un qui suit les vrais événements souris, avec une onde au clic :
   sans lui, on ne verrait pas où l'action se produit. */

const CURSOR = () => {
  const draw = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;' +
      'pointer-events:none;margin:-13px 0 0 -13px;';
    c.innerHTML =
      '<svg viewBox="0 0 26 26" width="26" height="26">' +
      '<circle cx="13" cy="13" r="11" fill="rgba(200,168,107,.28)" stroke="#111" stroke-width="1.4"/>' +
      '<circle cx="13" cy="13" r="3" fill="#111"/></svg>';
    document.documentElement.appendChild(c);

    const style = document.createElement('style');
    style.textContent = '@keyframes __ping{from{transform:translate(-50%,-50%) scale(.4);opacity:.9}' +
      'to{transform:translate(-50%,-50%) scale(2.6);opacity:0}}';
    document.head.appendChild(style);

    /* Positionnement par translation, sans will-change : une couche de
       compositing dédiée au curseur suffit à figer les tuiles voisines
       et à laisser un fantôme de l'écran précédent dans la capture. */
    addEventListener('mousemove', (e) => {
      c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    }, true);

    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;' +
        'width:44px;height:44px;border-radius:50%;border:2px solid #C8A86B;z-index:2147483646;' +
        'pointer-events:none;animation:__ping .55s ease-out forwards;';
      document.documentElement.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', draw);
  else draw();
};

/* ---------- Gestes ---------- */

let mouse = { x: W / 2, y: H * 0.6 };

async function moveTo(page, sel, steps = 10) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) throw new Error('introuvable : ' + sel);
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
  return mouse;
}

async function click(page, sel) {
  await moveTo(page, sel);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
}

/* Le clic re-résout la position juste avant d'appuyer. Sans ça, une
   carte qui finit son animation d'apparition entre le survol et le
   clic décale la cible, et le clic tombe dans le vide. */
async function press(page, sel) {
  const box = await page.locator(sel).first().boundingBox();
  if (box) {
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    if (Math.abs(x - mouse.x) > 2 || Math.abs(y - mouse.y) > 2) {
      await page.mouse.move(x, y, { steps: 4 });
      mouse = { x, y };
    }
  }
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
}

/* Survol appuyé, puis clic à la marque voulue : le regard a le temps
   de se poser sur le bouton avant qu'il ne soit actionné. */
async function dwell(page, sel, moveAt, clickAt) {
  await at(page, moveAt);
  await moveTo(page, sel);
  await at(page, clickAt);
  await press(page, sel);
}

/* Attente « vivante ».

   Playwright n'ajoute une image à la vidéo que lorsque la page se
   repeint. Une page devenue inerte — l'écran de confirmation, une fois
   son animation terminée — n'en produit plus aucune, et la capture
   reste figée sur la dernière image peinte, c'est-à-dire l'état
   PRÉCÉDENT. D'où ce micro-mouvement du curseur pendant les pauses
   longues : il force un repeint, donc une image. */
async function holdAlive(page, untilSec) {
  let flip = 0;
  while (Date.now() < t0 + untilSec * 1000) {
    flip ^= 1;
    await page.mouse.move(mouse.x + flip, mouse.y, { steps: 1 });
    /* Bouger le curseur ne suffit pas : le compositeur resservirait sa
       dernière trame. Un défilement d'un pixel invalide les tuiles et
       garantit une image à jour. */
    await page.evaluate((d) => window.scrollBy(0, d), flip ? 1 : -1);
    await page.waitForTimeout(180);
  }
}

/* Après une navigation, aucun mousemove ne se produit : le curseur
   injecté resterait en haut à gauche. On le resynchronise. */
async function resync(page) {
  await page.mouse.move(mouse.x + 1, mouse.y + 1, { steps: 2 });
}

async function type(page, sel, value, delay = 90) {
  await moveTo(page, sel, 8);
  await page.locator(sel).first().click();
  await page.locator(sel).first().type(String(value), { delay });
}

/* ---------- Horloge absolue ----------
   Chaque scène doit tomber sur sa marque du storyboard, sinon les
   sous-titres décrochent. */

let t0 = 0;
const at = async (page, sec) => {
  const wait = t0 + sec * 1000 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  else if (wait < -700) console.warn('  ! retard de ' + (-wait / 1000).toFixed(1) + 's à ' + sec + 's');
};
const beat = (sec, name) => {
  const real = ((Date.now() - t0) / 1000).toFixed(1);
  const drift = (real - sec).toFixed(1);
  console.log('  ' + String(sec).padStart(5) + 's  réel ' + String(real).padStart(5) +
    's  (' + (drift >= 0 ? '+' : '') + drift + ')  ' + name);
};

/* ---------- Parcours ---------- */

async function run() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const server = await serve();
  /* --disable-partial-raster : sans lui, Chromium réutilise ses tuiles
     et laisse un fantôme du formulaire par-dessus la confirmation, dès
     que l'écriture de la commande bloque le fil principal. Le reste
     stabilise le rendu du texte d'une prise à l'autre. */
  const browser = await chromium.launch({
    args: [
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-partial-raster',
      '--disable-gpu-rasterization',
      '--disable-lcd-text',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  });

  /* L'envoi de commande est intercepté : l'écran de confirmation
     s'affiche comme en vrai (référence, coche, pas d'avertissement),
     mais aucune commande n'atteint la base de l'atelier. */
  await context.route('**/api/orders**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await context.route('**/*supabase.co/**', (r) => r.abort());
  await context.route('**/api/auth**', (r) => r.abort());

  await context.addInitScript(CURSOR);

  /* Le carrousel d'accueil bascule toutes les 6,5 s — pile au moment
     du clic, ce qui emportait le bouton hors de l'écran. On neutralise
     ce seul minuteur : la scène 1 reste sur « Votre Jour de Gloire »,
     comme le prévoit le storyboard. Rien d'autre n'est touché. */
  await context.addInitScript(() => {
    const orig = window.setInterval;
    window.setInterval = function (fn, ms, ...rest) {
      if (ms === 6500) return 0;
      return orig.call(this, fn, ms, ...rest);
    };
  });

  /* L'enregistrement démarre à la création de la page, donc avant le
     parcours : on note l'écart pour couper l'amorce au montage plutôt
     que de le deviner. */
  const recStart = Date.now();
  const page = await context.newPage();

  /* Diagnostic : une erreur JS dans la page se traduirait sinon par un
     simple « sélecteur introuvable », impossible à interpréter. */
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!/supabase\.co|api\/auth/.test(u)) problems.push('requête échouée: ' + u);
  });
  globalThis.__diag = { page, problems, out: OUT };

  /* Panier, favoris et compte vidés : les pastilles de l'en-tête
     doivent partir de zéro à la première image. */
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.evaluate(() => ['enmiis-cart-v1', 'enmiis-configurator-v3', 'enmiis-favorites-v1',
    'enmiis-account-v1'].forEach((k) => localStorage.removeItem(k)));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(900);

  t0 = Date.now();
  console.log('\n  Enregistrement…\n');

  /* === Scène 1 — Accueil · 0:00 → 0:08 === */
  beat(0, 'Accueil — « Votre Jour de Gloire »');
  await resync(page);
  await dwell(page, 'a.btn--hero[href="soutenance.html"]', 5.4, 6.8);
  await page.waitForURL('**/soutenance.html', { timeout: 10000 });
  await page.waitForSelector('#worksFilter button[data-filter="toges"]', { timeout: 10000 });
  await resync(page);

  /* === Scène 2 — Nos créations · 0:08 → 0:20 === */
  beat(8, 'Nos créations — galerie');
  await at(page, 9.6);
  await click(page, '#worksFilter button[data-filter="toges"]');
  beat(10, 'filtre « Toges »');
  await at(page, 14.2);
  await click(page, '.work-card:not(.is-hidden) .work-card__wishlist');
  beat(14, 'favori');
  await dwell(page, '.work-card:not(.is-hidden) a[href*="produit=robe&preset=1"]', 16.4, 18.6);
  beat(18, '« Choisir cette tenue »');
  await page.waitForURL('**/customizer.html*', { timeout: 10000 });
  await page.waitForSelector('#czDrop', { timeout: 10000 });
  await resync(page);

  /* === Scène 3 — Vos fichiers · 0:20 → 0:30 === */
  beat(20, 'Configurateur — Vos fichiers');
  await at(page, 23.5);
  await moveTo(page, '#czDrop');
  await at(page, 25.0);
  await page.setInputFiles('#czFileInput', path.join(ROOT, 'img', 'logo-enmiis.png'));
  beat(25, 'dépôt du logo');
  await at(page, 28.4);
  await click(page, '#czNext');
  beat(28, '« Continuer »');
  await page.waitForTimeout(500);

  /* === Scène 4 — La Robe · 0:30 → 0:44 ===
     L'aperçu est un visualiseur photo, pas un rendu pilotable : le
     bloc SVG rotatif est désactivé dans customizer.html. Ce qui bouge
     à chaque choix, ce sont la vignette du modèle retenu et les
     pastilles sous l'image. C'est cela qu'on filme. */
  beat(30, 'La Robe — manches / col / bordure');
  await at(page, 31.4);
  await click(page, '.cz-options >> nth=0 >> .cz-option >> nth=1');
  await at(page, 34.2);
  await click(page, '.cz-options >> nth=1 >> .cz-option >> nth=1');
  await at(page, 36.8);
  await click(page, '.cz-options >> nth=2 >> .cz-option >> nth=0');
  beat(36, 'choix appliqués');

  /* Retour sur la photo du modèle : le logo déposé à la scène 3
     occupe l'aperçu, et la robe doit être visible pour la suite. */
  await at(page, 39.2);
  await click(page, '[data-thumb-pick] >> nth=0');
  beat(39, 'retour sur la photo du modèle');
  await at(page, 41.3);
  await click(page, '#czZoomIn');
  await page.waitForTimeout(500);
  await at(page, 43.0);
  await click(page, '#czNext');
  await page.waitForTimeout(350);

  /* === Scène 5 — Vos Mesures · 0:44 → 0:56 === */
  beat(44, 'Vos Mesures');
  await at(page, 46.4);
  await click(page, '[data-guide="chest"]');
  beat(46, 'guide illustré');
  await at(page, 49.6);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  /* Deux mesures saisies en direct, les six autres posées d'un coup :
     filmer huit saisies mangerait un tiers de la vidéo. */
  await at(page, 50.3);
  await type(page, '[data-measure-input="height"]', '168', 110);
  await at(page, 52.2);
  await type(page, '[data-measure-input="chest"]', '92', 110);
  await at(page, 53.6);
  const rest = { weight: 62, waist: 74, hip: 98, shoulder: 40, sleeve: 58, gown: 132 };
  for (const [id, v] of Object.entries(rest)) {
    await page.locator(`[data-measure-input="${id}"]`).fill(String(v));
    await page.locator(`[data-measure-input="${id}"]`).dispatchEvent('input');
    await page.locator(`[data-measure-input="${id}"]`).dispatchEvent('change');
    await page.waitForTimeout(60);
  }
  beat(53, 'mesures complétées');
  await at(page, 55.4);
  await click(page, '#czNext');
  await page.waitForTimeout(400);

  /* === Scène 6 — Récapitulatif · 0:56 → 1:06 === */
  beat(56, 'Récapitulatif');
  await at(page, 57.6);
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 130); await page.waitForTimeout(150); }
  await at(page, 61.4);
  await click(page, '#czAddToCart');
  beat(61, '« Ajouter la robe au panier »');
  await page.waitForTimeout(1400);
  await at(page, 64.6);
  await click(page, '.cz-added__actions a[href="panier.html"]');
  await page.waitForURL('**/panier.html', { timeout: 10000 });
  await page.waitForSelector('#pnLayout:not([hidden])', { timeout: 10000 });
  await resync(page);

  /* === Scène 7 — Panier · 1:06 → 1:18 === */
  beat(66, 'Panier');
  const soon = new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 10);
  await at(page, 68.0);
  await moveTo(page, '.pn-item__foot');
  await at(page, 69.6);
  await moveTo(page, '#pnAccount');
  beat(69, 'bandeau « Gardez votre panier »');
  await at(page, 71.0);
  await type(page, '#pn_name', 'DEMO VIDEO', 75);
  await at(page, 73.4);
  await type(page, '#pn_whatsapp', '22123456', 70);
  await at(page, 75.4);
  await moveTo(page, '#pn_region', 18);
  await page.selectOption('#pn_region', 'Tunis');
  await page.waitForTimeout(320);
  await page.locator('#pn_date').fill(soon);
  await page.locator('#pn_date').dispatchEvent('change');
  beat(75, 'coordonnées');
  await page.waitForTimeout(300);

  /* === Scène 8 — Commande envoyée · 1:18 → 1:26 === */
  await at(page, 77.8);
  await click(page, '#pnSubmit');
  beat(78, '« Envoyer ma commande »');
  await page.waitForSelector('#pnDone:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() =>
    document.getElementById('pnLayout').hasAttribute('hidden'), null, { timeout: 20000 });
  /* L'écriture de la commande (2 Mo d'images en base64) bloque le fil
     principal juste au moment où le formulaire disparaît. Chromium
     sans interface garde alors ses anciennes tuiles : le formulaire
     reste peint à l'écran alors que le DOM l'a retiré, et la capture
     comme les copies d'écran héritent de ce fantôme. Une bascule de
     transformation sur <body> invalide les couches et force un rendu
     neuf. Cela ne touche que l'enregistrement, jamais le site. */
  /* panier.html porte un </div> surnuméraire (ligne 82) qui referme
     #pnLayout avant la section « Vos coordonnées ». Masquer #pnLayout
     après l'envoi ne masque donc pas le formulaire : il reste affiché
     au-dessus de la confirmation. Bug du site, signalé mais non
     corrigé ici. On cadre sur la confirmation, qui suit le formulaire
     dans le document : le défilement suffit à le sortir du champ. */
  await moveTo(page, '#pnDoneRef', 14);

  /* Le cadrage vient APRÈS le survol : scrollIntoViewIfNeeded aurait
     sinon remis le formulaire dans le champ. */
  /* Cadrage de la référence.

     .pn-checkout est en position:sticky (panier.css, au-delà de
     1024 px). Avec le </div> surnuméraire qui le sort de #pnLayout, le
     formulaire reste épinglé en haut de la fenêtre APRÈS l'envoi et
     recouvre le haut de la confirmation. Défiler jusqu'en bas ne
     règle rien : cela fait au contraire remonter la référence derrière
     le formulaire. Il faut la poser dans la bande libre, sous la zone
     collante (qui s'arrête vers 744 px). */
  const cible = await page.evaluate(() => {
    const ref = document.getElementById('pnDoneRef');
    const y = ref.getBoundingClientRect().top + window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.min(max, Math.max(0, y - 820));
  });
  const depart = Math.max(0, cible - 300);
  for (let i = 0; i <= 12; i++) {
    const y = Math.round(depart + ((cible - depart) * i) / 12);
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(300);
  beat(80, 'confirmation cadrée');
  const warned = await page.locator('#pnDoneOffline').isVisible().catch(() => false);
  const ref = await page.locator('#pnDoneRef').textContent().catch(() => '');

  /* Témoin : ce que la page affiche vraiment pendant la tenue finale.
     Sert à distinguer un problème de rendu d'un problème de capture. */
  await at(page, 82.0);
  await page.screenshot({ path: path.join(OUT, 'temoin-82s.png') });
  console.log('  DOM à 82s : ' + JSON.stringify(await page.evaluate(() => {
    const info = (id) => {
      const nodes = document.querySelectorAll('#' + id);
      const el = nodes[0];
      const r = el.getBoundingClientRect();
      return {
        n: nodes.length,
        hidden: el.hasAttribute('hidden'),
        display: getComputedStyle(el).display,
        h: Math.round(r.height),
        top: Math.round(r.top),
      };
    };
    return {
      layout: info('pnLayout'),
      done: info('pnDone'),
      bouton: document.getElementById('pnSubmit').textContent.trim(),
      scrollY: Math.round(window.scrollY),
    };
  })));

  /* La référence doit rester lisible plusieurs secondes : c'est
     l'information à retenir de toute la vidéo. */
  await holdAlive(page, 86.0);

  console.log('\n  Référence affichée : ' + (ref || '—'));
  console.log('  Avertissement de synchronisation : ' + (warned ? 'OUI — prise à refaire' : 'non'));

  await context.close();
  await browser.close();
  server.close();

  const file = fs.readdirSync(OUT).find((f) => f.endsWith('.webm'));
  const meta = {
    source: file,
    offset: +((t0 - recStart) / 1000).toFixed(3),
    duration: 86,
    ref,
    warned,
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log('  Brut   : ' + path.join('video', 'raw', file));
  console.log('  Amorce : ' + meta.offset + 's à couper');
  console.log('  Durée  : 86 s\n');
  if (warned) process.exitCode = 1;
}

run().catch((err) => { console.error('\nÉchec :', err.message); process.exit(1); });
