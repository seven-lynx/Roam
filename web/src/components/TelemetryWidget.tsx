'use client';

import { useEffect, useState } from 'react';

interface HomeStats {
  totalUsers: number;
  totalRatings: number;
  activeUrls: number;
  activeTags: number;
  totalServes: number;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="telemetry-stat">
      <span className="telemetry-value">{value.toLocaleString()}</span>
      <span className="telemetry-label">{label}</span>
    </div>
  );
}

/** Live network-wide counters, pulled from the public home-stats endpoint. */
export function TelemetryWidget() {
  const [stats, setStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/home-stats')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setStats(d as HomeStats); })
      .catch(() => { /* keep the skeleton */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-grip" aria-hidden="true"><i /><i /><i /></span>
        <span className="widget-title">SYS.TELEMETRY</span>
      </div>
      <div className="widget-body">
        {stats === null ? (
          <div className="widget-empty">Reading network…</div>
        ) : (
          <div className="telemetry-grid">
            <Stat label="EXPLORERS" value={stats.totalUsers} />
            <Stat label="URLS" value={stats.activeUrls} />
            <Stat label="RATINGS" value={stats.totalRatings} />
            <Stat label="SERVES" value={stats.totalServes} />
          </div>
        )}
        <div className="widget-foot">public counters · refreshed daily</div>
      </div>
    </div>
  );
}
