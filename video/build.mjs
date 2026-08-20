/* ============================================================
   ENMIIS — Montage du tutoriel.

   Prend la capture brute produite par record.mjs, coupe l'amorce
   (chargement et remise à zéro du navigateur, avant le parcours),
   encode en H.264, et sort deux fichiers :

     ENMIIS-tutoriel.mp4            image seule, prête pour la voix off
     ENMIIS-tutoriel-sous-titre.mp4 sous-titres incrustés

   Usage :  node video/build.mjs
   ============================================================ */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(HERE, 'raw');

/* ffmpeg n'est pas requis dans le projet : FFMPEG_BIN pointe une
   installation externe, sinon on tente le ffmpeg du système. */
const FF = process.env.FFMPEG_BIN || 'ffmpeg';

const run = (args) => execFileSync(FF, args, { stdio: ['ignore', 'pipe', 'pipe'] });

/* ffmpeg écrit les métadonnées sur stderr et sort en erreur quand on
   ne lui donne pas de sortie : c'est attendu, on lit le flux. */
function probeDuration(file) {
  let out = '';
  try { run(['-i', file]); }
  catch (err) { out = String(err.stderr || ''); }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error('durée illisible pour ' + path.basename(file));
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
}

function main() {
  const metaFile = path.join(RAW, 'meta.json');
  if (!fs.existsSync(metaFile)) {
    console.error('Aucune capture. Lancez d’abord : node video/record.mjs');
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const src = path.join(RAW, meta.source);

  /* Deux estimations de l'amorce à couper. Celle notée par le
     recorder démarre à la création de la page ; or l'encodeur ne
     commence à écrire qu'un peu après, si bien qu'elle coupe trop.
     La durée réelle du fichier est l'arbitre : le parcours s'arrête
     à la seconde 86, et la capture se ferme dans la foulée. */
  const total = probeDuration(src);
  const fromEnd = Math.max(0, total - meta.duration);
  const start = fromEnd.toFixed(3);
  const dur = String(meta.duration);

  console.log('  Capture : ' + total.toFixed(2) + 's');
  console.log('  Amorce  : ' + start + 's (recorder : ' + meta.offset + 's)');
  if (Math.abs(fromEnd - meta.offset) > 3) {
    console.warn('  ! Les deux estimations divergent de plus de 3 s — vérifiez la première image.');
  }

  const clean = path.join(HERE, 'ENMIIS-tutoriel.mp4');
  const subbed = path.join(HERE, 'ENMIIS-tutoriel-sous-titre.mp4');
  const srt = path.join(HERE, 'captions.srt');

  console.log('\n  Source : ' + meta.source);
  console.log('  Coupe  : ' + start + 's → ' + (Number(start) + meta.duration).toFixed(1) + 's');

  /* Version propre.

     -ss est placé APRÈS -i, volontairement. La capture Playwright est
     un webm à cadence variable, avec des images clés rares : en
     recherche rapide (-ss avant -i) ffmpeg atterrit plusieurs secondes
     à côté, et la vidéo se retrouve décalée par rapport aux
     sous-titres. La recherche précise décode depuis le début — plus
     lent, mais juste.

     -fps_mode cfr fige la cadence : sans ça, les longues pauses sans
     repeint de la page produisent des intervalles irréguliers que
     certains lecteurs interprètent mal. */
  /* Passe 1 — découpe seule, vers un intermédiaire à cadence fixe. */
  const base = path.join(RAW, 'base.mp4');
  run(['-y', '-i', src, '-ss', start, '-t', dur,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr', '-r', '25',
    '-vf', 'scale=1920:1080:flags=lanczos',
    '-an', base]);

  /* Passe 2 — les six dernières secondes sont recadrées sur l'écran de
     confirmation.

     Raison : panier.html porte un </div> surnuméraire qui referme
     #pnLayout avant la section « Vos coordonnées ». Après l'envoi, le
     formulaire reste donc affiché au-dessus de la confirmation, et la
     page est trop courte pour le faire sortir du champ au défilement.
     Le recadrage isole la référence — l'information à retenir — plutôt
     que de filmer un défaut. Le bug reste à corriger dans le site.

     Le trim doit s'appliquer ici, sur un fichier déjà découpé : dans la
     passe 1 il aurait travaillé sur la timeline d'origine, amorce
     comprise. */
  const ZOOM_AT = meta.duration - 6;
  const filtre =
    '[0:v]trim=0:' + ZOOM_AT + ',setpts=PTS-STARTPTS[a];' +
    '[0:v]trim=' + ZOOM_AT + ':' + meta.duration + ',setpts=PTS-STARTPTS,' +
      'crop=960:540:480:540,scale=1920:1080:flags=lanczos[b];' +
    '[a][b]concat=n=2:v=1[v]';

  run(['-y', '-i', base, '-filter_complex', filtre, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr', '-r', '25',
    '-movflags', '+faststart', '-an', clean]);
  console.log('  ✓ ' + path.basename(clean));

  /* Version sous-titrée. Le style reprend la charte : texte blanc,
     ombre portée, aucune boîte de fond qui masquerait l'interface. */
  /* libass rend dans le repère ASS par défaut (288 de haut), pas dans
     les 1080 de la vidéo : une taille 22 y donnerait des sous-titres
     démesurés, plantés au milieu de l'image. Les valeurs ci-dessous
     sont exprimées dans ce repère — 10 ≈ 37 px et une marge de 16 ≈
     60 px une fois ramenés à 1080. */
  const style = "FontName=Arial,FontSize=10,PrimaryColour=&H00FFFFFF," +
    "OutlineColour=&H00000000,BorderStyle=1,Outline=1,Shadow=0," +
    "Alignment=2,MarginV=16";
  const srtArg = srt.replace(/\\/g, '/').replace(/:/g, '\\:');
  run(['-y', '-i', clean,
    '-vf', "subtitles='" + srtArg + "':force_style='" + style + "'",
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', subbed]);
  console.log('  ✓ ' + path.basename(subbed));

  for (const f of [clean, subbed]) {
    const mb = (fs.statSync(f).size / 1048576).toFixed(1);
    console.log('    ' + path.basename(f) + ' — ' + mb + ' Mo');
  }
  console.log('\n  Référence dans la vidéo : ' + meta.ref);
  console.log('  Avertissement de synchro : ' + (meta.warned ? 'OUI' : 'non') + '\n');
}

main();
