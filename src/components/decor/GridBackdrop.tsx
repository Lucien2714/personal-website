import {cn} from '@/lib/utils/cn';

/**
 * The ambient background: a faint technical grid, a few drifting polygons and
 * a scatter of dim points.
 *
 * Rendered once in the layout, behind everything, and marked
 * `aria-hidden`/`pointer-events-none` so it never reaches assistive technology
 * or intercepts a click. The shapes are inline SVG rather than images: at this
 * size the markup is smaller than a request would be, and it recolours itself
 * with the theme for free.
 *
 * Motion is defined in globals.css and disabled automatically under
 * `prefers-reduced-motion`.
 */

/** Deterministic placement, so server and client render identically. */
const SHAPES = [
  {left: '7%', top: '14%', size: 30, delay: '0s', opacity: 0.2, sides: 6},
  {left: '19%', top: '62%', size: 18, delay: '1.6s', opacity: 0.14, sides: 3},
  {left: '36%', top: '24%', size: 22, delay: '3.1s', opacity: 0.12, sides: 4},
  {left: '63%', top: '10%', size: 34, delay: '0.9s', opacity: 0.16, sides: 6},
  {left: '80%', top: '48%', size: 20, delay: '3.6s', opacity: 0.15, sides: 3},
  {left: '91%', top: '20%', size: 24, delay: '2.2s', opacity: 0.12, sides: 4},
] as const;

/** Positions of the dim pulsing points. */
const POINTS = [
  {left: '13%', top: '34%', delay: '0s'},
  {left: '46%', top: '12%', delay: '1.3s'},
  {left: '68%', top: '66%', delay: '2.6s'},
  {left: '86%', top: '30%', delay: '0.7s'},
] as const;

/** Builds the points of a regular polygon inscribed in a 24×24 box. */
function polygonPoints(sides: number): string {
  const radius = 11;
  const centre = 12;
  // Start at -90° so a triangle points up rather than sideways.
  return Array.from({length: sides}, (_, index) => {
    const angle = (index / sides) * 2 * Math.PI - Math.PI / 2;
    const x = centre + radius * Math.cos(angle);
    const y = centre + radius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

/** A single outlined polygon. */
function Polygon({size, sides}: {size: number; sides: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points={polygonPoints(sides)}
        stroke="var(--color-accent)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

/** Renders the fixed decorative layer. */
export function GridBackdrop({className}: {className?: string}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 overflow-hidden',
        'aurora',
        className,
      )}
    >
      {/* A 64 px grid, barely visible, to give the background some structure
          without competing with the text in front of it. */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage: `linear-gradient(to right, var(--color-border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          // Fades the grid out towards the edges so it does not end abruptly.
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)',
        }}
      />

      {SHAPES.map((shape) => (
        <span
          key={`${shape.left}-${shape.top}`}
          className="absolute animate-drift"
          style={{
            left: shape.left,
            top: shape.top,
            opacity: shape.opacity,
            animationDelay: shape.delay,
          }}
        >
          <Polygon size={shape.size} sides={shape.sides} />
        </span>
      ))}

      {POINTS.map((point) => (
        <span
          key={`${point.left}-${point.top}`}
          className="absolute h-1 w-1 animate-pulse-dim rounded-full bg-[var(--color-cyan)]"
          style={{
            left: point.left,
            top: point.top,
            animationDelay: point.delay,
          }}
        />
      ))}
    </div>
  );
}
