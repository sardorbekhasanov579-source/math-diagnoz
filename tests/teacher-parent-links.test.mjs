import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIds, updatedChildIds } from '../server/teacher-parent-links.mjs'

test('same parent may retain several students without duplicates',()=>{
  assert.deepEqual(updatedChildIds([3,5],8,'link'),[3,5,8])
  assert.deepEqual(updatedChildIds([3,5],3,'link'),[3,5])
})
test('unlink only the selected child, not the other siblings',()=>{
  assert.deepEqual(updatedChildIds([3,5,8],5,'unlink'),[3,8])
})
test('bad input and unsupported operations rejected',()=>{
  assert.deepEqual(normalizeIds([3,'3',5,-5,'x',null]),[3,5])
  assert.throws(()=>updatedChildIds([1],0,'link'))
  assert.throws(()=>updatedChildIds([1],2,'erase'))
})
