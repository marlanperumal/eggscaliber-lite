import type { components } from "@shared/api"

export type CrosstabResponse = components["schemas"]["CrosstabResponse"]
export type TrendResponse = components["schemas"]["TrendResponse"]

export interface AICrosstabResultPart {
  type: "crosstab_result"
  query_config: Record<string, unknown>
  data: CrosstabResponse
}

export interface AITrendResultPart {
  type: "trend_result"
  query_config: Record<string, unknown>
  data: TrendResponse
}
