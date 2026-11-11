/** Small pure helpers shared by teacher/parent-link API and its tests. */
export function normalizeIds(input) {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map(Number).filter(x => Number.isSafeInteger(x) && x > 0))]
}
export function updatedChildIds(existing, studentId, operation) {
  const ids = normalizeIds(existing)
  const id = Number(studentId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('O‘quvchi identifikatori noto‘g‘ri')
  if (operation === 'link') return [...new Set([...ids, id])]
  if (operation === 'unlink') return ids.filter(x => x !== id)
  throw new Error('Bog‘lash amali noto‘g‘ri')
}
