import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { TokenListRow } from "./TokenListRow"

const onRevoke = vi.fn<(id: number) => Promise<void>>()

beforeEach(() => {
  onRevoke.mockReset()
  onRevoke.mockResolvedValue(undefined)
})

function renderRow() {
  render(
    <TokenListRow
      id={42}
      name="Claude Desktop"
      prefix="ek_abc123"
      createdAt={new Date(Date.now() - 60_000).toISOString()}
      lastUsedAt={null}
      onRevoke={onRevoke}
    />,
  )
}

it("renders token name and masked prefix", () => {
  renderRow()
  expect(screen.getByText("Claude Desktop")).toBeInTheDocument()
  expect(screen.getByText(/ek_abc123/)).toBeInTheDocument()
})

it("expand toggle shows config snippets", async () => {
  const user = userEvent.setup()
  renderRow()
  expect(screen.queryByTestId("token-config-snippets")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: /config/i }))
  expect(screen.getByTestId("token-config-snippets")).toBeInTheDocument()
})

it("clicking revoke then confirming fires the callback", async () => {
  const user = userEvent.setup()
  renderRow()
  const row = screen.getByTestId("token-row")
  await user.click(within(row).getByRole("button", { name: /revoke token claude desktop/i }))
  // Alert dialog now open — click the destructive Revoke action
  await user.click(screen.getByRole("button", { name: "Revoke" }))
  expect(onRevoke).toHaveBeenCalledWith(42)
})
