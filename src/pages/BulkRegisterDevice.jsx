import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Alert from '@mui/material/Alert';
import './RegisterDevice.css';
import { bulkRegisterDevices } from "@/api/devices";

// 예시에서 줄바꿈은 \n으로 입력해야 한 줄에 표시됩니다.
const csvExample = [
  {
    id: 'DIR-N-107',
    categoryName: '노트북',
    purpose: '사무',
    manageDepName: '경영지원부',
    status: '정상',
    projectName: '농협',
    spec: 'RAM: 16G\\\\nCPU: 8core', // 실제 CSV에는 RAM: 16G\nCPU: 8core 형태로 입력
    price: '80000',
    vatIncluded: 'true',
    model: 'LSBX2433',
    company: 'SAMSUNG',
    sn: 'ND6179NBK',
    isUsable: 'true',
    purchaseDate: '2024-02-01',
    description: '부팅 느림',
    adminDescription: '부팅 느림',
    username: '박현경',
  },
];

const csvColumns = [
  'id',
  'categoryName',
  'manageDepName',
  'projectName',
  'status',
  'purpose',
  'spec',
  'price',
  'vatIncluded',
  'model',
  'company',
  'sn',
  'isUsable',
  'purchaseDate',
  'description',
  'adminDescription',
  'username',
];

export default function BulkRegisterDevice() {
  const [csvData, setCsvData] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef();

  // 값 보정 유틸
  const toNull = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  const toBool = (v) => {
    if (typeof v === 'boolean') return v;
    if (v === undefined || v === null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === '') return null;
    return s === 'true' || s === '1' || s === 'y' || s === 'yes';
  };

  const toNumber = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const unescapeNewlines = (v) => {
    if (v === undefined || v === null) return null;
    return String(v).replaceAll('\\n', '\n');
  };

  const normalizeRow = (row) => ({
    id: toNull(row.id),
    categoryName: toNull(row.categoryName),
    manageDepName: toNull(row.manageDepName),
    projectName: toNull(row.projectName),
    status: toNull(row.status),
    purpose: toNull(row.purpose),
    spec: unescapeNewlines(row.spec),
    price: toNumber(row.price),
    vatIncluded: toBool(row.vatIncluded),
    model: toNull(row.model),
    company: toNull(row.company),
    sn: toNull(row.sn),
    isUsable: toBool(row.isUsable),
    purchaseDate: toNull(row.purchaseDate),
    description: unescapeNewlines(row.description),
    adminDescription: unescapeNewlines(row.adminDescription),
    username: toNull(row.username),
  });

  // CSV 파싱
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',');
    if (!csvColumns.every(col => headers.includes(col))) {
      throw new Error('필수 컬럼이 누락되었습니다.');
    }
    return lines.slice(1).map(line => {
      const values = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
  };

  // 파일 업로드 핸들러
  const handleFileChange = (e) => {
    setCsvError('');
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = parseCSV(text);
        setCsvData(parsed);
      } catch (err) {
        setCsvError(err.message);
        setCsvData([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // 예시 CSV 다운로드
  const handleDownloadExample = () => {
    const header = csvColumns.join(',');
    const row = csvColumns.map(col => csvExample[0][col] || '').join(',');
    const blob = new Blob([header + '\n' + row], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '장비등록_예시.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 일괄 등록
  const handleBulkRegister = async () => {
    if (!csvData.length) {
      alert('CSV 파일을 업로드하세요.');
      return;
    }

    // 전송 전 정규화 및 최소 검증
    const normalized = csvData.map(normalizeRow);
    const missingId = normalized.filter(r => !r.id);
    if (missingId.length) {
      alert(`필수 컬럼(id)이 비어있는 행이 ${missingId.length}개 있습니다.`);
      return;
    }

    try {
      await bulkRegisterDevices(normalized);
      alert('장비가 일괄 등록되었습니다.');
      setCsvData([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      alert('등록 실패: ' + (error?.message || '서버 오류'));
    }
  };

  return (
    <Box sx={{ maxWidth: 'none', width: '90%', minWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>장비 일괄 등록</Typography>
      <Card sx={{ mb: 3, p: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>예시 양식</Typography>
          <Alert severity="info" sx={{ mb: 2, fontSize: 15 }}>
            <b>CSV 파일은 UTF-8 인코딩</b>으로 저장됩니다.<br />
            엑셀에서 예시 파일을 바로 열면 한글이 깨질 수 있으니,<br />
            <b>엑셀의 "데이터 → 텍스트/CSV 가져오기" 기능</b>을 사용해 UTF-8로 불러오세요.<br /><br />
            여러 줄 입력이 필요한 spec, description 등은 <b>줄바꿈 대신 "\\n"</b>을 입력하세요.<br />
            (예: RAM: 16G\\nCPU: 8core)
            <br /><br />부가세 여부(<code>vatIncluded</code>)는 <b>true/false</b> 또는 <b>1/0</b> 값으로 채워주세요.
          </Alert>
          <Box sx={{ overflowX: 'auto', mb: 2 }}>
            <table className="csv-example-table">
              <thead>
                <tr>
                  {csvColumns.map(col => <th key={col}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {csvExample.map((row, i) => (
                  <tr key={i}>
                    {csvColumns.map(col => <td key={col}>{row[col]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          <Button variant="outlined" onClick={handleDownloadExample} sx={{ mb: 1 }}>
            예시 CSV 다운로드
          </Button>
        </CardContent>
      </Card>
      <Card sx={{ mb: 3, p: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>CSV 파일 업로드</Typography>
          <Box
            sx={{
              border: '2px dashed #90caf9',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              background: '#f5fafd',
              cursor: 'pointer',
              mb: 2,
              transition: 'border 0.2s',
              '&:hover': { borderColor: '#1976d2' },
            }}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                fileInputRef.current.files = e.dataTransfer.files;
                handleFileChange({ target: { files: e.dataTransfer.files } });
              }
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>CSV 파일을 클릭 또는 드래그하여 업로드</Typography>
            <Typography variant="body2" color="text.secondary">최대 1개 파일만 업로드할 수 있습니다.</Typography>
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </Box>
          {fileName && <Typography sx={{ mt: 1 }}>업로드 파일: {fileName}</Typography>}
          {csvError && <Alert severity="error" sx={{ mt: 1 }}>{csvError}</Alert>}
        </CardContent>
      </Card>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleBulkRegister}
          disabled={!csvData.length}
          sx={{ fontWeight: 700, fontSize: 16, borderRadius: 2, py: 1.2, px: 4 }}
        >
          장비 일괄 등록
        </Button>
      </Box>
      {csvData.length > 0 && (
        <Card sx={{ p: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>업로드 미리보기</Typography>
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="csv-preview-table">
                <thead>
                  <tr>
                    {csvColumns.map(col => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {csvData.map((row, i) => (
                    <tr key={i}>
                      {csvColumns.map(col => <td key={col}>{row[col]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
