document.addEventListener("DOMContentLoaded", function () {
  	var waitingInterval, userNumInterval;
  	var sockjs_url = 'http://2048.stolarsky.com:3000/game/sockets', sockjs, multiplexer;
  	
  	// Wait till the browser is ready to render the game (avoids glitches)
 	window.requestAnimationFrame(function () {
	 	var startNewGame = function () {
	 		$('#player-msg').addClass('text-center');
	 		$('#game-start-btn').on('click', function () {
				$('#player-msg').removeClass('text-center');
				$('#player-msg').html('<span style="float:left">Searching for competitor </span>\n<span class="ellipsis">.</span>\n<span class="ellipsis">.</span>\n<span class="ellipsis">.</span>');
				$('#game-stats').fadeIn();
				userNumInterval = setInterval(function () {
					$.get('http://2048.stolarsky.com:3000/game/players', function (data) {
						data = JSON.parse(data);
						$('#num-players').html('Number of current players: ' + data.numPlayers);
						$('#num-games').html('Number of current games: ' + data.numGames);
					});
				}, 1000);
				var fadedOut = false;
				waitingInterval = setInterval(function () {
				  if (fadedOut) {
				    $('.ellipsis:eq(0)').fadeIn(500);
				    setTimeout(function() {
				      $('.ellipsis:eq(1)').fadeIn(500);
				      setTimeout(function() {
				        $('.ellipsis:eq(2)').fadeIn(500);
				      }, 250);
				    }, 250);
				    fadedOut = false;
				  } 
				  else {
				    $('.ellipsis:eq(2)').fadeOut(500);
				    setTimeout(function() {
				      $('.ellipsis:eq(1)').fadeOut(500);
				      setTimeout(function() {
				        $('.ellipsis:eq(0)').fadeOut(500);
				      }, 250);
				    }, 250);
				    fadedOut = true;
				  }
				}, 1500);
				startGame();
			});
	 	};

		var startGame = function () {
		  	io = new SockJS(sockjs_url);
			window._io = {
				listeners: [],
				oneTimeListeners: [],
				addListener: function (cb) {
					window._io.listeners.push(cb);
				},
				addOneTimeListener: function (callback, onlyWhen) {
					window._io.oneTimeListeners.push({
						cb: callback,
						condition: onlyWhen
					});
				},
				clearListeners: function () {
					window._io.listeners = [];
					window._io.oneTimeListeners = [];
				}
			}

			io.onopen = function() {
				//console.log('sockjs: open');
			};

			io.onmessage = function(event) {
			    var msg = JSON.parse(event.data);
			    //console.log('message:', msg);
			    for (var i = 0, len = window._io.listeners.length; i < len; i++) {
			    	window._io.listeners[i](msg);
			    }
			    for (var i = window._io.oneTimeListeners.length - 1; i >= 0; i--) {
			    	var tempObj = window._io.oneTimeListeners[i];
			    	if (!!tempObj.condition(msg)) {
			    		tempObj.cb(msg);
			    		window._io.oneTimeListeners.splice(i, 1);
			    	}
			    }
			};

			/* Socket Listeners! */
			window._io.addListener(function (msg) {
			    if (msg.player && msg.size && msg.startCells) {
			    	window._gameBoard = {};
			    	window._gameBoard.size = msg.size;
			    	window._gameBoard.startTiles = msg.startCells;
			    	window._gameBoard.player = msg.player;
			    }
			});

			window._io.addOneTimeListener(function (msg) {
			    clearInterval(waitingInterval);
				clearInterval(userNumInterval);
				$('#player-msg').addClass('text-center');
			    $('#player-msg').html('Opponent Found!');
			    $('#game-stats').fadeOut();
			    setTimeout(function () {
			    	window._io.player = {};
			    	window._io.player['1'] = 0;
			    	window._io.player['2'] = 0;
			    	window._io.gameOver = false;
				   	var opposingPlayer = window._gameBoard.player === 1 ? 2 : 1;
				    var times = 3;
				    var countdown = setInterval(function() {
						// Countdown messages
						$('#player-msg').removeClass('text-center');	
				   		$('#player-msg').html('<div style="text-align: center">Game Will start in <strong>' + times + '</strong></div>');
				   		times--;
				   		if (times === -1) {
				   			clearInterval(countdown);
				   			$('#player-msg').html('<div style="text-align: center"><strong> BEGIN!</strong></div>');
				   			var localManager = new GameManager({size: window._gameBoard.size, startTiles: window._gameBoard.startTiles, player: window._gameBoard.player, otherPlayer: opposingPlayer, online: false}, KeyboardInputManager, HTMLActuator, io),
				    			onlineManager = new GameManager({size: window._gameBoard.size, startTiles: window._gameBoard.startTiles, player: opposingPlayer, otherPlayer: window._gameBoard.player, online: true}, OnlineInputManager, HTMLActuator, io);
				    		
				    		var gameOver = function (timer, message, connectionIssue) {
								message = message || 'Game over!';
								clearInterval(timer);
								$('#player-msg').html('<div id="timer"><strong>' + message + '</strong></div>');
								window._io.gameOver = true;
								localManager.actuate();
								onlineManager.actuate();
								setTimeout(function () {
									$('#player-msg').fadeOut();
								}, 1000);
								setTimeout(function () {
									$('#player-msg').html('');
									$('#player-msg').fadeIn();
								}, 1500);
								setTimeout(function () {
									$('#player-msg').html('<a id="game-start-btn" class="btn">Play Again!</a>');
									startNewGame();
									window._io.clearListeners();
									io.close();
									$('#game-start-btn').on('click', function () {
										localManager.restart();
										onlineManager.restart();
									});
								}, 3000);
							};

				   			var gameTimeLeft = 120;//game timer
				   			var timer = setInterval(function () {
								var sec; 
	    						if (gameTimeLeft % 60 === 0)
	    							sec = '00';
	    						else if (('' + gameTimeLeft % 60).length === 1)
	    							sec = '0' + gameTimeLeft % 60;
	    						else
	    						 	sec = gameTimeLeft % 60;
	      						var min = Math.floor(gameTimeLeft/60);
				   				$('#player-msg').html('<div id="timer"><strong>' + min + ':' + sec + '</strong></div>');
				   				gameTimeLeft--;
				   				if (gameTimeLeft === -1) {
				   					gameOver(timer);
				   				}
				   			}, 750);
				   			
				   			window._io.addOneTimeListener(function (msg) {
							  	gameOver(timer);
							}, function (msg) {
								return !!msg.gameEnd;
							});
							// window._io.addOneTimeListener(function (msg) {
							//   	// console.log('msg sent was dead');
							//   	gameOver(timer, 'Connection Lost :(');
							// }, function (msg) {
							// 	return !!msg.dead;
							// });
				   		}
				   	}, 1000);
			    }, 1000);
			}, function (msg) {
				return !!msg.start;
			});
			
			io.onclose = function() {
			    //console.log('sockjs: close');
			};
		};

		startNewGame();
  });
});
