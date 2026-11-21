export const GPT_CLIENT_MAX_WORDS = 30;

export function countWords(text: string): number {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Guarantees an AI response never exceeds `maxWords` words.
 * If over the limit, trims cleanly at whole-word boundaries and appends
 * a short follow-up prompt within the strict 30-word ceiling.
 */
export function enforceMaxWordsReply(
  text: string,
  maxWords: number = GPT_CLIENT_MAX_WORDS
): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return normalized;

  const followUpWords = ['Posez', 'une', 'question', 'suivante.'];
  if (maxWords <= followUpWords.length + 2) {
    return words.slice(0, Math.max(1, maxWords)).join(' ');
  }

  const keepCount = maxWords - followUpWords.length;
  const head = words.slice(0, keepCount);
  if (head.length > 0) {
    head[head.length - 1] = head[head.length - 1].replace(/[,;:\-]+$/, '') + '…';
  }
  const result = [...head, ...followUpWords].join(' ');
  if (countWords(result) <= maxWords) {
    return result;
  }
  return words.slice(0, maxWords).join(' ');
}
