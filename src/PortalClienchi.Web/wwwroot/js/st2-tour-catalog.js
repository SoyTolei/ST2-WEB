function visible(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  if (el.closest(".hidden,[hidden]")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function previewCopyStep(previewSelector, copySelector) {
  return {
    selector: `${previewSelector}, ${copySelector}`,
    title: "Vista previa o copiar",
    body:
      "«Vista previa» muestra la planilla en pantalla para revisarla antes de enviar. «Copiar» lleva el texto al portapapeles para pegarlo en el ticket. Usá la que prefieras.",
    placement: "top",
    when: () => visible(previewSelector) || visible(copySelector),
  };
}

function legalSectionStep(sectionId, title, body) {
  const selector = `.plan-legal-section[data-legal-section="${sectionId}"]`;
  return {
    selector,
    title,
    body,
    placement: "top",
    when: () => visible(selector),
  };
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

function portalTabLabel(ctx = {}) {
  return ctx.getPortalTabLabel?.() || "Portal Cliente";
}

function buildTopNavTabSteps(ctx = {}) {
  const portalLabel = portalTabLabel(ctx);
  const steps = [];

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
      title: portalLabel,
      body: portalLabel === "Centro de Soluciones"
        ? "Acceso al Centro de Soluciones de Thomson Reuters Chile: recursos, consultas y herramientas del cliente sin salir de ST²."
        : "Acceso al portal del cliente según el sistema que tengas habilitado (SQL/ONVIO, LEGAL o Chile).",
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
    body: "Gestión jurídica integral: expedientes, agenda, documentos y workflows del estudio. Abrís el escalamiento N2/N3 para reportar bugs de módulos, permisos o procesos; completás entorno, descripción, pasos y evidencias en OneDrive.",
  },
  highq: {
    title: "HighQ",
    body: "Colaboración en proyectos legales: sitios, tareas, documentos compartidos y automatizaciones. La plantilla N2/N3 pide datos del sitio HighQ, cómo reproducir el error y links de pantallas o videos en OneDrive.",
  },
  westlaw: {
    title: "Westlaw",
    body: "Investigación jurídica y búsqueda de precedentes. Usalo cuando falla una consulta, filtro, exportación o vista; detallá la búsqueda hecha, resultado esperado vs obtenido y adjuntá capturas en OneDrive.",
  },
  cocounsel: {
    title: "CoCounsel",
    body: "Asistente de IA para tareas legales (borradores, resúmenes, análisis de documentos). Documentá el flujo o prompt usado, qué respondió mal la IA, pasos para reproducirlo y evidencias de la sesión en OneDrive.",
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
  return {
    id: "welcome",
    steps: [
      {
        selector: "#themeToggleBtn",
        title: "Tema claro u oscuro",
        body: "Cambiá el modo visual cuando quieras. La preferencia queda guardada en este navegador.",
        placement: "bottom",
        when: () => visible("#themeToggleBtn"),
      },
    ],
  };
}

export function buildPlanillasMenuTour(ctx, sistema) {
  const label = sistemaLabel(sistema);
  const steps = [...buildTopNavTabSteps(ctx)];

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
      title: sistema === "Legal" ? "Escalamiento N2/N3" : "Referral I+D",
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
  const mesaCopy = {
    BejermanSql:
      "Técnico (incidencias generales), Flex, SaaS, Sueldos u otra mesa del flujo SQL. La mesa define qué datos y adjuntos vas a necesitar.",
    OnvioWeb:
      "Técnico ONVIO, Flex Web u otra mesa del ecosistema web. Elegí según el producto o proceso que estás derivando.",
    Chile:
      "Mesa del equipo Chile que debe continuar el caso (técnico, escalamiento u otra según el flujo local).",
  };
  const clienteCopy = {
    BejermanSql: "Número de cliente Bejerman. Si la mesa es SaaS o Sueldos pueden aparecer campos extra.",
    OnvioWeb: "Identificador del cliente o tenant ONVIO/WEB según lo que pida la derivación.",
    Chile: "RUT y datos del cliente chileno para que la mesa ubique el caso rápido.",
  };
  const asuntoCopy = {
    BejermanSql: "Una línea con el error o consulta: módulo, pantalla y síntoma concreto.",
    OnvioWeb: "Resumen del fallo en ONVIO/WEB: pantalla, acción y mensaje de error si hay.",
    Chile: "Síntoma claro del caso Chile: producto, pantalla y qué no funciona.",
    Legal: "Resumen del caso LEGAL: producto, módulo y síntoma.",
  };
  const descripcionCopy = {
    BejermanSql: "Qué necesita el usuario, qué revisaste (versión, módulo, pasos) y datos que ayuden a la mesa. Podés usar «Mejorar redacción» con IA y deshacer con ↩.",
    OnvioWeb: "Contexto del tenant, pantalla afectada, qué probaste y cualquier dato web relevante. La IA puede ordenar el texto si lo necesitás.",
    Chile: "Detalle del caso local: producto, pasos hechos y lo que esperás que haga la mesa. La IA ayuda a pulir la redacción.",
    Legal: "Qué necesita el usuario y qué revisaste en el entorno LEGAL del cliente.",
  };

  const steps = [];

  if (sistema === "Legal") {
    steps.push(
      {
        selector: "#plan-legal-mesas",
        title: "Mesa destino",
        body: "Elegí N2, N3 u otra mesa LEGAL que reciba el caso.",
        placement: "bottom",
        when: () => visible("#plan-legal-mesas"),
      },
      {
        selector: "#plan-trans-legal-panel",
        title: "Producto y cliente",
        body: "Producto (HighQ, Legal One…), módulo, ambiente, clave, usuario y escritorio. Sin esto la mesa no puede retomar el caso.",
        placement: "bottom",
        when: () => visible("#plan-trans-legal-panel"),
      },
    );
  } else {
    steps.push(
      {
        selector: "#plan-standard-mesas",
        title: "Mesa destino",
        body: mesaCopy[sistema] || mesaCopy.BejermanSql,
        placement: "bottom",
        when: () => visible("#plan-standard-mesas"),
      },
      {
        selector: "#plan-numero-cliente",
        title: "Cliente",
        body: clienteCopy[sistema] || clienteCopy.BejermanSql,
        placement: "bottom",
        when: () => visible("#plan-numero-cliente"),
      },
    );
  }

  steps.push(
    {
      selector: "#plan-asunto",
      title: "Asunto",
      body: asuntoCopy[sistema] || asuntoCopy.BejermanSql,
      placement: "bottom",
      when: () => visible("#plan-asunto"),
    },
    {
      selector: "#plan-descripcion",
      title: "Descripción",
      body: descripcionCopy[sistema] || descripcionCopy.BejermanSql,
      placement: "bottom",
      when: () => visible("#plan-descripcion"),
    },
    {
      selector: "#plan-capturas-card",
      title: "Capturas y adjuntos",
      body: "Marcá si adjuntás pantallas, trazas SQL o backups. Subí los archivos acá o indicá que van en el ticket.",
      placement: "top",
      when: () => visible("#plan-capturas-card"),
    },
    previewCopyStep("#plan-btn-ver-planilla", "#plan-btn-copiar"),
  );

  return { id: `transferencia:${sistema}`, steps };
}

export function buildReferralStandardTour(ctx, sistema) {
  const contextCopy = {
    BejermanSql:
      "Versión de Bejerman y módulo afectado (contabilidad, sueldos, etc.). Define el contexto del escalamiento a I+D o N2.",
    Chile:
      "Producto chileno (Hyperrenta, etc.), año, RUT y versión. Los campos extra dependen del producto elegido.",
  };
  const textoCopy = {
    BejermanSql:
      "Asunto: error en una línea. Descripción: qué falla y en qué contexto. Paso a paso: cómo reproducirlo (menús, datos de prueba). La IA puede mejorar los tres campos.",
    OnvioWeb:
      "Asunto: fallo web concreto. Descripción: tenant, pantalla y síntoma. Paso a paso: acciones hasta reproducir el error.",
    Chile:
      "Asunto: problema del producto local. Descripción: RUT, año y contexto. Paso a paso: menús y datos usados en la prueba.",
  };

  const steps = [];

  if (sistema === "BejermanSql") {
    steps.push({
      selector: "#ref-bejerman-panel",
      title: "Versión y módulo",
      body: contextCopy.BejermanSql,
      placement: "bottom",
      when: () => visible("#ref-bejerman-panel"),
    });
  } else if (sistema === "Chile") {
    steps.push({
      selector: "#ref-chile-panel",
      title: "Producto Chile",
      body: contextCopy.Chile,
      placement: "bottom",
      when: () => visible("#ref-chile-panel"),
    });
  }

  steps.push({
    selector: "#ref-standard-flow",
    title: "Asunto, descripción y pasos",
    body: textoCopy[sistema] || textoCopy.BejermanSql,
    placement: "bottom",
    when: () => visible("#ref-standard-flow"),
  });

  if (sistema === "BejermanSql") {
    steps.push({
      selector: "#ref-bejerman-post",
      title: "Comprobaciones y adjuntos",
      body:
        "Perfil Técnico u Otra mesa. Planilla técnica (se completa sola), MAM y SDK si los revisaste. Abajo marcá pantallas, traza SQL o backup de bases según lo que vas a incluir.",
      placement: "top",
      when: () => visible("#ref-bejerman-post"),
    });
  } else if (sistema === "OnvioWeb") {
    steps.push({
      selector: "#ref-onvio-panel",
      title: "Comprobaciones ONVIO",
      body:
        "¿El proceso funcionaba? ¿El error se reproduce? Marcá ticket de servicio (N° y técnico), pantallas adjuntas y completá empresa, usuario y ejercicio del cliente.",
      placement: "top",
      when: () => visible("#ref-onvio-panel"),
    });
  } else if (sistema === "Chile") {
    steps.push({
      selector: "#ref-chile-post",
      title: "Adjuntos Chile",
      body: "Indicá si adjuntás pantallas, bases u otros archivos del producto chileno para orientar a N2.",
      placement: "top",
      when: () => visible("#ref-chile-post"),
    });
  }

  steps.push(previewCopyStep("#ref-btn-ver-planilla", "#ref-btn-copiar"));

  return { id: `referral:${sistema}`, steps };
}

export function buildReferralLegalHubTour() {
  const steps = [];

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

  steps.push({
    selector: "#ref-legal-templates-root",
    title: "Plantilla de escalamiento",
    body: "Elegí la plantilla del producto (por ejemplo «Escalamiento a N2/N3»). Se abre el formulario con las secciones a completar.",
    placement: "top",
    when: () => visible("#ref-legal-templates"),
  });

  steps.push({
    center: true,
    title: "Evidencias en OneDrive",
    body: "En LEGAL las evidencias van como links de OneDrive (botón + para agregar más). No hace falta subir archivos pesados acá.",
  });

  return { id: "referral-legal-hub", steps };
}

export function buildReferralLegalFormTour() {
  const steps = [
    legalSectionStep(
      "minimo",
      "Datos del entorno",
      "Tenant, sitio, ambiente (prod/test), usuario o módulo afectado. Es lo primero que N2 necesita para ubicar el caso en el producto LEGAL.",
    ),
    legalSectionStep(
      "acceso",
      "Datos de acceso",
      "URLs, usuarios de prueba o credenciales si la plantilla lo pide. No pegues contraseñas reales si hay política de canal seguro.",
    ),
    legalSectionStep(
      "descripcion",
      "Descripción y reproducción",
      "Qué falla, en qué pantalla y el paso a paso: menús, clics y datos usados. Debe permitir repetir el caso sin volver a preguntarte.",
    ),
    legalSectionStep(
      "resultados",
      "Resultados",
      "Resultado observado (qué pasó) y resultado esperado (qué debería pasar). Contrastá ambos con claridad.",
    ),
    legalSectionStep(
      "detalle",
      "Detalle del caso",
      "Impacto, usuarios afectados, si es intermitente o desde cuándo ocurre. Aporta contexto que no entra en la descripción.",
    ),
    legalSectionStep(
      "checklist",
      "Checklist",
      "Marcá cada ítem que revisaste (caché, otro navegador, permisos, etc.) antes de escalar a N2/N3.",
    ),
    legalSectionStep(
      "recomendados",
      "Información adicional",
      "Campos recomendados: workaround probado, frecuencia, urgencia u otros datos que aceleren la gestión.",
    ),
    legalSectionStep(
      "opcionales",
      "Templates opcionales",
      "Datos opcionales según el producto. Completalos si suman contexto al escalamiento.",
    ),
    {
      selector: ".plan-legal-onedrive-list",
      title: "Links de OneDrive",
      body: "Pegá el link compartido de capturas o videos. El botón + agrega más links si tenés varias evidencias.",
      placement: "top",
      when: () => visible(".plan-legal-onedrive-list"),
    },
    {
      selector: "#ref-legal-btn-ia",
      title: "Mejorar redacción con IA",
      body: "Opcional: pulí descripción, pasos y resultados. El botón ↩ deshace si no te convence.",
      placement: "top",
      when: () => visible("#ref-legal-btn-ia"),
    },
    previewCopyStep("#ref-legal-btn-ver-planilla", "#ref-legal-btn-copiar"),
  ];

  return { id: "referral-legal-form", steps };
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
        selector: "#blanqueo-portal",
        title: "Plataforma",
        body: "On Balance, ONVIO o Portal Cliente. Define en qué sistema hay que blanquear o resetear el acceso.",
        placement: "bottom",
        when: () => visible("#blanqueo-portal"),
      },
      {
        selector: "#blanqueo-caso",
        title: "N° de caso",
        body: "Número del ticket o caso de soporte vinculado al pedido de blanqueo.",
        placement: "bottom",
        when: () => visible("#blanqueo-caso"),
      },
      {
        selector: "#blanqueo-cliente",
        title: "N° de cliente",
        body: "Identificador del cliente en la plataforma elegida.",
        placement: "bottom",
        when: () => visible("#blanqueo-cliente"),
      },
      {
        selector: "#blanqueo-correo",
        title: "Correo",
        body: "Email del usuario a blanquear. Si son varios, agregá una fila por correo.",
        placement: "bottom",
        when: () => visible("#blanqueo-correo"),
      },
      {
        selector: "#blanqueo-tipo",
        title: "Tipo de solicitud",
        body: "Blanqueo (solo contraseña), MFA (solo doble factor) o Blanqueo + MFA según lo que pida el caso.",
        placement: "bottom",
        when: () => visible("#blanqueo-tipo"),
      },
      {
        selector: "#blanqueo-modulos-field",
        title: "Módulos del Portal",
        body: "Solo con Portal Cliente: marcá qué módulos habilitar (Sueldos SQL/WEB, ONVIO, Bejerman SQL, Contabilidad WEB).",
        placement: "top",
        when: () => visible("#blanqueo-modulos-field"),
      },
      {
        selector: "#blanqueo-add",
        title: "Agregar solicitud",
        body: "Cargá la fila al listado. Operaciones la procesa y ves el estado en la tabla de abajo.",
        placement: "top",
        when: () => visible("#blanqueo-add"),
      },
      {
        selector: "#blanqueo-clave-hint",
        title: "Clave por defecto",
        body: "La clave generada suele ser la que indica acá, salvo que en Aclaración figure otra. Podés copiarla con un clic.",
        placement: "top",
        when: () => visible("#blanqueo-clave-hint"),
      },
      {
        selector: ".blanqueo-filter-bar",
        title: "Filtros del listado",
        body: "Filtrá por mes, plataforma o buscá por correo/caso/cliente. «Solo mis solicitudes» acota a lo que cargaste vos.",
        placement: "top",
        when: () => visible(".blanqueo-filter-bar"),
      },
      {
        selector: ".blanqueo-table-wrap",
        title: "Seguimiento",
        body: "Estado de cada pedido: pendiente, confirmado u observación en Aclaración. Quién lo gestionó aparece en la última columna.",
        placement: "top",
        when: () => visible(".blanqueo-table-wrap"),
      },
    ],
  };
}

