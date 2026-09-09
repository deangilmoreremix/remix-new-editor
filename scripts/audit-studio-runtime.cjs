const fs = require('fs');
const path = require('path');

const STUDIO_DIR = 'src/components';
const STUDIOS = fs.readdirSync(STUDIO_DIR).filter(f => f.endsWith('.js') || f.endsWith('.jsx'));

const results = {
  hardcodedLocalhost: [],
  unguardedWindow: [],
  unguardedDocument: [],
  unguardedLocalStorage: [],
  envVarUsage: [],
  suspiciousPatterns: []
};

for (const file of STUDIOS) {
  const fullPath = path.join(STUDIO_DIR, file);
  const code = fs.readFileSync(fullPath, 'utf8');
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Hardcoded localhost URLs
    if (/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(trimmed)) {
      results.hardcodedLocalhost.push({ file, line: i + 1, content: trimmed });
    }

    // Unguarded window. usage
    if (/window\./.test(trimmed) && !/if\s*\(.*window/.test(trimmed) && !/typeof\s+window/.test(trimmed) && !/window\s*\|\|/.test(trimmed)) {
      results.unguardedWindow.push({ file, line: i + 1, content: trimmed });
    }

    // Unguarded document. usage
    if (/document\./.test(trimmed) && !/if\s*\(.*document/.test(trimmed) && !/typeof\s+document/.test(trimmed) && !/document\s*\|\|/.test(trimmed)) {
      results.unguardedDocument.push({ file, line: i + 1, content: trimmed });
    }

    // Unguarded localStorage. usage
    if (/localStorage\./.test(trimmed) && !/try\s*\{/.test(trimmed) && !/catch/.test(trimmed)) {
      results.unguardedLocalStorage.push({ file, line: i + 1, content: trimmed });
    }

    // Environment variable usage
    if (/import\.meta\.env/.test(trimmed) || /process\.env/.test(trimmed)) {
      results.envVarUsage.push({ file, line: i + 1, content: trimmed });
    }

    // Other suspicious patterns
    if (/console\.log\(/.test(trimmed) && !/console\.error\(/.test(trimmed)) {
      results.suspiciousPatterns.push({ file, line: i + 1, type: 'console.log', content: trimmed });
    }
  }
}

console.log(JSON.stringify(results, null, 2));
