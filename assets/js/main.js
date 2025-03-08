// assets/js/main.js (Updated for multiplayer)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { setupScene, scene, camera, renderer, player } from './sceneSetup.js';
import { Plane, currentPlane, switchPlane } from './planeControls.js';
import { createEnvironment, updateEnvironment, balloons, checkCollisions, score, difficultyLevel } from './environment.js';
import { playMusic, nextTrack, previousTrack, stopTrack } from './audio.js';
import { initializeNetwork, updateRemoteBullets, isConnected, playerId, remotePlayers } from './network.js';

const cameraOffsets = {
    'TPS': new THREE.Vector3(0, 30, 45),
    'FPS': new THREE.Vector3(0, 5, 10),
    'TPS Far': new THREE.Vector3(0, 10, 200)
};
let currentCameraView = 'TPS';

// Game state
let multiplayerEnabled = false;
let gameStarted = false;

const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P') switchPlane();
    if (e.key === 'c' || e.key === 'C') switchCamera();
    if (e.key === 'r' || e.key === 'R') currentPlane.startBarrelRoll();
    if (e.key === ']') nextTrack();
    if (e.key === '[') previousTrack();
    if (e.key === ';') stopTrack();
    if (e.key === 'm' || e.key === 'M') toggleMultiplayer(); // New hotkey for multiplayer
    if (e.key === 't' || e.key === 'T') openChatOverlay(); // Chat with other players
});
window.addEventListener('keyup', (e) => keys[e.key] = false);

// Update to the toggleMultiplayer function in main.js

// Multiplayer toggle function
function toggleMultiplayer() {
    if (!multiplayerEnabled) {
        // Connect to multiplayer
        initializeMultiplayer();
        multiplayerEnabled = true;
        showMessage("מצב מרובה משתתפים: מופעל");
        document.getElementById('multiplayer-status').style.display = 'block';
    } else {
        // Disconnect from multiplayer
        disconnectFromMultiplayer();
        multiplayerEnabled = false;
        showMessage("מצב מרובה משתתפים: מבוטל");
        document.getElementById('multiplayer-status').style.display = 'none';
    }
}

// Initialize multiplayer functionality
function initializeMultiplayer() {
    initializeNetwork();
    createScoreboard();
    showMessage("מתחבר לשרת...");
}

// Disconnect from multiplayer
function disconnectFromMultiplayer() {
    // Use the new disconnectFromServer function from network.js
    // to properly close the connection without triggering auto-reconnect
    if (typeof disconnectFromServer === 'function') {
        disconnectFromServer();
    }
    
    // Clean up UI elements
    removeScoreboard();
}

function switchCamera() {
    const views = Object.keys(cameraOffsets);
    const currentIndex = views.indexOf(currentCameraView);
    const nextIndex = (currentIndex + 1) % views.length;
    currentCameraView = views[nextIndex];
    showMessage(`מצלמה: ${currentCameraView}`);
}

function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.position = 'absolute';
    messageDiv.style.top = '20%';
    messageDiv.style.left = '10%';
    messageDiv.style.backgroundColor = 'black';
    messageDiv.style.padding = '30px';
    messageDiv.style.fontSize = '34px';
    messageDiv.style.borderRadius = '5px';
    messageDiv.style.opacity = '0.8';
    messageDiv.innerText = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => document.body.removeChild(messageDiv), 2000);
}

// Multiplayer chat overlay
function openChatOverlay() {
    if (!multiplayerEnabled) {
        showMessage("הצ'אט זמין רק במצב מרובה משתתפים");
        return;
    }
    
    // Create or show the chat overlay
    let chatOverlay = document.getElementById('chatOverlay');
    
    if (!chatOverlay) {
        chatOverlay = document.createElement('div');
        chatOverlay.id = 'chatOverlay';
        chatOverlay.style.position = 'absolute';
        chatOverlay.style.bottom = '10px';
        chatOverlay.style.right = '10px';
        chatOverlay.style.width = '300px';
        chatOverlay.style.height = '200px';
        chatOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        chatOverlay.style.color = 'white';
        chatOverlay.style.padding = '10px';
        chatOverlay.style.borderRadius = '5px';
        chatOverlay.style.overflowY = 'auto';
        chatOverlay.style.zIndex = '1000';
        
        const chatMessages = document.createElement('div');
        chatMessages.id = 'chatMessages';
        chatMessages.style.height = '150px';
        chatMessages.style.overflowY = 'auto';
        chatMessages.style.marginBottom = '10px';
        
        const chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.id = 'chatInput';
        chatInput.style.width = '100%';
        chatInput.style.padding = '5px';
        chatInput.style.boxSizing = 'border-box';
        chatInput.placeholder = 'לחץ Enter לשליחה...';
        
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim()) {
                sendChatMessage(chatInput.value.trim());
                chatInput.value = '';
            }
            if (e.key === 'Escape') {
                closeChatOverlay();
            }
            e.stopPropagation(); // Prevent game controls from triggering
        });
        
        chatOverlay.appendChild(chatMessages);
        chatOverlay.appendChild(chatInput);
        
        document.body.appendChild(chatOverlay);
        chatInput.focus();
    } else {
        chatOverlay.style.display = 'block';
        document.getElementById('chatInput').focus();
    }
}

