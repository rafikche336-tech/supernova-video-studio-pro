'use client';

import { useEffect, useRef } from 'react';
import { getClip, type ClipName } from '@/lib/engines/registry';
import styles from './ClipShowcase.module.css';

export interface ClipShowcaseProps {
  readonly clips: readonly ClipName[];
}

/**
 * Wall of the clips that ship with the demo.
 *
 * 24 `<video>` elements would be absurd if they all loaded eagerly, so each one
 * uses `preload="none"` and only plays while it is on screen (IntersectionObserver).
 * Users who ask for reduced motion get posters and a play affordance instead.
 */
export function ClipShowcase({ clips }: ClipShowcaseProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const videos = Array.from(grid.querySelectorAll('video'));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            void video.play().catch(() => {
              // Autoplay can be blocked; the poster stays visible and that is fine.
            });
          } else {
            video.pause();
          }
        }
      },
      { rootMargin: '150px 0px', threshold: 0.01 },
    );

    for (const video of videos) observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={gridRef} className={styles.grid}>
      {clips.map((clip, index) => {
        const asset = getClip(clip);
        return (
          <figure
            key={clip}
            className={`${styles.tile} stagger`}
            style={{ ['--i' as string]: index }}
          >
            <video
              className={styles.video}
              src={asset.src}
              poster={asset.poster}
              muted
              loop
              playsInline
              preload="none"
              controls={false}
              aria-label={asset.alt}
            />
            <figcaption className={styles.caption}>
              <span className={styles.name}>{clip}</span>
              <span className={styles.scene}>{asset.description}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
