/* ============================================
   Configurateur Potager en Parpaings
   Blocs standard 50x20x25 uniquement
   ============================================ */

(function () {
  'use strict';

  // Parpaing: 50 cm long, 20 cm haut, 25 cm large (epaisseur mur)
  const THICKNESS = 25;
  const MAX_LENGTH = 800;
  const MIN_LENGTH = 90;
  const MAX_WIDTH = 200;
  const MIN_WIDTH = 60;

  // Sous-enduit exterieur: 1.8 kg/m2 par mm d'epaisseur, application ~5 mm
  const ENDUIT_KG_PER_M2 = 1.8 * 5; // = 9 kg/m2

  const state = {
    shape: 'rect',
    mode: 'libre',
    rows: 2,
    length: 200,
    width: 100,
    activeRang: 1
  };

  const PRICES = {
    blocStd: 1,
    mortarBag: 5,
    enduitBag: 10,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const lengthSlider = $('#length-slider');
  const widthSlider = $('#width-slider');
  const lengthValue = $('#length-value');
  const widthValue = $('#width-value');
  const lengthBadge = $('#length-badge');
  const widthBadge = $('#width-badge');
  const widthGroup = $('#width-group');

  // --- Decomposition ---
  function canDecomposeExact(len) {
    return len > 0 && len % 50 === 0;
  }

  function decompose(len) {
    const n50 = Math.floor(len / 50);
    const remainder = len - n50 * 50;
    if (remainder === 0) {
      return { std: n50, cuts: 0, cutLength: 0 };
    }
    return { std: n50, cuts: 1, cutLength: remainder };
  }

  function isZeroCutForMode(L, W, mode) {
    const T = THICKNESS;
    const ewEntreLen = mode === 'adosse' ? W - T : W - 2 * T;
    return canDecomposeExact(L) && canDecomposeExact(W) &&
           canDecomposeExact(L - 2 * T) && canDecomposeExact(ewEntreLen);
  }

  function nearestZeroCut(val, min, max) {
    const lower = Math.floor(val / 50) * 50;
    const upper = lower + 50;
    const bestLower = lower >= min ? lower : upper;
    const bestUpper = upper <= max ? upper : lower;
    if (Math.abs(val - bestLower) <= Math.abs(val - bestUpper)) return bestLower;
    return bestUpper;
  }

  function optimizeZeroCut() {
    let bestL = state.length, bestW = state.width;
    let bestDist = Infinity;
    const isSquare = state.shape === 'square';

    for (let l = MIN_LENGTH; l <= MAX_LENGTH; l += 5) {
      const wMin = isSquare ? l : MIN_WIDTH;
      const wMax = isSquare ? l : MAX_WIDTH;
      for (let w = wMin; w <= wMax; w += 5) {
        if (isZeroCutForMode(l, w, state.mode)) {
          const dist = Math.abs(l - state.length) + Math.abs(w - (isSquare ? state.length : state.width));
          if (dist < bestDist) {
            bestDist = dist;
            bestL = l;
            bestW = w;
          }
        }
      }
    }

    state.length = bestL;
    state.width = isSquare ? bestL : bestW;
    lengthSlider.value = state.length;
    if (!isSquare) widthSlider.value = state.width;
    update();
  }

  // --- Presets ---
  const PRESETS = [
    { l: 150, w: 150, shape: 'square', mode: 'libre', label: 'Carre 150&times;150 (0 coupe)' },
    { l: 200, w: 100, shape: 'rect', mode: 'libre', label: 'Petit bac 200&times;100 (0 coupe)' },
    { l: 300, w: 100, shape: 'rect', mode: 'libre', label: 'Moyen 300&times;100 (0 coupe)' },
    { l: 400, w: 150, shape: 'rect', mode: 'libre', label: 'Grand bac 400&times;150 (0 coupe)' },
  ];

  function initPresets() {
    const container = $('#preset-buttons');
    for (const p of PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.innerHTML = p.label;
      btn.addEventListener('click', () => {
        state.length = p.l;
        state.width = p.w;
        state.shape = p.shape;
        state.mode = p.mode;
        lengthSlider.value = state.length;
        widthSlider.value = state.width;
        setButtonGroup('shape', state.shape);
        setButtonGroup('mode', state.mode);
        update();
      });
      container.appendChild(btn);
    }
  }

  // --- Wall computation ---
  function computeRang(rangNum, L, W, mode) {
    const T = THICKNESS;
    const isOdd = rangNum % 2 === 1;
    const walls = [];

    if (isOdd) {
      if (mode !== 'adosse') {
        walls.push({ side: 'north', length: L, blocks: decompose(L), dominant: true });
      }
      walls.push({ side: 'south', length: L, blocks: decompose(L), dominant: true });
      const ewLen = mode === 'adosse' ? W - T : W - 2 * T;
      walls.push({ side: 'east', length: ewLen, blocks: decompose(ewLen), dominant: false });
      walls.push({ side: 'west', length: ewLen, blocks: decompose(ewLen), dominant: false });
    } else {
      walls.push({ side: 'east', length: W, blocks: decompose(W), dominant: true });
      walls.push({ side: 'west', length: W, blocks: decompose(W), dominant: true });
      if (mode !== 'adosse') {
        walls.push({ side: 'north', length: L - 2 * T, blocks: decompose(L - 2 * T), dominant: false });
      }
      walls.push({ side: 'south', length: L - 2 * T, blocks: decompose(L - 2 * T), dominant: false });
    }

    return walls;
  }

  function computeTotals() {
    const L = state.length;
    const W = state.shape === 'square' ? L : state.width;
    const T = THICKNESS;
    const numRangs = state.rows;

    let totalStd = 0, totalCuts = 0;
    const cutDetails = [];
    const allRangs = [];

    for (let r = 1; r <= numRangs; r++) {
      const walls = computeRang(r, L, W, state.mode);
      allRangs.push(walls);
      for (const w of walls) {
        totalStd += w.blocks.std;
        totalCuts += w.blocks.cuts;
        if (w.blocks.cuts > 0) {
          cutDetails.push({ side: w.side, rang: r, cutLength: w.blocks.cutLength });
        }
      }
    }

    const intL = L - 2 * T;
    let intW = W - 2 * T;
    if (state.mode === 'adosse') {
      intW = W - T;
    }

    const heightUseful = numRangs * 20 - 5;
    const surfaceCultivable = (intL * intW) / 10000;
    const volumeTerre = surfaceCultivable * (heightUseful / 100);
    const volumeLitres = volumeTerre * 1000;

    // Sous-enduit ext.: exterieur uniquement, 1.8 kg/m2/mm, ~2mm
    const perimeterExt = state.mode === 'adosse' ? (L + 2 * W) / 100 : (2 * (L + W)) / 100;
    const hm = (numRangs * 20) / 100;
    const surfaceExt = perimeterExt * hm;
    const enduitKg = surfaceExt * ENDUIT_KG_PER_M2;
    const enduitBags = Math.ceil(enduitKg / 25);

    // Mortier: ~1 cm joints. ~3.5 kg par bloc (horizontal + vertical)
    // Sac de 25 kg → ~7 blocs par sac
    const totalBlocks = totalStd + totalCuts;
    const mortarBags = Math.ceil(totalBlocks / 7);

    const budget = {
      blocs: (totalStd + totalCuts + 2) * PRICES.blocStd,
      mortar: mortarBags * PRICES.mortarBag,
      parmurex: enduitBags * PRICES.enduitBag,
    };
    budget.total = Object.values(budget).reduce((a, b) => a + b, 0);

    return {
      L, W, T, intL, intW, heightUseful, surfaceCultivable, volumeTerre, volumeLitres,
      totalStd, totalCuts, cutDetails,
      mortarBags, enduitKg, enduitBags, surfaceExt,
      budget, allRangs
    };
  }

  // --- SVG ---
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createSVGElement(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  function generateSVG(rangNum, data) {
    const { L, W, T } = data;
    const walls = data.allRangs[rangNum - 1];

    const scale = Math.min(1.2, 500 / Math.max(L, W));
    const margin = 60;

    const adosseExtra = state.mode === 'adosse' ? T * scale + 20 : 0;
    const svgW = L * scale + margin * 2;
    const svgH = W * scale + margin * 2 + adosseExtra;

    const svg = createSVGElement('svg', {
      width: svgW, height: svgH,
      viewBox: `0 0 ${svgW} ${svgH}`,
      xmlns: SVG_NS
    });

    svg.appendChild(createSVGElement('rect', {
      x: 0, y: 0, width: svgW, height: svgH,
      fill: '#1e1e1e', rx: 6
    }));

    const ox = margin;
    const oy = margin + adosseExtra;

    // Earth fill
    const earthX = ox + T * scale;
    const earthW = (L - 2 * T) * scale;
    let earthY, earthH;
    if (state.mode === 'adosse') {
      earthY = oy;
      earthH = (W - T) * scale;
    } else {
      earthY = oy + T * scale;
      earthH = (W - 2 * T) * scale;
    }
    svg.appendChild(createSVGElement('rect', {
      x: earthX, y: earthY,
      width: earthW, height: earthH,
      fill: '#2d4a2d', stroke: '#3d5a3d', 'stroke-width': 1
    }));

    // Adosse hatching
    if (state.mode === 'adosse') {
      const defs = createSVGElement('defs', {});
      const pattern = createSVGElement('pattern', {
        id: `hatch-${rangNum}`, width: 8, height: 8,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)'
      });
      pattern.appendChild(createSVGElement('line', {
        x1: 0, y1: 0, x2: 0, y2: 8,
        stroke: '#666', 'stroke-width': 1.5
      }));
      defs.appendChild(pattern);
      svg.appendChild(defs);

      svg.appendChild(createSVGElement('rect', {
        x: ox, y: oy - T * scale,
        width: L * scale, height: T * scale,
        fill: `url(#hatch-${rangNum})`, stroke: '#666', 'stroke-width': 1
      }));

      const txt = createSVGElement('text', {
        x: ox + L * scale / 2, y: oy - T * scale / 2 + 4,
        'text-anchor': 'middle', fill: '#888',
        'font-size': '10', 'font-family': 'Outfit, sans-serif'
      });
      txt.textContent = 'Mur existant';
      svg.appendChild(txt);
    }

    for (const wall of walls) {
      drawWall(svg, wall, ox, oy, L, W, T, scale);
    }

    drawDimensions(svg, ox, oy, L, W, T, scale, data);

    return svg;
  }

  function drawWall(svg, wall, ox, oy, L, W, T, scale) {
    const blocks = wall.blocks;
    const blockList = [];
    for (let i = 0; i < blocks.std; i++) blockList.push({ type: 'std', len: 50 });
    if (blocks.cuts > 0) blockList.push({ type: 'cut', len: blocks.cutLength });

    let x, y, dirX, dirY, bWidth, bHeight;

    switch (wall.side) {
      case 'north':
        x = wall.dominant ? ox : ox + T * scale;
        y = oy;
        dirX = 1; dirY = 0;
        bHeight = T * scale;
        break;
      case 'south':
        x = wall.dominant ? ox : ox + T * scale;
        y = oy + (W - T) * scale;
        dirX = 1; dirY = 0;
        bHeight = T * scale;
        break;
      case 'west':
        x = ox;
        y = wall.dominant ? oy : (state.mode === 'adosse' ? oy : oy + T * scale);
        dirX = 0; dirY = 1;
        bWidth = T * scale;
        break;
      case 'east':
        x = ox + (L - T) * scale;
        y = wall.dominant ? oy : (state.mode === 'adosse' ? oy : oy + T * scale);
        dirX = 0; dirY = 1;
        bWidth = T * scale;
        break;
    }

    let cx = x, cy = y;
    for (const block of blockList) {
      const fill = block.type === 'std' ? '#5a7088' : '#9a5a8a';
      const strokeColor = block.type === 'std' ? '#4a6078' : '#7a4a6a';

      let rw, rh;
      if (dirX === 1) {
        rw = block.len * scale;
        rh = bHeight;
      } else {
        rw = bWidth;
        rh = block.len * scale;
      }

      svg.appendChild(createSVGElement('rect', {
        x: cx, y: cy,
        width: rw, height: rh,
        fill, stroke: strokeColor, 'stroke-width': 1.5,
        rx: 1
      }));

      if (block.type === 'cut') {
        const fontSize = Math.max(8, Math.min(11, Math.min(rw, rh) * 0.6));
        const txt = createSVGElement('text', {
          x: cx + rw / 2, y: cy + rh / 2 + 3,
          'text-anchor': 'middle', fill: '#fff',
          'font-size': fontSize,
          'font-family': 'JetBrains Mono, monospace',
          'font-weight': 'bold'
        });
        txt.textContent = block.len;
        svg.appendChild(txt);
      }

      cx += dirX * block.len * scale;
      cy += dirY * block.len * scale;
    }
  }

  function drawDimensions(svg, ox, oy, L, W, T, scale, data) {
    const as = 4;
    const offset = 25;
    const fa = {
      fill: '#aaa', 'font-size': 10,
      'font-family': 'JetBrains Mono, monospace',
      'text-anchor': 'middle'
    };

    drawDimLine(svg, ox, oy - offset, ox + L * scale, oy - offset, `${L}`, fa, as);
    drawDimLineV(svg, ox - offset, oy, ox - offset, oy + W * scale, `${W}`, fa, as);

    const botY = oy + W * scale + offset;
    const intStartX = ox + T * scale;
    drawDimLine(svg, intStartX, botY, intStartX + data.intL * scale, botY, `${data.intL} int.`, fa, as);

    const rightX = ox + L * scale + offset;
    const intStartY = state.mode === 'adosse' ? oy : oy + T * scale;
    drawDimLineV(svg, rightX, intStartY, rightX, intStartY + data.intW * scale, `${data.intW} int.`, fa, as);
  }

  function drawDimLine(svg, x1, y1, x2, y2, label, fa, as) {
    svg.appendChild(createSVGElement('line', { x1, y1, x2, y2, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1, y1, x2: x1 + as, y2: y1 - as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1, y1, x2: x1 + as, y2: y1 + as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x2, y1: y2, x2: x2 - as, y2: y2 - as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x2, y1: y2, x2: x2 - as, y2: y2 + as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1, y1: y1 - 6, x2: x1, y2: y1 + 6, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x2, y1: y2 - 6, x2: x2, y2: y2 + 6, stroke: '#777', 'stroke-width': 0.8 }));
    const txt = createSVGElement('text', { ...fa, x: (x1 + x2) / 2, y: y1 - 6 });
    txt.textContent = label;
    svg.appendChild(txt);
  }

  function drawDimLineV(svg, x1, y1, x2, y2, label, fa, as) {
    svg.appendChild(createSVGElement('line', { x1, y1, x2, y2, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1, y1, x2: x1 - as, y2: y1 + as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1, y1, x2: x1 + as, y2: y1 + as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x2, y1: y2, x2: x2 - as, y2: y2 - as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x2, y1: y2, x2: x2 + as, y2: y2 - as, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x1 - 6, y1, x2: x1 + 6, y2: y1, stroke: '#777', 'stroke-width': 0.8 }));
    svg.appendChild(createSVGElement('line', { x1: x2 - 6, y1: y2, x2: x2 + 6, y2: y2, stroke: '#777', 'stroke-width': 0.8 }));
    const txt = createSVGElement('text', {
      ...fa, x: 0, y: 0,
      transform: `translate(${x1 - 8}, ${(y1 + y2) / 2}) rotate(-90)`
    });
    txt.textContent = label;
    svg.appendChild(txt);
  }

  // --- Render ---
  function renderDimensions(data) {
    $('#dimensions-content').innerHTML = `
      <div class="result-grid">
        <span class="label">Exterieur</span>
        <span class="value">${data.L} &times; ${data.W} cm</span>
        <span class="label">Interieur</span>
        <span class="value">${data.intL} &times; ${data.intW} cm</span>
        <span class="label">Hauteur utile</span>
        <span class="value">${data.heightUseful} cm</span>
        <div class="separator"></div>
        <span class="label">Surface cultivable</span>
        <span class="value">${data.surfaceCultivable.toFixed(2)} m&sup2;</span>
        <span class="label">Volume de terre</span>
        <span class="value">${data.volumeLitres.toFixed(0)} L (${data.volumeTerre.toFixed(2)} m&sup3;)</span>
      </div>
    `;
  }

  function renderMaterials(data) {
    let html = `
      <div class="result-grid">
        <span class="label">Blocs standard 50 cm</span>
        <span class="value">${data.totalStd} (+2 marge = ${data.totalStd + 2})</span>
        <span class="label">Coupes</span>
        <span class="value ${data.totalCuts > 0 ? 'cut-detail' : ''}">${data.totalCuts}</span>
    `;
    for (const cd of data.cutDetails) {
      html += `<span class="label cut-detail">&nbsp;&nbsp;Rang ${cd.rang} ${cd.side}</span>
               <span class="value cut-detail">${cd.cutLength} cm</span>`;
    }
    html += `
        <div class="separator"></div>
        <span class="label">Mortier (sacs 25 kg, ~7 blocs/sac)</span>
        <span class="value">${data.mortarBags}</span>
        <span class="label">Sous-enduit ext. (sacs 25 kg)</span>
        <span class="value">${data.enduitBags} (${data.enduitKg.toFixed(1)} kg pour ${data.surfaceExt.toFixed(1)} m&sup2;)</span>
    `;
    html += '</div>';
    $('#materials-content').innerHTML = html;
  }

  function renderBudget(data) {
    const b = data.budget;
    let html = '<div class="result-grid">';
    html += `<span class="label">Blocs (${data.totalStd + data.totalCuts + 2} &times; ${PRICES.blocStd.toFixed(2)} &euro;)</span><span class="value">${b.blocs.toFixed(2)} &euro;</span>`;
    html += `<span class="label">Mortier (${data.mortarBags} sacs)</span><span class="value">${b.mortar.toFixed(2)} &euro;</span>`;
    html += `<span class="label">Sous-enduit ext. (${data.enduitBags} sacs)</span><span class="value">${b.parmurex.toFixed(2)} &euro;</span>`;
    html += '<div class="separator"></div>';
    html += `<span class="label total">TOTAL estime (hors terre)</span><span class="value total">${b.total.toFixed(2)} &euro;</span>`;
    html += '</div>';
    $('#budget-content').innerHTML = html;
  }

  function renderCutIndicator(data) {
    const el = $('#cut-indicator');
    if (data.totalCuts === 0) {
      el.className = 'zero-cut';
      el.innerHTML = 'ZERO COUPE &#10003;';
    } else {
      el.className = 'has-cuts';
      const dims = data.cutDetails.map(c => `${c.cutLength} cm (${c.side} R${c.rang})`).join(', ');
      const nearL = nearestZeroCut(state.length, MIN_LENGTH, MAX_LENGTH);
      const curW = state.shape === 'square' ? state.length : state.width;
      const nearW = nearestZeroCut(curW, MIN_WIDTH, MAX_WIDTH);
      let suggestion = '';
      if (nearL !== state.length || nearW !== curW) {
        suggestion = `<span class="suggestion">Suggestion zero coupe : ${nearL} &times; ${nearW} cm</span>`;
      }
      el.innerHTML = `${data.totalCuts} COUPE${data.totalCuts > 1 ? 'S' : ''} : ${dims}${suggestion}`;
    }
  }

  function renderTabs() {
    const container = $('#calepinage-tabs');
    container.innerHTML = '';
    for (let r = 1; r <= state.rows; r++) {
      const btn = document.createElement('button');
      btn.textContent = `Rang ${r}`;
      btn.className = r === state.activeRang ? 'active' : '';
      btn.addEventListener('click', () => {
        state.activeRang = r;
        renderTabs();
        renderSVG(computeTotals());
      });
      container.appendChild(btn);
    }
  }

  function renderSVG(data) {
    const container = $('#svg-container');
    container.innerHTML = '';
    container.appendChild(generateSVG(state.activeRang, data));
  }

  // --- Update ---
  function update() {
    const W = state.shape === 'square' ? state.length : state.width;
    const T = THICKNESS;

    lengthValue.textContent = state.length;
    widthValue.textContent = W;

    const lOk = canDecomposeExact(state.length) && canDecomposeExact(state.length - 2 * T);
    lengthBadge.textContent = lOk ? '0 coupe' : 'coupe';
    lengthBadge.className = `badge ${lOk ? 'badge-green' : 'badge-orange'}`;

    const ewEntreLen = state.mode === 'adosse' ? W - T : W - 2 * T;
    const wOk = canDecomposeExact(W) && canDecomposeExact(ewEntreLen);
    widthBadge.textContent = wOk ? '0 coupe' : 'coupe';
    widthBadge.className = `badge ${wOk ? 'badge-green' : 'badge-orange'}`;

    widthGroup.style.display = state.shape === 'square' ? 'none' : '';
    if (state.activeRang > state.rows) state.activeRang = state.rows;

    const data = computeTotals();
    renderTabs();
    renderSVG(data);
    renderCutIndicator(data);
    renderDimensions(data);
    renderMaterials(data);
    renderBudget(data);
  }

  // --- Events ---
  for (const group of $$('.btn-group')) {
    const param = group.dataset.param;
    if (!param) continue;
    for (const btn of group.querySelectorAll('button')) {
      btn.addEventListener('click', () => {
        group.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        const val = btn.dataset.value;
        switch (param) {
          case 'shape': state.shape = val; break;
          case 'mode': state.mode = val; break;
          case 'rows': state.rows = parseInt(val); break;
        }
        update();
      });
    }
  }

  lengthSlider.addEventListener('input', () => {
    state.length = parseInt(lengthSlider.value);
    if (state.shape === 'square') state.width = state.length;
    update();
  });

  widthSlider.addEventListener('input', () => {
    state.width = parseInt(widthSlider.value);
    update();
  });

  $('#optimize-btn').addEventListener('click', optimizeZeroCut);

  function setButtonGroup(param, value) {
    const group = $(`.btn-group[data-param="${param}"]`);
    group.querySelector('.active')?.classList.remove('active');
    group.querySelector(`[data-value="${value}"]`)?.classList.add('active');
  }

  initPresets();
  update();
})();
