# Balloon Fighter - Multiplayer Flight Simulator

## Overview
Balloon Fighter is an immersive 3D flight simulator game where players pilot aircraft and engage in aerial combat by shooting balloons scattered throughout the environment. The game features both single-player and multiplayer modes, allowing friends to compete in the same virtual airspace.

## Features
- **3D Flight Simulation**: Experience realistic flight controls with pitch, roll, and yaw mechanics.
- **Dynamic Environment**: Navigate through a rich 3D world with mountains, rivers, buildings, and atmospheric elements.
- **Balloon Combat**: Earn points by shooting balloons while navigating the terrain.
- **Multiple Aircraft**: Switch between different aircraft types with unique characteristics.
- **Camera Controls**: Enjoy different viewing perspectives including first-person and third-person views.
- **Real-time Multiplayer**: Connect with other players over a local network for competitive gameplay.
- **Player Interaction**: Experience player-to-player collisions, competition for balloons, and real-time scoring.
- **In-game Chat**: Communicate with other players during multiplayer sessions.
- **Dynamic Sound**: Enjoy background music with playlist controls during gameplay.

## Controls
### Flight Controls
- **W/S**: Pitch control (up/down)
- **A/D**: Roll control (left/right)
- **Q/E**: Yaw control (turn left/right)
- **Arrow Up/Down**: Increase/decrease speed
- **Arrow Left/Right**: Fine roll control
- **Space**: Fire weapons

### System Controls
- **C**: Change camera perspective
- **P**: Switch aircraft
- **R**: Perform barrel roll
- **[ / ]**: Previous/next music track
- **M**: Toggle multiplayer mode
- **T**: Open chat (in multiplayer mode)

## Technical Requirements
- Modern web browser with WebGL support
- Node.js (for hosting multiplayer server)
- Local network connection (for multiplayer functionality)

## Setup Instructions
### Single Player Mode
1. Open the game in a web browser.
2. Click "Start Game" on the loading screen.
3. Use the controls listed above to navigate and play.

### Multiplayer Setup
1. Install dependencies: `npm install`
2. Start the server: `npm start` or `node server.js`
3. On the host computer, access: `http://localhost:3000`
4. On other computers, access: `http://[HOST_IP_ADDRESS]:3000` (where `HOST_IP_ADDRESS` is the IP of the server computer)
5. Press 'M' in-game to enable multiplayer mode.
6. Use 'T' to open the chat interface during gameplay.

## Troubleshooting Multiplayer
If you encounter connection issues:
- Ensure the server is running on the host computer.
- Verify that port 3000 is accessible through any firewall settings.
- Confirm all computers are on the same local network.
- Check the console for error messages.

## Game Mechanics
- **Scoring**: Earn 10 points for each balloon shot.
- **Difficulty Levels**: The game increases in difficulty as you score more points.
- **Health System**: In multiplayer mode, collisions reduce health with visual indicators.
- **Respawn**: After being destroyed, players respawn with temporary invulnerability.

## Future Development
- Additional multiplayer game modes.
- More aircraft types with unique capabilities.
- Expanded environments and mission objectives.
- Global leaderboards and achievements.

## Credits
Balloon Fighter was developed using:
- **Three.js** for 3D rendering.
- **Node.js and WebSockets** for multiplayer functionality.
- **Express** for web server capabilities.
