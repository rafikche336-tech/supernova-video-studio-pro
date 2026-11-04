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
  desert: {
    src: '/media/desert.mp4',
    poster: '/media/posters/desert.jpg',
    alt: 'Golden dunes under a low sun',
    description: 'Layered desert dunes with a warm low sun and drifting haze.',
  },
  aurora: {
    src: '/media/aurora.mp4',
    poster: '/media/posters/aurora.jpg',
    alt: 'Green and violet aurora over a dark sky',
    description: 'Shimmering aurora ribbons drifting across a starry polar sky.',
  },
  snow: {
    src: '/media/snow.mp4',
    poster: '/media/posters/snow.jpg',
    alt: 'Snow falling over blue ridges',
    description: 'Soft snowfall over cold blue ridges with slow drifting flakes.',
  },
  neon: {
    src: '/media/neon.mp4',
    poster: '/media/posters/neon.jpg',
    alt: 'Rainy neon alley in magenta and cyan',
    description: 'Rain-slick neon alley with magenta and cyan signage reflections.',
  },
  embers: {
    src: '/media/embers.mp4',
    poster: '/media/posters/embers.jpg',
    alt: 'Glowing embers rising from a fire',
    description: 'Embers and sparks rising through warm smoke.',
  },
  ink: {
    src: '/media/ink.mp4',
    poster: '/media/posters/ink.jpg',
    alt: 'Violet ink swirling in dark water',
    description: 'Abstract violet ink blooming and swirling in darkness.',
  },
  underwater: {
    src: '/media/underwater.mp4',
    poster: '/media/posters/underwater.jpg',
    alt: 'Sunlight shafts through turquoise water',
    description: 'Turquoise underwater light shafts and slow caustics.',
  },
  ruins: {
    src: '/media/ruins.mp4',
    poster: '/media/posters/ruins.jpg',
    alt: 'Ancient columns in dusty light',
    description: 'Weathered stone columns and ruins in warm dusty light.',
  },
  clouds: {
    src: '/media/clouds.mp4',
    poster: '/media/posters/clouds.jpg',
    alt: 'Soft cloud layers drifting',
    description: 'Layered cloudscape drifting through a pale sky.',
  },
  lava: {
    src: '/media/lava.mp4',
    poster: '/media/posters/lava.jpg',
    alt: 'Cracks of molten lava glowing',
    description: 'Molten lava cracks pulsing between dark cooled crusts.',
  },
  fireworks: {
    src: '/media/fireworks.mp4',
    poster: '/media/posters/fireworks.jpg',
    alt: 'Colourful fireworks in a night sky',
    description: 'Firework bursts blooming and fading against a night sky.',
  },
  mountain: {
    src: '/media/mountain.mp4',
    poster: '/media/posters/mountain.jpg',
    alt: 'Layered mountain peaks at dusk',
    description: 'Layered mountain ridges fading into a dusk-lit horizon.',
  },
  rainwindow: {
    src: '/media/rainwindow.mp4',
    poster: '/media/posters/rainwindow.jpg',
    alt: 'Raindrops and bokeh behind glass',
    description: 'Rain streaks and warm city bokeh seen through a wet window.',
  },
  cyber: {
    src: '/media/cyber.mp4',
    poster: '/media/posters/cyber.jpg',
    alt: 'Retro-futuristic grid horizon',
    description: 'Retro-futuristic neon grid horizon with a sweeping scanline.',
  },
  storm: {
    src: '/media/storm.mp4',
    poster: '/media/posters/storm.jpg',
    alt: 'Lightning inside dark storm clouds',
    description: 'Dark churning storm clouds split by lightning flashes.',
  },
  blossom: {
    src: '/media/blossom.mp4',
    poster: '/media/posters/blossom.jpg',
    alt: 'Cherry petals falling through pink light',
    description: 'Cherry blossom petals drifting in soft pink spring light.',
  },
  galaxy: {
    src: '/media/galaxy.mp4',
    poster: '/media/posters/galaxy.jpg',
    alt: 'Spiral galaxy turning slowly',
    description: 'A slowly rotating spiral galaxy with a bright warm core.',
  },
  tunnel: {
    src: '/media/tunnel.mp4',
    poster: '/media/posters/tunnel.jpg',
    alt: 'Gold light rings receding down a tunnel',
    description: 'Gold light rings and radial lines receding down a tunnel.',
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
    clip: 'neon',
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
    clip: 'galaxy',
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
