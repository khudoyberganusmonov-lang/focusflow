/*
  After Effects Template Organizer

  Usage:
  1. Open the project in After Effects.
  2. Select the final comp(s) in the Project panel, or make one final comp active.
  3. Run this file from File > Scripts > Run Script File...

  The script creates:
    01.Edit Comps / Media, Text, Logo
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
    var generatedMediaComps = [];
    var processedComps = {};

    for (var i = 0; i < finalComps.length; i += 1) {
      organizeFinalComp(finalComps[i], folders, generatedTextComps, generatedMediaComps, processedComps);
    }

    organizeExistingProjectItems(folders, finalComps, generatedTextComps, generatedMediaComps);

    if (!folders.logoUsed && folders.logoFolder && isFolderEmpty(folders.logoFolder)) {
      folders.logoFolder.remove();
    }

    removeEmptyFolders(app.project.rootFolder);

    alert(
      "Template tartiblandi.\n\n" +
        "Final comp: " + finalComps.length + "\n" +
        "Text comp: " + generatedTextComps.length + "\n" +
        "Media comp: " + generatedMediaComps.length
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

  function organizeFinalComp(finalComp, folders, generatedTextComps, generatedMediaComps, processedComps) {
    finalComp.parentFolder = folders.finalFolder;

    var scenes = detectAndRenameScenes(finalComp);
    if (scenes.length === 0) {
      scenes.push({
        comp: finalComp,
        layer: null,
        number: 1,
        label: "01"
      });
    }

    for (var i = 0; i < scenes.length; i += 1) {
      processSceneComp(scenes[i].comp, scenes[i].label, folders, generatedTextComps, generatedMediaComps, processedComps);
    }
  }

  function detectAndRenameScenes(finalComp) {
    var sceneLayers = [];

    for (var i = 1; i <= finalComp.numLayers; i += 1) {
      var layer = finalComp.layer(i);
      if (isSceneLayerCandidate(layer)) {
        sceneLayers.push(layer);
      }
    }

    sceneLayers.sort(sortLayersByTimeline);

    var scenes = [];
    for (var s = 0; s < sceneLayers.length; s += 1) {
      var sceneNumber = s + 1;
      var sceneLabel = padNumber(sceneNumber, 2);
      var sceneName = "Scene " + sceneLabel;
      var sceneLayer = sceneLayers[s];

      sceneLayer.name = sceneName;
      sceneLayer.source.name = sceneName;

      scenes.push({
        comp: sceneLayer.source,
        layer: sceneLayer,
        number: sceneNumber,
        label: sceneLabel
      });
    }

    return scenes;
  }

  function processSceneComp(sceneComp, sceneLabel, folders, generatedTextComps, generatedMediaComps, processedComps) {
    if (!sceneComp || processedComps[sceneComp.id]) {
      return;
    }

    processedComps[sceneComp.id] = true;
    fixEditableTextContent(sceneComp, {});
    precomposeVisibleTextLayers(sceneComp, folders.textFolder, generatedTextComps, sceneLabel);
    organizeLeafMediaForScene(sceneComp, sceneLabel, folders.mediaFolder, generatedMediaComps);

    var nestedComps = collectNestedSceneComps(sceneComp);
    for (var i = 0; i < nestedComps.length; i += 1) {
      processSceneComp(nestedComps[i], sceneLabel, folders, generatedTextComps, generatedMediaComps, processedComps);
    }
  }

  function collectNestedSceneComps(comp) {
    var nested = [];

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isNestedSceneContentLayer(layer)) {
        nested.push(layer.source);
      }
    }

    nested.sort(sortItemsByName);
    return uniqueItems(nested);
  }

  function isSceneLayerCandidate(layer) {
    if (!layer || !(layer.source instanceof CompItem) || layer.locked || !layer.enabled) {
      return false;
    }

    var name = layer.name + " " + layer.source.name;
    if (hasKeyword(name, ["logo", "media", "placeholder", "text", "txt"])) {
      return false;
    }

    return layer.outPoint > layer.inPoint;
  }

  function isNestedSceneContentLayer(layer) {
    if (!layer || !(layer.source instanceof CompItem) || layer.locked) {
      return false;
    }

    var name = layer.name + " " + layer.source.name;
    if (hasKeyword(name, ["logo"])) {
      return false;
    }

    return !isFinalUsableMediaComp(layer.source);
  }

  function precomposeVisibleTextLayers(comp, textFolder, generatedTextComps, sceneLabel) {
    if (looksLikeTextComp(comp)) {
      setWorkAreaToVisibleText(comp);
      comp.parentFolder = textFolder;
    }

    var textNumber = 1;
    var textLayers = collectTextLayersForExtraction(comp);

    for (var i = 0; i < textLayers.length; i += 1) {
      var layer = textLayers[i];
      if (!isVisibleTextLayer(layer)) {
        continue;
      }

      var layerIndexes = collectTextPrecomposeLayerIndexes(comp, layer);
      if (layerIndexes.length === 0) {
        continue;
      }

      var timing = getLayerGroupTiming(comp, layerIndexes);
      var visibleTiming = detectVisibleLayerGroupTiming(comp, layerIndexes, timing);
      var inPoint = visibleTiming.inPoint;
      var outPoint = visibleTiming.outPoint;
      var duration = Math.max(outPoint - inPoint, MIN_DURATION);
      var bounds = getLayerGroupBoundsInComp(comp, layerIndexes, visibleTiming.sampleTime, TEXT_PADDING);
      var textCompName = makeUniqueCompName("Text " + sceneLabel + "." + padNumber(textNumber, 1));

      var fillSnapshots = [];

      try {
        fillSnapshots = collectAndRemoveFillEffects(comp, layerIndexes);
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
          applyFillEffectsToLayer(replacementLayer, fillSnapshots);
        }

        textNumber += 1;
      } catch (error) {
        restoreFillEffectsToOriginalLayers(comp, fillSnapshots);
        if (precomposeFallbackTextLayer(comp, layer, textFolder, generatedTextComps, textCompName, inPoint, outPoint, duration, bounds)) {
          textNumber += 1;
        }
      }
    }
  }

  function precomposeFallbackTextLayer(comp, layer, textFolder, generatedTextComps, textCompName, inPoint, outPoint, duration, bounds) {
    if (!isVisibleTextLayer(layer)) {
      return false;
    }

    var fallbackFillSnapshots = [];

    try {
      fallbackFillSnapshots = collectAndRemoveFillEffects(comp, [layer.index]);
      var newComp = comp.layers.precompose([layer.index], textCompName, true);
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
        applyFillEffectsToLayer(replacementLayer, fallbackFillSnapshots);
      }

      return true;
    } catch (error) {
      restoreFillEffectsToOriginalLayers(comp, fallbackFillSnapshots);
      return false;
    }
  }

  function organizeExistingProjectItems(folders, finalComps, generatedTextComps, generatedMediaComps) {
    var finalIds = itemIdMap(finalComps);
    var generatedTextIds = itemIdMap(generatedTextComps);
    var generatedMediaIds = itemIdMap(generatedMediaComps);

    for (var i = 1; i <= app.project.numItems; i += 1) {
      var item = app.project.item(i);

      if (item instanceof FolderItem || isTemplateFolder(item, folders)) {
        continue;
      }

      if (finalIds[item.id]) {
        item.parentFolder = folders.finalFolder;
      } else if (generatedTextIds[item.id] || isTextComp(item)) {
        item.parentFolder = folders.textFolder;
      } else if (generatedMediaIds[item.id]) {
        item.parentFolder = folders.mediaFolder;
      } else if (isLogoItem(item)) {
        item.parentFolder = folders.logoFolder;
        folders.logoUsed = true;
      } else if (item.parentFolder === app.project.rootFolder) {
        item.parentFolder = folders.othersFolder;
      }
    }
  }

  function isTemplateFolder(item, folders) {
    return (
      item === folders.editFolder ||
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

  function collectTextLayersForExtraction(comp) {
    var layers = [];

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isVisibleTextLayer(layer)) {
        layers.push(layer);
      }
    }

    layers.sort(sortLayersByTimeline);
    return layers;
  }

  function collectTextPrecomposeLayerIndexes(comp, textLayer) {
    var indexes = {};
    addLayerWithParents(comp, textLayer, indexes);

    var changed = true;
    var guard = 0;
    while (changed && guard < 20) {
      changed = false;
      guard += 1;

      var currentIndexes = mapKeysToNumbers(indexes);
      for (var i = 0; i < currentIndexes.length; i += 1) {
        var layer = comp.layer(currentIndexes[i]);
        changed = addTrackMatteForLayer(comp, layer, indexes) || changed;
        changed = addExpressionReferencedLayers(comp, layer, indexes) || changed;
        if (layer.parent && !layer.parent.locked && !indexes[layer.parent.index]) {
          addLayerWithParents(comp, layer.parent, indexes);
          changed = true;
        }
      }
    }

    addAdjustmentLayersAffectingText(comp, textLayer, indexes);
    addLikelyTextSupportLayers(comp, textLayer, indexes);

    var result = mapKeysToNumbers(indexes);
    result.sort(sortNumbersAscending);
    return result;
  }

  function addLayerWithParents(comp, layer, indexes) {
    if (!layer || layer.locked) {
      return false;
    }

    var wasMissing = !indexes[layer.index];
    indexes[layer.index] = true;

    if (layer.parent && !layer.parent.locked) {
      addLayerWithParents(comp, layer.parent, indexes);
    }

    return wasMissing;
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
      return addLayerWithParents(comp, matteLayer, indexes);
    }

    return false;
  }

  function addExpressionReferencedLayers(comp, layer, indexes) {
    var expressions = [];
    collectExpressions(layer, expressions);
    var changed = false;

    for (var i = 0; i < expressions.length; i += 1) {
      var names = extractLayerNamesFromExpression(expressions[i]);
      for (var n = 0; n < names.length; n += 1) {
        var referencedLayer = getLayerByName(comp, names[n]);
        if (referencedLayer && !referencedLayer.locked && !indexes[referencedLayer.index]) {
          addLayerWithParents(comp, referencedLayer, indexes);
          changed = true;
        }
      }
    }

    return changed;
  }

  function addAdjustmentLayersAffectingText(comp, textLayer, indexes) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (!layer.adjustmentLayer || layer.locked || indexes[layer.index]) {
        continue;
      }

      if (layer.index < textLayer.index && layersOverlapInTime(layer, textLayer)) {
        addLayerWithParents(comp, layer, indexes);
      }
    }
  }

  function addLikelyTextSupportLayers(comp, textLayer, indexes) {
    var textName = normalizeName(textLayer.name);

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.locked || indexes[layer.index] || !layersOverlapInTime(layer, textLayer)) {
        continue;
      }

      if (layer.nullLayer || isShapeLayer(layer) || layer.source instanceof CompItem) {
        var layerName = normalizeName(layer.name);
        var sourceName = layer.source ? normalizeName(layer.source.name) : "";
        if (
          hasKeyword(layerName, ["text", "title", "caption", "controller", "control", "null", "shape"]) ||
          hasKeyword(sourceName, ["text", "title", "caption", "controller", "control", "null", "shape"]) ||
          (textName !== "" && layerName.indexOf(textName) !== -1)
        ) {
          addLayerWithParents(comp, layer, indexes);
        }
      }
    }
  }

  function isSafeTextExtraction(comp, textLayer, layerIndexes) {
    if (layerIndexes.length === 0) {
      return false;
    }

    var indexMap = {};
    for (var i = 0; i < layerIndexes.length; i += 1) {
      var layer = comp.layer(layerIndexes[i]);
      if (!layer || layer.locked) {
        return false;
      }
      indexMap[layer.index] = true;
    }

    for (var p = 0; p < layerIndexes.length; p += 1) {
      var checkedLayer = comp.layer(layerIndexes[p]);
      if (hasUnsafeExpressionDependency(comp, checkedLayer, indexMap)) {
        return false;
      }
    }

    if (layerUsesTrackMatte(textLayer) && layerIndexes.length < 2) {
      return false;
    }

    return true;
  }

  function collectAndRemoveFillEffects(comp, layerIndexes) {
    var snapshots = [];

    for (var i = 0; i < layerIndexes.length; i += 1) {
      var layer = comp.layer(layerIndexes[i]);
      if (!isTextLayer(layer)) {
        continue;
      }

      var effects = layer.property("ADBE Effect Parade");
      if (!effects) {
        continue;
      }

      var layerSnapshot = {
        layerIndex: layer.index,
        layerName: layer.name,
        effects: []
      };

      for (var e = effects.numProperties; e >= 1; e -= 1) {
        var effect = effects.property(e);
        try {
          if (isFillEffect(effect)) {
            layerSnapshot.effects.unshift(snapshotEffect(effect));
            effect.remove();
          }
        } catch (error) {
          // If Fill cannot be moved safely, leave it inside rather than skipping all text extraction.
        }
      }

      if (layerSnapshot.effects.length > 0) {
        snapshots.push(layerSnapshot);
      }
    }

    return snapshots;
  }

  function applyFillEffectsToLayer(layer, snapshots) {
    if (!layer || snapshots.length === 0) {
      return;
    }

    var effects = layer.property("ADBE Effect Parade");
    if (!effects) {
      return;
    }

    for (var i = 0; i < snapshots.length; i += 1) {
      for (var e = 0; e < snapshots[i].effects.length; e += 1) {
        addEffectSnapshot(effects, snapshots[i].effects[e]);
      }
    }
  }

  function restoreFillEffectsToOriginalLayers(comp, snapshots) {
    for (var i = 0; i < snapshots.length; i += 1) {
      var layer = null;
      try {
        layer = comp.layer(snapshots[i].layerIndex);
      } catch (error) {
        layer = getLayerByName(comp, snapshots[i].layerName);
      }

      if (!layer) {
        continue;
      }

      var effects = layer.property("ADBE Effect Parade");
      if (!effects) {
        continue;
      }

      for (var e = 0; e < snapshots[i].effects.length; e += 1) {
        addEffectSnapshot(effects, snapshots[i].effects[e]);
      }
    }
  }

  function isFillEffect(effect) {
    if (!effect) {
      return false;
    }

    var matchName = String(effect.matchName || "").toLowerCase();
    var displayName = String(effect.name || "").toLowerCase();
    return matchName === "adbe fill" || displayName === "fill";
  }

  function snapshotEffect(effect) {
    var snapshot = {
      matchName: effect.matchName,
      name: effect.name,
      enabled: true,
      children: []
    };

    try {
      snapshot.enabled = effect.enabled;
    } catch (error) {
      snapshot.enabled = true;
    }

    snapshot.children = snapshotPropertyGroup(effect);
    return snapshot;
  }

  function snapshotPropertyGroup(group) {
    var children = [];
    if (!group || !group.numProperties) {
      return children;
    }

    for (var i = 1; i <= group.numProperties; i += 1) {
      var property = group.property(i);
      var child = {
        matchName: property.matchName,
        name: property.name,
        value: null,
        hasValue: false,
        keys: [],
        children: []
      };

      try {
        if (property.propertyValueType !== PropertyValueType.NO_VALUE) {
          child.value = property.value;
          child.hasValue = true;

          if (property.numKeys && property.numKeys > 0) {
            for (var k = 1; k <= property.numKeys; k += 1) {
              child.keys.push({
                time: property.keyTime(k),
                value: property.keyValue(k)
              });
            }
          }
        }
      } catch (error) {
        child.hasValue = false;
      }

      child.children = snapshotPropertyGroup(property);
      children.push(child);
    }

    return children;
  }

  function addEffectSnapshot(effects, snapshot) {
    var effect = null;
    try {
      effect = effects.addProperty(snapshot.matchName || "ADBE Fill");
    } catch (error) {
      try {
        effect = effects.addProperty("ADBE Fill");
      } catch (innerError) {
        return null;
      }
    }

    try {
      effect.name = snapshot.name;
      effect.enabled = snapshot.enabled;
    } catch (nameError) {
      // Ignore read-only fields.
    }

    applyPropertySnapshots(effect, snapshot.children);
    return effect;
  }

  function applyPropertySnapshots(group, children) {
    if (!group || !children) {
      return;
    }

    for (var i = 0; i < children.length; i += 1) {
      var snapshot = children[i];
      var property = getChildProperty(group, snapshot.matchName, snapshot.name, i + 1);
      if (!property) {
        continue;
      }

      try {
        if (snapshot.hasValue) {
          if (snapshot.keys && snapshot.keys.length > 0) {
            for (var k = 0; k < snapshot.keys.length; k += 1) {
              property.setValueAtTime(snapshot.keys[k].time, snapshot.keys[k].value);
            }
          } else {
            property.setValue(snapshot.value);
          }
        }
      } catch (error) {
        // Some plugin/effect properties reject values in different contexts.
      }

      applyPropertySnapshots(property, snapshot.children);
    }
  }

  function getChildProperty(group, matchName, name, fallbackIndex) {
    var property = null;

    try {
      property = group.property(matchName);
    } catch (error) {
      property = null;
    }

    if (!property) {
      try {
        property = group.property(name);
      } catch (nameError) {
        property = null;
      }
    }

    if (!property) {
      try {
        property = group.property(fallbackIndex);
      } catch (indexError) {
        property = null;
      }
    }

    return property;
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

  function hasUnsafeExpressionDependency(comp, layer, includedIndexes) {
    var expressions = [];
    collectExpressions(layer, expressions);

    for (var i = 0; i < expressions.length; i += 1) {
      var expression = expressions[i];
      if (/\bcomp\s*\(/.test(expression) || /\bthisComp\b/.test(expression) || /\btoComp\s*\(/.test(expression) || /\bfromComp\s*\(/.test(expression)) {
        var names = extractLayerNamesFromExpression(expression);
        for (var n = 0; n < names.length; n += 1) {
          var referencedLayer = getLayerByName(comp, names[n]);
          if (!referencedLayer || !includedIndexes[referencedLayer.index]) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function collectExpressions(propertyGroup, output) {
    if (!propertyGroup || !propertyGroup.numProperties) {
      return;
    }

    for (var i = 1; i <= propertyGroup.numProperties; i += 1) {
      var property = propertyGroup.property(i);
      if (!property) {
        continue;
      }

      try {
        if (property.canSetExpression && property.expressionEnabled && property.expression) {
          output.push(property.expression);
        }
      } catch (error) {
        // Some plugin properties throw when expression fields are queried.
      }

      collectExpressions(property, output);
    }
  }

  function extractLayerNamesFromExpression(expression) {
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

  function layersOverlapInTime(first, second) {
    return first.inPoint < second.outPoint && second.inPoint < first.outPoint;
  }

  function isShapeLayer(layer) {
    return layer && layer.property("ADBE Root Vectors Group") !== null;
  }

  function detectVisibleLayerGroupTiming(comp, layerIndexes, fallbackTiming) {
    var start = fallbackTiming.inPoint;
    var end = fallbackTiming.outPoint;
    var duration = Math.max(end - start, MIN_DURATION);
    var samples = Math.max(6, Math.min(30, Math.ceil(duration / Math.max(comp.frameDuration, MIN_DURATION))));
    var firstVisible = null;
    var lastVisible = null;
    var bestSampleTime = start;
    var bestArea = 0;

    for (var i = 0; i <= samples; i += 1) {
      var time = start + duration * (i / samples);
      var bounds = getLayerGroupBoundsInComp(comp, layerIndexes, time, 0);
      var opacity = getLayerGroupOpacityAtTime(comp, layerIndexes, time);
      var area = bounds ? Math.max(0, bounds.right - bounds.left) * Math.max(0, bounds.bottom - bounds.top) * (opacity / 100) : 0;

      if (bounds && opacity > 1 && area > 1) {
        if (firstVisible === null) {
          firstVisible = time;
        }
        lastVisible = time;

        if (area >= bestArea) {
          bestArea = area;
          bestSampleTime = time;
        }
      }
    }

    if (firstVisible === null || lastVisible === null) {
      return {
        inPoint: start,
        outPoint: end,
        sampleTime: start + duration / 2
      };
    }

    var margin = Math.max(comp.frameDuration * 2, MIN_DURATION);
    return {
      inPoint: Math.max(start, firstVisible - margin),
      outPoint: Math.min(end, lastVisible + margin),
      sampleTime: bestSampleTime
    };
  }

  function getLayerGroupOpacityAtTime(comp, layerIndexes, time) {
    var maxOpacity = 0;

    for (var i = 0; i < layerIndexes.length; i += 1) {
      var layer = comp.layer(layerIndexes[i]);
      if (!isTextLayer(layer)) {
        continue;
      }

      var opacity = getTransformValueAtTime(layer.property("ADBE Transform Group").property("ADBE Opacity"), time, 100);
      maxOpacity = Math.max(maxOpacity, opacity);
    }

    return maxOpacity;
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

  function fixEditableTextContent(comp, visited) {
    if (!comp || visited[comp.id]) {
      return;
    }
    visited[comp.id] = true;

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (isVisibleTextLayer(layer)) {
        replaceTextLayerContent(layer);
      }

      if (layer.source instanceof CompItem) {
        fixEditableTextContent(layer.source, visited);
      }
    }
  }

  function replaceTextLayerContent(layer) {
    var sourceText = layer.property("ADBE Text Properties").property("ADBE Text Document");
    if (!sourceText) {
      return;
    }

    try {
      if (sourceText.numKeys && sourceText.numKeys > 0) {
        for (var i = 1; i <= sourceText.numKeys; i += 1) {
          var keyedDocument = sourceText.keyValue(i);
          var keyedText = keyedDocument.text;
          var keyedCleanText = cleanTextContent(keyedText);

          if (keyedCleanText !== keyedText) {
            keyedDocument.text = keyedCleanText;
            sourceText.setValueAtKey(i, keyedDocument);
          }
        }
      } else {
        var textDocument = sourceText.value;
        var originalText = textDocument.text;
        var newText = cleanTextContent(originalText);

        if (newText !== originalText) {
          textDocument.text = newText;
          sourceText.setValue(textDocument);
        }
      }
    } catch (error) {
      // TextDocument can fail on unusual animated source-text setups; leave it untouched.
    }
  }

  function cleanTextContent(text) {
    var cleaned = String(text || "");
    var marketplaceNames = [
      "Envato",
      "VideoHive",
      "MotionArray",
      "Motion Array",
      "Adobe Stock",
      "Shutterstock"
    ];

    for (var i = 0; i < marketplaceNames.length; i += 1) {
      cleaned = cleaned.replace(new RegExp("\\b" + escapeRegExp(marketplaceNames[i]) + "\\b", "gi"), "Website Name");
    }

    var spellingFixes = {
      "welcom": "welcome",
      "wellcome": "welcome",
      "bussiness": "business",
      "busines": "business",
      "profesional": "professional",
      "proffesional": "professional",
      "introdution": "introduction",
      "introducton": "introduction",
      "portofolio": "portfolio",
      "porfolio": "portfolio",
      "templete": "template",
      "tempalte": "template",
      "servise": "service",
      "serivce": "service"
    };

    for (var wrong in spellingFixes) {
      if (spellingFixes.hasOwnProperty(wrong)) {
        cleaned = cleaned.replace(new RegExp("\\b" + wrong + "\\b", "gi"), spellingFixes[wrong]);
      }
    }

    return cleaned;
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isMediaItem(item) {
    if (!(item instanceof CompItem)) {
      return false;
    }

    if (item instanceof CompItem && isSceneLikeComp(item)) {
      return false;
    }

    if (hasKeyword(item.name, ["media", "photo", "image", "video", "placeholder", "replace"])) {
      return isFinalUsableMediaComp(item);
    }

    if (item instanceof CompItem) {
      return isFinalUsableMediaComp(item);
    }

    return false;
  }

  function organizeLeafMediaForScene(sceneComp, sceneLabel, mediaFolder, generatedMediaComps) {
    var mediaComps = collectLeafMediaComps(sceneComp, {});
    mediaComps.sort(sortItemsByName);

    for (var i = 0; i < mediaComps.length; i += 1) {
      var mediaComp = mediaComps[i];
      if (itemInArray(generatedMediaComps, mediaComp)) {
        continue;
      }

      mediaComp.name = "Media " + sceneLabel + "." + padNumber(i + 1, 1);
      mediaComp.parentFolder = mediaFolder;
      generatedMediaComps.push(mediaComp);
    }
  }

  function collectLeafMediaComps(comp, visited) {
    var result = [];
    if (!comp || visited[comp.id]) {
      return result;
    }
    visited[comp.id] = true;

    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (!(layer.source instanceof CompItem)) {
        continue;
      }

      var childComp = layer.source;
      var childMedia = collectLeafMediaComps(childComp, visited);
      result = result.concat(childMedia);

      if (isFinalUsableMediaComp(childComp) && childMedia.length === 0) {
        result.push(childComp);
      }
    }

    return uniqueItems(result);
  }

  function isFinalUsableMediaComp(comp) {
    if (!(comp instanceof CompItem) || isSceneLikeComp(comp) || compContainsText(comp, {}) || compHasSceneLayer(comp)) {
      return false;
    }

    if (compHasNamedLayer(comp, ["controller", "control", "settings", "null", "helper", "utility", "temp"])) {
      return false;
    }

    if (compHasNestedMediaComp(comp)) {
      return false;
    }

    return hasKeyword(comp.name, ["media", "photo", "image", "video", "placeholder", "replace"]) || compHasReplaceableFootage(comp);
  }

  function compHasNestedMediaComp(comp) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      if (layer.source instanceof CompItem && hasKeyword(layer.source.name, ["media", "photo", "image", "video", "placeholder", "replace"])) {
        return true;
      }
    }

    return false;
  }

  function compHasReplaceableFootage(comp) {
    for (var i = 1; i <= comp.numLayers; i += 1) {
      var layer = comp.layer(i);
      var sourceName = layer.source ? layer.source.name : "";
      if (!(layer.source instanceof CompItem) && hasKeyword(layer.name + " " + sourceName, ["media", "photo", "image", "video", "placeholder", "replace", "your media"])) {
        return true;
      }
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

  function looksLikeFinalOrMainComp(comp) {
    return comp instanceof CompItem && hasKeyword(comp.name, ["final", "main", "master", "render"]);
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

  function sortLayersByTimeline(a, b) {
    if (a.inPoint !== b.inPoint) {
      return a.inPoint - b.inPoint;
    }

    return a.index - b.index;
  }

  function sortItemsByName(a, b) {
    var nameA = normalizeName(a.name);
    var nameB = normalizeName(b.name);
    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
    return 0;
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

  function itemInArray(items, item) {
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] === item) {
        return true;
      }
    }

    return false;
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

  function removeEmptyFolders(parentFolder) {
    var changed = true;

    while (changed) {
      changed = false;
      for (var i = app.project.numItems; i >= 1; i -= 1) {
        var item = app.project.item(i);
        if (item instanceof FolderItem && item !== parentFolder && !isProtectedTemplateFolderName(item.name) && isFolderEmpty(item)) {
          try {
            item.remove();
            changed = true;
          } catch (error) {
            // Keep folders AE refuses to remove.
          }
        }
      }
    }
  }

  function isProtectedTemplateFolderName(name) {
    return name === EDIT_FOLDER_NAME || name === FINAL_FOLDER_NAME || name === OTHERS_FOLDER_NAME || name === MEDIA_FOLDER_NAME || name === TEXT_FOLDER_NAME;
  }
})();
