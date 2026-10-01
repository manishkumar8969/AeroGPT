import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer"; // File upload handle karne ke liye
import chatRoutes from "./routes/chat.js";

const app = express();
const PORT = 8080;

// Standard Middlewares
app.use(express.json());
app.use(cors());

// Multer integration for memory storage (Taaki system dynamic server par bina hard disk space consume kiye context vectors read kar sake)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // Maximum file reading up to 50MB
});

// Yahan hum upload.single("file") ko routes se pehle parse middleware bana rahe hain
app.use("/api", upload.single("file"), chatRoutes);

// Server Listen
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});

// Database Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected with Database successfully!");
    } catch (err) {
        console.log("Failed to connect with DB:", err);
    }
};