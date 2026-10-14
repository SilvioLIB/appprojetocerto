import { LogOut } from "lucide-react";

import { logout } from "@/app/actions/auth";
import type { Usuario } from "@/lib/auth/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROTULO_PAPEL: Record<Usuario["papel"], string> = {
  dono: "Dono",
  editor: "Editor",
  leitor: "Leitor",
};

export function UserMenu({ usuario }: { usuario: Usuario }) {
  return (
    <div className="flex items-center gap-2 pl-1">
      <div className="hidden text-right leading-tight sm:block">
        <span className="block max-w-[16ch] truncate text-xs font-medium">{usuario.email}</span>
        <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">
          {ROTULO_PAPEL[usuario.papel]}
        </Badge>
      </div>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="icon" title="Sair" aria-label="Sair">
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  );
}
