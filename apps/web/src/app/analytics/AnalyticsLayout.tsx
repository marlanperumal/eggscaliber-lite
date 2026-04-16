"use client"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useCallback, useState } from "react"
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  type PanelSize,
  Separator,
  usePanelRef,
} from "react-resizable-panels"
import type { AnalyticsResult, QueryConfig } from "./analytics-types"
import { FIELD_TYPE_CONFIG } from "./analytics-types"
import { FieldTreePanel } from "./FieldTreePanel"
import { QueryBuilderPanel } from "./QueryBuilderPanel"
import { ResultsPanel } from "./ResultsPanel"
import { useAnalyticsState } from "./useAnalyticsState"
import { useDragAndDrop } from "./useDragAndDrop"

const COLLAPSED_SIZE = 3

export function AnalyticsLayout() {
  const { query, setQuery } = useAnalyticsState()
  const [result, setResult] = useState<AnalyticsResult | null>(null)
  const [lastRunQuery, setLastRunQuery] = useState<QueryConfig | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [treeCollapsed, setTreeCollapsed] = useState(false)
  const [builderCollapsed, setBuilderCollapsed] = useState(false)

  const treeRef = usePanelRef()
  const builderRef = usePanelRef()

  const onTreeResize = useCallback((size: PanelSize) => {
    setTreeCollapsed(size.asPercentage <= COLLAPSED_SIZE)
  }, [])

  const onBuilderResize = useCallback((size: PanelSize) => {
    setBuilderCollapsed(size.asPercentage <= COLLAPSED_SIZE)
  }, [])

  const toggleTree = useCallback(() => {
    const handle: PanelImperativeHandle | null = treeRef.current ?? null
    if (treeCollapsed) {
      handle?.expand()
    } else {
      handle?.collapse()
    }
  }, [treeRef, treeCollapsed])

  const toggleBuilder = useCallback(() => {
    const handle: PanelImperativeHandle | null = builderRef.current ?? null
    if (builderCollapsed) {
      handle?.expand()
    } else {
      handle?.collapse()
    }
  }, [builderRef, builderCollapsed])

  const handleQueryChange = useCallback(
    (updater: QueryConfig | ((prev: QueryConfig | null) => QueryConfig)) => {
      setQuery(typeof updater === "function" ? (prev) => updater(prev) : updater)
    },
    [setQuery],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { activeDrag, onDragStart, onDragOver, onDragEnd, onDragCancel } = useDragAndDrop({
    query,
    onQueryChange: handleQueryChange,
  })

  return (
    <div className="flex h-full flex-col bg-muted">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <Group orientation="horizontal" className="flex-1 p-2">
          <Panel
            panelRef={treeRef}
            defaultSize={20}
            minSize={3}
            collapsible
            collapsedSize={COLLAPSED_SIZE}
            onResize={onTreeResize}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              {treeCollapsed ? (
                <CollapsedStrip label="Fields" onClick={toggleTree} />
              ) : (
                <FieldTreePanel
                  onCollapse={toggleTree}
                  query={query}
                  onQueryChange={handleQueryChange}
                />
              )}
            </div>
          </Panel>
          <Separator className="w-2 cursor-col-resize bg-muted transition-colors hover:bg-primary/20" />
          <Panel
            panelRef={builderRef}
            defaultSize={25}
            minSize={3}
            collapsible
            collapsedSize={COLLAPSED_SIZE}
            onResize={onBuilderResize}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              {builderCollapsed ? (
                <CollapsedStrip label="Query" onClick={toggleBuilder} />
              ) : (
                <QueryBuilderPanel
                  onCollapse={toggleBuilder}
                  query={query}
                  onQueryChange={handleQueryChange}
                  isLoading={isRunning}
                  onLoadingChange={setIsRunning}
                  onResult={(r, q) => {
                    setResult(r)
                    setLastRunQuery(q)
                  }}
                />
              )}
            </div>
          </Panel>
          <Separator className="w-2 cursor-col-resize bg-muted transition-colors hover:bg-primary/20" />
          <Panel defaultSize={55} minSize={20}>
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              <ResultsPanel
                result={result}
                query={query}
                lastRunQuery={lastRunQuery}
                isLoading={isRunning}
              />
            </div>
          </Panel>
        </Group>
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <GhostChip displayName={activeDrag.displayName} fieldType={activeDrag.fieldType} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── GhostChip ─────────────────────────────────────────────────────────────

function GhostChip({
  displayName,
  fieldType,
}: {
  displayName: string | undefined
  fieldType: string | undefined
}) {
  const typeConfig = fieldType ? FIELD_TYPE_CONFIG[fieldType] : null
  return (
    <div className="flex cursor-grabbing items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary opacity-90 shadow-lg">
      {typeConfig ? (
        <span
          className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full font-black text-[8px] text-primary-foreground"
          style={{ background: typeConfig.color }}
        >
          {typeConfig.icon}
        </span>
      ) : (
        <span className="h-[18px] w-[18px] flex-shrink-0 rounded-full bg-muted" />
      )}
      <span>{displayName ?? "Field"}</span>
    </div>
  )
}

function CollapsedStrip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full cursor-pointer items-center justify-center transition-colors hover:bg-muted/60"
    >
      <span
        className="font-medium text-muted-foreground text-xs tracking-widest"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {label}
      </span>
    </button>
  )
}
