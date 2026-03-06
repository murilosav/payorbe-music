export function renderHomePage(): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Patacos</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	<style>
	* { margin:0; padding:0; box-sizing:border-box; }
	body {
		font-family: 'Inter', -apple-system, sans-serif;
		background: #0a0a0a;
		color: #fff;
		overflow: hidden;
		height: 100vh;
		-webkit-font-smoothing: antialiased;
	}
	canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}
	.content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 20px;
	}
	.logo {
		font-size: 48px;
		font-weight: 700;
		letter-spacing: -2px;
		margin-bottom: 12px;
		background: linear-gradient(135deg, #fff 0%, #888 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
	.subtitle {
		font-size: 16px;
		color: rgba(255,255,255,0.4);
		font-weight: 300;
		margin-bottom: 40px;
		max-width: 400px;
		line-height: 1.6;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 32px;
		background: rgba(255,255,255,0.08);
		border: 1px solid rgba(255,255,255,0.12);
		border-radius: 12px;
		color: rgba(255,255,255,0.7);
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		font-family: inherit;
		transition: all 0.3s;
		cursor: default;
		backdrop-filter: blur(8px);
	}
	.cta:hover {
		background: rgba(255,255,255,0.12);
		border-color: rgba(255,255,255,0.2);
		color: #fff;
	}
	.note-icon {
		font-size: 18px;
		opacity: 0.6;
	}
	@media (max-width: 480px) {
		.logo { font-size: 36px; }
		.subtitle { font-size: 14px; }
	}
	</style>
</head>
<body>
	<canvas id="c"></canvas>
	<div class="content">
		<div class="logo">Patacos</div>
		<div class="subtitle">
			Adquira nossos produtos para ter acesso exclusivo ao download das suas m\u00fasicas.
		</div>
		<div class="cta">
			<span class="note-icon">\u266B</span>
			Conte\u00fado exclusivo para clientes
		</div>
	</div>

	<script>
	var canvas = document.getElementById('c');
	var ctx = canvas.getContext('2d');
	var W, H;
	var particles = [];
	var notes = ['\u266A', '\u266B', '\u266C', '\u2669'];
	var mouse = { x: -1000, y: -1000 };

	function resize() {
		W = canvas.width = window.innerWidth;
		H = canvas.height = window.innerHeight;
	}
	resize();
	window.addEventListener('resize', resize);
	document.addEventListener('mousemove', function(e) { mouse.x = e.clientX; mouse.y = e.clientY; });

	function Particle(x, y, isNote) {
		this.x = x || Math.random() * W;
		this.y = y || Math.random() * H;
		this.isNote = isNote || Math.random() < 0.15;
		this.note = notes[Math.floor(Math.random() * notes.length)];
		this.size = this.isNote ? (12 + Math.random() * 14) : (1 + Math.random() * 2);
		this.speedX = (Math.random() - 0.5) * 0.3;
		this.speedY = -0.2 - Math.random() * 0.5;
		this.opacity = 0.1 + Math.random() * 0.3;
		this.maxOpacity = this.opacity;
		this.rotation = Math.random() * Math.PI * 2;
		this.rotSpeed = (Math.random() - 0.5) * 0.01;
		this.wobble = Math.random() * Math.PI * 2;
		this.wobbleSpeed = 0.01 + Math.random() * 0.02;
		this.wobbleAmp = 0.3 + Math.random() * 0.5;
		this.life = 1;
		this.fadeSpeed = 0.0005 + Math.random() * 0.001;
	}

	// Init particles
	var COUNT = Math.min(120, Math.floor(W * H / 8000));
	for (var i = 0; i < COUNT; i++) particles.push(new Particle());

	// Spawn new ones periodically
	var spawnTimer = 0;

	function draw() {
		ctx.clearRect(0, 0, W, H);

		// Draw connecting lines between nearby particles
		for (var i = 0; i < particles.length; i++) {
			for (var j = i + 1; j < particles.length; j++) {
				var dx = particles[i].x - particles[j].x;
				var dy = particles[i].y - particles[j].y;
				var dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 120) {
					var alpha = (1 - dist / 120) * 0.06 * Math.min(particles[i].life, particles[j].life);
					ctx.beginPath();
					ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
					ctx.lineWidth = 0.5;
					ctx.moveTo(particles[i].x, particles[i].y);
					ctx.lineTo(particles[j].x, particles[j].y);
					ctx.stroke();
				}
			}
		}

		for (var i = particles.length - 1; i >= 0; i--) {
			var p = particles[i];

			// Wobble
			p.wobble += p.wobbleSpeed;
			p.x += p.speedX + Math.sin(p.wobble) * p.wobbleAmp;
			p.y += p.speedY;
			p.rotation += p.rotSpeed;

			// Mouse repulsion
			var mdx = p.x - mouse.x;
			var mdy = p.y - mouse.y;
			var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
			if (mdist < 150) {
				var force = (1 - mdist / 150) * 2;
				p.x += (mdx / mdist) * force;
				p.y += (mdy / mdist) * force;
			}

			// Fade
			p.life -= p.fadeSpeed;

			// Remove dead or out-of-bounds
			if (p.life <= 0 || p.y < -50 || p.x < -50 || p.x > W + 50) {
				particles.splice(i, 1);
				continue;
			}

			var alpha = p.maxOpacity * p.life;

			if (p.isNote) {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation);
				ctx.font = p.size + 'px Inter, sans-serif';
				ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(p.note, 0, 0);
				ctx.restore();
			} else {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
				ctx.fill();
			}
		}

		// Spawn new particles from bottom
		spawnTimer++;
		if (spawnTimer % 3 === 0 && particles.length < COUNT * 1.5) {
			var np = new Particle(Math.random() * W, H + 20, false);
			np.speedY = -0.3 - Math.random() * 0.6;
			particles.push(np);
		}
		if (spawnTimer % 12 === 0 && particles.length < COUNT * 1.5) {
			var np = new Particle(Math.random() * W, H + 20, true);
			np.speedY = -0.4 - Math.random() * 0.4;
			particles.push(np);
		}

		requestAnimationFrame(draw);
	}
	draw();
	</script>
</body>
</html>`;
}
