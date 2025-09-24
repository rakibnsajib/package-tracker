const { db } = require('./db');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const typeDefs = `#graphql
  type Package {
    trackingNumber: ID!
    carrier: String
    status: String
    lastLocationLat: Float
    lastLocationLng: Float
    lastUpdated: String
  }

  type Query {
    package(trackingNumber: ID!): Package
    packages: [Package!]!
  }

  type Mutation {
    createPackage(trackingNumber: ID!, carrier: String, status: String, lastLocationLat: Float, lastLocationLng: Float): Package
    updateStatus(trackingNumber: ID!, status: String!, lastLocationLat: Float, lastLocationLng: Float): Package
    deletePackage(trackingNumber: ID!): Boolean!
  }
`;

const resolvers = {
  Query: {
    package: async (_, { trackingNumber }) =>
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM packages WHERE trackingNumber = ?', [trackingNumber], (e, row) => {
          if (e) return reject(e);
          resolve(row || null);
        });
      }),
    packages: async () =>
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM packages', [], (e, rows) => {
          if (e) return reject(e);
          resolve(rows || []);
        });
      }),
  },
  Mutation: {
    createPackage: async (_, args, ctx) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const now = Date.now();
      const { trackingNumber, carrier = 'Unknown', status = 'Created', lastLocationLat = null, lastLocationLng = null } = args;
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO packages (trackingNumber, carrier, status, lastLocationLat, lastLocationLng, lastUpdated)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [trackingNumber, carrier, status, lastLocationLat, lastLocationLng, now],
          function (err) {
            if (err) return reject(err);
            db.get('SELECT * FROM packages WHERE trackingNumber = ?', [trackingNumber], (e, row) => {
              if (e) return reject(e);
              resolve(row);
            });
          }
        );
      });
    },
    updateStatus: async (_, { trackingNumber, status, lastLocationLat = null, lastLocationLng = null }, ctx) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const now = Date.now();
      return new Promise((resolve, reject) => {
        db.run(
          `UPDATE packages SET status = ?, lastLocationLat = COALESCE(?, lastLocationLat), lastLocationLng = COALESCE(?, lastLocationLng), lastUpdated = ? WHERE trackingNumber = ?`,
          [status, lastLocationLat, lastLocationLng, now, trackingNumber],
          function (err) {
            if (err) return reject(err);
            if (this.changes === 0) return resolve(null);
            db.get('SELECT * FROM packages WHERE trackingNumber = ?', [trackingNumber], (e, row) => {
              if (e) return reject(e);
              resolve(row);
            });
          }
        );
      });
    },
    deletePackage: async (_, { trackingNumber }, ctx) => {
      if (!ctx.user) throw new Error('Unauthorized');
      return new Promise((resolve, reject) => {
        db.run('DELETE FROM packages WHERE trackingNumber = ?', [trackingNumber], function (err) {
          if (err) return reject(err);
          resolve(this.changes > 0);
        });
      });
    },
  },
};

function buildSchema() {
  return makeExecutableSchema({ typeDefs, resolvers });
}

module.exports = { buildSchema };

