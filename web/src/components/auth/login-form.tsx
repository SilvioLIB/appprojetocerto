"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";

import { login, type EstadoLogin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ proximo }: { proximo?: string }) {
  const [estado, formAction, pendente] = useActionState<EstadoLogin, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      {proximo && <input type="hidden" name="proximo" value={proximo} />}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="voce@dominio.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {estado.erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {estado.erro}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pendente}>
        {pendente ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando…
          </>
        ) : (
          <>
            <Lock className="size-4" />
            Entrar
          </>
        )}
      </Button>
    </form>
  );
}
