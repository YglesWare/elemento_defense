// Élémento Defense : « Quoi de neuf ? » après une mise à jour.
// Une fois par appareil, sur l'accueil : les nouveautés des versions installées depuis la dernière ouverture,
// écrites pour les joueurs (pas pour les développeurs). À chaque version publiée, ajouter ses lignes dans NEWS.
'use strict';

const NEWS_KEY = 'elemento.lastBuild';
// Version → nouveautés : [icône, texte]. Les plus récentes en premier.
const NEWS = {
  103: [
    ['🤝', 'Multijoueur en paysage : les boutons à gauche, la liste des parties à droite, et le salon sur deux colonnes.'],
    ['🔎', 'Paysage : menus et fenêtres un peu plus petits, et les titres ne sont plus coupés.'],
  ],
  102: [
    ['👆', 'Première partie : un coup de pouce montre comment poser sa première tour, l’améliorer et lancer la vague.'],
    ['📅', 'La carte du jour s’ouvre une fois Prairie Mochi réussie.'],
    ['🪟', 'Paysage : la fiche des tours, les défis du jour, les piments, le code ami et la fin de partie tiennent dans l’écran.'],
  ],
  101: [
    ['🗺️', 'Histoire en paysage : la carte se couche et prend toute la place, le chemin va de gauche à droite, et l’équipe passe à côté.'],
  ],
  100: [
    ['🧭', 'Paysage : la carte de l’histoire garde sa forme, le code parent tient dans l’écran, et les interrupteurs des Réglages sont bien centrés.'],
  ],
  99: [
    ['🎯', 'Paysage : le jeu est centré sur l’écran, même sur les téléphones avec un appareil photo dans l’écran.'],
  ],
  98: [
    ['📱', 'Appli : le jeu se joue aussi en paysage. Tourne ton téléphone : le plateau, les menus et les fenêtres s’adaptent. Dans Réglages, choisis Auto, Portrait ou Paysage.'],
    ['⚙️', 'Profil plus court : la langue, le son, l’écran et le confort sont regroupés dans une nouvelle page Réglages.'],
    ['🗺️', 'Plateau plus grand, sans ombre dessous, et un panneau des tours plus compact.'],
  ],
  97: [
    ['🎬', 'Appli : les vidéos à récompense passent par Google AdMob, réglé pour les enfants (pubs tous publics, sans ciblage). Elles restent facultatives, et l’espace parents peut les couper.'],
    ['⏳', 'Nouveau dans l’Atelier : le Sablier. La Cadence a maintenant un plafond, comme les Dégâts et la Portée, et chaque Sablier le relève.'],
    ['💰', 'Sol, Vol et Boss commencent à 100 or (500 pour une mutation), et les cartes coûtent un peu plus cher.'],
    ['🎩', 'Garde-robe : une vidéo peut t’offrir −20 % sur un habit d’Yglou, pour la journée.'],
  ],
  96: [
    ['🌱', 'Début plus doux : en Facile, les premières cartes ont des slimes plus fragiles. Le vrai défi commence ensuite !'],
  ],
  95: [
    ['🛠️', 'Profil : les administrateurs voient si les fonctions en bêta sont actives sur leur appareil.'],
    ['❤️', 'K.O. : une vidéo peut t’offrir 5 vies une fois par partie, même après la Seconde chance de l’Atelier.'],
  ],
  94: [
    ['🔑', 'Connexion Google plus solide : si elle se perd (après une mise à jour par exemple), l’appli se reconnecte toute seule au même compte, sans créer de compte invité à la place.'],
  ],
  93: [
    ['🐷', 'Début de partie plus léger : plus de grand texte sur la cagnotte. Touche ton or pour un petit rappel.'],
  ],
  92: [
    ['📱', 'Plein écran : le décor va aussi sous l’appareil photo du téléphone, sans bande unie en haut.'],
  ],
  91: [
    ['✏️', 'Profil : touche le crayon sur Yglou (ou Yglou lui-même) pour ouvrir sa garde-robe.'],
    ['📱', 'Appli en plein écran, comme un vrai jeu : l’heure et les boutons du téléphone se cachent, et le décor va jusqu’au bord de l’écran. Balaie depuis le bord pour les revoir un instant.'],
  ],
  90: [
    ['📶', 'À côté : le même écran que l’onglet En ligne, avec les parties du Wi-Fi et un bouton pour scanner un QR code.'],
  ],
  89: [
    ['📶', 'À côté : les parties sur le même Wi-Fi s’affichent tout de suite, avec leur état (joignable, en cours). La caméra ne sert plus qu’à scanner un QR code.'],
    ['🌍', 'En ligne : un écran plus clair quand aucun ami ne joue, avec ton pseudo et tes amis en ligne en un coup d’œil.'],
  ],
  88: [
    ['🌍', 'En ligne : la liste des parties de tes amis, avec leur état (joignable, en cours, complète). Touche « Rejoindre » : ton ami accepte, et tu entres dans son salon.'],
  ],
  87: [
    ['📋', 'Écran d’une carte plus léger : chaque difficulté tient sur une ligne avec l’essentiel (vagues, vies, force des ennemis, chrono), et le détail s’ouvre avec le bouton « i ».'],
    ['↩️', 'Depuis la carte du jour, « Retour » ramène bien à l’écran des cartes.'],
    ['📱', 'En revenant dans l’appli, l’écran s’affiche tout de suite, sans devoir le toucher.'],
  ],
  86: [
    ['🗺️', 'Écran des cartes plus clair : les défis (carte du jour, piment de la semaine, carte aléatoire) dans un bandeau en haut, et une ligne par carte. Touche une carte pour voir ses piments, sa médaille et le classement de tes amis.'],
    ['✨', 'Piments : 6 règles spéciales (Chantier limité, Pas de remboursement, Ciel capricieux, Brouillard permanent, Fantômes, Portails fous), le Monochrome et un bouton 🎲 Surprise.'],
    ['🏅', 'Médailles de piment : bronze, argent ou or sur chaque carte, selon le piment de ta meilleure victoire.'],
    ['🌶', 'Nouveau : le piment de la semaine, la même carte et le même piment pour tous, avec son classement entre amis. La carte du jour a aussi son petit piment.'],
    ['🎉', 'Cartes d’événement : un piment spécial pour chaque fête (Nuit des spectres, Hotte pleine…), et 7 nouveaux trophées de piments.'],
  ],
  85: [
    ['⬆️', 'Version Google Play : quand une nouvelle version sort, le bouton « ⬆ Mise à jour » apparaît sur l’accueil et l’installe sans quitter le jeu.'],
  ],
  84: [
    ['🔀', 'Améliorer une tour : une seule ligne « Pour fusionner » montre ce qu’il manque (Dégâts, Portée, Cadence), au lieu des pastilles qui ressemblaient aux niveaux.'],
  ],
  83: [
    ['🔑', 'Connexion Google plus simple et en une seule étape : sur Android, un petit panneau Google s’ouvre directement dans le jeu ; sur le site, c’est le bouton officiel de Google.'],
  ],
  82: [
    ['📱', 'Élémento Defense arrive bientôt sur Google Play ! Sur Android, le jeu téléchargé depuis le site s’appelle maintenant « Élémento Dev » (icône orange) : connecte-toi avec Google pour y retrouver ta progression.'],
  ],
  81: [
    ['⚗️', 'Atelier : chaque fusion a maintenant sa propre Maîtrise et sa propre Longue-vue, qui s’ajoutent à celles de ses deux éléments.'],
    ['🗺️', 'Histoire : sur la carte, ta troupe avance sur le chemin. Braise en tête, Yglou et tes copains derrière, et chaque nouveau copain rejoint l’équipe.'],
    ['🛠️', 'Nouvelles améliorations : touche une tour, puis « Améliorer ». Six achats sans fin : Dégâts, Portée, Cadence, Sol, Vol et Boss. Zéphyr ne vise plus que les volants (l’achat « Sol » lui apprend le sol), et une fusion demande le niveau 5 en Dégâts, Portée et Cadence.'],
    ['📈', 'Atelier : les Maîtrises, Longues-vues et Remparts affichent simplement leur niveau (« Niv. 12 »), car ils n’ont pas de limite.'],
  ],
  80: [
    ['🌶', 'Écran des cartes : les piments se règlent avec le bouton 🌶 à côté de « Jouer », qui affiche leur multiplicateur quand ils sont actifs. L’aperçu de la carte n’est plus caché.'],
  ],
  79: [
    ['👥', 'Compte : en te connectant avec Google, tes amis et ton code ami te suivent, et le jeu te demande quelle sauvegarde garder quand le téléphone et le compte en ont chacun une.'],
  ],
  78: [
    ['👪', 'Espace parents : un nouveau réglage « Vidéos à récompense ». Sans code parent, de courtes pubs facultatives pourront bientôt offrir de l’or ou des éclats ; avec un code parent, elles sont coupées tant que le parent ne les autorise pas.'],
  ],
  77: [
    ['🗑️', 'Profil : un bouton « Supprimer mon compte » (un parent confirme), et l’encart de connexion se place sous le pseudo tant qu’on n’est pas connecté.'],
  ],
  76: [
    ['☁️', 'Profil : l’encart du compte en ligne est plus compact, et un petit bouton Google suffit pour se connecter.'],
  ],
  75: [
    ['🔑', 'La connexion avec Google fonctionne aussi quand ce compte Google a déjà servi ailleurs (autre téléphone, site) : le jeu s’y connecte directement.'],
  ],
  72: [
    ['🏷️', 'Les petites pastilles sur les boutons des tours affichent maintenant un % : c’est le bonus du terrain, du biome et de la météo, pas un prix.'],
    ['🔢', 'Les chiffres des titres et des boutons sont plus lisibles : le 7 ne ressemble plus au 1 (un prix de 70 se lisait 10).'],
  ],
  71: [
    ['⚙️', 'Nouveau : les piments 🌶 ! Sur une carte déjà gagnée, touche l’engrenage pour ajouter des malus (plus de points) ou des bonus (moins de points).'],
    ['🏆', 'Un classement entre amis pour chaque carte et chaque difficulté. Touche « Relever » pour tenter le piment d’un ami !'],
    ['🎭', 'Histoire : les personnages montrent leurs émotions dans les cases de BD (joie, colère, tristesse, surprise, peur).'],
    ['🧭', 'Histoire : on voit tout de suite d’où viennent les slimes, il faut poser le nouveau gardien avant la vague, et ce qui n’a pas encore été présenté reste verrouillé.'],
    ['⭐', 'Améliorer une tour se voit enfin : socle de couleur selon le niveau, tour qui grandit, rayon de lumière, et une couronne au niveau maximum.'],
  ],
  70: [
    ['⚡', 'Le jeu reste plus fluide quand il y a beaucoup d’ennemis à l’écran (pratique pour les longues parties en Infini).'],
  ],
  69: [
    ['🎯', 'Choisis qui chaque tour vise : le premier, le dernier, le plus faible, le plus fort, le plus proche ou les boss. Touche « Cible » dans la fiche de la tour.'],
    ['🐲', 'Infini : un ennemi qui atteint la maison ne disparaît plus, il refait le tour jusqu’à être abattu… et coûte des vies à chaque passage ! En Difficile, c’est le cas des boss.'],
  ],
  68: [
    ['🐛', 'Histoire : quitter un chapitre en cours ne transforme plus la partie suivante en chapitre de l’histoire.'],
  ],
  67: [
    ['🎻', 'Fini le son 8 bits : la musique est jouée avec de vrais instruments (piano, guitare, harpe, flûte, violon, cor…), plus grave et beaucoup plus douce pour les oreilles.'],
    ['🗺️', 'Chaque carte a sa musique : bossa-nova à la plage, grenouilles au marais, cor des Alpes au Pic, trot de cheval au canyon, tambours au volcan…'],
    ['🎃', 'Les fêtes ont leur air : la Toccata de Bach pour Halloween, Jingle Bells à Noël, le Canon de Pachelbel à la Saint-Valentin, Le Printemps de Vivaldi à Pâques.'],
  ],
  66: [
    ['🏠', 'Accueil : les boutons Histoire et Jouer sont moins hauts.'],
  ],
  65: [
    ['🎵', 'Nouvelle musique : chaque biome et chaque événement a la sienne, composée en direct, jamais deux fois pareille, avec des pauses où l’on n’entend que les vagues, le vent ou les oiseaux.'],
    ['🌫️', 'Histoire : chez Papi Yglou, le brouillard tombe et il vous explique comment la météo change la force des tours.'],
  ],
  64: [
    ['📊', 'Le bouton « Retour » de la page Stats fonctionne de nouveau.'],
  ],
  63: [
    ['💬', 'Les dialogues de l’histoire deviennent une vraie BD en plein écran : des cases, des bulles et des CRONCH !'],
    ['👑', 'Sur la carte de l’histoire, le nom du Roi Gloop n’est plus coupé.'],
  ],
  62: [
    ['🗺️', 'Carte de l’histoire : l’étape en cours pulse bien à sa place, sans se cacher sous son nom.'],
  ],
  61: [
    ['📖', 'L’histoire de Braise est complète : Zéphyr, Voltie, Givrette, Papi Yglou et sa fusion… jusqu’au Roi Gloop ! Et une surprise à la fin.'],
    ['🗺️', 'La carte de l’histoire devient un vrai parchemin d’aventurier.'],
    ['🌙', 'Finis l’histoire pour gagner le trophée « Doux rêveur » et un bonnet de nuit pour Yglou.'],
  ],
  60: [
    ['📖', 'Nouveau : le mode Histoire, « La flamme de Braise » ! Suis Braise dans son aventure, rencontre Ondine et Rocaille, croque des gemmes… Les 5 premiers chapitres sont là, la suite arrive bientôt.'],
  ],
  59: [
    ['🗺️', 'Sur un téléphone tenu droit, les aperçus des cartes sont dans le même sens que la partie : la carte du jour ressemble enfin à ce que tu vas jouer.'],
  ],
  58: [
    ['🗺️', 'Carte du jour : le bouton « Amis » passe au-dessus de « Jouer », pour que tous les boutons « Jouer » soient alignés.'],
  ],
  57: [
    ['🔁', 'Appli fermée par erreur en pleine partie en ligne ? Rouvre-la vite : elle te propose de rejoindre la partie (tu as 1 min 30). En coop, tu retrouves tes tours et ton équipe.'],
  ],
  56: [
    ['⚡', 'Les demandes d’amis apparaissent en quelques secondes, sans avoir à rouvrir la page Amis.'],
  ],
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
