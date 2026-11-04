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
  {
    clip: 'desert',
    keywords: [
      'desert',
      'dune',
      'dunes',
      'sand',
      'sahara',
      'صحراء',
      'رمل',
      'كثبان',
      'sable',
      'desierto',
      'arena',
      'duna',
      'wuste',
      '沙漠',
      '沙丘',
    ],
  },
  {
    clip: 'aurora',
    keywords: [
      'aurora',
      'borealis',
      'polar',
      'الشفق',
      'القطبي',
      'aurore',
      'boreale',
      'polarlicht',
      '极光',
      '北极光',
    ],
  },
  {
    clip: 'snow',
    keywords: [
      'snow',
      'winter',
      'ice',
      'frost',
      'blizzard',
      'ثلج',
      'شتاء',
      'جليد',
      'neige',
      'hiver',
      'glace',
      'nieve',
      'invierno',
      'hielo',
      'schnee',
      'eis',
      '雪',
      '冬',
      '冰',
    ],
  },
  {
    clip: 'neon',
    keywords: ['neon', 'cyberpunk', 'synthwave', 'nightclub', 'نيون', 'neons', 'neón', '霓虹'],
  },
  {
    clip: 'embers',
    keywords: [
      'ember',
      'embers',
      'fire',
      'flame',
      'flames',
      'spark',
      'sparks',
      'جمر',
      'نار',
      'لهب',
      'braise',
      'feu',
      'flamme',
      'brasas',
      'fuego',
      'llama',
      'glut',
      'feuer',
      '火焰',
      '火',
    ],
  },
  {
    clip: 'ink',
    keywords: [
      'ink',
      'smoke',
      'swirl',
      'حبر',
      'دخان',
      'encre',
      'fumee',
      'tinta',
      'humo',
      'tinte',
      'rauch',
      '墨',
      '烟',
    ],
  },
  {
    clip: 'underwater',
    keywords: [
      'coral',
      'reef',
      'diving',
      'scuba',
      'أعماق',
      'مرجان',
      'corail',
      'arrecife',
      'korallen',
      '珊瑚',
      '水下',
    ],
  },
  {
    clip: 'ruins',
    keywords: [
      'ruins',
      'ancient',
      'temple',
      'archaeology',
      'أطلال',
      'معبد',
      'ruines',
      'ruinas',
      'templo',
      'ruinen',
      'tempel',
      '废墟',
      '神庙',
      '遗迹',
    ],
  },
  {
    clip: 'clouds',
    keywords: [
      'cloud',
      'clouds',
      'sky',
      'heaven',
      'سحاب',
      'سحابة',
      'سماء',
      'nuage',
      'nuages',
      'ciel',
      'nube',
      'nubes',
      'cielo',
      'wolke',
      'wolken',
      'himmel',
      '云',
      '天空',
      '云朵',
    ],
  },
  {
    clip: 'lava',
    keywords: ['lava', 'volcano', 'magma', 'حمم', 'بركان', 'lave', 'volcan', '熔岩', '火山'],
  },
  {
    clip: 'fireworks',
    keywords: [
      'firework',
      'fireworks',
      'celebration',
      'ألعاب نارية',
      'احتفال',
      'feux',
      'artifice',
      'fuegos',
      'artificiales',
      'feuerwerk',
      '烟花',
      '焰火',
    ],
  },
  {
    clip: 'mountain',
    keywords: [
      'mountain',
      'mountains',
      'peak',
      'summit',
      'alps',
      'جبل',
      'جبال',
      'قمة',
      'montagne',
      'sommet',
      'montana',
      'montanas',
      'cumbre',
      'berg',
      'gipfel',
      '山',
      '山峰',
      '山脉',
    ],
  },
  {
    clip: 'rainwindow',
    keywords: [
      'rain',
      'rainy',
      'raindrops',
      'مطر',
      'نافذة',
      'pluie',
      'fenetre',
      'lluvia',
      'ventana',
      'regen',
      'fenster',
      '雨',
      '窗户',
    ],
  },
  {
    clip: 'cyber',
    keywords: [
      'cyber',
      'futuristic',
      'scifi',
      'hologram',
      'سايبر',
      'مستقبلي',
      'futuriste',
      'futurista',
      '赛博',
      '未来',
    ],
  },
  {
    clip: 'storm',
    keywords: [
      'storm',
      'lightning',
      'thunder',
      'عاصفة',
      'برق',
      'رعد',
      'orage',
      'eclair',
      'tempete',
      'tormenta',
      'rayo',
      'gewitter',
      'blitz',
      '风暴',
      '闪电',
      '雷',
    ],
  },
  {
    clip: 'blossom',
    keywords: [
      'blossom',
      'cherry',
      'sakura',
      'petals',
      'spring',
      'زهور',
      'كرز',
      'ربيع',
      'fleur',
      'fleurs',
      'cerisier',
      'flores',
      'cerezo',
      'primavera',
      'bluten',
      'kirsch',
      'fruhling',
      '樱花',
      '花',
      '春天',
    ],
  },
  {
    clip: 'tunnel',
    keywords: ['tunnel', 'corridor', 'portal', 'نفق', 'ممر', 'tunel', 'gang', '隧道', '通道'],
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
