const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const photoB64 = fs.readFileSync(path.resolve('public/stefan_cirisanu.jpg')).toString('base64');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Stefan Antonio Cirisanu — Senior Software Engineer</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }

  *, *:before, *:after {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background-color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    padding: 18mm 20mm 16mm 20mm;
    background-color: #ffffff;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
    box-sizing: border-box;
  }

  @media screen {
    .page {
      margin-bottom: 24px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
  }

  .content-area {
    flex: 1;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 2px solid #0f172a;
  }

  .header-left {
    flex: 1;
  }

  .name {
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.4px;
    margin: 0 0 4px 0;
    text-transform: uppercase;
  }

  .headline {
    font-size: 10.5pt;
    font-weight: 600;
    color: #0284c7;
    margin-bottom: 8px;
    letter-spacing: -0.1px;
  }

  .meta-row {
    font-size: 8.6pt;
    color: #475569;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }

  .meta-row span {
    display: inline-flex;
    align-items: center;
  }

  .meta-row a {
    color: #0f172a;
    text-decoration: none;
    font-weight: 500;
  }

  .header-photo {
    flex-shrink: 0;
  }

  .avatar-frame {
    width: 82px;
    height: 82px;
    border-radius: 50%;
    overflow: hidden;
    border: 2.5px solid #0284c7;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.15);
    position: relative;
    background-color: #0f172a;
  }

  .avatar-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.18);
    display: block;
  }

  /* Section Title */
  .section {
    margin-top: 15px;
    margin-bottom: 6px;
  }

  .section-title {
    font-size: 9.8pt;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-bottom: 9px;
  }

  .summary-text {
    font-size: 8.9pt;
    color: #334155;
    line-height: 1.54;
    text-align: justify;
    margin: 0;
  }

  /* Skills Grid */
  .skills-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 4px;
  }

  .skill-line {
    font-size: 8.7pt;
    line-height: 1.46;
    color: #334155;
  }

  .skill-name {
    font-weight: 700;
    color: #0f172a;
  }

  /* Job Blocks */
  .job-block {
    margin-bottom: 13px;
  }

  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 3px;
  }

  .job-title {
    font-size: 9.4pt;
    font-weight: 700;
    color: #0f172a;
  }

  .job-company {
    font-weight: 600;
    color: #0284c7;
    font-size: 9.2pt;
  }

  .job-date {
    font-size: 8.4pt;
    font-weight: 600;
    color: #64748b;
  }

  .job-bullets {
    margin: 4px 0 0 0;
    padding-left: 15px;
  }

  .job-bullets li {
    font-size: 8.7pt;
    color: #334155;
    margin-bottom: 4px;
    line-height: 1.46;
  }

  .job-bullets li strong {
    color: #0f172a;
  }

  /* Education */
  .edu-block {
    margin-bottom: 9px;
  }

  .edu-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }

  .edu-degree {
    font-size: 9.1pt;
    font-weight: 700;
    color: #0f172a;
  }

  .edu-school {
    color: #0284c7;
    font-weight: 600;
    font-size: 8.9pt;
  }

  .edu-date {
    font-size: 8.3pt;
    font-weight: 600;
    color: #64748b;
  }

  .edu-desc {
    font-size: 8.6pt;
    color: #475569;
    margin: 2px 0 0 0;
    padding-left: 12px;
    line-height: 1.42;
  }

  /* Page Footer */
  .page-footer {
    padding-top: 10px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
    color: #94a3b8;
  }
