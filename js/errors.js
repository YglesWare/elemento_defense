// Élémento Defense : remontée d'erreurs (voir supabase/errors.sql).
// Chargé en premier : chaque erreur du jeu est notée sur l'appareil (version, écran, message technique, rien de personnel),
// puis envoyée à la synchro suivante (js/cloud.js). La même erreur n'est envoyée qu'une fois par version.
'use strict';

const ERR_KEY = 'elemento.errq', ERR_SENT = 'elemento.errSent', ERR_MAX = 30;
const ERRS = { session: new Map() };
function errNote(msg, src, line, stack) {
  try {
    if (window.parent !== window && window.parent.BALANCE) return;
    msg = String(msg || 'Erreur').slice(0, 500); src = String(src || '').replace(/^.*\//, '').replace(/\?.*$/, '').slice(0, 200);
    const sig = msg + '|' + src + '|' + (line | 0), seen = ERRS.session.get(sig);
    if (seen) { seen.n++; return; }
    const sent = store.get(ERR_SENT) || {};
    if (sent.b === (typeof BUILD !== 'undefined' ? BUILD : 0) && (sent.s || []).includes(sig)) return;
    const e = { id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2), build: typeof BUILD !== 'undefined' ? BUILD : 0,
      app: window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? 'apk' : 'web',
      screen: String(typeof curScreen !== 'undefined' ? curScreen : 'boot').slice(0, 20), msg, src, line: line | 0, stack: String(stack || '').slice(0, 2000), n: 1, at: Date.now(), sig };
    ERRS.session.set(sig, e);
    const q = store.get(ERR_KEY) || []; q.push(e); while (q.length > ERR_MAX) q.shift(); store.set(ERR_KEY, q);
  } catch (e2) { /* ne jamais planter en notant une erreur */ }
}
addEventListener('error', ev => { if (ev.message) errNote(ev.message, ev.filename, ev.lineno, ev.error && ev.error.stack); });
addEventListener('unhandledrejection', ev => { const r = ev.reason; errNote((r && r.message) || String(r), '', 0, r && r.stack); });

// Envoi (appelé par cloudSync) : ajout simple, un doublon (déjà envoyé) compte comme envoyé
async function cloudPushErrors() {
  const q = store.get(ERR_KEY) || []; if (!q.length) return;
  for (const e of q) { const s = ERRS.session.get(e.sig); if (s) e.n = s.n; }
  const row = ({ sig, ...r }) => r, ok = [];
  const { error } = await CLOUD.sb.from('client_errors').insert(q.map(row));
  if (!error) ok.push(...q);
  else if (error.code === '23505') for (const e of q) { const r = await CLOUD.sb.from('client_errors').insert([row(e)]); if (!r.error || r.error.code === '23505') ok.push(e); }
  if (!ok.length) return;
  const sent = store.get(ERR_SENT) || {}, b = typeof BUILD !== 'undefined' ? BUILD : 0, sigs = sent.b === b ? sent.s || [] : [];
  for (const e of ok) if (e.build === b && !sigs.includes(e.sig)) sigs.push(e.sig);
  store.set(ERR_SENT, { b, s: sigs.slice(-200) });
  const ids = new Set(ok.map(e => e.id)); store.set(ERR_KEY, (store.get(ERR_KEY) || []).filter(e => !ids.has(e.id)));
}
