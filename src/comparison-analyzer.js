export class ComparisonAnalyzer {
  constructor() {
    this.comparisonResults = {};
  }

  async compare(beforeAnalysis, afterAnalysis) {
    try {
      console.log('Comparing heap analyses...');
      
      const comparison = {
        timestamp: new Date().toISOString(),
        before: this.extractMetrics(beforeAnalysis),
        after: this.extractMetrics(afterAnalysis),
        changes: {},
        improvements: [],
        regressions: [],
        summary: {}
      };

      // Calculate changes
      comparison.changes = this.calculateChanges(comparison.before, comparison.after);
      
      // Identify improvements and regressions
      this.categorizeChanges(comparison);
      
      // Generate summary
      comparison.summary = this.generateComparisonSummary(comparison);
      
      return comparison;
      
    } catch (error) {
      throw new Error(`Comparison analysis failed: ${error.message}`);
    }
  }

  extractMetrics(analysis) {
    const { stats, leaks, largeObjects, summary } = analysis;
    
    return {
      totalSize: parseFloat(summary.totalSizeMB),
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      largeObjectsCount: summary.largeObjectsCount,
      potentialLeaksCount: summary.potentialLeaksCount,
      duplicateObjectsCount: leaks.duplicateObjects.length,
      highRetainedSizeCount: leaks.highRetainedSize.length,
      topDuplicateTypes: leaks.duplicateObjects.slice(0, 5).map(obj => ({
        type: obj.type,
        count: obj.count
      })),
      largestObjects: largeObjects.slice(0, 5).map(obj => ({
        type: obj.type,
        name: obj.name,
        size: obj.selfSize || 0
      }))
    };
  }

  calculateChanges(before, after) {
    const changes = {};
    
    // Calculate percentage changes for numeric metrics
    const numericMetrics = [
      'totalSize', 'totalNodes', 'totalEdges', 
      'largeObjectsCount', 'potentialLeaksCount',
      'duplicateObjectsCount', 'highRetainedSizeCount'
    ];
    
    numericMetrics.forEach(metric => {
      const beforeValue = before[metric] || 0;
      const afterValue = after[metric] || 0;
      const absoluteChange = afterValue - beforeValue;
      const percentageChange = beforeValue > 0 ? ((absoluteChange / beforeValue) * 100) : 0;
      
      changes[metric] = {
        before: beforeValue,
        after: afterValue,
        absolute: absoluteChange,
        percentage: percentageChange
      };
    });

    return changes;
  }

  categorizeChanges(comparison) {
    const { changes } = comparison;
    
    // Define what constitutes improvements vs regressions
    const improvementMetrics = [
      { key: 'totalSize', threshold: -5, name: 'Total Heap Size' },
      { key: 'potentialLeaksCount', threshold: -10, name: 'Potential Leaks' },
      { key: 'duplicateObjectsCount', threshold: -10, name: 'Duplicate Objects' },
      { key: 'largeObjectsCount', threshold: -5, name: 'Large Objects' }
    ];

    improvementMetrics.forEach(metric => {
      const change = changes[metric.key];
      if (change && change.percentage < metric.threshold) {
        comparison.improvements.push({
          metric: metric.name,
          change: change.percentage,
          description: `${metric.name} decreased by ${Math.abs(change.percentage).toFixed(1)}%`
        });
      } else if (change && change.percentage > Math.abs(metric.threshold)) {
        comparison.regressions.push({
          metric: metric.name,
          change: change.percentage,
          description: `${metric.name} increased by ${change.percentage.toFixed(1)}%`
        });
      }
    });
  }

  generateComparisonSummary(comparison) {
    const { improvements, regressions, changes } = comparison;
    
    const totalSizeChange = changes.totalSize.percentage;
    let overallTrend = 'neutral';
    
    if (improvements.length > regressions.length && totalSizeChange < -2) {
      overallTrend = 'improved';
    } else if (regressions.length > improvements.length || totalSizeChange > 5) {
      overallTrend = 'regressed';
    }
    
    return {
      overallTrend,
      improvementsCount: improvements.length,
      regressionsCount: regressions.length,
      significantChanges: this.getSignificantChanges(changes),
      recommendation: this.generateRecommendation(overallTrend, improvements, regressions)
    };
  }

  getSignificantChanges(changes) {
    const significant = [];
    
    Object.entries(changes).forEach(([key, change]) => {
      if (Math.abs(change.percentage) > 10) {
        significant.push({
          metric: key,
          change: change.percentage,
          direction: change.percentage > 0 ? 'increased' : 'decreased'
        });
      }
    });
    
    return significant.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  generateRecommendation(trend, improvements, regressions) {
    switch (trend) {
      case 'improved':
        return 'Memory usage has improved! Continue monitoring to ensure gains are sustained.';
      case 'regressed':
        return 'Memory usage has worsened. Review recent changes and consider rolling back problematic updates.';
      default:
        return 'Memory usage is relatively stable. Continue regular monitoring.';
    }
  }

  compareObjectTypes(beforeAnalysis, afterAnalysis) {
    const beforeTypes = new Map();
    const afterTypes = new Map();
    
    // Extract object type counts from duplicate objects
    beforeAnalysis.leaks.duplicateObjects.forEach(obj => {
      beforeTypes.set(obj.type, obj.count);
    });
    
    afterAnalysis.leaks.duplicateObjects.forEach(obj => {
      afterTypes.set(obj.type, obj.count);
    });
    
    const typeComparisons = [];
    const allTypes = new Set([...beforeTypes.keys(), ...afterTypes.keys()]);
    
    allTypes.forEach(type => {
      const beforeCount = beforeTypes.get(type) || 0;
      const afterCount = afterTypes.get(type) || 0;
      const change = afterCount - beforeCount;
      const percentageChange = beforeCount > 0 ? ((change / beforeCount) * 100) : 0;
      
      if (Math.abs(percentageChange) > 5 || Math.abs(change) > 1000) {
        typeComparisons.push({
          type,
          before: beforeCount,
          after: afterCount,
          change,
          percentageChange
        });
      }
    });
    
    return typeComparisons.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange));
  }
}
