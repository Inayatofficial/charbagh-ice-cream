import React from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { Order, PrinterSettings } from '../types';

export const MANDATORY_DEVELOPER_FOOTER = 'Developed by Mr. Inayatullah | Contact: 03449181601';

interface ReceiptSlipContentProps {
  order: Order;
  settings: PrinterSettings;
  isPrintTarget?: boolean;
}

export const ReceiptSlipContent: React.FC<ReceiptSlipContentProps> = ({
  order,
  settings,
  isPrintTarget = false,
}) => {
  const dt = new Date(order.timestamp);
  const dateStr = dt.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const timeStr = dt.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const widthClass = isPrintTarget
    ? settings.paperWidth === '58mm'
      ? 'thermal-paper-58'
      : 'thermal-paper-80'
    : settings.paperWidth === '58mm'
      ? 'w-[280px]'
      : 'w-[340px]';

  return (
    <div
      className={`font-receipt tabular-nums mx-auto ${widthClass} ${
        isPrintTarget ? 'bg-white text-black' : 'bg-[#f7f2e8] px-5 py-6 text-[#1c1613]'
      }`}
    >
      {/* Header */}
      <div className="text-center">
        <div className="text-base font-bold tracking-tight uppercase">Charbagh Ice Cream</div>
        <div className="font-urdu text-sm font-bold leading-snug">چار باغ آئس کریم</div>
        {settings.shopHeaderSubtitle && (
          <div className="mt-0.5 text-[11px] opacity-85">{settings.shopHeaderSubtitle}</div>
        )}
        {settings.shopAddress && (
          <div className="text-[10px] opacity-75">{settings.shopAddress}</div>
        )}
        {settings.shopPhone && (
          <div className="text-[10px] opacity-75">Tel: {settings.shopPhone}</div>
        )}
      </div>

      <div className="my-3 border-t border-dashed border-current opacity-40" />

      {/* Order Metadata */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>ORDER ID:</span>
          <span className="font-bold">{order.orderId}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span>TIME:</span>
          <span>{timeStr}</span>
        </div>
        <div className="flex justify-between">
          <span>ORDER TYPE:</span>
          <span className="font-bold">{order.orderType}</span>
        </div>
        <div className="flex justify-between">
          <span>PAYMENT:</span>
          <span className="font-bold">{order.paymentType}</span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-current opacity-40" />

      {/* Column Headers */}
      <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase opacity-80">
        <span>QTY x ITEM</span>
        <span>AMT (PKR)</span>
      </div>

      {/* Itemized List */}
      <div className="space-y-2.5 text-[11px]">
        {order.items.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between gap-2 font-bold">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span className="shrink-0">{item.lineTotal.toLocaleString()}</span>
            </div>
            <div className="pl-3 text-[10px] opacity-80">
              <div>
                @ {item.unitPrice.toLocaleString()} · {item.size} · {item.vessel}
              </div>
              {item.secondFlavor && <div>+2nd Scoop: {item.secondFlavor}</div>}
              {item.toppings.length > 0 && <div>Toppings: {item.toppings.join(', ')}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-dashed border-current opacity-40" />

      {/* Totals */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>SUBTOTAL</span>
          <span>PKR {order.subtotal.toLocaleString()}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>DISCOUNT</span>
            <span>-PKR {order.discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>TAX</span>
          <span>PKR {order.taxAmount.toLocaleString()}</span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-dashed border-current pt-1.5 text-sm font-bold">
          <span>GRAND TOTAL</span>
          <span>PKR {order.total.toLocaleString()}</span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-current opacity-40" />

      {/* Thank You Note */}
      <div className="text-center text-[11px] leading-snug">
        <p>{settings.thankYouNote}</p>
        <p className="mt-1 text-[10px] opacity-75">
          Paper: {settings.paperWidth} Thermal · {order.adminId}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-current opacity-40" />

      {/* Mandatory Developer Footer — Very Bottom Line of Every Thermal Receipt */}
      <div className="text-center text-[10px] font-bold leading-tight tracking-tight">
        {MANDATORY_DEVELOPER_FOOTER}
      </div>
    </div>
  );
};

interface ThermalReceiptModalProps {
  order: Order;
  settings: PrinterSettings;
  onClose: () => void;
  onPrint: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  order,
  settings,
  onClose,
  onPrint,
}) => {
  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#211a15]/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/60 bg-[#fffdf7] shadow-[0_24px_48px_-12px_rgba(41,34,29,0.3)]">
        {/* Top confirmation banner */}
        <div className="flex items-center justify-between border-b border-[#dbc2b0]/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#aeeecb] text-[#0e5138]">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 id="receipt-modal-title" className="font-display text-lg font-extrabold text-[#211a15]">
                Order Confirmed · {order.orderId}
              </h2>
              <p className="text-xs font-medium text-[#554336]">
                Thermal Receipt ({settings.paperWidth}) · {order.syncedToGas ? 'Synced to Google Sheets' : 'Saved Locally'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt modal"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#f3e6dd] text-[#211a15] hover:bg-[#e5d7cf]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Thermal Slip Preview */}
        <div className="kiosk-scroll flex-1 overflow-y-auto bg-[#eee0d8]/60 px-4 py-6">
          <div className="mx-auto w-fit shadow-md">
            <div className="receipt-edge-top h-3 w-full" />
            <ReceiptSlipContent order={order} settings={settings} />
            <div className="receipt-edge-bottom h-3 w-full" />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-3 border-t border-[#dbc2b0]/70 bg-[#fff8f5] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[54px] flex-1 cursor-pointer rounded-2xl border-2 border-[#2d6a4f] bg-white px-4 text-sm font-bold text-[#2d6a4f] transition-colors hover:bg-[#aeeecb]/20"
          >
            Done / New Order
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="font-display flex min-h-[54px] flex-[1.5] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#d97706] px-5 text-sm font-extrabold text-white shadow-md transition-all hover:bg-[#b15f00] active:scale-[0.98]"
          >
            <Printer className="h-5 w-5" />
            Print Thermal Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
