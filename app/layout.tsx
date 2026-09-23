import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/settings/workspace";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Omar" }],
  creator: "Omar",
  publisher: "Omar",
  keywords: SITE_KEYWORDS,
  category: "finance",
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "WWEWrMixmoLtK5QWwy7J2-0kB80FdgjCNgG462mM7pQ",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: SITE_SHORT_NAME,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og.png`,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og.png`],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c16" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  alternateName: SITE_SHORT_NAME,
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Windows, macOS, Linux, Web",
  description: SITE_DESCRIPTION,
  author: {
    "@type": "Person",
    name: "Omar",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <link rel="manifest" href="/manifest.json" />
        <meta
          name="google-site-verification"
          content="WWEWrMixmoLtK5QWwy7J2-0kB80FdgjCNgG462mM7pQ"
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PwaRegister />
        <WorkspaceProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
