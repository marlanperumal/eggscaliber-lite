import type { paths } from "@shared/api"
import createClient from "openapi-fetch"

export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
})
