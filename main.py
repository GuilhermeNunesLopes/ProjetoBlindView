from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests
import os
from dotenv import load_dotenv
import google.generativeai as genai
import googlemaps # Importe a biblioteca do cliente Google Maps
import re # Importar o módulo re para limpeza de HTML

load_dotenv()

app = FastAPI()

# Configuração do CORS para permitir requisições do frontend
# Em produção, substitua "*" pela origem específica do seu frontend (ex: "https://seusite.com")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração das APIs
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") # Chave para a API do Gemini
Maps_API_KEY = os.getenv("Maps_API_KEY") # Chave para as APIs do Google Maps

# Configurar Gemini
USE_GEMINI_FOR_REFINEMENT = False
if not GOOGLE_API_KEY:
    print("Aviso: GOOGLE_API_KEY não configurada no arquivo .env. Gemini não será usado.")
else:
     try:
         genai.configure(api_key=GOOGLE_API_KEY)
         # Testar uma chamada simples para verificar a configuração
         # model = genai.GenerativeModel('gemini-pro') # Use o modelo apropriado
         # model.generate_content("test").text # Remover em produção
         model = genai.GenerativeModel('gemini-2.5-flash-preview-04-17') # Use o modelo apropriado
         #USE_GEMINI_FOR_REFINEMENT = True # Desativado refinamento para melhorar a velocidade da consulta.
         print("API do Gemini configurada com sucesso.")
     except Exception as e:
         print(f"Aviso: Falha ao configurar a API do Gemini. Gemini não será usado para refinar instruções: {e}")
         USE_GEMINI_FOR_REFINEMENT = False


# Crie o cliente Google Maps (usado no backend para a Directions API)
gmaps = None # Inicializa como None
if not Maps_API_KEY:
    print("Aviso: Maps_API_KEY não configurada no arquivo .env. As funções que dependem dela não funcionarão.")
else:
    try:
        gmaps = googlemaps.Client(key=Maps_API_KEY)
        print("Cliente Google Maps inicializado com sucesso.")
        # Opcional: Testar uma chamada simples da API Directions
        # directions_test = gmaps.directions("Central Park, NY", "Times Square, NY")
        # print(f"Teste da Google Directions API: {len(directions_test)} rotas encontradas.") # Remover em produção
    except Exception as e:
        print(f"Erro ao inicializar o cliente Google Maps: {e}")
        gmaps = None # Garante que gmaps seja None em caso de erro

# Modelo para receber dados de localização e destino do frontend
class LocationData(BaseModel):
    latitude: float
    longitude: float
    destination: str

# Modelo para a resposta enviada de volta ao frontend
class NavigationResponse(BaseModel):
    instructions: str
    routeData: Optional[dict] = None # Campo opcional para dados da rota (polyline)


# --- Endpoint para fornecer a Chave da API do Google Maps para o frontend ---
@app.get("/Maps_api_key/")
async def get_Maps_api_key():
    """
    Endpoint para fornecer a chave da API do Google Maps para o frontend.
    A chave retornada deve ser restrita por HTTP referrer (seu domínio/endereço do frontend)
    no Google Cloud Console para segurança.
    """
    print("Requisição recebida para /Maps_api_key/")
    if not Maps_API_KEY:
        print("Erro: Maps_API_KEY não configurada no backend.")
        raise HTTPException(status_code=500, detail="Chave da API do Google Maps não configurada no backend.")
    print("Chave da API do Google Maps fornecida ao frontend.")
    return {"apiKey": Maps_API_KEY}

# --- Funções para Interagir com as APIs do Google Maps (Backend) ---

