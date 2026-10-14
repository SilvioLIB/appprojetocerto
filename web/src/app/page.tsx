import type { Metadata } from "next";

import { Painel } from "@/components/painel/painel";

export const metadata: Metadata = { title: "Painel" };

export default function Home() {
  return <Painel />;
}
