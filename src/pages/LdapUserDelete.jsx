import { useState } from 'react';
import { checkLdapCnAvailable, deleteLdapUser } from '@/api/ldapUsers';

export default function LdapUserDelete() {
  const [searchCn, setSearchCn] = useState('');
  const [targetCn, setTargetCn] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSearch = async () => {
    if (!searchCn.trim()) {
      alert('삭제할 유저 아이디를 입력해 주세요.');
      return;
    }
    try {
      const available = await checkLdapCnAvailable(searchCn.trim());
      if (available) {
        alert('유저를 찾을 수 없습니다.');
        setIsReady(false);
        setTargetCn('');
      } else {
        setTargetCn(searchCn.trim());
        setIsReady(true);
        alert('유저 정보를 확인했습니다. 삭제가 가능합니다.');
      }
    } catch (error) {
      console.error(error);
      alert('유저 확인 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!isReady || !targetCn) {
      alert('먼저 유저 아이디를 검색해 주세요.');
      return;
    }
    const confirmed = window.confirm(`${targetCn} 계정을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      await deleteLdapUser(targetCn);
      alert('삭제되었습니다.');
      setSearchCn('');
      setTargetCn('');
      setIsReady(false);
    } catch (error) {
      console.error(error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card">
      <h2>유저 삭제</h2>
      <p className="muted">LDAP에서 선택한 계정을 삭제합니다. 삭제 후에는 되돌릴 수 없습니다.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0' }}>
        <input
          type="text"
          placeholder="삭제할 유저 아이디를 입력하세요"
          value={searchCn}
          onChange={(event) => setSearchCn(event.target.value)}
          style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }}
        />
        <button type="button" className="outline" onClick={handleSearch} disabled={processing}>
          유저 확인
        </button>
      </div>

      <div className="detail-section" style={{ border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <h3>선택된 유저</h3>
        <p style={{ margin: 0 }}>{targetCn || '미선택'}</p>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" className="danger" onClick={handleDelete} disabled={!isReady || processing}>
          {processing ? '삭제 중...' : '유저 삭제'}
        </button>
      </div>
    </div>
  );
}
