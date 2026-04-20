import type { UIMessage } from "@ai-sdk/react"
import type { AICrosstabResultPart, AITrendResultPart } from "./ai-types"
import { InlineResult } from "./InlineResult"

interface Props {
  message: UIMessage
}

type ResultPartWithIndex = {
  part: AICrosstabResultPart | AITrendResultPart
  key: string
}

export function AssistantMessage({ message }: Props) {
  const textContent = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("")

  const resultParts: ResultPartWithIndex[] = message.parts
    .filter((p) => p.type === "data-crosstab_result" || p.type === "data-trend_result")
    .map((p, i) => ({
      part: (p as unknown as { data: AICrosstabResultPart | AITrendResultPart }).data,
      key: `${p.type}-${i}`,
    }))

  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-wrap text-sm">{textContent}</p>
      {resultParts.map(({ part, key }) => (
        <InlineResult key={key} part={part} />
      ))}
    </div>
  )
}
