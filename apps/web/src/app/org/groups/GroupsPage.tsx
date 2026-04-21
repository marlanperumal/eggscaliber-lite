"use client"

import { useState } from "react"
import { GroupsList } from "./GroupsList"
import { MembersPanel } from "./MembersPanel"
import { PackagesPanel } from "./PackagesPanel"

export function GroupsPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-foreground text-lg">Groups</h1>
        <p className="text-muted-foreground text-sm">
          Manage groups and their access to packages for your organisation.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-4">
        <GroupsList selectedGroupId={selectedGroupId} onSelect={setSelectedGroupId} />
        <MembersPanel groupId={selectedGroupId} />
        <PackagesPanel groupId={selectedGroupId} />
      </div>
    </div>
  )
}
