import { CategoriaView } from "@/components/categoria-view";

export default async function CategoriaPage({ params }: PageProps<"/categoria/[id]">) {
  const { id } = await params;
  return <CategoriaView categoriaId={id} />;
}
