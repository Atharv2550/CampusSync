import express from 'express';
import {
  getStudentDashboard,
  getFacultyDashboard,
  getCoordinatorDashboard,
  getResourceManagerDashboard,
} from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, (req, res, next) => {
  if (req.user.role === 'faculty') {
    return getFacultyDashboard(req, res, next);
  }
  if (req.user.role === 'coordinator') {
    return getCoordinatorDashboard(req, res, next);
  }
  if (req.user.role === 'resource_manager') {
    return getResourceManagerDashboard(req, res, next);
  }
  return getStudentDashboard(req, res, next);
});

router.get('/faculty', protect, getFacultyDashboard);
router.get('/student', protect, getStudentDashboard);
router.get('/coordinator', protect, getCoordinatorDashboard);
router.get('/resource-manager', protect, getResourceManagerDashboard);

export default router;
