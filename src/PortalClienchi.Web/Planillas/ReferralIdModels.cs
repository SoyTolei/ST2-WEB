namespace PortalClienchi.Web.Planillas;

public sealed class ReferralIdCase
{
    public PlanillasSistema Sistema { get; init; }
    public string Version { get; set; } = ReferralIdConstants.PlaceholderVersion;
    public string Modulo { get; set; } = ReferralIdConstants.PlaceholderModulo;
    public string Collation { get; set; } = ReferralIdConstants.PlaceholderCollation;
    public string SqlServer { get; set; } = ReferralIdConstants.PlaceholderSqlServer;
    public string Asunto { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string PasoAPaso { get; set; } = "";
    public MamState Mam { get; } = new();
    public SdkState Sdk { get; } = new();
    public PlanillaTecnicaState Planilla { get; } = new();
    public OnvioReferralState Onvio { get; } = new();
    public AdjuntosState Adjuntos { get; } = new();
    public IReadOnlyList<TransferenciaCapturaEnlace> CapturasEnlaces { get; set; } = Array.Empty<TransferenciaCapturaEnlace>();
    public bool MamConfigured => Mam.HasSelection;
    public bool SdkConfigured => Sdk.HasSelection;
    public bool PlanillaConfigured => Planilla.IsComplete;
    public bool RequiresCollationSql =>
        Sistema == PlanillasSistema.BejermanSql &&
        Adjuntos.BackupBases &&
        (Adjuntos.BackupManager || Adjuntos.BackupSbda || Adjuntos.BackupCg || Adjuntos.BackupSj);
}

public sealed class MamState
{
    public Dictionary<string, bool> Selections { get; } =
        ReferralIdConstants.MamOpciones.ToDictionary(o => o, _ => false);
    public string PersActuNombre { get; set; } = "";
    public string TriggersDesactivados { get; set; } = "";
    public bool HasSelection => Selections.Values.Any(v => v);
}

public sealed class SdkState
{
    public Dictionary<string, bool> Selections { get; } =
        ReferralIdConstants.SdkOpciones.ToDictionary(o => o, _ => false);
    public string AplicacionIntegracion { get; set; } = "";
    public bool HasSelection => Selections.Values.Any(v => v);
}

public sealed class PlanillaTecnicaState
{
    public bool Relevada { get; set; }
    public bool ProcesoFuncionaba { get; set; }
    public bool ReproduceError { get; set; }
    public bool UltimaActualizOk { get; set; }
    public bool OptVinculos { get; set; }
    public bool OptBaseModelo { get; set; }
    public bool OptSoloCliente { get; set; }
    public bool OptReproduceSistematicamente { get; set; }
    public bool IsComplete => Relevada && ProcesoFuncionaba && ReproduceError && UltimaActualizOk;
}

public sealed class OnvioReferralState
{
    public bool ProcesoFuncionaba { get; set; }
    public bool ReproduceSistematicamente { get; set; }
    public bool HayTicket { get; set; }
    public string NumeroTicket { get; set; } = "";
    public string Tecnico { get; set; } = "";
    public bool ReproduceConTicket { get; set; }
    public bool ReproduceEmpresaPrueba { get; set; }
    public bool AdjuntaPantallas { get; set; }
    public string UsuarioContador { get; set; } = "";
    public string Empresa { get; set; } = "";
    public bool TicketAvisoOmitido { get; set; }
}

public sealed class AdjuntosState
{
    public bool Pantallas { get; set; }
    public bool TrazaSql { get; set; }
    public bool BackupBases { get; set; }
    public bool BackupManager { get; set; }
    public bool BackupSbda { get; set; }
    public bool BackupCg { get; set; }
    public bool BackupSj { get; set; }
}

public sealed class ReferralGenerateRequest
{
    public string Sistema { get; set; } = "";
    public string Version { get; set; } = "";
    public string Modulo { get; set; } = "";
    public string Collation { get; set; } = "";
    public string SqlServer { get; set; } = "";
    public string Asunto { get; set; } = "";
    public string? Descripcion { get; set; }
    public string? PasoAPaso { get; set; }
    public Dictionary<string, bool>? MamSelections { get; set; }
    public string? MamPersActuNombre { get; set; }
    public string? MamTriggersDesactivados { get; set; }
    public Dictionary<string, bool>? SdkSelections { get; set; }
    public string? SdkAplicacionIntegracion { get; set; }
    public PlanillaTecnicaDto? Planilla { get; set; }
    public OnvioReferralDto? Onvio { get; set; }
    public AdjuntosDto? Adjuntos { get; set; }
    public List<CapturaEnlaceDto>? CapturasEnlaces { get; set; }
    public bool TicketAvisoOmitido { get; set; }
}

public sealed class PlanillaTecnicaDto
{
    public bool Relevada { get; set; }
    public bool ProcesoFuncionaba { get; set; }
    public bool ReproduceError { get; set; }
    public bool UltimaActualizOk { get; set; }
    public bool OptVinculos { get; set; }
    public bool OptBaseModelo { get; set; }
    public bool OptSoloCliente { get; set; }
    public bool OptReproduceSistematicamente { get; set; }
}

public sealed class OnvioReferralDto
{
    public bool ProcesoFuncionaba { get; set; }
    public bool ReproduceSistematicamente { get; set; }
    public bool HayTicket { get; set; }
    public string? NumeroTicket { get; set; }
    public string? Tecnico { get; set; }
    public bool ReproduceConTicket { get; set; }
    public bool ReproduceEmpresaPrueba { get; set; }
    public bool AdjuntaPantallas { get; set; }
    public string? UsuarioContador { get; set; }
    public string? Empresa { get; set; }
}

public sealed class AdjuntosDto
{
    public bool Pantallas { get; set; }
    public bool TrazaSql { get; set; }
    public bool BackupBases { get; set; }
    public bool BackupManager { get; set; }
    public bool BackupSbda { get; set; }
    public bool BackupCg { get; set; }
    public bool BackupSj { get; set; }
}

public sealed class ReferralMejorarRequest
{
    public ReferralGenerateRequest Form { get; set; } = new();
}

public sealed class OportunidadCargaRequest
{
    public string Sistema { get; set; } = "";
    public string MetodoContacto { get; set; } = "NINGUNO";
    public string NumeroCliente { get; set; } = "";
    public string RazonSocial { get; set; } = "";
    public string NombreContacto { get; set; } = "";
    public string Telefono { get; set; } = "";
    public string? Correo { get; set; }
    public string Horarios { get; set; } = "";
    public string Descripcion { get; set; } = "";
}

public sealed class OportunidadRecordDto
{
    public int Id { get; set; }
    public string Fecha { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string Link { get; set; } = "";
    public bool Confirmada { get; set; }
    public string Porcentaje { get; set; } = "N/D";
}

public sealed class OportunidadUpsertRequest
{
    public string Fecha { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string Link { get; set; } = "";
    public bool Confirmada { get; set; }
    public string? Porcentaje { get; set; }
}
