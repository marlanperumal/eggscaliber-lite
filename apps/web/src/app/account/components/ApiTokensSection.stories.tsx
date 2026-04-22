import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ApiTokensSection } from "./ApiTokensSection"

const meta: Meta<typeof ApiTokensSection> = {
  title: "Account/ApiTokensSection",
  component: ApiTokensSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
}
export default meta
type Story = StoryObj<typeof ApiTokensSection>

export const Default: Story = {}