async def get_google_directions(latitude: float, longitude: float, destination: str) -> Optional[dict]:
    """
    Obtém instruções de navegação usando a API Directions do Google Maps.
    Requer o cliente Google Maps inicializado.
    Retorna o objeto de rota completo ou None em caso de erro/sem resultado.
    """
    print(f"Chamado get_google_directions para destino '{destination}' da localização ({latitude}, {longitude}).")
    if not gmaps:
        print("Erro: Cliente Google Maps não inicializado. Verifique Maps_API_KEY no .env.")
        return None

    origin = f"{latitude},{longitude}"

    try:
        # Chame a API Directions do Google Maps
        # A biblioteca googlemaps-python lida com a requisição HTTP e a chave automaticamente
        directions_result = gmaps.directions(
            origin=origin,
            destination=destination,
            mode="walking",  # Modo a pé
            language="pt-BR", # Idioma das instruções
            units="metric" # Unidades métricas (metros)
             # Opcional: adicionar waypoints se necessário
        )
        print(f"Resposta da Google Directions API recebida. Resultados: {len(directions_result) if directions_result else 0}")


        if directions_result and len(directions_result) > 0:
            # Retorna o primeiro resultado de rota encontrado
            route = directions_result[0]
            # print("Primeira rota encontrada:", route) # Pode ser muito verboso, descomente para depuração
            return route
        else:
            print(f"Google Directions API falhou para '{destination}': Nenhum resultado encontrado.")
            return None
    except Exception as e:
        print(f"Erro ao chamar a Google Directions API para '{destination}': {e}")
        return None

async def process_google_directions_response(directions_data: dict) -> tuple[str, Optional[dict]]:
    """
    Processa a resposta JSON da Google Directions API e extrai instruções e dados da rota.
    Retorna uma tupla com o texto das instruções formatado e os dados da rota (overview_polyline).
    """
    print("Chamado process_google_directions_response.")
    if not directions_data or not directions_data.get("legs"):
        print("Dados de direção incompletos ou sem trechos ('legs').")
        return "Não foi possível encontrar uma rota ou os dados estão incompletos (Google Maps).", None

    # Geralmente há apenas uma "leg" para navegação direta de A a B
    leg = directions_data["legs"][0]
    steps = leg.get("steps")

    if not steps:
         print("Trecho da rota encontrado, mas sem passos detalhados ('steps').")
         return "Rota encontrada, mas sem passos detalhados (Google Maps).", None


    instructions = []

    # Adicionar uma instrução inicial mais amigável
    # Tenta obter o nome da rua ou localização do início do primeiro passo
    start_address = leg.get("start_address", "sua localização atual")
    end_address = leg.get("end_address", "seu destino")
    instructions.append(f"Início da navegação. Saindo de {start_address} em direção a {end_address}.")


    # Iterar sobre os passos (steps)
    for i, step in enumerate(steps):
        # O campo 'html_instructions' contém as instruções formatadas em HTML.
        # Precisamos limpá-lo para obter texto simples.
        instruction_text = step.get("html_instructions", "Instrução desconhecida")
        # Remover tags HTML (mais robusto com regex)
        clean_instruction_text = re.sub(r'<[^>]+>', '', instruction_text)
         # Substituir entidades HTML comuns como & (&), < (<), > (>)
        clean_instruction_text = clean_instruction_text.replace('&', '&').replace('<', '<').replace('>', '>')


        distance_meters = step.get("distance", {}).get("value", 0) # Distância em metros
        duration_seconds = step.get("duration", {}).get("value", 0) # Duração em segundos
        # location = step.get("end_location") # Coordenadas do fim do passo

        # Formatar a distância
        distance_str = f"{distance_meters:.0f} metros" if distance_meters > 0 else "uma curta distância"

        # Opcional: adicionar o nome da rua em que o passo ocorre (se disponível)
        street_name = step.get("street_number", "") + " " + step.get("street_name", "")
        street_name = street_name.strip()


        step_instruction = f"{i + 1}. {clean_instruction_text}" # Index começa do 1 para os passos
        if street_name:
             step_instruction += f" na {street_name}"
        step_instruction += f" (andar por {distance_str})" # Inclui a distância no passo


        instructions.append(step_instruction)

    # Adicionar resumo final
    total_distance_meters = leg.get("distance", {}).get("value", 0)
    total_duration_seconds = leg.get("duration", {}).get("value", 0)

    total_distance_str = f"{total_distance_meters:.0f} metros" if total_distance_meters > 0 else "Distância total desconhecida"

    # Formatar duração total para minutos/horas
    total_duration_str = "Tempo estimado desconhecido"
    if total_duration_seconds > 0:
        minutes = total_duration_seconds // 60
        seconds = total_duration_seconds % 60
        if minutes > 0:
            total_duration_str = f"{minutes:.0f} minutos"
            if seconds > 0 and minutes < 60: # Adiciona segundos apenas se for menos de uma hora
                 total_duration_str += f" e {seconds:.0f} segundos"
        else:
             total_duration_str = f"{seconds:.0f} segundos"


    instructions.append(f"{len(steps) + 1}. Você chegou ao seu destino. Distância total: {total_distance_str}. Tempo estimado: {total_duration_str}.")


    # Extrair os dados da polyline para desenhar a rota no mapa
    route_overview_polyline = directions_data.get("overview_polyline")

    return "\n".join(instructions), {"overview_polyline": route_overview_polyline}


