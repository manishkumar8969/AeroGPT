import express from "express";
import Thread from "../models/Thread.js";
import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const router = express.Router();

const GEMINI_KEY = process.env.GEMINI_API_KEY ;
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY.replace(/["']/g, "").trim() });

let vectorDocumentStore = [];

function findRelevantChunks(query, chunks, topK = 5) {
    if (!chunks || chunks.length === 0) return "";
    const queryTokens = query.toLowerCase().split(/\s+/);
    
    const scored = chunks.map(chunk => {
        const textLower = chunk.text.toLowerCase();
        let score = 0;
        queryTokens.forEach(token => {
            if (textLower.includes(token)) score += 1;
        });
        return { text: chunk.text, score };
    });

    return scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(item => item.text)
        .join("\n");
}

function extractLocalAnswer(query, context) {
    const lowerQuery = query.toLowerCase().trim();
    
    let cleanText = context
        .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
        .replace(/TypePage|TypePages|MediaBox|endobj|obj|stream|endstream|FlateDecode|Length/gi, " ")
        .replace(/<<[\s\S]*?>>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!context || cleanText.length < 5) {
        if (lowerQuery.includes("name") && lowerQuery.includes("your")) return "I am AeroGPT, a sophisticated AI conversational system built on custom node processing matrices.";
        if (lowerQuery.includes("hello") || lowerQuery.includes("hi") || lowerQuery.includes("hii")) return "Hello! I am AeroGPT. I can chat with you universally or analyze uploaded profile documents.";
        if (lowerQuery.includes("how are you")) return "I am running efficiently at peak performance bounds. How can I help you?";
        return "I am ready. Please upload a standard file or ask a direct conversational query.";
    }

    if (lowerQuery.includes("name") || lowerQuery.includes("naam") || lowerQuery.includes("student")) {
        const nameMatch = cleanText.match(/(?:student\s*name|candidate\s*name|candidate\s*profile|name)\s*[:=-]\s*([A-Za-z\s]{3,35})/i);
        if (nameMatch && nameMatch[1]) return nameMatch[1].trim();

        const tokens = cleanText.split(/\s+/).filter(w => /^[A-Za-z]+$/.test(w) && w.length > 1);
        const stops = new Set(["placement", "policy", "acceptance", "undertaking", "agreement", "corporate", "report", "profile", "candidate", "highlights", "qualification"]);
        let validTokens = tokens.filter(t => !stops.has(t.toLowerCase()));
        if (validTokens.length >= 2) {
            return `${validTokens[0]} ${validTokens[1]} ${validTokens[2] || ""}`.trim();
        }
    }

    if (lowerQuery.includes("roll") || lowerQuery.includes("id") || lowerQuery.includes("number") || lowerQuery.includes("enrollment")) {
        const rollMatch = cleanText.match(/(?:enrollment\s*id|roll\s*no|roll\s*number|id|enrollment)\s*[:=-]?\s*([A-Za-z0-9\/_-]+)/i);
        if (rollMatch && rollMatch[1]) {
            const out = rollMatch[1].trim();
            if (out.toLowerCase() !== "report" && out.toLowerCase() !== "candidate") return out;
        }

        const words = cleanText.split(" ");
        for (let i = 0; i < words.length; i++) {
            if (/enrollment|id|roll/i.test(words[i]) && i + 1 < words.length) {
                let checkWord = words[i+1].replace(/[:=-]/g, "").trim();
                if (checkWord.length > 3) return checkWord;
            }
        }
    }

    if (lowerQuery.includes("cgpa") || lowerQuery.includes("marks") || lowerQuery.includes("percentage") || lowerQuery.includes("pointer")) {
        const cgpaMatch = cleanText.match(/(?:strict|cgpa|pointer|gpa|marks|percentage|score)\s*[:=-]?\s*([0-9.]+(?:\s*\/10|\s*%)?)/i);
        if (cgpaMatch && cgpaMatch[1]) return cgpaMatch[1].trim();
        
        const index = cleanText.toLowerCase().indexOf("cgpa");
        if (index !== -1) return cleanText.substring(index - 2, index + 25).trim();
    }

    if (lowerQuery.includes("project") || lowerQuery.includes("work") || lowerQuery.includes("experience")) {
        const projectMatch = cleanText.match(/(?:project|experience|development)\s*[:=-]?\s*([\s\S]{15,350?})(?=\b(?:skills|education|hobbies|certifications)|$)/i);
        if (projectMatch && projectMatch[0]) return projectMatch[0].trim();
    }

    const targetWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);
    for (let tw of targetWords) {
        const idx = cleanText.toLowerCase().indexOf(tw);
        if (idx !== -1) {
            return cleanText.substring(Math.max(0, idx - 20), Math.min(cleanText.length, idx + 150)).trim() + "...";
        }
    }

    return "Parameter could not be localized within the dynamic active layout index.";
}

router.get("/thread", async(req, res) => {
    try {
        const threads = await Thread.find({}).sort({updatedAt: -1});
        res.json(threads);
    } catch(err) {
        res.status(500).json({error: "Failed to fetch threads"});
    }
});

router.get("/thread/:threadId", async(req, res) => {
    const {threadId} = req.params;
    try {
        const thread = await Thread.findOne({threadId});
        if(!thread) return res.status(404).json({error: "Thread not found"});
        res.json(thread.messages);
    } catch(err) {
        res.status(500).json({error: "Failed to fetch chat"});
    }
});

router.delete("/thread/:threadId", async (req, res) => {
    const {threadId} = req.params;
    try {
        const deletedThread = await Thread.findOneAndDelete({threadId});
        if(!deletedThread) return res.status(404).json({error: "Thread not found"});
        res.status(200).json({success : "Thread deleted successfully"});
    } catch(err) {
        res.status(500).json({error: "Failed to delete thread"});
    }
});

router.post("/chat", async(req, res) => {
    const { threadId, message } = req.body;

    if (!threadId) {
        return res.status(400).json({ error: "missing threadId field" });
    }

    try {
        let fileContext = "";
        let displayedMessage = message || "";

        if (req.file) {
            let rawText = "";
            const filename = req.file.originalname.toLowerCase();

            try {
                if (req.file.mimetype === "application/pdf" || filename.endsWith(".pdf")) {
                    const pdfData = await pdf(req.file.buffer);
                    rawText = pdfData && pdfData.text ? pdfData.text : ""; 
                } else {
                    rawText = req.file.buffer.toString("utf-8"); 
                }
            } catch (pdfErr) {
                rawText = req.file.buffer.toString("utf-8");
            }
            
            if (rawText && rawText.trim().length > 0) {
                const cleanText = rawText.replace(/\s+/g, " ");
                const chunks = cleanText.match(/.{1,600}/g) || [];
                
                vectorDocumentStore = vectorDocumentStore.filter(doc => doc.threadId !== threadId);
                chunks.forEach(chunk => {
                    if(chunk.trim().length > 2) {
                        vectorDocumentStore.push({ threadId, text: chunk.trim() });
                    }
                });
                console.log(`[Matrix Ingest] Active document mapped. Clusters: ${chunks.length}`);
            }

            displayedMessage = message ? `[File: ${req.file.originalname}] ${message}` : `[Uploaded File: ${req.file.originalname}]`;
        }

        let thread = await Thread.findOne({ threadId });
        if (!thread) {
            thread = new Thread({
                threadId,
                title: req.file ? `Doc: ${req.file.originalname}` : (message ? (message.substring(0, 25) + "...") : "New Chat"),
                messages: [{ role: "user", content: displayedMessage }]
            });
        } else {
            thread.messages.push({ role: "user", content: displayedMessage });
        }

        const activeThreadChunks = vectorDocumentStore.filter(doc => doc.threadId === threadId);
        if (activeThreadChunks.length > 0 && message) {
            fileContext = findRelevantChunks(message, activeThreadChunks, 5);
        }

        let assistantReply = "";
        const lowerMessage = (message || "").toLowerCase().trim();
        
        if (req.file && (!message || lowerMessage.includes("upload") || lowerMessage.includes("load"))) {
            assistantReply = `Document **${req.file.originalname}** successfully uploaded and parsed. You can now request data extraction attributes or chat universally!`;
        }
        else if (activeThreadChunks.length > 0 && message) {
            const fullDocumentContext = activeThreadChunks.map(c => c.text).join("\n");
            const systemInstructions = `You are an expert AI Document Analyser. Answer the user's question accurately based ONLY on the text content provided below. Extract values dynamically. Provide direct, short, and clean answers. If the user asks for a name, return just the name. If they ask for a roll number or CGPA, return just that value. Do not give metadata.\n\n[Document Content]:\n${fullDocumentContext}`;

            try {
                const interaction = await ai.interactions.create({
                    model: "gemini-2.5-flash",
                    input: `${systemInstructions}\n\nQuestion: ${message}`
                });
                assistantReply = interaction.output_text ? interaction.output_text.trim() : "Unable to compile response.";
            } catch (apiErr) {
                assistantReply = extractLocalAnswer(message, fullDocumentContext);
            }
        } 
        else if (message) {
            const chatGPTInstructions = `You are AeroGPT, a smart, sophisticated, and friendly conversational AI assistant built on advanced generative layers. You can answer general queries, chat normally, help with coding, or answer analytical questions directly and beautifully.`;

            try {
                const interaction = await ai.interactions.create({
                    model: "gemini-2.5-flash",
                    input: `${chatGPTInstructions}\n\nUser Message: ${message}`
                });
                assistantReply = interaction.output_text ? interaction.output_text.trim() : "Unable to process conversation.";
            } catch (apiErr) {
                assistantReply = extractLocalAnswer(message, "");
            }
        } else {
            assistantReply = "System active. Please provide input sequences.";
        }

        thread.messages.push({ role: "assistant", content: assistantReply });
        thread.updatedAt = new Date();

        await thread.save();
        res.json({ reply: assistantReply });

    } catch (err) {
        console.error("Global Chat Controller Error:", err);
        res.status(200).json({ reply: "AeroGPT Architecture Restored." });
    }
});

export default router;