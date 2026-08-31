#!/usr/bin/env node

/**
 * shinstall.js – Modular install.sh generator
 * Enhanced version with comprehensive testing and modular architecture
 * 
 * TESTING GUIDE:
 * To run tests: node shinstall.js --test
 * 
 * FOR NEW MODULES:
 * 1. Add your feature to the 'features' array
 * 2. Create the feature snippet generator function (e.g., yourFeatureSnippet)
 * 3. Add feature initialization call in generateInstallSh if needed
 * 4. Create a test method in TestSuite class: test[FeatureName]()
 * 5. Add the test call in the runAllTests() method
 * 6. Test your feature with: node shinstall.js --test
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { promisify } from 'util';
import { execSync } from 'child_process';

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

// ==================== CONFIGURATION DEFAULTS ====================
const DEFAULTS = {
  projectName: 'MyApp',
  installDir: '/usr/local/etc/MyApp',
  binDir: '/usr/local/bin',
  repoDir: process.cwd(),
  mainSourceDir: '.',
  mainEntryPointSrc: 'app.js',
  mainEntryPointCmd: 'myapp',
  additionalToolSrc: '',
  additionalToolCmd: '',
  shellScriptsSrc: '',
  shellScriptsCmd: '',
  postInstallScripts: '',
  preservationWhitelist: '',
  enableBuild: false,
  enableDebInstall: false,
  enablePm2Extract: false,
  enablePkgCli: false,
  enableWsave: false,
  enableGitConfig: false,
  enableShellFallback: false,
  enableOldWrapper: false,
  oldScriptPath: null
};

// ==================== FEATURE DEFINITIONS ====================
const features = [
  {
    id: 'build',
    name: 'Build system',
    description: 'Include build mode with versioning, exclusions, and save/load configurations.',
    default: false,
    generate: (config) => buildFeatureSnippet(config)
  },
  {
    id: 'debs',
    name: 'Debian package installation',
    description: 'Install .deb packages from local directories.',
    default: false,
    generate: (config) => debInstallFeatureSnippet(config)
  },
  {
    id: 'pm2',
    name: 'PM2 extraction',
    description: 'Extract a bundled PM2 tar.gz archive.',
    default: false,
    generate: (config) => pm2ExtractFeatureSnippet(config)
  },
  {
    id: 'pkgcli',
    name: 'pkg CLI utility',
    description: 'Create a pkg command for managing package.json.',
    default: false,
    generate: (config) => pkgCliFeatureSnippet(config)
  },
  {
    id: 'wsave',
    name: 'wsave permission fixer',
    description: 'Create wsave command to fix VSCode save permissions.',
    default: false,
    generate: (config) => wsaveFeatureSnippet(config)
  },
  {
    id: 'gitconfig',
    name: 'git-config command',
    description: 'Create git-config command to run Git.js setup.',
    default: false,
    generate: (config) => gitConfigFeatureSnippet(config)
  },
  {
    id: 'shellfallback',
    name: 'Shell script bash→ash fallback',
    description: 'Wrap .sh commands with automatic bash→ash fallback.',
    default: false,
    generate: (config) => shellFallbackFeatureSnippet(config)
  },
  {
    id: 'oldwrapper',
    name: 'Old script wrapper',
    description: 'Generate a wrapper to run the old install.sh with --old.',
    default: false,
    generate: (config) => oldWrapperFeatureSnippet(config)
  },
  {
    id: 'onlineinstall',
    name: 'Online dependency installation',
    description: 'Install missing language dependencies when --online is passed.',
    default: true,
    generate: (config) => onlineInstallFeatureSnippet(config)
  }
];

// ==================== FEATURE SNIPPET GENERATORS ====================

function buildFeatureSnippet(config) {
  return `
# =============================================================================
# BUILD SYSTEM (auto-generated)
# =============================================================================
BUILD_MODE=false
BUILD_TAR=false
BUILD_CONFIG=false
BUILD_MESSAGE_MODE=false
BUILD_VERSION=""
BUILD_SAVE_NAME=""
BUILD_DIR="\${REPO_DIR}/build"
BUILD_SAVE_FILE="\${REPO_DIR}/buildsaves.cfg"

do_build() {
    echo "Build functionality is not fully implemented in this generated script."
    echo "Please use the shinstall.js tool to regenerate with full build support."
    exit 0
}
`;
}

function debInstallFeatureSnippet(config) {
  return `
# =============================================================================
# DEBIAN PACKAGE INSTALLATION (auto-generated)
# =============================================================================
SKIP_DEBS=false
DEB_DIR="\${REPO_DIR}/deb-packages"
DEB_SERVER_DIR="\${REPO_DIR}/deb-packages-server"

install_debs() {
    [ "\$SKIP_DEBS" = true ] && return 0
    [ ! -d "\$DEB_DIR" ] && return 0
    echo "Installing .deb packages..."
    find "\$DEB_DIR" -name '*.deb' -exec sudo dpkg -i {} \\;
}
`;
}

function pm2ExtractFeatureSnippet(config) {
  return `
# =============================================================================
# PM2 EXTRACTION (auto-generated)
# =============================================================================
PM2_TAR_GZ="\${REPO_DIR}/archives/pm2.tar.gz"
PM2_EXTRACT_DIR="\${INSTALL_DIR}/vendor/pm2"

extract_pm2() {
    [ -f "\$PM2_TAR_GZ" ] || return 0
    echo "Extracting PM2..."
    mkdir -p "\$PM2_EXTRACT_DIR"
    tar -xzf "\$PM2_TAR_GZ" -C "\$PM2_EXTRACT_DIR" --strip-components=1
}
`;
}

function pkgCliFeatureSnippet(config) {
  return `
# =============================================================================
# PKG CLI UTILITY (auto-generated)
# =============================================================================
create_pkg_cli() {
    echo "Creating pkg CLI utility..."
    cat > "\$INSTALL_DIR/pkg-cli.js" << 'EOF'
#!/usr/bin/env node
console.log("pkg command placeholder");
EOF
    chmod +x "\$INSTALL_DIR/pkg-cli.js"
    ln -sf "\$INSTALL_DIR/pkg-cli.js" "\$BIN_DIR/pkg"
}
`;
}

function wsaveFeatureSnippet(config) {
  return `
# =============================================================================
# WSAVE PERMISSION FIXER (auto-generated)
# =============================================================================
create_wsave() {
    echo "Creating wsave command..."
    cat > "\$INSTALL_DIR/wsave" << 'EOF'
#!/bin/sh
# Fix VSCode save permissions silently
USERNAME="\${SUDO_USER:-\$USER}"
chown -R "\$USERNAME:\$USERNAME" /home >/dev/null 2>&1
chmod -R u+rwX /home >/dev/null 2>&1
EOF
    chmod +x "\$INSTALL_DIR/wsave"
    ln -sf "\$INSTALL_DIR/wsave" "\$BIN_DIR/wsave"
}
`;
}

function gitConfigFeatureSnippet(config) {
  return `
# =============================================================================
# GIT-CONFIG COMMAND (auto-generated)
# =============================================================================
create_git_config() {
    echo "Creating git-config command..."
    mkdir -p "\$INSTALL_DIR/wrappers"
    cat > "\$INSTALL_DIR/wrappers/git-config" << 'EOF'
#!/bin/sh
GIT_JS=\$(find "\$INSTALL_DIR" -name "Git.js" -type f | head -1)
[ -z "\$GIT_JS" ] && { echo "Git.js not found"; exit 1; }
cd "\$INSTALL_DIR"
exec node "\$GIT_JS" --setup "\$@"
EOF
    chmod +x "\$INSTALL_DIR/wrappers/git-config"
    ln -sf "\$INSTALL_DIR/wrappers/git-config" "\$BIN_DIR/git-config"
}
`;
}

function shellFallbackFeatureSnippet(config) {
  return `
# =============================================================================
# SHELL SCRIPT BASH→ASH FALLBACK (auto-generated)
# =============================================================================
SHELL_SCRIPTS_SRC_LIST=""
SHELL_SCRIPTS_CMD_LIST=""

create_shell_commands() {
    echo "Creating shell script wrappers with bash/ash fallback..."
    [ -z "\$SHELL_SCRIPTS_SRC_LIST" ] && return 0
    
    idx=1
    for src in \$SHELL_SCRIPTS_SRC_LIST; do
        cmd=\$(echo "\$SHELL_SCRIPTS_CMD_LIST" | tr ' ' '\\n' | sed -n "\${idx}p")
        [ -z "\$cmd" ] && continue
        
        src_path="\$INSTALL_DIR/\$src"
        if [ ! -f "\$src_path" ]; then
            echo "Warning: Shell script not found: \$src_path"
            idx=\$((idx + 1))
            continue
        fi
        
        chmod +x "\$src_path"
        
        # Create wrapper with bash fallback to ash
        wrapper="\$INSTALL_DIR/wrappers/\$cmd"
        mkdir -p "\$INSTALL_DIR/wrappers"
        
        cat > "\$wrapper" << 'WRAPPER_EOF'
#!/bin/sh
# Wrapper with bash/ash fallback
SCRIPT_PATH="\$src_path"

if command -v bash >/dev/null 2>&1; then
    exec bash "\$SCRIPT_PATH" "\$@"
elif command -v ash >/dev/null 2>&1; then
    exec ash "\$SCRIPT_PATH" "\$@"
else
    exec sh "\$SCRIPT_PATH" "\$@"
fi
WRAPPER_EOF
        
        chmod +x "\$wrapper"
        ln -sf "\$wrapper" "\$BIN_DIR/\$cmd"
        echo "Created shell command: \$cmd -> \$src_path (with bash/ash fallback)"
        
        idx=\$((idx + 1))
    done
}

# Helper function to check shell availability
check_shell_fallback() {
    if command -v bash >/dev/null 2>&1; then
        echo "bash available - using bash"
        return 0
    elif command -v ash >/dev/null 2>&1; then
        echo "bash not found - falling back to ash"
        return 0
    else
        echo "Neither bash nor ash found - using default sh"
        return 0
    fi
}
`;
}

function oldWrapperFeatureSnippet(config) {
  return `
# =============================================================================
# OLD SCRIPT WRAPPER (auto-generated)
# =============================================================================
OLD_SCRIPT_PATH="\${REPO_DIR}/old-install.sh"
if [ "\$1" = "--old" ] && [ -f "\$OLD_SCRIPT_PATH" ]; then
    echo "Running old install script..."
    exec bash "\$OLD_SCRIPT_PATH" "\${@:2}"
fi
`;
}

// ==================== ONLINE INSTALL FEATURE (OPTIONAL) ====================
function onlineInstallFeatureSnippet(config) {
  return `
# =============================================================================
# ONLINE DEPENDENCY INSTALLATION (auto-generated)
# =============================================================================
ONLINE_MODE=false

# Helper: check if a command exists
command_exists() {
    command -v "\$1" >/dev/null 2>&1
}

# Helper: install packages via apt
install_apt() {
    echo "Installing via apt: \$*"
    sudo apt update && sudo apt install -y "\$@"
}

# Helper: install packages via apk
install_apk() {
    echo "Installing via apk: \$*"
    apk add --no-cache "\$@"
}

# Install dependencies for a specific language
install_language_dependency() {
    lang="\$1"
    echo "Checking dependencies for \$lang..."
    case "\$lang" in
        nodejs)
            if ! command_exists node; then
                echo "Node.js not found. Installing..."
                if command_exists apt; then install_apt nodejs;
                elif command_exists apk; then install_apk nodejs npm;
                else echo "No supported package manager found."; return 1; fi
            else
                echo "Node.js already installed."
            fi
            ;;
        python)
            if ! command_exists python3; then
                echo "Python3 not found. Installing..."
                if command_exists apt; then install_apt python3;
                elif command_exists apk; then install_apk python3;
                else echo "No supported package manager found."; return 1; fi
            else
                echo "Python3 already installed."
            fi
            ;;
        c)
            if ! command_exists gcc; then
                echo "GCC not found. Installing..."
                if command_exists apt; then install_apt gcc;
                elif command_exists apk; then install_apk build-base;
                else echo "No supported package manager found."; return 1; fi
            else
                echo "GCC already installed."
            fi
            ;;
        cpp)
            if ! command_exists g++; then
                echo "G++ not found. Installing..."
                if command_exists apt; then install_apt g++;
                elif command_exists apk; then install_apk g++;
                else echo "No supported package manager found."; return 1; fi
            else
                echo "G++ already installed."
            fi
            ;;
        java)
            if ! command_exists javac || ! command_exists java; then
                echo "Java not found. Installing..."
                if command_exists apt; then install_apt default-jdk;
                elif command_exists apk; then install_apk openjdk11;
                else echo "No supported package manager found."; return 1; fi
            else
                echo "Java already installed."
            fi
            ;;
        shell)
            echo "Shell scripts need no special runtime."
            ;;
        unknown)
            echo "Unknown language - skipping dependency installation."
            ;;
    esac
    return 0
}

# Install all language dependencies (main + additional tools)
install_language_deps() {
    [ "\$ONLINE_MODE" = true ] || return 0
    echo "=== Checking and installing language dependencies ==="
    
    # Main entry point
    main_src="\$MAIN_ENTRY_POINT_SRC"
    if [ -n "\$main_src" ]; then
        main_lang=\$(detect_language "\$main_src")
        echo "Main command (\$MAIN_ENTRY_POINT_CMD) uses: \$main_lang"
        install_language_dependency "\$main_lang"
    fi
    
    # Additional tool commands
    if [ -n "\$ADDITIONAL_TOOL_SRC" ]; then
        echo "Checking additional tool commands..."
        idx=1
        for src in \$ADDITIONAL_TOOL_SRC; do
            cmd=\$(echo "\$ADDITIONAL_TOOL_CMD" | tr ' ' '\\n' | sed -n "\${idx}p")
            [ -z "\$cmd" ] && continue
            tool_lang=\$(detect_language "\$src")
            echo "Tool command '\$cmd' uses: \$tool_lang"
            install_language_dependency "\$tool_lang"
            idx=\$((idx + 1))
        done
    fi
    
    echo "=== Language dependencies check completed ==="
}
`;
}

// ==================== INSTALL.SH TEMPLATE ASSEMBLY ====================

function generateInstallSh(config, enabledFeatures) {
  const parts = [];

  // Header
  parts.push(`#!/bin/sh
# =============================================================================
# ${config.projectName} Installation Script
# Generated by shinstall.js
# =============================================================================
`);

  // Project info
  parts.push(`
PROJECT_NAME="${config.projectName}"
INSTALL_DIR="${config.installDir}"
BIN_DIR="${config.binDir}"
REPO_DIR=\$(pwd)
MAIN_SOURCE_DIR="${config.mainSourceDir}"
BACKUP_DIR="\${INSTALL_DIR}_old_\$(date +%s)"
`);

  // Main entry point mapping
  parts.push(`
# Main entry point mapping
MAIN_ENTRY_POINT_SRC="${config.mainEntryPointSrc}"
MAIN_ENTRY_POINT_CMD="${config.mainEntryPointCmd}"
`);

  // Additional tool commands (if configured)
  if (config.additionalToolSrc) {
    parts.push(`
# Additional tool commands (optional, can be different languages)
ADDITIONAL_TOOL_SRC="${config.additionalToolSrc}"
ADDITIONAL_TOOL_CMD="${config.additionalToolCmd}"
`);
  }

  // Shell script mapping (if configured)
  if (config.shellScriptsSrc) {
    parts.push(`
# Shell script command mapping
SHELL_SCRIPTS_SRC="${config.shellScriptsSrc}"
SHELL_SCRIPTS_CMD="${config.shellScriptsCmd}"
SHELL_SCRIPTS_SRC_LIST="${config.shellScriptsSrc}"
SHELL_SCRIPTS_CMD_LIST="${config.shellScriptsCmd}"
`);
  }

  // Post-install scripts (if configured)
  if (config.postInstallScripts) {
    parts.push(`
# Post-install scripts
POST_INSTALL_SCRIPTS="${config.postInstallScripts}"
`);
  }

  // Preservation whitelist (if configured)
  if (config.preservationWhitelist) {
    parts.push(`
# Preservation whitelist
PRESERVATION_WHITELIST="${config.preservationWhitelist}"
`);
  }

  // Include feature snippets
  for (const feature of features) {
    if (enabledFeatures.has(feature.id)) {
      parts.push(feature.generate(config));
    }
  }

  // ==================== CORE MULTI-LANGUAGE SUPPORT (ALWAYS INCLUDED) ====================
  parts.push(`
# =============================================================================
# MULTI-LANGUAGE SUPPORT (always available)
# =============================================================================

# Detect language from file extension
detect_language() {
    file_path="\$1"
    ext="\${file_path##*.}"
    case "\$ext" in
        js|mjs|cjs) echo "nodejs" ;;
        py|py3) echo "python" ;;
        c) echo "c" ;;
        cpp|cc|cxx|hpp) echo "cpp" ;;
        java) echo "java" ;;
        sh|bash) echo "shell" ;;
        *) echo "unknown" ;;
    esac
}

# Create command wrapper for a specific language
create_language_command() {
    src_path="\$1"
    cmd_name="\$2"
    src_name="\$3"
    lang=\$(detect_language "\$src_name")
    
    wrapper="\$INSTALL_DIR/wrappers/\$cmd_name"
    mkdir -p "\$INSTALL_DIR/wrappers"
    
    case "\$lang" in
        nodejs)
            # Node.js
            cat > "\$wrapper" << EOF
#!/bin/sh
exec node "\$src_path" "\\\$@"
EOF
            ;;
        python)
            # Python
            cat > "\$wrapper" << EOF
#!/bin/sh
exec python3 "\$src_path" "\\\$@"
EOF
            ;;
        c)
            # C: compile to binary in \$INSTALL_DIR/bin
            bin_path="\$INSTALL_DIR/bin/\$cmd_name"
            mkdir -p "\$INSTALL_DIR/bin"
            echo "Compiling C program: \$src_name -> \$cmd_name"
            if command_exists gcc; then
                gcc -o "\$bin_path" "\$src_path" || { echo "Compilation failed for \$src_name"; return 1; }
            else
                echo "Error: gcc not found. Use --online to install dependencies."
                return 1
            fi
            cat > "\$wrapper" << EOF
#!/bin/sh
exec "\$bin_path" "\\\$@"
EOF
            ;;
        cpp)
            # C++
            bin_path="\$INSTALL_DIR/bin/\$cmd_name"
            mkdir -p "\$INSTALL_DIR/bin"
            echo "Compiling C++ program: \$src_name -> \$cmd_name"
            if command_exists g++; then
                g++ -o "\$bin_path" "\$src_path" || { echo "Compilation failed for \$src_name"; return 1; }
            else
                echo "Error: g++ not found. Use --online to install dependencies."
                return 1
            fi
            cat > "\$wrapper" << EOF
#!/bin/sh
exec "\$bin_path" "\\\$@"
EOF
            ;;
        java)
            # Java: compile to .class files in \$INSTALL_DIR/classes
            classes_dir="\$INSTALL_DIR/classes"
            mkdir -p "\$classes_dir"
            echo "Compiling Java program: \$src_name -> \$cmd_name"
            if command_exists javac; then
                javac -d "\$classes_dir" "\$src_path" || { echo "Compilation failed for \$src_name"; return 1; }
            else
                echo "Error: javac not found. Use --online to install dependencies."
                return 1
            fi
            main_class=\$(basename "\$src_name" .java)
            cat > "\$wrapper" << EOF
#!/bin/sh
exec java -cp "\$classes_dir" "\$main_class" "\\\$@"
EOF
            ;;
        shell)
            # Shell script: make executable and link directly
            echo "Setting up shell script: \$src_name -> \$cmd_name"
            chmod +x "\$src_path"
            wrapper="\$src_path"
            ;;
        unknown)
            echo "Unknown language for \$src_name - trying with shebang..."
            # Fallback: try to use shebang from the file
            if head -1 "\$src_path" | grep -q '^#!'; then
                chmod +x "\$src_path"
                wrapper="\$src_path"
            else
                echo "Error: Cannot determine how to execute \$src_name"
                return 1
            fi
            ;;
    esac
    
    if [ "\$wrapper" != "\$src_path" ]; then
        chmod +x "\$wrapper"
        ln -sf "\$wrapper" "\$BIN_DIR/\$cmd_name"
    else
        ln -sf "\$src_path" "\$BIN_DIR/\$cmd_name"
    fi
    echo "Created command: \$cmd_name -> \$src_path (language: \$lang)"
    return 0
}

# Core functions
# =============================================================================
# CORE FUNCTIONS
# =============================================================================
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

copy_files() {
    mkdir -p "\$INSTALL_DIR"
    echo "Copying files..."
    (cd "\$MAIN_SOURCE_DIR" && find . -type f -not -path '*/.git/*' -exec cp --parents {} "\$INSTALL_DIR" \\;)
}

create_command_links() {
    echo "Creating command links with language detection..."
    
    # Create main command
    main_src="\$MAIN_ENTRY_POINT_SRC"
    main_cmd="\$MAIN_ENTRY_POINT_CMD"
    
    if [ -n "\$main_src" ] && [ -n "\$main_cmd" ]; then
        src_path="\$INSTALL_DIR/\$main_src"
        if [ -f "\$src_path" ]; then
            create_language_command "\$src_path" "\$main_cmd" "\$main_src"
        else
            echo "Warning: Main source file not found: \$src_path"
        fi
    fi
    
    # Create additional tool commands
    if [ -n "\$ADDITIONAL_TOOL_SRC" ]; then
        idx=1
        for src in \$ADDITIONAL_TOOL_SRC; do
            cmd=\$(echo "\$ADDITIONAL_TOOL_CMD" | tr ' ' '\\n' | sed -n "\${idx}p")
            [ -z "\$cmd" ] && continue
            src_path="\$INSTALL_DIR/\$src"
            if [ -f "\$src_path" ]; then
                create_language_command "\$src_path" "\$cmd" "\$src"
            else
                echo "Warning: Tool source file not found: \$src_path"
            fi
            idx=\$((idx + 1))
        done
    fi
}

remove_links() {
    # Remove main command
    [ -L "\$BIN_DIR/\$MAIN_ENTRY_POINT_CMD" ] && rm -f "\$BIN_DIR/\$MAIN_ENTRY_POINT_CMD"
    
    # Remove additional tool commands
    if [ -n "\$ADDITIONAL_TOOL_CMD" ]; then
        for cmd in \$ADDITIONAL_TOOL_CMD; do
            [ -L "\$BIN_DIR/\$cmd" ] && rm -f "\$BIN_DIR/\$cmd"
        done
    fi
    
    # Remove generated directories
    [ -d "\$INSTALL_DIR/wrappers" ] && rm -rf "\$INSTALL_DIR/wrappers"
    [ -d "\$INSTALL_DIR/bin" ] && rm -rf "\$INSTALL_DIR/bin"
    [ -d "\$INSTALL_DIR/classes" ] && rm -rf "\$INSTALL_DIR/classes"
}

execute_post_install_scripts() {
    [ -z "\$POST_INSTALL_SCRIPTS" ] && return 0
    echo "Executing post-install scripts..."
    cd "\$INSTALL_DIR"
    for script in \$POST_INSTALL_SCRIPTS; do
        [ -f "\$script" ] && sh "\$script"
    done
    cd - >/dev/null
}

cleanup() {
    sudo dpkg --configure -a >/dev/null 2>&1 || true
}

show_help() {
    echo "Usage: \$0 [OPTIONS]"
    echo "Install \$PROJECT_NAME"
    echo ""
    echo "Options:"
    echo "  -h, --help       Show this help"
    echo "  --online         Install missing language dependencies"
    echo "  --force          Force update without asking"
    echo "  --remove         Remove existing installation"
    echo ""
    echo "Commands created:"
    echo "  \$MAIN_ENTRY_POINT_CMD"
    if [ -n "\$ADDITIONAL_TOOL_CMD" ]; then
        for cmd in \$ADDITIONAL_TOOL_CMD; do
            echo "  \$cmd"
        done
    fi
}
`);

  // Add --old handling if enabled
  if (enabledFeatures.has('oldwrapper')) {
    parts.push(`
# Check for --old flag first
if [ "\$1" = "--old" ] && [ -f "\${REPO_DIR}/old-install.sh" ]; then
    echo "Running old install script..."
    shift
    exec bash "\${REPO_DIR}/old-install.sh" "\$@"
fi
`);
  }

  // Parse arguments
  parts.push(`
# Parse arguments
FORCE_UPDATE=false
FORCE_REMOVE=false
while [ \$# -gt 0 ]; do
    case "\$1" in
        -h|--help) show_help; exit 0 ;;
        --online) ONLINE_MODE=true ;;
        --build) BUILD_MODE=true ;;
        --tar) BUILD_TAR=true ;;
        --config) BUILD_CONFIG=true ;;
        --message) BUILD_MESSAGE_MODE=true ;;
        --force|-f) FORCE_UPDATE=true ;;
        --remove|-r) FORCE_REMOVE=true ;;
        *) ;;
    esac
    shift
done
`);

  // Check for existing installation
  parts.push(`
# Check if already installed
if [ -d "\$INSTALL_DIR" ]; then
    if [ "\$FORCE_REMOVE" = true ]; then
        echo "Removing existing installation..."
        remove_links
        rm -rf "\$INSTALL_DIR"
        echo "Removed. Proceeding with fresh install..."
    elif [ "\$FORCE_UPDATE" = true ]; then
        echo "Forcing update..."
        mv -f "\$INSTALL_DIR" "\$BACKUP_DIR"
        remove_links
        echo "Proceeding with update..."
    else
        echo "Existing installation found at \$INSTALL_DIR"
        echo ""
        echo "Choose an option:"
        echo "  1. Update (replace existing files)"
        echo "  2. Remove (delete existing installation)"
        echo "  3. Exit"
        printf "Enter your choice (1/2/3): "
        read choice
        case "\$choice" in
            1)
                echo "Updating..."
                mv -f "\$INSTALL_DIR" "\$BACKUP_DIR"
                remove_links
                ;;
            2)
                echo "Removing..."
                remove_links
                rm -rf "\$INSTALL_DIR"
                echo "Removed successfully."
                exit 0
                ;;
            3)
                echo "Exiting."
                exit 0
                ;;
            *)
                echo "Invalid choice. Exiting."
                exit 1
                ;;
        esac
    fi
fi
`);

  // Call feature functions conditionally
  if (enabledFeatures.has('debs')) {
    parts.push(`
# Install .deb packages if enabled
install_debs
`);
  }

  // If online install is enabled, call install_language_deps before compilation
  if (enabledFeatures.has('onlineinstall')) {
    parts.push(`
# Install missing language dependencies if --online was passed
install_language_deps
`);
  }

  parts.push(`
# Create installation directory and copy files
copy_files
`);

  if (enabledFeatures.has('pm2')) {
    parts.push(`
# Extract PM2 if enabled
extract_pm2
`);
  }

  // The call to create_command_links uses the multi-language version
  parts.push(`
# Create command links (with language detection)
create_command_links
`);

  if (enabledFeatures.has('pkgcli')) {
    parts.push(`
# Create pkg CLI
create_pkg_cli
`);
  }

  if (enabledFeatures.has('wsave')) {
    parts.push(`
# Create wsave command
create_wsave
`);
  }

  if (enabledFeatures.has('gitconfig')) {
    parts.push(`
# Create git-config command
create_git_config
`);
  }

  if (enabledFeatures.has('shellfallback')) {
    parts.push(`
# Create shell script commands with fallback
create_shell_commands
check_shell_fallback
`);
  }

  parts.push(`
# Execute post-install scripts
execute_post_install_scripts

cleanup

echo ""
echo "Installation completed!"
echo ""
echo "Available commands:"
echo "  \$MAIN_ENTRY_POINT_CMD"
if [ -n "\$ADDITIONAL_TOOL_CMD" ]; then
    for cmd in \$ADDITIONAL_TOOL_CMD; do
        echo "  \$cmd"
    done
fi
echo ""
echo "Installation directory: \$INSTALL_DIR"
`);

  return parts.join('\n');
}

// ==================== TEST SUITE ====================
class TestSuite {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.testDir = path.join(process.cwd(), '.test-tmp');
    this.results = [];
  }

  async setup() {
    await mkdir(this.testDir, { recursive: true });
    console.log('🧪 Test Suite Starting...\n');
    console.log('========================================');
    console.log('  shinstall.js Test Suite');
    console.log('========================================\n');
  }

  async cleanup() {
    try {
      await execSync(`rm -rf ${this.testDir}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      this.results.push({ status: '✅ PASS', message });
      console.log(`✅ PASS: ${message}`);
    } else {
      this.failed++;
      this.results.push({ status: '❌ FAIL', message });
      console.log(`❌ FAIL: ${message}`);
    }
  }

  async assertFileExists(filePath, message) {
    try {
      await access(filePath, fs.constants.F_OK);
      this.assert(true, message || `File exists: ${filePath}`);
      return true;
    } catch {
      this.assert(false, message || `File should exist: ${filePath}`);
      return false;
    }
  }

  async assertFileContains(filePath, content, message) {
    try {
      const data = await readFile(filePath, 'utf8');
      this.assert(data.includes(content), message || `File contains expected content: ${filePath}`);
      return data.includes(content);
    } catch (e) {
      this.assert(false, message || `File should be readable: ${filePath}`);
      return false;
    }
  }

  async testFeatureGeneration() {
    console.log('\n📦 Testing Feature Generation...');
    
    for (const feature of features) {
      const config = { ...DEFAULTS, projectName: 'TestApp' };
      const snippet = feature.generate(config);
      
      this.assert(
        typeof snippet === 'string' && snippet.length > 0,
        `Feature '${feature.id}' generates non-empty snippet`
      );
      
      this.assert(
        snippet.includes('# ===='),
        `Feature '${feature.id}' has proper header formatting`
      );
    }
  }

  async testBuildFeature() {
    console.log('\n🔨 Testing Build Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestBuild' };
    const snippet = buildFeatureSnippet(config);
    
    this.assert(snippet.includes('BUILD_MODE=false'), 'Build feature has BUILD_MODE variable');
    this.assert(snippet.includes('do_build()'), 'Build feature has do_build function');
    this.assert(snippet.includes('BUILD_DIR='), 'Build feature has BUILD_DIR variable');
    this.assert(snippet.includes('BUILD_SAVE_FILE='), 'Build feature has BUILD_SAVE_FILE variable');
  }

  async testDebInstallFeature() {
    console.log('\n📦 Testing Debian Package Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestDeb' };
    const snippet = debInstallFeatureSnippet(config);
    
    this.assert(snippet.includes('SKIP_DEBS=false'), 'Deb install has SKIP_DEBS variable');
    this.assert(snippet.includes('install_debs()'), 'Deb install has install_debs function');
    this.assert(snippet.includes('dpkg -i'), 'Deb install uses dpkg command');
  }

  async testPm2ExtractFeature() {
    console.log('\n📦 Testing PM2 Extract Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestPm2' };
    const snippet = pm2ExtractFeatureSnippet(config);
    
    this.assert(snippet.includes('PM2_TAR_GZ='), 'PM2 extract has PM2_TAR_GZ variable');
    this.assert(snippet.includes('extract_pm2()'), 'PM2 extract has extract_pm2 function');
    this.assert(snippet.includes('tar -xzf'), 'PM2 extract uses tar command');
  }

  async testPkgCliFeature() {
    console.log('\n📦 Testing pkg CLI Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestPkg' };
    const snippet = pkgCliFeatureSnippet(config);
    
    this.assert(snippet.includes('create_pkg_cli()'), 'pkg CLI has create_pkg_cli function');
    this.assert(snippet.includes('pkg-cli.js'), 'pkg CLI creates pkg-cli.js file');
  }

  async testWsaveFeature() {
    console.log('\n📦 Testing wsave Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestWsave' };
    const snippet = wsaveFeatureSnippet(config);
    
    this.assert(snippet.includes('create_wsave()'), 'wsave has create_wsave function');
    this.assert(snippet.includes('chown -R'), 'wsave uses chown command');
  }

  async testGitConfigFeature() {
    console.log('\n📦 Testing git-config Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestGit' };
    const snippet = gitConfigFeatureSnippet(config);
    
    this.assert(snippet.includes('create_git_config()'), 'git-config has create_git_config function');
    this.assert(snippet.includes('Git.js'), 'git-config looks for Git.js');
  }

  async testShellFallbackFeature() {
    console.log('\n📦 Testing Shell Fallback Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestShell' };
    const snippet = shellFallbackFeatureSnippet(config);
    
    this.assert(snippet.includes('create_shell_commands()'), 'Shell fallback has create_shell_commands function');
    this.assert(snippet.includes('SHELL_SCRIPTS_SRC_LIST'), 'Shell fallback has SHELL_SCRIPTS_SRC_LIST variable');
    this.assert(snippet.includes('command -v bash'), 'Shell fallback checks for bash availability');
    this.assert(snippet.includes('command -v ash'), 'Shell fallback checks for ash availability');
  }

  async testOldWrapperFeature() {
    console.log('\n📦 Testing Old Wrapper Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestOld' };
    const snippet = oldWrapperFeatureSnippet(config);
    
    this.assert(snippet.includes('OLD_SCRIPT_PATH'), 'Old wrapper has OLD_SCRIPT_PATH variable');
    this.assert(snippet.includes('old-install.sh'), 'Old wrapper references old-install.sh');
    this.assert(snippet.includes('--old'), 'Old wrapper checks for --old flag');
  }

  async testOnlineInstallFeature() {
    console.log('\n📦 Testing Online Install Feature...');
    
    const config = { ...DEFAULTS, projectName: 'TestOnline' };
    const snippet = onlineInstallFeatureSnippet(config);
    
    this.assert(snippet.includes('ONLINE_MODE=false'), 'Online install has ONLINE_MODE variable');
    this.assert(snippet.includes('install_language_deps()'), 'Online install has install_language_deps function');
    this.assert(snippet.includes('install_language_dependency()'), 'Online install has install_language_dependency function');
    this.assert(snippet.includes('command_exists()'), 'Online install has command_exists helper');
    this.assert(snippet.includes('install_apt()'), 'Online install has install_apt helper');
    this.assert(snippet.includes('install_apk()'), 'Online install has install_apk helper');
  }

  async testGenerateInstallSh() {
    console.log('\n🔧 Testing install.sh Generation...');
    
    // Test with Java main file
    const config = {
      ...DEFAULTS,
      projectName: 'TestJava',
      installDir: '/tmp/test-java',
      binDir: '/tmp/test-bin',
      mainEntryPointSrc: 'Main.java',
      mainEntryPointCmd: 'myjava',
      additionalToolSrc: 'helper.py tool.c',
      additionalToolCmd: 'helper tool'
    };
    
    // Test with basic features
    const basicFeatures = new Set(['onlineinstall']);
    const basicScript = generateInstallSh(config, basicFeatures);
    
    this.assert(basicScript.includes('#!/bin/sh'), 'Generated script has shebang');
    this.assert(basicScript.includes('PROJECT_NAME="TestJava"'), 'Generated script has project name');
    this.assert(basicScript.includes('MAIN_ENTRY_POINT_SRC="Main.java"'), 'Generated script has Java main entry point');
    this.assert(basicScript.includes('MAIN_ENTRY_POINT_CMD="myjava"'), 'Generated script has main command');
    this.assert(basicScript.includes('ADDITIONAL_TOOL_SRC="helper.py tool.c"'), 'Generated script has additional tools');
    
    // Check multi-language support is always included
    this.assert(basicScript.includes('detect_language()'), 'Script always includes detect_language function');
    this.assert(basicScript.includes('create_language_command()'), 'Script always includes create_language_command function');
    this.assert(basicScript.includes('javac -d'), 'Script includes Java compilation');
    this.assert(basicScript.includes('exec java'), 'Script includes Java execution');
    this.assert(basicScript.includes('exec python3'), 'Script includes Python execution');
    this.assert(basicScript.includes('gcc -o'), 'Script includes C compilation');
    
    // Write test script to verify it's valid
    await writeFile(path.join(this.testDir, 'java-install.sh'), basicScript, 'utf8');
    
    await this.assertFileExists(
      path.join(this.testDir, 'java-install.sh'),
      'Java install.sh file created'
    );
    
    // Verify shell script syntax
    try {
      execSync(`bash -n ${path.join(this.testDir, 'java-install.sh')}`);
      this.assert(true, 'Java install.sh has valid bash syntax');
    } catch (e) {
      this.assert(false, 'Java install.sh has valid bash syntax');
    }
  }

  async testFileOperations() {
    console.log('\n📁 Testing File Operations...');
    
    const testFile = path.join(this.testDir, 'test-file.txt');
    await writeFile(testFile, 'test content', 'utf8');
    this.assert(await fileExists(testFile), 'fileExists returns true for existing file');
    this.assert(!await fileExists(path.join(this.testDir, 'nonexistent.txt')), 'fileExists returns false for missing file');
    
    const copiedFile = path.join(this.testDir, 'copied-file.txt');
    await copyFile(testFile, copiedFile);
    await this.assertFileExists(copiedFile, 'copyFile creates copy');
    
    const renamedFile = path.join(this.testDir, 'renamed-file.txt');
    await rename(testFile, renamedFile);
    await this.assertFileExists(renamedFile, 'rename moves file');
    this.assert(!await fileExists(testFile), 'Original file removed after rename');
    
    await unlink(renamedFile);
    this.assert(!await fileExists(renamedFile), 'unlink removes file');
  }

  async testConfigManagement() {
    console.log('\n⚙️ Testing Configuration Management...');
    
    const testConfig = {
      ...DEFAULTS,
      projectName: 'ConfigTest',
      installDir: '/tmp/config-test',
      mainEntryPointSrc: 'test.java',
      mainEntryPointCmd: 'testcmd',
      additionalToolSrc: 'tool.py',
      additionalToolCmd: 'tool'
    };
    
    await saveConfig(testConfig);
    const configFile = path.join(process.cwd(), '.shinstallrc');
    await this.assertFileExists(configFile, 'saveConfig creates .shinstallrc');
    
    const loadedConfig = await loadConfig();
    this.assert(
      loadedConfig.projectName === 'ConfigTest',
      'loadConfig returns saved configuration'
    );
    this.assert(
      loadedConfig.mainEntryPointSrc === 'test.java',
      'loadConfig returns correct main entry point'
    );
    this.assert(
      loadedConfig.additionalToolSrc === 'tool.py',
      'loadConfig returns correct additional tools'
    );
    
    try {
      await unlink(configFile);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  }

  async runAllTests() {
    const startTime = Date.now();
    
    await this.setup();
    
    try {
      await this.testFeatureGeneration();
      await this.testGenerateInstallSh();
      await this.testFileOperations();
      await this.testConfigManagement();
      
      await this.testBuildFeature();
      await this.testDebInstallFeature();
      await this.testPm2ExtractFeature();
      await this.testPkgCliFeature();
      await this.testWsaveFeature();
      await this.testGitConfigFeature();
      await this.testShellFallbackFeature();
      await this.testOldWrapperFeature();
      await this.testOnlineInstallFeature();
      
    } catch (error) {
      console.error('❌ Test suite error:', error);
      this.failed++;
    } finally {
      await this.cleanup();
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n========================================');
    console.log('  Test Results Summary');
    console.log('========================================');
    console.log(`Total tests: ${this.passed + this.failed}`);
    console.log(`Passed: ${this.passed} ✅`);
    console.log(`Failed: ${this.failed} ❌`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log('========================================\n');
    
    if (this.failed > 0) {
      console.log('❌ Some tests failed. Please review the output above.');
      process.exit(1);
    } else {
      console.log('✅ All tests passed successfully!');
      console.log('The system is working correctly. You can safely add new modules.');
    }
  }
}

// ==================== INTERACTIVE MENU ====================

async function interactiveMenu() {
  console.clear();
  console.log('=========================================');
  console.log('  shinstall.js – Modular install.sh Builder');
  console.log('=========================================');
  console.log('Current directory:', process.cwd());
  console.log('');

  const existingInstall = await fileExists('install.sh');
  const existingOld = await fileExists('old-install.sh');

  console.log('Options:');
  console.log('1. Create a new install.sh from scratch');
  if (existingInstall) {
    console.log('2. Modify existing install.sh');
    console.log('3. emb old script (backup as old-install.sh and generate new)');
  }
  console.log('4. Toggle features');
  console.log('5. Configure project settings');
  console.log('6. Generate old-install.sh wrapper (--old support)');
  console.log('7. Remove old-install.sh');
  console.log('8. Run test suite');
  console.log('0. Exit');
  console.log('');

  const choice = await question('Select an option: ');
  switch (choice.trim()) {
    case '1':
      await createNewInstall();
      break;
    case '2':
      if (existingInstall) await modifyExistingInstall();
      else console.log('No existing install.sh found.');
      break;
    case '3':
      if (existingInstall) await eatOldScript();
      else console.log('No existing install.sh to emb.');
      break;
    case '4':
      await toggleFeatures();
      break;
    case '5':
      await configureSettings();
      break;
    case '6':
      await generateOldWrapper();
      break;
    case '7':
      await removeOldWrapper();
      break;
    case '8':
      const testSuite = new TestSuite();
      await testSuite.runAllTests();
      break;
    case '0':
      console.log('Goodbye!');
      rl.close();
      process.exit(0);
    default:
      console.log('Invalid choice.');
  }
  console.log('\nPress Enter to continue...');
  await question('');
  interactiveMenu();
}

async function createNewInstall() {
  console.log('\n--- Create new install.sh ---');
  const config = await gatherProjectConfig();
  const enabledFeatures = await selectFeatures();
  const content = generateInstallSh(config, enabledFeatures);
  await writeFile('install.sh', content, 'utf8');
  try {
    execSync('chmod +x install.sh');
  } catch (e) {
    // ignore chmod errors on some systems
  }
  console.log('install.sh generated successfully.');
}

async function modifyExistingInstall() {
  console.log('\n--- Modify existing install.sh ---');
  console.log('This will overwrite the current install.sh with a newly generated one.');
  const confirm = await question('Are you sure? (y/n): ');
  if (confirm.toLowerCase() !== 'y') return;
  await copyFile('install.sh', 'install.sh.bak');
  await createNewInstall();
  console.log('Old install.sh backed up as install.sh.bak');
}

async function eatOldScript() {
  console.log('\n--- emb old script ---');
  console.log('The existing install.sh will be backed up as old-install.sh');
  const confirm = await question('Proceed? (y/n): ');
  if (confirm.toLowerCase() !== 'y') return;
  await rename('install.sh', 'old-install.sh');
  await createNewInstall();
  console.log('Old script saved as old-install.sh. Use install.sh --old to run it.');
}

async function toggleFeatures() {
  console.log('\n--- Toggle Features ---');
  // Use in-memory feature set, always start with onlineinstall enabled
  const enabled = new Set(['onlineinstall']);
  
  console.log('Current feature states (enable/disable):');
  for (let i = 0; i < features.length; i++) {
    console.log(`${i + 1}. [${enabled.has(features[i].id) ? 'X' : ' '}] ${features[i].name} - ${features[i].description}`);
  }
  console.log('Enter number to toggle, or 0 when done.');
  while (true) {
    const input = await question('> ');
    const num = parseInt(input.trim());
    if (num === 0) break;
    if (num >= 1 && num <= features.length) {
      const id = features[num - 1].id;
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      console.log(`Toggled ${features[num - 1].name} to ${enabled.has(id) ? 'ON' : 'OFF'}.`);
    } else {
      console.log('Invalid number.');
    }
  }
  // Return the in-memory set (not saved to file)
  return enabled;
}

async function configureSettings() {
  console.log('\n--- Configure Project Settings ---');
  const projectName = await question(`Project name (default: ${DEFAULTS.projectName}): `);
  const installDir = await question(`Install directory (default: ${DEFAULTS.installDir}): `);
  const mainSrc = await question(`Main entry point source (default: ${DEFAULTS.mainEntryPointSrc}): `);
  const mainCmd = await question(`Main command name (default: ${DEFAULTS.mainEntryPointCmd}): `);
  const toolSrc = await question(`Additional tool sources space-separated (optional, press Enter to skip): `);
  const toolCmd = await question(`Additional tool commands space-separated (optional, press Enter to skip): `);
  
  const config = {
    ...DEFAULTS,
    projectName: projectName || DEFAULTS.projectName,
    installDir: installDir || DEFAULTS.installDir,
    mainEntryPointSrc: mainSrc || DEFAULTS.mainEntryPointSrc,
    mainEntryPointCmd: mainCmd || DEFAULTS.mainEntryPointCmd,
    additionalToolSrc: toolSrc || '',
    additionalToolCmd: toolCmd || '',
  };
  await saveConfig(config);
  console.log('Settings saved to .shinstallrc');
  console.log('Language is automatically detected from file extension:');
  console.log('  .js → Node.js | .py → Python | .c → C | .cpp/.cc → C++ | .java → Java | .sh → Shell');
}

async function generateOldWrapper() {
  console.log('\n--- Generate old-install.sh wrapper ---');
  if (await fileExists('old-install.sh')) {
    console.log('old-install.sh already exists. Nothing to do.');
    return;
  }
  if (!await fileExists('install.sh')) {
    console.log('No install.sh found to wrap.');
    return;
  }
  const wrapperContent = `#!/bin/sh
# Wrapper to run the old install script.
# This file was generated by shinstall.js.
exec bash "\$(dirname "\$0")/install.sh" --old "\$@"
`;
  await writeFile('old-install.sh', wrapperContent, 'utf8');
  try {
    execSync('chmod +x old-install.sh');
  } catch (e) {
    // ignore
  }
  console.log('old-install.sh wrapper created. Use ./old-install.sh [args] to run the old script.');
}

async function removeOldWrapper() {
  if (await fileExists('old-install.sh')) {
    await unlink('old-install.sh');
    console.log('old-install.sh removed.');
  } else {
    console.log('No old-install.sh found.');
  }
}

// ==================== HELPER FUNCTIONS ====================

async function fileExists(filePath) {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function gatherProjectConfig() {
  const config = { ...DEFAULTS };
  console.log('\nEnter project details (press Enter to accept defaults):');
  const projectName = await question(`Project name (${config.projectName}): `);
  if (projectName) config.projectName = projectName;
  const installDir = await question(`Install directory (${config.installDir}): `);
  if (installDir) config.installDir = installDir;
  const mainSrc = await question(`Main entry point source (${config.mainEntryPointSrc}): `);
  if (mainSrc) config.mainEntryPointSrc = mainSrc;
  const mainCmd = await question(`Main command name (${config.mainEntryPointCmd}): `);
  if (mainCmd) config.mainEntryPointCmd = mainCmd;
  const toolSrc = await question(`Additional tool sources space-separated (optional): `);
  if (toolSrc) config.additionalToolSrc = toolSrc;
  const toolCmd = await question(`Additional tool commands space-separated (optional): `);
  if (toolCmd) config.additionalToolCmd = toolCmd;
  console.log('Language is automatically detected from file extension:');
  console.log('  .js → Node.js | .py → Python | .c → C | .cpp/.cc → C++ | .java → Java | .sh → Shell');
  return config;
}

async function selectFeatures() {
  console.log('\nSelect features to enable (comma separated numbers, "all", or press Enter for none):');
  for (let i = 0; i < features.length; i++) {
    console.log(`${i + 1}. ${features[i].name} - ${features[i].description}`);
  }
  const input = await question('Selection: ');
  const enabled = new Set();
  if (input.trim().toLowerCase() === 'all') {
    features.forEach(f => enabled.add(f.id));
  } else if (input.trim() !== '') {
    const nums = input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    nums.forEach(n => {
      if (n >= 1 && n <= features.length) enabled.add(features[n - 1].id);
    });
  }
  // Always enable onlineinstall by default
  if (!enabled.has('onlineinstall')) {
    enabled.add('onlineinstall');
  }
  return enabled;
}

async function saveConfig(config) {
  await writeFile('.shinstallrc', JSON.stringify(config, null, 2), 'utf8');
}

async function loadConfig() {
  try {
    const data = await readFile('.shinstallrc', 'utf8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULTS };
  }
}

// ==================== CLI ENTRY POINT ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test') || args.includes('-t')) {
    console.log('Running test suite...\n');
    const testSuite = new TestSuite();
    await testSuite.runAllTests();
    return;
  }
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
shinstall.js – Modular install.sh generator

Usage:
  node shinstall.js               Interactive menu
  node shinstall.js --new         Create a new install.sh (prompts for config)
  node shinstall.js --emb         Backup existing install.sh as old-install.sh and generate new
  node shinstall.js --old         Generate an old-install.sh wrapper
  node shinstall.js --no-old      Remove the old-install.sh wrapper
  node shinstall.js --test        Run test suite to verify all modules
  node shinstall.js --help        Show this help

Multi-language support is ALWAYS enabled:
  .js → Node.js | .py → Python | .c → C | .cpp/.cc → C++ | .java → Java | .sh → Shell

For new modules:
  1. Add your feature to the 'features' array
  2. Create a test method in TestSuite class following the pattern: test[FeatureName]()
  3. Add the test call in the runAllTests() method
  4. Ensure your test validates: feature generation, integration, and error handling
  5. Run tests with: node shinstall.js --test
`);
    process.exit(0);
  }

  if (args.includes('--new')) {
    await createNewInstall();
    process.exit(0);
  }
  if (args.includes('--emb')) {
    await eatOldScript();
    process.exit(0);
  }
  if (args.includes('--old')) {
    await generateOldWrapper();
    process.exit(0);
  }
  if (args.includes('--no-old')) {
    await removeOldWrapper();
    process.exit(0);
  }

  await interactiveMenu();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});