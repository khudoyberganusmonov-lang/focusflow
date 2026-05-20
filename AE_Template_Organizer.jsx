/*
  AE Template Organizer

  Run in Adobe After Effects:
  1. Open the template project.
  2. Select the Final/Main comp in the Project panel, or make it active.
  3. File > Scripts > Run Script File... and choose this file.

  This script is intentionally conservative around color/fill systems:
  it does not remove, bake, or rewrite Fill / Gradient Fill / Layer Styles /
  Animator Fill Color / effect-based color systems. Text is extracted using
  After Effects' native precompose call so the original editable text, effects,
  expressions, masks, mattes, and fill systems remain with the text.
*/
(function aeTemplateOrganizer() {
  var EDIT_FOLDER = "01.Edit Comps";
  var TEXT_FOLDER = "Text";
  var MEDIA_FOLDER = "Media";
  var LOGO_FOLDER = "Logo";
  var FINAL_FOLDER = "02.Final Comp";
  var OTHERS_FOLDER = "03.Others";
  var MIN_DURATION = 1 / 25;
  var CROP_PADDING = 24;
  var MAX_RECURSION = 80;

  if (!app.project) {
    alert("After Effects project ochilmagan.");
    return;
  }

  app.beginUndoGroup("AE Template Organizer");

  try {
    var folders = createFolders();
    var finalComps = getFinalComps();

    if (finalComps.length === 0) {
      alert("Final/Main comp topilmadi. Project panelda final compni tanlab qayta ishga tushiring.");
      return;
    }

    var stats = {
      finalComps: finalComps.length,
      scenes: 0,
      textComps: 0,
      mediaComps: 0,
      logoComps: 0,
      skippedText: 0
    };

    for (var i = 0; i < finalComps.length; i += 1) {
      organizeFinalComp(finalComps[i], folders, stats);
    }

    organizeLogoComps(folders.logoFolder, stats);
    moveRootItemsToOthers(folders);
    removeEmptyFolders(folders);

    if (isFolderEmpty(folders.logoFolder)) {
      safeRemove(folders.logoFolder);
    }

    alert(
      "Tayyor.\n\n" +
        "Final comp: " + stats.finalComps + "\n" +
        "Scene: " + stats.scenes + "\n" +
        "Text comp: " + stats.textComps + "\n" +
        "Media comp: " + stats.mediaComps + "\n" +
        "Logo comp: " + stats.logoComps + "\n" +
        "Skipped unsafe text: " + stats.skippedText
    );
  } catch (error) {
    alert("Script xatosi: " + error.toString());
  } finally {
    app.endUndoGroup();
  }

  function createFolders() {
    var editFolder = getOrCreateFolder(EDIT_FOLDER, app.project.rootFolder);
    return {
      editFolder: editFolder,
      textFolder: getOrCreateFolder(TEXT_FOLDER, editFolder),
      mediaFolder: getOrCreateFolder(MEDIA_FOLDER, editFolder),
      logoFolder: getOrCreateFolder(LOGO_FOLDER, editFolder),
      finalFolder: getOrCreateFolder(FINAL_FOLDER, app.project.rootFolder),
      othersFolder: getOrCreateFolder(OTHERS_FOLDER, app.project.rootFolder)
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
    var selection = app.project.selection;

    for (var i = 0; i < selection.length; i += 1) {
      if (selection[i] instanceof CompItem) {
        comps.push(selection[i]);
      }
    }

    if (comps.length === 0 && app.project.activeItem instanceof CompItem) {
      comps.push(app.project.activeItem);
    }

    if (comps.length === 0) {
      for (var p = 1; p <= app.project.numItems; p += 1) {
        var item = app.project.item(p);
        if (item instanceof CompItem && hasKeyword(item.name, ["final", "main", "master", "render"])) {
          comps.push(item);
        }
      }
    }

    return uniqueItems(comps);
  }

  function organizeFinalComp(finalComp, folders, stats) {
    finalComp.parentFolder = folders.finalFolder;

    var scenes = detectSceneLayers(finalComp);
    if (scenes.length === 0) {
      scenes.push({
        comp: finalComp,
        layer: null,
        label: "01"
      });
    }

    for (var i = 0; i < scenes.length; i += 1) {
      var scene = scenes[i];
      var label = padNumber(i + 1, 2);

      if (scene.layer) {
        scene.layer.name = "Scene " + label;
      }
      scene.comp.name = "Scene " + label;
      scene.comp.parentFolder = folders.finalFolder;
      scene.label = label;
    }

    stats.scenes += scenes.length;

    for (var s = 0; s < scenes.length; s += 1) {
      processScene(scenes[s].comp, scenes[s].label, folders, stats);
    }
  }

  function detectSceneLayers(finalComp) {
    var sceneLayers = [];

    for (var i = 1; i <= finalComp.numLayers; i += 1) {
      var layer = finalComp.layer(i);
      if (isSceneLayer(layer)) {
        sceneLayers.push(layer);
      }
    }

    sceneLayers.sort(sortLayersByTimeline);

    var scenes = [];
    for (var s = 0; s < sceneLayers.length; s += 1) {
      scenes.push({
        comp: sceneLayers[s].source,
        layer: sceneLayers[s],
        label: padNumber(s + 1, 2)
      });
    }

    return scenes;
  }

  function isSceneLayer(layer) {
    if (!layer || !(layer.source instanceof CompItem) || layer.locked || !layer.enabled) {
      return false;
    }

    if (layer.outPoint <= layer.inPoint) {
      return false;
    }

    var name = layer.name + " " + layer.source.name;
    if (hasKeyword(name, ["media", "placeholder", "your media", "logo", "text", "title", "caption", "control", "controller", "settings", "helper", "utility"])) {
      return false;
    }

    return true;
  }

  function processScene(sceneComp, sceneLabel, folders, stats) {
    fixTextContentRecursive(sceneComp, {});
    extractTextLayersRecursive(sceneComp, sceneLabel, folders.textFolder, stats, {});
    organizeMediaForScene(sceneComp, sceneLabel, folders.mediaFolder, stats);
  }

  function extractTextLayersRecursive(comp, sceneLabel, textFolder, stats, visited) {
    if (!comp || visited[comp.id]) {
      return;
    }
    visited[comp.id] = true;

    extractTextLayersFromComp(comp, sceneLabel, textFolder, stats);

    var nested = getNestedCompsByTimeline(comp);
    for (var i = 0; i < nested.length; i += 1) {
      if (nested[i].parentFolder !== textFolder && !isExtractedTextCompName(nested[i].name) && !isMediaLikeComp(nested[i]) && !isLogoLikeComp(nested[i])) {
        extractTextLayersRecursive(nested[i], sceneLabel, textFolder, stats, visited);
      }
    }
  }

  function extractTextLayersFromComp(comp, sceneLabel, textFolder, stats) {
    var textLayers = collectVisibleTextLayers(comp);
    var textNumber = 1;

    for (var i = 0; i < textLayers.length; i += 1) {
      var textLayer = textLayers[i];
      if (!isUsableLayer(textLayer) || !isTextLayer(textLayer)) {
        continue;
      }

      var dependencyIndexes = collectTextDependencies(comp, textLayer);
      if (dependencyIndexes.length === 0) {
        stats.skippedText += 1;
        continue;
      }

      var timing = detectVisibleTiming(comp, dependencyIndexes);
      var name = makeUniqueName("Text " + sceneLabel + "." + textNumber);
      var extracted = precomposeTextGroup(comp, dependencyIndexes, name, textFolder, timing);

      if (!extracted && dependencyIndexes.length > 1) {
        extracted = precomposeTextGroup(comp, [textLayer.index], name, textFolder, detectVisibleTiming(comp, [textLayer.index]));
      }

      if (extracted) {
        stats.textComps += 1;
        textNumber += 1;
      } else {
        stats.skippedText += 1;
      }
    }
  }

  function collectVisibleTextLayers(comp) {
    var layers = [];
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isUsableLayer(layer) && isTextLayer(layer)) {
        layers.push(layer);
      }
    }

    layers.sort(sortLayersByTimeline);
    return layers;
  }

  function collectTextDependencies(comp, textLayer) {
    var map = {};
    addLayerAndParents(textLayer, map);

    var changed = true;
    var guard = 0;

    while (changed && guard < MAX_RECURSION) {
      changed = false;
      guard += 1;

      var indexes = mapKeysToNumbers(map);
      for (var i = 0; i < indexes.length; i += 1) {
        var layer = safeLayer(comp, indexes[i]);
        if (!isUsableLayer(layer)) {
          continue;
        }

        changed = addTrackMatte(comp, layer, map) || changed;
        changed = addExpressionReferences(comp, layer, map) || changed;
        changed = addParentIfNeeded(layer, map) || changed;
      }
    }

    addAdjustmentLayers(comp, textLayer, map);
    addLikelyLinkedLayers(comp, textLayer, map);

    var result = mapKeysToNumbers(map);
    result.sort(sortNumbersAscending);
    return result;
  }

  function addLayerAndParents(layer, map) {
    if (!isUsableLayer(layer)) {
      return false;
    }

    var changed = !map[layer.index];
    map[layer.index] = true;
    addParentIfNeeded(layer, map);
    return changed;
  }

  function addParentIfNeeded(layer, map) {
    if (layer && layer.parent && isUsableLayer(layer.parent) && !map[layer.parent.index]) {
      addLayerAndParents(layer.parent, map);
      return true;
    }
    return false;
  }

  function addTrackMatte(comp, layer, map) {
    var matte = null;

    try {
      if (layer.trackMatteLayer) {
        matte = layer.trackMatteLayer;
      }
    } catch (error) {
      matte = null;
    }

    if (!matte && usesTrackMatte(layer) && layer.index > 1) {
      matte = comp.layer(layer.index - 1);
    }

    if (isUsableLayer(matte) && !map[matte.index]) {
      addLayerAndParents(matte, map);
      return true;
    }

    return false;
  }

  function usesTrackMatte(layer) {
    try {
      if (typeof TrackMatteType !== "undefined") {
        return layer.trackMatteType !== TrackMatteType.NO_TRACK_MATTE;
      }
      return typeof layer.trackMatteType !== "undefined" && String(layer.trackMatteType).indexOf("NO_TRACK") === -1;
    } catch (error) {
      return false;
    }
  }

  function addExpressionReferences(comp, layer, map) {
    var expressions = [];
    collectExpressions(layer, expressions);
    var changed = false;

    for (var i = 0; i < expressions.length; i += 1) {
      var names = extractLayerNames(expressions[i]);
      for (var n = 0; n < names.length; n += 1) {
        var referenced = getLayerByName(comp, names[n]);
        if (isUsableLayer(referenced) && !map[referenced.index]) {
          addLayerAndParents(referenced, map);
          changed = true;
        }
      }
    }

    return changed;
  }

  function addAdjustmentLayers(comp, textLayer, map) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isUsableLayer(layer) && layer.adjustmentLayer && !map[layer.index] && overlaps(layer, textLayer)) {
        addLayerAndParents(layer, map);
      }
    }
  }

  function addLikelyLinkedLayers(comp, textLayer, map) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (!isUsableLayer(layer) || map[layer.index] || !overlaps(layer, textLayer)) {
        continue;
      }

      var name = layer.name + " " + (layer.source ? layer.source.name : "");
      if (layer.nullLayer || isShapeLayer(layer) || hasKeyword(name, ["controller", "control", "text", "title", "caption", "null", "shape"])) {
        addLayerAndParents(layer, map);
      }
    }
  }

  function precomposeTextGroup(comp, indexes, name, textFolder, timing) {
    try {
      indexes.sort(sortNumbersAscending);
      var newComp = comp.layers.precompose(indexes, name, true);
      newComp.name = name;
      newComp.parentFolder = textFolder;

      var duration = Math.max(timing.outPoint - timing.inPoint, MIN_DURATION);
      shiftLayerTimes(newComp, -timing.inPoint);
      newComp.duration = duration;
      newComp.workAreaStart = 0;
      newComp.workAreaDuration = duration;

      var replacement = findLayerBySource(comp, newComp);
      if (replacement) {
        replacement.name = name;
        replacement.startTime = timing.inPoint;
        replacement.inPoint = timing.inPoint;
        replacement.outPoint = timing.outPoint;
      }

      if (timing.bounds && canCropSafely(newComp)) {
        cropPrecomp(comp, newComp, replacement, timing.bounds);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function detectVisibleTiming(comp, indexes) {
    var base = getGroupTiming(comp, indexes);
    var start = base.inPoint;
    var end = base.outPoint;
    var duration = Math.max(end - start, MIN_DURATION);
    var sampleCount = Math.max(6, Math.min(30, Math.ceil(duration / Math.max(comp.frameDuration, MIN_DURATION))));
    var firstVisible = null;
    var lastVisible = null;
    var bestBounds = null;
    var bestArea = 0;

    for (var i = 0; i <= sampleCount; i += 1) {
      var time = start + duration * (i / sampleCount);
      var bounds = getGroupBounds(comp, indexes, time, CROP_PADDING);
      var opacity = getGroupOpacity(comp, indexes, time);
      var area = bounds ? Math.max(0, bounds.right - bounds.left) * Math.max(0, bounds.bottom - bounds.top) : 0;

      if (bounds && opacity > 0.5 && area > 1) {
        if (firstVisible === null) {
          firstVisible = time;
        }
        lastVisible = time;
        if (area > bestArea) {
          bestArea = area;
          bestBounds = bounds;
        }
      }
    }

    if (firstVisible === null || lastVisible === null) {
      return {
        inPoint: start,
        outPoint: end,
        bounds: getGroupBounds(comp, indexes, start + duration / 2, CROP_PADDING)
      };
    }

    var margin = Math.max(comp.frameDuration * 2, MIN_DURATION);
    return {
      inPoint: Math.max(start, firstVisible - margin),
      outPoint: Math.min(end, lastVisible + margin),
      bounds: bestBounds
    };
  }

  function getGroupTiming(comp, indexes) {
    var start = null;
    var end = null;

    for (var i = 0; i < indexes.length; i += 1) {
      var layer = safeLayer(comp, indexes[i]);
      if (!layer) {
        continue;
      }
      start = start === null ? layer.inPoint : Math.min(start, layer.inPoint);
      end = end === null ? layer.outPoint : Math.max(end, layer.outPoint);
    }

    return {
      inPoint: start === null ? 0 : start,
      outPoint: end === null ? comp.duration : end
    };
  }

  function getGroupBounds(comp, indexes, time, padding) {
    var bounds = null;

    for (var i = 0; i < indexes.length; i += 1) {
      var layer = safeLayer(comp, indexes[i]);
      if (!isTextLayer(layer)) {
        continue;
      }
      bounds = unionBounds(bounds, getTextBounds(layer, time, padding));
    }

    return bounds;
  }

  function getTextBounds(layer, time, padding) {
    try {
      var rect = layer.sourceRectAtTime(time, false);
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      var points = [
        pointToComp(layer, [rect.left, rect.top], time),
        pointToComp(layer, [rect.left + rect.width, rect.top], time),
        pointToComp(layer, [rect.left, rect.top + rect.height], time),
        pointToComp(layer, [rect.left + rect.width, rect.top + rect.height], time)
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
    } catch (error) {
      return null;
    }
  }

  function pointToComp(layer, point, time) {
    if (typeof layer.toComp === "function") {
      return layer.toComp(point);
    }

    var transform = layer.property("ADBE Transform Group");
    if (!transform) {
      return point;
    }

    var anchor = valueAt(transform.property("ADBE Anchor Point"), time, [0, 0, 0]);
    var position = valueAt(transform.property("ADBE Position"), time, [0, 0, 0]);
    var scale = valueAt(transform.property("ADBE Scale"), time, [100, 100, 100]);
    var rotation = valueAt(transform.property("ADBE Rotate Z"), time, 0);
    var x = (point[0] - anchor[0]) * (scale[0] / 100);
    var y = (point[1] - anchor[1]) * (scale[1] / 100);
    var radians = rotation * Math.PI / 180;

    return [
      position[0] + x * Math.cos(radians) - y * Math.sin(radians),
      position[1] + x * Math.sin(radians) + y * Math.cos(radians)
    ];
  }

  function getGroupOpacity(comp, indexes, time) {
    var opacity = 0;
    for (var i = 0; i < indexes.length; i += 1) {
      var layer = safeLayer(comp, indexes[i]);
      if (!isTextLayer(layer)) {
        continue;
      }
      var transform = layer.property("ADBE Transform Group");
      opacity = Math.max(opacity, valueAt(transform.property("ADBE Opacity"), time, 100));
    }
    return opacity;
  }

  function canCropSafely(comp) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.threeDLayer || layer.parent || hasAnyExpression(layer)) {
        return false;
      }
    }
    return true;
  }

  function cropPrecomp(parentComp, newComp, replacement, bounds) {
    if (!replacement || !bounds) {
      return;
    }

    try {
      var left = Math.floor(bounds.left);
      var top = Math.floor(bounds.top);
      var width = Math.max(4, Math.ceil(bounds.right - left));
      var height = Math.max(4, Math.ceil(bounds.bottom - top));

      shiftAllPositions(newComp, -left, -top);
      newComp.width = width;
      newComp.height = height;
      setAnchor(replacement, [width / 2, height / 2]);
      setPosition(replacement, [left + width / 2, top + height / 2]);
    } catch (error) {
      // Cropping is optional. If it is unsafe, leave the visual result intact.
    }
  }

  function shiftLayerTimes(comp, delta) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      comp.layer(i).startTime += delta;
    }
  }

  function shiftAllPositions(comp, dx, dy) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      var transform = layer.property("ADBE Transform Group");
      if (!transform) {
        continue;
      }
      var position = transform.property("ADBE Position");
      if (!position || position.dimensionsSeparated) {
        continue;
      }
      offsetProperty(position, dx, dy);
    }
  }

  function offsetProperty(property, dx, dy) {
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

  function setAnchor(layer, value) {
    var anchor = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
    if (!anchor) {
      return;
    }
    var old = anchor.value;
    anchor.setValue(old.length === 3 ? [value[0], value[1], old[2]] : value);
  }

  function setPosition(layer, value) {
    var position = layer.property("ADBE Transform Group").property("ADBE Position");
    if (!position || position.dimensionsSeparated) {
      return;
    }
    var old = position.value;
    position.setValue(old.length === 3 ? [value[0], value[1], old[2]] : value);
  }

  function organizeMediaForScene(sceneComp, sceneLabel, mediaFolder, stats) {
    var media = collectLeafMedia(sceneComp, {});
    media.sort(sortItemsByName);

    for (var i = 0; i < media.length; i += 1) {
      media[i].name = "Media " + sceneLabel + "." + (i + 1);
      media[i].parentFolder = mediaFolder;
      stats.mediaComps += 1;
    }
  }

  function collectLeafMedia(comp, visited) {
    var result = [];
    if (!comp || visited[comp.id]) {
      return result;
    }
    visited[comp.id] = true;

    var nested = getNestedCompsByTimeline(comp);
    for (var i = 0; i < nested.length; i += 1) {
      var child = nested[i];
      var childMedia = collectLeafMedia(child, visited);
      result = result.concat(childMedia);

      if (childMedia.length === 0 && isFinalUsableMediaComp(child)) {
        result.push(child);
      }
    }

    return uniqueItems(result);
  }

  function isFinalUsableMediaComp(comp) {
    if (!(comp instanceof CompItem) || isLogoLikeComp(comp) || compContainsText(comp, {}) || isSceneName(comp.name)) {
      return false;
    }

    if (hasKeyword(comp.name, ["helper", "utility", "control", "controller", "settings", "temp", "precomp"])) {
      return false;
    }

    if (containsNestedMediaComp(comp)) {
      return false;
    }

    return isMediaLikeComp(comp) || containsReplaceableFootage(comp);
  }

  function isMediaLikeComp(comp) {
    return comp instanceof CompItem && hasKeyword(comp.name, ["media", "photo", "image", "video", "placeholder", "replace", "your media"]);
  }

  function containsNestedMediaComp(comp) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.source instanceof CompItem && isMediaLikeComp(layer.source)) {
        return true;
      }
    }
    return false;
  }

  function containsReplaceableFootage(comp) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      var sourceName = layer.source ? layer.source.name : "";
      if (!(layer.source instanceof CompItem) && hasKeyword(layer.name + " " + sourceName, ["media", "photo", "image", "video", "placeholder", "replace", "your media"])) {
        return true;
      }
    }
    return false;
  }

  function organizeLogoComps(logoFolder, stats) {
    for (var i = 1; i <= app.project.numItems; i += 1) {
      var item = app.project.item(i);
      if (item instanceof CompItem && isLogoLikeComp(item)) {
        item.parentFolder = logoFolder;
        stats.logoComps += 1;
      }
    }
  }

  function isLogoLikeComp(comp) {
    if (!(comp instanceof CompItem)) {
      return false;
    }

    if (hasKeyword(comp.name, ["logo"])) {
      return true;
    }

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      var sourceName = layer.source ? layer.source.name : "";
      if (hasKeyword(layer.name + " " + sourceName, ["logo"])) {
        return true;
      }
    }

    return false;
  }

  function fixTextContentRecursive(comp, visited) {
    if (!comp || visited[comp.id]) {
      return;
    }
    visited[comp.id] = true;

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isTextLayer(layer)) {
        fixTextLayerContent(layer);
      }
      if (layer.source instanceof CompItem) {
        fixTextContentRecursive(layer.source, visited);
      }
    }
  }

  function fixTextLayerContent(layer) {
    var sourceText = layer.property("ADBE Text Properties").property("ADBE Text Document");
    if (!sourceText) {
      return;
    }

    try {
      if (sourceText.numKeys && sourceText.numKeys > 0) {
        for (var i = 1; i <= sourceText.numKeys; i += 1) {
          var keyed = sourceText.keyValue(i);
          var fixedKeyedText = cleanText(keyed.text);
          if (fixedKeyedText !== keyed.text) {
            keyed.text = fixedKeyedText;
            sourceText.setValueAtKey(i, keyed);
          }
        }
      } else {
        var document = sourceText.value;
        var fixedText = cleanText(document.text);
        if (fixedText !== document.text) {
          document.text = fixedText;
          sourceText.setValue(document);
        }
      }
    } catch (error) {
      // Source Text can be expression/plugin driven. Leave it untouched if AE rejects edits.
    }
  }

  function cleanText(text) {
    var value = String(text || "");
    var brands = ["Envato", "VideoHive", "MotionArray", "Motion Array", "Adobe Stock", "Shutterstock"];
    for (var i = 0; i < brands.length; i += 1) {
      value = value.replace(new RegExp("\\b" + escapeRegExp(brands[i]) + "\\b", "gi"), "Website Name");
    }

    var fixes = {
      "welcom": "welcome",
      "wellcome": "welcome",
      "bussiness": "business",
      "profesional": "professional",
      "proffesional": "professional",
      "portofolio": "portfolio",
      "templete": "template",
      "servise": "service"
    };

    for (var wrong in fixes) {
      if (fixes.hasOwnProperty(wrong)) {
        value = value.replace(new RegExp("\\b" + wrong + "\\b", "gi"), fixes[wrong]);
      }
    }

    return value;
  }

  function moveRootItemsToOthers(folders) {
    for (var i = 1; i <= app.project.numItems; i += 1) {
      var item = app.project.item(i);
      if (item instanceof FolderItem) {
        continue;
      }
      if (item.parentFolder === app.project.rootFolder && item.parentFolder !== folders.finalFolder) {
        item.parentFolder = folders.othersFolder;
      }
    }
  }

  function removeEmptyFolders(folders) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = app.project.numItems; i >= 1; i -= 1) {
        var item = app.project.item(i);
        if (item instanceof FolderItem && !isProtectedFolder(item, folders) && isFolderEmpty(item)) {
          if (safeRemove(item)) {
            changed = true;
          }
        }
      }
    }
  }

  function isProtectedFolder(folder, folders) {
    return (
      folder === folders.editFolder ||
      folder === folders.textFolder ||
      folder === folders.mediaFolder ||
      folder === folders.logoFolder ||
      folder === folders.finalFolder ||
      folder === folders.othersFolder
    );
  }

  function getNestedCompsByTimeline(comp) {
    var entries = [];
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.source instanceof CompItem) {
        entries.push(layer);
      }
    }
    entries.sort(sortLayersByTimeline);

    var comps = [];
    for (var e = 0; e < entries.length; e += 1) {
      comps.push(entries[e].source);
    }
    return uniqueItems(comps);
  }

  function isUsableLayer(layer) {
    return layer && !layer.locked && layer.enabled && layer.outPoint > layer.inPoint;
  }

  function isTextLayer(layer) {
    return layer && layer.property("ADBE Text Properties") !== null;
  }

  function isExtractedTextCompName(name) {
    return /^text\s+\d+\.\d+/i.test(String(name || ""));
  }

  function isShapeLayer(layer) {
    return layer && layer.property("ADBE Root Vectors Group") !== null;
  }

  function compContainsText(comp, visited) {
    if (!comp || visited[comp.id]) {
      return false;
    }
    visited[comp.id] = true;

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isTextLayer(layer)) {
        return true;
      }
      if (layer.source instanceof CompItem && compContainsText(layer.source, visited)) {
        return true;
      }
    }
    return false;
  }

  function collectExpressions(group, output) {
    if (!group || !group.numProperties) {
      return;
    }

    for (var i = 1; i <= group.numProperties; i += 1) {
      var property = group.property(i);
      if (!property) {
        continue;
      }
      try {
        if (property.canSetExpression && property.expressionEnabled && property.expression) {
          output.push(property.expression);
        }
      } catch (error) {
        // Some plugin properties throw.
      }
      collectExpressions(property, output);
    }
  }

  function hasAnyExpression(layer) {
    var expressions = [];
    collectExpressions(layer, expressions);
    return expressions.length > 0;
  }

  function extractLayerNames(expression) {
    var names = [];
    var regex = /(?:thisComp\s*\.\s*)?layer\s*\(\s*["']([^"']+)["']\s*\)/g;
    var match = regex.exec(expression);
    while (match !== null) {
      names.push(match[1]);
      match = regex.exec(expression);
    }
    return names;
  }

  function getLayerByName(comp, name) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      if (comp.layer(i).name === name) {
        return comp.layer(i);
      }
    }
    return null;
  }

  function findLayerBySource(comp, source) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      if (comp.layer(i).source === source) {
        return comp.layer(i);
      }
    }
    return null;
  }

  function safeLayer(comp, index) {
    try {
      return comp.layer(index);
    } catch (error) {
      return null;
    }
  }

  function overlaps(a, b) {
    return a.inPoint < b.outPoint && b.inPoint < a.outPoint;
  }

  function unionBounds(a, b) {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return {
      left: Math.min(a.left, b.left),
      top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right),
      bottom: Math.max(a.bottom, b.bottom)
    };
  }

  function valueAt(property, time, fallback) {
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

  function hasKeyword(name, keywords) {
    var text = normalize(name);
    for (var i = 0; i < keywords.length; i += 1) {
      if (text.indexOf(keywords[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function isSceneName(name) {
    return /\bscene\s*\d+/i.test(String(name || ""));
  }

  function normalize(text) {
    return String(text || "").toLowerCase();
  }

  function padNumber(number, width) {
    var text = String(number);
    while (text.length < width) {
      text = "0" + text;
    }
    return text;
  }

  function makeUniqueName(base) {
    var name = base;
    var counter = 2;
    while (projectItemNameExists(name)) {
      name = base + " " + counter;
      counter += 1;
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

  function sortLayersByTimeline(a, b) {
    if (a.inPoint !== b.inPoint) {
      return a.inPoint - b.inPoint;
    }
    return a.index - b.index;
  }

  function sortNumbersAscending(a, b) {
    return a - b;
  }

  function sortItemsByName(a, b) {
    var nameA = normalize(a.name);
    var nameB = normalize(b.name);
    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
    return 0;
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
    var result = [];
    var seen = {};
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] && !seen[items[i].id]) {
        seen[items[i].id] = true;
        result.push(items[i]);
      }
    }
    return result;
  }

  function isFolderEmpty(folder) {
    for (var i = 1; i <= app.project.numItems; i += 1) {
      if (app.project.item(i).parentFolder === folder) {
        return false;
      }
    }
    return true;
  }

  function safeRemove(item) {
    try {
      item.remove();
      return true;
    } catch (error) {
      return false;
    }
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();
