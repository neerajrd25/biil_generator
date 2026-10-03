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
5. **Clients (Bill To)**: Clients are identified by their (unique) email, created automatically from invoices, and available for autocomplete. A client email is required on every invoice.
6. **Dynamic Line Items**: Real-time line item amounts, tax rates, and total computations.
7. **Annexure / Particulars (Page 2)**: Optional itemized deliverables / scope-of-work table rendered cleanly on page 2.
8. **Live PDF Preview & Storage**: Interactive PDF modal preview before committing; generated PDFs are permanently saved in MongoDB GridFS.
9. **Edit & Lock Invoices**: Edit an invoice while it is unlocked (its stored PDF is regenerated). *Locking* freezes an invoice so it can't be edited or deleted; payments can still be recorded. Lock one invoice, or lock everything dated up to a chosen date ("Lock period"). Unlock if you really need to change it. To cancel a locked invoice while keeping the record, **void** it.
10. **Payments & Status**: Record the amount received per invoice. Status is Unpaid / Partially paid / Paid / Void, and *Overdue* is flagged automatically from the due date.
11. **Client Dashboard**: `/clients` lists every client with billed / collected / outstanding totals; opening a client shows totals per currency (currencies are never added together), overdue ageing, a 12-month billed-vs-collected chart and their invoices. Invoices created before emails were required appear under "No email on file" until you edit them.
12. **Responsive UI**: Navigation collapses into a menu and invoice tables become cards on small screens.

### Invoice API additions

- `PUT /bills/{id}` edit (423 if locked/void) · `PATCH /bills/{id}` with `{ "action": "lock" | "unlock" | "void" | "payment", "amountPaid": n }`
- `POST /bills/lock-period` with `{ "upTo": "YYYY-MM-DD" }`
- `GET /clients` (with totals) · `GET /clients/dashboard?email=...`

---

## Project Structure

```text
biil_generator/
├── backend/
│   ├── src/
│   │   ├── config/             # MongoDB connection pooling & GridFS initialization
│   │   ├── handlers/           # Pure AWS Lambda handlers (auth, profile, clients, bills, pdf)
│   │   ├── middleware/         # Google token verification & API Gateway response helpers
│   │   ├── services/           # PDFKit renderer, calculation logic, invoice status/lock rules, client totals, GridFS streaming
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
│   │   ├── pages/              # InvoicesListPage, CreateBillPage (create/edit), ClientsPage, ClientDashboardPage, BillingProfilePage, LoginPage
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
