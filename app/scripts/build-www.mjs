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
writeFileSync(join(www, 'index.html'), html);

const build = readFileSync(join(root, 'js/data.js'), 'utf8').match(/const BUILD = (\d+)/)[1];
console.log('www prêt, build ' + build);
