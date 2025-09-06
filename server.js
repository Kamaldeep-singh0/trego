// ===================================================================
// TREXO ENGINEERING & CONSTRUCTION - UNIFIED SERVER (ADMIN-UI READY)
// ===================================================================

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const mongoose = require('mongoose');

// -------------------------------------------------------------------
// Boot logs
// -------------------------------------------------------------------
console.log('🏗️ Starting Trexo Engineering Server...');
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'dev-admin';

// -------------------------------------------------------------------
// Ensure uploads folder
// -------------------------------------------------------------------
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log('✅ Created uploads directory:', uploadPath);
}

// -------------------------------------------------------------------
// Email transport (optional; logs if not configured)
// -------------------------------------------------------------------
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: process.env.EMAIL_USER
    ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    : undefined
});

async function sendEmail(to, subject, text, html) {
  try {
    if (!process.env.EMAIL_USER) {
      console.log('📧 [Demo mode] Would send email:', { to, subject });
      return true;
    }
    await emailTransporter.sendMail({
      from: `"${process.env.COMPANY_NAME || 'Trexo Engineering'}" <${process.env.EMAIL_USER}>`,
      to, subject, text, html
    });
    console.log('📧 Email sent:', subject, '->', to);
    return true;
  } catch (err) {
    console.error('❌ Email error:', err.message);
    return false;
  }
}

// -------------------------------------------------------------------
// Multer upload config
// -------------------------------------------------------------------
const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: multerStorage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '', 10) || 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    cb(ok ? null : new Error('Only images and documents are allowed'));
  }
});

// -------------------------------------------------------------------
// Security, logging, sessions, rate limit, CORS
// -------------------------------------------------------------------
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX || '', 10) || 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000', `http://localhost:${PORT}`];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);

// -------------------------------------------------------------------
// In-memory fallbacks
// -------------------------------------------------------------------
let transactions = [];
let supportTickets = [];
let users = [];
let adminUsers = [];

// -------------------------------------------------------------------
// MongoDB connect + models
// -------------------------------------------------------------------
let Transaction, Ticket, User;
(async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('⚠️ No MONGODB_URI set: running in memory mode.');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    ({ Transaction, Ticket, User } = require('./database'));
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
})();

// -------------------------------------------------------------------
// Admin bootstrap (memory)
// -------------------------------------------------------------------
(async function initAdmin() {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', saltRounds);
  adminUsers = [
    {
      id: 1,
      username: 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@trexo.com',
      password: hashed,
      role: 'admin',
      name: 'System Administrator'
    }
  ];
  console.log('✅ Admin (memory) initialized:', adminUsers[0].email);
})();

// -------------------------------------------------------------------
// Auth helpers
// -------------------------------------------------------------------
function isAdminRequest(req) {
  const headerKey = req.header('x-admin-key');
  if (headerKey && headerKey === ADMIN_KEY) return true;
  if (req.session && req.session.role === 'admin') return true;
  return false;
}
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Authentication required' });
}
function requireAdmin(req, res, next) {
  if (isAdminRequest(req)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ===================================================================
// HEALTH
// ===================================================================
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString()
  });
});

// ===================================================================
// AUTH (admin + client)
// ===================================================================

