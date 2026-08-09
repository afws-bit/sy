import { exec } from 'child_process';
import os from 'os';

/**
 * Force closes all server processes and frees all ports
 * Supports Linux, macOS, and Windows
 */
async function killAllServers() {
  const platform = os.platform();
  
  return new Promise((resolve, reject) => {
    let command;
    
    if (platform === 'win32') {
      // Windows: Find and kill node processes
      command = 'taskkill /F /IM node.exe';
    } else {
      // Linux/macOS: Kill processes on common server ports (3000-9999)
      command = `
        lsof -ti :3000-9999 | xargs -r kill -9 2>/dev/null;
        pkill -f node;
        pkill -f python;
        pkill -f java;
        echo "done"
      `;
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error && platform !== 'win32') {
        // On Unix systems, pkill might return error if no processes found, which is fine
        console.log('All server processes terminated (or none were running)');
        resolve();
      } else if (error) {
        console.error('Error killing processes:', error.message);
        reject(error);
      } else {
        console.log('All server processes forcefully terminated');
        console.log('Output:', stdout);
        resolve(stdout);
      }
    });
  });
}

// Main execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Force closing all server processes...');
  
  killAllServers()
    .then(() => {
      console.log('✓ All ports should now be free');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Failed to kill servers:', error);
      process.exit(1);
    });
}

export default killAllServers;