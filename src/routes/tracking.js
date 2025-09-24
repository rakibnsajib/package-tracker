const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { trackingParam, trackingBody, ownerUserIdOptional, ownerUserIdRequired, validate } = require('../validators');

function ensureOwnerExists(ownerUserId, callback) {
  if (!ownerUserId) return callback(null, false);
  db.get('SELECT id FROM auth_users WHERE id = ?', [ownerUserId], (authErr, authRow) => {
    if (authErr) return callback(authErr);
    if (authRow) return callback(null, true);
    db.get('SELECT id FROM users WHERE id = ?', [ownerUserId], (userErr, userRow) => {
      if (userErr) return callback(userErr);
      callback(null, !!userRow);
    });
  });
}

// GET status by tracking number
router.get('/track/:trackingNumber', trackingParam(), validate, (req, res) => {
  const tn = req.params.trackingNumber;
  db.get('SELECT * FROM packages WHERE trackingNumber = ?', [tn], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

// Create a package
router.post('/track', requireAuth, trackingBody(), ownerUserIdOptional(), validate, (req, res) => {
  const { trackingNumber, carrier = 'Unknown', status = 'Created', lastLocationLat = null, lastLocationLng = null, ownerUserId: requestedOwnerId } = req.body;
  const now = Date.now();
  const isAdmin = req.user && req.user.role === 'admin';

  const insertPackage = (ownerUserId) => {
    const params = [trackingNumber, carrier, status, lastLocationLat, lastLocationLng, now, ownerUserId || null];
    db.run(
      `INSERT INTO packages (trackingNumber, carrier, status, lastLocationLat, lastLocationLng, lastUpdated, ownerUserId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params,
      function (err) {
        if (err) return res.status(400).json({ error: 'Insert failed' });
        db.get('SELECT * FROM packages WHERE trackingNumber = ?', [trackingNumber], (e, row) => {
          if (e) return res.status(500).json({ error: 'DB error' });
          res.status(201).json(row);
        });
      }
    );
  };

  if (isAdmin) {
    if (!requestedOwnerId) {
      return res.status(400).json({ error: 'ownerUserId required for admin-created packages' });
    }
    return ensureOwnerExists(requestedOwnerId, (err, exists) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!exists) return res.status(404).json({ error: 'ownerUserId not found' });
      insertPackage(requestedOwnerId);
    });
  }

  const ownerUserId = req.user ? req.user.id : null;
  insertPackage(ownerUserId);
});

// Update a package
router.put('/track/:trackingNumber', requireAuth, trackingParam(), validate, (req, res) => {
  const tn = req.params.trackingNumber;
  const { carrier, status, lastLocationLat, lastLocationLng } = req.body;
  const now = Date.now();
  db.run(
    `UPDATE packages SET 
      carrier = COALESCE(?, carrier),
      status = COALESCE(?, status),
      lastLocationLat = COALESCE(?, lastLocationLat),
      lastLocationLng = COALESCE(?, lastLocationLng),
      lastUpdated = ?
     WHERE trackingNumber = ?`,
    [carrier, status, lastLocationLat, lastLocationLng, now, tn],
    function (err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      db.get('SELECT * FROM packages WHERE trackingNumber = ?', [tn], (e, row) => {
        if (e) return res.status(500).json({ error: 'DB error' });
        res.json(row);
      });
    }
  );
});

// Admin: assign or clear owner
router.patch('/track/:trackingNumber/owner', requireAuth, requireAdmin, trackingParam(), validate, (req, res) => {
  const tn = req.params.trackingNumber;
  const { ownerUserId = null } = req.body || {};

  const updateOwner = (value) => {
    db.run('UPDATE packages SET ownerUserId = ? WHERE trackingNumber = ?', [value, tn], function (err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      if (this.changes === 0) return res.status(404).json({ error: 'Package not found' });
      db.get('SELECT * FROM packages WHERE trackingNumber = ?', [tn], (fetchErr, row) => {
        if (fetchErr) return res.status(500).json({ error: 'DB error' });
        res.json(row);
      });
    });
  };

  if (ownerUserId === null) {
    return updateOwner(null);
  }

  ensureOwnerExists(ownerUserId, (err, exists) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!exists) return res.status(404).json({ error: 'ownerUserId not found' });
    updateOwner(ownerUserId);
  });
});

// Delete a package
router.delete('/track/:trackingNumber', requireAuth, trackingParam(), validate, (req, res) => {
  const tn = req.params.trackingNumber;
  db.run('DELETE FROM packages WHERE trackingNumber = ?', [tn], function (err) {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });
});

// List packages for current user
router.get('/my-packages', requireAuth, (req, res) => {
  const uid = req.user.id;
  db.all('SELECT * FROM packages WHERE ownerUserId = ? ORDER BY lastUpdated DESC', [uid], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Dev helper: create demo packages for a given username
router.post('/dev/create-demo-packages', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });
  db.get('SELECT id FROM auth_users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(404).json({ error: 'user not found' });
    const now = Date.now();
    const rows = [
      ['BDDEMO001', 'Sundarban Courier Service', 'In Transit', 23.8103, 90.4125, now - 30 * 60 * 1000, user.id],
      ['BDDEMO002', 'SteadFast', 'Out for Delivery', 22.3569, 91.7832, now - 10 * 60 * 1000, user.id],
      ['BDDEMO003', 'RedX', 'At Facility', 24.3636, 88.6241, now - 3 * 60 * 60 * 1000, user.id],
    ];
    const stmt = db.prepare(`INSERT OR IGNORE INTO packages
      (trackingNumber, carrier, status, lastLocationLat, lastLocationLng, lastUpdated, ownerUserId)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    rows.forEach(r => stmt.run(r));
    stmt.finalize((e) => {
      if (e) return res.status(500).json({ error: 'Insert failed' });
      res.json({ ok: true, created: rows.map(r => r[0]) });
    });
  });
});

module.exports = router;
