# RC Academy 2.0 (RCA2.O)

> Complete Academy Management System & Local AI Examination Engine for RC Academy.

---

## 🏗️ Architecture & Top-Level Boundaries

```text
RCA2.O/
├── api/             # NestJS TypeScript REST API & System of Record (PostgreSQL + Prisma)
├── web/             # Next.js 15 App Router Frontend (React + TypeScript + Tailwind CSS)
├── ai/              # FastAPI Local AI & Document Processing (Ollama + OCR + PDF Generation)
├── worker/          # BullMQ Background Job Worker (Queues, Schedulers & Retry Logic)
├── packages/        # Shared Contracts & Configurations
├── infra/           # Docker, Compose & Reverse Proxy Infrastructure
└── docs/            # Architecture, Security, Database, API & Progress Documentation
```

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js >= 20.x
- Python >= 3.10
- PostgreSQL >= 15 (or Docker)
- Redis >= 7 (or Docker)
- Ollama (running locally on `http://127.0.0.1:11434` with model `qwen2.5:3b` or similar)

### 1. Start Infrastructure (Docker)
```powershell
docker compose up -d postgres redis ollama
```

### 2. Configure Environment Files
Copy each service `.env.example` to `.env`:
```powershell
cp api/.env.example api/.env
cp web/.env.example web/.env
cp ai/.env.example ai/.env
cp worker/.env.example worker/.env
```

### 3. Install & Start Services
```powershell
# API
cd api && npm install && npm run prisma:migrate && npm run dev

# Web Frontend
cd ../web && npm install && npm run dev

# AI Service
cd ../ai && pip install -r requirements.txt && py app/main.py

# Worker
cd ../worker && npm install && npm run dev
```

---

## 🔒 Security & Secrets Policy
Real credentials, database passwords, and AI service tokens are **NEVER** committed to Git. See [SECRETS_MANAGEMENT.md](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/security/SECRETS_MANAGEMENT.md) and [SECURITY.md](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/SECURITY.md) for full policy details.

---

## 📖 Documentation Index
- [Architecture](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/ARCHITECTURE.md)
- [Database & ERD](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/DATABASE.md)
- [API Contracts](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/API_CONTRACTS.md)
- [AI Pipeline & Benchmarks](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/AI_PIPELINE.md)
- [Security Guidelines](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/SECURITY.md)
- [Deployment & Ops](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/DEPLOYMENT.md)
- [Backup & Restore](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/BACKUP_AND_RESTORE.md)
- [Testing Guidelines](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/TESTING.md)
- [Implementation Roadmap](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/IMPLEMENTATION_ROADMAP.md)
- [Progress Tracker](file:///d:/GROWPHIL%20PROJECT/RCA2.O/docs/RCA2_PROGRESS.md)
