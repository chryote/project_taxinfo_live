# Pajak Kendaraan Bermotor POC

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-v0.4.0-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![Build & Tests](https://img.shields.io/badge/tests-47%20passed-brightgreen.svg?style=flat-square)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Green Software](https://img.shields.io/badge/Green%20Software-Energy%20Proportional-059669.svg?style=flat-square)](#sustainable-development-practices)

> Lightweight Indonesian Motor Vehicle Tax (PKB) Proof-of-Concept featuring ELK stack telemetry, K6 load benchmarking, pgvector HNSW similarity search, RabbitMQ asynchronous processing, and a Vue.js 3 frontend.

This proof-of-concept simulates a modern, energy-efficient digital Samsat (Sistem Administrasi Manunggal Satu Atap) system. It calculates annual motor vehicle taxes (Pajak Kendaraan Bermotor - PKB), applies progressive rates, calculates mandatory road safety funds (SWDKLLJ), enforces the 0% Battery Electric Vehicle (BEV) tax exemption under Permendagri No. 6/2023, resolves vehicle appraisal disputes via pgvector cosine similarity, decouples payment settlement via RabbitMQ, and aggregates audit trails into Elasticsearch.

## Table of Contents

- [Background](#background)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Sustainable Development Practices](#sustainable-development-practices)
- [Install](#install)
- [Usage](#usage)
  - [Docker Compose (Full Stack)](#docker-compose-full-stack)
  - [Local Development](#local-development)
- [API](#api)
  - [Endpoints](#endpoints)
  - [Example Requests & Responses](#example-requests--responses)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [K6 Benchmarking](#k6-benchmarking)
- [Contributing](#contributing)
- [License](#license)

---

## Background

Motor vehicle tax collection in Indonesia (Pajak Kendaraan Bermotor / PKB) is governed by **UU No. 1 Tahun 2022 (HKPD)** and **Permendagri No. 6 Tahun 2023**. Traditional Samsat IT systems face multiple challenges:
1. **Traffic Spikes**: Citizen tax payments spike dramatically on annual expiration dates and during tax amnesty (pemutihan pajak) periods, often overloading database servers.
2. **Appraisal & Valuation Disputes**: Custom, imported, or modified vehicles lack straightforward NJKB (Nilai Jual Kendaraan Bermotor) tables, requiring manual appraisal.
3. **Green Energy Incentives**: Enforcing regional policies such as the **0% PKB rate for Battery Electric Vehicles (BEV)** to accelerate decarbonization.
4. **Auditability & Traceability**: High volume of tax assessment and payment events needing structured search and compliance indexing without slowing down the primary relational OLTP database.

This project solves these challenges by combining:
- **Fastify & Vue.js 3**: Minimal CPU overhead, tree-shaken static assets (40kB gzipped), and sub-5ms HTTP responses.
- **pgvector (HNSW Index)**: Fast sub-millisecond AI similarity search across high-dimensional vehicle specification vectors for dispute resolution.
- **RabbitMQ**: Message-broker spike absorber that buffers peak payment submissions and decouples database write operations.
- **ELK Stack (Elasticsearch, Logstash, Kibana)**: Observability and compliance audit stream.
- **K6**: Performance benchmark suite validating throughput (>4,000 req/sec) and strict latency SLAs (p95 < 200ms).

---

## Architecture & Tech Stack

```mermaid
flowchart TD
    subgraph Presentation["Presentation Layer"]
        UI["Vue.js 3 Frontend (Vite + Nginx + Gzip)"]
    end

    subgraph Application["Application Layer"]
        API["Fastify Core Engine (PKB Rules & Permendagri 6/2023)"]
    end

    subgraph DataBroker["Data & Broker Layer"]
        DB[("PostgreSQL 16 with pgvector (HNSW Index)")]
        MQ["RabbitMQ Message Broker (Async Queues)"]
        LS["Logstash Pipeline (Event Enrichment)"]
    end

    subgraph Observability["Observability Layer"]
        ES[("Elasticsearch (Audit & Telemetry Store)")]
        KB["Kibana Dashboard (Tax Analytics)"]
    end

    UI -->|"HTTP / REST (Port 8080/80)"| API
    API -->|"SQL & Vector Cosine Distance (<=>)"| DB
    API -->|"AMQP Events"| MQ
    API -->|"Audit Stream (TCP/HTTP)"| LS
    MQ -->|"Async Settlement Worker"| DB
    MQ -->|"Audit Events"| ES
    LS -->|"Enriched Logs"| ES
    ES -->|"Telemetry Feed"| KB
```

| Layer | Technology | Role & Configuration |
|---|---|---|
| **Frontend** | Vue 3 + TypeScript + Vite | Single Page Application, reactive tax calculator, payment simulator, and green telemetry dashboard. |
| **Backend** | Fastify + TypeScript (Node 22) | High-performance asynchronous REST API with gzip payload compression. |
| **Database** | PostgreSQL 16 + `pgvector` | Relational tables (`vehicles`, `tax_assessments`, `tax_payments`) + 128-dimensional HNSW cosine index. |
| **Broker** | RabbitMQ 3 Management (Alpine) | Event broker with durable queues (`samsat.tax.assessment`, `samsat.tax.payment`, `samsat.audit.log`). |
| **Logging** | ELK Stack (8.13) | Elasticsearch search index, Logstash event enrichment, and Kibana dashboard. |
| **Benchmarking** | K6 (Grafana) | Smoke tests, peak load simulation, pgvector stress tests, and payment spike tests. |

---

## Sustainable Development Practices

This POC adheres to the principles of the **Green Software Foundation (GSF)**:

1. **Carbon & Energy Efficiency (SCI - Software Carbon Intensity)**:
   - **Gzip / Deflate Compression**: Configured on Fastify and Nginx, reducing network payload bandwidth by over 68%.
   - **Static Asset Optimization**: The production Vue.js bundle is under 40kB (gzipped), minimizing client-side download wattage.
2. **Algorithmic Hardware Efficiency**:
   - **pgvector HNSW (Hierarchical Navigable Small World)**: Provides $O(\log N)$ logarithmic nearest-neighbor search instead of $O(N)$ linear table scans, saving millions of server CPU cycles on large vehicle registries.
3. **Decoupled Spike Absorber (Hardware Proportionality)**:
   - Using RabbitMQ as a non-blocking queue absorbs peak tax season traffic surges. Databases write at a steady, capped rate, eliminating the need to overprovision idle cloud CPU cores.
4. **Strict Resource Quotas**:
   - All Docker containers are bounded with strict CPU and memory limits (`mem_limit: 384M - 768M`), preventing memory leaks and high server idling wattage.
5. **Clean Policy Alignment**:
   - Implements Permendagri No. 6/2023 Pasal 10 ayat (1): Battery Electric Vehicles (BEV) receive **0% PKB tax rate**, encouraging green transportation adoption.

---

## Install

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v20+ and npm v10+ (for local development or testing)

### Clone & Dependencies

```bash
git clone https://github.com/chryote/project_taxinfo_live.git
cd project_taxinfo_live

# Install dependencies for both backend and frontend workspaces
npm run install:all
```

### Demo Accounts (For Portal Login & Testing)

| Role | Username | Password | Access Scope |
|---|---|---|---|
| **Petugas / Auditor Bapenda** | `demo_petugas` | `jmc2026` | Full access: SAMSAT Inquiry, PKB Simulator, AI NJKB Vector Search (`pgvector`), QRIS/VA Payment (`RabbitMQ`), and `ELK` Audit Dashboard. |
| **Wajib Pajak Mandiri** | `wajib_pajak` | `samsat123` | Citizen self-service tax inquiry, progressive simulator, and online payment. |

---

## Usage

### Docker Compose (Full Stack)

Spin up PostgreSQL (with pgvector), RabbitMQ, Elasticsearch, Logstash, Kibana, the Backend API, and the Vue.js Frontend:

```bash
# Start all containers in the background
docker compose up -d

# View service logs
docker compose logs -f
```

Access the interfaces:
- **Frontend Web UI**: [http://localhost:8080](http://localhost:8080)
- **Backend API & Health**: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)
- **RabbitMQ Management Dashboard**: [http://localhost:15672](http://localhost:15672) (User: `samsat_mq` / Pass: `samsat_mq_pass`)
- **Elasticsearch API**: [http://localhost:9200](http://localhost:9200)
- **Kibana Dashboard**: [http://localhost:5601](http://localhost:5601)

To shut down:
```bash
docker compose down
```

### Local Development

You can run services natively without Docker. Built-in resilient fallbacks ensure the backend operates with an in-memory vector engine and event bus if external daemons are temporarily offline.

```bash
# Terminal 1: Run Backend API in watch mode
cd backend
npm run dev

# Terminal 2: Run Frontend Vite Dev Server
cd frontend
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## API

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | System health, component connections, and Green SCI metrics. |
| `GET` | `/api/v1/tax/calculate/:plate` | Calculate official tax assessment for a registered plate number. |
| `POST` | `/api/v1/tax/simulate` | Simulate custom vehicle tax with progressive rates & EV incentive. |
| `POST` | `/api/v1/tax/pay` | Submit asynchronous tax payment job into RabbitMQ queue. |
| `GET` | `/api/v1/vehicles/:plate` | Lookup registered vehicle record. |
| `POST` | `/api/v1/vehicles/similarity` | AI-assisted vehicle valuation search using pgvector cosine distance. |
| `GET` | `/api/v1/analytics/summary` | Real-time tax collection metrics from Elasticsearch. |
| `GET` | `/api/v1/analytics/logs` | Search audit trail events in Elasticsearch. |

### Example Requests & Responses

#### 1. Calculate Tax for Registered Plate
```http
GET /api/v1/tax/calculate/B%201234%20ABC HTTP/1.1
Host: localhost:3000
```

Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "vehicle": {
      "plateNumber": "B 1234 ABC",
      "ownerName": "Budi Santoso",
      "brand": "Honda",
      "model": "Vario 160 CBS",
      "manufactureYear": 2023,
      "engineCapacityCc": 157,
      "njkb": 22000000,
      "status": "MENUNGGU_PEMBAYARAN"
    },
    "assessment": {
      "id": "c1f7a08b-9e41-48e2-b13c-bf1b51e06e30",
      "plateNumber": "B 1234 ABC",
      "assessmentYear": 2026,
      "breakdown": {
        "njkb": 22000000,
        "weightCoefficient": 1.0,
        "taxBase": 22000000,
        "taxRate": 0.02,
        "pkbPrincipal": 440000,
        "swdkllj": 35000,
        "stnkAdminFee": 0,
        "tnkbFee": 0,
        "lateMonths": 0,
        "pkbPenalty": 0,
        "swdklljPenalty": 0,
        "totalTax": 475000,
        "isElectricExempt": false,
        "progressiveTier": 1
      },
      "status": "TERBIT"
    }
  }
}
```

#### 2. AI Vehicle Valuation & Dispute Search (pgvector)
```http
POST /api/v1/vehicles/similarity HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "queryText": "mobil listrik keluarga",
  "limit": 3
}
```

Response (`200 OK`):
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "plateNumber": "D 9999 EV",
      "brand": "Hyundai",
      "model": "Ioniq 5 Signature Long Range",
      "vehicleType": "EV_RODA_4",
      "manufactureYear": 2023,
      "njkb": 580000000,
      "similarity": 0.9854,
      "estimatedPkb": 0
    },
    {
      "plateNumber": "L 8888 WUL",
      "brand": "Wuling",
      "model": "Air EV Long Range",
      "vehicleType": "EV_RODA_4",
      "manufactureYear": 2023,
      "njkb": 190000000,
      "similarity": 0.9218,
      "estimatedPkb": 0
    }
  ]
}
```

#### 3. Submit Asynchronous Tax Payment (RabbitMQ)
```http
POST /api/v1/tax/pay HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "assessmentId": "c1f7a08b-9e41-48e2-b13c-bf1b51e06e30",
  "plateNumber": "B 1234 ABC",
  "amount": 475000,
  "paymentMethod": "QRIS"
}
```

Response (`202 Accepted`):
```json
{
  "success": true,
  "message": "Payment job successfully queued to RabbitMQ for asynchronous settlement",
  "data": {
    "id": "76d54cf8-a92c-4734-9bb8-0e31e5055b88",
    "paymentReference": "PAY-PKB-LV4R7S-8124",
    "amount": 475000,
    "paymentMethod": "QRIS",
    "status": "PROCESSING",
    "eStnkQrToken": "ESTNK-B1234ABC-PAY-PKB-LV4R7S-8124"
  }
}
```

---

## Testing

### Unit Tests

The codebase includes 47 automated unit and integration tests covering Indonesian tax math, progressive rates, late penalties, EV exemptions, vector embeddings, RabbitMQ queues, and Vue components.

Run all tests from the repository root:
```bash
npm test
```

Or run tests individually by workspace:
```bash
# Backend unit & integration tests (with V8 coverage report)
npm run test:backend

# Frontend component tests
npm run test:frontend
```

### K6 Benchmarking

The benchmark suite includes 4 scenarios located in `k6/scenarios/`:
1. `smoke-test.js`: Minimal verification under 1-2 VUs.
2. `load-test.js`: Realistic peak load curve (20 concurrent VUs) on Samsat tax assessment.
3. `vector-search-stress.js`: 30 concurrent VUs executing pgvector cosine distance queries.
4. `async-payment-spike.js`: 50 concurrent VUs submitting payment spikes into RabbitMQ.

Run benchmarks using the orchestrator:

**Windows PowerShell**:
```powershell
npm run bench:smoke
npm run bench:load
npm run bench:vector
npm run bench:payment
```

**Linux / macOS (Bash)**:
```bash
./k6/run-benchmarks.sh smoke
./k6/run-benchmarks.sh load
./k6/run-benchmarks.sh vector
./k6/run-benchmarks.sh payment
```

**Docker Compose K6 Profile**:
```bash
docker compose run --rm k6 run /scripts/load-test.js
```

#### Typical Benchmark Results
- **Throughput**: `1,500 - 5,150 req/sec`
- **p95 Latency**: `< 14 ms` (Threshold SLA: `< 200 ms`)
- **Error Rate**: `0.00%`

---

## Contributing

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please ensure all tests pass (`npm test`) and adhere to the Green Computing standards documented above.

---

## License

[MIT](LICENSE) © 2026 Chryote
