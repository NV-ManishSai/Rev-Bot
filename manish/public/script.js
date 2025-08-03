const micButton = document.getElementById("micButton");
const stopButton = document.getElementById("stopButton");
const statusEl = document.getElementById("status");
const aiAudio = document.getElementById("aiAudio");
const conversationIndicator = document.getElementById("conversationIndicator");

let ws, mediaRecorder, audioChunks = [];
let isListening = false;
let isProcessing = false;
let conversationActive = false;
let userHasInteracted = false; // Track if user has interacted
let audioContext = null; // Global audio context
let currentAudioElement = null; // Track current playing audio
let isInterrupting = false; // Track if user is interrupting
let currentStream = null; // Track current audio stream

// Initialize audio context on first user interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Audio context initialized");
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
        console.log("Audio context resumed");
    }
}

// Connect to backend WS
function connectWS() {
    ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onopen = () => {
        console.log("Connected to backend WebSocket");
        if (conversationActive) {
            console.log("WebSocket reconnected during active conversation");
            updateStatus("Listening...", "fas fa-microphone");
        } else {
            updateStatus("Click to talk to Rev", "fas fa-microphone");
        }
    };
    
    // WebSocket message handler
    ws.onmessage = (event) => {
        console.log("Received message from backend");
        
        // Check if it's a JSON message (control/error message)
        if (typeof event.data === 'string') {
            try {
                const data = JSON.parse(event.data);
                if (data.error) {
                    console.error("Backend error:", data.error);
                    updateStatus("Error: " + data.error, "fas fa-exclamation-triangle");
                    isProcessing = false;
                    micButton.disabled = false;
                    micButton.classList.remove("processing");
                } else if (data.type === "autoRestart") {
                    // Auto-restart listening for continuous conversation
                    console.log("🔄 Auto-restart signal received:", data.message);
                    setTimeout(() => {
                        if (conversationActive && !isListening && !isProcessing) {
                            console.log("🔄 Auto-restarting listening...");
                            updateStatus("Listening for next question...", "fas fa-microphone");
                            startListening();
                        }
                    }, 300); // Very quick restart
                } else if (data.type === "error") {
                    // Handle AI response errors
                    console.error("AI response error:", data.error);
                    updateStatus("AI error - please try again", "fas fa-exclamation-triangle");
                    isProcessing = false;
                    micButton.disabled = false;
                    micButton.classList.remove("processing");
                    
                                            // Auto-restart listening after error
                        setTimeout(() => {
                            if (conversationActive && !isListening && !isProcessing) {
                                console.log("🔄 Auto-restarting after error...");
                                updateStatus("Listening for next question...", "fas fa-microphone");
                                startListening();
                            }
                        }, 1000);
                }
                return; // Don't process as audio
            } catch (e) {
                console.log("Non-JSON string message:", event.data);
            }
        }
        
        // Handle binary audio data
        console.log("Received audio from backend, data size:", event.data.size || event.data.byteLength);
        console.log("Data type:", typeof event.data);
        console.log("Data constructor:", event.data.constructor.name);
        const audioData = event.data;
        const blob = new Blob([audioData], { type: "audio/wav" });
        console.log("Created audio blob, size:", blob.size);
        console.log("Blob type:", blob.type);

        // Create new audio element for each response
        const newAudio = new Audio();
        newAudio.style.display = 'none';
        newAudio.preload = 'auto';
        document.body.appendChild(newAudio);
        
        // Store reference to current audio element
        currentAudioElement = newAudio;

        newAudio.onloadeddata = () => {
            console.log("Audio loaded, starting playback");
            newAudio.volume = 1.0;

            // Optimize for low latency - start playback immediately
            const playPromise = newAudio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log("Audio playback started successfully");
                }).catch(error => {
                    console.error("Error playing audio:", error);
                    // Fallback to AudioContext for better compatibility
                    if (!audioContext) {
                        audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (audioContext.state === 'suspended') {
                        audioContext.resume();
                    }
                    blob.arrayBuffer().then(arrayBuffer => {
                        audioContext.decodeAudioData(arrayBuffer).then(buffer => {
                            const source = audioContext.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioContext.destination);
                            source.start(0);
                            console.log("Audio played via AudioContext");
                        }).catch(decodeError => {
                            console.error("Audio decode error:", decodeError);
                            updateStatus("Error playing AI response", "fas fa-exclamation-triangle");
                        });
                    }).catch(blobError => {
                        console.error("Blob to ArrayBuffer error:", blobError);
                        // Show manual play button as last resort
                        newAudio.controls = true;
                        newAudio.style.display = 'block';
                        newAudio.style.position = 'fixed';
                        newAudio.style.top = '10px';
                        newAudio.style.left = '10px';
                        newAudio.style.zIndex = '9999';
                        newAudio.style.backgroundColor = 'rgba(0,0,0,0.8)';
                        newAudio.style.borderRadius = '8px';
                        newAudio.style.padding = '10px';
                        updateStatus("Click play button to hear AI response", "fas fa-play");
                        setTimeout(() => {
                            if (newAudio.parentNode) {
                                newAudio.style.display = 'none';
                                newAudio.controls = false;
                            }
                        }, 15000);
                    });
                });
            }
        };
        
        // Handle interruption - if user starts speaking while AI is talking
        newAudio.onplay = () => {
            console.log("AI audio started playing");
            updateStatus("AI is speaking...", "fas fa-robot");
            micButton.classList.remove("listening", "processing");
            isInterrupting = false; // Reset interruption flag
            // Enable interruption detection
            micButton.addEventListener('click', handleInterruption, { once: true });
        };
        
        newAudio.onended = () => {
            console.log("=== AI AUDIO FINISHED ===");
            console.log("Conversation state:", { conversationActive, isInterrupting, isListening, isProcessing });
            console.log("Audio duration:", newAudio.duration);
            console.log("Current time:", newAudio.currentTime);
            
            if (newAudio.parentNode) {
                document.body.removeChild(newAudio);
            }
            currentAudioElement = null;
            
            // Reset processing state
            isProcessing = false;
            micButton.disabled = false;
            micButton.classList.remove("processing");
            
                    // Ensure we're ready for the next interaction
        if (conversationActive && !isInterrupting) {
            console.log("AI response finished, preparing for follow-up question...");
            updateStatus("Listening...", "fas fa-microphone");
            
            // Simple and reliable follow-up logic
            setTimeout(() => {
                console.log("Starting listening for follow-up question...");
                // Reset any stuck states
                isListening = false;
                isProcessing = false;
                micButton.disabled = false;
                micButton.classList.remove("processing");
                
                // Ensure audio context is ready
                if (audioContext && audioContext.state === 'suspended') {
                    console.log("Resuming audio context...");
                    audioContext.resume();
                }
                
                                            // Start listening for follow-up
                if (conversationActive) {
                    console.log("🎯 Starting listening for follow-up question...");
                    updateStatus("Ready for your next question...", "fas fa-microphone");
                    startListening();
                } else {
                    console.log("Conversation no longer active, not starting listening");
                    updateStatus("Conversation ended", "fas fa-stop");
                }
            }, 800); // Slightly faster response for better UX
        } else {
            console.log("Not starting follow-up listening - conversation not active or interrupting");
        }
        };
        
        newAudio.onpause = () => {
            console.log("AI audio paused");
            if (newAudio.parentNode) {
                document.body.removeChild(newAudio);
            }
            currentAudioElement = null;
            
            // Reset processing state
            isProcessing = false;
            micButton.disabled = false;
            micButton.classList.remove("processing");
            
            if (conversationActive && !isInterrupting) {
                updateStatus("Ready to listen...", "fas fa-microphone");
            }
        };
        
        newAudio.onerror = (error) => {
            console.error("Audio error:", error);
            console.error("Audio error details:", newAudio.error);
            updateStatus("Error playing AI response", "fas fa-exclamation-triangle");
            if (newAudio.parentNode) {
                document.body.removeChild(newAudio);
            }
            currentAudioElement = null;
            
            // Reset processing state
            isProcessing = false;
            micButton.disabled = false;
            micButton.classList.remove("processing");
            
            if (conversationActive && !isInterrupting) {
                setTimeout(() => {
                    if (conversationActive && !isInterrupting) {
                        updateStatus("Ready to listen...", "fas fa-microphone");
                        setTimeout(() => {
                            if (conversationActive && !isInterrupting) {
                                startListening();
                            }
                        }, 300);
                    }
                }, 1000);
            }
        };
        
        newAudio.src = URL.createObjectURL(blob);
        console.log("Audio source set, loading...");
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        updateStatus("Connection error. Please refresh.", "fas fa-exclamation-triangle");
        micButton.classList.remove("listening", "processing");
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed");
        
        // Only show error if conversation is not active
        if (!conversationActive) {
            updateStatus("Connection lost. Please refresh.", "fas fa-exclamation-triangle");
            micButton.classList.remove("listening", "processing");
        } else {
            console.log("Connection closed during active conversation, attempting to reconnect...");
                                        // Try to reconnect immediately if conversation is active
                            setTimeout(() => {
                                if (conversationActive) {
                                    console.log("Reconnecting WebSocket for active conversation...");
                                    connectWS();
                                    // Resume listening after reconnection
                                    setTimeout(() => {
                                        if (conversationActive && !isListening && !isProcessing) {
                                            console.log("Resuming listening after reconnection...");
                                            startListening();
                                        }
                                    }, 1000);
                                }
                            }, 500); // Faster reconnection for active conversations
        }
    };
}

