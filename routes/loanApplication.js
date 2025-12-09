const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  applyLoan,
  getAllApplications,
  approveApplication,
  rejectApplication,
  payApplicationFee,
} = require('../controllers/loanApplicationController');

// Borrower applies
router.post('/', protect, applyLoan);

// Admin/Manager views all
router.get('/', protect, getAllApplications);

// Approve / Reject (Manager/Admin)
router.put('/approve/:id', protect, approveApplication);
router.put('/reject/:id', protect, rejectApplication);

// Pay fee
router.post('/pay', protect, payApplicationFee);

module.exports = router;
