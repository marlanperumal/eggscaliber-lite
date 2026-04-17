import { Suspense } from "react"
import { WizardShell } from "./WizardShell"

export const metadata = { title: "Upload dataset" }

export default function Page() {
  return (
    <Suspense>
      <WizardShell />
    </Suspense>
  )
}
