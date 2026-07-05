import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "RecipeShare — 레시피 공유",
  description: "나만의 레시피를 공유하고 다른 사람의 요리를 발견하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>
          <SiteHeader />
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
