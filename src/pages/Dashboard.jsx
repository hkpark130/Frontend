import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAvailableDeviceCounts } from '@/api/devices'
import { fetchCategories } from '@/api/categories'

export default function Dashboard() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoryCounts, setCategoryCounts] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const [countData, catData] = await Promise.all([
          fetchAvailableDeviceCounts(),
          fetchCategories(),
        ])
        setCategories(Array.isArray(catData) ? catData : [])
        setCategoryCounts(countData && typeof countData === 'object' ? countData : {})
      } catch (e) {
        console.error(e)
        setError('장비 현황을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const dashboardItems = useMemo(() => {
    return categories.map((c) => ({ label: c.name, image: c.img || '', count: categoryCounts?.[c.name] ?? 0 }))
  }, [categories, categoryCounts])

  const handleNavigate = (category) => {
    const params = new URLSearchParams({ category })
    navigate(`/device/list?${params.toString()}`)
  }

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  return (
    <>
      <h2>장비현황 페이지</h2>
      <div className="card">
        <h3>장비 현황</h3>
        {isLoading && <p>불러오는 중입니다...</p>}
        {error && <p className="error">{error}</p>}
        {!isLoading && !error && (
          <div className="stats">
            {dashboardItems.map((item) => (
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
                <img
                  src={item.image
                    ? (item.image.startsWith('/')
                        ? API_BASE_URL + item.image
                        : API_BASE_URL + `/uploads/categories/${item.image}`)
                    : '/images/etc.png'}
                  alt={item.label}
                  className="stat-icon"
                  loading="lazy"
                />
                <div className="stat-count">{item.count}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
