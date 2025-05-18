const screens = document.querySelectorAll('.screen');
const fontSizeValueSpan = document.getElementById('font-size-value');
const body = document.body;
const detailedInstructionsContainer = document.getElementById('detailed-instructions-container');
const currentDetailedInstruction = document.getElementById('current-detailed-instruction');
const nextStepsList = document.getElementById('next-steps');
const destinationInput = document.getElementById('destination-input');
const startNavigationButton = document.querySelector('#set-destination .button-group .primary');
const loadingIndicator = document.getElementById('loading-indicator');
const startSpeechRecognitionButton = document.getElementById('start-speech-recognition');
const speechStatusMessage = document.getElementById('speech-status-message');


let currentLocation = null;
let watchId = null; // Variável para armazenar o ID do watcher de geolocalização
let destination = null; // Armazenar o destino atual da navegação
let lastSpokenInstruction = ""; // Adiciona uma variável para controlar a última instrução falada

// Variáveis do Google Maps
let map; // Objeto Google Map
// Mude o tipo da variável para AdvancedMarkerElement
let userLocationMarker; // Marcador da localização do usuário (agora AdvancedMarkerElement)
let routePolyline; // Objeto Polyline para a rota
let googleMapsApiLoaded = false; // Flag para saber se a API do Google Maps carregou


// Variáveis para o reconhecimento de fala
let recognition; // Variável para a instância do SpeechRecognition

// Função para exibir mensagens na tela de Definir Destino
function displaySpeechStatus(message, isError = false) {
    if (speechStatusMessage) {
        speechStatusMessage.innerText = message;
        speechStatusMessage.style.color = isError ? 'red' : 'inherit';
    } else {
        console.warn("Elemento speech-status-message não encontrado para exibir:", message);
        if (isError) alert("Erro na fala: " + message); // Fallback para alert
    }
}

