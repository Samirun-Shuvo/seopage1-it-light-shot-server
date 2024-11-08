const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.URI_MONGODB;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db = client.db("crack-ai-db");
const connect = async () => {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
};
module.exports = { db, connect };
