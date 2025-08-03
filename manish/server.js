import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { SYSTEM_PROMPT, GEMINI_CONFIG } from "./config.js";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegPath.path);

// ─── helpers ────────────────────────────────────────────────────────────────

function pcm16ToWav(pcmBuffer, sampleRate = 16000) {
    // 44-byte PCM WAV header
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * 2; // 16-bit mono
    const blockAlign = 2;

    header.write("RIFF", 0); // ChunkID
    header.writeUInt32LE(36 + pcmBuffer.length, 4); // ChunkSize
    header.write("WAVE", 8); // Format
    header.write("fmt ", 12); // Subchunk1ID
    header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
    header.writeUInt16LE(1, 22); // NumChannels
    header.writeUInt32LE(sampleRate, 24); // SampleRate
    header.writeUInt32LE(byteRate, 28); // ByteRate
    header.writeUInt16LE(blockAlign, 32); // BlockAlign
    header.writeUInt16LE(16, 34); // BitsPerSample
    header.write("data", 36); // Subchunk2ID
    header.writeUInt32LE(pcmBuffer.length, 40); // Subchunk2Size

    return Buffer.concat([header, pcmBuffer]);
} // Fixed: Added missing closing brace

// ─── resolve __dirname ───────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Express + static ───────────────────────────────────────────────────────

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () =>
    console.log(`Server started on http://localhost:${PORT}`)
);

// ─── Browser ↔ Backend WS ────────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

// Client-specific Gemini connections to avoid conflicts
const clientConnections = new Map();

function createGeminiConnection(clientId) {
    console.log(`Creating new Gemini WebSocket connection for client ${clientId}`);
    
    const geminiWs = new WebSocket(
        "wss://generativelanguage.googleapis.com/ws/" +
        "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent" +
        `?key=${process.env.GOOGLE_API_KEY}`
    );
    
    geminiWs.on("open", () => {
        console.log(`Connected to Gemini Live API WebSocket for client ${clientId}`);
        
        geminiWs.send(
            JSON.stringify({
                setup: {
                    model: GEMINI_CONFIG.model,
                    generationConfig: GEMINI_CONFIG.generationConfig
                }
            })
        );
    });
    
    geminiWs.on("error", (e) => {
        console.error(`Gemini WS error for client ${clientId}:`, e.message);
        clientConnections.delete(clientId);
    });
    
    geminiWs.on("close", (code, reason) => {
        console.log(`Gemini WebSocket closed for client ${clientId}:`, code, reason);
        clientConnections.delete(clientId);
        if (code === 1007) {
            console.log("Gemini API error - check the payload format");
        }
    });
    
    clientConnections.set(clientId, geminiWs);
    return geminiWs;
}

