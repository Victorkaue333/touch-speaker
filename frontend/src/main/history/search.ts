// Search normalization (spec historico FR-HIST-10, D5): case, accents and punctuation do not matter —
// "nao quer" finds "Não, quer dizer". Punctuation becomes a space, so "pull-request" and "pull request" meet.
// Letters and digits of any script stay (Unicode \p{L}, \p{N}): "ß", "привет", "日本" are searchable, and only
// the combining marks go (accent folding). A term of punctuation or emoji only normalizes to '' — the service
// answers no entries for it, never the whole list. The same function runs on the term (here) and on every text
// (registered in SQLite by store.ts, computed at query time: nothing normalized is stored). Pure (TEST-012).

export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
