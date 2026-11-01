/* ═══════════════════════════════════════════════════════════════════════
   Project Helix — ML Inference Engine (Client-Side)
   Runs polynomial ridge-regression models in the browser using
   pre-trained coefficients exported from train_model.py.
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Extended Periodic Table Placement ──────────────────────────────────────────
// Aufbau principle extrapolation for Z > 118

const HelixML = (() => {

  const BLOCK_MAP = { s: 0, p: 1, d: 2, f: 3, g: 4 };

  // Element naming for Z > 118 (IUPAC systematic nomenclature)
  const IUPAC_ROOTS = {
    0: 'nil', 1: 'un', 2: 'bi', 3: 'tri', 4: 'quad',
    5: 'pent', 6: 'hex', 7: 'sept', 8: 'oct', 9: 'enn'
  };

  function getSystematicName(z) {
    const digits = String(z).split('').map(Number);
    let name = digits.map(d => IUPAC_ROOTS[d]).join('');
    // Fix double letters
    name = name.replace(/nn/g, 'n').replace(/ii/g, 'i');
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1) + 'ium';
  }

  function getSystematicSymbol(z) {
    const SYMS = {
      0: 'n', 1: 'u', 2: 'b', 3: 't', 4: 'q',
      5: 'p', 6: 'h', 7: 's', 8: 'o', 9: 'e'
    };
    const digits = String(z).split('').map(Number);
    let sym = digits.map(d => SYMS[d]).join('');
    return sym.charAt(0).toUpperCase() + sym.slice(1);
  }

  function getExtendedPlacement(z) {
    if (z <= 0) return { period: 1, group: 1, block: 's' };
    if (z <= 118) return null; // Use actual data

    // Period 8: Z = 119-172
    if (z <= 120) {
      return { period: 8, group: z - 118, block: 's' };
    } else if (z <= 138) {
      return { period: 8, group: 3, block: 'g' };
    } else if (z <= 152) {
      return { period: 8, group: 3, block: 'f' };
    } else if (z <= 166) {
      const dPos = z - 152;
      return { period: 8, group: dPos + 2, block: 'd' };
    } else if (z <= 172) {
      const pPos = z - 166;
      return { period: 8, group: pPos + 12, block: 'p' };
    }

    // Period 9: Z = 173+
    if (z <= 174) {
      return { period: 9, group: z - 172, block: 's' };
    }

    // Very far extrapolation
    const period = 9 + Math.floor((z - 175) / 50);
    const group = ((z - 175) % 18) + 1;
    const block = group <= 2 ? 's' : group >= 13 ? 'p' : 'd';
    return { period, group, block };
  }

  function generateElectronConfig(z) {
    const orbitals = [
      [1,'s',2], [2,'s',2], [2,'p',6], [3,'s',2], [3,'p',6],
      [4,'s',2], [3,'d',10], [4,'p',6], [5,'s',2], [4,'d',10],
      [5,'p',6], [6,'s',2], [4,'f',14], [5,'d',10], [6,'p',6],
      [7,'s',2], [5,'f',14], [6,'d',10], [7,'p',6],
      [8,'s',2], [5,'g',18], [6,'f',14], [7,'d',10], [8,'p',6],
    ];

    const config = [];
    const shellMap = {};
    let remaining = z;

    for (const [n, l, maxE] of orbitals) {
      if (remaining <= 0) break;
      const e = Math.min(remaining, maxE);
      config.push(`${n}${l}${e}`);
      shellMap[n] = (shellMap[n] || 0) + e;
      remaining -= e;
    }

    // Handle extremely heavy elements
    let nextN = Math.max(...Object.keys(shellMap).map(Number)) + 1;
    while (remaining > 0) {
      const e = Math.min(remaining, 2);
      config.push(`${nextN}s${e}`);
      shellMap[nextN] = e;
      remaining -= e;
      nextN++;
    }

    const shells = [];
    const sortedNs = Object.keys(shellMap).map(Number).sort((a, b) => a - b);
    for (const n of sortedNs) {
      shells.push(shellMap[n]);
    }

    return { config: config.join(' '), shells };
  }

  // ── Feature Engineering ──────────────────────────────────────────────────────
  function engineerFeatures(z, period, group, block) {
    const blockId = BLOCK_MAP[block] || 0;
    const zNorm = z / 118.0;
    const periodNorm = period / 8.0;
    const groupNorm = group / 18.0;
    const groupAngle = 2 * Math.PI * group / 18.0;
    const groupSin = Math.sin(groupAngle);
    const groupCos = Math.cos(groupAngle);

    const isS = block === 's' ? 1.0 : 0.0;
    const isP = block === 'p' ? 1.0 : 0.0;
    const isD = block === 'd' ? 1.0 : 0.0;
    const isF = block === 'f' ? 1.0 : 0.0;

    const zCbrt = Math.pow(z, 1/3);
    const zLog = z > 0 ? Math.log(z) : 0;
    const zSqrt = Math.sqrt(z);
    const zInv = z > 0 ? 1.0 / z : 0;
    let zEff = z - 2 * (period - 1) * 3.5;
    zEff = Math.max(zEff, 1);

    return [
      z, zNorm, period, periodNorm, group, groupNorm,
      blockId, groupSin, groupCos,
      isS, isP, isD, isF,
      zCbrt, zLog, zSqrt, zInv, zEff,
      z * groupSin, z * groupCos,
      period * group,
      zNorm * zNorm, zNorm * zNorm * zNorm
    ];
  }

  // ── Polynomial Transform ─────────────────────────────────────────────────────
  function polyTransform(features, powers) {
    const result = new Array(powers.length);
    for (let i = 0; i < powers.length; i++) {
      let val = 1.0;
      for (let j = 0; j < powers[i].length; j++) {
        if (powers[i][j] > 0) {
          val *= Math.pow(features[j], powers[i][j]);
        }
      }
      result[i] = val;
    }
    return result;
  }

  // ── Prediction ───────────────────────────────────────────────────────────────
  function predict(z, target) {
    if (typeof HELIX_MODEL === 'undefined') return null;
    const modelData = HELIX_MODEL.models[target];
    if (!modelData) return null;

    // Get placement
    let period, group, block;
    if (z <= 118 && typeof ALL_ELEMENTS !== 'undefined') {
      const el = ALL_ELEMENTS.find(e => e.number === z);
      if (el) {
        period = el.period;
        group = el.group || 3;
        block = el.block || 's';
      }
    }

    if (!period) {
      const placement = getExtendedPlacement(z);
      if (placement) {
        period = placement.period;
        group = placement.group;
        block = placement.block;
      } else {
        return null;
      }
    }

    // Engineer features
    const features = engineerFeatures(z, period, group, block);

    // Standardize
    const scaled = features.map((f, i) => (f - modelData.scaler_mean[i]) / modelData.scaler_scale[i]);

    // Polynomial transform
    const polyFeatures = polyTransform(scaled, modelData.poly_powers);

    // Linear prediction: dot(X, coef) + intercept
    let prediction = modelData.intercept;
    for (let i = 0; i < polyFeatures.length; i++) {
      prediction += polyFeatures[i] * modelData.coefficients[i];
    }

    // Clamp to physical bounds if available
    if (modelData.bounds) {
      prediction = Math.max(modelData.bounds.min, Math.min(modelData.bounds.max, prediction));
    }

    return prediction;
  }

  function predictAll(z) {
    if (typeof HELIX_MODEL === 'undefined') return {};
    const results = {};
    for (const target of HELIX_MODEL.targets) {
      const pred = predict(z, target);
      if (pred !== null) {
        results[target] = pred;
      }
    }
    return results;
  }

  function getModelMetrics(target) {
    if (typeof HELIX_MODEL === 'undefined') return null;
    return HELIX_MODEL.metrics[target] || null;
  }

  function getQualityReport() {
    if (typeof HELIX_MODEL === 'undefined') return null;
    return HELIX_MODEL.quality_report;
  }

  // ── Confidence Estimation ────────────────────────────────────────────────────
  function getConfidence(z) {
    // Confidence decreases with distance from known elements
    if (z <= 118) return { level: 'high', score: 0.95, label: 'Known Element' };
    if (z <= 120) return { level: 'medium', score: 0.7, label: 'Near Extrapolation' };
    if (z <= 138) return { level: 'medium', score: 0.55, label: 'Period 8 (g-block)' };
    if (z <= 172) return { level: 'low', score: 0.4, label: 'Period 8 Extrapolation' };
    return { level: 'very-low', score: 0.2, label: 'Far Extrapolation' };
  }

  function getCategory(z) {
    if (z <= 118) return null; // use actual
    const placement = getExtendedPlacement(z);
    if (!placement) return 'unknown';
    const { group, block } = placement;
    if (block === 'g') return 'superactinide (predicted)';
    if (block === 'f') return 'superactinide (predicted)';
    if (block === 's' && group === 1) return 'alkali metal (predicted)';
    if (block === 's' && group === 2) return 'alkaline earth metal (predicted)';
    if (block === 'd') return 'transition metal (predicted)';
    if (block === 'p' && group === 18) return 'noble gas (predicted)';
    if (block === 'p' && group === 17) return 'halogen (predicted)';
    if (block === 'p') return 'post-transition metal (predicted)';
    return 'unknown (predicted)';
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    predict,
    predictAll,
    getExtendedPlacement,
    generateElectronConfig,
    getSystematicName,
    getSystematicSymbol,
    getConfidence,
    getCategory,
    getModelMetrics,
    getQualityReport,
    engineerFeatures,
  };

})();
