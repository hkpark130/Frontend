import React, { useMemo, useState } from 'react';
import { createCategory } from '@/api/categories';
import { useNavigate } from 'react-router-dom';

export default function AddCategory() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return '/images/etc.png';
  }, [file]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('카테고리 이름을 입력해 주세요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createCategory({ name: name.trim(), file });
      alert('등록되었습니다.');
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('등록에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card register-device-card">
      <h2>품목 등록</h2>
      <form onSubmit={handleSubmit} className="register-device-form" encType="multipart/form-data">
        <label>
          카테고리 이름
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 노트북, 서버, 모니터"
            required
          />
        </label>

        <label>
          대표 이미지 (선택)
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <small>업로드하지 않으면 기본 이미지가 사용됩니다.</small>
        </label>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>미리보기</div>
          <div style={{ alignItems: 'center' }}>
            <img
              src={previewUrl}
              alt="미리보기"
              style={{ width: 64, height: 64, objectFit: 'contain' }}
            />
            <div style={{ fontSize: '1.1rem' }}>{name || '카테고리명'}</div>
          </div>
        </div>

        {error && <div style={{ color: '#d00' }}>{error}</div>}

        <button type="submit" disabled={saving}>{saving ? '저장중…' : '등록'}</button>
      </form>
    </div>
  );
}
