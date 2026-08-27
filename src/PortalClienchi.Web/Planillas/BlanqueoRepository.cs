using System.Globalization;
using Microsoft.Data.Sqlite;

namespace PortalClienchi.Web.Planillas;

public sealed class BlanqueoRepository
{
    private readonly string _dbPath;
    private readonly ILogger<BlanqueoRepository> _logger;

    public BlanqueoRepository(ILogger<BlanqueoRepository> logger)
    {
        _logger = logger;
        var st2Dir = St2Paths.GetDataDirectory();
        Directory.CreateDirectory(st2Dir);
        _dbPath = Path.Combine(st2Dir, "blanqueo.db");
        EnsureWritable(st2Dir);
        EnsureSchema();
        _logger.LogInformation("Blanqueo SQLite en {DbPath}", _dbPath);
    }

    public string DatabasePath => _dbPath;
    public bool StorageReady { get; private set; }

    public IReadOnlyList<BlanqueoRecordDto> LoadAll()
    {
        var list = new List<BlanqueoRecordDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, portal, nro_caso, nro_cliente, correo, fecha_solicitud,
                   solicitado_por_email, solicitado_por_nombre, tipo_solicitud,
                   listo, aclaracion, fecha_creacion, modulos_detalle,
                   confirmado_por_nombre
            FROM blanqueo_solicitudes
            ORDER BY datetime(coalesce(fecha_creacion, fecha_solicitud)) DESC, id DESC
            """;
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(ReadRow(r));
        return list;
    }

    public BlanqueoRecordDto? GetById(int id)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, portal, nro_caso, nro_cliente, correo, fecha_solicitud,
                   solicitado_por_email, solicitado_por_nombre, tipo_solicitud,
                   listo, aclaracion, fecha_creacion, modulos_detalle,
                   confirmado_por_nombre
            FROM blanqueo_solicitudes WHERE id = $id
            """;
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? ReadRow(r) : null;
    }

