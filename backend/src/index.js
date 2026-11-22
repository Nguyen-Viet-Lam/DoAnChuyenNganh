require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const genreRoutes = require('./routes/genres');
const novelRoutes = require('./routes/novels');
const chapterRoutes = require('./routes/chapters');
const aiRoutes = require('./routes/ai');
const translationRoutes = require('./routes/translation');
const glossaryRoutes = require('./routes/glossary');
const editorRoutes = require('./routes/editor');
const qaRoutes = require('./routes/qa');
const prisma = require('./prismaClient');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin không được CORS cho phép'));
  },
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/genres', genreRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api', chapterRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', translationRoutes);
app.use('/api', glossaryRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/editor', qaRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NovelVerse AI Backend API is running' });
});

app.get('/api/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ready', database: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  return res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống' });
});

const PORT = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET chưa được cấu hình');
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET production phải có ít nhất 32 ký tự');
}
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});