// Update status function
function updateStatus(message, iconClass) {
    const statusElement = document.getElementById("status");
    const icon = statusElement.querySelector("i");
    
    // Remove all status classes
    statusElement.classList.remove("listening", "processing", "speaking", "error", "interrupting");
    
    // Add appropriate class based on message
    if (message.includes("Listening") || message.includes("Interrupted")) {
        statusElement.classList.add("listening");
        if (message.includes("Interrupted")) {
            statusElement.classList.add("interrupting");
        }
    } else if (message.includes("speaking") || message.includes("AI is")) {
        statusElement.classList.add("speaking");
    } else if (message.includes("Error")) {
        statusElement.classList.add("error");
    } else if (message.includes("processing")) {
        statusElement.classList.add("processing");
    }
    
    icon.className = iconClass;
    statusElement.innerHTML = icon.outerHTML + " " + message;
}

// Reset conversation state function
function resetConversationState() {
    isListening = false;
    isProcessing = false;
    isInterrupting = false;
    micButton.disabled = false;
    micButton.classList.remove("listening", "processing", "interrupting", "conversation-active", "voice-detected");
    conversationIndicator.style.display = "none";
    
    // Stop any active recording
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }
    
    // Stop any playing audio
    if (currentAudioElement && !currentAudioElement.paused) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
    }
    
    // Stop any active stream
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// Start listening function
async function startListening() {
    console.log("startListening called, current state:", { isListening, isProcessing, conversationActive });
    
    // Simple state check
    if (isListening) {
        console.log("Already listening, skipping");
        return;
    }
    
    if (isProcessing) {
        console.log("Still processing, skipping");
        return;
    }
    
    try {
        console.log("Starting listening process...");
        isListening = true;
        updateStatus("Listening...", "fas fa-microphone");
        micButton.classList.add("listening");
        micButton.disabled = true;

        // Ensure connection is ready
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.log("WebSocket not ready, connecting...");
            connectWS();
            await new Promise(resolve => {
                const checkConnection = () => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        console.log("WebSocket connection established");
                        resolve();
                    } else {
                        setTimeout(checkConnection, 100);
                    }
                };
                checkConnection();
            });
        } else {
            console.log("WebSocket connection is ready");
        }

        // Stop any existing stream
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        currentStream = stream;
                                mediaRecorder = new MediaRecorder(stream, {
                            mimeType: 'audio/webm;codecs=opus'
                        });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        
                        // Dynamic voice activity detection for continuous conversation
                let silenceTimer;
                let hasSpoken = false;
                let voiceStartTime = null;
                let silenceThreshold = 2000; // 2 seconds of silence to stop
                let minRecordingTime = 800; // Minimum 0.8 second recording
                let recordingStartTime = Date.now();
                let voiceLevelThreshold = 10; // Minimum audio level to consider as voice
        
        mediaRecorder.onstart = () => {
            console.log("Started recording, monitoring audio levels");
            recordingStartTime = Date.now();
            hasSpoken = false;
            
            // Start monitoring audio levels
            const recordingAudioContext = new AudioContext();
            const source = recordingAudioContext.createMediaStreamSource(stream);
            const analyser = recordingAudioContext.createAnalyser();
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const checkAudioLevel = () => {
                if (!isListening) {
                    recordingAudioContext.close();
                    return;
                }
                
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const recordingDuration = Date.now() - recordingStartTime;
                
                // Dynamic voice activity detection
                if (average > voiceLevelThreshold) {
                    if (!hasSpoken) {
                        // Voice detected - start capturing immediately
                        hasSpoken = true;
                        voiceStartTime = Date.now();
                        console.log("🎤 Voice detected! Starting to capture audio...");
                        updateStatus("Voice detected, listening...", "fas fa-microphone");
                        micButton.classList.add("voice-detected");
                    }
                    
                    // Clear any existing silence timer
                    if (silenceTimer) {
                        clearTimeout(silenceTimer);
                        silenceTimer = null;
                    }
                } else if (hasSpoken && average < voiceLevelThreshold) {
                    // Voice stopped, start silence timer
                    if (!silenceTimer) {
                        silenceTimer = setTimeout(() => {
                            if (isListening) {
                                const voiceDuration = voiceStartTime ? Date.now() - voiceStartTime : 0;
                                console.log(`🔇 Silence detected after ${voiceDuration}ms of voice`);
                                
                                // Only stop if we have enough voice content
                                if (voiceDuration >= minRecordingTime) {
                                    console.log("✅ Sufficient voice detected, stopping recording");
                                    micButton.classList.remove("voice-detected");
                                    stopListening();
                                } else {
                                    console.log("⏳ Voice too short, continuing to listen...");
                                    hasSpoken = false;
                                    voiceStartTime = null;
                                }
                            }
                        }, silenceThreshold);
                    }
                }
                
                requestAnimationFrame(checkAudioLevel);
            };
            
            checkAudioLevel();
        };
        
        mediaRecorder.start();
        
            } catch (error) {
            console.error("Error starting recording:", error);
            updateStatus("Microphone access denied. Please allow microphone permissions.", "fas fa-exclamation-triangle");
            isListening = false;
            micButton.disabled = false;
            micButton.classList.remove("listening", "processing");
        }
}

