require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { json, urlencoded } = require('express');
const { authMiddleware } = require('./auth');
const { initAsync, seed, db } = require('./db');
const trackingRoutes = require('./routes/tracking');
const authRoutes = require('./routes/auth');
const { buildSchema } = require('./graphql');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServer } = require('@apollo/server');

const PORT = process.env.PORT || 3000;

// Initialize DB (with migration) then seed
initAsync().then(() => seed()).catch((e) => {
  console.error('DB init failed:', e);
});

const app = express();

// Security & utility middleware
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(morgan('dev'));
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(authMiddleware);

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use('/api', apiLimiter);
app.use('/graphql', apiLimiter);

// Analytics logging (simple)
app.use((req, res, next) => {
  res.on('finish', () => {
    const userId = req.user ? req.user.id : null;
    db.run('INSERT INTO analytics (ts, method, path, userId) VALUES (?, ?, ?, ?)', [Date.now(), req.method, req.path, userId]);
  });
  next();
});

// REST routes
app.use('/api', trackingRoutes);
app.use('/auth', authRoutes);

// Static frontend
app.use(express.static('public'));

// GraphQL setup
async function startGraphQL() {
  const schema = buildSchema();
  const server = new ApolloServer({ schema });
  await server.start();
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({ user: req.user || null })
  }));
}

startGraphQL().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});

