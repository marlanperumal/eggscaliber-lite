import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TopNav } from "./top-nav"

const meta = {
  component: TopNav,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/analytics",
      },
    },
  },
} satisfies Meta<typeof TopNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
