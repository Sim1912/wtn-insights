import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og-premium.png`;
  const description = "Live World Tennis Number ratings, match history, scores and opponent context.";
  return {
    title: "WTN Insights — Every match, the full story",
    description,
    openGraph: { title: "WTN Insights", description, type: "website", images: [{ url: imageUrl, width: 1733, height: 908, alt: "WTN Insights tennis analytics dashboard" }] },
    twitter: { card: "summary_large_image", title: "WTN Insights", description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
} 
