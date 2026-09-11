/**
 * database/init.js
 * Creates the campus_events database, applies schema validation and indexes.
 *
 * Run with:   node database/init.js
 * Or:        mongosh "<uri>" database/init.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'campus_events';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const existing = (await db.listCollections().toArray()).map(c => c.name);

  // ------- users collection with JSON-schema validation -------
  const usersValidator = {
    $jsonSchema: {
      bsonType: 'object',
      required: ['firstName', 'lastName', 'email', 'department', 'role', 'interests', 'createdAt'],
      properties: {
        firstName:  { bsonType: 'string', minLength: 1 },
        lastName:   { bsonType: 'string', minLength: 1 },
        email:      { bsonType: 'string', pattern: '^.+@.+\\..+$' },
        department: { bsonType: 'string' },
        role:       { enum: ['student', 'teacher', 'staff', 'admin'] },
        interests:  { bsonType: 'array', items: { bsonType: 'string' } },
        createdAt:  { bsonType: 'date' }
      }
    }
  };

  if (existing.includes('users')) {
    await db.command({ collMod: 'users', validator: usersValidator, validationLevel: 'moderate' });
  } else {
    await db.createCollection('users', { validator: usersValidator });
  }

  // ------- events collection with JSON-schema validation -------
  const eventsValidator = {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'description', 'category', 'tags', 'startDate', 'endDate',
                 'capacity', 'location', 'organizerId', 'registrations', 'createdAt'],
      properties: {
        title:       { bsonType: 'string', minLength: 1 },
        description: { bsonType: 'string' },
        category:    { bsonType: 'string' },
        tags:        { bsonType: 'array', items: { bsonType: 'string' } },
        startDate:   { bsonType: 'date' },
        endDate:     { bsonType: 'date' },
        capacity:    { bsonType: ['int', 'long', 'double'], minimum: 1 },
        location: {
          bsonType: 'object',
          required: ['building', 'room', 'campus'],
          properties: {
            building: { bsonType: 'string' },
            room:     { bsonType: 'string' },
            campus:   { bsonType: 'string' }
          }
        },
        organizerId:   { bsonType: 'objectId' },
        registrations: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['userId', 'registeredAt', 'status'],
            properties: {
              userId:       { bsonType: 'objectId' },
              registeredAt: { bsonType: 'date' },
              status:       { enum: ['confirmed', 'cancelled', 'waiting'] }
            }
          }
        },
        createdAt: { bsonType: 'date' }
      }
    }
  };

  if (existing.includes('events')) {
    await db.command({ collMod: 'events', validator: eventsValidator, validationLevel: 'moderate' });
  } else {
    await db.createCollection('events', { validator: eventsValidator });
  }

  // ------- indexes (mandatory + supporting) -------
  await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'uniq_email' });
  await db.collection('events').createIndex({ startDate: 1 }, { name: 'idx_startDate' });
  await db.collection('events').createIndex({ category: 1 }, { name: 'idx_category' });
  await db.collection('events').createIndex({ tags: 1 }, { name: 'idx_tags' });
  await db.collection('events').createIndex({ 'registrations.userId': 1 }, { name: 'idx_reg_userId' });

  console.log('[init] database:', dbName);
  console.log('[init] collections ready: users, events');
  console.log('[init] indexes created');

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
