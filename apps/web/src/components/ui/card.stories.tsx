import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Card content area.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">Confirm</Button>
      </CardFooter>
    </Card>
  ),
}

export const Simple: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Simple Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No footer on this one.</p>
      </CardContent>
    </Card>
  ),
}
