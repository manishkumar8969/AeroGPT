import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import chatRoutes from "./routes/chat.js";

const app = express();

// Cloud providers (Render/Heroku/Railway) provide PORT via environment variable
const PORT = process.env.PORT || 8080;

// Standard Middlewares
app.use(express.json());
app.use(cors());

// Health check route (Render monitoring ke liye)
app.get("/", (req, res) => {
    res.send("AeroGPT Backend is running live!");
});

// Multer integration for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // Maximum file reading up to 50MB
});

// Routes integration
app.use("/api", upload.single("file"), chatRoutes);

// Database Connection & Server Startup
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected with Database successfully!");
    } catch (err) {
        console.error("Failed to connect with DB:", err);
    }
};

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});