import * as vscode from "vscode"
import { DiagnosticsManager } from "./diagnostics"
import { DiagnosticWithMetadata } from "../analyzer/analyzer"
import { EndpointInfo, getUndeclaredExceptions } from "../types"

/**
 * Provides Quick Fix code actions for faex diagnostics
 */
export class CodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  constructor(private diagnosticsManager: DiagnosticsManager) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    // Get faex diagnostics in the range
    const faexDiagnostics = context.diagnostics.filter(
      (d) => d.source === "faex" && d.code === "undeclared-exception"
    )

    if (faexDiagnostics.length === 0) {
      return actions
    }

    // Group diagnostics by endpoint
    const endpointDiagnostics = new Map<string, vscode.Diagnostic[]>()

    for (const diagnostic of faexDiagnostics) {
      const metadata = (diagnostic as DiagnosticWithMetadata).metadata
      if (metadata) {
        const key = `${metadata.endpoint.functionName}:${metadata.endpoint.line}`
        const list = endpointDiagnostics.get(key) || []
        list.push(diagnostic)
        endpointDiagnostics.set(key, list)
      }
    }

    // Create actions for each endpoint
    for (const [_key, diagnostics] of endpointDiagnostics) {
      const firstDiag = diagnostics[0] as DiagnosticWithMetadata
      if (!firstDiag.metadata) {
        continue
      }

      const { endpoint } = firstDiag.metadata
      const undeclared = getUndeclaredExceptions(endpoint)

      if (undeclared.length === 1) {
        // Single exception - add just that one
        const action = this.createAddExceptionAction(
          document,
          endpoint,
          undeclared[0].exceptionClass,
          diagnostics
        )
        actions.push(action)
      } else if (undeclared.length > 1) {
        // Multiple exceptions - offer both individual and "add all" options
        for (const exc of undeclared) {
          const action = this.createAddExceptionAction(
            document,
            endpoint,
            exc.exceptionClass,
            diagnostics.filter(
              (d) =>
                (d as DiagnosticWithMetadata).metadata?.exception.exceptionClass ===
                exc.exceptionClass
            )
          )
          actions.push(action)
        }

        // Add all exceptions at once
        const addAllAction = this.createAddAllExceptionsAction(
          document,
          endpoint,
          undeclared.map((e) => e.exceptionClass),
          diagnostics
        )
        actions.push(addAllAction)
      }
    }

    return actions
  }

  /**
   * Create action to add a single exception
   */
  private createAddExceptionAction(
    document: vscode.TextDocument,
    endpoint: EndpointInfo,
    exceptionClass: string,
    diagnostics: vscode.Diagnostic[]
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Add '${exceptionClass}' to exceptions`,
      vscode.CodeActionKind.QuickFix
    )

    action.edit = this.createAddExceptionEdit(document, endpoint, [exceptionClass])

    action.diagnostics = diagnostics
    action.isPreferred = diagnostics.length === 1

    return action
  }

  /**
   * Create action to add all missing exceptions
   */
  private createAddAllExceptionsAction(
    document: vscode.TextDocument,
    endpoint: EndpointInfo,
    exceptionClasses: string[],
    diagnostics: vscode.Diagnostic[]
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Add all missing exceptions (${exceptionClasses.join(", ")})`,
      vscode.CodeActionKind.QuickFix
    )

    action.edit = this.createAddExceptionEdit(document, endpoint, exceptionClasses)

    action.diagnostics = diagnostics
    action.isPreferred = true

    return action
  }

  /**
   * Create workspace edit to add exceptions to decorator
   */
  private createAddExceptionEdit(
    document: vscode.TextDocument,
    endpoint: EndpointInfo,
    newExceptions: string[]
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit()

    // Find the decorator line
    const decoratorLine = endpoint.decoratorLine - 1 // 0-indexed

    // Build the new exceptions list
    const allExceptions = [
      ...endpoint.declaredExceptions,
      ...newExceptions.filter((e) => !endpoint.declaredExceptions.includes(e)),
    ]

    if (endpoint.exceptionsLine !== undefined) {
      // Update existing exceptions parameter
      const excLine = endpoint.exceptionsLine - 1
      const lineText = document.lineAt(excLine).text

      // Find the exceptions=[...] part
      const match = lineText.match(/exceptions\s*=\s*\[([^\]]*)\]/)
      if (match) {
        const startCol = lineText.indexOf("exceptions")
        const endCol = startCol + match[0].length

        const newText = `exceptions=[${allExceptions.join(", ")}]`

        edit.replace(
          document.uri,
          new vscode.Range(
            new vscode.Position(excLine, startCol),
            new vscode.Position(excLine, endCol)
          ),
          newText
        )
      }
    } else {
      // Need to add exceptions parameter
      // Find where to insert (before the closing parenthesis of the decorator)
      const decoratorEndLine = this.findDecoratorEndLine(document, decoratorLine)
      const endLineText = document.lineAt(decoratorEndLine).text
      const closingParenIndex = endLineText.lastIndexOf(")")

      if (closingParenIndex >= 0) {
        // Check if we need a comma
        const beforeParen = endLineText.substring(0, closingParenIndex).trim()
        const needsComma = beforeParen.length > 0 && !beforeParen.endsWith(",")

        const insertText = `${needsComma ? "," : ""}\n    exceptions=[${allExceptions.join(", ")}]`

        edit.insert(
          document.uri,
          new vscode.Position(decoratorEndLine, closingParenIndex),
          insertText
        )
      }
    }

    return edit
  }

  /**
   * Find the line where the decorator ends
   */
  private findDecoratorEndLine(document: vscode.TextDocument, startLine: number): number {
    let parenCount = 0
    let inString = false
    let stringChar = ""

    for (let line = startLine; line < document.lineCount; line++) {
      const text = document.lineAt(line).text

      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const prevChar = i > 0 ? text[i - 1] : ""

        // Handle strings
        if ((char === '"' || char === "'") && prevChar !== "\\") {
          if (!inString) {
            inString = true
            stringChar = char
          } else if (char === stringChar) {
            inString = false
          }
          continue
        }

        if (inString) {
          continue
        }

        if (char === "(") {
          parenCount++
        } else if (char === ")") {
          parenCount--
          if (parenCount === 0) {
            return line
          }
        }
      }
    }

    return startLine
  }
}
