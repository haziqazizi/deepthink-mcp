#!/usr/bin/env node

/**
 * Test script to simulate MCP protocol communication with DeepThink server
 * This mimics how Claude Code would communicate with our server
 */

import { spawn } from 'child_process';

console.log('🧪 Testing MCP Protocol Communication...\n');

// Start the server as Claude Code would
const server = spawn('node', ['src/server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test-key-for-protocol-test'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // Look for JSON-RPC responses
  const lines = responseBuffer.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line.trim());
        console.log('📥 Server Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        // Not JSON, might be logs
        if (line.includes('info:') || line.includes('error:')) {
          console.log('📋 Server Log:', line.trim());
        }
      }
    }
  }
});

server.stderr.on('data', (data) => {
  console.log('🔍 Server Error:', data.toString().trim());
});

// Send initialization message
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

setTimeout(() => {
  console.log('📤 Sending initialization...');
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}, 500);

// List tools after initialization
setTimeout(() => {
  const listToolsMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };
  
  console.log('📤 Requesting tools list...');
  server.stdin.write(JSON.stringify(listToolsMessage) + '\n');
}, 1500);

// Test a simple tool call
setTimeout(() => {
  const toolCallMessage = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'deepthink',
      arguments: {
        query: 'What is 2 + 2? Show your reasoning.',
        reasoning_level: 'low'
      }
    }
  };
  
  console.log('📤 Testing tool call...');
  server.stdin.write(JSON.stringify(toolCallMessage) + '\n');
}, 2500);

// Clean up after 10 seconds
setTimeout(() => {
  console.log('\n🏁 Test completed. Shutting down server...');
  server.kill();
  process.exit(0);
}, 10000);

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

server.on('close', (code) => {
  console.log(`\n🔚 Server exited with code ${code}`);
});
