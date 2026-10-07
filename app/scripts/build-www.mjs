// Copie le jeu (dossier parent) dans www/ pour l'APK, avec les polices en local pour jouer sans internet.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..'), root = join(app, '..'), www = join(app, 'www');
rmSync(www, { recursive: true, force: true }); mkdirSync(www);
for (const f of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons']) cpSync(join(root, f), join(www, f), { recursive: true });
cpSync(join(app, 'fonts'), join(www, 'fonts'), { recursive: true });

// Google Fonts → polices embarquées
let html = readFileSync(join(www, 'index.html'), 'utf8');
const before = html;
html = html.replace(/<link rel="preconnect"[^>]*fonts\.g[^>]*>\s*/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">');
if (html === before || html.includes('fonts.googleapis')) throw new Error('Lien Google Fonts introuvable dans index.html');
// « viewport-fit=cover » gardé : avec une WebView récente (140+), Capacitor laisse la page passer sous les barres du
// téléphone et donne leur hauteur (--safe-area-inset-*, css/style.css) ; avec une plus ancienne, les barres restent à part
// Version Google Play (npm run aab) : pas de mise à jour par les releases GitHub (le Play Store s'en charge, et il interdit
// qu'une appli se mette à jour toute seule)
const store = process.argv.includes('--store');
if (store) {
  const tag = '<script>window.STORE_BUILD = true;</script>';
  html = html.replace(/<script>store\.boot\(/, tag + '\n<script>store.boot(');
  if (!html.includes(tag)) throw new Error('Impossible de marquer la version store');
}
writeFileSync(join(www, 'index.html'), html);

const build = readFileSync(join(root, 'js/data.js'), 'utf8').match(/const BUILD = (\d+)/)[1];
console.log('www prêt, build ' + build + (store ? ' (version Google Play)' : ''));
