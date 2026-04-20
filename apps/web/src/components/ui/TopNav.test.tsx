import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@posthog/next", () => ({
  useFeatureFlag: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/analytics"),
}))

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ setTheme: vi.fn() })),
}))

import { useFeatureFlag } from "@posthog/next"
import { TopNav } from "./top-nav"

const mockUseFeatureFlag = vi.mocked(useFeatureFlag)

describe("TopNav AI link feature flag", () => {
  it("hides the AI link when the flag is not yet loaded (undefined)", () => {
    mockUseFeatureFlag.mockReturnValue(undefined)
    render(<TopNav />)
    expect(screen.queryByRole("link", { name: "AI" })).not.toBeInTheDocument()
  })

  it("hides the AI link when the flag is disabled", () => {
    mockUseFeatureFlag.mockReturnValue({ key: "ai-interface", enabled: false } as ReturnType<
      typeof useFeatureFlag
    >)
    render(<TopNav />)
    expect(screen.queryByRole("link", { name: "AI" })).not.toBeInTheDocument()
  })

  it("shows the AI link when the flag is enabled", () => {
    mockUseFeatureFlag.mockReturnValue({ key: "ai-interface", enabled: true } as ReturnType<
      typeof useFeatureFlag
    >)
    render(<TopNav />)
    expect(screen.getByRole("link", { name: "AI" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "AI" })).toHaveAttribute("href", "/ai")
  })

  it("always shows the Analytics link regardless of flag", () => {
    mockUseFeatureFlag.mockReturnValue(undefined)
    render(<TopNav />)
    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument()
  })
})
