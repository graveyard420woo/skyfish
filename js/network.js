class Network {
    constructor() {
        this.socket = io('http://localhost:3000'); // Replace with your server address

        this.socket.on('connect', () => {
            console.log('Connected to the server!');
        });

        // TODO: Handle incoming game state updates from the server
        this.socket.on('gameState', (gameState) => {
            // Update the local game state based on the server's data
        });

        this.socket.on('playerJoined', (player) => {
            console.log(`Player ${player.id} joined the game.`);
        });

        this.socket.on('playerLeft', (playerId) => {
            console.log(`Player ${playerId} left the game.`);
        });
    }

    // TODO: Send player actions to the server
    sendIslandMove(data) {
        this.socket.emit('islandMove', data);
    }
}

const network = new Network();