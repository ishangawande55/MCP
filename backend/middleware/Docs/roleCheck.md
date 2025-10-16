# Role-Based Authorization Middleware Documentation

## 📋 Overview

The `requireRole` middleware provides flexible, role-based access control (RBAC) for the Municipal Credentials Platform. It extends the authentication middleware by enforcing role-specific permissions, ensuring users can only access endpoints appropriate for their assigned roles.

## 🏗️ Authorization Architecture

![Authorization Architecture](diagrams/Authorization%20Architecture.png)

## 🎯 Key Features

- **🔐 Flexible Role System**: Support for multiple role combinations
- **👥 Predefined Role Groups**: Common permission sets (Officer, Admin, Applicant)
- **⚡ Lightweight**: Minimal performance overhead
- **📊 Comprehensive Coverage**: Handles all user roles in the system
- **🔧 Extensible Design**: Easy to add new role combinations
- **🚫 Clear Error Messages**: Specific authorization failure responses

## 🔧 Core Implementation

### Authorization Flow

![Authorization Flow](diagrams/Authorization%20Flow.png)

### Main Middleware Function

```javascript
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
```

## 📊 Role Definitions & Hierarchy

### User Role Constants

```javascript
// Expected in ../utils/constants.js
const USER_ROLES = {
  APPLICANT: 'APPLICANT',       // Public users submitting applications
  OFFICER: 'OFFICER',           // Department officers processing applications
  COMMISSIONER: 'COMMISSIONER', // Department heads issuing credentials
  ADMIN: 'ADMIN'                // System administrators
};

module.exports = { USER_ROLES };
```

### Role Hierarchy & Permissions

![Role Hierarchy](diagrams/Role%20Hierarchy.png)

## 🔐 Predefined Role Groups

### Officer Group (Officer, Admin, Commissioner)

```javascript
// Officer, Admin, or Commissioner
requireOfficer: requireRole(
  USER_ROLES.OFFICER, 
  USER_ROLES.ADMIN, 
  USER_ROLES.COMMISSIONER
)
```

**Use Case:** Department-level operations that require staff access.

### Admin Group (Admin, Commissioner)

```javascript
// Admin or Commissioner
requireAdmin: requireRole(
  USER_ROLES.ADMIN, 
  USER_ROLES.COMMISSIONER
)
```

**Use Case:** System administration and high-level credential operations.

### Applicant Group (Applicant only)

```javascript
// Public Applicant
requireApplicant: requireRole(USER_ROLES.APPLICANT)
```

**Use Case:** User-specific operations like application submission.

## 💡 Usage Examples

### Route Protection Patterns

#### Basic Role Protection
```javascript
const { requireRole } = require('../middleware/authorization');
const { USER_ROLES } = require('../utils/constants');

// Protect route for commissioners only
router.post('/credentials/issue', 
  auth, 
  requireRole(USER_ROLES.COMMISSIONER), 
  issueCredentialController
);

// Protect route for multiple roles
router.get('/applications', 
  auth, 
  requireRole(USER_ROLES.OFFICER, USER_ROLES.COMMISSIONER), 
  getApplicationsController
);
```

#### Using Predefined Groups
```javascript
const { requireOfficer, requireAdmin, requireApplicant } = require('../middleware/authorization');

// Officer-level routes (Officers, Admins, Commissioners)
router.get('/department/applications',
  auth,
  requireOfficer,
  getDepartmentApplicationsController
);

// Admin-level routes (Admins, Commissioners)
router.post('/system/config',
  auth,
  requireAdmin,
  updateSystemConfigController
);

// Applicant-specific routes
router.post('/applications',
  auth,
  requireApplicant,
  createApplicationController
);
```

#### Complex Role Combinations
```javascript
// Custom role combinations for specific use cases
const requireReviewer = requireRole(
  USER_ROLES.OFFICER, 
  USER_ROLES.COMMISSIONER
);

const requireIssuer = requireRole(
  USER_ROLES.COMMISSIONER
);

// Application review (Officers + Commissioners)
router.put('/applications/:id/review',
  auth,
  requireReviewer,
  reviewApplicationController
);

// Credential issuance (Commissioners only)
router.post('/credentials/issue',
  auth,
  requireIssuer,
  issueCredentialController
);
```

### API Request/Response Examples

