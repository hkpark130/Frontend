import { useMemo, useState } from 'react';
import Spinner from '@/components/Spinner';
import { fetchInstanceByFloatingIp } from '@/api/openstack';
import './OpenStackInstanceSearch.css';

const FLOATING_IP_PREFIX = '192.168.3.';

// Map status to color pairs so the badge stays readable.
const STATUS_STYLES = {
  ACTIVE: { background: 'rgba(34, 197, 94, 0.18)', color: '#15803d' },
  BUILD: { background: 'rgba(59, 130, 246, 0.18)', color: '#1d4ed8' },
  ERROR: { background: 'rgba(248, 113, 113, 0.2)', color: '#b91c1c' },
  SHUTOFF: { background: 'rgba(249, 115, 22, 0.18)', color: '#b45309' },
  SUSPENDED: { background: 'rgba(124, 58, 237, 0.18)', color: '#6d28d9' },
  PAUSED: { background: 'rgba(13, 148, 136, 0.2)', color: '#0f766e' },
};

const isValidLastOctet = (value) => /^(?:[1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-4])$/.test(value);

export default function OpenStackInstanceSearch() {
  const [ipLastOctet, setIpLastOctet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [instanceData, setInstanceData] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = ipLastOctet.trim();

    if (!isValidLastOctet(trimmed)) {
      setError('1~254 사이의 숫자를 입력해주세요.');
      setInstanceData(null);
      return;
    }

    const floatingIp = `${FLOATING_IP_PREFIX}${trimmed}`;

    setLoading(true);
    setError(null);
    setInstanceData(null);

    try {
      const data = await fetchInstanceByFloatingIp(floatingIp);

      if (!data || typeof data !== 'object') {
        setError('인스턴스를 찾을 수 없습니다.');
        return;
      }

      setInstanceData(data);
    } catch (err) {
      console.error('Failed to fetch instance by floating IP', err);
      let message = '인스턴스 조회에 실패했습니다.';

      const responseMessage = err?.response?.data?.message || err?.response?.data?.error;
      if (responseMessage && typeof responseMessage === 'string') {
        message = responseMessage;
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIpLastOctet('');
    setInstanceData(null);
    setError(null);
  };

  const detailRows = useMemo(() => {
    if (!instanceData) {
      return [];
    }

    return [
      { key: 'name', label: '인스턴스 이름', value: instanceData.name ?? '-' },
      { key: 'internalInstanceName', label: '내부 인스턴스 이름', value: instanceData.internalInstanceName ?? '-' },
      { key: 'id', label: '인스턴스 ID', value: instanceData.id ?? '-' },
      { key: 'status', label: '상태', value: instanceData.status ?? '-', type: 'status' },
      { key: 'flavor', label: 'Flavor', value: instanceData.flavor ?? '-' },
      { key: 'image', label: '이미지', value: instanceData.image ?? '-' },
      { key: 'host', label: '호스트', value: instanceData.host ?? '-' },
      { key: 'privateIp', label: '프라이빗 IP', value: instanceData.privateIp ?? '-' },
      { key: 'floatingIp', label: '플로팅 IP', value: instanceData.floatingIp ?? '-' },
      { key: 'keyName', label: '키 이름', value: instanceData.keyName ?? instanceData.keyName ?? '-' },
    ];
  }, [instanceData]);

  const securityGroups = useMemo(() => {
    if (!instanceData) {
      return [];
    }

    const groups = Array.isArray(instanceData.securityGroups) ? instanceData.securityGroups : [];

    return groups.map((group, index) => {
      const direction = group?.direction === 'ingress' ? '인바운드' : '아웃바운드';
      const directionClass = group?.direction === 'ingress' ? 'direction-inbound' : 'direction-outbound';
      const ethertypeRaw = (group?.ethertype ?? '').toLowerCase();
      const ethertypeClass =
        ethertypeRaw === 'ipv6' ? 'ethertype-ipv6' : ethertypeRaw === 'ipv4' ? 'ethertype-ipv4' : '';
      const ethertypeLabel = ethertypeRaw ? ethertypeRaw.toUpperCase() : 'UNKNOWN';
      const ethertypeClassName = ['openstack-chip', ethertypeClass].filter(Boolean).join(' ');

      return {
        key: group?.key || `${group?.groupName || 'sg'}-${index}`,
        groupName: group?.groupName ?? '-',
        direction,
        directionClass,
        ethertypeClassName,
        ethertypeLabel,
        protocol: group?.protocol ? String(group.protocol).toUpperCase() : 'ANY',
        portRange: group?.portRange ?? 'any',
        remote: group?.remote ?? 'any',
      };
    });
  }, [instanceData]);

  const renderDetailValue = (row) => {
    if (row.type === 'status') {
      const normalized = typeof row.value === 'string' ? row.value.toUpperCase() : '';
      const style = STATUS_STYLES[normalized] || { background: 'rgba(148, 163, 184, 0.22)', color: '#475569' };
      return (
        <span className="openstack-status-tag" style={style}>
          {row.value || '-'}
        </span>
      );
    }

    if (row.key === 'floatingIp') {
      return (
        <span className="openstack-remote-tag" style={{ background: 'rgba(24, 144, 255, 0.18)', color: '#1d4ed8' }}>
          {row.value || '-'}
        </span>
      );
    }

    return row.value || '-';
  };

  const renderRemote = (remote) => {
    if (!remote || remote === 'any') {
      return <span className="openstack-remote-any">any</span>;
    }
    return <span className="openstack-remote-tag">{remote}</span>;
  };

  return (
    <>
      <h2>OpenStack 인스턴스 조회</h2>

      <div className="card">
        <form className="openstack-form" onSubmit={handleSubmit}>
          <label>
            플로팅 IP
            <div className="openstack-ip-inputs">
              <input type="text" value={FLOATING_IP_PREFIX} readOnly aria-label="플로팅 IP 앞자리" />
              <input
                type="number"
                min={1}
                max={254}
                value={ipLastOctet}
                onChange={(event) => setIpLastOctet(event.target.value)}
                placeholder="1~254"
                aria-label="플로팅 IP 마지막 자리"
                required
              />
              <div className="openstack-actions">
                <button type="submit" className="primary" disabled={loading}>
                  {loading ? '조회 중...' : '조회'}
                </button>
                <button type="button" className="outline" onClick={handleReset} disabled={loading}>
                  초기화
                </button>
              </div>
            </div>
            <span className="openstack-search-hint">예: 24 입력 → {FLOATING_IP_PREFIX}24</span>
          </label>
        </form>
      </div>

      {loading && (
        <div className="card openstack-status-card">
          <div className="openstack-loading">
            <Spinner size={28} ariaLabel="OpenStack 조회 중" />
            <span>OpenStack에서 인스턴스 정보를 조회하고 있습니다...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="card openstack-error-card">
          <header>
            <strong>조회 실패</strong>
            <button type="button" className="outline" onClick={() => setError(null)}>
              닫기
            </button>
          </header>
          <p>{error}</p>
        </div>
      )}

      {instanceData && !loading && (
        <div className="card openstack-result-card">
          <div className="openstack-result-heading">
            <h3 style={{ margin: 0 }}>인스턴스 상세 정보</h3>
            <p className="openstack-search-hint" style={{ margin: '6px 0 0' }}>
              {FLOATING_IP_PREFIX}
              {ipLastOctet.trim() || instanceData.floatingIp?.split('.').pop()}
              에 대한 조회 결과입니다.
            </p>
          </div>

          <div className="openstack-detail-grid">
            {detailRows.map((row) => (
              <div key={row.key} className="openstack-detail-item">
                <span className="openstack-detail-label">{row.label}</span>
                <span className="openstack-detail-value">{renderDetailValue(row)}</span>
              </div>
            ))}
          </div>

          <div className="openstack-security-section">
            <div className="openstack-security-header">
              <h4 style={{ margin: 0 }}>보안 그룹</h4>
              <span className="openstack-search-hint">연결된 모든 보안 그룹 규칙을 표시합니다.</span>
            </div>

            {securityGroups.length === 0 ? (
              <div className="openstack-security-empty">연결된 보안 그룹 정보가 없습니다.</div>
            ) : (
              <div className="table-wrapper">
                <table className="openstack-security-table">
                  <thead>
                    <tr>
                      <th scope="col">보안 그룹명</th>
                      <th scope="col">방향</th>
                      <th scope="col">IP 버전</th>
                      <th scope="col">프로토콜</th>
                      <th scope="col">포트 범위</th>
                      <th scope="col">원격 IP / 그룹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityGroups.map((group) => (
                      <tr key={group.key}>
                        <td>{group.groupName}</td>
                        <td>
                          <span className={`openstack-chip ${group.directionClass}`}>
                            {group.direction}
                          </span>
                        </td>
                        <td>
                          <span className={group.ethertypeClassName}>{group.ethertypeLabel}</span>
                        </td>
                        <td>
                          <span className="openstack-chip protocol">{group.protocol}</span>
                        </td>
                        <td>{group.portRange || 'any'}</td>
                        <td>{renderRemote(group.remote)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
