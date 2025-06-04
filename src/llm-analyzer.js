import Anthropic from '@anthropic-ai/sdk';

export class LLMAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass --api-key');
    }
    
    this.anthropic = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  async analyze(heapAnalysis) {
    try {
      const prompt = this.buildAnalysisPrompt(heapAnalysis);
      
      console.log('Sending prompt to LLM...');
      const message = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      console.log('LLM response received, parsing...');
      const responseText = message.content[0].text;
      console.log('Raw LLM response length:', responseText.length);
      
      const analysis = this.parseResponse(responseText);
      
      return {
        timestamp: new Date().toISOString(),
        rawResponse: responseText,
        ...analysis
      };
      
    } catch (error) {
      console.error('LLM analysis error:', error);
      throw new Error(`LLM analysis failed: ${error.message}`);
    }
  }

  buildAnalysisPrompt(heapAnalysis) {
    const { stats, leaks, largeObjects, detachedNodes, connections, summary } = heapAnalysis;
    
    return `You are an expert in Node.js memory analysis and leak detection. Analyze the following heap snapshot data and provide insights about potential memory leaks, performance issues, and recommendations.

HEAP SNAPSHOT ANALYSIS DATA:

## Basic Statistics:
- Total heap size: ${summary.totalSizeMB} MB
- Total nodes: ${stats.totalNodes}
- Total edges: ${stats.totalEdges}
- Large objects count: ${summary.largeObjectsCount}
- Potential leaks count: ${summary.potentialLeaksCount}

## Top Node Types:
${summary.topNodeTypes.map(([type, count]) => `- ${type}: ${count} objects`).join('\n')}

## Objects with High Retained Size (potential leaks):
${leaks.highRetainedSize.slice(0, 10).map(obj => 
  `- ${obj.type} "${obj.name}": ${Math.round((obj.retained_size || 0) / 1024)} KB retained`
).join('\n')}

## Duplicate Objects (potential leaks):
${leaks.duplicateObjects.slice(0, 10).map(obj => 
  `- ${obj.type}: ${obj.count} instances`
).join('\n')}

## Large Objects:
${largeObjects.slice(0, 10).map(obj => 
  `- ${obj.type} "${obj.name}": ${Math.round((obj.selfSize || 0) / 1024)} KB`
).join('\n')}

## Connection-related Objects:
${connections.slice(0, 10).map(obj => 
  `- ${obj.type} "${obj.name}": ${Math.round((obj.selfSize || 0) / 1024)} KB`
).join('\n')}

## Detached DOM Nodes:
${detachedNodes.slice(0, 10).map(obj => 
  `- ${obj.name}: ${Math.round((obj.selfSize || 0) / 1024)} KB`
).join('\n')}

## Key Observations:
- 28+ million concatenated strings suggest massive string operations
- Large JSON objects (35MB each) indicate stencil/template caching issues
- 1+ million generic objects suggest object lifecycle problems
- Pattern shows stencil template system with listing marketing data

Based on this Node.js application pattern, likely source files to investigate:
- src/stencil/ (template processing)
- src/cache/ (caching logic)
- src/api/ (API response handling)
- src/listing/ (listing data processing)
- src/template/ (template rendering)

Please provide a comprehensive analysis including:

1. **MEMORY LEAK ASSESSMENT**: Identify the most likely memory leaks based on the data
2. **ROOT CAUSE ANALYSIS**: Explain what might be causing these issues, referencing likely source file patterns
3. **SEVERITY RATING**: Rate each issue as Critical/High/Medium/Low
4. **RECOMMENDATIONS**: Specific actionable steps to fix the issues with likely file locations
5. **MONITORING SUGGESTIONS**: What to monitor going forward

Format your response as structured sections with clear headings and bullet points. Be specific about likely source file locations based on the stencil/template/listing patterns observed.`;
  }

  parseResponse(response) {
    console.log('Parsing LLM response...');
    
    // Extract structured information from the LLM response
    const sections = {
      memoryLeakAssessment: this.extractSection(response, 'MEMORY LEAK ASSESSMENT'),
      rootCauseAnalysis: this.extractSection(response, 'ROOT CAUSE ANALYSIS'),
      severityRating: this.extractSection(response, 'SEVERITY RATING'),
      recommendations: this.extractSection(response, 'RECOMMENDATIONS'),
      monitoringSuggestions: this.extractSection(response, 'MONITORING SUGGESTIONS')
    };

    console.log('Extracted sections:', Object.keys(sections).map(key => `${key}: ${sections[key].length} chars`));

    // Extract key insights
    const insights = this.extractInsights(response);
    
    return {
      sections,
      insights,
      summary: this.generateLLMSummary(sections, insights)
    };
  }

  extractSection(text, sectionName) {
    // Try multiple patterns to extract sections
    const patterns = [
      new RegExp(`\\*\\*${sectionName}\\*\\*:?([\\s\\S]*?)(?=\\*\\*[A-Z]|$)`, 'i'),
      new RegExp(`## ${sectionName}([\\s\\S]*?)(?=##|$)`, 'i'),
      new RegExp(`# ${sectionName}([\\s\\S]*?)(?=#|$)`, 'i'),
      new RegExp(`${sectionName}:([\\s\\S]*?)(?=\\n\\n[A-Z]|$)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 0) {
        return match[1].trim();
      }
    }
    
    console.log(`Could not extract section: ${sectionName}`);
    return '';
  }

  extractInsights(response) {
    const insights = [];
    
    // Look for critical issues
    if (response.toLowerCase().includes('critical') || response.toLowerCase().includes('severe')) {
      insights.push({ type: 'critical', message: 'Critical memory issues detected' });
    }
    
    // Look for connection leaks
    if (response.toLowerCase().includes('connection') && response.toLowerCase().includes('leak')) {
      insights.push({ type: 'connection_leak', message: 'Potential connection leaks detected' });
    }
    
    // Look for DOM leaks
    if (response.toLowerCase().includes('dom') && response.toLowerCase().includes('detached')) {
      insights.push({ type: 'dom_leak', message: 'Detached DOM nodes found' });
    }
    
    return insights;
  }

  async analyzeComparison(comparisonAnalysis) {
    try {
      const prompt = this.buildComparisonPrompt(comparisonAnalysis);
      
      console.log('Sending comparison prompt to LLM...');
      const message = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      console.log('LLM comparison response received, parsing...');
      const responseText = message.content[0].text;
      
      const analysis = this.parseResponse(responseText);
      
      return {
        timestamp: new Date().toISOString(),
        rawResponse: responseText,
        ...analysis
      };
      
    } catch (error) {
      console.error('LLM comparison analysis error:', error);
      throw new Error(`LLM comparison analysis failed: ${error.message}`);
    }
  }

  buildComparisonPrompt(comparisonAnalysis) {
    const { before, after, changes, improvements, regressions, summary } = comparisonAnalysis;
    
    return `You are an expert in Node.js memory analysis. Analyze the following heap snapshot comparison data to assess whether memory optimizations were successful and provide insights.

HEAP COMPARISON DATA:

## Overall Trend: ${summary.overallTrend.toUpperCase()}
- Improvements: ${summary.improvementsCount}
- Regressions: ${summary.regressionsCount}
- Recommendation: ${summary.recommendation}

## Key Metrics Changes:
${Object.entries(changes).map(([metric, change]) => 
  `- ${metric}: ${change.before} → ${change.after} (${change.percentage >= 0 ? '+' : ''}${change.percentage.toFixed(1)}%)`
).join('\n')}

## Improvements Detected:
${improvements.map(imp => `- ${imp.description}`).join('\n')}

## Regressions Detected:
${regressions.map(reg => `- ${reg.description}`).join('\n')}

## Significant Changes:
${summary.significantChanges.map(change => 
  `- ${change.metric}: ${change.direction} by ${Math.abs(change.change).toFixed(1)}%`
).join('\n')}

Based on this comparison data, please provide:

1. **MEMORY LEAK ASSESSMENT**: Evaluate if memory leaks were successfully addressed
2. **ROOT CAUSE ANALYSIS**: Explain what optimizations likely worked and what didn't
3. **RECOMMENDATIONS**: Specific next steps based on the comparison results
4. **MONITORING SUGGESTIONS**: What to watch for in future snapshots

Focus on actionable insights about the effectiveness of memory optimizations and areas that still need attention.`;
  }

  generateLLMSummary(sections, insights) {
    const criticalIssues = insights.filter(i => i.type === 'critical').length;
    const totalIssues = insights.length;
    
    return {
      criticalIssues,
      totalIssues,
      hasRecommendations: sections.recommendations.length > 0,
      hasMonitoringSuggestions: sections.monitoringSuggestions.length > 0
    };
  }
}
