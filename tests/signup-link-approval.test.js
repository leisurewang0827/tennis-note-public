import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
// 비공개 권위 source e9a9c48ecfb5701cce1e7ad5e9b57a5a18e04094와 동일한 함수 계약입니다.
const contracts = [
  {
    "name": "submitMemberEnrollment",
    "file": "app/tennis-note-member-app/actions/enrollment.js",
    "sha256": "5831d601637ef56d3164334833d906d429a53c1b127a768b5c8a667c8ed0672a"
  },
  {
    "name": "syncIdentityPhoneCapabilityControl",
    "file": "app/tennis-note-member-app/forms/members.js",
    "sha256": "6bbd86651f484a2c26ba582834241d6d9f458ad7c508cf262e0941733eb9d4d8"
  },
  {
    "name": "identityProfileComplete",
    "file": "app/tennis-note-member-app/domain/members.js",
    "sha256": "c11e304f9925c1500f4a6e2076398b400938a2460b207db496a0046d5a69b93a"
  },
  {
    "name": "applySavedIdentity",
    "file": "app/tennis-note-member-app/actions/enrollment.js",
    "sha256": "099bd36d500126757a9bde28a8805bb7fc719a30121ebdb8e279ff3d6a4af67f"
  },
  {
    "name": "refreshIdentityPhoneVerification",
    "file": "app/tennis-note-member-app/data/auth.js",
    "sha256": "98493ca508fa70fd97d7cd8f5dacf07804a842043e40f61573428633cae51b6c"
  },
  {
    "name": "requestIdentityPhoneVerification",
    "file": "app/tennis-note-member-app/actions/enrollment.js",
    "sha256": "4085bac15be2efcdcd28a6920dc2ceb09b03d72d80c79d3f04d08e02e86642a8"
  },
  {
    "name": "requestNaverPhoneConsent",
    "file": "app/tennis-note-member-app/actions/enrollment.js",
    "sha256": "6503c25017141cbac5799b9c1eac49c8bcf3fc83f52e0aa2e4a648f159e8b308"
  },
  {
    "name": "confirmIdentityPhoneVerification",
    "file": "app/tennis-note-member-app/actions/enrollment.js",
    "sha256": "444d069c7c45d2009050d247e09a08863479eb05472677b8857eef914a7b2b6b"
  },
  {
    "name": "persistIdentityProfile",
    "file": "app/tennis-note-member-app/data/auth.js",
    "sha256": "e5ee34156aa29e3a0b8d171946642d854ef1725834f6f8aba7ebac0c308cafdf"
  },
  {
    "name": "populateIdentitySetup",
    "file": "app/tennis-note-member-app/forms/members.js",
    "sha256": "bf6c4f43af4b209a65254dbd46dee5fd4c2cec69305c45e30e4c3c6666243e2d"
  },
  {
    "name": "submitIdentitySetup",
    "file": "app/tennis-note-member-app/actions/enrollment.js",
    "sha256": "9d6c82ccbfb99576963cadb70d667cb84691acff326c854df8ff43c36192eb47"
  },
  {
    "name": "loadMemberLinkCandidates",
    "file": "app/admin/data/member.js",
    "sha256": "da551b060b59ab73574703a9c438d5215847f440ca720ea8680459bdd72dbe55"
  },
  {
    "name": "renderMemberManagementModal",
    "file": "app/admin/views/members.js",
    "sha256": "7509aebedc77cfbe23877fcdc2e244efb0f0684865b570af07852cc02b77dcf5"
  },
  {
    "name": "openMemberManagementModal",
    "file": "app/admin/ui/member.js",
    "sha256": "113adbd880600078f6f76ac722c4a476d7d5d1b28a6af5dfb54a84008c018449"
  },
  {
    "name": "submitSignupLinkApproval",
    "file": "app/admin/actions/member.js",
    "sha256": "4e99e568f5c02a7c1d7fa04ffd922c984eb84d106154e6d552731344e425f81a"
  },
  {
    "name": "submitMemberManagementForm",
    "file": "app/admin/actions/member.js",
    "sha256": "3ffd4748b2fb29e62eb0794292c07914349b2fc4feaebc1c9b4ca347d5d2bfb3"
  }
];
for (const {name, file, sha256} of contracts) {
  test("가입 승인 공개 모듈 원본 일치: " + name, () => {
    const source = readFileSync(new URL("../" + file, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const body = source.match(new RegExp("^(?:async )?function " + name + "\\([^]*?^}", "m"))?.[0];
    assert.ok(body, "실제 모듈에서 함수를 찾을 수 있어야 합니다");
    assert.equal(createHash("sha256").update(body).digest("hex"), sha256);
  });
}
