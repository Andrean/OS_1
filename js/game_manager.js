function GameManager(options, InputManager, Actuator, socket) {
  this.size         = options.size; // Size of the grids
  this.options      = options;

  this.socket = socket;
  
  if (options.online) {
    this.inputManager = new InputManager (options.player);
    this.actuator     = new Actuator(1, true);
  }
  else {
    this.inputManager = new InputManager;
    this.actuator     = new Actuator(0, false);

    this.inputManager.on("move", function (direction) {
      socket.send(JSON.stringify({player: options.player, move: direction}));
    });
  }

  this.startTiles   = options.startTiles;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.grid = new Grid(this.size);
  this.actuator.actuate(this.grid, {score: 0, over: false, won: false});
  this.actuator.restart();
  //this.setup();
};

// Set up the game
GameManager.prototype.setup = function () {
  this.grid         = new Grid(this.size);

  this.score        = 0;
  this.over         = false;
  this.won          = false;

  // Add the initial tiles
  this.addStartTiles();

  // Update the actuator
  this.actuate();
  
  if (this.options.online)
    this.addRandomTile(); //for when the first move is made
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0, len = this.startTiles.length; i < len; i++) {
    this.grid.insertTile(new Tile(this.startTiles[i], this.startTiles[i].value));
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function (cb) {
  if (this.grid.cellsAvailable()) {
    var tile;
    var self = this;
    if (this.options.online) {
      window._io.addOneTimeListener(function (msg) {
          tile = new Tile(msg.tile.cell, msg.tile.value); //get generated tile from other player
          self.grid.insertTile(tile);
          if (cb !== void 0)
            cb();
        }, function (msg) {
          return msg.player === self.options.player && msg.tile;
        });
    }
    else {
      var value = Math.random() < 0.9 ? 2 : 4;
      var loc = this.grid.randomAvailableCell();
      tile = new Tile(loc, value);
      var tileObj = {};
      tileObj['cell'] = loc;
      tileObj['value'] = value;
      this.socket.send(JSON.stringify({player: this.options.player, tile: tileObj}));
      this.grid.insertTile(tile);
      cb();
    }
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  var self = this;
  var didWeWin = this.movesAvailable() && (this.won || ((window._io.player[this.options.player] > window._io.player[this.options.otherPlayer]) && (this.over || window._io.gameOver)));
  var isItOver = (this.over || window._io.gameOver);
  window._io.addListener(function (msg) {
    if (!(msg.player === self.options.otherPlayer && msg.gameEnd)) return;
    self.over = self.won = true;
    self.actuator.actuate(self.grid, {
      score: self.score,
      over:  self.over,
      won: self.won
    });
  });
  if (isItOver && !didWeWin && !this.options.sentBefore) {
    this.socket.send(JSON.stringify({player: this.options.player, gameEnd: true}));
    this.options.sentBefore = true;
  }
  this.actuator.actuate(this.grid, {
    score: this.score,
    over:  isItOver,
    won: didWeWin
  });
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2:down, 3: left
  var self = this;
  if (this.over || this.won) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;
          window._io.player[self.options.player] = self.score;
          // The mighty 2048 tile
          
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile(function () {
      if (!self.movesAvailable() || window._io.gameOver) {
        self.over = true; // Game over!
        self.won = window._io.player[self.options.player] > window._io.player[(self.options.otherPlayer)];
      }

      self.actuate();
    });
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // up
    1: { x: 1,  y: 0 },  // right
    2: { x: 0,  y: 1 },  // down
    3: { x: -1, y: 0 }   // left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);
          if (other) {
          }

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};