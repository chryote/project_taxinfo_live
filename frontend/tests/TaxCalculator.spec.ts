import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TaxCalculator from '../src/components/TaxCalculator.vue';

// Mock ApiService
vi.mock('../src/services/api.js', () => ({
  ApiService: {
    simulateTax: vi.fn().mockResolvedValue({
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
    }),
  },
}));

describe('TaxCalculator Component', () => {
  it('should render the tax calculator title and elements properly', () => {
    const wrapper = mount(TaxCalculator);
    expect(wrapper.text()).toContain('Simulasi Mandiri Pajak Kendaraan');
    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.find('input[type="range"]').exists()).toBe(true);
  });

  it('should display EV incentive when Electric Vehicle option is selected', async () => {
    const wrapper = mount(TaxCalculator);
    const select = wrapper.find('select');
    await select.setValue('EV_RODA_4');

    expect(wrapper.text()).toContain('Insentif Kendaraan Ramah Lingkungan');
    expect(wrapper.text()).toContain('0%');
  });
});
