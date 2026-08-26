const NOTIF_PREF_KEY = "st2-desktop-notif-v1";
let lastBlanqueoSig = "";
let lastBorradoSig = "";

export function desktopNotifSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureDesktopNotifPermission() {
  if (!desktopNotifSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

function notifEnabled() {
  try {
    return localStorage.getItem(NOTIF_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setDesktopNotifEnabled(on) {
  try {
    localStorage.setItem(NOTIF_PREF_KEY, on ? "1" : "0");
  } catch { /* ignore */ }
}

function showDesktopNotif(title, body, tag) {
  if (!desktopNotifSupported() || Notification.permission !== "granted" || !notifEnabled()) return;
  // Solo si la pestaña no está a la vista (evita spam encima del toast).
  if (!document.hidden) return;
  try {
    const n = new Notification(title, {
      body,
      tag: tag || "st2-alert",
      renotify: true,
      icon: "/st2.ico",
    });
    n.onclick = () => {
      try { window.focus(); } catch { /* ignore */ }
      n.close();
    };
  } catch { /* ignore */ }
}

export function notifyBlanqueoDesktop(count, signature) {
  const sig = String(signature || "");
  if (!count || !sig || sig === lastBlanqueoSig) return;
  lastBlanqueoSig = sig;
  void ensureDesktopNotifPermission().then((ok) => {
    if (!ok) return;
    const title = count === 1 ? "1 blanqueo pendiente" : `${count} blanqueos pendientes`;
    showDesktopNotif("ST2 · Blanqueo", title, `blanqueo-${sig}`);
  });
}

export function notifyBorradoDesktop(count, signature) {
  const sig = String(signature || "");
  if (!count || !sig || sig === lastBorradoSig) return;
  lastBorradoSig = sig;
  void ensureDesktopNotifPermission().then((ok) => {
    if (!ok) return;
    const title = count === 1 ? "1 borrado pendiente" : `${count} borrados pendientes`;
    showDesktopNotif("ST2 · Borrado de bases", title, `borrado-${sig}`);
  });
}
