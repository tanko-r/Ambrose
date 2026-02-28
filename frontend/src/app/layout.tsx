import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthTokenProvider } from "@/components/providers/auth-token-provider";
import { SmallScreenWarning } from "@/components/small-screen-warning";
import { AxeAccessibility } from "@/components/axe-accessibility";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contract Review",
  description: "Collaborative contract review and redlining tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{ baseTheme: shadcn }}
      afterSignOutUrl="/sign-in"
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <AuthTokenProvider>
            <ThemeProvider>
              {children}
              <SmallScreenWarning />
              <AxeAccessibility />
              <Toaster position="bottom-right" richColors theme="system" />
            </ThemeProvider>
          </AuthTokenProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
