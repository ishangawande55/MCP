const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

const {
  loginUser
} = require('../controllers/auth/loginController');


const {
  registerUser
} = require('../controllers/auth/registerController');


const router = express.Router();

// Public: Login
router.post('/login', loginUser);

// Public: Departmental user self-registration
router.post('/register', registerUser);

// Private/Admin: Register admin/commissioner (if needed separately)
// router.post('/register-admin', auth, requireAdmin, registerUser);


module.exports = router;