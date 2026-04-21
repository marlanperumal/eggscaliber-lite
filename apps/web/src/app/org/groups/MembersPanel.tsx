"use client"

import { useOrganization } from "@clerk/nextjs"
import type { components } from "@shared/api"
import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"

type GroupMemberRead = components["schemas"]["GroupMemberRead"]
type OrgMemberRead = components["schemas"]["OrgMemberRead"]

interface Props {
  groupId: number | null
  isDefault: boolean
}

export function MembersPanel({ groupId, isDefault }: Props) {
  const { membership } = useOrganization()
  const isAdmin = membership?.role === "org:admin"

  const [members, setMembers] = useState<GroupMemberRead[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMemberRead[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchMembers = useCallback(async (gid: number) => {
    const { data } = await api.GET("/api/v1/groups/{group_id}/members", {
      params: { path: { group_id: gid } },
    })
    if (data) setMembers(data)
  }, [])

  useEffect(() => {
    if (!groupId) {
      setMembers([])
      return
    }
    setIsLoading(true)
    Promise.all([
      fetchMembers(groupId),
      api.GET("/api/v1/org/members").then(({ data }) => {
        if (data) setOrgMembers(data)
      }),
    ]).finally(() => setIsLoading(false))
  }, [groupId, fetchMembers])

  const handleAdd = async (userId: number) => {
    if (!groupId) return
    const { error } = await mutate(
      () =>
        api.POST("/api/v1/groups/{group_id}/members", {
          params: { path: { group_id: groupId } },
          body: { user_id: userId },
        }),
      { errorMessage: "Failed to add member. Please try again." },
    )
    if (error) return
    await fetchMembers(groupId)
    setShowAdd(false)
  }

  const handleRemove = async (userId: number) => {
    if (!groupId) return
    const { error } = await mutate(
      () =>
        api.DELETE("/api/v1/groups/{group_id}/members/{user_id}", {
          params: { path: { group_id: groupId, user_id: userId } },
        }),
      { errorMessage: "Failed to remove member. Please try again." },
    )
    if (error) return
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
  }

  if (!groupId) {
    return (
      <div
        data-testid="members-panel"
        className="flex items-center justify-center rounded-lg border border-border bg-card"
      >
        <p className="text-muted-foreground text-sm opacity-60">Select a group to manage members</p>
      </div>
    )
  }

  const memberUserIds = new Set(members.map((m) => m.user_id))
  const addable = orgMembers.filter((m) => !memberUserIds.has(m.user_id))

  return (
    <div
      data-testid="members-panel"
      className="flex flex-col rounded-lg border border-border bg-card"
    >
      <div className="flex items-center justify-between border-border border-b px-4 py-3">
        <h3 className="font-semibold text-foreground text-sm">Members</h3>
        {isAdmin && !isDefault && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded bg-muted px-2 py-1 text-foreground text-xs hover:bg-muted/70"
          >
            + Add
          </button>
        )}
      </div>

      {showAdd && (
        <div
          data-testid="add-member-panel"
          className="flex flex-col gap-1 border-border border-b bg-muted/30 px-4 py-3"
        >
          <p className="mb-1 text-muted-foreground text-xs">Select org member to add:</p>
          {addable.length === 0 ? (
            <p className="text-muted-foreground text-xs">All members already in this group</p>
          ) : (
            addable.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => handleAdd(m.user_id)}
                className="py-0.5 text-left text-foreground text-sm hover:text-foreground/70"
              >
                {m.email}{" "}
                <span className="text-muted-foreground text-xs capitalize">({m.role})</span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="mt-1 text-muted-foreground text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="px-4 py-3 text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && members.length === 0 && (
          <p className="px-4 py-3 text-muted-foreground text-sm">No members yet</p>
        )}
        {members.map((m) => (
          <div
            key={m.user_id}
            data-testid="member-row"
            className="flex items-center justify-between border-border border-b px-4 py-3"
          >
            <div>
              <p className="text-foreground text-sm">{m.email}</p>
              <p className="text-muted-foreground text-xs capitalize">{m.role}</p>
            </div>
            {isAdmin && !isDefault && (
              <button
                type="button"
                onClick={() => handleRemove(m.user_id)}
                className="shrink-0 text-destructive text-xs hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {isDefault && (
          <p className="px-4 py-2 text-muted-foreground text-xs">
            Default group membership is managed automatically
          </p>
        )}
      </div>
    </div>
  )
}
