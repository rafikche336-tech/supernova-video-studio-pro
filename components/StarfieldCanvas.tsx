'use client';

import { useRef } from 'react';
import { useStarfield } from '@/hooks/useStarfield';
import styles from './StarfieldCanvas.module.css';

/**
 * Decorative animated background.
 *
 * `aria-hidden` keeps it out of the accessibility tree; the animation itself is
 * paused for `prefers-reduced-motion` and when the tab is hidden.
 */
export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useStarfield(canvasRef);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
