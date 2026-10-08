package io.github.yglesware.elemento;

import android.app.Activity;
import android.content.Context;
import android.content.pm.ActivityInfo;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Orientation de l'écran choisie dans Réglages (js/comfort.js) : auto (le jeu suit le téléphone, sauf si sa rotation
// est bloquée), portrait ou paysage (dans les deux sens). Le choix est gardé ici pour s'appliquer dès l'ouverture.
@CapacitorPlugin(name = "Orient")
public class OrientPlugin extends Plugin {
    static final String PREFS = "elemento", KEY = "orient";

    static int modeOf(String mode) {
        if ("portrait".equals(mode)) return ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        if ("landscape".equals(mode)) return ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        return ActivityInfo.SCREEN_ORIENTATION_USER;
    }

    static void apply(Activity a) {
        a.setRequestedOrientation(modeOf(a.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "auto")));
    }

    @PluginMethod
    public void set(PluginCall call) {
        String mode = call.getString("mode", "auto");
        Activity a = getActivity();
        a.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, mode).apply();
        a.runOnUiThread(() -> { a.setRequestedOrientation(modeOf(mode)); call.resolve(); });
    }
}
