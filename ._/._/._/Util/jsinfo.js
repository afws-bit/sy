#!/usr/bin/env node

// Node.js Interface Analyzer - Pure JavaScript ES6 Version
// Compatible with Node.js 14+

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, readlinkSync } from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

// Color codes
const COLOR_RESET = '\x1b[0m';
const COLOR_BOLD = '\x1b[1m';
const COLOR_CYAN = '\x1b[36m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_BLUE = '\x1b[34m';
const COLOR_MAGENTA = '\x1b[35m';

// Get the actual working directory from where the command was called
function getCallerCwd() {
    let currentPid = process.ppid;
    const maxDepth = 10;
    let depth = 0;
    
    while (depth < maxDepth) {
        try {
            const cwdPath = `/proc/${currentPid}/cwd`;
            if (existsSync(cwdPath)) {
                const cwd = readlinkSync(cwdPath);
                
                if (cwd && !cwd.startsWith('/usr/local/etc/') && !cwd.startsWith('/etc/') && 
                    !cwd.startsWith('/proc/') && !cwd.startsWith('/sys/') && !cwd.startsWith('/snap/')) {
                    
                    try {
                        const commPath = `/proc/${currentPid}/comm`;
                        if (existsSync(commPath)) {
                            const comm = readFileSync(commPath, 'utf8').trim();
                            if (['bash', 'sh', 'dash', 'ash', 'zsh', 'fish', 'node', 'raw'].includes(comm)) {
                                return cwd;
                            }
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }
            
            try {
                const statPath = `/proc/${currentPid}/stat`;
                if (existsSync(statPath)) {
                    const stat = readFileSync(statPath, 'utf8');
                    const parentPid = parseInt(stat.split(' ')[3]);
                    if (!parentPid || parentPid === 0 || parentPid === currentPid) {
                        break;
                    }
                    currentPid = parentPid;
                } else {
                    break;
                }
            } catch (e) {
                break;
            }
            
            depth++;
        } catch (e) {
            break;
        }
    }
    
    // Fallback
    currentPid = process.ppid;
    depth = 0;
    while (depth < maxDepth) {
        try {
            const cwdPath = `/proc/${currentPid}/cwd`;
            if (existsSync(cwdPath)) {
                const cwd = readlinkSync(cwdPath);
                
                if (cwd && !cwd.startsWith('/usr/local/etc/') && !cwd.startsWith('/etc/') && 
                    !cwd.startsWith('/proc/') && !cwd.startsWith('/sys/') && !cwd.startsWith('/snap/') &&
                    !cwd.startsWith('/usr/') && !cwd.startsWith('/var/') && !cwd.startsWith('/tmp/')) {
                    
                    if (existsSync(cwd)) {
                        return cwd;
                    }
                }
            }
            
            try {
                const statPath = `/proc/${currentPid}/stat`;
                if (existsSync(statPath)) {
                    const stat = readFileSync(statPath, 'utf8');
                    const parentPid = parseInt(stat.split(' ')[3]);
                    if (!parentPid || parentPid === 0 || parentPid === currentPid) {
                        break;
                    }
                    currentPid = parentPid;
                } else {
                    break;
                }
            } catch (e) {
                break;
            }
            
            depth++;
        } catch (e) {
            break;
        }
    }
    
    return process.cwd();
}

// Check if a module is a native Node.js module
function isNativeModule(module) {
    module = module.replace(/^node:/, '');
    
    if (/^\.\/|^\.\.\/|.*\/.*|.*\.js$|.*\.mjs$|.*\.cjs$|.*\.json$/.test(module)) {
        return false;
    }
    
    const nativeModules = new Set([
        'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
        'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
        'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
        'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
        'process', 'punycode', 'querystring', 'readline', 'repl',
        'stream', 'string_decoder', 'timers', 'tls', 'trace_events',
        'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads',
        'zlib', 'fs/promises', 'timers/promises', 'stream/promises',
        'stream/consumers', 'stream/web', 'dns/promises', 'readline/promises'
    ]);
    
    return nativeModules.has(module);
}

// Parse all imports and extract bindings
function parseImports(file, tmpOutput) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const output = [];
    
    lines.forEach((line, index) => {
        const linenum = index + 1;
        
        // Pattern 1: import defaultImport from 'module'
        let match = line.match(/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/);
        if (match) {
            const importName = match[1];
            const moduleName = match[2];
            if (isNativeModule(moduleName)) {
                const cleanModule = moduleName.replace(/^node:/, '');
                output.push(`BINDING|${importName}|${cleanModule}|default|${linenum}`);
            }
        }
        
        // Pattern 2: import { named1, named2 } from 'module'
        match = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
        if (match) {
            const bindingsPart = match[1];
            const moduleName = match[2];
            if (isNativeModule(moduleName)) {
                const cleanModule = moduleName.replace(/^node:/, '');
                
                bindingsPart.split(',').forEach(binding => {
                    binding = binding.trim();
                    const asMatch = binding.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
                    
                    if (asMatch) {
                        const original = asMatch[1];
                        const alias = asMatch[2];
                        output.push(`BINDING|${alias}|${cleanModule}|named|${linenum}`);
                        output.push(`BINDING_ORIGINAL|${alias}|${original}|${cleanModule}`);
                    } else {
                        output.push(`BINDING|${binding}|${cleanModule}|named|${linenum}`);
                        output.push(`BINDING_ORIGINAL|${binding}|${binding}|${cleanModule}`);
                    }
                });
            }
        }
        
        // Pattern 3: import * as namespace from 'module'
        match = line.match(/import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/);
        if (match) {
            const importName = match[1];
            const moduleName = match[2];
            if (isNativeModule(moduleName)) {
                const cleanModule = moduleName.replace(/^node:/, '');
                output.push(`BINDING|${importName}|${cleanModule}|namespace|${linenum}`);
            }
        }
        
        // Pattern 4: import 'module' (side effect)
        match = line.match(/^import\s+['"]([^'"]+)['"]/);
        if (match) {
            const moduleName = match[1];
            if (isNativeModule(moduleName)) {
                const cleanModule = moduleName.replace(/^node:/, '');
                output.push(`IMPORT|${cleanModule}|side_effect|${linenum}`);
            }
        }
        
        // Pattern 5: const/let/var x = require('module')
        match = line.match(/require\(['"]([^'"]+)['"]\)/);
        if (match) {
            const moduleName = match[1];
            if (isNativeModule(moduleName)) {
                const cleanModule = moduleName.replace(/^node:/, '');
                
                const varMatch = line.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
                if (varMatch) {
                    const varname = varMatch[1];
                    output.push(`BINDING|${varname}|${cleanModule}|require|${linenum}`);
                } else {
                    output.push(`IMPORT|${cleanModule}|require_side_effect|${linenum}`);
                }
            }
        }
        
        // Pattern 6: dynamic import()
        match = line.match(/import\(['"]([^'"]+)['"]\)/);
        if (match) {
            const moduleName = match[1];
            if (isNativeModule(moduleName)) {
                const cleanModule = moduleName.replace(/^node:/, '');
                output.push(`IMPORT|${cleanModule}|dynamic|${linenum}`);
            }
        }
    });
    
    writeFileSync(tmpOutput, output.join('\n') + '\n');
}

// Track usage of imported bindings
function trackUsage(file, bindingsFile, tmpOutput) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const bindingsContent = readFileSync(bindingsFile, 'utf8');
    const bindings = bindingsContent.split('\n').filter(line => line.trim());
    const output = [];
    
    bindings.forEach(bindingLine => {
        if (!bindingLine.startsWith('BINDING|')) return;
        
        const parts = bindingLine.split('|');
        const bindingName = parts[1];
        const module = parts[2];
        const importLine = parseInt(parts[4]);
        
        if (!bindingName) return;
        
        // Check lines after import
        for (let i = importLine; i < lines.length; i++) {
            const line = lines[i];
            
            // Pattern: binding.method()
            const methodMatch = line.match(new RegExp(`${bindingName}\\.([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(`));
            if (methodMatch) {
                const method = methodMatch[1];
                output.push(`METHOD|${module}|${bindingName}|${method}`);
            }
            
            // Pattern: binding.property
            const propMatch = line.match(new RegExp(`${bindingName}\\.([a-zA-Z_$][a-zA-Z0-9_$]*)`));
            if (propMatch && !line.includes(`${propMatch[0]}(`)) {
                const prop = propMatch[1];
                output.push(`PROPERTY|${module}|${bindingName}|${prop}`);
            }
            
            // Pattern: binding() used as function
            if (line.match(new RegExp(`[^.]${bindingName}\\s*\\(`))) {
                output.push(`FUNCTION_CALL|${module}|${bindingName}|function`);
            }
            
            // Pattern: binding used generally
            if (line.match(new RegExp(`[^.]${bindingName}[^a-zA-Z0-9_$.]`)) && 
                !line.includes(`${bindingName}.`) && 
                !line.includes(`${bindingName}(`)) {
                if (!output.some(o => o.startsWith(`USED|${module}|${bindingName}|`))) {
                    output.push(`USED|${module}|${bindingName}|general`);
                }
            }
        }
    });
    
    writeFileSync(tmpOutput, output.join('\n') + '\n');
}

// Classify a binding as interface or function
function classifyInterface(bindingName, module, usageFile) {
    const usageContent = readFileSync(usageFile, 'utf8');
    const usageLines = usageContent.split('\n').filter(line => line.trim());
    
    const methodCount = usageLines.filter(line => line.startsWith(`METHOD|${module}|${bindingName}|`)).length;
    const propCount = usageLines.filter(line => line.startsWith(`PROPERTY|${module}|${bindingName}|`)).length;
    const funcCall = usageLines.filter(line => line.startsWith(`FUNCTION_CALL|${module}|${bindingName}|`)).length;
    
    if (methodCount > 0 || propCount > 0) {
        return 'interface';
    } else if (funcCall > 0) {
        return 'function';
    } else {
        return 'variable';
    }
}

// Extract final results per file
function extractFinalResults(bindingsFile, usageFile, tmpFinal, fileIndex) {
    const bindingsContent = readFileSync(bindingsFile, 'utf8');
    const bindingsLines = bindingsContent.split('\n').filter(line => line.trim());
    const usageContent = readFileSync(usageFile, 'utf8');
    const usageLines = usageContent.split('\n').filter(line => line.trim());
    const output = [];
    
    const usedModules = new Set();
    if (usageLines.length > 0) {
        usageLines.forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 2) {
                usedModules.add(parts[1]);
            }
        });
    }
    
    usedModules.forEach(module => {
        if (!module) return;
        
        const bindings = new Set();
        bindingsLines.forEach(line => {
            const parts = line.split('|');
            if (parts[0] === 'BINDING' && parts[2] === module) {
                bindings.add(parts[1]);
            }
        });
        
        bindings.forEach(binding => {
            if (!binding) return;
            
            const used = usageLines.some(line => {
                const parts = line.split('|');
                return parts.length >= 3 && parts[1] === module && parts[2] === binding;
            });
            
            if (used) {
                let original = binding;
                bindingsLines.forEach(line => {
                    const parts = line.split('|');
                    if (parts[0] === 'BINDING_ORIGINAL' && parts[1] === binding) {
                        original = parts[2] || binding;
                    }
                });
                
                const type = classifyInterface(binding, module, usageFile);
                
                const methods = [...new Set(
                    usageLines.filter(line => line.startsWith(`METHOD|${module}|${binding}|`))
                        .map(line => line.split('|')[3])
                        .filter(Boolean)
                )].sort().join(',');
                
                const properties = [...new Set(
                    usageLines.filter(line => line.startsWith(`PROPERTY|${module}|${binding}|`))
                        .map(line => line.split('|')[3])
                        .filter(Boolean)
                )].sort().join(',');
                
                output.push(`USED_INTERFACE|${module}|${original}|${binding}|${type}|${methods}|${properties}`);
            }
        });
        
        if (bindingsLines.some(line => line.startsWith(`IMPORT|${module}|`))) {
            output.push(`MODULE_IMPORT|${module}|side_effect`);
        }
    });
    
    writeFileSync(tmpFinal, output.join('\n') + '\n');
}

