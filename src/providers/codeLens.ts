import * as vscode from "vscode"
import { DiagnosticsManager } from "./diagnostics"
import { getUndeclaredExceptions, getUnusedDeclarations } from "../types"
import { getConfig } from "../utils/config"

/**
 * Provides CodeLens for FastAPI endpoints showing exception info
 */
export class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event

  constructor(private diagnosticsManager: DiagnosticsManager) {
    // Refresh CodeLens when diagnostics change
    vscode.workspace.onDidChangeTextDocument(() => {
      this._onDidChangeCodeLenses.fire()
    })
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const config = getConfig()

    if (!config.enable || !config.showCodeLens) {
      return []
    }

    const codeLenses: vscode.CodeLens[] = []
    const endpoints = this.diagnosticsManager.getEndpoints(document.uri.fsPath)

    for (const endpoint of endpoints) {
      const undeclared = getUndeclaredExceptions(endpoint)
      const unused = getUnusedDeclarations(endpoint)

      // Create CodeLens above the decorator
      const decoratorLine = endpoint.decoratorLine - 1 // 0-indexed
      const range = new vscode.Range(
        new vscode.Position(decoratorLine, 0),
        new vscode.Position(decoratorLine, 0)
      )

      // Summary CodeLens
      const totalDeclared = endpoint.declaredExceptions.length
      const totalDetected = endpoint.detectedExceptions.length

      let title: string
      let tooltip: string

      if (undeclared.length === 0 && unused.length === 0) {
        // All good
        title = `✓ Exceptions: ${totalDeclared} declared, ${totalDetected} detected`
        tooltip = "All exceptions are properly declared"
      } else {
        // Issues found
        const parts: string[] = []
        if (undeclared.length > 0) {
          parts.push(`${undeclared.length} undeclared`)
        }
        if (unused.length > 0) {
          parts.push(`${unused.length} unused`)
        }
        title = `⚠ Exceptions: ${parts.join(", ")}`
        tooltip = this.buildTooltip(undeclared, unused)
      }

      const codeLens = new vscode.CodeLens(range, {
        title,
        tooltip,
        command: "faex.showEndpointDetails",
        arguments: [endpoint],
      })

      codeLenses.push(codeLens)
    }

    return codeLenses
  }

  /**
   * Build tooltip text for CodeLens
   */
  private buildTooltip(
    undeclared: { exceptionClass: string; inFunction?: string }[],
    unused: string[]
  ): string {
    const lines: string[] = []

    if (undeclared.length > 0) {
      lines.push("Undeclared exceptions:")
      for (const exc of undeclared) {
        if (exc.inFunction) {
          lines.push(`  - ${exc.exceptionClass} (in ${exc.inFunction})`)
        } else {
          lines.push(`  - ${exc.exceptionClass}`)
        }
      }
    }

    if (unused.length > 0) {
      if (lines.length > 0) {
        lines.push("")
      }
      lines.push("Unused declarations:")
      for (const exc of unused) {
        lines.push(`  - ${exc}`)
      }
    }

    return lines.join("\n")
  }

  /**
   * Refresh CodeLens
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire()
  }
}
