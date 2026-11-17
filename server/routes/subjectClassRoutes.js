import express from 'express';
import {
  getSubjects,
  getSubjectById,
  getMyAssignedSubjects,
  createSubject,
  updateSubject,
  updateSubjectStatus,
  deleteSubject,
  getClasses,
  createClass,
  getClassStudents,
} from '../controllers/subjectClassController.js';
import { assignFacultyToSubject } from '../controllers/enrollmentController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Subjects
router.get('/subjects', protect, getSubjects);
router.get('/subjects/my', protect, authorize('faculty', 'admin'), getMyAssignedSubjects);
router.get('/subjects/:id', protect, getSubjectById);
router.post('/subjects', protect, authorize('admin'), createSubject);
router.put('/subjects/:id', protect, authorize('admin'), updateSubject);
router.patch('/subjects/:id/status', protect, authorize('admin'), updateSubjectStatus);
router.delete('/subjects/:id', protect, authorize('admin'), deleteSubject);
router.post('/subjects/:id/assign-faculty', protect, authorize('admin'), assignFacultyToSubject);

// Classes & Divisions
router.get('/classes', protect, getClasses);
router.post('/classes', protect, authorize('admin'), createClass);
router.get('/classes/:id/students', protect, authorize('faculty', 'admin'), getClassStudents);

export default router;
