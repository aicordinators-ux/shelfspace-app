import { useState, useMemo } from 'react';
import {
  ClipboardCheck, Search, X, MapPin, CheckCircle2, CircleDashed, Users, Percent,
  AlertTriangle,
} from 'lucide-react';
import { getReasonLabel } from '../services/incompleteReasons';
import { PERIODS, periodStart, periodLabel, visitTime } from '../services/periods';

function formatDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return '';
  }
}

// Codes come from two places (customers file / saved visits) and can differ in
// padding or type, so normalize before matching.
const normCode = (code) => String(code ?? '').trim();

// The master file mirrors the source workbook, so a cell that holds a bare
// number (a few branches have an address of just "1") arrives as a number.
// Coerce every text field once, up front, so search and render can rely on it.
const text = (value) => (value == null ? '' : String(value));

export default function CustomerTracker({ visits = [], customers = [] }) {
  const [period, setPeriod] = useState('today');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterChain, setFilterChain] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'visited' | 'incomplete' | 'not_visited'
  const [searchQuery, setSearchQuery] = useState('');

  // ===== One entry per customer code =====
  // The master file holds a row per contract (DRY / Impulse), so the same shop
  // appears more than once. Tracking is per shop, so collapse by code.
  const uniqueCustomers = useMemo(() => {
    const byCode = new Map();
    customers.forEach((c) => {
      const code = normCode(c.code);
      if (!code || byCode.has(code)) return;
      byCode.set(code, {
        code,
        name: text(c.name),
        address: text(c.address),
        region: text(c.region),
        chain: text(c.chain),
        acc_code: text(c.acc_code),
      });
    });
    return [...byCode.values()];
  }, [customers]);

  // ===== Filter option lists =====
  const regionOptions = useMemo(
    () => [...new Set(uniqueCustomers.map((c) => c.region).filter(Boolean))].sort(),
    [uniqueCustomers]
  );
  // Agents narrow down to the selected region so the list stays usable.
  const chainOptions = useMemo(() => {
    const source = filterRegion
      ? uniqueCustomers.filter((c) => c.region === filterRegion)
      : uniqueCustomers;
    return [...new Set(source.map((c) => c.chain).filter(Boolean))].sort();
  }, [uniqueCustomers, filterRegion]);

  const repOptions = useMemo(() => {
    const set = new Set();
    visits.forEach((v) => v.savedBy?.name && set.add(v.savedBy.name));
    return [...set].sort();
  }, [visits]);

  // ===== Latest qualifying visit per customer code =====
  // Complete and incomplete visits are tracked separately: a customer with a
  // complete visit counts as covered, while one that only has an incomplete
  // visit (closed / refused / postponed) is shown as its own state — the rep
  // did go there, but there are no measurements.
  const { doneByCode, incompleteByCode } = useMemo(() => {
    const start = periodStart(period);
    const done = new Map();
    const incomplete = new Map();

    visits.forEach((v) => {
      if (filterRep && v.savedBy?.name !== filterRep) return;
      const code = normCode(v.customer_code);
      if (!code) return;
      const t = visitTime(v);
      if (start != null && (isNaN(t) || t < start)) return;

      const map = v.incomplete ? incomplete : done;
      const prev = map.get(code);
      if (!prev || (!isNaN(t) && t > prev.time)) {
        map.set(code, { time: isNaN(t) ? 0 : t, visit: v });
      }
    });

    return { doneByCode: done, incompleteByCode: incomplete };
  }, [visits, period, filterRep]);

  // ===== Customers in scope (everything except the status filter) =====
  const scoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return uniqueCustomers.filter((c) => {
      if (filterRegion && c.region !== filterRegion) return false;
      if (filterChain && c.chain !== filterChain) return false;
      if (q && !(
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.acc_code.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [uniqueCustomers, filterRegion, filterChain, searchQuery]);

  // ===== Stats over the scope (before the status filter) =====
  // visited + incomplete + remaining always add up to total: a customer with
  // both kinds of visit is counted once, under "visited".
  const stats = useMemo(() => {
    const total = scoped.length;
    let visited = 0;
    let incomplete = 0;
    scoped.forEach((c) => {
      if (doneByCode.has(c.code)) visited++;
      else if (incompleteByCode.has(c.code)) incomplete++;
    });
    return {
      total,
      visited,
      incomplete,
      remaining: total - visited - incomplete,
      // Completion counts measured visits only.
      pct: total ? Math.round((visited / total) * 100) : 0,
    };
  }, [scoped, doneByCode, incompleteByCode]);

  // ===== Final list =====
  const list = useMemo(() => {
    const rows = scoped.map((c) => {
      const done = doneByCode.get(c.code) || null;
      const incomplete = done ? null : incompleteByCode.get(c.code) || null;
      return {
        customer: c,
        entry: done || incomplete,
        status: done ? 'visited' : incomplete ? 'incomplete' : 'not_visited',
      };
    });
    if (!filterStatus) return rows;
    return rows.filter((r) => r.status === filterStatus);
  }, [scoped, doneByCode, incompleteByCode, filterStatus]);

  const activeFilters =
    [filterRegion, filterChain, filterRep, filterStatus, searchQuery].filter(Boolean).length;

  function clearAllFilters() {
    setFilterRegion('');
    setFilterChain('');
    setFilterRep('');
    setFilterStatus('');
    setSearchQuery('');
  }

  const currentPeriodLabel = periodLabel(period);

  return (
    <main className="tracker-page">
      <div className="page-head">
        <div>
          <h2><ClipboardCheck size={20} /> متابعة العملاء</h2>
          <p>
            حالة تغطية العملاء خلال: <b>{currentPeriodLabel}</b>
            {activeFilters > 0 && (
              <> · <span style={{ color: 'var(--text-faint)' }}>{activeFilters} فلتر مفعّل</span></>
            )}
          </p>
        </div>
        {activeFilters > 0 && (
          <button className="ghost" onClick={clearAllFilters}>
            <X size={14} /> مسح الفلاتر
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="tracker-stats">
        <div className="stat">
          <i><Users size={18} /></i>
          <strong>{stats.total}</strong>
          <small>إجمالي العملاء</small>
        </div>
        <div className="stat ok">
          <i><CheckCircle2 size={18} /></i>
          <strong>{stats.visited}</strong>
          <small>تمت زيارتهم</small>
        </div>
        <div className="stat warn">
          <i><AlertTriangle size={18} /></i>
          <strong>{stats.incomplete}</strong>
          <small>غير مكتملة</small>
        </div>
        <div className="stat bad">
          <i><CircleDashed size={18} /></i>
          <strong>{stats.remaining}</strong>
          <small>متبقي</small>
        </div>
        <div className="stat">
          <i><Percent size={18} /></i>
          <strong>{stats.pct}%</strong>
          <small>نسبة الإنجاز</small>
          <div className="tracker-progress">
            <span style={{ width: stats.pct + '%' }} />
          </div>
        </div>
      </div>

      {/* Period switcher */}
      <div className="tracker-periods">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className={period === p.value ? 'period-btn active' : 'period-btn'}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-wrap" style={{ marginBottom: 10 }}>
        <Search size={16} />
        <input
          placeholder="ابحث بكود العميل أو الاسم..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}><X size={14} /></button>
        )}
      </div>

      {/* Filters */}
      <div className="visits-filters">
        <select
          value={filterRegion}
          onChange={(e) => {
            setFilterRegion(e.target.value);
            setFilterChain(''); // agent list depends on the region
          }}
        >
          <option value="">كل المناطق</option>
          {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select value={filterChain} onChange={(e) => setFilterChain(e.target.value)}>
          <option value="">كل الوكلاء</option>
          {chainOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)}>
          <option value="">كل المنسقين</option>
          {repOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="visited">تمت زيارته</option>
          <option value="incomplete">غير مكتملة</option>
          <option value="not_visited">لم تتم زيارته</option>
        </select>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="welcome">
          <h3>لا توجد نتائج</h3>
          <p>جرب تغيير الفلاتر أو الفترة الزمنية</p>
        </div>
      ) : (
        <div className="tracker-list">
          {list.map(({ customer: c, entry, status }) => (
            <article className={'tracker-item ' + status} key={c.code}>
              <div className="tracker-item-main">
                <div className="tracker-item-head">
                  <span className="pill">#{c.code}</span>
                  <strong>{c.name}</strong>
                </div>
                {c.address && (
                  <p className="address"><MapPin size={12} /> {c.address}</p>
                )}
                <small>{[c.region, c.chain].filter(Boolean).join(' · ')}</small>
                {status === 'incomplete' && (
                  <span className="tracker-reason">
                    السبب: <b>{getReasonLabel(entry.visit.incompleteReason)}</b>
                    {entry.visit.incompleteNote && <> — {entry.visit.incompleteNote}</>}
                  </span>
                )}
              </div>

              <div className="tracker-item-status">
                {status === 'not_visited' ? (
                  <span className="tracker-badge none">
                    <CircleDashed size={13} /> لم تتم زيارته
                  </span>
                ) : (
                  <>
                    {status === 'visited' ? (
                      <span className="tracker-badge ok">
                        <CheckCircle2 size={13} /> تمت زيارته
                      </span>
                    ) : (
                      <span className="tracker-badge warn">
                        <AlertTriangle size={13} /> غير مكتملة
                      </span>
                    )}
                    <em>
                      {formatDate(entry.visit.timestamp || entry.visit.clientTimestamp)}
                      {entry.visit.savedBy?.name && <> · {entry.visit.savedBy.name}</>}
                    </em>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
