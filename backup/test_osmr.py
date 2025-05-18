import requests
import logging
import http.client as http_client
import sys
import urllib3
import ssl # Apenas para checar a versão, não usado diretamente para HTTP

# --- Configuração de logging verboso ---
http_client.HTTPConnection.debuglevel = 1 # Habilita debug no nível de http.client
logging.basicConfig(level=logging.DEBUG) # Define o handler básico e nível para o logger root
# Configura loggers específicos para requests e urllib3 para garantir que capturem tudo
logging.getLogger("requests").setLevel(logging.DEBUG)
logging.getLogger("urllib3").setLevel(logging.DEBUG)
# Não precisa de requests_log.propagate = True se o logger root já estiver configurado para DEBUG

print(f"--- Diagnostic Information ---")
print(f"Python version: {sys.version}")
print(f"requests version: {requests.__version__}")
print(f"urllib3 version: {urllib3.__version__}")
try:
    print(f"OpenSSL version: {ssl.OPENSSL_VERSION}")
except AttributeError:
    print(f"OpenSSL version: N/A (ssl.OPENSSL_VERSION not available)")

# --- Verificação de Proxy ---
proxies = requests.utils.getproxies()
if proxies:
    print(f"System Proxies Detected: {proxies}")
else:
    print("No System Proxies Detected by requests.")

# --- Dados da Requisição ---
# Coordenadas e parâmetros do seu exemplo curl funcional
lon1, lat1 = -46.3655691, -23.5234191
lon2, lat2 = -46.6559677, -23.5614961

origin_coords = f"{lon1},{lat1}"
destination_coords = f"{lon2},{lat2}"

base_path = f"http://router.project-osrm.org/route/v1/walking/{origin_coords};{destination_coords}"
# Parâmetros na ordem exata da sua URL curl funcional
query_string_manual = "steps=true&geometries=geojson&overview=simplified&language=pt-BR"
full_url_manual = f"{base_path}?{query_string_manual}"

# Cabeçalhos (tente ser o mais próximo possível do seu curl -v)
# Verifique o User-Agent exato que seu 'curl -v' mostra!
headers = {
    'User-Agent': 'curl/7.81.0',  # EXEMPLO! Substitua pelo User-Agent do SEU curl.
    'Accept': '*/*',
    'Connection': 'keep-alive', # Algumas versões do curl podem enviar isso.
}

print(f"\n--- Standalone Test V2 ---")
print(f"Attempting to GET (URL construída manualmente): {full_url_manual}")
print(f"Headers: {headers}")

try:
    # Teste 1: Usando a URL completamente montada manualmente
    # response = requests.get(full_url_manual, headers=headers, timeout=20, proxies={'http': None, 'https': None}) # Desabilita proxies para teste

    # Teste 2: Deixando requests montar a query string a partir de um dict (para comparação, se o Teste 1 falhar)
    params_dict = {
        "steps": "true",
        "geometries": "geojson",
        "overview": "simplified",
        "language": "pt-BR"
    }
    # response = requests.get(base_path, params=params_dict, headers=headers, timeout=20, proxies={'http': None, 'https': None})

    # Escolha UM dos testes acima para executar por vez (descomente um `response = ...`)
    # Vamos começar com a URL manual, que é mais próxima do curl.
    response = requests.get(full_url_manual, headers=headers, timeout=20)


    print(f"\n--- OSRM RESPONSE INFO (Standalone V2) ---")
    print(f"Effective URL called: {response.url}") # URL que requests realmente usou
    print(f"Status code: {response.status_code}")
    print(f"Response headers: {response.headers}")

    response.raise_for_status() # Levanta uma exceção para status 4xx/5xx
    data = response.json()
    print("\nRoute data (JSON Response):")
    # print(data) # Pode ser muito longo, imprima apenas uma parte ou chaves específicas
    if isinstance(data, dict) and 'routes' in data:
        print(f"Found {len(data['routes'])} route(s).")
    else:
        print("Response JSON structure not as expected.")

    print("\nSuccess!")

except requests.exceptions.HTTPError as http_err:
    print(f"\nHTTP Error: {http_err}") # Mensagem do erro
    if http_err.response is not None:
        print(f"Status Code from Error: {http_err.response.status_code}")
        print(f"Error Response Headers: {http_err.response.headers}")
        print(f"Error Response Content (first 1000 chars): {http_err.response.text[:1000]}")
except requests.exceptions.Timeout:
    print(f"\nTimeout after 20 seconds.")
except requests.exceptions.ProxyError as proxy_err:
    print(f"\nProxy Error: {proxy_err}")
    print(f"This might indicate an issue with system proxies: {proxies}")
except requests.exceptions.RequestException as e:
    print(f"\nGeneral Request Error: {e}") # Outros erros de request
    if e.response is not None:
        print(f"Error Response Content (first 1000 chars): {e.response.text[:1000]}")
except Exception as ex:
    print(f"\nAn unexpected error occurred: {ex}")
    import traceback
    traceback.print_exc()