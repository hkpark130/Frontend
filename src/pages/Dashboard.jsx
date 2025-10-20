export default function Dashboard() {
  const items = [
    { label: '노트북', count: 3, image: '/images/notebook.png' },
    { label: '서버', count: 1, image: '/images/server.png' },
    { label: '모니터', count: 0, image: '/images/monitor.png' },
    { label: 'PC본체', count: 2, image: '/images/pc.png' },
    { label: '태블릿PC', count: 0, image: '/images/tablet.png' },
  ]
  return (
    <>
      <h2>장비현황 페이지</h2>
      <div className="card">
        <h3>장비 현황</h3>
        <div className="stats">
          {items.map((it) => (
            <div className="stat" key={it.label}>
              {it.image && (
                <img
                  src={it.image}
                  alt={it.label}
                  className="stat-icon"
                  loading="lazy"
                />
              )}
              <div className="stat-count">{it.count}</div>
              <div className="stat-label">{it.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
