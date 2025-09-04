// ===================================================================
// TREXO ENGINEERING & CONSTRUCTION - COMPLETE BACKEND SERVER
// ===================================================================

const path = require('path');
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');

console.log('🏗️ Starting Trexo Engineering Server...');

const app = express();
const PORT = process.env.PORT || 3000;

// Test if basic dependencies work
try {
  console.log('✅ Express loaded successfully');
  console.log('✅ Path module loaded');
  console.log('✅ Environment variables loaded');
  console.log('✅ All dependencies imported successfully');
} catch (error) {
  console.error('❌ Error loading basic dependencies:', error);
  process.exit(1);
}

// Create uploads directory if it doesn't exist
const uploadPath = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Initialize in-memory storage arrays (used as fallback if no DB)
let transactions = [];
let supportTickets = [];
let users = [];
let adminUsers = [];

// ===================================================================
// EMAIL TRANSPORT
// ===================================================================
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: process.env.EMAIL_USER
    ? {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    : undefined
});

// ===================================================================
// FILE UPLOAD (multer)
// ===================================================================
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only images and documents are allowed'));
  }
});

// ===================================================================
// ADMIN SETUP (in-memory, for bootstrap; you can also seed in DB)
// ===================================================================
const initializeAdmin = async () => {
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', saltRounds);

    adminUsers = [
      {
        id: 1,
        username: 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@trexo.com',
        password: hashedPassword,
        role: 'admin',
        name: 'System Administrator'
      }
    ];

    console.log('✅ Admin user initialized');
    console.log(`📧 Admin email: ${process.env.ADMIN_EMAIL || 'admin@trexo.com'}`);
  } catch (error) {
    console.error('❌ Error initializing admin:', error);
  }
};
initializeAdmin();

// ===================================================================
// SECURITY + LOGGING
// ===================================================================
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(
  cors({
    origin: corsOrigins,
    optionsSuccessStatus: 200,
    credentials: true
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// ===================================================================
// AUTH MIDDLEWARE + HELPERS
// ===================================================================
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Authentication required' });
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin access required' });
};

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'default-jwt-secret', { expiresIn: '24h' });
};

const sendEmail = async (to, subject, text, html) => {
  try {
    if (!process.env.EMAIL_USER) {
      console.log('📧 Email not configured, would send:', { to, subject });
      return true;
    }
    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'Trexo Engineering'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    };
    await emailTransporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return false;
  }
};

// ===================================================================
// DATABASE (MongoDB via mongoose) + MODELS
// ===================================================================
const mongoose = require('mongoose');
let Transaction, Ticket, User; // will assign after require('./database')

const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      const models = require('./database');
      Transaction = models.Transaction;
      Ticket = models.Ticket;
      User = models.User;
      console.log('✅ MongoDB connected successfully');
    } else {
      console.log('⚠️ No database configured, using in-memory storage');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};
connectDB();

// ===================================================================
// AUTHENTICATION ROUTES
// ===================================================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    // In-memory admin (simple bootstrap)
    const admin = adminUsers.find(u => u.username === username || u.email === username);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = admin.id;
    req.session.role = admin.role;
    req.session.name = admin.name;

    console.log('👤 Admin logged in:', admin.email);
    res.json({ success: true, message: 'Login successful', admin: { id: admin.id, name: admin.name, role: admin.role } });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Client login (DB first if available)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Admin shortcut
    const admin = adminUsers.find(u => u.email === email);
    if (admin) {
      const ok = await bcrypt.compare(password, admin.password);
      if (ok) {
        req.session.userId = admin.id;
        req.session.role = 'admin';
        req.session.name = admin.name;
        return res.json({ success: true, user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' } });
      }
    }

    // DB mode
    if (process.env.MONGODB_URI && User) {
      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      // Password is hashed on registration in DB mode; if your seeded users aren't hashed, you may adapt.
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      req.session.userId = user._id.toString();
      req.session.role = user.role || 'client';
      req.session.name = user.name;

      return res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || 'client'
        }
      });
    }

    // Fallback in-memory
    const memUser = users.find(u => u.email === email);
    if (!memUser) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, memUser.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = memUser.id;
    req.session.role = 'client';
    req.session.name = memUser.name;

    res.json({ success: true, user: { id: memUser.id, name: memUser.name, email: memUser.email, role: memUser.role } });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout for both admin and client
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check session for both admin and client
app.get('/api/auth/check-session', (req, res) => {
  if (req.session && req.session.userId) {
    const isAdmin = req.session.role === 'admin';
    if (isAdmin) {
      const admin = adminUsers.find(u => u.id === req.session.userId);
      if (admin) {
        return res.json({
          authenticated: true,
          user: { id: admin.id, name: admin.name || req.session.name, email: admin.email, role: 'admin' }
        });
      }
      return res.status(401).json({ authenticated: false });
    }

    // Client path
    if (process.env.MONGODB_URI && User) {
      return res.json({
        authenticated: true,
        user: { id: req.session.userId, name: req.session.name, email: undefined, role: 'client' }
      });
    } else {
      const u = users.find(x => x.id === req.session.userId);
      if (!u) return res.status(401).json({ authenticated: false });
      return res.json({
        authenticated: true,
        user: { id: u.id, name: u.name || req.session.name, email: u.email, role: 'client' }
      });
    }
  }
  return res.status(401).json({ authenticated: false });
});

