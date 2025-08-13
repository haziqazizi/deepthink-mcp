# DeepThink MCP Server - Implementation Plan

## Overview

This project implements custom MCP (Model Context Protocol) tools for Claude Code that enable routing queries to specific AI models like OpenAI's O3, similar to Amp's Oracle feature. The system provides both direct model access and intelligent routing capabilities through the DeepThink interface.

## Project Goals

- Create MCP tools that can route queries to different AI models (O3, Gemini, Claude, etc.)
- Provide both explicit model selection and intelligent routing
- Implement secure API key management and usage tracking
- Build an extensible architecture for adding new models
- Integrate seamlessly with Claude Code's workflow

## Architecture Overview

### Layer Structure
```
┌──────────────────────────────────────────────────────────────┐
│ Claude Code (MCP Client)                                     │
└─────────────────────┬────────────────────────────────────────┘
                      │ MCP Protocol (JSON-RPC 2.0)
┌─────────────────────▼────────────────────────────────────────┐
│ MCP Entry Layer                                              │
│ - Request validation                                         │
│ - Tool registration                                          │
│ - Response formatting                                        │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│ Router Layer                                                 │
│ - Model selection logic                                      │
│ - Caching & rate limiting                                    │
│ - Usage tracking & cost management                           │
│ - Circuit breakers & fallbacks                               │
└─────────────────────┬────────────────────────────────────────┘
                      │ Adapter Interface
┌─────────────────────▼────────────────────────────────────────┐
│ Adapter Layer                                                │
│ ┌────────────┐ ┌─────────────┐ ┌─────────────┐              │
│ │ O3 Adapter │ │Gemini Adptr │ │Claude Adptr │              │
│ └────────────┘ └─────────────┘ └─────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Approach: Hybrid Router Pattern

### Option 1: Direct Model Tools
- `consult_o3` - Direct access to OpenAI O3
- `consult_gemini` - Direct access to Google Gemini
- `consult_claude` - Direct access to Anthropic Claude

### Option 2: Smart Router Tool
- `ai_oracle` - Intelligent model selection based on query type
- Supports explicit model specification via parameters
- Can choose optimal model automatically

### Recommended: Both Approaches
Implement both patterns to give users flexibility:
- Power users can call specific models directly
- General users can rely on intelligent routing

## File Structure

```
oracle-mcp/
├── plan.md                    # This file
├── package.json              # Node.js dependencies
├── src/
│   ├── server.js             # Main MCP server
│   ├── router/
│   │   ├── index.js          # Router logic
│   │   └── model-selector.js # Model selection algorithms
│   ├── adapters/
│   │   ├── base-adapter.js   # Abstract adapter interface
│   │   ├── openai-adapter.js # OpenAI O3 integration
│   │   ├── google-adapter.js # Google Gemini integration
│   │   └── anthropic-adapter.js # Anthropic Claude integration
│   ├── utils/
│   │   ├── config.js         # Configuration management
│   │   ├── logger.js         # Logging utilities
│   │   └── metrics.js        # Usage tracking
│   └── security/
│       ├── auth.js           # API key management
│       └── rate-limiter.js   # Rate limiting
├── config/
│   ├── models.yaml           # Model configurations
│   └── mcp-config.json       # MCP client configuration
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
└── docs/
    └── usage.md              # Usage documentation
