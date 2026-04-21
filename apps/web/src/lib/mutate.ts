import { toast } from "sonner"

export async function mutate<T>(
  fn: () => Promise<{ data?: T; error?: unknown; response: Response }>,
  options?: { errorMessage?: string },
): Promise<{ data: T | undefined; error: unknown }> {
  const result = await fn()
  if (result.error !== undefined) {
    toast.error(options?.errorMessage ?? "Something went wrong. Please try again.")
  }
  return { data: result.data, error: result.error }
}
