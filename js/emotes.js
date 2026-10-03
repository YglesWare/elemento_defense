// Élémento Defense : émoticônes en partie à plusieurs (duel et coop, en ligne ou à côté).
// Six messages tout faits, jamais de texte libre : on n'envoie que leur numéro, chaque téléphone écrit le message.
// Une toutes les 3 s au plus ; un parent peut les couper (js/parents.js).
'use strict';

const EMOTES = [['👍', 'Bien joué !'], ['🔥', 'Trop fort !'], ['😮', 'Oh non !'], ['🆘', 'À l’aide !'], ['😂', 'Haha !'], ['🤝', 'Merci !']];
const EMO = { last: 0, recv: new Map() };
const emoOn = () => !!G && !!(G.duel || G.coop) && !G.over && Net.role && parent().emotes;
$('#emoPanel').innerHTML = EMOTES.map(([e, l], i) => '<button type="button" class="emob" data-i="' + i + '"><span>' + e + '</span><small>' + T(l) + '</small></button>').join('');
$('#bEmo').addEventListener('click', () => { Snd.init(); $('#emoPanel').hidden = !$('#emoPanel').hidden; });
$('#emoPanel').addEventListener('click', ev => {
  const b = ev.target.closest('[data-i]'); if (!b || !emoOn()) return;
  $('#emoPanel').hidden = true;
  const now = performance.now(); if (now - EMO.last < 3000) { hint(T('Attends un peu avant la prochaine émoticône.'), 1400); return; }
  EMO.last = now;
  const i = +b.dataset.i; Net.send('all', { k: 'emo', i }); emoShow(T('Toi'), i);
});
function emoShow(name, i) {
  const [e, l] = EMOTES[i], feed = $('#emoFeed'), d = document.createElement('div');
  d.className = 'emobub'; d.innerHTML = '<span class="emoe">' + e + '</span><b>' + esc(name) + '</b> ' + T(l);
  feed.appendChild(d); while (feed.children.length > 3) feed.firstChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 3000);
}
Net.on('msg', ({ from, data }) => {
  if (!data || data.k !== 'emo' || !Number.isInteger(data.i) || !EMOTES[data.i] || !emoOn()) return;
  const now = performance.now(); if (now - (EMO.recv.get(from) || 0) < 2000) return; EMO.recv.set(from, now);
  const p = Net.players.find(x => x.id === from);
  emoShow(p ? p.name : T('Joueur'), data.i);
});
// Le bouton n'apparaît qu'en partie à plusieurs
setInterval(() => { const on = emoOn(); $('#bEmo').hidden = !on; if (!on) $('#emoPanel').hidden = true; }, 500);
