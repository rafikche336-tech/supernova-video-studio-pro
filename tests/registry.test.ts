import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIPS, ENGINE_IDS, ENGINES, getEngine, isEngineId } from '@/lib/engines/registry';

describe('engine registry', () => {
  it('has unique engine ids', () => {
    const ids = ENGINES.map((engine) => engine.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes a stable id list that matches the catalogue', () => {
    expect(ENGINE_IDS).toEqual(ENGINES.map((engine) => engine.id));
  });

  it('only accepts known engine ids', () => {
    expect(isEngineId('wan')).toBe(true);
    expect(isEngineId('mochi')).toBe(true);

    // The v1 prototype-pollution bug: these used to resolve via the prototype chain.
    expect(isEngineId('__proto__')).toBe(false);
    expect(isEngineId('constructor')).toBe(false);
    expect(isEngineId('toString')).toBe(false);

    expect(isEngineId('wan2.2')).toBe(false);
    expect(isEngineId(undefined)).toBe(false);
    expect(isEngineId(42)).toBe(false);
  });

  it('points every engine at a defined clip', () => {
    for (const engine of ENGINES) {
      expect(Object.keys(CLIPS)).toContain(engine.clip);
    }
  });

  it('ships every clip file referenced by the registry', () => {
    for (const [name, clip] of Object.entries(CLIPS)) {
      const videoPath = join(process.cwd(), 'public', clip.src);
      const posterPath = join(process.cwd(), 'public', clip.poster);

      expect(existsSync(videoPath), `missing video for "${name}": ${clip.src}`).toBe(true);
      expect(existsSync(posterPath), `missing poster for "${name}": ${clip.poster}`).toBe(true);
    }
  });

  it('throws on an unknown engine instead of returning undefined', () => {
    // @ts-expect-error — deliberately passing an id outside the union.
    expect(() => getEngine('nope')).toThrow(/Unknown engine id/);
  });
});