function closeChatOverlay() {
    const chatOverlay = document.getElementById('chatOverlay');
    if (chatOverlay) {
        chatOverlay.style.display = 'none';
    }
}

function sendChatMessage(message) {
    // Send the message through the network module
    // This would be implemented in network.js
    
    // For now, just add it to the local chat
    addChatMessage(`You: ${message}`);
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.marginBottom = '5px';
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Create multiplayer scoreboard
let scoreboardElement;
function createScoreboard() {
    if (document.getElementById('multiplayer-scoreboard')) return;
    
    scoreboardElement = document.createElement('div');
    scoreboardElement.id = 'multiplayer-scoreboard';
    scoreboardElement.style.position = 'absolute';
    scoreboardElement.style.top = '10px';
    scoreboardElement.style.right = '10px';
    scoreboardElement.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    scoreboardElement.style.color = 'white';
    scoreboardElement.style.padding = '10px';
    scoreboardElement.style.borderRadius = '5px';
    scoreboardElement.style.fontFamily = 'Arial, sans-serif';
    scoreboardElement.style.fontSize = '14px';
    scoreboardElement.style.minWidth = '200px';
    
    updateScoreboard();
    document.body.appendChild(scoreboardElement);
}

function removeScoreboard() {
    if (scoreboardElement) {
        document.body.removeChild(scoreboardElement);
        scoreboardElement = null;
    }
}

function updateScoreboard() {
    if (!scoreboardElement || !multiplayerEnabled) return;
    
    let scoreboardHTML = '<h3>טבלת ניקוד</h3><table style="width:100%; text-align:left;">';
    scoreboardHTML += '<tr><th>שחקן</th><th>ניקוד</th></tr>';
    
    // Add local player
    scoreboardHTML += `<tr><td>אתה${playerId ? ' (' + playerId.substring(0, 4) + ')' : ''}</td><td>${score}</td></tr>`;
    
    // Add remote players
    if (remotePlayers) {
        Object.keys(remotePlayers).forEach(id => {
            const playerScore = remotePlayers[id].score || 0;
            scoreboardHTML += `<tr><td>שחקן (${id.substring(0, 4)})</td><td>${playerScore}</td></tr>`;
        });
    }
    
    scoreboardHTML += '</table>';
    scoreboardElement.innerHTML = scoreboardHTML;
}

let hudCreated = false;
let altitudeElement, scoreElement, difficultyElement, connectionStatusElement;
let lastAltitude = null;
let lastScore = null;
let lastDifficulty = null;
let lastConnectionStatus = null;

function createHUD() {
    altitudeElement = document.createElement('div');
    altitudeElement.id = 'altitude';
    altitudeElement.style.position = 'absolute';
    altitudeElement.style.top = '10px';
    altitudeElement.style.left = '10px';
    altitudeElement.style.color = 'white';
    altitudeElement.style.fontFamily = 'Arial, sans-serif';
    altitudeElement.style.fontSize = '18px';
    altitudeElement.style.fontWeight = 'bold';
    altitudeElement.style.textShadow = '1px 1px 2px black';
    document.body.appendChild(altitudeElement);

    scoreElement = document.createElement('div');
    scoreElement.id = 'score';
    scoreElement.style.position = 'absolute';
    scoreElement.style.top = '50px';
    scoreElement.style.left = '10px';
    scoreElement.style.color = 'white';
    scoreElement.style.fontFamily = 'Arial, sans-serif';
    scoreElement.style.fontSize = '18px';
    scoreElement.style.fontWeight = 'bold';
    scoreElement.style.textShadow = '1px 1px 2px black';
    document.body.appendChild(scoreElement);

    difficultyElement = document.createElement('div');
    difficultyElement.id = 'difficulty';
    difficultyElement.style.position = 'absolute';
    difficultyElement.style.top = '90px';
    difficultyElement.style.left = '10px';
    difficultyElement.style.color = 'white';
    difficultyElement.style.fontFamily = 'Arial, sans-serif';
    difficultyElement.style.fontSize = '18px';
    difficultyElement.style.fontWeight = 'bold';
    difficultyElement.style.textShadow = '1px 1px 2px black';
    document.body.appendChild(difficultyElement);
    
    // New element for multiplayer status
    connectionStatusElement = document.createElement('div');
    connectionStatusElement.id = 'connection-status';
    connectionStatusElement.style.position = 'absolute';
    connectionStatusElement.style.top = '130px';
    connectionStatusElement.style.left = '10px';
    connectionStatusElement.style.color = 'white';
    connectionStatusElement.style.fontFamily = 'Arial, sans-serif';
    connectionStatusElement.style.fontSize = '18px';
    connectionStatusElement.style.fontWeight = 'bold';
    connectionStatusElement.style.textShadow = '1px 1px 2px black';
    document.body.appendChild(connectionStatusElement);

    const controlsInfo = document.createElement('div');
    controlsInfo.style.position = 'absolute';
    controlsInfo.style.bottom = '10px';
    controlsInfo.style.left = '10px';
    controlsInfo.style.color = 'white';
    controlsInfo.style.fontFamily = 'Arial, sans-serif';
    controlsInfo.style.fontSize = '14px';
    controlsInfo.style.textShadow = '1px 1px 2px black';
    controlsInfo.innerHTML = `
            בקרות:<br>
            W/S - הטייה למעלה/למטה (Pitch)<br>
            A/D - גלגול שמאלה/ימינה (Roll)<br>
            Q/E - פנייה שמאלה/ימינה (Yaw)<br>
            חצים למעלה/למטה - האצה/האטה<br>
            חצים שמאלה/ימינה - כיוון עדין של גלגול<br>
            רווח - ירי<br>
            C - החלפת מצלמה<br>
            P - החלפת מטוס<br>
            R - ביצוע סיבוב חבית (Barrel Roll)<br>
            [ / ] - החלפת שיר קודם/הבא<br>
            M - הפעלת/ביטול מצב מרובה משתתפים<br>
            T - פתיחת צ'אט (במצב מרובה משתתפים)
        `;
    document.body.appendChild(controlsInfo);

    hudCreated = true;
}

function updateHUD() {
    if (!hudCreated) createHUD();
    
    if (player.position.y !== lastAltitude) {
        altitudeElement.innerText = `גובה: ${player.position.y.toFixed(2)} מ'`;
        lastAltitude = player.position.y;
    }
    
    if (score !== lastScore) {
        scoreElement.innerText = `ניקוד: ${score}`;
        lastScore = score;
    }
    
    if (difficultyLevel !== lastDifficulty) {
        difficultyElement.innerText = `רמת קושי: ${difficultyLevel}`;
        lastDifficulty = difficultyLevel;
    }
    
    // Update multiplayer connection status
    const connectionStatus = multiplayerEnabled ? (isConnected ? 'מחובר' : 'מתחבר...') : 'מנותק';
    if (connectionStatus !== lastConnectionStatus) {
        connectionStatusElement.innerText = `מצב חיבור: ${connectionStatus}`;
        connectionStatusElement.style.color = isConnected ? '#00ff00' : (multiplayerEnabled ? '#ffff00' : '#ff0000');
        lastConnectionStatus = connectionStatus;
    }
    
    // Update multiplayer scoreboard
    if (multiplayerEnabled && isConnected) {
        updateScoreboard();
    }
}

function animate() {
    requestAnimationFrame(animate);

    currentPlane.update(keys);
    updateEnvironment();
    checkCollisions(currentPlane.bullets, balloons);
    updateHUD();
    
    // Update remote players' bullets if in multiplayer mode
    if (multiplayerEnabled) {
        updateRemoteBullets();
    }

    const offset = cameraOffsets[currentCameraView].clone().applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(offset);

    if (currentCameraView === 'FPS') {
        const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
        camera.lookAt(player.position.clone().add(lookDir));
    } else {
        camera.lookAt(player.position);
    }

    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
}

// Game initialization
function initGame() {
    setupScene();
    createEnvironment();
    animate();
    
    try {
        playMusic();
    } catch (e) {
        console.log('שגיאה בהפעלת מוזיקה:', e);
    }
    
    // Show welcome message
    showMessage("ברוכים הבאים למשחק Balloon Fighter!");
    setTimeout(() => {
        showMessage("לחץ M להפעלת מצב מרובה משתתפים");
    }, 3000);
    
    gameStarted = true;
}

// Start the game
initGame();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

export { showMessage };