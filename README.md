# GEO Checker — by ScribbleAI
### Is your content AI-proof?

A tool that scores any piece of content across 6 GEO dimensions and tells you exactly what to fix to get cited by AI engines.

---

## Deploy to Vercel (free, ~5 minutes)

### 1. Get an Anthropic API key
Go to https://console.anthropic.com → API Keys → Create Key
Copy the key — you'll need it in step 4.

### 2. Push this folder to GitHub
- Create a new repo at github.com (call it `geo-checker` or anything)
- Push this folder to it:
```
cd geo-checker
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/geo-checker.git
git push -u origin main
```

### 3. Connect to Vercel
- Go to vercel.com → New Project
- Import your GitHub repo
- Framework preset: **Vite**
- Root directory: leave as `/`
- Click Deploy

### 4. Add your API key
- In Vercel: go to your project → Settings → Environment Variables
- Add: `ANTHROPIC_API_KEY` = your key from step 1
- Click Save, then go to Deployments → Redeploy

### 5. Done ✦
Your tool is live at `your-project.vercel.app`

---

## Add a custom domain (optional)
In Vercel → Project → Settings → Domains
Add `check.scribble.network` (or whatever subdomain you want)
Then add a CNAME record in your DNS pointing to `cname.vercel-dns.com`

---

## Local development
```
npm install
cp .env.example .env.local
# Add your API key to .env.local
npm run dev
```

---

## How it works
- Frontend: React + Vite, hosted on Vercel's CDN
- Backend: `/api/analyze.js` — a serverless function that holds your API key and proxies calls to Anthropic
- Your API key is never exposed to the browser
