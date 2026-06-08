using Microsoft.Data.Sqlite;
using PortalClienchi.Core.Models;
using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Core.Data;

public sealed class ContentRepository
{
    private readonly string _dbPath;

    public ContentRepository(string? dbPath = null)
    {
        var folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PortalClienchi");
        Directory.CreateDirectory(folder);
        _dbPath = dbPath ?? Path.Combine(folder, "content.db");
    }

    public string DatabasePath => _dbPath;

    public void Initialize()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER NOT NULL,
                type TEXT NOT NULL,
                type_label TEXT NOT NULL,
                title TEXT NOT NULL,
                product_name TEXT,
                keywords TEXT,
                description_plain TEXT,
                description_html TEXT,
                external_url TEXT,
                duration TEXT,
                portal_url TEXT NOT NULL,
                updated_at TEXT,
                synced_at TEXT NOT NULL,
                PRIMARY KEY (id, type)
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
                title,
                product_name,
                keywords,
                description_plain
            );

            CREATE TABLE IF NOT EXISTS sync_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """;
        cmd.ExecuteNonQuery();
    }

    public void ClearAll()
    {
        using var conn = Open();
        using var tx = conn.BeginTransaction();
        Exec(conn, "DELETE FROM knowledge", tx);
        Exec(conn, "DELETE FROM knowledge_fts", tx);
        tx.Commit();
    }

    public void Upsert(KnowledgeItem item)
    {
        item.DescriptionPlain = HtmlTextHelper.ToPlainText(item.DescriptionHtml);
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO knowledge (
                id, type, type_label, title, product_name, keywords,
                description_plain, description_html, external_url, duration,
                portal_url, updated_at, synced_at
            ) VALUES (
                $id, $type, $typeLabel, $title, $product, $keywords,
                $plain, $html, $external, $duration,
                $portal, $updated, $synced
            )
            ON CONFLICT(id, type) DO UPDATE SET
                type_label = excluded.type_label,
                title = excluded.title,
                product_name = excluded.product_name,
                keywords = excluded.keywords,
                description_plain = excluded.description_plain,
                description_html = excluded.description_html,
                external_url = excluded.external_url,
                duration = excluded.duration,
                portal_url = excluded.portal_url,
                updated_at = excluded.updated_at,
                synced_at = excluded.synced_at;
            """;
        cmd.Parameters.AddWithValue("$id", item.Id);
        cmd.Parameters.AddWithValue("$type", item.Type.ToFilterKey());
        cmd.Parameters.AddWithValue("$typeLabel", item.Type.ToDisplayName());
        cmd.Parameters.AddWithValue("$title", item.Title);
        cmd.Parameters.AddWithValue("$product", (object?)item.ProductName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$keywords", (object?)item.Keywords ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$plain", (object?)item.DescriptionPlain ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$html", (object?)item.DescriptionHtml ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$external", (object?)item.ExternalUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$duration", (object?)item.Duration ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$portal", item.PortalUrl);
        cmd.Parameters.AddWithValue("$updated", item.UpdatedAt?.ToString("O") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("$synced", item.SyncedAt.ToString("O"));
        cmd.ExecuteNonQuery();
        ReindexFts(conn, item);
    }

    private static void ReindexFts(SqliteConnection conn, KnowledgeItem item)
    {
        using var del = conn.CreateCommand();
        del.CommandText = "DELETE FROM knowledge_fts WHERE rowid = (SELECT rowid FROM knowledge WHERE id = $id AND type = $type)";
        del.Parameters.AddWithValue("$id", item.Id);
        del.Parameters.AddWithValue("$type", item.Type.ToFilterKey());
        del.ExecuteNonQuery();

        using var ins = conn.CreateCommand();
        ins.CommandText = """
            INSERT INTO knowledge_fts(rowid, title, product_name, keywords, description_plain)
            SELECT rowid, title, product_name, keywords, description_plain
            FROM knowledge WHERE id = $id AND type = $type;
            """;
        ins.Parameters.AddWithValue("$id", item.Id);
        ins.Parameters.AddWithValue("$type", item.Type.ToFilterKey());
        ins.ExecuteNonQuery();
    }

    public void SetMeta(string key, string value)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO sync_meta(key, value) VALUES ($k, $v)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            """;
        cmd.Parameters.AddWithValue("$k", key);
        cmd.Parameters.AddWithValue("$v", value);
        cmd.ExecuteNonQuery();
    }

    public string? GetMeta(string key)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT value FROM sync_meta WHERE key = $k";
        cmd.Parameters.AddWithValue("$k", key);
        return cmd.ExecuteScalar() as string;
    }

    public int Count()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM knowledge";
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    public IReadOnlyList<SearchResult> Search(string query, string? typeFilter, int limit = 80)
    {
        query = query.Trim();
        if (query.Length == 0)
            return [];

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        var ftsQuery = BuildFtsQuery(query);
        cmd.CommandText = """
            SELECT k.id, k.type, k.type_label, k.title, k.product_name,
                   k.description_plain, k.portal_url, k.external_url
            FROM knowledge_fts fts
            INNER JOIN knowledge k ON k.rowid = fts.rowid
            WHERE knowledge_fts MATCH $q
            """ + (string.IsNullOrEmpty(typeFilter) ? "" : " AND k.type = $type") + """
            ORDER BY rank
            LIMIT $limit;
            """;
        cmd.Parameters.AddWithValue("$q", ftsQuery);
        if (!string.IsNullOrEmpty(typeFilter))
            cmd.Parameters.AddWithValue("$type", typeFilter);
        cmd.Parameters.AddWithValue("$limit", limit);

        var results = new List<SearchResult>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var plain = reader.IsDBNull(5) ? "" : reader.GetString(5);
            results.Add(new SearchResult
            {
                Id = reader.GetInt32(0),
                Type = reader.GetString(1),
                TypeLabel = reader.GetString(2),
                Title = reader.GetString(3),
                ProductName = reader.IsDBNull(4) ? null : reader.GetString(4),
                Snippet = HtmlTextHelper.Snippet(plain),
                PortalUrl = reader.GetString(6),
                ExternalUrl = reader.IsDBNull(7) ? null : reader.GetString(7),
            });
        }
        return results;
    }

    public KnowledgeItem? GetById(int id, string type)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM knowledge WHERE id = $id AND type = $type LIMIT 1";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$type", type);
        using var r = cmd.ExecuteReader();
        if (!r.Read())
            return null;

        return new KnowledgeItem
        {
            Id = r.GetInt32(r.GetOrdinal("id")),
            Type = Enum.Parse<KnowledgeType>(r.GetString(r.GetOrdinal("type")), true),
            Title = r.GetString(r.GetOrdinal("title")),
            ProductName = r.IsDBNull(r.GetOrdinal("product_name")) ? null : r.GetString(r.GetOrdinal("product_name")),
            Keywords = r.IsDBNull(r.GetOrdinal("keywords")) ? null : r.GetString(r.GetOrdinal("keywords")),
            DescriptionPlain = r.IsDBNull(r.GetOrdinal("description_plain")) ? null : r.GetString(r.GetOrdinal("description_plain")),
            DescriptionHtml = r.IsDBNull(r.GetOrdinal("description_html")) ? null : r.GetString(r.GetOrdinal("description_html")),
            ExternalUrl = r.IsDBNull(r.GetOrdinal("external_url")) ? null : r.GetString(r.GetOrdinal("external_url")),
            Duration = r.IsDBNull(r.GetOrdinal("duration")) ? null : r.GetString(r.GetOrdinal("duration")),
            PortalUrl = r.GetString(r.GetOrdinal("portal_url")),
        };
    }

    private static string BuildFtsQuery(string input)
    {
        var parts = input.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
            return "\"\"";
        return string.Join(" ", parts.Select(p => $"\"{p.Replace("\"", "")}\"*"));
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        return conn;
    }

    private static void Exec(SqliteConnection conn, string sql, SqliteTransaction? tx = null)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }
}
