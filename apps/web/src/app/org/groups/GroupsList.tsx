"use client"

import type { components } from "@shared/api"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

type Group = components["schemas"]["GroupWithCounts"]

interface Props {
  selectedGroupId: number | null
  onSelect: (id: number) => void
}

export function GroupsList({ selectedGroupId, onSelect }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.GET("/api/v1/groups").then(({ data }) => {
      if (data) setGroups(data)
    })
  }, [])

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div
      data-testid="groups-list"
      className="flex flex-col rounded-lg border border-border bg-card"
    >
      <div className="flex items-center justify-between border-border border-b px-4 py-3">
        <span className="font-semibold text-foreground text-sm">Groups</span>
        <Button size="sm" variant="default">
          + New Group
        </Button>
      </div>
      <div className="border-border border-b p-2">
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((g) => (
          <button
            key={g.id}
            type="button"
            data-testid={`group-row-${g.id}`}
            onClick={() => onSelect(g.id)}
            className={`flex w-full items-center gap-2 border-border border-b px-4 py-2 text-left text-sm transition-colors last:border-b-0 ${
              selectedGroupId === g.id
                ? "border-l-2 border-l-[--primary] bg-primary/10 font-semibold text-foreground"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="flex-1 font-mono">{g.name}</span>
            {g.is_default && <span className="text-muted-foreground text-xs">default</span>}
            <span className="font-mono text-muted-foreground text-xs">{g.member_count}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-1 items-center justify-center px-4 py-8">
            <p className="text-muted-foreground text-sm opacity-60">
              {search ? "No groups match your search" : "No groups yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
