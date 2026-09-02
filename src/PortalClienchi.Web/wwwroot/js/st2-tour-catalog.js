function visible(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  if (el.closest(".hidden,[hidden]")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function sistemaLabel(sistema) {
  const map = {
    BejermanSql: "Bejerman SQL",
    OnvioWeb: "ONVIO/WEB",
    Legal: "LEGAL",
    Chile: "CHILE",
  };
  return map[sistema] || sistema || "Planillas";
}

const TOUR_LABELS = {
  welcome: "Bienvenida ST²",
  "thom-tab": "THOM",
  "ai-tab": "AI Platform",
  "portal-tab": "Portal Cliente",
  "oportunidad-menu": "Oportunidad",
  "oportunidad-cargar": "Cargar oportunidad",
  "oportunidad-gestor": "Gestor oportunidades",
  "pdf-portal": "Generador PDF",
  blanqueo: "Blanqueo",
  "borrado-bases": "Borrado de bases",
  "chile-soporte": "Soporte Chile",
  "referral-legal-hub": "LEGAL · productos",
  "referral-legal-form": "LEGAL · escalamiento",
};

export function tourLabelForId(tourId) {
  if (!tourId) return "Ver tutorial";
  if (TOUR_LABELS[tourId]) return TOUR_LABELS[tourId];
  if (tourId.startsWith("planillas-menu:")) return `Menú · ${sistemaLabel(tourId.split(":")[1])}`;
  if (tourId.startsWith("transferencia:")) return `Transferencia · ${sistemaLabel(tourId.split(":")[1])}`;
  if (tourId.startsWith("referral:")) return `Referral · ${sistemaLabel(tourId.split(":")[1])}`;
  return "Ver tutorial";
}

export function tourIdForReferralView(ctx) {
  const sistema = ctx.getSistema?.();
  if (sistema === "Legal") {
    if (visible("#ref-legal-form")) return "referral-legal-form";
    return "referral-legal-hub";
  }
  return `referral:${sistema}`;
}

export function resolveCurrentTourId(ctx = {}) {
  const tab = ctx.getActiveTab?.() || "planillas";
  if (tab === "thom") return "thom-tab";
  if (tab === "ai") return "ai-tab";
  if (tab === "portal") return "portal-tab";
  if (tab === "admin") return null;

  const view = ctx.getPlanillasView?.() || "menu";
  const sistema = ctx.getSistema?.() || "BejermanSql";

  if (view === "menu") return `planillas-menu:${sistema}`;
  if (view === "transferencia") return `transferencia:${sistema}`;
  if (view === "referral") return tourIdForReferralView(ctx);
  if (view === "oportunidadCargar") return "oportunidad-cargar";
  if (view === "oportunidadGestor") return "oportunidad-gestor";
  if (view === "oportunidadMenu") return "oportunidad-menu";
  if (view === "pdfPortal") return "pdf-portal";
  if (view === "blanqueo") return "blanqueo";
  if (view === "borradoBases") return "borrado-bases";
  if (view === "chileEmbed") return "chile-soporte";

  return `planillas-menu:${sistema}`;
}

export function buildWelcomeTour(ctx) {
  const steps = [
    {
      selector: '.tab-btn[data-tab="planillas"]',
      title: "Sistema de Planillas",
      body: "Acá trabajás el día a día: transferencias, referrals, oportunidades y herramientas según tu perfil. Es el punto de partida de ST².",
      placement: "bottom",
    },
  ];

  if (visible('.tab-btn[data-tab="thom"]')) {
    steps.push({
      selector: '.tab-btn[data-tab="thom"]',
      title: "THOM",
      body: "Portal Thomson para consultas del cliente. Elegí SQL/ONVIO, LEGAL o Chile según el caso.",
      placement: "bottom",
    });
  }

  if (visible('.tab-btn[data-tab="ai"]')) {
    steps.push({
      selector: '.tab-btn[data-tab="ai"]',
      title: "AI Platform",
      body: "Herramientas de IA de Thomson integradas en el navegador, sin salir de ST².",
      placement: "bottom",
    });
  }

  if (visible("#tabPortalBtn")) {
    steps.push({
      selector: "#tabPortalBtn",
      title: "Portal Cliente",
      body: "Acceso al portal del cliente según el sistema que tengas habilitado.",
      placement: "bottom",
    });
  }

  steps.push({
    selector: "#themeToggleBtn",
    title: "Tema claro u oscuro",
    body: "Cambiá el modo visual cuando quieras. La preferencia queda guardada en este navegador.",
    placement: "bottom",
  });

  steps.push({
    selector: "#st2-tour-header-btn",
    title: "Tutorial contextual",
    body: "Este botón siempre muestra el tutorial de la pantalla en la que estás. Si tenés dudas, apretalo de nuevo.",
    placement: "bottom",
    when: () => visible("#st2-tour-header-btn"),
  });

  if (!visible("#st2-tour-header-btn")) {
    steps.push({
      center: true,
      title: "Tutorial siempre disponible",
      body: "Cuando ingreses a un módulo, vas a ver un botón «Ver tutorial» arriba, al lado de tu correo.",
    });
  }

  return { id: "welcome", steps };
}

export function buildPlanillasMenuTour(ctx, sistema) {
  const label = sistemaLabel(sistema);
  const steps = [];

  if (visible("#plan-sistema-section")) {
    steps.push({
      selector: "#plan-sistema-section",
      title: "Paso 1 · Elegí el sistema",
      body: `Antes de abrir un módulo, confirmá que estás en ${label}. Cada sistema tiene sus propias planillas y campos.`,
      placement: "bottom",
    });
  }

  if (visible("#plan-modulo-transferencia")) {
    steps.push({
      selector: "#plan-modulo-transferencia",
      title: "Transferencia de Casos",
      body: "Usala para derivar un caso entre mesas (Técnico, Flex, SaaS…). Completás datos del cliente, descripción, capturas y copiás la planilla al ticket.",
      placement: "top",
    });
  }

  if (visible('[data-plan-modulo="referral"]')) {
    steps.push({
      selector: '[data-plan-modulo="referral"]',
      title: "Referral I+D",
      body: sistema === "Chile"
        ? "Escalamiento a desarrollo o N2 con datos del producto chileno (Hyperrenta, etc.)."
        : "Escalamiento a desarrollo o N2/N3. La planilla se genera lista para pegar en el ticket.",
      placement: "top",
    });
  }

  if (visible("#plan-modulo-oportunidad")) {
    steps.push({
      selector: "#plan-modulo-oportunidad",
      title: "Oportunidad de Venta",
      body: "Registrá leads comerciales: cargá una oportunidad nueva o revisá las ya cargadas en el gestor.",
      placement: "top",
    });
  }

  if (visible("#plan-modulo-pdf-portal")) {
    steps.push({
      selector: "#plan-modulo-pdf-portal",
      title: "Generador de PDFs",
      body: "Armá PDFs para el Portal Cliente a partir de los datos del caso.",
      placement: "top",
    });
  }

  if (visible("#plan-modulo-blanqueo")) {
    steps.push({
      selector: "#plan-modulo-blanqueo",
      title: "Blanqueo de accesos",
      body: "Solicitá blanqueo de contraseñas en ONVIO, On Balance o Portal Cliente. Seguís el estado desde el mismo módulo.",
      placement: "top",
    });
  }

  if (visible("#plan-modulo-borrado-bases")) {
    steps.push({
      selector: "#plan-modulo-borrado-bases",
      title: "Borrado de bases",
      body: "Pedí el borrado de bases web (IVA, SJ, CG). El flujo te guía con los datos que necesita operaciones.",
      placement: "top",
    });
  }

  if (visible("#plan-legal-products-wrap")) {
    steps.push({
      selector: "#plan-legal-products-wrap",
      title: "Productos LEGAL",
      body: "En LEGAL no hay un solo Referral: elegís el producto (HighQ, Legal One, Westlaw, CoCounsel) y completás la plantilla N2/N3 correspondiente.",
      placement: "top",
    });
  }

  if (visible("#plan-chile-soporte-wrap")) {
    steps.push({
      selector: "#plan-chile-soporte-wrap",
      title: "Soporte técnico Chile",
      body: "Accesos embebidos a SAAD, Hyperrenta, Wiki, LP y PowerApps sin salir de ST².",
      placement: "top",
    });
  }

  steps.push({
    selector: "#st2-tour-header-btn",
    title: "¿Dudas después?",
    body: "El botón de arriba repite este tutorial del menú, o el de cada módulo cuando entres a uno.",
    placement: "left",
    when: () => visible("#st2-tour-header-btn"),
  });

  return { id: `planillas-menu:${sistema}`, steps };
}

export function buildTransferenciaTour(ctx, sistema) {
  const sys = sistemaLabel(sistema);
  return {
    id: `transferencia:${sistema}`,
    steps: [
      {
        selector: "#plan-trans-standard-fields, #plan-trans-legal-panel",
        title: "Datos de derivación",
        body: `Elegí la mesa destino y completá los campos de ${sys}: cliente, producto, ambiente u otros según corresponda.`,
        placement: "bottom",
      },
      {
        selector: "#plan-asunto",
        title: "Asunto y/o error",
        body: "Una línea clara con el síntoma: qué falla, en qué pantalla o proceso. Evitá textos genéricos.",
        placement: "bottom",
      },
      {
        selector: "#plan-descripcion",
        title: "Descripción del caso",
        body: "Contá qué necesita el usuario, qué probaste y cualquier dato que ayude a la mesa que recibe el caso.",
        placement: "bottom",
      },
      {
        selector: "#plan-capturas-card",
        title: "Capturas y adjuntos",
        body: "Subí pantallas, trazas SQL o backups si aplica. Marcá cada tipo de adjunto que vas a incluir en el ticket.",
        placement: "top",
        when: () => visible("#plan-capturas-card"),
      },
      {
        selector: "#plan-btn-ia",
        title: "Mejorar redacción con IA",
        body: "Opcional: ordena y clarifica asunto, descripción y pasos. Si no te convence, deshacé con ↩.",
        placement: "top",
        when: () => visible("#plan-btn-ia"),
      },
      {
        selector: "#plan-btn-ver-planilla",
        title: "Vista previa",
        body: "Generá la planilla y revisala en pantalla antes de copiar. Verificá que los datos estén completos.",
        placement: "top",
      },
      {
        selector: "#plan-btn-copiar",
        title: "Copiar al portapapeles",
        body: "Pegá el texto en el comentario o cuerpo del ticket. Listo para enviar.",
        placement: "top",
      },
    ],
  };
}

export function buildReferralStandardTour(ctx, sistema) {
  const sys = sistemaLabel(sistema);
  return {
    id: `referral:${sistema}`,
    steps: [
      {
        selector: "#ref-bejerman-panel",
        title: "Versión y módulo",
        body: "En Bejerman SQL indicá versión y módulo afectado. Eso define el contexto del escalamiento.",
        placement: "bottom",
        when: () => visible("#ref-bejerman-panel"),
      },
      {
        selector: "#ref-chile-panel",
        title: "Producto Chile",
        body: "Elegí el producto (Hyperrenta, etc.), año, RUT y versión. Completá los campos que aparecen según el producto.",
        placement: "bottom",
        when: () => visible("#ref-chile-panel"),
      },
      {
        selector: "#ref-asunto",
        title: "Asunto, descripción y pasos",
        body: `Los tres campos centrales del referral en ${sys}. El paso a paso debe permitir reproducir el caso sin llamarte.`,
        placement: "bottom",
        when: () => visible("#ref-standard-flow"),
      },
      {
        selector: "#ref-btn-ia",
        title: "Mejorar con IA",
        body: "Pulí la redacción de asunto, descripción y paso a paso. Siempre podés deshacer.",
        placement: "top",
        when: () => visible("#ref-btn-ia"),
      },
      {
        selector: "#ref-bejerman-post",
        title: "Comprobaciones (Bejerman)",
        body: "Marcá planilla técnica, MAM, SDK y adjuntos según lo que revisaste. Perfil técnico desbloquea más opciones.",
        placement: "top",
        when: () => visible("#ref-bejerman-post"),
      },
      {
        selector: "#ref-onvio-panel",
        title: "Comprobaciones (ONVIO)",
        body: "Indicá si reproduciste el caso, si hay ticket de servicio y si adjuntás pantallas.",
        placement: "top",
        when: () => visible("#ref-onvio-panel"),
      },
      {
        selector: "#ref-chile-post",
        title: "Adjuntos Chile",
        body: "Marcá si adjuntás pantallas o bases según lo que vayas a subir al ticket.",
        placement: "top",
        when: () => visible("#ref-chile-post"),
      },
      {
        selector: "#ref-btn-ver-planilla, #ref-btn-copiar",
        title: "Generar y copiar",
        body: "Vista previa o copiar directo. El TXT incluye secciones de sistema, detalle y adjuntos.",
        placement: "top",
        when: () => visible("#ref-btn-ver-planilla") || visible("#ref-btn-copiar"),
      },
    ],
  };
}

export function buildReferralLegalHubTour() {
  return {
    id: "referral-legal-hub",
    steps: [
      {
        selector: "#ref-legal-hub-root",
        title: "Elegí el producto",
        body: "HighQ, Legal One, Westlaw o CoCounsel. Cada uno tiene su plantilla de escalamiento N2/N3.",
        placement: "bottom",
      },
      {
        selector: "#ref-legal-templates-root",
        title: "Plantilla de escalamiento",
        body: "Seleccioná la plantilla (por ejemplo «Escalamiento a N2/N3»). Se abre el formulario con las secciones que pide soporte.",
        placement: "top",
        when: () => visible("#ref-legal-templates"),
      },
      {
        center: true,
        title: "Evidencias en OneDrive",
        body: "En LEGAL las evidencias van como links de OneDrive (botón + para agregar más). No hace falta subir archivos pesados acá.",
      },
    ],
  };
}

export function buildReferralLegalFormTour() {
  return {
    id: "referral-legal-form",
    steps: [
      {
        selector: "#ref-legal-template-form",
        title: "Completá por secciones",
        body: "Datos del entorno, descripción, pasos para reproducir, resultados observado/esperado y evidencias. Los obligatorios suelen estar arriba.",
        placement: "top",
      },
      {
        selector: ".plan-legal-onedrive-list",
        title: "Links de OneDrive",
        body: "Pegá el link compartido de las capturas o videos. Podés agregar varios con el botón +.",
        placement: "top",
        when: () => visible(".plan-legal-onedrive-list"),
      },
      {
        selector: "#ref-legal-btn-ia",
        title: "Mejorar redacción con IA",
        body: "Mejorá descripción, pasos y resultados. El botón ↩ deshace si no te convence.",
        placement: "top",
        when: () => visible("#ref-legal-btn-ia"),
      },
      {
        selector: "#ref-legal-btn-ver-planilla",
        title: "Vista previa del TXT",
        body: "Revisá la planilla unificada (DATOS DEL SISTEMA, DETALLES, ADJUNTOS) antes de copiar.",
        placement: "top",
      },
      {
        selector: "#ref-legal-btn-copiar",
        title: "Copiar al ticket",
        body: "Llevá el texto al escalamiento en el sistema de tickets.",
        placement: "top",
      },
    ],
  };
}

export function buildOportunidadMenuTour() {
  return {
    id: "oportunidad-menu",
    steps: [
      {
        selector: "#planillas-oportunidad-menu .plan-op-card",
        title: "Dos caminos",
        body: "Cargar: registrás una oportunidad nueva. Gestor: ves, confirmás o exportás las que ya cargaste.",
        placement: "bottom",
      },
      {
        selector: '[data-op-view="cargar"]',
        title: "Cargar oportunidad",
        body: "Formulario con datos del contacto, cliente y descripción. Al final podés mejorar texto con IA y generar PDF.",
        placement: "top",
        when: () => visible('[data-op-view="cargar"]'),
      },
      {
        selector: '[data-op-view="gestor"]',
        title: "Gestor",
        body: "Tabla de oportunidades: filtrá, confirmá contacto o descargá el registro.",
        placement: "top",
        when: () => visible('[data-op-view="gestor"]'),
      },
    ],
  };
}

export function buildOportunidadCargarTour() {
  return {
    id: "oportunidad-cargar",
    steps: [
      {
        selector: "#planillas-oportunidad-cargar .plan-form-grid",
        title: "Datos del contacto",
        body: "Completá método de ingreso, cliente, razón social, teléfono, correo y horarios de contacto.",
        placement: "bottom",
        when: () => visible("#planillas-oportunidad-cargar .plan-form-grid"),
      },
      {
        selector: "#op-descripcion",
        title: "Descripción",
        body: "Detallá la consulta o interés del cliente. Es lo que verá el equipo comercial.",
        placement: "bottom",
        when: () => visible("#op-descripcion"),
      },
      {
        selector: "#op-btn-ia",
        title: "Mejorar con IA",
        body: "Opcional: pulí la descripción antes de generar el PDF.",
        placement: "top",
        when: () => visible("#op-btn-ia"),
      },
      {
        selector: "#op-btn-pdf",
        title: "Generar PDF",
        body: "Creá el PDF con los datos cargados para enviar al cliente o adjuntar al registro.",
        placement: "top",
        when: () => visible("#op-btn-pdf"),
      },
    ],
  };
}

export function buildOportunidadGestorTour() {
  return {
    id: "oportunidad-gestor",
    steps: [
      {
        selector: "#planillas-oportunidad-gestor",
        title: "Listado de oportunidades",
        body: "Acá ves todo lo cargado: fecha, descripción y estado. Usá los filtros si hay muchos registros.",
        placement: "bottom",
      },
      {
        selector: ".plan-gestor-table-wrap, .plan-op-gestor-table",
        title: "Acciones por fila",
        body: "Confirmá contacto, abrí el detalle o exportá según lo que necesites hacer con cada oportunidad.",
        placement: "top",
        when: () => visible(".plan-gestor-table-wrap") || visible(".plan-op-gestor-table"),
      },
    ],
  };
}

export function buildPdfPortalTour() {
  return {
    id: "pdf-portal",
    steps: [
      {
        selector: "#planillas-pdf-portal",
        title: "Generador de PDFs",
        body: "Completá los datos del caso y generá el PDF listo para el Portal Cliente.",
        placement: "bottom",
      },
    ],
  };
}

export function buildBlanqueoTour() {
  return {
    id: "blanqueo",
    steps: [
      {
        selector: ".blanqueo-form-panel",
        title: "Nueva solicitud",
        body: "Elegí plataforma (On Balance, ONVIO, Portal Cliente), número de caso y usuario a blanquear.",
        placement: "bottom",
        when: () => visible(".blanqueo-form-panel"),
      },
      {
        selector: ".blanqueo-list-panel, .plan-gestor-panel:not(.blanqueo-form-panel)",
        title: "Seguimiento",
        body: "Las solicitudes enviadas aparecen acá con su estado. Refrescá para ver avances.",
        placement: "top",
        when: () => visible(".blanqueo-list-panel"),
      },
    ],
  };
}

export function buildBorradoBasesTour() {
  return {
    id: "borrado-bases",
    steps: [
      {
        selector: "#planillas-borrado-bases .borrado-form-panel, #planillas-borrado-bases .plan-gestor-panel",
        title: "Solicitud de borrado",
        body: "Indicá cliente, bases a borrar (IVA, SJ, CG) y datos de contacto. El equipo de operaciones procesa el pedido.",
        placement: "bottom",
      },
    ],
  };
}

export function buildChileSoporteTour() {
  return {
    id: "chile-soporte",
    steps: [
      {
        selector: "#plan-chile-embed-back",
        title: "Soporte embebido",
        body: "Estás viendo una herramienta Chile dentro de ST². Usá «Volver» para regresar al menú de planillas.",
        placement: "bottom",
        when: () => visible("#plan-chile-embed-back"),
      },
      {
        selector: "#planChileEmbedFrame",
        title: "Navegación",
        body: "Interactuá con la herramienta como en el navegador. Si no carga, probá recargar desde el menú ⋮.",
        placement: "top",
        when: () => visible("#planChileEmbedFrame"),
      },
    ],
  };
}

export function buildThomTabTour() {
  return {
    id: "thom-tab",
    steps: [
      {
        selector: '#thomPortalBar, .tab-btn[data-tab="thom"]',
        title: "THOM",
        body: "Elegí el portal (SQL/ONVIO, LEGAL o Chile). La sesión se abre embebida o en ventana según tu configuración.",
        placement: "bottom",
      },
      {
        selector: "#thomOpenBtn, #thomGateOpenBtn",
        title: "Abrir en navegador",
        body: "Si el embed no alcanza, podés abrir THOM en una pestaña aparte.",
        placement: "top",
        when: () => visible("#thomOpenBtn") || visible("#thomGateOpenBtn"),
      },
    ],
  };
}

export function buildAiTabTour() {
  return {
    id: "ai-tab",
    steps: [
      {
        selector: '#panel-ai, .tab-btn[data-tab="ai"]',
        title: "AI Platform",
        body: "Herramientas de IA de Thomson. La sesión carga en el panel; usala para consultas del flujo de soporte.",
        placement: "bottom",
      },
    ],
  };
}

export function buildPortalTabTour() {
  return {
    id: "portal-tab",
    steps: [
      {
        selector: "#portalSistemaPills, #tabPortalBtn",
        title: "Portal Cliente",
        body: "Elegí el sistema del portal y navegá los recursos del cliente sin salir de ST².",
        placement: "bottom",
      },
    ],
  };
}

export function resolveTour(tourId, ctx = {}) {
  if (!tourId) return null;
  if (tourId === "welcome") return buildWelcomeTour(ctx);
  if (tourId === "thom-tab") return buildThomTabTour();
  if (tourId === "ai-tab") return buildAiTabTour();
  if (tourId === "portal-tab") return buildPortalTabTour();
  if (tourId === "oportunidad-menu") return buildOportunidadMenuTour();
  if (tourId === "oportunidad-cargar") return buildOportunidadCargarTour();
  if (tourId === "oportunidad-gestor") return buildOportunidadGestorTour();
  if (tourId === "pdf-portal") return buildPdfPortalTour();
  if (tourId === "blanqueo") return buildBlanqueoTour();
  if (tourId === "borrado-bases") return buildBorradoBasesTour();
  if (tourId === "chile-soporte") return buildChileSoporteTour();
  if (tourId === "referral-legal-hub") return buildReferralLegalHubTour();
  if (tourId === "referral-legal-form") return buildReferralLegalFormTour();

  if (tourId.startsWith("planillas-menu:")) {
    return buildPlanillasMenuTour(ctx, tourId.split(":")[1] || ctx.getSistema?.());
  }
  if (tourId.startsWith("transferencia:")) {
    return buildTransferenciaTour(ctx, tourId.split(":")[1] || ctx.getSistema?.());
  }
  if (tourId.startsWith("referral:")) {
    return buildReferralStandardTour(ctx, tourId.split(":")[1] || ctx.getSistema?.());
  }

  return null;
}
