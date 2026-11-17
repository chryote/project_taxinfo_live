<template>
  <div class="vector-search">
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span>AI Vehicle Valuation & Dispute Search (pgvector HNSW)</span>
        </div>
        <span class="badge badge-primary">pgvector 128-Dim Cosine Distance</span>
      </div>

      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
        Ketika terdapat sengketa NJKB (penilaian nilai jual kendaraan tidak standar/impor/modifikasi), sistem menggunakan pencarian vektor berdimensi tinggi (<strong>pgvector</strong> dengan indeks <em>HNSW</em>) untuk mencari kendaraan terdekat secara karakteristik teknis dan rentang harga dalam waktu sub-milidetik.
      </p>

      <form @submit.prevent="executeSearch" style="margin-bottom: 1.5rem;">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <input
            v-model="queryText"
            type="text"
            class="form-input"
            placeholder="Cari deskripsi / spesifikasi: 'mobil listrik keluarga', 'motor matic 150cc', 'truk kargo diesel'..."
            style="flex: 1; min-width: 250px;"
          />
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Memproses Vektor...</span>
            <span v-else>Cari Kesamaan Vektor</span>
          </button>
        </div>

        <!-- Quick Query Presets -->
        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">Uji Cepat Prompt AI:</span>
          <button
            v-for="preset in presets"
            :key="preset"
            type="button"
            class="btn btn-outline"
            style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
            @click="queryText = preset; executeSearch();"
          >
            "{{ preset }}"
          </button>
        </div>
      </form>

      <!-- Results Table -->
      <div v-if="results.length > 0" class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Plat Nomor</th>
              <th>Merk & Model Kendaraan</th>
              <th>Kategori</th>
              <th>Tahun</th>
              <th>NJKB Basis</th>
              <th>Estimasi PKB</th>
              <th style="text-align: right;">Skor Kesamaan pgvector</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in results" :key="item.plateNumber">
              <td class="mono" style="font-weight: 700;">{{ item.plateNumber }}</td>
              <td><strong>{{ item.brand }}</strong> {{ item.model }}</td>
              <td>
                <span v-if="item.vehicleType.startsWith('EV')" class="badge badge-eco">EV</span>
                <span v-else-if="item.vehicleType === 'RODA_2'" class="badge badge-primary">R2</span>
                <span v-else-if="item.vehicleType === 'RODA_4'" class="badge badge-primary">R4</span>
                <span v-else class="badge badge-warning">BUS/TRUK</span>
              </td>
              <td>{{ item.manufactureYear }}</td>
              <td class="mono">{{ formatRupiah(item.njkb) }}</td>
              <td class="mono" style="font-weight: 700; color: var(--primary);">
                {{ formatRupiah(item.estimatedPkb) }}
              </td>
              <td style="text-align: right;">
                <span
                  class="badge"
                  :class="item.similarity > 0.85 ? 'badge-success' : item.similarity > 0.65 ? 'badge-primary' : 'badge-warning'"
                  style="font-family: var(--font-mono); font-size: 0.8rem;"
                >
                  {{ (item.similarity * 100).toFixed(1) }}% Match
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!loading" style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
        Ketik kata kunci atau klik salah satu prompt preset di atas untuk mengeksekusi pencarian kemiripan vektor.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApiService } from '../services/api.js';
import { VectorSearchResult } from '../types/index.js';

const queryText = ref('mobil listrik keluarga');
const loading = ref(false);
const results = ref<VectorSearchResult[]>([]);

const presets = [
  'mobil listrik keluarga',
  'motor matic 150cc',
  'suv bensin 1500cc',
  'truk kargo diesel',
  'wuling ev mini',
];

async function executeSearch() {
  if (!queryText.value) return;
  loading.value = true;

  try {
    results.value = await ApiService.searchSimilarity({
      queryText: queryText.value,
      limit: 5,
    });
  } catch (err) {
    console.error('Vector search error:', err);
  } finally {
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

// Initial vector query
executeSearch();
</script>
