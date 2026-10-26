export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User context missing.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized to perform this action.`,
      });
    }

    next();
  };
};

export const requireClubOwnershipOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }

  const clubId = (req.params.id || req.params.clubId || req.body.clubId || req.body.club)?.toString();
  if (req.user.role === 'coordinator') {
    const singleClubId = (req.user.assignedClub?._id || req.user.assignedClub)?.toString();
    const multiClubIds = (req.user.assignedClubs || []).map((c) => (c._id || c).toString());
    if (clubId && (singleClubId === clubId || multiClubIds.includes(clubId))) {
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: You can only manage your assigned club.',
  });
};

export const requireResourceManagementOrAdmin = async (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role !== 'resource_manager') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Resource manager or admin role required.',
    });
  }

  const resourceId = (req.params.id || req.params.resourceId || req.body.resourceId || req.body.resource)?.toString();
  if (!resourceId) {
    return next();
  }

  const assigned = (req.user.assignedResources || []).map((r) => (r._id || r).toString());
  if (assigned.includes(resourceId)) {
    return next();
  }

  // Fallback to checking CampusResource managers collection
  try {
    const { CampusResource } = await import('../models/CampusResource.js');
    const isManager = await CampusResource.exists({ _id: resourceId, managers: req.user._id });
    if (isManager) {
      return next();
    }
  } catch (_) {}

  return res.status(403).json({
    success: false,
    message: 'Access denied: You are not authorized to manage this campus resource.',
  });
};

