export function applyFrappeCompatibility(components = {}) {
  const shell = components?.EdgeAppShell;
  if (!shell?.methods) return components;

  shell.methods.openUserSettings = function () {
    const user = globalThis.frappe?.session?.user || "";
    if (user) {
      const route = `/app/user/${encodeURIComponent(user)}`;
      if (typeof this.openInNewTab === "function") {
        this.openInNewTab(route);
      } else {
        globalThis.open?.(route, "_blank", "noopener,noreferrer");
      }
    }
    this.profileMenuOpen = false;
  };

  return components;
}
