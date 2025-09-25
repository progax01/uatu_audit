// Simple metrics for observability
export class Metrics {
  private static counters = new Map<string, number>();
  private static histograms = new Map<string, number[]>();
  
  static inc(name: string, labels: Record<string, string> = {}) {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }
  
  static observe(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.makeKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    // Keep only last 1000 values to prevent memory bloat
    if (values.length > 1000) values.shift();
    this.histograms.set(key, values);
  }
  
  static toPrometheus(): string {
    const lines: string[] = [];
    
    // Counters
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }
    
    // Histograms (simplified as gauges showing recent average)
    for (const [key, values] of this.histograms) {
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      lines.push(`${key}_avg ${avg.toFixed(3)}`);
      lines.push(`${key}_count ${values.length}`);
    }
    
    return lines.join('\n') + '\n';
  }
  
  static getStats() {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k, 
          {
            count: v.length,
            avg: v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0,
            min: v.length > 0 ? Math.min(...v) : 0,
            max: v.length > 0 ? Math.max(...v) : 0
          }
        ])
      )
    };
  }
  
  private static makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

export function recordJobStart(status: string) {
  Metrics.inc('uatu_jobs_total', { status });
}

export function recordJobDuration(durationMs: number) {
  Metrics.observe('uatu_jobs_duration_seconds', durationMs / 1000);
}

export function recordGitReclone() {
  Metrics.inc('uatu_git_reclone_total');
}

export function recordExecuteTimeout() {
  Metrics.inc('uatu_execute_timeouts_total');
}
