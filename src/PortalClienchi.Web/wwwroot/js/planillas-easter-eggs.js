/**
 * Huevos de Planillas.
 *
 * Receta de CUMPLEAÑOS (banner gif + globos, fechas Argentina):
 * copiar PLANILLAS_BIRTHDAY_RECIPE y poner email, src, mes y días.
 * Más adelante se pueden sumar varias fechas; si no hay mes/día, queda siempre on.
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
    email: "belen.foschiatti@thomsonreuters.com",
    src: "/img/belen-corner.gif?v=2",
    motion: "still",
    size: "lg",
    behindTitle: true,
  },
  {
    ...PLANILLAS_BIRTHDAY_RECIPE,
    email: "gisela.crosenzi@thomsonreuters.com",
    src: "/img/gisela-corner.gif?v=4",
    birthdayMonth: 8,
    birthdayFromDay: 24,
    birthdayDay: 25,
  },
];
