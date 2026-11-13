(function disableProductionAdminPrivateCatalog(root) {
  "use strict";
  // 운영 관리자 대시보드에는 비공개 상품 등록을 노출하지 않습니다.
  // 기존 로그인 렌더러의 호출 계약만 유지하며 상품 조회·저장은 실행하지 않습니다.
  root.TennisNoteR4ScopedMemberCatalog = Object.freeze({
    async refresh() {},
  });
})(window);
