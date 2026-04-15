export function AnalyticsPreviewIllustration() {
  return (
    <svg
      width="100%"
      viewBox="0 0 240 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-muted-foreground"
    >
      {/* Outer frame */}
      <rect
        x="1"
        y="1"
        width="238"
        height="128"
        rx="4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
      />

      {/* Panel divider 1 (after field tree) */}
      <line x1="68" y1="1" x2="68" y2="129" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      {/* Panel divider 2 (after query builder) */}
      <line
        x1="152"
        y1="1"
        x2="152"
        y2="129"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.15"
      />

      {/* ── Field tree panel (x: 2–66) ── */}
      {/* Panel header */}
      <rect x="9" y="9" width="32" height="4" rx="2" fill="currentColor" opacity="0.3" />
      {/* Group label */}
      <rect x="9" y="22" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      {/* Field rows */}
      <rect x="15" y="30" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="15" y="37" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="15" y="44" width="34" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      {/* Group label 2 */}
      <rect x="9" y="56" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      {/* Field rows 2 */}
      <rect x="15" y="64" width="22" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="15" y="71" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="15" y="78" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.15" />

      {/* ── Query builder panel (x: 70–150) ── */}
      {/* Panel header */}
      <rect x="76" y="9" width="32" height="4" rx="2" fill="currentColor" opacity="0.3" />
      {/* Rows zone */}
      <rect
        x="76"
        y="22"
        width="66"
        height="26"
        rx="3"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
      />
      <rect x="80" y="29" width="28" height="8" rx="4" fill="currentColor" opacity="0.15" />
      {/* Columns zone */}
      <rect
        x="76"
        y="54"
        width="66"
        height="26"
        rx="3"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
      />
      <rect x="80" y="61" width="24" height="8" rx="4" fill="currentColor" opacity="0.15" />
      {/* Breakdown zone */}
      <rect
        x="76"
        y="86"
        width="66"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.12"
      />

      {/* ── Results panel (x: 154–238) ── */}
      {/* Panel header */}
      <rect x="160" y="9" width="32" height="4" rx="2" fill="currentColor" opacity="0.3" />
      {/* Table header row */}
      <rect x="160" y="22" width="70" height="6" rx="1" fill="currentColor" opacity="0.2" />
      {/* Table rows */}
      <rect x="160" y="32" width="70" height="5" rx="1" fill="currentColor" opacity="0.1" />
      <rect x="160" y="41" width="70" height="5" rx="1" fill="currentColor" opacity="0.1" />
      <rect x="160" y="50" width="70" height="5" rx="1" fill="currentColor" opacity="0.1" />
      <rect x="160" y="59" width="70" height="5" rx="1" fill="currentColor" opacity="0.1" />
      {/* Chart area */}
      <rect x="160" y="72" width="70" height="48" rx="3" fill="currentColor" opacity="0.06" />
      {/* Chart bars */}
      <rect x="168" y="88" width="10" height="30" rx="2" fill="currentColor" opacity="0.18" />
      <rect x="182" y="96" width="10" height="22" rx="2" fill="currentColor" opacity="0.18" />
      <rect x="196" y="80" width="10" height="38" rx="2" fill="currentColor" opacity="0.18" />
      <rect x="210" y="90" width="10" height="28" rx="2" fill="currentColor" opacity="0.18" />
    </svg>
  )
}
