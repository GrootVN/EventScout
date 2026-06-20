type EventSourceBadgeProps = {
  sourceName: string;
};

export function EventSourceBadge({ sourceName }: EventSourceBadgeProps) {
  return <span className="source-badge">Source: {sourceName}</span>;
}
