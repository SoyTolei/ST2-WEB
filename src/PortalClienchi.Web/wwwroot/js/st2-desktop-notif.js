const NOTIF_PREF_KEY = "st2-desktop-notif-v1";
const NOTIF_SOUND_PREF_KEY = "st2-desktop-notif-sound-v1";
let lastBlanqueoSig = "";
let lastBorradoSig = "";
let lastWebUpdateBuild = "";
let audioCtx = null;

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

function notifSoundEnabled() {
  try {
    return localStorage.getItem(NOTIF_SOUND_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Dos tonos cortos tipo “pendiente” (Web Audio, sin archivo externo). */
export function playPendingNotifSound() {
  if (!notifSoundEnabled()) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    master.connect(ctx.destination);

    [[880, start, 0.16], [1174.66, start + 0.18, 0.2]].forEach(([freq, at, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.9, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    });
  } catch { /* ignore */ }
}

export function setDesktopNotifSoundEnabled(on) {
  try {
    localStorage.setItem(NOTIF_SOUND_PREF_KEY, on ? "1" : "0");
  } catch { /* ignore */ }
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
  playPendingNotifSound();
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

const lastClientChangeTags = new Set();

/** Aviso cuando un ADMIN WEB crea un perfil (solo super-admin). */
export function notifyOwnerPresetDesktop(count, actorEmail, targetEmail, signature) {
  const sig = String(signature || "");
  if (!count || !sig) return;
  const actor = String(actorEmail || "").split("@")[0] || "ADMIN WEB";
  const target = String(targetEmail || "").split("@")[0] || "perfil";
  const body = count === 1
    ? `${actor} creó el perfil ${target}`
    : `ADMIN WEB creó ${count} perfiles nuevos`;
  void ensureDesktopNotifPermission().then((ok) => {
    if (!ok) return;
    showDesktopNotif(
      "ST2 · Perfil nuevo",
      body,
      `owner-preset-${sig}`,
      {
        allowWhileVisible: true,
        onClick: () => {
          try {
            window.location.hash = "#/admin";
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } catch { /* ignore */ }
        },
      },
    );
  });
}

/** Aviso cuando un usuario conecta desde otro equipo/terminal (solo super-admin). */
export function notifyAdminClientChangeDesktop(displayName, email, previousLabel, nextLabel) {
  const mail = String(email || "").trim().toLowerCase();
  const next = String(nextLabel || "").trim();
  const prev = String(previousLabel || "").trim();
  if (!mail || !next || !prev || next === prev) return;

  const tag = `client-${mail}-${next.slice(0, 40)}`;
  if (lastClientChangeTags.has(tag)) return;
  lastClientChangeTags.add(tag);
  if (lastClientChangeTags.size > 80) {
    const first = lastClientChangeTags.values().next().value;
    if (first) lastClientChangeTags.delete(first);
  }

  const who = String(displayName || mail).trim() || mail;
  const body = `${who}: ${next} (antes ${prev})`;
  void ensureDesktopNotifPermission().then((ok) => {
    if (!ok) return;
    showDesktopNotif(
      "ST2 · Equipo distinto",
      body,
      tag,
      {
        allowWhileVisible: true,
        onClick: () => {
          try {
            window.location.hash = "#/admin";
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } catch { /* ignore */ }
        },
      },
    );
  });
}
