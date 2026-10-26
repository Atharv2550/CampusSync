import express from 'express';
import {
  getUsers,
  updateUserStatus,
  getFlaggedContent,
  moderateContent,
  getAuditLogs,
  getPlatformSettings,
  updatePlatformSetting,
  createFaculty,
  updateFaculty,
  createStaffAccount,
  updateStaffAccount,
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Enforce admin-only access
router.use(protect, authorize('admin'));

router.get('/users', getUsers);
router.post('/users', createStaffAccount);
router.put('/users/:id', updateStaffAccount);
router.patch('/users/:id', updateUserStatus);
router.post('/staff', createStaffAccount);
router.put('/staff/:id', updateStaffAccount);
router.post('/faculty', createFaculty);
router.put('/faculty/:id', updateFaculty);
router.get('/flagged', getFlaggedContent);
router.post('/moderate', moderateContent);
router.get('/audit-logs', getAuditLogs);
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSetting);

export default router;
