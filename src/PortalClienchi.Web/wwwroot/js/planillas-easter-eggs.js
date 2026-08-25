/**
 * Huevos de Planillas. El de Gisela es la receta de cumpleaños:
 * gif grande en el título del menú, globos, y el mismo gif chico
 * en “Volver al menú” de cada módulo. Ventana en fecha Argentina.
 *
 * Para otro cumple: copiar GISELA_BIRTHDAY_EGG, cambiar email, src,
 * mes y días. Poner el gif en wwwroot/img (ideal ~640px de ancho).
 */
export const GISELA_BIRTHDAY_EGG = {
  email: "gisela.crosenzi@thomsonreuters.com",
  src: "/img/gisela-corner.gif?v=4",
  motion: "still",
  heroBanner: true,
  balloons: true,
  birthdayMonth: 8,
  birthdayFromDay: 24,
  birthdayDay: 25,
};

export const PLANILLAS_EASTER_EGGS = [
  {
    email: "yohana.colacci@thomsonreuters.com",
    src: "/img/yohana-corner.png?v=6",
    motion: "bob",
    peekSrc: "/img/yohana-titan.webm?v=1",
  },
  {
    email: "belen.foschiatti@thomsonreuters.com",
    src: "/img/belen-corner.gif?v=2",
    motion: "still",
    size: "lg",
    behindTitle: true,
  },
  GISELA_BIRTHDAY_EGG,
];
