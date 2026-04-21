"use client"

import { useOrganization } from "@clerk/nextjs"
import type { components } from "@shared/api"
import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"

type GroupWithCounts = components["schemas"]["GroupWithCounts"]

interface Props {
  selectedGroupId: number | null
  onSelect: (group: GroupWithCounts | null) => void
}

const PAGE_SIZE = 10

export function GroupsList({ selectedGroupId, onSelect }: Props) {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === "org:admin"

  const [groups, setGroups] = useState<GroupWithCounts[]>([])
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "member_count" | "package_count">("name")
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchGroups = useCallback(async () => {
    const { data } = await api.GET("/api/v1/groups")
    if (data) setGroups(data)
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const filtered = groups
    .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === "name"
        ? a.name.localeCompare(b.name)
        : (b[sortBy] as number) - (a[sortBy] as number),
    )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const { data } = await api.POST("/api/v1/groups", {
      body: { name: newName.trim() },
    })
    if (data) {
      await fetchGroups()
      setShowCreate(false)
      setNewName("")
    }
  }

  const handleDelete = async (groupId: number) => {
    await api.DELETE("/api/v1/groups/{group_id}", {
      params: { path: { group_id: groupId } },
    })
    if (selectedGroupId === groupId) onSelect(null)
    setDeletingId(null)
    await fetchGroups()
  }

  return (
    <div data-testid="groups-list" className="flex h-full flex-col border-border border-r bg-card">
      <div className="flex items-center justify-between gap-2 border-border border-b p-4">
        <input
          aria-label="Search groups"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search groups…"
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-foreground text-sm placeholder:text-muted-foreground"
        />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded bg-primary px-2 py-1 text-primary-foreground text-xs"
          >
            + New
          </button>
        )}
      </div>

      <div className="flex gap-2 border-border border-b px-4 py-2 text-muted-foreground text-xs">
        {(["name", "member_count", "package_count"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSortBy(key)
              setPage(1)
            }}
            className={sortBy === key ? "font-medium text-foreground" : ""}
          >
            {key === "name" ? "Name" : key === "member_count" ? "Members" : "Packages"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {paged.map((g) => (
          <div
            key={g.id}
            data-testid="group-row"
            className={`relative flex items-center justify-between border-border border-b px-4 py-3 hover:bg-muted/50 ${
              g.id === selectedGroupId ? "bg-muted" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(g)}
              className="flex-1 cursor-pointer text-left"
            >
              <p className="font-medium text-foreground text-sm">{g.name}</p>
              <p className="text-muted-foreground text-xs">
                {g.member_count} members · {g.package_count} packages
                {g.is_default && " · Default"}
              </p>
            </button>
            {isAdmin && !g.is_default && (
              <button
                type="button"
                onClick={() => setDeletingId(g.id)}
                className="ml-2 shrink-0 text-destructive text-xs hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {paged.length === 0 && (
          <div className="flex items-center justify-center px-4 py-8">
            <p className="text-muted-foreground text-sm opacity-60">
              {search ? "No groups match your search" : "No groups yet"}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-border border-t px-4 py-2 text-muted-foreground text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {/* TODO: replace with design token overlay when added to theme */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            className="flex w-72 flex-col gap-4 rounded-xl border border-border bg-card p-6"
          >
            <h3 id="create-group-title" className="font-medium text-foreground text-sm">
              New Group
            </h3>
            <input
              aria-label="Group name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name"
              className="rounded border border-border bg-background px-2 py-1 text-foreground text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded bg-primary px-3 py-1 text-primary-foreground text-xs disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {/* TODO: replace with design token overlay when added to theme */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-group-title"
            className="flex w-72 flex-col gap-4 rounded-xl border border-border bg-card p-6"
          >
            <h3 id="delete-group-title" className="sr-only">
              Delete Group
            </h3>
            <p className="text-foreground text-sm">Delete this group? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="text-muted-foreground text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="rounded bg-destructive px-3 py-1 text-destructive-foreground text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
