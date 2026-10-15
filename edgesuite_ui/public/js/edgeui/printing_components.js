import { defineComponent, h } from "vue";

function runtimeAdapter(component) {
  return component.adapter || globalThis?.EdgeSuiteUI?.print || null;
}

function errorMessage(error) {
  return String(error?.message || error || "Printer operation failed.");
}

function statusLabel(status = {}) {
  const state = String(status.state || "not_configured").replaceAll("_", " ");
  return state.replace(/\b\w/g, (character) => character.toUpperCase());
}

function button(label, onClick, { primary = false, disabled = false, danger = false } = {}) {
  return h(
    "button",
    {
      type: "button",
      class: [
        "edge-button",
        primary ? "edge-button--primary" : "edge-button--secondary",
        danger ? "edge-printer-setup__danger" : "",
      ],
      disabled,
      onClick,
    },
    label,
  );
}

function directTransport(profile) {
  const transport = String(profile?.transport || "").toLowerCase();
  return ["serial", "usb"].includes(transport) ? transport : "";
}

function capabilityFor(capabilities, transport) {
  if (transport === "serial") {
    return { supported: Boolean(capabilities.webSerial), reason: capabilities.serialReason };
  }
  if (transport === "usb") {
    return { supported: Boolean(capabilities.webUsb), reason: capabilities.usbReason };
  }
  return { supported: false, reason: "unsupported_transport" };
}

