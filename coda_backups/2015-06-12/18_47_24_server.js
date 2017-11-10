var connect = {}

connect.id      = (location.search)?location.search.replace('?', ''):(Math.random()*0xFFFFFF<<0).toString(16);
connect.port 	= 48566;
//connect.uri 	= 'http://' + location.hostname.replace('http://', '');
connect.uri		= 'http://perasmus.serpens.uberspace.de'; //'http://localhost';
connect.host    = 'http://' + location.hostname.replace('http://', '');
connect.path	= ''; //location.pathname;
connect.socket	= io.connect(connect.uri+':'+connect.port);
connect.user 	= 'host';

connect.socket.on('member', function(data) { 
	console.log(data); 
	
	qrcoder.hideOne(data);
	
});
connect.socket.emit('connectTo', connect.id, connect.user);



connect.socket.on('message',function(data){
	var data = JSON.parse(data);
	
	if( data.type = 'move' ){
		//if( !game.isPlaying() ) game.start();
		
		mouse[data.user].x = data.pos.x * canvas.w;
		mouse[data.user].y = data.pos.y * canvas.h;
	} 
	
});

// Margin around the game area
var margin = { top: 0, left: 0, bottom: 180, right: 0 };
var color = { playerOne: '#dd1166', playerTwo: '#77cc00' };


// RequestAnimFrame: a browser API for getting smooth animations
window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame   || 
		window.webkitRequestAnimationFrame || 
		window.mozRequestAnimationFrame    || 
		window.oRequestAnimationFrame      || 
		window.msRequestAnimationFrame     ||  
		function( callback ){
			return window.setTimeout(callback, 1000 / 60);
		};
})();



// Initialize canvas and required variables
var	mouse = {
	playerOne: {},
	playerTwo: {}
}; // Mouse object to store it's current position
	


/* The canvas
=======================================*/	
var canvas = new function(){
	var self = this;
	var el   = document.getElementById("canvas");
	var ctx  = self.ctx = el.getContext("2d");
	
	self.draw = function(){		
		ctx.clearRect(0, 0, self.w, self.h);
		
		var dashLen = 20,
			lineWidth = 7;
		
		ctx.fillStyle = "#ffffff";
		
		for(var i=0; i < canvas.h / dashLen; i+=2) {
			ctx.fillRect(   canvas.w/2 - lineWidth/2 + 12,  // x
							(i * dashLen),					// y
							lineWidth,						// width
							dashLen);						// height
		}
		
		ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
		ctx.fillRect(0, canvas.h - 1, canvas.w, 1)
	}
	
	self.resize = function(){
		el.width  = self.w = window.innerWidth - margin.left - margin.right;
		el.height = self.h = window.innerHeight - margin.top - margin.bottom;
	}
	
	self.resize();
	
	window.addEventListener('resize', self.resize );
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
		var url_p1 = connect.host+'?'+connect.id+'__playerOne';
		makeShort(url_p1, "playerOne");
		var url_p2 = connect.host+'?'+connect.id+'__playerTwo';
		makeShort(url_p3, "playerTwo");
		qrcode(p.playerOne, url_p1);
		qrcode(p.playerTwo, url_p2);
	
		
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
		if ( !p[name] ) return;
		if ( p[name].classList.contains('hidden') ) return;
		
		p[name].classList.add('hidden');
		l++;
		
		self.check();
	}
	
	self.check = function () {
		if (l === 2) game.start();
	}
	
	
	// qr.qrcode(connect.uri+connect.path+'?'+connect.id);
	// game.start()
	
	
	
	
}

/* Short URLs
=======================================*/

function makeShort( longUrl ){

    var request = gapi.client.urlshortener.url.insert({
      'resource': {
      'longUrl': longUrl
    }
    });
    request.execute(function(response) 
    {
 
        if(response.id != null){
            return response.id;
        }else{
            alert("error: creating short url n"+ response.error);
        }
 
    });
 }

   

