import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GBR Gestão", template: "%s · GBR Gestão" },
  description: "GBR Gestão — o sistema operacional da sua empresa de serviços: CRM, orçamentos, OS, agenda, estoque e financeiro.",
  applicationName: "GBR Gestão",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GBR Gestão", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" }], apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `try{var t=localStorage.getItem('gbr-theme')||'dark';var r=t==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;var a=localStorage.getItem('gbr-accent');if(a)document.documentElement.style.setProperty('--accent',a);var b=localStorage.getItem('gbr-accent2');if(b)document.documentElement.style.setProperty('--accent-2',b);var f=localStorage.getItem('gbr-accent-fg');if(f)document.documentElement.style.setProperty('--accent-fg',f);}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="app-bg min-h-dvh antialiased">{children}</body>
    </html>
  );
}
