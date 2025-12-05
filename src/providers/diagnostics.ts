import * as vscode from "vscode"
import { getAnalyzer, createDiagnostic } from "../analyzer/analyzer"
import { EndpointInfo, getUndeclaredExceptions } from "../types"
import { getConfig, shouldExcludeFile } from "../utils/config"

/**
 * Manages diagnostics for faex
 */
export class DiagnosticsManager implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection
  private endpointCache: Map<string, EndpointInfo[]> = new Map()
  private analysisInProgress: Set<string> = new Set()

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("faex")
  }

  /**
   * Analyze a document and update diagnostics
   */
  async analyzeDocument(document: vscode.TextDocument): Promise<void> {
    const config = getConfig()

    if (!config.enable) {
      return
    }

    if (document.languageId !== "python") {
      return
    }

    if (shouldExcludeFile(document.uri.fsPath, config)) {
      this.clearDiagnostics(document.uri)
      return
    }

    // Prevent concurrent analysis of the same file
    if (this.analysisInProgress.has(document.uri.fsPath)) {
      return
    }

    this.analysisInProgress.add(document.uri.fsPath)

    try {
      const analyzer = getAnalyzer()
      const result = await analyzer.analyzeDocument(document)

      // Cache endpoints for other providers
      this.endpointCache.set(document.uri.fsPath, result.endpoints)

      // Create diagnostics
      const diagnostics: vscode.Diagnostic[] = []

      for (const endpoint of result.endpoints) {
        const undeclared = getUndeclaredExceptions(endpoint)

        for (const exception of undeclared) {
          const diagnostic = createDiagnostic(endpoint, exception, document)
          diagnostics.push(diagnostic)
        }
      }

      this.diagnosticCollection.set(document.uri, diagnostics)
    } finally {
      this.analysisInProgress.delete(document.uri.fsPath)
    }
  }

  /**
   * Get endpoints for a file
   */
  getEndpoints(filePath: string): EndpointInfo[] {
    return this.endpointCache.get(filePath) || []
  }

  /**
   * Get diagnostics for a URI
   */
  getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.diagnosticCollection.get(uri) || []
  }

  /**
   * Clear diagnostics for a specific URI
   */
  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri)
    this.endpointCache.delete(uri.fsPath)
  }

  /**
   * Clear all diagnostics
   */
  clearAllDiagnostics(): void {
    this.diagnosticCollection.clear()
    this.endpointCache.clear()
  }

  /**
   * Refresh all diagnostics
   */
  async refreshAll(): Promise<void> {
    this.clearAllDiagnostics()

    for (const document of vscode.workspace.textDocuments) {
      if (document.languageId === "python") {
        await this.analyzeDocument(document)
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.diagnosticCollection.dispose()
    this.endpointCache.clear()
  }
}
