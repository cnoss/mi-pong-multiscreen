var color = { 'playerOne': '#dd1166', 'playerTwo': '#00AD2F' };
var tone = { 'playerOne': 'C4', 'playerTwo': 'G4' };
var connect = {}

connect.id		= (location.search.replace('?', '').split('__'))[0];
connect.user	= (location.search.replace('?', '').split('__'))[1];//'user' + (Math.random()*0xFFFFFF<<0).toString(16);

connect.uri		= 'https://perasmus.uber.space'; //'http://localhost';
connect.socket	= io.connect(connect.uri);
connect.socket.on('member', function(data) { 
	console.log(data); 
	
});

connect.socket.on('message', function(data) {
	var data = JSON.parse(data);
	if (data.type === 'notify' && data.user === connect.user) {
		gamesound.triggerAttackRelease( "G5", 0.1);
	}
	if (data.type === 'state') {
		renderButtons(data);
	}
});

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
	pos.x = Math.min(Math.max(pos.x, 0), 1);
	pos.y = Math.min(Math.max(pos.y, 0), 1);

	currentPos.x = pos.x;
	currentPos.y = pos.y;

	var msg = JSON.stringify({
		type: 'move',
		user: connect.user,
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

// buttons: first controller to press starts / continues / restarts the game.
// after a press we hide both optimistically; the server's state broadcast
// re-renders them if needed.
var startBtn   = document.getElementById('startBtn');
var newGameBtn = document.getElementById('newGameBtn');

function sendAndHide(type) {
	var msg = JSON.stringify({
		type: type,
		user: connect.user
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
