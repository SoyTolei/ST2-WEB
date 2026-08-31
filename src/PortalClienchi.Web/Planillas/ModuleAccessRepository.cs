using System.Globalization;
using Microsoft.Data.Sqlite;

namespace PortalClienchi.Web.Planillas;

public sealed class ModuleAccessRepository
{
    private readonly string _dbPath;
    private readonly ILogger<ModuleAccessRepository> _logger;
    private readonly object _gate = new();

    public ModuleAccessRepository(ILogger<ModuleAccessRepository> logger)
    {
        _logger = logger;
        var st2Dir = St2Paths.GetDataDirectory();
        Directory.CreateDirectory(st2Dir);
        // Misma DB que accesos: un solo volume en Railway.
        _dbPath = Path.Combine(st2Dir, "app_access.db");
        EnsureWritable(st2Dir);
        try
        {
            EnsureSchema();
            SeedDefaults();
        }
        catch (Exception ex)
        {
            StorageReady = false;
            _logger.LogError(ex, "No se pudo inicializar permisos de módulos en {DbPath}", _dbPath);
        }

        _logger.LogInformation("Permisos de módulos en {DbPath}", _dbPath);
    }

    public bool StorageReady { get; private set; }

    public ModuleAccessFlagsDto GetFlags(string? email)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return new ModuleAccessFlagsDto();

        if (St2SuperAdmin.Is(normalized))
            return St2SuperAdmin.FullFlags();

