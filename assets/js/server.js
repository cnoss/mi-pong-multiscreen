var connect = {}

connect.id = (location.search) ? location.search.replace('?', '') : (Math.random() * 0xFFFFFF << 0).toString(16);
connect.uri = 'https://perasmus.uber.space';
connect.host = location.href.replace(/server\.html.*$/, '');
connect.path = '';


// Besitzer der beiden Controller-Slots. Der erste, der sich eincheckt,
// bekommt den Slot; weitere Geräte am selben QR-Code/Link werden abgewiesen.
var owners = { playerOne: null, playerTwo: null };

function isPlayer(user) {
  return user === 'playerOne' || user === 'playerTwo';
}

function isOwner(user, clientId) {
  return isPlayer(user) && owners[user] !== null && owners[user] === clientId;
}

const initSocket = () => {

  connect.socket = io.connect(connect.uri);
  connect.user = 'host';

  // Hinweis: Die Slot-Vergabe läuft jetzt über die 'join'-Nachricht (mit
  // eindeutiger clientId), nicht mehr über das anonyme 'member'-Event –
  // nur so lässt sich der erste Besitzer von späteren Geräten unterscheiden.
  connect.socket.on('member', function (data) {
    console.log('member', data);
  });

  connect.socket.emit('connectTo', connect.id, connect.user);
  connect.socket.on('message', function (data) {
    var data = JSON.parse(data);

    // Anmeldung eines Controllers: Slot vergeben oder ablehnen
    if (data.type === 'join') {
      handleJoin(data);
      return;
    }

    // Alle übrigen Controller-Befehle nur vom bestätigten Besitzer annehmen.
    // So kann ein zweites Gerät, das denselben QR-Code gescannt hat, den
    // Schläger weder bewegen noch das Spiel starten.
    if (isPlayer(data.user) && !isOwner(data.user, data.clientId)) {
      return;
    }

    if (data.type === 'move') {
      mouse[data.user].x = data.pos.x * canvas.w;
      mouse[data.user].y = data.pos.y * canvas.h;
    }

    // Start / Fortsetzen: erster Controller, der drückt, gibt den Ball frei.
    // Spielstand bleibt erhalten (0:0 = Start, sonst = nächste Runde).
    if (data.type === 'start') {
      if (!game.isPlaying()) game.start();
    }

    // Neues Spiel: Spielstand auf 0:0 zurücksetzen und ersten Ball freigeben
    if (data.type === 'newgame') {
      if (!game.isPlaying()) {
        pad.list[0].wins = 0;
        pad.list[1].wins = 0;
        game.start();
      }
    }

  });
}

// Vergibt einen Controller-Slot an das erste Gerät und weist weitere ab
function handleJoin(data) {
  var user = data.user;
  if (!isPlayer(user) || !data.clientId) return;

  // Slot ist belegt und ein anderes Gerät meldet sich → ablehnen
  if (owners[user] !== null && owners[user] !== data.clientId) {
    sendOwnership('rejected', user, data.clientId);
    return;
  }

  // Slot ist frei oder dasselbe Gerät meldet sich erneut (z.B. Reload) → annehmen
  owners[user] = data.clientId;
  sendOwnership('accepted', user, data.clientId);

  qrcoder.hideOne(user);

  // Direktes Feedback: Schläger "boingt" und folgt ab jetzt dem Controller
  pad.connect(user);
  game.lobby();

  // neu verbundenem Controller den aktuellen Spielzustand mitteilen,
  // damit er den passenden Knopf anzeigt
  broadcastState();
}

// Sendet eine an ein bestimmtes Gerät adressierte Besitz-Antwort
function sendOwnership(type, user, clientId) {
  if (!connect.socket) return;

  var msg = JSON.stringify({
    type: type,
    user: user,
    clientId: clientId
  });

  connect.socket.send(msg, connect.user);
}

// Sendet den aktuellen Spielzustand an alle Controller, damit diese den
// richtigen Knopf ("Spiel starten" / "Spiel fortsetzen" / "Neues Spiel") zeigen
function broadcastState() {
  if (!connect.socket) return;

  var msg = JSON.stringify({
    type: 'state',
    playing: game.isPlaying(),
    scoreOne: pad.list[0].wins,
    scoreTwo: pad.list[1].wins
  });

  connect.socket.send(msg, connect.user);
}


