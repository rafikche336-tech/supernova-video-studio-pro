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
    expect(pickClip('something entirely unrelated', 'mochi')).toBe('neon');
    expect(pickClip('something entirely unrelated', 'svd')).toBe('ocean');
    expect(pickClip('', 'shorts')).toBe('city');
    expect(pickClip('something entirely unrelated', 'ultra')).toBe('galaxy');
  });

  it('routes the extended clip library', () => {
    expect(pickClip('a sand dune in the sahara', 'wan')).toBe('desert');
    expect(pickClip('an aurora over the tundra', 'wan')).toBe('aurora');
    expect(pickClip('shooting fireworks over a bay', 'wan')).toBe('fireworks');
    expect(pickClip('a storm rolling in at night', 'wan')).toBe('storm');
    expect(pickClip('cherry blossom petals falling', 'wan')).toBe('blossom');
    expect(pickClip('molten lava flowing down a volcano', 'wan')).toBe('lava');
    expect(pickClip('snow falling on a quiet field', 'wan')).toBe('snow');
    expect(pickClip('rain on the window at night', 'wan')).toBe('rainwindow');
    expect(pickClip('a tunnel of gold light', 'wan')).toBe('tunnel');
  });

  it('keeps the earlier keywords winning where rules overlap', () => {
    // 'underwater' lives in the ocean rule, which is evaluated first.
    expect(pickClip('an underwater reef', 'wan')).toBe('ocean');
    // 'galaxy' still routes to the starfield clip.
    expect(pickClip('a spiral galaxy', 'wan')).toBe('space');
  });

  it('prefers prompt keywords over the engine default', () => {
    // "ocean" wins even though the wan profile defaults to space.
    expect(pickClip('ocean', 'wan')).toBe('ocean');
  });
});
