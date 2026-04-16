import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnalyticsPreviewIllustration } from "./AnalyticsPreviewIllustration"

export function HomePage() {
  return (
    <div className="flex h-full items-center justify-center px-8 py-12">
      <div className="grid w-full max-w-5xl items-center gap-16 md:grid-cols-2">
        {/* Left: text + CTA */}
        <div className="flex flex-col gap-4">
          <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
            Data analysis platform
          </p>
          <h1 className="font-bold text-4xl text-foreground tracking-tight">
            Survey insights,
            <br />
            without the code
          </h1>
          <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
            Cross-tab, trend, and breakdown analysis across datasets. Configure queries visually,
            get results instantly.
          </p>
          <div className="mt-2">
            <Button asChild size="lg">
              <Link href="/analytics">Open Analytics →</Link>
            </Button>
          </div>
        </div>

        {/* Right: analytics preview illustration — hidden on narrow viewports */}
        <div className="hidden justify-center md:flex">
          <div className="w-full rounded-xl border border-border bg-card p-4 shadow-md">
            <AnalyticsPreviewIllustration />
          </div>
        </div>
      </div>
    </div>
  )
}
