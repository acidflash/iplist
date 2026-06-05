export function LogoMark({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 22 / 24)}
      viewBox="0 0 24 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Row 1 — root prefix: leftmost, longest */}
      <rect x="0" y="0" width="4" height="4" fill={color} />
      <rect x="6" y="1" width="17" height="2" fill={color} />
      {/* Row 2 — child prefix: indented, shorter */}
      <rect x="5" y="9" width="4" height="4" fill={color} />
      <rect x="11" y="10" width="12" height="2" fill={color} />
      {/* Row 3 — leaf prefix: most indented, shortest */}
      <rect x="10" y="18" width="4" height="4" fill={color} />
      <rect x="16" y="19" width="7" height="2" fill={color} />
    </svg>
  )
}
