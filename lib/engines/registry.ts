/**
 * The single source of truth for engines and demo clips.
 *
 * Every other module (UI, API, tests) reads from here — v1 had three divergent
 * copies of this table, which is why the ids and keywords disagreed.
 *
 * Safe to import from client components: no server-only code, plain data only.
 */

/** Self-hosted demo clips. Regenerate with `npm run media:generate`. */
export const CLIPS = {
  space: {
    src: '/media/space.mp4',
    poster: '/media/posters/space.jpg',
    alt: 'Drifting starfield with a gold meteor trail',
    description: 'Deep-space starfield with slow parallax and warm meteor streaks.',
  },
  ocean: {
    src: '/media/ocean.mp4',
    poster: '/media/posters/ocean.jpg',
    alt: 'Moonlit sea with soft rolling swells',
    description: 'Moonlit ocean swells with shimmering surface highlights.',
  },
  forest: {
    src: '/media/forest.mp4',
    poster: '/media/posters/forest.jpg',
    alt: 'Layered forest ridges in green mist',
    description: 'Layered forest ridges fading into low green mist.',
  },
  city: {
    src: '/media/city.mp4',
    poster: '/media/posters/city.jpg',
    alt: 'Night city skyline with lit windows',
    description: 'Night skyline silhouette with flickering windows and moonlight.',
  },
  gold: {
    src: '/media/gold.mp4',
    poster: '/media/posters/gold.jpg',
    alt: 'Abstract golden particles orbiting a centre',
    description: 'Abstract gold particle field orbiting a soft core of light.',
  },
  silk: {
    src: '/media/silk.mp4',
    poster: '/media/posters/silk.jpg',
    alt: 'Flowing teal and violet silk gradient',
    description: 'Flowing teal-and-violet gradient silk, like light on water.',
  },
} as const;

export type ClipName = keyof typeof CLIPS;

export interface ClipAsset {
  readonly src: string;
  readonly poster: string;
  readonly alt: string;
  readonly description: string;
}

/**
 * Engine catalogue.
 *
 * `kind` is honest about what each entry is:
 *  - `model`: a named generative model this studio is designed to host.
 *  - `preset`: an output profile (motion/sharpness/speed) rather than a model.
 *
 * In demo mode every engine plays a generated clip, not model output. See
 * README.md § Status.
 */
export const ENGINES = [
  {
    id: 'wan',
    name: 'WAN 2.2',
    tag: 'CINEMATIC',
    icon: '🎬',
    kind: 'model',
    clip: 'space',
    summary: 'Cinematic text-to-video with long, deliberate camera moves.',
  },
  {
    id: 'mochi',
    name: 'MOCHI 1',
    tag: 'FAST',
    icon: '⚡',
    kind: 'model',
    clip: 'silk',
    summary: 'Natural motion, tuned for short fast drafts.',
  },
  {
    id: 'svd',
    name: 'SVD XT',
    tag: 'SMOOTH',
    icon: '🌊',
    kind: 'model',
    clip: 'ocean',
    summary: 'Image-to-video with smooth, realistic camera motion.',
  },
  {
    id: 'shorts',
    name: 'OPENSHORTS',
    tag: 'VIRAL',
    icon: '📱',
    kind: 'model',
    clip: 'city',
    summary: 'Long-form to shorts: auto-reframed vertical clips.',
  },
  {
    id: 'ai',
    name: 'AI DIRECTOR',
    tag: 'SMART',
    icon: '🤖',
    kind: 'preset',
    clip: 'gold',
    summary: 'Profile that picks pacing and framing automatically.',
  },
  {
    id: 'edge',
    name: 'EDGE HD',
    tag: 'SHARP',
    icon: '✨',
    kind: 'preset',
    clip: 'forest',
    summary: 'Profile biased toward crisp detail and high contrast.',
  },
  {
    id: 'ultra',
    name: 'ULTRA',
    tag: 'POWER',
    icon: '🚀',
    kind: 'preset',
    clip: 'gold',
    summary: 'Maximum-quality profile for final renders.',
  },
  {
    id: 'ent',
    name: 'ENTERTAINER',
    tag: 'STORY',
    icon: '🎭',
    kind: 'preset',
    clip: 'silk',
    summary: 'Story-first profile with expressive motion.',
  },
] as const satisfies readonly {
  id: string;
  name: string;
  tag: string;
  icon: string;
  kind: 'model' | 'preset';
  clip: ClipName;
  summary: string;
}[];

export type EngineDefinition = (typeof ENGINES)[number];
export type EngineId = EngineDefinition['id'];

/** Stable list of ids, used by the validator and the API contract. */
export const ENGINE_IDS: readonly EngineId[] = ENGINES.map((engine) => engine.id);

export const DEFAULT_ENGINE_ID: EngineId = 'wan';

export function isEngineId(value: unknown): value is EngineId {
  return typeof value === 'string' && (ENGINE_IDS as readonly string[]).includes(value);
}

export function getEngine(id: EngineId): EngineDefinition {
  const engine = ENGINES.find((candidate) => candidate.id === id);
  if (!engine) {
    throw new Error(`Unknown engine id: ${id}`);
  }
  return engine;
}

export function getClip(name: ClipName): ClipAsset {
  return CLIPS[name];
}
