import mongoose from 'mongoose';

const studentSubjectEnrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student is required'],
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    classDivision: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassDivision',
      default: null,
      index: true,
    },
    enrollmentSource: {
      type: String,
      enum: ['student', 'admin', 'system'],
      default: 'student',
      index: true,
    },
    status: {
      type: String,
      enum: ['enrolled', 'withdrawn', 'deactivated'],
      default: 'enrolled',
      index: true,
    },
    effectiveEnrollmentDate: {
      type: Date,
      default: Date.now,
      required: [true, 'Effective enrollment date is required'],
      index: true,
    },
    effectiveEndDate: {
      type: Date,
      default: null,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    semester: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent active duplicate enrollments for the same student and subject
studentSubjectEnrollmentSchema.index(
  { student: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'enrolled' },
  }
);

studentSubjectEnrollmentSchema.index({ subject: 1, status: 1, effectiveEnrollmentDate: 1 });
studentSubjectEnrollmentSchema.index({ student: 1, status: 1 });
studentSubjectEnrollmentSchema.index({ classDivision: 1, status: 1 });
studentSubjectEnrollmentSchema.index({ effectiveEnrollmentDate: 1, effectiveEndDate: 1 });

export const StudentSubjectEnrollment = mongoose.model(
  'StudentSubjectEnrollment',
  studentSubjectEnrollmentSchema
);