// Get combined results
function getCombinedResults(fileIndex, tempDir) {
    const combined = [];
    
    for (let i = 0; i < fileIndex; i++) {
        const finalFile = `${tempDir}/final_${i}`;
        try {
            if (existsSync(finalFile)) {
                const content = readFileSync(finalFile, 'utf8');
                if (content.trim()) {
                    combined.push(content.trim());
                }
            }
        } catch (e) {
            // Skip
        }
    }
    
    return combined.join('\n');
}

// Count totals
function countTotals(combined) {
    const lines = combined.split('\n').filter(line => line.trim());
    
    const modules = new Set();
    let totalInterfaces = 0;
    let totalFunctions = 0;
    let totalVariables = 0;
    let totalMethods = 0;
    
    if (lines.length > 0) {
        lines.forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 2) {
                modules.add(parts[1]);
            }
        });
        
        const interfaceSet = new Set();
        const functionSet = new Set();
        const variableSet = new Set();
        const methodSet = new Set();
        
        lines.forEach(line => {
            if (!line.startsWith('USED_INTERFACE|')) return;
            const parts = line.split('|');
            if (parts.length < 5) return;
            
            const module = parts[1];
            const name = parts[2];
            const type = parts[4];
            
            if (type === 'interface') {
                interfaceSet.add(`${module}|${name}`);
            } else if (type === 'function') {
                functionSet.add(`${module}|${name}`);
            } else if (type === 'variable') {
                variableSet.add(`${module}|${name}`);
            }
            
            const methods = parts[5];
            if (methods) {
                methods.split(',').filter(Boolean).forEach(m => methodSet.add(m));
            }
        });
        
        totalInterfaces = interfaceSet.size;
        totalFunctions = functionSet.size;
        totalVariables = variableSet.size;
        totalMethods = methodSet.size;
    }
    
    return {
        totalModules: modules.size,
        totalInterfaces,
        totalFunctions,
        totalVariables,
        totalMethods
    };
}

