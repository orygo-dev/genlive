import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans, Syne } from "next/font/google";
import "@livekit/components-styles";
import { SplashScreen } from "@/components/splash-screen";
import { PwaRegister } from "@/components/pwa-register";
import { getPlatformBranding } from "@/lib/platform-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const landingSans = Plus_Jakarta_Sans({
  variable: "--font-landing-sans",
  subsets: ["latin"],
});

const landingDisplay = Syne({
  variable: "--font-landing-display",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding();
  return {
    metadataBase: new URL(
      process.env.APP_URL?.startsWith("http")
        ? process.env.APP_URL
        : "http://localhost:3000",
    ),
    title: {
      default: `${branding.appName} — Meeting video untuk bisnis`,
      template: `%s · ${branding.appName}`,
    },
    description:
      "Platform meeting video komersial: workspace, undangan, recording, dan billing — langsung dari browser.",
    icons: branding.logoUrl
      ? {
          icon: branding.logoUrl,
          apple: branding.logoUrl,
        }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getPlatformBranding();

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${landingSans.variable} ${landingDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SplashScreen branding={branding} />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
