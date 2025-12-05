/**
 * Type definitions for faex-vscode
 * Mirrors the data models from faex Python CLI
 */

/**
 * Represents the location where an exception is raised
 */
export interface ExceptionLocation {
  /** File path where the exception is raised */
  file: string
  /** Line number (1-indexed) */
  line: number
  /** Column offset (0-indexed) */
  column: number
  /** Exception class name */
  exceptionClass: string
  /** Function name if raised transitively (in a called function) */
  inFunction?: string
}

/**
 * Represents a FastAPI endpoint with its exception information
 */
export interface EndpointInfo {
  /** File path containing the endpoint */
  file: string
  /** Line number where the endpoint is defined */
  line: number
  /** Column offset */
  column: number
  /** Name of the endpoint function */
  functionName: string
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string
  /** URL path */
  path: string
  /** Line number where the decorator starts */
  decoratorLine: number
  /** Line number where exceptions parameter is (if exists) */
  exceptionsLine?: number
  /** Exception classes declared in the decorator */
  declaredExceptions: string[]
  /** Exception locations detected in the function (from TypeScript parser) */
  detectedExceptions: ExceptionLocation[]
  /** Undeclared exceptions from faex CLI */
  _undeclaredExceptions?: ExceptionLocation[]
}

/**
 * Get undeclared exceptions from endpoint
 * Uses _undeclaredExceptions from CLI or computes from detected vs declared
 */
export function getUndeclaredExceptions(endpoint: EndpointInfo): ExceptionLocation[] {
  // If we have undeclared exceptions from CLI, use those
  if (endpoint._undeclaredExceptions) {
    return endpoint._undeclaredExceptions
  }
  // Fallback to computing from declared vs detected
  const declaredSet = new Set(endpoint.declaredExceptions)
  return endpoint.detectedExceptions.filter((exc) => !declaredSet.has(exc.exceptionClass))
}

export function getUnusedDeclarations(endpoint: EndpointInfo): string[] {
  const detectedSet = new Set(endpoint.detectedExceptions.map((exc) => exc.exceptionClass))
  return endpoint.declaredExceptions.filter((exc) => !detectedSet.has(exc))
}

export function hasIssues(endpoint: EndpointInfo): boolean {
  return getUndeclaredExceptions(endpoint).length > 0
}

/**
 * Result of analyzing a file or workspace
 */
export interface AnalysisResult {
  /** List of analyzed endpoints */
  endpoints: EndpointInfo[]
  /** Parsing or analysis errors */
  errors: AnalysisError[]
}

/**
 * Represents an error during analysis
 */
export interface AnalysisError {
  /** File where error occurred */
  file: string
  /** Line number if available */
  line?: number
  /** Error message */
  message: string
}

/**
 * Helper functions for AnalysisResult
 */
export function getEndpointsWithIssues(result: AnalysisResult): EndpointInfo[] {
  return result.endpoints.filter(hasIssues)
}

export function getTotalUndeclared(result: AnalysisResult): number {
  return result.endpoints.reduce(
    (sum, endpoint) => sum + getUndeclaredExceptions(endpoint).length,
    0
  )
}

export function resultHasIssues(result: AnalysisResult): boolean {
  return result.endpoints.some(hasIssues)
}

/**
 * HTTP methods supported by FastAPI
 */
export const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]
