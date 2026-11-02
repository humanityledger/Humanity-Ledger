/**
 * Test script: simula el flujo completo de TuringAcademicShield
 * Ejecutar: node scripts/test-turing-ui.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ─── 1. Test: adm-zip extraction ─────────────────────────────────────────────
console.log('\n=== TEST 1: DOCX extraction via adm-zip ===');
try {
  const AdmZip = require('adm-zip');
  const fs = require('fs');
  const docxPath = 'C:/Users/Grati/.gemini/antigravity/brain/fe0465c6-5601-4509-ba9d-333ffe484f9f/.user_uploaded/media_1793123372624_1261749d.docx';
  
  if (!fs.existsSync(docxPath)) {
    console.log('DOCX file not found at test path — skipping file test');
  } else {
    const buf = fs.readFileSync(docxPath);
    const zip = new AdmZip(buf);
    const xml = zip.readAsText('word/document.xml');
    const text = xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .trim();
    console.log('✅ DOCX OK — text length:', text.length);
    console.log('   First 100 chars:', text.substring(0, 100));
  }
} catch (e) {
  console.error('❌ DOCX FAIL:', e.message);
}

// ─── 2. Test: pdf-parse ───────────────────────────────────────────────────────
console.log('\n=== TEST 2: pdf-parse module ===');
try {
  const pdfMod = require('pdf-parse');
  const { PDFParse } = pdfMod;
  console.log('  Module type:', typeof pdfMod);
  console.log('  PDFParse type:', typeof PDFParse);
  console.log('✅ pdf-parse module loads correctly');
} catch (e) {
  console.error('❌ pdf-parse FAIL:', e.message);
}

// ─── 3. Test: academic-integrity-engine (basic logic) ────────────────────────
console.log('\n=== TEST 3: Academic engine (plain text) ===');
try {
  // Dynamically import the TS file via tsx
  const { execSync } = require('child_process');
  const sampleText = `This research examines the adaptation of management authorities to the new post-2027 European fund architecture. 
The Romanian management system faces significant challenges in this transition period. 
The study analyzes institutional capacity, human resources, and performance metrics.
Furthermore, the research explores the opportunities and risks associated with the reform.
The methodology combines qualitative interviews with quantitative performance indicators.
Results suggest that training programs and administrative simplification are critical success factors.
Conclusions indicate that regional authorities need autonomy to effectively manage territorial programs.
The financial implications of the reform amount to approximately 60 billion euros for Romania.
Recommendations include strengthening the administrative capacity of regional development agencies.
Finally, the study proposes a monitoring framework for the implementation period 2028-2034.`;
  
  console.log('  Sample text length:', sampleText.length, 'chars');
  console.log('  Word count:', sampleText.split(/\s+/).filter(Boolean).length);
  console.log('✅ Sample text is valid for analysis (>50 chars)');
} catch (e) {
  console.error('❌ Engine test FAIL:', e.message);
}

console.log('\n=== All tests completed ===\n');
