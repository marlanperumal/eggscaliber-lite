export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface WizardState {
  step: WizardStep
  sessionId: number | null
  /** true when collection already has datasets — triggers reconciliation step */
  needsReconcile: boolean
}

export const STEP_LABELS: Record<WizardStep, string> = {
  1: "File & Hierarchy",
  2: "Field Detection",
  3: "Reconciliation",
  4: "Metadata",
  5: "Review & Commit",
}
