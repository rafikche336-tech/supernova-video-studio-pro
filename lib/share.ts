import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford-style, no look-alikes
const SLUG_LENGTH = 10;

/**
 * Short, URL-safe, unguessable share id.
 *
 * 10 characters from a 32-symbol alphabet ≈ 50 bits of entropy — enough that
 * share links cannot be enumerated, and short enough to paste in a chat.
 */
export function generateShareSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  let slug = '';

  for (const byte of bytes) {
    slug += ALPHABET[byte % ALPHABET.length] ?? '0';
  }

  return slug;
}

export function isShareSlug(value: string): boolean {
  return value.length === SLUG_LENGTH && [...value].every((char) => ALPHABET.includes(char));
}

export function shareUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, '')}/s/${slug}`;
}
