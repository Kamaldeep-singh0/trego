// Create this new file for database operations

const mongoose = require('mongoose');

// MongoDB Schemas
const TransactionSchema = new mongoose.Schema({
    id: String,
    amount: Number,
    description: String,
    paymentMethod: String,
    customerInfo: Object,
    paymentDetails: Object,
    status: String,
    timestamp: { type: Date, default: Date.now },
    confirmationCode: String,
    processingFee: Number,
    netAmount: Number
});

const TicketSchema = new mongoose.Schema({
    id: Number,
    type: String,
    name: String,
    email: String,
    phone: String,
    company: String,
    projectType: String,
    budget: String,
    message: String,
    status: { type: String, default: 'new' },
    timestamp: { type: Date, default: Date.now },
    responses: Array,
    priority: { type: String, default: 'normal' }
});

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'client' },
    phone: String,
    company: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = {
    Transaction: mongoose.model('Transaction', TransactionSchema),
    Ticket: mongoose.model('Ticket', TicketSchema),
    User: mongoose.model('User', UserSchema)
};