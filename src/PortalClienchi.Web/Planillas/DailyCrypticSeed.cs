using System.Globalization;
using System.Text;

namespace PortalClienchi.Web.Planillas;

internal sealed record DailyCrypticSeedEntry(
    string Clue,
    string Answer,
    string Enumeration,
    string Definition,
    string Wordplay,
    string Mechanism,
    string Indicator,
    string Fodder,
    string Parse,
    int Difficulty,
    string[] AcceptedAnswers);

internal static class DailyCrypticSeed
{
    internal const int ProgressiveFrom = 97;
    internal static readonly DateOnly ProgressiveStartsOn = new(2026, 10, 27);

    internal static IReadOnlyList<DailyCrypticSeedEntry> Items { get; } =
    [
        // Dificultad 1: mecanismos directos.
        S("Infusión de tema revuelto (4)", "MATE", "Infusión", "Anagrama", "revuelto", "TEMA", "TEMA*", 1),
        S("Sentimiento de Roma desordenada (4)", "AMOR", "Sentimiento", "Anagrama", "desordenada", "ROMA", "ROMA*", 1),
        S("Paño que late alborotado (4)", "TELA", "Paño", "Anagrama", "alborotado", "LATE", "LATE*", 1),
        S("Comida cuando el paso se desarma (4)", "SOPA", "Comida", "Anagrama", "se desarma", "PASO", "PASO*", 1),
        S("Curva de roca quebrada (4)", "ARCO", "Curva", "Anagrama", "quebrada", "ROCA", "ROCA*", 1),
        S("Satélite de nula revuelta (4)", "LUNA", "Satélite", "Anagrama", "revuelta", "NULA", "NULA*", 1),
        S("Ave que topa trastornada (4)", "PATO", "Ave", "Anagrama", "trastornada", "TOPA", "TOPA*", 1),
        S("Película de cien mezclado (4)", "CINE", "Película", "Anagrama", "mezclado", "CIEN", "CIEN*", 1),
        S("Nubosidad: buen revuelto (4)", "NUBE", "Nubosidad", "Anagrama", "revuelto", "BUEN", "BUEN*", 1),
        S("Ambiente interior de lonas desordenadas (5)", "SALÓN", "Ambiente interior", "Anagrama", "desordenadas", "LONAS", "LONAS*", 1),
        S("Superficie escondida cuando tomés algo (4)", "MESA", "Superficie", "Oculta", "escondida", "toMES Algo", "to[MESA]lgo", 1),
        S("Refugio escondido en lo venido ayer (4)", "NIDO", "Refugio", "Oculta", "escondido", "veNIDO", "ve[NIDO]", 1),
        S("Alegría contenida en brisas nuevas (4)", "RISA", "Alegría", "Oculta", "contenida", "bRISAs", "b[RISA]s", 1),
        S("Ave escondida: sepa todo antes (4)", "PATO", "Ave", "Oculta", "escondida", "sePA TOdo", "se[PA TO]do", 1),
        S("Agua quieta guardada en la golondrina (4)", "LAGO", "Agua quieta", "Oculta", "guardada", "LA GOlondrina", "[LA GO]londrina", 1),
        S("Ciudad que vuelve amor (4)", "ROMA", "Ciudad", "Reverso", "vuelve", "AMOR", "AMOR<", 1),
        S("Sujetar cuando retrocede: rata (4)", "ATAR", "Sujetar", "Reverso", "retrocede", "RATA", "RATA<", 1),
        S("Bolsa que devuelven las ocas (4)", "SACO", "Bolsa", "Reverso", "devuelven", "OCAS", "OCAS<", 1),
        S("Interpretar un reel al revés (4)", "LEER", "Interpretar", "Reverso", "al revés", "REEL", "REEL<", 1),
        S("Condimento que las de vuelta (3)", "SAL", "Condimento", "Reverso", "de vuelta", "LAS", "LAS<", 1),
        S("Infusión: primeras de Mientras Alcanza Todo Eso (4)", "MATE", "Infusión", "Iniciales", "primeras", "Mientras Alcanza Todo Eso", "M+A+T+E", 1),
        S("Roedor: primeras de Ronda Argentina Tras Otra Noche (5)", "RATÓN", "Roedor", "Iniciales", "primeras", "Ronda Argentina Tras Otra Noche", "R+A+T+O+N", 1),
        S("Astro en las últimas de mes, canto y papel (3)", "SOL", "Astro", "Finales", "últimas", "meS cantO papeL", "S+O+L", 1),
        S("Bebida: comienzos de Vuelvo Inmediatamente, No Olvido (4)", "VINO", "Bebida", "Iniciales", "comienzos", "Vuelvo Inmediatamente No Olvido", "V+I+N+O", 1),
        S("Felino: finales de zigzag, ruta, cénit y gesto (4)", "GATO", "Felino", "Finales", "finales", "zigzaG rutA céniT gestO", "G+A+T+O", 1),
        S("Asiento o entidad financiera (5)", "BANCO", "Asiento / entidad financiera", "Doble definición", "o", "asiento; entidad financiera", "BANCO / BANCO", 1),
        S("Felino o herramienta para levantar el auto (4)", "GATO", "Felino / herramienta", "Doble definición", "o", "felino; herramienta", "GATO / GATO", 1),
        S("Vegetal o fábrica industrial (6)", "PLANTA", "Vegetal / fábrica", "Doble definición", "o", "vegetal; fábrica", "PLANTA / PLANTA", 1),
        S("Guardó silencio, según se oye que cayó (5)", "CALLÓ", "Guardó silencio", "Homófono rioplatense", "según se oye", "CAYÓ", "CAYÓ~ (yeísmo)", 1, "CALLO"),
        S("Cerca, según se oye, que vaya (5)", "VALLA", "Cerca", "Homófono rioplatense", "según se oye", "VAYA", "VAYA~ (yeísmo)", 1),

        // Dificultad 2: contenedores, sustracciones y charadas.
        S("Magnitud: «es» entre extremos de patio (4)", "PESO", "Magnitud", "Contenedor", "entre extremos", "P(atio)O + ES", "P(ES)O", 2),
        S("Ensenada con «al» dentro de extremos de casa (4)", "CALA", "Ensenada", "Contenedor", "dentro de extremos", "C(as)A + AL", "C(AL)A", 2),
        S("Anfibio: inicio de abril y norte en extremos de rama (4)", "RANA", "Anfibio", "Contenedor", "inicio ... y ... en extremos", "R(am)A + A(bril) + N", "R(AN)A", 2),
        S("Envase con «at» entre extremos de larga (4)", "LATA", "Envase", "Contenedor", "entre extremos", "L(arg)A + AT", "L(AT)A", 2),
        S("Infusión con «at» en extremos de monte (4)", "MATE", "Infusión", "Contenedor", "en extremos", "M(ont)E + AT", "M(AT)E", 2),
        S("Signo con «om» entre extremos de cama (4)", "COMA", "Signo", "Contenedor", "entre extremos", "C(am)A + OM", "C(OM)A", 2),
        S("Utensilio con arte entre extremos de salón (6)", "SARTÉN", "Utensilio", "Contenedor", "entre extremos", "S(aló)N + ARTE", "S(ARTE)N", 2),
        S("Espacio verde con «ardió» sin final dentro de extremos de joven (6)", "JARDÍN", "Espacio verde", "Contenedor + sustracción", "sin final ... dentro de extremos", "J(ove)N + ARDIÓ - O", "J(ARDI)N", 2),
        S("Pieza de vajilla: planto sin norte (5)", "PLATO", "Pieza de vajilla", "Sustracción", "sin norte", "PLANTO - N", "PLANTO-N", 2),
        S("Orilla de actos revueltos (5)", "COSTA", "Orilla", "Anagrama", "revueltos", "ACTOS", "ACTOS*", 2),
        S("Fruta de perla sin litro (4)", "PERA", "Fruta", "Sustracción", "sin litro", "PERLA - L", "PERLA-L", 2),
        S("Mueble cuando ames sin orden (4)", "MESA", "Mueble", "Anagrama", "sin orden", "AMES", "AMES*", 2),
        S("Momento de otra manera revuelta (4)", "RATO", "Momento", "Anagrama", "revuelta", "OTRA", "OTRA*", 2),
        S("Ambiente de salmón sin metro (5)", "SALÓN", "Ambiente", "Sustracción", "sin metro", "SALMÓN - M", "SALMÓN-M", 2),
        S("Lugar abierto de tipa y o revueltos (5)", "PATIO", "Lugar abierto", "Anagrama combinado", "revueltos", "TIPA + O", "(TIPA+O)*", 2),
        S("Planeta al juntar mar y té (5)", "MARTE", "Planeta", "Charada", "al juntar", "MAR + TE", "MAR+TE", 2),
        S("Militar hecho de astro y cubo (7)", "SOLDADO", "Militar", "Charada", "hecho de", "SOL + DADO", "SOL+DADO", 2),
        S("Molusco de rostro y repollo (7)", "CARACOL", "Molusco", "Charada", "de", "CARA + COL", "CARA+COL", 2),
        S("Soplo compuesto por boca y nada (8)", "BOCANADA", "Soplo", "Charada", "compuesto por", "BOCA + NADA", "BOCA+NADA", 2),
        S("Inicio del día al sumar media y noche (10)", "MEDIANOCHE", "Inicio del día", "Charada", "al sumar", "MEDIA + NOCHE", "MEDIA+NOCHE", 2),
        S("Quien arruina la reunión, hecho con líquido y celebraciones (11)", "AGUAFIESTAS", "Quien arruina la reunión", "Charada", "hecho con", "AGUA + FIESTAS", "AGUA+FIESTAS", 2),
        S("Diversión formada por pasa y tiempo (10)", "PASATIEMPO", "Diversión", "Charada", "formada por", "PASA + TIEMPO", "PASA+TIEMPO", 2),
        S("Flor al unir gira y astro (7)", "GIRASOL", "Flor", "Charada", "al unir", "GIRA + SOL", "GIRA+SOL", 2),
        S("Combustión o entusiasmo intenso (5)", "FUEGO", "Combustión / entusiasmo", "Doble definición", "o", "combustión; entusiasmo", "FUEGO / FUEGO", 2),
        S("Roedor o mouse de la computadora (5)", "RATÓN", "Roedor / mouse", "Doble definición", "o", "roedor; mouse de la computadora", "RATÓN / RATÓN", 2),
        S("Lengua de fuego o animal andino (5)", "LLAMA", "Lengua de fuego / animal andino", "Doble definición", "o", "lengua de fuego; camélido", "LLAMA / LLAMA", 2),
        S("Cumbre, según se oye, desde la sima (4)", "CIMA", "Cumbre", "Homófono rioplatense", "según se oye", "SIMA", "SIMA~ (seseo)", 2),
        S("Hogar, según se oye, que caza (4)", "CASA", "Hogar", "Homófono rioplatense", "según se oye", "CAZA", "CAZA~ (seseo)", 2),
        S("Exista, según se oye, quien halla (4)", "HAYA", "Exista", "Homófono rioplatense", "según se oye", "HALLA", "HALLA~ (yeísmo)", 2),
        S("Extremidad animal o apoyo de mesa (4)", "PATA", "Extremidad animal / apoyo de mesa", "Doble definición", "o", "extremidad animal; apoyo de mesa", "PATA / PATA", 2),

        // Dificultad 3: predominan construcciones combinadas.
        S("Quien cuida la puerta: pe más torero desordenado (7)", "PORTERO", "Quien cuida la puerta", "Prefijo + anagrama", "más ... desordenado", "P + TORERO", "P+(TORERO*)", 3),
        S("Estandarte: be más arena y de revueltas (7)", "BANDERA", "Estandarte", "Prefijo + anagrama", "más ... revueltas", "B + ARENA + D", "B+(ARENA+D)*", 3),
        S("Obrero de piedra: ce más norte y a mezclados (7)", "CANTERO", "Obrero de piedra", "Prefijo + anagrama", "más ... mezclados", "C + NORTE + A", "C+(NORTE+A)*", 3),
        S("Dulce: pe más telas revueltas (6)", "PASTEL", "Dulce", "Prefijo + anagrama", "más ... revueltas", "P + TELAS", "P+(TELAS*)", 3),
        S("Ser fabuloso: ese más reina alterada (6)", "SIRENA", "Ser fabuloso", "Prefijo + anagrama", "más ... alterada", "S + REINA", "S+(REINA*)", 3),
        S("Mundo: pe más lenta y a desordenadas (7)", "PLANETA", "Mundo", "Prefijo + anagrama", "más ... desordenadas", "P + LENTA + A", "P+(LENTA+A)*", 3),
        S("Felina: te más girase revuelto (7)", "TIGRESA", "Felina", "Prefijo + anagrama", "más ... revuelto", "T + GIRASE", "T+(GIRASE*)", 3),
        S("Instrumento: te más prometa cambiado (8)", "TROMPETA", "Instrumento", "Prefijo + anagrama", "más ... cambiado", "T + PROMETA", "T+(PROMETA*)", 3),
        S("Oficio: ese más resta revuelta (6)", "SASTRE", "Oficio", "Prefijo + anagrama", "más ... revuelta", "S + RESTA", "S+(RESTA*)", 3),
        S("Costa: ele más latir y o revueltos (7)", "LITORAL", "Costa", "Prefijo + anagrama", "más ... revueltos", "L + LATIR + O", "L+(LATIR+O)*", 3),
        S("Adorno real: oro dentro de cena sin e (6)", "CORONA", "Adorno real", "Contenedor + sustracción", "dentro de ... sin", "CENA - E + ORO", "C(ORO)NA", 3),
        S("Ave: al dentro de pomada sin da (6)", "PALOMA", "Ave", "Contenedor + sustracción", "dentro de ... sin", "POMADA - DA + AL", "P(AL)OMA", 3),
        S("Prenda: mi metido entre las mitades de casa (6)", "CAMISA", "Prenda", "Contenedor + partición", "metido entre las mitades", "CA|SA + MI", "CA(MI)SA", 3),
        S("Soporte que parché mal (6)", "PERCHA", "Soporte", "Anagrama", "mal", "PARCHÉ", "PARCHÉ*", 3),
        S("Material rígido: rato revuelto entre extremos de camión (6)", "CARTÓN", "Material rígido", "Contenedor + anagrama", "revuelto entre extremos", "C(amió)N + RATO", "C(RATO*)N", 3),
        S("Cura: tosa revuelto entre extremos de pudor (6)", "PASTOR", "Cura", "Contenedor + anagrama", "revuelto entre extremos", "P(udo)R + TOSA", "P(TOSA*)R", 3),
        S("Espacio verde: dirá revuelto entre extremos de joven (6)", "JARDÍN", "Espacio verde", "Contenedor + anagrama", "revuelto entre extremos", "J(ove)N + DIRA", "J(DIRA*)N", 3),
        S("Tela de mesa: ante entre extremos de metal (6)", "MANTEL", "Tela de mesa", "Contenedor + extremos", "entre extremos", "M(eta)L + ANTE", "M(ANTE)L", 3),
        S("Cariño que vuelve escondido en broma pesada (4)", "AMOR", "Cariño", "Oculta + reverso", "vuelve escondido", "bROMA", "[ROMA]<", 3),
        S("Roedor que vuelve oculto en trataremos luego (4)", "RATA", "Roedor", "Oculta + reverso", "vuelve oculto", "trATARemos", "[ATAR]<", 3),
        S("Bolsa que retorna escondida en pocas cosas (4)", "SACO", "Bolsa", "Oculta + reverso", "retorna escondida", "pOCAS", "[OCAS]<", 3),
        S("Interpretar lo que vuelve oculto en corre el rumor (4)", "LEER", "Interpretar", "Oculta + reverso", "vuelve oculto", "corRE EL", "[REEL]<", 3),
        S("Igual que retorna escondido en trapo limpio (3)", "PAR", "Igual", "Oculta + reverso", "retorna escondido", "tRAPo", "[RAP]<", 3),
        S("Iglesia: caldera con final de chalet, todo revuelto (8)", "CATEDRAL", "Iglesia", "Anagrama combinado", "todo revuelto", "CALDERA + chaleT", "(CALDERA+T)*", 3),
        S("Acceso de reales y ca desordenados (8)", "ESCALERA", "Acceso", "Anagrama combinado", "desordenados", "REALES + CA", "(REALES+CA)*", 3),
        S("Material de drama y e mezclados (6)", "MADERA", "Material", "Anagrama combinado", "mezclados", "DRAMA + E", "(DRAMA+E)*", 3),
        S("Reserva de otros y e revueltos (6)", "TESORO", "Reserva", "Anagrama combinado", "revueltos", "OTROS + E", "(OTROS+E)*", 3),
        S("Confidencial: cortes y e desordenados (7)", "SECRETO", "Confidencial", "Anagrama combinado", "desordenados", "CORTES + E", "(CORTES+E)*", 3),
        S("Parte del saco: astro más tapa sin inicial (6)", "SOLAPA", "Parte del saco", "Charada + sustracción", "más ... sin inicial", "SOL + TAPA", "SOL+(TAPA-T)", 3),
        S("Ave: pala sin final más amo al revés (6)", "PALOMA", "Ave", "Charada + sustracción + reverso", "sin final ... más ... al revés", "PALA - A + AMO", "(PALA-A)+(AMO<)", 3),

        // Banco nuevo, escrito para el equipo: español rioplatense, sin repetir los de arriba.
        S("Lluvia menuda de gato revuelto (4)", "GOTA", "Lluvia menuda", "Anagrama", "revuelto", "GATO", "GATO*", 1),
        S("Vacío que vuelve Adán (4)", "NADA", "Vacío", "Reverso", "vuelve", "ADÁN", "ADÁN<", 1),
        S("Viaje escondido en la cola de la esquina (4)", "COLA", "Viaje", "Oculta", "escondido", "la COLA de", "la[COLA]de", 1),
        S("Tren bajo al juntar sub y te (5)", "SUBTE", "Tren bajo", "Charada", "al juntar", "SUB + TE", "SUB+TE", 2),
        S("Fruta, según se oye, que vaya (4)", "BAYA", "Fruta", "Homófono rioplatense", "según se oye", "VAYA", "VAYA~", 2),
        S("Juego de turco revuelto (5)", "TRUCO", "Juego", "Anagrama", "revuelto", "TURCO", "TURCO*", 3),
        S("Carne de soda a revuelta (5)", "ASADO", "Carne", "Anagrama", "revuelta", "SODA A", "SODA A*", 3),

        // Lote de hoy, mezclado: sale a partir del próximo día hábil, dos por día.
        S("Se mira para pedir, llega por correo (5)", "CARTA", "Se mira para pedir / llega por correo", "Doble definición", ",", "menú; correo", "CARTA / CARTA", 1),
        S("Donde vivís: el lodo se traga el uno (6)", "BARRIO", "Donde vivís", "Contenedor", "se traga", "BARRO + I", "BARR(I)O", 2),
        S("Origen de vida que causa enfermedad. (6)", "GERMEN", "Origen de vida / que causa enfermedad", "Doble definición", ",", "embrión; microorganismo", "GERMEN / GERMEN", 2),
        S("Jungla que se quedó sin nota, psicoanalista de los arquetipos (4)", "JUNG", "Psicoanalista de los arquetipos", "Sustracción", "se quedó sin nota", "JUNGLA - LA", "JUNGLA-LA", 3),
        S("Vianda que es morfina sin sodio (5)", "MORFI", "Vianda", "Sustracción", "sin sodio", "MORFINA - NA", "MORFI(NA)", 2),
        S("Gorra vasca que vuelve en mañana ni obras (5)", "BOINA", "Gorra vasca", "Oculta + reverso", "que vuelve en", "mañana ni obras", "mañan[A NI OB]ras <", 2),
        S("El patrón viajó hacia el sur: los que mandan en la oficina (5)", "JEFES", "Los que mandan en la oficina", "Charada", "viajó hacia", "JEFE + S", "JEFE+S", 1),
        S("Al laboratorio de 9 a 5... Cambiar de turno... (5)", "ROTAR", "Cambiar de turno", "Selección", "de 9 a 5", "LABORATORIO 9→5", "R-O-T-A-R", 3),
        S("Corta, revuelta, el que hace de otro (5)", "ACTOR", "El que hace de otro", "Anagrama", "revuelta", "CORTA", "CORTA*", 1),
        S("Con una nota metida en lo que chorrea la vela, el pibe se comerá cualquier cuento (6)", "CREERÁ", "Se comerá cualquier cuento", "Contenedor", "metida en", "RE en CERA", "C(RE)ERA", 2),
        S("Norte metido en la chata: poco confiable (6)", "CHANTA", "Poco confiable", "Contenedor", "metido en", "N en CHATA", "CHA(N)TA", 2),
        S("Se da vuelta la lámina y sale un bicho (6)", "ANIMAL", "Un bicho", "Reverso", "se da vuelta", "LÁMINA", "LÁMINA<", 1),
        S("Una nota antes del francés y ya tenés lo que se abre a las doce del 24 (6)", "REGALO", "Lo que se abre a las doce del 24", "Charada", "antes del", "RE + GALO", "RE+GALO", 2),
        S("El capo se traga mil y va a parar donde canta el gallo (5)", "CAMPO", "Donde canta el gallo", "Contenedor", "se traga", "CAPO + M", "CA(M)PO", 2),
        S("Cuando la del suero abraza a usted, aparece la que cobra la pensión. (5)", "VIUDA", "La que cobra la pensión", "Contenedor", "abraza a", "UD en VÍA", "VI(UD)A", 3),
        S("El del mediodía junto al que grita lejos del nido, ese que zafa de los suegros (7)", "SOLTERO", "El que zafa de los suegros", "Charada", "junto al", "SOL + TERO", "SOL+TERO", 2),
        S("Fruta exótica: un alimento caro y difícil de encontrar. (5)", "TRUFA", "Un alimento caro y difícil de encontrar", "Anagrama", "exótica", "FRUTA", "FRUTA*", 2),
        S("Pasaba la noche: parte de alrededor Miami (6)", "DORMÍA", "Pasaba la noche", "Oculta", "parte de", "alreDEDOR MIAmi", "alre[DOR MIA]mi", 2),
        S("Lilas bailando, la que te falta cuando para la música (5)", "SILLA", "La que te falta cuando para la música", "Anagrama", "bailando", "LILAS", "LILAS*", 1),
        S("Nota seguida del océano, para amansar potros (5)", "DOMAR", "Para amansar potros", "Charada", "seguida del", "DO + MAR", "DO+MAR", 2),
        S("Tenía la bronca tan metida en la vena y ni así aprovechó el hueco en el horario (7)", "VENTANA", "El hueco en el horario", "Contenedor", "metida en", "TAN en VENA", "VEN(TAN)A", 2),
        S("De ese zapato embarrado, sobrevive el que hace cuac. (4)", "PATO", "El que hace cuac", "Sustracción", "embarrado, sobrevive", "ZAPATO - ZA", "zaPATO", 1),
        S("El hombre americano con un litro extra en tequila. ¡Cuántas calorías doradas! (11)", "MANTEQUILLA", "Cuántas calorías doradas", "Charada", "con un litro extra", "MAN + TEQUILA + L", "MAN+TEQUILLA", 3),
        S("Créditos barajados dejan a cualquiera de perfil bajo (8)", "DISCRETO", "De perfil bajo", "Anagrama", "barajados", "CRÉDITOS", "CRÉDITOS*", 2),
        S("Con las rentas descontroladas, la agarrás del mango (6)", "SARTÉN", "La agarrás del mango", "Anagrama", "descontroladas", "RENTAS", "RENTAS*", 2),
        S("¡Melchor, por ejemplo, asoma en forma gobierno! (4)", "MAGO", "Melchor, por ejemplo", "Oculta", "asoma en", "forMA GObierno", "for[MA GO]bierno", 1),
        S("La te se escondió en los altares, por detrás (5)", "ATRÁS", "Por detrás", "Contenedor", "se escondió en", "T en ARAS", "A(T)RAS", 2),
        S("El que ya fue y después cuelga la ropa, estira la sobremesa hasta la merienda. (8)", "EXTIENDE", "Estira la sobremesa hasta la merienda", "Charada", "después", "EX + TIENDE", "EX+TIENDE", 2),
        S("Un cacho del menú bestial es lo que te tapa el sol en la playa (4)", "NUBE", "Lo que te tapa el sol", "Oculta", "un cacho del", "meNÚ BEstial", "me[NÚ BE]stial", 1),
        S("Esquive del delantero, paso de baile (7)", "GAMBETA", "Esquive del delantero / paso de baile", "Doble definición", ",", "esquive; paso de baile", "GAMBETA / GAMBETA", 1),
        S("Se emborrachó el primo: hice añicos el vaso (5)", "ROMPÍ", "Hice añicos el vaso", "Anagrama", "se emborrachó", "PRIMO", "PRIMO*", 2),
        S("Fue gol, al final, y en medio de eso, lo que le pedís a un desconocido con el pucho en la boca (5)", "FUEGO", "Lo que le pedís a un desconocido con el pucho", "Sustracción", "al final", "FUEGOL - L", "FUEGO(L)", 2),
        S("Esta se come un ¡uf!, la que el gato no larga en julio (6)", "ESTUFA", "La que el gato no larga en julio", "Contenedor", "se come", "UF en ESTA", "EST(UF)A", 2),
        S("Se busca rito medio loco, remate del nueve (4)", "TIRO", "Remate del nueve", "Anagrama", "medio loco", "RITO", "RITO*", 1),
        S("Elegante con el oeste: el más joven de la familia (5)", "CHICO", "El más joven de la familia", "Charada", "con", "CHIC + O", "CHIC+O", 2),
        S("Gigantes del Jurásico, divinos sin el centro (5)", "DINOS", "Gigantes del Jurásico", "Sustracción", "sin el centro", "DIVINOS - VI", "DI(VI)NOS", 2),
        S("Si vas a montarte a los tumbos, imaginate el lío que se viene (8)", "TORMENTA", "El lío que se viene", "Anagrama", "a los tumbos", "MONTARTE", "MONTARTE*", 2),
        S("Corriente alterna metida en abono, primo de la llama (7)", "GUANACO", "Primo de la llama", "Contenedor", "metida en", "AC en GUANO", "GUAN(AC)O", 3),
        S("Salud por la que pesa bebés y la que sostiene la Justicia (7)", "BALANZA", "La que pesa bebés / la que sostiene la Justicia", "Doble definición", "y", "báscula; símbolo", "BALANZA / BALANZA", 1),
        S("Quedó el campanario sin río a la vista y ahora es la que se lleva el humo de la fritanga (7)", "CAMPANA", "La que se lleva el humo de la fritanga", "Sustracción", "sin río", "CAMPANARIO - RÍO", "CAMPANA(RIO)", 2),
        S("Trofeos de campeones, pocas revueltas (5)", "COPAS", "Trofeos de campeones", "Anagrama", "revueltas", "POCAS", "POCAS*", 1),
        S("Acelerás medio loco y ni saludás a la vecina del ascensor (8)", "ESCALERA", "La vecina del ascensor", "Anagrama", "medio loco", "ACELERÁS", "ACELERÁS*", 2),
        S("Dicen que hasta las paredes tienen uno cuando el odio retrocede. (4)", "OÍDO", "Hasta las paredes tienen uno", "Reverso", "retrocede", "ODIO", "ODIO<", 1),
        S("Los del banquillo perdieron dos y el que queda señala con el dedo (5)", "ACUSA", "Señala con el dedo", "Sustracción", "perdieron dos", "ACUSADOS - DOS", "ACUSA(DOS)", 2),
        S("El dios del vino se traga el norte y queda donde el jubilado tira maíz a las palomas (5)", "BANCO", "Donde el jubilado tira maíz a las palomas", "Contenedor", "se traga", "N en BACO", "BA(N)CO", 2),

    ];

