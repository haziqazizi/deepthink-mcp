import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

/**
 * File operations tools for agentic access
 */
export class FileTools {
  constructor() {
    this.workingDirectory = process.cwd();
  }

  /**
   * Read file contents
   */
  async readFile(filePath) {
    try {
      const absolutePath = path.resolve(this.workingDirectory, filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');
      
      // Return with line numbers like Amp's Read tool
      const numberedContent = lines
        .map((line, index) => `${index + 1}: ${line}`)
        .join('\n');
        
      return {
        path: absolutePath,
        content: numberedContent,
        lineCount: lines.length
      };
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath = '.') {
    try {
      const absolutePath = path.resolve(this.workingDirectory, dirPath);
      const items = await fs.readdir(absolutePath, { withFileTypes: true });
      
      const result = {
        path: absolutePath,
        items: items.map(item => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          isDirectory: item.isDirectory()
        }))
      };
      
      return result;
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Search for text patterns using grep-like functionality
   */
  async grep(pattern, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        path: searchPath = '.',
        caseSensitive = false,
        recursive = true,
        filePattern = '*'
      } = options;

      const args = ['grep'];
      
      if (!caseSensitive) args.push('-i');
      if (recursive) args.push('-r');
      args.push('-n'); // Show line numbers
      args.push(pattern);
      
      const absolutePath = path.resolve(this.workingDirectory, searchPath);
      args.push(absolutePath);

      const grep = spawn('grep', args);
      let output = '';
      let errorOutput = '';

      grep.stdout.on('data', (data) => {
        output += data.toString();
      });

      grep.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      grep.on('close', (code) => {
        if (code === 0) {
          const matches = output.trim().split('\n')
            .filter(line => line.length > 0)
            .map(line => {
              const [filePath, lineNumber, ...contentParts] = line.split(':');
              return {
                file: filePath,
                line: parseInt(lineNumber),
                content: contentParts.join(':').trim()
              };
            });
            
          resolve({ matches, pattern, searchPath: absolutePath });
        } else if (code === 1) {
          // No matches found
          resolve({ matches: [], pattern, searchPath: absolutePath });
        } else {
          reject(new Error(`Grep failed: ${errorOutput}`));
        }
      });
    });
  }

  /**
   * Find files using glob patterns
   */
  async glob(pattern, basePath = '.') {
    return new Promise((resolve, reject) => {
      const absoluteBase = path.resolve(this.workingDirectory, basePath);
      
      // Use find command for glob-like functionality
      const find = spawn('find', [absoluteBase, '-name', pattern]);
      let output = '';
      let errorOutput = '';

      find.stdout.on('data', (data) => {
        output += data.toString();
      });

      find.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      find.on('close', (code) => {
        if (code === 0) {
          const files = output.trim().split('\n')
            .filter(line => line.length > 0)
            .map(filePath => ({
              path: filePath,
              relativePath: path.relative(absoluteBase, filePath)
            }));
            
          resolve({ files, pattern, basePath: absoluteBase });
        } else {
          reject(new Error(`Find failed: ${errorOutput}`));
        }
      });
    });
  }

  /**
   * Get working directory
   */
  getWorkingDirectory() {
    return this.workingDirectory;
  }

  /**
   * Set working directory  
   */
  setWorkingDirectory(dirPath) {
    const absolutePath = path.resolve(dirPath);
    this.workingDirectory = absolutePath;
    return absolutePath;
  }
}
