const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '2h';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';

function signToken(user) {
  const payload = {
    sub: user.id,
    name: user.name,
    avatar: user.avatar || null,
    role: user.role || 'user',
  };
  if (user.username) payload.username = user.username;
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      name: payload.name,
      avatar: payload.avatar || null,
      role: payload.role || 'user',
      username: payload.username || null,
    };
  } catch (_) {
    // ignore invalid token, treat as unauthenticated
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function findOrCreateUser(name) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE name = ?', [name], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve({ ...row, role: 'user', avatar: row.avatar || null });
      const user = { id: uuidv4(), name, role: 'user', avatar: null };
      db.run('INSERT INTO users (id, name) VALUES (?, ?)', [user.id, user.name], (e) => {
        if (e) return reject(e);
        resolve(user);
      });
    });
  });
}

async function createAuthUser({ firstName, lastName, username, email, password, avatar }) {
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || username;
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO auth_users (id, firstName, lastName, username, email, passwordHash, avatar, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, firstName || null, lastName || null, username, email, passwordHash, avatar || null, 'user'],
      (err) => {
        if (err) return reject(err);
        // Mirror into users for display convenience
        db.run('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)', [id, name], (e2) => {
          if (e2) return reject(e2);
          resolve({ id, name, avatar: avatar || null, username, email, role: 'user' });
        });
      }
    );
  });
}

async function verifyCredentials(usernameOrEmail, password) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM auth_users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail],
      async (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        const ok = await bcrypt.compare(password, row.passwordHash || '');
        if (!ok) return resolve(null);
        const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.username;
        resolve({
          id: row.id,
          name,
          avatar: row.avatar || null,
          username: row.username,
          email: row.email,
          role: row.role || 'user',
        });
      }
    );
  });
}

function issueAdminToken(providedSecret) {
  if (!providedSecret || providedSecret !== ADMIN_SECRET) {
    return null;
  }
  const adminUser = {
    id: 'admin',
    name: 'Admin',
    avatar: null,
    role: 'admin',
    username: 'admin',
  };
  const token = signToken(adminUser);
  return { token, user: adminUser };
}

module.exports = {
  signToken,
  authMiddleware,
  requireAuth,
  requireAdmin,
  findOrCreateUser,
  createAuthUser,
  verifyCredentials,
  issueAdminToken,
};
