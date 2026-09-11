const router = require('express').Router();
const eventsRepo = require('../repositories/events');
const usersRepo = require('../repositories/users');

router.get('/', async (req, res, next) => {
  try {
    const [usersCount, eventsCount, upcomingCount, totalConfirmed, next5, top] = await Promise.all([
      usersRepo.countAll(),
      eventsRepo.countAll(),
      eventsRepo.countUpcoming(),
      eventsRepo.totalConfirmedRegistrations(),
      eventsRepo.nextUpcoming(5),
      eventsRepo.mostPopularEvent()
    ]);

    res.render('dashboard', {
      title: 'Dashboard',
      stats: { usersCount, eventsCount, upcomingCount, totalConfirmed },
      next5, top
    });
  } catch (e) { next(e); }
});

module.exports = router;
