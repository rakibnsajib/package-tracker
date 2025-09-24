const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');

const db = new sqlite3.Database(DB_PATH);

function ensurePackagesOwnerColumn() {
  db.all('PRAGMA table_info(packages)', (err, rows) => {
    if (!err && Array.isArray(rows)) {
      const hasOwner = rows.some(r => r.name === 'ownerUserId');
      if (!hasOwner) {
        db.run('ALTER TABLE packages ADD COLUMN ownerUserId TEXT');
      }
    }
  });
}

function ensureAuthUsersRoleColumn(callback) {
  db.all('PRAGMA table_info(auth_users)', (err, rows) => {
    if (err) {
      if (typeof callback === 'function') callback(err);
      return;
    }
    const hasRole = Array.isArray(rows) && rows.some(r => r.name === 'role');
    if (hasRole) {
      if (typeof callback === 'function') callback(null);
      return;
    }
    db.run("ALTER TABLE auth_users ADD COLUMN role TEXT DEFAULT 'user'", (alterErr) => {
      if (typeof callback === 'function') callback(alterErr || null);
    });
  });
}

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`);

    // Credentials-based users (for signup/login)
    db.run(`CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      firstName TEXT,
      lastName TEXT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      passwordHash TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS packages (
      trackingNumber TEXT PRIMARY KEY,
      carrier TEXT,
      status TEXT,
      lastLocationLat REAL,
      lastLocationLng REAL,
      lastUpdated INTEGER,
      ownerUserId TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      userId TEXT
    )`);

    ensurePackagesOwnerColumn();
    ensureAuthUsersRoleColumn();
  });
}

function initAsync() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        firstName TEXT,
        lastName TEXT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        passwordHash TEXT,
        avatar TEXT,
        role TEXT DEFAULT 'user'
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS packages (
        trackingNumber TEXT PRIMARY KEY,
        carrier TEXT,
        status TEXT,
        lastLocationLat REAL,
        lastLocationLng REAL,
        lastUpdated INTEGER,
        ownerUserId TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        userId TEXT
      )`, (err) => {
        if (err) return reject(err);

        ensureAuthUsersRoleColumn((roleErr) => {
          if (roleErr) return reject(roleErr);

          db.all('PRAGMA table_info(packages)', (e, rows) => {
            if (e) return reject(e);
            const hasOwner = Array.isArray(rows) && rows.some(r => r.name === 'ownerUserId');
            if (hasOwner) return resolve();
            db.run('ALTER TABLE packages ADD COLUMN ownerUserId TEXT', (e2) => {
              if (e2) return reject(e2);
              resolve();
            });
          });
        });
      });
    });
  });
}

function seed() {
  const now = Date.now();
  // Demo packages using Bangladeshi locations and local carriers
  const pkgs = [
    ['PKG12345678', 'Sundarban Courier Service', 'In Transit', 23.8103, 90.4125, now - 3600_000], // Dhaka
    ['PKG87654321', 'SteadFast', 'Out for Delivery', 22.3569, 91.7832, now - 600_000], // Chattogram
    ['PKG11112222', 'RedX', 'Delivered', 24.8949, 91.8687, now - 86_400_000], // Sylhet
  ];
  db.serialize(() => {
    const stmt = db.prepare(`INSERT OR REPLACE INTO packages 
      (trackingNumber, carrier, status, lastLocationLat, lastLocationLng, lastUpdated, ownerUserId)
      VALUES (?, ?, ?, ?, ?, ?, NULL)`);
    pkgs.forEach(p => stmt.run(p));
    stmt.finalize();
  });
}

module.exports = { db, init, initAsync, seed };
