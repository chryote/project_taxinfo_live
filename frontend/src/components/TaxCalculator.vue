<template>
  <div class="tax-calculator">
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span>Simulasi Mandiri Pajak Kendaraan & Kebijakan Progresif</span>
        </div>
        <span class="badge badge-eco">Permendagri No. 6/2023 & UU HKPD</span>
      </div>

      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
        Hitung simulasi estimasi beban pajak tahunan untuk kendaraan baru, tarif progresif bertingkat, insentif mobil listrik (EV 0%), serta estimasi denda keterlambatan.
      </p>

      <div class="grid grid-cols-2" style="gap: 2rem;">
        <!-- Left: Input Controls -->
        <div class="controls-panel">
          <div class="form-group">
            <label class="form-label">Kategori Kendaraan</label>
            <select v-model="form.vehicleType" class="form-select" @change="recalculate">
              <option value="RODA_2">Sepeda Motor R2 (Bensin/ICE)</option>
              <option value="RODA_4">Mobil Penumpang R4 (Sedan, Minibus, SUV)</option>
              <option value="BUS_TRUK">Bus / Truk / Kendaraan Barang</option>
              <option value="EV_RODA_2">Motor Listrik (KBLBB - 0% PKB)</option>
              <option value="EV_RODA_4">Mobil Listrik (KBLBB - 0% PKB)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">
              Nilai Jual Kendaraan Bermotor (NJKB):
              <strong class="mono" style="color: var(--primary);">{{ formatRupiah(form.njkb) }}</strong>
            </label>
            <input
              type="range"
              v-model.number="form.njkb"
              min="5000000"
              max="1000000000"
              step="5000000"
              style="width: 100%; cursor: pointer;"
              @input="recalculate"
            />
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
              <span>Rp 5 Juta</span>
              <span>Rp 500 Juta</span>
              <span>Rp 1 Miliar</span>
            </div>
          </div>

          <div class="grid grid-cols-2" style="gap: 1rem;">
            <div class="form-group" v-if="!isEV">
              <label class="form-label">Kapasitas Mesin (CC)</label>
              <input
                type="number"
                v-model.number="form.engineCapacityCc"
                class="form-input mono"
                min="0"
                max="10000"
                step="50"
                @input="recalculate"
              />
            </div>
            <div class="form-group" :style="isEV ? 'grid-column: span 2;' : ''">
              <label class="form-label">Kepemilikan Ke-N (Pajak Progresif)</label>
              <select v-model.number="form.ownershipSequence" class="form-select" @change="recalculate">
                <option :value="1">Kendaraan Ke-1 (Tarif 2.0%)</option>
                <option :value="2">Kendaraan Ke-2 (Tarif 2.5%)</option>
                <option :value="3">Kendaraan Ke-3 (Tarif 3.0%)</option>
                <option :value="4">Kendaraan Ke-4 (Tarif 3.5%)</option>
                <option :value="5">Kendaraan Ke-5 dst (Tarif 4.0%+)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              Bulan Keterlambatan:
              <strong class="mono" :style="form.lateMonths > 0 ? 'color: var(--danger);' : ''">
                {{ form.lateMonths }} Bulan
              </strong>
            </label>
            <input
              type="range"
              v-model.number="form.lateMonths"
              min="0"
              max="24"
              step="1"
              style="width: 100%; cursor: pointer;"
              @input="recalculate"
            />
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
              <input type="checkbox" v-model="form.isFiveYearRenewal" @change="recalculate" />
              <span>Perpanjangan STNK & Ganti Plat 5 Tahunan (Biaya PNBP)</span>
            </label>
          </div>
        </div>

        <!-- Right: Real-time Live Calculation Output -->
        <div class="output-panel">
          <div v-if="isEV" style="background: var(--eco-light); border: 1px solid #6ee7b7; color: var(--eco); padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem;">
            <strong>Insentif Kendaraan Ramah Lingkungan:</strong> Berdasarkan Permendagri No. 6/2023, tarif PKB kendaraan listrik ditetapkan <strong>0%</strong>. Bebas pajak pokok progresif.
          </div>

          <div style="background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem;">
              Rincian Perhitungan Pajak
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.9rem;">
              <span style="color: var(--text-muted);">Dasar Pengenaan PKB:</span>
              <span class="mono">{{ formatRupiah(result.taxBase) }}</span>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.9rem;">
              <span style="color: var(--text-muted);">
                Tarif PKB
                <span v-if="result.isElectricExempt" class="badge badge-eco" style="margin-left: 0.25rem;">0% EV</span>
                <span v-else class="badge badge-primary" style="margin-left: 0.25rem;">{{ (result.taxRate * 100).toFixed(1) }}%</span>
              </span>
              <span class="mono" style="font-weight: 700;">{{ formatRupiah(result.pkbPrincipal) }}</span>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.9rem;">
              <span style="color: var(--text-muted);">SWDKLLJ (Asuransi Jasa Raharja):</span>
              <span class="mono">{{ formatRupiah(result.swdkllj) }}</span>
            </div>

            <div v-if="result.stnkAdminFee > 0" style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.9rem;">
              <span style="color: var(--text-muted);">PNBP STNK & TNKB (5 Tahunan):</span>
              <span class="mono">{{ formatRupiah(result.stnkAdminFee + result.tnkbFee) }}</span>
            </div>

            <div v-if="result.lateMonths > 0" style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.9rem; color: var(--danger);">
              <span>Denda Sanksi Administratif ({{ result.lateMonths }} bln):</span>
              <span class="mono" style="font-weight: 700;">
                {{ formatRupiah(result.pkbPenalty + result.swdklljPenalty) }}
              </span>
            </div>

            <div style="border-top: 2px dashed var(--border); margin-top: 1rem; padding-top: 1rem; display: flex; justify-content: space-between; align-items: baseline;">
              <div>
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                  Total Estimasi Pajak
                </div>
                <div style="font-size: 0.75rem; color: var(--text-sub);">Termasuk SWDKLLJ & PNBP</div>
              </div>
              <div class="mono" style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">
                {{ formatRupiah(result.totalTax) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ApiService } from '../services/api.js';
import { VehicleType, TaxBreakdown } from '../types/index.js';

const form = ref({
  vehicleType: 'RODA_4' as VehicleType,
  njkb: 175000000,
  engineCapacityCc: 1500,
  ownershipSequence: 1,
  lateMonths: 0,
  isFiveYearRenewal: false,
});

const isEV = computed(() => {
  return form.value.vehicleType === 'EV_RODA_2' || form.value.vehicleType === 'EV_RODA_4';
});

const result = ref<TaxBreakdown>({
  njkb: 175000000,
  weightCoefficient: 1.0,
  taxBase: 175000000,
  taxRate: 0.02,
  pkbPrincipal: 3500000,
  swdkllj: 143000,
  stnkAdminFee: 0,
  tnkbFee: 0,
  lateMonths: 0,
  pkbPenalty: 0,
  swdklljPenalty: 0,
  totalTax: 3643000,
  isElectricExempt: false,
  progressiveTier: 1,
});

async function recalculate() {
  try {
    const data = await ApiService.simulateTax({
      njkb: form.value.njkb,
      vehicleType: form.value.vehicleType,
      engineCapacityCc: isEV.value ? 0 : form.value.engineCapacityCc,
      ownershipSequence: form.value.ownershipSequence,
      lateMonths: form.value.lateMonths,
      isFiveYearRenewal: form.value.isFiveYearRenewal,
      isElectric: isEV.value,
    });
    result.value = data;
  } catch (err) {
    console.error('Recalculate error:', err);
  }
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

recalculate();
</script>

<style scoped>
.controls-panel {
  background: #f8fafc;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}
</style>
