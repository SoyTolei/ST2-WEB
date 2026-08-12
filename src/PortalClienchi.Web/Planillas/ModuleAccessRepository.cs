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

        WriteModule(conn, email, PlanModuleIds.Oportunidad, oportunidad, false);
        WriteModule(conn, email, PlanModuleIds.PdfPortal, pdfPortal, false);
        WriteModule(conn, email, PlanModuleIds.Blanqueo, blanqueo, blanqueoConfirm);

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
        }

        return flags;
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
                if (string.Equals(existing, "1", StringComparison.Ordinal))
                    return;
            }

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
                WriteModule(conn, email, PlanModuleIds.Blanqueo, true, confirm);
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
