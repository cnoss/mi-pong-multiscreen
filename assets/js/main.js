var color = { 'playerOne': '#dd1166', 'playerTwo': '#00AD2F' };
var tone = { 'playerOne': 'C4', 'playerTwo': 'G4' };
// Trefferton je Spieler – unterschiedliche Tonhöhen, damit man hört, welcher
// Schläger den Ball getroffen hat
var hitTone = { 'playerOne': 'C5', 'playerTwo': 'G4' };
var connect = {}

connect.id		= (location.search.replace('?', '').split('__'))[0];
connect.user	= (location.search.replace('?', '').split('__'))[1];//'user' + (Math.random()*0xFFFFFF<<0).toString(16);

// Eindeutige Geräte-ID. Persistiert pro Spiel-/Slot-Kombination, damit ein
// Reload derselben Controller-Seite als derselbe Besitzer erkannt wird,
// ein anderes Gerät am selben QR-Code/Link aber eine andere ID hat.
connect.clientId = (function () {
	var key = 'pong_clientId_' + connect.id + '_' + connect.user;
	var stored;
	try { stored = localStorage.getItem(key); } catch (e) { stored = null; }
	if (!stored) {
		stored = (Math.random() * 0xFFFFFF << 0).toString(16) + '-' + Date.now().toString(16);
		try { localStorage.setItem(key, stored); } catch (e) {}
	}
	return stored;
})();

// true, sobald der Host diesen Controller als Besitzer bestätigt hat
connect.accepted = false;
// true, wenn der Slot bereits von einem anderen Gerät belegt ist
connect.locked   = false;

connect.uri		= 'https://perasmus.uber.space'; //'http://localhost';
connect.socket	= io.connect(connect.uri);
connect.socket.on('member', function(data) {
	console.log(data);

});

connect.socket.on('message', function(data) {
	var data = JSON.parse(data);
	if (data.type === 'notify' && data.user === connect.user) {
		gamesound.triggerAttackRelease(hitTone[connect.user], 0.1);
	}
	if (data.type === 'state') {
		renderButtons(data);
	}

	// Host hat diesen Controller als Besitzer des Slots bestätigt
	if (data.type === 'accepted' && data.user === connect.user && data.clientId === connect.clientId) {
		connect.accepted = true;
	}

	// Slot bereits durch ein anderes Gerät belegt – Controller sperren
	if (data.type === 'rejected' && data.user === connect.user && data.clientId === connect.clientId) {
		lockController();
	}
});

// Anmeldung beim Host: solange wiederholen, bis wir akzeptiert oder
// abgelehnt wurden (der Host ist evtl. noch nicht bereit, wenn wir starten).
function sendJoin() {
	var msg = JSON.stringify({
		type: 'join',
		user: connect.user,
		clientId: connect.clientId
	});
	connect.socket.send(msg, connect.user);
}

var joinInterval = setInterval(function () {
	if (connect.accepted || connect.locked) {
		clearInterval(joinInterval);
		return;
	}
	sendJoin();
}, 1000);
sendJoin();

// Sperrt die Steuerung und zeigt einen Hinweis, dass der Controller belegt ist
function lockController() {
	if (connect.locked) return;
	connect.locked = true;
	connect.accepted = false;

	var overlay = document.getElementById('occupied');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'occupied';
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.display = 'flex';
		overlay.style.alignItems = 'center';
		overlay.style.justifyContent = 'center';
		overlay.style.textAlign = 'center';
		overlay.style.padding = '2rem';
		overlay.style.boxSizing = 'border-box';
		overlay.style.background = 'rgba(0,0,0,0.85)';
		overlay.style.color = '#ffffff';
		overlay.style.font = '24px sans-serif';
		overlay.style.zIndex = '9999';
		overlay.textContent = 'Dieser Controller ist bereits belegt.';
		document.body.appendChild(overlay);
	}
}

