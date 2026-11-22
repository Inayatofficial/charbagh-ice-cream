import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MANDATORY_DEVELOPER_FOOTER,
  ReceiptSlipContent,
  ThermalReceiptModal,
} from '../components/ThermalReceiptModal';
import { DEFAULT_PRINTER_SETTINGS, INITIAL_SAMPLE_ORDERS } from '../data/initialData';

describe('Thermal Receipt Formatting & Mandatory Footer', () => {
  it('renders required fields and exact mandatory developer credit footer at the bottom', () => {
    const order = INITIAL_SAMPLE_ORDERS[0];
    const { container } = render(
      <ReceiptSlipContent
        order={order}
        settings={DEFAULT_PRINTER_SETTINGS}
        isPrintTarget
      />
    );

    expect(screen.getByText('Charbagh Ice Cream')).toBeInTheDocument();
    expect(screen.getByText('چار باغ آئس کریم')).toBeInTheDocument();
    expect(screen.getByText(order.orderId)).toBeInTheDocument();
    expect(screen.getByText(order.orderType)).toBeInTheDocument();
    expect(screen.getByText(order.paymentType)).toBeInTheDocument();
    expect(screen.getByText(`PKR ${order.total.toLocaleString()}`)).toBeInTheDocument();
    expect(
      screen.getByText('Developed by Mr. Inayatullah | Contact: 03449181601')
    ).toBeInTheDocument();

    // Verify it is positioned as the very last text block inside the slip
    const rootDiv = container.firstElementChild as HTMLElement;
    expect(rootDiv.lastElementChild?.textContent?.trim()).toBe(MANDATORY_DEVELOPER_FOOTER);
  });

  it('applies 58mm and 80mm thermal paper print classes accurately', () => {
    const order = INITIAL_SAMPLE_ORDERS[0];
    const { container, rerender } = render(
      <ReceiptSlipContent
        order={order}
        settings={{ ...DEFAULT_PRINTER_SETTINGS, paperWidth: '58mm' }}
        isPrintTarget
      />
    );
    expect(container.firstElementChild).toHaveClass('thermal-paper-58');

    rerender(
      <ReceiptSlipContent
        order={order}
        settings={{ ...DEFAULT_PRINTER_SETTINGS, paperWidth: '80mm' }}
        isPrintTarget
      />
    );
    expect(container.firstElementChild).toHaveClass('thermal-paper-80');
  });

  it('triggers print handler from ThermalReceiptModal', async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    const onClose = vi.fn();

    render(
      <ThermalReceiptModal
        order={INITIAL_SAMPLE_ORDERS[0]}
        settings={DEFAULT_PRINTER_SETTINGS}
        onPrint={onPrint}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: /Print Thermal Receipt/i }));
    expect(onPrint).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Done \/ New Order/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
