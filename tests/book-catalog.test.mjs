import test from 'node:test'
import assert from 'node:assert/strict'
import {patchBookCatalog,removeBookCatalog,unusedPdfKey,CatalogError} from '../server/book-catalog.mjs'
const key='server:'+'a'.repeat(36)
const otherKey='server:'+'b'.repeat(36)
const sample=[{id:1,title:'Matematika',author:'Kiritilmagan',grade:5,chapters:[{id:1,title:'Asoslar',topics:['Kasrlar']}],pdfKey:key,pdfName:'math.pdf'},
{id:2,title:'She’riyat',author:'Kiritilmagan',grade:5,chapters:[],pdfKey:otherKey,pdfName:'she.pdf'}]
test('tahrirlash nom va muallifni o‘zgartirib, bob va PDFni saqlaydi',()=>{
 const r=patchBookCatalog(sample,2,{title:'  She’riyat 5-sinf  ',author:'  O. Muxtor '})
 assert.equal(r.book.title,'She’riyat 5-sinf');assert.equal(r.book.author,'O. Muxtor'); assert.equal(r.book.pdfKey,otherKey)
 assert.equal(sample[1].title,'She’riyat');assert.equal(r.books[0],sample[0]);assert.equal(r.books[1].chapters,sample[1].chapters)
})
test('pdfni almashtirish kalitini saqlaydi va eski kalitni qaytaradi',()=>{
 const r=patchBookCatalog(sample,2,{title:'She’riyat',author:'',pdfKey:key,pdfName:'new.pdf'})
 assert.equal(r.book.pdfKey,key);assert.equal(r.previousPdfKey,otherKey)
})
test('bo‘sh nom va noto‘g‘ri PDF rad qilinadi',()=>{
 assert.throws(()=>patchBookCatalog(sample,2,{title:' ',author:''}),CatalogError)
 assert.throws(()=>patchBookCatalog(sample,2,{title:'Darslik',author:'',pdfKey:'server:../../passwd',pdfName:'x.pdf'}),CatalogError)
})
test('savoli bor darslik o‘chirilmaydi',()=>{
 assert.throws(()=>removeBookCatalog(sample,[{bookId:1}],[],1),e=>e.status===409)
})
test('testi bor darslik o‘chirilmaydi',()=>{
 assert.throws(()=>removeBookCatalog(sample,[],[{bookId:1}],1),e=>e.status===409)
})
test('savolsiz, testsiz darslik to‘liq ro‘yxatdan o‘chadi',()=>{
 const r=removeBookCatalog(sample,[],[],2)
 assert.deepEqual(r.books,[sample[0]]);assert.equal(r.removedBook.title,'She’riyat');assert.equal(sample.length,2)
})
test('pdf faqat boshqa darslikda qo‘llanilmasa o‘chirilsin',()=>{
 assert.equal(unusedPdfKey(otherKey,[sample[0]]),'b'.repeat(36));assert.equal(unusedPdfKey(key,[sample[0]]),null)
})
test('mavjud bo‘lmagan darslikni o‘chirish 404 beradi',()=>{
 assert.throws(()=>removeBookCatalog(sample,[],[],4),e=>e.status===404)
})