// Zeigt die passenden Knöpfe abhängig vom Spielzustand:
// - läuft das Spiel: keine Knöpfe
// - 0:0 und pausiert: "Spiel starten"
// - Punkt gemacht (Stand != 0:0) und pausiert: "Spiel fortsetzen" + "Neues Spiel starten"
function renderButtons(state) {
	var startBtn   = document.getElementById('startBtn');
	var newGameBtn = document.getElementById('newGameBtn');

	if (state.playing) {
		startBtn.style.display   = 'none';
		newGameBtn.style.display = 'none';
		return;
	}

	var fresh = (state.scoreOne === 0 && state.scoreTwo === 0);

	startBtn.textContent     = fresh ? 'Spiel starten' : 'Spiel fortsetzen';
	startBtn.style.display   = 'block';
	newGameBtn.style.display = fresh ? 'none' : 'block';
}

connect.socket.emit('connectTo', connect.id, connect.user);

//create a synth and connect it to the master output (your speakers)
var gamesound = new Tone.Synth().toMaster();

var myArea = document.getElementById('area');
var myInfo = document.getElementById('info');

// colorize background
myArea.style.backgroundColor = color[connect.user];

// create a simple instance
// by default, it only adds horizontal recognizers
var mc = new Hammer(myArea);


var myAreaSize = {
	x: null,
	y: null,
	w: null,
	h: null,
	calc: function(){
		var rect = myArea.getBoundingClientRect();
		this.x   = rect.left;
		this.y   = rect.top;
		this.w   = rect.width;
		this.h   = rect.height;
	}
}

myAreaSize.calc();



// current normalized paddle position (0..1), kept in sync between touch and wheel input
var currentPos = { x: 0.5, y: 0.5 };

// how far one full wheel notch moves the paddle (fraction of the area, 0..1)
// set via the sensitivity control below (level 1..10 -> 0.01..0.10)
var wheelStep = 0.05;

// sensitivity / inertia control: 10 = sehr sensibel/schnell, 1 = träge (viel scrollen)
var sensitivity = document.getElementById('sensitivity');

function applySensitivity() {
	var level = parseInt(sensitivity.value, 10);
	if (isNaN(level)) level = 5;
	level = Math.min(10, Math.max(1, level));
	wheelStep = level * 0.01;
}

sensitivity.addEventListener('input', applySensitivity);
applySensitivity();

function sendPos(pos) {
	// belegte Controller dürfen den Schläger nicht steuern
	if (connect.locked) return;

	pos.x = Math.min(Math.max(pos.x, 0), 1);
	pos.y = Math.min(Math.max(pos.y, 0), 1);

	currentPos.x = pos.x;
	currentPos.y = pos.y;

	var msg = JSON.stringify({
		type: 'move',
		user: connect.user,
		clientId: connect.clientId,
		pos:  pos
	});

	connect.socket.send(msg, connect.user);
	// connect.socket.emit('message', msg);
}

// let the pan gesture support all directions.
// this will block the vertical scrolling on a touch-device while on the element
// mc.get('pan').set({ direction: Hammer.DIRECTION_ALL });

// listen to events...
// mc.on(panleft panright panup pandown tap press', function(ev) {
myArea.addEventListener('touchmove', function(ev) {

	var pos = {
		// x: (ev.center.x - myAreaSize.x) / myAreaSize.w,
		x: (ev.touches[0].clientX - myAreaSize.x) / myAreaSize.w,
		// y: (ev.center.y - myAreaSize.y) / myAreaSize.h
		y: (ev.touches[0].clientY - myAreaSize.y) / myAreaSize.h
	}

	sendPos(pos);
});

// mouse wheel control: scroll up/down moves the paddle up/down
myArea.addEventListener('wheel', function(ev) {
	ev.preventDefault();

	// direction only, so the step is consistent across devices/deltaModes
	var direction = ev.deltaY > 0 ? 1 : (ev.deltaY < 0 ? -1 : 0);

	currentPos.y += direction * wheelStep;

	sendPos({ x: currentPos.x, y: currentPos.y });
}, { passive: false });

/* Device-Motion: "Shake-Boost"
=======================================
   Eine ruckartige Bewegung des Handys gibt dem Ball einen Schub. Wir messen
   die Änderung der Beschleunigung zwischen zwei Messungen (Delta), damit die
   Erkennung unabhängig von der Schwerkraft und vom Gerät funktioniert. */