// Função para inicializar o reconhecimento de fala
function initializeSpeechRecognition() {
    console.log("Tentando inicializar o reconhecimento de fala...");
    // Verifica se a API é suportada pelo navegador
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        console.warn("Reconhecimento de fala não suportado neste navegador.");

        // Oculta o botão 'Falar Destino'
        if (startSpeechRecognitionButton) {
            startSpeechRecognitionButton.style.display = 'none';
        }
        displaySpeechStatus("Reconhecimento de voz não disponível neste navegador. Por favor, digite o destino acima.");

        // *** MOSTRAR A MENSAGEM NA TELA ***
        // Usamos o elemento 'currentDetailedInstruction' para feedback
        //if (currentDetailedInstruction) {
        //     currentDetailedInstruction.innerText = "Reconhecimento de voz não disponível neste navegador. Por favor, digite o destino acima.";
        //     // Opcional: Adicionar uma classe ou estilo para destacar a mensagem de aviso
        //     currentDetailedInstruction.style.color = '#cc0000'; // Exemplo: Cor vermelha para aviso
        //     currentDetailedInstruction.style.fontWeight = 'bold'; // Exemplo: Negrito
        //}

        // Remover o alerta, pois a mensagem agora está na tela
        // alert("Seu navegador não suporta reconhecimento de fala.");

        return; // Sai da função se não for suportado
    }
    console.log("Reconhecimento de fala suportado. Inicializando API...");
    // Se a API for suportada, resetamos o feedback de instrução para o estado padrão
    // e garantimos que o botão 'Falar Destino' está visível (se foi ocultado antes)
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    //
    //if (currentDetailedInstruction) {
    //     currentDetailedInstruction.innerText = "Digite o destino ou toque em 'Falar Destino'.";
    //     currentDetailedInstruction.style.color = ''; // Remove cor customizada
    //     currentDetailedInstruction.style.fontWeight = ''; // Remove negrito
    //}
    if (speechStatusMessage) {
         speechStatusMessage.innerText = "Toque em 'Falar Destino' e comece a falar."; // Mensagem inicial para quem tem suporte
         speechStatusMessage.style.color = ''; // Remove cor customizada
         speechStatusMessage.style.fontWeight = ''; // Remove negrito
    }
    if (startSpeechRecognitionButton) {
         startSpeechRecognitionButton.style.display = 'block'; // Garante que o botão aparece
         startSpeechRecognitionButton.innerText = 'Falar Destino'; // Restaura texto
         startSpeechRecognitionButton.disabled = false; // Restaura estado
    }


    // Cria a instância do reconhecimento (este código permanece igual)
    
    // ... (Restante dos event listeners: onstart, onresult, onnomatch, onend, onerror) ...

    // Adiciona o event listener ao botão
   

    // Evento quando a fala começa a ser detectada
    recognition.onstart = function() {
        console.log('Reconhecimento de fala iniciado. Pode falar.');
        // Altera o texto do botão ou adiciona um feedback visual
        if (startSpeechRecognitionButton) {
            startSpeechRecognitionButton.innerText = 'Ouvindo...';
            startSpeechRecognitionButton.disabled = true; // Desabilita enquanto ouve
        }
        currentDetailedInstruction.innerText = "Ouvindo seu destino..."; // Feedback visual na tela
        // Opcional: Adicionar um efeito visual (ex: mudar cor do input)
        destinationInput.classList.add('listening');
    };

    // Evento quando um resultado é obtido
    recognition.onresult = function(event) {
        console.log('Resultado do reconhecimento de fala obtido.');
        const speechResult = event.results[0][0].transcript;
        console.log('Resultado: ' + speechResult);
        
        const lowerCaseSpeechResult = speechResult.toLowerCase()
        // Coloca o texto reconhecido no campo de destino
        destinationInput.value = speechResult;
        currentDetailedInstruction.innerText = `Destino reconhecido: "${speechResult}"`; // Feedback visual
         
   
        const navigationTriggerPhrases = [
            'iniciar navegação',
            'navegar',
            'começar navegação',
            'vamos', // Exemplo de comando mais curto
            'rota' // Outro exemplo
        ];
        
        let commandDetected = false;

        for (const phrase of navigationTriggerPhrases) {
            if (lowerCaseSpeechResult.includes(phrase)) {
                commandDetected = true;
                break; // Sai do loop assim que encontrar uma frase
            }
        }

        if (commandDetected && destinationInput.value.trim() !== '') {
            console.log('Comando de navegação detectado:', speechResult);
            displaySpeechStatus(`Comando "${speechResult}" reconhecido. Iniciando navegação...`);

            // Opcional: Remover a frase de comando do input se ela foi incluída
            let finalDestination = destinationInput.value.trim();
             for (const phrase of navigationTriggerPhrases) {
                 finalDestination = finalDestination.replace(new RegExp(phrase, 'gi'), '').trim();
             }
             destinationInput.value = finalDestination; // Atualiza o input limpando a frase de comando

            // *** CLICA PROGRAMATICAMENTE NO BOTÃO DE INICIAR NAVEGAÇÃO ***
            // startNavigationButton já é a referência obtida no topo do script
            if (startNavigationButton) {
                 startNavigationButton.click(); // Simula um clique no botão
                 console.log("Botão 'Iniciar Navegação' clicado via voz.");
            } else {
                 console.error("Botão 'Iniciar Navegação' não encontrado para clique via voz.");
                 displaySpeechStatus("Erro interno: Não foi possível iniciar a navegação por voz.", true);
            }

        } else {
            // Se nenhum comando foi detectado, apenas coloque o texto reconhecido no input
            destinationInput.value = speechResult;
            displaySpeechStatus(`Destino reconhecido: "${speechResult}". Toque em 'Iniciar Navegação'.`);
             console.log("Destino preenchido via voz.");
        }
        // Restaura o botão e o input
        if (startSpeechRecognitionButton) {
            startSpeechRecognitionButton.innerText = 'Falar Destino';
            startSpeechRecognitionButton.disabled = false;
        }
        destinationInput.classList.remove('listening'); // Remove efeito visual

        // O reconhecimento para automaticamente depois de um resultado
    };

    // Evento quando não há fala detectada (ou fala muito curta)
    recognition.onnomatch = function() {
        console.log('Fala não reconhecida.');
        currentDetailedInstruction.innerText = "Desculpe, não entendi. Tente novamente."; // Feedback visual
         // Restaura o botão e o input
        if (startSpeechRecognitionButton) {
            startSpeechRecognitionButton.innerText = 'Falar Destino';
            startSpeechRecognitionButton.disabled = false;
        }
        destinationInput.classList.remove('listening'); // Remove efeito visual
    };

    // Evento quando o reconhecimento termina
    recognition.onend = function() {
        console.log('Reconhecimento de fala finalizado.');
        // Garante que o botão e o input sejam restaurados se não foram antes (ex: em caso de erro inesperado)
        if (startSpeechRecognitionButton) {
             startSpeechRecognitionButton.innerText = 'Falar Destino';
             startSpeechRecognitionButton.disabled = false;
        }
         destinationInput.classList.remove('listening'); // Remove efeito visual

         // O feedback visual na tela pode ser removido ou atualizado
        if (speechStatusMessage && speechStatusMessage.innerText === "Ouvindo seu destino...") {
              displaySpeechStatus("Pronto para falar destino.");
        }
    };

    // Evento de erro
    recognition.onerror = function(event) {
        console.error('Erro no reconhecimento de fala:', event.error, event);
        let errorMessage = `Erro no reconhecimento de fala: ${event.error}`;
        switch (event.error) {
            case 'no-speech':
                errorMessage = "Nenhuma fala detectada. Tente novamente.";
                break;
            case 'audio-capture':
                errorMessage = "Erro ao acessar o microfone. Verifique as permissões do navegador e do sistema.";
                break;
            case 'not-allowed':
                errorMessage = "Permissão para usar o microfone negada. Por favor, permita o acesso nas configurações do navegador.";
                 // Pode instruir o usuário a como reativar a permissão
                 break;
            case 'network':
                errorMessage = "Erro de rede no reconhecimento de fala. Verifique sua conexão com a internet.";
                break;
            case 'service-not-allowed':
                 errorMessage = "O serviço de reconhecimento de fala não está permitido. Pode ser uma configuração do navegador ou restrição de segurança.";
                 break;
            case 'bad-grammar':
                 errorMessage = "Erro de gramática na resposta do reconhecimento.";
                 break;
            default:
                errorMessage = `Erro desconhecido: ${event.error}`;
                break;
        }
        currentDetailedInstruction.innerText = errorMessage; // Feedback visual do erro
        alert(`Erro na fala: ${errorMessage}`); // Alerta para garantir que o usuário veja

        // Restaura o botão e o input em caso de erro
         if (startSpeechRecognitionButton) {
            startSpeechRecognitionButton.innerText = 'Falar Destino';
            startSpeechRecognitionButton.disabled = false;
        }
         destinationInput.classList.remove('listening'); // Remove efeito visual
    };

    // Adiciona o event listener ao botão
    if (startSpeechRecognitionButton) {
        startSpeechRecognitionButton.addEventListener('click', function() {
            console.log("Botão 'Falar Destino' clicado. Tentando iniciar reconhecimento.");
            // Verifica se já está ouvindo para evitar iniciar múltiplas instâncias
            // O estado 'listening' pode ser verificado por uma flag interna ou pelo estado do botão/UI
             if (startSpeechRecognitionButton.disabled) {
                  console.log("Reconhecimento já em progresso, ignorando clique.");
                  return;
             }
             if (!recognition) {
                  console.error("Erro interno: Objeto 'recognition' não foi inicializado corretamente.");
                  displaySpeechStatus("Erro ao iniciar reconhecimento. A API de voz pode não estar pronta ou suportada inesperadamente.", true);
                  // Pode desabilitar o botão aqui se necessário
                  return; // Sai se recognition não for um objeto válido
             }
             try {
                recognition.start();
                console.log("Chamado recognition.start()");
                displaySpeechStatus("Iniciando reconhecimento...");
             } catch (e) {
                console.error("Erro ao chamar recognition.start():", e);
                currentDetailedInstruction.innerText = `Não foi possível iniciar a fala. ${e.message || e}`;
                alert(`Não foi possível iniciar a fala: ${e.message || e}. Verifique o suporte do navegador e as permissões.`);
                 // Garante que o botão não fique desabilitado se start falhar imediatamente
                 if (startSpeechRecognitionButton) {
                    startSpeechRecognitionButton.innerText = 'Falar Destino';
                    startSpeechRecognitionButton.disabled = false;
                }
             }
        });
         console.log("Event listener adicionado ao botão 'Falar Destino'.");
    } else {
        console.error("Botão com ID 'start-speech-recognition' não encontrado no HTML.");
    }
}
// Função para carregar a API do Google Maps dinamicamente
async function loadGoogleMapsApi() {
    console.log("loadGoogleMapsApi chamado.");
    if (googleMapsApiLoaded) {
        console.log("API do Google Maps já carregada, retornando.");
        return;
    }

    try {
        console.log("Tentando obter chave da API do Google Maps do backend...");
        // Verifique se a URL do endpoint está correta (deve corresponder ao seu main.py)
        // NO SEU main.py, o endpoint é '/Maps_api_key/' - verifique se está correto aqui também
        const response = await fetch('http://127.0.0.1:8000/Maps_api_key/');
        console.log("Resposta do fetch da chave da API recebida. Status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erro HTTP ao obter chave da API:", response.status, errorText);
            throw new Error(`Erro ao obter chave da API: ${response.status}, detalhe: ${errorText.substring(0, 200)}...`);
        }
        const data = await response.json();
        console.log("Dados da chave da API recebidos do backend:", data);

        const apiKey = data.apiKey;
        console.log("Valor da apiKey obtida do backend:", apiKey);

        if (!apiKey) {
            console.error("Chave da API 'apiKey' não encontrada ou vazia na resposta do backend.", data);
            throw new Error("Chave da API não encontrada na resposta do backend.");
        }
        console.log("Chave da API obtida com sucesso e não está vazia.");

        const script = document.createElement('script');
        // *** ADICIONE libraries=marker AQUI (separado por vírgula) ***
        // Também adicione o parâmetro v=beta ou v=weekly para usar Advanced Markers, pois eles podem ser considerados beta
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta&libraries=geometry,marker&callback=initMap`;
        console.log("URL do script da API do Google Maps gerada:", script.src);

        script.async = true;
        script.defer = true;
        // Opcional: Adicionar o atributo loading="async"
        script.setAttribute('loading', 'async');


        // Adiciona listeners para depuração do carregamento do script
        script.onload = () => {
            console.log("Script da API do Google Maps carregado com sucesso (evento onload).");
             // Opcional: Verificar se google.maps e google.maps.marker estão definidos aqui
             if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                  console.log("Objeto google.maps definido após o carregamento do script.");
                  if (typeof google.maps.marker !== 'undefined') {
                       console.log("Biblioteca google.maps.marker definida após o carregamento.");
                  } else {
                       console.error("Biblioteca google.maps.marker NÃO definida após o carregamento. Verifique o parâmetro 'libraries'.");
                  }
             } else {
                  console.error("Objeto google.maps NÃO definido após o carregamento do script.");
             }
        };
        script.onerror = (e) => {
            console.error("Erro ao carregar o script da API do Google Maps (evento onerror):", e);
             currentDetailedInstruction.innerText = "Erro fatal ao carregar o mapa. Verifique a chave da API e as restrições no Google Cloud Console.";
        };


        console.log("Adicionando script da API do Google Maps ao head...");
        document.head.appendChild(script);


        console.log("loadGoogleMapsApi concluído (tentativa de carregar o script da API).");

    } catch (error) {
        console.error("Erro no processo de loadGoogleMapsApi (catch):", error);
        currentDetailedInstruction.innerText = `Erro ao carregar o mapa: ${error.message || error}. Verifique a chave da API e as restrições.`;
    }
}

// Função de callback chamada pela API do Google Maps quando carregada
function initMap() {
    console.log("initMap chamado: API do Google Maps carregada e callback executado.");
    googleMapsApiLoaded = true; // Define a flag

    // Posição inicial do mapa
    const initialPosition = { lat: -23.55052, lng: -46.633309 }; // Exemplo: São Paulo

    try {
        console.log("Tentando inicializar o objeto google.maps.Map com mapId e AdvancedMarkerElement...");
        const mapContainer = document.getElementById("map");
        if (mapContainer) {
            mapContainer.style.display = 'block';

             map = new google.maps.Map(mapContainer, {
                center: initialPosition,
                zoom: 15,
                disableDefaultUI: true,
                // *** ADICIONE SEU MAP ID AQUI ***
                // Você precisa criar um Map Style no Google Cloud Console e associá-lo a um Map ID.
                // Para testes, pode usar 'DEMO_MAP_ID', mas para produção use seu ID real.
                mapId: '335d84375d74a9541dc3d58f', // <--- SUBSTITUA PELO SEU MAP ID REAL ou 'DEMO_MAP_ID'
            });
            console.log("Objeto google.maps.Map inicializado com sucesso:", map);

            // *** USE google.maps.marker.AdvancedMarkerElement ***
            console.log("Adicionando marcador inicial (AdvancedMarkerElement) ao mapa...");
            // Verifique se google.maps.marker.AdvancedMarkerElement está disponível
            if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
                 userLocationMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: map, // Defina o mapa aqui
                    position: initialPosition, // Defina a posição aqui
                    title: "Sua Localização",
                     // Advanced Markers usam 'content' ou 'gmpDraggable', não 'icon' da mesma forma que o Marker antigo.
                     // Para um marcador simples, basta position e map.
                     // Para customizar, usaria a propriedade 'content' com um elemento HTML.
                });
                console.log("Marcador inicial (AdvancedMarkerElement) adicionado:", userLocationMarker);
            } else {
                 console.error("google.maps.marker.AdvancedMarkerElement NÃO está disponível. Verifique se libraries=marker foi incluído na URL da API e se o parâmetro v=beta/weekly está correto.");
                 // Opcional: Voltar a usar google.maps.Marker se AdvancedMarker não estiver disponível
                 // userLocationMarker = new google.maps.Marker({...});
            }


            console.log("Mapa do Google Maps inicializado completamente.");

        } else {
            console.error("Elemento DIV com id='map' não encontrado no HTML.");
            currentDetailedInstruction.innerText = "Erro interno: Contêiner do mapa não encontrado.";
        }


    } catch (error) {
        console.error("Erro durante a inicialização do google.maps.Map ou AdvancedMarkerElement (catch initMap):", error);
         currentDetailedInstruction.innerText = `Erro ao inicializar o mapa: ${error.message || error}.`;
    }
}

// Expõe initMap ao escopo global
window.initMap = initMap;


function showScreen(id) {
    console.log("showScreen chamado com id:", id); // Log no início da função
    screens.forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(id);
    if (targetScreen) {
         targetScreen.classList.add('active');
        console.log("Tela ativa definida como:", id); // Log após definir tela ativa
    } else {
         console.error("Tela com ID '" + id + "' não encontrada.");
         return; // Sai da função se a tela não existir
    }


    // Se a tela de navegação for ativada e a API do Maps ainda não carregou, carregue-a
    if (id === 'navigation-screen') {
        console.log("Tela de navegação ativada. Verificando se API do Maps precisa carregar..."); // Log na condição
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.style.display = 'block'; // Garante que o contêiner do mapa esteja visível
        }


        if (!googleMapsApiLoaded) {
            console.log("API do Maps não carregada, chamando loadGoogleMapsApi..."); // Log antes de chamar load
            loadGoogleMapsApi();
        } else {
            console.log("API do Maps já carregada na ativação da tela de navegação."); // Log se já carregou
             // Se o mapa já carregou e você está voltando para a tela de navegação,
             // pode precisar recentralizar o mapa ou garantir que os elementos estejam visíveis.
             if (map && currentLocation) {
                  console.log("Recentralizando mapa na localização atual.");
                  // userLocationMarker.position é a forma correta para AdvancedMarkerElement
                  // map.setCenter(userLocationMarker.position); // Use a posição do marcador, se existir
                   const currentLatLng = new google.maps.LatLng(currentLocation.latitude, currentLocation.longitude);
                   map.setCenter(currentLatLng);

             } else if (map) {
                  console.log("Mapa carregado, mas localização atual desconhecida. Centralizando no padrão.");
                  // Centralize no padrão se a localização atual for desconhecida
                  const initialPosition = { lat: -23.55052, lng: -46.633309 };
                  map.setCenter(initialPosition);
             } else {
                  console.warn("Mapa não inicializado, apesar de googleMapsApiLoaded ser true.");
             }
        }


    } else {
         // Esconde o contêiner do mapa em outras telas (opcional)
         const mapContainer = document.getElementById('map');
         if (mapContainer) {
              mapContainer.style.display = 'none';
         }
    }
    console.log("showScreen concluído."); // Log final da função
}

function showMainNavigation() {
    console.log("showMainNavigation chamado."); // Log na função
    stopNavigation();
    showScreen('main-navigation');
}

function showSetDestination() {
    console.log("showSetDestination chamado."); // Log na função
    showScreen('set-destination');
    //currentDetailedInstruction.innerText = "Preparando para definir destino...";
    initializeSpeechRecognition(); 
    console.log("showSetDestination concluído."); // Log final da função
}

async function startNavigation() {
    console.log("startNavigation chamado."); // Log no início da função
    destination = document.getElementById('destination-input').value;
    if (destination) {
        currentDetailedInstruction.innerText = "Iniciando navegação...";
        nextStepsList.innerHTML = '';
        console.log(`Iniciando navegação para: ${destination}`);

        startNavigationButton.disabled = true;
        loadingIndicator.style.display = 'block';

        // *** NOVA ORDEM: Primeiro mude para a tela de navegação para INICIAR o carregamento do mapa. ***
        console.log("Chamando showScreen('navigation-screen') para iniciar o carregamento do mapa...");
        showScreen('navigation-screen'); // <--- CHAME PRIMEIRO A TELA DE NAVEGAÇÃO
        console.log("Retornou de showScreen('navigation-screen').");


        // *** AGORA, espere pelo mapa. A chamada initMap() (acionada por showScreen -> loadGoogleMapsApi)
        // deverá definir a variável 'map' enquanto esta espera está ativa. ***
        console.log("Verificando se o mapa está inicializado após a mudança de tela e aguardando...");
        if (!map) {
             console.log("Mapa ainda não inicializado após a mudança de tela, esperando...");
             await new Promise((resolve, reject) => {
                 const checkMap = setInterval(() => {
                     if (map) {
                         console.log("Mapa inicializado durante a espera (após mudança de tela).");
                         clearInterval(checkMap);
                         resolve();
                     }
                 }, 100);
                 setTimeout(() => {
                      if (!map) {
                           clearInterval(checkMap);
                           console.error("Tempo limite esgotado esperando a inicialização do mapa após mudança de tela.");
                           reject(new Error("Tempo limite esgotado para inicialização do mapa."));
                      }
                 }, 15000); // Espera por 15 segundos
             });
        } else {
             console.log("Mapa já estava inicializado antes da espera (após mudança de tela).");
        }


        try {
            // *** AGORA que o mapa deve estar carregado/inicializado, obtenha a localização e calcule a rota. ***
            console.log("Obtendo localização inicial única (após tentar inicializar o mapa)...");
            // *** ADICIONE ESTES LOGS ANTES E DEPOIS DO AWAIT ***
            console.log("DEBUG_SN: Antes de await getCurrentLocationSingle()."); // DEBUG Log
            currentLocation = await getCurrentLocationSingle(); // <--- A PROMESSA DESTA LINHA ESTÁ CONCLUINDO (resolvendo ou rejeitando)
            console.log("DEBUG_SN: Depois de await getCurrentLocationSingle(). Promessa concluída."); // DEBUG Log

            // *** ADICIONE LOG PARA VER O VALOR DE currentLocation ***
            console.log("DEBUG_SN: Valor de currentLocation obtido:", currentLocation); // DEBUG Log


            if (currentLocation) {
                 console.log("DEBUG_SN: Entrando no if (currentLocation)."); // DEBUG Log

                currentDetailedInstruction.innerText = "Localização inicial obtida. Calculando rota...";

                console.log("DEBUG_SN: Enviando localização inicial para o backend..."); // DEBUG Log
                const initialResponse = await sendLocationToBackend(currentLocation.latitude, currentLocation.longitude, destination);
                console.log("DEBUG_SN: Resposta inicial do backend recebida:", initialResponse); // DEBUG Log

                console.log("DEBUG_SN: Chamando processNavigationResponse..."); // DEBUG Log
                processNavigationResponse(initialResponse);
                console.log("DEBUG_SN: Retornou de processNavigationResponse."); // DEBUG Log

                // showScreen('navigation-screen'); // REMOVIDO, já chamamos no início da função

                startLocationTracking(); // Inicia o monitoramento contínuo

            } else {
                 console.log("Não foi possível obter a localização inicial (currentLocation é falso)."); // Log ajustado
                currentDetailedInstruction.innerText = "Não foi possível obter a localização inicial.";
                 loadingIndicator.style.display = 'none';
                 startNavigationButton.disabled = false;
            }
        } catch (error) {
            console.error("DEBUG_SN: Erro capturado no bloco try/catch de startNavigation:", error); // *** ESTE LOG APARECE AGORA? Qual a mensagem completa? ***
             currentDetailedInstruction.innerText = `Erro ao iniciar navegação: ${error.message || error}`;
             loadingIndicator.style.display = 'none';
             startNavigationButton.disabled = false;
        } finally {
            // Removido a limpeza de loading/button do finally, pois agora é feito no catch/else
             console.log("DEBUG_SN: Bloco finally de startNavigation concluído."); // DEBUG Log
        }
    } else {
        alert('Por favor, digite um destino.');
        console.log("startNavigation: Destino não digitado."); // Log ajustado
    }
    console.log("startNavigation concluído (iniciou o processo)."); // Log final da função
}

// Função para obter a localização uma única vez (usada no início)
function getCurrentLocationSingle() {
    console.log("getCurrentLocationSingle chamado para obter localização inicial precisa.");
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            console.log("Geolocation API disponível, tentando obter getCurrentPosition com alta precisão...");

            const DESIRED_ACCURACY_THRESHOLD = 20; // Ajuste conforme necessário
            let bestPosition = null; // Para armazenar a posição mais precisa encontrada até agora
            let watchIdForSingleFix = null; // Usar watchPosition para monitorar fixes e pegar o melhor
            let timeoutCleared = false; // Flag para controlar se o timeout foi limpo

            console.log(`GCLS: Configurando watchPosition para precisão <= ${DESIRED_ACCURACY_THRESHOLD}m ou timeout.`); // DEBUG Log

            // Usamos watchPosition temporariamente para monitorar fixes de localização
            // até obtermos um com a precisão desejada ou atingirmos um timeout.
            watchIdForSingleFix = navigator.geolocation.watchPosition(
                position => {
                    console.log(`GCLS: Fix de localização obtido: Latitude=${position.coords.latitude}, Longitude=${position.coords.longitude}, Precisão=${position.coords.accuracy} metros.`);

                    // Armazena a posição se for a primeira ou mais precisa que a anterior
                    if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                        bestPosition = position;
                        console.log(`GCLS: Armazenando este fix como o melhor até agora (Precisão: ${bestPosition.coords.accuracy}m).`);
                    }


                    // Verifica se a precisão desejada foi atingida
                    if (position.coords.accuracy <= DESIRED_ACCURACY_THRESHOLD) {
                        console.log(`GCLS: Precisão desejada (${DESIRED_ACCURACY_THRESHOLD}m) atingida. Parando watchPosition e resolvendo.`);
                        if (watchIdForSingleFix !== null) {
                             navigator.geolocation.clearWatch(watchIdForSingleFix); // Para de monitorar
                             watchIdForSingleFix = null; // Reseta o ID
                        }
                        if (!timeoutCleared) { // Garante que não limpa um timeout já acionado
                           console.log("GCLS: Limpando overallTimeout pois precisão atingida.");
                           clearTimeout(overallTimeout);
                           timeoutCleared = true;
                        }
                        resolve({ // Resolve a promessa com a melhor posição encontrada (que atende ao limiar)
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                            // Opcional: você pode incluir accuracy aqui se precisar no frontend/backend
                            // accuracy: position.coords.accuracy
                        });
                    }
                    // Continua monitorando se a precisão desejada ainda não foi atingida

                },
                error => {
                    console.error("GCLS: Erro durante o monitoramento para fix inicial preciso (watchPosition callback):", error);
                    // Em caso de erro no watchPosition callback, rejeita a promessa
                    if (watchIdForSingleFix !== null) {
                        navigator.geolocation.clearWatch(watchIdForSingleFix);
                        watchIdForSingleFix = null;
                    }
                     if (!timeoutCleared) { // Garante que não limpa um timeout já acionado
                       console.log("GCLS: Limpando overallTimeout pois erro no watchPosition.");
                       clearTimeout(overallTimeout);
                       timeoutCleared = true;
                    }
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 30000, // Timeout para cada tentativa de fix (pode ser menor)
                    maximumAge: 0 // Não usar cache
                }
            );

            // Adiciona um timeout geral caso não consiga um fix com a precisão desejada a tempo
            const overallTimeout = setTimeout(() => {
                 console.warn(`GCLS: Tempo limite (${50} segundos) esgotado para obter fix inicial preciso. Verificando melhor posição encontrada...`);
                if (watchIdForSingleFix !== null) {
                    console.log("GCLS: Limpando watchPosition no overallTimeout.");
                    navigator.geolocation.clearWatch(watchIdForSingleFix);
                    watchIdForSingleFix = null;
                }
                 timeoutCleared = true; // Marca o timeout como acionado

                if (bestPosition) {
                    console.log(`GCLS: Resolvendo com a melhor posição encontrada (Precisão: ${bestPosition.coords.accuracy}m).`);
                    resolve({ // Resolve com o melhor fix obtido dentro do timeout
                         latitude: bestPosition.coords.latitude,
                         longitude: bestPosition.coords.longitude
                         // accuracy: bestPosition.coords.accuracy // Opcional
                    });
                } else {
                    console.error("GCLS: Não foi possível obter NENHUM fix de localização dentro do tempo limite.");
                    reject(new Error("Não foi possível obter a localização inicial dentro do tempo limite.")); // Rejeita se nenhum fix foi obtido
                }
            }, 50000); // <--- TEMPO LIMITE GERAL (em milissegundos)

             // Cleanup: Limpa o overallTimeout se a promessa resolver ou rejeitar antes
             // Usa Promise.race ou eventos se a promessa original não for diretamente acessível
             // A lógica de clear dentro dos callbacks de watchPosition e overallTimeout já lida com isso.
             // Removendo o cleanup Promise.allSettled para simplificar, pois os clearTimeouts estão nos callbacks.

        } else {
            console.error("GCLS: Geolocalização não suportada pelo navegador.");
            reject("Geolocalização não suportada.");
        }
    });
}
let lastBackendUpdateTime = 0; // Variável para controlar o tempo da última atualização enviada ao backend
const BACKEND_UPDATE_INTERVAL = 10000;

// Função para iniciar o monitoramento contínuo da localização
function startLocationTracking() {
    console.log("startLocationTracking chamado.");
    // ... variáveis lastBackendUpdateTime, BACKEND_UPDATE_INTERVAL ...

    if (navigator.geolocation) {
         console.log("Geolocation API disponível, tentando watchPosition...");
        watchId = navigator.geolocation.watchPosition(
            async (position) => {
                currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                console.log("Localização atualizada via watchPosition:", currentLocation);

                // *** ATUALIZE A POSIÇÃO DO AdvancedMarkerElement ***
                if (userLocationMarker) { // Verifica se o marcador existe
                     console.log("Atualizando posição do AdvancedMarkerElement no mapa.");
                     // AdvancedMarkerElement usa a propriedade 'position' diretamente com LatLngLiteral ou LatLng
                    userLocationMarker.position = {
                         lat: currentLocation.latitude,
                         lng: currentLocation.longitude
                    };
                     // Opcional: Centralizar o mapa na nova localização (pode ser ajustado)
                     // if (map) {
                     //      map.setCenter(userLocationMarker.position);
                     // }
                } else {
                     console.log("AdvancedMarkerElement não disponível para atualizar a posição.");
                }


                const currentTime = Date.now();
                if (currentTime - lastBackendUpdateTime > BACKEND_UPDATE_INTERVAL) {
                     console.log(`Intervalo de ${BACKEND_UPDATE_INTERVAL / 1000} segundos atingido. Enviando localização atualizada para o backend.`);
                     lastBackendUpdateTime = currentTime;

                    try {
                         console.log("Enviando localização atualizada para o backend...");
                        const updatedResponse = await sendLocationToBackend(currentLocation.latitude, currentLocation.longitude, destination);
                         console.log("Resposta atualizada do backend recebida:", updatedResponse);
                        processNavigationResponse(updatedResponse);
                    } catch (error) {
                        console.error("Erro ao enviar localização atualizada para o backend:", error);
                        currentDetailedInstruction.innerText = `Erro ao atualizar navegação: ${error.message || error}`;
                    }
                } else {
                     console.log("Intervalo de atualização do backend não atingido. Pulando envio de localização.");
                     // A atualização do marcador já foi feita acima, fora do if do intervalo do backend
                }


            },
            (error) => {
                console.error("Erro no monitoramento da localização (watchPosition):", error);
                currentDetailedInstruction.innerText = `Erro no GPS: ${error.message || error}. Verifique se a localização está ativada e as permissões.`;
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
        currentDetailedInstruction.innerText = "Monitorando sua localização em tempo real...";
         console.log("watchPosition iniciado. watchId:", watchId);
         lastBackendUpdateTime = Date.now(); // Define o tempo inicial da última atualização ao iniciar
    } else {
        console.error("Geolocalização não suportada para monitoramento em startLocationTracking.");
        currentDetailedInstruction.innerText = "Geolocalização não suportada para monitoramento em tempo real.";
    }
     console.log("startLocationTracking concluído.");
}

// Função para parar o monitoramento da localização
function stopNavigation() {
    console.log("stopNavigation chamado.");
    if (watchId !== null) {
        console.log("Parando watchPosition com id:", watchId);
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log("Monitoramento de geolocalização parado.");
    } else {
         console.log("watchId é null, nenhum monitoramento ativo para parar.");
    }
    currentLocation = null;
    destination = null;
    currentDetailedInstruction.innerText = "Navegação parada.";
    nextStepsList.innerHTML = '';
    lastSpokenInstruction = "";
    window.speechSynthesis.cancel();
     console.log("Variaveis de navegação resetadas e fala cancelada.");

    // Remover a rota do mapa
    if (routePolyline) {
        console.log("Removendo polyline anterior.");
        routePolyline.setMap(null);
        routePolyline = null;
    } else {
         console.log("routePolyline é null, nenhuma rota para remover.");
    }
    // *** REMOVA O AdvancedMarkerElement do mapa ***
    if (userLocationMarker) {
         console.log("Removendo AdvancedMarkerElement do mapa.");
         // AdvancedMarkerElement é removido definindo a propriedade 'map' para null
        userLocationMarker.map = null;
        userLocationMarker = null;
    } else {
         console.log("userLocationMarker é null, nenhum marcador para remover.");
    }
    // Limpar o mapa (opcional)
    // if (map) {
    //     map = null;
    // }
     console.log("stopNavigation concluído.");

}


// Função para enviar dados de localização para o backend
async function sendLocationToBackend(latitude, longitude, destination) {
    console.log("sendLocationToBackend chamado com:", { latitude, longitude, destination }); // Log no início da função
    // VERIFIQUE A URL DO SEU ENDPOINT NO BACKEND (main.py)
    const backendUrl = 'http://127.0.0.1:8000/navigate/'; // Certifique-se que a URL está correta
    console.log("Enviando POST para:", backendUrl); // Log da URL

    try {
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: destination,
                latitude: latitude,
                longitude: longitude
            })
        });
        console.log("Resposta do backend recebida. Status:", response.status); // Log do status

        if (!response.ok) {
             const errorText = await response.text(); // Tenta ler o corpo do erro
             console.error("Erro HTTP na resposta do backend:", response.status, errorText); // Log do error HTTP e corpo
            throw new Error(`Erro HTTP! status: ${response.status}, detalhe: ${errorText.substring(0, 200)}...`); // Limita o detalhe do erro
        }

        const data = await response.json();
        console.log("Dados JSON do backend recebidos:", data); // Log dos dados
        return data;

    } catch (error) {
         console.error("Erro no fetch para o backend:", error); // Log em caso de error no fetch
         // *** REJEITE A PROMESSA COM O ERRO PARA QUE O CATCH EM startNavigation POSSA PEGÁ-LO ***
        throw error;
    }
}

// Função para exibir a rota no mapa (adaptada para a resposta do backend)
function displayRouteOnMap(routeData) {
    console.log("displayRouteOnMap chamado com dados:", routeData); // Log no início da função
    if (!map) {
        console.error("Mapa não inicializado ao tentar exibir a rota.");
        return;
    }

    // Remover rota anterior se existir
    if (routePolyline) {
        console.log("Removendo polyline anterior."); // Log antes de remover
        routePolyline.setMap(null);
    }

    // Exemplo: se o backend retorna uma polyline codificada em routeData.overview_polyline.points
    if (routeData && routeData.overview_polyline && google.maps.geometry && google.maps.geometry.encoding) {
         console.log("Dados de polyline e bibliotecas de geometria disponíveis."); // Log antes de tentar desenhar
         try {
             const path = google.maps.geometry.encoding.decodePath(routeData.overview_polyline.points);
             console.log("Polyline decodificada:", path); // Log do caminho decodificado
              routePolyline = new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: '#007bff',
                strokeOpacity: 0.8,
                strokeWeight: 6
            });

            routePolyline.setMap(map);
            console.log("Polyline da rota adicionada ao mapa.", routePolyline); // Log após adicionar

             // Opcional: Ajustar o zoom para mostrar toda a rota
             if (path.length > 0) {
                 console.log("Ajustando zoom para mostrar a rota completa."); // Log antes de ajustar o zoom
                 const bounds = new google.maps.LatLngBounds();
                 path.forEach(latLng => bounds.extend(latLng));
                 map.fitBounds(bounds);
                 console.log("Zoom ajustado."); // Log após ajustar
             } else {
                  console.log("Caminho da polyline vazio, não ajustando o zoom."); // Log se o caminho estiver vazio
             }
         } catch (e) {
             console.error("Erro ao decodificar ou exibir polyline:", e); // Log de erro na polyline
             console.log("Dados da polyline recebidos:", routeData.overview_polyline.points);
             currentDetailedInstruction.innerText = "Erro ao exibir a rota no mapa."; // Feedback visual
         }


    } else {
        console.warn("Nenhum dado de polyline válido ou biblioteca de geometria do Google Maps não carregada."); // Aviso se não há dados de rota
         console.log("Dados de rota recebidos:", routeData); // Mostra os dados recebidos
         currentDetailedInstruction.innerText = "Não foi possível exibir a rota no mapa."; // Feedback visual
    }
     console.log("displayRouteOnMap concluído."); // Log final da função
}


// Função para processar a resposta do backend e atualizar a UI e falar as instruções
function processNavigationResponse(data) {
    console.log("processNavigationResponse chamado com dados:", data); // Log no início da função

    if (data && data.instructions) { // Verifica se 'data' e 'data.instructions' existem
        console.log("Instruções encontradas na resposta do backend."); // Log se instruções encontradas
        const formattedInstructions = data.instructions
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/(\d+\.)/g, '<br><b>$1</b>');

        nextStepsList.innerHTML = formattedInstructions;
        currentDetailedInstruction.innerText = "Instruções de Navegação:";
        console.log("Instruções exibidas na UI."); // Log após exibir

        // Falar as instruções se forem diferentes da última vez
        if (data.instructions !== lastSpokenInstruction) {
             console.log("Nova instrução, falando:", data.instructions); // Log antes de falar
             // Cancela a fala anterior antes de iniciar a nova
            if (window.speechSynthesis.speaking) {
                console.log("Cancelando fala anterior."); // Log antes de cancelar
                window.speechSynthesis.cancel();
            }
            speakText(data.instructions);
            lastSpokenInstruction = data.instructions;
            console.log("speakText chamado."); // Log após chamar speakText
        } else {
             console.log("Instrução igual à última falada, não falando novamente."); // Log se a instrução for a mesma
        }

    } else {
        console.warn("Nenhuma instrução encontrada na resposta do backend ou resposta inválida."); // Aviso
        console.log("Dados recebidos:", data); // Mostra os dados recebidos
        currentDetailedInstruction.innerText = "Instruções de navegação não disponíveis."; // Feedback visual
        nextStepsList.innerHTML = '';
        lastSpokenInstruction = "";
        window.speechSynthesis.cancel(); // Cancela fala se não houver instruções
    }

    // Chame a função para exibir a rota se os dados estiverem presentes na resposta
    if (data && data.routeData) { // Verifica se 'data' e 'data.routeData' existem
        console.log("Dados de rota encontrados na resposta, chamando displayRouteOnMap."); // Log antes de chamar
        displayRouteOnMap(data.routeData);
    } else {
         console.log("Nenhum dado de rota encontrado na resposta."); // Log se não houver dados de rota
         // Opcional: Limpar rota anterior se a nova resposta não tiver dados de rota
         if (routePolyline) {
             console.log("Nenhum dado de rota na resposta, removendo polyline anterior.");
             routePolyline.setMap(null);
             routePolyline = null;
         }
    }
     console.log("processNavigationResponse concluído."); // Log final da função
}


// --- Funções de Acessibilidade e Compartilhamento ---
// Estas funções são placeholders e precisam de implementação real para enviar emails/mensagens.

function shareLocation() {
    console.log("shareLocation chamado."); // Log na função
    if (currentLocation && destination) { // Garante que há localização e destino
        // Corrigindo o link do Google Maps para usar coordenadas (formato correto é lat,lng)
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${currentLocation.latitude},${currentLocation.longitude}`;
        const message = `Estou em ${mapsLink}, navegando para ${destination}.`;
        console.log("Dados para compartilhamento:", { location: currentLocation, destination: destination, mapsLink: mapsLink }); // Log dados

        alert(`Compartilhando sua localização: ${mapsLink}\nNavegando para: ${destination} (Simulação)`);
        console.log("Simulando o compartilhamento de localização.");

        // Aqui você faria a chamada ao seu backend para o endpoint de compartilhamento real,
        // passando currentLocation e destination. O backend lidaria com o envio de email/whatsapp.
        // fetch('http://127.0.0.1:8000/share_location/', { // Exemplo de chamada, endpoint precisa existir no main.py
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         latitude: currentLocation.latitude,
        //         longitude: currentLocation.longitude,
        //         destination: destination // Incluir o destino para o email/whatsapp
        //     })
        // }).then(response => response.json())
        // .then(data => console.log("Resposta do compartilhamento:", data))
        // .catch(error => console.error("Erro ao compartilhar localização:", error));


    } else {
        console.log("Localização ou destino não disponível para compartilhar.");
        alert('Localização ou destino não disponível para compartilhar.');
    }
     console.log("shareLocation concluído."); // Log final da função
}

