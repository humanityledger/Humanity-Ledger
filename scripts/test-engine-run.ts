import { runAcademicIntegrityAnalysis } from '../lib/academic-integrity-engine';
import fs from 'fs';
import AdmZip from 'adm-zip';

async function main() {
  const docxPath = 'C:\\Users\\Grati\\.gemini\\antigravity\\brain\\fe0465c6-5601-4509-ba9d-333ffe484f9f\\.user_uploaded\\media_1793123372624_1261749d.docx';
  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText('word/document.xml');
  const text = xml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').trim();

  console.log('Testing text length:', text.length);

  const result = await runAcademicIntegrityAnalysis(
    text,
    'TEST-SUBMISSION-123',
    (p) => console.log(`Phase: ${p.phase} - ${p.progress}%: ${p.label}`)
  );

  console.log('\n--- SUCCESSFUL ANALYSIS RESULT ---');
  console.log('AI Verdict:', result.aiVerdict);
  console.log('AI Probability:', (result.aiProbability * 100).toFixed(1) + '%');
  console.log('Overall Risk:', result.overallRisk + '/100');
  console.log('Document Integrity Score:', (result.documentIntegrityScore * 100).toFixed(1) + '%');
  console.log('Shannon Entropy:', result.shannonEntropy);
  console.log('Burstiness:', result.burstinessScore);
  console.log('Stylometrics:', result.stylometrics);
  console.log('Security Alerts:', result.securityAlerts);
  console.log('ZK Commitment:', result.zkCommitment);
}

main().catch(err => {
  console.error('CRITICAL ENGINE ERROR:', err);
  process.exit(1);
});
