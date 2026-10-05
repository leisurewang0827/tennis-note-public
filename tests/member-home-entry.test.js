// 실제 public index와 modular entry를 사용한다. 합성 read adapter만 있고 write는 없다.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

test("회원 실제 modular entry: 늦은 캘린더→홈, 5일/회차/3카드, 재진입 읽기 0", { skip: process.env.TENNISNOTE_HOME_BROWSER !== "true", timeout: 120000 }, async () => {
  const { chromium, webkit } = require("playwright");
  for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
    const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const browser = await type.launch({ headless: true, ...(engine === "chromium" && fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
    try {
      for (const [width, height] of [[390, 844], [768, 1024], [1366, 900], [844, 390]]) for (const colorScheme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme, serviceWorkers: "block" });
        const page = await context.newPage(); const errors = []; let external = 0;
        page.on("pageerror", error => errors.push(error.message));
        await context.route("**/*", async route => {
          const url = new URL(route.request().url());
          if (url.origin !== "http://127.0.0.1:8773") { external++; return route.abort(); }
          if (url.pathname.endsWith("config.local.js")) return route.fulfill({ contentType: "text/javascript", body: "window.TennisNoteConfig = {};" });
          let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
          if (!file.startsWith(root + path.sep)) return route.fulfill({ status: 403 });
          if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
          if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
          return route.fulfill({ contentType: mime[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
        });
        await page.goto("http://127.0.0.1:8773/app/tennis-note-member-app/", { waitUntil: "networkidle" });
        await page.waitForFunction(() => Boolean(window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__));
        await page.evaluate(async () => {
          const at = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return localDateKey(d); };
          const dates = [7, 14, 21, 28, 35].map(at);
          const ticket = { id: "synthetic-new", status: "active", totalSessions: 5, usedSessions: 0, remainingSessions: 5, startsOn: at(0), expiresOn: at(42), lessonMinutes: 20 };
          const ticketRow = { id: ticket.id, user_id: "synthetic-member", branch_id: "synthetic-branch", coach_role_id: "synthetic-coach", status: "active", total_sessions: 5, used_sessions: 0, remaining_sessions: 5, starts_on: ticket.startsOn, expires_on: ticket.expiresOn,
            tn_membership_products: { name: "합성 정규 5회권", product_kind: "regular", total_sessions: 5, lesson_minutes: 20, frequency_per_week: 1, group_size: 1 } };
          const rows = dates.map((lessonDate, i) => ({ id: "synthetic-new-" + i, memberTicketId: ticket.id, coachRoleId: "synthetic-coach", lessonDate, startTime: "18:40", status: "scheduled", isOwnLesson: true, durationMinutes: 20, revision: 1 }));
          // 기존 UI는 단일권이면 반복 카드를 숨긴다. 3개 cap은 두 회원권 상황에서 검사한다.
          const second = { ...ticket, id: "synthetic-second" };
          const secondRow = { ...ticketRow, id: second.id };
          window.__homeReceipt = { dates, reads: 0, writes: 0 };
          // 관련 없는 부가 read 모델은 합성 빈값. 실제 home/ticket/lesson/round/render 함수는 유지한다.
          syncMemberRefundRequests = async () => {};
          syncMemberPendingPurchaseSchedulesFromServer = async () => {};
          syncMemberChangeRequestsFromServer = async () => true;
          syncMemberNotificationsFromServer = async () => ({ ok: true });
          syncMemberPaymentOptionsFromServer = async () => {};
          syncMemberDiscountCouponsFromServer = async () => {};
          hydrateMemberWorkspaceSessionSnapshots = async (client, workspace) => workspace;
          window.TennisNoteDataClient = { readiness: () => ({ ready: true }), getSession: () => ({ access_token: "synthetic-not-a-credential" }),
            selectRows: async table => table === "tn_member_tickets" ? [ticketRow, secondRow] : [],
            rpc: async (name, args) => {
              if (name !== "tn_schedule_v2_member_workspace") return name === "tn_current_member_schedule_integrity" ? null : [];
              window.__homeReceipt.reads++;
              return { actorUserId: "synthetic-member", from: args.target_from, to: args.target_to, tickets: [ticket, second], branches: [], coaches: [{ roleId: "synthetic-coach", name: "합성코치" }], lessons: rows.filter(row => row.lessonDate >= args.target_from && row.lessonDate <= args.target_to) };
            },
            invokeFunction: async () => { window.__homeReceipt.writes++; throw Error("write forbidden"); },
          };
          document.querySelector("#loginScreen").hidden = true;
          document.querySelector("#loginScreen").style.display = "none";
          document.querySelector("#appScreen").hidden = false;
          document.querySelector("#appScreen").style.setProperty("display", "block", "important");
          state.member = { profileId: "synthetic-member" }; state.profile.name = "합성회원";
          state.dataMode = "live"; state.lessonLogs = [];
          state.liveTickets = [ticketRow, secondRow].map(normalizeLiveTicket); state.liveLessonsLoaded = true;
          state.ticketSyncStatus = { tone: "done", text: "활성" };
          state.liveLessons = [{ id: "synthetic-old", ticketId: "synthetic-old-ticket", lessonDate: at(1), time: "18:40", status: "scheduled", isOwnLesson: true }];
          setView("scheduleView", { replaceHistory: true });
          await syncMemberLessonsFromServer(null, { force: true, week: { startDate: dates[4] } });
          window.__homeReceipt.beforeHomeReads = window.__homeReceipt.reads;
        });
        await page.locator('.tab[data-view="homeView"]').click();
        await page.waitForFunction(() => Boolean(memberHomeScheduleAuthority()) && !memberLiveScheduleRefreshInFlight);
        const receipt = await page.evaluate(async () => {
          const list = upcomingMemberLessons(24);
          const reads = window.__homeReceipt.reads;
          await refreshMemberLiveSchedule(); await refreshMemberLiveSchedule();
          return { dates: list.map(row => row.lessonDate), expected: window.__homeReceipt.dates,
            rounds: list.map(row => memberScheduleRoundLabel(row, true)), old: list.filter(row => row.ticketId === "synthetic-old-ticket").length,
            cards: document.querySelectorAll("#homeUpcomingLessons [data-home-change-lesson]").length,
            additionalReads: window.__homeReceipt.reads - reads, homeReads: reads - window.__homeReceipt.beforeHomeReads,
            writes: window.__homeReceipt.writes, overflow: document.documentElement.scrollWidth - innerWidth,
            next: document.querySelector("#nextLessonDate").textContent };
        });
        assert.deepEqual(receipt.dates, receipt.expected, `${engine}/${width}/${colorScheme}`);
        assert.deepEqual(receipt.rounds, ["1/5회차", "2/5회차", "3/5회차", "4/5회차", "5/5회차"]);
        assert.equal(receipt.old, 0); assert.equal(receipt.cards, 3); assert.equal(receipt.homeReads, 2);
        assert.equal(receipt.additionalReads, 0); assert.equal(receipt.writes, 0); assert(receipt.next.includes("18:40"));
        assert(receipt.overflow <= 1); assert.deepEqual(errors, []);
        // 외부 font/image 요청도 전부 차단. Auth/DB 연결 및 통과 요청은 0.
        assert(Number.isInteger(external));
        await context.close();
      }
    } finally { await browser.close(); }
  }
});
