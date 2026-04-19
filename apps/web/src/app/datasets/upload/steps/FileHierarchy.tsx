"use client"
import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
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

const NEW_SENTINEL = "__new__"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function FileHierarchy({ setStep, setSessionId, setNeedsReconcile }: Props) {
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

  const [showNewPkg, setShowNewPkg] = useState(false)
  const [newPkgName, setNewPkgName] = useState("")
  const [showNewCol, setShowNewCol] = useState(false)
  const [newColName, setNewColName] = useState("")
  const [rowCount, setRowCount] = useState<number | null>(null)

  useEffect(() => {
    api.GET("/api/v1/packages").then(({ data }) => {
      if (data) setPackages(data)
    })
  }, [])

  useEffect(() => {
    if (!selectedPackageId || selectedPackageId === NEW_SENTINEL) {
      setCollections([])
      setSelectedCollectionId("")
      return
    }
    api
      .GET("/api/v1/packages/{package_id}", {
        params: { path: { package_id: Number(selectedPackageId) } },
      })
      .then(({ data }) => {
        if (data) setCollections(data.collections ?? [])
      })
    setSelectedCollectionId("")
  }, [selectedPackageId])

  function handlePackageChange(value: string) {
    if (value === NEW_SENTINEL) {
      setShowNewPkg(true)
      setSelectedPackageId("")
    } else {
      setShowNewPkg(false)
      setSelectedPackageId(value)
    }
  }

  function handleCollectionChange(value: string) {
    if (value === NEW_SENTINEL) {
      setShowNewCol(true)
      setSelectedCollectionId("")
    } else {
      setShowNewCol(false)
      setSelectedCollectionId(value)
    }
  }

  async function createPackage() {
    if (!newPkgName.trim()) return
    setBusy(true)
    try {
      const { data: pkg } = await api.POST("/api/v1/packages", {
        body: { name: newPkgName.trim(), slug: slugify(newPkgName.trim()) },
      })
      if (!pkg) throw new Error("Failed to create package")
      setPackages((prev) => [...prev, { id: pkg.id, name: pkg.name }])
      setSelectedPackageId(String(pkg.id))
      setShowNewPkg(false)
      setNewPkgName("")
    } finally {
      setBusy(false)
    }
  }

  async function createCollection() {
    if (!newColName.trim() || !selectedPackageId) return
    setBusy(true)
    try {
      const { data: col } = await api.POST("/api/v1/collections", {
        body: {
          name: newColName.trim(),
          slug: slugify(newColName.trim()),
          package_id: Number(selectedPackageId),
          collection_type: "generic",
        },
      })
      if (!col) throw new Error("Failed to create collection")
      setCollections((prev) => [...prev, { id: col.id, name: col.name }])
      setSelectedCollectionId(String(col.id))
      setShowNewCol(false)
      setNewColName("")
      setNeedsReconcile(false)
    } finally {
      setBusy(false)
    }
  }

  function handleFileChange(f: File | null) {
    setFile(f)
    setRowCount(null)
    if (f && !datasetName) {
      setDatasetName(f.name.replace(/\.[^.]+$/, ""))
    }
    if (f) {
      f.text().then((text) => {
        const lines = text.split("\n").filter((l) => l.trim().length > 0)
        setRowCount(Math.max(0, lines.length - 1))
      })
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      const { data, error } = await api.POST("/api/v1/uploads", { body: form as never })
      if (error || !data) throw new Error(JSON.stringify(error))
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
          <div>
            <p className="font-medium text-foreground text-sm">{file.name}</p>
            <p className="mt-1 text-muted-foreground text-xs">
              {formatFileSize(file.size)}
              {rowCount !== null && ` · ~${rowCount.toLocaleString()} rows`}
            </p>
          </div>
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
            onChange={(e) => handlePackageChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Select package…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={NEW_SENTINEL}>+ New package…</option>
          </select>
          {showNewPkg && (
            <div className="mt-2 flex gap-2">
              <input
                value={newPkgName}
                onChange={(e) => setNewPkgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createPackage()}
                placeholder="Package name"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={createPackage}
                disabled={!newPkgName.trim() || busy}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewPkg(false)
                  setNewPkgName("")
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          )}
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
            onChange={(e) => handleCollectionChange(e.target.value)}
            disabled={!selectedPackageId}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
          >
            <option value="">Select collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {selectedPackageId && <option value={NEW_SENTINEL}>+ New collection…</option>}
          </select>
          {showNewCol && (
            <div className="mt-2 flex gap-2">
              <input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCollection()}
                placeholder="Collection name"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={createCollection}
                disabled={!newColName.trim() || busy}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewCol(false)
                  setNewColName("")
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          )}
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
