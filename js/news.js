// Élémento Defense : « Quoi de neuf ? » après une mise à jour.
// Une fois par appareil, sur l'accueil : les nouveautés des versions installées depuis la dernière ouverture,
// écrites pour les joueurs (pas pour les développeurs). À chaque version publiée, ajouter ses lignes dans NEWS.
'use strict';

const NEWS_KEY = 'elemento.lastBuild';
// Version → nouveautés : [icône, texte]. Les plus récentes en premier.
const NEWS = {
  55: [
    ['♾️', 'Maîtrises, Longue-vue et Remparts n’ont plus de limite : au-delà du maximum, ils continuent de progresser, plus doucement. Le mode Infini devient l’endroit idéal pour gagner des éclats.'],
    ['🌬️', 'Souffler sur le téléphone chasse bien le brouillard, et une jauge 🎤 montre que le micro t’entend.'],
    ['💾', 'La partie est sauvegardée au début de chaque vague : après un plantage, tu reprends avec les tours posées pendant la pause.'],
    ['🔇', 'La musique se coupe quand le jeu passe en arrière-plan.'],
  ],
  54: [
    ['📶', 'En ligne, si le réseau coupe quelques secondes en pleine partie, tu rejoins la partie tout seul au lieu de la perdre.'],
  ],
  53: [
    ['🎩', 'La garde-robe d’Yglou : chapeaux, couleurs de crête et aura dorée, à acheter avec l’or de ta cagnotte. Tes amis voient ton Yglou déguisé !'],
    ['👓', 'Confort de jeu : texte plus grand, couleurs pour daltoniens, vibrations et secousses réglables (dans le Profil).'],
  ],
  52: [
    ['🎯', 'Trois défis chaque jour, à retrouver sur l’accueil : ils remplissent ta cagnotte d’or, et un coffre bonus t’attend si tu les réussis tous.'],
    ['🏆', 'Carte du jour : compare ton score avec celui de tes amis grâce au classement du jour.'],
    ['🛠️', 'Le jeu nous signale tout seul ses petits bugs, pour qu’on les corrige plus vite.'],
  ],
  51: [
    ['✨', 'Yglou s’invite sur les boutons Amis et Émoticônes.'],
    ['🆕', 'Cette fenêtre ! Après chaque mise à jour, Yglou te montre ce qui a changé.'],
  ],
  50: [
    ['👥', 'Ajoute tes amis avec leur code ami (YGL-…) ou leur QR code, depuis le bouton Amis de l’accueil.'],
    ['🌍', 'Joue en ligne avec tes amis, même s’ils sont loin : ouvre un salon et invite-les.'],
    ['😀', 'Envoie des émoticônes à tes adversaires et coéquipiers pendant les parties à plusieurs.'],
    ['👪', 'Un espace parents, protégé par un code, pour régler le jeu en ligne, les amis et le temps de jeu.'],
  ],
  49: [
    ['☁️', 'Ta progression est sauvegardée en ligne toute seule.'],
    ['🔭', 'Les tours voient un peu moins loin… mais la Longue-vue, nouvelle amélioration de l’Atelier, leur rend leur portée !'],
    ['📱', 'L’écran ne tourne plus quand tu penches le téléphone.'],
  ],
};
const NEWS_MAX = 3; // au plus les 3 dernières versions, pour rester lisible

function newsHTML(from) {
  const vs = Object.keys(NEWS).map(Number).filter(v => v > from && v <= BUILD).sort((a, b) => b - a).slice(0, NEWS_MAX);
  return vs.map(v => '<div class="newsv"><span class="mp-label">' + T('Version ') + '1.0.' + v + '</span><ul>'
    + NEWS[v].map(([ic, txt]) => '<li><span class="newsic">' + ic + '</span><span>' + T(txt) + '</span></li>').join('') + '</ul></div>').join('');
}
function showNews(from) {
  const h = newsHTML(from); if (!h) return false;
  $('#newsList').innerHTML = h; $('#newsPop').hidden = false;
  drawYglou(prepMini($('#newsYg'), 72, 72), 36, 44, 60, 'party', 0.3, { noShadow: true, noConfetti: true });
  return true;
}
$('#newsOk').addEventListener('click', () => { $('#newsPop').hidden = true; });
// Depuis le Profil : relire les nouveautés des dernières versions
$('#prNews').addEventListener('click', () => showNews(0));

// Au démarrage : nouvelle version depuis la dernière ouverture ? (un nouveau joueur n'a rien à découvrir)
(function newsCheck() {
  const last = store.get(NEWS_KEY);
  const from = last != null ? +last : stats.games > 0 ? BUILD - 1 : BUILD;
  if (from >= BUILD) { if (last !== BUILD) store.set(NEWS_KEY, BUILD); return; }
  // Sur l'accueil seulement, et jamais par-dessus une autre fenêtre (choix de sauvegarde, invitation…)
  const tryShow = () => {
    const busy = [...document.querySelectorAll('.intro')].some(e => !e.hidden);
    if (curScreen !== 'title' || busy) { setTimeout(tryShow, 2000); return; }
    showNews(from); store.set(NEWS_KEY, BUILD);
  };
  setTimeout(tryShow, 1500);
})();
