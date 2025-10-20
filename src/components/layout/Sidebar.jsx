import { NavLink } from 'react-router-dom'
import { useMemo, useState } from 'react'

export default function Sidebar() {
  const [adminOpen, setAdminOpen] = useState(true)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [myOpen, setMyOpen] = useState(true)

  const menuClass = useMemo(
    () => ({ isActive }) => `menu${isActive ? ' active' : ''}`,
    [],
  )
  const submenuClass = useMemo(
    () => ({ isActive }) => `submenu${isActive ? ' active' : ''}`,
    [],
  )

  return (
    <aside className="sidebar">
      <div className="brand">DIREA</div>
      <nav className="nav-section">
  <NavLink to="/" end className={menuClass}>대시보드</NavLink>
        <NavLink to="/device/list" className={menuClass}>가용장비 리스트</NavLink>

        <div className="menu-divider" />

  <div className="nav-group">
          <div className="menu-toggle" onClick={() => setAdminOpen(!adminOpen)}>
            <span>관리자 메뉴</span>
            <span style={{ marginLeft: 'auto', opacity: .8 }}>{adminOpen ? '▾' : '▸'}</span>
          </div>
          {adminOpen && (
            <div className="submenu-group">
              <NavLink to="/admin/register" className={submenuClass}>장비 등록</NavLink>
              <NavLink to="/admin/edit" className={submenuClass}>장비 편집</NavLink>
              <NavLink to="/admin/bulk" className={submenuClass}>장비 일괄 등록</NavLink>
              <NavLink to="/admin/item" className={submenuClass}>품목 등록</NavLink>
              <NavLink to="/admin/project" className={submenuClass}>프로젝트 편집</NavLink>
              <NavLink to="/admin/dept" className={submenuClass}>부서 편집</NavLink>
              <div className="menu-toggle" style={{ padding: '6px 8px' }} onClick={() => setLedgerOpen(!ledgerOpen)}>
                <span>장비 관리 대장</span>
                <span style={{ marginLeft: 'auto', opacity: .8 }}>{ledgerOpen ? '▾' : '▸'}</span>
              </div>
              {ledgerOpen && (
                <div className="submenu-group">
                  <NavLink to="/admin/ledger/list" className={submenuClass}>장비 리스트</NavLink>
                  <NavLink to="/admin/ledger/disposal" className={submenuClass}>폐기 장비 리스트</NavLink>
                </div>
              )}
              <NavLink to="/admin/map" className={submenuClass}>장비 지도</NavLink>
              <NavLink to="/admin/users" className={submenuClass}>유저 관리</NavLink>
            </div>
          )}
        </div>

        <div className="menu-divider" />

  <div className="nav-group">
          <div className="menu-toggle" onClick={() => setMyOpen(!myOpen)}>
            <span>마이 페이지</span>
            <span style={{ marginLeft: 'auto', opacity: .8 }}>{myOpen ? '▾' : '▸'}</span>
          </div>
          {myOpen && (
            <div className="submenu-group">
              <NavLink to="/mypage/my-assets" className={submenuClass}>나의 장비</NavLink>
              <NavLink to="/mypage/requests" className={submenuClass}>신청 내역</NavLink>
              <NavLink to="/mypage/notifications" className={submenuClass}>알림 이력</NavLink>
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
