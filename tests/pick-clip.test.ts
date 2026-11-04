import { describe, expect, it } from 'vitest';
import { pickClip } from '@/lib/engines/pick-clip';

describe('pickClip', () => {
  it('matches English keywords', () => {
    expect(pickClip('A cinematic shot of the ocean at sunrise', 'wan')).toBe('ocean');
    expect(pickClip('drone flight over a dense forest', 'wan')).toBe('forest');
    expect(pickClip('neon city street at midnight', 'wan')).toBe('city');
    expect(pickClip('a star exploding in deep space', 'wan')).toBe('space');
  });

  it('matches Arabic, including attached particles', () => {
    // "للبحر" = "to the sea" — the preposition is glued to the noun.
    expect(pickClip('لقطة سينمائية للبحر عند الغروب', 'wan')).toBe('ocean');
    expect(pickClip('غابة كثيفة في الصباح', 'wan')).toBe('forest');
    expect(pickClip('مدينة مليئة بالأضواء', 'wan')).toBe('city');
    expect(pickClip('نجم في الفضاء', 'wan')).toBe('space');
  });

  it('matches Chinese compounds without spaces', () => {
    expect(pickClip('夜晚的城市街道', 'wan')).toBe('city');
    expect(pickClip('深海与海浪', 'wan')).toBe('ocean');
    expect(pickClip('森林里的晨雾', 'wan')).toBe('forest');
  });

  it('ignores accents and case', () => {
    expect(pickClip('FORÊT au petit matin', 'wan')).toBe('forest');
    expect(pickClip('OCEAN', 'wan')).toBe('ocean');
  });

  it('matches German and Spanish keywords', () => {
    expect(pickClip('ein Wald im Nebel', 'wan')).toBe('forest');
    expect(pickClip('una playa al atardecer', 'wan')).toBe('ocean');
  });

  it('respects word boundaries so "season" is not "sea"', () => {
    expect(pickClip('the final season of a drama', 'wan')).toBe('space');
  });

  it('falls back to the engine default clip', () => {
    expect(pickClip('something entirely unrelated', 'wan')).toBe('space');
    expect(pickClip('something entirely unrelated', 'mochi')).toBe('silk');
    expect(pickClip('something entirely unrelated', 'svd')).toBe('ocean');
    expect(pickClip('', 'shorts')).toBe('city');
  });

  it('prefers prompt keywords over the engine default', () => {
    // "ocean" wins even though the wan profile defaults to space.
    expect(pickClip('ocean', 'wan')).toBe('ocean');
  });
});
