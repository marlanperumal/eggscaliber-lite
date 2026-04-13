import { PostHogPageView, PostHogProvider } from "@posthog/next"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { themeConfig } from "@/config/theme.config"
import { generateThemeCSS } from "@/lib/theme"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Eggscaliber Lite",
  description: "Data analysis platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme CSS injected here so tokens resolve before first paint */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS-only content, no user input */}
        <style dangerouslySetInnerHTML={{ __html: generateThemeCSS(themeConfig) }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <PostHogProvider
              clientOptions={{ api_host: "/ingest", debug: process.env.NODE_ENV === "development" }}
            >
              <PostHogPageView />
              {children}
            </PostHogProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  )
}