// Function to handle interruption
function handleInterruption() {
    console.log("User interruption detected");
    isInterrupting = true;
    
    // Add visual feedback
    micButton.classList.add("interrupting");
    updateStatus("Interrupted - Listening...", "fas fa-microphone");
    
    // Stop current AI audio if playing
    if (currentAudioElement && !currentAudioElement.paused) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        if (currentAudioElement.parentNode) {
            document.body.removeChild(currentAudioElement);
        }
        currentAudioElement = null;
    }
    
    // Remove interruption styling after a short delay
    setTimeout(() => {
        micButton.classList.remove("interrupting");
    }, 1000);
    
    // Start listening immediately
    setTimeout(() => {
        if (conversationActive) {
            startListening();
        }
    }, 100); // Very short delay for interruption
}

// Function to handle stop button click
function handleStop() {
    console.log("Stop button clicked - interrupting AI");
    isInterrupting = true;
    
    // Stop current AI audio if playing
    if (currentAudioElement && !currentAudioElement.paused) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        if (currentAudioElement.parentNode) {
            document.body.removeChild(currentAudioElement);
        }
        currentAudioElement = null;
    }
    
    // Reset processing state
    isProcessing = false;
    micButton.disabled = false;
    micButton.classList.remove("processing");
    
    // Update status
    updateStatus("Stopped - Ready to listen", "fas fa-microphone");
    
    // Start listening immediately if conversation is active
    setTimeout(() => {
        if (conversationActive) {
            startListening();
        }
    }, 300);
}

