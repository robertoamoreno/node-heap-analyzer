import { getFullHeapFromFile } from '@memlab/api';
import memlabCore from '@memlab/core';
import fs from 'fs/promises';
import path from 'path';

const { utils } = memlabCore;

export class HeapAnalyzer {
  constructor() {
    this.analysisResults = {};
  }

  async analyze(heapSnapshotPath) {
    try {
      console.log(`Analyzing heap snapshot: ${heapSnapshotPath}`);
      
      // Load heap snapshot
      const heap = await getFullHeapFromFile(heapSnapshotPath);
      
      // Basic heap statistics
      const stats = this.getBasicStats(heap);
      
      // Find potential memory leaks
      const leaks = await this.findPotentialLeaks(heap);
      
      // Analyze object retention
      const retentionAnalysis = this.analyzeObjectRetention(heap);
      
      // Analyze large objects
      const largeObjects = this.findLargeObjects(heap);
      
      // Analyze detached DOM nodes (if applicable)
      const detachedNodes = this.findDetachedDOMNodes(heap);
      
      // Connection analysis
      const connections = this.analyzeConnections(heap);
      
      return {
        timestamp: new Date().toISOString(),
        heapSnapshotPath,
        stats,
        leaks,
        retentionAnalysis,
        largeObjects,
        detachedNodes,
        connections,
        summary: this.generateSummary(stats, leaks, retentionAnalysis, largeObjects)
      };
      
    } catch (error) {
      throw new Error(`Failed to analyze heap snapshot: ${error.message}`);
    }
  }

  getBasicStats(heap) {
    const stats = {
      totalNodes: 0,
      totalEdges: 0,
      totalSize: 0,
      nodeTypes: {},
      edgeTypes: {}
    };

    try {
      // Process nodes in smaller chunks to avoid memory issues
      let nodeCount = 0;
      heap.nodes.forEach(node => {
        nodeCount++;
        if (nodeCount % 10000 === 0) {
          // Force garbage collection every 10k nodes
          if (global.gc) global.gc();
        }
        
        stats.totalNodes++;
        stats.totalSize += node.self_size || 0;
        
        const nodeType = node.type || 'unknown';
        stats.nodeTypes[nodeType] = (stats.nodeTypes[nodeType] || 0) + 1;
      });

      let edgeCount = 0;
      heap.edges.forEach(edge => {
        edgeCount++;
        if (edgeCount % 10000 === 0) {
          // Force garbage collection every 10k edges
          if (global.gc) global.gc();
        }
        
        stats.totalEdges++;
        const edgeType = edge.type || 'unknown';
        stats.edgeTypes[edgeType] = (stats.edgeTypes[edgeType] || 0) + 1;
      });
    } catch (error) {
      console.warn('Warning: Could not iterate heap data:', error.message);
    }

    return stats;
  }

  async findPotentialLeaks(heap) {
    const highRetainedSize = [];
    const highRefCount = [];
    const objectCounts = new Map(); // Use Map for better memory efficiency

    try {
      let nodeCount = 0;
      heap.nodes.forEach(node => {
        nodeCount++;
        if (nodeCount % 5000 === 0) {
          if (global.gc) global.gc();
        }

        // High retained size check - only store essential data
        if ((node.retained_size || 0) > 1024 * 1024) { // > 1MB
          highRetainedSize.push({
            id: node.id,
            type: node.type,
            name: node.name,
            retained_size: node.retained_size,
            self_size: node.self_size
          });
          
          // Limit array size to prevent memory issues
          if (highRetainedSize.length > 100) {
            highRetainedSize.sort((a, b) => (b.retained_size || 0) - (a.retained_size || 0));
            highRetainedSize.splice(50); // Keep only top 50
          }
        }

        // High reference count check
        if ((node.edge_count || 0) > 100) {
          highRefCount.push({
            id: node.id,
            type: node.type,
            name: node.name,
            edge_count: node.edge_count,
            retained_size: node.retained_size
          });
          
          if (highRefCount.length > 100) {
            highRefCount.sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0));
            highRefCount.splice(50);
          }
        }

        // Count object types for duplicate detection - limit tracking
        const key = `${node.type}_${node.name}`;
        const currentCount = objectCounts.get(key) || 0;
        objectCounts.set(key, currentCount + 1);
        
        // Periodically clean up low-count entries to save memory
        if (nodeCount % 50000 === 0) {
          for (const [k, count] of objectCounts.entries()) {
            if (count < 10) {
              objectCounts.delete(k);
            }
          }
        }
      });

      // Final sort and limit
      highRetainedSize.sort((a, b) => (b.retained_size || 0) - (a.retained_size || 0));
      highRefCount.sort((a, b) => (b.edge_count || 0) - (a.edge_count || 0));

