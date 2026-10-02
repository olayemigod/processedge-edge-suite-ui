# Android Bluetooth Receipt Printing QA

This checklist validates EdgeSuite Printing Platform over Web Serial/Bluetooth RFCOMM
with RetailEdge and ProcessEdge POSNext Extension.

## Preconditions

- Frappe/ERPNext site is served over HTTPS (or localhost for development).
- EdgeSuite UI includes the printing foundation and ES-PRINT-5 transport hardening.
- RetailEdge publishes product key `retailedge` and submitted receipt payloads.
- ProcessEdge POSNext Extension has **Enable EdgeSuite Receipt Printing** enabled when
  validating `/pos`.
- An active `Edge Print Profile` exists for purpose `Receipt`.
- Android Chrome exposes Web Serial on the test device.
- Bluetooth receipt printer is paired with Android and exposes an RFCOMM/SPP serial service.

Do not treat Android OS pairing as an EdgeSuite binding. The browser must still receive user
permission through **Connect Printer** once for the relevant Edge Print Profile.

## Required hardware matrix

Run the core cases against at least:

1. one 58 mm ESC/POS Bluetooth printer;
2. one 80 mm ESC/POS Bluetooth printer.

Where hardware supports it, also verify cutter and cash-drawer policy separately. A missing
physical cutter or drawer must not be treated as a transport failure.

## Core acceptance cases

### 1. First connection

1. Open **Devices & Printing** with the expected product/company/branch context.
2. Confirm the context chips are correct.
3. Confirm the expected print profile resolves.
4. Tap **Connect Printer**.
5. Select the intended Bluetooth serial printer in the browser picker.
6. Confirm status becomes **Connected**.
7. Tap **Test Print**.

Pass when the exact selected printer prints one diagnostic receipt and the page remains
connected.

### 2. Reload and reconnect

1. Reload the page.
2. Confirm **Local binding** reports saved on this device.
3. Tap **Reconnect**.
4. Run **Test Print** again.

Pass when no new browser device picker is needed and the same printer reconnects.

### 3. Physical disconnect

1. Connect the printer.
2. Power the printer off or disconnect Bluetooth.
3. Observe platform status.
4. Power/reconnect the printer.
5. Use **Reconnect**.

Pass when the stale Connected state is cleared and reconnect succeeds without selecting a
different device.

### 4. RetailEdge submitted receipt

1. Submit a Sales Invoice through RetailEdge.
2. Use **Print Receipt**.
3. Verify merchant/company header, invoice reference, customer, items, totals, payment/
   outstanding context, QR policy, feed and cut policy.
4. Repeat with a high-value NGN invoice.

Pass when monetary values wrap rather than truncate and printing does not mutate the invoice.

### 5. POSNext online checkout

1. Enable EdgeSuite receipt printing.
2. Keep POSNext native auto-print and silent print disabled.
3. Complete an online sale.
4. Confirm the success dialog offers **Print Receipt**.
5. Print manually.
6. Enable **Auto-print with EdgeSuite** and complete another fresh online sale.

Pass when the submitted Sales Invoice prints once and transaction success is not affected by
printer failure.

### 6. Duplicate-print protection

Validate each policy combination:

- POSNext native auto-print ON + EdgeSuite auto-print requested;
- POSNext silent print ON + EdgeSuite auto-print requested;
- both native modes OFF + EdgeSuite auto-print ON.

Pass when EdgeSuite auto-print is effective only in the third case and one successful sale does
not automatically print twice.

### 7. Offline POS sale and later sync

1. Put POSNext into offline mode.
2. Complete an offline/local sale.
3. Print through POSNext's existing offline print flow if required.
4. Restore connectivity and allow background invoice sync.

Pass when the background `offline_id` submission does **not** trigger an EdgeSuite auto-print.

### 8. Company/branch profile resolution

Create distinct printer profiles for two branches or companies and switch operating context.

Pass when each submitted document resolves the profile for the document's authoritative
company/branch, not stale browser context.

### 9. 58 mm / 80 mm profile behavior

Verify, per profile:

- configured paper width;
- characters per line;
- copies;
- QR enabled/disabled;
- feed lines;
- partial/full cut where hardware supports it.

Pass when receipt layout follows the resolved profile without product-specific printer code.

### 10. Unsupported browser / insecure origin

Open the setup page in a browser without Web Serial support and, separately, on an insecure
non-localhost HTTP origin.

Pass when the page shows **Unsupported** guidance, hides direct Connect, and no document or
transaction state is changed.

## Failure diagnostics

Capture these details for any failure:

- Android version and browser version;
- printer make/model and paper width;
- whether the printer was already OS-paired;
- Edge Print Profile name and scope;
- Company / Branch / Product context;
- setup-page status and error text;
- whether failure happened at first connect, reconnect, write, physical disconnect, or print;
- whether the same printer works through POSNext browser/QZ/native printing.

A print failure after sale submission is an output failure only. Never repair it by cancelling,
resubmitting, or mutating the ERPNext transaction.
