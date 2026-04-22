import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { GenerateTokenForm } from "./GenerateTokenForm"

const onGenerate = vi.fn<(name: string) => Promise<void>>()
const onCancel = vi.fn<() => void>()

beforeEach(() => {
  onGenerate.mockReset()
  onGenerate.mockResolvedValue(undefined)
  onCancel.mockClear()
})

it("submitting empty name shows inline error and does not call onGenerate", async () => {
  const user = userEvent.setup()
  render(<GenerateTokenForm onGenerate={onGenerate} onCancel={onCancel} />)
  await user.click(screen.getByRole("button", { name: "Generate" }))
  expect(screen.getByText("Token name is required")).toBeInTheDocument()
  expect(onGenerate).not.toHaveBeenCalled()
})

it("submitting valid name calls onGenerate with trimmed name", async () => {
  const user = userEvent.setup()
  render(<GenerateTokenForm onGenerate={onGenerate} onCancel={onCancel} />)
  await user.type(screen.getByLabelText("Token name"), "  My Token  ")
  await user.click(screen.getByRole("button", { name: "Generate" }))
  expect(onGenerate).toHaveBeenCalledWith("My Token")
})

it("while isLoading is true the submit button is disabled", () => {
  render(<GenerateTokenForm onGenerate={onGenerate} onCancel={onCancel} isLoading />)
  const submit = screen.getByRole("button", { name: "Generating…" })
  expect(submit).toBeDisabled()
})
