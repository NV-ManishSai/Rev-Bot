const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const aiAudio = document.getElementById("aiAudio");
const recordingIndicator = document.getElementById("recordingIndicator");

let ws, mediaRecorder, audioChunks = [];
let isListening = false;
let isProcessing = false;
let conversationActive = false;

// Connect to backend WS
function connectWS() {
    ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onopen = () => {
        console.log("Connected to backend");
        updateStatus("Connected to server", "fas fa-wifi");
    };
    
    ws.onmessage = (event) => {
        // Play AI audio
        console.log("Received audio from backend");
        const audioData = event.data;
        const blob = new Blob([audioData], { type: "audio/wav" });
        aiAudio.src = URL.createObjectURL(blob);
        aiAudio.classList.add("show");
        
        // Auto-play and then start listening again
        aiAudio.play();
        updateStatus("AI response received", "fas fa-robot");
        
        // Wait for audio to finish, then start listening again
        aiAudio.onended = () => {
            if (conversationActive) {
                setTimeout(() => {
                    startListening();
                }, 1000); // Wait 1 second after AI finishes speaking
            }
        };
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        updateStatus("Connection error. Please refresh.", "fas fa-exclamation-triangle");
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed");
        updateStatus("Connection lost. Please refresh.", "fas fa-exclamation-triangle");
    };
}

// Update status with icon
function updateStatus(message, iconClass) {
    statusEl.innerHTML = `<i class="${iconClass}"></i> ${message}`;
    statusEl.className = "status";
    
    if (message.includes("Recording") || message.includes("Listening")) {
        statusEl.classList.add("recording");
    } else if (message.includes("Sending") || message.includes("Awaiting") || message.includes("Processing")) {
        statusEl.classList.add("processing");
    }
}

// Start listening function
async function startListening() {
    if (isListening || isProcessing) return;
    
    try {
        isListening = true;
        updateStatus("Listening...", "fas fa-microphone");
        recordingIndicator.classList.add("active");
        startBtn.disabled = true;
        stopBtn.disabled = false;
        aiAudio.classList.remove("show");

        // Ensure connection is ready
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connectWS();
            await new Promise(resolve => {
                const checkConnection = () => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        resolve();
                    } else {
                        setTimeout(checkConnection, 100);
                    }
                };
                checkConnection();
            });
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        
        // Auto-stop after 10 seconds of silence or when user stops talking
        let silenceTimer;
        let audioLevel = 0;
        
        mediaRecorder.onstart = () => {
            // Start monitoring audio levels
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const checkAudioLevel = () => {
                if (!isListening) return;
                
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                audioLevel = average;
                
                if (average > 10) { // Sound detected
                    clearTimeout(silenceTimer);
                    silenceTimer = setTimeout(() => {
                        if (isListening) {
                            stopListening();
                        }
                    }, 3000); // Stop after 3 seconds of silence
                }
                
                requestAnimationFrame(checkAudioLevel);
            };
            
            checkAudioLevel();
        };
        
        mediaRecorder.start();
        
    } catch (error) {
        console.error("Error starting recording:", error);
        updateStatus("Error accessing microphone", "fas fa-exclamation-triangle");
        isListening = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        recordingIndicator.classList.remove("active");
    }
}

// Stop listening function
function stopListening() {
    if (!isListening) return;
    
    isListening = false;
    isProcessing = true;
    recordingIndicator.classList.remove("active");
    
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        updateStatus("Processing...", "fas fa-cog fa-spin");

        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: "audio/webm" });
            const arrayBuffer = await blob.arrayBuffer();

            // Convert ArrayBuffer to base64
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            uint8Array.forEach(byte => binary += String.fromCharCode(byte));
            const base64Audio = btoa(binary);

            // Send JSON payload
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ realtimeInput: { audio: base64Audio } }));
                updateStatus("Awaiting AI response...", "fas fa-spinner fa-spin");
            } else {
                updateStatus("Connection lost. Please refresh.", "fas fa-exclamation-triangle");
                isProcessing = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        };
    }
}

// Initialize WebSocket connection when page loads
connectWS();

// Start conversation button
startBtn.addEventListener("click", () => {
    if (!conversationActive) {
        conversationActive = true;
        startBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Conversation';
        startBtn.classList.remove('btn-primary');
        startBtn.classList.add('btn-danger');
        updateStatus("Conversation started", "fas fa-play");
        startListening();
    } else {
        // Pause conversation
        conversationActive = false;
        isListening = false;
        isProcessing = false;
        startBtn.innerHTML = '<i class="fas fa-play"></i> Start Conversation';
        startBtn.classList.remove('btn-danger');
        startBtn.classList.add('btn-primary');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        recordingIndicator.classList.remove("active");
        updateStatus("Conversation paused", "fas fa-pause");
        
        // Stop any active recording
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }
});

// Stop button (emergency stop)
stopBtn.addEventListener("click", () => {
    stopListening();
    isProcessing = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateStatus("Stopped", "fas fa-stop");
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('button, input, textarea')) {
        e.preventDefault();
        startBtn.click();
    }
});

// Add visual feedback for audio player
aiAudio.addEventListener('play', () => {
    updateStatus("Playing AI response", "fas fa-volume-up");
});

aiAudio.addEventListener('ended', () => {
    if (conversationActive) {
        updateStatus("Ready to listen", "fas fa-circle");
    }
});

// Add hover effects for better UX
startBtn.addEventListener('mouseenter', () => {
    if (!startBtn.disabled) {
        startBtn.style.transform = 'translateY(-4px) scale(1.02)';
    }
});

startBtn.addEventListener('mouseleave', () => {
    startBtn.style.transform = '';
});

stopBtn.addEventListener('mouseenter', () => {
    if (!stopBtn.disabled) {
        stopBtn.style.transform = 'translateY(-4px) scale(1.02)';
    }
});

stopBtn.addEventListener('mouseleave', () => {
    stopBtn.style.transform = '';
});
