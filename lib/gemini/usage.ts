export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
}

export function createTokenUsageTotals(): TokenUsageTotals {
  return { inputTokens: 0, outputTokens: 0 };
}

export function accumulateInteractionUsage(
  totals: TokenUsageTotals,
  usage?: { total_input_tokens?: number; total_output_tokens?: number } | null
): void {
  if (!usage) return;
  totals.inputTokens += usage.total_input_tokens ?? 0;
  totals.outputTokens += usage.total_output_tokens ?? 0;
}