```

## Detailed Implementation

### 1. Core MCP Server (`src/server.js`)

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ModelRouter } from './router/index.js';
import { loadConfig } from './utils/config.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('oracle-mcp-server');
const config = loadConfig();
const router = new ModelRouter(config);

const server = new Server(
  { 
    name: 'ai-oracle', 
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

// Tool definitions
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'ai_oracle',
      description: 'Route queries to specific AI models with intelligent selection',
      inputSchema: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'The question or task for the AI model' 
          },
          model: { 
            type: 'string', 
            enum: config.availableModels,
            description: 'Specific model to use (optional - will auto-select if not provided)'
          },
          context: { 
            type: 'string', 
            description: 'Additional context or instructions' 
          },
          reasoning_level: { 
            type: 'string', 
            enum: ['standard', 'deep'], 
            default: 'standard',
            description: 'Level of reasoning required (for compatible models)'
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
      name: 'consult_o3',
      description: 'Direct access to OpenAI O3 for complex reasoning tasks',
      inputSchema: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'Query for O3 model' 
          },
          reasoning_level: { 
            type: 'string', 
            enum: ['standard', 'deep'], 
            default: 'standard' 
          },
          temperature: { 
            type: 'number', 
            minimum: 0, 
            maximum: 2, 
            default: 0.1 
          }
        },
        required: ['query']
      }
    },
    {
      name: 'consult_gemini',
      description: 'Direct access to Google Gemini Pro for multimodal tasks',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.2 },
          include_context: { type: 'boolean', default: true }
        },
        required: ['query']
      }
    },
    {
      name: 'list_available_models',
      description: 'Get list of currently available AI models and their capabilities',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  ]
}));

// Tool execution
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result;
    
    switch (name) {
      case 'ai_oracle':
        result = await router.routeQuery(args);
        break;
      
      case 'consult_o3':
        result = await router.callModel('o3', args);
        break;
      
      case 'consult_gemini':
        result = await router.callModel('gemini-pro', args);
        break;
      
      case 'list_available_models':
        result = await router.listModels();
        break;
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: result.response
        }
      ],
      isError: false,
      _meta: {
        model_used: result.model,
        tokens_used: result.usage?.total_tokens || 0,
        cost_usd: result.cost || 0,
        duration_ms: result.duration
      }
    };
    
  } catch (error) {
    logger.error('Tool execution failed', { tool: name, error: error.message });
    
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('AI Oracle MCP Server started');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default server;
```

### 2. Model Router (`src/router/index.js`)

```javascript
import { ModelSelector } from './model-selector.js';
import { OpenAIAdapter } from '../adapters/openai-adapter.js';
import { GoogleAdapter } from '../adapters/google-adapter.js';
import { AnthropicAdapter } from '../adapters/anthropic-adapter.js';
import { RateLimiter } from '../security/rate-limiter.js';
import { MetricsCollector } from '../utils/metrics.js';

export class ModelRouter {
  constructor(config) {
    this.config = config;
    this.selector = new ModelSelector(config);
    this.rateLimiter = new RateLimiter(config.rateLimits);
    this.metrics = new MetricsCollector();
    
    // Initialize adapters
    this.adapters = new Map([
      ['o3', new OpenAIAdapter(config.models.o3)],
      ['o3-pro', new OpenAIAdapter(config.models['o3-pro'])],
      ['gemini-pro', new GoogleAdapter(config.models['gemini-pro'])],
      ['claude-3-5-sonnet', new AnthropicAdapter(config.models['claude-3-5-sonnet'])]
    ]);
  }

  async routeQuery(args) {
    const startTime = Date.now();
    
    // Check rate limits
    await this.rateLimiter.checkLimit(args.query);
    
    // Select model (explicit or automatic)
    const modelId = args.model || await this.selector.selectBestModel(args.query, args.context);
    
    // Execute query
    const result = await this.callModel(modelId, args);
    
    // Record metrics
    this.metrics.record({
      model: modelId,
      tokens: result.usage?.total_tokens || 0,
      cost: result.cost || 0,
      duration: Date.now() - startTime,
      success: !result.error
    });
    
    return result;
  }

  async callModel(modelId, args) {
    const adapter = this.adapters.get(modelId);
    if (!adapter) {
      throw new Error(`Model not available: ${modelId}`);
    }

    return await adapter.call(args);
  }

  async listModels() {
    const models = [];
    
    for (const [id, adapter] of this.adapters) {
      const status = await adapter.checkAvailability();
      models.push({
        id,
        name: adapter.name,
        provider: adapter.provider,
        capabilities: adapter.capabilities,
        available: status.available,
        cost_per_1k_tokens: adapter.costPer1kTokens
      });
    }

    return {
      response: JSON.stringify(models, null, 2),
      model: 'system',
      usage: { total_tokens: 0 },
      cost: 0
    };
  }
}
```

### 3. Base Adapter Interface (`src/adapters/base-adapter.js`)

```javascript
export class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.name = config.name;
    this.provider = config.provider;
    this.capabilities = config.capabilities || [];
    this.costPer1kTokens = config.cost_per_1k_tokens || 0;
  }

  async call(args) {
    throw new Error('call() method must be implemented by subclass');
  }

  async checkAvailability() {
    throw new Error('checkAvailability() method must be implemented by subclass');
  }

  formatResponse(response, usage, model) {
    return {
      response: response,
      model: model,
      usage: usage,
      cost: this.calculateCost(usage),
      duration: Date.now() - this.startTime
    };
  }

  calculateCost(usage) {
    if (!usage || !usage.total_tokens) return 0;
    return (usage.total_tokens / 1000) * this.costPer1kTokens;
  }

  validateArgs(args, requiredFields = ['query']) {
    for (const field of requiredFields) {
      if (!args[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
}
```

