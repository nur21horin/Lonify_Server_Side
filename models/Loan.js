const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    interest: { type: Number },
    maxLimit: { type: Number },
    emiPlans: [{ type: String }],
    images: [{ type: String }],
    showOnHome: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
