import { useNavigate } from 'react-router-dom'

const DASHBOARD_ITEMS = [
  { label: '노트북', count: 3, image: '/images/notebook.png' },
  { label: '서버', count: 1, image: '/images/server.png' },
  { label: '모니터', count: 0, image: '/images/monitor.png' },
  { label: 'PC본체', count: 2, image: '/images/pc.png' },
  { label: '태블릿PC', count: 0, image: '/images/tablet.png' },
]

export default function Dashboard() {
  const navigate = useNavigate()

  const handleNavigate = (category) => {
    const params = new URLSearchParams({ category })
    navigate(`/device/list?${params.toString()}`)
  }

  return (
    <>
      <h2>장비현황 페이지</h2>
      <div className="card">
        <h3>장비 현황</h3>
        <div className="stats">
          {DASHBOARD_ITEMS.map((item) => (
            <div
              key={item.label}
              className="stat"
              role="button"
              tabIndex={0}
              onClick={() => handleNavigate(item.label)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleNavigate(item.label)
                }
              }}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.label}
                  className="stat-icon"
                  loading="lazy"
                />
              )}
              <div className="stat-count">{item.count}</div>
              <div className="stat-label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
