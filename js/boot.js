// Élémento Defense : chargement du jeu. Les données d'abord (js/storage.js), puis les scripts dans l'ordre.
// Dans un fichier à part, et non dans index.html : la règle de sécurité de la page (CSP) n'autorise aucun script écrit dans la page.
'use strict';
store.boot([
  'js/errors.js', 'js/i18n.js', 'js/data.js', 'js/draw.js', 'js/game.js', 'js/ui.js', 'js/vendor/qrcode.min.js', 'js/net.js', 'js/multi.js', 'js/duel.js', 'js/music.js', 'js/guide.js', 'js/random.js', 'js/coop.js', 'js/mascot.js', 'js/intro.js', 'js/bestiary.js', 'js/surprise.js', 'js/bonus.js', 'js/trophies.js', 'js/actions.js', 'js/vendor/supabase.js', 'js/cloud.js', 'js/parents.js', 'js/friends.js', 'js/online.js', 'js/emotes.js', 'js/news.js', 'js/quests.js', 'js/ranking.js', 'js/tournament.js', 'js/challenge.js', 'js/ads.js', 'js/wardrobe.js', 'js/comfort.js', 'js/story.js',
]);
