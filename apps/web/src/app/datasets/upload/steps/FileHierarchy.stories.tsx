import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { HttpResponse, http } from "msw"
import { FileHierarchy } from "./FileHierarchy"

const BASE = "http://localhost:8000"

const meta: Meta<typeof FileHierarchy> = {
  title: "Datasets/Upload/FileHierarchy",
  component: FileHierarchy,
}
export default meta
type Story = StoryObj<typeof FileHierarchy>

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
  parameters: {
    msw: {
      handlers: [http.get(`${BASE}/api/v1/packages`, () => HttpResponse.json(MOCK_PACKAGES))],
    },
  },
}
