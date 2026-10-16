'use client';

import { Eraser, PenLine } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Signature capture.
 *
 * Strokes are stored as *fractions of the canvas box* (0–1) rather than pixels,
 * so a signature captured in portrait survives a rotation into landscape, and
 * renders identically in the workbook, in the PDF and on a printed audit sheet.
 * Storing raw pixels is the usual mistake here and it breaks the moment a phone
 * is turned.
 *
 * The canvas is vector-backed (SVG path data), not a bitmap: it scales to any
 * size without artefacts and costs a few hundred bytes per record instead of
 * tens of kilobytes.
 */

export interface SignaturePadHandle {
  clear: () => void;
}

/** One stroke: a list of [x, y] pairs in 0–1 space. */
type Stroke = [number, number][];

function strokeToPath(stroke: Stroke): string {
  if (stroke.length === 0) return '';
  return stroke.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(4)} ${y.toFixed(4)}`).join(' ');
}

export function SignaturePad({
  onChange,
  value,
  disabled,
}: {
  /** Called with SVG path data whenever the signature changes. */
  onChange: (paths: string[]) => void;
  /** Existing paths, so the pad can rehydrate when a draft is restored. */
  value?: string[];
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#0c1219';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes.current) {
      if (stroke.length < 1) continue;
      ctx.beginPath();
      stroke.forEach(([fx, fy], i) => {
        const x = fx * rect.width;
        const y = fy * rect.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      // A single tap still leaves a visible mark.
      if (stroke.length === 1) {
        const [fx, fy] = stroke[0];
        ctx.lineTo(fx * rect.width + 0.5, fy * rect.height + 0.5);
      }
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [redraw]);

  const pointFrom = (e: PointerEvent | React.PointerEvent): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  };

  const emit = () => {
    const paths = strokes.current.map(strokeToPath).filter(Boolean);
    setHasInk(paths.length > 0);
    onChange(paths);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const p = pointFrom(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([p]);
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || disabled) return;
    // Coalesced events give a smooth line on high-refresh screens without
    // flooding state — we write to a ref, never to React state, per move.
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const stroke = strokes.current[strokes.current.length - 1];
    for (const ev of events) {
      const p = pointFrom(ev as PointerEvent);
      if (p) stroke.push(p);
    }
    redraw();
  };

  const endStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  const clear = () => {
    strokes.current = [];
    setHasInk(false);
    onChange([]);
    redraw();
  };

  // Rehydrate from an external value (restored draft) exactly once per change.
  useEffect(() => {
    if (!value || value.length === 0) return;
    if (hasInk) return;
    strokes.current = value
      .map((d) =>
        d
          .split(/[ML]/)
          .filter(Boolean)
          .map((pair) => {
            const [x, y] = pair.trim().split(/\s+/).map(Number);
            return [x, y] as [number, number];
          }),
      )
      .filter((s) => s.length > 0);
    setHasInk(strokes.current.length > 0);
    redraw();
  }, [value, hasInk, redraw]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-card border-2 border-line-strong bg-card">
        {/* Printed guide line, like the ruled line on the paper form it replaces. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-line-strong" aria-hidden />
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          className={`block h-40 w-full touch-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'}`}
          role="img"
          aria-label={hasInk ? 'Signature captured' : 'Empty signature pad'}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink-faint">
            <PenLine className="h-5 w-5" aria-hidden />
            <span className="text-[13px] font-semibold">Sign here with your finger</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          {hasInk ? 'Signed. This is stored with the record and printed on the audit sheet.' : 'Draw your usual signature. It does not need to be neat.'}
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk || disabled}
          className="flex shrink-0 items-center gap-1.5 rounded-tile border-2 border-line-strong bg-card px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      </div>

      {/* The SVG form of the same strokes: what actually gets stored and printed. */}
      {hasInk && (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="sr-only" aria-hidden>
          {strokes.current.map(strokeToPath).map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#0c1219" strokeWidth={0.004} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      )}
    </div>
  );
}
