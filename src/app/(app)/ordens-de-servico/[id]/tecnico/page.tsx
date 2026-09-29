import TechMode from "@/modules/orders/TechMode";

export const metadata = { title: "Modo técnico" };

export default async function Route({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TechMode id={id} />;
}
