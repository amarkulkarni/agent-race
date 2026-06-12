import type { ReactElement } from 'react'

interface DiffViewProps {
  diff: string
}

function classifyLine(line: string): 'add' | 'remove' | 'hunk' | 'meta' | 'plain' {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
    return 'meta'
  }
  if (line.startsWith('@@')) {
    return 'hunk'
  }
  if (line.startsWith('+')) {
    return 'add'
  }
  if (line.startsWith('-')) {
    return 'remove'
  }
  return 'plain'
}

export default function DiffView({ diff }: DiffViewProps): ReactElement {
  if (!diff.trim()) {
    return <p className="diff-empty">No diff produced.</p>
  }

  const lines = diff.split('\n')

  return (
    <pre className="diff-view">
      {lines.map((line, i) => (
        <span key={i} className={`diff-line diff-line--${classifyLine(line)}`}>
          {line}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}
