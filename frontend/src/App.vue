<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header">
      <div class="container" style="padding-top: 1rem; padding-bottom: 1rem;">
        <div class="header-inner">
          <div class="brand">
            <div class="brand-badge">SAMSAT</div>
            <div>
              <h1 class="brand-title">SAMSAT DIGITAL & AI VALUATION</h1>
              <div class="brand-subtitle">
                Pajak Kendaraan Bermotor (PKB) Engine - Permendagri No. 6/2023 & UU HKPD
              </div>
            </div>
          </div>

          <!-- Live Infrastructure System Badges + Active User Session -->
          <div class="header-right">
            <div class="system-pills">
              <span class="pill" :class="health?.components?.postgres_pgvector?.connected ? 'pill-active' : 'pill-warn'">
                <span class="pill-dot"></span> pgvector (HNSW)
              </span>
              <span class="pill" :class="health?.components?.rabbitmq?.connected ? 'pill-active' : 'pill-warn'">
                <span class="pill-dot"></span> RabbitMQ (AMQP)
              </span>
              <span class="pill" :class="health?.components?.elasticsearch?.connected ? 'pill-active' : 'pill-warn'">
                <span class="pill-dot"></span> ELK Stack
              </span>
              <span class="pill pill-eco">
                Green Architecture
              </span>
            </div>

            <div v-if="currentUser" class="user-session-bar">
              <div class="user-info">
                <span class="user-role-badge" :class="currentUser.role === 'PETUGAS_BAPENDA' ? 'badge-primary' : 'badge-eco'">
                  {{ currentUser.role === 'PETUGAS_BAPENDA' ? 'PETUGAS / AUDITOR' : 'WAJIB PAJAK' }}
                </span>
                <span class="user-name">{{ currentUser.name }} ({{ currentUser.username }})</span>
              </div>
              <button class="btn btn-outline btn-sm" @click="handleLogout">
                Keluar
              </button>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs (Visible when authenticated) -->
        <nav v-if="currentUser" class="nav-tabs">
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'inquiry' }"
            @click="currentTab = 'inquiry'"
          >
            Cek Pajak (SAMSAT Online)
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'calculator' }"
            @click="currentTab = 'calculator'"
          >
            Simulasi PKB & Progresif
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'vector' }"
            @click="currentTab = 'vector'"
          >
            AI Sengketa NJKB (pgvector)
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'telemetry' }"
            @click="currentTab = 'telemetry'"
          >
            Audit & Telemetri ELK
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'green' }"
            @click="currentTab = 'green'"
          >
            Sustainable Metrics
          </button>
        </nav>
      </div>
    </header>

    <!-- Login Gate (When not authenticated) -->
    <main v-if="!currentUser" class="container login-container">
      <div class="card login-card">
        <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 0.35rem;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <span class="badge badge-primary">PORTAL AUTENTIKASI DEMO</span>
            <span class="badge badge-eco">UU HKPD No. 1/2022</span>
          </div>
          <h2 class="card-title" style="font-size: 1.35rem; margin-top: 0.35rem;">
            Masuk ke Sistem SAMSAT Digital & AI Valuation
          </h2>
          <p style="font-size: 0.875rem; color: var(--text-muted);">
            Gunakan akun demo di bawah ini untuk menguji fitur perhitungan PKB, simulasi progresif & insentif EV 0%, pencarian vektor NJKB (pgvector), pembayaran asinkron (RabbitMQ), serta dashboard audit ELK.
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label class="form-label" for="login-username">Username Akun Demo</label>
            <input
              id="login-username"
              v-model="loginForm.username"
              type="text"
              class="form-input mono"
              placeholder="Contoh: demo_petugas"
              required
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input
              id="login-password"
              v-model="loginForm.password"
              type="password"
              class="form-input mono"
              placeholder="Masukkan password demo"
              required
              autocomplete="current-password"
            />
          </div>

          <div v-if="loginError" class="login-error">
            {{ loginError }}
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.8rem;" :disabled="isLoggingIn">
            {{ isLoggingIn ? 'Memverifikasi Kredensial...' : 'Masuk ke Dashboard SAMSAT' }}
          </button>
        </form>

        <!-- Demo Credentials Helper Box for Reviewer Convenience -->
        <div class="demo-credentials-box">
          <div class="demo-box-title">
            Akun Demo Pengujian (Klik untuk Isi Otomatis):
          </div>
          <div class="demo-accounts-grid">
            <button
              type="button"
              class="demo-account-btn"
              @click="fillDemo('demo_petugas', 'jmc2026')"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <strong>1. Petugas / Auditor Bapenda</strong>
                <span class="badge badge-primary">Rekomendasi</span>
              </div>
              <div class="mono demo-cred-line">
                User: <strong>demo_petugas</strong> | Pass: <strong>jmc2026</strong>
              </div>
              <div class="demo-cred-sub">Akses penuh simulasi PKB, AI NJKB & Audit Log ELK</div>
            </button>

            <button
              type="button"
              class="demo-account-btn"
              @click="fillDemo('wajib_pajak', 'samsat123')"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <strong>2. Wajib Pajak Mandiri</strong>
                <span class="badge badge-eco">Warga DIY</span>
              </div>
              <div class="mono demo-cred-line">
                User: <strong>wajib_pajak</strong> | Pass: <strong>samsat123</strong>
              </div>
              <div class="demo-cred-sub">Simulasi cek tagihan plat & pembayaran QRIS/VA</div>
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Main Content Area (Authenticated) -->
    <main v-else class="container">
      <TaxInquiry
        v-if="currentTab === 'inquiry'"
        @initiate-payment="openPaymentModal"
      />

      <TaxCalculator
        v-else-if="currentTab === 'calculator'"
      />

      <VectorSearchDispute
        v-else-if="currentTab === 'vector'"
      />

      <ElkAuditDashboard
        v-else-if="currentTab === 'telemetry'"
      />

      <GreenMetrics
        v-else-if="currentTab === 'green'"
      />
    </main>

    <!-- Payment Modal Component -->
    <PaymentSimulator
      v-if="showPaymentModal && activePaymentData"
      :vehicle="activePaymentData.vehicle"
      :assessment="activePaymentData.assessment"
      @close="showPaymentModal = false"
      @payment-completed="handlePaymentCompleted"
    />

    <!-- Footer -->
    <footer class="app-footer">
      <div class="container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; font-size: 0.85rem; color: var(--text-muted);">
        <div>
          Pajak Kendaraan Bermotor POC • Dikembangkan oleh <strong>Fadhilah Azhar</strong> (ELK Stack, K6, pgvector, RabbitMQ & Vue.js)
        </div>
        <div style="display: flex; gap: 1rem;">
          <span>UU HKPD No. 1/2022</span>
          <span>•</span>
          <span>Permendagri No. 6/2023 (EV 0%)</span>
          <span>•</span>
          <span>Akun Demo: <code class="mono">demo_petugas</code> / <code class="mono">jmc2026</code></span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import TaxInquiry from './components/TaxInquiry.vue';
