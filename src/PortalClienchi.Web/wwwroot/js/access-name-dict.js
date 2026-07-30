/** Diccionarios para partir nombres/apellidos pegados en correos corporativos. Claves sin acento. */

export const ACCESS_NAME_PARTICLES = new Set([
  "de", "del", "la", "las", "los", "y", "e", "da", "do", "das", "dos",
  "van", "von", "di", "le", "du", "san", "santa",
]);

export const ACCESS_NAME_ALIASES = {
  ma: "María", maria: "María", jose: "José", jesus: "Jesús", angel: "Ángel",
  angeles: "Ángeles", monica: "Mónica", martin: "Martín", andres: "Andrés",
  ramon: "Ramón", raul: "Raúl", adrian: "Adrián", julian: "Julián",
  sebastian: "Sebastián", nicolas: "Nicolás", lucia: "Lucía", sofia: "Sofía",
  agustin: "Agustín", tomas: "Tomás", benjamin: "Benjamín", hermes: "Hermes",
  vanesa: "Vanesa", vanessa: "Vanessa", georgina: "Georgina", munoz: "Muñoz",
  velasquez: "Velázquez", velazquez: "Velázquez", garcia: "García", gomez: "Gómez",
  lopez: "López", martinez: "Martínez", hernandez: "Hernández", sanchez: "Sánchez",
  perez: "Pérez", ramirez: "Ramírez", rodriguez: "Rodríguez", fernandez: "Fernández",
  alvarez: "Álvarez", gutierrez: "Gutiérrez", jimenez: "Jiménez", vazquez: "Vázquez",
  ibanez: "Ibáñez", nunez: "Núñez", pena: "Peña", peña: "Peña", ines: "Inés",
  hector: "Héctor", cesar: "César", oscar: "Óscar", german: "Germán",
  hernan: "Hernán", joaquin: "Joaquín", matias: "Matías", ruben: "Rubén",
  victor: "Víctor", monica: "Mónica", veronica: "Verónica", debora: "Débora",
  stefania: "Stefanía", rocio: "Rocío", sofia: "Sofía",
};

