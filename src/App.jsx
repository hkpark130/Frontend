import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DeviceList from './pages/DeviceList'
import Admin from './pages/Admin'
import MyPage from './pages/MyPage'
import DeviceApplication from './pages/DeviceApplication'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import ApprovalList from './pages/ApprovalList'
import ApprovalDetail from './pages/ApprovalDetail'
import RegisterDevice from './pages/RegisterDevice'
import EditDevice from './pages/EditDevice'
import BulkRegisterDevice from './pages/BulkRegisterDevice'
import AddCategory from './pages/AddCategory'
import EditProject from './pages/EditProject'
import EditDepartment from './pages/EditDepartment'
import LdapUserList from './pages/LdapUserList'
import LdapUserAdd from './pages/LdapUserAdd'
import LdapUserReissue from './pages/LdapUserReissue'
import LdapUserDelete from './pages/LdapUserDelete'
import AdminLedgerList from './pages/AdminLedgerList'

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
              <Route path="/device/:deviceId/apply" element={<DeviceApplication />} />
              {/* 관리자 메뉴 */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/approvals" element={<ApprovalList />} />
              <Route path="/admin/approvals/:approvalId" element={<ApprovalDetail />} />
              <Route path="/admin/register" element={<RegisterDevice />} />
              <Route path="/admin/edit" element={<EditDevice />} />
              <Route path="/admin/edit/:deviceId" element={<EditDevice />} />
              <Route path="/admin/bulk" element={<BulkRegisterDevice />} />
              <Route path="/admin/item" element={<AddCategory />} />
              <Route path="/admin/project" element={<EditProject />} />
              <Route path="/admin/dept" element={<EditDepartment />} />
              <Route path="/admin/ledger/list" element={<AdminLedgerList />} />
              <Route path="/admin/ledger/disposal" element={<div className="card">폐기 장비 리스트</div>} />
              <Route path="/admin/map" element={<div className="card">장비 지도</div>} />
              <Route path="/admin/users/list" element={<LdapUserList />} />
              <Route path="/admin/users/add" element={<LdapUserAdd />} />
              <Route path="/admin/users/reissue" element={<LdapUserReissue />} />
              <Route path="/admin/users/delete" element={<LdapUserDelete />} />
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