</style>
</head>
<body>

  <!-- ======================== PAGE 1 ======================== -->
  <div class="page" id="page-1">
    <div class="content-area">
      <div class="header">
        <div class="header-left">
          <div class="name">Stefan Antonio Cirisanu</div>
          <div class="headline">Senior Software Engineer | Java, Spring Boot & Distributed Enterprise Architecture</div>
          <div class="meta-row">
            <span>Timișoara, Romania</span>
            <span>stefan.cirisanu@icloud.com</span>
            <span><a href="https://linkedin.com/in/stefan-antonio-cirisanu">linkedin.com/in/stefan antonio cirisanu</a></span>
          </div>
        </div>
        <div class="header-photo">
          <div class="avatar-frame">
            <img src="data:image/jpeg;base64,${photoB64}" alt="Stefan Antonio Cirisanu" />
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Executive Profile</div>
        <p class="summary-text">
          Senior Software Engineer with over 7 years of experience engineering resilient backends, modular distributed systems, and scalable web platforms. <strong>Oracle Certified Professional in Java SE 21</strong>, specializing in <strong>Spring Boot, Spring Modulith, Domain Driven Design</strong>, and relational data architecture in <strong>PostgreSQL</strong>. Extensive domain background in educational technology, having architected academic workflow systems and thesis analysis tools for university professors in Spain, paired with active academic collaboration at <strong>Universitatea de Vest din Timișoara</strong>. Experienced in leveraging modern AI assisted engineering workflows to accelerate technical delivery while maintaining clean, maintainable, and thoroughly tested codebases.
        </p>
      </div>

      <div class="section">
        <div class="section-title">Core Competencies & Technical Arsenal</div>
        <div class="skills-grid">
          <div class="skill-line">
            <span class="skill-name">Java & Enterprise Frameworks:</span> Java SE 21 (Oracle Certified Professional), Java SE 17, Spring Boot, Spring Modulith, Spring Data JPA, Hibernate, Spring Security, REST API Design.
          </div>
          <div class="skill-line">
            <span class="skill-name">Data Architecture & Caching:</span> PostgreSQL, Complex Relational Modeling, Temporal and Versioned Schemas, Append Only Audit Logging, Redis, Liquibase, Flyway, SQL Optimization.
          </div>
          <div class="skill-line">
            <span class="skill-name">Engineering Practices:</span> Domain Driven Design, Clean Architecture, Modular Systems, Test Driven Development, Code Review Leadership, High Velocity AI Assisted Engineering.
          </div>
          <div class="skill-line">
            <span class="skill-name">Security & Access Management:</span> Keycloak, Identity and Access Management, Role Based Access Control, OAuth2, OpenID Connect, Data Provenance, OWASP Compliance, European Data Privacy.
          </div>
          <div class="skill-line">
            <span class="skill-name">Cloud, Tooling & Full Stack:</span> TypeScript, React, Angular Integration, Node.js, Docker, CI CD Automation, AWS Cloud, JUnit 5, Mockito, Testcontainers, Maven, Git.
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Professional Experience</div>

        <div class="job-block">
          <div class="job-header">
            <div>
              <span class="job-title">Lead Software Engineer</span> | 
              <span class="job-company">Academic Tooling & Educational Integrations (Valencia & Remote)</span>
            </div>
            <span class="job-date">Feb 2023 to Present</span>
          </div>
          <ul class="job-bullets">
            <li>Architected modular backend services in Java and Spring Boot for academic evaluation systems utilized by university educators, orchestrating student coursework evaluation and degree thesis analysis.</li>
            <li>Modeled complex relational PostgreSQL schemas with temporal versioning states (draft, approved, replaced) and frozen cohort configurations, ensuring historical audit records remain strictly immutable.</li>
            <li>Engineered an append only audit journal and information provenance pipeline, guaranteeing every recorded decision, student submission, and evaluation retains its verifiable institutional source.</li>
            <li>Implemented multi role authentication workflows via Keycloak, enforcing role based permissions for educators, evaluators, and administrators under strict European educational data privacy standards.</li>
          </ul>
        </div>

        <div class="job-block">
          <div class="job-header">
            <div>
              <span class="job-title">Lead Software Engineer</span> | 
              <span class="job-company">Humanity Ledger (Remote)</span>
            </div>
            <span class="job-date">Jan 2023 to Present</span>
          </div>
          <ul class="job-bullets">
            <li>Direct the architectural development of an enterprise grade software platform, utilizing Domain Driven Design and Clean Architecture to isolate critical business logic from external delivery mechanisms.</li>
            <li>Orchestrated asynchronous data synchronization and high traffic caching pipelines in PostgreSQL and Redis, significantly reducing database latency under intensive concurrent usage.</li>
            <li>Pioneered modern AI assisted engineering workflows within the development cycle, accelerating test generation and code delivery across a suite of over 670 automated unit and integration tests.</li>
            <li>Enforced zero trust access policies, timing safe cryptographic comparisons, and comprehensive rate limiting gates across 50 service endpoints to prevent denial of service and enumeration.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <span>Stefan Antonio Cirisanu | Senior Software Engineer</span>
      <span>Page 1 of 2</span>
    </div>
  </div>

  <!-- ======================== PAGE 2 ======================== -->
  <div class="page" id="page-2">
    <div class="content-area">
      <div class="section" style="margin-top: 0;">
        <div class="section-title">Professional Experience (Continued)</div>

        <div class="job-block">
          <div class="job-header">
            <div>
              <span class="job-title">Systems & Security Software Engineer (Contract)</span> | 
              <span class="job-company">Aztec Network (Remote)</span>
            </div>
            <span class="job-date">Feb 2026 to Aug 2026</span>
          </div>
          <ul class="job-bullets">
            <li>Collaborated on the development of secure data validation infrastructure and verifiable state transition protocols, ensuring deterministic processing across distributed network nodes.</li>
            <li>Optimized high throughput data processing pipelines, moving intensive computational workloads to background execution workers while maintaining sub second verification responses.</li>
            <li>Authored technical architecture documentation and conducted peer code reviews to ensure strict adherence to zero fault tolerance standards.</li>
          </ul>
        </div>

        <div class="job-block">
          <div class="job-header">
            <div>
              <span class="job-title">Software Engineer | Scalable Identity Systems</span> | 
              <span class="job-company">Tools for Humanity (Remote)</span>
            </div>
            <span class="job-date">Jan 2022 to Dec 2022</span>
          </div>
          <ul class="job-bullets">
            <li>Engineered resilient backend integration layers for a global identity verification system serving millions of users while maintaining 99.99 percent operational uptime.</li>
            <li>Constructed secure APIs in Java and TypeScript to interface reliably with external verification authorities, distributed databases, and event messaging brokers.</li>
            <li>Enforced rigorous session hygiene, automated token rotation policies, and defensive access controls to safeguard identity records against unauthorized access.</li>
          </ul>
        </div>

        <div class="job-block">
          <div class="job-header">
            <div>
              <span class="job-title">Software Engineer</span> | 
              <span class="job-company">Wolfpack Digital (Cluj Napoca & Remote)</span>
            </div>
            <span class="job-date">Jan 2020 to Jan 2022</span>
          </div>
          <ul class="job-bullets">
            <li>Led the architectural migration of legacy monolithic backends into modular microservices, reducing service payload sizes by 42 percent and improving system maintainability.</li>
            <li>Designed relational database schemas and tuned complex transactional SQL queries in high volume PostgreSQL environments, guaranteeing strict transaction consistency.</li>
            <li>Communicated directly with enterprise clients and product owners to translate complex business requirements into clear technical roadmaps and reliable sprint deliverables.</li>
          </ul>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Academic Engagements & Education</div>

        <div class="edu-block">
          <div class="edu-header">
            <div>
              <span class="edu-degree">Universitatea de Vest din Timișoara (UVT)</span> | 
              <span class="edu-school">Academic Collaborator</span>
            </div>
            <span class="edu-date">2026 to Present</span>
          </div>
          <div class="edu-desc">
            Academic collaboration with Professor Cristian Cira at the Faculty of Mathematics and Computer Science, conducting workshops and guest lectures on enterprise software architecture and practical AI engineering.
          </div>
        </div>

        <div class="edu-block">
          <div class="edu-header">
            <div>
              <span class="edu-degree">Bachelor of Science in Cybersecurity</span> | 
              <span class="edu-school">Polytechnic University of Valencia, Spain</span>
            </div>
            <span class="edu-date">Sept 2018 to Jun 2022</span>
          </div>
          <div class="edu-desc">
            Comprehensive academic curriculum covering Software Engineering, Distributed Systems, Relational Database Internals, Application Security, and Secure Software Development Lifecycles.
          </div>
        </div>

        <div class="edu-block">
          <div class="edu-header">
            <div>
              <span class="edu-degree">Oracle Certified Professional: Java SE 21 Developer</span> | 
              <span class="edu-school">Oracle Corporation</span>
            </div>
            <span class="edu-date">Certified 2023</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Languages & Cultural Background</div>
        <p style="font-size: 8.8pt; color: #334155; line-height: 1.48; margin: 0;">
          <strong>Romanian:</strong> Native (Bilingual fluency) &bull; 
          <strong>English:</strong> Full Professional Proficiency (C1 level, fluent in technical and client communication) &bull; 
          <strong>Spanish:</strong> Native (Bilingual fluency, completed university degree and professional tenure in Spain)
        </p>
      </div>
    </div>

    <div class="page-footer">
      <span>Stefan Antonio Cirisanu | Senior Software Engineer</span>
      <span>Page 2 of 2</span>
    </div>
  </div>

</body>
</html>
`;

async function buildCv() {
  const outputPath = path.resolve('Stefan_Antonio_Cirisanu_CV.pdf');
  console.log('Rendering clean Sam Altman style CV with photo...');

  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'clean-cv-'));
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: tmpDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Save PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    console.log('PDF rendered successfully at:', outputPath);

    // Save visual snapshots of Page 1 and Page 2 for review
    const p1 = await page.$('#page-1');
    if (p1) {
      await p1.screenshot({ path: path.resolve('cv_page_1.png') });
      console.log('Page 1 screenshot saved.');
    }
    const p2 = await page.$('#page-2');
    if (p2) {
      await p2.screenshot({ path: path.resolve('cv_page_2.png') });
      console.log('Page 2 screenshot saved.');
    }
  } finally {
    await browser.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

buildCv().catch(err => {
  console.error('Error generating clean CV:', err);
  process.exit(1);
});
