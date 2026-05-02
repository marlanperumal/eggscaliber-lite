import { ClerkProvider } from "@clerk/nextjs"
import { PostHogPageView, PostHogProvider } from "@posthog/next"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Toaster } from "@/components/ui/sonner"
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

// Real PostHog publishable keys are ~52 chars (phc_ + 48). Anything shorter is a placeholder.
const posthogEnabled = (process.env.NEXT_PUBLIC_POSTHOG_KEY?.length ?? 0) > 20

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
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
            {posthogEnabled ? (
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
            ) : (
              <>
                <TopNav />
                <main className="flex-1 overflow-hidden">{children}</main>
              </>
            )}
          </NuqsAdapter>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return content
  }

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
      {content}
    </ClerkProvider>
  )
}
