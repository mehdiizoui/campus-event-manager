/**
 * Events repository — all MongoDB operations for the events collection.
 * Queries and pipelines are grouped here so a reviewer can find them easily.
 */
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const col = () => getDb().collection('events');

function toObjectId(id) {
  if (!ObjectId.isValid(id)) throw Object.assign(new Error('Malformed identifier'), { status: 400 });
  return new ObjectId(id);
}

function confirmedCount(event) {
  return (event.registrations || []).filter(r => r.status === 'confirmed').length;
}

// -------- READ --------
async function findAll({ q, category, when, tag, sort } = {}) {
  const filter = {};
  if (q)        filter.title = { $regex: q, $options: 'i' };
  if (category) filter.category = category;
  if (tag)      filter.tags = tag;
  if (when === 'upcoming') filter.startDate = { $gte: new Date() };
  if (when === 'past')     filter.startDate = { $lt: new Date() };

  const sortSpec = sort === 'desc' ? { startDate: -1 } : { startDate: 1 };

  return col().find(filter, {
    projection: { title:1, category:1, tags:1, startDate:1, endDate:1, capacity:1, location:1, registrations:1 }
  }).sort(sortSpec).toArray();
}

async function findById(id) {
  return col().findOne({ _id: toObjectId(id) });
}

async function distinctCategories() { return col().distinct('category'); }
async function distinctTags()       { return col().distinct('tags'); }

async function countAll()      { return col().countDocuments(); }
async function countUpcoming() { return col().countDocuments({ startDate: { $gte: new Date() } }); }

async function nextUpcoming(limit = 5) {
  return col().find({ startDate: { $gte: new Date() } })
    .sort({ startDate: 1 }).limit(limit)
    .project({ title:1, category:1, startDate:1, location:1, capacity:1, registrations:1 })
    .toArray();
}

// Total confirmed registrations across all events — aggregation with $unwind + $match + $group
async function totalConfirmedRegistrations() {
  const [row] = await col().aggregate([
    { $unwind: '$registrations' },
    { $match: { 'registrations.status': 'confirmed' } },
    { $group: { _id: null, total: { $sum: 1 } } }
  ]).toArray();
  return row ? row.total : 0;
}

async function mostPopularEvent() {
  const [row] = await col().aggregate([
    { $project: {
        title: 1,
        category: 1,
        capacity: 1,
        confirmed: {
          $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } }
        }
    }},
    { $sort: { confirmed: -1 } },
    { $limit: 1 }
  ]).toArray();
  return row || null;
}

// -------- CREATE / UPDATE / DELETE --------
function validatePayload(payload) {
  if (!payload.title || !payload.title.trim()) throw Object.assign(new Error('Le titre est obligatoire'), { status: 400 });
  const capacity = parseInt(payload.capacity, 10);
  if (!capacity || capacity <= 0) throw Object.assign(new Error('La capacité doit être > 0'), { status: 400 });
  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (isNaN(startDate) || isNaN(endDate)) throw Object.assign(new Error('Dates invalides'), { status: 400 });
  if (endDate < startDate) throw Object.assign(new Error('La date de fin doit être après la date de début'), { status: 400 });
  return { capacity, startDate, endDate };
}

async function create(payload) {
  const { capacity, startDate, endDate } = validatePayload(payload);
  const doc = {
    title: payload.title.trim(),
    description: payload.description || '',
    category: payload.category || 'Other',
    tags: (payload.tags || '').split(',').map(s => s.trim()).filter(Boolean),
    startDate, endDate,
    capacity,
    location: {
      building: payload.building || '',
      room:     payload.room || '',
      campus:   payload.campus || ''
    },
    organizerId: toObjectId(payload.organizerId),
    registrations: [],
    createdAt: new Date()
  };
  const r = await col().insertOne(doc);
  return r.insertedId;
}

async function update(id, payload) {
  const { capacity, startDate, endDate } = validatePayload(payload);
  await col().updateOne(
    { _id: toObjectId(id) },
    { $set: {
        title: payload.title.trim(),
        description: payload.description || '',
        category: payload.category || 'Other',
        tags: (payload.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        startDate, endDate,
        capacity,
        'location.building': payload.building || '',
        'location.room':     payload.room || '',
        'location.campus':   payload.campus || '',
        organizerId: toObjectId(payload.organizerId)
    }}
  );
}

async function remove(id) {
  await col().deleteOne({ _id: toObjectId(id) });
}

// -------- REGISTRATIONS (embedded array updates) --------
async function registerUser(eventId, userId) {
  const event = await findById(eventId);
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  const userOid = toObjectId(userId);
  const already = (event.registrations || []).find(r =>
    r.userId.equals(userOid) && r.status !== 'cancelled'
  );
  if (already) throw Object.assign(new Error('Utilisateur déjà inscrit'), { status: 409 });

  const isFull = confirmedCount(event) >= event.capacity;
  const status = isFull ? 'waiting' : 'confirmed';

  await col().updateOne(
    { _id: event._id },
    { $push: { registrations: { userId: userOid, registeredAt: new Date(), status } } }
  );
  return status;
}

async function cancelRegistration(eventId, userId) {
  const userOid = toObjectId(userId);
  await col().updateOne(
    { _id: toObjectId(eventId), 'registrations.userId': userOid },
    { $set: { 'registrations.$.status': 'cancelled' } }
  );
}

async function removeRegistration(eventId, userId) {
  const userOid = toObjectId(userId);
  await col().updateOne(
    { _id: toObjectId(eventId) },
    { $pull: { registrations: { userId: userOid } } }
  );
}

async function findEventsRegisteredBy(userOid) {
  return col().aggregate([
    { $match: { 'registrations.userId': userOid } },
    { $project: {
        title:1, category:1, startDate:1, endDate:1, location:1,
        myRegistration: {
          $first: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.userId', userOid] } } }
        }
    }},
    { $sort: { startDate: 1 } }
  ]).toArray();
}

module.exports = {
  col, toObjectId, confirmedCount,
  findAll, findById, distinctCategories, distinctTags,
  countAll, countUpcoming, nextUpcoming, totalConfirmedRegistrations, mostPopularEvent,
  create, update, remove,
  registerUser, cancelRegistration, removeRegistration,
  findEventsRegisteredBy
};
