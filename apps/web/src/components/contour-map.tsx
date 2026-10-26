// Decorative relief-style map: deterministic contour rings with a few "investment" pins.
const CX = 260;
const CY = 230;

function ring(index: number) {
  const base = 34 + index * 24;
  const points: string[] = [];
  const steps = 96;
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const wobble = Math.sin(3 * a + index * 0.9) * 9 + Math.sin(5 * a - index * 0.6) * 5 + Math.cos(2 * a + index) * 7;
    const r = base + wobble * (0.6 + index * 0.07);
    const x = CX + Math.cos(a) * r * 1.18;
    const y = CY + Math.sin(a) * r * 0.92;
    points.push(`${s === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `${points.join(" ")}Z`;
}

const PINS = [
  { x: 205, y: 170, label: "A" },
  { x: 330, y: 255, label: "B" },
  { x: 250, y: 320, label: "C" },
];

export function ContourMap({ className }: { className?: string }) {
  return (
    <svg viewBox="-30 -10 620 480" className={className} role="img" aria-label="" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={ring(i)} opacity={0.22 + i * 0.07} />
        ))}
      </g>
      <path
        d="M70 380 C 150 340, 190 300, 250 262 S 380 190, 470 120"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeDasharray="2 9"
        strokeLinecap="round"
      />
      {PINS.map((p) => (
        <g key={p.label} transform={`translate(${p.x} ${p.y})`}>
          <circle r="16" fill="var(--brand)" opacity="0.18" />
          <circle r="9" fill="var(--brand)" />
          <circle r="3.5" fill="var(--brand-fg)" />
        </g>
      ))}
    </svg>
  );
}
