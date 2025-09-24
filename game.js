document.addEventListener('DOMContentLoaded', () => {
    // --- Globals & State ---
    const boardContainer = document.getElementById('board-container');
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    
    // UI Elements
    const playerHandElement = document.getElementById('player-hand');
    const cloudShardsElement = document.getElementById('cloud-shards');
    const currentPlayerElement = document.getElementById('current-player');
    const endTurnBtn = document.getElementById('end-turn-btn');
    const choicePromptElement = document.getElementById('choice-prompt');
    const promptTextElement = document.getElementById('prompt-text');
    const promptOptionsElement = document.getElementById('prompt-options');
    const cancelActionBtn = document.getElementById('cancel-action-btn');
    const errorPanel = document.getElementById('error-panel');
    const errorMessage = document.getElementById('error-message');
    const discardZone = document.getElementById('discard-zone');
    const timerDisplay = document.getElementById('timer-display');
    const playerColorIndicator = document.getElementById('player-color-indicator');
    const battlePopup = document.getElementById('battle-popup');
    const battleFish1 = document.getElementById('battle-fish-1');
    const battleFish2 = document.getElementById('battle-fish-2');
    const battleResult = document.getElementById('battle-result');
    const cancelActionPlaceholder = document.getElementById('cancel-action-placeholder');
	const tileEffectsContainer = document.getElementById('tile-effects-container');
	const spriteContainer = document.getElementById('sprite-container');
	const ZOOM_SPEED = 0.001;
	const MIN_ZOOM_TARGET = 20;
	const MAX_ZOOM_TARGET = 100;
    
    // Animation & View State
    let TILE_SIZE = { current: 0, target: 50 };
    let TILE_HEIGHT = 0;
    let SHADOW_OFFSET = 0;
    let boardView = { rotation: Math.PI / 6, tilt: Math.PI / 3.5, targetRotation: Math.PI / 6, targetTilt: Math.PI / 3.5 };
    let mouseState = { isDown: false, lastX: 0, lastY: 0, hoveredTile: null };
    let newTiles = [];
    let projectiles = [];
    let flyUpTexts = [];
    let rangeHighlights = [];

    // Game State
    let gameState = {};
    let boardDimensions = { minQ: 0, maxQ: 0, minR: 0, maxR: 0 };
    let turnTimerInterval = null;
    let turnTimeRemaining = 30;
	

    // Constants
    const TILE_TYPES = ['Forest', 'Mountain', 'Water'];
    const PRETTY_COLORS = ['#ffcc00', '#b300ff', '#00e6e6', '#33cc33'];
    const TILE_COLORS = {
    'Forest':   { h: 140, s: 55, l: 40 }, // HSL: Hue, Saturation, Lightness
    'Mountain': { h: 210, s: 10, l: 65 },
    'Water':    { h: 205, s: 70, l: 55 },
    'Highlight': 'rgba(0, 246, 255, 0.5)', 
    'Shadow': 'rgba(0,0,0,0.3)'
};
    const cardDatabase = [
        { id: 1, name: 'Growth', cost: 2, desc: 'Place a Forest tile.', effect: { type: 'place_tile', tileType: 'Forest' } },
        { id: 2, name: 'Golem', cost: 3, desc: 'Summon a Golem.', effect: { type: 'summon_creature', targetTile: 'Mountain', creature: { type: 'Golem' } } },
        { id: 3, name: 'Cloud Tap', cost: 1, desc: 'Gain 2 Cloud.', effect: { type: 'gain_resource', amount: 2 } },
        { id: 4, name: 'Pioneer', cost: 3, desc: 'Claim an adjacent unowned tile.', effect: { type: 'claim_tile' } },
        { id: 5, name: 'Sky Fish', cost: 2, desc: 'Summon a Sky Fish.', effect: { type: 'summon_creature', targetTile: 'Water', creature: { type: 'Sky Fish' } } },
        { id: 6, name: 'Dryad', cost: 4, desc: 'Spawns 2 Forests. Dies next turn.', effect: { type: 'summon_creature', targetTile: 'Forest', creature: { type: 'Dryad', lifespan: 1 } } },
        { id: 7, name: 'Terrashape', cost: 4, desc: 'Place any tile type.', effect: { type: 'place_choice_tile', options: TILE_TYPES } }
    ];
    const MIN_TILT = Math.PI / 6;
    const MAX_TILT = Math.PI / 2.2;
    const MAX_HAND_SIZE = 6;
	const TAPER_FACTOR = 1.15;

    function gameLoop() {
        boardView.rotation += (boardView.targetRotation - boardView.rotation) * 0.1;
        boardView.tilt += (boardView.targetTilt - boardView.tilt) * 0.1;
        TILE_SIZE.current += (TILE_SIZE.target - TILE_SIZE.current) * 0.1;

        TILE_HEIGHT = TILE_SIZE.current * 0.3;
        SHADOW_OFFSET = TILE_SIZE.current * 0.1;
        newTiles.forEach(tile => tile.progress = Math.min(1, tile.progress + 0.05));
        newTiles = newTiles.filter(tile => tile.progress < 1);
        projectiles.forEach(p => { p.progress = Math.min(1, p.progress + 0.02); if (p.progress === 1) { const targetTile = gameState.board.get(`${p.end.q},${p.end.r}`); if (targetTile) targetTile.controller = null; } });
        projectiles = projectiles.filter(p => p.progress < 1);
        flyUpTexts.forEach(t => { t.progress = Math.min(1, t.progress + 0.015); t.yOffset -= 1; });
        flyUpTexts = flyUpTexts.filter(t => t.progress < 1);
		updateSpritePositions();
        render();
        requestAnimationFrame(gameLoop);
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const boardCenterX_Q = (boardDimensions.maxQ + boardDimensions.minQ) / 2;
        const boardCenterY_R = (boardDimensions.maxR + boardDimensions.minR) / 2;
        const centerPixel = axialToIsometric(boardCenterX_Q, boardCenterY_R);
        ctx.translate(canvas.width / 2 - centerPixel.x, canvas.height / 2 - centerPixel.y);
        const allTiles = [...gameState.board.values(), ...newTiles.map(nt => nt.tile)];
        allTiles.sort((a, b) => { const posA = axialToIsometric(a.q, a.r); const posB = axialToIsometric(b.q, b.r); const depthDiff = posA.depth - posB.depth; if (Math.abs(depthDiff) < 0.1) return posA.x - posB.x; return depthDiff; });
        allTiles.forEach(tile => drawDropShadow(ctx, tile.q, tile.r));
        allTiles.forEach(tile => { const animation = newTiles.find(nt => nt.tile === tile); draw3DTile(ctx, tile, animation ? animation.progress : 1); if (tile.controller) drawController(ctx, tile.q, tile.r); });
        const flash = Math.abs(Math.sin(Date.now() / 200));
        ctx.fillStyle = `rgba(255, 204, 0, ${0.3 * flash})`;
        rangeHighlights.forEach(tile => { const { x, y } = axialToIsometric(tile.q, tile.r); drawOctagon(ctx, x, y, TILE_SIZE.current, null, true); });
        gameState.validMoves.forEach(move => { const { x, y } = axialToIsometric(move.q, move.r); drawOctagon(ctx, x, y, TILE_SIZE.current, TILE_COLORS.Highlight, true); });
        projectiles.forEach(p => { const startPos = axialToIsometric(p.start.q, p.start.r); const endPos = axialToIsometric(p.end.q, p.end.r); const currentX = startPos.x + (endPos.x - startPos.x) * p.progress; const currentY = startPos.y + (endPos.y - startPos.y) * p.progress - (TILE_HEIGHT * 2); const arc = Math.sin(p.progress * Math.PI) * TILE_SIZE.current * 1.5; for (let i = 0; i < 5; i++) { const tailProgress = p.progress - i * 0.02; if (tailProgress > 0) { const tailX = startPos.x + (endPos.x - startPos.x) * tailProgress; const tailY = startPos.y + (endPos.y - startPos.y) * tailProgress - (TILE_HEIGHT * 2); const tailArc = Math.sin(tailProgress * Math.PI) * TILE_SIZE.current * 1.5; const size = TILE_SIZE.current * 0.1 * (1 - i * 0.15); const opacity = 1 - tailProgress; ctx.fillStyle = `rgba(255, 85, 0, ${opacity})`; ctx.beginPath(); ctx.arc(tailX, tailY - tailArc, size, 0, Math.PI * 2); ctx.fill(); } } ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(currentX, currentY - arc, TILE_SIZE.current * 0.15, 0, Math.PI * 2); ctx.fill(); });
        flyUpTexts.forEach(t => { ctx.font = `bold ${TILE_SIZE.current * 0.8}px 'Silkscreen'`; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(0, 246, 255, ${1 - t.progress})`; ctx.strokeStyle = `rgba(0, 0, 0, ${1 - t.progress})`; ctx.lineWidth = 2; ctx.strokeText(t.text, t.x, t.y + t.yOffset); ctx.fillText(t.text, t.x, t.y + t.yOffset); });
        ctx.restore();
    }

    function setupInputControls() {
        canvas.addEventListener('mousedown', e => { mouseState.isDown = true; mouseState.lastX = e.clientX; mouseState.lastY = e.clientY; boardContainer.classList.add('grabbing'); });
        window.addEventListener('mouseup', () => { mouseState.isDown = false; boardContainer.classList.remove('grabbing'); });
		canvas.addEventListener('mousemove', e => {
			if (mouseState.isDown && e.buttons === 1) { // MODIFIED: Check if left mouse is actually pressed
				const dx = e.clientX - mouseState.lastX;
				const dy = e.clientY - mouseState.lastY;
				boardView.targetRotation += dx * 0.005;
				boardView.targetTilt = Math.max(MIN_TILT, Math.min(MAX_TILT, boardView.targetTilt - dy * 0.005));
				mouseState.lastX = e.clientX;
				mouseState.lastY = e.clientY;
			} else {
				mouseState.hoveredTile = pixelToAxial(e.offsetX, e.offsetY);
				calculateValidMoves();
			}
		});
		canvas.addEventListener('wheel', e => {
			e.preventDefault();
			
			const zoomAmount = e.deltaY * -ZOOM_SPEED;
			TILE_SIZE.target += zoomAmount * TILE_SIZE.target; // Makes zoom feel more natural
	
			TILE_SIZE.target = Math.max(MIN_ZOOM_TARGET, Math.min(MAX_ZOOM_TARGET, TILE_SIZE.target));
		});
        discardZone.addEventListener('dragover', e => { e.preventDefault(); discardZone.classList.add('drag-over'); });
        discardZone.addEventListener('dragleave', () => { discardZone.classList.remove('drag-over'); });
        discardZone.addEventListener('drop', e => { e.preventDefault(); discardZone.classList.remove('drag-over'); const cardIndex = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(cardIndex)) { getCurrentPlayer().hand.splice(cardIndex, 1); updateUI(); } });
        cancelActionPlaceholder.addEventListener('click', cancelAction);
    }

    function initializeGame() {
        gameState = { players: [ { id: 1, hand: [], deck: [], cloudShards: 1, color: PRETTY_COLORS[0], turnsWithNoTiles: 0 }, { id: 2, id: 2, hand: [], deck: [], cloudShards: 1, color: PRETTY_COLORS[1], turnsWithNoTiles: 0 } ], currentPlayerIndex: 0, board: new Map(), action: null, pendingCard: null, validMoves: [], turn: 1 };
        generateRandomBoard(3);
        gameState.players.forEach(p => {
			for (let i = 0; i < 3; i++) drawCard(p);
		});
        resizeAndCalculateTargetSize();
        updateUI();
        startTurnTimer();
    }

    function playCard(player, cardIndex) {
        if (gameState.action) { showError("Complete your current action first!"); return; }

        const card = player.hand[cardIndex];
        if (player.cloudShards < card.cost) { showError("Not enough Cloud!"); return; }
        if (card.effect.type === 'summon_creature') { const canSummon = [...gameState.board.values()].some(t => t.controller === player.id && t.type === card.effect.targetTile && !t.creature); if (!canSummon) { showError(`No valid ${card.effect.targetTile} tiles available!`); return; } }
        
        player.cloudShards -= card.cost;
        const { effect } = card;
        
        if (effect.type === 'gain_resource') {
            const cardElement = playerHandElement.children[cardIndex];
            if(cardElement) triggerPlayAnimation(cardElement);
            player.hand.splice(cardIndex, 1);
            player.cloudShards += effect.amount;
        } else {
            gameState.pendingCard = { card: player.hand[cardIndex], index: cardIndex };
            if (effect.type === 'place_choice_tile') {
                showChoicePrompt('Choose a tile to place:', effect.options, choice => { startAction({ type: 'place_tile', tileType: choice }); });
            } else {
                startAction(effect);
            }
        }
        updateUI();
    }

    async function endTurn() {
    if (gameState.pendingCard) { cancelAction(); }
    endTurnBtn.disabled = true;
    clearTimeout(turnTimerInterval);

    const outgoingPlayer = getCurrentPlayer();
    const controlledTiles = [...gameState.board.values()].filter(t => t.controller === outgoingPlayer.id).length;
    if (controlledTiles === 0) {
        outgoingPlayer.turnsWithNoTiles++;
    } else {
        outgoingPlayer.turnsWithNoTiles = 0;
    }

    await handleEndOfTurnAbilities(outgoingPlayer);

    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    // --- FIX: Re-declared the incomingPlayer variable here ---
    const incomingPlayer = getCurrentPlayer();
    
    let wasCardDrawn = false;
    if (incomingPlayer.turnsWithNoTiles >= 3) {
        showError("Mercy of the Clouds!");
        incomingPlayer.cloudShards += 3;
        incomingPlayer.turnsWithNoTiles = 0;
        startAction({ type: 'respawn' });
    } else {
        let resourceGain = [...gameState.board.values()].filter(t => t.controller === incomingPlayer.id).length;
        if (resourceGain > 0) {
            const centerPos = axialToIsometric(0, 0);
            flyUpTexts.push({ text: `+${resourceGain} Cloud`, x: centerPos.x, y: centerPos.y, yOffset: 0, progress: 0 });
        }
        incomingPlayer.cloudShards += resourceGain;
    }
    
    wasCardDrawn = drawCard(incomingPlayer);
    updateUI(wasCardDrawn);
    endTurnBtn.disabled = false;
    startTurnTimer();
}

    async function handleEndOfTurnAbilities(player) { // Accepts the outgoing player
    let boardExpanded = false;
    
    // --- Step 1: Plan and Execute all creature moves (like Sky Fish) ---
    const plannedFishMoves = [];
    const spirits = [...gameState.board.values()].filter(t => t.creature && t.creature.ownerId === player.id && t.creature.type === 'Sky Fish');
    for (const spiritTile of spirits) {
        if (Math.random() < 0.5) {
            const validNeighbors = getNeighbors(spiritTile.q, spiritTile.r).filter(n => { const key = `${n.q},${n.r}`; const neighbor = gameState.board.get(key); return neighbor && neighbor.type === 'Water' && (!neighbor.creature || neighbor.creature.ownerId !== player.id); });
            if (validNeighbors.length > 0) {
                const newPos = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
                plannedFishMoves.push({ fromTile: spiritTile, toCoords: newPos, creature: spiritTile.creature });
            }
        }
    }
    for (const move of plannedFishMoves) {
        const destinationTile = gameState.board.get(`${move.toCoords.q},${move.toCoords.r}`);
        if (destinationTile) {
			if (destinationTile.creature) {
				await triggerBattle(move.fromTile, destinationTile);
			} else {
				destinationTile.creature = move.creature;
				move.fromTile.creature = null;
				
				// ADD calls to update sprites after movement
				removeSprite(move.fromTile);
				createOrUpdateSprite(destinationTile);
			}
		}
    }
    
    // --- Step 2: Handle all creature actions (like Golem attacks and Dryad spawns) ---
    const golems = [...gameState.board.values()].filter(t => t.creature && t.creature.ownerId === player.id && t.creature.type === 'Golem');
    for (const golemTile of golems) { const opponentTiles = [...gameState.board.values()].filter(t => t.controller && t.controller !== player.id && getDistance(golemTile, t) <= 5); if (opponentTiles.length > 0) { const targetTile = opponentTiles[Math.floor(Math.random() * opponentTiles.length)]; projectiles.push({ start: golemTile, end: targetTile, progress: 0 }); } }

    const dryads = [...gameState.board.values()].filter(t => t.creature && t.creature.ownerId === player.id && t.creature.type === 'Dryad');
    for (const dryadTile of dryads) { const emptyNeighbors = getNeighbors(dryadTile.q, dryadTile.r).filter(n => !gameState.board.has(`${n.q},${n.r}`)); for (let i = 0; i < 2 && emptyNeighbors.length > 0; i++) { const newTilePos = emptyNeighbors.splice(Math.floor(Math.random() * emptyNeighbors.length), 1)[0]; const newTileObject = { q: newTilePos.q, r: newTilePos.r, type: 'Forest', controller: null, creature: null }; gameState.board.set(`${newTilePos.q},${newTilePos.r}`, newTileObject); newTiles.push({ tile: newTileObject, progress: 0 }); boardExpanded = true; } }
    
    // --- Step 3: Handle all "upkeep" effects for the current player's creatures ---
    const allPlayerCreatures = [...gameState.board.values()].filter(t => t.creature && t.creature.ownerId === player.id);
    allPlayerCreatures.forEach(tile => {
        // Lifespan for Dryads
        if (tile.creature.lifespan !== undefined) {
            tile.creature.lifespan--;
        }
        // Attrition for Golems
        if (tile.creature.type === 'Golem') {
            if (tile.controller !== tile.creature.ownerId) {
                tile.creature.uncontrolledTurns++;
            } else {
                tile.creature.uncontrolledTurns = 0; // Reset if they regain control
            }
        }
    });

    // --- Step 4: Clean up any creatures that died this turn ---
    gameState.board.forEach(tile => {
		if (tile.creature && (
			tile.creature.lifespan <= 0 ||
			(tile.creature.type === 'Golem' && tile.creature.uncontrolledTurns >= 4)
		)) {
			// ADD a call to remove the sprite before deleting the data
			removeSprite(tile);
			tile.creature = null;
		}
	});

    if (boardExpanded) { let keys = [...gameState.board.keys()].map(k => k.split(',').map(Number)); boardDimensions.minQ = Math.min(...keys.map(k => k[0])); boardDimensions.maxQ = Math.max(...keys.map(k => k[0])); boardDimensions.minR = Math.min(...keys.map(k => k[1])); boardDimensions.maxR = Math.max(...keys.map(k => k[1])); resizeAndCalculateTargetSize(); }
}
    
    async function triggerBattle(attackerTile, defenderTile) {
    const attackerPlayer = gameState.players.find(p => p.id === attackerTile.creature.ownerId);
    const defenderPlayer = gameState.players.find(p => p.id === defenderTile.creature.ownerId);

    // Early exit if players are somehow null to prevent errors
    if (!attackerPlayer || !defenderPlayer) return;

    battleResult.textContent = `Player ${attackerPlayer.id}'s Sky Fish attacks Player ${defenderPlayer.id}'s Sky Fish!`;
    battleFish1.style.backgroundColor = attackerPlayer.color;
    battleFish2.style.backgroundColor = defenderPlayer.color;
    battleFish1.className = 'battle-fish bonking';
    battleFish2.className = 'battle-fish bonking';
    battlePopup.classList.remove('hidden');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const winner = Math.random() < 0.5 ? { player: attackerPlayer, tile: attackerTile, creatureData: attackerTile.creature } : { player: defenderPlayer, tile: defenderTile, creatureData: defenderTile.creature };
    const loser = winner.player.id === attackerPlayer.id ? { player: defenderPlayer, tile: defenderTile } : { player: attackerPlayer, tile: attackerTile };
    
    battleResult.textContent = `Player ${winner.player.id} is the winner!`;
    const winnerFishElement = winner.player.id === attackerPlayer.id ? battleFish1 : battleFish2;
    const loserFishElement = loser.player.id === attackerPlayer.id ? battleFish1 : battleFish2;
    winnerFishElement.classList.remove('bonking');
    loserFishElement.classList.add('loser');

    // --- FIX: Explicitly remove both original sprites ---
    // The attacker's sprite is removed because it either moves or is destroyed.
    // The defender's sprite is removed because it is either destroyed or replaced by the winner.
    removeSprite(attackerTile);
    removeSprite(defenderTile);
    
    // Update the game state in memory
    attackerTile.creature = null; // Attacker's original tile is now always empty.
    defenderTile.creature = winner.creatureData; // The winner's creature data moves to the defender's tile.
    defenderTile.controller = winner.player.id; // The winner's owner controls the tile.

    // Create the single new sprite for the winner in its final location.
    createOrUpdateSprite(defenderTile);

    await new Promise(resolve => setTimeout(resolve, 2000));
    battlePopup.classList.add('hidden');
    battleFish1.className = 'battle-fish';
    battleFish2.className = 'battle-fish';
}

    function startTurnTimer() {
        clearTimeout(turnTimerInterval);
        turnTimeRemaining = 30;
        timerDisplay.parentElement.classList.remove('warning');
        function tick() {
            timerDisplay.textContent = turnTimeRemaining;
            if (turnTimeRemaining <= 10) { timerDisplay.parentElement.classList.add('warning'); }
            if (turnTimeRemaining <= 0) { showError("Turn ended automatically!"); endTurn(); }
            else { turnTimeRemaining--; turnTimerInterval = setTimeout(tick, 1000); }
        }
        tick();
    }
    
	function drawCard(player) {
		if (player.hand.length >= MAX_HAND_SIZE) return false;
		
		// Select a random card from the master database
		const randomCardIndex = Math.floor(Math.random() * cardDatabase.length);
		const newCard = { ...cardDatabase[randomCardIndex] }; // Create a fresh copy
		
		player.hand.push(newCard);
		return true; // A card was successfully drawn
	}
	
	function updateSpritePositions() {
		// This function will run every frame to keep sprites in the correct 3D position
		const allCreatureTiles = [...gameState.board.values()].filter(t => t.creature);
	
		allCreatureTiles.forEach(tile => {
			const spriteId = `sprite-${tile.q}-${tile.r}`;
			let spriteElement = document.getElementById(spriteId);
	
			if (spriteElement) {
				const { x, y } = axialToIsometric(tile.q, tile.r);
				const boardCenterX_Q = (boardDimensions.maxQ + boardDimensions.minQ) / 2;
				const boardCenterY_R = (boardDimensions.maxR + boardDimensions.minR) / 2;
				const centerPixel = axialToIsometric(boardCenterX_Q, boardCenterY_R);
	
				const screenX = (canvas.width / 2 - centerPixel.x) + x;
				const screenY = (canvas.height / 2 - centerPixel.y) + y - TILE_HEIGHT;
				
				spriteElement.style.setProperty('--sprite-size', `${TILE_SIZE.current * 1.2}px`);
	
				spriteElement.style.left = `${screenX}px`;
				spriteElement.style.top = `${screenY}px`;
	
				// Adjust Z-index for correct layering based on depth
				spriteElement.style.zIndex = Math.round(y + 1000); 
			}
		});
	}
	
	function getSpriteFilename(creatureType) {
		switch (creatureType) {
			case 'Sky Fish': return 'skyfish_01.gif';
			case 'Dryad': return 'dryad_01.gif';
			case 'Golem': return 'golem_01.gif';
			default: return '';
		}
	}
	
	function createOrUpdateSprite(tile) {
		if (!tile.creature) return;
	
		const spriteId = `sprite-${tile.q}-${tile.r}`;
		let spriteElement = document.getElementById(spriteId);
	
		// If sprite doesn't exist, create it
		if (!spriteElement) {
			spriteElement = document.createElement('img');
			spriteElement.id = spriteId;
			spriteElement.className = 'creature-sprite';
			spriteContainer.appendChild(spriteElement);
		}
		
		// Update its source and color
		spriteElement.src = `assets/${getSpriteFilename(tile.creature.type)}`;
		const owner = gameState.players.find(p => p.id === tile.creature.ownerId);
		if (owner) {
			// This uses CSS filter to re-color the gif.
			// It's a bit of a hack but works for prototypes.
			// A real game might use separate colored sprites or a shader.
			const color = owner.color;
			const r = parseInt(color.slice(1, 3), 16);
			const g = parseInt(color.slice(3, 5), 16);
			const b = parseInt(color.slice(5, 7), 16);
			
			// This is a complex filter to achieve hue-shifting.
			// We'll just apply a simple sepia + hue-rotate for a stylized effect.
			spriteElement.style.filter = `sepia(1) saturate(5) hue-rotate(${Math.random() * 360}deg) brightness(1.2)`;
		}
	}
	
	function removeSprite(tile) {
		const spriteId = `sprite-${tile.q}-${tile.r}`;
		let spriteElement = document.getElementById(spriteId);
		if (spriteElement) {
			spriteElement.classList.add('disappearing');
			// Remove the element from the DOM after the animation finishes
			spriteElement.addEventListener('animationend', () => {
				spriteElement.remove();
			});
		}
	}
	
	function drawRoundedOctagon(ctx, x, y, size, color) {
    const cornerRadius = size * 0.15;
    const points = [];
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i + (Math.PI / 8);
        points.push({
            x: x + size * Math.cos(angle),
            y: y + size * Math.sin(angle) * Math.sin(boardView.tilt)
        });
    }

    ctx.beginPath();
    ctx.moveTo(
        (points[0].x + points[7].x) / 2,
        (points[0].y + points[7].y) / 2
    );

    for (let i = 0; i < 8; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % 8];
        ctx.arcTo(p1.x, p1.y, p2.x, p2.y, cornerRadius);
    }
    
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // ADD THESE LINES BACK
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // A subtle white stroke
    ctx.lineWidth = 1;
    ctx.stroke();
}
	    
    function updateUI(wasCardDrawn = false) {
        const player = getCurrentPlayer();
        cloudShardsElement.textContent = player.cloudShards;
        currentPlayerElement.textContent = player.id;
        playerColorIndicator.style.backgroundColor = player.color;
        playerHandElement.innerHTML = '';
        
        let cardToAnimateIndex = -1;

        player.hand.forEach((card, i) => {
            const el = document.createElement('div');
            el.className = 'card';
            el.draggable = true;
            if (gameState.pendingCard && i === gameState.pendingCard.index) { el.classList.add('placeholder-active'); }
            el.innerHTML = `<div class="card-header"><span class="card-name">${card.name}</span><span class="card-cost">${card.cost}</span></div><div class="card-art"></div><div class="card-description">${card.desc}</div>`;
            el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i); setTimeout(() => el.classList.add('dragging'), 0); });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.onclick = () => playCard(player, i);
            playerHandElement.appendChild(el);
            if (wasCardDrawn && i === player.hand.length - 1) { cardToAnimateIndex = i; }
        });
        
        cancelActionPlaceholder.classList.add('hidden');
        if (gameState.pendingCard !== null) {
            const cardNode = playerHandElement.children[gameState.pendingCard.index];
            if (cardNode) {
                cancelActionPlaceholder.innerHTML = `<span>Cancel:</span><span style="font-family: var(--font-accent); color: var(--hot-pink);">${gameState.pendingCard.card.name}</span>`;
                cardNode.parentNode.insertBefore(cancelActionPlaceholder, cardNode);
                cancelActionPlaceholder.classList.remove('hidden');
            }
        }
        
        if (cardToAnimateIndex !== -1) {
            playerHandElement.children[cardToAnimateIndex].classList.add('newly-drawn');
        }
    }

    function generateRandomBoard(radius) { gameState.board.clear(); for (let q = -radius; q <= radius; q++) { for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) { const type = TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)]; gameState.board.set(`${q},${r}`, { q, r, type, controller: null, creature: null }); } } gameState.board.get(`0,${-radius}`).controller = 1; gameState.board.get(`0,${radius}`).controller = 2; let keys = [...gameState.board.keys()].map(k => k.split(',').map(Number)); boardDimensions.minQ = Math.min(...keys.map(k => k[0])); boardDimensions.maxQ = Math.max(...keys.map(k => k[0])); boardDimensions.minR = Math.min(...keys.map(k => k[1])); boardDimensions.maxR = Math.max(...keys.map(k => k[1])); }
    function resizeAndCalculateTargetSize() { canvas.width = boardContainer.clientWidth; canvas.height = boardContainer.clientHeight; const boardWidthInTiles = (boardDimensions.maxQ - boardDimensions.minQ) + 3; const boardHeightInTiles = (boardDimensions.maxR - boardDimensions.minR) + 3; const sizeBasedOnWidth = canvas.width / (boardWidthInTiles * 1.5); const sizeBasedOnHeight = canvas.height / (boardHeightInTiles * 1.73); TILE_SIZE.target = Math.min(sizeBasedOnWidth, sizeBasedOnHeight) * 0.95; }
    function axialToIsometric(q, r) {
    const SPACING_FACTOR = 1; // Add a little space between tiles
    const x3d = TILE_SIZE.current * 1.5 * q * SPACING_FACTOR;
    const z3d = TILE_SIZE.current * 1.73 * (r + q / 2) * SPACING_FACTOR;
    // ... rest of function is identical
    const rotatedX = x3d * Math.cos(boardView.rotation) - z3d * Math.sin(boardView.rotation);
    const rotatedZ = x3d * Math.sin(boardView.rotation) + z3d * Math.cos(boardView.rotation);
    const screenX = rotatedX;
    const screenY = rotatedZ * Math.sin(boardView.tilt);
    return { x: screenX, y: screenY, depth: rotatedZ };
}
    function draw3DTile(ctx, tile, progress = 1) {
    const { x, y } = axialToIsometric(tile.q, tile.r);
    
    const colorSeed = (tile.q * 0.2 + tile.r * 0.5);
    const hOffset = Math.sin(colorSeed) * 5;
    const lOffset = Math.sin(colorSeed * 2.1) * 3;
    
    const colors = TILE_COLORS[tile.type];
    const topColor = `hsl(${colors.h + hOffset}, ${colors.s}%, ${colors.l + lOffset}%)`;
    const sideLight = `hsl(${colors.h + hOffset}, ${colors.s}%, ${colors.l + lOffset - 8}%)`;
    const sideDark = `hsl(${colors.h + hOffset}, ${colors.s}%, ${colors.l + lOffset - 15}%)`;

    const currentHeight = TILE_HEIGHT * progress;
    const currentY = y - (TILE_HEIGHT - currentHeight);
    const topY = currentY - currentHeight;

    const gradient = ctx.createLinearGradient(x, topY, x, currentY);
    gradient.addColorStop(0, sideLight);
    gradient.addColorStop(1, sideDark);

    const topSize = TILE_SIZE.current;
    const bottomSize = TILE_SIZE.current * TAPER_FACTOR; // Calculate the wider base size

    for (let i = 0; i < 8; i++) {
        const a1 = (Math.PI / 4) * i + (Math.PI / 8);
        const a2 = (Math.PI / 4) * (i + 1) + (Math.PI / 8);
        ctx.beginPath();
        // Top vertices use topSize
        ctx.moveTo(x + topSize * Math.cos(a1), topY + topSize * Math.sin(a1) * Math.sin(boardView.tilt));
        ctx.lineTo(x + topSize * Math.cos(a2), topY + topSize * Math.sin(a2) * Math.sin(boardView.tilt));
        // Bottom vertices use the wider bottomSize
        ctx.lineTo(x + bottomSize * Math.cos(a2), currentY + bottomSize * Math.sin(a2) * Math.sin(boardView.tilt));
        ctx.lineTo(x + bottomSize * Math.cos(a1), currentY + bottomSize * Math.sin(a1) * Math.sin(boardView.tilt));
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
    }
    
    drawRoundedOctagon(ctx, x, topY, topSize, topColor);
}
    function drawDropShadow(ctx, q, r) {
    const { x, y } = axialToIsometric(q, r);
    const shadowSize = TILE_SIZE.current * TAPER_FACTOR; // Shadow should match the widest part

    ctx.save();
    ctx.translate(x + SHADOW_OFFSET, y + SHADOW_OFFSET);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i + (Math.PI / 8);
        ctx.lineTo(shadowSize * Math.cos(angle), shadowSize * Math.sin(angle) * Math.sin(boardView.tilt));
    }
    ctx.closePath();
    ctx.fillStyle = TILE_COLORS.Shadow;
    ctx.fill();
    ctx.restore();
}
    function drawOctagon(ctx, x, y, size, color, isFillOnly = false) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const angle = (Math.PI / 4) * i + (Math.PI / 8); ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle) * Math.sin(boardView.tilt)); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); if (!isFillOnly) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke(); } }
    function drawController(ctx, q, r) { const { x, y } = axialToIsometric(q, r); const tile = gameState.board.get(`${q},${r}`); const player = gameState.players.find(p => p.id === tile.controller); const color = player ? player.color : '#ffffff'; const topY = y - TILE_HEIGHT; ctx.beginPath(); ctx.arc(x, topY, TILE_SIZE.current * 0.3, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke(); }
    function drawCreature(ctx, q, r, type) { const { x, y } = axialToIsometric(q, r); const creatureY = y - TILE_HEIGHT * 1.5; ctx.fillStyle = '#FF4500'; ctx.font = `bold ${TILE_SIZE.current * 0.7}px 'Press Start 2P'`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const initial = type === 'Sky Fish' ? 'F' : type.charAt(0); ctx.fillText(initial, x, creatureY); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeText(initial, x, creatureY); }
    function handleBoardClick(event) { if (mouseState.isDown && (event.movementX !== 0 || event.movementY !== 0)) return; if (!gameState.action) return; const { q, r } = pixelToAxial(event.offsetX, event.offsetY); const move = gameState.validMoves.find(m => m.q === q && m.r === r); if (move) { const key = `${q},${r}`; const player = getCurrentPlayer(); if (gameState.pendingCard) { triggerPlayAnimation(playerHandElement.children[gameState.pendingCard.index]); player.hand.splice(gameState.pendingCard.index, 1); } if (gameState.action.type === 'place_tile') { const newTileObject = { q, r, type: gameState.action.tileType, controller: player.id, creature: null }; gameState.board.set(key, newTileObject); newTiles.push({ tile: newTileObject, progress: 0 }); boardDimensions.minQ = Math.min(boardDimensions.minQ, q); boardDimensions.maxQ = Math.max(boardDimensions.maxQ, q); boardDimensions.minR = Math.min(boardDimensions.minR, r); boardDimensions.maxR = Math.max(boardDimensions.maxR, r); resizeAndCalculateTargetSize(); 
	} else if (gameState.action.type === 'summon_creature') {
    	const creatureData = { ...gameState.action.creature, ownerId: player.id, uncontrolledTurns: 0 };
    	gameState.board.get(key).creature = creatureData;
    	createOrUpdateSprite(gameState.board.get(key));
} else if (gameState.action.type === 'claim_tile') { gameState.board.get(key).controller = player.id; } else if (gameState.action.type === 'respawn') { const tile = gameState.board.get(key); tile.controller = player.id; } cancelAction(); } else { if (gameState.action) showError("Invalid move!"); } }
    function pixelToAxial(px, py) { const boardCenterX_Q = (boardDimensions.maxQ + boardDimensions.minQ) / 2; const boardCenterY_R = (boardDimensions.maxR + boardDimensions.minR) / 2; const centerPixel = axialToIsometric(boardCenterX_Q, boardCenterY_R); const mouseX = px - (canvas.width / 2 - centerPixel.x); const mouseY = py - (canvas.height / 2 - centerPixel.y); const rot = -boardView.rotation; const tilt = boardView.tilt; const rotX = mouseX; const rotZ = mouseY / Math.sin(tilt); const x3d = rotX * Math.cos(rot) - rotZ * Math.sin(rot); const z3d = rotX * Math.sin(rot) + rotZ * Math.cos(rot); const q = x3d / (TILE_SIZE.current * 1.5); const r = (z3d / (TILE_SIZE.current * 1.73)) - (q / 2); return roundToNearestAxial(q, r); }
    function startAction(action) { gameState.action = action; calculateValidMoves(); }
    function cancelAction() { if (gameState.pendingCard) { getCurrentPlayer().cloudShards += gameState.pendingCard.card.cost; } gameState.action = null; gameState.pendingCard = null; gameState.validMoves = []; rangeHighlights = []; hideChoicePrompt(); updateUI(); }
    function calculateValidMoves() { rangeHighlights = []; gameState.validMoves = []; const player = getCurrentPlayer(); if (!gameState.action) return; switch (gameState.action.type) { case 'place_tile': const friendlyTiles = [...gameState.board.values()].filter(t => t.controller === player.id); const validCoords = new Set(); friendlyTiles.forEach(tile => { getNeighbors(tile.q, tile.r).forEach(n => { if (!gameState.board.has(`${n.q},${n.r}`)) validCoords.add(`${n.q},${n.r}`); }); }); gameState.validMoves = [...validCoords].map(s => ({ q: Number(s.split(',')[0]), r: Number(s.split(',')[1]) })); break; case 'summon_creature': const validPlacements = [...gameState.board.values()].filter(t => t.controller === player.id && t.type === gameState.action.targetTile && !t.creature); gameState.validMoves = validPlacements.map(t => ({ q: t.q, r: t.r })); if (gameState.action.creature.type === 'Golem') { if (mouseState.hoveredTile && validPlacements.some(t => t.q === mouseState.hoveredTile.q && t.r === mouseState.hoveredTile.r)) { for (const tile of gameState.board.values()) { if (getDistance(mouseState.hoveredTile, tile) <= 5) { rangeHighlights.push(tile); } } } } break; case 'claim_tile': const friendlyTilesClaim = [...gameState.board.values()].filter(t => t.controller === player.id); const validClaimCoords = new Set(); friendlyTilesClaim.forEach(tile => { getNeighbors(tile.q, tile.r).forEach(n => { const key = `${n.q},${n.r}`; const neighborTile = gameState.board.get(key); if (neighborTile && neighborTile.controller === null) { validClaimCoords.add(key); } }); }); gameState.validMoves = [...validClaimCoords].map(s => ({ q: Number(s.split(',')[0]), r: Number(s.split(',')[1]) })); break; case 'respawn': const unownedTiles = [...gameState.board.values()].filter(t => t.controller === null); gameState.validMoves = unownedTiles.map(t => ({ q: t.q, r: t.r })); break; } }
    function showError(message) { errorMessage.textContent = message; errorPanel.classList.remove('hidden'); errorPanel.classList.add('visible'); setTimeout(() => { errorPanel.classList.remove('visible'); }, 2500); }
    function showChoicePrompt(text, options, callback) { promptTextElement.textContent = text; promptOptionsElement.innerHTML = ''; options.forEach(opt => { const btn = document.createElement('button'); btn.textContent = opt; btn.dataset.type = opt; btn.onclick = () => { hideChoicePrompt(); callback(opt); }; promptOptionsElement.appendChild(btn); }); choicePromptElement.classList.remove('hidden'); }
    function hideChoicePrompt() { choicePromptElement.classList.add('hidden'); }
    function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
    function getCurrentPlayer() { return gameState.players[gameState.currentPlayerIndex]; }
    function getNeighbors(q, r) { return [ { q: q + 1, r: r }, { q: q - 1, r: r }, { q: q, r: r + 1 }, { q: q, r: r - 1 }, { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 } ]; }
    function getDistance(tileA, tileB) { const dQ = Math.abs(tileA.q - tileB.q); const dR = Math.abs(tileA.r - tileB.r); const dS = Math.abs((-tileA.q - tileA.r) - (-tileB.q - tileB.r)); return Math.max(dQ, dR, dS); }
    function roundToNearestAxial(q, r) { const s = -q - r; let rq = Math.round(q); let rr = Math.round(r); let rs = Math.round(s); const q_diff = Math.abs(rq - q); const r_diff = Math.abs(rr - r); const s_diff = Math.abs(rs - s); if (q_diff > r_diff && q_diff > s_diff) { rq = -rr - rs; } else if (r_diff > s_diff) { rr = -rq - rs; } return { q: rq, r: rr }; }
    function triggerPlayAnimation(cardElement) { if (!cardElement) return; const rect = cardElement.getBoundingClientRect(); const clone = cardElement.cloneNode(true); clone.classList.remove('newly-drawn'); clone.style.position = 'absolute'; clone.style.left = `${rect.left}px`; clone.style.top = `${rect.top}px`; clone.style.width = `${rect.width}px`; clone.style.height = `${rect.height}px`; document.body.appendChild(clone); clone.classList.add('card-playing-animation'); clone.addEventListener('animationend', () => clone.remove()); }

    window.addEventListener('resize', resizeAndCalculateTargetSize);
    endTurnBtn.addEventListener('click', endTurn);
    canvas.addEventListener('click', handleBoardClick);

    initializeGame();
    setupInputControls();
    gameLoop();
});