import TaxCalculator from './components/TaxCalculator.vue';
import VectorSearchDispute from './components/VectorSearchDispute.vue';
import ElkAuditDashboard from './components/ElkAuditDashboard.vue';
import GreenMetrics from './components/GreenMetrics.vue';
import PaymentSimulator from './components/PaymentSimulator.vue';
import { ApiService } from './services/api.js';
import { Vehicle, TaxAssessment, HealthResponse, DemoUser } from './types/index.js';

const SESSION_KEY = 'samsat_demo_user_v1';

type Tab = 'inquiry' | 'calculator' | 'vector' | 'telemetry' | 'green';
const currentTab = ref<Tab>('inquiry');

const health = ref<HealthResponse | null>(null);
const currentUser = ref<DemoUser | null>(null);

const loginForm = ref({
  username: 'demo_petugas',
  password: 'jmc2026',
});
const isLoggingIn = ref(false);
const loginError = ref('');

const showPaymentModal = ref(false);
const activePaymentData = ref<{ vehicle: Vehicle; assessment: TaxAssessment } | null>(null);

function fillDemo(username: string, password: string) {
  loginForm.value.username = username;
  loginForm.value.password = password;
  loginError.value = '';
}

async function handleLogin() {
  loginError.value = '';
  isLoggingIn.value = true;
  try {
    const authData = await ApiService.login(loginForm.value.username, loginForm.value.password);
    currentUser.value = authData.user;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(authData.user));
    } catch {
      // Ignore storage errors in private mode
    }
  } catch (err: any) {
    // Fallback client-side verification if backend is still warming up
    const u = loginForm.value.username.trim().toLowerCase();
    const p = loginForm.value.password;
    if (u === 'demo_petugas' && p === 'jmc2026') {
      currentUser.value = {
        username: 'demo_petugas',
        name: 'Budi Pratama, S.Kom',
        role: 'PETUGAS_BAPENDA',
        unit: 'UPPD SAMSAT Kota Yogyakarta',
      };
    } else if (u === 'wajib_pajak' && p === 'samsat123') {
      currentUser.value = {
        username: 'wajib_pajak',
        name: 'Andi Wijaya',
        role: 'WAJIB_PAJAK',
        unit: 'Layanan Mandiri E-SAMSAT DIY',
      };
    } else {
      loginError.value = err?.message || 'Username atau password tidak sesuai. Gunakan demo_petugas / jmc2026';
    }
  } finally {
    isLoggingIn.value = false;
  }
}

