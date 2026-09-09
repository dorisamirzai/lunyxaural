let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(RADIANS);
}

function draw() {

  // subtle motion blur instead of full clear
  background(0, 0, 0, 25);

  translate(width / 2, height / 2);

  blendMode(BLEND);
  noFill();

  let breathe = map(sin(t), -1, 1, -15, 30);

  let layers = 110;

  for (let layer = 0; layer < layers; layer++) {

    let depth = layer / layers;

    // 🌈 perfectly continuous gradient
    let hue = map(depth, 0, 1, 10, 80);

    let sat = map(depth, 0, 1, 100, 60);
    let bright = map(depth, 0, 1, 85, 50);  // capped → never reaches white

    stroke(hue, sat, bright, 15);

    let baseR = map(layer, 0, layers, 40, 300);

    beginShape();

    for (let a = 0; a < TWO_PI; a += 0.02) {

      // large coral lobes
      let lobe = map(
        noise(cos(a) + 2, sin(a) + 2),
        0, 1,
        0.75, 1.25
      );

      // fine surface detail
      let surface = noise(
        cos(a) * 0.9 + layer * 0.04,
        sin(a) * 0.9 + layer * 0.04,
        t * 0.35
      );

      let r = baseR * lobe + surface * 65 + breathe;

      let x = cos(a) * r;
      let y = sin(a) * r;

      vertex(x, y);
    }

    endShape(CLOSE);
  }

  t += 0.01;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}