import mongoose from 'mongoose';
import { Subject } from '../models/Subject.js';
import { ClassDivision } from '../models/ClassDivision.js';
import { Department } from '../models/Department.js';
import { TimetableEntry } from '../models/TimetableEntry.js';
import { DutyAssignment } from '../models/DutyAssignment.js';
import { User } from '../models/User.js';
import { StudentSubjectEnrollment } from '../models/StudentSubjectEnrollment.js';

// Helper to normalize dates to UTC midnight
const normalizeDate = (dateInput) => {
  if (!dateInput) return new Date();
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const isoStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : d.toISOString().split('T')[0];
  const [year, month, day] = isoStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

// GET /api/subjects
export const getSubjects = async (req, res, next) => {
  try {
    const { department, semester, status, search } = req.query;
    const filter = {};
    if (department && mongoose.Types.ObjectId.isValid(department)) {
      filter.department = department;
    }
    if (semester) {
      filter.semester = Number(semester);
    }
    if (status) {
      filter.status = status;
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const subjects = await Subject.find(filter)
      .populate('department', 'name code headOfDepartment')
      .populate('assignedFaculty', 'fullName email designation avatar')
      .populate('eligibleClasses', 'name code semester academicYear')
      .sort({ semester: 1, code: 1 })
      .lean();

    // Attach enrollment counts for each subject
    const subjectIds = subjects.map((s) => s._id);
    const counts = await StudentSubjectEnrollment.aggregate([
      { $match: { subject: { $in: subjectIds }, status: 'enrolled' } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
    ]);
    const countsMap = new Map();
    counts.forEach((c) => countsMap.set(c._id.toString(), c.count));

    const enriched = subjects.map((s) => ({
      ...s,
      enrolledCount: countsMap.get(s._id.toString()) || 0,
    }));

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    next(error);
  }
};

// GET /api/subjects/:id
export const getSubjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid subject ID.' });
    }

    const subject = await Subject.findById(id)
      .populate('department', 'name code headOfDepartment')
      .populate('assignedFaculty', 'fullName email designation avatar')
      .populate('eligibleClasses', 'name code semester academicYear')
      .lean();

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const [enrolledCount, timetableSlots] = await Promise.all([
      StudentSubjectEnrollment.countDocuments({ subject: id, status: 'enrolled' }),
      TimetableEntry.find({ subject: id, status: 'Published' })
        .populate('faculty', 'fullName email designation avatar')
        .populate('classDivision', 'name code room')
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        ...subject,
        enrolledCount,
        timetableSlots,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/subjects/my (Faculty only)
export const getMyAssignedSubjects = async (req, res, next) => {
  try {
    const facultyId = req.user._id;

    // Find all timetable entries for this faculty
    const entries = await TimetableEntry.find({
      faculty: facultyId,
      status: 'Published',
    })
      .populate('subject')
      .populate('classDivision')
      .populate('department', 'name code');

    // Aggregate by Subject & Class combination
    const map = new Map();

    for (const entry of entries) {
      if (!entry.subject || !entry.classDivision) continue;

      const key = `${entry.subject._id.toString()}-${entry.classDivision._id.toString()}`;
      if (!map.has(key)) {
        map.set(key, {
          subject: entry.subject,
          classDivision: entry.classDivision,
          department: entry.department,
          rooms: new Set([entry.room]),
          weeklySessions: 1,
          activityTypes: new Set([entry.activityType]),
          scheduleSlots: [
            {
              timetableEntryId: entry._id,
              dayOfWeek: entry.dayOfWeek,
              startTime: entry.startTime,
              endTime: entry.endTime,
              room: entry.room,
              activityType: entry.activityType,
            },
          ],
        });
      } else {
        const item = map.get(key);
        item.rooms.add(entry.room);
        item.weeklySessions += 1;
        item.activityTypes.add(entry.activityType);
        item.scheduleSlots.push({
          timetableEntryId: entry._id,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          activityType: entry.activityType,
        });
      }
    }

    const assigned = Array.from(map.values()).map((item) => ({
      ...item,
      rooms: Array.from(item.rooms),
      activityTypes: Array.from(item.activityTypes),
    }));

    return res.json({ success: true, count: assigned.length, data: assigned });
  } catch (error) {
    next(error);
  }
};

// POST /api/subjects (Admin only)
export const createSubject = async (req, res, next) => {
  try {
    const {
      name,
      code,
      department,
      semester,
      academicYear,
      credits,
      lectureHoursPerWeek,
      description,
      status = 'active',
      eligibleClasses = [],
      assignedFaculty = null,
      selfEnrollmentAllowed = true,
      maxCapacity = 60,
    } = req.body;

    const existing = await Subject.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Subject code ${code} already exists.` });
    }

    // Auto-resolve department if not provided
    let subjectDept = department;
    if (!subjectDept) {
      if (assignedFaculty && mongoose.Types.ObjectId.isValid(assignedFaculty)) {
        const fac = await User.findById(assignedFaculty);
        if (fac?.department) subjectDept = fac.department;
      }
      if (!subjectDept && Array.isArray(eligibleClasses) && eligibleClasses.length > 0) {
        const cls = await ClassDivision.findById(eligibleClasses[0]);
        if (cls?.department) subjectDept = cls.department;
      }
      if (!subjectDept) {
        const defaultDept = (await Department.findOne({ isActive: true })) || (await Department.findOne());
        if (defaultDept) subjectDept = defaultDept._id;
      }
    }

    // If assigned faculty has no department, link them to this department
    if (assignedFaculty && subjectDept && mongoose.Types.ObjectId.isValid(assignedFaculty)) {
      const fac = await User.findById(assignedFaculty);
      if (fac && !fac.department) {
        fac.department = subjectDept;
        await fac.save().catch(() => null);
      }
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      department: subjectDept,
      semester: Number(semester),
      academicYear: academicYear || '2026-2027',
      credits: Number(credits) || 3,
      lectureHoursPerWeek: Number(lectureHoursPerWeek) || 3,
      description: description ? description.trim() : '',
      status: status || 'active',
      eligibleClasses: Array.isArray(eligibleClasses) ? eligibleClasses : [],
      assignedFaculty: assignedFaculty && mongoose.Types.ObjectId.isValid(assignedFaculty) ? assignedFaculty : null,
      selfEnrollmentAllowed: selfEnrollmentAllowed !== false,
      maxCapacity: Number(maxCapacity) || 60,
    });

    const populated = await Subject.findById(subject._id)
      .populate('department', 'name code')
      .populate('assignedFaculty', 'fullName email')
      .populate('eligibleClasses', 'name code semester');

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/subjects/:id (Admin only)
export const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid subject ID.' });
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const {
      name,
      code,
      department,
      semester,
      academicYear,
      credits,
      lectureHoursPerWeek,
      description,
      status,
      eligibleClasses,
      assignedFaculty,
      selfEnrollmentAllowed,
      maxCapacity,
    } = req.body;

    if (code && code.toUpperCase().trim() !== subject.code) {
      const existing = await Subject.findOne({
        _id: { $ne: id },
        code: code.toUpperCase().trim(),
      });
      if (existing) {
        return res.status(409).json({ success: false, message: `Subject code ${code} is already in use.` });
      }
      subject.code = code.toUpperCase().trim();
    }

    if (name) subject.name = name.trim();
    if (department) subject.department = department;
    if (semester !== undefined) subject.semester = Number(semester);
    if (academicYear) subject.academicYear = academicYear;
    if (credits !== undefined) subject.credits = Number(credits);
    if (lectureHoursPerWeek !== undefined) subject.lectureHoursPerWeek = Number(lectureHoursPerWeek);
    if (description !== undefined) subject.description = description.trim();
    if (status) subject.status = status;
    if (eligibleClasses !== undefined) subject.eligibleClasses = eligibleClasses;
    if (assignedFaculty !== undefined) {
      subject.assignedFaculty = assignedFaculty && mongoose.Types.ObjectId.isValid(assignedFaculty) ? assignedFaculty : null;
    }
    if (selfEnrollmentAllowed !== undefined) subject.selfEnrollmentAllowed = Boolean(selfEnrollmentAllowed);
    if (maxCapacity !== undefined) subject.maxCapacity = Number(maxCapacity);

    await subject.save();

    const populated = await Subject.findById(id)
      .populate('department', 'name code')
      .populate('assignedFaculty', 'fullName email')
      .populate('eligibleClasses', 'name code semester');

    return res.json({
      success: true,
      message: 'Subject updated successfully.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/subjects/:id/status (Admin only)
export const updateSubjectStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(422).json({ success: false, message: 'Status must be active or inactive.' });
    }

    const subject = await Subject.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate('department', 'name code')
      .populate('assignedFaculty', 'fullName email');

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    return res.json({
      success: true,
      message: `Subject status updated to ${status}.`,
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/subjects/:id (Admin only)
export const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    // Check if published timetable entries exist
    const hasTimetable = await TimetableEntry.exists({ subject: id, status: 'Published' });
    if (hasTimetable) {
      return res.status(422).json({
        success: false,
        message: 'Cannot delete subject: Active timetable entries exist. Please cancel timetable entries or deactivate the subject instead.',
      });
    }

    // Check if active enrollments exist
    const hasEnrollments = await StudentSubjectEnrollment.exists({ subject: id, status: 'enrolled' });
    if (hasEnrollments) {
      return res.status(422).json({
        success: false,
        message: 'Cannot delete subject: Enrolled students exist. Deactivate the subject instead.',
      });
    }

    await Subject.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Subject successfully deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/classes
export const getClasses = async (req, res, next) => {
  try {
    const { department, semester } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (semester) filter.semester = Number(semester);

    const classes = await ClassDivision.find(filter)
      .populate('department', 'name code')
      .sort({ code: 1 });

    return res.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    next(error);
  }
};

// POST /api/classes (Admin only)
export const createClass = async (req, res, next) => {
  try {
    const { name, code, department, semester, academicYear, room, studentCount } = req.body;

    const existing = await ClassDivision.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Class code ${code} already exists.` });
    }

    let classDept = department;
    if (!classDept) {
      const defaultDept = (await Department.findOne({ isActive: true })) || (await Department.findOne());
      if (defaultDept) classDept = defaultDept._id;
    }

    const newClass = await ClassDivision.create({
      name,
      code: code.toUpperCase().trim(),
      department: classDept,
      semester,
      academicYear,
      room,
      studentCount: studentCount || 0,
    });

    const populated = await ClassDivision.findById(newClass._id).populate('department', 'name code');

    return res.status(201).json({
      success: true,
      message: 'Class division created successfully.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/classes/:id/students
// Resolves enrolled student roster for this class and subject/session date
export const getClassStudents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject: subjectId, date } = req.query;

    const classDiv = await ClassDivision.findById(id).populate('department');

    if (!classDiv) {
      return res.status(404).json({ success: false, message: 'Class division not found.' });
    }

    // Role check: Admin or Faculty assigned to this class
    if (req.user.role === 'faculty') {
      const isClassAssigned = await TimetableEntry.exists({
        faculty: req.user._id,
        classDivision: id,
        status: 'Published',
      });

      const isDutyAssigned = await DutyAssignment.exists({
        faculty: req.user._id,
        classDivision: id,
        status: { $in: ['Assigned', 'Acknowledged', 'Completed'] },
      });

      if (!isClassAssigned && !isDutyAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: You are not assigned to teach this class division.',
        });
      }
    }

    // If subject is specified, prioritize active student enrollments for this subject
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      const targetDate = date ? normalizeDate(date) : new Date();

      const activeEnrollments = await StudentSubjectEnrollment.find({
        subject: subjectId,
        status: 'enrolled',
        effectiveEnrollmentDate: { $lte: targetDate },
        $or: [{ effectiveEndDate: null }, { effectiveEndDate: { $gt: targetDate } }],
      })
        .populate('student', 'fullName email studentId department academicYear avatar status')
        .lean();

      if (activeEnrollments.length > 0) {
        const classStudentIdSet = new Set(
          (classDiv.students || []).map((s) => s.toString())
        );

        let filtered = activeEnrollments.filter((enr) => {
          if (!enr.student) return false;
          const sId = enr.student._id.toString();
          if (enr.classDivision && enr.classDivision.toString() === id.toString()) return true;
          if (classStudentIdSet.has(sId)) return true;
          return false;
        });

        // If no direct class match, fall back to same department enrolled students
        if (filtered.length === 0) {
          const deptIdStr = (classDiv.department?._id || classDiv.department)?.toString();
          filtered = activeEnrollments.filter((enr) => {
            if (!enr.student) return false;
            return enr.student.department?.toString() === deptIdStr;
          });
        }

        const enrolledStudents = filtered.map((enr) => ({
          _id: enr.student._id,
          fullName: enr.student.fullName,
          email: enr.student.email,
          studentId: enr.student.studentId,
          department: enr.student.department,
          academicYear: enr.student.academicYear,
          avatar: enr.student.avatar,
          enrollmentId: enr._id,
          enrollmentStatus: enr.status,
          effectiveEnrollmentDate: enr.effectiveEnrollmentDate,
        }));

        return res.json({
          success: true,
          classDivision: {
            _id: classDiv._id,
            name: classDiv.name,
            code: classDiv.code,
            semester: classDiv.semester,
            academicYear: classDiv.academicYear,
          },
          subjectId,
          isEnrolledRoster: true,
          count: enrolledStudents.length,
          data: enrolledStudents,
        });
      }
    }

    // Fallback: If no subject specified OR no enrollments exist for this subject yet (legacy unmigrated state)
    let students = [];
    if (classDiv.students && classDiv.students.length > 0) {
      students = await User.find({ _id: { $in: classDiv.students } })
        .select('fullName email studentId department academicYear avatar')
        .sort({ fullName: 1 });
    } else {
      // Fallback: fetch student users matching department
      students = await User.find({
        role: 'student',
        department: classDiv.department?._id || classDiv.department,
      })
        .select('fullName email studentId department academicYear avatar')
        .limit(classDiv.studentCount || 35)
        .sort({ fullName: 1 });
    }

    return res.json({
      success: true,
      classDivision: {
        _id: classDiv._id,
        name: classDiv.name,
        code: classDiv.code,
        semester: classDiv.semester,
        academicYear: classDiv.academicYear,
      },
      isEnrolledRoster: false,
      count: students.length,
      data: students,
    });
  } catch (error) {
    next(error);
  }
};
