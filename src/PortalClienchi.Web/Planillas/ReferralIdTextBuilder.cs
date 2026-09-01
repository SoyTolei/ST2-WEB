namespace PortalClienchi.Web.Planillas;

public static class ReferralIdTextBuilder
{
    public static string Build(ReferralIdCase c)
    {
        if (c.Sistema == PlanillasSistema.Chile)
            return BuildChile(c);

        var partes = new List<string>();

        partes.Add("==========================================");
        partes.Add("DATOS DEL SISTEMA 🖥️");
        partes.Add($"SISTEMA: {c.Sistema.ToDisplayName()}");

        if (c.Sistema == PlanillasSistema.BejermanSql)
        {
            partes.Add($"VERSIÓN: {c.Version.Trim()}");
            partes.Add($"MÓDULO: {c.Modulo}");
            if (c.Collation != ReferralIdConstants.PlaceholderCollation && !string.IsNullOrWhiteSpace(c.Collation))
                partes.Add($"COLLATION SQL: {c.Collation}");
            if (c.SqlServer != ReferralIdConstants.PlaceholderSqlServer && !string.IsNullOrWhiteSpace(c.SqlServer))
                partes.Add($"SQL SERVER: {c.SqlServer}");
        }
        else if (c.Sistema == PlanillasSistema.Legal)
        {
            partes.Add($"PRODUCTO: {c.Legal.Produto}");
            partes.Add($"MÓDULO: {c.Legal.Modulo}");
            partes.Add($"AMBIENTE: {c.Legal.Ambiente}");
            if (!string.IsNullOrWhiteSpace(c.Legal.ChaveRegistro))
                partes.Add($"CLAVE DE REGISTRO: {c.Legal.ChaveRegistro.Trim()}");
        }

        partes.Add("");
        partes.Add("==========================================");
        partes.Add("DETALLES DEL CASO 📝");
        partes.Add($"ASUNTO Y/O ERROR: {c.Asunto.Trim()}");

        if (IsRealText(c.Descripcion, ReferralIdConstants.PlaceholderDescripcion))
            partes.Add($"DESCRIPCIÓN DEL CASO: {c.Descripcion.Trim()}");

        if (IsRealText(c.PasoAPaso, ReferralIdConstants.PlaceholderPasoAPaso))
        {
            partes.Add("");
            partes.Add($"PASO A PASO REALIZADO: {c.PasoAPaso.Trim()}");
        }

        if (c.Sistema == PlanillasSistema.OnvioWeb)
            AppendOnvioComprobaciones(partes, c);
        else if (c.Sistema == PlanillasSistema.BejermanSql)
            AppendBejermanComprobaciones(partes, c);
        else if (c.Sistema == PlanillasSistema.Legal)
            AppendLegalComprobaciones(partes, c);

        partes.Add("");
        partes.Add("==========================================");
        partes.Add("ADJUNTOS 🗃️");
        AppendAdjuntos(partes, c);
        partes.Add("==========================================");

        return string.Join(Environment.NewLine, partes);
    }

    private static string BuildChile(ReferralIdCase c)
    {
        var partes = new List<string>();
        var ch = c.Chile;

        partes.Add("==========================================");
        partes.Add("DATOS DEL CLIENTE 🪪");
        AppendChileDatosSistema(partes, ch);

        partes.Add("==========================================");
        partes.Add("DETALLES DEL CASO 📝");
        partes.Add("");
        partes.Add($"ASUNTO Y/O ERROR: {c.Asunto.Trim()}");

        if (IsRealText(c.Descripcion, ReferralIdConstants.PlaceholderDescripcion))
            partes.Add($"DESCRIPCIÓN DEL CASO: {c.Descripcion.Trim()}");

        if (IsRealText(c.PasoAPaso, ReferralIdConstants.PlaceholderPasoAPaso))
        {
            partes.Add("");
            partes.Add($"PASO A PASO REALIZADO: {c.PasoAPaso.Trim()}");
        }

        partes.Add("");
        partes.Add("==========================================");
        partes.Add("INFORMACIÓN ADICIONAL");
        partes.Add("");
        partes.Add($"- Usuario: {ch.Usuario.Trim()}");
        partes.Add($"- Clave: {ch.Clave.Trim()}");
        partes.Add($"- Sistema operativo: {ch.SistemaOperativo.Trim()}");
        if (!string.IsNullOrWhiteSpace(ch.VersionMotorSql))
            partes.Add($"- Versión motor SQL: {ch.VersionMotorSql.Trim()}");

        var hayCapturas = ch.AdjuntaPantallas || c.CapturasEnlaces.Count > 0;
        CapturasTextoHelper.AppendBloqueCapturas(partes, hayCapturas, c.CapturasEnlaces);

        partes.Add("==========================================");
        return string.Join(Environment.NewLine, partes);
    }

