# 🧠 DeepThink MCP Server

**Give Claude Code superpowers with OpenAI's most advanced AI model (O3-Pro)!**

> **📖 New to this?** DeepThink makes Claude Code much smarter by connecting it to OpenAI's best AI model. Think of it as adding a "super brain" mode to Claude Code for solving really hard problems.

DeepThink adds a powerful "deepthink" tool to Claude Code that can solve complex problems, analyze code, and provide deep reasoning that goes beyond normal AI capabilities.

## 🎯 What Does This Do?

- **🧠 Advanced Problem Solving**: Tackle complex logic, math, and analysis tasks
- **💻 Code Analysis**: Get deep insights into code architecture and optimization  
- **🔍 Research Tasks**: Break down complex topics with thorough reasoning
- **🚀 Easy to Use**: Just type "Use deepthink to..." in Claude Code

**Example**: Instead of a basic answer, deepthink can work through multi-step problems, consider edge cases, and provide detailed reasoning.

## 🚀 Super Simple Setup (3 Steps!)

### Step 1: Get Your OpenAI API Key (2 minutes)

1. Go to [OpenAI's website](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

> **💡 Tip**: You'll need a paid OpenAI account for O3-Pro access. It's premium but worth it!

### Step 2: Add to Claude Code with API Key (30 seconds)

Copy and paste this command, replacing `your-api-key-here` with your actual API key:

```bash
claude mcp add deepthink-mcp --scope user --env OPENAI_API_KEY=your-api-key-here -- node /Users/haziqazizi/code/deepthink-mcp/src/server.js
```

### Step 3: Verify Connection (10 seconds)

Run this to check it's working:

```bash
claude mcp list
```

You should see: `deepthink-mcp: ✓ Connected`

**That's it!** 🎉

## 🎮 How to Use

In Claude Code, just type:

```
Use deepthink to solve: What's the best approach to optimize this database query?
```

Or:

```
Use deepthink to analyze this code and suggest improvements: [paste your code]
```

## 🌟 Real Examples

**Complex Problem Solving:**
```
Use deepthink to solve: I have a traveling salesman problem with 15 cities. What's the most efficient approach considering both computation time and solution quality?
```

**Code Architecture:**
```
Use deepthink to analyze this microservices setup and suggest improvements for scalability: [paste your architecture]
```

**Research & Analysis:**
```
Use deepthink to break down the pros and cons of different database indexing strategies for a high-traffic application
```

## ❓ FAQ for Beginners

**Q: Do I need to be a programmer to use this?**
A: Not at all! If you can use Claude Code, you can use DeepThink. Just type natural questions.

**Q: How much does OpenAI O3-Pro cost?**
A: O3-Pro is premium (~$60 per million tokens), but you only pay for what you use. Most queries cost $0.10-$1.00.

**Q: What if I get stuck?**
A: Run `npm run setup` again - it will walk you through everything step by step!

**Q: Is this safe?**
A: Yes! Your API key stays on your computer and only you can access it.

## 🔧 Alternative Setup (For Advanced Users)

If you prefer manual setup:

1. **Get OpenAI API Key**: Visit https://platform.openai.com/api-keys
2. **Create `.env` file**: `echo "OPENAI_API_KEY=your-key-here" > .env`
3. **Test setup**: `node test-isolated.js`
4. **Add to Claude Code**: Use the command from Step 3 above

## 🛠️ Technical Details

### `deepthink`
Advanced AI reasoning using OpenAI O3-Pro

**Parameters:**
- **query** (required): Your question or problem
- **context** (optional): Additional background info
- **reasoning_level** (optional): `low`/`medium`/`high` (default: `high`)
- **max_tokens** (optional): Response length limit (default: 4000)

## 💡 Usage Examples

**Simple Query:**
```
Use deepthink to explain quantum computing
```

**With Context:**
```
Use deepthink to optimize this database query with context about our user table having 10M records
```

**High Reasoning:**
```
Use deepthink with high reasoning level to solve this complex mathematical proof
```

## 🆘 Help! Something's Not Working

**Don't panic!** 😊 DeepThink gives you clear error messages to help fix issues quickly.

### ⚡ Quick Fixes

**"Can't find API key" or similar errors:**
```bash
# Just run the setup again - it's that easy!
npm run setup
```

**"Something went wrong" errors:**
```bash  
# Check if everything is working
node test-isolated.js

# See what Claude Code sees
claude mcp list
```

**Still stuck?**
- Look at the detailed troubleshooting in `INTEGRATION.md`
- The error messages will guide you step-by-step
- Most issues are just API key problems - super easy to fix!

## 📊 Features

- ✅ **O3-Pro Only**: Configured for maximum reasoning power
- ✅ **User-Friendly**: Clear error messages and setup guidance
- ✅ **Automatic**: Smart parameter handling for O3 models
- ✅ **Integrated**: Seamless Claude Code integration
- ✅ **Robust**: Comprehensive error handling and validation

## 📁 Project Structure

```
deepthink-mcp/
├── src/
│   ├── server.js          # Main MCP server
│   ├── router/            # Query routing logic
│   ├── adapters/          # AI model integrations
│   └── utils/             # Utilities and logging
├── config/
│   └── models.yaml        # Model configuration
├── setup.js               # Interactive setup script
├── test-isolated.js       # Validation tests
└── INTEGRATION.md         # Detailed integration guide
```

## 🎊 You Did It!

Once you've followed the setup steps above, you'll have:
- ✅ **The smartest AI** (O3-Pro) working inside Claude Code
- ✅ **Super easy access** - just type "Use deepthink to..." 
- ✅ **Advanced problem-solving** for complex tasks
- ✅ **Professional-grade analysis** for your work

**Try it now**: Open Claude Code and type:
```
Use deepthink to explain the difference between O3-Pro and regular AI models
```

---

🎉 **Welcome to the future of AI reasoning!** 🧠✨
