import { api } from "@/lib/api"
import {
  type DatasetItem,
  DatasetsPageContent,
  type DraftItem,
  type Package,
} from "./DatasetsPageContent"

export async function DatasetsPage() {
  const [packagesRes, uploadsRes, datasetsRes] = await Promise.all([
    api.GET("/api/v1/packages"),
    api.GET("/api/v1/uploads"),
    api.GET("/api/v1/datasets", { params: { query: {} } }),
  ])

  const initialPackages: Package[] = packagesRes.data ?? []
  const initialDrafts: DraftItem[] = uploadsRes.data?.items ?? []
  const initialDatasets: DatasetItem[] = datasetsRes.data?.items ?? []

  return (
    <DatasetsPageContent
      initialPackages={initialPackages}
      initialDrafts={initialDrafts}
      initialDatasets={initialDatasets}
    />
  )
}
