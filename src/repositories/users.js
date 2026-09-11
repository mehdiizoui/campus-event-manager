/**
 * Users repository — all MongoDB operations for the users collection.
 */
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const col = () => getDb().collection('users');

function toObjectId(id) {
  if (!ObjectId.isValid(id)) throw Object.assign(new Error('Malformed identifier'), { status: 400 });
  return new ObjectId(id);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findAll({ q, department, role } = {}) {
  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName:  { $regex: q, $options: 'i' } },
      { email:     { $regex: q, $options: 'i' } }
    ];
  }
  if (department) filter.department = department;
  if (role)       filter.role = role;

  // $lookup: number of registrations per user, computed from events.registrations
  return col().aggregate([
    { $match: filter },
    { $lookup: {
        from: 'events',
        let: { uid: '$_id' },
        pipeline: [
          { $unwind: '$registrations' },
          { $match: { $expr: { $eq: ['$registrations.userId', '$$uid'] } } },
          { $count: 'n' }
        ],
        as: 'regs'
    }},
    { $addFields: { registrationCount: { $ifNull: [{ $arrayElemAt: ['$regs.n', 0] }, 0] } } },
    { $project: { regs: 0 } },
    { $sort: { lastName: 1, firstName: 1 } }
  ]).toArray();
}

async function findById(id) {
  return col().findOne({ _id: toObjectId(id) });
}

async function countAll() { return col().countDocuments(); }

async function distinctDepartments() { return col().distinct('department'); }
async function distinctRoles()       { return col().distinct('role'); }

function validate(payload, { updating } = {}) {
  if (!payload.firstName || !payload.firstName.trim())
    throw Object.assign(new Error('firstName obligatoire'), { status: 400 });
  if (!payload.lastName || !payload.lastName.trim())
    throw Object.assign(new Error('lastName obligatoire'), { status: 400 });
  if (!payload.email || !EMAIL_RE.test(payload.email))
    throw Object.assign(new Error('Email invalide'), { status: 400 });
  if (!payload.department) throw Object.assign(new Error('Département obligatoire'), { status: 400 });
  if (!['student','teacher','staff','admin'].includes(payload.role))
    throw Object.assign(new Error('Rôle invalide'), { status: 400 });
}

function normalize(payload) {
  return {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim().toLowerCase(),
    department: payload.department.trim(),
    role: payload.role,
    interests: (payload.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  };
}

async function create(payload) {
  validate(payload);
  const doc = { ...normalize(payload), createdAt: new Date() };
  try {
    const r = await col().insertOne(doc);
    return r.insertedId;
  } catch (e) {
    if (e.code === 11000) throw Object.assign(new Error('Email déjà utilisé'), { status: 409 });
    throw e;
  }
}

async function update(id, payload) {
  validate(payload, { updating: true });
  try {
    await col().updateOne({ _id: toObjectId(id) }, { $set: normalize(payload) });
  } catch (e) {
    if (e.code === 11000) throw Object.assign(new Error('Email déjà utilisé'), { status: 409 });
    throw e;
  }
}

async function remove(id) {
  const events = getDb().collection('events');
  const userOid = toObjectId(id);
  // Consistent strategy: block deletion when the user is still referenced.
  const stillReferenced = await events.countDocuments({
    $or: [{ organizerId: userOid }, { 'registrations.userId': userOid }]
  });
  if (stillReferenced > 0) {
    throw Object.assign(
      new Error("Impossible de supprimer : l'utilisateur est référencé par un event ou une inscription"),
      { status: 409 }
    );
  }
  await col().deleteOne({ _id: userOid });
}

// Users not registered to any event — $lookup + $match on empty array
async function usersWithNoRegistration() {
  return col().aggregate([
    { $lookup: {
        from: 'events',
        let: { uid: '$_id' },
        pipeline: [
          { $match: { $expr: { $in: ['$$uid', { $ifNull: ['$registrations.userId', []] }] } } },
          { $limit: 1 }
        ],
        as: 'refs'
    }},
    { $match: { refs: { $size: 0 } } },
    { $project: { refs: 0 } },
    { $sort: { lastName: 1 } }
  ]).toArray();
}

module.exports = {
  col, toObjectId,
  findAll, findById, countAll, distinctDepartments, distinctRoles,
  create, update, remove,
  usersWithNoRegistration
};
