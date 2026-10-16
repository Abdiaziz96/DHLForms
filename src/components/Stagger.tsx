'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * One orchestrated entrance per screen.
 *
 * Deliberately not a scroll-reveal-per-section system. A page that fades in a new
 * block every time you scroll reads as generated; a page that arrives once, as a
 * single considered movement, reads as designed. Children stagger, then it stops.
 *
 * Respects reduced motion by collapsing to a plain render.
 */
export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.055, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } },
      }}
    >
      {children}
    </motion.div>
  );
}
