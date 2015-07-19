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
, noiseEffect: 0.3

, pathInterval: 5
, pathLength: 70
, pathPointDistance: 1

, addFile: function() {
    $('#file-input').click()
  }
, export: function() {
    exportSVG()
  }
, name: 'demo.svg'
}

function onConfigChange() {
  if (RenderConfig.updateOnEachChange) {
    render()
  }
}

function onFinishChange() {
  render()
}


$('#file-input').on('change', function(ev) {
  var reader = new FileReader()
  reader.onloadend = function(ev) {
    paper.project.clear()
    paper.project.importSVG(ev.target.result)
    onImportDone()
  }

  reader.readAsText(this.files.item(0))
})

var gui = new dat.GUI()
gui.add(RenderConfig, 'updateOnEachChange')
gui.add(RenderConfig, 'renderOnCanvas').onFinishChange(onFinishChange)

// Noise
var f1 = gui.addFolder('Noise');
f1.add(RenderConfig, 'noiseOctaves').min(1).max(10).step(1).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseFalloff').min(0).max(1).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseSeed').min(0).max(65000).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseDetalisation').min(0).max(0.2).step(0.001).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseEffect').min(0).max(1).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.open()

// Path
var f2 = gui.addFolder('Paths');
f2.add(RenderConfig, 'pathInterval').min(0.1).max(10).step(0.1).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.add(RenderConfig, 'pathLength').min(0).max(1000).step(10).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.add(RenderConfig, 'pathPointDistance').min(0.01).max(10).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.open()

// Import/Export
var f3 = gui.addFolder('Import/Export');
f3.add(RenderConfig, 'addFile')
f3.add(RenderConfig, 'name')
f3.add(RenderConfig, 'export')

/**************************
 Config
 **************************/

var processing = new Processing()
  , canvas = document.getElementById('paper-canvas')
  , pathsToFollow = []
  , drawLayer = null
  , isRendering = false
  , directionLayer = null

paper.setup(canvas);

paper.project.importSVG('images/multiple.svg', function() {
  paper.view.draw();
  onImportDone()
})

var $alert = document.getElementById('alert')
function onProcessingStart() {
  $alert.style.display = null
}

function onProcessingDone() {
  $alert.style.display = 'none'
}

function onImportDone() {
  // Remove svg children
  var svgChildren = paper.project.layers[0].children[0].removeChildren()
  // Transform shapes into paths
  .map(function(child) {
    if (child instanceof paper.Shape) {
      return child.toPath(false)
    } else {
      return child
    }
  })
  // Remove paths with less than 2 segments
  .filter(function(path) {
    return path.segments.length >= 2
  })

  // Remove SVG empty group
  paper.project.layers[0].removeChildren()

  // Add only useful children
  paper.project.layers[0].addChildren(svgChildren)

  // Alias
  pathsToFollow = paper.project.layers[0].children.slice()

  // Create a draw layer
  drawLayer = new paper.Layer()

  initDirectionLayer()
  render()
}

function initDirectionLayer() {
  // Create direction layer
  directionLayer = new paper.Layer()
  // Init tool
  new paper.Tool()

  var lastPath = null

  paper.tool.onMouseDown = function(ev) {
    directionLayer.activate()

    var minDistance = Infinity
      , from = null

    pathsToFollow.forEach(function(path) {
      if (ev.point.getDistance(path.getNearestPoint(ev.point)) < minDistance) {
        from = path.getNearestPoint(ev.point)
        minDistance = ev.point.getDistance(from)
      }
    })

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

/**************************
 Rendering
 **************************/

function render() {
  if (drawLayer == null) {return false;}
  if (isRendering) {return false;}
  // Lock
  isRendering = true
  onProcessingStart()
  drawLayer.activate()

  // Set processing noise
  processing.noiseSeed(RenderConfig.noiseSeed)
  processing.noiseDetail(RenderConfig.noiseOctaves, RenderConfig.noiseFalloff)

  // Clear draw layer
  drawLayer.removeChildren()

  // Deffer rendering to have time for preparations
  setTimeout(function(){
    pathsToFollow.forEach(function(pathToFollow) {
      // Directional Vectors
      var directions = getSortedDirections(pathToFollow)
        , maxDirection = getMaxDirection(directions)
      // Other variables
        , perlinPath
        , lastPoint
        , vectorX
        , vectorY
        , normalPath

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
          , direction = getDirectionAtOffset(offset, directions, pathToFollow.length)
          , directionRelative = directionRelativeToMax(direction, maxDirection)
        //   , directionPath = paper.Path.Line(startPoint, startPoint.add(direction))
        // directionPath.strokeColor = 'green'

        for (var step = 0; step < RenderConfig.pathLength; step ++) {
          perlinPath.add(lastPoint)

          vectorX = Math.cos(processing.noise(lastPoint.x*RenderConfig.noiseDetalisation,lastPoint.y*RenderConfig.noiseDetalisation) * 2 * Math.PI) * RenderConfig.pathPointDistance;
          vectorY = -Math.sin(processing.noise(lastPoint.x*RenderConfig.noiseDetalisation,lastPoint.y*RenderConfig.noiseDetalisation) * 2 * Math.PI) * RenderConfig.pathPointDistance;
          // lastPoint = lastPoint.add([vectorX, vectorY])
          lastPoint = lastPoint.add([directionRelative[0] * (1 - RenderConfig.noiseEffect) + vectorX * RenderConfig.noiseEffect, directionRelative[1] * (1 - RenderConfig.noiseEffect) + vectorY * RenderConfig.noiseEffect])
        }

        // Simplify path
        perlinPath.simplify()
      }
    })


    // Unlock
    isRendering = false
    onProcessingDone()
    paper.view.update()
  // End set timeout
  }, 30)
}

/**************************
 Directions utils
 **************************/

function getSortedDirections(pathToFollow) {
  var sortedDirections = directionLayer.children.slice()
  .filter(function(path) {
    return pathToFollow.hitTest(path.firstSegment.point) != null
  })
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

function getDirectionAtOffset(offset, directions, pathLength) {
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
    var directionsDistance = pathLength - fromDirection.offset + toDirection.offset

    if (offset >= fromDirection.offset) {
      relativePosition = (offset - fromDirection.offset) / directionsDistance
    } else {
      relativePosition = (offset - fromDirection.offset + pathLength) / directionsDistance
    }
  }

  var directionX = fromDirection.getVector()[0] * (1 - relativePosition) + toDirection.getVector()[0] * relativePosition
    , directionY = fromDirection.getVector()[1] * (1 - relativePosition) + toDirection.getVector()[1] * relativePosition

  return [directionX, directionY]
}

function directionRelativeToMax(direction, maxDirection) {
  return [direction[0] / maxDirection[0] || 0, direction[1] / maxDirection[1] || 0]
}

/**************************
 Export
 **************************/

function exportSVG() {
  var blob = new Blob([paper.project.exportSVG({asString: true})], {type: "text/plain;charset=utf-8"})
  saveAs(blob, RenderConfig.name)
}
