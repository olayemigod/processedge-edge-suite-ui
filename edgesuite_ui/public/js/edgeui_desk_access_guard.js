(() => {
	"use strict";

	const GUARD_KEY = "__edgeSuiteDeskAccessGuard";
	const BOOT_KEY = "edgesuite_ui_access";
	const RESTRICTED_MODE = "edgesuite_only";
	const APPROVED_ATTRIBUTE = "data-edgesuite-route-approved";
	const MODE_ATTRIBUTE = "data-edgesuite-access-mode";
	const OVERLAY_ID = "edgesuite-access-blocked";
	const VERIFY_DELAY_MS = 450;
	const VERIFY_RETRY_MS = 500;
	const MAX_EDGE_ROUTE_VERIFY_ATTEMPTS = 4;
	const REDIRECT_RESET_MS = 900;
	const NATIVE_ROUTE_PREFIXES = new Set([
		"form",
		"list",
		"query-report",
		"report-builder",
		"tree",
		"workspace",
		"dashboard-view",
		"print",
	]);
	const NATIVE_MENU_LINK_TYPES = new Set(["doctype", "report", "workspace"]);

	if (globalThis[GUARD_KEY]) return;

	const state = {
		menuPages: new Set(),
		failedPages: new Set(),
		verifyTimer: null,
		verifyAttempts: 0,
		redirecting: false,
		observer: null,
	};

	function accessContext() {
		return globalThis.frappe?.boot?.[BOOT_KEY] || {};
	}

	function restricted() {
		return accessContext().mode === RESTRICTED_MODE;
	}

	function htmlRoot() {
		return globalThis.document?.documentElement || null;
	}

	function body() {
		return globalThis.document?.body || null;
	}

	function applyAccessMode() {
		const root = htmlRoot();
		if (!root) return;
		const mode = String(accessContext().mode || "").trim();
		if (mode) root.setAttribute(MODE_ATTRIBUTE, mode);
		else root.removeAttribute(MODE_ATTRIBUTE);
		if (!restricted()) {
			root.removeAttribute(APPROVED_ATTRIBUTE);
			hideBlockedOverlay();
		}
	}

	function normalizePageName(value) {
		return String(value || "")
			.trim()
			.replace(/^https?:\/\/[^/]+/i, "")
			.replace(/^\/+/, "")
			.replace(/^(?:app|desk)\//i, "")
			.split(/[?#/]/)[0]
			.trim();
	}

	function routeParts() {
		const frappeRoute = globalThis.frappe?.get_route?.();
		if (Array.isArray(frappeRoute) && frappeRoute.length) {
			return frappeRoute.map((part) => String(part || "")).filter(Boolean);
		}
		const path = String(globalThis.location?.pathname || "").replace(/^\/(?:app|desk)\/?/i, "");
		return path.split("/").filter(Boolean);
	}

	function currentPageName() {
		const parts = routeParts();
		if (parts.length !== 1) return "";
		return normalizePageName(parts[0]);
	}

	function routeLooksNative() {
		const parts = routeParts();
		if (!parts.length) return true;
		return NATIVE_ROUTE_PREFIXES.has(String(parts[0] || "").toLowerCase());
	}

	function routePath(value) {
		const raw = String(value || "").trim();
		if (!raw) return "";
		try {
			return new URL(raw, globalThis.location?.origin || "http://localhost").pathname.toLowerCase();
		} catch (_error) {
			return raw.split(/[?#]/)[0].toLowerCase();
		}
	}

	function routeExplicitlyNative(value) {
		const path = routePath(value);
		if (!path) return false;
		return /^\/(?:app|desk)\/(?:form|list|query-report|report-builder|tree|workspace|dashboard-view|print)(?:\/|$)/i.test(path);
	}

	function edgeShellPresent() {
		return Boolean(
			globalThis.document?.querySelector?.(
				'.edge-app-shell[data-edge-product], [data-edge-suite-page="true"], [data-edge-suite-ready="true"] .edge-app-shell',
			),
		);
	}

	function storageKey() {
		const user = String(globalThis.frappe?.session?.user || "user").toLowerCase();
		const host = String(globalThis.location?.host || "site").toLowerCase();
		return `edgesuite:last-approved-page:${host}:${user}`;
	}

	function saveApprovedPage(pageName) {
		if (!pageName) return;
		try {
			globalThis.localStorage?.setItem(storageKey(), pageName);
		} catch (_error) {
			// Storage is a convenience only; it is never an authorization source.
		}
	}

	function lastApprovedPage() {
		try {
			return normalizePageName(globalThis.localStorage?.getItem(storageKey()) || "");
		} catch (_error) {
			return "";
		}
	}

	function currentRoles() {
		return new Set((globalThis.frappe?.user_roles || []).map((role) => String(role)));
	}

	function itemVisibleForUser(item) {
		if (!item || item.hidden === true || item.hidden === 1 || item.visible === false) return false;
		const roles = Array.isArray(item.roles) ? item.roles.filter(Boolean) : [];
		if (!roles.length) return true;
		const userRoles = currentRoles();
		return roles.some((role) => userRoles.has(String(role)));
	}

	function menuItemAllowed(item) {
		if (!itemVisibleForUser(item)) return false;
		if (!restricted()) return true;
		const linkType = String(item.link_type || item.linkType || "").trim().toLowerCase();
		if (NATIVE_MENU_LINK_TYPES.has(linkType)) return false;
		if (linkType && linkType !== "page") return false;
		if (routeExplicitlyNative(item.route)) return false;
		return true;
	}

	function filterMenuItems(items) {
		if (!Array.isArray(items)) return [];
		if (!restricted()) return items;
		return items.flatMap((item) => {
			if (!item) return [];
			if (Array.isArray(item.items)) {
				const children = item.items.filter(menuItemAllowed);
				return children.length ? [{ ...item, items: children }] : [];
			}
			return menuItemAllowed(item) ? [item] : [];
		});
	}

	function filterMenuConfig(config) {
		if (!restricted() || !config || typeof config !== "object") return config;
		const filtered = { ...config };
		if (Array.isArray(config.sections)) {
			filtered.sections = config.sections
				.map((section) => ({
					...section,
					items: (section?.items || []).filter(menuItemAllowed),
				}))
				.filter((section) => section.items.length);
		}
		if (Array.isArray(config.items)) filtered.items = filterMenuItems(config.items);
		return filtered;
	}

	function collectMenuItem(item) {
		if (!menuItemAllowed(item)) return;
		const linkType = String(item.link_type || item.linkType || "").toLowerCase();
		if (linkType && linkType !== "page") return;
		const pageName = normalizePageName(item.link_to || item.linkTo || item.route || "");
		if (pageName) state.menuPages.add(pageName);
	}

	function collectMenuConfig(config) {
		(config?.sections || []).forEach((section) => {
			(section?.items || []).forEach(collectMenuItem);
		});
		(config?.items || []).forEach(collectMenuItem);
	}

	function patchRuntimeMenuRegistration() {
		const edgeUI = globalThis.EdgeSuiteUI || globalThis.EdgeUI;
		if (!edgeUI || edgeUI.__deskAccessMenuCollectorInstalled) return;
		const originalRegister = edgeUI.registerProductMenu?.bind(edgeUI);
		if (typeof originalRegister !== "function") return;

		edgeUI.registerProductMenu = function registerProductMenuWithDeskAccess(config) {
			const filteredConfig = filterMenuConfig(config);
			collectMenuConfig(filteredConfig);
			const result = originalRegister(filteredConfig);
			if (restricted() && !edgeShellPresent()) scheduleVerification(0);
			return result;
		};
		edgeUI.__deskAccessMenuCollectorInstalled = true;
	}

	function wrapShellComponent(edgeUI, component) {
		if (!restricted() || !component || component.__edgeSuiteDeskAccessWrappedShell) return component;
		const Vue = edgeUI?.Vue;
		if (!Vue?.defineComponent || !Vue?.h) return component;

		const WrappedShell = Vue.defineComponent({
			name: `EdgeSuiteAccessFiltered${component.name || "Shell"}`,
			inheritAttrs: false,
			setup(_props, context) {
				return () => {
					const attrs = context.attrs || {};
					return Vue.h(
						component,
						{
							...attrs,
							menuItems: filterMenuItems(attrs.menuItems),
						},
						context.slots,
					);
				};
			},
		});
		Object.defineProperty(WrappedShell, "__edgeSuiteDeskAccessWrappedShell", {
			value: true,
			configurable: false,
			enumerable: false,
		});
		return WrappedShell;
	}

	function patchRuntimeShellRegistration() {
		const edgeUI = globalThis.EdgeSuiteUI || globalThis.EdgeUI;
		if (!restricted() || !edgeUI || edgeUI.__deskAccessComponentGuardInstalled) return;
		const originalRegister = edgeUI.registerComponent?.bind(edgeUI);
		if (typeof originalRegister !== "function") return;

		edgeUI.registerComponent = function registerComponentWithDeskAccess(name, component, options = {}) {
			const nextComponent = name === "EdgeAppShell" ? wrapShellComponent(edgeUI, component) : component;
			return originalRegister(name, nextComponent, options);
		};
		edgeUI.__deskAccessComponentGuardInstalled = true;

		const existingShell = edgeUI.components?.EdgeAppShell;
		if (existingShell && !existingShell.__edgeSuiteDeskAccessWrappedShell) {
			edgeUI.registerComponent("EdgeAppShell", existingShell, { replace: true });
		}
	}

	function approveCurrentRoute() {
		if (!restricted()) return;
		const root = htmlRoot();
		if (!root) return;
		root.setAttribute(APPROVED_ATTRIBUTE, "true");
		state.verifyAttempts = 0;
		state.redirecting = false;
		hideBlockedOverlay();
		const pageName = currentPageName();
		if (pageName) {
			state.failedPages.delete(pageName);
			saveApprovedPage(pageName);
		}
	}

	function cloakCurrentRoute() {
		if (!restricted()) return;
		htmlRoot()?.removeAttribute(APPROVED_ATTRIBUTE);
	}

	function fallbackPage() {
		const current = currentPageName();
		const recent = lastApprovedPage();
		if (recent && recent !== current && !state.failedPages.has(recent)) return recent;
		return Array.from(state.menuPages).find(
			(page) => page && page !== current && !state.failedPages.has(page),
		) || "";
	}

	function hideBlockedOverlay() {
		globalThis.document?.getElementById?.(OVERLAY_ID)?.remove();
	}

	function showBlockedOverlay(reason) {
		if (!restricted() || !body()) return;
		let overlay = globalThis.document.getElementById(OVERLAY_ID);
		if (!overlay) {
			overlay = globalThis.document.createElement("section");
			overlay.id = OVERLAY_ID;
			overlay.className = "edgesuite-access-blocked";
			overlay.setAttribute("role", "alert");
			overlay.innerHTML = [
				'<div class="edgesuite-access-blocked__card">',
				'<h1>EdgeSuite access only</h1>',
				'<p>Your account is limited to EdgeSuite operational pages. No permitted EdgeSuite landing page is available from this route.</p>',
				'<div class="edgesuite-access-blocked__actions">',
				'<button type="button" data-edge-access-reload>Reload</button>',
				'<a href="/logout">Log out</a>',
				"</div>",
				"</div>",
			].join("");
			overlay.querySelector("[data-edge-access-reload]")?.addEventListener("click", () => {
				globalThis.location?.reload?.();
			});
			body().appendChild(overlay);
		}
		overlay.dataset.reason = String(reason || "unavailable");
	}

	function redirectToFallback(reason) {
		if (!restricted() || state.redirecting) return;
		const current = currentPageName();
		if (current) state.failedPages.add(current);
		const target = fallbackPage();
		if (!target) {
			showBlockedOverlay(reason);
			return;
		}

		state.redirecting = true;
		cloakCurrentRoute();
		hideBlockedOverlay();
		if (typeof globalThis.frappe?.set_route === "function") {
			globalThis.frappe.set_route(target);
		} else {
			globalThis.location?.assign?.(`/app/${encodeURIComponent(target)}`);
		}
		globalThis.setTimeout?.(() => {
			state.redirecting = false;
		}, REDIRECT_RESET_MS);
	}

	function verifyCurrentRoute() {
		applyAccessMode();
		patchRuntimeMenuRegistration();
		patchRuntimeShellRegistration();
		if (!restricted()) return;
		if (edgeShellPresent()) {
			approveCurrentRoute();
			return;
		}

		cloakCurrentRoute();
		if (routeLooksNative()) {
			redirectToFallback("native-desk-route");
			return;
		}

		state.verifyAttempts += 1;
		if (state.verifyAttempts < MAX_EDGE_ROUTE_VERIFY_ATTEMPTS) {
			scheduleVerification(VERIFY_RETRY_MS);
			return;
		}
		redirectToFallback("edge-shell-not-found");
	}

	function scheduleVerification(delay = VERIFY_DELAY_MS) {
		if (state.verifyTimer) globalThis.clearTimeout?.(state.verifyTimer);
		state.verifyTimer = globalThis.setTimeout?.(() => {
			state.verifyTimer = null;
			verifyCurrentRoute();
		}, delay);
	}

	function beginRouteCheck() {
		applyAccessMode();
		patchRuntimeMenuRegistration();
		patchRuntimeShellRegistration();
		if (!restricted()) return;
		state.verifyAttempts = 0;
		cloakCurrentRoute();
		hideBlockedOverlay();
		scheduleVerification();
	}

	function start() {
		applyAccessMode();
		patchRuntimeMenuRegistration();
		patchRuntimeShellRegistration();
		if (restricted()) cloakCurrentRoute();

		globalThis.frappe?.router?.on?.("change", beginRouteCheck);
		globalThis.document?.addEventListener?.("page-change", beginRouteCheck);
		["popstate", "hashchange", "pageshow"].forEach((eventName) => {
			globalThis.addEventListener?.(eventName, beginRouteCheck);
		});

		if (globalThis.MutationObserver && body()) {
			state.observer = new globalThis.MutationObserver(() => {
				patchRuntimeMenuRegistration();
				patchRuntimeShellRegistration();
				if (restricted() && edgeShellPresent()) approveCurrentRoute();
			});
			state.observer.observe(body(), { childList: true, subtree: true });
		}
		scheduleVerification();
	}

	globalThis[GUARD_KEY] = {
		state,
		refresh: beginRouteCheck,
		destroy() {
			if (state.verifyTimer) globalThis.clearTimeout?.(state.verifyTimer);
			state.observer?.disconnect?.();
			hideBlockedOverlay();
			htmlRoot()?.removeAttribute(MODE_ATTRIBUTE);
			htmlRoot()?.removeAttribute(APPROVED_ATTRIBUTE);
			delete globalThis[GUARD_KEY];
		},
	};

	if (globalThis.document?.readyState === "loading") {
		globalThis.document.addEventListener("DOMContentLoaded", start, { once: true });
	} else {
		start();
	}
})();
