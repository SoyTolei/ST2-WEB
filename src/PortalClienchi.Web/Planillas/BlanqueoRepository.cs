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
                   listo, aclaracion
            FROM blanqueo_solicitudes
            ORDER BY fecha_solicitud DESC, id DESC
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
                   listo, aclaracion
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
                 solicitado_por_email, solicitado_por_nombre, tipo_solicitud, listo, aclaracion)
            VALUES
                ($portal, $caso, $cliente, $correo, $fecha, $email, $nombre, $tipo, 0, NULL)
            """;
        cmd.Parameters.AddWithValue("$portal", req.Portal.Trim());
        cmd.Parameters.AddWithValue("$caso", req.NroCaso.Trim());
        cmd.Parameters.AddWithValue("$cliente", req.NroCliente.Trim());
        cmd.Parameters.AddWithValue("$correo", req.Correo.Trim());
        cmd.Parameters.AddWithValue("$fecha", fecha);
        cmd.Parameters.AddWithValue("$email", email.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("$nombre", displayName.Trim());
        cmd.Parameters.AddWithValue("$tipo", req.TipoSolicitud.Trim());
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
            Listo = false,
            Aclaracion = null,
        };
    }

    public BlanqueoRecordDto? UpdateOwnerFields(int id, BlanqueoUpdateRequest req)
    {
        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE blanqueo_solicitudes
            SET portal = $portal, nro_caso = $caso, nro_cliente = $cliente, correo = $correo, tipo_solicitud = $tipo
            WHERE id = $id
            """;
        upd.Parameters.AddWithValue("$id", id);
        upd.Parameters.AddWithValue("$portal", req.Portal.Trim());
        upd.Parameters.AddWithValue("$caso", req.NroCaso.Trim());
        upd.Parameters.AddWithValue("$cliente", req.NroCliente.Trim());
        upd.Parameters.AddWithValue("$correo", req.Correo.Trim());
        upd.Parameters.AddWithValue("$tipo", req.TipoSolicitud.Trim());
        if (upd.ExecuteNonQuery() <= 0)
            return null;
        return GetById(id);
    }

    public BlanqueoRecordDto? PatchConfirm(int id, BlanqueoPatchRequest req)
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

        using var conn = Open();
        using var upd = conn.CreateCommand();
        upd.CommandText = """
            UPDATE blanqueo_solicitudes
            SET listo = $listo, aclaracion = $aclaracion
            WHERE id = $id
            """;
        upd.Parameters.AddWithValue("$id", id);
        upd.Parameters.AddWithValue("$listo", listo ? 1 : 0);
        upd.Parameters.AddWithValue("$aclaracion", (object?)aclaracion ?? DBNull.Value);
        upd.ExecuteNonQuery();

        current.Listo = listo;
        current.Aclaracion = aclaracion;
        return current;
    }

    public bool Delete(int id)
    {
        using var conn = Open();
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
