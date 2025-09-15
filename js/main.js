const config = {
    type: Phaser.CANVAS,
    width: 800,
    height: 600,
    canvas: document.getElementById('game-canvas'),
    scene: [GameScene]
};

const game = new Phaser.Game(config);