// Print one-line totals with color
function printOneLineTotals(totals) {
    process.stdout.write(`${COLOR_BOLD}${COLOR_CYAN}modules${COLOR_RESET}: ${COLOR_GREEN}${totals.totalModules}${COLOR_RESET}  `);
    process.stdout.write(`${COLOR_BOLD}${COLOR_YELLOW}interfaces${COLOR_RESET}: ${COLOR_GREEN}${totals.totalInterfaces}${COLOR_RESET}  `);
    process.stdout.write(`${COLOR_BOLD}${COLOR_BLUE}functions${COLOR_RESET}: ${COLOR_GREEN}${totals.totalFunctions}${COLOR_RESET}  `);
    process.stdout.write(`${COLOR_BOLD}${COLOR_MAGENTA}variables${COLOR_RESET}: ${COLOR_GREEN}${totals.totalVariables}${COLOR_RESET}  `);
    process.stdout.write(`${COLOR_BOLD}${COLOR_CYAN}methods${COLOR_RESET}: ${COLOR_GREEN}${totals.totalMethods}${COLOR_RESET}\n`);
}

// Print module tree
function printModuleTree(combined) {
    const lines = combined.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return;
    
    console.log('');
    console.log(`${COLOR_BOLD}${COLOR_GREEN}▸ NODE.JS INTERFACE TREE${COLOR_RESET}`);
    console.log('');
    
    // Get unique modules
    const modules = new Set();
    lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 2) {
            modules.add(parts[1]);
        }
    });
    
    [...modules].sort().forEach(module => {
        if (!module) return;
        
        console.log(`${COLOR_BOLD}${COLOR_CYAN}▶ ${module}${COLOR_RESET}`);
        
        // Get all used interfaces/functions/variables for this module
        const processed = new Set();
        
        lines.filter(line => line.startsWith(`USED_INTERFACE|${module}|`))
            .forEach(line => {
                const parts = line.split('|');
                const original = parts[2];
                const alias = parts[3];
                const type = parts[4];
                const methods = parts[5];
                const properties = parts[6];
                
                const key = `${original}|${alias}`;
                if (processed.has(key)) return;
                processed.add(key);
                
                let displayName = original;
                if (original !== alias) {
                    displayName = `${original} → ${alias}`;
                }
                
                switch (type) {
                    case 'interface':
                        console.log(`  ${COLOR_BOLD}${COLOR_YELLOW}○ ${displayName}${COLOR_RESET} ${COLOR_GREEN}(interface)${COLOR_RESET}`);
                        
                        if (methods && methods.length > 0) {
                            [...new Set(methods.split(','))].sort().forEach(method => {
                                if (method) {
                                    console.log(`    ${COLOR_CYAN}▹ ${method}()${COLOR_RESET}`);
                                }
                            });
                        }
                        
                        if (properties && properties.length > 0) {
                            [...new Set(properties.split(','))].sort().forEach(prop => {
                                if (prop) {
                                    console.log(`    ${COLOR_BLUE}▹ ${prop}${COLOR_RESET}`);
                                }
                            });
                        }
                        break;
                    case 'function':
                        console.log(`  ${COLOR_BOLD}${COLOR_BLUE}ƒ ${displayName}${COLOR_RESET} ${COLOR_GREEN}(function)${COLOR_RESET}`);
                        break;
                    case 'variable':
                        console.log(`  ${COLOR_BOLD}${COLOR_MAGENTA}• ${displayName}${COLOR_RESET} ${COLOR_GREEN}(variable)${COLOR_RESET}`);
                        break;
                }
            });
        
        // Check for side-effect imports
        if (lines.some(line => line.startsWith(`MODULE_IMPORT|${module}|`))) {
            console.log(`  ${COLOR_GREEN}↳ side-effect import${COLOR_RESET}`);
        }
        
        console.log('');
    });
}

