"use client"

export function ProgressRing({ value }: { value: number }) {
  const radius = 36
  const stroke = 8
  const normalizedRadius = radius - stroke * 0.5
  const circumference = normalizedRadius * 2 * Math.PI
  const clamped = Math.max(0, Math.min(100, value))
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  return (
    <svg height={radius * 2} width={radius * 2} aria-label={`Progress ${clamped}%`}>
      <circle
        stroke="var(--color-muted)"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke="var(--color-primary)"
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        style={{ strokeDasharray: `${circumference} ${circumference}`, strokeDashoffset }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-foreground text-xs">
        {clamped}%
      </text>
    </svg>
  )
}
