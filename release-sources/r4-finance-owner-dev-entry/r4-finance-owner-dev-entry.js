/* 지정 DEV 미리보기의 기존 지점 운영 패널 연결. 역할·서버 권한·운영 경로는 바꾸지 않는다. */
(function (root, doc) {
  'use strict';
  const client=root.TennisNoteDataClient, config=client?.loadConfig?.();
  if(root.location.origin!=='https://r4-finance-owner-qa.tennisnote-admin-dev.pages.dev'
    ||config?.environment!=='development'||config.supabaseUrl!=='https://udjmiezroipctytmztwz.supabase.co'
    ||config.projectFingerprint!=='63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba')return;
  const previous=root.TennisNoteR4ExistingAccount;
  if(!previous||!client?.sessionSubject)return;
  root.TennisNoteR4ExistingAccount=Object.freeze({
    ...previous,
    isDevFinanceTarget: () => true,
    isWorkspaceMode(context={}) {
      return (context.role==='member'&&Boolean(client.sessionSubject()))||previous.isWorkspaceMode?.(context)===true;
    },
  });
})(window,document);
