#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { O3ProService } from './o3-service.js';
import { loadConfig } from './utils/config.js';
import { Logger } from './utils/logger.js';
import { FileTools } from './tools/file-tools.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger('DeepThink-Server');

/**
 * DeepThink MCP Server
 * Direct O3-Pro service for advanced reasoning tasks
 */
class DeepThink {
  constructor() {
    this.config = null;
    this.o3Service = null;
    this.server = null;
    this.fileTools = new FileTools();
  }

  async initialize() {
    try {
      // Validate environment setup first
      await this.validateEnvironment();
      
      // Load configuration
      this.config = await loadConfig();
      logger.info('Configuration loaded successfully');

      // Initialize O3-Pro service with file tools
      this.o3Service = new O3ProService(this.config, this.fileTools);
      logger.info('O3-Pro service initialized');

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
    // Tool list handler - providing all Claude Code tools to O3
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'deepthink',
            description: 'AI reasoning using OpenAI O3 for complex problem solving and analysis. Use this for strategic thinking, planning, and when you need to reason about information from other tools.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The question, problem, or task for deep analysis'
                },
                context: {
                  type: 'string',
                  description: 'Additional context, file contents, or background information from previous tool calls'
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
          },
          {
            name: 'bash',
            description: 'Execute shell commands in your environment. Use this for running scripts, build commands, tests, and system operations.',
            inputSchema: {
              type: 'object',
              properties: {
                cmd: {
                  type: 'string',
                  description: 'The shell command to execute'
                },
                cwd: {
                  type: 'string',
                  description: 'Working directory to execute the command in (optional)'
                }
              },
              required: ['cmd'],
              additionalProperties: false
            }
          },
          {
            name: 'read',
            description: 'Read the contents of files with line numbers. Use this to examine specific files you need to understand or analyze.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path to the file to read (relative or absolute)'
                },
                read_range: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2,
                  description: 'Line range to read [start, end] (optional)'
                }
              },
              required: ['path'],
              additionalProperties: false
            }
          },
          {
            name: 'edit_file',
            description: 'Make targeted edits to specific files by replacing old text with new text. Use this for precise code modifications.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path to the file to edit'
                },
                old_str: {
                  type: 'string',
                  description: 'The exact text to search for and replace'
                },
                new_str: {
                  type: 'string',
                  description: 'The new text to replace the old text with'
                },
                replace_all: {
                  type: 'boolean',
                  default: false,
                  description: 'Replace all occurrences (default: false)'
                }
              },
              required: ['path', 'old_str', 'new_str'],
              additionalProperties: false
            }
          },
          {
            name: 'create_file',
            description: 'Create new files or completely overwrite existing files. Use this for creating new code files or replacing entire file contents.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path where the file should be created'
                },
                content: {
                  type: 'string',
                  description: 'The content to write to the file'
                }
              },
              required: ['path', 'content'],
              additionalProperties: false
            }
          },
          {
            name: 'list_directory',
            description: 'List files and directories. Use this to explore directory structures and find files.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path to the directory to list',
                  default: '.'
                }
              },
              required: [],
              additionalProperties: false
            }
          },
          {
            name: 'grep',
            description: 'Search for patterns in file contents using ripgrep. Use this to find specific code, functions, or content across multiple files.',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Text pattern to search for'
                },
                path: {
                  type: 'string',
                  description: 'Path to search in (file or directory)'
                },
                glob: {
                  type: 'string',
                  description: 'Glob pattern to filter files (cannot be used with path)'
                },
                caseSensitive: {
                  type: 'boolean',
                  description: 'Whether search should be case sensitive',
                  default: false
                }
              },
              required: ['pattern'],
              additionalProperties: false
            }
          },
          {
            name: 'glob',
            description: 'Find files based on pattern matching. Use this to locate files by name or extension across directory trees.',
            inputSchema: {
              type: 'object',
              properties: {
                filePattern: {
                  type: 'string',
                  description: 'Glob pattern to match files (e.g., "**/*.js", "src/**/*.ts")'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return'
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip'
                }
              },
              required: ['filePattern'],
              additionalProperties: false
            }
          },
          {
            name: 'web_search',
            description: 'Search the web for information. Use this when you need up-to-date information from the internet.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                },
                num_results: {
                  type: 'number',
                  default: 5,
                  description: 'Number of search results to return'
                }
              },
              required: ['query'],
              additionalProperties: false
            }
          },
          {
            name: 'read_web_page',
            description: 'Fetch and read content from a web page. Use this to get information from specific URLs.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to fetch content from'
                },
                prompt: {
                  type: 'string',
                  description: 'Optional prompt for AI-powered analysis of the content'
                },
                raw: {
                  type: 'boolean',
                  default: false,
                  description: 'Return raw HTML instead of markdown'
                }
              },
              required: ['url'],
              additionalProperties: false
            }
          },
          {
            name: 'todo_write',
            description: 'Create and manage structured task lists. Use this to track progress and organize work.',
            inputSchema: {
              type: 'object',
              properties: {
                todos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      content: { type: 'string' },
                      status: { 
                        type: 'string', 
                        enum: ['todo', 'in-progress', 'completed'] 
                      },
                      priority: { 
                        type: 'string', 
                        enum: ['low', 'medium', 'high'] 
                      }
                    },
                    required: ['id', 'content', 'status', 'priority']
                  }
                }
              },
              required: ['todos'],
              additionalProperties: false
            }
          },
          {
            name: 'resolve_library_id',
            description: 'Resolve a package/product name to a Context7-compatible library ID. Use this first before getting library documentation.',
            inputSchema: {
              type: 'object',
              properties: {
                libraryName: {
                  type: 'string',
                  description: 'Library name to search for and retrieve a Context7-compatible library ID'
                }
              },
              required: ['libraryName'],
              additionalProperties: false
            }
          },
          {
            name: 'get_library_docs',
            description: 'Fetch up-to-date documentation for a library. Must use resolve_library_id first to get the exact library ID.',
            inputSchema: {
              type: 'object',
              properties: {
                context7CompatibleLibraryID: {
                  type: 'string',
                  description: 'Exact Context7-compatible library ID (e.g., \'/mongodb/docs\', \'/vercel/next.js\') from resolve_library_id'
                },
                tokens: {
                  type: 'number',
                  description: 'Maximum number of tokens of documentation to retrieve (default: 10000)'
                },
                topic: {
                  type: 'string',
                  description: 'Topic to focus documentation on (e.g., \'hooks\', \'routing\')'
                }
              },
              required: ['context7CompatibleLibraryID'],
              additionalProperties: false
            }
          },

        ]
      };
    });

    // Tool execution handler - O3 requests tools, oracle executes them
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        let result;
        
        if (name === 'deepthink') {
          // O3-Pro reasoning with access to tool results in context
          result = await this.o3Service.query(args);
          
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
        } else {
          // All other tools are executed by the oracle subagent
          // This creates a bridge where O3 can request tools, but oracle executes them
          const toolRequest = {
            tool: name,
            arguments: args,
            timestamp: new Date().toISOString()
          };
          
          logger.info(`O3 requested tool: ${name}`, toolRequest);
          
          // Signal to oracle that O3 wants this tool executed
          // The oracle will need to handle this execution and return results
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'execute_tool',
                  request_id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
                  iteration: (args && typeof args._iteration === 'number' ? args._iteration + 1 : 1),
                  tool: name,
                  arguments: args,
                  return_format: 'text/markdown',
                  message: `O3 requests execution of ${name} tool with provided arguments. Oracle should execute this tool and return the results.`,
                  oracle_instructions: `Execute the requested tool now, then feed as much useful context as possible back into deepthink.\n\nGuidelines:\n- Summarize large outputs; include key excerpts and links.\n- Prefer markdown with sections and bullets.\n- If libraries or APIs are involved, use Context7: first resolve_library_id, then get_library_docs with a focused topic and appropriate tokens.\n- Use other tools as needed (web_search, read_web_page, grep, glob, read) to gather facts.\n- Wrap each tool result in clear tags with request_id and iteration so deepthink can reference them.\n- Keep iterating until no further delegation is requested or an iteration cap is reached.\n- Preserve important metadata (versions, endpoints, params).`
                })
              }
            ],
            isError: false,
            _meta: {
              tool_requested: name,
              execution_type: 'oracle_delegated',
              request_id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
              iteration: (args && typeof args._iteration === 'number' ? args._iteration + 1 : 1),
              timestamp: new Date().toISOString()
            }
          };
        }
        
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
