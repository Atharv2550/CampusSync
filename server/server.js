import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { initNotificationSocket } from './services/notificationService.js';
import { verifyToken } from './utils/jwt.js';
import { runAttendanceMigration } from './scripts/migrateAttendanceStatus.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import lostFoundRoutes from './routes/lostFoundRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import tutorRoutes from './routes/tutorRoutes.js';
import clubRoutes from './routes/clubRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import volunteeringRoutes from './routes/volunteeringRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import timetableRoutes from './routes/timetableRoutes.js';
import subjectClassRoutes from './routes/subjectClassRoutes.js';
import dutyRoutes from './routes/dutyRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import facultySupervisionRoutes from './routes/facultySupervisionRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize socket for real-time notifications
initNotificationSocket(io);

// Authenticate socket connections and join user-scoped rooms
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      return next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
  }

  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {});
});

// Security & Parsing Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    platform: 'CampusSync API',
    tagline: 'One Campus. Everything in Sync.',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/volunteering', volunteeringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api', subjectClassRoutes);
app.use('/api/duties', dutyRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/faculty', facultySupervisionRoutes);

// Optional SPA Production static serve & nested route fallback
const clientDistPath = path.resolve(__dirname, '../client/dist');
import fs from 'fs';
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const validateEnvironment = () => {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('[CampusSync Security Warning]: JWT_SECRET is not configured for production!');
  }
};

if (process.env.NODE_ENV !== 'test') {
  validateEnvironment();
  connectDB().then(() => {
    runAttendanceMigration().catch((err) => console.error('[Startup Migration Error]:', err));
    server.listen(PORT, () => {
      console.log(`[CampusSync Server] Running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
    });
  });
}

export { app, server, io };
