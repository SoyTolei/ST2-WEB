namespace PortalClienchi.Web;

/// <summary>
/// Evita que Cloudflare / proxies cacheen respuestas que llevan el SHA del deploy.
/// Si el HTML es fresco y /api/version queda viejo, el cliente cree que hay update eterno.
/// </summary>
public static class St2HttpCache
{
    public static void NoStore(HttpContext ctx)
    {
        var headers = ctx.Response.Headers;
        headers.CacheControl = "no-store, no-cache, must-revalidate";
        headers.Pragma = "no-cache";
        headers.Expires = "0";
        headers["CDN-Cache-Control"] = "no-store";
        headers["Cloudflare-CDN-Cache-Control"] = "no-store";
    }
}
