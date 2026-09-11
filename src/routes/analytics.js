const router = require('express').Router();
const analytics = require('../repositories/analytics');
const usersRepo = require('../repositories/users');

router.get('/', async (req, res, next) => {
  try {
    const [byCategory, top, noReg, aboveAvg, tags, byMonth] = await Promise.all([
      analytics.registrationsByCategory(),
      analytics.topEvents(5),
      usersRepo.usersWithNoRegistration(),
      analytics.eventsAboveAverageOccupancy(),
      analytics.mostUsedTags(),
      analytics.eventsByMonth()
    ]);
    const overallAvg = aboveAvg[0] ? aboveAvg[0].overallAverage : 0;
    res.render('analytics', {
      title: 'Analytics',
      byCategory, top, noReg, aboveAvg, tags, byMonth, overallAvg
    });
  } catch (e) { next(e); }
});

module.exports = router;
