import { postHogMiddleware } from "@posthog/next"
import type { NextRequest } from "next/server"

const handler = postHogMiddleware({
  proxy: { host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com" },
})

export async function proxy(request: NextRequest) {
  return handler(request)
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