export function buildBorradoBasesTour() {
  return {
    id: "borrado-bases",
    steps: [
      {
        selector: "#borrado-salesforce",
        title: "Varias bases en Salesforce",
        body: "Activá esto si el detalle completo está en Salesforce: solo cargás N° de caso y cliente y agregás con el botón.",
        placement: "bottom",
        when: () => visible("#borrado-salesforce"),
      },
      {
        selector: "#borrado-caso",
        title: "N° de caso",
        body: "Ticket o caso de soporte asociado al pedido de borrado.",
        placement: "bottom",
        when: () => visible("#borrado-caso"),
      },
      {
        selector: "#borrado-cliente",
        title: "N° de cliente",
        body: "Cliente al que corresponde el borrado de bases web.",
        placement: "bottom",
        when: () => visible("#borrado-cliente"),
      },
      {
        selector: "#borrado-empresa",
        title: "Código de empresa",
        body: "Código interno de la empresa en el sistema web. Va junto al nombre para que operaciones identifique la base.",
        placement: "bottom",
        when: () => visible("#borrado-empresa"),
      },
      {
        selector: "#borrado-nombre-empresa",
        title: "Nombre de empresa",
        body: "Razón social o nombre visible de la empresa afectada.",
        placement: "bottom",
        when: () => visible("#borrado-nombre-empresa"),
      },
      {
        selector: "#borrado-cuit",
        title: "CUIT",
        body: "Opcional. Ayuda a validar la empresa cuando hay homónimos o varias bases.",
        placement: "bottom",
        when: () => visible("#borrado-cuit"),
      },
      {
        selector: "#borrado-field-bases",
        title: "Bases a borrar",
        body: "Marcá IVA, Sueldos y Jornales y/o Contabilidad General según lo que operaciones deba eliminar.",
        placement: "top",
        when: () => visible("#borrado-field-bases"),
      },
      {
        selector: "#borrado-ejercicios",
        title: "Ejercicios a borrar",
        body: "Pegá el detalle del mail con los ejercicios o períodos a borrar cuando la plantilla lo requiera.",
        placement: "top",
        when: () => visible("#borrado-ejercicios"),
      },
      {
        selector: "#borrado-add, #borrado-add-detalle",
        title: "Agregar solicitud",
        body: "«Agregar» en modo Salesforce (solo caso/cliente) o el de abajo con el detalle completo de empresa y bases.",
        placement: "top",
        when: () => visible("#borrado-add") || visible("#borrado-add-detalle"),
      },
      {
        selector: ".borrado-filter-bar",
        title: "Filtros del listado",
        body: "Filtrá por mes o buscá por caso, cliente, empresa o CUIT. «Solo mis solicitudes» muestra lo que cargaste vos.",
        placement: "top",
        when: () => visible(".borrado-filter-bar"),
      },
      {
        selector: ".borrado-table-wrap",
        title: "Seguimiento",
        body: "Estado de cada pedido: pendiente, listo, eliminada u observación. Doble clic en Estado confirma si tenés permiso.",
        placement: "top",
        when: () => visible(".borrado-table-wrap"),
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

export function buildPortalTabTour(ctx = {}) {
  const label = portalTabLabel(ctx);
  return {
    id: "portal-tab",
    steps: [
      {
        selector: "#portalSistemaPills, #tabPortalBtn",
        title: label,
        body: label === "Centro de Soluciones"
          ? "Navegá el Centro de Soluciones de Chile: recursos, consultas y herramientas del cliente embebidas en ST²."
          : "Elegí el sistema del portal y navegá los recursos del cliente sin salir de ST².",
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
  if (tourId === "portal-tab") return buildPortalTabTour(ctx);
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
