import { PostHogPageView, PostHogProvider } from "@posthog/next"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Eggscaliber Lite",
  description: "Data analysis platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PostHogProvider
          clientOptions={{ api_host: "/ingest", debug: process.env.NODE_ENV === "development" }}
          bootstrapFlags
        >
          <PostHogPageView />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
