import React, { useState } from 'react';
import { getProjectByCode, createProject, updateProject } from '@/api/projects';

export default function EditProject() {
  const [searchCode, setSearchCode] = useState('');
  const [mode, setMode] = useState('new'); // 'new' | 'update'
  const [form, setForm] = useState({ id: '', name: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = () => setForm({ id: '', name: '', code: '' });

  const handleModeChange = (next) => {
    setMode(next);
    resetForm();
    // 편집 라디오는 항상 비활성 상태 유지 요구사항
  };

  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectByCode(searchCode.trim());
      setForm({ id: data.id ?? '', name: data.name ?? '', code: data.code ?? '' });
  setMode('update'); // 검색 성공 시 편집 모드로 전환(라디오는 비활성이나 체크 표시는 가능)
    } catch (e) {
      console.error(e);
      setError('프로젝트를 찾을 수 없습니다. 코드 값을 확인해 주세요.');
  setMode('new');
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (mode !== 'update' || !form.id) return;
    const ok = window.confirm('해당 프로젝트를 삭제하시겠습니까?');
    if (!ok) return;
    setSaving(true);
    try {
      const { deleteProject } = await import('@/api/projects');
      await deleteProject(form.id);
      alert('삭제되었습니다.');
      setMode('new');
      resetForm();
    } catch (e3) {
      console.error(e3);
      if (e3?.response?.status === 409) {
        alert('연관된 데이터가 있어 삭제할 수 없습니다. 관련 사용중인 항목을 먼저 정리해 주세요.');
      } else if (e3?.response?.status === 404) {
        alert('이미 삭제되었거나 존재하지 않는 프로젝트입니다.');
      } else {
        alert('삭제에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      alert('프로젝트명과 코드 모두 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'new') {
        await createProject({ name: form.name.trim(), code: form.code.trim() });
        alert('등록되었습니다.');
        resetForm();
      } else {
        await updateProject({ id: form.id, name: form.name.trim(), code: form.code.trim() });
        alert('수정되었습니다.');
      }
    } catch (e2) {
      console.error(e2);
      alert('작업에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card register-device-card">
      <h2>프로젝트 편집</h2>

      {/* 검색 바 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="편집할 프로젝트의 `코드` 를 입력해주세요."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem', minHeight: 44 }}
        />
        <button type="button" onClick={handleSearch} disabled={loading}>
          {loading ? '조회중…' : '검색'}
        </button>
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

        {/* 프로젝트명 */}
        <label>
          프로젝트명
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </label>

        {/* 코드 */}
        <label>
          코드
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
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
