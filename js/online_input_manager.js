function OnlineInputManager(_onlinePlayer) {
  this.events = {};
  this.listen(_onlinePlayer);
}

OnlineInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

OnlineInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

OnlineInputManager.prototype.listen = function (_onlinePlayer) {
  var self = this;
  window._io.addListener(function (msg) {
    if (Number(_onlinePlayer) === Number(msg.player) && typeof(msg.move) === 'number') {
      self.emit("move", msg.move);
    }
  });

  // var retry = document.getElementsByClassName("retry-button")[1];
  // retry.addEventListener("click", this.restart.bind(this));
};

OnlineInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};