### 4. OpenAI O3 Adapter (`src/adapters/openai-adapter.js`)

```javascript
import OpenAI from 'openai';
import { BaseAdapter } from './base-adapter.js';

export class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async call(args) {
    this.validateArgs(args);
    this.startTime = Date.now();

    const messages = [
      {
        role: 'system',
        content: args.context || 'You are a helpful AI assistant.'
      },
      {
        role: 'user',
        content: args.query
      }
    ];

    const requestParams = {
      model: this.config.model_name || 'o3',
      messages: messages,
      max_tokens: args.max_tokens || this.config.default_params?.max_tokens || 4000,
      temperature: args.temperature ?? this.config.default_params?.temperature ?? 0.1
    };

    // Add O3-specific reasoning parameters if applicable
    if (args.reasoning_level === 'deep' && this.config.model_name?.includes('o3')) {
      requestParams.reasoning_effort = 'high';
    }

    try {
      const completion = await this.client.chat.completions.create(requestParams);
      
      return this.formatResponse(
        completion.choices[0].message.content,
        completion.usage,
        completion.model
      );
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async checkAvailability() {
    try {
      const models = await this.client.models.list();
      const available = models.data.some(m => m.id.includes('o3'));
      return { available, message: available ? 'OK' : 'O3 models not available' };
    } catch (error) {
      return { available: false, message: error.message };
    }
  }
}
```

### 5. Model Selection Logic (`src/router/model-selector.js`)

```javascript
export class ModelSelector {
  constructor(config) {
    this.config = config;
    this.modelCapabilities = this.buildCapabilityMatrix();
  }

  buildCapabilityMatrix() {
    return {
      'o3': {
        reasoning: 10,
        coding: 9,
        analysis: 10,
        math: 10,
        creative: 7,
        speed: 4,
        cost: 3
      },
      'o3-pro': {
        reasoning: 10,
        coding: 10,
        analysis: 10,
        math: 10,
        creative: 8,
        speed: 2,
        cost: 1
      },
      'gemini-pro': {
        reasoning: 8,
        coding: 8,
        analysis: 9,
        math: 8,
        creative: 9,
        speed: 8,
        cost: 8,
        multimodal: 10
      },
      'claude-3-5-sonnet': {
        reasoning: 9,
        coding: 9,
        analysis: 9,
        math: 8,
        creative: 9,
        speed: 7,
        cost: 6
      }
    };
  }

  async selectBestModel(query, context = '') {
    const queryAnalysis = this.analyzeQuery(query, context);
    let bestScore = -1;
    let bestModel = 'o3'; // default

    for (const [modelId, capabilities] of Object.entries(this.modelCapabilities)) {
      const score = this.calculateScore(queryAnalysis, capabilities);
      if (score > bestScore) {
        bestScore = score;
        bestModel = modelId;
      }
    }

    return bestModel;
  }

  analyzeQuery(query, context) {
    const text = (query + ' ' + context).toLowerCase();
    
    const weights = {
      reasoning: this.countKeywords(text, [
        'analyze', 'reasoning', 'logic', 'solve', 'complex', 'think', 'deduce', 
        'infer', 'conclude', 'problem', 'strategy', 'approach', 'plan'
      ]),
      coding: this.countKeywords(text, [
        'code', 'programming', 'function', 'algorithm', 'debug', 'implement',
        'javascript', 'python', 'typescript', 'react', 'api', 'database'
      ]),
      analysis: this.countKeywords(text, [
        'analyze', 'examine', 'review', 'evaluate', 'assess', 'study',
        'investigate', 'research', 'data', 'statistics'
      ]),
      math: this.countKeywords(text, [
        'calculate', 'equation', 'formula', 'mathematics', 'algebra',
        'statistics', 'probability', 'number', 'compute'
      ]),
      creative: this.countKeywords(text, [
        'creative', 'write', 'story', 'poem', 'brainstorm', 'design',
        'innovative', 'generate', 'create', 'imagine'
      ]),
      speed: text.includes('quick') || text.includes('fast') || text.includes('urgent') ? 5 : 1,
      cost: text.includes('budget') || text.includes('cheap') || text.includes('cost') ? 5 : 1
    };

    return weights;
  }

  countKeywords(text, keywords) {
    return keywords.reduce((count, keyword) => {
      return count + (text.split(keyword).length - 1);
    }, 0);
  }

  calculateScore(queryAnalysis, capabilities) {
    let score = 0;
    const totalWeight = Object.values(queryAnalysis).reduce((a, b) => a + b, 0) || 1;

    for (const [aspect, queryWeight] of Object.entries(queryAnalysis)) {
      if (capabilities[aspect]) {
        const normalizedWeight = queryWeight / totalWeight;
        score += normalizedWeight * capabilities[aspect];
      }
    }

    return score;
  }
}
```

