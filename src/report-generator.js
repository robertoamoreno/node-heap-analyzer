import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor(outputDir = './reports') {
    this.outputDir = outputDir;
  }

  async generate(heapAnalysis, llmAnalysis = null, comparisonAnalysis = null) {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportType = comparisonAnalysis ? 'comparison' : 'heap-analysis';
      const reportDir = path.join(this.outputDir, `${reportType}-${timestamp}`);
      await fs.mkdir(reportDir, { recursive: true });
      
      // Generate different report formats
      if (comparisonAnalysis) {
        await this.generateComparisonReports(reportDir, comparisonAnalysis, llmAnalysis);
      } else {
        await this.generateJSONReport(reportDir, heapAnalysis, llmAnalysis);
        await this.generateHTMLReport(reportDir, heapAnalysis, llmAnalysis);
        await this.generateMarkdownReport(reportDir, heapAnalysis, llmAnalysis);
      }
      
      return reportDir;
      
    } catch (error) {
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  async generateJSONReport(reportDir, heapAnalysis, llmAnalysis) {
    const report = {
      heapAnalysis,
      llmAnalysis,
      generatedAt: new Date().toISOString()
    };
    
    const filePath = path.join(reportDir, 'analysis.json');
    await fs.writeFile(filePath, JSON.stringify(report, this.bigIntReplacer, 2));
  }

  bigIntReplacer(key, value) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  async generateHTMLReport(reportDir, heapAnalysis, llmAnalysis) {
    const html = this.buildHTMLReport(heapAnalysis, llmAnalysis);
    const filePath = path.join(reportDir, 'report.html');
    await fs.writeFile(filePath, html);
  }

  async generateMarkdownReport(reportDir, heapAnalysis, llmAnalysis) {
    const markdown = this.buildMarkdownReport(heapAnalysis, llmAnalysis);
    const filePath = path.join(reportDir, 'report.md');
    await fs.writeFile(filePath, markdown);
  }

  buildHTMLReport(heapAnalysis, llmAnalysis) {
    const { stats, leaks, largeObjects, summary } = heapAnalysis;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Heap Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { background: #e9f5ff; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; }
        .critical { background: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; }
        .success { background: #d4edda; border-left: 4px solid #28a745; padding: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .llm-section { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Heap Analysis Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Heap Snapshot:</strong> ${heapAnalysis.heapSnapshotPath}</p>
    </div>

    <div class="section">
        <h2>📊 Summary</h2>
        <div class="metric"><strong>Total Heap Size:</strong> ${summary.totalSizeMB} MB</div>
        <div class="metric"><strong>Large Objects:</strong> ${summary.largeObjectsCount}</div>
        <div class="metric"><strong>Potential Leaks:</strong> ${summary.potentialLeaksCount}</div>
        
        ${summary.criticalIssues && summary.criticalIssues.length > 0 ? `
        <h3>🚨 Critical Issues Detected</h3>
        ${summary.criticalIssues.map(issue => `
            <div class="${issue.severity === 'CRITICAL' ? 'critical' : 'warning'}">
                <strong>${issue.type}</strong> (${issue.severity})<br>
                ${issue.description}<br>
                <em>Impact: ${issue.impact}</em>
            </div>
        `).join('')}
        ` : ''}
        
        ${summary.recommendations && summary.recommendations.length > 0 ? `
        <h3>💡 Immediate Actions Required</h3>
        ${summary.recommendations.map(rec => `
            <div class="success">
                <strong>${rec.issue}:</strong> ${rec.action}<br>
                <em>Files to check: ${rec.files}</em>
            </div>
        `).join('')}
        ` : ''}
    </div>

    <div class="section">
        <h2>⚠️ Potential Memory Leaks</h2>
        <h3>High Retained Size Objects</h3>
        ${leaks.highRetainedSize.length > 0 ? `
        <table>
            <tr><th>Type</th><th>Name</th><th>Retained Size (KB)</th></tr>
            ${leaks.highRetainedSize.slice(0, 10).map(obj => `
                <tr>
                    <td>${obj.type}</td>
                    <td>${obj.name || 'N/A'}</td>
                    <td>${Math.round((obj.retained_size || 0) / 1024)}</td>
                </tr>
            `).join('')}
        </table>
        ` : '<p>No high retained size objects found in the analyzed data.</p>'}

        <h3>Duplicate Objects</h3>
        <table>
            <tr><th>Type</th><th>Count</th></tr>
            ${leaks.duplicateObjects.slice(0, 10).map(obj => `
                <tr>
                    <td>${obj.type}</td>
                    <td>${obj.count}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>📦 Large Objects</h2>
        <table>
            <tr><th>Type</th><th>Name</th><th>Self Size (KB)</th><th>Retained Size (KB)</th></tr>
            ${largeObjects.slice(0, 10).map(obj => `
                <tr>
                    <td>${obj.type}</td>
                    <td>${obj.name || 'N/A'}</td>
                    <td>${Math.round((obj.selfSize || 0) / 1024)}</td>
                    <td>${Math.round((obj.retainedSize || 0) / 1024)}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${llmAnalysis ? `
    <div class="section">
        <h2>🤖 AI Analysis</h2>
        
        ${llmAnalysis.sections.memoryLeakAssessment ? `
        <div class="llm-section">
            <h3>Memory Leak Assessment</h3>
            <div>${this.formatTextForHTML(llmAnalysis.sections.memoryLeakAssessment)}</div>
        </div>
        ` : ''}

        ${llmAnalysis.sections.rootCauseAnalysis ? `
        <div class="llm-section">
            <h3>Root Cause Analysis</h3>
            <div>${this.formatTextForHTML(llmAnalysis.sections.rootCauseAnalysis)}</div>
        </div>
        ` : ''}

        ${llmAnalysis.sections.recommendations ? `
        <div class="llm-section">
            <h3>Recommendations</h3>
            <div>${this.formatTextForHTML(llmAnalysis.sections.recommendations)}</div>
        </div>
        ` : ''}

        ${llmAnalysis.sections.monitoringSuggestions ? `
        <div class="llm-section">
            <h3>Monitoring Suggestions</h3>
            <div>${this.formatTextForHTML(llmAnalysis.sections.monitoringSuggestions)}</div>
        </div>
        ` : ''}

        ${llmAnalysis.rawResponse ? `
        <div class="llm-section">
            <h3>Full AI Response</h3>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">${this.formatTextForHTML(llmAnalysis.rawResponse)}</div>
        </div>
        ` : ''}
    </div>
    ` : '<div class="section"><h2>🤖 AI Analysis</h2><p>No AI analysis available. Check if the LLM analyzer is properly configured.</p></div>'}

</body>
</html>`;
  }

  buildMarkdownReport(heapAnalysis, llmAnalysis) {
    const { stats, leaks, largeObjects, summary } = heapAnalysis;
    
    let markdown = `# 🔍 Heap Analysis Report

**Generated:** ${new Date().toLocaleString()}
**Heap Snapshot:** ${heapAnalysis.heapSnapshotPath}

## 📊 Summary

- **Total Heap Size:** ${summary.totalSizeMB} MB
- **Large Objects:** ${summary.largeObjectsCount}
- **Potential Leaks:** ${summary.potentialLeaksCount}

${summary.criticalIssues && summary.criticalIssues.length > 0 ? `
### 🚨 Critical Issues Detected

${summary.criticalIssues.map(issue => `
**${issue.type}** (${issue.severity})
- ${issue.description}
- Impact: ${issue.impact}
`).join('\n')}
` : ''}

${summary.recommendations && summary.recommendations.length > 0 ? `
### 💡 Immediate Actions Required

${summary.recommendations.map(rec => `
**${rec.issue}:**
- Action: ${rec.action}
- Files to check: ${rec.files}
`).join('\n')}
` : ''}

## ⚠️ Potential Memory Leaks

### High Retained Size Objects

| Type | Name | Retained Size (KB) |
|------|------|-------------------|
${leaks.highRetainedSize.slice(0, 10).map(obj => 
  `| ${obj.type} | ${obj.name || 'N/A'} | ${Math.round((obj.retained_size || 0) / 1024)} |`
).join('\n')}

### Duplicate Objects

| Type | Count |
|------|-------|
${leaks.duplicateObjects.slice(0, 10).map(obj => 
  `| ${obj.type} | ${obj.count} |`
).join('\n')}

## 📦 Large Objects

| Type | Name | Self Size (KB) | Retained Size (KB) |
|------|------|----------------|-------------------|
${largeObjects.slice(0, 10).map(obj => 
  `| ${obj.type} | ${obj.name || 'N/A'} | ${Math.round((obj.selfSize || 0) / 1024)} | ${Math.round((obj.retainedSize || 0) / 1024)} |`
).join('\n')}
`;

    if (llmAnalysis) {
      markdown += `
## 🤖 AI Analysis

### Memory Leak Assessment
${llmAnalysis.sections.memoryLeakAssessment}

### Root Cause Analysis
${llmAnalysis.sections.rootCauseAnalysis}

### Recommendations
${llmAnalysis.sections.recommendations}

### Monitoring Suggestions
${llmAnalysis.sections.monitoringSuggestions}
`;
    }

    return markdown;
  }

  async generateComparisonReports(reportDir, comparisonAnalysis, llmAnalysis) {
    // Generate JSON report
    const report = {
      comparisonAnalysis,
      llmAnalysis,
      generatedAt: new Date().toISOString()
    };
    
    const jsonPath = path.join(reportDir, 'comparison.json');
    await fs.writeFile(jsonPath, JSON.stringify(report, this.bigIntReplacer, 2));
    
    // Generate HTML report
    const html = this.buildComparisonHTMLReport(comparisonAnalysis, llmAnalysis);
    const htmlPath = path.join(reportDir, 'comparison.html');
    await fs.writeFile(htmlPath, html);
    
    // Generate Markdown report
    const markdown = this.buildComparisonMarkdownReport(comparisonAnalysis, llmAnalysis);
    const markdownPath = path.join(reportDir, 'comparison.md');
    await fs.writeFile(markdownPath, markdown);
  }

  buildComparisonHTMLReport(comparisonAnalysis, llmAnalysis) {
    const { before, after, changes, improvements, regressions, summary } = comparisonAnalysis;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Heap Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { background: #e9f5ff; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .improvement { background: #d4edda; border-left: 4px solid #28a745; padding: 10px; margin: 5px 0; }
        .regression { background: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 5px 0; }
        .neutral { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .positive { color: #28a745; font-weight: bold; }
        .negative { color: #dc3545; font-weight: bold; }
        .trend-${summary.overallTrend} { 
          padding: 15px; 
          border-radius: 5px; 
          margin: 10px 0;
          ${summary.overallTrend === 'improved' ? 'background: #d4edda; border-left: 4px solid #28a745;' : 
            summary.overallTrend === 'regressed' ? 'background: #f8d7da; border-left: 4px solid #dc3545;' : 
            'background: #fff3cd; border-left: 4px solid #ffc107;'}
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Heap Comparison Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Analysis Period:</strong> Before vs After Optimization</p>
    </div>

    <div class="section">
        <h2>🎯 Overall Assessment</h2>
        <div class="trend-${summary.overallTrend}">
            <h3>Status: ${summary.overallTrend.toUpperCase()}</h3>
            <p>${summary.recommendation}</p>
            <p><strong>Improvements:</strong> ${summary.improvementsCount} | <strong>Regressions:</strong> ${summary.regressionsCount}</p>
        </div>
    </div>

    <div class="section">
        <h2>📈 Key Metrics Comparison</h2>
        <table>
            <tr><th>Metric</th><th>Before</th><th>After</th><th>Change</th><th>% Change</th></tr>
            ${Object.entries(changes).map(([metric, change]) => `
                <tr>
                    <td>${this.formatMetricName(metric)}</td>
                    <td>${this.formatValue(metric, change.before)}</td>
                    <td>${this.formatValue(metric, change.after)}</td>
                    <td class="${change.absolute >= 0 ? 'negative' : 'positive'}">${change.absolute >= 0 ? '+' : ''}${this.formatValue(metric, change.absolute)}</td>
                    <td class="${change.percentage >= 0 ? 'negative' : 'positive'}">${change.percentage >= 0 ? '+' : ''}${change.percentage.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${improvements.length > 0 ? `
    <div class="section">
        <h2>✅ Improvements</h2>
        ${improvements.map(improvement => `
            <div class="improvement">
                <strong>${improvement.metric}:</strong> ${improvement.description}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${regressions.length > 0 ? `
    <div class="section">
        <h2>⚠️ Regressions</h2>
        ${regressions.map(regression => `
            <div class="regression">
                <strong>${regression.metric}:</strong> ${regression.description}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${summary.significantChanges.length > 0 ? `
    <div class="section">
        <h2>🔍 Significant Changes</h2>
        ${summary.significantChanges.map(change => `
            <div class="${change.change > 0 ? 'regression' : 'improvement'}">
                <strong>${this.formatMetricName(change.metric)}:</strong> ${change.direction} by ${Math.abs(change.change).toFixed(1)}%
            </div>
        `).join('')}
    </div>
    ` : ''}

</body>
</html>`;
  }

  buildComparisonMarkdownReport(comparisonAnalysis, llmAnalysis) {
    const { before, after, changes, improvements, regressions, summary } = comparisonAnalysis;
    
    return `# 📊 Heap Comparison Report

**Generated:** ${new Date().toLocaleString()}
**Analysis Period:** Before vs After Optimization

## 🎯 Overall Assessment

**Status:** ${summary.overallTrend.toUpperCase()}
**Recommendation:** ${summary.recommendation}
**Improvements:** ${summary.improvementsCount} | **Regressions:** ${summary.regressionsCount}

## 📈 Key Metrics Comparison

| Metric | Before | After | Change | % Change |
|--------|--------|-------|--------|----------|
${Object.entries(changes).map(([metric, change]) => 
  `| ${this.formatMetricName(metric)} | ${this.formatValue(metric, change.before)} | ${this.formatValue(metric, change.after)} | ${change.absolute >= 0 ? '+' : ''}${this.formatValue(metric, change.absolute)} | ${change.percentage >= 0 ? '+' : ''}${change.percentage.toFixed(1)}% |`
).join('\n')}

${improvements.length > 0 ? `
## ✅ Improvements

${improvements.map(improvement => `- **${improvement.metric}:** ${improvement.description}`).join('\n')}
` : ''}

${regressions.length > 0 ? `
## ⚠️ Regressions

${regressions.map(regression => `- **${regression.metric}:** ${regression.description}`).join('\n')}
` : ''}

${summary.significantChanges.length > 0 ? `
## 🔍 Significant Changes

${summary.significantChanges.map(change => `- **${this.formatMetricName(change.metric)}:** ${change.direction} by ${Math.abs(change.change).toFixed(1)}%`).join('\n')}
` : ''}
`;
  }

  formatMetricName(metric) {
    const names = {
      totalSize: 'Total Heap Size',
      totalNodes: 'Total Nodes',
      totalEdges: 'Total Edges',
      largeObjectsCount: 'Large Objects',
      potentialLeaksCount: 'Potential Leaks',
      duplicateObjectsCount: 'Duplicate Objects',
      highRetainedSizeCount: 'High Retained Size Objects'
    };
    return names[metric] || metric;
  }

  formatValue(metric, value) {
    if (metric === 'totalSize') {
      return `${value.toFixed(2)} MB`;
    }
    return Math.round(value).toLocaleString();
  }

  formatTextForHTML(text) {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }
}
