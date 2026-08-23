#!/usr/bin/env node

/**
 * GitView - Comprehensive Git Repository Visualization and Analysis Tool
 */

import { spawnSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import { parse as parseUrl } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CACHE MANAGER
// ============================================================================

class CacheManager {
    constructor() {
        this.cacheDir = path.join('/tmp', 'gitview-cache');
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    getCachePath(repoPath) {
        const hash = crypto.createHash('sha1').update(path.resolve(repoPath)).digest('hex');
        return path.join(this.cacheDir, `${hash}.json`);
    }

    load(repoPath) {
        const cachePath = this.getCachePath(repoPath);
        try {
            if (fs.existsSync(cachePath)) {
                const raw = fs.readFileSync(cachePath, 'utf8');
                return JSON.parse(raw);
            }
        } catch (error) {
            console.error(`Failed to load cache for ${repoPath}: ${error.message}`);
        }
        return null;
    }

    save(repoPath, data) {
        const cachePath = this.getCachePath(repoPath);
        try {
            fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error(`Failed to save cache for ${repoPath}: ${error.message}`);
        }
    }
}

// ============================================================================
// COMMAND LINE ARGUMENT PARSER
// ============================================================================

class ArgumentParser {
    constructor() {
        this.args = {
            html: false,
            server: false,
            help: false,
            port: 8080,
            repoPath: process.cwd(),
            dir: false
        };
        this.parse();
    }

    parse() {
        const args = process.argv.slice(2);
        
        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--html':
                    this.args.html = true;
                    break;
                case '--server':
                    this.args.server = true;
                    break;
                case '--help':
                case '-h':
                    this.args.help = true;
                    break;
                case '--port':
                case '-p':
                    if (i + 1 < args.length) {
                        this.args.port = parseInt(args[i + 1]);
                        i++;
                    }
                    break;
                case '--repo':
                case '-r':
                    if (i + 1 < args.length) {
                        this.args.repoPath = args[i + 1];
                        i++;
                    }
                    break;
                case '--dir':
                    this.args.dir = true;
                    break;
            }
        }

        if (!this.args.html && !this.args.help) {
            this.args.server = true;
        }
    }

    showHelp() {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    GitView - Git Repository Viewer            ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
    node gitview.js [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --html                  Generate static HTML file
    --server                Start web server
    --port, -p <number>     Specify port (default: 8080)
    --repo, -r <path>       Specify repository path
    --dir                   Analyze all repositories inside a directory

EXAMPLES:
    node gitview.js                    # Start server on current repo
    node gitview.js --html             # Generate gitview.html only
    node gitview.js --port 3000        # Start server on port 3000
    node gitview.js --dir /path/to/repos   # Analyze all repos in directory
        `);
    }
}

// ============================================================================
// GITVIEW CORE INTERFACE
// ============================================================================

class GitView {
    constructor(repoPath = process.cwd(), progressCallback = null) {
        this.repoPath = repoPath;
        this.progressCallback = progressCallback;
        this.findGitRoot();
        this.validateRepo();
    }

    findGitRoot() {
        let currentDir = path.resolve(this.repoPath);
        
        while (currentDir !== path.dirname(currentDir)) {
            if (fs.existsSync(path.join(currentDir, '.git'))) {
                this.repoPath = currentDir;
                this.gitDir = path.join(currentDir, '.git');
                return;
            }
            currentDir = path.dirname(currentDir);
        }
        
        throw new Error(`No .git directory found in ${this.repoPath} or any parent directory`);
    }

    validateRepo() {
        try {
            this.executeGit(['rev-parse', '--git-dir']);
        } catch (error) {
            throw new Error(`Not a valid git repository: ${this.repoPath}`);
        }
    }

    executeGit(args) {
        try {
            const result = spawnSync('git', args, {
                cwd: this.repoPath,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 100
            });
            
            if (result.error) throw result.error;
            if (result.status !== 0) throw new Error(result.stderr);
            
            return result.stdout.trim();
        } catch (error) {
            throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
        }
    }

    executeGitOptional(args) {
        try {
            return this.executeGit(args);
        } catch (error) {
            return '';
        }
    }

    updateProgress(stage, percent, message) {
        if (this.progressCallback) {
            this.progressCallback(stage, percent, message);
        }
    }

    getRepositoryInfo() {
        this.updateProgress('basic', 5, 'Fetching repository info...');
        
        const remoteUrl = this.executeGitOptional(['config', '--get', 'remote.origin.url']);
        const currentBranch = this.executeGitOptional(['rev-parse', '--abbrev-ref', 'HEAD']);
        
        return {
            name: path.basename(this.repoPath),
            path: this.repoPath,
            gitDir: this.gitDir,
            remoteUrl: remoteUrl,
            defaultBranch: currentBranch || 'main',
            currentBranch: currentBranch,
            isBare: this.executeGit(['rev-parse', '--is-bare-repository']) === 'true',
            isShallow: this.executeGit(['rev-parse', '--is-shallow-repository']) === 'true',
            gitVersion: this.executeGit(['--version']).replace('git version ', ''),
            description: this.executeGitOptional(['config', '--get', 'core.description']) || ''
        };
    }

    getBranches() {
        this.updateProgress('branches', 15, 'Analyzing branches...');
        
        const branches = [];
        const localBranches = this.executeGitOptional(['branch', '-vv', '--no-color']).split('\n').filter(Boolean);
        
        for (const branch of localBranches) {
            const match = branch.match(/^[*\s]\s+(\S+)\s+([a-f0-9]+)\s*(.*)$/);
            if (match) {
                branches.push({
                    name: match[1],
                    hash: match[2],
                    isCurrent: branch.startsWith('*'),
                    tracking: match[3] || '',
                    type: 'local'
                });
            }
        }

        const remoteBranches = this.executeGitOptional(['branch', '-r']).split('\n').filter(Boolean);
        for (const branch of remoteBranches) {
            const name = branch.trim();
            if (name && !name.includes('HEAD ->')) {
                branches.push({
                    name: name,
                    hash: this.executeGitOptional(['rev-parse', name]),
                    isCurrent: false,
                    tracking: '',
                    type: 'remote'
                });
            }
        }

        return branches;
    }

    getTags() {
        this.updateProgress('tags', 20, 'Fetching tags...');
        
        const tags = this.executeGitOptional(['tag', '-l']).split('\n').filter(Boolean);
        const tagDetails = [];

        for (const tag of tags) {
            const tagInfo = this.executeGitOptional(['log', '-1', '--format=%H|%an|%ai|%s', tag]);
            const [hash, author, date, message] = tagInfo.split('|');
            
            tagDetails.push({
                name: tag,
                hash: hash || '',
                shortHash: hash ? hash.substring(0, 7) : '',
                author: author || '',
                date: date || '',
                message: message || ''
            });
        }

        return tagDetails;
    }

    getCommitHistory(limit = 500, skip = 0) {
        this.updateProgress('commits', 30, 'Analyzing commit history...');
        
        const format = '%H|%h|%an|%ae|%ai|%s';
        const args = ['log', '--all', `--format=${format}`, `--skip=${skip}`, `-${limit}`];
        
        const output = this.executeGitOptional(args);
        if (!output) return [];

        const commits = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;
            
            const parts = line.split('|');
            if (parts.length < 6) continue;

            const hash = parts[0];
            commits.push({
                hash: hash,
                shortHash: parts[1],
                author: parts[2],
                email: parts[3],
                authorDate: parts[4],
                subject: parts[5],
                stats: this.getCommitStats(hash)
            });
        }

        return commits;
    }

    getCommitStats(hash) {
        const stats = this.executeGitOptional(['show', '--stat', '--format=', hash]);
        if (!stats) return null;

        const lines = stats.split('\n').filter(Boolean);
        const summary = lines[lines.length - 1];
        
        const match = summary.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        
        return {
            filesChanged: match ? parseInt(match[1]) : 0,
            insertions: match && match[2] ? parseInt(match[2]) : 0,
            deletions: match && match[3] ? parseInt(match[3]) : 0
        };
    }

    getAuthors() {
        this.updateProgress('authors', 50, 'Analyzing contributors...');
        
        const authors = [];
        const output = this.executeGitOptional(['log', '--all', '--format=%an|%ae']);
        
        if (!output) return authors;

        const authorMap = new Map();
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;
            const [name, email] = line.split('|');
            const key = `${name}|${email}`;
            
            if (!authorMap.has(key)) {
                authorMap.set(key, {
                    name,
                    email,
                    commits: 0,
                    insertions: 0,
                    deletions: 0,
                    firstCommit: null,
                    lastCommit: null
                });
            }
            
            authorMap.get(key).commits++;
        }

        for (const [key, author] of authorMap) {
            const [name] = key.split('|');
            const dates = this.executeGitOptional(['log', '--all', `--author=${name}`, '--format=%ai']);
            
            if (dates) {
                const dateLines = dates.split('\n').filter(Boolean);
                author.firstCommit = dateLines[dateLines.length - 1];
                author.lastCommit = dateLines[0];
            }
            
            const lineStats = this.executeGitOptional(['log', '--all', `--author=${name}`, '--pretty=tformat:', '--numstat']);
            if (lineStats) {
                for (const line of lineStats.split('\n')) {
                    const parts = line.split('\t');
                    if (parts.length >= 3) {
                        const [add, del] = parts;
                        if (add !== '-' && del !== '-') {
                            author.insertions += parseInt(add) || 0;
                            author.deletions += parseInt(del) || 0;
                        }
                    }
                }
            }
        }

        return Array.from(authorMap.values());
    }

    getCommitsByTime() {
        this.updateProgress('time', 65, 'Analyzing temporal patterns...');
        
        const format = '%H|%ai|%an|%s';
        const output = this.executeGitOptional(['log', '--all', `--format=${format}`]);
        
        if (!output) return {};

        const timeData = {};
        const lines = output.split('\n').filter(Boolean);

        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 4) continue;
            
            const [hash, date, author, subject] = parts;
            const dateParts = date.split('-');
            if (dateParts.length < 2) continue;
            
            const yearMonth = `${dateParts[0]}-${dateParts[1]}`;
            
            if (!timeData[yearMonth]) {
                timeData[yearMonth] = {
                    year: parseInt(dateParts[0]),
                    month: parseInt(dateParts[1]),
                    commits: [],
                    commitCount: 0,
                    insertions: 0,
                    deletions: 0,
                    authors: new Set()
                };
            }

            const stats = this.getCommitStats(hash);
            timeData[yearMonth].commits.push({ hash, date, author, subject, stats });
            timeData[yearMonth].commitCount++;
            timeData[yearMonth].authors.add(author);
            
            if (stats) {
                timeData[yearMonth].insertions += stats.insertions;
                timeData[yearMonth].deletions += stats.deletions;
            }
        }

        for (const key in timeData) {
            timeData[key].authors = Array.from(timeData[key].authors);
            timeData[key].authorsCount = timeData[key].authors.length;
        }

        return timeData;
    }

    getYearlySummary() {
        this.updateProgress('yearly', 75, 'Creating yearly summary...');
        
        const monthlyData = this.getCommitsByTime();
        const yearly = {};

        for (const [key, data] of Object.entries(monthlyData)) {
            const year = key.split('-')[0];
            
            if (!yearly[year]) {
                yearly[year] = {
                    year: parseInt(year),
                    commitCount: 0,
                    insertions: 0,
                    deletions: 0,
                    authors: new Set(),
                    months: {}
                };
            }

            yearly[year].commitCount += data.commitCount;
            yearly[year].insertions += data.insertions;
            yearly[year].deletions += data.deletions;
            data.authors.forEach(a => yearly[year].authors.add(a));
            yearly[year].months[key] = data;
        }

        for (const year in yearly) {
            yearly[year].authors = Array.from(yearly[year].authors);
            yearly[year].authorsCount = yearly[year].authors.length;
        }

        return yearly;
    }

    getFileStats() {
        this.updateProgress('files', 85, 'Analyzing file statistics...');
        
        const output = this.executeGitOptional(['log', '--all', '--pretty=format:', '--numstat']);
        if (!output) return [];

        const fileMap = new Map();
        const lines = output.split('\n').filter(Boolean);

        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length < 3) continue;
            
            const [additions, deletions, file] = parts;
            if (additions === '-' || deletions === '-') continue;
            
            if (!fileMap.has(file)) {
                fileMap.set(file, {
                    path: file,
                    commits: 0,
                    insertions: 0,
                    deletions: 0
                });
            }
            
            const fileData = fileMap.get(file);
            fileData.commits++;
            fileData.insertions += parseInt(additions) || 0;
            fileData.deletions += parseInt(deletions) || 0;
        }

        return Array.from(fileMap.values()).sort((a, b) => b.commits - a.commits);
    }

    getRepositoryHealth() {
        this.updateProgress('health', 90, 'Calculating repository health...');
        
        const totalCommits = parseInt(this.executeGitOptional(['rev-list', '--all', '--count']) || '0');
        
        return {
            totalCommits,
            totalBranches: this.getBranches().length,
            totalTags: this.getTags().length,
            totalFiles: this.executeGitOptional(['ls-files']).split('\n').filter(Boolean).length,
            repoSize: this.getRepoSize(),
            contributors: this.getAuthors().length,
            lastActivity: this.executeGitOptional(['log', '-1', '--format=%ai']),
            firstCommit: this.executeGitOptional(['log', '--reverse', '--format=%ai']).split('\n')[0],
            daysActive: this.calculateDaysActive()
        };
    }

    getRepoSize() {
        let totalSize = 0;
        
        try {
            const walkDir = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        walkDir(filePath);
                    } else {
                        totalSize += stat.size;
                    }
                }
            };
            
            walkDir(this.gitDir);
        } catch (error) {
            return 'N/A';
        }
        
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = totalSize;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    calculateDaysActive() {
        const firstCommit = this.executeGitOptional(['log', '--reverse', '--format=%ai']).split('\n')[0];
        const lastCommit = this.executeGitOptional(['log', '-1', '--format=%ai']);
        
        if (firstCommit && lastCommit) {
            const first = new Date(firstCommit);
            const last = new Date(lastCommit);
            return Math.ceil((last - first) / (1000 * 60 * 60 * 24));
        }
        
        return 0;
    }

    getAllData() {
        return {
            repository: this.getRepositoryInfo(),
            branches: this.getBranches(),
            tags: this.getTags(),
            commits: this.getCommitHistory(500),
            authors: this.getAuthors(),
            commitsByMonth: this.getCommitsByTime(),
            yearlySummary: this.getYearlySummary(),
            fileStats: this.getFileStats(),
            health: this.getRepositoryHealth()
        };
    }
}

// ============================================================================
// LOADING PAGE GENERATOR
// ============================================================================

class LoadingPageGenerator {
    static generateLoadingHTML(repoName) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading GitView - ${repoName}</title>
    <style>
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --accent: #58a6ff;
            --success: #3fb950;
            --border: #30363d;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .loading-container {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
        }

        .loading-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .loading-header h1 {
            color: var(--accent);
            font-size: 28px;
            margin-bottom: 10px;
        }

        .loading-header p {
            color: var(--text-secondary);
            font-size: 14px;
        }

        .progress-bar-container {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            height: 20px;
            overflow: hidden;
            margin-bottom: 20px;
        }

        .progress-bar {
            background: linear-gradient(90deg, var(--accent), #79c0ff);
            height: 100%;
            width: 0%;
            transition: width 0.5s ease;
            border-radius: 8px;
            position: relative;
        }

        .progress-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .progress-text {
            text-align: center;
            margin-bottom: 20px;
        }

        .progress-percentage {
            font-size: 36px;
            font-weight: bold;
            color: var(--accent);
        }

        .progress-message {
            color: var(--text-secondary);
            font-size: 14px;
            margin-top: 5px;
        }

        .stage-list {
            list-style: none;
            margin-top: 20px;
        }

        .stage-item {
            display: flex;
            align-items: center;
            padding: 8px;
            margin-bottom: 5px;
            border-radius: 6px;
            transition: all 0.3s;
        }

        .stage-item.active {
            background: var(--bg-tertiary);
        }

        .stage-item.completed {
            opacity: 0.7;
        }

        .stage-icon {
            margin-right: 10px;
            font-size: 18px;
            width: 24px;
            text-align: center;
        }

        .stage-name {
            flex: 1;
            font-size: 14px;
        }

        .stage-status {
            font-size: 12px;
            color: var(--text-secondary);
        }

        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--accent);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="loading-header">
            <h1>🚀 GitView</h1>
            <p>Analyzing ${repoName}</p>
        </div>

        <div class="progress-bar-container">
            <div class="progress-bar" id="progressBar"></div>
        </div>

        <div class="progress-text">
            <div class="progress-percentage" id="progressPercentage">0%</div>
            <div class="progress-message" id="progressMessage">Starting analysis...</div>
        </div>

        <ul class="stage-list" id="stageList">
            <li class="stage-item active" id="stage-basic">
                <span class="stage-icon">📋</span>
                <span class="stage-name">Repository Info</span>
                <span class="stage-status"><span class="spinner"></span></span>
            </li>
            <li class="stage-item" id="stage-branches">
                <span class="stage-icon">🌿</span>
                <span class="stage-name">Branches</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-tags">
                <span class="stage-icon">🏷️</span>
                <span class="stage-name">Tags</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-commits">
                <span class="stage-icon">📝</span>
                <span class="stage-name">Commits</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-authors">
                <span class="stage-icon">👥</span>
                <span class="stage-name">Contributors</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-time">
                <span class="stage-icon">📊</span>
                <span class="stage-name">Temporal Analysis</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-yearly">
                <span class="stage-icon">📈</span>
                <span class="stage-name">Yearly Summary</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-files">
                <span class="stage-icon">📁</span>
                <span class="stage-name">File Statistics</span>
                <span class="stage-status">Waiting...</span>
            </li>
            <li class="stage-item" id="stage-health">
                <span class="stage-icon">💪</span>
                <span class="stage-name">Repository Health</span>
                <span class="stage-status">Waiting...</span>
            </li>
        </ul>
    </div>

    <script>
        const stages = ['basic', 'branches', 'tags', 'commits', 'authors', 'time', 'yearly', 'files', 'health'];
        let currentStage = 0;

        function updateProgress(stage, percent, message) {
            const progressBar = document.getElementById('progressBar');
            const progressPercentage = document.getElementById('progressPercentage');
            const progressMessage = document.getElementById('progressMessage');
            
            progressBar.style.width = percent + '%';
            progressPercentage.textContent = percent + '%';
            progressMessage.textContent = message;

            const stageIndex = stages.indexOf(stage);
            if (stageIndex > -1) {
                for (let i = 0; i < stages.length; i++) {
                    const stageElement = document.getElementById('stage-' + stages[i]);
                    if (i < stageIndex) {
                        stageElement.classList.remove('active');
                        stageElement.classList.add('completed');
                        stageElement.querySelector('.stage-status').textContent = '✅';
                    } else if (i === stageIndex) {
                        stageElement.classList.add('active');
                        stageElement.querySelector('.stage-status').innerHTML = '<span class="spinner"></span>';
                    }
                }
            }

            if (percent >= 100) {
                progressMessage.textContent = 'Analysis complete! Loading view...';
            }
        }

        // Poll for progress updates
        function pollProgress() {
            fetch('/api/progress')
                .then(response => response.json())
                .then(data => {
                    updateProgress(data.stage, data.percent, data.message);
                    if (data.percent < 100) {
                        setTimeout(pollProgress, 500);
                    } else {
                        setTimeout(() => {
                            window.location.href = '/view';
                        }, 1000);
                    }
                })
                .catch(error => {
                    console.error('Error fetching progress:', error);
                    setTimeout(pollProgress, 1000);
                });
        }

        // Start polling
        pollProgress();
    </script>
</body>
</html>`;
    }
}

// ============================================================================
// HTML TEMPLATE GENERATOR
// ============================================================================

class HTMLGenerator {
    static generateHTML(data, options = {}) {
        const { repoList = [], currentIndex = 0 } = options;
        const hasMultiple = repoList.length > 1;
        const monthlyData = data.commitsByMonth;
        const yearlyData = data.yearlySummary;
        const maxMonthlyCommits = Math.max(...Object.values(monthlyData).map(d => d.commitCount), 1);
        const maxYearlyCommits = Math.max(...Object.values(yearlyData).map(d => d.commitCount), 1);
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitView - ${data.repository.name}</title>
    <style>
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --accent: #58a6ff;
            --success: #3fb950;
            --warning: #d29922;
            --danger: #f85149;
            --border: #30363d;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .header h1 {
            color: var(--accent);
            margin-bottom: 10px;
        }

        .repo-selector {
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .repo-selector label {
            color: var(--text-secondary);
        }

        .repo-selector select {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
        }

        .repo-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .info-card {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 15px;
        }

        .info-card h3 {
            color: var(--accent);
            margin-bottom: 8px;
            font-size: 14px;
        }

        .info-card p {
            color: var(--text-secondary);
            font-size: 13px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            transition: transform 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: var(--accent);
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 14px;
            margin-top: 5px;
        }

        .chart-container {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .chart-title {
            color: var(--accent);
            font-size: 18px;
            font-weight: bold;
        }

        .view-toggle {
            display: flex;
            gap: 10px;
        }

        .toggle-btn {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .toggle-btn:hover {
            background: var(--accent);
            color: var(--bg-primary);
        }

        .toggle-btn.active {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
        }

        .chart {
            position: relative;
            overflow: hidden;
        }

        .chart-bars {
            display: flex;
            align-items: flex-end;
            height: 300px;
            gap: 2px;
            padding: 10px;
            position: relative;
        }

        .chart-bar {
            flex: 1;
            background: linear-gradient(180deg, var(--accent) 0%, #1f6feb 100%);
            border-radius: 4px 4px 0 0;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            min-width: 20px;
        }

        .chart-bar:hover {
            background: linear-gradient(180deg, #79c0ff 0%, #58a6ff 100%);
            transform: scaleY(1.05);
            transform-origin: bottom;
        }

        .chart-bar-label {
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            color: var(--text-secondary);
            white-space: nowrap;
        }

        .chart-bar-value {
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 11px;
            color: var(--text-primary);
            font-weight: bold;
        }

        .tooltip {
            position: absolute;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 12px;
            pointer-events: none;
            z-index: 1000;
            display: none;
            min-width: 200px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .tooltip.visible {
            display: block;
        }

        .tooltip h4 {
            color: var(--accent);
            margin-bottom: 8px;
        }

        .tooltip p {
            font-size: 12px;
            margin: 4px 0;
            color: var(--text-secondary);
        }

        .commits-list {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }

        .commit-item {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 10px;
            transition: all 0.3s;
        }

        .commit-item:hover {
            border-color: var(--accent);
            transform: translateX(5px);
        }

        .commit-hash {
            color: var(--accent);
            font-family: monospace;
            font-size: 12px;
        }

        .commit-message {
            margin: 8px 0;
            font-size: 14px;
        }

        .commit-meta {
            color: var(--text-secondary);
            font-size: 12px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }

        .author-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }

        .author-card {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 15px;
        }

        .author-name {
            color: var(--accent);
            font-weight: bold;
        }

        .author-stats {
            color: var(--text-secondary);
            font-size: 12px;
            margin-top: 5px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
            animation: fadeIn 0.5s ease-out;
        }

        @media (max-width: 768px) {
            .chart-bars {
                height: 200px;
            }
            
            .repo-info {
                grid-template-columns: 1fr;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${hasMultiple ? `
        <div class="repo-selector fade-in">
            <label for="repoSelect">📁 Repository:</label>
            <select id="repoSelect" onchange="switchRepo(this.value)">
                ${repoList.map((repo, i) => `<option value="${i}" ${i === currentIndex ? 'selected' : ''}>${repo.name}</option>`).join('')}
            </select>
        </div>
        <script>
            function switchRepo(index) {
                window.location.href = '/view?repo=' + index;
            }
        </script>
        ` : ''}

        <div class="header fade-in">
            <h1>🚀 GitView - ${data.repository.name}</h1>
            <p style="color: var(--text-secondary);">
                ${data.repository.description || 'Git Repository Visualization'}
            </p>
            
            <div class="repo-info">
                <div class="info-card">
                    <h3>📍 Repository</h3>
                    <p>${data.repository.path}</p>
                    <p>Remote: ${data.repository.remoteUrl || 'No remote'}</p>
                </div>
                <div class="info-card">
                    <h3>🌿 Current Branch</h3>
                    <p>${data.repository.currentBranch}</p>
                    <p>Default: ${data.repository.defaultBranch}</p>
                </div>
                <div class="info-card">
                    <h3>📊 Statistics</h3>
                    <p>Commits: ${data.health.totalCommits}</p>
                    <p>Active Days: ${data.health.daysActive}</p>
                </div>
            </div>
        </div>

        <div class="stats-grid fade-in">
            <div class="stat-card">
                <div class="stat-value">${data.health.totalCommits}</div>
                <div class="stat-label">Total Commits</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.authors.length}</div>
                <div class="stat-label">Contributors</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.branches.length}</div>
                <div class="stat-label">Branches</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.tags.length}</div>
                <div class="stat-label">Tags</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.health.totalFiles}</div>
                <div class="stat-label">Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.health.repoSize}</div>
                <div class="stat-label">Repo Size</div>
            </div>
        </div>

        <div class="chart-container fade-in">
            <div class="chart-header">
                <h2 class="chart-title">📈 Commit Activity</h2>
                <div class="view-toggle">
                    <button class="toggle-btn active" onclick="switchView('month')">Monthly</button>
                    ${Object.keys(yearlyData).length > 1 ? '<button class="toggle-btn" onclick="switchView(\'year\')">Yearly</button>' : ''}
                </div>
            </div>
            <div class="chart" id="commitChart">
                <div class="chart-bars" id="monthlyBars">
                    ${Object.entries(monthlyData).map(([key, data]) => `
                        <div class="chart-bar month-view" 
                             style="height: ${Math.max(5, (data.commitCount / maxMonthlyCommits) * 250)}px"
                             data-period="${key}"
                             data-commits="${data.commitCount}"
                             data-authors="${data.authorsCount}"
                             data-insertions="${data.insertions}"
                             data-deletions="${data.deletions}"
                             onmouseenter="showTooltip(event, this)"
                             onmouseleave="hideTooltip()">
                            <div class="chart-bar-value">${data.commitCount}</div>
                            <div class="chart-bar-label">${key}</div>
                        </div>
                    `).join('')}
                </div>
                ${Object.keys(yearlyData).length > 1 ? `
                <div class="chart-bars" id="yearlyBars" style="display: none;">
                    ${Object.entries(yearlyData).map(([year, data]) => `
                        <div class="chart-bar year-view" 
                             style="height: ${Math.max(5, (data.commitCount / maxYearlyCommits) * 250)}px"
                             data-period="${year}"
                             data-commits="${data.commitCount}"
                             data-authors="${data.authorsCount}"
                             data-insertions="${data.insertions}"
                             data-deletions="${data.deletions}"
                             onmouseenter="showTooltip(event, this)"
                             onmouseleave="hideTooltip()">
                            <div class="chart-bar-value">${data.commitCount}</div>
                            <div class="chart-bar-label">${year}</div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                <div class="tooltip" id="tooltip">
                    <h4 id="tooltipTitle"></h4>
                    <p>Commits: <span id="tooltipCommits"></span></p>
                    <p>Authors: <span id="tooltipAuthors"></span></p>
                    <p>Insertions: <span id="tooltipInsertions"></span></p>
                    <p>Deletions: <span id="tooltipDeletions"></span></p>
                </div>
            </div>
        </div>

        <div class="commits-list fade-in">
            <h2 style="color: var(--accent); margin-bottom: 20px;">📝 Recent Commits</h2>
            ${data.commits.slice(0, 20).map(commit => `
                <div class="commit-item">
                    <span class="commit-hash">${commit.shortHash}</span>
                    <div class="commit-message">${commit.subject}</div>
                    <div class="commit-meta">
                        <span>👤 ${commit.author}</span>
                        <span>📅 ${new Date(commit.authorDate).toLocaleDateString()}</span>
                        <span>📊 ${commit.stats ? commit.stats.filesChanged + ' files' : 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="commits-list fade-in">
            <h2 style="color: var(--accent); margin-bottom: 20px;">👥 Top Contributors</h2>
            <div class="author-list">
                ${data.authors.sort((a, b) => b.commits - a.commits).slice(0, 10).map(author => `
                    <div class="author-card">
                        <div class="author-name">${author.name}</div>
                        <div class="author-stats">
                            <div>Commits: ${author.commits}</div>
                            <div>Lines Added: +${author.insertions}</div>
                            <div>Lines Removed: -${author.deletions}</div>
                            <div>Active: ${new Date(author.firstCommit).getFullYear()} - ${new Date(author.lastCommit).getFullYear()}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <script>
        function switchView(view) {
            const monthlyBars = document.getElementById('monthlyBars');
            const yearlyBars = document.getElementById('yearlyBars');
            const buttons = document.querySelectorAll('.toggle-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            
            if (view === 'month') {
                monthlyBars.style.display = 'flex';
                if (yearlyBars) yearlyBars.style.display = 'none';
                buttons[0].classList.add('active');
            } else {
                monthlyBars.style.display = 'none';
                if (yearlyBars) yearlyBars.style.display = 'flex';
                if (buttons[1]) buttons[1].classList.add('active');
            }
        }

        function showTooltip(event, element) {
            const tooltip = document.getElementById('tooltip');
            const rect = element.getBoundingClientRect();
            const chartRect = element.closest('.chart').getBoundingClientRect();
            
            tooltip.style.left = (rect.left - chartRect.left + rect.width / 2 - 100) + 'px';
            tooltip.style.top = (rect.top - chartRect.top - 120) + 'px';
            
            document.getElementById('tooltipTitle').textContent = element.dataset.period;
            document.getElementById('tooltipCommits').textContent = element.dataset.commits;
            document.getElementById('tooltipAuthors').textContent = element.dataset.authors;
            document.getElementById('tooltipInsertions').textContent = '+' + element.dataset.insertions;
            document.getElementById('tooltipDeletions').textContent = '-' + element.dataset.deletions;
            
            tooltip.classList.add('visible');
        }

        function hideTooltip() {
            document.getElementById('tooltip').classList.remove('visible');
        }
    </script>
</body>
</html>`;
    }
}

// ============================================================================
// WEB SERVER WITH PROGRESS TRACKING (ASYNC USING CHILD PROCESS)
// ============================================================================

class GitViewServer {
    constructor(repoInput, port = 8080, cacheManager = null) {
        this.cacheManager = cacheManager || new CacheManager();
        this.port = port;
        this.repoPaths = this.resolveRepoPaths(repoInput);
        this.server = null;
        this.progress = {
            stage: 'initializing',
            percent: 0,
            message: 'Starting analysis...',
            repoIndex: 0,
            totalRepos: this.repoPaths.length,
            repoName: ''
        };
        this.analysisMap = new Map(); // repoPath -> data
        this.repoDataList = [];        // { path, name, data }
        this.analysisData = null;      // for single repo compatibility
        this.analysisComplete = false;
        this.isAnalyzing = false;
        this.workerPath = this.prepareWorkerFile();
    }

    resolveRepoPaths(repoInput) {
        if (Array.isArray(repoInput)) {
            return repoInput.map(p => path.resolve(p));
        }
        if (typeof repoInput === 'string') {
            return [path.resolve(repoInput)];
        }
        if (repoInput && repoInput.repoPath) {
            return [path.resolve(repoInput.repoPath)];
        }
        throw new Error('Invalid repository input. Expected string, array, or GitView instance.');
    }

    prepareWorkerFile() {
        const workerPath = path.join('/tmp', 'gitview-worker.mjs');
        const workerScript = `
import { GitView } from ${JSON.stringify(pathToFileURL(__filename).href)};
const repoPath = process.argv[2];
const gitView = new GitView(repoPath, (stage, percent, message) => {
    process.send({ type: 'progress', stage, percent, message });
});
try {
    const data = gitView.getAllData();
    process.send({ type: 'complete', data });
} catch (error) {
    process.send({ type: 'error', error: error.message });
}
`;
        fs.writeFileSync(workerPath, workerScript, 'utf8');
        return workerPath;
    }

    start() {
        this.server = http.createServer((req, res) => {
            const parsedUrl = parseUrl(req.url, true);
            
            // Serve loading page initially
            if (parsedUrl.pathname === '/') {
                if (!this.analysisComplete) {
                    if (!this.isAnalyzing) {
                        // Send loading page immediately, then start analysis async
                        const repoName = this.repoPaths.length === 1 
                            ? path.basename(this.repoPaths[0]) 
                            : `${this.repoPaths.length} repositories`;
                        const loadingHTML = LoadingPageGenerator.generateLoadingHTML(repoName);
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(loadingHTML);
                        
                        // Start analysis without blocking
                        this.startAnalysis().catch(err => {
                            console.error('Analysis failed:', err);
                            this.progress = { stage:'error', percent:100, message:err.message, repoIndex:0,totalRepos:this.repoPaths.length,repoName:'' };
                        });
                    } else {
                        // Already analyzing, serve loading page again
                        const repoName = this.repoPaths.length === 1 
                            ? path.basename(this.repoPaths[0]) 
                            : `${this.repoPaths.length} repositories`;
                        const loadingHTML = LoadingPageGenerator.generateLoadingHTML(repoName);
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(loadingHTML);
                    }
                } else {
                    // Redirect to first repo view
                    const redirectUrl = this.repoPaths.length > 1 ? '/view?repo=0' : '/view';
                    res.writeHead(302, { 'Location': redirectUrl });
                    res.end();
                }
            } 
            // Serve the main view
            else if (parsedUrl.pathname === '/view') {
                if (!this.analysisComplete) {
                    res.writeHead(302, { 'Location': '/' });
                    res.end();
                    return;
                }

                let repoIndex = 0;
                if (parsedUrl.query.repo !== undefined) {
                    repoIndex = parseInt(parsedUrl.query.repo, 10);
                    if (isNaN(repoIndex) || repoIndex < 0 || repoIndex >= this.repoDataList.length) {
                        repoIndex = 0;
                    }
                }
                const repoEntry = this.repoDataList[repoIndex];
                if (!repoEntry || !repoEntry.data) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Repository data not found');
                    return;
                }
                const options = {
                    repoList: this.repoDataList.map((r, i) => ({ name: r.name, path: r.path, index: i })),
                    currentIndex: repoIndex
                };
                const html = HTMLGenerator.generateHTML(repoEntry.data, options);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            }
            // Progress API endpoint
            else if (parsedUrl.pathname === '/api/progress') {
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                });
                res.end(JSON.stringify(this.progress));
            }
            // Repos list API
            else if (parsedUrl.pathname === '/api/repos') {
                if (!this.analysisComplete) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Analysis in progress' }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(this.repoDataList.map((r, i) => ({
                        name: r.name,
                        path: r.path,
                        index: i,
                        hasData: !!r.data
                    }))));
                }
            }
            // Data API endpoint
            else if (parsedUrl.pathname === '/api/data') {
                if (!this.analysisComplete) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Analysis in progress' }));
                    return;
                }

                if (this.repoPaths.length === 1) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(this.repoDataList[0].data, null, 2));
                } else {
                    const repoParam = parsedUrl.query.repo;
                    if (repoParam === undefined) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing repo parameter' }));
                        return;
                    }
                    const repoIndex = parseInt(repoParam, 10);
                    if (isNaN(repoIndex) || repoIndex < 0 || repoIndex >= this.repoDataList.length) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Repository not found' }));
                        return;
                    }
                    const repoEntry = this.repoDataList[repoIndex];
                    if (!repoEntry.data) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Repository data missing' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(repoEntry.data, null, 2));
                }
            }
            else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });

        this.server.listen(this.port, () => {
            console.log(`\n🚀 GitView server is running at: http://localhost:${this.port}`);
            if (this.repoPaths.length === 1) {
                console.log(`📁 Repository: ${this.repoPaths[0]}`);
            } else {
                console.log(`📁 Repositories (${this.repoPaths.length}):`);
                this.repoPaths.forEach(p => console.log(`   - ${p}`));
            }
            console.log(`📊 Loading page: http://localhost:${this.port}/`);
            console.log(`🔍 View: http://localhost:${this.port}/view`);
            console.log(`📡 API: http://localhost:${this.port}/api/data`);
            console.log(`\nPress Ctrl+C to stop the server\n`);
        });

        return this.server;
    }

    async startAnalysis() {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;
        this.analysisComplete = false;
        this.analysisMap.clear();
        this.repoDataList = [];

        const total = this.repoPaths.length;
        let completed = 0;

        for (let i = 0; i < total; i++) {
            const repoPath = this.repoPaths[i];
            const repoName = path.basename(repoPath);

            // Check cache
            const cached = this.cacheManager.load(repoPath);
            if (cached) {
                this.analysisMap.set(repoPath, cached);
                completed++;
                this.progress = {
                    stage: 'cached',
                    percent: Math.round((completed / total) * 100),
                    message: `Loaded from cache: ${repoName}`,
                    repoIndex: i,
                    totalRepos: total,
                    repoName
                };
                continue;
            }

            // Analyze in child process
            try {
                await new Promise((resolve, reject) => {
                    let settled = false;
                    const worker = spawn('node', [this.workerPath, repoPath], {
                        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
                    });

                    worker.on('message', (msg) => {
                        if (settled) return;
                        if (msg.type === 'progress') {
                            const overall = Math.round((i / total) * 100 + (msg.percent / total));
                            this.progress = {
                                stage: msg.stage,
                                percent: overall,
                                message: `[${repoName}] ${msg.message}`,
                                repoIndex: i,
                                totalRepos: total,
                                repoName
                            };
                        } else if (msg.type === 'complete') {
                            settled = true;
                            this.analysisMap.set(repoPath, msg.data);
                            this.cacheManager.save(repoPath, msg.data);
                            resolve();
                        } else if (msg.type === 'error') {
                            settled = true;
                            reject(new Error(msg.error));
                        }
                    });

                    worker.on('error', (err) => {
                        if (!settled) {
                            settled = true;
                            reject(err);
                        }
                    });

                    worker.on('exit', (code) => {
                        if (!settled) {
                            settled = true;
                            reject(new Error(`Worker exited with code ${code}`));
                        }
                    });
                });
                completed++;
                this.progress = {
                    stage: 'complete',
                    percent: Math.round((completed / total) * 100),
                    message: `Analyzed: ${repoName}`,
                    repoIndex: i,
                    totalRepos: total,
                    repoName
                };
            } catch (error) {
                console.error(`Error analyzing ${repoPath}: ${error.message}`);
                this.analysisMap.set(repoPath, null);
                completed++;
                this.progress = {
                    stage: 'error',
                    percent: Math.round((completed / total) * 100),
                    message: `Error analyzing ${repoName}: ${error.message}`,
                    repoIndex: i,
                    totalRepos: total,
                    repoName
                };
            }
        }

        // Build repoDataList
        this.repoDataList = this.repoPaths.map(p => ({
            path: p,
            name: path.basename(p),
            data: this.analysisMap.get(p) || null
        }));

        if (this.repoPaths.length === 1) {
            this.analysisData = this.repoDataList[0].data;
        }

        this.analysisComplete = true;
        this.isAnalyzing = false;
        this.progress.percent = 100;
        this.progress.stage = 'complete';
        this.progress.message = 'Analysis complete';
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

// ============================================================================
// UTILITY: FIND GIT REPOSITORIES IN DIRECTORY
// ============================================================================

function findGitRepos(rootDir) {
    const repos = [];
    const root = path.resolve(rootDir);
    
    if (fs.existsSync(path.join(root, '.git'))) {
        repos.push(root);
        return repos;
    }

    const walk = (dir) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // ignore permission errors
        }
        for (const entry of entries) {
            if (entry.name === '.git' && entry.isDirectory()) {
                repos.push(dir);
            } else if (entry.isDirectory()) {
                walk(path.join(dir, entry.name));
            }
        }
    };
    walk(root);
    return repos;
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

class GitViewApp {
    constructor() {
        this.parser = new ArgumentParser();
        this.cacheManager = new CacheManager();
        this.run();
    }

    run() {
        if (this.parser.args.help) {
            this.parser.showHelp();
            return;
        }

        try {
            let repoInput;
            if (this.parser.args.dir) {
                const repos = findGitRepos(this.parser.args.repoPath);
                if (repos.length === 0) {
                    console.error(`❌ No .git repositories found in ${this.parser.args.repoPath}`);
                    process.exit(1);
                }
                console.log(`📁 Found ${repos.length} repositories in ${this.parser.args.repoPath}`);
                repoInput = repos;
            } else {
                repoInput = this.parser.args.repoPath;
            }

            // Generate static HTML if requested
            if (this.parser.args.html) {
                if (Array.isArray(repoInput)) {
                    // Generate separate HTML files for each repo
                    const outputDir = process.cwd();
                    for (const repoPath of repoInput) {
                        const repoName = path.basename(repoPath);
                        console.log(`📊 Analyzing ${repoName}...`);
                        let data = this.cacheManager.load(repoPath);
                        if (!data) {
                            const gitView = new GitView(repoPath);
                            data = gitView.getAllData();
                            this.cacheManager.save(repoPath, data);
                        }
                        const html = HTMLGenerator.generateHTML(data);
                        const safeName = repoName.replace(/[^a-zA-Z0-9-_]/g, '_');
                        const outputPath = path.join(outputDir, `gitview-${safeName}.html`);
                        fs.writeFileSync(outputPath, html, 'utf8');
                        console.log(`✅ Generated: ${outputPath}`);
                    }
                } else {
                    console.log('📊 Analyzing repository data...');
                    let data = this.cacheManager.load(repoInput);
                    if (!data) {
                        const gitView = new GitView(repoInput);
                        data = gitView.getAllData();
                        this.cacheManager.save(repoInput, data);
                    }
                    console.log(`✅ Analysis complete: ${data.health.totalCommits} commits, ${data.authors.length} authors`);
                    
                    console.log('📝 Generating HTML file...');
                    const html = HTMLGenerator.generateHTML(data);
                    const outputPath = path.join(process.cwd(), 'gitview.html');
                    fs.writeFileSync(outputPath, html, 'utf8');
                    console.log(`✅ HTML generated: ${outputPath}`);
                }
            }

            // Start server if requested
            if (this.parser.args.server) {
                const server = new GitViewServer(repoInput, this.parser.args.port, this.cacheManager);
                server.start();
            }

        } catch (error) {
            console.error('❌ Error:', error.message);
            console.log('\nTip: Run with --help for usage information');
            process.exit(1);
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { GitView, GitViewServer, HTMLGenerator, LoadingPageGenerator, ArgumentParser, CacheManager, findGitRepos };

// Auto-start if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    new GitViewApp();
}