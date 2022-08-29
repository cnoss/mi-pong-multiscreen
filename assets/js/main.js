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
});

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


myInfo.textContent = connect.user;

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
	
	pos.x = Math.min(Math.max(pos.x, 0), 1);
	pos.y = Math.min(Math.max(pos.y, 0), 1);

	console.log('touchmove', pos);
	
/*
	if( pos.x < 0 ) pos.x = 0;
	if( pos.x > 1 ) pos.x = 1;
	
	if( pos.y < 0 ) pos.y = 0;
	if( pos.y > 1 ) pos.y = 1;
*/
	
	//myInfo.textContent = ev.type ;//+'\n('+pos.x+','+pos.y+')';
	
	var msg = JSON.stringify({
		type: 'move',
		user: connect.user,
		pos:  pos
	});
	
	connect.socket.send(msg, connect.user);
	// connect.socket.emit('message', msg);
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
