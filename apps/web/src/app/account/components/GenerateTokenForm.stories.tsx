import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GenerateTokenForm } from "./GenerateTokenForm"

const meta: Meta<typeof GenerateTokenForm> = {
  title: "Account/GenerateTokenForm",
  component: GenerateTokenForm,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    onGenerate: async () => {},
    onCancel: () => {},
    isLoading: false,
  },
}
export default meta
type Story = StoryObj<typeof GenerateTokenForm>

export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
