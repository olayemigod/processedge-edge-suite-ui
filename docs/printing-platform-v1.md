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

The V1 implementation provides:

- explicit shared printer states and secure-context capability detection;
- Web Serial discovery/authorization, connect/disconnect, device-local binding, and reconnect;
- serialized/backpressure-aware chunked writes so concurrent jobs cannot interleave;
- deterministic error codes and physical-disconnect tracking;
- ESC/POS receipt encoding for 58 mm and 80 mm printers;
- explicit UTF-8 or ASCII-safe text encoding policy;
- deterministic, fail-closed printer-profile resolution;
- product-owned Company/Branch scope validation;
- testable browser abstractions with no physical printer requirement in CI.

## Web Serial boundary

The transport deliberately does not store browser `SerialPort` objects in Frappe. Browser-granted
device access is local to the browser/origin. Server-side Print Profiles will store policy and
printer preferences, while a later device-binding layer will map those profiles to ports already
authorized on that device.

The first user grant must be initiated from an explicit user action. Previously authorized ports
are restored through the device-binding layer. Writes are queued per transport and split into
bounded chunks while respecting WritableStream backpressure.

## ESC/POS foundation now implemented

The shared runtime now accepts a product-neutral normalized receipt document with 58 mm and 80 mm
paper profiles. Supported primitives are text, rules, fixed/flexible rows, feeds, QR, CODE128,
packed monochrome raster images, paper cut, and cash-drawer pulse.

The manager can encode a normalized receipt and send it through the selected registered transport.
Products therefore provide document data rather than raw ESC/POS bytes. V1 profiles explicitly
choose **ASCII Safe** or **UTF-8**. ASCII Safe converts the naira sign to `NGN`, transliterates
common accented Latin text, and replaces unsupported symbols rather than printing corrupt bytes.

## Profile, binding, and setup layer now implemented

EdgeSuite now also provides:

- **Edge Print Profile** as server-side printing policy/configuration only;
- scope-aware profile resolution for Global, Company, Branch, and User scopes;
- optional product-specific profiles validated against the current user's available products;
- device-local binding that stores browser-exposed port identity metadata only;
- restoration through previously authorised Web Serial ports;
- fail-closed handling when multiple authorised ports are indistinguishable;
- a shared `EdgePrinterSetupCard` with Connect, Reconnect, Test Print, Disconnect, and Forget actions;
- a standard **Devices & Printing** page at `/app/edge-printing`;
- optional route context through `product_key`, `company`, `branch`, and `purpose`.

Server profiles never store browser `SerialPort` objects, Bluetooth MAC addresses, or browser
permissions. The local device binding and server policy remain separate by design.

## Not included in this slice

The following remain subsequent milestones:

- browser-side merchant-logo preprocessing into packed monochrome raster bytes;
- printer-specific legacy ESC/POS code-page tables beyond UTF-8 / ASCII Safe;
- automatic reconnect UX beyond explicit reconnect and disconnect-state tracking;
- network printer and native Android bridge adapters.

RetailEdge receipt integration and POSNext web-app consumption are implemented downstream while
remaining outside EdgeSuite's product-neutral business layer.

## Product integration rule

Product applications must not call `navigator.serial` directly. They consume EdgeSuite's shared
printing adapter so device handling can evolve without product-specific rewrites.


## V1 configuration guardrails

The V1 profile form exposes only the implementation that exists today: **Receipt + Serial +
ESC/POS**. System/Browser profile modes and logo output are deliberately not advertised as active
capabilities. Product keys are normalized, Company/Branch/User scope values use validated links,
58/80 mm width changes receive sensible character-width defaults, and equal effective profile
priority fails closed instead of selecting an arbitrary printer.

The diagnostic Test Print exercises width/wrapping, encoding, QR, CODE128, feed and cutter policy.

Company/Branch-scoped profiles must declare a product key so the owning product can authorize
that business context. Only truly Global or current-User profiles may remain product-neutral.
Legacy blank-product Company/Branch rows are ignored at runtime until corrected.
