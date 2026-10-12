# EdgeSuite Browser USB Receipt Printing

## Purpose

EdgeSuite provides a product-neutral Browser USB transport for ESC/POS receipt printers. Product apps continue to own the business document and receipt payload; EdgeSuite owns browser device access, local binding, transport state and ESC/POS delivery.

Browser USB complements rather than replaces normal operating-system printing. A printer installed as a Windows queue such as `USB001` can continue to print through the browser/Windows print dialog even when direct Browser USB access is unavailable.

## Supported flow

1. A System Manager creates an **Edge Print Profile** and chooses **USB (direct browser connection)**.
2. The user opens **Devices & Printing** and explicitly chooses **Connect Printer**.
3. The browser displays its USB device chooser. The initial permission grant must come from this user action.
4. EdgeSuite stores only browser-exposed device identity metadata locally on that browser/device: vendor ID, product ID, and serial number when available.
5. EdgeSuite restores only previously authorised devices. If more than one authorised device is indistinguishable, restoration fails closed and the user selects the printer again.
6. EdgeSuite opens the device, claims a writable USB interface/OUT endpoint and sends the same canonical ESC/POS bytes used by the Serial transport.

## Safety boundaries

- Browser USB requires a secure HTTPS context and browser WebUSB support.
- The first USB permission grant always requires an explicit user action.
- `USBDevice` objects, browser permissions and OS device handles are never stored in Frappe.
- Product apps must not call `navigator.usb` directly. They use the shared EdgeSuite print adapter.
- A print failure happens after the business transaction. It must never roll back, resubmit or mutate an ERPNext accounting document.
- If the operating system or printer driver owns the USB interface and the browser cannot claim it, EdgeSuite reports the failure and the user can use normal system printing instead.
- Virtual Printer remains a Serial-path QA simulator. It is not a production USB device type and does not grant or emulate WebUSB permissions.

## Compatibility

Existing **Serial** profiles remain the default and require no data migration. `bench migrate` synchronises the expanded Select options on **Edge Print Profile**. Baud Rate remains applicable only to Serial profiles.

Browser USB support does not guarantee that every Windows USB printer queue can be claimed directly. Hardware acceptance must verify the specific printer, browser, operating-system driver, cutter, QR/barcode and encoding behaviour. Normal system printing remains the supported fallback.

## Current transport choices

- **Serial / Bluetooth** — Web Serial, including USB-serial and Bluetooth serial devices.
- **USB (direct browser connection)** — WebUSB with explicit user selection and ESC/POS transfer to a writable OUT endpoint.
- **Normal system printing** — browser/operating-system print dialog; separate from direct device transport and retained as fallback.
