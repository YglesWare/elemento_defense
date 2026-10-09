// Élémento Defense : une blague pour un ami testeur. Qui en profite est décidé dans Supabase (champ 'blague' = 'SRE',
// supabase/tags.sql) : aucune adresse dans le code, qui est public. Sa première connexion avec Google ouvre une fenêtre
// rien que pour lui, et sa « version simplifiée » est vraie : ennemis 15 % moins solides en solo, jusqu'à ce qu'il
// repasse en normal dans Réglages.
'use strict';

const SURPRISE_KEY = 'elemento.surprise', BLAGUE_KEY = 'elemento.blague', EASY_SRE_KEY = 'elemento.easySRE';
// Version simplifiée en cours (solo seulement : le multijoueur reste équitable)
const sreEasy = () => store.get(BLAGUE_KEY) === 'SRE' && store.get(EASY_SRE_KEY) !== false;
let surpriseFor = null; // compte déjà vérifié pendant cette session
async function surpriseCheck() {
  const u = typeof CLOUD !== 'undefined' && CLOUD.user;
  if (!u || !u.email || !CLOUD.sb || surpriseFor === u.id) return;
  surpriseFor = u.id;
  try {
    const { data, error } = await CLOUD.sb.rpc('my_tags');
    if (error) { surpriseFor = null; return; }
    const b = (data && data.blague) || null;
    if (b) store.set(BLAGUE_KEY, b); else store.del(BLAGUE_KEY);
    if (b !== 'SRE' || store.get(SURPRISE_KEY)) return;
    surpriseWait();
  } catch (e) { surpriseFor = null; /* hors ligne : on retentera */ }
}
// La fenêtre ne s'ouvre que sur l'accueil, sans autre fenêtre par-dessus
function surpriseWait() {
  if (store.get(SURPRISE_KEY)) return;
  if (curScreen !== 'title' || document.querySelector('.intro:not([hidden])')) { setTimeout(surpriseWait, 1500); return; }
  store.set(SURPRISE_KEY, true);
  surpriseShow('ask');
}
// mode : 'ask' (la question), 'liar' (« Tu me prends pour qui ? »), 'knew' (« Non, je suis faible »)
function surpriseShow(mode) {
  const ask = mode === 'ask';
  $('#spTitle').textContent = ask ? 'Bienvenue, mon SRE préféré' : mode === 'liar' ? 'Menteur !!!' : 'Je le savais !';
  $('#spText').textContent = ask ? 'Te sachant limité, je t’ai concocté une version simplifiée du jeu. Veux-tu revenir au mode normal et faire tes preuves, ou pas ?' : '';
  $('#spText').hidden = !ask;
  $('#spWeak').textContent = ask ? 'Non, je suis faible' : mode === 'liar' ? 'Ok je suis faible' : 'Ok';
  $('#spProve').hidden = !ask;
  drawYglou(prepMini($('#spYg'), 72, 72), 36, 42, 62, ask ? 'wink' : mode === 'liar' ? 'shock' : 'party', 0, { noShadow: true, noConfetti: true });
  $('#surprisePop').dataset.mode = mode;
  $('#surprisePop').hidden = false;
}
$('#spWeak').addEventListener('click', () => {
  Snd.init(); store.set(EASY_SRE_KEY, true);
  if ($('#surprisePop').dataset.mode === 'ask') { Snd.play('win'); surpriseShow('knew'); return; }
  $('#surprisePop').hidden = true;
});
$('#spProve').addEventListener('click', () => { Snd.init(); Snd.play('no'); surpriseShow('liar'); });

// Réglages : l'interrupteur de la version simplifiée, seulement pour lui
function sreRender() {
  const box = $('#setSRE'); if (!box) return;
  box.hidden = store.get(BLAGUE_KEY) !== 'SRE';
  if (box.hidden) return;
  const on = sreEasy();
  $('#setSREList').innerHTML = '<div class="paset"><div><b>Version simplifiée</b><small>Pour mon SRE préféré : ennemis 15 % moins solides en solo. Coupe-la pour faire tes preuves.</small></div><button class="patog' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + on + '" id="setSRETog"></button></div>';
  $('#setSRETog').addEventListener('click', () => { store.set(EASY_SRE_KEY, !sreEasy()); sreRender(); });
}
