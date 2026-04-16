import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HomePage } from "./HomePage"

describe("HomePage", () => {
  it("renders a link to /analytics", () => {
    render(<HomePage />)
    const link = screen.getByRole("link", { name: /open analytics/i })
    expect(link).toHaveAttribute("href", "/analytics")
  })
})
