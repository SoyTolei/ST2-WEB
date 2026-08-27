/** Refresco periódico del listado mientras el módulo está abierto y visible. */
const POLL_MS_VISIBLE = 5000;
const POLL_MS_HIDDEN = 20000;

/**
 * @param {{ viewId: string, reload: (opts?: { silent?: boolean }) => Promise<void>, isBusy?: () => boolean }} opts
 */
export function createPlanillasLiveList({ viewId, reload, isBusy }) {
  let timer = null;
  let onVisibility = null;

  function isViewOpen() {
    const view = document.getElementById(viewId);
    return !!(view && !view.classList.contains("hidden"));
  }

  function tick() {
    if (!isViewOpen()) return;
    if (document.visibilityState !== "visible") return;
    if (isBusy?.()) return;
    void reload({ silent: true });
  }

  function schedule() {
    if (timer) clearInterval(timer);
    const ms = document.visibilityState === "visible" ? POLL_MS_VISIBLE : POLL_MS_HIDDEN;
    timer = setInterval(tick, ms);
  }

  return {
    start() {
      this.stop();
      tick();
      schedule();
      onVisibility = () => {
        schedule();
        if (document.visibilityState === "visible") tick();
      };
      document.addEventListener("visibilitychange", onVisibility);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (onVisibility) {
        document.removeEventListener("visibilitychange", onVisibility);
        onVisibility = null;
      }
    },
  };
}
