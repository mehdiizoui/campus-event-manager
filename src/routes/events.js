const router = require('express').Router();
const eventsRepo = require('../repositories/events');
const usersRepo = require('../repositories/users');
const { getDb } = require('../db');

// List + filters
router.get('/', async (req, res, next) => {
  try {
    const { q, category, when, tag, sort } = req.query;
    const [events, categories, tags] = await Promise.all([
      eventsRepo.findAll({ q, category, when, tag, sort }),
      eventsRepo.distinctCategories(),
      eventsRepo.distinctTags()
    ]);
    res.render('events/list', {
      title: 'Events', events, categories, tags,
      filters: { q: q || '', category: category || '', when: when || '', tag: tag || '', sort: sort || 'asc' },
      confirmedCount: eventsRepo.confirmedCount
    });
  } catch (e) { next(e); }
});

// New event form
router.get('/new', async (req, res, next) => {
  try {
    const users = await usersRepo.findAll();
    res.render('events/form', { title: 'Nouvel event', event: null, users, error: null });
  } catch (e) { next(e); }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const id = await eventsRepo.create(req.body);
    res.redirect(`/events/${id}`);
  } catch (e) {
    const users = await usersRepo.findAll();
    res.status(e.status || 500).render('events/form', { title: 'Nouvel event', event: req.body, users, error: e.message });
  }
});

// Detail
router.get('/:id', async (req, res, next) => {
  try {
    const event = await eventsRepo.findById(req.params.id);
    if (!event) return res.status(404).render('error', { title:'404', message:'Event introuvable' });
    const organizer = await usersRepo.findById(event.organizerId);
    // Get participants (embedded userIds resolved through the users collection)
    const participantIds = event.registrations.map(r => r.userId);
    const users = await getDb().collection('users').find({ _id: { $in: participantIds } }).toArray();
    const usersById = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const allUsers = await usersRepo.findAll();
    const confirmed = eventsRepo.confirmedCount(event);
    const occupancy = event.capacity ? Math.round((confirmed / event.capacity) * 100) : 0;
    res.render('events/detail', {
      title: event.title,
      event, organizer, usersById, allUsers, confirmed, occupancy
    });
  } catch (e) { next(e); }
});

// Edit form
router.get('/:id/edit', async (req, res, next) => {
  try {
    const event = await eventsRepo.findById(req.params.id);
    if (!event) return res.status(404).render('error', { title:'404', message:'Event introuvable' });
    const users = await usersRepo.findAll();
    res.render('events/form', { title: 'Modifier event', event, users, error: null });
  } catch (e) { next(e); }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    await eventsRepo.update(req.params.id, req.body);
    res.redirect(`/events/${req.params.id}`);
  } catch (e) {
    const event = await eventsRepo.findById(req.params.id);
    const users = await usersRepo.findAll();
    res.status(e.status || 500).render('events/form', { title: 'Modifier event', event: { ...event, ...req.body }, users, error: e.message });
  }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    await eventsRepo.remove(req.params.id);
    res.redirect('/events');
  } catch (e) { next(e); }
});

// Registrations
router.post('/:id/registrations', async (req, res, next) => {
  try {
    await eventsRepo.registerUser(req.params.id, req.body.userId);
    res.redirect(`/events/${req.params.id}`);
  } catch (e) {
    res.status(e.status || 500).render('error', { title: 'Erreur inscription', message: e.message, backTo: `/events/${req.params.id}` });
  }
});

router.post('/:id/registrations/:userId/cancel', async (req, res, next) => {
  try {
    await eventsRepo.cancelRegistration(req.params.id, req.params.userId);
    res.redirect(`/events/${req.params.id}`);
  } catch (e) { next(e); }
});

router.delete('/:id/registrations/:userId', async (req, res, next) => {
  try {
    await eventsRepo.removeRegistration(req.params.id, req.params.userId);
    res.redirect(`/events/${req.params.id}`);
  } catch (e) { next(e); }
});

module.exports = router;
