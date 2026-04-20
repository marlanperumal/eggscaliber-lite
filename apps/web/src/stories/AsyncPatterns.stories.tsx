import type { Meta, StoryObj } from "@storybook/nextjs-vite"

interface DataCardProps {
  isLoading?: boolean
  data?: { label: string; value: number }[]
  error?: string
}

function DataCard({ isLoading, data, error }: DataCardProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading data"
        aria-busy="true"
        className="flex h-32 w-64 items-center justify-center rounded-md border border-border bg-card"
      >
        <span className="text-muted-foreground text-sm">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex h-32 w-64 flex-col items-center justify-center gap-2 rounded-md border border-border bg-card p-4"
      >
        <span className="text-[--warning] text-sm">{error}</span>
        <button type="button" className="text-muted-foreground text-xs underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="w-64 rounded-md border border-border bg-card p-4">
      <ul className="space-y-1">
        {(data ?? []).map(({ label, value }) => (
          <li key={label} className="flex justify-between text-foreground text-sm">
            <span>{label}</span>
            <span className="text-muted-foreground">{value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const meta = {
  title: "Patterns/AsyncDataCard",
  component: DataCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof DataCard>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { isLoading: true },
}

export const Success: Story = {
  args: {
    data: [
      { label: "Strongly agree", value: 32 },
      { label: "Agree", value: 41 },
      { label: "Neutral", value: 15 },
      { label: "Disagree", value: 8 },
      { label: "Strongly disagree", value: 4 },
    ],
  },
}

export const ErrorState: Story = {
  args: { error: "Failed to load — please retry." },
}

export const Empty: Story = {
  args: { data: [] },
}
