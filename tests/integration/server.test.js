import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Server Integration', () => {
  let serverProcess;
  const serverPath = path.join(__dirname, '../../src/server.js');

  beforeEach(() => {
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../fixtures/mock-credentials.json');
  });

  afterEach(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
      await new Promise(resolve => {
        serverProcess.on('exit', resolve);
      });
    }
  });

  test('should start server successfully', async () => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('AI Oracle MCP Server started')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }, 15000);

  test('should respond to tools/list request', async () => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let isReady = false;
      let response = '';

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('AI Oracle MCP Server started') && !isReady) {
          isReady = true;
          
          // Send tools/list request
          const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {}
          };
          
          serverProcess.stdin.write(JSON.stringify(request) + '\n');
        } else if (isReady) {
          response += output;
          
          try {
            const jsonResponse = JSON.parse(response.trim());
            if (jsonResponse.id === 1) {
              clearTimeout(timeout);
              
              expect(jsonResponse).toHaveProperty('result');
              expect(jsonResponse.result).toHaveProperty('tools');
              expect(Array.isArray(jsonResponse.result.tools)).toBe(true);
              expect(jsonResponse.result.tools.length).toBeGreaterThan(0);
              
              // Check for key tools
              const toolNames = jsonResponse.result.tools.map(tool => tool.name);
              expect(toolNames).toContain('ai_oracle');
              expect(toolNames).toContain('consult_o3');
              expect(toolNames).toContain('consult_gemini');
              expect(toolNames).toContain('consult_claude');
              
              resolve();
            }
          } catch (e) {
            // Response might be partial, continue collecting
          }
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }, 15000);

  test('should handle tool execution request', async () => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let isReady = false;
      let response = '';

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('AI Oracle MCP Server started') && !isReady) {
          isReady = true;
          
          // Send health_check tool request
          const request = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'health_check',
              arguments: {}
            }
          };
          
          serverProcess.stdin.write(JSON.stringify(request) + '\n');
        } else if (isReady) {
          response += output;
          
          try {
            const jsonResponse = JSON.parse(response.trim());
            if (jsonResponse.id === 2) {
              clearTimeout(timeout);
              
              expect(jsonResponse).toHaveProperty('result');
              expect(jsonResponse.result).toHaveProperty('content');
              expect(Array.isArray(jsonResponse.result.content)).toBe(true);
              expect(jsonResponse.result.content.length).toBeGreaterThan(0);
              expect(jsonResponse.result.content[0]).toHaveProperty('type', 'text');
              
              resolve();
            }
          } catch (e) {
            // Response might be partial, continue collecting
          }
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }, 15000);

  test('should handle graceful shutdown', async () => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Shutdown timeout'));
      }, 5000);

      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('AI Oracle MCP Server started')) {
          // Send SIGTERM after server is ready
          setTimeout(() => {
            serverProcess.kill('SIGTERM');
          }, 100);
        }
      });

      serverProcess.on('exit', (code) => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        resolve();
      });
    });
  }, 10000);
});