      const duplicateObjects = Array.from(objectCounts.entries())
        .filter(([key, count]) => count > 50)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      return {
        highRetainedSize: highRetainedSize.slice(0, 20),
        highRefCount: highRefCount.slice(0, 20),
        duplicateObjects: duplicateObjects.map(([key, count]) => ({ type: key, count }))
      };
    } catch (error) {
      console.warn('Warning: Could not analyze potential leaks:', error.message);
      return {
        highRetainedSize: [],
        highRefCount: [],
        duplicateObjects: []
      };
    }
  }

  analyzeObjectRetention(heap) {
    const retentionPaths = [];
    
    try {
      let nodeCount = 0;
      heap.nodes.forEach(node => {
        nodeCount++;
        if (nodeCount % 5000 === 0) {
          if (global.gc) global.gc();
        }

        if ((node.retained_size || 0) > 512 * 1024 && // > 512KB
            (node.type === 'closure' || node.type === 'object' || node.type === 'array')) {
          retentionPaths.push({
            id: node.id,
            type: node.type,
            name: node.name,
            retainedSize: node.retained_size,
            selfSize: node.self_size
          });
          
          // Limit during processing to save memory
          if (retentionPaths.length > 50) {
            retentionPaths.sort((a, b) => (b.retainedSize || 0) - (a.retainedSize || 0));
            retentionPaths.splice(25);
          }
        }
      });
    } catch (error) {
      console.warn('Warning: Could not analyze object retention:', error.message);
    }

    return { retentionPaths: retentionPaths.slice(0, 10) };
  }

  findLargeObjects(heap) {
    const threshold = 100 * 1024; // 100KB
    const largeObjects = [];
    
    try {
      let nodeCount = 0;
      heap.nodes.forEach(node => {
        nodeCount++;
        if (nodeCount % 5000 === 0) {
          if (global.gc) global.gc();
        }

        if ((node.self_size || 0) > threshold) {
          largeObjects.push({
            id: node.id,
            type: node.type,
            name: node.name,
            selfSize: node.self_size,
            retainedSize: node.retained_size
          });
          
          // Limit array size during processing
          if (largeObjects.length > 100) {
            largeObjects.sort((a, b) => (b.selfSize || 0) - (a.selfSize || 0));
            largeObjects.splice(50); // Keep only top 50
          }
        }
      });

      // Final sort and limit results
      largeObjects.sort((a, b) => (b.selfSize || 0) - (a.selfSize || 0));
      return largeObjects.slice(0, 20);
    } catch (error) {
      console.warn('Warning: Could not find large objects:', error.message);
      return [];
    }
  }

  findDetachedDOMNodes(heap) {
    const detachedNodes = [];
    
    try {
      heap.nodes.forEach(node => {
        if (node.type === 'object' && 
            node.name && 
            (node.name.includes('HTML') || node.name.includes('DOM'))) {
          detachedNodes.push({
            id: node.id,
            name: node.name,
            selfSize: node.self_size,
            retainedSize: node.retained_size
          });
        }
      });
    } catch (error) {
      console.warn('Warning: Could not find detached DOM nodes:', error.message);
    }

    return detachedNodes;
  }

  analyzeConnections(heap) {
    const connectionObjects = [];
    
    // Look for potential connection-related objects
    const connectionKeywords = ['socket', 'connection', 'client', 'server', 'stream', 'request', 'response'];
    
    try {
      heap.nodes.forEach(node => {
        if (node.name && connectionKeywords.some(keyword => 
          node.name.toLowerCase().includes(keyword)
        )) {
          connectionObjects.push({
            id: node.id,
            type: node.type,
            name: node.name,
            selfSize: node.self_size,
            retainedSize: node.retained_size
          });
        }
      });
    } catch (error) {
      console.warn('Warning: Could not analyze connections:', error.message);
    }

    return connectionObjects.slice(0, 20);
  }

  generateSummary(stats, leaks, retentionAnalysis, largeObjects) {
    const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
    const largeObjectsCount = largeObjects.length;
    const potentialLeaksCount = leaks.highRetainedSize.length + leaks.duplicateObjects.length;
    
    // Analyze the specific issues found
    const criticalIssues = [];
    const recommendations = [];
    
    // Check for string concatenation leaks
    const stringConcatLeak = leaks.duplicateObjects.find(obj => 
      obj.type.includes('concatenated string') && obj.count > 1000000
    );
    if (stringConcatLeak) {
      criticalIssues.push({
        type: 'String Concatenation Leak',
        severity: 'CRITICAL',
        description: `${stringConcatLeak.count.toLocaleString()} concatenated strings detected`,
        impact: 'Massive memory consumption from string operations'
      });
      recommendations.push({
        issue: 'String Concatenation Leak',
        action: 'Review string concatenation in loops, use StringBuilder or template literals',
        files: 'Check for string concatenation in data processing, API responses, or template rendering'
      });
    }
    
    // Check for large JSON objects
    const largeJsonObjects = largeObjects.filter(obj => 
      obj.name && (obj.name.includes('{') || obj.name.includes('JSON')) && obj.selfSize > 30000
    );
    if (largeJsonObjects.length > 0) {
      criticalIssues.push({
        type: 'Large JSON Response Caching',
        severity: 'HIGH',
        description: `${largeJsonObjects.length} large JSON objects (${Math.round(largeJsonObjects[0].selfSize / 1024)}KB each)`,
        impact: 'Memory waste from caching large API responses'
      });
      recommendations.push({
        issue: 'Large JSON Response Caching',
        action: 'Implement response pagination, reduce payload size, or add cache expiration',
        files: 'Check API response handling, caching middleware, and data processing services'
      });
    }
    
    // Check for object/array proliferation
    const objectLeak = leaks.duplicateObjects.find(obj => 
      obj.type.includes('object_Object') && obj.count > 100000
    );
    if (objectLeak) {
      criticalIssues.push({
        type: 'Object Proliferation',
        severity: 'HIGH', 
        description: `${objectLeak.count.toLocaleString()} generic objects created`,
        impact: 'Excessive object creation without proper cleanup'
      });
      recommendations.push({
        issue: 'Object Proliferation',
        action: 'Review object lifecycle management, implement object pooling, or add explicit cleanup',
        files: 'Check data processing pipelines, event handlers, and business logic modules'
      });
    }
    
    return {
      totalSizeMB,
      largeObjectsCount,
      potentialLeaksCount,
      criticalIssues,
      recommendations,
      topNodeTypes: Object.entries(stats.nodeTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }
}
