export default function FacebookAILoading() {
  return (
    <div className="page-content">
      {/* Header skeleton */}
      <div className="page-header-row">
        <div>
          <div
            style={{
              height: "2rem",
              width: "18rem",
              background: "#E5E7EB",
              borderRadius: "0.5rem",
              marginBottom: "0.5rem",
            }}
          />
          <div
            style={{
              height: "1rem",
              width: "10rem",
              background: "#F3F4F6",
              borderRadius: "0.5rem",
            }}
          />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              background: "#F9FAFB",
              borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
              padding: "1.25rem",
              height: "5rem",
              animation: "fb-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* List skeleton */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid #E5E7EB",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              animation: "fb-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          >
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "50%",
                background: "#E5E7EB",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div
                style={{
                  height: "0.875rem",
                  width: "30%",
                  background: "#E5E7EB",
                  borderRadius: "0.25rem",
                }}
              />
              <div
                style={{
                  height: "0.75rem",
                  width: "70%",
                  background: "#F3F4F6",
                  borderRadius: "0.25rem",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
