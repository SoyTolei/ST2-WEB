using System.Globalization;
using Microsoft.Data.Sqlite;

namespace PortalClienchi.Web.Planillas;

public sealed class OportunidadRepository
{
    private readonly string _dbPath;
    private readonly ILogger<OportunidadRepository> _logger;

    public OportunidadRepository(ILogger<OportunidadRepository> logger)
    {
        _logger = logger;
        var st2Dir = St2Paths.GetDataDirectory();
        Directory.CreateDirectory(st2Dir);
        _dbPath = Path.Combine(st2Dir, "oportunidades.db");
        EnsureWritable(st2Dir);
        EnsureSchema();
        _logger.LogInformation("Oportunidades SQLite en {DbPath}", _dbPath);
    }

    public string DatabasePath => _dbPath;

    public bool StorageReady { get; private set; }

    public IReadOnlyList<OportunidadRecordDto> LoadAll(string usuario)
    {
        var list = new List<OportunidadRecordDto>();
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, fecha, descripcion, link, confirmada, porcentaje
            FROM oportunidades
            WHERE usuario = $usuario
            ORDER BY fecha_creacion DESC
            """;
        cmd.Parameters.AddWithValue("$usuario", usuario);
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(ReadRow(r));
        return list;
    }

    public int Insert(OportunidadUpsertRequest req, string usuario)
    {
        try
        {
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO oportunidades (fecha, descripcion, link, confirmada, porcentaje, usuario)
                VALUES ($fecha, $desc, $link, $conf, $pct, $usuario)
                """;
            BindUpsert(cmd, req);
            cmd.Parameters.AddWithValue("$usuario", usuario);
            cmd.ExecuteNonQuery();
            var id = (int)LastInsertRowId(conn);
            _logger.LogInformation("Oportunidad {Id} creada para {Usuario}", id, usuario);
            return id;
        }
        catch (SqliteException ex)
        {
            _logger.LogError(ex, "Error SQLite al insertar oportunidad en {DbPath}", _dbPath);
            throw new InvalidOperationException(
                $"No se pudo guardar en la base de datos ({_dbPath}). " +
                "En Railway verificá el Volume en /data/st2 y la variable RAILWAY_RUN_UID=0.",
                ex);
        }
    }

    public bool Update(int id, OportunidadUpsertRequest req, string usuario)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE oportunidades SET fecha=$fecha, descripcion=$desc, link=$link,
            confirmada=$conf, porcentaje=$pct
            WHERE id=$id AND usuario=$usuario
            """;
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$usuario", usuario);
        BindUpsert(cmd, req);
        return cmd.ExecuteNonQuery() > 0;
    }

    public bool Delete(int id, string usuario)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM oportunidades WHERE id=$id AND usuario=$usuario";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$usuario", usuario);
        return cmd.ExecuteNonQuery() > 0;
    }

    private static void BindUpsert(SqliteCommand cmd, OportunidadUpsertRequest req)
    {
        cmd.Parameters.AddWithValue("$fecha", req.Fecha.Trim());
        cmd.Parameters.AddWithValue("$desc", req.Descripcion.Trim());
        cmd.Parameters.AddWithValue("$link", req.Link.Trim());
        cmd.Parameters.AddWithValue("$conf", req.Confirmada ? "Sí" : "No");
        cmd.Parameters.AddWithValue("$pct", string.IsNullOrWhiteSpace(req.Porcentaje) ? "N/D" : req.Porcentaje.Trim());
    }

    private void EnsureSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS oportunidades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL,
                descripcion TEXT NOT NULL,
                link TEXT NOT NULL,
                confirmada TEXT NOT NULL,
                porcentaje TEXT DEFAULT 'N/D',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                usuario TEXT NOT NULL DEFAULT ''
            )
            """;
        cmd.ExecuteNonQuery();
        EnsureUsuarioColumn(conn);
    }

    private static void EnsureUsuarioColumn(SqliteConnection conn)
    {
        using var info = conn.CreateCommand();
        info.CommandText = "PRAGMA table_info(oportunidades)";
        using var r = info.ExecuteReader();
        while (r.Read())
        {
            if (r.GetString(1).Equals("usuario", StringComparison.OrdinalIgnoreCase))
                return;
        }

        using var alter = conn.CreateCommand();
        alter.CommandText = "ALTER TABLE oportunidades ADD COLUMN usuario TEXT NOT NULL DEFAULT ''";
        alter.ExecuteNonQuery();
    }

    private void EnsureWritable(string dir)
    {
        try
        {
            var probe = Path.Combine(dir, ".write-test");
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

    private static OportunidadRecordDto ReadRow(SqliteDataReader r) => new()
    {
        Id = r.GetInt32(0),
        Fecha = r.GetString(1),
        Descripcion = r.GetString(2),
        Link = r.GetString(3),
        Confirmada = r.GetString(4).Equals("Sí", StringComparison.OrdinalIgnoreCase),
        Porcentaje = r.IsDBNull(5) ? "N/D" : r.GetString(5),
    };

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        using (var pragma = conn.CreateCommand())
        {
            pragma.CommandText = "PRAGMA journal_mode=WAL;";
            pragma.ExecuteNonQuery();
        }
        return conn;
    }

    private static long LastInsertRowId(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT last_insert_rowid()";
        return (long)(cmd.ExecuteScalar() ?? 0L);
    }
}
