import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { Step1FileHierarchy } from "./Step1FileHierarchy"

const meta: Meta<typeof Step1FileHierarchy> = {
  title: "Datasets/Upload/Step1FileHierarchy",
  component: Step1FileHierarchy,
}
export default meta
type Story = StoryObj<typeof Step1FileHierarchy>

const mockState = { step: 1 as const, sessionId: null, needsReconcile: false }

// Empty form — Next button disabled
export const Default: Story = {
  args: {
    state: mockState,
    setStep: fn(),
    setSessionId: fn(),
    setNeedsReconcile: fn(),
  },
}
