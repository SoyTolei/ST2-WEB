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

function buildTopNavTabSteps({ includeBarIntro = false } = {}) {
  const steps = [];

  if (includeBarIntro && visible(".tab-bar")) {
    steps.push({
      selector: ".tab-bar",
      title: "Pestañas de arriba",
      body: "Desde acá cambiás de módulo en ST². Empezá por Planillas; THOM, IA y Portal Cliente están al lado según tu perfil.",
      placement: "bottom",
    });
  }

  if (visible('.tab-btn[data-tab="planillas"]')) {
    steps.push({
      selector: '.tab-btn[data-tab="planillas"]',
      title: "Sistema de Planillas",
      body: "Acá trabajás el día a día: transferencias, referrals, oportunidades y herramientas según tu perfil. Es el punto de partida de ST².",
      placement: "bottom",
    });
  }

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

  return steps;
}

const MENU_MODULO_COPY = {
  transferencia: {
    BejermanSql:
      "Derivá el caso entre mesas (Técnico, Flex, SaaS…). Completá cliente, módulo Bejerman, ambiente, asunto, descripción, capturas y backups SQL si corresponde. Al final copiás la planilla al ticket.",
    OnvioWeb:
      "Derivá casos ONVIO o Bejerman Web entre mesas. Indicá producto web, tenant, pantalla afectada, pasos y capturas. La planilla queda lista para pegar en el comentario del ticket.",
    Chile:
      "Derivá casos del flujo Chile entre mesas. Incluí RUT, producto local (Hyperrenta, etc.), síntoma claro y capturas. Copiás el texto generado al ticket de soporte.",
  },
  referral: {
    BejermanSql:
      "Escalamiento a I+D o N2 cuando el caso requiere desarrollo. Indicá versión y módulo Bejerman, asunto, descripción, paso a paso, planilla técnica, MAM, SDK y adjuntos según lo revisado.",
    OnvioWeb:
      "Escalamiento ONVIO/WEB a desarrollo o N2. Marcá si reproduciste el caso, si hay ticket de servicio y qué pantallas adjuntás. El TXT unifica sistema, detalle y adjuntos.",
    Chile:
      "Escalamiento a desarrollo o N2 del producto chileno. Elegí Hyperrenta u otro producto, año, RUT, versión y detallá pasos. Podés marcar pantallas o bases que vas a adjuntar.",
    Legal:
      "En LEGAL el referral se hace por producto: elegís HighQ, Legal One, Westlaw o CoCounsel y completás la plantilla N2/N3 con evidencias en OneDrive.",
  },
  oportunidad: {
    BejermanSql:
      "Registrá un lead comercial de Bejerman SQL: contacto, cliente, teléfono, horarios y descripción. Podés mejorar el texto con IA y generar PDF para el equipo comercial.",
    OnvioWeb:
      "Registrá oportunidades de venta ONVIO/WEB. Cargá datos del contacto y la consulta; desde el gestor confirmás seguimiento o exportás el registro.",
    Chile:
      "Registrá oportunidades del mercado Chile con los mismos datos de contacto y descripción. El gestor centraliza lo cargado por el equipo.",
  },
  pdfPortal: {
    OnvioWeb:
      "Armá PDFs listos para el Portal Cliente a partir de los datos del caso ONVIO/WEB: cliente, producto y detalle sin armar el documento a mano.",
    BejermanSql:
      "Generá PDFs para el Portal Cliente con los datos del caso Bejerman. Completá el formulario y descargá el archivo para enviar o adjuntar.",
  },
  blanqueo: {
    OnvioWeb:
      "Pedí blanqueo de contraseñas en ONVIO, On Balance o Portal Cliente. Indicá plataforma, número de caso y usuario; seguís el estado de cada solicitud en el listado.",
  },
  borradoBases: {
    OnvioWeb:
      "Solicitá borrado de bases web (IVA, SJ, CG). Completá cliente, bases afectadas y contacto; operaciones procesa el pedido y ves el avance acá.",
  },
};

const LEGAL_PRODUCT_COPY = {
  firm: {
    title: "Legal One",
    body: "Gestión jurídica y expedientes. Abrís el escalamiento N2/N3 con datos del entorno, descripción, pasos para reproducir y links de OneDrive para evidencias.",
  },
  highq: {
    title: "HighQ",
    body: "Colaboración y proyectos legales. La plantilla N2/N3 pide entorno, detalle del caso, resultados y evidencias como links de OneDrive (sin subir archivos pesados acá).",
  },
  westlaw: {
    title: "Westlaw",
    body: "Investigación legal. Escalamiento N2/N3 con contexto de la consulta, pasos realizados, resultado observado vs esperado y capturas en OneDrive.",
  },
  cocounsel: {
    title: "CoCounsel",
    body: "Asistente de IA legal. Documentá el prompt, el comportamiento observado, pasos de reproducción y evidencias de la sesión en OneDrive para N2/N3.",
  },
};

