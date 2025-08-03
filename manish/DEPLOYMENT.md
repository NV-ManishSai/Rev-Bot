# 🚀 Deployment Guide - Revolt Motors Voice Assistant

## 🎯 Deployment Options

### 1. **Render** (Recommended - Free Tier)
### 2. **Railway** (Easy - Free Tier)
### 3. **Heroku** (Popular - Paid)
### 4. **DigitalOcean** (VPS - Paid)
### 5. **Vercel** (Frontend + Backend - Free Tier)

---

## 🌟 **Option 1: Render (Recommended)**

### **Why Render?**
- ✅ **Free Tier**: 750 hours/month
- ✅ **Easy Setup**: Git integration
- ✅ **Auto Deploy**: Push to deploy
- ✅ **HTTPS**: Automatic SSL
- ✅ **WebSocket Support**: Perfect for voice assistant

### **Step-by-Step Deployment**

#### 1. **Prepare Your Code**
```bash
# Ensure your code is in a Git repository
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

#### 2. **Create Render Account**
1. Visit [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your repository

#### 3. **Create New Web Service**
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure settings:

```yaml
Name: revolt-voice-assistant
Environment: Node
Build Command: npm install
Start Command: npm start
Plan: Free
```

#### 4. **Environment Variables**
Add these in Render dashboard:
```env
NODE_ENV=production
PORT=10000
GOOGLE_API_KEY=your_gemini_api_key_here
```

#### 5. **Deploy**
- Click "Create Web Service"
- Wait for build to complete
- Your app will be live at: `https://your-app-name.onrender.com`

---

## 🚂 **Option 2: Railway**

### **Why Railway?**
- ✅ **Free Tier**: $5 credit monthly
- ✅ **Simple**: One-click deploy
- ✅ **Fast**: Quick deployments
- ✅ **Git Integration**: Automatic updates

### **Deployment Steps**

#### 1. **Railway Setup**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

#### 2. **Deploy to Railway**
```bash
# Initialize Railway project
railway init

# Deploy your app
railway up
```

#### 3. **Set Environment Variables**
```bash
railway variables set GOOGLE_API_KEY=your_gemini_api_key_here
railway variables set NODE_ENV=production
```

#### 4. **Get Your URL**
```bash
railway domain
```

---

## 🎪 **Option 3: Heroku**

### **Why Heroku?**
- ✅ **Popular**: Well-established platform
- ✅ **Add-ons**: Rich ecosystem
- ✅ **Scaling**: Easy to scale
- ❌ **Paid**: No free tier anymore

### **Deployment Steps**

#### 1. **Install Heroku CLI**
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Windows
# Download from: https://devcenter.heroku.com/articles/heroku-cli
```

#### 2. **Create Heroku App**
```bash
# Login to Heroku
heroku login

# Create new app
heroku create your-app-name

# Add Git remote
heroku git:remote -a your-app-name
```

#### 3. **Set Environment Variables**
```bash
heroku config:set GOOGLE_API_KEY=your_gemini_api_key_here
heroku config:set NODE_ENV=production
```

#### 4. **Deploy**
```bash
git push heroku main
```

#### 5. **Open App**
```bash
heroku open
```

---

## 🐳 **Option 4: DigitalOcean App Platform**

### **Why DigitalOcean?**
- ✅ **Reliable**: Enterprise-grade infrastructure
- ✅ **Scalable**: Easy scaling options
- ✅ **Cost-effective**: Reasonable pricing
- ✅ **Full Control**: Complete server access

### **Deployment Steps**

#### 1. **Create DigitalOcean Account**
1. Visit [digitalocean.com](https://digitalocean.com)
2. Sign up and add payment method
3. Navigate to App Platform

#### 2. **Create App**
1. Click "Create App"
2. Connect your GitHub repository
3. Configure build settings:

```yaml
Build Command: npm install
Run Command: npm start
```

#### 3. **Environment Variables**
Add in DigitalOcean dashboard:
```env
NODE_ENV=production
GOOGLE_API_KEY=your_gemini_api_key_here
```

#### 4. **Deploy**
- Click "Create Resources"
- Wait for deployment
- Your app will be live

---

## ⚡ **Option 5: Vercel**

### **Why Vercel?**
- ✅ **Free Tier**: Generous limits
- ✅ **Fast**: Global CDN
- ✅ **Easy**: Git integration
- ✅ **Modern**: Built for modern apps

### **Deployment Steps**

#### 1. **Install Vercel CLI**
```bash
npm install -g vercel
```

#### 2. **Deploy**
```bash
# Login to Vercel
vercel login

# Deploy your app
vercel

