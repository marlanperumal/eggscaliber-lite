import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { WizardShell } from "./WizardShell"

const meta: Meta<typeof WizardShell> = {
  title: "Datasets/Upload/WizardShell",
  component: WizardShell,
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof WizardShell>

// Step 1 — initial state, no session yet
export const AtStep1: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/datasets/upload", searchParams: new URLSearchParams("step=1") },
    },
  },
}

// Step 4 — reconciliation skipped (new collection upload)
export const AtStep4ReconcileSkipped: Story = {
  name: "Step 4 (step 3 skipped — new collection)",
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=4&session=1&reconcile=0"),
      },
    },
  },
}

// Step 5 — all steps done
export const AtStep5: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/datasets/upload",
        searchParams: new URLSearchParams("step=5&session=1&reconcile=1"),
      },
    },
  },
}
