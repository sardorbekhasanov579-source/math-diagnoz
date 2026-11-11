// Operations on the textbook catalog. Keep tests, questions and other books intact.
export class CatalogError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'CatalogError'; this.status = status }
}

const validId = id => Number.isSafeInteger(id) && id > 0
export function patchBookCatalog(books, id, changes) {
  if (!Array.isArray(books)) throw new CatalogError('Darsliklar katalogi noto‘g‘ri holatda.', 500)
  if (!validId(id)) throw new CatalogError('Darslik identifikatori noto‘g‘ri.')
  const idx = books.findIndex(b => b.id === id)
  if (idx < 0) throw new CatalogError('Darslik topilmadi. Ro‘yxatni yangilang.', 404)
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new CatalogError('Tahrir ma’lumotlari noto‘g‘ri.')
  if (typeof changes.title !== 'string') throw new CatalogError('Darslik nomini kiriting.')
  const title = changes.title.trim()
  if (title.length < 2 || title.length > 160) throw new CatalogError('Darslik nomi 2–160 belgidan iborat bo‘lsin.')
  if (typeof changes.author !== 'string' || changes.author.trim().length > 160) throw new CatalogError('Muallif/nashriyot 160 belgidan oshmasin.')
  const oldBook = books[idx]
  const next = {...oldBook, title, author: changes.author.trim() || 'Kiritilmagan'}
  if (Object.prototype.hasOwnProperty.call(changes, 'pdfKey')) {
    if (typeof changes.pdfKey !== 'string' || !/^server:[a-f0-9]{36}$/.test(changes.pdfKey) || typeof changes.pdfName !== 'string' || !/\.pdf$/i.test(changes.pdfName.trim()) || changes.pdfName.trim().length > 180) {
      throw new CatalogError('Yangi PDF ma’lumotlari noto‘g‘ri.')
    }
    next.pdfKey = changes.pdfKey
    next.pdfName = changes.pdfName.trim()
  }
  const updated = [...books]
  updated[idx] = next
  return {books: updated, book: next, previousPdfKey: oldBook.pdfKey}
}

export function removeBookCatalog(books, questions, tests, id) {
  if (!Array.isArray(books) || !Array.isArray(questions) || !Array.isArray(tests)) throw new CatalogError('Katalogni tekshirib bo‘lmadi.', 500)
  if (!validId(id)) throw new CatalogError('Darslik identifikatori noto‘g‘ri.')
  const book = books.find(b => b.id === id)
  if (!book) throw new CatalogError('Darslik allaqachon o‘chirilgan yoki topilmadi.', 404)
  const relatedQuestions = questions.filter(q => q.bookId === id).length
  const relatedTests = tests.filter(t => t.bookId === id).length
  if (relatedQuestions || relatedTests) {
    throw new CatalogError(`Bu darslikda ${relatedQuestions} ta savol va ${relatedTests} ta test bog‘langan. Ularning natijalari buzilmasligi uchun avval bog‘lanishlarni tartibga keltiring.`, 409)
  }
  return {books: books.filter(b => b.id !== id), removedBook: book}
}

export function unusedPdfKey(previousPdfKey, books) {
  if (typeof previousPdfKey !== 'string' || !/^server:[a-f0-9]{36}$/.test(previousPdfKey)) return null
  return books.some(b => b.pdfKey === previousPdfKey) ? null : previousPdfKey.slice(7)
}
