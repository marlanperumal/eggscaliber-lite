import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, spyOn } from "@storybook/test"
import { Step1FileHierarchy } from "./Step1FileHierarchy"

const meta: Meta<typeof Step1FileHierarchy> = {
  title: "Datasets/Upload/Step1FileHierarchy",
  component: Step1FileHierarchy,
}
export default meta
type Story = StoryObj<typeof Step1FileHierarchy>

const MOCK_PACKAGES = [
  { id: 1, name: "Brand Tracker", slug: "brand-tracker", created_at: "2025-01-01T00:00:00Z" },
  { id: 2, name: "Market Research", slug: "market-research", created_at: "2025-01-01T00:00:00Z" },
]

export const Default: Story = {
  args: {
    state: { step: 1 as const, sessionId: null, needsReconcile: false },
    setStep: fn(),
    setSessionId: fn(),
    setNeedsReconcile: fn(),
  },
  beforeEach() {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_PACKAGES), { status: 200 }),
    )
  },
}
