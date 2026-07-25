// code-parser-interface.js

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// BRACE MATCHING UTILITY
// ============================================================================
class BraceMatcher {

    /**
     * Finds the matching closing brace for a given opening brace position.
     * Handles strings, template literals, and comments correctly.
     * @param {string} sourceCode - The full source code.
     * @param {number} startIndex - Index of the opening brace.
     * @returns {number} Index of the matching closing brace.
     */
    static findMatchingBrace(sourceCode, startIndex) {
        let depth = 1;
        let index = startIndex + 1;
        let insideString = false;
        let stringDelimiter = '';
        let insideTemplate = false;
        let insideSingleLineComment = false;
        let insideMultiLineComment = false;
        
        while (depth > 0 && index < sourceCode.length) {
            const character = sourceCode[index];
            const previousCharacter = index > 0 ? sourceCode[index - 1] : '';
            const nextCharacter = index < sourceCode.length - 1 ? sourceCode[index + 1] : '';
            
            // Handle comment starts outside strings/templates
            if (!insideString && !insideTemplate && !insideMultiLineComment) {
                if (character === '/' && nextCharacter === '/') {
                    insideSingleLineComment = true;
                    index += 2;
                    continue;
                }
                if (character === '/' && nextCharacter === '*') {
                    insideMultiLineComment = true;
                    index += 2;
                    continue;
                }
            }
            
            // Inside single-line comment
            if (insideSingleLineComment) {
                if (character === '\n') insideSingleLineComment = false;
                index++;
                continue;
            }
            
            // Inside multi-line comment
            if (insideMultiLineComment) {
                if (character === '*' && nextCharacter === '/') {
                    insideMultiLineComment = false;
                    index += 2;
                    continue;
                }
                index++;
                continue;
            }
            
            // Template literal toggle
            if (character === '`' && previousCharacter !== '\\' && !insideString) {
                insideTemplate = !insideTemplate;
                index++;
                continue;
            }
            
            // Regular string toggle (only outside templates)
            if (!insideTemplate && (character === '"' || character === "'") && previousCharacter !== '\\') {
                if (!insideString) {
                    insideString = true;
                    stringDelimiter = character;
                } else if (character === stringDelimiter) {
                    insideString = false;
                }
                index++;
                continue;
            }
            
            // Brace counting (only outside strings/templates)
            if (!insideString && !insideTemplate) {
                if (character === '{') depth++;
                if (character === '}') depth--;
            }
            
            if (depth === 0) return index;
            index++;
        }
        // Fallback to end of file
        return sourceCode.length - 1;
    }
    
    /**
     * Checks whether a position is inside a template literal.
     * @param {string} sourceCode - The full source code.
     * @param {number} position - Position to check.
     * @returns {boolean}
     */
    static isInsideTemplateString(sourceCode, position) {
        let insideTemplate = false;
        let insideString = false;
        let stringDelimiter = '';
        let insideSingleLineComment = false;
        let insideMultiLineComment = false;
        
        for (let i = 0; i < position; i++) {
            const char = sourceCode[i];
            const prevChar = i > 0 ? sourceCode[i - 1] : '';
            const nextChar = i < sourceCode.length - 1 ? sourceCode[i + 1] : '';
            
            // Comment handling
            if (!insideString && !insideTemplate && !insideMultiLineComment) {
                if (char === '/' && nextChar === '/') {
                    insideSingleLineComment = true;
                    i++;
                    continue;
                }
                if (char === '/' && nextChar === '*') {
                    insideMultiLineComment = true;
                    i++;
                    continue;
                }
            }
            
            if (insideSingleLineComment) {
                if (char === '\n') insideSingleLineComment = false;
                continue;
            }
            
            if (insideMultiLineComment) {
                if (char === '*' && nextChar === '/') {
                    insideMultiLineComment = false;
                    i++;
                    continue;
                }
                continue;
            }
            
            // Template literal toggle
            if (char === '`' && prevChar !== '\\' && !insideString) {
                insideTemplate = !insideTemplate;
                continue;
            }
            
            // Regular string toggle
            if (!insideTemplate && (char === '"' || char === "'") && prevChar !== '\\') {
                if (!insideString) {
                    insideString = true;
                    stringDelimiter = char;
                } else if (char === stringDelimiter) {
                    insideString = false;
                }
                continue;
            }
        }
        
        return insideTemplate;
    }

    /**
     * Computes the brace depth for every character in the given code,
     * ignoring strings, template literals, and comments.
     * @param {string} code 
     * @returns {number[]} Array where index i contains the depth at character i.
     */
    static computeDepthMap(code) {
        const depthMap = new Array(code.length).fill(0);
        let depth = 0;
        let insideString = false;
        let stringDelimiter = '';
        let insideTemplate = false;
        let insideSingleLineComment = false;
        let insideMultiLineComment = false;

        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            const prevChar = i > 0 ? code[i - 1] : '';
            const nextChar = i < code.length - 1 ? code[i + 1] : '';

            // Remember current depth for this position
            depthMap[i] = depth;

            // Handle comment starts outside strings/templates
            if (!insideString && !insideTemplate && !insideMultiLineComment) {
                if (char === '/' && nextChar === '/') {
                    insideSingleLineComment = true;
                    i++;
                    continue;
                }
                if (char === '/' && nextChar === '*') {
                    insideMultiLineComment = true;
                    i++;
                    continue;
                }
            }

            // Inside single-line comment
            if (insideSingleLineComment) {
                if (char === '\n') insideSingleLineComment = false;
                continue;
            }

            // Inside multi-line comment
            if (insideMultiLineComment) {
                if (char === '*' && nextChar === '/') {
                    insideMultiLineComment = false;
                    i++;
                    continue;
                }
                continue;
            }

            // Template literal toggle
            if (char === '`' && prevChar !== '\\' && !insideString) {
                insideTemplate = !insideTemplate;
                continue;
            }

            // Regular string toggle
            if (!insideTemplate && (char === '"' || char === "'") && prevChar !== '\\') {
                if (!insideString) {
                    insideString = true;
                    stringDelimiter = char;
                } else if (char === stringDelimiter) {
                    insideString = false;
                }
                continue;
            }

            // Update depth when not inside string/template/comment
            if (!insideString && !insideTemplate) {
                if (char === '{') depth++;
                else if (char === '}') depth--;
            }
        }

        return depthMap;
    }
}

// ============================================================================
// CODE ANALYSIS MODULE
// ============================================================================
class CodeAnalyzer {

    static extractImports(sourceCode) {
        const imports = [];
        const regex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s+['"][^'"]+['"]\s*;?/g;
        let match;
        while ((match = regex.exec(sourceCode)) !== null) {
            if (BraceMatcher.isInsideTemplateString(sourceCode, match.index)) continue;
            imports.push({
                type: 'import',
                name: match[0].trim(),
                start: match.index,
                end: match.index + match[0].length,
                content: match[0]
            });
        }
        return imports;
    }

