# Bill Generator Pro (v2.0)

A modern, production-ready invoice and bill generator with serverless backend architecture, Google OAuth authentication, and MongoDB GridFS storage.

---

## Architecture Overview

- **Frontend**: Vite + React 18 SPA with Material-UI (MUI v6) and `@react-oauth/google`.
- **Backend**: Serverless AWS Lambda handlers (Node.js ES Modules, zero Express runtime dependency).
- **Authentication**: Direct Google Identity Services (GIS) token verification via `google-auth-library`.
- **Database & Storage**: MongoDB Atlas for relational billing records, with MongoDB GridFS for in-database storage and retrieval of generated PDF invoices.
- **PDF Engine**: In-memory vector PDF generation using `pdfkit` (runs seamlessly within AWS Lambda execution environments).

---

## Features

1. **Google OAuth Sign-In**: Secure one-tap login and user-isolated billing data.
2. **Billing Profile (Bill From)**: Configure your business details, address, tax IDs, and bank account information.
3. **Flexible Invoice Numbering**: Configure automatic invoice sequence formats in your billing profile:
   - Date-based: e.g. `NV20261002001` or `NV-20261002-001`
   - Simple sequential: e.g. `NV001` or `NV-001`
   - Year sequential: e.g. `NV-2026-001`
4. **Multi-Currency Support**: Choose your business's default currency in Billing Profile, with per-invoice currency selection (USD, INR, EUR, GBP, CAD, AUD, AED).
5. **Client Management (Bill To)**: Save and autocomplete client contacts for quick invoicing.
6. **Dynamic Line Items**: Real-time line item amounts, tax rates, and total computations.
7. **Annexure / Particulars (Page 2)**: Optional itemized deliverables / scope-of-work table rendered cleanly on page 2.
8. **Live PDF Preview & Storage**: Interactive PDF modal preview before committing; generated PDFs are permanently saved in MongoDB GridFS.

---

## Project Structure

```text
biil_generator/
├── backend/
│   ├── src/
│   │   ├── config/             # MongoDB connection pooling & GridFS initialization
│   │   ├── handlers/           # Pure AWS Lambda handlers (auth, profile, clients, bills, pdf)
│   │   ├── middleware/         # Google token verification & API Gateway response helpers
│   │   ├── services/           # PDFKit renderer, calculation logic, GridFS streaming
│   │   └── tests/              # Unit and integration test suites
│   ├── scripts/                # Data migration utilities
│   ├── dev-server.js           # Zero-Express local Lambda dev runner
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios client with bearer token interceptor
│   │   ├── components/         # Navbar, ProtectedRoute, shared UI
│   │   ├── context/            # AuthContext (Google OAuth state)
│   │   ├── pages/              # InvoicesListPage, CreateBillPage, BillingProfilePage, LoginPage
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## Quick Start

### 1. Configure Environment Variables

Copy `.env.example` to `.env` in both `backend` and `frontend`:

**Backend** (`backend/.env`):

```env
DB_URL="mongodb+srv://<username>:<password>@cluster0.mongodb.net"
DB_NAME="nv_billings"
GOOGLE_CLIENT_ID="<your-google-client-id>.apps.googleusercontent.com"
PORT=4000
NODE_ENV=development
DEV_BYPASS_AUTH=false
```

**Frontend** (`frontend/.env`):

```env
VITE_GOOGLE_CLIENT_ID="<your-google-client-id>.apps.googleusercontent.com"
VITE_API_URL=http://localhost:4000
```

### 2. Run Locally

**Backend**:

```bash
cd backend
npm run dev
```

**Frontend**:

```bash
cd frontend
npm run dev
```

### 3. Run Tests

```bash
cd backend
npm test
```