/* The Particle
=======================================*/	
var particle = new function(){
	var self  = this;
	var ctx   = canvas.ctx;
	var count = 20;
	var list  = [];
	
	self.create = function(par){
		for( var i = 0; i < count; i++ ){
			list.push({
				x:  par.x,
				y:  par.y,
				r:  1.2,
				//r: 4,
				vx: par.m * Math.random()*1.5,
				vy: -1.5 + Math.random()*3
			});
		}
	};
	
	self.draw = function(){
		var newList = [];
		
		for( var i = 0, l = list.length; i < l; i++) {
			var par = list[i];
					
			ctx.beginPath(); 
			ctx.fillStyle = "#ffffff";
			//ctx.arc(par.x, par.y, par.r, 0, Math.PI*2, false);
			ctx.rect(par.x - par.r, par.y - par.r, 2*par.r, 2*par.r);
			ctx.fill();	 
			
			par.x += par.vx; 
			par.y += par.vy; 
			par.r  = Math.max(par.r - Math.random() * 0.1, 0); 
			
			if(par.r) newList.push(par);
		}
		
		list = newList;
	};
};	

/* The Ball
=======================================*/	
var ball = new function(){
	var self = this;
	var ctx  = canvas.ctx;
	var startOnLeftSide = true;
	
	self.init = function(){
		self.x  = (startOnLeftSide) ? 100: canvas.w - 100;
		self.y  = (canvas.h - 140) * Math.random() + 70;
		self.r  = 10;
		self.vx = 4;
		self.vy = 4 * (startOnLeftSide) ? 1: -1;
		
		if(!startOnLeftSide) {
			self.switchX();
			if(Math.random() < 0.5) self.switchY();
		}
		
		startOnLeftSide = !startOnLeftSide;
	};
	
	self.draw = function(){
		ctx.beginPath();
		ctx.fillStyle = "#ffffff";
		ctx.rect(self.x - self.r, self.y - self.r, self.r * 2, self.r * 2);
		ctx.fill();
	};
	
	self.move = function(){
		self.x += self.vx;
		self.y += self.vy;
	};
	
	self.speedUp = function() {
		if(Math.abs(self.vx) < 15) {
			self.vx += (self.vx < 0) ? -0.25 : 0.25;
			self.vy += (self.vy < 0) ? -0.25 : 0.25;
		}
	};
	
	self.switchX = function(){
		self.vx = -self.vx;
	};
	
	self.switchY = function(){
		self.vy = -self.vy;
	};
		
	self.checkCollision = function(){
		checkCollisionPaddle() || checkCollisionWall() || checkCollisionOut();
	};
	
	var checkCollisionWall = function(){
		if(self.y < self.r || self.y > (canvas.h - self.r)){
			self.switchY();
			self.y = (self.y < self.r) ? self.r:(canvas.h - self.r);
			
			return true;
		}
	}
	
	var checkCollisionOut = function(){
		if (self.x < self.r || self.x > canvas.w - self.r){
			var padWinnerIndex = self.x < self.r ? 1: 0;
			var padWinner = pad.list[padWinnerIndex];
			
			if(!game.isPlaying())
				return;
			
			padWinner.wins++;
			
			game.stop();
			
			canvas.draw();
			scoreTable.draw();
			pad.draw();
			ball.draw();
			
			if(padWinner.wins === 3) {
				gameOverer.start(padWinner, padWinnerIndex);
				pad.list[0].wins = 0;
				pad.list[1].wins = 0;
			}
			else {
				countdown.start();
			}
			
			return true;
		}
	}
	
	var checkCollisionPaddle = function(){
		// Collision with paddles
 		for(var i = 0, l=pad.list.length; i < l; i++){
			var p = pad.list[i];
			var overlap = 
				self.y + self.r >= p.y	   && 
				self.y - self.r <= p.y + p.h &&
				self.x + self.r >= p.x	   && 
				self.x - self.r <= p.x + p.w;
			
			if(overlap){
				self.switchX();
				self.speedUp();

				particle.create({
					x: self.x - self.vx/Math.abs(self.vx) * self.r,
					y: self.y,
					m: self.vx/Math.abs(self.vx)
				});
				
				return true;
			}
		}
	};
	
	self.init();
};


