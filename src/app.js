const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
require('dotenv').config();

const { connect } = require('./db');
const dashboardRouter = require('./routes/dashboard');
const eventsRouter = require('./routes/events');
const usersRouter = require('./routes/users');
const analyticsRouter = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use((req, res, next) => { res.locals.currentPath = req.path; next(); });

app.use('/', dashboardRouter);
app.use('/events', eventsRouter);
app.use('/users', usersRouter);
app.use('/analytics', analyticsRouter);

app.use((req, res) => res.status(404).render('error', { title: 'Not Found', message: 'Page introuvable.' }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).render('error', {
    title: 'Erreur',
    message: err.message || 'Erreur interne'
  });
});

(async () => {
  await connect();
  app.listen(PORT, () => console.log(`[app] listening on http://localhost:${PORT}`));
})();
