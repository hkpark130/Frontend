import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAvailableDevices } from '@/api/devices'
import { fetchCategories } from '@/api/categories'

// 백엔드에서 카테고리를 불러와 동적으로 구성

const normalizeToArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.value)) return payload.value
  return []
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoryCounts, setCategoryCounts] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const [devData, catData] = await Promise.all([
          fetchAvailableDevices({ page: 1, size: 1 }),
          fetchCategories(),
        ])
        setDevices(normalizeToArray(devData))
        setCategories(Array.isArray(catData) ? catData : [])
        const meta = devData?.metadata ?? {}
        if (meta && typeof meta === 'object') {
          setCategoryCounts(meta.categoryCounts ?? {})
        } else {
          setCategoryCounts({})
        }
      } catch (e) {
        console.error(e)
        setError('장비 현황을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const fallbackCounts = useMemo(() => {
    const counts = {}
    for (const device of devices) {
      const name = device?.categoryName
      if (!name) continue
      counts[name] = (counts[name] ?? 0) + 1
    }
    return counts
  }, [devices])

  const dashboardItems = useMemo(() => {
    const baseCounts = (categoryCounts && Object.keys(categoryCounts).length > 0)
      ? categoryCounts
      : fallbackCounts
    return categories.map((c) => ({ label: c.name, image: c.img || '', count: baseCounts[c.name] ?? 0 }))
  }, [categories, categoryCounts, fallbackCounts])

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
