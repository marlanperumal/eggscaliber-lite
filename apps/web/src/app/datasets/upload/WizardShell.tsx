"use client"
import { Step1FileHierarchy } from "./steps/Step1FileHierarchy"
import { Step2FieldDetection } from "./steps/Step2FieldDetection"
import { Step3Reconciliation } from "./steps/Step3Reconciliation"
import { Step4MetadataEditor } from "./steps/Step4MetadataEditor"
import { Step5ReviewCommit } from "./steps/Step5ReviewCommit"
import { useWizardState } from "./useWizardState"
import { STEP_LABELS, type WizardStep } from "./wizard-types"

const STEPS = [1, 2, 3, 4, 5] as const

function StepIndicator({
  current,
  needsReconcile,
}: {
  current: WizardStep
  needsReconcile: boolean
}) {
  return (
    <div className="mb-6 flex">
      {STEPS.map((s) => {
        const isSkipped = s === 3 && !needsReconcile
        return (
          <div
            key={s}
            className={[
              "flex-1 border-b-2 pb-2 text-center font-semibold text-xs",
              isSkipped
                ? "border-border text-muted-foreground line-through opacity-30"
                : s === current
                  ? "border-accent text-accent"
                  : s < current
                    ? "border-accent text-muted-foreground opacity-50"
                    : "border-border text-muted-foreground",
            ].join(" ")}
          >
            {s}. {STEP_LABELS[s]}
          </div>
        )
      })}
    </div>
  )
}

export function WizardShell() {
  const { state, setStep, setSessionId, setNeedsReconcile } = useWizardState()

  const stepProps = { state, setStep, setSessionId, setNeedsReconcile }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 font-bold text-foreground text-xl">Upload dataset</h1>
      <StepIndicator current={state.step} needsReconcile={state.needsReconcile} />
      <StepContent {...stepProps} />
    </div>
  )
}

function StepContent(props: ReturnType<typeof useWizardState>) {
  const { state, setStep, setSessionId, setNeedsReconcile } = props
  if (state.step === 1) {
    return (
      <Step1FileHierarchy
        state={state}
        setStep={setStep}
        setSessionId={setSessionId}
        setNeedsReconcile={setNeedsReconcile}
      />
    )
  }
  if (state.step === 2) {
    return <Step2FieldDetection state={state} setStep={setStep} />
  }
  if (state.step === 3) {
    return <Step3Reconciliation state={state} setStep={setStep} />
  }
  if (state.step === 4) {
    return <Step4MetadataEditor state={state} setStep={setStep} />
  }
  if (state.step === 5) {
    return <Step5ReviewCommit state={state} setStep={setStep} />
  }
  return (
    <div className="rounded-lg border border-border p-6">
      <p className="text-muted-foreground text-sm">Step {state.step} — coming soon.</p>
    </div>
  )
}
