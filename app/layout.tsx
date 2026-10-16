import type { Metadata, Viewport } from "next";
import { Outfit, Newsreader } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FuturoYo · Lista de espera",
  description:
    "FuturoYo convierte a la persona que quieres ser en metas, hábitos y acciones para hoy. Entra a la lista de espera.",
  icons: { icon: "/assets/logo-v2.png" },
};

export const viewport: Viewport = {
  themeColor: "#03060f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${outfit.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
