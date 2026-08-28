#!/usr/bin/env node

/**
 * GitView - Comprehensive Git Repository Visualization and Analysis Tool
 * Enhanced with complete Pack.js integration, user authentication, and repository management
 */

import { spawnSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { parse as parseUrl } from 'url';
import analyzeDirectories from '../Packager/Pack.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DATABASE MANAGER - JSON-based storage with authentication
// ============================================================================

class DatabaseManager {
    constructor() {
        this.dataDir = path.join('/tmp', 'gitview-data');
        this.dbFile = path.join(this.dataDir, 'database.json');
        this.logsFile = path.join(this.dataDir, 'logs.json');
        this.sessionsFile = path.join(this.dataDir, 'sessions.json');
        this.ensureDataDir();
        this.ensureDatabase();
        this.loggingEnabled = false;
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    ensureDatabase() {
        // Ensure database.json exists with proper structure
        if (!fs.existsSync(this.dbFile)) {
            const initialDB = {
                users: [],
                repos: [],
                groups: [],
                sessions: [],
                settings: {
                    loggingEnabled: false,
                    registrationOpen: true
                }
            };
            fs.writeFileSync(this.dbFile, JSON.stringify(initialDB, null, 2), 'utf8');
        } else {
            // Validate existing database structure
            try {
                const raw = fs.readFileSync(this.dbFile, 'utf8');
                const db = JSON.parse(raw);
                
                // Ensure all required arrays exist
                if (!db.users || !Array.isArray(db.users)) {
                    db.users = [];
                }
                if (!db.repos || !Array.isArray(db.repos)) {
                    db.repos = [];
                }
                if (!db.groups || !Array.isArray(db.groups)) {
                    db.groups = [];
                }
                if (!db.sessions || !Array.isArray(db.sessions)) {
                    db.sessions = [];
                }
                if (!db.settings || typeof db.settings !== 'object') {
                    db.settings = {
                        loggingEnabled: false,
                        registrationOpen: true
                    };
                }
                
                // Save corrected structure
                fs.writeFileSync(this.dbFile, JSON.stringify(db, null, 2), 'utf8');
            } catch (error) {
                // If file is corrupted, recreate it
                console.error(`Database file corrupted, recreating: ${error.message}`);
                const initialDB = {
                    users: [],
                    repos: [],
                    groups: [],
                    sessions: [],
                    settings: {
                        loggingEnabled: false,
                        registrationOpen: true
                    }
                };
                fs.writeFileSync(this.dbFile, JSON.stringify(initialDB, null, 2), 'utf8');
            }
        }
        
        // Ensure logs.json exists
        if (!fs.existsSync(this.logsFile)) {
            fs.writeFileSync(this.logsFile, JSON.stringify({ logs: [] }, null, 2), 'utf8');
        }
        
        // Ensure sessions.json exists
        if (!fs.existsSync(this.sessionsFile)) {
            fs.writeFileSync(this.sessionsFile, JSON.stringify({ sessions: [] }, null, 2), 'utf8');
        }
    }

    loadDB() {
        try {
            const raw = fs.readFileSync(this.dbFile, 'utf8');
            const db = JSON.parse(raw);
            
            // Validate and ensure proper structure
            if (!db || typeof db !== 'object') {
                throw new Error('Invalid database structure');
            }
            
            // Ensure all required arrays exist
            if (!Array.isArray(db.users)) {
                db.users = [];
            }
            if (!Array.isArray(db.repos)) {
                db.repos = [];
            }
            if (!Array.isArray(db.groups)) {
                db.groups = [];
            }
            if (!Array.isArray(db.sessions)) {
                db.sessions = [];
            }
            if (!db.settings || typeof db.settings !== 'object') {
                db.settings = {
                    loggingEnabled: false,
                    registrationOpen: true
                };
            }
            
            return db;
        } catch (error) {
            console.error(`Failed to load database: ${error.message}`);
            // Return a fresh database structure
            return {
                users: [],
                repos: [],
                groups: [],
                sessions: [],
                settings: {
                    loggingEnabled: false,
                    registrationOpen: true
                }
            };
        }
    }

    saveDB(db) {
        try {
            // Validate db structure before saving
            if (!db || typeof db !== 'object') {
                throw new Error('Invalid database object');
            }
            
            // Ensure all required arrays exist
            if (!Array.isArray(db.users)) {
                db.users = [];
            }
            if (!Array.isArray(db.repos)) {
                db.repos = [];
            }
            if (!Array.isArray(db.groups)) {
                db.groups = [];
            }
            if (!Array.isArray(db.sessions)) {
                db.sessions = [];
            }
            if (!db.settings || typeof db.settings !== 'object') {
                db.settings = {
                    loggingEnabled: false,
                    registrationOpen: true
                };
            }
            
            fs.writeFileSync(this.dbFile, JSON.stringify(db, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`Failed to save database: ${error.message}`);
            return false;
        }
    }

    loadLogs() {
        try {
            if (!fs.existsSync(this.logsFile)) {
                return { logs: [] };
            }
            const raw = fs.readFileSync(this.logsFile, 'utf8');
            const logsData = JSON.parse(raw);
            
            // Ensure logs array exists
            if (!logsData || !Array.isArray(logsData.logs)) {
                return { logs: [] };
            }
            
            return logsData;
        } catch (error) {
            console.error(`Failed to load logs: ${error.message}`);
            return { logs: [] };
        }
    }

    saveLogs(logsData) {
        try {
            // Validate logs structure
            if (!logsData || !Array.isArray(logsData.logs)) {
                logsData = { logs: [] };
            }
            
            fs.writeFileSync(this.logsFile, JSON.stringify(logsData, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`Failed to save logs: ${error.message}`);
            return false;
        }
    }

    loadSessions() {
        try {
            if (!fs.existsSync(this.sessionsFile)) {
                return { sessions: [] };
            }
            const raw = fs.readFileSync(this.sessionsFile, 'utf8');
            const sessionsData = JSON.parse(raw);
            
            // Ensure sessions array exists
            if (!sessionsData || !Array.isArray(sessionsData.sessions)) {
                return { sessions: [] };
            }
            
            return sessionsData;
        } catch (error) {
            console.error(`Failed to load sessions: ${error.message}`);
            return { sessions: [] };
        }
    }

    saveSessions(sessionsData) {
        try {
            // Validate sessions structure
            if (!sessionsData || !Array.isArray(sessionsData.sessions)) {
                sessionsData = { sessions: [] };
            }
            
            fs.writeFileSync(this.sessionsFile, JSON.stringify(sessionsData, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`Failed to save sessions: ${error.message}`);
            return false;
        }
    }

    log(level, message, metadata = {}) {
        const db = this.loadDB();
        if (!db.settings?.loggingEnabled) return;

        const logsData = this.loadLogs();
        const logEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata
        };
        
        logsData.logs.unshift(logEntry);
        
        // Keep only last 1000 logs
        if (logsData.logs.length > 1000) {
            logsData.logs = logsData.logs.slice(0, 1000);
        }
        
        this.saveLogs(logsData);
    }

    clearLogs() {
        this.saveLogs({ logs: [] });
        return true;
    }

    toggleLogging() {
        const db = this.loadDB();
        if (!db.settings) {
            db.settings = {};
        }
        db.settings.loggingEnabled = !db.settings.loggingEnabled;
        this.saveDB(db);
        return db.settings.loggingEnabled;
    }

    getLoggingStatus() {
        const db = this.loadDB();
        return db.settings?.loggingEnabled || false;
    }

    clearAll() {
        const freshDB = {
            users: [],
            repos: [],
            groups: [],
            sessions: [],
            settings: {
                loggingEnabled: this.getLoggingStatus(),
                registrationOpen: true
            }
        };
        this.saveDB(freshDB);
        this.saveSessions({ sessions: [] });
        this.saveLogs({ logs: [] });
        return true;
    }
}

// ============================================================================
// AUTHENTICATION MANAGER
// ============================================================================

class AuthManager {
    constructor(dbManager) {
        this.db = dbManager;
        this.sessions = new Map();
    }

    hashPassword(password, salt = null) {
        const useSalt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, useSalt, 10000, 64, 'sha512').toString('hex');
        return { hash, salt: useSalt };
    }

    verifyPassword(password, salt, hash) {
        const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return verifyHash === hash;
    }

    register(email, password, name) {
        const db = this.db.loadDB();
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { success: false, error: 'Invalid email format' };
        }
        
        // Validate password
        if (password.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters' };
        }
        
        // Check if email already registered
        const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            return { success: false, error: 'Email already registered' };
        }
        
        // Hash password
        const { hash, salt } = this.hashPassword(password);
        
        // Create user
        const user = {
            id: crypto.randomUUID(),
            email: email.toLowerCase(),
            name: name || email.split('@')[0],
            passwordHash: hash,
            passwordSalt: salt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        db.users.push(user);
        this.db.saveDB(db);
        
        this.db.log('info', 'User registered', { userId: user.id, email: user.email });
        
        return { 
            success: true, 
            user: { 
                id: user.id, 
                email: user.email, 
                name: user.name,
                createdAt: user.createdAt 
            } 
        };
    }

    login(email, password) {
        const db = this.db.loadDB();
        
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
            return { success: false, error: 'Invalid email or password' };
        }
        
        if (!this.verifyPassword(password, user.passwordSalt, user.passwordHash)) {
            return { success: false, error: 'Invalid email or password' };
        }
        
        // Create session
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const session = {
            token: sessionToken,
            userId: user.id,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };
        
        db.sessions.push(session);
        this.db.saveDB(db);
        
        this.sessions.set(sessionToken, session);
        
        this.db.log('info', 'User logged in', { userId: user.id, email: user.email });
        
        return {
            success: true,
            token: sessionToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        };
    }

    logout(token) {
        const db = this.db.loadDB();
        db.sessions = db.sessions.filter(s => s.token !== token);
        this.db.saveDB(db);
        this.sessions.delete(token);
        
        return { success: true };
    }

    validateSession(token) {
        if (!token) return null;
        
        // Check memory first
        if (this.sessions.has(token)) {
            const session = this.sessions.get(token);
            if (new Date(session.expiresAt) > new Date()) {
                return session;
            }
            this.sessions.delete(token);
            return null;
        }
        
        // Check database
        const db = this.db.loadDB();
        const session = db.sessions.find(s => s.token === token);
        if (session && new Date(session.expiresAt) > new Date()) {
            this.sessions.set(token, session);
            return session;
        }
        
        return null;
    }

    getUserById(userId) {
        const db = this.db.loadDB();
        return db.users.find(u => u.id === userId);
    }
}

// ============================================================================
// REPOSITORY MANAGER
// ============================================================================

class RepositoryManager {
    constructor(dbManager, authManager) {
        this.db = dbManager;
        this.auth = authManager;
        this.repoCache = new Map();
        this.analysisCache = new Map();
    }

    addRepository(token, repoPath, name = null, description = '') {
        const session = this.auth.validateSession(token);
        if (!session) {
            return { success: false, error: 'Invalid or expired session' };
        }
        
        const resolvedPath = path.resolve(repoPath);
        
        // Validate it's a git repo
        try {
            const gitView = new GitView(resolvedPath);
        } catch (error) {
            return { success: false, error: `Not a valid git repository: ${resolvedPath}` };
        }
        
        const db = this.db.loadDB();
        
        // Check if repo already exists
        const existingRepo = db.repos.find(r => r.path === resolvedPath);
        if (existingRepo) {
            return { success: false, error: 'Repository already exists' };
        }
        
        const repo = {
            id: crypto.randomUUID(),
            ownerId: session.userId,
            path: resolvedPath,
            name: name || path.basename(resolvedPath),
            description: description,
            isPublic: true, // All repos initially public
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        db.repos.push(repo);
        this.db.saveDB(db);
        
        this.db.log('info', 'Repository added', { repoId: repo.id, ownerId: session.userId, path: resolvedPath });
        
        return { success: true, repo };
    }

    removeRepository(token, repoId) {
        const session = this.auth.validateSession(token);
        if (!session) {
            return { success: false, error: 'Invalid or expired session' };
        }
        
        const db = this.db.loadDB();
        const repoIndex = db.repos.findIndex(r => r.id === repoId);
        
        if (repoIndex === -1) {
            return { success: false, error: 'Repository not found' };
        }
        
        // Only owner can remove
        if (db.repos[repoIndex].ownerId !== session.userId) {
            return { success: false, error: 'Only the owner can remove this repository' };
        }
        
        db.repos.splice(repoIndex, 1);
        this.db.saveDB(db);
        
        this.db.log('info', 'Repository removed', { repoId, ownerId: session.userId });
        
        return { success: true };
    }

    getUserRepos(userId) {
        const db = this.db.loadDB();
        return db.repos.filter(r => r.ownerId === userId);
    }

    getAllRepos() {
        const db = this.db.loadDB();
        return db.repos;
    }

    getRepoById(repoId) {
        const db = this.db.loadDB();
        return db.repos.find(r => r.id === repoId);
    }

    async analyzeRepo(repoId) {
        const repo = this.getRepoById(repoId);
        if (!repo) return null;
        
        // Check cache
        if (this.analysisCache.has(repoId)) {
            const cached = this.analysisCache.get(repoId);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
                return cached.data;
            }
        }
        
        try {
            const gitView = new GitView(repo.path);
            const gitData = gitView.getAllData();
            
            // Run Pack analysis
            let packAnalysis = null;
            try {
                const packResult = await analyzeDirectories(repo.path);
                packAnalysis = packResult.report || packResult;
            } catch (error) {
                console.error(`Pack analysis failed for ${repo.name}: ${error.message}`);
            }
            
            const fullData = {
                ...gitData,
                packAnalysis,
                repository: {
                    ...gitData.repository,
                    currentCommit: gitView.executeGitOptional(['rev-parse', 'HEAD'])
                }
            };
            
            this.analysisCache.set(repoId, {
                timestamp: Date.now(),
                data: fullData
            });
            
            return fullData;
        } catch (error) {
            console.error(`Failed to analyze repo ${repo.path}: ${error.message}`);
            return null;
        }
    }
}

// ============================================================================
// GROUP MANAGER
// ============================================================================

class GroupManager {
    constructor(dbManager, authManager) {
        this.db = dbManager;
        this.auth = authManager;
    }

    createGroup(token, name, description = '', repoIds = []) {
        const session = this.auth.validateSession(token);
        if (!session) {
            return { success: false, error: 'Invalid or expired session' };
        }
        
        const db = this.db.loadDB();
        
        // Check if group name already exists for this user
        const existingGroup = db.groups.find(g => g.name === name && g.ownerId === session.userId);
        if (existingGroup) {
            return { success: false, error: 'Group with this name already exists' };
        }
        
        const group = {
            id: crypto.randomUUID(),
            ownerId: session.userId,
            name,
            description,
            repoIds: repoIds.filter(id => db.repos.some(r => r.id === id)),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        db.groups.push(group);
        this.db.saveDB(db);
        
        this.db.log('info', 'Group created', { groupId: group.id, ownerId: session.userId, name });
        
        return { success: true, group };
    }

    addRepoToGroup(token, groupId, repoId) {
        const session = this.auth.validateSession(token);
        if (!session) {
            return { success: false, error: 'Invalid or expired session' };
        }
        
        const db = this.db.loadDB();
        const group = db.groups.find(g => g.id === groupId);
        
        if (!group) {
            return { success: false, error: 'Group not found' };
        }
        
        if (group.ownerId !== session.userId) {
            return { success: false, error: 'Only the owner can modify this group' };
        }
        
        if (!group.repoIds.includes(repoId)) {
            group.repoIds.push(repoId);
            group.updatedAt = new Date().toISOString();
            this.db.saveDB(db);
        }
        
        return { success: true, group };
    }

    removeRepoFromGroup(token, groupId, repoId) {
        const session = this.auth.validateSession(token);
        if (!session) {
            return { success: false, error: 'Invalid or expired session' };
        }
        
        const db = this.db.loadDB();
        const group = db.groups.find(g => g.id === groupId);
        
        if (!group) {
            return { success: false, error: 'Group not found' };
        }
        
        if (group.ownerId !== session.userId) {
            return { success: false, error: 'Only the owner can modify this group' };
        }
        
        group.repoIds = group.repoIds.filter(id => id !== repoId);
        group.updatedAt = new Date().toISOString();
        this.db.saveDB(db);
        
        return { success: true, group };
    }

    deleteGroup(token, groupId) {
        const session = this.auth.validateSession(token);
        if (!session) {
            return { success: false, error: 'Invalid or expired session' };
        }
        
        const db = this.db.loadDB();
        const groupIndex = db.groups.findIndex(g => g.id === groupId);
        
        if (groupIndex === -1) {
            return { success: false, error: 'Group not found' };
        }
        
        if (db.groups[groupIndex].ownerId !== session.userId) {
            return { success: false, error: 'Only the owner can delete this group' };
        }
        
        db.groups.splice(groupIndex, 1);
        this.db.saveDB(db);
        
        return { success: true };
    }

    getUserGroups(userId) {
        const db = this.db.loadDB();
        return db.groups.filter(g => g.ownerId === userId);
    }

    getAllGroups() {
        const db = this.db.loadDB();
        return db.groups;
    }

    getGroupById(groupId) {
        const db = this.db.loadDB();
        return db.groups.find(g => g.id === groupId);
    }
}

// ============================================================================
// CACHE MANAGER (Preserved from original)
// ============================================================================

class CacheManager {
    constructor() {
        this.cacheDir = path.join('/tmp', 'gitview-cache');
        this.groupsFile = path.join(this.cacheDir, 'groups.json');
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        if (!fs.existsSync(this.groupsFile)) {
            fs.writeFileSync(this.groupsFile, JSON.stringify({ groups: {} }, null, 2), 'utf8');
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
            const cacheData = {
                ...data,
                cachedAt: new Date().toISOString(),
                repoPath: path.resolve(repoPath)
            };
            fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
        } catch (error) {
            console.error(`Failed to save cache for ${repoPath}: ${error.message}`);
        }
    }

    loadGroups() {
        try {
            const raw = fs.readFileSync(this.groupsFile, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            return { groups: {} };
        }
    }

    saveGroups(groupsData) {
        try {
            fs.writeFileSync(this.groupsFile, JSON.stringify(groupsData, null, 2), 'utf8');
        } catch (error) {
            console.error(`Failed to save groups: ${error.message}`);
        }
    }

    saveGroup(groupName, repoPaths, description = '') {
        const groupsData = this.loadGroups();
        groupsData.groups[groupName] = {
            name: groupName,
            description: description,
            repos: repoPaths.map(p => path.resolve(p)),
            createdAt: groupsData.groups[groupName]?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.saveGroups(groupsData);
    }

    loadGroup(groupName) {
        const groupsData = this.loadGroups();
        return groupsData.groups[groupName] || null;
    }

    deleteGroup(groupName) {
        const groupsData = this.loadGroups();
        if (groupsData.groups[groupName]) {
            delete groupsData.groups[groupName];
            this.saveGroups(groupsData);
            return true;
        }
        return false;
    }

    getAllGroups() {
        const groupsData = this.loadGroups();
        return Object.values(groupsData.groups);
    }

    moveRepoToGroup(groupName, repoPath) {
        const groupsData = this.loadGroups();
        const repoAbs = path.resolve(repoPath);
        
        for (const group of Object.values(groupsData.groups)) {
            const index = group.repos.indexOf(repoAbs);
            if (index > -1) {
                group.repos.splice(index, 1);
                group.updatedAt = new Date().toISOString();
            }
        }
        
        if (!groupsData.groups[groupName]) {
            groupsData.groups[groupName] = {
                name: groupName,
                description: '',
                repos: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        
        groupsData.groups[groupName].repos.push(repoAbs);
        groupsData.groups[groupName].updatedAt = new Date().toISOString();
        
        this.saveGroups(groupsData);
        return true;
    }

    removeRepoFromGroup(groupName, repoPath) {
        const groupsData = this.loadGroups();
        if (groupsData.groups[groupName]) {
            const repoAbs = path.resolve(repoPath);
            const index = groupsData.groups[groupName].repos.indexOf(repoAbs);
            if (index > -1) {
                groupsData.groups[groupName].repos.splice(index, 1);
                groupsData.groups[groupName].updatedAt = new Date().toISOString();
                
                if (groupsData.groups[groupName].repos.length === 0) {
                    delete groupsData.groups[groupName];
                }
                
                this.saveGroups(groupsData);
                return true;
            }
        }
        return false;
    }
}

// ============================================================================
// COMMAND LINE ARGUMENT PARSER (Enhanced)
// ============================================================================

class ArgumentParser {
    constructor() {
        this.args = {
            html: false,
            server: false,
            help: false,
            port: 8080,
            repoPath: process.cwd(),
            dir: false,
            group: null,
            createGroup: null,
            addToGroup: null,
            compareWith: null,
            // New management commands
            clearDB: false,
            clearLogs: false,
            toggleLogging: false,
            showLogs: false,
            listUsers: false,
            listRepos: false
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
                case '--group':
                case '-g':
                    if (i + 1 < args.length) {
                        this.args.group = args[i + 1];
                        i++;
                    }
                    break;
                case '--compare-with':
                    if (i + 1 < args.length) {
                        this.args.compareWith = args[i + 1];
                        i++;
                    }
                    break;
                case '--create-group':
                    if (i + 1 < args.length) {
                        this.args.createGroup = args[i + 1];
                        i++;
                    }
                    break;
                case '--add-to-group':
                    if (i + 1 < args.length) {
                        this.args.addToGroup = args[i + 1];
                        i++;
                    }
                    break;
                // Management commands
                case '--clear-db':
                    this.args.clearDB = true;
                    break;
                case '--clear-logs':
                    this.args.clearLogs = true;
                    break;
                case '--toggle-logging':
                    this.args.toggleLogging = true;
                    break;
                case '--show-logs':
                    this.args.showLogs = true;
                    break;
                case '--list-users':
                    this.args.listUsers = true;
                    break;
                case '--list-repos':
                    this.args.listRepos = true;
                    break;
            }
        }

        if (!this.args.html && !this.args.help && !this.args.createGroup && 
            !this.args.addToGroup && !this.args.clearDB && !this.args.clearLogs && 
            !this.args.toggleLogging && !this.args.showLogs && !this.args.listUsers && 
            !this.args.listRepos) {
            this.args.server = true;
        }
    }

    showHelp() {
        console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║              GitView - Git Repository Viewer & Manager                ║
╚══════════════════════════════════════════════════════════════════════╝

USAGE:
    node gitview.js [OPTIONS]

MAIN OPTIONS:
    --help, -h              Show this help message
    --server                Start web server with authentication
    --port, -p <number>     Specify port (default: 8080)
    --repo, -r <path>       Specify repository path
    --dir                   Analyze all repositories inside a directory
    --html                  Generate static HTML file

GROUP OPTIONS:
    --group, -g <name>      Load a specific group of repositories
    --create-group <name>   Create a new group (requires --dir or --repo)
    --add-to-group <name>   Add current repos to existing group
    --compare-with <name>   Compare with another group or repo

SERVER MANAGEMENT:
    --clear-db              Clear entire database (users, repos, groups)
    --clear-logs            Clear all logs
    --toggle-logging        Toggle logging on/off
    --show-logs             Display recent logs
    --list-users            List all registered users
    --list-repos            List all registered repositories

AUTHENTICATION:
    The server now requires user authentication.
    Register at: http://localhost:8080/register
    Login at: http://localhost:8080/login
    
    All repositories are initially PUBLIC.
    Users can add their git repos after registration.

EXAMPLES:
    node gitview.js                          # Start server with auth
    node gitview.js --port 3000              # Start server on port 3000
    node gitview.js --html                   # Generate gitview.html only
    node gitview.js --dir /path/to/repos     # Analyze repos in directory
    node gitview.js --toggle-logging         # Enable/disable logging
    node gitview.js --show-logs              # View recent logs
    node gitview.js --clear-db               # Reset entire database
        `);
    }
}

// ============================================================================
// GITVIEW CORE INTERFACE (Preserved from original)
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
        const currentCommit = this.executeGitOptional(['rev-parse', 'HEAD']);
        
        return {
            name: path.basename(this.repoPath),
            path: this.repoPath,
            gitDir: this.gitDir,
            remoteUrl: remoteUrl,
            defaultBranch: currentBranch || 'main',
            currentBranch: currentBranch,
            currentCommit: currentCommit,
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
// GROUP ANALYSIS (Preserved from original)
// ============================================================================

class GroupAnalyzer {
    static analyzeGroup(repoDataList) {
        const validRepos = repoDataList.filter(r => r && r.data);
        if (validRepos.length === 0) return null;

        const aggregatedData = {
            repository: {
                name: `Group (${validRepos.length} repos)`,
                path: 'GROUP',
                gitDir: 'GROUP',
                remoteUrl: 'GROUP',
                defaultBranch: 'GROUP',
                currentBranch: 'GROUP',
                currentCommit: 'GROUP',
                isBare: false,
                isShallow: false,
                gitVersion: 'GROUP',
                description: `Aggregated data from ${validRepos.length} repositories`
            },
            branches: [],
            tags: [],
            commits: [],
            authors: [],
            commitsByMonth: {},
            yearlySummary: {},
            fileStats: [],
            health: {
                totalCommits: 0,
                totalBranches: 0,
                totalTags: 0,
                totalFiles: 0,
                repoSize: '0 B',
                contributors: 0,
                lastActivity: null,
                firstCommit: null,
                daysActive: 0
            },
            packAnalysis: null
        };

        for (const repo of validRepos) {
            aggregatedData.health.totalCommits += repo.data.health.totalCommits;
            aggregatedData.health.totalBranches += repo.data.health.totalBranches;
            aggregatedData.health.totalTags += repo.data.health.totalTags;
            aggregatedData.health.totalFiles += repo.data.health.totalFiles;
            
            if (!aggregatedData.health.lastActivity || 
                (repo.data.health.lastActivity && repo.data.health.lastActivity > aggregatedData.health.lastActivity)) {
                aggregatedData.health.lastActivity = repo.data.health.lastActivity;
            }
            
            if (!aggregatedData.health.firstCommit || 
                (repo.data.health.firstCommit && repo.data.health.firstCommit < aggregatedData.health.firstCommit)) {
                aggregatedData.health.firstCommit = repo.data.health.firstCommit;
            }
            
            aggregatedData.branches.push(...repo.data.branches.map(b => ({
                ...b,
                repoName: repo.name
            })));
            
            aggregatedData.tags.push(...repo.data.tags.map(t => ({
                ...t,
                repoName: repo.name
            })));
            
            aggregatedData.commits.push(...repo.data.commits.map(c => ({
                ...c,
                repoName: repo.name
            })));
        }

        if (aggregatedData.health.firstCommit && aggregatedData.health.lastActivity) {
            const first = new Date(aggregatedData.health.firstCommit);
            const last = new Date(aggregatedData.health.lastActivity);
            aggregatedData.health.daysActive = Math.ceil((last - first) / (1000 * 60 * 60 * 24));
        }

        const authorMap = new Map();
        for (const repo of validRepos) {
            for (const author of repo.data.authors) {
                const key = author.email.toLowerCase();
                if (!authorMap.has(key)) {
                    authorMap.set(key, {
                        ...author,
                        repos: [repo.name]
                    });
                } else {
                    const existing = authorMap.get(key);
                    existing.commits += author.commits;
                    existing.insertions += author.insertions;
                    existing.deletions += author.deletions;
                    existing.repos.push(repo.name);
                    
                    if (author.firstCommit && (!existing.firstCommit || author.firstCommit < existing.firstCommit)) {
                        existing.firstCommit = author.firstCommit;
                    }
                    if (author.lastCommit && (!existing.lastCommit || author.lastCommit > existing.lastCommit)) {
                        existing.lastCommit = author.lastCommit;
                    }
                }
            }
        }
        aggregatedData.authors = Array.from(authorMap.values());
        aggregatedData.health.contributors = aggregatedData.authors.length;

        for (const repo of validRepos) {
            for (const [key, data] of Object.entries(repo.data.commitsByMonth)) {
                if (!aggregatedData.commitsByMonth[key]) {
                    aggregatedData.commitsByMonth[key] = {
                        year: data.year,
                        month: data.month,
                        commits: [],
                        commitCount: 0,
                        insertions: 0,
                        deletions: 0,
                        authors: new Set()
                    };
                }
                
                aggregatedData.commitsByMonth[key].commitCount += data.commitCount;
                aggregatedData.commitsByMonth[key].insertions += data.insertions;
                aggregatedData.commitsByMonth[key].deletions += data.deletions;
                aggregatedData.commitsByMonth[key].commits.push(...data.commits);
                
                data.authors.forEach(a => aggregatedData.commitsByMonth[key].authors.add(a));
            }
        }

        for (const key in aggregatedData.commitsByMonth) {
            aggregatedData.commitsByMonth[key].authors = Array.from(aggregatedData.commitsByMonth[key].authors);
            aggregatedData.commitsByMonth[key].authorsCount = aggregatedData.commitsByMonth[key].authors.length;
        }

        for (const repo of validRepos) {
            for (const [year, data] of Object.entries(repo.data.yearlySummary)) {
                if (!aggregatedData.yearlySummary[year]) {
                    aggregatedData.yearlySummary[year] = {
                        year: parseInt(year),
                        commitCount: 0,
                        insertions: 0,
                        deletions: 0,
                        authors: new Set(),
                        months: {}
                    };
                }
                
                aggregatedData.yearlySummary[year].commitCount += data.commitCount;
                aggregatedData.yearlySummary[year].insertions += data.insertions;
                aggregatedData.yearlySummary[year].deletions += data.deletions;
                
                data.authors.forEach(a => aggregatedData.yearlySummary[year].authors.add(a));
                
                for (const [monthKey, monthData] of Object.entries(data.months)) {
                    if (!aggregatedData.yearlySummary[year].months[monthKey]) {
                        aggregatedData.yearlySummary[year].months[monthKey] = monthData;
                    }
                }
            }
        }

        for (const year in aggregatedData.yearlySummary) {
            aggregatedData.yearlySummary[year].authors = Array.from(aggregatedData.yearlySummary[year].authors);
            aggregatedData.yearlySummary[year].authorsCount = aggregatedData.yearlySummary[year].authors.length;
        }

        aggregatedData.commits.sort((a, b) => new Date(b.authorDate) - new Date(a.authorDate));
        aggregatedData.commits = aggregatedData.commits.slice(0, 500);

        return aggregatedData;
    }

    static async analyzeGroupWithPack(repoDataList) {
        const aggregatedData = this.analyzeGroup(repoDataList);
        if (!aggregatedData) return null;

        const validRepos = repoDataList.filter(r => r && r.data);
        const packInputs = validRepos.map(r => r.path);
        
        if (packInputs.length > 0) {
            try {
                const packResult = await analyzeDirectories(packInputs);
                aggregatedData.packAnalysis = packResult.report || packResult;
            } catch (error) {
                console.error(`Pack analysis failed for group: ${error.message}`);
                aggregatedData.packAnalysis = null;
            }
        }

        return aggregatedData;
    }
}

// ============================================================================
// LOADING PAGE GENERATOR (Preserved from original)
// ============================================================================

class LoadingPageGenerator {
    static generateLoadingHTML(repoName, isGroup = false) {
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
            <h1>🚀 GitView ${isGroup ? '- Group' : ''}</h1>
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
            <li class="stage-item" id="stage-pack">
                <span class="stage-icon">📦</span>
                <span class="stage-name">Package Analysis</span>
                <span class="stage-status">Waiting...</span>
            </li>
        </ul>
    </div>

    <script>
        const stages = ['basic', 'branches', 'tags', 'commits', 'authors', 'time', 'yearly', 'files', 'health', 'pack'];
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

        function pollProgress() {
            fetch('/api/progress')
                .then(response => response.json())
                .then(data => {
                    updateProgress(data.stage, data.percent, data.message);
                    if (data.percent < 100) {
                        setTimeout(pollProgress, 500);
                    } else {
                        setTimeout(() => {
                            window.location.href = data.redirectUrl || '/view';
                        }, 1000);
                    }
                })
                .catch(error => {
                    console.error('Error fetching progress:', error);
                    setTimeout(pollProgress, 1000);
                });
        }

        pollProgress();
    </script>
</body>
</html>`;
    }
}

// ============================================================================
// HTML TEMPLATE GENERATOR - Enhanced with Authentication UI
// ============================================================================

class HTMLGenerator {
   
    static generateLoginPage() {
        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GitView - Login</title>
        <style>
            :root {
                --bg-primary: #0d1117;
                --bg-secondary: #161b22;
                --bg-tertiary: #21262d;
                --text-primary: #c9d1d9;
                --text-secondary: #8b949e;
                --accent: #58a6ff;
                --success: #3fb950;
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
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
    
            .auth-container {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 40px;
                max-width: 400px;
                width: 90%;
            }
    
            .auth-header {
                text-align: center;
                margin-bottom: 30px;
            }
    
            .auth-header h1 {
                color: var(--accent);
                font-size: 28px;
                margin-bottom: 10px;
            }
    
            .auth-header p {
                color: var(--text-secondary);
                font-size: 14px;
            }
    
            .form-group {
                margin-bottom: 20px;
            }
    
            .form-group label {
                display: block;
                margin-bottom: 5px;
                color: var(--text-secondary);
                font-size: 14px;
            }
    
            .form-group input {
                width: 100%;
                padding: 10px 15px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                border: 1px solid var(--border);
                border-radius: 6px;
                font-size: 14px;
            }
    
            .form-group input:focus {
                outline: none;
                border-color: var(--accent);
            }
    
            .btn {
                width: 100%;
                padding: 10px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.3s;
            }
    
            .btn-primary {
                background: var(--accent);
                color: var(--bg-primary);
            }
    
            .btn-primary:hover {
                background: #79c0ff;
            }
    
            .auth-link {
                text-align: center;
                margin-top: 20px;
                color: var(--text-secondary);
                font-size: 14px;
            }
    
            .auth-link a {
                color: var(--accent);
                text-decoration: none;
            }
    
            .auth-link a:hover {
                text-decoration: underline;
            }
    
            .error-message {
                background: var(--danger);
                color: white;
                padding: 10px;
                border-radius: 6px;
                margin-bottom: 20px;
                display: none;
            }
    
            .success-message {
                background: var(--success);
                color: white;
                padding: 10px;
                border-radius: 6px;
                margin-bottom: 20px;
                display: none;
            }
    
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
                margin-right: 10px;
            }
    
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="auth-container">
            <div class="auth-header">
                <h1>🚀 GitView</h1>
                <p>Login to your account</p>
            </div>
    
            <div class="error-message" id="errorMessage"></div>
            <div class="success-message" id="successMessage"></div>
    
            <form id="loginForm" onsubmit="return false;">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password">
                </div>
                <button type="submit" class="btn btn-primary" id="loginButton">
                    <span id="buttonText">Login</span>
                </button>
            </form>
    
            <div class="auth-link">
                Don't have an account? <a href="/register">Register here</a>
            </div>
        </div>
    
        <script>
            // Check for registration success message
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('registered') === 'true') {
                const successMessage = document.getElementById('successMessage');
                successMessage.textContent = 'Registration successful! Please login.';
                successMessage.style.display = 'block';
            }
    
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                const errorMessage = document.getElementById('errorMessage');
                const successMessage = document.getElementById('successMessage');
                const loginButton = document.getElementById('loginButton');
                const buttonText = document.getElementById('buttonText');
                
                // Clear previous messages
                errorMessage.style.display = 'none';
                successMessage.style.display = 'none';
                
                // Validate inputs
                if (!email || !password) {
                    errorMessage.textContent = 'Please enter both email and password';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                // Show loading state
                loginButton.disabled = true;
                buttonText.innerHTML = '<span class="loading-spinner"></span>Logging in...';
                
                try {
                    console.log('Attempting login with email:', email);
                    
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ email, password })
                    });
                    
                    console.log('Response status:', response.status);
                    
                    const data = await response.json();
                    console.log('Response data:', data);
                    
                    if (data.success) {
                        // Store token and user info
                        localStorage.setItem('gitview_token', data.token);
                        localStorage.setItem('gitview_user', JSON.stringify(data.user));
                        
                        // Set cookie for server-side auth
                        document.cookie = 'gitview_token=' + data.token + '; path=/; max-age=604800';
                        
                        // Show success message
                        successMessage.textContent = 'Login successful! Redirecting...';
                        successMessage.style.display = 'block';
                        
                        // Redirect to dashboard
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 500);
                    } else {
                        errorMessage.textContent = data.error || 'Login failed';
                        errorMessage.style.display = 'block';
                        
                        // Reset button
                        loginButton.disabled = false;
                        buttonText.textContent = 'Login';
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    errorMessage.textContent = 'Network error. Please check your connection and try again.';
                    errorMessage.style.display = 'block';
                    
                    // Reset button
                    loginButton.disabled = false;
                    buttonText.textContent = 'Login';
                }
            });
    
            // Prevent form from submitting on Enter key
            document.getElementById('loginForm').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    this.dispatchEvent(submitEvent);
                }
            });
        </script>
    </body>
    </html>`;
    }

    static generateRegisterPage() {
        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GitView - Register</title>
        <style>
            :root {
                --bg-primary: #0d1117;
                --bg-secondary: #161b22;
                --bg-tertiary: #21262d;
                --text-primary: #c9d1d9;
                --text-secondary: #8b949e;
                --accent: #58a6ff;
                --success: #3fb950;
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
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
    
            .auth-container {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 40px;
                max-width: 400px;
                width: 90%;
            }
    
            .auth-header {
                text-align: center;
                margin-bottom: 30px;
            }
    
            .auth-header h1 {
                color: var(--accent);
                font-size: 28px;
                margin-bottom: 10px;
            }
    
            .auth-header p {
                color: var(--text-secondary);
                font-size: 14px;
            }
    
            .form-group {
                margin-bottom: 20px;
            }
    
            .form-group label {
                display: block;
                margin-bottom: 5px;
                color: var(--text-secondary);
                font-size: 14px;
            }
    
            .form-group input {
                width: 100%;
                padding: 10px 15px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                border: 1px solid var(--border);
                border-radius: 6px;
                font-size: 14px;
            }
    
            .form-group input:focus {
                outline: none;
                border-color: var(--accent);
            }
    
            .btn {
                width: 100%;
                padding: 10px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.3s;
            }
    
            .btn-primary {
                background: var(--accent);
                color: var(--bg-primary);
            }
    
            .btn-primary:hover {
                background: #79c0ff;
            }
    
            .auth-link {
                text-align: center;
                margin-top: 20px;
                color: var(--text-secondary);
                font-size: 14px;
            }
    
            .auth-link a {
                color: var(--accent);
                text-decoration: none;
            }
    
            .auth-link a:hover {
                text-decoration: underline;
            }
    
            .error-message {
                background: var(--danger);
                color: white;
                padding: 10px;
                border-radius: 6px;
                margin-bottom: 20px;
                display: none;
            }
    
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
                margin-right: 10px;
            }
    
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="auth-container">
            <div class="auth-header">
                <h1>🚀 GitView</h1>
                <p>Create your account</p>
            </div>
    
            <div class="error-message" id="errorMessage"></div>
    
            <form id="registerForm" onsubmit="return false;">
                <div class="form-group">
                    <label for="name">Name</label>
                    <input type="text" id="name" name="name" required autocomplete="name">
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" minlength="6" required autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" minlength="6" required autocomplete="new-password">
                </div>
                <button type="submit" class="btn btn-primary" id="registerButton">
                    <span id="buttonText">Register</span>
                </button>
            </form>
    
            <div class="auth-link">
                Already have an account? <a href="/login">Login here</a>
            </div>
        </div>
    
        <script>
            document.getElementById('registerForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const name = document.getElementById('name').value.trim();
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const errorMessage = document.getElementById('errorMessage');
                const registerButton = document.getElementById('registerButton');
                const buttonText = document.getElementById('buttonText');
                
                // Clear previous messages
                errorMessage.style.display = 'none';
                
                // Validate inputs
                if (!name || !email || !password || !confirmPassword) {
                    errorMessage.textContent = 'Please fill in all fields';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                if (password !== confirmPassword) {
                    errorMessage.textContent = 'Passwords do not match';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                if (password.length < 6) {
                    errorMessage.textContent = 'Password must be at least 6 characters';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                // Show loading state
                registerButton.disabled = true;
                buttonText.innerHTML = '<span class="loading-spinner"></span>Registering...';
                
                try {
                    console.log('Attempting registration with email:', email);
                    
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ name, email, password })
                    });
                    
                    console.log('Response status:', response.status);
                    
                    const data = await response.json();
                    console.log('Response data:', data);
                    
                    if (data.success) {
                        // Redirect to login with success message
                        window.location.href = '/login?registered=true';
                    } else {
                        errorMessage.textContent = data.error || 'Registration failed';
                        errorMessage.style.display = 'block';
                        
                        // Reset button
                        registerButton.disabled = false;
                        buttonText.textContent = 'Register';
                    }
                } catch (error) {
                    console.error('Registration error:', error);
                    errorMessage.textContent = 'Network error. Please check your connection and try again.';
                    errorMessage.style.display = 'block';
                    
                    // Reset button
                    registerButton.disabled = false;
                    buttonText.textContent = 'Register';
                }
            });
        </script>
    </body>
    </html>`;
    }

    static generateDashboard(user, repos, groups) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitView - Dashboard</title>
    <style>
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --accent: #58a6ff;
            --success: #3fb950;
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
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h1 {
            color: var(--accent);
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .btn {
            padding: 8px 16px;
            border: 1px solid var(--border);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }

        .btn-primary {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
        }

        .btn-danger {
            background: var(--danger);
            color: white;
            border-color: var(--danger);
        }

        .btn-success {
            background: var(--success);
            color: white;
            border-color: var(--success);
        }

        .repos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .repo-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            transition: transform 0.2s;
        }

        .repo-card:hover {
            transform: translateY(-2px);
            border-color: var(--accent);
        }

        .repo-name {
            color: var(--accent);
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .repo-path {
            color: var(--text-secondary);
            font-size: 12px;
            margin-bottom: 15px;
        }

        .repo-actions {
            display: flex;
            gap: 10px;
        }

        .groups-section {
            margin-top: 30px;
        }

        .groups-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .group-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
            background: var(--bg-secondary);
            margin: 5% auto;
            padding: 20px;
            border: 1px solid var(--border);
            border-radius: 8px;
            width: 80%;
            max-width: 500px;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .close {
            color: var(--text-secondary);
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: var(--text-secondary);
        }

        .form-group input {
            width: 100%;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 GitView Dashboard</h1>
            <div class="user-info">
                <span>Welcome, ${user.name}</span>
                <button class="btn btn-danger" onclick="logout()">Logout</button>
            </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="btn btn-primary" onclick="openAddRepoModal()">➕ Add Repository</button>
            <button class="btn btn-success" onclick="openCreateGroupModal()">📦 Create Group</button>
        </div>

        <h2>Your Repositories</h2>
        <div class="repos-grid">
            ${repos.length > 0 ? repos.map(repo => `
                <div class="repo-card">
                    <div class="repo-name">${repo.name}</div>
                    <div class="repo-path">${repo.path}</div>
                    <div class="repo-actions">
                        <button class="btn btn-primary" onclick="viewRepo('${repo.id}')">View</button>
                        <button class="btn btn-danger" onclick="removeRepo('${repo.id}')">Remove</button>
                    </div>
                </div>
            `).join('') : '<p style="color: var(--text-secondary);">No repositories yet. Add your first repo!</p>'}
        </div>

        <div class="groups-section">
            <h2>Your Groups</h2>
            <div class="groups-grid">
                ${groups.length > 0 ? groups.map(group => `
                    <div class="group-card">
                        <div style="color: var(--accent); font-weight: bold;">${group.name}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">${group.description || 'No description'}</div>
                        <div style="color: var(--text-secondary); font-size: 12px; margin: 10px 0;">${group.repoIds.length} repos</div>
                        <div class="repo-actions">
                            <button class="btn btn-primary" onclick="viewGroup('${group.id}')">View</button>
                            <button class="btn btn-danger" onclick="deleteGroup('${group.id}')">Delete</button>
                        </div>
                    </div>
                `).join('') : '<p style="color: var(--text-secondary);">No groups yet.</p>'}
            </div>
        </div>
    </div>

    <!-- Add Repo Modal -->
    <div id="addRepoModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>➕ Add Repository</h2>
                <span class="close" onclick="closeAddRepoModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Repository Path</label>
                <input type="text" id="repoPath" placeholder="/path/to/your/repo">
            </div>
            <div class="form-group">
                <label>Name (optional)</label>
                <input type="text" id="repoName" placeholder="My Repo">
            </div>
            <div class="form-group">
                <label>Description (optional)</label>
                <input type="text" id="repoDescription" placeholder="Description">
            </div>
            <button class="btn btn-primary" onclick="addRepo()">Add Repository</button>
        </div>
    </div>

    <!-- Create Group Modal -->
    <div id="createGroupModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📦 Create Group</h2>
                <span class="close" onclick="closeCreateGroupModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Group Name</label>
                <input type="text" id="groupName" placeholder="My Group">
            </div>
            <div class="form-group">
                <label>Description (optional)</label>
                <input type="text" id="groupDescription" placeholder="Description">
            </div>
            <div class="form-group">
                <label>Select Repositories</label>
                <div id="repoCheckboxes">
                    ${repos.map(repo => `
                        <label style="display: block; margin: 5px 0;">
                            <input type="checkbox" value="${repo.id}"> ${repo.name}
                        </label>
                    `).join('')}
                </div>
            </div>
            <button class="btn btn-success" onclick="createGroup()">Create Group</button>
        </div>
    </div>

    <script>
        const token = localStorage.getItem('gitview_token');
        
        function logout() {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            }).then(() => {
                localStorage.removeItem('gitview_token');
                localStorage.removeItem('gitview_user');
                window.location.href = '/login';
            });
        }

        function openAddRepoModal() {
            document.getElementById('addRepoModal').style.display = 'block';
        }

        function closeAddRepoModal() {
            document.getElementById('addRepoModal').style.display = 'none';
        }

        function openCreateGroupModal() {
            document.getElementById('createGroupModal').style.display = 'block';
        }

        function closeCreateGroupModal() {
            document.getElementById('createGroupModal').style.display = 'none';
        }

        function addRepo() {
            const path = document.getElementById('repoPath').value;
            const name = document.getElementById('repoName').value;
            const description = document.getElementById('repoDescription').value;
            
            fetch('/api/repos', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ path, name, description })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Failed to add repo: ' + data.error);
                }
            });
        }

        function removeRepo(repoId) {
            if (confirm('Remove this repository?')) {
                fetch('/api/repos/' + repoId, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        alert('Failed to remove repo: ' + data.error);
                    }
                });
            }
        }

        function createGroup() {
            const name = document.getElementById('groupName').value;
            const description = document.getElementById('groupDescription').value;
            const repoIds = [];
            
            document.querySelectorAll('#repoCheckboxes input:checked').forEach(cb => {
                repoIds.push(cb.value);
            });
            
            fetch('/api/groups', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ name, description, repoIds })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Failed to create group: ' + data.error);
                }
            });
        }

        function deleteGroup(groupId) {
            if (confirm('Delete this group?')) {
                fetch('/api/groups/' + groupId, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        alert('Failed to delete group: ' + data.error);
                    }
                });
            }
        }

        function viewRepo(repoId) {
            window.location.href = '/repo/' + repoId;
        }

        function viewGroup(groupId) {
            window.location.href = '/group/' + groupId;
        }
    </script>
