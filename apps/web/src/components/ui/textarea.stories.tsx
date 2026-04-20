import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Textarea } from "./textarea"

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { placeholder: "Enter text..." } }
export const WithValue: Story = { args: { value: "Some pre-filled content.", readOnly: true } }
export const Disabled: Story = { args: { placeholder: "Disabled textarea", disabled: true } }
export const WithAriaLabel: Story = {
  args: { placeholder: "Notes", "aria-label": "Notes" },
}
