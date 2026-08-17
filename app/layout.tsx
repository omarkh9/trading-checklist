import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "EDGE LOG | Trading Dashboard",
  description: "Modern trading dashboard for journaling, checklists, and analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={${inter.variable} font-sans}>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "EDGE LOG | Trading Dashboard",
  description: "Modern trading dashboard for journaling, checklists, and analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={${inter.variable} font-sans}>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}