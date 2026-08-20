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
        id, nro_caso, nro_cliente, nro_empresa, nombre_empresa,
        iva, sueldos, contabilidad, iva_detalle, sueldos_detalle, ejercicios_detalle,
        fecha_solicitud, solicitado_por_email, solicitado_por_nombre,
        listo, aclaracion, fecha_creacion
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
                (nro_caso, nro_cliente, nro_empresa, nombre_empresa,
                 iva, sueldos, contabilidad, iva_detalle, sueldos_detalle, ejercicios_detalle,
                 fecha_solicitud, solicitado_por_email, solicitado_por_nombre, listo, aclaracion)
            VALUES
                ($caso, $cliente, $empresa, $nombreEmpresa,
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
                nombre_empresa = $nombreEmpresa, iva = $iva, sueldos = $sueldos,
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

    public BorradoBasesRecordDto? PatchConfirm(int id, BorradoBasesPatchRequest req)
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
            UPDATE borrado_bases_solicitudes
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

    public bool Delete(int id)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM borrado_bases_solicitudes WHERE id = $id";
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() > 0;
    }

    private static void BindFields(SqliteCommand cmd, BorradoBasesCreateRequest req)
    {
        cmd.Parameters.AddWithValue("$caso", req.NroCaso.Trim());
        cmd.Parameters.AddWithValue("$cliente", req.NroCliente.Trim());
        cmd.Parameters.AddWithValue("$empresa", req.NroEmpresa.Trim());
        cmd.Parameters.AddWithValue("$nombreEmpresa", req.NombreEmpresa.Trim());
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
        Iva = !r.IsDBNull(5) && r.GetInt32(5) != 0,
        Sueldos = !r.IsDBNull(6) && r.GetInt32(6) != 0,
        Contabilidad = !r.IsDBNull(7) && r.GetInt32(7) != 0,
        IvaDetalle = r.IsDBNull(8) ? null : r.GetString(8),
        SueldosDetalle = r.IsDBNull(9) ? null : r.GetString(9),
        EjerciciosDetalle = r.IsDBNull(10) ? null : r.GetString(10),
        FechaSolicitud = r.IsDBNull(11) ? "" : r.GetString(11),
        SolicitadoPorEmail = r.IsDBNull(12) ? "" : r.GetString(12),
        SolicitadoPorNombre = r.IsDBNull(13) ? "" : r.GetString(13),
        Listo = !r.IsDBNull(14) && r.GetInt32(14) != 0,
        Aclaracion = r.IsDBNull(15) ? null : r.GetString(15),
        FechaCreacion = r.IsDBNull(16) ? "" : FormatFechaCreacion(r.GetValue(16)),
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
