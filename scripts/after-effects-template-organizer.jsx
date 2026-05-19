/*
  After Effects Template Organizer

  Usage:
  1. Open the project in After Effects.
  2. Select the final comp(s) in the Project panel, or make one final comp active.
  3. Run this file from File > Scripts > Run Script File...

  The script creates:
    01.Edit Comps / Color, Media, Text, Logo
    02.Final Comp
    03.Others

  It precomposes visible text layers into Text comps, crops those generated comps to
  the text's visible time range and visual bounds, and keeps effects/keyframes inside
  the new text comp by using After Effects' native precompose operation.
*/
(function organizeAeTemplate() {
  var EDIT_FOLDER_NAME = "01.Edit Comps";
  var FINAL_FOLDER_NAME = "02.Final Comp";
  var OTHERS_FOLDER_NAME = "03.Others";
  var COLOR_FOLDER_NAME = "Color";
  var MEDIA_FOLDER_NAME = "Media";
  var TEXT_FOLDER_NAME = "Text";
  var LOGO_FOLDER_NAME = "Logo";
  var TEXT_PADDING = 12;
  var MIN_DURATION = 1 / 25;

  if (!app.project) {
    alert("After Effects project ochilmagan.");
    return;
  }

  app.beginUndoGroup("Organize Template");

  try {
    var folders = createTemplateFolders();
    var finalComps = getFinalComps();

    if (finalComps.length === 0) {
      alert("Final comp topilmadi. Project panelda final compni tanlab, scriptni qayta ishga tushiring.");
      return;
    }

    var generatedTextComps = [];
    var generatedColorComps = [];
    var processedComps = {};

    for (var i = 0; i < finalComps.length; i += 1) {
      finalComps[i].parentFolder = folders.finalFolder;
      processCompTree(finalComps[i], folders, generatedTextComps, generatedColorComps, processedComps, getSceneLabel(finalComps[i], i + 1));
      createColorCompForMain(finalComps[i], folders.colorFolder, generatedColorComps);
    }

    organizeExistingProjectItems(folders, finalComps, generatedTextComps, generatedColorComps);

    if (!folders.logoUsed && folders.logoFolder && isFolderEmpty(folders.logoFolder)) {
      folders.logoFolder.remove();
    }

    alert(
      "Template tartiblandi.\n\n" +
        "Final comp: " + finalComps.length + "\n" +
        "Text comp: " + generatedTextComps.length + "\n" +
        "Color comp: " + generatedColorComps.length
    );
  } catch (error) {
    alert("Script xatosi: " + error.toString());
  } finally {
    app.endUndoGroup();
  }

  function createTemplateFolders() {
    var editFolder = getOrCreateFolder(EDIT_FOLDER_NAME, app.project.rootFolder);
    var finalFolder = getOrCreateFolder(FINAL_FOLDER_NAME, app.project.rootFolder);
    var othersFolder = getOrCreateFolder(OTHERS_FOLDER_NAME, app.project.rootFolder);

    return {
      editFolder: editFolder,
      colorFolder: getOrCreateFolder(COLOR_FOLDER_NAME, editFolder),
      mediaFolder: getOrCreateFolder(MEDIA_FOLDER_NAME, editFolder),
      textFolder: getOrCreateFolder(TEXT_FOLDER_NAME, editFolder),
      logoFolder: getOrCreateFolder(LOGO_FOLDER_NAME, editFolder),
      logoUsed: false,
      finalFolder: finalFolder,
      othersFolder: othersFolder
    };
  }

  function getOrCreateFolder(name, parentFolder) {
    for (var i = 1; i <= app.project.numItems; i += 1) {
      var item = app.project.item(i);
      if (item instanceof FolderItem && item.name === name && item.parentFolder === parentFolder) {
        return item;
      }
    }

    var folder = app.project.items.addFolder(name);
    folder.parentFolder = parentFolder;
    return folder;
  }

  function getFinalComps() {
    var comps = [];
    var selectedItems = app.project.selection;

    for (var i = 0; i < selectedItems.length; i += 1) {
      if (selectedItems[i] instanceof CompItem) {
        comps.push(selectedItems[i]);
      }
    }

    if (comps.length === 0 && app.project.activeItem instanceof CompItem) {
      comps.push(app.project.activeItem);
    }

    if (comps.length === 0) {
      for (var p = 1; p <= app.project.numItems; p += 1) {
        var item = app.project.item(p);
        if (item instanceof CompItem && hasKeyword(item.name, ["final", "main", "render"])) {
          comps.push(item);
        }
      }
    }

    return uniqueItems(comps);
  }

  function processCompTree(comp, folders, generatedTextComps, generatedColorComps, processedComps, sceneLabel) {
    if (!comp || processedComps[comp.id]) {
      return;
    }
    processedComps[comp.id] = true;

    var nestedComps = [];
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.source instanceof CompItem) {
        nestedComps.push({
          comp: layer.source,
          sceneLabel: getSceneLabel(layer.source, nestedComps.length + 1)
        });
      }
    }

    for (var n = 0; n < nestedComps.length; n += 1) {
      processCompTree(nestedComps[n].comp, folders, generatedTextComps, generatedColorComps, processedComps, nestedComps[n].sceneLabel);
    }

    precomposeVisibleTextLayers(comp, folders.textFolder, generatedTextComps, sceneLabel);
    if (looksLikeFinalOrMainComp(comp)) {
      createColorCompForMain(comp, folders.colorFolder, generatedColorComps);
    }
  }

  function precomposeVisibleTextLayers(comp, textFolder, generatedTextComps, sceneLabel) {
    if (looksLikeTextComp(comp)) {
      setWorkAreaToVisibleText(comp);
      comp.parentFolder = textFolder;
      return;
    }

    var textNumber = 1;

    for (var i = comp.numLayers; i >= 1; i -= 1) {
      var layer = comp.layer(i);
      if (!isVisibleTextLayer(layer)) {
        continue;
      }

      var layerIndexes = collectTextPrecomposeLayerIndexes(comp, layer);
      var timing = getLayerGroupTiming(comp, layerIndexes);
      var inPoint = timing.inPoint;
      var outPoint = timing.outPoint;
      var duration = Math.max(outPoint - inPoint, MIN_DURATION);
      var bounds = getLayerGroupBoundsInComp(comp, layerIndexes, inPoint + duration / 2, TEXT_PADDING);
      var textCompName = makeUniqueCompName("Text " + sceneLabel + "." + padNumber(textNumber, 1));

      var newComp = comp.layers.precompose(layerIndexes, textCompName, true);
      newComp.parentFolder = textFolder;
      generatedTextComps.push(newComp);

      shiftLayerTimes(newComp, -inPoint);
      setCompDurationAndWorkArea(newComp, duration);

      if (bounds) {
        cropGeneratedPrecomp(comp, newComp, textCompName, bounds);
      }

      var replacementLayer = findLayerBySource(comp, newComp);
      if (replacementLayer) {
        replacementLayer.name = textCompName;
        replacementLayer.startTime = inPoint;
        replacementLayer.inPoint = inPoint;
        replacementLayer.outPoint = outPoint;
      }

      textNumber += 1;
    }
  }

  function createColorCompForMain(comp, colorFolder, generatedColorComps) {
    var colorLayerIndexes = [];

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.locked) {
        continue;
      }
      if (layer.source instanceof CompItem && layer.source.parentFolder === colorFolder) {
        continue;
      }
      if (isColorLayer(layer)) {
        colorLayerIndexes.push(layer.index);
      }
    }

    if (colorLayerIndexes.length === 0) {
      return;
    }

    var contentLayerIndexes = collectColorContentLayerIndexes(comp, colorLayerIndexes);
    for (var c = 0; c < contentLayerIndexes.length; c += 1) {
      if (!numberInArray(colorLayerIndexes, contentLayerIndexes[c])) {
        colorLayerIndexes.push(contentLayerIndexes[c]);
      }
    }

    colorLayerIndexes.sort(sortNumbersAscending);

    var colorCompName = makeUniqueCompName("Color");
    var colorComp = comp.layers.precompose(colorLayerIndexes, colorCompName, true);
    colorComp.parentFolder = colorFolder;
    generatedColorComps.push(colorComp);

    var colorLayer = findLayerBySource(comp, colorComp);
    if (colorLayer) {
      colorLayer.name = colorCompName;
      colorLayer.moveToBeginning();
    }
  }

  function organizeExistingProjectItems(folders, finalComps, generatedTextComps, generatedColorComps) {
    var finalIds = itemIdMap(finalComps);
    var generatedTextIds = itemIdMap(generatedTextComps);
    var generatedColorIds = itemIdMap(generatedColorComps);

    for (var i = 1; i <= app.project.numItems; i += 1) {
      var item = app.project.item(i);

      if (item instanceof FolderItem || isTemplateFolder(item, folders)) {
        continue;
      }

      if (finalIds[item.id]) {
        item.parentFolder = folders.finalFolder;
      } else if (generatedTextIds[item.id] || isTextComp(item)) {
        item.parentFolder = folders.textFolder;
      } else if (generatedColorIds[item.id] || isColorComp(item)) {
        item.parentFolder = folders.colorFolder;
      } else if (isLogoItem(item)) {
        item.parentFolder = folders.logoFolder;
        folders.logoUsed = true;
      } else if (isMediaItem(item)) {
        item.parentFolder = folders.mediaFolder;
      } else if (item.parentFolder === app.project.rootFolder) {
        item.parentFolder = folders.othersFolder;
      }
    }
  }

  function isTemplateFolder(item, folders) {
    return (
      item === folders.editFolder ||
      item === folders.colorFolder ||
      item === folders.mediaFolder ||
      item === folders.textFolder ||
      item === folders.logoFolder ||
      item === folders.finalFolder ||
      item === folders.othersFolder
    );
  }

  function isVisibleTextLayer(layer) {
    return isTextLayer(layer) && layer.enabled && !layer.locked && layer.outPoint > layer.inPoint;
  }

  function isTextLayer(layer) {
    return layer && layer.property("ADBE Text Properties") !== null;
  }

  function collectTextPrecomposeLayerIndexes(comp, textLayer) {
    var indexes = {};
    addLayerWithParents(comp, textLayer, indexes);
    addTrackMatteForLayer(comp, textLayer, indexes);

    var result = mapKeysToNumbers(indexes);
    result.sort(sortNumbersAscending);
    return result;
  }

  function addLayerWithParents(comp, layer, indexes) {
    if (!layer || layer.locked) {
      return;
    }

    indexes[layer.index] = true;

    if (layer.parent && !layer.parent.locked) {
      addLayerWithParents(comp, layer.parent, indexes);
    }
  }

  function addTrackMatteForLayer(comp, layer, indexes) {
    var matteLayer = null;

    try {
      if (layer.trackMatteLayer) {
        matteLayer = layer.trackMatteLayer;
      }
    } catch (error) {
      matteLayer = null;
    }

    if (!matteLayer && layerUsesTrackMatte(layer) && layer.index > 1) {
      matteLayer = comp.layer(layer.index - 1);
    }

    if (matteLayer && typeof matteLayer.index === "number" && !matteLayer.locked) {
      addLayerWithParents(comp, matteLayer, indexes);
    }
  }

  function layerUsesTrackMatte(layer) {
    try {
      if (typeof TrackMatteType !== "undefined") {
        return layer.trackMatteType !== TrackMatteType.NO_TRACK_MATTE;
      }

      if (typeof layer.trackMatteType === "undefined") {
        return false;
      }

      return layer.trackMatteType !== null && String(layer.trackMatteType).indexOf("NO_TRACK") === -1;
    } catch (error) {
      return false;
    }
  }

  function getLayerGroupTiming(comp, layerIndexes) {
    var start = null;
    var end = null;

    for (var i = 0; i < layerIndexes.length; i += 1) {
      var layer = comp.layer(layerIndexes[i]);
      start = start === null ? layer.inPoint : Math.min(start, layer.inPoint);
      end = end === null ? layer.outPoint : Math.max(end, layer.outPoint);
    }

    return {
      inPoint: start === null ? 0 : start,
      outPoint: end === null ? comp.duration : end
    };
  }

  function getLayerGroupBoundsInComp(comp, layerIndexes, time, padding) {
    var bounds = null;

    for (var i = 0; i < layerIndexes.length; i += 1) {
      var layer = comp.layer(layerIndexes[i]);
      if (!isTextLayer(layer)) {
        continue;
      }

      bounds = unionBounds(bounds, getLayerBoundsInComp(layer, time, padding));
    }

    return bounds;
  }

  function unionBounds(first, second) {
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }

    return {
      left: Math.min(first.left, second.left),
      top: Math.min(first.top, second.top),
      right: Math.max(first.right, second.right),
      bottom: Math.max(first.bottom, second.bottom)
    };
  }

  function isTextComp(item) {
    return item instanceof CompItem && looksLikeTextComp(item) && compContainsText(item, {});
  }

  function looksLikeTextComp(comp) {
    return comp instanceof CompItem && hasKeyword(comp.name, ["text", "txt", "title", "caption"]);
  }

  function compContainsText(comp, visited) {
    if (!comp || visited[comp.id]) {
      return false;
    }
    visited[comp.id] = true;

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isVisibleTextLayer(layer)) {
        return true;
      }
      if (layer.source instanceof CompItem && compContainsText(layer.source, visited)) {
        return true;
      }
    }

    return false;
  }

  function isMediaItem(item) {
    if (item instanceof CompItem && isSceneLikeComp(item)) {
      return false;
    }

    if (hasKeyword(item.name, ["media", "photo", "image", "video", "placeholder", "replace"])) {
      return true;
    }

    if (item instanceof CompItem) {
      return !compContainsText(item, {}) && !compHasSceneLayer(item) && compHasNamedLayer(item, ["media", "photo", "image", "video", "placeholder", "replace"]);
    }

    return false;
  }

  function isLogoItem(item) {
    if (hasKeyword(item.name, ["logo"])) {
      return true;
    }

    if (item instanceof CompItem) {
      return compHasNamedLayer(item, ["logo"]);
    }

    return false;
  }

  function isColorComp(item) {
    return item instanceof CompItem && looksLikeColorComp(item);
  }

  function looksLikeColorComp(item) {
    return item instanceof CompItem && hasKeyword(item.name, ["color", "colour", "control"]);
  }

  function isColorLayer(layer) {
    if (!layer || isTextLayer(layer)) {
      return false;
    }

    var sourceName = layer.source ? layer.source.name : "";
    return hasKeyword(layer.name, ["color", "colour", "control", "settings", "setting", "controller"]) || hasKeyword(sourceName, ["color", "colour", "control", "settings", "setting", "controller"]);
  }

  function looksLikeFinalOrMainComp(comp) {
    return comp instanceof CompItem && hasKeyword(comp.name, ["final", "main", "master", "render"]);
  }

  function collectColorContentLayerIndexes(comp, colorLayerIndexes) {
    var result = [];

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.locked || numberInArray(colorLayerIndexes, layer.index) || isCameraOrLightLayer(layer)) {
        continue;
      }

      result.push(layer.index);
    }

    return result;
  }

  function isCameraOrLightLayer(layer) {
    return (typeof CameraLayer !== "undefined" && layer instanceof CameraLayer) || (typeof LightLayer !== "undefined" && layer instanceof LightLayer);
  }

  function isSceneLikeComp(item) {
    return item instanceof CompItem && hasKeyword(item.name, ["scene", "scenes", "shot", "sahna"]);
  }

  function compHasSceneLayer(comp) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      var sourceName = layer.source ? layer.source.name : "";
      if (hasKeyword(layer.name, ["scene", "scenes", "shot", "sahna"]) || hasKeyword(sourceName, ["scene", "scenes", "shot", "sahna"])) {
        return true;
      }
    }

    return false;
  }

  function compHasNamedLayer(comp, keywords) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      var sourceName = layer.source ? layer.source.name : "";
      if (hasKeyword(layer.name, keywords) || hasKeyword(sourceName, keywords)) {
        return true;
      }
    }

    return false;
  }

  function setWorkAreaToVisibleText(comp) {
    var start = null;
    var end = null;

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (!isVisibleTextLayer(layer)) {
        continue;
      }
      start = start === null ? layer.inPoint : Math.min(start, layer.inPoint);
      end = end === null ? layer.outPoint : Math.max(end, layer.outPoint);
    }

    if (start !== null && end !== null && end > start) {
      comp.workAreaStart = start;
      comp.workAreaDuration = end - start;
    }
  }

  function setCompDurationAndWorkArea(comp, duration) {
    comp.duration = duration;
    comp.workAreaStart = 0;
    comp.workAreaDuration = duration;
  }

  function shiftLayerTimes(comp, delta) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      layer.startTime += delta;
    }
  }

  function cropGeneratedPrecomp(parentComp, newComp, layerName, bounds) {
    var cropLeft = Math.floor(bounds.left);
    var cropTop = Math.floor(bounds.top);
    var cropWidth = Math.max(4, Math.ceil(bounds.right - cropLeft));
    var cropHeight = Math.max(4, Math.ceil(bounds.bottom - cropTop));

    shiftAllLayerPositions(newComp, -cropLeft, -cropTop);
    newComp.width = cropWidth;
    newComp.height = cropHeight;

    var replacementLayer = findLayerBySource(parentComp, newComp);
    if (!replacementLayer) {
      return;
    }

    replacementLayer.name = layerName;
    setLayerAnchor(replacementLayer, [cropWidth / 2, cropHeight / 2]);
    setLayerPosition(replacementLayer, [cropLeft + cropWidth / 2, cropTop + cropHeight / 2]);
  }

  function getLayerBoundsInComp(layer, time, padding) {
    if (!layer || !layer.sourceRectAtTime) {
      return null;
    }

    var rect = layer.sourceRectAtTime(time, false);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    var points = [
      layerPointToComp(layer, [rect.left, rect.top], time),
      layerPointToComp(layer, [rect.left + rect.width, rect.top], time),
      layerPointToComp(layer, [rect.left, rect.top + rect.height], time),
      layerPointToComp(layer, [rect.left + rect.width, rect.top + rect.height], time)
    ];

    var left = points[0][0];
    var right = points[0][0];
    var top = points[0][1];
    var bottom = points[0][1];

    for (var i = 1; i < points.length; i += 1) {
      left = Math.min(left, points[i][0]);
      right = Math.max(right, points[i][0]);
      top = Math.min(top, points[i][1]);
      bottom = Math.max(bottom, points[i][1]);
    }

    return {
      left: left - padding,
      top: top - padding,
      right: right + padding,
      bottom: bottom + padding
    };
  }

  function layerPointToComp(layer, point, time) {
    if (typeof layer.toComp === "function") {
      return layer.toComp(point);
    }

    var transform = layer.property("ADBE Transform Group");
    if (!transform) {
      return point;
    }

    var anchor = getTransformValueAtTime(transform.property("ADBE Anchor Point"), time, [0, 0, 0]);
    var position = getPositionValueAtTime(transform, time);
    var scale = getTransformValueAtTime(transform.property("ADBE Scale"), time, [100, 100, 100]);
    var rotation = getTransformValueAtTime(transform.property("ADBE Rotate Z"), time, 0);
    var x = (point[0] - anchor[0]) * (scale[0] / 100);
    var y = (point[1] - anchor[1]) * (scale[1] / 100);
    var radians = rotation * Math.PI / 180;
    var cos = Math.cos(radians);
    var sin = Math.sin(radians);

    return [
      position[0] + x * cos - y * sin,
      position[1] + x * sin + y * cos
    ];
  }

  function getPositionValueAtTime(transform, time) {
    var position = transform.property("ADBE Position");
    if (!position) {
      return [0, 0, 0];
    }

    if (position.dimensionsSeparated) {
      return [
        getTransformValueAtTime(transform.property("ADBE Position_0"), time, 0),
        getTransformValueAtTime(transform.property("ADBE Position_1"), time, 0),
        getTransformValueAtTime(transform.property("ADBE Position_2"), time, 0)
      ];
    }

    return getTransformValueAtTime(position, time, [0, 0, 0]);
  }

  function getTransformValueAtTime(property, time, fallback) {
    if (!property) {
      return fallback;
    }

    try {
      return property.valueAtTime(time, false);
    } catch (error) {
      try {
        return property.value;
      } catch (innerError) {
        return fallback;
      }
    }
  }

  function shiftAllLayerPositions(comp, dx, dy) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      shiftLayerPosition(comp.layer(i), dx, dy);
    }
  }

  function shiftLayerPosition(layer, dx, dy) {
    var transform = layer.property("ADBE Transform Group");
    if (!transform) {
      return;
    }

    var position = transform.property("ADBE Position");
    if (!position) {
      return;
    }

    if (position.dimensionsSeparated) {
      offsetProperty(transform.property("ADBE Position_0"), dx);
      offsetProperty(transform.property("ADBE Position_1"), dy);
    } else {
      offsetVectorProperty(position, dx, dy);
    }
  }

  function setLayerPosition(layer, value) {
    var position = layer.property("ADBE Transform Group").property("ADBE Position");
    if (!position) {
      return;
    }

    if (position.dimensionsSeparated) {
      position.parentProperty.property("ADBE Position_0").setValue(value[0]);
      position.parentProperty.property("ADBE Position_1").setValue(value[1]);
    } else {
      var oldValue = position.value;
      if (oldValue.length === 3) {
        position.setValue([value[0], value[1], oldValue[2]]);
      } else {
        position.setValue(value);
      }
    }
  }

  function setLayerAnchor(layer, value) {
    var anchor = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
    if (!anchor) {
      return;
    }

    var oldValue = anchor.value;
    if (oldValue.length === 3) {
      anchor.setValue([value[0], value[1], oldValue[2]]);
    } else {
      anchor.setValue(value);
    }
  }

  function offsetProperty(property, delta) {
    if (!property) {
      return;
    }

    if (property.numKeys && property.numKeys > 0) {
      for (var i = 1; i <= property.numKeys; i += 1) {
        property.setValueAtKey(i, property.keyValue(i) + delta);
      }
    } else {
      property.setValue(property.value + delta);
    }
  }

  function offsetVectorProperty(property, dx, dy) {
    if (property.numKeys && property.numKeys > 0) {
      for (var i = 1; i <= property.numKeys; i += 1) {
        property.setValueAtKey(i, offsetVector(property.keyValue(i), dx, dy));
      }
    } else {
      property.setValue(offsetVector(property.value, dx, dy));
    }
  }

  function offsetVector(value, dx, dy) {
    if (value.length === 3) {
      return [value[0] + dx, value[1] + dy, value[2]];
    }
    return [value[0] + dx, value[1] + dy];
  }

  function findLayerBySource(comp, sourceItem) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      if (comp.layer(i).source === sourceItem) {
        return comp.layer(i);
      }
    }
    return null;
  }

  function getSceneLabel(comp, fallbackNumber) {
    var match = comp.name.match(/(\d+)/);
    if (match && match[1]) {
      return padNumber(parseInt(match[1], 10), 2);
    }
    return padNumber(fallbackNumber, 2);
  }

  function makeUniqueCompName(baseName) {
    var name = baseName;
    var number = 2;

    while (projectItemNameExists(name)) {
      name = baseName + " " + number;
      number += 1;
    }

    return name;
  }

  function projectItemNameExists(name) {
    for (var i = 1; i <= app.project.numItems; i += 1) {
      if (app.project.item(i).name === name) {
        return true;
      }
    }
    return false;
  }

  function hasKeyword(name, keywords) {
    var loweredName = normalizeName(name);
    for (var i = 0; i < keywords.length; i += 1) {
      if (loweredName.indexOf(keywords[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function normalizeName(name) {
    return String(name || "").toLowerCase();
  }

  function padNumber(number, width) {
    var text = String(number);
    while (text.length < width) {
      text = "0" + text;
    }
    return text;
  }

  function sortNumbersAscending(a, b) {
    return a - b;
  }

  function numberInArray(items, value) {
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] === value) {
        return true;
      }
    }

    return false;
  }

  function mapKeysToNumbers(map) {
    var result = [];

    for (var key in map) {
      if (map.hasOwnProperty(key)) {
        result.push(parseInt(key, 10));
      }
    }

    return result;
  }

  function uniqueItems(items) {
    var seen = {};
    var result = [];

    for (var i = 0; i < items.length; i += 1) {
      if (!seen[items[i].id]) {
        seen[items[i].id] = true;
        result.push(items[i]);
      }
    }

    return result;
  }

  function itemIdMap(items) {
    var map = {};
    for (var i = 0; i < items.length; i += 1) {
      map[items[i].id] = true;
    }
    return map;
  }

  function isFolderEmpty(folder) {
    for (var i = 1; i <= app.project.numItems; i += 1) {
      if (app.project.item(i).parentFolder === folder) {
        return false;
      }
    }
    return true;
  }
})();
