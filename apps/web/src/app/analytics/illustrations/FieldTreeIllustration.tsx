export function FieldTreeIllustration() {
  return (
    <svg
      width="52"
      height="40"
      viewBox="0 0 52 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-muted-foreground"
    >
      {/* Root group bar */}
      <rect x="2" y="4" width="22" height="4" rx="2" fill="currentColor" opacity="0.3" />
      {/* Vertical connector */}
      <line x1="4" y1="8" x2="4" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      {/* Child rows with horizontal connectors */}
      <line
        x1="4"
        y1="14.5"
        x2="12"
        y2="14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.15"
      />
      <rect x="12" y="12" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <line
        x1="4"
        y1="21.5"
        x2="12"
        y2="21.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.15"
      />
      <rect x="12" y="19" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <line
        x1="4"
        y1="28.5"
        x2="12"
        y2="28.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.15"
      />
      <rect x="12" y="26" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      {/* Question mark circle */}
      <circle cx="43" cy="20" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <text x="43" y="24" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.4">
        ?
      </text>
    </svg>
  )
}
