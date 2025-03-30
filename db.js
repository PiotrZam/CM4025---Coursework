const {MongoClient} = require("mongodb");

const mongoUri = "mongodb://127.0.0.1:27017";
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