    static DailyCrypticSeed()
    {
        if (Items.GroupBy(entry => entry.Difficulty).Any(group => group.Key is < 1 or > 3 || group.Count() < 30))
        {
            throw new InvalidOperationException("El seed debe tener al menos 30 pistas por dificultad.");
        }

        foreach (DailyCrypticSeedEntry entry in Items)
        {
            string normalizedAnswer = Normalize(entry.Answer);
            int[] expectedParts = entry.Enumeration
                .Trim('(', ')')
                .Split(',', StringSplitOptions.TrimEntries)
                .Select(int.Parse)
                .ToArray();
            int[] actualParts = entry.Answer
                .Split([' ', '-'], StringSplitOptions.RemoveEmptyEntries)
                .Select(part => Normalize(part).Length)
                .ToArray();

            if (!expectedParts.SequenceEqual(actualParts))
            {
                throw new InvalidOperationException($"Enumeración inválida para {entry.Answer}.");
            }

            if (!entry.AcceptedAnswers.Any(answer => Normalize(answer) == normalizedAnswer))
            {
                throw new InvalidOperationException($"Falta la respuesta canónica para {entry.Answer}.");
            }

            string normalizedFodder = Normalize(entry.Fodder);
            var clueWords = entry.Clue
                .Split([' ', ',', '.', ':', ';', '¡', '!', '¿', '?', '(', ')'], StringSplitOptions.RemoveEmptyEntries)
                .Select(Normalize)
                .Where(word => word.Length > 0)
                .ToArray();
            var answerShownAsWord = clueWords.Contains(normalizedAnswer);
            if (answerShownAsWord &&
                !entry.Mechanism.Contains("Oculta", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"La respuesta aparece explícita en la pista de {entry.Answer}.");
            }

            if (entry.Mechanism == "Anagrama" &&
                SortLetters(normalizedAnswer) != SortLetters(normalizedFodder))
            {
                throw new InvalidOperationException($"Anagrama inválido para {entry.Answer}.");
            }

            if (entry.Mechanism == "Oculta" &&
                !normalizedFodder.Contains(normalizedAnswer, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Oculta inválida para {entry.Answer}.");
            }

            if (entry.Mechanism == "Reverso" &&
                new string(normalizedFodder.Reverse().ToArray()) != normalizedAnswer)
            {
                throw new InvalidOperationException($"Reverso inválido para {entry.Answer}.");
            }

            if (entry.Mechanism == "Oculta + reverso" &&
                !normalizedFodder.Contains(
                    new string(normalizedAnswer.Reverse().ToArray()),
                    StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Oculta inversa inválida para {entry.Answer}.");
            }
        }
    }

    private static DailyCrypticSeedEntry S(
        string clue,
        string answer,
        string definition,
        string mechanism,
        string indicator,
        string fodder,
        string parse,
        int difficulty,
        params string[] aliases)
    {
        string[] accepted = aliases.Length == 0
            ? [answer]
            : [answer, .. aliases];

        string enumeration = string.Join(
            ",",
            answer.Split([' ', '-'], StringSplitOptions.RemoveEmptyEntries)
                .Select(part => Normalize(part).Length));

        return new DailyCrypticSeedEntry(
            clue,
            answer,
            $"({enumeration})",
            definition,
            parse,
            mechanism,
            indicator,
            fodder,
            parse,
            difficulty,
            accepted);
    }

    private static string Normalize(string value)
    {
        string decomposed = value.Normalize(NormalizationForm.FormD);
        StringBuilder result = new(decomposed.Length);

        foreach (char character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark &&
                char.IsLetter(character))
            {
                result.Append(char.ToUpperInvariant(character));
            }
        }

        return result.ToString();
    }

    private static string SortLetters(string value) =>
        new(value.OrderBy(character => character).ToArray());
}
