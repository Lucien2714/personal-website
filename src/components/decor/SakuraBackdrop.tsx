import {cn} from '@/lib/utils/cn';

/**
 * The ambient background: soft colour washes and a scatter of drifting petals.
 *
 * Rendered once in the layout, behind everything, and marked
 * `aria-hidden`/`pointer-events-none` so it never reaches assistive technology
 * or intercepts a click. The petals are inline SVG rather than images: at this
 * size the markup is smaller than a request would be, and it recolours itself
 * with the theme for free.
 *
 * Motion is defined in globals.css and disabled automatically under
 * `prefers-reduced-motion`.
 */

/** Deterministic petal placement, so server and client render identically. */
const PETALS = [
  {left: '6%', top: '12%', size: 26, delay: '0s', opacity: 0.35},
  {left: '18%', top: '58%', size: 16, delay: '1.4s', opacity: 0.25},
  {left: '34%', top: '22%', size: 20, delay: '2.6s', opacity: 0.2},
  {left: '61%', top: '8%', size: 30, delay: '0.8s', opacity: 0.3},
  {left: '78%', top: '44%', size: 18, delay: '3.2s', opacity: 0.28},
  {left: '90%', top: '18%', size: 22, delay: '2s', opacity: 0.22},
] as const;

/** Positions of the twinkling stars. */
const STARS = [
  {left: '12%', top: '32%', delay: '0s'},
  {left: '47%', top: '10%', delay: '1.1s'},
  {left: '69%', top: '62%', delay: '2.3s'},
  {left: '85%', top: '28%', delay: '0.6s'},
] as const;

/** A single five-petal cherry blossom. */
function Blossom({size}: {size: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6.5"
          rx="3.6"
          ry="5.5"
          fill="var(--color-sakura)"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="1.8" fill="var(--color-lavender)" />
    </svg>
  );
}

/** Renders the fixed decorative layer. */
export function SakuraBackdrop({className}: {className?: string}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 overflow-hidden',
        'aurora',
        className,
      )}
    >
      {PETALS.map((petal) => (
        <span
          key={`${petal.left}-${petal.top}`}
          className="absolute animate-float-slow"
          style={{
            left: petal.left,
            top: petal.top,
            opacity: petal.opacity,
            animationDelay: petal.delay,
          }}
        >
          <Blossom size={petal.size} />
        </span>
      ))}

      {STARS.map((star) => (
        <span
          key={`${star.left}-${star.top}`}
          className="absolute h-1.5 w-1.5 animate-twinkle rounded-full bg-[var(--color-sky)]"
          style={{
            left: star.left,
            top: star.top,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}