const CHILE_SOPORTE_COPY = {
  ".chile-saad": {
    title: "SAAD · Facturación",
    body: "Administración de documentos y facturación electrónica Chile. Consultá emisiones, errores SAAD y trámites sin abrir otra pestaña.",
  },
  ".chile-hr": {
    title: "HR Consola Intranet",
    body: "Consola de Recursos Humanos / Hyperrenta para consultas internas del equipo Chile. Se abre embebida dentro de ST².",
  },
  ".chile-wiki": {
    title: "Wiki errores comunes",
    body: "Base de conocimiento con soluciones frecuentes del soporte Chile. Buscá el error antes de escalar o derivar.",
  },
  ".chile-lp": {
    title: "Servicios LP Contabilidad",
    body: "Framework LP para procesos contables locales. Acceso directo a herramientas y servicios del ecosistema Chile.",
  },
  ".chile-powerapps": {
    title: "PowerApps Chile",
    body: "Aplicaciones internas en Power Platform (formularios y flujos del equipo Chile). Útil para trámites y registros específicos.",
  },
};

export function tourLabelForId() {
  return "Tutorial";
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
      selector: "#themeToggleBtn",
      title: "Tema claro u oscuro",
      body: "Cambiá el modo visual cuando quieras. La preferencia queda guardada en este navegador.",
      placement: "bottom",
      when: () => visible("#themeToggleBtn"),
    },
    {
      selector: "#st2-tour-header-btn",
      title: "Tutorial",
      body: "Este botón repite el tutorial de la pantalla en la que estás. En Planillas verás primero las pestañas de arriba y cada módulo de tu sistema.",
      placement: "bottom",
      when: () => visible("#st2-tour-header-btn"),
    },
  ];

  if (!visible("#st2-tour-header-btn")) {
    steps.push({
      center: true,
      title: "Tutorial siempre disponible",
      body: "Cuando ingreses a Planillas u otro módulo, vas a ver el botón «Tutorial» arriba, al lado de tu correo.",
    });
  }

  return { id: "welcome", steps };
}

export function buildPlanillasMenuTour(ctx, sistema) {
  const label = sistemaLabel(sistema);
  const steps = [...buildTopNavTabSteps({ includeBarIntro: true })];

  if (visible("#plan-sistema-section")) {
    steps.push({
      selector: "#plan-sistema-section",
      title: "Elegí el sistema",
      body: `Confirmá que estás en ${label}. Cada píldora (SQL, ONVIO/WEB, LEGAL, Chile) tiene sus propias planillas, campos y módulos habilitados para tu perfil.`,
      placement: "bottom",
    });
  }

  if (visible("#plan-modulo-transferencia")) {
    steps.push({
      selector: "#plan-modulo-transferencia",
      title: "Transferencia de Casos",
      body: MENU_MODULO_COPY.transferencia[sistema] || MENU_MODULO_COPY.transferencia.BejermanSql,
      placement: "top",
    });
  }

  if (visible('[data-plan-modulo="referral"]') && sistema !== "Legal") {
    steps.push({
      selector: '[data-plan-modulo="referral"]',
      title: "Referral I+D",
      body: MENU_MODULO_COPY.referral[sistema] || MENU_MODULO_COPY.referral.BejermanSql,
      placement: "top",
    });
  }

  if (visible("#plan-modulo-oportunidad")) {
    steps.push({
      selector: "#plan-modulo-oportunidad",
      title: "Oportunidad de Venta",
      body: MENU_MODULO_COPY.oportunidad[sistema] || MENU_MODULO_COPY.oportunidad.BejermanSql,
      placement: "top",
    });
  }

  if (visible("#plan-modulo-pdf-portal")) {
    steps.push({
      selector: "#plan-modulo-pdf-portal",
      title: "Generador de PDFs",
      body: MENU_MODULO_COPY.pdfPortal[sistema] || MENU_MODULO_COPY.pdfPortal.OnvioWeb,
      placement: "top",
    });
  }

  if (visible("#plan-modulo-blanqueo")) {
    steps.push({
      selector: "#plan-modulo-blanqueo",
      title: "Blanqueo de accesos",
      body: MENU_MODULO_COPY.blanqueo.OnvioWeb,
      placement: "top",
    });
  }

  if (visible("#plan-modulo-borrado-bases")) {
    steps.push({
      selector: "#plan-modulo-borrado-bases",
      title: "Borrado de bases",
      body: MENU_MODULO_COPY.borradoBases.OnvioWeb,
      placement: "top",
    });
  }

  if (visible("#plan-legal-products-wrap")) {
    steps.push({
      selector: "#plan-legal-products-wrap",
      title: "Productos LEGAL",
      body: MENU_MODULO_COPY.referral.Legal,
      placement: "top",
    });

    Object.entries(LEGAL_PRODUCT_COPY).forEach(([productId, copy]) => {
      const selector = `[data-legal-menu-product="${productId}"]`;
      steps.push({
        selector,
        title: copy.title,
        body: copy.body,
        placement: "top",
        when: () => visible(selector),
      });
    });
  }

  if (visible("#plan-chile-soporte-wrap")) {
    steps.push({
      selector: "#plan-chile-soporte-wrap",
      title: "Soporte técnico Chile",
      body: "Accesos embebidos a herramientas del equipo Chile. Cada botón abre la herramienta dentro de ST²; usá «Volver» para regresar al menú.",
      placement: "top",
    });

    Object.entries(CHILE_SOPORTE_COPY).forEach(([selector, copy]) => {
      steps.push({
        selector,
        title: copy.title,
        body: copy.body,
        placement: "top",
        when: () => visible(selector),
      });
    });
  }

  steps.push({
    selector: "#st2-tour-header-btn",
    title: "Tutorial",
    body: "El botón de arriba repite este recorrido cuando lo necesites. Cada pantalla tiene su propio tutorial según lo que tengas habilitado.",
    placement: "left",
    when: () => visible("#st2-tour-header-btn"),
  });

  return { id: `planillas-menu:${sistema}`, steps };
}