</body>
</html>`;
    }

    static generateHTML(data, options = {}) {
        const { repoList = [], currentIndex = 0, groups = [], currentGroup = null, comparisonTargets = [], ungroupedRepos = [] } = options;
        const hasMultiple = repoList.length > 1;
        const hasGroups = groups.length > 0;
        const monthlyData = data.commitsByMonth;
        const yearlyData = data.yearlySummary;
        const packData = data.packAnalysis || null;

        const monthlyKeys = Object.keys(monthlyData).sort();
        const yearlyKeys = Object.keys(yearlyData).sort();

        const maxMonthlyCommits = Math.max(...monthlyKeys.map(key => monthlyData[key].commitCount), 1);
        const maxYearlyCommits = Math.max(...yearlyKeys.map(key => yearlyData[key].commitCount), 1);

        const packSizeData = packData?.['Total Size Analyzer'] || {};
        const packLocData = packData?.['Lines of Code Analyzer'] || {};
        const packArchiveData = packData?.['Archive Files Analyzer'] || {};
        const packBinaryData = packData?.['Binary Files Analyzer'] || {};
        const packPkgData = packData?.['Package.json Analyzer'] || {};
        const packGitData = packData?.['Git Analyzer'] || {};

        const languages = packLocData.languages || [];

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

        .nav-bar {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            align-items: center;
        }

        .nav-link {
            color: var(--accent);
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid var(--border);
            border-radius: 6px;
            transition: all 0.3s;
            cursor: pointer;
            background: var(--bg-secondary);
        }

        .nav-link:hover {
            background: var(--bg-tertiary);
        }

        .nav-link.active {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
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
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
            flex-wrap: wrap;
            gap: 10px;
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
            overflow: visible;
        }

        .chart-bars {
            display: flex;
            align-items: flex-end;
            height: 300px;
            gap: 2px;
            padding: 10px;
            position: relative;
            overflow-x: auto;
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

        .author-email {
            color: var(--text-secondary);
            font-size: 11px;
            margin-bottom: 8px;
        }

        .author-stats {
            color: var(--text-secondary);
            font-size: 12px;
            margin-top: 5px;
        }

        .pack-info {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .pack-info h2 {
            color: var(--accent);
            margin-bottom: 15px;
        }

        .pack-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .pack-item {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 15px;
        }

        .pack-item h4 {
            color: var(--accent);
            margin-bottom: 8px;
            font-size: 13px;
        }

        .pack-item p {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .language-breakdown {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .language-breakdown h2 {
            color: var(--accent);
            margin-bottom: 15px;
        }

        .language-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
        }

        .language-item {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 15px;
        }

        .language-name {
            color: var(--accent);
            font-weight: bold;
            margin-bottom: 8px;
        }

        .language-stats {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .language-bar {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 4px;
            height: 8px;
            margin-top: 8px;
            overflow: hidden;
        }

        .language-bar-fill {
            background: var(--accent);
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
            background: var(--bg-secondary);
            margin: 5% auto;
            padding: 20px;
            border: 1px solid var(--border);
            border-radius: 8px;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .close {
            color: var(--text-secondary);
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .close:hover {
            color: var(--text-primary);
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: var(--text-secondary);
        }

        .form-group input, .form-group textarea, .form-group select {
            width: 100%;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
        }

        .btn {
            padding: 8px 16px;
            border: 1px solid var(--border);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-primary {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
        }

        .btn-danger {
            background: var(--danger);
            color: var(--bg-primary);
            border-color: var(--danger);
        }

        .btn-success {
            background: var(--success);
            color: var(--bg-primary);
            border-color: var(--success);
        }

        .repo-checkbox-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px;
        }

        .repo-checkbox-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-bottom: 1px solid var(--border);
        }

        .repo-checkbox-item:last-child {
            border-bottom: none;
        }

        .repo-checkbox-item input[type="checkbox"] {
            width: auto;
        }

        .repo-checkbox-item label {
            margin: 0;
            color: var(--text-primary);
            cursor: pointer;
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
        <div class="nav-bar fade-in">
            <a href="/dashboard" class="nav-link">🏠 Dashboard</a>
            ${hasMultiple ? `<a href="/compare" class="nav-link">🔍 Comparison</a>` : ''}
            <button class="nav-link" onclick="openGroupsModal()">📦 Groups</button>
            <button class="nav-link" onclick="openNewGroupModal()">➕ New Group</button>
            ${comparisonTargets.length > 0 ? `<button class="nav-link" onclick="openCompareModal()">⚖️ Compare With</button>` : ''}
        </div>

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

        ${languages.length > 0 ? `
        <div class="language-breakdown fade-in">
            <h2>📊 Language Breakdown (Lines of Code)</h2>
            <div class="language-list">
                ${languages.map(lang => `
                <div class="language-item">
                    <div class="language-name">${lang.language} (${lang.percentage}%)</div>
                    <div class="language-stats">
                        <div>${lang.lines.toLocaleString()} lines</div>
                        <div>${lang.files} files</div>
                    </div>
                    <div class="language-bar">
                        <div class="language-bar-fill" style="width: ${lang.percentage}%"></div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${packData ? `
        <div class="pack-info fade-in">
            <h2>📦 Complete Package Analysis (from Pack.js)</h2>
            <div class="pack-grid">
                <div class="pack-item">
                    <h4>💾 REAL Total Size</h4>
                    <p>${packSizeData.realTotalSizeFormatted || 'N/A'} (${packSizeData.realTotalSizeMB || '0'} MB)</p>
                </div>
                <div class="pack-item">
                    <h4>📁 Analyzed Size</h4>
                    <p>${packSizeData.totalSizeFormatted || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>📝 Pure Code Size</h4>
                    <p>${packSizeData.codeSizeFormatted || 'N/A'} (${packSizeData.codeSizeMB || '0'} MB)</p>
                </div>
                <div class="pack-item">
                    <h4>💾 Binary Files</h4>
                    <p>${packSizeData.binarySizeFormatted || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>📦 Archive Files</h4>
                    <p>${packSizeData.archiveSizeFormatted || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>🔧 .git Directory</h4>
                    <p>${packSizeData.gitSizeFormatted || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>💎 Code Purity Rate</h4>
                    <p>${packSizeData.codePurityRate || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>⚡ Repository Efficiency</h4>
                    <p>${packSizeData.repositoryEfficiencyRate || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>📊 Total Lines of Code</h4>
                    <p>${packLocData.totalLinesFormatted || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>🔀 Git Contributors (Deduped)</h4>
                    <p>${packGitData.totalUniqueContributors || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>📦 Git Repositories</h4>
                    <p>${packGitData.totalRepositories || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>📝 Total Commits (Pack)</h4>
                    <p>${packGitData.totalCommits || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>📊 Pure Code Added</h4>
                    <p>${packGitData.totalPureCodeAddedFormatted || 'N/A'}</p>
                </div>
                <div class="pack-item">
                    <h4>⚡ Avg Pure Code/Commit</h4>
                    <p>${packGitData.averagePureCodeAddedPerCommitFormatted || 'N/A'}</p>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="chart-container fade-in">
            <div class="chart-header">
                <h2 class="chart-title">📈 Commit Activity</h2>
                <div class="view-toggle">
                    <button class="toggle-btn active" onclick="switchView('month')">Monthly</button>
                    ${yearlyKeys.length > 1 ? '<button class="toggle-btn" onclick="switchView(\'year\')">Yearly</button>' : ''}
                </div>
            </div>
            <div class="chart" id="commitChart">
                <div class="chart-bars" id="monthlyBars">
                    ${monthlyKeys.map(key => {
                        const dataPoint = monthlyData[key];
                        return `
                        <div class="chart-bar month-view" 
                             style="height: ${Math.max(5, (dataPoint.commitCount / maxMonthlyCommits) * 250)}px"
                             data-period="${key}"
                             data-commits="${dataPoint.commitCount}"
                             data-authors="${dataPoint.authorsCount}"
                             data-insertions="${dataPoint.insertions}"
                             data-deletions="${dataPoint.deletions}"
                             onmouseenter="showTooltip(event, this)"
                             onmouseleave="hideTooltip()">
                            <div class="chart-bar-value">${dataPoint.commitCount}</div>
                            <div class="chart-bar-label">${key}</div>
                        </div>`;
                    }).join('')}
                </div>
                ${yearlyKeys.length > 1 ? `
                <div class="chart-bars" id="yearlyBars" style="display: none;">
                    ${yearlyKeys.map(year => {
                        const dataPoint = yearlyData[year];
                        return `
                        <div class="chart-bar year-view" 
                             style="height: ${Math.max(5, (dataPoint.commitCount / maxYearlyCommits) * 250)}px"
                             data-period="${year}"
                             data-commits="${dataPoint.commitCount}"
                             data-authors="${dataPoint.authorsCount}"
                             data-insertions="${dataPoint.insertions}"
                             data-deletions="${dataPoint.deletions}"
                             onmouseenter="showTooltip(event, this)"
                             onmouseleave="hideTooltip()">
                            <div class="chart-bar-value">${dataPoint.commitCount}</div>
                            <div class="chart-bar-label">${year}</div>
                        </div>`;
                    }).join('')}
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
                    <span class="commit-hash">${commit.shortHash}${commit.repoName ? ` - ${commit.repoName}` : ''}</span>
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
            <h2 style="color: var(--accent); margin-bottom: 20px;">👥 Contributors (Deduplicated by Email)</h2>
            <div class="author-list">
                ${data.authors.sort((a, b) => b.commits - a.commits).slice(0, 15).map(author => `
                    <div class="author-card">
                        <div class="author-name">${author.name}</div>
                        <div class="author-email">${author.email}</div>
                        <div class="author-stats">
                            <div>Commits: ${author.commits}</div>
                            <div>Lines Added: +${author.insertions}</div>
                            <div>Lines Removed: -${author.deletions}</div>
                            <div>Active: ${new Date(author.firstCommit).getFullYear()} - ${new Date(author.lastCommit).getFullYear()}</div>
                            ${author.repos ? `<div>Repos: ${author.repos.join(', ')}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- Groups Modal -->
    <div id="groupsModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📦 Groups</h2>
                <span class="close" onclick="closeGroupsModal()">&times;</span>
            </div>
            <div id="groupsList">
                ${groups.map(group => `
                    <div class="info-card" style="margin-bottom: 10px;">
                        <h3>${group.name}</h3>
                        <p>${group.description || 'No description'}</p>
                        <p>Repositories: ${group.repos.length}</p>
                        <button class="btn btn-primary" onclick="loadGroup('${group.name}')">Load</button>
                        <button class="btn btn-danger" onclick="deleteGroup('${group.name}')">Delete</button>
                    </div>
                `).join('')}
                ${groups.length === 0 ? '<p style="text-align: center; color: var(--text-secondary);">No groups yet. Create one!</p>' : ''}
            </div>
        </div>
    </div>

    <!-- New Group Modal -->
    <div id="newGroupModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>➕ Create New Group</h2>
                <span class="close" onclick="closeNewGroupModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Group Name</label>
                <input type="text" id="groupName" placeholder="My Group">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="groupDescription" placeholder="Optional description"></textarea>
            </div>
            <div class="form-group">
                <label>Select repositories to add (moved from ungrouped)</label>
                <div class="repo-checkbox-list">
                    ${ungroupedRepos.map(repo => `
                        <div class="repo-checkbox-item">
                            <input type="checkbox" id="repo-${repo.index}" value="${repo.path}">
                            <label for="repo-${repo.index}">${repo.name}</label>
                        </div>
                    `).join('')}
                    ${ungroupedRepos.length === 0 ? '<p style="color: var(--text-secondary);">No ungrouped repositories available</p>' : ''}
                </div>
            </div>
            <button class="btn btn-primary" onclick="createGroup()">Create Group</button>
        </div>
    </div>

    <!-- Compare Modal -->
    <div id="compareModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>⚖️ Compare With</h2>
                <span class="close" onclick="closeCompareModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Select repository or group to compare with</label>
                <select id="compareTarget">
                    ${comparisonTargets.map(target => `<option value="${target.type}:${target.name}">${target.type === 'group' ? '📦' : '📁'} ${target.name}</option>`).join('')}
                </select>
            </div>
            <button class="btn btn-primary" onclick="compareWith()">Compare</button>
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
            const chart = document.getElementById('commitChart');
            const chartRect = chart.getBoundingClientRect();
            const barRect = element.getBoundingClientRect();
            
            document.getElementById('tooltipTitle').textContent = element.dataset.period;
            document.getElementById('tooltipCommits').textContent = element.dataset.commits;
            document.getElementById('tooltipAuthors').textContent = element.dataset.authors;
            document.getElementById('tooltipInsertions').textContent = '+' + element.dataset.insertions;
            document.getElementById('tooltipDeletions').textContent = '-' + element.dataset.deletions;
            
            tooltip.classList.add('visible');
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            
            let left = barRect.left - chartRect.left + barRect.width / 2 - tooltipWidth / 2;
            left = Math.max(0, Math.min(left, chartRect.width - tooltipWidth));
            
            let top = barRect.top - chartRect.top - tooltipHeight - 10;
            if (top < 0) {
                top = barRect.bottom - chartRect.top + 10;
            }
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }

        function hideTooltip() {
            document.getElementById('tooltip').classList.remove('visible');
        }

        function openGroupsModal() {
            document.getElementById('groupsModal').style.display = 'block';
        }

        function closeGroupsModal() {
            document.getElementById('groupsModal').style.display = 'none';
        }

        function openNewGroupModal() {
            document.getElementById('newGroupModal').style.display = 'block';
        }

        function closeNewGroupModal() {
            document.getElementById('newGroupModal').style.display = 'none';
        }

        function openCompareModal() {
            document.getElementById('compareModal').style.display = 'block';
        }

        function closeCompareModal() {
            document.getElementById('compareModal').style.display = 'none';
        }

        function loadGroup(groupName) {
            window.location.href = '/group/' + encodeURIComponent(groupName);
        }

        function deleteGroup(groupName) {
            if (confirm('Are you sure you want to delete group "' + groupName + '"?')) {
                fetch('/api/groups/' + encodeURIComponent(groupName), { method: 'DELETE' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            location.reload();
                        } else {
                            alert('Failed to delete group: ' + data.error);
                        }
                    })
                    .catch(error => {
                        alert('Error deleting group: ' + error.message);
                    });
            }
        }

        function createGroup() {
            const name = document.getElementById('groupName').value.trim();
            const description = document.getElementById('groupDescription').value.trim();
            
            if (!name) {
                alert('Please enter a group name');
                return;
            }

            const selectedRepos = [];
            document.querySelectorAll('.repo-checkbox-item input[type="checkbox"]:checked').forEach(checkbox => {
                selectedRepos.push(checkbox.value);
            });
            
            if (selectedRepos.length === 0) {
                alert('Please select at least one repository');
                return;
            }

            fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, repos: selectedRepos })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    closeNewGroupModal();
                    location.reload();
                } else {
                    alert('Failed to create group: ' + data.error);
                }
            })
            .catch(error => {
                alert('Error creating group: ' + error.message);
            });
        }

        function compareWith() {
            const target = document.getElementById('compareTarget').value;
            const [type, name] = target.split(':');
            if (type === 'group') {
                window.location.href = '/group/' + encodeURIComponent(name);
            } else {
                window.location.href = '/view?repo=' + name;
            }
        }
    </script>
</body>
</html>`;
    }

    static generateComparisonHTML(repoDataList, packComparison) {
        const repos = repoDataList.filter(r => r.data);
        if (repos.length < 2) return '<html><body>Need at least 2 repos for comparison</body></html>';

        const packMetrics = {};
        if (packComparison) {
            repos.forEach(repo => {
                const packData = repo.data.packAnalysis;
                if (packData) {
                    packMetrics[repo.name] = {
                        realTotalSize: packData['Total Size Analyzer']?.realTotalSizeFormatted || 'N/A',
                        totalSize: packData['Total Size Analyzer']?.totalSizeFormatted || 'N/A',
                        codeSize: packData['Total Size Analyzer']?.codeSizeFormatted || 'N/A',
                        binarySize: packData['Total Size Analyzer']?.binarySizeFormatted || 'N/A',
                        archiveSize: packData['Total Size Analyzer']?.archiveSizeFormatted || 'N/A',
                        gitSize: packData['Total Size Analyzer']?.gitSizeFormatted || 'N/A',
                        codePurity: packData['Total Size Analyzer']?.codePurityRate || 'N/A',
                        repoEfficiency: packData['Total Size Analyzer']?.repositoryEfficiencyRate || 'N/A',
                        totalLines: packData['Lines of Code Analyzer']?.totalLinesFormatted || 'N/A',
                        uniqueContributors: packData['Git Analyzer']?.totalUniqueContributors || 'N/A',
                        totalCommits: packData['Git Analyzer']?.totalCommits || 'N/A',
                        totalRepos: packData['Git Analyzer']?.totalRepositories || 'N/A',
                        fileCount: packData['Total Size Analyzer']?.fileCount || 'N/A',
                        dirCount: packData['Total Size Analyzer']?.dirCount || 'N/A',
                        binaryFiles: packData['Binary Files Analyzer']?.totalCount || 'N/A',
                        archiveFiles: packData['Archive Files Analyzer']?.totalCount || 'N/A',
                        pureCodeAdded: packData['Git Analyzer']?.totalPureCodeAddedFormatted || 'N/A',
                        avgPureCodePerCommit: packData['Git Analyzer']?.averagePureCodeAddedPerCommitFormatted || 'N/A',
                        languages: packData['Lines of Code Analyzer']?.languages || []
                    };
                }
            });
        }

        const allLanguages = new Set();
        repos.forEach(repo => {
            const languages = packMetrics[repo.name]?.languages || [];
            languages.forEach(lang => allLanguages.add(lang.language));
        });

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitView - Comparison</title>
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

        .nav-bar {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            align-items: center;
        }

        .nav-link {
            color: var(--accent);
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid var(--border);
            border-radius: 6px;
            transition: all 0.3s;
            cursor: pointer;
        }

        .nav-link:hover {
            background: var(--bg-tertiary);
        }

        .nav-link.active {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
        }

        .comparison-table {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: auto;
            margin-bottom: 20px;
            max-height: 80vh;
            position: relative;
        }

        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
        }

        thead {
            position: sticky;
            top: 0;
            z-index: 10;
        }

        th {
            background: var(--bg-tertiary);
            color: var(--accent);
            font-weight: bold;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid var(--border);
            position: sticky;
            top: 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        th:first-child {
            left: 0;
            z-index: 11;
            background: var(--bg-secondary);
        }

        td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }

        td:first-child {
            position: sticky;
            left: 0;
            background: var(--bg-secondary);
            z-index: 5;
            font-weight: bold;
        }

        tr:hover td {
            background: var(--bg-tertiary);
        }

        tr:hover td:first-child {
            background: var(--bg-secondary);
        }

        .winner {
            color: var(--success);
            font-weight: bold;
        }

        .section-header td {
            background: var(--accent);
            color: var(--bg-primary);
            font-weight: bold;
            position: sticky;
            top: 49px;
            z-index: 9;
        }

        .section-header td:first-child {
            background: var(--accent);
            color: var(--bg-primary);
            z-index: 12;
            top: 49px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav-bar">
            <a href="/dashboard" class="nav-link">🏠 Dashboard</a>
            <a href="/view?repo=0" class="nav-link">📊 Single View</a>
            <a href="/compare" class="nav-link active">🔍 Comparison</a>
        </div>

        <div class="header">
            <h1>🔍 Repository Comparison</h1>
            <p style="color: var(--text-secondary);">Comparing ${repos.length} repositories/groups</p>
        </div>

        <div class="comparison-table">
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        ${repos.map(r => `<th>${r.name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr class="section-header">
                        <td colspan="${repos.length + 1}">Git Metrics</td>
                    </tr>
                    <tr>
                        <td>Total Commits</td>
                        ${repos.map(r => `<td class="${r.data.health.totalCommits === Math.max(...repos.map(x => x.data.health.totalCommits)) ? 'winner' : ''}">${r.data.health.totalCommits}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Contributors</td>
                        ${repos.map(r => `<td class="${r.data.authors.length === Math.max(...repos.map(x => x.data.authors.length)) ? 'winner' : ''}">${r.data.authors.length}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Branches</td>
                        ${repos.map(r => `<td class="${r.data.branches.length === Math.max(...repos.map(x => x.data.branches.length)) ? 'winner' : ''}">${r.data.branches.length}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Tags</td>
                        ${repos.map(r => `<td class="${r.data.tags.length === Math.max(...repos.map(x => x.data.tags.length)) ? 'winner' : ''}">${r.data.tags.length}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Files</td>
                        ${repos.map(r => `<td class="${r.data.health.totalFiles === Math.max(...repos.map(x => x.data.health.totalFiles)) ? 'winner' : ''}">${r.data.health.totalFiles}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Active Days</td>
                        ${repos.map(r => `<td class="${r.data.health.daysActive === Math.max(...repos.map(x => x.data.health.daysActive)) ? 'winner' : ''}">${r.data.health.daysActive}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Total Insertions</td>
                        ${repos.map(r => {
                            const total = r.data.authors.reduce((sum, a) => sum + a.insertions, 0);
                            return `<td>${total.toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                    <tr>
                        <td>Total Deletions</td>
                        ${repos.map(r => {
                            const total = r.data.authors.reduce((sum, a) => sum + a.deletions, 0);
                            return `<td>${total.toLocaleString()}</td>`;
                        }).join('')}
                    </tr>

                    ${packComparison ? `
                    <tr class="section-header">
                        <td colspan="${repos.length + 1}">Pack.js Metrics</td>
                    </tr>
                    <tr>
                        <td>Real Total Size</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.realTotalSize || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Analyzed Size</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.totalSize || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Code Size</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.codeSize || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Binary Size</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.binarySize || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Archive Size</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.archiveSize || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Code Purity Rate</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.codePurity || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Repository Efficiency</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.repoEfficiency || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Total Lines of Code</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.totalLines || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Unique Contributors (Pack)</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.uniqueContributors || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Binary Files</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.binaryFiles || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Archive Files</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.archiveFiles || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Pure Code Added</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.pureCodeAdded || 'N/A'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td>Avg Pure Code/Commit</td>
                        ${repos.map(r => `<td>${packMetrics[r.name]?.avgPureCodePerCommit || 'N/A'}</td>`).join('')}
                    </tr>
                    ` : ''}

                    ${packComparison && allLanguages.size > 0 ? `
                    <tr class="section-header">
                        <td colspan="${repos.length + 1}">Language Lines Breakdown</td>
                    </tr>
                    ${Array.from(allLanguages).sort().map(language => `
                    <tr>
                        <td>${language}</td>
                        ${repos.map(r => {
                            const langData = (packMetrics[r.name]?.languages || []).find(l => l.language === language);
                            return `<td>${langData ? langData.lines.toLocaleString() + ' lines (' + langData.percentage + '%)' : '-'}</td>`;
                        }).join('')}
                    </tr>
                    `).join('')}
                    ` : ''}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
    }
}

// ============================================================================
// WEB SERVER WITH AUTHENTICATION
// ============================================================================

class GitViewServer {
    constructor(port = 8080) {
        this.port = port;
        this.server = null;
        this.dbManager = new DatabaseManager();
        this.authManager = new AuthManager(this.dbManager);
        this.repoManager = new RepositoryManager(this.dbManager, this.authManager);
        this.groupManager = new GroupManager(this.dbManager, this.authManager);
        this.cacheManager = new CacheManager();
        this.workerPath = this.prepareWorkerFile();
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

    parseCookies(req) {
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) return {};
        
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, ...value] = cookie.trim().split('=');
            cookies[name] = value.join('=');
        });
        
        return cookies;
    }

    getAuthToken(req) {
        // Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        
        // Check cookies
        const cookies = this.parseCookies(req);
        return cookies.gitview_token || null;
    }

    sendJSON(res, statusCode, data) {
        res.writeHead(statusCode, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end(JSON.stringify(data, null, 2));
    }

    sendHTML(res, html) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }

    async analyzeRepoData(repoPath) {
        try {
            const gitView = new GitView(repoPath);
            const gitData = gitView.getAllData();
            
            let packAnalysis = null;
            try {
                const packResult = await analyzeDirectories(repoPath);
                packAnalysis = packResult.report || packResult;
            } catch (error) {
                console.error(`Pack analysis failed for ${repoPath}: ${error.message}`);
            }
            
            return {
                ...gitData,
                packAnalysis,
                repository: {
                    ...gitData.repository,
                    currentCommit: gitView.executeGitOptional(['rev-parse', 'HEAD'])
                }
            };
        } catch (error) {
            console.error(`Failed to analyze ${repoPath}: ${error.message}`);
            return null;
        }
    }

    start() {
        this.server = http.createServer(async (req, res) => {
            const parsedUrl = parseUrl(req.url, true);
            const pathname = parsedUrl.pathname;
            const method = req.method;
            
            // Handle CORS preflight
            if (method === 'OPTIONS') {
                this.sendJSON(res, 200, {});
                return;
            }
            
            // Public routes
            if (pathname === '/login' && method === 'GET') {
                this.sendHTML(res, HTMLGenerator.generateLoginPage());
                return;
            }
            
            if (pathname === '/register' && method === 'GET') {
                this.sendHTML(res, HTMLGenerator.generateRegisterPage());
                return;
            }
            
            // Auth API routes
            if (pathname === '/api/auth/register' && method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const result = this.authManager.register(data.email, data.password, data.name);
                        this.sendJSON(res, result.success ? 200 : 400, result);
                    } catch (error) {
                        this.sendJSON(res, 400, { success: false, error: error.message });
                    }
                });
                return;
            }
            
            if (pathname === '/api/auth/login' && method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const result = this.authManager.login(data.email, data.password);
                        this.sendJSON(res, result.success ? 200 : 401, result);
                    } catch (error) {
                        this.sendJSON(res, 400, { success: false, error: error.message });
                    }
                });
                return;
            }
            
            if (pathname === '/api/auth/logout' && method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const result = this.authManager.logout(data.token);
                        this.sendJSON(res, 200, result);
                    } catch (error) {
                        this.sendJSON(res, 400, { success: false, error: error.message });
                    }
                });
                return;
            }
            
            // Protected routes - require authentication
            const token = this.getAuthToken(req);
            const session = this.authManager.validateSession(token);
            
            if (!session) {
                if (pathname.startsWith('/api/')) {
                    this.sendJSON(res, 401, { success: false, error: 'Authentication required' });
                } else {
                    res.writeHead(302, { 'Location': '/login' });
                    res.end();
                }
                return;
            }
            
            const user = this.authManager.getUserById(session.userId);
            
            // Dashboard
            if (pathname === '/dashboard' && method === 'GET') {
                const repos = this.repoManager.getUserRepos(user.id);
                const groups = this.groupManager.getUserGroups(user.id);
                this.sendHTML(res, HTMLGenerator.generateDashboard(user, repos, groups));
                return;
            }
            
            // Repository API
            if (pathname === '/api/repos' && method === 'GET') {
                const repos = this.repoManager.getUserRepos(user.id);
                this.sendJSON(res, 200, { success: true, repos });
                return;
            }
            
            if (pathname === '/api/repos' && method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const result = this.repoManager.addRepository(token, data.path, data.name, data.description);
                        this.sendJSON(res, result.success ? 200 : 400, result);
                    } catch (error) {
                        this.sendJSON(res, 400, { success: false, error: error.message });
                    }
                });
                return;
            }
            
            if (pathname.startsWith('/api/repos/') && method === 'DELETE') {
                const repoId = pathname.replace('/api/repos/', '');
                const result = this.repoManager.removeRepository(token, repoId);
                this.sendJSON(res, result.success ? 200 : 400, result);
                return;
            }
            
            // View repo
            if (pathname.startsWith('/repo/') && method === 'GET') {
                const repoId = pathname.replace('/repo/', '');
                const repo = this.repoManager.getRepoById(repoId);
                
                if (!repo) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Repository not found');
                    return;
                }
                
                const data = await this.repoManager.analyzeRepo(repoId);
                if (!data) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Failed to analyze repository');
                    return;
                }
                
                const options = {
                    repoList: [{ name: repo.name, path: repo.path, index: 0 }],
                    currentIndex: 0,
                    groups: this.groupManager.getUserGroups(user.id),
                    currentGroup: null,
                    comparisonTargets: [],
                    ungroupedRepos: []
                };
                
                this.sendHTML(res, HTMLGenerator.generateHTML(data, options));
                return;
            }
            
            // Group API
            if (pathname === '/api/groups' && method === 'GET') {
                const groups = this.groupManager.getUserGroups(user.id);
                this.sendJSON(res, 200, { success: true, groups });
                return;
            }
            
            if (pathname === '/api/groups' && method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const result = this.groupManager.createGroup(token, data.name, data.description, data.repoIds);
                        this.sendJSON(res, result.success ? 200 : 400, result);
                    } catch (error) {
                        this.sendJSON(res, 400, { success: false, error: error.message });
                    }
                });
                return;
            }
            
            if (pathname.startsWith('/api/groups/') && method === 'DELETE') {
                const groupId = pathname.replace('/api/groups/', '');
                const result = this.groupManager.deleteGroup(token, groupId);
                this.sendJSON(res, result.success ? 200 : 400, result);
                return;
            }
            
            // View group
            if (pathname.startsWith('/group/') && method === 'GET') {
                const groupId = pathname.replace('/group/', '');
                const group = this.groupManager.getGroupById(groupId);
                
                if (!group) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Group not found');
                    return;
                }
                
                const repoDataList = [];
                for (const repoId of group.repoIds) {
                    const repo = this.repoManager.getRepoById(repoId);
                    if (repo) {
                        const data = await this.repoManager.analyzeRepo(repoId);
                        if (data) {
                            repoDataList.push({ path: repo.path, name: repo.name, data });
                        }
                    }
                }
                
                if (repoDataList.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('No valid repositories in group');
                    return;
                }
                
                const aggregatedData = await GroupAnalyzer.analyzeGroupWithPack(repoDataList);
                if (!aggregatedData) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Failed to aggregate group data');
                    return;
                }
                
                const options = {
                    repoList: repoDataList.map((r, i) => ({ name: r.name, path: r.path, index: i })),
                    currentIndex: 0,
                    groups: this.groupManager.getUserGroups(user.id),
                    currentGroup: group.name,
                    comparisonTargets: [],
                    ungroupedRepos: []
                };
                
                this.sendHTML(res, HTMLGenerator.generateHTML(aggregatedData, options));
                return;
            }
            
            // Admin management routes (still require auth)
            if (pathname === '/api/admin/logs' && method === 'GET') {
                const logsData = this.dbManager.loadLogs();
                this.sendJSON(res, 200, { success: true, logs: logsData.logs.slice(0, 50) });
                return;
            }
            
            if (pathname === '/api/admin/logs/clear' && method === 'POST') {
                this.dbManager.clearLogs();
                this.sendJSON(res, 200, { success: true });
                return;
            }
            
            if (pathname === '/api/admin/logging/toggle' && method === 'POST') {
                const status = this.dbManager.toggleLogging();
                this.sendJSON(res, 200, { success: true, loggingEnabled: status });
                return;
            }
            
            // Default route
            res.writeHead(302, { 'Location': '/dashboard' });
            res.end();
        });
        
        this.server.listen(this.port, () => {
            console.log(`\n🚀 GitView server is running at: http://localhost:${this.port}`);
            console.log(`📝 Register: http://localhost:${this.port}/register`);
            console.log(`🔐 Login: http://localhost:${this.port}/login`);
            console.log(`📊 Dashboard: http://localhost:${this.port}/dashboard`);
            console.log(`\n📦 Database: ${this.dbManager.dbFile}`);
            console.log(`📋 Logs: ${this.dbManager.logsFile}`);
            console.log(`🔍 Logging: ${this.dbManager.getLoggingStatus() ? 'ENABLED' : 'DISABLED'}`);
            console.log(`\nPress Ctrl+C to stop the server\n`);
        });
        
        return this.server;
    }
    
    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

