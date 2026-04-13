import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Input } from "./input"

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: "Email", placeholder: "you@example.com" } }
export const WithError: Story = {
  args: { label: "Email", placeholder: "you@example.com", error: "Invalid email address" },
}
export const Disabled: Story = {
  args: { label: "Email", placeholder: "you@example.com", disabled: true },
}
export const WithoutLabel: Story = {
  args: { placeholder: "Search...", "aria-label": "Search" },
}
