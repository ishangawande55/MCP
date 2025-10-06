const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

const {
  loginUser
} = require('../controllers/auth/loginController');

const {
  getCurrentUser
} = require('../controllers/auth/getCurrentUserController');

const {
  registerUser
} = require('../controllers/auth/registerController');

const {
  changePassword
} = require('../controllers/auth/changePasswordController');

const router = express.Router();

// Public: Login
router.post('/login', loginUser);

// Public: Departmental user self-registration
router.post('/register', registerUser);

// Private/Admin: Register admin/commissioner (if needed separately)
// router.post('/register-admin', auth, requireAdmin, registerUser);

// Private: Get current logged-in user
router.get('/me', auth, getCurrentUser);

// Private: Change password
router.put('/change-password', auth, changePassword);

module.exports = router;