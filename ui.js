// Handle player name submission
document.getElementById('player-name-form').addEventListener('submit', function(e) {
    e.preventDefault();
    startGameWithName();
});

document.getElementById('player-name-submit').addEventListener('click', function(e) {
    e.preventDefault();
    startGameWithName();
});

function startGameWithName() {
    const playerNameInput = document.getElementById('player-name-input');
    let playerName = playerNameInput.value.trim();

    // If name is empty, use a default
    if (!playerName) {
        playerName = "Pilot " + Math.floor(Math.random() * 1000);
    }

    // Store name in localStorage for persistence
    localStorage.setItem('balloonFighterPlayerName', playerName);

    // Hide player name screen
    document.getElementById('player-name-screen').style.display = 'none';

    // Show loading screen
    document.getElementById('loading-screen').style.display = 'flex';

    // Start loading sequence
    startLoading();
}

// Try to retrieve previous name
window.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('balloonFighterPlayerName');
    if (savedName) {
        document.getElementById('player-name-input').value = savedName;
    }
});

// Simulate loading progress
function startLoading() {
    let progress = 0;
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    const startButton = document.getElementById('start-button');

    const loadingInterval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            loadingText.textContent = 'המשחק מוכן!';
            startButton.style.display = 'block';
        }
        loadingBar.style.width = `${progress}%`;
    }, 300);

    startButton.addEventListener('click', () => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('game-ui').style.display = 'block';

        // This tells the game to start and initialize with the player name
        window.gameInitialized = true;

        // Create a custom event to signal the game to start with the player name
        const event = new CustomEvent('gameStart', {
            detail: {
                playerName: localStorage.getItem('balloonFighterPlayerName')
            }
        });
        document.dispatchEvent(event);
    });
}
