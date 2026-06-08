namespace PortalClienchi.Web.Planillas;

public static class ReferralIdConstants
{
    public const string PlaceholderVersion = "Indique versión";
    public const string PlaceholderModulo = "Indique módulo...";
    public const string PlaceholderCollation = "Indique Collation";
    public const string PlaceholderSqlServer = "Indique versión de SQL Server";
    public const string PlaceholderDescripcion = "Detalle y/o descripción del caso";
    public const string PlaceholderPasoAPaso = "Detalle paso a paso del proceso realizado por el usuario";

    public static readonly string[] Versiones = ["8.71", "8.80"];
    public static readonly string[] Modulos = ["e-Flexware", "Contabilidad General", "Sueldos y Jornales", "Queries"];
    public static readonly string[] Collations = ["Modern_Spanish_CI_AS", "Latin1_General_CI_AS"];
    public static readonly string[] SqlServerVersions =
    [
        "SQL Server 2005", "SQL Server 2008", "SQL Server 2008 R2", "SQL Server 2012",
        "SQL Server 2014", "SQL Server 2016", "SQL Server 2017", "SQL Server 2019", "SQL Server 2022",
    ];

    public static readonly string[] MamOpciones =
    [
        "RPT a medida",
        "Nombre de la PERS/ACTU a medida.",
        "Tiene triggers",
        "No utiliza MAM",
    ];

    public static readonly string[] SdkOpciones =
    [
        "Se validaron las .dll de SDK",
        "Se validaron los archivos del importador",
        "Se reinicio el IIS",
        "Se adjunta .JSON",
        "No utiliza SDK",
    ];

    public const string TriggersConsultarEstado = """
        -- CONSULTAR TRIGGERS Y SU ESTADO
        -- Lista cada trigger de usuario con su tabla y si esta habilitado o no.
        -- Columna IsDisabled => 0 = HABILITADO, 1 = DESHABILITADO.
        SELECT
            t.name AS TriggerName,
            OBJECT_NAME(t.parent_id) AS TableName,
            s.name AS SchemaName,
            t.is_disabled AS IsDisabled,
            t.create_date,
            t.modify_date
        FROM sys.triggers t
        INNER JOIN sys.tables tbl ON t.parent_id = tbl.object_id
        INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
        WHERE t.is_ms_shipped = 0
        ORDER BY TableName, TriggerName;
        """;

    public const string TriggersTablasConTriggers = """
        -- TABLAS CON TRIGGERS EN LA BASE
        -- Resumen por tabla: esquema, nombre y cantidad de triggers (habilitados / deshabilitados).
        SELECT
            s.name AS SchemaName,
            t.name AS TableName,
            COUNT(tr.object_id) AS TotalTriggers,
            SUM(CASE WHEN tr.is_disabled = 0 THEN 1 ELSE 0 END) AS Habilitados,
            SUM(CASE WHEN tr.is_disabled = 1 THEN 1 ELSE 0 END) AS Deshabilitados
        FROM sys.triggers tr
        INNER JOIN sys.tables t ON tr.parent_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE tr.is_ms_shipped = 0
        GROUP BY s.name, t.name
        ORDER BY TableName;
        """;

    public const string TriggersDeshabilitar = """
        /* DESHABILITAR -------------------------------------------------------------
           El resultado son las sentencias para DESHABILITAR todos los triggers,
           sin necesidad de borrarlos. Copiá las columnas del resultado (a + TABLA + b),
           pegalas en una nueva consulta y ejecutalas. */
        select
        'ALTER TABLE ' as a,
        TABLA = LTRIM(RTRIM(SO.name)),
        'DISABLE TRIGGER ALL ' as b
        from sysobjects as SO
        left join sysobjects as SOdel on SO.deltrig = SOdel.id
        left join sysobjects as SOins on SO.instrig = SOins.id
        left join sysobjects as SOupd on SO.updtrig = SOupd.id
        left join sysobjects as SOsel on SO.seltrig = SOsel.id
        where (SO.deltrig <> 0 or SO.instrig <> 0 or SO.updtrig <> 0 or SO.seltrig <> 0)
        and SO.xtype <> 'TR';
        """;

    public const string TriggersHabilitar = """
        /* HABILITAR ----------------------------------------------------------------
           El resultado son las sentencias para HABILITAR todos los triggers
           que se habian deshabilitado. Copiá las columnas del resultado (a + TABLA + b),
           pegalas en una nueva consulta y ejecutalas. */
        select
        'ALTER TABLE ' as a,
        TABLA = LTRIM(RTRIM(SO.name)),
        'ENABLE TRIGGER ALL ' as b
        from sysobjects as SO
        left join sysobjects as SOdel on SO.deltrig = SOdel.id
        left join sysobjects as SOins on SO.instrig = SOins.id
        left join sysobjects as SOupd on SO.updtrig = SOupd.id
        left join sysobjects as SOsel on SO.seltrig = SOsel.id
        where (SO.deltrig <> 0 or SO.instrig <> 0 or SO.updtrig <> 0 or SO.seltrig <> 0)
        and SO.xtype <> 'TR';
        """;
}
