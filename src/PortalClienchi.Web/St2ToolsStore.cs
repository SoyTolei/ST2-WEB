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
        ".zip", ".7z", ".rar", ".exe", ".msi", ".bat", ".cmd", ".ps1", ".bin",
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
        long length;
        try
        {
            length = new FileInfo(probe).Length;
        }
        finally
        {
            try { File.Delete(probe); } catch { /* ignore */ }
        }
        return $"write-ok size={length} root={_root}";
    }

    public string BeginPartUpload(string toolId, string uploadId, int totalParts)
    {
        if (!TryNormalizeId(toolId, out var id))
            throw new ArgumentException("Herramienta inválida. Usá sql o bat.");
        if (totalParts is < 1 or > 10000)
            throw new ArgumentException("Cantidad de partes inválida.");

        var session = SanitizeUploadId(uploadId);
        EnsureRoot();
        var dir = Path.Combine(_root, id, ".parts", session);
        if (Directory.Exists(dir))
            Directory.Delete(dir, recursive: true);
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "meta.txt"), $"total={totalParts}\n");
        return session;
    }

    public void SavePart(string toolId, string uploadId, int index, int totalParts, byte[] payload)
    {
        if (!TryNormalizeId(toolId, out var id))
            throw new ArgumentException("Herramienta inválida. Usá sql o bat.");
        if (index < 0 || index >= totalParts)
            throw new ArgumentException("Índice de parte inválido.");
        if (payload is null || payload.Length == 0)
            throw new ArgumentException("Parte vacía.");
        if (payload.Length > 96 * 1024)
            throw new ArgumentException("Parte demasiado grande.");

        var session = SanitizeUploadId(uploadId);
        var dir = Path.Combine(_root, id, ".parts", session);
        if (!Directory.Exists(dir))
            throw new InvalidOperationException("Sesión de subida no iniciada.");

        var path = Path.Combine(dir, $"{index:D5}.part");
        File.WriteAllBytes(path, payload);
    }

    public async Task<St2ToolPackageDto> CommitPartsAsync(
        string toolId,
        string uploadId,
        int totalParts,
        string originalFileName,
        string? version,
        bool xor,
        byte xorKey,
        CancellationToken ct = default)
    {
        if (!TryNormalizeId(toolId, out var id))
            throw new ArgumentException("Herramienta inválida. Usá sql o bat.");

        var session = SanitizeUploadId(uploadId);
        var dir = Path.Combine(_root, id, ".parts", session);
        if (!Directory.Exists(dir))
            throw new InvalidOperationException("Sesión de subida no encontrada.");

        await using var ms = new MemoryStream();
        for (var i = 0; i < totalParts; i++)
        {
            ct.ThrowIfCancellationRequested();
            var partPath = Path.Combine(dir, $"{i:D5}.part");
            if (!File.Exists(partPath))
                throw new InvalidOperationException($"Falta la parte {i + 1}/{totalParts}.");
            var bytes = await File.ReadAllBytesAsync(partPath, ct).ConfigureAwait(false);
            await ms.WriteAsync(bytes, ct).ConfigureAwait(false);
        }

        var data = ms.ToArray();
        if (xor)
        {
            for (var i = 0; i < data.Length; i++)
                data[i] ^= xorKey;
        }

        try
        {
            await using var input = new MemoryStream(data, writable: false);
            return await SaveStreamAsync(toolId, originalFileName, input, version, data.Length, ct)
                .ConfigureAwait(false);
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch { /* ignore */ }
        }
    }

    private static string SanitizeUploadId(string uploadId)
    {
        var raw = (uploadId ?? "").Trim().ToLowerInvariant();
        if (raw.Length is < 8 or > 64)
            throw new ArgumentException("Id de subida inválido.");
        foreach (var c in raw)
        {
            if (c is (>= 'a' and <= 'z') or (>= '0' and <= '9'))
                continue;
            throw new ArgumentException("Id de subida inválido.");
        }
        return raw;
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
            if (!File.Exists(_lastErrorPath))
                return null;
            var text = File.ReadAllText(_lastErrorPath);
            if (string.IsNullOrWhiteSpace(text))
                return null;
            // Evitar romper el JSON del listado si el archivo quedó corrupto/enorme.
            var clean = new string(text.Where(ch => !char.IsControl(ch) || ch is '\n' or '\r' or '\t').ToArray());
            return clean.Length > 4000 ? clean[..4000] + "…" : clean;
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

    public async Task<St2ToolPackageDto> SaveStreamAsync(
        string toolId,
        string originalFileName,
        Stream content,
        string? version,
        long declaredLength,
        CancellationToken ct = default)
    {
        if (!TryNormalizeId(toolId, out var id))
            throw new ArgumentException("Herramienta inválida. Usá sql o bat.");

        var safeName = SanitizeFileName(originalFileName);
        var ext = Path.GetExtension(safeName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            throw new ArgumentException(
                $"Formato no permitido ({safeName}). Usá zip, 7z, rar, exe, msi, bat, cmd, ps1 o bin.");

        var ver = string.IsNullOrWhiteSpace(version)
            ? DateTime.UtcNow.ToString("yyyy.MM.dd")
            : version.Trim();
        if (ver.Length > 40)
            throw new ArgumentException("La versión es demasiado larga.");

        // Nombre estable por herramienta (evita caracteres raros del original)
        var finalName = $"st2-{id}{ext.ToLowerInvariant()}";

        EnsureRoot();
        var toolDir = Path.Combine(_root, id);
        Directory.CreateDirectory(toolDir);

        var tmpPath = Path.Combine(toolDir, $".upload-{Guid.NewGuid():N}.partial");
        var destPath = Path.Combine(toolDir, finalName);

        try
        {
            long written;
            await using (var fs = new FileStream(
                             tmpPath,
                             FileMode.Create,
                             FileAccess.Write,
                             FileShare.None,
                             64 * 1024,
                             FileOptions.Asynchronous | FileOptions.SequentialScan))
            {
                await content.CopyToAsync(fs, ct).ConfigureAwait(false);
                await fs.FlushAsync(ct).ConfigureAwait(false);
                written = fs.Length;
            }

            if (written <= 0 && declaredLength <= 0)
                throw new InvalidOperationException("El archivo llegó vacío.");
            if (written <= 0)
                written = declaredLength;
            if (written > 120L * 1024 * 1024)
                throw new InvalidOperationException("El archivo supera el máximo de 120 MB.");

            // Reemplazo atómico-ish: copiar y borrar temp (sin File.Move ni FileInfo.Length tardío)
            File.Copy(tmpPath, destPath, overwrite: true);
            try { File.Delete(tmpPath); } catch { /* ignore */ }

            // Limpiar otros archivos viejos del tool
            foreach (var old in Directory.EnumerateFiles(toolDir))
            {
                var name = Path.GetFileName(old);
                if (string.Equals(name, finalName, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (name.StartsWith(".", StringComparison.Ordinal))
                {
                    try { File.Delete(old); } catch { /* ignore */ }
                    continue;
                }
                try { File.Delete(old); } catch { /* ignore */ }
            }

            lock (_gate)
            {
                var map = ReadManifestUnlocked();
                map[id] = new ManifestEntry
                {
                    Version = ver,
                    FileName = finalName,
                    SizeBytes = written,
                    UpdatedAtUtc = DateTime.UtcNow.ToString("o"),
                    ContentType = GuessContentType(ext),
                };
                WriteManifestUnlocked(map);
                return ToDto(id, map[id]);
            }
        }
        finally
        {
            try { if (File.Exists(tmpPath)) File.Delete(tmpPath); } catch { /* ignore */ }
        }
    }

    public St2ToolPackageDto CommitTempFile(string toolId, string tmpPath, string originalFileName, string? version, long sizeBytes)
    {
        // Compat: reusa SaveStreamAsync vía FileStream
        using var fs = new FileStream(tmpPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return SaveStreamAsync(toolId, originalFileName, fs, version, sizeBytes)
            .GetAwaiter()
            .GetResult();
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
        ".bin" => "application/octet-stream",
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
