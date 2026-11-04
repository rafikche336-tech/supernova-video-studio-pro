import { getClip, getEngine, type ClipName, type EngineId } from './registry';

/**
 * Prompt → demo clip mapping.
 *
 * v1 scattered this rule set across the page and the API route, and the two
 * copies had already drifted apart. There is now exactly one implementation,
 * imported by both, and covered by unit tests.
 */

interface KeywordRule {
  readonly clip: ClipName;
  readonly keywords: readonly string[];
}

/**
 * Keywords are compared *after* normalisation (lower-cased, diacritics and
 * Arabic harakat stripped). Latin keywords are matched as whole tokens so
 * "season" does not trigger "sea"; non-Latin keywords use substring matching
 * because Arabic and Chinese attach particles and compounds without spaces
 * (e.g. "للبحر" = "to the sea").
 */
const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    clip: 'ocean',
    keywords: [
      'ocean',
      'sea',
      'water',
      'wave',
      'waves',
      'beach',
      'underwater',
      'محيط',
      'بحر',
      'موج',
      'شاطئ',
      'mer',
      'ocean',
      'vague',
      'plage',
      'mar',
      'ola',
      'playa',
      'meer',
      'welle',
      'strand',
      '海',
      '海洋',
      '海滩',
      '浪',
    ],
  },
  {
    clip: 'space',
    keywords: [
      'space',
      'star',
      'stars',
      'galaxy',
      'nebula',
      'cosmic',
      'planet',
      'moon',
      'فضاء',
      'نجم',
      'نجوم',
      'مجرة',
      'كوكب',
      'قمر',
      'espace',
      'etoile',
      'galaxie',
      'lune',
      'espacio',
      'estrella',
      'galaxia',
      'luna',
      'weltraum',
      'stern',
      'sterne',
      'mond',
      '太空',
      '星空',
      '星',
      '银河',
      '月亮',
    ],
  },
  {
    clip: 'forest',
    keywords: [
      'forest',
      'tree',
      'trees',
      'jungle',
      'nature',
      'wood',
      'woods',
      'green',
      'غابة',
      'شجرة',
      'أشجار',
      'طبيعة',
      'foret',
      'arbre',
      'jungle',
      'nature',
      'bosque',
      'arbol',
      'selva',
      'naturaleza',
      'wald',
      'baum',
      'natur',
      'dschungel',
      '森林',
      '树',
      '丛林',
      '自然',
    ],
  },
  {
    clip: 'city',
    keywords: [
      'city',
      'urban',
      'street',
      'streets',
      'skyline',
      'building',
      'buildings',
      'cityscape',
      'مدينة',
      'شارع',
      'شوارع',
      'مبنى',
      'ناطحات',
      'ville',
      'rue',
      'urbain',
      'immeuble',
      'ciudad',
      'calle',
      'urbano',
      'edificio',
      'stadt',
      'strasse',
      'gebaude',
      'skyline',
      '城市',
      '街道',
      '都市',
      '大楼',
    ],
  },
];

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const LATIN_KEYWORD_PATTERN = /^[a-z0-9-]+$/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\u064B-\u0652]/g, ''); // Arabic harakat
}

function tokenize(normalizedText: string): Set<string> {
  return new Set(normalizedText.match(TOKEN_PATTERN) ?? []);
}

function matchesKeyword(keyword: string, tokens: Set<string>, haystack: string): boolean {
  if (LATIN_KEYWORD_PATTERN.test(keyword)) {
    // Whole-token match, with a naive plural so "waves" also hits "wave".
    return tokens.has(keyword) || tokens.has(`${keyword}s`);
  }
  return haystack.includes(keyword);
}

/**
 * Deterministically picks the demo clip for a prompt.
 *
 * @param prompt User prompt (any of the six supported languages).
 * @param engine Engine id — decides the fallback clip when no keyword matches.
 */
export function pickClip(prompt: string, engine: EngineId): ClipName {
  const normalized = normalize(prompt);
  const tokens = tokenize(normalized);

  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (matchesKeyword(keyword, tokens, normalized)) {
        return rule.clip;
      }
    }
  }

  return getEngine(engine).clip;
}

/** Convenience wrapper returning the playable asset for a prompt. */
export function pickClipAsset(prompt: string, engine: EngineId) {
  return getClip(pickClip(prompt, engine));
}