#### Successful Authorization
```http
GET /api/department/applications
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** Proceeds to route handler with user context.

#### Unauthorized (No Authentication)
```http
GET /api/department/applications
# No Authorization header
```

**Response:**
```json
{
  "success": false,
  "message": "Authentication required."
}
```

#### Forbidden (Insufficient Permissions)
```http
GET /api/department/applications
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# User role: APPLICANT
```

**Response:**
```json
{
  "success": false,
  "message": "Insufficient permissions."
}
```

## 🛡️ Security Considerations

### Error Message Consistency

```javascript
// Generic error messages prevent role enumeration
message: 'Insufficient permissions.' // Same message for all role failures

// Prevents attackers from determining:
// - Which roles exist in the system
// - Which roles are required for specific endpoints
// - Valid user roles through error message analysis
```

### Role Validation Order

```javascript
// The middleware validates in this order:
// 1. Authentication presence (req.user exists)
// 2. Role membership (user.role in allowedRoles)

// This ensures:
// - Always check authentication first
// - Only check roles for authenticated users
// - Clear separation of concerns
```

## 🔄 Integration Patterns

### Complete Route Protection Stack

```javascript
const express = require('express');
const auth = require('../middleware/auth');
const { requireRole, requireOfficer } = require('../middleware/authorization');
const router = express.Router();

// Public routes (no authentication)
router.post('/login', authController.login);
router.post('/register', authController.register);

// Applicant routes
router.get('/profile', 
  auth, 
  requireRole(USER_ROLES.APPLICANT),
  userController.getProfile
);

// Officer routes
router.get('/department/stats',
  auth,
  requireOfficer,
  dashboardController.getDepartmentStats
);

// Commissioner routes
router.post('/credentials/issue',
  auth,
  requireRole(USER_ROLES.COMMISSIONER),
  credentialController.issueCredential
);

// Admin routes
router.get('/system/users',
  auth,
  requireRole(USER_ROLES.ADMIN),
  adminController.getUsers
);
```

### Middleware Composition

```javascript
// Combining multiple middleware for complex authorization
const requireDepartmentOfficer = (req, res, next) => {
  if (!req.user.department) {
    return res.status(403).json({
      success: false,
      message: 'Department assignment required.'
    });
  }
  next();
};

// Usage with role and department checks
router.put('/applications/:id/assign',
  auth,
  requireOfficer,
  requireDepartmentOfficer,
  applicationController.assignApplication
);
```

## 📈 Advanced Usage

### Dynamic Role Requirements

```javascript
// Factory function for department-specific roles
const requireDepartmentRole = (department, ...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role) || req.user.department !== department) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this department.'
      });
    }

    next();
  };
};

// Usage: Healthcare department officers only
router.get('/healthcare/applications',
  auth,
  requireDepartmentRole('HEALTHCARE', USER_ROLES.OFFICER),
  applicationController.getHealthcareApplications
);
```

### Permission-Based Extensions

```javascript
// Extend with fine-grained permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user has the specific permission
    const userPermissions = getPermissionsForRole(req.user.role);
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${permission}`
      });
    }

    next();
  };
};

// Usage with specific permissions
router.delete('/applications/:id',
  auth,
  requirePermission('APPLICATION_DELETE'),
  applicationController.deleteApplication
);
```

## 🚀 Production Best Practices

### Centralized Role Management

```javascript
// roles.js - Centralized role definitions
const ROLE_HIERARCHY = {
  [USER_ROLES.APPLICANT]: [],
  [USER_ROLES.OFFICER]: [USER_ROLES.APPLICANT],
  [USER_ROLES.COMMISSIONER]: [USER_ROLES.OFFICER],
  [USER_ROLES.ADMIN]: [USER_ROLES.OFFICER]
};

const getInheritedRoles = (role) => {
  return [role, ...(ROLE_HIERARCHY[role] || [])];
};

// Enhanced requireRole with inheritance
const requireRoleWithInheritance = (...roles) => {
  const allAllowedRoles = new Set();
  roles.forEach(role => {
    getInheritedRoles(role).forEach(inherited => allAllowedRoles.add(inherited));
  });
  
  return requireRole(...allAllowedRoles);
};
```

### Audit Logging Integration

```javascript
// Enhanced version with audit logging
const requireRoleWithAudit = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      await auditLog('UNAUTHORIZED_ACCESS', req);
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      await auditLog('UNAUTHORIZED_ROLE', req, {
        attemptedRole: req.user.role,
        requiredRoles: allowedRoles
      });
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.'
      });
    }

    next();
  };
};
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: Role-based access control, clear authorization boundaries  
**Flexibility**: Custom role combinations, predefined permission groups  
**Integration**: Express middleware, JWT authentication, role constants  
**License**: MIT