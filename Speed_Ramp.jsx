/*
  Speed_Ramp.jsx

  After Effects usage:
  1. Open a composition.
  2. Select one or more video/precomp layers.
  3. File > Scripts > Run Script File... and choose this file.

  The script enables Time Remapping and creates a simple slow-fast-slow
  speed ramp on each selected layer.
*/
(function speedRampSelectedLayers() {
  var FAST_SECTION_START = 0.35;
  var FAST_SECTION_END = 0.65;
  var SOURCE_VALUE_AT_FAST_START = 0.2;
  var SOURCE_VALUE_AT_FAST_END = 0.8;
  var EASE_INFLUENCE = 70;

  app.beginUndoGroup("Speed Ramp Selected Layers");

  try {
    var comp = app.project.activeItem;

    if (!(comp instanceof CompItem)) {
      alert("Active comp tanlang.");
      return;
    }

    if (!comp.selectedLayers || comp.selectedLayers.length === 0) {
      alert("Speed ramp qilish uchun layer tanlang.");
      return;
    }

    var applied = 0;
    var skipped = 0;

    for (var i = 0; i < comp.selectedLayers.length; i += 1) {
      if (applySpeedRamp(comp, comp.selectedLayers[i])) {
        applied += 1;
      } else {
        skipped += 1;
      }
    }

    alert("Speed ramp tayyor.\n\nApplied: " + applied + "\nSkipped: " + skipped);
  } catch (error) {
    alert("Speed ramp xatosi: " + error.toString());
  } finally {
    app.endUndoGroup();
  }

  function applySpeedRamp(comp, layer) {
    if (!layer || !layer.canSetTimeRemapEnabled || layer.outPoint <= layer.inPoint) {
      return false;
    }

    try {
      layer.timeRemapEnabled = true;
    } catch (error) {
      return false;
    }

    var timeRemap = layer.property("ADBE Time Remapping");
    if (!timeRemap) {
      return false;
    }

    clearTimeRemapKeys(timeRemap);

    var inPoint = layer.inPoint;
    var outPoint = Math.max(layer.inPoint + comp.frameDuration, layer.outPoint - comp.frameDuration);
    var layerDuration = outPoint - inPoint;
    var sourceDuration = getSourceDuration(layer, layerDuration);

    if (layerDuration <= comp.frameDuration || sourceDuration <= 0) {
      return false;
    }

    var key1Time = inPoint;
    var key2Time = inPoint + layerDuration * FAST_SECTION_START;
    var key3Time = inPoint + layerDuration * FAST_SECTION_END;
    var key4Time = outPoint;

    timeRemap.setValueAtTime(key1Time, 0);
    timeRemap.setValueAtTime(key2Time, sourceDuration * SOURCE_VALUE_AT_FAST_START);
    timeRemap.setValueAtTime(key3Time, sourceDuration * SOURCE_VALUE_AT_FAST_END);
    timeRemap.setValueAtTime(key4Time, sourceDuration);

    applyEase(timeRemap, EASE_INFLUENCE);
    return true;
  }

  function clearTimeRemapKeys(property) {
    while (property.numKeys > 0) {
      property.removeKey(1);
    }
  }

  function getSourceDuration(layer, fallbackDuration) {
    if (layer.source && layer.source.duration && layer.source.duration > 0) {
      return Math.max(layer.source.duration - 0.001, fallbackDuration);
    }

    return fallbackDuration;
  }

  function applyEase(property, influence) {
    for (var keyIndex = 1; keyIndex <= property.numKeys; keyIndex += 1) {
      try {
        property.setInterpolationTypeAtKey(
          keyIndex,
          KeyframeInterpolationType.BEZIER,
          KeyframeInterpolationType.BEZIER
        );

        property.setTemporalEaseAtKey(
          keyIndex,
          [new KeyframeEase(0, influence)],
          [new KeyframeEase(0, influence)]
        );
      } catch (error) {
        // Keep the keyframe even if AE refuses custom easing on this layer.
      }
    }
  }
})();
