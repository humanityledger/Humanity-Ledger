import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { runAcademicIntegrityAnalysis } from '../lib/academic-integrity-engine';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('\nUso: npx tsx scripts/check-document.ts <ruta-al-archivo.(pdf|docx|txt)>\n');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`\nError: El archivo "${resolved}" no existe.\n`);
    process.exit(1);
  }

  const ext = path.extname(resolved).toLowerCase();
  let text = '';

  console.log(`\n======================================================`);
  console.log(`🛡️  TURING SHIELD — VERIFICADOR FORENSE ACADÉMICO`);
  console.log(`📄 Archivo: ${path.basename(resolved)}`);
  console.log(`======================================================\n`);

  if (ext === '.docx') {
    const zip = new AdmZip(resolved);
    const xml = zip.readAsText('word/document.xml');
    text = xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  } else if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const buffer = fs.readFileSync(resolved);
    const parser = new PDFParse({ data: buffer });
    const res = await parser.getText();
    text = (typeof res === 'string' ? res : (res?.text || '')).trim();
  } else {
    text = fs.readFileSync(resolved, 'utf-8').trim();
  }

  console.log(`Caracteres extraídos: ${text.length}`);
  console.log(`Palabras: ${text.split(/\s+/).filter(Boolean).length}\n`);

  const submissionId = `CLI-${Date.now().toString(36).toUpperCase()}`;

  const result = await runAcademicIntegrityAnalysis(
    text,
    submissionId,
    (p) => console.log(`  [${p.progress}%] ${p.label}`)
  );

  console.log('\n---------------- RESULTADOS DEL ANÁLISIS ----------------');
  console.log(`🤖 PROBABILIDAD DE IA:    ${(result.aiProbability * 100).toFixed(1)}%`);
  console.log(`⚖️  VEREDICTO IA:           ${result.aiVerdict === 'LIKELY_HUMAN' ? '✅ HUMANO (LIKELY_HUMAN)' : result.aiVerdict === 'LIKELY_AI' ? '🚨 GENERADO POR IA (LIKELY_AI)' : '⚠️ INCIERTO / REVISIÓN'}`);
  console.log(`🛡️  VEREDICTO PLAGIO:       ${result.plagiarismVerdict}`);
  console.log(`📊 INTEGRIDAD:             ${(result.documentIntegrityScore * 100).toFixed(1)}%`);
  console.log(`📈 ENTROPÍA SHANNON:       ${result.shannonEntropy} (Humano: ~4.3-4.8 | IA: <4.0)`);
  console.log(`🎵 BURSTINESS (Ritmo):     ${result.burstinessScore} (Uniforme = patrón de IA)`);
  console.log(`📝 ESTILOMETRÍA:`);
  console.log(`   - Riqueza de vocabulario (TTR): ${result.stylometrics.ttr}`);
  console.log(`   - Palabras únicas (Hapax):     ${result.stylometrics.hapaxRatio}`);
  console.log(`   - Densidad conectores de IA:   ${result.stylometrics.aiConnectorDensity}`);
  console.log(`   - Longitud media de oración:   ${result.stylometrics.sentenceComplexity}`);
  console.log(`🔒 SEGURIDAD (Ataques evadidos):`);
  console.log(`   - Homóglifos encontrados:      ${result.securityAlerts.homoglyphsFound}`);
  console.log(`   - Caracteres invisibles:       ${result.securityAlerts.zeroWidthCharsFound}`);
  console.log(`⛓️  COMPROMISO ZK-SNARK:     ${result.zkCommitment}`);
  console.log('---------------------------------------------------------\n');
}

main().catch(e => {
  console.error('\nError en el análisis:', e.message);
  process.exit(1);
});
