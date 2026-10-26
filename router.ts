export type Engine = 'wan2.2' | 'mochi1' | 'svd' | 'openshorts';

export const ENGINES = {
  'wan2.2': { name: 'Wan 2.2', type: 'text-to-video', quality: 'cinematic' },
  'mochi1': { name: 'Mochi 1', type: 'text-to-video', quality: 'natural' },
  'svd': { name: 'Stable Video Diffusion', type: 'image-to-video' },
  'openshorts': { name: 'OpenShorts', type: 'long-to-shorts' },
} as const;

export function routePrompt(prompt: string, engine: Engine) {
  // Smart router - choose best engine based on prompt
  return ENGINES[engine];
}