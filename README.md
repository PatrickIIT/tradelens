# TradeLens 🌍

> **Connecting Africa, one trade at a time.**

A web-based cross-border trade compliance platform for the **Tanzania–Zambia corridor**, enabling digital certificate issuance, one-time document upload, and real-time customs verification.

Built by **Given Kangwa** (BA/UX) & **Patrick Vincent** (PM/Tech) — IIT Madras Zanzibar Campus, 2026.

---

## The Problem

Cross-border traders between Tanzania and Zambia face:
- 5–20 day clearance times due to manual, paper-based compliance checks
- Repeated document submission at every border post
- No interoperability between TRA, ZRA, TBS, and ZABS systems
- High costs that push SMEs out of regional trade

## The Solution

TradeLens provides:
1. **Unified Digital Certificate Registry** — certificates issued once, recognised on both sides
2. **Multi-Country Compliance Dashboard** — upload documents once, auto-mapped per destination
3. **Customs Verification Portal** — border officers verify compliance by QR scan in under 30 seconds (BR-03)

---

## Tech Stack (Zero-Cost)

| Layer          | Technology                          | Hosting                  |
|----------------|-------------------------------------|--------------------------|
| Frontend       | React 18 + Vite + Tailwind          | Vercel (free)            |
| Backend API    | Node.js + Express                   | Render (free)            |
| Database       | PostgreSQL                          | Supabase (free)          |
| Auth           | Supabase Auth (JWT + MFA)           | Supabase                 |
| File Storage   | Supabase Storage                    | Supabase                 |
| SMS            | Africa's Talking API                | Pay-as-you-go            |
| QR Code        | `qrcode` + `html5-qrcode`           | —                        |
| PDF Generation | `jspdf`                             | —                        |
| CI/CD          | GitHub Actions                      | GitHub (free)            |

---

## Repository Structure

```bash
tradelens/
├── README.md
├── .env.example
├── .gitignore
│
├── backend/                          # Node.js / Express API
│   ├── package.json
│   ├── src/
│   │   ├── index.js                  # Server entry point
│   │   ├── config/
│   │   │   └── supabase.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── documents.js
│   │   │   ├── certificates.js
│   │   │   └── verify.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── validate.js
│   │   ├── services/
│   │   │   ├── certificateService.js
│   │   │   └── notificationService.js
│   │   └── utils/
│   │       └── hash.js
│   └── tests/
│
├── frontend/                         # React (Vite PWA)
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── lib/
│       │   └── supabase.js
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── Navbar.jsx
│       │   │   ├── Sidebar.jsx
│       │   │   ├── Footer.jsx
│       │   │   └── index.js
│       │   ├── Certificate/
│       │   │   ├── CertificateCard.jsx
│       │   │   ├── QRDisplay.jsx
│       │   │   └── index.js
│       │   ├── QRScanner/
│       │   │   ├── QRScanner.jsx
│       │   │   └── index.js
│       │   └── index.js
│       └── pages/
│           ├── Login.jsx
│           ├── TraderDashboard.jsx
│           ├── StandardsOfficer.jsx
│           ├── CustomsVerify.jsx
│           └── AdminPanel.jsx
│
├── supabase/
│   └── migrations/
│       ├── 001_users.sql
│       ├── 002_products.sql
│       ├── 003_documents.sql
│       ├── 004_certificates.sql
│       └── 005_verification_log.sql
│
└── docs/
    ├── CBAP_PMP_Document.pdf
    ├── wireframes/
    └── api-spec.yaml                 # OpenAPI 3.0 spec
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (frontend)
- A free [Render](https://render.com) account (backend)

### 1. Clone the repo

```bash
git clone https://github.com/PatrickIIT/tradelens.git
cd tradelens
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New Project (free)
2. Copy your `Project URL` and `anon key` from **Settings → API**
3. Run migrations via the Supabase SQL editor or CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Push migrations
supabase db push
```

### 3. Configure environment variables

```bash
# Root .env.example → copy to .env
cp .env.example .env
```

Fill in:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
AFRICAS_TALKING_API_KEY=your-key
AFRICAS_TALKING_USERNAME=sandbox
JWT_SECRET=a-strong-random-secret
```

### 4. Run backend locally

```bash
cd backend
npm install
npm run dev           # runs on http://localhost:4000
```

### 5. Run frontend locally

```bash
cd frontend
npm install
npm run dev           # runs on http://localhost:5173
```

---

## Deployment (Free, No Credit Card)

### Database — Supabase
Already live once you create your project. Connect your backend with the service role key.

> ⚠️ Free tier pauses after 7 days of inactivity. Add this GitHub Action to keep it alive:
> `.github/workflows/keep-alive.yml` — pings your Supabase API every 3 days via cron.

### Backend — Render
1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo → select `backend/` as root
3. Build command: `npm install`
4. Start command: `node src/index.js`
5. Add environment variables from your `.env`

Free tier sleeps after 15 minutes of inactivity (wakes on first request, ~30s delay — fine for a pilot).

### Frontend — Vercel
```bash
# From the frontend/ directory
npx vercel --prod
```
Or connect your GitHub repo to Vercel dashboard → auto-deploys on every push to `main`.

---

## MVP Scope

**In scope:**
- Tanzania–Zambia corridor
- Agricultural and food product category
- Trader, Standards Officer, Customs Officer, and Admin portals
- Digital certificate issuance with QR + SHA-256 tamper check
- Compliance status dashboard (green / amber / red)
- SMS notifications via Africa's Talking

**Out of scope (post-MVP):**
- Direct TRA / ZRA API integration
- Native mobile app
- Payment processing
- Additional corridors or product categories
- Blockchain

---

## User Roles

| Role | Key Actions |
|---|---|
| **Trader** | Register, upload documents, view compliance status, download certificate PDF |
| **Standards Officer** (TBS/ZABS) | Review documents, issue digital certificates |
| **Customs Officer** (TRA/ZRA) | Scan QR or search by ID, view verification result and audit trail |
| **System Admin** | Manage users, roles, and permissions |

---

## MVP Timeline

| Sprint | Dates | Focus |
|---|---|---|
| S1 | 1–14 May 2026 | Docs, wireframes, infrastructure, auth |
| S2 | 15–28 May 2026 | Trader portal, Standards portal, Certificate engine |
| S3 | 29 May–11 Jun 2026 | Customs portal, compliance mapping, SMS, admin |
| S4 | 12–30 Jun 2026 | Testing, UAT, pilot (5 traders), demo |

**MVP target: 30 June 2026**

---

## Business Requirements Implemented (MVP)

| ID | Requirement | Status |
|---|---|---|
| BR-01 | Single digital certificate registry | 🔨 In progress |
| BR-02 | Upload once, reuse across both countries | 🔨 In progress |
| BR-03 | Customs verification in under 30 seconds | 🔨 In progress |
| BR-06 | Immutable audit trail for all certificate transactions | 🔨 In progress |

---

## Contributing

This is an academic MVP. The team is:
- **Given Kangwa** — Business Analyst / UX Lead (`zda24b027@iitmz.ac.in`)
- **Patrick Vincent** — Project Manager / Tech Lead (`zda24m007@iitmz.ac.in`)

Issues and pull requests welcome from collaborators.

---

## License

Academic project — IIT Madras Zanzibar Campus, 2026. All rights reserved pending publication.

---

*TradeLens — Connecting Africa, one trade at a time.*
