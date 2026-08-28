const NOTIF_PREF_KEY = "st2-desktop-notif-v1";
let lastBlanqueoSig = "";
let lastBorradoSig = "";
let lastWebUpdateBuild = "";

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

function st2IconUrl() {
  return document.querySelector('meta[name="st2-icon"]')?.content || "/st2.ico";
}

function showDesktopNotif(title, body, tag, { allowWhileVisible = false, onClick } = {}) {
  if (!desktopNotifSupported() || Notification.permission !== "granted" || !notifEnabled()) return;
  // Blanqueo/borrado: solo con pestaña oculta (evita spam encima del toast).
  if (!allowWhileVisible && !document.hidden) return;
  try {
    const n = new Notification(title, {
      body,
      tag: tag || "st2-alert",
      renotify: true,
      icon: st2IconUrl(),
    });
    n.onclick = () => {
      try { window.focus(); } catch { /* ignore */ }
      try { onClick?.(); } catch { /* ignore */ }
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

/** Aviso de versión nueva de la web (una vez por build). */
export function notifyWebUpdateDesktop(build) {
  const stamp = String(build || "").trim().toLowerCase().slice(0, 12);
  if (!stamp || stamp === lastWebUpdateBuild) return;
  lastWebUpdateBuild = stamp;
  void ensureDesktopNotifPermission().then((ok) => {
    if (!ok) return;
    showDesktopNotif(
      "ST2 · Actualización",
      "Hay una versión nueva. Tocá para recargar.",
      `web-update-${stamp}`,
      {
        allowWhileVisible: true,
        onClick: () => {
          try { window.location.reload(); } catch { /* ignore */ }
        },
      },
    );
  });
}