// Combine all results for saving
function combineAllResults(outputDir, combined) {
    const lines = combined.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return false;
    
    const uniqueLines = [...new Set(lines)].sort();
    writeFileSync(`${outputDir}/all_results.txt`, uniqueLines.join('\n') + '\n');
    
    const summary = [];
    const modules = new Set();
    
    uniqueLines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 2) {
            modules.add(parts[1]);
        }
    });
    
    [...modules].sort().forEach(module => {
        if (!module) return;
        
        summary.push(`MODULE|${module}`);
        
        const interfaces = new Set();
        uniqueLines.filter(line => line.startsWith(`USED_INTERFACE|${module}|`))
            .forEach(line => {
                const parts = line.split('|');
                interfaces.add(`${parts[2]}|${parts[4]}`);
            });
        
        [...interfaces].sort().forEach(iface => {
            const [name, type] = iface.split('|');
            if (!name) return;
            
            const allMethods = uniqueLines
                .filter(line => line.startsWith(`USED_INTERFACE|${module}|${name}|`))
                .map(line => line.split('|')[5])
                .filter(Boolean)
                .flatMap(m => m.split(','))
                .filter(Boolean)
                .sort()
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(',');
            
            const allProps = uniqueLines
                .filter(line => line.startsWith(`USED_INTERFACE|${module}|${name}|`))
                .map(line => line.split('|')[6])
                .filter(Boolean)
                .flatMap(p => p.split(','))
                .filter(Boolean)
                .sort()
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(',');
            
            summary.push(`INTERFACE|${name}|${type}|${allMethods}|${allProps}`);
        });
    });
    
    writeFileSync(`${outputDir}/module_summary.txt`, summary.join('\n') + '\n');
    return true;
}

