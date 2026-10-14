"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/use-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const montado = useMounted();
  const escuro = resolvedTheme === "dark";
  // Antes de montar, o tema resolvido é desconhecido: renderiza o estado "claro"
  // (igual ao SSR) para ícone, aria-label e title, evitando mismatch de hidratação.
  const mostrarEscuro = montado && escuro;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mostrarEscuro ? "Ativar modo claro" : "Ativar modo noturno"}
      title={mostrarEscuro ? "Modo claro" : "Modo noturno"}
      onClick={() => setTheme(escuro ? "light" : "dark")}
    >
      {mostrarEscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
