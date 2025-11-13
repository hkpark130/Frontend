import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DeviceList from './pages/DeviceList'
import Admin from './pages/Admin'
import MyPage from './pages/MyPage'
import DeviceApplication from './pages/DeviceApplication'
import { DeviceReturnRequest, DeviceDisposalRequest } from './pages/DeviceActionRequest'
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
import AdminDisposalList from './pages/AdminDisposalList'
import MyAssets from './pages/MyAssets'
import MyApprovalRequests from './pages/MyApprovalRequests'
import Forbidden from './pages/Forbidden'
import Unauthorized from './pages/Unauthorized'
import AdminRoute from '@/components/routing/AdminRoute'
import AuthErrorListener from '@/components/routing/AuthErrorListener'
import PostLoginRedirect from '@/components/routing/PostLoginRedirect'
import OpenStackInstanceSearch from './pages/OpenStackInstanceSearch'

export default function App() {
  return (
    <BrowserRouter>
      <AuthErrorListener />
      <PostLoginRedirect />
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Header />
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              {/* 가용장비 리스트 */}
              <Route path="/device/list" element={<DeviceList />} />
              <Route path="/device/apply" element={<DeviceApplication />} />
              <Route path="/device/:deviceId/apply" element={<DeviceApplication />} />
              <Route path="/mypage/my-assets/return" element={<DeviceReturnRequest />} />
              <Route path="/mypage/my-assets/disposal" element={<DeviceDisposalRequest />} />
              <Route path="/mypage/my-assets/:deviceId/return" element={<DeviceReturnRequest />} />
              <Route path="/mypage/my-assets/:deviceId/disposal" element={<DeviceDisposalRequest />} />
              {/* 관리자 메뉴 */}
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="/admin/approvals" element={<AdminRoute><ApprovalList /></AdminRoute>} />
              <Route path="/admin/approvals/:approvalId" element={<AdminRoute><ApprovalDetail /></AdminRoute>} />
              <Route path="/admin/register" element={<AdminRoute><RegisterDevice /></AdminRoute>} />
              <Route path="/admin/edit" element={<AdminRoute><EditDevice /></AdminRoute>} />
              <Route path="/admin/edit/:deviceId" element={<AdminRoute><EditDevice /></AdminRoute>} />
              <Route path="/admin/bulk" element={<AdminRoute><BulkRegisterDevice /></AdminRoute>} />
              <Route path="/admin/item" element={<AdminRoute><AddCategory /></AdminRoute>} />
              <Route path="/admin/project" element={<AdminRoute><EditProject /></AdminRoute>} />
              <Route path="/admin/dept" element={<AdminRoute><EditDepartment /></AdminRoute>} />
              <Route path="/admin/ledger/list" element={<AdminRoute><AdminLedgerList /></AdminRoute>} />
              <Route path="/admin/ledger/disposal" element={<AdminRoute><AdminDisposalList /></AdminRoute>} />
              <Route path="/admin/users/list" element={<AdminRoute><LdapUserList /></AdminRoute>} />
              <Route path="/admin/users/add" element={<AdminRoute><LdapUserAdd /></AdminRoute>} />
              <Route path="/admin/users/reissue" element={<AdminRoute><LdapUserReissue /></AdminRoute>} />
              <Route path="/admin/users/delete" element={<AdminRoute><LdapUserDelete /></AdminRoute>} />
              {/* 마이 페이지 */}
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/mypage/my-assets" element={<MyAssets />} />
              <Route path="/mypage/requests" element={<MyApprovalRequests />} />
              <Route path="/mypage/requests/:approvalId" element={<ApprovalDetail />} />
              {/* OpenStack */}
              <Route path="/openstack/instance-search" element={<OpenStackInstanceSearch />} />
              <Route path="/401" element={<Unauthorized />} />
              <Route path="/403" element={<Forbidden />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
