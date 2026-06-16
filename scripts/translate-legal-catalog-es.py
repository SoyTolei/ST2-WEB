"""Traduce el catálogo LEGAL de portugués a español (Argentina)."""
from __future__ import annotations

import json
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent / "legalone-templates-catalog.json"
OUT = Path(__file__).resolve().parent.parent / "src/PortalClienchi.Web/wwwroot/data/legalone-templates-catalog.json"

# Frases completas primero; tokens cortos al final (evita cortar patrones largos).
LONG_REPLACEMENTS = [
    ("Exemplo: Veja que as condições de gatilho da regra é a criação de um registro na iSheet XPTO, porém mesmo após o usuário criar esse registro, o fluxo não disparou. Por exemplo o registro de ID: 789",
     "Ejemplo: Observá que las condiciones de disparo de la regla son la creación de un registro en la iSheet XPTO, pero aun después de que el usuario crea ese registro, el flujo no se dispara. Por ejemplo el registro con ID: 789"),
    ("Exemplo: Que o Workflow dispare caso as condições da regra sejam devidamente cumpridas.",
     "Ejemplo: Que el workflow se dispare cuando se cumplan correctamente las condiciones de la regla."),
    ("Exemplo: Veja que ao abrir a tela acima, ocorre lentidão superior a 7 segundos",
     "Ejemplo: Observá que al abrir la pantalla anterior, hay lentitud superior a 7 segundos"),
    ("Preencha o formulário e clique em \"Gerar Template\" para visualizar", "Completá el formulario y hacé clic en \"Generar plantilla\" para ver la vista previa"),
    ("Preencha o formulário e clique em \"Criar template\" para visualizar", "Completá el formulario y hacé clic en \"Crear plantilla\" para ver la vista previa"),
    ("Obs: Importante Lembre-se de checar as referências de limites que o HighQ possui para operar de forma performática. Caso o cliente esteja acima do limite, a resposta padrão para ele é que ele precisa se adequar aos limites do sistema para melhorar a performance de uso da plataforma.",
     "Nota: recordá revisar los límites de referencia de HighQ. Si el cliente supera el límite, la respuesta estándar es que debe ajustarse a los límites del sistema para mejorar el rendimiento."),
    ("Gerar Template", "Generar plantilla"),
    ("Criar template", "Crear plantilla"),
    ("Limpar", "Limpiar"),
    ("Serviços", "Servicios"),
    ("Serviço", "Servicio"),
    ("Sugestão de Melhoria", "Sugerencia de mejora"),
    ("Alterar URL", "Cambiar URL"),
    ("Restaurar Base", "Restaurar base"),
    ("Toggle Tarefas", "Toggle tareas"),
    ("Cadastro Dfe-Tools N1", "Registro Dfe-Tools N1"),
    ("PreCadastro", "Pre-registro"),
    ("Alta taxa de erros", "Alta tasa de errores"),
    ("Atraso na Captura", "Demora en la captura"),
    ("Intimações Eletrônicas", "Intimaciones electrónicas"),
    ("Restaurar Crédito", "Restaurar crédito"),
    ("Falha na API", "Falla en la API"),
    ("Checklist Suporte", "Checklist soporte"),
    ("Checklist Cliente", "Checklist cliente"),
    ("Major Incidente", "Incidente mayor"),
    ("Bug Geral", "Bug general"),
    ("Bug Workflow", "Bug workflow"),
    ("Falha de acesso", "Falla de acceso"),
    ("Licenças", "Licencias"),
    ("Descrição do Bug", "Descripción del bug"),
    ("Nota adicional", "Nota adicional"),
    ("Login do usuário que reportou", "Login del usuario que reportó"),
    ("Senha de acesso", "Contraseña de acceso"),
    ("Módulo", "Módulo"),
    ("Tenancy", "Tenancy"),
    ("Found Results (O que aconteceu)", "Resultado encontrado (qué ocurrió)"),
    ("Expected Results (O que deveria acontecer)", "Resultado esperado (qué debería ocurrir)"),
    ("Descreva o comportamento encontrado", "Describí el comportamiento encontrado"),
    ("Descreva o comportamento esperado", "Describí el comportamiento esperado"),
    ("Descreva a ação", "Describí la acción"),
    ("Informações adicionais", "Información adicional"),
    ("Erro ao salvar processo", "Error al guardar proceso"),
    ("Tipo de Backup", "Tipo de backup"),
    ("Veja que", "Observá que"),
    ("Que não ocorra lentidão", "Que no haya lentitud"),
    ("Que o Workflow dispare", "Que el workflow se dispare"),
    ("Lentidão ao abrir", "Lentitud al abrir"),
    ("Acessar o site", "Acceder al sitio"),
    ("Acessar o módulo", "Acceder al módulo"),
    ("Acessar o menu", "Acceder al menú"),
    ("Acessar o fluxo", "Acceder al flujo"),
    ("Acessar a regra", "Acceder a la regla"),
    ("Workflow não está disparando", "El workflow no se dispara"),
    ("mesmo cumprindo as condições", "aun cumpliendo las condiciones"),
    ("condições de gatilho", "condiciones de disparo"),
    ("registro na iSheet", "registro en la iSheet"),
    ("fluxo não disparou", "el flujo no se disparó"),
    ("ocorre lentidão superior", "hay lentitud superior"),
    ("Importante", "Importante"),
    ("Opcional", "Opcional"),
    ("formulário", "formulario"),
    ("visualizar", "visualizar"),
    ("comportamento", "comportamiento"),
    ("encontrado", "encontrado"),
    ("esperado", "esperado"),
    ("cliente", "cliente"),
    ("admin", "admin"),
    ("Backup", "Backup"),
    ("Nome do Cliente", "Nombre del cliente"),
    ("Nome da consulta no tribunal:", "Nombre de la consulta en el tribunal:"),
    ("Nome / CNPJ do cliente", "Nombre / CUIT del cliente"),
    ("Login/Nome do usuário que solicitou", "Login/nombre del usuario que solicitó"),
    ("Login/Nome do usuário", "Login/nombre del usuario"),
    ("Ativar Toggle de Importação CNJ", "Activar toggle de importación CNJ"),
    ("Liberar Toggle de Importação CNJ", "Liberar toggle de importación CNJ"),
    ("Importação CNJ não liberada", "Importación CNJ no liberada"),
    ("Ativar toggle de importação CNJ", "Activar toggle de importación CNJ"),
    ("Ativar Toggle de Tarefas do Google", "Activar toggle de tareas de Google"),
    ("Toggle de tarefas do Google desativado", "Toggle de tareas de Google desactivado"),
    ("Ativar toggle de tarefas do Google", "Activar toggle de tareas de Google"),
    ("Cadastro DFe-Tools", "Registro DFe-Tools"),
    ("Pré-Cadastro", "Pre-registro"),
    ("Quantidade de Falhas", "Cantidad de fallas"),
    ("Acessar módulo Publicações \nClicar em Publicações \nLocalizar o processo",
     "Acceder al módulo Publicaciones\nHacer clic en Publicaciones\nLocalizar el proceso"),
    ("Publicações", "Publicaciones"),
    ("Descreva o que foi encontrado no sistema...", "Describí lo encontrado en el sistema..."),
    ("Cliente sinalizou que vai cancelar se não tiver essa consulta?",
     "¿El cliente indicó que cancelará si no tiene esta consulta?"),
    ("Template Performance Cliente", "Plantilla - Performance cliente"),
    ("Lentidão no sistema", "Lentitud en el sistema"),
    ("A eventualidade ocorre com todos os usuários?", "¿Ocurre con todos los usuarios?"),
    ("O usuário que está relatando a queda da performance é administrador ou possui direitos limitados?",
     "¿El usuario que reporta la caída de performance es administrador o tiene permisos limitados?"),
    ("Provedor ou Cliente", "Proveedor o cliente"),
    ("Quantidade de abas do Legal One ou outras aplicações concorrentes ao mesmo tempo?",
     "¿Cantidad de pestañas de Legal One u otras aplicaciones abiertas al mismo tiempo?"),
    ("5 abas do Legal One + 3 abas de outras aplicações",
     "5 pestañas de Legal One + 3 de otras aplicaciones"),
    ("Ocorre com todos os usuários do escritório/departamento?",
     "¿Ocurre con todos los usuarios del estudio/departamento?"),
    ("Empresa XYZ Ltda", "Empresa XYZ S.A."),
    ("Descreva os passos para reproduzir o problema", "Describí los pasos para reproducir el problema"),
    ("Descreva os passos para reproduzir a lentidão", "Describí los pasos para reproducir la lentitud"),
    ("Descreva os passos para reproduzir o bug", "Describí los pasos para reproducir el bug"),
    ("Descreva os passos para reproduzir", "Describí los pasos para reproducir"),
    ("Descreva o motivo para a base ser restaurada", "Describí el motivo para restaurar la base"),
    ("Descreva a melhoria sugerida", "Describí la mejora sugerida"),
    ("Descreva o problema ou solicitação", "Describí el problema o la solicitud"),
    ("Descreva o que foi encontrado", "Describí lo encontrado"),
    ("Descreva o que era esperado encontrar...", "Describí lo que se esperaba encontrar..."),
    ("Descreva o resultado encontrado (lentidão observada)", "Describí el resultado encontrado (lentitud observada)"),
    ("Descreva o resultado esperado (performance adequada)", "Describí el resultado esperado (performance adecuada)"),
    ("Descreva o resultado encontrado (erro ou comportamiento incorreto)", "Describí el resultado encontrado (error o comportamiento incorrecto)"),
    ("Descreva o resultado encontrado", "Describí el resultado encontrado"),
    ("Descreva o resultado esperado", "Describí el resultado esperado"),
    ("Descreva o resultado obtido (erro, resposta inesperada, etc.)", "Describí el resultado obtenido (error, respuesta inesperada, etc.)"),
    ("Descreva o caso de uso onde ocorre a lentidão...", "Describí el caso de uso donde ocurre la lentitud..."),
    ("Descreva a estrutura de rede atual...", "Describí la estructura de red actual..."),
    ("Rede do escritório possui firewall?", "¿La red del estudio tiene firewall?"),
    ("Template Performance Support", "Plantilla - Performance soporte"),
    ("Template Performance - Incidente mayor", "Plantilla - Performance - Incidente mayor"),
    ("Pre-registro (Falha en la Captura)", "Pre-registro (Falla en la captura)"),
    ("Falha en la Captura", "Falla en la captura"),
    ("Descrição da Melhoria", "Descripción de la mejora"),
    ("Descrição do problema", "Descripción del problema"),
    ("Descrição/Assunto * (Editável)", "Descripción/Asunto * (Editable)"),
    ("Descrição/Assunto", "Descripción/Asunto"),
    ("Resumo da melhoria", "Resumen de la mejora"),
    ("Observações adicionais (opcional)", "Observaciones adicionales (opcional)"),
    ("Informações adicionais...", "Información adicional..."),
    ("Digite o nome do cliente", "Ingresá el nombre del cliente"),
    ("Digite o IdSIP do cliente", "Ingresá el IdSIP del cliente"),
    ("Digite a instância do APP", "Ingresá la instancia de la APP"),
    ("Digite a descrição", "Ingresá la descripción"),
    ("Digite observações opcionais", "Ingresá observaciones opcionales"),
    ("Digite parâmetros adicionais do órgão, se houver", "Ingresá parámetros adicionales del organismo, si corresponde"),
    ("Digite parâmetros adicionais do Legal One, se houver", "Ingresá parámetros adicionales de Legal One, si corresponde"),
    ("Digite parâmetros adicionais, se houver", "Ingresá parámetros adicionales, si corresponde"),
    ("Digite o tenancy do cliente", "Ingresá el tenancy del cliente"),
    ("Login do DFe", "Login de DFe"),
    ("Senha do DFe", "Contraseña de DFe"),
    ("Senha do Certificado", "Contraseña del certificado"),
    ("Senha do certificado digital", "Contraseña del certificado digital"),
    ("Versão do Sistema Operacional", "Versión del sistema operativo"),
    ("Modelo do Aparelho", "Modelo del dispositivo"),
    ("Tipo de Conexão com a Internet", "Tipo de conexión a Internet"),
    ("Número do Processo", "Número de proceso"),
    ("Link do Site", "Link del sitio"),
    ("Data/Hora da Consulta", "Fecha/hora de la consulta"),
    ("Tenancy Antiga", "Tenancy anterior"),
    ("Tenancy Nova", "Tenancy nueva"),
    ("Found Results *", "Resultado encontrado *"),
    ("Steps *", "Pasos *"),
    ("Password *", "Contraseña *"),
    ("User *", "Usuario *"),
    ("User * (Padrão: Support)", "Usuario * (Predeterminado: Support)"),
    ("Note", "Nota"),
    ("Resumo *", "Resumen *"),
    ("Produto/Versão *", "Producto/Versión *"),
    ("Ex: Módulo de Processos", "Ej: Módulo de procesos"),
    ("Template - Melhoria Legal", "Plantilla - Mejora Legal One"),
    ("Template - Alterar URL", "Plantilla - Cambiar URL"),
    ("Template - Restaurar Base", "Plantilla - Restaurar base"),
    ("Template - Intimações Eletrônicas", "Plantilla - Intimaciones electrónicas"),
    ("Template Licenças", "Plantilla - Licencias"),
    ("Serviço Legal One Analytics", "Servicio Legal One Analytics"),
    ("Autorização da Supervisão *", "Autorización de supervisión *"),
    ("Caso não, poderia mensurar como é a estrutura atual? *", "Si no, ¿podés describir cómo es la estructura actual? *"),
    ("Configuração de Monitoramento está ajustada? *", "¿La configuración de monitoreo está ajustada? *"),
    ("Diminuição da porcentagem de erro no Agendador de Consulta.", "Disminución del porcentaje de error en el agendador de consultas."),
    ("Documentação Usada *", "Documentación utilizada *"),
    ("Duração *", "Duración *"),
    ("Estes estão localizados fisicamente na mesma rede? *", "¿Están ubicados físicamente en la misma red? *"),
    ("Ex: Advogado: João Silva", "Ej: Abogado: Juan Pérez"),
    ("Ex: Atraso na captura de publicação", "Ej: Demora en la captura de publicación"),
    ("Ex: Intimação Eletrônica não foi capturada", "Ej: Intimación electrónica no fue capturada"),
    ("Ex: Lentidão ao abrir a Home de um site", "Ej: Lentitud al abrir la home de un sitio"),
    ("Ex: Selecionar comarca: São Paulo", "Ej: Seleccionar jurisdicción: Buenos Aires"),
    ("Ex: Workflow não está disparando mesmo cumprindo as condições de gatilho", "Ej: El workflow no se dispara aun cumpliendo las condiciones de disparo"),
    ("Ex: joao.silva ou João Silva", "Ej: juan.perez o Juan Pérez"),
    ("Ex: https://exemplo.com.br", "Ej: https://ejemplo.com.ar"),
    ("Parâmetros Adicionais - Site do Órgão (Opcional)", "Parámetros adicionales - Sitio del organismo (Opcional)"),
    ("Parâmetros Adicionais Órgão (Opcional)", "Parámetros adicionales organismo (Opcional)"),
    ("Quantos processos de todos os órgãos o cliente monitora atualmente no Legal One? *", "¿Cuántos procesos de todos los organismos monitorea actualmente el cliente en Legal One? *"),
    ("Site do Órgão *", "Sitio del organismo *"),
    ("Órgão *", "Organismo *"),
    ("Usuário e senha do cliente para acessar as intimações no site *", "Usuario y contraseña del cliente para acceder a las intimaciones en el sitio *"),
    ("Usuario e senha do cliente para acessar as intimações no site *", "Usuario y contraseña del cliente para acceder a las intimaciones en el sitio *"),
    ("Pré-Cadastro (Falha na Captura)", "Pre-registro (Falla en la captura)"),
    ("Falha na Captura", "Falla en la captura"),
    ("Alterar URL", "Cambiar URL"),
    ("Restaurar Base", "Restaurar base"),
]

SHORT_REPLACEMENTS = [
    ("Descrição", "Descripción"),
    ("Usuário", "Usuario"),
    ("Senha", "Contraseña"),
    ("Produto", "Producto"),
    ("Versão", "Versión"),
    ("Padrão", "Predeterminado"),
    ("Template -", "Plantilla -"),
    ("Exemplo:", "Ejemplo:"),
    ("Exemplo", "Ejemplo"),
    ("Ex:", "Ej:"),
]

LABEL_FIXES = {
    "Serviços": "Servicios",
}


def translate_text(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        return text
    out = text
    for pt, es in LONG_REPLACEMENTS:
        out = out.replace(pt, es)
    for pt, es in SHORT_REPLACEMENTS:
        out = out.replace(pt, es)
    return out


def walk(obj):
    if isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk(v) for v in obj]
    if isinstance(obj, str):
        return translate_text(obj)
    return obj


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    data = walk(data)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
