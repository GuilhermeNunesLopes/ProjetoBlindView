# SmartPath - Navegação Acessível

## Descrição do Projeto

SmartPath é um protótipo de aplicação web para navegação acessível, projetado para auxiliar pessoas com deficiência visual a navegar em ambientes urbanos. A aplicação utiliza a API de Geolocalização do navegador para obter a localização do usuário, a API do Google Maps para exibir o mapa e a rota, e um backend em Python (FastAPI) que se comunica com as APIs do Google Maps Directions e, opcionalmente, a API do Google Gemini para calcular rotas e fornecer instruções de navegação acessíveis. A aplicação também inclui funcionalidades básicas de acessibilidade no frontend, como ajuste de tamanho de fonte e tema de alto contraste, e utiliza a Web Speech API para falar as instruções.

## Funcionalidades

* **Definição de Destino:** Permite que o usuário insira o destino desejado para a navegação.
* **Obtenção de Localização:** Utiliza a API de Geolocalização do navegador para obter a localização atual do usuário, com lógica para tentar um fix inicial mais preciso.
* **Visualização de Mapa:** Exibe um mapa interativo utilizando a Google Maps JavaScript API.
* **Marcador de Usuário:** Mostra a localização atual do usuário no mapa usando um Marcador Avançado (`AdvancedMarkerElement`).
* **Cálculo e Exibição de Rota:** Comunica-se com um backend para calcular a rota a pé até o destino e exibe essa rota no mapa.
* **Instruções de Navegação:** Recebe instruções passo a passo do backend e as exibe na tela.
* **Text-to-Speech (Fala):** Utiliza a Web Speech API para falar as instruções de navegação para o usuário.
* **Monitoramento em Tempo Real:** Acompanha a localização do usuário em tempo real e envia atualizações periódicas para o backend para possivelmente recalcular a rota ou obter instruções atualizadas (conforme a lógica do backend).
* **Acessibilidade:** Permite ajustar o tamanho da fonte e aplicar um tema de alto contraste na interface.
* **Compartilhamento de Localização (Simulado):** Inclui uma funcionalidade (atualmente simulada) para compartilhar a localização e o destino do usuário (por exemplo, via e-mail ou WhatsApp).
* **Indicação de Carregamento:** Exibe um indicador visual durante o processamento da navegação.

## Tecnologias Utilizadas

* **Frontend:**
    * HTML, CSS, JavaScript
    * Google Maps JavaScript API (com bibliotecas `geometry` e `marker`)
    * Web Speech API
* **Backend:**
    * Python
    * FastAPI
    * `python-dotenv` (para carregar variáveis de ambiente)
    * `requests` (para requisições HTTP, embora o cliente googlemaps seja o principal para Directions)
    * `googlemaps` (cliente Python para Google Maps APIs, usado para Directions API)
    * `google-generativeai` (cliente Python para Google Gemini API)

## Configuração e Execução

### Pré-requisitos

* Python 3.7+
* `pip` (gerenciador de pacotes do Python)
* Chave da API do Google Cloud Platform com as seguintes APIs habilitadas:
    * Maps JavaScript API
    * Directions API
    * Generative Language API (para o Gemini, se for usar o refinamento)
* Um **Map ID** configurado no Google Cloud Console (necessário para Advanced Markers).

### Backend Setup

1.  Clone ou baixe os arquivos do projeto.
2.  Navegue até a pasta do backend (`main.py`).
3.  Crie um ambiente virtual (opcional, mas recomendado):
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # No Windows, use `.venv\Scripts\activate`
    ```
4.  Instale as dependências do Python:
    ```bash
    pip install fastapi uvicorn python-dotenv googlemaps google-generativeai requests
    ```
5.  Crie um arquivo `.env` na mesma pasta do `main.py` com suas chaves de API:
    ```env
    GOOGLE_API_KEY="SUA_CHAVE_API_GOOGLE_GEMINI"
    Maps_API_KEY="SUA_CHAVE_API_Maps"
    ```
    Substitua `"SUA_CHAVE_API_GOOGLE_GEMINI"` e `"SUA_CHAVE_API_Maps"` pelas suas chaves reais. A `Maps_API_KEY` será usada no backend para a Directions API e fornecida ao frontend.
6.  Execute o servidor FastAPI:
    ```bash
    uvicorn main:app --reload
    ```
    O backend estará rodando em `http://127.0.0.1:8000`.

### Frontend Setup

1.  Navegue até a pasta dos arquivos do frontend (`index.html`, `script.js`, `style.css`).
2.  Você precisa servir esses arquivos estaticamente. A maneira mais simples para desenvolvimento é usar um servidor web simples do Python:
    ```bash
    cd caminho/para/sua/pasta/frontend
    python -m http.server 8000
Diagrama.png    ```
    (Nota: Se o backend já está rodando na porta 8000, use outra porta para o frontend, como 8080: `python -m http.server 8080`. Certifique-se de que a URL do backend no `script.js` (`http://127.0.0.1:8000`) esteja correta).
3.  Abra seu navegador e acesse `http://localhost:8000` (ou a porta que você usou para o servidor estático do frontend).

### Configuração do Google Cloud

* No Google Cloud Console, associe seu Map ID a um Map Style. O Map ID é necessário para que os Advanced Markers funcionem. Substitua `'YOUR_MAP_ID_HERE'` no `script.js` (na função `initMap`) pelo seu Map ID real. Para testes, `'DEMO_MAP_ID'` pode funcionar, mas com limitações.
* Restrinja suas chaves de API no Google Cloud Console por HTTP referrer (para a chave usada no frontend) e por IP (para a chave usada no backend no servidor).

## Fluxo de Funcionamento

O diagrama abaixo ilustra a interação entre os componentes da aplicação:

![SmartPath](Diagrama.png)

![SmartPath Tela Inicial](App.png)
![SmartPath Tela de CarregandoRota](CarregandoRota.png)
![SmartPath Tela de Rota Definida](RotaDefinida.png)