export const ACCESS_GIVEN_NAMES = new Set([
  "aaron", "abel", "abril", "adela", "adelina", "adriana", "adrian", "agostina", "agustin", "agustina",
  "aitana", "alan", "alberto", "aldo", "alejandro", "alejandra", "alessandra", "alex", "alexa", "alexander",
  "alexandra", "alexis", "alfonso", "alfredo", "alice", "alicia", "alina", "alvaro", "amalia", "amanda",
  "amparo", "ana", "anabella", "anahi", "analia", "anastasia", "anderson", "andre", "andrea", "andres",
  "angel", "angela", "angeles", "angelica", "angelo", "anita", "anna", "anthony", "antonella", "antonio",
  "antonia", "ariadna", "ariel", "arleen", "armando", "arnold", "arturo", "asia", "asuncion", "aurora",
  "ayana", "ayelen", "aylin", "azucena", "bautista", "beatriz", "belen", "benicio", "benjamin", "berenice",
  "bernardita", "bernardo", "betty", "bianca", "blanca", "brandon", "brenda", "brian", "bruno", "camila",
  "camilo", "candela", "carina", "carla", "carlos", "carmen", "carolina", "caroline", "catarina", "catalina",
  "cecilia", "celeste", "celia", "cesar", "christian", "christopher", "cindy", "clara", "claudia", "claudio",
  "clemente", "constanza", "cristian", "cristina", "cruz", "dalia", "damian", "daniel", "daniela", "danny",
  "dante", "dario", "david", "debora", "delfina", "denise", "dennis", "diana", "diego", "dolores",
  "domingo", "dominic", "edgar", "edgardo", "edith", "edmundo", "eduardo", "edward", "eliana", "elias",
  "elisa", "eliseo", "elizabeth", "eloisa", "elsa", "elvira", "emanuel", "emilia", "emiliano", "emilio",
  "emily", "emma", "enrique", "eric", "erica", "erika", "ernesto", "esteban", "estefania", "ester",
  "esther", "eugenia", "eugenio", "eva", "evelyn", "fabian", "fabiana", "fabricio", "facundo", "fabiola",
  "federico", "felicia", "felipe", "felix", "fernanda", "fernando", "fidel", "fiorella", "flavia", "flor",
  "florencia", "florentino", "francisco", "franco", "frank", "freddy", "gabriel", "gabriela", "gael",
  "genesis", "george", "georgina", "geraldine", "german", "gerardo", "gaston", "gilberto", "gina", "gisela",
  "giuliana", "gladys", "gloria", "gonzalo", "graciela", "gregorio", "guadalupe", "guillermina", "guillermo",
  "gustavo", "harry", "hector", "helena", "henry", "hernan", "hernando", "hilda", "homero", "horacio",
  "hugo", "ignacio", "iliana", "ines", "ingrid", "irene", "iris", "isaac", "isabel", "isabela", "isabella",
  "isidro", "ivan", "ivana", "jacinto", "jacob", "jaime", "jairo", "james", "jamie", "janeth", "jasmine",
  "javier", "jennifer", "jenny", "jeremy", "jessica", "jesus", "jimena", "joaquin", "joel", "john",
  "johnny", "jonathan", "jorge", "jose", "josefa", "josefina", "joseph", "joshua", "josue", "juan",
  "juana", "julian", "juliana", "julieta", "julio", "karen", "karina", "karla", "kate", "katherine",
  "katie", "kevin", "kimberly", "laura", "lauren", "lautaro", "leandro", "leila", "leon", "leonardo",
  "leonel", "leticia", "liam", "lidia", "liliana", "lina", "linda", "lisa", "liz", "lola", "lorena",
  "lorenzo", "lourdes", "lucas", "lucia", "luciana", "luciano", "lucio", "luis", "luisa", "luz",
  "macarena", "magali", "magdalena", "maia", "mailen", "maite", "manuel", "manuela", "marcela", "marcelo",
  "marco", "marcos", "margaret", "margarita", "maria", "mariana", "mariano", "maribel", "maricel", "marie",
  "marina", "mario", "marisa", "marisol", "marta", "martha", "martin", "martina", "mateo", "matias",
  "mauricio", "max", "maxi", "maximiliano", "maya", "melanie", "melina", "melissa", "mercedes", "mia",
  "michael", "michel", "michelle", "miguel", "milagros", "miriam", "mirta", "monica", "morena", "nadia",
  "nancy", "naomi", "natalia", "natalie", "natividad", "nelson", "nestor", "nicole", "nicolas", "noelia",
  "noemi", "nora", "norma", "octavio", "olga", "oliver", "olivia", "omar", "orlando", "oscar", "osvaldo",
  "pablo", "pamela", "paola", "patricia", "patrick", "patricio", "paul", "paula", "paulina", "pedro",
  "penelope", "perla", "peter", "pilar", "priscilla", "rafael", "ramiro", "ramon", "raquel", "raul",
  "raymond", "rebecca", "rebeca", "regina", "renata", "rene", "ricardo", "richard", "robert", "roberto",
  "rocio", "rodolfo", "rodrigo", "roger", "roman", "romina", "roque", "rosa", "rosalia", "rosana",
  "rosario", "roxana", "ruben", "ruth", "samuel", "sandra", "santiago", "santino", "santos", "sara",
  "sarah", "saul", "sebastian", "selena", "sergio", "sharon", "silvana", "silvia", "silvina", "simon",
  "sofia", "solange", "soledad", "sonia", "sophia", "stefania", "stefano", "stephanie", "steven",
  "susan", "susana", "tamara", "tatiana", "teo", "teresa", "thiago", "thomas", "tomas", "tony",
  "trinidad", "ulises", "ursula", "valentina", "valentin", "valeria", "vanesa", "vanessa", "vera",
  "veronica", "vicente", "victor", "victoria", "violeta", "virginia", "viviana", "walter", "wendy",
  "william", "wilson", "ximena", "yanina", "yamila", "yasmin", "yesica", "yessica", "yliana", "yvonne",
  "zoe", "zoraida", "ma",
]);