function handleLogout() {
  currentUser.value = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}

function openPaymentModal(data: { vehicle: Vehicle; assessment: TaxAssessment }) {
  activePaymentData.value = data;
  showPaymentModal.value = true;
}

function handlePaymentCompleted() {
  showPaymentModal.value = false;
  currentTab.value = 'telemetry';
}

onMounted(async () => {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      currentUser.value = JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }

  try {
    health.value = await ApiService.getHealth();
  } catch (err) {
    console.error('Failed to load system health:', err);
  }
});
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .header-right {
    align-items: flex-start;
    width: 100%;
  }
}

.user-session-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8fafc;
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.user-role-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.user-name {
  font-weight: 600;
  color: var(--text-main);
}

.btn-sm {
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-badge {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  background: var(--primary);
  color: #ffffff;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
}

.brand-title {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.brand-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.system-pills {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid var(--border);
}

.pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.pill-active {
  background: #ecfdf5;
  color: #065f46;
  border-color: #a7f3d0;
}
.pill-active .pill-dot {
  background: #10b981;
}

.pill-warn {
  background: #fffbeb;
  color: #92400e;
  border-color: #fde68a;
}
.pill-warn .pill-dot {
  background: #f59e0b;
}

.pill-eco {
  background: var(--eco-light);
  color: var(--eco);
  border-color: #6ee7b7;
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  border-bottom: 2px solid transparent;
  margin-top: 0.5rem;
}

.tab-btn {
  padding: 0.6rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  position: relative;
}

.tab-btn:hover {
  color: var(--text-main);
  background: #f1f5f9;
}

.tab-btn.active {
  color: var(--primary);
  background: var(--primary-light);
  font-weight: 700;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
}

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 200px);
}

.login-card {
  width: 100%;
  max-width: 560px;
  padding: 2rem;
}

.login-form {
  margin-bottom: 1.5rem;
}

.login-error {
  background: var(--danger-light);
  color: var(--danger);
  border: 1px solid #fecaca;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.demo-credentials-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: var(--radius-md);
  padding: 1rem;
}

.demo-box-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.demo-accounts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

.demo-account-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.75rem 0.9rem;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  font-family: var(--font-sans);
}

.demo-account-btn:hover {
  border-color: var(--primary);
  background: #f0f9ff;
  box-shadow: var(--shadow-sm);
}

.demo-cred-line {
  font-size: 0.82rem;
  color: #0f172a;
}

.demo-cred-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

main {
  flex: 1;
}

.app-footer {
  background: #ffffff;
  border-top: 1px solid var(--border);
  padding: 1.5rem 0;
  margin-top: auto;
}
</style>
