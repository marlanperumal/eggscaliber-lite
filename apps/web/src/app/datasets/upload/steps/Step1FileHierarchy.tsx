"use client"
import { useRef, useState } from "react"
import type { WizardState, WizardStep } from "../wizard-types"

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
  setSessionId: (id: number) => void
  setNeedsReconcile: (v: boolean) => void
}

export function Step1FileHierarchy({ setStep, setSessionId, setNeedsReconcile }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState("")
  const [collectionId, setCollectionId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const canProceed = file !== null && datasetName.trim().length > 0

  async function handleNext() {
    if (!file || !canProceed) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append("file", file)
    form.append("dataset_name", datasetName)
    if (collectionId) form.append("collection_id", collectionId)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/uploads`,
        { method: "POST", body: form },
      )
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSessionId(data.id)
      setNeedsReconcile(Boolean(collectionId))
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith(".csv")) setFile(f)
  }

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-base text-foreground">Step 1 — File &amp; Hierarchy</h2>

      {/* Drop zone */}
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="w-full cursor-pointer rounded-lg border-2 border-border border-dashed p-10 text-center hover:border-accent"
        data-testid="drop-zone"
        aria-label="Drop a CSV file here or click to browse"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label="Choose CSV file"
        />
        {file ? (
          <p className="font-medium text-foreground text-sm">{file.name}</p>
        ) : (
          <>
            <p className="font-medium text-muted-foreground text-sm">
              Drag a CSV here or click to browse
            </p>
            <p className="mt-1 text-muted-foreground text-xs">Accepts .csv</p>
          </>
        )}
      </button>

      {/* Metadata fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="mb-1 block font-semibold text-muted-foreground text-xs"
            htmlFor="dataset-name"
          >
            Dataset name *
          </label>
          <input
            id="dataset-name"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="e.g. Wave 3"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label
            className="mb-1 block font-semibold text-muted-foreground text-xs"
            htmlFor="collection-id"
          >
            Collection ID (optional)
          </label>
          <input
            id="collection-id"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            placeholder="ID of existing collection"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || busy}
          className="rounded-lg bg-accent px-6 py-2 font-semibold text-sm text-white disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Next →"}
        </button>
      </div>
    </div>
  )
}