export const ACCESS_SURNAMES = new Set([
  "abad", "acosta", "aguado", "aguilar", "aguilera", "aguirre", "alarcon", "alba", "albert", "alcalde",
  "alcazar", "alejandro", "alfonso", "almeida", "alonso", "altamirano", "alvarado", "alvarez", "amador",
  "amaro", "amor", "andrade", "angelo", "angulo", "aparicio", "aranda", "araujo", "arce", "arevalo",
  "arguello", "arias", "arriaga", "arroyo", "avila", "ayala", "azcarate", "baeza", "balaguer", "ballester",
  "ballesteros", "barbero", "barrios", "barrera", "barroso", "basualdo", "batista", "bautista", "becerra",
  "beltran", "benitez", "bernal", "blanco", "bonilla", "borda", "borja", "bravo", "briones", "bueno",
  "bustos", "caballero", "cabanas", "cabello", "cabral", "cabrera", "calderon", "calvo", "camacho",
  "camino", "campos", "canaveral", "cano", "cantero", "carballo", "cardenas", "cardozo", "carmona",
  "carrera", "carrillo", "carrizo", "casado", "casanova", "casas", "castaneda", "castellanos", "castillo",
  "castro", "catalan", "ceballos", "celis", "centeno", "cepeda", "cerda", "cerezo", "chacon", "chavez",
  "cisneros", "cohen", "colina", "collado", "conde", "contreras", "cornejo", "corona", "coronado",
  "coronel", "corral", "correa", "cortes", "corvo", "costa", "crespo", "cruz", "cuadros", "cuesta",
  "cuevas", "daza", "deleon", "delgado", "diaz", "diego", "dominguez", "donoso", "duarte", "duran",
  "echeverria", "elias", "escalante", "escobar", "escribano", "espinal", "espinosa", "espinoza", "estero",
  "estrella", "estrada", "fajardo", "falcon", "fernandez", "ferrara", "ferrero", "ferro", "figueroa",
  "flores", "fonseca", "fontana", "franco", "frias", "fuentes", "gaitan", "galindo", "gallardo", "gallego",
  "gallo", "galvez", "gamez", "garcia", "gargallo", "garzon", "gaspar", "gaytan", "gil", "gimenez",
  "godoy", "gomez", "gonzalez", "gordillo", "granados", "guerrero", "guevara", "guillen", "gutierrez",
  "guzman", "guerra", "heredia", "hernandez", "herrera", "herrero", "hidalgo", "hinojosa", "hoyos",
  "huerta", "ibanez", "ibarra", "iglesias", "infante", "izquierdo", "jara", "jauregui", "jimenez",
  "jordan", "juarez", "jurado", "lago", "lara", "larrea", "leal", "leiva", "leon", "leyva", "linares",
  "llanos", "lobato", "lobo", "lopez", "lorenzo", "lozano", "lucero", "lugo", "luna", "macias", "maciel",
  "madrigal", "maldonado", "manzano", "marcos", "marin", "marquez", "marrero", "martin", "martinez",
  "mata", "mateo", "mateos", "medina", "mejia", "mendez", "mendoza", "meneses", "merino", "mesa",
  "miranda", "mocha", "molina", "monroy", "montes", "montoya", "mora", "morales", "moran", "moreno",
  "moreira", "moya", "munoz", "murillo", "naranjo", "navarro", "nieto", "nogueira", "nolan", "nunez",
  "obregon", "ocampo", "ochoa", "ojeda", "oliva", "olivares", "olivera", "ordonez", "orellana", "ortega",
  "ortiz", "osorio", "ospina", "ovejero", "pacheco", "padilla", "padrino", "palacios", "palma", "pardo",
  "paredes", "parra", "pasquale", "pastor", "paz", "pedraza", "peña", "pena", "peralta", "pereda",
  "pereira", "perez", "pereyra", "pico", "pineda", "pinero", "pizarro", "plata", "plaza", "polo",
  "ponce", "portillo", "prado", "prieto", "puente", "puga", "pulido", "quesada", "querido", "quinta",
  "quintero", "quiroga", "quiros", "ramirez", "ramos", "rangel", "reda", "reyes", "riera", "rios",
  "riquelme", "rivas", "rivera", "rivero", "robledo", "robles", "roca", "rocha", "rodriguez", "rojas",
  "rojo", "roman", "romero", "rosales", "rosas", "royo", "rubio", "ruiz", "saavedra", "salas", "salazar",
  "salcedo", "salgado", "salinas", "sanchez", "sandoval", "santana", "santiago", "santos", "sanz",
  "sarmiento", "segura", "seoane", "serrano", "sierra", "silva", "solano", "soler", "solis", "soria",
  "sosa", "sotelo", "soto", "suarez", "taboada", "tapia", "tejada", "tello", "toledo", "tomas",
  "torres", "tortosa", "trejo", "trujillo", "ugarte", "ulloa", "urbina", "uribe", "valdes", "valdez",
  "valencia", "valenzuela", "valero", "valle", "vallejo", "vanegas", "varela", "vargas", "vasquez",
  "vazquez", "vega", "velasco", "velasquez", "velazquez", "velez", "vera", "vergara", "vicente",
  "vidal", "viera", "villa", "villalba", "villanueva", "villar", "villareal", "villarroel", "villegas",
  "vives", "yanez", "zambrano", "zamora", "zapata", "zarate", "zubizarreta", "zuniga",
]);

export function foldAccessName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isAccessGivenName(folded) {
  return ACCESS_GIVEN_NAMES.has(folded) || !!ACCESS_NAME_ALIASES[folded];
}

export function isAccessSurname(folded) {
  return ACCESS_SURNAMES.has(folded) || !!ACCESS_NAME_ALIASES[folded];
}

export function isAccessKnownNamePart(folded) {
  return ACCESS_NAME_PARTICLES.has(folded)
    || isAccessGivenName(folded)
    || isAccessSurname(folded);
}
