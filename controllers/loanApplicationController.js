const LoanApplication = require('../models/LoanApplication');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Apply for a loan (Borrower)
const applyLoan = async (req, res) => {
  try {
    const application = await LoanApplication.create({
      ...req.body,
      user: req.user._id,
      loan: req.body.loanId
    });
    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all applications (Admin/Manager)
const getAllApplications = async (req, res) => {
  try {
    const applications = await LoanApplication.find()
      .populate('user', 'name email')
      .populate('loan', 'title category');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve loan
const approveApplication = async (req, res) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });
    application.status = 'Approved';
    application.approvedAt = new Date();
    await application.save();
    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reject loan
const rejectApplication = async (req, res) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });
    application.status = 'Rejected';
    await application.save();
    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Stripe payment
const payApplicationFee = async (req, res) => {
  try {
    const { amount, applicationId } = req.body; // amount in cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
    });

    const application = await LoanApplication.findById(applicationId);
    if (application) {
      application.applicationFeeStatus = 'Paid';
      application.paymentDetails = {
        transactionId: paymentIntent.id,
        email: req.user.email,
        amount,
      };
      await application.save();
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  applyLoan,
  getAllApplications,
  approveApplication,
  rejectApplication,
  payApplicationFee,
};