    private static void AppendChileDatosSistema(List<string> partes, ChileReferralState ch)
    {
        partes.Add($"PRODUCTO: {ChileConstants.ReferralProductoLabel(ch.Producto)}");

        if (string.Equals(ch.Producto, "HYPERRENTA", StringComparison.OrdinalIgnoreCase))
        {
            partes.Add($"VERSIÓN: {ChileConstants.HyperrentaVersionExportLabel(ch.HyperrentaVersion)}");
            partes.Add($"MÓDULOS: {string.Join(", ", ch.HyperrentaModulos)}");
        }
        else
        {
            partes.Add($"VERSIÓN: {ch.Version.Trim()}");
            partes.Add($"TIPO DE BASE: {ch.TipoBase.Trim()}");
            partes.Add($"BASE ADJUNTA: {(ch.BaseAdjunta == true ? "SÍ" : "NO")}");
        }

        partes.Add($"AÑO: {ch.Anio.Trim()}");
        partes.Add($"RUT CON INCONVENIENTES: {ch.Rut.Trim()}");
    }

    private static void AppendChileDetalles(List<string> partes, ReferralIdCase c)
    {
        var ch = c.Chile;

        partes.Add("");
        partes.Add("==========================================");
        partes.Add("INGRESO A SISTEMA 🔐");
        partes.Add($"- Usuario: {ch.Usuario.Trim()}");
        partes.Add($"- Clave: {ch.Clave.Trim()}");

        partes.Add("");
        partes.Add("==========================================");
        partes.Add("ENTORNO 🖥️");
        partes.Add($"- Sistema operativo: {ch.SistemaOperativo.Trim()}");
        if (!string.IsNullOrWhiteSpace(ch.VersionMotorSql))
            partes.Add($"- Versión motor SQL: {ch.VersionMotorSql.Trim()}");

        partes.Add($"- Se adjuntan {CapturasTextoHelper.BuildSiNoLabel(c.CapturasEnlaces, ch.AdjuntaPantallas)}: {(ch.AdjuntaPantallas ? "SÍ" : "NO")}");
    }

    private static void AppendOnvioComprobaciones(List<string> partes, ReferralIdCase c)
    {
        var o = c.Onvio;
        partes.Add("");
        partes.Add("==========================================");
        partes.Add("COMPROBACIONES Y PROCESOS REALIZADOS ✅");
        partes.Add($"- El proceso funcionaba correctamente: {(o.ProcesoFuncionaba ? "SÍ" : "NO")}");
        partes.Add($"- El cliente lo reproduce sistemáticamente: {(o.ReproduceSistematicamente ? "SÍ" : "NO")}");
        partes.Add($"- Hay ticket de servicio: {(o.HayTicket ? "SÍ" : "NO")}");

        if (o.HayTicket)
        {
            partes.Add(string.IsNullOrWhiteSpace(o.NumeroTicket)
                ? "  * N° de Ticket: NO"
                : $"  * N° de Ticket: {o.NumeroTicket.Trim()}");
            if (!string.IsNullOrWhiteSpace(o.Tecnico))
                partes.Add($"  * Técnico que lo tomó: {o.Tecnico.Trim()}");
            partes.Add($"  * Se pudo reproducir con el ticket de servicio: {(o.ReproduceConTicket ? "SÍ" : "NO")}");
            partes.Add($"  * Se pudo reproducir con empresa de prueba: {(o.ReproduceEmpresaPrueba ? "SÍ" : "NO")}");
        }

        partes.Add($"- Se adjuntan {CapturasTextoHelper.BuildSiNoLabel(c.CapturasEnlaces, o.AdjuntaPantallas)}: {(o.AdjuntaPantallas ? "SÍ" : "NO")}");

        if (!string.IsNullOrWhiteSpace(o.UsuarioContador) || !string.IsNullOrWhiteSpace(o.Empresa) || !string.IsNullOrWhiteSpace(o.EjercicioNumero))
        {
            partes.Add("");
            partes.Add("INFORMACIÓN DEL USUARIO:");
            if (!string.IsNullOrWhiteSpace(o.UsuarioContador))
                partes.Add($"- Usuario/Contador: {o.UsuarioContador.Trim()}");
            if (!string.IsNullOrWhiteSpace(o.Empresa))
                partes.Add($"- Empresa: {o.Empresa.Trim()}");
            if (!string.IsNullOrWhiteSpace(o.EjercicioNumero))
                partes.Add($"- Ejercicio N°: {o.EjercicioNumero.Trim()}");
        }
    }

