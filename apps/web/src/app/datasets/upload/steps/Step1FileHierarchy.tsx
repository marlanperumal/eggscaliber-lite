"use client"
import { useEffect, useRef, useState } from "react"
import type { WizardState, WizardStep } from "../wizard-types"

interface PackageOption {
  id: number
  name: string
}
interface CollectionOption {
  id: number
  name: string
}

interface Props {
  state: WizardState
  setStep: (s: WizardStep) => void
  setSessionId: (id: number) => void
  setNeedsReconcile: (v: boolean) => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function Step1FileHierarchy({ setStep, setSessionId, setNeedsReconcile }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState("")
  const [collectedAt, setCollectedAt] = useState("")
  const [packages, setPackages] = useState<PackageOption[]>([])
  const [collections, setCollections] = useState<CollectionOption[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>("")
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/packages`)
      .then((r) => r.json())
      .then((data) => setPackages(data))
  }, [])

  useEffect(() => {
    if (!selectedPackageId) {
      setCollections([])
      setSelectedCollectionId("")
      return
    }
    fetch(`${API_BASE}/api/v1/packages/${selectedPackageId}`)
      .then((r) => r.json())
      .then((data) => setCollections(data.collections ?? []))
    setSelectedCollectionId("")
  }, [selectedPackageId])

  function handleFileChange(f: File | null) {
    setFile(f)
    if (f && !datasetName) {
      setDatasetName(f.name.replace(/\.[^.]+$/, ""))
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith(".csv")) handleFileChange(f)
  }

  const canProceed =
    file !== null &&
    datasetName.trim().length > 0 &&
    selectedPackageId !== "" &&
    selectedCollectionId !== "" &&
    collectedAt !== ""

  async function handleNext() {
    if (!file || !canProceed) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append("file", file)
    form.append("dataset_name", datasetName)
    form.append("collection_id", selectedCollectionId)
    form.append("collected_at", `${collectedAt}-01`)
    try {
      const res = await fetch(`${API_BASE}/api/v1/uploads`, { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSessionId(data.id)
      setNeedsReconcile(true)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
    }
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
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
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

      {/* Hierarchy fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="mb-1 block font-semibold text-muted-foreground text-xs"
            htmlFor="pkg-select"
          >
            Package *
          </label>
          <select
            id="pkg-select"
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Select package…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block font-semibold text-muted-foreground text-xs"
            htmlFor="col-select"
          >
            Collection *
          </label>
          <select
            id="col-select"
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            disabled={!selectedPackageId}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          >
            <option value="">Select collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
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
            htmlFor="collected-at"
          >
            Collection date *
          </label>
          <input
            id="collected-at"
            type="month"
            value={collectedAt}
            onChange={(e) => setCollectedAt(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
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
