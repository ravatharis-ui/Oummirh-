import type { Metadata, Viewport } from "next";
import type React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/core/ui/query-provider";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Oummi RH", template: "%s · Oummi RH" },
  description: "Application RH d'Oummi Dressing : pointage, plannings, congés, documents.",
  applicationName: "Oummi RH",
  manifest: "/manifest.webmanifest",
  // Sur iOS, c'est ce bloc — et lui seul — qui fait qu'un raccourci ajouté à
  // l'écran d'accueil s'ouvre en plein écran plutôt que dans Safari.
  appleWebApp: { capable: true, title: "Oummi RH", statusBarStyle: "default" },
  icons: { apple: "/apple-icon.png" },
  // Une application RH interne n'a rien à faire dans un moteur de recherche.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#b14f42",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