    private static void AppendLegalComprobaciones(List<string> partes, ReferralIdCase c)
    {
        var l = c.Legal;
        partes.Add("");
        partes.Add("==========================================");
        partes.Add("COMPROBACIONES Y PROCESOS REALIZADOS ✅");
        partes.Add($"- El proceso funcionaba correctamente: {(l.ProcesoFuncionaba ? "SÍ" : "NO")}");
        partes.Add($"- El cliente lo reproduce sistemáticamente: {(l.ReproduceSistematicamente ? "SÍ" : "NO")}");
        partes.Add($"- Hay ticket de servicio: {(l.HayTicket ? "SÍ" : "NO")}");

        if (l.HayTicket)
        {
            partes.Add(string.IsNullOrWhiteSpace(l.NumeroTicket)
                ? "  * N° de Ticket: NO"
                : $"  * N° de Ticket: {l.NumeroTicket.Trim()}");
            if (!string.IsNullOrWhiteSpace(l.Tecnico))
                partes.Add($"  * Técnico que lo tomó: {l.Tecnico.Trim()}");
            partes.Add($"  * Se pudo reproducir con el ticket de servicio: {(l.ReproduceConTicket ? "SÍ" : "NO")}");
            partes.Add($"  * Se pudo reproducir en ambiente de homologación: {(l.ReproduceHomologacao ? "SÍ" : "NO")}");
            partes.Add($"  * Se pudo reproducir con otro usuario OnePass: {(l.ReproduceOutroUsuario ? "SÍ" : "NO")}");
        }

        partes.Add($"- Se adjuntan {CapturasTextoHelper.BuildSiNoLabel(c.CapturasEnlaces, l.AdjuntaPantallas)}: {(l.AdjuntaPantallas ? "SÍ" : "NO")}");
        partes.Add($"- Se adjunta planilla de importación: {(l.AdjuntaPlanilhaImport ? "SÍ" : "NO")}");
        partes.Add($"- Se adjunta log de integración: {(l.AdjuntaLogIntegracao ? "SÍ" : "NO")}");

        if (!string.IsNullOrWhiteSpace(l.UsuarioOnePass) || !string.IsNullOrWhiteSpace(l.Escritorio))
        {
            partes.Add("");
            partes.Add("INFORMACIÓN DEL USUARIO:");
            if (!string.IsNullOrWhiteSpace(l.UsuarioOnePass))
                partes.Add($"- Usuario OnePass: {l.UsuarioOnePass.Trim()}");
            if (!string.IsNullOrWhiteSpace(l.Escritorio))
                partes.Add($"- Estudio / Empresa: {l.Escritorio.Trim()}");
        }
    }