/* The Paddles
=======================================*/
var pad = new function(){
	var self = this;
	var ctx  = canvas.ctx;
	var leftRightPadding = 25;
	
	self.init = function(){
		self.list = [
			create("Left Paddle"),
			create("Right Paddle")
		]
	};
	
	self.draw = function (){
		for(var i=0, l=self.list.length; i<l; i++) {
			var p = self.list[i];
			
			p.x = (i === 0) ? leftRightPadding : canvas.w - p.w - leftRightPadding;
			p.y = p.y || (canvas.h/2 - p.h/2);
			
			var fillColor = (i === 0) ? color.playerOne: color.playerTwo;
			
			ctx.fillStyle = fillColor;
			ctx.fillRect(p.x, p.y, p.w, p.h);
		}
	};
	
	self.move = function (id,x,y){
		if( self.list !== undefined  ){
			var p = self.list[id];
			p.y = y - p.h/2;
			
			if(p.y < 1) p.y = 1;
			if(p.y > (canvas.h - p.h)) p.y = (canvas.h - p.h);
		}
	};
	
	var create = function(name){
		return {
			w: 25,
			h: 150,
			name: name,
			wins: 0
		}
	}
	
	self.init();
};


/* The Scoretable
=======================================*/
var scoreTable = new function() {
	var self = this;
	
	self.draw = function() {
		var ctx = canvas.ctx;
		
		for(var i=0; i<pad.list.length; i++) {
			var playerPad = pad.list[i];
			
			var winsText = "" + playerPad.wins;
			var fillColor = (i === 0) ? color.playerOne: color.playerTwo;
			var xPos = ((i % 2) ? -100: 100);
			
			ctx.font = "100px FFFForward, sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "hanging";
			ctx.fillStyle = fillColor;
			ctx.fillText(winsText, canvas.w/ 2 - xPos  + 17, 70);
		}
	};
};


/* The countdown
=======================================*/
var countdown = new function() {
	var self = this;
	var ctx = canvas.ctx;
	
	self.start = function() {
		var countdown = 4;
		
		self.draw(countdown--);
		
		var intervalHandler = window.setInterval(function() {
			canvas.draw(false);
			scoreTable.draw();
			pad.draw();
			ball.draw();
			
			self.draw(countdown);
			
			if(countdown === 0) {
				window.clearInterval(intervalHandler);
				
				window.setTimeout(function() {
					game.nextRound();
				}, 750);
			}
			
			countdown--;
		}, 1000);
	}
	
	self.draw = function(currCountdown) {
		
		if(currCountdown === 0)
			currCountdown = "GO!";
		
		ctx.clearRect(canvas.w/2 - 50, canvas.h/2 - 130, 100, 230);
		
		ctx.font = "120px FFFForward, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#ffffff";
		ctx.fillText(currCountdown, canvas.w/2 + 12, canvas.h/2 + 25);
	}
};


