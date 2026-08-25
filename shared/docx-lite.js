/* docx-lite.js — minimal client-side HTML -> genuine .docx (OOXML) converter.
   Used because Word for Android/iOS frequently fails to open the old
   "HTML saved with a .doc extension" trick that desktop Word tolerates.
   This instead builds a real, minimal Open XML package (zipped via JSZip)
   so the file opens correctly on mobile Word, desktop Word, and Google Docs.
   Only handles the small tag vocabulary these clinical note templates use:
   h1-h4, p, div, table/tr/td/th, ul/ol/li, b/strong, i/em, br. */

(function (global) {
  'use strict';

  // Resolve this script's own folder so the local JSZip fallback works
  // regardless of which module (icu/, diabetes/, etc.) includes docx-lite.js.
  // document.currentScript is only reliable during initial synchronous
  // parsing, so it's captured here at load time, not inside a function.
  var _selfSrc = (document.currentScript && document.currentScript.src) || '';
  var _localJSZipUrl = _selfSrc ? _selfSrc.replace(/docx-lite\.js(\?.*)?$/, 'jszip.min.js') : 'jszip.min.js';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Split a block element's inline content into paragraphs (splitting on <br>),
  // each paragraph being an array of runs ({text, bold, italic}).
  function inlineToParagraphs(el) {
    const paragraphs = [[]];
    function pushRun(text, opts) {
      if (!text) return;
      paragraphs[paragraphs.length - 1].push(Object.assign({ text: text }, opts));
    }
    function walkInline(node, opts) {
      opts = opts || {};
      if (node.nodeType === 3) { pushRun(node.textContent, opts); return; }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') { paragraphs.push([]); return; }
      const newOpts = Object.assign({}, opts);
      if (tag === 'b' || tag === 'strong') newOpts.bold = true;
      if (tag === 'i' || tag === 'em') newOpts.italic = true;
      for (let i = 0; i < node.childNodes.length; i++) walkInline(node.childNodes[i], newOpts);
    }
    for (let i = 0; i < el.childNodes.length; i++) walkInline(el.childNodes[i], {});
    return paragraphs.filter(function (p) { return p.length; });
  }

  function runsXml(runs, extra) {
    extra = extra || {};
    const sz = extra.size || 20;
    return runs.map(function (r) {
      const rpr = (r.bold ? '<w:b/>' : '') + (r.italic ? '<w:i/>' : '') + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>';
      return '<w:r><w:rPr>' + rpr + '</w:rPr><w:t xml:space="preserve">' + esc(r.text) + '</w:t></w:r>';
    }).join('');
  }

  function paragraphXml(runs, opts) {
    opts = opts || {};
    const parts = [];
    if (opts.align) parts.push('<w:jc w:val="' + opts.align + '"/>');
    if (opts.spacingBefore || opts.spacingAfter) {
      parts.push('<w:spacing w:before="' + (opts.spacingBefore || 0) + '" w:after="' + (opts.spacingAfter || 0) + '"/>');
    }
    const pPr = parts.length ? '<w:pPr>' + parts.join('') + '</w:pPr>' : '';
    const body = runs.length ? runsXml(runs, opts) : '<w:r><w:t></w:t></w:r>';
    return '<w:p>' + pPr + body + '</w:p>';
  }

  function blockParagraphs(el, opts) {
    const paras = inlineToParagraphs(el);
    if (!paras.length) return paragraphXml([], opts);
    return paras.map(function (runs) { return paragraphXml(runs, opts); }).join('');
  }

  function tableXml(tableEl) {
    const rows = [].slice.call(tableEl.rows).map(function (tr) {
      const cells = [].slice.call(tr.cells).map(function (td) {
        const paras = inlineToParagraphs(td);
        const body = paras.length
          ? paras.map(function (runs) { return paragraphXml(runs, { size: 19 }); }).join('')
          : paragraphXml([], {});
        return '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:tcMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>' + body + '</w:tc>';
      }).join('');
      return '<w:tr>' + cells + '</w:tr>';
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:color="AAAAAA"/><w:left w:val="single" w:sz="4" w:color="AAAAAA"/>' +
      '<w:bottom w:val="single" w:sz="4" w:color="AAAAAA"/><w:right w:val="single" w:sz="4" w:color="AAAAAA"/>' +
      '<w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/>' +
      '</w:tblBorders></w:tblPr>' + rows + '</w:tbl>';
  }

  const BLOCK_TAGS = ['div', 'p', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4'];

  function htmlToDocxBody(rootEl) {
    let xml = '';
    function walk(node) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const tag = child.tagName.toLowerCase();
        const cls = child.className || '';
        if (tag === 'table') { xml += tableXml(child); continue; }
        if (tag === 'h1') { xml += blockParagraphs(child, { bold: true, size: 32, align: 'center', spacingAfter: 160 }); continue; }
        if (tag === 'h2') { xml += blockParagraphs(child, { bold: true, size: 28, align: 'center', spacingAfter: 160 }); continue; }
        if (tag === 'h3' || tag === 'h4' || /section-title/.test(cls)) {
          xml += blockParagraphs(child, { bold: true, size: 22, spacingBefore: 180, spacingAfter: 70 }); continue;
        }
        if (tag === 'ul' || tag === 'ol') {
          for (let j = 0; j < child.children.length; j++) {
            xml += paragraphXml([{ text: '\u2022  ' + child.children[j].textContent.trim() }], { size: 20, spacingAfter: 40 });
          }
          continue;
        }
        if (tag === 'p' || tag === 'div') {
          if (/\bkv\b/.test(cls)) {
            for (let k = 0; k < child.children.length; k++) {
              xml += blockParagraphs(child.children[k], { size: 20, spacingAfter: 30 });
            }
            continue;
          }
          let hasBlockChild = false;
          for (let m = 0; m < child.children.length; m++) {
            if (BLOCK_TAGS.indexOf(child.children[m].tagName.toLowerCase()) !== -1) { hasBlockChild = true; break; }
          }
          if (hasBlockChild) { walk(child); continue; }
          xml += blockParagraphs(child, { size: 20, spacingAfter: 50 });
          continue;
        }
        walk(child);
      }
    }
    walk(rootEl);
    return xml;
  }

  const CONTENT_TYPES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  function buildDocumentXml(bodyXml, marginTopTwips, marginLeftTwips) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + bodyXml +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="' + (marginTopTwips || 1417) + '" w:right="720" w:bottom="720" w:left="' + (marginLeftTwips || 680) + '" w:header="708" w:footer="708" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }

  let jszipLoading = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('load-failed')); };
      document.head.appendChild(s);
    });
  }
  function ensureJSZip() {
    if (typeof global.JSZip !== 'undefined') return Promise.resolve();
    if (jszipLoading) return jszipLoading;
    // Try a locally-vendored copy first (works offline / behind hospital
    // firewalls that block CDNJS), then fall back to the CDN.
    jszipLoading = loadScript(_localJSZipUrl).catch(function () {
      return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }).catch(function () {
      throw new Error('Could not load the .docx library — check your internet connection and try again.');
    });
    return jszipLoading;
  }

  function saveDocxBlob(blob, filename) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: filename }).catch(fallback);
        return;
      }
    } catch (e) { /* fall through */ }
    fallback();
    function fallback() {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    }
  }

  // Public API: DocxLite.exportRealDocx(rootEl, marginTopMm, marginLeftMm, filenameBase, callback)
  function exportRealDocx(rootEl, marginTopMm, marginLeftMm, filenameBase, onDone) {
    ensureJSZip().then(function () {
      const bodyXml = htmlToDocxBody(rootEl);
      const mmToTwips = function (mm) { return Math.round((mm || 0) * 56.6929); };
      const docXml = buildDocumentXml(bodyXml, mmToTwips(marginTopMm != null ? marginTopMm : 25), mmToTwips(marginLeftMm != null ? marginLeftMm : 20));
      const zip = new global.JSZip();
      zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
      zip.folder('_rels').file('.rels', RELS_XML);
      zip.folder('word').file('document.xml', docXml);
      zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).then(function (blob) {
        saveDocxBlob(blob, filenameBase + '.docx');
        if (onDone) onDone(true);
      }).catch(function (e) { if (onDone) onDone(false, e); });
    }).catch(function (e) { if (onDone) onDone(false, e); });
  }

  global.DocxLite = { exportRealDocx: exportRealDocx };
})(window);
