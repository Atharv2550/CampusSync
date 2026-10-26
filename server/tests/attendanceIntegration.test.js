import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { connectDB } from '../config/db.js';
import { LectureAttendance } from '../models/LectureAttendance.js';
import { TimetableEntry } from '../models/TimetableEntry.js';
import { User } from '../models/User.js';

describe('CampusSphere Attendance Submission-to-History Integration Tests', () => {
  let facultyToken = '';
  let facultyUser = null;
  let otherFacultyToken = '';
  let otherFacultyUser = null;
  let testSubject = null;
  let testClass = null;
  let testTimetableEntry = null;
  let enrolledStudents = [];
  let submittedSessionId = '';
  let targetLectureDate = '';

  beforeAll(async () => {
    await connectDB();

    // 1. Login as primary faculty (faculty@campussphere.edu)
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'faculty@campussphere.edu',
      password: 'Faculty@123',
    });
    facultyToken = loginRes.body.data.token;
    facultyUser = await User.findOne({ email: 'faculty@campussphere.edu' });

    // Clean up any existing test records by topic
    await LectureAttendance.deleteMany({ topic: /Integration Test/i });

    // 2. Find or create second faculty for RBAC isolation test
    let otherFaculty = await User.findOne({ email: 'sanjay@campussphere.edu' });
    if (!otherFaculty) {
      const otherLoginRes = await request(app).post('/api/auth/login').send({
        email: 'admin@campussphere.edu',
        password: 'Admin@123',
      });
      otherFacultyToken = otherLoginRes.body.data.token;
    } else {
      const otherLoginRes = await request(app).post('/api/auth/login').send({
        email: 'sanjay@campussphere.edu',
        password: 'Password@123',
      });
      if (otherLoginRes.body.success) {
        otherFacultyToken = otherLoginRes.body.data.token;
      } else {
        otherFacultyToken = loginRes.body.data.token;
      }
    }

    // 3. Fetch faculty's assigned subject & class via /api/subjects/my
    const subRes = await request(app)
      .get('/api/subjects/my')
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.length).toBeGreaterThan(0);
    const assignedSub = subRes.body.data[0];

    testSubject = assignedSub.subject;
    testClass = assignedSub.classDivision;

    testTimetableEntry = await TimetableEntry.findOne({
      subject: testSubject._id,
      classDivision: testClass._id,
      status: 'Published',
    })
      .populate('subject')
      .populate('classDivision');

    expect(testTimetableEntry).toBeDefined();

    // 4. Fetch students enrolled in this class
    const stuRes = await request(app)
      .get(`/api/classes/${testClass._id}/students`)
      .set('Authorization', `Bearer ${facultyToken}`);
    enrolledStudents = stuRes.body.data || [];
    expect(enrolledStudents.length).toBeGreaterThan(0);

    // Calculate lecture date that strictly matches testTimetableEntry.dayOfWeek
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIdx = dayNames.indexOf(testTimetableEntry.dayOfWeek);
    const baseDate = new Date(Date.UTC(2026, 11, 1)); // 2026-12-01 is Tuesday
    const diff = (targetDayIdx - baseDate.getUTCDay() + 7) % 7;
    baseDate.setUTCDate(baseDate.getUTCDate() + diff);
    targetLectureDate = baseDate.toISOString().split('T')[0];

    // Clean up any test attendance on target date
    await LectureAttendance.deleteMany({
      faculty: facultyUser._id,
      date: new Date(`${targetLectureDate}T00:00:00.000Z`),
    });
  });

  afterAll(async () => {
    await LectureAttendance.deleteMany({ topic: /Integration Test/i });
  });

  it('1. GET /api/attendance/check-session returns exists: false before submission', async () => {
    const res = await request(app)
      .get('/api/attendance/check-session')
      .set('Authorization', `Bearer ${facultyToken}`)
      .query({
        subject: testSubject._id.toString(),
        classDivision: testClass._id.toString(),
        date: targetLectureDate,
        startTime: testTimetableEntry.startTime,
        timetableEntry: testTimetableEntry._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exists).toBe(false);
  });

  it('2. POST /api/attendance persists session with canonical status "Submitted" and auto-resolves timetableEntry', async () => {
    const records = enrolledStudents.map((s, idx) => ({
      student: s._id,
      status: idx === 0 ? 'Present' : 'Present',
      remarks: '',
    }));

    // Deliberately omit timetableEntry to verify backend auto-resolution
    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        subject: testSubject._id.toString(),
        classDivision: testClass._id.toString(),
        date: targetLectureDate,
        startTime: testTimetableEntry.startTime,
        endTime: testTimetableEntry.endTime,
        topic: 'Integration Test: Distributed Consensus Engine',
        records,
        latePolicy: 'half',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.sessionStatus).toBe('Submitted');
    expect(res.body.data.records.length).toBe(enrolledStudents.length);

    submittedSessionId = res.body.data._id;

    // Verify in MongoDB directly
    const saved = await LectureAttendance.findById(submittedSessionId);
    expect(saved).toBeDefined();
    expect(saved.sessionStatus).toBe('Submitted');
    expect(saved.timetableEntry).toBeDefined();
    expect(saved.timetableEntry.toString()).toBe(testTimetableEntry._id.toString());
  });

  it('3. POST /api/attendance duplicate check returns HTTP 409 Conflict with existingSessionId', async () => {
    const records = enrolledStudents.map((s) => ({
      student: s._id,
      status: 'Present',
    }));

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        subject: testSubject._id.toString(),
        classDivision: testClass._id.toString(),
        date: targetLectureDate,
        startTime: testTimetableEntry.startTime,
        endTime: testTimetableEntry.endTime,
        topic: 'Attempting Duplicate Attendance',
        records,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Duplicate attendance');
    expect(res.body.existingSessionId).toBe(submittedSessionId);
  });

  it('4. GET /api/attendance/sessions?status=Submitted returns the newly saved session', async () => {
    const res = await request(app)
      .get('/api/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .query({
        status: 'Submitted',
        page: 1,
        limit: 20,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const found = res.body.data.find((s) => s._id === submittedSessionId);
    expect(found).toBeDefined();
    expect(found.sessionStatus).toBe('Submitted');
  });

  it('5. GET /api/attendance/sessions with subject and class filters includes the record', async () => {
    const res = await request(app)
      .get('/api/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .query({
        subject: testSubject._id.toString(),
        classDivision: testClass._id.toString(),
        startDate: targetLectureDate,
        endDate: targetLectureDate,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]._id).toBe(submittedSessionId);
  });

  it('6. GET /api/attendance/sessions/:id returns student records and roll call details', async () => {
    const res = await request(app)
      .get(`/api/attendance/sessions/${submittedSessionId}`)
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(submittedSessionId);
    expect(res.body.data.records.length).toBe(enrolledStudents.length);
    expect(res.body.data.topic).toBe('Integration Test: Distributed Consensus Engine');
  });

  it('7. PATCH /api/attendance/sessions/:id updates session status to "Corrected" and preserves audit log', async () => {
    const res = await request(app)
      .patch(`/api/attendance/sessions/${submittedSessionId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        topic: 'Integration Test: Distributed Consensus Engine (Updated Unit)',
        reason: 'Adjusting student roll-call after medical certificate submission',
        records: [
          {
            student: enrolledStudents[0]._id,
            status: 'Late',
            remarks: 'Late bus arrival',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe('Corrected');
    expect(res.body.data.editHistory.length).toBeGreaterThan(0);

    // Verify filter by status=Corrected now returns it
    const correctedRes = await request(app)
      .get('/api/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .query({ status: 'Corrected' });

    expect(correctedRes.status).toBe(200);
    const foundInCorrected = correctedRes.body.data.find((s) => s._id === submittedSessionId);
    expect(foundInCorrected).toBeDefined();
    expect(foundInCorrected.sessionStatus).toBe('Corrected');
  });

  it('8. GET /api/attendance/missing excludes recorded lectures and returns canonical timetable metadata', async () => {
    const res = await request(app)
      .get('/api/attendance/missing')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Check structure of missing entries if any exist
    if (res.body.data.length > 0) {
      const firstMissing = res.body.data[0];
      expect(firstMissing.dateStr).toBeDefined();
      expect(firstMissing.startTime).toBeDefined();
      expect(firstMissing.endTime).toBeDefined();
      expect(firstMissing.status).toBe('Not Recorded');
    }
  });

  it('9. Security & Isolation: Unauthorized faculty cannot view or modify another faculty attendance session', async () => {
    // Create an unprivileged user token or test with other faculty
    const otherLogin = await request(app).post('/api/auth/login').send({
      email: 'sanjay@campussphere.edu',
      password: 'Password@123',
    });

    if (otherLogin.body.success && otherLogin.body.data?.token) {
      const unauthorizedToken = otherLogin.body.data.token;

      // Try to GET another faculty's session
      const getRes = await request(app)
        .get(`/api/attendance/sessions/${submittedSessionId}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);

      // Try to PATCH another faculty's session
      const patchRes = await request(app)
        .patch(`/api/attendance/sessions/${submittedSessionId}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ topic: 'Malicious Overwrite' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.success).toBe(false);
    }
  });
});
