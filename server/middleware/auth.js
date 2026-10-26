import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Club } from '../models/Club.js';
import { CampusResource } from '../models/CampusResource.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to proceed.',
    });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id)
      .populate('department')
      .populate('assignedClub')
      .populate('assignedClubs')
      .populate('assignedResources');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by campus administration. Please contact support.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated by campus administration. Please contact support.',
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending administrator activation. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
      error: error.message,
    });
  }
};
