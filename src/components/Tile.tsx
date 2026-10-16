'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { clsx } from 'clsx';

/**
 * The decision tile.
 *
 * Every branch in this product is one of these. Sized for a thumb and a gloved
 * hand: full width on a phone, minimum 76px tall, the whole surface is the target.
 *
 * Motion is on the *action* — press-down and release — not on scroll. Entrance
 * animation is orchestrated once per screen by the parent, not repeated here.
 */

type Variant = 'default' | 'primary' | 'stop' | 'quiet';

export interface TileProps {
  href?: string;
  onClick?: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Small right-aligned figure: a count, a time, a reference. */
  meta?: ReactNode;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  default: 'bg-card border-line-strong text-ink hover:border-ink active:bg-card-sunk',
  primary: 'bg-ink border-ink text-card hover:bg-ink-soft active:bg-[#000]',
  stop: 'bg-stop border-stop text-white hover:bg-[#a82c26]',
  quiet: 'bg-transparent border-line text-ink-soft hover:border-ink-muted hover:bg-card',
};

export function Tile({
  href,
  onClick,
  title,
  description,
  icon,
  meta,
  variant = 'default',
  disabled,
  className,
}: TileProps) {
  const inner = (
    <>
      {icon && (
        <span
          className={clsx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-tile border',
            variant === 'primary' || variant === 'stop'
              ? 'border-white/25 bg-white/10'
              : 'border-line bg-card-sunk',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-display text-[17px] font-bold leading-tight tracking-tight">{title}</span>
        {description && (
          <span
            className={clsx(
              'mt-1 block text-[13px] leading-snug',
              variant === 'primary' || variant === 'stop' ? 'text-white/75' : 'text-ink-muted',
            )}
          >
            {description}
          </span>
        )}
      </span>
      {meta && <span className="shrink-0 self-center">{meta}</span>}
    </>
  );

  const classes = clsx(
    'flex w-full items-center gap-3.5 rounded-card border-2 p-4 transition-colors duration-150',
    VARIANTS[variant],
    disabled && 'pointer-events-none opacity-45',
    className,
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled>
        {inner}
      </span>
    );
  }

  return (
    <motion.div whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}>
      {href ? (
        <Link href={href} className={classes}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={classes}>
          {inner}
        </button>
      )}
    </motion.div>
  );
}
