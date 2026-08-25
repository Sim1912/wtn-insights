import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";

const THEME_STORAGE_KEY = "wtn-insights-court-theme";

const themeBootstrap = `(() => {
  try {
    const storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    const serverTheme = document.documentElement.dataset.theme === "clay" ? "clay" : "grass";
    const selectedTheme = storedTheme === "clay" || storedTheme === "grass" ? storedTheme : serverTheme;
    document.documentElement.dataset.theme = selectedTheme;
    document.cookie = "${THEME_STORAGE_KEY}=" + selectedTheme + "; Path=/; Max-Age=31536000; SameSite=Lax";
  } catch {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "clay" ? "clay" : "grass";
  }
})();`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og-grass-court.png`;
  const description = "World Tennis Number ratings, match history, scores and opponent context.";
  return {
    title: "WTN Insights — Ratings, matches and analytics",
    description,
    openGraph: { title: "WTN Insights", description, type: "website", images: [{ url: imageUrl, width: 1536, height: 1024, alt: "WTN Insights — ratings, matches and analytics" }] },
    twitter: { card: "summary_large_image", title: "WTN Insights", description, images: [imageUrl] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get(THEME_STORAGE_KEY)?.value;
  const initialTheme = savedTheme === "clay" ? "clay" : "grass";

  return <html lang="en" data-theme={initialTheme} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
    <body>
      <div id="court-theme-sweep" className="court-theme-sweep" aria-hidden="true" />
      {children}
      <footer className="product-footer">
        <p className="product-footer-inner shell">Independent prototype. Not affiliated with or endorsed by the ITF or World Tennis Number.</p>
      </footer>
    </body>
  </html>;
} 