wss.on("connection", (clientSocket) => {
    const clientId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    console.log(`Frontend connected with client ID: ${clientId}`);

    // Audio accumulation for better quality
    let audioChunks = [];
    let isGeneratingAudio = false;
    let geminiSetupComplete = false;
    let conversationContext = []; // Track conversation history
    let responseTimeout = null; // Track response timeout

    // Create client-specific Gemini connection
    const geminiWs = createGeminiConnection(clientId);

    // Handle Gemini setup completion
    geminiWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.setupComplete) {
            console.log("Gemini setup confirmed");
            geminiSetupComplete = true;
        }
    });

    // ── Frontend → (WebM) → ffmpeg → PCM → Gemini ────────────────────────────

    clientSocket.on("message", async (raw) => {
        try {
            const { realtimeInput } = JSON.parse(raw);
            const base64WebM = realtimeInput?.audio;

            if (!base64WebM) return;

            console.log("Received audio, converting to raw PCM…");
            
            const inPath = path.join(__dirname, "tmp_in.webm");
            const pcmPath = path.join(__dirname, "tmp_out.pcm");

            fs.writeFileSync(inPath, Buffer.from(base64WebM, "base64"));

            await new Promise((res, rej) =>
                ffmpeg(inPath)
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .format("s16le")
                    .on("end", () => {
                        console.log("FFmpeg conversion completed");
                        res();
                    })
                    .on("error", (err) => {
                        console.error("FFmpeg error:", err);
                        rej(err);
                    })
                    .save(pcmPath)
            );

            const pcmBuffer = fs.readFileSync(pcmPath);
            const base64PCM = pcmBuffer.toString("base64");
            
            console.log(`PCM buffer size: ${pcmBuffer.length} bytes`);

            // Send audio chunk to Gemini with conversation context
            const payload = {
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64PCM
                    }]
                }
            };

            // Add conversation context if available
            if (conversationContext.length > 0) {
                console.log("Including conversation context:", conversationContext.length, "previous interactions");
            }

            console.log("Sending audio chunk to Gemini...");
            geminiWs.send(JSON.stringify(payload));

            // Set timeout for Gemini response
            const responseTimeout = setTimeout(() => {
                if (isGeneratingAudio) {
                    console.log("⚠️ Gemini response timeout - sending accumulated audio");
                    if (audioChunks.length > 0) {
                        const combinedPcm = Buffer.concat(audioChunks);
                        const wav = pcm16ToWav(combinedPcm, 24000);
                        clientSocket.send(wav);
                        audioChunks = [];
                        isGeneratingAudio = false;
                        console.log("Timeout fallback: AI audio sent to frontend");
                    } else {
                        console.log("⚠️ No audio accumulated, sending error to frontend");
                        clientSocket.send(JSON.stringify({ 
                            type: "error", 
                            error: "No response from AI - please try again" 
                        }));
                    }
                }
            }, 15000); // 15 second timeout

            // Track user input in conversation context (limit to last 10 turns)
            conversationContext.push({
                timestamp: Date.now(),
                type: "user_input",
                audioSize: base64PCM.length
            });
            
            // Keep only last 10 conversation turns to prevent context overflow
            if (conversationContext.length > 10) {
                conversationContext = conversationContext.slice(-10);
                console.log("Conversation context trimmed to last 10 turns");
            }

            console.log("Audio sent to Gemini");
            console.log("User input tracked, conversation context:", conversationContext.length, "turns");

            // Cleanup
            fs.unlinkSync(inPath);
            fs.unlinkSync(pcmPath);
        } catch (err) {
            console.error("Audio processing error:", err);
            clientSocket.send(JSON.stringify({ error: err.message }));
        }
    });

    // ── Gemini → WAV → Frontend ──────────────────────────────────────────────

    geminiWs.on("message", (raw) => {
        console.log("=== GEMINI RESPONSE RECEIVED ===");
        console.log("Raw message from Gemini:", raw.toString());
        
        const msg = JSON.parse(raw.toString());
        console.log("Parsed Gemini message:", msg);
        
        // Handle setup confirmation
        if (msg.setupComplete) {
            console.log("Gemini setup confirmed");
            geminiSetupComplete = true;
            return;
        }
        
        // Check for generation complete
        if (msg.serverContent?.generationComplete && isGeneratingAudio && audioChunks.length > 0) {
            console.log("Generation complete, sending accumulated audio");
            const combinedPcm = Buffer.concat(audioChunks);
            const wav = pcm16ToWav(combinedPcm, 24000); // Assuming 24kHz for combined
            clientSocket.send(wav);
            audioChunks = [];
            isGeneratingAudio = false;
            
            // Clear any pending timeout
            if (responseTimeout) {
                clearTimeout(responseTimeout);
            }
            
            // Track successful conversation turn
            conversationContext.push({
                timestamp: Date.now(),
                type: "response",
                audioChunks: audioChunks.length
            });
            
            console.log("Complete AI audio sent to frontend (24kHz)");
            console.log("Conversation context updated, total turns:", conversationContext.length);
            
            // Send signal to frontend to auto-restart listening
            clientSocket.send(JSON.stringify({ 
                type: "autoRestart", 
                message: "AI response complete, restart listening" 
            }));
            
            return;
        }
        
        // Handle interrupted responses
        if (msg.serverContent?.interrupted) {
            console.log("⚠️ Gemini response was interrupted");
            if (responseTimeout) {
                clearTimeout(responseTimeout);
            }
            isGeneratingAudio = false;
            audioChunks = [];
            return;
        }
        
        // Fallback: send accumulated audio after timeout if turnComplete is received
        if (isGeneratingAudio && audioChunks.length > 0 && msg.serverContent?.turnComplete) {
            setTimeout(() => {
                if (audioChunks.length > 0) {
                    console.log("Sending accumulated audio after timeout");
                    const combinedPcm = Buffer.concat(audioChunks);
                    const wav = pcm16ToWav(combinedPcm, 24000);
                    clientSocket.send(wav);
                    audioChunks = [];
                    isGeneratingAudio = false;
                    console.log("Fallback AI audio sent to frontend");
                }
            }, 500); // Reduced from 1000ms to 500ms for lower latency
        }
        
        // Process audio parts
        const parts = msg?.serverContent?.modelTurn?.parts || msg?.modelTurn?.parts || [];
        console.log("Found", parts.length, "parts in response");
        
        for (const p of parts) {
            const b64 = p?.inlineData?.data;
            const mimeType = p?.inlineData?.mimeType;
            
            if (b64) {
                console.log("Found audio data in response");
                console.log("Audio data length:", b64.length);
                console.log("MIME type:", mimeType);
                
                const pcmBuffer = Buffer.from(b64, "base64");
                console.log("PCM buffer size:", pcmBuffer.length);
                
                // Extract sample rate from MIME type
                let sampleRate = 24000; // Default
                if (mimeType && mimeType.includes("rate=")) {
                    const rateMatch = mimeType.match(/rate=(\d+)/);
                    if (rateMatch) {
                        sampleRate = parseInt(rateMatch[1]);
                    }
                }
                
                audioChunks.push(pcmBuffer);
                isGeneratingAudio = true;
                console.log("Accumulated", audioChunks.length, "audio chunks");
            }
        }
    });

    clientSocket.on("close", () => {
        console.log(`Frontend disconnected for client ${clientId}`);
        // Clean up client-specific connection
        if (clientConnections.has(clientId)) {
            const geminiWs = clientConnections.get(clientId);
            geminiWs.close();
            clientConnections.delete(clientId);
        }
    });
});
