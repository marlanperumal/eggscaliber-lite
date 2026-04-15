import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HomePage } from "./HomePage"

describe("HomePage", () => {
  it("renders the headline", () => {
    render(<HomePage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /survey insights.*without the code/i,
    )
  })

  it("renders the eyebrow label", () => {
    render(<HomePage />)
    expect(screen.getByText(/data analysis platform/i)).toBeInTheDocument()
  })

  it("renders the body description", () => {
    render(<HomePage />)
    expect(screen.getByText(/cross-tab, trend, and breakdown analysis/i)).toBeInTheDocument()
  })

  it("renders a link to /analytics", () => {
    render(<HomePage />)
    const link = screen.getByRole("link", { name: /open analytics/i })
    expect(link).toHaveAttribute("href", "/analytics")
  })
})
