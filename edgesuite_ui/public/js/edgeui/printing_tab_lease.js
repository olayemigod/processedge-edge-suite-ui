import { EdgePrintError } from "./printing_contract";

// An opened Web Serial port cannot be moved between page contexts.
// The browser lock prevents the same origin from opening it in two tabs;
// BroadcastChannel asks an idle owner to close before the next tab opens.
const LOCK_NAME = "edgesuite.printing.serial.active.v1";
const CHANNEL_NAME = "edgesuite.printing.serial.handoff.v1";

export function createSerialTabLease({
  target = globalThis,
  onHandoffRequested = async () => {},
  handoffTimeoutMs = 1800,
} = {}) {
  const locks = target?.navigator?.locks;
  const Broadcast = target?.BroadcastChannel;
  // Do not create a live channel in Node SSR/tests, insecure pages, or a
  // browser with no Web Serial/Web Locks. An idle BroadcastChannel can
  // otherwise keep a Node process alive with no actual device to coordinate.
  const canCoordinate = Boolean(
    target?.isSecureContext &&
    target?.navigator?.serial &&
    typeof locks?.request === "function",
  );
  const channel = canCoordinate && typeof Broadcast === "function"
    ? new Broadcast(CHANNEL_NAME)
    : null;
  let held = false;
  let releaseCurrent = null;
  let activeTask = null;
  let acquisition = null;
  const releaseWaiters = new Set();

  function announce(kind) {
    try {
      channel?.postMessage({ version: 1, kind });
    } catch (_error) {
      // The Web Lock, not broadcast delivery, remains the safety authority.
    }
  }

  if (channel) {
    channel.onmessage = (event) => {
      const data = event?.data;
      if (data?.version !== 1) return;
      if (data.kind === "request" && held) {
        // The transport chooses whether it is idle and safe to release.
        Promise.resolve().then(() => onHandoffRequested()).catch(() => undefined);
      }
      if (data.kind === "released") {
        for (const wake of [...releaseWaiters]) wake();
      }
    };
  }

  async function tryAcquire() {
    if (held) return true;
    let settled = false;
    let report;
    let fail;
    const result = new Promise((resolve, reject) => {
      report = (value) => {
        settled = true;
        resolve(value);
      };
      fail = reject;
    });
    let task;
    try {
      task = locks.request(LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async (lock) => {
        if (!lock) {
          report(false);
          return;
        }
        let unlock;
        const untilRelease = new Promise((resolve) => {
          unlock = resolve;
        });
        held = true;
        releaseCurrent = unlock;
        report(true);
        try {
          await untilRelease;
        } finally {
          held = false;
          releaseCurrent = null;
        }
      });
    } catch (error) {
      fail(error);
      throw error;
    }
    // A lock is held until the callback finishes, not until request() resolves.
    Promise.resolve(task).catch((error) => {
      if (!settled) fail(error);
    });
    if (await result) {
      activeTask = task;
      return true;
    }
    await task;
    return false;
  }

  function waitForRelease() {
    if (!channel) return Promise.resolve();
    return new Promise((resolve) => {
      let timeout;
      const finish = () => {
        releaseWaiters.delete(finish);
        if (timeout !== undefined) (target?.clearTimeout || clearTimeout)(timeout);
        resolve();
      };
      releaseWaiters.add(finish);
      timeout = (target?.setTimeout || setTimeout)(finish, handoffTimeoutMs);
      announce("request");
    });
  }

  async function acquire() {
    if (held) return;
    if (acquisition) return acquisition;
    acquisition = (async () => {
      if (typeof locks?.request !== "function") {
        throw new EdgePrintError(
          "SERIAL_TAB_COORDINATION_UNAVAILABLE",
          "This browser cannot safely coordinate a receipt printer between tabs. Use an updated Chrome browser.",
        );
      }
      if (await tryAcquire()) return;
      await waitForRelease();
      if (await tryAcquire()) return;
      throw new EdgePrintError(
        "SERIAL_TAB_IN_USE",
        "The receipt printer is being used in another browser tab. Disconnect it there, then try again.",
      );
    })().finally(() => {
      acquisition = null;
    });
    return acquisition;
  }

  async function release() {
    if (!held) return;
    const unlock = releaseCurrent;
    const task = activeTask;
    unlock?.();
    if (task) await task;
    if (activeTask === task) activeTask = null;
    announce("released");
  }

  function close() {
    channel?.close?.();
    for (const wake of [...releaseWaiters]) wake();
  }

  return Object.freeze({
    acquire,
    release,
    isHeld: () => held,
    close,
  });
}
