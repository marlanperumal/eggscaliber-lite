"use client"
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
import { FieldTreePanel } from "./FieldTreePanel"
import { QueryBuilderPanel } from "./QueryBuilderPanel"
import { ResultsPanel } from "./ResultsPanel"
import { useAnalyticsState } from "./useAnalyticsState"

const COLLAPSED_SIZE = 3

export function AnalyticsLayout() {
  const { query, setQuery } = useAnalyticsState()
  const [result, setResult] = useState<AnalyticsResult | null>(null)
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

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">Analytics</h1>
      </div>
      <Group orientation="horizontal" className="flex-1">
        <Panel
          panelRef={treeRef}
          defaultSize={20}
          minSize={3}
          collapsible
          collapsedSize={COLLAPSED_SIZE}
          onResize={onTreeResize}
        >
          {treeCollapsed ? (
            <CollapsedStrip label="Fields" onClick={toggleTree} />
          ) : (
            <FieldTreePanel
              onCollapse={toggleTree}
              query={query}
              onQueryChange={handleQueryChange}
            />
          )}
        </Panel>
        <Separator className="w-1 bg-border transition-colors hover:bg-primary/30" />
        <Panel
          panelRef={builderRef}
          defaultSize={25}
          minSize={3}
          collapsible
          collapsedSize={COLLAPSED_SIZE}
          onResize={onBuilderResize}
        >
          {builderCollapsed ? (
            <CollapsedStrip label="Query" onClick={toggleBuilder} />
          ) : (
            <QueryBuilderPanel
              onCollapse={toggleBuilder}
              query={query}
              onQueryChange={handleQueryChange}
              onResult={setResult}
            />
          )}
        </Panel>
        <Separator className="w-1 bg-border transition-colors hover:bg-primary/30" />
        <Panel defaultSize={55} minSize={20}>
          <ResultsPanel result={result} query={query} />
        </Panel>
      </Group>
    </div>
  )
}

function CollapsedStrip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full cursor-pointer items-center justify-center bg-muted/30 transition-colors hover:bg-muted/60"
    >
      <span
        className="text-xs font-medium tracking-widest text-muted-foreground"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {label}
      </span>
    </button>
  )
}
