/**
 * Intelligent model selector for routing queries to the best model
 */
export class ModelSelector {
  constructor(config) {
    this.config = config;
    this.modelCapabilities = this.buildCapabilityMatrix();
  }

  /**
   * Build capability matrix for different models
   */
  buildCapabilityMatrix() {
    return {
      'o3': {
        reasoning: 10,
        coding: 9,
        analysis: 10,
        math: 10,
        creative: 7,
        speed: 4,
        cost: 3,
        multimodal: 0
      },
      'o3-pro': {
        reasoning: 10,
        coding: 10,
        analysis: 10,
        math: 10,
        creative: 8,
        speed: 2,
        cost: 1,
        multimodal: 0
      },
      'o3-mini': {
        reasoning: 8,
        coding: 8,
        analysis: 8,
        math: 8,
        creative: 6,
        speed: 8,
        cost: 9,
        multimodal: 0
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
      'gemini-1.5-pro': {
        reasoning: 9,
        coding: 8,
        analysis: 9,
        math: 8,
        creative: 9,
        speed: 7,
        cost: 6,
        multimodal: 10
      },
      'claude-3-5-sonnet': {
        reasoning: 9,
        coding: 9,
        analysis: 9,
        math: 8,
        creative: 9,
        speed: 7,
        cost: 6,
        multimodal: 0
      },
      'gpt-4': {
        reasoning: 8,
        coding: 8,
        analysis: 8,
        math: 7,
        creative: 8,
        speed: 6,
        cost: 4,
        multimodal: 0
      },
      'gpt-4-turbo': {
        reasoning: 8,
        coding: 8,
        analysis: 8,
        math: 7,
        creative: 8,
        speed: 7,
        cost: 5,
        multimodal: 8
      }
    };
  }

  /**
   * Select the best model for a given query
   * @param {string} query - The query text
   * @param {string} context - Additional context
   * @param {Object} preferences - User preferences
   * @returns {Promise<string>} The selected model ID
   */
  async selectBestModel(query, context = '', preferences = {}) {
    const queryAnalysis = this.analyzeQuery(query, context);
    
    // Apply user preferences
    if (preferences.model) {
      return preferences.model;
    }
    
    if (preferences.prioritize) {
      queryAnalysis[preferences.prioritize] = (queryAnalysis[preferences.prioritize] || 0) * 2;
    }

    let bestScore = -1;
    let bestModel = this.config.default_model || 'o3';

    for (const [modelId, capabilities] of Object.entries(this.modelCapabilities)) {
      // Skip unavailable models
      if (!this.config.available_models?.includes(modelId)) {
        continue;
      }

      const score = this.calculateScore(queryAnalysis, capabilities);
      
      if (score > bestScore) {
        bestScore = score;
        bestModel = modelId;
      }
    }

    return bestModel;
  }

  /**
   * Analyze the query to determine what capabilities are needed
   * @param {string} query - The query text
   * @param {string} context - Additional context
   * @returns {Object} Analysis weights
   */
  analyzeQuery(query, context) {
    const text = (query + ' ' + context).toLowerCase();
    
    const weights = {
      reasoning: this.countKeywords(text, [
        'analyze', 'reasoning', 'logic', 'solve', 'complex', 'think', 'deduce', 
        'infer', 'conclude', 'problem', 'strategy', 'approach', 'plan',
        'why', 'how', 'explain', 'understand', 'reason', 'because'
      ]),
      
      coding: this.countKeywords(text, [
        'code', 'programming', 'function', 'algorithm', 'debug', 'implement',
        'javascript', 'python', 'typescript', 'react', 'api', 'database',
        'git', 'github', 'sql', 'html', 'css', 'json', 'xml', 'regex',
        'framework', 'library', 'package', 'module', 'class', 'method'
      ]),
      
      analysis: this.countKeywords(text, [
        'analyze', 'examine', 'review', 'evaluate', 'assess', 'study',
        'investigate', 'research', 'data', 'statistics', 'metrics',
        'compare', 'contrast', 'summarize', 'findings', 'results'
      ]),
      
      math: this.countKeywords(text, [
        'calculate', 'equation', 'formula', 'mathematics', 'algebra',
        'statistics', 'probability', 'number', 'compute', 'sum',
        'average', 'percentage', 'ratio', 'derivative', 'integral'
      ]),
      
      creative: this.countKeywords(text, [
        'creative', 'write', 'story', 'poem', 'brainstorm', 'design',
        'innovative', 'generate', 'create', 'imagine', 'invent',
        'artistic', 'novel', 'unique', 'original', 'inspiration'
      ]),
      
      speed: this.countKeywords(text, [
        'quick', 'fast', 'urgent', 'immediate', 'asap', 'hurry',
        'rapid', 'swift', 'prompt', 'briefly', 'short'
      ]),
      
      cost: this.countKeywords(text, [
        'budget', 'cheap', 'cost', 'affordable', 'economical',
        'inexpensive', 'free', 'low-cost', 'minimal'
      ]),
      
      multimodal: this.countKeywords(text, [
        'image', 'picture', 'photo', 'visual', 'diagram', 'chart',
        'graph', 'figure', 'illustration', 'video', 'audio'
      ])
    };

    // Boost reasoning for question words and complex sentence structures
    if (/\b(what|why|how|when|where|which|explain|describe)\b/i.test(text)) {
      weights.reasoning += 2;
    }

    // Boost coding for code-like patterns
    if (/[{}();]/.test(query) || /\b(function|class|const|let|var)\b/i.test(text)) {
      weights.coding += 3;
    }

    // Boost math for numbers and mathematical symbols
    if (/[\d+\-*/=<>%]/.test(query)) {
      weights.math += 1;
    }

    return weights;
  }

  /**
   * Count keyword occurrences in text
   * @param {string} text - Text to search
   * @param {string[]} keywords - Keywords to count
   * @returns {number} Total count
   */
  countKeywords(text, keywords) {
    return keywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Calculate score for a model based on query analysis
   * @param {Object} queryAnalysis - Query analysis weights
   * @param {Object} capabilities - Model capabilities
   * @returns {number} Calculated score
   */
  calculateScore(queryAnalysis, capabilities) {
    let score = 0;
    const totalWeight = Object.values(queryAnalysis).reduce((a, b) => a + b, 0) || 1;

    for (const [aspect, queryWeight] of Object.entries(queryAnalysis)) {
      if (capabilities[aspect] !== undefined) {
        const normalizedWeight = queryWeight / totalWeight;
        score += normalizedWeight * capabilities[aspect];
      }
    }

    return score;
  }

  /**
   * Get model recommendations for a query
   * @param {string} query - The query text
   * @param {string} context - Additional context
   * @param {number} limit - Number of recommendations to return
   * @returns {Promise<Array>} Sorted model recommendations
   */
  async getModelRecommendations(query, context = '', limit = 3) {
    const queryAnalysis = this.analyzeQuery(query, context);
    const recommendations = [];

    for (const [modelId, capabilities] of Object.entries(this.modelCapabilities)) {
      if (!this.config.available_models?.includes(modelId)) {
        continue;
      }

      const score = this.calculateScore(queryAnalysis, capabilities);
      
      recommendations.push({
        model: modelId,
        score: Math.round(score * 100) / 100,
        strengths: this.getModelStrengths(capabilities),
        reasoning: this.explainSelection(queryAnalysis, capabilities)
      });
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get the strongest capabilities of a model
   * @param {Object} capabilities - Model capability scores
   * @returns {string[]} Top capabilities
   */
  getModelStrengths(capabilities) {
    return Object.entries(capabilities)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([capability]) => capability);
  }

  /**
   * Explain why a model was selected
   * @param {Object} queryAnalysis - Query analysis
   * @param {Object} capabilities - Model capabilities
   * @returns {string} Explanation
   */
  explainSelection(queryAnalysis, capabilities) {
    const topQueryNeeds = Object.entries(queryAnalysis)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([need]) => need);

    const matchingStrengths = topQueryNeeds.filter(need => capabilities[need] >= 8);
    
    if (matchingStrengths.length > 0) {
      return `Excellent for ${matchingStrengths.join(' and ')}`;
    } else if (topQueryNeeds.length > 0) {
      return `Good balance for ${topQueryNeeds.join(' and ')}`;
    } else {
      return 'Well-rounded model for general queries';
    }
  }
}
