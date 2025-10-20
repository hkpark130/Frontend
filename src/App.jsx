import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DeviceList from './pages/DeviceList'
import Admin from './pages/Admin'
import MyPage from './pages/MyPage'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'



export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Header />
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              {/* 가용장비 리스트 */}
              <Route path="/device/list" element={<DeviceList />} />
              {/* 관리자 메뉴 */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/register" element={<div className="card">장비 등록</div>} />
              <Route path="/admin/edit" element={<div className="card">장비 편집</div>} />
              <Route path="/admin/bulk" element={<div className="card">장비 일괄 등록</div>} />
              <Route path="/admin/item" element={<div className="card">품목 등록</div>} />
              <Route path="/admin/project" element={<div className="card">프로젝트 편집</div>} />
              <Route path="/admin/dept" element={<div className="card">부서 편집</div>} />
              <Route path="/admin/ledger/list" element={<div className="card">장비 리스트</div>} />
              <Route path="/admin/ledger/disposal" element={<div className="card">폐기 장비 리스트</div>} />
              <Route path="/admin/map" element={<div className="card">장비 지도</div>} />
              <Route path="/admin/users" element={<div className="card">유저 관리</div>} />
              {/* 마이 페이지 */}
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/mypage/my-assets" element={<div className="card">나의 장비</div>} />
              <Route path="/mypage/requests" element={<div className="card">신청 내역</div>} />
              <Route path="/mypage/notifications" element={<div className="card">알림 이력</div>} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
