/**************************
 Config
 **************************/

var RenderConfig = {
  updateOnEachChange: false
, renderOnCanvas: false

, noiseOctaves: 8
, noiseFallof: 0.44
, noiseSeed: 100

, pathInterval: 2.5
, pathLength: 70
, pathDensity: 3

, onChange: function() {
    console.log(arguments)
  }
}

function onConfigChange() {
  if (RenderConfig.updateOnEachChange) {
    render()
  }
}

function onFinishChange() {
  render()
}

var gui = new dat.GUI()
gui.add(RenderConfig, 'updateOnEachChange')
gui.add(RenderConfig, 'renderOnCanvas').onFinishChange(onFinishChange)

// Noise
var f1 = gui.addFolder('Noise');
f1.add(RenderConfig, 'noiseOctaves').min(1).max(10).step(1).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseFallof').min(0).max(1).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseSeed').min(0).max(65000).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.open()

// Path
var f2 = gui.addFolder('Paths');
f2.add(RenderConfig, 'pathInterval').min(0.1).max(10).step(0.1).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.add(RenderConfig, 'pathLength').min(0).max(1000).step(10).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.add(RenderConfig, 'pathDensity').min(0.01).max(10).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.open()

/**************************
 Config
 **************************/

var processing = new Processing()
  , canvas = document.getElementById('paper-canvas')
  , pathToFollow = null
  , drawLayer = null
  , isRendering = false

paper.setup(canvas);

paper.project.importSVG('http://localhost/perlin-perimeter/images/fish.svg', function() {
  paper.view.draw();

  // Remove svg children
  var svgChildren = paper.project.layers[0].children[0].removeChildren()

  // Remove SVG empty group
  paper.project.layers[0].removeChildren()

  // Add only useful children
  paper.project.layers[0].addChildren(svgChildren)

  // Alias
  pathToFollow = paper.project.layers[0].children[0]

  // Create a draw layer
  drawLayer = new paper.Layer()

  render()
})

function render() {
  if (drawLayer == null) {return false;}
  if (isRendering) {return false;}
  // Lock
  isRendering = true

  // Set processing noise
  processing.noiseSeed(RenderConfig.noiseSeed)
  processing.noiseDetail(RenderConfig.noiseOctaves, RenderConfig.noiseFallof)

  // Clear draw layer
  drawLayer.removeChildren()


  var perlinPath, lastPoint, vectorX, vectorY, normalPath

  for (var offset = 0; offset < pathToFollow.length; offset += RenderConfig.pathInterval) {
    perlinPath = new paper.Path()
    perlinPath.strokeColor = 'black';
    lastPoint = pathToFollow.getPointAt(offset)

    if (RenderConfig.renderOnCanvas) {
      lastPoint.x = Math.floor(Math.random() * paper.view.size.width)
      lastPoint.y = Math.floor(Math.random() * paper.view.size.height)
    }

    // // Point
    // new paper.Path.Circle({
    //   center: pathToFollow.getPointAt(offset),
    //   radius: 3,
    //   fillColor: 'red'
    // });

    // normalPath = new paper.Path.Line(pathToFollow.getPointAt(offset), pathToFollow.getPointAt(offset).add(pathToFollow.getNormalAt(offset)));
    // normalPath.strokeColor = 'blue';

    for (var step = 0; step < RenderConfig.pathLength; step ++) {
      perlinPath.add(lastPoint)

      vectorX = Math.cos(processing.noise(lastPoint.x*.003,lastPoint.y*.003) * 2 * Math.PI) * RenderConfig.pathDensity;
      vectorY = -Math.sin(processing.noise(lastPoint.x*.003,lastPoint.y*.003) * 2.5 * Math.PI) * RenderConfig.pathDensity;
      lastPoint = lastPoint.add([vectorX, vectorY])
    }
  }

  // Unlock
  isRendering = false
  paper.view.update(true);
}
