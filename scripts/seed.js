// scripts/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Transaction, Ticket, User } = require('../database');

const { MONGODB_URI = 'mongodb://127.0.0.1:27017/trexo' } = process.env;

function fee(amount) {
  const processing = +(amount * 0.029 + 0.3).toFixed(2);
  return { processingFee: processing, netAmount: +(amount - processing).toFixed(2) };
}
function code() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected. Seeding…');

  // --- Transactions
  const txns = [
    { id:'TXN-001', amount:45000, description:'Initial deposit - Residential complex', paymentMethod:'Bank Transfer',
      customerInfo:{ name:'ABC Corp', email:'billing@abccorp.com' }, paymentDetails:{ ref:'BT123' },
      status:'completed', timestamp:new Date('2024-12-20'), confirmationCode:code() },
    { id:'TXN-002', amount:32000, description:'Progress payment - Office building', paymentMethod:'Credit Card',
      customerInfo:{ name:'XYZ Ltd', email:'pay@xyz.com' }, paymentDetails:{ last4:'4242' },
      status:'pending', timestamp:new Date('2024-12-19'), confirmationCode:code() },
    { id:'TXN-003', amount:78000, description:'Milestone - Warehouse foundation', paymentMethod:'Check',
      customerInfo:{ name:'Smith Enterprises', email:'acct@smithent.com' }, paymentDetails:{ checkNo:'987654' },
      status:'completed', timestamp:new Date('2024-12-18'), confirmationCode:code() },
    { id:'TXN-004', amount:25000, description:'Change order fee', paymentMethod:'Bank Transfer',
      customerInfo:{ name:'Johnson Co', email:'fin@johnson.co' }, paymentDetails:{ ref:'BT456' },
      status:'failed', timestamp:new Date('2024-12-17'), confirmationCode:code() },
    { id:'TXN-005', amount:95000, description:'Final payment - Mall renovation', paymentMethod:'Wire Transfer',
      customerInfo:{ name:'Wilson Group', email:'ap@wilsongroup.com' }, paymentDetails:{ swift:'WILSON123' },
      status:'completed', timestamp:new Date('2024-12-16'), confirmationCode:code() },
    { id:'TXN-006', amount:56000, description:'Equipment advance', paymentMethod:'Credit Card',
      customerInfo:{ name:'Brown LLC', email:'acc@brownllc.com' }, paymentDetails:{ last4:'1881' },
      status:'pending', timestamp:new Date('2024-12-15'), confirmationCode:code() },
    { id:'TXN-007', amount:67000, description:'Progress payment', paymentMethod:'Bank Transfer',
      customerInfo:{ name:'Davis Inc', email:'billing@davis.inc' }, paymentDetails:{ ref:'BT789' },
      status:'completed', timestamp:new Date('2024-12-14'), confirmationCode:code() },
  ].map(t => ({ ...t, ...fee(t.amount) }));

  if ((await Transaction.countDocuments()) === 0) {
    await Transaction.insertMany(txns);
    console.log(`✓ Inserted ${txns.length} transactions`);
  } else {
    console.log('• Transactions already exist — skipping');
  }

  // --- Tickets
  const tickets = [
    { id:1, type:'quote', name:'John Smith', email:'john@example.com', phone:'555-1111',
      company:'Smith Ent.', projectType:'Residential', budget:'$50k–$80k',
      message:'Need quote for house renovation', status:'new', timestamp:new Date('2024-12-20'), priority:'high' },
    { id:2, type:'contact', name:'Sarah Johnson', email:'sarah@example.com', phone:'555-2222',
      company:'SJ Holdings', projectType:'Commercial', message:'Office building construction',
      status:'in-progress', timestamp:new Date('2024-12-19') },
    { id:3, type:'quote', name:'Mike Wilson', email:'mike@example.com', phone:'555-3333',
      company:'Wilson Group', projectType:'Industrial', budget:'$1M+',
      message:'Warehouse construction project', status:'closed', timestamp:new Date('2024-12-18') },
    { id:4, type:'contact', name:'Lisa Brown', email:'lisa@example.com', phone:'555-4444',
      company:'LB Homes', projectType:'Residential', message:'Kitchen remodeling questions',
      status:'new', timestamp:new Date('2024-12-17') },
    { id:5, type:'quote', name:'David Davis', email:'david@example.com', phone:'555-5555',
      company:'Davis Inc', projectType:'Commercial', budget:'$500k–$800k',
      message:'Shopping center renovation quote', status:'in-progress', timestamp:new Date('2024-12-16') },
    { id:6, type:'contact', name:'Emma Garcia', email:'emma@example.com', phone:'555-6666',
      company:'EG Homes', projectType:'Residential', message:'Bathroom renovation inquiry',
      status:'new', timestamp:new Date('2024-12-15') },
    { id:7, type:'quote', name:'James Martinez', email:'james@example.com', phone:'555-7777',
      company:'JM Factory', projectType:'Industrial', message:'Factory extension project',
      status:'closed', timestamp:new Date('2024-12-14') },
  ];

  if ((await Ticket.countDocuments()) === 0) {
    await Ticket.insertMany(tickets);
    console.log(`✓ Inserted ${tickets.length} tickets`);
  } else {
    console.log('• Tickets already exist — skipping');
  }

  // --- Default users (for later auth wiring)
  await User.updateOne(
    { email: 'admin@trexo.local' },
    { name: 'Admin User', email: 'admin@trexo.local', password: 'admin123', role: 'admin' },
    { upsert: true }
  );
  await User.updateOne(
    { email: 'support@trexo.local' },
    { name: 'Support Manager', email: 'support@trexo.local', password: 'support123', role: 'support' },
    { upsert: true }
  );
  console.log('✓ Users ensured');

  await mongoose.disconnect();
  console.log('✓ Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