// Welcome Sound
var gamesound = new Tone.Synth().toMaster();
gamesound.triggerAttackRelease("C3", "8n");
gamesound.triggerAttackRelease("E3", "8n", "+0.2");
gamesound.triggerAttackRelease("G3", "8n", "+0.4");


// Margin around the game area
var margin = { top: 0, left: 0, bottom: 180, right: 0 };
var color = { playerOne: '#dd1166', playerTwo: '#00AD2F' };


// Grundgeschwindigkeit des Spiels, einstellbar per Stepper in server.html.
// Stufe 1..10, Default 5 = neutral (entspricht der bisherigen Geschwindigkeit).
// factor(): 5 -> 1.0, 1 -> 0.2, 10 -> 2.0
var speedControl = new function () {
  var self = this;
  self.level = 5;

  self.factor = function () {
    return self.level / 5;
  };

  self.set = function (value) {
    var level = parseInt(value, 10);
    if (isNaN(level)) level = 5;
    self.level = Math.min(10, Math.max(1, level));
  };

  // Mit dem Stepper verdrahten, sobald das DOM bereit ist
  self.init = function () {
    var input = document.getElementById('gameSpeed');
    if (!input) return;

    self.set(input.value);
    input.addEventListener('input', function () {
      self.set(input.value);
    });
  };
};


// RequestAnimFrame: a browser API for getting smooth animations
window.requestAnimFrame = (function () {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      return window.setTimeout(callback, 1000 / 60);
    };
})();



// Initialize canvas and required variables
var mouse = {
  playerOne: {},
  playerTwo: {}
}; // Mouse object to store it's current position



