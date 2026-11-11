// Read-only assignment progress report. No answers or passwords are returned.
// Existing datetime-local strings were stored without a zone. The initial deployment
// serves Uzbek schools (UTC+05:00); newly saved dates have an explicit UTC offset.
export function platformDateMs(value) {
  if(!value)return NaN
  const raw=String(value)
  return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw) ? raw+'+05:00' : raw)
}
export function assignmentStartMs(assignment, test) {
  const values = [assignment?.createdAt, assignment?.startAt, test?.availableFrom]
    .map(value => platformDateMs(value))
    .filter(Number.isFinite)
  // Never imply a start earlier than the assignment was actually sent.
  return Math.max(0, ...values)
}
export function summarizeAssignments(assignments, tests, students, exams, results, now=Date.now()) {
  return assignments.map(assignment => {
    const test = tests.find(item=>Number(item.id)===Number(assignment.testId))
    const startMs = assignmentStartMs(assignment,test)
    const finishMs = test?.availableUntil ? platformDateMs(test.availableUntil) : Infinity
    const studentRows = students.filter(u=>Number(u.classId)===Number(assignment.classId)).map(student=>{
      const attempts = results.filter(r=>Number(r.user_id)===Number(student.id)&&Number(r.test_id)===Number(assignment.testId))
        .map(row=>{try{return typeof row.data==='string'?JSON.parse(row.data):row.data}catch{return null}})
        .filter(Boolean).filter(a=>!assignment.createdAt||Date.parse(a.createdAt)>=Date.parse(assignment.createdAt))
      const running = exams.filter(e=>Number(e.user_id)===Number(student.id)&&Number(e.test_id)===Number(assignment.testId) && e.status==='running')
        .filter(e=>!assignment.createdAt||Number(e.started_at)>=Date.parse(assignment.createdAt))
        .sort((a,b)=>Number(b.started_at)-Number(a.started_at))[0]
      const last = attempts.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]
      const status = last ? 'finished' : running && Number(running.deadline_at)>now ? 'running'
        : running ? 'expired' : now<startMs ? 'scheduled' : now>=finishMs ? 'closed' : 'pending'
      return {id:student.id,name:student.name,status,attempts:attempts.length,
        score:last?.score??null,total:last?.total??null,
        finishedAt:last?.createdAt||null,startedAt:running?.started_at||null}
    })
    return {id:assignment.id,testId:assignment.testId,classId:assignment.classId,
      startAt:startMs?new Date(startMs).toISOString():null,
      endAt:Number.isFinite(finishMs)?new Date(finishMs).toISOString():null,
      total:studentRows.length,finished:studentRows.filter(s=>s.status==='finished').length,
      running:studentRows.filter(s=>s.status==='running').length,
      waiting:studentRows.filter(s=>s.status==='pending'||s.status==='scheduled').length,
      expired:studentRows.filter(s=>s.status==='expired'||s.status==='closed').length,
      students:studentRows}
  })
}
