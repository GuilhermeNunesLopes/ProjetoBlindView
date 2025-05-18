from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite todas as origens (para desenvolvimento)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração da API do Gemini
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("A chave da API do Google (GOOGLE_API_KEY) não foi configurada no arquivo .env")
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash-preview-04-17')

# Modelo para receber dados de localização
class LocationData(BaseModel):
    latitude: float
    longitude: float
    destination: str

# Modelo para a resposta com as instruções
class NavigationResponse(BaseModel):
    instructions: str

# Função para obter informações do Google Maps e Street View (simplificada)
async def get_google_info(latitude: float, longitude: float, destination: str) -> str:
    """
    Esta função simula a obtenção de informações do Google Maps e Street View.
    Em um cenário real, você faria chamadas às APIs do Google Maps e Street View aqui.
    """
    return f"Simulação de informações do Google Maps e Street View para a localização ({latitude}, {longitude}) com destino a {destination}."

# Função para gerar instruções de navegação com o Gemini
async def generate_navigation_instructions(location_info: str) -> str:
    """
    Gera instruções de navegação acessíveis usando o Gemini.
    """
    prompt = f'''
       Com base na informação de localização do usuário: '{location_info}' , você deverá, levar em conta o metodo de transporte como uma pessoa andando a pé, 
       com isso em consideração, não pule etapas, verifique sua resposta antes de enviar para o usuário, usando como referencia a informação mais atualizada de rota disponível 
       através do google maps, e indique o caminho, com as orientações de ruas para seguir, 
       pontos de referencia para checar se está seguindo o caminho certo, e informe sempre de maneira padronizada.
       Exemplo :        
       "Você está atualmente na rua : nome da rua atual e quer chegar no local : Nome do local desejado. "       
       "Siga em frente para a rua X, na altura do numero Y vire para tal direção, siga tantos metros para a direção tal"        
       Você deve após a primeira instrução, antes de dar a proxima direção, receber a informação de localização atualizada do usuário para validar que ele está seguindo o caminho correto.
    '''
    
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar instruções com o Gemini: {e}")

# Função para enviar e-mail (simulada)
async def send_email(location_data: LocationData):
    """
    Esta função simula o envio de um e-mail com a localização.
    Em um cenário real, você usaria a biblioteca smtplib para enviar o e-mail.
    """
    print(f"Simulando o envio de e-mail com a localização: Latitude={location_data.latitude}, Longitude={location_data.longitude}, Destino={location_data.destination}")
    return {"message": "E-mail enviado (simulação)"}

# Função para enviar mensagem no WhatsApp (simulada)
async def send_whatsapp_message(location_data: LocationData):
    """
    Esta função simula o envio de uma mensagem no WhatsApp.
    Em um cenário real, você usaria uma biblioteca como pywhatkit ou a API oficial do WhatsApp Business.
    """
    print(f"Simulando o envio de mensagem no WhatsApp com a localização: Latitude={location_data.latitude}, Longitude={location_data.longitude}, Destino={location_data.destination}")
    return {"message": "Mensagem WhatsApp enviada (simulação)"}

@app.post("/navigate/", response_model=NavigationResponse)
async def navigate(location_data: LocationData):
    """
    Endpoint para receber dados de localização e gerar instruções de navegação.
    """
    google_info = await get_google_info(location_data.latitude, location_data.longitude, location_data.destination)
    instructions = await generate_navigation_instructions(google_info)
    await send_email(location_data)
    await send_whatsapp_message(location_data)
    return NavigationResponse(instructions=instructions) 