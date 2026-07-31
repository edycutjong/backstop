// Backstop mark — falling dot arrested by the wall-and-floor cradle.
// Paths from assets/brand/logo-wordmark.svg (compact lockup). Never retyped as a font.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        viewBox="0 0 120 120"
        width="28"
        height="28"
        role="img"
        aria-label="Backstop"
        className="shrink-0"
      >
        <path
          d="M 96 6 V 76 A 28 28 0 0 1 68 104 H 24"
          fill="none"
          stroke="#3ECF9A"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <circle cx="68" cy="76" r="19.5" fill="#F7F6F1" />
      </svg>
      <span className="font-mono text-lg font-semibold uppercase tracking-[0.18em] text-mist-100">
        Backstop
      </span>
    </span>
  );
}
