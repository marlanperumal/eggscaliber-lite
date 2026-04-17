import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { Step3Reconciliation } from "./Step3Reconciliation"

const meta: Meta<typeof Step3Reconciliation> = {
  title: "Datasets/Upload/Step3Reconciliation",
  component: Step3Reconciliation,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof Step3Reconciliation>

// Pre-trigger state — shows reference dataset input (auto-populated)
export const PreTrigger: Story = {
  args: {
    state: { step: 3 as const, sessionId: 1, needsReconcile: true },
    setStep: fn(),
  },
}
