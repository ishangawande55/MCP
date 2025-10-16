# Authentication Middleware Documentation

## 📋 Overview

The `auth` middleware provides JWT-based authentication for protecting API routes in the Municipal Credentials Platform. It validates JSON Web Tokens, verifies user status, and enriches request objects with user context for downstream processing.

## 🏗️ Middleware Architecture

![Auth Architecture](diagrams/Auth%20Architecture.png)

## 🎯 Key Features

- **🔐 JWT Validation**: Secure token verification using secret key
- **👤 User Context**: Attaches full user object to requests
- **🚫 Inactive User Protection**: Blocks access for deactivated accounts
- **🔒 Password Security**: Automatically excludes password from user object
- **📊 Comprehensive Logging**: Detailed error logging for security monitoring
- **⚡ Performance Optimized**: Efficient database queries with field selection

## 🔧 Core Implementation

### Authentication Flow

![Authentication Flow](diagrams/Authentication-Flow.png)

### Middleware Code

```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user inactive.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

module.exports = auth;
```

## 📊 Token Processing

### Token Extraction

```javascript
const token = req.header('Authorization')?.replace('Bearer ', '');

// Handles various Authorization header formats:
// - "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// - Empty or missing headers
// - Malformed headers
```

### JWT Verification

```javascript
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// Verification ensures:
// - Token signature is valid
// - Token hasn't expired
// - Token structure is correct
// - Uses environment variable for security
```

### User Lookup

```javascript
const user = await User.findById(decoded.id).select('-password');

// Database query features:
// - Finds user by ID from token payload
// - Excludes password field for security
// - Returns full user object minus sensitive data
```

## 🔐 Security Features

### Comprehensive Error Handling

```javascript
// No token provided
if (!token) {
  return res.status(401).json({
    success: false,
    message: 'Access denied. No token provided.'
  });
}

// User not found or inactive
if (!user || !user.isActive) {
  return res.status(401).json({
    success: false,
    message: 'Invalid token or user inactive.'
  });
}

// Generic token errors
} catch (error) {
  console.error('Auth Middleware Error:', error);
  res.status(401).json({
    success: false,
    message: 'Invalid token.'
  });
}
```

### Security Best Practices

```javascript
// Password exclusion for security
.select('-password')

// Environment variable for JWT secret
process.env.JWT_SECRET

// User active status check
!user.isActive

// Comprehensive error logging
console.error('Auth Middleware Error:', error);
```

## 💡 Usage Examples

### Protected Route Implementation

```javascript
const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

// Apply middleware to protect routes
router.get('/profile', auth, async (req, res) => {
  try {
    // req.user is now available from middleware
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Apply to multiple routes
router.put('/update', auth, updateUserController);
router.get('/applications', auth, getApplicationsController);
```

### Request Headers

**Valid Request:**
```http
GET /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Invalid/Missing Token:**
```http
GET /api/users/profile
Authorization: InvalidTokenHere
```

### Response Examples

**Successful Authentication:**
```javascript
// req.user object attached to request:
{
  _id: "507f1f77bcf86cd799439011",
  name: "Commissioner Sharma",
  email: "sharma@municipal.gov",
  role: "COMMISSIONER",
  department: "HEALTHCARE",
  did: "did:mcp:a1b2c3d4e5f67890",
  isActive: true,
  createdAt: "2024-01-15T10:30:00.000Z",
  // ... other user fields (password excluded)
}
```

**Error Responses:**

No token provided:
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

Invalid or expired token:
```json
{
  "success": false,
  "message": "Invalid token."
}
```

User inactive:
```json
{
  "success": false,
  "message": "Invalid token or user inactive."
}
```

## 🛡️ Security Considerations

### JWT Configuration

```env
# Environment variables required
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d

# Security recommendations:
# - Use long, randomly generated secrets
# - Rotate secrets periodically in production
# - Use different secrets for different environments
```

### User Model Requirements

```javascript
// Expected User model structure
{
  _id: ObjectId,
  email: String,
  password: String, // Hashed, excluded in queries
  name: String,
  role: String, // APPLICANT, OFFICER, COMMISSIONER
  department: String, // For officers/commissioners
  did: String, // Decentralized Identifier
  isActive: Boolean, // Default: true
  // ... other fields
}
```

### Error Message Consistency

```javascript
// Consistent error messages prevent user enumeration
// Same message for different failure scenarios maintains security
message: 'Invalid token.' // Used for multiple error cases
```

## 🔄 Integration Examples

### Route Protection Patterns

**Single Route Protection:**
```javascript
app.get('/protected-route', auth, (req, res) => {
  // Route handler logic
});
```

**Router-Level Protection:**
```javascript
const router = express.Router();
router.use(auth); // All routes in this router are protected

router.get('/route1', (req, res) => { /* ... */ });
router.post('/route2', (req, res) => { /* ... */ });
```

**Conditional Protection:**
```javascript
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next(); // Continue without user for optional auth
  }
};
```

### Role-Based Access Control (Extension)

```javascript
// Extended middleware for role-based authorization
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions.' 
      });
    }
    
    next();
  };
};

// Usage example
router.get('/admin', auth, requireRole(['COMMISSIONER']), adminController);
```

## 📈 Performance Optimization

### Database Query Optimization

```javascript
// Current implementation already optimized:
const user = await User.findById(decoded.id).select('-password');

// Additional optimizations for heavy traffic:
const user = await User.findById(decoded.id)
  .select('-password -loginHistory -auditLogs')
  .cache(300); // Cache for 5 minutes if using caching
```

### Token Blacklisting (Future Enhancement)

```javascript
// For enhanced security, consider token blacklisting
const isTokenBlacklisted = async (token) => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return await Redis.exists(`blacklist:${hash}`);
};

// Add to middleware:
if (await isTokenBlacklisted(token)) {
  return res.status(401).json({ 
    success: false, 
    message: 'Token revoked.' 
  });
}
```

## 🚀 Production Considerations

### Rate Limiting

```javascript
// Implement rate limiting to prevent brute force attacks
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  skip: (req) => {
    // Skip rate limiting for successful auth
    return req.path === '/auth/login' && req.method === 'POST';
  }
});

app.use('/api', authLimiter);
```

### Security Headers

```javascript
// Add security headers for protected routes
app.use('/api', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: JWT validation, user status checking, password exclusion  
**Performance**: Optimized database queries, efficient error handling  
**Integration**: Express middleware, MongoDB, JWT  
**License**: MIT