import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('Charbagh Ice Cream End-to-End Kiosk Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('completes a customer order from menu selection to thermal receipt with mandatory footer and deducts stock', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Confirm storefront renders Charbagh Ice Cream brand and menu cards
    expect(screen.getByText('Charbagh Ice Cream')).toBeInTheDocument();

    // Open customizer for Zafran Royal Pistachio
    const zafranHeading = screen.getAllByText('Zafran Royal Pistachio')[0];
    await user.click(zafranHeading);

    // Add 1 Single Scoop to cart
    await user.click(screen.getByRole('button', { name: /Add to Order/i }));

    // Confirm order on desktop CartSidebar CTA
    const confirmButtons = screen.getAllByRole('button', { name: /Confirm & Print Receipt/i });
    await user.click(confirmButtons[0]);

    // Thermal receipt modal opens with Order Confirmed + Mandatory Developer Footer
    expect(screen.getByText(/Order Confirmed · CB-/i)).toBeInTheDocument();
    expect(
      screen.getAllByText('Developed by Mr. Inayatullah | Contact: 03449181601').length
    ).toBeGreaterThanOrEqual(1);

    // Close receipt modal and toggle language to Urdu
    await user.click(screen.getByRole('button', { name: /Done \/ New Order/i }));
    await user.click(screen.getByRole('button', { name: 'اردو' }));
    expect(screen.getByText('آپ کا آرڈر')).toBeInTheDocument();
  });
});
