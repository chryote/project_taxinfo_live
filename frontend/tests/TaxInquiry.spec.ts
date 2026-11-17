import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TaxInquiry from '../src/components/TaxInquiry.vue';

vi.mock('../src/services/api.js', () => ({
  ApiService: {
    calculateForPlate: vi.fn().mockImplementation((plate: string) => {
      if (plate.toUpperCase().includes('UNKNOWN')) {
        return Promise.reject(new Error('Vehicle not found'));
      }
      return Promise.resolve({
        vehicle: {
          plateNumber: 'B 1234 ABC',
          brand: 'Honda',
          model: 'Vario 160 CBS',
          manufactureYear: 2023,
          engineCapacityCc: 157,
          status: 'MENUNGGU_PEMBAYARAN',
          ownerName: 'Budi Santoso',
          taxDueDate: '2026-12-15',
        },
        assessment: {
          id: 'test-assessment-id',
          plateNumber: 'B 1234 ABC',
          assessmentYear: 2026,
          status: 'TERBIT',
          breakdown: {
            njkb: 22000000,
            weightCoefficient: 1.0,
            taxBase: 22000000,
            taxRate: 0.02,
            pkbPrincipal: 440000,
            swdkllj: 35000,
            stnkAdminFee: 0,
            tnkbFee: 0,
            lateMonths: 0,
            pkbPenalty: 0,
            swdklljPenalty: 0,
            totalTax: 475000,
            isElectricExempt: false,
            progressiveTier: 1,
          },
        },
      });
    }),
  },
}));

describe('TaxInquiry Component', () => {
  it('should render inquiry search input and sample buttons', () => {
    const wrapper = mount(TaxInquiry);
    expect(wrapper.text()).toContain('Inquiry Pajak Kendaraan Bermotor');
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('B 1234 ABC');
  });

  it('should show vehicle details and tax breakdown upon search', async () => {
    const wrapper = mount(TaxInquiry);
    // wait for mounted handleSearch to resolve
    await new Promise((r) => setTimeout(r, 50));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Honda Vario 160 CBS');
    expect(wrapper.text()).toContain('475.000');
  });
});