/* The canvas
=======================================*/
var canvas = new function () {
  var self = this;
  var el = document.getElementById("canvas");
  var ctx = self.ctx = el.getContext("2d");

  self.draw = function () {
    ctx.clearRect(0, 0, self.w, self.h);

    var dashLen = 20,
      lineWidth = 7;

    ctx.fillStyle = "#ffffff";

    for (var i = 0; i < canvas.h / dashLen; i += 2) {
      ctx.fillRect(canvas.w / 2 - lineWidth / 2 + 12,  // x
        (i * dashLen),					// y
        lineWidth,						// width
        dashLen);						// height
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(0, canvas.h - 1, canvas.w, 1)
  }

  self.resize = function () {
    el.width = self.w = window.innerWidth - margin.left - margin.right;
    el.height = self.h = window.innerHeight - margin.top - margin.bottom;
  }

  self.resize();

  window.addEventListener('resize', self.resize);
};



/* The QR-codes
=======================================*/
var qrcoder = new function () {
  var self = this;
  var p = {
    playerOne: document.getElementById('qrcode_left'),
    playerTwo: document.getElementById('qrcode_right')
  }

  var l = 0;


  self.create = function () {
    p.playerOne.innerHTML = '';
    p.playerTwo.innerHTML = '';

    l = 0;

    // Fuck, den musste ich noch umcoden, weil der qrcoder jquery vorraussetzte...
    var url_p1 = connect.host + connect.path + '?' + connect.id + '__playerOne';
    appendUrl(url_p1, "playerOne");
    var url_p2 = connect.host + connect.path + '?' + connect.id + '__playerTwo';
    appendUrl(url_p2, "playerTwo");

    qrcode(p.playerOne, url_p1);
    qrcode(p.playerTwo, url_p2);

    console.log(url_p1, url_p2);

    self.show();
  }

  self.show = function () {
    p.playerOne.classList.remove('hidden');
    p.playerTwo.classList.remove('hidden');
  }

  self.hideAll = function () {
    p.playerOne.classList.add('hidden');
    p.playerTwo.classList.add('hidden');
  }

  self.hideOne = function (name) {
    if (!p[name]) return;
    if (p[name].classList.contains('hidden')) return;

    p[name].classList.add('hidden');
    l++;

    self.check();
  }

  self.check = function () {
    // Spielstart erfolgt jetzt per Start-Knopf auf dem Controller,
    // nicht mehr automatisch, sobald beide verbunden sind.
  }


  // qr.qrcode(connect.uri+connect.path+'?'+connect.id);
  // game.start()	

}

/* URL-Anzeige
=======================================*/

function appendUrl(url, player) {
  const id = player === 'playerOne' ? 'qrcode_left' : 'qrcode_right';
  const p = document.createElement('p');
  p.className = "url";
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = url;
  link.style.color = color[player];
  p.appendChild(link);
  document.getElementById(id).appendChild(p);

  return true;
}



/* The Particle
=======================================*/
var particle = new function () {
  var self = this;
  var ctx = canvas.ctx;
  var count = 20;
  var list = [];

  self.create = function (par) {
    for (var i = 0; i < count; i++) {
      list.push({
        x: par.x,
        y: par.y,
        r: 1.2,
        //r: 4,
        vx: par.m * Math.random() * 1.5,
        vy: -1.5 + Math.random() * 3
      });
    }
  };

  self.draw = function () {
    var newList = [];

    for (var i = 0, l = list.length; i < l; i++) {
      var par = list[i];

      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      //ctx.arc(par.x, par.y, par.r, 0, Math.PI*2, false);
      ctx.rect(par.x - par.r, par.y - par.r, 2 * par.r, 2 * par.r);
      ctx.fill();

      par.x += par.vx;
      par.y += par.vy;
      par.r = Math.max(par.r - Math.random() * 0.1, 0);

      if (par.r) newList.push(par);
    }

    list = newList;
  };
};

/* The Ball
=======================================*/
var ball = new function () {
  var self = this;
  var ctx = canvas.ctx;
  var startOnLeftSide = true;
  var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    x = w.innerWidth || e.clientWidth || g.clientWidth,
    y = w.innerHeight || e.clientHeight || g.clientHeight;

  self.init = function () {
    // Grundgeschwindigkeit: skaliert mit der Bildschirmbreite und wird
    // über den Stepper (Stufe 1..10, 5 = neutral) feinjustiert.
    var speed = (x / 128) * speedControl.factor();

    self.x = (startOnLeftSide) ? 100 : canvas.w - 100;
    self.y = (canvas.h - 140) * Math.random() + 70;
    self.r = 10;
    self.vx = speed;
    self.vy = speed * (startOnLeftSide) ? 1 : -1;

    if (!startOnLeftSide) {
      self.switchX();
      if (Math.random() < 0.5) self.switchY();
    }

    startOnLeftSide = !startOnLeftSide;
  };

  self.draw = function () {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.rect(self.x - self.r, self.y - self.r, self.r * 2, self.r * 2);
    ctx.fill();
  };

  self.move = function () {
    self.x += self.vx;
    self.y += self.vy;
  };

  self.speedUp = function () {
    if (Math.abs(self.vx) < 15) {
      self.vx += (self.vx < 0) ? -0.5 : 0.5;
      self.vy += (self.vy < 0) ? -0.5 : 0.5;
    }
  };

  self.switchX = function () {
    self.vx = -self.vx;
  };

  self.switchY = function () {
    self.vy = -self.vy;
  };

  self.checkCollision = function () {
    checkCollisionPaddle() || checkCollisionWall() || checkCollisionOut();
  };

  var checkCollisionWall = function () {
    if (self.y < self.r || self.y > (canvas.h - self.r)) {
      self.switchY();
      self.y = (self.y < self.r) ? self.r : (canvas.h - self.r);
      // Bande: ganz kurzer, leiserer Tick (Dauer 0.02s, Velocity 0.3)
      gamesound.triggerAttackRelease("G3", 0.02, undefined, 0.3);
      return true;
    }
  }

  var checkCollisionOut = function () {
    if (self.x < self.r || self.x > canvas.w - self.r) {
      var padWinnerIndex = self.x < self.r ? 1 : 0;
      var padWinner = pad.list[padWinnerIndex];

      if (!game.isPlaying())
        return;

      padWinner.wins++;

      game.stop();

      canvas.draw();
      scoreTable.draw();
      pad.draw();
      ball.draw();

      if (padWinner.wins === 300) {
        gameOverer.start(padWinner, padWinnerIndex);
        pad.list[0].wins = 0;
        pad.list[1].wins = 0;
      }

      // kein Countdown mehr – Controller zeigen jetzt den Fortsetzen-Knopf
      broadcastState();

      gamesound.triggerAttackRelease("C4", "8n");
      gamesound.triggerAttackRelease("E4", "8n", "+0.2");
      gamesound.triggerAttackRelease("G4", "8n", "+0.4");
      gamesound.triggerAttackRelease("C5", "8n", "+0.6");
      return true;
    }
  }

  var checkCollisionPaddle = function () {
    // Collision with paddles
    for (var i = 0, l = pad.list.length; i < l; i++) {
      var p = pad.list[i];
      var overlap =
        self.y + self.r >= p.y &&
        self.y - self.r <= p.y + p.h &&
        self.x + self.r >= p.x &&
        self.x - self.r <= p.x + p.w;

      if (overlap) {
        self.switchX();
        self.speedUp();

        var user = (self.x < canvas.w / 2) ? "playerOne" : "playerTwo";
        var msg = JSON.stringify({
          type: 'notify',
          user: user
        });
        connect.socket.send(msg, connect.user);
        gamesound.triggerAttackRelease("G5", 0.1);

        particle.create({
          x: self.x - self.vx / Math.abs(self.vx) * self.r,
          y: self.y,
          m: self.vx / Math.abs(self.vx)
        });

        return true;
      }
    }
  };

  self.init();
};


/* The Paddles
=======================================*/
var pad = new function () {
  var self = this;
  var ctx = canvas.ctx;
  var leftRightPadding = 25;

  self.init = function () {
    self.list = [
      create("Left Paddle"),
      create("Right Paddle")
    ]
  };

  self.draw = function () {
    for (var i = 0, l = self.list.length; i < l; i++) {
      var p = self.list[i];

      p.x = (i === 0) ? leftRightPadding : canvas.w - p.w - leftRightPadding;
      p.y = p.y || (canvas.h / 2 - p.h / 2);

      var fillColor = (i === 0) ? color.playerOne : color.playerTwo;

      ctx.fillStyle = fillColor;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  };

  self.move = function (id, x, y) {
    if (self.list !== undefined) {
      var p = self.list[id];
      p.y = y - p.h / 2;

      if (p.y < 1) p.y = 1;
      if (p.y > (canvas.h - p.h)) p.y = (canvas.h - p.h);
    }
  };

  // Markiert einen Schläger als verbunden und startet die Feedback-Animation
  self.connect = function (name) {
    // nur die beiden echten Spieler verbinden – alles andere (z.B. 'host')
    // ignorieren, sonst würde der grüne Schläger fälschlich als belegt gelten
    var id = (name === 'playerOne') ? 0 : (name === 'playerTwo') ? 1 : -1;
    if (id === -1) return;

    var p = self.list[id];

    if (!p || p.connected) return;

    p.connected = true;
    p.anim = true;
    p.animStart = Date.now();
    p.animDuration = 1200;
  };

  // Lobby-Update: verbundene Schläger folgen ihrem Controller bzw. spielen die Animation
  self.update = function () {
    for (var i = 0, l = self.list.length; i < l; i++) {
      var p = self.list[i];

      if (p.anim) {
        animate(p);
      } else if (p.connected) {
        var name = (i === 0) ? 'playerOne' : 'playerTwo';
        if (mouse[name].y !== undefined) self.move(i, mouse[name].x, mouse[name].y);
      }
    }
  };

  // "Boing": startet unten, schwingt nach oben und pendelt sich mittig ein
  var animate = function (p) {
    var settle = canvas.h / 2 - p.h / 2;
    var t = (Date.now() - p.animStart) / p.animDuration;

    if (t >= 1) {
      p.anim = false;
      p.y = settle;
      return;
    }

    var y = settle + settle * Math.exp(-3 * t) * Math.cos(t * Math.PI * 4);
    p.y = Math.max(1, Math.min(canvas.h - p.h, y));
  };

  var create = function (name) {
    return {
      w: 25,
      h: 150,
      name: name,
      wins: 0,
      connected: false,
      anim: false
    }
  }

  self.init();
};


/* The Scoretable
=======================================*/
var scoreTable = new function () {
  var self = this;

  self.draw = function () {
    var ctx = canvas.ctx;

    for (var i = 0; i < pad.list.length; i++) {
      var playerPad = pad.list[i];

      var winsText = "" + playerPad.wins;
      var fillColor = (i === 0) ? color.playerOne : color.playerTwo;
      var xPos = ((i % 2) ? -100 : 100);

      ctx.font = "100px FFFForward, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "hanging";
      ctx.fillStyle = fillColor;
      ctx.fillText(winsText, canvas.w / 2 - xPos + 17, 70);
    }
  };
};


/* The Computer Player (Autoplay)
=======================================*/
// Steuert den grünen Schläger (playerTwo, rechts), wenn kein Controller
// dafür verbunden ist. Bewegt sich mit gedeckelter Geschwindigkeit zum Ball
// und nur, wenn der Ball auf ihn zufliegt – sonst wäre er unschlagbar.
var ai = new function () {
  var self = this;
  var maxSpeed = 7; // Pixel pro Frame – kleiner = leichter zu schlagen

  self.update = function () {
    var p = pad.list[1];
    if (!p) return;

    var paddleCenter = p.y + p.h / 2;

    // Ball fliegt nach rechts (vx > 0) → verfolgen, sonst zur Mitte zurück
    var target = (ball.vx > 0) ? ball.y : canvas.h / 2;

    var diff = target - paddleCenter;
    var step = Math.max(-maxSpeed, Math.min(maxSpeed, diff));

    // mouse.playerTwo.y ist die Soll-Mitte, die der Loop ohnehin nutzt
    mouse.playerTwo.y = Math.max(0, Math.min(canvas.h, paddleCenter + step));
  }
};


/* The Game
=======================================*/
var game = new function () {
  var self = this;
  var playing = false;
  var lobbyRunning = false;

  // Render-Loop vor dem eigentlichen Spielstart, damit verbundene
  // Schläger schon Feedback geben (Animation + Controller-Steuerung)
  self.lobby = function () {
    if (playing || lobbyRunning) return;
    lobbyRunning = true;
    lobbyLoop();
  }

  var lobbyLoop = function () {
    if (playing) {
      lobbyRunning = false;
      return;
    }

    canvas.draw();
    scoreTable.draw();
    pad.draw();
    pad.update();

    requestAnimFrame(lobbyLoop);
  }

  self.draw = function () {
    // draw cylce
    canvas.draw();
    scoreTable.draw();
    pad.draw();
    ball.draw();
    particle.draw();

    // update cycle
    pad.move(0, mouse.playerOne.x, mouse.playerOne.y);
    // Grün vom Computer steuern lassen, solange kein Controller verbunden ist
    if (!pad.list[1].connected) ai.update();
    pad.move(1, mouse.playerTwo.x, mouse.playerTwo.y);
    ball.move();

    // check status
    ball.checkCollision();
  }

  self.loop = function () {
    if (playing) {
      self.draw();
      requestAnimFrame(self.loop);
    }
  }

  self.init = function () {
    ball.init();
    if (game.isPlaying())
      pad.init();

    canvas.draw();
    scoreTable.draw();
    pad.draw();
    //ball.draw();
    particle.draw();
  }

  self.start = function () {
    self.init();
    playing = true;
    // QR-Codes und Links ausblenden, sobald gespielt wird – auch im
    // Autoplay-Modus, wo der zweite Controller nie verbunden wurde.
    qrcoder.hideAll();
    self.loop();
    broadcastState();
  }

  self.nextRound = function () {
    playing = false;
    self.start();
  }

  self.stop = function () {
    playing = false;
  }

  self.isPlaying = function () {
    return playing;
  }
}


// Add mousemove and mousedown events to the canvas
/*
var el  = document.getElementById("canvas");
el.addEventListener("mousemove", function(e){
  mouse.x = e.pageX || 0;
  mouse.y = e.pageY || canvas.h/2;
}, true);

el.addEventListener("mousedown", btnClick, true);
*/

// Start Button object
var startBtn = {
  w: 120,
  h: 50,
  x: canvas.w / 2 - 50,
  y: canvas.h / 2 - 25,

  draw: function () {
    return true;
    /*var ctx = canvas.ctx;
    ctx.clearRect(this.x - 15, this.y - 25, this.w + 30, this.h + 55);
  	
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = "2";
    ctx.strokeRect(this.x, this.y, this.w, this.h);
  	
    ctx.font = "20px FFFForward, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Start", canvas.w/2 + 12, canvas.h/2 + 5);*/
  }
};

// Restart Button object
var restartBtn = {
  w: 120,
  h: 50,
  x: canvas.w / 2 - 50,
  y: canvas.h / 2 + 100,

  draw: function () {
    return false;
    /*var ctx = canvas.ctx;
  	
    restartBtn.x = canvas.w/2 - 50;
    restartBtn.y = canvas.h/2 + 100;
  	
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = "12";
    ctx.strokeRect(this.x, this.y, this.w, this.h);
  	
    ctx.font = "20px FFFForward, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Restart", canvas.w/2 + 12, canvas.h/2 + 130);*/
  }
};




/* The countdown
=======================================*/
var gameOverer = new function () {
  var self = this;
  var ctx = canvas.ctx;

  var msg = {};

  self.start = function (padWinner, playerIndex) {
    var countdown = 4;
    msg.padWinner = padWinner;
    msg.playerIndex = playerIndex;

    self.draw(countdown--);

    var intervalHandler = window.setInterval(function () {
      canvas.draw(false);
      scoreTable.draw();
      pad.draw();
      ball.draw();

      self.draw(countdown);

      if (countdown === 0) {
        window.clearInterval(intervalHandler);

        window.setTimeout(function () {
          location.href = location.href;
        }, 750);
      }

      countdown--;
    }, 1000);
  }

  self.draw = function (currCountdown) {

    if (currCountdown === 0)
      currCountdown = "NOW!";


    ctx.clearRect(canvas.w / 2 - 20, canvas.h / 2 - 70, 60, 230);

    var fillColor = (msg.playerIndex === 0) ? color.playerOne : color.playerTwo;

    ctx.fillStyle = "#ffffff";
    ctx.font = "40px FFFForward, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Game Over!", canvas.w / 2, canvas.h / 2 - 20);

    ctx.fillStyle = fillColor;
    ctx.font = "30px FFFForward, sans-serif";
    ctx.fillText(msg.padWinner.name + " won!", canvas.w / 2, canvas.h / 2 + 60);


    ctx.fillStyle = "#ffffff";
    ctx.font = "30px FFFForward, sans-serif";
    ctx.fillText("next Game in " + currCountdown, canvas.w / 2, canvas.h / 2 + 140);

  }
};




// Function to run when the game overs
function gameOver(padWinner, playerIndex) {
  var ctx = canvas.ctx;

  ctx.clearRect(canvas.w / 2 - 20, canvas.h / 2 - 70, 60, 230);

  var fillColor = (playerIndex === 0) ? color.playerOne : color.playerTwo;

  ctx.fillStyle = "#ffffff";
  ctx.font = "40px FFFForward, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Game Over", canvas.w / 2, canvas.h / 2 - 20);

  ctx.fillStyle = fillColor;
  ctx.font = "30px FFFForward, sans-serif";
  ctx.fillText(padWinner.name + " won!", canvas.w / 2, canvas.h / 2 + 60);


  // Show the restart button
  restartBtn.draw();
}

