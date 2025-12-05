import * as vscode from "vscode"
import { runFaexCli, FaexEndpoint } from "./cli"
import { EndpointInfo, ExceptionLocation, AnalysisResult } from "../types"
import { getConfig, shouldExcludeFile } from "../utils/config"

/**
 * Convert faex CLI output to internal types
 */
function convertEndpoint(faexEndpoint: FaexEndpoint): EndpointInfo {
  return {
    file: faexEndpoint.file,
    line: faexEndpoint.line,
    column: 0,
    functionName: faexEndpoint.function,
    method: faexEndpoint.method,
    path: faexEndpoint.path,
    decoratorLine: faexEndpoint.line, // faex doesn't provide this separately
    declaredExceptions: faexEndpoint.declared_exceptions,
    detectedExceptions: [], // Not provided by faex JSON directly
    // Store undeclared exceptions for diagnostics
    _undeclaredExceptions: faexEndpoint.undeclared_exceptions.map(
      (exc): ExceptionLocation => ({
        file: exc.file,
        line: exc.line,
        column: 0,
        exceptionClass: exc.class,
        inFunction: exc.in_function || undefined,
      })
    ),
  }
}

/**
 * Analyzes FastAPI endpoints using faex CLI
 */
export class EndpointAnalyzer {
  private cache: Map<string, EndpointInfo[]> = new Map()

  /**
   * Analyze a single document using faex CLI
   */
  async analyzeDocument(document: vscode.TextDocument): Promise<AnalysisResult> {
    const config = getConfig()

    if (shouldExcludeFile(document.uri.fsPath, config)) {
      return { endpoints: [], errors: [] }
    }

    // Save the document first to ensure faex sees the latest content
    if (document.isDirty) {
      await document.save()
    }

    try {
      const result = await runFaexCli(document.uri.fsPath)

      if (!result) {
        return { endpoints: [], errors: [] }
      }

      const endpoints = result.endpoints.map(convertEndpoint)

      // Cache the results
      this.cache.set(document.uri.fsPath, endpoints)

      return {
        endpoints,
        errors: result.errors.map((msg) => ({
          file: document.uri.fsPath,
          message: msg,
        })),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return {
        endpoints: [],
        errors: [
          {
            file: document.uri.fsPath,
            message: `Failed to analyze: ${message}`,
          },
        ],
      }
    }
  }

  /**
   * Analyze entire workspace using faex CLI
   */
  async analyzeWorkspace(): Promise<AnalysisResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return { endpoints: [], errors: [] }
    }

    try {
      const result = await runFaexCli(workspaceFolder.uri.fsPath)

      if (!result) {
        return { endpoints: [], errors: [] }
      }

      const endpoints = result.endpoints.map(convertEndpoint)

      // Cache by file
      const byFile = new Map<string, EndpointInfo[]>()
      for (const endpoint of endpoints) {
        const list = byFile.get(endpoint.file) || []
        list.push(endpoint)
        byFile.set(endpoint.file, list)
      }
      for (const [file, eps] of byFile) {
        this.cache.set(file, eps)
      }

      return {
        endpoints,
        errors: result.errors.map((msg) => ({
          file: workspaceFolder.uri.fsPath,
          message: msg,
        })),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return {
        endpoints: [],
        errors: [
          {
            file: workspaceFolder.uri.fsPath,
            message: `Failed to analyze: ${message}`,
          },
        ],
      }
    }
  }

  /**
   * Get cached endpoints for a file
   */
  getCachedEndpoints(filePath: string): EndpointInfo[] | undefined {
    return this.cache.get(filePath)
  }

  /**
   * Clear cache for a file
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get endpoints with undeclared exceptions
   */
  getEndpointsWithIssues(result: AnalysisResult): EndpointInfo[] {
    return result.endpoints.filter((endpoint) => {
      const undeclared = (
        endpoint as EndpointInfo & { _undeclaredExceptions?: ExceptionLocation[] }
      )._undeclaredExceptions
      return undeclared && undeclared.length > 0
    })
  }
}

/**
 * Create a diagnostic from an undeclared exception
 */
export function createDiagnostic(
  endpoint: EndpointInfo,
  exception: ExceptionLocation,
  document: vscode.TextDocument
): vscode.Diagnostic {
  // Create range for the raise statement
  const line = exception.line - 1 // 0-indexed
  const lineText = line < document.lineCount ? document.lineAt(line).text : ""
  const startCol = lineText.indexOf("raise")
  const endCol =
    startCol >= 0 ? startCol + `raise ${exception.exceptionClass}`.length : lineText.length

  const range = new vscode.Range(
    new vscode.Position(line, Math.max(0, startCol)),
    new vscode.Position(line, Math.max(0, endCol))
  )

  const message = exception.inFunction
    ? `Exception '${exception.exceptionClass}' raised in '${exception.inFunction}' is not declared in endpoint '${endpoint.functionName}'`
    : `Exception '${exception.exceptionClass}' is not declared in endpoint '${endpoint.functionName}'`

  const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning)

  diagnostic.source = "faex"
  diagnostic.code = "undeclared-exception"

  // Store metadata for quick fix
  ;(diagnostic as DiagnosticWithMetadata).metadata = {
    endpoint,
    exception,
  }

  return diagnostic
}

/**
 * Extended diagnostic with metadata
 */
export interface DiagnosticWithMetadata extends vscode.Diagnostic {
  metadata?: {
    endpoint: EndpointInfo
    exception: ExceptionLocation
  }
}

/**
 * Singleton analyzer instance
 */
let analyzerInstance: EndpointAnalyzer | null = null

export function getAnalyzer(): EndpointAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new EndpointAnalyzer()
  }
  return analyzerInstance
}