### 6. Configuration Management (`config/models.yaml`)

```yaml
# AI Oracle Model Configuration
version: "1.0"

models:
  o3:
    provider: openai
    model_name: "o3"
    name: "OpenAI O3"
    endpoint: "https://api.openai.com/v1/chat/completions"
    capabilities: ["reasoning", "coding", "analysis", "math"]
    cost_per_1k_tokens: 0.060
    default_params:
      temperature: 0.1
      max_tokens: 4000
    rate_limit:
      requests_per_minute: 50
      requests_per_day: 1000

  o3-pro:
    provider: openai
    model_name: "o3-pro"
    name: "OpenAI O3 Pro"
    endpoint: "https://api.openai.com/v1/chat/completions"
    capabilities: ["reasoning", "coding", "analysis", "math", "research"]
    cost_per_1k_tokens: 0.200
    default_params:
      temperature: 0.05
      max_tokens: 8000
    rate_limit:
      requests_per_minute: 20
      requests_per_day: 200

  gemini-pro:
    provider: google
    model_name: "gemini-pro"
    name: "Google Gemini Pro"
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    capabilities: ["reasoning", "coding", "analysis", "creative", "multimodal"]
    cost_per_1k_tokens: 0.025
    default_params:
      temperature: 0.2
      max_tokens: 4000
    rate_limit:
      requests_per_minute: 100
      requests_per_day: 2000

  claude-3-5-sonnet:
    provider: anthropic
    model_name: "claude-3-5-sonnet-20241022"
    name: "Claude 3.5 Sonnet"
    endpoint: "https://api.anthropic.com/v1/messages"
    capabilities: ["reasoning", "coding", "analysis", "creative", "writing"]
    cost_per_1k_tokens: 0.015
    default_params:
      temperature: 0.3
      max_tokens: 4000
    rate_limit:
      requests_per_minute: 80
      requests_per_day: 1500

# Global settings
settings:
  default_model: "o3"
  fallback_model: "claude-3-5-sonnet"
  max_retries: 3
  timeout_ms: 30000
  cache_ttl: 300
  
  budget_limits:
    daily_cost_limit: 10.00
    weekly_cost_limit: 50.00
    monthly_cost_limit: 200.00
    
  rate_limiting:
    global_requests_per_minute: 200
    per_user_requests_per_minute: 50
```

### 7. MCP Client Configuration (`config/mcp-config.json`)

```json
{
  "mcpServers": {
    "ai-oracle": {
      "command": "node",
      "args": ["./src/server.js"],
      "cwd": "/Users/haziqazizi/code/oracle-mcp",
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Security Implementation

### API Key Management
- **Environment Variables Only**: Never hardcode keys
- **Hot Reload**: Support key rotation without restart
- **Per-Key Budget Limits**: Prevent cost overruns
- **Audit Logging**: Track all API usage

### Request Validation
```javascript
// src/security/validator.js
export class RequestValidator {
  static validateModelId(modelId, allowedModels) {
    if (!allowedModels.includes(modelId)) {
      throw new Error(`Invalid model: ${modelId}`);
    }
  }

