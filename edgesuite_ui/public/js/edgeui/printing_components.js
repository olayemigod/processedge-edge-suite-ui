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

        if (this.profile.transport !== "serial") {
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

        const restored = await adapter.devices.restoreSerial(this.profile.name);
        this.bindingPresent = Boolean(restored);
        this.status = adapter.getStatus("serial");
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
      if (this.profile.transport !== "serial") {
        throw new Error("This print profile does not use a directly connected serial printer.");
      }

      this.busy = true;
      this.error = "";
      try {
        await adapter.devices.requestAndBindSerial(this.profile.name);
        this.bindingPresent = true;
        this.status = await adapter.connect(
          "serial",
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

      this.busy = true;
      this.error = "";
      try {
        const restored = await adapter.devices.connectBoundSerial(
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
      this.busy = true;
      this.error = "";
      try {
        this.status = await adapter.disconnect("serial");
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
      this.busy = true;
      this.error = "";
      try {
        if (this.status.connected) await adapter.disconnect("serial");
        const removed = adapter.devices.forget(this.profile.name);
        this.bindingPresent = false;
        this.status = adapter.getStatus("serial");
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
          { type: "text", text: "Connection: OK", align: "center", bold: true },
          { type: "feed", lines: Math.max(1, receiptOptions.feedLines) },
        ];
        if (receiptOptions.autoCut) {
          blocks.push({ type: "cut", mode: receiptOptions.cutMode });
        }

        const result = await adapter.printReceipt({
          paper: receiptOptions.paper,
          charactersPerLine: receiptOptions.charactersPerLine,
          blocks,
          metadata: { purpose: "diagnostic" },
        });
        this.status = adapter.getStatus("serial");
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
    const serial = profile?.transport === "serial";
    const canReconnect = serial && this.bindingPresent && !connected;
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
              h("dd", {}, this.bindingPresent ? "Saved on this device" : "Not selected"),
            ]),
          ])
        : null,
      h("div", { class: "edge-printer-setup__actions" }, [
        button("Refresh", () => this.refresh().catch(() => {}), { disabled }),
        serial && !this.bindingPresent
          ? button("Connect Printer", () => this.connect().catch(() => {}), { primary: true, disabled })
          : null,
        canReconnect
          ? button("Reconnect", () => this.reconnect().catch(() => {}), { primary: true, disabled })
          : null,
        connected
          ? button("Test Print", () => this.testPrint().catch(() => {}), { primary: true, disabled })
          : null,
        connected
          ? button("Disconnect", () => this.disconnect().catch(() => {}), { disabled })
          : null,
        this.bindingPresent
          ? button("Forget Printer", () => this.forget().catch(() => {}), { danger: true, disabled })
          : null,
      ].filter(Boolean)),
      profile && !serial
        ? h(
            "p",
            { class: "edge-printer-setup__note" },
            "This profile uses system/browser printing and does not require a direct device binding.",
          )
        : null,
    ]);
  },
});

export const printingComponents = Object.freeze({
  EdgePrinterSetupCard,
});
