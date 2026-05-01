import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { INCOMPLETE_REASONS } from '../services/incompleteReasons';

export default function IncompleteVisitModal({ customer, onConfirm, onCancel, saving }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  function handleSubmit() {
    if (!reason) return;
    onConfirm({ reason, note: note.trim() });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          <AlertTriangle size={20} />
          الزيارة لم تكتمل
        </h3>
        <p className="modal-sub">
          {customer ? customer.name : ''} — اختر سبب عدم اكتمال الزيارة. هذه الزيارة سيتم تسجيلها كملاحظة فقط ولن تُحتسب في معدلات التحقيق.
        </p>

        <div className="reason-options">
          {INCOMPLETE_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={reason === r.id ? 'reason-btn active' : 'reason-btn'}
              onClick={() => setReason(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="login-field" style={{ marginBottom: 0 }}>
          <label>ملاحظة إضافية (اختياري)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="أي تفاصيل تساعد المشرف على فهم الموقف..."
            maxLength={500}
          />
        </div>

        <div className="modal-actions">
          <button className="ghost" onClick={onCancel} disabled={saving}>
            <X size={14} /> إلغاء
          </button>
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={!reason || saving}
          >
            {saving ? 'جاري الحفظ...' : 'تأكيد الزيارة غير المكتملة'}
          </button>
        </div>
      </div>
    </div>
  );
}
