import * as vscode from "vscode"
import { spawn } from "child_process"
import { getConfig } from "../utils/config"

/**
 * faex CLI JSON output format
 */
export interface FaexJsonOutput {
  summary: {
    total_endpoints: number
    endpoints_with_issues: number
    total_undeclared: number
  }
  endpoints: FaexEndpoint[]
  errors: string[]
}

export interface FaexEndpoint {
  file: string
  line: number
  function: string
  method: string
  path: string
  declared_exceptions: string[]
  undeclared_exceptions: FaexException[]
}

export interface FaexException {
  class: string
  file: string
  line: number
  in_function: string | null
}

/**
 * Run faex CLI and return parsed JSON output
 */
export async function runFaexCli(filePath: string): Promise<FaexJsonOutput | null> {
  const config = getConfig()
  const faexPath = config.faexPath || "faex"

  return new Promise((resolve) => {
    const args = ["check", filePath, "--format", "json", "--depth", String(config.depth)]

    // Add ignore flags
    for (const ignore of config.ignore) {
      args.push("--ignore", ignore)
    }

    const process = spawn(faexPath, args, {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    })

    let stdout = ""
    let stderr = ""

    process.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    process.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    process.on("close", () => {
      // faex returns exit code 1 when issues are found, which is normal
      if (stdout) {
        try {
          const result = JSON.parse(stdout) as FaexJsonOutput
          resolve(result)
        } catch {
          console.error("Failed to parse faex output:", stdout)
          resolve(null)
        }
      } else {
        if (stderr) {
          console.error("faex error:", stderr)
        }
        resolve(null)
      }
    })

    process.on("error", (err) => {
      console.error("Failed to run faex:", err.message)
      vscode.window.showErrorMessage(
        `Failed to run faex: ${err.message}. Make sure faex is installed (pip install faex)`
      )
      resolve(null)
    })
  })
}

/**
 * Run faex CLI on workspace
 */
export async function runFaexCliOnWorkspace(): Promise<FaexJsonOutput | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  if (!workspaceFolder) {
    return null
  }

  return runFaexCli(workspaceFolder.uri.fsPath)
}

/**
 * Check if faex CLI is available
 */
export async function isFaexAvailable(): Promise<boolean> {
  const config = getConfig()
  const faexPath = config.faexPath || "faex"

  return new Promise((resolve) => {
    const process = spawn(faexPath, ["--version"])

    process.on("close", (code) => {
      resolve(code === 0)
    })

    process.on("error", () => {
      resolve(false)
    })
  })
}
