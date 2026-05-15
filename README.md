# pico-notebook

A minimal dark notebook application for **PicoCAS** — a tiny, AI-generated, Mathematica-like computer algebra system. Built with Tauri 2 + React 18 + TypeScript.

## What it does

- **Multiple notebooks** — each tab has its own independent kernel and symbol table
- **Persistent kernel** — one `picocas` subprocess per notebook; variables and functions carry across cells
- **Mathematica-like syntax** — `Expand[(x+1)^3]`, `D[x^2, x]`, `f[x_] := x^2`
- **Immediate or batch execution** — Shift+Enter runs the current cell; Cmd+Shift+Enter runs all
- **Dark theme** — minimal, readable, better than Mathematica

## Prerequisites

- macOS arm64 — bundled picocas binary is macOS arm64
- [Rust + Cargo](https://rustup.rs/)
- Node 18+ + npm

## Running in dev mode

```bash
git clone https://github.com/msollami/pico-notebook.git
cd pico-notebook
npm install
npm run tauri dev
```

First build compiles the Rust backend (~60 s). Subsequent restarts are fast.

## Tests

```bash
npm test                                      # 9 TypeScript/Zustand tests (mocked kernel)
cd src-tauri && cargo test --lib              # 15 Rust integration tests (real picocas binary)
```

## Architecture

```
src-tauri/src/picocas.rs    PicocasKernel — async subprocess, banner drain, result parsing
src-tauri/src/commands.rs   Tauri commands: evaluate, reset_kernel
src/types/notebook.ts       Notebook, Cell, CellStatus types
src/store/notebook.ts       Zustand store — runCell, runAll, resetKernel
src/components/             TabBar, NotebookView, Cell, CellInput (CodeMirror 6), CellOutput
```

### Key technical decisions

| Decision | Rationale |
|---|---|
| Persistent subprocess per notebook | Session state (vars, functions) survives across cells |
| `fflush(stdout)` after every result | C stdio fully buffers on pipes; Rust reader would deadlock without it |
| `TERM=dumb` on subprocess | Prevents readline from hanging on `/dev/tty` in non-TTY contexts |
| mpsc channel serialises evals | picocas is single-threaded and stateful |
| Result terminator = blank line | `Out[N]= result\n\n` — picocas protocol, reliable single-line outputs |

## Keyboard shortcuts

| Key | Action |
|---|---|
| Shift+Enter | Run current cell |
| Cmd+Shift+Enter | Run all cells |
| Cmd+N | New notebook |
| Cmd+W | Close notebook |
| Cmd+J | Append cell |
| Cmd+Shift+0 | Reset kernel |

## About PicoCAS

PicoCAS is a ~50-module symbolic CAS written in C99, modelling Mathematica's evaluation semantics. Built by an AI agent. Source: [msollami/picocas](https://github.com/msollami/picocas).

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
