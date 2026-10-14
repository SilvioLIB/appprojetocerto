import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Tecla "Próximo" do teclado virtual: foca o campo seguinte da página; se o
 * seguinte for um seletor (ou não houver), fecha o teclado. Só em toque — no
 * desktop o Enter continua sem efeito.
 */
function focarProximo(atual: HTMLInputElement) {
  const campos = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-slot="input"]:not(:disabled), [data-slot="select-trigger"]:not(:disabled)'
    )
  ).filter((el) => el.getClientRects().length > 0)
  const proximo = campos[campos.indexOf(atual) + 1]
  if (proximo?.dataset.slot === "input") proximo.focus()
  else atual.blur()
}

function Input({ className, type, inputMode, enterKeyHint, onKeyDown, ...props }: React.ComponentProps<"input">) {
  // Campos numéricos vêm em sequência: o teclado mostra "Próximo" em vez de "Enter".
  const dica = enterKeyHint ?? (inputMode === "decimal" || inputMode === "numeric" ? "next" : undefined)
  return (
    <InputPrimitive
      type={type}
      inputMode={inputMode}
      enterKeyHint={dica}
      data-slot="input"
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e)
        if (
          !e.defaultPrevented &&
          e.key === "Enter" &&
          dica === "next" &&
          window.matchMedia("(pointer: coarse)").matches
        ) {
          e.preventDefault()
          focarProximo(e.currentTarget)
        }
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
