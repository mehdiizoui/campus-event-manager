/**
 * database/seed.js
 * Reproducible seed data for the Campus Event Manager.
 *
 * 15 users, 18 events (past + future + empty), 40+ registrations,
 * 6 categories, 10+ distinct tags.
 */
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'campus_events';

const day = (offsetDays, hour = 10) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
};

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  await db.collection('events').deleteMany({});
  await db.collection('users').deleteMany({});

  // ---------------- 15 users ----------------
  const userDocs = [
    { firstName: 'Amine',   lastName: 'Zouiten',  email: 'amine.zouiten@campus.edu',   department: 'Data',      role: 'student', interests: ['nosql','python','ml'] },
    { firstName: 'Sara',    lastName: 'Bennani',  email: 'sara.bennani@campus.edu',    department: 'Data',      role: 'student', interests: ['data','viz'] },
    { firstName: 'Youssef', lastName: 'El Amrani',email: 'youssef.elamrani@campus.edu',department: 'Cloud',     role: 'student', interests: ['aws','devops'] },
    { firstName: 'Lina',    lastName: 'Haddad',   email: 'lina.haddad@campus.edu',     department: 'Cloud',     role: 'student', interests: ['kubernetes','linux'] },
    { firstName: 'Karim',   lastName: 'Idrissi',  email: 'karim.idrissi@campus.edu',   department: 'AI',        role: 'student', interests: ['ml','python'] },
    { firstName: 'Nora',    lastName: 'Alaoui',   email: 'nora.alaoui@campus.edu',     department: 'AI',        role: 'student', interests: ['nlp','ml'] },
    { firstName: 'Omar',    lastName: 'Mansouri', email: 'omar.mansouri@campus.edu',   department: 'SE',        role: 'student', interests: ['java','architecture'] },
    { firstName: 'Ines',    lastName: 'Chraibi',  email: 'ines.chraibi@campus.edu',    department: 'SE',        role: 'student', interests: ['web','react'] },
    { firstName: 'Reda',    lastName: 'Naciri',   email: 'reda.naciri@campus.edu',     department: 'Data',      role: 'student', interests: ['sql','nosql'] },
    { firstName: 'Meryem',  lastName: 'Fassi',    email: 'meryem.fassi@campus.edu',    department: 'Cloud',     role: 'student', interests: ['docker','ci/cd'] },
    { firstName: 'Hicham',  lastName: 'Bakkali',  email: 'hicham.bakkali@campus.edu',  department: 'Data',      role: 'teacher', interests: ['big-data','spark'] },
    { firstName: 'Fatima',  lastName: 'Zahraoui', email: 'fatima.zahraoui@campus.edu', department: 'AI',        role: 'teacher', interests: ['ml','research'] },
    { firstName: 'Rachid',  lastName: 'Kabbaj',   email: 'rachid.kabbaj@campus.edu',   department: 'SE',        role: 'teacher', interests: ['patterns','architecture'] },
    { firstName: 'Aya',     lastName: 'Sefrioui', email: 'aya.sefrioui@campus.edu',    department: 'Student Life', role: 'staff', interests: ['events','community'] },
    { firstName: 'Yassine', lastName: 'Berrada',  email: 'yassine.berrada@campus.edu', department: 'IT',        role: 'admin',   interests: [] }
  ].map(u => ({ ...u, createdAt: new Date() }));

  const usersInsert = await db.collection('users').insertMany(userDocs);
  const users = userDocs.map((u, i) => ({ ...u, _id: usersInsert.insertedIds[i] }));
  const uid = i => users[i]._id;

  const registration = (userIdx, offsetDays = -1, status = 'confirmed') => ({
    userId: uid(userIdx),
    registeredAt: day(offsetDays, 9),
    status
  });

  // ---------------- 18 events ----------------
  const events = [
    {
      title: 'MongoDB Aggregation Workshop',
      description: 'Hands-on session on $group, $lookup, and pipeline design.',
      category: 'Workshop',
      tags: ['nosql','mongodb','data'],
      startDate: day(-30, 14), endDate: day(-30, 17),
      capacity: 25,
      location: { building: 'Innovation Center', room: 'B204', campus: 'Paris' },
      organizerId: uid(10),
      registrations: [registration(0,-31),registration(1,-31),registration(2,-31),registration(3,-31),registration(4,-31),registration(8,-31)]
    },
    {
      title: 'Intro to Kubernetes',
      description: 'Deploy a first cluster, pods and services explained.',
      category: 'Workshop',
      tags: ['cloud','kubernetes','devops'],
      startDate: day(-20, 10), endDate: day(-20, 13),
      capacity: 20,
      location: { building: 'Tech Hub', room: 'A101', campus: 'Paris' },
      organizerId: uid(12),
      registrations: [registration(2,-22),registration(3,-22),registration(9,-22),registration(6,-22),registration(7,-22)]
    },
    {
      title: 'AI Ethics Talk',
      description: 'Panel discussion on responsible AI.',
      category: 'Talk',
      tags: ['ai','ethics','research'],
      startDate: day(-10, 18), endDate: day(-10, 20),
      capacity: 100,
      location: { building: 'Main Auditorium', room: 'Hall A', campus: 'Paris' },
      organizerId: uid(11),
      registrations: [registration(4,-12),registration(5,-12),registration(11,-12),registration(0,-12),registration(1,-12),registration(6,-12),registration(7,-12),registration(9,-12),registration(13,-12)]
    },
    {
      title: 'Hackathon: FinTech Weekend',
      description: '48h hackathon on financial technologies.',
      category: 'Hackathon',
      tags: ['hackathon','fintech','team'],
      startDate: day(15, 9), endDate: day(17, 20),
      capacity: 40,
      location: { building: 'Innovation Center', room: 'Open Space', campus: 'Paris' },
      organizerId: uid(13),
      registrations: [
        registration(0,-1),registration(1,-1),registration(2,-1),registration(3,-1),
        registration(4,-1),registration(5,-1),registration(6,-1),registration(7,-1),
        registration(8,-1,'waiting'),registration(9,-1,'confirmed')
      ]
    },
    {
      title: 'Python Meetup',
      description: 'Community meetup for Python enthusiasts.',
      category: 'Meetup',
      tags: ['python','community'],
      startDate: day(7, 19), endDate: day(7, 21),
      capacity: 30,
      location: { building: 'Cafeteria', room: 'Lounge', campus: 'Paris' },
      organizerId: uid(11),
      registrations: [registration(0,-2),registration(4,-2),registration(5,-2),registration(8,-2)]
    },
    {
      title: 'Docker Fundamentals',
      description: 'Containerize a real Node.js app.',
      category: 'Workshop',
      tags: ['docker','devops','cloud'],
      startDate: day(10, 14), endDate: day(10, 17),
      capacity: 20,
      location: { building: 'Tech Hub', room: 'A102', campus: 'Paris' },
      organizerId: uid(12),
      registrations: [registration(2,-1),registration(3,-1),registration(9,-1),registration(6,-1)]
    },
    {
      title: 'Data Viz with D3',
      description: 'Build interactive dashboards from scratch.',
      category: 'Workshop',
      tags: ['data','viz','web'],
      startDate: day(3, 10), endDate: day(3, 13),
      capacity: 15,
      location: { building: 'Innovation Center', room: 'B201', campus: 'Paris' },
      organizerId: uid(10),
      registrations: [registration(1,-1),registration(7,-1),registration(8,-1)]
    },
    {
      title: 'ML Research Seminar',
      description: 'Latest papers from NeurIPS.',
      category: 'Talk',
      tags: ['ai','research','ml'],
      startDate: day(21, 16), endDate: day(21, 18),
      capacity: 50,
      location: { building: 'Main Auditorium', room: 'Hall B', campus: 'Paris' },
      organizerId: uid(11),
      registrations: [registration(4,-3),registration(5,-3),registration(11,-3)]
    },
    {
      title: 'Startup Pitch Night',
      description: 'Students pitch their startup ideas.',
      category: 'Activity',
      tags: ['startup','community','team'],
      startDate: day(28, 18), endDate: day(28, 21),
      capacity: 80,
      location: { building: 'Main Auditorium', room: 'Hall A', campus: 'Paris' },
      organizerId: uid(13),
      registrations: [registration(0,-2),registration(6,-2),registration(7,-2),registration(13,-2)]
    },
    {
      title: 'SQL vs NoSQL Debate',
      description: 'A moderated debate between two teams.',
      category: 'Talk',
      tags: ['nosql','sql','data'],
      startDate: day(-45, 17), endDate: day(-45, 19),
      capacity: 60,
      location: { building: 'Main Auditorium', room: 'Hall B', campus: 'Paris' },
      organizerId: uid(10),
      registrations: [registration(0,-46),registration(1,-46),registration(8,-46)]
    },
    {
      title: 'CI/CD with GitHub Actions',
      description: 'Automate tests and deploys.',
      category: 'Workshop',
      tags: ['devops','ci/cd','cloud'],
      startDate: day(5, 14), endDate: day(5, 17),
      capacity: 25,
      location: { building: 'Tech Hub', room: 'A103', campus: 'Paris' },
      organizerId: uid(12),
      registrations: [registration(3,-1),registration(9,-1),registration(2,-1)]
    },
    {
      title: 'Career Fair - Tech',
      description: 'Meet tech recruiters on campus.',
      category: 'Activity',
      tags: ['career','community'],
      startDate: day(40, 10), endDate: day(40, 17),
      capacity: 200,
      location: { building: 'Main Hall', room: 'Ground Floor', campus: 'Paris' },
      organizerId: uid(13),
      registrations: [registration(0,-1),registration(1,-1),registration(6,-1),registration(7,-1),registration(8,-1)]
    },
    {
      title: 'Web Accessibility Workshop',
      description: 'WCAG in practice.',
      category: 'Workshop',
      tags: ['web','accessibility'],
      startDate: day(-5, 14), endDate: day(-5, 16),
      capacity: 20,
      location: { building: 'Innovation Center', room: 'B202', campus: 'Paris' },
      organizerId: uid(12),
      registrations: [registration(7,-6),registration(1,-6)]
    },
    {
      title: 'Spark Big Data Session',
      description: 'Process large datasets with Spark.',
      category: 'Workshop',
      tags: ['big-data','spark','data'],
      startDate: day(12, 10), endDate: day(12, 13),
      capacity: 20,
      location: { building: 'Innovation Center', room: 'B205', campus: 'Paris' },
      organizerId: uid(10),
      registrations: [registration(0,-1),registration(1,-1),registration(8,-1)]
    },
    {
      title: 'Design Patterns in Java',
      description: 'Practical GoF patterns.',
      category: 'Talk',
      tags: ['java','architecture','patterns'],
      startDate: day(9, 16), endDate: day(9, 18),
      capacity: 40,
      location: { building: 'Main Auditorium', room: 'Hall C', campus: 'Paris' },
      organizerId: uid(12),
      registrations: [registration(6,-1)]
    },
    {
      title: 'Board Games Night',
      description: 'Student life event.',
      category: 'Activity',
      tags: ['community'],
      startDate: day(2, 19), endDate: day(2, 22),
      capacity: 50,
      location: { building: 'Cafeteria', room: 'Lounge', campus: 'Paris' },
      organizerId: uid(13),
      registrations: []
    },
    {
      title: 'React Advanced Patterns',
      description: 'Hooks, context, and performance.',
      category: 'Workshop',
      tags: ['web','react','frontend'],
      startDate: day(-15, 14), endDate: day(-15, 17),
      capacity: 20,
      location: { building: 'Tech Hub', room: 'A104', campus: 'Paris' },
      organizerId: uid(12),
      registrations: [registration(7,-17),registration(1,-17),registration(3,-17)]
    },
    {
      title: 'Cloud Cost Optimization',
      description: 'How to keep AWS bills under control.',
      category: 'Talk',
      tags: ['cloud','aws','devops'],
      startDate: day(35, 10), endDate: day(35, 12),
      capacity: 45,
      location: { building: 'Main Auditorium', room: 'Hall B', campus: 'Paris' },
      organizerId: uid(12),
      registrations: []
    }
  ].map(e => ({ ...e, capacity: e.capacity | 0, createdAt: new Date() }));

  const eventsInsert = await db.collection('events').insertMany(events);

  const totalRegistrations = events.reduce((s, e) => s + e.registrations.length, 0);
  console.log('[seed] users inserted:', users.length);
  console.log('[seed] events inserted:', Object.keys(eventsInsert.insertedIds).length);
  console.log('[seed] registrations inserted:', totalRegistrations);
  console.log('[seed] categories:', [...new Set(events.map(e => e.category))].join(', '));

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
