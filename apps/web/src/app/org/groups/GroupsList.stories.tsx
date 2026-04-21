import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { GroupsList } from "./GroupsList"

const MOCK_GROUPS = [
  { id: 1, org_id: 1, name: "Default", is_default: true, member_count: 5, package_count: 3 },
  { id: 2, org_id: 1, name: "Analysts", is_default: false, member_count: 3, package_count: 2 },
  { id: 3, org_id: 1, name: "Viewers", is_default: false, member_count: 8, package_count: 1 },
]

const groupHandlers = [
  http.get("http://localhost:8000/api/v1/groups", () => HttpResponse.json(MOCK_GROUPS)),
]

const meta = {
  component: GroupsList,
  args: {
    selectedGroupId: null,
    onSelect: () => {},
  },
  parameters: {
    msw: { handlers: groupHandlers },
  },
} satisfies Meta<typeof GroupsList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get("http://localhost:8000/api/v1/groups", () => HttpResponse.json([]))],
    },
  },
}

export const WithGroups: Story = {
  args: { selectedGroupId: 2 },
}
