// assets\js\audio.js

import { showMessage } from './main.js';

const musicTracks = [
    'assets/music/Dog Trap.mp3',
    'assets/music/Slow J-Dog.mp3',
    'assets/music/Trapdog.mp3',
    'assets/music/Scratch Dog.mp3',
    'assets/music/Dogbalism.mp3',
    'assets/music/Dogfight.mp3',
    'assets/music/Hip Dog.mp3',
    'assets/music/Metaldog.mp3',
    'assets/music/Pixledog.mp3'
];
let currentMusicIndex = 0;
let backgroundMusic = null;

function playMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic = null;
    }
    backgroundMusic = new Audio(musicTracks[currentMusicIndex]);
    backgroundMusic.volume = 0.5;
    backgroundMusic.play().catch(e => console.log('שגיאה בהפעלת מוזיקה:', e));
    backgroundMusic.onended = () => {
        currentMusicIndex = (currentMusicIndex + 1) % musicTracks.length;
        playMusic();
    };
    if (backgroundMusic) {
        backgroundMusic.play();
        const trackName = musicTracks[currentMusicIndex]
            .replace('assets/music/', '')
            .replace('.mp3', '');
        showMessage(trackName + " :שם הטראק");
    }
}

function nextTrack() {
    currentMusicIndex = (currentMusicIndex + 1) % musicTracks.length;
    playMusic();
}

function previousTrack() {
    currentMusicIndex = (currentMusicIndex - 1 + musicTracks.length) % musicTracks.length;
    playMusic();
}

function stopTrack() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic = null;
    }
}

export { playMusic, nextTrack, previousTrack, stopTrack };