// Convert to a Server Component page with SEO metadata and a client wrapper
import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";

export const metadata: Metadata = {
  title: "Galaxy Racer: Neon Drift — Retro Space Shooter",
  description:
    "Pilot a neon starfighter through a synthwave galaxy. Dodge asteroids, blast enemies, collect power-ups, and chase high scores in this fast, retro-inspired browser game.",
  keywords: [
    "galaxy racer",
    "neon drift",
    "retro",
    "space shooter",
    "canvas game",
    "arcade",
    "synthwave",
    "browser game",
  ],
  openGraph: {
    title: "Galaxy Racer: Neon Drift",
    description:
      "A fast, retro synthwave space shooter you can play in your browser.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Galaxy Racer: Neon Drift",
    description:
      "Retro synthwave space shooter — dodge, blast, and chase high scores.",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main className="min-h-screen w-full">
      {/* Screen-reader heading for SEO */}
      <h1 className="sr-only">Galaxy Racer: Neon Drift — Retro Space Shooter</h1>
      <HomeClient />
    </main>
  );
}