require('dotenv').config();

const {MongoClient} = require("mongodb");

const mongoUri = process.env.MONGO_URI;
const mongoClient = new MongoClient(mongoUri);
const dbName = "whisperedWords";

let db;

async function connectToDatabase() {
    if (!db) {
        await mongoClient.connect();
        db = mongoClient.db(dbName);
        console.log("MongoDB Connected!");
    }
    return db;
}

module.exports = { connectToDatabase, mongoClient };
