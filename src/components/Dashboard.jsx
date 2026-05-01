import { useMemo, useState } from 'react';
import { BarChart3, Users, Award, AlertTriangle, TrendingUp } from 'lucide-react';
import { TARGET_THRESHOLD } from '../services/contracts';

export default function Dashboard({ regions, chains, visits, session }) {
  const [dashRegion, setDashRegion] = useState('');
  const [dashChain, setDashChain] = useState('');
  // For manager: option to filter by rep
  const [dashRep, setDashRep] = useState('');

  const repsList = useMemo(() => {
    const set = new Set();
    visits.forEach((v) => {
      if (v.savedBy?.name) set.add(v.savedBy.name);
    });
    return [...set].sort();
  }, [visits]);

  const stats = useMemo(() => {
    // Filter visits based on role + filters
    let filteredVisits = visits;

    // Exclude incomplete visits from all dashboard stats
    filteredVisits = filteredVisits.filter((v) => !v.incomplete);

    // Rep can only see their own visits in dashboard
    if (session?.role === 'rep') {
      filteredVisits = filteredVisits.filter((v) => v.savedBy?.name === session.name);
    } else if (dashRep) {
      filteredVisits = filteredVisits.filter((v) => v.savedBy?.name === dashRep);
    }

    filteredVisits = filteredVisits.filter(
      (v) =>
        (!dashRegion || v.region === dashRegion) &&
        (!dashChain || v.chain === dashChain)
    );

    // Keep only the latest visit per customer to avoid double-counting
    const latestByCustomer = new Map();
    filteredVisits.forEach((v) => {
      const key = [v.customer_code, v.acc_code || '', v.customer_name, v.customer_address || ''].join('|');
      const old = latestByCustomer.get(key);
      const ts = (v) => new Date(v.timestamp || 0).getTime() || Number(v.id) || 0;
      if (!old || ts(v) > ts(old)) latestByCustomer.set(key, v);
    });

    const list = Array.from(latestByCustomer.values());
    const byRegion = {}, byChain = {}, cat = {};
    let achieved = 0;

    list.forEach((v) => {
      const ok = Number(v.weightedAvg || 0) >= TARGET_THRESHOLD;
      if (ok) achieved++;

      const regionKey = v.region || 'غير محدد';
      const chainKey = v.chain || 'غير محدد';
      byRegion[regionKey] ||= { total: 0, achieved: 0, not: 0 };
      byChain[chainKey] ||= { total: 0, achieved: 0, not: 0 };
      byRegion[regionKey].total++;
      byChain[chainKey].total++;
      if (ok) {
        byRegion[regionKey].achieved++;
        byChain[chainKey].achieved++;
      } else {
        byRegion[regionKey].not++;
        byChain[chainKey].not++;
      }

      (v.rows || []).forEach((r) => {
        cat[r.name] ||= { sum: 0, count: 0 };
        cat[r.name].sum += Math.min(Number(r.achievement || 0), 100);
        cat[r.name].count++;
      });
    });

    return {
      total: list.length,
      achieved,
      not: list.length - achieved,
      byRegion: Object.entries(byRegion),
      byChain: Object.entries(byChain),
      cat: Object.entries(cat)
        .map(([name, v]) => ({ name, avg: v.count ? v.sum / v.count : 0, count: v.count }))
        .sort((a, b) => b.avg - a.avg),
    };
  }, [dashRegion, dashChain, dashRep, visits, session]);

  return (
    <main className="dashboard">
      <div className="page-head">
        <div>
          <h2><BarChart3 size={20} /> لوحة الأداء</h2>
          <p>
            {session?.role === 'rep'
              ? 'عرض زياراتك أنت فقط'
              : 'فلترة Region + Desc_L5 ومعرفة المحقق وغير المحقق'}
          </p>
        </div>
        <div className="dash-filters">
          <select value={dashRegion} onChange={(e) => setDashRegion(e.target.value)}>
            <option value="">كل المناطق</option>
            {regions.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={dashChain} onChange={(e) => setDashChain(e.target.value)}>
            <option value="">كل Desc_L5</option>
            {chains.map((c) => <option key={c}>{c}</option>)}
          </select>
          {session?.role === 'manager' && repsList.length > 0 && (
            <select
              value={dashRep}
              onChange={(e) => setDashRep(e.target.value)}
              style={{ gridColumn: '1 / -1' }}
            >
              <option value="">كل المنسقين</option>
              {repsList.map((r) => <option key={r}>{r}</option>)}
            </select>
          )}
        </div>
      </div>

      {!visits.length && (
        <div className="welcome">
          <h3>لا توجد زيارات محفوظة للعرض في اللوحة</h3>
          <p>احفظ زيارة أولاً، وبعدها ستظهر الأرقام هنا.</p>
        </div>
      )}

      <div className="stats">
        <Card icon={<Users />} label="إجمالي العملاء" value={stats.total} />
        <Card icon={<Award />} label="محقق" value={stats.achieved} />
        <Card icon={<AlertTriangle />} label="غير محقق" value={stats.not} />
        <Card
          icon={<TrendingUp />}
          label="معدل التحقيق"
          value={stats.total ? ((stats.achieved / stats.total) * 100).toFixed(1) + '%' : '0%'}
        />
      </div>

      <div className="dash-grid">
        <Breakdown title="الأداء حسب Region" rows={stats.byRegion} />
        <Breakdown title="الأداء حسب Desc_L5" rows={stats.byChain} />
      </div>

      <section className="panel">
        <h3>الأداء حسب الفئة</h3>
        {stats.cat.length ? (
          stats.cat.map((c) => (
            <div className="bar" key={c.name}>
              <b>{c.name}</b>
              <div><span style={{ width: Math.min(c.avg, 100) + '%' }} /></div>
              <strong>{c.avg.toFixed(0)}%</strong>
            </div>
          ))
        ) : (
          <p className="empty">لا توجد فئات محفوظة بعد</p>
        )}
      </section>
    </main>
  );
}

function Card({ icon, label, value }) {
  return (
    <div className="stat">
      <i>{icon}</i>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function Breakdown({ title, rows }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="empty">لا توجد بيانات</p>}
      {rows.map(([name, v]) => (
        <div className="break" key={name}>
          <b>{name}</b>
          <span>إجمالي {v.total}</span>
          <em>محقق {v.achieved}</em>
          <small>غير محقق {v.not}</small>
        </div>
      ))}
    </section>
  );
}
