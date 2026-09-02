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

export function buildWelcomeTour(ctx) {
  const steps = [
    {
      selector: '.tab-btn[data-tab="planillas"]',
      title: "Sistema de Planillas",
      body: "Acá armás y copiás planillas de transferencia, referral y otros módulos según tu perfil.",
      placement: "bottom",
    },
  ];

  if (visible('.tab-btn[data-tab="thom"]')) {
    steps.push({
      selector: '.tab-btn[data-tab="thom"]',
      title: "THOM",
      body: "Acceso a los portales Thomson según tu sistema: SQL/ONVIO, LEGAL o Chile.",
      placement: "bottom",
    });
  }

  if (visible('.tab-btn[data-tab="ai"]')) {
    steps.push({
      selector: '.tab-btn[data-tab="ai"]',
      title: "AI Platform",
      body: "Herramientas de inteligencia artificial integradas al flujo de trabajo.",
      placement: "bottom",
    });
  }

  if (visible("#tabPortalBtn")) {
    steps.push({
      selector: "#tabPortalBtn",
      title: "Portal Cliente",
      body: "Consultá información y recursos del portal según el sistema asignado.",
      placement: "bottom",
    });
  }

  steps.push({
    selector: "#themeToggleBtn",
    title: "Tema claro u oscuro",
    body: "Cambiá el modo visual cuando quieras. Tu elección queda guardada en este navegador.",
    placement: "bottom",
  });

  steps.push({
    center: true,
    title: "Tutorial siempre disponible",
    body: "En cada módulo vas a ver «Ver tutorial». Podés repetirlo cuando tengas dudas.",
    placement: "bottom",
  });

  return { id: "welcome", steps };
}

export function buildPlanillasMenuTour(ctx, sistema) {
  const label = sistemaLabel(sistema);
  const steps = [
    {
      selector: "#plan-sistema-section",
      title: "Elegí el sistema",
      body: `Seleccioná ${label} u otro sistema según el caso que estés derivando.`,
      placement: "bottom",
      when: () => visible("#plan-sistema-section"),
    },
    {
      selector: "#plan-opciones-section-title",
      title: "Opciones del sistema",
      body: "Cada tarjeta abre un módulo distinto: transferencia, referral, oportunidad y más.",
      placement: "bottom",
    },
  ];

  if (visible("#plan-modulo-transferencia")) {
    steps.push({
      selector: "#plan-modulo-transferencia",
      title: "Transferencia de Casos",
      body: "Para derivar un caso entre mesas con datos del cliente y capturas.",
      placement: "top",
    });
  }

  if (visible('[data-plan-modulo="referral"]')) {
    steps.push({
      selector: '[data-plan-modulo="referral"]',
      title: "Referral I+D",
      body: sistema === "Legal"
        ? "Escalamientos a N2/N3 por producto LEGAL (HighQ, Legal One, etc.)."
        : "Escalamiento a desarrollo o N2/N3 con planilla lista para copiar.",
      placement: "top",
    });
  }

  if (visible("#plan-modulo-oportunidad")) {
    steps.push({
      selector: "#plan-modulo-oportunidad",
      title: "Oportunidad de Venta",
      body: "Registro comercial: cargá oportunidades y seguilas desde el gestor.",
      placement: "top",
    });
  }

  if (visible("#plan-legal-products-wrap")) {
    steps.push({
      selector: "#plan-legal-products-wrap",
      title: "Productos LEGAL",
      body: "En LEGAL elegís el producto antes de abrir la plantilla de escalamiento.",
      placement: "top",
    });
  }

  if (visible("#plan-chile-soporte-wrap")) {
    steps.push({
      selector: "#plan-chile-soporte-wrap",
      title: "Soporte Chile",
      body: "Accesos rápidos a SAAD, Hyperrenta, Wiki y otras herramientas del equipo Chile.",
      placement: "top",
    });
  }

  steps.push({
    selector: "#st2-tour-menu-help",
    title: "Repetir cuando quieras",
    body: "Este botón vuelve a mostrar el tutorial del menú.",
    placement: "left",
    when: () => visible("#st2-tour-menu-help"),
  });

  return { id: `planillas-menu:${sistema}`, steps };
}

export function buildTransferenciaTour(ctx, sistema) {
  return {
    id: `transferencia:${sistema}`,
    steps: [
      {
        selector: "#plan-trans-standard-fields, #plan-trans-legal-panel",
        title: "Datos del caso",
        body: "Completá mesa de destino, cliente y campos del sistema antes de redactar.",
        placement: "bottom",
      },
      {
        selector: "#plan-asunto",
        title: "Asunto y descripción",
        body: "Resumí el error y detallá qué hizo el usuario. Cuanto más claro, más rápido lo toma la mesa.",
        placement: "bottom",
      },
      {
        selector: "#plan-capturas-card",
        title: "Capturas y adjuntos",
        body: "Subí pantallas, trazas o backups según corresponda. Ayudan a reproducir el caso.",
        placement: "top",
        when: () => visible("#plan-capturas-card"),
      },
      {
        selector: "#plan-btn-ia",
        title: "Mejorar redacción con IA",
        body: "Opcional: la IA ordena y mejora asunto, descripción y pasos. Podés deshacer con ↩.",
        placement: "top",
        when: () => visible("#plan-btn-ia"),
      },
      {
        selector: "#plan-btn-ver-planilla",
        title: "Generar y copiar",
        body: "Vista previa genera el texto; Copiar lo lleva al portapapeles para pegar en el ticket.",
        placement: "top",
      },
      {
        selector: ".st2-tour-help-btn[data-tour-id]",
        title: "Tutorial en cualquier momento",
        body: "Si tenés dudas más adelante, volvé a abrir este tour desde acá.",
        placement: "left",
        when: () => visible(".st2-tour-help-btn[data-tour-id]"),
      },
    ],
  };
}

