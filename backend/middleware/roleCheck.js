const { USER_ROLES } = require('../utils/constants');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  
  // Officer, Admin, or Commissioner
  requireOfficer: requireRole(
    USER_ROLES.OFFICER, 
    USER_ROLES.ADMIN, 
    USER_ROLES.COMMISSIONER
  ),
  
  // Admin or Commissioner
  requireAdmin: requireRole(
    USER_ROLES.ADMIN, 
    USER_ROLES.COMMISSIONER
  ),

  // Public Applicant
  requireApplicant: requireRole(USER_ROLES.APPLICANT)
};