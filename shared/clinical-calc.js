/*
 * ED Suite — shared clinical calculation module
 * BMI, height unit conversion, Cockcroft-Gault CrCl, CKD-EPI 2021 (race-free) eGFR,
 * renal band interpretation, and the handwriting font loader used by print/PDF output.
 *
 * Usage: <script src="../../shared/clinical-calc.js" defer></script>
 * (same relative pattern as shared/docx-lite.js)
 */
(function (global) {
  'use strict';

  // ---------- Height / weight conversions ----------

  // Convert a height value in a given unit ('cm' | 'in') to cm.
  function heightToCm(value, unit) {
    var v = parseFloat(value);
    if (!v || v <= 0) return null;
    if (unit === 'in') return +(v * 2.54).toFixed(1);
    return +v.toFixed(1);
  }

  // Convert a cm height to inches (rounded to 1dp), for display alongside cm.
  function cmToInches(cm) {
    var v = parseFloat(cm);
    if (!v || v <= 0) return null;
    return +(v / 2.54).toFixed(1);
  }

  // ---------- BMI ----------

  function calcBMI(weightKg, heightCm) {
    var w = parseFloat(weightKg), h = parseFloat(heightCm);
    if (!w || !h) return null;
    var bmi = w / Math.pow(h / 100, 2);
    return +bmi.toFixed(1);
  }

  function bmiCategory(bmi) {
    if (bmi == null || isNaN(bmi)) return '';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    if (bmi < 35) return 'Obese I';
    if (bmi < 40) return 'Obese II';
    return 'Obese III';
  }

  // ---------- Renal function ----------

  // Cockcroft-Gault creatinine clearance (mL/min). Creatinine in µmol/L (converted to mg/dL internally).
  function cockcroftGault(ageYrs, weightKg, sex, creatinineUmolL) {
    var age = parseFloat(ageYrs), wt = parseFloat(weightKg), cr = parseFloat(creatinineUmolL);
    if (!age || !wt || !cr || !sex) return null;
    var crMgDl = cr / 88.4;
    var crcl = ((140 - age) * wt) / (72 * crMgDl);
    if (String(sex).toUpperCase().charAt(0) === 'F') crcl *= 0.85;
    return Math.round(crcl);
  }

  // CKD-EPI 2021 race-free creatinine equation. Returns eGFR in mL/min/1.73m².
  // Ref: Inker LA et al. NEJM 2021 — race-free refit of CKD-EPI.
  function ckdEpi2021(ageYrs, sex, creatinineUmolL) {
    var age = parseFloat(ageYrs), cr = parseFloat(creatinineUmolL);
    if (!age || !cr || !sex) return null;
    var crMgDl = cr / 88.4;
    var isFemale = String(sex).toUpperCase().charAt(0) === 'F';
    var k = isFemale ? 0.7 : 0.9;
    var a = isFemale ? -0.241 : -0.302;
    var sexFactor = isFemale ? 1.012 : 1.0;
    var minRatio = Math.min(crMgDl / k, 1);
    var maxRatio = Math.max(crMgDl / k, 1);
    var egfr = 142 * Math.pow(minRatio, a) * Math.pow(maxRatio, -1.200) *
      Math.pow(0.9938, age) * sexFactor;
    return Math.round(egfr);
  }

  // Shared interpretation band used across modules for whichever eGFR/CrCl value is in play.
  function renalBand(value) {
    var v = parseFloat(value);
    if (!v && v !== 0) return '';
    if (v >= 90) return 'Normal / high (\u226590)';
    if (v >= 60) return 'Mildly decreased (60\u201389)';
    if (v >= 45) return 'Mild-moderate decrease (45\u201359)';
    if (v >= 30) return 'Moderate-severe decrease (30\u201344)';
    if (v >= 15) return 'Severely decreased (15\u201329)';
    return 'Kidney failure (<15) / consider CRRT-HD range';
  }

  // Convenience: compute both estimates at once for the shared demographics block.
  function renalSummary(ageYrs, weightKg, sex, creatinineUmolL) {
    var cg = cockcroftGault(ageYrs, weightKg, sex, creatinineUmolL);
    var epi = ckdEpi2021(ageYrs, sex, creatinineUmolL);
    return {
      cockcroftGault: cg,
      ckdEpi: epi,
      cockcroftGaultBand: cg != null ? renalBand(cg) : '',
      ckdEpiBand: epi != null ? renalBand(epi) : ''
    };
  }

  // ---------- Handwriting font (print/PDF output) ----------
  // Two clean options — both render reliably on Android/mobile, unlike Segoe Script
  // (a Windows-only system font). Modules should let the user pick between them.

  var HW_FONTS = {
    kalam: { family: 'Kalam', googleParam: 'Kalam:wght@400;700', css: "font-family:'Kalam',cursive !important;" },
    caveat: { family: 'Caveat', googleParam: 'Caveat:wght@500;700', css: "font-family:'Caveat',cursive !important;" }
  };

  var loadedFonts = {};

  function ensureHandwrittenFont(choice) {
    choice = (choice === 'caveat') ? 'caveat' : 'kalam'; // default kalam
    if (loadedFonts[choice]) return;
    var cfg = HW_FONTS[choice];
    var linkId = 'hwFontLink_' + choice;
    if (document.getElementById(linkId)) { loadedFonts[choice] = true; return; }
    var link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + cfg.googleParam + '&display=swap';
    document.head.appendChild(link);
    loadedFonts[choice] = true;
  }

  function handwrittenFontCSS(choice) {
    choice = (choice === 'caveat') ? 'caveat' : 'kalam';
    return HW_FONTS[choice].css;
  }

  global.ClinicalCalc = {
    heightToCm: heightToCm,
    cmToInches: cmToInches,
    calcBMI: calcBMI,
    bmiCategory: bmiCategory,
    cockcroftGault: cockcroftGault,
    ckdEpi2021: ckdEpi2021,
    renalBand: renalBand,
    renalSummary: renalSummary,
    ensureHandwrittenFont: ensureHandwrittenFont,
    handwrittenFontCSS: handwrittenFontCSS,
    HW_FONTS: HW_FONTS
  };
})(window);
