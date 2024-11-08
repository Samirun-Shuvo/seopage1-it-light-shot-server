require("dotenv").config(); // Load environment variables from a .env file
const express = require("express");
const { MongoClient } = require("mongodb");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const uri = process.env.URI_MONGODB || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "mydatabase";

let db;
let client;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

// Set up multer for handling multiple file uploads
const storage = multer.memoryStorage(); // Store files temporarily in memory
const upload = multer({ storage: storage });

// Initialize MongoDB connection
const connectDB = async () => {
  try {
    if (!db) {
      client = new MongoClient(uri, { useUnifiedTopology: true });
      await client.connect();
      db = client.db(dbName);
      console.log("Connected to MongoDB");
    }
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("Database connection error");
  }
};

// Middleware to attach db to the request object
const attachDb = async (req, res, next) => {
  try {
    req.db = await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Sample route
app.get("/", (req, res) => {
  res.send("Hello, world!");
});

// Route to handle multiple file uploads with taskId
app.post("/uploadfiles", attachDb, upload.array("files"), async (req, res) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ message: "Task ID is required" });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  try {
    const collection = req.db.collection("uploadfiledata");

    // Retrieve existing file names for the taskId
    const existingFiles = await collection.find({ taskId }).toArray();
    const existingFileNames = existingFiles.map((file) => file.filename);

    // Filter out files that already exist
    const newFiles = req.files.filter(
      (file) => !existingFileNames.includes(file.originalname)
    );

    if (newFiles.length === 0) {
      return res
        .status(200)
        .json({ message: "Files already exist in database", status: "exist" });
    }

    // Prepare metadata for new files only
    const fileDataArray = newFiles.map((file) => ({
      taskId,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      data: file.buffer, // Optional: store the actual file content
    }));

    // Insert new files data into MongoDB
    await collection.insertMany(fileDataArray);

    res.status(200).json({
      message: "Files uploaded successfully",
      newFiles: fileDataArray.length,
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ message: "Error uploading files" });
  }
});

// Route to fetch files for a specific taskId
app.get("/uploadfiles/:taskId", attachDb, async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const collection = req.db.collection("uploadfiledata");
    const taskFiles = await collection.find({ taskId }).toArray();

    if (taskFiles.length === 0) {
      return res.status(404).json({ message: "No files found for this task" });
    }

    res.json({ files: taskFiles });
  } catch (error) {
    console.error("Error fetching task files:", error);
    res.status(500).json({ message: "Error fetching task files" });
  }
});

// Start the server after the initial DB connection
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Close the MongoDB connection when the app is terminated
process.on("SIGINT", async () => {
  if (client) {
    await client.close();
    console.log("MongoDB connection closed");
  }
  process.exit(0);
});
