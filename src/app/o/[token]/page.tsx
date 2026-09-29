import PublicPortal from "@/components/portal/PublicPortal";

export const metadata = { title: "Seu orçamento", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicPortal token={token} kind="quote" />;
}
