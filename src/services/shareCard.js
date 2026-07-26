import { toPng } from 'html-to-image';

// Capture a visit card DOM element as a PNG image and share it.
// On mobile (Android/iOS) this opens the native share sheet where WhatsApp
// appears directly. On desktop / unsupported browsers it falls back to
// downloading the image so it can be attached manually.
export async function shareVisitCard(cardEl, visit) {
  if (!cardEl) return;

  // Render the card to a PNG. We temporarily add a class so CSS can hide the
  // action buttons (share / edit / delete) while capturing, and force a solid
  // white background so the shared image never comes out transparent.
  cardEl.classList.add('capturing');
  let dataUrl;
  try {
    dataUrl = await toPng(cardEl, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      // Skip nodes explicitly marked as "no capture" (the action buttons).
      filter: (node) => !(node.classList && node.classList.contains('no-capture')),
    });
  } finally {
    cardEl.classList.remove('capturing');
  }

  const fileName = `visit-${visit.customer_code || 'client'}-${new Date()
    .toISOString()
    .split('T')[0]}.png`;

  const caption = buildCaption(visit);

  // Try the Web Share API with a file attachment (best on mobile).
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: visit.customer_name || 'زيارة',
        text: caption,
      });
      return;
    }
  } catch (e) {
    // User cancelled the share sheet — treat as a no-op, not an error.
    if (e && e.name === 'AbortError') return;
    // Any other failure falls through to the download fallback below.
  }

  // Fallback: download the image so the user can attach it to WhatsApp manually.
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

// Short text caption sent alongside the image.
function buildCaption(visit) {
  const parts = [
    `#${visit.customer_code || ''} ${visit.customer_name || ''}`.trim(),
    [visit.region, visit.chain].filter(Boolean).join(' · '),
  ];
  if (!visit.incomplete && visit.weightedAvg != null) {
    const pct = Number(visit.weightedAvg || 0).toFixed(0);
    parts.push(`الإجمالي: ${pct}%`);
  }
  return parts.filter(Boolean).join('\n');
}
