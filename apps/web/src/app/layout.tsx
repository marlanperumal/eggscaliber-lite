import { ClerkProvider } from "@clerk/nextjs"
import { PostHogPageView, PostHogProvider } from "@posthog/next"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { TopNav } from "@/components/ui/top-nav"
import { themeConfig } from "@/config/theme.config"
import { generateThemeCSS } from "@/lib/theme"
import { ThemeProvider } from "@/lib/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Eggscaliber Lite",
  description: "Data analysis platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorBackground: "hsl(var(--popover))",
          colorText: "hsl(var(--popover-foreground))",
          colorInputBackground: "hsl(var(--input))",
          colorInputText: "hsl(var(--foreground))",
          colorNeutral: "hsl(var(--foreground))",
          colorPrimary: "hsl(var(--primary))",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS-only, no user input */}
          <style dangerouslySetInnerHTML={{ __html: generateThemeCSS(themeConfig) }} />
        </head>
        <body className={`${inter.className} flex min-h-screen flex-col`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NuqsAdapter>
              <PostHogProvider
                clientOptions={{
                  api_host: "/ingest",
                  debug: process.env.NODE_ENV === "development",
                }}
              >
                <PostHogPageView />
                <TopNav />
                <main className="flex-1 overflow-hidden">{children}</main>
              </PostHogProvider>
            </NuqsAdapter>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
