using PortalClienchi.Core.Models;
using PortalClienchi.Core.Utilities;

namespace PortalClienchi.Core.Services;

public static class SearchResultOrganizer
{
    public static List<SearchDisplayItem> Organize(IReadOnlyList<SearchResult> results)
    {
        if (results.Count == 0)
            return [];

        foreach (var r in results)
        {
            if (r.SortYear == 0)
            {
                var fix = TopicYearHelper.Resolve(r.Title, htmlOrText: r.Snippet);
                r.ApplyYearResolution(fix);
            }
            r.GroupKey = TopicYearHelper.NormalizeTopicKey(r.Title);
            r.GroupTitle = TopicYearHelper.BuildGroupTitle(r.Title);
        }

        var output = new List<SearchDisplayItem>();

        var groups = results
            .GroupBy(r => r.GroupKey)
            .OrderByDescending(g => g.Any(x => TopicYearHelper.IsPlausibleYear(x.SortYear)))
            .ThenByDescending(g => g.Where(x => TopicYearHelper.IsPlausibleYear(x.SortYear)).Select(x => x.SortYear).DefaultIfEmpty(0).Max())
            .ThenBy(g => g.First().GroupTitle, StringComparer.OrdinalIgnoreCase);

        foreach (var group in groups)
        {
            var versions = group
                .OrderByDescending(r => TopicYearHelper.IsPlausibleYear(r.SortYear))
                .ThenByDescending(r => TopicYearHelper.IsPlausibleDate(r.PublishedAt) ? r.PublishedAt : null)
                .ThenByDescending(r => TopicYearHelper.IsPlausibleYear(r.SortYear) ? r.SortYear : 0)
                .ThenByDescending(r => r.Id)
                .ToList();

            if (versions.Count > 1)
            {
                var yearsLabel = TopicYearHelper.FormatYearsLabel(versions.Select(v => v.Year));
                var headerTitle = versions[0].GroupTitle;
                output.Add(SearchDisplayItem.Header(
                    $"{headerTitle}",
                    $"{versions.Count} versiones · {yearsLabel}"));

                foreach (var v in versions)
                {
                    v.IsVersionOfGroup = true;
                    output.Add(SearchDisplayItem.Row(v, indented: true));
                }
            }
            else
            {
                output.Add(SearchDisplayItem.Row(versions[0], indented: false));
            }
        }

        return output;
    }
}
