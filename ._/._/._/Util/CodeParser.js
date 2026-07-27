// CodeParser.js
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CodeParser {
    static #parsedTree = null;
    static #originalCode = '';
    static #filePath = '';

    static parse(filePath) {
        const code = fs.readFileSync(filePath, 'utf8');
        this.#originalCode = code;
        this.#filePath = filePath;
        
        this.#parsedTree = {
            filePath,
            imports: [],
            exports: [],
            classes: [],
            functions: [],
            variables: [],
            comments: [],
            jsdoc: [],
            raw: {
                lines: code.split('\n'),
                totalLines: 0,
                totalChars: code.length
            }
        };

        this.#breakdownCode(code);
        return this.#parsedTree;
    }

    static getImports() { return this.#parsedTree?.imports || []; }
    static getExports() { return this.#parsedTree?.exports || []; }
    
    static getClasses(options = {}) {
        let classes = this.#parsedTree?.classes || [];
        if (options.includeClasses) classes = classes.filter(c => options.includeClasses.includes(c.name));
        if (options.excludeClasses) classes = classes.filter(c => !options.excludeClasses.includes(c.name));
        return classes;
    }

    static getFunctions(options = {}) {
        let functions = this.#parsedTree?.functions || [];
        if (options.includeFunctions) functions = functions.filter(f => options.includeFunctions.includes(f.name));
        if (options.excludeFunctions) functions = functions.filter(f => !options.excludeFunctions.includes(f.name));
        return functions;
    }

    static getMethods(options = {}) {
        let methods = [];
        const classes = this.getClasses(options);
        
        for (const cls of classes) {
            let allItems = [];
            
            if (cls.constructor) allItems.push({...cls.constructor, className: cls.name});
            
            for (const m of (cls.methods || [])) allItems.push({...m, className: cls.name});
            for (const m of (cls.staticMethods || [])) allItems.push({...m, className: cls.name});
            for (const m of (cls.getters || [])) allItems.push({...m, className: cls.name});
            for (const m of (cls.setters || [])) allItems.push({...m, className: cls.name});
            for (const m of (cls.constructorProps || [])) allItems.push({...m, className: cls.name});
            for (const m of (cls.properties || [])) allItems.push({...m, className: cls.name});
            for (const m of (cls.assignments || [])) allItems.push({...m, className: cls.name});
            
            if (options.includeMethods) {
                allItems = allItems.filter(m => options.includeMethods.includes(m.name));
            }
            if (options.excludeMethods) {
                allItems = allItems.filter(m => !options.excludeMethods.includes(m.name));
            }
            
            methods.push(...allItems);
        }
        return methods;
    }

    static getJSDoc() { return this.#parsedTree?.jsdoc || []; }
    static getComments() { return this.#parsedTree?.comments || []; }
    static getVariables() { return this.#parsedTree?.variables || []; }
    static getTree() { return this.#parsedTree; }

    static generateFiltered(selection = {}) {
        const lines = this.#originalCode.split('\n');
        const keepLines = new Set();
        
        const addRange = (start, end) => {
            // Ensure valid numbers and clamp to available lines
            const s = Math.max(1, Math.min(start, lines.length));
            const e = Math.max(1, Math.min(end, lines.length));
            for (let i = s; i <= e; i++) keepLines.add(i);
        };
        
        // Track which lines belong to which selected items
        // to avoid including lines from excluded items with same name
        
        if (selection.includeImports) {
            for (const imp of this.#parsedTree.imports) {
                addRange(imp.lineStart, imp.lineEnd);
            }
        }
        
        if (selection.includeExports) {
            for (const exp of this.#parsedTree.exports) {
                keepLines.add(Math.max(1, Math.min(exp.line, lines.length)));
            }
        }
        
        if (selection.includeClasses?.length > 0) {
            for (const cls of this.#parsedTree.classes) {
                if (selection.includeClasses.includes(cls.name)) {
                    // Always include JSDoc if option is enabled
                    if (cls.jsdoc && (selection.includeAllJSDoc || selection.includeAllComments)) {
                        addRange(cls.jsdoc.lineStart, cls.jsdoc.lineEnd);
                    }
                    // Always include the full class definition
                    addRange(cls.lineStart, cls.lineEnd);
                    
                    // If specific methods are selected, we keep the whole class
                    // but mark which method lines to keep (they're already inside class range)
                    if (selection.includeMethods?.length > 0) {
                        // The class range already includes all methods
                        // We just need to ensure the class stays included
                        // Methods are inside the class range, so they're already kept
                    }
                }
            }
        }
        
        if (selection.includeFunctions?.length > 0) {
            for (const func of this.#parsedTree.functions) {
                if (selection.includeFunctions.includes(func.name)) {
                    if (func.jsdoc && (selection.includeAllJSDoc || selection.includeAllComments)) {
                        addRange(func.jsdoc.lineStart, func.jsdoc.lineEnd);
                    }
                    addRange(func.lineStart, func.lineEnd);
                }
            }
        }
        
        if (selection.includeVariables) {
            for (const v of this.#parsedTree.variables) {
                keepLines.add(Math.max(1, Math.min(v.line, lines.length)));
            }
        }
        
        if (selection.includeAllComments) {
            for (const comment of this.#parsedTree.comments) {
                if (comment.lineStart && comment.lineEnd) {
                    addRange(comment.lineStart, comment.lineEnd);
                } else if (comment.line) {
                    keepLines.add(Math.max(1, Math.min(comment.line, lines.length)));
                }
            }
        }
        
        if (selection.includeAllJSDoc) {
            for (const jsdoc of this.#parsedTree.jsdoc) {
                addRange(jsdoc.lineStart, jsdoc.lineEnd);
            }
        }
        
        // Build result from sorted line numbers
        const sortedLines = [...keepLines].sort((a, b) => a - b);
        if (sortedLines.length === 0) return '';
        
        let result = '';
        let lastLine = sortedLines[0] - 1;
        
        for (const lineNum of sortedLines) {
            // Add blank line for gaps between non-consecutive lines
            if (lineNum > lastLine + 1 && result.length > 0 && !result.endsWith('\n\n')) {
                result += '\n';
            }
            const idx = lineNum - 1;
            if (idx >= 0 && idx < lines.length) {
                result += lines[idx] + '\n';
            }
            lastLine = lineNum;
        }
        
        return result;
    }

    static #calcCharCount(lineStart, lineEnd) {
        const lines = this.#originalCode.split('\n');
        let total = 0;
        const s = Math.max(0, lineStart - 1);
        const e = Math.min(lines.length - 1, lineEnd - 1);
        for (let i = s; i <= e; i++) {
            total += lines[i].length;
            if (i < e) total += 1; // newline
        }
        return total;
    }

    static #tokenize(lines) {
        const tokens = [];
        let inBlockComment = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            let clean = '';
            let inString = false;
            let stringChar = '';
            let inLineComment = false;
            let j = 0;
            
            while (j < line.length) {
                const ch = line[j];
                const next = j + 1 < line.length ? line[j + 1] : '';
                
                if (inBlockComment) {
                    if (ch === '*' && next === '/') {
                        inBlockComment = false;
                        j += 2;
                        continue;
                    }
                    j++;
                    continue;
                }
                
                if (inLineComment) {
                    j++;
                    continue;
                }
                
                if (!inString) {
                    if (ch === '/' && next === '/') {
                        inLineComment = true;
                        j += 2;
                        continue;
                    }
                    if (ch === '/' && next === '*') {
                        inBlockComment = true;
                        j += 2;
                        continue;
                    }
                }
                
                if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
                    inString = true;
                    stringChar = ch;
                    clean += ' ';
                    j++;
                    continue;
                }
                
                if (inString) {
                    if (ch === '\\') {
                        clean += '  ';
                        j += 2;
                        continue;
                    }
                    if (ch === stringChar) {
                        inString = false;
                    }
                    clean += ' ';
                    j++;
                    continue;
                }
                
                clean += ch;
                j++;
            }
            
            tokens.push({
                lineNum,
                original: line,
                clean: clean,
                trimmed: clean.trim()
            });
        }
        
        return tokens;
    }

    static #findBlockEnd(tokens, startIdx, maxIdx) {
        let depth = 0;
        let started = false;
        
        for (let i = startIdx; i <= maxIdx; i++) {
            const line = tokens[i].clean;
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '{') {
                    depth++;
                    started = true;
                } else if (line[j] === '}') {
                    depth--;
                    if (started && depth === 0) return i;
                }
            }
        }
        return maxIdx;
    }

    static #extractName(clean) {
        const words = clean.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g);
        return words || [];
    }

    static #isControlFlow(name) {
        const keywords = new Set([
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 
            'continue', 'return', 'throw', 'try', 'catch', 'finally', 'new',
            'delete', 'typeof', 'instanceof', 'void', 'in', 'of', 'default',
            'class', 'function', 'import', 'export', 'const', 'let', 'var',
            'static', 'async', 'await', 'yield', 'get', 'set', 'constructor',
            'this', 'super', 'true', 'false', 'null', 'undefined'
        ]);
        return keywords.has(name);
    }

    static #breakdownCode(code) {
        const lines = code.split('\n');
        this.#parsedTree.raw.totalLines = lines.length;
        this.#parsedTree.raw.totalChars = code.length;
        
        this.#collectComments(lines);
        
        const tokens = this.#tokenize(lines);
        
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            const c = t.trimmed;
            
            if (!c) { i++; continue; }
            
            // Import
            if (c.startsWith('import ')) {
                const imp = this.#parseImport(c);
                if (imp) {
                    imp.lineStart = t.lineNum;
                    imp.lineEnd = t.lineNum;
                    imp.charCount = this.#calcCharCount(t.lineNum, t.lineNum);
                    this.#parsedTree.imports.push(imp);
                }
                i++;
                continue;
            }
            
            // Standalone export
            if ((c.startsWith('export {') || c.startsWith('export default') || 
                 c.startsWith('export type') || c.startsWith('export interface') ||
                 (c.startsWith('export ') && !c.includes('class') && !c.includes('function'))) &&
                !c.startsWith('export class') && !c.startsWith('export function')) {
                this.#parsedTree.exports.push({
                    statement: t.original.trim(),
                    line: t.lineNum,
                    type: c.includes('default') ? 'default' : 'named',
                    charCount: this.#calcCharCount(t.lineNum, t.lineNum)
                });
                i++;
                continue;
            }
            
            // Class
            if (c.startsWith('class ') || c.startsWith('export class ')) {
                const classData = this.#parseClass(tokens, i);
                if (classData) {
                    if (this.#parsedTree.jsdoc.length > 0) {
                        const lastDoc = this.#parsedTree.jsdoc[this.#parsedTree.jsdoc.length - 1];
                        if (lastDoc.lineEnd === t.lineNum - 1 || lastDoc.lineEnd === t.lineNum) {
                            classData.jsdoc = lastDoc;
                        }
                    }
                    classData.charCount = this.#calcCharCount(classData.lineStart, classData.lineEnd);
                    this.#parsedTree.classes.push(classData);
                    i = classData.bodyEnd;
                    continue;
                }
                i++;
                continue;
            }
            
            // Function
            if (c.startsWith('function ') || c.startsWith('async function ') ||
                c.startsWith('export function ') || c.startsWith('export async function ')) {
                const funcData = this.#parseFunction(tokens, i);
                if (funcData) {
                    if (this.#parsedTree.jsdoc.length > 0) {
                        const lastDoc = this.#parsedTree.jsdoc[this.#parsedTree.jsdoc.length - 1];
                        if (lastDoc.lineEnd === t.lineNum - 1 || lastDoc.lineEnd === t.lineNum) {
                            funcData.jsdoc = lastDoc;
                        }
                    }
                    funcData.charCount = this.#calcCharCount(funcData.lineStart, funcData.lineEnd);
                    this.#parsedTree.functions.push(funcData);
                    i = funcData.blockEnd;
                    continue;
                }
                i++;
                continue;
            }
            
            // Variable
            if ((c.startsWith('const ') || c.startsWith('let ') || c.startsWith('var ')) &&
                c.includes('=') && !c.includes('=>') && !c.includes('function(') && 
                !c.includes('function ') && !c.includes('class ')) {
                this.#parsedTree.variables.push({
                    declaration: t.original.trim(),
                    line: t.lineNum,
                    kind: c.startsWith('const') ? 'const' : c.startsWith('let') ? 'let' : 'var',
                    charCount: this.#calcCharCount(t.lineNum, t.lineNum)
                });
            }
            
            i++;
        }
    }

    static #collectComments(lines) {
        let inBlock = false;
        let blockStart = 0;
        let blockLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const lineNum = i + 1;
            
            if (inBlock) {
                blockLines.push(line);
                if (trimmed.includes('*/')) {
                    inBlock = false;
                    const content = blockLines.join('\n');
                    const isJSDoc = content.trim().startsWith('/**');
                    const commentObj = {
                        type: 'block',
                        content: content,
                        lineStart: blockStart,
                        lineEnd: lineNum,
                        charCount: this.#calcCharCount(blockStart, lineNum)
                    };
                    if (isJSDoc) {
                        commentObj.parsed = this.#parseJSDoc(content);
                        this.#parsedTree.jsdoc.push(commentObj);
                    } else {
                        this.#parsedTree.comments.push(commentObj);
                    }
                    blockLines = [];
                }
                continue;
            }
            
            if (trimmed.startsWith('/*')) {
                if (trimmed.includes('*/')) {
                    const isJSDoc = trimmed.startsWith('/**');
                    const commentObj = {
                        type: 'block',
                        content: trimmed,
                        lineStart: lineNum,
                        lineEnd: lineNum,
                        charCount: this.#calcCharCount(lineNum, lineNum)
                    };
                    if (isJSDoc) {
                        commentObj.parsed = this.#parseJSDoc(trimmed);
                        this.#parsedTree.jsdoc.push(commentObj);
                    } else {
                        this.#parsedTree.comments.push(commentObj);
                    }
                } else {
                    inBlock = true;
                    blockStart = lineNum;
                    blockLines = [line];
                }
                continue;
            }
            
            if (trimmed.startsWith('//')) {
                this.#parsedTree.comments.push({
                    type: 'line',
                    content: trimmed,
                    line: lineNum,
                    charCount: this.#calcCharCount(lineNum, lineNum)
                });
            }
        }
    }

    static #parseClass(tokens, startIdx) {
        const startToken = tokens[startIdx];
        let clean = startToken.trimmed;
        if (clean.startsWith('export ')) clean = clean.substring(7).trim();
        
        const classMatch = clean.match(/^class\s+(\w+)/);
        if (!classMatch) return null;
        
        const className = classMatch[1];
        const classData = {
            name: className,
            lineStart: startToken.lineNum,
            extends: null,
            methods: [],
            staticMethods: [],
            getters: [],
            setters: [],
            constructor: null,
            constructorProps: [],
            properties: [],
            assignments: [],
            jsdoc: null,
            bodyEnd: startIdx
        };
        
        const extMatch = clean.match(/extends\s+(\w+)/);
        if (extMatch) classData.extends = extMatch[1];
        
        let bodyStart = startIdx;
        for (let i = startIdx; i < tokens.length; i++) {
            if (tokens[i].clean.includes('{')) {
                bodyStart = i;
                break;
            }
        }
        
        const bodyEnd = this.#findBlockEnd(tokens, bodyStart, tokens.length - 1);
        classData.lineEnd = tokens[bodyEnd].lineNum;
        classData.bodyEnd = bodyEnd + 1;
        
        this.#parseClassBody(tokens, bodyStart + 1, bodyEnd, classData);
        
        return classData;
    }

    static #parseClassBody(tokens, startIdx, endIdx, classData) {
        let i = startIdx;
        let pendingJSDoc = null;
        
        while (i < endIdx) {
            const token = tokens[i];
            const clean = token.trimmed;
            
            if (!clean) { i++; continue; }
            
            if (this.#parsedTree.jsdoc.length > 0) {
                const lastDoc = this.#parsedTree.jsdoc[this.#parsedTree.jsdoc.length - 1];
                if (lastDoc.lineEnd === token.lineNum - 1 || lastDoc.lineEnd === token.lineNum) {
                    pendingJSDoc = lastDoc;
                }
            }
            
            if (clean.startsWith('/**') || clean.startsWith('*') || clean === '*/') {
                pendingJSDoc = null;
                i++;
                continue;
            }
            
            if (clean.startsWith('//') || clean.startsWith('/*')) {
                i++;
                continue;
            }
            
            let detected = this.#detectMember(tokens, i, endIdx);
            
            if (detected) {
                if (pendingJSDoc) {
                    detected.jsdoc = pendingJSDoc;
                    pendingJSDoc = null;
                }
                
                detected.charCount = this.#calcCharCount(detected.lineStart, detected.lineEnd);
                
                switch (detected.type) {
                    case 'constructor':
                        classData.constructor = detected;
                        this.#parseConstructorAssignments(tokens, detected.bodyStart, detected.bodyEnd, classData);
                        break;
                    case 'getter':
                        classData.getters.push(detected);
                        break;
                    case 'setter':
                        classData.setters.push(detected);
                        break;
                    case 'static-method':
                        classData.staticMethods.push(detected);
                        break;
                    case 'method':
                        classData.methods.push(detected);
                        break;
                    case 'property':
                        classData.properties.push(detected);
                        break;
                    case 'assignment':
                        classData.assignments.push(detected);
                        break;
                }
                
                i = detected.nextIdx;
                continue;
            }
            
            pendingJSDoc = null;
            i++;
        }
    }

    static #detectMember(tokens, idx, maxIdx) {
        const token = tokens[idx];
        const clean = token.trimmed;
        const lineNum = token.lineNum;
        
        if (!clean) return null;
        
        // CONSTRUCTOR
        if (/^constructor\s*\(/.test(clean)) {
            let bodyStart = idx;
            if (!clean.includes('{')) {
                for (let j = idx; j < maxIdx; j++) {
                    if (tokens[j].clean.includes('{')) { bodyStart = j; break; }
                }
            }
            const bodyEnd = this.#findBlockEnd(tokens, bodyStart, maxIdx);
            return {
                name: 'constructor',
                type: 'constructor',
                isStatic: false,
                isAsync: false,
                lineStart: lineNum,
                lineEnd: tokens[bodyEnd].lineNum,
                bodyStart: bodyStart + 1,
                bodyEnd: bodyEnd,
                nextIdx: bodyEnd + 1,
                params: this.#parseParams(clean)
            };
        }
        
        // STATIC
        if (/^static\s+/.test(clean)) {
            const rest = clean.replace(/^static\s+/, '');
            
            if (/^get\s+/.test(rest)) {
                const name = this.#extractName(rest)[1] || 'unknown';
                return this.#buildMethodResult(tokens, idx, maxIdx, name, 'getter', true, false);
            }
            if (/^set\s+/.test(rest)) {
                const name = this.#extractName(rest)[1] || 'unknown';
                return this.#buildMethodResult(tokens, idx, maxIdx, name, 'setter', true, false);
            }
            if (/^async\s+/.test(rest)) {
                const name = this.#extractName(rest)[1] || 'unknown';
                return this.#buildMethodResult(tokens, idx, maxIdx, name, 'static-method', true, true);
            }
            if (/^\w+\s*=/.test(rest)) {
                const name = this.#extractName(rest)[0];
                if (name && !this.#isControlFlow(name)) {
                    return this.#buildAssignmentResult(tokens, idx, maxIdx, name, true);
                }
            }
            if (/^\w+\s*\(/.test(rest)) {
                const name = this.#extractName(rest)[0];
                if (name && !this.#isControlFlow(name)) {
                    return this.#buildMethodResult(tokens, idx, maxIdx, name, 'static-method', true, false);
                }
            }
            return null;
        }
        
        // GETTER
        if (/^get\s+/.test(clean)) {
            const name = this.#extractName(clean)[1] || 'unknown';
            return this.#buildMethodResult(tokens, idx, maxIdx, name, 'getter', false, false);
        }
        
        // SETTER
        if (/^set\s+/.test(clean)) {
            const name = this.#extractName(clean)[1] || 'unknown';
            return this.#buildMethodResult(tokens, idx, maxIdx, name, 'setter', false, false);
        }
        
        // ASYNC METHOD
        if (/^async\s+/.test(clean)) {
            const rest = clean.replace(/^async\s+/, '');
            const name = this.#extractName(rest)[0];
            if (name && !this.#isControlFlow(name)) {
                return this.#buildMethodResult(tokens, idx, maxIdx, name, 'method', false, true);
            }
        }
        
        // THIS.X = ...
        if (/^this\.\w+\s*=/.test(clean)) {
            const match = clean.match(/^this\.(\w+)\s*=/);
            if (match) {
                const name = match[1];
                if (!this.#isControlFlow(name)) {
                    const afterEq = clean.substring(clean.indexOf('=') + 1).trim();
                    if (afterEq.startsWith('async') || afterEq.startsWith('function') || 
                        afterEq.startsWith('(') || afterEq.includes('=>')) {
                        return this.#buildMethodResult(tokens, idx, maxIdx, name, 'method', false, 
                            afterEq.startsWith('async'));
                    } else {
                        return this.#buildAssignmentResult(tokens, idx, maxIdx, name, false);
                    }
                }
            }
        }
        
        // REGULAR METHOD
        const nameMatch = clean.match(/^(\w+)\s*[=(]/);
        if (nameMatch) {
            const name = nameMatch[1];
            if (!this.#isControlFlow(name)) {
                if (clean.includes('(') && (clean.includes('{') || clean.includes('=>'))) {
                    return this.#buildMethodResult(tokens, idx, maxIdx, name, 'method', false, false);
                }
                if (clean.includes('=')) {
                    return this.#buildAssignmentResult(tokens, idx, maxIdx, name, false);
                }
            }
        }
        
        return null;
    }

    static #buildMethodResult(tokens, idx, maxIdx, name, type, isStatic, isAsync) {
        const lineNum = tokens[idx].lineNum;
        let bodyStart = idx;
        
        if (!tokens[idx].trimmed.includes('{')) {
            for (let j = idx; j < maxIdx; j++) {
                if (tokens[j].clean.includes('{')) {
                    bodyStart = j;
                    break;
                }
            }
        }
        
        let bodyEnd = idx;
        if (tokens[bodyStart].clean.includes('{')) {
            bodyEnd = this.#findBlockEnd(tokens, bodyStart, maxIdx);
        } else {
            bodyEnd = idx;
            for (let j = idx; j < maxIdx; j++) {
                if (tokens[j].trimmed.endsWith(';') || tokens[j].trimmed.endsWith('}')) {
                    bodyEnd = j;
                    break;
                }
            }
        }
        
        // Validate bodyEnd is within range
        bodyEnd = Math.min(bodyEnd, maxIdx);
        
        return {
            name,
            type,
            isStatic,
            isAsync,
            lineStart: lineNum,
            lineEnd: tokens[bodyEnd].lineNum,
            nextIdx: bodyEnd + 1,
            params: this.#parseParams(tokens[idx].trimmed)
        };
    }

    static #buildAssignmentResult(tokens, idx, maxIdx, name, isStatic) {
        const lineNum = tokens[idx].lineNum;
        let endIdx = idx;
        
        if (!tokens[idx].trimmed.endsWith(';') && !tokens[idx].trimmed.endsWith('}')) {
            for (let j = idx; j < maxIdx; j++) {
                const t = tokens[j].trimmed;
                if (t.endsWith(';') || t.endsWith('}') || t.endsWith(')') || t.endsWith(']')) {
                    endIdx = j;
                    break;
                }
                if (j > idx && tokens[j].trimmed && !tokens[j-1].trimmed.endsWith(',')) {
                    endIdx = j - 1;
                    break;
                }
            }
        }
        
        // Validate endIdx is within range
        endIdx = Math.min(endIdx, maxIdx);
        
        return {
            name,
            type: 'assignment',
            isStatic,
            isAsync: false,
            lineStart: lineNum,
            lineEnd: tokens[endIdx].lineNum,
            nextIdx: endIdx + 1,
            params: []
        };
    }

    static #parseConstructorAssignments(tokens, bodyStart, bodyEnd, classData) {
        for (let i = bodyStart; i < bodyEnd; i++) {
            const clean = tokens[i].trimmed;
            if (!clean) continue;
            
            const firstWord = clean.split(/\s+/)[0];
            if (this.#isControlFlow(firstWord)) continue;
            
            const match = clean.match(/^this\.(\w+)\s*=/);
            if (match) {
                const name = match[1];
                if (!this.#isControlFlow(name)) {
                    let end = i;
                    if (!clean.endsWith(';') && !clean.endsWith('}') && !clean.endsWith(')') && !clean.endsWith(']')) {
                        let depth = 0;
                        for (let j = i; j < bodyEnd; j++) {
                            const l = tokens[j].clean;
                            for (const ch of l) {
                                if (ch === '{' || ch === '(' || ch === '[') depth++;
                                else if (ch === '}' || ch === ')' || ch === ']') depth--;
                            }
                            if (depth <= 0 && (l.endsWith(';') || l.endsWith('}') || l.endsWith(')') || l.endsWith(']') || l.endsWith(','))) {
                                end = j;
                                break;
                            }
                        }
                    }
                    
                    // Validate end is within range
                    end = Math.min(end, bodyEnd - 1);
                    
                    const propData = {
                        name,
                        type: 'constructor-prop',
                        isStatic: false,
                        isAsync: false,
                        lineStart: tokens[i].lineNum,
                        lineEnd: tokens[end].lineNum,
                        params: []
                    };
                    propData.charCount = this.#calcCharCount(propData.lineStart, propData.lineEnd);
                    
                    classData.constructorProps.push(propData);
                    
                    i = end;
                }
            }
        }
    }

    static #parseParams(clean) {
        const start = clean.indexOf('(');
        if (start === -1) return [];
        
        let depth = 0;
        for (let i = start; i < clean.length; i++) {
            if (clean[i] === '(') depth++;
            else if (clean[i] === ')') {
                depth--;
                if (depth === 0) {
                    const params = clean.substring(start + 1, i);
                    if (!params.trim()) return [];
                    return params.split(',').map(p => {
                        const parts = p.trim().split('=');
                        const name = parts[0].trim().split(/\s+/).pop() || parts[0].trim();
                        return { name, defaultValue: parts[1]?.trim() || null };
                    }).filter(p => p.name);
                }
            }
        }
        return [];
    }

    static #parseFunction(tokens, startIdx) {
        const token = tokens[startIdx];
        let clean = token.trimmed;
        if (clean.startsWith('export ')) clean = clean.substring(7).trim();
        
        const match = clean.match(/(?:async\s+)?function\s+(\w+)\s*\(/);
        if (!match) return null;
        
        const funcData = {
            name: match[1],
            isAsync: clean.includes('async'),
            lineStart: token.lineNum,
            params: this.#parseParams(clean),
            jsdoc: null,
            blockEnd: startIdx
        };
        
        let blockStart = startIdx;
        if (!clean.includes('{')) {
            for (let i = startIdx; i < tokens.length; i++) {
                if (tokens[i].clean.includes('{')) {
                    blockStart = i;
                    break;
                }
            }
        }
        
        const blockEnd = this.#findBlockEnd(tokens, blockStart, tokens.length - 1);
        funcData.lineEnd = tokens[blockEnd].lineNum;
        funcData.blockEnd = blockEnd + 1;
        
        return funcData;
    }

    static #parseImport(statement) {
        const m1 = statement.match(/import\s+(\w+)\s+from\s+['"](.+?)['"]/);
        if (m1) return { type: 'default', name: m1[1], source: m1[2] };
        
        const m2 = statement.match(/import\s+\{\s*(.+?)\s*\}\s+from\s+['"](.+?)['"]/);
        if (m2) return { type: 'named', names: m2[1].split(',').map(n => n.trim()), source: m2[2] };
        
        const m3 = statement.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"](.+?)['"]/);
        if (m3) return { type: 'namespace', name: m3[1], source: m3[2] };
        
        return null;
    }

    static #parseJSDoc(jsdoc) {
        const tags = [];
        const lines = jsdoc.split('\n');
        for (const line of lines) {
            const m = line.match(/@(\w+)\s*(.*)/);
            if (m) tags.push({ tag: m[1], content: m[2].trim() });
        }
        return {
            tags,
            description: lines
                .filter(l => !l.includes('@') && !l.includes('/*') && !l.includes('*/'))
                .map(l => l.replace(/\s*\*\s?/, '').trim())
                .filter(Boolean)
                .join(' ')
        };
    }

    static getSummary() {
        if (!this.#parsedTree) return null;
        
        let totalMethods = 0;
        let totalMethodChars = 0;
        
        for (const cls of this.#parsedTree.classes) {
            const allItems = [
                ...(cls.methods || []),
                ...(cls.staticMethods || []),
                ...(cls.getters || []),
                ...(cls.setters || []),
                ...(cls.constructorProps || []),
                ...(cls.properties || []),
                ...(cls.assignments || []),
                ...(cls.constructor ? [cls.constructor] : [])
            ];
            totalMethods += allItems.length;
            for (const item of allItems) {
                totalMethodChars += (item.charCount || 0);
            }
        }
        
        let totalFunctionChars = 0;
        for (const func of this.#parsedTree.functions) {
            totalFunctionChars += (func.charCount || 0);
        }
        
        let totalImportChars = 0;
        for (const imp of this.#parsedTree.imports) {
            totalImportChars += (imp.charCount || 0);
        }
        
        let totalExportChars = 0;
        for (const exp of this.#parsedTree.exports) {
            totalExportChars += (exp.charCount || 0);
        }
        
        let totalVarChars = 0;
        for (const v of this.#parsedTree.variables) {
            totalVarChars += (v.charCount || 0);
        }
        
        let totalCommentChars = 0;
        for (const c of this.#parsedTree.comments) {
            totalCommentChars += (c.charCount || 0);
        }
        
        let totalJSDocChars = 0;
        for (const j of this.#parsedTree.jsdoc) {
            totalJSDocChars += (j.charCount || 0);
        }
        
        return {
            filePath: this.#parsedTree.filePath,
            totalLines: this.#parsedTree.raw.totalLines,
            totalChars: this.#parsedTree.raw.totalChars,
            imports: this.#parsedTree.imports.length,
            importsChars: totalImportChars,
            exports: this.#parsedTree.exports.length,
            exportsChars: totalExportChars,
            classes: this.#parsedTree.classes.length,
            functions: this.#parsedTree.functions.length,
            functionsChars: totalFunctionChars,
            variables: this.#parsedTree.variables.length,
            variablesChars: totalVarChars,
            comments: this.#parsedTree.comments.length,
            commentsChars: totalCommentChars,
            jsdoc: this.#parsedTree.jsdoc.length,
            jsdocChars: totalJSDocChars,
            totalMethods,
            totalMethodChars
        };
    }

    // Save and load selection state
    static saveSelection(selection, filePath) {
        fs.writeFileSync(filePath, JSON.stringify(selection, null, 2), 'utf8');
        return filePath;
    }

    static loadSelection(filePath) {
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
}

// CLI Interface
class CLIMenu {
    constructor() {
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        this.sel = {
            includeImports: false, includeExports: false,
            includeClasses: [], includeMethods: [],
            includeFunctions: [], includeVariables: false,
            includeAllComments: false, includeAllJSDoc: false
        };
        this.outputPath = null;
    }

    async start(filePath, options = {}) {
        console.clear();
        console.log('════════════ CODE PARSER v5.0 ════════════\n');
        try {
            CodeParser.parse(filePath);
            const s = CodeParser.getSummary();
            console.log(`File: ${path.basename(filePath)}`);
            console.log(`Stats: ${s.totalLines} lines | ${s.totalChars} chars | ${s.classes} classes | ${s.totalMethods} methods | ${s.functions} functions\n`);
            
            // Load selection if provided
            if (options.load) {
                const loaded = CodeParser.loadSelection(options.load);
                if (loaded) {
                    this.sel = { ...this.sel, ...loaded };
                    console.log(`Loaded selection: ${options.load}`);
                }
            }
            
            // Set output path if provided
            if (options.output) {
                this.outputPath = options.output;
            }
            
            // Auto-generate if requested
            if (options.auto) {
                await this.generateFile(true);
                return;
            }
            
            await this.menu();
        } catch (e) {
            console.error(`Error: ${e.message}`);
            console.error(e.stack);
            process.exit(1);
        }
    }

    async menu() {
        while (true) {
            console.log('\n─── MAIN MENU ───────────────────────────');
            console.log('1. Imports      2. Exports      3. Classes');
            console.log('4. Methods      5. Functions    6. Variables');
            console.log('7. Comments     8. Preview      9. Save File');
            console.log('S. Save State   L. Load State   0. Exit');
            console.log('──────────────────────────────────────────');
            const c = await this.ask('Choose option: ');
            switch (c.toLowerCase()) {
                case '1': await this.imports(); break;
                case '2': await this.exports(); break;
                case '3': await this.classes(); break;
                case '4': await this.methods(); break;
                case '5': await this.functions(); break;
                case '6': await this.variables(); break;
                case '7': await this.comments(); break;
                case '8': await this.preview(); break;
                case '9': await this.generateFile(false); break;
                case 's': await this.saveState(); break;
                case 'l': await this.loadState(); break;
                case '0': console.log('\nGoodbye!'); this.rl.close(); return;
                default: console.log('Invalid option');
            }
        }
    }

    async imports() {
        console.clear();
        const imps = CodeParser.getImports();
        console.log('─── IMPORTS ──────────────────────────────');
        if (imps.length === 0) {
            console.log('  No imports found');
        } else {
            imps.forEach((imp, i) => console.log(`  ${i+1}. ${imp.name || imp.names?.join(',')} from '${imp.source}' (${imp.charCount} chars)`));
            const total = imps.reduce((s, imp) => s + (imp.charCount||0), 0);
            console.log(`  Total: ${imps.length} imports, ${total} chars`);
        }
        console.log(`\nStatus: ${this.sel.includeImports ? 'INCLUDED' : 'EXCLUDED'}`);
        const c = await this.ask('Toggle inclusion? (y/n): ');
        if (c.toLowerCase() === 'y') this.sel.includeImports = !this.sel.includeImports;
    }

    async exports() {
        console.clear();
        const exps = CodeParser.getExports();
        console.log('─── EXPORTS ──────────────────────────────');
        if (exps.length === 0) {
            console.log('  No exports found');
        } else {
            exps.forEach((e, i) => console.log(`  ${i+1}. [${e.type}] ${e.statement.substring(0,60)} (${e.charCount} chars)`));
            const total = exps.reduce((s, e) => s + (e.charCount||0), 0);
            console.log(`  Total: ${exps.length} exports, ${total} chars`);
        }
        console.log(`\nStatus: ${this.sel.includeExports ? 'INCLUDED' : 'EXCLUDED'}`);
        const c = await this.ask('Toggle inclusion? (y/n): ');
        if (c.toLowerCase() === 'y') this.sel.includeExports = !this.sel.includeExports;
    }

    async classes() {
        let keepSelecting = true;
        while (keepSelecting) {
            console.clear();
            const cls = CodeParser.getClasses();
            console.log('─── CLASSES ──────────────────────────────');
            if (cls.length === 0) {
                console.log('  No classes found');
                await this.ask('\nPress Enter to continue...');
                return;
            }
            cls.forEach((c, i) => {
                const selected = this.sel.includeClasses.includes(c.name) ? '[x]' : '[ ]';
                const m = (c.methods?.length||0)+(c.staticMethods?.length||0)+(c.getters?.length||0)+
                         (c.setters?.length||0)+(c.constructorProps?.length||0)+(c.properties?.length||0)+
                         (c.assignments?.length||0)+(c.constructor?1:0);
                console.log(`  ${selected} ${i+1}. ${c.name} | ${m} members | ${c.charCount} chars`);
                if (c.extends) console.log(`      extends: ${c.extends}`);
                if (c.constructorProps?.length) console.log(`      constructor props: ${c.constructorProps.map(p=>`${p.name}(${p.charCount}c)`).join(', ')}`);
                if (c.assignments?.length) console.log(`      assignments: ${c.assignments.map(p=>`${p.name}(${p.charCount}c)`).join(', ')}`);
            });
            console.log('\nCommands: <number> = toggle | all = select all | none = deselect all | done = back');
            const c = await this.ask('> ');
            if (c === 'all') this.sel.includeClasses = cls.map(cl => cl.name);
            else if (c === 'none') this.sel.includeClasses = [];
            else if (c === 'done') keepSelecting = false;
            else {
                const idx = parseInt(c)-1;
                if (cls[idx]) {
                    const n = cls[idx].name;
                    if (this.sel.includeClasses.includes(n)) this.sel.includeClasses = this.sel.includeClasses.filter(x => x!==n);
                    else this.sel.includeClasses.push(n);
                }
            }
        }
    }

    async methods() {
        if (!this.sel.includeClasses.length) { 
            console.log('\nPlease select at least one class first (option 3)'); 
            await this.ask('Press Enter to continue...'); 
            return; 
        }
        let keepSelecting = true;
        while (keepSelecting) {
            console.clear();
            const mtds = CodeParser.getMethods({ includeClasses: this.sel.includeClasses });
            console.log('─── METHODS & MEMBERS ────────────────────');
            const grouped = {};
            mtds.forEach(m => { if (!grouped[m.className]) grouped[m.className] = []; grouped[m.className].push(m); });
            let cnt = 1;
            const list = [];
            for (const [cn, ms] of Object.entries(grouped)) {
                const classTotal = ms.reduce((s, m) => s + (m.charCount||0), 0);
                console.log(`\n  Class: ${cn} (${ms.length} members, ${classTotal} chars)`);
                ms.forEach(m => {
                    const selected = this.sel.includeMethods.includes(m.name) ? '[x]' : '[ ]';
                    let display;
                    switch (m.type) {
                        case 'constructor': display = `constructor() (${m.charCount}c)`; break;
                        case 'constructor-prop': display = `[ctor] this.${m.name} = ... (${m.charCount}c)`; break;
                        case 'assignment': display = `[assign] ${m.isStatic?'static ':''}${m.name} = ... (${m.charCount}c)`; break;
                        case 'property': display = `[prop] ${m.name} (${m.charCount}c)`; break;
                        case 'getter': display = `${m.isStatic?'static ':''}get ${m.name}() (${m.charCount}c)`; break;
                        case 'setter': display = `${m.isStatic?'static ':''}set ${m.name}() (${m.charCount}c)`; break;
                        default: display = `${m.isStatic?'static ':''}${m.isAsync?'async ':''}${m.name}() (${m.charCount}c)`; break;
                    }
                    console.log(`    ${selected} ${cnt}. ${display}`);
                    list.push(m);
                    cnt++;
                });
            }
            if (!list.length) { 
                console.log('\n  No members found'); 
                await this.ask('Press Enter to continue...'); 
                return; 
            }
            const totalChars = list.reduce((s, m) => s + (m.charCount||0), 0);
            console.log(`\n  Total: ${list.length} members, ${totalChars} chars`);
            console.log('Commands: <number> = toggle | all = select all | none = deselect all | done = back');
            const c = await this.ask('> ');
            if (c === 'all') this.sel.includeMethods = [...new Set(mtds.map(m=>m.name))];
            else if (c === 'none') this.sel.includeMethods = [];
            else if (c === 'done') keepSelecting = false;
            else {
                const idx = parseInt(c)-1;
                if (list[idx]) {
                    const n = list[idx].name;
                    if (this.sel.includeMethods.includes(n)) this.sel.includeMethods = this.sel.includeMethods.filter(x=>x!==n);
                    else this.sel.includeMethods.push(n);
                }
            }
        }
    }

    async functions() {
        let keepSelecting = true;
        while (keepSelecting) {
            console.clear();
            const fns = CodeParser.getFunctions();
            console.log('─── FUNCTIONS ────────────────────────────');
            if (fns.length === 0) {
                console.log('  No functions found');
                await this.ask('\nPress Enter to continue...');
                return;
            }
            fns.forEach((f, i) => {
                const selected = this.sel.includeFunctions.includes(f.name) ? '[x]' : '[ ]';
                console.log(`  ${selected} ${i+1}. ${f.isAsync?'async ':''}${f.name}(${f.params?.map(p=>p.name).join(',')||''}) | ${f.charCount} chars`);
            });
            const total = fns.reduce((s, f) => s + (f.charCount||0), 0);
            console.log(`  Total: ${fns.length} functions, ${total} chars`);
            console.log('Commands: <number> = toggle | all = select all | none = deselect all | done = back');
            const c = await this.ask('> ');
            if (c === 'all') this.sel.includeFunctions = fns.map(f=>f.name);
            else if (c === 'none') this.sel.includeFunctions = [];
            else if (c === 'done') keepSelecting = false;
            else {
                const idx = parseInt(c)-1;
                if (fns[idx]) {
                    const n = fns[idx].name;
                    if (this.sel.includeFunctions.includes(n)) this.sel.includeFunctions = this.sel.includeFunctions.filter(x=>x!==n);
                    else this.sel.includeFunctions.push(n);
                }
            }
        }
    }

    async variables() {
        console.clear();
        const vars = CodeParser.getVariables();
        console.log('─── VARIABLES ────────────────────────────');
        if (vars.length === 0) {
            console.log('  No variables found');
        } else {
            vars.forEach((v, i) => console.log(`  ${i+1}. [${v.kind}] ${v.declaration.substring(0,60)} (${v.charCount} chars)`));
            const total = vars.reduce((s, v) => s + (v.charCount||0), 0);
            console.log(`  Total: ${vars.length} variables, ${total} chars`);
        }
        console.log(`\nStatus: ${this.sel.includeVariables ? 'INCLUDED' : 'EXCLUDED'}`);
        const c = await this.ask('Toggle inclusion? (y/n): ');
        if (c.toLowerCase() === 'y') this.sel.includeVariables = !this.sel.includeVariables;
    }

    async comments() {
        console.clear();
        const cmts = CodeParser.getComments();
        const jsdocs = CodeParser.getJSDoc();
        const cmtChars = cmts.reduce((s, c) => s + (c.charCount||0), 0);
        const jsdChars = jsdocs.reduce((s, j) => s + (j.charCount||0), 0);
        console.log('─── COMMENTS & JSDOC ─────────────────────');
        console.log(`  1. All Comments: ${this.sel.includeAllComments ? 'INCLUDED' : 'EXCLUDED'} (${cmts.length} comments, ${cmtChars} chars)`);
        console.log(`  2. All JSDoc: ${this.sel.includeAllJSDoc ? 'INCLUDED' : 'EXCLUDED'} (${jsdocs.length} jsdocs, ${jsdChars} chars)`);
        const c = await this.ask('Toggle which? (1=Comments, 2=JSDoc, Enter=back): ');
        if (c === '1') this.sel.includeAllComments = !this.sel.includeAllComments;
        if (c === '2') this.sel.includeAllJSDoc = !this.sel.includeAllJSDoc;
    }

    async preview() {
        console.clear();
        console.log('─── CURRENT SELECTION ────────────────────');
        console.log(`Imports: ${this.sel.includeImports ? 'Yes' : 'No'} | Exports: ${this.sel.includeExports ? 'Yes' : 'No'} | Variables: ${this.sel.includeVariables ? 'Yes' : 'No'}`);
        console.log(`Classes: [${this.sel.includeClasses.join(', ') || 'none'}]`);
        console.log(`Methods: [${this.sel.includeMethods.join(', ') || 'none'}]`);
        console.log(`Functions: [${this.sel.includeFunctions.join(', ') || 'none'}]`);
        console.log(`Comments: ${this.sel.includeAllComments ? 'Yes' : 'No'} | JSDoc: ${this.sel.includeAllJSDoc ? 'Yes' : 'No'}`);
        
        const filtered = CodeParser.generateFiltered(this.sel);
        const nonEmptyLines = filtered.split('\n').filter(l => l.trim()).length;
        const totalLines = filtered.split('\n').length;
        console.log(`\n─── PREVIEW ──────────────────────────────`);
        console.log(`Output: ${nonEmptyLines} non-empty lines (${totalLines} total) | ${filtered.length} chars`);
        console.log('──────────────────────────────────────────');
        const previewLines = filtered.split('\n');
        const maxPreview = Math.min(15, previewLines.length);
        for (let i = 0; i < maxPreview; i++) {
            console.log(previewLines[i]);
        }
        if (previewLines.length > maxPreview) {
            console.log(`... and ${previewLines.length - maxPreview} more lines`);
        }
        console.log('──────────────────────────────────────────');
        await this.ask('Press Enter to continue...');
    }

    async generateFile(silent = false) {
        if (!silent) console.clear();
        const filtered = CodeParser.generateFiltered(this.sel);
        
        if (!filtered.trim()) {
            console.log('Warning: No content selected. Generated file would be empty.');
            const c = await this.ask('Continue anyway? (y/n): ');
            if (c.toLowerCase() !== 'y') return;
        }
        
        // Determine output path
        let outputPath = this.outputPath;
        if (!outputPath) {
            const tree = CodeParser.getTree();
            outputPath = tree.filePath.replace(/\.js$/, '.filtered.js');
            if (outputPath === tree.filePath) {
                outputPath = tree.filePath + '.filtered.js';
            }
        }
        
        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, filtered, 'utf8');
        const nonEmptyLines = filtered.split('\n').filter(l => l.trim()).length;
        const totalLines = filtered.split('\n').length;
        
        console.log('\n─── FILE SAVED ───────────────────────────');
        console.log(`Path: ${outputPath}`);
        console.log(`Stats: ${nonEmptyLines} non-empty lines (${totalLines} total) | ${filtered.length} chars`);
        console.log('──────────────────────────────────────────');
        
        if (!silent) {
            await this.ask('Press Enter to continue...');
        }
        
        return outputPath;
    }

    async saveState() {
        console.clear();
        console.log('─── SAVE SELECTION STATE ─────────────────');
        const defaultPath = CodeParser.getTree().filePath.replace(/\.js$/, '.selection.json');
        const c = await this.ask(`Save path [${defaultPath}]: `);
        const savePath = c.trim() || defaultPath;
        
        try {
            CodeParser.saveSelection(this.sel, savePath);
            console.log(`Selection saved to: ${savePath}`);
            console.log(`Contents: ${JSON.stringify(this.sel, null, 2)}`);
        } catch (e) {
            console.log(`Error saving: ${e.message}`);
        }
        await this.ask('Press Enter to continue...');
    }

    async loadState() {
        console.clear();
        console.log('─── LOAD SELECTION STATE ─────────────────');
        const defaultPath = CodeParser.getTree().filePath.replace(/\.js$/, '.selection.json');
        const c = await this.ask(`Load path [${defaultPath}]: `);
        const loadPath = c.trim() || defaultPath;
        
        try {
            const loaded = CodeParser.loadSelection(loadPath);
            if (loaded) {
                this.sel = { ...this.sel, ...loaded };
                console.log(`Selection loaded from: ${loadPath}`);
                console.log(`Contents: ${JSON.stringify(this.sel, null, 2)}`);
            } else {
                console.log(`File not found: ${loadPath}`);
            }
        } catch (e) {
            console.log(`Error loading: ${e.message}`);
        }
        await this.ask('Press Enter to continue...');
    }

    ask(q) { return new Promise(r => this.rl.question(q, r)); }
}

export default CodeParser;

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('════════════ CODE PARSER v5.0 ════════════');
        console.log('Usage:');
        console.log('  node CodeParser.js <file.js>');
        console.log('  node CodeParser.js <file.js> --output <out.js>');
        console.log('  node CodeParser.js <file.js> --load <state.json>');
        console.log('  node CodeParser.js <file.js> --auto --output <out.js>');
        console.log('  node CodeParser.js <file.js> --load <state.json> --auto --output <out.js>');
        console.log('\nOptions:');
        console.log('  --output <path>   Set output file path');
        console.log('  --load <path>     Load saved selection state');
        console.log('  --auto            Auto-generate and exit (no interactive menu)');
        process.exit(1);
    }
    
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }
    
    const options = {
        output: null,
        load: null,
        auto: false
    };
    
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--output' && i + 1 < args.length) {
            options.output = args[++i];
        } else if (args[i] === '--load' && i + 1 < args.length) {
            options.load = args[++i];
        } else if (args[i] === '--auto') {
            options.auto = true;
        }
    }
    
    const cli = new CLIMenu();
    cli.start(filePath, options).catch(console.error);
}