    static extractExports(sourceCode) {
        const exports = [];
        const patterns = [
            /export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)?/g,
            /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
            /export\s+\{[^}]+\}/g,
            /module\.exports\s*=\s*[^;]+;?/g
        ];
        
        for (const regex of patterns) {
            let match;
            while ((match = regex.exec(sourceCode)) !== null) {
                if (BraceMatcher.isInsideTemplateString(sourceCode, match.index)) continue;
                exports.push({
                    type: 'export',
                    name: match[1] || match[0].trim(),
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[0]
                });
            }
        }
        return exports;
    }

    static extractClasses(sourceCode) {
        const classes = [];
        const regex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
        let match;
        while ((match = regex.exec(sourceCode)) !== null) {
            if (BraceMatcher.isInsideTemplateString(sourceCode, match.index)) continue;
            const className = match[1];
            const extendsClass = match[2] || null;
            const classStart = match.index;
            const classBodyStart = match.index + match[0].length - 1; // position of '{'
            const classEnd = BraceMatcher.findMatchingBrace(sourceCode, classBodyStart) + 1;
            const classContent = sourceCode.substring(classStart, classEnd);

            // Extract the class body (everything between the braces)
            const bodyStart = classBodyStart + 1;
            const bodyEnd = classEnd - 1;
            const bodyCode = sourceCode.substring(bodyStart, bodyEnd);
            
            const rawMethods = this.extractClassMethodsFromBody(bodyCode, bodyStart, className);
            
            classes.push({
                type: 'class',
                name: className,
                extends: extendsClass,
                start: classStart,
                end: classEnd,
                content: classContent,
                methods: rawMethods
            });
        }
        return classes;
    }

    /**
     * Extracts top‑level methods from a class body.
     * Only methods/arrow properties that appear at brace depth 0 (directly inside the class)
     * are returned. This avoids picking up nested control structures like `if`, `for`, etc.
     * 
     * @param {string} bodyCode - The source code inside the class braces (without the braces).
     * @param {number} bodyAbsoluteStart - Absolute position of bodyCode in the original source.
     * @param {string} className - Name of the parent class (for debugging).
     * @returns {Array} Methods with absolute positions.
     */
    static extractClassMethodsFromBody(bodyCode, bodyAbsoluteStart, className) {
        // 1. Compute depth map for the body (starting at depth 0)
        const depthMap = BraceMatcher.computeDepthMap(bodyCode);

        // 2. Regular expression for method declarations and arrow‑function properties.
        //    It optionally matches modifiers: static, async, get, set.
        //    The regex captures the method name and stops at the opening brace.
        //    FIXED: Removed the strict parameter matching that was causing issues
        const methodRegex = /(?:(?:static\s+)?(?:async\s+)?(?:get\s+)?(?:set\s+)?(\w+)\s*\([^)]*\)\s*\{)|(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;

        const methods = [];
        let match;

        while ((match = methodRegex.exec(bodyCode)) !== null) {
            const matchIndex = match.index;
            // Only accept if depth is 0 at the start of the match
            if (depthMap[matchIndex] !== 0) continue;

            let methodName = match[1] || match[2];
            
            const openingBracePos = match.index + match[0].length - 1; // position of '{'
            const methodBodyEnd = BraceMatcher.findMatchingBrace(bodyCode, openingBracePos);
            
            // Calculate content boundaries - but we need to be careful to not include trailing whitespace/newlines
            let contentEnd = methodBodyEnd + 1;
            
            // Extend to include any trailing whitespace/newlines that separate methods
            if (contentEnd < bodyCode.length) {
                let nextChar = bodyCode[contentEnd];
                while (contentEnd < bodyCode.length && (nextChar === ' ' || nextChar === '\t' || nextChar === '\n' || nextChar === '\r')) {
                    contentEnd++;
                    nextChar = bodyCode[contentEnd];
                }
            }
            
            const content = bodyCode.substring(match.index, contentEnd);
            const absoluteStart = bodyAbsoluteStart + match.index;
            const absoluteEnd = bodyAbsoluteStart + contentEnd;

            methods.push({
                name: methodName,
                start: match.index,          // relative to body start
                end: contentEnd,
                absoluteStart: absoluteStart,
                absoluteEnd: absoluteEnd,
                content: content
            });
        }

        return methods;
    }

    static extractFunctions(sourceCode) {
        const functions = [];
        const classRanges = this.extractClasses(sourceCode).map(cls => ({
            start: cls.start,
            end: cls.end
        }));
        
        const isInsideAnyClass = (position) =>
            classRanges.some(range => position > range.start && position < range.end);
        
        // Named function declarations: function name(...) { }
        const funcDeclRegex = /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g;
        let match;
        while ((match = funcDeclRegex.exec(sourceCode)) !== null) {
            if (BraceMatcher.isInsideTemplateString(sourceCode, match.index) || isInsideAnyClass(match.index)) continue;
            const start = match.index;
            const end = BraceMatcher.findMatchingBrace(sourceCode, match.index + match[0].length - 1) + 1;
            functions.push({
                type: 'function',
                name: match[1],
                start,
                end,
                content: sourceCode.substring(start, end),
                isAsync: match[0].includes('async'),
                isArrow: false
            });
        }
        
        // Arrow functions assigned to variables/constants: const name = (...) => { }
        const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
        while ((match = arrowRegex.exec(sourceCode)) !== null) {
            if (BraceMatcher.isInsideTemplateString(sourceCode, match.index) || isInsideAnyClass(match.index)) continue;
            const start = match.index;
            const end = BraceMatcher.findMatchingBrace(sourceCode, match.index + match[0].length - 1) + 1;
            functions.push({
                type: 'function',
                name: match[1],
                start,
                end,
                content: sourceCode.substring(start, end),
                isAsync: match[0].includes('async'),
                isArrow: true
            });
        }
        return functions;
    }

    static extractVariables(sourceCode) {
        const variables = [];
        const classRanges = this.extractClasses(sourceCode).map(cls => ({
            start: cls.start,
            end: cls.end
        }));
        const functionRanges = this.extractFunctions(sourceCode).map(fn => ({
            start: fn.start,
            end: fn.end
        }));
        
        const isInsideStructure = (position) =>
            classRanges.some(r => position > r.start && position < r.end) ||
            functionRanges.some(r => position > r.start && position < r.end);
        
        const regex = /(?:const|let|var)\s+(\w+)\s*=\s*[^;]+;?/g;
        let match;
        while ((match = regex.exec(sourceCode)) !== null) {
            if (BraceMatcher.isInsideTemplateString(sourceCode, match.index) || 
                isInsideStructure(match.index) || 
                match[0].includes('=>') || 
                match[0].includes('function')) continue;
            variables.push({
                type: 'variable',
                name: match[1],
                start: match.index,
                end: match.index + match[0].length,
                content: match[0].trim()
            });
        }
        return variables;
    }

    static extractComments(sourceCode) {
        const comments = [];
        const patterns = [
            { regex: /\/\/.*$/gm, type: 'single-line' },
            { regex: /\/\*[\s\S]*?\*\//g, type: 'multi-line' }
        ];
        
        for (const { regex, type } of patterns) {
            let match;
            while ((match = regex.exec(sourceCode)) !== null) {
                if (BraceMatcher.isInsideTemplateString(sourceCode, match.index)) continue;
                const isJSDoc = match[0].includes('/**') || 
                               (type === 'multi-line' && match[0].trimStart().startsWith('/**'));
                comments.push({
                    type: 'comment',
                    commentType: type,
                    isJSDoc,
                    name: isJSDoc ? 'JSDoc' : 'Comment',
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[0]
                });
            }
        }
        return comments;
    }

    static extractJSDocComments(sourceCode) {
        return this.extractComments(sourceCode).filter(c => c.isJSDoc);
    }

    static getAllParts(sourceCode) {
        const allParts = [
            ...this.extractImports(sourceCode),
            ...this.extractExports(sourceCode),
            ...this.extractClasses(sourceCode),
            ...this.extractFunctions(sourceCode),
            ...this.extractVariables(sourceCode),
            ...this.extractComments(sourceCode)
        ];
        allParts.sort((a, b) => a.start - b.start);
        return allParts;
    }

    /**
     * Provides a flat list of all class methods with absolute positions and their parent class.
     * @param {Array} classes - The classes array.
     * @returns {Array}
     */
    static extractAllMethods(classes) {
        const methods = [];
        for (const cls of classes) {
            for (const method of cls.methods) {
                methods.push({
                    ...method,
                    className: cls.name,
                    type: 'class-method',
                    name: `${cls.name}.${method.name}`
                });
            }
        }
        return methods;
    }

    static analyzeCode(sourceCode) {
        const classes = this.extractClasses(sourceCode);
        const comments = this.extractComments(sourceCode);
        return {
            imports: this.extractImports(sourceCode),
            exports: this.extractExports(sourceCode),
            classes,
            functions: this.extractFunctions(sourceCode),
            variables: this.extractVariables(sourceCode),
            comments,
            jsdocComments: comments.filter(c => c.isJSDoc),
            allMethods: this.extractAllMethods(classes),
            allParts: () => this.getAllParts(sourceCode)
        };
    }
}

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================
class ConfigManager {
    static #configurationFilePath = '';

    static initializeConfigurationPath(filePath) {
        if (!this.#configurationFilePath) {
            this.#configurationFilePath = path.join(path.dirname(filePath), '.code-parser-configs.json');
        }
        return this.#configurationFilePath;
    }

    static getConfigurationFilePath() {
        return this.#configurationFilePath;
    }
    
    static loadConfigurations() {
        const configFile = this.getConfigurationFilePath();
        if (fs.existsSync(configFile)) {
            try {
                const data = fs.readFileSync(configFile, 'utf-8');
                return JSON.parse(data);
            } catch (error) {
                console.error('Warning: Error reading configuration file:', error.message);
                return { configs: {} };
            }
        }
        return { configs: {} };
    }
    
    static saveConfigurations(configurations) {
        const configFile = this.getConfigurationFilePath();
        try {
            fs.writeFileSync(configFile, JSON.stringify(configurations, null, 2));
            return true;
        } catch (error) {
            console.error('Warning: Error saving configuration file:', error.message);
            return false;
        }
    }
    
    static saveConfiguration(configName, options) {
        const configurations = this.loadConfigurations();
        configurations.configs[configName] = {
            name: configName,
            created: new Date().toISOString(),
            options
        };
        return this.saveConfigurations(configurations);
    }
}

// ============================================================================
// MERGE SCRIPT GENERATOR - DIFF-BASED RECONSTRUCTION
// ============================================================================
class MergeScriptGenerator {

    static createMergeScript(removedParts, originalCode) {
        const sortedParts = [...removedParts].sort((a, b) => a.start - b.start);
        
        const segments = [];
        let currentPosition = 0;
        
        for (const part of sortedParts) {
            if (part.start > currentPosition) {
                segments.push({
                    type: 'kept',
                    start: currentPosition,
                    end: part.start,
                    content: originalCode.substring(currentPosition, part.start)
                });
            }
            segments.push({
                type: 'removed',
                start: part.start,
                end: part.end,
                content: part.content,
                name: part.name,
                partType: part.type
            });
            currentPosition = part.end;
        }
        
        if (currentPosition < originalCode.length) {
            segments.push({
                type: 'kept',
                start: currentPosition,
                end: originalCode.length,
                content: originalCode.substring(currentPosition)
            });
        }
        
        const segmentsData = segments.map(seg => {
            if (seg.type === 'removed') {
                return {
                    type: 'removed',
                    name: seg.name,
                    partType: seg.partType,
                    content: seg.content,
                    originalStart: seg.start,
                    originalEnd: seg.end
                };
            } else {
                return {
                    type: 'kept',
                    content: seg.content,
                    originalStart: seg.start,
                    originalEnd: seg.end
                };
            }
        });

        const mergeScriptContent = '#!/usr/bin/env node\n' +
'/**\n' +
' * ============================================================================\n' +
' * DIFF-BASED RECONSTRUCTION MERGE SCRIPT\n' +
' * ============================================================================\n' +
' * Generated: ' + new Date().toISOString() + '\n' +
' * \n' +
' * This script reconstructs the original file by tracking EXACT byte positions.\n' +
' * The approach:\n' +
' *   1. The original file is divided into KEPT and REMOVED segments\n' +
' *   2. The filtered file contains the KEPT segments in order\n' +
' *   3. This script reinserts REMOVED segments at their correct positions\n' +
' *   4. Uses content fingerprinting to find exact insertion points\n' +
' * \n' +
' * Usage:\n' +
' *   node merge-script.js <filtered-file.js> [options]\n' +
' * \n' +
' * Options:\n' +
' *   --output <file>   Output file (default: <input>_merged.js)\n' +
' *   --dry-run         Preview only\n' +
' *   --verbose         Show detailed progress\n' +
' *   --force           Skip confirmation\n' +
' */\n' +
'\n' +
'import fs from \'fs\';\n' +
'import path from \'path\';\n' +
'\n' +
'// ============================================================\n' +
'// SEGMENTS DATA\n' +
'// ============================================================\n' +
'const segments = ' + JSON.stringify(segmentsData, null, 2) + ';\n' +
'\n' +
'// ============================================================\n' +
'// CONTENT FINGERPRINTING\n' +
'// ============================================================\n' +
'function createFingerprint(text, length) {\n' +
'    const cleanText = text.replace(/\\s+/g, \' \').trim();\n' +
'    if (cleanText.length <= length) {\n' +
'        return cleanText;\n' +
'    }\n' +
'    return cleanText.substring(0, length);\n' +
'}\n' +
'\n' +
'function findFingerprintInCode(code, fingerprint) {\n' +
'    const normalizedCode = code.replace(/\\s+/g, \' \').trim();\n' +
'    const index = normalizedCode.indexOf(fingerprint);\n' +
'    if (index === -1) {\n' +
'        return -1;\n' +
'    }\n' +
'    // Map back to original position\n' +
'    let originalIndex = 0;\n' +
'    let normalizedIndex = 0;\n' +
'    while (normalizedIndex < index && originalIndex < code.length) {\n' +
'        if (/\\s/.test(code[originalIndex])) {\n' +
'            while (originalIndex < code.length && /\\s/.test(code[originalIndex])) {\n' +
'                originalIndex++;\n' +
'            }\n' +
'            if (normalizedIndex > 0) {\n' +
'                normalizedIndex++;\n' +
'            }\n' +
'        } else {\n' +
'            originalIndex++;\n' +
'            normalizedIndex++;\n' +
'        }\n' +
'    }\n' +
'    return originalIndex;\n' +
'}\n' +
'\n' +
'// ============================================================\n' +
'// FIND INSERTION POINT BY SURROUNDING CONTEXT\n' +
'// ============================================================\n' +
'function findInsertionPoint(code, segmentIndex, allSegments) {\n' +
'    // Strategy 1: Next KEPT segment\n' +
'    for (let i = segmentIndex + 1; i < allSegments.length; i++) {\n' +
'        if (allSegments[i].type === \'kept\' && allSegments[i].content.trim().length > 20) {\n' +
'            const fingerprint = createFingerprint(allSegments[i].content, 100);\n' +
'            const position = findFingerprintInCode(code, fingerprint);\n' +
'            if (position >= 0) {\n' +
'                return { position, confidence: \'HIGH\', method: \'next-kept-segment\' };\n' +
'            }\n' +
'            break;\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    // Strategy 2: Previous KEPT segment\n' +
'    for (let i = segmentIndex - 1; i >= 0; i--) {\n' +
'        if (allSegments[i].type === \'kept\' && allSegments[i].content.trim().length > 20) {\n' +
'            const fingerprint = createFingerprint(allSegments[i].content, 100);\n' +
'            const position = findFingerprintInCode(code, fingerprint);\n' +
'            if (position >= 0) {\n' +
'                const keptContent = allSegments[i].content;\n' +
'                let keptEnd = position;\n' +
'                const normalizedKept = keptContent.replace(/\\s+/g, \' \').trim();\n' +
'                let matchedChars = 0;\n' +
'                let codePos = position;\n' +
'                while (matchedChars < normalizedKept.length && codePos < code.length) {\n' +
'                    if (/\\s/.test(code[codePos])) {\n' +
'                        codePos++;\n' +
'                    } else {\n' +
'                        codePos++;\n' +
'                        matchedChars++;\n' +
'                    }\n' +
'                }\n' +
'                return { position: codePos, confidence: \'HIGH\', method: \'previous-kept-segment\' };\n' +
'            }\n' +
'            break;\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    // Strategy 3: First line of removed content\n' +
'    const removedSegment = allSegments[segmentIndex];\n' +
'    const firstLine = removedSegment.content.split(\'\\n\')[0].trim();\n' +
'    if (firstLine.length > 10) {\n' +
'        const index = code.indexOf(firstLine);\n' +
'        if (index >= 0) {\n' +
'            return { position: index, confidence: \'MEDIUM\', method: \'content-first-line\' };\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    // Strategy 4: End of file\n' +
'    return { position: code.length, confidence: \'FALLBACK\', method: \'end-of-file\' };\n' +
'}\n' +
'\n' +
'// ============================================================\n' +
'// RECONSTRUCT ORIGINAL FILE\n' +
'// ============================================================\n' +
'function reconstructOriginalFile(filteredCode, verbose) {\n' +
'    const originalOrder = [...segments];\n' +
'    let result = filteredCode;\n' +
'    const report = [];\n' +
'    let insertedCount = 0;\n' +
'    let failedCount = 0;\n' +
'    \n' +
'    const removedSegments = [];\n' +
'    for (let i = 0; i < originalOrder.length; i++) {\n' +
'        if (originalOrder[i].type === \'removed\') {\n' +
'            removedSegments.push({ segment: originalOrder[i], index: i });\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    // Sort by original position DESCENDING\n' +
'    removedSegments.sort((a, b) => b.segment.originalStart - a.segment.originalStart);\n' +
'    \n' +
'    if (verbose) {\n' +
'        console.log(\'\\nReconstructing original file from \' + removedSegments.length + \' removed segments...\');\n' +
'    }\n' +
'    \n' +
'    for (let i = 0; i < removedSegments.length; i++) {\n' +
'        const { segment, index: originalIndex } = removedSegments[i];\n' +
'        const progress = `[${i+1}/${removedSegments.length}]`;\n' +
'        \n' +
'        if (verbose) {\n' +
'            process.stdout.write(`${progress} ${segment.partType}: ${segment.name} ... `);\n' +
'        }\n' +
'        \n' +
'        // Already present check\n' +
'        const normalizedContent = segment.content.replace(/\\s+/g, \' \').trim();\n' +
'        const normalizedResult = result.replace(/\\s+/g, \' \').trim();\n' +
'        if (normalizedContent.length > 20 && normalizedResult.includes(normalizedContent)) {\n' +
'            if (verbose) console.log(\'SKIP (already present)\');\n' +
'            report.push({ name: segment.name, type: segment.partType, status: \'already-present\' });\n' +
'            continue;\n' +
'        }\n' +
'        \n' +
'        const insertion = findInsertionPoint(result, originalIndex, originalOrder);\n' +
'        if (insertion && insertion.position >= 0) {\n' +
'            const before = result.substring(0, insertion.position);\n' +
'            const after = result.substring(insertion.position);\n' +
'            const cleanBefore = before.replace(/\\n+$/, \'\\n\\n\');\n' +
'            const cleanAfter = after.replace(/^\\n+/, \'\');\n' +
'            const cleanContent = segment.content.trim();\n' +
'            result = cleanBefore + cleanContent + \'\\n\\n\' + cleanAfter;\n' +
'            insertedCount++;\n' +
'            if (verbose) {\n' +
'                console.log(`OK (${insertion.method}, ${insertion.confidence})`);\n' +
'            }\n' +
'            report.push({\n' +
'                name: segment.name,\n' +
'                type: segment.partType,\n' +
'                status: \'inserted\',\n' +
'                method: insertion.method,\n' +
'                confidence: insertion.confidence\n' +
'            });\n' +
'        } else {\n' +
'            failedCount++;\n' +
'            if (verbose) console.log(\'FAILED\');\n' +
'            report.push({ name: segment.name, type: segment.partType, status: \'failed\' });\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    result = result.replace(/\\n{4,}/g, \'\\n\\n\\n\');\n' +
'    result = result.trimStart() + \'\\n\';\n' +
'    \n' +
'    return { code: result, report, inserted: insertedCount, failed: failedCount };\n' +
'}\n' +
'\n' +
'// ============================================================\n' +
'// MAIN\n' +
'// ============================================================\n' +
'function main() {\n' +
'    const args = process.argv.slice(2);\n' +
'    \n' +
'    if (args.length === 0 || args.includes(\'--help\') || args.includes(\'-h\')) {\n' +
'        console.log(\'Diff-Based Reconstruction Merge Script\');\n' +
'        console.log(\'=\'.repeat(50));\n' +
'        console.log(\'Usage: node merge-script.js <filtered-file.js> [options]\');\n' +
'        console.log(\'  --output <file>   Output file\');\n' +
'        console.log(\'  --dry-run         Preview only\');\n' +
'        console.log(\'  --verbose         Show details\');\n' +
'        console.log(\'  --force           Skip confirmation\');\n' +
'        process.exit(0);\n' +
'    }\n' +
'    \n' +
'    const targetFile = args[0];\n' +
'    const outputFile = args.includes(\'--output\')\n' +
'        ? args[args.indexOf(\'--output\') + 1]\n' +
'        : targetFile.replace(\'.js\', \'_merged.js\');\n' +
'    const dryRun = args.includes(\'--dry-run\');\n' +
'    const verbose = args.includes(\'--verbose\');\n' +
'    const force = args.includes(\'--force\');\n' +
'    \n' +
'    if (!fs.existsSync(targetFile)) {\n' +
'        console.error(\'ERROR: File not found: \' + targetFile);\n' +
'        process.exit(1);\n' +
'    }\n' +
'    \n' +
'    console.log(\'Diff-Based Reconstruction Merge\');\n' +
'    console.log(\'=\'.repeat(50));\n' +
'    console.log(\'Target: \' + path.basename(targetFile));\n' +
'    const removedCount = segments.filter(s => s.type === \'removed\').length;\n' +
'    console.log(\'Segments to reinsert: \' + removedCount);\n' +
'    \n' +
'    if (!dryRun && !force) {\n' +
'        console.log(\'\\nWaiting 2 seconds... (Ctrl+C to cancel)\');\n' +
'        const start = Date.now();\n' +
'        while (Date.now() - start < 2000) {}\n' +
'    }\n' +
'    \n' +
'    const code = fs.readFileSync(targetFile, \'utf-8\');\n' +
'    console.log(\'\\nReconstructing...\');\n' +
'    \n' +
'    const result = reconstructOriginalFile(code, verbose);\n' +
'    \n' +
'    console.log(\'\\n\' + \'=\'.repeat(50));\n' +
'    console.log(\'RESULTS\');\n' +
'    console.log(\'=\'.repeat(50));\n' +
'    console.log(\'Inserted: \' + result.inserted);\n' +
'    console.log(\'Failed:   \' + result.failed);\n' +
'    console.log(\'Lines:    \' + result.code.split(\'\\n\').length);\n' +
'    \n' +
'    if (result.failed > 0) {\n' +
'        console.log(\'\\nFAILED (manual insertion needed):\');\n' +
'        for (const r of result.report) {\n' +
'            if (r.status === \'failed\') {\n' +
'                console.log(\'  - [\' + r.type + \'] \' + r.name);\n' +
'            }\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    if (verbose) {\n' +
'        console.log(\'\\nDETAIL:\');\n' +
'        for (const r of result.report) {\n' +
'            const icon = r.status === \'inserted\' ? \'+\' : r.status === \'already-present\' ? \'.\' : \'!\';\n' +
'            console.log(`  ${icon} [${r.type}] ${r.name}` + (r.method ? ` (${r.method})` : \'\'));\n' +
'        }\n' +
'    }\n' +
'    \n' +
'    if (dryRun) {\n' +
'        console.log(\'\\nDRY RUN - No file written\');\n' +
'    } else {\n' +
'        fs.writeFileSync(outputFile, result.code);\n' +
'        console.log(\'\\nOutput: \' + outputFile);\n' +
'        console.log(\'Size: \' + (result.code.length / 1024).toFixed(1) + \' KB\');\n' +
'    }\n' +
'    \n' +
'    console.log(\'\\nDone.\');\n' +
'    process.exit(0);\n' +
'}\n' +
'\n' +
'main();\n';

        return mergeScriptContent;
    }
}

// ============================================================================
// CODE FILTER
// ============================================================================
class CodeFilter {

    /**
     * Removes a method from the source code while maintaining valid syntax.
     * Instead of just removing the method content, it replaces it with a placeholder
     * that preserves the method signature but has an empty body.
     * 
     * @param {string} sourceCode - The original source code
     * @param {object} method - The method object with absoluteStart, absoluteEnd, content
     * @returns {string} - Replacement code that maintains valid syntax
     */
    static createMethodStub(sourceCode, method) {
        const methodContent = method.content;
        
        // Find the method signature up to the opening brace
        const braceIndex = methodContent.indexOf('{');
        if (braceIndex === -1) {
            // No brace found, just return empty
            return '';
        }
        
        // Get everything before the opening brace (the signature)
        const signature = methodContent.substring(0, braceIndex).trim();
        
        // Find the matching closing brace
        const bodyStart = braceIndex + 1;
        const bodyCode = methodContent.substring(bodyStart);
        const closingBracePos = BraceMatcher.findMatchingBrace(methodContent, braceIndex);
        
        // Create a stub that preserves the signature but has minimal body
        // For constructors with parameters, we need to keep the parameters
        let stub = signature + ' {\n';
        
        // If this is a constructor with super call or parameters that need initialization,
        // we need to preserve some functionality
        if (method.name === 'constructor') {
            // Keep constructor but with minimal body
            // Extract parameter names
            const paramsMatch = signature.match(/constructor\s*\(([^)]*)\)/);
            if (paramsMatch && paramsMatch[1].trim()) {
                const params = paramsMatch[1].split(',').map(p => {
                    const paramName = p.trim().split('=')[0].trim();
                    return paramName;
                }).filter(p => p);
                
                // Add assignments for each parameter if it's a simple name
                for (const param of params) {
                    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(param)) {
                        stub += `  this.${param} = ${param};\n`;
                    }
                }
            }
        }
        
        stub += '}';
        return stub;
    }

    static createFilteredCode(sourceCode, analysis, options = {}) {
        const {
            includeImports = true,
            includeExports = true,
            includeClasses = [],
            excludeClasses = [],
            includeFunctions = [],
            excludeFunctions = [],
            includeVariables = [],
            excludeVariables = [],
            includeMethods = {},   // { className: [methodName] }
            excludeMethods = {},   // { className: [methodName] }
            removeAllComments = false,
            removeOnlyJSDoc = false,
            mode = 'exclude',
            generateMergeScript = false,
            mergeScriptPath = null
        } = options;
    
        const originalCode = sourceCode;
        let partsToRemove = [];
        
        // === 1. Imports / Exports ===
        if (!includeImports) partsToRemove.push(...analysis.imports);
        if (!includeExports) partsToRemove.push(...analysis.exports);
    
        // === 2. Classes / Functions / Variables ===
        if (mode === 'include') {
            const keepClasses = new Set(includeClasses);
            for (const cls of analysis.classes) {
                if (!keepClasses.has(cls.name)) {
                    partsToRemove.push(cls);
                }
            }
            
            const keepFunctions = new Set(includeFunctions);
            for (const fn of analysis.functions) {
                if (!keepFunctions.has(fn.name)) {
                    partsToRemove.push(fn);
                }
            }
            
            const keepVariables = new Set(includeVariables);
            for (const v of analysis.variables) {
                if (!keepVariables.has(v.name)) {
                    partsToRemove.push(v);
                }
            }
        } else { // exclude mode
            if (excludeClasses.length > 0) {
                const toRemove = analysis.classes.filter(cls => excludeClasses.includes(cls.name));
                partsToRemove.push(...toRemove);
            }
            if (excludeFunctions.length > 0) {
                const toRemove = analysis.functions.filter(fn => excludeFunctions.includes(fn.name));
                partsToRemove.push(...toRemove);
            }
            if (excludeVariables.length > 0) {
                const toRemove = analysis.variables.filter(v => excludeVariables.includes(v.name));
                partsToRemove.push(...toRemove);
            }
        }

        // === 3. Method-level filtering with syntax-preserving stubs ===
        const removedClassNames = new Set(
            partsToRemove.filter(p => p.type === 'class').map(p => p.name)
        );
        const keptClasses = analysis.classes.filter(cls => !removedClassNames.has(cls.name));
        
        // Track method replacements (start, end, replacement)
        const methodReplacements = [];
        
        for (const cls of keptClasses) {
            const methodsToProcess = [];
            
            if (mode === 'include') {
                const methodsToKeep = includeMethods[cls.name];
                if (methodsToKeep !== undefined) {
                    for (const method of cls.methods) {
                        if (!methodsToKeep.includes(method.name)) {
                            methodsToProcess.push(method);
                        }
                    }
                }
            } else { // exclude mode
                const methodsToExclude = excludeMethods[cls.name];
                if (methodsToExclude && methodsToExclude.length > 0) {
                    for (const method of cls.methods) {
                        if (methodsToExclude.includes(method.name)) {
                            methodsToProcess.push(method);
                        }
                    }
                }
            }
            
            // Create stubs for methods to remove
            for (const method of methodsToProcess) {
                const stub = this.createMethodStub(sourceCode, method);
                methodReplacements.push({
                    start: method.absoluteStart,
                    end: method.absoluteEnd,
                    replacement: stub,
                    name: `${cls.name}.${method.name}`
                });
            }
        }

        // === 4. Comments ===
        if (removeAllComments) {
            partsToRemove.push(...analysis.comments);
        } else if (removeOnlyJSDoc) {
            partsToRemove.push(...analysis.jsdocComments);
        }
    
        // === Deduplicate and merge ranges ===
        const seen = new Set();
        partsToRemove = partsToRemove.filter(part => {
            const key = `${part.start}-${part.end}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    
        partsToRemove.sort((a, b) => a.start - b.start);
        
        // Add method replacements to parts to remove
        for (const replacement of methodReplacements) {
            partsToRemove.push({
                type: 'class-method',
                name: replacement.name,
                start: replacement.start,
                end: replacement.end,
                content: sourceCode.substring(replacement.start, replacement.end)
            });
        }
        
        const mergedRanges = [];
        for (const part of partsToRemove) {
            if (mergedRanges.length === 0) {
                mergedRanges.push({ start: part.start, end: part.end });
            } else {
                const last = mergedRanges[mergedRanges.length - 1];
                if (part.start <= last.end) {
                    last.end = Math.max(last.end, part.end);
                } else {
                    mergedRanges.push({ start: part.start, end: part.end });
                }
            }
        }
        
        // Build filtered code with method stubs
        let filteredCode = '';
        let pos = 0;
        
        // Sort all replacements by start position
        methodReplacements.sort((a, b) => a.start - b.start);
        
        for (const range of mergedRanges) {
            // Check if this range is a method that should be stubbed
            const methodReplacement = methodReplacements.find(
                mr => mr.start === range.start && mr.end === range.end
            );
            
            if (methodReplacement) {
                // Use the stub instead of completely removing
                filteredCode += originalCode.substring(pos, range.start);
                filteredCode += methodReplacement.replacement;
                pos = range.end;
            } else {
                // Normal removal
                filteredCode += originalCode.substring(pos, range.start);
                pos = range.end;
            }
        }
        filteredCode += originalCode.substring(pos);
        
        // Clean up excessive newlines but be careful not to break syntax
        filteredCode = filteredCode.replace(/\n{4,}/g, '\n\n\n');
        
        // Fix any double commas or syntax issues
        filteredCode = filteredCode.replace(/,\s*,/g, ',');
        filteredCode = filteredCode.replace(/\(\s*,/g, '(');
        filteredCode = filteredCode.replace(/,\s*\)/g, ')');
        
        // === Generate merge script ===
        let mergeScriptGenerated = false;
        let actualMergeScriptPath = null;
        if (generateMergeScript && partsToRemove.length > 0) {
            const mergeContent = MergeScriptGenerator.createMergeScript(partsToRemove, originalCode);
            actualMergeScriptPath = mergeScriptPath || 'merge_script.js';
            fs.writeFileSync(actualMergeScriptPath, mergeContent);
            mergeScriptGenerated = true;
        }
        
        return {
            code: filteredCode,
            removedParts: partsToRemove,
            mergeScriptGenerated,
            mergeScriptPath: actualMergeScriptPath
        };
    }
}

// ============================================================================
// INTERACTIVE MENU
// ============================================================================
class InteractiveMenu {
    constructor(filePath) {
        this.filePath = filePath;
        this.terminal = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });
        this.sourceCode = fs.readFileSync(filePath, 'utf-8');
        this.analysis = CodeAnalyzer.analyzeCode(this.sourceCode);
    }

    async askQuestion(prompt) {
        return new Promise(resolve => {
            this.terminal.question(prompt, resolve);
        });
    }

    async displayMainMenu() {
        let running = true;
        while (running) {
            console.clear();
            console.log('JavaScript Code Parser');
            console.log('='.repeat(50));
            console.log('File: ' + path.basename(this.filePath));
            console.log('Size: ' + this.sourceCode.length + ' chars, ' + this.sourceCode.split('\n').length + ' lines');
            console.log('');
            console.log('1. Show all parts');
            console.log('2. Show classes');
            console.log('3. Show functions');
            console.log('4. Show variables');
            console.log('5. Show comments');
            console.log('6. Filter (exclude mode)');
            console.log('7. Filter (include mode)');
            console.log('8. Export parts');
            console.log('9. Statistics');
            console.log('10. Configurations');
            console.log('0. Exit');

            const choice = await this.askQuestion('\nSelect option: ');
            console.clear();
            
            switch (choice) {
                case '1': this.showAllParts(); break;
                case '2': this.showClasses(); break;
                case '3': this.showFunctions(); break;
                case '4': this.showVariables(); break;
                case '5': this.showComments(); break;
                case '6': await this.handleFilter('exclude'); break;
                case '7': await this.handleFilter('include'); break;
                case '8': await this.handleExport(); break;
                case '9': this.showStatistics(); break;
                case '10': await this.handleConfigurations(); break;
                case '0':
                    console.log('\nGoodbye!');
                    this.terminal.close();
                    running = false;
                    process.exit(0);
                    break;
                default:
                    console.log('Invalid option.');
            }
            
            if (choice !== '0') {
                await this.askQuestion('\nPress Enter to continue...');
            }
        }
    }

    showAllParts() {
        const parts = this.analysis.allParts();
        console.log('All Parts (' + parts.length + '):');
        console.log('='.repeat(50));
        parts.forEach((part, i) => {
            console.log(`${i+1}. [${part.type.toUpperCase()}] ${part.name || 'unnamed'} (${part.content.length} chars)`);
        });
    }

    showClasses() {
        console.log('Classes (' + this.analysis.classes.length + '):');
        console.log('='.repeat(50));
        if (this.analysis.classes.length === 0) {
            console.log('None');
            return;
        }
        this.analysis.classes.forEach((cls, i) => {
            const ext = cls.extends ? ' extends ' + cls.extends : '';
            console.log(`${i+1}. ${cls.name}${ext} (${cls.methods.length} methods, ${cls.content.length} chars)`);
        });
    }

    showFunctions() {
        console.log('Functions (' + this.analysis.functions.length + '):');
        console.log('='.repeat(50));
        if (this.analysis.functions.length === 0) {
            console.log('None');
            return;
        }
        this.analysis.functions.forEach((fn, i) => {
            const flags = [];
            if (fn.isAsync) flags.push('async');
            if (fn.isArrow) flags.push('arrow');
            const flagText = flags.length > 0 ? ` (${flags.join(', ')})` : '';
            console.log(`${i+1}. ${fn.name}${flagText} (${fn.content.length} chars)`);
        });
    }

    showVariables() {
        console.log('Variables (' + this.analysis.variables.length + '):');
        console.log('='.repeat(50));
        if (this.analysis.variables.length === 0) {
            console.log('None');
            return;
        }
        this.analysis.variables.forEach((v, i) => {
            console.log(`${i+1}. ${v.name} (${v.content.length} chars)`);
        });
    }

    showComments() {
        const regular = this.analysis.comments.filter(c => !c.isJSDoc);
        const jsdoc = this.analysis.jsdocComments;
        console.log('Comments:');
        console.log(`  Regular: ${regular.length}`);
        console.log(`  JSDoc:   ${jsdoc.length}`);
    }

    showStatistics() {
        console.log('Statistics');
        console.log('='.repeat(50));
        console.log('Classes:   ' + this.analysis.classes.length);
        console.log('Functions: ' + this.analysis.functions.length);
        console.log('Variables: ' + this.analysis.variables.length);
        console.log('Imports:   ' + this.analysis.imports.length);
        console.log('Exports:   ' + this.analysis.exports.length);
        console.log('Comments:  ' + this.analysis.comments.length);
        console.log('Total:     ' + this.sourceCode.length + ' chars, ' + this.sourceCode.split('\n').length + ' lines');
    }

    async selectMultipleItems(items, itemType) {
        if (items.length === 0) {
            console.log('\nNo ' + itemType + ' available.');
            return [];
        }
        console.log('\nAvailable ' + itemType + ':');
        console.log('-'.repeat(50));
        items.forEach((item, i) => console.log(`  ${i+1}. ${item.name}`));
        console.log('\n  0 = done, a = all, n = none');
        
        const selected = new Set();
        let selecting = true;
        while (selecting) {
            const choice = await this.askQuestion(`\nSelect ${itemType}: `);
            if (choice === '0') {
                selecting = false;
            } else if (choice.toLowerCase() === 'a') {
                items.forEach(it => selected.add(it.name));
                console.log(`  All selected (${selected.size} items)`);
                selecting = false;
            } else if (choice.toLowerCase() === 'n') {
                selected.clear();
                console.log('  None selected');
                selecting = false;
            } else {
                const num = parseInt(choice);
                if (isNaN(num) || num < 1 || num > items.length) {
                    console.log('  Invalid');
                } else {
                    const item = items[num-1];
                    if (selected.has(item.name)) {
                        selected.delete(item.name);
                        console.log(`  - ${item.name}`);
                    } else {
                        selected.add(item.name);
                        console.log(`  + ${item.name}`);
                    }
                    console.log(`  Selected: ${selected.size}`);
                }
            }
        }
        return Array.from(selected);
    }

    /**
     * For a given class name, let user pick methods.
     * @param {string} className 
     * @returns {string[]} Array of method names selected.
     */
    async selectMethodsOfClass(className) {
        const cls = this.analysis.classes.find(c => c.name === className);
        if (!cls || cls.methods.length === 0) {
            console.log(`\nClass "${className}" has no methods.`);
            return [];
        }
        console.log(`\nMethods of class "${className}":`);
        console.log('-'.repeat(50));
        cls.methods.forEach((m, i) => {
            console.log(`  ${i+1}. ${m.name} (${m.content.length} chars)`);
        });
        console.log('\n  0 = done, a = all, n = none');
        const selected = new Set();
        let selecting = true;
        while (selecting) {
            const choice = await this.askQuestion(`\nSelect methods for ${className}: `);
            if (choice === '0') {
                selecting = false;
            } else if (choice.toLowerCase() === 'a') {
                cls.methods.forEach(m => selected.add(m.name));
                console.log('  All selected');
                selecting = false;
            } else if (choice.toLowerCase() === 'n') {
                selected.clear();
                console.log('  None selected');
                selecting = false;
            } else {
                const num = parseInt(choice);
                if (isNaN(num) || num < 1 || num > cls.methods.length) {
                    console.log('  Invalid');
                } else {
                    const method = cls.methods[num-1];
                    if (selected.has(method.name)) {
                        selected.delete(method.name);
                        console.log(`  - ${method.name}`);
                    } else {
                        selected.add(method.name);
                        console.log(`  + ${method.name}`);
                    }
                    console.log(`  Selected: ${selected.size}`);
                }
            }
        }
        return Array.from(selected);
    }

    /**
     * Lets the user select methods for a list of classes.
     * @param {string[]} classNames - Classes to process.
     * @returns {Object} Mapping from className to array of method names.
     */
    async selectMethodsForClasses(classNames) {
        const result = {};
        for (const className of classNames) {
            const methods = await this.selectMethodsOfClass(className);
            if (methods.length > 0) {
                result[className] = methods;
            }
        }
        return result;
    }

    async handleFilter(mode) {
        const isExclude = mode === 'exclude';
        console.log(isExclude ? 'Filter (Exclude Mode)' : 'Filter (Include Mode)');
        console.log('='.repeat(50));
        
        // ---- 1. Class / Function / Variable selection ----
        const selectedClasses = await this.selectMultipleItems(this.analysis.classes, 'classes');
        const selectedFunctions = await this.selectMultipleItems(this.analysis.functions, 'functions');
        const selectedVariables = await this.selectMultipleItems(this.analysis.variables, 'variables');
        
        // ---- 2. Method-level selection ----
        let methodSelection = {};
        if (mode === 'include' && selectedClasses.length > 0) {
            const refine = await this.askQuestion('\nRefine methods to include for these classes? (y/n): ');
            if (refine.toLowerCase() === 'y') {
                methodSelection = await this.selectMethodsForClasses(selectedClasses);
            }
        } else if (mode === 'exclude') {
            const refine = await this.askQuestion('\nExclude specific methods from classes? (y/n): ');
            if (refine.toLowerCase() === 'y') {
                const classChoices = this.analysis.classes.map(c => c.name);
                console.log('\nSelect classes to refine method exclusion:');
                const chosenClassNames = await this.selectMultipleItems(
                    this.analysis.classes.map(c => ({ name: c.name })),
                    'classes for method exclusion'
                );
                if (chosenClassNames.length > 0) {
                    methodSelection = await this.selectMethodsForClasses(chosenClassNames);
                }
            }
        }
        
        // ---- 3. Comments ----
        console.log('\nComments: 1=Keep  2=Remove all  3=Remove JSDoc');
        const commentChoice = await this.askQuestion('Select (default 1): ');
        const generateMerge = await this.askQuestion('\nGenerate merge script? (y/n, default y): ');
        
        // ---- 4. Build options ----
        const options = {
            mode,
            removeAllComments: commentChoice === '2',
            removeOnlyJSDoc: commentChoice === '3',
            generateMergeScript: generateMerge.toLowerCase() !== 'n'
        };
        
        if (isExclude) {
            options.excludeClasses = selectedClasses;
            options.excludeFunctions = selectedFunctions;
            options.excludeVariables = selectedVariables;
            if (Object.keys(methodSelection).length > 0) {
                options.excludeMethods = methodSelection;
            }
        } else {
            options.includeClasses = selectedClasses;
            options.includeFunctions = selectedFunctions;
            options.includeVariables = selectedVariables;
            if (Object.keys(methodSelection).length > 0) {
                options.includeMethods = methodSelection;
            }
        }
        
        // ---- 5. Execute filter ----
        console.log('\nProcessing...');
        const result = CodeFilter.createFilteredCode(this.sourceCode, this.analysis, options);
        
        const suffix = isExclude ? '_filtered.js' : '_included.js';
        const outputFile = this.filePath.replace('.js', suffix);
        fs.writeFileSync(outputFile, result.code);
        
        console.log('\n' + '='.repeat(50));
        console.log('Saved: ' + outputFile);
        console.log('Original: ' + this.sourceCode.length + ' chars, ' + this.sourceCode.split('\n').length + ' lines');
        console.log('Result:   ' + result.code.length + ' chars, ' + result.code.split('\n').length + ' lines');
        console.log('Removed:  ' + result.removedParts.length + ' parts');
        console.log('Lines removed: ' + (this.sourceCode.split('\n').length - result.code.split('\n').length));
        
        if (result.removedParts.length > 0) {
            console.log('\nRemoved items:');
            for (const part of result.removedParts) {
                console.log(`  - [${part.type}] ${part.name} (${part.content.length} chars)`);
            }
        }
        if (result.mergeScriptGenerated) {
            console.log('\nMerge script: ' + result.mergeScriptPath);
        }
        
        const saveConfig = await this.askQuestion('\nSave configuration? (y/n, default y): ');
        if (saveConfig.toLowerCase() !== 'n') {
            const configName = await this.askQuestion('Configuration name: ');
            if (configName.trim()) {
                ConfigManager.saveConfiguration(configName.trim(), options);
                console.log('Saved: ' + configName.trim());
            }
        }
    }

    async handleExport() {
        console.log('Export Parts');
        const allParts = this.analysis.allParts();
        allParts.forEach((part, i) => {
            console.log(`  ${i+1}. [${part.type.toUpperCase()}] ${part.name || 'unnamed'}`);
        });
        const numbersInput = await this.askQuestion('\nNumbers (comma-separated): ');
        const indices = numbersInput.split(',').map(n => parseInt(n.trim()) - 1).filter(n => !isNaN(n));
        const selectedParts = indices.map(i => allParts[i]).filter(Boolean);
        
        if (selectedParts.length > 0) {
            const content = selectedParts.map(p => p.content).join('\n\n');
            const outputFile = this.filePath.replace('.js', '_exported.js');
            fs.writeFileSync(outputFile, content);
            console.log('Exported ' + selectedParts.length + ' parts to: ' + outputFile);
        } else {
            console.log('No valid parts selected');
        }
    }

    async handleConfigurations() {
        const configurations = ConfigManager.loadConfigurations();
        const configNames = Object.keys(configurations.configs);
        
        let managing = true;
        while (managing) {
            console.clear();
            console.log('Configuration Management');
            console.log('1. List  2. Apply  3. Delete  0. Back');
            const choice = await this.askQuestion('\nSelect: ');
            
            if (choice === '0') { managing = false; break; }
            console.clear();
            
            if (choice === '1') {
                if (configNames.length === 0) {
                    console.log('No configurations saved.');
                } else {
                    configNames.forEach((name, i) => {
                        console.log(`${i+1}. ${name} (${configurations.configs[name].options.mode})`);
                    });
                }
            } else if (choice === '2') {
                if (configNames.length === 0) {
                    console.log('No configurations.');
                } else {
                    configNames.forEach((name, i) => console.log(`${i+1}. ${name}`));
                    const sel = await this.askQuestion('\nSelect: ');
                    const idx = parseInt(sel) - 1;
                    if (idx >= 0 && idx < configNames.length) {
                        const options = configurations.configs[configNames[idx]].options;
                        const result = CodeFilter.createFilteredCode(this.sourceCode, this.analysis, options);
                        const suffix = options.mode === 'include' ? '_included.js' : '_filtered.js';
                        const out = this.filePath.replace('.js', suffix);
                        fs.writeFileSync(out, result.code);
                        console.log('Saved: ' + out + ' (' + result.removedParts.length + ' parts removed)');
                    }
                }
            } else if (choice === '3') {
                if (configNames.length === 0) {
                    console.log('No configurations.');
                } else {
                    configNames.forEach((name, i) => console.log(`${i+1}. ${name}`));
                    const sel = await this.askQuestion('\nDelete: ');
                    const idx = parseInt(sel) - 1;
                    if (idx >= 0 && idx < configNames.length) {
                        const nameToDelete = configNames[idx];
                        delete configurations.configs[nameToDelete];
                        ConfigManager.saveConfigurations(configurations);
                        console.log('Deleted: ' + nameToDelete);
                    }
                }
            }
            await this.askQuestion('\nPress Enter...');
        }
    }
}

// ============================================================================
// MAIN CODE PARSER
// ============================================================================
class CodeParser {
    static #sourceCode = '';
    static #filePath = '';

    static analyzeCode(code) {
        this.#sourceCode = code;
        return CodeAnalyzer.analyzeCode(code);
    }

    static createFilteredCode(analysis, options = {}) {
        return CodeFilter.createFilteredCode(this.#sourceCode, analysis, options);
    }

    static async runInteractive() {
        const args = process.argv.slice(2);
        if (args.length === 0) {
            console.log('Usage: node code-parser-interface.js <file.js> [config-name]');
            process.exit(1);
        }

        this.#filePath = args[0];
        ConfigManager.initializeConfigurationPath(this.#filePath);
        
        if (!fs.existsSync(this.#filePath)) {
            console.error('ERROR: File not found: ' + this.#filePath);
            process.exit(1);
        }

        this.#sourceCode = fs.readFileSync(this.#filePath, 'utf-8');
        const analysis = this.analyzeCode(this.#sourceCode);
        
        if (args.length >= 2) {
            const configurations = ConfigManager.loadConfigurations();
            if (configurations.configs[args[1]]) {
                const options = configurations.configs[args[1]].options;
                console.log('Applying config: ' + args[1]);
                const result = this.createFilteredCode(analysis, options);
                const suffix = options.mode === 'include' ? '_included.js' : '_filtered.js';
                const outputFile = this.#filePath.replace('.js', suffix);
                fs.writeFileSync(outputFile, result.code);
                console.log('Saved: ' + outputFile);
                console.log('Removed: ' + result.removedParts.length + ' parts');
                if (result.mergeScriptGenerated) {
                    console.log('Merge script: ' + result.mergeScriptPath);
                }
                process.exit(0);
            }
            console.error('Config not found: ' + args[1]);
            process.exit(1);
        }
        
        const menu = new InteractiveMenu(this.#filePath);
        await menu.displayMainMenu();
    }
}

// ============================================================================
// ENTRY POINT
// ============================================================================
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    CodeParser.runInteractive().catch(console.error);
}

export default CodeParser;