        using var conn = Open();
        return ReadFlags(conn, normalized);
    }

    public IReadOnlyDictionary<string, ModuleAccessFlagsDto> GetFlagsForEmails(IEnumerable<string> emails)
    {
        var map = new Dictionary<string, ModuleAccessFlagsDto>(StringComparer.OrdinalIgnoreCase);
        var list = emails
            .Select(PlanUserIdentity.ValidateAndNormalize)
            .Where(e => e is not null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (list.Count == 0)
            return map;

        using var conn = Open();
        foreach (var email in list)
            map[email] = St2SuperAdmin.Is(email) ? St2SuperAdmin.FullFlags() : ReadFlags(conn, email);
        return map;
    }

    public ModuleAccessFlagsDto Upsert(ModuleAccessUpdateRequest req)
    {
        var email = PlanUserIdentity.ValidateAndNormalize(req.Email)
            ?? throw new ArgumentException("Correo inválido.");

        using var conn = Open();
        var current = ReadFlags(conn, email);

        var oportunidad = req.Oportunidad ?? current.Oportunidad;
        var pdfPortal = req.PdfPortal ?? current.PdfPortal;
        var blanqueo = req.Blanqueo ?? current.Blanqueo;
        var blanqueoConfirm = req.BlanqueoConfirm ?? current.BlanqueoConfirm;
        if (blanqueoConfirm)
            blanqueo = true;

        // Confirmadores: por defecto solo listado. Quien solo carga: formulario sí.
        bool blanqueoLoad;
        if (req.BlanqueoLoad is not null)
            blanqueoLoad = req.BlanqueoLoad.Value;
        else if (!blanqueo)
            blanqueoLoad = false;
        else if (blanqueoConfirm && req.BlanqueoConfirm == true)
            blanqueoLoad = false;
        else
            blanqueoLoad = current.BlanqueoLoad || !blanqueoConfirm;

        if (blanqueoLoad)
            blanqueo = true;

        var borradoBases = req.BorradoBases ?? current.BorradoBases;
        var borradoBasesConfirm = req.BorradoBasesConfirm ?? current.BorradoBasesConfirm;
        if (borradoBasesConfirm)
            borradoBases = true;

        bool borradoBasesLoad;
        if (req.BorradoBasesLoad is not null)
            borradoBasesLoad = req.BorradoBasesLoad.Value;
        else if (!borradoBases)
            borradoBasesLoad = false;
        else if (borradoBasesConfirm && req.BorradoBasesConfirm == true)
            borradoBasesLoad = false;
        else
            borradoBasesLoad = current.BorradoBasesLoad || !borradoBasesConfirm;

        if (borradoBasesLoad)
            borradoBases = true;

        var planillasSqlOnvio = req.PlanillasSqlOnvio ?? current.PlanillasSqlOnvio;
        var planillasTransferencia = req.PlanillasTransferencia ?? current.PlanillasTransferencia;
        var planillasReferral = req.PlanillasReferral ?? current.PlanillasReferral;
        var planillasLegal = req.PlanillasLegal ?? current.PlanillasLegal;
        var legalFirm = req.LegalFirm ?? current.LegalFirm;
        var legalHighq = req.LegalHighq ?? current.LegalHighq;
        var legalWestlaw = req.LegalWestlaw ?? current.LegalWestlaw;
        var legalCocounsel = req.LegalCocounsel ?? current.LegalCocounsel;
        var planillasChile = req.PlanillasChile ?? current.PlanillasChile;
        var chileTransferencia = req.ChileTransferencia ?? current.ChileTransferencia;
        var chileReferral = req.ChileReferral ?? current.ChileReferral;
        var chileSaad = req.ChileSaad ?? current.ChileSaad;
        var chileHr = req.ChileHr ?? current.ChileHr;
        var chileWiki = req.ChileWiki ?? current.ChileWiki;
        var chileLp = req.ChileLp ?? current.ChileLp;
        var chilePowerapps = req.ChilePowerapps ?? current.ChilePowerapps;
        var bejermanWeb = req.BejermanWeb ?? current.BejermanWeb;

        WriteModule(conn, email, PlanModuleIds.Oportunidad, oportunidad, false);
        WriteModule(conn, email, PlanModuleIds.PdfPortal, pdfPortal, false);
        WriteModule(conn, email, PlanModuleIds.Blanqueo, blanqueo, blanqueoConfirm);
        WriteModule(conn, email, PlanModuleIds.BlanqueoLoad, blanqueoLoad, false);
        WriteModule(conn, email, PlanModuleIds.BorradoBases, borradoBases, borradoBasesConfirm);
        WriteModule(conn, email, PlanModuleIds.BorradoBasesLoad, borradoBasesLoad, false);
        WriteModule(conn, email, PlanModuleIds.PlanillasSqlOnvio, planillasSqlOnvio, false);
        WriteModule(conn, email, PlanModuleIds.PlanillasTransferencia, planillasTransferencia, false);
        WriteModule(conn, email, PlanModuleIds.PlanillasReferral, planillasReferral, false);
        WriteModule(conn, email, PlanModuleIds.PlanillasLegal, planillasLegal, false);
        WriteModule(conn, email, PlanModuleIds.LegalFirm, legalFirm, false);
        WriteModule(conn, email, PlanModuleIds.LegalHighq, legalHighq, false);
        WriteModule(conn, email, PlanModuleIds.LegalWestlaw, legalWestlaw, false);
        WriteModule(conn, email, PlanModuleIds.LegalCocounsel, legalCocounsel, false);
        WriteModule(conn, email, PlanModuleIds.PlanillasChile, planillasChile, false);
        WriteModule(conn, email, PlanModuleIds.ChileTransferencia, chileTransferencia, false);
        WriteModule(conn, email, PlanModuleIds.ChileReferral, chileReferral, false);
        WriteModule(conn, email, PlanModuleIds.ChileSaad, chileSaad, false);
        WriteModule(conn, email, PlanModuleIds.ChileHr, chileHr, false);
        WriteModule(conn, email, PlanModuleIds.ChileWiki, chileWiki, false);
        WriteModule(conn, email, PlanModuleIds.ChileLp, chileLp, false);
        WriteModule(conn, email, PlanModuleIds.ChilePowerapps, chilePowerapps, false);
        WriteModule(conn, email, PlanModuleIds.BejermanWeb, bejermanWeb, false);

        return ReadFlags(conn, email);
    }

    public void DeleteByEmail(string email)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return;

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM module_access WHERE lower(email) = lower($email)";
        cmd.Parameters.AddWithValue("$email", normalized);
        cmd.ExecuteNonQuery();
    }

    private ModuleAccessFlagsDto ReadFlags(SqliteConnection conn, string email)
    {
        var flags = new ModuleAccessFlagsDto();
        var loadExplicit = false;
        var borradoLoadExplicit = false;
        bool? legacyLegalEscalamiento = null;
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT module, can_view, can_confirm
            FROM module_access
            WHERE lower(email) = lower($email)
            """;
        cmd.Parameters.AddWithValue("$email", email);
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            var module = r.GetString(0);
            var view = r.GetInt32(1) != 0;
            var confirm = r.GetInt32(2) != 0;
            if (module.Equals(PlanModuleIds.Oportunidad, StringComparison.OrdinalIgnoreCase))
                flags.Oportunidad = view;
            else if (module.Equals(PlanModuleIds.PdfPortal, StringComparison.OrdinalIgnoreCase))
                flags.PdfPortal = view;
            else if (module.Equals(PlanModuleIds.Blanqueo, StringComparison.OrdinalIgnoreCase))
            {
                flags.Blanqueo = view || confirm;
                flags.BlanqueoConfirm = confirm;
            }
            else if (module.Equals(PlanModuleIds.BlanqueoLoad, StringComparison.OrdinalIgnoreCase))
            {
                loadExplicit = true;
                flags.BlanqueoLoad = view;
            }
            else if (module.Equals(PlanModuleIds.BorradoBases, StringComparison.OrdinalIgnoreCase))
            {
                flags.BorradoBases = view || confirm;
                flags.BorradoBasesConfirm = confirm;
            }
            else if (module.Equals(PlanModuleIds.BorradoBasesLoad, StringComparison.OrdinalIgnoreCase))
            {
                borradoLoadExplicit = true;
                flags.BorradoBasesLoad = view;
            }
            else if (module.Equals(PlanModuleIds.PlanillasSqlOnvio, StringComparison.OrdinalIgnoreCase))
                flags.PlanillasSqlOnvio = view;
            else if (module.Equals(PlanModuleIds.PlanillasTransferencia, StringComparison.OrdinalIgnoreCase))
                flags.PlanillasTransferencia = view;
            else if (module.Equals(PlanModuleIds.PlanillasReferral, StringComparison.OrdinalIgnoreCase))
                flags.PlanillasReferral = view;
            else if (module.Equals(PlanModuleIds.PlanillasLegal, StringComparison.OrdinalIgnoreCase))
                flags.PlanillasLegal = view;
            else if (module.Equals("legal_escalamiento", StringComparison.OrdinalIgnoreCase))
                legacyLegalEscalamiento = view;
            else if (module.Equals(PlanModuleIds.LegalFirm, StringComparison.OrdinalIgnoreCase))
                flags.LegalFirm = view;
            else if (module.Equals(PlanModuleIds.LegalHighq, StringComparison.OrdinalIgnoreCase))
                flags.LegalHighq = view;
            else if (module.Equals(PlanModuleIds.LegalWestlaw, StringComparison.OrdinalIgnoreCase))
                flags.LegalWestlaw = view;
            else if (module.Equals(PlanModuleIds.LegalCocounsel, StringComparison.OrdinalIgnoreCase))
                flags.LegalCocounsel = view;
            else if (module.Equals(PlanModuleIds.PlanillasChile, StringComparison.OrdinalIgnoreCase))
                flags.PlanillasChile = view;
            else if (module.Equals(PlanModuleIds.ChileTransferencia, StringComparison.OrdinalIgnoreCase))
                flags.ChileTransferencia = view;
            else if (module.Equals(PlanModuleIds.ChileReferral, StringComparison.OrdinalIgnoreCase))
                flags.ChileReferral = view;
            else if (module.Equals(PlanModuleIds.ChileSaad, StringComparison.OrdinalIgnoreCase))
                flags.ChileSaad = view;
            else if (module.Equals(PlanModuleIds.ChileHr, StringComparison.OrdinalIgnoreCase))
                flags.ChileHr = view;
            else if (module.Equals(PlanModuleIds.ChileWiki, StringComparison.OrdinalIgnoreCase))
                flags.ChileWiki = view;
            else if (module.Equals(PlanModuleIds.ChileLp, StringComparison.OrdinalIgnoreCase))
                flags.ChileLp = view;
            else if (module.Equals(PlanModuleIds.ChilePowerapps, StringComparison.OrdinalIgnoreCase))
                flags.ChilePowerapps = view;
            else if (module.Equals(PlanModuleIds.BejermanWeb, StringComparison.OrdinalIgnoreCase))
                flags.BejermanWeb = view;
        }

        // Legacy: sin fila blanqueo_load → confirmador = solo listado; el resto puede cargar.
        if (flags.Blanqueo && !loadExplicit)
            flags.BlanqueoLoad = !flags.BlanqueoConfirm;

        if (flags.BlanqueoLoad)
            flags.Blanqueo = true;

        if (flags.BorradoBases && !borradoLoadExplicit)
            flags.BorradoBasesLoad = !flags.BorradoBasesConfirm;

        if (flags.BorradoBasesLoad)
            flags.BorradoBases = true;

        // Legacy: sin filas de sistemas Planillas → todos visibles.
        if (!HasModuleRow(conn, email, PlanModuleIds.PlanillasSqlOnvio))
            flags.PlanillasSqlOnvio = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.PlanillasTransferencia))
            flags.PlanillasTransferencia = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.PlanillasReferral))
            flags.PlanillasReferral = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.PlanillasLegal))
            flags.PlanillasLegal = true;

        var hasLegalProductRow = HasAnyLegalProductRow(conn, email);
        if (!hasLegalProductRow)
        {
            var legacy = legacyLegalEscalamiento ?? true;
            flags.LegalFirm = legacy;
            flags.LegalHighq = legacy;
            flags.LegalWestlaw = legacy;
            flags.LegalCocounsel = legacy;
        }
        else
        {
            if (!HasModuleRow(conn, email, PlanModuleIds.LegalFirm))
                flags.LegalFirm = true;
            if (!HasModuleRow(conn, email, PlanModuleIds.LegalHighq))
                flags.LegalHighq = true;
            if (!HasModuleRow(conn, email, PlanModuleIds.LegalWestlaw))
                flags.LegalWestlaw = true;
            if (!HasModuleRow(conn, email, PlanModuleIds.LegalCocounsel))
                flags.LegalCocounsel = true;
        }

        if (!HasModuleRow(conn, email, PlanModuleIds.PlanillasChile))
            flags.PlanillasChile = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChileTransferencia))
            flags.ChileTransferencia = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChileReferral))
            flags.ChileReferral = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChileSaad))
            flags.ChileSaad = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChileHr))
            flags.ChileHr = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChileWiki))
            flags.ChileWiki = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChileLp))
            flags.ChileLp = true;
        if (!HasModuleRow(conn, email, PlanModuleIds.ChilePowerapps))
            flags.ChilePowerapps = true;

        return flags;
    }

    private static bool HasAnyLegalProductRow(SqliteConnection conn, string email) =>
        HasModuleRow(conn, email, PlanModuleIds.LegalFirm)
        || HasModuleRow(conn, email, PlanModuleIds.LegalHighq)
        || HasModuleRow(conn, email, PlanModuleIds.LegalWestlaw)
        || HasModuleRow(conn, email, PlanModuleIds.LegalCocounsel);

    private static bool HasModuleRow(SqliteConnection conn, string email, string module)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT 1 FROM module_access
            WHERE lower(email) = lower($email) AND lower(module) = lower($module)
            LIMIT 1
            """;
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$module", module);
        return cmd.ExecuteScalar() is not null;
    }

    private static void WriteModule(SqliteConnection conn, string email, string module, bool canView, bool canConfirm)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO module_access (email, module, can_view, can_confirm)
            VALUES ($email, $module, $view, $confirm)
            ON CONFLICT(email, module) DO UPDATE SET
                can_view = excluded.can_view,
                can_confirm = excluded.can_confirm
            """;
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$module", module);
        cmd.Parameters.AddWithValue("$view", canView || canConfirm ? 1 : 0);
        cmd.Parameters.AddWithValue("$confirm", canConfirm ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    private void SeedDefaults()
    {
        lock (_gate)
        {
            using var conn = Open();
            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT value FROM module_access_meta WHERE key = 'seeded_v1'";
                var existing = check.ExecuteScalar() as string;
                if (!string.Equals(existing, "1", StringComparison.Ordinal))
                {
                    var registered = LoadRegisteredEmails(conn);

                    // Oportunidad: conservar comportamiento previo (todos los ya registrados).
                    foreach (var email in registered)
                        WriteModule(conn, email, PlanModuleIds.Oportunidad, true, false);

                    foreach (var email in new[]
                             {
                                 "franco.zanna@thomsonreuters.com",
                                 "leonel.gallo@thomsonreuters.com",
                             })
                    {
                        WriteModule(conn, email, PlanModuleIds.PdfPortal, true, false);
                    }

                    foreach (var email in new[]
                             {
                                 "leonel.gallo@thomsonreuters.com",
                                 "sabrinacecilia.rodriguezcuaglia@thomsonreuters.com",
                                 "alexis.ruiz@thomsonreuters.com",
                                 "yohanaelizabeth.orellana@thomsonreuters.com",
                             })
                    {
                        var confirm = email is "leonel.gallo@thomsonreuters.com"
                            or "alexis.ruiz@thomsonreuters.com"
                            or "yohanaelizabeth.orellana@thomsonreuters.com";
                        // Leonel carga + confirma; otros confirmadores solo listado; Sabrina solo carga.
                        var load = email is "leonel.gallo@thomsonreuters.com"
                            or "sabrinacecilia.rodriguezcuaglia@thomsonreuters.com";
                        WriteModule(conn, email, PlanModuleIds.Blanqueo, true, confirm);
                        WriteModule(conn, email, PlanModuleIds.BlanqueoLoad, load, false);
                    }

                    using var mark = conn.CreateCommand();
                    mark.CommandText = """
                        INSERT INTO module_access_meta (key, value) VALUES ('seeded_v1', '1')
                        ON CONFLICT(key) DO UPDATE SET value = excluded.value
                        """;
                    mark.ExecuteNonQuery();
                    _logger.LogInformation("Seed inicial de permisos de módulos aplicado");
                }
            }
        }

        EnsureBlanqueoLoadDefaults();
        EnsureBorradoBasesDefaults();
        EnsurePlanillasSistemaDefaults();
        EnsureLegalProductDefaults();
    }

    /// <summary>
    /// Migra confirmadores existentes a "solo listado" si aún no tienen fila blanqueo_load.
    /// </summary>
    private void EnsureBlanqueoLoadDefaults()
    {
        lock (_gate)
        {
            using var conn = Open();
            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT value FROM module_access_meta WHERE key = 'seeded_blanqueo_load_v1'";
                var existing = check.ExecuteScalar() as string;
                if (string.Equals(existing, "1", StringComparison.Ordinal))
                    return;
            }

            using var list = conn.CreateCommand();
            list.CommandText = """
                SELECT email, can_confirm FROM module_access
                WHERE lower(module) = lower($mod)
                """;
            list.Parameters.AddWithValue("$mod", PlanModuleIds.Blanqueo);
            var rows = new List<(string Email, bool Confirm)>();
            using (var r = list.ExecuteReader())
            {
                while (r.Read())
                    rows.Add((r.GetString(0), r.GetInt32(1) != 0));
            }

            foreach (var (email, confirm) in rows)
            {
                if (St2SuperAdmin.Is(email))
                {
                    WriteModule(conn, email, PlanModuleIds.BlanqueoLoad, true, false);
                    continue;
                }

                using var hasLoad = conn.CreateCommand();
                hasLoad.CommandText = """
                    SELECT 1 FROM module_access
                    WHERE lower(email) = lower($email) AND lower(module) = lower($mod)
                    LIMIT 1
                    """;
                hasLoad.Parameters.AddWithValue("$email", email);
                hasLoad.Parameters.AddWithValue("$mod", PlanModuleIds.BlanqueoLoad);
                var exists = hasLoad.ExecuteScalar() is not null;
                if (exists) continue;

                // Confirmador → solo listado; el resto → puede cargar.
                WriteModule(conn, email, PlanModuleIds.BlanqueoLoad, !confirm, false);
            }

            using var mark = conn.CreateCommand();
            mark.CommandText = """
                INSERT INTO module_access_meta (key, value) VALUES ('seeded_blanqueo_load_v1', '1')
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """;
            mark.ExecuteNonQuery();
            _logger.LogInformation("Defaults blanqueo_load aplicados (confirmadores = solo listado)");
        }
    }

    /// <summary>Seed inicial de Borrado de bases (mismo equipo que blanqueo).</summary>
    private void EnsureBorradoBasesDefaults()
    {
        lock (_gate)
        {
            using var conn = Open();
            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT value FROM module_access_meta WHERE key = 'seeded_borrado_bases_v1'";
                var existing = check.ExecuteScalar() as string;
                if (string.Equals(existing, "1", StringComparison.Ordinal))
                    return;
            }

            foreach (var email in new[]
                     {
                         "leonel.gallo@thomsonreuters.com",
                         "sabrinacecilia.rodriguezcuaglia@thomsonreuters.com",
                         "alexis.ruiz@thomsonreuters.com",
                         "yohanaelizabeth.orellana@thomsonreuters.com",
                     })
            {
                var confirm = email is "leonel.gallo@thomsonreuters.com"
                    or "alexis.ruiz@thomsonreuters.com"
                    or "yohanaelizabeth.orellana@thomsonreuters.com";
                var load = email is "leonel.gallo@thomsonreuters.com"
                    or "sabrinacecilia.rodriguezcuaglia@thomsonreuters.com";
                WriteModule(conn, email, PlanModuleIds.BorradoBases, true, confirm);
                WriteModule(conn, email, PlanModuleIds.BorradoBasesLoad, load, false);
            }

            using var mark = conn.CreateCommand();
            mark.CommandText = """
                INSERT INTO module_access_meta (key, value) VALUES ('seeded_borrado_bases_v1', '1')
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """;
            mark.ExecuteNonQuery();
            _logger.LogInformation("Seed inicial de Borrado de bases aplicado");
        }
    }

    /// <summary>Usuarios ya registrados ven todos los sistemas Planillas hasta que un admin restrinja.</summary>
    private void EnsurePlanillasSistemaDefaults()
    {
        lock (_gate)
        {
            using var conn = Open();
            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT value FROM module_access_meta WHERE key = 'seeded_planillas_sistemas_v1'";
                var existing = check.ExecuteScalar() as string;
                if (string.Equals(existing, "1", StringComparison.Ordinal))
                    return;
            }

            foreach (var email in LoadRegisteredEmails(conn))
            {
                WriteModule(conn, email, PlanModuleIds.PlanillasSqlOnvio, true, false);
                WriteModule(conn, email, PlanModuleIds.PlanillasLegal, true, false);
                WriteModule(conn, email, PlanModuleIds.PlanillasChile, true, false);
            }

            using var mark = conn.CreateCommand();
            mark.CommandText = """
                INSERT INTO module_access_meta (key, value) VALUES ('seeded_planillas_sistemas_v1', '1')
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """;
            mark.ExecuteNonQuery();
            _logger.LogInformation("Defaults de sistemas Planillas aplicados (SQL/ONVIO, LEGAL, Chile)");
        }
    }

    /// <summary>Migra legal_escalamiento legacy a productos individuales.</summary>
    private void EnsureLegalProductDefaults()
    {
        lock (_gate)
        {
            using var conn = Open();
            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT value FROM module_access_meta WHERE key = 'seeded_legal_products_v1'";
                var existing = check.ExecuteScalar() as string;
                if (string.Equals(existing, "1", StringComparison.Ordinal))
                    return;
            }

            using var list = conn.CreateCommand();
            list.CommandText = """
                SELECT email, can_view FROM module_access
                WHERE lower(module) = lower($mod)
                """;
            list.Parameters.AddWithValue("$mod", "legal_escalamiento");
            var rows = new List<(string Email, bool View)>();
            using (var r = list.ExecuteReader())
            {
                while (r.Read())
                    rows.Add((r.GetString(0), r.GetInt32(1) != 0));
            }

            foreach (var (email, view) in rows)
            {
                if (HasAnyLegalProductRow(conn, email)) continue;
                WriteModule(conn, email, PlanModuleIds.LegalFirm, view, false);
                WriteModule(conn, email, PlanModuleIds.LegalHighq, view, false);
                WriteModule(conn, email, PlanModuleIds.LegalWestlaw, view, false);
                WriteModule(conn, email, PlanModuleIds.LegalCocounsel, view, false);
            }

            using var mark = conn.CreateCommand();
            mark.CommandText = """
                INSERT INTO module_access_meta (key, value) VALUES ('seeded_legal_products_v1', '1')
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """;
            mark.ExecuteNonQuery();
            _logger.LogInformation("Migración de productos LEGAL aplicada (legal_escalamiento → por producto)");
        }
    }

    private static List<string> LoadRegisteredEmails(SqliteConnection conn)
    {
        var list = new List<string>();
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT email FROM app_access";
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                var normalized = PlanUserIdentity.ValidateAndNormalize(r.GetString(0));
                if (normalized is not null)
                    list.Add(normalized);
            }
        }
        catch (SqliteException)
        {
            // Tabla app_access todavía no existe en installs frescos.
        }

        return list;
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS module_access (
                email TEXT NOT NULL COLLATE NOCASE,
                module TEXT NOT NULL,
                can_view INTEGER NOT NULL DEFAULT 0,
                can_confirm INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (email, module)
            );
            CREATE TABLE IF NOT EXISTS module_access_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """;
        cmd.ExecuteNonQuery();
    }

    private void EnsureWritable(string dir)
    {
        try
        {
            var probe = Path.Combine(dir, ".write-test-modules");
            File.WriteAllText(probe, DateTime.UtcNow.ToString(CultureInfo.InvariantCulture));
            File.Delete(probe);
            StorageReady = true;
        }
        catch (Exception ex)
        {
            StorageReady = false;
            _logger.LogError(ex, "Sin permiso de escritura en {Dir}", dir);
        }
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        using var pragma = conn.CreateCommand();
        pragma.CommandText = "PRAGMA journal_mode=WAL;";
        pragma.ExecuteNonQuery();
        return conn;
    }
}
