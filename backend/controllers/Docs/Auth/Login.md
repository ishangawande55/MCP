# User Login Controller Documentation

## 📋 Overview

The `loginUser` controller handles user authentication within the Municipal Credentials Platform (MCP) ecosystem. It validates user credentials, generates JWT tokens for session management, and returns user-specific data based on their role and permissions.

## 🏗️ Authentication Architecture

![Authentication Architecture](diagrams/Authentication%20Architecture.png)

## 🎯 Key Features

- **🔐 Secure Authentication**: JWT-based token generation with expiration
- **👥 Multi-Role Support**: Handles all user roles (APPLICANT, OFFICER, COMMISSIONER)
- **🔒 Password Validation**: Secure password comparison using bcrypt
- **🏢 Department Awareness**: Returns department information for officers/commissioners
- **🌐 DID Integration**: Includes Decentralized Identifiers in responses
- **⚡ Active User Checking**: Ensures only active users can authenticate
- **📊 Comprehensive Response**: Returns both token and user profile data

## 🔧 Core Implementation

### Authentication Flow

![Authentication Flow](diagrams/Authentication%20Flow.png)

### Main Controller Function

```javascript
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    // Authentication logic continues...
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};
```

## 📊 User Validation Process

### User Lookup with Active Check

```javascript
// Find active user
const user = await User.findOne({ email, isActive: true });
if (!user) {
  return res.status(401).json({ success: false, message: 'Invalid credentials.' });
}
```

### Password Verification

```javascript
// Validate password
const isPasswordValid = await user.comparePassword(password);
if (!isPasswordValid) {
  return res.status(401).json({ success: false, message: 'Invalid credentials.' });
}
```

**Expected User Model Method:**
```javascript
// In User model (using bcrypt)
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
```

## 🔐 JWT Token Generation

### Payload Construction

```javascript
// Create JWT payload
const payload = {
  id: user._id,        // User identifier
  email: user.email,   // Email for additional verification
  role: user.role,     // Role-based access control
};

// Optionally include DID for officers/commissioners
if (user.did) payload.did = user.did;
```

### Token Signing

```javascript
const token = jwt.sign(
  payload, 
  process.env.JWT_SECRET, 
  { expiresIn: process.env.JWT_EXPIRES_IN }
);
```

### Environment Configuration
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Security recommendations:
# - Use strong, randomly generated JWT secret
# - Set appropriate expiration (7d for development, shorter for production)
# - Consider refresh token implementation for production
```

## 📋 Response Data Structure

### User Data Sanitization

```javascript
// Response data - only include safe, non-sensitive fields
const responseData = {
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || null,        // For officers/commissioners
  blockchainAddress: user.blockchainAddress || null, // For commissioners
  did: user.did || null,                      // Cryptographic identity
};
```

### Success Response Format

```javascript
res.json({
  success: true,
  message: 'Login successful',
  data: {
    token,          // JWT token for authentication
    user: responseData  // User profile information
  }
});
```

## 💡 Usage Examples

### Successful Login Request
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "sharma@municipal.gov",
  "password": "securePassword123"
}
```

### Commissioner Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Commissioner Sharma",
      "email": "sharma@municipal.gov",
      "role": "COMMISSIONER",
      "department": "HEALTHCARE",
      "blockchainAddress": "0x742d35Cc6634C0532925a3b8bc1934eF04240000",
      "did": "did:mcp:a1b2c3d4e5f67890"
    }
  }
}
```

### Applicant Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "role": "APPLICANT",
      "department": null,
      "blockchainAddress": null,
      "did": "did:mcp:b2c3d4e5f678901a"
    }
  }
}
```

### Officer Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439013",
      "name": "Officer Patel",
      "email": "patel@municipal.gov",
      "role": "OFFICER",
      "department": "LICENSE",
      "blockchainAddress": null,
      "did": "did:mcp:c3d4e5f678901a2b"
    }
  }
}
```

## 🛡️ Security Considerations

### Error Handling Strategy

```javascript
// Generic error messages prevent user enumeration
return res.status(401).json({ 
  success: false, 
  message: 'Invalid credentials.' 
});

// Same message for both user not found and invalid password
// This prevents attackers from determining which emails are registered
```

### JWT Security Best Practices

```javascript
// Recommended JWT configuration for production
const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '1h',                    // Short-lived tokens
  issuer: 'mcp-platform',             // Token issuer
  audience: 'mcp-users',              // Token audience
  subject: user._id.toString()        // Token subject
});

// Consider implementing refresh tokens for longer sessions
```

### Password Security

```javascript
// Expected User model pre-save hook for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  // Use strong bcrypt parameters
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
```

## 🔄 Integration Points

### Required Dependencies
```javascript
const jwt = require('jsonwebtoken');        // JWT token handling
const User = require('../../models/User');  // MongoDB User model
```

### Expected User Model Structure
```javascript
// User model should have:
{
  _id: ObjectId,
  email: String,           // Unique, required
  password: String,        // Hashed, required
  name: String,            // Required
  role: String,            // APPLICANT, OFFICER, COMMISSIONER
  department: String,      // Required for OFFICER/COMMISSIONER
  blockchainAddress: String, // For COMMISSIONER
  did: String,             // Decentralized Identifier
  isActive: Boolean,       // Default: true
  // ... other fields
}
```

### Authentication Middleware
```javascript
// Example middleware for protecting routes
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};
```

## 📈 Enhanced Features (Future Considerations)

### Rate Limiting
```javascript
// Implement rate limiting to prevent brute force attacks
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  }
});

// Apply to login route
app.use('/api/auth/login', loginLimiter);
```

### Refresh Token Implementation
```javascript
// For production: implement refresh token rotation
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};
```

### Login Analytics
```javascript
// Track login attempts for security monitoring
userSchema.methods.recordLoginAttempt = function(success) {
  this.lastLoginAttempt = new Date();
  this.loginAttempts = success ? 0 : (this.loginAttempts || 0) + 1;
  
  if (this.loginAttempts >= 5) {
    this.isActive = false; // Temporary lockout
  }
  
  return this.save();
};
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: JWT authentication, bcrypt password hashing  
**Compliance**: Secure authentication practices  
**Integration**: MongoDB, JWT, role-based access control  
**License**: MIT