import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import type { WizardState, WizardStep } from "../wizard-types"
import { FileHierarchy } from "./FileHierarchy"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

vi.mock("@/lib/mutate", () => ({
  mutate: vi.fn((fn, _opts) =>
    fn().then((r: { data: unknown; error: unknown }) => ({ data: r.data, error: r.error })),
  ),
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

const PACKAGES = [{ id: 1, name: "Demo Package" }]
const PACKAGE_WITH_COLS = {
  id: 1,
  name: "Demo Package",
  collections: [{ id: 10, name: "Brand Tracker" }],
}

function renderStep(
  overrides: {
    setStep?: ReturnType<typeof vi.fn>
    setSessionId?: ReturnType<typeof vi.fn>
    setNeedsReconcile?: ReturnType<typeof vi.fn>
  } = {},
) {
  const setStep = overrides.setStep ?? vi.fn()
  const setSessionId = overrides.setSessionId ?? vi.fn()
  const setNeedsReconcile = overrides.setNeedsReconcile ?? vi.fn()
  const state: WizardState = { step: 1, sessionId: null, needsReconcile: false }
  render(
    <FileHierarchy
      state={state}
      setStep={setStep as unknown as (s: WizardStep) => void}
      setSessionId={setSessionId as unknown as (id: number) => void}
      setNeedsReconcile={setNeedsReconcile as unknown as (v: boolean) => void}
    />,
  )
  return { setStep, setSessionId, setNeedsReconcile }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockImplementation(async (path) => {
    if ((path as string).includes("{package_id}")) {
      return { data: PACKAGE_WITH_COLS } as never
    }
    return { data: PACKAGES } as never
  })
})

it("Next button is disabled before file and hierarchy are selected", async () => {
  renderStep()
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "Demo Package" })).toBeInTheDocument(),
  )
  expect(screen.getByRole("button", { name: /next/i })).toBeDisabled()
})

it("shows new package form when '+ New package…' is selected", async () => {
  renderStep()
  await waitFor(() => screen.getByRole("option", { name: "Demo Package" }))
  await userEvent.selectOptions(
    screen.getByLabelText("Package *"),
    screen.getByText("+ New package…"),
  )
  expect(screen.getByPlaceholderText(/package name/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
})

it("creates package via POST and adds it to the dropdown", async () => {
  mockPost.mockResolvedValueOnce({ data: { id: 88, name: "New Pkg" } } as never)
  renderStep()
  await waitFor(() => screen.getByRole("option", { name: "Demo Package" }))
  await userEvent.selectOptions(
    screen.getByLabelText("Package *"),
    screen.getByText("+ New package…"),
  )
  await userEvent.type(screen.getByPlaceholderText(/package name/i), "New Pkg")
  await userEvent.click(screen.getByRole("button", { name: "Create" }))
  await waitFor(() => expect(screen.getByRole("option", { name: "New Pkg" })).toBeInTheDocument())
  expect(mockPost).toHaveBeenCalledWith(
    "/api/v1/packages",
    expect.objectContaining({ body: expect.objectContaining({ name: "New Pkg" }) }),
  )
})

it("sets needsReconcile to false when a new collection is created", async () => {
  mockPost.mockResolvedValueOnce({ data: { id: 99, name: "New Col" } } as never)
  const { setNeedsReconcile } = renderStep()
  await waitFor(() => screen.getByRole("option", { name: "Demo Package" }))
  await userEvent.selectOptions(screen.getByLabelText("Package *"), "1")
  await waitFor(() => screen.getByRole("option", { name: "Brand Tracker" }))
  await userEvent.selectOptions(
    screen.getByLabelText("Collection *"),
    screen.getByText("+ New collection…"),
  )
  await userEvent.type(screen.getByPlaceholderText(/collection name/i), "New Col")
  await userEvent.click(screen.getByRole("button", { name: "Create" }))
  await waitFor(() => expect(setNeedsReconcile).toHaveBeenCalledWith(false))
})

it("calls upload API and advances to step 2 on successful Next", async () => {
  mockPost.mockResolvedValueOnce({ data: { id: 42 } } as never)
  const { setStep, setSessionId, setNeedsReconcile } = renderStep()
  await waitFor(() => screen.getByRole("option", { name: "Demo Package" }))
  const csvFile = new File(["col1,col2\n1,2"], "survey.csv", { type: "text/csv" })
  await userEvent.upload(screen.getByLabelText("Choose CSV file"), csvFile)
  await userEvent.selectOptions(screen.getByLabelText("Package *"), "1")
  await waitFor(() => screen.getByRole("option", { name: "Brand Tracker" }))
  await userEvent.selectOptions(screen.getByLabelText("Collection *"), "10")
  fireEvent.change(screen.getByLabelText("Collection date *"), { target: { value: "2024-01" } })
  await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled())
  await userEvent.click(screen.getByRole("button", { name: /next/i }))
  await waitFor(() => expect(setStep).toHaveBeenCalledWith(2))
  expect(setSessionId).toHaveBeenCalledWith(42)
  expect(setNeedsReconcile).toHaveBeenCalledWith(true)
})

it("shows an error message when upload POST fails", async () => {
  mockPost.mockResolvedValueOnce({ data: null, error: { detail: "Bad file" } } as never)
  const { setStep } = renderStep()
  await waitFor(() => screen.getByRole("option", { name: "Demo Package" }))
  const csvFile = new File(["col1\n1"], "survey.csv", { type: "text/csv" })
  await userEvent.upload(screen.getByLabelText("Choose CSV file"), csvFile)
  await userEvent.selectOptions(screen.getByLabelText("Package *"), "1")
  await waitFor(() => screen.getByRole("option", { name: "Brand Tracker" }))
  await userEvent.selectOptions(screen.getByLabelText("Collection *"), "10")
  fireEvent.change(screen.getByLabelText("Collection date *"), { target: { value: "2024-01" } })
  await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled())
  await userEvent.click(screen.getByRole("button", { name: /next/i }))
  await waitFor(() =>
    expect(mutate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ errorMessage: "Upload failed. Please try again." }),
    ),
  )
  expect(setStep).not.toHaveBeenCalledWith(2)
})
