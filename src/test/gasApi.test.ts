import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GAS_CODE_GS,
  pingGasEndpoint,
  pullAllFromGas,
  pushAdminsToGas,
  pushMenuItemToGas,
  pushOrderStatusToGas,
  pushOrderToGas,
  seedMenuToGas,
} from '../utils/gasApi';
import { INITIAL_ADMINS, INITIAL_MENU, INITIAL_SAMPLE_ORDERS } from '../data/initialData';

const VALID_URL = 'https://script.google.com/macros/s/AKfycbxTestDeployment/exec';

describe('Google Apps Script Integration (gasApi & Code.gs)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('includes required Sheets tabs and handlers in GAS_CODE_GS', () => {
    expect(GAS_CODE_GS).toContain("MENU: 'Menu'");
    expect(GAS_CODE_GS).toContain("ORDERS: 'Orders'");
    expect(GAS_CODE_GS).toContain("ADMINS: 'Admins'");
    expect(GAS_CODE_GS).toContain('function doGet(e)');
    expect(GAS_CODE_GS).toContain('function doPost(e)');
    expect(GAS_CODE_GS).toContain("action === 'createOrder'");
    expect(GAS_CODE_GS).toContain("action === 'updateOrderStatus'");
    expect(GAS_CODE_GS).toContain("action === 'upsertMenuItem'");
    expect(GAS_CODE_GS).toContain("action === 'deleteMenuItem'");
    expect(GAS_CODE_GS).toContain("action === 'seedMenu'");
    expect(GAS_CODE_GS).toContain("action === 'verifyAdmin'");
    expect(GAS_CODE_GS).toContain("action === 'updateAdmins'");
  });

  it('rejects non-HTTPS or non-script.google.com URLs without throwing', async () => {
    const pingRes = await pingGasEndpoint('http://example.com/exec');
    expect(pingRes.ok).toBe(false);
    expect(pingRes.message).toMatch(/valid/i);

    const pullRes = await pullAllFromGas('https://evil.example.com/macros');
    expect(pullRes.ok).toBe(false);
    expect(pullRes.error).toMatch(/invalid/i);
  });

  it('maps Menu, Orders, and Admins cleanly from pullAllFromGas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          menu: [
            {
              ID: 'CB-101',
              Name: 'Zafran Pistachio',
              NameUrdu: 'زعفران پستہ',
              Category: 'Scoops',
              Price: 380,
              ImageURL: '/img/zafran.jpg',
              Status: 'In Stock',
              StockQty: 5,
              LowStockThreshold: 8,
              Description: 'Saffron infused ice cream',
              DescriptionUrdu: 'زعفران اور پستہ آئس کریم',
            },
          ],
          orders: [
            {
              OrderID: 'CB-2001',
              Timestamp: '2026-11-21T12:00:00.000Z',
              ItemsJSON: JSON.stringify({
                items: INITIAL_SAMPLE_ORDERS[0].items,
                subtotal: 980,
                taxAmount: 49,
                discountAmount: 0,
              }),
              Total: 1029,
              PaymentType: 'Card',
              OrderType: 'Takeaway',
              Status: 'Preparing',
              AdminID: 'ADM-01',
            },
          ],
          admins: [
            {
              AdminID: 'ADM-01',
              Name: 'Tariq Mahmood',
              Passcode: 1122,
              Role: 'Owner',
            },
          ],
        }),
      })
    );

    const res = await pullAllFromGas(VALID_URL);
    expect(res.ok).toBe(true);
    expect(res.menu?.[0]).toMatchObject({
      id: 'CB-101',
      nameUrdu: 'زعفران پستہ',
      stockQty: 5,
      lowStockThreshold: 8,
    });
    expect(res.orders?.[0]).toMatchObject({
      orderId: 'CB-2001',
      subtotal: 980,
      taxAmount: 49,
      total: 1029,
      paymentType: 'Card',
      orderType: 'Takeaway',
      status: 'Preparing',
    });
    expect(res.admins?.[0]).toMatchObject({
      adminId: 'ADM-01',
      passcode: '1122',
      role: 'Owner',
    });
  });

  it('uses text/plain Content-Type on POST mutations to avoid GAS CORS preflight', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await pushOrderToGas(VALID_URL, INITIAL_SAMPLE_ORDERS[0]);
    await pushOrderStatusToGas(VALID_URL, 'CB-1001', 'Completed');
    await pushMenuItemToGas(VALID_URL, INITIAL_MENU[0]);
    await seedMenuToGas(VALID_URL, INITIAL_MENU.slice(0, 2));
    await pushAdminsToGas(VALID_URL, INITIAL_ADMINS);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const call of fetchMock.mock.calls) {
      const options = call[1] as RequestInit;
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    }

    const menuBody = JSON.parse(String(fetchMock.mock.calls[2][1].body));
    expect(menuBody.action).toBe('upsertMenuItem');
    expect(menuBody.item.StockQty).toBe(INITIAL_MENU[0].stockQty);
    expect(menuBody.item.LowStockThreshold).toBe(INITIAL_MENU[0].lowStockThreshold);

    const adminBody = JSON.parse(String(fetchMock.mock.calls[4][1].body));
    expect(adminBody.action).toBe('updateAdmins');
    expect(adminBody.admins).toHaveLength(2);
  });
});
