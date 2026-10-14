package br.com.projetocerto.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locais (fora do npm) são registrados antes do super.onCreate.
        registerPlugin(ImprimirPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
