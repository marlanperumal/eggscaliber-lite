import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { postHogMiddleware } from "@posthog/next"
import type { NextRequest } from "next/server"

const postHogHandler = postHogMiddleware({
  proxy: { host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com" },
})

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"])

export const proxy = clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/ingest")) {
    return postHogHandler(req)
  }

  // proxyConfig.matcher is not reliably respected in Next.js 16 — guard explicitly
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return
  }

  if (!isPublicRoute(req) && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    await auth.protect()
  }
})

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