// Admin login (memory)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const admin = adminUsers.find(u => u.username === username || u.email === username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = admin.id;
    req.session.role = 'admin';
    req.session.name = admin.name;

    res.json({ success: true, admin: { id: admin.id, name: admin.name, role: 'admin' } });
  } catch (e) {
    console.error('Admin login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Client register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone, company, projectType, hearAboutUs } = req.body || {};
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashed = await bcrypt.hash(password, saltRounds);

    // DB mode
    if (User) {
      const exists = await User.findOne({ email: email.toLowerCase() }).lean();
      if (exists) return res.status(409).json({ error: 'Email already registered' });

      const newUser = await User.create({
        name: `${firstName} ${lastName}`,
        email: email.toLowerCase(),
        password: hashed,
        role: 'client',
        phone: phone || '',
        company: company || ''
      });

      sendEmail(
        email,
        `Welcome to ${process.env.COMPANY_NAME || 'Trexo Engineering'}`,
        `Your account has been created.`,
        `<p>Hi ${firstName}, your account is ready.</p>`
      ).catch(() => {});

      return res.status(201).json({
        success: true,
        user: { id: newUser._id, name: newUser.name, email: newUser.email, role: 'client' }
      });
    }

    // Memory fallback
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()) || adminUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const id = Date.now();
    const user = {
      id,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email: email.toLowerCase(),
      password: hashed,
      phone: phone || '',
      company: company || '',
      projectType: projectType || '',
      hearAboutUs: hearAboutUs || '',
      role: 'client',
      createdAt: new Date().toISOString()
    };
    users.push(user);

    sendEmail(
      email,
      `Welcome to ${process.env.COMPANY_NAME || 'Trexo Engineering'}`,
      `Your account has been created.`,
      `<p>Hi ${firstName}, your account is ready.</p>`
    ).catch(() => {});

    res.status(201).json({
      success: true,
      user: { id, name: user.name, email: user.email, role: 'client' }
    });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Client login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Admin shortcut (memory admin)
    const a = adminUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (a) {
      const ok = await bcrypt.compare(password, a.password);
      if (ok) {
        req.session.userId = a.id;
        req.session.role = 'admin';
        req.session.name = a.name;
        return res.json({ success: true, user: { id: a.id, name: a.name, email: a.email, role: 'admin' } });
      }
    }

    // DB mode
    if (User) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      req.session.userId = user._id.toString();
      req.session.role = user.role || 'client';
      req.session.name = user.name;
      return res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role || 'client' } });
    }

    // Memory
    const u = users.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!u) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = u.id;
    req.session.role = 'client';
    req.session.name = u.name;
    res.json({ success: true, user: { id: u.id, name: u.name, email: u.email, role: 'client' } });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/auth/check-session', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: { id: req.session.userId, role: req.session.role, name: req.session.name }
    });
  }
  res.status(401).json({ authenticated: false });
});

app.get('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    if (User) {
      const user = await User.findById(req.session.userId).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          company: user.company || '',
          role: user.role || 'client'
        }
      });
    }
    const u = users.find(x => x.id === req.session.userId);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: { id: u.id, name: u.name, email: u.email, phone: u.phone, company: u.company, role: 'client' } });
  } catch (e) {
    console.error('Profile error:', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, company, currentPassword, newPassword } = req.body || {};

    if (User) {
      const user = await User.findById(req.session.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) return res.status(400).json({ error: 'Current password incorrect' });
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
        user.password = await bcrypt.hash(newPassword, saltRounds);
      }
      if (firstName || lastName) {
        const f = firstName ?? user.name.split(' ')[0] ?? '';
        const l = lastName ?? user.name.split(' ').slice(1).join(' ') ?? '';
        user.name = [f, l].filter(Boolean).join(' ');
      }
      if (phone !== undefined) user.phone = phone;
      if (company !== undefined) user.company = company;
      await user.save();

      return res.json({
        success: true,
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone || '', company: user.company || '', role: user.role || 'client' }
      });
    }

    // memory
    const idx = users.findIndex(x => x.id === req.session.userId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const u = users[idx];
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const ok = await bcrypt.compare(currentPassword, u.password);
      if (!ok) return res.status(400).json({ error: 'Current password incorrect' });
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
      u.password = await bcrypt.hash(newPassword, saltRounds);
    }
    if (firstName) u.firstName = firstName;
    if (lastName) u.lastName = lastName;
    if (firstName || lastName) u.name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    if (phone !== undefined) u.phone = phone;
    if (company !== undefined) u.company = company;

    res.json({ success: true, user: { id: u.id, name: u.name, email: u.email, phone: u.phone, company: u.company, role: 'client' } });
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ===================================================================
// PUBLIC CUSTOMER ENDPOINTS (Contact / Quote / Payment)
// ===================================================================

