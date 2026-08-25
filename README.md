# Emergency Department Suite

A unified collection of clinical decision support tools designed for offline use in the Emergency Department.

## Modules

| Module | Description |
|--------|-------------|
| 🫀 **ECG Decision Support** | Tachycardia algorithm, ECG measurement calculator, pattern recognition |
| 🏥 **ICU Admission Suite** | 22-section admission form with qSOFA, SOFA, APACHE II, SBAR handover |
| 🫁 **ER Airway Assistant** | RSI workflow, drug calculator, failed airway algorithm, cricothyrotomy |
| 📋 **Consultant Assistant** | Complaint-based workflows: fever, breathlessness, DKA, trauma, stroke |
| 💉 **T2DM Navigator** | Type 2 diabetes medication selection, HbA1c targets, complications screening |

## Features

- **Works Offline** — PWA with service worker, no internet required after first load
- **Mobile-First** — Designed for use on phones and tablets at the bedside
- **Print Support** — Configurable margins for hospital letterhead (up to 80mm top margin)
- **Word Export** — All modules export to .doc format for clinical notes
- **Unified Hub** — Single entry point to access all tools

## Printing on Hospital Letterhead

All modules support adjustable print margins:
- **Top margin**: Set to ~65mm (2.5 inches) to clear hospital header
- **Left margin**: Adjust if paper has a ruled left border
- Settings persist during the session

## Deployment

### GitHub Pages
1. Push to GitHub
2. Go to Settings → Pages → Source: main branch
3. Site deploys at `https://username.github.io/repo-name/`

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

## Local Use

Open `index.html` in any browser. No server required.

## Changelog

### v1.1 (2026-08-25)
- **Bug fix:** Airway module dark mode CSS selector corrected (`.dark` instead of `dark`)
- **Bug fix:** ECG module now has `<link rel="manifest">` for PWA install support
- **Bug fix:** Consult module removed `user-scalable=no` for better accessibility
- **Improvement:** Diabetes module state saves now debounced (150ms) for better performance
- **Improvement:** Consistent home navigation across all modules

## ⚠️ Disclaimer

These are clinical reference tools — not a substitute for clinical judgment. Always verify doses and protocols against your local institutional guidelines.
