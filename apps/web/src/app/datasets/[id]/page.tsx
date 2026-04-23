import Link from "next/link"

export const metadata = { title: "Dataset" }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12">
      <Link href="/datasets" className="text-muted-foreground text-sm hover:text-foreground">
        ← Back to datasets
      </Link>
      <div className="rounded-lg border border-border bg-card p-8">
        <h1 className="font-semibold text-foreground text-xl">Dataset detail</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          A dedicated detail view for this dataset is planned as part of Ingestion V2 (sub-project
          15). For now, use the Analytics page to query it.
        </p>
        <p className="mt-4 font-mono text-muted-foreground text-xs">id: {id}</p>
      </div>
    </div>
  )
}
