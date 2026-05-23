/*
  Glitch_Typography_Animation.jsx

  After Effects usage:
  File > Scripts > Run Script File... and choose this file.

  Creates a 4K dark cinematic glitch typography animation with:
  - pure black background
  - kinetic typing/deleting title
  - blinking cursor
  - RGB split duplicate text layers
  - scanline/VHS noise overlays
  - horizontal glitch streaks
  - subtle particles and film grain
*/
(function createGlitchTypographyAnimation() {
  var WIDTH = 3840;
  var HEIGHT = 2160;
  var FPS = 30;
  var DURATION = 10;
  var COMP_NAME = "Glitch Typography Animation";
  var title = prompt("Title text:", "DIGITAL SIGNAL");

  if (title === null) {
    return;
  }

  title = String(title).replace(/^\s+|\s+$/g, "");
  if (title === "") {
    title = "DIGITAL SIGNAL";
  }

  app.beginUndoGroup("Create Glitch Typography Animation");

  try {
    var comp = app.project.items.addComp(COMP_NAME, WIDTH, HEIGHT, 1, DURATION, FPS);
    comp.openInViewer();

    var bg = comp.layers.addSolid([0, 0, 0], "Pure Black Background", WIDTH, HEIGHT, 1, DURATION);
    bg.locked = true;

    addFilmGrain(comp);
    addScanlines(comp);
    addParticles(comp);
    addGlitchStreaks(comp);

    var mainText = addMainTitle(comp, title);
    addRgbSplitText(comp, mainText);
    addCursor(comp);
    addLightPulse(comp);
    addAdjustmentGlitch(comp);

    alert("Glitch typography animation yaratildi:\n" + COMP_NAME);
  } catch (error) {
    alert("Script xatosi: " + error.toString());
  } finally {
    app.endUndoGroup();
  }

  function addMainTitle(comp, textValue) {
    var layer = comp.layers.addText(textValue);
    layer.name = "MAIN_TITLE_TYPE";
    layer.startTime = 0;
    layer.inPoint = 0;
    layer.outPoint = DURATION;

    var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = textProp.value;
    doc.text = textValue;
    doc.font = "Arial-BoldMT";
    doc.fontSize = 190;
    doc.fillColor = [1, 1, 1];
    doc.justification = ParagraphJustification.CENTER_JUSTIFY;
    doc.tracking = 45;
    textProp.setValue(doc);

    var transform = layer.property("ADBE Transform Group");
    transform.property("ADBE Position").setValue([WIDTH / 2, HEIGHT / 2]);
    transform.property("ADBE Scale").setValue([100, 100]);
    transform.property("ADBE Opacity").setValue(100);

    textProp.expression = typingExpression(textValue);
    transform.property("ADBE Position").expression =
      "base = [" + WIDTH / 2 + "," + HEIGHT / 2 + "];\n" +
      "j = (random() < 0.08) ? [random(-16,16), random(-8,8)] : [0,0];\n" +
      "base + j;";

    addSafeEffect(layer, "ADBE Drop Shadow", "Soft Shadow");
    return layer;
  }

  function addRgbSplitText(comp, sourceLayer) {
    var red = duplicateTextLayer(comp, sourceLayer, "RGB_SPLIT_RED", [1, 0.03, 0.02], [-10, 0]);
    var blue = duplicateTextLayer(comp, sourceLayer, "RGB_SPLIT_BLUE", [0.02, 0.25, 1], [10, 0]);
    red.blendingMode = BlendingMode.ADD;
    blue.blendingMode = BlendingMode.ADD;
  }

  function duplicateTextLayer(comp, sourceLayer, name, color, offset) {
    var layer = sourceLayer.duplicate();
    layer.name = name;
    layer.moveBefore(sourceLayer);

    var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = textProp.value;
    doc.fillColor = color;
    textProp.setValue(doc);
    textProp.expression = 'thisComp.layer("MAIN_TITLE_TYPE").text.sourceText';

    var transform = layer.property("ADBE Transform Group");
    transform.property("ADBE Opacity").setValue(30);
    transform.property("ADBE Opacity").expression =
      "seedRandom(index + Math.floor(time*12), true);\n" +
      "random() < 0.22 ? random(18,55) : 0;";
    transform.property("ADBE Position").expression =
      "p = thisComp.layer('MAIN_TITLE_TYPE').transform.position;\n" +
      "seedRandom(index + Math.floor(time*18), true);\n" +
      "p + [" + offset[0] + "," + offset[1] + "] + (random() < .35 ? [random(-26,26), random(-8,8)] : [0,0]);";

    return layer;
  }

  function addCursor(comp) {
    var layer = comp.layers.addText("|");
    layer.name = "BLINKING_MOUSE_CURSOR";
    layer.inPoint = 0;
    layer.outPoint = DURATION;

    var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = textProp.value;
    doc.text = "|";
    doc.font = "Arial-BoldMT";
    doc.fontSize = 190;
    doc.fillColor = [1, 1, 1];
    doc.justification = ParagraphJustification.LEFT_JUSTIFY;
    textProp.setValue(doc);

    var transform = layer.property("ADBE Transform Group");
    transform.property("ADBE Position").setValue([WIDTH / 2 + 650, HEIGHT / 2]);
    transform.property("ADBE Position").expression =
      "t = time;\n" +
      "x = ease(t, 0.25, 2.4, " + (WIDTH / 2 - 500) + ", " + (WIDTH / 2 + 680) + ");\n" +
      "if (t > 3.2 && t < 4.4) x = ease(t, 3.2, 4.4, " + (WIDTH / 2 + 680) + ", " + (WIDTH / 2 + 220) + ");\n" +
      "if (t >= 4.4) x = ease(t, 4.4, 6.4, " + (WIDTH / 2 + 220) + ", " + (WIDTH / 2 + 680) + ");\n" +
      "[x, " + HEIGHT / 2 + "];";
    transform.property("ADBE Opacity").expression = "(Math.floor(time*4)%2==0) ? 100 : 0;";
  }

  function addFilmGrain(comp) {
    var solid = comp.layers.addSolid([0.5, 0.5, 0.5], "Soft Film Grain Noise", WIDTH, HEIGHT, 1, DURATION);
    solid.blendingMode = BlendingMode.OVERLAY;
    solid.property("ADBE Transform Group").property("ADBE Opacity").setValue(14);

    addSafeEffect(solid, "ADBE Fractal Noise", "Animated Grain");
    var effects = solid.property("ADBE Effect Parade");
    if (effects && effects.numProperties > 0) {
      var fractal = effects.property(effects.numProperties);
      setEffectValue(fractal, "ADBE Fractal Noise-0002", 115);
      setEffectValue(fractal, "ADBE Fractal Noise-0003", 65);
      try {
        fractal.property("ADBE Fractal Noise-0007").expression = "time*900";
      } catch (error) {
        // Ignore effect property differences between AE versions.
      }
    }
  }

  function addScanlines(comp) {
    var lineHeight = 3;
    var spacing = 34;
    var count = Math.floor(HEIGHT / spacing);

    for (var i = 0; i < count; i += 1) {
      var line = comp.layers.addSolid([1, 1, 1], "Scanline " + pad(i + 1, 2), WIDTH, lineHeight, 1, DURATION);
      line.property("ADBE Transform Group").property("ADBE Position").setValue([WIDTH / 2, i * spacing]);
      line.property("ADBE Transform Group").property("ADBE Opacity").setValue(5);
      line.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "seedRandom(index + Math.floor(time*8), true); random(2,8);";
      line.blendingMode = BlendingMode.ADD;
    }
  }

  function addParticles(comp) {
    for (var i = 0; i < 55; i += 1) {
      var size = randomBetween(3, 10);
      var particle = comp.layers.addSolid([1, 1, 1], "Floating Particle " + pad(i + 1, 2), size, size, 1, DURATION);
      particle.property("ADBE Transform Group").property("ADBE Position").setValue([
        randomBetween(WIDTH * 0.08, WIDTH * 0.92),
        randomBetween(HEIGHT * 0.15, HEIGHT * 0.85)
      ]);
      particle.property("ADBE Transform Group").property("ADBE Opacity").setValue(randomBetween(8, 22));
      particle.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "seedRandom(index, true); base=random(4,22); base + Math.sin(time*random(0.8,2.2)+random(0,6))*8;";
      particle.blendingMode = BlendingMode.ADD;
      addSafeEffect(particle, "ADBE Gaussian Blur 2", "Particle Blur");
    }
  }

  function addGlitchStreaks(comp) {
    var colors = [
      [1, 1, 1],
      [0.1, 0.35, 1],
      [1, 0.05, 0.04]
    ];

    for (var i = 0; i < 18; i += 1) {
      var height = randomBetween(10, 38);
      var streak = comp.layers.addSolid(colors[i % colors.length], "Horizontal Glitch Streak " + pad(i + 1, 2), randomBetween(500, 1800), height, 1, DURATION);
      streak.property("ADBE Transform Group").property("ADBE Position").setValue([
        randomBetween(WIDTH * 0.2, WIDTH * 0.8),
        randomBetween(HEIGHT * 0.25, HEIGHT * 0.75)
      ]);
      streak.property("ADBE Transform Group").property("ADBE Opacity").setValue(0);
      streak.property("ADBE Transform Group").property("ADBE Opacity").expression =
        "seedRandom(index + Math.floor(time*16), true);\n" +
        "random() < 0.18 ? random(25,85) : 0;";
      streak.property("ADBE Transform Group").property("ADBE Position").expression =
        "p = value; seedRandom(index + Math.floor(time*14), true); p + [random(-220,220), random(-18,18)];";
      streak.blendingMode = BlendingMode.ADD;
    }
  }

  function addLightPulse(comp) {
    var pulse = comp.layers.addSolid([1, 1, 1], "Flickering White Light Pulse", WIDTH, HEIGHT, 1, DURATION);
    pulse.blendingMode = BlendingMode.ADD;
    pulse.property("ADBE Transform Group").property("ADBE Opacity").setValue(0);
    pulse.property("ADBE Transform Group").property("ADBE Opacity").expression =
      "seedRandom(Math.floor(time*10), true); random() < 0.08 ? random(4,16) : 0;";
  }

  function addAdjustmentGlitch(comp) {
    var adjustment = comp.layers.addSolid([1, 1, 1], "Global Digital Distortion Adjustment", WIDTH, HEIGHT, 1, DURATION);
    adjustment.adjustmentLayer = true;
    adjustment.property("ADBE Transform Group").property("ADBE Opacity").setValue(100);

    addSafeEffect(adjustment, "ADBE Turbulent Displace", "Subtle VHS Distortion");
    addSafeEffect(adjustment, "ADBE Chromatic Aberration", "Chromatic Aberration");
  }

  function typingExpression(textValue) {
    var safeText = escapeForExpression(textValue);
    return (
      'full = "' + safeText + '";\n' +
      "t = time;\n" +
      "n = full.length;\n" +
      "if (t < 0.35) {\n" +
      "  out = '';\n" +
      "} else if (t < 2.4) {\n" +
      "  out = full.substr(0, Math.floor(ease(t, .35, 2.4, 0, n)));\n" +
      "} else if (t < 3.2) {\n" +
      "  out = full;\n" +
      "} else if (t < 4.4) {\n" +
      "  out = full.substr(0, Math.floor(ease(t, 3.2, 4.4, n, Math.max(4, n-5))));\n" +
      "} else if (t < 6.4) {\n" +
      "  out = full.substr(0, Math.floor(ease(t, 4.4, 6.4, Math.max(4, n-5), n)));\n" +
      "} else {\n" +
      "  out = full;\n" +
      "}\n" +
      "if (Math.floor(time*18)%17==0 && out.length>2) out = out.substr(0,out.length-1);\n" +
      "out;"
    );
  }

  function addSafeEffect(layer, matchName, name) {
    try {
      var effect = layer.property("ADBE Effect Parade").addProperty(matchName);
      if (name) {
        effect.name = name;
      }
      return effect;
    } catch (error) {
      return null;
    }
  }

  function setEffectValue(effect, matchName, value) {
    if (!effect) {
      return;
    }

    try {
      effect.property(matchName).setValue(value);
    } catch (error) {
      // Ignore unavailable effect controls.
    }
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pad(number, width) {
    var text = String(number);
    while (text.length < width) {
      text = "0" + text;
    }
    return text;
  }

  function escapeForExpression(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\r");
  }
})();
