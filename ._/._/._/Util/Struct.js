import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import os from 'os';

// ============================================================
//  ANSI escape codes for terminal control
// ============================================================
const CLEAR_SCREEN = '\x1b[2J\x1b[H';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const REVERSE = '\x1b[7m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';

// ============================================================
//  Helper: clear screen and move cursor to top-left
// ============================================================
function clearScreen() {
    process.stdout.write(CLEAR_SCREEN);
}

// ============================================================
//  Read directory contents (async)
// ============================================================
async function readDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    // Sort: directories first, then alphabetically
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });
    return entries;
}

// ============================================================
//  Generate struct file from a list of absolute paths
// ============================================================
async function generateStruct(filePaths, outputFileName = 'struct') {
    let structContent = '';
    for (const filePath of filePaths) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            structContent += `${'='.repeat(50)}\n`;
            structContent += `FILE: ${filePath}\n`;
            structContent += `${'='.repeat(50)}\n`;
            structContent += content;
            // Ensure a newline after each file content for separation
            if (!content.endsWith('\n')) structContent += '\n';
            structContent += '\n'; // extra blank line between files
        } catch (err) {
            console.error(`\nError reading ${filePath}: ${err.message}`);
            // Continue with other files
        }
    }
    await fs.writeFile(outputFileName, structContent, 'utf8');
    console.log(`\nStruct file written to: ${path.resolve(outputFileName)}`);
}

// ============================================================
//  Save absolute paths to a file (one per line) in /tmp
// ============================================================
async function savePaths(filePaths, saveName) {
    const tmpDir = os.tmpdir();
    const savePath = path.join(tmpDir, saveName);
    await fs.writeFile(savePath, filePaths.join('\n'), 'utf8');
    console.log(`Paths saved to: ${savePath}`);
    return savePath;
}

// ============================================================
//  Load absolute paths from a savename file in /tmp
// ============================================================
async function loadPaths(saveName) {
    const tmpDir = os.tmpdir();
    const savePath = path.join(tmpDir, saveName);
    const data = await fs.readFile(savePath, 'utf8');
    return data.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

// ============================================================
//  Interactive file/directory navigation & selection
// ============================================================
async function interactiveMode() {
    // Save original terminal settings
    const originalRawMode = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let currentDir = process.cwd();
    let entries = await readDirectory(currentDir);
    let cursorIndex = 0;
    const selectedFiles = new Set(); // store absolute paths of selected files

    const render = () => {
        clearScreen();
        console.log(`${BOLD}${BLUE}Current directory:${RESET} ${YELLOW}${currentDir}${RESET}`);
        console.log(`${BOLD}Selected: ${selectedFiles.size} file(s)${RESET}`);
        console.log('─'.repeat(process.stdout.columns || 80));
        console.log(`${BOLD}Navigation:${RESET} ↑/↓ move, Enter open dir/select file, Space select file, g generate, b back, q quit`);
        console.log('─'.repeat(process.stdout.columns || 80));

        entries.forEach((entry, idx) => {
            let prefix = ' ';
            if (entry.isDirectory()) {
                prefix = `${BLUE}[DIR]${RESET} `;
            } else if (selectedFiles.has(path.join(currentDir, entry.name))) {
                prefix = `${GREEN}[✔]${RESET} `;
            } else {
                prefix = '[ ] ';
            }
            const line = `${prefix} ${entry.name}${entry.isDirectory() ? '/' : ''}`;
            if (idx === cursorIndex) {
                console.log(`${REVERSE}${line}${RESET}`);
            } else {
                console.log(line);
            }
        });
    };

    // Main keypress handler
    const onKeypress = async (key) => {
        // Arrow keys (escape sequences)
        if (key === '\u001b[A') { // up
            if (cursorIndex > 0) cursorIndex--;
            render();
            return;
        }
        if (key === '\u001b[B') { // down
            if (cursorIndex < entries.length - 1) cursorIndex++;
            render();
            return;
        }

        // Space: toggle selection (only for files)
        if (key === ' ') {
            if (entries.length > 0 && cursorIndex >= 0 && cursorIndex < entries.length) {
                const entry = entries[cursorIndex];
                if (!entry.isDirectory()) {
                    const fullPath = path.join(currentDir, entry.name);
                    if (selectedFiles.has(fullPath)) {
                        selectedFiles.delete(fullPath);
                    } else {
                        selectedFiles.add(fullPath);
                    }
                }
            }
            render();
            return;
        }

        // Enter: navigate into directory or toggle selection for files
        if (key === '\r' || key === '\n') {
            if (entries.length > 0 && cursorIndex >= 0 && cursorIndex < entries.length) {
                const entry = entries[cursorIndex];
                if (entry.isDirectory()) {
                    currentDir = path.join(currentDir, entry.name);
                    entries = await readDirectory(currentDir);
                    cursorIndex = 0;
                } else {
                    // Toggle file selection with Enter
                    const fullPath = path.join(currentDir, entry.name);
                    if (selectedFiles.has(fullPath)) {
                        selectedFiles.delete(fullPath);
                    } else {
                        selectedFiles.add(fullPath);
                    }
                }
            }
            render();
            return;
        }

        // 'g' or 'G': generate struct from selected files
        if (key === 'g' || key === 'G') {
            if (selectedFiles.size === 0) {
                console.log('\nNo files selected.');
                render();
                return;
            }
            // Generate struct file in current working directory
            await generateStruct([...selectedFiles]);
            // Ask to save paths
            process.stdin.setRawMode(false); // temporarily disable raw mode for input
            console.log('\nSave selected file paths? Enter a filename (or leave empty to skip): ');
            const saveName = await new Promise(resolve => {
                process.stdin.once('data', data => {
                    resolve(data.toString().trim());
                });
            });
            process.stdin.setRawMode(true);
            if (saveName) {
                await savePaths([...selectedFiles], saveName);
            }
            // Exit interactive mode
            cleanupAndExit(0);
            return;
        }

        // 'b' or 'B': go to parent directory
        if (key === 'b' || key === 'B') {
            const parent = path.dirname(currentDir);
            if (parent !== currentDir) { // not at root
                currentDir = parent;
                entries = await readDirectory(currentDir);
                cursorIndex = 0;
            }
            render();
            return;
        }

        // 'q' or 'Q': quit without generating
        if (key === 'q' || key === 'Q' || key === '\u0003') { // Ctrl+C also quits
            cleanupAndExit(0);
            return;
        }

        // Any other key: ignore
    };

    // Cleanup function to restore terminal and exit
    const cleanupAndExit = (code) => {
        process.stdin.setRawMode(originalRawMode);
        process.stdin.pause();
        process.exit(code);
    };

    process.stdin.on('data', onKeypress);
    render();
}

// ============================================================
//  Main entry point
// ============================================================
async function main() {
    const args = process.argv.slice(2);

    if (args.length > 0) {
        // Regeneration mode: load saved paths from /tmp and generate struct
        const saveName = args[0];
        try {
            const paths = await loadPaths(saveName);
            if (paths.length === 0) {
                console.error('No paths found in save file.');
                process.exit(1);
            }
            await generateStruct(paths);
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    } else {
        // Interactive mode
        await interactiveMode();
    }
}

// Run the main function
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
