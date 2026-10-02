package io.github.yglesware.elemento;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Serveur local de l'hôte : un seul scan pour rejoindre une partie lancée depuis l'application
        registerPlugin(LanServerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
