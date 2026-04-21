"use client"

import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useEffect } from "react"
import { toast } from "sonner"
import { Toaster } from "./sonner"

const meta = {
  title: "UI/Toaster",
  component: Toaster,
  decorators: [
    (Story) => (
      <div style={{ minHeight: "200px", position: "relative" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    return (
      <>
        <Toaster />
        <button
          type="button"
          onClick={() => toast("Event has been created")}
          className="rounded bg-primary px-3 py-1.5 text-primary-foreground text-sm"
        >
          Show toast
        </button>
      </>
    )
  },
}

function ErrorToastDemo() {
  useEffect(() => {
    toast.error("Something went wrong. Please try again.")
  }, [])
  return <Toaster />
}

export const ErrorToast: Story = {
  render: () => <ErrorToastDemo />,
}

function SuccessToastDemo() {
  useEffect(() => {
    toast.success("Changes saved successfully.")
  }, [])
  return <Toaster />
}

export const SuccessToast: Story = {
  render: () => <SuccessToastDemo />,
}

function WarningToastDemo() {
  useEffect(() => {
    toast.warning("Your session is about to expire.")
  }, [])
  return <Toaster />
}

export const WarningToast: Story = {
  render: () => <WarningToastDemo />,
}
