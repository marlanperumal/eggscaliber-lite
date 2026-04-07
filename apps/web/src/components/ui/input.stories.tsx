import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Input } from "./input"

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { placeholder: "Enter text..." } }
export const WithLabel: Story = {
  args: { label: "Email address", placeholder: "you@example.com", type: "email" },
}
export const WithError: Story = {
  args: {
    label: "Email address",
    value: "notanemail",
    error: "Please enter a valid email address.",
    readOnly: true,
  },
}
export const Disabled: Story = {
  args: { label: "Disabled field", placeholder: "Cannot edit", disabled: true },
}
