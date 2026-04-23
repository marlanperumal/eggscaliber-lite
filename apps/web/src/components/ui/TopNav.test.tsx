import { render, screen } from "@testing-library/react"
import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@posthog/next", () => ({
  useFeatureFlag: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/analytics"),
}))

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ setTheme: vi.fn() })),
}))

// Controls which branch the mocked Clerk <Show> renders. Each test sets this
// once at the top so the mock renders exactly one branch (mirroring runtime
// semantics). Reset to "signed-in" in beforeEach so tests are order-independent.
let showBranch: "signed-in" | "signed-out" = "signed-in"

vi.mock("@clerk/nextjs", () => ({
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
  UserButton: ({ userProfileUrl }: { userProfileUrl?: string }) => (
    <div data-testid="user-button" data-profile-url={userProfileUrl} />
  ),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  Show: ({
    children,
    fallback,
  }: {
    when: string
    children: React.ReactNode
    fallback?: React.ReactNode
  }) => <>{showBranch === "signed-in" ? children : (fallback ?? null)}</>,
}))

import { useFeatureFlag } from "@posthog/next"
import { TopNav } from "./top-nav"

const mockUseFeatureFlag = vi.mocked(useFeatureFlag)

beforeEach(() => {
  showBranch = "signed-in"
})

describe("TopNav AI link feature flag", () => {
  beforeEach(() => {
    // These tests cover nav link visibility, which lives inside the signed-in branch.
    showBranch = "signed-in"
  })

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

describe("TopNav signed-in avatar", () => {
  it("renders Clerk UserButton wired to /account when signed in", () => {
    showBranch = "signed-in"
    mockUseFeatureFlag.mockReturnValue(undefined)
    render(<TopNav />)
    const userButton = screen.getByTestId("user-button")
    expect(userButton).toBeInTheDocument()
    // Verifies the avatar is Clerk's real component (which renders user.imageUrl)
    // wired to the account profile page rather than a local placeholder.
    expect(userButton).toHaveAttribute("data-profile-url", "/account")
    expect(screen.getByTestId("org-switcher")).toBeInTheDocument()
  })
})
