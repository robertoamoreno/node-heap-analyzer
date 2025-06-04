#!/usr/bin/env node

import { Command } from 'commander';
import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import { HeapAnalyzer } from './heap-analyzer.js';
import { LLMAnalyzer } from './llm-analyzer.js';
import { ReportGenerator } from './report-generator.js';
import { ComparisonAnalyzer } from './comparison-analyzer.js';

const program = new Command();

program
  .name('node-heap-analyzer')
  .description('AI-powered Node.js heap snapshot analyzer for memory leak detection')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze heap snapshot for memory leaks')
  .requiredOption('-f, --file <path>', 'Path to heap snapshot file')
  .option('-o, --output <path>', 'Output directory for reports', './reports')
  .option('--no-llm', 'Skip LLM analysis')
  .option('--api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Starting heap snapshot analysis...'));
      
      const spinner = ora('Loading heap snapshot...').start();
      
      // Initialize analyzers
      const heapAnalyzer = new HeapAnalyzer();
      
      // Only create LLMAnalyzer if LLM analysis is enabled *and* an API key is available
      let llmAnalyzer = null;
      if (options.llm) {
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
          llmAnalyzer = new LLMAnalyzer(apiKey);
        } else {
          console.warn(chalk.yellow('⚠️  Skipping LLM analysis: missing Anthropic API key'));
        }
      }
      
      const reportGenerator = new ReportGenerator(options.output);
      
      // Analyze heap snapshot
      spinner.text = 'Analyzing heap snapshot with memlab...';
      const heapAnalysis = await heapAnalyzer.analyze(options.file);
      spinner.succeed('Heap analysis complete');
      
      let llmAnalysis = null;
      if (llmAnalyzer) {
        const llmSpinner = ora('Analyzing with LLM...').start();
        try {
          llmAnalysis = await llmAnalyzer.analyze(heapAnalysis);
          llmSpinner.succeed('LLM analysis complete');
        } catch (error) {
          llmSpinner.fail(`LLM analysis failed: ${error.message}`);
          console.warn(chalk.yellow('⚠️  Continuing without LLM analysis'));
        }
      }
      
      // Generate report
      const reportSpinner = ora('Generating report...').start();
      const reportPath = await reportGenerator.generate(heapAnalysis, llmAnalysis);
      reportSpinner.succeed(`Report generated: ${reportPath}`);
      
      console.log(chalk.green('✅ Analysis complete!'));
      console.log(chalk.cyan(`📊 Report saved to: ${reportPath}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare two heap snapshots to analyze optimization effectiveness')
  .requiredOption('-b, --before <path>', 'Path to "before" heap snapshot file')
  .requiredOption('-a, --after <path>', 'Path to "after" heap snapshot file')
  .option('-o, --output <path>', 'Output directory for reports', './reports')
  .option('--no-llm', 'Skip LLM analysis')
  .option('--api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📊 Starting heap snapshot comparison...'));
      
      const spinner = ora('Loading heap snapshots...').start();
      
      // Initialize analyzers
      const heapAnalyzer = new HeapAnalyzer();
      const comparisonAnalyzer = new ComparisonAnalyzer();
      
      // Only create LLMAnalyzer if LLM analysis is enabled *and* an API key is available
      let llmAnalyzer = null;
      if (options.llm) {
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
          llmAnalyzer = new LLMAnalyzer(apiKey);
        } else {
          console.warn(chalk.yellow('⚠️  Skipping LLM analysis: missing Anthropic API key'));
        }
      }
      
      const reportGenerator = new ReportGenerator(options.output);
      
      // Analyze both heap snapshots
      spinner.text = 'Analyzing "before" heap snapshot...';
      const beforeAnalysis = await heapAnalyzer.analyze(options.before);
      
      spinner.text = 'Analyzing "after" heap snapshot...';
      const afterAnalysis = await heapAnalyzer.analyze(options.after);
      
      spinner.text = 'Comparing heap snapshots...';
      const comparisonAnalysis = await comparisonAnalyzer.compare(beforeAnalysis, afterAnalysis);
      spinner.succeed('Heap comparison complete');
      
      let llmAnalysis = null;
      if (llmAnalyzer) {
        const llmSpinner = ora('Analyzing comparison with LLM...').start();
        try {
          llmAnalysis = await llmAnalyzer.analyzeComparison(comparisonAnalysis);
          llmSpinner.succeed('LLM comparison analysis complete');
        } catch (error) {
          llmSpinner.fail(`LLM analysis failed: ${error.message}`);
          console.warn(chalk.yellow('⚠️  Continuing without LLM analysis'));
        }
      }
      
      // Generate comparison report
      const reportSpinner = ora('Generating comparison report...').start();
      const reportPath = await reportGenerator.generate(null, llmAnalysis, comparisonAnalysis);
      reportSpinner.succeed(`Comparison report generated: ${reportPath}`);
      
      // Display summary
      console.log(chalk.green('✅ Comparison complete!'));
      console.log(chalk.cyan(`📊 Report saved to: ${reportPath}`));
      
      const { summary } = comparisonAnalysis;
      console.log(chalk.blue('\n📈 Quick Summary:'));
      console.log(`Overall Trend: ${summary.overallTrend === 'improved' ? chalk.green(summary.overallTrend) : 
                                     summary.overallTrend === 'regressed' ? chalk.red(summary.overallTrend) : 
                                     chalk.yellow(summary.overallTrend)}`);
      console.log(`Improvements: ${chalk.green(summary.improvementsCount)}`);
      console.log(`Regressions: ${chalk.red(summary.regressionsCount)}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
