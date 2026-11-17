import mongoose from 'mongoose';
import { StudentSubjectEnrollment } from '../models/StudentSubjectEnrollment.js';
import { Subject } from '../models/Subject.js';
import { ClassDivision } from '../models/ClassDivision.js';
import { TimetableEntry } from '../models/TimetableEntry.js';
import { DutyAssignment } from '../models/DutyAssignment.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { LectureAttendance } from '../models/LectureAttendance.js';
import { AuditLog } from '../models/AuditLog.js';
import { detectTimetableConflicts } from '../services/conflictDetectionService.js';

// Helper to normalize dates to UTC midnight
const normalizeDate = (dateInput) => {
  if (!dateInput) return new Date();
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const isoStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : d.toISOString().split('T')[0];
  const [year, month, day] = isoStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

// Map academic year string to supported semesters
const getSemestersForAcademicYear = (academicYearStr) => {
  switch (academicYearStr) {
    case '1st Year':
      return [1, 2];
    case '2nd Year':
      return [3, 4];
    case '3rd Year':
      return [5, 6];
    case '4th Year':
      return [7, 8];
    default:
      return [1, 2, 3, 4, 5, 6, 7, 8];
  }
};

/**
 * -------------------------------------------------------------
 * STUDENT CONTROLLERS
 * -------------------------------------------------------------
 */

// GET /api/enrollments/available (Student only)
// Lists subjects eligible for student enrollment with timetable and faculty info
export const getAvailableSubjectsForStudent = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const student = await User.findById(studentId).populate('department');

    if (!student || student.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Access restricted to students.' });
    }

    // Resolve student's class division
    let studentClass = null;
    if (student.classDivision) {
      studentClass = await ClassDivision.findById(student.classDivision);
    }
    if (!studentClass) {
      studentClass = await ClassDivision.findOne({ students: studentId });
    }

    const studentDeptId = student.department?._id || student.department;
    const studentSemester = studentClass?.semester || null;
    const allowedSemesters = studentSemester ? [studentSemester] : getSemestersForAcademicYear(student.academicYear);

    // Find subjects in student's department or where student's class is explicitly eligible
    const subjectQuery = {
      status: 'active',
    };

    if (studentDeptId) {
      subjectQuery.$or = [
        { department: studentDeptId },
        ...(studentClass ? [{ eligibleClasses: studentClass._id }] : []),
      ];
    }

    const subjects = await Subject.find(subjectQuery)
      .populate('department', 'name code')
      .populate('eligibleClasses', 'name code semester')
      .populate('assignedFaculty', 'fullName email designation avatar')
      .sort({ semester: 1, code: 1 })
      .lean();

    // Fetch student's existing enrollments
    const studentEnrollments = await StudentSubjectEnrollment.find({
      student: studentId,
    }).lean();

    const enrollmentMap = new Map();
    studentEnrollments.forEach((e) => {
      enrollmentMap.set(e.subject.toString(), e);
    });

    // Fetch timetable entries for all these subjects to show faculty and schedule
    const subjectIds = subjects.map((s) => s._id);
    const timetableEntries = await TimetableEntry.find({
      subject: { $in: subjectIds },
      status: 'Published',
    })
      .populate('faculty', 'fullName email designation avatar')
      .populate('classDivision', 'name code room')
      .lean();

    // Map timetable by subject ID
    const timetableMap = new Map();
    timetableEntries.forEach((entry) => {
      const sId = entry.subject.toString();
      if (!timetableMap.has(sId)) {
        timetableMap.set(sId, []);
      }
      timetableMap.get(sId).push({
        _id: entry._id,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        activityType: entry.activityType,
        faculty: entry.faculty,
        classDivision: entry.classDivision,
      });
    });

    // Count active enrollments per subject for capacity calculation
    const counts = await StudentSubjectEnrollment.aggregate([
      { $match: { subject: { $in: subjectIds }, status: 'enrolled' } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
    ]);
    const countsMap = new Map();
    counts.forEach((c) => countsMap.set(c._id.toString(), c.count));

    // Construct enriched subject items
    const enriched = subjects.map((subj) => {
      const subjIdStr = subj._id.toString();
      const enrollment = enrollmentMap.get(subjIdStr);
      const isEnrolled = enrollment?.status === 'enrolled';
      const isWithdrawn = enrollment?.status === 'withdrawn';
      const enrolledCount = countsMap.get(subjIdStr) || 0;
      const isFull = subj.maxCapacity > 0 && enrolledCount >= subj.maxCapacity;

      // Check class eligibility if subject restricts classes
      let classEligible = true;
      if (subj.eligibleClasses && subj.eligibleClasses.length > 0) {
        if (!studentClass) {
          classEligible = false;
        } else {
          classEligible = subj.eligibleClasses.some(
            (c) => c._id?.toString() === studentClass._id.toString()
          );
        }
      }

      // Check semester match
      const semesterMatch = allowedSemesters.includes(subj.semester);

      let canEnroll = false;
      let ineligibilityReason = '';

      if (isEnrolled) {
        canEnroll = false;
        ineligibilityReason = 'Already enrolled';
      } else if (subj.status !== 'active') {
        canEnroll = false;
        ineligibilityReason = 'Subject is currently inactive';
      } else if (subj.selfEnrollmentAllowed === false) {
        canEnroll = false;
        ineligibilityReason = 'Self-enrollment disabled for this subject';
      } else if (isFull) {
        canEnroll = false;
        ineligibilityReason = 'Subject capacity is full';
      } else if (!classEligible) {
        canEnroll = false;
        ineligibilityReason = 'Your class division is not eligible for this subject';
      } else if (!semesterMatch) {
        canEnroll = false;
        ineligibilityReason = `Subject is offered in semester ${subj.semester}`;
      } else {
        canEnroll = true;
      }

      const scheduleSlots = timetableMap.get(subjIdStr) || [];
      // Primary faculty from timetable or assignedFaculty
      const resolvedFaculty =
        scheduleSlots.find((s) => s.faculty)?.faculty || subj.assignedFaculty || null;

      return {
        _id: subj._id,
        name: subj.name,
        code: subj.code,
        department: subj.department,
        semester: subj.semester,
        academicYear: subj.academicYear,
        credits: subj.credits,
        lectureHoursPerWeek: subj.lectureHoursPerWeek,
        description: subj.description,
        status: subj.status,
        maxCapacity: subj.maxCapacity,
        enrolledCount,
        selfEnrollmentAllowed: subj.selfEnrollmentAllowed,
        eligibleClasses: subj.eligibleClasses,
        assignedFaculty: resolvedFaculty,
        timetableSlots: scheduleSlots,
        isEnrolled,
        isWithdrawn,
        enrollmentStatus: enrollment ? enrollment.status : null,
        enrollmentId: enrollment ? enrollment._id : null,
        effectiveEnrollmentDate: enrollment?.effectiveEnrollmentDate || null,
        canEnroll,
        ineligibilityReason,
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      studentCohort: {
        department: student.department?.name || 'Department',
        academicYear: student.academicYear,
        classDivision: studentClass ? { _id: studentClass._id, name: studentClass.name, code: studentClass.code } : null,
      },
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/enrollments/my (Student only)
// Lists student's enrolled subjects with timetable and faculty info
export const getMyEnrollments = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const enrollments = await StudentSubjectEnrollment.find({
      student: studentId,
    })
      .populate({
        path: 'subject',
        populate: { path: 'department', select: 'name code headOfDepartment' },
      })
      .populate('classDivision', 'name code room')
      .populate('assignedBy', 'fullName email')
      .sort({ effectiveEnrollmentDate: -1 })
      .lean();

    // Fetch timetable for enrolled subjects
    const subjectIds = enrollments.map((e) => e.subject?._id).filter(Boolean);
    const timetableEntries = await TimetableEntry.find({
      subject: { $in: subjectIds },
      status: 'Published',
    })
      .populate('faculty', 'fullName email designation avatar')
      .populate('classDivision', 'name code room')
      .lean();

    const timetableMap = new Map();
    timetableEntries.forEach((entry) => {
      const sId = entry.subject.toString();
      if (!timetableMap.has(sId)) {
        timetableMap.set(sId, []);
      }
      timetableMap.get(sId).push({
        _id: entry._id,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        activityType: entry.activityType,
        faculty: entry.faculty,
      });
    });

    const enriched = enrollments.map((e) => {
      const sId = e.subject?._id?.toString();
      const slots = timetableMap.get(sId) || [];
      const primaryFaculty = slots.find((s) => s.faculty)?.faculty || null;

      return {
        ...e,
        timetableSlots: slots,
        primaryFaculty,
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/enrollments/enroll (Student self-enrollment)
export const enrollSelf = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { subjectId } = req.body;

    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(422).json({ success: false, message: 'Valid subject ID is required.' });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can perform self-enrollment.' });
    }

    const student = await User.findById(studentId);
    if (!student || student.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Student account is not active.' });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    if (subject.status === 'inactive') {
      return res.status(422).json({
        success: false,
        message: 'Enrollment rejected: Subject is currently inactive.',
      });
    }

    if (subject.selfEnrollmentAllowed === false) {
      return res.status(403).json({
        success: false,
        message: 'Self-enrollment is disabled for this subject. Please contact the administrator.',
      });
    }

    // Resolve student's class division
    let studentClass = null;
    if (student.classDivision) {
      studentClass = await ClassDivision.findById(student.classDivision);
    }
    if (!studentClass) {
      studentClass = await ClassDivision.findOne({ students: studentId });
    }

    // Validate department eligibility
    const studentDeptId = student.department?.toString();
    const subjectDeptId = subject.department?.toString();

    let isClassEligible = true;
    if (subject.eligibleClasses && subject.eligibleClasses.length > 0) {
      if (!studentClass) {
        isClassEligible = false;
      } else {
        isClassEligible = subject.eligibleClasses.some(
          (cId) => cId.toString() === studentClass._id.toString()
        );
      }
    }

    if (studentDeptId && subjectDeptId && studentDeptId !== subjectDeptId && !isClassEligible) {
      return res.status(422).json({
        success: false,
        message: 'Enrollment rejected: You are ineligible for subjects outside your department.',
      });
    }

    if (subject.eligibleClasses && subject.eligibleClasses.length > 0 && !isClassEligible) {
      return res.status(422).json({
        success: false,
        message: 'Enrollment rejected: Your class division is not eligible for this subject.',
      });
    }

    // Check capacity
    if (subject.maxCapacity > 0) {
      const activeCount = await StudentSubjectEnrollment.countDocuments({
        subject: subjectId,
        status: 'enrolled',
      });
      if (activeCount >= subject.maxCapacity) {
        return res.status(422).json({
          success: false,
          message: `Enrollment rejected: Subject has reached maximum student capacity (${subject.maxCapacity}).`,
        });
      }
    }

    // Duplicate enrollment check
    const existingActive = await StudentSubjectEnrollment.findOne({
      student: studentId,
      subject: subjectId,
      status: 'enrolled',
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: `You are already actively enrolled in ${subject.code} - ${subject.name}.`,
        enrollmentId: existingActive._id,
      });
    }

    // Reactivate or create new
    let enrollment = await StudentSubjectEnrollment.findOne({
      student: studentId,
      subject: subjectId,
      status: { $in: ['withdrawn', 'deactivated'] },
    });

    const now = new Date();

    if (enrollment) {
      enrollment.status = 'enrolled';
      enrollment.enrollmentSource = 'student';
      enrollment.effectiveEnrollmentDate = now;
      enrollment.effectiveEndDate = null;
      enrollment.classDivision = studentClass?._id || enrollment.classDivision || null;
      enrollment.academicYear = subject.academicYear;
      enrollment.semester = subject.semester;
      await enrollment.save();
    } else {
      enrollment = await StudentSubjectEnrollment.create({
        student: studentId,
        subject: subjectId,
        classDivision: studentClass?._id || null,
        enrollmentSource: 'student',
        status: 'enrolled',
        effectiveEnrollmentDate: now,
        academicYear: subject.academicYear,
        semester: subject.semester,
      });
    }

    // Populate response
    const populated = await StudentSubjectEnrollment.findById(enrollment._id)
      .populate('subject', 'name code credits semester academicYear department')
      .populate('classDivision', 'name code')
      .lean();

    // Audit log
    await AuditLog.create({
      user: studentId,
      action: 'STUDENT_ENROLL_SUBJECT',
      targetType: 'StudentSubjectEnrollment',
      targetId: enrollment._id,
      details: {
        subjectCode: subject.code,
        subjectName: subject.name,
      },
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: `Successfully enrolled in ${subject.code} - ${subject.name}.`,
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Concurrent duplicate enrollment detected: You are already enrolled in this subject.',
      });
    }
    next(error);
  }
};

// POST /api/enrollments/withdraw (Student self-withdrawal)
export const withdrawSelf = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { enrollmentId, subjectId, reason } = req.body;

    let query = { student: studentId };
    if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) {
      query._id = enrollmentId;
    } else if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      query.subject = subjectId;
      query.status = 'enrolled';
    } else {
      return res.status(422).json({
        success: false,
        message: 'Either valid enrollmentId or subjectId is required for withdrawal.',
      });
    }

    const enrollment = await StudentSubjectEnrollment.findOne(query).populate('subject');
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Active enrollment record not found.' });
    }

    // Ownership check
    if (enrollment.student.toString() !== studentId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only withdraw from your own enrollments.' });
    }

    if (enrollment.status === 'withdrawn') {
      return res.status(422).json({ success: false, message: 'You have already withdrawn from this subject.' });
    }

    enrollment.status = 'withdrawn';
    enrollment.effectiveEndDate = new Date();
    if (reason) {
      enrollment.notes = reason.trim();
    }
    await enrollment.save();

    await AuditLog.create({
      user: studentId,
      action: 'STUDENT_WITHDRAW_SUBJECT',
      targetType: 'StudentSubjectEnrollment',
      targetId: enrollment._id,
      details: {
        subjectCode: enrollment.subject?.code,
        reason: reason || 'Self-withdrawal',
      },
    }).catch(() => null);

    return res.json({
      success: true,
      message: `Successfully withdrawn from ${enrollment.subject?.name || 'subject'}.`,
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * -------------------------------------------------------------
 * ADMIN & FACULTY CONTROLLERS
 * -------------------------------------------------------------
 */

// GET /api/enrollments/admin (Admin only)
// Filter & search student-subject enrollments
export const getAdminEnrollments = async (req, res, next) => {
  try {
    const {
      subject,
      student,
      department,
      semester,
      classDivision,
      status,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (subject && mongoose.Types.ObjectId.isValid(subject)) {
      filter.subject = subject;
    }
    if (student && mongoose.Types.ObjectId.isValid(student)) {
      filter.student = student;
    }
    if (classDivision && mongoose.Types.ObjectId.isValid(classDivision)) {
      filter.classDivision = classDivision;
    }
    if (status) {
      filter.status = status;
    }
    if (semester) {
      filter.semester = Number(semester);
    }

    // If search text provided, search student name, email, or studentId
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        role: 'student',
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { studentId: searchRegex },
        ],
      }).select('_id');

      const matchingSubjects = await Subject.find({
        $or: [{ name: searchRegex }, { code: searchRegex }],
      }).select('_id');

      filter.$or = [
        { student: { $in: matchingUsers.map((u) => u._id) } },
        { subject: { $in: matchingSubjects.map((s) => s._id) } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [enrollments, total] = await Promise.all([
      StudentSubjectEnrollment.find(filter)
        .populate('student', 'fullName email studentId department academicYear avatar status')
        .populate({
          path: 'subject',
          populate: { path: 'department', select: 'name code' },
        })
        .populate('classDivision', 'name code room')
        .populate('assignedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      StudentSubjectEnrollment.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/enrollments/admin/assign (Admin only)
// Assign subject to one or multiple students with validation
export const adminAssignStudents = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    const {
      subjectId,
      studentIds = [],
      classDivisionId,
      effectiveEnrollmentDate,
      notes,
    } = req.body;

    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(422).json({ success: false, message: 'Valid subject ID is required.' });
    }

    const subject = await Subject.findById(subjectId).populate('department');
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const targetStudentIds = Array.isArray(studentIds) ? studentIds : [studentIds];
    if (targetStudentIds.length === 0) {
      return res.status(422).json({ success: false, message: 'At least one student must be selected.' });
    }

    const effectiveDate = effectiveEnrollmentDate ? new Date(effectiveEnrollmentDate) : new Date();

    const results = {
      enrolled: [],
      alreadyEnrolled: [],
      ineligible: [],
      errors: [],
    };

    for (const sId of targetStudentIds) {
      if (!mongoose.Types.ObjectId.isValid(sId)) {
        results.errors.push({ studentId: sId, reason: 'Invalid student ID format.' });
        continue;
      }

      const student = await User.findById(sId).populate('department');
      if (!student || student.role !== 'student') {
        results.ineligible.push({ studentId: sId, reason: 'User not found or is not a student.' });
        continue;
      }

      // Check if already actively enrolled
      const existing = await StudentSubjectEnrollment.findOne({
        student: sId,
        subject: subjectId,
        status: 'enrolled',
      });

      if (existing) {
        results.alreadyEnrolled.push({
          studentId: sId,
          studentName: student.fullName,
          studentEmail: student.email,
          reason: 'Already actively enrolled.',
        });
        continue;
      }

      // Check if existing withdrawn record can be reactivated
      let enrollment = await StudentSubjectEnrollment.findOne({
        student: sId,
        subject: subjectId,
        status: { $in: ['withdrawn', 'deactivated'] },
      });

      if (enrollment) {
        enrollment.status = 'enrolled';
        enrollment.enrollmentSource = 'admin';
        enrollment.assignedBy = adminId;
        enrollment.effectiveEnrollmentDate = effectiveDate;
        enrollment.effectiveEndDate = null;
        if (classDivisionId && mongoose.Types.ObjectId.isValid(classDivisionId)) {
          enrollment.classDivision = classDivisionId;
        }
        if (notes) enrollment.notes = notes.trim();
        await enrollment.save();
      } else {
        enrollment = await StudentSubjectEnrollment.create({
          student: sId,
          subject: subjectId,
          classDivision: classDivisionId || student.classDivision || null,
          enrollmentSource: 'admin',
          assignedBy: adminId,
          status: 'enrolled',
          effectiveEnrollmentDate: effectiveDate,
          academicYear: subject.academicYear,
          semester: subject.semester,
          notes: notes ? notes.trim() : 'Assigned by administrator',
        });
      }

      results.enrolled.push({
        studentId: sId,
        studentName: student.fullName,
        studentEmail: student.email,
        enrollmentId: enrollment._id,
      });
    }

    // If single student assignment requested and failed, return specific status codes
    if (targetStudentIds.length === 1) {
      if (results.alreadyEnrolled.length === 1) {
        return res.status(409).json({
          success: false,
          message: `Student ${results.alreadyEnrolled[0].studentName} is already enrolled in ${subject.code}.`,
          results,
        });
      }
      if (results.ineligible.length === 1) {
        return res.status(422).json({
          success: false,
          message: `Ineligible student selection: ${results.ineligible[0].reason}`,
          results,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Subject assignment completed. Enrolled: ${results.enrolled.length}, Already enrolled: ${results.alreadyEnrolled.length}, Ineligible: ${results.ineligible.length}.`,
      results,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/enrollments/admin/assign-class (Admin only)
// Assign subject to all eligible students in a class division
export const adminAssignClassCohort = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    const { subjectId, classDivisionId, effectiveEnrollmentDate, notes } = req.body;

    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(422).json({ success: false, message: 'Valid subject ID is required.' });
    }
    if (!classDivisionId || !mongoose.Types.ObjectId.isValid(classDivisionId)) {
      return res.status(422).json({ success: false, message: 'Valid class division ID is required.' });
    }

    const [subject, classDiv] = await Promise.all([
      Subject.findById(subjectId),
      ClassDivision.findById(classDivisionId),
    ]);

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    if (!classDiv) {
      return res.status(404).json({ success: false, message: 'Class division not found.' });
    }

    // Resolve students in this class division
    let studentIds = classDiv.students || [];
    if (studentIds.length === 0) {
      // Fallback: find students with same department and matching semester
      const matched = await User.find({
        role: 'student',
        department: classDiv.department,
        status: 'active',
      }).select('_id');
      studentIds = matched.map((m) => m._id);
    }

    if (studentIds.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No eligible students found in the selected class division cohort.',
      });
    }

    const effectiveDate = effectiveEnrollmentDate ? new Date(effectiveEnrollmentDate) : new Date();

    let newlyEnrolledCount = 0;
    let alreadyEnrolledCount = 0;

    for (const sId of studentIds) {
      const existing = await StudentSubjectEnrollment.findOne({
        student: sId,
        subject: subjectId,
        status: 'enrolled',
      });

      if (existing) {
        alreadyEnrolledCount += 1;
        continue;
      }

      let enrollment = await StudentSubjectEnrollment.findOne({
        student: sId,
        subject: subjectId,
        status: { $in: ['withdrawn', 'deactivated'] },
      });

      if (enrollment) {
        enrollment.status = 'enrolled';
        enrollment.enrollmentSource = 'admin';
        enrollment.assignedBy = adminId;
        enrollment.classDivision = classDivisionId;
        enrollment.effectiveEnrollmentDate = effectiveDate;
        enrollment.effectiveEndDate = null;
        if (notes) enrollment.notes = notes.trim();
        await enrollment.save();
      } else {
        await StudentSubjectEnrollment.create({
          student: sId,
          subject: subjectId,
          classDivision: classDivisionId,
          enrollmentSource: 'admin',
          assignedBy: adminId,
          status: 'enrolled',
          effectiveEnrollmentDate: effectiveDate,
          academicYear: subject.academicYear || classDiv.academicYear,
          semester: subject.semester || classDiv.semester,
          notes: notes ? notes.trim() : `Class cohort assignment (${classDiv.name})`,
        });
      }

      newlyEnrolledCount += 1;
    }

    // Ensure subject includes this class in eligibleClasses
    if (!subject.eligibleClasses.some((c) => c.toString() === classDivisionId.toString())) {
      subject.eligibleClasses.push(classDivisionId);
      await subject.save();
    }

    await AuditLog.create({
      user: adminId,
      action: 'ADMIN_ASSIGN_CLASS_SUBJECT',
      targetType: 'Subject',
      targetId: subjectId,
      details: {
        className: classDiv.name,
        subjectCode: subject.code,
        newlyEnrolledCount,
        alreadyEnrolledCount,
      },
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: `Class ${classDiv.name} assigned to ${subject.code}. Enrolled ${newlyEnrolledCount} students (${alreadyEnrolledCount} were already enrolled).`,
      newlyEnrolledCount,
      alreadyEnrolledCount,
      totalStudents: studentIds.length,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/enrollments/admin/:id/status (Admin only)
// Update enrollment status (enrolled, withdrawn, deactivated) with validation
export const adminUpdateEnrollmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason, effectiveEndDate } = req.body;
    const adminId = req.user._id;

    if (!['enrolled', 'withdrawn', 'deactivated'].includes(status)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid enrollment status. Must be enrolled, withdrawn, or deactivated.',
      });
    }

    const enrollment = await StudentSubjectEnrollment.findById(id)
      .populate('student', 'fullName email')
      .populate('subject', 'name code');

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment record not found.' });
    }

    const oldStatus = enrollment.status;
    enrollment.status = status;

    if (status === 'withdrawn' || status === 'deactivated') {
      enrollment.effectiveEndDate = effectiveEndDate ? new Date(effectiveEndDate) : new Date();
    } else if (status === 'enrolled') {
      enrollment.effectiveEndDate = null;
      enrollment.effectiveEnrollmentDate = new Date();
    }

    if (reason) {
      enrollment.notes = reason.trim();
    }

    await enrollment.save();

    await AuditLog.create({
      user: adminId,
      action: 'ADMIN_UPDATE_ENROLLMENT_STATUS',
      targetType: 'StudentSubjectEnrollment',
      targetId: enrollment._id,
      details: {
        student: enrollment.student?.fullName,
        subject: enrollment.subject?.code,
        previousStatus: oldStatus,
        newStatus: status,
        reason: reason || 'Admin status change',
      },
    }).catch(() => null);

    return res.json({
      success: true,
      message: `Enrollment status updated to ${status}.`,
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/enrollments/admin/:id (Admin only)
// Safely remove or deactivate an enrollment
export const adminDeleteEnrollment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const enrollment = await StudentSubjectEnrollment.findById(id);

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment record not found.' });
    }

    // Check if attendance records exist for this student and subject
    const hasHistoricalAttendance = await LectureAttendance.exists({
      subject: enrollment.subject,
      'records.student': enrollment.student,
    });

    if (hasHistoricalAttendance) {
      // Preserve historical attendance by soft-withdrawing rather than hard deleting
      enrollment.status = 'withdrawn';
      enrollment.effectiveEndDate = new Date();
      enrollment.notes = 'Withdrawn by admin (historical attendance preserved)';
      await enrollment.save();

      return res.json({
        success: true,
        preservedHistory: true,
        message: 'Enrollment marked as withdrawn. Historical attendance records preserved.',
        data: enrollment,
      });
    }

    await StudentSubjectEnrollment.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Enrollment record successfully deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/enrollments/subject/:subjectId/students
// Get all students enrolled in a subject (Admin or authorized Faculty)
export const getSubjectEnrolledStudents = async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const { status = 'enrolled', date } = req.query;

    const subject = await Subject.findById(subjectId).populate('department', 'name code');
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    // Enforce faculty authorization
    if (req.user.role === 'faculty') {
      const isRegular = await TimetableEntry.exists({
        faculty: req.user._id,
        subject: subjectId,
        status: 'Published',
      });
      const isDuty = await DutyAssignment.exists({
        faculty: req.user._id,
        subject: subjectId,
        status: { $in: ['Assigned', 'Acknowledged', 'Completed'] },
      });

      if (!isRegular && !isDuty) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: You are not assigned to teach this subject.',
        });
      }
    }

    const query = { subject: subjectId };
    if (status && status !== 'all') {
      query.status = status;
    }

    if (date) {
      const targetDate = normalizeDate(date);
      if (targetDate) {
        query.effectiveEnrollmentDate = { $lte: targetDate };
        query.$or = [{ effectiveEndDate: null }, { effectiveEndDate: { $gt: targetDate } }];
      }
    }

    const enrollments = await StudentSubjectEnrollment.find(query)
      .populate('student', 'fullName email studentId department academicYear avatar status')
      .populate('classDivision', 'name code room')
      .populate('assignedBy', 'fullName email')
      .sort({ 'student.fullName': 1 })
      .lean();

    return res.json({
      success: true,
      subject: {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        semester: subject.semester,
        department: subject.department,
        maxCapacity: subject.maxCapacity,
      },
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/subjects/:id/assign-faculty (Admin only)
// Assign faculty to teach a subject/class, respecting timetable conflict detection
export const assignFacultyToSubject = async (req, res, next) => {
  try {
    const { id: subjectId } = req.params;
    const {
      facultyId,
      classDivisionId,
      dayOfWeek,
      startTime,
      endTime,
      room = 'LH-201',
      activityType = 'Theory',
    } = req.body;

    if (!facultyId || !mongoose.Types.ObjectId.isValid(facultyId)) {
      return res.status(422).json({ success: false, message: 'Valid faculty ID is required.' });
    }
    if (!classDivisionId || !mongoose.Types.ObjectId.isValid(classDivisionId)) {
      return res.status(422).json({ success: false, message: 'Valid class division ID is required.' });
    }
    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(422).json({ success: false, message: 'Day of week, start time, and end time are required.' });
    }

    const [subject, faculty, classDiv] = await Promise.all([
      Subject.findById(subjectId),
      User.findOne({ _id: facultyId, role: 'faculty' }),
      ClassDivision.findById(classDivisionId),
    ]);

    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found.' });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty user not found.' });
    if (!classDiv) return res.status(404).json({ success: false, message: 'Class division not found.' });

    // Conflict detection
    const conflictResult = await detectTimetableConflicts({
      faculty: facultyId,
      room,
      classDivision: classDivisionId,
      dayOfWeek,
      startTime,
      endTime,
    });

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'Faculty assignment conflicts with existing schedule.',
        conflicts: conflictResult.conflicts,
      });
    }

    // Auto-resolve department: Subject -> ClassDivision -> Faculty -> default active department
    let entryDept = subject.department || classDiv.department || faculty.department;
    if (!entryDept) {
      const defaultDept = (await Department.findOne({ isActive: true })) || (await Department.findOne());
      if (defaultDept) entryDept = defaultDept._id;
    }

    // Associate department with subject if missing
    if (!subject.department && entryDept) {
      subject.department = entryDept;
    }

    // Associate department with faculty if missing
    if (!faculty.department && entryDept) {
      faculty.department = entryDept;
      await faculty.save().catch(() => null);
    }

    // Create or update timetable entry
    const entry = await TimetableEntry.create({
      faculty: facultyId,
      subject: subjectId,
      classDivision: classDivisionId,
      department: entryDept,
      dayOfWeek,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      room: room.trim(),
      activityType,
      status: 'Published',
      createdBy: req.user._id,
    });

    // Update subject assignedFaculty
    subject.assignedFaculty = facultyId;
    if (!subject.eligibleClasses.some((c) => c.toString() === classDivisionId.toString())) {
      subject.eligibleClasses.push(classDivisionId);
    }
    await subject.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ADMIN_ASSIGN_FACULTY_SUBJECT',
      targetType: 'Subject',
      targetId: subjectId,
      details: {
        faculty: faculty.fullName,
        subjectCode: subject.code,
        className: classDiv.name,
        slot: `${dayOfWeek} ${startTime}-${endTime}`,
      },
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: `Assigned Prof. ${faculty.fullName} to teach ${subject.code} (${classDiv.name}).`,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

