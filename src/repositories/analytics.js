/**
 * Analytics repository — advanced aggregation pipelines (Analyses A..F).
 * Every function here returns tabular data for the Analytics page.
 */
const { getDb } = require('../db');

const events = () => getDb().collection('events');

// A: Registrations by category
async function registrationsByCategory() {
  return events().aggregate([
    { $project: {
        category: 1,
        confirmed: {
          $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status','confirmed'] } } }
        }
    }},
    { $group: {
        _id: '$category',
        eventCount: { $sum: 1 },
        totalConfirmed: { $sum: '$confirmed' }
    }},
    { $sort: { totalConfirmed: -1 } },
    { $project: { _id: 0, category: '$_id', eventCount: 1, totalConfirmed: 1 } }
  ]).toArray();
}

// B: Top 5 most popular events
async function topEvents(limit = 5) {
  return events().aggregate([
    { $project: {
        title: 1, category: 1, capacity: 1,
        confirmed: {
          $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status','confirmed'] } } }
        }
    }},
    { $addFields: {
        occupancy: {
          $cond: [{ $gt: ['$capacity', 0] },
            { $multiply: [{ $divide: ['$confirmed', '$capacity'] }, 100] },
            0]
        }
    }},
    { $sort: { confirmed: -1 } },
    { $limit: limit }
  ]).toArray();
}

// D: Events with occupancy above the overall average
async function eventsAboveAverageOccupancy() {
  return events().aggregate([
    { $project: {
        title: 1, category: 1, capacity: 1, startDate: 1,
        confirmed: {
          $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status','confirmed'] } } }
        }
    }},
    { $addFields: {
        occupancy: {
          $cond: [{ $gt: ['$capacity', 0] },
            { $multiply: [{ $divide: ['$confirmed', '$capacity'] }, 100] },
            0]
        }
    }},
    { $group: {
        _id: null,
        avg: { $avg: '$occupancy' },
        items: { $push: '$$ROOT' }
    }},
    { $unwind: '$items' },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$items', { overallAverage: '$avg' }] } } },
    { $match: { $expr: { $gt: ['$occupancy', '$overallAverage'] } } },
    { $sort: { occupancy: -1 } }
  ]).toArray();
}

// E: Most used tags
async function mostUsedTags() {
  return events().aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, tag: '$_id', count: 1 } }
  ]).toArray();
}

// F: Events grouped by month
async function eventsByMonth() {
  return events().aggregate([
    { $project: {
        year:  { $year:  '$startDate' },
        month: { $month: '$startDate' },
        confirmed: {
          $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status','confirmed'] } } }
        }
    }},
    { $group: {
        _id: { year: '$year', month: '$month' },
        eventCount: { $sum: 1 },
        totalConfirmed: { $sum: '$confirmed' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $project: {
        _id: 0,
        year: '$_id.year',
        month: '$_id.month',
        eventCount: 1,
        totalConfirmed: 1
    }}
  ]).toArray();
}

module.exports = {
  registrationsByCategory,
  topEvents,
  eventsAboveAverageOccupancy,
  mostUsedTags,
  eventsByMonth
};