    public BlanqueoRecordDto Insert(BlanqueoCreateRequest req, string email, string displayName, string fecha)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO blanqueo_solicitudes
                (portal, nro_caso, nro_cliente, correo, fecha_solicitud,
                 solicitado_por_email, solicitado_por_nombre, tipo_solicitud, listo, aclaracion, modulos_detalle)
            VALUES
                ($portal, $caso, $cliente, $correo, $fecha, $email, $nombre, $tipo, 0, NULL, $modulos)
            """;
        cmd.Parameters.AddWithValue("$portal", req.Portal.Trim());
        cmd.Parameters.AddWithValue("$caso", req.NroCaso.Trim());
        cmd.Parameters.AddWithValue("$cliente", req.NroCliente.Trim());
        cmd.Parameters.AddWithValue("$correo", req.Correo.Trim());
        cmd.Parameters.AddWithValue("$fecha", fecha);
        cmd.Parameters.AddWithValue("$email", email.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("$nombre", displayName.Trim());
        cmd.Parameters.AddWithValue("$tipo", req.TipoSolicitud.Trim());
        cmd.Parameters.AddWithValue("$modulos", (object?)req.ModulosDetalle ?? DBNull.Value);
        cmd.ExecuteNonQuery();

        var id = (int)LastInsertRowId(conn);
        return new BlanqueoRecordDto
        {
            Id = id,
            Portal = req.Portal.Trim(),
            NroCaso = req.NroCaso.Trim(),
            NroCliente = req.NroCliente.Trim(),
            Correo = req.Correo.Trim(),
            FechaSolicitud = fecha,
            SolicitadoPorEmail = email.Trim().ToLowerInvariant(),
            SolicitadoPorNombre = displayName.Trim(),
            TipoSolicitud = req.TipoSolicitud.Trim(),
            ModulosDetalle = req.ModulosDetalle,
            Listo = false,
            Aclaracion = null,
            FechaCreacion = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture),
        };
    }

    public (int Inserted, int SkippedDuplicates) InsertHistoricalBatch(IReadOnlyList<BlanqueoHistoricalRow> rows)
    {
        if (rows.Count == 0) return (0, 0);
        using var conn = Open();
        var existing = LoadImportFingerprints(conn);
        using var tx = conn.BeginTransaction();
        var inserted = 0;
        var skipped = 0;
        foreach (var row in rows)
        {
            var fp = ImportFingerprint(row);
            if (existing.Contains(fp))
            {
                skipped++;
                continue;
            }

            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO blanqueo_solicitudes
                    (portal, nro_caso, nro_cliente, correo, fecha_solicitud,
                     solicitado_por_email, solicitado_por_nombre, tipo_solicitud, listo, aclaracion, modulos_detalle, confirmado_por_nombre)
                VALUES
                    ($portal, $caso, $cliente, $correo, $fecha, $email, $nombre, $tipo, $listo, $aclaracion, $modulos, $confirmado)
                """;
            cmd.Parameters.AddWithValue("$portal", row.Portal);
            cmd.Parameters.AddWithValue("$caso", row.NroCaso);
            cmd.Parameters.AddWithValue("$cliente", row.NroCliente);
            cmd.Parameters.AddWithValue("$correo", row.Correo);
            cmd.Parameters.AddWithValue("$fecha", row.FechaSolicitud);
            cmd.Parameters.AddWithValue("$email", row.SolicitadoPorEmail ?? "");
            cmd.Parameters.AddWithValue("$nombre", row.SolicitadoPorNombre);
            cmd.Parameters.AddWithValue("$tipo", row.TipoSolicitud);
            cmd.Parameters.AddWithValue("$listo", row.Listo ? 1 : 0);
            cmd.Parameters.AddWithValue("$aclaracion", (object?)row.Aclaracion ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$modulos", (object?)row.ModulosDetalle ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$confirmado", (object?)row.ConfirmadoPorNombre ?? DBNull.Value);
            cmd.ExecuteNonQuery();
            existing.Add(fp);
            inserted++;
        }

        tx.Commit();
        return (inserted, skipped);
    }

    /// <summary>
    /// Vincula solicitudes históricas sin mail (agente aún no registrado) al usuario que acaba de ingresar.
    /// </summary>
    public int AssociatePendingRequester(string email, string? displayName = null)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return 0;

        var fromEmail = BlanqueoEndpoints.DisplayNameFromEmail(normalized);
        var preferredName = string.IsNullOrWhiteSpace(displayName) ? fromEmail : displayName.Trim();
        var keys = new HashSet<string>(StringComparer.Ordinal)
        {
            BlanqueoExcel.PersonKey(fromEmail),
            BlanqueoExcel.PersonKey(preferredName),
        };

        using var conn = Open();
        using var listCmd = conn.CreateCommand();
        listCmd.CommandText = """
            SELECT id, solicitado_por_nombre
            FROM blanqueo_solicitudes
            WHERE solicitado_por_email IS NULL OR trim(solicitado_por_email) = ''
            """;
        var pending = new List<(int Id, string Nombre)>();
        using (var r = listCmd.ExecuteReader())
        {
            while (r.Read())
                pending.Add((r.GetInt32(0), r.IsDBNull(1) ? "" : r.GetString(1)));
        }

        var updated = 0;
        foreach (var (id, nombre) in pending)
        {
            if (string.IsNullOrWhiteSpace(nombre)) continue;
            var key = BlanqueoExcel.PersonKey(nombre);
            if (!keys.Contains(key)) continue;

            using var upd = conn.CreateCommand();
            upd.CommandText = """
                UPDATE blanqueo_solicitudes
                SET solicitado_por_email = $email,
                    solicitado_por_nombre = $nombre
                WHERE id = $id
                  AND (solicitado_por_email IS NULL OR trim(solicitado_por_email) = '')
                """;
            upd.Parameters.AddWithValue("$email", normalized);
            upd.Parameters.AddWithValue("$nombre", preferredName);
            upd.Parameters.AddWithValue("$id", id);
            updated += upd.ExecuteNonQuery();
        }

        return updated;
    }

    /// <summary>
    /// Actualiza el nombre visible en todas las solicitudes ya vinculadas a ese correo.
    /// </summary>
    public int SyncRequesterDisplayName(string email, string? displayName)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return 0;

        var preferredName = string.IsNullOrWhiteSpace(displayName)
            ? BlanqueoEndpoints.DisplayNameFromEmail(normalized)
            : displayName.Trim();

        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE blanqueo_solicitudes
            SET solicitado_por_nombre = $nombre
            WHERE lower(solicitado_por_email) = lower($email)
            """;
        upd.Parameters.AddWithValue("$email", normalized);
        upd.Parameters.AddWithValue("$nombre", preferredName);
        return upd.ExecuteNonQuery();
    }

    private static HashSet<string> LoadImportFingerprints(SqliteConnection conn)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT portal, nro_caso, nro_cliente, correo, fecha_solicitud,
                   tipo_solicitud, solicitado_por_nombre, listo, coalesce(aclaracion, '')
            FROM blanqueo_solicitudes
            """;
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            set.Add(ImportFingerprint(
                portal: r.IsDBNull(0) ? "" : r.GetString(0),
                caso: r.IsDBNull(1) ? "" : r.GetString(1),
                cliente: r.IsDBNull(2) ? "" : r.GetString(2),
                correo: r.IsDBNull(3) ? "" : r.GetString(3),
                fecha: r.IsDBNull(4) ? "" : r.GetString(4),
                tipo: r.IsDBNull(5) ? "" : r.GetString(5),
                nombre: r.IsDBNull(6) ? "" : r.GetString(6),
                listo: !r.IsDBNull(7) && r.GetInt32(7) != 0,
                aclaracion: r.IsDBNull(8) ? "" : r.GetString(8)));
        }

        return set;
    }

    private static string ImportFingerprint(BlanqueoHistoricalRow row) =>
        ImportFingerprint(
            row.Portal,
            row.NroCaso,
            row.NroCliente,
            row.Correo,
            row.FechaSolicitud,
            row.TipoSolicitud,
            row.SolicitadoPorNombre,
            row.Listo,
            row.Aclaracion ?? "");

    private static string ImportFingerprint(
        string portal,
        string caso,
        string cliente,
        string correo,
        string fecha,
        string tipo,
        string nombre,
        bool listo,
        string aclaracion)
    {
        static string N(string? v) => (v ?? "").Trim().ToLowerInvariant();
        return string.Join('\u001f',
            N(portal), N(caso), N(cliente), N(correo), N(fecha), N(tipo),
            BlanqueoExcel.PersonKey(nombre), listo ? "1" : "0", N(aclaracion));
    }

    public BlanqueoRecordDto? UpdateOwnerFields(int id, BlanqueoUpdateRequest req)
    {
        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE blanqueo_solicitudes
            SET portal = $portal, nro_caso = $caso, nro_cliente = $cliente, correo = $correo, tipo_solicitud = $tipo, modulos_detalle = $modulos
            WHERE id = $id
            """;
        upd.Parameters.AddWithValue("$id", id);
        upd.Parameters.AddWithValue("$portal", req.Portal.Trim());
        upd.Parameters.AddWithValue("$caso", req.NroCaso.Trim());
        upd.Parameters.AddWithValue("$cliente", req.NroCliente.Trim());
        upd.Parameters.AddWithValue("$correo", req.Correo.Trim());
        upd.Parameters.AddWithValue("$tipo", req.TipoSolicitud.Trim());
        upd.Parameters.AddWithValue("$modulos", (object?)req.ModulosDetalle ?? DBNull.Value);
        if (upd.ExecuteNonQuery() <= 0)
            return null;
        return GetById(id);
    }

    public BlanqueoRecordDto? PatchConfirm(int id, BlanqueoPatchRequest req, string? confirmedByEmail = null, string? confirmedByNombre = null)
    {
        var current = GetById(id);
        if (current is null)
            return null;

        var listo = req.Listo ?? current.Listo;
        string? aclaracion = current.Aclaracion;
        if (req.ClearAclaracion)
            aclaracion = null;
        else if (req.Aclaracion is not null)
            aclaracion = string.IsNullOrWhiteSpace(req.Aclaracion) ? null : req.Aclaracion.Trim();

        // "No registrado" y "Listo" se anulan; otras observaciones pueden convivir con listo.
        if (req.Listo == true)
        {
            listo = true;
            if (BlanqueoAlertKinds.IsNoRegistrado(aclaracion))
                aclaracion = null;
        }
        else if (BlanqueoAlertKinds.IsNoRegistrado(aclaracion))
        {
            listo = false;
            aclaracion = "No registrado";
        }

        var wasListo = current.Listo;
        var prevAclaracion = current.Aclaracion;
        var resolved = listo || !string.IsNullOrWhiteSpace(aclaracion);
        string? confirmadoPor;
        if (!resolved)
        {
            confirmadoPor = null;
        }
        else
        {
            confirmadoPor = string.IsNullOrWhiteSpace(confirmedByNombre)
                ? (string.IsNullOrWhiteSpace(confirmedByEmail)
                    ? current.ConfirmadoPorNombre
                    : BlanqueoEndpoints.DisplayNameFromEmail(confirmedByEmail))
                : confirmedByNombre.Trim();
        }

        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE blanqueo_solicitudes
            SET listo = $listo, aclaracion = $aclaracion, confirmado_por_nombre = $confirmado
            WHERE id = $id
            """;
        upd.Parameters.AddWithValue("$id", id);
        upd.Parameters.AddWithValue("$listo", listo ? 1 : 0);
        upd.Parameters.AddWithValue("$aclaracion", (object?)aclaracion ?? DBNull.Value);
        upd.Parameters.AddWithValue("$confirmado", (object?)confirmadoPor ?? DBNull.Value);
        upd.ExecuteNonQuery();

        current.Listo = listo;
        current.Aclaracion = aclaracion;
        current.ConfirmadoPorNombre = confirmadoPor;

        SyncRequesterAlert(conn, current, wasListo, prevAclaracion);

        return current;
    }

    /// <summary>
    /// Cola para quien confirma: solo pendientes vivos (sin listo y sin aclaración).
    /// Histórico ya gestionado (listo / No registrado / observación) no notifica.
    /// </summary>
    public IReadOnlyList<BlanqueoAlertDto> ListPendingForConfirm()
    {
        var list = new List<BlanqueoAlertDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, portal, nro_caso, correo, tipo_solicitud, fecha_solicitud
            FROM blanqueo_solicitudes
            WHERE listo = 0
              AND (aclaracion IS NULL OR trim(aclaracion) = '')
            ORDER BY fecha_solicitud DESC, id DESC
            """;
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new BlanqueoAlertDto
            {
                Id = r.GetInt32(0),
                SolicitudId = r.GetInt32(0),
                Portal = r.IsDBNull(1) ? "PortalCliente" : r.GetString(1),
                NroCaso = r.GetString(2),
                Correo = r.GetString(3),
                TipoSolicitud = r.GetString(4),
                CreatedAt = r.IsDBNull(5) ? "" : r.GetString(5),
                Kind = BlanqueoAlertKinds.Pending,
            });
        }

        return list;
    }

    public IReadOnlyList<BlanqueoAlertDto> ListUnseenAlerts(string email)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return [];

        var list = new List<BlanqueoAlertDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, solicitud_id, portal, nro_caso, correo, tipo_solicitud, created_at, kind
            FROM blanqueo_alerts
            WHERE lower(email) = lower($email) AND seen = 0
            ORDER BY id DESC
            """;
        cmd.Parameters.AddWithValue("$email", normalized);
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new BlanqueoAlertDto
            {
                Id = r.GetInt32(0),
                SolicitudId = r.GetInt32(1),
                Portal = r.GetString(2),
                NroCaso = r.GetString(3),
                Correo = r.GetString(4),
                TipoSolicitud = r.GetString(5),
                CreatedAt = r.GetString(6),
                Kind = r.IsDBNull(7) || string.IsNullOrWhiteSpace(r.GetString(7))
                    ? BlanqueoAlertKinds.Ready
                    : r.GetString(7),
            });
        }

        return list;
    }

    public int MarkAlertsSeen(string email, IEnumerable<int>? ids = null)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return 0;

        var idList = ids?.Where(i => i > 0).Distinct().ToList() ?? [];
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        if (idList.Count == 0)
        {
            cmd.CommandText = """
                UPDATE blanqueo_alerts
                SET seen = 1
                WHERE lower(email) = lower($email) AND seen = 0
                """;
            cmd.Parameters.AddWithValue("$email", normalized);
            return cmd.ExecuteNonQuery();
        }

        var placeholders = string.Join(",", idList.Select((_, i) => $"$id{i}"));
        cmd.CommandText = $"""
            UPDATE blanqueo_alerts
            SET seen = 1
            WHERE lower(email) = lower($email) AND seen = 0 AND id IN ({placeholders})
            """;
        cmd.Parameters.AddWithValue("$email", normalized);
        for (var i = 0; i < idList.Count; i++)
            cmd.Parameters.AddWithValue($"$id{i}", idList[i]);
        return cmd.ExecuteNonQuery();
    }

    private static void SyncRequesterAlert(
        SqliteConnection conn,
        BlanqueoRecordDto item,
        bool wasListo,
        string? prevAclaracion)
    {
        string? kind = null;
        if (item.Listo)
            kind = BlanqueoAlertKinds.Ready;
        else if (!string.IsNullOrWhiteSpace(item.Aclaracion))
            kind = BlanqueoAlertKinds.FromAclaracion(item.Aclaracion);

        var listoChanged = wasListo != item.Listo;
        var aclaracionChanged = !string.Equals(
            (prevAclaracion ?? "").Trim(),
            (item.Aclaracion ?? "").Trim(),
            StringComparison.Ordinal);

        if (kind is null)
        {
            if (listoChanged || aclaracionChanged)
                DeleteAlertBySolicitud(conn, item.Id);
            return;
        }

        // Solo re-notificar cuando cambia el estado relevante.
        if (!listoChanged && !aclaracionChanged)
            return;

        UpsertAlert(conn, item, kind);
    }

    private static void UpsertAlert(SqliteConnection conn, BlanqueoRecordDto item, string kind)
    {
        var email = PlanUserIdentity.ValidateAndNormalize(item.SolicitadoPorEmail);
        if (email is null)
            return;

        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO blanqueo_alerts
                (solicitud_id, email, portal, nro_caso, correo, tipo_solicitud, kind, created_at, seen)
            VALUES
                ($solicitud, $email, $portal, $caso, $correo, $tipo, $kind, $created, 0)
            ON CONFLICT(solicitud_id) DO UPDATE SET
                email = excluded.email,
                portal = excluded.portal,
                nro_caso = excluded.nro_caso,
                correo = excluded.correo,
                tipo_solicitud = excluded.tipo_solicitud,
                kind = excluded.kind,
                created_at = excluded.created_at,
                seen = 0
            """;
        cmd.Parameters.AddWithValue("$solicitud", item.Id);
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$portal", item.Portal);
        cmd.Parameters.AddWithValue("$caso", item.NroCaso);
        cmd.Parameters.AddWithValue("$correo", item.Correo);
        cmd.Parameters.AddWithValue("$tipo", item.TipoSolicitud);
        cmd.Parameters.AddWithValue("$kind", kind);
        cmd.Parameters.AddWithValue("$created", DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture));
        cmd.ExecuteNonQuery();
    }

    private static void DeleteAlertBySolicitud(SqliteConnection conn, int solicitudId)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM blanqueo_alerts WHERE solicitud_id = $id";
        cmd.Parameters.AddWithValue("$id", solicitudId);
        cmd.ExecuteNonQuery();
    }

    public bool Delete(int id)
    {
        using var conn = Open();
        DeleteAlertBySolicitud(conn, id);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM blanqueo_solicitudes WHERE id = $id";
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() > 0;
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS blanqueo_solicitudes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portal TEXT NOT NULL DEFAULT 'PortalCliente',
                nro_caso TEXT NOT NULL,
                nro_cliente TEXT NOT NULL,
                correo TEXT NOT NULL,
                fecha_solicitud TEXT NOT NULL,
                solicitado_por_email TEXT NOT NULL,
                solicitado_por_nombre TEXT NOT NULL,
                tipo_solicitud TEXT NOT NULL,
                listo INTEGER NOT NULL DEFAULT 0,
                aclaracion TEXT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """;
        cmd.ExecuteNonQuery();
        EnsurePortalColumn(conn);
        EnsureModulosColumn(conn);
        EnsureConfirmadoColumn(conn);
        BackfillConfirmadoHistoricoAlexis(conn);
        EnsureAlertsTable(conn);
    }

    private static void EnsureConfirmadoColumn(SqliteConnection conn)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(blanqueo_solicitudes)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals("confirmado_por_nombre", StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = "ALTER TABLE blanqueo_solicitudes ADD COLUMN confirmado_por_nombre TEXT NULL";
        alter.ExecuteNonQuery();
    }

    /// <summary>
    /// Una sola vez: listos históricos sin “Confirmado por” → Alexis Ruiz (único confirmador hasta ahora).
    /// De acá en más PatchConfirm guarda el nombre real de quien marca listo.
    /// </summary>
    private void BackfillConfirmadoHistoricoAlexis(SqliteConnection conn)
    {
        using (var meta = conn.CreateCommand())
        {
            meta.CommandText = """
                CREATE TABLE IF NOT EXISTS blanqueo_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """;
            meta.ExecuteNonQuery();
        }

        using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT value FROM blanqueo_meta WHERE key = 'backfill_confirmado_alexis_v1'";
            if (check.ExecuteScalar() is not null)
                return;
        }

        const string alexis = "Alexis Ruiz";
        using (var upd = conn.CreateCommand())
        {
            upd.CommandText = """
                UPDATE blanqueo_solicitudes
                SET confirmado_por_nombre = $nombre
                WHERE listo = 1
                  AND (confirmado_por_nombre IS NULL OR trim(confirmado_por_nombre) = '')
                """;
            upd.Parameters.AddWithValue("$nombre", alexis);
            var n = upd.ExecuteNonQuery();
            _logger.LogInformation(
                "Backfill Confirmado por → {Nombre} en {Count} blanqueos listos históricos",
                alexis,
                n);
        }

        using var mark = conn.CreateCommand();
        mark.CommandText = """
            INSERT INTO blanqueo_meta (key, value) VALUES ('backfill_confirmado_alexis_v1', '1')
            """;
        mark.ExecuteNonQuery();
    }

    private static void EnsureAlertsTable(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS blanqueo_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                solicitud_id INTEGER NOT NULL UNIQUE,
                email TEXT NOT NULL COLLATE NOCASE,
                portal TEXT NOT NULL,
                nro_caso TEXT NOT NULL,
                correo TEXT NOT NULL,
                tipo_solicitud TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'ready',
                created_at TEXT NOT NULL,
                seen INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_blanqueo_alerts_email_seen
                ON blanqueo_alerts (email, seen);
            """;
        cmd.ExecuteNonQuery();
        EnsureAlertKindColumn(conn);
    }

    private static void EnsureAlertKindColumn(SqliteConnection conn)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(blanqueo_alerts)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals("kind", StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = "ALTER TABLE blanqueo_alerts ADD COLUMN kind TEXT NOT NULL DEFAULT 'ready'";
        alter.ExecuteNonQuery();
    }

    private static void EnsurePortalColumn(SqliteConnection conn)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(blanqueo_solicitudes)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals("portal", StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = "ALTER TABLE blanqueo_solicitudes ADD COLUMN portal TEXT NOT NULL DEFAULT 'PortalCliente'";
        alter.ExecuteNonQuery();
    }

    private static void EnsureModulosColumn(SqliteConnection conn)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(blanqueo_solicitudes)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals("modulos_detalle", StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = "ALTER TABLE blanqueo_solicitudes ADD COLUMN modulos_detalle TEXT NULL";
        alter.ExecuteNonQuery();
    }

    private void EnsureWritable(string dir)
    {
        try
        {
            var probe = Path.Combine(dir, ".write-test-blanqueo");
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

    private static BlanqueoRecordDto ReadRow(SqliteDataReader r) => new()
    {
        Id = r.GetInt32(0),
        Portal = r.IsDBNull(1) ? "PortalCliente" : r.GetString(1),
        NroCaso = r.GetString(2),
        NroCliente = r.GetString(3),
        Correo = r.GetString(4),
        FechaSolicitud = r.GetString(5),
        SolicitadoPorEmail = r.GetString(6),
        SolicitadoPorNombre = r.GetString(7),
        TipoSolicitud = r.GetString(8),
        Listo = r.GetInt32(9) != 0,
        Aclaracion = r.IsDBNull(10) ? null : r.GetString(10),
        FechaCreacion = r.FieldCount > 11 && !r.IsDBNull(11) ? r.GetString(11) : "",
        ModulosDetalle = r.FieldCount > 12 && !r.IsDBNull(12) ? r.GetString(12) : null,
        ConfirmadoPorNombre = r.FieldCount > 13 && !r.IsDBNull(13) ? r.GetString(13) : null,
    };

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        using var pragma = conn.CreateCommand();
        pragma.CommandText = "PRAGMA journal_mode=WAL;";
        pragma.ExecuteNonQuery();
        return conn;
    }

    private static long LastInsertRowId(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT last_insert_rowid()";
        return (long)(cmd.ExecuteScalar() ?? 0L);
    }
}
