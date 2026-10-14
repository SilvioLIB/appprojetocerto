package br.com.projetocerto.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Impressão / "Salvar como PDF" do memorial. O window.print() é inerte no
 * WebView do Android; aqui o próprio WebView vira o documento do PrintManager,
 * que renderiza a página com o @media print de globals.css (tema claro).
 * Chamado por src/lib/nativo/imprimir.ts.
 */
@CapacitorPlugin(name = "Imprimir")
public class ImprimirPlugin extends Plugin {

    @PluginMethod
    public void imprimir(PluginCall call) {
        String titulo = call.getString("titulo", "Projeto Certo");
        // O WebView só pode ser tocado na thread de interface.
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager gerenciador = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adaptador = webView.createPrintDocumentAdapter(titulo);
                PrintAttributes atributos = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .build();
                gerenciador.print(titulo, adaptador, atributos);
                call.resolve();
            } catch (Exception e) {
                call.reject("Não foi possível abrir a impressão do Android.", e);
            }
        });
    }
}
