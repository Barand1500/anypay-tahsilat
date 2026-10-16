/** Banka 3DS formunu tam sayfa POST eder (iframe yok — X-Frame-Options: DENY) */
export type ThreeDFormPayload = {
  actionUrl: string;
  method: 'POST';
  fields: Record<string, string>;
  /** Halk Öde vb. — API’den gelen HTML belgesi */
  html?: string;
};

export function submitThreeDForm(form: ThreeDFormPayload): void {
  // Halk Öde: sunucu HTML döner → belgeyi yaz
  if (form.html?.trim()) {
    document.open();
    document.write(form.html);
    document.close();
    return;
  }

  const el = document.createElement('form');
  el.method = form.method || 'POST';
  el.action = form.actionUrl;
  el.acceptCharset = 'UTF-8';
  el.style.display = 'none';
  el.target = '_self';

  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    el.appendChild(input);
  }

  document.body.appendChild(el);
  el.submit();
}

export type PaymentCreateResult = {
  id: number;
  odemeNo: string;
  amount: number;
  status?: 'pending_3d' | 'paid' | 'failed';
  bankName?: string;
  threeD?: ThreeDFormPayload;
};

/** 3DS formu / HTML varsa bankaya gönder; yoksa false */
export function maybeStartThreeD(data: PaymentCreateResult): boolean {
  if (data.status !== 'pending_3d' || !data.threeD) return false;
  if (data.threeD.html?.trim() || data.threeD.actionUrl) {
    submitThreeDForm(data.threeD);
    return true;
  }
  return false;
}
