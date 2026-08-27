using System.Globalization;
using Microsoft.Data.Sqlite;

namespace PortalClienchi.Web.Planillas;

public sealed class BorradoBasesRepository
{
    private readonly string _dbPath;
    private readonly ILogger<BorradoBasesRepository> _logger;

    public BorradoBasesRepository(ILogger<BorradoBasesRepository> logger)
    {
        _logger = logger;
        var st2Dir = St2Paths.GetDataDirectory();
        Directory.CreateDirectory(st2Dir);
        _dbPath = Path.Combine(st2Dir, "borrado_bases.db");
        EnsureWritable(st2Dir);
        EnsureSchema();
        _logger.LogInformation("Borrado de bases SQLite en {DbPath}", _dbPath);
    }

    public string DatabasePath => _dbPath;
    public bool StorageReady { get; private set; }

    private const string SelectColumns = """
        id, nro_caso, nro_cliente, nro_empresa, nombre_empresa, cuit,
        iva, sueldos, contabilidad, iva_detalle, sueldos_detalle, ejercicios_detalle,
        fecha_solicitud, solicitado_por_email, solicitado_por_nombre,
        listo, aclaracion, fecha_creacion, confirmado_por_nombre
        """;

    public IReadOnlyList<BorradoBasesRecordDto> LoadAll()
    {
        var list = new List<BorradoBasesRecordDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            SELECT {SelectColumns}
            FROM borrado_bases_solicitudes
            ORDER BY datetime(coalesce(fecha_creacion, fecha_solicitud)) DESC, id DESC
            """;
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(ReadRow(r));
        return list;
    }

    public BorradoBasesRecordDto? GetById(int id)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            SELECT {SelectColumns}
            FROM borrado_bases_solicitudes WHERE id = $id
            """;
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? ReadRow(r) : null;
    }

