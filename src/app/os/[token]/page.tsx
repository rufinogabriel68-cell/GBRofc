import PublicPortal from "@/components/portal/PublicPortal";

export const metadata = { title: "Acompanhe seu serviço", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicPortal token={token} kind="work_order" />;
}