/* The Game
=======================================*/
var game = new function(){
	var self	= this;
	var playing = false;
	
	self.draw = function(){
		// draw cylce
		canvas.draw();
		scoreTable.draw();
		pad.draw();
		ball.draw();
		particle.draw();
		
		// update cycle
		pad.move(0, mouse.playerOne.x, mouse.playerOne.y);
		pad.move(1, mouse.playerTwo.x, mouse.playerTwo.y);
		ball.move();
		
		// check status
		ball.checkCollision();
	}
	
	self.loop = function(){
		if( playing ) {
			self.draw();
			requestAnimFrame(self.loop);
		}
	}
	
	self.init = function(){
		ball.init();
		if(game.isPlaying())
			pad.init();
		
		canvas.draw();
		scoreTable.draw();
		pad.draw();
		//ball.draw();
		particle.draw();
	}
	
	self.start = function(){
		self.init();
		playing = true;
		self.loop();
	}
	
	self.nextRound = function(){
		playing = false;
		self.start();
	}
	
	self.stop = function(){
		playing = false;
	}
	
	self.isPlaying = function(){
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
	x: canvas.w/2 - 50,
	y: canvas.h/2 - 25,
	
	draw: function() {
		return;
		var ctx = canvas.ctx;
		
		ctx.clearRect(this.x - 15, this.y - 25, this.w + 30, this.h + 55);
		
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = "2";
		ctx.strokeRect(this.x, this.y, this.w, this.h);
		
		ctx.font = "20px FFFForward, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#ffffff";
		ctx.fillText("Start", canvas.w/2 + 12, canvas.h/2 + 5);
	}
};

// Restart Button object
var restartBtn = {
	w: 120,
	h: 50,
	x: canvas.w/2 - 50,
	y: canvas.h/2 + 100,
	
	draw: function() {
		return;
		
		var ctx = canvas.ctx;
		
		restartBtn.x = canvas.w/2 - 50;
		restartBtn.y = canvas.h/2 + 100;
		
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = "2";
		ctx.strokeRect(this.x, this.y, this.w, this.h);
		
		ctx.font = "20px FFFForward, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#ffffff";
		ctx.fillText("Restart", canvas.w/2 + 12, canvas.h/2 + 130);
	}
};




/* The countdown
=======================================*/
var gameOverer = new function() {
	var self = this;
	var ctx = canvas.ctx;
	
	var msg = {};
	
	self.start = function(padWinner, playerIndex) {
		var countdown = 4;
		msg.padWinner = padWinner;
		msg.playerIndex = playerIndex;
		
		self.draw(countdown--);
		
		var intervalHandler = window.setInterval(function() {
			canvas.draw(false);
			scoreTable.draw();
			pad.draw();
			ball.draw();
			
			self.draw(countdown);
			
			if(countdown === 0) {
				window.clearInterval(intervalHandler);
				
				window.setTimeout(function() {
					location.href = location.href;
				}, 750);
			}
			
			countdown--;
		}, 1000);
	}
	
	self.draw = function(currCountdown) {
		
		if(currCountdown === 0)
			currCountdown = "NOW!";
		
		
		ctx.clearRect(canvas.w/2 - 20, canvas.h / 2 - 70, 60, 230);
	
		var fillColor = (msg.playerIndex === 0) ? color.playerOne: color.playerTwo;
		
		ctx.fillStyle = "#ffffff";
		ctx.font = "40px FFFForward, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("Game Over!", canvas.w/2, canvas.h/2 - 20);
		
		ctx.fillStyle = fillColor;
		ctx.font = "30px FFFForward, sans-serif";
		ctx.fillText(msg.padWinner.name + " won!", canvas.w/2, canvas.h/2 + 60 );
		
		
		ctx.fillStyle = "#ffffff";
		ctx.font = "30px FFFForward, sans-serif";
		ctx.fillText("next Game in "+ currCountdown, canvas.w/2, canvas.h/2 + 140 );
		
		
		
		
	}
};




// Function to run when the game overs
function gameOver(padWinner, playerIndex) {
	var ctx = canvas.ctx;
	
	ctx.clearRect(canvas.w/2 - 20, canvas.h / 2 - 70, 60, 230);
	
	var fillColor = (playerIndex === 0) ? color.playerOne: color.playerTwo;
	
	ctx.fillStyle = "#ffffff";
	ctx.font = "40px FFFForward, sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("Game Over", canvas.w/2, canvas.h/2 - 20);
	
	ctx.fillStyle = fillColor;
	ctx.font = "30px FFFForward, sans-serif";
	ctx.fillText(padWinner.name + " won!", canvas.w/2, canvas.h/2 + 60 );
	
	
	// Show the restart button
	restartBtn.draw();
}

// Function for running the whole animation


// Function to execute at startup
function startScreen() {
	qrcoder.create();
	game.init();
	startBtn.draw();
}

// On button click (Restart and start)
function btnClick(e) {
	// Variables for storing mouse position on click
	var mx = e.pageX,
		my = e.pageY;
	
	// Click start button
	if(startBtn
		&& mx >= startBtn.x && mx <= startBtn.x + startBtn.w
		&& my >= startBtn.y && my <= startBtn.y + startBtn.h) {
		game.start();
		startBtn = undefined; // Delete the start button after clicking it
	}
	
	// If the game is over, and the restart button is clicked
	if(!startBtn && !game.isPlaying()
		&& mx >= restartBtn.x && mx <= restartBtn.x + restartBtn.w
		&& my >= restartBtn.y && my <= restartBtn.y + restartBtn.h) {
		game.start();
	}
}

// Show the start screen
window.addEventListener("load", function() {
	
	gapi.client.setApiKey('AIzaSyBlDRF4q7uqZ-EazSB8QuitbYpof4h1B8E');
	gapi.client.load('urlshortener', 'v1').then(startScreen);

});
