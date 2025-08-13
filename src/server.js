#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ModelRouter } from './router/index.js';
import { loadConfig } from './utils/config.js';
import { Logger } from './utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger('DeepThink-Server');

/**
 * DeepThink MCP Server
 * Routes queries to specific AI models like OpenAI O3, Gemini, Claude, etc.
 */
class DeepThink {
  constructor() {
    this.config = null;
    this.router = null;
    this.server = null;
  }

  async initialize() {
    try {
      // Validate environment setup first
      await this.validateEnvironment();
      
      // Load configuration
      this.config = await loadConfig();
      logger.info('Configuration loaded successfully');

      // Initialize model router
      this.router = new ModelRouter(this.config);
      logger.info('Model router initialized');

      // Create MCP server
      this.server = new Server(
        {
          name: 'deepthink-mcp',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: { listChanged: true },
            resources: {},
            logging: {}
          }
        }
      );

      // Register request handlers
      this.setupRequestHandlers();
      
      logger.info('DeepThink MCP server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  /**
   * Validate environment setup and provide helpful error messages
   */
  async validateEnvironment() {
    // Check if OpenAI API key is present
    if (!process.env.OPENAI_API_KEY) {
      const errorMessage = `🔑 OpenAI API key not found!

Please set up your API key in Claude Code's MCP configuration:

1. Remove the current server:
   claude mcp remove deepthink-mcp

2. Add it back with your API key:
   claude mcp add deepthink-mcp --scope user --env OPENAI_API_KEY=your-api-key-here -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js

3. Get your API key from: https://platform.openai.com/api-keys

The API key will be stored securely in Claude Code's configuration.
`;
      
      logger.error('Missing OpenAI API key');
      throw new Error(errorMessage);
    }

    // Validate API key format
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      const errorMessage = `🔑 Invalid OpenAI API key format!

Your API key should start with 'sk-'. Please:

1. Get a valid API key from: https://platform.openai.com/api-keys
2. Update your MCP configuration:
   claude mcp remove deepthink-mcp
   claude mcp add deepthink-mcp --scope user --env OPENAI_API_KEY=sk-your-valid-key -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js

Expected format: sk-xxxxxxxxxxxxxxxxxxxxxxxxxx
`;
      
      logger.error('Invalid OpenAI API key format');
      throw new Error(errorMessage);
    }

    logger.info('✅ OpenAI API key found and validated');

    // Quick API connectivity test (optional - don't block startup)
    try {
      // We'll do a minimal test during first actual request instead
      // to avoid blocking startup with network calls
      logger.info('Environment validation completed');
    } catch (error) {
      // Non-blocking warning
      logger.warn('Could not verify API connectivity during startup:', error.message);
    }
  }

  setupRequestHandlers() {
    // Tool list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'deepthink',
            description: 'Advanced AI reasoning using OpenAI O3-Pro for complex problem solving and analysis.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The question, problem, or task for deep analysis'
                },
                context: {
                  type: 'string',
                  description: 'Additional context or background information'
                },
                reasoning_level: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  default: 'high',
                  description: 'Reasoning depth level - high recommended for complex problems'
                },
                max_tokens: {
                  type: 'number',
                  default: 4000,
                  description: 'Maximum tokens for response'
                }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        let result;
        
        if (name === 'deepthink') {
          result = await this.router.routeQuery(args);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: result.response || 'Operation completed successfully'
            }
          ],
          isError: false,
          _meta: {
            model_used: result.model,
            tokens_used: result.usage?.total_tokens || 0,
            input_tokens: result.usage?.input_tokens || 0,
            output_tokens: result.usage?.output_tokens || 0,
            reasoning_tokens: result.usage?.reasoning_tokens || 0,
            cost_usd: result.cost || 0,
            duration_ms: result.duration || 0,
            timestamp: result.timestamp || new Date().toISOString()
          }
        };
        
      } catch (error) {
        logger.error(`Tool execution failed for ${name}:`, error);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true,
          _meta: {
            error_code: error.code || 'UNKNOWN_ERROR',
            error_type: error.constructor.name,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    logger.info('Request handlers registered');
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('DeepThink MCP Server started and listening on stdio');
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const deepthink = new DeepThink();
  
  try {
    await deepthink.initialize();
    await deepthink.start();
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default DeepThink;
