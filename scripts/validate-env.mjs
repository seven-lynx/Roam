#!/usr/bin/env node

/**
 * Environment Validation Script
 * 
 * Validates all required environment variables and configurations before deployment.
 * Run this script in the root directory or web/ directory.
 * 
 * Usage:
 *   node scripts/validate-env.mjs [--strict] [--json]
 * 
 * Options:
 *   --strict  Exit with error code 1 if ANY warning (not just errors)
 *   --json    Output results as JSON (for CI/CD integration)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Configuration
const ENV_VARS = {
  // Web - Public (safe for client)
  'NEXT_PUBLIC_SUPABASE_URL': {
    type: 'string',
    required: true,
    description: 'Supabase project URL',
    example: 'https://xxxxx.supabase.co',
    pattern: /^https:\/\/.+\.supabase\.co$/,
  },
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': {
    type: 'string',
    required: true,
    description: 'Supabase anonymous public key',
    // Same two formats as the service role key: the legacy anon JWT (~200 chars) or the
    // newer sb_publishable_… key, which is legitimately shorter than the old minimum.
    accept: [
      { minLength: 100 },
      { prefix: 'sb_publishable_', minLength: 30 },
    ],
  },
  'NEXT_PUBLIC_SENTRY_DSN': {
    type: 'string',
    required: false,
    description: 'Sentry error tracking DSN',
    example: 'https://xxxxx@xxxxx.ingest.sentry.io/xxxxx',
  },

  // Web - Private (server-only)
  'SUPABASE_SERVICE_ROLE_KEY': {
    type: 'string',
    required: true,
    description: 'Supabase service role key (KEEP PRIVATE)',
    // Supabase issues two formats: the legacy service_role JWT (~200 chars) and the
    // newer sb_secret_… key, which is legitimately shorter than the old minimum.
    accept: [
      { minLength: 100 },
      { prefix: 'sb_secret_', minLength: 30 },
    ],
  },
  'SENTRY_AUTH_TOKEN': {
    type: 'string',
    required: false,
    description: 'Sentry authentication token for source maps',
  },
};

// Paths below are relative to web/.
const FILES_TO_CHECK = [
  'package.json',
  'tsconfig.json',
  'next.config.ts',
];

// Paths below are relative to the repo root. pnpm-lock.yaml is not in web/ because the
// workspace spans ./, web/ and extension/, and only the root lockfile is real.
const ROOT_FILES_TO_CHECK = [
  'package.json',
  'pnpm-lock.yaml',
];

class EnvValidator {
  constructor(options = {}) {
    this.strict = options.strict || false;
    this.json = options.json || false;
    this.errors = [];
    this.warnings = [];
    this.checks = {
      envVars: { passed: 0, failed: 0 },
      files: { passed: 0, failed: 0 },
      git: { passed: 0, failed: 0 },
      database: { passed: 0, failed: 0 },
    };
  }

  log(message, type = 'info') {
    if (this.json) return;
    
    const colors = {
      info: '\x1b[36m',   // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m',
    };

    const icon = {
      info: 'ℹ',
      success: '✓',
      warning: '⚠',
      error: '✗',
    }[type];

    console.log(`${colors[type]}${icon} ${message}${colors.reset}`);
  }

  addError(category, message) {
    this.errors.push({ category, message });
    this.checks[category] && this.checks[category].failed++;
  }

  addWarning(category, message) {
    this.warnings.push({ category, message });
  }

  addSuccess(category) {
    this.checks[category] && this.checks[category].passed++;
  }

  validateEnvVars() {
    this.log('Checking environment variables...', 'info');

    const envPath = path.join(rootDir, 'web', '.env.local');
    
    if (!fs.existsSync(envPath)) {
      this.addError('envVars', '.env.local not found in web/ directory');
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = this.parseEnvFile(envContent);

    Object.entries(ENV_VARS).forEach(([varName, config]) => {
      const value = envVars[varName] || process.env[varName];

      if (!value) {
        if (config.required) {
          this.addError('envVars', `Missing required: ${varName}`);
          this.log(`  Missing: ${varName}`, 'error');
        } else {
          this.addWarning('envVars', `Optional not set: ${varName}`);
          this.log(`  Optional not set: ${varName}`, 'warning');
        }
        return;
      }

      // Validate format if pattern provided
      if (config.pattern && !config.pattern.test(value)) {
        this.addError('envVars', `Invalid format for ${varName}: ${value}`);
        this.log(`  Invalid format: ${varName}`, 'error');
        return;
      }

      // Validate against the accepted shapes, for a variable that has more than one.
      // A truncated paste satisfies neither and is still rejected.
      if (config.accept && !config.accept.some(rule =>
        (!rule.prefix || value.startsWith(rule.prefix)) && value.length >= rule.minLength
      )) {
        const expected = config.accept
          .map(rule => (rule.prefix ? `${rule.prefix}… (min ${rule.minLength})` : `min ${rule.minLength} chars`))
          .join(' or ');
        this.addError('envVars', `${varName} does not match an accepted format (${expected})`);
        this.log(`  Unexpected format: ${varName}`, 'error');
        return;
      }

      // Validate length if minLength provided
      if (config.minLength && value.length < config.minLength) {
        this.addError('envVars', `${varName} is too short (min: ${config.minLength})`);
        this.log(`  Too short: ${varName}`, 'error');
        return;
      }

      // Warn if value contains test/debug keywords
      if (/test|debug|localhost|example/i.test(value)) {
        this.addWarning('envVars', `${varName} may contain test value: ${value.substring(0, 20)}...`);
        this.log(`  Possible test value: ${varName}`, 'warning');
      }

      this.addSuccess('envVars');
      this.log(`  ✓ ${varName}`, 'success');
    });
  }

  /** Report one required file, resolved against the directory it is expected in. */
  checkFile(baseDir, file) {
    if (fs.existsSync(path.join(baseDir, file))) {
      this.addSuccess('files');
      this.log(`  ✓ ${file}`, 'success');
    } else {
      this.addError('files', `Missing file: ${file}`);
      this.log(`  Missing: ${file}`, 'error');
    }
  }

  validateFiles() {
    this.log('\nChecking required files...', 'info');

    FILES_TO_CHECK.forEach(file => this.checkFile(path.join(rootDir, 'web'), file));
    ROOT_FILES_TO_CHECK.forEach(file => this.checkFile(rootDir, file));

    // Check if .env.local in .gitignore
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.env.local')) {
        this.addWarning('files', '.env.local not in .gitignore (security risk)');
        this.log('  Warning: .env.local not in .gitignore', 'warning');
      } else {
        this.addSuccess('files');
        this.log('  ✓ .env.local in .gitignore', 'success');
      }
    }
  }

  validateGit() {
    this.log('\nChecking Git configuration...', 'info');

    try {
      const gitDir = path.join(rootDir, '.git');
      if (fs.existsSync(gitDir)) {
        this.addSuccess('git');
        this.log('  ✓ Git repository initialized', 'success');
      } else {
        this.addError('git', 'Git repository not initialized');
        this.log('  Git not initialized', 'error');
      }
    } catch (e) {
      this.addWarning('git', 'Could not verify git status');
    }
  }

  validateDatabase() {
    this.log('\nChecking database configuration...', 'info');

    const envPath = path.join(rootDir, 'web', '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const envVars = this.parseEnvFile(envContent);

      const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
      const supabaseKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

      if (supabaseUrl && supabaseKey) {
        this.addSuccess('database');
        this.log(`  ✓ Supabase configured at ${supabaseUrl}`, 'success');
      } else {
        this.addError('database', 'Supabase credentials incomplete');
      }
    }
  }

  validateBuild() {
    this.log('\nChecking build configuration...', 'info');

    const nextConfigPath = path.join(rootDir, 'web', 'next.config.ts');
    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf-8');
      
      // Check for common issues
      if (!content.includes('typescript')) {
        this.addWarning('files', 'TypeScript config may not be explicit in next.config');
      }

      this.addSuccess('files');
      this.log('  ✓ Next.js config present', 'success');
    } else {
      this.addError('files', 'next.config.ts not found');
    }
  }

  validateSecrets() {
    this.log('\nChecking for exposed secrets...', 'info');

    // Supabase clients live in web/src/lib/supabase/ — a directory, not a single file.
    // Pointing at the old single-file path made this scan silently skip the client.
    const supabaseLibDir = path.join(rootDir, 'web', 'src', 'lib', 'supabase');
    const supabaseModules = fs.existsSync(supabaseLibDir)
      ? fs.readdirSync(supabaseLibDir)
          .filter(name => name.endsWith('.ts'))
          .map(name => path.join(supabaseLibDir, name))
      : [];

    const filesToCheck = [
      path.join(rootDir, 'web', 'src', 'app', 'page.tsx'),
      ...supabaseModules,
    ];

    const secretPatterns = [
      /SUPABASE_SERVICE_ROLE_KEY/,
      /SENTRY_AUTH_TOKEN/,
      /private_key/,
      /secret_key/,
      /api_key.*=/,
    ];

    let issuesFound = false;

    filesToCheck.forEach(filePath => {
      if (!fs.existsSync(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      secretPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          // Private keys found — only warn if value is actually hardcoded
          if (/=\s*["']/.test(content)) {
            this.addWarning('envVars', `Possible secret hardcoded in ${path.relative(rootDir, filePath)}`);
            issuesFound = true;
          }
        }
      });
    });

    if (!issuesFound) {
      this.addSuccess('envVars');
      this.log('  ✓ No hardcoded secrets detected', 'success');
    }
  }

  validatePackageJson() {
    this.log('\nChecking package.json...', 'info');

    const packagePath = path.join(rootDir, 'web', 'package.json');
    if (!fs.existsSync(packagePath)) {
      this.addError('files', 'package.json not found');
      return;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

      const requiredScripts = ['build', 'start', 'dev', 'lint'];
      requiredScripts.forEach(script => {
        if (pkg.scripts && pkg.scripts[script]) {
          this.log(`  ✓ Script "${script}" defined`, 'success');
        } else {
          this.addWarning('files', `Missing script: ${script}`);
          this.log(`  Missing script: ${script}`, 'warning');
        }
      });

      this.addSuccess('files');
    } catch (e) {
      this.addError('files', `Invalid package.json: ${e.message}`);
    }
  }

  parseEnvFile(content) {
    const vars = {};
    const lines = content.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const [key, value] = line.split('=').map(s => s.trim());
      if (key && value) {
        // Remove quotes if present
        vars[key] = value.replace(/^["']|["']$/g, '');
      }
    });

    return vars;
  }

  validate() {
    this.log('🔍 Validating Roam environment configuration\n', 'info');

    this.validateEnvVars();
    this.validateFiles();
    this.validateGit();
    this.validateDatabase();
    this.validateBuild();
    this.validateSecrets();
    this.validatePackageJson();

    this.printSummary();
    return this.getExitCode();
  }

  printSummary() {
    if (this.json) {
      console.log(JSON.stringify({
        success: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        checks: this.checks,
      }, null, 2));
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Validation Summary');
    console.log('='.repeat(50));

    const totalErrors = this.errors.length;
    const totalWarnings = this.warnings.length;

    if (totalErrors === 0 && totalWarnings === 0) {
      this.log('✅ All checks passed!', 'success');
    } else if (totalErrors === 0) {
      this.log(`⚠️  ${totalWarnings} warning(s)`, 'warning');
    } else {
      this.log(`❌ ${totalErrors} error(s), ${totalWarnings} warning(s)`, 'error');
    }

    console.log('\nDetailed Results:');
    Object.entries(this.checks).forEach(([category, stats]) => {
      const total = stats.passed + stats.failed;
      if (total > 0) {
        const status = stats.failed === 0 ? '✓' : '✗';
        console.log(`  ${status} ${category}: ${stats.passed}/${total} passed`);
      }
    });

    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(err => {
        console.log(`  ✗ ${err.message}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\nWarnings:');
      this.warnings.forEach(warn => {
        console.log(`  ⚠ ${warn.message}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log('Ready to deploy: ' + (this.errors.length === 0 ? '✅ YES' : '❌ NO'));
    console.log('='.repeat(50) + '\n');
  }

  getExitCode() {
    if (this.errors.length > 0) return 1;
    if (this.strict && this.warnings.length > 0) return 1;
    return 0;
  }
}

// Parse command-line arguments
const args = process.argv.slice(2);
const options = {
  strict: args.includes('--strict'),
  json: args.includes('--json'),
};

// Run validation
const validator = new EnvValidator(options);
const exitCode = validator.validate();

process.exit(exitCode);