export function buildReferralStandardTour(ctx, sistema) {
  return {
    id: `referral:${sistema}`,
    steps: [
      {
        selector: "#ref-bejerman-panel, #ref-chile-panel",
        title: "Configuración del caso",
        body: "Elegí versión, módulo o producto según el sistema antes de completar el detalle.",
        placement: "bottom",
        when: () => visible("#ref-bejerman-panel") || visible("#ref-chile-panel"),
      },
      {
        selector: "#ref-asunto",
        title: "Detalle del caso",
        body: "Asunto, descripción y paso a paso son la base del escalamiento.",
        placement: "bottom",
        when: () => visible("#ref-standard-flow") && !visible("#ref-legal-hub"),
      },
      {
        selector: "#ref-btn-ia",
        title: "Mejorar con IA",
        body: "Mejorá la redacción de los campos de texto. Siempre podés deshacer los cambios.",
        placement: "top",
        when: () => visible("#ref-btn-ia"),
      },
      {
        selector: "#ref-bejerman-post, #ref-onvio-panel, #ref-chile-post",
        title: "Comprobaciones y adjuntos",
        body: "Marcá qué revisaste y adjuntá capturas o bases según el flujo de tu sistema.",
        placement: "top",
        when: () => visible("#ref-bejerman-post") || visible("#ref-onvio-panel") || visible("#ref-chile-post"),
      },
      {
        selector: "#ref-btn-ver-planilla, #ref-btn-copiar",
        title: "Generar planilla",
        body: "Vista previa o copiar al portapapeles. El texto queda listo para el ticket.",
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
        title: "Productos LEGAL",
        body: "Elegí HighQ, Legal One, Westlaw o CoCounsel según el escalamiento.",
        placement: "bottom",
      },
      {
        selector: "#ref-legal-templates-root",
        title: "Plantillas",
        body: "Cada producto tiene plantillas N2/N3 con los campos que pide soporte.",
        placement: "top",
        when: () => visible("#ref-legal-templates"),
      },
      {
        center: true,
        title: "Evidencias por OneDrive",
        body: "En los formularios LEGAL pegás links de OneDrive en lugar de subir archivos pesados.",
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
        title: "Formulario de escalamiento",
        body: "Completá por secciones: datos del entorno, descripción, resultados y evidencias.",
        placement: "top",
      },
      {
        selector: "#ref-legal-btn-ia",
        title: "Mejorar redacción con IA",
        body: "Mejorá pasos y resultados. El botón ↩ deshace si no te convence.",
        placement: "top",
        when: () => visible("#ref-legal-btn-ia"),
      },
      {
        selector: "#ref-legal-btn-ver-planilla",
        title: "Vista previa y copiar",
        body: "Generá el TXT unificado y copialo al ticket de escalamiento.",
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
        selector: "#planillas-oportunidad-menu",
        title: "Oportunidad de Venta",
        body: "Desde acá cargás nuevas oportunidades o revisás las que ya registraste.",
        placement: "bottom",
      },
      {
        selector: '[data-op-view="cargar"]',
        title: "Cargar oportunidad",
        body: "Formulario para registrar un contacto o lead nuevo.",
        placement: "top",
        when: () => visible('[data-op-view="cargar"]'),
      },
      {
        selector: '[data-op-view="gestor"]',
        title: "Gestor",
        body: "Listado de oportunidades cargadas: confirmá, editá o exportá según necesites.",
        placement: "top",
        when: () => visible('[data-op-view="gestor"]'),
      },
    ],
  };
}

export function resolveTour(tourId, ctx = {}) {
  if (tourId === "welcome") return buildWelcomeTour(ctx);

  if (tourId.startsWith("planillas-menu:")) {
    return buildPlanillasMenuTour(ctx, tourId.split(":")[1] || ctx.getSistema?.());
  }

  if (tourId.startsWith("transferencia:")) {
    return buildTransferenciaTour(ctx, tourId.split(":")[1] || ctx.getSistema?.());
  }

  if (tourId.startsWith("referral:")) {
    return buildReferralStandardTour(ctx, tourId.split(":")[1] || ctx.getSistema?.());
  }

  if (tourId === "referral-legal-hub") return buildReferralLegalHubTour();
  if (tourId === "referral-legal-form") return buildReferralLegalFormTour();
  if (tourId === "oportunidad-menu") return buildOportunidadMenuTour();

  return null;
}

export function tourIdForReferralView(ctx) {
  const sistema = ctx.getSistema?.();
  if (sistema === "Legal") {
    if (visible("#ref-legal-form") && !document.getElementById("ref-legal-form")?.classList.contains("hidden")) {
      return "referral-legal-form";
    }
    return "referral-legal-hub";
  }
  return `referral:${sistema}`;
}
