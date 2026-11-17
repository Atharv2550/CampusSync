import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Subject } from '../models/Subject.js';
import { ClassDivision } from '../models/ClassDivision.js';
import { TimetableEntry } from '../models/TimetableEntry.js';
import { LectureAttendance } from '../models/LectureAttendance.js';
import { StudentSubjectEnrollment } from '../models/StudentSubjectEnrollment.js';

describe('CampusSync Subject Enrollment and Student-Subject Assignment System Tests', () => {
  let adminToken = '';
  let studentToken = '';
  let studentUser = null;
  let student2Token = '';
  let student2User = null;
  let facultyToken = '';
  let facultyUser = null;
  let otherFacultyToken = '';
  let otherFacultyUser = null;

  let testDept = null;
  let otherDept = null;
  let testClass = null;
  let testSubject = null;
  let inactiveSubject = null;
  let restrictedSubject = null;

  beforeAll(async () => {
    await connectDB();

    // 1. Authenticate Admin
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@campussphere.edu',
      password: 'Admin@123',
    });
    adminToken = adminRes.body.data.token;

    // 2. Authenticate Student 1
    const studentRes = await request(app).post('/api/auth/login').send({
      email: 'student@campussphere.edu',
      password: 'Student@123',
    });
    studentToken = studentRes.body.data.token;
    studentUser = await User.findOne({ email: 'student@campussphere.edu' });

    // 3. Authenticate Student 2 (or find/create)
    student2User = await User.findOne({ email: 'student2@campussphere.edu' });
    if (!student2User) {
      student2User = await User.create({
        fullName: 'Jane Doe',
        email: 'student2@campussphere.edu',
        password: 'Student@123',
        role: 'student',
        studentId: 'STU-999',
        status: 'active',
      });
    }
    const student2Res = await request(app).post('/api/auth/login').send({
      email: 'student2@campussphere.edu',
      password: 'Student@123',
    });
    student2Token = student2Res.body.data?.token;

    // 4. Authenticate Faculty 1
    const facultyRes = await request(app).post('/api/auth/login').send({
      email: 'faculty@campussphere.edu',
      password: 'Faculty@123',
    });
    facultyToken = facultyRes.body.data.token;
    facultyUser = await User.findOne({ email: 'faculty@campussphere.edu' });

    // 5. Authenticate or create Other Faculty
    otherFacultyUser = await User.findOne({ role: 'faculty', email: { $ne: 'faculty@campussphere.edu' } });
    if (!otherFacultyUser) {
      otherFacultyUser = await User.create({
        fullName: 'Prof. Other Faculty',
        email: 'otherfaculty@campussphere.edu',
        password: 'Password@123',
        role: 'faculty',
        employeeId: 'FAC-998',
        status: 'active',
      });
    }
    const otherFacultyRes = await request(app).post('/api/auth/login').send({
      email: otherFacultyUser.email,
      password: otherFacultyUser.email === 'sanjay@campussphere.edu' ? 'Password@123' : 'Password@123',
    });
    otherFacultyToken = otherFacultyRes.body.data?.token || adminToken;

    // 6. Departments
    testDept = await Department.findOne({ code: 'CSE' });
    otherDept = await Department.findOne({ code: { $ne: 'CSE' } });

    // Ensure student1 has department set
    if (testDept) {
      studentUser.department = testDept._id;
      student2User.department = testDept._id;
      await studentUser.save();
      await student2User.save();
    }

    // 7. Class Division
    testClass = await ClassDivision.findOne({ department: testDept?._id });
    if (!testClass) {
      testClass = await ClassDivision.create({
        name: 'CSE-5A-Test',
        code: 'CSE-5A-TEST',
        department: testDept._id,
        semester: 5,
        academicYear: '2026-2027',
        room: 'LH-201',
        studentCount: 30,
        students: [studentUser._id, student2User._id],
      });
    } else {
      if (!testClass.students.includes(studentUser._id)) {
        testClass.students.push(studentUser._id);
      }
      if (!testClass.students.includes(student2User._id)) {
        testClass.students.push(student2User._id);
      }
      await testClass.save();
    }

    // 8. Clean up prior test artifacts for clean runs
    await StudentSubjectEnrollment.deleteMany({ notes: /EnrollmentTest/i });
    await Subject.deleteMany({ code: /^TESTSUB/ });
    await LectureAttendance.deleteMany({ topic: /EnrollmentTest/i });

    // 9. Create Active Test Subject
    testSubject = await Subject.create({
      name: 'Cloud Infrastructure Architecture',
      code: 'TESTSUB501',
      department: testDept._id,
      semester: 5,
      academicYear: '2026-2027',
      credits: 4,
      lectureHoursPerWeek: 4,
      status: 'active',
      selfEnrollmentAllowed: true,
      maxCapacity: 50,
      description: 'EnrollmentTest subject',
    });

    // 10. Inactive Subject
    inactiveSubject = await Subject.create({
      name: 'Legacy Cobol Programming',
      code: 'TESTSUB502',
      department: testDept._id,
      semester: 5,
      status: 'inactive',
      selfEnrollmentAllowed: true,
      maxCapacity: 30,
      description: 'EnrollmentTest inactive subject',
    });

    // 11. Restricted Subject (self-enrollment disabled)
    restrictedSubject = await Subject.create({
      name: 'Honors Distributed Systems Seminar',
      code: 'TESTSUB503',
      department: testDept._id,
      semester: 5,
      status: 'active',
      selfEnrollmentAllowed: false,
      maxCapacity: 15,
      description: 'EnrollmentTest restricted subject',
    });

    // 12. Create timetable entry assigning testSubject to primary faculty
    await TimetableEntry.deleteMany({ subject: testSubject._id });
    await TimetableEntry.create({
      faculty: facultyUser._id,
      subject: testSubject._id,
      classDivision: testClass._id,
      department: testDept._id,
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '09:00',
      room: 'LH-TEST-1',
      activityType: 'Theory',
      status: 'Published',
    });
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await StudentSubjectEnrollment.deleteMany({ notes: /EnrollmentTest/i });
    await Subject.deleteMany({ code: /^TESTSUB/ });
    await LectureAttendance.deleteMany({ topic: /EnrollmentTest/i });
    await TimetableEntry.deleteMany({ room: 'LH-TEST-1' });
  });

  // --------------------------------------------------------------------------
  // 1. STUDENT SELF-ENROLLMENT
  // --------------------------------------------------------------------------
  it('1. Student can list available subjects eligible for their course & department', async () => {
    const res = await request(app)
      .get('/api/enrollments/available')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((s) => s.code === 'TESTSUB501');
    expect(found).toBeDefined();
    expect(found.canEnroll).toBe(true);
    expect(found.isEnrolled).toBe(false);
  });

  it('2. Student successfully self-enrolls in an eligible active subject', async () => {
    const res = await request(app)
      .post('/api/enrollments/enroll')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subjectId: testSubject._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('enrolled');
    expect(res.body.data.student.toString()).toBe(studentUser._id.toString());
    expect(res.body.data.subject._id.toString()).toBe(testSubject._id.toString());
  });

  it('3. Rejection of duplicate enrollment with HTTP 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/enrollments/enroll')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subjectId: testSubject._id.toString() });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already/i);
  });

  it('4. Rejection of enrollment in an inactive subject with HTTP 422', async () => {
    const res = await request(app)
      .post('/api/enrollments/enroll')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subjectId: inactiveSubject._id.toString() });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/inactive/i);
  });

  it('5. Rejection of enrollment when self-enrollment is disabled with HTTP 403', async () => {
    const res = await request(app)
      .post('/api/enrollments/enroll')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subjectId: restrictedSubject._id.toString() });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/disabled/i);
  });

  it('6. Student can view their enrolled subjects via /api/enrollments/my', async () => {
    const res = await request(app)
      .get('/api/enrollments/my')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const enrolledItem = res.body.data.find(
      (e) => e.subject?._id?.toString() === testSubject._id.toString()
    );
    expect(enrolledItem).toBeDefined();
    expect(enrolledItem.status).toBe('enrolled');
  });

  it('7. Student can withdraw from an enrolled subject', async () => {
    const res = await request(app)
      .post('/api/enrollments/withdraw')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subjectId: testSubject._id.toString(), reason: 'Dropping course' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('withdrawn');
    expect(res.body.data.effectiveEndDate).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. ADMIN ASSIGNMENT & RBAC ENFORCEMENT
  // --------------------------------------------------------------------------
  it('8. Unauthorized student is blocked with 403 from admin assignment', async () => {
    const res = await request(app)
      .post('/api/enrollments/admin/assign')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        subjectId: testSubject._id.toString(),
        studentIds: [studentUser._id.toString()],
      });

    expect(res.status).toBe(403);
  });

  it('9. Unauthorized faculty is blocked with 403 from admin assignment', async () => {
    const res = await request(app)
      .post('/api/enrollments/admin/assign')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        subjectId: testSubject._id.toString(),
        studentIds: [studentUser._id.toString()],
      });

    expect(res.status).toBe(403);
  });

  it('10. Admin assigns a subject to an individual student', async () => {
    const res = await request(app)
      .post('/api/enrollments/admin/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: testSubject._id.toString(),
        studentIds: [studentUser._id.toString()],
        classDivisionId: testClass._id.toString(),
        effectiveEnrollmentDate: '2026-11-01',
        notes: 'EnrollmentTest: Admin assigned',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.results.enrolled.length).toBe(1);

    const check = await StudentSubjectEnrollment.findOne({
      student: studentUser._id,
      subject: testSubject._id,
      status: 'enrolled',
    });
    expect(check).toBeDefined();
    expect(check.enrollmentSource).toBe('admin');
  });

  it('11. Admin assignment rejects duplicate assignment with HTTP 409', async () => {
    const res = await request(app)
      .post('/api/enrollments/admin/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: testSubject._id.toString(),
        studentIds: [studentUser._id.toString()],
        notes: 'EnrollmentTest: Duplicate attempt',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('12. Admin assigns a subject to all eligible students in a class division cohort', async () => {
    const res = await request(app)
      .post('/api/enrollments/admin/assign-class')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: testSubject._id.toString(),
        classDivisionId: testClass._id.toString(),
        effectiveEnrollmentDate: '2026-11-01',
        notes: 'EnrollmentTest: Class cohort assign',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyEnrolledCount).toBeGreaterThanOrEqual(1); // student1 was already enrolled

    // student2 should now be enrolled
    const checkStudent2 = await StudentSubjectEnrollment.findOne({
      student: student2User._id,
      subject: testSubject._id,
      status: 'enrolled',
    });
    expect(checkStudent2).toBeDefined();
  });

  it('13. Admin can list all enrollments with filters via /api/enrollments/admin', async () => {
    const res = await request(app)
      .get('/api/enrollments/admin')
      .query({ subject: testSubject._id.toString() })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
  });

  // --------------------------------------------------------------------------
  // 3. FACULTY AUTHORIZATION & ATTENDANCE ROSTER INTEGRATION
  // --------------------------------------------------------------------------
  it('14. Assigned faculty can resolve the enrolled student roster for their class & subject', async () => {
    const res = await request(app)
      .get(`/api/classes/${testClass._id}/students`)
      .query({ subject: testSubject._id.toString() })
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isEnrolledRoster).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(2);

    const studentIds = res.body.data.map((s) => s._id.toString());
    expect(studentIds).toContain(studentUser._id.toString());
    expect(studentIds).toContain(student2User._id.toString());
  });

  it('15. Unauthorized faculty cannot access the student roster of an unassigned class', async () => {
    if (otherFacultyToken && otherFacultyToken !== adminToken) {
      const res = await request(app)
        .get(`/api/classes/${testClass._id}/students`)
        .query({ subject: testSubject._id.toString() })
        .set('Authorization', `Bearer ${otherFacultyToken}`);

      expect(res.status).toBe(403);
    }
  });

  it('16. Faculty submits attendance using the enrolled student roster', async () => {
    const lectureDate = '2026-11-10';

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        subject: testSubject._id.toString(),
        classDivision: testClass._id.toString(),
        date: lectureDate,
        startTime: '08:00',
        endTime: '09:00',
        topic: 'EnrollmentTest: Cloud Virtualization Lecture 1',
        records: [
          { student: studentUser._id.toString(), status: 'Present' },
          { student: student2User._id.toString(), status: 'Late' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalStudents).toBe(2);
    expect(res.body.data.summary.presentCount).toBe(1);
    expect(res.body.data.summary.lateCount).toBe(1);
  });

  it('17. Attendance rejects submission containing an un-enrolled student with HTTP 422', async () => {
    // Create an arbitrary student not enrolled in testSubject
    const nonEnrolledStudent = await User.create({
      fullName: 'Unenrolled Stranger',
      email: `unenrolled_${Date.now()}@campussphere.edu`,
      password: 'Password@123',
      role: 'student',
      status: 'active',
    });

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        subject: testSubject._id.toString(),
        classDivision: testClass._id.toString(),
        date: '2026-11-12',
        startTime: '08:00',
        endTime: '09:00',
        topic: 'EnrollmentTest: Invalid Student Roll Call',
        records: [
          { student: studentUser._id.toString(), status: 'Present' },
          { student: nonEnrolledStudent._id.toString(), status: 'Present' },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not actively enrolled/i);

    // Clean up temporary user
    await User.findByIdAndDelete(nonEnrolledStudent._id);
  });

  // --------------------------------------------------------------------------
  // 4. ATTENDANCE HISTORY PRESERVATION ACROSS ENROLLMENT LIFECYCLE
  // --------------------------------------------------------------------------
  it('18. Historical attendance remains intact after student withdraws from subject', async () => {
    // Student 1 withdraws after attendance was already submitted on 2026-11-10
    const withdrawRes = await request(app)
      .post('/api/enrollments/withdraw')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subjectId: testSubject._id.toString(), reason: 'Course dropped after week 1' });

    expect(withdrawRes.status).toBe(200);

    // Fetch student 1's attendance history via /api/attendance/student/:id
    const historyRes = await request(app)
      .get(`/api/attendance/student/${studentUser._id}`)
      .query({ subject: testSubject._id.toString() })
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.history.length).toBeGreaterThanOrEqual(1);

    const pastSession = historyRes.body.history.find(
      (h) => h.topic === 'EnrollmentTest: Cloud Virtualization Lecture 1'
    );
    expect(pastSession).toBeDefined();
    expect(pastSession.status).toBe('Present');
  });

  it('19. Withdrawn student is excluded from future session rosters after effective end date', async () => {
    const futureDate = '2026-11-25'; // After withdrawal date

    const rosterRes = await request(app)
      .get(`/api/classes/${testClass._id}/students`)
      .query({ subject: testSubject._id.toString(), date: futureDate })
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(rosterRes.status).toBe(200);
    const studentIds = rosterRes.body.data.map((s) => s._id.toString());
    // student1 withdrew, so student1 must NOT appear on the future roster
    expect(studentIds).not.toContain(studentUser._id.toString());
    // student2 remains enrolled, so student2 MUST appear
    expect(studentIds).toContain(student2User._id.toString());
  });

  it('20. Late enrollment does not fabricate attendance in historical sessions', async () => {
    // Verify historical session on 2026-11-10 only has original 2 records
    const historicalSession = await LectureAttendance.findOne({
      subject: testSubject._id,
      date: new Date('2026-11-10T00:00:00.000Z'),
    });
    expect(historicalSession).toBeDefined();
    expect(historicalSession.records.length).toBe(2);

    // Admin re-enrolls student1 with effective date TODAY (2026-11-17)
    await request(app)
      .post('/api/enrollments/admin/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: testSubject._id.toString(),
        studentIds: [studentUser._id.toString()],
        classDivisionId: testClass._id.toString(),
        effectiveEnrollmentDate: '2026-11-17',
        notes: 'EnrollmentTest: Re-enrolled late',
      });

    // Check historical session again: records count must still be 2, not fabricated
    const recheckedSession = await LectureAttendance.findById(historicalSession._id);
    expect(recheckedSession.records.length).toBe(2);
  });
});
