import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/musiteacher';

if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
  console.warn('تحذير: MONGODB_URI غير معرف في بيئة الإنتاج');
}
let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export default clientPromise;
// تحديث إجباري لحل مشكلة البناء في Vercel