// Stop listening function - but keep ready for next input
function stopListening() {
    if (!isListening) return;
    
    isListening = false;
    isProcessing = true;
    micButton.classList.remove("listening", "voice-detected");
    micButton.classList.add("processing");
    
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
                console.log("Sending audio to backend...");
                console.log("Audio data size:", base64Audio.length);
                ws.send(JSON.stringify({ realtimeInput: { audio: base64Audio } }));
                updateStatus("Awaiting AI response...", "fas fa-spinner fa-spin");
                
                // Set frontend timeout for AI response
                const frontendTimeout = setTimeout(() => {
                    if (isProcessing) {
                        console.log("⚠️ Frontend timeout - AI response taking too long");
                        updateStatus("Response timeout - please try again", "fas fa-exclamation-triangle");
                        isProcessing = false;
                        micButton.disabled = false;
                        micButton.classList.remove("processing");
                        
                        // Auto-restart listening after timeout
                        setTimeout(() => {
                            if (conversationActive && !isListening && !isProcessing) {
                                console.log("🔄 Auto-restarting after timeout...");
                                updateStatus("Listening for next question...", "fas fa-microphone");
                                startListening();
                            }
                        }, 1000);
                    }
                }, 20000); // 20 second timeout
                
                // Clear timeout when audio starts playing
                const originalOnloadeddata = newAudio.onloadeddata;
                newAudio.onloadeddata = () => {
                    clearTimeout(frontendTimeout);
                    if (originalOnloadeddata) originalOnloadeddata();
                };
            } else {
                console.log("WebSocket not ready, attempting to reconnect...");
                connectWS();
                setTimeout(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        console.log("Reconnected, sending audio...");
                        ws.send(JSON.stringify({ realtimeInput: { audio: base64Audio } }));
                        updateStatus("Awaiting AI response...", "fas fa-spinner fa-spin");
                    } else {
                        console.log("Failed to reconnect, showing error");
                        updateStatus("Connection lost. Please refresh.", "fas fa-exclamation-triangle");
                        isProcessing = false;
                        micButton.disabled = false;
                        micButton.classList.remove("listening", "processing");
                    }
                }, 1000);
            }
        };
    }
}

