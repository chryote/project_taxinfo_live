-- Enable pgvector extension for AI-assisted vehicle similarity and dispute resolution
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    plate_number VARCHAR(15) UNIQUE NOT NULL,
    owner_nik VARCHAR(16) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL, -- RODA_2, RODA_4, BUS_TRUK, EV_RODA_2, EV_RODA_4
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    manufacture_year INT NOT NULL,
    engine_capacity_cc INT NOT NULL,
    njkb NUMERIC(15, 2) NOT NULL,
    weight_coefficient NUMERIC(4, 2) DEFAULT 1.0,
    fuel_type VARCHAR(20) NOT NULL, -- BENSIN, DIESEL, ELECTRIC, HYBRID
    ownership_sequence INT DEFAULT 1,
    tax_due_date DATE NOT NULL,
    status VARCHAR(25) DEFAULT 'MENUNGGU_PEMBAYARAN',
    embedding vector(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: tax_assessments
CREATE TABLE IF NOT EXISTS tax_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(15) NOT NULL REFERENCES vehicles(plate_number) ON DELETE CASCADE,
    assessment_year INT NOT NULL,
    njkb NUMERIC(15, 2) NOT NULL,
    weight_coefficient NUMERIC(4, 2) NOT NULL,
    tax_base NUMERIC(15, 2) NOT NULL,
    tax_rate NUMERIC(5, 4) NOT NULL,
    pkb_principal NUMERIC(15, 2) NOT NULL,
    swdkllj NUMERIC(15, 2) NOT NULL,
    stnk_admin_fee NUMERIC(15, 2) NOT NULL,
    tnkb_fee NUMERIC(15, 2) NOT NULL,
    late_months INT DEFAULT 0,
    pkb_penalty NUMERIC(15, 2) DEFAULT 0,
    swdkllj_penalty NUMERIC(15, 2) DEFAULT 0,
    total_tax NUMERIC(15, 2) NOT NULL,
    status VARCHAR(25) DEFAULT 'TERBIT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Table: tax_payments
CREATE TABLE IF NOT EXISTS tax_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES tax_assessments(id) ON DELETE CASCADE,
    payment_reference VARCHAR(64) UNIQUE NOT NULL,
    amount_paid NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    status VARCHAR(25) DEFAULT 'PENDING',
    transaction_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index for sub-millisecond similarity search
CREATE INDEX IF NOT EXISTS idx_vehicles_embedding_hnsw 
ON vehicles USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Indexes for high-throughput lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_nik ON vehicles(owner_nik);
CREATE INDEX IF NOT EXISTS idx_tax_assessments_plate ON tax_assessments(plate_number);
CREATE INDEX IF NOT EXISTS idx_tax_assessments_status ON tax_assessments(status);

-- Seed Initial Realistic Vehicle Data
-- Note: Embeddings are pre-seeded 128-dimensional unit vectors capturing features:
-- (vehicle_type, price_bracket, engine_size, fuel_type, eco_friendly, etc.)
INSERT INTO vehicles (
    plate_number, owner_nik, owner_name, vehicle_type, brand, model,
    manufacture_year, engine_capacity_cc, njkb, weight_coefficient,
    fuel_type, ownership_sequence, tax_due_date, status, embedding
) VALUES
(
    'B 1234 ABC', '3171012345670001', 'Budi Santoso', 'RODA_2', 'Honda', 'Vario 160 CBS',
    2023, 157, 22000000, 1.00, 'BENSIN', 1, '2026-12-15', 'MENUNGGU_PEMBAYARAN',
    (SELECT array_agg(CASE WHEN i = 1 THEN 0.8 WHEN i = 2 THEN 0.2 WHEN i = 15 THEN 0.55 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
),
(
    'B 5678 DEF', '3171012345670001', 'Budi Santoso', 'RODA_4', 'Toyota', 'Avanza 1.5 G CVT',
    2022, 1496, 175000000, 1.00, 'BENSIN', 2, '2026-11-20', 'MENUNGGU_PEMBAYARAN',
    (SELECT array_agg(CASE WHEN i = 3 THEN 0.85 WHEN i = 4 THEN 0.35 WHEN i = 16 THEN 0.4 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
),
(
    'D 9999 EV', '3273019876540002', 'Siti Rahma', 'EV_RODA_4', 'Hyundai', 'Ioniq 5 Signature Long Range',
    2023, 0, 580000000, 1.00, 'ELECTRIC', 1, '2027-01-10', 'MENUNGGU_PEMBAYARAN',
    (SELECT array_agg(CASE WHEN i = 5 THEN 0.95 WHEN i = 6 THEN 0.8 WHEN i = 128 THEN 0.99 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
),
(
    'B 3321 JKT', '3172023456780003', 'Ahmad Dahlan', 'RODA_2', 'Yamaha', 'NMAX 155 Connected',
    2022, 155, 24500000, 1.00, 'BENSIN', 1, '2026-08-10', 'TERLAMBAT',
    (SELECT array_agg(CASE WHEN i = 1 THEN 0.82 WHEN i = 2 THEN 0.22 WHEN i = 15 THEN 0.58 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
),
(
    'L 8888 WUL', '3578034567890004', 'Lina Marlina', 'EV_RODA_4', 'Wuling', 'Air EV Long Range',
    2023, 0, 190000000, 1.00, 'ELECTRIC', 1, '2026-10-05', 'LUNAS',
    (SELECT array_agg(CASE WHEN i = 5 THEN 0.75 WHEN i = 6 THEN 0.6 WHEN i = 128 THEN 0.95 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
),
(
    'B 7777 TRK', '3174045678900005', 'PT Logistik Mandiri', 'BUS_TRUK', 'Isuzu', 'Giga FVR 285 PS',
    2021, 7790, 450000000, 1.30, 'DIESEL', 1, '2026-09-01', 'TERLAMBAT',
    (SELECT array_agg(CASE WHEN i = 7 THEN 0.9 WHEN i = 8 THEN 0.7 WHEN i = 20 THEN 0.5 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
),
(
    'B 2468 XYZ', '3171012345670001', 'Budi Santoso', 'RODA_4', 'Honda', 'HR-V 1.5 SE',
    2023, 1498, 295000000, 1.00, 'BENSIN', 3, '2026-12-01', 'MENUNGGU_PEMBAYARAN',
    (SELECT array_agg(CASE WHEN i = 3 THEN 0.9 WHEN i = 4 THEN 0.5 WHEN i = 16 THEN 0.45 ELSE 0.0 END)::vector(128) FROM generate_series(1, 128) i)
)
ON CONFLICT (plate_number) DO NOTHING;
