package io.github.yglesware.elemento;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Couleur derrière les barres du téléphone (heure en haut, boutons en bas). Avec une WebView récente, la page passe
// dessous et ce fond ne se voit pas ; avec une plus ancienne, les barres restent à part : le jeu leur donne la couleur
// du fond de l'écran affiché (jaune sur l'accueil, bleu ciel ailleurs), au lieu d'un bleu fixe.
@CapacitorPlugin(name = "BarsColor")
public class BarsColorPlugin extends Plugin {
    // top : derrière la barre d'état ; bottom : derrière les boutons (en partie, le panneau des tours est blanc).
    // Un dégradé qui ne change qu'au milieu, caché par le jeu : chaque barre a sa couleur pleine.
    @PluginMethod
    public void set(PluginCall call) {
        String top = call.getString("top", "#7fd3ff"), bottom = call.getString("bottom", top);
        getActivity().runOnUiThread(() -> {
            try {
                int t = Color.parseColor(top), b = Color.parseColor(bottom);
                getActivity().getWindow().getDecorView().setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { t, t, b, b }));
            } catch (IllegalArgumentException e) {
                // couleur illisible : on garde l'ancienne
            }
            call.resolve();
        });
    }
}