export function buildTransferenciaTour(ctx, sistema) {
  const introBySistema = {
    BejermanSql:
      "Elegí la mesa destino (Técnico, Flex, SaaS…) y completá cliente, módulo Bejerman, versión y ambiente. Los campos visibles dependen de la derivación.",
    OnvioWeb:
      "Elegí la mesa destino y completá producto ONVIO/WEB, tenant, usuario y pantalla afectada. Revisá que el contexto web quede claro para quien recibe.",
    Chile:
      "Elegí la mesa destino y completá RUT, producto Chile y datos del caso. Incluí todo lo que la mesa necesite para retomar sin llamarte.",
    Legal:
      "Completá los datos de derivación del caso LEGAL según la mesa destino y el producto involucrado.",
  };
  return {
    id: `transferencia:${sistema}`,
    steps: [
      {
        selector: "#plan-trans-standard-fields, #plan-trans-legal-panel",
        title: "Datos de derivación",
        body: introBySistema[sistema] || introBySistema.BejermanSql,
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
  const asuntoCopy = {
    BejermanSql:
      "Los tres campos centrales del referral SQL: asunto breve, descripción del problema y paso a paso para reproducir. Incluí versión y módulo en el contexto.",
    OnvioWeb:
      "Asunto, descripción y pasos en ONVIO/WEB. Indicá tenant, pantalla y qué probaste; el N2 debe poder reproducir sin volver a preguntarte.",
    Chile:
      "Asunto, descripción y pasos del producto Chile. Detallá RUT, año y versión en el cuerpo si no están en campos separados.",
  };
  return {
    id: `referral:${sistema}`,
    steps: [
      {
        selector: "#ref-bejerman-panel",
        title: "Versión y módulo",
        body: "En Bejerman SQL indicá versión y módulo afectado (contabilidad, sueldos, etc.). Eso define el contexto del escalamiento a I+D o N2.",
        placement: "bottom",
        when: () => visible("#ref-bejerman-panel"),
      },
      {
        selector: "#ref-chile-panel",
        title: "Producto Chile",
        body: "Elegí el producto (Hyperrenta, etc.), año, RUT y versión. Los campos extra aparecen según el producto seleccionado.",
        placement: "bottom",
        when: () => visible("#ref-chile-panel"),
      },
      {
        selector: "#ref-asunto",
        title: "Asunto, descripción y pasos",
        body: asuntoCopy[sistema] || `Los tres campos centrales del referral en ${sys}. El paso a paso debe permitir reproducir el caso sin llamarte.`,
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
        body: "Marcá planilla técnica, MAM, SDK y adjuntos según lo que revisaste en el cliente. El perfil técnico desbloquea más opciones de comprobación.",
        placement: "top",
        when: () => visible("#ref-bejerman-post"),
      },
      {
        selector: "#ref-onvio-panel",
        title: "Comprobaciones (ONVIO)",
        body: "Indicá si reproduciste el caso en el tenant del cliente, si ya existe ticket de servicio y si vas a adjuntar pantallas o logs.",
        placement: "top",
        when: () => visible("#ref-onvio-panel"),
      },
      {
        selector: "#ref-chile-post",
        title: "Adjuntos Chile",
        body: "Marcá si adjuntás pantallas, bases o archivos del producto chileno. Eso orienta a N2 sobre qué esperar en el ticket.",
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
  const steps = [
    {
      selector: "#ref-legal-hub-root",
      title: "Elegí el producto",
      body: "Cada producto LEGAL tiene su plantilla N2/N3. Elegí el que corresponda al caso antes de completar el formulario.",
      placement: "bottom",
    },
  ];

  Object.entries(LEGAL_PRODUCT_COPY).forEach(([productId, copy]) => {
    const selector = `[data-legal-product="${productId}"]`;
    steps.push({
      selector,
      title: copy.title,
      body: copy.body,
      placement: "top",
      when: () => visible(selector),
    });
  });

  steps.push(
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
  );

  return { id: "referral-legal-hub", steps };
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