// Save results as directory structure with .method files
function saveAsFiles(summaryFile, outputDir) {
    mkdirSync(outputDir, { recursive: true });
    
    const summaryContent = readFileSync(summaryFile, 'utf8');
    const summaryLines = summaryContent.split('\n').filter(line => line.trim());
    
    let currentModule = '';
    
    summaryLines.forEach(line => {
        const parts = line.split('|');
        const type = parts[0];
        
        switch (type) {
            case 'MODULE':
                currentModule = parts[1];
                const safeModule = currentModule.replace(/\//g, '_');
                const moduleDir = `${outputDir}/${safeModule}`;
                mkdirSync(moduleDir, { recursive: true });
                
                writeFileSync(`${moduleDir}/README.md`, 
                    `# Module: ${currentModule}\n\n## Interfaces & Functions\n\n`);
                break;
                
            case 'INTERFACE':
                const name = parts[1];
                const itype = parts[2];
                const methods = parts[3];
                const props = parts[4];
                
                if (!currentModule) return;
                
                const safeModule2 = currentModule.replace(/\//g, '_');
                const moduleDir2 = `${outputDir}/${safeModule2}`;
                
                if (itype === 'interface') {
                    let readme = `### Interface: ${name}\n`;
                    
                    if (methods && methods.length > 0) {
                        readme += '\n**Methods:**\n';
                        [...new Set(methods.split(','))].sort().forEach(method => {
                            if (method) {
                                readme += `- \`${method}()\`\n`;
                                const safeMethod = method.replace(/[^a-zA-Z0-9_]/g, '_');
                                writeFileSync(`${moduleDir2}/${safeMethod}.method`, 
                                    `# ${name}.${method}()\n`);
                            }
                        });
                    }
                    
                    if (props && props.length > 0) {
                        readme += '\n**Properties:**\n';
                        [...new Set(props.split(','))].sort().forEach(prop => {
                            if (prop) {
                                readme += `- \`${prop}\`\n`;
                            }
                        });
                    }
                    
                    readme += '\n';
                    writeFileSync(`${moduleDir2}/README.md`, readme);
                    
                } else if (itype === 'function') {
                    writeFileSync(`${moduleDir2}/README.md`,
                        `### Function: ${name}()\n\n`);
                    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
                    writeFileSync(`${moduleDir2}/${safeName}.function`,
                        `# Function: ${name}()\n`);
                } else {
                    writeFileSync(`${moduleDir2}/README.md`,
                        `### Variable: ${name}\n\n`);
                    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
                    writeFileSync(`${moduleDir2}/${safeName}.variable`,
                        `# Variable: ${name}\n`);
                }
                break;
        }
    });
    
    const totalModules = summaryLines.filter(line => line.startsWith('MODULE|')).length;
    
    let rootReadme = `# Node.js Interface Analysis\n\n`;
    rootReadme += `**Generated:** ${new Date().toString()}\n`;
    rootReadme += `**Total modules used:** ${totalModules}\n\n`;
    rootReadme += `## Modules\n\n`;
    
    summaryLines.filter(line => line.startsWith('MODULE|')).forEach(line => {
        const module = line.split('|')[1];
        const safeModule = module.replace(/\//g, '_');
        rootReadme += `- ${module}\n`;
    });
    
    rootReadme += `\n---\n*Generated by Node.js Interface Analyzer*\n`;
    
    writeFileSync(`${outputDir}/README.md`, rootReadme);
}

// Save as JSON
function saveAsJson(summaryFile, outputDir) {
    mkdirSync(outputDir, { recursive: true });
    
    const jsonFile = `${outputDir}/analysis.json`;
    
    const summaryContent = readFileSync(summaryFile, 'utf8');
    const summaryLines = summaryContent.split('\n').filter(line => line.trim());
    
    const totalModules = summaryLines.filter(line => line.startsWith('MODULE|')).length;
    
    const json = {
        metadata: {
            generated: new Date().toISOString(),
            total_modules: totalModules
        },
        modules: {}
    };
    
    let currentModule = null;
    
    summaryLines.forEach(line => {
        const parts = line.split('|');
        
        if (parts[0] === 'MODULE') {
            currentModule = parts[1];
            json.modules[currentModule] = { interfaces: [] };
        } else if (parts[0] === 'INTERFACE' && currentModule) {
            json.modules[currentModule].interfaces.push({
                name: parts[1],
                type: parts[2],
                methods: parts[3] ? parts[3].split(',').filter(Boolean) : [],
                properties: parts[4] ? parts[4].split(',').filter(Boolean) : []
            });
        }
    });
    
    writeFileSync(jsonFile, JSON.stringify(json, null, 2));
    
    console.log(`JSON saved to: ${jsonFile}`);
}

// Helper function to find JS files recursively
function findJsFiles(dir, files) {
    try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            try {
                const stat = statSync(fullPath);
                if (stat.isFile() && /\.(js|mjs|cjs)$/.test(entry)) {
                    files.push(fullPath);
                } else if (stat.isDirectory()) {
                    findJsFiles(fullPath, files);
                }
            } catch (e) {
                // Skip
            }
        }
    } catch (e) {
        // Skip
    }
}

// Parse the combined results into a structured object
function parseCombinedResults(combined) {
    const lines = combined.split('\n').filter(line => line.trim());
    const result = {
        modules: {},
        totals: null
    };
    
    lines.forEach(line => {
        const parts = line.split('|');
        
        if (line.startsWith('USED_INTERFACE|')) {
            const module = parts[1];
            const original = parts[2];
            const alias = parts[3];
            const type = parts[4];
            const methods = parts[5] ? parts[5].split(',').filter(Boolean) : [];
            const properties = parts[6] ? parts[6].split(',').filter(Boolean) : [];
            
            if (!result.modules[module]) {
                result.modules[module] = {
                    interfaces: [],
                    functions: [],
                    variables: [],
                    sideEffect: false
                };
            }
            
            const item = {
                original,
                alias: alias !== original ? alias : null,
                methods,
                properties
            };
            
            if (type === 'interface') {
                result.modules[module].interfaces.push(item);
            } else if (type === 'function') {
                result.modules[module].functions.push(item);
            } else if (type === 'variable') {
                result.modules[module].variables.push(item);
            }
        } else if (line.startsWith('MODULE_IMPORT|')) {
            const module = parts[1];
            if (!result.modules[module]) {
                result.modules[module] = {
                    interfaces: [],
                    functions: [],
                    variables: [],
                    sideEffect: true
                };
            } else {
                result.modules[module].sideEffect = true;
            }
        }
    });
    
    return result;
}

// Static interface for programmatic use
class JsInfo {
    static analyze(options = {}) {
        const {
            paths = [],
            cwd = process.cwd(),
            json = false,
            file = false,
            clear = false
        } = options;
        
        const PID = process.pid;
        const BASE_DIR = '/tmp/jsinfo';
        const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').replace('Z', '-000Z');
        const TARGET_DIR = `${BASE_DIR}/${TIMESTAMP}`;
        
        // Handle clear mode
        if (clear) {
            if (existsSync(BASE_DIR)) {
                rmSync(BASE_DIR, { recursive: true, force: true });
            }
            if (paths.length === 0) {
                return { cleared: true };
            }
        }
        
        if (paths.length === 0) {
            throw new Error('Please provide at least one .js file or directory');
        }
        
        // Create temp directory
        const TEMP_DIR = `/tmp/jsinfo_${PID}`;
        mkdirSync(TEMP_DIR, { recursive: true });
        
        // Collect all JS files
        const allFiles = [];
        
        for (const path of paths) {
            let resolvedPath;
            if (path.startsWith('/')) {
                resolvedPath = path;
            } else {
                resolvedPath = join(cwd, path);
            }
            
            try {
                if (existsSync(resolvedPath)) {
                    const stat = statSync(resolvedPath);
                    if (stat.isFile() && /\.(js|mjs|cjs)$/.test(resolvedPath)) {
                        allFiles.push(resolvedPath);
                    } else if (stat.isDirectory()) {
                        findJsFiles(resolvedPath, allFiles);
                    }
                } else if (existsSync(path)) {
                    const stat = statSync(path);
                    if (stat.isFile() && /\.(js|mjs|cjs)$/.test(path)) {
                        allFiles.push(path);
                    } else if (stat.isDirectory()) {
                        findJsFiles(path, allFiles);
                    }
                }
            } catch (e) {
                // Skip
            }
        }
        
        // Remove duplicates
        const uniqueFiles = [...new Set(allFiles)].filter(Boolean).sort();
        
        if (uniqueFiles.length === 0) {
            rmSync(TEMP_DIR, { recursive: true, force: true });
            throw new Error(`No .js files found in: ${paths.join(' ')}`);
        }
        
        // Process each file
        uniqueFiles.forEach((file, fileIndex) => {
            const bindingsFile = `${TEMP_DIR}/bindings_${fileIndex}`;
            const usageFile = `${TEMP_DIR}/usage_${fileIndex}`;
            const finalFile = `${TEMP_DIR}/final_${fileIndex}`;
            
            parseImports(file, bindingsFile);
            trackUsage(file, bindingsFile, usageFile);
            extractFinalResults(bindingsFile, usageFile, finalFile, fileIndex);
        });
        
        // Get combined results
        const combined = getCombinedResults(uniqueFiles.length, TEMP_DIR);
        
        // Get totals
        const totals = countTotals(combined);
        
        // Parse structured results
        const parsedResults = parseCombinedResults(combined);
        parsedResults.totals = totals;
        parsedResults.filesAnalyzed = uniqueFiles.length;
        parsedResults.combined = combined;
        
        // Check if we need to save
        if (json || file) {
            const outputDir = TARGET_DIR;
            mkdirSync(outputDir, { recursive: true });
            
            if (combineAllResults(outputDir, combined)) {
                if (json) {
                    saveAsJson(`${outputDir}/module_summary.txt`, outputDir);
                }
                if (file) {
                    saveAsFiles(`${outputDir}/module_summary.txt`, outputDir);
                }
                parsedResults.outputDir = outputDir;
            } else {
                rmSync(outputDir, { recursive: true, force: true });
            }
        }
        
        // Cleanup
        rmSync(TEMP_DIR, { recursive: true, force: true });
        
        return parsedResults;
    }
    
    static clear() {
        const BASE_DIR = '/tmp/jsinfo';
        if (existsSync(BASE_DIR)) {
            rmSync(BASE_DIR, { recursive: true, force: true });
            return { cleared: true, path: BASE_DIR };
        }
        return { cleared: false, path: BASE_DIR };
    }
}

// Main execution for CLI use
function main() {
    const args = process.argv.slice(2);
    
    let jsonMode = false;
    let fileMode = false;
    let clearMode = false;
    const paths = [];
    
    for (const arg of args) {
        switch (arg) {
            case '--json':
                jsonMode = true;
                break;
            case '--file':
                fileMode = true;
                break;
            case '--clear':
                clearMode = true;
                break;
            default:
                paths.push(arg);
                break;
        }
    }
    
    try {
        const result = JsInfo.analyze({
            paths,
            cwd: getCallerCwd(),
            json: jsonMode,
            file: fileMode,
            clear: clearMode
        });
        
        if (result.cleared) {
            console.log('Nothing to clear (/tmp/jsinfo does not exist)');
            if (paths.length === 0) {
                process.exit(0);
            }
            return;
        }
        
        // Print tree and totals for CLI
        if (result.combined) {
            if (result.outputDir) {
                console.log('');
                console.log(`Results saved to: ${result.outputDir}`);
            }
            printModuleTree(result.combined);
            printOneLineTotals(result.totals);
        } else {
            console.log('No native Node.js modules detected.');
        }
        
    } catch (error) {
        console.error(error.message);
        if (error.message.includes('Please provide')) {
            console.log(`Usage: ${process.argv[1]} [--json] [--file] [--clear] <file1.js> <file2.js> <dir1> ...`);
            console.log('  --json   Save analysis as JSON in /tmp/jsinfo');
            console.log('  --file   Save analysis with .method files in /tmp/jsinfo');
            console.log('  --clear  Clear /tmp/jsinfo (can be used alone or before saving)');
        }
        process.exit(1);
    }
}

// Check if this file is being run directly
const isMainModule = process.argv[1] && (
    process.argv[1].endsWith('/jsinfo.js') || 
    process.argv[1].endsWith('/jsinfo.mjs') ||
    process.argv[1].endsWith('\\jsinfo.js') ||
    process.argv[1].endsWith('\\jsinfo.mjs') ||
    process.argv[1] === __filename ||
    basename(process.argv[1]) === 'jsinfo.js' ||
    basename(process.argv[1]) === 'jsinfo.mjs'
);

if (isMainModule) {
    main();
}

// Static interface export
export default JsInfo;