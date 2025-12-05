# faex-vscode

**FastAPI Exception Validator for VS Code** - A VS Code extension that validates exception declarations in FastAPI endpoints in real-time.

## Overview

`faex-vscode` is a VS Code extension that integrates with the [faex](https://github.com/hail-kang/faex) CLI tool. It detects missing exception declarations while writing FastAPI code and allows you to identify and fix issues directly in the editor.

## Prerequisites

**faex CLI must be installed:**
```bash
pip install faex
```

## Features

### Core Features
- **Real-time Diagnostics**: Automatic exception declaration validation on file save
- **Inline Warnings**: Display warnings directly on problematic lines
- **Quick Fix**: Code actions to automatically add missing exception declarations
- **CodeLens**: Exception summary displayed above each endpoint

### Analysis Capabilities
- **Direct Exception Detection**: Detects `raise` statements within endpoint functions
- **Transitive Exception Tracking**: Tracks exceptions raised in called functions
- **Configurable Analysis Depth**: Set the depth of function call tracking

### Editor Integration
- **Problems Panel**: View all exception declaration issues across the project
- **Status Bar**: Display validation status for the current file

## Installation

### From VSIX File
```bash
code --install-extension faex-vscode-0.1.0.vsix
```

### From Source
```bash
git clone https://github.com/hail-kang/vscode-extension-faex.git
cd vscode-extension-faex
npm install
npm run package
npx @vscode/vsce package
code --install-extension faex-vscode-0.1.0.vsix
```

## Usage

### Automatic Validation
Validation starts automatically when you open a FastAPI router file and save it.

### Manual Validation
- **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`):
  - `faex: Check Current File` - Validate the current file
  - `faex: Check Workspace` - Validate the entire workspace
  - `faex: Show All Exceptions` - Display exception list for all endpoints

### Quick Fix
On lines with missing exception declarations:
1. Click the lightbulb icon or press `Cmd+.` / `Ctrl+.`
2. Select "Add missing exception declaration"

## Configuration

Configure in `settings.json`:

```json
{
  "faex.enable": true,
  "faex.faexPath": "faex",
  "faex.depth": 3,
  "faex.ignore": ["HTTPException", "ValidationError"],
  "faex.exclude": ["**/tests/**", "**/test_*.py"],
  "faex.validateOnSave": true,
  "faex.showCodeLens": true
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `faex.enable` | boolean | `true` | Enable/disable the extension |
| `faex.faexPath` | string | `"faex"` | Path to faex CLI executable |
| `faex.depth` | number | `3` | Maximum depth for function call tracking |
| `faex.ignore` | string[] | `[]` | Exception classes to ignore |
| `faex.exclude` | string[] | `[]` | File patterns to exclude from analysis |
| `faex.validateOnSave` | boolean | `true` | Auto-validate on save |
| `faex.showCodeLens` | boolean | `true` | Show CodeLens above endpoints |

## Example

**Before (warning displayed):**
```python
@router.get(
    "/users/{user_id}",
    exceptions=[UnauthorizedException],  # ⚠️ Missing: NotFoundException
)
async def get_user(user_id: int):
    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundException()  # This exception is not declared
    return user
```

**After (Quick Fix applied):**
```python
@router.get(
    "/users/{user_id}",
    exceptions=[UnauthorizedException, NotFoundException],  # ✓ Fixed
)
async def get_user(user_id: int):
    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundException()
    return user
```

## Architecture

```
faex-vscode/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── types.ts              # Type definitions
│   ├── analyzer/
│   │   ├── cli.ts            # faex CLI runner
│   │   ├── analyzer.ts       # Analysis coordinator
│   │   └── index.ts          # Module exports
│   ├── providers/
│   │   ├── diagnostics.ts    # Diagnostics provider
│   │   ├── codeAction.ts     # Quick Fix provider
│   │   └── codeLens.ts       # CodeLens provider
│   ├── commands/
│   │   └── commands.ts       # Command registration
│   └── utils/
│       └── config.ts         # Configuration management
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── esbuild.mjs               # Build configuration
```

### Key Components

1. **CLI Runner**: Spawns faex CLI process and parses JSON output
2. **Analyzer**: Coordinates CLI calls and caches results
3. **DiagnosticsProvider**: Displays warnings via VS Code Diagnostics API
4. **CodeActionProvider**: Provides Quick Fix functionality
5. **CodeLensProvider**: Shows exception summary above endpoints

## Development

### Prerequisites
- Node.js 18+
- VS Code 1.85+
- faex CLI (`pip install faex`)

### Setup
```bash
git clone https://github.com/hail-kang/vscode-extension-faex.git
cd vscode-extension-faex
npm install
```

### Development Mode
Press `F5` in VS Code to launch the Extension Development Host.

### Build
```bash
# Development build
npm run compile

# Production build
npm run package

# Create VSIX
npx @vscode/vsce package
```

### Lint & Format
```bash
# Lint
npm run lint

# Format
npm run format
```

## How It Works

This extension uses the faex CLI under the hood:

1. On file save, the extension runs `faex check <file> --format json`
2. Parses the JSON output containing endpoint and exception information
3. Creates VS Code diagnostics for undeclared exceptions
4. Provides Quick Fix actions to add missing declarations

## Comparison with CLI

| Feature | faex (CLI) | faex-vscode |
|---------|------------|-------------|
| Analysis Engine | Python AST | faex CLI (wrapper) |
| Execution | Manual/CI | Real-time on save |
| Output Format | Text/JSON/GitHub | VS Code UI |
| Auto Fix | Not supported | Quick Fix |
| Integration | Terminal | Editor native |

## Roadmap

- [x] Project structure setup
- [x] faex CLI integration
- [x] DiagnosticsProvider implementation
- [x] CodeActionProvider (Quick Fix) implementation
- [x] CodeLens implementation
- [x] Configuration options
- [ ] HoverProvider for detailed exception info
- [ ] Workspace-wide analysis caching
- [ ] Test coverage
- [ ] VS Code Marketplace deployment

## Related Projects

- [faex](https://github.com/hail-kang/faex) - Python CLI version

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Issues and PRs are welcome!
