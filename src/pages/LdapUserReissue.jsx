import { useState } from 'react';
import { checkLdapCnAvailable, reissueLdapPassword } from '@/api/ldapUsers';

export default function LdapUserReissue() {
  const [searchCn, setSearchCn] = useState('');
  const [targetCn, setTargetCn] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSearch = async () => {
    if (!searchCn.trim()) {
      alert('재발행할 유저 아이디를 입력해 주세요.');
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
        alert('유저 정보를 확인했습니다. 비밀번호를 재발행할 수 있습니다.');
      }
    } catch (error) {
      console.error(error);
      alert('유저 확인 중 오류가 발생했습니다.');
    }
  };

  const handleReissue = async () => {
    if (!isReady || !targetCn) {
      alert('먼저 유저 아이디를 검색해 주세요.');
      return;
    }
    setProcessing(true);
    try {
      const password = await reissueLdapPassword(targetCn);
      alert(`재발행되었습니다.\n임시 비밀번호: ${password}`);
    } catch (error) {
      console.error(error);
      alert('비밀번호 재발행 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card">
      <h2>유저 비밀번호 재발행</h2>
      <p className="muted">LDAP에 등록된 계정의 비밀번호를 재발행합니다. 재발행 후 임시 비밀번호는 별도로 전달해 주세요.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0' }}>
        <input
          type="text"
          placeholder="재발행할 유저 아이디를 입력하세요"
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
        <button type="button" className="primary" onClick={handleReissue} disabled={!isReady || processing}>
          {processing ? '재발행 중...' : '비밀번호 재발행'}
        </button>
      </div>
    </div>
  );
}