// ===================================================================
// USER REGISTRATION & PROFILE (DB-first, fallback in-memory)
// ===================================================================

// Client registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone, company, projectType, hearAboutUs } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let newUser;
    if (process.env.MONGODB_URI && User) {
      // Check duplicate in DB
      const exist = await User.findOne({ email: email.toLowerCase() }).lean();
      if (exist) return res.status(409).json({ error: 'An account with this email already exists' });

      newUser = await User.create({
        name: `${firstName} ${lastName}`,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'client',
        phone: phone || '',
        company: company || ''
      });
    } else {
      // Fallback in-memory + check admin conflict
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      const existingAdmin = adminUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser || existingAdmin) return res.status(409).json({ error: 'An account with this email already exists' });

      newUser = {
        id: Date.now(),
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || '',
        company: company || '',
        projectType: projectType || '',
        hearAboutUs: hearAboutUs || '',
        role: 'client',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        emailVerified: false,
        verificationToken: Math.random().toString(36).substr(2, 15)
      };
      users.push(newUser);
    }

    // Welcome email (non-blocking)
    const welcomeEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2c5aa0, #f39c12); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">🎉 Welcome to ${process.env.COMPANY_NAME || 'Trexo Engineering'}!</h2>
          <p style="margin: 10px 0 0 0;">Your account has been created successfully</p>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>Thank you for joining ${process.env.COMPANY_NAME || 'Trexo Engineering & Construction'}! We're excited to help you with your construction and engineering needs.</p>
          <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #2c5aa0; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #2c5aa0;">Your Account Details:</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:${PORT}/login" style="background: #2c5aa0; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">🔐 Login to Your Account</a>
          </div>
          <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #2c5aa0;">Need Help?</h4>
            <p style="margin: 5px 0;">📧 Email: <a href="mailto:${process.env.COMPANY_SUPPORT_EMAIL || 'support@trexo.com'}" style="color: #2c5aa0;">${process.env.COMPANY_SUPPORT_EMAIL || 'support@trexo.com'}</a></p>
            <p style="margin: 5px 0;">📞 Phone: <a href="tel:${process.env.COMPANY_PHONE || ''}" style="color: #2c5aa0;">${process.env.COMPANY_PHONE || '(555) 123-4567'}</a></p>
            <p style="margin: 5px 0;">⏰ Business Hours: Monday - Friday, 8:00 AM - 6:00 PM</p>
          </div>
          <p>Thank you for choosing ${process.env.COMPANY_NAME || 'Trexo Engineering'} for your construction needs!</p>
          <p>Best regards,<br><strong>The ${process.env.COMPANY_NAME || 'Trexo Engineering'} Team</strong></p>
        </div>
      </div>
    `;
    sendEmail(
      email,
      `Welcome to ${process.env.COMPANY_NAME || 'Trexo Engineering'} - Account Created!`,
      `Welcome ${firstName}! Your account has been created successfully. Login at: http://localhost:${PORT}/login`,
      welcomeEmailHtml
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email for welcome information.',
      user:
        process.env.MONGODB_URI && User
          ? { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role || 'client' }
          : { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      redirectTo: '/login'
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Check if email is available
app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    if (process.env.MONGODB_URI && User) {
      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      const adminDup = adminUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      const isAvailable = !user && !adminDup;
      return res.json({ available: isAvailable, message: isAvailable ? 'Email is available' : 'Email is already registered' });
    }

    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const existingAdmin = adminUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    const isAvailable = !existingUser && !existingAdmin;
    res.json({ available: isAvailable, message: isAvailable ? 'Email is available' : 'Email is already registered' });
  } catch (error) {
    console.error('❌ Email check error:', error);
    res.status(500).json({ error: 'Failed to check email availability' });
  }
});

