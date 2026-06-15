# 🏥 QueueCure — Real-Time Clinic Queue Management System

A production-ready, full-stack clinic queue management system with real-time Socket.IO updates, QR code patient tracking, and atomic concurrency control.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18.x
- **MongoDB** (local or Atlas)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Edit `backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017/queuecure
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5000
```

### 3. Run the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 4. Open in Browser
| Screen | URL |
|--------|-----|
| Landing Page | http://localhost:5000 |
| Receptionist Dashboard | http://localhost:5000/receptionist.html |
| Patient Waiting Room | http://localhost:5000/patient.html |
| Personalised Patient URL | http://localhost:5000/patient.html?token=3&clinicId=clinic-001 |

---

## 📐 Architecture

```
queue-cure/
├── backend/
│   ├── config/
│   │   ├── db.js          ← MongoDB connection with retry logic
│   │   └── socket.js      ← Socket.IO singleton + room management
│   ├── models/
│   │   ├── Queue.js       ← Queue state schema (atomic counter)
│   │   └── Patient.js     ← Patient lifecycle schema
│   ├── controllers/
│   │   └── queueController.js  ← All business logic + QR generation
│   ├── routes/
│   │   └── queueRoutes.js ← REST API endpoints
│   ├── server.js          ← Express + HTTP + Socket.IO bootstrap
│   └── package.json
└── frontend/
    ├── public/
    │   ├── index.html         ← Landing page
    │   ├── receptionist.html  ← Receptionist dashboard
    │   └── patient.html       ← Patient waiting screen
    └── src/
        ├── js/
        │   ├── app.js         ← API helpers, toast system, utilities
        │   └── socket-client.js  ← Socket.IO client wrapper
        └── css/
            └── styles.css     ← Full design system (glass, dark mode)
```

---

## 🔌 REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/queue/status?clinicId=X` | Full queue state |
| `POST` | `/api/queue/register` | Register patient, issue token, generate QR |
| `POST` | `/api/queue/next` | Advance to next patient |
| `POST` | `/api/queue/skip` | Skip current token |
| `POST` | `/api/queue/recall` | Re-announce current token |
| `PUT`  | `/api/queue/config` | Update avg consultation time |
| `POST` | `/api/queue/reset` | End-of-day queue reset |

---

## ⚡ Socket.IO Events

### Server → Client
| Event | Trigger |
|-------|---------|
| `queueUpdated` | New patient registered |
| `currentTokenChanged` | Next / Skip executed |
| `waitTimeUpdated` | Avg. consultation time changed |

### Client → Server
| Event | Purpose |
|-------|---------|
| `joinClinic` | Subscribe to a clinic's room |

---

## 🔒 Concurrency Control

Token assignment uses MongoDB's **atomic `$inc`** operation:
```js
Queue.findOneAndUpdate(
  { clinicId },
  { $inc: { lastIssuedToken: 1 } },
  { new: true, upsert: true }
)
```

"Call Next" uses a **guarded update** that only succeeds if the patient is still `waiting`:
```js
Patient.findOneAndUpdate(
  { _id: nextPatient._id, status: 'waiting' },  // guard condition
  { status: 'serving', servedAt: new Date() },
  { new: true }
)
```
If a concurrent request wins the race, the handler automatically retries.

---

## 📱 QR Code Patient Tracking

When a patient is registered, a QR code is generated pointing to:
```
/patient.html?token=<N>&clinicId=<ID>
```

When the patient scans this on their phone:
- Their token is **highlighted** in the waiting list
- They see exactly **how many patients are ahead** of them
- **Estimated wait time** is calculated: `patientsAhead × avgConsultationTime`
- When their token is called, the screen **flashes** and a toast alert fires

---

## 🎨 Design System

The frontend uses a custom **dark-mode glass design system** (`styles.css`) with:
- CSS custom properties (tokens)
- Glassmorphism cards
- Gradient text and buttons
- Micro-animations (`tokenPulse`, `slideIn`, `toastIn`)
- Responsive grid layouts
- Premium typography (Inter + JetBrains Mono)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| HTTP Server | Express 4.x |
| Real-Time | Socket.IO 4.x |
| Database | MongoDB + Mongoose 8.x |
| QR Codes | `qrcode` npm package |
| Frontend | Vanilla HTML/CSS/JS |
| Fonts | Google Fonts (Inter, JetBrains Mono) |
