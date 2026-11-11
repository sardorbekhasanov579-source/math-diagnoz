import test from 'node:test'
import assert from 'node:assert/strict'
import {assignmentStartMs,summarizeAssignments} from '../server/assignment-monitor.mjs'
const time=(min)=>Date.parse('2026-11-11T12:00:00Z')+min*60000
const date=(min)=>new Date(time(min)).toISOString()
const a={id:2, testId:7, classId:10, createdAt:date(0)}
const t={id:7, availableFrom:date(3), availableUntil:date(90)}
test('assigned start time is maximum of assignment sent, chosen start and test window',()=>{
 assert.equal(assignmentStartMs({...a,startAt:date(15)},t),time(15))
 assert.equal(assignmentStartMs(a,t),time(3))
 assert.equal(assignmentStartMs({...a,createdAt:date(10)},{availableFrom:date(0)}),time(10))
})
test('student assigned for later may not start early and remains scheduled',()=>{
 const x=summarizeAssignments([{...a,startAt:date(25)}],[t],[{id:1,name:'Student',classId:10}],[],[],time(20))[0]
 assert.equal(x.total,1);assert.equal(x.waiting,1);assert.equal(x.students[0].status,'scheduled')
 assert.equal(x.startAt,date(25))
})
test('completed test shows score and class-specific stats without answers',()=>{
 const r={user_id:1,test_id:7,data:JSON.stringify({testId:7,score:4,total:5,createdAt:date(30)})}
 const x=summarizeAssignments([a],[t],[{id:1,name:'A',classId:10},{id:2,name:'B',classId:10},{id:3,name:'C',classId:11}],[],[r],time(40))[0]
 assert.equal(x.total,2);assert.equal(x.finished,1);assert.equal(x.waiting,1)
 assert.equal(x.students[0].score,4)
 assert.equal(JSON.stringify(x).includes('correct'),false)
})
test('running and expired exam status',()=>{
 const rows=[{id:1,name:'A',classId:10},{id:2,name:'B',classId:10}]
 const running=[{user_id:1,test_id:7,started_at:time(30),deadline_at:time(70),status:'running'},
                {user_id:2,test_id:7,started_at:time(30),deadline_at:time(35),status:'running'}]
 const x=summarizeAssignments([a],[t],rows,running,[],time(40))[0]
 assert.equal(x.running,1);assert.equal(x.expired,1)
 assert.equal(x.students[0].status,'running');assert.equal(x.students[1].status,'expired')
})
test('previous assignment results are not counted as new assignment',()=>{
 const newer={...a,createdAt:date(30)}
 const olderResult=[{user_id:1,test_id:7,data:JSON.stringify({score:3,total:5,createdAt:date(5)})}]
 const x=summarizeAssignments([newer],[t],[{id:1,name:'A',classId:10}],[],olderResult,time(40))[0]
 assert.equal(x.finished,0)
})
test('closed test without attempts is not counted as pending',()=>{
 const x=summarizeAssignments([a],[{id:7,availableUntil:date(4)}],[{id:1,name:'A',classId:10}],[],[],time(30))[0]
 assert.equal(x.expired,1);assert.equal(x.students[0].status,'closed')
})
test('legacy datetime-local values resolve in Uzbekistan timezone', async()=>{
 const {platformDateMs}=await import('../server/assignment-monitor.mjs')
 assert.equal(platformDateMs('2026-11-11T17:00'),Date.parse('2026-11-11T12:00:00Z'))
 assert.equal(platformDateMs('2026-11-11T17:00:00Z'),Date.parse('2026-11-11T17:00:00Z'))
})
