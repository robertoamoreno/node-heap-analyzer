# 🔍 Node Heap Analyzer

**AI-powered Node.js heap snapshot analyzer for memory leak detection and optimization**

Node Heap Analyzer is a powerful CLI tool that combines [memlab](https://facebook.github.io/memlab/) heap analysis with AI-powered insights from Anthropic's Claude to detect memory leaks, performance issues, and optimization opportunities in Node.js applications.

## Features

- 🔍 **Comprehensive Heap Analysis**: Uses memlab to analyze heap snapshots
- 🤖 **AI-Powered Insights**: Leverages Anthropic's Claude for intelligent analysis
- 📊 **Multiple Report Formats**: Generates HTML, Markdown, and JSON reports
- ⚡ **Memory Leak Detection**: Identifies potential leaks and retention issues
- 🔗 **Connection Analysis**: Detects connection-related memory issues
- 📈 **Large Object Detection**: Finds objects consuming significant memory

## Installation

```bash
npm install
```

## Setup

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Add your Anthropic API key to `.env`:
```bash
ANTHROPIC_API_KEY=your_api_key_here
```

## Usage

### Basic Analysis

```bash
npm run analyze -- analyze -f path/to/your/heap-snapshot.heapsnapshot
```

### Advanced Options

```bash
# Specify output directory
npm run analyze -- analyze -f heap.heapsnapshot -o ./custom-reports

# Skip LLM analysis
npm run analyze -- analyze -f heap.heapsnapshot --no-llm

# Provide API key via command line
npm run analyze -- analyze -f heap.heapsnapshot --api-key your_key_here
```

## Taking Heap Snapshots

### In Your Node.js Application

```javascript
const v8 = require('v8');
const fs = require('fs');

// Take a heap snapshot
const heapSnapshot = v8.writeHeapSnapshot();
console.log('Heap snapshot written to', heapSnapshot);
```

### Using Chrome DevTools

1. Connect to your Node.js app with `--inspect`
2. Open Chrome DevTools
3. Go to Memory tab
4. Take a heap snapshot
5. Save the `.heapsnapshot` file

## Report Output

The tool generates three types of reports:

- **HTML Report** (`report.html`): Interactive web-based report
- **Markdown Report** (`report.md`): Human-readable markdown format
- **JSON Report** (`analysis.json`): Machine-readable data

## What It Analyzes

### Memory Leak Detection
- Objects with high retained size
- Duplicate objects that may indicate leaks
- Objects preventing garbage collection

### Performance Issues
- Large objects consuming significant memory
- Detached DOM nodes (for browser-like environments)
- Connection-related objects that may not be properly closed

### AI Analysis
- Root cause analysis of detected issues
- Severity assessment of problems
- Specific recommendations for fixes
- Monitoring suggestions

## Example Output

```
🔍 Starting heap snapshot analysis...
✅ Heap analysis complete
✅ LLM analysis complete
✅ Report generated: ./reports/heap-analysis-2024-01-15T10-30-00-000Z
📊 Report saved to: ./reports/heap-analysis-2024-01-15T10-30-00-000Z
```

## Common Issues Detected

- **Memory Leaks**: Objects not being garbage collected
- **Connection Leaks**: Unclosed database connections, HTTP clients
- **Event Listener Leaks**: Unremoved event listeners
- **Closure Leaks**: Closures retaining unnecessary references
- **Large Buffer/Array Accumulation**: Growing collections not being cleaned

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
