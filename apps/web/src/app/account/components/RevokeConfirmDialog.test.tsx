import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { RevokeConfirmDialog } from "./RevokeConfirmDialog"

const onConfirm = vi.fn<() => void>()
const onCancel = vi.fn<() => void>()

beforeEach(() => {
  onConfirm.mockClear()
  onCancel.mockClear()
})

it("default button label is Revoke", () => {
  render(
    <RevokeConfirmDialog
      open
      tokenName="Claude Desktop"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument()
})

it("when isLoading is true the label is Revoking and button is disabled", () => {
  render(
    <RevokeConfirmDialog
      open
      tokenName="Claude Desktop"
      isLoading
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  const btn = screen.getByRole("button", { name: "Revoking…" })
  expect(btn).toBeDisabled()
})

it("clicking Revoke fires the confirm handler", async () => {
  const user = userEvent.setup()
  render(
    <RevokeConfirmDialog
      open
      tokenName="Claude Desktop"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  await user.click(screen.getByRole("button", { name: "Revoke" }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})