// ============================================================================
// UTILITY: FIND GIT REPOSITORIES IN DIRECTORY (Preserved from original)
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
            return;
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
// MAIN APPLICATION (Enhanced with management commands)
// ============================================================================

class GitViewApp {
    constructor() {
        this.parser = new ArgumentParser();
        this.dbManager = new DatabaseManager();
        this.run();
    }

    async run() {
        if (this.parser.args.help) {
            this.parser.showHelp();
            return;
        }

        try {
            // Handle management commands
            if (this.parser.args.clearDB) {
                this.dbManager.clearAll();
                console.log('✅ Database cleared successfully');
                return;
            }
            
            if (this.parser.args.clearLogs) {
                this.dbManager.clearLogs();
                console.log('✅ Logs cleared successfully');
                return;
            }
            
            if (this.parser.args.toggleLogging) {
                const status = this.dbManager.toggleLogging();
                console.log(`✅ Logging ${status ? 'ENABLED' : 'DISABLED'}`);
                return;
            }
            
            if (this.parser.args.showLogs) {
                const logsData = this.dbManager.loadLogs();
                console.log('\n📋 Recent Logs:');
                if (logsData.logs.length === 0) {
                    console.log('  No logs found');
                } else {
                    logsData.logs.slice(0, 20).forEach(log => {
                        console.log(`  [${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`);
                        if (Object.keys(log.metadata).length > 0) {
                            console.log(`    Metadata: ${JSON.stringify(log.metadata)}`);
                        }
                    });
                }
                return;
            }
            
            if (this.parser.args.listUsers) {
                const db = this.dbManager.loadDB();
                console.log('\n👥 Registered Users:');
                if (db.users.length === 0) {
                    console.log('  No users registered');
                } else {
                    db.users.forEach(user => {
                        console.log(`  - ${user.name} (${user.email}) - ID: ${user.id}`);
                        console.log(`    Created: ${user.createdAt}`);
                    });
                }
                return;
            }
            
            if (this.parser.args.listRepos) {
                const db = this.dbManager.loadDB();
                console.log('\n📁 Registered Repositories:');
                if (db.repos.length === 0) {
                    console.log('  No repositories registered');
                } else {
                    db.repos.forEach(repo => {
                        const owner = db.users.find(u => u.id === repo.ownerId);
                        console.log(`  - ${repo.name} (${repo.path})`);
                        console.log(`    Owner: ${owner ? owner.name : 'Unknown'} (${owner ? owner.email : 'N/A'})`);
                        console.log(`    Public: ${repo.isPublic}`);
                    });
                }
                return;
            }
            
            // Start server
            if (this.parser.args.server) {
                const server = new GitViewServer(this.parser.args.port);
                server.start();
                return;
            }
            
            // Generate static HTML
            if (this.parser.args.html) {
                const repoPath = this.parser.args.repoPath;
                console.log(`📊 Analyzing ${path.basename(repoPath)}...`);
                
                const gitView = new GitView(repoPath);
                const gitData = gitView.getAllData();
                
                let packAnalysis = null;
                try {
                    const packResult = await analyzeDirectories(repoPath);
                    packAnalysis = packResult.report || packResult;
                } catch (error) {
                    console.error(`Pack analysis failed: ${error.message}`);
                }
                
                const fullData = {
                    ...gitData,
                    packAnalysis,
                    repository: {
                        ...gitData.repository,
                        currentCommit: gitView.executeGitOptional(['rev-parse', 'HEAD'])
                    }
                };
                
                const html = HTMLGenerator.generateHTML(fullData, {
                    repoList: [{ name: path.basename(repoPath), path: repoPath, index: 0 }],
                    currentIndex: 0,
                    groups: [],
                    ungroupedRepos: []
                });
                
                const outputPath = path.join(process.cwd(), 'gitview.html');
                fs.writeFileSync(outputPath, html, 'utf8');
                console.log(`✅ Generated: ${outputPath}`);
                return;
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

export { 
    GitView, 
    GitViewServer, 
    HTMLGenerator, 
    LoadingPageGenerator, 
    ArgumentParser, 
    CacheManager, 
    DatabaseManager,
    AuthManager,
    RepositoryManager,
    GroupManager,
    findGitRepos,
    GroupAnalyzer,
    analyzeDirectories
};

// Auto-start if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    new GitViewApp();
}