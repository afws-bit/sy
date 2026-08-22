// bundle.js - FINAL VERSION WITH COMPLETE CIRCULAR DEPENDENCY FIX + PRECISE STATIC PROPERTY MATCHING
import { readFileSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ModuleBundler {
  constructor(entryFile, options = {}) {
    this.entryFile = resolve(entryFile);
    this.processedModules = new Map();
    this.moduleRegistry = new Map();
    this.moduleCounter = 0;
    this.debug = options.debug === true;
    this.circularDependencies = new Set();
  }

  // --- Module type helpers ---
  isNativeModule(moduleName) {
    const cleanName = moduleName.startsWith('node:') ? moduleName.slice(5) : moduleName;
    if (builtinModules.includes(cleanName)) return true;
    const baseModule = cleanName.split('/')[0];
    return builtinModules.includes(baseModule);
  }

  // --- Import / Export parsing (unchanged) ---
  parseImports(content) {
    const imports = [];
    let pos = 0;
    while (pos < content.length) {
      const importMatch = content.slice(pos).match(/\bimport\b/);
      if (!importMatch) break;
      const importStart = pos + importMatch.index;
      if (this.isInsideString(content, importStart)) {
        pos = importStart + 6;
        continue;
      }
      const afterImport = content.slice(importStart + 6).trimStart();
      if (afterImport.startsWith('.') || afterImport.startsWith('(')) {
        pos = importStart + 6;
        continue;
      }
      const importEnd = this.findImportEnd(content, importStart);
      if (importEnd === -1) break;
      const fullStatement = content.slice(importStart, importEnd + 1);
      const parsed = this.parseImportStatement(fullStatement);
      if (parsed) {
        imports.push({
          ...parsed,
          fullStatement,
          position: importStart,
          endPosition: importEnd + 1,
        });
      }
      pos = importEnd + 1;
    }
    return imports;
  }

  parseImportStatement(statement) {
    const normalized = statement.replace(/\s+/g, ' ').trim();
    let match;
    // side-effect import
    match = normalized.match(/^import\s+['"]([^'"]+)['"]\s*;?$/);
    if (match) {
      return {
        modulePath: match[1],
        isNative: this.isNativeModule(match[1]),
        type: 'side-effect',
        defaultImport: null,
        namedImports: [],
        namespaceImport: null,
      };
    }
    // default import
    match = normalized.match(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?$/);
    if (match) {
      return {
        modulePath: match[2],
        isNative: this.isNativeModule(match[2]),
        type: 'default',
        defaultImport: match[1],
        namedImports: [],
        namespaceImport: null,
      };
    }
    // named imports
    match = normalized.match(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?$/);
    if (match) {
      const names = match[1].split(',').map(n => {
        const parts = n.trim().split(/\s+as\s+/);
        return { original: parts[0].trim(), alias: parts[1] ? parts[1].trim() : parts[0].trim() };
      });
      return {
        modulePath: match[2],
        isNative: this.isNativeModule(match[2]),
        type: 'named',
        defaultImport: null,
        namedImports: names,
        namespaceImport: null,
      };
    }
    // namespace import
    match = normalized.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?$/);
    if (match) {
      return {
        modulePath: match[2],
        isNative: this.isNativeModule(match[2]),
        type: 'namespace',
        defaultImport: null,
        namedImports: [],
        namespaceImport: match[1],
      };
    }
    // combined default + named
    match = normalized.match(/^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?$/);
    if (match) {
      const names = match[2].split(',').map(n => {
        const parts = n.trim().split(/\s+as\s+/);
        return { original: parts[0].trim(), alias: parts[1] ? parts[1].trim() : parts[0].trim() };
      });
      return {
        modulePath: match[3],
        isNative: this.isNativeModule(match[3]),
        type: 'combined',
        defaultImport: match[1],
        namedImports: names,
        namespaceImport: null,
      };
    }
    return null;
  }

  parseExports(content) {
    const exports = {
      defaultExport: null,
      namedExports: new Set(),
      hasDefault: false,
      defaultExpression: null,
    };
    // Support `export default async function`
    const defaultFuncMatch = content.match(/export\s+default\s+(?:async\s+)?function\s+(\w+)/);
    const defaultClassMatch = content.match(/export\s+default\s+class\s+(\w+)/);
    const defaultExprMatch = content.match(/export\s+default\s+([^;\n]+)/);
    if (defaultFuncMatch) {
      exports.hasDefault = true;
      exports.defaultExport = defaultFuncMatch[1];
    } else if (defaultClassMatch) {
      exports.hasDefault = true;
      exports.defaultExport = defaultClassMatch[1];
    } else if (defaultExprMatch) {
      exports.hasDefault = true;
      const expr = defaultExprMatch[1].trim();
      if (/^\d|^["'`\[{]|^null$|^undefined$|^true$|^false$/.test(expr) || expr.includes('.')) {
        exports.defaultExpression = expr;
      } else {
        exports.defaultExport = expr;
      }
    }
    // Include `async function` in named export matching
    const namedRegex = /export\s+(?:const|let|var|class|async\s+function|function)\s+(\w+)/g;
    let match;
    while ((match = namedRegex.exec(content)) !== null) {
      exports.namedExports.add(match[1]);
    }
    const exportListRegex = /export\s+\{([^}]+)\}/g;
    while ((match = exportListRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      names.forEach(name => exports.namedExports.add(name));
    }
    return exports;
  }

  stripAllModuleSyntax(content, imports) {
    const sortedImports = [...imports].sort((a, b) => b.position - a.position);
    let cleaned = content;
    for (const imp of sortedImports) {
      cleaned = cleaned.slice(0, imp.position) + cleaned.slice(imp.endPosition);
    }
    cleaned = cleaned.replace(/^#!.*\n/, '');
    // Strip `export default async function` before the generic default function regex
    cleaned = cleaned.replace(/export\s+default\s+async\s+function\s+(\w+)/g, 'async function $1');
    // Strip `export async function` before the generic export regex
    cleaned = cleaned.replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1');
    // Existing default and named export stripping (unchanged)
    cleaned = cleaned.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    cleaned = cleaned.replace(/export\s+default\s+class\s+(\w+)/g, 'class $1');
    cleaned = cleaned.replace(/export\s+default\s+/g, 'var _defaultExport = ');
    cleaned = cleaned.replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ');
    cleaned = cleaned.replace(/export\s+\{[^}]*\}\s*;?/g, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();
    return cleaned;
  }

  // --- String & brace utilities (unchanged) ---
  isInsideString(content, position) {
    let inString = false, stringChar = '', inTemplate = false, escape = false;
    for (let i = 0; i < position; i++) {
      const char = content[i];
      if (escape) { escape = false; continue; }
      if (char === '\\') { escape = true; continue; }
      if (inTemplate) {
        if (char === '`' && content[i - 1] !== '\\') inTemplate = false;
        continue;
      }
      if (inString) {
        if (char === stringChar && content[i - 1] !== '\\') { inString = false; stringChar = ''; }
        continue;
      }
      if (char === '`') { inTemplate = true; continue; }
      if (char === "'" || char === '"') { inString = true; stringChar = char; }
    }
    return inString || inTemplate;
  }

  findImportEnd(content, startPos) {
    let i = startPos, depth = 0, inString = false, stringChar = '', inTemplate = false, escape = false;
    while (i < content.length) {
      const char = content[i];
      if (escape) { escape = false; i++; continue; }
      if (char === '\\') { escape = true; i++; continue; }
      if (inTemplate) {
        if (char === '`') inTemplate = false;
        else if (char === '$' && content[i + 1] === '{') { depth++; i += 2; continue; }
        i++;
        continue;
      }
      if (inString) {
        if (char === stringChar) { inString = false; stringChar = ''; }
        i++;
        continue;
      }
      if (char === '`') { inTemplate = true; i++; continue; }
      if (char === "'" || char === '"') { inString = true; stringChar = char; i++; continue; }
      if (char === '{') depth++;
      else if (char === '}') { if (depth > 0) depth--; }
      else if (char === ';' && depth === 0) return i;
      else if (char === '\n' && depth === 0) {
        const line = content.slice(startPos, i).trim();
        if (line.endsWith("'") || line.endsWith('"') || line.endsWith('`')) return i;
        if (line.includes('from') && (line.includes("'") || line.includes('"'))) return i - 1;
      }
      i++;
    }
    return -1;
  }

  resolveModulePath(importPath, currentFilePath) {
    if (this.isNativeModule(importPath)) return importPath;
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      let resolvedPath = resolve(dirname(currentFilePath), importPath);
      try {
        statSync(resolvedPath);
        return resolvedPath;
      } catch (e) {
        try {
          statSync(resolvedPath + '.js');
          return resolvedPath + '.js';
        } catch (e2) {
          try {
            statSync(resolve(resolvedPath, 'index.js'));
            return resolve(resolvedPath, 'index.js');
          } catch (e3) {
            return resolvedPath + '.js';
          }
        }
      }
    }
    return importPath;
  }

  /**
   * COMPREHENSIVE main-check transformation.
   * Catches ALL known patterns including Qemu's specific pattern.
   */
  transformMainCheck(content, isEntry) {
    let transformed = content;
    let replaced = false;
    let matchCount = 0;

    const patterns = [
      {
        regex: /if\s*\(\s*process\.argv\[1\]\s*===?\s*fileURLToPath\(import\.meta\.url\)\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*fileURLToPath\(import\.meta\.url\)\s*===?\s*process\.argv\[1\]\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*process\.argv\[1\]\s*===?\s*__filename\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*__filename\s*===?\s*process\.argv\[1\]\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*require\.main\s*===?\s*module\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*module\s*===?\s*require\.main\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*import\.meta\.url\s*===?\s*`file:\/\/\$\{process\.argv\[1\]\}`\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*import\.meta\.url\s*===?\s*process\.argv\[1\]\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*\!\s*module\.parent\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
      {
        regex: /if\s*\(\s*module\.parent\s*===?\s*null\s*\)\s*\{/g,
        replacement: (match) => isEntry 
          ? `if (true) { // was: ${match.trim()}`
          : `if (false) { // was: ${match.trim()}`
      },
    ];

    for (const { regex, replacement } of patterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(transformed)) !== null) {
        const fullMatch = match[0];
        const newCode = replacement(fullMatch);
        
        if (this.debug) {
          const lineNum = transformed.slice(0, match.index).split('\n').length;
          console.log(`     📝 Line ${lineNum}: ${fullMatch.trim().substring(0, 60)}... → ${isEntry ? 'ENABLED' : 'DISABLED'}`);
        }
        
        transformed = transformed.slice(0, match.index) + newCode + transformed.slice(match.index + fullMatch.length);
        regex.lastIndex = match.index + newCode.length;
        replaced = true;
        matchCount++;
      }
    }

    if (this.debug && replaced) {
      console.log(`   🔧 Main-check ${isEntry ? 'ENABLED (entry)' : 'DISABLED'} - ${matchCount} occurrence(s) modified`);
    }
    
    return transformed;
  }

  /**
   * Transform circular dependencies through lazy loading.
   * This is the main entry point for handling circular dependency issues.
   */
  transformCircularDependencies(content, imports, currentFilePath) {
    // Build a map of imported identifiers to their source module info
    const importInfoMap = new Map();
    
    for (const imp of imports) {
      if (imp.isNative) continue;

      const depPath = this.resolveModulePath(imp.modulePath, currentFilePath);
      const depModule = this.moduleRegistry.get(depPath);
      if (!depModule || depModule.isNative) continue;

      // Check if this is a circular dependency
      const isCircular = this.isCircularDependency(currentFilePath, depPath);
      
      const depId = depModule.id;

      // Default import
      if (imp.defaultImport) {
        importInfoMap.set(imp.defaultImport, {
          depId,
          accessor: 'default',
          type: 'default',
          isCircular
        });
      }

      // Named imports (including those from combined imports)
      if (imp.namedImports && imp.namedImports.length > 0) {
        for (const named of imp.namedImports) {
          const localName = named.alias || named.original;
          importInfoMap.set(localName, {
            depId,
            accessor: named.original,
            type: 'named',
            isCircular
          });
        }
      }

      // Namespace import
      if (imp.namespaceImport) {
        importInfoMap.set(imp.namespaceImport, {
          depId,
          accessor: null,
          type: 'namespace',
          isCircular
        });
      }
    }

    // Transform static property assignments
    content = this.transformStaticProperties(content, importInfoMap);
    
    // Transform constructor references in circular dependencies
    content = this.transformConstructorReferences(content, importInfoMap);

    return content;
  }

  /**
   * Transform static property assignments that reference imported modules
   * into lazy getters to break circular dependencies.
   * FIXED: More precise regex to avoid matching method calls
   */
  transformStaticProperties(content, importInfoMap) {
    // More precise regex: matches only simple static assignments, not method calls
    // Pattern: static PropertyName = Identifier; (with optional semicolon)
    // Uses negative lookahead to avoid matching when followed by . or (
    const staticAssignRegex = /static\s+(\w+)\s*=\s*([A-Za-z_$][\w$]*)\s*(?=[;\n]|$)/g;
    const replacements = [];
    let match;

    while ((match = staticAssignRegex.exec(content)) !== null) {
      const [full, propName, importedIdent] = match;
      const info = importInfoMap.get(importedIdent);
      if (!info) continue;

      // Double-check: ensure this is really a static property assignment
      // and not part of a larger expression
      const beforeMatch = content.slice(Math.max(0, match.index - 20), match.index);
      const afterMatch = content.slice(match.index + full.length, match.index + full.length + 20);
      
      // Skip if this appears to be part of a method chain or call
      if (afterMatch.trimStart().startsWith('.') || afterMatch.trimStart().startsWith('(')) {
        continue;
      }

      let requireExpr;
      if (info.type === 'namespace') {
        requireExpr = `__require('${info.depId}')`;
      } else if (info.type === 'default') {
        requireExpr = `__require('${info.depId}').default`;
      } else { // named
        requireExpr = `__require('${info.depId}').${info.accessor}`;
      }

      const getter = `static get ${propName}() { return ${requireExpr}; }`;

      replacements.push({
        start: match.index,
        end: match.index + full.length,
        replacement: getter,
        propName,
        importedIdent
      });

      if (this.debug) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        console.log(`     🔄 Static property: ${propName} = ${importedIdent} → lazy getter (line ${lineNum})`);
      }
    }

    if (replacements.length === 0) return content;

    // Apply replacements from end to start to avoid shifting indices
    let result = content;
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
      result = result.slice(0, replacement.start) + replacement.replacement + result.slice(replacement.end);
    }

    return result;
  }

  /**
   * Transform constructor references in circular dependencies
   * to use lazy loading.
   */
  transformConstructorReferences(content, importInfoMap) {
    // Find patterns like: new EasyAI(...) where EasyAI is a circular import
    const constructorRegex = /new\s+([A-Za-z_$][\w$]*)\s*\(/g;
    const replacements = [];
    let match;

    while ((match = constructorRegex.exec(content)) !== null) {
      const [full, constructorName] = match;
      const info = importInfoMap.get(constructorName);
      
      // Only transform if this is a circular dependency
      if (!info || !info.isCircular) continue;

      let requireExpr;
      if (info.type === 'default') {
        requireExpr = `__require('${info.depId}').default`;
      } else if (info.type === 'named') {
        requireExpr = `__require('${info.depId}').${info.accessor}`;
      } else {
        continue; // Skip namespace imports for constructor references
      }

      const lazyConstructor = `new (${requireExpr})(`;

      replacements.push({
        start: match.index,
        end: match.index + full.length,
        replacement: lazyConstructor,
        constructorName
      });

      if (this.debug) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        console.log(`     🔄 Constructor: new ${constructorName}(...) → lazy loading (line ${lineNum})`);
      }
    }

    if (replacements.length === 0) return content;

    // Apply replacements from end to start to avoid shifting indices
    let result = content;
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
      result = result.slice(0, replacement.start) + replacement.replacement + result.slice(replacement.end);
    }

    return result;
  }

  /**
   * Detect if two modules have a circular dependency.
   */
  isCircularDependency(moduleA, moduleB) {
    // Simple check: if moduleA imports moduleB and moduleB imports moduleA
    const moduleAInfo = this.moduleRegistry.get(moduleA);
    const moduleBInfo = this.moduleRegistry.get(moduleB);
    
    if (!moduleAInfo || !moduleBInfo) return false;
    
    // Check if B imports A
    const bImportsA = moduleBInfo.imports.some(imp => {
      if (imp.isNative) return false;
      const resolvedPath = this.resolveModulePath(imp.modulePath, moduleB);
      return resolvedPath === moduleA;
    });
    
    return bImportsA;
  }

  // --- Main processing ---
  processModule(filePath) {
    if (this.moduleRegistry.has(filePath)) {
      return this.moduleRegistry.get(filePath);
    }

    if (this.isNativeModule(filePath)) {
      const moduleInfo = {
        id: `native_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        path: filePath,
        isNative: true,
        imports: [],
        exports: null,
        content: null,
      };
      this.moduleRegistry.set(filePath, moduleInfo);
      return moduleInfo;
    }

    try {
      const originalContent = readFileSync(filePath, 'utf8');
      const imports = this.parseImports(originalContent);
      const exports = this.parseExports(originalContent);
      let cleanedContent = this.stripAllModuleSyntax(originalContent, imports);

      // Apply main‑check transformation
      const isEntry = (filePath === this.entryFile);
      cleanedContent = this.transformMainCheck(cleanedContent, isEntry);

      const moduleId = `module_${this.moduleCounter++}`;

      const moduleInfo = {
        id: moduleId,
        path: filePath,
        isNative: false,
        imports,
        exports,
        content: cleanedContent,
        originalContent,
        relativePath: relative(process.cwd(), filePath),
      };

      this.moduleRegistry.set(filePath, moduleInfo);
      this.processedModules.set(filePath, moduleInfo);

      if (this.debug) {
        console.log(`📄 Processed: ${moduleInfo.relativePath}`);
        if (imports.length > 0) {
          console.log(`   Imports: ${imports.map(i => i.modulePath).join(', ')}`);
        }
        if (exports.hasDefault || exports.namedExports.size > 0) {
          const expList = [];
          if (exports.hasDefault) expList.push('default');
          expList.push(...exports.namedExports);
          console.log(`   Exports: ${expList.join(', ')}`);
        }
      }

      // Process dependencies first (so their module IDs are known)
      for (const imp of imports) {
        if (!imp.isNative) {
          const resolvedPath = this.resolveModulePath(imp.modulePath, filePath);
          this.processModule(resolvedPath);
        }
      }

      // Now that dependencies are registered, transform circular dependencies
      cleanedContent = this.transformCircularDependencies(cleanedContent, imports, filePath);
      moduleInfo.content = cleanedContent;

      return moduleInfo;
    } catch (error) {
      console.error(`❌ Error processing module ${filePath}:`, error.message);
      throw error;
    }
  }

  // --- Bundle generation (with circular dependency fix) ---
  generateBundle() {
    let output = '';
    const modules = Array.from(this.processedModules.values());

    output += '// ========================================\n';
    output += '// Auto-generated bundle\n';
    output += `// Entry: ${relative(process.cwd(), this.entryFile)}\n`;
    output += `// Generated: ${new Date().toISOString()}\n`;
    output += `// Modules bundled: ${modules.length}\n`;
    output += '// ========================================\n\n';

    const entryModule = this.moduleRegistry.get(this.entryFile);
    if (entryModule) {
      const lines = entryModule.originalContent.split('\n');
      if (lines[0] && lines[0].startsWith('#!')) {
        output += `${lines[0]}\n\n`;
      }
    }

    output += "import { createRequire } from 'module';\n";
    output += "const __nativeRequire = createRequire(import.meta.url);\n\n";
    output += 'const __modules = {};\n';
    output += 'const __moduleCache = {};\n';
    output += 'const __moduleExports = {};\n';
    output += 'function __require(id) {\n';
    output += '  if (__moduleCache[id]) return __moduleExports[id];\n';
    output += '  if (!__modules[id]) throw new Error(`Module ${id} not found`);\n';
    output += '  __moduleCache[id] = true;\n';
    output += '  __moduleExports[id] = {};\n';
    output += '  const exports = __modules[id](__moduleExports[id]);\n';
    output += '  __moduleExports[id] = exports || __moduleExports[id];\n';
    output += '  return __moduleExports[id];\n';
    output += '}\n\n';

    for (const module of modules) {
      const relativePath = relative(process.cwd(), module.path);
      output += `// ========================================\n`;
      output += `// Module: ${relativePath}\n`;
      output += `// ========================================\n`;
      if (module.imports.length > 0) {
        output += `// Original imports:\n`;
        for (const imp of module.imports) {
          output += `// ${imp.fullStatement.replace(/\n/g, ' ')}\n`;
        }
        output += '\n';
      }

      output += `__modules['${module.id}'] = function(exports) {\n`;
      output += `  exports = exports || {};\n`;
      output += `  var module = { exports: exports };\n\n`;

      for (const imp of module.imports) {
        if (imp.isNative) {
          if (imp.type === 'default') {
            output += `  var ${imp.defaultImport} = __nativeRequire('${imp.modulePath}');\n`;
          } else if (imp.type === 'named') {
            const names = imp.namedImports.map(n =>
              n.original !== n.alias ? `${n.original}: ${n.alias}` : n.original
            ).join(', ');
            output += `  var { ${names} } = __nativeRequire('${imp.modulePath}');\n`;
          } else if (imp.type === 'namespace') {
            output += `  var ${imp.namespaceImport} = __nativeRequire('${imp.modulePath}');\n`;
          } else if (imp.type === 'side-effect') {
            output += `  __nativeRequire('${imp.modulePath}');\n`;
          } else if (imp.type === 'combined') {
            output += `  var ${imp.defaultImport} = __nativeRequire('${imp.modulePath}');\n`;
            const namedNames = imp.namedImports.map(n =>
              n.original !== n.alias ? `${n.original}: ${n.alias}` : n.original
            ).join(', ');
            if (namedNames) {
              output += `  var { ${namedNames} } = __nativeRequire('${imp.modulePath}');\n`;
            }
          }
        } else {
          const depPath = this.resolveModulePath(imp.modulePath, module.path);
          const depModule = this.moduleRegistry.get(depPath);
          if (depModule && !depModule.isNative) {
            // Check if this is a circular dependency
            const isCircular = this.isCircularDependency(module.path, depPath);
            
            if (imp.type === 'default') {
              if (isCircular) {
                // For circular dependencies, use lazy loading with Proxy
                output += `  var ${imp.defaultImport} = new Proxy({}, { get: (_, prop) => { const mod = __require('${depModule.id}'); return prop === 'default' ? mod.default : mod[prop]; } });\n`;
              } else {
                output += `  var ${imp.defaultImport} = __require('${depModule.id}').default;\n`;
              }
            } else if (imp.type === 'named') {
              const names = imp.namedImports.map(n =>
                n.original !== n.alias ? `${n.original}: ${n.alias}` : n.original
              ).join(', ');
              if (isCircular) {
                // For circular dependencies, use lazy loading for each named import
                for (const named of imp.namedImports) {
                  const localName = named.alias || named.original;
                  output += `  var ${localName} = undefined; Object.defineProperty(this, '${localName}', { get: () => __require('${depModule.id}').${named.original} });\n`;
                }
              } else {
                output += `  var { ${names} } = __require('${depModule.id}');\n`;
              }
            } else if (imp.type === 'namespace') {
              if (isCircular) {
                output += `  var ${imp.namespaceImport} = new Proxy({}, { get: (_, prop) => __require('${depModule.id}')[prop] });\n`;
              } else {
                output += `  var ${imp.namespaceImport} = __require('${depModule.id}');\n`;
              }
            } else if (imp.type === 'combined') {
              if (isCircular) {
                output += `  var ${imp.defaultImport} = new Proxy({}, { get: (_, prop) => { const mod = __require('${depModule.id}'); return prop === 'default' ? mod.default : mod[prop]; } });\n`;
                for (const named of imp.namedImports) {
                  const localName = named.alias || named.original;
                  output += `  var ${localName} = undefined; Object.defineProperty(this, '${localName}', { get: () => __require('${depModule.id}').${named.original} });\n`;
                }
              } else {
                output += `  var ${imp.defaultImport} = __require('${depModule.id}').default;\n`;
                const namedNames = imp.namedImports.map(n =>
                  n.original !== n.alias ? `${n.original}: ${n.alias}` : n.original
                ).join(', ');
                if (namedNames) {
                  output += `  var { ${namedNames} } = __require('${depModule.id}');\n`;
                }
              }
            }
          }
        }
      }

      output += '\n';
      const lines = module.content.split('\n');
      for (const line of lines) {
        output += '  ' + line + '\n';
      }
      output += '\n';

      if (module.exports.hasDefault) {
        if (module.exports.defaultExpression) {
          output += `  exports.default = ${module.exports.defaultExpression};\n`;
        } else if (module.exports.defaultExport) {
          output += `  exports.default = ${module.exports.defaultExport};\n`;
        } else {
          output += `  exports.default = _defaultExport;\n`;
        }
      }
      for (const name of module.exports.namedExports) {
        if (typeof name === 'string' && name !== 'default') {
          output += `  exports.${name} = ${name};\n`;
        }
      }
      output += `  return exports;\n`;
      output += `};\n\n`;
    }

    if (entryModule) {
      const namedExports = Array.from(entryModule.exports.namedExports).filter(n => n !== 'default');
      output += `// ========================================\n`;
      output += `// Entry module execution\n`;
      output += `// ========================================\n`;
      output += `const __entry = __require('${entryModule.id}');\n`;
      output += `export default __entry.default;\n`;
      if (namedExports.length > 0) {
        output += `export const { ${namedExports.join(', ')} } = __entry;\n`;
      }
    }

    return output;
  }

  bundle(outputFile) {
    if (this.debug) console.log(`🔍 Debug mode ON`);
    console.log(`📦 Bundling: ${this.entryFile}`);

    this.processModule(this.entryFile);

    const bundledContent = this.generateBundle();

    const outputPath = outputFile || 'bundle.output.js';
    writeFileSync(outputPath, bundledContent, 'utf8');

    console.log(`✅ Bundle created: ${outputPath}`);
    console.log(`📄 Modules bundled: ${this.processedModules.size}`);

    const nativeMods = new Set();
    for (const module of this.processedModules.values()) {
      for (const imp of module.imports) {
        if (imp.isNative) nativeMods.add(imp.modulePath);
      }
    }
    if (nativeMods.size > 0) {
      console.log(`🔧 Native modules: ${Array.from(nativeMods).join(', ')}`);
    }

    if (this.debug) {
      console.log('\n🔍 Debug summary:');
      console.log('   Entry file:', this.entryFile);
      console.log('   Processed modules:');
      for (const [path, info] of this.processedModules) {
        console.log(`     - ${info.relativePath}`);
      }
    }

    return bundledContent;
  }
}

// --- CLI with --debug flag ---
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  let debug = false;
  let entryFile, outputFile;

  const filteredArgs = args.filter(arg => {
    if (arg === '--debug') {
      debug = true;
      return false;
    }
    return true;
  });

  if (filteredArgs.length === 0) {
    console.log('📚 ES6 Module Bundler');
    console.log('');
    console.log('Usage: node Bundler.js [--debug] <entry-file.js> [output-file.js]');
    console.log('');
    console.log('Examples:');
    console.log('  node Bundler.js src/app.js');
    console.log('  node Bundler.js --debug src/app.js dist/bundle.js');
    process.exit(1);
  }

  entryFile = filteredArgs[0];
  outputFile = filteredArgs[1] || 'bundle.output.js';

  try {
    const bundler = new ModuleBundler(entryFile, { debug });
    bundler.bundle(outputFile);
  } catch (error) {
    console.error('❌ Bundle failed:', error.message);
    process.exit(1);
  }
}

export default ModuleBundler;