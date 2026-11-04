'use client';

import { useEffect, useRef } from 'react';
import styles from './VideoPreview.module.css';

export interface VideoPreviewProps {
  readonly src: string;
  readonly poster?: string;
  readonly alt: string;
  readonly fallbackText: string;
}

/**
 * Result player.
 *
 * Clips only download and play while visible (`preload="none"` + an
 * IntersectionObserver), so opening several cards no longer streams eight
 * videos at once. Playback failures caused by autoplay policy are swallowed —
 * the native controls are still there for the user.
 */
export function VideoPreview({ src, poster, alt, fallbackText }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const play = () => {
      void video.play().catch(() => {
        // Autoplay blocked or interrupted — the controls remain available.
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      play();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          play();
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={styles.video}
      src={src}
      poster={poster}
      aria-label={alt}
      controls
      loop
      muted
      playsInline
      preload="none"
    >
      {fallbackText}
    </video>
  );
}
