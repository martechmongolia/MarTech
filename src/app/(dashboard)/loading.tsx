export default function DashboardLoading() {
  return (
    <div className="loading-skeleton-page">
      <div className="skeleton-header" />
      <div className="skeleton-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
      <div className="skeleton-block" />
      <div className="skeleton-block skeleton-block--short" />
    </div>
  );
}
