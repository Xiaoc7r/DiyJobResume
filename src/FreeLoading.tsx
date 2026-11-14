export function FreeLoading({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      className={`free-loading-state ${overlay ? "is-overlay" : ""}`}
      role="status"
      aria-label="加载自由模式"
    >
      <div>
        <span className="loading-wordmark">DiyJobResume</span>
        <span className="loading-caption">自由模式</span>
        <i className="loading-line" aria-hidden="true" />
      </div>
    </div>
  );
}
