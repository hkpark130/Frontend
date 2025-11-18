import { NavLink } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { useUser } from '@/context/UserProvider'
import './Sidebar.css'

export default function Sidebar() {
  const { isAdmin } = useUser()
  const [adminOpen, setAdminOpen] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openstackOpen, setOpenstackOpen] = useState(true)
  const [myOpen, setMyOpen] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      setAdminOpen(true)
    } else {
      setAdminOpen(false)
      setLedgerOpen(false)
      setUserMenuOpen(false)
    }
  }, [isAdmin])

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
      <div className="brand">
        <NavLink to="/" end className="brand-link">
          <picture>
            <img src="/images/Logo_direa.png" alt="DIREA" className="brand-logo" />
          </picture>
        </NavLink>
      </div>
      <nav className="nav-section">
        <NavLink to="/" end className={menuClass}>대시보드</NavLink>
        <NavLink to="/device/list" className={menuClass}>가용장비 리스트</NavLink>

        <div className="nav-group">
          <div className="menu-toggle" onClick={() => setOpenstackOpen(!openstackOpen)}>
            <img src="/images/openstack-logo.svg" alt="OpenStack" className="openstack-nav-icon" />
            <span>OpenStack</span>
            <span style={{ marginLeft: 'auto', opacity: .8 }}>{openstackOpen ? '▾' : '▸'}</span>
          </div>
          {openstackOpen && (
            <div className="submenu-group">
              <NavLink
                to="/openstack/instance-search"
                className={({ isActive }) => `${submenuClass({ isActive })} openstack-link`}
              >
                <span>인스턴스 조회</span>
              </NavLink>
            </div>
          )}
        </div>

        {isAdmin && (
          <>
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
                  <div className="menu-toggle" style={{ padding: '6px 8px' }} onClick={() => setUserMenuOpen(!userMenuOpen)}>
                    <span>유저 관리</span>
                    <span style={{ marginLeft: 'auto', opacity: .8 }}>{userMenuOpen ? '▾' : '▸'}</span>
                  </div>
                  {userMenuOpen && (
                    <div className="submenu-group">
                      <NavLink to="/admin/users/list" className={submenuClass}>유저 목록</NavLink>
                      <NavLink to="/admin/users/add" className={submenuClass}>유저 추가</NavLink>
                      <NavLink to="/admin/users/reissue" className={submenuClass}>유저 비밀번호 재발행</NavLink>
                      <NavLink to="/admin/users/delete" className={submenuClass}>유저 삭제</NavLink>
                    </div>
                  )}
                  <NavLink
                    to="/admin/approvals"
                    className={({ isActive }) => `${submenuClass({ isActive })} approval-highlight prominent`}
                  >
                    <AssignmentTurnedInIcon fontSize="small" style={{ marginRight: 4 }} />
                    결재 관리
                  </NavLink>
                </div>
              )}
            </div>
          </>
        )}

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
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
