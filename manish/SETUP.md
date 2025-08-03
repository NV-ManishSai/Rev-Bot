# 🚀 Setup Guide - Revolt Motors Voice Assistant

## Quick Setup

### 1. Environment Configuration

Create a `.env` file in the root directory with the following content:

```env
# Required: Google Gemini API Key
# Get your API key from: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional: Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Debug Configuration
DEBUG=false
LOG_LEVEL=info

# Optional: Audio Configuration
AUDIO_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
AUDIO_BIT_DEPTH=16

# Optional: Voice Detection Configuration
VAD_SILENCE_THRESHOLD=2000
VAD_MIN_RECORDING_TIME=800
VAD_VOICE_LEVEL_THRESHOLD=10

# Optional: AI Configuration
AI_TIMEOUT_BACKEND=15000
AI_TIMEOUT_FRONTEND=20000
AI_MAX_CONTEXT_TURNS=10
```

### 2. Google Gemini API Setup

#### Step 1: Get API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

#### Step 2: Enable Gemini Live
1. Ensure your API key has access to Gemini Live features
2. The API supports real-time audio conversations
3. Check your API quota and limits

### 3. Installation Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Or use nodemon for auto-restart
npm run dev
```

### 4. Browser Setup

#### Microphone Permissions
1. Open `http://localhost:3000`
2. Allow microphone access when prompted
3. Test microphone in browser settings

#### Browser Compatibility
- ✅ Chrome 88+ (Recommended)
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Edge 88+

### 5. Testing

#### Basic Test
1. Click the microphone button
2. Say "Hello, how are you?"
3. Wait for AI response
4. Ask a follow-up question

#### Advanced Test
1. Start conversation
2. Use stop button during AI response
3. Test keyboard shortcuts (Space, Escape)
4. Verify continuous conversation flow

## Troubleshooting

### Common Issues

#### "Cannot access microphone"
```bash
# Check browser permissions
chrome://settings/content/microphone

# Test microphone
navigator.mediaDevices.getUserMedia({ audio: true })
```

#### "No response from AI"
```bash
# Check API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models

# Check server logs
npm start
```

#### "Connection lost"
```bash
# Check server status
curl http://localhost:3000

# Restart server
npm start
```

### Debug Mode

Enable detailed logging:

```env
DEBUG=true
LOG_LEVEL=verbose
```

### Performance Tuning

#### Audio Settings
```env
# For better voice detection
VAD_SILENCE_THRESHOLD=1500
VAD_MIN_RECORDING_TIME=600
VAD_VOICE_LEVEL_THRESHOLD=8

# For faster responses
AI_TIMEOUT_BACKEND=10000
AI_TIMEOUT_FRONTEND=15000
```

#### Server Settings
```env
# For production
NODE_ENV=production
PORT=3000
```

## Production Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=3000
GOOGLE_API_KEY=your_production_key
DEBUG=false
LOG_LEVEL=warn
```

### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name "voice-assistant"
pm2 startup
pm2 save
```

### HTTPS Setup
```bash
# SSL certificates
# Reverse proxy (nginx/apache)
# WebSocket proxy
```

## Support

- **Documentation**: Check README.md
- **Issues**: GitHub Issues
- **Community**: Discussion forum

---

*Happy coding! 🏍️* 