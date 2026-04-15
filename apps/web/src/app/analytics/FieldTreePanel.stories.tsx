import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { api } from "@/lib/api"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { FieldTreePanel } from "./FieldTreePanel"

const meta = {
  title: "Analytics/FieldTreePanel",
  component: FieldTreePanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 240, height: 560, display: "flex" }}>
        <div
          style={{
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    onCollapse: fn(),
    onQueryChange: fn(),
  },
} satisfies Meta<typeof FieldTreePanel>

export default meta
type Story = StoryObj<typeof meta>

function makeQuery(overrides: Partial<QueryConfig> = {}): QueryConfig {
  return { ...DEFAULT_QUERY, ...overrides }
}

export const NoDataset: Story = {
  name: "No dataset selected",
  args: { query: makeQuery() },
}

export const Loading: Story = {
  name: "Loading — fetching tree",
  args: { query: makeQuery({ dataset_id: 1 }) },
  beforeEach() {
    const original = api.GET
    // biome-ignore lint/suspicious/noExplicitAny: story-only mock
    ;(api as any).GET = () => new Promise(() => {})
    return () => {
      // biome-ignore lint/suspicious/noExplicitAny: story-only mock
      ;(api as any).GET = original
    }
  },
}

export const Populated: Story = {
  name: "Populated — requires dev API",
  args: { query: makeQuery({ dataset_id: 1 }) },
  parameters: {
    docs: {
      description: {
        story: "Requires `just api` running with seed data (`just db-seed`) to load fields.",
      },
    },
  },
}
