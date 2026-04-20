import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { Reconciliation } from "./Reconciliation"

const meta = {
  title: "Datasets/Upload/Reconciliation",
  component: Reconciliation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Reconciliation>
export default meta
type Story = StoryObj<typeof meta>

// Pre-trigger state — shows reference dataset input (auto-populated)
export const PreTrigger: Story = {
  args: {
    state: { step: 3 as const, sessionId: 1, needsReconcile: true },
    setStep: fn(),
  },
}