// Initialize WebSocket connection when page loads
connectWS();

// Mark user interaction for autoplay
document.addEventListener('click', () => {
    userHasInteracted = true;
    initAudioContext(); // Initialize audio context on any click
});

// Test audio function
function testAudio() {
    console.log("Testing audio playback...");
    const testAudio = new Audio();
    testAudio.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT";
    testAudio.volume = 1.0;
    testAudio.play().then(() => {
        console.log("Test audio played successfully");
        updateStatus("Audio test successful", "fas fa-check");
    }).catch(error => {
        console.error("Test audio failed:", error);
        updateStatus("Audio test failed", "fas fa-exclamation-triangle");
    });
}

// Mic button click handler - ChatGPT-like behavior
let clickCount = 0;
let clickTimer;
let longPressTimer;
let isLongPress = false;

micButton.addEventListener("mousedown", () => {
    longPressTimer = setTimeout(() => {
        isLongPress = true;
        // Long press to stop conversation
        if (conversationActive) {
                            conversationActive = false;
                resetConversationState();
                updateStatus("Conversation ended. Click to talk to Rev again.", "fas fa-stop");
        }
    }, 1000); // 1 second long press to stop
});

micButton.addEventListener("mouseup", () => {
    clearTimeout(longPressTimer);
    if (isLongPress) {
        isLongPress = false;
        return;
    }
    
    // Single click behavior
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        if (clickCount === 1) {
            userHasInteracted = true;
            initAudioContext();
            
            // Check if AI is currently speaking
            if (currentAudioElement && !currentAudioElement.paused) {
                // User is interrupting the AI
                handleInterruption();
                return;
            }
            
            if (!conversationActive) {
                // Start continuous conversation
                conversationActive = true;
                micButton.classList.add("conversation-active");
                conversationIndicator.style.display = "flex";
                updateStatus("Starting conversation...", "fas fa-play");
                startListening();
            }
            // Note: No else clause - conversation stays active until long press
        } else if (clickCount === 2) {
            userHasInteracted = true;
            initAudioContext();
            testAudio();
        }
        clickCount = 0;
    }, 300);
});

