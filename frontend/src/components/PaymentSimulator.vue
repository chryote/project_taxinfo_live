<template>
  <div class="payment-modal-backdrop" @click.self="$emit('close')">
    <div class="payment-modal card">
      <div class="card-header">
        <div class="card-title">
          <span>Simulasi Pembayaran PKB (RabbitMQ Async Broker)</span>
        </div>
        <button class="btn btn-outline" style="padding: 0.25rem 0.6rem;" @click="$emit('close')">Tutup</button>
      </div>

      <!-- Stage 1: Form Selection -->
      <div v-if="step === 'FORM'">
        <div style="background: #f1f5f9; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Kendaraan yang Akan Dibayar:</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">
            {{ vehicle.brand }} {{ vehicle.model }} (<span class="mono">{{ vehicle.plateNumber }}</span>)
          </div>
          <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 0.85rem; color: #475569;">Total Tagihan PKB:</span>
            <span class="mono" style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">
              {{ formatRupiah(assessment.breakdown.totalTax) }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Saluran Pembayaran Elektronik</label>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; background: #ffffff;">
              <input type="radio" value="QRIS" v-model="selectedMethod" />
              <div>
                <strong>QRIS Dinamis (GoPay, OVO, ShopeePay, Mobile Banking)</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Instan settlement via Gerbang Pembayaran Nasional</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; background: #ffffff;">
              <input type="radio" value="VIRTUAL_ACCOUNT" v-model="selectedMethod" />
              <div>
                <strong>Virtual Account Bank (BCA / Mandiri / BNI / BRI)</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Nomor VA otomatis terverifikasi sistem Samsat</div>
              </div>
            </label>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
          <button class="btn btn-outline" @click="$emit('close')">Batal</button>
          <button class="btn btn-eco" :disabled="loading" @click="submitPayment">
            <span v-if="loading">Memproses...</span>
            <span v-else>Konfirmasi & Kirim ke RabbitMQ</span>
          </button>
        </div>
      </div>

      <!-- Stage 2: Async Processing Timeline -->
      <div v-else-if="step === 'PROCESSING'" style="text-align: center; padding: 2rem 1rem;">
        <h4 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem;">
          Pesan Pembayaran Diterima Broker RabbitMQ
        </h4>
        <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 400px; margin: 0 auto 1.5rem;">
          Job <code class="mono">{{ transaction?.paymentReference }}</code> telah masuk ke antrean <code class="mono">samsat.tax.payment</code>. Worker sedang menyelesaikan rekonsiliasi dan verifikasi database secara non-blocking.
        </p>
        <div style="display: flex; justify-content: center; gap: 1rem; font-size: 0.8rem;">
          <span class="badge badge-primary">Queue: samsat.tax.payment</span>
          <span class="badge badge-warning">Worker: Ingesting</span>
        </div>
      </div>

      <!-- Stage 3: Settled / Digital e-STNK Proof -->
      <div v-else-if="step === 'SETTLED'">
        <div style="background: var(--eco-light); border: 1px solid #6ee7b7; border-radius: var(--radius-md); padding: 1.25rem; text-align: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--eco);">
            Pembayaran Pajak Berhasil & Lunas
          </h3>
          <p style="font-size: 0.85rem; color: #047857;">
            Data kepemilikan dan status kendaraan di Samsat Online telah diperbarui ke status <strong>LUNAS</strong>.
          </p>
        </div>

        <!-- Digital Proof of Tax Payment (Tanda Bukti Pelunasan Kewajiban Pembayaran - e-STNK) -->
        <div style="border: 2px solid #0f172a; border-radius: var(--radius-md); padding: 1.25rem; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            <div>
              <div style="font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
                REPUBLIK INDONESIA - KEPOLISIAN NEGARA RI / BAPENDA
              </div>
              <div style="font-size: 0.95rem; font-weight: 800;">
                TANDA BUKTI PELUNASAN KEWAJIBAN PEMBAYARAN ELEKTRONIK (e-STNK)
              </div>
            </div>
            <div class="mono" style="font-size: 0.8rem; text-align: right; color: var(--text-muted);">
              VALIDASI RESMI
            </div>
          </div>

          <div class="grid grid-cols-2" style="font-size: 0.85rem; gap: 0.5rem; margin-bottom: 1rem;">
            <div>Plat Nomor: <strong class="mono">{{ vehicle.plateNumber }}</strong></div>
            <div>Ref Pembayaran: <strong class="mono">{{ transaction?.paymentReference }}</strong></div>
            <div>Nama Pemilik: <strong>{{ vehicle.ownerName }}</strong></div>
            <div>Metode: <strong>{{ selectedMethod }}</strong></div>
            <div>Jumlah Dibayar: <strong class="mono">{{ formatRupiah(assessment.breakdown.totalTax) }}</strong></div>
            <div>Status: <span class="badge badge-success">LUNAS / SETTLED</span></div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 0.75rem; border-radius: var(--radius-sm); border: 1px dashed var(--border);">
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Digital Token QR Validasi:<br />
              <strong class="mono" style="font-size: 0.85rem; color: #0f172a;">{{ transaction?.eStnkQrToken }}</strong>
            </div>
            <div class="mono" style="font-size: 0.8rem; font-weight: 700; color: var(--primary);">
              [QR VERIFIED]
            </div>
          </div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" @click="$emit('payment-completed')">
            Selesai & Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApiService } from '../services/api.js';
import { Vehicle, TaxAssessment, PaymentTransaction } from '../types/index.js';

const props = defineProps<{
  vehicle: Vehicle;
  assessment: TaxAssessment;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'payment-completed'): void;
}>();

const selectedMethod = ref<'QRIS' | 'VIRTUAL_ACCOUNT'>('QRIS');
const step = ref<'FORM' | 'PROCESSING' | 'SETTLED'>('FORM');
const loading = ref(false);
const transaction = ref<PaymentTransaction | null>(null);

async function submitPayment() {
  loading.value = true;
  step.value = 'PROCESSING';

  try {
    const tx = await ApiService.payTax({
      assessmentId: props.assessment.id,
      plateNumber: props.vehicle.plateNumber,
      amount: props.assessment.breakdown.totalTax,
      paymentMethod: selectedMethod.value,
    });
    transaction.value = tx;

    // Simulate async RabbitMQ worker turnaround time (700ms)
    setTimeout(() => {
      step.value = 'SETTLED';
      loading.value = false;
    }, 700);
  } catch (err) {
    console.error('Payment error:', err);
    alert('Pembayaran gagal dikirim ke antrean.');
    step.value = 'FORM';
    loading.value = false;
  }
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}
</script>

<style scoped>
.payment-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.payment-modal {
  width: 100%;
  max-width: 600px;
  background: #ffffff;
  max-height: 90vh;
  overflow-y: auto;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
</style>
