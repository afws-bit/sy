#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { createInterface } from 'readline';
import { once } from 'events';

// ----------------------------------------------------------------------
// Utility: similarity between two strings (Jaccard on character bigrams)
// ----------------------------------------------------------------------
function similarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  if (s1 === s2) return 1;

  const bigrams = (str) => {
    const grams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      grams.add(str.slice(i, i + 2));
    }
    return grams;
  };

  const set1 = bigrams(s1);
  const set2 = bigrams(s2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

// ----------------------------------------------------------------------
// Extract fenced code blocks from the text
// ----------------------------------------------------------------------
function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(\w*)\s*\n([\s\S]*?)```/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const language = match[1].trim().toLowerCase();
    // Remove trailing newline for cleaner output
    const code = match[2].replace(/\n$/, '');
    const precedingText = text.slice(lastIndex, match.index);
    blocks.push({ language, code, precedingText });
    lastIndex = regex.lastIndex;
  }

  return blocks;
}

// ----------------------------------------------------------------------
// Recursively scan a directory for files, skipping common non‑source dirs
// ----------------------------------------------------------------------
async function scanFiles(dir, skipDirs = new Set(['node_modules', '.git'])) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        results.push(...(await scanFiles(fullPath, skipDirs)));
      }
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

// ----------------------------------------------------------------------
// Map language identifiers to common file extensions
// ----------------------------------------------------------------------
const langExtensions = {
  bash: ['.sh', '.bash'],
  sh: ['.sh', '.bash'],
  shell: ['.sh', '.bash'],
  javascript: ['.js', '.mjs', '.cjs'],
  js: ['.js', '.mjs', '.cjs'],
  node: ['.js', '.mjs', '.cjs'],
  assembly: ['.asm', '.s', '.S'],
  asm: ['.asm', '.s', '.S'],
  python: ['.py'],
  py: ['.py'],
  ruby: ['.rb'],
  go: ['.go'],
  rust: ['.rs'],
  c: ['.c', '.h'],
  'c++': ['.cpp', '.hpp', '.cc'],
  cpp: ['.cpp', '.hpp', '.cc'],
  java: ['.java'],
  // Add more as needed
};

// ----------------------------------------------------------------------
// Heuristically detect language from code content (when no fence language)
// ----------------------------------------------------------------------
function detectLanguageFromCode(code) {
  const firstLine = code.split('\n')[0].trim();

  // Shebang checks
  if (firstLine.startsWith('#!/bin/bash') || firstLine.startsWith('#!/usr/bin/env bash'))
    return 'bash';
  if (firstLine.startsWith('#!/usr/bin/env node') || firstLine.includes('node'))
    return 'javascript';
  if (firstLine.startsWith('#!/usr/bin/env python') || firstLine.startsWith('#!/usr/bin/python'))
    return 'python';

  // Assembly patterns
  if (/\b(\.globl|\.section|\.text|\.data|mov\s|eax|ebx|esp|ebp)\b/.test(code))
    return 'assembly';

  // JavaScript patterns
  if (/\b(function|const|let|var|=>|require\(|import\s|export\s|console\.log)\b/.test(code))
    return 'javascript';

  // Bash patterns
  if (/\b(echo|if\s*\[|fi|done|then|else|while|for\s+.*\s+in)\b/.test(code) &&
      !/\b(function|const|let|var)\b/.test(code))
    return 'bash';

  return ''; // unknown
}

// ----------------------------------------------------------------------
// Extract a filename from surrounding text or code comments
// ----------------------------------------------------------------------
function extractFilenameFromText(text) {
  if (!text) return null;

  // Explicit label: "file:", "filename:", "path:"
  const explicit = /(?:file|filename|path)\s*:\s*([^\s]+)/i.exec(text);
  if (explicit) return explicit[1];

  // Look for any word with a known extension, prefer the last occurrence
  const knownExtensions = new Set(Object.values(langExtensions).flat());
  const pathLike = /([^\s]+\.[a-zA-Z0-9]+)/g;
  const matches = text.match(pathLike);
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const ext = path.extname(matches[i]).toLowerCase();
      if (knownExtensions.has(ext)) {
        return matches[i];
      }
    }
  }

  return null;
}

// ----------------------------------------------------------------------
// Find the best matching file for a code block
// ----------------------------------------------------------------------
async function findMatchingFile(block, allFiles) {
  let lang = block.language;
  if (!lang) {
    lang = detectLanguageFromCode(block.code);
  }

  const extensions = langExtensions[lang] || [];
  const extractedFilename =
    extractFilenameFromText(block.precedingText) || extractFilenameFromText(block.code);

  // Filter candidates by extension if possible
  let candidates = allFiles;
  if (extensions.length > 0) {
    const filtered = allFiles.filter((file) =>
      extensions.includes(path.extname(file).toLowerCase())
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
    // if no files with that extension, keep all files (similarity will decide)
  }

  if (candidates.length === 0) return null;

  // Direct match attempts
  if (extractedFilename) {
    const extractedBase = path.basename(extractedFilename);
    const directBase = candidates.find((file) => path.basename(file) === extractedBase);
    if (directBase) return directBase;

    const absoluteCandidate = path.resolve(process.cwd(), extractedFilename);
    if (candidates.includes(absoluteCandidate)) return absoluteCandidate;
  }

  // Score candidates
  let bestScore = -1;
  let bestFile = null;
  const candidateCount = candidates.length;

  for (const file of candidates) {
    let score = 0;
    const fileExt = path.extname(file).toLowerCase();

    // Extension match
    if (extensions.length > 0 && extensions.includes(fileExt)) {
      score += 100;
    }

    // Filename similarity
    if (extractedFilename) {
      const fileNameSim = similarity(extractedFilename, path.basename(file));
      score += fileNameSim * 50;
    }

    // Shebang match (only if candidate count is small enough to avoid heavy I/O)
    if (candidateCount <= 100) {
      try {
        const fileContent = await fs.readFile(file, 'utf8');
        const blockShebang = block.code.split('\n')[0].trim();
        const fileShebang = fileContent.split('\n')[0].trim();
        if (blockShebang.startsWith('#!') && blockShebang === fileShebang) {
          score += 30;
        }
      } catch {
        // ignore unreadable files
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestFile = file;
    }
  }

  // If the best score is extremely low (no real match), return null
  if (bestScore === 0) return null;
  return bestFile;
}

// ----------------------------------------------------------------------
// Simple CLI prompt
// ----------------------------------------------------------------------
async function askQuestion(query) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node replace-codes.mjs <input-file>');
    process.exit(1);
  }

  const inputFile = args[0];
  let text;
  try {
    text = await fs.readFile(inputFile, 'utf8');
  } catch (err) {
    console.error(`Error reading input file "${inputFile}":`, err.message);
    process.exit(1);
  }

  console.log('Extracting code blocks...');
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) {
    console.log('No fenced code blocks found. Exiting.');
    process.exit(0);
  }
  console.log(`Found ${blocks.length} code block(s).`);

  console.log('Scanning files in current directory (recursively)...');
  const cwd = process.cwd();
  const allFiles = await scanFiles(cwd);
  console.log(`Scanned ${allFiles.length} file(s).`);

  console.log('Matching code blocks to files...');
  const matches = [];
  for (const block of blocks) {
    const file = await findMatchingFile(block, allFiles);
    matches.push({ block, file });
    const lang = block.language || detectLanguageFromCode(block.code) || 'unknown';
    const rel = file ? path.relative(cwd, file) : 'NOT FOUND';
    console.log(`- [${lang}] -> ${rel}`);
  }

  // Show summary and prompt
  console.log('\nMatched files:');
  matches.forEach((m, i) => {
    const lang = m.block.language || detectLanguageFromCode(m.block.code) || 'unknown';
    const rel = m.file ? path.relative(cwd, m.file) : 'NOT FOUND';
    console.log(`${i + 1}. [${lang}] ${rel}`);
  });

  const answer = await askQuestion(
    '\nEnter numbers to replace (comma-separated), "all" to replace all, or "q" to quit: '
  );

  if (answer.toLowerCase() === 'q') {
    console.log('Exiting without changes.');
    process.exit(0);
  }

  let selectedIndices = [];
  if (answer.toLowerCase() === 'all') {
    selectedIndices = matches.map((_, i) => i);
  } else {
    selectedIndices = answer
      .split(',')
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((i) => !isNaN(i) && i >= 0 && i < matches.length);
  }

  for (const idx of selectedIndices) {
    const m = matches[idx];
    if (!m.file) {
      console.log(`Skipping block ${idx + 1} – no file found.`);
      continue;
    }

    let newContent = m.block.code;
    if (!newContent.endsWith('\n')) {
      newContent += '\n';
    }
    try {
      await fs.writeFile(m.file, newContent, 'utf8');
      console.log(`Replaced ${path.relative(cwd, m.file)}`);
    } catch (err) {
      console.error(`Failed to write ${path.relative(cwd, m.file)}:`, err.message);
    }
  }

  console.log('Done.');
}

// ----------------------------------------------------------------------
// Execute
// ----------------------------------------------------------------------
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});