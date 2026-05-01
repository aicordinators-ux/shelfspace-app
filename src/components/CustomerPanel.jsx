import { MapPin, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  TARGET_THRESHOLD,
  initialActuals,
  summarize,
  colorFor,
} from '../services/contracts';

export default function CustomerPanel({
  customer,
  computed,
  actuals,
  setActuals,
  onSave,
  onIncomplete,
  saving,
  validationErrors,
  editingVisitId,
  onCancelEdit,
  onClose,
}) {
  const overall = computed.weightedAvg;

  function updateField(key, field, value) {
    setActuals((old) => ({
      ...old,
      [key]: {
        ...(old[key] || {}),
        [field]: value === '' ? 0 : parseFloat(value),
      },
    }));
  }

  function updateApplied(key, applied) {
    setActuals((old) => ({
      ...old,
      [key]: { ...(old[key] || {}), applied },
    }));
  }

  function resetInputs() {
    setActuals(initialActuals(customer));
  }

  const grouped = computed.rows.reduce((acc, row) => {
    (acc[row.section] ||= []).push(row);
    return acc;
  }, {});

  const errorKeys = new Set((validationErrors || []).map((r) => r.key));

  return (
    <div className="customer-panel">
      <div className="cp-header">
        <div>
          <div className="cp-tag">عميل #{customer.code}</div>
          <h2>{customer.name}</h2>
          {customer.address && (
            <p className="address"><MapPin size={13} /> {customer.address}</p>
          )}
          <p>
            {customer.region} · {customer.chain} · المسؤول: {customer.team_leader}
          </p>
        </div>
        <button className="icon" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="overall">
        <div className={'circle ' + colorFor(overall)}>{overall.toFixed(0)}%</div>
        <div>
          <b>{overall >= TARGET_THRESHOLD ? 'تم تحقيق العقد' : 'لم يتحقق'}</b>
          <span>
            {computed.achievedCount} من {computed.rows.length} بند محقق · المتوسط {computed.weightedAvg.toFixed(1)}%
          </span>
        </div>
      </div>

      {validationErrors?.length > 0 && (
        <div className="validation-box">
          <AlertTriangle size={18} />
          <div>
            <b>راجع الإدخالات قبل الحفظ</b>
            {validationErrors.map((r) => (
              <span key={r.key}>
                {r.section} / {r.name}: الفعلي {r.actualSpace} أكبر من الإجمالي {r.totalShelf}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([title, rows]) => {
        const s = summarize(rows);
        return (
          <section className="contract" key={title}>
            <h3>
              {title}
              <span>{s.weightedAvg.toFixed(0)}% · {s.achievedCount}/{rows.length}</span>
            </h3>
            {rows.map((r) => {
              const entry = actuals[r.key] || (
                r.type === 'check' ? { applied: false } : { actual: 0, total: 1 }
              );
              const c = colorFor(r.achievement);
              const hasError = errorKeys.has(r.key);
              return (
                <div className={hasError ? 'cat input-error' : 'cat'} key={r.key}>
                  <div>
                    <strong>{r.name}</strong>
                    <span>المطلوب {r.targetLabel}</span>
                    {hasError && <em className="field-error">الفعلي أكبر من الإجمالي</em>}
                  </div>
                  {r.type === 'check' ? (
                    <div className="check-actions">
                      <button
                        type="button"
                        className={entry.applied ? 'check-btn active' : 'check-btn'}
                        onClick={() => updateApplied(r.key, true)}
                      >مطبق</button>
                      <button
                        type="button"
                        className={!entry.applied ? 'check-btn active bad-choice' : 'check-btn'}
                        onClick={() => updateApplied(r.key, false)}
                      >غير مطبق</button>
                    </div>
                  ) : (
                    <div className="inputs">
                      <label>
                        إجمالي
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={entry.total}
                          onChange={(e) => updateField(r.key, 'total', e.target.value)}
                        />
                      </label>
                      <b>/</b>
                      <label>
                        فعلي
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={entry.actual}
                          onChange={(e) => updateField(r.key, 'actual', e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                  <span className={'score ' + c}>
                    {r.type === 'check'
                      ? (r.applied ? 'مطبق' : 'غير مطبق')
                      : r.actualPct.toFixed(0) + '%'}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="actions">
        <button className="primary" onClick={onSave} disabled={saving}>
          <CheckCircle2 size={16} />
          {saving ? 'جاري الحفظ...' : (editingVisitId ? 'حفظ التعديل' : 'حفظ الزيارة')}
        </button>
        {!editingVisitId && (
          <button className="warn-btn" onClick={onIncomplete} disabled={saving}>
            <AlertTriangle size={16} />
            الزيارة لم تكتمل
          </button>
        )}
        {editingVisitId && (
          <button className="ghost" onClick={onCancelEdit}>إلغاء التعديل</button>
        )}
        <button className="ghost" onClick={resetInputs}>تصفير المدخلات</button>
      </div>
    </div>
  );
}
