import { DndContext } from "@dnd-kit/core"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, userEvent, within } from "@storybook/test"
import type { QueryConfig } from "./analytics-types"
import { DEFAULT_QUERY } from "./analytics-types"
import { QueryBuilderPanel } from "./QueryBuilderPanel"

const meta = {
  title: "Analytics/QueryBuilderPanel",
  component: QueryBuilderPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <DndContext>
        <div style={{ width: 280, height: 640, display: "flex" }}>
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
    onResult: fn(),
    isLoading: false,
    onLoadingChange: fn(),
  },
} satisfies Meta<typeof QueryBuilderPanel>

export default meta
type Story = StoryObj<typeof meta>

const withFields = (overrides: Partial<QueryConfig> = {}): QueryConfig => ({
  ...DEFAULT_QUERY,
  ...overrides,
})

// ── Stories ────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: "Empty (no dataset, no fields)",
  args: { query: withFields() },
}

export const EmptyZones: Story = {
  name: "Empty zones — illustrated drop targets",
  args: {
    query: withFields({ dataset_id: 1 }),
  },
}

export const CrosstabWithFields: Story = {
  name: "Crosstab — with fields",
  args: {
    query: withFields({
      dataset_id: 1,
      rows: [
        { field_key: "gender", display_name: "Gender", field_type: "categorical" },
        { field_key: "age_group", display_name: "Age Group", field_type: "ordinal" },
      ],
      columns: [
        {
          field_key: "brand_awareness",
          display_name: "Brand Awareness",
          field_type: "multi_response",
        },
      ],
      measure: { type: "count", field_key: null, aggregation: null, display: "pct_col" },
    }),
  },
}

export const StackedNestedToggle: Story = {
  name: "Zone with Stacked/Nested toggle visible",
  args: {
    query: withFields({
      dataset_id: 1,
      rows: [
        { field_key: "gender", display_name: "Gender", field_type: "categorical" },
        { field_key: "age_group", display_name: "Age Group", field_type: "ordinal" },
        { field_key: "region", display_name: "Region", field_type: "categorical" },
      ],
      row_mode: "stacked",
    }),
  },
}

export const TrendMode: Story = {
  name: "Trending mode — fields + breakdown",
  args: {
    query: withFields({
      mode: "trend",
      collection_id: 1,
      rows: [{ field_key: "satisfaction", display_name: "Satisfaction", field_type: "ordinal" }],
      breakdown: { field_key: "gender", display_name: "Gender", field_type: "categorical" },
      measure: { type: "count", field_key: null, aggregation: null, display: "pct_col" },
    }),
  },
}

export const Loading: Story = {
  name: "Run button — loading state",
  args: { query: withFields({ dataset_id: 1 }) },
  // To see loading state: click Run Query in Storybook (will attempt real API call and show loading briefly)
}

export const WithError: Story = {
  name: "Error state",
  // Render the panel with no dataset so clicking Run triggers the validation error
  args: { query: withFields({ dataset_id: null }) },
}

export const WithPopulatedZones: Story = {
  name: "Populated zones — drag handles visible",
  args: {
    query: withFields({
      dataset_id: 1,
      rows: [
        {
          field_key: "brand_awareness",
          display_name: "Brand Awareness",
          field_type: "multi_response",
        },
        { field_key: "age_group", display_name: "Age Group", field_type: "ordinal" },
      ],
      columns: [{ field_key: "gender", display_name: "Gender", field_type: "categorical" }],
      measure: { type: "count", field_key: null, aggregation: null, display: "pct_col" },
    }),
  },
}

export const DragOverHighlight: Story = {
  name: "Drag-over highlight — zone glow + ghost chip",
  args: {
    query: withFields({
      dataset_id: 1,
      rows: [{ field_key: "gender", display_name: "Gender", field_type: "categorical" }],
      columns: [],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chip = await canvas.findByTestId("field-chip-gender")
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: chip },
      { coords: { clientX: 20, clientY: 0 } },
    ])
  },
}
