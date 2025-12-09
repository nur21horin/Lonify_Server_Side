const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  addLoan,
  getAllLoans,
  updateLoan,
  deleteLoan,
  getLoanById,
} = require('../controllers/loanController');

// Public route
router.get('/', getAllLoans);
router.get('/:id', getLoanById);

// Manager/Admin routes
router.post('/', protect, addLoan);
router.put('/:id', protect, updateLoan);
router.delete('/:id', protect, deleteLoan);

module.exports = router;
