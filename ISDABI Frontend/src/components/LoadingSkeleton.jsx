export function Skeleton({ height = 18, width = '100%', radius, style }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />;
}

/** Page-level placeholders so no screen is ever blank while data loads. */
export default function LoadingSkeleton({ variant = 'cards', rows = 5 }) {
  if (variant === 'list') {
    return (
      <div style={{ display: 'grid', gap: 10 }} role="status" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={68} radius={14} />)}
      </div>
    );
  }
  if (variant === 'detail') {
    return (
      <div style={{ display: 'grid', gap: 16 }} role="status" aria-label="Loading">
        <Skeleton height={28} width="38%" />
        <Skeleton height={130} radius={14} />
        <div className="detail-grid"><Skeleton height={300} radius={14} /><Skeleton height={300} radius={14} /></div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 16 }} role="status" aria-label="Loading">
      <div className="metric-grid">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} radius={14} />)}</div>
      <Skeleton height={300} radius={14} />
    </div>
  );
}
