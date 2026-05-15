import { invoke } from "@tauri-apps/api/core";

export interface EvalResult {
  line_number: number;
  output: string;
  is_null: boolean;
  is_error: boolean;
  elapsed_ms: number;
}

export const evaluate = (
  notebookId: string,
  expr: string
): Promise<EvalResult> =>
  invoke<EvalResult>("evaluate", { notebookId, expr });

export const resetKernel = (notebookId: string): Promise<void> =>
  invoke<void>("reset_kernel", { notebookId });
