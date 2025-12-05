import * as vscode from "vscode"
import { getConfig, onConfigChange } from "./utils/config"
import { DiagnosticsManager } from "./providers/diagnostics"
import { CodeActionProvider } from "./providers/codeAction"
import { CodeLensProvider } from "./providers/codeLens"
import { registerCommands } from "./commands/commands"
import { isFaexAvailable } from "./analyzer/cli"

let diagnosticsManager: DiagnosticsManager

export async function activate(context: vscode.ExtensionContext) {
  console.log("faex-vscode is now active")

  const config = getConfig()

  if (!config.enable) {
    console.log("faex is disabled in settings")
    return
  }

  // Check if faex CLI is available
  const faexAvailable = await isFaexAvailable()
  if (!faexAvailable) {
    vscode.window.showWarningMessage(
      "faex CLI not found. Please install it with 'pip install faex' or configure 'faex.faexPath' in settings."
    )
  }

  // Initialize diagnostics manager
  diagnosticsManager = new DiagnosticsManager()
  context.subscriptions.push(diagnosticsManager)

  // Register code action provider (Quick Fix)
  const codeActionProvider = new CodeActionProvider(diagnosticsManager)
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "python", scheme: "file" },
      codeActionProvider,
      {
        providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
      }
    )
  )

  // Register CodeLens provider
  if (config.showCodeLens) {
    const codeLensProvider = new CodeLensProvider(diagnosticsManager)
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: "python", scheme: "file" },
        codeLensProvider
      )
    )
  }

  // Register commands
  registerCommands(context, diagnosticsManager)

  // Validate on save
  if (config.validateOnSave) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === "python") {
          await diagnosticsManager.analyzeDocument(document)
        }
      })
    )
  }

  // Validate on type (debounced) - disabled for CLI mode as it requires saved files
  // if (config.validateOnType) { ... }

  // Validate open documents on activation
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === "python") {
      await diagnosticsManager.analyzeDocument(document)
    }
  }

  // Handle document open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (document.languageId === "python") {
        await diagnosticsManager.analyzeDocument(document)
      }
    })
  )

  // Handle document close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnosticsManager.clearDiagnostics(document.uri)
    })
  )

  // Listen for config changes
  context.subscriptions.push(
    onConfigChange(async (newConfig) => {
      if (!newConfig.enable) {
        diagnosticsManager.clearAllDiagnostics()
      } else {
        // Re-analyze all open documents
        for (const document of vscode.workspace.textDocuments) {
          if (document.languageId === "python") {
            await diagnosticsManager.analyzeDocument(document)
          }
        }
      }
    })
  )
}

export function deactivate() {
  if (diagnosticsManager) {
    diagnosticsManager.dispose()
  }
}
