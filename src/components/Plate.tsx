import { clsx } from 'clsx';

/**
 * A UK number plate.
 *
 * Registrations are the highest-frequency token in this product. A transport
 * manager scans a column of them all day, so they get rendered as the thing they
 * actually are rather than as a string of mono text. Yellow rear plate, black
 * identifier band, mono type — legible at a glance and unmistakable at a
 * distance.
 */
export function Plate({
  reg,
  size = 'md',
  className,
  title,
}: {
  reg: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}) {
  const clean = (reg || '').toUpperCase().trim() || 'NO REG';

  return (
    <span
      className={clsx('plate', `plate-${size}`, className)}
      title={title ?? `Vehicle ${clean}`}
      role="img"
      aria-label={`Vehicle registration ${clean}`}
    >
      <span className="plate-band" aria-hidden>
        UK
      </span>
      <span className="plate-text tabular">{clean}</span>
    </span>
  );
}
