import { useEffect, useMemo, useState } from 'react';
import { addLdapUser, checkLdapCnAvailable, checkLdapUidNumberAvailable } from '@/api/ldapUsers';
import { fetchDepartments } from '@/api/departments';

const initialForm = {
  cn: '',
  uid: '',
  uidNumber: '',
  ou: '경영지원부',
  mail: '',
  userPassword: '',
  gidNumber: 500,
  status: '정상',
  description: '',
  sn: '',
};

export default function LdapUserAdd() {
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const [cnChecked, setCnChecked] = useState(false);
  const [uidNumberChecked, setUidNumberChecked] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingDeps(true);
      try {
        const deps = await fetchDepartments();
        if (mounted) setDepartments(Array.isArray(deps) ? deps : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingDeps(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const departmentOptions = useMemo(() => {
    if (!departments.length) return [{ id: '경영지원부', name: '경영지원부' }];
    return departments;
  }, [departments]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'cn'
        ? {
            mail: value ? `${value}@direa.co.kr` : '',
            sn: value || '',
          }
        : {}),
    }));
    if (field === 'cn') {
      setCnChecked(false);
    }
    if (field === 'uidNumber') {
      setUidNumberChecked(false);
    }
  };

  const handleCnCheck = async () => {
    if (!form.cn.trim()) {
      alert('유저 아이디를 입력해 주세요.');
      return;
    }
    try {
      const available = await checkLdapCnAvailable(form.cn.trim());
      if (available) {
        alert('사용 가능한 유저 아이디입니다.');
        setCnChecked(true);
      } else {
        alert('이미 사용 중인 유저 아이디입니다.');
        setCnChecked(false);
      }
    } catch (error) {
      console.error(error);
      alert('아이디 중복 확인 중 오류가 발생했습니다.');
    }
  };

  const handleUidNumberCheck = async () => {
    if (!form.uidNumber) {
      alert('사원번호를 입력해 주세요.');
      return;
    }
    try {
      const available = await checkLdapUidNumberAvailable(form.uidNumber);
      if (available) {
        alert('사용 가능한 사원번호입니다.');
        setUidNumberChecked(true);
      } else {
        alert('이미 사용 중인 사원번호입니다.');
        setUidNumberChecked(false);
      }
    } catch (error) {
      console.error(error);
      alert('사원번호 중복 확인 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.cn.trim()) {
      alert('유저 아이디를 입력해 주세요.');
      return;
    }
    if (!cnChecked) {
      alert('유저 아이디 중복체크를 해주세요.');
      return;
    }
    if (!form.uidNumber) {
      alert('사원번호를 입력해 주세요.');
      return;
    }
    if (!uidNumberChecked) {
      alert('사원번호 중복체크를 해주세요.');
      return;
    }
    if (!form.uid.trim()) {
      alert('유저 이름을 입력해 주세요.');
      return;
    }

    const payload = {
      ...form,
      uidNumber: Number(form.uidNumber),
      userPassword: form.userPassword ? form.userPassword : String(form.uidNumber),
      homeDirectory: `/home/${form.cn}`,
    };

    setSubmitting(true);
    try {
      await addLdapUser(payload);
      alert('등록되었습니다.');
      setForm(initialForm);
      setCnChecked(false);
      setUidNumberChecked(false);
    } catch (error) {
      console.error(error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card register-device-card">
      <h2>유저 추가</h2>
      <p className="muted">사원번호 + 1000이 LDAP UID로 활용됩니다. 비밀번호는 기본적으로 사원번호로 설정됩니다.</p>

      <form onSubmit={handleSubmit} className="register-device-form" style={{ display: 'grid', gap: 16 }}>
        <label>
          유저 아이디 (CN)
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={form.cn}
              onChange={handleChange('cn')}
              placeholder="예: jdoe"
            />
            <button style={{ width: "18%" }} type="button" className="outline" onClick={handleCnCheck}>
              중복 체크
            </button>
          </div>
        </label>

        <label>
          사원번호
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={form.uidNumber}
              onChange={handleChange('uidNumber')}
              placeholder="예: 322"
            />
            <button style={{ width: "18%" }} type="button" className="outline" onClick={handleUidNumberCheck}>
              중복 체크
            </button>
          </div>
        </label>

        <label>
          유저 이름
          <input
            type="text"
            value={form.uid}
            onChange={handleChange('uid')}
            placeholder="예: 홍길동"
          />
        </label>

        <label>
          부서
          <select value={form.ou} onChange={handleChange('ou')} disabled={loadingDeps}>
            {departmentOptions.map((dept) => (
              <option key={dept.id ?? dept.name} value={dept.name ?? dept}>
                {dept.name ?? dept}
              </option>
            ))}
          </select>
        </label>

        <label>
          이메일
          <input type="email" value={form.mail} readOnly />
        </label>

        <label>
          LDAP UID (자동 계산)
          <input type="text" value={form.uidNumber ? Number(form.uidNumber) + 1000 : ''} readOnly />
        </label>

        <label>
          비밀번호 (선택)
          <input
            type="password"
            value={form.userPassword}
            onChange={handleChange('userPassword')}
            placeholder="미입력 시 사원번호로 설정"
          />
        </label>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="reset" className="outline" onClick={() => setForm(initialForm)} disabled={submitting}>
            초기화
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
