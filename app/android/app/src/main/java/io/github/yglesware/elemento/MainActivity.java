package io.github.yglesware.elemento;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Serveur local de l'hôte : un seul scan pour rejoindre une partie lancée depuis l'application
        registerPlugin(LanServerPlugin.class);
        // Couleur derrière les barres du téléphone, assortie à l'écran affiché (js/ui.js barsColor)
        registerPlugin(BarsColorPlugin.class);
        super.onCreate(savedInstanceState);
        // Le jeu va jusque sous l'encoche de l'appareil photo (le contenu s'en écarte, css/style.css --sat)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        immersive();
        safeArea();
    }

    // La page couvre tout l'écran (capacitor.config.json : insetsHandling « disable ») ; le jeu reçoit seulement la
    // place de l'encoche de l'appareil photo (--safe-area-inset-*, css/style.css), pour en écarter ses boutons, quelle
    // que soit la version de la WebView. Les barres du téléphone, cachées, ne comptent pas : montrées un instant d'un
    // glissement, elles passent par-dessus sans faire bouger le jeu. Le clavier, lui, remonte la page.
    private void safeArea() {
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            boolean kb = insets.isVisible(WindowInsetsCompat.Type.ime());
            v.setPadding(0, 0, 0, kb ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0);
            float d = getResources().getDisplayMetrics().density;
            String js = String.format(Locale.US,
                "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');",
                (int) (cut.top / d), kb ? 0 : (int) (cut.bottom / d));
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) wv.post(() -> wv.evaluateJavascript(js, null));
            return insets;
        });
    }

    // Plein écran comme un jeu : l'heure et les boutons du téléphone sont cachés ; un glissement depuis le bord les
    // montre un instant, puis ils se recachent. À refaire à chaque retour dans l'appli (le téléphone les remet).
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