export const EdgePrinterSetupCard = defineComponent({
  name: "EdgePrinterSetupCard",
  props: {
    adapter: { type: Object, default: null },
    title: { type: String, default: "Receipt Printer" },
    purpose: { type: String, default: "Receipt" },
    productKey: { type: String, default: "" },
    company: { type: String, default: "" },
    branch: { type: String, default: "" },
    autoResolve: { type: Boolean, default: true },
  },
  emits: ["status-change", "profile-resolved", "printed", "error"],
  data() {
    return {
      profile: null,
      status: { state: "not_configured", connected: false, configured: false },
      loading: false,
      busy: false,
      error: "",
      bindingPresent: false,
    };
  },
  mounted() {
    if (this.autoResolve) this.refresh().catch(() => {});
  },
  methods: {
    getAdapter() {
      const adapter = runtimeAdapter(this);
      if (!adapter) throw new Error("EdgeSuite shared printing is unavailable.");
      return adapter;
    },
    context() {
      return {
        purpose: this.purpose,
        productKey: this.productKey,
        company: this.company,
        branch: this.branch,
      };
    },
    emitStatus() {
      this.$emit("status-change", {
        profile: this.profile,
        status: this.status,
        bindingPresent: this.bindingPresent,
      });
    },
    setError(error) {
      this.error = errorMessage(error);
      this.$emit("error", error);
    },
    async refresh() {
      const adapter = this.getAdapter();
      this.loading = true;
      this.error = "";
      try {
        this.profile = await adapter.profiles.resolve(this.context());
        this.$emit("profile-resolved", this.profile);
        if (!this.profile) {
          this.status = { state: "not_configured", connected: false, configured: false };
          this.bindingPresent = false;
          this.emitStatus();
          return null;
        }

        const transport = directTransport(this.profile);
        if (!transport) {
          this.status = {
            state: "not_configured",
            connected: false,
            configured: true,
            transport: this.profile.transport,
          };
          this.bindingPresent = false;
          this.emitStatus();
          return this.profile;
        }

        const capabilities = adapter.detectCapabilities?.() || {};
        const capability = capabilityFor(capabilities, transport);
        if (!capability.supported) {
          this.bindingPresent = false;
          this.status = {
            state: "unsupported",
            connected: false,
            configured: true,
            supported: false,
            transport,
            reason: capability.reason || "api_unavailable",
          };
          this.emitStatus();
          return this.profile;
        }

        const restored = transport === "usb"
          ? await adapter.devices.restoreUsb(this.profile.name)
          : await adapter.devices.restoreSerial(this.profile.name);
        this.bindingPresent = Boolean(restored);
        this.status = adapter.getStatus(transport);
        this.emitStatus();
        return this.profile;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async connect() {
      const adapter = this.getAdapter();
      if (!this.profile) await this.refresh();
      if (!this.profile) throw new Error("No active print profile is configured for this context.");
      const transport = directTransport(this.profile);
      if (!transport) {
        throw new Error("This print profile does not use a directly connected printer.");
      }
      const capabilities = adapter.detectCapabilities?.() || {};
      const capability = capabilityFor(capabilities, transport);
      if (!capability.supported) {
        if (capability.reason === "insecure_context") {
          throw new Error("Direct printer access requires a secure HTTPS connection.");
        }
        throw new Error(
          transport === "usb"
            ? "This browser cannot connect directly to USB printers. Use normal system printing or a supported browser."
            : "This browser cannot access serial or Bluetooth receipt printers from the web.",
        );
      }

      this.busy = true;
      this.error = "";
      try {
        if (transport === "usb") {
          await adapter.devices.requestAndBindUsb(this.profile.name);
        } else {
          await adapter.devices.requestAndBindSerial(this.profile.name);
        }
        this.bindingPresent = true;
        this.status = await adapter.connect(
          transport,
          adapter.profiles.connectionOptions(this.profile),
        );
        this.emitStatus();
        return this.status;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.busy = false;
      }
    },
    async reconnect() {
      const adapter = this.getAdapter();
      if (!this.profile) await this.refresh();
      if (!this.profile) throw new Error("No active print profile is configured for this context.");
      const transport = directTransport(this.profile);
      if (!transport) throw new Error("This print profile does not use a directly connected printer.");

      this.busy = true;
      this.error = "";
      try {
        const restored = transport === "usb"
          ? await adapter.devices.connectBoundUsb(
              this.profile.name,
              adapter.profiles.connectionOptions(this.profile),
            )
          : await adapter.devices.connectBoundSerial(
              this.profile.name,
              adapter.profiles.connectionOptions(this.profile),
            );
        this.bindingPresent = true;
        this.status = restored.status;
        this.emitStatus();
        return this.status;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.busy = false;
      }
    },
    async disconnect() {
      const adapter = this.getAdapter();
      const transport = directTransport(this.profile) || "serial";
      this.busy = true;
      this.error = "";
      try {
        this.status = await adapter.disconnect(transport);
        this.emitStatus();
        return this.status;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.busy = false;
      }
    },
    async forget() {
      const adapter = this.getAdapter();
      if (!this.profile) return false;
      const transport = directTransport(this.profile) || "serial";
      this.busy = true;
      this.error = "";
      try {
        if (this.status.connected) await adapter.disconnect(transport);
        const removed = adapter.devices.forget(this.profile.name);
        this.bindingPresent = false;
        this.status = adapter.getStatus(transport);
        this.emitStatus();
        return removed;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.busy = false;
      }
    },
    async testPrint() {
      const adapter = this.getAdapter();
      if (!this.profile) await this.refresh();
      if (!this.profile) throw new Error("No active print profile is configured for this context.");
      const transport = directTransport(this.profile);
      if (!transport) throw new Error("This print profile does not use a directly connected printer.");
      if (!this.status.connected) await this.reconnect();

      this.busy = true;
      this.error = "";
      try {
        const receiptOptions = adapter.profiles.receiptOptions(this.profile);
        const blocks = [
          { type: "text", text: "EdgeSuite Printer Test", align: "center", bold: true },
          { type: "rule" },
          { type: "text", text: this.profile.profileName, align: "center" },
          {
            type: "text",
            text: `${this.profile.paperWidth}mm · ${this.profile.charactersPerLine} chars/line`,
            align: "center",
          },
          { type: "text", text: `Connection: ${transport.toUpperCase()} OK`, align: "center", bold: true },
          {
            type: "text",
            text: `Encoding: ${this.profile.textEncoding || "ascii-safe"}`,
            align: "center",
          },
          { type: "text", text: "Currency sample: NGN 1,234.56 | ₦", align: "center" },
          { type: "qr", value: "EDGE-PRINT-TEST", size: 4, align: "center" },
          { type: "barcode", value: "EDGEPRINT01", symbology: "CODE128", align: "center" },
          { type: "feed", lines: Math.max(1, receiptOptions.feedLines) },
        ];
        if (receiptOptions.autoCut) {
          blocks.push({ type: "cut", mode: receiptOptions.cutMode });
        }

        const result = await adapter.printReceipt(
          {
            paper: receiptOptions.paper,
            charactersPerLine: receiptOptions.charactersPerLine,
            blocks,
            metadata: { purpose: "diagnostic" },
          },
          {
            transport,
            encodeText: adapter.profiles.textEncoder(this.profile),
          },
        );
        this.status = adapter.getStatus(transport);
        this.emitStatus();
        this.$emit("printed", result);
        return result;
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.busy = false;
      }
    },
  },
  render() {
    const profile = this.profile;
    const connected = Boolean(this.status?.connected);
    const configured = Boolean(profile);
    const transport = directTransport(profile);
    const serial = transport === "serial";
    const usb = transport === "usb";
    const virtual = serial && Boolean(this.status?.virtual);
    const unsupported = Boolean(transport) && this.status?.state === "unsupported";
    const canReconnect = Boolean(transport) && !virtual && this.bindingPresent && !connected && !unsupported;
    const disabled = this.loading || this.busy;

    return h("section", { class: "edge-printer-setup edge-card" }, [
      h("header", { class: "edge-printer-setup__header" }, [
        h("div", {}, [
          h("h3", {}, this.title),
          h(
            "p",
            {},
            profile
              ? `${profile.profileName} · ${profile.paperWidth}mm · ${profile.protocol}`
              : "Resolve a shared EdgeSuite print profile for this context.",
          ),
        ]),
        h(
          "span",
          {
            class: [
              "edge-printer-setup__status",
              connected ? "is-connected" : configured ? "is-configured" : "is-empty",
            ],
          },
          this.loading ? "Loading…" : statusLabel(this.status),
        ),
      ]),
      this.error
        ? h("div", { class: "edge-printer-setup__error", role: "alert" }, this.error)
        : null,
      profile
        ? h("dl", { class: "edge-printer-setup__meta" }, [
            h("div", {}, [h("dt", {}, "Transport"), h("dd", {}, profile.transport)]),
            h("div", {}, [h("dt", {}, "Scope"), h("dd", {}, profile.scopeType)]),
            h("div", {}, [h("dt", {}, "Baud"), h("dd", {}, serial ? String(profile.baudRate) : "—")]),
            h("div", {}, [
              h("dt", {}, "Local binding"),
              h(
                "dd",
                {},
                virtual ? "Virtual session" : this.bindingPresent ? "Saved on this device" : "Not selected",
              ),
            ]),
          ])
        : null,
      h("div", { class: "edge-printer-setup__actions" }, [
        button("Refresh", () => this.refresh().catch(() => {}), { disabled }),
        transport && !virtual && !this.bindingPresent && !connected && !unsupported
          ? button("Connect Printer", () => this.connect().catch(() => {}), { primary: true, disabled })
          : null,
        canReconnect
          ? button("Reconnect", () => this.reconnect().catch(() => {}), { primary: true, disabled })
          : null,
        connected
          ? button("Test Print", () => this.testPrint().catch(() => {}), { primary: true, disabled })
          : null,
        connected && !virtual
          ? button("Disconnect", () => this.disconnect().catch(() => {}), { disabled })
          : null,
        !virtual && this.bindingPresent
          ? button("Forget Printer", () => this.forget().catch(() => {}), { danger: true, disabled })
          : null,
      ].filter(Boolean)),
      unsupported
        ? h(
            "p",
            { class: "edge-printer-setup__note", role: "status" },
            this.status?.reason === "insecure_context"
              ? "Direct printer access requires HTTPS. Open this site through its secure address and try again."
              : usb
                ? "This browser cannot connect directly to USB printers. Use normal system printing or a supported browser."
                : "This browser cannot access serial or Bluetooth receipt printers from the web.",
          )
        : profile && !transport
          ? h(
              "p",
              { class: "edge-printer-setup__note" },
              "This profile uses system/browser printing and does not require a direct device binding.",
            )
          : usb
            ? h(
                "p",
                { class: "edge-printer-setup__note" },
                "USB access depends on the browser and device driver. If direct USB access is unavailable, use normal system printing.",
              )
            : null,
    ]);
  },
});

export const printingComponents = Object.freeze({
  EdgePrinterSetupCard,
});
