/**
 * Huevos de Planillas.
 *
 * Receta de CUMPLEAÑOS (banner gif + globos, fechas Argentina):
 * copiar PLANILLAS_BIRTHDAY_RECIPE y poner email, src, mes y días.
 * También podés cargar el cumpleaños en ADMIN → ficha del usuario (DD/MM):
 * eso activa saludo, gif de torta y globos sin tocar este archivo.
 */
export const PLANILLAS_BIRTHDAY_RECIPE = {
  motion: "still",
  heroBanner: true,
  balloons: true,
};

export const PLANILLAS_EASTER_EGGS = [
  {
    email: "yohana.colacci@thomsonreuters.com",
    src: "/img/yohana-corner.png?v=6",
    motion: "bob",
    peekSrc: "/img/yohana-titan.webm?v=2",
  },
  {
    email: "franco.zanna@thomsonreuters.com",
    peekSrc: "/img/franco-titan.webm?v=1",
  },
  {
    email: "belen.foschiatti@thomsonreuters.com",
    src: "/img/belen-corner.gif?v=2",
    motion: "still",
    size: "lg",
    behindTitle: true,
  },
  {
    email: "gisela.crosenzi@thomsonreuters.com",
    src: "/img/gisella-corner.gif?v=4",
    motion: "still",
    size: "xl",
    behindTitle: true,
  },
  {
    email: "aylen.cristaldo@thomsonreuters.com",
    src: "/img/aylenglobo-corner.gif?v=3",
    motion: "still",
    side: "left",
    size: "md",
  },
  {
    email: "yohanaelizabeth.orellana@thomsonreuters.com",
    src: "/img/yohannaboca-corner.gif?v=2",
    motion: "still",
    side: "left",
    size: "md",
  },
  {
    ...PLANILLAS_BIRTHDAY_RECIPE,
    email: "gisela.crosenzi@thomsonreuters.com",
    src: "/img/cumpleaños-easteregg.gif?v=1",
    birthdayMonth: 8,
    birthdayDay: 25,
  },
];

function sessionBirthdayEgg(email) {
  const mmDd = getSessionBirthdayMmDd();
  const m = /^(\d{2})-(\d{2})$/.exec(String(mmDd || "").trim());
  if (!m || !isMmDdToday(mmDd)) return null;
  return {
    ...PLANILLAS_BIRTHDAY_RECIPE,
    email: String(email || "").trim().toLowerCase(),
    src: "/img/cumpleaños-easteregg.gif?v=1",
    birthdayMonth: Number(m[1]),
    birthdayDay: Number(m[2]),
  };
}

/** Prioriza banner de cumpleaños en su ventana; si no, el huevo “siempre” (paseo, etc.). */
export function resolvePlanillasEgg(email) {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return null;
  const matches = PLANILLAS_EASTER_EGGS.filter((item) => item.email === key);
  const birthdayHardcoded = matches.find((e) => e.birthdayMonth && e.birthdayDay && isEggBirthdayWindow(e));
  if (birthdayHardcoded) return birthdayHardcoded;
  const sessionBirthday = sessionBirthdayEgg(key);
  if (sessionBirthday) return sessionBirthday;
  if (!matches.length) return null;
  const always = matches.find((e) => !e.birthdayMonth || !e.birthdayDay);
  return always || null;
}

const SESSION_BDAY_KEY = "st2-session-birthday-mmdd";

function argentinaMonthDay() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
    return {
      month: Number(parts.find((p) => p.type === "month")?.value),
      day: Number(parts.find((p) => p.type === "day")?.value),
    };
  } catch {
    const now = new Date();
    return { month: now.getMonth() + 1, day: now.getDate() };
  }
}

/** Sin mes/día el huevo queda siempre activo. Con fechas, solo en esa ventana (Argentina). */
export function isEggBirthdayWindow(egg) {
  if (!egg?.birthdayMonth || !egg?.birthdayDay) return true;
  const { month, day } = argentinaMonthDay();
  if (month !== egg.birthdayMonth) return false;
  const from = egg.birthdayFromDay || egg.birthdayDay;
  const to = egg.birthdayDay;
  return day >= from && day <= to;
}

export function setSessionBirthdayMmDd(mmDd) {
  const v = String(mmDd || "").trim();
  try {
    if (!v) sessionStorage.removeItem(SESSION_BDAY_KEY);
    else sessionStorage.setItem(SESSION_BDAY_KEY, v);
  } catch { /* ignore */ }
}

export function getSessionBirthdayMmDd() {
  try {
    return sessionStorage.getItem(SESSION_BDAY_KEY) || "";
  } catch {
    return "";
  }
}

function isMmDdToday(mmDd) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(mmDd || "").trim());
  if (!m) return false;
  const { month, day } = argentinaMonthDay();
  return Number(m[1]) === month && Number(m[2]) === day;
}

export function isBirthdayGreetingForEmail(email) {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return false;
  const birthdayEgg = PLANILLAS_EASTER_EGGS.find(
    (item) => item.email === key && item.birthdayMonth && item.birthdayDay,
  );
  if (birthdayEgg && isEggBirthdayWindow(birthdayEgg)) return true;
  // Cumpleaños cargado en ADMIN (solo aplica al usuario de la sesión actual).
  return isMmDdToday(getSessionBirthdayMmDd());
}
