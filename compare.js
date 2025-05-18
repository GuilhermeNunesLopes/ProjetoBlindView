const screens = document.querySelectorAll('.screen');
const fontSizeValueSpan = document.getElementById('font-size-value');
const body = document.body;
const detailedInstructionsContainer = document.getElementById('detailed-instructions-container');
const currentDetailedInstruction = document.getElementById('current-detailed-instruction');
const nextStepsList = document.getElementById('next-steps');

let currentLocation = null;
let locationPromise = null;

function showScreen(id) {
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showMainNavigation() {
    showScreen('main-navigation');
}

function showSetDestination() {
    showScreen('set-destination');
    currentDetailedInstruction.innerText = "Obtendo sua localização...";
    locationPromise = getCurrentLocation();
    locationPromise.then(location => {
        if (location) {
            currentDetailedInstruction.innerText = `Localização obtida: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
        } else {
            currentDetailedInstruction.innerText = "Não foi possível obter a localização.";
        }
    }).catch(error => {
        currentDetailedInstruction.innerText = `Erro ao obter localização: ${error.message || error}`;
    });
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    console.log("Localização obtida:", currentLocation);
                    resolve(currentLocation);
                },
                error => {
                    console.error("Erro ao obter localização:", error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                } // Opções para melhor precisão
            );
        } else {
            console.error("Geolocalização não suportada pelo navegador.");
            reject("Geolocalização não suportada.");
        }
    });
}

async function startNavigation() {
    const destination = document.getElementById('destination-input').value;
    if (destination) {
        currentDetailedInstruction.innerText = "Iniciando navegação...";
        nextStepsList.innerHTML = '';
        console.log(`Iniciando navegação para: ${destination}`);

        try {
            let location;
            if (currentLocation) {
                location = currentLocation;
            } else if (locationPromise) {
                location = await locationPromise;
            } else {
                location = await getCurrentLocation();
            }
            if (location) {
                currentDetailedInstruction.innerText = "Pesquisando instruções detalhadas...";
                console.log("Enviando localização para a API:", location);

                // Chamada à API (substitua com sua chamada real, enviando a localização)
                const response = await fetch('http://127.0.0.1:8000/navigate/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        destination: destination,
                        latitude: location.latitude,
                        longitude: location.longitude
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                console.log("Resposta da API:", data);

                // Exibir os dados na página
                if (data.instructions) {
                    // Processar a resposta do Gemini para formatar
                    const formattedInstructions = data.instructions
                        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Negrito
                        .replace(/(\d+\.)/g, '<br><b>$1</b>'); // Nova linha e negrito para passos numerados
                    nextStepsList.innerHTML = formattedInstructions;
                    //currentDetailedInstruction.innerText = "Instruções encontradas:";  // REMOVIDA
                    currentDetailedInstruction.innerText = formattedInstructions;   // ADICIONADA

                } else {
                    currentDetailedInstruction.innerText = "Instruções não encontradas.";
                    nextStepsList.innerHTML = '';
                }

                showScreen('navigation-screen');
            } else {
                currentDetailedInstruction.innerText = "Não foi possível obter a localização.";
            }
        } catch (error) {
            currentDetailedInstruction.innerText = `Erro: ${error.message || error}`;
        }
    } else {
        alert('Por favor, digite um destino.');
    }
}

function shareLocation() {
    if (currentLocation) {
        alert(`Compartilhando sua localização: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)} (Simulação)`);
        console.log("Compartilhando localização:", currentLocation);
        // Aqui você chamaria a sua API para enviar a localização com os dados de currentLocation
    } else {
        alert('Localização não disponível para compartilhar.');
    }
}

function showSettings() {
    showScreen('settings-screen');
}

function adjustFontSize(size) {
    body.style.fontSize = `${size}px`;
    fontSizeValueSpan.innerText = `${size}px`;
}

function applyContrast(theme) {
    body.classList.remove('high-contrast');
    if (theme === 'high') {
        body.classList.add('high-contrast');
    }
}

// Inicialmente mostrar a tela de navegação principal
showMainNavigation();