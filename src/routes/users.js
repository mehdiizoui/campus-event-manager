const router = require('express').Router();
const usersRepo = require('../repositories/users');
const eventsRepo = require('../repositories/events');

router.get('/', async (req, res, next) => {
  try {
    const { q, department, role } = req.query;
    const [users, departments, roles] = await Promise.all([
      usersRepo.findAll({ q, department, role }),
      usersRepo.distinctDepartments(),
      usersRepo.distinctRoles()
    ]);
    res.render('users/list', {
      title: 'Users', users, departments, roles,
      filters: { q: q || '', department: department || '', role: role || '' }
    });
  } catch (e) { next(e); }
});

router.get('/new', (req, res) => {
  res.render('users/form', { title: 'Nouvel utilisateur', user: null, error: null });
});

router.post('/', async (req, res) => {
  try {
    const id = await usersRepo.create(req.body);
    res.redirect(`/users/${id}`);
  } catch (e) {
    res.status(e.status || 500).render('users/form', { title: 'Nouvel utilisateur', user: req.body, error: e.message });
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await usersRepo.findById(req.params.id);
    if (!user) return res.status(404).render('error', { title:'404', message:'Utilisateur introuvable' });

    const events = await eventsRepo.findEventsRegisteredBy(user._id);
    const now = new Date();
    const upcoming = events.filter(e => e.startDate >= now).length;
    const past = events.filter(e => e.startDate < now).length;

    res.render('users/detail', { title: `${user.firstName} ${user.lastName}`, user, events, upcoming, past });
  } catch (e) { next(e); }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const user = await usersRepo.findById(req.params.id);
    if (!user) return res.status(404).render('error', { title:'404', message:'Utilisateur introuvable' });
    res.render('users/form', { title: 'Modifier utilisateur', user, error: null });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res) => {
  try {
    await usersRepo.update(req.params.id, req.body);
    res.redirect(`/users/${req.params.id}`);
  } catch (e) {
    const user = await usersRepo.findById(req.params.id).catch(() => null);
    res.status(e.status || 500).render('users/form', { title: 'Modifier utilisateur', user: { ...user, ...req.body }, error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await usersRepo.remove(req.params.id);
    res.redirect('/users');
  } catch (e) {
    res.status(e.status || 500).render('error', { title: 'Suppression impossible', message: e.message, backTo: `/users/${req.params.id}` });
  }
});

module.exports = router;