  static sanitizeQuery(query) {
    // Remove potential injection attempts
    return query.replace(/[<>\"']/g, '');
  }

  static validateTokenLimit(tokens, maxTokens = 8000) {
    if (tokens > maxTokens) {
      throw new Error(`Token limit exceeded: ${tokens} > ${maxTokens}`);
    }
  }
}
```

### Rate Limiting (`src/security/rate-limiter.js`)
```javascript
export class RateLimiter {
  constructor(config) {
    this.limits = config;
    this.usage = new Map();
  }

  async checkLimit(identifier) {
    const now = Date.now();
    const usage = this.usage.get(identifier) || { count: 0, resetTime: now + 60000 };

    if (now > usage.resetTime) {
      usage.count = 0;
      usage.resetTime = now + 60000;
    }

    if (usage.count >= this.limits.requests_per_minute) {
      throw new Error('Rate limit exceeded');
    }

    usage.count++;
    this.usage.set(identifier, usage);
  }
}
```

## Usage Examples

### Command Line Usage
```bash
# Use intelligent routing
claude -p "Design a microservices architecture for a fintech app" \
  --mcp-config config/mcp-config.json \
  --allowedTools "mcp__ai-oracle__ai_oracle" \
  --append-system-prompt "Use the most appropriate AI model for this architectural task"

# Use specific model (O3)
claude -p "Solve this complex algorithmic problem: [problem description]" \
  --mcp-config config/mcp-config.json \
  --allowedTools "mcp__ai-oracle__consult_o3" \
  --append-system-prompt "Use deep reasoning mode for this problem"

# List available models
claude -p "What AI models are currently available?" \
  --mcp-config config/mcp-config.json \
  --allowedTools "mcp__ai-oracle__list_available_models"
```

### TypeScript SDK Usage
```typescript
import { query } from "@anthropic-ai/claude-code";

// Smart routing example
for await (const message of query({
  prompt: "Debug this performance bottleneck in our React app",
  options: {
    mcpConfig: "config/mcp-config.json",
    allowedTools: ["mcp__ai-oracle__ai_oracle"],
    systemPrompt: "You are a senior React developer. Use the best AI model for code analysis.",
    maxTurns: 3
  }
})) {
  if (message.type === "result") {
    console.log(`Model used: ${message._meta?.model_used}`);
    console.log(`Cost: $${message._meta?.cost_usd}`);
    console.log(message.result);
  }
}
```

## Testing Strategy

### Unit Tests
- Test each adapter independently
- Mock external API calls
- Validate request/response transformations

### Integration Tests
- Test full MCP flow
- Verify tool registration and discovery
- Test error handling and fallbacks

### Load Tests
- Test rate limiting behavior
- Verify cost controls work under load
- Test concurrent requests

## Deployment Considerations

### Local Development
```bash
# Install dependencies
npm install

# Set environment variables
export OPENAI_API_KEY="your-openai-key"
export GOOGLE_API_KEY="your-google-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# Start the MCP server
npm run dev
```

### Production
- Use process managers (PM2, systemd)
- Implement proper logging and monitoring
- Set up health checks and alerts
- Configure log rotation

## Cost Management

### Budget Controls
- Daily/weekly/monthly spending limits
- Per-user cost tracking
- Alert system for threshold breaches
- Automatic model fallbacks for cost optimization

### Usage Optimization
- Caching for repeated queries
- Token counting and optimization
- Smart model selection to balance cost vs quality
- Batch processing for efficiency

## Monitoring and Observability

### Metrics to Track
- Request volume per model
- Response latency by model
- Error rates and types
- Cost per request/user/day
- Token usage patterns

### Logging
- Structured JSON logs
- Request/response correlation IDs
- Security events (rate limit hits, invalid models)
- Performance metrics

### Alerts
- API key approaching limits
- Unusual cost spikes
- Model availability issues
- High error rates

## Future Enhancements

### Phase 2 Features
- Support for image inputs (multimodal)
- Conversation memory across sessions
- Custom model fine-tuning integration
- A/B testing between models

### Phase 3 Features
- Web UI for model management
- Advanced analytics dashboard
- Custom model training pipelines
- Enterprise SSO integration

## Oracle Expert Recommendations Summary

Based on Oracle's analysis, this implementation follows best practices:

1. **Clean Architecture**: Proper separation of concerns with adapter pattern
2. **Security First**: Server-side key management with validation
3. **Extensible Design**: Configuration-driven model addition
4. **Production Ready**: Rate limiting, monitoring, cost controls
5. **User Friendly**: Both explicit and intelligent model selection

The hybrid router pattern provides the flexibility users need while maintaining security and extensibility for future growth.

## Getting Started

1. Clone/create the project structure
2. Install dependencies (`npm install`)
3. Configure API keys in environment
4. Update `config/models.yaml` with your preferences
5. Test with Claude Code integration
6. Deploy and monitor usage

This implementation provides a robust foundation for AI model routing that can scale from personal use to enterprise deployment.
