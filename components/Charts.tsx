import type { DayPoint, EngineSlice } from '@/lib/analytics';
import { formatAxisDay, formatCount } from '@/lib/format';
import styles from './Charts.module.css';

/**
 * Hand-drawn SVG charts.
 *
 * No charting library: the dashboard needs two shapes (bars over time, mix by
 * engine) and shipping a 90 kB chart bundle to draw them would be silly. These
 * are plain server-rendered SVG — zero client JS, and `<title>` on each bar gives
 * a native tooltip plus accessible text.
 */

export interface DailyBarsProps {
  readonly points: readonly DayPoint[];
  readonly caption: string;
}

export function DailyBars({ points, caption }: DailyBarsProps) {
  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 8, bottom: 28, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const peak = Math.max(1, ...points.map((point) => point.total));
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(6, slot * 0.52);

  const ticks = [0, 0.5, 1].map((ratio) => ({
    ratio,
    value: Math.round(peak * ratio),
    y: padding.top + plotHeight * (1 - ratio),
  }));

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={caption}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="dailyBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0cf6b" />
            <stop offset="100%" stopColor="rgba(212,175,55,0.28)" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick.ratio}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray={tick.ratio === 0 ? undefined : '3 5'}
            />
            <text x={padding.left - 8} y={tick.y + 3.5} className={styles.axis} textAnchor="end">
              {tick.value}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const barHeight = (point.total / peak) * plotHeight;
          const x = padding.left + index * slot + (slot - barWidth) / 2;
          const y = padding.top + plotHeight - barHeight;

          return (
            <g key={point.date}>
              <rect
                x={x}
                y={barHeight === 0 ? padding.top + plotHeight - 1 : y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={3}
                fill="url(#dailyBar)"
                opacity={point.total === 0 ? 0.25 : 1}
              >
                <title>{`${formatAxisDay(point.date)}: ${point.total} renders (${point.succeeded} succeeded)`}</title>
              </rect>
              {index % 3 === 0 ? (
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  className={styles.axis}
                  textAnchor="middle"
                >
                  {formatAxisDay(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}

export interface EngineBarsProps {
  readonly slices: readonly EngineSlice[];
}

export function EngineBars({ slices }: EngineBarsProps) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return <p className={styles.empty}>No renders in this window yet.</p>;
  }

  return (
    <ul className={styles.mixList}>
      {slices.map((slice, index) => {
        const share = Math.round((slice.count / total) * 100);
        return (
          <li
            key={slice.engine}
            className={`${styles.mixRow} fadeIn`}
            style={{ ['--i' as string]: index }}
          >
            <span className={styles.mixName}>{slice.name}</span>
            <span className={styles.mixTrack}>
              <span className={styles.mixFill} style={{ width: `${Math.max(share, 3)}%` }} />
            </span>
            <span className={styles.mixValue}>
              {formatCount(slice.count)} <span className={styles.mixShare}>{share}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface MeterProps {
  readonly value: number;
  readonly label: string;
}

export function Meter({ value, label }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={styles.meter} role="img" aria-label={`${label}: ${clamped}%`}>
      <span className={styles.meterFill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
