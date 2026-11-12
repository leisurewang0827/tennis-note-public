(function (root, doc) {
  'use strict';
  const preview = 'https://r4-marketplace-qa.tennisnote-app-dev.pages.dev';
  const dev = 'https://udjmiezroipctytmztwz.supabase.co';
  const fingerprint = '63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba';
  const by = id => doc.getElementById(id);
  const refresh = by('refresh'), status = by('status'), results = by('results');
  let seq = 0, timer, identityTimer;
  function clear() {
    ++seq; clearTimeout(timer); clearInterval(identityTimer); results.hidden = true; refresh.disabled = false;
    by('products').replaceChildren(); by('membership').textContent = ''; status.textContent = '';
  }
  function actor(client) {
    const cfg = client?.loadConfig?.();
    if (root.location.origin !== preview || cfg?.environment !== 'development' || cfg.supabaseUrl !== dev ||
        cfg.projectFingerprint !== fingerprint || client.isOnline?.() === false) return null;
    return client.sessionSubject?.() || null;
  }
  refresh.addEventListener('click',async () => {
    clear();
    const ticket = seq, client = root.TennisNoteDataClient, owner = actor(client);
    if (!owner) { status.textContent = '개발계 지정 계정의 로그인을 확인해 주세요.'; return; }
    refresh.disabled = true; status.textContent = '확인 중입니다.';
    const still = () => seq === ticket && actor(client) === owner && !doc.hidden;
    try {
      const v = await client.rpc('tn_r4_paid_read_qa',{}, {requireCurrentSession:true,retryAuth:false});
      if (!still()) { if (seq === ticket) clear(); return; }
      const ms = Date.parse(v?.expiresAt)-Date.now();
      if (v?.paidEnabled !== false || v.publicSaleEnabled !== false || v.membership?.synthetic !== true ||
          v.membership.title !== '무결제 검증용 이용권' || v.membership.remaining !== 1 || v.membership.sessions !== 1 ||
          !(ms>0 && ms<=905000) || !Array.isArray(v.products) || v.products.length !== 2 ||
          v.products.map(p=>p.kind).sort().join('/') !== 'business/independent_coach' ||
          v.products.some(p=>typeof p.title!=='string'||!p.title||!Number.isInteger(p.price)||p.price<0||!Number.isInteger(p.sessions)||p.sessions<1)) throw Error('scope_unavailable');
      by('products').replaceChildren(...v.products.map(p=>{
        const row=doc.createElement('li');
        row.textContent=`${p.kind==='business'?'사업장':'독립 코치'} · ${p.title} · ${p.price.toLocaleString('ko-KR')}원 · ${p.sessions}회`;
        return row;
      }));
      by('membership').textContent='무결제 검증용 이용권 · 잔여 1회';
      results.hidden=false; status.textContent='조회했습니다.';
      timer=setTimeout(()=>{clear();status.textContent='조회 시간이 끝났습니다.';},ms);
      identityTimer=setInterval(()=>{if (!still()) clear();},500);
    } catch { if (seq === ticket) { clear(); status.textContent='조회 권한이 없거나 시간이 끝났습니다.'; } }
    finally { if (seq === ticket) refresh.disabled=false; }
  });
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)clear();});
  root.addEventListener('pagehide',clear);
  root.addEventListener('offline',clear);
  root.addEventListener('storage',clear); // same-origin logout/account switch in another window
})(window,document);
