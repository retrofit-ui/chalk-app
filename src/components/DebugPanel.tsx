import { For, type Component } from 'solid-js';
import type { Usage } from '../anthropic';
import { formatCost, formatPercent, formatTokens } from '../format';

const tokenClass = {
  key: 'text-blue-300',
  punct: 'text-slate-400',
  string: 'text-orange-300',
  number: 'text-green-300',
  boolean: 'text-purple-300',
  null: 'text-purple-300',
};
const jsonClass =
  'm-0 p-3 bg-slate-900 font-mono text-xs leading-relaxed box-border whitespace-pre-wrap break-words min-h-full';
const lineClass = 'whitespace-pre-wrap break-words';
const virtualClass = 'text-slate-500 italic select-none';

type Props = {
  debug: Record<string, unknown>;
  convUsage?: Usage;
  messageCount: number;
};

type Part = { text: string; cls: string };
type Line = { indent: number; parts: Part[]; virtual?: string };

// Dotted path -> which running total on Conversation.usage it corresponds to.
const METRIC_PATHS: Record<string, { key: keyof Usage; isMoney?: boolean }> = {
  estimatedCostUsd: { key: 'costUsd', isMoney: true },
  'usage.input_tokens': { key: 'inputTokens' },
  'usage.output_tokens': { key: 'outputTokens' },
  'usage.cache_creation_input_tokens': { key: 'cacheCreationTokens' },
  'usage.cache_read_input_tokens': { key: 'cacheReadTokens' },
};

function virtualTextFor(
  path: string,
  value: unknown,
  convUsage: Usage | undefined,
  messageCount: number,
): string | undefined {
  const metric = METRIC_PATHS[path];
  if (!metric || typeof value !== 'number' || !convUsage) return undefined;

  const total = convUsage[metric.key];
  const count = Math.max(messageCount, 1);
  const avg = total / count;
  const pct = total > 0 ? value / total : 0;

  const fmt = metric.isMoney ? formatCost : formatTokens;
  return `avg ${fmt(avg)}/msg · ${formatPercent(pct)} of total`;
}

function buildLines(
  value: unknown,
  keyName: string | undefined,
  trailingComma: boolean,
  indent: number,
  path: string,
  convUsage: Usage | undefined,
  messageCount: number,
  out: Line[],
): void {
  const keyPart: Part[] = keyName !== undefined
    ? [{ text: `"${keyName}": `, cls: tokenClass.key }]
    : [];

  if (value !== null && value !== undefined && typeof value === 'object') {
    const isArray = Array.isArray(value);
    const entries = isArray
      ? (value as unknown[]).map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      out.push({
        indent,
        parts: [...keyPart, { text: isArray ? '[]' : '{}', cls: tokenClass.punct }, { text: trailingComma ? ',' : '', cls: tokenClass.punct }],
      });
      return;
    }

    out.push({ indent, parts: [...keyPart, { text: isArray ? '[' : '{', cls: tokenClass.punct }] });
    entries.forEach(([k, v], i) => {
      const childPath = path ? `${path}.${k}` : k;
      buildLines(
        v,
        isArray ? undefined : k,
        i < entries.length - 1,
        indent + 1,
        childPath,
        convUsage,
        messageCount,
        out,
      );
    });
    out.push({ indent, parts: [{ text: isArray ? ']' : '}', cls: tokenClass.punct }, { text: trailingComma ? ',' : '', cls: tokenClass.punct }] });
    return;
  }

  let text: string;
  let cls: string;
  if (typeof value === 'string') {
    text = JSON.stringify(value);
    cls = tokenClass.string;
  } else if (typeof value === 'number') {
    text = String(value);
    cls = tokenClass.number;
  } else if (typeof value === 'boolean') {
    text = String(value);
    cls = tokenClass.boolean;
  } else {
    text = 'null';
    cls = tokenClass.null;
  }

  out.push({
    indent,
    parts: [...keyPart, { text, cls }, { text: trailingComma ? ',' : '', cls: tokenClass.punct }],
    virtual: virtualTextFor(path, value, convUsage, messageCount),
  });
}

const DebugPanel: Component<Props> = (props) => {
  const lines = () => {
    const out: Line[] = [];
    buildLines(props.debug, undefined, false, 0, '', props.convUsage, props.messageCount, out);
    return out;
  };

  return (
    <pre class={jsonClass}>
      <For each={lines()}>
        {(line) => (
          <div class={lineClass} style={{ 'padding-left': `${line.indent * 1.25}em` }}>
            <For each={line.parts}>{(part) => <span class={part.cls}>{part.text}</span>}</For>
            {line.virtual && <span class={virtualClass}> {line.virtual}</span>}
          </div>
        )}
      </For>
    </pre>
  );
};

export default DebugPanel;