app.post('/api/contact', upload.single('attachment'), async (req, res) => {
  try {
    const { name, email, phone, company, projectType, budget, message } = req.body || {};
    const ticket = {
      id: Date.now(),
      type: 'contact',
      name,
      email,
      phone,
      company,
      projectType,
      budget,
      message,
      status: 'new',
      timestamp: new Date().toISOString(),
      attachment: req.file ? req.file.filename : null
    };
    supportTickets.push(ticket);

    if (Ticket) {
      await Ticket.create({
        id: ticket.id,
        type: ticket.type,
        name, email, phone, company,
        projectType, budget,
        message: ticket.message,
        status: ticket.status,
        timestamp: new Date(ticket.timestamp)
      });
    }

    await sendEmail(
      email,
      `We received your inquiry - ${process.env.COMPANY_NAME || 'Trexo Engineering'}`,
      '',
      `<p>Hi ${name}, thanks for contacting us. Your ticket ID is <b>${ticket.id}</b>.</p>`
    );

    res.json({ success: true, ticketId: ticket.id });
  } catch (e) {
    console.error('Contact error:', e);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

app.post('/api/quote', upload.array('documents', 5), async (req, res) => {
  try {
    const { name, email, phone, company, projectType, budget, timeline, description } = req.body || {};
    const ticket = {
      id: Date.now(),
      type: 'quote',
      name, email, phone, company, projectType, budget, timeline,
      description,
      status: 'new',
      timestamp: new Date().toISOString(),
      documents: (req.files || []).map(f => f.filename)
    };
    supportTickets.push(ticket);

    if (Ticket) {
      await Ticket.create({
        id: ticket.id,
        type: ticket.type,
        name, email, phone, company,
        projectType, budget,
        message: ticket.description,
        status: ticket.status,
        timestamp: new Date(ticket.timestamp)
      });
    }

    await sendEmail(
      email,
      `Quote request received - ${process.env.COMPANY_NAME || 'Trexo Engineering'}`,
      '',
      `<p>Hi ${name}, thanks for your quote request. Your quote ID is <b>${ticket.id}</b>.</p>`
    );

    res.json({ success: true, ticketId: ticket.id });
  } catch (e) {
    console.error('Quote error:', e);
    res.status(500).json({ error: 'Failed to submit quote' });
  }
});

// Payment simulation (creates transactions)
app.post('/api/payment', async (req, res) => {
  try {
    const {
      amount, description, paymentMethod, customerInfo,
      cardNumber, expiryDate, cvv, cardName,
      billingAddress, walletAddress, cryptoTxHash
    } = req.body || {};

    if (!amount || !paymentMethod || !customerInfo) {
      return res.status(400).json({ error: 'Amount, payment method and customer info are required' });
    }

    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const details = {};
    const isCrypto = ['bitcoin', 'ethereum', 'litecoin', 'dogecoin', 'cardano', 'solana'].includes(paymentMethod);

    if (paymentMethod.includes('card')) {
      if (!cardNumber || !expiryDate || !cvv || !cardName) return res.status(400).json({ error: 'Incomplete card details' });
      details.cardLast4 = cardNumber.slice(-4);
      details.cardType = getCardType(cardNumber);
      details.expiryDate = expiryDate;
      details.cardHolderName = cardName;
    } else if (isCrypto) {
      if (!walletAddress) return res.status(400).json({ error: 'Wallet address required' });
      const cryptoRates = { bitcoin: 0.000024, ethereum: 0.0004, litecoin: 0.0135, dogecoin: 12.5, cardano: 2.0, solana: 0.01 };
      details.cryptoType = paymentMethod.toUpperCase();
      details.exchangeRate = cryptoRates[paymentMethod];
      details.cryptoAmount = (amt * cryptoRates[paymentMethod]).toFixed(8);
      details.walletAddress = walletAddress;
      details.networkFee = calculateCryptoFee(paymentMethod);
      details.transactionHash = cryptoTxHash || null;
    } else {
      // allow, but no extra details
    }

    const fee = calculateProcessingFee(paymentMethod, amt);
    const txn = {
      id: 'TXN_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      amount: amt,
      description: description || 'Construction Service Payment',
      paymentMethod,
      customerInfo: {
        name: customerInfo.name || `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim(),
        email: customerInfo.email,
        phone: customerInfo.phone || '',
        company: customerInfo.company || '',
        address: billingAddress || customerInfo.address || ''
      },
      paymentDetails: details,
      status: 'processing',
      timestamp: new Date().toISOString(),
      processingFee: fee,
      netAmount: Math.round((amt - fee) * 100) / 100,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    transactions.push(txn);
    if (Transaction) {
      await Transaction.create({
        id: txn.id,
        amount: txn.amount,
        description: txn.description,
        paymentMethod: txn.paymentMethod,
        customerInfo: txn.customerInfo,
        paymentDetails: txn.paymentDetails,
        status: txn.status,
        timestamp: new Date(txn.timestamp),
        processingFee: txn.processingFee,
        netAmount: txn.netAmount
      });
    }

    const ms = getProcessingTime(paymentMethod);
    setTimeout(async () => {
      const idx = transactions.findIndex(t => t.id === txn.id);
      if (idx === -1) return;

      const success = Math.random() < getSuccessRate(paymentMethod);
      transactions[idx].status = success ? 'completed' : 'failed';
      transactions[idx].processedAt = new Date().toISOString();

      if (success) {
        transactions[idx].confirmationCode = generateConfirmationCode(paymentMethod);
        if (isCrypto && !transactions[idx].paymentDetails.transactionHash) {
          transactions[idx].paymentDetails.transactionHash = generateCryptoTxHash(paymentMethod);
        }
        await sendPaymentConfirmationEmail(transactions[idx]).catch(() => {});
      } else {
        transactions[idx].failureReason = getFailureReason(paymentMethod);
      }

      if (Transaction) {
        await Transaction.findOneAndUpdate(
          { id: txn.id },
          {
            $set: {
              status: transactions[idx].status,
              processedAt: new Date(transactions[idx].processedAt),
              confirmationCode: transactions[idx].confirmationCode || null,
              failureReason: transactions[idx].failureReason || null,
              paymentDetails: transactions[idx].paymentDetails
            }
          }
        );
      }
    }, ms);

    res.json({
      success: true,
      message: `${paymentMethod.toUpperCase()} payment is being processed.`,
      transactionId: txn.id
    });
  } catch (e) {
    console.error('Payment error:', e);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Helpers for payment
function getCardType(n) {
  const f = n.charAt(0);
  const t = n.substr(0, 2);
  if (f === '4') return 'Visa';
  if (t >= '51' && t <= '55') return 'Mastercard';
  if (t === '34' || t === '37') return 'American Express';
  if (t === '60' || t === '65') return 'Discover';
  return 'Unknown';
}
function calculateProcessingFee(method, amount) {
  const fees = {
    card: 0.029, 'credit-card': 0.029, 'debit-card': 0.025,
    bitcoin: 0.005, ethereum: 0.01, litecoin: 0.005, dogecoin: 0.005, cardano: 0.005, solana: 0.005
  };
  const pct = fees[method] || 0;
  return Math.round(amount * pct * 100) / 100;
}
function calculateCryptoFee(type) {
  const net = { bitcoin: 0.0001, ethereum: 0.001, litecoin: 0.001, dogecoin: 1.0, cardano: 0.17, solana: 0.00025 };
  return net[type] || 0;
}
function getProcessingTime(method) {
  const times = {
    card: 2000 + Math.random() * 3000, 'credit-card': 2000 + Math.random() * 3000, 'debit-card': 1000 + Math.random() * 2000,
    bitcoin: 10000 + Math.random() * 20000, ethereum: 5000 + Math.random() * 10000, litecoin: 3000 + Math.random() * 7000,
    dogecoin: 1000 + Math.random() * 4000, cardano: 2000 + Math.random() * 5000, solana: 1000 + Math.random() * 2000,
    paypal: 3000 + Math.random() * 5000, 'bank-transfer': 5000 + Math.random() * 10000, 'wire-transfer': 8000 + Math.random() * 12000
  };
  return times[method] || 3000;
}
function getSuccessRate(method) {
  const rates = {
    card: 0.85, 'credit-card': 0.85, 'debit-card': 0.9,
    bitcoin: 0.95, ethereum: 0.93, litecoin: 0.95, dogecoin: 0.97, cardano: 0.95, solana: 0.95
  };
  return rates[method] || 0.85;
}
function generateConfirmationCode(method) {
  const prefix = ['bitcoin','ethereum','litecoin','dogecoin','cardano','solana'].includes(method)
    ? 'CRYPTO'
    : method.includes('card') ? 'CARD' : method.includes('transfer') ? 'XFER' : 'PAY';
  return prefix + '_' + Math.random().toString(36).slice(2, 10).toUpperCase();
}
function generateCryptoTxHash(type) {
  const p = { bitcoin: '1', ethereum: '0x', litecoin: 'L', dogecoin: 'D', cardano: 'addr1', solana: '' }[type] || '';
  return p + Math.random().toString(36).slice(2, 17) + Math.random().toString(36).slice(2, 17);
}
async function sendPaymentConfirmationEmail(tx) {
  const { customerInfo, paymentMethod, amount, id, confirmationCode, paymentDetails } = tx;
  let extra = '';
  if (['bitcoin','ethereum','litecoin','dogecoin','cardano','solana'].includes(paymentMethod)) {
    extra = `
      <p><b>${paymentDetails.cryptoType}</b> amount: ${paymentDetails.cryptoAmount}</p>
      <p>Network fee: ${paymentDetails.networkFee}</p>
      <p>Tx Hash: ${paymentDetails.transactionHash}</p>
    `;
  } else if (paymentMethod.includes('card')) {
    extra = `<p>Card: ${paymentDetails.cardType} •••• ${paymentDetails.cardLast4}</p>`;
  }
  const html = `
    <h2>✅ Payment Confirmation</h2>
    <p>Hi ${customerInfo.name}, your ${paymentMethod.toUpperCase()} payment was processed.</p>
    <p><b>Transaction:</b> ${id}</p>
    <p><b>Amount:</b> $${amount.toLocaleString()}</p>
    <p><b>Code:</b> ${confirmationCode}</p>
    ${extra}
  `;
  await sendEmail(customerInfo.email, `Payment Confirmation - ${id}`, '', html);
}

// ===================================================================
// *** ADMIN-UI COMPATIBLE ROUTES ***
// (These are what your admin.html calls)
// ===================================================================

// LIST transactions  -> /api/transactions?status=all|pending|completed|failed&limit=50&sort=desc
app.get('/api/transactions', async (req, res) => {
  try {
    const { status = 'all', limit = '50', sort = 'desc' } = req.query;
    const q = (status && status !== 'all') ? { status } : {};
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const dir = sort === 'asc' ? 1 : -1;

    if (Transaction) {
      const items = await Transaction.find(q).sort({ timestamp: dir }).limit(lim).lean();
      return res.json(items);
    }
    // memory
    let items = transactions.slice();
    if (q.status) items = items.filter(t => t.status === q.status);
    items.sort((a,b) => (new Date(a.timestamp) - new Date(b.timestamp)) * dir);
    return res.json(items.slice(0, lim));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// LIST tickets -> /api/tickets?status=all|new|in-progress|closed&type=all|quote|contact&limit=50&sort=desc
app.get('/api/tickets', async (req, res) => {
  try {
    const { status = 'all', type = 'all', limit = '50', sort = 'desc' } = req.query;
    const q = {};
    if (status !== 'all') q.status = status;
    if (type !== 'all') q.type = type;
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const dir = sort === 'asc' ? 1 : -1;

    if (Ticket) {
      const items = await Ticket.find(q).sort({ timestamp: dir }).limit(lim).lean();
      return res.json(items);
    }
    // memory
    let items = supportTickets.slice();
    if (q.status) items = items.filter(t => t.status === q.status);
    if (q.type) items = items.filter(t => t.type === q.type);
    items.sort((a,b) => (new Date(a.timestamp) - new Date(b.timestamp)) * dir);
    return res.json(items.slice(0, lim));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

// CREATE ticket (generic) -> POST /api/tickets
app.post('/api/tickets', async (req, res) => {
  try {
    const { type = 'contact', name, email, phone, company, projectType, budget, message, description } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const ticket = {
      id: Date.now(),
      type,
      name, email, phone, company,
      projectType: projectType || '',
      budget: budget || '',
      message: message || description || '',
      status: 'new',
      timestamp: new Date().toISOString()
    };
    supportTickets.push(ticket);

    if (Ticket) {
      await Ticket.create({
        id: ticket.id,
        type: ticket.type,
        name: ticket.name,
        email: ticket.email,
        phone: ticket.phone,
        company: ticket.company,
        projectType: ticket.projectType,
        budget: ticket.budget,
        message: ticket.message,
        status: ticket.status,
        timestamp: new Date(ticket.timestamp)
      });
    }

    res.status(201).json(ticket);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Failed to create ticket' });
  }
});

// UPDATE transaction status -> PATCH /api/transactions/:id  { status }
app.patch('/api/transactions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status is required' });

    if (Transaction) {
      const updated = await Transaction.findOneAndUpdate({ id }, { status }, { new: true });
      if (!updated) return res.status(404).json({ error: 'Transaction not found' });
      return res.json(updated);
    }

    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
    transactions[idx].status = status;
    return res.json(transactions[idx]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// UPDATE ticket status -> PATCH /api/tickets/:id  { status }
app.patch('/api/tickets/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; // numeric id
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const numericId = Number(id);
    if (Ticket) {
      const updated = await Ticket.findOneAndUpdate({ id: numericId }, { status }, { new: true });
      if (!updated) return res.status(404).json({ error: 'Ticket not found' });
      return res.json(updated);
    }

    const idx = supportTickets.findIndex(t => t.id === numericId);
    if (idx === -1) return res.status(404).json({ error: 'Ticket not found' });
    supportTickets[idx].status = status;
    return res.json(supportTickets[idx]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// DASHBOARD STATS -> GET /api/stats
app.get('/api/stats', async (_req, res) => {
  try {
    if (Transaction && Ticket) {
      const [
        totalTransactions,
        completedTransactions,
        pendingTransactions,
        totalTickets,
        newTickets,
        revenueAgg
      ] = await Promise.all([
        Transaction.countDocuments({}),
        Transaction.countDocuments({ status: 'completed' }),
        Transaction.countDocuments({ status: 'pending' }),
        Ticket.countDocuments({}),
        Ticket.countDocuments({ status: 'new' }),
        Transaction.aggregate([
          { $match: { status: 'completed' } },
          {
            $group: {
              _id: null,
              gross: { $sum: '$amount' },
              net: { $sum: { $ifNull: ['$netAmount', '$amount'] } }
            }
          }
        ])
      ]);

      const totalRevenueGross = revenueAgg[0]?.gross || 0;
      const totalRevenueNet = revenueAgg[0]?.net || 0;

      return res.json({
        totalRevenue: totalRevenueNet,          // for UI compatibility
        totalRevenueNet,
        totalRevenueGross,
        totalTransactions,
        completedTransactions,
        pendingTransactions,
        totalTickets,
        newTickets
      });
    }

    // memory mode
    const completed = transactions.filter(t => t.status === 'completed');
    const pending = transactions.filter(t => t.status === 'pending');
    const gross = completed.reduce((s, t) => s + (t.amount || 0), 0);
    const net = completed.reduce((s, t) => s + (t.netAmount ?? t.amount ?? 0), 0);

    res.json({
      totalRevenue: net,
      totalRevenueNet: net,
      totalRevenueGross: gross,
      totalTransactions: transactions.length,
      completedTransactions: completed.length,
      pendingTransactions: pending.length,
      totalTickets: supportTickets.length,
      newTickets: supportTickets.filter(t => t.status === 'new').length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ===================================================================
// OPTIONAL: Language endpoints
// ===================================================================
const translations = {
  en: { nav: { home: 'Home', about: 'About', services: 'Services', projects: 'Projects', contact: 'Contact', getQuote: 'Get Quote', login: 'Login' } },
  es: { nav: { home: 'Inicio', about: 'Acerca', services: 'Servicios', projects: 'Proyectos', contact: 'Contacto', getQuote: 'Cotizar', login: 'Iniciar Sesión' } }
};
app.get('/api/languages', (_req, res) => {
  res.json({ languages: [{ code: 'en', name: 'English', flag: '🇺🇸' }, { code: 'es', name: 'Español', flag: '🇪🇸' }] });
});
app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang;
  res.json({ success: true, language: translations[lang] ? lang : 'en', translations: translations[lang] || translations.en });
});

// ===================================================================
// Company info
// ===================================================================
app.get('/api/company-info', (_req, res) => {
  res.json({
    name: process.env.COMPANY_NAME || 'Trexo Engineering & Construction',
    email: process.env.COMPANY_EMAIL || 'info@trexo.com',
    phone: process.env.COMPANY_PHONE || '(555) 123-4567',
    address: process.env.COMPANY_ADDRESS || '123 Construction Ave, City, State 12345'
  });
});

// ===================================================================
// Static + pages
// ===================================================================
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));


app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup', (_req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/register', (_req, res) => res.sendFile(path.join(__dirname, 'signup.html')));

app.get('/admin', (req, res) => {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    return res.sendFile(path.join(__dirname, 'admin.html'));
  }
  // You can also allow opening admin.html directly if you're using the x-admin-key
  return res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/dashboard', (req, res) => {
  if (req.session && req.session.userId && req.session.role === 'client') {
    return res.sendFile(path.join(__dirname, 'dashboard.html'));
  }
  return res.redirect('/login');
});

// Catch-all -> your landing page
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ===================================================================
// Global error handler
// ===================================================================
app.use((err, _req, res, _next) => {
  console.error('❌ Server Error:', err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ===================================================================
// Start
// ===================================================================
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 TREXO ENGINEERING & CONSTRUCTION SERVER');
  console.log('='.repeat(60));
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`👤 Admin: http://localhost:${PORT}/admin`);
  console.log(`🔐 Login: http://localhost:${PORT}/login`);
  console.log(`📊 Client Dashboard: http://localhost:${PORT}/dashboard`);
  console.log('='.repeat(60));
  console.log('🔐 ADMIN_KEY:', ADMIN_KEY);
  console.log(`📁 Upload dir: ${uploadPath}`);
  console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email configured: ${process.env.EMAIL_USER ? 'Yes' : 'No (demo mode)'}`);
  console.log('='.repeat(60));
});
