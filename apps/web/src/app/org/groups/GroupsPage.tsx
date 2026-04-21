"use client"

import type { components } from "@shared/api"
import { useState } from "react"
import { GroupsList } from "./GroupsList"
import { MembersPanel } from "./MembersPanel"
import { PackagesPanel } from "./PackagesPanel"

type GroupWithCounts = components["schemas"]["GroupWithCounts"]

export function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCounts | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-foreground text-lg">Groups</h1>
        <p className="text-muted-foreground text-sm">
          Manage groups and their access to packages for your organisation.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-4">
        <GroupsList selectedGroupId={selectedGroup?.id ?? null} onSelect={setSelectedGroup} />
        <MembersPanel
          groupId={selectedGroup?.id ?? null}
          isDefault={selectedGroup?.is_default ?? false}
        />
        <PackagesPanel groupId={selectedGroup?.id ?? null} />
      </div>
    </div>
  )
}