    public BorradoBasesRecordDto Insert(BorradoBasesCreateRequest req, string email, string displayName, string fecha)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO borrado_bases_solicitudes
                (nro_caso, nro_cliente, nro_empresa, nombre_empresa, cuit,
                 iva, sueldos, contabilidad, iva_detalle, sueldos_detalle, ejercicios_detalle,
                 fecha_solicitud, solicitado_por_email, solicitado_por_nombre, listo, aclaracion)
            VALUES
                ($caso, $cliente, $empresa, $nombreEmpresa, $cuit,
                 $iva, $sueldos, $contabilidad, $ivaDetalle, $sueldosDetalle, $ejercicios,
                 $fecha, $email, $nombre, 0, NULL)
            """;
        BindFields(cmd, req);
        cmd.Parameters.AddWithValue("$fecha", fecha);
        cmd.Parameters.AddWithValue("$email", email.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("$nombre", displayName.Trim());
        cmd.ExecuteNonQuery();

        var id = (int)LastInsertRowId(conn);
        return new BorradoBasesRecordDto
        {
            Id = id,
            NroCaso = req.NroCaso.Trim(),
            NroCliente = req.NroCliente.Trim(),
            NroEmpresa = req.NroEmpresa.Trim(),
            NombreEmpresa = req.NombreEmpresa.Trim(),
            Cuit = req.Cuit.Trim(),
            Iva = req.Iva,
            Sueldos = req.Sueldos,
            Contabilidad = req.Contabilidad,
            IvaDetalle = NullIfBlank(req.IvaDetalle),
            SueldosDetalle = NullIfBlank(req.SueldosDetalle),
            EjerciciosDetalle = NullIfBlank(req.EjerciciosDetalle),
            FechaSolicitud = fecha,
            SolicitadoPorEmail = email.Trim().ToLowerInvariant(),
            SolicitadoPorNombre = displayName.Trim(),
            Listo = false,
            Aclaracion = null,
            FechaCreacion = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture),
        };
    }

    public BorradoBasesRecordDto? UpdateOwnerFields(int id, BorradoBasesUpdateRequest req)
    {
        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE borrado_bases_solicitudes
            SET nro_caso = $caso, nro_cliente = $cliente, nro_empresa = $empresa,
                nombre_empresa = $nombreEmpresa, cuit = $cuit, iva = $iva, sueldos = $sueldos,
                contabilidad = $contabilidad, iva_detalle = $ivaDetalle,
                sueldos_detalle = $sueldosDetalle, ejercicios_detalle = $ejercicios
            WHERE id = $id
            """;
        upd.Parameters.AddWithValue("$id", id);
        BindFields(upd, req);
        if (upd.ExecuteNonQuery() <= 0)
            return null;
        return GetById(id);
    }

    public BorradoBasesRecordDto? PatchConfirm(int id, BorradoBasesPatchRequest req, string? confirmedByEmail = null, string? confirmedByNombre = null)
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

        // Listo y aclaración pueden convivir (misma lógica que Blanqueo sin "No registrado").
        if (req.Listo == true)
            listo = true;

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
                    : BorradoBasesEndpoints.DisplayNameFromEmail(confirmedByEmail))
                : confirmedByNombre.Trim();
        }

        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE borrado_bases_solicitudes
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
    /// Cola para quien confirma: pendientes vivos (sin listo y sin aclaración).
    /// </summary>
    public IReadOnlyList<BorradoAlertDto> ListPendingForConfirm()
    {
        var list = new List<BorradoAlertDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, nro_caso, nro_empresa, nombre_empresa, cuit, fecha_solicitud
            FROM borrado_bases_solicitudes
            WHERE listo = 0
              AND (aclaracion IS NULL OR trim(aclaracion) = '')
            ORDER BY datetime(coalesce(fecha_creacion, fecha_solicitud)) DESC, id DESC
            """;
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new BorradoAlertDto
            {
                Id = r.GetInt32(0),
                SolicitudId = r.GetInt32(0),
                NroCaso = r.IsDBNull(1) ? "" : r.GetString(1),
                NroEmpresa = r.IsDBNull(2) ? "" : r.GetString(2),
                NombreEmpresa = r.IsDBNull(3) ? "" : r.GetString(3),
                Cuit = r.IsDBNull(4) ? "" : r.GetString(4),
                Kind = BorradoAlertKinds.Pending,
                CreatedAt = r.IsDBNull(5) ? "" : r.GetString(5),
            });
        }

        return list;
    }

    public IReadOnlyList<BorradoAlertDto> ListUnseenAlerts(string email)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return [];

        var list = new List<BorradoAlertDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, solicitud_id, nro_caso, nro_empresa, nombre_empresa, cuit, created_at, kind
            FROM borrado_bases_alerts
            WHERE lower(email) = lower($email) AND seen = 0
            ORDER BY id DESC
            """;
        cmd.Parameters.AddWithValue("$email", normalized);
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new BorradoAlertDto
            {
                Id = r.GetInt32(0),
                SolicitudId = r.GetInt32(1),
                NroCaso = r.IsDBNull(2) ? "" : r.GetString(2),
                NroEmpresa = r.IsDBNull(3) ? "" : r.GetString(3),
                NombreEmpresa = r.IsDBNull(4) ? "" : r.GetString(4),
                Cuit = r.IsDBNull(5) ? "" : r.GetString(5),
                CreatedAt = r.IsDBNull(6) ? "" : r.GetString(6),
                Kind = r.IsDBNull(7) || string.IsNullOrWhiteSpace(r.GetString(7))
                    ? BorradoAlertKinds.Ready
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
                UPDATE borrado_bases_alerts
                SET seen = 1
                WHERE lower(email) = lower($email) AND seen = 0
                """;
            cmd.Parameters.AddWithValue("$email", normalized);
            return cmd.ExecuteNonQuery();
        }

        var placeholders = string.Join(",", idList.Select((_, i) => $"$id{i}"));
        cmd.CommandText = $"""
            UPDATE borrado_bases_alerts
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
        BorradoBasesRecordDto item,
        bool wasListo,
        string? prevAclaracion)
    {
        string? kind = null;
        if (item.Listo)
            kind = BorradoAlertKinds.IsPartialListo(item.Aclaracion)
                ? BorradoAlertKinds.Partial
                : BorradoAlertKinds.Ready;
        else if (!string.IsNullOrWhiteSpace(item.Aclaracion))
            kind = BorradoAlertKinds.Note;

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

        if (!listoChanged && !aclaracionChanged)
            return;

        UpsertAlert(conn, item, kind);
    }

    private static void UpsertAlert(SqliteConnection conn, BorradoBasesRecordDto item, string kind)
    {
        var email = PlanUserIdentity.ValidateAndNormalize(item.SolicitadoPorEmail);
        if (email is null)
            return;

        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO borrado_bases_alerts
                (solicitud_id, email, nro_caso, nro_empresa, nombre_empresa, cuit, kind, created_at, seen)
            VALUES
                ($solicitud, $email, $caso, $empresa, $nombre, $cuit, $kind, $created, 0)
            ON CONFLICT(solicitud_id) DO UPDATE SET
                email = excluded.email,
                nro_caso = excluded.nro_caso,
                nro_empresa = excluded.nro_empresa,
                nombre_empresa = excluded.nombre_empresa,
                cuit = excluded.cuit,
                kind = excluded.kind,
                created_at = excluded.created_at,
                seen = 0
            """;
        cmd.Parameters.AddWithValue("$solicitud", item.Id);
        cmd.Parameters.AddWithValue("$email", email);
        cmd.Parameters.AddWithValue("$caso", item.NroCaso);
        cmd.Parameters.AddWithValue("$empresa", item.NroEmpresa);
        cmd.Parameters.AddWithValue("$nombre", item.NombreEmpresa);
        cmd.Parameters.AddWithValue("$cuit", item.Cuit);
        cmd.Parameters.AddWithValue("$kind", kind);
        cmd.Parameters.AddWithValue("$created", DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture));
        cmd.ExecuteNonQuery();
    }

    private static void DeleteAlertBySolicitud(SqliteConnection conn, int solicitudId)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM borrado_bases_alerts WHERE solicitud_id = $id";
        cmd.Parameters.AddWithValue("$id", solicitudId);
        cmd.ExecuteNonQuery();
    }

    public bool Delete(int id)
    {
        using var conn = Open();
        DeleteAlertBySolicitud(conn, id);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM borrado_bases_solicitudes WHERE id = $id";
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() > 0;
    }

    public int SyncRequesterDisplayName(string email, string? displayName)
    {
        var normalized = PlanUserIdentity.ValidateAndNormalize(email);
        if (normalized is null)
            return 0;

        var preferredName = string.IsNullOrWhiteSpace(displayName)
            ? BorradoBasesEndpoints.DisplayNameFromEmail(normalized)
            : displayName.Trim();

        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE borrado_bases_solicitudes
            SET solicitado_por_nombre = $nombre
            WHERE lower(solicitado_por_email) = lower($email)
            """;
        upd.Parameters.AddWithValue("$email", normalized);
        upd.Parameters.AddWithValue("$nombre", preferredName);
        return upd.ExecuteNonQuery();
    }

    private static void BindFields(SqliteCommand cmd, BorradoBasesCreateRequest req)
    {
        cmd.Parameters.AddWithValue("$caso", req.NroCaso.Trim());
        cmd.Parameters.AddWithValue("$cliente", req.NroCliente.Trim());
        cmd.Parameters.AddWithValue("$empresa", req.NroEmpresa.Trim());
        cmd.Parameters.AddWithValue("$nombreEmpresa", req.NombreEmpresa.Trim());
        cmd.Parameters.AddWithValue("$cuit", req.Cuit.Trim());
        cmd.Parameters.AddWithValue("$iva", req.Iva ? 1 : 0);
        cmd.Parameters.AddWithValue("$sueldos", req.Sueldos ? 1 : 0);
        cmd.Parameters.AddWithValue("$contabilidad", req.Contabilidad ? 1 : 0);
        cmd.Parameters.AddWithValue("$ivaDetalle", (object?)NullIfBlank(req.IvaDetalle) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$sueldosDetalle", (object?)NullIfBlank(req.SueldosDetalle) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$ejercicios", (object?)NullIfBlank(req.EjerciciosDetalle) ?? DBNull.Value);
    }

    private static void BindFields(SqliteCommand cmd, BorradoBasesUpdateRequest req)
    {
        BindFields(cmd, new BorradoBasesCreateRequest
        {
            NroCaso = req.NroCaso,
            NroCliente = req.NroCliente,
            NroEmpresa = req.NroEmpresa,
            NombreEmpresa = req.NombreEmpresa,
            Cuit = req.Cuit,
            Iva = req.Iva,
            Sueldos = req.Sueldos,
            Contabilidad = req.Contabilidad,
            IvaDetalle = req.IvaDetalle,
            SueldosDetalle = req.SueldosDetalle,
            EjerciciosDetalle = req.EjerciciosDetalle,
        });
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS borrado_bases_solicitudes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nro_caso TEXT NOT NULL,
                nro_cliente TEXT NOT NULL,
                nro_empresa TEXT NOT NULL,
                nombre_empresa TEXT NOT NULL,
                cuit TEXT NOT NULL DEFAULT '',
                iva INTEGER NOT NULL DEFAULT 0,
                sueldos INTEGER NOT NULL DEFAULT 0,
                contabilidad INTEGER NOT NULL DEFAULT 0,
                iva_detalle TEXT NULL,
                sueldos_detalle TEXT NULL,
                ejercicios_detalle TEXT NULL,
                fecha_solicitud TEXT NOT NULL,
                solicitado_por_email TEXT NOT NULL,
                solicitado_por_nombre TEXT NOT NULL,
                listo INTEGER NOT NULL DEFAULT 0,
                aclaracion TEXT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """;
        cmd.ExecuteNonQuery();
        EnsureColumn(conn, "iva_detalle", "TEXT NULL");
        EnsureColumn(conn, "sueldos_detalle", "TEXT NULL");
        EnsureColumn(conn, "cuit", "TEXT NOT NULL DEFAULT ''");
        EnsureColumn(conn, "confirmado_por_nombre", "TEXT NULL");
        MigrateCuilToCuit(conn);
        BackfillGestionadoHistoricoAlexis(conn);
        EnsureAlertsTable(conn);
    }

    /// <summary>
    /// Una sola vez: gestionados históricos (listo u observación) sin nombre → Alexis Ruiz.
    /// </summary>
    private void BackfillGestionadoHistoricoAlexis(SqliteConnection conn)
    {
        using (var meta = conn.CreateCommand())
        {
            meta.CommandText = """
                CREATE TABLE IF NOT EXISTS borrado_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """;
            meta.ExecuteNonQuery();
        }

        using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT value FROM borrado_meta WHERE key = 'backfill_gestionado_alexis_v1'";
            if (check.ExecuteScalar() is not null)
                return;
        }

        const string alexis = "Alexis Ruiz";
        using (var upd = conn.CreateCommand())
        {
            upd.CommandText = """
                UPDATE borrado_bases_solicitudes
                SET confirmado_por_nombre = $nombre
                WHERE (confirmado_por_nombre IS NULL OR trim(confirmado_por_nombre) = '')
                  AND (listo = 1 OR (aclaracion IS NOT NULL AND trim(aclaracion) != ''))
                """;
            upd.Parameters.AddWithValue("$nombre", alexis);
            var n = upd.ExecuteNonQuery();
            _logger.LogInformation(
                "Backfill Gestionado por → {Nombre} en {Count} borrados históricos",
                alexis,
                n);
        }

        using var mark = conn.CreateCommand();
        mark.CommandText = """
            INSERT INTO borrado_meta (key, value) VALUES ('backfill_gestionado_alexis_v1', '1')
            """;
        mark.ExecuteNonQuery();
    }

    private static void EnsureAlertsTable(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS borrado_bases_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                solicitud_id INTEGER NOT NULL UNIQUE,
                email TEXT NOT NULL COLLATE NOCASE,
                nro_caso TEXT NOT NULL,
                nro_empresa TEXT NOT NULL,
                nombre_empresa TEXT NOT NULL,
                cuit TEXT NOT NULL DEFAULT '',
                kind TEXT NOT NULL DEFAULT 'ready',
                created_at TEXT NOT NULL,
                seen INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_borrado_bases_alerts_email_seen
                ON borrado_bases_alerts (email, seen);
            """;
        cmd.ExecuteNonQuery();
    }

    private static void MigrateCuilToCuit(SqliteConnection conn)
    {
        if (!HasColumn(conn, "cuil"))
            return;

        using var copy = conn.CreateCommand();
        copy.CommandText = """
            UPDATE borrado_bases_solicitudes
            SET cuit = cuil
            WHERE (cuit IS NULL OR trim(cuit) = '')
              AND cuil IS NOT NULL AND trim(cuil) <> ''
            """;
        copy.ExecuteNonQuery();
    }

    private static bool HasColumn(SqliteConnection conn, string column)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(borrado_bases_solicitudes)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals(column, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static void EnsureColumn(SqliteConnection conn, string column, string definition)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(borrado_bases_solicitudes)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals(column, StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = $"ALTER TABLE borrado_bases_solicitudes ADD COLUMN {column} {definition}";
        alter.ExecuteNonQuery();
    }

    private void EnsureWritable(string dir)
    {
        try
        {
            var probe = Path.Combine(dir, ".write-test-borrado-bases");
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

    private static BorradoBasesRecordDto ReadRow(SqliteDataReader r) => new()
    {
        Id = r.GetInt32(0),
        NroCaso = r.IsDBNull(1) ? "" : r.GetString(1),
        NroCliente = r.IsDBNull(2) ? "" : r.GetString(2),
        NroEmpresa = r.IsDBNull(3) ? "" : r.GetString(3),
        NombreEmpresa = r.IsDBNull(4) ? "" : r.GetString(4),
        Cuit = r.IsDBNull(5) ? "" : r.GetString(5),
        Iva = !r.IsDBNull(6) && r.GetInt32(6) != 0,
        Sueldos = !r.IsDBNull(7) && r.GetInt32(7) != 0,
        Contabilidad = !r.IsDBNull(8) && r.GetInt32(8) != 0,
        IvaDetalle = r.IsDBNull(9) ? null : r.GetString(9),
        SueldosDetalle = r.IsDBNull(10) ? null : r.GetString(10),
        EjerciciosDetalle = r.IsDBNull(11) ? null : r.GetString(11),
        FechaSolicitud = r.IsDBNull(12) ? "" : r.GetString(12),
        SolicitadoPorEmail = r.IsDBNull(13) ? "" : r.GetString(13),
        SolicitadoPorNombre = r.IsDBNull(14) ? "" : r.GetString(14),
        Listo = !r.IsDBNull(15) && r.GetInt32(15) != 0,
        Aclaracion = r.IsDBNull(16) ? null : r.GetString(16),
        FechaCreacion = r.IsDBNull(17) ? "" : FormatFechaCreacion(r.GetValue(17)),
        ConfirmadoPorNombre = r.FieldCount > 18 && !r.IsDBNull(18) ? r.GetString(18) : null,
    };

    private static string FormatFechaCreacion(object value)
    {
        if (value is DateTime dt)
            return dt.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
        return Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
    }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        return conn;
    }

    private static long LastInsertRowId(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT last_insert_rowid()";
        return (long)(cmd.ExecuteScalar() ?? 0L);
    }
}
