import React, { useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, Printer, Terminal } from 'lucide-react';
import { GAS_CODE_GS } from '../utils/gasApi';
import { MANDATORY_DEVELOPER_FOOTER } from './ThermalReceiptModal';

interface SetupGuideProps {
  onGoToAdminSync: () => void;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ onGoToAdminSync }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GAS_CODE_GS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard blocked
    }
  };

  const handleDownloadCode = () => {
    const blob = new Blob([GAS_CODE_GS], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="rounded-3xl border border-[#211a15]/10 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold text-[#2d6a4f]">
          Deployment & Hardware Guide · Google Sheets + 58mm / 80mm Thermal Printer
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold text-[#211a15]">
          Google Apps Script & Thermal Printer Setup
        </h1>
        <p className="mt-2 max-w-3xl text-base text-[#554336]">
          The application runs out-of-the-box in instant prototype mode with high-resolution local assets. Connect a Google Sheet in 3 minutes for live multi-terminal inventory and order syncing.
        </p>
      </div>

      {/* Step 1: Google Sheets Database Schema */}
      <div className="rounded-3xl border border-[#211a15]/10 bg-white p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#aeeecb] text-[#002114]">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <h2 className="font-display text-xl font-extrabold text-[#211a15]">
            01. Create Google Sheet with 3 Tabs
          </h2>
        </div>

        <p className="mb-4 text-sm text-[#554336]">
          Create a new Google Sheet (or run the <code className="font-receipt rounded bg-[#f3e6dd] px-1.5 py-0.5 font-bold">setupDatabase()</code> function inside <code className="font-receipt rounded bg-[#f3e6dd] px-1.5 py-0.5 font-bold">Code.gs</code> to auto-create all three tabs and headers):
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
            <h3 className="font-display text-base font-bold text-[#8d4b00]">Tab 1: Menu</h3>
            <p className="font-receipt mt-2 text-xs leading-relaxed text-[#211a15]">
              ID · Name · Category · Price · ImageURL · Status · Description
            </p>
          </div>
          <div className="rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
            <h3 className="font-display text-base font-bold text-[#8d4b00]">Tab 2: Orders</h3>
            <p className="font-receipt mt-2 text-xs leading-relaxed text-[#211a15]">
              OrderID · Timestamp · ItemsJSON · Total · PaymentType · OrderType · Status · AdminID
            </p>
          </div>
          <div className="rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
            <h3 className="font-display text-base font-bold text-[#8d4b00]">Tab 3: Admins</h3>
            <p className="font-receipt mt-2 text-xs leading-relaxed text-[#211a15]">
              AdminID · Name · Passcode · Role
            </p>
          </div>
        </div>
      </div>

      {/* Step 2: Code.gs Deployment */}
      <div className="rounded-3xl border border-[#211a15]/10 bg-white p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffdcc3] text-[#6e3900]">
              <Terminal className="h-5 w-5" />
            </span>
            <h2 className="font-display text-xl font-extrabold text-[#211a15]">
              02. Install & Deploy Code.gs Web App
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#211a15] px-4 text-xs font-bold text-white hover:bg-[#372f2a]"
            >
              {copied ? <Check className="h-4 w-4 text-[#95d4b3]" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied Code.gs' : 'Copy Code.gs'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCode}
              className="flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-xs font-bold text-[#211a15] hover:bg-[#f3e6dd]"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>

        <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#554336]">
          <li>
            In your Google Sheet, click <strong>Extensions → Apps Script</strong>.
          </li>
          <li>
            Delete any starter code in <code className="font-receipt">Code.gs</code> and paste the script below. Save the project.
          </li>
          <li>
            Select <code className="font-receipt font-bold">setupDatabase</code> from the function dropdown and click <strong>Run</strong> once to create the <strong>Menu</strong>, <strong>Orders</strong>, and <strong>Admins</strong> tabs.
          </li>
          <li>
            Click <strong>Deploy → New deployment → Web app</strong>. Set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>.
          </li>
          <li>
            Copy the generated <code className="font-receipt">https://script.google.com/macros/s/.../exec</code> URL, open the{' '}
            <button
              type="button"
              onClick={onGoToAdminSync}
              className="cursor-pointer font-bold text-[#8d4b00] underline"
            >
              Staff Portal → Google Sheets Sync
            </button>{' '}
            tab, paste the URL, and click <strong>Push Current Menu to Sheet</strong>.
          </li>
        </ol>

        <pre className="font-receipt kiosk-scroll max-h-[360px] overflow-auto rounded-2xl bg-[#1c1613] p-5 text-xs leading-relaxed text-[#fceee6]">
          <code>{GAS_CODE_GS}</code>
        </pre>
      </div>

      {/* Step 3: Thermal Printer Configuration */}
      <div className="rounded-3xl border border-[#211a15]/10 bg-white p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e6dd] text-[#211a15]">
            <Printer className="h-5 w-5" />
          </span>
          <h2 className="font-display text-xl font-extrabold text-[#211a15]">
            03. Thermal Printer Setup (58mm / 80mm)
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm text-[#554336] md:grid-cols-2">
          <div className="rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
            <h3 className="font-display font-bold text-[#211a15]">Browser Print Configuration</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>Connect your USB/Bluetooth 58mm or 80mm thermal printer and set it as the OS default printer.</li>
              <li>In Chrome/Edge Print Dialog: set <strong>Margins: None</strong> and uncheck <strong>Headers and footers</strong>.</li>
              <li>Match the roll width (58mm or 80mm) in <strong>Staff Portal → Thermal Receipt</strong>.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
            <h3 className="font-display font-bold text-[#211a15]">Silent Kiosk Printing & Footer</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>
                For touch-screen kiosks without print dialogs, launch Chrome with{' '}
                <code className="font-receipt rounded bg-[#f3e6dd] px-1 text-xs">--kiosk-printing</code>.
              </li>
              <li>
                Every printed slip automatically includes the mandatory bottom line:{' '}
                <span className="font-receipt font-bold text-[#211a15]">
                  {MANDATORY_DEVELOPER_FOOTER}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