# Follow prompts:
# - Set up and deploy: Yes
# - Which scope: Your account
# - Link to existing project: No
# - Project name: revolt-voice-assistant
# - Directory: ./
# - Override settings: No
```

#### 3. **Environment Variables**
```bash
vercel env add GOOGLE_API_KEY
# Enter your API key when prompted
```

#### 4. **Redeploy with Environment**
```bash
vercel --prod
```

---

## 🔧 **Pre-Deployment Checklist**

### **Code Preparation**
- [ ] **Environment Variables**: Create `.env` file
- [ ] **Git Repository**: Code is in Git
- [ ] **Dependencies**: All in `package.json`
- [ ] **Port Configuration**: Uses `process.env.PORT`
- [ ] **Error Handling**: Proper error handling
- [ ] **Logging**: Production-ready logging

### **Security**
- [ ] **API Key**: Secure environment variable
- [ ] **HTTPS**: Platform provides SSL
- [ ] **CORS**: Configure if needed
- [ ] **Rate Limiting**: Consider adding

### **Performance**
- [ ] **Compression**: Enable gzip
- [ ] **Caching**: Static file caching
- [ ] **Monitoring**: Add health checks
- [ ] **Logging**: Production logging

---

## 📋 **Required Files for Deployment**

### **package.json** (Already exists)
```json
{
  "name": "revolt-voice-assistant",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.13.0",
    "fluent-ffmpeg": "^2.1.2",
    "dotenv": "^16.3.1"
  }
}
```

### **server.js** (Already exists)
- ✅ WebSocket server
- ✅ Express static files
- ✅ Environment variables
- ✅ Error handling

### **.env** (Create this)
```env
GOOGLE_API_KEY=your_gemini_api_key_here
NODE_ENV=production
PORT=3000
```

---

## 🚀 **Quick Deploy Commands**

### **Render (Recommended)**
```bash
# 1. Prepare Git repository
git init
git add .
git commit -m "Initial commit"
git branch -M main

# 2. Push to GitHub
git remote add origin https://github.com/yourusername/revolt-voice-assistant.git
git push -u origin main

# 3. Deploy on Render
# - Go to render.com
# - Connect GitHub repo
# - Create Web Service
# - Add environment variables
# - Deploy!
```

### **Railway (Fastest)**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Deploy
railway login
railway init
railway up

# 3. Set environment variables
railway variables set GOOGLE_API_KEY=your_api_key_here
```

### **Vercel (Modern)**
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel login
vercel

# 3. Set environment variables
vercel env add GOOGLE_API_KEY
vercel --prod
```

---

## 🔍 **Post-Deployment Checklist**

### **Testing**
- [ ] **URL Access**: App loads correctly
- [ ] **Microphone**: Browser permissions work
- [ ] **Voice Input**: Audio recording works
- [ ] **AI Response**: Gemini API responds
- [ ] **WebSocket**: Real-time communication
- [ ] **HTTPS**: Secure connection

### **Monitoring**
- [ ] **Logs**: Check application logs
- [ ] **Performance**: Monitor response times
- [ ] **Errors**: Set up error tracking
- [ ] **Uptime**: Monitor availability

### **Security**
- [ ] **API Key**: Securely stored
- [ ] **HTTPS**: SSL certificate active
- [ ] **CORS**: Properly configured
- [ ] **Rate Limiting**: Implemented if needed

---

## 🆘 **Troubleshooting**

### **Common Issues**

#### "Build Failed"
```bash
# Check package.json
npm install

# Check Node.js version
node --version

# Check build logs
# Look for specific error messages
```

#### "Environment Variables Not Set"
```bash
# Verify in platform dashboard
# Check variable names
# Ensure no typos
# Restart deployment
```

#### "WebSocket Connection Failed"
```bash
# Check platform WebSocket support
# Verify HTTPS is enabled
# Check firewall settings
# Test locally first
```

#### "API Key Invalid"
```bash
# Verify API key is correct
# Check API key permissions
# Ensure Gemini Live access
# Test API key locally
```

---

## 📞 **Support**

### **Platform Support**
- **Render**: [docs.render.com](https://docs.render.com)
- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Heroku**: [devcenter.heroku.com](https://devcenter.heroku.com)
- **DigitalOcean**: [docs.digitalocean.com](https://docs.digitalocean.com)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)

### **Voice Assistant Support**
- **GitHub Issues**: Report bugs
- **Documentation**: Check README.md
- **Community**: Discussion forum

---

## 🎯 **Recommended Deployment**

**For beginners**: **Render** (Free, easy, reliable)
**For developers**: **Railway** (Fast, simple, good free tier)
**For production**: **DigitalOcean** (Reliable, scalable, cost-effective)

---

*Choose your deployment platform and let's get your voice assistant live! 🚀* 