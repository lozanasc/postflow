import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Postflow",
  description: "AI-powered social media management and automated video editing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider defaultTheme="system" storageKey="postflow-ui-theme">
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster
            position="top-center"
            closeButton
            className="toaster group"
            toastOptions={{
              classNames: {
                toast:
                  "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-sm",
                description: "group-[.toast]:text-muted-foreground",
                actionButton:
                  "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                cancelButton:
                  "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
