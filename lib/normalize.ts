export function normalizeTerm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
