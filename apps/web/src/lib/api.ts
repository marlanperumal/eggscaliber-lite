import type { paths } from "@eggscaliber/shared"
import createClient from "openapi-fetch"

export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
})
