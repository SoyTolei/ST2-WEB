using System.Text.Json;
using System.Text.Json.Serialization;

namespace PortalClienchi.Web;

public sealed class St2ToolPackageDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Version { get; set; } = "";
    public string FileName { get; set; } = "";
    public long SizeBytes { get; set; }
    public string UpdatedAtUtc { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    public bool Available { get; set; }
}

/// <summary>
/// Paquetes ST2.SQL / ST2.BAT en el volume persistente (/data/st2/tools).
/// </summary>
public sealed class St2ToolsStore
{
    public static readonly string[] ToolIds = ["sql", "bat"];

    private static readonly Dictionary<string, string> ToolNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sql"] = "ST2.SQL",
        ["bat"] = "ST2.BAT",
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".zip", ".7z", ".rar", ".exe", ".msi", ".bat", ".cmd", ".ps1",
    };

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly object _gate = new();
    private readonly string _root;
    private readonly string _manifestPath;
    private readonly string _lastErrorPath;

    public St2ToolsStore()
    {
        _root = Path.Combine(St2Paths.GetDataDirectory(), "tools");
        _manifestPath = Path.Combine(_root, "manifest.json");
        _lastErrorPath = Path.Combine(_root, "last-upload-error.txt");
        EnsureRoot();
    }

    public string RootPath => _root;

    public IReadOnlyList<St2ToolPackageDto> List()
    {
        lock (_gate)
        {
            EnsureRoot();
            var map = ReadManifestUnlocked();
            var list = new List<St2ToolPackageDto>(ToolIds.Length);
            foreach (var id in ToolIds)
                list.Add(ToDto(id, map.GetValueOrDefault(id)));
            return list;
        }
    }

    public bool TryOpen(string toolId, out string fullPath, out St2ToolPackageDto? meta)
    {
        fullPath = "";
        meta = null;
        if (!TryNormalizeId(toolId, out var id))
            return false;

        lock (_gate)
        {
            var map = ReadManifestUnlocked();
            if (!map.TryGetValue(id, out var entry) || entry is null || string.IsNullOrWhiteSpace(entry.FileName))
                return false;

            var path = Path.Combine(_root, id, entry.FileName);
            if (!File.Exists(path))
                return false;

            fullPath = path;
            meta = ToDto(id, entry);
            return true;
        }
    }

    public string WriteProbe()
    {
        EnsureRoot();
        var probe = Path.Combine(_root, $".probe-{Guid.NewGuid():N}.txt");
        File.WriteAllText(probe, DateTime.UtcNow.ToString("o"));
        var info = new FileInfo(probe);
        File.Delete(probe);
        return $"write-ok size={info.Length} root={_root}";
    }

    public void WriteLastError(string toolId, Exception ex)
    {
        try
        {
            EnsureRoot();
            File.WriteAllText(
                _lastErrorPath,
                $"{DateTime.UtcNow:o}\ntool={toolId}\n{ex}");
        }
        catch
        {
            // ignore
        }
    }

    public void ClearLastError()
    {
        try
        {
            if (File.Exists(_lastErrorPath))
                File.Delete(_lastErrorPath);
        }
        catch
        {
            // ignore
        }
    }

    public string? ReadLastError()
    {
        try
        {
            return File.Exists(_lastErrorPath) ? File.ReadAllText(_lastErrorPath) : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Crea un temp dentro del volume (no en /tmp del contenedor).</summary>
    public string BeginTempFile(string toolId)
    {
        if (!TryNormalizeId(toolId, out var id))
            throw new ArgumentException("Herramienta inválida. Usá sql o bat.");

        EnsureRoot();
        var toolDir = Path.Combine(_root, id);
        Directory.CreateDirectory(toolDir);
        return Path.Combine(toolDir, $".{Guid.NewGuid():N}.uploading");
    }

    public St2ToolPackageDto CommitTempFile(string toolId, string tmpPath, string originalFileName, string? version, long sizeBytes)
    {
        if (!TryNormalizeId(toolId, out var id))
            throw new ArgumentException("Herramienta inválida. Usá sql o bat.");

        var safeName = SanitizeFileName(originalFileName);
        var ext = Path.GetExtension(safeName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            throw new ArgumentException("Formato no permitido. Usá zip, 7z, rar, exe, msi, bat, cmd o ps1.");

        var ver = string.IsNullOrWhiteSpace(version)
            ? DateTime.UtcNow.ToString("yyyy.MM.dd")
            : version.Trim();
        if (ver.Length > 40)
            throw new ArgumentException("La versión es demasiado larga.");

        if (sizeBytes <= 0)
            throw new InvalidOperationException("El archivo está vacío.");
        if (sizeBytes > 120L * 1024 * 1024)
            throw new InvalidOperationException("El archivo supera el máximo de 120 MB.");

        if (!File.Exists(tmpPath))
            throw new InvalidOperationException("No se encontró el archivo temporal subido.");

        var toolDir = Path.Combine(_root, id);
        Directory.CreateDirectory(toolDir);
        var destPath = Path.Combine(toolDir, safeName);

        lock (_gate)
        {
            foreach (var old in Directory.EnumerateFiles(toolDir))
            {
                if (string.Equals(old, tmpPath, StringComparison.OrdinalIgnoreCase))
                    continue;
                try { File.Delete(old); } catch { /* ignore */ }
            }

            if (File.Exists(destPath))
                File.Delete(destPath);
            File.Move(tmpPath, destPath);

            var map = ReadManifestUnlocked();
            map[id] = new ManifestEntry
            {
                Version = ver,
                FileName = safeName,
                SizeBytes = sizeBytes,
                UpdatedAtUtc = DateTime.UtcNow.ToString("o"),
                ContentType = GuessContentType(ext),
            };
            WriteManifestUnlocked(map);
            return ToDto(id, map[id]);
        }
    }

    private void EnsureRoot()
    {
        try
        {
            Directory.CreateDirectory(_root);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"No se pudo crear la carpeta de herramientas ({_root}). Revisá el volume /data/st2. {ex.Message}",
                ex);
        }
    }

    private static bool TryNormalizeId(string? toolId, out string id)
    {
        id = (toolId ?? "").Trim().ToLowerInvariant();
        return ToolIds.Contains(id);
    }

    private static string SanitizeFileName(string name)
    {
        var baseName = Path.GetFileName(name?.Trim() ?? "");
        if (string.IsNullOrWhiteSpace(baseName))
            throw new ArgumentException("Nombre de archivo inválido.");
        foreach (var c in Path.GetInvalidFileNameChars())
            baseName = baseName.Replace(c, '_');
        if (baseName is "." or ".." || baseName.Length > 180)
            throw new ArgumentException("Nombre de archivo inválido.");
        return baseName;
    }

    private static string GuessContentType(string ext) => ext.ToLowerInvariant() switch
    {
        ".zip" => "application/zip",
        ".7z" => "application/x-7z-compressed",
        ".rar" => "application/vnd.rar",
        ".exe" => "application/vnd.microsoft.portable-executable",
        ".msi" => "application/octet-stream",
        ".bat" => "application/x-bat",
        ".cmd" => "application/x-bat",
        ".ps1" => "application/octet-stream",
        _ => "application/octet-stream",
    };

    private St2ToolPackageDto ToDto(string id, ManifestEntry? entry)
    {
        var available = entry is not null
            && !string.IsNullOrWhiteSpace(entry.FileName)
            && File.Exists(Path.Combine(_root, id, entry.FileName));

        return new St2ToolPackageDto
        {
            Id = id,
            Name = ToolNames.GetValueOrDefault(id) ?? id.ToUpperInvariant(),
            Version = available ? (entry!.Version ?? "") : "",
            FileName = available ? (entry!.FileName ?? "") : "",
            SizeBytes = available ? entry!.SizeBytes : 0,
            UpdatedAtUtc = available ? (entry!.UpdatedAtUtc ?? "") : "",
            ContentType = available ? (entry!.ContentType ?? "application/octet-stream") : "application/octet-stream",
            Available = available,
        };
    }

    private Dictionary<string, ManifestEntry> ReadManifestUnlocked()
    {
        try
        {
            if (!File.Exists(_manifestPath))
                return new Dictionary<string, ManifestEntry>(StringComparer.OrdinalIgnoreCase);
            var json = File.ReadAllText(_manifestPath);
            var map = JsonSerializer.Deserialize<Dictionary<string, ManifestEntry>>(json, JsonOpts);
            return map is null
                ? new Dictionary<string, ManifestEntry>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, ManifestEntry>(map, StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new Dictionary<string, ManifestEntry>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private void WriteManifestUnlocked(Dictionary<string, ManifestEntry> map)
    {
        Directory.CreateDirectory(_root);
        var json = JsonSerializer.Serialize(map, JsonOpts);
        var tmp = _manifestPath + ".tmp";
        File.WriteAllText(tmp, json);
        File.Copy(tmp, _manifestPath, overwrite: true);
        try { File.Delete(tmp); } catch { /* ignore */ }
    }

    private sealed class ManifestEntry
    {
        public string? Version { get; set; }
        public string? FileName { get; set; }
        public long SizeBytes { get; set; }
        public string? UpdatedAtUtc { get; set; }
        public string? ContentType { get; set; }
    }
}
