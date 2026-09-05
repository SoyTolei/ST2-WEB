using SkiaSharp;

namespace PortalClienchi.Web.PortalPdf;

/// <summary>
/// Generador de alta resolución del logotipo corporativo de Thomson Reuters (vectorizado con SkiaSharp).
/// Proporciona versiones bimodales (para hoja clara con texto grafito y para hoja oscura con texto blanco puro),
/// libres de ruido, con transparencia alfa perfecta y aspecto horizontal estándar 5:1.
/// </summary>
public static class PortalPdfLogoGenerator
{
    private static byte[]? _lightCache;
    private static byte[]? _darkCache;

    public static byte[] GetLogoBytes(bool isDark)
    {
        if (isDark && _darkCache != null) return _darkCache;
        if (!isDark && _lightCache != null) return _lightCache;

        var bytes = RenderLogoPng(isDark);
        if (isDark) _darkCache = bytes;
        else _lightCache = bytes;

        return bytes;
    }

    public static byte[] RenderLogoPng(bool isDark)
    {
        const int width = 700;
        const int height = 140;
        using var surface = SKSurface.Create(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul));
        var canvas = surface.Canvas;
        canvas.Clear(SKColors.Transparent);

        var orange = SKColor.Parse("#F36C00");
        using var dotPaint = new SKPaint
        {
            Color = orange,
            IsAntialias = true,
            Style = SKPaintStyle.Fill
        };

        const float scale = 2.0f;
        const float cx = 35f * scale;
        const float cy = 35f * scale;

        // Punto central
        canvas.DrawCircle(cx, cy, 2.5f * scale, dotPaint);

        // Anillo 1 (6 puntos)
        for (var i = 0; i < 6; i++)
        {
            var angle = (float)(i * 2 * Math.PI / 6);
            var x = cx + 7.5f * scale * MathF.Cos(angle);
            var y = cy + 7.5f * scale * MathF.Sin(angle);
            canvas.DrawCircle(x, y, 2.0f * scale, dotPaint);
        }

        // Anillo 2 (12 puntos)
        for (var i = 0; i < 12; i++)
        {
            var angle = (float)(i * 2 * Math.PI / 12 + 0.15);
            var x = cx + 14.5f * scale * MathF.Cos(angle);
            var y = cy + 14.5f * scale * MathF.Sin(angle);
            canvas.DrawCircle(x, y, 2.3f * scale, dotPaint);
        }

        // Anillo 3 (18 puntos)
        for (var i = 0; i < 18; i++)
        {
            var angle = (float)(i * 2 * Math.PI / 18 + 0.3);
            var x = cx + 21.5f * scale * MathF.Cos(angle);
            var y = cy + 21.5f * scale * MathF.Sin(angle);
            canvas.DrawCircle(x, y, 2.6f * scale, dotPaint);
        }

        // Anillo 4 (24 puntos)
        for (var i = 0; i < 24; i++)
        {
            var angle = (float)(i * 2 * Math.PI / 24 + 0.45);
            var x = cx + 28.5f * scale * MathF.Cos(angle);
            var y = cy + 28.5f * scale * MathF.Sin(angle);
            canvas.DrawCircle(x, y, 2.9f * scale, dotPaint);
        }

        // Texto secundario: "the answer company™"
        using var subPaint = new SKPaint
        {
            Color = isDark ? SKColor.Parse("#FB923C") : SKColor.Parse("#E05A10"),
            IsAntialias = true,
            TextSize = 11.5f * scale,
            Typeface = SKTypeface.FromFamilyName("Arial", SKFontStyleWeight.SemiBold, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright)
        };
        canvas.DrawText("the answer company™", 76f * scale, 27f * scale, subPaint);

        // Texto principal: "THOMSON REUTERS"
        using var mainPaint = new SKPaint
        {
            Color = isDark ? SKColors.White : SKColor.Parse("#1E293B"),
            IsAntialias = true,
            TextSize = 22f * scale,
            Typeface = SKTypeface.FromFamilyName("Arial", SKFontStyleWeight.Bold, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright)
        };
        canvas.DrawText("THOMSON REUTERS", 76f * scale, 53f * scale, mainPaint);

        using var image = surface.Snapshot();
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    /// <summary>
    /// Guarda los archivos PNG bimodales en la ruta web si es necesario.
    /// </summary>
    public static void EnsureFilesWritten(string webRootPath)
    {
        try
        {
            var imgDir = Path.Combine(webRootPath, "img");
            if (!Directory.Exists(imgDir)) Directory.CreateDirectory(imgDir);

            var lightFile = Path.Combine(imgDir, "thomson-reuters-logo.png");
            var darkFile = Path.Combine(imgDir, "thomson-reuters-logo-dark.png");

            File.WriteAllBytes(lightFile, GetLogoBytes(false));
            File.WriteAllBytes(darkFile, GetLogoBytes(true));
        }
        catch { /* ignore */ }
    }
}
