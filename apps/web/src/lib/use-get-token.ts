"use client"
import { useAuth } from "@clerk/nextjs"
import { useCallback } from "react"

function useGetTokenClerk() {
  return useAuth().getToken
}

function useGetTokenDev() {
  return useCallback(async (): Promise<string | null> => null, [])
}

// Assigned once at module-evaluation time (env var is inlined by Next.js at build).
// Same function is called on every render — no conditional hook call at runtime.
export const useGetToken = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? useGetTokenClerk
  : useGetTokenDev
