import type { Metadata } from "next";
import "./globals.css";
import "./workspace-redesign.css";
import "./brand.css";
import "./auth.css";
import "./chat-cards.css";
import "./quote-editor.css";
import "./catalog-workspace.css";
import "./inbox-overview.css";
import "./navigation-collapse.css";
import "./integrations-workspace.css";
import "./admin-navigation.css";
import "./action-colors.css";
import "./shared-inbox.css";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export const metadata: Metadata = {
  title: "Center Cell",
  description: "Central de atendimento da Center Cell Distribuidora.",
  manifest: "/site.webmanifest",
  themeColor: "#140507",
  icons: {
    icon: [{url:"/favicon.ico",sizes:"48x48"},{url:"/favicon-32x32.png",type:"image/png",sizes:"32x32"},{url:"/favicon-16x16.png",type:"image/png",sizes:"16x16"}],
    apple: [{url:"/apple-touch-icon.png",sizes:"180x180"}],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
