import React, { useEffect, useMemo, useState } from 'react';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/api/departments';

export default function EditDepartment() {
  const [departments, setDepartments] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [mode, setMode] = useState('new'); // 'new' | 'update' (update radio disabled)
  const [form, setForm] = useState({ id: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = () => setForm({ id: '', name: '' });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchDepartments();
        if (mounted) setDepartments(data || []);
      } catch (e) {
        console.error(e);
        if (mounted) setError('부서 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = searchName.trim();
    if (!q) return departments;
    return departments.filter(d => (d.name || '').includes(q));
  }, [departments, searchName]);

  const handlePick = (dep) => {
    setForm({ id: dep.id ?? '', name: dep.name ?? '' });
    setMode('update');
  };

  const handleModeChange = (next) => {
    setMode(next);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('부서명을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'new') {
        await createDepartment({ name: form.name.trim() });
        alert('등록되었습니다.');
        resetForm();
      } else {
        await updateDepartment({ id: form.id, name: form.name.trim() });
        alert('수정되었습니다.');
      }
      // 성공 후 목록 갱신
      const data = await fetchDepartments();
      setDepartments(data || []);
    } catch (e2) {
      console.error(e2);
      alert('작업에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (mode !== 'update' || !form.id) {
      alert('삭제할 부서를 먼저 선택해 주세요.');
      return;
    }
    const ok = window.confirm('해당 부서를 삭제하시겠습니까?');
    if (!ok) return;
    setSaving(true);
    try {
      await deleteDepartment(form.id);
      alert('삭제되었습니다.');
      setMode('new');
      resetForm();
      const data = await fetchDepartments();
      setDepartments(data || []);
    } catch (e3) {
      console.error(e3);
      if (e3?.response?.status === 409) {
        alert('연관된 데이터가 있어 삭제할 수 없습니다. 관련 사용중인 항목을 먼저 정리해 주세요.');
      } else if (e3?.response?.status === 404) {
        alert('이미 삭제되었거나 존재하지 않는 부서입니다.');
      } else {
        alert('삭제에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card register-device-card">
      <h2>부서 편집</h2>

      {/* 검색 바 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="편집할 부서의 `부서명` 를 입력해주세요."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) handlePick(filtered[0]); }}
          style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem', minHeight: 44 }}
        />
      </div>

      {/* 제안 리스트 */}
      <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16 }}>
        {loading ? (
          <div style={{ padding: 12 }}>로딩중…</div>
        ) : filtered.length ? (
          filtered.map((item) => (
            <div key={item.id}
                 onClick={() => handlePick(item)}
                 style={{ padding: '8px 12px', cursor: 'pointer' }}
                 onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                 onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
              {item.name}
            </div>
          ))
        ) : (
          <div style={{ padding: 12, color: '#64748b' }}>Data Not Found.....</div>
        )}
      </div>

      {error && <div style={{ color: '#d00', marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="register-device-form">
        {/* 라디오: 신규 / 편집 */}
        <label>
          <span style={{ display: 'block' }}>신규 or 편집 여부</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="mode" value="new" checked={mode === 'new'} onChange={() => handleModeChange('new')} /> 신규
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
              <input type="radio" name="mode" value="update" checked={mode === 'update'} onChange={() => handleModeChange('update')} disabled /> 편집
            </label>
          </div>
        </label>

        {/* 부서명 */}
        <label>
          부서명
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <button
            type="submit"
            style={{ flex: 1, minHeight: 44, padding: '0.75rem 1rem', borderRadius: 8 }}
            disabled={saving}
          >
            {saving ? '저장중…' : '생성/편집'}
          </button>
          <button
            type="button"
            style={{ flex: 1, minHeight: 44, padding: '0.75rem 1rem', borderRadius: 8, background: '#e53935', color: '#fff' }}
            onClick={handleDelete}
            disabled={saving || mode !== 'update' || !form.id}
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
