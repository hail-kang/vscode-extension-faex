import * as vscode from "vscode"
import { DiagnosticsManager } from "../providers/diagnostics"
import { getAnalyzer } from "../analyzer/analyzer"
import { getUndeclaredExceptions, EndpointInfo } from "../types"

/**
 * Register all faex commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  diagnosticsManager: DiagnosticsManager
): void {
  // Check current file
  context.subscriptions.push(
    vscode.commands.registerCommand("faex.checkCurrentFile", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage("No active editor")
        return
      }

      if (editor.document.languageId !== "python") {
        vscode.window.showWarningMessage("Current file is not a Python file")
        return
      }

      diagnosticsManager.analyzeDocument(editor.document)

      const diagnostics = diagnosticsManager.getDiagnostics(editor.document.uri)
      if (diagnostics.length === 0) {
        vscode.window.showInformationMessage("faex: No undeclared exceptions found")
      } else {
        vscode.window.showWarningMessage(
          `faex: Found ${diagnostics.length} undeclared exception(s)`
        )
      }
    })
  )

  // Check workspace
  context.subscriptions.push(
    vscode.commands.registerCommand("faex.checkWorkspace", async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "faex: Checking workspace...",
          cancellable: false,
        },
        async () => {
          const analyzer = getAnalyzer()
          const result = await analyzer.analyzeWorkspace()

          const issueCount = result.endpoints.reduce(
            (sum, ep) => sum + getUndeclaredExceptions(ep).length,
            0
          )

          if (issueCount === 0) {
            vscode.window.showInformationMessage(
              `faex: Checked ${result.endpoints.length} endpoints, no issues found`
            )
          } else {
            vscode.window.showWarningMessage(
              `faex: Found ${issueCount} undeclared exception(s) in ${result.endpoints.length} endpoints`
            )
          }

          // Refresh diagnostics for all open files
          await diagnosticsManager.refreshAll()
        }
      )
    })
  )

  // Show all exceptions
  context.subscriptions.push(
    vscode.commands.registerCommand("faex.showAllExceptions", async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document.languageId !== "python") {
        vscode.window.showWarningMessage("Open a Python file first")
        return
      }

      const endpoints = diagnosticsManager.getEndpoints(editor.document.uri.fsPath)

      if (endpoints.length === 0) {
        vscode.window.showInformationMessage("No FastAPI endpoints found")
        return
      }

      // Create quick pick items
      const items: vscode.QuickPickItem[] = endpoints.map((ep) => {
        const undeclared = getUndeclaredExceptions(ep)
        const status = undeclared.length === 0 ? "✓" : "⚠"
        const detail =
          undeclared.length > 0
            ? `Missing: ${undeclared.map((e) => e.exceptionClass).join(", ")}`
            : `Declared: ${ep.declaredExceptions.join(", ") || "none"}`

        return {
          label: `${status} ${ep.method} ${ep.path}`,
          description: ep.functionName,
          detail,
        }
      })

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an endpoint to view details",
        matchOnDetail: true,
      })

      if (selected) {
        // Find the endpoint and go to its line
        const endpoint = endpoints.find(
          (ep) => `${ep.method} ${ep.path}` === selected.label.substring(2)
        )

        if (endpoint) {
          const position = new vscode.Position(endpoint.decoratorLine - 1, 0)
          editor.selection = new vscode.Selection(position, position)
          editor.revealRange(new vscode.Range(position, position))
        }
      }
    })
  )

  // Show endpoint details (used by CodeLens)
  context.subscriptions.push(
    vscode.commands.registerCommand("faex.showEndpointDetails", (endpoint: EndpointInfo) => {
      const undeclared = getUndeclaredExceptions(endpoint)

      if (undeclared.length === 0) {
        vscode.window.showInformationMessage(
          `${endpoint.method} ${endpoint.path}: All exceptions declared`
        )
      } else {
        const message = undeclared
          .map((e) =>
            e.inFunction ? `${e.exceptionClass} (in ${e.inFunction})` : e.exceptionClass
          )
          .join(", ")

        vscode.window.showWarningMessage(
          `${endpoint.method} ${endpoint.path}: Missing exceptions: ${message}`
        )
      }
    })
  )
}