# Função para gerar instruções de navegação acessíveis com o Gemini (Opcional)
# Manter esta função caso queira refinar as instruções brutas do Google Maps.
async def generate_accessible_instructions_with_gemini(directions_text: str, destination_name: str) -> str:
    """
    Usa o Gemini para refinar ou adicionar contexto às instruções.
    Recebe as instruções já processadas da API (limpas de HTML, etc.).
    """
    print("Chamado generate_accessible_instructions_with_gemini.")
    if not USE_GEMINI_FOR_REFINEMENT or not directions_text:
        print("Gemini não configurado ou instruções vazias, pulando refinamento.")
        return directions_text # Retorna as instruções originais se o Gemini não estiver configurado ou não houver texto

    prompt = f'''
    Reformule as seguintes instruções de navegação a pé para serem extremamente claras, passo a passo, usando linguagem simples e direta, adequada para uma pessoa com deficiência visual que está andando. Mencione pontos de referência se forem citados nas instruções originais ou puderem ser inferidos. Não pule etapas. Mantenha o formato de lista numerada.

    Instruções originais:
    {directions_text}

    Formato desejado:
    Lista de instruções numeradas, claras e concisas para navegação a pé.
    '''

    try:
        print("Enviando prompt para o Gemini...")
        response = model.generate_content(prompt)
        refined_text = response.text
        print("Resposta do Gemini recebida.")
        # Opcional: Adicionar uma verificação simples se a resposta parece útil
        if len(refined_text) > len(directions_text) / 2: # Verifica se a resposta não é muito curta
             return refined_text
        else:
             print("Resposta do Gemini parece muito curta ou irrelevante, usando instruções originais.")
             return directions_text # Fallback se a resposta do Gemini for insatisfatória
    except Exception as e:
        print(f"Erro ao refinar instruções com o Gemini: {e}")
        return f"Não foi possível refinar as instruções. Instruções básicas: {directions_text}" # Fallback em caso de erro


# Função para enviar e-mail (simulada - Conecte com serviço real)
async def send_email(location_data: LocationData):
    """
    Esta função simula o envio de um e-mail com a localização e destino.
    Implementar lógica real de envio de e-mail aqui (smtplib, SendGrid, etc.).
    """
    print(f"Simulando o envio de e-mail com a localização: Latitude={location_data.latitude}, Longitude={location_data.longitude}, Destino='{location_data.destination}'")
    # Exemplo de como gerar um link para o Google Maps com a localização atual:
    # maps_link = f"https://www.google.com/maps?q={location_data.latitude},{location_data.longitude}"
    # corpo_email = f"Estou em {maps_link}, navegando para {location_data.destination}."
    # ... código real para enviar email ...
    pass # Substituir por código de envio real