    private static void AppendBejermanComprobaciones(List<string> partes, ReferralIdCase c)
    {
        partes.Add("");
        partes.Add("==========================================");
        partes.Add("COMPROBACIONES Y PROCESOS REALIZADOS ✅");

        if (c.MamConfigured)
        {
            partes.Add("");
            partes.Add("────────────────────────");
            partes.Add("- MAM:");
            AppendMam(partes, c.Mam);
        }

        if (c.SdkConfigured)
        {
            partes.Add("");
            partes.Add("────────────────────────");
            partes.Add("- SDK:");
            AppendSdk(partes, c.Sdk);
        }

        if (c.PlanillaConfigured)
        {
            partes.Add("");
            partes.Add("────────────────────────");
            partes.Add("- Planilla Técnica 🔧:");
            var p = c.Planilla;
            partes.Add($"  * El proceso funcionaba correctamente: {(p.ProcesoFuncionaba ? "SÍ" : "NO")}");
            partes.Add($"  * Se pudo reproducir el error: {(p.ReproduceError ? "SÍ" : "NO")}");
            partes.Add($"  * Última actualización aplicada correctamente: {(p.UltimaActualizOk ? "SÍ" : "NO")}");
            partes.Add($"  * ¿Se relevó planilla técnica?: {(p.Relevada ? "SÍ" : "NO")}");
            partes.Add($"  * Se actualizaron vínculos: {(p.OptVinculos ? "SÍ" : "NO")}");
            partes.Add($"  * Se pudo reproducir en la base MODELO: {(p.OptBaseModelo ? "SÍ" : "NO")}");
            partes.Add($"  * Solo ocurre en la base del cliente: {(p.OptSoloCliente ? "SÍ" : "NO")}");
            partes.Add($"  * El cliente lo reproduce sistemáticamente: {(p.OptReproduceSistematicamente ? "SÍ" : "NO")}");
        }
    }

    private static void AppendMam(List<string> partes, MamState mam)
    {
        if (mam.Selections["No utiliza MAM"])
        {
            partes.Add("  * No utiliza MAM");
            return;
        }

        foreach (var (opcion, sel) in mam.Selections)
        {
            if (opcion == "No utiliza MAM")
                continue;

            if (opcion == "Nombre de la PERS/ACTU a medida.")
            {
                if (sel)
                {
                    var txt = mam.PersActuNombre.Trim();
                    partes.Add(string.IsNullOrEmpty(txt)
                        ? "  * Nombre de la PERS/ACTU a medida. (sin nombre indicado)"
                        : $"  * {opcion} {txt}");
                }
                else
                    partes.Add($"  * {opcion}: NO");
            }
            else if (opcion == "Tiene triggers")
            {
                if (sel)
                {
                    var tr = mam.TriggersDesactivados.Trim();
                    partes.Add(string.IsNullOrEmpty(tr)
                        ? "  * Tiene triggers: SÍ"
                        : $"  * Tiene triggers: SÍ - Triggers desactivados: {tr}");
                }
                else
                    partes.Add("  * Tiene triggers: NO");
            }
            else
                partes.Add($"  * {opcion}: {(sel ? "SÍ" : "NO")}");
        }
    }

    private static void AppendSdk(List<string> partes, SdkState sdk)
    {
        if (sdk.Selections["No utiliza SDK"])
        {
            partes.Add("  * No utiliza SDK");
            return;
        }

        foreach (var (opcion, sel) in sdk.Selections)
        {
            if (opcion != "No utiliza SDK")
                partes.Add($"  * {opcion}: {(sel ? "SÍ" : "NO")}");
        }

        if (!string.IsNullOrWhiteSpace(sdk.AplicacionIntegracion))
            partes.Add($"  * Aplicación de integración: {sdk.AplicacionIntegracion.Trim()}");
    }