function showSettings() {
    console.log("showSettings chamado."); // Log na função
    showScreen('settings-screen');
     console.log("showSettings concluído."); // Log final da função
}

function adjustFontSize(size) {
    console.log("adjustFontSize chamado com size:", size); // Log na função
    body.style.fontSize = `${size}px`;
    fontSizeValueSpan.innerText = `${size}px`;
     console.log("Tamanho da fonte ajustado."); // Log final da função
}

function applyContrast(theme) {
    console.log("applyContrast chamado com theme:", theme); // Log na função
    body.classList.remove('high-contrast');
    if (theme === 'high') {
        body.classList.add('high-contrast');
        console.log("Tema de alto contraste aplicado."); // Log se aplicado
    } else {
        console.log("Tema de contraste normal aplicado."); // Log se normal
    }
     console.log("applyContrast concluído."); // Log final da função
}

// --- Text-to-Speech ---
// Usa a Web Speech API do navegador

function speakText(text) {
    console.log("speakText chamado com texto:", text ? text.substring(0, 50) + '...' : 'Texto vazio'); // Log com trecho do texto
    if (!text) {
         console.warn("speakText chamado com texto vazio.");
         return;
    }
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        // Opcional: Configurar voz, velocidade, tom, etc.
        // utterance.voice = window.speechSynthesis.getVoices().find(voice => voice.lang === 'pt-BR'); // Exemplo para selecionar voz
        // utterance.rate = 1.0;
        // utterance.pitch = 1.0;

        utterance.onstart = () => console.log('Fala iniciada.'); // Log de início da fala
        utterance.onend = () => console.log('Fala terminada.'); // Log de fim da fala
        utterance.onerror = (event) => console.error('Erro na fala:', event.error, event); // Log de erro na fala

        console.log("Chamando window.speechSynthesis.speak()."); // Log antes de falar
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("Web Speech API não suportada neste navegador.");
    }
     console.log("speakText concluído (chamada para speak pode ser assíncrona)."); // Log final da função

}

// --- Inicialização ---
console.log("Fim do script.js, chamando showMainNavigation para iniciar."); // Log no final do script

// Inicialmente mostrar a tela de navegação principal
showMainNavigation(); // Isso chamará showScreen('main-navigation')
// A chamada para loadGoogleMapsApi ocorrerá quando showScreen('navigation-screen') for chamada por startNavigation.