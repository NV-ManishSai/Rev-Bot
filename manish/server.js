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

wss.on("connection", (clientSocket) => {
    console.log("Frontend connected");

    // Audio accumulation for better quality
    let audioChunks = [];
    let isGeneratingAudio = false;

    // Gemini Live WebSocket
    const geminiWs = new WebSocket(
        "wss://generativelanguage.googleapis.com/ws/" +
        "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent" +
        `?key=${process.env.GOOGLE_API_KEY}`
    );

    geminiWs.on("open", () => {
        console.log("Connected to Gemini Live API WebSocket");

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
        console.error("Gemini WS error:", e.message);
        clientSocket.send(JSON.stringify({ error: e.message }));
    });

    geminiWs.on("close", (code, reason) => {
        console.log("Gemini WebSocket closed:", code, reason);
        if (code === 1007) {
            console.log("Gemini API error - check the payload format");
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

            // Send audio chunk to Gemini
            const payload = {
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64PCM
                    }]
                }
            };

            console.log("Sending audio chunk to Gemini...");
            geminiWs.send(JSON.stringify(payload));

            console.log("Audio sent to Gemini");

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
        
        let msg;
        try { 
            msg = JSON.parse(raw); 
            console.log("Parsed Gemini message:", JSON.stringify(msg, null, 2));
        } catch (e) { 
            console.log("Failed to parse Gemini message:", e.message);
            return; 
        }

        // Check for setup confirmation
        if (msg.setupComplete) {
            console.log("Gemini setup confirmed");
            return;
        }

        // Check if generation is complete and send accumulated audio
        if (msg.serverContent?.generationComplete && isGeneratingAudio && audioChunks.length > 0) {
            console.log("Generation complete, sending accumulated audio");
            const combinedPcm = Buffer.concat(audioChunks);
            console.log("Combined PCM buffer size:", combinedPcm.length);
            
            // Use 24kHz as default for Gemini responses
            const wav = pcm16ToWav(combinedPcm, 24000);
            clientSocket.send(wav);
            console.log("Complete AI audio sent to frontend (24kHz)");
            
            // Reset for next response
            audioChunks = [];
            isGeneratingAudio = false;
            return;
        }

        // Fallback: if we have accumulated audio but no generationComplete, send after a delay
        if (isGeneratingAudio && audioChunks.length > 0 && msg.serverContent?.turnComplete) {
            setTimeout(() => {
                if (audioChunks.length > 0) {
                    console.log("Sending accumulated audio after timeout");
                    const combinedPcm = Buffer.concat(audioChunks);
                    console.log("Combined PCM buffer size:", combinedPcm.length);
                    
                    const wav = pcm16ToWav(combinedPcm, 24000);
                    clientSocket.send(wav);
                    console.log("Complete AI audio sent to frontend (24kHz) - timeout");
                    
                    // Reset for next response
                    audioChunks = [];
                    isGeneratingAudio = false;
                }
            }, 1000); // Wait 1 second for more audio chunks
        }

        // 1) Legacy field
        if (msg.outputAudio?.data) {
            console.log("Found legacy outputAudio field");
            const pcmBuffer = Buffer.from(msg.outputAudio.data, "base64");
            console.log("Legacy PCM buffer size:", pcmBuffer.length);
            const wav = pcm16ToWav(pcmBuffer, 24000); // Legacy uses 24kHz
            clientSocket.send(wav);
            console.log("AI audio sent to frontend (legacy 24kHz)");
            return;
        }

        // 2) New schema
        const parts =
            msg?.serverContent?.modelTurn?.parts ||
            msg?.modelTurn?.parts || [];

        console.log(`Found ${parts.length} parts in response`);

        for (const p of parts) {
            if (p?.text) {
                console.log("Text response:", p.text);
            }
            const b64 = p?.inlineData?.data;
            const mimeType = p?.inlineData?.mimeType;
            if (b64) {
                console.log("Found audio data in response");
                console.log("Audio data length:", b64.length);
                console.log("MIME type:", mimeType);
                const pcmBuffer = Buffer.from(b64, "base64");
                console.log("PCM buffer size:", pcmBuffer.length);
                
                // Accumulate audio chunks
                audioChunks.push(pcmBuffer);
                isGeneratingAudio = true;
                console.log(`Accumulated ${audioChunks.length} audio chunks`);
            }
        }
    });

    clientSocket.on("close", () => {
        console.log("Frontend disconnected");
        geminiWs.close();
    });
});
