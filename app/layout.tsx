import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og-refined.png`;
  const description = "World Tennis Number ratings, match history, scores and opponent context.";
  return {
    title: "WTN Insights — Ratings, matches and analytics",
    description,
    openGraph: { title: "WTN Insights", description, type: "website", images: [{ url: imageUrl, width: 1536, height: 1024, alt: "WTN Insights — ratings, matches and analytics" }] },
    twitter: { card: "summary_large_image", title: "WTN Insights", description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
} 
