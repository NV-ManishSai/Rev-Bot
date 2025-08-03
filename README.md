# 🏍️ Revolt Motors Voice Assistant

A professional voice assistant powered by Google Gemini Live API, designed for seamless voice conversations with a modern black theme and motorcycle branding.

## ✨ Features

### 🎤 Voice Interaction
- **Continuous Conversation**: Single click to start, automatic follow-up listening
- **Real-time Voice Processing**: Dynamic voice activity detection (VAD)
- **Seamless Experience**: Smooth transitions between user input and AI responses
- **Interruption Support**: Stop AI mid-response and continue conversation

### 🎛️ User Controls
- **Physical Stop Button**: Always-available red stop button to interrupt AI
- **Keyboard Shortcuts**: Space to start/stop, Escape to stop AI
- **Visual Feedback**: Real-time status updates and button states
- **Professional UI**: Modern black theme with Revolt Motors branding

### 🤖 AI Capabilities
- **Context Awareness**: Maintains conversation history for follow-up questions
- **Natural Responses**: Conversational AI powered by Google Gemini
- **Audio Generation**: High-quality voice responses in real-time
- **Smart Processing**: Handles interruptions and conversation flow

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key
- Modern web browser with microphone access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd manish
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file and add your Google Gemini API key:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Google Gemini API Key
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional: Server Configuration
PORT=3000
NODE_ENV=development
```

### Google Gemini API Setup

1. **Get API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to your `.env` file

2. **Enable Gemini Live API**:
   - Ensure your API key has access to Gemini Live features
   - The API supports real-time audio conversations

## 🎮 Usage Guide

### Starting a Conversation

1. **Click the microphone button** to start
2. **Speak your question** clearly
3. **Wait for AI response** (visual feedback shows status)
4. **Ask follow-up questions** automatically

### Controls

#### 🎤 Microphone Button
- **Click once**: Start conversation
- **During AI response**: Click to interrupt
- **Visual states**: 
  - 🔵 Blue: Ready to listen
  - 🟢 Green: Listening
  - 🟡 Yellow: Processing
  - 🔴 Red: Interrupting

#### 🛑 Stop Button
- **Always visible**: Red circular button
- **Click anytime**: Stop AI immediately
- **Auto restart**: Starts listening after stop

#### ⌨️ Keyboard Shortcuts
- **Space**: Toggle microphone (start/stop)
- **Escape**: Stop AI response
- **L**: Manual listen trigger
- **V**: Test voice detection
- **R**: Reset conversation

### Conversation Flow

```
1. Click Mic → Start listening
2. Speak → Voice detected
3. Processing → AI thinking
4. AI Response → Playing audio
5. Auto Listen → Ready for follow-up
6. Repeat → Continuous conversation
```

## 🏗️ Project Structure

```
manish/
├── public/
│   ├── index.html          # Frontend UI
│   └── script.js           # Client-side logic
├── server.js               # Backend server
├── config.js               # AI configuration
├── package.json            # Dependencies
├── .env                    # Environment variables
└── README.md              # This file
```

## 🔧 Technical Details

### Backend (Node.js + Express)
- **WebSocket Server**: Real-time communication
- **Audio Processing**: FFmpeg for WebM to PCM conversion
- **Gemini Integration**: WebSocket connection to Google AI
- **Client Management**: Individual connections per user

### Frontend (Vanilla JavaScript)
- **MediaRecorder API**: Audio capture
- **WebSocket Client**: Real-time communication
- **Voice Activity Detection**: Dynamic speech detection
- **Audio Playback**: Seamless AI response playback

### AI Configuration
- **Model**: Google Gemini Live
- **Context Management**: Last 10 conversation turns
- **Response Timeout**: 15 seconds backend, 20 seconds frontend
- **Audio Format**: PCM 24kHz

## 🎨 Customization

### Branding
Edit `public/index.html` to customize:
- **Logo**: Change motorcycle icon
- **Company Name**: Update "Talk to Rev"
- **Colors**: Modify CSS variables
- **Theme**: Adjust black theme colors

### AI Personality
Edit `config.js` to customize:
- **System Prompt**: AI behavior and responses
- **Temperature**: Response creativity (0.0-1.0)
- **Max Tokens**: Response length
- **Context Length**: Conversation memory

### Voice Detection
Edit `public/script.js` to adjust:
- **Silence Threshold**: Time before stopping recording
- **Voice Level**: Minimum audio level to detect speech
- **Recording Time**: Minimum/maximum recording duration

## 🐛 Troubleshooting

### Common Issues

#### "Cannot access microphone"
- **Solution**: Allow microphone access in browser
- **Check**: Browser permissions for localhost:3000
- **Test**: Visit `chrome://settings/content/microphone`

#### "No response from AI"
- **Check**: Google API key is valid
- **Verify**: API key has Gemini Live access
- **Test**: Check browser console for errors

#### "Audio not playing"
- **Check**: Browser audio permissions
- **Test**: Try different browser
- **Verify**: Audio context is resumed

#### "Connection lost"
- **Check**: Internet connection
- **Restart**: Refresh page and try again
- **Verify**: Server is running on port 3000

### Debug Mode

Enable detailed logging by adding to `.env`:
```env
DEBUG=true
LOG_LEVEL=verbose
```

### Performance Optimization

For better performance:
1. **Use HTTPS**: Secure connections improve WebSocket stability
2. **Optimize Audio**: Adjust VAD parameters for your environment
3. **Monitor Resources**: Check CPU/memory usage during conversations

## 📱 Browser Compatibility

### Supported Browsers
- ✅ Chrome 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Edge 88+

### Required Features
- WebSocket support
- MediaRecorder API
- AudioContext API
- Microphone access

## 🔒 Security Considerations

### API Key Security
- **Never commit**: `.env` file to version control
- **Use environment variables**: For production deployment
- **Rotate keys**: Regularly update API keys
- **Monitor usage**: Track API call limits

### Audio Privacy
- **Local processing**: Audio processed on your server
- **No storage**: Audio not saved permanently
- **Secure transmission**: WebSocket over HTTPS recommended

## 🚀 Deployment

### Production Setup

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=3000
   GOOGLE_API_KEY=your_production_key
   ```

2. **HTTPS Setup** (Recommended)
   ```bash
   # Add SSL certificates
   # Configure reverse proxy (nginx/apache)
   # Enable WebSocket proxy
   ```

3. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name "voice-assistant"
   pm2 startup
   pm2 save
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check this README first
- **Community**: Join our discussion forum

## 🎯 Roadmap

### Planned Features
- [ ] Multi-language support
- [ ] Voice customization
- [ ] Conversation history
- [ ] Mobile app
- [ ] Integration APIs
- [ ] Analytics dashboard

### Performance Improvements
- [ ] Audio compression
- [ ] Connection pooling
- [ ] Caching layer
- [ ] Load balancing

---

**Built with ❤️ for Revolt Motors**

*Experience the future of voice interaction with our AI-powered assistant.* 