    private static void AppendAdjuntos(List<string> partes, ReferralIdCase c)
    {
        var hay = false;
        if (c.Sistema == PlanillasSistema.BejermanSql)
        {
            var a = c.Adjuntos;
            hay = a.Pantallas || a.TrazaSql || a.BackupBases;
            var enComentarios = new List<string>();
            var pantallasConLinks = a.Pantallas && c.CapturasEnlaces.Count > 0;

            if (a.Pantallas)
            {
                partes.Add(CapturasTextoHelper.BuildSeccionTitulo(c.CapturasEnlaces));
                if (pantallasConLinks)
                    CapturasTextoHelper.AppendEnlacesCapturas(partes, c.CapturasEnlaces, indentar: false);
                else
                    enComentarios.Add(CapturasTextoHelper.BuildComentariosItemLabel(c.CapturasEnlaces));
            }

            if (a.TrazaSql)
            {
                partes.Add("- Traza SQL");
                if (c.TrazaEnlaces.Count > 0)
                    AppendEnlacesTraza(partes, c.TrazaEnlaces);
                else
                    enComentarios.Add("Traza");
            }

            if (a.BackupBases)
            {
                partes.Add("- Backup Bases");
                if (a.BackupManager) partes.Add("  * Manager");
                if (a.BackupSbda) partes.Add("  * SBDA");
                if (a.BackupCg) partes.Add("  * CG");
                if (a.BackupSj) partes.Add("  * SJ");

                if (!string.IsNullOrWhiteSpace(a.BackupOnedriveUrl))
                {
                    partes.Add("Se adjunta el backup en el siguiente link (OneDrive):");
                    partes.Add(a.BackupOnedriveUrl.Trim());
                }
                else
                {
                    enComentarios.Add("Bases");
                }
            }

            if (enComentarios.Count > 0)
                partes.Add(BuildAdjuntosEnComentarios(enComentarios));
        }
        else if (c.Sistema == PlanillasSistema.OnvioWeb)
        {
            hay = c.Onvio.AdjuntaPantallas;
            if (c.Onvio.AdjuntaPantallas)
            {
                partes.Add(CapturasTextoHelper.BuildSeccionTitulo(c.CapturasEnlaces));
                if (c.CapturasEnlaces.Count > 0)
                    CapturasTextoHelper.AppendEnlacesCapturas(partes, c.CapturasEnlaces, indentar: false);
                else
                    partes.Add(BuildAdjuntosEnComentarios([CapturasTextoHelper.BuildComentariosItemLabel(c.CapturasEnlaces)]));
            }
        }
        else if (c.Sistema == PlanillasSistema.Legal)
        {
            var l = c.Legal;
            hay = l.AdjuntaPantallas || l.AdjuntaPlanilhaImport || l.AdjuntaLogIntegracao;
            if (l.AdjuntaPantallas)
            {
                partes.Add(CapturasTextoHelper.BuildSeccionTitulo(c.CapturasEnlaces));
                CapturasTextoHelper.AppendEnlacesCapturas(partes, c.CapturasEnlaces, indentar: false);
            }
            if (l.AdjuntaPlanilhaImport)
                partes.Add("- Planilla de importación (Excel)");
            if (l.AdjuntaLogIntegracao)
                partes.Add("- Log de integración");
        }
        else if (c.Sistema == PlanillasSistema.Chile)
        {
            hay = c.Chile.AdjuntaPantallas;
            if (c.Chile.AdjuntaPantallas)
            {
                partes.Add(CapturasTextoHelper.BuildSeccionTitulo(c.CapturasEnlaces));
                if (c.CapturasEnlaces.Count > 0)
                    CapturasTextoHelper.AppendEnlacesCapturas(partes, c.CapturasEnlaces, indentar: false);
                else
                    partes.Add(BuildAdjuntosEnComentarios([CapturasTextoHelper.BuildComentariosItemLabel(c.CapturasEnlaces)]));
            }
        }

        if (!hay)
            partes.Add("- No se adjuntan capturas / video / PDF / TXT / Excel / XML");
    }

    /// <summary>
    /// Une en una sola línea lo que va por comentarios: Imágenes, Traza y/o Bases.
    /// </summary>
    private static string BuildAdjuntosEnComentarios(IReadOnlyList<string> items)
    {
        if (items.Count == 1)
            return $"Se adjuntan {items[0]} en comentarios.";
        if (items.Count == 2)
            return $"Se adjuntan {items[0]} y {items[1]} en comentarios.";

        return $"Se adjuntan {string.Join(", ", items.Take(items.Count - 1))} y {items[^1]} en comentarios.";
    }

    private static void AppendEnlacesTraza(List<string> partes, IReadOnlyList<TransferenciaCapturaEnlace> enlaces)
    {
        partes.Add(enlaces.Count == 1
            ? "Se adjunta la traza en el siguiente link (descarga):"
            : "Se adjuntan las trazas en los siguientes links (descarga):");
        foreach (var enlace in enlaces)
            partes.Add(enlace.Url);
    }

    private static bool IsRealText(string? text, string placeholder) =>
        !string.IsNullOrWhiteSpace(text) &&
        !string.Equals(text.Trim(), placeholder, StringComparison.Ordinal);
}
