<template>
  <div class="elk-dashboard">
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span>ELK Stack Telemetry & Audit Stream (Elasticsearch + Kibana)</span>
        </div>
        <span class="badge badge-primary">Index: pajak-kendaraan-logs</span>
      </div>

      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
        Logstash dan Elasticsearch menyerap setiap event transaksi, perhitungan pajak, dan aktivitas pembayaran secara terdistribusi. Kibana menyajikan dashboard audit kepatuhan dan analitik penerimaan kas daerah.
      </p>

      <!-- Stat Cards -->
      <div class="grid grid-cols-3" style="margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 1.25rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Total Surat Ketetapan (SKP)
          </div>
          <div class="mono" style="font-size: 1.75rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">
            {{ stats.totalAssessments }}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 0.25rem;">Tercatat di Elasticsearch</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 1.25rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Total Transaksi Lunas
          </div>
          <div class="mono" style="font-size: 1.75rem; font-weight: 800; color: var(--eco); margin-top: 0.25rem;">
            {{ stats.totalPayments }}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 0.25rem;">Settled via RabbitMQ</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 1.25rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Kas Penerimaan PKB
          </div>
          <div class="mono" style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-top: 0.4rem;">
            {{ formatRupiah(stats.totalAmountCollected) }}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 0.25rem;">Pendapatan Asli Daerah (PAD)</div>
        </div>
      </div>

      <!-- Search Audit Logs in Elasticsearch -->
      <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem;">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input"
          placeholder="Cari audit trail (contoh: 'LUNAS', 'B 1234 ABC', 'TAX_ASSESSMENT_CREATED')..."
          @keyup.enter="refreshLogs"
        />
        <button class="btn btn-outline" @click="refreshLogs">
          Refresh Log
        </button>
      </div>

      <!-- Live Stream Table -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Waktu (UTC/ISO)</th>
              <th>Tipe Event</th>
              <th>Entity ID</th>
              <th>Data Payload Audit</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, idx) in logs" :key="idx">
              <td class="mono" style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">
                {{ log.timestamp }}
              </td>
              <td>
                <span
                  class="badge"
                  :class="log.eventType.includes('SETTLED') ? 'badge-success' : log.eventType.includes('PAYMENT') ? 'badge-warning' : 'badge-primary'"
                >
                  {{ log.eventType }}
                </span>
              </td>
              <td class="mono" style="font-size: 0.8rem;">{{ log.entityId }}</td>
              <td class="mono" style="font-size: 0.75rem; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ JSON.stringify(log.payload) }}
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                Belum ada data audit log dalam rentang ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiService } from '../services/api.js';
import { AuditLogEntry } from '../types/index.js';

const searchQuery = ref('');
const stats = ref({
  totalAssessments: 0,
  totalPayments: 0,
  totalAmountCollected: 0,
});
const logs = ref<AuditLogEntry[]>([]);

async function refreshData() {
  try {
    const summary = await ApiService.getAnalyticsSummary();
    stats.value = {
      totalAssessments: summary.totalAssessments,
      totalPayments: summary.totalPayments,
      totalAmountCollected: summary.totalAmountCollected,
    };
    logs.value = summary.recentLogs;
  } catch (err) {
    console.error('Failed to load telemetry stats:', err);
  }
}

async function refreshLogs() {
  try {
    logs.value = await ApiService.getAuditLogs(searchQuery.value);
  } catch (err) {
    console.error('Failed to search logs:', err);
  }
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

onMounted(() => {
  refreshData();
});
</script>
