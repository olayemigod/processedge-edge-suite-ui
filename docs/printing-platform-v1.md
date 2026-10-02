# EdgeSuite Shared Printing Platform V1

## Purpose

EdgeSuite owns the reusable device-printing capability for ProcessEdge product applications.
RetailEdge is the first consumer, but the transport and device layer must remain product-neutral so
VetEdge, EduEdge, PEdge POS, Hospitality, and future products can reuse the same runtime.

## Ownership boundary

- **EdgeSuite UI** owns printer capability detection, transport adapters, printer connection state,
  device-local authorization/binding, print rendering primitives, shared print UX, and the public
  browser SDK.
- **Product apps** own document payloads, receipt templates, product permissions, workflow meaning,
  and the decision that a business event is ready to print.
- **CoreEdge** may govern tenant/product entitlement later, but it does not own browser device
  connections, ESC/POS commands, paper widths, or printer-specific state.

A successful business transaction must never be rolled back because printing failed.

## V1 contract

The browser runtime exposes the shared adapter through both:

```javascript
window.EdgeSuiteUI.getAdapter("print")
window.EdgeSuiteUI.print
```

The first implementation slice provides:

- explicit shared printer states;
- secure-context capability detection;
- transport registration through a shared print manager;
- Web Serial discovery/authorization;
- Web Serial connect/disconnect;
- byte-oriented writes suitable for the later ESC/POS encoder;
- deterministic error codes for unsupported, unselected, disconnected, connect, write, and
  disconnect failures;
- testable browser abstractions with no physical printer requirement in CI.

## Web Serial boundary

The transport deliberately does not store browser `SerialPort` objects in Frappe. Browser-granted
device access is local to the browser/origin. Server-side Print Profiles will store policy and
printer preferences, while a later device-binding layer will map those profiles to ports already
authorized on that device.

The first user grant must be initiated from an explicit user action. Previously authorized ports
are exposed through the transport's `authorizedPorts()` method and can later support reconnect
flows.

## ESC/POS foundation now implemented

The shared runtime now accepts a product-neutral normalized receipt document with 58 mm and 80 mm
paper profiles. Supported primitives are text, rules, fixed/flexible rows, feeds, QR, CODE128,
packed monochrome raster images, paper cut, and cash-drawer pulse.

The manager can encode a normalized receipt and send it through the selected registered transport.
Products therefore provide document data rather than raw ESC/POS bytes. Text encoding remains
injectable because low-cost printers differ in code-page and UTF-8 support.

## Not included in this slice

The following remain subsequent milestones:

- higher-level receipt template composition and product adapters;
- browser-side logo/image preprocessing into packed monochrome raster bytes;
- code-page profiles and printer-specific text encoding;
- persistent Edge Print Profile DocType;
- IndexedDB device binding;
- shared Devices & Printing UI;
- automatic reconnect and connection event UX;
- RetailEdge transaction integration;
- network printer and native Android bridge adapters.

## Product integration rule

Product applications must not call `navigator.serial` directly. They consume EdgeSuite's shared
printing adapter so device handling can evolve without product-specific rewrites.
