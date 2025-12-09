const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
    borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    firstName: String,
    lastName: String,
    contactNumber: String,
    nationalId: String,
    incomeSource: String,
    monthlyIncome: Number,
    amount: Number,
    reason: String,
    address: String,
    extraNotes: String,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    applicationFeeStatus: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
    approvedAt: Date,
    paidAt: Date,
    paymentDetails: { type: Object } 
}, { timestamps: true });

module.exports = mongoose.model('LoanApplication', applicationSchema);