// Function for running the whole animation


// Function to execute at startup
function startScreen() {

  initSocket();
  qrcoder.create();
  game.init();
  startBtn.draw();
  initSocket();
}

// On button click (Restart and start)
function btnClick(e) {
  // Variables for storing mouse position on click
  var mx = e.pageX,
    my = e.pageY;

  // Click start button
  if (startBtn
    && mx >= startBtn.x && mx <= startBtn.x + startBtn.w
    && my >= startBtn.y && my <= startBtn.y + startBtn.h) {
    game.start();
    startBtn = undefined; // Delete the start button after clicking it
  }

  // If the game is over, and the restart button is clicked
  if (!startBtn && !game.isPlaying()
    && mx >= restartBtn.x && mx <= restartBtn.x + restartBtn.w
    && my >= restartBtn.y && my <= restartBtn.y + restartBtn.h) {
    game.start();
  }
}

// Neue Session: Seite neu laden -> frische connect.id und damit neue QR-Codes
function newSession() {
  location.reload();
}

// Show the start screen
window.addEventListener("load", function () {
  startScreen();
  speedControl.init();
  unlockAudio();

  var newSessionBtn = document.getElementById('newSessionBtn');
  if (newSessionBtn) newSessionBtn.addEventListener('click', newSession);
});

// Browser sperren Audio bis zur ersten Nutzergeste. Auf der Server-/Großbild-
// Seite den Tone.js-AudioContext daher per Klick/Tap/Taste entsperren und den
// Willkommens-Sound danach nachholen (er ging beim Laden noch ins Leere).
function unlockAudio() {
  if (typeof StartAudioContext !== 'function') return;

  StartAudioContext(Tone.context, document.body).then(function () {
    gamesound.triggerAttackRelease("C3", "8n");
    gamesound.triggerAttackRelease("E3", "8n", "+0.2");
    gamesound.triggerAttackRelease("G3", "8n", "+0.4");
  });
}

// Taste "N" startet ebenfalls eine neue Session – nicht, während in einem
// Eingabefeld (z.B. dem Geschwindigkeits-Stepper) getippt wird
window.addEventListener('keydown', function (e) {
  var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'n' || e.key === 'N') newSession();
});

document.body.addEventListener('click', function (event) {
  // connect.socket.emit('connectTo', connect.id, connect.user);
});
