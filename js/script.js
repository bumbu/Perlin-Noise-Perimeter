/**************************
 Info messages
 **************************/
var $message = document.getElementById('message')

function showMessage(text) {
  if (text != null) {
    $message.innerHTML = text
  }
  $message.style.display = null
}

function hideMessage() {
  $message.style.display = 'none'
}

/**************************
 Config
 **************************/

var RenderConfigDefaults = {
  updateOnEachChange: false
, renderOnCanvas: false
, zoom: 1
, mode: 'pan'

, noiseOctaves: 8
, noiseFalloff: 0.44
, noiseSeed: 100
, noiseDetalisation: 0.004
, noiseRotation: 360
, noiseIntensity: 3

, pathInterval: 5
, pathPoints: 30
, pathPointDistance: 6

, directionIntensity: 0.5

, addFile: function() {
    $('#file-input').click()
  }
, name: 'demo.svg'
, export: function() {
    exportSVG()
  }
, resetToDefaults: function() {
    // Copy all setting from defaults
    for (var key in RenderConfigDefaults) {
      RenderConfig[key] = RenderConfigDefaults[key]
    }

    // Save to local storage
    saveConfig()

    // Update gui
    for (var i in gui.__controllers) {
      gui.__controllers[i].updateDisplay()
    }
    for (var folder in gui.__folders) {
      for (i in gui.__folders[folder].__controllers) {
        gui.__folders[folder].__controllers[i].updateDisplay()
      }
    }
  }
}

var RenderConfig = {}
for (var key in RenderConfigDefaults) {
  RenderConfig[key] = RenderConfigDefaults[key]
}

// Preload cached data
loadConfig()

function onConfigChange() {
  if (RenderConfig.updateOnEachChange) {
    render()
  }
}

function onFinishChange() {
  render()
  saveConfig()
}

function onZoomChange() {
  paper.view.zoom = RenderConfig.zoom
  saveConfig()
}

function onModeChange() {
  // hideMessage()
  switch (RenderConfig.mode) {
    case 'drawDirection':
      showMessage('Click and drag to create directions. Right click to remove a direction')
      break;
    case 'removeDirection':
      showMessage('Click on a direction to remove it')
      break;
    case 'pan':
      showMessage('Pan')
      break;
  }
}
onModeChange()

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
gui.add(RenderConfig, 'zoom').min(0.01).max(5).step(0.01).onFinishChange(onZoomChange)
gui.add(RenderConfig, 'mode', {
  'Draw directions': 'drawDirection'
, 'Remove directions': 'removeDirection'
, 'Pan': 'pan'
}).onFinishChange(onModeChange)

// Noise
var f1 = gui.addFolder('Noise');
f1.add(RenderConfig, 'noiseOctaves').min(1).max(10).step(1).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseFalloff').min(0).max(1).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseSeed').min(0).max(65000).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseDetalisation').min(0).max(0.2).step(0.001).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseRotation').min(0).max(360).step(10).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.add(RenderConfig, 'noiseIntensity').min(0.1).max(10).step(0.1).onChange(onConfigChange).onFinishChange(onFinishChange)
f1.open()

// Path
var f2 = gui.addFolder('Paths');
f2.add(RenderConfig, 'pathInterval').min(0.1).max(10).step(0.1).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.add(RenderConfig, 'pathPoints').min(0).max(1000).step(10).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.add(RenderConfig, 'pathPointDistance').min(0.01).max(10).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f2.open()

// Direction
var f4 = gui.addFolder('Directions')
f4.add(RenderConfig, 'directionIntensity').min(0).max(1).step(0.01).onChange(onConfigChange).onFinishChange(onFinishChange)
f4.open()

// Import/Export
var f3 = gui.addFolder('Import/Export');
f3.add(RenderConfig, 'addFile')
f3.add(RenderConfig, 'name')
f3.add(RenderConfig, 'export')
f3.add(RenderConfig, 'resetToDefaults')

/**************************
 Config save/load
 **************************/

function getStorableConfig() {
  var obj = {}
  for (var key in RenderConfig) {
    if (typeof RenderConfig[key] != 'function') {
      obj[key] = RenderConfig[key]
    }
  }

  return obj
}

function saveConfig() {
  if (window.localStorage) {
    localStorage.setItem('render-config', JSON.stringify(getStorableConfig()))
  }
}

function loadConfig() {
  if (window.localStorage && localStorage.hasOwnProperty('render-config')) {
    var StoredConfig = JSON.parse(localStorage['render-config'])
    for (var key in StoredConfig) {
      if (RenderConfig.hasOwnProperty(key)) {
        RenderConfig[key] = StoredConfig[key]
      }
    }
  }
}

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

