import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="crosstab" className="w-64">
      <TabsList>
        <TabsTrigger value="crosstab">Crosstab</TabsTrigger>
        <TabsTrigger value="trend">Trend</TabsTrigger>
      </TabsList>
      <TabsContent value="crosstab">Crosstab content</TabsContent>
      <TabsContent value="trend">Trend content</TabsContent>
    </Tabs>
  ),
}