# Função para enviar mensagem no WhatsApp (simulada - Gere o link real)
async def send_whatsapp_message(location_data: LocationData):
    """
    Esta função simula o envio de uma mensagem no WhatsApp.
    Implementar lógica real de envio aqui (gerar link wa.me).
    """
    print(f"Simulando o envio de mensagem no WhatsApp com a localização: Latitude={location_data.latitude}, Longitude={location_data.longitude}, Destino='{location_data.destination}'")
    # Exemplo de como gerar um link wa.me:
    # maps_link = f"https://www.google.com/maps?q={location_data.latitude},{location_data.longitude}"
    # message_text = f"Minha localização: {maps_link}. Navegando para: {location_data.destination}"
    # phone_number = "55XXYYYYYYYYY" # Substitua pelo número do familiar (com código do país e DDD)
    # whatsapp_link = f"https://wa.me/{phone_number}?text={requests.utils.quote(message_text)}"
    # print(f"Link gerado para WhatsApp (simulação): {whatsapp_link}") # Para simulação, pode imprimir o link

    pass # Substituir por código de envio real ou lógica para retornar link para frontend


@app.post("/navigate/", response_model=NavigationResponse)
async def navigate(location_data: LocationData):
    """
    Endpoint para receber dados de localização, obter instruções de navegação
    usando a Google Directions API, e enviar de volta instruções e dados da rota.
    """
    print(f"Requisição POST recebida para /navigate/ com: Destino='{location_data.destination}', Localização=({location_data.latitude}, {location_data.longitude})")

    instructions_text = ""
    route_data = None

    # --- PASSO 1: Obter instruções de rota e dados da Google Directions API ---
    print(f"Obtendo rota de ({location_data.latitude}, {location_data.longitude}) para '{location_data.destination}' usando Google Directions API.")
    directions_data = await get_google_directions(location_data.latitude, location_data.longitude, location_data.destination)

    if directions_data:
        # --- PASSO 2: Processar Resposta do Google Directions e extrair dados ---
        print("Processando dados de rota do Google Directions.")
        instructions_text, route_data = await process_google_directions_response(directions_data)

        # --- PASSO 3 (OPCIONAL): Refinar Instruções com Gemini ---
        if USE_GEMINI_FOR_REFINEMENT and instructions_text: # Verifique se há instruções antes de refinar
            print("Refinando instruções com Gemini.")
            instructions_text = await generate_accessible_instructions_with_gemini(instructions_text, location_data.destination)


        # --- PASSO 4: ENVIAR EMAIL/WHATSAPP (Simulação/Conexão Real) ---
        # Decida a frequência com que isso ocorre (pode ser a cada atualização de localização, ou em pontos chave da rota)
        # Neste exemplo, é chamado a cada atualização que resulta em instruções válidas.
        print("Chamando funções de compartilhamento (simulação/real).")
        await send_email(location_data)
        await send_whatsapp_message(location_data)


    else:
        print("Não foi possível obter a rota da Google Directions API.")
        instructions_text = f"Não foi possível obter as instruções de navegação para '{location_data.destination}' a partir da sua localização atual via Google Maps. Verifique o destino e sua conexão."
        route_data = None # Garante que routeData é None se a rota não for encontrada


    # Inclua os dados da rota (polyline) na resposta para o frontend
    response_data = {"instructions": instructions_text}
    if route_data:
        response_data["routeData"] = route_data

    print("Resposta para o frontend preparada.")
    return response_data


# --- Opcional: Endpoint para compartilhamento explícito ---
# Se o botão "Compartilhar Localização" no frontend chamar um endpoint separado, você pode implementá-lo aqui.
@app.post("/share_location/")
async def share_location_endpoint(location_data: LocationData):
    print(f"Requisição POST recebida para /share_location/ com: ({location_data.latitude}, {location_data.longitude}), Destino='{location_data.destination}'")
    # Implemente a lógica real de envio de email e whatsapp aqui, usando os dados recebidos
    await send_email(location_data) # Chame suas funções de envio reais
    await send_whatsapp_message(location_data)
    print("Processamento de compartilhamento concluído (simulação/em progresso).")
    return {"message": "Localização compartilhada (simulação/em progresso)."}