// Get user profile
app.get('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    if (process.env.MONGODB_URI && User) {
      const user = await User.findById(req.session.userId).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({
        success: true,
        user: {
          id: user._id,
          firstName: user.name?.split(' ')[0] || '',
          lastName: user.name?.split(' ').slice(1).join(' ') || '',
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          company: user.company || '',
          projectType: '',
          role: user.role || 'client',
          status: 'active',
          createdAt: user.createdAt,
          lastLogin: null
        }
      });
    }

    // Fallback memory
    const user = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company: user.company,
        projectType: user.projectType,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Update user profile
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, company, currentPassword, newPassword } = req.body;

    if (process.env.MONGODB_URI && User) {
      const user = await User.findById(req.session.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // If changing password
      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password required to change password' });
        const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentValid) return res.status(400).json({ error: 'Current password is incorrect' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        user.password = await bcrypt.hash(newPassword, saltRounds);
      }

      // Update fields
      if (firstName || lastName) {
        const fname = firstName || user.name?.split(' ')[0] || '';
        const lname = lastName || user.name?.split(' ').slice(1).join(' ') || '';
        user.name = [fname, lname].filter(Boolean).join(' ');
      }
      if (phone !== undefined) user.phone = phone;
      if (company !== undefined) user.company = company;

      await user.save();
      return res.json({
        success: true,
        message: 'Profile updated successfully',
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

    // Fallback memory
    const userIndex = users.findIndex(u => u.id === req.session.userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    const user = users[userIndex];

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required to change password' });
      const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentValid) return res.status(400).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      user.password = await bcrypt.hash(newPassword, saltRounds);
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (firstName || lastName) user.name = `${user.firstName} ${user.lastName}`.trim();
    if (phone !== undefined) user.phone = phone;
    if (company !== undefined) user.company = company;

    user.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, name: user.name, email: user.email, phone: user.phone, company: user.company, role: user.role }
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ===================================================================
// CUSTOMER API ROUTES (Contact, Quote)  — DB-first persistence
// ===================================================================

// Contact form submission
app.post('/api/contact', upload.single('attachment'), async (req, res) => {
  try {
    const { name, email, phone, company, projectType, budget, message } = req.body;

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

    // >>> MongoDB: persist contact ticket
    if (process.env.MONGODB_URI && Ticket) {
      try {
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
          timestamp: new Date(ticket.timestamp),
          responses: ticket.responses || [],
          priority: ticket.priority || 'normal'
        });
        console.log('🗄️ Contact ticket saved to MongoDB:', ticket.id);
      } catch (e) {
        console.error('❌ Failed to persist contact ticket to MongoDB:', e.message);
      }
    }
    // <<< MongoDB persist

    // Send confirmation email
    const emailHtml = `
      <h2>Thank you for contacting ${process.env.COMPANY_NAME || 'Trexo Engineering'}!</h2>
      <p>Dear ${name},</p>
      <p>We have received your inquiry and will get back to you within 24 hours.</p>
      <p><strong>Your ticket ID:</strong> ${ticket.id}</p>
    `;
    await sendEmail(email, 'Thank you for your inquiry', '', emailHtml);

    console.log('📩 New contact form submission:', ticket.id);
    res.json({ success: true, message: 'Your inquiry has been received! We will contact you soon.', ticketId: ticket.id });
  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// Quote request submission
app.post('/api/quote', upload.array('documents', 5), async (req, res) => {
  try {
    const { name, email, phone, company, projectType, budget, timeline, description } = req.body;

    const ticket = {
      id: Date.now(),
      type: 'quote',
      name,
      email,
      phone,
      company,
      projectType,
      budget,
      timeline,
      description,
      status: 'new',
      timestamp: new Date().toISOString(),
      documents: req.files ? req.files.map(f => f.filename) : []
    };

    supportTickets.push(ticket);

    // >>> MongoDB: persist quote ticket
    if (process.env.MONGODB_URI && Ticket) {
      try {
        await Ticket.create({
          id: ticket.id,
          type: ticket.type,
          name: ticket.name,
          email: ticket.email,
          phone: ticket.phone,
          company: ticket.company,
          projectType: ticket.projectType,
          budget: ticket.budget,
          message: ticket.description, // store description in message field
          status: ticket.status,
          timestamp: new Date(ticket.timestamp),
          responses: ticket.responses || [],
          priority: ticket.priority || 'normal'
        });
        console.log('🗄️ Quote ticket saved to MongoDB:', ticket.id);
      } catch (e) {
        console.error('❌ Failed to persist quote ticket to MongoDB:', e.message);
      }
    }
    // <<< MongoDB persist

    // Send confirmation email
    const emailHtml = `
      <h2>Quote Request Received - ${process.env.COMPANY_NAME || 'Trexo Engineering'}</h2>
      <p>Dear ${name},</p>
      <p>We have received your quote request and will prepare a detailed proposal within 48 hours.</p>
      <p><strong>Your quote ID:</strong> ${ticket.id}</p>
      <p><strong>Project Type:</strong> ${projectType}</p>
      <p><strong>Budget Range:</strong> ${budget}</p>
    `;
    await sendEmail(email, 'Quote Request Received', '', emailHtml);

    console.log('💰 New quote request:', ticket.id);
    res.json({ success: true, message: 'Your quote request has been received! We will send you a proposal soon.', ticketId: ticket.id });
  } catch (error) {
    console.error('❌ Quote request error:', error);
    res.status(500).json({ error: 'Failed to submit quote request' });
  }
});

// ===================================================================
// PAYMENTS (with simulated processing + crypto) — DB persistence
// ===================================================================

app.post('/api/payment', async (req, res) => {
  try {
    console.log('💳 Payment request received:', req.body);

    const {
      amount,
      description,
      paymentMethod,
      customerInfo,
      cardNumber,
      expiryDate,
      cvv,
      cardName,
      billingAddress,
      walletAddress,
      cryptoTxHash
    } = req.body;

    // Validate required fields
    if (!amount || !paymentMethod || !customerInfo) {
      return res.status(400).json({ error: 'Amount, payment method, and customer info are required' });
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // Validate payment method specific requirements
    let paymentDetails = {};

    switch (paymentMethod) {
      case 'card':
      case 'credit-card':
      case 'debit-card':
        if (!cardNumber || !expiryDate || !cvv || !cardName) {
          return res.status(400).json({ error: 'Card details are required for card payments' });
        }
        if (cardNumber.replace(/\s/g, '').length < 13) {
          return res.status(400).json({ error: 'Invalid card number' });
        }
        paymentDetails = {
          cardLast4: cardNumber.slice(-4),
          cardType: getCardType(cardNumber),
          expiryDate: expiryDate,
          cardHolderName: cardName
        };
        break;

      case 'bitcoin':
      case 'ethereum':
      case 'litecoin':
      case 'dogecoin':
      case 'cardano':
      case 'solana':
        if (!walletAddress) {
          return res.status(400).json({ error: 'Wallet address is required for crypto payments' });
        }

        // Simulated USD->crypto conversion
        const cryptoRates = {
          bitcoin: 0.000024,
          ethereum: 0.0004,
          litecoin: 0.0135,
          dogecoin: 12.5,
          cardano: 2.0,
          solana: 0.01
        };
        const cryptoAmount = (paymentAmount * cryptoRates[paymentMethod]).toFixed(8);
        paymentDetails = {
          cryptoType: paymentMethod.toUpperCase(),
          cryptoAmount: cryptoAmount,
          walletAddress: walletAddress,
          exchangeRate: cryptoRates[paymentMethod],
          networkFee: calculateCryptoFee(paymentMethod),
          transactionHash: cryptoTxHash || null
        };
        break;

      default:
        return res.status(400).json({ error: 'Unsupported payment method' });
    }

    // Create comprehensive transaction record
    const transaction = {
      id: 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      amount: paymentAmount,
      description: description || 'Construction Service Payment',
      paymentMethod,
      customerInfo: {
        name: customerInfo.name || `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim(),
        email: customerInfo.email,
        phone: customerInfo.phone || 'Not provided',
        company: customerInfo.company || 'Individual',
        address: billingAddress || customerInfo.address || 'Not provided'
      },
      paymentDetails,
      status: 'processing',
      timestamp: new Date().toISOString(),
      processingFee: calculateProcessingFee(paymentMethod, paymentAmount),
      netAmount: paymentAmount - calculateProcessingFee(paymentMethod, paymentAmount),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    transactions.push(transaction);

    // >>> MongoDB: persist initial transaction
    if (process.env.MONGODB_URI && Transaction) {
      try {
        await Transaction.create({
          id: transaction.id,
          amount: transaction.amount,
          description: transaction.description,
          paymentMethod: transaction.paymentMethod,
          customerInfo: transaction.customerInfo,
          paymentDetails: transaction.paymentDetails,
          status: transaction.status,
          timestamp: new Date(transaction.timestamp),
          confirmationCode: null,
          processingFee: transaction.processingFee,
          netAmount: transaction.netAmount
        });
        console.log('🗄️ Transaction saved to MongoDB:', transaction.id);
      } catch (e) {
        console.error('❌ Failed to persist transaction to MongoDB:', e.message);
      }
    }
    // <<< MongoDB persist

    // Simulate realistic payment processing with different timing for different methods
    const processingTime = getProcessingTime(paymentMethod);

    setTimeout(async () => {
      const transactionIndex = transactions.findIndex(t => t.id === transaction.id);
      if (transactionIndex !== -1) {
        const successRate = getSuccessRate(paymentMethod);
        const isSuccess = Math.random() < successRate;

        transactions[transactionIndex].status = isSuccess ? 'completed' : 'failed';
        transactions[transactionIndex].processedAt = new Date().toISOString();

        if (isSuccess) {
          transactions[transactionIndex].confirmationCode = generateConfirmationCode(paymentMethod);
          if (isCryptoPayment(paymentMethod) && !cryptoTxHash) {
            transactions[transactionIndex].paymentDetails.transactionHash = generateCryptoTxHash(paymentMethod);
          }
          console.log(`✅ ${paymentMethod.toUpperCase()} payment completed:`, transaction.id);
          await sendPaymentConfirmationEmail(transactions[transactionIndex]);
        } else {
          const failureReason = getFailureReason(paymentMethod);
          transactions[transactionIndex].failureReason = failureReason;
          console.log(`❌ ${paymentMethod.toUpperCase()} payment failed:`, transaction.id, failureReason);
        }

        // >>> MongoDB: update transaction result
        if (process.env.MONGODB_URI && Transaction) {
          try {
            const updated = transactions[transactionIndex];
            await Transaction.findOneAndUpdate(
              { id: updated.id },
              {
                $set: {
                  status: updated.status,
                  processedAt: new Date(updated.processedAt),
                  confirmationCode: updated.confirmationCode || null,
                  failureReason: updated.failureReason || null,
                  paymentDetails: updated.paymentDetails
                }
              },
              { new: true }
            );
            console.log('🗄️ Transaction updated in MongoDB:', updated.id, updated.status);
          } catch (e) {
            console.error('❌ Failed to update transaction in MongoDB:', e.message);
          }
        }
        // <<< MongoDB update
      }
    }, processingTime);

    console.log(`💳 New ${paymentMethod.toUpperCase()} payment transaction created:`, transaction.id);
    res.json({
      success: true,
      message: `${paymentMethod.toUpperCase()} payment is being processed. You will receive a confirmation shortly.`,
      transactionId: transaction.id,
      estimatedProcessingTime: formatProcessingTime(processingTime),
      paymentDetails: isCryptoPayment(paymentMethod)
        ? {
            cryptoAmount: paymentDetails.cryptoAmount,
            cryptoType: paymentDetails.cryptoType,
            networkFee: paymentDetails.networkFee
          }
        : null
    });
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    res.status(500).json({ error: 'Payment processing failed. Please try again or contact support.' });
  }
});

// Helper functions for payment processing
function getCardType(cardNumber) {
  const firstDigit = cardNumber.charAt(0);
  const firstTwo = cardNumber.substr(0, 2);
  if (firstDigit === '4') return 'Visa';
  if (firstTwo >= '51' && firstTwo <= '55') return 'Mastercard';
  if (firstTwo === '34' || firstTwo === '37') return 'American Express';
  if (firstTwo === '60' || firstTwo === '65') return 'Discover';
  return 'Unknown';
}

function isCryptoPayment(method) {
  return ['bitcoin', 'ethereum', 'litecoin', 'dogecoin', 'cardano', 'solana'].includes(method);
}

function calculateProcessingFee(method, amount) {
  const fees = {
    card: amount * 0.029, // 2.9%
    'credit-card': amount * 0.029,
    'debit-card': amount * 0.025, // 2.5%
    bitcoin: amount * 0.005, // 0.5%
    ethereum: amount * 0.01, // 1.0%
    litecoin: amount * 0.005, // 0.5%
    dogecoin: amount * 0.005, // 0.5%
    cardano: amount * 0.005,
    solana: amount * 0.005
  };
  return Math.round((fees[method] || 0) * 100) / 100;
}

function calculateCryptoFee(cryptoType) {
  const networkFees = {
    bitcoin: 0.0001, // BTC
    ethereum: 0.001, // ETH
    litecoin: 0.001, // LTC
    dogecoin: 1.0, // DOGE
    cardano: 0.17, // ADA
    solana: 0.00025 // SOL
  };
  return networkFees[cryptoType] || 0;
}

function getProcessingTime(method) {
  const times = {
    card: 2000 + Math.random() * 3000, // 2-5 seconds
    'credit-card': 2000 + Math.random() * 3000,
    'debit-card': 1000 + Math.random() * 2000, // 1-3 seconds
    bitcoin: 10000 + Math.random() * 20000, // 10-30 seconds
    ethereum: 5000 + Math.random() * 10000, // 5-15 seconds
    litecoin: 3000 + Math.random() * 7000, // 3-10 seconds
    dogecoin: 1000 + Math.random() * 4000, // 1-5 seconds
    cardano: 2000 + Math.random() * 5000, // 2-7 seconds
    solana: 1000 + Math.random() * 2000, // 1-3 seconds
    paypal: 3000 + Math.random() * 5000, // 3-8 seconds
    'bank-transfer': 5000 + Math.random() * 10000, // 5-15 seconds
    'wire-transfer': 8000 + Math.random() * 12000, // 8-20 seconds
    check: 1000 + Math.random() * 2000 // 1-3 seconds
  };
  return times[method] || 3000;
}

function getSuccessRate(method) {
  const rates = {
    card: 0.85, // 85%
    'credit-card': 0.85,
    'debit-card': 0.9, // 90%
    bitcoin: 0.95, // 95%
    ethereum: 0.93, // 93%
    litecoin: 0.95, // 95%
    dogecoin: 0.97, // 97%
    cardano: 0.95, // 95%
    solana: 0.95 // 95%
  };
  return rates[method] || 0.85;
}

function generateConfirmationCode(method) {
  const prefix = isCryptoPayment(method) ? 'CRYPTO' : method.includes('card') ? 'CARD' : method.includes('transfer') ? 'XFER' : 'PAY';
  return prefix + '_' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function generateCryptoTxHash(cryptoType) {
  const prefixes = { bitcoin: '1', ethereum: '0x', litecoin: 'L', dogecoin: 'D', cardano: 'addr1', solana: '' };
  const prefix = prefixes[cryptoType] || '';
  const hash = Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);
  return prefix + hash;
}

function getFailureReason(method) {
  const reasons = {
    card: ['Insufficient funds', 'Card declined by issuer', 'Invalid card details', 'Card expired'],
    crypto: ['Network congestion', 'Insufficient gas fees', 'Invalid wallet address', 'Transaction timeout'],
    paypal: ['PayPal account suspended', 'Insufficient PayPal balance', 'Payment disputed'],
    bank: ['Account not found', 'Insufficient funds', 'Transfer limit exceeded'],
    check: ['Invalid check number', 'Account closed', 'Insufficient funds']
  };
  let categoryReasons;
  if (isCryptoPayment(method)) categoryReasons = reasons.crypto;
  else if (method.includes('card')) categoryReasons = reasons.card;
  else if (method.includes('paypal')) categoryReasons = reasons.paypal;
  else if (method.includes('transfer')) categoryReasons = reasons.bank;
  else if (method.includes('check')) categoryReasons = reasons.check;
  else categoryReasons = ['Payment processing error'];
  return categoryReasons[Math.floor(Math.random() * categoryReasons.length)];
}

function formatProcessingTime(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

async function sendPaymentConfirmationEmail(transaction) {
  try {
    const { customerInfo, paymentMethod, amount, id, confirmationCode, paymentDetails } = transaction;

    let paymentDetailsHtml = '';
    if (isCryptoPayment(paymentMethod)) {
      paymentDetailsHtml = `
        <p><strong>Crypto Amount:</strong> ${paymentDetails.cryptoAmount} ${paymentDetails.cryptoType}</p>
        <p><strong>Network Fee:</strong> ${paymentDetails.networkFee} ${paymentDetails.cryptoType}</p>
        <p><strong>Transaction Hash:</strong> ${paymentDetails.transactionHash}</p>
      `;
    } else if (paymentMethod.includes('card')) {
      paymentDetailsHtml = `<p><strong>Card:</strong> ${paymentDetails.cardType} ending in ${paymentDetails.cardLast4}</p>`;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">✅ Payment Confirmation</h2>
        <p>Dear ${customerInfo.name},</p>
        <p>Your ${paymentMethod.toUpperCase()} payment has been processed successfully!</p>
        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #27ae60; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details:</h3>
          <p><strong>Transaction ID:</strong> ${id}</p>
          <p><strong>Amount:</strong> $${amount.toLocaleString()}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod.toUpperCase()}</p>
          <p><strong>Confirmation Code:</strong> ${confirmationCode}</p>
          ${paymentDetailsHtml}
          <p><strong>Date:</strong> ${new Date(transaction.timestamp).toLocaleDateString()}</p>
        </div>
        <p>Thank you for your business with ${process.env.COMPANY_NAME || 'Trexo Engineering'}!</p>
        <p>Best regards,<br>${process.env.COMPANY_NAME || 'Trexo Engineering'} Team</p>
      </div>
    `;

    await sendEmail(customerInfo.email, `Payment Confirmation - ${id}`, `Your ${paymentMethod.toUpperCase()} payment of $${amount} has been processed successfully.`, emailHtml);
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

// ===================================================================
// ADMIN DASHBOARD ROUTES (DB-first, fallback memory)
// ===================================================================

// Get dashboard stats
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    if (process.env.MONGODB_URI && Transaction && Ticket) {
      const [totalTx, txCompleted, totalTickets, newTickets, recentTransactions, recentTickets] = await Promise.all([
        Transaction.countDocuments({}),
        Transaction.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
        Ticket.countDocuments({}),
        Ticket.countDocuments({ status: 'new' }),
        Transaction.find({}).sort({ timestamp: -1 }).limit(5).lean(),
        Ticket.find({}).sort({ timestamp: -1 }).limit(5).lean()
      ]);

      return res.json({
        totalTransactions: totalTx,
        totalTickets,
        newTickets,
        totalRevenue: txCompleted[0]?.sum || 0,
        recentTransactions,
        recentTickets
      });
    }

    // Fallback
    const stats = {
      totalTransactions: transactions.length,
      totalTickets: supportTickets.length,
      newTickets: supportTickets.filter(t => t.status === 'new').length,
      totalRevenue: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0),
      recentTransactions: transactions.slice(-5).reverse(),
      recentTickets: supportTickets.slice(-5).reverse()
    };
    res.json(stats);
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Get all tickets (MongoDB first, fall back to in-memory)
app.get('/api/admin/tickets', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1'), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20'), 1), 100);
    const skip = (page - 1) * limit;
    const status = (req.query.status || '').trim();

    if (process.env.MONGODB_URI && Ticket) {
      const query = {};
      if (status) query.status = status;

      const [items, total] = await Promise.all([
        Ticket.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        Ticket.countDocuments(query)
      ]);

      return res.json({
        tickets: items,
        pagination: { total, current: page, perPage: limit, pages: Math.max(Math.ceil(total / limit), 1) }
      });
    }

    // Fallback to in-memory
    let items = supportTickets.slice().reverse();
    if (status) items = items.filter(t => t.status === status);
    const total = items.length;
    items = items.slice(skip, skip + limit);

    return res.json({
      tickets: items,
      pagination: { total, current: page, perPage: limit, pages: Math.max(Math.ceil(total / limit), 1) }
    });
  } catch (error) {
    console.error('❌ Tickets loading error:', error);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

// Update ticket (DB + memory)
app.put('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { status, response } = req.body;

    // Memory update (for fallback)
    const ticket = supportTickets.find(t => t.id === ticketId);
    if (ticket) {
      if (status) ticket.status = status;
      if (response) {
        if (!ticket.responses) ticket.responses = [];
        ticket.responses.push({ message: response, timestamp: new Date().toISOString(), adminName: req.session.name });
      }
      ticket.updatedAt = new Date().toISOString();
    }

    // >>> MongoDB: update ticket
    if (process.env.MONGODB_URI && Ticket) {
      const updateDoc = {
        ...(status ? { status } : {}),
        ...(response ? { $push: { responses: { message: response, timestamp: new Date().toISOString(), adminName: req.session.name } } } : {})
      };

      // If using $push and $set together, combine carefully:
      if (updateDoc.$push) {
        await Ticket.updateOne({ id: ticketId }, { $set: { updatedAt: new Date() }, $push: updateDoc.$push });
        if (status) await Ticket.updateOne({ id: ticketId }, { $set: { status, updatedAt: new Date() } });
      } else {
        await Ticket.updateOne({ id: ticketId }, { $set: { status, updatedAt: new Date() } });
      }

      console.log('🗄️ Ticket updated in MongoDB:', ticketId);
      const updated = await Ticket.findOne({ id: ticketId }).lean();
      return res.json({ success: true, ticket: updated || ticket });
    }
    // <<< MongoDB update

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    return res.json({ success: true, ticket });
  } catch (error) {
    console.error('❌ Ticket update error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Get all transactions (MongoDB first, fall back to in-memory)
app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1'), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20'), 1), 100);
    const skip = (page - 1) * limit;

    if (process.env.MONGODB_URI && Transaction) {
      const [items, total] = await Promise.all([
        Transaction.find({}).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        Transaction.countDocuments({})
      ]);
      return res.json({
        transactions: items,
        pagination: { total, current: page, perPage: limit, pages: Math.max(Math.ceil(total / limit), 1) }
      });
    }

    // Fallback: in-memory array
    const total = transactions.length;
    const items = transactions.slice().reverse().slice(skip, skip + limit);
    return res.json({
      transactions: items,
      pagination: { total, current: page, perPage: limit, pages: Math.max(Math.ceil(total / limit), 1) }
    });
  } catch (error) {
    console.error('❌ Transactions loading error:', error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// Client dashboard data (simple memory mode; in DB mode you can adapt by user email if stored in session)
app.get('/api/client/dashboard', requireAuth, async (req, res) => {
  try {
    const userEmail = req.session.email; // note: not set currently; adapt if you store email in session
    const userTransactions = userEmail ? transactions.filter(t => t.customerInfo && t.customerInfo.email === userEmail) : [];
    const userTickets = userEmail ? supportTickets.filter(t => t.email === userEmail) : [];

    const stats = {
      totalTransactions: userTransactions.length,
      totalSpent: userTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0),
      activeTickets: userTickets.filter(t => t.status !== 'closed').length,
      lastPayment: userTransactions.length > 0 ? userTransactions[userTransactions.length - 1].timestamp : null
    };

    res.json({ stats, recentTransactions: userTransactions.slice(-5).reverse(), recentTickets: userTickets.slice(-3).reverse() });
  } catch (error) {
    console.error('❌ Client dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ===================================================================
// LANGUAGE AND TRANSLATION ROUTES
// ===================================================================
const translations = {
  en: {
    nav: { home: 'Home', about: 'About', services: 'Services', projects: 'Projects', contact: 'Contact', getQuote: 'Get Quote', login: 'Login' },
    hero: { title: 'Building Tomorrow, Today', subtitle: 'Premier construction and engineering solutions for residential, commercial, and industrial projects', cta: 'Get Free Quote', learn: 'Learn More' },
    about: { title: 'About Trexo Engineering', subtitle: '25+ years of excellence in construction', experience: 'Years Experience', projects: 'Projects Completed', clients: 'Happy Clients' },
    services: { title: 'Our Services', residential: 'Residential Construction', commercial: 'Commercial Projects', industrial: 'Industrial Solutions', renovation: 'Renovation & Remodeling' },
    contact: { title: 'Contact Us', name: 'Full Name', email: 'Email Address', phone: 'Phone Number', message: 'Message', send: 'Send Message' }
  },
  es: {
    nav: { home: 'Inicio', about: 'Acerca', services: 'Servicios', projects: 'Proyectos', contact: 'Contacto', getQuote: 'Cotizar', login: 'Iniciar Sesión' },
    hero: { title: 'Construyendo el Mañana, Hoy', subtitle: 'Soluciones de construcción e ingeniería de primera clase para proyectos residenciales, comerciales e industriales', cta: 'Cotización Gratis', learn: 'Saber Más' },
    about: { title: 'Acerca de Trexo Engineering', subtitle: 'Más de 25 años de excelencia en construcción', experience: 'Años de Experiencia', projects: 'Proyectos Completados', clients: 'Clientes Satisfechos' },
    services: { title: 'Nuestros Servicios', residential: 'Construcción Residencial', commercial: 'Proyectos Comerciales', industrial: 'Soluciones Industriales', renovation: 'Renovación y Remodelación' },
    contact: { title: 'Contáctanos', name: 'Nombre Completo', email: 'Correo Electrónico', phone: 'Número de Teléfono', message: 'Mensaje', send: 'Enviar Mensaje' }
  },
  fr: {
    nav: { home: 'Accueil', about: 'À Propos', services: 'Services', projects: 'Projets', contact: 'Contact', getQuote: 'Devis', login: 'Connexion' },
    hero: { title: "Construire Demain, Aujourd'hui", subtitle: "Solutions de construction et d'ingénierie de premier plan pour projets résidentiels, commerciaux et industriels", cta: 'Devis Gratuit', learn: 'En Savoir Plus' },
    about: { title: 'À Propos de Trexo Engineering', subtitle: 'Plus de 25 ans d\'excellence en construction', experience: "Années d'Expérience", projects: 'Projets Complétés', clients: 'Clients Satisfaits' },
    services: { title: 'Nos Services', residential: 'Construction Résidentielle', commercial: 'Projets Commerciaux', industrial: 'Solutions Industrielles', renovation: 'Rénovation et Remodelage' },
    contact: { title: 'Nous Contacter', name: 'Nom Complet', email: 'Adresse Email', phone: 'Numéro de Téléphone', message: 'Message', send: 'Envoyer le Message' }
  },
  de: {
    nav: { home: 'Startseite', about: 'Über Uns', services: 'Dienstleistungen', projects: 'Projekte', contact: 'Kontakt', getQuote: 'Angebot', login: 'Anmelden' },
    hero: { title: 'Die Zukunft Bauen, Heute', subtitle: 'Erstklassige Bau- und Ingenieurslösungen für Wohn-, Gewerbe- und Industrieprojekte', cta: 'Kostenloses Angebot', learn: 'Mehr Erfahren' },
    about: { title: 'Über Trexo Engineering', subtitle: 'Über 25 Jahre Exzellenz im Bauwesen', experience: 'Jahre Erfahrung', projects: 'Abgeschlossene Projekte', clients: 'Zufriedene Kunden' },
    services: { title: 'Unsere Dienstleistungen', residential: 'Wohnungsbau', commercial: 'Gewerbeprojekte', industrial: 'Industrielösungen', renovation: 'Renovierung & Umbau' },
    contact: { title: 'Kontaktieren Sie Uns', name: 'Vollständiger Name', email: 'E-Mail-Adresse', phone: 'Telefonnummer', message: 'Nachricht', send: 'Nachricht Senden' }
  }
};

// Get available languages
app.get('/api/languages', (req, res) => {
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' }
  ];

  res.json({ languages });
});

// Get translations for a specific language
app.get('/api/translations/:lang', (req, res) => {
  const language = req.params.lang;
  if (translations[language]) {
    res.json({ success: true, language, translations: translations[language] });
  } else {
    res.json({ success: true, language: 'en', translations: translations.en, message: 'Language not found, defaulting to English' });
  }
});

// Set user language preference
app.post('/api/language/set', (req, res) => {
  const { language } = req.body;
  if (!language) return res.status(400).json({ error: 'Language code is required' });

  if (req.session && req.session.userId) req.session.language = language;

  res.cookie('preferred_language', language, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false
  });

  res.json({ success: true, message: 'Language preference saved', language });
});

// ===================================================================
// STATIC FILE SERVING + INFO
// ===================================================================

// Serve static files from root directory
app.use(express.static(__dirname));

// Company info API endpoint
app.get('/api/company-info', (req, res) => {
  res.json({
    name: process.env.COMPANY_NAME || 'Trexo Engineering & Construction',
    email: process.env.COMPANY_EMAIL || 'info@trexo.com',
    phone: process.env.COMPANY_PHONE || '(555) 123-4567',
    address: process.env.COMPANY_ADDRESS || '123 Construction Ave, City, State 12345'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Route handlers
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Sign up page route
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    res.sendFile(path.join(__dirname, 'admin.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/dashboard', (req, res) => {
  if (req.session && req.session.userId && req.session.role === 'client') {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
  } else {
    res.redirect('/login');
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ===================================================================
// START SERVER + SHUTDOWN
// ===================================================================
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 TREXO ENGINEERING & CONSTRUCTION SERVER');
  console.log('='.repeat(60));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏠 Main Website: http://localhost:${PORT}`);
  console.log(`👤 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔐 Login Page: http://localhost:${PORT}/login`);
  console.log(`📊 Client Dashboard: http://localhost:${PORT}/dashboard`);
  console.log('='.repeat(60));
  console.log('🔐 Default Admin Credentials:');
  console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@trexo.com'}`);
  console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log('='.repeat(60));
  console.log(`📁 Upload directory: ${uploadPath}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email configured: ${process.env.EMAIL_USER ? 'Yes' : 'No (demo mode)'}`);
  console.log('='.repeat(60));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
