import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { HttpResponse, http } from "msw"
import { MembersPanel } from "./MembersPanel"

const MOCK_MEMBERS = [
  {
    user_id: 1,
    clerk_id: "user_1",
    email: "alice@example.com",
    display_name: "Alice",
    role: "admin",
  },
  {
    user_id: 2,
    clerk_id: "user_2",
    email: "bob@example.com",
    display_name: "Bob",
    role: "member",
  },
]

const MOCK_ORG_MEMBERS = [
  ...MOCK_MEMBERS,
  {
    user_id: 3,
    clerk_id: "user_3",
    email: "carol@example.com",
    display_name: "Carol",
    role: "member",
  },
]

const meta = {
  component: MembersPanel,
  args: { groupId: null, isDefault: false },
  parameters: {
    msw: {
      handlers: [
        http.get("http://localhost:8000/api/v1/groups/:group_id/members", () =>
          HttpResponse.json(MOCK_MEMBERS),
        ),
        http.get("http://localhost:8000/api/v1/org/members", () =>
          HttpResponse.json(MOCK_ORG_MEMBERS),
        ),
      ],
    },
  },
} satisfies Meta<typeof MembersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const NoGroupSelected: Story = {}

export const DefaultGroup: Story = {
  args: { groupId: 1, isDefault: true },
}

export const AdminView: Story = {
  args: { groupId: 2, isDefault: false },
}
