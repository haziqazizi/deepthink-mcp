# DeepThink MCP Server - Claude Code Integration Guide

🧠 **Advanced AI reasoning with O3-Pro, designed for easy setup and clear error handling.**

This guide shows you how to integrate the DeepThink MCP server with Claude Code to access OpenAI O3-Pro for complex problem solving and deep analysis.

## Prerequisites

1. **Claude Code** installed and working
2. **Node.js** (v18+ recommended) 
3. **OpenAI API key** (required - others optional)
4. **AI DeepThink server** built and tested

## 🚀 Quick Integration Steps

### 1. Add to Claude Code with API Key

Add the DeepThink server to Claude Code with your API key:

```bash
claude mcp add deepthink-mcp --scope user --env OPENAI_API_KEY=your-api-key-here -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
```

### 2. Start Claude Code

```bash
claude
```

### 3. Verify Connection

Inside Claude Code, check that the MCP server is connected:

```
/mcp
```

You should see `deepthink-mcp` listed as a connected server.

### 4. Test the Tools

Try using the DeepThink tools:

```
Use deepthink to solve: What is 15 * 23?
```

Claude will prompt you to approve using the tool - click "Yes" to proceed.

## Available Tool

Once integrated, you'll have access to this tool in Claude Code:

### 🧠 **deepthink** 
Advanced AI reasoning using OpenAI O3-Pro for complex problem solving and analysis
- **Query**: Your question, problem, or task for deep analysis (required)
- **Context** (optional): Additional context or background information
- **Reasoning Level**: low/medium/high (default: high - recommended for complex problems)
- **Max Tokens**: Maximum tokens for response (default: 4000)

## Integration Scopes

### Local Scope (Recommended)
```bash
claude mcp add deepthink-mcp --scope local -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
```
- Private to you only
- Stored in user settings
- Best for personal development

### Project Scope (Team Sharing)
```bash
claude mcp add deepthink-mcp --scope project -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
```
- Creates `.mcp.json` in project root
- Can be shared with team via git
- Requires approval for security

### User Scope (Global)
```bash
claude mcp add deepthink-mcp --scope user -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
```
- Available across all projects
- Private to your user account

## Configuration File Method

Alternatively, you can manually create a `.mcp.json` file in your project:

```json
{
  "mcpServers": {
    "deepthink-mcp": {
      "command": "node",
      "args": ["src/server.js"],
      "cwd": "/Users/haziqazizi/code/deepthink-mcp",
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info",
        "CONFIG_PATH": "config/models.yaml"
      }
    }
  }
}
```

This method uses environment variable expansion, so make sure your API keys are set in your shell environment.

## Managing the Integration

### List all MCP servers
```bash
claude mcp list
```

### Get server details
```bash
claude mcp get deepthink-mcp
```

### Remove the server
```bash
claude mcp remove deepthink-mcp
```

### Check status in Claude Code
```
/mcp
```

## Usage Examples

### Example 1: Automatic Model Selection
```
Use deepthink to analyze this complex data pattern and provide insights: [your data]
```
→ DeepThink will automatically choose the best model (likely O3 for analysis)

### Example 2: Specific Model Request  
```
Use deepthink with model o3-mini to quickly calculate compound interest for $1000 at 5% for 10 years
```

### Example 3: High Reasoning Tasks
```
Use deepthink with high reasoning level to solve this multi-step logic puzzle: [puzzle]
```

### Example 4: Complex Analysis
```
Use deepthink to analyze the architectural patterns in this codebase and suggest improvements: [code context]
```

### Example 5: Problem Solving
```
Use deepthink to break down this complex algorithm optimization problem step by step: [problem description]
```

## 🔧 Troubleshooting

DeepThink provides clear, helpful error messages. Here are common issues and solutions:

### 🔑 API Key Issues

**"OpenAI API key not found"**
- **Fix**: Re-add the server with your API key:
  ```bash
  claude mcp remove deepthink-mcp
  claude mcp add deepthink-mcp --scope user --env OPENAI_API_KEY=your-key-here -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
  ```
- **Verify**: Your key starts with `sk-`

**"Invalid OpenAI API key"**
- Get a new key: https://platform.openai.com/api-keys
- Update your MCP configuration with the new key
- Restart Claude Code

### 💳 Quota & Billing Issues

**"API quota exceeded"**
- Check usage: https://platform.openai.com/usage
- Add billing information if needed
- O3 models require credits

**"Rate limit exceeded"**  
- Wait 1-2 minutes before trying again
- Use lower reasoning levels: `reasoning_level: "medium"` or `"low"`
- O3 models have strict rate limits

### 🤖 Model Access Issues

**"O3-Pro model not available"**
- O3 models are in limited preview
- Check if your account has access
- Contact OpenAI support for access

### 🔧 Connection Issues

**"Connection closed" errors**
- **Windows users**: Use `cmd /c` wrapper:
  ```bash
  claude mcp add deepthink-mcp -- cmd /c node /Users/haziqazizi/code/deepthink-mcp/src/server.js
  ```
- **All users**: Verify the file path is correct

**"Server not responding"**
- Run diagnostics: `node test-isolated.js` (may fail due to missing env vars)
- Check the error messages in Claude Code
- Verify your API key is correctly set in the MCP configuration

**"Tool not found" errors**
- Verify connection: `/mcp` in Claude Code
- Remove and re-add the server:
  ```bash
  claude mcp remove deepthink-mcp
  claude mcp add deepthink-mcp --scope local -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
  ```

### 🆘 Need More Help?

1. **Check server status**: `claude mcp list`
2. **View logs**: Look for clear error messages in Claude Code  
3. **Re-add server**: Remove and add with correct API key

## Security Notes

- **API Keys**: Keep your API keys secure and never commit them to version control
- **Local Scope**: Use local scope for personal development to keep your configuration private
- **Project Scope**: Only use project scope when you trust your team members with the configuration
- **Rate Limits**: The server includes built-in rate limiting to prevent API abuse

## Performance Tips

- **Model Selection**: Let DeepThink choose the model automatically for best cost/performance balance
- **Reasoning Levels**: Use "low" or "medium" for O3 models unless you need maximum reasoning capability
- **Caching**: The server caches model health checks to improve performance

---

🎉 **You're all set!** Your DeepThink MCP server is now integrated with Claude Code, giving you access to multiple AI models with intelligent routing and cost optimization.

For updates and advanced configuration, see the main project documentation in `/Users/haziqazizi/code/deepthink-mcp/plan.md`.
