import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ThemeProvider } from "next-themes"
import { ThemeToggle } from "./theme-toggle"

const meta = {
  title: "UI/ThemeToggle",
  component: ThemeToggle,
  parameters: { layout: "centered" },
  // ThemeToggle requires ThemeProvider — wrap every story
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
