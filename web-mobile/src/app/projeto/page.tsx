import type { Metadata } from "next";

import ProjetoV2 from "@/components/v2/projeto-v2";

export const metadata: Metadata = {
  title: "Projeto guiado",
  description:
    "Amarre vento e condutor da obra e dimensione os postes em sequência, com memorial ao final.",
};

export default function ProjetoPage() {
  return <ProjetoV2 />;
}
