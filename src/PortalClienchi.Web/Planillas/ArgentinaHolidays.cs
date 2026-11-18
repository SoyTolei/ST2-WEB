namespace PortalClienchi.Web.Planillas;

/// <summary>
/// Feriados nacionales y días no laborables con fines turísticos (puentes).
/// 2026 sale del calendario oficial y de la Resolución 164/2025.
/// </summary>
internal static class ArgentinaHolidays
{
    private static readonly Dictionary<DateOnly, string> Named = new()
    {
        [new(2026, 3, 23)] = "Puente turístico",
        [new(2026, 7, 10)] = "Puente turístico",
        [new(2026, 11, 9)] = "Visita del Papa León XIV",
        [new(2026, 12, 7)] = "Puente turístico",
    };

    internal static bool IsHoliday(DateOnly date) => TryGetName(date, out _);

    internal static bool TryGetName(DateOnly date, out string name)
    {
        if (Named.TryGetValue(date, out name!))
            return true;

        if (date.Month == 1 && date.Day == 1)
        {
            name = "Año Nuevo";
            return true;
        }

        if (date.Month == 3 && date.Day == 24)
        {
            name = "Día de la Memoria";
            return true;
        }

        if (date.Month == 4 && date.Day == 2)
        {
            name = "Día del Veterano y de los Caídos en Malvinas";
            return true;
        }

        if (date.Month == 5 && date.Day == 1)
        {
            name = "Día del Trabajador";
            return true;
        }

        if (date.Month == 5 && date.Day == 25)
        {
            name = "Día de la Revolución de Mayo";
            return true;
        }

        if (date.Month == 7 && date.Day == 9)
        {
            name = "Día de la Independencia";
            return true;
        }

        if (date.Month == 12 && date.Day == 8)
        {
            name = "Inmaculada Concepción";
            return true;
        }

        if (date.Month == 12 && date.Day == 25)
        {
            name = "Navidad";
            return true;
        }

        var easter = EasterSunday(date.Year);
        if (date == easter.AddDays(-2))
        {
            name = "Viernes Santo";
            return true;
        }

        if (date == easter.AddDays(-48) || date == easter.AddDays(-47))
        {
            name = "Carnaval";
            return true;
        }

        if (date == ObservedMonday(date.Year, 6, 17)
            || date == ObservedMonday(date.Year, 8, 17)
            || date == ObservedMonday(date.Year, 10, 12)
            || date == ObservedMonday(date.Year, 11, 20))
        {
            name = date.Month switch
            {
                6 => "Paso a la Inmortalidad del General Güemes",
                8 => "Paso a la Inmortalidad del General San Martín",
                10 => "Día del Respeto a la Diversidad Cultural",
                _ => "Día de la Soberanía Nacional",
            };
            return true;
        }

        name = "";
        return false;
    }

    /// <summary>Ley 27.399: martes y miércoles van al lunes anterior; jueves y viernes, al lunes siguiente.</summary>
    private static DateOnly ObservedMonday(int year, int month, int day)
    {
        var date = new DateOnly(year, month, day);
        return date.DayOfWeek switch
        {
            DayOfWeek.Tuesday => date.AddDays(-1),
            DayOfWeek.Wednesday => date.AddDays(-2),
            DayOfWeek.Thursday => date.AddDays(4),
            DayOfWeek.Friday => date.AddDays(3),
            _ => date,
        };
    }

    private static DateOnly EasterSunday(int year)
    {
        var a = year % 19;
        var b = year / 100;
        var c = year % 100;
        var d = b / 4;
        var e = b % 4;
        var f = (b + 8) / 25;
        var g = (b - f + 1) / 3;
        var h = (19 * a + b - d - g + 15) % 30;
        var i = c / 4;
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = (a + 11 * h + 22 * l) / 451;
        var month = (h + l - 7 * m + 114) / 31;
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return new DateOnly(year, month, day);
    }
}
