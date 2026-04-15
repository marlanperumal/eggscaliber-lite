import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AnalyticsPreviewIllustration } from "./AnalyticsPreviewIllustration"

const meta = {
  title: "Home/AnalyticsPreviewIllustration",
  component: AnalyticsPreviewIllustration,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 400, padding: 24, border: "1px solid var(--border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalyticsPreviewIllustration>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
