<template>
  <div class="tax-inquiry">
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span>Inquiry Pajak Kendaraan Bermotor (SAMSAT Online)</span>
        </div>
        <span class="badge badge-primary">Sistem Pajak Daerah</span>
      </div>

      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
        Masukkan Nomor Polisi (Plat Nomor) kendaraan bermotor untuk memeriksa status pajak, rincian Pokok PKB, SWDKLLJ, dan denda sanksi keterlambatan secara real-time.
      </p>

      <form @submit.prevent="handleSearch" class="search-form">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <input
            v-model="plateInput"
            type="text"
            class="form-input mono"
            placeholder="Contoh: B 1234 ABC"
            style="flex: 1; min-width: 200px; text-transform: uppercase; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.05em;"
            required
          />
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Memeriksa...</span>
            <span v-else>Cek Pajak</span>
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.75rem; font-size: 0.85rem;">
          <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; color: #475569;">
            <input type="checkbox" v-model="isFiveYear" @change="if (hasSearched) handleSearch();" />
            <span>Perpanjangan STNK & Ganti Plat 5 Tahunan (Biaya PNBP)</span>
          </label>
        </div>

        <!-- Quick Sample Chips -->
        <div style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">Contoh Kendaraan:</span>
          <button
            v-for="sample in samplePlates"
            :key="sample.plate"
            type="button"
            class="btn btn-outline"
            style="padding: 0.25rem 0.6rem; font-size: 0.75rem;"
            @click="selectSample(sample.plate)"
          >
            <strong>{{ sample.plate }}</strong> ({{ sample.desc }})
          </button>
        </div>
      </form>

      <!-- Error State -->
      <div v-if="error" style="margin-top: 1.5rem; padding: 1rem; background: var(--danger-light); color: var(--danger); border-radius: var(--radius-md); font-size: 0.9rem;">
        [ERROR] {{ error }}
      </div>

      <!-- Result Card -->
      <div v-if="vehicle && assessment" style="margin-top: 1.5rem;" class="result-section">
        <div style="background: #f1f5f9; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 0.25rem;">
              {{ vehicle.brand }} {{ vehicle.model }} ({{ vehicle.manufactureYear }})
            </h3>
            <div style="display: flex; gap: 0.75rem; font-size: 0.85rem; color: #475569; flex-wrap: wrap;">
              <span>Plat: <strong class="mono">{{ vehicle.plateNumber }}</strong></span>
              <span>-</span>
              <span>Pemilik: <strong>{{ vehicle.ownerName }}</strong></span>
              <span>-</span>
              <span>CC: <strong>{{ vehicle.engineCapacityCc }} cc</strong></span>
              <span>-</span>
              <span>Jatuh Tempo: <strong class="mono">{{ vehicle.taxDueDate }}</strong></span>
            </div>
          </div>
          <div>
            <span v-if="vehicle.status === 'LUNAS'" class="badge badge-success">Lunas</span>
            <span v-else-if="vehicle.status === 'TERLAMBAT'" class="badge badge-danger">Terlambat</span>
            <span v-else class="badge badge-warning">Menunggu Pembayaran</span>
          </div>
        </div>

        <!-- Special Alert for EV -->
        <div v-if="assessment.breakdown.isElectricExempt" style="background: var(--eco-light); border: 1px solid #6ee7b7; color: var(--eco); padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem;">
          <strong>Insentif Kendaraan Listrik (Permendagri No. 6/2023):</strong> Kendaraan Berbasis Baterai (BEV) dibebaskan dari Pokok Pajak Kendaraan Bermotor (Tarif PKB 0%). Anda hanya membayar SWDKLLJ.
        </div>

        <!-- Detailed Tax Assessment Breakdown Table -->
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Komponen Pajak & Retribusi</th>
                <th>Keterangan / Dasar Perhitungan</th>
                <th style="text-align: right;">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Nilai Jual Kendaraan Bermotor (NJKB)</strong></td>
                <td>Tabel Nilai Jual Kemendagri / Bapenda</td>
                <td style="text-align: right;" class="mono">{{ formatRupiah(assessment.breakdown.njkb) }}</td>
              </tr>
              <tr>
                <td><strong>Dasar Pengenaan PKB (DP PKB)</strong></td>
                <td>NJKB × Koefisien Bobot ({{ assessment.breakdown.weightCoefficient }})</td>
                <td style="text-align: right;" class="mono">{{ formatRupiah(assessment.breakdown.taxBase) }}</td>
              </tr>
              <tr>
                <td>
                  <strong>Pokok PKB</strong>
                  <span v-if="assessment.breakdown.isElectricExempt" class="badge badge-eco" style="margin-left: 0.5rem;">0% EV</span>
                  <span v-else-if="assessment.breakdown.progressiveTier > 1" class="badge badge-warning" style="margin-left: 0.5rem;">
                    Progresif Ke-{{ assessment.breakdown.progressiveTier }}
                  </span>
                </td>
                <td>
                  Tarif: {{ (assessment.breakdown.taxRate * 100).toFixed(1) }}%
                  {{ assessment.breakdown.isElectricExempt ? '(Bebas Pajak KBLBB)' : '' }}
                </td>
                <td style="text-align: right; font-weight: 700;" class="mono">
                  {{ formatRupiah(assessment.breakdown.pkbPrincipal) }}
                </td>
              </tr>
              <tr>
                <td><strong>SWDKLLJ Pokok</strong></td>
                <td>Asuransi Kecelakaan Lalu Lintas (PT Jasa Raharja PMK 16/2017)</td>
                <td style="text-align: right;" class="mono">{{ formatRupiah(assessment.breakdown.swdkllj) }}</td>
              </tr>
              <tr v-if="assessment.breakdown.stnkAdminFee > 0 || assessment.breakdown.tnkbFee > 0">
                <td><strong>Biaya PNBP (STNK & Plat TNKB)</strong></td>
                <td>Perpanjangan 5 Tahunan (PP No. 76/2020)</td>
                <td style="text-align: right;" class="mono">
                  {{ formatRupiah(assessment.breakdown.stnkAdminFee + assessment.breakdown.tnkbFee) }}
                </td>
              </tr>
              <tr v-if="assessment.breakdown.lateMonths > 0" style="background: #fff1f2;">
                <td style="color: var(--danger);">
                  <strong>Sanksi Denda Keterlambatan</strong>
                </td>
                <td style="color: var(--danger);">
                  Terlambat {{ assessment.breakdown.lateMonths }} bulan (Denda PKB + Denda SWDKLLJ)
                </td>
                <td style="text-align: right; color: var(--danger); font-weight: 700;" class="mono">
                  {{ formatRupiah(assessment.breakdown.pkbPenalty + assessment.breakdown.swdklljPenalty) }}
                </td>
              </tr>
              <tr style="background: #f8fafc; font-size: 1.05rem;">
                <td colspan="2" style="font-weight: 800; color: #0f172a;">TOTAL TAGIHAN PKB TERUTANG</td>
                <td style="text-align: right; font-weight: 800; color: var(--primary);" class="mono">
                  {{ formatRupiah(assessment.breakdown.totalTax) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <button
            v-if="vehicle.status !== 'LUNAS'"
            class="btn btn-eco"
            style="padding: 0.75rem 1.5rem; font-size: 0.95rem;"
            @click="$emit('initiate-payment', { vehicle, assessment })"
          >
            Bayar PKB Sekarang (Simulasi RabbitMQ)
          </button>
          <template v-else>
            <div style="display: flex; align-items: center; color: var(--success); font-weight: 700; gap: 0.5rem;">
              <span>✓ Pajak Sudah Terbayar Lunas</span>
            </div>
            <button
              type="button"
              class="btn btn-outline"
              style="padding: 0.55rem 1rem; font-size: 0.85rem; border-color: var(--primary); color: var(--primary);"
              :disabled="resetting"
              @click="handleResetStatus"
            >
              {{ resetting ? 'Mereset...' : '↻ Reset Status Tagihan (Demo)' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApiService } from '../services/api.js';
import { Vehicle, TaxAssessment } from '../types/index.js';

const emit = defineEmits<{
  (e: 'initiate-payment', data: { vehicle: Vehicle; assessment: TaxAssessment }): void;
}>();

const plateInput = ref('B 1234 ABC');
const isFiveYear = ref(false);
const loading = ref(false);
const resetting = ref(false);
const hasSearched = ref(false);
const error = ref<string | null>(null);

const vehicle = ref<Vehicle | null>(null);
const assessment = ref<TaxAssessment | null>(null);

const samplePlates = [
  { plate: 'B 1234 ABC', desc: 'Vario 160 (R2)' },
  { plate: 'B 5678 DEF', desc: 'Avanza Progresif Ke-2' },
  { plate: 'D 9999 EV', desc: 'Ioniq 5 (EV 0%)' },
  { plate: 'B 3321 JKT', desc: 'NMAX Terlambat' },
  { plate: 'B 7777 TRK', desc: 'Truk Isuzu' },
];

function selectSample(plate: string) {
  plateInput.value = plate;
  handleSearch();
}

async function handleResetStatus() {
  if (!vehicle.value) return;
  resetting.value = true;
  try {
    await ApiService.resetVehicleStatus(vehicle.value.plateNumber);
    await handleSearch();
  } catch {
    // Immediate client fallback if backend endpoint is still redeploying
    vehicle.value.status = 'MENUNGGU_PEMBAYARAN';
  } finally {
    if (vehicle.value) {
      vehicle.value.status = 'MENUNGGU_PEMBAYARAN';
    }
    resetting.value = false;
  }
}

async function handleSearch() {
  if (!plateInput.value) return;
  loading.value = true;
  error.value = null;
  hasSearched.value = true;

  try {
    const data = await ApiService.calculateForPlate(plateInput.value, isFiveYear.value);
    vehicle.value = data.vehicle;
    assessment.value = data.assessment;
  } catch (err: any) {
    vehicle.value = null;
    assessment.value = null;
    error.value = err.message || 'Gagal memuat data pajak kendaraan';
  } finally {
    loading.value = false;
  }
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

// Initial fetch on mount for seamless UX
handleSearch();
</script>

<style scoped>
.search-form {
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 1.25rem;
  border-radius: var(--radius-md);
}
</style>
