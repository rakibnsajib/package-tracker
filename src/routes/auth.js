const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { signToken, findOrCreateUser, createAuthUser, verifyCredentials, issueAdminToken, authMiddleware, requireAdmin } = require('../auth');
const { db } = require('../db');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = 'avatar_' + Date.now() + '_' + Math.random().toString(36).slice(2) + ext;
    cb(null, name);
  },
});
const upload = multer({ storage });

// Simulated OAuth login: accepts { provider, code, name }
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if ((username || email) && password) {
      const user = await verifyCredentials(username || email, password);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken(user);
      return res.json({ token, user });
    }
    // Fallback: simulated OAuth login used earlier
    const { provider = 'mock', code = 'mock', name = 'demo-user' } = req.body || {};
    if (!provider || !code) return res.status(400).json({ error: 'Missing credentials' });
    const user = await findOrCreateUser(name);
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Signup with optional avatar upload
router.post('/signup', upload.single('avatar'), async (req, res) => {
  try {
    const { firstName = '', lastName = '', username, email, password } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });
    const avatarRel = req.file ? `/uploads/${req.file.filename}` : null;
    const user = await createAuthUser({ firstName, lastName, username, email, password, avatar: avatarRel });
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'username or email already exists' });
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/admin-token', (req, res) => {
  const providedSecret = (req.body && req.body.adminSecret) || req.headers['x-admin-secret'];
  const result = issueAdminToken(providedSecret);
  if (!result) return res.status(403).json({ error: 'Invalid admin secret' });
  res.json(result);
});

router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: req.user });
});

// Admin: delete a user (and related data)
router.delete('/users/:id', authMiddleware, requireAdmin, (req, res) => {
  const userId = req.params.id;

  db.serialize(() => {
    db.run('DELETE FROM analytics WHERE userId = ?', [userId]);
    db.run('UPDATE packages SET ownerUserId = NULL WHERE ownerUserId = ?', [userId]);
    db.run('DELETE FROM auth_users WHERE id = ?', [userId], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to delete auth user' });
      const removedAuth = this.changes;
      db.run('DELETE FROM users WHERE id = ?', [userId], function (err2) {
        if (err2) return res.status(500).json({ error: 'Failed to delete user record' });
        const removedUsers = this.changes;
        if (!removedAuth && !removedUsers) return res.status(404).json({ error: 'User not found' });
        res.json({ ok: true, removedAuthUsers: removedAuth, removedUsers });
      });
    });
  });
});

module.exports = router;