// Handle touch events for mobile
micButton.addEventListener("touchstart", (e) => {
    e.preventDefault();
    longPressTimer = setTimeout(() => {
        isLongPress = true;
        // Long press to stop conversation
        if (conversationActive) {
            conversationActive = false;
            resetConversationState();
            updateStatus("Conversation ended. Click to talk to Rev again.", "fas fa-stop");
        }
    }, 1000);
});

micButton.addEventListener("touchend", (e) => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    if (isLongPress) {
        isLongPress = false;
        return;
    }
    
    // Single tap behavior
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        if (clickCount === 1) {
            userHasInteracted = true;
            initAudioContext();
            
            // Check if AI is currently speaking
            if (currentAudioElement && !currentAudioElement.paused) {
                // User is interrupting the AI
                handleInterruption();
                return;
            }
            
            if (!conversationActive) {
                // Start continuous conversation
                conversationActive = true;
                micButton.classList.add("conversation-active");
                conversationIndicator.style.display = "flex";
                updateStatus("Starting conversation...", "fas fa-play");
                startListening();
            }
        } else if (clickCount === 2) {
            userHasInteracted = true;
            initAudioContext();
            testAudio();
        }
        clickCount = 0;
    }, 300);
});

// Add event listener for stop button
stopButton.addEventListener('click', handleStop);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('button, input, textarea')) {
        e.preventDefault();
        micButton.click();
    }
    
    // Stop button shortcut
    if (e.code === 'Escape') {
        e.preventDefault();
        handleStop();
    }
    
    // Manual trigger for testing follow-up listening
    if (e.code === 'KeyL' && conversationActive && !isListening && !isProcessing) {
        console.log("Manual trigger: Starting listening...");
        startListening();
    }
    
    // Manual trigger for testing voice detection
    if (e.code === 'KeyV' && isListening) {
        console.log("Manual trigger: Testing voice detection...");
        // Simulate voice detection
        hasSpoken = true;
        voiceStartTime = Date.now();
        console.log("🎤 Manual voice detection triggered!");
    }
    
    // Manual trigger for conversation reset
    if (e.code === 'KeyR' && conversationActive) {
        console.log("Manual trigger: Resetting conversation...");
        conversationActive = false;
        resetConversationState();
        updateStatus("Conversation reset. Click to start again.", "fas fa-refresh");
    }
});

// Add hover effects for better UX
micButton.addEventListener('mouseenter', () => {
    if (!micButton.disabled) {
        micButton.style.transform = 'translateY(-4px) scale(1.05)';
    }
});

micButton.addEventListener('mouseleave', () => {
    micButton.style.transform = '';
});
