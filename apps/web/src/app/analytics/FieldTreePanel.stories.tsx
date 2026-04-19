import { DndContext } from "@dnd-kit/core"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { HttpResponse, http } from "msw"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { FieldTreePanel } from "./FieldTreePanel"

const MOCK_SCOPE = [
  {
    id: 1,
    name: "Brand Tracker",

    collections: [
      {
        id: 1,
        name: "Quarterly Survey",
        datasets: [
          { id: 1, name: "Wave 1" },
          { id: 2, name: "Wave 2" },
        ],
      },
    ],
  },
]

const meta = {
  title: "Analytics/FieldTreePanel",
  component: FieldTreePanel,
  parameters: {
    layout: "padded",
    msw: {
      handlers: [
        http.get("http://localhost:8000/api/v1/scope", () => HttpResponse.json(MOCK_SCOPE)),
      ],
    },
  },
  decorators: [
    (Story) => (
      <DndContext>
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
      </DndContext>
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
  parameters: {
    msw: {
      handlers: [
        http.get(
          "http://localhost:8000/api/v1/datasets/:id/field-tree",
          () => new Promise(() => {}),
        ),
      ],
    },
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

export const WithAssignedFields: Story = {
  name: "With Assigned Fields (toggle indicators)",
  args: {
    query: makeQuery({
      dataset_id: 1,
      rows: [
        {
          field_key: "brand_awareness",
          display_name: "Brand Awareness",
          field_type: "categorical",
        },
        { field_key: "age_group", display_name: "Age Group", field_type: "categorical" },
      ],
      columns: [
        {
          field_key: "brand_awareness",
          display_name: "Brand Awareness",
          field_type: "categorical",
        },
      ],
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows R/C indicator badges on fields that are assigned to zones. Requires `just api` for live field tree data.",
      },
    },
  },
}
