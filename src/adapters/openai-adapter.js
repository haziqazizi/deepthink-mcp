import OpenAI from 'openai';
import { BaseAdapter } from './base-adapter.js';

/**
 * OpenAI adapter for O3 and other OpenAI models
 */
export class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey,
      timeout: config.timeout_ms || 1800000,
    });
    
    // Default parameters from config
    this.defaultParams = {
      temperature: 0.1,
      max_tokens: 100000,
      top_p: 1.0,
      ...config.default_params
    };
  }

  async call(args) {
    this.validateArgs(args);
    this.startTimer();

    try {
      // Prepare the messages array
      const messages = this.buildMessages(args);
      
      // Prepare request parameters
      const requestParams = {
        model: this.modelName,
        messages: messages,
        max_tokens: args.max_tokens || this.defaultParams.max_tokens,
        top_p: this.defaultParams.top_p,
      };

      // Only add temperature for models that support it (O3 models don't)
      if (!this.modelName.startsWith('o3')) {
        requestParams.temperature = args.temperature ?? this.defaultParams.temperature;
      }

      // Add O3-specific reasoning parameters
      if (this.supportsReasoning() && args.reasoning_level) {
        requestParams.reasoning_effort = this.mapReasoningLevel(args.reasoning_level);
      }

      // Choose API based on model type
      if (this.modelName.startsWith('o3') || this.modelName.startsWith('o4')) {
        // Use Responses API for O3/O4 models
        // For O3, prefer simple string input + optional instructions
        const instructions = args.context || 'You are a helpful AI assistant. Provide accurate, detailed, and well-reasoned responses.';
        const input = typeof args.query === 'string' ? args.query : (messages.find(m => m.role === 'user')?.content || '');

        const completion = await this.client.responses.create({
          model: this.modelName,
          instructions,
          input,
          ...(requestParams.reasoning_effort && {
            reasoning: { effort: requestParams.reasoning_effort }
          }),
          ...(requestParams.max_tokens && { max_output_tokens: requestParams.max_tokens })
        });
        
        // Prefer convenience field if available
        let responseText = completion.output_text || '';
        
        if (!responseText && Array.isArray(completion.output)) {
          for (const item of completion.output) {
            if (item.type === 'message' && Array.isArray(item.content)) {
              for (const contentItem of item.content) {
                if (contentItem.type === 'output_text' && contentItem.text) {
                  responseText += contentItem.text;
                } else if (contentItem.type === 'text' && contentItem.text) {
                  responseText += contentItem.text;
                }
              }
            }
          }
        }
        
        return this.formatResponse(
          responseText || 'No response generated',
          completion.usage || {},
          completion.model || this.modelName
        );
      } else {
        // Use Chat Completions API for other models
        const completion = await this.client.chat.completions.create(requestParams);
        
        return this.formatResponse(
          completion.choices[0].message.content,
          completion.usage,
          completion.model
        );
      }
    } catch (error) {
      this.handleError(error, 'API call');
    }
  }

  async checkAvailability() {
    try {
      const models = await this.client.models.list();
      const available = models.data.some(m => 
        m.id === this.modelName || 
        m.id.includes('o3-pro')
      );
      
      return { 
        available, 
        message: available ? 'OK' : `Model ${this.modelName} not available`,
        models_found: models.data.map(m => m.id).filter(id => 
          id.includes('o3-pro')
        )
      };
    } catch (error) {
      return { 
        available: false, 
        message: `Error checking availability: ${error.message}` 
      };
    }
  }

  /**
   * Build messages array from arguments
   */
  buildMessages(args) {
    const messages = [];
    
    // Add system message if context provided
    if (args.context) {
      messages.push({
        role: 'system',
        content: args.context
      });
    } else {
      // Default system message
      messages.push({
        role: 'system',
        content: 'You are a helpful AI assistant. Provide accurate, detailed, and well-reasoned responses.'
      });
    }
    
    // Add user query
    messages.push({
      role: 'user',
      content: args.query
    });
    
    return messages;
  }

  /**
   * Check if this model supports reasoning
   */
  supportsReasoning() {
    return this.modelName.includes('o3') || 
           this.modelName.includes('o1') ||
           this.capabilities.includes('reasoning');
  }

  /**
   * Check if this is a reasoning model that uses Responses API
   */
  isReasoningModel() {
    return this.modelName.includes('o3') || this.modelName.includes('o1');
  }

  /**
   * Map reasoning level to OpenAI's effort levels
   */
  mapReasoningLevel(level) {
    const levelMap = {
      'low': 'low',
      'medium': 'medium', 
      'high': 'high'
    };
    
    return levelMap[level] || 'medium';
  }

  /**
   * Format input for Responses API
   */
  formatInputForResponses(messages) {
    // For Responses API, we typically send the user's query as input
    const userMessage = messages.find(msg => msg.role === 'user');
    return userMessage ? userMessage.content : messages[messages.length - 1].content;
  }

  /**
   * Build parameters for Responses API
   */
  buildResponsesParams(chatParams, args) {
    const params = {
      max_output_tokens: chatParams.max_tokens,
      temperature: chatParams.temperature,
    };

    // Add reasoning configuration
    if (args.reasoning_level) {
      params.reasoning = {
        effort: this.mapReasoningLevel(args.reasoning_level),
        summary: 'auto'
      };
    }

    return params;
  }

  /**
   * Format Responses API response
   */
  formatResponsesAPIResponse(response) {
    // Extract the text content from the response
    let responseText = '';
    
    if (response.output && Array.isArray(response.output)) {
      const messageOutput = response.output.find(item => item.type === 'message');
      if (messageOutput && messageOutput.content) {
        const textContent = messageOutput.content.find(item => item.type === 'output_text');
        if (textContent) {
          responseText = textContent.text;
        }
      }
    }

    // If no structured output found, try to extract from response directly
    if (!responseText && response.content) {
      responseText = response.content;
    }

    return this.formatResponse(
      responseText || 'No response generated',
      response.usage || {},
      response.model || this.modelName
    );
  }

  /**
   * Get model-specific information
   */
  getModelInfo() {
    return {
      ...this.getCapabilities(),
      supports_reasoning: this.supportsReasoning(),
      api_type: this.isReasoningModel() ? 'responses' : 'chat_completions',
      reasoning_levels: ['low', 'medium', 'high'],
      context_window: this.getContextWindow()
    };
  }

  /**
   * Build function definitions for file operations (legacy format)
   */
  buildFunctionDefinitions() {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file with line numbers',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'list_directory',
        description: 'List the contents of a directory',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to list (defaults to current directory)'
            }
          }
        }
      },
      {
        name: 'grep_search',
        description: 'Search for text patterns in files using grep',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Text pattern to search for'
            },
            path: {
              type: 'string',
              description: 'Path to search in (defaults to current directory)'
            },
            case_sensitive: {
              type: 'boolean',
              description: 'Whether search should be case sensitive'
            }
          },
          required: ['pattern']
        }
      },
      {
        name: 'find_files',
        description: 'Find files using glob patterns',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'File name pattern to search for'
            },
            base_path: {
              type: 'string',
              description: 'Base directory to search in'
            }
          },
          required: ['pattern']
        }
      }
    ];
  }

  /**
   * Build tool definitions for O3/O4 models (new format)
   */
  buildToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read the contents of a file with line numbers',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to read'
              }
            },
            required: ['path'],
            additionalProperties: false
          },
          strict: true
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'List the contents of a directory',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the directory to list (defaults to current directory)'
              }
            },
            required: [],
            additionalProperties: false
          },
          strict: true
        }
      },
      {
        type: 'function',
        function: {
          name: 'grep_search',
          description: 'Search for text patterns in files using grep',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Text pattern to search for'
              },
              path: {
                type: 'string',
                description: 'Path to search in (defaults to current directory)'
              },
              case_sensitive: {
                type: 'boolean',
                description: 'Whether search should be case sensitive'
              }
            },
            required: ['pattern'],
            additionalProperties: false
          },
          strict: true
        }
      },
      {
        type: 'function',
        function: {
          name: 'find_files',
          description: 'Find files using glob patterns',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'File name pattern to search for'
              },
              base_path: {
                type: 'string',
                description: 'Base directory to search in'
              }
            },
            required: ['pattern'],
            additionalProperties: false
          },
          strict: true
        }
      }
    ];
  }

  /**
   * Call model with function calling support
   */
  async callWithFunctions(requestParams, args) {
    const fileTools = args.fileTools;
    let iterationCount = 0;
    const maxIterations = 10;
    const isO3Model = this.modelName.startsWith('o3') || this.modelName.startsWith('o4');

    if (isO3Model) {
      // Use Responses API for O3/O4 models
      let input = requestParams.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      while (iterationCount < maxIterations) {
        const completion = await this.client.responses.create({
          model: this.modelName,
          input: input,
          tools: requestParams.tools,
          ...(requestParams.reasoning_effort && {
            reasoning: { effort: requestParams.reasoning_effort }
          })
        });

        // Add model output to input for next iteration
        input = input.concat(completion.output);

        // Check for function calls in output
        let hasFunctionCalls = false;
        for (const item of completion.output || []) {
          if (item.type === 'function_call') {
            hasFunctionCalls = true;
            const functionName = item.name;
            const functionArgs = JSON.parse(item.arguments || '{}');

            let functionResult = await this.executeTool(functionName, functionArgs, fileTools);

            // Add function result to input
            input.push({
              type: 'function_call_output',
              call_id: item.call_id,
              output: functionResult
            });
          }
        }

        if (!hasFunctionCalls) {
          // No function calls, extract final response
          let responseText = '';
          for (const item of completion.output || []) {
            if (item.type === 'message' && item.content) {
              for (const contentItem of item.content) {
                if (contentItem.type === 'text') {
                  responseText += contentItem.text;
                }
              }
            }
          }
          
          return this.formatResponse(
            responseText || 'No response generated',
            completion.usage || {},
            completion.model || this.modelName
          );
        }

        iterationCount++;
      }

      return this.formatResponse(
        'Maximum function call iterations reached',
        {},
        this.modelName
      );
    } else {
      // Use Chat Completions API for other models
      let messages = [...requestParams.messages];

      while (iterationCount < maxIterations) {
        const completion = await this.client.chat.completions.create({
          ...requestParams,
          messages: messages
        });

        const choice = completion.choices[0];
        const message = choice.message;

        // Add the assistant's message to the conversation
        messages.push(message);

        // Check for function calls
        const functionCall = message.function_call;

        if (functionCall) {
          // Handle legacy function calls
          const functionName = functionCall.name;
          const functionArgs = JSON.parse(functionCall.arguments || '{}');

          let functionResult = await this.executeTool(functionName, functionArgs, fileTools);

          // Add function result to the conversation
          messages.push({
            role: 'function',
            name: functionName,
            content: functionResult
          });

          iterationCount++;
        } else {
          // No function call, return the final response
          return this.formatResponse(
            message.content,
            completion.usage,
            completion.model
          );
        }
      }

      return this.formatResponse(
        'Maximum function call iterations reached',
        {},
        this.modelName
      );
    }
  }

  /**
   * Execute a tool function
   */
  async executeTool(functionName, functionArgs, fileTools) {
    try {
      switch (functionName) {
        case 'read_file':
          const fileData = await fileTools.readFile(functionArgs.path);
          return fileData.content;
        case 'list_directory':
          const dirData = await fileTools.listDirectory(functionArgs.path || '.');
          return `Directory: ${dirData.path}\n` + 
            dirData.items.map(item => `${item.isDirectory ? 'd' : '-'} ${item.name}`).join('\n');
        case 'grep_search':
          const searchData = await fileTools.grep(functionArgs.pattern, {
            path: functionArgs.path || '.',
            caseSensitive: functionArgs.case_sensitive || false,
            recursive: true
          });
          return searchData.matches.map(match => 
            `${match.file}:${match.line}: ${match.content}`
          ).join('\n') || 'No matches found';
        case 'find_files':
          const findData = await fileTools.glob(functionArgs.pattern, functionArgs.base_path || '.');
          return findData.files.map(file => file.path).join('\n') || 'No files found';
        default:
          return `Error: Unknown function ${functionName}`;
      }
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Get context window size for the model
   */
  getContextWindow() {
    const contextWindows = {
      'o3-pro': 200000
    };

    for (const [model, window] of Object.entries(contextWindows)) {
      if (this.modelName.includes(model)) {
        return window;
      }
    }

    return 128000; // Default
  }
}
