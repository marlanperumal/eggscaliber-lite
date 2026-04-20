import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { postHogMiddleware } from "@posthog/next"

const postHogHandler = postHogMiddleware({
  proxy: { host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com" },
})

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"])

export const proxy = clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname.startsWith("/ingest")) {
    return postHogHandler(req)
  }
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