paper.project.importSVG('images/grouped.svg', function() {
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
  var svgRectangleRemoved = false
  var svgChildren = paper.project.layers[0].children[0].removeChildren()
  // Remove first rectangle which is the border of SVG
  .filter(function(child) {
    if (!svgRectangleRemoved && child instanceof paper.Shape && child.type === 'rectangle') {
      svgRectangleRemoved = true
      return false
    }
    return true
  })

  svgChildren = unwrapGroups(svgChildren)
  // Transform shapes into paths
  .map(function(child) {
    if (child instanceof paper.Shape) {
      return child.toPath(false)
    } else {
      return child
    }
  })
  // Remove everything except paths
  .filter(function(child) {
    return child instanceof paper.Path
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

function unwrapGroups(children) {
  var unwrapped = []
  children.map(function(child) {
    if (child instanceof paper.Group) {
      unwrapped = unwrapped.concat(unwrapGroups(child.children))
    } else {
      unwrapped.push(child)
    }
  })

  return unwrapped
}

function initDirectionLayer() {
  // Create direction layer
  directionLayer = new paper.Layer()
  // Init tool
  new paper.Tool()

  var lastPath = null
    , isPanning = false

  function startPath(ev) {
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

  function removeDirection(ev) {
    // Find nearest path
    var minDistance = Infinity
      , direction = null

    directionLayer.children.forEach(function(path) {
      if (ev.point.getDistance(path.getNearestPoint(ev.point)) < minDistance) {
        direction = path
        minDistance = ev.point.getDistance(path.getNearestPoint(ev.point))
      }
    })

    nextClickWillRemoveADirection = false
    hideMessage()

    if (direction) {
      direction.remove()
      render()
    }
  }

  function isRightClick(ev) {
    if (ev.event.which) return ev.event.which === 3;
    if (ev.event.button) return ev.event.button === 2;
    return false;
  }

  paper.tool.onMouseDown = function(ev) {
    switch (RenderConfig.mode) {
      case 'drawDirection':
        if (isRightClick(ev)) {
          console.log('r')
          ev.preventDefault()
          removeDirection(ev)
        } else {
          startPath(ev)
        }
        break;
      case 'removeDirection':
        removeDirection(ev)
        break;
      case 'pan':
        isPanning = true
        break;
    }
  }

  paper.tool.onMouseMove = function(ev) {
    if (lastPath != null) {
      lastPath.lastSegment.point = ev.point
    }

    if (isPanning && ev.count % 2 == 1) {
      paper.view.center = paper.view.center.add([-ev.delta.x, -ev.delta.y])
    }

  }

  paper.tool.onMouseUp = function(ev) {
    if (lastPath != null) {
      lastPath.lastSegment.point = ev.point
      lastPath = null
      render()
    }

    isPanning = false
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
        , finalX
        , finalY

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
          , noiseRotation = RenderConfig.noiseRotation || 360 // 0 == 360
        //   , directionPath = paper.Path.Line(startPoint, startPoint.add(direction))
        // directionPath.strokeColor = 'green'

        for (var step = 0; step < RenderConfig.pathPoints; step ++) {
          perlinPath.add(lastPoint)

          vectorX = Math.cos(RenderConfig.noiseIntensity * processing.noise(lastPoint.x*RenderConfig.noiseDetalisation,lastPoint.y*RenderConfig.noiseDetalisation) + (noiseRotation / 180) * Math.PI)
          vectorY = -Math.sin(RenderConfig.noiseIntensity * processing.noise(lastPoint.x*RenderConfig.noiseDetalisation,lastPoint.y*RenderConfig.noiseDetalisation) + (noiseRotation / 180) * Math.PI)
          // lastPoint = lastPoint.add([vectorX, vectorY])
          // console.log(directionRelative)
          // console.log([directionRelative[0] * RenderConfig.directionIntensity + vectorX * (1 - RenderConfig.directionIntensity), directionRelative[1] * RenderConfig.directionIntensity + vectorY * (1 - RenderConfig.directionIntensity)])
          finalX = (directionRelative[0] * RenderConfig.directionIntensity + vectorX * (1 - RenderConfig.directionIntensity)) * RenderConfig.pathPointDistance
          finalY = (directionRelative[1] * RenderConfig.directionIntensity + vectorY * (1 - RenderConfig.directionIntensity)) * RenderConfig.pathPointDistance
          lastPoint = lastPoint.add([finalX, finalY])
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

// Compute against maxDirection max
function directionRelativeToMax(direction, maxDirection) {
  var max = Math.max(maxDirection[0], maxDirection[1])
  return [direction[0] / max || 0, direction[1] / max || 0]
}

/**************************
 Export
 **************************/

function exportSVG() {
  var blob = new Blob([paper.project.exportSVG({asString: true})], {type: "text/plain;charset=utf-8"})
  saveAs(blob, RenderConfig.name)
}
