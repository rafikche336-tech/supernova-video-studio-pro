/**
 * Typed translations for the six supported interface languages.
 *
 * The `Dictionary` interface is the contract: adding a key makes TypeScript
 * fail until every locale provides it, so a half-translated UI cannot ship.
 * Dates/numbers are not formatted here (the app shows none); if that changes,
 * use `Intl.*` with the active locale.
 */

export const LOCALES = ['en', 'ar', 'fr', 'es', 'de', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

export type Direction = 'ltr' | 'rtl';

export interface Dictionary {
  /** Native name of the language, used for accessible labels. */
  readonly label: string;
  /** Two-letter chip shown in the picker. */
  readonly shortLabel: string;
  readonly dir: Direction;
  readonly brand: string;
  readonly brandAccent: string;
  readonly tagline: string;
  readonly demoNotice: string;
  readonly enginesTitle: string;
  readonly promptLabel: string;
  readonly promptPlaceholder: string;
  readonly generate: string;
  readonly generating: string;
  readonly cancel: string;
  readonly download: string;
  readonly ready: string;
  readonly failed: string;
  readonly retry: string;
  readonly progress: string;
  readonly footer: string;
  readonly languageLabel: string;
  readonly skipToContent: string;
  readonly videoUnsupported: string;
  readonly requiresJavaScript: string;
  readonly share: string;
  readonly shareCopied: string;
  readonly signIn: string;
  readonly recentRenders: string;
  readonly noRenders: string;
}

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en: {
    label: 'English',
    shortLabel: 'EN',
    dir: 'ltr',
    brand: 'SUPERNOVA',
    brandAccent: 'VIDEO STUDIO PRO',
    tagline: 'One studio, every engine: describe a shot, pick a profile, get video.',
    demoNotice:
      'Demo mode — renders use bundled clips, not a paid model. Add a fal.ai or Replicate key to generate real video; accounts, history and downloads are already real.',
    enginesTitle: 'Engines',
    promptLabel: 'Describe your shot',
    promptPlaceholder: 'A cinematic shot of…',
    generate: 'Generate video',
    generating: 'Generating…',
    cancel: 'Cancel',
    download: 'Download',
    ready: 'Video ready',
    failed: 'Something went wrong.',
    retry: 'Try again',
    progress: 'Render progress',
    footer: 'Supernova V3 — 24 clips — free — built in Algeria',
    languageLabel: 'Language',
    skipToContent: 'Skip to the studio',
    videoUnsupported: 'Your browser cannot play this clip.',
    share: 'Share',
    shareCopied: 'Link copied',
    signIn: 'Sign in',
    recentRenders: 'Recent renders',
    noRenders: 'Nothing here yet — generate your first clip.',
    requiresJavaScript: 'This studio needs JavaScript to generate clips.',
  },
  ar: {
    label: 'العربية',
    shortLabel: 'AR',
    dir: 'rtl',
    brand: 'سوبرنوفا',
    brandAccent: 'استوديو الفيديو برو',
    tagline: 'استوديو واحد لكل المحركات: صِف اللقطة، اختر النمط، واحصل على الفيديو.',
    demoNotice:
      'وضع العرض — تُستخدم مقاطع جاهزة بدلًا من نموذج مدفوع. أضف مفتاح fal.ai أو Replicate لتوليد فيديو حقيقي؛ الحسابات والسجل والتنزيلات حقيقية بالفعل.',
    enginesTitle: 'المحركات',
    promptLabel: 'صِف اللقطة',
    promptPlaceholder: 'لقطة سينمائية لـ…',
    generate: 'إنشاء فيديو',
    generating: 'جارٍ الإنشاء…',
    cancel: 'إلغاء',
    download: 'تحميل',
    ready: 'الفيديو جاهز',
    failed: 'حدث خطأ ما.',
    retry: 'إعادة المحاولة',
    progress: 'تقدّم الإنشاء',
    footer: 'سوبرنوفا V3 — ٢٤ مقطعًا — مجاني — صُنع في الجزائر',
    languageLabel: 'اللغة',
    skipToContent: 'تخطَّ إلى الاستوديو',
    videoUnsupported: 'متصفحك لا يدعم تشغيل هذا المقطع.',
    share: 'مشاركة',
    shareCopied: 'تم نسخ الرابط',
    signIn: 'تسجيل الدخول',
    recentRenders: 'أحدث الأعمال',
    noRenders: 'لا يوجد شيء بعد — أنشئ أول مقطع لك.',
    requiresJavaScript: 'يحتاج هذا الاستوديو إلى JavaScript لإنشاء المقاطع.',
  },
  fr: {
    label: 'Français',
    shortLabel: 'FR',
    dir: 'ltr',
    brand: 'SUPERNOVA',
    brandAccent: 'STUDIO VIDÉO PRO',
    tagline:
      'Un seul studio pour tous les moteurs : décrivez un plan, choisissez un profil, obtenez une vidéo.',
    demoNotice:
      'Mode démo — les clips sont des aperçus générés par programme. Ajoutez une clé fal.ai ou Replicate pour générer de vraies vidéos.',
    enginesTitle: 'Moteurs',
    promptLabel: 'Décrivez votre plan',
    promptPlaceholder: 'Un plan cinématographique de…',
    generate: 'Générer la vidéo',
    generating: 'Génération…',
    cancel: 'Annuler',
    download: 'Télécharger',
    ready: 'Vidéo prête',
    failed: 'Une erreur est survenue.',
    retry: 'Réessayer',
    progress: 'Progression du rendu',
    footer: 'Supernova V3 — 24 clips — gratuit — conçu en Algérie',
    languageLabel: 'Langue',
    skipToContent: 'Aller au studio',
    videoUnsupported: 'Votre navigateur ne peut pas lire ce clip.',
    share: 'Partager',
    shareCopied: 'Lien copié',
    signIn: 'Se connecter',
    recentRenders: 'Rendus récents',
    noRenders: 'Rien pour le moment — générez votre premier clip.',
    requiresJavaScript: 'Ce studio nécessite JavaScript pour générer des clips.',
  },
  es: {
    label: 'Español',
    shortLabel: 'ES',
    dir: 'ltr',
    brand: 'SUPERNOVA',
    brandAccent: 'ESTUDIO DE VÍDEO PRO',
    tagline:
      'Un solo estudio para todos los motores: describe un plano, elige un perfil y obtén el vídeo.',
    demoNotice:
      'Modo demo: los clips son vistas previas generadas por programa. Añade una clave de fal.ai o Replicate para generar vídeo real.',
    enginesTitle: 'Motores',
    promptLabel: 'Describe tu plano',
    promptPlaceholder: 'Un plano cinematográfico de…',
    generate: 'Generar vídeo',
    generating: 'Generando…',
    cancel: 'Cancelar',
    download: 'Descargar',
    ready: 'Vídeo listo',
    failed: 'Algo ha salido mal.',
    retry: 'Reintentar',
    progress: 'Progreso del render',
    footer: 'Supernova V3 — 24 clips — gratis — hecho en Argelia',
    languageLabel: 'Idioma',
    skipToContent: 'Ir al estudio',
    videoUnsupported: 'Tu navegador no puede reproducir este clip.',
    share: 'Compartir',
    shareCopied: 'Enlace copiado',
    signIn: 'Iniciar sesión',
    recentRenders: 'Renders recientes',
    noRenders: 'Todavía nada — genera tu primer clip.',
    requiresJavaScript: 'Este estudio necesita JavaScript para generar clips.',
  },
  de: {
    label: 'Deutsch',
    shortLabel: 'DE',
    dir: 'ltr',
    brand: 'SUPERNOVA',
    brandAccent: 'VIDEO-STUDIO PRO',
    tagline: 'Ein Studio für alle Engines: Szene beschreiben, Profil wählen, Video erhalten.',
    demoNotice:
      'Demo-Modus — die Clips sind programmatisch erzeugte Vorschauen. Mit einem fal.ai- oder Replicate-Schlüssel entstehen echte Videos.',
    enginesTitle: 'Engines',
    promptLabel: 'Beschreibe deine Szene',
    promptPlaceholder: 'Eine filmische Aufnahme von…',
    generate: 'Video erstellen',
    generating: 'Wird erstellt…',
    cancel: 'Abbrechen',
    download: 'Herunterladen',
    ready: 'Video fertig',
    failed: 'Etwas ist schiefgelaufen.',
    retry: 'Erneut versuchen',
    progress: 'Fortschritt',
    footer: 'Supernova V3 — 24 Clips — kostenlos — gebaut in Algerien',
    languageLabel: 'Sprache',
    skipToContent: 'Zum Studio springen',
    videoUnsupported: 'Dein Browser kann diesen Clip nicht abspielen.',
    share: 'Teilen',
    shareCopied: 'Link kopiert',
    signIn: 'Anmelden',
    recentRenders: 'Letzte Renderings',
    noRenders: 'Noch nichts hier — erzeuge deinen ersten Clip.',
    requiresJavaScript: 'Dieses Studio benötigt JavaScript, um Clips zu erzeugen.',
  },
  zh: {
    label: '中文',
    shortLabel: 'ZH',
    dir: 'ltr',
    brand: 'SUPERNOVA',
    brandAccent: '视频工作室专业版',
    tagline: '一个工作室，所有引擎：描述镜头，选择风格，即刻生成视频。',
    demoNotice:
      '演示模式 — 使用内置片段而非付费模型。添加 fal.ai 或 Replicate 密钥即可生成真实视频；账户、历史记录与下载均为真实功能。',
    enginesTitle: '引擎',
    promptLabel: '描述你的镜头',
    promptPlaceholder: '一个电影感的…',
    generate: '生成视频',
    generating: '生成中…',
    cancel: '取消',
    download: '下载',
    ready: '视频已就绪',
    failed: '出了点问题。',
    retry: '重试',
    progress: '生成进度',
    footer: 'Supernova V3 — 24 个片段 — 免费 — 阿尔及利亚打造',
    languageLabel: '语言',
    skipToContent: '跳到工作室',
    videoUnsupported: '你的浏览器无法播放此片段。',
    share: '分享',
    shareCopied: '链接已复制',
    signIn: '登录',
    recentRenders: '最近的渲染',
    noRenders: '暂无内容 — 立即生成你的第一个片段。',
    requiresJavaScript: '此工作室需要 JavaScript 才能生成片段。',
  },
};

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function directionFor(locale: Locale): Direction {
  return DICTIONARIES[locale].dir;
}