// Schwelle für die Bewegungsstärke (Delta in m/s^2). Höher = es muss kräftiger
// geschüttelt werden. Cooldown verhindert, dass eine Bewegung mehrfach zählt.
// Die Schwelle wird über den Shake-Regler (Stufe 1..10, 5 = neutral) gesetzt:
// Stufe 10 = sehr empfindlich (kleine Schwelle), Stufe 1 = nur kräftiges Schütteln.
var kickThreshold   = 14;
var KICK_COOLDOWN   = 400; // ms
var lastKickTime    = 0;
var lastAcc         = null;

var shakeSensitivity = sensitivity + 1;

function applyShakeSensitivity() {
	var level = parseInt(shakeSensitivity.value, 10);
	if (isNaN(level)) level = 5;
	level = Math.min(10, Math.max(1, level));
	// Stufe 5 -> 14 (bisheriger Wert), Stufe 1 -> 22, Stufe 10 -> 4
	kickThreshold = 24 - level * 2;
}
applyShakeSensitivity();

function onMotion(ev) {
	if (connect.locked || !connect.accepted) return;

	var a = ev.accelerationIncludingGravity || ev.acceleration;
	if (!a) return;

	var ax = a.x || 0, ay = a.y || 0, az = a.z || 0;

	if (lastAcc) {
		var dx = ax - lastAcc.x;
		var dy = ay - lastAcc.y;
		var dz = az - lastAcc.z;
		var delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

		if (delta > kickThreshold) {
			var now = Date.now();
			if (now - lastKickTime >= KICK_COOLDOWN) {
				lastKickTime = now;
				sendKick(delta);
			}
		}
	}

	lastAcc = { x: ax, y: ay, z: az };
}

function sendKick(power) {
	if (connect.locked) return;

	var msg = JSON.stringify({
		type: 'kick',
		user: connect.user,
		clientId: connect.clientId,
		power: power
	});

	connect.socket.send(msg, connect.user);

	// lokales haptisches Feedback, sofern das Gerät es unterstützt
	if (navigator.vibrate) navigator.vibrate(30);
}

// iOS 13+ verlangt eine ausdrückliche Erlaubnis, die nur aus einer Nutzergeste
// heraus angefordert werden darf. Daher beim ersten Antippen aktivieren.
function enableMotion() {
	if (typeof DeviceMotionEvent !== 'undefined' &&
		typeof DeviceMotionEvent.requestPermission === 'function') {
		DeviceMotionEvent.requestPermission()
			.then(function (state) {
				if (state === 'granted') window.addEventListener('devicemotion', onMotion);
			})
			.catch(function () {});
	} else if (typeof DeviceMotionEvent !== 'undefined') {
		window.addEventListener('devicemotion', onMotion);
	}
}

// einmalig bei der ersten Berührung/Klick die Sensorerlaubnis einholen
window.addEventListener('touchend', enableMotion, { once: true });
window.addEventListener('click', enableMotion, { once: true });

// buttons: first controller to press starts / continues / restarts the game.
// after a press we hide both optimistically; the server's state broadcast
// re-renders them if needed.
var startBtn   = document.getElementById('startBtn');
var newGameBtn = document.getElementById('newGameBtn');

function sendAndHide(type) {
	// belegte Controller dürfen das Spiel nicht starten/fortsetzen
	if (connect.locked) return;

	var msg = JSON.stringify({
		type: type,
		user: connect.user,
		clientId: connect.clientId
	});

	connect.socket.send(msg, connect.user);

	startBtn.style.display   = 'none';
	newGameBtn.style.display = 'none';
}

// "Spiel starten" / "Spiel fortsetzen": Ball freigeben, Spielstand bleibt
startBtn.addEventListener('click', function() {
	sendAndHide('start');
});

// "Neues Spiel starten": Spielstand auf 0:0 zurücksetzen und neu beginnen
newGameBtn.addEventListener('click', function() {
	sendAndHide('newgame');
});

window.onresize = function(event) {
	myAreaSize.calc();
};

 document.body.addEventListener('touchmove',function(event){
  event.preventDefault();
});

StartAudioContext(Tone.context, '#client').then(function(){
	gamesound.triggerAttackRelease( tone[connect.user], 0.2);
})
