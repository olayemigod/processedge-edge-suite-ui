(() => {
	"use strict";

	const GUARD_KEY = "__edgeSuiteDeskAccessGuard";
	const BOOT_KEY = "edgesuite_ui_access";
	const RESTRICTED_MODE = "edgesuite_only";
	const APPROVED_ATTRIBUTE = "data-edgesuite-route-approved";
	const MODE_ATTRIBUTE = "data-edgesuite-access-mode";
	const OVERLAY_ID = "edgesuite-access-blocked";
	const VERIFY_DELAY_MS = 450;
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

	if (globalThis[GUARD_KEY]) return;

	const state = {
		menuPages: new Set(),
		failedPages: new Set(),
		verifyTimer: null,
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
			.replace(/^app\//i, "")
			.split(/[?#/]/)[0]
			.trim();
	}

	function routeParts() {
		const frappeRoute = globalThis.frappe?.get_route?.();
		if (Array.isArray(frappeRoute) && frappeRoute.length) {
			return frappeRoute.map((part) => String(part || "")).filter(Boolean);
		}
		const path = String(globalThis.location?.pathname || "").replace(/^\/app\/?/i, "");
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

	function collectMenuItem(item) {
		if (!itemVisibleForUser(item)) return;
		const linkType = String(item.link_type || item.linkType || "").toLowerCase();
		if (linkType !== "page") return;
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
			collectMenuConfig(config);
			const result = originalRegister(config);
			if (restricted() && !edgeShellPresent()) scheduleVerification(0);
			return result;
		};
		edgeUI.__deskAccessMenuCollectorInstalled = true;
	}

	function approveCurrentRoute() {
		if (!restricted()) return;
		const root = htmlRoot();
		if (!root) return;
		root.setAttribute(APPROVED_ATTRIBUTE, "true");
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
		if (!restricted()) return;
		cloakCurrentRoute();
		hideBlockedOverlay();
		scheduleVerification();
	}

	function start() {
		applyAccessMode();
		patchRuntimeMenuRegistration();
		if (restricted()) cloakCurrentRoute();

		globalThis.frappe?.router?.on?.("change", beginRouteCheck);
		globalThis.document?.addEventListener?.("page-change", beginRouteCheck);
		["popstate", "hashchange", "pageshow"].forEach((eventName) => {
			globalThis.addEventListener?.(eventName, beginRouteCheck);
		});

		if (globalThis.MutationObserver && body()) {
			state.observer = new globalThis.MutationObserver(() => {
				patchRuntimeMenuRegistration();
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
