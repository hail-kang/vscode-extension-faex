import * as vscode from "vscode"

/**
 * Configuration interface for faex extension
 */
export interface FaexConfig {
  enable: boolean
  faexPath: string
  depth: number
  ignore: string[]
  exclude: string[]
  validateOnSave: boolean
  validateOnType: boolean
  showCodeLens: boolean
}

/**
 * Get the current configuration for faex
 */
export function getConfig(): FaexConfig {
  const config = vscode.workspace.getConfiguration("faex")

  return {
    enable: config.get<boolean>("enable", true),
    faexPath: config.get<string>("faexPath", "faex"),
    depth: config.get<number>("depth", 3),
    ignore: config.get<string[]>("ignore", []),
    exclude: config.get<string[]>("exclude", ["**/tests/**", "**/test_*.py"]),
    validateOnSave: config.get<boolean>("validateOnSave", true),
    validateOnType: config.get<boolean>("validateOnType", false),
    showCodeLens: config.get<boolean>("showCodeLens", true),
  }
}

/**
 * Check if a file should be excluded from analysis
 */
export function shouldExcludeFile(filePath: string, config: FaexConfig): boolean {
  const relativePath = vscode.workspace.asRelativePath(filePath)

  for (const pattern of config.exclude) {
    if (matchGlobPattern(relativePath, pattern)) {
      return true
    }
  }

  return false
}

/**
 * Check if an exception class should be ignored
 */
export function shouldIgnoreException(exceptionClass: string, config: FaexConfig): boolean {
  return config.ignore.includes(exceptionClass)
}

/**
 * Simple glob pattern matching
 * Supports * and ** patterns
 */
function matchGlobPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(path)
}

/**
 * Listen for configuration changes
 */
export function onConfigChange(callback: (config: FaexConfig) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("faex")) {
      callback(getConfig())
    }
  })
}
