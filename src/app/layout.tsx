import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/customs/footer";
import { AppProviders } from "./providers";
import { getSystemSettings } from "@/repository/system-config";

const FALLBACK_TITLE = "Claude Code Hub";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSystemSettings();
    const title = settings.siteTitle?.trim() || FALLBACK_TITLE;

    return {
      title,
      description: title,
    };
  } catch (error) {
    console.error("Failed to load system settings for metadata:", error);
    return {
      title: FALLBACK_TITLE,
      description: FALLBACK_TITLE,
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProviders>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
