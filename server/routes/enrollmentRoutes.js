import express from 'express';
import {
  getAvailableSubjectsForStudent,
  getMyEnrollments,
  enrollSelf,
  withdrawSelf,
  getAdminEnrollments,
  adminAssignStudents,
  adminAssignClassCohort,
  adminUpdateEnrollmentStatus,
  adminDeleteEnrollment,
  getSubjectEnrolledStudents,
} from '../controllers/enrollmentController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Student routes
router.get('/available', protect, authorize('student'), getAvailableSubjectsForStudent);
router.get('/my', protect, authorize('student'), getMyEnrollments);
router.post('/enroll', protect, authorize('student'), enrollSelf);
router.post('/withdraw', protect, authorize('student'), withdrawSelf);

// Admin routes
router.get('/admin', protect, authorize('admin'), getAdminEnrollments);
router.post('/admin/assign', protect, authorize('admin'), adminAssignStudents);
router.post('/admin/assign-class', protect, authorize('admin'), adminAssignClassCohort);
router.patch('/admin/:id/status', protect, authorize('admin'), adminUpdateEnrollmentStatus);
router.delete('/admin/:id', protect, authorize('admin'), adminDeleteEnrollment);

// Shared / Faculty & Admin routes
router.get(
  '/subject/:subjectId/students',
  protect,
  authorize('admin', 'faculty'),
  getSubjectEnrolledStudents
);

export default router;

