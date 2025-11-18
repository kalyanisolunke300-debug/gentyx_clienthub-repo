import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandBar } from "@/components/command-bar";
import ConditionalShell from "@/components/conditional-shell";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClientHub",
  description: "Client Onboarding Platform",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ConditionalShell>{children}</ConditionalShell>
          <CommandBar />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
