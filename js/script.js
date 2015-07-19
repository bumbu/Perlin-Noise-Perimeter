/**************************
 Config
 **************************/

var RenderConfig = {
  updateOnEachChange: false
, renderOnCanvas: false

, noiseOctaves: 8
, noiseFalloff: 0.44
, noiseSeed: 100
, noiseDetalisation: 0.004

, pathInterval: 5
, pathLength: 70
, pathDensity: 1

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
f1.add(RenderConfig, 'noiseFalloff').min(0).max(1).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseSeed').min(0).max(65000).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseDetalisation').min(0).max(0.2).step(0.001).onChange(onConfigChange).onFinishChange(onFinishChange)
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
  , directionLayer = null

paper.setup(canvas);

paper.project.importSVG('images/fish.svg', function() {
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

  initDirectionLayer()
  render()
})

function initDirectionLayer() {
  // Create direction layer
  directionLayer = new paper.Layer()
  // Init tool
  new paper.Tool()

  var lastPath = null

  paper.tool.onMouseDown = function(ev) {
    directionLayer.activate()

    var from = pathToFollow.getNearestPoint(ev.point)
    lastPath = paper.Path.Line(from, from)
    lastPath.strokeColor = 'red'
  }

  paper.tool.onMouseMove = function(ev) {
    if (lastPath != null) {
      lastPath.lastSegment.point = ev.point
    }
  }

  paper.tool.onMouseUp = function(ev) {
    if (lastPath != null) {
      lastPath.lastSegment.point = ev.point
      lastPath = null
      render()
    }
  }

}

function render() {
  if (drawLayer == null) {return false;}
  if (isRendering) {return false;}
  // Lock
  isRendering = true
  drawLayer.activate()

  // Set processing noise
  processing.noiseSeed(RenderConfig.noiseSeed)
  processing.noiseDetail(RenderConfig.noiseOctaves, RenderConfig.noiseFalloff)

  // Clear draw layer
  drawLayer.removeChildren()

  // Directional Vectors
  directions = getSortedDirections()
  maxDirection = getMaxDirection(directions)

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

    var startPoint = pathToFollow.getPointAt(offset)
      , direction = getDirectionAtOffset(offset, directions)
      , directionRelative = directionRelativeToMax(direction, maxDirection)
      // , directionPath = paper.Path.Line(startPoint, startPoint.add(direction))
    // directionPath.strokeColor = 'green'
    console.log(directionRelative)


    for (var step = 0; step < RenderConfig.pathLength; step ++) {
      perlinPath.add(lastPoint)

      vectorX = Math.cos(processing.noise(lastPoint.x*RenderConfig.noiseDetalisation,lastPoint.y*RenderConfig.noiseDetalisation) * 2 * Math.PI) * RenderConfig.pathDensity;
      vectorY = -Math.sin(processing.noise(lastPoint.x*RenderConfig.noiseDetalisation,lastPoint.y*RenderConfig.noiseDetalisation) * 2 * Math.PI) * RenderConfig.pathDensity;
      // lastPoint = lastPoint.add([vectorX, vectorY])
      lastPoint = lastPoint.add([directionRelative[0] + vectorX * 0.3, directionRelative[1] + vectorY * 0.3])
    }

    // Simplify path
    perlinPath.simplify()
  }

  // Unlock
  isRendering = false
  paper.view.update(true);
}

function getSortedDirections() {
  var sortedDirections = directionLayer.children.slice()
  .map(function(path) {
    // Cache path offset from path to follow
    path.offset = pathToFollow.getOffsetOf(path.firstSegment.point)
    return path
  })
  .sort(function(path1, path2){
    return path1.offset - path2.offset
  })

  return sortedDirections
}

function getMaxDirection(directions) {
  var maxX = 0
    , maxY = 0

  directions.forEach(function(path) {
    maxX = Math.max(maxX, Math.abs(path.firstSegment.point.x - path.lastSegment.point.x))
    maxY = Math.max(maxY, Math.abs(path.firstSegment.point.y - path.lastSegment.point.y))
  })

  return [maxX, maxY]
}

paper.Path.prototype.getVector = function() {
  return [(this.lastSegment.point.x - this.firstSegment.point.x), (this.lastSegment.point.y - this.firstSegment.point.y)]
}

function getDirectionAtOffset(offset, directions) {
  var fromDirection = null
    , toDirection = null
    , relativePosition = 0

  if (!directions || directions.length == 0) {
    return [0, 0]
  } else if (directions.length == 1) {
    return directions[0].getVector()
  } else {
    for (var i = 0; i < directions.length; i++) {
      if (directions[i].offset > offset) {
        toDirection = directions[i]

        if (i > 0) {
          fromDirection = directions[i - 1]
        } else {
          fromDirection = directions[directions.length - 1]
        }
        break;
      }
    }

    if (toDirection == null) {
      fromDirection = directions[directions.length - 1]
      toDirection = directions[0]
    }
  }

  if (toDirection.offset > fromDirection.offset) {
    relativePosition = (offset - fromDirection.offset) / (toDirection.offset - fromDirection.offset)
  } else {
    var directionsDistance = pathToFollow.length - fromDirection.offset + toDirection.offset

    if (offset >= fromDirection.offset) {
      relativePosition = (offset - fromDirection.offset) / directionsDistance
    } else {
      relativePosition = (offset - fromDirection.offset + pathToFollow.length) / directionsDistance
    }
  }

  var directionX = fromDirection.getVector()[0] * (1 - relativePosition) + toDirection.getVector()[0] * relativePosition
    , directionY = fromDirection.getVector()[1] * (1 - relativePosition) + toDirection.getVector()[1] * relativePosition

  return [directionX, directionY]
}

function directionRelativeToMax(direction, maxDirection) {
  return [direction[0] / maxDirection[0] || 0, direction[1] / maxDirection[1] || 0]
}
